import { escapeHtml } from "./webText.js";

const suffix = { vi: "Vi", ja: "Ja", en: "En", zh: "Zh", ko: "Ko" };

export function isThankYouDue(booking, settings, now = Date.now()) {
  if (!settings?.thankYouEmailEnabled || !booking?.email || !booking?.bookedAt || booking?.thankYouSentAt || booking?.deletedAt) return false;
  if (["cancelled", "canceled"].includes(String(booking.status || "").toLowerCase())) return false;
  const created = Date.parse(booking.bookedAt);
  const delay = Math.min(720, Math.max(1, Number(settings.thankYouDelayHours) || 24));
  return Number.isFinite(created) && now >= created + delay * 3_600_000;
}

export function thankYouMessage(booking, settings) {
  const language = suffix[String(booking.language || "vi").toLowerCase()] || "Vi";
  const values = { customer: booking.customer || "", service: booking.service || "", date: booking.date || "", time: booking.start || "", salon: settings.salonName || "Mai Beauty Salon" };
  const render = (template) => String(template || "").replace(/\{(customer|service|date|time|salon)\}/g, (_, key) => String(values[key]));
  const subject = render(settings[`thankYouSubject${language}`] || settings.thankYouSubject || "Cảm ơn bạn đã đặt lịch tại {salon}");
  const body = render(settings[`thankYouBody${language}`] || settings.thankYouBody || "Chào {customer}, cảm ơn bạn đã đặt lịch tại {salon}.");
  return { subject, text: body, html: `<p>${escapeHtml(body).replace(/\r?\n/g, "<br>")}</p>` };
}
