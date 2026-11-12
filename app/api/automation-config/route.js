import { salonSettings, staffCatalog } from "../../../lib/serverEmail.js";
import { isAutomationRequest } from "../../../lib/automationAuth.js";

function firstMapping(member, platform) {
  const raw = member?.external?.[platform];
  const values = Array.isArray(raw) ? raw : [raw];
  return String(values.find((value) => String(value || "").trim()) || "").trim();
}

export async function GET(request) {
  if (!isAutomationRequest(request)) return Response.json({ ok: false, message: "Unauthorized automation client" }, { status: 401 });
  try {
    const [staff, settings] = await Promise.all([staffCatalog(), salonSettings()]);
    const mappings = staff.map((member) => {
      const hotpepper = firstMapping(member, "hotpepper");
      const nailie = firstMapping(member, "nailie");
      return { id: String(member.id), name: member.name, hotpepper, nailie, complete: Boolean(hotpepper), platforms: { hotpepper: Boolean(hotpepper), nailie: Boolean(nailie) } };
    });
    return Response.json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      salonAccounts: { salonboard: settings.salonboardLoginId || "", nailie: settings.nailieLoginId || "" },
      mappings,
      workerMapping: {
        nailie: Object.fromEntries(mappings.filter((item) => item.nailie).map((item) => [item.name, [item.nailie]])),
        salonboard: Object.fromEntries(mappings.filter((item) => item.hotpepper).map((item) => [item.name, { externalStaffName: item.hotpepper, closeRemaining: true }])),
      },
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return Response.json({ ok: false, message: error.message || "Không thể tải cấu hình automation" }, { status: 500 });
  }
}
