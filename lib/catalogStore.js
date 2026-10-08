"use client";

import { useEffect, useState } from "react";
import { getProductSummary } from "./ecommerce/data";

const PRODUCT_KEY = "nail-japan-products";
const SERVICE_KEY = "nail-japan-services";
const PRODUCT_EVENT = "nail-japan-products-updated";
const SERVICE_EVENT = "nail-japan-services-updated";

export const emptyService = { id: "", name: "", price: 0, duration: 60, owner: "Admin", staff: [], description: "", imageUrl: "", imageFileName: "" };
export const emptyProduct = { id: "", name: "", description: "", basePrice: 0, stock: 0, lowStockThreshold: 3, mediaUrl: "", mediaFileName: "", status: "ACTIVE" };

export function seedServices() {
  return [
    { id: "svc-one", name: "Gel One Color", price: 6500, duration: 75, owner: "Admin", staff: ["Mai", "Yuki"], description: "Mau gel co ban", imageUrl: "" },
    { id: "svc-art", name: "Magnet + Art", price: 9800, duration: 90, owner: "Admin", staff: ["Yuki", "Hana"], description: "Mau nail art", imageUrl: "" },
    { id: "svc-french", name: "French Design", price: 8800, duration: 90, owner: "Admin", staff: ["Hana", "Mai"], description: "French design mem mai", imageUrl: "" },
  ];
}

function seedProducts() {
  return getProductSummary().map((product) => ({
    ...product,
    mediaUrl: product.mediaUrl || "",
    mediaFileName: "",
    description: product.description || product.shortDescription,
    stock: product.stock ?? product.quantityAvailable ?? 0,
    lowStockThreshold: product.lowStockThreshold ?? 3,
  }));
}

function readList(key, fallback) {
  if (typeof window === "undefined") return fallback();
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback();
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback();
  } catch {
    return fallback();
  }
}

function saveList(key, eventName, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(eventName, { detail: value }));
}

function useCatalogList(key, eventName, fallback) {
  const [items, setItemsState] = useState(fallback);

  useEffect(() => {
    setItemsState(readList(key, fallback));

    function sync(event) {
      setItemsState(event.detail || readList(key, fallback));
    }

    function syncStorage(event) {
      if (event.key === key) setItemsState(readList(key, fallback));
    }

    window.addEventListener(eventName, sync);
    window.addEventListener("storage", syncStorage);
    return () => {
      window.removeEventListener(eventName, sync);
      window.removeEventListener("storage", syncStorage);
    };
  }, [key, eventName, fallback]);

  function setItems(updater) {
    setItemsState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      saveList(key, eventName, next);
      return next;
    });
  }

  return [items, setItems];
}

export function useProductCatalog() {
  return useCatalogList(PRODUCT_KEY, PRODUCT_EVENT, seedProducts);
}

export function useServiceCatalog() {
  return useCatalogList(SERVICE_KEY, SERVICE_EVENT, seedServices);
}
