"use client";

import { useEffect, useMemo, useState } from "react";
import { useBookingStore } from "../lib/bookingStore";
import { useProductCatalog, useServiceCatalog } from "../lib/catalogStore";
import { useStoreOrders } from "../lib/orderStore";
import { getAppSettings } from "./Settings";
import { staff } from "../lib/salonData";

const timeSlots = Array.from({ length: 29 }, (_, index) => {
  const minutes = 9 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

const emptyCheckout = { fulfillmentType: "pickup", paymentMethod: "payAtStore", customer: "", phone: "", email: "", address: "", note: "", transferBillUrl: "", transferBillName: "" };

function money(value) {
  return `JPY ${Number(value || 0).toLocaleString("ja-JP")}`;
}

function addMinutes(time, minutesToAdd) {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + minutesToAdd;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function paymentOptions(settings, fulfillmentType) {
  if (fulfillmentType === "pickup") return settings.payAtStoreEnabled ? [{ id: "payAtStore", label: "Den cua hang lay va thanh toan tai cua hang" }] : [];
  return [
    settings.bankTransferEnabled && { id: "bankTransfer", label: "Chuyen khoan" },
    settings.cardEnabled && { id: "card", label: "Thanh toan the" },
    settings.codEnabled && { id: "cod", label: "Thanh toan khi nhan hang" },
  ].filter(Boolean);
}

export default function OnlineStore() {
  const [products] = useProductCatalog();
  const [services] = useServiceCatalog();
  const { orders, addOrder, updateOrder, addChatMessage } = useStoreOrders();
  const [settings, setSettings] = useState(getAppSettings);
  const featured = products.filter((product) => product.onlineStoreEnabled !== false);
  const activeServices = services.length ? services : [];
  const { addBooking } = useBookingStore();
  const [message, setMessage] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [checkout, setCheckout] = useState(emptyCheckout);
  const [trackingId, setTrackingId] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [draft, setDraft] = useState({ service: activeServices[0]?.name || "", branch: "Glass Nail Shinjuku", date: "2026-10-06", day: 6, time: "09:00", staff: "", customer: "", phone: "", email: "" });
  const selectedService = useMemo(() => activeServices.find((service) => service.name === draft.service) || activeServices[0], [activeServices, draft.service]);
  const trackedOrder = orders.find((order) => order.orderNumber === trackingId || order.id === trackingId) || orders[0];
  const availablePayments = paymentOptions(settings, checkout.fulfillmentType);

  useEffect(() => {
    setSettings(getAppSettings());
  }, []);

  function updateDraft(field, value) {
    const next = { ...draft, [field]: value };
    if (field === "date") next.day = Number(value.slice(-2)) || 6;
    setDraft(next);
  }

  function chooseService(service) {
    setDraft((current) => ({ ...current, service: service.name, staff: service.staff?.[0] || current.staff }));
  }

  function openBuy(product) {
    setSelectedProduct(product);
    const firstPayment = paymentOptions(settings, "pickup")[0]?.id || "payAtStore";
    setCheckout({ ...emptyCheckout, paymentMethod: firstPayment });
  }

  function updateCheckout(field, value) {
    setCheckout((current) => {
      const next = { ...current, [field]: value };
      if (field === "fulfillmentType") next.paymentMethod = paymentOptions(settings, value)[0]?.id || "";
      return next;
    });
  }

  function uploadTransferBill(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCheckout((current) => ({ ...current, transferBillUrl: reader.result, transferBillName: file.name }));
    reader.readAsDataURL(file);
  }

  function submitProductOrder(event) {
    event.preventDefault();
    if (!selectedProduct) return;
    if (Number(selectedProduct.stock || 0) <= 0) {
      setMessage("San pham nay hien het hang nen chua the mua.");
      return;
    }
    if (!checkout.customer.trim() || !checkout.phone.trim() || !checkout.email.trim()) {
      setMessage("Vui long nhap ten, so dien thoai va gmail.");
      return;
    }
    if (checkout.fulfillmentType === "shipping" && !checkout.address.trim()) {
      setMessage("Phuong thuc gui hang can dia chi nhan hang.");
      return;
    }
    if (checkout.fulfillmentType === "shipping" && !checkout.paymentMethod) {
      setMessage("Vui long chon phuong thuc thanh toan.");
      return;
    }

    const order = addOrder({
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity: 1,
      total: selectedProduct.salePrice || selectedProduct.basePrice,
      stockAtOrder: selectedProduct.stock,
      customer: checkout.customer.trim(),
      phone: checkout.phone.trim(),
      email: checkout.email.trim(),
      fulfillmentType: checkout.fulfillmentType,
      paymentMethod: checkout.paymentMethod,
      address: checkout.address.trim(),
      note: checkout.note.trim(),
      transferBillUrl: checkout.transferBillUrl,
      transferBillName: checkout.transferBillName,
    });
    setTrackingId(order.orderNumber);
    setMessage(`Da tao don ${order.orderNumber}. Ban co the theo doi don va chat voi chu quan ben duoi.`);
    setSelectedProduct(null);
  }

  function submitBooking(event) {
    event.preventDefault();
    if (!selectedService) return;
    if (!draft.customer.trim() || !draft.phone.trim() || !draft.email.trim()) {
      setMessage("Vui long nhap du ten, so dien thoai va gmail.");
      return;
    }

    const saved = addBooking({ day: draft.day, start: draft.time, end: addMinutes(draft.time, selectedService.duration), customer: draft.customer.trim(), phone: draft.phone.trim(), email: draft.email.trim(), service: selectedService.name, staff: draft.staff || selectedService.staff?.[0] || staff[0].name, source: "direct", origin: "Website booking", price: selectedService.price, commissionRule: "Website direct" });
    setMessage(`Da dat lich ${saved.start} ngay ${draft.date}. Lich hen da tu dong cap nhat vao trang Calendar.`);
    setDraft((current) => ({ ...current, customer: "", phone: "", email: "" }));
  }

  return (
    <div className="storeSoftShell">
      <section className="storeHero softHero"><div><p className="eyebrow">GLASS NAIL TOKYO</p><h1>Book your nail day</h1><p>Chon mau, chon dich vu, dat lich va mua san pham trong mot web ban hang.</p><div className="heroActions"><button className="primary">Shop Now</button><button className="ghost">Book Nail</button></div></div></section>

      <div className="sectionTitle storeTitle"><div><h2>Featured Products</h2><p>Moi san pham co nut mua va kiem tra ton kho truoc khi tao don.</p></div><button className="ghost">Preview Store</button></div>
      <div className="productGrid softProductGrid">
        {featured.map((product) => {
          const canBuy = Number(product.stock || 0) > 0 && product.status !== "DRAFT";
          return <article className="productCard softProductCard" key={product.id}><div className="storeImage softStoreImage">{product.mediaUrl ? <img src={product.mediaUrl} alt={product.name} /> : <span>{product.productType || "Nail"}</span>}</div><div className="productMeta"><span>{product.brandName}</span><h3>{product.name}</h3><p>{product.description || product.shortDescription}</p><div><strong>{money(product.salePrice || product.basePrice)}</strong><span className={canBuy ? "pill active" : "pill danger"}>{canBuy ? `Con ${product.stock} trong kho` : "Het hang"}</span></div><button className="primary buyButton" onClick={() => openBuy(product)}>{canBuy ? "Mua" : "Xem tinh trang"}</button></div></article>;
        })}
      </div>

      <section className="card orderTrackerPanel">
        <div className="sectionTitle"><div><h2>Theo doi don hang</h2><p>Nhap ma don hoac xem don moi nhat, chat truc tiep voi chu quan.</p></div></div>
        <div className="trackerSearch"><input value={trackingId} onChange={(event) => setTrackingId(event.target.value)} placeholder="WEB-123456" /><button className="ghost" onClick={() => setTrackingId(orders[0]?.orderNumber || "")}>Don moi nhat</button></div>
        {trackedOrder ? <div className="trackingCard"><div><strong>{trackedOrder.orderNumber}</strong><span>{trackedOrder.productName} · {money(trackedOrder.total)}</span><small>{trackedOrder.status} · {trackedOrder.paymentStatus}</small></div>{trackedOrder.transferBillUrl && <img src={trackedOrder.transferBillUrl} alt="Transfer bill" />}<div className="chatBox">{(trackedOrder.chat || []).map((item) => <p key={item.id}>{item.text}</p>)}<div><input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Nhan tin cho chu quan" /><button className="primary" onClick={() => { addChatMessage(trackedOrder.id, chatDraft); setChatDraft(""); }}>Gui</button></div></div></div> : <p className="storeNote">Chua co don hang nao.</p>}
      </section>

      <section className="card storeBooking bookingSurface softBookingPanel"><div className="sectionTitle"><div><h2>Dat lich hen nail</h2><p>Chon dich vu bang the anh. Ten, so dien thoai va gmail la bat buoc.</p></div></div><div className="serviceChoiceRail">{activeServices.map((service) => <button type="button" key={service.id} className={draft.service === service.name ? "serviceChoice active" : "serviceChoice"} onClick={() => chooseService(service)}>{service.imageUrl ? <img src={service.imageUrl} alt={service.name} /> : <span>{service.name.slice(0, 1)}</span>}<strong>{service.name}</strong><small>{service.duration} phut · {money(service.price)}</small></button>)}</div><form onSubmit={submitBooking}><div className="bookingFormGrid softBookingGrid"><label>Dich vu<select value={draft.service} onChange={(event) => updateDraft("service", event.target.value)}>{activeServices.map((service) => <option key={service.id}>{service.name}</option>)}</select></label><label>Chi nhanh<select value={draft.branch} onChange={(event) => updateDraft("branch", event.target.value)}><option>Glass Nail Shinjuku</option><option>Glass Nail Ikebukuro</option></select></label><label>Ngay<input type="date" value={draft.date} onChange={(event) => updateDraft("date", event.target.value)} /></label><label>Gio<select value={draft.time} onChange={(event) => updateDraft("time", event.target.value)}>{timeSlots.map((time) => <option key={time}>{time}</option>)}</select></label><label>Nhan vien<select value={draft.staff} onChange={(event) => updateDraft("staff", event.target.value)}><option value="">Tu dong chon</option>{staff.map((member) => <option key={member.id}>{member.name}</option>)}</select></label><label>Gmail<input required type="email" value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} placeholder="name@gmail.com" /></label><label>Ten khach hang<input required value={draft.customer} onChange={(event) => updateDraft("customer", event.target.value)} placeholder="Nguyen Van A" /></label><label>So dien thoai<input required value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} placeholder="090-0000-0000" /></label></div><div className="bookingCheckoutBar"><span>{selectedService ? `${selectedService.duration} phut · ${money(selectedService.price)}` : "Chon dich vu"}</span><button className="primary" type="submit">Xac nhan dat lich</button></div></form>{message && <p className="storeNote successNote">{message}</p>}</section>

      {selectedProduct && <div className="bookingModalBackdrop" onMouseDown={() => setSelectedProduct(null)}><form className="card bookingModal productCheckoutModal" onSubmit={submitProductOrder} onMouseDown={(event) => event.stopPropagation()}><div className="modalHead"><div><p className="eyebrow">PRODUCT CHECKOUT</p><h2>{selectedProduct.name}</h2><p>{Number(selectedProduct.stock || 0) > 0 ? `Con ${selectedProduct.stock} san pham co the mua` : "San pham het hang"}</p></div><button className="ghost" type="button" onClick={() => setSelectedProduct(null)}>Close</button></div><div className="checkoutProductLine">{selectedProduct.mediaUrl && <img src={selectedProduct.mediaUrl} alt={selectedProduct.name} />}<div><strong>{money(selectedProduct.salePrice || selectedProduct.basePrice)}</strong><span>{selectedProduct.description || selectedProduct.shortDescription}</span></div></div><div className="fulfillmentTabs"><button type="button" className={checkout.fulfillmentType === "pickup" ? "active" : ""} onClick={() => updateCheckout("fulfillmentType", "pickup")}>Den cua hang lay</button><button type="button" className={checkout.fulfillmentType === "shipping" ? "active" : ""} onClick={() => updateCheckout("fulfillmentType", "shipping")}>Gui hang</button></div><div className="formGrid modalForm"><label>Ten khach hang<input required value={checkout.customer} onChange={(event) => updateCheckout("customer", event.target.value)} /></label><label>So dien thoai<input required value={checkout.phone} onChange={(event) => updateCheckout("phone", event.target.value)} /></label><label>Gmail<input required type="email" value={checkout.email} onChange={(event) => updateCheckout("email", event.target.value)} /></label>{checkout.fulfillmentType === "shipping" && <><label>Phuong thuc thanh toan<select value={checkout.paymentMethod} onChange={(event) => updateCheckout("paymentMethod", event.target.value)}>{availablePayments.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="fullField">Dia chi nhan hang<input required value={checkout.address} onChange={(event) => updateCheckout("address", event.target.value)} /></label><label className="fullField">Ghi chu giao hang<input value={checkout.note} onChange={(event) => updateCheckout("note", event.target.value)} /></label>{checkout.paymentMethod === "bankTransfer" && <div className="bankTransferBox fullField"><strong>{settings.bankName} · {settings.bankAccount}</strong><span>{settings.bankHolder}</span><small>{settings.paymentNote}</small><label>Upload bill chuyen khoan<input type="file" accept="image/*" onChange={uploadTransferBill} /></label>{checkout.transferBillUrl && <img src={checkout.transferBillUrl} alt="Transfer bill preview" />}</div>}</>}</div><div className="modalActions"><button className="ghost" type="button" onClick={() => setSelectedProduct(null)}>Cancel</button><button className="primary" type="submit" disabled={Number(selectedProduct.stock || 0) <= 0}>Tao don hang</button></div></form></div>}
    </div>
  );
}
