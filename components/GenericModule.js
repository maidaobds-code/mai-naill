"use client";

const data = {
  Staff: ["Profiles", "Working hours", "Commission rules", "Public booking profiles"],
  "POS / Checkout": ["Service checkout", "Product sales", "Split payments", "Receipts"],
  Payroll: ["Rule engine", "Commission snapshots", "Monthly payroll", "CSV export"],
  Reports: ["Daily closing", "Revenue by platform", "Product revenue", "Inventory value"],
  Settings: ["Salon information", "Business hours", "Payments", "Integrations"],
};

export default function GenericModule({ name }) {
  const list = data[name] || [];
  return (
    <>
      <div className="pageHead">
        <div><p className="eyebrow">MODULE</p><h1>{name}</h1><p>MVP surface ready for Supabase-backed production workflows.</p></div>
        <button className="primary">+ Add</button>
      </div>
      <div className="featureGrid">
        {list.map((x, i) => <div className="card feature" key={x}><span className="featureNo">0{i + 1}</span><h3>{x}</h3><p>Structured for domain services, audit logs, and role-based access.</p></div>)}
      </div>
    </>
  );
}
