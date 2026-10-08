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

export default function Reports() {
  const { bookings } = useBookingStore();
  const posSales = getStoredPosSales();
  const serviceRevenue = bookings.reduce((sum, booking) => sum + Number(booking.price || 0), 0);
  const productRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const posRevenue = posSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const paymentBreakdown = ["Cash", "Card", "QR", "App payment", "Bank transfer"].map((method) => ({ method, total: posSales.filter((sale) => sale.paymentMethod === method).reduce((sum, sale) => sum + Number(sale.total || 0), 0) }));
  const weekDelta = ((total(currentWeek) - total(previousWeek)) / total(previousWeek)) * 100;
  const monthDelta = ((total(currentMonth) - total(previousMonth)) / total(previousMonth)) * 100;

  return (
    <>
      <div className="pageHead">
        <div><p className="eyebrow">BUSINESS REPORT</p><h1>Reports</h1><p>Theo doi tinh hinh kinh doanh cua cua hang va so sanh voi ky truoc.</p></div>
        <button className="primary">Export report</button>
      </div>
      <div className="stats">
        <div className="stat card"><span>Service revenue</span><strong>{yen(serviceRevenue)}</strong><small>{bookings.length} bookings</small></div>
        <div className="stat card"><span>Product revenue</span><strong>{yen(productRevenue)}</strong><small>{orders.length} online orders</small></div>
        <div className="stat card"><span>POS revenue</span><strong>{yen(posRevenue)}</strong><small>{posSales.length} checkout sales</small></div>
        <div className="stat card"><span>Vs last week</span><strong>{weekDelta.toFixed(1)}%</strong><small>Revenue growth</small></div>
      </div>
      <div className="reportGrid">
        <section className="card reportPanel"><div className="sectionTitle"><div><h2>Weekly revenue</h2><p>Current week compared with previous week.</p></div><span className="pill active">This week</span></div><LineChart current={currentWeek} previous={previousWeek} labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]} /></section>
        <section className="card reportPanel"><div className="sectionTitle"><div><h2>Monthly revenue</h2><p>Current month compared with previous month.</p></div><span className="pill">Month</span></div><LineChart current={currentMonth} previous={previousMonth} labels={["W1", "W2", "W3", "W4", "W5", "W6"]} /></section>
      </div>
      <section className="card reportPanel"><div className="sectionTitle"><div><h2>Business mix</h2><p>Booking and ecommerce contribution.</p></div></div><div className="mixBars"><div><span>Services</span><strong style={{ width: `${Math.min(100, (serviceRevenue / (serviceRevenue + productRevenue)) * 100)}%` }} /></div><div><span>Products</span><strong style={{ width: `${Math.min(100, (productRevenue / (serviceRevenue + productRevenue)) * 100)}%` }} /></div></div></section>
      <section className="card reportPanel"><div className="sectionTitle"><div><h2>Payment methods</h2><p>Liệt kê doanh thu theo từng loại thanh toán từ trang tính tiền.</p></div><span className="pill">{monthDelta.toFixed(1)}% month</span></div>{paymentBreakdown.map((payment) => <div className="lineItem" key={payment.method}><span>{payment.method}</span><strong>{yen(payment.total)}</strong></div>)}</section>
    </>
  );
}
