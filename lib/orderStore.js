"use client";

import { useEffect, useState } from "react";

const ORDER_KEY = "nail-japan-store-orders";
const ORDER_EVENT = "nail-japan-store-orders-updated";

export function getStoreOrders() {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(ORDER_KEY);
  if (!raw) return [];
  try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

export async function saveStoreOrders(orders) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ORDER_KEY, JSON.stringify(orders));
  window.dispatchEvent(new CustomEvent(ORDER_EVENT, { detail: orders }));
  const response = await fetch("/api/orders", {
    method: "POST",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orders }),
  });
  if (!response.ok) throw new Error("Cannot sync shared orders");
}

async function getSharedOrders() {
  const response = await fetch("/api/orders", { cache: "no-store" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(result.value)) throw new Error(result.message || "Cannot load shared orders");
  return result.value;
}

function mergeOrders(remote, local) {
  const merged = new Map((Array.isArray(remote) ? remote : []).map((order) => [order.id, order]));
  (Array.isArray(local) ? local : []).forEach((order) => merged.set(order.id, order));
  return Array.from(merged.values()).sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
}

function emailRecord(subject, body) {
  return { id: `email-${Date.now()}`, subject, body, at: new Date().toISOString(), channel: "gmail" };
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

function emailLayout(title, message, details = "") {
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
  const action = siteUrl ? `<p style="margin:24px 0;text-align:center"><a href="${escapeHtml(siteUrl)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#9333ea;color:#fff;text-decoration:none;font-weight:700">Mở trang Mai Beauty Salon</a></p>` : "";
  return `<div style="margin:0;background:#fff7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#332936"><div style="max-width:600px;margin:auto;background:#fff;border:1px solid #f0dce8;border-radius:20px;overflow:hidden;box-shadow:0 8px 24px rgba(100,50,90,.08)"><div style="padding:24px 28px;background:linear-gradient(135deg,#f6d8ec,#eadcff)"><div style="font-size:12px;letter-spacing:2px;color:#7c3f62">MAI BEAUTY SALON</div><h1 style="margin:10px 0 0;font-size:24px;color:#332936">${escapeHtml(title)}</h1></div><div style="padding:28px;font-size:15px;line-height:1.7"><p style="white-space:pre-line">${escapeHtml(message)}</p>${details ? `<div style="margin-top:20px;padding:16px;border-radius:14px;background:#fff7fb;border:1px solid #f0dce8">${details}</div>` : ""}${action}<p style="margin:24px 0 0;color:#7b6b78;font-size:13px">Trân trọng,<br/><strong>Mai Beauty Salon</strong></p></div></div></div>`;
}

function sendOrderEmail(order, kind) {
  const recipient = String(order?.email || "").trim().toLowerCase();
  if (!recipient || !recipient.includes("@")) return;
  const language = order.language || "vi";
  const copy = {
    vi: { confirmed: { subject: `Mai Beauty Salon · Đơn ${order.orderNumber} đã được xác nhận`, message: `Xin chào ${order.customer || "Quý khách"},\n\nĐơn hàng của quý khách đã được salon xác nhận và đang được xử lý.` }, shipped: { subject: `Mai Beauty Salon · Đơn ${order.orderNumber} đã được gửi`, message: `Xin chào ${order.customer || "Quý khách"},\n\nĐơn hàng của quý khách đã được bàn giao cho đơn vị vận chuyển.` }, payment: { subject: `Mai Beauty Salon · Đang kiểm tra thanh toán đơn ${order.orderNumber}`, message: `Xin chào ${order.customer || "Quý khách"},\n\nSalon đã nhận được thông tin thanh toán và đang tiến hành kiểm tra.` } },
    ja: { confirmed: { subject: `Mai Beauty Salon・注文 ${order.orderNumber} 確認完了`, message: `${order.customer || "お客様"}、\n\nご注文を確認し、対応を開始しました。` }, shipped: { subject: `Mai Beauty Salon・注文 ${order.orderNumber} 発送のお知らせ`, message: `お客様、\n\nご注文の商品を配送業者へ引き渡しました。` }, payment: { subject: `Mai Beauty Salon・注文 ${order.orderNumber} お支払い確認中`, message: `お客様、\n\nお支払い情報を受け取り、確認しております。` } },
    en: { confirmed: { subject: `Mai Beauty Salon · Order ${order.orderNumber} confirmed`, message: `Hello ${order.customer || "there"},\n\nYour order has been confirmed and is now being processed.` }, shipped: { subject: `Mai Beauty Salon · Order ${order.orderNumber} shipped`, message: `Hello ${order.customer || "there"},\n\nYour order has been handed over to the delivery service.` }, payment: { subject: `Mai Beauty Salon · Payment review for order ${order.orderNumber}`, message: `Hello ${order.customer || "there"},\n\nWe received your payment information and are reviewing it now.` } },
  }[language] || {};
  const item = copy[kind];
  if (!item) return;
  const details = `<strong>Mã đơn:</strong> ${escapeHtml(order.orderNumber)}<br/><strong>Trạng thái:</strong> ${escapeHtml(order.status)}`;
  fetch("/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: recipient, subject: item.subject, html: emailLayout(item.subject, item.message, details) }) }).then(async (response) => {
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) console.error("Order notification failed:", result.reason || result.message || response.status);
  }).catch((error) => console.error("Order notification failed:", error));
}

