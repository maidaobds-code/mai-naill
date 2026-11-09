/**
 * SALON BOARD browser worker.
 *
 * This intentionally uses the visible website only. It does not call a
 * SALON BOARD API. Keep DRY_RUN=true until the selectors and business rules
 * have been verified against the salon account.
 */
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { compactSalonboardName as compactName, salonboardStaffHeaderName as staffHeaderName } from "../lib/salonboardNames.mjs";

const url = process.env.SALONBOARD_SCHEDULE_URL || "https://salonboard.com/login/";
const loginUrl = "https://salonboard.com/login/";
const scheduleUrl = "https://salonboard.com/KLP/schedule/salonSchedule/";
const profileDir = process.env.SALONBOARD_PROFILE_DIR || path.resolve(".salonboard-profile");
const debugPort = Number(process.env.SALONBOARD_DEBUG_PORT || 9229);
const pollMs = Math.max(30_000, Number(process.env.SALONBOARD_POLL_MS || 60_000));
// SALON BOARD can expire an otherwise valid browser session after a period of
// inactivity. Keep the same visible session active, including during quiet
// hours, without opening a second browser or attempting to bypass login/CAPTCHA.
const keepAliveMs = Math.max(60_000, Number(process.env.SALONBOARD_KEEPALIVE_MS || 10 * 60_000));
const daytimeScanDays = Math.max(1, Number(process.env.SALONBOARD_DAY_SCAN_DAYS || 31));
const endOfDayScanDays = Math.max(daytimeScanDays, Number(process.env.SALONBOARD_END_OF_DAY_SCAN_DAYS || 93));
const configuredEndOfDayHour = Number(process.env.SALONBOARD_END_OF_DAY_HOUR);
const endOfDayHour = Number.isFinite(configuredEndOfDayHour) ? Math.min(23, Math.max(21, configuredEndOfDayHour)) : 21 + Math.floor(Math.random() * 3);
const dryRun = String(process.env.SALONBOARD_DRY_RUN ?? "true").toLowerCase() !== "false";
const logFile = process.env.SALONBOARD_LOG || path.resolve("logs", "salonboard-worker.log");
const observationFile = process.env.SALONBOARD_OBSERVATION_FILE || path.resolve("runtime", "salonboard-observed-bookings.json");
const mainaillUrl = String(process.env.MAINAILL_URL || "https://mainaill.com").replace(/\/$/, "");
const syncSecret = process.env.BOOKING_SYNC_SECRET || "";
const quietStartHour = 2;
const quietEndHour = 8;
const taskTimeoutMs = Math.max(30_000, Number(process.env.SALONBOARD_TASK_TIMEOUT_MS || 90_000));
const observedFingerprints = new Map();
let loginAlertSent = false;
let lastKeepAliveAt = 0;
// Do not alert on a cold start when the operator has not logged in yet.
// Alerts are only meaningful after this worker has successfully observed an
// authenticated SALON BOARD page and that session later disappears.
let sessionEstablished = false;

function log(message, details = "") {
  const line = `${new Date().toISOString()} ${message}${details ? ` ${details}` : ""}`;
  console.log(line);
  fs.mkdir(path.dirname(logFile), { recursive: true }).then(() => fs.appendFile(logFile, `${line}\n`)).catch(() => {});
}

function operationDelay() {
  return 1000 + Math.floor(Math.random() * 2001);
}

