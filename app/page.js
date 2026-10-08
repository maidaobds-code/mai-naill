"use client";
import { useState } from "react";
import Sidebar from "../components/SidebarEnhanced";
import Dashboard from "../components/DashboardEnhanced";
import CalendarEnhanced from "../components/CalendarResourceTimeline";
import Customers from "../components/CustomersEnhanced";
import StaffManagement from "../components/StaffManagement";
import ProductInventory from "../components/ProductInventory";
import ServiceMenu from "../components/ServiceMenu";
import OnlineStore from "../components/OnlineStore";
import Orders from "../components/Orders";
import Integrations from "../components/Integrations";
import Payroll from "../components/Payroll";
import Checkout from "../components/Checkout";
import Reports from "../components/Reports";
import Settings from "../components/Settings";
import GenericModule from "../components/GenericModule";
import { t } from "../lib/i18nClean";

export default function Home() {
  const [active, setActive] = useState("Calendar");
  const [language, setLanguage] = useState("vi");
  let content = <Dashboard />;

  if (active === "Calendar") content = <CalendarEnhanced label={t(language, "calendar")} onCheckout={() => setActive("POS / Checkout")} />;
  else if (active === "Customers") content = <Customers label={t(language, "customers")} />;
  else if (active === "Staff") content = <StaffManagement label={t(language, "staff")} />;
  else if (active === "Services") content = <ServiceMenu label={t(language, "services")} />;
  else if (active === "ProductsInventory") content = <ProductInventory label={t(language, "productsInventory")} />;
  else if (active === "Online Store") content = <OnlineStore />;
  else if (active === "Orders") content = <Orders />;
  else if (active === "Integrations") content = <Integrations label={t(language, "integrations")} />;
  else if (active === "Payroll") content = <Payroll label={t(language, "payroll")} />;
  else if (active === "POS / Checkout") content = <Checkout label={t(language, "checkout")} />;
  else if (active === "Reports") content = <Reports />;
  else if (active === "Settings") content = <Settings />;
  else if (active !== "Dashboard") content = <GenericModule name={active} />;

  return (
    <div className="shell">
      <Sidebar active={active} setActive={setActive} language={language} setLanguage={setLanguage} />
      <main>{content}</main>
    </div>
  );
}
