"use client";

import { useState } from "react";
import { useAccountStore } from "../lib/accountStore";
import { useStoreOrders } from "../lib/orderStore";

export function AccountGate() {
  const { accounts, currentAccount, login, logout, setupOwner, registerCustomer } = useAccountStore();
  const ownerReady = accounts.some((account) => account.role === "owner" && account.passwordHash);
  const [mode, setMode] = useState(ownerReady ? "login" : "owner");
  const [form, setForm] = useState({ name: "", email: ownerReady ? "" : "owner@salon.local", password: "", phone: "", address: "" });
  const [message, setMessage] = useState("");

  if (currentAccount) {
    return <div className="accountStrip"><span>{currentAccount.role === "owner" ? "Chủ quán" : currentAccount.role === "staff" ? "Nhân viên" : "Khách hàng"} · {currentAccount.name}</span><button className="ghost" onClick={logout}>Đăng xuất</button></div>;
  }

  async function submit(event) {
    event.preventDefault();
    const result = mode === "owner" ? await setupOwner(form) : mode === "register" ? await registerCustomer(form) : await login(form.email, form.password);
    setMessage(result.message || "");
  }

  return (
    <section className="accountAuth card">
      <div>
        <p className="eyebrow">{mode === "owner" ? "OWNER SETUP" : mode === "register" ? "CUSTOMER ACCOUNT" : "LOGIN"}</p>
        <h1>{mode === "owner" ? "Tạo tài khoản chủ quán" : mode === "register" ? "Đăng ký khách hàng bằng Gmail" : "Đăng nhập tài khoản"}</h1>
      </div>
      <form onSubmit={submit} className="accountForm">
        {mode !== "login" && <label>Tên<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>}
        <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required placeholder={mode === "register" ? "yourname@gmail.com" : "owner@salon.local"} /></label>
        <label>Mật khẩu<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={6} /></label>
        {mode === "register" && <><label>Số điện thoại<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>Địa chỉ<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label></>}
        {message && <p className="storeNote">{message}</p>}
        <button className="primary" type="submit">{mode === "register" ? "Đăng ký" : mode === "owner" ? "Tạo chủ quán" : "Đăng nhập"}</button>
      </form>
      {ownerReady && <div className="accountSwitch"><button className="ghost" onClick={() => setMode("login")}>Đăng nhập</button><button className="ghost" onClick={() => setMode("register")}>Khách hàng đăng ký Gmail</button></div>}
    </section>
  );
}

export function CustomerProfile({ onClose }) {
  const { currentAccount, updateProfile } = useAccountStore();
  const { orders, addChatMessage } = useStoreOrders();
  const [draft, setDraft] = useState(() => ({ name: currentAccount?.name || "", phone: currentAccount?.phone || "", address: currentAccount?.address || "" }));
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const customerOrders = orders.filter((order) => order.email?.toLowerCase() === currentAccount?.email?.toLowerCase() || order.phone === currentAccount?.phone);
  const selectedOrder = customerOrders.find((order) => order.id === selectedOrderId) || customerOrders[0];

  if (!currentAccount) return null;

  function saveProfile() {
    updateProfile(draft);
  }

  function sendMessage() {
    if (!selectedOrder || !chatDraft.trim()) return;
    addChatMessage(selectedOrder.id, chatDraft, "customer");
    setChatDraft("");
  }

  return (
    <div className="customerProfilePanel card">
      <div className="modalHead"><div><p className="eyebrow">MY PAGE</p><h2>Trang cá nhân</h2></div><button className="ghost" onClick={onClose}>Close</button></div>
      <div className="profileGrid">
        <label>Tên<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>Số điện thoại<input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label>
        <label className="fullField">Địa chỉ<input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></label>
        <button className="primary" onClick={saveProfile}>Lưu thông tin</button>
      </div>
      <div className="profileOrders">
        <h3>Theo dõi đơn hàng</h3>
        <div className="profileOrderList">{customerOrders.length ? customerOrders.map((order) => <button key={order.id} className={selectedOrder?.id === order.id ? "active" : ""} onClick={() => setSelectedOrderId(order.id)}><strong>{order.orderNumber}</strong><span>{order.productName}</span><small>{order.status} · {order.paymentStatus}</small></button>) : <p className="storeNote">Chưa có đơn hàng theo tài khoản này.</p>}</div>
        {selectedOrder && <div className="profileOrderChat"><strong>{selectedOrder.orderNumber}</strong><span>{selectedOrder.status} · {selectedOrder.paymentStatus}</span><small>Thông báo điện thoại: cần bật push notification khi triển khai thật.</small><div>{(selectedOrder.chat || []).map((item) => <p key={item.id} className={item.from === "customer" ? "fromCustomer" : ""}>{item.text}</p>)}</div><div className="chatComposer"><input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Nhắn tin với chủ quán" /><button className="primary" onClick={sendMessage}>Gửi</button></div></div>}
      </div>
    </div>
  );
}
