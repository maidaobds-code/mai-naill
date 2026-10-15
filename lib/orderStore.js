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

function emailRecord(subject, body) {
  return { id: `email-${Date.now()}`, subject, body, at: new Date().toISOString(), channel: "gmail" };
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
          const next = remote.length ? remote : local;
          setOrdersState(next);
          window.localStorage.setItem(ORDER_KEY, JSON.stringify(next));
          if (!remote.length && local.length) saveStoreOrders(local).catch(() => {});
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
        setOrdersState(remote);
        window.localStorage.setItem(ORDER_KEY, JSON.stringify(remote));
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
  function confirmOrder(id, staffName = "Staff") { setOrders((current) => current.map((order) => order.id === id ? { ...order, confirmedByStaff: true, confirmedBy: staffName, status: order.status === "Waiting payment" ? "Confirmed" : order.status, emailLog: [...(order.emailLog || []), emailRecord("Đơn hàng đã được xác nhận", `Nhân viên ${staffName} đã xác nhận đơn ${order.orderNumber}.`)] } : order)); }
  function markShipped(id) { setOrders((current) => current.map((order) => order.id === id ? { ...order, status: "Shipping", shippedAt: new Date().toISOString(), emailLog: [...(order.emailLog || []), emailRecord("Đơn hàng đã được gửi", `Đơn ${order.orderNumber} đã được gửi cho đơn vị vận chuyển. Bạn có thể tiếp tục theo dõi trạng thái đơn hàng.`)] } : order)); }
  function addChatMessage(id, message, from = "customer") { if (!message.trim()) return; setOrders((current) => current.map((order) => order.id === id ? { ...order, unread: from === "customer" ? true : order.unread, chat: [...(order.chat || []), { id: `msg-${Date.now()}`, from, text: message.trim(), at: new Date().toISOString() }] } : order)); }

  return { orders, addOrder, updateOrder, confirmOrder, markShipped, addChatMessage, syncStatus };
}
