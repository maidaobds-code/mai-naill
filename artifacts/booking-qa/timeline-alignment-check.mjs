import assert from "node:assert/strict";

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
console.log("PASS time header, booking and closed blocks share 28 intervals");
console.log("PASS 11:30 booking starts exactly at grid column 5");
console.log("PASS two-hour booking and closed blocks span exactly 4 columns");
