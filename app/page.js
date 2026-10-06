"use client";
import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Dashboard from "../components/Dashboard";
import CalendarView from "../components/CalendarView";
import Customers from "../components/Customers";
import Products from "../components/Products";
import Inventory from "../components/Inventory";
import OnlineStore from "../components/OnlineStore";
import Orders from "../components/Orders";
import GenericModule from "../components/GenericModule";

export default function Home() {
  const [active, setActive] = useState("Dashboard");
  let content = <Dashboard />;

  if (active === "Calendar") content = <CalendarView />;
  else if (active === "Customers") content = <Customers />;
  else if (active === "Products") content = <Products />;
  else if (active === "Inventory") content = <Inventory />;
  else if (active === "Online Store") content = <OnlineStore />;
  else if (active === "Orders") content = <Orders />;
  else if (active !== "Dashboard") content = <GenericModule name={active} />;

  return (
    <div className="shell">
      <Sidebar active={active} setActive={setActive} />
      <main>{content}</main>
    </div>
  );
}
