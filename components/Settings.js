"use client";

import { useEffect, useState } from "react";
import { tx } from "../lib/i18nClean";
import { bookingProviders } from "../lib/booking-providers/registry";
import { platforms, syncEvents } from "../lib/salonData";
import { getKv, saveKv, supabaseReady } from "../lib/supabaseBrowser";

export const defaultSettings = {
  salonName: "Mai Beauty Salon",
  branch: "Tokyo",
  address: "1-2-3 Shibuya, Tokyo",
  logoUrl: "",
  phone: "03-0000-0000",
  email: "hello@maibeautysalon.jp",
  openTime: "09:00",
  closeTime: "23:00",
  autoConfirm: true,
  emailReminder: true,
  lineReminder: false,
  depositRequired: false,
  taxRate: 10,
  cancellationHours: 24,
  payAtStoreEnabled: true,
  bankTransferEnabled: true,
  cardEnabled: false,
  codEnabled: true,
  bankName: "MUFG Bank",
  bankAccount: "1234567",
  bankHolder: "MAI BEAUTY SALON",
  paymentNote: "Vui lòng ghi số đơn hàng khi chuyển khoản.",
};

export function getAppSettings() {
  if (typeof window === "undefined") return defaultSettings;
  const raw = window.localStorage.getItem("nail-japan-settings");
  if (!raw) return defaultSettings;
  try { return { ...defaultSettings, ...JSON.parse(raw) }; } catch { return defaultSettings; }
}

export default function Settings({ language = "vi" }) {
  const [settings, setSettings] = useState(defaultSettings);
  const [saved, setSaved] = useState(false);
  const tr = (key) => tx(language, "settingsPage", key);

  useEffect(() => { let mounted = true; async function load() { setSettings(getAppSettings()); if (supabaseReady()) { try { const remote = await getKv("nail-japan-settings"); if (mounted && remote) { setSettings({ ...defaultSettings, ...remote }); window.localStorage.setItem("nail-japan-settings", JSON.stringify({ ...defaultSettings, ...remote })); } } catch {} } } load(); return () => { mounted = false; }; }, []);

  function update(field, value) {
    setSaved(false);
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function uploadLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update("logoUrl", reader.result);
    reader.readAsDataURL(file);
  }

  function saveSettings(event) {
    event.preventDefault();
    window.localStorage.setItem("nail-japan-settings", JSON.stringify(settings));
    if (supabaseReady()) saveKv("nail-japan-settings", settings).catch(() => {});
    setSaved(true);
  }

  return (
    <>
      <div className="pageHead"><div><p className="eyebrow">SETTINGS</p><h1>{tr("title")}</h1><p>{tr("desc")}</p></div><button className="primary" form="settingsForm">{tr("save")}</button></div>
      <form id="settingsForm" className="settingsGrid settingsGridWide" onSubmit={saveSettings}>
        <section className="card settingsPanel"><h2>{tr("salonInfo")}</h2><label>{tr("salonName")}<input value={settings.salonName} onChange={(event) => update("salonName", event.target.value)} /></label><label>{tr("branch")}<input value={settings.branch} onChange={(event) => update("branch", event.target.value)} /></label><label>Địa chỉ<input value={settings.address} onChange={(event) => update("address", event.target.value)} /></label><label>{tx(language,"common","phone")}<input value={settings.phone} onChange={(event) => update("phone", event.target.value)} /></label><label>{tx(language,"common","email")}<input type="email" value={settings.email} onChange={(event) => update("email", event.target.value)} /></label><label>Logo cửa hàng<input type="file" accept="image/*" onChange={uploadLogo} /></label>{settings.logoUrl && <img className="settingsLogoPreview" src={settings.logoUrl} alt="Salon logo" />}</section>
        <section className="card settingsPanel"><h2>{tr("businessHours")}</h2><label>{tr("open")}<input type="time" value={settings.openTime} onChange={(event) => update("openTime", event.target.value)} /></label><label>{tr("close")}<input type="time" value={settings.closeTime} onChange={(event) => update("closeTime", event.target.value)} /></label><label>{tr("tax")}<input type="number" value={settings.taxRate} onChange={(event) => update("taxRate", Number(event.target.value))} /></label><label>{tr("cancelLimit")}<input type="number" value={settings.cancellationHours} onChange={(event) => update("cancellationHours", Number(event.target.value))} /></label></section>
        <section className="card settingsPanel"><h2>{tr("automation")}</h2><label className="toggleLine"><input type="checkbox" checked={settings.autoConfirm} onChange={(event) => update("autoConfirm", event.target.checked)} /> {tr("autoConfirm")}</label><label className="toggleLine"><input type="checkbox" checked={settings.emailReminder} onChange={(event) => update("emailReminder", event.target.checked)} /> {tr("emailReminder")}</label><label className="toggleLine"><input type="checkbox" checked={settings.lineReminder} onChange={(event) => update("lineReminder", event.target.checked)} /> {tr("lineReminder")}</label><label className="toggleLine"><input type="checkbox" checked={settings.depositRequired} onChange={(event) => update("depositRequired", event.target.checked)} /> {tr("deposit")}</label>{saved && <p className="successNote">{tr("saved")}</p>}</section>
        <section className="card settingsPanel paymentSettingsPanel"><h2>{tr("paymentSettings")}</h2><p className="mutedText">{tr("paymentDesc")}</p><label className="toggleLine"><input type="checkbox" checked={settings.payAtStoreEnabled} onChange={(event) => update("payAtStoreEnabled", event.target.checked)} /> {tr("payAtStore")}</label><label className="toggleLine"><input type="checkbox" checked={settings.bankTransferEnabled} onChange={(event) => update("bankTransferEnabled", event.target.checked)} /> {tr("bankTransfer")}</label><label className="toggleLine"><input type="checkbox" checked={settings.cardEnabled} onChange={(event) => update("cardEnabled", event.target.checked)} /> {tr("card")}</label><label className="toggleLine"><input type="checkbox" checked={settings.codEnabled} onChange={(event) => update("codEnabled", event.target.checked)} /> {tr("cod")}</label><label>{tr("bankName")}<input value={settings.bankName} onChange={(event) => update("bankName", event.target.value)} /></label><label>{tr("bankAccount")}<input value={settings.bankAccount} onChange={(event) => update("bankAccount", event.target.value)} /></label><label>{tr("holder")}<input value={settings.bankHolder} onChange={(event) => update("bankHolder", event.target.value)} /></label><label>{tr("paymentNote")}<input value={settings.paymentNote} onChange={(event) => update("paymentNote", event.target.value)} /></label></section>
        <section className="card settingsPanel paymentSettingsPanel"><h2>Liên kết ứng dụng</h2><p className="mutedText">Gộp cài đặt kết nối Nailie, minimo, HOT PEPPER và website riêng trong trang cài đặt.</p>{platforms.filter((platform) => platform.id !== "direct").map((platform) => { const provider = bookingProviders[platform.id === "hotpepper" ? "hotpepper" : platform.id]; return <div className="lineItem" key={platform.id}><span><strong>{platform.name}</strong><small>{provider?.status === "manual" ? "Manual / chờ API hợp lệ" : platform.status}</small></span><strong>{provider?.capabilities?.includes("block") ? "Sync OK" : "Manual"}</strong></div>; })}<h3>Nhật ký đồng bộ</h3>{syncEvents.map((event) => <div className="lineItem" key={event.id}><span>{event.title}</span><small>{event.severity}</small></div>)}</section>
      </form>
    </>
  );
}

