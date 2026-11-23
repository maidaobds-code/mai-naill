"use client";
import { printerCapabilities, passPrntReceiptHtml, passPrntUrl } from "./mobilePrinter.js";

const PRINTER_KEY = "nail-japan-printer-settings";

export function getPrinterSettings() {
  if (typeof window === "undefined") return { mode: "system", identifier: "", model: "" };
  try { return JSON.parse(localStorage.getItem(PRINTER_KEY)) || { mode: "system", identifier: "", model: "" }; }
  catch { return { mode: "system", identifier: "", model: "" }; }
}

export function savePrinterSettings(value) {
  localStorage.setItem(PRINTER_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("nail-japan-printer-updated", { detail: value }));
}

export async function loadPrinterSettings() {
  const local = getPrinterSettings();
  try { const response = await fetch("/api/printer-settings", { cache: "no-store" }); const result = await response.json().catch(() => ({})); if (response.ok && result.ok) { const {mode,identifier,model,...shared}=result.value||{}; const next = { ...local, ...shared }; savePrinterSettings(next); return next; } } catch {}
  return local;
}

export async function syncPrinterSettings(value) {
  savePrinterSettings(value);
  const response = await fetch("/api/printer-settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({printerLogoUrl:value.printerLogoUrl||""}) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || "Không thể lưu cài đặt máy in lên Supabase.");
  const next={...value,printerLogoUrl:result.value?.printerLogoUrl??value.printerLogoUrl};
  savePrinterSettings(next);
  return next;
}

export function currentPrinterCapabilities() {
 if(typeof navigator==="undefined")return printerCapabilities();
 return printerCapabilities({userAgent:navigator.userAgent,maxTouchPoints:navigator.maxTouchPoints,usb:Boolean(navigator.usb),secure:typeof window!=="undefined"&&window.isSecureContext});
}
export function supportsStarUsb(){return currentPrinterCapabilities().usb;}
export function isStarWebPrntBrowser() {
  return typeof navigator !== "undefined" && /StarWebPRNTBrowser\//i.test(navigator.userAgent);
}

let webPrntScripts;
function loadWebPrntScripts() {
  if (typeof window === "undefined") return Promise.reject(new Error("Trình duyệt không hỗ trợ in."));
  if (window.StarWebPrintBuilder && window.StarWebPrintTrader) return Promise.resolve();
  if (!webPrntScripts) webPrntScripts = ["StarWebPrintBuilder", "StarWebPrintTrader"].reduce((previous, name) => previous.then(() => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `/vendor/star-webprnt/${name}.js`;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Không tải được Star webPRNT SDK: ${name}.`));
    document.head.appendChild(script);
  })), Promise.resolve()).catch((error) => { webPrntScripts = null; throw error; });
  return webPrntScripts;
}

export async function printWebPrntReceipt(sale, store, { openDrawer = false, documentType = "receipt" } = {}) {
  if (!isStarWebPrntBrowser()) throw new Error("Hãy mở website trong ứng dụng Star webPRNT Browser để in qua Bluetooth.");
  await loadWebPrntScripts();
  const builder = new window.StarWebPrintBuilder();
  const text = (data, extra = {}) => builder.createTextElement({ codepage: "utf8", data: String(data || ""), ...extra });
  let request = builder.createInitializationElement();
  request += builder.createAlignmentElement({ position: "center" });
  request += text(`${store?.salonName || "Mai Beauty Salon"}\n`, { emphasis: true });
  request += text(`${store?.address || ""}\n${store?.phone || ""}\n`);
  request += text(`${documentType === "ryoshusho" ? "領収書" : "レシート"}\n`);
  request += builder.createAlignmentElement({ position: "left" });
  request += text(`--------------------------------\n${sale.orderNumber || sale.receiptNumber || "POS"}\n${new Date(sale.issuedAt || Date.now()).toLocaleString("ja-JP")}\n--------------------------------\n`);
  for (const item of sale.lines || []) {
    request += text(`${item.name || ""} × ${item.quantity || 1}\n`);
    request += text(line("", amount(Number(item.unitPrice || 0) * Number(item.quantity || 1) - Number(item.discountValue || 0))));
  }
  request += text("--------------------------------\n");
  request += text(line("合計", amount(sale.total)), { emphasis: true });
  request += text(line("お支払い", amount(sale.paid)));
  request += text(line("お釣り", amount(sale.change)));
  request += text(`${sale.paymentMethodText || ""}\n`);
  request += builder.createAlignmentElement({ position: "center" });
  request += text("Thank you / ありがとうございました\n");
  request += builder.createFeedElement({ line: 2 });
  if (openDrawer) request += builder.createPeripheralElement({ channel: 1, on: 200, off: 200 });
  request += builder.createCutPaperElement({ type: "partial", feed: true });
  return new Promise((resolve, reject) => {
    const trader = new window.StarWebPrintTrader({ url: "http://localhost:8001/StarWebPRNT/SendMessage", timeout: 30000 });
    trader.onReceive = (response) => {
      if (String(response.traderSuccess).toLowerCase() !== "true" || trader.isOffLine({ traderStatus: response.traderStatus }) || trader.isPaperEnd({ traderStatus: response.traderStatus })) reject(new Error(`Star mPOP chưa in được: ${response.traderCode || "offline / hết giấy"}.`));
      else resolve({ printed: true });
    };
    trader.onError = (response) => reject(new Error(`Không kết nối được Star mPOP (${response.status || "connection"}).`));
    trader.onTimeout = () => reject(new Error("Star mPOP không phản hồi trong 30 giây."));
    try { trader.sendMessage({ request }); } catch (error) { reject(error); }
  });
}

export async function discoverStarUsb() {
  if (!supportsStarUsb()) throw new Error("WebUSB is not supported in this browser.");
  const { StarDeviceDiscoveryManager, InterfaceType } = await import("star-io10-web/src/index.js");
  const manager = new StarDeviceDiscoveryManager(InterfaceType.Usb);
  let result = null;
  manager.onPrinterFound = async (printer) => {
    const information = await printer.getInformation();
    result = { mode: "star-usb", identifier: printer.connectionSettings.identifier || "", model: String(information.model || "mPOP") };
    await printer.dispose();
  };
  await manager.discover();
  if (!result) throw new Error("No Star printer was selected.");
  savePrinterSettings(result);
  return result;
}

function amount(value) { return `JPY ${Math.round(Number(value || 0)).toLocaleString("ja-JP")}`; }
function line(name, value, width = 32) {
  const left = String(name || "").slice(0, 20);
  const right = String(value || "");
  return `${left}${" ".repeat(Math.max(1, width - left.length - right.length))}${right}\n`;
}

async function receiptCommands(sale, store, openDrawer) {
  const { StarXpandCommand } = await import("star-io10-web/src/index.js");
  const printer = new StarXpandCommand.PrinterBuilder()
    .styleAlignment(StarXpandCommand.Printer.Alignment.Center)
    .styleBold(true)
    .actionPrintText(`${store?.salonName || "Mai Beauty Salon"}\n`)
    .styleBold(false)
    .actionPrintText(`${store?.address || ""}\n${store?.phone || ""}\n`)
    .actionPrintText("--------------------------------\n")
    .styleAlignment(StarXpandCommand.Printer.Alignment.Left)
    .actionPrintText(`${sale.orderNumber || sale.receiptNumber || "POS"}\n`)
    .actionPrintText(`${new Date(sale.issuedAt || Date.now()).toLocaleString("ja-JP")}\n`)
    .actionPrintText("--------------------------------\n");
  for (const item of sale.lines || []) {
    printer.actionPrintText(`${item.name} x ${item.quantity || 1}\n`);
    printer.actionPrintText(line("", amount(Number(item.unitPrice || 0) * Number(item.quantity || 1) - Number(item.discountValue || 0))));
  }
  printer.actionPrintText("--------------------------------\n")
    .styleBold(true).actionPrintText(line("合計", amount(sale.total))).styleBold(false)
    .actionPrintText(line("お支払い", amount(sale.paid)))
    .actionPrintText(line("お釣り", amount(sale.change)))
    .actionPrintText(`${sale.paymentMethodText || ""}\n`)
    .styleAlignment(StarXpandCommand.Printer.Alignment.Center)
    .actionFeedLine(1).actionPrintText("Thank you / ありがとうございました\n")
    .actionFeedLine(2).actionCut(StarXpandCommand.Printer.CutType.Partial);
  let document = new StarXpandCommand.DocumentBuilder().settingPrintableArea(48).addPrinter(printer);
  if (openDrawer) document = document.addDrawer(new StarXpandCommand.DrawerBuilder().actionOpen(new StarXpandCommand.Drawer.OpenParameter().setChannel(StarXpandCommand.Drawer.Channel.No1)));
  return new StarXpandCommand.StarXpandCommandBuilder().addDocument(document).getCommands();
}

export async function printStarReceipt(sale, store, { openDrawer = false, documentType = "receipt" } = {}) {
  const saved = getPrinterSettings();
  if (saved.mode === "webprnt") return printWebPrntReceipt(sale, store, { openDrawer, documentType });
  if(saved.mode === "passprnt") {
    const html=passPrntReceiptHtml(sale,store,documentType);
    const url=passPrntUrl(html,window.location.href,openDrawer);
    window.sessionStorage.setItem("nail-japan-print-return-page",window.sessionStorage.getItem("nail-japan-active-page")||"POS / Checkout");
    window.location.assign(url);
    return {handedOff:true};
  }
  if (saved.mode !== "star-usb" || !saved.identifier) throw new Error("Star USB printer is not connected.");
  const { StarPrinterFactory, StarConnectionSettings, InterfaceType } = await import("star-io10-web/src/index.js");
  const connection = new StarConnectionSettings();
  connection.interfaceType = InterfaceType.Usb;
  connection.identifier = saved.identifier;
  const factory = new StarPrinterFactory();
  const printer = factory.createStarPrinter(connection);
  try {
    await printer.open();
    await printer.print(await receiptCommands(sale, store, openDrawer));
  } finally {
    try { await printer.close(); } catch {}
    await printer.dispose();
    factory.dispose();
  }
}

export function openWebPrnt() {
  const target = encodeURIComponent(window.location.href);
  window.location.href = `webprnt://starmicronics.com/open?url=${target}`;
}
