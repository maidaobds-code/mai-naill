const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const ORDERS_OWNER_ID = process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001";
const ORDERS_KEY = "nail-japan-store-orders";

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

export async function GET() {
  try {
    const rows = await supabaseRest(`app_kv?owner_id=eq.${ORDERS_OWNER_ID}&key=eq.${ORDERS_KEY}&select=value&limit=1`);
    return Response.json({ ok: true, value: Array.isArray(rows?.[0]?.value) ? rows[0].value : [] }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return Response.json({ ok: false, message: error.message, value: [] }, { status: 500 });
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (!Array.isArray(body.orders)) return Response.json({ ok: false, message: "Invalid orders" }, { status: 400 });
  try {
    const rows = await supabaseRest("app_kv?on_conflict=owner_id,key", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([{ owner_id: ORDERS_OWNER_ID, key: ORDERS_KEY, value: body.orders, updated_at: new Date().toISOString() }]),
    });
    return Response.json({ ok: true, value: rows?.[0]?.value || body.orders });
  } catch (error) {
    return Response.json({ ok: false, message: error.message }, { status: 500 });
  }
}
