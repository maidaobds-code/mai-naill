import { NextResponse } from "next/server";
import { escapeHtml } from "../../../../lib/webText.js";
import { salonSettings, sendEmail } from "../../../../lib/serverEmail.js";
import { customerEmailLayout } from "../../../../lib/customerEmailTheme.js";
import { isThankYouDue, thankYouMessage } from "../../../../lib/thankYouEmail.js";

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, skipped: true, reason: "RESEND_API_KEY is not configured" });
  const baseUrl = new URL(request.url).origin;
  const bookingsResponse = await fetch(`${baseUrl}/api/bookings`, { cache: "no-store" });
  const bookingsResult = await bookingsResponse.json().catch(() => ({}));
  const bookings = Array.isArray(bookingsResult.value) ? bookingsResult.value : [];
  const settings = await salonSettings();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const ownerId = String(process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001").trim().replace(/^[\'\"]|[\'\"]$/g, "");
  let sales = [];
  if (supabaseUrl && serviceKey) {
    const response = await fetch(`${supabaseUrl}/rest/v1/app_kv?owner_id=eq.${ownerId}&key=eq.nail-japan-pos-sales&select=value&limit=1`, { cache: "no-store", headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` } });
    if (!response.ok) return NextResponse.json({ ok: false, message: "Không đọc được dữ liệu thanh toán; chưa gửi email cảm ơn." }, { status: 503 });
    const rows = await response.json();
    sales = Array.isArray(rows?.[0]?.value) ? rows[0].value : [];
  }
  const paidSales = new Map();
  for (const sale of sales) {
    if (!sale?.appointmentId || sale.voided || String(sale.paymentStatus || "").toLowerCase() !== "paid") continue;
    const id = String(sale.appointmentId);
    if (!paidSales.has(id) || Date.parse(sale.issuedAt || "") < Date.parse(paidSales.get(id).issuedAt || "")) paidSales.set(id, sale);
  }
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);
  const due = settings.emailReminder === false ? [] : bookings.filter((booking) => booking.email && (booking.date === tomorrowKey || booking.date === tomorrowKey.replaceAll("-", "/")) && !booking.reminderSentAt && !["cancelled", "canceled", "completed"].includes(String(booking.status || "").toLowerCase()) && !booking.deletedAt);
  const from = process.env.RESEND_FROM || process.env.EMAIL_FROM || "Mai Beauty Salon <onboarding@resend.dev>";
  const results = await Promise.all(due.map(async (booking) => {
    const language = booking.language || "vi";
    const text = language === "ja" ? `明日の予約のお知らせ：${booking.service || "予約"}、${booking.start || ""}〜${booking.end || ""}` : language === "en" ? `Reminder: your appointment is tomorrow at ${booking.start || ""}.` : `Nhắc lịch: bạn có lịch hẹn vào ngày mai lúc ${booking.start || ""}.`;
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [booking.email], subject: text, html: customerEmailLayout({ title: text, content: `<p>${escapeHtml(booking.service)} · ${escapeHtml(booking.date)} · ${escapeHtml(booking.start)}–${escapeHtml(booking.end)}</p>`, settings, language }) }) });
    return { id: booking.id, ok: response.ok, reminderSentAt: response.ok ? new Date().toISOString() : "" };
  }));
  const sentIds = new Map(results.filter((item) => item.ok).map((item) => [String(item.id), item.reminderSentAt]));
  const thankYouDue = bookings.filter((booking) => isThankYouDue(booking, settings, paidSales.get(String(booking.id))));
  const thankYouResults = await Promise.all(thankYouDue.map(async (booking) => {
    const sent = await sendEmail({ to: booking.email, ...thankYouMessage(booking, settings) }).catch(() => ({ ok: false }));
    return { id: String(booking.id), ok: Boolean(sent.ok), sentAt: sent.ok ? new Date().toISOString() : "" };
  }));
  const thankYouSent = new Map(thankYouResults.filter((item) => item.ok).map((item) => [item.id, item.sentAt]));
  if (sentIds.size || thankYouSent.size) {
    const emailMarkers = [...new Set([...sentIds.keys(), ...thankYouSent.keys()])].map((id) => ({ id, reminderSentAt: sentIds.get(id), thankYouSentAt: thankYouSent.get(id) }));
    const saved = await fetch(`${baseUrl}/api/bookings`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.CRON_SECRET || ""}` }, body: JSON.stringify({ emailMarkers }) }).catch(() => null);
    if (!saved?.ok) return NextResponse.json({ ok: false, message: "Đã gửi email nhưng không lưu được dấu đã gửi; cần kiểm tra trước lần chạy tiếp." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, sent: results.filter((item) => item.ok).length, total: due.length, thankYouSent: thankYouSent.size, thankYouDue: thankYouDue.length, results });
}
