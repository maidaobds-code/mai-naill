"use client";
import { getProductSummary } from "../lib/ecommerce/data";
import { staff } from "../lib/salonData";

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
      <section className="card storeBooking">
        <div className="sectionTitle"><div><h2>Đặt lịch hẹn nail</h2><p>Khách chọn dịch vụ, chi nhánh, ngày giờ; chỉ hiển thị nhân viên phù hợp còn trống đủ thời lượng.</p></div><button className="primary">Xác nhận đặt lịch</button></div>
        <div className="staffForm">
          <label>Dịch vụ<select><option>Gel One Color - 75 phút</option><option>Magnet + Art - 90 phút</option></select></label>
          <label>Chi nhánh<select><option>Glass Nail Shinjuku</option><option>Glass Nail Ikebukuro</option></select></label>
          <label>Ngày<input type="date" defaultValue="2026-10-06" /></label>
          <label>Giờ<select><option>10:00</option><option>11:30</option><option>14:00</option></select></label>
          <label>Chỉ định nhân viên<select><option>Không chỉ định</option>{staff.map((member) => <option key={member.id}>{member.name}</option>)}</select></label>
          <label>Khách hàng<input placeholder="Tên và số điện thoại" /></label>
        </div>
        <p className="storeNote">Production sẽ kiểm tra trùng lịch bằng transaction Supabase rồi tạo appointment và realtime về lịch quản lý.</p>
      </section>
    </>
  );
}
