import { escapeHtml } from "./webText.js";
import { customerEmailLayout } from "./customerEmailTheme.js";

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

export const THANK_YOU_SUBJECT = "Cảm ơn bạn đã ghé thăm {salon}";
export const THANK_YOU_BODY = "Chào {customer},\nCảm ơn bạn đã đến {salon} và sử dụng dịch vụ {service} vào {date}. Rất hân hạnh được phục vụ bạn. Hẹn gặp lại!";

export const THANK_YOU_DEFAULTS = {
  Vi: { subject: THANK_YOU_SUBJECT, body: THANK_YOU_BODY },
  Ja: { subject: "{salon}をご利用いただきありがとうございます", body: "{customer}様\n{date}に{salon}へご来店いただき、{service}をご利用くださりありがとうございました。またのご来店を心よりお待ちしております。" },
  En: { subject: "Thank you for visiting {salon}", body: "Dear {customer},\nThank you for visiting {salon} and enjoying {service} on {date}. We look forward to seeing you again!" },
  Zh: { subject: "感谢您光临{salon}", body: "亲爱的{customer}：\n感谢您于{date}光临{salon}并体验{service}。期待再次为您服务！" },
  Ko: { subject: "{salon}에 방문해 주셔서 감사합니다", body: "{customer}님,\n{date}에 {salon}을 방문하여 {service} 서비스를 이용해 주셔서 감사합니다. 다음에 또 뵙겠습니다!" },
};

const oldSubjects = new Set(["Cảm ơn bạn đã đặt lịch tại {salon}", "Cảm ơn bạn đã ghé thăm {salon}"]);
const oldBodies = new Set(["Cảm ơn bạn đã đặt lịch {service} vào {date} lúc {time}. Hẹn gặp bạn tại {salon}!", "Chào {customer},\nCảm ơn bạn đã đặt lịch {service} vào {date} lúc {time}. Hẹn gặp bạn tại {salon}!", "Chào {customer},\nCảm ơn bạn đã ghé thăm {salon} và sử dụng dịch vụ {service} vào {date}. Hẹn gặp lại bạn!"]);
export function normalizeThankYouSettings(settings = {}) {
  const next = {
    ...settings,
    thankYouSubject: !settings.thankYouSubject || oldSubjects.has(settings.thankYouSubject) ? THANK_YOU_SUBJECT : settings.thankYouSubject,
    thankYouBody: !settings.thankYouBody || oldBodies.has(settings.thankYouBody) ? THANK_YOU_BODY : settings.thankYouBody,
  };
  for (const [field, legacy, kind] of [["thankYouSubject", oldSubjects, "subject"], ["thankYouBody", oldBodies, "body"]]) {
    if (!settings[field] || !legacy.has(settings[field])) continue;
    for (const language of ["Vi", "Ja", "En", "Zh", "Ko"]) {
      const key = `${field}${language}`;
      if (!settings.manualTranslations?.[key]) next[key] = THANK_YOU_DEFAULTS[language][kind];
    }
  }
  return next;
}

export function thankYouMessage(booking, settings) {
  const language = suffix[String(booking.language || "vi").toLowerCase()] || "Vi";
  const values = { customer: booking.customer || "", service: booking.service || "", date: booking.date || "", time: booking.start || "", salon: settings.salonName || "Mai Beauty Salon" };
  const render = (template) => String(template || "").replace(/\{(customer|service|date|time|salon)\}/g, (_, key) => String(values[key]));
  const normalized = normalizeThankYouSettings(settings);
  const subjectTemplate = normalized[`thankYouSubject${language}`] || (language === "Vi" ? normalized.thankYouSubject : normalized.thankYouSubject === THANK_YOU_SUBJECT ? THANK_YOU_DEFAULTS[language].subject : normalized.thankYouSubject);
  const bodyTemplate = normalized[`thankYouBody${language}`] || (language === "Vi" ? normalized.thankYouBody : normalized.thankYouBody === THANK_YOU_BODY ? THANK_YOU_DEFAULTS[language].body : normalized.thankYouBody);
  const subject = render(subjectTemplate);
  const body = render(bodyTemplate);
  return { subject, text: body, html: customerEmailLayout({ title: subject, content: `<p style="white-space:pre-line;margin:0">${escapeHtml(body).replace(/\r?\n/g, "<br>")}</p>`, settings, language: String(booking.language || "vi").toLowerCase() }) };
}
