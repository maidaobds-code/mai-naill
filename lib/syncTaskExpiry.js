function slotEndTimestamp(task, booking) {
  const slot = task?.match || booking || {};
  const date = String(slot.date || "").trim();
  const end = String(slot.end || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(end)) return NaN;
  return Date.parse(`${date}T${end}:00+09:00`);
}

export function isExpiredCapacityTask(task, booking, now = Date.now()) {
  if (!['capacity_block', 'capacity_unblock'].includes(String(task?.action || ''))) return false;
  const end = slotEndTimestamp(task, booking);
  return Number.isFinite(end) && end <= Number(now);
}

export function removeExpiredCapacityTasks(bookings, now = Date.now()) {
  let changed = false;
  const updatedAt = new Date(now).toISOString();
  const value = (Array.isArray(bookings) ? bookings : []).map((booking) => {
    const pending = Array.isArray(booking?.pendingSyncActions) ? booking.pendingSyncActions : [];
    const expired = pending.filter((task) => isExpiredCapacityTask(task, booking, now));
    if (!expired.length) return booking;
    changed = true;
    const history = Array.isArray(booking.botTaskHistory) ? booking.botTaskHistory : [];
    return {
      ...booking,
      pendingSyncActions: pending.filter((task) => !expired.includes(task)),
      botTaskHistory: [...history, ...expired.map((task) => ({ ...task, status: 'skipped', error: 'Khung giờ đã kết thúc', updatedAt }))].slice(-100),
      updatedAt,
    };
  });
  return { changed, value };
}
