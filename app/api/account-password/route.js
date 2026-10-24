import { staffSessionAccountId } from "../../../lib/serverAuth";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const OWNER = process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001";
const KV = "nail-japan-accounts-v1";
const SALT = "mai-beauty-salon-demo-v1";

async function hash(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${SALT}:${value}`));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request) {
  const accountId = staffSessionAccountId(request);
  if (!accountId) return Response.json({ ok: false, message: "Phiên đăng nhập nhân viên đã hết hạn." }, { status: 401 });
  const { currentPassword = "", newPassword = "" } = await request.json().catch(() => ({}));
  if (String(newPassword).length < 6) return Response.json({ ok: false, message: "Mật khẩu mới phải có ít nhất 6 ký tự." }, { status: 400 });
  if (!URL || !KEY) return Response.json({ ok: false, message: "Server chưa cấu hình Supabase." }, { status: 503 });
  const base = `${URL}/rest/v1/app_kv?owner_id=eq.${OWNER}&key=eq.${KV}&select=value&limit=1`;
  const response = await fetch(base, { cache: "no-store", headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
  const rows = await response.json().catch(() => []);
  const accounts = Array.isArray(rows?.[0]?.value) ? rows[0].value : [];
  const account = accounts.find((item) => item.id === accountId && ["manager", "staff"].includes(item.role));
  if (!account || account.passwordHash !== await hash(currentPassword)) return Response.json({ ok: false, message: "Mật khẩu hiện tại không đúng." }, { status: 403 });
  const newHash = await hash(newPassword);
  const next = accounts.map((item) => item.id === accountId ? { ...item, passwordHash: newHash } : item);
  const saved = await fetch(`${URL}/rest/v1/app_kv?on_conflict=owner_id,key`, { method: "POST", headers: { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json", prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify([{ owner_id: OWNER, key: KV, value: next, updated_at: new Date().toISOString() }]) });
  if (!saved.ok) return Response.json({ ok: false, message: "Không thể lưu mật khẩu lên server." }, { status: 503 });
  return Response.json({ ok: true });
}
