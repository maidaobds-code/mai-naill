"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useBookingStore } from "../lib/bookingStore";
import { useProductCatalog, useServiceCatalog } from "../lib/catalogStore";
import { useStoreOrders } from "../lib/orderStore";
import { getAppSettings } from "./Settings";
import { tx } from "../lib/i18nClean";
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

function paymentOptions(settings, fulfillmentType, language = "vi") {
  if (fulfillmentType === "pickup") return settings.payAtStoreEnabled ? [{ id: "payAtStore", label: tx(language, "settingsPage", "payAtStore") }] : [];
  return [
    settings.bankTransferEnabled && { id: "bankTransfer", label: tx(language, "settingsPage", "bankTransfer") },
    settings.cardEnabled && { id: "card", label: tx(language, "settingsPage", "card") },
    settings.codEnabled && { id: "cod", label: tx(language, "settingsPage", "cod") },
  ].filter(Boolean);
}

export default function OnlineStore({ language = "vi" }) {
  const tr = (key, vars) => tx(language, "online", key, vars);
  const tc = (key) => tx(language, "common", key);
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
  const [productSearch, setProductSearch] = useState("");
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const productRailRef = useRef(null);
  const [draft, setDraft] = useState({ service: activeServices[0]?.name || "", branch: "Mai Beauty Salon Tokyo", date: "2026-10-06", day: 6, time: "09:00", staff: "", customer: "", phone: "", email: "" });
  const selectedService = useMemo(() => activeServices.find((service) => service.name === draft.service) || activeServices[0], [activeServices, draft.service]);
  const trackedOrder = orders.find((order) => order.orderNumber === trackingId || order.id === trackingId) || orders[0];
  const availablePayments = paymentOptions(settings, checkout.fulfillmentType, language);
  const visibleFeatured = featured.filter((product) => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return true;
    return [product.name, product.brandName, product.productType, product.description, product.shortDescription].some((value) => String(value || "").toLowerCase().includes(term));
  });

  useEffect(() => {
    setSettings(getAppSettings());
  }, []);

  useEffect(() => {
    setFeaturedIndex(0);
    productRailRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  }, [productSearch, visibleFeatured.length]);

  useEffect(() => {
    if (visibleFeatured.length < 2) return;
    const timer = window.setInterval(() => {
      setFeaturedIndex((current) => (current + 1) % visibleFeatured.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [visibleFeatured.length]);

  useEffect(() => {
    scrollFeaturedTo(featuredIndex);
  }, [featuredIndex, visibleFeatured.length]);

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
    const firstPayment = paymentOptions(settings, "pickup", language)[0]?.id || "payAtStore";
    setCheckout({ ...emptyCheckout, paymentMethod: firstPayment });
  }

  function scrollToBooking() {
    document.getElementById("online-booking")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submitProductSearch(event) {
    event.preventDefault();
    setFeaturedIndex(0);
  }

  function scrollFeaturedTo(index) {
    const rail = productRailRef.current;
    const card = rail?.querySelector(`[data-product-slide="${index}"]`);
    if (!rail || !card) return;
    rail.scrollTo({ left: card.offsetLeft - rail.offsetLeft, behavior: "smooth" });
  }

  function moveFeatured(direction) {
    if (!visibleFeatured.length) return;
    setFeaturedIndex((current) => (current + direction + visibleFeatured.length) % visibleFeatured.length);
  }

  function updateCheckout(field, value) {
    setCheckout((current) => {
      const next = { ...current, [field]: value };
      if (field === "fulfillmentType") next.paymentMethod = paymentOptions(settings, value, language)[0]?.id || "";
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
      setMessage(tr("outOfStock"));
      return;
    }
    if (!checkout.customer.trim() || !checkout.phone.trim() || !checkout.email.trim()) {
      setMessage(tr("requiredInfo"));
      return;
    }
    if (checkout.fulfillmentType === "shipping" && !checkout.address.trim()) {
      setMessage(tr("requiredAddress"));
      return;
    }
    if (checkout.fulfillmentType === "shipping" && !checkout.paymentMethod) {
      setMessage(tr("paymentMethod"));
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
    setMessage(tr("orderCreated", { order: order.orderNumber }));
    setSelectedProduct(null);
  }

  function submitBooking(event) {
    event.preventDefault();
    if (!selectedService) return;
    if (!draft.customer.trim() || !draft.phone.trim() || !draft.email.trim()) {
      setMessage(tr("requiredInfo"));
      return;
    }

    const saved = addBooking({ day: draft.day, start: draft.time, end: addMinutes(draft.time, selectedService.duration), customer: draft.customer.trim(), phone: draft.phone.trim(), email: draft.email.trim(), service: selectedService.name, staff: draft.staff || selectedService.staff?.[0] || staff[0].name, source: "direct", origin: "Website booking", price: selectedService.price, commissionRule: "Website direct" });
    setMessage(tr("bookingCreated", { time: saved.start, date: draft.date }));
    setDraft((current) => ({ ...current, customer: "", phone: "", email: "" }));
  }

  return (
    <div className="storeSoftShell">
      <section className="storeHero softHero"><div><p className="eyebrow">MAI BEAUTY SALON</p><h1>{tr("heroTitle")}</h1><p>{tr("heroText")}</p><form className="heroActions storeSearchBar" onSubmit={submitProductSearch}><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Tìm sản phẩm / 商品検索" /><button className="primary" type="submit">Tìm kiếm</button><button className="ghost" type="button" onClick={scrollToBooking}>{tr("bookNail")}</button></form></div></section>

      <div className="sectionTitle storeTitle"><div><h2>{tr("productsTitle")}</h2><p>Tự động chạy vòng tròn liên tục từ 2 sản phẩm trở lên.</p></div><span className={visibleFeatured.length > 1 ? "carouselAutoBadge active" : "carouselAutoBadge"}><i />Tự động chạy</span></div>
      <div className="featuredCarouselShell">
        {visibleFeatured.length > 1 && <button className="carouselArrow prev" type="button" onClick={() => moveFeatured(-1)} aria-label="Sản phẩm trước">‹</button>}
        <div className="productGrid softProductGrid productCarouselRail" ref={productRailRef}>
          {visibleFeatured.map((product, index) => {
            const canBuy = Number(product.stock || 0) > 0 && product.status !== "DRAFT";
            return <article className={index === featuredIndex ? "productCard softProductCard activeSlide" : "productCard softProductCard"} data-product-slide={index} key={product.id}><div className="storeImage softStoreImage">{product.mediaUrl ? <img src={product.mediaUrl} alt={product.name} /> : <span>{product.productType || "Nail"}</span>}</div><div className="productMeta"><span>{product.brandName || `Sản phẩm ${index + 1}`}</span><h3>{product.name}</h3><p>{product.description || product.shortDescription}</p><div><strong>{money(product.salePrice || product.basePrice)}</strong><span className={canBuy ? "pill active" : "pill danger"}>{canBuy ? tr("canBuy", { stock: product.stock }) : tr("outOfStock")}</span></div><button className="primary buyButton" onClick={() => openBuy(product)}>{canBuy ? tr("buy") : tr("viewStatus")}</button></div></article>;
          })}
          {!visibleFeatured.length && <p className="storeNote">Không tìm thấy sản phẩm phù hợp.</p>}
        </div>
        {visibleFeatured.length > 1 && <button className="carouselArrow next" type="button" onClick={() => moveFeatured(1)} aria-label="Sản phẩm tiếp theo">›</button>}
      </div>
      {visibleFeatured.length > 1 && <div className="carouselDots">{visibleFeatured.map((product, index) => <button key={product.id} className={index === featuredIndex ? "active" : ""} type="button" onClick={() => setFeaturedIndex(index)} aria-label={`Xem sản phẩm ${index + 1}`} />)}</div>}

      <section className="card orderTrackerPanel">
        <div className="sectionTitle"><div><h2>{tr("trackerTitle")}</h2><p>{tr("trackerText")}</p></div></div>
        <div className="trackerSearch"><input value={trackingId} onChange={(event) => setTrackingId(event.target.value)} placeholder="WEB-123456" /><button className="ghost" onClick={() => setTrackingId(orders[0]?.orderNumber || "")}>{tr("latestOrder")}</button></div>
        {trackedOrder ? <div className="trackingCard"><div><strong>{trackedOrder.orderNumber}</strong><span>{trackedOrder.productName} · {money(trackedOrder.total)}</span><small>{trackedOrder.status} · {trackedOrder.paymentStatus}</small></div>{trackedOrder.transferBillUrl && <img src={trackedOrder.transferBillUrl} alt="Transfer bill" />}<div className="chatBox">{(trackedOrder.chat || []).map((item) => <p key={item.id}>{item.text}</p>)}<div><input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder={tr("chatPlaceholder")} /><button className="primary" onClick={() => { addChatMessage(trackedOrder.id, chatDraft); setChatDraft(""); }}>{tc("send")}</button></div></div></div> : <p className="storeNote">{tr("noOrders")}</p>}
      </section>

      <section id="online-booking" className="card storeBooking bookingSurface softBookingPanel"><div className="sectionTitle"><div><h2>{tr("bookingTitle")}</h2><p>{tr("bookingText")}</p></div></div><div className="serviceChoiceRail">{activeServices.map((service) => <button type="button" key={service.id} className={draft.service === service.name ? "serviceChoice active" : "serviceChoice"} onClick={() => chooseService(service)}>{service.imageUrl ? <img src={service.imageUrl} alt={service.name} /> : <span>{service.name.slice(0, 1)}</span>}<strong>{service.name}</strong><small>{service.duration} min · {money(service.price)}</small></button>)}</div><form onSubmit={submitBooking}><div className="bookingFormGrid softBookingGrid"><label>{tc("service")}<select value={draft.service} onChange={(event) => updateDraft("service", event.target.value)}>{activeServices.map((service) => <option key={service.id}>{service.name}</option>)}</select></label><label>Branch<select value={draft.branch} onChange={(event) => updateDraft("branch", event.target.value)}><option>Mai Beauty Salon Tokyo</option><option>Mai Beauty Salon Osaka</option></select></label><label>{tc("date")}<input type="date" value={draft.date} onChange={(event) => updateDraft("date", event.target.value)} /></label><label>{tc("time")}<select value={draft.time} onChange={(event) => updateDraft("time", event.target.value)}>{timeSlots.map((time) => <option key={time}>{time}</option>)}</select></label><label>{tc("staff")}<select value={draft.staff} onChange={(event) => updateDraft("staff", event.target.value)}><option value="">{tr("autoStaff")}</option>{staff.map((member) => <option key={member.id}>{member.name}</option>)}</select></label><label>{tc("email")}<input required type="email" value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} placeholder="name@gmail.com" /></label><label>{tc("customer")}<input required value={draft.customer} onChange={(event) => updateDraft("customer", event.target.value)} placeholder="Nguyen Van A" /></label><label>{tc("phone")}<input required value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} placeholder="090-0000-0000" /></label></div><div className="bookingCheckoutBar"><span>{selectedService ? `${selectedService.duration} min · ${money(selectedService.price)}` : tr("chooseService")}</span><button className="primary" type="submit">{tr("confirmBooking")}</button></div></form>{message && <p className="storeNote successNote">{message}</p>}</section>

      {selectedProduct && <div className="bookingModalBackdrop" onMouseDown={() => setSelectedProduct(null)}><form className="card bookingModal productCheckoutModal" onSubmit={submitProductOrder} onMouseDown={(event) => event.stopPropagation()}><div className="modalHead"><div><p className="eyebrow">{tr("checkoutTitle")}</p><h2>{selectedProduct.name}</h2><p>{Number(selectedProduct.stock || 0) > 0 ? tr("canBuy", { stock: selectedProduct.stock }) : tr("outOfStock")}</p></div><button className="ghost" type="button" onClick={() => setSelectedProduct(null)}>{tc("close")}</button></div><div className="checkoutProductLine">{selectedProduct.mediaUrl && <img src={selectedProduct.mediaUrl} alt={selectedProduct.name} />}<div><strong>{money(selectedProduct.salePrice || selectedProduct.basePrice)}</strong><span>{selectedProduct.description || selectedProduct.shortDescription}</span></div></div><div className="fulfillmentTabs"><button type="button" className={checkout.fulfillmentType === "pickup" ? "active" : ""} onClick={() => updateCheckout("fulfillmentType", "pickup")}>{tr("pickup")}</button><button type="button" className={checkout.fulfillmentType === "shipping" ? "active" : ""} onClick={() => updateCheckout("fulfillmentType", "shipping")}>{tr("shipping")}</button></div><div className="formGrid modalForm"><label>{tc("customer")}<input required value={checkout.customer} onChange={(event) => updateCheckout("customer", event.target.value)} /></label><label>{tc("phone")}<input required value={checkout.phone} onChange={(event) => updateCheckout("phone", event.target.value)} /></label><label>{tc("email")}<input required type="email" value={checkout.email} onChange={(event) => updateCheckout("email", event.target.value)} /></label>{checkout.fulfillmentType === "shipping" && <><label>{tr("paymentMethod")}<select value={checkout.paymentMethod} onChange={(event) => updateCheckout("paymentMethod", event.target.value)}>{availablePayments.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="fullField">{tr("deliveryAddress")}<input required value={checkout.address} onChange={(event) => updateCheckout("address", event.target.value)} /></label><label className="fullField">{tr("deliveryNote")}<input value={checkout.note} onChange={(event) => updateCheckout("note", event.target.value)} /></label>{checkout.paymentMethod === "bankTransfer" && <div className="bankTransferBox fullField"><strong>{settings.bankName} · {settings.bankAccount}</strong><span>{settings.bankHolder}</span><small>{settings.paymentNote}</small><label>{tr("uploadBill")}<input type="file" accept="image/*" onChange={uploadTransferBill} /></label>{checkout.transferBillUrl && <img src={checkout.transferBillUrl} alt="Transfer bill preview" />}</div>}</>}</div><div className="modalActions"><button className="ghost" type="button" onClick={() => setSelectedProduct(null)}>{tc("cancel")}</button><button className="primary" type="submit" disabled={Number(selectedProduct.stock || 0) <= 0}>{tr("createOrder")}</button></div></form></div>}
    </div>
  );
}

