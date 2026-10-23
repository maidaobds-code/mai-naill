import { isAdminRequest as adminRequest, isOwnerRequest } from "../../../lib/serverAuth";

function isAdminRequest(request) {
  return adminRequest(request) || isOwnerRequest(request);
}

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
  if (!isAdminRequest(request)) return Response.json({ ok: false, message: "Phiên chủ quán không hợp lệ. Hãy đăng nhập lại bằng ADMIN_USER." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const account = body?.account;
  const fullValue = Array.isArray(body?.value) ? body.value : null;
  if (!fullValue && (!account?.id || !account?.email || account.role !== "staff" || !account.passwordHash)) return Response.json({ ok: false, message: "Dữ liệu tài khoản nhân viên không hợp lệ" }, { status: 400 });
  try {
    const rows = await rest(`app_kv?owner_id=eq.${OWNER}&key=eq.${KV}&select=value&limit=1`);
    const current = Array.isArray(rows?.[0]?.value) ? rows[0].value : [];
    let value;
    if (fullValue) {
      const byId = new Map(current.map((item) => [item.id, item]));
      for (const item of fullValue) {
        if (!item?.id || !item?.email) continue;
        const previous = byId.get(item.id);
        byId.set(item.id, { ...previous, ...item, passwordHash: item.passwordHash || previous?.passwordHash || "", email: item.email.trim().toLowerCase() });
      }
      value = [...byId.values()];
    } else {
      const email = account.email.trim().toLowerCase();
      value = [...current.filter((item) => item?.id !== account.id && item?.email?.trim().toLowerCase() !== email), { ...account, email }];
    }
    await rest("app_kv?on_conflict=owner_id,key", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ owner_id: OWNER, key: KV, value, updated_at: new Date().toISOString() }]) });
    return Response.json({ ok: true, value });
  } catch (error) { return Response.json({ ok: false, message: error.message }, { status: 500 }); }
}
