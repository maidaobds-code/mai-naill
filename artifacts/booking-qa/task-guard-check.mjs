import assert from "node:assert/strict";
import { awaitTaskCompletion } from "../../automation/task-guard.mjs";

const warnings = [];
let finished = false;
const result = await awaitTaskCompletion(new Promise((resolve) => setTimeout(() => {
  finished = true;
  resolve("synced");
}, 40)), {
  taskId: "capacity-block-regression",
  slowAfterMs: 10,
  onSlow: (message) => warnings.push(message),
});

assert.equal(result, "synced");
assert.equal(finished, true, "the guard must wait for the browser operation to finish");
assert.deepEqual(warnings, ["Task still running after 10ms: capacity-block-regression"]);

const failure = new Error("Playwright selector failed");
await assert.rejects(
  awaitTaskCompletion(Promise.reject(failure), { slowAfterMs: 100 }),
  (error) => error === failure,
  "real browser failures must still reach the retry acknowledgement path",
);

console.log("PASS slow browser tasks finish without overlapping retries");
console.log("PASS real browser failures are still reported");
