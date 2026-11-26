import assert from "node:assert/strict";
import { isThankYouDue, thankYouMessage } from "../../lib/thankYouEmail.js";
import { currentLoginCredentials } from "../../automation/worker-utils.mjs";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.AUTOMATION_CREDENTIALS_KEY = "test-only-key-with-at-least-twenty-four-characters";
const { readBotCredentials, saveBotCredential, botCredentialStatus, botCredentialsForWorker } = await import("../../lib/serverBotCredentials.js");
let stored = {};
const originalFetch = globalThis.fetch;
globalThis.fetch = async (_url, options = {}) => {
  if (options.method === "POST") { stored = JSON.parse(options.body)[0].value; return { ok: true, json: async () => [] }; }
  return { ok: true, json: async () => [{ value: stored }] };
};
try {
  await saveBotCredential("nailie", "salon@example.com", "secret-password");
  assert.doesNotMatch(JSON.stringify(stored), /secret-password/);
  assert.deepEqual(botCredentialStatus(await readBotCredentials()).nailie, { username: "salon@example.com", hasPassword: true });
  assert.equal(botCredentialsForWorker(stored).nailie.password, "secret-password");
  await saveBotCredential("nailie", "salon@example.com", "new-password");
  assert.equal(botCredentialsForWorker(stored).nailie.password, "new-password");
} finally { globalThis.fetch = originalFetch; }

process.env.MAINAILL_URL = "https://mainaill.example";
process.env.BOOKING_SYNC_SECRET = "test-sync-secret";
globalThis.fetch = async () => ({ ok: true, json: async () => ({ credentials: { nailie: { username: "new-account", password: "new-password" } } }) });
try { assert.deepEqual(await currentLoginCredentials("nailie", { username: "old", password: "old" }), { username: "new-account", password: "new-password" }); }
finally { globalThis.fetch = originalFetch; }

const settings = { thankYouEmailEnabled: true, thankYouDelayHours: 24, salonName: "Mai Beauty Salon", thankYouSubjectJa: "ありがとう {customer}", thankYouBodyJa: "{service} {date} {time}" };
const booking = { id: "booking-1", email: "guest@example.com", customer: "Yuki", service: "Nail", date: "2026-11-27", start: "11:00", end: "12:00", language: "ja", bookedAt: "2026-11-26T00:00:00.000Z" };
const sale = { appointmentId: "booking-1", paymentStatus: "Paid", issuedAt: "2026-11-27T03:00:00.000Z" };
const due = Date.parse("2026-11-28T03:00:00.000Z");
assert.equal(isThankYouDue(booking, settings, null, due), false);
assert.equal(isThankYouDue(booking, settings, { ...sale, paymentStatus: "Partial" }, due), false);
assert.equal(isThankYouDue(booking, settings, { ...sale, voided: true }, due), false);
assert.equal(isThankYouDue(booking, settings, { ...sale, appointmentId: "other" }, due), false);
assert.equal(isThankYouDue(booking, settings, { ...sale, issuedAt: "2026-11-26T00:00:00.000Z" }, due), false);
assert.equal(isThankYouDue(booking, settings, sale, due - 1), false);
assert.equal(isThankYouDue(booking, settings, sale, due), true);
assert.equal(isThankYouDue({ ...booking, status: "cancelled" }, settings, sale, due), false);
assert.equal(isThankYouDue({ ...booking, thankYouSentAt: "2026-11-27T04:00:00Z" }, settings, sale, due), false);
assert.equal(thankYouMessage(booking, settings).subject, "ありがとう Yuki");
console.log("PASS encrypted bot credentials and payment-gated, localized one-time thank-you email");
