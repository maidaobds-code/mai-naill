import { managementEmails, sendEmail } from "../../../lib/serverEmail.js";

function authorized(request) {
  const secret = process.env.BOOKING_SYNC_SECRET || process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}
function escape(value) { return String(value || "").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" }[c])); }
export async function POST(request) {
  if (!authorized(request)) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const bot = String(body.bot || "BOT"); const reason = String(body.reason || "Không rõ lỗi");
  const recipients = await managementEmails();
  if (!recipients.length) return Response.json({ ok: false, skipped: true, reason: "No admin email configured" });
  const subject = `Mai Beauty Salon · Cảnh báo ${bot} không vào được trang`;
  const text = `${bot} đã thử đăng nhập/truy cập quá 2 lần hoặc bị kẹt khi mở trang.\nLý do: ${reason}\nVui lòng mở Chrome profile của bot và đăng nhập lại.`;
  const result = await sendEmail({ to: recipients, subject, text, html: `<div style="font-family:Arial"><h2>Cảnh báo bot không vào được trang</h2><p><b>Bot:</b> ${escape(bot)}</p><p><b>Lý do:</b> ${escape(reason)}</p><p>Vui lòng mở Chrome profile của bot và đăng nhập lại.</p></div>` });
  return Response.json({ ok: true, result });
}
