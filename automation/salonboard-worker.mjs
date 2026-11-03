/**
 * SALON BOARD browser worker.
 *
 * This intentionally uses the visible website only. It does not call a
 * SALON BOARD API. Keep DRY_RUN=true until the selectors and business rules
 * have been verified against the salon account.
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const url = process.env.SALONBOARD_SCHEDULE_URL || "https://salonboard.com/KLP/schedule/salonSchedule/";
const profileDir = process.env.SALONBOARD_PROFILE_DIR || path.resolve(".salonboard-profile");
const pollMs = Math.max(30_000, Number(process.env.SALONBOARD_POLL_MS || 60_000));
const dryRun = String(process.env.SALONBOARD_DRY_RUN ?? "true").toLowerCase() !== "false";
const logFile = process.env.SALONBOARD_LOG || path.resolve("logs", "salonboard-worker.log");

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

async function run() {
  const browser = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1440, height: 1000 },
    args: ["--disable-dev-shm-usage"],
  });
  const page = browser.pages()[0] || await browser.newPage();
  // Keep the persistent profile visible so the user can complete SALON BOARD
  // login manually. A blank/new tab must never be treated as the logged-in
  // page, and navigation errors should be retried instead of leaving Chrome
  // on about:blank.
  await navigate(page);
  log("SALON BOARD worker started", `dryRun=${dryRun} pollMs=${pollMs}`);

  let lastSignature = "";
  for (;;) {
    try {
      if (isLoginPage(page)) {
        log("LOGIN_REQUIRED: sign in to SALON BOARD in the visible browser");
        await new Promise((resolve) => setTimeout(resolve, pollMs));
        continue;
      }
      const matches = await inspect(page);
      const signature = JSON.stringify(matches);
      if (signature !== lastSignature) {
        lastSignature = signature;
        log("schedule changed", JSON.stringify(matches));
        for (const item of matches) await blockStaffSchedule(page, item);
      }
    } catch (error) {
      log("worker error", error?.stack || error?.message || String(error));
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    await page.reload({ waitUntil: "domcontentloaded" }).catch(async (error) => { log("reload failed", error.message); await navigate(page); });
  }
}

function isLoginPage(page) {
  const current = page.url();
  return !current || current === "about:blank" || /login|ログイン/i.test(current);
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
