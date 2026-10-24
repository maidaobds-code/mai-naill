const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const OWNER_ID = process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001";
const BOOKINGS_KEY = "nail-japan-bookings";

async function supabaseRest(path, options = {}) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Supabase server configuration is missing");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, cache: "no-store", headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}`, "content-type": "application/json", ...(options.headers || {}) } });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

export async function GET() {
  try {
    const rows = await supabaseRest(`app_kv?owner_id=eq.${OWNER_ID}&key=eq.${BOOKINGS_KEY}&select=value&limit=1`);
    return Response.json({ ok: true, value: Array.isArray(rows?.[0]?.value) ? rows[0].value : [] }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch { return Response.json({ ok: false, value: [], message: "Không thể đọc lịch hẹn." }, { status: 500 }); }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (!Array.isArray(body.bookings)) return Response.json({ ok: false, message: "Invalid bookings" }, { status: 400 });
  try {
    const currentRows = await supabaseRest(`app_kv?owner_id=eq.${OWNER_ID}&key=eq.${BOOKINGS_KEY}&select=value&limit=1`);
    const current = Array.isArray(currentRows?.[0]?.value) ? currentRows[0].value : [];
    const incomingIds = new Set(body.bookings.map((item) => item?.id).filter(Boolean));
    const merged = [...body.bookings, ...current.filter((item) => item?.id && !incomingIds.has(item.id))];
    const rows = await supabaseRest("app_kv?on_conflict=owner_id,key", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify([{ owner_id: OWNER_ID, key: BOOKINGS_KEY, value: merged, updated_at: new Date().toISOString() }]) });
    return Response.json({ ok: true, value: rows?.[0]?.value || merged });
  } catch { return Response.json({ ok: false, message: "Không thể lưu lịch hẹn." }, { status: 500 }); }
}