async function waitBeforeOperation() {
  const delay = operationDelay();
  log("waiting before operation", `${delay}ms`);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

function staffRules() {
  try {
    const value = JSON.parse(process.env.SALONBOARD_STAFF_RULES || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    throw new Error("SALONBOARD_STAFF_RULES must be valid JSON");
  }
}

async function snapshot(page) {
  const staffRows = await page.locator('[id^="STAFF_"]').allTextContents();
  const body = await page.locator("body").innerText();
  return { staffRows, body };
}

function hasAppointmentText(text) {
  // SALON BOARD renders customer cards as a name followed by 様. This is a
  // conservative signal; it avoids treating 予定あり/休日 as a booking.
  return /様/.test(text) && !/現在、ネット予約受付一括停止中の時間はありません/.test(text);
}

async function inspect(page) {
  const current = await snapshot(page);
  const rules = staffRules();
  const matches = [];
  for (const [staffName, rule] of Object.entries(rules)) {
    const externalStaffName = String(rule?.externalStaffName || rule?.externalStaffId || staffName);
    const row = current.staffRows.find((value) => value.includes(externalStaffName));
    if (!row || !hasAppointmentText(row)) continue;
    matches.push({ staffName, externalStaffName, rule, evidence: row.slice(0, 500) });
  }
  return matches;
}

async function blockStaffSchedule(page, item) {
  const rule = item.rule || {};
  await waitBeforeOperation();
  if (dryRun) {
    log("DRY_RUN would block staff schedule", `${item.staffName} ${JSON.stringify(rule)}`);
    return;
  }
  // The actual save is deliberately guarded. SALON BOARD has no documented
  // public API and its shift form can change; selectors must be verified in
  // the live account before enabling this branch.
  throw new Error(`Blocking is not enabled for ${item.staffName}; verify shift selectors first`);
}

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function japanDateTime() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

function isQuietHours() {
  const hour = japanDateTime().hour;
  return hour >= quietStartHour && hour < quietEndHour;
}
function withTaskTimeout(promise, taskId) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`Task timeout after ${taskTimeoutMs}ms: ${taskId}`)), taskTimeoutMs))]);
}

async function alertAdmin(reason) {
  if (loginAlertSent) return;
  loginAlertSent = true;
  await fetch(`${mainaillUrl}/api/bot-alert`, { method: "POST", headers: { authorization: `Bearer ${syncSecret}`, "content-type": "application/json" }, body: JSON.stringify({ bot: "SALON BOARD", reason }) }).catch((error) => log("admin alert failed", error.message));
}

function internalStaffName(externalName) {
  const headerName = staffHeaderName(externalName);
  const match = Object.entries(staffRules()).find(([name, rule]) => compactName(rule?.externalStaffName || rule?.externalStaffId || name) === compactName(headerName));
  return match?.[0] || headerName;
}

