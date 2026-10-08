"use client";
import { languages, t } from "../lib/i18nClean";
import { useStoreOrders } from "../lib/orderStore";

const items = [
  ["C", "Calendar", "calendar"],
  ["D", "Dashboard", "dashboard"],
  ["U", "Customers", "customers"],
  ["S", "Staff", "staff"],
  ["M", "Services", "services"],
  ["P", "POS / Checkout", "checkout"],
  ["Y", "Payroll", "payroll"],
  ["X", "Integrations", "integrations"],
  ["R", "Reports", "reports"],
  ["B", "ProductsInventory", "productsInventory"],
  ["O", "Online Store", "onlineStore"],
  ["N", "Orders", "orders"],
  ["T", "Settings", "settings"],
];

export default function SidebarEnhanced({ active, setActive, language, setLanguage }) {
  const { orders } = useStoreOrders();
  const unread = orders.filter((order) => order.unread).length;
  return (
    <aside className="sidebar">
      <div className="brand"><div className="brandMark">N</div><div><strong>Nail Japan</strong><span>{t(language, "salonOs")}</span></div></div>
      <nav>
        {items.map(([icon, label, key]) => (
          <button key={label} className={active === label ? "navItem active" : "navItem"} onClick={() => setActive(label)}>
            <span>{icon}</span>{t(language, key)}{label === "Orders" && orders.length > 0 && <b className="navBadge">{unread || orders.length}</b>}
          </button>
        ))}
      </nav>
      <div className="languageBox"><span>Language</span><select value={language} onChange={(event) => setLanguage(event.target.value)}>{languages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></div>
      <div className="sidebarFoot"><div className="salonAvatar">GN</div><div><strong>Glass Nail</strong><span>Shinjuku · JP</span></div></div>
    </aside>
  );
}
