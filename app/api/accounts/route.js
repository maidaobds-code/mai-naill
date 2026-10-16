import { isAdminRequest } from "../../../lib/serverAuth";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const OWNER = process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001";
const KV = "nail-japan-accounts-v1";

async function rest(path, options = {}) {
  if (!URL || !KEY) throw new Error("Supabase server configuration is missing");
  const response = await fetch(`${URL}/rest/v1/${path}`, { ...options, cache: "no-store", headers: { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

export async function GET(request) {
  if (!isAdminRequest(request)) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  try {
    const rows = await rest(`app_kv?owner_id=eq.${OWNER}&key=eq.${KV}&select=value&limit=1`);
    return Response.json({ ok: true, value: Array.isArray(rows?.[0]?.value) ? rows[0].value : [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ ok: false, message: error.message, value: [] }, { status: 500 }); }
}

export async function POST(request) {
  if (!isAdminRequest(request)) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.value)) return Response.json({ ok: false, message: "Invalid accounts" }, { status: 400 });
  try {
    await rest("app_kv?on_conflict=owner_id,key", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ owner_id: OWNER, key: KV, value: body.value, updated_at: new Date().toISOString() }]) });
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ ok: false, message: error.message }, { status: 500 }); }
}
