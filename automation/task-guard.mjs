/**
 * Wait for a browser task to actually settle.
 *
 * A warning timer is deliberately not a rejecting timeout: rejecting a
 * Promise.race does not cancel Playwright work. The browser operation would
 * otherwise keep changing the page while the queue starts the same task
 * again, producing overlapping retries and false permanent failures.
 */
export async function awaitTaskCompletion(promise, { taskId = "unknown", slowAfterMs = 90_000, onSlow = () => {} } = {}) {
  const timer = setTimeout(() => onSlow(`Task still running after ${slowAfterMs}ms: ${taskId}`), slowAfterMs);
  timer.unref?.();
  try {
    return await promise;
  } finally {
    clearTimeout(timer);
  }
}
