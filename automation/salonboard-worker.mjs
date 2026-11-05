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

const url = process.env.SALONBOARD_SCHEDULE_URL || "https://salonboard.com/login/";
const loginUrl = "https://salonboard.com/login/";
const scheduleUrl = "https://salonboard.com/KLP/schedule/salonSchedule/";
const profileDir = process.env.SALONBOARD_PROFILE_DIR || path.resolve(".salonboard-profile");
const debugPort = Number(process.env.SALONBOARD_DEBUG_PORT || 9229);
const pollMs = Math.max(30_000, Number(process.env.SALONBOARD_POLL_MS || 60_000));
const dryRun = String(process.env.SALONBOARD_DRY_RUN ?? "true").toLowerCase() !== "false";
const logFile = process.env.SALONBOARD_LOG || path.resolve("logs", "salonboard-worker.log");
const mainaillUrl = String(process.env.MAINAILL_URL || "https://mainaill.com").replace(/\/$/, "");
const syncSecret = process.env.BOOKING_SYNC_SECRET || "";

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

function compactName(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function internalStaffName(externalName) {
  const match = Object.entries(staffRules()).find(([name, rule]) => compactName(rule?.externalStaffName || rule?.externalStaffId || name) === compactName(externalName));
  return match?.[0] || externalName;
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
      return { externalStaff: (head.textContent || "").trim(), start: range[0] || "", end: range[1] || "", customer: (item.querySelector(".scheduleReserveName")?.textContent || "").replace(/\s*様\s*$/, "").trim() };
    }));
  });
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
    imported += 1;
  }
  log("SALON BOARD external bookings scanned", JSON.stringify({ date, found: records.length, imported }));
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
    body: JSON.stringify({ kind: "ack", provider: "hotpepper", bookingId: task.booking.id, status, error }),
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
    if (compactName(await heads.nth(index).innerText()) === compactName(externalName)) { staffIndex = index; break; }
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
  await page.locator('[name="schEndHour"]').selectOption(endHour);
  await page.locator('[name="schEndMinute"]').selectOption(endMinute);
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
  if (prepared.alreadySaved) {
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
    if (compactName(await heads.nth(index).innerText()) === compactName(externalName)) { staffIndex = index; break; }
  }
  if (staffIndex < 0) throw new Error(`SALON BOARD staff not found: ${externalName}`);
  const managedItem = rows.nth(staffIndex).locator(".scheduleToDoInner").filter({ hasText: `Mainaill booking ${booking.id}` }).first();
  if (!await managedItem.count()) {
    log("SALON BOARD exact slot already open", JSON.stringify({ bookingId: booking.id, date: booking.date, staff: externalName }));
    return;
  }
  if (dryRun) {
    log("DRY_RUN SALON BOARD exact slot would open", JSON.stringify({ bookingId: booking.id, date: booking.date, staff: externalName }));
    return;
  }
  await waitBeforeOperation();
  await managedItem.click();
  await page.locator(".mod_popup_02.sch.js_yotei .mod_btn_10").click();
  await page.waitForURL(/\/KLP\/set\/scheduleChange\//, { timeout: 20_000 });
  const formText = await page.locator("body").innerText();
  if (!formText.includes(`Mainaill booking ${booking.id}`)) throw new Error("SALON BOARD managed-slot ownership verification failed");
  await page.evaluate(() => { window.confirm = () => true; });
  await page.locator("#delete").click();
  await page.waitForURL(/\/KLP\/schedule\/salonSchedule\//, { timeout: 20_000 });
  const remaining = page.locator(".scheduleToDoInner").filter({ hasText: `Mainaill booking ${booking.id}` });
  if (await remaining.count()) throw new Error("SALON BOARD managed slot still exists after delete");
  log("SALON BOARD exact slot opened", JSON.stringify({ bookingId: booking.id, date: booking.date, staff: externalName }));
}

async function run() {
  await launchChrome();
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
  const context = browser.contexts()[0];
  if (!context) throw new Error("Chrome CDP không có browser context");
  const page = context.pages().find((item) => item.url().includes("salonboard.com")) || context.pages()[0] || await context.newPage();
  // Keep the persistent profile visible so the user can complete SALON BOARD
  // login manually. A blank/new tab must never be treated as the logged-in
  // page, and navigation errors should be retried instead of leaving Chrome
  // on about:blank.
  await navigate(page);
  log("SALON BOARD worker started", `dryRun=${dryRun} pollMs=${pollMs}`);

  let scanOffset = 0;
  for (;;) {
    try {
      if (await isSessionExpired(page)) {
        log("SESSION_EXPIRED: returning to SALON BOARD login");
        await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 45_000 }).catch((error) => log("login navigation failed", error.message));
      } else if (isLoginPage(page)) {
        log("LOGIN_REQUIRED: sign in to SALON BOARD in the visible browser");
        await new Promise((resolve) => setTimeout(resolve, pollMs));
        continue;
      }
      const tasks = await fetchSyncTasks();
      for (const task of tasks) {
        try {
          await applySyncTask(page, task);
          if (!dryRun) await acknowledgeTask(task, "synced");
        } catch (error) {
          log("SALON BOARD sync task failed", `${task?.booking?.id || "unknown"} ${error.message}`);
          if (!dryRun) await acknowledgeTask(task, "error", error.message).catch(() => {});
        }
      }
      const scanDate = dateKey(new Date(Date.now() + scanOffset * 86_400_000));
      await scanExternalBookings(page, scanDate);
      scanOffset = (scanOffset + 1) % 31;
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
      if (page.url() !== "about:blank") return;
    } catch (error) {
      log("navigation failed", `${attempt}/3 ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
  }
  throw new Error(`SALON BOARD không mở được: ${url}`);
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
