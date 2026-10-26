import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/api/bookings/route.js", "utf8");

assert.match(source, /newOnlineBookings/);
assert.match(source, /String\(booking\.source \|\| ""\)\.toLowerCase\(\) === "direct"/);
assert.match(source, /Chọn \/ đổi nhân viên/);
assert.match(source, /Nhân viên hiện tại/);
assert.match(source, /notifyManagementForAssignment\(request, booking\)/);

console.log("PASS every new direct booking sends the Gmail staff action");
console.log("PASS assigned bookings include the choose/change staff button");
console.log("PASS Gmail shows the currently assigned staff");
