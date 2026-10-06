"use client";
import { staff } from "../lib/salonData";
import { bookings, payments } from "../lib/salonData";
import { getInventoryRows, orders } from "../lib/ecommerce/data";

function Stat({ label, value, sub }) {
  return <div className="stat card"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}

export default function DashboardEnhanced() {
  const salonRevenue = bookings.reduce((total, booking) => total + booking.price, 0);
  const productRevenue = orders.reduce((total, order) => total + order.total, 0);
  const lowStockRows = getInventoryRows().filter((row) => row.quantityAvailable <= row.threshold);
  const paymentTotal = payments.reduce((total, payment) => total + payment.amount, 0);

  return (
    <>
      <div className="pageHead">
        <div>
          <p className="eyebrow">TUESDAY · 2026/10/06</p>
          <h1>Salon command center</h1>
          <p>Unified booking, staff availability, checkout, payroll, inventory, and online store revenue.</p>
        </div>
        <button className="primary">+ New Booking</button>
      </div>
      <div className="stats">
        <Stat label="Today's bookings" value={bookings.length} sub="Nailie / Hot Pepper / minimo" />
        <Stat label="Salon revenue" value={`¥${salonRevenue.toLocaleString("ja-JP")}`} sub="Booked services" />
        <Stat label="Product revenue" value={`¥${productRevenue.toLocaleString("ja-JP")}`} sub={`${orders.length} online orders`} />
        <Stat label="Daily closing" value={`¥${paymentTotal.toLocaleString("ja-JP")}`} sub="Cash, card, QR, app" />
      </div>
      <div className="grid2">
        <section className="card">
          <div className="sectionTitle"><div><h2>Today's timeline</h2><p>Each booking blocks the assigned staff across connected apps.</p></div><button className="ghost">Calendar</button></div>
          <div className="bookingList">
            {bookings.map((booking) => <div className="bookingRow" key={booking.id}>
              <div className="time">{booking.start}</div>
              <div className="grow"><strong>{booking.customer}</strong><span>{booking.phone} · {booking.service}</span></div>
              <span className={"source " + booking.source}>{booking.origin}</span>
              <div className="money">¥{booking.price.toLocaleString("ja-JP")}</div>
            </div>)}
          </div>
        </section>
        <section className="card">
          <div className="sectionTitle"><div><h2>Staff and alerts</h2><p>Mappings, shifts, and low-stock attention.</p></div></div>
          {staff.map((member) => <div className="staffRow" key={member.id}>
            <div className="avatar" style={{ background: member.color }}>{member.name[0]}</div>
            <div className="grow"><strong>{member.name}</strong><span>{member.role}</span></div>
            <span className="statusDot">{member.status}</span>
          </div>)}
          <div className="stockAlert">
            <strong>Low stock attention</strong>
            <span>{lowStockRows.map((row) => `${row.productName} ${row.variantName}`).join(", ")}</span>
          </div>
        </section>
      </div>
    </>
  );
}
