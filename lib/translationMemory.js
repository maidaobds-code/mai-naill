export async function translateWithMemory(text, targets = ["VI", "JA", "EN", "ZH", "KO"]) {
  const value = String(text || "").trim();
  if (!value) return {};
  const response = await fetch("/api/translation-memory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: [{ text: value, targets }] }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || "Translation failed");
  return result.translations?.[value] || {};
}
