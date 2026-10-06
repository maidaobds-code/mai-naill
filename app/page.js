"use client";
import { useState } from "react";
import Sidebar from "../components/SidebarEnhanced";
import Dashboard from "../components/DashboardEnhanced";
import CalendarEnhanced from "../components/CalendarResourceTimeline";
import Customers from "../components/CustomersEnhanced";
import StaffManagement from "../components/StaffManagement";
import Products from "../components/Products";
import Inventory from "../components/Inventory";
import OnlineStore from "../components/OnlineStore";
import Orders from "../components/Orders";
import Integrations from "../components/Integrations";
import Payroll from "../components/Payroll";
import Checkout from "../components/Checkout";
import GenericModule from "../components/GenericModule";
import { t } from "../lib/i18n";

export default function Home() {
  const [active, setActive] = useState("Calendar");
  const [language, setLanguage] = useState("en");
  let content = <Dashboard />;

  if (active === "Calendar") content = <CalendarEnhanced label={t(language, "calendar")} />;
  else if (active === "Customers") content = <Customers label={t(language, "customers")} />;
  else if (active === "Staff") content = <StaffManagement label={t(language, "staff")} />;
  else if (active === "Products") content = <Products />;
  else if (active === "Inventory") content = <Inventory />;
  else if (active === "Online Store") content = <OnlineStore />;
  else if (active === "Orders") content = <Orders />;
  else if (active === "Integrations") content = <Integrations label={t(language, "integrations")} />;
  else if (active === "Payroll") content = <Payroll label={t(language, "payroll")} />;
  else if (active === "POS / Checkout") content = <Checkout label={t(language, "checkout")} />;
  else if (active !== "Dashboard") content = <GenericModule name={active} />;

  return (
    <div className="shell">
      <Sidebar active={active} setActive={setActive} language={language} setLanguage={setLanguage} />
      <main>{content}</main>
    </div>
  );
}
