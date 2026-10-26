import { verifyBookingAssignmentToken } from "../../../lib/bookingAssignmentToken.js";
import { sendEmail, staffCatalog } from "../../../lib/serverEmail.js";
import { staff as seedStaff } from "../../../lib/salonData.js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const OWNER_ID = process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001";
const BOOKINGS_KEY = "nail-japan-bookings";

async function supabaseRest(path, options = {}) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Supabase server configuration is missing");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, cache: "no-store", headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}`, "content-type": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function bookings() {
  const rows = await supabaseRest(`app_kv?owner_id=eq.${OWNER_ID}&key=eq.${BOOKINGS_KEY}&select=value&limit=1`);
  return Array.isArray(rows?.[0]?.value) ? rows[0].value : [];
}

async function availableStaff() {
  const stored = await staffCatalog();
  return stored.length ? stored : seedStaff;
}

function toMinutes(value) {
  const [hour, minute] = String(value || "").split(":").map(Number);
  return hour * 60 + minute;
}

function overlaps(left, right) {
  return left.date === right.date && toMinutes(left.start) < toMinutes(right.end) && toMinutes(left.end) > toMinutes(right.start);
}

function availability(member, booking, allBookings) {
  const own = allBookings.filter((item) => item.id !== booking.id && !item.deletedAt && (String(item.staffId || "") === String(member.id) || item.staff === member.name));
  const busy = own.filter((item) => !["cancelled", "completed"].includes(String(item.status).toLowerCase()) && overlaps(item, booking));
  const before = own.filter((item) => item.date === booking.date && String(item.end || "") <= String(booking.start || "")).sort((a, b) => String(b.end).localeCompare(String(a.end)))[0];
  return { available: !busy.length, previousBooking: before ? { start: before.start, end: before.end, customer: before.customer } : null };
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token");
  const claim = verifyBookingAssignmentToken(token);
  if (!claim) return Response.json({ ok: false, message: "Liên kết không hợp lệ hoặc đã hết hạn." }, { status: 401 });
  try {
    const [allBookings, staff] = await Promise.all([bookings(), availableStaff()]);
    const booking = allBookings.find((item) => item.id === claim.bookingId && !item.deletedAt);
    if (!booking) return Response.json({ ok: false, message: "Không tìm thấy lịch hẹn." }, { status: 404 });
    const rankedStaff = staff.map((member, index) => ({ id: member.id, name: member.name, role: member.role, color: member.color, hasEmail: Boolean(member.email), ...availability(member, booking, allBookings), originalOrder: index })).sort((a, b) => Number(b.available) - Number(a.available) || a.originalOrder - b.originalOrder);
    return Response.json({ ok: true, booking: { id: booking.id, customer: booking.customer, date: booking.date, start: booking.start, end: booking.end, service: booking.service, staff: booking.staff, staffId: booking.staffId, assignmentStatus: booking.assignmentStatus }, staff: rankedStaff }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ ok: false, message: error.message || "Không thể đọc lịch hẹn." }, { status: 500 }); }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const claim = verifyBookingAssignmentToken(body.token);
  if (!claim || !body.staffId) return Response.json({ ok: false, message: "Yêu cầu phân công không hợp lệ." }, { status: 401 });
  try {
    const [allBookings, staff] = await Promise.all([bookings(), availableStaff()]);
    const booking = allBookings.find((item) => item.id === claim.bookingId && !item.deletedAt);
    const member = staff.find((item) => String(item.id) === String(body.staffId));
    if (!booking || !member) return Response.json({ ok: false, message: "Không tìm thấy lịch hẹn hoặc nhân viên." }, { status: 404 });
    const conflict = allBookings.find((item) => item.id !== booking.id && !item.deletedAt && !["cancelled", "completed"].includes(String(item.status).toLowerCase()) && (String(item.staffId || "") === String(member.id) || item.staff === member.name) && overlaps(item, booking));
    if (conflict) return Response.json({ ok: false, message: `${member.name} đã có lịch trong khung giờ này.` }, { status: 409 });
    const assigned = { ...booking, staff: member.name, staffId: member.id, staffEmail: member.email || "", staffRole: member.role || "", assignmentStatus: "ASSIGNED", assignedAt: new Date().toISOString() };
    const next = allBookings.map((item) => item.id === assigned.id ? assigned : item);
    await supabaseRest("app_kv?on_conflict=owner_id,key", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ owner_id: OWNER_ID, key: BOOKINGS_KEY, value: next, updated_at: new Date().toISOString() }]) });
    const notification = await sendEmail({
      to: member.email,
      subject: `Mai Beauty Salon · Lịch hẹn mới · ${assigned.customer}`,
      text: `Bạn được phân công lịch hẹn mới.\nNgày: ${assigned.date}\nGiờ: ${assigned.start} - ${assigned.end}\nDịch vụ: ${assigned.service}`,
      html: `<div style="font-family:Arial,sans-serif;color:#332936"><h2>Bạn được phân công lịch hẹn mới</h2><p><strong>Khách:</strong> ${escapeHtml(assigned.customer)}</p><p><strong>Ngày:</strong> ${escapeHtml(assigned.date)}</p><p><strong>Giờ:</strong> ${escapeHtml(assigned.start)} - ${escapeHtml(assigned.end)}</p><p><strong>Dịch vụ:</strong> ${escapeHtml(assigned.service)}</p></div>`,
    });
    return Response.json({ ok: true, booking: assigned, notification });
  } catch (error) { return Response.json({ ok: false, message: error.message || "Không thể phân công nhân viên." }, { status: 500 }); }
}