async function ingestExternalBooking(event) {
  const response = await fetch(`${mainaillUrl}/api/booking-sync`, {
    method: "POST",
    headers: { authorization: `Bearer ${syncSecret}`, "content-type": "application/json" },
    body: JSON.stringify(event),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || `Mainaill ingest HTTP ${response.status}`);
  return result;
}

async function scanExternalBookings(page, date) {
  const compactDate = date.replaceAll("-", "");
  await page.goto(`${scheduleUrl}?date=${compactDate}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForSelector('[id^="STAFF_"]', { timeout: 20_000 });
  const records = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('[id^="STAFF_"]')];
    const rows = [...document.querySelectorAll("li.jscScheduleMainTableLine")];
    return heads.flatMap((head, index) => [...(rows[index]?.querySelectorAll(".scheduleReservation") || [])].map((item) => {
      let range = [];
      try { range = JSON.parse(item.querySelector(".jscScheduleTimeZoneSetting")?.textContent || "[]"); } catch {}
      const externalStaff = String(head.textContent || "").split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
      return { externalStaff, start: range[0] || "", end: range[1] || "", customer: (item.querySelector(".scheduleReserveName")?.textContent || "").replace(/\s*様\s*$/, "").trim() };
    }));
  });
  const fingerprint = JSON.stringify(records.slice().sort((a, b) => `${a.externalStaff}|${a.start}|${a.end}|${a.customer}`.localeCompare(`${b.externalStaff}|${b.start}|${b.end}|${b.customer}`)));
  if (observedFingerprints.get(`bookings:${date}`) === fingerprint) {
    log("SALON BOARD schedule unchanged; skipping sync", date);
    return;
  }
  observedFingerprints.set(`bookings:${date}`, fingerprint);
  let observations = {};
  try { observations = JSON.parse(await fs.readFile(observationFile, "utf8")) || {}; } catch {}
  const activeIds = [];
  let imported = 0;
  for (const record of records) {
    if (!record.externalStaff || !record.start || !record.end) continue;
    const fingerprint = [date, record.externalStaff, record.start, record.end, record.customer].join("|");
    const externalBookingId = createHash("sha256").update(fingerprint).digest("hex").slice(0, 32);
    await ingestExternalBooking({
      provider: "hotpepper",
      externalBookingId,
      action: "upsert",
      booking: { date, start: record.start, end: record.end, staff: internalStaffName(record.externalStaff), customer: "SALON BOARD", service: "SALON BOARD booking", status: "CONFIRMED" },
    });
    activeIds.push(externalBookingId);
    imported += 1;
  }
  const previousIds = Array.isArray(observations[date]) ? observations[date] : null;
  if (previousIds) {
    for (const externalBookingId of previousIds.filter((id) => !activeIds.includes(id))) await ingestExternalBooking({ provider: "hotpepper", externalBookingId, action: "cancel" });
  }
  observations[date] = activeIds;
  await fs.mkdir(path.dirname(observationFile), { recursive: true });
  await fs.writeFile(observationFile, JSON.stringify(observations, null, 2), "utf8");
  log("SALON BOARD external bookings scanned", JSON.stringify({ date, found: records.length, imported }));
}

async function scanExternalClosedPeriods(page, date) {
  const records = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('[id^="STAFF_"]')];
    const rows = [...document.querySelectorAll("li.jscScheduleMainTableLine")];
    return heads.flatMap((head, index) => [...(rows[index]?.querySelectorAll(".scheduleToDoInner") || [])].flatMap((item) => {
      const text = String(item.textContent || "");
      if (/Mainaill booking\s+/i.test(text)) return [];
      let range = [];
      try { range = JSON.parse(item.querySelector(".jscScheduleTimeZoneSetting")?.textContent || "[]"); } catch {}
      const externalStaff = String(head.textContent || "").split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
      return externalStaff && range[0] && range[1] ? [{ externalStaff, start: range[0], end: range[1] }] : [];
    }));
  });
  const periods = records.map((record) => ({ staff: internalStaffName(record.externalStaff), start: record.start, end: record.end }));
  const response = await fetch(`${mainaillUrl}/api/external-closed-periods`, {
    method: "POST",
    headers: { authorization: `Bearer ${syncSecret}`, "content-type": "application/json" },
    body: JSON.stringify({ source: "hotpepper", date, periods }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || `Mainaill closed-period ingest HTTP ${response.status}`);
  log("SALON BOARD closed periods scanned", JSON.stringify({ date, found: records.length, imported: result.imported }));
}

async function fetchSyncTasks() {
  if (!syncSecret) throw new Error("BOOKING_SYNC_SECRET is required");
  const response = await fetch(`${mainaillUrl}/api/booking-sync?provider=hotpepper`, {
    headers: { authorization: `Bearer ${syncSecret}` },
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || `Mainaill HTTP ${response.status}`);
  return Array.isArray(result.tasks) ? result.tasks : [];
}

async function acknowledgeTask(task, status, error = "") {
  const response = await fetch(`${mainaillUrl}/api/booking-sync`, {
    method: "POST",
    headers: { authorization: `Bearer ${syncSecret}`, "content-type": "application/json" },
    body: JSON.stringify({ kind: "ack", provider: "hotpepper", bookingId: task.booking.id, taskId: task.taskId || "", status, error }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || `Mainaill ack HTTP ${response.status}`);
}

async function openScheduleForm(page, task) {
  const booking = task.booking || {};
  const rule = staffRules()[booking.staff] || Object.entries(staffRules()).find(([name]) => compactName(name) === compactName(booking.staff))?.[1];
  const externalName = String(rule?.externalStaffName || rule?.externalStaffId || booking.staff || "");
  const date = String(booking.date || "").replaceAll("-", "").replaceAll("/", "");
  const [startHour, startMinute] = String(booking.start || "").split(":");
  const [endHour, endMinute] = String(booking.end || "").split(":");
  if (!/^\d{8}$/.test(date) || !startHour || !startMinute || !endHour || !endMinute || !externalName) throw new Error("Invalid exact-slot booking task");

  await page.goto(`${scheduleUrl}?date=${date}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForSelector('[id^="STAFF_"]', { timeout: 20_000 });
  const heads = page.locator('[id^="STAFF_"]');
  const rows = page.locator("li.jscScheduleMainTableLine");
  let staffIndex = -1;
  for (let index = 0; index < await heads.count(); index += 1) {
    if (compactName(staffHeaderName(await heads.nth(index).innerText())) === compactName(externalName)) { staffIndex = index; break; }
  }
  if (staffIndex < 0) throw new Error(`SALON BOARD staff not found: ${externalName}`);

  const row = rows.nth(staffIndex);
  const existingItem = row.locator(".scheduleToDoInner").filter({ hasText: `Mainaill booking ${booking.id}` }).first();
  if (await existingItem.count()) {
    const savedRange = await existingItem.locator(".jscScheduleTimeZoneSetting").textContent();
    const expectedRange = JSON.stringify([`${startHour}:${startMinute}`, `${endHour}:${endMinute}`]);
    if (String(savedRange || "").replace(/\s+/g, "") !== expectedRange.replace(/\s+/g, "")) throw new Error(`SALON BOARD existing managed slot has a different range: ${savedRange}`);
    return { date, staff: externalName, start: `${startHour}:${startMinute}`, end: `${endHour}:${endMinute}`, alreadySaved: true };
  }
  const managedOverlap = await row.locator(".scheduleToDoInner").evaluateAll((items, target) => items.map((item) => {
    let range = [];
    try { range = JSON.parse(item.querySelector(".jscScheduleTimeZoneSetting")?.textContent || "[]"); } catch {}
    return { text: String(item.textContent || "").trim().slice(0, 120), start: range[0] || "", end: range[1] || "" };
  }).find((item) => item.text.includes("Mainaill booking") && item.start && item.end && item.start < target.end && item.end > target.start), { start: `${startHour}:${startMinute}`, end: `${endHour}:${endMinute}` });
  if (managedOverlap) return { date, staff: externalName, start: `${startHour}:${startMinute}`, end: `${endHour}:${endMinute}`, alreadyBlocked: true, managedOverlap };
  const area = row.locator(".jscScheduleSetArea");
  const areaBox = await area.boundingBox();
  const firstTime = row.locator(".scheduleTime").first();
  const timeBox = await firstTime.boundingBox();
  const [firstHour, firstMinute] = (await firstTime.innerText()).split(":").map(Number);
  if (!areaBox || !timeBox) throw new Error("SALON BOARD schedule grid is not visible");
  const startMinutes = Number(startHour) * 60 + Number(startMinute);
  const firstMinutes = firstHour * 60 + firstMinute;
  await page.mouse.click(areaBox.x + ((startMinutes - firstMinutes) * timeBox.width / 60) + 3, areaBox.y + areaBox.height / 2);
  const timeChoice = page.locator(".jscScheduleTimePeriodModal [data-start-time]").filter({ hasText: `${startHour}:${startMinute}` });
  if (await timeChoice.isVisible().catch(() => false)) await timeChoice.click();
  await page.waitForSelector("#fnc_schedule", { timeout: 20_000 });
  await page.locator("#fnc_schedule").click();
  await page.waitForSelector('[name="schEndHour"]', { timeout: 20_000 });

  const staffValue = await page.locator('[name="staffId"] option').evaluateAll((options, target) => {
    const compact = (value) => String(value || "").replace(/\s+/g, "").toLowerCase();
    return options.find((option) => compact(option.textContent) === compact(target))?.value || "";
  }, externalName);
  if (!staffValue) throw new Error(`SALON BOARD staff option not found: ${externalName}`);
  await page.locator('[name="staffId"]').selectOption(staffValue);
  await page.locator('[name="rsvHour"]').selectOption(startHour);
  await page.locator('[name="rsvMinute"]').selectOption(startMinute);
  const selectTimeOption = async (selector, value, label) => {
    await page.waitForFunction(({ selector: targetSelector, value: targetValue, label: targetLabel }) => [...document.querySelectorAll(`${targetSelector} option`)].some((option) => option.value === targetValue || option.textContent.trim() === targetLabel), { selector, value, label }, { timeout: 20_000 });
    const option = page.locator(`${selector} option`).filter({ hasText: label }).first();
    if (await option.count()) await page.locator(selector).selectOption({ label });
    else await page.locator(selector).selectOption(value);
  };
  await selectTimeOption('[name="schEndHour"]', endHour, endHour);
  await selectTimeOption('[name="schEndMinute"]', endMinute, endMinute);
  await page.locator('[name="schTitle"]').fill("Mainaill予約");
  await page.locator('[name="schMemo"]').fill(`Mainaill booking ${booking.id}`);
  const prepared = await page.evaluate(() => ({
    date: document.querySelector('[name="date"]')?.value,
    staff: document.querySelector('[name="staffId"]')?.selectedOptions?.[0]?.textContent?.trim(),
    start: `${document.querySelector('[name="rsvHour"]')?.value}:${document.querySelector('[name="rsvMinute"]')?.value}`,
    end: `${document.querySelector('[name="schEndHour"]')?.value}:${document.querySelector('[name="schEndMinute"]')?.value}`,
  }));
  if (prepared.date !== date || compactName(prepared.staff) !== compactName(externalName) || prepared.start !== `${startHour}:${startMinute}` || prepared.end !== `${endHour}:${endMinute}`) {
    throw new Error(`SALON BOARD form verification failed: ${JSON.stringify(prepared)}`);
  }
  return prepared;
}

async function applySyncTask(page, task) {
  if (["cancel", "unblock"].includes(task.action)) return reopenManagedSlot(page, task);
  if (!["block", "update"].includes(task.action)) throw new Error(`Unsupported SALON BOARD action: ${task.action}`);
  if (task.action === "update" && task.previousMatch) {
    await reopenManagedSlot(page, { ...task, action: "unblock", previousMatch: null, booking: { ...task.booking, ...task.previousMatch } });
    return applySyncTask(page, { ...task, action: "block", previousMatch: null });
  }
  const prepared = await openScheduleForm(page, task);
  if (prepared.alreadySaved || prepared.alreadyBlocked) {
    log("SALON BOARD exact slot already blocked", JSON.stringify({ bookingId: task.booking.id, ...prepared }));
    return;
  }
  if (dryRun) {
    log("DRY_RUN exact SALON BOARD slot prepared", JSON.stringify({ task, prepared }));
    return;
  }
  await waitBeforeOperation();
  // SALON BOARD asks for a native JavaScript confirmation before submitting.
  // The worker is already gated by dry-run mode, so accept only this prepared
  // submission and then verify the persisted time range on the schedule page.
  await page.evaluate(() => { window.confirm = () => true; });
  await page.locator("#regist").click();
  await page.waitForURL(/\/KLP\/schedule\/salonSchedule\//, { timeout: 20_000 });
  const savedItem = page.locator(".scheduleToDoInner").filter({ hasText: `Mainaill booking ${task.booking.id}` }).first();
  await savedItem.waitFor({ state: "visible", timeout: 20_000 });
  const savedRange = await savedItem.locator(".jscScheduleTimeZoneSetting").textContent();
  const expectedRange = JSON.stringify([prepared.start, prepared.end]);
  if (String(savedRange || "").replace(/\s+/g, "") !== expectedRange.replace(/\s+/g, "")) {
    throw new Error(`SALON BOARD saved-slot verification failed: ${savedRange}`);
  }
  log("SALON BOARD exact slot blocked", JSON.stringify({ bookingId: task.booking.id, ...prepared }));
}

async function reopenManagedSlot(page, task) {
  const booking = task.booking || {};
  const rule = staffRules()[booking.staff] || Object.entries(staffRules()).find(([name]) => compactName(name) === compactName(booking.staff))?.[1];
  const externalName = String(rule?.externalStaffName || rule?.externalStaffId || booking.staff || "");
  const date = String(booking.date || "").replaceAll("-", "").replaceAll("/", "");
  if (!/^\d{8}$/.test(date) || !externalName) throw new Error("Invalid SALON BOARD unblock task");
  await page.goto(`${scheduleUrl}?date=${date}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForSelector('[id^="STAFF_"]', { timeout: 20_000 });
  const heads = page.locator('[id^="STAFF_"]');
  const rows = page.locator("li.jscScheduleMainTableLine");
  let staffIndex = -1;
  for (let index = 0; index < await heads.count(); index += 1) {
    if (compactName(staffHeaderName(await heads.nth(index).innerText())) === compactName(externalName)) { staffIndex = index; break; }
  }
  if (staffIndex < 0) throw new Error(`SALON BOARD staff not found: ${externalName}`);
  const row = rows.nth(staffIndex);
  const managedItem = row.locator(".scheduleToDoInner").filter({ hasText: `Mainaill booking ${booking.id}` }).first();
  let itemToOpen = managedItem;
  let externalClosure = false;
  if (!await managedItem.count()) {
    const exactExternalIndexes = await row.locator(".scheduleToDoInner").evaluateAll((items, target) => items.flatMap((item, index) => {
      const text = String(item.textContent || "");
      if (/Mainaill booking\s+/i.test(text)) return [];
      let range = [];
      try { range = JSON.parse(item.querySelector(".jscScheduleTimeZoneSetting")?.textContent || "[]"); } catch {}
      return range[0] === target.start && range[1] === target.end ? [index] : [];
    }), { start: String(booking.start || ""), end: String(booking.end || "") });
    if (!exactExternalIndexes.length) {
      log("SALON BOARD exact slot already open", JSON.stringify({ bookingId: booking.id, date: booking.date, staff: externalName }));
      return;
    }
    if (exactExternalIndexes.length > 1) throw new Error(`Multiple SALON BOARD closures match ${booking.date} ${booking.start}-${booking.end}`);
    itemToOpen = row.locator(".scheduleToDoInner").nth(exactExternalIndexes[0]);
    externalClosure = true;
  }
  if (dryRun) {
    log("DRY_RUN SALON BOARD exact slot would open", JSON.stringify({ bookingId: booking.id, date: booking.date, staff: externalName }));
    return;
  }
  await waitBeforeOperation();
  await itemToOpen.click();
  await page.locator(".mod_popup_02.sch.js_yotei .mod_btn_10").click();
  await page.waitForURL(/\/KLP\/set\/scheduleChange\//, { timeout: 20_000 });
  const memoField = page.locator('[name="schMemo"]');
  const savedMemo = await memoField.count() ? await memoField.first().inputValue().catch(() => "") : "";
  if (externalClosure) {
    const formRange = await page.evaluate(() => ({
      start: `${document.querySelector('[name="rsvHour"]')?.value}:${document.querySelector('[name="rsvMinute"]')?.value}`,
      end: `${document.querySelector('[name="schEndHour"]')?.value}:${document.querySelector('[name="schEndMinute"]')?.value}`,
    }));
    if (formRange.start !== booking.start || formRange.end !== booking.end || /Mainaill booking\s+/i.test(savedMemo)) throw new Error(`SALON BOARD external closure verification failed: ${JSON.stringify(formRange)}`);
  } else if (String(savedMemo).trim() !== `Mainaill booking ${booking.id}`) {
    throw new Error(`SALON BOARD managed-slot ownership verification failed: ${savedMemo || "memo missing"}`);
  }
  await page.evaluate(() => { window.confirm = () => true; });
  await page.locator("#delete").click();
  await page.waitForURL(/\/KLP\/schedule\/salonSchedule\//, { timeout: 20_000 });
  const remaining = page.locator(".scheduleToDoInner").filter({ hasText: `Mainaill booking ${booking.id}` });
  if (!externalClosure && await remaining.count()) throw new Error("SALON BOARD managed slot still exists after delete");
  log("SALON BOARD exact slot opened", JSON.stringify({ bookingId: booking.id, date: booking.date, staff: externalName }));
}

async function run() {
  await launchChrome();
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
  const context = browser.contexts()[0];
  if (!context) throw new Error("Chrome CDP không có browser context");
  const page = context.pages().find((item) => item.url().includes("salonboard.com")) || context.pages()[0] || await context.newPage();
  page.on("dialog", async (dialog) => {
    const message = dialog.message();
    const isExpectedRegistration = /予定を登録します[。？?]/.test(message);
    log("SALON BOARD dialog", `${dialog.type()}: ${message} action=${isExpectedRegistration ? "accept" : "dismiss"}`);
    if (isExpectedRegistration) await dialog.accept();
    else await dialog.dismiss();
  });
  // Keep the persistent profile visible so the user can complete SALON BOARD
  // login manually. A blank/new tab must never be treated as the logged-in
  // page, and navigation errors should be retried instead of leaving Chrome
  // on about:blank.
  const navigated = await navigate(page);
  if (!navigated) await alertAdmin("Không mở được SALON BOARD sau 3 lần thử");
  log("SALON BOARD worker started", `dryRun=${dryRun} pollMs=${pollMs} daytimeScanDays=${daytimeScanDays} endOfDayScanDays=${endOfDayScanDays} quietHours=02:00-08:00 Asia/Tokyo`);

  let scanOffset = 0;
  let lastFullSweepDate = "";
  for (;;) {
    try {
      if (Date.now() - lastKeepAliveAt >= keepAliveMs && !isLoginPage(page)) {
        log("SALON BOARD keep-alive", `${Math.round(keepAliveMs / 60_000)}min interval`);
        await page.goto(scheduleUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
        lastKeepAliveAt = Date.now();
      }
      if (isQuietHours()) {
        log("SALON BOARD quiet hours; browser and worker kept alive", `keepAliveMs=${keepAliveMs}`);
        await new Promise((resolve) => setTimeout(resolve, Math.min(pollMs, 5 * 60_000)));
        continue;
      }
      if (await isSessionExpired(page)) {
        log("SESSION_EXPIRED: returning to SALON BOARD login");
        if (sessionEstablished) await alertAdmin("SALON BOARD đã đăng xuất trong khi bot đang hoạt động; hãy đăng nhập lại");
        sessionEstablished = false;
        await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 45_000 }).catch((error) => log("login navigation failed", error.message));
      } else if (isLoginPage(page)) {
        log("LOGIN_REQUIRED: sign in to SALON BOARD in the visible browser");
        if (sessionEstablished) await alertAdmin("SALON BOARD đã đăng xuất trong khi bot đang hoạt động; hãy đăng nhập lại");
        sessionEstablished = false;
        await new Promise((resolve) => setTimeout(resolve, pollMs));
        continue;
      }
      sessionEstablished = true;
      loginAlertSent = false;
      const tasks = await fetchSyncTasks();
      for (const task of tasks) {
        try {
          await withTaskTimeout(applySyncTask(page, task), task.taskId || task.booking?.id || "unknown");
          if (!dryRun) await acknowledgeTask(task, "synced");
        } catch (error) {
          log("SALON BOARD sync task failed", `${task?.booking?.id || "unknown"} ${error.message}`);
          if (!dryRun) await acknowledgeTask(task, "error", error.message).catch(() => {});
        }
      }
      const clock = japanDateTime();
      const fullSweepDue = clock.hour >= endOfDayHour && lastFullSweepDate !== clock.date;
      if (fullSweepDue) {
        log("SALON BOARD end-of-day three-month sweep started", JSON.stringify({ date: clock.date, days: endOfDayScanDays }));
        for (let offset = 0; offset < endOfDayScanDays; offset += 1) {
          const scanDate = dateKey(new Date(Date.now() + offset * 86_400_000));
          await scanExternalBookings(page, scanDate);
          await scanExternalClosedPeriods(page, scanDate);
        }
        lastFullSweepDate = clock.date;
        scanOffset = 0;
        log("SALON BOARD end-of-day three-month sweep finished", JSON.stringify({ date: clock.date, days: endOfDayScanDays }));
      } else {
        const scanDate = dateKey(new Date(Date.now() + scanOffset * 86_400_000));
        await scanExternalBookings(page, scanDate);
        await scanExternalClosedPeriods(page, scanDate);
        scanOffset = (scanOffset + 1) % daytimeScanDays;
      }
    } catch (error) {
      log("worker error", error?.stack || error?.message || String(error));
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

function isLoginPage(page) {
  const current = page.url();
  return !current || current === "about:blank" || /login|ログイン/i.test(current);
}

async function isSessionExpired(page) {
  if (/login|ログイン/i.test(page.url())) return false;
  const body = await page.locator("body").innerText().catch(() => "");
  return /ログインの有効期限が切れました|再度ログインしてください|session expired/i.test(body);
}

async function navigate(page) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      if (page.url() !== "about:blank") return true;
    } catch (error) {
      log("navigation failed", `${attempt}/3 ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
  }
  log("SALON BOARD navigation exhausted", url);
  return false;
}

run().catch((error) => {
  log("fatal worker error", error?.stack || error?.message || String(error));
  process.exitCode = 1;
});

async function launchChrome() {
  const candidates = [
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
  ].filter(Boolean);
  const executable = candidates.find((item) => fsSync.existsSync(item));
  if (!executable) throw new Error("Không tìm thấy Google Chrome cài trên máy");
  const child = spawn(executable, [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    loginUrl,
  ], { detached: false, windowsHide: false, stdio: "ignore" });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (response.ok) return child;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  child.kill();
  throw new Error(`Chrome không mở được remote debugging port ${debugPort}`);
}
