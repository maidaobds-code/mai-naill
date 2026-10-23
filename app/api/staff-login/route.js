import { createStaffSession, staffCookie } from "../../../lib/serverAuth";

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
  const { email = "", password = "" } = await request.json().catch(() => ({}));
  if (!URL || !KEY) return Response.json({ ok: false, message: "Server chưa cấu hình Supabase." }, { status: 503 });
  if (!email || !password) return Response.json({ ok: false, message: "Vui lòng nhập email và mật khẩu." }, { status: 400 });
  const response = await fetch(`${URL}/rest/v1/app_kv?owner_id=eq.${OWNER}&key=eq.${KV}&select=value&limit=1`, { cache: "no-store", headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
  if (!response.ok) return Response.json({ ok: false, message: "Không thể đọc tài khoản từ Supabase." }, { status: 503 });
  const rows = await response.json().catch(() => []);
  const normalizedEmail = email.trim().toLowerCase();
  const account = rows?.[0]?.value?.find((item) => ["staff", "manager"].includes(item.role) && item.email?.trim().toLowerCase() === normalizedEmail);
  if (!account) return Response.json({ ok: false, code: "ACCOUNT_NOT_SYNCED", message: "Tài khoản nhân viên chưa được đồng bộ lên server." }, { status: 404 });
  if (!account.passwordHash) return Response.json({ ok: false, code: "PASSWORD_MISSING", message: "Tài khoản chưa có mật khẩu trên server." }, { status: 409 });
  if (!account?.passwordHash || account.passwordHash !== await hash(password)) return Response.json({ ok: false, message: "Sai email hoặc mật khẩu." }, { status: 401 });
  const { passwordHash, ...safe } = account;
  const result = Response.json({ ok: true, account: safe });
  result.headers.set("Set-Cookie", staffCookie(createStaffSession(account.id)));
  return result;
}
