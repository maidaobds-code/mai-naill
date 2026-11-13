const { app, BrowserWindow, ipcMain, shell, safeStorage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const DEFAULT_CONFIG = {
  mainaillUrl: "https://mainaill.com",
  bookingSyncSecret: "",
  salonboardUsername: "",
  salonboardPasswordEncrypted: "",
  pollMinSeconds: 45,
  pollMaxSeconds: 90,
  nailieDryRun: true,
  salonboardDryRun: true,
  nailieStaffMapping: {},
  salonboardStaffRules: {},
  autoStartBot: true,
  startWorkersOnLaunch: true,
  startWithWindows: true,
};

let mainWindow;
const workers = new Map();
const startingWorkers = new Set();
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();
app.on("second-instance", () => {
  if (mainWindow?.isMinimized()) mainWindow.restore();
  mainWindow?.show();
  mainWindow?.focus();
});

function dataRoot() {
  return path.join(app.getPath("userData"), "runtime");
}

function configPath() {
  return path.join(dataRoot(), "config.json");
}

function ensureDataFolders() {
  for (const folder of [dataRoot(), path.join(dataRoot(), "logs"), path.join(dataRoot(), "profiles", "nailie"), path.join(dataRoot(), "profiles", "salonboard"), path.join(dataRoot(), "profiles", "salonboard-v2")]) fs.mkdirSync(folder, { recursive: true });
}

function readConfig() {
  ensureDataFolders();
  try {
    const stored = JSON.parse(fs.readFileSync(configPath(), "utf8"));
    const autoStartBot = Object.hasOwn(stored, "autoStartBot") ? Boolean(stored.autoStartBot) : true;
    return { ...DEFAULT_CONFIG, ...stored, autoStartBot, startWorkersOnLaunch: autoStartBot, startWithWindows: autoStartBot };
  }
  catch { return { ...DEFAULT_CONFIG }; }
}

function applyStartupSettings(config) {
  app.setLoginItemSettings({ openAtLogin: Boolean(config.autoStartBot), path: process.execPath });
}

function saveConfig(value) {
  ensureDataFolders();
  let existing = {};
  try { existing = JSON.parse(fs.readFileSync(configPath(), "utf8")); } catch {}
  const requested = { ...(value || {}) };
  if (typeof requested.salonboardPassword === "string" && requested.salonboardPassword.length) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows chưa sẵn sàng mã hóa mật khẩu.");
    requested.salonboardPasswordEncrypted = safeStorage.encryptString(requested.salonboardPassword).toString("base64");
  }
  delete requested.salonboardPassword;
  if (requested.clearSalonboardPassword) requested.salonboardPasswordEncrypted = "";
  delete requested.clearSalonboardPassword;
  const autoStartBot = Object.hasOwn(requested, "autoStartBot") ? Boolean(requested.autoStartBot) : Object.hasOwn(existing, "autoStartBot") ? Boolean(existing.autoStartBot) : true;
  const config = { ...DEFAULT_CONFIG, ...existing, ...requested, autoStartBot, startWorkersOnLaunch: autoStartBot, startWithWindows: autoStartBot };
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2), "utf8");
  applyStartupSettings(config);
  return config;
}

