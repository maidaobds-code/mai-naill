const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && ANON_KEY);
}

export function publicStorageUrl(url) {
  if (!url || typeof url !== "string") return url;
  const marker = "/storage/v1/object/sign/mai-beauty-assets/";
  const index = url.indexOf(marker);
  if (index < 0) return url;
  const path = url.slice(index + marker.length).split("?")[0];
  return `${SUPABASE_URL}/storage/v1/object/public/mai-beauty-assets/${path}`;
}

export function signInWithGoogle() {
  if (!hasSupabaseConfig() || typeof window === "undefined") return false;
  const redirectTo = encodeURIComponent(window.location.origin);
  window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`;
  return true;
}

function authStorageKey() {
  try {
    const host = new URL(SUPABASE_URL).host;
    const projectRef = host.split(".")[0];
    return `sb-${projectRef}-auth-token`;
  } catch {
    return "sb-auth-token";
  }
}

function oauthParams() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  for (const [key, value] of new URLSearchParams(window.location.search)) params.set(key, value);
  return params.has("access_token") || params.has("code") || params.has("error") ? params : null;
}

async function userFromAccessToken(accessToken) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function sessionFromCode(code) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=authorization_code`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "content-type": "application/json" },
    body: JSON.stringify({ auth_code: code }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

function cleanOAuthUrl() {
  if (typeof window === "undefined") return;
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search.replace(/[?&](code|error|error_code|error_description)=[^&]*/g, "").replace(/^&/, "?"));
}

export async function consumeOAuthRedirect() {
  if (!hasSupabaseConfig() || typeof window === "undefined") return null;
  const params = oauthParams();
  if (!params) return authSession();
  if (params.has("error")) {
    cleanOAuthUrl();
    throw new Error(params.get("error_description") || params.get("error") || "Google OAuth failed");
  }

  let session = null;
  if (params.has("access_token")) {
    const accessToken = params.get("access_token");
    session = {
      access_token: accessToken,
      refresh_token: params.get("refresh_token") || "",
      expires_in: Number(params.get("expires_in") || 3600),
      expires_at: Math.floor(Date.now() / 1000) + Number(params.get("expires_in") || 3600),
      token_type: params.get("token_type") || "bearer",
      user: await userFromAccessToken(accessToken),
    };
  } else if (params.has("code")) {
    session = await sessionFromCode(params.get("code"));
  }

  if (session?.access_token) {
    window.localStorage.setItem(authStorageKey(), JSON.stringify(session));
    cleanOAuthUrl();
    return session;
  }
  return authSession();
}

export function authSession() {
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

export function googleProfileFromSession() {
  const user = authSession()?.user;
  if (!user?.email) return null;
  const meta = user.user_metadata || {};
  return {
    id: user.id || user.email,
    email: user.email,
    name: meta.full_name || meta.name || user.email.split("@")[0],
    avatarUrl: meta.avatar_url || meta.picture || "",
  };
}

export function signOutSupabase() {
  if (typeof window === "undefined") return;
  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith("sb-") && key.endsWith("-auth-token")) window.localStorage.removeItem(key);
  }
}

export function supabaseReady() {
  return hasSupabaseConfig() && Boolean(authSession()?.access_token);
}

function authError(data, fallback) { return data?.msg || data?.message || data?.error_description || data?.error || fallback; }

export async function signUpWithSupabase({ email, password, name, phone, redirectTo }) {
  if (!hasSupabaseConfig()) throw new Error("Supabase Auth chưa được cấu hình.");
  const target = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : "";
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup${target}`, { method: "POST", headers: { apikey: ANON_KEY, "content-type": "application/json" }, body: JSON.stringify({ email, password, data: { name, phone } }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${authError(data, "Không thể tạo tài khoản Supabase.")} [HTTP ${response.status}]`);
  return data;
}

export async function resendSignupEmail(email, redirectTo) {
  if (!hasSupabaseConfig()) throw new Error("Supabase Auth chưa được cấu hình.");
  const target = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : "";
  const response = await fetch(`${SUPABASE_URL}/auth/v1/resend${target}`, { method: "POST", headers: { apikey: ANON_KEY, "content-type": "application/json" }, body: JSON.stringify({ type: "signup", email }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(authError(data, "Không thể gửi lại email xác nhận."));
  return data;
}

export async function signInWithPassword(email, password) {
  if (!hasSupabaseConfig()) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON_KEY, "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(authError(data, "Email hoặc mật khẩu không đúng."));
  if (data.access_token) window.localStorage.setItem(authStorageKey(), JSON.stringify(data));
  return data;
}

export async function verifySignupToken(token, type = "signup") {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, { method: "POST", headers: { apikey: ANON_KEY, "content-type": "application/json" }, body: JSON.stringify({ token, type }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(authError(data, "Liên kết xác nhận không hợp lệ hoặc đã hết hạn."));
  if (data.access_token) window.localStorage.setItem(authStorageKey(), JSON.stringify(data));
  return data;
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

async function publicRest(path, options = {}) {
  if (!hasSupabaseConfig()) throw new Error("Supabase config is missing");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: ANON_KEY,
      authorization: `Bearer ${ANON_KEY}`,
      "content-type": "application/json",
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

export async function getPublicKv(key) {
  const rows = await publicRest(`app_kv?key=eq.${encodeURIComponent(key)}&select=value&limit=1`);
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
  // QR images are displayed on the public shop/booking pages, so store a
  // stable public URL instead of a short-lived signed URL.
  return `${SUPABASE_URL}/storage/v1/object/public/mai-beauty-assets/${path}`;
}
