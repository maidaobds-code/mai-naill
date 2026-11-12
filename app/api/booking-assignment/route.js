import { createBookingCancellationToken, verifyBookingAssignmentToken } from "../../../lib/bookingAssignmentToken.js";
import { sendEmail, staffCatalog, salonSettings, serviceCatalog } from "../../../lib/serverEmail.js";
import { appointmentConfirmationEmail } from "../../../lib/appointmentEmail.js";
import { overallSyncStatus, providerSyncState, syncTaskId } from "../../../lib/bookingSync.js";
import { staff as seedStaff } from "../../../lib/salonData.js";
import { nailieCapacityTask, staffQualifiedForService } from "../../../lib/salonCapacity.js";
import { escapeHtml } from "../../../lib/webText.js";

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

function availability(member, booking, allBookings, settings = {}, services = []) {
  const own = allBookings.filter((item) => item.id !== booking.id && !item.deletedAt && (String(item.staffId || "") === String(member.id) || item.staff === member.name));
  const busy = own.filter((item) => !["cancelled", "completed"].includes(String(item.status).toLowerCase()) && overlaps(item, booking));
  const before = own.filter((item) => item.date === booking.date && String(item.end || "") <= String(booking.start || "")).sort((a, b) => String(b.end).localeCompare(String(a.end)))[0];
  const closedPeriods = (settings.staffClosedPeriods || []).filter((raw) => { const match = String(raw).match(/^(.+?)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/); return match && [String(member.id), String(member.name).trim().toLowerCase()].includes(String(match[1]).trim().toLowerCase()) && match[2] === booking.date && toMinutes(booking.start) < toMinutes(match[4]) && toMinutes(booking.end) > toMinutes(match[3]); });
  const qualified = staffQualifiedForService(member, booking, services);
  return { available: qualified && !busy.length && !closedPeriods.length, qualified, busy: Boolean(busy.length), closed: Boolean(closedPeriods.length), closedPeriods, previousBooking: before ? { start: before.start, end: before.end, customer: before.customer } : null };
}

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token");
  const claim = verifyBookingAssignmentToken(token);
  if (!claim) return Response.json({ ok: false, message: "Liên kết không hợp lệ hoặc đã hết hạn." }, { status: 401 });
  try {
    const [allBookings, staff, settings, services] = await Promise.all([bookings(), availableStaff(), salonSettings(), serviceCatalog()]);
    const storedBooking = allBookings.find((item) => item.id === claim.bookingId);
    if (!storedBooking) return Response.json({ ok: false, message: "Không tìm thấy lịch hẹn." }, { status: 404 });
    if (storedBooking.deletedAt) return Response.json({ ok: false, deleted: true, message: "Lịch hẹn này đã bị xóa khỏi lịch chung. Email cũ không còn hiệu lực và sẽ không gửi lại." }, { status: 410 });
    const booking = storedBooking;
    const rankedStaff = staff.map((member, index) => ({ id: member.id, name: member.name, role: member.role, color: member.color, hasEmail: Boolean(member.email), ...availability(member, booking, allBookings, settings, services), originalOrder: index })).sort((a, b) => Number(b.available) - Number(a.available) || a.originalOrder - b.originalOrder);
    return Response.json({ ok: true, booking: { id: booking.id, customer: booking.customer, date: booking.date, start: booking.start, end: booking.end, service: booking.service, staff: booking.staff, staffId: booking.staffId, assignmentStatus: booking.assignmentStatus }, staff: rankedStaff }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ ok: false, message: error.message || "Không thể đọc lịch hẹn." }, { status: 500 }); }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const claim = verifyBookingAssignmentToken(body.token);
  if (!claim) return Response.json({ ok: false, message: "Yêu cầu phân công không hợp lệ." }, { status: 401 });
  try {
    const [allBookings, staff, settings, services] = await Promise.all([bookings(), availableStaff(), salonSettings(), serviceCatalog()]);
    const booking = allBookings.find((item) => item.id === claim.bookingId && !item.deletedAt);
    if (!booking) return Response.json({ ok: false, message: "Không tìm thấy lịch hẹn." }, { status: 404 });
    if (body.action === "delete") {
      const deleted = { ...booking, deletedAt: new Date().toISOString(), deletedByOwner: true, status: "CANCELLED", assignmentStatus: "CANCELLED", approvalStatus: "OWNER_CANCELLED", pendingSyncActions: [], updatedAt: new Date().toISOString() };
      const next = allBookings.map((item) => item.id === deleted.id ? deleted : item);
      await supabaseRest("app_kv?on_conflict=owner_id,key", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ owner_id: OWNER_ID, key: BOOKINGS_KEY, value: next, updated_at: new Date().toISOString() }]) });
      return Response.json({ ok: true, deleted: true, booking: { id: deleted.id, deletedAt: deleted.deletedAt } });
    }
    if (!body.staffId) return Response.json({ ok: false, message: "Yêu cầu phân công không hợp lệ." }, { status: 401 });
    const requestedNoPreference = body.staffId === "__NO_PREFERENCE__";
    const member = requestedNoPreference ? staff.find((item) => availability(item, booking, allBookings, settings, services).available) : staff.find((item) => String(item.id) === String(body.staffId));
    if (!member) return Response.json({ ok: false, message: "Không tìm thấy nhân viên phù hợp và còn trống." }, { status: 404 });
    const memberAvailability = availability(member, booking, allBookings, settings, services);
    if (!memberAvailability.qualified) return Response.json({ ok: false, code: "STAFF_NOT_QUALIFIED", message: `${member.name} chưa được cấu hình cho dịch vụ này.` }, { status: 409 });
    if (memberAvailability.closed && !body.overrideClosed) return Response.json({ ok: false, code: "STAFF_CLOSED", message: `${member.name} đang đóng lịch trong khung giờ này.` }, { status: 409 });
    const conflict = allBookings.find((item) => item.id !== booking.id && !item.deletedAt && !["cancelled", "completed"].includes(String(item.status).toLowerCase()) && (String(item.staffId || "") === String(member.id) || item.staff === member.name) && overlaps(item, booking));
    if (conflict) return Response.json({ ok: false, message: `${member.name} đã có lịch trong khung giờ này.` }, { status: 409 });
    const originallyRequested = booking.requestedStaff || booking.staff || "";
    const staffChanged = Boolean(originallyRequested && !["Chưa phân công", "指名なし", "No preference"].includes(originallyRequested) && originallyRequested !== member.name);
    if (memberAvailability.closed && body.overrideClosed) {
      const nextSettings = { ...settings, staffClosedPeriods: (settings.staffClosedPeriods || []).filter((value) => !memberAvailability.closedPeriods.includes(value)) };
      await supabaseRest("app_kv?on_conflict=owner_id,key", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ owner_id: OWNER_ID, key: "nail-japan-settings", value: nextSettings, updated_at: new Date().toISOString() }]) });
      if (body.reopenOnly) return Response.json({ ok: true, reopenedOnly: true, booking });
    }
    const providerSync = providerSyncState(booking);
    const source = String(booking.source || "direct").toLowerCase();
    const baseAssigned = { ...booking, staff: member.name, staffId: member.id, staffEmail: member.email || "", staffRole: member.role || "", assignmentStatus: "ASSIGNED", approvalStatus: "OWNER_CONFIRMED", noPreference: requestedNoPreference, assignedAt: new Date().toISOString(), conflictResolvedAt: booking.assignmentStatus === "PENDING_CONFLICT" ? new Date().toISOString() : booking.conflictResolvedAt, conflictWith: booking.assignmentStatus === "PENDING_CONFLICT" ? "" : booking.conflictWith };
    const withAssignment = allBookings.map((item) => item.id === baseAssigned.id ? baseAssigned : item);
    const syncTasks = [];
    if (source !== "hotpepper") syncTasks.push({ target: "hotpepper", action: "block", bookingId: baseAssigned.id });
    syncTasks.push(nailieCapacityTask(baseAssigned, withAssignment, staff, settings, baseAssigned.id, services));
    for (let index = 0; index < syncTasks.length; index += 1) syncTasks[index] = { ...syncTasks[index], taskId: syncTaskId(syncTasks[index]) };
    for (const task of syncTasks) providerSync[task.target] = { ...providerSync[task.target], status: "pending", error: "" };
    const assigned = { ...baseAssigned, providerSync, syncStatus: overallSyncStatus(providerSync), pendingSyncActions: syncTasks };
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
    const customerLanguage = ["vi", "ja", "en", "zh", "ko"].includes(assigned.language) ? assigned.language : "en";
    const changedReasons = {
      vi: `Nhân viên ${originallyRequested} hiện không tiện phục vụ trong khung giờ này, salon đã sắp xếp ${member.name}.`,
      ja: `ご指名の${originallyRequested}はこの時間帯の対応が難しいため、${member.name}が担当いたします。`,
      en: `${originallyRequested} is unavailable at this time, so the salon has arranged ${member.name} for your appointment.`,
      zh: `您指定的${originallyRequested}在该时段无法服务，沙龙已为您安排${member.name}。`,
      ko: `지정하신 ${originallyRequested} 직원이 해당 시간에 서비스하기 어려워 ${member.name} 직원으로 배정되었습니다.`,
    };
    const customerReason = staffChanged ? changedReasons[customerLanguage] : "";
    const confirmation = appointmentConfirmationEmail({ booking: assigned, settings, language: customerLanguage, bookingUrl: `${origin}/booking?appointment=${encodeURIComponent(assigned.id)}`, changeUrl, cancelUrl, staffChangeReason: customerReason });
    const customerNotification = await sendEmail({ to: assigned.email, ...confirmation });
    return Response.json({ ok: true, booking: assigned, notification, customerNotification, syncTasks });
  } catch (error) { return Response.json({ ok: false, message: error.message || "Không thể phân công nhân viên." }, { status: 500 }); }
}
