"use client";

import { useEffect, useState } from "react";
import { getKv, saveKv, supabaseReady } from "./supabaseBrowser";
import { bookings as seedBookings, platforms } from "./salonData";

const STORAGE_KEY = "nail-japan-bookings";
const EVENT_NAME = "nail-japan-bookings-updated";

function originFor(source) {
  return platforms.find((platform) => platform.id === source)?.name || "Direct / Phone";
}

export function seedCalendarBookings() {
  return seedBookings.map((booking, index) => ({ ...booking, id: String(booking.id), day: [6, 6, 7, 8, 10, 12][index] || 6, email: booking.email || "", origin: booking.origin || originFor(booking.source) }));
}

export function getStoredBookings() {
  if (typeof window === "undefined") return seedCalendarBookings();
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return seedCalendarBookings();
  try { const parsed = JSON.parse(saved); return Array.isArray(parsed) ? parsed : seedCalendarBookings(); } catch { return seedCalendarBookings(); }
}

export async function saveStoredBookings(nextBookings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextBookings));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: nextBookings }));
  if (supabaseReady()) await saveKv(STORAGE_KEY, nextBookings);
}

export function useBookingStore() {
  const [bookings, setBookingsState] = useState(seedCalendarBookings);
  const [syncStatus, setSyncStatus] = useState("local");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const local = getStoredBookings();
      setBookingsState(local);
      if (!supabaseReady()) return;
      try {
        const remote = await getKv(STORAGE_KEY);
        if (mounted && Array.isArray(remote)) {
          setBookingsState(remote);
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
          setSyncStatus("supabase");
        }
      } catch { if (mounted) setSyncStatus("local"); }
    }
    load();
    function sync(event) { setBookingsState(event.detail || getStoredBookings()); }
    function syncFromStorage(event) { if (event.key === STORAGE_KEY) setBookingsState(getStoredBookings()); }
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener("storage", syncFromStorage);
    return () => { mounted = false; window.removeEventListener(EVENT_NAME, sync); window.removeEventListener("storage", syncFromStorage); };
  }, []);

  function setBookings(updater) {
    setBookingsState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      saveStoredBookings(next).catch(() => setSyncStatus("local"));
      return next;
    });
  }

  function addBooking(booking) {
    const bookingToSave = { id: booking.id || `web-${Date.now()}`, start: booking.start, end: booking.end, customer: booking.customer, phone: booking.phone, email: booking.email, service: booking.service, staff: booking.staff, source: booking.source || "direct", origin: booking.origin || originFor(booking.source || "direct"), price: Number(booking.price) || 0, status: booking.status || "CONFIRMED", commissionRule: booking.commissionRule || "Direct booking", day: Number(booking.day) || 6, draft: false };
    setBookings((current) => [...current, bookingToSave]);
    return bookingToSave;
  }

  return { bookings, setBookings, addBooking, syncStatus };
}
