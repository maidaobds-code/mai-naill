"use client";

import { useState } from "react";
import { getInventoryRows } from "../lib/ecommerce/data";
import { emptyProduct, useProductCatalog } from "../lib/catalogStore";

function yen(value) {
  return `JPY ${Number(value || 0).toLocaleString("ja-JP")}`;
}

export default function ProductInventory({ label = "San pham & Kho" }) {
  const [products, setProducts] = useProductCatalog();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState(emptyProduct);
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

  function saveProduct() {
    if (!draft.name.trim()) return;
    const record = {
      ...draft,
      id: draft.id || `product-${Date.now()}`,
      sku: draft.sku || `SKU-${Date.now()}`,
      brandName: draft.brandName || "Salon",
      categoryName: draft.categoryName || "Gel / Nail",
      productType: draft.productType || "Nail Care",
      shortDescription: draft.description || draft.shortDescription || "Salon selected product",
      variantCount: 1,
      onlineStoreEnabled: true,
      posEnabled: true,
      salePrice: draft.salePrice || null,
      isLowStock: Number(draft.stock) <= Number(draft.lowStockThreshold),
    };
    setProducts((current) => current.some((item) => item.id === record.id) ? current.map((item) => item.id === record.id ? record : item) : [...current, record]);
    setDraft(emptyProduct);
  }

  function deleteProduct(id) {
    setProducts((current) => current.filter((product) => product.id !== id));
  }

  return (
    <>
      <div className="pageHead">
        <div><p className="eyebrow">CATALOG SYNC</p><h1>{label}</h1><p>Quan ly san pham, ton kho va anh hien thi dong bo truc tiep len web ban hang.</p></div>
        <button className="primary" onClick={saveProduct}>+ Luu san pham</button>
      </div>
      <section className="card staffEditor productEditorPanel">
        <div className="sectionTitle"><div><h2>Them / sua san pham</h2><p>Chon anh tu may tinh. Sau khi luu, san pham tu dong xuat hien o trang Online Store.</p></div></div>
        <div className="staffForm">
          <label>Ten san pham<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>Mo ta<input value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <label>Gia<input type="number" value={draft.basePrice} onChange={(event) => setDraft({ ...draft, basePrice: Number(event.target.value) })} /></label>
          <label>Ton kho<input type="number" value={draft.stock} onChange={(event) => setDraft({ ...draft, stock: Number(event.target.value) })} /></label>
          <label>Canh bao thap<input type="number" value={draft.lowStockThreshold} onChange={(event) => setDraft({ ...draft, lowStockThreshold: Number(event.target.value) })} /></label>
          <label>Anh san pham<input type="file" accept="image/*" onChange={uploadProductImage} /></label>
        </div>
        {draft.mediaUrl && <div className="imagePreview"><img src={draft.mediaUrl} alt={draft.name || "Product preview"} /><span>{draft.mediaFileName || "Anh da chon tu may tinh"}</span></div>}
      </section>
      <div className="toolbar productTools">
        <input className="searchInput" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tim ten san pham hoac SKU" />
        <select className="searchInput" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">Tat ca</option>
          <option value="low">Sap het hang</option>
          <option value="ACTIVE">Dang ban</option>
          <option value="DRAFT">Nhap</option>
        </select>
      </div>
      <section className="card tableWrap">
        <table>
          <thead><tr><th>San pham</th><th>Gia</th><th>Ton</th><th>Online/POS</th><th>Canh bao</th><th>Thao tac</th></tr></thead>
          <tbody>{visible.map((product) => (
            <tr key={product.id}>
              <td><div className="productCell">{product.mediaUrl ? <img className="catalogThumb" src={product.mediaUrl} alt={product.name} /> : <div className="productThumb">{product.name.slice(0, 1)}</div>}<div><strong>{product.name}</strong><span>{product.description || product.shortDescription}</span></div></div></td>
              <td>{yen(product.salePrice || product.basePrice)}</td>
              <td><span className={product.stock <= product.lowStockThreshold ? "pill danger" : "pill"}>{product.stock}</span></td>
              <td>{product.onlineStoreEnabled ? "Web" : "-"} / {product.posEnabled ? "POS" : "-"}</td>
              <td>{product.stock <= product.lowStockThreshold ? "Sap het hang" : "OK"}</td>
              <td><button className="ghost" onClick={() => setDraft({ ...emptyProduct, ...product })}>Sua</button> <button className="ghost dangerButton" onClick={() => deleteProduct(product.id)}>Xoa</button></td>
            </tr>
          ))}</tbody>
        </table>
      </section>
      <section className="card integrationHint"><h2>Dong bo website ban hang</h2><p>Hien co {products.length} san pham trong catalog va {inventoryRows.length} dong inventory. Anh luu dang data URL de MVP hien thi ngay tren Online Store.</p></section>
    </>
  );
}
