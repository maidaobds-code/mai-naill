"use client";

import { useState } from "react";
import { discoverStarUsb, getPrinterSettings, openWebPrnt, printStarReceipt, savePrinterSettings, supportsStarUsb } from "../lib/starPrinter";

const text = {
  zh: { printer: "打印机", title: "连接收据打印机", usb: "通过USB连接mPOP", webprnt: "打开Star webPRNT", system: "使用系统打印机", connected: "已连接", unsupported: "此浏览器不支持WebUSB，请使用Chrome/Edge或Star webPRNT。", close: "关闭" },
  ko: { printer: "프린터", title: "영수증 프린터 연결", usb: "USB로 mPOP 연결", webprnt: "Star webPRNT 열기", system: "시스템 프린터 사용", connected: "연결됨", unsupported: "이 브라우저는 WebUSB를 지원하지 않습니다. Chrome/Edge 또는 Star webPRNT를 사용하세요.", close: "닫기" },
  vi: { printer: "Máy in", title: "Kết nối máy in hóa đơn", usb: "Kết nối mPOP bằng USB", webprnt: "Mở Star webPRNT", system: "Dùng máy in hệ thống", connected: "Đã kết nối", unsupported: "Trình duyệt này không hỗ trợ WebUSB. Hãy dùng Chrome/Edge hoặc Star webPRNT.", close: "Đóng" },
  ja: { printer: "プリンター", title: "レシートプリンター接続", usb: "USBでmPOPに接続", webprnt: "Star webPRNTを開く", system: "システム印刷を使用", connected: "接続済み", unsupported: "このブラウザはWebUSB非対応です。Chrome/EdgeまたはStar webPRNTをご利用ください。", close: "閉じる" },
  en: { printer: "Printer", title: "Receipt printer connection", usb: "Connect mPOP by USB", webprnt: "Open Star webPRNT", system: "Use system printer", connected: "Connected", unsupported: "This browser does not support WebUSB. Use Chrome/Edge or Star webPRNT.", close: "Close" },
};

export default function PrinterManager({ language = "vi" }) {
  const c = text[language] || text.vi;
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(getPrinterSettings);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  async function connectUsb() {
    setBusy(true); setMessage("");
    try { setSettings(await discoverStarUsb()); setMessage(c.connected); }
    catch (error) { setMessage(error?.message || c.unsupported); }
    finally { setBusy(false); }
  }
  async function testPrint() {
    setTesting(true); setMessage("");
    try { await printStarReceipt({ receiptNumber: "TEST", orderNumber: "TEST", lines: [{ id: "test", name: "テスト印刷", quantity: 1, unitPrice: 0 }], total: 0, paid: 0, change: 0, paymentMethodText: "テスト" }, {}, { openDrawer: false }); setMessage("テスト印刷を送信しました"); }
    catch (error) { setMessage(error?.message || "プリンターに接続できません"); }
    finally { setTesting(false); }
  }
  return <>
    <button type="button" className="ghost printerButton" onClick={() => setOpen(true)}>▣ {c.printer}</button>
    {open && <div className="printerOverlay"><section className="card printerModal"><div className="sectionTitle"><div><p className="eyebrow">STAR mPOP</p><h2>{c.title}</h2></div><button className="ghost" onClick={() => setOpen(false)}>{c.close}</button></div><div className="printerChoices"><button className="primary" disabled={busy || !supportsStarUsb()} onClick={connectUsb}>{busy ? "..." : c.usb}</button><button className="ghost" onClick={() => { savePrinterSettings({ mode: "webprnt", identifier: "", model: "mPOP" }); setSettings(getPrinterSettings()); openWebPrnt(); }}>{c.webprnt}</button><button className="ghost" onClick={() => { const next = { mode: "system", identifier: "", model: "" }; savePrinterSettings(next); setSettings(next); setMessage(c.connected); }}>{c.system}</button><button className="ghost" disabled={testing || settings.mode !== "star-usb"} onClick={testPrint}>{testing ? "..." : "In thử / テスト印刷"}</button></div><div className="printerStatus"><strong>{settings.mode === "star-usb" ? `${c.connected}: ${settings.model}` : settings.mode === "webprnt" ? "Star webPRNT" : c.system}</strong><span>{settings.mode === "star-usb" ? "● Đã kết nối / 接続済み" : "○ Chưa kết nối trực tiếp / 未接続"}</span>{message && <span>{message}</span>}{!supportsStarUsb() && <small>{c.unsupported}</small>}</div></section></div>}
  </>;
}
