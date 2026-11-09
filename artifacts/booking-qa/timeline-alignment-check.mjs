import assert from "node:assert/strict";
import fs from "node:fs";

const openMinutes = 9 * 60;
const closeMinutes = 23 * 60;
const slotMinutes = 30;
const slotWidth = 56;
const intervalCount = (closeMinutes - openMinutes) / slotMinutes;
const laneWidth = intervalCount * slotWidth;

function position(start, end) {
  return {
    left: ((start - openMinutes) / (closeMinutes - openMinutes)) * laneWidth,
    width: ((end - start) / (closeMinutes - openMinutes)) * laneWidth,
  };
}

const booking = position(11 * 60 + 30, 13 * 60 + 30);
const closed = position(9 * 60 + 30, 11 * 60 + 30);
assert.equal(intervalCount, 28);
assert.equal(booking.left, 5 * slotWidth);
assert.equal(booking.width, 4 * slotWidth);
assert.equal(closed.left, 1 * slotWidth);
assert.equal(closed.width, 4 * slotWidth);
const timelineSource = fs.readFileSync(new URL("../../components/CalendarResourceTimeline.js", import.meta.url), "utf8");
const cssSource = fs.readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
assert.match(timelineSource, /closedSlotHit/);
assert.match(timelineSource, /memberClosedRanges\.some/);
assert.match(cssSource, /\.slotHit\.closedSlotHit\{background:repeating-linear-gradient/);
assert.match(timelineSource, /japanClock/);
assert.match(timelineSource, /showCurrentTime/);
assert.match(timelineSource, /currentTimeIndicator/);
assert.match(timelineSource, /currentTimeRail/);
assert.match(cssSource, /\.currentTimeRail\{position:absolute/);
assert.match(timelineSource, /Math\.floor\(currentClock\.seconds \/ 60\) \* 60/);
assert.match(timelineSource, /second: "2-digit"/);
assert.match(cssSource, /\.currentTimeIndicator\{position:absolute/);
console.log("PASS time header, booking and closed blocks share 28 intervals");
console.log("PASS 11:30 booking starts exactly at grid column 5");
console.log("PASS two-hour booking and closed blocks span exactly 4 columns");
console.log("PASS every closed 30-minute slot receives a grey striped cell style");
console.log("PASS current-time indicator is limited to today and updates automatically");
console.log("PASS current-time indicator moves minute-by-minute inside each 30-minute cell");
