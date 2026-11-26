export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function waitBeforeOperation(log = () => {}) {
  const delay = 1000 + Math.floor(Math.random() * 1001);
  log("waiting before operation", `${delay}ms`);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

export async function currentLoginCredentials(platform, fallback = {}) {
  const base = String(process.env.MAINAILL_URL || "").replace(/\/$/, "");
  const secret = process.env.BOOKING_SYNC_SECRET;
  if (!base || !secret) return fallback;
  try {
    const response = await fetch(`${base}/api/automation-config`, { headers: { authorization: `Bearer ${secret}` }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return fallback;
    const result = await response.json();
    const saved = result.credentials?.[platform];
    return saved?.username && saved?.password ? saved : fallback;
  } catch { return fallback; }
}


// Interleave nearby dates with one distant date every interval; never catch up
// missed intervals in a burst after sleep or a long-running sync task.
export function createScheduleScanPlanner({ nearDays = 31, horizonDays = 93, distantIntervalMs = 600_000, now = Date.now() } = {}) {
  nearDays = Math.max(1, Math.floor(Number(nearDays) || 31));
  horizonDays = Math.max(nearDays, Math.floor(Number(horizonDays) || 93));
  distantIntervalMs = Math.max(60_000, Number(distantIntervalMs) || 600_000);
  let nearOffset = 0;
  let distantOffset = nearDays;
  let lastDistantAt = now;
  return {
    next(at = Date.now()) {
      const distant = horizonDays > nearDays && at - lastDistantAt >= distantIntervalMs;
      const offset = distant ? distantOffset : nearOffset;
      const date = new Date(at + 9 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);
      return { date, offset, kind: distant ? "distant" : "near" };
    },
    complete(plan, at = Date.now()) {
      if (plan.kind === "distant") {
        distantOffset = plan.offset + 1 < horizonDays ? plan.offset + 1 : nearDays;
        lastDistantAt = at;
      } else {
        nearOffset = (plan.offset + 1) % nearDays;
      }
    },
  };
}
