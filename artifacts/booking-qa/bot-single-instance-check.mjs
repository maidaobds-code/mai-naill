import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const source = fs.readFileSync('electron/main.cjs', 'utf8');
let quits = 0, windows = 0, spawns = 0;
const events = {};
const app = { requestSingleInstanceLock: () => false, quit: () => { quits++; }, on: (name, fn) => { events[name] = fn; }, whenReady: () => Promise.resolve(), getPath: () => 'C:/test', getAppPath: () => 'C:/test', setLoginItemSettings: () => {} };
const child = { pid: 123, stderr: { on: () => {} }, once: () => {} };
const context = vm.createContext({
  require: name => ({ electron: { app, BrowserWindow: function(){ windows++; }, ipcMain: { handle: () => {} }, shell: {}, safeStorage: {} }, 'node:fs': { mkdirSync: () => {}, appendFileSync: () => {} }, 'node:path': path, 'node:child_process': { spawn: () => { spawns++; return child; } } })[name],
  process: { env: {}, execPath: 'test.exe' }, __dirname: 'C:/test', Buffer,
});
vm.runInContext(source, context);
await Promise.resolve();
assert.equal(quits, 1);
assert.equal(windows, 0, 'second manager must never create a window or start workers');
let release;
context.waitForConfig = new Promise(resolve => { release = resolve; });
vm.runInContext('fetchAutomationConfig = async () => { await waitForConfig; }; readConfig = () => ({}); workerEnvironment = () => ({});', context);
const first = vm.runInContext('startWorker("salonboard")', context);
await vm.runInContext('startWorker("salonboard")', context);
assert.equal(spawns, 0, 'duplicate start during config fetch must not spawn');
release();
await first;
assert.equal(spawns, 1);
await vm.runInContext('startWorker("salonboard")', context);
assert.equal(spawns, 1);
vm.runInContext('fetchAutomationConfig = async () => { throw Error("offline"); };', context);
await assert.rejects(vm.runInContext('startWorker("nailie")', context), /offline/);
vm.runInContext('fetchAutomationConfig = async () => {};', context);
await vm.runInContext('startWorker("nailie")', context);
assert.equal(spawns, 2, 'failed startup must release guard for a later retry');
console.log('PASS single-instance startup, concurrent worker-start deduplication, and retry after configuration failure');
