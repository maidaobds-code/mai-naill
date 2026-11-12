/**
 * Nailie browser worker.
 *
 * The worker uses a visible, persistent Playwright profile. It is deliberately
 * conservative: DRY_RUN defaults to true and no CAPTCHA or anti-bot control is
 * bypassed. Nailie's markup can change, so write selectors are configurable.
 */
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { awaitTaskCompletion } from "./task-guard.mjs";
import { isExpiredCapacityTask } from "../lib/syncTaskExpiry.js";
import { dateKey, waitBeforeOperation as waitWithOperationDelay } from "./worker-utils.mjs";

const url = process.env.NAILIE_SCHEDULE_URL || `https://salon.nailie.jp/mysalon/staff-schedule?page=1&date=${dateKey()}&showBooking=true`;
const profileDir = process.env.NAILIE_PROFILE_DIR || path.resolve(".nailie-profile");
const pollMs = Math.max(30_000, Number(process.env.NAILIE_POLL_MS || 60_000));
const dryRun = String(process.env.NAILIE_DRY_RUN ?? "true").toLowerCase() !== "false";
const logFile = process.env.NAILIE_LOG || path.resolve("logs", "nailie-worker.log");
const stateFile = process.env.NAILIE_STATE_FILE || path.resolve("runtime", "nailie-managed-slots.json");
const observationFile = process.env.NAILIE_OBSERVATION_FILE || path.resolve("runtime", "nailie-observed-bookings.json");
const debugPort = Number(process.env.NAILIE_DEBUG_PORT || 9230);
const mainaillUrl = String(process.env.MAINAILL_URL || "https://mainaill.com").replace(/\/$/, "");
const syncSecret = process.env.BOOKING_SYNC_SECRET || "";
const quietStartHour = 2;
const quietEndHour = 8;
const taskTimeoutMs = Math.max(30_000, Number(process.env.NAILIE_TASK_TIMEOUT_MS || 90_000));
const observedFingerprints = new Map();
let loginAlertSent = false;

function japanHour() {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
}

function isQuietHours() {
  const hour = japanHour();
  return hour >= quietStartHour && hour < quietEndHour;
}
async function alertAdmin(reason) {
  if (loginAlertSent) return;
  loginAlertSent = true;
  await fetch(`${mainaillUrl}/api/bot-alert`, { method: "POST", headers: { authorization: `Bearer ${syncSecret}`, "content-type": "application/json" }, body: JSON.stringify({ bot: "Nailie", reason }) }).catch((error) => log("admin alert failed", error.message));
}

function log(message, details = "") {
  const line = `${new Date().toISOString()} ${message}${details ? ` ${details}` : ""}`;
  console.log(line);
  fs.mkdir(path.dirname(logFile), { recursive: true })
    .then(() => fs.appendFile(logFile, `${line}\n`))
    .catch(() => {});
}

async function waitBeforeOperation() {
  await waitWithOperationDelay(log);
}

function parseJsonEnv(name, fallback) {
  try {
    const value = JSON.parse(process.env[name] || JSON.stringify(fallback));
    return value && typeof value === "object" ? value : fallback;
  } catch {
    throw new Error(`${name} must be valid JSON`);
  }
}

// Example: {"Mai":["nailie-staff-id"],"Yuki":["another-id"]}
function staffMapping() {
  const value = parseJsonEnv("NAILIE_STAFF_MAPPING", {});
  return Object.fromEntries(Object.entries(value).map(([name, ids]) => [
    name,
    (Array.isArray(ids) ? ids : [ids]).map(String).map((id) => id.trim()).filter(Boolean),
  ]));
}

function selectors() {
  return parseJsonEnv("NAILIE_SELECTORS", {
    staffRow: '[data-staff-id], [class*="staff"]',
    booking: '[class*="booking"], [class*="reservation"]',
    slot: '[data-time], [class*="slot"]',
  });
}

