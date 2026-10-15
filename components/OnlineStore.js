"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useBookingStore } from "../lib/bookingStore";
import { useProductCatalog, useServiceCatalog } from "../lib/catalogStore";
import { useStoreOrders } from "../lib/orderStore";
import { getAppSettings } from "./Settings";
import { languages, t, tx } from "../lib/i18nClean";
import { staff } from "../lib/salonData";
import { CustomerProfile } from "./AccountAccess";
import { useAccountStore } from "../lib/accountStore";

const timeSlots = Array.from({ length: 29 }, (_, index) => {
  const minutes = 9 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

const emptyCheckout = { fulfillmentType: "pickup", paymentMethod: "payAtStore", customer: "", phone: "", email: "", postalCode: "", address: "", note: "", transferBillUrl: "", transferBillName: "" };
const LANGUAGE_KEY = "nail-japan-store-language";

function storedLanguage(fallback) {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(LANGUAGE_KEY) || fallback;
}

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
    (settings.qrEnabled || settings.qrImageUrl) && { id: "qr", label: language === "ja" ? "QRコード決済" : language === "en" ? "QR code payment" : "Thanh toán bằng mã QR", image: settings.qrImageUrl },
    settings.cardEnabled && { id: "card", label: tx(language, "settingsPage", "card") },
    settings.codEnabled && { id: "cod", label: tx(language, "settingsPage", "cod") },
  ].filter(Boolean);
}

function notifyByEmail(payload) {
  return fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
}

