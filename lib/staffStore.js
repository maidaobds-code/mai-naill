"use client";

import { useEffect, useState } from "react";
import { getKv, saveKv, supabaseReady, uploadDataUrl } from "./supabaseBrowser";
import { staff as seedStaff } from "./salonData";

const STAFF_KEY = "nail-japan-staff";
const STAFF_EVENT = "nail-japan-staff-updated";

function normalizeStaff(list) {
  return (Array.isArray(list) ? list : []).map((member) => ({
    ...member,
    displayName: member.displayName || member.name,
    designationFee: Number(member.designationFee ?? 1100),
    bookingDescription: member.bookingDescription || "",
    bookingVisible: member.bookingVisible !== false,
    avatarUrl: member.avatarUrl || "",
    avatarFileName: member.avatarFileName || "",
  }));
}

export function getStoredStaff() {
  if (typeof window === "undefined") return seedStaff;
  const raw = window.localStorage.getItem(STAFF_KEY);
  if (!raw) return normalizeStaff(seedStaff);
  try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? normalizeStaff(parsed) : normalizeStaff(seedStaff); } catch { return normalizeStaff(seedStaff); }
}

export async function saveStoredStaff(staff) {
  const uploaded = await Promise.all(normalizeStaff(staff).map(async (member) => member.avatarUrl?.startsWith("data:") && supabaseReady() ? { ...member, avatarUrl: await uploadDataUrl(member.avatarUrl, "staff", member.avatarFileName || `${member.id}.png`) } : member));
  window.localStorage.setItem(STAFF_KEY, JSON.stringify(uploaded));
  window.dispatchEvent(new CustomEvent(STAFF_EVENT, { detail: uploaded }));
  const response = await fetch("/api/staff", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: uploaded }) });
  if (!response.ok) throw new Error("Unable to sync staff list");
  if (supabaseReady()) await saveKv(STAFF_KEY, uploaded);
  return uploaded;
}

export function useStaffStore() {
  const [staff, setStaffState] = useState(() => normalizeStaff(seedStaff));
  const [syncStatus, setSyncStatus] = useState("local");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const local = getStoredStaff();
      setStaffState(local);
      fetch("/api/staff", { cache: "no-store", credentials: "include" }).then((response) => response.ok ? response.json() : null).then((result) => {
        if (!mounted || !Array.isArray(result?.value) || !result.value.length) return;
        const normalized = normalizeStaff(result.value);
        setStaffState(normalized);
        window.localStorage.setItem(STAFF_KEY, JSON.stringify(normalized));
        setSyncStatus("server");
      }).catch(() => {});
      if (!supabaseReady()) return;
      try {
        const remote = await getKv(STAFF_KEY);
        if (mounted && Array.isArray(remote)) {
          const normalized = normalizeStaff(remote);
          setStaffState(normalized);
          window.localStorage.setItem(STAFF_KEY, JSON.stringify(normalized));
          setSyncStatus("supabase");
        }
      } catch { if (mounted) setSyncStatus("local"); }
    }
    load();
    function sync(event) { setStaffState(normalizeStaff(event.detail || getStoredStaff())); }
    window.addEventListener(STAFF_EVENT, sync);
    const refreshTimer = window.setInterval(() => {
      fetch("/api/staff", { cache: "no-store", credentials: "include" }).then((response) => response.ok ? response.json() : null).then((result) => {
        if (mounted && Array.isArray(result?.value) && result.value.length) setStaffState(normalizeStaff(result.value));
      }).catch(() => {});
    }, 10000);
    return () => { mounted = false; window.clearInterval(refreshTimer); window.removeEventListener(STAFF_EVENT, sync); };
  }, []);

  function setStaff(updater) {
    setStaffState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      saveStoredStaff(next).then(setStaffState).catch(() => setSyncStatus("local"));
      return next;
    });
  }

  return { staff, setStaff, syncStatus };
}
