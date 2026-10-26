import { isAdminRequest, isOwnerRequest, isStaffRequest } from "../../../lib/serverAuth";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const OWNER = String(process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001").trim().replace(/^['\"]|['\"]$/g, "");
const KV = "nail-japan-staff";

function authorized(request) { return isAdminRequest(request) || isOwnerRequest(request) || isStaffRequest(request); }

async function rest(path, options = {}) {
  if (!URL || !KEY) throw new Error("Supabase server configuration is missing");
  const response = await fetch(`${URL}/rest/v1/${path}`, { ...options, cache: "no-store", headers: { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

export async function GET(request) {
  const isPublicBookingRequest = new URL(request.url).searchParams.get("public") === "1";
  if (!authorized(request) && !isPublicBookingRequest) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  try {
    const rows = await rest(`app_kv?owner_id=eq.${OWNER}&key=eq.${KV}&select=value&limit=1`);
    const value = Array.isArray(rows?.[0]?.value) ? rows[0].value : null;
    const safeValue = isPublicBookingRequest && !authorized(request) && Array.isArray(value) ? value.filter((member) => member.bookingVisible !== false).map(({ email, phone, accountPassword, ...member }) => member) : value;
    return Response.json({ ok: true, value: safeValue }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ ok: false, value: [], message: "Không thể đọc danh sách nhân viên." }, { status: 500 }); }
}

export async function POST(request) {
  if (!isAdminRequest(request) && !isOwnerRequest(request)) return Response.json({ ok: false, message: "Chỉ chủ quán được cập nhật danh sách nhân viên." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.value)) return Response.json({ ok: false, message: "Invalid staff list" }, { status: 400 });
  const value = body.value.map(({ accountPassword, ...member }) => member);
  try {
    await rest("app_kv?on_conflict=owner_id,key", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ owner_id: OWNER, key: KV, value, updated_at: new Date().toISOString() }]) });
    return Response.json({ ok: true, value });
  } catch { return Response.json({ ok: false, message: "Không thể lưu danh sách nhân viên." }, { status: 500 }); }
}
