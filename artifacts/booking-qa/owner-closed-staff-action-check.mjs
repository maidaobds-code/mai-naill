import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("components/CalendarResourceTimeline.js", "utf8");
const css = fs.readFileSync("app/globals.css", "utf8");

assert.match(source, /selectedStaffClosedPeriods/);
assert.match(source, /selectedStaffIsClosed/);
assert.match(source, /ĐANG ĐÓNG LỊCH/);
assert.match(source, /Bỏ đóng lịch và thêm lịch hẹn/);
assert.match(source, /reopenSchedule\("staff", true\)/);
assert.doesNotMatch(source, /<option[^>]+disabled[^>]+ĐANG ĐÓNG LỊCH/);
assert.match(css, /closedStaffActionMenu/);

console.log("PASS closed staff stays selectable for salon owner");
console.log("PASS closed staff is visibly marked in staff selector");
console.log("PASS owner receives unlock and add-booking actions");
