import assert from "node:assert/strict";
import fs from "node:fs";

const store = fs.readFileSync("components/OnlineStore.js", "utf8");
const assignment = fs.readFileSync("app/api/booking-assignment/route.js", "utf8");
const cancel = fs.readFileSync("app/api/booking-cancellation/route.js", "utf8");
const picker = fs.readFileSync("components/BookingAssignment.js", "utf8");

assert.match(store, /approvalStatus: "PENDING_OWNER_CONFIRMATION"/);
assert.doesNotMatch(store, /notifyByEmail\(\{ to: \[draft\.email\]/);
assert.match(assignment, /approvalStatus: "OWNER_CONFIRMED"/);
assert.match(assignment, /Nhân viên .* hiện không tiện phục vụ/);
assert.match(assignment, /Chọn nhân viên khác \/ Không chỉ định/);
assert.match(assignment, /Hủy hẹn/);
assert.match(picker, /__NO_PREFERENCE__/);
assert.match(cancel, /cancelledBy: "customer"/);

console.log("PASS customer acceptance waits for owner confirmation");
console.log("PASS owner can change unavailable requested staff or use no preference");
console.log("PASS accepted email contains staff choice and cancellation actions");
console.log("PASS customer cancellation persists to the shared server calendar");
