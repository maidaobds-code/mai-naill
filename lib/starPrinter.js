"use client";

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

export function supportsStarUsb() {
  return typeof navigator !== "undefined" && Boolean(navigator.usb) && /Chrome|Chromium|Edg|Android/i.test(navigator.userAgent);
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

export async function printStarReceipt(sale, store, { openDrawer = false } = {}) {
  const saved = getPrinterSettings();
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
