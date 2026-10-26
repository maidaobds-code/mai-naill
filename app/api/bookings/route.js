import { createBookingAssignmentToken } from "../../../lib/bookingAssignmentToken.js";
import { managementEmails, sendEmail } from "../../../lib/serverEmail.js";
import { isAdminRequest, isOwnerRequest, isStaffRequest } from "../../../lib/serverAuth.js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const OWNER_ID = String(process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001").trim().replace(/^['\"]|['\"]$/g, "");
const BOOKINGS_KEY = "nail-japan-bookings";

async function supabaseRest(path, options = {}) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Supabase server configuration is missing");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, cache: "no-store", headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}`, "content-type": "application/json", ...(options.headers || {}) } });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

function isPendingAssignment(booking) {
  return booking?.assignmentStatus === "PENDING_ASSIGNMENT" || (!booking?.staffId && ["", "Chưa phân công", "指名なし", "No preference"].includes(String(booking?.staff || "")));
}

function publicOrigin(request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return configured.replace(/\/$/, "") || new URL(request.url).origin;
}

function minutes(value) { const [hour, minute] = String(value || "").split(":").map(Number); return hour * 60 + minute; }
function overlaps(left, right) { return left.date && left.date === right.date && minutes(left.start) < minutes(right.end) && minutes(left.end) > minutes(right.start); }
function sameSlot(left, right) {
  const leftStaff = String(left?.staffId || left?.staff || "").trim().toLowerCase();
  const rightStaff = String(right?.staffId || right?.staff || "").trim().toLowerCase();
  return Boolean(left?.date && leftStaff && left.date === right?.date && left.start === right?.start && left.end === right?.end && leftStaff === rightStaff);
}

function normalizeId(booking) {
  return booking?.id === undefined || booking?.id === null ? booking : { ...booking, id: String(booking.id) };
}

function compactBookings(list) {
  const byId = new Map();
  for (const raw of Array.isArray(list) ? list : []) {
    const booking = normalizeId(raw);
    if (!booking?.id) continue;
    const previous = byId.get(booking.id);
    // A tombstone is immutable and must win over every live duplicate. This
    // also repairs old rows where numeric and string IDs were stored together.
    if (!previous || booking.deletedAt || !previous.deletedAt) byId.set(booking.id, previous?.deletedAt && !booking.deletedAt ? previous : booking);
  }
  return [...byId.values()];
}

async function notifyManagementForAssignment(request, booking) {
  const recipients = await managementEmails();
  if (!recipients.length) return { ok: false, skipped: true, reason: "No owner or manager email is configured" };
  const token = createBookingAssignmentToken(booking.id);
  const assignUrl = `${publicOrigin(request)}/assign-booking?token=${encodeURIComponent(token)}`;
  const pending = isPendingAssignment(booking);
  const heading = pending ? "Lịch hẹn mới chưa chọn nhân viên" : "Lịch hẹn mới cần kiểm tra nhân viên";
  const action = pending ? "Chọn nhân viên" : "Chọn / đổi nhân viên";
  const subject = `Mai Beauty Salon · ${pending ? "Cần chọn nhân viên" : "Kiểm tra nhân viên"} · ${booking.customer || "Khách hàng"}`;
  const text = `${heading}.\nKhách: ${booking.customer}\nNgày: ${booking.date}\nGiờ: ${booking.start} - ${booking.end}\nDịch vụ: ${booking.service}\nNhân viên hiện tại: ${booking.staff || "Chưa phân công"}\n${action}: ${assignUrl}`;
  const html = `<div style="margin:0;background:#fff7fb;padding:28px 14px;font-family:Arial,sans-serif;color:#332936"><div style="max-width:600px;margin:auto;background:#fff;border:1px solid #f0dce8;border-radius:20px;overflow:hidden"><div style="padding:20px 26px;background:#f6d8ec;font-weight:700">MAI BEAUTY SALON</div><div style="padding:28px"><h1 style="font-size:22px">${heading}</h1><p><strong>Khách:</strong> ${escapeHtml(booking.customer)}</p><p><strong>Ngày:</strong> ${escapeHtml(booking.date)}</p><p><strong>Giờ:</strong> ${escapeHtml(booking.start)} - ${escapeHtml(booking.end)}</p><p><strong>Dịch vụ:</strong> ${escapeHtml(booking.service)}</p><p><strong>Nhân viên hiện tại:</strong> ${escapeHtml(booking.staff || "Chưa phân công")}</p><p style="margin:26px 0"><a href="${escapeHtml(assignUrl)}" style="display:inline-block;padding:13px 22px;border-radius:999px;background:#a93670;color:#fff;text-decoration:none;font-weight:700">${action}</a></p><small>Liên kết có hiệu lực trong 48 giờ.</small></div></div></div>`;
  return sendEmail({ to: recipients, subject, text, html });
}

export async function GET() {
  try {
    const rows = await supabaseRest(`app_kv?owner_id=eq.${OWNER_ID}&key=eq.${BOOKINGS_KEY}&select=value&limit=1`);
    const value = compactBookings(rows?.[0]?.value);
    return Response.json({ ok: true, value }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch { return Response.json({ ok: false, value: [], message: "Không thể đọc lịch hẹn." }, { status: 500 }); }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (!Array.isArray(body.bookings)) return Response.json({ ok: false, message: "Invalid bookings" }, { status: 400 });
  try {
    const currentRows = await supabaseRest(`app_kv?owner_id=eq.${OWNER_ID}&key=eq.${BOOKINGS_KEY}&select=value&limit=1`);
    const current = compactBookings(currentRows?.[0]?.value);
    const submitted = compactBookings(body.bookings);
    const currentIds = new Set(current.map((item) => item.id));
    const incomingIds = new Set(submitted.map((item) => item.id));
    const protectedBookings = submitted.map((item) => {
      const previous = current.find((value) => value.id === item.id);
      return previous?.deletedAt && !item?.restoreDeleted ? previous : item;
    });
    const submittedTombstones = protectedBookings.filter((item) => item.deletedAt);
    const currentAfterRelatedDeletes = current.map((item) => {
      const matchingDeletion = submittedTombstones.find((deleted) => deleted.id === item.id || sameSlot(deleted, item));
      return matchingDeletion && !item.deletedAt ? { ...item, deletedAt: matchingDeletion.deletedAt } : item;
    });
    const incoming = protectedBookings.filter((item) => item && !item.deletedAt && !["cancelled", "completed"].includes(String(item.status).toLowerCase()));
    const allForConflict = [...currentAfterRelatedDeletes.filter((item) => !item.deletedAt && !incomingIds.has(item.id)), ...incoming];
    for (const booking of incoming) {
      const conflict = allForConflict.find((item) => item.id !== booking.id && item.date === booking.date && item.staff && booking.staff && item.staff === booking.staff && overlaps(item, booking));
      if (conflict) return Response.json({ ok: false, message: `Khung giờ ${booking.start}-${booking.end} của ${booking.staff} đã có lịch khác.` }, { status: 409 });
    }
    const merged = compactBookings([...protectedBookings, ...currentAfterRelatedDeletes.filter((item) => item.id && !incomingIds.has(item.id))]);
    const rows = await supabaseRest("app_kv?on_conflict=owner_id,key", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify([{ owner_id: OWNER_ID, key: BOOKINGS_KEY, value: merged, updated_at: new Date().toISOString() }]) });
    const newOnlineBookings = submitted.filter((booking) => booking.id && !booking.deletedAt && !currentIds.has(booking.id) && String(booking.source || "").toLowerCase() === "direct");
    const notifications = await Promise.all(newOnlineBookings.map((booking) => notifyManagementForAssignment(request, booking).catch((error) => ({ ok: false, reason: error.message }))));
    return Response.json({ ok: true, value: rows?.[0]?.value || merged, assignmentNotifications: notifications });
  } catch { return Response.json({ ok: false, message: "Không thể lưu lịch hẹn." }, { status: 500 }); }
}

export async function DELETE(request) {
  if (!isAdminRequest(request) && !isOwnerRequest(request) && !isStaffRequest(request)) return Response.json({ ok: false, message: "Phiên đăng nhập không có quyền xóa lịch." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return Response.json({ ok: false, message: "Thiếu mã lịch hẹn." }, { status: 400 });
  try {
    const currentRows = await supabaseRest(`app_kv?owner_id=eq.${OWNER_ID}&key=eq.${BOOKINGS_KEY}&select=value&limit=1`);
    const current = compactBookings(currentRows?.[0]?.value);
    const target = current.find((item) => item.id === id);
    if (!target) return Response.json({ ok: false, message: "Lịch hẹn không còn tồn tại trên server." }, { status: 404 });
    const deletedAt = target.deletedAt || new Date().toISOString();
    const next = current.map((item) => item.id === id || sameSlot(item, target) ? { ...item, deletedAt: item.deletedAt || deletedAt } : item);
    const rows = await supabaseRest("app_kv?on_conflict=owner_id,key", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([{ owner_id: OWNER_ID, key: BOOKINGS_KEY, value: next, updated_at: new Date().toISOString() }]),
    });
    const saved = compactBookings(rows?.[0]?.value || next);
    const deleted = saved.find((item) => item.id === id);
    if (!deleted?.deletedAt) throw new Error("Supabase did not persist the booking tombstone");
    return Response.json({ ok: true, value: saved, deletedId: id, deletedAt: deleted.deletedAt }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return Response.json({ ok: false, message: error.message || "Không thể xóa lịch hẹn trên Supabase." }, { status: 500 });
  }
}
