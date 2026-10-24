import { isAdminRequest, isOwnerRequest, isStaffRequest } from "../../../lib/serverAuth";

const LANGUAGES = ["VI", "JA", "EN", "ZH", "KO"];

export async function POST(request) {
  if (!isAdminRequest(request) && !isOwnerRequest(request) && !isStaffRequest(request)) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return Response.json({ ok: false, message: "DeepL API key is not configured" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || "").trim();
  if (!text) return Response.json({ ok: true, translations: {} });
  const targets = (Array.isArray(body.targets) ? body.targets : LANGUAGES).filter((language) => LANGUAGES.includes(language));
  try {
    const results = await Promise.all(targets.map(async (target_lang) => {
      const response = await fetch("https://api-free.deepl.com/v2/translate", { method: "POST", headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ text: [text], target_lang }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Translation failed");
      return [target_lang, data.translations?.[0]?.text || text];
    }));
    return Response.json({ ok: true, translations: Object.fromEntries(results) });
  } catch (error) {
    return Response.json({ ok: false, message: error.message || "Translation failed" }, { status: 502 });
  }
}
