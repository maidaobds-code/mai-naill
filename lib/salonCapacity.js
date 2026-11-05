function text(value) { return String(value ?? "").trim(); }
function minutes(value) { const [hour, minute] = text(value).split(":").map(Number); return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : -1; }
function overlaps(left, right) { return text(left?.date) === text(right?.date) && minutes(left?.start) < minutes(right?.end) && minutes(left?.end) > minutes(right?.start); }
function active(booking) { return booking && !booking.deletedAt && !["cancelled", "completed"].includes(text(booking.status).toLowerCase()); }
function memberMatches(member, booking) { return text(booking.staffId) ? text(booking.staffId) === text(member.id) : text(booking.staff).toLowerCase() === text(member.name).toLowerCase(); }

export function staffQualifiedForService(member, booking, services = []) {
  const wanted = text(booking?.serviceId || booking?.service).toLowerCase();
  if (!wanted) return true;
  const service = services.find((item) => text(item.id).toLowerCase() === wanted || [item.name, item.vi, item.ja, item.en, item.title].some((value) => text(value).toLowerCase() === wanted));
  const allowed = Array.isArray(service?.staff) ? service.staff : [];
  if (!service || !allowed.length) return true;
  return allowed.some((value) => {
    const candidate = value && typeof value === "object" ? value.id || value.name : value;
    return text(candidate).toLowerCase() === text(member.id).toLowerCase() || text(candidate).toLowerCase() === text(member.name).toLowerCase();
  });
}

function maximumMatching(holds, members, services) {
  const assignedMemberByHold = new Map();
  function assign(holdIndex, visited) {
    for (const member of members) {
      if (!staffQualifiedForService(member, holds[holdIndex], services) || visited.has(String(member.id))) continue;
      visited.add(String(member.id));
      const previousHold = [...assignedMemberByHold.entries()].find(([, memberId]) => memberId === String(member.id))?.[0];
      if (previousHold === undefined || assign(previousHold, visited)) { assignedMemberByHold.set(holdIndex, String(member.id)); return true; }
    }
    return false;
  }
  let matched = 0;
  for (let index = 0; index < holds.length; index += 1) if (assign(index, new Set())) matched += 1;
  return matched;
}

function periodOverlaps(raw, slot, memberId = null) {
  const pattern = memberId ? /^([^\s]+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/ : /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/;
  const match = text(raw).match(pattern);
  if (!match) return false;
  const offset = memberId ? 1 : 0;
  if (memberId && text(match[1]) !== text(memberId)) return false;
  return match[1 + offset] === slot.date && minutes(slot.start) < minutes(match[3 + offset]) && minutes(slot.end) > minutes(match[2 + offset]);
}

export function salonCapacityState(slot, bookings = [], staff = [], settings = {}, services = []) {
  const members = (Array.isArray(staff) ? staff : []).filter((member) => member && member.active !== false && member.status !== "inactive");
  const salonClosed = (settings.closedPeriods || []).some((period) => periodOverlaps(period, slot));
  const assigned = (Array.isArray(bookings) ? bookings : []).filter((booking) => active(booking) && booking.assignmentStatus !== "PENDING_ASSIGNMENT" && (booking.staffId || booking.staff) && overlaps(booking, slot));
  const pending = (Array.isArray(bookings) ? bookings : []).filter((booking) => active(booking) && booking.assignmentStatus === "PENDING_ASSIGNMENT" && overlaps(booking, slot));
  const available = salonClosed ? [] : members.filter((member) => {
    const manuallyClosed = (settings.staffClosedPeriods || []).some((period) => periodOverlaps(period, slot, member.id));
    const busy = assigned.some((booking) => memberMatches(member, booking));
    return !manuallyClosed && !busy;
  });
  const matchedHolds = maximumMatching(pending, available, services);
  const hypothetical = { ...slot, service: slot.service || "", serviceId: slot.serviceId || "", assignmentStatus: "PENDING_ASSIGNMENT" };
  const canAcceptAdditional = maximumMatching([...pending, hypothetical], available, services) === pending.length + 1;
  const remaining = Math.max(0, available.length - matchedHolds);
  return { totalStaff: members.length, availableStaff: available.filter((member) => staffQualifiedForService(member, slot, services)).map((member) => ({ id: member.id, name: member.name })), assignedCount: assigned.length, pendingCount: pending.length, remaining, saturated: salonClosed || !canAcceptAdditional };
}

export function nailieCapacityTask(slot, bookings, staff, settings, bookingId, services = []) {
  const capacity = salonCapacityState(slot, bookings, staff, settings, services);
  return { target: "nailie", action: capacity.saturated ? "capacity_block" : "capacity_unblock", bookingId, lockOwner: "capacity", capacity, match: { date: slot.date, start: slot.start, end: slot.end } };
}
