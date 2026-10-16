"use client";

import { useEffect, useMemo, useState } from "react";
import { tx } from "../lib/i18nClean";
import { getSharedPosSales, getStoredPosSales, saveSharedPosSales } from "./Checkout";
import PrinterManager from "./PrinterManager";
import { getPrinterSettings, printStarReceipt } from "../lib/starPrinter";
import { staff } from "../lib/salonData";

function yen(value) {
  return `JPY ${Math.round(Number(value || 0)).toLocaleString("ja-JP")}`;
}

const copy = {
  vi: {
    title: "Lịch sử thanh toán",
    desc: "Chỉ hiển thị các giao dịch đã tạo tại quầy POS, tách biệt hoàn toàn với đơn khách đặt.",
    count: "Giao dịch",
    revenue: "Tổng thanh toán",
    customer: "Khách hàng",
    code: "Mã hóa đơn",
    time: "Thời gian",
    method: "Phương thức",
    status: "Trạng thái",
    total: "Tổng tiền",
    empty: "Chưa có giao dịch thanh toán.",
    detail: "Chi tiết thanh toán",
    received: "Đã nhận",
    remaining: "Còn lại",
    change: "Tiền trả lại",
    items: "Dịch vụ / sản phẩm",
    reprint: "In lại hóa đơn",
    printing: "Đang in...",
    printError: "Không thể in trực tiếp, đã mở cửa sổ in.",
  },
  ja: {
    title: "支払い履歴",
    desc: "POSで作成した支払いのみを表示し、顧客注文とは完全に分けて管理します。",
    count: "取引件数",
    revenue: "支払い合計",
    customer: "顧客",
    code: "レシート番号",
    time: "日時",
    method: "支払い方法",
    status: "状態",
    total: "合計",
    empty: "支払い履歴はまだありません。",
    detail: "支払い詳細",
    received: "受取済み",
    remaining: "残額",
    change: "お釣り",
    items: "サービス・商品",
    reprint: "レシート再印刷",
    printing: "印刷中...",
    printError: "直接印刷できないため、印刷画面を開きました。",
  },
  en: {
    title: "Payment history",
    desc: "Shows POS transactions only, kept completely separate from customer orders.",
    count: "Transactions",
    revenue: "Total payments",
    customer: "Customer",
    code: "Receipt number",
    time: "Date and time",
    method: "Payment method",
    status: "Status",
    total: "Total",
    empty: "No payment history yet.",
    detail: "Payment details",
    received: "Received",
    remaining: "Remaining",
    change: "Change",
    items: "Services / products",
    reprint: "Reprint receipt",
    printing: "Printing...",
    printError: "Direct printing failed; the system print dialog was opened.",
  },
};

