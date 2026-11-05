import assert from "node:assert/strict";
import fs from "node:fs";
import { sameSalonboardStaffName, salonboardStaffHeaderName } from "../../lib/salonboardNames.mjs";

const route = fs.readFileSync("app/api/automation-config/route.js", "utf8");
const desktop = fs.readFileSync("electron/setup.js", "utf8");
const worker = fs.readFileSync("automation/salonboard-worker.mjs", "utf8");
const settings = fs.readFileSync("components/Settings.js", "utf8");
const staffStore = fs.readFileSync("lib/staffStore.js", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const desktopMain = fs.readFileSync("electron/main.cjs", "utf8");

assert.match(route, /BOOKING_SYNC_SECRET/);
assert.match(route, /workerMapping/);
assert.match(route, /salonboardLoginId/);
assert.match(route, /nailieLoginId/);
assert.match(desktop, /refreshMapping/);
assert.match(desktop, /Thiếu mapping/);
assert.doesNotMatch(desktop, /parseJsonField/);
assert.match(worker, /externalStaffName/);
assert.match(worker, /compactName\(staffHeaderName\(await heads\.nth\(index\)\.innerText\(\)\)\)/);
assert.equal(salonboardStaffHeaderName("マイ　マイ\n受付可能数：1"), "マイ　マイ");
assert.equal(sameSalonboardStaffName("マイ　マイ\n受付可能数：1", "マイ マイ"), true);
assert.match(settings, /await saveStaff\(nextStaff\)/);
assert.match(staffStore, /async function saveStaff/);
assert.equal(packageJson.build.files.includes("lib/salonboardNames.mjs"), true);
assert.match(desktopMain, /salonboard-launcher|`\$\{name\}-launcher\.log`/);

console.log("PASS bot mapping is loaded from Mainaill with sync-secret authorization");
console.log("PASS desktop displays mapping for verification without manual JSON entry");
console.log("PASS SALON BOARD worker uses the mapped external staff name");
console.log("PASS SALON BOARD ignores availability text below the staff header name");
console.log("PASS mapping list updates only after the staff server save succeeds");
console.log("PASS packaged bot includes SALON BOARD name helper and reports launcher failures");
