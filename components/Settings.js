"use client";

import { useEffect, useState } from "react";
import { tx } from "../lib/i18nClean";
import { bookingProviders } from "../lib/booking-providers/registry";
import { platforms, syncEvents } from "../lib/salonData";
import { getKv, saveKv, supabaseReady } from "../lib/supabaseBrowser";
import StaffManagement from "./StaffManagement";
import PrinterManager from "./PrinterManager";
import { getCurrentAccount } from "../lib/accountStore";

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
  taxMode: "exclusive",
  invoiceNumber: "",
  cancellationHours: 24,
  payAtStoreEnabled: true,
  bankTransferEnabled: true,
  cardEnabled: false,
  codEnabled: true,
  qrEnabled: false,
  qrImageUrl: "",
  bankName: "MUFG Bank",
  bankAccount: "1234567",
  bankHolder: "MAI BEAUTY SALON",
  paymentNote: "Vui lòng ghi số đơn hàng khi chuyển khoản.",
  paymentMethods: [
    { id: "cash", label: "現金" },
    { id: "card", label: "クレジットカード" },
    { id: "paypay", label: "PayPay" },
    { id: "transfer", label: "銀行振込" },
    { id: "other", label: "その他" },
  ],
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
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [qrUploadError, setQrUploadError] = useState("");
  const [currentAccount] = useState(getCurrentAccount);
  const isStaff = currentAccount?.role === "staff";
  const [activePanel, setActivePanel] = useState(isStaff ? "password" : "salon");
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [passwordMessage, setPasswordMessage] = useState("");
  const tr = (key) => tx(language, "settingsPage", key);
  const tc = (key) => tx(language, "common", key);
  const printerCopy = {
    vi: { panel: "Máy in hóa đơn", panelDesc: "Kết nối Star mPOP và chọn phương thức in.", title: "Kết nối máy in", desc: "Cấu hình tại đây được dùng chung cho trang Tính tiền và Lịch sử thanh toán.", support: "Hỗ trợ mPOP POP10, POP10CI, POP10CBI qua USB, Star webPRNT hoặc máy in hệ thống." },
    ja: { panel: "レシートプリンター", panelDesc: "Star mPOPと印刷方法を設定します。", title: "プリンター接続", desc: "この設定は会計画面と支払い履歴で共通して使用されます。", support: "mPOP POP10、POP10CI、POP10CBIのUSB、Star webPRNT、システム印刷に対応します。" },
    en: { panel: "Receipt printer", panelDesc: "Connect Star mPOP and select a print method.", title: "Printer connection", desc: "This configuration is shared by Checkout and Payment history.", support: "Supports mPOP POP10, POP10CI and POP10CBI through USB, Star webPRNT, or system printing." },
  }[language] || {};
  const allPanels = [
    ["salon", tr("salonPanel"), tr("salonPanelDesc")],
    ["business", tr("businessPanel"), tr("businessPanelDesc")],
    ["automation", tr("automationPanel"), tr("automationPanelDesc")],
    ["payment", tr("paymentPanel"), tr("paymentPanelDesc")],
    ["printer", printerCopy.panel, printerCopy.panelDesc],
    ["apps", tr("appsPanel"), tr("appsPanelDesc")],
    ["staff", tr("staffPanel"), tr("staffPanelDesc")],
  ];
  const panels = isStaff
    ? [["password", "Đổi mật khẩu", "Cập nhật mật khẩu đăng nhập của bạn."], ["printer", printerCopy.panel, printerCopy.panelDesc]]
    : allPanels;

  useEffect(() => { let mounted = true; async function load() { setSettings(getAppSettings()); try { const response = await fetch("/api/settings", { cache: "no-store" }); const result = await response.json(); const remote = result.value || (supabaseReady() ? await getKv("nail-japan-settings") : null); if (mounted && remote) { const next = { ...defaultSettings, ...remote }; setSettings(next); window.localStorage.setItem("nail-japan-settings", JSON.stringify(next)); } } catch {} } load(); return () => { mounted = false; }; }, []);

  async function saveServerSettings(value) {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.message || "Không thể lưu cài đặt lên Supabase.");
    return result.value || value;
  }

  function update(field, value) {
    setSaved(false);
    setSettings((current) => ({ ...current, [field]: value }));
  }

  async function uploadLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setQrUploadError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/logo-upload", { method: "POST", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.url) throw new Error(result.message || "Không thể tải logo lên Supabase.");
      const nextSettings = { ...settings, logoUrl: result.url };
      setSettings(nextSettings);
      window.localStorage.setItem("nail-japan-settings", JSON.stringify(nextSettings));
      await saveServerSettings(nextSettings);
      if (supabaseReady()) await saveKv("nail-japan-settings", nextSettings);
      window.dispatchEvent(new CustomEvent("nail-japan-settings-updated", { detail: nextSettings }));
      setSaved(true);
    } catch (error) {
      setQrUploadError(error.message || "Không thể tải logo lên Supabase.");
    }
  }

  async function uploadQr(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setQrUploadError("");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch("/api/qr-upload", { method: "POST", body });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.url) throw new Error(result.message || "Không thể tải ảnh QR lên Supabase.");
        const nextSettings = { ...settings, qrImageUrl: result.url };
        setSettings(nextSettings);
        window.localStorage.setItem("nail-japan-settings", JSON.stringify(nextSettings));
        await saveServerSettings(nextSettings);
        setSaved(true);
      } catch (error) {
        setQrUploadError(error.message || "Không thể tải ảnh QR lên Supabase.");
      }
    };
    reader.readAsDataURL(file);
  }

  function updatePaymentMethod(id, field, value) {
    setSaved(false);
    setSettings((current) => ({
      ...current,
      paymentMethods: (current.paymentMethods || defaultSettings.paymentMethods).map((method) => method.id === id ? { ...method, [field]: value } : method),
    }));
  }

  function addPaymentMethod() {
    setSaved(false);
    setSettings((current) => ({
      ...current,
      paymentMethods: [...(current.paymentMethods || defaultSettings.paymentMethods), { id: `custom-${Date.now()}`, label: tr("newPaymentMethod") }],
    }));
  }

  function removePaymentMethod(id) {
    setSaved(false);
    setSettings((current) => ({
      ...current,
      paymentMethods: (current.paymentMethods || defaultSettings.paymentMethods).filter((method) => method.id !== id),
    }));
  }

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true);
    setSaveMessage("");
    setQrUploadError("");
    window.localStorage.setItem("nail-japan-settings", JSON.stringify(settings));
    try {
      await saveServerSettings(settings);
      if (supabaseReady()) saveKv("nail-japan-settings", settings).catch(() => {});
      setSaved(true);
      setSaveMessage(tr("saved"));
      window.dispatchEvent(new CustomEvent("nail-japan-settings-updated", { detail: settings }));
    } catch (error) {
      setSaved(false);
      setSaveMessage(`${tr("saveFailed")} ${error.message || ""}`.trim());
      setQrUploadError(error.message || "Không thể lưu cài đặt lên Supabase.");
    } finally {
      setSaving(false);
    }
  }

  async function changeOwnPassword(event) {
    event.preventDefault();
    setPasswordMessage("");
    if (passwordForm.next.length < 6 || passwordForm.next !== passwordForm.confirm) { setPasswordMessage("Mật khẩu mới phải đủ 6 ký tự và nhập lại trùng nhau."); return; }
    const response = await fetch("/api/account-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: passwordForm.current, newPassword: passwordForm.next }) });
    const result = await response.json().catch(() => ({}));
    setPasswordMessage(result.ok ? "Đã đổi mật khẩu thành công." : (result.message || "Không thể đổi mật khẩu."));
    if (result.ok) setPasswordForm({ current: "", next: "", confirm: "" });
  }

  return (
    <>
      <div className="pageHead"><div><p className="eyebrow">SETTINGS</p><h1>{tr("title")}</h1><p>{tr("taskDesc")}</p></div>{!isStaff && <div className="settingsSaveAction">{saveMessage && <span className={saved ? "saveStatus successNote" : "saveStatus errorNote"} role="status">{saveMessage}</span>}<button className="primary" form="settingsForm" disabled={saving}>{saving ? tr("saving") : tr("save")}</button></div>}</div>
      <div className="settingsTaskGrid">{panels.map(([id, title, desc]) => <button key={id} className={activePanel === id ? "settingsTask active" : "settingsTask"} onClick={() => setActivePanel(id)}><strong>{title}</strong><span>{desc}</span></button>)}</div>
      <form id="settingsForm" className="settingsGrid settingsGridWide" onSubmit={saveSettings}>
        {activePanel === "salon" && <section className="card settingsPanel"><h2>{tr("salonInfo")}</h2><label>{tr("salonName")}<input value={settings.salonName} onChange={(event) => update("salonName", event.target.value)} /></label><label>{tr("branch")}<input value={settings.branch} onChange={(event) => update("branch", event.target.value)} /></label><label>{tc("address")}<input value={settings.address} onChange={(event) => update("address", event.target.value)} /></label><label>{tc("phone")}<input value={settings.phone} onChange={(event) => update("phone", event.target.value)} /></label><label>{tc("email")}<input type="email" value={settings.email} onChange={(event) => update("email", event.target.value)} /></label><label>{tr("logo")}<input type="file" accept="image/*" onChange={uploadLogo} /></label>{settings.logoUrl && <img className="settingsLogoPreview" src={settings.logoUrl} alt="Salon logo" />}</section>}
        {activePanel === "business" && <section className="card settingsPanel"><h2>{tr("businessHours")}</h2><label>{tr("open")}<input type="time" value={settings.openTime} onChange={(event) => update("openTime", event.target.value)} /></label><label>{tr("close")}<input type="time" value={settings.closeTime} onChange={(event) => update("closeTime", event.target.value)} /></label><label>{tr("tax")}<input type="number" value={settings.taxRate} onChange={(event) => update("taxRate", Number(event.target.value))} /></label><label>{tr("taxMode")}<select value={settings.taxMode} onChange={(event) => update("taxMode", event.target.value)}><option value="exclusive">{tr("taxExclusive")}</option><option value="inclusive">{tr("taxInclusive")}</option></select></label><label>{tr("invoiceNumber")}<input value={settings.invoiceNumber} onChange={(event) => update("invoiceNumber", event.target.value)} placeholder="T..." /></label><label>{tr("cancelLimit")}<input type="number" value={settings.cancellationHours} onChange={(event) => update("cancellationHours", Number(event.target.value))} /></label></section>}
        {activePanel === "automation" && <section className="card settingsPanel"><h2>{tr("automation")}</h2><label className="toggleLine"><input type="checkbox" checked={settings.autoConfirm} onChange={(event) => update("autoConfirm", event.target.checked)} /> {tr("autoConfirm")}</label><label className="toggleLine"><input type="checkbox" checked={settings.emailReminder} onChange={(event) => update("emailReminder", event.target.checked)} /> {tr("emailReminder")}</label><label className="toggleLine"><input type="checkbox" checked={settings.lineReminder} onChange={(event) => update("lineReminder", event.target.checked)} /> {tr("lineReminder")}</label><label className="toggleLine"><input type="checkbox" checked={settings.depositRequired} onChange={(event) => update("depositRequired", event.target.checked)} /> {tr("deposit")}</label>{saved && <p className="successNote">{tr("saved")}</p>}</section>}
        {activePanel === "payment" && <section className="card settingsPanel paymentSettingsPanel"><h2>{tr("paymentSettings")}</h2><p className="mutedText">{tr("paymentDesc")}</p><div className="settingsPaymentMethods">{(settings.paymentMethods || defaultSettings.paymentMethods).map((method) => <div className="settingsPaymentMethod" key={method.id}><input value={method.label} onChange={(event) => updatePaymentMethod(method.id, "label", event.target.value)} /><button type="button" className="ghost dangerButton" onClick={() => removePaymentMethod(method.id)}>{tc("delete")}</button></div>)}<button type="button" className="ghost" onClick={addPaymentMethod}>{tr("addPaymentMethod")}</button></div><label className="toggleLine"><input type="checkbox" checked={settings.qrEnabled} onChange={(event) => update("qrEnabled", event.target.checked)} /> {language === "ja" ? "QRコード決済" : language === "en" ? "QR code payment" : "Thanh toán bằng mã QR"}</label><label>{language === "ja" ? "QRコード画像" : language === "en" ? "QR code image" : "Ảnh mã QR"}<input type="file" accept="image/*" onChange={uploadQr} /></label>{qrUploadError && <p className="errorNote">{qrUploadError}</p>}{settings.qrImageUrl && <img className="settingsQrPreview" src={settings.qrImageUrl} alt="QR code" />}<label>{tr("bankName")}<input value={settings.bankName} onChange={(event) => update("bankName", event.target.value)} /></label><label>{tr("bankAccount")}<input value={settings.bankAccount} onChange={(event) => update("bankAccount", event.target.value)} /></label><label>{tr("holder")}<input value={settings.bankHolder} onChange={(event) => update("bankHolder", event.target.value)} /></label><label>{tr("paymentNote")}<input value={settings.paymentNote} onChange={(event) => update("paymentNote", event.target.value)} /></label></section>}
        {activePanel === "printer" && <section className="card settingsPanel printerSettingsPanel"><div><p className="eyebrow">STAR mPOP</p><h2>{printerCopy.title}</h2><p className="mutedText">{printerCopy.desc}</p></div><div className="printerSettingsAction"><PrinterManager language={language} /></div><p className="printerSupportNote">{printerCopy.support}</p></section>}
        {activePanel === "password" && isStaff && <section className="card settingsPanel"><h2>Đổi mật khẩu đăng nhập</h2><p className="mutedText">Tài khoản: {currentAccount.email}</p><div className="formGrid"><label>Mật khẩu hiện tại<input type="password" value={passwordForm.current} onChange={(event) => setPasswordForm({ ...passwordForm, current: event.target.value })} required /></label><label>Mật khẩu mới<input type="password" minLength={6} value={passwordForm.next} onChange={(event) => setPasswordForm({ ...passwordForm, next: event.target.value })} required /></label><label>Nhập lại mật khẩu mới<input type="password" minLength={6} value={passwordForm.confirm} onChange={(event) => setPasswordForm({ ...passwordForm, confirm: event.target.value })} required /></label><button className="primary" type="button" onClick={changeOwnPassword}>Đổi mật khẩu</button>{passwordMessage && <p className="successNote">{passwordMessage}</p>}</div></section>}
        {activePanel === "apps" && <section className="card settingsPanel paymentSettingsPanel"><h2>{tr("appsPanel")}</h2><p className="mutedText">{tr("appsDesc")}</p>{platforms.filter((platform) => platform.id !== "direct").map((platform) => { const provider = bookingProviders[platform.id === "hotpepper" ? "hotpepper" : platform.id]; return <div className="lineItem" key={platform.id}><span><strong>{platform.name}</strong><small>{provider?.status === "manual" ? tr("manualStatus") : platform.status}</small></span><strong>{provider?.capabilities?.includes("block") ? tr("synced") : tr("manual")}</strong></div>; })}<h3>{tr("syncLog")}</h3>{syncEvents.map((event) => <div className="lineItem" key={event.id}><span>{event.title}</span><small>{event.severity}</small></div>)}</section>}
      </form>
      {activePanel === "staff" && <section className="settingsStaffSection">
        <StaffManagement label={tr("staffPanel")} language={language} embedded />
      </section>}
    </>
  );
}

