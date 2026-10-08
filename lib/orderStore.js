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

export function useStoreOrders() {
  const [orders, setOrdersState] = useState([]);

  useEffect(() => {
    setOrdersState(getStoreOrders());

    function sync(event) {
      setOrdersState(event.detail || getStoreOrders());
    }

    function syncStorage(event) {
      if (event.key === ORDER_KEY) setOrdersState(getStoreOrders());
    }

    window.addEventListener(ORDER_EVENT, sync);
    window.addEventListener("storage", syncStorage);
    return () => {
      window.removeEventListener(ORDER_EVENT, sync);
      window.removeEventListener("storage", syncStorage);
    };
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
      transferBillUrl: "",
      ...order,
    };
    setOrders((current) => [record, ...current]);
    return record;
  }

  function updateOrder(id, patch) {
    setOrders((current) => current.map((order) => order.id === id ? { ...order, ...patch } : order));
  }

  function addChatMessage(id, message) {
    if (!message.trim()) return;
    setOrders((current) => current.map((order) => order.id === id ? {
      ...order,
      chat: [...(order.chat || []), { id: `msg-${Date.now()}`, from: "customer", text: message.trim(), at: new Date().toISOString() }],
    } : order));
  }

  return { orders, addOrder, updateOrder, addChatMessage };
}
