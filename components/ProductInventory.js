"use client";

import { useState } from "react";
import { getInventoryRows } from "../lib/ecommerce/data";
import { emptyProduct, useProductCatalog } from "../lib/catalogStore";

function yen(value) {
  return `JPY ${Number(value || 0).toLocaleString("ja-JP")}`;
}

export default function ProductInventory({ label = "Sản phẩm & Kho", language = "vi" }) {
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
        <div><p className="eyebrow">CATALOG SYNC</p><h1>{label}</h1><p>Quản lý sản phẩm, tồn kho và ảnh hiển thị đồng bộ trực tiếp lên web bán hàng.</p></div>
        <button className="primary" onClick={saveProduct}>+ Lưu sản phẩm</button>
      </div>
      <section className="card staffEditor productEditorPanel">
        <div className="sectionTitle"><div><h2>Thêm / sửa sản phẩm</h2><p>Chọn ảnh từ máy tính. Sau khi lưu, sản phẩm tự động xuất hiện ở trang Web bán hàng.</p></div></div>
        <div className="staffForm">
          <label>Tên sản phẩm<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>Mô tả<input value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <label>Giá<input type="number" value={draft.basePrice} onChange={(event) => setDraft({ ...draft, basePrice: Number(event.target.value) })} /></label>
          <label>Tồn kho<input type="number" value={draft.stock} onChange={(event) => setDraft({ ...draft, stock: Number(event.target.value) })} /></label>
          <label>Cảnh báo thấp<input type="number" value={draft.lowStockThreshold} onChange={(event) => setDraft({ ...draft, lowStockThreshold: Number(event.target.value) })} /></label>
          <label>Ảnh sản phẩm<input type="file" accept="image/*" onChange={uploadProductImage} /></label>
        </div>
        {draft.mediaUrl && <div className="imagePreview"><img src={draft.mediaUrl} alt={draft.name || "Product preview"} /><span>{draft.mediaFileName || "Ảnh đã chọn từ máy tính"}</span></div>}
      </section>
      <div className="toolbar productTools">
        <input className="searchInput" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tim Tên sản phẩm hoac SKU" />
        <select className="searchInput" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">Tất cả</option>
          <option value="low">Sắp hết hàng</option>
          <option value="ACTIVE">Đang bán</option>
          <option value="DRAFT">Nháp</option>
        </select>
      </div>
      <section className="card tableWrap">
        <table>
          <thead><tr><th>Sản phẩm</th><th>Giá</th><th>Tồn</th><th>Online/POS</th><th>Cảnh báo</th><th>Thao tác</th></tr></thead>
          <tbody>{visible.map((product) => (
            <tr key={product.id}>
              <td><div className="productCell">{product.mediaUrl ? <img className="catalogThumb" src={product.mediaUrl} alt={product.name} /> : <div className="productThumb">{product.name.slice(0, 1)}</div>}<div><strong>{product.name}</strong><span>{product.description || product.shortDescription}</span></div></div></td>
              <td>{yen(product.salePrice || product.basePrice)}</td>
              <td><span className={product.stock <= product.lowStockThreshold ? "pill danger" : "pill"}>{product.stock}</span></td>
              <td>{product.onlineStoreEnabled ? "Web" : "-"} / {product.posEnabled ? "POS" : "-"}</td>
              <td>{product.stock <= product.lowStockThreshold ? "Sắp hết hàng" : "OK"}</td>
              <td><button className="ghost" onClick={() => setDraft({ ...emptyProduct, ...product })}>Sửa</button> <button className="ghost dangerButton" onClick={() => deleteProduct(product.id)}>Xóa</button></td>
            </tr>
          ))}</tbody>
        </table>
      </section>
      <section className="card integrationHint"><h2>Đồng bộ website bán hàng</h2><p>Hiện có {products.length} sản phẩm trong catalog và {inventoryRows.length} dòng inventory. Ảnh lưu dạng data URL để MVP hiển thị ngay trên Web bán hàng.</p></section>
    </>
  );
}

