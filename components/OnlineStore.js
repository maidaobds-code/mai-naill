"use client";

import { useMemo, useState } from "react";
import { getProductSummary } from "../lib/ecommerce/data";
import { staff } from "../lib/salonData";
import { useBookingStore } from "../lib/bookingStore";

const services = [
  { name: "Gel One Color", duration: 75, price: 6500 },
  { name: "Magnet + Art", duration: 90, price: 9800 },
  { name: "French Design", duration: 90, price: 8800 },
  { name: "Extension + Art", duration: 105, price: 13500 },
  { name: "Foot Care", duration: 60, price: 7600 },
];

const timeSlots = Array.from({ length: 29 }, (_, index) => {
  const minutes = 9 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

function money(value) {
  return `JPY ${value.toLocaleString("ja-JP")}`;
}

function addMinutes(time, minutesToAdd) {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + minutesToAdd;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function OnlineStore() {
  const featured = getProductSummary().filter((product) => product.onlineStoreEnabled);
  const { addBooking } = useBookingStore();
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({ service: services[0].name, branch: "Glass Nail Shinjuku", date: "2026-10-06", day: 6, time: "09:00", staff: "", customer: "", phone: "", email: "" });
  const selectedService = useMemo(() => services.find((service) => service.name === draft.service) || services[0], [draft.service]);

  function updateDraft(field, value) {
    const next = { ...draft, [field]: value };
    if (field === "date") next.day = Number(value.slice(-2)) || 6;
    setDraft(next);
  }

  function submitBooking(event) {
    event.preventDefault();
    if (!draft.customer.trim() || !draft.phone.trim() || !draft.email.trim()) {
      setMessage("Vui long nhap du ten, so dien thoai va gmail.");
      return;
    }

    const saved = addBooking({
      day: draft.day,
      start: draft.time,
      end: addMinutes(draft.time, selectedService.duration),
      customer: draft.customer.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      service: selectedService.name,
      staff: draft.staff || staff[0].name,
      source: "direct",
      origin: "Website booking",
      price: selectedService.price,
      commissionRule: "Website direct",
    });

    setMessage(`Da dat lich ${saved.start} ngay ${draft.date}. Lich hen da tu dong cap nhat vao trang Calendar.`);
    setDraft((current) => ({ ...current, customer: "", phone: "", email: "" }));
  }

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

      <section className="card storeBooking bookingSurface">
        <div className="sectionTitle"><div><h2>Dat lich hen nail</h2><p>Chon dich vu, nhan vien va gio tu 09:00 den 23:00. Ten, so dien thoai va gmail la bat buoc.</p></div></div>
        <form onSubmit={submitBooking}>
          <div className="bookingFormGrid">
            <label>Dich vu<select value={draft.service} onChange={(event) => updateDraft("service", event.target.value)}>{services.map((service) => <option key={service.name}>{service.name}</option>)}</select></label>
            <label>Chi nhanh<select value={draft.branch} onChange={(event) => updateDraft("branch", event.target.value)}><option>Glass Nail Shinjuku</option><option>Glass Nail Ikebukuro</option></select></label>
            <label>Ngay<input type="date" value={draft.date} onChange={(event) => updateDraft("date", event.target.value)} /></label>
            <label>Gio<select value={draft.time} onChange={(event) => updateDraft("time", event.target.value)}>{timeSlots.map((time) => <option key={time}>{time}</option>)}</select></label>
            <label>Nhan vien<select value={draft.staff} onChange={(event) => updateDraft("staff", event.target.value)}><option value="">Tu dong chon</option>{staff.map((member) => <option key={member.id}>{member.name}</option>)}</select></label>
            <label>Gmail<input required type="email" value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} placeholder="name@gmail.com" /></label>
            <label>Ten khach hang<input required value={draft.customer} onChange={(event) => updateDraft("customer", event.target.value)} placeholder="Nguyen Van A" /></label>
            <label>So dien thoai<input required value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} placeholder="090-0000-0000" /></label>
          </div>
          <div className="bookingCheckoutBar"><span>{selectedService.duration} phut · {money(selectedService.price)}</span><button className="primary" type="submit">Xac nhan dat lich</button></div>
        </form>
        {message && <p className="storeNote successNote">{message}</p>}
      </section>
    </>
  );
}
