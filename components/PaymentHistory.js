"use client";

import { useEffect, useMemo, useState } from "react";
import { tx } from "../lib/i18nClean";
import { getStoredPosSales } from "./Checkout";
import PrinterManager from "./PrinterManager";
import { getPrinterSettings, printStarReceipt } from "../lib/starPrinter";

function yen(value) {
  return `JPY ${Math.round(Number(value || 0)).toLocaleString("ja-JP")}`;
}

const copy = {
  vi: { title: "Lịch sử thanh toán", desc: "Chỉ hiển thị các giao dịch đã tạo tại quầy POS, tách biệt hoàn toàn với đơn khách đặt.", count: "Giao dịch", revenue: "Tổng thanh toán", customer: "Khách hàng", code: "Mã hóa đơn", time: "Thời gian", method: "Phương thức", status: "Trạng thái", total: "Tổng tiền", empty: "Chưa có giao dịch thanh toán.", detail: "Chi tiết thanh toán", received: "Đã nhận", remaining: "Còn lại", change: "Tiền trả lại", items: "Dịch vụ / sản phẩm", reprint: "In lại hóa đơn", printing: "Đang in...", printError: "Không thể in trực tiếp, đã mở cửa sổ in." },
  ja: { title: "支払い履歴", desc: "POSで作成した支払いのみを表示し、顧客注文とは完全に分けて管理します。", count: "取引件数", revenue: "支払い合計", customer: "顧客", code: "レシート番号", time: "日時", method: "支払い方法", status: "状態", total: "合計", empty: "支払い履歴はまだありません。", detail: "支払い詳細", received: "受取済み", remaining: "残額", change: "お釣り", items: "サービス・商品", reprint: "レシート再印刷", printing: "印刷中...", printError: "直接印刷できないため、印刷画面を開きました。" },
  en: { title: "Payment history", desc: "Shows POS transactions only, kept completely separate from customer orders.", count: "Transactions", revenue: "Total payments", customer: "Customer", code: "Receipt number", time: "Date and time", method: "Payment method", status: "Status", total: "Total", empty: "No payment history yet.", detail: "Payment details", received: "Received", remaining: "Remaining", change: "Change", items: "Services / products", reprint: "Reprint receipt", printing: "Printing...", printError: "Direct printing failed; the system print dialog was opened." },
};

export default function PaymentHistory({ language = "vi" }) {
  const c = copy[language] || copy.vi;
  const [sales, setSales] = useState(() => getStoredPosSales());
  const [selectedId, setSelectedId] = useState("");
  const [printing, setPrinting] = useState(false);
  const [notice, setNotice] = useState("");
  const selected = sales.find((sale) => sale.id === selectedId) || sales[0];
  const revenue = useMemo(() => sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0), [sales]);

  useEffect(() => {
    function sync(event) {
      setSales(Array.isArray(event.detail) ? event.detail : getStoredPosSales());
    }
    window.addEventListener("nail-japan-pos-sales-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("nail-japan-pos-sales-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  async function reprintReceipt() {
    if (!selected || printing) return;
    setPrinting(true); setNotice("");
    if (getPrinterSettings().mode === "star-usb") {
      try { await printStarReceipt(selected, selected.storeSnapshot || {}, { openDrawer: false }); setNotice("Star mPOP: OK"); setPrinting(false); return; }
      catch { setNotice(c.printError); }
    }
    window.print();
    setPrinting(false);
  }

  return <>
    <div className="pageHead"><div><p className="eyebrow">PAYMENT HISTORY</p><h1>{c.title}</h1><p>{c.desc}</p></div><PrinterManager language={language} /></div>
    <div className="stats paymentHistoryStats">
      <div className="stat card"><span>{c.count}</span><strong>{sales.length}</strong></div>
      <div className="stat card"><span>{c.revenue}</span><strong>{yen(revenue)}</strong></div>
    </div>
    <div className="paymentHistoryWorkspace">
      <section className="card tableWrap paymentHistoryTable"><table><thead><tr><th>{c.code}</th><th>{c.customer}</th><th>{c.time}</th><th>{c.method}</th><th>{c.status}</th><th>{c.total}</th></tr></thead><tbody>
        {sales.map((sale) => <tr key={sale.id} className={selected?.id === sale.id ? "selectedOrderRow" : ""} onClick={() => setSelectedId(sale.id)}><td><strong>{sale.orderNumber || sale.receiptNumber || "POS"}</strong></td><td>{sale.customer || "-"}</td><td>{new Date(sale.issuedAt || sale.createdAt || Date.now()).toLocaleString("ja-JP")}</td><td>{sale.paymentMethodText || "-"}</td><td><span className="pill active">{sale.paymentStatus || "-"}</span></td><td><strong>{yen(sale.total)}</strong></td></tr>)}
      </tbody></table>{!sales.length && <p className="paymentHistoryEmpty">{c.empty}</p>}</section>
      {selected && <aside className="card paymentHistoryDetail"><div className="sectionTitle"><div><span className="eyebrow">{c.detail}</span><h2>{selected.orderNumber || selected.receiptNumber}</h2></div><span className="pill active">{selected.paymentStatus}</span></div><button type="button" className="primary paymentHistoryPrint" onClick={reprintReceipt} disabled={printing}>{printing ? c.printing : c.reprint}</button>{notice && <p className="printerNotice">{notice}</p>}<div className="orderInfoGrid"><div><span>{c.customer}</span><strong>{selected.customer || "-"}</strong></div><div><span>{c.method}</span><strong>{selected.paymentMethodText || "-"}</strong></div><div><span>{c.received}</span><strong>{yen(selected.paid)}</strong></div><div><span>{c.remaining}</span><strong>{yen(Math.max(0, Number(selected.total || 0) - Number(selected.paid || 0)))}</strong></div><div><span>{c.change}</span><strong>{yen(selected.change)}</strong></div><div><span>{c.total}</span><strong>{yen(selected.total)}</strong></div></div><h3>{c.items}</h3><div className="paymentHistoryLines">{(selected.lines || []).map((line) => <p key={line.id}><span>{line.name} × {line.quantity || 1}</span><strong>{yen(Number(line.unitPrice || 0) * Number(line.quantity || 1) - Number(line.discountValue || 0))}</strong></p>)}</div><div className="printDocument active paymentHistoryPrintDocument"><div className="printPaper"><div className="printStore"><strong>{selected.storeSnapshot?.salonName || "Mai Beauty Salon"}</strong><span>{selected.storeSnapshot?.address || ""}</span></div><div className="printMeta"><span>{new Date(selected.issuedAt || Date.now()).toLocaleString("ja-JP")}</span><span>#{selected.receiptNumber || selected.orderNumber}</span></div><div className="printItems">{(selected.lines || []).map((line) => <p key={line.id}><span>{line.name} × {line.quantity || 1}</span><strong>{yen(Number(line.unitPrice || 0) * Number(line.quantity || 1) - Number(line.discountValue || 0))}</strong></p>)}</div><div className="printRule"/><p className="printTotal"><span>{c.total}</span><strong>{yen(selected.total)}</strong></p><p><span>{c.method}</span><strong>{selected.paymentMethodText || "-"}</strong></p></div></div></aside>}
    </div>
  </>;
}
