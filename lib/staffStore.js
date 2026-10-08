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
    return () => { mounted = false; window.removeEventListener(STAFF_EVENT, sync); };
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
