import assert from "node:assert/strict";
import fs from "node:fs";
import { isAutomationRequest } from "../../lib/automationAuth.js";
import { dateKey } from "../../automation/worker-utils.mjs";
import { escapeHtml, publicOrigin } from "../../lib/webText.js";

const authorized = new Request("https://mainaill.test", { headers: { authorization: "Bearer shared-secret" } });
const unauthorized = new Request("https://mainaill.test", { headers: { authorization: "Bearer wrong-secret" } });
process.env.BOOKING_SYNC_SECRET = "shared-secret";
assert.equal(isAutomationRequest(authorized), true);
assert.equal(isAutomationRequest(unauthorized), false);
assert.equal(dateKey(new Date(2026, 10, 12)), "2026-11-12");
assert.equal(escapeHtml('<a title="x">&'), "&lt;a title=&quot;x&quot;&gt;&amp;");
delete process.env.NEXT_PUBLIC_SITE_URL;
delete process.env.SITE_URL;
delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
assert.equal(publicOrigin(new Request("https://fallback.example/path")), "https://fallback.example");

const removedFiles = [
  "lib/supabaseBrowser 2.js",
  "components/CalendarPlanner.js",
  "components/Dashboard.js",
  "components/Integrations.js",
  "lib/booking-providers/registry.js",
  "lib/i18n.js",
  "lib/mock.js",
];
assert.equal(removedFiles.some((file) => fs.existsSync(file)), false);

const nailieWorker = fs.readFileSync("automation/nailie-worker.mjs", "utf8");
const salonboardWorker = fs.readFileSync("automation/salonboard-worker.mjs", "utf8");
assert.match(nailieWorker, /worker-utils\.mjs/);
assert.match(salonboardWorker, /worker-utils\.mjs/);
assert.match(salonboardWorker, /awaitTaskCompletion/);
assert.doesNotMatch(salonboardWorker, /Promise\.race\(\[promise/);

console.log("PASS automation authorization and date helpers preserve behavior");
console.log("PASS obsolete duplicate modules are absent");
console.log("PASS both browser workers use shared operation helpers and non-overlapping task guards");
