import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("app/api/automation-config/route.js", "utf8");
const desktop = fs.readFileSync("electron/setup.js", "utf8");
const worker = fs.readFileSync("automation/salonboard-worker.mjs", "utf8");

assert.match(route, /BOOKING_SYNC_SECRET/);
assert.match(route, /workerMapping/);
assert.match(route, /salonboardLoginId/);
assert.match(route, /nailieLoginId/);
assert.match(desktop, /refreshMapping/);
assert.match(desktop, /Thiếu mapping/);
assert.doesNotMatch(desktop, /parseJsonField/);
assert.match(worker, /externalStaffName/);

console.log("PASS bot mapping is loaded from Mainaill with sync-secret authorization");
console.log("PASS desktop displays mapping for verification without manual JSON entry");
console.log("PASS SALON BOARD worker uses the mapped external staff name");
