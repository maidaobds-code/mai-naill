"use client";

import { useEffect, useState } from "react";
import { consumeOAuthRedirect, getKv, googleProfileFromSession, saveKv, signInWithGoogle, signOutSupabase, supabaseReady } from "./supabaseBrowser";

const ACCOUNT_KEY = "nail-japan-accounts-v1";
const SESSION_KEY = "nail-japan-current-account";
const ACCOUNT_EVENT = "nail-japan-accounts-updated";
const SESSION_EVENT = "nail-japan-session-updated";
const PASSWORD_SALT = "mai-beauty-salon-demo-v1";

const ownerAccount = {
  id: "owner",
  role: "owner",
  name: "Chủ quán",
  email: "owner@salon.local",
  phone: "",
  address: "",
  passwordHash: "",
  staffName: "",
};

function readJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(window.localStorage.getItem(key)) || fallback; } catch { return fallback; }
}

async function hashPassword(password) {
  const text = `${PASSWORD_SALT}:${password}`;
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function stripSecret(account) {
  if (!account) return null;
  const { passwordHash, ...safe } = account;
  return safe;
}

function accountFromGoogleProfile(profile, existing = {}) {
  return {
    ...existing,
    id: existing.id || `customer-google-${String(profile.id || profile.email).replace(/[^a-zA-Z0-9_-]/g, "-")}`,
    role: existing.role || "customer",
    name: existing.name || profile.name,
    email: profile.email,
    phone: existing.phone || "",
    address: existing.address || "",
    avatarUrl: existing.avatarUrl || profile.avatarUrl || "",
    passwordHash: existing.passwordHash || "",
  };
}

export function defaultAccounts() {
  return [ownerAccount];
}

export function getAccounts() {
  const saved = readJson(ACCOUNT_KEY, null);
  if (!Array.isArray(saved) || !saved.length) return defaultAccounts();
  return saved.some((account) => account.role === "owner") ? saved : [ownerAccount, ...saved];
}

export function getCurrentAccount() {
  return readJson(SESSION_KEY, null);
}

async function saveAccounts(next) {
  window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(ACCOUNT_EVENT, { detail: next }));
  fetch("/api/accounts", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: next }) })
    .then((response) => { if (!response.ok) throw new Error(`Account sync failed (${response.status})`); })
    .catch((error) => console.error(error));
  if (supabaseReady()) await saveKv(ACCOUNT_KEY, next);
}

function saveSession(account) {
  const safeAccount = stripSecret(account);
  if (safeAccount) window.localStorage.setItem(SESSION_KEY, JSON.stringify(safeAccount));
  else window.localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: safeAccount }));
}

