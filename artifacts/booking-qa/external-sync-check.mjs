import assert from "node:assert/strict";
import fs from "node:fs";
import { acknowledgeProviderSync, bookingSlotKey, ingestExternalBooking } from "../../lib/bookingSync.js";

const nailie = ingestExternalBooking([], {
  provider: "nailie",
  externalBookingId: "NL-100",
  booking: { date: "2026-11-03", start: "10:00", end: "11:00", staffId: "staff-mai", staff: "Mai", customer: "Nailie customer" },
}, "2026-11-03T01:00:00.000Z");
assert.equal(nailie.bookings.length, 1);
assert.equal(nailie.result.source, "nailie");
assert.equal(nailie.result.providerSync.nailie.status, "synced");
assert.equal(nailie.result.providerSync.hotpepper.status, "pending");
assert.equal(nailie.tasks[0].target, "hotpepper");
assert.equal(bookingSlotKey(nailie.result), "2026-11-03|10:00|11:00|staff-mai");

const duplicate = ingestExternalBooking(nailie.bookings, {
  provider: "nailie",
  externalBookingId: "NL-100",
  booking: { date: "2026-11-03", start: "10:30", end: "11:30", staffId: "staff-mai", staff: "Mai" },
});
assert.equal(duplicate.bookings.length, 1);
assert.equal(duplicate.tasks[0].action, "update");

const conflict = ingestExternalBooking(nailie.bookings, {
  provider: "hotpepper",
  externalBookingId: "HP-200",
  booking: { date: "2026-11-03", start: "10:30", end: "11:30", staffId: "staff-mai", staff: "Mai" },
});
assert.equal(conflict.result.syncStatus, "manual_required");
assert.equal(conflict.tasks.length, 0);
assert.equal(conflict.bookings.length, 2);
assert.equal(conflict.conflicts.length, 2);
assert.equal(conflict.conflicts.every((booking) => booking.assignmentStatus === "PENDING_CONFLICT"), true);
assert.equal(conflict.conflicts.every((booking) => booking.conflictGroupId === conflict.result.conflictGroupId), true);

const acknowledged = acknowledgeProviderSync(nailie.bookings, { provider: "hotpepper", bookingId: nailie.result.id, status: "synced", externalBookingId: "HP-BLOCK-100" });
assert.equal(acknowledged.result.syncStatus, "synced");
assert.equal(acknowledged.result.providerSync.hotpepper.externalBookingId, "HP-BLOCK-100");

const cancelled = ingestExternalBooking(acknowledged.bookings, { provider: "nailie", externalBookingId: "NL-100", action: "cancel" });
assert.equal(cancelled.result.status, "CANCELLED");
assert.equal(cancelled.result.providerSync.hotpepper.status, "pending");
assert.equal(cancelled.tasks[0].action, "cancel");

const syncRouteSource = fs.readFileSync(new URL("../../app/api/booking-sync/route.js", import.meta.url), "utf8");
assert.match(syncRouteSource, /managementEmails\(\)/);
assert.match(syncRouteSource, /createBookingAssignmentToken\(booking\.id\)/);
assert.match(syncRouteSource, /Chưa đóng lịch trên nền tảng nào/);

console.log("PASS Nailie booking becomes the Mainaill canonical record");
console.log("PASS duplicate external events update instead of creating a loop");
console.log("PASS overlapping external bookings require manual resolution");
console.log("PASS provider acknowledgements produce per-platform synced status");
console.log("PASS cancellation is propagated to the other platform");
console.log("PASS conflict Gmail contains separate reassignment links and does not close either platform");

