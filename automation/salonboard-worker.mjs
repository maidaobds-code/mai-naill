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
import { awaitTaskCompletion } from "./task-guard.mjs";
import { createScheduleScanPlanner, waitBeforeOperation as waitWithOperationDelay } from "./worker-utils.mjs";

const url = process.env.SALONBOARD_SCHEDULE_URL || "https://salonboard.com/login/";
const loginUrl = "https://salonboard.com/login/";
const scheduleUrl = "https://salonboard.com/KLP/schedule/salonSchedule/";
const profileDir = process.env.SALONBOARD_PROFILE_DIR || path.resolve(".salonboard-profile");
const debugPort = Number(process.env.SALONBOARD_DEBUG_PORT || 9229);
const pollMs = Math.max(30_000, Number(process.env.SALONBOARD_POLL_MS || 60_000));
const scanIntervalMs = Math.max(5 * 60_000, Number(process.env.SALONBOARD_SCAN_INTERVAL_MS || 5 * 60_000));
// SALON BOARD can expire an otherwise valid browser session after a period of
// inactivity. Keep the same visible session active, including during quiet
// hours, without opening a second browser or attempting to bypass login/CAPTCHA.
const keepAliveMs = Math.max(60_000, Number(process.env.SALONBOARD_KEEPALIVE_MS || 10 * 60_000));
const daytimeScanDays = Math.max(1, Number(process.env.SALONBOARD_DAY_SCAN_DAYS || 31));
const scanHorizonDays = Math.max(daytimeScanDays, Number(process.env.SALONBOARD_SCAN_HORIZON_DAYS || 93));
const distantScanIntervalMs = Math.max(60_000, Number(process.env.SALONBOARD_DISTANT_SCAN_INTERVAL_MS || 10 * 60_000));
const dryRun = String(process.env.SALONBOARD_DRY_RUN ?? "true").toLowerCase() !== "false";
const logFile = process.env.SALONBOARD_LOG || path.resolve("logs", "salonboard-worker.log");
const observationFile = process.env.SALONBOARD_OBSERVATION_FILE || path.resolve("runtime", "salonboard-observed-bookings.json");
const manualVerificationFile = path.join(path.dirname(observationFile), "salonboard-manual-verification-required");
const mainaillUrl = String(process.env.MAINAILL_URL || "https://mainaill.com").replace(/\/$/, "");
const syncSecret = process.env.BOOKING_SYNC_SECRET || "";
const loginUsername = String(process.env.SALONBOARD_USERNAME || "").trim();
const loginPassword = String(process.env.SALONBOARD_PASSWORD || "");
const taskTimeoutMs = Math.max(30_000, Number(process.env.SALONBOARD_TASK_TIMEOUT_MS || 90_000));
const observedFingerprints = new Map();
let loginAlertSent = false;
let lastAlertAttemptAt = 0;
let loginRequiredSince = null;
let autoLoginAttempts = 0;
let lastKeepAliveAt = 0;
let nativeChangeConfirmationExpected = false;
let nativeChangeConfirmationHandled = false;
let hotErrorUntil = 0;
let manualVerificationRequired = fsSync.existsSync(manualVerificationFile);
// Give manual login two minutes at startup, then report unattended login failures.
let sessionEstablished = false;

function log(message, details = "") {
  const line = `${new Date().toISOString()} ${message}${details ? ` ${details}` : ""}`;
  console.log(line);
  fs.mkdir(path.dirname(logFile), { recursive: true }).then(() => fs.appendFile(logFile, `${line}\n`)).catch(() => {});
}

