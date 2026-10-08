"use client";

import { useEffect, useState } from "react";
import { getProductSummary } from "./ecommerce/data";
import { getKv, saveKv, supabaseReady, uploadDataUrl } from "./supabaseBrowser";

const PRODUCT_KEY = "nail-japan-products";
const SERVICE_KEY = "nail-japan-services";
const PRODUCT_EVENT = "nail-japan-products-updated";
const SERVICE_EVENT = "nail-japan-services-updated";

export const emptyService = { id: "", name: "", price: 0, duration: 60, owner: "Admin", staff: [], description: "", imageUrl: "", imageFileName: "" };
export const emptyProduct = { id: "", name: "", description: "", basePrice: 0, stock: 0, lowStockThreshold: 3, mediaUrl: "", mediaFileName: "", status: "ACTIVE" };

export function seedServices() {
  return [
    { id: "svc-one", name: "Gel One Color", price: 6500, duration: 75, owner: "Admin", staff: ["Mai", "Yuki"], description: "Màu gel cơ bản", imageUrl: "" },
    { id: "svc-art", name: "Magnet + Art", price: 9800, duration: 90, owner: "Admin", staff: ["Yuki", "Hana"], description: "Mẫu nail art", imageUrl: "" },
    { id: "svc-french", name: "French Design", price: 8800, duration: 90, owner: "Admin", staff: ["Hana", "Mai"], description: "French design mềm mại", imageUrl: "" },
  ];
}

function seedProducts() {
  return getProductSummary().map((product) => ({ ...product, mediaUrl: product.mediaUrl || "", mediaFileName: "", description: product.description || product.shortDescription, stock: product.stock ?? product.quantityAvailable ?? 0, lowStockThreshold: product.lowStockThreshold ?? 3 }));
}

function readList(key, fallback) {
  if (typeof window === "undefined") return fallback();
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback();
  try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : fallback(); } catch { return fallback(); }
}

async function uploadListImages(key, list) {
  if (!supabaseReady()) return list;
  return Promise.all(list.map(async (item) => {
    const next = { ...item };
    if (next.mediaUrl?.startsWith("data:")) next.mediaUrl = await uploadDataUrl(next.mediaUrl, key, next.mediaFileName || `${next.id}.png`);
    if (next.imageUrl?.startsWith("data:")) next.imageUrl = await uploadDataUrl(next.imageUrl, key, next.imageFileName || `${next.id}.png`);
    return next;
  }));
}

async function saveList(key, eventName, value) {
  const synced = await uploadListImages(key, value);
  window.localStorage.setItem(key, JSON.stringify(synced));
  window.dispatchEvent(new CustomEvent(eventName, { detail: synced }));
  if (supabaseReady()) await saveKv(key, synced);
  return synced;
}

function useCatalogList(key, eventName, fallback) {
  const [items, setItemsState] = useState(fallback);
  const [syncStatus, setSyncStatus] = useState("local");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const local = readList(key, fallback);
      setItemsState(local);
      if (!supabaseReady()) return;
      try {
        const remote = await getKv(key);
        if (mounted && Array.isArray(remote)) {
          setItemsState(remote);
          window.localStorage.setItem(key, JSON.stringify(remote));
          setSyncStatus("supabase");
        }
      } catch { if (mounted) setSyncStatus("local"); }
    }
    load();
    function sync(event) { setItemsState(event.detail || readList(key, fallback)); }
    function syncStorage(event) { if (event.key === key) setItemsState(readList(key, fallback)); }
    window.addEventListener(eventName, sync);
    window.addEventListener("storage", syncStorage);
    return () => { mounted = false; window.removeEventListener(eventName, sync); window.removeEventListener("storage", syncStorage); };
  }, [key, eventName, fallback]);

  function setItems(updater) {
    setItemsState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      saveList(key, eventName, next).then(setItemsState).catch(() => setSyncStatus("local"));
      return next;
    });
  }

  return [items, setItems, syncStatus];
}

export function useProductCatalog() { return useCatalogList(PRODUCT_KEY, PRODUCT_EVENT, seedProducts); }
export function useServiceCatalog() { return useCatalogList(SERVICE_KEY, SERVICE_EVENT, seedServices); }