async function fetchAutomationConfig() {
  const config = readConfig();
  const base = String(config.mainaillUrl || "").replace(/\/$/, "");
  if (!base || !config.bookingSyncSecret) throw new Error("Thiếu địa chỉ Mainaill hoặc Booking sync secret");
  const response = await fetch(`${base}/api/automation-config`, { headers: { authorization: `Bearer ${config.bookingSyncSecret}` }, cache: "no-store" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || `Mainaill trả về HTTP ${response.status}`);
  const next = saveConfig({ ...config, nailieStaffMapping: result.workerMapping?.nailie || {}, salonboardStaffRules: result.workerMapping?.salonboard || {}, mappingSnapshot: { fetchedAt: result.fetchedAt, salonAccounts: result.salonAccounts || {}, mappings: result.mappings || [] } });
  return { config: next, snapshot: next.mappingSnapshot };
}

function scriptPath(name) {
  return path.join(app.getAppPath(), "automation", `${name}-worker.mjs`);
}

function randomPollMs(config) {
  const min = Math.max(30, Number(config.pollMinSeconds) || 45);
  const max = Math.max(min, Number(config.pollMaxSeconds) || 90);
  return Math.round((min + Math.random() * (max - min)) * 1000);
}

function workerEnvironment(name, config) {
  const bundledBrowsers = app.isPackaged ? path.join(process.resourcesPath, "playwright-browsers") : path.join(app.getAppPath(), "vendor", "playwright-browsers");
  const common = { ...process.env, ELECTRON_RUN_AS_NODE: "1", PLAYWRIGHT_BROWSERS_PATH: bundledBrowsers, MAINAILL_URL: config.mainaillUrl, BOOKING_SYNC_SECRET: config.bookingSyncSecret };
  if (name === "nailie") return {
    ...common,
    NAILIE_PROFILE_DIR: path.join(dataRoot(), "profiles", "nailie"),
    NAILIE_LOG: path.join(dataRoot(), "logs", "nailie-worker.log"),
    NAILIE_STATE_FILE: path.join(dataRoot(), "nailie-managed-slots.json"),
    NAILIE_OBSERVATION_FILE: path.join(dataRoot(), "nailie-observed-bookings.json"),
    NAILIE_DRY_RUN: String(config.nailieDryRun !== false),
    NAILIE_POLL_MS: String(randomPollMs(config)),
    NAILIE_STAFF_MAPPING: JSON.stringify(config.nailieStaffMapping || {}),
  };
  return {
    ...common,
    SALONBOARD_USERNAME: config.salonboardUsername || process.env.SALONBOARD_USERNAME || "",
    SALONBOARD_PASSWORD: config.salonboardPasswordEncrypted ? safeStorage.decryptString(Buffer.from(config.salonboardPasswordEncrypted, "base64")) : process.env.SALONBOARD_PASSWORD || "",
    SALONBOARD_PROFILE_DIR: path.join(dataRoot(), "profiles", "salonboard-v2"),
    SALONBOARD_LOG: path.join(dataRoot(), "logs", "salonboard-worker.log"),
    SALONBOARD_OBSERVATION_FILE: path.join(dataRoot(), "salonboard-observed-bookings.json"),
    SALONBOARD_DRY_RUN: String(config.salonboardDryRun !== false),
    SALONBOARD_POLL_MS: String(randomPollMs(config)),
    SALONBOARD_STAFF_RULES: JSON.stringify(config.salonboardStaffRules || {}),
  };
}

function sendWorkerState() {
  mainWindow?.webContents.send("workers:state", Object.fromEntries(["nailie", "salonboard"].map((name) => [name, { running: Boolean(workers.get(name)), pid: workers.get(name)?.pid || null }])));
}

async function startWorker(name) {
  if (workers.has(name) || startingWorkers.has(name)) return;
  startingWorkers.add(name);
  try {
  await fetchAutomationConfig();
  const config = readConfig();
  const launcherLog = path.join(dataRoot(), "logs", `${name}-launcher.log`);
  const appendLauncherLog = (value) => {
    ensureDataFolders();
    fs.appendFileSync(launcherLog, `${new Date().toISOString()} ${String(value || "").trim()}\n`, "utf8");
  };
  const child = spawn(process.execPath, [scriptPath(name)], { env: workerEnvironment(name, config), stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
  workers.set(name, child);
  child.stderr?.on("data", (value) => appendLauncherLog(value));
  child.once("exit", (code, signal) => {
    workers.delete(name);
    if (code && code !== 0) {
      appendLauncherLog(`Worker exited with code ${code}${signal ? ` signal ${signal}` : ""}`);
      mainWindow?.webContents.send("mapping:error", `${name === "salonboard" ? "SALON BOARD / HOT PEPPER" : "Nailie"} dừng với mã lỗi ${code}. Hãy mở thư mục log để xem ${name}-launcher.log.`);
    }
    sendWorkerState();
  });
  child.once("error", (error) => {
    workers.delete(name);
    appendLauncherLog(error?.stack || error?.message || error);
    mainWindow?.webContents.send("mapping:error", `Không thể mở ${name}: ${error.message}`);
    sendWorkerState();
  });
  sendWorkerState();
  } finally {
    startingWorkers.delete(name);
  }
}

function stopWorker(name) {
  const child = workers.get(name);
  if (!child) return;
  child.kill();
  workers.delete(name);
  sendWorkerState();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: 860,
    minHeight: 640,
    title: "Mainaill Bot Manager",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false },
  });
  mainWindow.loadFile(path.join(__dirname, "setup.html"));
  mainWindow.on("closed", () => { mainWindow = null; });
}

function publicConfig(config) {
  const { salonboardPasswordEncrypted, salonboardPassword, ...visible } = config;
  return { ...visible, hasSalonboardPassword: Boolean(salonboardPasswordEncrypted) };
}
ipcMain.handle("config:get", () => publicConfig(readConfig()));
ipcMain.handle("app:version", () => app.getVersion());
ipcMain.handle("config:save", (_event, value) => publicConfig(saveConfig(value)));
ipcMain.handle("mapping:refresh", async () => { const result = await fetchAutomationConfig(); return { ...result, config: publicConfig(result.config) }; });
ipcMain.handle("workers:get", () => Object.fromEntries(["nailie", "salonboard"].map((name) => [name, { running: Boolean(workers.get(name)), pid: workers.get(name)?.pid || null }])));
ipcMain.handle("workers:start", async (_event, name) => { await startWorker(name); return true; });
ipcMain.handle("workers:stop", (_event, name) => { stopWorker(name); return true; });
ipcMain.handle("mainaill:open", () => shell.openExternal(readConfig().mainaillUrl));
ipcMain.handle("logs:open", () => shell.openPath(path.join(dataRoot(), "logs")));

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) return;
  ensureDataFolders();
  createWindow();
  const config = readConfig();
  applyStartupSettings(config);
  if (config.autoStartBot) {
    startWorker("salonboard").catch((error) => mainWindow?.webContents.send("mapping:error", error.message));
    startWorker("nailie").catch((error) => mainWindow?.webContents.send("mapping:error", error.message));
  }
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("before-quit", () => { for (const name of [...workers.keys()]) stopWorker(name); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

