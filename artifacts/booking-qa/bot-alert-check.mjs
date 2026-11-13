import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const worker = fs.readFileSync("automation/salonboard-worker.mjs", "utf8");
const source = worker.slice(worker.indexOf("async function alertAdmin("), worker.indexOf("async function tryAutoLogin("));
let now = 1_000_000;
let calls = 0;
let response = { ok: false, status: 502, json: async () => ({ ok: false, result: { ok: false } }) };
const context = vm.createContext({
  Date: { now: () => now }, AbortSignal,
  fetch: async () => { calls++; return response; },
  log: () => {}, mainaillUrl: "https://example.test", syncSecret: "test",
});
vm.runInContext(`let loginAlertSent = false; let lastAlertAttemptAt = 0; ${source}`, context);
await vm.runInContext('alertAdmin("expired")', context);
assert.equal(vm.runInContext("loginAlertSent", context), false);
await vm.runInContext('alertAdmin("expired")', context);
assert.equal(calls, 1, "failed alerts must be rate limited");
now += 60_000;
response = { ok: true, status: 200, json: async () => ({ ok: true, result: { ok: false, reason: "mail unavailable" } }) };
await vm.runInContext('alertAdmin("expired")', context);
assert.equal(vm.runInContext("loginAlertSent", context), false, "legacy API success must not mask delivery failure");
now += 60_000;
response = { ok: true, status: 200, json: async () => ({ ok: true, result: { ok: true } }) };
await vm.runInContext('alertAdmin("expired")', context);
assert.equal(vm.runInContext("loginAlertSent", context), true);
await vm.runInContext('alertAdmin("expired")', context);
assert.equal(calls, 3, "accepted alerts must not be duplicated");

const route = fs.readFileSync("app/api/bot-alert/route.js", "utf8").replace(/^import .*;\r?\n/gm, "").replace(/export async function/g, "async function");
let mailResult = { ok: false, skipped: true, reason: "mail not configured" };
let recipients = ["admin@example.test"];
const api = vm.createContext({ Response, adminAlertEmails: () => recipients, isAutomationRequest: () => true, escapeHtml: (text) => text, sendEmail: async () => mailResult });
vm.runInContext(route, api);
api.request = { json: async () => ({ bot: "SALON BOARD", reason: "expired" }) };
let result = await vm.runInContext("POST(request)", api);
assert.equal(result.status, 502);
assert.equal((await result.json()).ok, false);
mailResult = { ok: true };
result = await vm.runInContext("POST(request)", api);
assert.equal(result.status, 200);
assert.equal((await result.json()).ok, true);
recipients = [];
result = await vm.runInContext("POST(request)", api);
assert.equal(result.status, 503);
console.log("PASS alert delivery failures retry, successful alerts deduplicate, and API failures return non-success status");

// Exercise the actual expired-session branch: it must pause and skip task scans.
const start = worker.indexOf('      if (await isSessionExpired(page)) {');
const end = worker.indexOf(' else if (isLoginPage(page)) {', start);
const expiredBranch = worker.slice(start, end);
let navigations = 0;
let pauses = 0;
let scans = 0;
const expired = vm.createContext({
  isSessionExpired: async () => true,
  alertAdmin: async () => {}, tryAutoLogin: async () => false, log: () => {},
  page: { goto: async () => { navigations++; } },
  loginUrl: 'https://example.test/login', pollMs: 60_000,
  setTimeout: (resolve) => { pauses++; resolve(); },
  scan: () => { scans++; },
});
await vm.runInContext(`(async () => { let sessionEstablished = true; for (let i = 0; i < 2; i++) { ${expiredBranch} scan(); } })()`, expired);
assert.equal(navigations, 2);
assert.equal(pauses, 2, 'expired sessions must wait between retries');
assert.equal(scans, 0, 'expired sessions must not scan or acknowledge tasks');
console.log('PASS expired sessions pause and skip task processing until authentication is rechecked');

const diagnosticEnv = { RESEND_API_KEY: 'test-key', RESEND_FROM: 'Salon <bot@example.test>' };
let authorized = false;
let lookups = 0;
const diagnostic = vm.createContext({
  Response, URL, AbortSignal, process: { env: diagnosticEnv },
  isAutomationRequest: () => authorized, adminAlertEmails: () => ['admin@example.test'],
  fetch: async () => { lookups++; return { ok: true, json: async () => ({ id: '01a1d310-7e04-7c55-b3cc-99663118a0f5', to: ['admin@example.test'], from: 'Salon <bot@example.test>', last_event: 'bounced', html: 'private message body' }) }; },
});
vm.runInContext(route, diagnostic);
diagnostic.request = { url: 'https://example.test/api/bot-alert?id=01a1d310-7e04-7c55-b3cc-99663118a0f5' };
result = await vm.runInContext('GET(request)', diagnostic);
assert.equal(result.status, 401);
assert.equal(lookups, 0);
authorized = true;
result = await vm.runInContext('GET(request)', diagnostic);
const status = await result.json();
assert.equal(status.email.lastEvent, 'bounced');
assert.equal(status.email.to[0], 'admin@example.test');
assert.equal(status.email.html, undefined);
assert.equal(JSON.stringify(status).includes('test-key'), false);
assert.equal(result.headers.get('cache-control'), 'no-store');
diagnostic.request = { url: 'https://example.test/api/bot-alert?id=invalid' };
result = await vm.runInContext('GET(request)', diagnostic);
assert.equal(result.status, 400);
assert.equal(lookups, 1);
diagnostic.request = { url: 'https://example.test/api/bot-alert' };
result = await vm.runInContext('GET(request)', diagnostic);
assert.equal((await result.json()).config.recipients[0], 'admin@example.test');
assert.equal(lookups, 1, 'config lookup must not send or retrieve any email');
console.log('PASS authenticated read-only delivery diagnostics redact credentials and message bodies');
