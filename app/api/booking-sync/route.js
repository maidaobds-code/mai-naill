import { acknowledgeProviderSync, ingestExternalBooking, syncTaskId } from "../../../lib/bookingSync.js";
import { createBookingAssignmentToken, createBookingCancellationToken } from "../../../lib/bookingAssignmentToken.js";
import { managementEmails, sendEmail, salonSettings, serviceCatalog, staffCatalog } from "../../../lib/serverEmail.js";
import { nailieCapacityTask } from "../../../lib/salonCapacity.js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const OWNER_ID = String(process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001").trim().replace(/^['\"]|['\"]$/g, "");
const BOOKINGS_KEY = "nail-japan-bookings";

function authorized(request) {
  const secret = process.env.BOOKING_SYNC_SECRET || process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

async function supabaseRest(path, options = {}) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Supabase server configuration is missing");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, cache: "no-store", headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}`, "content-type": "application/json", ...(options.headers || {}) } });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function readBookings() {
  const rows = await supabaseRest(`app_kv?owner_id=eq.${OWNER_ID}&key=eq.${BOOKINGS_KEY}&select=value&limit=1`);
  return Array.isArray(rows?.[0]?.value) ? rows[0].value : [];
}

async function saveBookings(value) {
  const rows = await supabaseRest("app_kv?on_conflict=owner_id,key", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify([{ owner_id: OWNER_ID, key: BOOKINGS_KEY, value, updated_at: new Date().toISOString() }]) });
  return rows?.[0]?.value || value;
}

export async function GET(request) {
  if (!authorized(request)) return Response.json({ ok: false, message: "Unauthorized sync worker" }, { status: 401 });
  const provider = new URL(request.url).searchParams.get("provider");
  if (!["hotpepper", "nailie"].includes(provider)) return Response.json({ ok: false, message: "Invalid provider" }, { status: 400 });
  try {
    const bookings = await readBookings();
    const tasks = bookings.flatMap((booking) => {
      const pending = (Array.isArray(booking.pendingSyncActions) ? booking.pendingSyncActions : []).filter((action) => action.target === provider);
      if (!pending.length && provider === "hotpepper" && booking.deletedAt && booking.providerSync?.hotpepper?.status === "error" && booking.date && booking.start && booking.end && (booking.staffId || booking.staff)) {
        const retry = { target: "hotpepper", action: "cancel", bookingId: booking.id, match: { date: booking.date, start: booking.start, end: booking.end, staffId: booking.staffId || "", staff: booking.staff || "" } };
        pending.push({ ...retry, taskId: syncTaskId(retry) });
      }
      return pending.map((action) => ({ ...action, booking: { id: booking.id, date: booking.date, start: booking.start, end: booking.end, staffId: booking.staffId, staff: booking.staff, status: booking.status } }));
    });
    return Response.json({ ok: true, provider, tasks }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return Response.json({ ok: false, message: error.message || "Cannot read sync tasks" }, { status: 500 });
  }
}

function publicOrigin(request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return configured.replace(/\/$/, "") || new URL(request.url).origin;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

function normalizeCustomer(value) {
  return String(value || "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function isFutureBooking(booking) {
  const date = String(booking?.date || "").trim();
  const start = String(booking?.start || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start)) return false;
  const timestamp = Date.parse(`${date}T${start}:00+09:00`);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function sameCustomerTime(left, right) {
  const customer = normalizeCustomer(left?.customer);
  return Boolean(customer && customer === normalizeCustomer(right?.customer)
    && left?.date === right?.date && left?.start === right?.start && left?.end === right?.end);
}

async function notifyConflict(request, conflicts) {
  if (!Array.isArray(conflicts) || conflicts.length < 2) return null;
  const recipients = await managementEmails();
  const origin = publicOrigin(request);
  const rows = conflicts.map((booking) => {
    const token = createBookingAssignmentToken(booking.id);
    return { booking, url: `${origin}/assign-booking?token=${encodeURIComponent(token)}` };
  });
  const subject = `Mai Beauty Salon · Trùng lịch ${rows[0].booking.date} ${rows[0].booking.start}`;
  const text = `Nailie và HOT PEPPER có lịch trùng nhân viên. Chưa đóng lịch trên nền tảng nào.\n${rows.map(({ booking, url }) => `${booking.source}: ${booking.date} ${booking.start}-${booking.end} · ${booking.staff}\nĐổi nhân viên: ${url}`).join("\n\n")}`;
  const html = `<div style="font-family:Arial,sans-serif;color:#332936"><h2>Hai nền tảng có lịch trùng nhân viên</h2><p>Mainaill chưa đóng lịch trên nền tảng nào. Hãy chọn nhân viên riêng cho từng booking.</p>${rows.map(({ booking, url }) => `<div style="margin:16px 0;padding:16px;border:1px solid #ead7e2;border-radius:12px"><strong>${escapeHtml(String(booking.source || "").toUpperCase())}</strong><p>${escapeHtml(booking.date)} · ${escapeHtml(booking.start)}–${escapeHtml(booking.end)} · ${escapeHtml(booking.staff)}</p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 16px;border-radius:999px;background:#a93670;color:#fff;text-decoration:none">Đổi nhân viên</a></div>`).join("")}</div>`;
  return sendEmail({ to: recipients, subject, text, html });
}

async function notifyPendingAssignment(request, booking, allBookings = []) {
  if (booking?.assignmentStatus !== "PENDING_ASSIGNMENT") return null;
  if (!isFutureBooking(booking)) return { ok: true, skipped: true, reason: "Booking is not in the future" };
  const duplicate = (Array.isArray(allBookings) ? allBookings : []).find((item) => String(item?.id) !== String(booking?.id)
    && !item?.deletedAt
    && !["cancelled", "completed"].includes(String(item?.status || "").toLowerCase())
    && sameCustomerTime(item, booking));
  if (duplicate) return { ok: true, skipped: true, reason: "Matching customer/date/time already exists" };
  const recipients = await managementEmails();
  const token = createBookingAssignmentToken(booking.id);
  const url = `${publicOrigin(request)}/assign-booking?token=${encodeURIComponent(token)}`;
  const cancelToken = createBookingCancellationToken(booking.id, 48 * 60 * 60, "assignment-cancel");
  const cancelUrl = `${publicOrigin(request)}/cancel-booking?token=${encodeURIComponent(cancelToken)}`;
  const account = booking.requestedNailieAccount || "Nailie";
  const subject = `Mai Beauty Salon · Nailie chờ phân công · ${booking.date} ${booking.start}`;
  const text = `Tài khoản: ${account}\nNgày giờ: ${booking.date} ${booking.start}-${booking.end}\nDịch vụ: ${booking.service || "Nailie booking"}\nThời lượng: ${booking.durationMinutes || "—"} phút\nTrạng thái: Chờ phân công nhân viên\nPhân công: ${url}\nHủy lịch, không nhận lại thông báo: ${cancelUrl}`;
  const html = `<div style="font-family:Arial,sans-serif;color:#332936"><h2>Lịch Nailie chờ phân công</h2><p><strong>Tài khoản:</strong> ${escapeHtml(account)}</p><p><strong>Ngày giờ:</strong> ${escapeHtml(booking.date)} · ${escapeHtml(booking.start)}–${escapeHtml(booking.end)}</p><p><strong>Dịch vụ:</strong> ${escapeHtml(booking.service || "Nailie booking")}</p><p><strong>Trạng thái:</strong> Chờ phân công nhân viên</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#6d28d9;color:#fff;text-decoration:none">Chọn nhân viên</a></p><p><a href="${escapeHtml(cancelUrl)}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#fee2e2;color:#991b1b;text-decoration:none">Hủy lịch – không nhận lại thông báo</a></p></div>`;
  return sendEmail({ to: recipients, subject, text, html });
}

async function notifyManualSyncRequired(booking, task, error) {
  const recipients = await managementEmails();
  const platform = task?.target === "nailie" ? "NAILIE" : "HOT PEPPER / SALON BOARD";
  const operation = ["cancel", "unblock", "capacity_unblock"].includes(task?.action) ? "mở lịch" : "đóng/cập nhật lịch";
  const subject = `Mai Beauty Salon · Bot dừng tác vụ ${platform} sau 4 lần lỗi`;
  const text = `Bot đã hủy tác vụ tự động sau 4 lần không thành công.\nNền tảng: ${platform}\nThao tác: ${operation}\nNhân viên: ${booking?.staff || "Cả quán"}\nNgày giờ: ${booking?.date || "—"} ${booking?.start || "—"}-${booking?.end || "—"}\nLỗi cuối: ${error || "Không rõ lỗi"}\nVui lòng vào nền tảng để thao tác bằng tay.`;
  const html = `<div style="font-family:Arial,sans-serif;color:#332936"><h2>Bot đã dừng tác vụ sau 4 lần lỗi</h2><p>Tác vụ đã được gỡ khỏi hàng đợi để không chạy lặp vô hạn. Vui lòng thao tác bằng tay.</p><p><strong>Nền tảng:</strong> ${escapeHtml(platform)}</p><p><strong>Thao tác:</strong> ${escapeHtml(operation)}</p><p><strong>Nhân viên:</strong> ${escapeHtml(booking?.staff || "Cả quán")}</p><p><strong>Ngày giờ:</strong> ${escapeHtml(booking?.date || "—")} · ${escapeHtml(booking?.start || "—")}–${escapeHtml(booking?.end || "—")}</p><p><strong>Lỗi cuối:</strong> ${escapeHtml(error || "Không rõ lỗi")}</p></div>`;
  return sendEmail({ to: recipients, subject, text, html });
}

export async function POST(request) {
  if (!authorized(request)) return Response.json({ ok: false, message: "Unauthorized sync worker" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const current = await readBookings();
    const existingExternal = body.kind === "ack" ? null : current.find((booking) => String(booking.source || "").toLowerCase() === String(body.provider || "").toLowerCase() && String(booking.externalBookingId || "") === String(body.externalBookingId || ""));
    const outcome = body.kind === "ack" ? acknowledgeProviderSync(current, body) : ingestExternalBooking(current, body);
    const generatedTasks = [...(outcome.tasks || [])];
    if (body.kind !== "ack" && outcome.result?.date && outcome.result?.start && outcome.result?.end) {
      const [staff, settings, services] = await Promise.all([staffCatalog(), salonSettings(), serviceCatalog()]);
      const moved = existingExternal && ["date", "start", "end"].some((field) => String(existingExternal[field] || "") !== String(outcome.result[field] || ""));
      if (moved) generatedTasks.push(nailieCapacityTask(existingExternal, outcome.bookings, staff, settings, outcome.result.id, services));
      generatedTasks.push(nailieCapacityTask(outcome.result, outcome.bookings, staff, settings, outcome.result.id, services));
    }
    const identifiedTasks = generatedTasks.map((task) => ({ ...task, taskId: task.taskId || syncTaskId(task) }));
    const tasksByBooking = new Map();
    for (const task of identifiedTasks) {
      const key = String(task.bookingId || "");
      if (!tasksByBooking.has(key)) tasksByBooking.set(key, []);
      tasksByBooking.get(key).push(task);
    }
    const queued = outcome.bookings.map((booking) => {
      const tasks = tasksByBooking.get(String(booking.id));
      if (!tasks?.length) return booking;
      const targets = new Set(tasks.map((task) => task.target));
      const existing = (Array.isArray(booking.pendingSyncActions) ? booking.pendingSyncActions : []).filter((task) => !targets.has(task.target));
      return { ...booking, pendingSyncActions: [...existing, ...tasks] };
    });
    const value = await saveBookings(queued);
    const notification = outcome.conflicts ? await notifyConflict(request, outcome.conflicts).catch((error) => ({ ok: false, reason: error.message })) : null;
    const assignmentNotification = (!outcome.ignoredOwnerDeletion && (!existingExternal || existingExternal.assignmentStatus !== "PENDING_ASSIGNMENT")) ? await notifyPendingAssignment(request, outcome.result, value).catch((error) => ({ ok: false, reason: error.message })) : null;
    const manualNotification = outcome.retryExhausted ? await notifyManualSyncRequired(outcome.result, outcome.failedTask, body.error).catch((error) => ({ ok: false, reason: error.message })) : null;
    return Response.json({ ok: true, conflict: Boolean(outcome.conflicts), value, result: outcome.result, conflicts: outcome.conflicts || [], tasks: identifiedTasks, notification, assignmentNotification, manualNotification, retryExhausted: Boolean(outcome.retryExhausted) });
  } catch (error) {
    return Response.json({ ok: false, message: error.message || "Booking synchronization failed" }, { status: 400 });
  }
}

