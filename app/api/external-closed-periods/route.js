import { salonSettings, staffCatalog } from "../../../lib/serverEmail.js";
import { isAutomationRequest } from "../../../lib/automationAuth.js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const OWNER_ID = String(process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001").trim().replace(/^['\"]|['\"]$/g, "");
const SETTINGS_KEY = "nail-japan-settings";

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function validTime(value) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));
}

function timeMinutes(value) {
  const [hour, minute] = String(value).split(":").map(Number);
  return hour * 60 + minute;
}

async function saveSettings(value) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Supabase server configuration is missing");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?on_conflict=owner_id,key`, {
    method: "POST",
    cache: "no-store",
    headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}`, "content-type": "application/json", prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([{ owner_id: OWNER_ID, key: SETTINGS_KEY, value, updated_at: new Date().toISOString() }]),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data?.[0]?.value || value;
}

export async function POST(request) {
  if (!isAutomationRequest(request)) return Response.json({ ok: false, message: "Unauthorized sync worker" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const date = String(body.date || "");
  if (!validDate(date) || !Array.isArray(body.periods)) return Response.json({ ok: false, message: "Invalid closed-period scan" }, { status: 400 });

  try {
    const [settings, staff] = await Promise.all([salonSettings(), staffCatalog()]);
    const canonical = [];
    for (const period of body.periods) {
      const start = String(period?.start || "");
      const end = String(period?.end || "");
      if (!validTime(start) || !validTime(end) || timeMinutes(start) >= timeMinutes(end)) continue;
      const requestedId = String(period?.staffId || "").trim();
      const requestedName = String(period?.staff || "").trim().toLowerCase();
      const member = staff.find((item) => (requestedId && String(item.id) === requestedId) || (requestedName && String(item.name || "").trim().toLowerCase() === requestedName));
      if (!member?.id) continue;
      canonical.push(`${member.id} ${date} ${start}-${end}`);
    }

    const previousManaged = Array.isArray(settings.hotpepperClosedPeriods) ? settings.hotpepperClosedPeriods.map(String) : [];
    const previousForDate = new Set(previousManaged.filter((value) => value.includes(` ${date} `)));
    const retainedClosed = (Array.isArray(settings.staffClosedPeriods) ? settings.staffClosedPeriods.map(String) : []).filter((value) => !previousForDate.has(value));
    const retainedManaged = previousManaged.filter((value) => !previousForDate.has(value));
    const nextManaged = [...new Set([...retainedManaged, ...canonical])];
    const nextClosed = [...new Set([...retainedClosed, ...canonical])];
    const saved = await saveSettings({ ...settings, staffClosedPeriods: nextClosed, hotpepperClosedPeriods: nextManaged });
    return Response.json({ ok: true, date, imported: canonical.length, staffClosedPeriods: saved.staffClosedPeriods || nextClosed });
  } catch (error) {
    return Response.json({ ok: false, message: error.message || "Cannot synchronize closed periods" }, { status: 500 });
  }
}
