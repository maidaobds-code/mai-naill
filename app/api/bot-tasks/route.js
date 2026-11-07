import { isAdminRequest, isOwnerRequest } from "../../../lib/serverAuth.js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const OWNER = String(process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001").replace(/^['\"]|['\"]$/g, "");
const BOOKING_KEY = "nail-japan-bookings";
const allowed = (request) => isAdminRequest(request) || isOwnerRequest(request);
async function read() {
  const response = await fetch(`${URL}/rest/v1/app_kv?owner_id=eq.${OWNER}&key=eq.${BOOKING_KEY}&select=value&limit=1`, { cache: "no-store", headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
  const rows = await response.json();
  return Array.isArray(rows?.[0]?.value) ? rows[0].value : [];
}
async function save(value) {
  const response = await fetch(`${URL}/rest/v1/app_kv?on_conflict=owner_id,key`, { method: "POST", headers: { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json", prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ owner_id: OWNER, key: BOOKING_KEY, value, updated_at: new Date().toISOString() }]) });
  if (!response.ok) throw new Error("Không thể lưu trạng thái tác vụ bot");
}
function flatten(bookings) { return bookings.flatMap((booking) => (Array.isArray(booking.pendingSyncActions) ? booking.pendingSyncActions : []).map((task) => ({ ...task, bookingId: booking.id, booking }))); }
export async function GET(request) {
  if (!allowed(request)) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  const bookings = await read();
  return Response.json({ ok: true, active: flatten(bookings), history: bookings.flatMap((booking) => (Array.isArray(booking.botTaskHistory) ? booking.botTaskHistory : []).map((task) => ({ ...task, bookingId: booking.id }))).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))) });
}
export async function POST(request) {
  if (!allowed(request)) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!["cancel", "skip"].includes(body.action)) return Response.json({ ok: false, message: "Tác vụ không hợp lệ" }, { status: 400 });
  const taskId = String(body.taskId || "");
  if (!taskId) return Response.json({ ok: false, message: "Thiếu taskId" }, { status: 400 });
  const now = new Date().toISOString();
  const bookings = await read(); let found = false;
  const next = bookings.map((booking) => {
    const pending = Array.isArray(booking.pendingSyncActions) ? booking.pendingSyncActions : [];
    const removed = pending.find((task) => String(task.taskId) === taskId);
    if (!removed) return booking;
    found = true;
    const providerSync = { ...(booking.providerSync || {}) };
    providerSync[removed.target] = { ...(providerSync[removed.target] || {}), status: "manual_required", error: "Đã hủy bởi quản trị viên", lastSyncAt: now };
    const history = Array.isArray(booking.botTaskHistory) ? booking.botTaskHistory : [];
    const isSkip = body.action === "skip";
    return { ...booking, pendingSyncActions: pending.filter((task) => String(task.taskId) !== taskId), providerSync, syncStatus: "manual_required", botTaskHistory: [...history, { ...removed, status: isSkip ? "skipped" : "cancelled", error: isSkip ? "Đã bỏ qua bởi quản trị viên" : "Đã hủy bởi quản trị viên", updatedAt: now }].slice(-100), updatedAt: now };
  });
  if (!found) return Response.json({ ok: false, message: "Task không còn trong hàng đợi" }, { status: 404 });
  await save(next); return Response.json({ ok: true });
}
