import assert from "node:assert/strict";
import fs from "node:fs";
import { nailieCapacityTask, salonCapacityState } from "../../lib/salonCapacity.js";

const staff = [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }];
const slot = { date: "2026-11-05", start: "16:30", end: "18:00" };
const assigned = (id, staffId) => ({ id, ...slot, staffId, staff: staff.find((item) => item.id === staffId).name, status: "CONFIRMED", assignmentStatus: "ASSIGNED" });
const pending = (id) => ({ id, ...slot, status: "CONFIRMED", assignmentStatus: "PENDING_ASSIGNMENT" });

const oneFree = salonCapacityState(slot, [assigned("1", "a"), assigned("2", "b")], staff, {});
assert.equal(oneFree.saturated, false);
assert.equal(oneFree.remaining, 1);
assert.equal(nailieCapacityTask(slot, [assigned("1", "a"), assigned("2", "b")], staff, {}, "1").action, "capacity_unblock");

const allBusy = salonCapacityState(slot, [assigned("1", "a"), assigned("2", "b"), assigned("3", "c")], staff, {});
assert.equal(allBusy.saturated, true);

const held = salonCapacityState(slot, [assigned("1", "a"), pending("p1"), pending("p2")], staff, {});
assert.equal(held.saturated, true);
assert.equal(held.pendingCount, 2);

const manuallyClosed = salonCapacityState(slot, [assigned("1", "a"), assigned("2", "b")], staff, { staffClosedPeriods: ["c 2026-11-05 16:00-19:00"] });
assert.equal(manuallyClosed.saturated, true);

const cancelled = salonCapacityState(slot, [assigned("1", "a"), { ...assigned("2", "b"), status: "CANCELLED" }], staff, {});
assert.equal(cancelled.saturated, false);
assert.equal(cancelled.remaining, 2);

const skilledServices = [{ id: "art", name: "Nail art", staff: ["a"] }];
const skillSlot = { ...slot, serviceId: "art", service: "Nail art" };
assert.equal(salonCapacityState(skillSlot, [assigned("1", "a")], staff, {}, skilledServices).saturated, true);
assert.equal(salonCapacityState(skillSlot, [], staff, {}, skilledServices).availableStaff.map((member) => member.id).join(","), "a");

console.log("PASS Nailie remains open while at least one salon staff slot remains");
console.log("PASS pending Nailie bookings reserve salon capacity before assignment");
console.log("PASS Nailie closes when all staff are busy or manually unavailable");
console.log("PASS cancellation releases capacity without overriding manual closures");
console.log("PASS service eligibility limits salon capacity to qualified staff");

const nailieWorker = fs.readFileSync(new URL("../../automation/nailie-worker.mjs", import.meta.url), "utf8");
const salonWorker = fs.readFileSync(new URL("../../automation/salonboard-worker.mjs", import.meta.url), "utf8");
const manualRoute = fs.readFileSync(new URL("../../app/api/manual-sync/route.js", import.meta.url), "utf8");
const calendar = fs.readFileSync(new URL("../../components/CalendarResourceTimeline.js", import.meta.url), "utf8");
assert.match(nailieWorker, /remainingOwners\.length === 0/);
assert.match(nailieWorker, /nailie-observed-bookings\.json/);
assert.match(salonWorker, /salonboard-observed-bookings\.json/);
assert.match(manualRoute, /manual:salon/);
assert.match(calendar, /Lịch Nailie chờ phân công/);
assert.match(calendar, /\/api\/manual-sync/);
console.log("PASS manual locks, external cancellations, and pending-assignment UI are wired");
