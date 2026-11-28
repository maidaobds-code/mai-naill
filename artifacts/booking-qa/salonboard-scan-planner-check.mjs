import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createTieredScanPlanner } from '../../automation/worker-utils.mjs';

const start = Date.parse('2026-11-13T00:00:00+09:00');
const planner = createTieredScanPlanner({ now: start });
const times = new Map();
for (let step = 0; step < 48 * 60 * 2; step++) {
  const now = start + step * 30_000;
  const plan = planner.next(now);
  if (!plan) continue;
  if (!times.has(plan.offset)) times.set(plan.offset, []);
  times.get(plan.offset).push(now);
  planner.complete(plan, now);
}
assert.equal(times.size, 31, 'every date in the month must be scanned');
for (let offset = 0; offset < 31; offset++) {
  const observed = times.get(offset);
  assert.ok(observed.length >= (offset === 0 ? 400 : offset <= 7 ? 130 : 1), `date offset ${offset} was scanned too rarely`);
  const expected = offset === 0 ? 3 * 60_000 : offset <= 7 ? 10 * 60_000 : 24 * 60 * 60_000;
  for (let index = 1; index < observed.length; index++) assert.ok(observed[index] - observed[index - 1] >= expected);
}
const retry = createTieredScanPlanner({ now: start });
assert.deepEqual(retry.next(start), retry.next(start + 30_000), 'failed scans must remain due');
const midnight = createTieredScanPlanner({ now: Date.parse('2026-11-13T15:01:00Z') });
assert.equal(midnight.next(Date.parse('2026-11-13T15:01:00Z')).date, '2026-11-14');
const hot = fs.readFileSync('automation/salonboard-worker.mjs', 'utf8');
const nailie = fs.readFileSync('automation/nailie-worker.mjs', 'utf8');
assert.match(hot, /createTieredScanPlanner/);
assert.match(nailie, /createTieredScanPlanner/);
assert.match(nailie, /await waitBeforeOperation\(\);\s+const observation = await scanExternalBookings/);
console.log('PASS today every 3 minutes, week every 10 minutes, month distributed, Japan dates, spaced Nailie reads');