export default function PaymentHistory({ language = "vi" }) {
  const c = copy[language] || copy.vi;
  const actionText = language === "en" ? { edit: "Edit payment", save: "Save payment", staff: "Staff", choose: "Select staff", cancelled: "Cancelled - excluded from revenue", receipt: "Print receipt" } : language === "ja" ? { edit: "支払いを修正", save: "支払いを保存", staff: "スタッフ", choose: "スタッフを選択", cancelled: "キャンセル済み - 売上対象外", receipt: "領収書を印刷" } : { edit: "Sửa thanh toán", save: "Lưu thanh toán", staff: "Nhân viên", choose: "Chọn nhân viên", cancelled: "Đã hủy - không tính doanh số", receipt: "In 領収書" };
  const [sales, setSales] = useState(() => getStoredPosSales());
  const [selectedId, setSelectedId] = useState("");
  const [printing, setPrinting] = useState(false);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [editStaff, setEditStaff] = useState("");
  const [editTotal, setEditTotal] = useState("");
  const selected = sales.find((sale) => sale.id === selectedId) || sales.find((sale) => !sale.voided) || sales[0];
  const activeSales = useMemo(() => sales.filter((sale) => !sale.voided), [sales]);
  const revenue = useMemo(
    () => activeSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
    [activeSales],
  );

  useEffect(() => {
    let mounted = true;
    const refresh = () => getSharedPosSales().then((remote) => {
      if (!mounted) return;
      setSales(remote);
      localStorage.setItem("nail-japan-pos-sales", JSON.stringify(remote));
    }).catch(() => {});
    refresh();
    const timer = window.setInterval(refresh, 5000);
    function sync(event) {
      setSales(
        Array.isArray(event.detail) ? event.detail : getStoredPosSales(),
      );
    }
    window.addEventListener("nail-japan-pos-sales-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.removeEventListener("nail-japan-pos-sales-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (selected) { setEditStaff(selected.staff || ""); setEditTotal(String(selected.total || "")); setEditing(false); }
  }, [selected?.id]);

  function saveEditedPayment() {
    if (!selected || !editStaff) { setNotice(actionText.choose); return; }
    const total = Math.max(0, Number(editTotal || 0));
    const received = Number(selected.cashReceived || selected.paid || total);
    const replacement = { ...selected, id: `${selected.id}-edit-${Date.now()}`, orderNumber: `${selected.orderNumber || selected.receiptNumber}-E`, total, paid: Math.min(Number(selected.paid || total), total), remaining: Math.max(0, total - Number(selected.paid || total)), change: Math.max(0, received - total), cashReceived: received, staff: editStaff, editedBy: editStaff, editedFrom: selected.id, editedAt: new Date().toISOString(), voided: false };
    const next = [...sales.map((sale) => sale.id === selected.id ? { ...sale, voided: true, voidedAt: new Date().toISOString(), voidedBy: editStaff } : sale), replacement];
    localStorage.setItem("nail-japan-pos-sales", JSON.stringify(next));
    saveSharedPosSales(next).catch(() => setNotice("Không thể đồng bộ thay đổi lên server."));
    window.dispatchEvent(new CustomEvent("nail-japan-pos-sales-updated", { detail: next }));
    setSales(next); setSelectedId(replacement.id); setEditing(false); setNotice(actionText.save);
  }

  async function reprintReceipt() {
    if (!selected || printing) return;
    setPrinting(true);
    setNotice("");
    if (getPrinterSettings().mode === "star-usb") {
      try {
        await printStarReceipt(selected, selected.storeSnapshot || {}, {
          openDrawer: false,
        });
        setNotice("Star mPOP: OK");
        setPrinting(false);
        return;
      } catch {
        setNotice(c.printError);
      }
    }
    window.print();
    setPrinting(false);
  }

  return (
    <>
      <div className="pageHead">
        <div>
          <p className="eyebrow">PAYMENT HISTORY</p>
          <h1>{c.title}</h1>
          <p>{c.desc}</p>
        </div>
        <PrinterManager language={language} />
      </div>
      <div className="stats paymentHistoryStats">
        <div className="stat card">
          <span>{c.count}</span>
          <strong>{activeSales.length}</strong>
        </div>
        <div className="stat card">
          <span>{c.revenue}</span>
          <strong>{yen(revenue)}</strong>
        </div>
      </div>
      <div className="paymentHistoryWorkspace">
        <section className="card tableWrap paymentHistoryTable">
          <table>
            <thead>
              <tr>
                <th>{c.code}</th>
                <th>{c.customer}</th>
                <th>{c.time}</th>
                <th>{c.method}</th>
                <th>{c.status}</th>
                <th>{c.total}</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr
                  key={sale.id}
                  className={`${selected?.id === sale.id ? "selectedOrderRow" : ""} ${sale.voided ? "voidedPaymentRow" : ""}`}
                  onClick={() => setSelectedId(sale.id)}
                >
                  <td>
                    <strong>
                      {sale.orderNumber || sale.receiptNumber || "POS"}
                    </strong>
                  </td>
                  <td>{sale.customer || "-"}</td>
                  <td>
                    {new Date(
                      sale.issuedAt || sale.createdAt || Date.now(),
                    ).toLocaleString("ja-JP")}
                  </td>
                  <td>{sale.paymentMethodText || "-"}</td>
                  <td>
                    <span className="pill active">
                      {sale.voided ? actionText.cancelled : sale.paymentStatus || "-"}
                    </span>
                  </td>
                  <td>
                    <strong>{yen(sale.total)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sales.length && <p className="paymentHistoryEmpty">{c.empty}</p>}
        </section>
        {selected && (
          <aside className="card paymentHistoryDetail">
            <div className="sectionTitle">
              <div>
                <span className="eyebrow">{c.detail}</span>
                <h2>{selected.orderNumber || selected.receiptNumber}</h2>
              </div>
              <span className="pill active">{selected.paymentStatus}</span>
            </div>
            <button
              type="button"
              className="primary paymentHistoryPrint"
              onClick={reprintReceipt}
              disabled={printing}
            >
              {printing ? c.printing : c.reprint}
            </button>
            {!selected.voided && <div className="paymentHistoryActions"><button type="button" className="ghost" onClick={() => { setNotice(""); window.print(); }}>{actionText.receipt}</button><button type="button" className="ghost" onClick={() => setEditing((value) => !value)}>{actionText.edit}</button></div>}
            {editing && !selected.voided && <div className="paymentEditBox"><label>{actionText.staff}<select value={editStaff} onChange={(event) => setEditStaff(event.target.value)}><option value="">{actionText.choose}</option>{staff.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}</select></label><label>{c.total}<input type="number" min="0" value={editTotal} onChange={(event) => setEditTotal(event.target.value)} /></label><button type="button" className="primary" onClick={saveEditedPayment}>{actionText.save}</button></div>}
            {notice && <p className="printerNotice">{notice}</p>}
            <div className="orderInfoGrid">
              {selected.editedBy && <div><span>修正者</span><strong>{selected.editedBy}</strong></div>}
              <div>
                <span>{c.customer}</span>
                <strong>{selected.customer || "-"}</strong>
              </div>
              <div>
                <span>{c.method}</span>
                <strong>{selected.paymentMethodText || "-"}</strong>
              </div>
              <div>
                <span>{c.received}</span>
                <strong>{yen(selected.paid)}</strong>
              </div>
              <div>
                <span>{c.remaining}</span>
                <strong>
                  {yen(
                    Math.max(
                      0,
                      Number(selected.total || 0) - Number(selected.paid || 0),
                    ),
                  )}
                </strong>
              </div>
              <div>
                <span>{c.change}</span>
                <strong>{yen(selected.change)}</strong>
              </div>
              <div>
                <span>{c.total}</span>
                <strong>{yen(selected.total)}</strong>
              </div>
            </div>
            <h3>{c.items}</h3>
            <div className="paymentHistoryLines">
              {(selected.lines || []).map((line) => (
                <p key={line.id}>
                  <span>
                    {line.name} × {line.quantity || 1}
                  </span>
                  <strong>
                    {yen(
                      Number(line.unitPrice || 0) * Number(line.quantity || 1) -
                        Number(line.discountValue || 0),
                    )}
                  </strong>
                </p>
              ))}
            </div>
            <div className="printDocument active paymentHistoryPrintDocument">
              <div className="printPaper">
                <div className="printStore">
                  <strong>
                    {selected.storeSnapshot?.salonName || "Mai Beauty Salon"}
                  </strong>
                  <span>{selected.storeSnapshot?.address || ""}</span>
                </div>
                <div className="printMeta">
                  <span>
                    {new Date(selected.issuedAt || Date.now()).toLocaleString(
                      "ja-JP",
                    )}
                  </span>
                  <span>#{selected.receiptNumber || selected.orderNumber}</span>
                </div>
                <div className="printItems">
                  {(selected.lines || []).map((line) => (
                    <p key={line.id}>
                      <span>
                        {line.name} × {line.quantity || 1}
                      </span>
                      <strong>
                        {yen(
                          Number(line.unitPrice || 0) *
                            Number(line.quantity || 1) -
                            Number(line.discountValue || 0),
                        )}
                      </strong>
                    </p>
                  ))}
                </div>
                <div className="printRule" />
                <p className="printTotal">
                  <span>{c.total}</span>
                  <strong>{yen(selected.total)}</strong>
                </p>
                <p>
                  <span>{c.method}</span>
                  <strong>{selected.paymentMethodText || "-"}</strong>
                </p>
              </div>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
