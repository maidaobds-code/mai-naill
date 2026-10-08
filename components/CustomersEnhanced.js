"use client";

import { useMemo, useState } from "react";
import { useBookingStore } from "../lib/bookingStore";
import { useStoreOrders } from "../lib/orderStore";
import { customers as seedCustomers } from "../lib/salonData";

function yen(value) {
  return `JPY ${Number(value || 0).toLocaleString("ja-JP")}`;
}

function uniqueCustomers(seed, bookings, orders) {
  const map = new Map();
  seed.forEach((customer) => map.set(customer.phone, { ...customer, email: customer.email || "", source: customer.origin, orderCount: 0, bookingCount: customer.visits || 0 }));
  bookings.forEach((booking) => {
    const key = booking.phone || booking.email || booking.customer;
    const current = map.get(key) || { id: key, name: booking.customer, phone: booking.phone, email: booking.email || "", spend: 0, visits: 0, lastVisit: `2026-10-${String(booking.day || 6).padStart(2, "0")}`, origin: booking.origin, tag: "Booking", orderCount: 0, bookingCount: 0 };
    map.set(key, { ...current, name: current.name || booking.customer, phone: current.phone || booking.phone, email: current.email || booking.email || "", spend: Number(current.spend || 0) + Number(booking.price || 0), bookingCount: Number(current.bookingCount || 0) + 1, visits: Number(current.visits || 0) + 1 });
  });
  orders.forEach((order) => {
    const key = order.phone || order.email || order.customer;
    const current = map.get(key) || { id: key, name: order.customer, phone: order.phone, email: order.email, spend: 0, visits: 0, lastVisit: order.createdAt?.slice(0, 10), origin: "Online Store", tag: "Buyer", orderCount: 0, bookingCount: 0 };
    map.set(key, { ...current, name: current.name || order.customer, phone: current.phone || order.phone, email: current.email || order.email || "", spend: Number(current.spend || 0) + Number(order.total || 0), orderCount: Number(current.orderCount || 0) + 1 });
  });
  return Array.from(map.values());
}

export default function CustomersEnhanced({ label = "Customers" }) {
  const { bookings } = useBookingStore();
  const { orders } = useStoreOrders();
  const [campaigns, setCampaigns] = useState([]);
  const [draft, setDraft] = useState({ title: "Giam gia mua le", type: "promotion", target: "old", message: "Cam on ban da ung ho Glass Nail. Tuan nay salon co uu dai dac biet cho khach cu." });
  const customerList = useMemo(() => uniqueCustomers(seedCustomers, bookings, orders), [bookings, orders]);

  function targetCustomers() {
    if (draft.target === "buyers") return customerList.filter((customer) => customer.orderCount > 0);
    if (draft.target === "bookers") return customerList.filter((customer) => customer.bookingCount > 0 || customer.visits > 0);
    return customerList.filter((customer) => (customer.orderCount > 0 || customer.bookingCount > 0 || customer.visits > 0));
  }

  function sendCampaign(event) {
    event.preventDefault();
    const recipients = targetCustomers();
    if (!draft.title.trim() || !draft.message.trim() || recipients.length === 0) return;
    setCampaigns((current) => [{ id: `campaign-${Date.now()}`, ...draft, sentAt: new Date().toISOString(), recipients: recipients.map((customer) => ({ name: customer.name, phone: customer.phone, email: customer.email || "No email", status: "Gmail sent" })) }, ...current]);
  }

  return (
    <>
      <div className="pageHead"><div><p className="eyebrow">CRM</p><h1>{label}</h1><p>Quan ly khach cu, tao su kien/thong bao va gui Gmail hang loat cho khach da mua hoac dat lich.</p></div><button className="primary" form="campaignForm">Gui thong bao</button></div>
      <section className="card customerCampaignPanel">
        <div className="sectionTitle"><div><h2>Su kien / thong bao cho khach cu</h2><p>Vi du: giam gia mua le, uu dai sinh nhat, lich nghi cua hang.</p></div></div>
        <form id="campaignForm" className="campaignForm" onSubmit={sendCampaign}>
          <label>Tieu de<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label>Loai<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}><option value="promotion">Giam gia</option><option value="event">Su kien</option><option value="notice">Thong bao</option></select></label>
          <label>Nhom nhan<select value={draft.target} onChange={(event) => setDraft({ ...draft, target: event.target.value })}><option value="old">Khach cu da mua/dat lich</option><option value="buyers">Khach da mua hang</option><option value="bookers">Khach da dat lich</option></select></label>
          <label className="campaignMessage">Noi dung<input value={draft.message} onChange={(event) => setDraft({ ...draft, message: event.target.value })} /></label>
        </form>
      </section>
      <div className="customerGrid">
        <section className="card tableWrap"><table><thead><tr><th>Customer</th><th>Phone</th><th>Gmail</th><th>Bookings</th><th>Orders</th><th>Total spend</th><th>Type</th></tr></thead><tbody>{customerList.map((customer) => <tr key={customer.phone || customer.id}><td><strong>{customer.name}</strong></td><td>{customer.phone}</td><td>{customer.email || "-"}</td><td>{customer.bookingCount || customer.visits || 0}</td><td>{customer.orderCount || 0}</td><td>{yen(customer.spend)}</td><td><span className="pill">{customer.tag}</span></td></tr>)}</tbody></table></section>
        <aside className="card campaignLog"><h2>Gmail campaign log</h2>{campaigns.length ? campaigns.map((campaign) => <div className="campaignItem" key={campaign.id}><strong>{campaign.title}</strong><span>{campaign.recipients.length} khach · {new Date(campaign.sentAt).toLocaleString("ja-JP")}</span><small>{campaign.message}</small></div>) : <p>Chua gui thong bao nao.</p>}</aside>
      </div>
    </>
  );
}
