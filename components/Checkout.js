"use client";

import { useEffect, useMemo, useState } from "react";
import { useBookingStore } from "../lib/bookingStore";
import { useProductCatalog, useServiceCatalog } from "../lib/catalogStore";
import { useStaffStore } from "../lib/staffStore";
import { tx } from "../lib/i18nClean";
import { defaultSettings, getAppSettings } from "./Settings";
import PrinterManager from "./PrinterManager";
import { getPrinterSettings, printStarReceipt } from "../lib/starPrinter";

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

const quickDiscounts = [5, 10, 15, 30];

function discountPercentFromText(value) {
  const match = String(value || "").match(/\d+(\.\d+)?/);
  if (!match) return 0;
  return Math.max(0, Math.min(100, Number(match[0])));
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

export async function getSharedPosSales() {
  const response = await fetch("/api/pos-sales", { cache: "no-store", credentials: "include" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(result.value)) throw new Error(result.message || "Cannot load POS sales");
  return result.value;
}

export async function saveSharedPosSales(value) {
  const response = await fetch("/api/pos-sales", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ value }) });
  if (!response.ok) throw new Error("Cannot sync POS sales");
}

export default function Checkout({ label = "POS / Checkout", appointmentId = "", language = "vi", onOpenPaymentHistory }) {
  const tr = (key, vars) => tx(language, "checkoutPage", key, vars);
  const tc = (key) => tx(language, "common", key);
  const { bookings, setBookings } = useBookingStore();
  const [services] = useServiceCatalog();
  const [products, setProducts] = useProductCatalog();
  const { staff } = useStaffStore();
  const [settings] = useState(getAppSettings);
  const [activeTab, setActiveTab] = useState("services");
  const [itemsOpen, setItemsOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
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
    setOrder((current) => current.payments?.some((payment) => payment.method === "cash" && payment.confirmed !== false)
      ? current
      : { ...current, payments: [{ id: newId("pay"), method: "cash", amount: 0, received: 0, confirmed: true }, ...(current.payments || [])] });
  }, []);

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
    setItemsOpen(false);
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
    setItemsOpen(false);
  }

  function updateLine(id, patch) {
    setOrder((current) => ({ ...current, lines: current.lines.map((line) => line.id === id ? { ...line, ...patch } : line) }));
  }

  function removeLine(id) {
    setOrder((current) => ({ ...current, lines: current.lines.filter((line) => line.id !== id) }));
  }

  function updatePayment(id, patch) {
    setOrder((current) => ({ ...current, payments: current.payments.map((payment) => payment.id === id ? { ...payment, ...patch } : payment) }));
  }

  function paymentForMethod(methodId) {
    return order.payments.find((payment) => payment.method === methodId && payment.confirmed !== false);
  }

  function togglePaymentMethod(methodId, checked) {
    setOrder((current) => {
      const existing = current.payments.find((payment) => payment.method === methodId && payment.confirmed !== false);
      if (checked) {
        if (existing) return current;
        return { ...current, payments: [...current.payments, { id: newId("pay"), method: methodId, amount: 0, received: 0, confirmed: true }] };
      }
	      return { ...current, payments: current.payments.filter((payment) => payment.id !== existing?.id) };
    });
    setPaymentOpen(false);
  }

	  function applyQuickDiscount(percent) {
	    setOrder((current) => ({
	      ...current,
	      orderDiscountType: "percent",
	      orderDiscountValue: percent,
	      couponCode: String(percent),
	    }));
	  }

	  function updateDiscountInput(value) {
	    const percent = discountPercentFromText(value);
	    setOrder((current) => ({
	      ...current,
	      couponCode: value,
	      orderDiscountType: "percent",
	      orderDiscountValue: percent,
	    }));
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
	      orderDiscountType: order.orderDiscountType,
	      orderDiscountValue: order.orderDiscountValue,
	      discountLabel: order.orderDiscountType === "percent" && Number(order.orderDiscountValue || 0) > 0 ? `${order.orderDiscountValue}%` : "",
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
    saveSharedPosSales(next).catch(() => setError("Không thể đồng bộ lịch sử thanh toán lên server."));
    setPosHistory(next);
    window.dispatchEvent(new CustomEvent("nail-japan-pos-sales-updated", { detail: next }));
    if (paymentStatus === "Paid" && !order.stockDeducted) {
      const productQty = record.lines.filter((line) => line.type === "product").reduce((map, line) => ({ ...map, [line.sourceId]: (map[line.sourceId] || 0) + Number(line.quantity || 0) }), {});
      setProducts((current) => current.map((product) => productQty[product.id] ? { ...product, stock: Math.max(0, Number(product.stock || 0) - productQty[product.id]) } : product));
      if (record.appointmentId) setBookings((current) => current.map((booking) => String(booking.id) === String(record.appointmentId) ? { ...booking, paymentStatus: "Paid" } : booking));
    }
    setOrder(record);
	    setError(paymentStatus === "Paid" ? "" : tr("partialNotice"));
    if (paymentStatus === "Paid") {
      const hasCashPayment = record.payments.some((payment) => payment.method === "cash" && payment.confirmed !== false && Number(payment.amount || 0) > 0);
      if (hasCashPayment) {
	        setDrawerNotice(tr("drawerNotice", { change: yen(change) }));
        window.dispatchEvent(new CustomEvent("nail-japan-cash-drawer-open", { detail: { orderNumber: record.orderNumber, change } }));
      } else {
        setDrawerNotice("");
      }
      printDocument("receipt", record, hasCashPayment);
    }
  }

  async function printDocument(type, sale = order, openDrawer = false) {
    setPrintMode(type);
    if (type === "receipt" && getPrinterSettings().mode === "star-usb") {
      try { await printStarReceipt(sale, settings, { openDrawer }); setDrawerNotice("Star mPOP: OK"); return; }
      catch (printError) { setError(`Star mPOP: ${printError?.message || "Print failed"}`); }
    }
    window.setTimeout(() => window.print(), 120);
  }

  function printHistorySale(sale, type) {
    setOrder({ ...sale, status: "Reopened" });
    setPrintMode(type);
    window.setTimeout(() => window.print(), 160);
  }

  return (
    <section className="card nailPosPanel">
	      <div className="nailPosHeader">
	        <div><h1>{label}</h1><p>{tr("subtitle")}</p></div>
	        <div className="nailPosHeaderActions"><PrinterManager language={language} /><button className="ghost" onClick={() => onOpenPaymentHistory ? onOpenPaymentHistory() : setHistoryOpen(true)}>{tr("paymentHistory")}</button><span className="pill active">{order.paymentStatus === "Paid" ? tr("paid") : tr("draft")}</span></div>
      </div>

      {error && <div className="orderToast card"><strong>POS</strong><span>{error}</span></div>}

      <div className="nailCustomerBlock">
        <div>
          <strong>👤 {order.customer || "Nguyễn A"}</strong>
          <span>🗓️ 08/10/2026 · 14:00-15:30</span>
	          <span>💅 {tc("staff")}: {order.employee || staff[0]?.name || "Mai"} · {tr("returningCustomer")}</span>
        </div>
        <select value={order.appointmentId} onChange={(event) => chooseAppointment(event.target.value)}>
	          <option value="">{tr("chooseAppointment")}</option>
          {bookings.map((booking) => <option key={booking.id} value={booking.id}>{booking.customer} - {booking.service}</option>)}
        </select>
      </div>

	      <button type="button" className={itemsOpen ? "nailDisclosure active" : "nailDisclosure"} onClick={() => setItemsOpen((value) => !value)} aria-expanded={itemsOpen}><span>{tr("addItems")}</span><strong>{itemsOpen ? "−" : "+"}</strong></button>
      {itemsOpen && <div className="nailCollapsible"><div className="nailTabs">
	        <button className={activeTab === "services" ? "active" : ""} onClick={() => setActiveTab("services")}>💅 {tc("service")}</button>
	        <button className={activeTab === "products" ? "active" : ""} onClick={() => setActiveTab("products")}>🛍️ {tr("products")}</button>
      </div>
      <div className="nailItemGrid">
        {activeTab === "services" && visibleServices.slice(0, 8).map((service) => <button className="nailMenuItem" key={service.id} onClick={() => addLine(service, "service")}><strong>{service.name}</strong><span>⊕</span><small>{yen(service.price)}</small></button>)}
	        {activeTab === "services" && <button className="nailMenuItem" onClick={() => addOtherLine("service")}><strong>{tr("otherItem")}</strong><span>⊕</span><small>{tr("noteAfterAdd")}</small></button>}
        {activeTab === "products" && visibleProducts.slice(0, 8).map((product) => <button className="nailMenuItem" key={product.id} onClick={() => addLine(product, "product")} disabled={Number(product.stock || 0) <= 0}><strong>{product.name}</strong><span>⊕</span><small>{yen(product.salePrice || product.basePrice)}</small></button>)}
	        {activeTab === "products" && <button className="nailMenuItem" onClick={() => addOtherLine("product")}><strong>{tr("otherItem")}</strong><span>⊕</span><small>{tr("noteAfterAdd")}</small></button>}
      </div></div>}

      <div className="nailDivider" />
	      <div className="nailOrderTitle"><strong>🛒 {tr("orderDetail")}</strong><span>{tr("itemCount", { count: order.lines.length })}</span></div>
      <div className="nailOrderLines">
        {order.lines.map((line) => <div className="nailOrderLine" key={line.id}>
	          <div><strong>{line.name}</strong><small>{yen(line.unitPrice)} / {tr("itemUnit")} · {line.note || tr("noNote")}</small></div>
          <div className="nailQty"><button onClick={() => updateLine(line.id, { quantity: Math.max(1, Number(line.quantity || 1) - 1) })}>−</button><span>{line.quantity}</span><button onClick={() => updateLine(line.id, { quantity: Number(line.quantity || 1) + 1 })}>＋</button></div>
	          <input className="nailLineInput" type="number" value={line.unitPrice} onChange={(event) => updateLine(line.id, { unitPrice: Number(event.target.value) })} aria-label={tc("price")} />
	          <input className="nailLineNote" value={line.note || ""} onChange={(event) => updateLine(line.id, { note: event.target.value })} placeholder={tc("note")} />
          <strong>{yen(lineTotal(line))}</strong>
        </div>)}
	        {!order.lines.length && <p className="mutedText">{tr("emptyOrder")}</p>}
      </div>

      <div className="nailDivider" />
	      <h2 className="nailSectionTitle">🎟️ {tr("discountTitle")}</h2>
	      <div className="nailDiscountControl">
	        <div className="nailDiscountInputWrap"><input type="text" inputMode="decimal" value={order.couponCode} onChange={(event) => updateDiscountInput(event.target.value)} placeholder={tr("couponPlaceholder")} /><span>%</span></div>
	        <div className="nailQuickDiscounts">{quickDiscounts.map((percent) => <button key={percent} type="button" className={order.orderDiscountType === "percent" && Number(order.orderDiscountValue) === percent ? "active" : ""} onClick={() => applyQuickDiscount(percent)}>{percent}%</button>)}</div>
	      </div>
	      <p className="mutedText">{tr("discountHint")}</p>

      <div className="nailTotals">
	        <button className="nailSubtotalButton" type="button"><span>{tr("subtotal")}</span><strong>{yen(subtotal)}</strong></button>
	        <div><span>{tr("discount")} {order.orderDiscountType === "percent" && Number(order.orderDiscountValue || 0) > 0 ? `(${order.orderDiscountValue}%)` : ""}</span><strong>- {yen(orderDiscount)}</strong></div>
	        <div><span>{tr("tax")} {taxRate}% {taxMode === "inclusive" ? tr("taxIncluded") : ""}</span><strong>{yen(tax)}</strong></div>
	        <div className="grand"><span>{tr("grandTotal")}</span><strong>{yen(total)}</strong></div>
      </div>

      <div className="nailDivider" />
	      <div className="nailCashFixed">
	        <div className="nailCashFixedTitle"><span>💴</span><div><strong>{paymentLabel("cash", paymentMethods)}</strong><small>{tr("cashReceived")}</small></div><span className="pill active">{tr("paid")}</span></div>
	        <div className="nailCashFixedInputs">
          <label><span>{tr("amount")}</span><input type="number" value={paymentForMethod("cash")?.amount || ""} onChange={(event) => { const payment = paymentForMethod("cash"); if (payment) { const amount = Number(event.target.value); updatePayment(payment.id, { amount, received: amount }); } }} /></label>
	        </div>
        <div className={change > 0 ? "nailCashChange active" : "nailCashChange"}><span>{tr("change")}</span><strong>{yen(change)}</strong></div>
	      </div>
	      <button type="button" className={paymentOpen ? "nailDisclosure active" : "nailDisclosure"} onClick={() => setPaymentOpen((value) => !value)} aria-expanded={paymentOpen}><span>💳 {tr("paymentMethods")}</span><span className="nailDisclosureValue">{paymentMethodText || paymentLabel("cash", paymentMethods)}</span><strong>{paymentOpen ? "−" : "+"}</strong></button>
      {paymentOpen && <div className="nailCollapsible"><div className="nailPaymentMethodList">
        {paymentMethods.filter((method) => method.id !== "cash").map((method) => {
          const payment = paymentForMethod(method.id);
          const selected = Boolean(payment);
          return (
            <label className={selected ? "nailPaymentOption active" : "nailPaymentOption"} key={method.id}>
              <input type="checkbox" checked={selected} onChange={(event) => togglePaymentMethod(method.id, event.target.checked)} />
              <span>{method.label}</span>
              <input
                type="number"
                value={payment?.amount || ""}
                onChange={(event) => payment && updatePayment(payment.id, { amount: Number(event.target.value) })}
	                placeholder={tr("amount")}
                disabled={!selected}
              />
              {method.id === "cash" ? (
                <input
                  type="number"
                  value={payment?.received || ""}
                  onChange={(event) => {
                    if (!payment) return;
                    const received = Number(event.target.value);
                    updatePayment(payment.id, { received, amount: Math.min(received, total) });
                  }}
                  placeholder={tr("cashReceived")}
                  disabled={!selected}
                />
	              ) : <small>{tr("nonCashPayment")}</small>}
            </label>
          );
        })}
      </div>
	      <p className="mutedText">{tr("paymentHint")}</p></div>}
      <div className="nailPaymentSummary">
	        <div><span>{tr("paidAmount")}</span><strong>{yen(paid)}</strong></div>
	        <div><span>{tr("remaining")}</span><strong>{yen(remaining)}</strong></div>
	        <div className={change > 0 ? "changeDue active" : "changeDue"}><span>{tr("change")}</span><strong>{yen(change)}</strong></div>
	        <div><span>{tr("paymentMethods")}</span><strong>{paymentMethodText || "-"}</strong></div>
      </div>
      {drawerNotice && <div className="nailDrawerNotice">{drawerNotice}</div>}
	      <button className="nailComplete" onClick={completePayment}>◎ {tr("payAndPrint")}</button>
	      <p className="nailDemoNote">{tr("demoNote")}</p>

      <div className="nailDivider" />
      <div className="nailReceiptButtons">
	        <button onClick={() => printDocument("receipt")}>▣ {tr("receipt")}</button>
        <button onClick={() => printDocument("ryoshusho")}>▣ {tr("reprintRyoshusho")}</button>
      </div>

      <div className={`printDocument printReceipt ${printMode === "receipt" ? "active" : ""}`}>
        
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
	          <p><span>{tr("subtotal")}</span><strong>{yen(subtotal)}</strong></p>
	          <p><span>{tr("discount")} {order.orderDiscountType === "percent" && Number(order.orderDiscountValue || 0) > 0 ? `(${order.orderDiscountValue}%)` : ""}</span><strong>- {yen(orderDiscount)}</strong></p>
	          <p><span>{tr("grandTotal")}</span><strong>{yen(total)}</strong></p>
	          <p><span>{tr("cashReceived")}</span><strong>{yen(cashReceived)}</strong></p>
	          <p><span>{tr("remaining")}</span><strong>{yen(remaining)}</strong></p>
	          <p><span>{paymentMethodText || tr("paymentMethods")}</span><strong>{yen(paid)}</strong></p>
	          <p><span>{tr("change")}</span><strong>{yen(change)}</strong></p>
          <div className="printRule" />
	          <p><span>{tr("tax")} {taxRate}%</span><span>{tr("taxBase")} {yen(Math.max(0, taxableSubtotal - tax))}</span><strong>{tr("taxAmount")} {yen(tax)}</strong></p>
        </div>
      </div>

      <div className={`printDocument printRyoshusho ${printMode === "ryoshusho" ? "active" : ""}`}>
        
        <div className="printPaper">
          <div className="printStore">
            <strong>{settings.salonName || "Mai Beauty Salon"}</strong>
            <span>{settings.address || "Tokyo, Japan"}</span>
            <span>{settings.phone || ""}</span>
          </div>
          <h3>領収書</h3>
          <p className="printRecipient"><span>&nbsp;</span><strong>様</strong></p>
          <div className="printRule" />
          <p><span>{new Date().toLocaleDateString("ja-JP")}</span><strong>{paymentMethodText || "現金"}</strong></p>
          <div className="printRule" />
	          <p><span>{tr("subtotal")}</span><strong>{yen(subtotal)}</strong></p>
	          <p><span>{tr("discount")} {order.orderDiscountType === "percent" && Number(order.orderDiscountValue || 0) > 0 ? `(${order.orderDiscountValue}%)` : ""}</span><strong>- {yen(orderDiscount)}</strong></p>
	          <p className="printTotal"><span>{tr("grandTotal")}</span><strong>{yen(total)}</strong></p>
	          <p><span>{tr("cashReceived")}</span><strong>{yen(cashReceived)}</strong></p>
	          <p><span>{tr("remaining")}</span><strong>{yen(remaining)}</strong></p>
          <p><span>但し書き</span><strong>ネイルサービス代として</strong></p>
	          <div className="printTaxGrid"><span>{tr("taxRate")}</span><span>{tr("taxBase")}</span><span>{tr("taxAmount")}</span><span>{tr("grandTotal")}</span><span>{taxRate}%</span><span>{yen(Math.max(0, taxableSubtotal - tax))}</span><span>{yen(tax)}</span><span>{yen(total)}</span></div>
          <small>領収書番号: {order.receiptNumber || order.orderNumber || "POS"}</small>
        </div>
      </div>

	      {historyOpen && <div className="posHistoryOverlay"><div className="posHistoryModal"><div className="posHistoryHeader"><div><span>PAYMENT HISTORY</span><h2>{tr("paymentHistory")}</h2></div><button onClick={() => setHistoryOpen(false)}>{tc("close")}</button></div><div className="posHistoryList">{posHistory.length ? posHistory.map((sale) => <div className="posHistoryItem" key={sale.id}><button type="button" onClick={() => { setOrder({ ...sale, status: "Reopened" }); setHistoryOpen(false); }}><strong>{sale.customer || "-"}</strong><span>{sale.orderNumber || sale.receiptNumber} · {new Date(sale.issuedAt || Date.now()).toLocaleString("ja-JP")}</span><em>{yen(sale.total)}</em></button><div className="posHistoryActions"><button type="button" onClick={() => printHistorySale(sale, "receipt")}>{tr("reprintReceipt")}</button><button type="button" onClick={() => printHistorySale(sale, "ryoshusho")}>{tr("reprintRyoshusho")}</button></div></div>) : <p className="mutedText">{tr("emptyHistory")}</p>}</div></div></div>}
    </section>
  );
}
