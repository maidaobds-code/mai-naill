import { escapeHtml } from "./webText.js";

const suffix = { vi: "Vi", ja: "Ja", en: "En", zh: "Zh", ko: "Ko" };

export function isThankYouDue(booking, settings, sale, now = Date.now()) {
  if (!settings?.thankYouEmailEnabled || !booking?.email || booking?.thankYouSentAt || booking?.deletedAt) return false;
  if (["cancelled", "canceled"].includes(String(booking.status || "").toLowerCase())) return false;
  if (!sale || sale.voided || String(sale.paymentStatus || "").toLowerCase() !== "paid" || String(sale.appointmentId || "") !== String(booking.id || "")) return false;
  const paidAt = Date.parse(sale.issuedAt || "");
  const date = String(booking.date || "").replaceAll("/", "-");
  const startAt = Date.parse(`${date}T${booking.start || ""}:00+09:00`);
  const endAt = Date.parse(`${date}T${booking.end || ""}:00+09:00`);
  if (!Number.isFinite(paidAt) || !Number.isFinite(startAt) || !Number.isFinite(endAt) || paidAt < startAt || now < endAt) return false;
  const delay = Math.min(720, Math.max(1, Number(settings.thankYouDelayHours) || 24));
  return now >= Math.max(paidAt, endAt) + delay * 3_600_000;
}

export function thankYouMessage(booking, settings) {
  const language = suffix[String(booking.language || "vi").toLowerCase()] || "Vi";
  const values = { customer: booking.customer || "", service: booking.service || "", date: booking.date || "", time: booking.start || "", salon: settings.salonName || "Mai Beauty Salon" };
  const render = (template) => String(template || "").replace(/\{(customer|service|date|time|salon)\}/g, (_, key) => String(values[key]));
  const subject = render(settings[`thankYouSubject${language}`] || settings.thankYouSubject || "Cảm ơn bạn đã ghé thăm {salon}");
  const body = render(settings[`thankYouBody${language}`] || settings.thankYouBody || "Chào {customer}, cảm ơn bạn đã ghé thăm {salon}.");
  return { subject, text: body, html: `<p>${escapeHtml(body).replace(/\r?\n/g, "<br>")}</p>` };
}