export function useStoreOrders() {
  const [orders, setOrdersState] = useState([]);
  const [syncStatus, setSyncStatus] = useState("local");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const local = getStoreOrders();
      setOrdersState(local);
      try {
        const remote = await getSharedOrders();
        if (mounted && Array.isArray(remote)) {
          const next = mergeOrders(remote, local);
          setOrdersState(next);
          window.localStorage.setItem(ORDER_KEY, JSON.stringify(next));
          if (next.length > remote.length) saveStoreOrders(next).catch(() => {});
          setSyncStatus("shared");
        }
      } catch { if (mounted) setSyncStatus("local"); }
    }
    load();
    function sync(event) { setOrdersState(event.detail || getStoreOrders()); }
    function syncStorage(event) { if (event.key === ORDER_KEY) setOrdersState(getStoreOrders()); }
    window.addEventListener(ORDER_EVENT, sync);
    window.addEventListener("storage", syncStorage);
    const interval = window.setInterval(() => {
      getSharedOrders().then((remote) => {
        if (!mounted || !Array.isArray(remote)) return;
        const next = mergeOrders(remote, getStoreOrders());
        setOrdersState(next);
        window.localStorage.setItem(ORDER_KEY, JSON.stringify(next));
        if (next.length > remote.length) saveStoreOrders(next).catch(() => {});
        setSyncStatus("shared");
      }).catch(() => {});
    }, 5000);
    return () => { mounted = false; window.clearInterval(interval); window.removeEventListener(ORDER_EVENT, sync); window.removeEventListener("storage", syncStorage); };
  }, []);

  function setOrders(updater) {
    setOrdersState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      saveStoreOrders(next).catch(() => setSyncStatus("local"));
      return next;
    });
  }

  function addOrder(order) {
    const record = { id: `order-${Date.now()}`, orderNumber: `WEB-${Date.now().toString().slice(-6)}`, status: order.fulfillmentType === "shipping" ? "Waiting payment" : "Pickup reserved", paymentStatus: order.fulfillmentType === "shipping" ? "Waiting payment" : "Pay at store", createdAt: new Date().toISOString(), chat: [], emailLog: [emailRecord("Đã nhận đơn hàng", "Cửa hàng đã nhận được đơn hàng của bạn và sẽ xử lý sớm.")], transferBillUrl: "", unread: true, confirmedByStaff: false, shippedAt: "", ...order };
    setOrders((current) => [record, ...current]);
    return record;
  }

  function updateOrder(id, patch) { setOrders((current) => current.map((order) => order.id === id ? { ...order, ...patch } : order)); }
  function cancelOrder(id) { updateOrder(id, { status: "Cancelled" }); }
  function removeOrder(id) {
    setOrdersState((current) => {
      const next = current.filter((order) => order.id !== id);
      window.localStorage.setItem(ORDER_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent(ORDER_EVENT, { detail: next }));
      return next;
    });
    fetch(`/api/orders?id=${encodeURIComponent(id)}`, { method: "DELETE", keepalive: true }).catch(() => setSyncStatus("local"));
  }
  function confirmOrder(id, staffName = "Staff") { setOrders((current) => current.map((order) => { if (order.id !== id) return order; const next = { ...order, confirmedByStaff: true, confirmedBy: staffName, status: order.status === "Waiting payment" ? "Confirmed" : order.status, emailLog: [...(order.emailLog || []), emailRecord("Đơn hàng đã được xác nhận", `Nhân viên ${staffName} đã xác nhận đơn ${order.orderNumber}.`)] }; sendOrderEmail(next, "confirmed"); return next; })); }
  function markShipped(id) { setOrders((current) => current.map((order) => { if (order.id !== id) return order; const next = { ...order, status: "Shipping", shippedAt: new Date().toISOString(), emailLog: [...(order.emailLog || []), emailRecord("Đơn hàng đã được gửi", `Đơn ${order.orderNumber} đã được gửi cho đơn vị vận chuyển. Bạn có thể tiếp tục theo dõi trạng thái đơn hàng.`)] }; sendOrderEmail(next, "shipped"); return next; })); }
  function addChatMessage(id, message, from = "customer") { if (!message.trim()) return; setOrders((current) => current.map((order) => order.id === id ? { ...order, unread: from === "customer" ? true : order.unread, chat: [...(order.chat || []), { id: `msg-${Date.now()}`, from, text: message.trim(), at: new Date().toISOString() }] } : order)); }

  return { orders, addOrder, updateOrder, cancelOrder, removeOrder, confirmOrder, markShipped, addChatMessage, syncStatus };
}
