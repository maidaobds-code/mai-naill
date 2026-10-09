"use client";

import { useEffect, useState } from "react";
import { getKv, saveKv, supabaseReady } from "./supabaseBrowser";

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
  if (supabaseReady()) await saveKv(ACCOUNT_KEY, next);
}

function saveSession(account) {
  const safeAccount = stripSecret(account);
  if (safeAccount) window.localStorage.setItem(SESSION_KEY, JSON.stringify(safeAccount));
  else window.localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: safeAccount }));
}

export function useAccountStore() {
  const [accounts, setAccountsState] = useState(defaultAccounts);
  const [currentAccount, setCurrentAccount] = useState(null);
  const [syncStatus, setSyncStatus] = useState("local");

  useEffect(() => {
    let mounted = true;
    const local = getAccounts();
    setAccountsState(local);
    setCurrentAccount(getCurrentAccount());
    if (supabaseReady()) {
      getKv(ACCOUNT_KEY).then((remote) => {
        if (!mounted || !Array.isArray(remote)) return;
        const next = remote.some((account) => account.role === "owner") ? remote : [ownerAccount, ...remote];
        setAccountsState(next);
        window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(next));
        setSyncStatus("supabase");
      }).catch(() => setSyncStatus("local"));
    }
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
    const account = accounts.find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
    if (!account?.passwordHash) return { ok: false, message: "Tài khoản chưa có mật khẩu. Chủ quán cần tạo/reset mật khẩu." };
    const passwordHash = await hashPassword(password);
    if (account.passwordHash !== passwordHash) return { ok: false, message: "Sai email hoặc mật khẩu." };
    saveSession(account);
    setCurrentAccount(stripSecret(account));
    return { ok: true, account: stripSecret(account) };
  }

  function logout() {
    saveSession(null);
    setCurrentAccount(null);
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
    const email = staffMember.email || `${staffMember.name.toLowerCase().replace(/\s+/g, ".")}@staff.local`;
    const existing = accounts.find((item) => item.id === `staff-${staffMember.id}`);
    const passwordHash = password ? await hashPassword(password) : existing?.passwordHash || "";
    const account = { id: `staff-${staffMember.id}`, role: "staff", name: staffMember.name, email, phone: staffMember.phone || "", address: "", passwordHash, staffName: staffMember.name };
    setAccounts((current) => current.some((item) => item.id === account.id) ? current.map((item) => item.id === account.id ? account : item) : [...current, account]);
    return stripSecret(account);
  }

  async function resetPassword(accountId, password) {
    const passwordHash = await hashPassword(password);
    setAccounts((current) => current.map((account) => account.id === accountId ? { ...account, passwordHash } : account));
  }

  function updateProfile(patch) {
    if (!currentAccount) return;
    const nextAccount = { ...currentAccount, ...patch };
    setAccounts((current) => current.map((account) => account.id === currentAccount.id ? { ...account, ...patch } : account));
    saveSession(nextAccount);
    setCurrentAccount(nextAccount);
  }

  return { accounts, currentAccount, syncStatus, login, logout, setupOwner, registerCustomer, upsertStaffAccount, resetPassword, updateProfile };
}

export function permissionsFor(account) {
  if (!account) return ["Online Store"];
  if (account.role === "owner") return ["Dashboard", "Calendar", "Customers", "Services", "ProductsInventory", "Online Store", "Orders", "Payroll", "POS / Checkout", "Reports", "Settings", "Staff"];
  if (account.role === "staff") return ["Calendar", "Services", "POS / Checkout", "Online Store", "Payroll"];
  return ["Online Store"];
}