async function waitBeforeOperation() {
  await waitWithOperationDelay(log);
}
async function hotAction(action) {
  await waitBeforeOperation();
  return action();
}
async function isHumanVerificationPage(page) {
  const body = await page.locator("body").innerText().catch(() => "");
  return /画像認証|イラストを完成させて|バーをドラッグして/.test(body);
}
async function requireManualVerification() {
  if (manualVerificationRequired) return;
  manualVerificationRequired = true;
  await fs.mkdir(path.dirname(manualVerificationFile), { recursive: true });
  await fs.writeFile(manualVerificationFile, new Date().toISOString(), "utf8");
  log("SALON BOARD image verification required; HOT automation paused");
  await alertAdmin("SALON BOARD yêu cầu xác minh hình; bot đã tạm dừng. Hãy xác minh thủ công trong Chrome của bot.");
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

async function alertAdmin(reason) {
  if (loginAlertSent || (lastAlertAttemptAt && Date.now() - lastAlertAttemptAt < 60_000)) return;
  lastAlertAttemptAt = Date.now();
  try {
    const response = await fetch(`${mainaillUrl}/api/bot-alert`, { method: "POST", headers: { authorization: `Bearer ${syncSecret}`, "content-type": "application/json" }, body: JSON.stringify({ bot: "SALON BOARD", reason }), signal: AbortSignal.timeout(20_000) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok !== true || result.result?.ok !== true) throw new Error(result.reason || result.message || result.result?.reason || `Alert HTTP ${response.status}`);
    loginAlertSent = true;
    log("admin alert accepted by email provider");
  } catch (error) {
    log("admin alert failed; will retry", error.message);
  }
}

async function tryAutoLogin(page) {
  if (manualVerificationRequired || !isLoginPage(page) || autoLoginAttempts >= 2) return false;
  if (await isHumanVerificationPage(page)) { await requireManualVerification(); return false; }
  if (await page.locator('iframe[src*="captcha"], input[name*="captcha"], input[autocomplete="one-time-code"]').count()) return false;
  const user = page.locator('input[name="userId"], input[name="loginId"], input[name="username"], input[type="email"], input[type="text"]').first();
  const password = page.locator('input[name="password"], input[type="password"]').first();
  if (!await user.count() || !await password.count()) {
    log("SALON BOARD auto-login skipped: login fields not found");
    return false;
  }
  if (loginUsername && loginPassword) {
    await hotAction(() => user.fill(loginUsername));
    await hotAction(() => password.fill(loginPassword));
  } else if (!await user.evaluate((input) => Boolean(input.value.trim())) || !await password.evaluate((input) => Boolean(input.value))) {
    log("SALON BOARD auto-login skipped: configure credentials in Bot Manager or fill both browser fields");
    return false;
  }
  const submit = page.locator('form#idPasswordInputForm a[onclick*="dologin"], a.common-CNCcommon__primaryBtn[onclick*="dologin"], button[type="submit"], input[type="submit"], button:has-text("ログイン"), button:has-text("Login")').first();
  if (!await submit.count()) {
    log("SALON BOARD auto-login skipped: login control not found");
    return false;
  }
  const submitBox = await submit.boundingBox();
  if (!submitBox) return false;
  autoLoginAttempts += 1;
  await hotAction(() => page.mouse.click(submitBox.x + submitBox.width / 2, submitBox.y + submitBox.height / 2));
  await page.waitForURL((target) => !/login|ログイン/i.test(target.href), { timeout: 20_000 }).catch(() => {});
  if (await isHumanVerificationPage(page)) { await requireManualVerification(); return false; }
  const loggedIn = !isLoginPage(page) && !(await isSessionExpired(page));
  log(loggedIn ? "SALON BOARD auto-login succeeded" : "SALON BOARD auto-login needs visible verification");
  return loggedIn;
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
  await hotAction(() => page.goto(`${scheduleUrl}?date=${compactDate}`, { waitUntil: "domcontentloaded", timeout: 45_000 }));
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

async function acknowledgeTask(task, status, error = "", externalBookingId = "") {
  const response = await fetch(`${mainaillUrl}/api/booking-sync`, {
    method: "POST",
    headers: { authorization: `Bearer ${syncSecret}`, "content-type": "application/json" },
    body: JSON.stringify({ kind: "ack", provider: "hotpepper", bookingId: task.booking.id, taskId: task.taskId || "", status, error, externalBookingId }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || `Mainaill ack HTTP ${response.status}`);
}

async function processPriorityTasks(page) {
  const tasks = await fetchSyncTasks();
  const blockedBookingIds = new Set();
  for (const task of tasks) {
    if (blockedBookingIds.has(String(task.booking?.id))) continue;
    try {
      const result = await awaitTaskCompletion(applySyncTask(page, task), {
        taskId: task.taskId || task.booking?.id || "unknown",
        slowAfterMs: taskTimeoutMs,
        onSlow: (message) => log("SALON BOARD sync task is slow; waiting for completion", message),
      });
      if (!dryRun) await acknowledgeTask(task, "synced", "", result?.externalBookingId || "");
    } catch (error) {
      blockedBookingIds.add(String(task.booking?.id));
      if (nativeChangeConfirmationHandled && task.booking?.source === "hotpepper" && task.previousMatch) error.noRetry = true;
      log("SALON BOARD sync task failed", `${task?.booking?.id || "unknown"} ${error.message}`);
      if (!dryRun) await acknowledgeTask(task, error.noRetry ? "manual_required" : "error", error.message).catch(() => {});
      if (page.url().includes("/ErrorDocument/") || /HOT returned error page/.test(error.message || "")) hotErrorUntil = Date.now() + 5 * 60_000;
      nativeChangeConfirmationHandled = false;
    }
  }
  return tasks.length;
}

async function openScheduleForm(page, task) {
  const booking = task.booking || {};
  const rule = staffRules()[booking.staff] || Object.entries(staffRules()).find(([name]) => compactName(name) === compactName(booking.staff))?.[1];
  const externalName = String(rule?.externalStaffName || rule?.externalStaffId || booking.staff || "");
  const date = String(booking.date || "").replaceAll("-", "").replaceAll("/", "");
  const [startHour, startMinute] = String(booking.start || "").split(":");
  const [endHour, endMinute] = String(booking.end || "").split(":");
  if (!/^\d{8}$/.test(date) || !startHour || !startMinute || !endHour || !endMinute || !externalName) throw new Error("Invalid exact-slot booking task");

  await hotAction(() => page.goto(`${scheduleUrl}?date=${date}`, { waitUntil: "domcontentloaded", timeout: 45_000 }));
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
  await hotAction(() => page.mouse.click(areaBox.x + ((startMinutes - firstMinutes) * timeBox.width / 60) + 3, areaBox.y + areaBox.height / 2));
  const timeChoice = page.locator(".jscScheduleTimePeriodModal [data-start-time]").filter({ hasText: `${startHour}:${startMinute}` });
  if (await timeChoice.isVisible().catch(() => false)) await hotAction(() => timeChoice.click());
  await page.waitForSelector("#fnc_schedule", { timeout: 20_000 });
  await hotAction(() => page.locator("#fnc_schedule").click());
  await page.waitForSelector('[name="schEndHour"]', { timeout: 20_000 });

  const staffValue = await page.locator('[name="staffId"] option').evaluateAll((options, target) => {
    const compact = (value) => String(value || "").replace(/\s+/g, "").toLowerCase();
    return options.find((option) => compact(option.textContent) === compact(target))?.value || "";
  }, externalName);
  if (!staffValue) throw new Error(`SALON BOARD staff option not found: ${externalName}`);
  await hotAction(() => page.locator('[name="staffId"]').selectOption(staffValue));
  await hotAction(() => page.locator('[name="rsvHour"]').selectOption(startHour));
  await hotAction(() => page.locator('[name="rsvMinute"]').selectOption(startMinute));
  const selectTimeOption = async (selector, value, label) => {
    await page.waitForFunction(({ selector: targetSelector, value: targetValue, label: targetLabel }) => [...document.querySelectorAll(`${targetSelector} option`)].some((option) => option.value === targetValue || option.textContent.trim() === targetLabel), { selector, value, label }, { timeout: 20_000 });
    const option = page.locator(`${selector} option`).filter({ hasText: label }).first();
    if (await option.count()) await hotAction(() => page.locator(selector).selectOption({ label }));
    else await hotAction(() => page.locator(selector).selectOption(value));
  };
  await selectTimeOption('[name="schEndHour"]', endHour, endHour);
  await selectTimeOption('[name="schEndMinute"]', endMinute, endMinute);
  await hotAction(() => page.locator('[name="schTitle"]').fill("Mainaill予約"));
  await hotAction(() => page.locator('[name="schMemo"]').fill(`Mainaill booking ${booking.id}`));
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
  if (task.booking?.source === "hotpepper" && task.action === "update" && task.previousMatch) return updateNativeReservation(page, task);
  if (["cancel", "unblock"].includes(task.action)) return reopenManagedSlot(page, { ...task, booking: { ...task.booking, ...task.match } });
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
  await hotAction(() => page.locator("#regist").click());
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

async function updateNativeReservation(page, task) {
  nativeChangeConfirmationHandled = false;
  const old = task.previousMatch;
  const next = task.destination || task.booking;
  const expectedId = String(task.booking?.externalBookingId || "");
  if (!/^[a-f0-9]{32}$/.test(expectedId)) throw new Error("HOT original reservation fingerprint missing; edit refused");
  if (old.date !== next.date) throw new Error("HOT native reservation date move needs separate calendar verification");
  const rule = staffRules()[next.staff] || Object.entries(staffRules()).find(([name]) => compactName(name) === compactName(next.staff))?.[1];
  const destinationName = String(rule?.externalStaffName || rule?.externalStaffId || next.staff || "");
  const oldRule = staffRules()[old.staff] || Object.entries(staffRules()).find(([name]) => compactName(name) === compactName(old.staff))?.[1];
  const oldName = String(oldRule?.externalStaffName || oldRule?.externalStaffId || old.staff || "");
  const date = old.date.replaceAll("-", "");
  await hotAction(() => page.goto(`${scheduleUrl}?date=${date}`, { waitUntil: "domcontentloaded", timeout: 45_000 }));
  await page.locator(".scheduleReservation").first().waitFor({ timeout: 20_000 });
  const rows = page.locator("li.jscScheduleMainTableLine");
  const heads = page.locator('[id^="STAFF_"]');
  let rowIndex = -1;
  for (let i = 0; i < await heads.count(); i += 1) if (compactName(staffHeaderName(await heads.nth(i).innerText())) === compactName(oldName)) { rowIndex = i; break; }
  if (rowIndex < 0) throw new Error(`HOT original staff not found: ${oldName}`);
  const originalHeader = staffHeaderName(await heads.nth(rowIndex).innerText());
  const matches = rows.nth(rowIndex).locator(".scheduleReservation").filter({ has: page.locator(".jscScheduleTimeZoneSetting") });
  const candidates = await matches.evaluateAll((items) => items.map((item, index) => {
    let range = [];
    try { range = JSON.parse(item.querySelector(".jscScheduleTimeZoneSetting")?.textContent || "[]"); } catch {}
    return { index, start: range[0] || "", end: range[1] || "", customer: (item.querySelector(".scheduleReserveName")?.textContent || "").replace(/\s*様\s*$/, "").trim() };
  }));
  const exact = candidates.filter((candidate) => createHash("sha256").update([old.date, originalHeader, candidate.start, candidate.end, candidate.customer].join("|")).digest("hex").slice(0, 32) === expectedId);
  if (exact.length !== 1 || exact[0].start !== old.start || exact[0].end !== old.end) throw new Error(`HOT original reservation identity mismatch: ${old.date} ${old.start}-${old.end} ${oldName} (${exact.length} matches)`);
  await hotAction(() => matches.nth(exact[0].index).click());
  await hotAction(() => page.locator(".btn_schedule_change").click());
  await page.waitForURL(/\/KLP\/reserve\/ext\/extReserveChange\//, { timeout: 20_000 });
  const reserveId = new URL(page.url()).searchParams.get("reserveId");
  if (!reserveId || !/^[A-Za-z0-9_-]+$/.test(reserveId)) throw new Error("HOT reservation ID missing from edit form; edit refused");
  const formDate = await page.locator('[name="rsvDispDate"]').inputValue();
  if (formDate.replace(/\D/g, "") !== date) throw new Error(`HOT reservation date mismatch: ${formDate}`);
  const originalForm = await page.evaluate(() => ({
    start: `${document.querySelector('[name="rsvHour"]')?.value}:${document.querySelector('[name="rsvMinute"]')?.value}`,
    end: `${document.querySelector('[name="staffEndHourList"]')?.value}:${document.querySelector('[name="staffEndMinuteList"]')?.value}`,
    staff: document.querySelector('[name="staffIdList"]')?.selectedOptions?.[0]?.textContent?.trim() || "",
  }));
  if (originalForm.start !== old.start || originalForm.end !== old.end || !compactName(originalForm.staff).includes(compactName(oldName))) throw new Error(`HOT original edit form differs from schedule: ${JSON.stringify(originalForm)}`);
  const staffOption = await page.locator('[name="staffIdList"] option').evaluateAll((options, target) => options.find(option => String(option.textContent || "").replace(/^[○×]\s*/, "").replace(/\s+/g, "").toLowerCase() === target.replace(/\s+/g, "").toLowerCase())?.value || "", destinationName);
  if (!staffOption) throw new Error(`HOT destination staff option not found: ${destinationName}`);
  const [startHour, startMinute] = next.start.split(":");
  const [endHour, endMinute] = next.end.split(":");
  const duration = (Number(endHour) * 60 + Number(endMinute)) - (Number(startHour) * 60 + Number(startMinute));
  if (duration <= 0 || duration % 5) throw new Error("HOT destination duration invalid");
  await hotAction(() => page.locator('[name="rsvHour"]').selectOption(startHour));
  await hotAction(() => page.locator('[name="rsvMinute"]').selectOption(startMinute));
  await hotAction(() => page.locator('[name="rsvTermHour"]').selectOption(String(Math.floor(duration / 60) * 60)));
  await hotAction(() => page.locator('[name="rsvTermMinute"]').selectOption(String(duration % 60)));
  await hotAction(() => page.locator('[name="staffIdList"]').selectOption(staffOption));
  await hotAction(() => page.locator('[name="staffStartHourList"]').selectOption(startHour));
  await hotAction(() => page.locator('[name="staffStartMinuteList"]').selectOption(startMinute));
  await hotAction(() => page.locator('[name="staffEndHourList"]').selectOption(endHour));
  await hotAction(() => page.locator('[name="staffEndMinuteList"]').selectOption(endMinute));
  const prepared = await page.evaluate(() => ({ start: `${document.querySelector('[name="rsvHour"]')?.value}:${document.querySelector('[name="rsvMinute"]')?.value}`, staff: document.querySelector('[name="staffIdList"]')?.value, end: `${document.querySelector('[name="staffEndHourList"]')?.value}:${document.querySelector('[name="staffEndMinuteList"]')?.value}` }));
  if (prepared.start !== next.start || prepared.end !== next.end || prepared.staff !== staffOption) throw new Error(`HOT native reservation form mismatch: ${JSON.stringify(prepared)}`);
  if (dryRun) { log("DRY_RUN HOT native reservation prepared", JSON.stringify({ id: task.booking.id, reserveId, destinationName, ...prepared })); return; }
  nativeChangeConfirmationExpected = true;
  nativeChangeConfirmationHandled = false;
  try {
    await Promise.all([page.waitForEvent("dialog", { timeout: 15_000 }), hotAction(() => page.locator("#change").click())]);
    await page.waitForURL((target) => target.pathname.includes("/KLP/schedule/salonSchedule/") || target.pathname.includes("/ErrorDocument/"), { timeout: 45_000 });
    if (page.url().includes("/ErrorDocument/")) throw new Error("HOT returned error page after reservation save; result must be checked manually");
  } catch (error) {
    if (nativeChangeConfirmationHandled) error.noRetry = true;
    throw error;
  } finally {
    nativeChangeConfirmationExpected = false;
  }
  await hotAction(() => page.goto(`${scheduleUrl}?date=${date}`, { waitUntil: "domcontentloaded", timeout: 45_000 }));
  await page.locator(".scheduleReservation").first().waitFor({ timeout: 20_000 });
  const confirmed = await page.evaluate(({ slot, staffName }) => {
    const heads = [...document.querySelectorAll('[id^="STAFF_"]')];
    const rows = [...document.querySelectorAll('li.jscScheduleMainTableLine')];
    const compact = value => String(value || '').replace(/\s+/g, '').toLowerCase();
    const index = heads.findIndex(head => compact(head.textContent).includes(compact(staffName)));
    if (index < 0) return false;
    return [...rows[index].querySelectorAll('.scheduleReservation')].some(item => { try { const range = JSON.parse(item.querySelector('.jscScheduleTimeZoneSetting')?.textContent || '[]'); return range[0] === slot.start && range[1] === slot.end; } catch { return false; } });
  }, { slot: next, staffName: destinationName });
  if (!confirmed) throw new Error("HOT native reservation not visible at destination after save");
  const destinationRows = page.locator("li.jscScheduleMainTableLine");
  const destinationHeads = page.locator('[id^="STAFF_"]');
  let destinationIndex = -1;
  for (let i = 0; i < await destinationHeads.count(); i += 1) if (compactName(staffHeaderName(await destinationHeads.nth(i).innerText())) === compactName(destinationName)) { destinationIndex = i; break; }
  if (destinationIndex < 0) throw new Error("HOT destination staff missing during ID verification");
  const destinationCandidates = destinationRows.nth(destinationIndex).locator(".scheduleReservation");
  const destinationMatches = await destinationCandidates.evaluateAll((items, slot) => items.flatMap((item, index) => {
    try { const range = JSON.parse(item.querySelector(".jscScheduleTimeZoneSetting")?.textContent || "[]"); return range[0] === slot.start && range[1] === slot.end ? [index] : []; } catch { return []; }
  }), next);
  if (destinationMatches.length !== 1) throw new Error(`HOT destination ambiguous after save (${destinationMatches.length} matches)`);
  await hotAction(() => destinationCandidates.nth(destinationMatches[0]).click());
  await hotAction(() => page.locator(".btn_schedule_change").click());
  await page.waitForURL(/\/KLP\/reserve\/ext\/extReserveChange\//, { timeout: 20_000 });
  const savedReserveId = new URL(page.url()).searchParams.get("reserveId");
  if (savedReserveId !== reserveId) throw new Error(`HOT reservation ID changed after save: ${reserveId} -> ${savedReserveId}`);
  const destinationHeader = staffHeaderName(await destinationHeads.nth(destinationIndex).innerText());
  const externalBookingId = createHash("sha256").update([next.date, destinationHeader, next.start, next.end, exact[0].customer].join("|")).digest("hex").slice(0, 32);
  log("HOT native reservation updated", JSON.stringify({ bookingId: task.booking.id, reserveId, destinationName, start: next.start, end: next.end }));
  return { externalBookingId };
}

async function reopenManagedSlot(page, task) {
  const booking = task.booking || {};
  const rule = staffRules()[booking.staff] || Object.entries(staffRules()).find(([name]) => compactName(name) === compactName(booking.staff))?.[1];
  const externalName = String(rule?.externalStaffName || rule?.externalStaffId || booking.staff || "");
  const date = String(booking.date || "").replaceAll("-", "").replaceAll("/", "");
  if (!/^\d{8}$/.test(date) || !externalName) throw new Error("Invalid SALON BOARD unblock task");
  await hotAction(() => page.goto(`${scheduleUrl}?date=${date}`, { waitUntil: "domcontentloaded", timeout: 45_000 }));
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
  await hotAction(() => itemToOpen.click());
  await hotAction(() => page.locator(".mod_popup_02.sch.js_yotei .mod_btn_10").click());
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
  await hotAction(() => page.locator("#delete").click());
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
    const isExpectedNativeChange = nativeChangeConfirmationExpected && dialog.type() === "confirm" && /^予約を変更します。よろしいですか？$/.test(message.trim());
    const accept = isExpectedRegistration || isExpectedNativeChange;
    log("SALON BOARD dialog", `${dialog.type()}: ${message} action=${accept ? "accept" : "dismiss"}`);
    try {
      if (accept) {
        await dialog.accept();
        if (isExpectedNativeChange) nativeChangeConfirmationHandled = true;
      }
      else await dialog.dismiss();
    } catch (error) {
      log("SALON BOARD dialog handler failed", error.message);
    }
  });
  // Keep the persistent profile visible so the user can complete SALON BOARD
  // login manually. A blank/new tab must never be treated as the logged-in
  // page, and navigation errors should be retried instead of leaving Chrome
  // on about:blank.
  const navigated = manualVerificationRequired && page.url() !== "about:blank" ? true : await navigate(page);
  if (!navigated) await alertAdmin("Không mở được SALON BOARD sau 3 lần thử");
  log("SALON BOARD worker started", `dryRun=${dryRun} pollMs=${pollMs} daytimeScanDays=${daytimeScanDays} scanHorizonDays=${scanHorizonDays} distantScanIntervalMs=${distantScanIntervalMs} scanMode=interleaved continuous=true`);

  const scanPlanner = createScheduleScanPlanner({ nearDays: daytimeScanDays, horizonDays: scanHorizonDays, distantIntervalMs: distantScanIntervalMs });
  let lastScanAt = 0;
  for (;;) {
    try {
      if (await isHumanVerificationPage(page)) await requireManualVerification();
      if (manualVerificationRequired) {
        if (page.url().includes("/KLP/schedule/salonSchedule/") && await page.locator('[id^="STAFF_"]').count()) {
          manualVerificationRequired = false;
          await fs.rm(manualVerificationFile, { force: true });
          autoLoginAttempts = 0;
          log("SALON BOARD manual verification completed; HOT automation resumed");
        } else {
          await new Promise((resolve) => setTimeout(resolve, pollMs));
          continue;
        }
      }
      if (Date.now() < hotErrorUntil) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(pollMs, hotErrorUntil - Date.now())));
        continue;
      }
      if (await isSessionExpired(page)) {
        log("SESSION_EXPIRED: returning to SALON BOARD login");
        sessionEstablished = false;
        await hotAction(() => page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 45_000 })).catch((error) => log("login navigation failed", error.message));
        const recovered = await tryAutoLogin(page).catch((error) => { log("SALON BOARD auto-login failed", error.message); return false; });
        if (!recovered && autoLoginAttempts >= 2) await alertAdmin("SALON BOARD không đăng nhập được sau 2 lần thử; hãy kiểm tra trên Chrome của bot");
        // Re-check authentication on the next iteration before fetching tasks.
        await new Promise((resolve) => setTimeout(resolve, pollMs));
        continue;
      } else if (isLoginPage(page)) {
        const autoLoggedIn = await tryAutoLogin(page);
        if (!autoLoggedIn) {
          log("LOGIN_REQUIRED: sign in to SALON BOARD in the visible browser");
          loginRequiredSince ??= Date.now();
          if (autoLoginAttempts >= 2) {
            await alertAdmin("SALON BOARD đang ở trang đăng nhập; bot không thể đồng bộ, hãy đăng nhập lại");
          }
          await new Promise((resolve) => setTimeout(resolve, pollMs));
          continue;
        }
      }
      if (Date.now() - lastKeepAliveAt >= keepAliveMs && !isLoginPage(page)) {
        log("SALON BOARD keep-alive", `${Math.round(keepAliveMs / 60_000)}min interval`);
        await hotAction(() => page.goto(scheduleUrl, { waitUntil: "domcontentloaded", timeout: 45_000 }));
        lastKeepAliveAt = Date.now();
        if (isLoginPage(page) || await isSessionExpired(page)) continue;
      }
      if (page.url().includes("/ErrorDocument/") || /混み合っている可能性があります/.test(await page.locator("body").innerText().catch(() => ""))) {
        hotErrorUntil = Date.now() + 5 * 60_000;
        log("SALON BOARD overloaded; pausing all HOT actions", "5 minutes");
        continue;
      }
      sessionEstablished = true;
      loginAlertSent = false;
      lastAlertAttemptAt = 0;
      loginRequiredSince = null;
      autoLoginAttempts = 0;
      await processPriorityTasks(page);
      if (Date.now() < hotErrorUntil) continue;
      if (Date.now() - lastScanAt < scanIntervalMs) {
        await new Promise((resolve) => setTimeout(resolve, pollMs));
        continue;
      }
      lastScanAt = Date.now();
      const scanPlan = scanPlanner.next();
      if (scanPlan.date.endsWith("-12-31") || scanPlan.date.endsWith("-01-01")) {
        log("SALON BOARD holiday scan skipped", scanPlan.date);
        scanPlanner.complete(scanPlan);
        await new Promise((resolve) => setTimeout(resolve, pollMs));
        continue;
      }
      log("SALON BOARD incremental scan", JSON.stringify(scanPlan));
      await scanExternalBookings(page, scanPlan.date);
      // A scan can take long enough for a move/repair task to arrive. Pause the
      // scan between page operations, finish every queued repair, then resume.
      if (await processPriorityTasks(page)) log("SALON BOARD scan paused for priority tasks; resuming same date", scanPlan.date);
      await scanExternalClosedPeriods(page, scanPlan.date);
      scanPlanner.complete(scanPlan);
    } catch (error) {
      log("worker error", error?.stack || error?.message || String(error));
      if (page.url().includes("/ErrorDocument/") || /ErrorDocument|HOT returned error page/.test(error.message || "")) {
        hotErrorUntil = Date.now() + 5 * 60_000;
        log("SALON BOARD error page; pausing all HOT actions", "5 minutes");
      }
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

function isLoginPage(page) {
  const current = page.url();
  return !current || current === "about:blank" || /login|ログイン/i.test(current);
}

async function isSessionExpired(page) {
  // SALON BOARD can display expiry text at a URL that also contains "login".
  // Line wrapping/spacing must not prevent recognition of the Japanese notice.
  const body = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, "");
  return /ログインの有効期限が切れました|再度ログイン(?:しなおして|して)ください|sessionexpired/i.test(body);
}

async function navigate(page) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await hotAction(() => page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 }));
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
