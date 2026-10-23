import { NextResponse } from "next/server";

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return !secret || request.headers.get("authorization") === `Bearer ${secret}`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" }[character]));
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, skipped: true, reason: "RESEND_API_KEY is not configured" });
  const baseUrl = new URL(request.url).origin;
  const bookingsResponse = await fetch(`${baseUrl}/api/bookings`, { cache: "no-store" });
  const bookingsResult = await bookingsResponse.json().catch(() => ({}));
  const bookings = Array.isArray(bookingsResult.value) ? bookingsResult.value : [];
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);
  const due = bookings.filter((booking) => booking.email && (booking.date === tomorrowKey || booking.date === tomorrowKey.replaceAll("-", "/")) && !booking.reminderSentAt && !["CANCELLED", "Cancelled"].includes(booking.status));
  const from = process.env.RESEND_FROM || process.env.EMAIL_FROM || "Mai Beauty Salon <onboarding@resend.dev>";
  const results = await Promise.all(due.map(async (booking) => {
    const language = booking.language || "vi";
    const text = language === "ja" ? `明日の予約のお知らせ：${booking.service || "予約"}、${booking.start || ""}〜${booking.end || ""}` : language === "en" ? `Reminder: your appointment is tomorrow at ${booking.start || ""}.` : `Nhắc lịch: bạn có lịch hẹn vào ngày mai lúc ${booking.start || ""}.`;
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [booking.email], subject: text, html: `<p>${escapeHtml(text)}</p><p>${escapeHtml(booking.service)} · ${escapeHtml(booking.start)}–${escapeHtml(booking.end)}</p>` }) });
    return { id: booking.id, ok: response.ok };
  }));
  return NextResponse.json({ ok: true, sent: results.filter((item) => item.ok).length, total: due.length, results });
}
