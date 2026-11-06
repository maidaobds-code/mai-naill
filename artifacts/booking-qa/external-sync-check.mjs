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
assert.equal(nailie.result.providerSync.hotpepper.status, "waiting_assignment");
assert.equal(nailie.result.assignmentStatus, "PENDING_ASSIGNMENT");
assert.equal(nailie.result.staff, "");
assert.deepEqual(nailie.tasks, []);
assert.equal(bookingSlotKey(nailie.result), "2026-11-03|10:00|11:00|");

const unchanged = ingestExternalBooking(nailie.bookings, {
  provider: "nailie",
  externalBookingId: "NL-100",
  booking: { date: "2026-11-03", start: "10:00", end: "11:00", staffId: "staff-mai", staff: "Mai", customer: "Nailie customer" },
});
assert.deepEqual(unchanged.tasks, []);
const ownerDeleted = ingestExternalBooking([{ ...nailie.result, deletedAt: "2026-11-06T00:00:00.000Z", deletedByOwner: true, status: "CANCELLED" }], {
  provider: "nailie",
  externalBookingId: "NL-100",
  booking: { date: "2026-11-03", start: "10:00", end: "11:00" },
});
assert.equal(ownerDeleted.ignoredOwnerDeletion, true);
assert.equal(ownerDeleted.bookings[0].deletedByOwner, true);
const legacyDeleted = ingestExternalBooking([{ ...nailie.result, deletedAt: "2026-11-06T00:00:00.000Z", deletedByOwner: false, status: "CANCELLED" }], { provider: "nailie", externalBookingId: "NL-100", booking: { date: "2026-11-03", start: "10:00", end: "11:00" } });
assert.equal(legacyDeleted.ignoredOwnerDeletion, true);

const duplicate = ingestExternalBooking(nailie.bookings, {
  provider: "nailie",
  externalBookingId: "NL-100",
  booking: { date: "2026-11-03", start: "10:30", end: "11:30", staffId: "staff-mai", staff: "Mai" },
});
assert.equal(duplicate.bookings.length, 1);
assert.deepEqual(duplicate.tasks, []);

