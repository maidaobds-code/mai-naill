"use client";

const items = [
  ["D", "Dashboard"],
  ["C", "Calendar"],
  ["U", "Customers"],
  ["S", "Staff"],
  ["P", "POS / Checkout"],
  ["Y", "Payroll"],
  ["R", "Reports"],
  ["B", "Products"],
  ["I", "Inventory"],
  ["O", "Online Store"],
  ["N", "Orders"],
  ["T", "Settings"],
];

export default function Sidebar({ active, setActive }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brandMark">N</div>
        <div>
          <strong>Mai Beauty Salon</strong>
          <span>Salon + Store OS</span>
        </div>
      </div>
      <nav>
        {items.map(([icon, label]) => (
          <button key={label} className={active === label ? "navItem active" : "navItem"} onClick={() => setActive(label)}>
            <span>{icon}</span>{label}
          </button>
        ))}
      </nav>
      <div className="sidebarFoot">
        <div className="salonAvatar">GN</div>
        <div><strong>Mai Beauty Salon</strong><span>Tokyo · JP</span></div>
      </div>
    </aside>
  );
}
