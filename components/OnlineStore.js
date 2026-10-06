"use client";
import { getProductSummary } from "../lib/ecommerce/data";

function money(value) {
  return `¥${value.toLocaleString("ja-JP")}`;
}

export default function OnlineStore() {
  const featured = getProductSummary().filter((product) => product.onlineStoreEnabled);

  return (
    <>
      <section className="storeHero">
        <div>
          <p className="eyebrow">NEW COLLECTION</p>
          <h1>Autumn Magnet Series</h1>
          <p>Premium Japanese nail colors, salon care products, and booking-ready nail design inspiration.</p>
          <div className="heroActions"><button className="primary">Shop Now</button><button className="ghost">Book Nail</button></div>
        </div>
      </section>

      <div className="sectionTitle storeTitle">
        <div><h2>Featured Products</h2><p>Storefront skeleton connected to the shared product catalog.</p></div>
        <button className="ghost">Preview Store</button>
      </div>

      <div className="productGrid">
        {featured.map((product) => (
          <article className="productCard" key={product.id}>
            <div className="storeImage">{product.productType}</div>
            <div className="productMeta">
              <span>{product.brandName}</span>
              <h3>{product.name}</h3>
              <p>{product.shortDescription}</p>
              <div><strong>{money(product.salePrice || product.basePrice)}</strong>{product.isLowStock && <span className="pill danger">Low stock</span>}</div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
