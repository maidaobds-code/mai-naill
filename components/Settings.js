"use client";

import { useEffect, useState } from "react";

export const defaultSettings = {
  salonName: "Glass Nail",
  branch: "Shinjuku",
  phone: "03-0000-0000",
  email: "hello@glassnail.jp",
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
  bankHolder: "GLASS NAIL JP",
  paymentNote: "Vui long ghi so don hang khi chuyen khoan.",
};

export function getAppSettings() {
  if (typeof window === "undefined") return defaultSettings;
  const raw = window.localStorage.getItem("nail-japan-settings");
  if (!raw) return defaultSettings;
  try {
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export default function Settings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(getAppSettings());
  }, []);

  function update(field, value) {
    setSaved(false);
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function saveSettings(event) {
    event.preventDefault();
    window.localStorage.setItem("nail-japan-settings", JSON.stringify(settings));
    setSaved(true);
  }

  return (
    <>
      <div className="pageHead"><div><p className="eyebrow">SETTINGS</p><h1>Settings</h1><p>Cai dat cua hang, gio mo cua, thong bao va thanh toan dung chung toan app.</p></div><button className="primary" form="settingsForm">Save settings</button></div>
      <form id="settingsForm" className="settingsGrid settingsGridWide" onSubmit={saveSettings}>
        <section className="card settingsPanel"><h2>Salon information</h2><label>Salon name<input value={settings.salonName} onChange={(event) => update("salonName", event.target.value)} /></label><label>Branch<input value={settings.branch} onChange={(event) => update("branch", event.target.value)} /></label><label>Phone<input value={settings.phone} onChange={(event) => update("phone", event.target.value)} /></label><label>Email<input type="email" value={settings.email} onChange={(event) => update("email", event.target.value)} /></label></section>
        <section className="card settingsPanel"><h2>Business hours</h2><label>Open time<input type="time" value={settings.openTime} onChange={(event) => update("openTime", event.target.value)} /></label><label>Close time<input type="time" value={settings.closeTime} onChange={(event) => update("closeTime", event.target.value)} /></label><label>Tax rate %<input type="number" value={settings.taxRate} onChange={(event) => update("taxRate", Number(event.target.value))} /></label><label>Cancel limit hours<input type="number" value={settings.cancellationHours} onChange={(event) => update("cancellationHours", Number(event.target.value))} /></label></section>
        <section className="card settingsPanel"><h2>Booking automation</h2><label className="toggleLine"><input type="checkbox" checked={settings.autoConfirm} onChange={(event) => update("autoConfirm", event.target.checked)} /> Auto confirm website bookings</label><label className="toggleLine"><input type="checkbox" checked={settings.emailReminder} onChange={(event) => update("emailReminder", event.target.checked)} /> Send email reminders</label><label className="toggleLine"><input type="checkbox" checked={settings.lineReminder} onChange={(event) => update("lineReminder", event.target.checked)} /> Send LINE reminders</label><label className="toggleLine"><input type="checkbox" checked={settings.depositRequired} onChange={(event) => update("depositRequired", event.target.checked)} /> Require deposit before booking</label>{saved && <p className="successNote">Settings saved.</p>}</section>
        <section className="card settingsPanel paymentSettingsPanel"><h2>Payment settings</h2><p className="mutedText">Moi chuc nang lien quan thanh toan tren app se doc tu day.</p><label className="toggleLine"><input type="checkbox" checked={settings.payAtStoreEnabled} onChange={(event) => update("payAtStoreEnabled", event.target.checked)} /> Pay at store / pickup</label><label className="toggleLine"><input type="checkbox" checked={settings.bankTransferEnabled} onChange={(event) => update("bankTransferEnabled", event.target.checked)} /> Bank transfer with bill upload</label><label className="toggleLine"><input type="checkbox" checked={settings.cardEnabled} onChange={(event) => update("cardEnabled", event.target.checked)} /> Card payment</label><label className="toggleLine"><input type="checkbox" checked={settings.codEnabled} onChange={(event) => update("codEnabled", event.target.checked)} /> COD / pay on delivery</label><label>Bank name<input value={settings.bankName} onChange={(event) => update("bankName", event.target.value)} /></label><label>Bank account<input value={settings.bankAccount} onChange={(event) => update("bankAccount", event.target.value)} /></label><label>Account holder<input value={settings.bankHolder} onChange={(event) => update("bankHolder", event.target.value)} /></label><label>Payment note<input value={settings.paymentNote} onChange={(event) => update("paymentNote", event.target.value)} /></label></section>
      </form>
    </>
  );
}
