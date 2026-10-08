"use client";

import { useEffect, useMemo, useState } from "react";
import { useBookingStore } from "../lib/bookingStore";
import { useProductCatalog, useServiceCatalog } from "../lib/catalogStore";
import { useStaffStore } from "../lib/staffStore";
import { getAppSettings } from "./Settings";

const CHECKOUT_KEY = "nail-japan-pos-sales";
const DRAFT_KEY = "nail-japan-pos-draft";

const extraServices = [
  { id: "stone", name: "Gắn thêm đá", categoryName: "Extra", price: 550, duration: 0 },
  { id: "color", name: "Thêm màu", categoryName: "Extra", price: 880, duration: 0 },
  { id: "charm", name: "Thêm charm", categoryName: "Extra", price: 1100, duration: 0 },
  { id: "art", name: "Nail art", categoryName: "Extra", price: 1650, duration: 0 },
  { id: "remove", name: "Tháo gel", categoryName: "Extra", price: 2200, duration: 0 },
  { id: "repair", name: "Sửa móng", categoryName: "Extra", price: 770, duration: 0 },
];

const paymentMethods = [
  { id: "cash", label: "現金" },
  { id: "card", label: "クレジットカード" },
  { id: "paypay", label: "PayPay" },
  { id: "transfer", label: "銀行振込" },
  { id: "other", label: "その他" },
];

function yen(value) {
  return `¥${Math.round(Number(value || 0)).toLocaleString("ja-JP")}`;
}

function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(window.localStorage.getItem(key)) || fallback; } catch { return fallback; }
}

function lineFromService(service, booking, staffName) {
  return { id: newId("svc"), sourceId: service.id || "", type: "service", name: service.name, category: service.categoryName || "Service", quantity: 1, unitPrice: Number(service.price || booking?.price || 0), staff: booking?.staff || service.staff?.[0] || staffName || "", taxRate: null, discountType: "amount", discountValue: 0, note: "", snapshot: { name: service.name, price: Number(service.price || booking?.price || 0), source: booking?.source || "direct" } };
}

function lineFromProduct(product) {
  return { id: newId("prd"), sourceId: product.id, type: "product", name: product.name, category: product.categoryName || "Product", sku: product.sku || "", quantity: 1, unitPrice: Number(product.salePrice || product.basePrice || 0), stock: Number(product.stock || 0), taxRate: null, discountType: "amount", discountValue: 0, note: "", snapshot: { name: product.name, sku: product.sku || "", price: Number(product.salePrice || product.basePrice || 0), stock: Number(product.stock || 0) } };
}

function lineTotal(line) {
  const gross = Number(line.quantity || 0) * Number(line.unitPrice || 0);
  const discount = line.discountType === "percent" ? Math.round(gross * Number(line.discountValue || 0) / 100) : Number(line.discountValue || 0);
  return Math.max(0, gross - discount);
}

export function getStoredPosSales() {
  return readJson(CHECKOUT_KEY, []);
}

