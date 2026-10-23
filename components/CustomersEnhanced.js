"use client";

import { useEffect, useMemo, useState } from "react";
import { useBookingStore } from "../lib/bookingStore";
import { useStoreOrders } from "../lib/orderStore";
import { tx } from "../lib/i18nClean";
import { customers as seedCustomers } from "../lib/salonData";
import { getKv, saveKv, supabaseReady } from "../lib/supabaseBrowser";
import { useAccountStore } from "../lib/accountStore";

const CAMPAIGN_KEY = "nail-japan-campaigns";
const DELETED_CUSTOMERS_KEY = "nail-japan-deleted-customers";

function yen(value) {
  return `JPY ${Number(value || 0).toLocaleString("ja-JP")}`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

function campaignEmailHtml(title, message, couponCode, imageUrl, language = "vi") {
  const copy = ({ vi: { coupon: "Mã ưu đãi", button: "Mở trang Mai Beauty Salon", closing: "Trân trọng" }, en: { coupon: "Offer code", button: "Open Mai Beauty Salon", closing: "Kind regards" }, ja: { coupon: "クーポンコード", button: "Mai Beauty Salonを開く", closing: "よろしくお願いいたします" } }[language]) || { coupon: "Mã ưu đãi", button: "Mở trang Mai Beauty Salon", closing: "Trân trọng" };
  const image = /^https?:\/\//i.test(imageUrl || "") ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" style="display:block;width:100%;max-height:260px;object-fit:cover;border-radius:14px;margin:0 0 20px" />` : "";
  const coupon = couponCode ? `<div style="margin-top:20px;padding:14px;border:1px dashed #c084c2;border-radius:12px;background:#fff7fb"><strong>${copy.coupon}: ${escapeHtml(couponCode)}</strong></div>` : "";
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
  const action = siteUrl ? `<p style="margin:24px 0;text-align:center"><a href="${escapeHtml(siteUrl)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#9333ea;color:#fff;text-decoration:none;font-weight:700">${copy.button}</a></p>` : "";
  return `<div style="margin:0;background:#fff7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#332936"><div style="max-width:600px;margin:auto;background:#fff;border:1px solid #f0dce8;border-radius:20px;overflow:hidden;box-shadow:0 8px 24px rgba(100,50,90,.08)"><div style="padding:22px 28px;background:linear-gradient(135deg,#f6d8ec,#eadcff);font-size:12px;letter-spacing:2px;color:#7c3f62">MAI BEAUTY SALON</div><div style="padding:28px"><h1 style="margin:0 0 16px;font-size:24px;line-height:1.3">${escapeHtml(title)}</h1><p style="white-space:pre-line;font-size:15px;line-height:1.7;margin:0">${escapeHtml(message)}</p>${coupon}${action}${image}<p style="margin:24px 0 0;color:#7b6b78;font-size:13px">${copy.closing},<br/><strong>Mai Beauty Salon</strong></p></div></div></div>`;
}

function uniqueCustomers(seed, bookings, orders, accounts = []) {
  const map = new Map();
  seed.forEach((customer) => map.set(customer.phone, { ...customer, email: customer.email || "", source: customer.origin, orderCount: 0, bookingCount: customer.visits || 0 }));
  accounts.filter((account) => account.role === "customer").forEach((account) => {
    const key = account.phone || account.email || account.id;
    const current = map.get(key) || { id: account.id, name: account.name, phone: account.phone || "", email: account.email || "", language: account.language || "vi", spend: 0, visits: 0, lastVisit: "", origin: "Customer account", tag: "Account", orderCount: 0, bookingCount: 0 };
    map.set(key, { ...current, name: current.name || account.name, phone: current.phone || account.phone || "", email: current.email || account.email || "", language: current.language || account.language || "vi", source: current.source || "Customer account" });
  });
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

function customerKey(customer) {
  return String(customer.phone || customer.email || customer.id || customer.name);
}

export default function CustomersEnhanced({ label = "Customers", language = "vi" }) {
  const tr = (key) => tx(language, "customersPage", key);
  const tc = (key) => tx(language, "common", key);
  const defaultDraft = {
    vi: { title: "Giảm giá mùa lễ", message: "Cảm ơn bạn đã ủng hộ Mai Beauty Salon.\n\nTuần này salon có ưu đãi đặc biệt cho khách cũ. Bạn có thể đặt lịch trước để giữ khung giờ đẹp." },
    ja: { title: "季節キャンペーン", message: "Mai Beauty Salonをご利用いただきありがとうございます。\n\n今週はリピーター様向けの特別優待をご用意しています。ご希望の時間を早めにご予約ください。" },
    en: { title: "Seasonal discount", message: "Thank you for supporting Mai Beauty Salon.\n\nThis week we have a special offer for returning customers. Book early to keep your preferred time." },
  }[language] || {};
  const { bookings } = useBookingStore();
  const { orders } = useStoreOrders();
  const { accounts } = useAccountStore();
  const [campaigns, setCampaigns] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [selectedCustomerKeys, setSelectedCustomerKeys] = useState([]);
  const [deletedCustomerKeys, setDeletedCustomerKeys] = useState([]);
  const [draft, setDraft] = useState({ title: defaultDraft.title, type: "promotion", target: "old", couponCode: "OLD10", imageUrl: "", imageName: "", message: defaultDraft.message });
  const allCustomers = useMemo(() => uniqueCustomers(seedCustomers, bookings, orders, accounts), [bookings, orders, accounts]);
  const customerList = useMemo(() => allCustomers.filter((customer) => !deletedCustomerKeys.includes(customerKey(customer))), [allCustomers, deletedCustomerKeys]);

  useEffect(() => {
    const raw = window.localStorage.getItem(CAMPAIGN_KEY);
    if (raw) {
      try { setCampaigns(JSON.parse(raw)); } catch {}
    }
    const deletedRaw = window.localStorage.getItem(DELETED_CUSTOMERS_KEY);
    if (deletedRaw) {
      try { setDeletedCustomerKeys(JSON.parse(deletedRaw)); } catch {}
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
    window.localStorage.setItem(DELETED_CUSTOMERS_KEY, JSON.stringify(deletedCustomerKeys));
    setSelectedCustomerKeys((current) => current.filter((key) => !deletedCustomerKeys.includes(key)));
  }, [deletedCustomerKeys]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(campaigns));
    if (supabaseReady()) saveKv(CAMPAIGN_KEY, campaigns).catch(() => {});
  }, [campaigns, hydrated]);

  function targetCustomers() {
    if (selectedCustomerKeys.length) return customerList.filter((customer) => selectedCustomerKeys.includes(customerKey(customer)));
    if (draft.target === "buyers") return customerList.filter((customer) => customer.orderCount > 0);
    if (draft.target === "bookers") return customerList.filter((customer) => customer.bookingCount > 0 || customer.visits > 0);
    return customerList.filter((customer) => (customer.orderCount > 0 || customer.bookingCount > 0 || customer.visits > 0));
  }

  function toggleCustomer(customer) {
    if (!customer.email) return;
    const key = customerKey(customer);
    setSelectedCustomerKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  function toggleAllCustomers() {
    const selectableKeys = customerList.filter((customer) => customer.email).map(customerKey);
    setSelectedCustomerKeys((current) => current.length === selectableKeys.length ? [] : selectableKeys);
  }

  function deleteCustomer(customer) {
    if (!window.confirm(`${tr("deleteConfirm")}\n\n${customer.name}`)) return;
    setDeletedCustomerKeys((current) => current.includes(customerKey(customer)) ? current : [...current, customerKey(customer)]);
  }

  async function sendCampaign(event) {
    event.preventDefault();
    const recipients = targetCustomers();
    if (!draft.title.trim() || !draft.message.trim() || recipients.length === 0) return;
    const delivered = await Promise.all(recipients.filter((customer) => customer.email).map(async (customer) => {
      const language = customer.language || "vi";
      const subject = `${language === "ja" ? "Mai Beauty Salon・" : language === "en" ? "Mai Beauty Salon · " : "Mai Beauty Salon · "}${draft.title.trim()}`;
      const response = await fetch("/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: customer.email, subject, html: campaignEmailHtml(draft.title, draft.message, draft.couponCode, draft.imageUrl, language) }) }).catch(() => null);
      return { name: customer.name, phone: customer.phone, email: customer.email, status: response?.ok ? "Sent" : "Failed" };
    }));
    setCampaigns((current) => [{ id: `campaign-${Date.now()}`, ...draft, sentAt: new Date().toISOString(), recipients: recipients.map((customer) => delivered.find((item) => item.email === customer.email) || ({ name: customer.name, phone: customer.phone, email: customer.email || "No email", status: "No email" })) }, ...current]);
  }

  async function uploadCampaignImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/transfer-upload", { method: "POST", body: form }).catch(() => null);
    const result = response ? await response.json().catch(() => ({})) : {};
    if (!response?.ok || !result?.url) {
      window.alert(result?.message || "Không thể tải ảnh lên máy chủ.");
      return;
    }
    setDraft((current) => ({ ...current, imageUrl: result.url, imageName: file.name }));
  }

  return (
    <>
      <div className="pageHead"><div><p className="eyebrow">CRM</p><h1>{label}</h1><p>{tr("desc")}</p></div><button className="primary" form="campaignForm">{tr("sendNotice")}</button></div>
      <section className="card customerCampaignPanel">
        <div className="sectionTitle"><div><h2>{tr("campaignTitle")}</h2><p>{tr("campaignDesc")}</p></div></div>
        <div className="campaignAudienceNote">{selectedCustomerKeys.length ? tr("selectedRecipients", { count: selectedCustomerKeys.length }) : tr("groupRecipients")}</div>
        <form id="campaignForm" className="campaignForm" onSubmit={sendCampaign}>
          <label>{tr("subject")}<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label>{tr("type")}<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}><option value="promotion">{tr("promotion")}</option><option value="event">{tr("event")}</option><option value="notice">{tr("notice")}</option></select></label>
          <label>{tr("target")}<select value={draft.target} onChange={(event) => setDraft({ ...draft, target: event.target.value })}><option value="old">{tr("oldCustomers")}</option><option value="buyers">{tr("buyers")}</option><option value="bookers">{tr("bookers")}</option></select></label>
          <label>{tr("couponCode")}<input value={draft.couponCode} onChange={(event) => setDraft({ ...draft, couponCode: event.target.value })} /></label>
          <label>{tr("campaignImage")}<input type="file" accept="image/*" onChange={uploadCampaignImage} /></label>
          <label className="campaignMessage">{tr("message")}<textarea rows={8} value={draft.message} onChange={(event) => setDraft({ ...draft, message: event.target.value })} /></label>
          {draft.imageUrl && <div className="imagePreview"><img src={draft.imageUrl} alt={draft.title || "Campaign"} /><span>{draft.imageName}</span></div>}
        </form>
      </section>
      <div className="customerGrid">
        <section className="card tableWrap"><table><thead><tr><th className="customerSelectHead"><input type="checkbox" checked={customerList.filter((customer) => customer.email).length > 0 && selectedCustomerKeys.length === customerList.filter((customer) => customer.email).length} onChange={toggleAllCustomers} aria-label={tr("selectAllCustomers")} /></th><th>{tc("customer")}</th><th>{tc("phone")}</th><th>{tc("email")}</th><th>{tr("bookings")}</th><th>{tr("orders")}</th><th>{tr("spend")}</th><th>{tr("typeCol")}</th><th>{tc("action")}</th></tr></thead><tbody>{customerList.map((customer) => { const key = customerKey(customer); return <tr key={key}><td className="customerSelectCell"><input type="checkbox" checked={selectedCustomerKeys.includes(key)} disabled={!customer.email} onChange={() => toggleCustomer(customer)} aria-label={`${tr("selectCustomer")} ${customer.name}`} /></td><td><strong>{customer.name}</strong></td><td>{customer.phone}</td><td>{customer.email || "-"}</td><td>{customer.bookingCount || customer.visits || 0}</td><td>{customer.orderCount || 0}</td><td>{yen(customer.spend)}</td><td><span className="pill">{customer.tag}</span></td><td><button type="button" className="ghost dangerButton customerDeleteButton" onClick={() => deleteCustomer(customer)}>{tc("delete")}</button></td></tr>; })}</tbody></table></section>
        <aside className="card campaignLog"><h2>{tr("campaignLog")}</h2>{campaigns.length ? campaigns.map((campaign) => <div className="campaignItem" key={campaign.id}><strong>{campaign.title}</strong><span>{tr("recipientCount", { count: campaign.recipients.length })} · {new Date(campaign.sentAt).toLocaleString("ja-JP")}</span>{campaign.couponCode && <span className="pill">{tr("coupon")} {campaign.couponCode}</span>}{campaign.imageUrl && <img className="catalogThumb" src={campaign.imageUrl} alt={campaign.title} />}<small>{campaign.message}</small></div>) : <p>{tr("noCampaign")}</p>}</aside>
      </div>
    </>
  );
}

