export function localizedProduct(product, language = "vi") {
  const suffix = language === "ja" ? "Ja" : language === "zh" ? "Zh" : language === "ko" ? "Ko" : language === "en" ? "En" : "Vi";
  return { name: product[`name${suffix}`] || product.name, description: product[`description${suffix}`] || product.description || product.shortDescription || "" };
}
