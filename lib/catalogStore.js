"use client";

import { useEffect, useState } from "react";
import { getProductSummary } from "./ecommerce/data";
import { getKv, getPublicKv, hasSupabaseConfig, saveKv, supabaseReady, uploadDataUrl } from "./supabaseBrowser";
import { bookingOptions, withReferenceServices } from "./bookingMenu";

const PRODUCT_KEY = "nail-japan-products";
const SERVICE_KEY = "nail-japan-services";
const OPTION_KEY = "nail-japan-booking-options";
const PRODUCT_EVENT = "nail-japan-products-updated";
const SERVICE_EVENT = "nail-japan-services-updated";

export const emptyService = { id: "", category: "hand", name: "", price: 0, duration: 60, owner: "Admin", staff: [], description: "", imageUrl: "", imageFileName: "" };
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

function sameList(left, right) {
  try { return JSON.stringify(left) === JSON.stringify(right); } catch { return false; }
}

async function getServerCatalog(key) {
  const response = await fetch(`/api/catalog?key=${encodeURIComponent(key)}`, { cache: "no-store" });
  const result = await response.json().catch(() => ({}));
  return Array.isArray(result.value) ? result.value : null;
}

async function saveServerCatalog(key, value) {
  const response = await fetch("/api/catalog", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  const result = await response.json().catch(() => ({}));
  return response.ok && Array.isArray(result.value) ? result.value : value;
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
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(eventName, { detail: value }));
  if (!supabaseReady()) {
    saveServerCatalog(key, value).then((serverSynced) => {
      window.localStorage.setItem(key, JSON.stringify(serverSynced));
      window.dispatchEvent(new CustomEvent(eventName, { detail: serverSynced }));
    }).catch(() => {});
    return value;
  }
  try {
    const synced = await uploadListImages(key, value);
    window.localStorage.setItem(key, JSON.stringify(synced));
    window.dispatchEvent(new CustomEvent(eventName, { detail: synced }));
    await saveKv(key, synced);
    saveServerCatalog(key, synced).then((serverSynced) => {
      window.localStorage.setItem(key, JSON.stringify(serverSynced));
      window.dispatchEvent(new CustomEvent(eventName, { detail: serverSynced }));
    }).catch(() => {});
    return synced;
  } catch {
    saveServerCatalog(key, value).then((serverSynced) => {
      window.localStorage.setItem(key, JSON.stringify(serverSynced));
      window.dispatchEvent(new CustomEvent(eventName, { detail: serverSynced }));
    }).catch(() => {});
    return value;
  }
}

function useCatalogList(key, eventName, fallback) {
  const [items, setItemsState] = useState(fallback);
  const [syncStatus, setSyncStatus] = useState("local");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const local = readList(key, fallback);
      setItemsState(local);
      try {
        const server = await getServerCatalog(key);
        if (mounted && Array.isArray(server) && server.length) {
          setItemsState(server);
          window.localStorage.setItem(key, JSON.stringify(server));
          setSyncStatus("server");
          return;
        }
      } catch {}
      if (!hasSupabaseConfig()) return;
      try {
        const remote = supabaseReady() ? await getKv(key) : await getPublicKv(key);
        if (mounted && Array.isArray(remote)) {
          const next = sameList(local, fallback()) || sameList(local, remote) ? remote : local;
          setItemsState(next);
          window.localStorage.setItem(key, JSON.stringify(next));
          if (supabaseReady() && next === local && !sameList(local, remote)) saveKv(key, local).catch(() => {});
          setSyncStatus("supabase");
        }
      } catch { if (mounted) setSyncStatus("local"); }
    }
    load();
    function sync(event) { setItemsState(event.detail || readList(key, fallback)); }
    function syncStorage(event) { if (event.key === key) setItemsState(readList(key, fallback)); }
    function syncLocal() { setItemsState(readList(key, fallback)); }
    window.addEventListener(eventName, sync);
    window.addEventListener("storage", syncStorage);
    window.addEventListener("focus", syncLocal);
    document.addEventListener("visibilitychange", syncLocal);
    return () => { mounted = false; window.removeEventListener(eventName, sync); window.removeEventListener("storage", syncStorage); window.removeEventListener("focus", syncLocal); document.removeEventListener("visibilitychange", syncLocal); };
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
export function useServiceCatalog() {
  const [storedServices, setStoredServices, syncStatus] = useCatalogList(SERVICE_KEY, SERVICE_EVENT, seedServices);
  const services = withReferenceServices(storedServices);

  function setServices(updater) {
    setStoredServices((current) => {
      const editable = withReferenceServices(current);
      return typeof updater === "function" ? updater(editable) : updater;
    });
  }

  return [services, setServices, syncStatus];
}

export function useBookingOptionCatalog() {
  return useCatalogList(OPTION_KEY, "nail-japan-booking-options-updated", () => bookingOptions);
}
