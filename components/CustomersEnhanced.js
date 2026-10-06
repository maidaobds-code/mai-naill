"use client";
import { customers } from "../lib/salonData";

export default function CustomersEnhanced({ label = "Customers" }) {
  return (
    <>
      <div className="pageHead">
        <div><p className="eyebrow">CRM</p><h1>{label}</h1><p>Shared customer profile for appointment history, source origin, product orders, and lifetime value.</p></div>
        <button className="primary">+ Add Customer</button>
      </div>
      <div className="card tableWrap">
        <table>
          <thead><tr><th>Customer</th><th>Phone</th><th>Visits</th><th>Last visit</th><th>Total spend</th><th>Origin</th><th>Type</th></tr></thead>
          <tbody>{customers.map((customer) => <tr key={customer.id}><td><strong>{customer.name}</strong></td><td>{customer.phone}</td><td>{customer.visits}</td><td>{customer.lastVisit}</td><td>¥{customer.spend.toLocaleString("ja-JP")}</td><td>{customer.origin}</td><td><span className="pill">{customer.tag}</span></td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
