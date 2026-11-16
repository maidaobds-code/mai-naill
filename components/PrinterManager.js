"use client";

import { useEffect, useState } from "react";
import { currentPrinterCapabilities, discoverStarUsb, getPrinterSettings, loadPrinterSettings, openWebPrnt, printStarReceipt, savePrinterSettings, supportsStarUsb, syncPrinterSettings } from "../lib/starPrinter";

const text = {
  zh: { printer: "打印机", title: "连接收据打印机", usb: "通过USB连接mPOP", webprnt: "打开Star webPRNT", system: "使用系统打印机", connected: "已连接", unsupported: "此浏览器不支持WebUSB，请使用Chrome/Edge或Star webPRNT。", close: "关闭" },
  ko: { printer: "프린터", title: "영수증 프린터 연결", usb: "USB로 mPOP 연결", webprnt: "Star webPRNT 열기", system: "시스템 프린터 사용", connected: "연결됨", unsupported: "이 브라우저는 WebUSB를 지원하지 않습니다. Chrome/Edge 또는 Star webPRNT를 사용하세요.", close: "닫기" },
  vi: { printer: "Máy in", title: "Kết nối máy in hóa đơn", usb: "Kết nối mPOP bằng USB", webprnt: "Mở Star webPRNT", system: "Dùng máy in hệ thống", connected: "Đã kết nối", unsupported: "Trình duyệt này không hỗ trợ WebUSB. Hãy dùng Chrome/Edge hoặc Star webPRNT.", close: "Đóng" },
  ja: { printer: "プリンター", title: "レシートプリンター接続", usb: "USBでmPOPに接続", webprnt: "Star webPRNTを開く", system: "システム印刷を使用", connected: "接続済み", unsupported: "このブラウザはWebUSB非対応です。Chrome/EdgeまたはStar webPRNTをご利用ください。", close: "閉じる" },
  en: { printer: "Printer", title: "Receipt printer connection", usb: "Connect mPOP by USB", webprnt: "Open Star webPRNT", system: "Use system printer", connected: "Connected", unsupported: "This browser does not support WebUSB. Use Chrome/Edge or Star webPRNT.", close: "Close" },
};

