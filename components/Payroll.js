"use client";
import { bookings, payrollRules, staff } from "../lib/salonData";

function yen(value) {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

export default function Payroll({ label = "Payroll" }) {
  const rows = staff.map((member) => {
    const staffBookings = bookings.filter((booking) => booking.staff === member.name);
    const sales = staffBookings.reduce((total, booking) => total + booking.price, 0);
    const commission = staffBookings.reduce((total, booking) => {
      const rate = Number((booking.commissionRule.match(/(\d+)%/) || [0, 45])[1]);
      return total + booking.price * (rate / 100);
    }, 0);
    return { member, staffBookings, sales, commission };
  });

  return (
    <>
      <div className="pageHead">
        <div><p className="eyebrow">OCTOBER 2026</p><h1>{label}</h1><p>Commission rules can be selected per customer booking source and customer origin.</p></div>
        <button className="primary">Export CSV</button>
      </div>
      <div className="payrollCards">
        {rows.map((row) => <section className="card payrollCard" key={row.member.id}><div className="avatar" style={{ background: row.member.color }}>{row.member.name[0]}</div><h2>{row.member.name}</h2><span>Sales {yen(row.sales)}</span><strong>{yen(row.commission)}</strong><small>{row.staffBookings.length} bookings</small></section>)}
      </div>
      <section className="card tableWrap">
        <table>
          <thead><tr><th>Date</th><th>Customer</th><th>Source</th><th>Staff</th><th>Sale</th><th>Rule</th><th>Commission</th></tr></thead>
          <tbody>{bookings.map((booking) => {
            const rate = Number((booking.commissionRule.match(/(\d+)%/) || [0, 45])[1]);
            return <tr key={booking.id}><td>2026/10/06</td><td>{booking.customer}</td><td>{booking.origin}</td><td>{booking.staff}</td><td>{yen(booking.price)}</td><td>{booking.commissionRule}</td><td><strong>{yen(booking.price * rate / 100)}</strong></td></tr>;
          })}</tbody>
        </table>
      </section>
      <section className="card ruleList">
        <h2>Payroll rule engine</h2>
        {payrollRules.map((rule) => <div className="ruleRow" key={rule.id}><strong>{rule.staff}</strong><span>{rule.condition}</span><b>{rule.rate}%</b><small>{rule.base}</small></div>)}
      </section>
    </>
  );
}
