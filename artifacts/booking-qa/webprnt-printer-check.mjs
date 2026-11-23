import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { printWebPrntReceipt } from "../../lib/starPrinter.js";

const context = {};
vm.runInNewContext(fs.readFileSync("public/vendor/star-webprnt/StarWebPrintBuilder.js", "utf8"), context);
let lastRequest = "";
class FakeTrader {
  constructor(options) { assert.equal(options.url, "http://localhost:8001/StarWebPRNT/SendMessage"); }
  sendMessage({ request }) { lastRequest = request; this.onReceive({ traderSuccess: "true", traderStatus: "0000000000000000" }); }
  isOffLine() { return false; }
  isPaperEnd() { return false; }
}
globalThis.window = { StarWebPrintBuilder: context.StarWebPrintBuilder, StarWebPrintTrader: FakeTrader };
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { userAgent: "iPad StarWebPRNTBrowser/3.6.0" } });
const sale = { orderNumber: "TEST-001", lines: [{ name: "テスト", quantity: 1, unitPrice: 1200 }], total: 1200, paid: 1200, change: 0 };
await printWebPrntReceipt(sale, { salonName: "Mai Beauty Salon" }, { openDrawer: false });
assert.match(lastRequest, /TEST-001/);
assert.match(lastRequest, /<cutpaper/);
assert.doesNotMatch(lastRequest, /<peripheral/);
await printWebPrntReceipt(sale, {}, { openDrawer: true });
assert.match(lastRequest, /<peripheral channel="1"/);
console.log("PASS official Star webPRNT SDK builds receipt, cut and optional drawer command");
