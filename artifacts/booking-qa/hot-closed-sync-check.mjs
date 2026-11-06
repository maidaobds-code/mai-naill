import assert from "node:assert/strict";
import fs from "node:fs";

const worker = fs.readFileSync("automation/salonboard-worker.mjs", "utf8");
const route = fs.readFileSync("app/api/external-closed-periods/route.js", "utf8");

assert.match(worker, /async function scanExternalClosedPeriods/);
assert.match(worker, /querySelectorAll\("\.scheduleToDoInner"\)/);
assert.match(worker, /Mainaill booking\\s\+\/i\.test\(text\)/, "Mainaill-managed blocks must not be imported back as HOT closures");
assert.match(worker, /\/api\/external-closed-periods/);
assert.match(worker, /await scanExternalClosedPeriods\(page, scanDate\)/);
assert.match(worker, /SALONBOARD_SCAN_DAYS \|\| 93/);
assert.match(worker, /scanOffset = \(scanOffset \+ 1\) % scanDays/);
assert.match(worker, /exactExternalIndexes/, "Mainaill unlock must find an exact HOT-created closure");
assert.match(worker, /Multiple SALON BOARD closures match/, "Ambiguous HOT closures must never be deleted");
assert.match(worker, /SALON BOARD external closure verification failed/, "The HOT form time must be verified before deletion");
assert.match(worker, /selectTimeOption/, "The HOT form must wait for dynamically loaded end-time options");
assert.match(worker, /schEndHour[\s\S]*?option/, "The HOT end-time options must be checked before selecting");
assert.match(route, /request\.headers\.get\("authorization"\)/);
assert.match(route, /hotpepperClosedPeriods/);
assert.match(route, /previousForDate\.has\(value\)/, "A reopened HOT period must be removed from web settings");
assert.match(route, /staffClosedPeriods: nextClosed/);

console.log("HOT closed-period synchronization checks passed.");