export default function PrinterManager({ language = "vi", showLogoUpload = false }) {
  const c = text[language] || text.vi;
  const capabilities = currentPrinterCapabilities();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(getPrinterSettings);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  useEffect(() => { loadPrinterSettings().then(setSettings).catch(() => {}); }, []);
  async function connectUsb() {
    setBusy(true); setMessage("");
    try { setSettings(await discoverStarUsb()); setMessage(c.connected); }
    catch (error) { setMessage(error?.message || c.unsupported); }
    finally { setBusy(false); }
  }
  async function testPrint() {
    setTesting(true); setMessage("");
    try { await printStarReceipt({ receiptNumber: "TEST", orderNumber: "TEST", lines: [{ id: "test", name: "テスト印刷", quantity: 1, unitPrice: 0 }], total: 0, paid: 0, change: 0, paymentMethodText: "テスト" }, {}, { openDrawer: false }); setMessage(settings.mode === "passprnt" ? "Đã chuyển lệnh sang Star PassPRNT. Kết quả in sẽ được báo khi quay lại." : "Đã gửi lệnh in USB."); }
    catch (error) { setMessage(error?.message || "プリンターに接続できません"); }
    finally { setTesting(false); }
  }
  async function uploadPrinterLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoBusy(true); setMessage("");
    try {
      const body = new FormData(); body.append("file", file); body.append("kind", "printer-logo");
      const upload = await fetch("/api/image-upload", { method: "POST", body });
      const result = await upload.json().catch(() => ({}));
      if (!upload.ok || !result.url) throw new Error(result.message || "Không thể tải logo máy in lên Supabase.");
      const next = await syncPrinterSettings({ ...settings, printerLogoUrl: result.url });
      setSettings(next); setMessage("Đã lưu logo riêng cho hóa đơn / 領収書");
    } catch (error) { setMessage(error.message || "Không thể lưu logo máy in."); }
    finally { setLogoBusy(false); }
  }
  return <>
    <button type="button" className="ghost printerButton" onClick={() => setOpen(true)}>▣ {c.printer}</button>
    {showLogoUpload && <div className="printerLogoInline"><label>Ảnh logo riêng trên hóa đơn / 領収書<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={logoBusy} onChange={uploadPrinterLogo} /></label>{settings.printerLogoUrl && <img className="printLogo printerLogoPreview" src={settings.printerLogoUrl} alt="Printer logo" />}</div>}
    {open && <div className="printerOverlay"><section className="card printerModal"><div className="sectionTitle"><div><p className="eyebrow">STAR mPOP</p><h2>{c.title}</h2></div><button type="button" className="ghost" onClick={() => setOpen(false)}>{c.close}</button></div><div className="printerChoices"><button type="button" className="primary" disabled={busy || !supportsStarUsb()} onClick={connectUsb}>{busy ? "..." : c.usb}</button><button type="button" className="ghost" onClick={() => { const next={...settings,mode:"passprnt",identifier:"",model:"mPOP POP10"};savePrinterSettings(next);setSettings(next);setMessage("Đã chọn Star PassPRNT cho thiết bị này. Cài ứng dụng và chọn máy in trong Star PassPRNT, rồi bấm In thử."); }}>In qua Star PassPRNT (Bluetooth / mobile)</button><button type="button" className="ghost" onClick={() => { const next = { ...settings, mode: "system", identifier: "", model: "" }; savePrinterSettings(next); setSettings(next); setMessage("Đã chọn hộp thoại in của hệ điều hành; chưa xác nhận kết nối máy in."); }}>{c.system}</button><button type="button" className="ghost" disabled={testing || !["star-usb","passprnt"].includes(settings.mode)} onClick={testPrint}>{testing ? "..." : "In thử / テスト印刷"}</button></div>{showLogoUpload && <div className="printerLogoSetup"><label>Logo riêng cho hóa đơn / 領収書<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={logoBusy} onChange={uploadPrinterLogo} /></label>{settings.printerLogoUrl && <img className="printLogo printerLogoPreview" src={settings.printerLogoUrl} alt="Printer logo" />}</div>}<div className="printerHelp"><strong>Star mPOP POP10</strong>{capabilities.ios?<p>iPad/iPhone: Chrome không kết nối USB trực tiếp. Cài Star PassPRNT, ghép Bluetooth mPOP trong Cài đặt iOS và chọn máy in trong Star PassPRNT. Sau đó quay lại Chrome, chọn In qua Star PassPRNT và In thử.</p>:capabilities.android?<p>Android: dùng Star PassPRNT để in qua Bluetooth hoặc USB được thiết bị hỗ trợ. Ghép máy in và chọn mPOP trong Star PassPRNT trước khi in từ Chrome.</p>:<p>Máy tính: dùng Chrome/Edge với mPOP cắm USB. Trên iPad/điện thoại, chọn Star PassPRNT để chuyển lệnh sang ứng dụng Star. Phương thức kết nối được lưu riêng trên từng thiết bị.</p>}<a href="https://starmicronics.com/technology/passprnt/" target="_blank" rel="noreferrer">Hướng dẫn / tải ứng dụng Star PassPRNT</a><p>Chọn phương thức chưa có nghĩa đã kết nối. Hãy In thử và kiểm tra giấy in.</p></div><div className="printerStatus"><strong>{settings.mode === "star-usb" ? `${c.connected}: ${settings.model}` : settings.mode === "passprnt" ? "Star PassPRNT · đã chọn phương thức" : settings.mode === "webprnt" ? "Chọn lại phương thức in phù hợp" : c.system}</strong><span>{settings.mode === "star-usb" ? "● Đã kết nối / 接続済み" : "○ Chưa kết nối trực tiếp / 未接続"}</span>{message && <span>{message}</span>}{!supportsStarUsb() && <small>Thiết bị này không hỗ trợ phương thức USB trực tiếp của app.</small>}</div></section></div>}
  </>;
}
