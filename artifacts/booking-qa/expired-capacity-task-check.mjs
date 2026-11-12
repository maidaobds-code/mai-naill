import assert from "node:assert/strict";
import { isExpiredCapacityTask, removeExpiredCapacityTasks } from "../../lib/syncTaskExpiry.js";

const now = Date.parse("2026-11-11T20:30:00+09:00");
const expired = { target: "nailie", action: "capacity_block", taskId: "expired", match: { date: "2026-11-11", start: "17:30", end: "20:00" } };
const future = { target: "nailie", action: "capacity_block", taskId: "future", match: { date: "2026-11-11", start: "20:30", end: "21:00" } };
const exactSlotOperation = { target: "nailie", action: "cancel", taskId: "cancel", match: { date: "2026-11-11", start: "17:30", end: "20:00" } };

assert.equal(isExpiredCapacityTask(expired, {}, now), true);
assert.equal(isExpiredCapacityTask(future, {}, now), false);
assert.equal(isExpiredCapacityTask(exactSlotOperation, {}, now), false, "only capacity maintenance is safe to expire automatically");

const booking = { id: "booking", date: "2026-11-11", start: "17:30", end: "20:00", pendingSyncActions: [expired, future, exactSlotOperation] };
const pruned = removeExpiredCapacityTasks([booking], now);
assert.equal(pruned.changed, true);
assert.deepEqual(pruned.value[0].pendingSyncActions.map((task) => task.taskId), ["future", "cancel"]);
assert.equal(pruned.value[0].botTaskHistory.at(-1).status, "skipped");
assert.equal(pruned.value[0].botTaskHistory.at(-1).error, "Khung giờ đã kết thúc");

console.log("PASS expired Nailie capacity tasks are removed before worker delivery");
console.log("PASS future capacity and exact-slot operations remain queued");
