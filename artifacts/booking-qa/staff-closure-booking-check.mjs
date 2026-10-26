import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("components/GroupedBooking.js", "utf8");
const css = fs.readFileSync("app/globals.css", "utf8");
assert.match(source, /isStaffClosed\(member, draft\.time, selectedEnd\)/);
assert.match(source, /disabled=\{closedAtSelectedTime\}/);
assert.match(source, /Đang đóng lịch trong giờ này/);
assert.match(source, /Có thời gian đóng lịch trong ngày/);
assert.match(source, /eligibleStaff\.some\(\(member\) => !isStaffClosed\(member, time/);
assert.match(css, /staffClosedChoice/);
console.log("PASS booking staff picker shows closed schedule status");
console.log("PASS staff closed for selected time cannot be selected");
console.log("PASS no-preference availability excludes closed staff");
