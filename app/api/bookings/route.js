import { createBookingAssignmentToken } from "../../../lib/bookingAssignmentToken.js";
import { overallSyncStatus, providerSyncState, syncTaskId } from "../../../lib/bookingSync.js";
import { managementEmails, sendEmail } from "../../../lib/serverEmail.js";
import { isAdminRequest, isOwnerRequest, isStaffRequest } from "../../../lib/serverAuth.js";
import { salonSettings, serviceCatalog, staffCatalog } from "../../../lib/serverEmail.js";
import { nailieCapacityTask } from "../../../lib/salonCapacity.js";
import { escapeHtml, publicOrigin } from "../../../lib/webText.js";

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

function isPendingAssignment(booking) {
  return booking?.assignmentStatus === "PENDING_ASSIGNMENT" || (!booking?.staffId && ["", "Chưa phân công", "指名なし", "No preference"].includes(String(booking?.staff || "")));
}

function minutes(value) { const [hour, minute] = String(value || "").split(":").map(Number); return hour * 60 + minute; }
function overlaps(left, right) { return left.date && left.date === right.date && minutes(left.start) < minutes(right.end) && minutes(left.end) > minutes(right.start); }
function sameSlot(left, right) {
  const leftStaff = String(left?.staffId || left?.staff || "").trim().toLowerCase();
  const rightStaff = String(right?.staffId || right?.staff || "").trim().toLowerCase();
  return Boolean(left?.date && leftStaff && left.date === right?.date && left.start === right?.start && left.end === right?.end && leftStaff === rightStaff);
}

