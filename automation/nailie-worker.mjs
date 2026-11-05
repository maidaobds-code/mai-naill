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

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const url = process.env.NAILIE_SCHEDULE_URL || `https://salon.nailie.jp/mysalon/staff-schedule?page=1&date=${dateKey()}&showBooking=true`;
const profileDir = process.env.NAILIE_PROFILE_DIR || path.resolve(".nailie-profile");
const pollMs = Math.max(30_000, Number(process.env.NAILIE_POLL_MS || 60_000));
const dryRun = String(process.env.NAILIE_DRY_RUN ?? "true").toLowerCase() !== "false";
const logFile = process.env.NAILIE_LOG || path.resolve("logs", "nailie-worker.log");
const debugPort = Number(process.env.NAILIE_DEBUG_PORT || 9230);
const mainaillUrl = String(process.env.MAINAILL_URL || "https://mainaill.com").replace(/\/$/, "");
const syncSecret = process.env.BOOKING_SYNC_SECRET || "";

function log(message, details = "") {
  const line = `${new Date().toISOString()} ${message}${details ? ` ${details}` : ""}`;
  console.log(line);
  fs.mkdir(path.dirname(logFile), { recursive: true })
    .then(() => fs.appendFile(logFile, `${line}\n`))
    .catch(() => {});
}

function operationDelay() {
  return 1000 + Math.floor(Math.random() * 2001);
}

async function waitBeforeOperation() {
  const delay = operationDelay();
  log("waiting before operation", `${delay}ms`);
  await new Promise((resolve) => setTimeout(resolve, delay));
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
    body: JSON.stringify({ kind: "ack", provider: "nailie", bookingId: task.booking.id, status, error }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || `Mainaill ack HTTP ${response.status}`);
}

async function applyExactSlotTask(page, task) {
  if (!["block", "update"].includes(task.action)) throw new Error(`Unsupported Nailie action: ${task.action}`);
  const booking = task.booking || {};
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
    if (before === "x") continue;
    if (before !== "o") throw new Error(`Unexpected Nailie slot state: ${before}`);
    if (!dryRun) {
      await waitBeforeOperation();
      await cell.click();
      await page.waitForFunction(({ rowKey, index }) => {
        const target = document.querySelector(`tr[data-row-key="${rowKey}"]`)?.querySelectorAll("td")?.[index]?.querySelector("img");
        return String(target?.getAttribute("alt") || "").toLowerCase() === "x";
      }, { rowKey: await row.getAttribute("data-row-key"), index: cellIndex }, { timeout: 15_000 });
    }
  }
  log(dryRun ? "DRY_RUN exact Nailie slots prepared" : "Nailie exact slots blocked", JSON.stringify({ bookingId: booking.id, staff: externalName, date: booking.date, start: booking.start, end: booking.end, prepared }));
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

async function run() {
  await launchChrome();
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
  const context = browser.contexts()[0];
  if (!context) throw new Error("Nailie Chrome CDP không có browser context");
  const page = context.pages().find((item) => item.url().includes("salon.nailie.jp")) || context.pages()[0] || await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  log("Nailie worker started", `dryRun=${dryRun} pollMs=${pollMs}`);

  let lastSignature = "";
  for (;;) {
    try {
      if (/login|sign-in/i.test(page.url())) {
        log("LOGIN_REQUIRED: sign in to Nailie in the visible browser");
      } else {
        const tasks = await fetchSyncTasks();
        for (const task of tasks) {
          try {
            await applyExactSlotTask(page, task);
            if (!dryRun) await acknowledgeTask(task, "synced");
          } catch (error) {
            log("Nailie sync task failed", `${task?.booking?.id || "unknown"} ${error.message}`);
            if (!dryRun) await acknowledgeTask(task, "error", error.message).catch(() => {});
          }
        }
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
