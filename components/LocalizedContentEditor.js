"use client";
import { useState } from "react";
import { contentLanguages } from "../lib/manualTranslations";
import { translateWithMemory } from "../lib/translationMemory";
export default function LocalizedContentEditor({ value, onChange, field, label, multiline = true }) {
  const [locale, setLocale] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = contentLanguages.find(item => item.code === locale);
  const key = field + (selected?.suffix || "");
  function edit(text) { onChange({ ...value, [key]: text, ...(selected ? { manualTranslations: { ...value.manualTranslations, [key]: true } } : {}) }); }
  async function translate() {
    setBusy(true); setError("");
    try { const result = await translateWithMemory(value[field] || ""); const text = result[locale.toUpperCase()]; if (text === undefined) throw Error("Không dịch được nội dung"); edit(text); }
    catch (error) { setError(error.message); } finally { setBusy(false); }
  }
  return <div className="localizedEditor"><div className="localizedEditorHead"><strong>{label}</strong><select aria-label={`Ngôn ngữ ${label}`} value={locale} onChange={event => setLocale(event.target.value)}><option value="">Nội dung gốc</option>{contentLanguages.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}</select>{selected && <button type="button" className="ghost" disabled={busy || !value[field]} onClick={translate}>{busy ? "Đang dịch…" : "Dịch từ bản gốc"}</button>}</div>{multiline ? <textarea aria-label={label} rows="4" value={value[key] ?? ""} onChange={event => edit(event.target.value)} /> : <input aria-label={label} value={value[key] ?? ""} onChange={event => edit(event.target.value)} />}{selected && <small>Bản dịch được lưu riêng. Bạn có thể sửa văn phong trực tiếp.</small>}{error && <p role="alert">{error}</p>}</div>;
}