async function readSchedule(page) {
  const config = selectors();
  return page.locator(config.staffRow).evaluateAll((rows, cfg) => rows.map((row) => ({
    text: (row.textContent || "").replace(/\s+/g, " ").trim(),
    staffId: row.getAttribute("data-staff-id") || "",
    slots: [...row.querySelectorAll(cfg.slot)].map((slot) => ({
      text: (slot.textContent || "").replace(/\s+/g, " ").trim(),
      time: slot.getAttribute("data-time") || "",
      state: slot.getAttribute("data-state") || slot.className || "",
    })),
    bookings: [...row.querySelectorAll(cfg.booking)].map((booking) => (booking.textContent || "").replace(/\s+/g, " ").trim()),
  })), config);
}

function desiredActions(schedule, mapping) {
  const actions = [];
  for (const [staffName, externalIds] of Object.entries(mapping)) {
    const row = schedule.find((item) => externalIds.some((id) => item.staffId === id || item.text.includes(id)) || item.text.includes(staffName));
    if (!row) {
      actions.push({ staffName, type: "manual_required", reason: "staff row not found" });
      continue;
    }
    // This is intentionally a plan only. The business rule can be expanded
    // once Nailie's exact slot states and duration semantics are confirmed.
    const occupied = row.slots.filter((slot) => slot.text || /booking|reserved|disabled/i.test(slot.state));
    actions.push({ staffName, externalIds, occupiedSlots: occupied.map((slot) => slot.time || slot.text), type: "close_occupied_open_remaining" });
  }
  return actions;
}

async function applyActions(page, actions) {
  for (const action of actions) {
    await waitBeforeOperation();
    if (action.type === "manual_required") {
      log("MANUAL_REQUIRED", `${action.staffName} ${action.reason}`);
      continue;
    }
    if (dryRun) {
      log("DRY_RUN planned Nailie schedule update", JSON.stringify(action));
      continue;
    }
    throw new Error("Nailie write actions are disabled until live slot selectors and save confirmation are configured");
  }
}

