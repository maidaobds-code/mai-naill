import { verifyBookingCancellationToken } from "../../../lib/bookingAssignmentToken.js";
import { overallSyncStatus, providerSyncState } from "../../../lib/bookingSync.js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const OWNER_ID = String(process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001").trim().replace(/^['\"]|['\"]$/g, "");

async function rows() { const response = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?owner_id=eq.${OWNER_ID}&key=eq.nail-japan-bookings&select=value&limit=1`, { cache: "no-store", headers: { apikey: KEY, authorization: `Bearer ${KEY}` } }); return response.json(); }
export async function GET(request) { const claim = verifyBookingCancellationToken(new URL(request.url).searchParams.get("token")); if (!claim) return Response.json({ ok: false, message: "Liên kết hủy không hợp lệ hoặc đã hết hạn." }, { status: 401 }); const data = await rows(); const booking = data?.[0]?.value?.find((item) => String(item.id) === String(claim.bookingId) && !item.deletedAt); return booking ? Response.json({ ok: true, booking: { customer: booking.customer, date: booking.date, start: booking.start, end: booking.end, service: booking.service, status: booking.status } }) : Response.json({ ok: false, message: "Không tìm thấy lịch hẹn." }, { status: 404 }); }
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const claim = verifyBookingCancellationToken(body.token);
  if (!claim) return Response.json({ ok: false, message: "Liên kết hủy không hợp lệ hoặc đã hết hạn." }, { status: 401 });
  const data = await rows();
  const list = Array.isArray(data?.[0]?.value) ? data[0].value : [];
  const target = list.find((item) => String(item.id) === String(claim.bookingId) && !item.deletedAt);
  if (!target) return Response.json({ ok: false, message: "Không tìm thấy lịch hẹn." }, { status: 404 });
  const source = String(target.source || "direct").toLowerCase();
  const providers = ["hotpepper", "nailie"].filter((provider) => source === "direct" || provider !== source);
  const match = { date: target.date, start: target.start, end: target.end, staffId: target.staffId || "", staff: target.staff || "" };
  const pendingSyncActions = providers.map((provider) => ({ target: provider, action: "cancel", bookingId: target.id, externalBookingId: target.providerSync?.[provider]?.externalBookingId || "", match }));
  const next = list.map((item) => {
    if (String(item.id) !== String(claim.bookingId)) return item;
    const providerSync = providerSyncState(item);
    for (const provider of providers) providerSync[provider] = { ...providerSync[provider], status: "pending", error: "" };
    return { ...item, status: "cancelled", cancelledBy: "customer", cancelledAt: new Date().toISOString(), providerSync, syncStatus: overallSyncStatus(providerSync), pendingSyncActions };
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?on_conflict=owner_id,key`, { method: "POST", headers: { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json", prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ owner_id: OWNER_ID, key: "nail-japan-bookings", value: next, updated_at: new Date().toISOString() }]) });
  if (!response.ok) return Response.json({ ok: false, message: "Không thể hủy lịch hẹn." }, { status: 500 });
  return Response.json({ ok: true, syncTasks: pendingSyncActions });
}
