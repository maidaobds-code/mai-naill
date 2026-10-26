const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const OWNER_ID = process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001";

function validEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return email.includes("@") && !email.endsWith(".local") ? email : "";
}

async function appKv(keys) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return [];
  const response = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?owner_id=eq.${encodeURIComponent(OWNER_ID)}&key=in.(${keys.join(",")})&select=key,value`, {
    cache: "no-store",
    headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!response.ok) return [];
  return response.json();
}

export async function managementEmails() {
  const emails = [validEmail(process.env.OWNER_EMAIL)];
  const rows = await appKv(["nail-japan-settings", "nail-japan-accounts-v1"]);
  const settings = rows.find((row) => row.key === "nail-japan-settings")?.value;
  const accounts = rows.find((row) => row.key === "nail-japan-accounts-v1")?.value;
  emails.push(validEmail(settings?.email));
  if (Array.isArray(accounts)) {
    emails.push(...accounts.filter((account) => ["owner", "manager", "admin"].includes(account.role)).map((account) => validEmail(account.email)));
  }
  return [...new Set(emails.filter(Boolean))];
}

export async function staffCatalog() {
  const rows = await appKv(["nail-japan-staff", "nail-japan-accounts-v1"]);
  const staff = rows.find((row) => row.key === "nail-japan-staff")?.value;
  const accounts = rows.find((row) => row.key === "nail-japan-accounts-v1")?.value;
  return (Array.isArray(staff) ? staff : []).map((member) => {
    const account = Array.isArray(accounts) ? accounts.find((item) => item.staffName === member.name || item.name === member.name || String(item.id) === String(member.accountId)) : null;
    return { ...member, email: validEmail(member.email || account?.email) };
  });
}

export async function salonSettings() {
  const rows = await appKv(["nail-japan-settings"]);
  return rows.find((row) => row.key === "nail-japan-settings")?.value || {};
}

export async function sendEmail({ to, subject, html, text = "" }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, skipped: true, reason: "RESEND_API_KEY is not configured" };
  const recipients = [...new Set((Array.isArray(to) ? to : [to]).map(validEmail).filter(Boolean))];
  if (!recipients.length) return { ok: false, skipped: true, reason: "No valid email recipients are configured" };
  const from = process.env.RESEND_FROM || process.env.EMAIL_FROM || "Mai Beauty Salon <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: recipients, subject, html, ...(text ? { text } : {}) }),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, ...data };
}
