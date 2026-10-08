const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && ANON_KEY);
}

function authSession() {
  if (typeof window === "undefined") return null;
  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
      try {
        const raw = JSON.parse(window.localStorage.getItem(key));
        const session = Array.isArray(raw) ? raw[0] : raw;
        if (session?.access_token) return session;
      } catch {}
    }
  }
  return null;
}

export function supabaseReady() {
  return hasSupabaseConfig() && Boolean(authSession()?.access_token);
}

async function rest(path, options = {}) {
  const session = authSession();
  if (!hasSupabaseConfig() || !session?.access_token) throw new Error("Supabase auth session is missing");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: ANON_KEY,
      authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
      prefer: "return=representation",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

export async function getKv(key) {
  const rows = await rest(`app_kv?key=eq.${encodeURIComponent(key)}&select=value&limit=1`);
  return rows?.[0]?.value ?? null;
}

export async function saveKv(key, value) {
  const rows = await rest("app_kv?on_conflict=owner_id,key", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
  });
  return rows?.[0]?.value ?? value;
}

function dataUrlToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*);base64/)?.[1] || "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { blob: new Blob([bytes], { type: mime }), mime };
}

async function signedUrl(path) {
  const session = authSession();
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/mai-beauty-assets/${path}`, {
    method: "POST",
    headers: { apikey: ANON_KEY, authorization: `Bearer ${session.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 7 }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return `${SUPABASE_URL}/storage/v1${data.signedURL}`;
}

export async function uploadDataUrl(dataUrl, ownerKey, fileName = "image") {
  if (!dataUrl?.startsWith("data:")) return dataUrl;
  const session = authSession();
  if (!session?.user?.id) throw new Error("Supabase user id is missing");
  const { blob, mime } = dataUrlToBlob(dataUrl);
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${session.user.id}/${ownerKey}/${Date.now()}-${safeName}`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/mai-beauty-assets/${path}`, {
    method: "POST",
    headers: { apikey: ANON_KEY, authorization: `Bearer ${session.access_token}`, "content-type": mime, "x-upsert": "true" },
    body: blob,
  });
  if (!response.ok) throw new Error(await response.text());
  return signedUrl(path);
}
