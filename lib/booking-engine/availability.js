export function overlaps(aStart, aEnd, bStart, bEnd) {
  return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);
}

export function isStaffAvailable(bookings, staffId, startAt, endAt, ignoreBookingId) {
  return !bookings.some((booking) => {
    if (booking.id === ignoreBookingId) return false;
    if (booking.staff_id !== staffId && booking.staff !== staffId) return false;
    if (["cancelled", "completed"].includes(String(booking.status).toLowerCase())) return false;
    return overlaps(startAt, endAt, booking.start_at || booking.start, booking.end_at || booking.end);
  });
}
