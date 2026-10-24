"use client";

import { orders } from "../lib/ecommerce/data";
import { useBookingStore } from "../lib/bookingStore";
import { getStoredPosSales } from "./Checkout";

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
  const posSales = getStoredPosSales();
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

  return (
    <>
      <div className="pageHead">
        <div><p className="eyebrow">BUSINESS REPORT</p><h1>{c.title}</h1><p>{c.desc}</p></div>
        <button className="primary">{c.export}</button>
      </div>
      <div className="stats">
        <div className="stat card"><span>{c.serviceRevenue}</span><strong>{yen(serviceRevenue)}</strong><small>{String(c.bookings || "Bookings {count}").replace("{count}", bookings.length)}</small></div>
        <div className="stat card"><span>{c.productRevenue}</span><strong>{yen(productRevenue)}</strong><small>{String(c.onlineOrders || "Online orders {count}").replace("{count}", orders.length)}</small></div>
        <div className="stat card"><span>{c.posRevenue}</span><strong>{yen(posRevenue)}</strong><small>{String(c.paidSales || "Paid sales {count}").replace("{count}", paidSales.length)}</small></div>
        <div className="stat card"><span>{c.vsLastWeek}</span><strong>{weekDelta.toFixed(1)}%</strong><small>{c.growth}</small></div>
      </div>
      <div className="reportGrid">
        <section className="card reportPanel"><div className="sectionTitle"><div><h2>{c.weekly}</h2><p>{c.weeklyDesc}</p></div><span className="pill active">{c.thisWeek}</span></div><LineChart current={currentWeek} previous={previousWeek} labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]} /></section>
        <section className="card reportPanel"><div className="sectionTitle"><div><h2>{c.monthly}</h2><p>{c.monthlyDesc}</p></div><span className="pill">{c.month}</span></div><LineChart current={currentMonth} previous={previousMonth} labels={["W1", "W2", "W3", "W4", "W5", "W6"]} /></section>
      </div>
      <section className="card reportPanel"><div className="sectionTitle"><div><h2>{c.mix}</h2><p>{c.mixDesc}</p></div></div><div className="mixBars"><div><span>{c.services}</span><strong style={{ width: `${Math.min(100, (serviceRevenue / (serviceRevenue + productRevenue)) * 100)}%` }} /></div><div><span>{c.products}</span><strong style={{ width: `${Math.min(100, (productRevenue / (serviceRevenue + productRevenue)) * 100)}%` }} /></div></div></section>
      <section className="card reportPanel"><div className="sectionTitle"><div><h2>{c.payments}</h2><p>{c.paymentsDesc}</p></div><span className="pill">{monthDelta.toFixed(1)}% {c.month}</span></div>{paymentBreakdown.map((payment) => <div className="lineItem" key={payment.method}><span>{payment.method}</span><strong>{yen(payment.total)}</strong></div>)}</section>
      <section className="card reportPanel"><div className="sectionTitle"><div><h2>{c.taxDiscount}</h2><p>{c.taxDesc}</p></div></div><div className="lineItem"><span>{c.discount}</span><strong>{yen(discounts)}</strong></div><div className="lineItem"><span>{c.tax}</span><strong>{yen(taxes)}</strong></div></section>
    </>
  );
}
