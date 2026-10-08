"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { orders as seedOrders } from "../lib/ecommerce/data";
import { tx } from "../lib/i18nClean";
import { useStoreOrders } from "../lib/orderStore";
import { getStoredPosSales } from "./Checkout";

function money(value) {
  return `JPY ${Number(value || 0).toLocaleString("ja-JP")}`;
}

function yen(value) {
  return `¥${Math.round(Number(value || 0)).toLocaleString("ja-JP")}`;
}

function orderLineTotal(line) {
  return Math.max(0, Number(line.unitPrice || 0) * Number(line.quantity || 1) - Number(line.discountValue || 0));
}

function normalizeSeedOrder(order) {
  return { id: order.id, orderNumber: order.orderNumber, customer: order.customer, phone: "-", email: "-", productName: `${order.items} items`, total: order.total, createdAt: order.createdAt, paymentStatus: order.paymentStatus, status: order.fulfillmentStatus, fulfillmentType: order.source, address: "-", chat: [], unread: false };
}

function normalizePosSale(sale) {
  const lines = sale.lines || [];
  const cashReceived = (sale.payments || []).filter((payment) => payment.method === "cash").reduce((sum, payment) => sum + Number(payment.received || 0), 0);
  const change = cashReceived > 0 ? Math.max(0, cashReceived - Number(sale.total || 0)) : Number(sale.change || 0);
  return {
    ...sale,
    id: `pos-${sale.id}`,
    sourceId: sale.id,
    orderNumber: sale.orderNumber || sale.receiptNumber || "POS",
    customer: sale.customer || "-",
    phone: sale.phone || "-",
    email: "-",
    productName: lines.length ? lines.map((line) => line.name).join(", ") : "POS payment",
    total: sale.total,
    createdAt: sale.issuedAt,
    paymentStatus: sale.paymentStatus,
    status: sale.status || "Completed",
    fulfillmentType: "POS",
    address: "-",
    chat: [],
    unread: false,
    change,
    isPosSale: true,
  };
}