function normalizedCustomer(value) {
  return String(value || "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

// A booking created from another source can arrive with a new ID even though
// it is the same customer's appointment already stored for another staff
// member. Treat that as an idempotent duplicate so it cannot trigger another
// assignment email or another external sync task.
function sameCustomerTime(left, right) {
  const customer = normalizedCustomer(left?.customer);
  return Boolean(customer && customer === normalizedCustomer(right?.customer)
    && left?.date && left.date === right?.date
    && left.start === right.start && left.end === right.end);
}

function normalizeId(booking) {
  return booking?.id === undefined || booking?.id === null ? booking : { ...booking, id: String(booking.id) };
}

function mainaillSyncMetadata(booking, previous) {
  const source = String(booking?.source || "direct").toLowerCase();
  if (source === "nailie" && previous?.assignmentStatus === "PENDING_ASSIGNMENT" && (booking.staffId || booking.staff)) {
    const providerSync = providerSyncState(previous);
    providerSync.hotpepper = { ...providerSync.hotpepper, status: "pending", error: "" };
    providerSync.nailie = { ...providerSync.nailie, status: "pending", error: "" };
    return { ...booking, source, assignmentStatus: "ASSIGNED", approvalStatus: "OWNER_CONFIRMED", assignedAt: new Date().toISOString(), providerSync, syncStatus: overallSyncStatus(providerSync), updatedAt: new Date().toISOString() };
  }
  if (source !== "direct") return booking;
  const changed = !previous || ["date", "start", "end", "staffId", "staff", "status"].some((field) => String(previous?.[field] || "") !== String(booking?.[field] || ""));
  if (!changed) return booking;
  const providerSync = providerSyncState(previous || booking);
  for (const provider of ["hotpepper", "nailie"]) providerSync[provider] = { ...providerSync[provider], status: "pending", error: "" };
  return { ...booking, source: "direct", providerSync, syncStatus: overallSyncStatus(providerSync), updatedAt: new Date().toISOString() };
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
  const byFingerprint = new Map();
  for (const booking of byId.values()) {
    const source = String(booking.source || "direct").toLowerCase();
    const external = String(booking.externalBookingId || "").trim();
    const staff = String(booking.staffId || booking.staff || "").trim().toLowerCase();
    const fingerprint = external
      ? `${source}|external|${external}`
      : `${source}|slot|${booking.date || ""}|${booking.start || ""}|${booking.end || ""}|${staff}|${String(booking.customer || "").trim().toLowerCase()}|${String(booking.service || "").trim().toLowerCase()}`;
    const previous = byFingerprint.get(fingerprint);
    if (!previous || booking.deletedAt || !previous.deletedAt) byFingerprint.set(fingerprint, previous?.deletedAt && !booking.deletedAt ? previous : booking);
  }
  return [...byFingerprint.values()];
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
    const rawValue = Array.isArray(rows?.[0]?.value) ? rows[0].value : [];
    const value = compactBookings(rawValue);
    if (value.length !== rawValue.length) {
      await supabaseRest("app_kv?on_conflict=owner_id,key", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ owner_id: OWNER_ID, key: BOOKINGS_KEY, value, updated_at: new Date().toISOString() }]) });
    }
    return Response.json({ ok: true, value }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch { return Response.json({ ok: false, value: [], message: "Không thể đọc lịch hẹn." }, { status: 500 }); }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (!Array.isArray(body.bookings)) return Response.json({ ok: false, message: "Invalid bookings" }, { status: 400 });
  try {
    const currentRows = await supabaseRest(`app_kv?owner_id=eq.${OWNER_ID}&key=eq.${BOOKINGS_KEY}&select=value&limit=1`);
    const current = compactBookings(currentRows?.[0]?.value);
    const [staff, settings, services] = await Promise.all([staffCatalog(), salonSettings(), serviceCatalog()]);
    const rawSubmitted = compactBookings(body.bookings);
    const submitted = rawSubmitted.map((booking) => mainaillSyncMetadata(booking, current.find((item) => item.id === booking.id)));
    const currentIds = new Set(current.map((item) => item.id));
    const incomingIds = new Set(submitted.map((item) => item.id));
    const protectedBookings = submitted.map((item) => {
      const previous = current.find((value) => value.id === item.id);
      return previous?.deletedAt && !item?.restoreDeleted ? previous : item;
    });
    const duplicateIds = new Set();
    for (const item of protectedBookings) {
      if (item.deletedAt || currentIds.has(item.id)) continue;
      const duplicate = current.find((existing) => !existing.deletedAt
        && !["cancelled", "completed"].includes(String(existing.status).toLowerCase())
        && sameCustomerTime(existing, item));
      if (duplicate) duplicateIds.add(item.id);
    }
    const deduplicatedProtectedBookings = protectedBookings.filter((item) => !duplicateIds.has(item.id));
    const submittedTombstones = deduplicatedProtectedBookings.filter((item) => item.deletedAt);
    const currentAfterRelatedDeletes = current.map((item) => {
      const matchingDeletion = submittedTombstones.find((deleted) => deleted.id === item.id || sameSlot(deleted, item));
      return matchingDeletion && !item.deletedAt ? { ...item, deletedAt: matchingDeletion.deletedAt } : item;
    });
    const incoming = deduplicatedProtectedBookings.filter((item) => item && !item.deletedAt && !["cancelled", "completed"].includes(String(item.status).toLowerCase()));
    const allForConflict = [...currentAfterRelatedDeletes.filter((item) => !item.deletedAt && !incomingIds.has(item.id)), ...incoming];
    for (const booking of incoming) {
      const conflict = allForConflict.find((item) => item.id !== booking.id && item.date === booking.date && item.staff && booking.staff && item.staff === booking.staff && overlaps(item, booking));
      if (conflict) return Response.json({ ok: false, message: `Khung giờ ${booking.start}-${booking.end} của ${booking.staff} đã có lịch khác.` }, { status: 409 });
    }
    const merged = compactBookings([...deduplicatedProtectedBookings, ...currentAfterRelatedDeletes.filter((item) => item.id && !incomingIds.has(item.id))]);
    const syncTasks = deduplicatedProtectedBookings.filter((booking) => !booking.deletedAt).flatMap((booking) => {
      const previous = current.find((item) => item.id === booking.id);
      const source = String(booking.source || "direct").toLowerCase();
      const newlyAssignedNailie = source === "nailie" && previous?.assignmentStatus === "PENDING_ASSIGNMENT" && booking.assignmentStatus === "ASSIGNED";
      if (source !== "direct" && !newlyAssignedNailie) return [];
      const changedSlot = previous && !sameSlot(previous, booking);
      const previousMatch = changedSlot ? { date: previous.date, start: previous.start, end: previous.end, staffId: previous.staffId || "", staff: previous.staff || "" } : null;
      const tasks = [{ target: "hotpepper", action: newlyAssignedNailie ? "block" : previous ? "update" : "block", bookingId: booking.id, ...(previousMatch ? { previousMatch } : {}) }];
      if (previousMatch) tasks.push(nailieCapacityTask(previousMatch, merged, staff, settings, booking.id, services));
      tasks.push(nailieCapacityTask(booking, merged, staff, settings, booking.id, services));
      return tasks;
    });
    const identifiedSyncTasks = syncTasks.map((task) => ({ ...task, taskId: syncTaskId(task) }));
    const tasksByBooking = new Map(identifiedSyncTasks.map((task) => [String(task.bookingId), []]));
    for (const task of identifiedSyncTasks) tasksByBooking.get(String(task.bookingId))?.push(task);
    const mergedWithTasks = merged.map((booking) => tasksByBooking.has(String(booking.id)) ? { ...booking, pendingSyncActions: tasksByBooking.get(String(booking.id)) } : booking);
    const rows = await supabaseRest("app_kv?on_conflict=owner_id,key", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify([{ owner_id: OWNER_ID, key: BOOKINGS_KEY, value: mergedWithTasks, updated_at: new Date().toISOString() }]) });
    const newOnlineBookings = deduplicatedProtectedBookings.filter((booking) => booking.id && !booking.deletedAt && !currentIds.has(booking.id) && String(booking.source || "").toLowerCase() === "direct");
    const notifications = await Promise.all(newOnlineBookings.map((booking) => notifyManagementForAssignment(request, booking).catch((error) => ({ ok: false, reason: error.message }))));
    return Response.json({ ok: true, value: rows?.[0]?.value || mergedWithTasks, assignmentNotifications: notifications, syncTasks: identifiedSyncTasks });
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
    const match = { date: target.date, start: target.start, end: target.end, staffId: target.staffId || "", staff: target.staff || "" };
    const source = String(target.source || "direct").toLowerCase();
    const syncProviders = source === "hotpepper" ? [] : ["hotpepper"];
    let next = current.map((item) => {
      if (item.id !== id && !sameSlot(item, target)) return item;
      return { ...item, status: "CANCELLED", assignmentStatus: "CANCELLED", cancelledAt: item.cancelledAt || deletedAt, deletedAt: item.deletedAt || deletedAt, deletedByOwner: true };
    });
    const [staff, settings, services] = await Promise.all([staffCatalog(), salonSettings(), serviceCatalog()]);
    const syncTasks = [
      ...syncProviders.map((provider) => ({ target: provider, action: "cancel", bookingId: target.id, externalBookingId: target.providerSync?.[provider]?.externalBookingId || "", match })),
      nailieCapacityTask(match, next, staff, settings, target.id, services),
    ].map((task) => ({ ...task, taskId: syncTaskId(task) }));
    next = next.map((item) => {
      if (item.id !== id && !sameSlot(item, target)) return item;
      const providerSync = providerSyncState(item);
      for (const provider of new Set(syncTasks.map((task) => task.target))) providerSync[provider] = { ...providerSync[provider], status: "pending", error: "" };
      return { ...item, status: "CANCELLED", assignmentStatus: "CANCELLED", cancelledAt: item.cancelledAt || deletedAt, deletedAt: item.deletedAt || deletedAt, deletedByOwner: true, providerSync, syncStatus: overallSyncStatus(providerSync), pendingSyncActions: syncTasks };
    });
    const rows = await supabaseRest("app_kv?on_conflict=owner_id,key", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([{ owner_id: OWNER_ID, key: BOOKINGS_KEY, value: next, updated_at: new Date().toISOString() }]),
    });
    const saved = compactBookings(rows?.[0]?.value || next);
    const deleted = saved.find((item) => item.id === id);
    if (!deleted?.deletedAt) throw new Error("Supabase did not persist the booking tombstone");
    return Response.json({ ok: true, value: saved, deletedId: id, deletedAt: deleted.deletedAt, syncTasks }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return Response.json({ ok: false, message: error.message || "Không thể xóa lịch hẹn trên Supabase." }, { status: 500 });
  }
}
