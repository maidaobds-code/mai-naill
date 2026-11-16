export const contentLanguages = [{code:"vi",suffix:"Vi",label:"Tiếng Việt"},{code:"ja",suffix:"Ja",label:"日本語"},{code:"en",suffix:"En",label:"English"},{code:"zh",suffix:"Zh",label:"中文"},{code:"ko",suffix:"Ko",label:"한국어"}];
export function preserveManualTranslations(record, draft) {
  const next = { ...record, manualTranslations: { ...draft.manualTranslations } };
  for (const key of Object.keys(draft.manualTranslations || {})) if (draft.manualTranslations[key]) next[key] = draft[key] ?? "";
  return next;
}

export function localizedContent(value, field, language) { const suffix=contentLanguages.find(item=>item.code===language)?.suffix||"En"; const key=field+suffix; return value.manualTranslations?.[key] ? value[key] ?? "" : value[key] || value[field] || ""; }
