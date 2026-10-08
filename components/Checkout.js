"use client";

import { useEffect, useMemo, useState } from "react";
import { useBookingStore } from "../lib/bookingStore";
import { useProductCatalog, useServiceCatalog } from "../lib/catalogStore";
import { useStaffStore } from "../lib/staffStore";
import { defaultSettings, getAppSettings } from "./Settings";

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

function yen(value) {
  return `¥${Math.round(Number(value || 0)).toLocaleString("ja-JP")}`;
}

function paymentLabel(id, methods = defaultSettings.paymentMethods) {
  return methods.find((method) => method.id === id)?.label || id || "その他";
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

export default function Checkout({ label = "POS / Checkout", appointmentId = "" }) {
  const { bookings, setBookings } = useBookingStore();
  const [services] = useServiceCatalog();
  const [products, setProducts] = useProductCatalog();
  const { staff } = useStaffStore();
  const [settings] = useState(getAppSettings);
  const [activeTab, setActiveTab] = useState("services");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [drawerNotice, setDrawerNotice] = useState("");
  const [printMode, setPrintMode] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [posHistory, setPosHistory] = useState(() => getStoredPosSales());
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

  useEffect(() => {
    const nextAppointmentId = appointmentId || (typeof window !== "undefined" ? window.localStorage.getItem("nail-japan-checkout-appointment") : "");
    if (nextAppointmentId && String(nextAppointmentId) !== String(order.appointmentId)) chooseAppointment(nextAppointmentId);
  }, [appointmentId, bookings]);

  const catalogServices = useMemo(() => [...services, ...extraServices], [services]);
  const visibleServices = catalogServices.filter((item) => `${item.name} ${item.categoryName || ""}`.toLowerCase().includes(query.toLowerCase()));
  const visibleProducts = products.filter((item) => `${item.name} ${item.sku || ""} ${item.categoryName || ""}`.toLowerCase().includes(query.toLowerCase()));
  const subtotal = order.lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const paymentMethods = settings.paymentMethods?.length ? settings.paymentMethods : defaultSettings.paymentMethods;
  const orderDiscount = order.orderDiscountType === "percent" ? Math.round(subtotal * Number(order.orderDiscountValue || 0) / 100) : Number(order.orderDiscountValue || 0);
  const taxableSubtotal = Math.max(0, subtotal - orderDiscount);
  const taxMode = settings.taxMode || "exclusive";
  const taxRate = Number(settings.taxRate || 10);
  const tax = taxMode === "inclusive" ? Math.round(taxableSubtotal - taxableSubtotal / (1 + taxRate / 100)) : Math.round(taxableSubtotal * taxRate / 100);
  const total = taxMode === "inclusive" ? taxableSubtotal : taxableSubtotal + tax;
  const paid = order.payments.filter((payment) => payment.confirmed !== false).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const remaining = Math.max(0, total - paid);
  const cashReceived = order.payments.filter((payment) => payment.method === "cash").reduce((sum, payment) => sum + Number(payment.received || 0), 0);
  const change = Math.max(0, cashReceived - total);
  const confirmedPayments = order.payments.filter((payment) => payment.confirmed !== false && Number(payment.amount || 0) > 0);
  const paymentMethodText = confirmedPayments.map((payment) => paymentLabel(payment.method, paymentMethods)).join(" + ");
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

  function addOtherLine(type) {
    const line = {
      id: newId(type === "product" ? "other-product" : "other-service"),
      sourceId: "",
      type,
      name: type === "product" ? "Khoản sản phẩm khác / その他" : "Khoản dịch vụ khác / その他",
      category: "その他",
      sku: "",
      quantity: 1,
      unitPrice: 0,
      staff: order.employee || staff[0]?.name || "",
      stock: 999,
      taxRate: null,
      discountType: "amount",
      discountValue: 0,
      note: "その他",
      snapshot: { name: "その他", price: 0 },
    };
    setOrder((current) => ({ ...current, lines: [...current.lines, line] }));
  }

  function updateLine(id, patch) {
    setOrder((current) => ({ ...current, lines: current.lines.map((line) => line.id === id ? { ...line, ...patch } : line) }));
  }

  function removeLine(id) {
    setOrder((current) => ({ ...current, lines: current.lines.filter((line) => line.id !== id) }));
  }

  function addPayment() {
    const nextMethod = paymentMethods.find((method) => method.id !== "cash")?.id || paymentMethods[0]?.id || "other";
    setOrder((current) => ({ ...current, payments: [...current.payments, { id: newId("pay"), method: nextMethod, amount: remaining, received: 0, confirmed: true }] }));
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
      paymentMethods: confirmedPayments.map((payment) => ({ method: payment.method, label: paymentLabel(payment.method, paymentMethods), amount: Number(payment.amount || 0), received: Number(payment.received || 0) })),
      paymentMethodText,
      taxSnapshot: { mode: taxMode, rate: taxRate, amount: tax },
      storeSnapshot: { salonName: settings.salonName, address: settings.address, phone: settings.phone, email: settings.email, logoUrl: settings.logoUrl, invoiceNumber: settings.invoiceNumber || "" },
      receiptNumber: `R-${Date.now().toString().slice(-8)}`,
      issuedAt: new Date().toISOString(),
      stockDeducted: paymentStatus === "Paid" ? true : order.stockDeducted,
    };
    const existing = getStoredPosSales().filter((sale) => sale.id !== record.id && (!record.appointmentId || sale.appointmentId !== record.appointmentId));
    const next = [record, ...existing];
    window.localStorage.setItem(CHECKOUT_KEY, JSON.stringify(next));
    setPosHistory(next);
    window.dispatchEvent(new CustomEvent("nail-japan-pos-sales-updated", { detail: next }));
    if (paymentStatus === "Paid" && !order.stockDeducted) {
      const productQty = record.lines.filter((line) => line.type === "product").reduce((map, line) => ({ ...map, [line.sourceId]: (map[line.sourceId] || 0) + Number(line.quantity || 0) }), {});
      setProducts((current) => current.map((product) => productQty[product.id] ? { ...product, stock: Math.max(0, Number(product.stock || 0) - productQty[product.id]) } : product));
      if (record.appointmentId) setBookings((current) => current.map((booking) => String(booking.id) === String(record.appointmentId) ? { ...booking, paymentStatus: "Paid" } : booking));
    }
    setOrder(record);
    setError(paymentStatus === "Paid" ? "" : "Order đang Partial/Unpaid vì chưa nhận đủ tiền.");
    if (paymentStatus === "Paid") {
      const hasCashPayment = record.payments.some((payment) => payment.method === "cash" && payment.confirmed !== false && Number(payment.amount || 0) > 0);
      if (hasCashPayment) {
        setDrawerNotice(`Đã gửi lệnh mở hòm tiền mặt. Tiền trả lại khách: ${yen(change)}.`);
        window.dispatchEvent(new CustomEvent("nail-japan-cash-drawer-open", { detail: { orderNumber: record.orderNumber, change } }));
      } else {
        setDrawerNotice("");
      }
      printDocument("receipt");
    }
  }

  function printDocument(type) {
    setPrintMode(type);
    window.setTimeout(() => window.print(), 120);
  }

  return (
    <section className="card nailPosPanel">
      <div className="nailPosHeader">
        <div><h1>💰 Nail POS</h1><p>Thanh toán · お会計</p></div>
        <div className="nailPosHeaderActions"><button className="ghost" onClick={() => setHistoryOpen(true)}>Lịch sử thanh toán</button><span className="pill active">{order.paymentStatus === "Paid" ? "Đã thanh toán" : "Đang tạo đơn"}</span></div>
      </div>

      {error && <div className="orderToast card"><strong>POS</strong><span>{error}</span></div>}

      <div className="nailCustomerBlock">
        <div>
          <strong>👤 {order.customer || "Nguyễn A"}</strong>
          <span>🗓️ 08/10/2026 · 14:00-15:30</span>
          <span>💅 Nhân viên: {order.employee || staff[0]?.name || "Mai"} · Khách cũ</span>
        </div>
        <select value={order.appointmentId} onChange={(event) => chooseAppointment(event.target.value)}>
          <option value="">Đặt từ Nailie</option>
          {bookings.map((booking) => <option key={booking.id} value={booking.id}>{booking.customer} - {booking.service}</option>)}
        </select>
      </div>

      <h2 className="nailSectionTitle">Thêm dịch vụ và sản phẩm</h2>
      <div className="nailTabs">
        <button className={activeTab === "services" ? "active" : ""} onClick={() => setActiveTab("services")}>💅 Dịch vụ</button>
        <button className={activeTab === "products" ? "active" : ""} onClick={() => setActiveTab("products")}>🛍️ Sản phẩm</button>
      </div>
      <div className="nailItemGrid">
        {activeTab === "services" && visibleServices.slice(0, 8).map((service) => <button className="nailMenuItem" key={service.id} onClick={() => addLine(service, "service")}><strong>{service.name}</strong><span>⊕</span><small>{yen(service.price)}</small></button>)}
        {activeTab === "services" && <button className="nailMenuItem" onClick={() => addOtherLine("service")}><strong>Khoản khác / その他</strong><span>⊕</span><small>Ghi chú sau khi thêm</small></button>}
        {activeTab === "products" && visibleProducts.slice(0, 8).map((product) => <button className="nailMenuItem" key={product.id} onClick={() => addLine(product, "product")} disabled={Number(product.stock || 0) <= 0}><strong>{product.name}</strong><span>⊕</span><small>{yen(product.salePrice || product.basePrice)}</small></button>)}
        {activeTab === "products" && <button className="nailMenuItem" onClick={() => addOtherLine("product")}><strong>Khoản khác / その他</strong><span>⊕</span><small>Ghi chú sau khi thêm</small></button>}
      </div>

      <div className="nailDivider" />
      <div className="nailOrderTitle"><strong>🛒 Chi tiết đơn hàng</strong><span>{order.lines.length} mục</span></div>
      <div className="nailOrderLines">
        {order.lines.map((line) => <div className="nailOrderLine" key={line.id}>
          <div><strong>{line.name}</strong><small>{yen(line.unitPrice)} / mục · {line.note || "Không ghi chú"}</small></div>
          <div className="nailQty"><button onClick={() => updateLine(line.id, { quantity: Math.max(1, Number(line.quantity || 1) - 1) })}>−</button><span>{line.quantity}</span><button onClick={() => updateLine(line.id, { quantity: Number(line.quantity || 1) + 1 })}>＋</button></div>
          <input className="nailLineInput" type="number" value={line.unitPrice} onChange={(event) => updateLine(line.id, { unitPrice: Number(event.target.value) })} aria-label="Giá" />
          <input className="nailLineNote" value={line.note || ""} onChange={(event) => updateLine(line.id, { note: event.target.value })} placeholder="Ghi chú / その他" />
          <strong>{yen(lineTotal(line))}</strong>
        </div>)}
        {!order.lines.length && <p className="mutedText">Chưa có mục nào trong đơn.</p>}
      </div>

      <div className="nailDivider" />
      <h2 className="nailSectionTitle">🎟️ Mã giảm giá</h2>
      <div className="nailCouponRow"><input value={order.couponCode} onChange={(event) => updateOrder({ couponCode: event.target.value })} placeholder="VD: NAIL10" /><button onClick={() => updateOrder({ orderDiscountType: "percent", orderDiscountValue: 10, couponCode: order.couponCode || "NAIL10" })}>Áp dụng</button></div>
      <p className="mutedText">Thử mã NAIL10 để xem cách giảm 10% trong bản mẫu.</p>

      <div className="nailTotals">
        <button className="nailSubtotalButton" type="button"><span>小計 / Tạm tính</span><strong>{yen(subtotal)}</strong></button>
        <div><span>Giảm giá</span><strong>- {yen(orderDiscount)}</strong></div>
        <div><span>Thuế {taxRate}% {taxMode === "inclusive" ? "(đã gồm trong giá)" : ""}</span><strong>{yen(tax)}</strong></div>
        <div className="grand"><span>Tổng thanh toán</span><strong>{yen(total)}</strong></div>
      </div>

      <div className="nailDivider" />
      <h2 className="nailSectionTitle">💳 Phương thức thanh toán</h2>
      {order.payments.map((payment) => <div className="nailPaymentRow" key={payment.id}>
        <div className="nailPaymentChoices">{paymentMethods.map((method) => <button key={method.id} type="button" className={payment.method === method.id ? "active" : ""} onClick={() => updatePayment(payment.id, { method: method.id })}>{method.label}</button>)}</div>
        <input type="number" value={payment.amount || ""} onChange={(event) => updatePayment(payment.id, { amount: Number(event.target.value) })} placeholder="Số tiền" />
        {payment.method === "cash" ? <input type="number" value={payment.received || ""} onChange={(event) => { const received = Number(event.target.value); updatePayment(payment.id, { received, amount: Math.min(received, total) }); }} placeholder="Khách đưa" /> : <span className="nailPaymentAppName">{paymentLabel(payment.method, paymentMethods)}</span>}
        <button onClick={() => updateOrder({ payments: order.payments.filter((item) => item.id !== payment.id) })}>×</button>
      </div>)}
      <p className="mutedText">Thêm hoặc xóa phương thức thanh toán trong Cài đặt.</p>
      <button className="nailAddPayment" onClick={addPayment}>＋ Thanh toán tách thêm</button>
      <div className="nailPaymentSummary">
        <div><span>Đã nhận</span><strong>{yen(paid)}</strong></div>
        <div><span>Số tiền còn phải trả</span><strong>{yen(remaining)}</strong></div>
        <div className={change > 0 ? "changeDue active" : "changeDue"}><span>Tiền trả lại khách</span><strong>{yen(change)}</strong></div>
        <div><span>Phương thức thanh toán</span><strong>{paymentMethodText || "-"}</strong></div>
      </div>
      {drawerNotice && <div className="nailDrawerNotice">{drawerNotice}</div>}
      <button className="nailComplete" onClick={completePayment}>◎ Thanh toán & in hóa đơn</button>
      <p className="nailDemoNote">Nhập đủ số tiền thanh toán để mở bản xem trước. Đây là bản demo, không lưu giao dịch thật.</p>

      <div className="nailDivider" />
      <div className="nailReceiptButtons">
        <button onClick={() => printDocument("receipt")}>▣ Hóa đơn</button>
        <button onClick={() => printDocument("ryoshusho")}>▣ 領収書</button>
      </div>

      <div className={`printDocument ${printMode === "receipt" ? "active" : ""}`}>
        <div className="printTitle">紙レシート</div>
        <div className="printPaper">
          <div className="printStore">
            <strong>{settings.salonName || "Mai Beauty Salon"}</strong>
            <span>{settings.address || "Tokyo, Japan"}</span>
            <span>{settings.phone || ""}</span>
          </div>
          <div className="printMeta"><span>{new Date().toLocaleDateString("ja-JP")}</span><span>#{order.receiptNumber || order.orderNumber || "POS"}</span></div>
          <h3>お支払い</h3>
          <div className="printItems">{order.lines.map((line) => <p key={line.id}><span>{line.name} × {line.quantity}</span><strong>{yen(lineTotal(line))}</strong></p>)}</div>
          <div className="printRule" />
          <p><span>合計</span><strong>{yen(total)}</strong></p>
          <p><span>お預り</span><strong>{yen(cashReceived)}</strong></p>
          <p><span>残額</span><strong>{yen(remaining)}</strong></p>
          <p><span>{paymentMethodText || "お支払い"}</span><strong>{yen(paid)}</strong></p>
          <p><span>お釣り</span><strong>{yen(change)}</strong></p>
          <div className="printRule" />
          <p><span>税率 10%</span><span>税抜 {yen(Math.max(0, taxableSubtotal - tax))}</span><strong>税額 {yen(tax)}</strong></p>
        </div>
      </div>

      <div className={`printDocument ${printMode === "ryoshusho" ? "active" : ""}`}>
        <div className="printTitle">領収書</div>
        <div className="printPaper">
          <div className="printStore">
            <strong>{settings.salonName || "Mai Beauty Salon"}</strong>
            <span>{settings.address || "Tokyo, Japan"}</span>
            <span>{settings.phone || ""}</span>
          </div>
          <h3>領収書</h3>
          <p className="printRecipient"><span>{order.customer || "____________"}</span><strong>様</strong></p>
          <div className="printRule" />
          <p><span>{new Date().toLocaleDateString("ja-JP")}</span><strong>{paymentMethodText || "現金"}</strong></p>
          <div className="printRule" />
          <p className="printTotal"><span>合計</span><strong>{yen(total)}</strong></p>
          <p><span>お預り</span><strong>{yen(cashReceived)}</strong></p>
          <p><span>残額</span><strong>{yen(remaining)}</strong></p>
          <p><span>但し書き</span><strong>ネイルサービス代として</strong></p>
          <div className="printTaxGrid"><span>税率</span><span>税抜</span><span>税額</span><span>合計</span><span>10%</span><span>{yen(Math.max(0, taxableSubtotal - tax))}</span><span>{yen(tax)}</span><span>{yen(total)}</span></div>
          <small>領収書番号: {order.receiptNumber || order.orderNumber || "POS"}</small>
        </div>
      </div>

      {historyOpen && <div className="posHistoryOverlay"><div className="posHistoryModal"><div className="posHistoryHeader"><div><span>PAYMENT HISTORY</span><h2>Lịch sử thanh toán</h2></div><button onClick={() => setHistoryOpen(false)}>Close</button></div><div className="posHistoryList">{posHistory.length ? posHistory.map((sale) => <button key={sale.id} onClick={() => { setOrder({ ...sale, status: "Reopened" }); setHistoryOpen(false); }}><strong>{sale.customer || "-"}</strong><span>{sale.orderNumber || sale.receiptNumber} · {new Date(sale.issuedAt || Date.now()).toLocaleString("ja-JP")}</span><em>{yen(sale.total)}</em></button>) : <p className="mutedText">Chưa có lịch sử thanh toán.</p>}</div></div></div>}
    </section>
  );
}
