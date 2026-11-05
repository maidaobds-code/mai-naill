export function compactSalonboardName(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

export function salonboardStaffHeaderName(value) {
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
}

export function sameSalonboardStaffName(left, right) {
  return compactSalonboardName(salonboardStaffHeaderName(left)) === compactSalonboardName(salonboardStaffHeaderName(right));
}