export default function Orders({ language = "vi" }) {
  const tr = (key, vars) => tx(language, "orders", key, vars);
  const tc = (key) => tx(language, "common", key);
  const { orders, updateOrder, confirmOrder, markShipped, addChatMessage } = useStoreOrders();
  const [posSales, setPosSales] = useState(() => getStoredPosSales());
  const [selectedId, setSelectedId] = useState("");
  const [reply, setReply] = useState("");
  const [toast, setToast] = useState("");
  const [printMode, setPrintMode] = useState("");
  const previousCount = useRef(0);
  const posHistory = useMemo(() => posSales.map(normalizePosSale), [posSales]);
  const allOrders = useMemo(() => [...posHistory, ...orders, ...seedOrders.map(normalizeSeedOrder)], [posHistory, orders]);
  const selected = allOrders.find((order) => order.id === selectedId) || allOrders[0];
  const revenue = allOrders.reduce((total, order) => total + Number(order.total || 0), 0);
  const unreadCount = orders.filter((order) => order.unread).length;

  useEffect(() => {
    function syncPosSales(event) {
      setPosSales(Array.isArray(event.detail) ? event.detail : getStoredPosSales());
    }
    window.addEventListener("nail-japan-pos-sales-updated", syncPosSales);
    window.addEventListener("storage", syncPosSales);
    return () => {
      window.removeEventListener("nail-japan-pos-sales-updated", syncPosSales);
      window.removeEventListener("storage", syncPosSales);
    };
  }, []);

  useEffect(() => {
    if (!selectedId && allOrders[0]) setSelectedId(allOrders[0].id);
  }, [allOrders, selectedId]);

  useEffect(() => {
    if (previousCount.current && orders.length > previousCount.current) {
      const newest = orders[0];
      setToast(tr("newOrderToast", { order: newest.orderNumber }));
      setSelectedId(newest.id);
      const timer = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(timer);
    }
    previousCount.current = orders.length;
  }, [orders, tr]);

  function openOrder(order) {
    setSelectedId(order.id);
    if (order.unread) updateOrder(order.id, { unread: false });
  }

  function sendReply() {
    if (!selected || selected.id.startsWith("order-1") || selected.id.startsWith("order-2")) return;
    addChatMessage(selected.id, reply, "owner");
    setReply("");
  }

  function updateSelected(field, value) {
    if (!selected || selected.isPosSale || !orders.some((order) => order.id === selected.id)) return;
    updateOrder(selected.id, { [field]: value });
  }

  function printStoredReceipt(type) {
    if (!selected) return;
    setPrintMode(type);
    window.dispatchEvent(new CustomEvent("nail-japan-print-document", { detail: { type, orderNumber: selected.orderNumber } }));
    window.setTimeout(() => window.print(), 120);
  }

  return (
    <>
      <div className="pageHead"><div><p className="eyebrow">ORDERS</p><h1>{tr("title")}</h1><p>{tr("desc")}</p></div><button className="primary">{tc("exportCsv")}</button></div>
      {toast && <div className="orderToast card"><strong>{tr("notify")}</strong><span>{toast}</span></div>}
      <div className="stats"><div className="stat card"><span>{tr("customerOrders")}</span><strong>{orders.length}</strong><small>{tr("unread", { count: unreadCount })}</small></div><div className="stat card"><span>{tr("allOrders")}</span><strong>{allOrders.length}</strong><small>{tr("sample")}</small></div><div className="stat card"><span>{tr("revenue")}</span><strong>{money(revenue)}</strong><small>{tc("total")}</small></div><div className="stat card"><span>{tr("needsAction")}</span><strong>{allOrders.filter((order) => !["FULFILLED", "Completed", "Delivered"].includes(order.status)).length}</strong><small>{tc("status")}</small></div></div>
      <div className="ordersWorkspace">
        <section className="card tableWrap ordersTable"><table><thead><tr><th>Order</th><th>{tc("customer")}</th><th>Product</th><th>{tc("payment")}</th><th>{tc("status")}</th><th>{tc("total")}</th></tr></thead><tbody>{allOrders.map((order) => <tr key={order.id} className={selected?.id === order.id ? "selectedOrderRow" : ""} onClick={() => openOrder(order)}><td><strong>{order.orderNumber}</strong>{order.unread && <span className="newDot">New</span>}{order.isPosSale && <span className="newDot">POS</span>}</td><td>{order.customer}<br /><small>{order.phone}</small></td><td>{order.productName}</td><td><span className="pill">{order.paymentStatus}</span></td><td><span className="pill active">{order.status}</span></td><td><strong>{money(order.total)}</strong></td></tr>)}</tbody></table></section>
        {selected && <aside className="card orderDetailPanel"><div className="sectionTitle"><div><h2>{selected.orderNumber}</h2><p>{selected.productName}</p></div><span className="pill active">{selected.fulfillmentType}</span></div><div className="orderInfoGrid"><div><span>{tc("customer")}</span><strong>{selected.customer}</strong></div><div><span>{tc("phone")}</span><strong>{selected.phone}</strong></div><div><span>{tr("detailEmail")}</span><strong>{selected.email}</strong></div><div><span>{tc("total")}</span><strong>{money(selected.total)}</strong></div>{selected.isPosSale && <><div><span>Phương thức thanh toán</span><strong>{selected.paymentMethodText || "-"}</strong></div><div><span>Tiền trả lại khách</span><strong>{money(selected.change)}</strong></div></>}</div><div className="orderActionBar">{selected.isPosSale ? <><button className="primary" onClick={() => printStoredReceipt("receipt")}>In lại hóa đơn</button><button className="ghost" onClick={() => printStoredReceipt("ryoshusho")}>In lại 領収書</button></> : <><button className="primary" onClick={() => confirmOrder(selected.id, "Admin")}>{tr("confirm")}</button><button className="ghost" onClick={() => markShipped(selected.id)}>{tr("shipped")}</button></>}</div>{selected.isPosSale && <><div className="posReceiptPreview"><h3>Lịch sử thanh toán</h3>{(selected.lines || []).map((line) => <p key={line.id}><span>{line.name} × {line.quantity}</span><strong>{money(Number(line.unitPrice || 0) * Number(line.quantity || 1))}</strong></p>)}<p><span>Giảm giá</span><strong>- {money(selected.orderDiscount)}</strong></p><p><span>Thuế</span><strong>{money(selected.tax)}</strong></p><p className="total"><span>Tổng</span><strong>{money(selected.total)}</strong></p><small>{selected.storeSnapshot?.salonName || ""} {selected.storeSnapshot?.phone || ""}</small></div><div className={`printDocument ${printMode === "receipt" ? "active" : ""}`}><div className="printTitle">紙レシート</div><div className="printPaper"><div className="printStore"><strong>{selected.storeSnapshot?.salonName || "Mai Beauty Salon"}</strong><span>{selected.storeSnapshot?.address || "Tokyo, Japan"}</span><span>{selected.storeSnapshot?.phone || ""}</span></div><div className="printMeta"><span>{new Date(selected.issuedAt || selected.createdAt || Date.now()).toLocaleDateString("ja-JP")}</span><span>#{selected.receiptNumber || selected.orderNumber}</span></div><h3>お支払い</h3><div className="printItems">{(selected.lines || []).map((line) => <p key={line.id}><span>{line.name} × {line.quantity}</span><strong>{yen(orderLineTotal(line))}</strong></p>)}</div><div className="printRule" /><p><span>合計</span><strong>{yen(selected.total)}</strong></p><p><span>{selected.paymentMethodText || "お支払い"}</span><strong>{yen(selected.paid)}</strong></p><p><span>お釣り</span><strong>{yen(selected.change)}</strong></p><div className="printRule" /><p><span>税率 10%</span><span>税抜 {yen(Math.max(0, Number(selected.total || 0) - Number(selected.tax || 0)))}</span><strong>税額 {yen(selected.tax)}</strong></p></div></div><div className={`printDocument ${printMode === "ryoshusho" ? "active" : ""}`}><div className="printTitle">領収書</div><div className="printPaper"><div className="printStore"><strong>{selected.storeSnapshot?.salonName || "Mai Beauty Salon"}</strong><span>{selected.storeSnapshot?.address || "Tokyo, Japan"}</span><span>{selected.storeSnapshot?.phone || ""}</span></div><h3>領収書</h3><p className="printRecipient"><span>{selected.customer || "____________"}</span><strong>様</strong></p><div className="printRule" /><p><span>{new Date(selected.issuedAt || selected.createdAt || Date.now()).toLocaleDateString("ja-JP")}</span><strong>{selected.paymentMethodText || "現金"}</strong></p><div className="printRule" /><p className="printTotal"><span>合計</span><strong>{yen(selected.total)}</strong></p><p><span>但し書き</span><strong>ネイルサービス代として</strong></p><div className="printTaxGrid"><span>税率</span><span>税抜</span><span>税額</span><span>合計</span><span>10%</span><span>{yen(Math.max(0, Number(selected.total || 0) - Number(selected.tax || 0)))}</span><span>{yen(selected.tax)}</span><span>{yen(selected.total)}</span></div><small>領収書番号: {selected.receiptNumber || selected.orderNumber}</small></div></div></>} {!selected.isPosSale && <><div className="orderStatusControls"><label>{tr("orderStatus")}<select value={selected.status} onChange={(event) => updateSelected("status", event.target.value)}><option>Waiting payment</option><option>Payment checking</option><option>Preparing</option><option>Ready for pickup</option><option>Shipping</option><option>Delivered</option><option>Completed</option><option>Cancelled</option></select></label><label>{tr("paymentStatus")}<select value={selected.paymentStatus} onChange={(event) => updateSelected("paymentStatus", event.target.value)}><option>Waiting payment</option><option>Payment checking</option><option>Paid</option><option>Pay at store</option><option>Refunded</option></select></label></div>{selected.address && selected.address !== "-" && <div className="orderAddress"><span>{tc("address")}</span><strong>{selected.address}</strong></div>}{selected.transferBillUrl && <div className="orderBill"><span>{tr("bill")}</span><img src={selected.transferBillUrl} alt="Transfer bill" /></div>}{(selected.emailLog || []).length > 0 && <div className="emailLogBox"><h3>{tr("emailLog")}</h3>{selected.emailLog.map((email) => <p key={email.id}><strong>{email.subject}</strong><span>{email.body}</span><small>{new Date(email.at).toLocaleString("ja-JP")}</small></p>)}</div>}<div className="ownerChatBox"><h3>{tr("chat")}</h3><div className="ownerChatMessages">{(selected.chat || []).length ? selected.chat.map((item) => <p key={item.id} className={item.from === "owner" ? "fromOwner" : "fromCustomer"}><strong>{item.from === "owner" ? tr("owner") : tr("guest")}</strong>{item.text}</p>) : <span>{tr("noChat")}</span>}</div><div className="ownerReply"><input value={reply} onChange={(event) => setReply(event.target.value)} placeholder={tr("replyPlaceholder")} /><button className="primary" onClick={sendReply}>{tc("send")}</button></div></div></>}</aside>}
      </div>
    </>
  );
}
