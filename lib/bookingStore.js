"use client";

import { useEffect, useState } from "react";
import { bookings as seedBookings, platforms } from "./salonData";

const STORAGE_KEY = "nail-japan-bookings";
const EVENT_NAME = "nail-japan-bookings-updated";

function originFor(source) {
  return platforms.find((platform) => platform.id === source)?.name || "Direct / Phone";
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
    return Array.isArray(parsed) ? parsed : seedCalendarBookings();
  } catch {
    return seedCalendarBookings();
  }
}

export function saveStoredBookings(nextBookings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextBookings));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: nextBookings }));
}

export function useBookingStore() {
  const [bookings, setBookingsState] = useState(seedCalendarBookings);

  useEffect(() => {
    setBookingsState(getStoredBookings());

    function sync(event) {
      setBookingsState(event.detail || getStoredBookings());
    }

    function syncFromStorage(event) {
      if (event.key === STORAGE_KEY) setBookingsState(getStoredBookings());
    }

    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener("storage", syncFromStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  function setBookings(updater) {
    setBookingsState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      saveStoredBookings(next);
      return next;
    });
  }

  function addBooking(booking) {
    const bookingToSave = {
      id: booking.id || `web-${Date.now()}`,
      start: booking.start,
      end: booking.end,
      customer: booking.customer,
      phone: booking.phone,
      email: booking.email,
      service: booking.service,
      staff: booking.staff,
      source: booking.source || "direct",
      origin: booking.origin || originFor(booking.source || "direct"),
      price: Number(booking.price) || 0,
      status: booking.status || "CONFIRMED",
      commissionRule: booking.commissionRule || "Direct booking",
      day: Number(booking.day) || 6,
      draft: false,
    };
    setBookings((current) => [...current, bookingToSave]);
    return bookingToSave;
  }

  return { bookings, setBookings, addBooking };
}
