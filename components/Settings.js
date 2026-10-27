"use client";

import { useEffect, useState } from "react";
import { tx } from "../lib/i18nClean";
import { bookingProviders } from "../lib/booking-providers/registry";
import { platforms, syncEvents } from "../lib/salonData";
import { supabaseReady } from "../lib/supabaseBrowser";
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
  closedPeriods: [],
  staffClosedPeriods: [],
  autoConfirm: true,
  emailReminder: true,
  lineReminder: false,
  depositRequired: false,
  taxRate: 10,
  taxMode: "exclusive",
  invoiceNumber: "",
  cancellationHours: 24,
  bookingNotice:
    "Vui lòng đến sớm khoảng 5 phút. Nếu cần đổi hoặc hủy lịch, hãy liên hệ salon để được hỗ trợ.",
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
  try {
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export default function Settings({ language = "vi" }) {
  const [settings, setSettings] = useState(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [qrUploadError, setQrUploadError] = useState("");
  const [noticeTranslating, setNoticeTranslating] = useState(false);
  const [currentAccount] = useState(getCurrentAccount);
  const isStaff = ["staff", "manager"].includes(currentAccount?.role);
  const [activePanel, setActivePanel] = useState(
    isStaff ? "password" : "salon",
  );
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [passwordMessage, setPasswordMessage] = useState("");
  const tr = (key) => tx(language, "settingsPage", key);
  const tc = (key) => tx(language, "common", key);
  const printerCopy =
    {
      zh: {
        panel: "收据打印机",
        panelDesc: "连接 Star mPOP 并选择打印方式。",
        title: "打印机连接",
        desc: "此设置用于收银和付款记录页面。",
        support: "支持通过 USB、Star webPRNT 或系统打印机使用 mPOP。",
      },
      ko: {
        panel: "영수증 프린터",
        panelDesc: "Star mPOP을 연결하고 인쇄 방법을 선택합니다.",
        title: "프린터 연결",
        desc: "이 설정은 결제 및 결제 내역 화면에서 함께 사용됩니다.",
        support:
          "USB, Star webPRNT 또는 시스템 프린터를 통한 mPOP을 지원합니다.",
      },
      vi: {
        panel: "Máy in hóa đơn",
        panelDesc: "Kết nối Star mPOP và chọn phương thức in.",
        title: "Kết nối máy in",
        desc: "Cấu hình tại đây được dùng chung cho trang Tính tiền và Lịch sử thanh toán.",
        support:
          "Hỗ trợ mPOP POP10, POP10CI, POP10CBI qua USB, Star webPRNT hoặc máy in hệ thống.",
      },
      ja: {
        panel: "レシートプリンター",
        panelDesc: "Star mPOPと印刷方法を設定します。",
        title: "プリンター接続",
        desc: "この設定は会計画面と支払い履歴で共通して使用されます。",
        support:
          "mPOP POP10、POP10CI、POP10CBIのUSB、Star webPRNT、システム印刷に対応します。",
      },
      en: {
        panel: "Receipt printer",
        panelDesc: "Connect Star mPOP and select a print method.",
        title: "Printer connection",
        desc: "This configuration is shared by Checkout and Payment history.",
        support:
          "Supports mPOP POP10, POP10CI and POP10CBI through USB, Star webPRNT, or system printing.",
      },
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
    ? [
        ["password", "Đổi mật khẩu", "Cập nhật mật khẩu đăng nhập của bạn."],
        ["printer", printerCopy.panel, printerCopy.panelDesc],
      ]
    : allPanels;

  useEffect(() => {
    let mounted = true;
    async function load() {
      setSettings(getAppSettings());
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        const result = await response.json();
        const remote = result.value;
        if (mounted && remote) {
          const next = { ...defaultSettings, ...remote };
          setSettings(next);
          window.localStorage.setItem(
            "nail-japan-settings",
            JSON.stringify(next),
          );
        }
      } catch {}
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function saveServerSettings(value) {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      if (response.status === 401 || response.status === 403)
        throw new Error("Phiên đăng nhập server không hợp lệ. Hãy đăng xuất rồi đăng nhập lại bằng tài khoản admin/chủ quán đã cấu hình trên Vercel.");
      throw new Error(result.message || "Không thể lưu cài đặt lên Supabase.");
    }
    return result.value || value;
  }

  function update(field, value) {
    setSaved(false);
    setSettings((current) => ({ ...current, [field]: value }));
    if (field === "logoUrl")
      window.dispatchEvent(new CustomEvent("nail-japan-settings-updated"));
  }

  async function translateBookingNotice() {
    const text = String(settings.bookingNotice || "").trim();
    if (!text) return;
    setNoticeTranslating(true);
    try {
      const response = await fetch("/api/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, targets: ["VI", "JA", "EN", "ZH", "KO"] }) });
      const result = await response.json().catch(() => ({}));
      if (!result.ok) throw new Error(result.message || "Không thể dịch nội dung lưu ý.");
      const next = { ...settings, bookingNoticeVi: result.translations.VI || text, bookingNoticeJa: result.translations.JA || text, bookingNoticeEn: result.translations.EN || text, bookingNoticeZh: result.translations.ZH || text, bookingNoticeKo: result.translations.KO || text, bookingNoticeTranslationSource: text };
      setSettings(next);
      window.localStorage.setItem("nail-japan-settings", JSON.stringify({ ...next, logoUrl: persisted.logoUrl }));
      await saveServerSettings(next);
      setSaved(true);
    } catch (error) { setQrUploadError(error.message || "Không thể dịch nội dung lưu ý."); }
    finally { setNoticeTranslating(false); }
  }

  async function uploadLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setQrUploadError("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", "logo");
      const response = await fetch("/api/image-upload", { method: "POST", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.url) throw new Error(result.message || "Không thể tải logo lên Supabase.");
      const next = { ...settings, logoUrl: result.url };
      const persisted = await saveServerSettings(next);
      if (persisted.logoUrl !== result.url) throw new Error("Server chưa xác nhận logo mới đã được lưu.");
      setSettings({ ...next, logoUrl: persisted.logoUrl });
      window.localStorage.setItem("nail-japan-settings", JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("nail-japan-settings-updated"));
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
        const response = await fetch("/api/qr-upload", {
          method: "POST",
          body,
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.url)
          throw new Error(
            result.message || "Không thể tải ảnh QR lên Supabase.",
          );
        const nextSettings = { ...settings, qrImageUrl: result.url };
        setSettings(nextSettings);
        window.localStorage.setItem(
          "nail-japan-settings",
          JSON.stringify(nextSettings),
        );
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
      paymentMethods: (
        current.paymentMethods || defaultSettings.paymentMethods
      ).map((method) =>
        method.id === id ? { ...method, [field]: value } : method,
      ),
    }));
  }

  function addPaymentMethod() {
    setSaved(false);
    setSettings((current) => ({
      ...current,
      paymentMethods: [
        ...(current.paymentMethods || defaultSettings.paymentMethods),
        { id: `custom-${Date.now()}`, label: tr("newPaymentMethod") },
      ],
    }));
  }

  function removePaymentMethod(id) {
    setSaved(false);
    setSettings((current) => ({
      ...current,
      paymentMethods: (
        current.paymentMethods || defaultSettings.paymentMethods
      ).filter((method) => method.id !== id),
    }));
  }

  async function saveSettings(event) {
    event.preventDefault();
    setQrUploadError("");
    window.localStorage.setItem(
      "nail-japan-settings",
      JSON.stringify(settings),
    );
    window.dispatchEvent(new CustomEvent("nail-japan-settings-updated"));
    try {
      await saveServerSettings(settings);
      setSaved(true);
    } catch (error) {
      setSaved(false);
      setQrUploadError(error.message || "Không thể lưu cài đặt lên Supabase.");
    }
  }

  async function changeOwnPassword(event) {
    event.preventDefault();
    setPasswordMessage("");
    if (
      passwordForm.next.length < 6 ||
      passwordForm.next !== passwordForm.confirm
    ) {
      setPasswordMessage(
        "Mật khẩu mới phải đủ 6 ký tự và nhập lại trùng nhau.",
      );
      return;
    }
    const response = await fetch("/api/account-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: passwordForm.current,
        newPassword: passwordForm.next,
      }),
    });
    const result = await response.json().catch(() => ({}));
    setPasswordMessage(
      result.ok
        ? "Đã đổi mật khẩu thành công."
        : result.message || "Không thể đổi mật khẩu.",
    );
    if (result.ok) setPasswordForm({ current: "", next: "", confirm: "" });
  }

  return (
    <>
      <div className="pageHead">
        <div>
          <p className="eyebrow">SETTINGS</p>
          <h1>{tr("title")}</h1>
          <p>{tr("taskDesc")}</p>
        </div>
        {!isStaff && (
          <button className="primary" form="settingsForm">
            {tr("save")}
          </button>
        )}
      </div>
      <div className="settingsTaskGrid">
        {panels.map(([id, title, desc]) => (
          <button
            key={id}
            className={
              activePanel === id ? "settingsTask active" : "settingsTask"
            }
            onClick={() => setActivePanel(id)}
          >
            <strong>{title}</strong>
            <span>{desc}</span>
          </button>
        ))}
      </div>
      <form
        id="settingsForm"
        className="settingsGrid settingsGridWide"
        onSubmit={saveSettings}
      >
        {activePanel === "salon" && (
          <section className="card settingsPanel">
            <h2>{tr("salonInfo")}</h2>
            <label>
              {tr("salonName")}
              <input
                value={settings.salonName}
                onChange={(event) => update("salonName", event.target.value)}
              />
            </label>
            <label>
              {tr("branch")}
              <input
                value={settings.branch}
                onChange={(event) => update("branch", event.target.value)}
              />
            </label>
            <label>
              {tc("address")}
              <input
                value={settings.address}
                onChange={(event) => update("address", event.target.value)}
              />
            </label>
            <label>
              {tc("phone")}
              <input
                value={settings.phone}
                onChange={(event) => update("phone", event.target.value)}
              />
            </label>
            <label>
              {tc("email")}
              <input
                type="email"
                value={settings.email}
                onChange={(event) => update("email", event.target.value)}
              />
            </label>
            <label>
              Nội dung “Lưu ý khi đến salon”
              <textarea
                rows="6"
                value={settings.bookingNotice || ""}
                onChange={(event) =>
                  update("bookingNotice", event.target.value)
                }
              />
            </label>
            <button type="button" className="ghost" onClick={translateBookingNotice} disabled={noticeTranslating || !settings.bookingNotice?.trim()}>{noticeTranslating ? "Đang dịch nội dung…" : "Dịch nội dung lưu ý sang 5 ngôn ngữ"}</button>
            <label>
              {tr("logo")}
              <input type="file" accept="image/*" onChange={uploadLogo} />
            </label>
            {settings.logoUrl && (
              <img
                className="settingsLogoPreview"
                src={settings.logoUrl}
                alt="Salon logo"
              />
            )}
            {qrUploadError && <p className="errorNote">{qrUploadError}</p>}
          </section>
        )}
        {activePanel === "business" && (
          <section className="card settingsPanel">
            <h2>{tr("businessHours")}</h2>
            <label>
              {tr("open")}
              <input
                type="time"
                value={settings.openTime}
                onChange={(event) => update("openTime", event.target.value)}
              />
            </label>
            <label>
              {tr("close")}
              <input
                type="time"
                value={settings.closeTime}
                onChange={(event) => update("closeTime", event.target.value)}
              />
            </label>
            <label>
              Khung giờ đóng lịch (mỗi dòng: YYYY-MM-DD HH:MM-HH:MM)
              <textarea rows="4" value={(settings.closedPeriods || []).join("\n")} onChange={(event) => update("closedPeriods", event.target.value.split("\n").map((v) => v.trim()).filter(Boolean))} placeholder="2026-10-31 13:00-15:00" />
            </label>
            <label>
              Đóng lịch riêng nhân viên (mỗi dòng: staffId YYYY-MM-DD HH:MM-HH:MM)
              <textarea rows="4" value={(settings.staffClosedPeriods || []).join("\n")} onChange={(event) => update("staffClosedPeriods", event.target.value.split("\n").map((v) => v.trim()).filter(Boolean))} placeholder="staff-1 2026-10-31 13:00-15:00" />
            </label>
            <label>
              {tr("tax")}
              <input
                type="number"
                value={settings.taxRate}
                onChange={(event) =>
                  update("taxRate", Number(event.target.value))
                }
              />
            </label>
            <label>
              {tr("taxMode")}
              <select
                value={settings.taxMode}
                onChange={(event) => update("taxMode", event.target.value)}
              >
                <option value="exclusive">{tr("taxExclusive")}</option>
                <option value="inclusive">{tr("taxInclusive")}</option>
              </select>
            </label>
            <label>
              {tr("invoiceNumber")}
              <input
                value={settings.invoiceNumber}
                onChange={(event) =>
                  update("invoiceNumber", event.target.value)
                }
                placeholder="T..."
              />
            </label>
            <label>
              {tr("cancelLimit")}
              <input
                type="number"
                value={settings.cancellationHours}
                onChange={(event) =>
                  update("cancellationHours", Number(event.target.value))
                }
              />
            </label>
          </section>
        )}
        {activePanel === "automation" && (
          <section className="card settingsPanel">
            <h2>{tr("automation")}</h2>
            <label className="toggleLine">
              <input
                type="checkbox"
                checked={settings.autoConfirm}
                onChange={(event) =>
                  update("autoConfirm", event.target.checked)
                }
              />{" "}
              {tr("autoConfirm")}
            </label>
            <label className="toggleLine">
              <input
                type="checkbox"
                checked={settings.emailReminder}
                onChange={(event) =>
                  update("emailReminder", event.target.checked)
                }
              />{" "}
              {tr("emailReminder")}
            </label>
            <label className="toggleLine">
              <input
                type="checkbox"
                checked={settings.lineReminder}
                onChange={(event) =>
                  update("lineReminder", event.target.checked)
                }
              />{" "}
              {tr("lineReminder")}
            </label>
            <label className="toggleLine">
              <input
                type="checkbox"
                checked={settings.depositRequired}
                onChange={(event) =>
                  update("depositRequired", event.target.checked)
                }
              />{" "}
              {tr("deposit")}
            </label>
            {saved && <p className="successNote">{tr("saved")}</p>}
          </section>
        )}
        {activePanel === "payment" && (
          <section className="card settingsPanel paymentSettingsPanel">
            <h2>{tr("paymentSettings")}</h2>
            <p className="mutedText">{tr("paymentDesc")}</p>
            <div className="settingsPaymentMethods">
              {(settings.paymentMethods || defaultSettings.paymentMethods).map(
                (method) => (
                  <div className="settingsPaymentMethod" key={method.id}>
                    <input
                      value={method.label}
                      onChange={(event) =>
                        updatePaymentMethod(
                          method.id,
                          "label",
                          event.target.value,
                        )
                      }
                    />
                    <button
                      type="button"
                      className="ghost dangerButton"
                      onClick={() => removePaymentMethod(method.id)}
                    >
                      {tc("delete")}
                    </button>
                  </div>
                ),
              )}
              <button
                type="button"
                className="ghost"
                onClick={addPaymentMethod}
              >
                {tr("addPaymentMethod")}
              </button>
            </div>
            <label className="toggleLine">
              <input
                type="checkbox"
                checked={settings.qrEnabled}
                onChange={(event) => update("qrEnabled", event.target.checked)}
              />{" "}
              {language === "ja"
                ? "QRコード決済"
                : language === "en"
                  ? "QR code payment"
                  : "Thanh toán bằng mã QR"}
            </label>
            <label>
              {language === "ja"
                ? "QRコード画像"
                : language === "en"
                  ? "QR code image"
                  : "Ảnh mã QR"}
              <input type="file" accept="image/*" onChange={uploadQr} />
            </label>
            {qrUploadError && <p className="errorNote">{qrUploadError}</p>}
            {settings.qrImageUrl && (
              <img
                className="settingsQrPreview"
                src={settings.qrImageUrl}
                alt="QR code"
              />
            )}
            <label>
              {tr("bankName")}
              <input
                value={settings.bankName}
                onChange={(event) => update("bankName", event.target.value)}
              />
            </label>
            <label>
              {tr("bankAccount")}
              <input
                value={settings.bankAccount}
                onChange={(event) => update("bankAccount", event.target.value)}
              />
            </label>
            <label>
              {tr("holder")}
              <input
                value={settings.bankHolder}
                onChange={(event) => update("bankHolder", event.target.value)}
              />
            </label>
            <label>
              {tr("paymentNote")}
              <input
                value={settings.paymentNote}
                onChange={(event) => update("paymentNote", event.target.value)}
              />
            </label>
          </section>
        )}
        {activePanel === "printer" && (
          <section className="card settingsPanel printerSettingsPanel">
            <div>
              <p className="eyebrow">STAR mPOP</p>
              <h2>{printerCopy.title}</h2>
              <p className="mutedText">{printerCopy.desc}</p>
            </div>
            <div className="printerSettingsAction">
              <PrinterManager language={language} />
            </div>
            <p className="printerSupportNote">{printerCopy.support}</p>
          </section>
        )}
        {activePanel === "password" && isStaff && (
          <section className="card settingsPanel">
            <h2>Đổi mật khẩu đăng nhập</h2>
            <p className="mutedText">Tài khoản: {currentAccount.email}</p>
            <div className="formGrid">
              <label>
                Mật khẩu hiện tại
                <input
                  type="password"
                  value={passwordForm.current}
                  onChange={(event) =>
                    setPasswordForm({
                      ...passwordForm,
                      current: event.target.value,
                    })
                  }
                  required
                />
              </label>
              <label>
                Mật khẩu mới
                <input
                  type="password"
                  minLength={6}
                  value={passwordForm.next}
                  onChange={(event) =>
                    setPasswordForm({
                      ...passwordForm,
                      next: event.target.value,
                    })
                  }
                  required
                />
              </label>
              <label>
                Nhập lại mật khẩu mới
                <input
                  type="password"
                  minLength={6}
                  value={passwordForm.confirm}
                  onChange={(event) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirm: event.target.value,
                    })
                  }
                  required
                />
              </label>
              <button
                className="primary"
                type="button"
                onClick={changeOwnPassword}
              >
                Đổi mật khẩu
              </button>
              {passwordMessage && (
                <p className="successNote">{passwordMessage}</p>
              )}
            </div>
          </section>
        )}
        {activePanel === "apps" && (
          <section className="card settingsPanel paymentSettingsPanel">
            <h2>{tr("appsPanel")}</h2>
            <p className="mutedText">{tr("appsDesc")}</p>
            {platforms
              .filter((platform) => platform.id !== "direct")
              .map((platform) => {
                const provider =
                  bookingProviders[
                    platform.id === "hotpepper" ? "hotpepper" : platform.id
                  ];
                return (
                  <div className="lineItem" key={platform.id}>
                    <span>
                      <strong>{platform.name}</strong>
                      <small>
                        {provider?.status === "manual"
                          ? tr("manualStatus")
                          : platform.status}
                      </small>
                    </span>
                    <strong>
                      {provider?.capabilities?.includes("block")
                        ? tr("synced")
                        : tr("manual")}
                    </strong>
                  </div>
                );
              })}
            <h3>{tr("syncLog")}</h3>
            {syncEvents.map((event) => (
              <div className="lineItem" key={event.id}>
                <span>{event.title}</span>
                <small>{event.severity}</small>
              </div>
            ))}
          </section>
        )}
      </form>
      {activePanel === "staff" && (
        <section className="settingsStaffSection">
          <StaffManagement
            label={tr("staffPanel")}
            language={language}
            embedded
          />
        </section>
      )}
    </>
  );
}
