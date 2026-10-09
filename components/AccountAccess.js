"use client";

import { useState } from "react";
import { useAccountStore } from "../lib/accountStore";
import { useStoreOrders } from "../lib/orderStore";

export function AccountGate() {
  const { currentAccount, login, logout, loginWithGoogle, registerCustomer } = useAccountStore();
  const [showRegister, setShowRegister] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [customerForm, setCustomerForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [loginMessage, setLoginMessage] = useState("");
  const [registerMessage, setRegisterMessage] = useState("");

  if (currentAccount) {
    return <div className="accountStrip"><span>{currentAccount.role === "owner" ? "Chủ quán" : currentAccount.role === "staff" ? "Nhân viên" : "Khách hàng"} · {currentAccount.name}</span><button className="ghost" onClick={logout}>Đăng xuất</button></div>;
  }

  async function submitLogin(event) {
    event.preventDefault();
    const result = await login(loginForm.email, loginForm.password);
    setLoginMessage(result.message || "");
  }

  async function submitCustomer(event) {
    event.preventDefault();
    const result = await registerCustomer(customerForm);
    setRegisterMessage(result.message || "");
  }

  function startGoogleLogin() {
    const result = loginWithGoogle();
    setLoginMessage(result.message || "");
  }

  if (showRegister) {
    return (
      <section className="accountAuthSplit singleAuth">
        <form onSubmit={submitCustomer} className="accountAuth card accountRegisterCard">
          <div>
            <p className="eyebrow">CUSTOMER ACCOUNT</p>
            <h1>Tạo tài khoản khách hàng</h1>
            <p>Chỉ dành cho khách hàng. Vui lòng dùng Gmail để đăng ký.</p>
          </div>
          <label>Tên<span className="loginInputShell userIcon"><input value={customerForm.name} onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })} required /></span></label>
          <label>Gmail<span className="loginInputShell mailIcon"><input type="email" value={customerForm.email} onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })} required placeholder="yourname@gmail.com" /></span></label>
          <label>Mật khẩu<span className="loginInputShell lockIcon"><input type="password" value={customerForm.password} onChange={(event) => setCustomerForm({ ...customerForm, password: event.target.value })} required minLength={6} /></span></label>
          <label>Số điện thoại<span className="loginInputShell phoneIcon"><input value={customerForm.phone} onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })} /></span></label>
          {registerMessage && <p className="storeNote">{registerMessage}</p>}
          <div className="loginButtonRow"><button className="ghost" type="button" onClick={() => setShowRegister(false)}>Quay lại đăng nhập</button><button className="primary" type="submit">Tạo tài khoản</button></div>
        </form>
      </section>
    );
  }

  return (
    <section className="accountAuthSplit singleAuth">
      <form onSubmit={submitLogin} className="accountAuth card accountLoginCard">
        <div>
          <p className="eyebrow">LOGIN</p>
          <h1>Đăng nhập</h1>
          <p>Nhập email và mật khẩu tài khoản của bạn.</p>
        </div>
        <label>Email<span className="loginInputShell mailIcon"><input type="email" value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} required placeholder="email@example.com" /></span></label>
        <label>Mật khẩu<span className="loginInputShell lockIcon"><input type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} required minLength={6} /></span></label>
        {loginMessage && <p className="storeNote">{loginMessage}</p>}
        <div className="loginButtonRow"><button className="ghost" type="button" onClick={() => setShowRegister(true)}>Tạo tài khoản</button><button className="primary" type="submit">Đăng nhập</button></div>
        <button className="gmailLoginButton" type="button" onClick={startGoogleLogin}>Đăng nhập bằng tài khoản Gmail trực tiếp</button>
      </form>
    </section>
  );
}

export function LoginPage() {
  return (
    <div className="loginPage">
      <div className="loginBrandPanel">
        <div className="brandMark large">M</div>
        <p className="eyebrow">MAI BEAUTY SALON</p>
        <h1>Mai Beauty Salon</h1>
        <p>Không gian đặt lịch, mua hàng và chăm sóc khách hàng dành riêng cho salon.</p>
      </div>
      <AccountGate />
    </div>
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
