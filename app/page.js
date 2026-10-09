"use client";
import { useState } from "react";
import Sidebar from "../components/SidebarEnhanced";
import Dashboard from "../components/DashboardEnhanced";
import CalendarEnhanced from "../components/CalendarResourceTimeline";
import Customers from "../components/CustomersEnhanced";
import ProductInventory from "../components/ProductInventory";
import ServiceMenu from "../components/ServiceMenu";
import OnlineStore from "../components/OnlineStore";
import Orders from "../components/Orders";
import Payroll from "../components/Payroll";
import Checkout from "../components/Checkout";
import Reports from "../components/Reports";
import Settings from "../components/Settings";
import GenericModule from "../components/GenericModule";
import StaffManagement from "../components/StaffManagement";
import { AccountGate, CustomerProfile, LoginPage } from "../components/AccountAccess";
import { permissionsFor, useAccountStore } from "../lib/accountStore";
import { t } from "../lib/i18nClean";

export default function Home() {
  const [active, setActive] = useState("Calendar");
  const [language, setLanguage] = useState("vi");
  const [checkoutAppointmentId, setCheckoutAppointmentId] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const { currentAccount } = useAccountStore();
  const allowed = permissionsFor(currentAccount);
  const isCustomer = currentAccount?.role === "customer";
  const activePage = allowed.includes(active) ? active : allowed[0] || "Online Store";
  let content = <Dashboard />;

  if (!currentAccount) return <LoginPage />;

  if (activePage === "Calendar") content = <CalendarEnhanced label={t(language, "calendar")} language={language} onCheckout={(appointmentId) => { setCheckoutAppointmentId(appointmentId || ""); setActive("POS / Checkout"); }} />;
  else if (activePage === "Customers") content = <Customers label={t(language, "customers")} language={language} />;
  else if (activePage === "Services") content = <ServiceMenu label={t(language, "services")} language={language} />;
  else if (activePage === "ProductsInventory") content = <ProductInventory label={t(language, "productsInventory")} language={language} />;
  else if (activePage === "Online Store") content = <OnlineStore language={language} />;
  else if (activePage === "Orders") content = <Orders language={language} />;
  else if (activePage === "Payroll") content = <Payroll label={t(language, "payroll")} language={language} currentAccount={currentAccount} />;
  else if (activePage === "POS / Checkout") content = <Checkout label={t(language, "checkout")} appointmentId={checkoutAppointmentId} />;
  else if (activePage === "Reports") content = <Reports language={language} />;
  else if (activePage === "Settings") content = <Settings language={language} />;
  else if (activePage === "Staff") content = <StaffManagement label="Tài khoản nhân viên" />;
  else if (activePage !== "Dashboard") content = <GenericModule name={activePage} />;

  return (
    <div className={isCustomer ? "shell customerShell" : "shell"}>
      {!isCustomer && <Sidebar active={activePage} setActive={setActive} language={language} setLanguage={setLanguage} allowedItems={allowed} />}
      <main>
        <AccountGate />
        {isCustomer && <button className="customerProfileButton" onClick={() => setProfileOpen(true)} title="Trang cá nhân">👤</button>}
        {content}
        {profileOpen && <CustomerProfile onClose={() => setProfileOpen(false)} />}
      </main>
    </div>
  );
}
