import { isAdminRequest, isOwnerRequest, isStaffRequest } from "../../../lib/serverAuth.js";
import { legacySampleStaff } from "../../../lib/salonData.js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const OWNER = String(process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001").trim().replace(/^['\"]|['\"]$/g, "");
const KV = "nail-japan-staff";
const ACCOUNTS_KV = "nail-japan-accounts-v1";
const STAFF_COLORS = ["#7c3aed", "#ec4899", "#0ea5e9", "#10b981", "#f97316", "#06b6d4", "#e879f9", "#84cc16"];

function authorized(request) { return isAdminRequest(request) || isOwnerRequest(request) || isStaffRequest(request); }
function isLegacySample(value) { return Array.isArray(value) && value.length > 0 && value.every((member) => legacySampleStaff.some((sample) => String(member?.id) === String(sample.id) && member?.name === sample.name && member?.role === sample.role && member?.color === sample.color && member?.external?.hotpepper === sample.external.hotpepper && member?.external?.nailie === sample.external.nailie && member?.external?.minimo === sample.external.minimo)); }
function staffFromAccounts(accounts) {
  return (Array.isArray(accounts) ? accounts : []).filter((account) => ["owner", "manager", "staff"].includes(account?.role) && account?.name && !(account.id === "owner" && account.email === "owner@salon.local" && !account.passwordHash)).map((account, index) => ({
    id: String(account.id || `account-${index + 1}`).replace(/^staff-/, ""),
    name: account.staffName || account.name,
    displayName: account.staffName || account.name,
    role: account.role,
    email: account.email || "",
    phone: account.phone || "",
    status: "Working",
    color: STAFF_COLORS[index % STAFF_COLORS.length],
    external: {},
    bookingVisible: true,
    designationFee: 1100,
    bookingDescription: "",
    avatarUrl: account.avatarUrl || "",
    avatarFileName: "",
  }));
}

async function rest(path, options = {}) {
  if (!SUPABASE_URL || !KEY) throw new Error("Supabase server configuration is missing");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, cache: "no-store", headers: { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

export async function GET(request) {
  const isPublicBookingRequest = new URL(request.url).searchParams.get("public") === "1";
  if (!authorized(request) && !isPublicBookingRequest) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  try {
    const rows = await rest(`app_kv?owner_id=eq.${OWNER}&key=eq.${KV}&select=value&limit=1`);
    let value = Array.isArray(rows?.[0]?.value) ? rows[0].value : null;
    if (isLegacySample(value)) {
      value = [];
      await rest("app_kv?on_conflict=owner_id,key", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ owner_id: OWNER, key: KV, value, updated_at: new Date().toISOString() }]) });
    }
    if (Array.isArray(value) && value.length === 0) {
      const accountRows = await rest(`app_kv?owner_id=eq.${OWNER}&key=eq.${ACCOUNTS_KV}&select=value&limit=1`);
      const restored = staffFromAccounts(accountRows?.[0]?.value);
      if (restored.length) {
        value = restored;
        await rest("app_kv?on_conflict=owner_id,key", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ owner_id: OWNER, key: KV, value, updated_at: new Date().toISOString() }]) });
      }
    }
    const safeValue = isPublicBookingRequest && !authorized(request) && Array.isArray(value) ? value.filter((member) => member.bookingVisible !== false).map(({ email, phone, accountPassword, ...member }) => member) : value;
    return Response.json({ ok: true, value: safeValue }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ ok: false, value: [], message: "Không thể đọc danh sách nhân viên." }, { status: 500 }); }
}

export async function POST(request) {
  if (!isAdminRequest(request) && !isOwnerRequest(request)) return Response.json({ ok: false, message: "Chỉ chủ quán được cập nhật danh sách nhân viên." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.value)) return Response.json({ ok: false, message: "Invalid staff list" }, { status: 400 });
  const value = body.value.map(({ accountPassword, ...member }) => member);
  try {
    await rest("app_kv?on_conflict=owner_id,key", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ owner_id: OWNER, key: KV, value, updated_at: new Date().toISOString() }]) });
    return Response.json({ ok: true, value });
  } catch { return Response.json({ ok: false, message: "Không thể lưu danh sách nhân viên." }, { status: 500 }); }
}
