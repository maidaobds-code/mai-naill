import { createBookingCancellationToken, verifyBookingAssignmentToken } from "../../../lib/bookingAssignmentToken.js";
import { sendEmail, staffCatalog } from "../../../lib/serverEmail.js";
import { staff as seedStaff } from "../../../lib/salonData.js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const OWNER_ID = String(process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001").trim().replace(/^['\"]|['\"]$/g, "");
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
    const requestedNoPreference = body.staffId === "__NO_PREFERENCE__";
    const member = requestedNoPreference ? staff.find((item) => availability(item, booking, allBookings).available) : staff.find((item) => String(item.id) === String(body.staffId));
    if (!booking || !member) return Response.json({ ok: false, message: "Không tìm thấy lịch hẹn hoặc nhân viên." }, { status: 404 });
    const conflict = allBookings.find((item) => item.id !== booking.id && !item.deletedAt && !["cancelled", "completed"].includes(String(item.status).toLowerCase()) && (String(item.staffId || "") === String(member.id) || item.staff === member.name) && overlaps(item, booking));
    if (conflict) return Response.json({ ok: false, message: `${member.name} đã có lịch trong khung giờ này.` }, { status: 409 });
    const originallyRequested = booking.requestedStaff || booking.staff || "";
    const staffChanged = Boolean(originallyRequested && !["Chưa phân công", "指名なし", "No preference"].includes(originallyRequested) && originallyRequested !== member.name);
    const assigned = { ...booking, staff: member.name, staffId: member.id, staffEmail: member.email || "", staffRole: member.role || "", assignmentStatus: "ASSIGNED", approvalStatus: "OWNER_CONFIRMED", noPreference: requestedNoPreference, assignedAt: new Date().toISOString() };
    const next = allBookings.map((item) => item.id === assigned.id ? assigned : item);
    await supabaseRest("app_kv?on_conflict=owner_id,key", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ owner_id: OWNER_ID, key: BOOKINGS_KEY, value: next, updated_at: new Date().toISOString() }]) });
    const notification = await sendEmail({
      to: member.email,
      subject: `Mai Beauty Salon · Lịch hẹn mới · ${assigned.customer}`,
      text: `Bạn được phân công lịch hẹn mới.\nNgày: ${assigned.date}\nGiờ: ${assigned.start} - ${assigned.end}\nDịch vụ: ${assigned.service}`,
      html: `<div style="font-family:Arial,sans-serif;color:#332936"><h2>Bạn được phân công lịch hẹn mới</h2><p><strong>Khách:</strong> ${escapeHtml(assigned.customer)}</p><p><strong>Ngày:</strong> ${escapeHtml(assigned.date)}</p><p><strong>Giờ:</strong> ${escapeHtml(assigned.start)} - ${escapeHtml(assigned.end)}</p><p><strong>Dịch vụ:</strong> ${escapeHtml(assigned.service)}</p></div>`,
    });
    const origin = new URL(request.url).origin;
    const assignmentToken = new URL(request.url).searchParams.get("token") || body.token;
    const cancelToken = createBookingCancellationToken(assigned.id);
    const changeUrl = `${origin}/assign-booking?token=${encodeURIComponent(assignmentToken)}`;
    const cancelUrl = `${origin}/cancel-booking?token=${encodeURIComponent(cancelToken)}`;
    const customerReason = staffChanged ? `Nhân viên ${originallyRequested} hiện không tiện phục vụ trong khung giờ này, salon đã sắp xếp ${member.name}.` : requestedNoPreference ? `Bạn không yêu cầu chỉ định, salon đã sắp xếp ${member.name}.` : `Salon đã xác nhận ${member.name} phục vụ bạn.`;
    const customerNotification = await sendEmail({
      to: assigned.email,
      subject: `Mai Beauty Salon · Lịch hẹn đã được chấp nhận · ${assigned.date}`,
      text: `Lịch hẹn của bạn đã được chấp nhận.\n${customerReason}\nNgày: ${assigned.date}\nGiờ: ${assigned.start} - ${assigned.end}\nChọn nhân viên khác hoặc không chỉ định: ${changeUrl}\nHủy hẹn: ${cancelUrl}`,
      html: `<div style="font-family:Arial,sans-serif;color:#332936;max-width:600px;margin:auto"><h2>Lịch hẹn đã được chấp nhận</h2><p>${escapeHtml(customerReason)}</p><p><strong>Ngày:</strong> ${escapeHtml(assigned.date)}<br><strong>Giờ:</strong> ${escapeHtml(assigned.start)} - ${escapeHtml(assigned.end)}<br><strong>Dịch vụ:</strong> ${escapeHtml(assigned.service)}</p><p><a href="${escapeHtml(changeUrl)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#a93670;color:#fff;text-decoration:none;font-weight:700">Chọn nhân viên khác / Không chỉ định</a></p><p><a href="${escapeHtml(cancelUrl)}" style="display:inline-block;padding:11px 18px;border-radius:999px;border:1px solid #c4455d;color:#a62f46;text-decoration:none;font-weight:700">Hủy hẹn</a></p></div>`,
    });
    return Response.json({ ok: true, booking: assigned, notification, customerNotification });
  } catch (error) { return Response.json({ ok: false, message: error.message || "Không thể phân công nhân viên." }, { status: 500 }); }
}
