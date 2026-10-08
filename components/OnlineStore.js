"use client";

import { useMemo, useState } from "react";
import { useBookingStore } from "../lib/bookingStore";
import { useProductCatalog, useServiceCatalog } from "../lib/catalogStore";
import { staff } from "../lib/salonData";

const timeSlots = Array.from({ length: 29 }, (_, index) => {
  const minutes = 9 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

function money(value) {
  return `JPY ${Number(value || 0).toLocaleString("ja-JP")}`;
}

function addMinutes(time, minutesToAdd) {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + minutesToAdd;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function OnlineStore() {
  const [products] = useProductCatalog();
  const [services] = useServiceCatalog();
  const featured = products.filter((product) => product.onlineStoreEnabled !== false);
  const activeServices = services.length ? services : [];
  const { addBooking } = useBookingStore();
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({ service: activeServices[0]?.name || "", branch: "Glass Nail Shinjuku", date: "2026-10-06", day: 6, time: "09:00", staff: "", customer: "", phone: "", email: "" });
  const selectedService = useMemo(() => activeServices.find((service) => service.name === draft.service) || activeServices[0], [activeServices, draft.service]);

  function updateDraft(field, value) {
    const next = { ...draft, [field]: value };
    if (field === "date") next.day = Number(value.slice(-2)) || 6;
    setDraft(next);
  }

  function chooseService(service) {
    setDraft((current) => ({ ...current, service: service.name, staff: service.staff?.[0] || current.staff }));
  }

  function submitBooking(event) {
    event.preventDefault();
    if (!selectedService) return;
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
      staff: draft.staff || selectedService.staff?.[0] || staff[0].name,
      source: "direct",
      origin: "Website booking",
      price: selectedService.price,
      commissionRule: "Website direct",
    });

    setMessage(`Da dat lich ${saved.start} ngay ${draft.date}. Lich hen da tu dong cap nhat vao trang Calendar.`);
    setDraft((current) => ({ ...current, customer: "", phone: "", email: "" }));
  }

  return (
    <div className="storeSoftShell">
      <section className="storeHero softHero">
        <div>
          <p className="eyebrow">GLASS NAIL TOKYO</p>
          <h1>Book your nail day</h1>
          <p>Chon mau, chon dich vu, dat lich mem nhu mot ung dung mobile.</p>
          <div className="heroActions"><button className="primary">Shop Now</button><button className="ghost">Book Nail</button></div>
        </div>
      </section>

      <div className="sectionTitle storeTitle"><div><h2>Featured Products</h2><p>San pham tu trang kho dong bo len website ban hang.</p></div><button className="ghost">Preview Store</button></div>
      <div className="productGrid softProductGrid">
        {featured.map((product) => (
          <article className="productCard softProductCard" key={product.id}>
            <div className="storeImage softStoreImage">{product.mediaUrl ? <img src={product.mediaUrl} alt={product.name} /> : <span>{product.productType || "Nail"}</span>}</div>
            <div className="productMeta"><span>{product.brandName}</span><h3>{product.name}</h3><p>{product.description || product.shortDescription}</p><div><strong>{money(product.salePrice || product.basePrice)}</strong>{product.isLowStock && <span className="pill danger">Low stock</span>}</div></div>
          </article>
        ))}
      </div>

      <section className="card storeBooking bookingSurface softBookingPanel">
        <div className="sectionTitle"><div><h2>Dat lich hen nail</h2><p>Chon dich vu bang the anh. Ten, so dien thoai va gmail la bat buoc.</p></div></div>
        <div className="serviceChoiceRail">
          {activeServices.map((service) => <button type="button" key={service.id} className={draft.service === service.name ? "serviceChoice active" : "serviceChoice"} onClick={() => chooseService(service)}>{service.imageUrl ? <img src={service.imageUrl} alt={service.name} /> : <span>{service.name.slice(0, 1)}</span>}<strong>{service.name}</strong><small>{service.duration} phut · {money(service.price)}</small></button>)}
        </div>
        <form onSubmit={submitBooking}>
          <div className="bookingFormGrid softBookingGrid">
            <label>Dich vu<select value={draft.service} onChange={(event) => updateDraft("service", event.target.value)}>{activeServices.map((service) => <option key={service.id}>{service.name}</option>)}</select></label>
            <label>Chi nhanh<select value={draft.branch} onChange={(event) => updateDraft("branch", event.target.value)}><option>Glass Nail Shinjuku</option><option>Glass Nail Ikebukuro</option></select></label>
            <label>Ngay<input type="date" value={draft.date} onChange={(event) => updateDraft("date", event.target.value)} /></label>
            <label>Gio<select value={draft.time} onChange={(event) => updateDraft("time", event.target.value)}>{timeSlots.map((time) => <option key={time}>{time}</option>)}</select></label>
            <label>Nhan vien<select value={draft.staff} onChange={(event) => updateDraft("staff", event.target.value)}><option value="">Tu dong chon</option>{staff.map((member) => <option key={member.id}>{member.name}</option>)}</select></label>
            <label>Gmail<input required type="email" value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} placeholder="name@gmail.com" /></label>
            <label>Ten khach hang<input required value={draft.customer} onChange={(event) => updateDraft("customer", event.target.value)} placeholder="Nguyen Van A" /></label>
            <label>So dien thoai<input required value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} placeholder="090-0000-0000" /></label>
          </div>
          <div className="bookingCheckoutBar"><span>{selectedService ? `${selectedService.duration} phut · ${money(selectedService.price)}` : "Chon dich vu"}</span><button className="primary" type="submit">Xac nhan dat lich</button></div>
        </form>
        {message && <p className="storeNote successNote">{message}</p>}
      </section>
    </div>
  );
}
