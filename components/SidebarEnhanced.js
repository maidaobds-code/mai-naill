"use client";
import { languages, t, tx } from "../lib/i18nClean";
import { useStoreOrders } from "../lib/orderStore";

const items = [
  ["📅", "Calendar", "calendar"],
  ["📊", "Dashboard", "dashboard"],
  ["👥", "Customers", "customers"],
  ["💅", "Staff", "staff"],
  ["📋", "Services", "services"],
  ["💳", "POS / Checkout", "checkout"],
  ["💴", "Payroll", "payroll"],
  ["📈", "Reports", "reports"],
  ["🧴", "ProductsInventory", "productsInventory"],
  ["🛒", "Online Store", "onlineStore"],
  ["📦", "Orders", "orders"],
  ["⚙️", "Settings", "settings"],
];

export default function SidebarEnhanced({ active, setActive, language, setLanguage }) {
  const { orders } = useStoreOrders();
  const unread = orders.filter((order) => order.unread).length;
  return (
    <aside className="sidebar">
      <div className="brand"><div className="brandMark">M</div><div><strong>{tx(language, "brand", "name")}</strong><span>{t(language, "salonOs")}</span></div></div>
      <nav>
        {items.map(([icon, label, key]) => (
          <button key={label} className={active === label ? "navItem active" : "navItem"} onClick={() => setActive(label)}>
            <span>{icon}</span>{t(language, key)}{label === "Orders" && orders.length > 0 && <b className="navBadge">{unread || orders.length}</b>}
          </button>
        ))}
      </nav>
      <div className="languageBox"><span>{t(language, "language")}</span><select value={language} onChange={(event) => setLanguage(event.target.value)}>{languages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></div>
      <div className="sidebarFoot"><div className="salonAvatar">MB</div><div><strong>{tx(language, "brand", "name")}</strong><span>{tx(language, "brand", "foot")}</span></div></div>
    </aside>
  );
}
