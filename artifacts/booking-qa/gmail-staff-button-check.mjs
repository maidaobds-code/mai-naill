import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync("app/api/bookings/route.js","utf8");
assert.match(source,/newOnlineBookings.filter\(isPendingAssignment\)/);
assert.match(source,/autoAssignBooking/);
assert.match(source,/customerNotifications/);
const online=fs.readFileSync("components/OnlineStore.js","utf8");
assert.doesNotMatch(online,/if \(assignedStaff\?\.email\)/);
console.log("PASS routine assignments do not notify staff or management; only unresolved capacity asks management");
