"use client";
import { useState } from "react";
import { getInventoryRows, getProductSummary } from "../lib/ecommerce/data";

function yen(value) {
  return `¥${Number(value || 0).toLocaleString("ja-JP")}`;
}

export default function ProductInventory({ label = "Sản phẩm & Kho" }) {
  const initialProducts = getProductSummary().map((product) => ({ ...product, mediaUrl: "", description: product.shortDescription }));
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState({ id: "", name: "", description: "", basePrice: 0, stock: 0, lowStockThreshold: 3, mediaUrl: "", status: "ACTIVE" });
  const inventoryRows = getInventoryRows();
  const visible = products.filter((product) => {
    const matchesQuery = product.name.toLowerCase().includes(query.toLowerCase()) || product.sku?.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "low" && product.stock <= product.lowStockThreshold) || product.status === filter;
    return matchesQuery && matchesFilter;
  });

  function saveProduct() {
    if (!draft.name.trim()) return;
    const record = {
      ...draft,
      id: draft.id || `product-${Date.now()}`,
      sku: draft.sku || `SKU-${Date.now()}`,
      brandName: draft.brandName || "Salon",
      categoryName: draft.categoryName || "Gel / Nail",
      variantCount: 1,
      onlineStoreEnabled: true,
      posEnabled: true,
      salePrice: null,
      isLowStock: Number(draft.stock) <= Number(draft.lowStockThreshold),
    };
    setProducts((current) => current.some((item) => item.id === record.id) ? current.map((item) => item.id === record.id ? record : item) : [...current, record]);
    setDraft({ id: "", name: "", description: "", basePrice: 0, stock: 0, lowStockThreshold: 3, mediaUrl: "", status: "ACTIVE" });
  }

  function editProduct(product) {
    setDraft(product);
  }

  function deleteProduct(id) {
    setProducts((current) => current.filter((product) => product.id !== id));
  }

  return (
    <>
      <div className="pageHead">
        <div><p className="eyebrow">SUPABASE CATALOG</p><h1>{label}</h1><p>Quản lý sản phẩm, giá, ảnh/video và tồn kho chung cho POS + website bán hàng.</p></div>
        <button className="primary" onClick={saveProduct}>+ Lưu sản phẩm</button>
      </div>
      <section className="card staffEditor">
        <div className="sectionTitle"><div><h2>Thêm / sửa sản phẩm</h2><p>Database: products, product_variants, product_media, inventory_items. Media lưu Supabase Storage.</p></div></div>
        <div className="staffForm">
          <label>Tên sản phẩm<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>Mô tả<input value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <label>Giá<input type="number" value={draft.basePrice} onChange={(event) => setDraft({ ...draft, basePrice: Number(event.target.value) })} /></label>
          <label>Tồn kho<input type="number" value={draft.stock} onChange={(event) => setDraft({ ...draft, stock: Number(event.target.value) })} /></label>
          <label>Cảnh báo thấp<input type="number" value={draft.lowStockThreshold} onChange={(event) => setDraft({ ...draft, lowStockThreshold: Number(event.target.value) })} /></label>
          <label>Ảnh/video URL<input value={draft.mediaUrl || ""} onChange={(event) => setDraft({ ...draft, mediaUrl: event.target.value })} placeholder="Supabase Storage URL" /></label>
        </div>
      </section>
      <div className="toolbar productTools">
        <input className="searchInput" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên sản phẩm hoặc SKU" />
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
              <td><div className="productCell"><div className="productThumb">{product.mediaUrl ? "IMG" : product.name.slice(0, 1)}</div><div><strong>{product.name}</strong><span>{product.description || product.shortDescription}</span></div></div></td>
              <td>{yen(product.salePrice || product.basePrice)}</td>
              <td><span className={product.stock <= product.lowStockThreshold ? "pill danger" : "pill"}>{product.stock}</span></td>
              <td>{product.onlineStoreEnabled ? "Web" : "-"} / {product.posEnabled ? "POS" : "-"}</td>
              <td>{product.stock <= product.lowStockThreshold ? "Sắp hết hàng" : "OK"}</td>
              <td><button className="ghost" onClick={() => editProduct(product)}>Sửa</button> <button className="ghost dangerButton" onClick={() => deleteProduct(product.id)}>Xóa</button></td>
            </tr>
          ))}</tbody>
        </table>
      </section>
      <section className="card integrationHint">
        <h2>Chống bán vượt tồn kho</h2>
        <p>Khi checkout/order production: khóa dòng <code>inventory_items</code>, kiểm tra <code>quantity_available - quantity_reserved</code>, rồi tạo <code>inventory_transactions</code> trong cùng transaction.</p>
        <p>Hiện có {inventoryRows.length} dòng inventory từ schema hiện tại.</p>
      </section>
    </>
  );
}
