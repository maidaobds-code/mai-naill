"use client";

import { useEffect, useState } from "react";
import { getKv, saveKv, supabaseReady } from "./supabaseBrowser";
import {
  bookings as seedBookings,
  platforms,
  staff as seedStaff,
} from "./salonData";

const STORAGE_KEY = "nail-japan-bookings";
const EVENT_NAME = "nail-japan-bookings-updated";

function originFor(source) {
  return (
    platforms.find((platform) => platform.id === source)?.name ||
    "Direct / Phone"
  );
}

function normalizeBookings(list) {
  return (Array.isArray(list) ? list : []).map((booking) => {
    const member = seedStaff.find(
      (item) =>
        item.name === booking?.staff ||
        String(item.id) === String(booking?.staffId),
    );
    return {
      ...booking,
      id: String(booking.id || `booking-${Date.now()}`),
      staff: booking.staff || member?.name || "",
      staffId: booking.staffId || member?.id || "",
      staffEmail: booking.staffEmail || member?.email || "",
      staffRole: booking.staffRole || member?.role || "",
      origin: booking.origin || originFor(booking.source),
    };
  });
}

export function seedCalendarBookings() {
  return seedBookings.map((booking, index) => ({
    ...booking,
    id: String(booking.id),
    day: [6, 6, 7, 8, 10, 12][index] || 6,
    email: booking.email || "",
    origin: booking.origin || originFor(booking.source),
  }));
}

export function getStoredBookings() {
  if (typeof window === "undefined") return seedCalendarBookings();
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return seedCalendarBookings();
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed)
      ? normalizeBookings(parsed).filter((booking) => !booking.deletedAt)
      : seedCalendarBookings();
  } catch {
    return seedCalendarBookings();
  }
}

export async function saveStoredBookings(nextBookings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextBookings));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: nextBookings }));
  const response = await fetch("/api/bookings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bookings: nextBookings }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || "Không thể đồng bộ lịch hẹn lên server.");
  return Array.isArray(result.value) ? normalizeBookings(result.value) : nextBookings;
}

export function useBookingStore() {
  const [bookings, setBookingsState] = useState(seedCalendarBookings);
  const [syncStatus, setSyncStatus] = useState("local");

  useEffect(() => {
    let mounted = true;
    async function load(useLocalFirst = true) {
      const local = getStoredBookings();
      try {
        const response = await fetch("/api/bookings", { cache: "no-store" });
        if (!response.ok) throw new Error("Không thể đọc lịch hẹn từ server.");
        const result = await response.json();
        const remote = normalizeBookings(result.value);
        if (mounted && Array.isArray(remote)) {
          const localHasRealData = JSON.stringify(local) !== JSON.stringify(seedCalendarBookings());
          if (remote.length === 0 && localHasRealData) {
            const migrated = await saveStoredBookings(local);
            if (!mounted) return;
            const visibleMigrated = migrated.filter((booking) => !booking.deletedAt);
            setBookingsState(visibleMigrated);
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
            setSyncStatus("supabase");
            return;
          }
          const visible = remote.filter((booking) => !booking.deletedAt);
          setBookingsState(visible);
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
          setSyncStatus("supabase");
        }
      } catch {
        if (mounted) {
          if (useLocalFirst) setBookingsState(local);
          setSyncStatus("local");
        }
      }
    }
    load();
    const refreshTimer = window.setInterval(() => load(false), 3000);
    function refreshVisible() {
      if (document.visibilityState === "visible") load(false);
    }
    document.addEventListener("visibilitychange", refreshVisible);
    function sync(event) {
      setBookingsState(event.detail || getStoredBookings());
    }
    function syncFromStorage(event) {
      if (event.key === STORAGE_KEY) setBookingsState(getStoredBookings());
    }
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener("storage", syncFromStorage);
    return () => {
      mounted = false;
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", refreshVisible);
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  function setBookings(updater) {
    setBookingsState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      saveStoredBookings(next).then((saved) => {
        const visible = saved.filter((booking) => !booking.deletedAt);
        setBookingsState(visible);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        setSyncStatus("supabase");
      }).catch(() => setSyncStatus("local"));
      return next;
    });
  }

  function addBooking(booking) {
    const bookingToSave = normalizeBookings([
      {
        id: booking.id || `web-${Date.now()}`,
        start: booking.start,
        end: booking.end,
        date: booking.date || "",
        customerAccountId: booking.customerAccountId || "",
        customer: booking.customer,
        phone: booking.phone,
        email: booking.email,
        marketingConsent: Boolean(booking.marketingConsent),
        service: booking.service,
        staff: booking.staff,
        staffId: booking.staffId,
        staffEmail: booking.staffEmail,
        staffRole: booking.staffRole,
        source: booking.source || "direct",
        origin: booking.origin || originFor(booking.source || "direct"),
        price: Number(booking.price) || 0,
        status: booking.status || "CONFIRMED",
        commissionRule: booking.commissionRule || "Direct booking",
        day: Number(booking.day) || 6,
        draft: false,
      },
    ])[0];
    setBookings((current) => [...current, bookingToSave]);
    return bookingToSave;
  }

  async function addBookingConfirmed(booking) {
    const item = normalizeBookings([
      {
        ...booking,
        id: `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        status: "CONFIRMED",
        draft: false,
      },
    ])[0];
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookings: [item] }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok || !Array.isArray(result.value))
      throw new Error("Unable to save booking");
    const next = normalizeBookings(result.value).filter(
      (value) => !value.deletedAt,
    );
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(result.value));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
    setBookingsState(next);
    setSyncStatus("supabase");
    return {
      ...item,
      assignmentNotifications: result.assignmentNotifications || [],
    };
  }

  function removeBooking(id) {
    setBookingsState((current) => {
      const nextVisible = current.filter((booking) => booking.id !== id);
      const removed = current.find((booking) => booking.id === id);
      const stored = [
        ...current.filter((booking) => booking.id !== id),
        ...(removed ? [{ ...removed, deletedAt: new Date().toISOString() }] : []),
      ];
      saveStoredBookings(stored).then((saved) => {
        const visible = saved.filter((booking) => !booking.deletedAt);
        setBookingsState(visible);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        setSyncStatus("supabase");
      }).catch(() => setSyncStatus("local"));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      window.dispatchEvent(
        new CustomEvent(EVENT_NAME, { detail: nextVisible }),
      );
      return nextVisible;
    });
  }

  return {
    bookings,
    setBookings,
    addBooking,
    addBookingConfirmed,
    removeBooking,
    syncStatus,
  };
}
