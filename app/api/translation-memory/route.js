import { isAdminRequest, isOwnerRequest, isStaffRequest } from "../../../lib/serverAuth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const OWNER_ID = String(process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001").trim();
const KEY = "nail-japan-translation-memory-v1";
const LANGUAGES = ["VI", "JA", "EN", "ZH", "KO"];

async function rest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}`, "content-type": "application/json", ...(options.headers || {}) } });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function readMemory() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return { entries: {}, lastCheckedAt: null };
  const rows = await rest(`app_kv?owner_id=eq.${encodeURIComponent(OWNER_ID)}&key=eq.${KEY}&select=value&limit=1`);
  return rows?.[0]?.value && typeof rows[0].value === "object" ? rows[0].value : { entries: {}, lastCheckedAt: null };
}

async function saveMemory(value) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return;
  await rest("app_kv?on_conflict=owner_id,key", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ owner_id: OWNER_ID, key: KEY, value, updated_at: new Date().toISOString() }]) });
}

export async function POST(request) {
  if (!isAdminRequest(request) && !isOwnerRequest(request) && !isStaffRequest(request)) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items : [{ text: body.text, targets: body.targets }];
  const memory = await readMemory();
  const entries = memory.entries && typeof memory.entries === "object" ? memory.entries : {};
  const missing = [];
  const result = {};
  for (const item of items) {
    const text = String(item?.text || "").trim();
    if (!text) continue;
    const targets = (Array.isArray(item?.targets) ? item.targets : LANGUAGES).filter((lang) => LANGUAGES.includes(lang));
    const key = text.toLocaleLowerCase();
    result[text] = {};
    for (const target of targets) {
      if (entries[key]?.[target]) result[text][target] = entries[key][target];
      else missing.push({ text, target, key });
    }
  }
  if (missing.length) {
    const apiKey = process.env.DEEPL_API_KEY;
    if (!apiKey) return Response.json({ ok: false, message: "DeepL API key is not configured", translations: result }, { status: 503 });
    for (const item of missing) {
      const response = await fetch("https://api-free.deepl.com/v2/translate", { method: "POST", headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ text: [item.text], target_lang: item.target }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return Response.json({ ok: false, message: data.message || "Translation failed", translations: result }, { status: 502 });
      const translated = data.translations?.[0]?.text || item.text;
      entries[item.key] = { ...(entries[item.key] || {}), [item.target]: translated, source: item.text };
      result[item.text][item.target] = translated;
    }
  }
  await saveMemory({ entries, lastCheckedAt: new Date().toISOString() });
  return Response.json({ ok: true, translations: result, cached: missing.length === 0, lastCheckedAt: new Date().toISOString() });
}
