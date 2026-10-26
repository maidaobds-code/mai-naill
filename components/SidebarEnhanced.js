"use client";
import { useEffect, useState } from "react";
import { languages, t, tx } from "../lib/i18nClean";
import { useStoreOrders } from "../lib/orderStore";

const items = [
  ["calendar", "▦", "Calendar", "calendar", "#7dd3fc"],
  ["checkout", "¥", "POS / Checkout", "checkout", "#fbbf24"],
  ["payment-history", "▤", "Payment History", "paymentHistory", "#22c55e"],
  ["orders", "◕", "Orders", "orders", "#eab308"],
  ["services", "✦", "Services", "services", "#f9a8d4"],
  ["payroll", "円", "Payroll", "payroll", "#86efac"],
  ["store", "◇", "Online Store", "onlineStore", "#f0abfc"],
  ["inventory", "▣", "ProductsInventory", "productsInventory", "#93c5fd"],
  ["reports", "⌁", "Reports", "reports", "#fb7185"],
  ["customers", "●●", "Customers", "customers", "#c4b5fd"],
  ["staff", "◎", "Staff", "staff", "#06b6d4"],
  ["settings", "⚙", "Settings", "settings", "#a7f3d0"],
];

export default function SidebarEnhanced({ active, setActive, language, setLanguage, allowedItems = items.map((item) => item[2]) }) {
  const [logoUrl, setLogoUrl] = useState("");
  const { orders } = useStoreOrders();
  useEffect(() => {
    const readLogo = () => { try { setLogoUrl(JSON.parse(window.localStorage.getItem("nail-japan-settings") || "{}").logoUrl || ""); } catch { setLogoUrl(""); } };
    let mounted = true;
    const readServerLogo = async () => {
      try {
        const response = await fetch("/api/settings?public=1", { cache: "no-store" });
        const result = response.ok ? await response.json() : null;
        if (!mounted || !result?.value) return;
        const local = JSON.parse(window.localStorage.getItem("nail-japan-settings") || "{}");
        const next = { ...local, ...result.value };
        window.localStorage.setItem("nail-japan-settings", JSON.stringify(next));
        setLogoUrl(next.logoUrl || "");
      } catch {}
    };
    readLogo();
    readServerLogo();
    const refreshTimer = window.setInterval(readServerLogo, 10000);
    window.addEventListener("storage", readLogo);
    window.addEventListener("nail-japan-settings-updated", readLogo);
    return () => { mounted = false; window.clearInterval(refreshTimer); window.removeEventListener("storage", readLogo); window.removeEventListener("nail-japan-settings-updated", readLogo); };
  }, []);
  const unread = orders.filter((order) => order.unread && !["FULFILLED", "Completed", "Delivered"].includes(order.status)).length;
  const visibleItems = items.filter((item) => allowedItems.includes(item[2]));
  return (
    <aside className="sidebar">
      <div className="brand">{logoUrl ? <img className="appBrandLogo" src={logoUrl} alt={tx(language, "brand", "name")} /> : <div className="brandMark">M</div>}<div><strong>{tx(language, "brand", "name")}</strong><span>{t(language, "salonOs")}</span></div></div>
      <nav>
        {visibleItems.map(([iconType, icon, label, key, accent]) => (
          <button key={label} className={active === label ? "navItem active" : "navItem"} style={{ "--nav-accent": accent }} onClick={() => setActive(label)}>
            <span className={`navIcon navIcon-${iconType}`}>{icon}</span>{t(language, key)}{label === "Orders" && unread > 0 && <b className="navBadge">{unread}</b>}
          </button>
        ))}
      </nav>
      <div className="languageBox"><span>{t(language, "language")}</span><select data-language={language} aria-label={t(language, "language")} value={language} onChange={(event) => setLanguage(event.target.value)}>{languages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></div>
      <div className="sidebarFoot"><div className="salonAvatar">MB</div><div><strong>{tx(language, "brand", "name")}</strong><span>{tx(language, "brand", "foot")}</span></div></div>
    </aside>
  );
}