const hotExisting = ingestExternalBooking([], {
  provider: "hotpepper",
  externalBookingId: "HP-100",
  booking: { date: "2026-11-03", start: "10:00", end: "11:00", staffId: "staff-mai", staff: "Mai" },
});
const conflict = ingestExternalBooking(hotExisting.bookings, {
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

const queued = [{ ...acknowledged.result, pendingSyncActions: [{ target: "hotpepper", action: "cancel" }, { target: "nailie", action: "cancel" }] }];
const cleared = acknowledgeProviderSync(queued, { provider: "hotpepper", bookingId: acknowledged.result.id, status: "synced" });
assert.deepEqual(cleared.result.pendingSyncActions, [{ target: "nailie", action: "cancel" }]);

const capacityQueue = [{ ...acknowledged.result, pendingSyncActions: [{ target: "nailie", action: "capacity_unblock", taskId: "old" }, { target: "nailie", action: "capacity_block", taskId: "new" }] }];
const oneCapacityAck = acknowledgeProviderSync(capacityQueue, { provider: "nailie", bookingId: acknowledged.result.id, taskId: "old", status: "synced" });
assert.deepEqual(oneCapacityAck.result.pendingSyncActions, [{ target: "nailie", action: "capacity_block", taskId: "new" }]);
const retryAfterError = acknowledgeProviderSync(capacityQueue, { provider: "nailie", bookingId: acknowledged.result.id, taskId: "old", status: "error", error: "temporary selector failure" });
assert.equal(retryAfterError.result.pendingSyncActions[0].attempts, 1);
const retry2 = acknowledgeProviderSync(retryAfterError.bookings, { provider: "nailie", bookingId: acknowledged.result.id, taskId: "old", status: "error", error: "temporary selector failure" });
const retry3 = acknowledgeProviderSync(retry2.bookings, { provider: "nailie", bookingId: acknowledged.result.id, taskId: "old", status: "error", error: "temporary selector failure" });
const retry4 = acknowledgeProviderSync(retry3.bookings, { provider: "nailie", bookingId: acknowledged.result.id, taskId: "old", status: "error", error: "temporary selector failure" });
assert.equal(retry4.retryExhausted, true);
assert.equal(retry4.result.providerSync.nailie.status, "manual_required");
assert.deepEqual(retry4.result.pendingSyncActions, [{ target: "nailie", action: "capacity_block", taskId: "new" }]);

const cancelled = ingestExternalBooking(acknowledged.bookings, { provider: "nailie", externalBookingId: "NL-100", action: "cancel" });
assert.equal(cancelled.result.status, "CANCELLED");
assert.equal(cancelled.result.providerSync.hotpepper.status, "pending");
assert.deepEqual(cancelled.tasks, []);
const assignedNailie = acknowledged.bookings.map((booking) => ({ ...booking, assignmentStatus: "ASSIGNED", staff: "Mai", staffId: "staff-mai" }));
const rescannedAssigned = ingestExternalBooking(assignedNailie, { provider: "nailie", externalBookingId: "NL-100", booking: { date: "2026-11-03", start: "10:00", end: "11:00", customer: "Nailie customer" } });
assert.equal(rescannedAssigned.result.assignmentStatus, "ASSIGNED");
assert.equal(rescannedAssigned.result.staffId, "staff-mai");
const movedAssigned = ingestExternalBooking(assignedNailie, { provider: "nailie", externalBookingId: "NL-100", booking: { date: "2026-11-03", start: "11:00", end: "12:00", customer: "Nailie customer" } });
assert.equal(movedAssigned.result.assignmentStatus, "PENDING_ASSIGNMENT");
assert.equal(movedAssigned.tasks[0].target, "hotpepper");
assert.equal(movedAssigned.tasks[0].match.start, "10:00");
const cancelledAssigned = ingestExternalBooking(assignedNailie, { provider: "nailie", externalBookingId: "NL-100", action: "cancel" });
assert.equal(cancelledAssigned.tasks[0].target, "hotpepper");
assert.equal(cancelledAssigned.tasks[0].action, "cancel");

const syncRouteSource = fs.readFileSync(new URL("../../app/api/booking-sync/route.js", import.meta.url), "utf8");
assert.match(syncRouteSource, /managementEmails\(\)/);
assert.match(syncRouteSource, /createBookingAssignmentToken\(booking\.id\)/);
assert.match(syncRouteSource, /Chưa đóng lịch trên nền tảng nào/);
assert.match(syncRouteSource, /pendingSyncActions/);
assert.match(syncRouteSource, /!outcome\.ignoredOwnerDeletion/);
assert.match(syncRouteSource, /createBookingCancellationToken/);
assert.match(syncRouteSource, /assignment-cancel/);
const bookingsRouteSource = fs.readFileSync(new URL("../../app/api/bookings/route.js", import.meta.url), "utf8");
assert.match(bookingsRouteSource, /deletedByOwner: true/);
assert.match(syncRouteSource, /Bot dừng tác vụ .* sau 4 lần lỗi/);
assert.match(syncRouteSource, /notifyManualSyncRequired/);

const nailieWorkerSource = fs.readFileSync(new URL("../../automation/nailie-worker.mjs", import.meta.url), "utf8");
const salonboardWorkerSource = fs.readFileSync(new URL("../../automation/salonboard-worker.mjs", import.meta.url), "utf8");
const cancellationRouteSource = fs.readFileSync(new URL("../../app/api/booking-cancellation/route.js", import.meta.url), "utf8");
const calendarSource = fs.readFileSync(new URL("../../components/CalendarResourceTimeline.js", import.meta.url), "utf8");
assert.match(nailieWorkerSource, /"cancel", "unblock"/);
assert.match(nailieWorkerSource, /Nailie external bookings scanned/);
assert.match(salonboardWorkerSource, /reopenManagedSlot/);
assert.match(salonboardWorkerSource, /SALON BOARD external bookings scanned/);
assert.match(salonboardWorkerSource, /memoField\.first\(\)\.inputValue/);
assert.match(syncRouteSource, /providerSync\?\.hotpepper\?\.status === "error"/);
assert.match(cancellationRouteSource, /pendingSyncActions/);
assert.match(cancellationRouteSource, /action: "cancel"/);
assert.match(calendarSource, /HOT · chưa mapping/);
assert.match(calendarSource, /calendarStaff\.map/);

console.log("PASS Nailie booking becomes an unassigned Mainaill hold");
console.log("PASS duplicate external events update instead of creating a loop");
console.log("PASS unchanged external events do not create another sync loop");
console.log("PASS overlapping external bookings require manual resolution");
console.log("PASS provider acknowledgements produce per-platform synced status");
console.log("PASS provider acknowledgement removes only its completed sync action");
console.log("PASS multiple Nailie capacity tasks are acknowledged independently");
console.log("PASS failed sync tasks retry three times then stop and notify management");
console.log("PASS cancellation is propagated to the other platform");
console.log("PASS conflict Gmail contains separate reassignment links and does not close either platform");
console.log("PASS workers support external ingestion and exact-slot reopening");
console.log("PASS customer cancellation also queues managed-slot reopening");
console.log("PASS Nailie rescans preserve assignment and moved bookings release the old HOT slot");
console.log("PASS unmapped HOT bookings remain visible on dedicated calendar rows");

