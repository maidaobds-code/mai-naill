import { isAdminRequest, isOwnerRequest } from "../../../lib/serverAuth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const SETTINGS_OWNER_ID = String(process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001").trim().replace(/^['\"]|['\"]$/g, "");
const SETTINGS_KEY = "nail-japan-settings";

async function supabaseRest(path, options = {}) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Supabase server configuration is missing");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

export async function GET(request) {
  const publicBooking = new URL(request.url).searchParams.get("public") === "1";
  if (!isAdminRequest(request) && !isOwnerRequest(request) && !publicBooking) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  try {
    const rows = await supabaseRest(`app_kv?owner_id=eq.${SETTINGS_OWNER_ID}&key=eq.${SETTINGS_KEY}&select=value,updated_at&limit=1`);
    const value = rows?.[0]?.value || null;
    const safeValue = publicBooking && value ? Object.fromEntries(["salonName","branch","address","logoUrl","phone","openTime","closeTime","bookingNotice","bookingNoticeVi","bookingNoticeJa","bookingNoticeEn","bookingNoticeZh","bookingNoticeKo","closedPeriods","staffClosedPeriods","cancellationHours"].filter((key) => key in value).map((key) => [key, value[key]])) : value;
    return Response.json({ ok: true, value: safeValue }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return Response.json({ ok: false, message: error.message, value: null }, { status: 500 });
  }
}

export async function POST(request) {
  if (!isAdminRequest(request) && !isOwnerRequest(request)) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || Array.isArray(body) || typeof body !== "object") return Response.json({ ok: false, message: "Invalid settings" }, { status: 400 });
  try {
    const rows = await supabaseRest("app_kv?on_conflict=owner_id,key", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([{ owner_id: SETTINGS_OWNER_ID, key: SETTINGS_KEY, value: body, updated_at: new Date().toISOString() }]),
    });
    return Response.json({ ok: true, value: rows?.[0]?.value || body });
  } catch (error) {
    return Response.json({ ok: false, message: error.message }, { status: 500 });
  }
}

