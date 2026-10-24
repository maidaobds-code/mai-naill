"use client";

import { useEffect, useMemo, useState } from "react";
import { tx } from "../lib/i18nClean";
import { getSharedPosSales, getStoredPosSales, saveSharedPosSales } from "./Checkout";
import PrinterManager from "./PrinterManager";
import { getPrinterSettings, printStarReceipt } from "../lib/starPrinter";
import { staff } from "../lib/salonData";
import { useStaffStore } from "../lib/staffStore";

function yen(value) {
  return `JPY ${Math.round(Number(value || 0)).toLocaleString("ja-JP")}`;
}

const copy = {
  zh: { title: "付款记录", desc: "仅显示POS交易，与客户订单完全分开。", count: "交易", revenue: "付款总额", customer: "客户", code: "收据编号", time: "日期和时间", method: "付款方式", status: "状态", total: "合计", empty: "暂无付款记录。", detail: "付款详情", received: "已收款", remaining: "剩余", change: "找零", items: "服务 / 商品", reprint: "重新打印收据", printing: "正在打印...", printError: "无法直接打印，已打开系统打印窗口。" },
  ko: { title: "결제 내역", desc: "POS 거래만 표시하며 고객 주문과 완전히 분리됩니다.", count: "거래", revenue: "총 결제액", customer: "고객", code: "영수증 번호", time: "날짜 및 시간", method: "결제 방법", status: "상태", total: "합계", empty: "결제 내역이 없습니다.", detail: "결제 상세", received: "받은 금액", remaining: "잔액", change: "거스름돈", items: "서비스 / 상품", reprint: "영수증 재인쇄", printing: "인쇄 중...", printError: "직접 인쇄할 수 없어 시스템 인쇄 창을 열었습니다." },
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
  const [printMode, setPrintMode] = useState("receipt");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [editStaff, setEditStaff] = useState("");
  const [editTotal, setEditTotal] = useState("");
  const [editLines, setEditLines] = useState([]);
  const [editPaymentMethod, setEditPaymentMethod] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const { staff: syncedStaff } = useStaffStore();
  const staffList = syncedStaff.length ? syncedStaff : staff;
  const paymentChoices = ["現金", "クレジットカード", "銀行振込", "アプリ決済"];
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
    if (selected) { setEditStaff(selected.staff || ""); setEditPassword(""); setEditTotal(String(selected.total || "")); setEditLines((selected.lines || []).map((line) => ({ ...line }))); setEditPaymentMethod(selected.paymentMethodText || "現金"); setEditing(false); }
  }, [selected?.id]);

  async function saveEditedPayment() {
    if (!selected || !editStaff) { setNotice(actionText.choose); return; }
    const editor = staffList.find((member) => member.name === editStaff);
    if (!editor?.email || !editPassword) { setNotice("Vui lòng chọn nhân viên và nhập mật khẩu."); return; }
    const auth = await fetch("/api/staff-login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: editor.email, password: editPassword }) }).then(async (response) => ({ ok: response.ok, data: await response.json().catch(() => ({})) })).catch(() => ({ ok: false }));
    if (!auth.ok) { setNotice("Mật khẩu nhân viên không đúng."); return; }
    const lines = editLines.filter((line) => String(line.name || "").trim()).map((line, index) => ({ ...line, id: line.id || `edited-line-${Date.now()}-${index}`, name: String(line.name).trim(), quantity: Math.max(1, Number(line.quantity || 1)), unitPrice: Math.max(0, Number(line.unitPrice || 0)), discountValue: Math.max(0, Number(line.discountValue || 0)) }));
    const calculatedTotal = lines.reduce((sum, line) => sum + (line.unitPrice * line.quantity) - line.discountValue, 0);
    const total = Math.max(0, Number(editTotal || calculatedTotal));
    const received = Number(selected.cashReceived || selected.paid || total);
    const replacement = { ...selected, id: `${selected.id}-edit-${Date.now()}`, orderNumber: `${selected.orderNumber || selected.receiptNumber}-E`, lines, total, paid: Math.min(Number(selected.paid || total), total), remaining: Math.max(0, total - Number(selected.paid || total)), change: Math.max(0, received - total), cashReceived: received, paymentMethodText: editPaymentMethod, paymentMethods: [{ method: editPaymentMethod, label: editPaymentMethod, amount: Math.min(Number(selected.paid || total), total) }], staff: editStaff, editedBy: editStaff, editedFrom: selected.id, editedAt: new Date().toISOString(), voided: false };
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
    setPrintMode("receipt");
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
            {!selected.voided && <div className="paymentHistoryActions"><button type="button" className="ghost" onClick={() => { setNotice(""); setPrintMode("receipt"); window.setTimeout(() => window.print(), 80); }}>{actionText.receipt}</button><button type="button" className="ghost" onClick={() => { setNotice(""); setPrintMode("ryoshusho"); window.setTimeout(() => window.print(), 80); }}>領収書を印刷</button><button type="button" className="ghost" onClick={() => setEditing((value) => !value)}>{actionText.edit}</button></div>}
            {editing && !selected.voided && <div className="paymentEditBox"><label>{actionText.staff}<select value={editStaff} onChange={(event) => { setEditStaff(event.target.value); setEditPassword(""); }}><option value="">{actionText.choose}</option>{staffList.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}</select></label><label>Mật khẩu nhân viên<input type="password" value={editPassword} onChange={(event) => setEditPassword(event.target.value)} autoComplete="current-password" /></label><label>支払方法<select value={editPaymentMethod} onChange={(event) => setEditPaymentMethod(event.target.value)}>{paymentChoices.map((method) => <option key={method}>{method}</option>)}</select></label><div className="paymentEditLines">{editLines.map((line, index) => <div className="paymentEditLine" key={line.id || index}><input value={line.name || ""} placeholder="サービス / 商品" onChange={(event) => setEditLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /><input type="number" min="1" value={line.quantity || 1} onChange={(event) => setEditLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))} /><input type="number" min="0" value={line.unitPrice || 0} onChange={(event) => setEditLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, unitPrice: event.target.value } : item))} /><button type="button" className="ghost" onClick={() => setEditLines((current) => current.filter((_, itemIndex) => itemIndex !== index))}>削除</button></div>)}</div><button type="button" className="ghost" onClick={() => setEditLines((current) => [...current, { id: `new-line-${Date.now()}`, name: "", quantity: 1, unitPrice: 0, discountValue: 0 }])}>＋サービス・商品を追加</button><label>{c.total}<input type="number" min="0" value={editTotal} onChange={(event) => setEditTotal(event.target.value)} /></label><button type="button" className="primary" onClick={saveEditedPayment}>{actionText.save}</button></div>}
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
            <div className={`printDocument ${printMode === "receipt" ? "active" : ""} paymentHistoryPrintDocument`}>
              <div className="printPaper">
                <div className="printStore">
                  {selected.storeSnapshot?.logoUrl && <img className="printLogo" src={selected.storeSnapshot.logoUrl} alt={selected.storeSnapshot?.salonName || "Mai Beauty Salon"} />}
                  <strong>
                    {selected.storeSnapshot?.salonName || "Mai Beauty Salon"}
                  </strong>
                  <span>{selected.storeSnapshot?.address || ""}</span>
                  <span>{selected.storeSnapshot?.phone || ""}</span>
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
                <p><span>Đã nhận</span><strong>{yen(selected.cashReceived || selected.paid)}</strong></p>
                <p><span>Còn thiếu</span><strong>{yen(Math.max(0, Number(selected.total || 0) - Number(selected.paid || 0)))}</strong></p>
                <p><span>Tiền thừa</span><strong>{yen(selected.change)}</strong></p>
              </div>
            </div>
            <div className={`printDocument ${printMode === "ryoshusho" ? "active" : ""} paymentHistoryPrintDocument printRyoshusho`}>
              <div className="printPaper">
                <div className="printStore">
                  {selected.storeSnapshot?.logoUrl && <img className="printLogo" src={selected.storeSnapshot.logoUrl} alt={selected.storeSnapshot?.salonName || "Mai Beauty Salon"} />}
                  <strong>{selected.storeSnapshot?.salonName || "Mai Beauty Salon"}</strong>
                  <span>{selected.storeSnapshot?.address || ""}</span>
                  <span>{selected.storeSnapshot?.phone || ""}</span>
                </div>
                <h3>領収書</h3>
                <p className="printRecipient"><span>{selected.customer || ""}</span><strong>様</strong></p>
                <div className="printRule" />
                <p><span>{new Date(selected.issuedAt || Date.now()).toLocaleDateString("ja-JP")}</span><strong>{selected.paymentMethodText || "現金"}</strong></p>
                <div className="printRule" />
                <p><span>小計</span><strong>{yen((selected.lines || []).reduce((sum, line) => sum + Number(line.unitPrice || 0) * Number(line.quantity || 1) - Number(line.discountValue || 0), 0))}</strong></p>
                <p className="printTotal"><span>合計</span><strong>{yen(selected.total)}</strong></p>
                <p><span>但し書き</span><strong>ネイルサービス代として</strong></p>
                <small>領収書番号: {selected.receiptNumber || selected.orderNumber}</small>
              </div>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