export default function Checkout({ label = "POS / Checkout" }) {
  const { bookings, setBookings } = useBookingStore();
  const [services] = useServiceCatalog();
  const [products, setProducts] = useProductCatalog();
  const { staff } = useStaffStore();
  const [settings] = useState(getAppSettings);
  const [activeTab, setActiveTab] = useState("services");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [receiptMode, setReceiptMode] = useState("receipt");
  const [order, setOrder] = useState(() => readJson(DRAFT_KEY, null) || {
    id: "",
    orderNumber: "",
    appointmentId: "",
    customer: "",
    phone: "",
    employee: "",
    bookingSource: "Other",
    status: "Draft",
    paymentStatus: "Unpaid",
    lines: [],
    orderDiscountType: "amount",
    orderDiscountValue: 0,
    couponCode: "",
    payments: [{ id: newId("pay"), method: "cash", amount: 0, received: 0, confirmed: true }],
    stockDeducted: false,
  });

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(order));
  }, [order]);

  const catalogServices = useMemo(() => [...services, ...extraServices], [services]);
  const visibleServices = catalogServices.filter((item) => `${item.name} ${item.categoryName || ""}`.toLowerCase().includes(query.toLowerCase()));
  const visibleProducts = products.filter((item) => `${item.name} ${item.sku || ""} ${item.categoryName || ""}`.toLowerCase().includes(query.toLowerCase()));
  const subtotal = order.lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const orderDiscount = order.orderDiscountType === "percent" ? Math.round(subtotal * Number(order.orderDiscountValue || 0) / 100) : Number(order.orderDiscountValue || 0);
  const taxableSubtotal = Math.max(0, subtotal - orderDiscount);
  const taxMode = settings.taxMode || "exclusive";
  const taxRate = Number(settings.taxRate || 10);
  const tax = taxMode === "inclusive" ? Math.round(taxableSubtotal - taxableSubtotal / (1 + taxRate / 100)) : Math.round(taxableSubtotal * taxRate / 100);
  const total = taxMode === "inclusive" ? taxableSubtotal : taxableSubtotal + tax;
  const paid = order.payments.filter((payment) => payment.confirmed).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const remaining = Math.max(0, total - paid);
  const cashReceived = order.payments.filter((payment) => payment.method === "cash").reduce((sum, payment) => sum + Number(payment.received || 0), 0);
  const cashPaid = order.payments.filter((payment) => payment.method === "cash").reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const change = Math.max(0, cashReceived - cashPaid);
  const existingPaidAppointment = order.appointmentId && getStoredPosSales().find((sale) => sale.appointmentId === order.appointmentId && sale.paymentStatus === "Paid");

  function updateOrder(patch) {
    setOrder((current) => ({ ...current, ...patch }));
  }

  function chooseAppointment(id) {
    const booking = bookings.find((item) => String(item.id) === String(id));
    const existing = getStoredPosSales().find((sale) => sale.appointmentId && String(sale.appointmentId) === String(id));
    if (existing) {
      setOrder({ ...existing, status: "Reopened" });
      setError("Đã tải lại order cũ của appointment này, không tạo trùng.");
      return;
    }
    if (!booking) return;
    const matchedService = catalogServices.find((service) => service.name === booking.service) || { id: "booking-service", name: booking.service, price: booking.price, staff: [booking.staff] };
    setOrder((current) => ({
      ...current,
      id: current.id || newId("order"),
      orderNumber: current.orderNumber || `POS-${Date.now().toString().slice(-6)}`,
      appointmentId: String(booking.id),
      customer: booking.customer,
      phone: booking.phone || "",
      employee: booking.staff || "",
      bookingSource: booking.origin || booking.source || "Other",
      paymentStatus: "Unpaid",
      lines: [lineFromService(matchedService, booking, booking.staff)],
    }));
    setError("");
  }

  function addLine(item, type) {
    const line = type === "product" ? lineFromProduct(item) : lineFromService(item, null, order.employee || staff[0]?.name);
    setOrder((current) => ({ ...current, lines: [...current.lines, line] }));
  }

  function updateLine(id, patch) {
    setOrder((current) => ({ ...current, lines: current.lines.map((line) => line.id === id ? { ...line, ...patch } : line) }));
  }

  function removeLine(id) {
    setOrder((current) => ({ ...current, lines: current.lines.filter((line) => line.id !== id) }));
  }

  function addPayment() {
    setOrder((current) => ({ ...current, payments: [...current.payments, { id: newId("pay"), method: "paypay", amount: remaining, received: 0, confirmed: false }] }));
  }

  function updatePayment(id, patch) {
    setOrder((current) => ({ ...current, payments: current.payments.map((payment) => payment.id === id ? { ...payment, ...patch } : payment) }));
  }

  function validateOrder() {
    if (!order.lines.length) return "Không thể thanh toán order rỗng.";
    const badStock = order.lines.find((line) => line.type === "product" && Number(line.quantity || 0) > Number(line.stock || 0));
    if (badStock) return `${badStock.name} không đủ tồn kho.`;
    if (existingPaidAppointment) return "Appointment này đã có order Paid, không ghi nhận trùng.";
    return "";
  }

  function completePayment() {
    const validation = validateOrder();
    if (validation) { setError(validation); return; }
    const paymentStatus = remaining <= 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid";
    const record = {
      ...order,
      id: order.id || newId("order"),
      orderNumber: order.orderNumber || `POS-${Date.now().toString().slice(-6)}`,
      status: paymentStatus === "Paid" ? "Completed" : "Open",
      paymentStatus,
      subtotal,
      orderDiscount,
      tax,
      total,
      paid,
      remaining,
      change,
      taxSnapshot: { mode: taxMode, rate: taxRate, amount: tax },
      storeSnapshot: { salonName: settings.salonName, address: settings.address, phone: settings.phone, email: settings.email, logoUrl: settings.logoUrl, invoiceNumber: settings.invoiceNumber || "" },
      receiptNumber: `R-${Date.now().toString().slice(-8)}`,
      issuedAt: new Date().toISOString(),
      stockDeducted: paymentStatus === "Paid" ? true : order.stockDeducted,
    };
    const existing = getStoredPosSales().filter((sale) => sale.id !== record.id && (!record.appointmentId || sale.appointmentId !== record.appointmentId));
    const next = [record, ...existing];
    window.localStorage.setItem(CHECKOUT_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("nail-japan-pos-sales-updated", { detail: next }));
    if (paymentStatus === "Paid" && !order.stockDeducted) {
      const productQty = record.lines.filter((line) => line.type === "product").reduce((map, line) => ({ ...map, [line.sourceId]: (map[line.sourceId] || 0) + Number(line.quantity || 0) }), {});
      setProducts((current) => current.map((product) => productQty[product.id] ? { ...product, stock: Math.max(0, Number(product.stock || 0) - productQty[product.id]) } : product));
      if (record.appointmentId) setBookings((current) => current.map((booking) => String(booking.id) === String(record.appointmentId) ? { ...booking, paymentStatus: "Paid" } : booking));
    }
    setOrder(record);
    setError(paymentStatus === "Paid" ? "" : "Order đang Partial/Unpaid vì chưa nhận đủ tiền.");
  }

  const paymentSummary = paymentMethods.map((method) => ({ ...method, amount: getStoredPosSales().flatMap((sale) => sale.payments || []).filter((payment) => payment.method === method.id && payment.confirmed).reduce((sum, payment) => sum + Number(payment.amount || 0), 0) }));

  return (
    <>
      <div className="pageHead">
        <div><p className="eyebrow">POS NAIL SALON</p><h1>{label}</h1><p>Appointment → customer → order → split payment → receipt / 領収書.</p></div>
        <div className="toolbar"><button className="ghost" onClick={() => setReceiptMode("receipt")}>レシート</button><button className="ghost" onClick={() => setReceiptMode("invoice")}>領収書</button><button className="primary" onClick={completePayment}>Complete Payment</button></div>
      </div>

      {error && <div className="orderToast card"><strong>POS</strong><span>{error}</span></div>}

      <div className="checkoutLayout posCheckoutLayout">
        <section className="card checkoutPanel posCatalog">
          <div className="sectionTitle"><div><h2>Khách hàng / Appointment</h2><p>Tải customer, employee, service, source từ lịch hẹn hiện có.</p></div><span className="pill">{order.paymentStatus}</span></div>
          <div className="staffForm">
            <label>Lịch hẹn<select value={order.appointmentId} onChange={(event) => chooseAppointment(event.target.value)}><option value="">Walk-in / Other</option>{bookings.map((booking) => <option key={booking.id} value={booking.id}>{booking.customer} - {booking.service} - {booking.staff} - {booking.origin || booking.source}</option>)}</select></label>
            <label>Khách hàng<input value={order.customer} onChange={(event) => updateOrder({ customer: event.target.value })} /></label>
            <label>Điện thoại<input value={order.phone} onChange={(event) => updateOrder({ phone: event.target.value })} /></label>
            <label>Nhân viên chính<select value={order.employee} onChange={(event) => updateOrder({ employee: event.target.value })}><option value="">Chọn nhân viên</option>{staff.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}</select></label>
          </div>

          <div className="toolbar productTools">
            <button className={activeTab === "services" ? "ghost activeSoft" : "ghost"} onClick={() => setActiveTab("services")}>💅 Services</button>
            <button className={activeTab === "products" ? "ghost activeSoft" : "ghost"} onClick={() => setActiveTab("products")}>🛍️ Products</button>
            <input className="searchInput" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, SKU, danh mục" />
          </div>

          <div className="productGrid">
            {activeTab === "services" && visibleServices.map((service) => <button className="card productCard" key={service.id} onClick={() => addLine(service, "service")}><strong>{service.name}</strong><span>{service.categoryName || "Service"}</span><b>{yen(service.price)}</b></button>)}
            {activeTab === "products" && visibleProducts.map((product) => <button className="card productCard" key={product.id} onClick={() => addLine(product, "product")} disabled={Number(product.stock || 0) <= 0}>{product.mediaUrl && <img className="catalogThumb" src={product.mediaUrl} alt={product.name} />}<strong>{product.name}</strong><span>{product.sku || "SKU"} · Stock {product.stock || 0}</span><b>{yen(product.salePrice || product.basePrice)}</b></button>)}
            {((activeTab === "services" && !visibleServices.length) || (activeTab === "products" && !visibleProducts.length)) && <p className="mutedText">Không có dữ liệu phù hợp.</p>}
          </div>
        </section>

        <aside className="card checkoutPanel posCart">
          <div className="sectionTitle"><div><h2>🛒 POS Order</h2><p>{order.orderNumber || "Draft"} · {order.bookingSource}</p></div></div>
          {order.lines.length ? order.lines.map((line) => <div className="payrollLine posLine" key={line.id}>
            <div><strong>{line.name}</strong><small>{line.type} {line.sku ? `· ${line.sku}` : ""}</small></div>
            <input type="number" min="1" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: Number(event.target.value) })} />
            <input type="number" value={line.unitPrice} onChange={(event) => updateLine(line.id, { unitPrice: Number(event.target.value) })} />
            <select value={line.staff || ""} onChange={(event) => updateLine(line.id, { staff: event.target.value })}><option value="">Staff</option>{staff.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}</select>
            <input value={line.note || ""} onChange={(event) => updateLine(line.id, { note: event.target.value })} placeholder="Ghi chú" />
            <button className="ghost dangerButton" onClick={() => removeLine(line.id)}>Xóa</button>
          </div>) : <p className="mutedText">Chưa có item. Chọn lịch hẹn hoặc thêm service/product.</p>}

          <div className="staffForm">
            <label>Coupon<input value={order.couponCode} onChange={(event) => updateOrder({ couponCode: event.target.value })} placeholder="OLD10 / EVENT" /></label>
            <label>Discount<select value={order.orderDiscountType} onChange={(event) => updateOrder({ orderDiscountType: event.target.value })}><option value="amount">¥</option><option value="percent">%</option></select></label>
            <label>Giá trị giảm<input type="number" value={order.orderDiscountValue} onChange={(event) => updateOrder({ orderDiscountValue: Number(event.target.value) })} /></label>
          </div>

          <div className="lineItem"><span>Subtotal</span><strong>{yen(subtotal)}</strong></div>
          <div className="lineItem"><span>Discount</span><strong>-{yen(orderDiscount)}</strong></div>
          <div className="lineItem"><span>Tax {taxRate}% {taxMode === "inclusive" ? "税込" : "税抜"}</span><strong>{yen(tax)}</strong></div>
          <div className="totalLine"><span>Total</span><strong>{yen(total)}</strong></div>

          <h3>💳 Split Payment</h3>
          {order.payments.map((payment) => <div className="payrollLine" key={payment.id}>
            <select value={payment.method} onChange={(event) => updatePayment(payment.id, { method: event.target.value })}>{paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}</select>
            <input type="number" value={payment.amount} onChange={(event) => updatePayment(payment.id, { amount: Number(event.target.value) })} placeholder="Amount" />
            {payment.method === "cash" && <input type="number" value={payment.received || ""} onChange={(event) => updatePayment(payment.id, { received: Number(event.target.value) })} placeholder="Khách đưa" />}
            <label className="toggleLine"><input type="checkbox" checked={payment.confirmed} onChange={(event) => updatePayment(payment.id, { confirmed: event.target.checked })} /> Confirmed</label>
          </div>)}
          <button className="ghost" onClick={addPayment}>+ Split payment</button>
          <div className="lineItem"><span>Paid confirmed</span><strong>{yen(paid)}</strong></div>
          <div className="lineItem"><span>Remaining</span><strong>{yen(remaining)}</strong></div>
          <div className="lineItem"><span>Cash change</span><strong>{yen(change)}</strong></div>

          <section className="receiptPreview">
            <h2>{receiptMode === "receipt" ? "レシート" : "領収書"}</h2>
            {settings.logoUrl && <img className="settingsLogoPreview" src={settings.logoUrl} alt="Salon logo" />}
            <p>{settings.salonName} · {settings.address}</p>
            <p>{settings.phone}</p>
            <div className="lineItem"><span>{receiptMode === "invoice" ? "領収金額" : "Total"}</span><strong>{yen(receiptMode === "invoice" ? paid : total)}</strong></div>
            <div className="lineItem"><span>税率別金額</span><strong>{yen(taxableSubtotal)}</strong></div>
            <div className="lineItem"><span>消費税額</span><strong>{yen(tax)}</strong></div>
            <button className="ghost" onClick={() => window.print()}>Preview / Print</button>
          </section>
        </aside>
      </div>

      <section className="card reportPanel">
        <div className="sectionTitle"><div><h2>Payment closing</h2><p>Không cộng tiền khách đưa vào doanh thu, chỉ cộng amount đã confirmed.</p></div></div>
        {paymentSummary.map((payment) => <div className="lineItem" key={payment.id}><span>{payment.label}</span><strong>{yen(payment.amount)}</strong></div>)}
      </section>
    </>
  );
}