function compactName(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function minutes(value) {
  const [hour, minute] = String(value || "").split(":").map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : -1;
}

async function fetchSyncTasks() {
  if (!syncSecret) throw new Error("BOOKING_SYNC_SECRET is required");
  const response = await fetch(`${mainaillUrl}/api/booking-sync?provider=nailie`, {
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
    body: JSON.stringify({ kind: "ack", provider: "nailie", bookingId: task.booking.id, taskId: task.taskId || "", status, error }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || `Mainaill ack HTTP ${response.status}`);
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

async function managedSlotState() {
  try {
    const value = JSON.parse(await fs.readFile(stateFile, "utf8"));
    if (Array.isArray(value)) return Object.fromEntries(value.map((key) => [key, ["capacity"]]));
    return value && typeof value === "object" ? value : {};
  } catch { return {}; }
}

async function saveManagedSlotState(state) {
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify(Object.fromEntries(Object.entries(state).sort(([left], [right]) => left.localeCompare(right))), null, 2), "utf8");
}

async function applyCapacityTask(page, task) {
  const booking = task.booking || task.match || {};
  const start = Math.floor(minutes(booking.start) / 30) * 30;
  const end = Math.ceil(minutes(booking.end) / 30) * 30;
  if (!booking.date || start < 0 || end <= start) throw new Error("Invalid Nailie capacity task");
  const state = await managedSlotState();
  const owner = String(task.lockOwner || "capacity");
  // Never open a slot merely because capacity is available. Only slots that
  // this worker recorded as bot-owned locks may be reopened. This protects
  // manual Nailie closures, which have no reliable marker distinguishable from
  // a bot closure in the rendered grid.
  if (task.action === "capacity_unblock") {
    const ownedSlots = Object.entries(state).filter(([key, owners]) => {
      const [date, , slot] = String(key).split("|");
      return date === String(booking.date) && Number(slot) >= start && Number(slot) < end && Array.isArray(owners) && owners.includes(owner);
    });
    if (!ownedSlots.length) {
      log("Nailie capacity unblock skipped; slot is not bot-owned", JSON.stringify({ date: booking.date, start: booking.start, end: booking.end, owner }));
      return;
    }
  }
  await page.goto(`https://salon.nailie.jp/mysalon/staff-schedule?page=1&date=${booking.date}&showBooking=true`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForSelector("tr.ant-table-row[data-row-key]", { timeout: 20_000 });
  const rows = page.locator("tr.ant-table-row[data-row-key]");
  let changed = 0;
  for (let rowIndex = 0; rowIndex < await rows.count(); rowIndex += 1) {
    const row = rows.nth(rowIndex);
    const rowKey = String(await row.getAttribute("data-row-key") || `row-${rowIndex}`);
    const cells = row.locator("td");
    for (let slot = start; slot < end; slot += 30) {
      const cellIndex = 1 + slot / 30;
      const icon = cells.nth(cellIndex).locator("img");
      const before = String(await icon.getAttribute("alt").catch(() => "") || "").toLowerCase();
      const key = `${booking.date}|${rowKey}|${slot}`;
      if (task.action === "capacity_block") {
        const owners = new Set(Array.isArray(state[key]) ? state[key] : []);
        if (before === "x" && !owners.size) continue;
        if (!dryRun && before === "o") {
          await waitBeforeOperation();
          await cells.nth(cellIndex).click();
          await page.waitForFunction(({ rowKey, index }) => String(document.querySelector(`tr[data-row-key="${rowKey}"]`)?.querySelectorAll("td")?.[index]?.querySelector("img")?.getAttribute("alt") || "").toLowerCase() === "x", { rowKey, index: cellIndex }, { timeout: 15_000 });
        }
        if (!dryRun && ["o", "x"].includes(before)) { owners.add(owner); state[key] = [...owners]; }
        changed += 1;
      } else if (task.action === "capacity_unblock" && Array.isArray(state[key]) && state[key].includes(owner)) {
        const remainingOwners = state[key].filter((value) => value !== owner);
        if (!dryRun && before === "x" && remainingOwners.length === 0) {
          await waitBeforeOperation();
          await cells.nth(cellIndex).click();
          await page.waitForFunction(({ rowKey, index }) => String(document.querySelector(`tr[data-row-key="${rowKey}"]`)?.querySelectorAll("td")?.[index]?.querySelector("img")?.getAttribute("alt") || "").toLowerCase() === "o", { rowKey, index: cellIndex }, { timeout: 15_000 });
        }
        if (!dryRun) { if (remainingOwners.length) state[key] = remainingOwners; else delete state[key]; }
        changed += 1;
      }
    }
  }
  if (!dryRun) await saveManagedSlotState(state);
  log(`Nailie salon capacity ${task.action === "capacity_block" ? "blocked" : "opened"}`, JSON.stringify({ date: booking.date, start: booking.start, end: booking.end, changed, dryRun }));
}

function internalStaffName(externalId, externalName) {
  const mapping = staffMapping();
  const match = Object.entries(mapping).find(([, values]) => values.some((value) => compactName(value) === compactName(externalId) || compactName(value) === compactName(externalName)));
  return match?.[0] || externalName;
}

function tokyoParts(value) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

async function scanExternalBookings(page, date) {
  const responsePromise = page.waitForResponse((response) => response.url().includes("/api/v1/bookings?page=1&limit=10000"), { timeout: 20_000 });
  await page.goto(`https://salon.nailie.jp/mysalon/staff-schedule?page=1&date=${date}&showBooking=true`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  const response = await responsePromise;
  const payload = await response.json();
  const records = Array.isArray(payload?.data?.data) ? payload.data.data : [];
  const fingerprint = JSON.stringify(records.map((record) => ({ id: record.id, status: record.status, start: record.startTime, end: record.endTime, updated: record.updatedAt, orders: record.orders?.map((item) => [item?.staff?.id, item?.serviceName]) })).sort((a, b) => String(a.id).localeCompare(String(b.id))));
  if (observedFingerprints.get(date) === fingerprint) {
    log("Nailie schedule unchanged; skipping sync", date);
    return;
  }
  observedFingerprints.set(date, fingerprint);
  let observations = {};
  try { observations = JSON.parse(await fs.readFile(observationFile, "utf8")) || {}; } catch {}
  const activeIds = [];
  let imported = 0;
  for (const record of records) {
    if (Number(record.status) !== 4) continue;
    const order = Array.isArray(record.orders) ? record.orders.find((item) => item?.staff) : null;
    const externalName = String(order?.staff?.name || "").trim();
    const externalId = String(order?.staff?.id || "").trim();
    if (!record.id || !record.startTime || !record.endTime || !externalName) continue;
    const start = tokyoParts(record.startTime);
    const end = tokyoParts(record.endTime);
    const services = [...new Set((record.orders || []).map((item) => String(item.serviceName || item.service?.name || "").trim()).filter(Boolean))];
    const customer = String(record.customer?.name || record.customer?.displayName || record.customer?.username || "Nailie customer").trim();
    await ingestExternalBooking({
      provider: "nailie",
      externalBookingId: String(record.id),
      account: externalName,
      action: "upsert",
      booking: { date: start.date, start: start.time, end: end.time, externalStaff: externalName, externalStaffId: externalId, customer, service: services.join(", ") || "Nailie booking", durationMinutes: Number(record.totalDuration) || Math.max(0, (new Date(record.endTime) - new Date(record.startTime)) / 60_000), status: "CONFIRMED" },
    });
    activeIds.push(String(record.id));
    imported += 1;
  }
  const previousIds = Array.isArray(observations[date]) ? observations[date] : null;
  if (previousIds) {
    for (const externalBookingId of previousIds.filter((id) => !activeIds.includes(id))) await ingestExternalBooking({ provider: "nailie", externalBookingId, action: "cancel" });
  }
  observations[date] = activeIds;
  await fs.mkdir(path.dirname(observationFile), { recursive: true });
  await fs.writeFile(observationFile, JSON.stringify(observations, null, 2), "utf8");
  log("Nailie external bookings scanned", JSON.stringify({ date, found: records.length, imported }));
}

async function applyExactSlotTask(page, task) {
  if (["capacity_block", "capacity_unblock"].includes(task.action)) return applyCapacityTask(page, task);
  if (!["block", "update", "cancel", "unblock"].includes(task.action)) throw new Error(`Unsupported Nailie action: ${task.action}`);
  const booking = task.booking || {};
  if (task.action === "update" && task.previousMatch) {
    await applyExactSlotTask(page, { ...task, action: "unblock", previousMatch: null, booking: { ...booking, ...task.previousMatch } });
    return applyExactSlotTask(page, { ...task, action: "block", previousMatch: null });
  }
  const mapping = staffMapping();
  const mapped = mapping[booking.staff] || Object.entries(mapping).find(([name]) => compactName(name) === compactName(booking.staff))?.[1] || [];
  const externalName = String(mapped[0] || booking.staff || "");
  const start = minutes(booking.start);
  const end = minutes(booking.end);
  if (!booking.date || !externalName || start < 0 || end <= start || start % 30 || end % 30) throw new Error("Nailie task must use exact 30-minute boundaries");

  await page.goto(`https://salon.nailie.jp/mysalon/staff-schedule?page=1&date=${booking.date}&showBooking=true`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForSelector("tr.ant-table-row[data-row-key]", { timeout: 20_000 });
  const rows = page.locator("tr.ant-table-row[data-row-key]");
  let rowIndex = -1;
  for (let index = 0; index < await rows.count(); index += 1) {
    const staffText = await rows.nth(index).locator("td").first().innerText();
    if (compactName(staffText) === compactName(externalName)) { rowIndex = index; break; }
  }
  if (rowIndex < 0) throw new Error(`Nailie staff not found: ${externalName}`);
  const row = rows.nth(rowIndex);
  const cells = row.locator("td");
  const prepared = [];
  for (let slot = start; slot < end; slot += 30) {
    const cellIndex = 1 + (slot / 30);
    const cell = cells.nth(cellIndex);
    const icon = cell.locator("img");
    const before = String(await icon.getAttribute("alt") || "").toLowerCase();
    if (!before) throw new Error(`Nailie slot icon missing at ${Math.floor(slot / 60)}:${String(slot % 60).padStart(2, "0")}`);
    prepared.push({ slot, before });
    const expected = ["cancel", "unblock"].includes(task.action) ? "o" : "x";
    if (before === expected) continue;
    if (!["o", "x"].includes(before)) throw new Error(`Unexpected Nailie slot state: ${before}`);
    if (!dryRun) {
      await waitBeforeOperation();
      await cell.click();
      await page.waitForFunction(({ rowKey, index, expected }) => {
        const target = document.querySelector(`tr[data-row-key="${rowKey}"]`)?.querySelectorAll("td")?.[index]?.querySelector("img");
        return String(target?.getAttribute("alt") || "").toLowerCase() === expected;
      }, { rowKey: await row.getAttribute("data-row-key"), index: cellIndex, expected }, { timeout: 15_000 });
    }
  }
  const verb = ["cancel", "unblock"].includes(task.action) ? "opened" : "blocked";
  log(dryRun ? `DRY_RUN exact Nailie slots ${verb}` : `Nailie exact slots ${verb}`, JSON.stringify({ bookingId: booking.id, staff: externalName, date: booking.date, start: booking.start, end: booking.end, prepared }));
}

async function launchChrome() {
  const bundledRoot = process.env.PLAYWRIGHT_BROWSERS_PATH || "";
  const candidates = [
    bundledRoot && path.join(bundledRoot, "chromium-1248", "chrome-win64", "chrome.exe"),
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
  ].filter(Boolean);
  const executable = candidates.find((item) => fsSync.existsSync(item));
  if (!executable) throw new Error("Không tìm thấy Chrome cho Nailie");
  const child = spawn(executable, [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    url,
  ], { detached: false, windowsHide: false, stdio: "ignore" });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (response.ok) return child;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  child.kill();
  throw new Error(`Nailie Chrome không mở được remote debugging port ${debugPort}`);
}

async function navigateWithRetry(page) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 }); if (!/login|sign-in/i.test(page.url())) return true; } catch (error) { lastError = error; log("Nailie navigation failed", `${attempt}/2 ${error.message}`); }
    await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
  }
  await alertAdmin(lastError?.message || "Trang đăng nhập vẫn hiển thị sau 2 lần thử");
  return false;
}

async function run() {
  await launchChrome();
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
  const context = browser.contexts()[0];
  if (!context) throw new Error("Nailie Chrome CDP không có browser context");
  const page = context.pages().find((item) => item.url().includes("salon.nailie.jp")) || context.pages()[0] || await context.newPage();
  await navigateWithRetry(page);
  log("Nailie worker started", `dryRun=${dryRun} pollMs=${pollMs} quietHours=02:00-08:00 Asia/Tokyo`);

  let scanOffset = 0;
  for (;;) {
    try {
      if (isQuietHours()) {
        log("Nailie quiet hours; browser and worker kept alive");
        await new Promise((resolve) => setTimeout(resolve, Math.min(pollMs, 5 * 60_000)));
        continue;
      }
      if (/login|sign-in/i.test(page.url())) {
        log("LOGIN_REQUIRED: sign in to Nailie in the visible browser");
        await alertAdmin("Profile không tự đăng nhập được; trang login vẫn hiển thị sau 2 lần truy cập");
      } else {
        loginAlertSent = false;
        const tasks = await fetchSyncTasks();
        for (const task of tasks) {
          try {
            if (isExpiredCapacityTask(task, task.booking)) {
              log("Nailie capacity task skipped; slot has already ended", JSON.stringify({ taskId: task.taskId, date: task.match?.date || task.booking?.date, end: task.match?.end || task.booking?.end }));
              if (!dryRun) await acknowledgeTask(task, "synced");
              continue;
            }
            await awaitTaskCompletion(applyExactSlotTask(page, task), {
              taskId: task.taskId || task.booking?.id || "unknown",
              slowAfterMs: taskTimeoutMs,
              onSlow: (message) => log("Nailie sync task is slow; waiting for completion", message),
            });
            if (!dryRun) await acknowledgeTask(task, "synced");
          } catch (error) {
            log("Nailie sync task failed", `${task?.booking?.id || "unknown"} ${error.message}`);
            if (!dryRun) await acknowledgeTask(task, "error", error.message).catch(() => {});
          }
        }
        const scanDate = dateKey(new Date(Date.now() + scanOffset * 86_400_000));
        await scanExternalBookings(page, scanDate);
        scanOffset = (scanOffset + 1) % 31;
      }
    } catch (error) {
      log("worker error", error?.stack || error?.message || String(error));
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

run().catch((error) => {
  log("fatal worker error", error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
