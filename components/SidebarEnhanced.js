"use client";
import { languages, t, tx } from "../lib/i18nClean";
import { useStoreOrders } from "../lib/orderStore";

const items = [
  ["calendar", "▦", "Calendar", "calendar", "#7dd3fc"],
  ["customers", "●●", "Customers", "customers", "#c4b5fd"],
  ["services", "✦", "Services", "services", "#f9a8d4"],
  ["checkout", "¥", "POS / Checkout", "checkout", "#fbbf24"],
  ["payroll", "円", "Payroll", "payroll", "#86efac"],
  ["store", "◇", "Online Store", "onlineStore", "#f0abfc"],
  ["inventory", "▣", "ProductsInventory", "productsInventory", "#93c5fd"],
  ["reports", "⌁", "Reports", "reports", "#fb7185"],
  ["notice", "◕", "Orders", "orders", "#facc15"],
  ["settings", "⚙", "Settings", "settings", "#a7f3d0"],
];

export default function SidebarEnhanced({ active, setActive, language, setLanguage }) {
  const { orders } = useStoreOrders();
  const unread = orders.filter((order) => order.unread).length;
  return (
    <aside className="sidebar">
      <div className="brand"><div className="brandMark">M</div><div><strong>{tx(language, "brand", "name")}</strong><span>{t(language, "salonOs")}</span></div></div>
      <nav>
        {items.map(([iconType, icon, label, key, accent]) => (
          <button key={label} className={active === label ? "navItem active" : "navItem"} style={{ "--nav-accent": accent }} onClick={() => setActive(label)}>
            <span className={`navIcon navIcon-${iconType}`}>{icon}</span>{t(language, key)}{label === "Orders" && orders.length > 0 && <b className="navBadge">{unread || orders.length}</b>}
          </button>
        ))}
      </nav>
      <div className="languageBox"><span>{t(language, "language")}</span><select value={language} onChange={(event) => setLanguage(event.target.value)}>{languages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></div>
      <div className="sidebarFoot"><div className="salonAvatar">MB</div><div><strong>{tx(language, "brand", "name")}</strong><span>{tx(language, "brand", "foot")}</span></div></div>
    </aside>
  );
}
