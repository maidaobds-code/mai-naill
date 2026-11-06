import assert from "node:assert/strict";
import fs from "node:fs";

const worker = fs.readFileSync("automation/salonboard-worker.mjs", "utf8");
const route = fs.readFileSync("app/api/external-closed-periods/route.js", "utf8");

assert.match(worker, /async function scanExternalClosedPeriods/);
assert.match(worker, /querySelectorAll\("\.scheduleToDoInner"\)/);
assert.match(worker, /Mainaill booking\\s\+\/i\.test\(text\)/, "Mainaill-managed blocks must not be imported back as HOT closures");
assert.match(worker, /\/api\/external-closed-periods/);
assert.match(worker, /await scanExternalClosedPeriods\(page, scanDate\)/);
assert.match(route, /request\.headers\.get\("authorization"\)/);
assert.match(route, /hotpepperClosedPeriods/);
assert.match(route, /previousForDate\.has\(value\)/, "A reopened HOT period must be removed from web settings");
assert.match(route, /staffClosedPeriods: nextClosed/);

console.log("HOT closed-period synchronization checks passed.");
