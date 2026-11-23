"use client";

import { orders } from "../lib/ecommerce/data";
import { useBookingStore } from "../lib/bookingStore";
import { getStoredPosSales } from "./Checkout";
import { useEffect, useMemo, useState } from "react";

const currentWeek = [68000, 74000, 82500, 79000, 91000, 126000, 118000];
const previousWeek = [61000, 70000, 76000, 72000, 84000, 111000, 103000];
const currentMonth = [420000, 455000, 490000, 530000, 575000, 620000];
const previousMonth = [380000, 410000, 430000, 470000, 498000, 540000];

function yen(value) {
  return `JPY ${Math.round(value).toLocaleString("ja-JP")}`;
}

function total(values) {
  return values.reduce((sum, value) => sum + value, 0);
}

function points(values, max) {
  return values.map((value, index) => `${(index / (values.length - 1)) * 100},${100 - (value / max) * 82 - 8}`).join(" ");
}

const copy = {
  zh: { title: "报表", desc: "查看店铺经营情况并与上一周期比较。", export: "导出报表", serviceRevenue: "服务收入", productRevenue: "商品收入", posRevenue: "POS收入", bookings: "{count} 个预约", onlineOrders: "{count} 个线上订单", paidSales: "{count} 个已付款订单", vsLastWeek: "与上周比较", growth: "收入增长", weekly: "每周收入", weeklyDesc: "本周与上周比较。", thisWeek: "本周", monthly: "每月收入", monthlyDesc: "本月与上月比较。", month: "月份", mix: "业务结构", mixDesc: "预约与电商的贡献。", services: "服务", products: "商品", payments: "付款方式", paymentsDesc: "POS各付款方式的收入。", taxDiscount: "税费 / 折扣", taxDesc: "POS记录的税费与折扣。", discount: "折扣", tax: "税费" },
  ko: { title: "보고서", desc: "매장 실적을 확인하고 이전 기간과 비교합니다.", export: "보고서 내보내기", serviceRevenue: "서비스 매출", productRevenue: "상품 매출", posRevenue: "POS 매출", bookings: "예약 {count}건", onlineOrders: "온라인 주문 {count}건", paidSales: "결제 완료 {count}건", vsLastWeek: "지난주 대비", growth: "매출 성장", weekly: "주간 매출", weeklyDesc: "이번 주와 지난주를 비교합니다.", thisWeek: "이번 주", monthly: "월간 매출", monthlyDesc: "이번 달과 지난달을 비교합니다.", month: "월", mix: "매출 구성", mixDesc: "예약과 전자상거래의 기여도입니다.", services: "서비스", products: "상품", payments: "결제 방법", paymentsDesc: "POS 결제 방법별 매출입니다.", taxDiscount: "세금 / 할인", taxDesc: "POS에 저장된 세금과 할인입니다.", discount: "할인", tax: "세금" },
  vi: { title: "Báo cáo", desc: "Theo dõi tình hình kinh doanh của cửa hàng và so sánh với kỳ trước.", export: "Xuất báo cáo", serviceRevenue: "Doanh thu dịch vụ", productRevenue: "Doanh thu sản phẩm", posRevenue: "Doanh thu POS", bookings: "{count} lịch hẹn", onlineOrders: "{count} đơn online", paidSales: "{count} đơn đã thanh toán", vsLastWeek: "So với tuần trước", growth: "Tăng trưởng doanh thu", weekly: "Doanh thu tuần", weeklyDesc: "Tuần hiện tại so với tuần trước.", thisWeek: "Tuần này", monthly: "Doanh thu tháng", monthlyDesc: "Tháng hiện tại so với tháng trước.", month: "Tháng", mix: "Cơ cấu kinh doanh", mixDesc: "Đóng góp từ lịch hẹn và thương mại điện tử.", services: "Dịch vụ", products: "Sản phẩm", payments: "Phương thức thanh toán", paymentsDesc: "Doanh thu theo từng loại thanh toán từ POS.", taxDiscount: "Thuế / giảm giá", taxDesc: "Snapshot từ POS, không đổi khi chỉnh Settings sau này.", discount: "Giảm giá", tax: "Thuế" },
  ja: { title: "レポート", desc: "店舗の売上状況を確認し、前期間と比較します。", export: "レポート出力", serviceRevenue: "サービス売上", productRevenue: "商品売上", posRevenue: "POS売上", bookings: "予約 {count} 件", onlineOrders: "オンライン注文 {count} 件", paidSales: "支払い済み {count} 件", vsLastWeek: "前週比", growth: "売上成長", weekly: "週次売上", weeklyDesc: "今週と前週を比較します。", thisWeek: "今週", monthly: "月次売上", monthlyDesc: "今月と前月を比較します。", month: "月", mix: "売上構成", mixDesc: "予約とECの貢献度。", services: "サービス", products: "商品", payments: "支払い方法", paymentsDesc: "POSの支払い方法別売上。", taxDiscount: "税 / 割引", taxDesc: "POSのスナップショット。設定変更後も保持されます。", discount: "割引", tax: "税" },
  en: { title: "Reports", desc: "Track store performance and compare it with the previous period.", export: "Export report", serviceRevenue: "Service revenue", productRevenue: "Product revenue", posRevenue: "POS revenue", bookings: "{count} bookings", onlineOrders: "{count} online orders", paidSales: "{count} paid sales", vsLastWeek: "Vs last week", growth: "Revenue growth", weekly: "Weekly revenue", weeklyDesc: "Current week compared with previous week.", thisWeek: "This week", monthly: "Monthly revenue", monthlyDesc: "Current month compared with previous month.", month: "Month", mix: "Business mix", mixDesc: "Booking and ecommerce contribution.", services: "Services", products: "Products", payments: "Payment methods", paymentsDesc: "Revenue by POS payment type.", taxDiscount: "Tax / discount", taxDesc: "POS snapshot, unchanged by later Settings edits.", discount: "Discount", tax: "Tax" },
};

