"use client";

import { useEffect, useState } from "react";
import { tx } from "../lib/i18nClean";
import { bookingProviders } from "../lib/booking-providers/registry";
import { platforms, syncEvents } from "../lib/salonData";
import { getKv, saveKv, supabaseReady } from "../lib/supabaseBrowser";
import StaffManagement from "./StaffManagement";

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
  const [activePanel, setActivePanel] = useState("salon");
  const tr = (key) => tx(language, "settingsPage", key);
  const panels = [
    ["salon", "Cửa hàng", "Tên, địa chỉ, logo, liên hệ"],
    ["business", "Giờ & thuế", "Giờ làm, thuế, đăng ký"],
    ["automation", "Tự động", "Xác nhận và nhắc lịch"],
    ["payment", "Thanh toán", "Phương thức và chuyển khoản"],
    ["apps", "Liên kết ứng dụng", "Nailie, minimo, Hot Pepper"],
    ["staff", "Nhân viên", "Tài khoản và màu lịch"],
  ];

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
      paymentMethods: [...(current.paymentMethods || defaultSettings.paymentMethods), { id: `custom-${Date.now()}`, label: "新しい支払い" }],
    }));
  }

  function removePaymentMethod(id) {
    setSaved(false);
    setSettings((current) => ({
      ...current,
      paymentMethods: (current.paymentMethods || defaultSettings.paymentMethods).filter((method) => method.id !== id),
    }));
  }

  function saveSettings(event) {
    event.preventDefault();
    window.localStorage.setItem("nail-japan-settings", JSON.stringify(settings));
    if (supabaseReady()) saveKv("nail-japan-settings", settings).catch(() => {});
    setSaved(true);
  }

  return (
    <>
      <div className="pageHead"><div><p className="eyebrow">SETTINGS</p><h1>{tr("title")}</h1><p>Chọn một tác vụ để chỉnh sửa, tránh hiển thị các mục không liên quan.</p></div><button className="primary" form="settingsForm">Lưu cài đặt</button></div>
      <div className="settingsTaskGrid">{panels.map(([id, title, desc]) => <button key={id} className={activePanel === id ? "settingsTask active" : "settingsTask"} onClick={() => setActivePanel(id)}><strong>{title}</strong><span>{desc}</span></button>)}</div>
      <form id="settingsForm" className="settingsGrid settingsGridWide" onSubmit={saveSettings}>
        {activePanel === "salon" && <section className="card settingsPanel"><h2>Thông tin cửa hàng</h2><label>Tên cửa hàng<input value={settings.salonName} onChange={(event) => update("salonName", event.target.value)} /></label><label>Chi nhánh<input value={settings.branch} onChange={(event) => update("branch", event.target.value)} /></label><label>Địa chỉ<input value={settings.address} onChange={(event) => update("address", event.target.value)} /></label><label>Điện thoại<input value={settings.phone} onChange={(event) => update("phone", event.target.value)} /></label><label>Email<input type="email" value={settings.email} onChange={(event) => update("email", event.target.value)} /></label><label>Logo cửa hàng<input type="file" accept="image/*" onChange={uploadLogo} /></label>{settings.logoUrl && <img className="settingsLogoPreview" src={settings.logoUrl} alt="Salon logo" />}</section>}
        {activePanel === "business" && <section className="card settingsPanel"><h2>Giờ làm & thuế</h2><label>Mở cửa<input type="time" value={settings.openTime} onChange={(event) => update("openTime", event.target.value)} /></label><label>Đóng cửa<input type="time" value={settings.closeTime} onChange={(event) => update("closeTime", event.target.value)} /></label><label>Thuế %<input type="number" value={settings.taxRate} onChange={(event) => update("taxRate", Number(event.target.value))} /></label><label>Cách tính thuế<select value={settings.taxMode} onChange={(event) => update("taxMode", event.target.value)}><option value="exclusive">税抜</option><option value="inclusive">税込</option></select></label><label>登録番号<input value={settings.invoiceNumber} onChange={(event) => update("invoiceNumber", event.target.value)} placeholder="T..." /></label><label>Giới hạn hủy lịch theo giờ<input type="number" value={settings.cancellationHours} onChange={(event) => update("cancellationHours", Number(event.target.value))} /></label></section>}
        {activePanel === "automation" && <section className="card settingsPanel"><h2>Tự động hóa</h2><label className="toggleLine"><input type="checkbox" checked={settings.autoConfirm} onChange={(event) => update("autoConfirm", event.target.checked)} /> Tự động xác nhận lịch</label><label className="toggleLine"><input type="checkbox" checked={settings.emailReminder} onChange={(event) => update("emailReminder", event.target.checked)} /> Nhắc lịch qua email</label><label className="toggleLine"><input type="checkbox" checked={settings.lineReminder} onChange={(event) => update("lineReminder", event.target.checked)} /> Nhắc lịch qua LINE</label><label className="toggleLine"><input type="checkbox" checked={settings.depositRequired} onChange={(event) => update("depositRequired", event.target.checked)} /> Yêu cầu đặt cọc</label>{saved && <p className="successNote">Đã lưu cài đặt.</p>}</section>}
        {activePanel === "payment" && <section className="card settingsPanel paymentSettingsPanel"><h2>Cài đặt thanh toán</h2><p className="mutedText">Chủ quán có thể thêm, sửa hoặc xóa phương thức thanh toán dùng trong POS.</p><div className="settingsPaymentMethods">{(settings.paymentMethods || defaultSettings.paymentMethods).map((method) => <div className="settingsPaymentMethod" key={method.id}><input value={method.label} onChange={(event) => updatePaymentMethod(method.id, "label", event.target.value)} /><button type="button" className="ghost dangerButton" onClick={() => removePaymentMethod(method.id)}>Xóa</button></div>)}<button type="button" className="ghost" onClick={addPaymentMethod}>+ Thêm phương thức thanh toán</button></div><label>Tên ngân hàng<input value={settings.bankName} onChange={(event) => update("bankName", event.target.value)} /></label><label>Số tài khoản<input value={settings.bankAccount} onChange={(event) => update("bankAccount", event.target.value)} /></label><label>Chủ tài khoản<input value={settings.bankHolder} onChange={(event) => update("bankHolder", event.target.value)} /></label><label>Ghi chú thanh toán<input value={settings.paymentNote} onChange={(event) => update("paymentNote", event.target.value)} /></label></section>}
        {activePanel === "apps" && <section className="card settingsPanel paymentSettingsPanel"><h2>Liên kết ứng dụng</h2><p className="mutedText">Cài đặt kết nối Nailie, minimo, Hot Pepper và website riêng.</p>{platforms.filter((platform) => platform.id !== "direct").map((platform) => { const provider = bookingProviders[platform.id === "hotpepper" ? "hotpepper" : platform.id]; return <div className="lineItem" key={platform.id}><span><strong>{platform.name}</strong><small>{provider?.status === "manual" ? "Manual / chờ API hợp lệ" : platform.status}</small></span><strong>{provider?.capabilities?.includes("block") ? "Đồng bộ" : "Thủ công"}</strong></div>; })}<h3>Nhật ký đồng bộ</h3>{syncEvents.map((event) => <div className="lineItem" key={event.id}><span>{event.title}</span><small>{event.severity}</small></div>)}</section>}
      </form>
      {activePanel === "staff" && <section className="settingsStaffSection">
        <StaffManagement label="Nhân viên" embedded />
      </section>}
    </>
  );
}

