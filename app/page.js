"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/SidebarEnhanced";
import Dashboard from "../components/DashboardEnhanced";
import CalendarEnhanced from "../components/CalendarResourceTimeline";
import Customers from "../components/CustomersEnhanced";
import ProductInventory from "../components/ProductInventory";
import ServiceMenu from "../components/ServiceMenu";
import OnlineStore from "../components/OnlineStore";
import Orders from "../components/Orders";
import PaymentHistory from "../components/PaymentHistory";
import Payroll from "../components/Payroll";
import Checkout from "../components/Checkout";
import Reports from "../components/Reports";
import Settings from "../components/Settings";
import GenericModule from "../components/GenericModule";
import StaffManagement from "../components/StaffManagement";
import { AccountGate, CustomerProfile, LoginPage } from "../components/AccountAccess";
import { permissionsFor, useAccountStore } from "../lib/accountStore";
import { t, tx } from "../lib/i18nClean";

const APP_LANGUAGE_KEY = "nail-japan-language";

function storedAppLanguage() {
  if (typeof window === "undefined") return "vi";
  return window.localStorage.getItem(APP_LANGUAGE_KEY) || window.localStorage.getItem("nail-japan-store-language") || window.localStorage.getItem("nail-japan-login-language") || "vi";
}

export default function Home() {
  const [active, setActive] = useState("Calendar");
  const [language, setLanguage] = useState(storedAppLanguage);
  const [checkoutAppointmentId, setCheckoutAppointmentId] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const { currentAccount } = useAccountStore();
  const allowed = permissionsFor(currentAccount);
  const isCustomer = currentAccount?.role === "customer";
  const activePage = allowed.includes(active) ? active : allowed[0] || "Online Store";
  let content = <Dashboard language={language} />;

  useEffect(() => {
    window.localStorage.setItem(APP_LANGUAGE_KEY, language);
    window.localStorage.setItem("nail-japan-store-language", language);
    window.localStorage.setItem("nail-japan-login-language", language);
  }, [language]);

  if (!currentAccount) return <LoginPage />;

  if (activePage === "Calendar") content = <CalendarEnhanced label={t(language, "calendar")} language={language} onCheckout={(appointmentId) => { setCheckoutAppointmentId(appointmentId || ""); setActive("POS / Checkout"); }} />;
  else if (activePage === "Customers") content = <Customers label={t(language, "customers")} language={language} />;
  else if (activePage === "Services") content = <ServiceMenu label={t(language, "services")} language={language} />;
  else if (activePage === "ProductsInventory") content = <ProductInventory label={t(language, "productsInventory")} language={language} />;
  else if (activePage === "Online Store") content = <OnlineStore language={language} setLanguage={setLanguage} />;
  else if (activePage === "Orders") content = <Orders language={language} />;
  else if (activePage === "Payment History") content = <PaymentHistory language={language} />;
  else if (activePage === "Payroll") content = <Payroll label={t(language, "payroll")} language={language} currentAccount={currentAccount} />;
  else if (activePage === "POS / Checkout") content = <Checkout label={t(language, "checkout")} appointmentId={checkoutAppointmentId} language={language} onOpenPaymentHistory={() => setActive("Payment History")} />;
  else if (activePage === "Reports") content = <Reports language={language} />;
  else if (activePage === "Settings") content = <Settings language={language} />;
  else if (activePage === "Staff") content = <StaffManagement label={t(language, "staff")} language={language} />;
  else if (activePage !== "Dashboard") content = <GenericModule name={activePage} />;

  return (
    <div className={isCustomer ? "shell customerShell" : "shell"}>
      {!isCustomer && <Sidebar active={activePage} setActive={setActive} language={language} setLanguage={setLanguage} allowedItems={allowed} />}
      <main>
        {!isCustomer && <AccountGate language={language} setLanguage={setLanguage} />}
        {content}
        {profileOpen && <CustomerProfile language={language} onClose={() => setProfileOpen(false)} />}
      </main>
    </div>
  );
}