function LineChart({ current, previous, labels }) {
  const max = Math.max(...current, ...previous);
  return (
    <div className="lineChart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Revenue line chart">
        <polyline className="chartLine previous" points={points(previous, max)} />
        <polyline className="chartLine current" points={points(current, max)} />
      </svg>
      <div className="chartLabels">{labels.map((label) => <span key={label}>{label}</span>)}</div>
    </div>
  );
}

export default function Reports({ language = "vi" }) {
  const c = copy[language] || copy.vi;
  const { bookings } = useBookingStore();
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [period, setPeriod] = useState("day");
  const [cashCounted, setCashCounted] = useState("");
  const [reconciliation, setReconciliation] = useState(null);
  const [posSales, setPosSales] = useState(() => getStoredPosSales());
  useEffect(() => {
    const refresh = () => setPosSales(getStoredPosSales());
    window.addEventListener("nail-japan-pos-sales-updated", refresh);
    return () => window.removeEventListener("nail-japan-pos-sales-updated", refresh);
  }, []);
  const range = useMemo(() => {
    const date = new Date(`${reportDate}T12:00:00Z`);
    if (period === "day") return { start: reportDate, end: reportDate };
    if (period === "month") {
      const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
      return { start: `${reportDate.slice(0, 7)}-01`, end };
    }
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate() + 6);
    return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
  }, [period, reportDate]);
  const periodSales = useMemo(() => posSales.filter((sale) => {
    if (sale.paymentStatus !== "Paid") return false;
    const date = String(sale.issuedAt || "").slice(0, 10);
    return date >= range.start && date <= range.end;
  }), [posSales, range]);
  useEffect(() => {
    const saved = JSON.parse(window.localStorage.getItem(`nail-japan-cash-reconciliation:${range.start}:${range.end}`) || "null");
    setReconciliation(saved);
    setCashCounted(saved?.counted == null ? "" : String(saved.counted));
  }, [range.start, range.end]);
  const serviceRevenue = bookings.reduce((sum, booking) => sum + Number(booking.price || 0), 0);
  const productRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const paidSales = posSales.filter((sale) => sale.paymentStatus === "Paid");
  const posRevenue = paidSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const paymentLabels = { cash: "現金", card: "クレジットカード", paypay: "PayPay", transfer: "銀行振込", other: "その他" };
  const paymentBreakdown = Object.keys(paymentLabels).map((method) => ({ method: paymentLabels[method], total: posSales.flatMap((sale) => sale.payments || []).filter((payment) => payment.method === method && payment.confirmed).reduce((sum, payment) => sum + Number(payment.amount || 0), 0) }));
  const discounts = posSales.reduce((sum, sale) => sum + Number(sale.orderDiscount || 0), 0);
  const taxes = posSales.reduce((sum, sale) => sum + Number(sale.tax || 0), 0);
  const weekDelta = ((total(currentWeek) - total(previousWeek)) / total(previousWeek)) * 100;
  const monthDelta = ((total(currentMonth) - total(previousMonth)) / total(previousMonth)) * 100;
  const periodTotal = periodSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const periodCash = periodSales.flatMap((sale) => sale.payments || []).filter((payment) => payment.method === "cash" && payment.confirmed !== false).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const periodOther = periodTotal - periodCash;
  const counted = Number(cashCounted || 0);
  const cashMatches = cashCounted !== "" && Math.round(counted) === Math.round(periodCash);
  const periodBookings = bookings.filter((booking) => { const date = String(booking.date || booking.startDate || "").slice(0, 10); return date >= range.start && date <= range.end; });
  const paymentRows = Object.entries({ cash: "Tiền mặt", card: "Thẻ", paypay: "PayPay", transfer: "Chuyển khoản", other: "Khác" }).map(([method, label]) => ({ label, total: periodSales.flatMap((sale) => sale.payments || []).filter((payment) => payment.method === method && payment.confirmed !== false).reduce((sum, payment) => sum + Number(payment.amount || 0), 0) })).filter((row) => row.total > 0);
  const menuRows = Object.values(periodSales.flatMap((sale) => (sale.lines || []).map((line) => ({ name: line.name || line.service || "Không tên", amount: Number(line.total || line.unitPrice || 0) * Number(line.quantity || 1), count: Number(line.quantity || 1) }))).reduce((map, line) => { map[line.name] = { name: line.name, amount: (map[line.name]?.amount || 0) + line.amount, count: (map[line.name]?.count || 0) + line.count }; return map; }, {})).sort((a, b) => b.count - a.count);
  const chartDays = Array.from({ length: period === "day" ? 1 : period === "week" ? 7 : new Date(Date.UTC(Number(reportDate.slice(0, 4)), Number(reportDate.slice(5, 7)), 0)).getUTCDate() }, (_, index) => { const d = new Date(`${range.start}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + index); return d.toISOString().slice(0, 10); }).filter((date) => date <= range.end);
  const chartValues = chartDays.map((date) => periodSales.filter((sale) => String(sale.issuedAt || "").slice(0, 10) === date).reduce((sum, sale) => sum + Number(sale.total || 0), 0));
  const chartMax = Math.max(1, ...chartValues);
  function confirmCash() {
    const record = { counted, expected: periodCash, matches: cashMatches, confirmedAt: new Date().toISOString(), confirmedBy: "Nhân viên" };
    setReconciliation(record);
    window.localStorage.setItem(`nail-japan-cash-reconciliation:${range.start}:${range.end}`, JSON.stringify(record));
  }

  return (
    <>
      <div className="pageHead">
        <div><p className="eyebrow">BUSINESS REPORT</p><h1>{c.title}</h1><p>{c.desc}</p></div>
        <button className="primary">{c.export}</button>
      </div>
      <section className="card reportPanel reportPeriodToolbar">
        <div className="reportPeriodButtons"><button className={period === "day" ? "primary" : "ghost"} onClick={() => setPeriod("day")}>Ngày</button><button className={period === "week" ? "primary" : "ghost"} onClick={() => setPeriod("week")}>Tuần</button><button className={period === "month" ? "primary" : "ghost"} onClick={() => setPeriod("month")}>Tháng</button></div>
        <label>Ngày đối soát<input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} /></label>
        <small>{range.start} – {range.end}</small>
      </section>
      <section className="card reportPanel">
        <div className="sectionTitle"><div><h2>Tổng kết kỳ báo cáo</h2><p>Doanh thu đã thanh toán và đối soát tiền cuối kỳ.</p></div><span className="pill">{period === "day" ? "Theo ngày" : period === "week" ? "Theo tuần" : "Theo tháng"}</span></div>
        <div className="reportCashSummary"><div><span>Tổng doanh thu</span><strong>{yen(periodTotal)}</strong></div><div><span>Tổng tiền mặt</span><strong>{yen(periodCash)}</strong></div><div><span>Thanh toán khác</span><strong>{yen(periodOther)}</strong></div></div>
        <div className="cashReconciliation"><label>Tiền mặt thực tế trong máy tính tiền<input type="number" min="0" value={cashCounted} onChange={(event) => setCashCounted(event.target.value)} placeholder="Nhập số tiền đã đếm" /></label><button className="primary" onClick={confirmCash}>Nhân viên xác nhận khớp</button>{reconciliation && <p className={reconciliation.matches ? "successNote" : "errorNote"}>{reconciliation.matches ? `Đã xác nhận khớp · ${yen(reconciliation.counted)}` : `Không khớp · Lệch ${yen(reconciliation.counted - reconciliation.expected)} (dự kiến ${yen(reconciliation.expected)})`}</p>}</div>
      </section>
      <div className="stats"><div className="stat card"><span>Tổng doanh thu</span><strong>{yen(periodTotal)}</strong><small>{periodSales.length} đơn đã thanh toán</small></div><div className="stat card"><span>Tổng số đơn hàng</span><strong>{periodSales.length}</strong><small>Đơn POS trong kỳ</small></div><div className="stat card"><span>Lượt đặt khách</span><strong>{periodBookings.length}</strong><small>Lịch hẹn trong kỳ</small></div><div className="stat card"><span>Giá trị trung bình</span><strong>{yen(periodSales.length ? periodTotal / periodSales.length : 0)}</strong><small>Mỗi đơn thanh toán</small></div></div>
      <section className="card reportPanel"><div className="sectionTitle"><div><h2>Doanh thu theo ngày</h2><p>Biểu đồ và số tiền thực tế của kỳ đang chọn.</p></div></div><div className="reportBars">{chartDays.map((date, index) => <div className="reportBarItem" key={date}><strong>{yen(chartValues[index])}</strong><div className="reportBarTrack"><i style={{ height: `${Math.max(4, chartValues[index] / chartMax * 100)}%` }} /></div><small>{period === "month" ? date.slice(8) : date.slice(5)}</small></div>)}</div></section>
      <div className="reportGrid"><section className="card reportPanel"><div className="sectionTitle"><div><h2>Phương thức thanh toán</h2><p>Phân loại theo số tiền.</p></div></div>{paymentRows.length ? paymentRows.map((row) => <div className="reportRank" key={row.label}><span>{row.label}</span><strong>{yen(row.total)}</strong><i style={{ width: `${Math.min(100, row.total / Math.max(1, periodTotal) * 100)}%` }} /></div>) : <p className="mutedText">Chưa có giao dịch trong kỳ.</p>}</section><section className="card reportPanel"><div className="sectionTitle"><div><h2>Menu nổi bật</h2><p>Xếp theo số lượt đặt, kèm doanh thu.</p></div></div>{menuRows.length ? menuRows.slice(0, 8).map((row) => <div className="reportRank" key={row.name}><span>{row.name} · {row.count} lượt</span><strong>{yen(row.amount)}</strong><i style={{ width: `${Math.min(100, row.count / menuRows[0].count * 100)}%` }} /></div>) : <p className="mutedText">Chưa có menu được thanh toán trong kỳ.</p>}</section></div>
    </>
  );
}
