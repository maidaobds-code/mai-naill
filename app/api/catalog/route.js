const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CATALOG_OWNER_ID = process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001";

const keys = {
  products: "nail-japan-products",
  services: "nail-japan-services",
  "nail-japan-products": "nail-japan-products",
  "nail-japan-services": "nail-japan-services",
};

function catalogKey(value) {
  return keys[String(value || "").trim()] || "";
}

async function adminSessionToken() {
  const adminUser = process.env.ADMIN_USER || "";
  const adminPass = process.env.ADMIN_PASS || "";
  if (!adminUser || !adminPass) return "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${adminUser}:${adminPass}`));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hasAdminCookie(request) {
  const cookie = request.headers.get("cookie") || "";
  const token = cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith("nail_admin_session="))?.split("=")[1] || "";
  return token && token === await adminSessionToken();
}

async function supabaseRest(path, options = {}, service = false) {
  const token = service ? SERVICE_ROLE_KEY : ANON_KEY;
  if (!SUPABASE_URL || !ANON_KEY || !token) throw new Error("Supabase catalog env is missing");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: token,
      authorization: `Bearer ${token}`,
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
  const { searchParams } = new URL(request.url);
  const key = catalogKey(searchParams.get("key"));
  if (!key) return Response.json({ ok: false, message: "Invalid catalog key", value: [] }, { status: 400 });

  try {
    const rows = await supabaseRest(`app_kv?key=eq.${encodeURIComponent(key)}&select=value,updated_at&order=updated_at.desc&limit=1`, {}, Boolean(SERVICE_ROLE_KEY));
    return Response.json({ ok: true, value: rows?.[0]?.value || [] });
  } catch (error) {
    return Response.json({ ok: false, message: error.message, value: [] }, { status: 200 });
  }
}

export async function POST(request) {
  if (!await hasAdminCookie(request)) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  if (!SERVICE_ROLE_KEY) return Response.json({ ok: false, message: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const key = catalogKey(body.key);
  const value = Array.isArray(body.value) ? body.value : null;
  if (!key || !value) return Response.json({ ok: false, message: "Invalid catalog payload" }, { status: 400 });

  try {
    const rows = await supabaseRest("app_kv?on_conflict=owner_id,key", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([{ owner_id: CATALOG_OWNER_ID, key, value, updated_at: new Date().toISOString() }]),
    }, true);
    return Response.json({ ok: true, value: rows?.[0]?.value || value });
  } catch (error) {
    return Response.json({ ok: false, message: error.message }, { status: 500 });
  }
}
