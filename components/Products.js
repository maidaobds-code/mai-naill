"use client";
import { brands, getProductSummary, productCategories } from "../lib/ecommerce/data";

function money(value) {
  return `¥${value.toLocaleString("ja-JP")}`;
}

export default function Products() {
  const products = getProductSummary();
  const activeProducts = products.filter((product) => product.status === "ACTIVE").length;
  const onlineProducts = products.filter((product) => product.onlineStoreEnabled).length;
  const lowStock = products.filter((product) => product.isLowStock).length;

  return (
    <>
      <div className="pageHead">
        <div>
          <p className="eyebrow">ECOMMERCE</p>
          <h1>Products</h1>
          <p>Product catalog, variants, pricing, POS visibility, and online store publishing.</p>
        </div>
        <button className="primary">+ New Product</button>
      </div>

      <div className="stats">
        <div className="stat card"><span>Active products</span><strong>{activeProducts}</strong><small>{products.length} total records</small></div>
        <div className="stat card"><span>Online store</span><strong>{onlineProducts}</strong><small>Visible to shoppers</small></div>
        <div className="stat card"><span>Low stock</span><strong>{lowStock}</strong><small>Needs purchase planning</small></div>
        <div className="stat card"><span>Brands</span><strong>{brands.length}</strong><small>{productCategories.length} categories</small></div>
      </div>

      <section className="card tableWrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>SKU</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Online</th>
              <th>POS</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  <div className="productCell">
                    <div className="productThumb">{product.name.slice(0, 1)}</div>
                    <div><strong>{product.name}</strong><span>{product.brandName} · {product.variantCount} variants</span></div>
                  </div>
                </td>
                <td>{product.categoryName}</td>
                <td>{product.sku}</td>
                <td>{product.salePrice ? <><strong>{money(product.salePrice)}</strong><span className="strike">{money(product.basePrice)}</span></> : money(product.basePrice)}</td>
                <td><span className={product.isLowStock ? "pill danger" : "pill"}>{product.stock}</span></td>
                <td>{product.onlineStoreEnabled ? "Yes" : "No"}</td>
                <td>{product.posEnabled ? "Yes" : "No"}</td>
                <td><span className={`pill ${product.status.toLowerCase()}`}>{product.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
