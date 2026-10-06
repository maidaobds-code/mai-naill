"use client";
import { bookings, staff, stock } from "../lib/mock";
import { getInventoryRows, orders } from "../lib/ecommerce/data";

function Stat({ label, value, sub }) {
  return <div className="stat card"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}

export default function Dashboard() {
  const revenue = bookings.reduce((a, b) => a + b.price, 0);
  const productRevenue = orders.reduce((a, b) => a + b.total, 0);
  const lowStockRows = getInventoryRows().filter((row) => row.quantityAvailable <= row.threshold);

  return (
    <>
      <div className="pageHead">
        <div>
          <p className="eyebrow">TUESDAY · 2026/10/06</p>
          <h1>Salon command center</h1>
          <p>Bookings, checkout, online orders, and inventory in one view.</p>
        </div>
        <button className="primary">+ New Booking</button>
      </div>
      <div className="stats">
        <Stat label="Today's bookings" value={bookings.length} sub="+2 from yesterday" />
        <Stat label="Salon revenue" value={`¥${revenue.toLocaleString("ja-JP")}`} sub="Service appointments" />
        <Stat label="Product revenue" value={`¥${productRevenue.toLocaleString("ja-JP")}`} sub={`${orders.length} online orders`} />
        <Stat label="Low stock" value={lowStockRows.length} sub="Needs purchase planning" />
      </div>
      <div className="grid2">
        <section className="card">
          <div className="sectionTitle"><div><h2>Today's timeline</h2><p>All booking channels normalized into the salon calendar.</p></div><button className="ghost">Calendar</button></div>
          <div className="bookingList">
            {bookings.map((b) => <div className="bookingRow" key={b.id}>
              <div className="time">{b.time}</div>
              <div className="grow"><strong>{b.customer}</strong><span>{b.service}</span></div>
              <span className={"source " + b.source.toLowerCase()}>{b.source}</span>
              <div className="money">¥{b.price.toLocaleString("ja-JP")}</div>
            </div>)}
          </div>
        </section>
        <section className="card">
          <div className="sectionTitle"><div><h2>Staff and stock</h2><p>Shift state plus inventory warnings.</p></div></div>
          {staff.map((s) => <div className="staffRow" key={s.id}>
            <div className="avatar" style={{ background: s.color }}>{s.name[0]}</div>
            <div className="grow"><strong>{s.name}</strong><span>{s.role}</span></div>
            <span className="statusDot">{s.status}</span>
          </div>)}
          <div className="stockAlert">
            <strong>Low stock attention</strong>
            <span>{lowStockRows.map((x) => `${x.productName} ${x.variantName}`).join(", ") || stock.filter((x) => x.qty <= x.min).map((x) => x.item).join(", ")}</span>
          </div>
        </section>
      </div>
    </>
  );
}
