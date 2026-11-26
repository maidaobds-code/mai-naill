import { escapeHtml } from "./webText.js";

export function japanEmailTheme(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).formatToParts(date);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  if ((month === 12 && day >= 26) || (month === 1 && day <= 7)) return { name: "新春 · New Year", symbol: "✦", accent: "#9b3346", soft: "#fff1e9", border: "#e9cbb9" };
  if ((month === 4 && day >= 29) || (month === 5 && day <= 6)) return { name: "Golden Week · ゴールデンウィーク", symbol: "✿", accent: "#7a6725", soft: "#fff8dc", border: "#e9dda8" };
  if (month === 7 && day >= 1 && day <= 7) return { name: "七夕 · Tanabata", symbol: "✧", accent: "#4359a6", soft: "#edf2ff", border: "#cdd8f4" };
  if (month >= 3 && month <= 5) return { name: "桜の季節 · Spring", symbol: "✿", accent: "#a93d72", soft: "#fff0f5", border: "#f1d1df" };
  if (month >= 6 && month <= 8) return { name: "夏祭り · Summer", symbol: "✺", accent: "#256f88", soft: "#eaf8fb", border: "#c8e5ec" };
  if (month >= 9 && month <= 11) return { name: "紅葉の季節 · Autumn", symbol: "❖", accent: "#9d4f38", soft: "#fff1e9", border: "#ebd0be" };
  return { name: "冬の灯り · Winter", symbol: "✧", accent: "#495e8e", soft: "#eff4ff", border: "#d7e0f2" };
}

export function customerEmailLayout({ title, content, settings = {}, date = new Date(), language = "vi" }) {
  const theme = japanEmailTheme(date);
  const salon = String(settings.salonName || "Mai Beauty Salon");
  const logo = /^https:\/\//i.test(String(settings.logoUrl || "")) ? `<img src="${escapeHtml(settings.logoUrl)}" alt="${escapeHtml(salon)}" width="56" height="56" style="display:block;width:56px;height:56px;object-fit:contain;border-radius:15px;background:#fff">` : `<span style="display:block;width:56px;height:56px;line-height:56px;text-align:center;border-radius:15px;background:#fff;color:${theme.accent};font-size:30px;font-weight:bold">✿</span>`;
  const contact = [settings.address && `⌖ ${escapeHtml(settings.address)}`, settings.phone && `☎ <a href="tel:${escapeHtml(String(settings.phone).replace(/[^+\d]/g, ""))}" style="color:${theme.accent};text-decoration:none">${escapeHtml(settings.phone)}</a>`, settings.email && `✉ <a href="mailto:${escapeHtml(settings.email)}" style="color:${theme.accent};text-decoration:none">${escapeHtml(settings.email)}</a>`].filter(Boolean).join("<br>");
  return `<!doctype html><html lang="${escapeHtml(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f8f6f7;font-family:Arial,'Helvetica Neue',sans-serif;color:#342b33"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f6f7"><tr><td align="center" style="padding:24px 10px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border:1px solid ${theme.border};border-radius:22px"><tr><td style="padding:12px 30px;background:${theme.soft};color:${theme.accent};font-size:12px;letter-spacing:1px;text-align:right">${theme.symbol} ${escapeHtml(theme.name)}</td></tr><tr><td style="padding:25px 30px;border-bottom:1px solid ${theme.border}"><table role="presentation" width="100%"><tr><td width="70">${logo}</td><td><strong style="font-size:19px;color:#332837">${escapeHtml(salon)}</strong>${settings.branch ? `<div style="margin-top:4px;font-size:12px;color:#776d75">${escapeHtml(settings.branch)}</div>` : ""}</td></tr></table></td></tr><tr><td style="padding:30px"><h1 style="margin:0 0 18px;font-size:25px;line-height:1.3;color:${theme.accent}">${escapeHtml(title)}</h1><div style="font-size:15px;line-height:1.75;overflow-wrap:anywhere">${content}</div></td></tr><tr><td style="padding:22px 30px;background:${theme.soft};border-top:1px solid ${theme.border};font-size:13px;line-height:1.8;color:#5f555e"><strong>${escapeHtml(salon)}</strong>${contact ? `<br>${contact}` : ""}</td></tr></table></td></tr></table></body></html>`;
}
