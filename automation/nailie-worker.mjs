/**
 * Nailie browser worker.
 *
 * The worker uses a visible, persistent Playwright profile. It is deliberately
 * conservative: DRY_RUN defaults to true and no CAPTCHA or anti-bot control is
 * bypassed. Nailie's markup can change, so write selectors are configurable.
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
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

async function run() {
  const browser = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1440, height: 1000 },
    args: ["--disable-dev-shm-usage"],
  });
  const page = browser.pages()[0] || await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  log("Nailie worker started", `dryRun=${dryRun} pollMs=${pollMs}`);

  let lastSignature = "";
  for (;;) {
    try {
      if (/login|sign-in/i.test(page.url())) {
        log("LOGIN_REQUIRED: sign in to Nailie in the visible browser");
      } else {
        const schedule = await readSchedule(page);
        const actions = desiredActions(schedule, staffMapping());
        const signature = JSON.stringify(actions);
        if (signature !== lastSignature) {
          lastSignature = signature;
          log("Nailie schedule changed", JSON.stringify({ rows: schedule.length, actions }));
          await applyActions(page, actions);
        }
      }
    } catch (error) {
      log("worker error", error?.stack || error?.message || String(error));
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    await page.reload({ waitUntil: "domcontentloaded" }).catch((error) => log("reload failed", error.message));
  }
}

run().catch((error) => {
  log("fatal worker error", error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
