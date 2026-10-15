"use client";

import { useState } from "react";
import { discoverStarUsb, getPrinterSettings, openWebPrnt, savePrinterSettings, supportsStarUsb } from "../lib/starPrinter";

const text = {
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
  async function connectUsb() {
    setBusy(true); setMessage("");
    try { setSettings(await discoverStarUsb()); setMessage(c.connected); }
    catch (error) { setMessage(error?.message || c.unsupported); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" className="ghost printerButton" onClick={() => setOpen(true)}>▣ {c.printer}</button>
    {open && <div className="printerOverlay"><section className="card printerModal"><div className="sectionTitle"><div><p className="eyebrow">STAR mPOP</p><h2>{c.title}</h2></div><button className="ghost" onClick={() => setOpen(false)}>{c.close}</button></div><div className="printerChoices"><button className="primary" disabled={busy || !supportsStarUsb()} onClick={connectUsb}>{busy ? "..." : c.usb}</button><button className="ghost" onClick={() => { savePrinterSettings({ mode: "webprnt", identifier: "", model: "mPOP" }); setSettings(getPrinterSettings()); openWebPrnt(); }}>{c.webprnt}</button><button className="ghost" onClick={() => { const next = { mode: "system", identifier: "", model: "" }; savePrinterSettings(next); setSettings(next); setMessage(c.connected); }}>{c.system}</button></div><div className="printerStatus"><strong>{settings.mode === "star-usb" ? `${c.connected}: ${settings.model}` : settings.mode === "webprnt" ? "Star webPRNT" : c.system}</strong>{message && <span>{message}</span>}{!supportsStarUsb() && <small>{c.unsupported}</small>}</div></section></div>}
  </>;
}
