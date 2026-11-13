import { adminAlertEmails, sendEmail } from "../../../lib/serverEmail.js";
import { isAutomationRequest } from "../../../lib/automationAuth.js";
import { escapeHtml } from "../../../lib/webText.js";
export async function POST(request) {
  if (!isAutomationRequest(request)) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const bot = String(body.bot || "BOT"); const reason = String(body.reason || "Không rõ lỗi");
  const recipients = adminAlertEmails();
  if (!recipients.length) return Response.json({ ok: false, skipped: true, reason: "BOT_ALERT_EMAIL or ADMIN_EMAIL is not configured" }, { status: 503 });
  const subject = `Mai Beauty Salon · Cảnh báo ${bot} không vào được trang`;
  const text = `${bot} đã thử đăng nhập/truy cập quá 2 lần hoặc bị kẹt khi mở trang.\nLý do: ${reason}\nVui lòng mở Chrome profile của bot và đăng nhập lại.`;
  const result = await sendEmail({ to: recipients, subject, text, html: `<div style="font-family:Arial"><h2>Cảnh báo bot không vào được trang</h2><p><b>Bot:</b> ${escapeHtml(bot)}</p><p><b>Lý do:</b> ${escapeHtml(reason)}</p><p>Vui lòng mở Chrome profile của bot và đăng nhập lại.</p></div>` });
  return Response.json({ ok: result.ok === true, result }, { status: result.ok ? 200 : 502 });
}


// Read-only diagnostics: never sends another email or exposes provider credentials.
export async function GET(request) {
  const headers = { "cache-control": "no-store" };
  if (!isAutomationRequest(request)) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401, headers });
  const config = {
    recipients: adminAlertEmails(),
    from: process.env.RESEND_FROM || process.env.EMAIL_FROM || "Mai Beauty Salon <onboarding@resend.dev>",
    providerConfigured: Boolean(process.env.RESEND_API_KEY),
  };
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ ok: true, config }, { headers });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return Response.json({ ok: false, message: "Invalid email ID" }, { status: 400, headers });
  if (!config.providerConfigured) return Response.json({ ok: false, config, message: "RESEND_API_KEY is not configured" }, { status: 503, headers });
  try {
    const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(id)}`, {
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}` }, cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return Response.json({ ok: false, config, providerStatus: response.status, message: data.message || "Cannot retrieve email status" }, { status: 502, headers });
    const email = { id: data.id, to: data.to, from: data.from, subject: data.subject, createdAt: data.created_at, lastEvent: data.last_event };
    return Response.json({ ok: true, config, email }, { headers });
  } catch {
    return Response.json({ ok: false, config, message: "Email provider status lookup failed" }, { status: 502, headers });
  }
}
