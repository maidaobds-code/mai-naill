"use client";

import { useState } from "react";
import { getInventoryRows } from "../lib/ecommerce/data";
import { emptyProduct, useProductCatalog } from "../lib/catalogStore";
import { tx } from "../lib/i18nClean";

function yen(value) {
  return `JPY ${Number(value || 0).toLocaleString("ja-JP")}`;
}

export default function ProductInventory({ label = "Sản phẩm & Kho", language = "vi" }) {
  const tc = (key) => tx(language, "common", key);
  const copy = {
    zh: { desc: "管理商品、库存和同步到线上商店的图片。", save: "+ 保存商品", editor: "添加 / 编辑商品", editorDesc: "从电脑选择图片，保存后商品会显示在线上商店。", name: "商品名称", low: "库存不足提醒", sellWeb: "在线销售", featured: "推荐商品", image: "商品图片", selectedImage: "已选图片", search: "搜索商品名称或SKU", all: "全部", lowStock: "库存不足", active: "销售中", draft: "草稿", headers: ["商品", "价格", "库存", "Online/POS", "提醒", "操作"], addFeatured: "加入推荐", removeFeatured: "取消推荐", webSync: "线上商店同步", webDesc: "目录中有{products}件商品，库存有{rows}行。", featuredLabel: "推荐" },
    ko: { desc: "상품, 재고와 온라인 스토어에 동기화되는 이미지를 관리합니다.", save: "+ 상품 저장", editor: "상품 추가 / 수정", editorDesc: "컴퓨터에서 이미지를 선택하면 저장 후 온라인 스토어에 표시됩니다.", name: "상품명", low: "재고 부족 알림", sellWeb: "웹에서 판매", featured: "추천 상품", image: "상품 이미지", selectedImage: "선택한 이미지", search: "상품명 또는 SKU 검색", all: "전체", lowStock: "재고 부족", active: "판매 중", draft: "임시 저장", headers: ["상품", "가격", "재고", "Online/POS", "알림", "작업"], addFeatured: "추천 추가", removeFeatured: "추천 해제", webSync: "온라인 스토어 동기화", webDesc: "카탈로그 {products}개 상품, 재고 {rows}개 항목입니다.", featuredLabel: "추천" },
    vi: { desc: "Quản lý sản phẩm, tồn kho và ảnh hiển thị đồng bộ trực tiếp lên web bán hàng.", save: "+ Lưu sản phẩm", editor: "Thêm / sửa sản phẩm", editorDesc: "Chọn ảnh từ máy tính. Sau khi lưu, sản phẩm tự động xuất hiện ở trang Web bán hàng.", name: "Tên sản phẩm", low: "Cảnh báo thấp", sellWeb: "Bán trên web", featured: "Sản phẩm nổi bật", image: "Ảnh sản phẩm", selectedImage: "Ảnh đã chọn từ máy tính", search: "Tìm tên sản phẩm hoặc SKU", all: "Tất cả", lowStock: "Sắp hết hàng", active: "Đang bán", draft: "Nháp", headers: ["Sản phẩm", "Giá", "Tồn", "Online/POS", "Cảnh báo", "Thao tác"], addFeatured: "Thêm nổi bật", removeFeatured: "Xóa nổi bật", webSync: "Đồng bộ website bán hàng", webDesc: "Hiện có {products} sản phẩm trong catalog và {rows} dòng inventory. Ảnh lưu dạng data URL để MVP hiển thị ngay trên Web bán hàng.", featuredLabel: "Nổi bật" },
    ja: { desc: "商品、在庫、表示画像を管理し、オンラインストアへ同期します。", save: "+ 商品を保存", editor: "商品を追加 / 編集", editorDesc: "PCから画像を選択します。保存後、商品はオンラインストアに表示されます。", name: "商品名", low: "低在庫アラート", sellWeb: "Webで販売", featured: "おすすめ商品", image: "商品画像", selectedImage: "選択済み画像", search: "商品名またはSKUを検索", all: "すべて", lowStock: "在庫少", active: "販売中", draft: "下書き", headers: ["商品", "価格", "在庫", "Online/POS", "アラート", "操作"], addFeatured: "おすすめに追加", removeFeatured: "おすすめ解除", webSync: "オンラインストア同期", webDesc: "カタログに{products}商品、在庫に{rows}行あります。画像はMVP表示用にdata URLで保存されます。", featuredLabel: "おすすめ" },
    en: { desc: "Manage products, inventory, and images synced directly to the online store.", save: "+ Save product", editor: "Add / edit product", editorDesc: "Choose an image from your computer. After saving, the product appears in the online store.", name: "Product name", low: "Low stock alert", sellWeb: "Sell on web", featured: "Featured product", image: "Product image", selectedImage: "Selected image from computer", search: "Search product name or SKU", all: "All", lowStock: "Low stock", active: "Active", draft: "Draft", headers: ["Product", "Price", "Stock", "Online/POS", "Alert", "Actions"], addFeatured: "Add featured", removeFeatured: "Remove featured", webSync: "Online store sync", webDesc: "{products} products in catalog and {rows} inventory rows. Images are stored as data URLs for MVP display.", featuredLabel: "Featured" },
  }[language] || { desc: "Manage products, inventory, and images synced directly to the online store.", save: "+ Save product", editor: "Add / edit product", editorDesc: "Choose an image from your computer. After saving, the product appears in the online store.", name: "Product name", low: "Low stock alert", sellWeb: "Sell on web", featured: "Featured product", image: "Product image", selectedImage: "Selected image", search: "Search product name or SKU", all: "All", lowStock: "Low stock", active: "Active", draft: "Draft", headers: ["Product", "Price", "Stock", "Online/POS", "Alert", "Actions"], addFeatured: "Add featured", removeFeatured: "Remove featured", webSync: "Online store sync", webDesc: "{products} products in catalog and {rows} inventory rows.", featuredLabel: "Featured" };
  const [products, setProducts] = useProductCatalog();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState(emptyProduct);
  const [translating, setTranslating] = useState(false);
  const inventoryRows = getInventoryRows();
  const visible = products.filter((product) => {
    const matchesQuery = product.name.toLowerCase().includes(query.toLowerCase()) || product.sku?.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "low" && product.stock <= product.lowStockThreshold) || product.status === filter;
    return matchesQuery && matchesFilter;
  });

  function uploadProductImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDraft((current) => ({ ...current, mediaUrl: reader.result, mediaFileName: file.name }));
    reader.readAsDataURL(file);
  }

  async function translateText(text) {
    if (!text?.trim()) return {};
    const response = await fetch("/api/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, targets: ["VI", "JA", "EN", "ZH", "KO"] }) });
    const result = await response.json().catch(() => ({}));
    return result.ok ? result.translations : {};
  }

  async function saveProduct() {
    if (!draft.name.trim()) return;
    const [names, descriptions] = await Promise.all([translateText(draft.name), translateText(draft.description || draft.shortDescription || "")]);
    const record = {
      ...draft,
      id: draft.id || `product-${Date.now()}`,
      sku: draft.sku || `SKU-${Date.now()}`,
      brandName: draft.brandName || "Salon",
      categoryName: draft.categoryName || "Gel / Nail",
      productType: draft.productType || "Nail Care",
      shortDescription: draft.description || draft.shortDescription || "Salon selected product",
      variantCount: 1,
      onlineStoreEnabled: draft.onlineStoreEnabled !== false,
      featuredOnline: draft.featuredOnline !== false,
      posEnabled: true,
      salePrice: draft.salePrice || null,
      isLowStock: Number(draft.stock) <= Number(draft.lowStockThreshold),
      nameVi: names.VI || draft.name, nameJa: names.JA || draft.name, nameEn: names.EN || draft.name, nameZh: names.ZH || draft.name, nameKo: names.KO || draft.name,
      descriptionVi: descriptions.VI || draft.description || draft.shortDescription || "", descriptionJa: descriptions.JA || draft.description || draft.shortDescription || "", descriptionEn: descriptions.EN || draft.description || draft.shortDescription || "", descriptionZh: descriptions.ZH || draft.description || draft.shortDescription || "", descriptionKo: descriptions.KO || draft.description || draft.shortDescription || "",
    };
    setProducts((current) => current.some((item) => item.id === record.id) ? current.map((item) => item.id === record.id ? record : item) : [...current, record]);
    setDraft(emptyProduct);
  }

  async function translateExistingProducts() {
    setTranslating(true);
    try { const next = await Promise.all(products.map(async (product) => { const [names, descriptions] = await Promise.all([["nameVi","nameJa","nameEn","nameZh","nameKo"].every((key) => product[key]) ? {} : translateText(product.name), ["descriptionVi","descriptionJa","descriptionEn","descriptionZh","descriptionKo"].every((key) => product[key]) ? {} : translateText(product.description || product.shortDescription || "")]); return { ...product, nameVi: names.VI || product.nameVi || product.name, nameJa: names.JA || product.nameJa || product.name, nameEn: names.EN || product.nameEn || product.name, nameZh: names.ZH || product.nameZh || product.name, nameKo: names.KO || product.nameKo || product.name, descriptionVi: descriptions.VI || product.descriptionVi || product.description || product.shortDescription || "", descriptionJa: descriptions.JA || product.descriptionJa || product.description || product.shortDescription || "", descriptionEn: descriptions.EN || product.descriptionEn || product.description || product.shortDescription || "", descriptionZh: descriptions.ZH || product.descriptionZh || product.description || product.shortDescription || "", descriptionKo: descriptions.KO || product.descriptionKo || product.description || product.shortDescription || "" }; })); setProducts(next); } finally { setTranslating(false); }
  }

  function deleteProduct(id) {
    setProducts((current) => current.filter((product) => product.id !== id));
  }

  return (
    <>
      <div className="pageHead">
        <div><p className="eyebrow">CATALOG SYNC</p><h1>{label}</h1><p>{copy.desc}</p></div>
        <div className="buttonRow"><button className="ghost" onClick={translateExistingProducts} disabled={translating}>{translating ? "Đang dịch sản phẩm…" : "Dịch sản phẩm cũ"}</button><button className="primary" onClick={saveProduct}>{copy.save}</button></div>
      </div>
      <section className="card staffEditor productEditorPanel">
        <div className="sectionTitle"><div><h2>{copy.editor}</h2><p>{copy.editorDesc}</p></div></div>
        <div className="staffForm">
          <label>{copy.name}<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>{tc("note")}<input value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <label>{tc("price")}<input type="number" value={draft.basePrice} onChange={(event) => setDraft({ ...draft, basePrice: Number(event.target.value) })} /></label>
          <label>{tc("stock")}<input type="number" value={draft.stock} onChange={(event) => setDraft({ ...draft, stock: Number(event.target.value) })} /></label>
          <label>{copy.low}<input type="number" value={draft.lowStockThreshold} onChange={(event) => setDraft({ ...draft, lowStockThreshold: Number(event.target.value) })} /></label>
          <label className="checkLabel"><input type="checkbox" checked={draft.onlineStoreEnabled !== false} onChange={(event) => setDraft({ ...draft, onlineStoreEnabled: event.target.checked })} />{copy.sellWeb}</label>
          <label className="checkLabel"><input type="checkbox" checked={draft.featuredOnline !== false} onChange={(event) => setDraft({ ...draft, featuredOnline: event.target.checked })} />{copy.featured}</label>
          <label>{copy.image}<input type="file" accept="image/*" onChange={uploadProductImage} /></label>
        </div>
        {draft.mediaUrl && <div className="imagePreview"><img src={draft.mediaUrl} alt={draft.name || "Product preview"} /><span>{draft.mediaFileName || copy.selectedImage}</span></div>}
      </section>
      <div className="toolbar productTools">
        <input className="searchInput" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} />
        <select className="searchInput" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">{copy.all}</option>
          <option value="low">{copy.lowStock}</option>
          <option value="ACTIVE">{copy.active}</option>
          <option value="DRAFT">{copy.draft}</option>
        </select>
      </div>
      <section className="card tableWrap">
        <table>
          <thead><tr>{copy.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>{visible.map((product) => (
            <tr key={product.id}>
              <td><div className="productCell">{product.mediaUrl ? <img className="catalogThumb" src={product.mediaUrl} alt={product.name} /> : <div className="productThumb">{product.name.slice(0, 1)}</div>}<div><strong>{product.name}</strong><span>{product.description || product.shortDescription}</span></div></div></td>
              <td>{yen(product.salePrice || product.basePrice)}</td>
              <td><span className={product.stock <= product.lowStockThreshold ? "pill danger" : "pill"}>{product.stock}</span></td>
              <td>{product.onlineStoreEnabled !== false ? "Web" : "-"} / {product.posEnabled ? "POS" : "-"} {product.featuredOnline !== false ? ` / ${copy.featuredLabel}` : ""}</td>
              <td>{product.stock <= product.lowStockThreshold ? copy.lowStock : "OK"}</td>
              <td><button className="ghost" onClick={() => setProducts((current) => current.map((item) => item.id === product.id ? { ...item, featuredOnline: item.featuredOnline === false } : item))}>{product.featuredOnline === false ? copy.addFeatured : copy.removeFeatured}</button> <button className="ghost" onClick={() => setDraft({ ...emptyProduct, ...product })}>{tc("edit")}</button> <button className="ghost dangerButton" onClick={() => deleteProduct(product.id)}>{tc("delete")}</button></td>
            </tr>
          ))}</tbody>
        </table>
      </section>
      <section className="card integrationHint"><h2>{copy.webSync}</h2><p>{copy.webDesc.replace("{products}", products.length).replace("{rows}", inventoryRows.length)}</p></section>
    </>
  );
}

