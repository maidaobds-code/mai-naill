"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseReady, uploadDataUrl } from "./supabaseBrowser.js";
import { legacySampleStaff, staff as seedStaff } from "./salonData.js";

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

export function isSeedStaffList(list) {
  const normalized = normalizeStaff(list);
  return normalized.length === legacySampleStaff.length && normalized.every((member, index) => String(member.id) === String(legacySampleStaff[index].id) && String(member.name) === String(legacySampleStaff[index].name));
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
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || (response.status === 401 ? "Phiên đăng nhập server không hợp lệ." : "Không thể đồng bộ danh sách nhân viên."));
  }
  return uploaded;
}

export function useStaffStore() {
  const [staff, setStaffState] = useState(() => normalizeStaff(seedStaff));
  const [syncStatus, setSyncStatus] = useState("local");
  const [syncError, setSyncError] = useState("");
  const staffRef = useRef(staff);
  const syncStatusRef = useRef(syncStatus);

  useEffect(() => { staffRef.current = staff; }, [staff]);
  useEffect(() => { syncStatusRef.current = syncStatus; }, [syncStatus]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const local = getStoredStaff();
      setStaffState(local);
      fetch("/api/staff?public=1", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((result) => {
        if (!mounted) return;
        const serverIsMissingOrSeed = result?.value === null || isSeedStaffList(result?.value);
        if (serverIsMissingOrSeed && !isSeedStaffList(local)) {
          saveStoredStaff(local).then((uploaded) => { if (mounted) { setStaffState(uploaded); setSyncStatus("server"); setSyncError(""); } }).catch((error) => { setSyncStatus("local"); setSyncError(error.message || "Không thể đồng bộ nhân viên lên server."); });
          return;
        }
        if (!Array.isArray(result?.value)) return;
        const normalized = normalizeStaff(result.value);
        setStaffState(normalized);
        window.localStorage.setItem(STAFF_KEY, JSON.stringify(normalized));
        setSyncStatus("server");
      }).catch(() => {});
    }
    load();
    function sync(event) { setStaffState(normalizeStaff(event.detail || getStoredStaff())); }
    window.addEventListener(STAFF_EVENT, sync);
    const refreshTimer = window.setInterval(() => {
      if (syncStatusRef.current === "local") {
        saveStoredStaff(staffRef.current).then((saved) => {
          if (!mounted) return;
          setStaffState(saved);
          setSyncStatus("server");
          setSyncError("");
        }).catch((error) => {
          if (!mounted) return;
          setSyncStatus("local");
          setSyncError(error.message || "Không thể đồng bộ nhân viên lên server.");
        });
        return;
      }
        fetch("/api/staff?public=1", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((result) => {
        if (mounted && Array.isArray(result?.value)) { const normalized = normalizeStaff(result.value); setStaffState(normalized); window.localStorage.setItem(STAFF_KEY, JSON.stringify(normalized)); setSyncStatus("server"); }
      }).catch(() => {});
    }, 10000);
    return () => { mounted = false; window.clearInterval(refreshTimer); window.removeEventListener(STAFF_EVENT, sync); };
  }, []);

  function setStaff(updater) {
    setStaffState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      saveStoredStaff(next).then((saved) => { setStaffState(saved); setSyncStatus("server"); setSyncError(""); }).catch((error) => { setSyncStatus("local"); setSyncError(error.message || "Không thể đồng bộ nhân viên lên server."); });
      return next;
    });
  }

  return { staff, setStaff, syncStatus, syncError };
}
