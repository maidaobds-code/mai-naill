"use client";

import { useEffect, useMemo, useState } from "react";
import { useBookingStore } from "../lib/bookingStore";
import { useStoreOrders } from "../lib/orderStore";
import { tx } from "../lib/i18nClean";
import { customers as seedCustomers } from "../lib/salonData";
import { getKv, saveKv, supabaseReady } from "../lib/supabaseBrowser";

const CAMPAIGN_KEY = "nail-japan-campaigns";

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

export default function CustomersEnhanced({ label = "Customers", language = "vi" }) {
  const tr = (key) => tx(language, "customersPage", key);
  const tc = (key) => tx(language, "common", key);
  const { bookings } = useBookingStore();
  const { orders } = useStoreOrders();
  const [campaigns, setCampaigns] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState({ title: "Giảm giá mùa lễ", type: "promotion", target: "old", couponCode: "OLD10", imageUrl: "", imageName: "", message: "Cảm ơn bạn đã ủng hộ Mai Beauty Salon.\n\nTuần này salon có ưu đãi đặc biệt cho khách cũ. Bạn có thể đặt lịch trước để giữ khung giờ đẹp." });
  const customerList = useMemo(() => uniqueCustomers(seedCustomers, bookings, orders), [bookings, orders]);

  useEffect(() => {
    const raw = window.localStorage.getItem(CAMPAIGN_KEY);
    if (raw) {
      try { setCampaigns(JSON.parse(raw)); } catch {}
    }
    if (supabaseReady()) {
      getKv(CAMPAIGN_KEY).then((remote) => {
        if (Array.isArray(remote)) {
          setCampaigns(remote);
          window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(remote));
        }
        setHydrated(true);
      }).catch(() => {});
    } else {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(campaigns));
    if (supabaseReady()) saveKv(CAMPAIGN_KEY, campaigns).catch(() => {});
  }, [campaigns, hydrated]);

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

  function uploadCampaignImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDraft((current) => ({ ...current, imageUrl: reader.result, imageName: file.name }));
    reader.readAsDataURL(file);
  }

  return (
    <>
      <div className="pageHead"><div><p className="eyebrow">CRM</p><h1>{label}</h1><p>{tr("desc")}</p></div><button className="primary" form="campaignForm">{tr("sendNotice")}</button></div>
      <section className="card customerCampaignPanel">
        <div className="sectionTitle"><div><h2>{tr("campaignTitle")}</h2><p>{tr("campaignDesc")}</p></div></div>
        <form id="campaignForm" className="campaignForm" onSubmit={sendCampaign}>
          <label>{tr("subject")}<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label>{tr("type")}<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}><option value="promotion">{tr("promotion")}</option><option value="event">{tr("event")}</option><option value="notice">{tr("notice")}</option></select></label>
          <label>{tr("target")}<select value={draft.target} onChange={(event) => setDraft({ ...draft, target: event.target.value })}><option value="old">{tr("oldCustomers")}</option><option value="buyers">{tr("buyers")}</option><option value="bookers">{tr("bookers")}</option></select></label>
          <label>Mã giảm giá<input value={draft.couponCode} onChange={(event) => setDraft({ ...draft, couponCode: event.target.value })} /></label>
          <label>Hình ảnh thông báo<input type="file" accept="image/*" onChange={uploadCampaignImage} /></label>
          <label className="campaignMessage">{tr("message")}<textarea rows={8} value={draft.message} onChange={(event) => setDraft({ ...draft, message: event.target.value })} /></label>
          {draft.imageUrl && <div className="imagePreview"><img src={draft.imageUrl} alt={draft.title || "Campaign"} /><span>{draft.imageName}</span></div>}
        </form>
      </section>
      <div className="customerGrid">
        <section className="card tableWrap"><table><thead><tr><th>{tc("customer")}</th><th>{tc("phone")}</th><th>{tc("email")}</th><th>{tr("bookings")}</th><th>{tr("orders")}</th><th>{tr("spend")}</th><th>{tr("typeCol")}</th></tr></thead><tbody>{customerList.map((customer) => <tr key={customer.phone || customer.id}><td><strong>{customer.name}</strong></td><td>{customer.phone}</td><td>{customer.email || "-"}</td><td>{customer.bookingCount || customer.visits || 0}</td><td>{customer.orderCount || 0}</td><td>{yen(customer.spend)}</td><td><span className="pill">{customer.tag}</span></td></tr>)}</tbody></table></section>
        <aside className="card campaignLog"><h2>{tr("campaignLog")}</h2>{campaigns.length ? campaigns.map((campaign) => <div className="campaignItem" key={campaign.id}><strong>{campaign.title}</strong><span>{campaign.recipients.length} khach · {new Date(campaign.sentAt).toLocaleString("ja-JP")}</span>{campaign.couponCode && <span className="pill">Coupon {campaign.couponCode}</span>}{campaign.imageUrl && <img className="catalogThumb" src={campaign.imageUrl} alt={campaign.title} />}<small>{campaign.message}</small></div>) : <p>{tr("noCampaign")}</p>}</aside>
      </div>
    </>
  );
}

