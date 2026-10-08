"use client";

import { useEffect, useMemo, useState } from "react";
import { useBookingStore } from "../lib/bookingStore";
import { useProductCatalog, useServiceCatalog } from "../lib/catalogStore";
import { payments as seedPayments } from "../lib/salonData";
import { getAppSettings } from "./Settings";

const CHECKOUT_KEY = "nail-japan-pos-sales";

const addOnPresets = [
  { id: "stone", name: "Gắn thêm đá", price: 550 },
  { id: "color", name: "Thêm màu", price: 880 },
  { id: "charm", name: "Thêm charm", price: 1100 },
];

function yen(value) {
  return `¥${Math.round(Number(value || 0)).toLocaleString("ja-JP")}`;
}

function saleLine(label, price, type = "service") {
  return { id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`, label, price: Number(price || 0), type };
}

export function getStoredPosSales() {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(CHECKOUT_KEY);
  if (!raw) return [];
  try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

export default function Checkout({ label = "POS / Checkout" }) {
  const { bookings } = useBookingStore();
  const [services] = useServiceCatalog();
  const [products] = useProductCatalog();
  const [settings] = useState(getAppSettings);
  const [selectedBookingId, setSelectedBookingId] = useState(bookings[0]?.id || "");
  const selectedBooking = bookings.find((booking) => booking.id === selectedBookingId) || bookings[0];
  const initialLines = useMemo(() => selectedBooking ? [saleLine(selectedBooking.service, selectedBooking.price, "booking")] : [], [selectedBooking]);
  const [lines, setLines] = useState(initialLines);
  const [customerName, setCustomerName] = useState(selectedBooking?.customer || "");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const subtotal = lines.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const tax = Math.round(subtotal * Number(settings.taxRate || 0) / 100);
  const total = subtotal + tax;
  const paymentMethods = ["Cash", "Card", "QR", "App payment", "Bank transfer"];

  useEffect(() => {
    if (!selectedBookingId && bookings[0]) chooseBooking(bookings[0].id);
  }, [bookings, selectedBookingId]);

  function chooseBooking(id) {
    const booking = bookings.find((item) => item.id === id);
    setSelectedBookingId(id);
    setCustomerName(booking?.customer || "");
    setLines(booking ? [saleLine(booking.service, booking.price, "booking")] : []);
  }

  function addService(service) {
    setLines((current) => [...current, saleLine(service.name, service.price, "service")]);
  }

  function addProduct(product) {
    setLines((current) => [...current, saleLine(product.name, product.salePrice || product.basePrice, "product")]);
  }

  function addCustomAddOn(addOn) {
    setLines((current) => [...current, saleLine(addOn.name, addOn.price, "addon")]);
  }

  function removeLine(id) {
    setLines((current) => current.filter((item) => item.id !== id));
  }

  function saveSale(receiptType = "receipt") {
    const record = { id: `sale-${Date.now()}`, receiptType, customer: customerName || selectedBooking?.customer || "Walk-in", bookingId: selectedBooking?.id || "", staff: selectedBooking?.staff || "", paymentMethod, subtotal, tax, total, taxRate: Number(settings.taxRate || 0), lines, createdAt: new Date().toISOString() };
    const next = [record, ...getStoredPosSales()];
    window.localStorage.setItem(CHECKOUT_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("nail-japan-pos-sales-updated", { detail: next }));
    window.print();
  }

  const closingPayments = paymentMethods.map((method, index) => ({
    id: method,
    method,
    amount: getStoredPosSales().filter((sale) => sale.paymentMethod === method).reduce((sum, sale) => sum + Number(sale.total || 0), 0) || seedPayments[index]?.amount || 0,
  }));

  return (
    <>
      <div className="pageHead">
        <div><p className="eyebrow">CHECKOUT</p><h1>{label}</h1><p>Đồng bộ lịch hẹn, menu dịch vụ, sản phẩm và phụ phí trong một hóa đơn.</p></div>
        <div className="toolbar"><button className="primary" onClick={() => saveSale("invoice")}>In hóa đơn</button><button className="ghost" onClick={() => saveSale("receipt")}>In 領収書</button></div>
      </div>
      <div className="checkoutLayout">
        <section className="card checkoutPanel">
          <h2>Khách / lịch hẹn</h2>
          <label>Lịch hẹn<select value={selectedBooking?.id || ""} onChange={(event) => chooseBooking(event.target.value)}>{bookings.map((booking) => <option key={booking.id} value={booking.id}>{booking.customer} - {booking.service} - {booking.staff}</option>)}</select></label>
          <label>Khách mua thêm / walk-in<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Tên khách hàng" /></label>
          <p>{selectedBooking?.phone} · {selectedBooking?.staff}</p>
          {lines.map((item) => <div className="lineItem" key={item.id}><span>{item.label}<small>{item.type}</small></span><strong>{yen(item.price)}</strong><button className="ghost dangerButton" onClick={() => removeLine(item.id)}>Xóa</button></div>)}
          <div className="lineItem"><span>Tạm tính</span><strong>{yen(subtotal)}</strong></div>
          <div className="lineItem"><span>Thuế {settings.taxRate}%</span><strong>{yen(tax)}</strong></div>
          <div className="totalLine"><span>Total</span><strong>{yen(total)}</strong></div>
        </section>
        <section className="card checkoutPanel">
          <h2>Menu / bán thêm</h2>
          <h3>Dịch vụ đã làm thêm</h3>
          <div className="paymentMethods">{services.map((service) => <button className="ghost" key={service.id} onClick={() => addService(service)}>{service.name} {yen(service.price)}</button>)}</div>
          <h3>Phụ phí nhanh</h3>
          <div className="paymentMethods">{addOnPresets.map((addOn) => <button className="ghost" key={addOn.id} onClick={() => addCustomAddOn(addOn)}>{addOn.name} {yen(addOn.price)}</button>)}</div>
          <h3>Sản phẩm khách mua thêm</h3>
          <div className="paymentMethods">{products.filter((product) => product.posEnabled !== false).slice(0, 8).map((product) => <button className="ghost" key={product.id} onClick={() => addProduct(product)}>{product.name} {yen(product.salePrice || product.basePrice)}</button>)}</div>
          <h2>Payment method</h2>
          <div className="paymentMethods">{paymentMethods.map((method) => <button className={paymentMethod === method ? "ghost activeSoft" : "ghost"} key={method} onClick={() => setPaymentMethod(method)}>{method}</button>)}</div>
        </section>
        <section className="card checkoutPanel receiptPreview">
          <h2>{settings.salonName}</h2>
          {settings.logoUrl && <img className="settingsLogoPreview" src={settings.logoUrl} alt="Salon logo" />}
          <p>{settings.address}</p>
          <p>{settings.phone} · {settings.email}</p>
          <div className="lineItem"><span>Khách</span><strong>{customerName || selectedBooking?.customer || "Walk-in"}</strong></div>
          <div className="lineItem"><span>Thanh toán</span><strong>{paymentMethod}</strong></div>
          <div className="totalLine"><span>領収金額</span><strong>{yen(total)}</strong></div>
        </section>
        <section className="card checkoutPanel">
          <h2>Daily closing</h2>
          {closingPayments.map((payment) => <div className="lineItem" key={payment.id}><span>{payment.method}</span><strong>{yen(payment.amount)}</strong></div>)}
          <div className="totalLine"><span>Today revenue</span><strong>{yen(closingPayments.reduce((sum, item) => sum + item.amount, 0))}</strong></div>
        </section>
      </div>
    </>
  );
}
