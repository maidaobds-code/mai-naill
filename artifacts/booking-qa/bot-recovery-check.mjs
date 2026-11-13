import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const worker = fs.readFileSync('automation/salonboard-worker.mjs', 'utf8');
const loginSource = worker.slice(worker.indexOf('async function tryAutoLogin('), worker.indexOf('function internalStaffName('));
let clicks = 0, fills = 0, captcha = false, loggedIn = false;
const field = { count: async () => 1, fill: async () => { fills++; }, boundingBox: async () => ({ x: 0, y: 0, width: 10, height: 10 }) };
const login = vm.createContext({
  loginUsername: 'test-id', loginPassword: 'test-password',
  isLoginPage: () => !loggedIn, isSessionExpired: async () => false, log: () => {},
  page: { locator: () => ({ first: () => field, count: async () => captcha ? 1 : 0 }), mouse: { click: async () => { clicks++; } }, waitForURL: async () => {} },
});
vm.runInContext(`let autoLoginAttempts = 0; ${loginSource}`, login);
for (let i = 0; i < 3; i++) await vm.runInContext('tryAutoLogin(page)', login);
assert.equal(clicks, 2, 'failed login must stop after two submissions');
vm.runInContext('autoLoginAttempts = 0', login);
captcha = true;
await vm.runInContext('tryAutoLogin(page)', login);
assert.equal(clicks, 2, 'CAPTCHA must require manual login');
captcha = false;
loggedIn = true;
await vm.runInContext('tryAutoLogin(page)', login);
assert.equal(clicks, 2, 'authenticated page must never submit credentials');

const desktop = fs.readFileSync('electron/main.cjs', 'utf8');
const saveSource = desktop.slice(desktop.indexOf('function saveConfig('), desktop.indexOf('async function fetchAutomationConfig('));
const publicSource = desktop.slice(desktop.indexOf('function publicConfig('), desktop.indexOf('ipcMain.handle("config:get"'));
let stored = {}, encrypted = false;
const config = vm.createContext({
  Buffer, DEFAULT_CONFIG: {}, ensureDataFolders: () => {}, configPath: () => 'test-config', applyStartupSettings: () => {},
  fs: { readFileSync: () => JSON.stringify(stored), writeFileSync: (_, text) => { stored = JSON.parse(text); } },
  safeStorage: { isEncryptionAvailable: () => true, encryptString: () => { encrypted = true; return Buffer.from('encrypted-test-value'); } },
});
vm.runInContext(saveSource + publicSource, config);
vm.runInContext('saveConfig({ salonboardUsername: "test-id", salonboardPassword: "test-password" })', config);
assert.equal(encrypted, true);
assert.equal(stored.salonboardPassword, undefined);
assert.ok(stored.salonboardPasswordEncrypted);
const original = stored.salonboardPasswordEncrypted;
vm.runInContext('saveConfig({ salonboardPassword: "" })', config);
assert.equal(stored.salonboardPasswordEncrypted, original, 'blank password must preserve saved credentials');
config.value = stored;
const visible = vm.runInContext('publicConfig(value)', config);
assert.equal(visible.salonboardPasswordEncrypted, undefined);
assert.equal(visible.hasSalonboardPassword, true);
vm.runInContext('saveConfig({ clearSalonboardPassword: true })', config);
assert.equal(stored.salonboardPasswordEncrypted, '');
console.log('PASS login retry limit, CAPTCHA handoff, encrypted storage, password preservation/removal, and renderer redaction');
