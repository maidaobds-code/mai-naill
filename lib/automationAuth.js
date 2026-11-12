export function isAutomationRequest(request) {
  const secret = process.env.BOOKING_SYNC_SECRET || process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}
