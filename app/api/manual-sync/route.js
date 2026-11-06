import { createHash } from "node:crypto";
import { isAdminRequest, isOwnerRequest } from "../../../lib/serverAuth.js";
import { salonSettings, serviceCatalog, staffCatalog } from "../../../lib/serverEmail.js";
import { nailieCapacityTask } from "../../../lib/salonCapacity.js";
import { syncTaskId } from "../../../lib/bookingSync.js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const OWNER = String(process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001").trim().replace(/^['\"]|['\"]$/g, "");
const BOOKINGS_KEY = "nail-japan-bookings";

async function rest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, cache: "no-store", headers: { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

function taskRecord(task, slot, staff = {}) {
  const fingerprint = [task.target, task.lockOwner || "", slot.date, slot.start, slot.end, staff.id || staff.name || "salon"].join("|");
  const id = `manual-sync-${createHash("sha256").update(fingerprint).digest("hex").slice(0, 24)}`;
  const identified = { ...task, bookingId: id, taskId: syncTaskId({ ...task, bookingId: id }) };
  return { id, source: "manual_sync", manualOnly: true, deletedAt: new Date().toISOString(), status: "MANUAL_SYNC", date: slot.date, start: slot.start, end: slot.end, staffId: staff.id || "", staff: staff.name || "", pendingSyncActions: [identified] };
}

function overlaps(left, right) {
  return left?.date === right?.date && String(left?.start || "") < String(right?.end || "") && String(left?.end || "") > String(right?.start || "");
}

export async function POST(request) {
  if (!isAdminRequest(request) && !isOwnerRequest(request)) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const slot = { date: String(body.date || ""), start: String(body.start || ""), end: String(body.end || "") };
  const scope = body.scope === "salon" ? "salon" : "staff";
  const operation = body.operation === "open" ? "open" : "close";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.date) || !/^\d{2}:\d{2}$/.test(slot.start) || !/^\d{2}:\d{2}$/.test(slot.end)) return Response.json({ ok: false, message: "Invalid slot" }, { status: 400 });
  try {
    const [rows, staff, settings, services] = await Promise.all([
      rest(`app_kv?owner_id=eq.${OWNER}&key=eq.${BOOKINGS_KEY}&select=value&limit=1`),
      staffCatalog(),
      salonSettings(),
      serviceCatalog(),
    ]);
    const bookings = Array.isArray(rows?.[0]?.value) ? rows[0].value : [];
    const selected = scope === "salon" ? staff : staff.filter((member) => String(member.id) === String(body.staffId) || member.name === body.staff);
    if (scope === "staff" && !selected.length) return Response.json({ ok: false, message: "Staff not found" }, { status: 404 });
    const records = selected.flatMap((member) => {
      const occupied = operation === "close" && bookings.some((booking) => !booking.deletedAt && booking.staffId && String(booking.staffId) === String(member.id) && overlaps(booking, slot));
      return occupied ? [] : [taskRecord({ target: "hotpepper", action: operation === "close" ? "block" : "cancel", match: { ...slot, staffId: member.id, staff: member.name } }, slot, member)];
    });
    if (scope === "salon") {
      const lockOwner = `manual:salon:${slot.date}:${slot.start}:${slot.end}`;
      records.push(taskRecord({ target: "nailie", action: operation === "close" ? "capacity_block" : "capacity_unblock", lockOwner, match: slot }, slot));
      if (operation === "open") records.push(taskRecord(nailieCapacityTask(slot, bookings, staff, settings, "capacity-recheck", services), slot));
    } else {
      records.push(taskRecord(nailieCapacityTask(slot, bookings, staff, settings, "capacity-recheck", services), slot));
    }
    const byId = new Map(bookings.map((booking) => [String(booking.id), booking]));
    for (const record of records) byId.set(record.id, record);
    await rest("app_kv?on_conflict=owner_id,key", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ owner_id: OWNER, key: BOOKINGS_KEY, value: [...byId.values()], updated_at: new Date().toISOString() }]) });
    return Response.json({ ok: true, tasks: records.flatMap((record) => record.pendingSyncActions) });
  } catch (error) {
    return Response.json({ ok: false, message: error.message || "Cannot queue manual sync" }, { status: 500 });
  }
}
