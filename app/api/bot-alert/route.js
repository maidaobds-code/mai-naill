import { adminAlertEmails, sendEmail } from "../../../lib/serverEmail.js";
import { isAutomationRequest } from "../../../lib/automationAuth.js";
import { escapeHtml } from "../../../lib/webText.js";
export async function POST(request) {
  if (!isAutomationRequest(request)) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const bot = String(body.bot || "BOT"); const reason = String(body.reason || "Không rõ lỗi");
  const recipients = adminAlertEmails();
  if (!recipients.length) return Response.json({ ok: false, skipped: true, reason: "BOT_ALERT_EMAIL or ADMIN_EMAIL is not configured" });
  const subject = `Mai Beauty Salon · Cảnh báo ${bot} không vào được trang`;
  const text = `${bot} đã thử đăng nhập/truy cập quá 2 lần hoặc bị kẹt khi mở trang.\nLý do: ${reason}\nVui lòng mở Chrome profile của bot và đăng nhập lại.`;
  const result = await sendEmail({ to: recipients, subject, text, html: `<div style="font-family:Arial"><h2>Cảnh báo bot không vào được trang</h2><p><b>Bot:</b> ${escapeHtml(bot)}</p><p><b>Lý do:</b> ${escapeHtml(reason)}</p><p>Vui lòng mở Chrome profile của bot và đăng nhập lại.</p></div>` });
  return Response.json({ ok: true, result });
}
