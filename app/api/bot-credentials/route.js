import { isAdminRequest, isOwnerRequest } from "../../../lib/serverAuth.js";
import { botCredentialStatus, readBotCredentials, saveBotCredential } from "../../../lib/serverBotCredentials.js";

function authorized(request) { return isAdminRequest(request) || isOwnerRequest(request); }

export async function GET(request) {
  if (!authorized(request)) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  try { return Response.json({ ok: true, value: botCredentialStatus(await readBotCredentials()) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ ok: false, message: error.message }, { status: 500 }); }
}

export async function POST(request) {
  if (!authorized(request)) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try { return Response.json({ ok: true, value: await saveBotCredential(body.platform, body.username, body.password, body.clearPassword) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ ok: false, message: error.message }, { status: 400 }); }
}