async function loginWithAdminEnv(email, password) {
  const response = await fetch("/api/admin-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const result = await response.json().catch(() => ({}));
  if (response.ok && result.ok && result.account) return result;
  // A missing server-side admin account must not block local staff accounts.
  // Only return an authentication result when the endpoint actually checked credentials.
  if (response.status === 401) return result;
  return { ok: false };
}

export function useAccountStore() {
  const [accounts, setAccountsState] = useState(defaultAccounts);
  const [currentAccount, setCurrentAccount] = useState(null);
  const [syncStatus, setSyncStatus] = useState("local");

  useEffect(() => {
    let mounted = true;
    async function initAccount() {
      try {
        await consumeOAuthRedirect();
      } catch {
        setSyncStatus("local");
      }
      if (!mounted) return;

      const local = getAccounts();
      fetch("/api/accounts", { cache: "no-store", credentials: "include" }).then((response) => response.ok ? response.json() : null).then((result) => {
        if (mounted && Array.isArray(result?.value)) { setAccountsState(result.value); window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(result.value)); }
      }).catch(() => {});
      const googleProfile = googleProfileFromSession();
      const localSession = getCurrentAccount();
      const googleExisting = googleProfile ? local.find((account) => account.email?.toLowerCase() === googleProfile.email.toLowerCase()) : null;
      const googleAccount = googleProfile ? accountFromGoogleProfile(googleProfile, googleExisting) : null;
      const localWithGoogle = googleAccount && !googleExisting ? [...local, googleAccount] : googleAccount ? local.map((account) => account.email?.toLowerCase() === googleAccount.email.toLowerCase() ? googleAccount : account) : local;
      setAccountsState(localWithGoogle);
      if (googleAccount) {
        window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(localWithGoogle));
        saveSession(googleAccount);
        setCurrentAccount(stripSecret(googleAccount));
      } else {
        setCurrentAccount(localSession);
      }
      if (supabaseReady()) {
        getKv(ACCOUNT_KEY).then((remote) => {
          if (!mounted || !Array.isArray(remote)) return;
          let next = remote.some((account) => account.role === "owner") ? remote : [ownerAccount, ...remote];
          if (googleProfile) {
            const existing = next.find((account) => account.email?.toLowerCase() === googleProfile.email.toLowerCase());
            const account = accountFromGoogleProfile(googleProfile, existing);
            next = existing ? next.map((item) => item.email?.toLowerCase() === account.email.toLowerCase() ? account : item) : [...next, account];
            saveSession(account);
            setCurrentAccount(stripSecret(account));
          }
          setAccountsState(next);
          window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(next));
          setSyncStatus("supabase");
        }).catch(() => setSyncStatus("local"));
      }
    }
    initAccount();
    function syncAccounts(event) { setAccountsState(event.detail || getAccounts()); }
    function syncSession(event) { setCurrentAccount(event.detail || getCurrentAccount()); }
    window.addEventListener(ACCOUNT_EVENT, syncAccounts);
    window.addEventListener(SESSION_EVENT, syncSession);
    window.addEventListener("storage", syncSession);
    return () => {
      mounted = false;
      window.removeEventListener(ACCOUNT_EVENT, syncAccounts);
      window.removeEventListener(SESSION_EVENT, syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, []);

  function setAccounts(updater) {
    setAccountsState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      saveAccounts(next).catch(() => setSyncStatus("local"));
      return next;
    });
  }

  async function login(email, password) {
    const adminResult = await loginWithAdminEnv(email, password);
    if (adminResult.ok) {
      const account = { ...ownerAccount, ...adminResult.account };
      setAccounts((current) => current.some((item) => item.id === account.id) ? current.map((item) => item.id === account.id ? { ...item, ...account } : item) : [account, ...current]);
      saveSession(account);
      setCurrentAccount(stripSecret(account));
      return { ok: true, account: stripSecret(account) };
    }
    if (adminResult.message && adminResult.ok === false && adminResult.status === 401) return adminResult;

    const serverStaff = await fetch("/api/staff-login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) }).then(async (response) => ({ response, result: await response.json().catch(() => ({})) })).catch(() => null);
    if (serverStaff?.response.ok && serverStaff.result?.account) {
      saveSession(serverStaff.result.account);
      setCurrentAccount(serverStaff.result.account);
      return serverStaff.result;
    }

    const normalizedEmail = email.trim().toLowerCase();
    // Read the latest persisted list as this hook can be mounted before a
    // recently-created staff account has propagated through React state.
    const latestAccounts = getAccounts();
    const account = latestAccounts.find((item) => item.email?.trim().toLowerCase() === normalizedEmail);
    if (!account?.passwordHash && serverStaff?.result?.message) return { ok: false, message: serverStaff.result.message };
    if (!account?.passwordHash) return { ok: false, message: "Tài khoản chưa có mật khẩu. Chủ quán cần tạo/reset mật khẩu." };
    const passwordHash = await hashPassword(password);
    if (account.passwordHash !== passwordHash) return { ok: false, message: "Sai email hoặc mật khẩu." };
    saveSession(account);
    setCurrentAccount(stripSecret(account));
    return { ok: true, account: stripSecret(account) };
  }

  function logout() {
    signOutSupabase();
    saveSession(null);
    setCurrentAccount(null);
  }

  function loginWithGoogle() {
    const started = signInWithGoogle();
    return started ? { ok: true } : { ok: false, message: "Chưa cấu hình Supabase Google OAuth." };
  }

  async function setupOwner(profile) {
    const passwordHash = await hashPassword(profile.password);
    const owner = { ...ownerAccount, name: profile.name || ownerAccount.name, email: profile.email || ownerAccount.email, passwordHash };
    setAccounts((current) => current.some((account) => account.id === "owner") ? current.map((account) => account.id === "owner" ? owner : account) : [owner, ...current]);
    saveSession(owner);
    setCurrentAccount(stripSecret(owner));
    return { ok: true, account: stripSecret(owner) };
  }

  async function registerCustomer(profile) {
    const email = profile.email.trim().toLowerCase();
    if (!email.endsWith("@gmail.com")) return { ok: false, message: "Khách hàng cần đăng ký bằng Gmail." };
    if (accounts.some((item) => item.email.toLowerCase() === email)) return { ok: false, message: "Email này đã có tài khoản." };
    const passwordHash = await hashPassword(profile.password);
    const account = { id: `customer-${Date.now()}`, role: "customer", name: profile.name || email.split("@")[0], email, phone: profile.phone || "", address: profile.address || "", passwordHash };
    setAccounts((current) => [...current, account]);
    saveSession(account);
    setCurrentAccount(stripSecret(account));
    return { ok: true, account: stripSecret(account) };
  }

  async function upsertStaffAccount(staffMember, password) {
    const email = staffMember.email?.trim().toLowerCase() || `staff.${String(staffMember.id).replace(/[^a-z0-9-]/gi, "").slice(-12)}@staff.local`;
    const existing = accounts.find((item) => item.id === `staff-${staffMember.id}`);
    const passwordHash = password ? await hashPassword(password) : existing?.passwordHash || "";
    const account = { id: `staff-${staffMember.id}`, role: "staff", name: staffMember.name, email, phone: staffMember.phone || "", address: "", passwordHash, staffName: staffMember.name };
    const response = await fetch("/api/accounts", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ account }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.message || `Không thể đồng bộ tài khoản (${response.status})`);
    setAccounts((current) => current.some((item) => item.id === account.id) ? current.map((item) => item.id === account.id ? account : item) : [...current, account]);
    return stripSecret(account);
  }

  async function resetPassword(accountId, password) {
    const passwordHash = await hashPassword(password);
    setAccounts((current) => current.map((account) => account.id === accountId ? { ...account, passwordHash } : account));
  }

  function updateAccountRole(accountId, role) {
    if (!["owner", "staff", "customer"].includes(role)) return { ok: false, message: "Quyền không hợp lệ." };
    const target = accounts.find((account) => account.id === accountId);
    if (!target) return { ok: false, message: "Không tìm thấy tài khoản." };
    if (target.role === "owner" && role !== "owner" && accounts.filter((account) => account.role === "owner").length <= 1) {
      return { ok: false, message: "Cần giữ lại ít nhất một tài khoản chủ quán." };
    }
    const patch = { role, staffName: role === "staff" ? target.staffName || target.name : "" };
    setAccounts((current) => current.map((account) => account.id === accountId ? { ...account, ...patch } : account));
    if (currentAccount?.id === accountId) {
      const nextAccount = { ...currentAccount, ...patch };
      saveSession(nextAccount);
      setCurrentAccount(nextAccount);
    }
    return { ok: true };
  }

  function deleteAccount(accountId) {
    const target = accounts.find((account) => account.id === accountId);
    if (!target) return { ok: false, message: "Không tìm thấy tài khoản." };
    if (currentAccount?.id === accountId) return { ok: false, message: "Không thể xóa tài khoản đang đăng nhập." };
    if (target.role === "owner" && accounts.filter((account) => account.role === "owner").length <= 1) {
      return { ok: false, message: "Không thể xóa chủ quán cuối cùng." };
    }
    setAccounts((current) => current.filter((account) => account.id !== accountId));
    return { ok: true };
  }

  function updateProfile(patch) {
    if (!currentAccount) return;
    const nextAccount = { ...currentAccount, ...patch };
    setAccounts((current) => current.map((account) => account.id === currentAccount.id ? { ...account, ...patch } : account));
    saveSession(nextAccount);
    setCurrentAccount(nextAccount);
  }

  return { accounts, currentAccount, syncStatus, login, logout, loginWithGoogle, setupOwner, registerCustomer, upsertStaffAccount, resetPassword, updateAccountRole, deleteAccount, updateProfile };
}

export function permissionsFor(account) {
  if (!account) return ["Online Store"];
  if (account.role === "owner") return ["Dashboard", "Calendar", "Orders", "Payment History", "Services", "ProductsInventory", "Online Store", "Customers", "Payroll", "POS / Checkout", "Reports", "Settings", "Staff"];
  if (account.role === "staff") return ["Calendar", "Services", "POS / Checkout", "Payment History", "Online Store", "Payroll"];
  return ["Online Store"];
}
