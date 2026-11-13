import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createScheduleScanPlanner } from '../../automation/worker-utils.mjs';
const start = Date.parse('2026-11-13T00:00:00+09:00');
const planner = createScheduleScanPlanner({ now: start });
const seen = new Set();
let lastDistant = start;
let distantCount = 0;
for (let minute = 0; minute <= 12 * 60; minute++) {
  const now = start + minute * 60_000;
  const plan = planner.next(now);
  assert.ok(plan.offset >= 0 && plan.offset < 93);
  seen.add(plan.offset);
  if (plan.kind === 'distant') {
    assert.ok(now - lastDistant >= 600_000, 'distant dates must be spaced by at least 10 minutes');
    lastDistant = now;
    distantCount++;
  }
  planner.complete(plan, now);
}
assert.equal(seen.size, 93, 'all dates must be covered by interleaving without an end-of-day burst');
assert.equal(distantCount, 72);
const retry = createScheduleScanPlanner({ now: start });
const failed = retry.next(start);
assert.deepEqual(retry.next(start + 60_000), failed, 'failed scans must not advance');
retry.complete(failed, start);
assert.equal(retry.next(start).offset, 1);
const afterSleep = retry.next(start + 20 * 3_600_000);
assert.equal(afterSleep.kind, 'distant');
retry.complete(afterSleep, start + 20 * 3_600_000);
assert.equal(retry.next(start + 20 * 3_600_000).kind, 'near', 'resume must not catch up missed intervals in a burst');
const midnight = createScheduleScanPlanner({ now: Date.parse('2026-11-13T15:01:00Z') });
assert.equal(midnight.next(Date.parse('2026-11-13T15:01:00Z')).date, '2026-11-14', 'dates must use Japan timezone');
const short = createScheduleScanPlanner({ nearDays: 2, horizonDays: 2, now: start });
for (let i = 0; i < 5; i++) {
  const plan = short.next(start + i * 600_000);
  assert.equal(plan.kind, 'near');
  assert.equal(plan.offset, i % 2);
  short.complete(plan, start + i * 600_000);
}
const source = fs.readFileSync('automation/salonboard-worker.mjs', 'utf8');
assert.ok(source.indexOf('const tasks = await fetchSyncTasks()') < source.indexOf('const scanPlan = scanPlanner.next()'), 'booking sync tasks must run before background scans');
assert.doesNotMatch(source, /fullSweepDue|lastFullSweepDate|END_OF_DAY/);
console.log('PASS distributed coverage of all 93 dates, spacing, retries, no wake-up burst, Japan midnight, and sync-task priority');
