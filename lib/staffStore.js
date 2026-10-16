"use client";

import { useEffect, useState } from "react";
import { getKv, saveKv, supabaseReady } from "./supabaseBrowser";
import { staff as seedStaff } from "./salonData";

const STAFF_KEY = "nail-japan-staff";
const STAFF_EVENT = "nail-japan-staff-updated";

export function getStoredStaff() {
  if (typeof window === "undefined") return seedStaff;
  const raw = window.localStorage.getItem(STAFF_KEY);
  if (!raw) return seedStaff;
  try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : seedStaff; } catch { return seedStaff; }
}

export async function saveStoredStaff(staff) {
  window.localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
  window.dispatchEvent(new CustomEvent(STAFF_EVENT, { detail: staff }));
  const response = await fetch("/api/staff", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: staff }) });
  if (!response.ok) throw new Error("Unable to sync staff list");
  if (supabaseReady()) await saveKv(STAFF_KEY, staff);
}

export function useStaffStore() {
  const [staff, setStaffState] = useState(seedStaff);
  const [syncStatus, setSyncStatus] = useState("local");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const local = getStoredStaff();
      setStaffState(local);
      fetch("/api/staff", { cache: "no-store", credentials: "include" }).then((response) => response.ok ? response.json() : null).then((result) => {
        if (!mounted || !Array.isArray(result?.value) || !result.value.length) return;
        setStaffState(result.value);
        window.localStorage.setItem(STAFF_KEY, JSON.stringify(result.value));
        setSyncStatus("server");
      }).catch(() => {});
      if (!supabaseReady()) return;
      try {
        const remote = await getKv(STAFF_KEY);
        if (mounted && Array.isArray(remote)) {
          setStaffState(remote);
          window.localStorage.setItem(STAFF_KEY, JSON.stringify(remote));
          setSyncStatus("supabase");
        }
      } catch { if (mounted) setSyncStatus("local"); }
    }
    load();
    function sync(event) { setStaffState(event.detail || getStoredStaff()); }
    window.addEventListener(STAFF_EVENT, sync);
    const refreshTimer = window.setInterval(() => {
      fetch("/api/staff", { cache: "no-store", credentials: "include" }).then((response) => response.ok ? response.json() : null).then((result) => {
        if (mounted && Array.isArray(result?.value) && result.value.length) setStaffState(result.value);
      }).catch(() => {});
    }, 10000);
    return () => { mounted = false; window.clearInterval(refreshTimer); window.removeEventListener(STAFF_EVENT, sync); };
  }, []);

  function setStaff(updater) {
    setStaffState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      saveStoredStaff(next).catch(() => setSyncStatus("local"));
      return next;
    });
  }

  return { staff, setStaff, syncStatus };
}
