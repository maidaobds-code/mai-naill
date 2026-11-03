import { acknowledgeProviderSync, ingestExternalBooking } from "../../../lib/bookingSync.js";
import { createBookingAssignmentToken } from "../../../lib/bookingAssignmentToken.js";
import { managementEmails, sendEmail } from "../../../lib/serverEmail.js";

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
    const tasks = bookings.flatMap((booking) => (Array.isArray(booking.pendingSyncActions) ? booking.pendingSyncActions : []).filter((action) => action.target === provider).map((action) => ({ ...action, booking: { id: booking.id, date: booking.date, start: booking.start, end: booking.end, staffId: booking.staffId, staff: booking.staff, status: booking.status } })));
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

export async function POST(request) {
  if (!authorized(request)) return Response.json({ ok: false, message: "Unauthorized sync worker" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const current = await readBookings();
    const outcome = body.kind === "ack" ? acknowledgeProviderSync(current, body) : ingestExternalBooking(current, body);
    const value = await saveBookings(outcome.bookings);
    const notification = outcome.conflicts ? await notifyConflict(request, outcome.conflicts).catch((error) => ({ ok: false, reason: error.message })) : null;
    return Response.json({ ok: true, conflict: Boolean(outcome.conflicts), value, result: outcome.result, conflicts: outcome.conflicts || [], tasks: outcome.tasks || [], notification });
  } catch (error) {
    return Response.json({ ok: false, message: error.message || "Booking synchronization failed" }, { status: 400 });
  }
}

