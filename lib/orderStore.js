"use client";

import { useEffect, useState } from "react";

const ORDER_KEY = "nail-japan-store-orders";
const ORDER_EVENT = "nail-japan-store-orders-updated";

export function getStoreOrders() {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(ORDER_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoreOrders(orders) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ORDER_KEY, JSON.stringify(orders));
  window.dispatchEvent(new CustomEvent(ORDER_EVENT, { detail: orders }));
}

function emailRecord(subject, body) {
  return { id: `email-${Date.now()}`, subject, body, at: new Date().toISOString(), channel: "gmail" };
}

export function useStoreOrders() {
  const [orders, setOrdersState] = useState([]);

  useEffect(() => {
    setOrdersState(getStoreOrders());
    function sync(event) { setOrdersState(event.detail || getStoreOrders()); }
    function syncStorage(event) { if (event.key === ORDER_KEY) setOrdersState(getStoreOrders()); }
    window.addEventListener(ORDER_EVENT, sync);
    window.addEventListener("storage", syncStorage);
    return () => { window.removeEventListener(ORDER_EVENT, sync); window.removeEventListener("storage", syncStorage); };
  }, []);

  function setOrders(updater) {
    setOrdersState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      saveStoreOrders(next);
      return next;
    });
  }

  function addOrder(order) {
    const record = {
      id: `order-${Date.now()}`,
      orderNumber: `WEB-${Date.now().toString().slice(-6)}`,
      status: order.fulfillmentType === "shipping" ? "Waiting payment" : "Pickup reserved",
      paymentStatus: order.fulfillmentType === "shipping" ? "Waiting payment" : "Pay at store",
      createdAt: new Date().toISOString(),
      chat: [],
      emailLog: [emailRecord("Da nhan don hang", "Cua hang da nhan duoc don hang cua ban va se xu ly som.")],
      transferBillUrl: "",
      unread: true,
      confirmedByStaff: false,
      shippedAt: "",
      ...order,
    };
    setOrders((current) => [record, ...current]);
    return record;
  }

  function updateOrder(id, patch) {
    setOrders((current) => current.map((order) => order.id === id ? { ...order, ...patch } : order));
  }

  function confirmOrder(id, staffName = "Staff") {
    setOrders((current) => current.map((order) => order.id === id ? {
      ...order,
      confirmedByStaff: true,
      confirmedBy: staffName,
      status: order.status === "Waiting payment" ? "Confirmed" : order.status,
      emailLog: [...(order.emailLog || []), emailRecord("Don hang da duoc xac nhan", `Nhan vien ${staffName} da xac nhan don ${order.orderNumber}.`) ],
    } : order));
  }

  function markShipped(id) {
    setOrders((current) => current.map((order) => order.id === id ? {
      ...order,
      status: "Shipping",
      shippedAt: new Date().toISOString(),
      emailLog: [...(order.emailLog || []), emailRecord("Don hang da duoc gui", `Don ${order.orderNumber} da duoc gui cho don vi van chuyen. Ban co the tiep tuc theo doi trang thai don hang.`)],
    } : order));
  }

  function addChatMessage(id, message, from = "customer") {
    if (!message.trim()) return;
    setOrders((current) => current.map((order) => order.id === id ? {
      ...order,
      unread: from === "customer" ? true : order.unread,
      chat: [...(order.chat || []), { id: `msg-${Date.now()}`, from, text: message.trim(), at: new Date().toISOString() }],
    } : order));
  }

  return { orders, addOrder, updateOrder, confirmOrder, markShipped, addChatMessage };
}