export default function OnlineStore({ language: initialLanguage = "vi", setLanguage: externalSetLanguage, mode = "all" }) {
  const [language, setLanguage] = useState(() => storedLanguage(initialLanguage));
  const tr = (key, vars) => tx(language, "online", key, vars);
  const tc = (key) => tx(language, "common", key);
  const [products] = useProductCatalog();
  const [services] = useServiceCatalog();
  const { orders, addOrder, addChatMessage } = useStoreOrders();
  const { currentAccount } = useAccountStore();
  const [settings, setSettings] = useState(getAppSettings);
  const storeProducts = products.filter((product) => product.onlineStoreEnabled !== false);
  const featured = storeProducts.filter((product) => product.featuredOnline !== false);
  const activeServices = services.length ? services : [];
  const { addBooking } = useBookingStore();
  const [message, setMessage] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [checkout, setCheckout] = useState(emptyCheckout);
  const [paymentReview, setPaymentReview] = useState(false);
  const [postalLoading, setPostalLoading] = useState(false);
  const [trackingId, setTrackingId] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const productRailRef = useRef(null);
  const [draft, setDraft] = useState({ service: activeServices[0]?.name || "", branch: "Mai Beauty Salon Tokyo", date: "2026-10-06", day: 6, time: "09:00", staff: "", customer: "", phone: "", email: "" });
  const selectedService = useMemo(() => activeServices.find((service) => service.name === draft.service) || activeServices[0], [activeServices, draft.service]);
  const trackedOrder = orders.find((order) => order.orderNumber === trackingId || order.id === trackingId) || orders[0];
  const availablePayments = paymentOptions(settings, checkout.fulfillmentType, language);
  const showShop = mode !== "booking";
  const showBooking = mode !== "shop";
  const accountContact = {
    customer: currentAccount?.name || "",
    phone: currentAccount?.phone || "",
    email: currentAccount?.email || "",
    address: currentAccount?.address || "",
  };
  const localCopy = {
    vi: { search: "Tìm sản phẩm", noProducts: "Không tìm thấy sản phẩm phù hợp.", auto: "Tự động chạy", autoText: "Sản phẩm nổi bật được sắp xếp gọn để khách dễ chọn.", shop: "Mua hàng", previous: "Sản phẩm trước", next: "Sản phẩm tiếp theo", viewProduct: "Xem sản phẩm {index}", productFallback: "Sản phẩm {index}", productList: "Danh sách sản phẩm", productListText: "Tất cả sản phẩm đang bật bán trên web.", branch: "Chi nhánh", websiteBooking: "Đặt lịch website", minutes: "phút" },
    ja: { search: "商品を検索", noProducts: "該当する商品が見つかりません。", auto: "自動再生", autoText: "おすすめ商品を見やすく整理しています。", shop: "買い物", previous: "前の商品", next: "次の商品", viewProduct: "商品 {index} を表示", productFallback: "商品 {index}", productList: "商品一覧", productListText: "Web販売が有効な商品をすべて表示しています。", branch: "店舗", websiteBooking: "Web予約", minutes: "分" },
    en: { search: "Search products", noProducts: "No matching products found.", auto: "Auto play", autoText: "Featured products are arranged for easy browsing.", shop: "Shop", previous: "Previous product", next: "Next product", viewProduct: "View product {index}", productFallback: "Product {index}", productList: "Product list", productListText: "All products enabled for web sales.", branch: "Branch", websiteBooking: "Website booking", minutes: "min" },
  }[language] || {};
  const visibleFeatured = featured.filter((product) => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return true;
    return [product.name, product.brandName, product.productType, product.description, product.shortDescription].some((value) => String(value || "").toLowerCase().includes(term));
  });

  useEffect(() => {
    setSettings(getAppSettings());
  }, []);

  useEffect(() => {
    if (externalSetLanguage) setLanguage(initialLanguage);
  }, [externalSetLanguage, initialLanguage]);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_KEY, language);
  }, [language]);

  function changeLanguage(value) {
    setLanguage(value);
    externalSetLanguage?.(value);
    window.localStorage.setItem(LANGUAGE_KEY, value);
    window.localStorage.setItem("nail-japan-login-language", value);
    window.localStorage.setItem("nail-japan-language", value);
  }

  useEffect(() => {
    if (!currentAccount) return;
    setDraft((current) => ({
      ...current,
      customer: current.customer || accountContact.customer,
      phone: current.phone || accountContact.phone,
      email: current.email || accountContact.email,
    }));
    setCheckout((current) => ({
      ...current,
      customer: current.customer || accountContact.customer,
      phone: current.phone || accountContact.phone,
      email: current.email || accountContact.email,
      address: current.address || accountContact.address,
    }));
  }, [currentAccount?.id, currentAccount?.name, currentAccount?.phone, currentAccount?.email, currentAccount?.address]);

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
    if (!currentAccount) {
      window.location.assign("/");
      return;
    }
    setSelectedProduct(product);
    const firstPayment = paymentOptions(settings, "pickup", language)[0]?.id || "payAtStore";
    setCheckout({ ...emptyCheckout, ...accountContact, paymentMethod: firstPayment });
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

  async function lookupPostalCode() {
    const postal = checkout.postalCode.replace(/[^0-9]/g, "");
    if (postal.length !== 7) { setMessage(language === "ja" ? "郵便番号は7桁で入力してください。" : language === "en" ? "Enter a 7-digit postal code." : "Vui lòng nhập mã bưu điện 7 số."); return; }
    setPostalLoading(true);
    try {
      const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${postal}`);
      const data = await response.json();
      const result = data.results?.[0];
      if (!result) throw new Error("not-found");
      updateCheckout("address", `${result.address1}${result.address2}${result.address3}`);
    } catch { setMessage(language === "ja" ? "郵便番号が見つかりません。" : language === "en" ? "Postal code not found." : "Không tìm thấy mã bưu điện."); }
    finally { setPostalLoading(false); }
  }

  function submitProductOrder(event) {
    event.preventDefault();
    if (!currentAccount) {
      window.location.assign("/");
      return;
    }
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
    if (checkout.fulfillmentType === "shipping" && !checkout.postalCode.trim()) {
      setMessage(language === "ja" ? "郵便番号を入力してください。" : language === "en" ? "Please enter a postal code." : "Vui lòng nhập mã bưu điện.");
      return;
    }
    if (checkout.fulfillmentType === "shipping" && !checkout.paymentMethod) {
      setMessage(tr("paymentMethod"));
      return;
    }

    if (checkout.fulfillmentType === "shipping") { setPaymentReview(true); return; }
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
    notifyByEmail({ to: [checkout.email].filter(Boolean), subject: `Đơn hàng ${order.orderNumber} - Mai Beauty Salon`, html: `<h2>Đơn hàng ${order.orderNumber}</h2><p>Khách hàng: ${checkout.customer}</p><p>Sản phẩm: ${selectedProduct.name}</p><p>Tổng tiền: ${money(order.total)}</p>` });
    setMessage(tr("orderCreated", { order: order.orderNumber }));
    setSelectedProduct(null);
  }

  function confirmProductPayment() {
    const order = addOrder({ productId: selectedProduct.id, productName: selectedProduct.name, quantity: 1, total: selectedProduct.salePrice || selectedProduct.basePrice, stockAtOrder: selectedProduct.stock, customer: checkout.customer.trim(), phone: checkout.phone.trim(), email: checkout.email.trim(), fulfillmentType: checkout.fulfillmentType, paymentMethod: checkout.paymentMethod, address: checkout.address.trim(), postalCode: checkout.postalCode.trim(), note: checkout.note.trim(), transferBillUrl: checkout.transferBillUrl, transferBillName: checkout.transferBillName });
    setTrackingId(order.orderNumber); setMessage(tr("orderCreated", { order: order.orderNumber })); setPaymentReview(false); setSelectedProduct(null);
  }

  function submitBooking(event) {
    event.preventDefault();
    if (!currentAccount) {
      window.location.assign("/");
      return;
    }
    if (!selectedService) return;
    if (!draft.customer.trim() || !draft.phone.trim() || !draft.email.trim()) {
      setMessage(tr("requiredInfo"));
      return;
    }

    const saved = addBooking({ day: draft.day, start: draft.time, end: addMinutes(draft.time, selectedService.duration), customer: draft.customer.trim(), phone: draft.phone.trim(), email: draft.email.trim(), service: selectedService.name, staff: draft.staff || selectedService.staff?.[0] || staff[0].name, source: "direct", origin: localCopy.websiteBooking, price: selectedService.price, commissionRule: localCopy.websiteBooking });
    notifyByEmail({ to: [draft.email].filter(Boolean), subject: `Lịch hẹn mới - ${saved.customer}`, html: `<h2>Lịch hẹn mới</h2><p>Khách hàng: ${saved.customer}</p><p>Dịch vụ: ${saved.service}</p><p>Thời gian: ${saved.start}</p>` });
    setMessage(tr("bookingCreated", { time: saved.start, date: draft.date }));
    setDraft((current) => ({ ...current, customer: accountContact.customer, phone: accountContact.phone, email: accountContact.email }));
  }

  return (
    <div className="storeSoftShell">
      <header className="storeGlassToolbar">
        <a className="storeToolbarBrand" href={mode === "booking" ? "/booking" : "/shop"}><span className="brandMark">M</span><strong>Mai Beauty Salon</strong></a>
        <nav className="storeToolbarLinks">
          <a className={mode === "shop" ? "active" : ""} href="/shop">{t(language, "onlineStore")}</a>
          <a className={mode === "booking" ? "active" : ""} href="/booking">{tr("bookNail")}</a>
        </nav>
        <div className="storeToolbarTools">
          <button className="storeProfileButton" type="button" onClick={() => currentAccount ? setProfileOpen(true) : window.location.assign("/")}>{currentAccount?.name || tc("customer")}</button>
          <select data-language={language} className="storeLanguageSelect" value={language} onChange={(event) => changeLanguage(event.target.value)} aria-label={t(language, "language")}>
            {languages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
          </select>
        </div>
      </header>
      <section className="storeHero softHero"><div><p className="eyebrow">MAI BEAUTY SALON</p><h1>{showBooking && !showShop ? tr("bookingTitle") : tr("heroTitle")}</h1><p>{showBooking && !showShop ? tr("bookingText") : tr("heroText")}</p>{showShop ? <form className="heroActions storeSearchBar" onSubmit={submitProductSearch}><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder={localCopy.search} /><button className="primary" type="submit">{localCopy.search}</button>{showBooking ? <button className="ghost" type="button" onClick={scrollToBooking}>{tr("bookNail")}</button> : <a className="ghost buttonLink" href="/booking">{tr("bookNail")}</a>}</form> : <div className="heroActions"><a className="ghost buttonLink" href="/shop">{localCopy.shop}</a></div>}</div></section>

      {showShop && <><div className="sectionTitle storeTitle"><div><h2>{tr("productsTitle")}</h2><p>{localCopy.autoText}</p></div><span className={visibleFeatured.length > 1 ? "carouselAutoBadge active" : "carouselAutoBadge"}><i />{localCopy.auto}</span></div>
      <div className="featuredCarouselShell">
        {visibleFeatured.length > 1 && <button className="carouselArrow prev" type="button" onClick={() => moveFeatured(-1)} aria-label={localCopy.previous}>‹</button>}
        <div className="productGrid softProductGrid productCarouselRail" ref={productRailRef}>
          {visibleFeatured.map((product, index) => {
            const canBuy = Number(product.stock || 0) > 0 && product.status !== "DRAFT";
            return <article className={index === featuredIndex ? "productCard softProductCard activeSlide" : "productCard softProductCard"} data-product-slide={index} key={product.id}><div className="storeImage softStoreImage">{product.mediaUrl ? <img src={product.mediaUrl} alt={product.name} /> : <span>{product.productType || "Nail"}</span>}</div><div className="productMeta"><span>{product.brandName || localCopy.productFallback.replace("{index}", index + 1)}</span><h3>{product.name}</h3><p>{product.description || product.shortDescription}</p><div><strong>{money(product.salePrice || product.basePrice)}</strong><span className={canBuy ? "pill active" : "pill danger"}>{canBuy ? tr("canBuy", { stock: product.stock }) : tr("outOfStock")}</span></div><button className="primary buyButton" onClick={() => openBuy(product)}>{canBuy ? tr("buy") : tr("viewStatus")}</button></div></article>;
          })}
          {!visibleFeatured.length && <p className="storeNote">{localCopy.noProducts}</p>}
        </div>
        {visibleFeatured.length > 1 && <button className="carouselArrow next" type="button" onClick={() => moveFeatured(1)} aria-label={localCopy.next}>›</button>}
      </div>
      {visibleFeatured.length > 1 && <div className="carouselDots">{visibleFeatured.map((product, index) => <button key={product.id} className={index === featuredIndex ? "active" : ""} type="button" onClick={() => setFeaturedIndex(index)} aria-label={localCopy.viewProduct.replace("{index}", index + 1)} />)}</div>}

      <div className="sectionTitle storeTitle"><div><h2>{localCopy.productList}</h2><p>{localCopy.productListText}</p></div></div>
      <div className="productGrid softProductGrid storeProductList">
        {storeProducts.map((product, index) => {
          const canBuy = Number(product.stock || 0) > 0 && product.status !== "DRAFT";
          return <article className="productCard softProductCard" key={product.id}><div className="storeImage softStoreImage">{product.mediaUrl ? <img src={product.mediaUrl} alt={product.name} /> : <span>{product.productType || "Nail"}</span>}</div><div className="productMeta"><span>{product.brandName || localCopy.productFallback.replace("{index}", index + 1)}</span><h3>{product.name}</h3><p>{product.description || product.shortDescription}</p><div><strong>{money(product.salePrice || product.basePrice)}</strong><span className={canBuy ? "pill active" : "pill danger"}>{canBuy ? tr("canBuy", { stock: product.stock }) : tr("outOfStock")}</span></div><button className="primary buyButton" onClick={() => openBuy(product)}>{canBuy ? tr("buy") : tr("viewStatus")}</button></div></article>;
        })}
      </div>

      {mode === "all" && <section className="card orderTrackerPanel">
        <div className="sectionTitle"><div><h2>{tr("trackerTitle")}</h2><p>{tr("trackerText")}</p></div></div>
        <div className="trackerSearch"><input value={trackingId} onChange={(event) => setTrackingId(event.target.value)} placeholder="WEB-123456" /><button className="ghost" onClick={() => setTrackingId(orders[0]?.orderNumber || "")}>{tr("latestOrder")}</button></div>
        {trackedOrder ? <div className="trackingCard"><div><strong>{trackedOrder.orderNumber}</strong><span>{trackedOrder.productName} · {money(trackedOrder.total)}</span><small>{trackedOrder.status} · {trackedOrder.paymentStatus}</small></div>{trackedOrder.transferBillUrl && <img src={trackedOrder.transferBillUrl} alt="Transfer bill" />}<div className="chatBox">{(trackedOrder.chat || []).map((item) => <p key={item.id}>{item.text}</p>)}<div><input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder={tr("chatPlaceholder")} /><button className="primary" onClick={() => { addChatMessage(trackedOrder.id, chatDraft); setChatDraft(""); }}>{tc("send")}</button></div></div></div> : <p className="storeNote">{tr("noOrders")}</p>}
      </section>}</>}

      {showBooking && <section id="online-booking" className="card storeBooking bookingSurface softBookingPanel"><div className="sectionTitle"><div><h2>{tr("bookingTitle")}</h2><p>{tr("bookingText")}</p></div></div><div className="serviceChoiceRail">{activeServices.map((service) => <button type="button" key={service.id} className={draft.service === service.name ? "serviceChoice active" : "serviceChoice"} onClick={() => chooseService(service)}>{service.imageUrl ? <img src={service.imageUrl} alt={service.name} /> : <span>{service.name.slice(0, 1)}</span>}<strong>{service.name}</strong><small>{service.duration} {localCopy.minutes} · {money(service.price)}</small></button>)}</div><form onSubmit={submitBooking}><div className="bookingFormGrid softBookingGrid"><label>{tc("service")}<select value={draft.service} onChange={(event) => updateDraft("service", event.target.value)}>{activeServices.map((service) => <option key={service.id}>{service.name}</option>)}</select></label><label>{localCopy.branch}<select value={draft.branch} onChange={(event) => updateDraft("branch", event.target.value)}><option>Mai Beauty Salon Tokyo</option><option>Mai Beauty Salon Osaka</option></select></label><label>{tc("date")}<input type="date" value={draft.date} onChange={(event) => updateDraft("date", event.target.value)} /></label><label>{tc("time")}<select value={draft.time} onChange={(event) => updateDraft("time", event.target.value)}>{timeSlots.map((time) => <option key={time}>{time}</option>)}</select></label><label>{tc("staff")}<select value={draft.staff} onChange={(event) => updateDraft("staff", event.target.value)}><option value="">{tr("autoStaff")}</option>{staff.map((member) => <option key={member.id}>{member.name}</option>)}</select></label><label>{tc("email")}<input required type="email" value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} placeholder="name@gmail.com" /></label><label>{tc("customer")}<input required value={draft.customer} onChange={(event) => updateDraft("customer", event.target.value)} placeholder="Nguyen Van A" /></label><label>{tc("phone")}<input required value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} placeholder="090-0000-0000" /></label></div><div className="bookingCheckoutBar"><span>{selectedService ? `${selectedService.duration} ${localCopy.minutes} · ${money(selectedService.price)}` : tr("chooseService")}</span><button className="primary" type="submit">{tr("confirmBooking")}</button></div></form>{message && <p className="storeNote successNote">{message}</p>}</section>}
      {profileOpen && <CustomerProfile language={language} onClose={() => setProfileOpen(false)} />}

      {paymentReview && selectedProduct && <div className="bookingModalBackdrop paymentReviewBackdrop"><div className="card bookingModal paymentReviewModal"><div className="modalHead"><div><p className="eyebrow">{language === "ja" ? "支払い確認" : language === "en" ? "Payment confirmation" : "Xác nhận thanh toán"}</p><h2>{selectedProduct.name}</h2></div><button className="ghost" type="button" onClick={() => setPaymentReview(false)}>{tc("close")}</button></div><div className="paymentReviewGrid"><p><strong>{tc("customer")}</strong><span>{checkout.customer}</span></p><p><strong>{tc("phone")}</strong><span>{checkout.phone}</span></p><p><strong>{tc("email")}</strong><span>{checkout.email}</span></p><p><strong>{tr("deliveryAddress")}</strong><span>{checkout.postalCode} {checkout.address}</span></p><p><strong>{tr("paymentMethod")}</strong><span>{availablePayments.find((item) => item.id === checkout.paymentMethod)?.label}</span></p></div>{<div className="bankTransferBox"><strong>{settings.bankName} · {settings.bankAccount}</strong><span>{settings.bankHolder}</span><small>{settings.paymentNote}</small><label>{tr("uploadBill")}<input type="file" accept="image/*" onChange={uploadTransferBill} /></label>{checkout.transferBillUrl && <img src={checkout.transferBillUrl} alt="Transfer bill" />}</div>}{settings.qrImageUrl && <div className="bankTransferBox"><strong>{language === "ja" ? "QRコードをスキャン" : language === "en" ? "Scan QR code" : "Quét mã QR"}</strong><img src={settings.qrImageUrl} alt="QR code" />{checkout.transferBillUrl && <img src={checkout.transferBillUrl} alt="Transfer bill" />}</div>}<div className="modalActions"><button className="ghost" type="button" onClick={() => setPaymentReview(false)}>{tc("cancel")}</button><button className="primary" type="button" onClick={confirmProductPayment}>{language === "ja" ? "注文する" : language === "en" ? "Place order" : "Đặt hàng"}</button></div></div></div>}\n\n      {selectedProduct && <div className="bookingModalBackdrop" onMouseDown={() => setSelectedProduct(null)}><form className="card bookingModal productCheckoutModal" onSubmit={submitProductOrder} onMouseDown={(event) => event.stopPropagation()}><div className="modalHead"><div><p className="eyebrow">{tr("checkoutTitle")}</p><h2>{selectedProduct.name}</h2><p>{Number(selectedProduct.stock || 0) > 0 ? tr("canBuy", { stock: selectedProduct.stock }) : tr("outOfStock")}</p></div><button className="ghost" type="button" onClick={() => setSelectedProduct(null)}>{tc("close")}</button></div><div className="checkoutProductLine">{selectedProduct.mediaUrl && <img src={selectedProduct.mediaUrl} alt={selectedProduct.name} />}<div><strong>{money(selectedProduct.salePrice || selectedProduct.basePrice)}</strong><span>{selectedProduct.description || selectedProduct.shortDescription}</span></div></div><div className="fulfillmentTabs"><button type="button" className={checkout.fulfillmentType === "pickup" ? "active" : ""} onClick={() => updateCheckout("fulfillmentType", "pickup")}>{tr("pickup")}</button><button type="button" className={checkout.fulfillmentType === "shipping" ? "active" : ""} onClick={() => updateCheckout("fulfillmentType", "shipping")}>{tr("shipping")}</button></div><div className="formGrid modalForm"><label>{tc("customer")}<input required value={checkout.customer} onChange={(event) => updateCheckout("customer", event.target.value)} /></label><label>{tc("phone")}<input required value={checkout.phone} onChange={(event) => updateCheckout("phone", event.target.value)} /></label><label>{tc("email")}<input required type="email" value={checkout.email} onChange={(event) => updateCheckout("email", event.target.value)} /></label>{checkout.fulfillmentType === "shipping" && <><label>{tr("paymentMethod")}<select value={checkout.paymentMethod} onChange={(event) => updateCheckout("paymentMethod", event.target.value)}>{availablePayments.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><div className="postalLookup"><label>{language === "ja" ? "郵便番号" : language === "en" ? "Postal code" : "Mã bưu điện"}<input required value={checkout.postalCode} onChange={(event) => updateCheckout("postalCode", event.target.value)} placeholder="1234567" /></label><button type="button" className="ghost" onClick={lookupPostalCode} disabled={postalLoading}>{postalLoading ? "…" : (language === "ja" ? "検索" : language === "en" ? "Find" : "Tìm kiếm")}</button></div><label className="fullField">{tr("deliveryAddress")}<input required value={checkout.address} onChange={(event) => updateCheckout("address", event.target.value)} /></label><label className="fullField">{tr("deliveryNote")}<input value={checkout.note} onChange={(event) => updateCheckout("note", event.target.value)} /></label>{["bankTransfer", "qr"].includes(checkout.paymentMethod) && <div className="bankTransferBox fullField"><strong>{settings.bankName} · {settings.bankAccount}</strong><span>{settings.bankHolder}</span><small>{settings.paymentNote}</small><label>{tr("uploadBill")}<input type="file" accept="image/*" onChange={uploadTransferBill} /></label><label>{tr("uploadBill")}<input type="file" accept="image/*" onChange={uploadTransferBill} /></label>{checkout.transferBillUrl && <img src={checkout.transferBillUrl} alt="Transfer bill preview" />}</div>}</>}</div><div className="modalActions"><button className="ghost" type="button" onClick={() => setSelectedProduct(null)}>{tc("cancel")}</button><button className="primary" type="submit" onClick={() => { if (checkout.fulfillmentType === "shipping") setPaymentReview(true); }} disabled={Number(selectedProduct.stock || 0) <= 0}>{checkout.fulfillmentType === "shipping" ? (language === "ja" ? "支払いを確認" : language === "en" ? "Confirm payment" : "Xác nhận thanh toán") : tr("createOrder")}</button></div></form></div>}
    </div>
  );
}

