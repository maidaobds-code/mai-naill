import assert from "node:assert/strict";
import fs from "node:fs";

const component = fs.readFileSync("components/CalendarResourceTimeline.js", "utf8");
const css = fs.readFileSync("app/globals.css", "utf8");
assert.match(component, /view === "month" \? addMonths\(current, amount\) : addDays\(current, amount \* \(view === "week" \? 7 : 1\)\)/);
assert.match(component, /className="calendarPeriodNav"/);
assert.match(component, /className="calendarAddButton"/);
assert.match(component, /className="monthBookingPreview"/);
assert.match(css, /calendarSummary\{display:none!important\}/);
assert.match(css, /monthGrid\{grid-template-columns:repeat\(7,minmax\(0,1fr\)\)!important/);
assert.match(css, /weekGrid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
console.log("PASS mobile summary cards are hidden");
console.log("PASS week navigation moves by 7 days and month navigation moves by month");
console.log("PASS week/month cells include add buttons and appointment lists");
console.log("PASS mobile month remains a 7-column calendar grid");
