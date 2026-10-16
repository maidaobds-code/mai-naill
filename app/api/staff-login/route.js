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
  if (!URL || !KEY || !email || !password) return Response.json({ ok: false }, { status: 401 });
  const response = await fetch(`${URL}/rest/v1/app_kv?owner_id=eq.${OWNER}&key=eq.${KV}&select=value&limit=1`, { cache: "no-store", headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
  const rows = await response.json().catch(() => []);
  const account = rows?.[0]?.value?.find((item) => item.role === "staff" && item.email?.toLowerCase() === email.trim().toLowerCase());
  if (!account?.passwordHash || account.passwordHash !== await hash(password)) return Response.json({ ok: false, message: "Sai email hoặc mật khẩu." }, { status: 401 });
  const { passwordHash, ...safe } = account;
  return Response.json({ ok: true, account: safe });
}
