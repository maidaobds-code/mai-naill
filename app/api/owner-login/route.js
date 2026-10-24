import { createOwnerSession, ownerCookie } from "../../../lib/serverAuth";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const OWNER = String(process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001").trim().replace(/^['\"]|['\"]$/g, "");
const KV = "nail-japan-accounts-v1";
const SALT = "mai-beauty-salon-demo-v1";

async function hash(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${SALT}:${value}`));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request) {
  const { email = "", password = "" } = await request.json().catch(() => ({}));
  if (!URL || !KEY) return Response.json({ ok: false, message: "Server chưa cấu hình Supabase." }, { status: 503 });
  const response = await fetch(`${URL}/rest/v1/app_kv?owner_id=eq.${OWNER}&key=eq.${KV}&select=value&limit=1`, { cache: "no-store", headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
  if (!response.ok) return Response.json({ ok: false, message: "Không thể tải tài khoản chủ quán." }, { status: 503 });
  const rows = await response.json().catch(() => []);
  const account = rows?.[0]?.value?.find((item) => item.role === "owner" && item.email?.trim().toLowerCase() === email.trim().toLowerCase());
  if (!account) return Response.json({ ok: false, message: "Không tìm thấy tài khoản chủ quán trên server." }, { status: 404 });
  if (!account.passwordHash || account.passwordHash !== await hash(password)) return Response.json({ ok: false, message: "Sai email hoặc mật khẩu chủ quán." }, { status: 401 });
  const { passwordHash, ...safe } = account;
  const result = Response.json({ ok: true, account: safe });
  result.headers.set("Set-Cookie", ownerCookie(createOwnerSession(account.id)));
  return result;
}
