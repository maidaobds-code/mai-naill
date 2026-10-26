"use client";

import { useEffect, useState } from "react";
import { useAccountStore } from "../lib/accountStore";
import { useStoreOrders } from "../lib/orderStore";
import { useBookingStore } from "../lib/bookingStore";
import { languages, tx } from "../lib/i18nClean";

const LOGIN_LANGUAGE_KEY = "nail-japan-login-language";

const loginCopy = {
  zh: { roleOwner: "店主", roleStaff: "员工", roleCustomer: "客户", logout: "退出登录", login: "登录", loginText: "请输入账户邮箱和密码。", email: "邮箱 / 管理员账号", password: "密码", confirmPassword: "确认密码", passwordMismatch: "两次密码不一致。", showPassword: "显示密码", hidePassword: "隐藏密码", createAccount: "创建账户", gmailLogin: "使用 Gmail 直接登录", customerAccount: "创建客户账户", customerText: "仅限客户使用，请使用 Gmail 注册。", name: "姓名", phone: "电话", backToLogin: "返回登录", brandText: "为预约、购物和客户服务打造的沙龙空间。", language: "语言" },
  ko: { roleOwner: "점주", roleStaff: "직원", roleCustomer: "고객", logout: "로그아웃", login: "로그인", loginText: "계정 이메일과 비밀번호를 입력하세요.", email: "이메일 / 관리자 계정", password: "비밀번호", confirmPassword: "비밀번호 확인", passwordMismatch: "비밀번호가 일치하지 않습니다.", showPassword: "비밀번호 표시", hidePassword: "비밀번호 숨기기", createAccount: "계정 만들기", gmailLogin: "Gmail로 직접 로그인", customerAccount: "고객 계정 만들기", customerText: "고객 전용입니다. Gmail로 가입하세요.", name: "이름", phone: "전화번호", backToLogin: "로그인으로 돌아가기", brandText: "예약, 쇼핑, 고객 관리를 위한 살롱 공간입니다.", language: "언어" },
  vi: {
    roleOwner: "Chủ quán",
    roleStaff: "Nhân viên",
    roleCustomer: "Khách hàng",
    logout: "Đăng xuất",
    login: "Đăng nhập",
    loginText: "Nhập email và mật khẩu tài khoản của bạn.",
    email: "Email / Admin user",
    password: "Mật khẩu",
    confirmPassword: "Nhập lại mật khẩu",
    passwordMismatch: "Hai mật khẩu không trùng nhau.",
    showPassword: "Hiển thị mật khẩu",
    hidePassword: "Ẩn mật khẩu",
    createAccount: "Tạo tài khoản",
    gmailLogin: "Đăng nhập bằng tài khoản Gmail trực tiếp",
    customerAccount: "Tạo tài khoản khách hàng",
    customerText: "Chỉ dành cho khách hàng. Vui lòng dùng Gmail để đăng ký.",
    name: "Tên",
    phone: "Số điện thoại",
    backToLogin: "Quay lại đăng nhập",
    brandText: "Không gian đặt lịch, mua hàng và chăm sóc khách hàng dành riêng cho salon.",
    language: "Ngôn ngữ",
  },
  ja: {
    roleOwner: "オーナー",
    roleStaff: "スタッフ",
    roleCustomer: "お客様",
    logout: "ログアウト",
    login: "ログイン",
    loginText: "メールまたは管理者ユーザー名とパスワードを入力してください。",
    email: "メール / 管理者ユーザー",
    password: "パスワード",
    confirmPassword: "パスワード（確認）",
    passwordMismatch: "パスワードが一致しません。",
    showPassword: "パスワードを表示",
    hidePassword: "パスワードを隠す",
    createAccount: "アカウント作成",
    gmailLogin: "Gmailアカウントでログイン",
    customerAccount: "お客様アカウント作成",
    customerText: "お客様専用です。Gmailで登録してください。",
    name: "名前",
    phone: "電話番号",
    backToLogin: "ログインに戻る",
    brandText: "予約、ショッピング、顧客ケアをまとめたサロン専用スペースです。",
    language: "言語",
  },
  en: {
    roleOwner: "Owner",
    roleStaff: "Staff",
    roleCustomer: "Customer",
    logout: "Log out",
    login: "Log in",
    loginText: "Enter your account email and password.",
    email: "Email / Admin user",
    password: "Password",
    confirmPassword: "Confirm password",
    passwordMismatch: "The passwords do not match.",
    showPassword: "Show password",
    hidePassword: "Hide password",
    createAccount: "Create account",
    gmailLogin: "Log in directly with Gmail",
    customerAccount: "Create customer account",
    customerText: "For customers only. Please register with Gmail.",
    name: "Name",
    phone: "Phone",
    backToLogin: "Back to login",
    brandText: "A dedicated salon space for booking, shopping, and customer care.",
    language: "Language",
  },
};

function localizedLoginMessage(message, language) {
  const text = String(message || "").toLowerCase();
  const messages = {
    vi: { admin: "Sai tài khoản hoặc mật khẩu admin.", sync: "Tài khoản nhân viên chưa được đồng bộ lên máy chủ.", missing: "Tài khoản chưa có mật khẩu. Chủ quán cần tạo hoặc đổi mật khẩu.", invalid: "Sai email hoặc mật khẩu." },
    ja: { admin: "管理者ユーザー名またはパスワードが正しくありません。", sync: "スタッフアカウントがサーバーに同期されていません。", missing: "このアカウントにはパスワードがありません。オーナーが設定してください。", invalid: "メールアドレスまたはパスワードが正しくありません。" },
    en: { admin: "The admin username or password is incorrect.", sync: "The staff account has not been synchronized to the server.", missing: "This account has no password yet. The owner must set one.", invalid: "The email or password is incorrect." },
  }[language] || null;
  if (!messages) return message || "";
  if (text.includes("admin")) return messages.admin;
  if (text.includes("chưa được đồng bộ") || text.includes("not synchronized")) return messages.sync;
  if (text.includes("chưa có mật khẩu") || text.includes("no password")) return messages.missing;
  if (text.includes("sai email") || text.includes("incorrect")) return messages.invalid;
  return message || "";
}

function storedLoginLanguage() {
  if (typeof window === "undefined") return "vi";
  return window.localStorage.getItem(LOGIN_LANGUAGE_KEY) || "vi";
}

function PasswordVisibilityIcon({ visible }) {
  return visible ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 3l18 18M10.58 10.58a2 2 0 0 0 2.83 2.83M9.88 4.24A10.94 10.94 0 0 1 12 4c5 0 8.73 4.11 9.8 6.01a3.1 3.1 0 0 1 0 1.98 11.67 11.67 0 0 1-3.03 3.68M6.1 6.1A12.5 12.5 0 0 0 2.2 10c-.27.5-.27 1.1 0 1.6C3.27 13.5 7 17.61 12 17.61c1.1 0 2.14-.2 3.1-.55" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M2.2 11.6C3.27 9.7 7 5.59 12 5.59s8.73 4.11 9.8 6.01c.27.5.27 1.1 0 1.6-1.07 1.9-4.8 6.01-9.8 6.01s-8.73-4.11-9.8-6.01a1.7 1.7 0 0 1 0-1.6Z" />
      <circle cx="12" cy="12.4" r="2.8" />
    </svg>
  );
}

export function AccountGate({ language = "vi", setLanguage }) {
  const { currentAccount, login, logout, loginWithGoogle, registerCustomer } = useAccountStore();
  const [showRegister, setShowRegister] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [customerPasswordConfirmation, setCustomerPasswordConfirmation] = useState("");
  const [showCustomerPassword, setShowCustomerPassword] = useState(false);
  const [showCustomerPasswordConfirmation, setShowCustomerPasswordConfirmation] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");
  const [registerMessage, setRegisterMessage] = useState("");
  const copy = loginCopy[language] || loginCopy.vi;

  function changeLanguage(value) {
    window.localStorage.setItem(LOGIN_LANGUAGE_KEY, value);
    setLanguage?.(value);
  }

  if (currentAccount) {
    return <div className="accountStrip"><span>{currentAccount.role === "owner" ? copy.roleOwner : currentAccount.role === "staff" ? copy.roleStaff : copy.roleCustomer} · {currentAccount.name}</span><select data-language={language} className="accountLanguageSelect" value={language} onChange={(event) => changeLanguage(event.target.value)} aria-label={copy.language}>{languages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select><button className="ghost" onClick={logout}>{copy.logout}</button></div>;
  }

  async function submitLogin(event) {
    event.preventDefault();
    const result = await login(loginForm.email, loginForm.password);
    setLoginMessage(localizedLoginMessage(result.message, language));
  }

  async function submitCustomer(event) {
    event.preventDefault();
    if (customerForm.password !== customerPasswordConfirmation) {
      setRegisterMessage(copy.passwordMismatch);
      return;
    }
    const result = await registerCustomer({ ...customerForm, language });
    setRegisterMessage(result.message || "");
  }

  function startGoogleLogin() {
    const result = loginWithGoogle();
    setLoginMessage(localizedLoginMessage(result.message, language));
  }

  if (showRegister) {
    return (
      <section className="accountAuthSplit singleAuth">
        <form onSubmit={submitCustomer} className="accountAuth card accountRegisterCard">
          <div className="loginLanguageSelect"><span>{copy.language}</span><select data-language={language} aria-label={copy.language} value={language} onChange={(event) => changeLanguage(event.target.value)}>{languages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></div>
          <div>
            <p className="eyebrow">CUSTOMER ACCOUNT</p>
            <h1>{copy.customerAccount}</h1>
            <p>{copy.customerText}</p>
          </div>
          <label>{copy.name}<span className="loginInputShell userIcon"><input value={customerForm.name} onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })} required /></span></label>
          <label>Gmail<span className="loginInputShell mailIcon"><input type="email" value={customerForm.email} onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })} required placeholder="yourname@gmail.com" /></span></label>
          <label>{copy.password}<span className="loginInputShell lockIcon"><input type={showCustomerPassword ? "text" : "password"} value={customerForm.password} onChange={(event) => setCustomerForm({ ...customerForm, password: event.target.value })} required minLength={6} /><button className="passwordVisibilityButton" type="button" onClick={() => setShowCustomerPassword((visible) => !visible)} aria-label={showCustomerPassword ? copy.hidePassword : copy.showPassword} title={showCustomerPassword ? copy.hidePassword : copy.showPassword}><PasswordVisibilityIcon visible={showCustomerPassword} /></button></span></label>
          <label>{copy.confirmPassword}<span className="loginInputShell lockIcon"><input type={showCustomerPasswordConfirmation ? "text" : "password"} value={customerPasswordConfirmation} onChange={(event) => setCustomerPasswordConfirmation(event.target.value)} required minLength={6} /><button className="passwordVisibilityButton" type="button" onClick={() => setShowCustomerPasswordConfirmation((visible) => !visible)} aria-label={showCustomerPasswordConfirmation ? copy.hidePassword : copy.showPassword} title={showCustomerPasswordConfirmation ? copy.hidePassword : copy.showPassword}><PasswordVisibilityIcon visible={showCustomerPasswordConfirmation} /></button></span></label>
          <label>{copy.phone}<span className="loginInputShell phoneIcon"><input value={customerForm.phone} onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })} /></span></label>
          {registerMessage && <p className="storeNote">{registerMessage}</p>}
          <div className="loginButtonRow"><button className="ghost" type="button" onClick={() => setShowRegister(false)}>{copy.backToLogin}</button><button className="primary" type="submit">{copy.createAccount}</button></div>
        </form>
      </section>
    );
  }

  return (
    <section className="accountAuthSplit singleAuth">
      <form onSubmit={submitLogin} className="accountAuth card accountLoginCard">
        <div className="loginLanguageSelect"><span>{copy.language}</span><select data-language={language} aria-label={copy.language} value={language} onChange={(event) => changeLanguage(event.target.value)}>{languages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></div>
        <div>
          <p className="eyebrow">LOGIN</p>
          <h1>{copy.login}</h1>
          <p>{copy.loginText}</p>
        </div>
        <label>{copy.email}<span className="loginInputShell mailIcon"><input value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} required placeholder="admin@example.com" /></span></label>
        <label>{copy.password}<span className="loginInputShell lockIcon"><input type={showLoginPassword ? "text" : "password"} value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} required minLength={6} /><button className="passwordVisibilityButton" type="button" onClick={() => setShowLoginPassword((visible) => !visible)} aria-label={showLoginPassword ? copy.hidePassword : copy.showPassword} title={showLoginPassword ? copy.hidePassword : copy.showPassword}><PasswordVisibilityIcon visible={showLoginPassword} /></button></span></label>
        {loginMessage && <p className="storeNote">{loginMessage}</p>}
        <div className="loginButtonRow"><button className="ghost" type="button" onClick={() => setShowRegister(true)}>{copy.createAccount}</button><button className="primary" type="submit">{copy.login}</button></div>
        <button className="gmailLoginButton" type="button" onClick={startGoogleLogin}>{copy.gmailLogin}</button>
      </form>
    </section>
  );
}

export function LoginPage() {
  const [language, setLanguage] = useState(storedLoginLanguage);
  const [logoUrl, setLogoUrl] = useState("");
  const copy = loginCopy[language] || loginCopy.vi;

  useEffect(() => {
    let mounted = true;
    const readLogo = () => { try { setLogoUrl(JSON.parse(window.localStorage.getItem("nail-japan-settings") || "{}").logoUrl || ""); } catch {} };
    const readServerLogo = async () => {
      try {
        const response = await fetch("/api/settings?public=1", { cache: "no-store" });
        const result = response.ok ? await response.json() : null;
        if (!mounted || !result?.value) return;
        const local = JSON.parse(window.localStorage.getItem("nail-japan-settings") || "{}");
        const next = { ...local, ...result.value };
        window.localStorage.setItem("nail-japan-settings", JSON.stringify(next));
        setLogoUrl(next.logoUrl || "");
      } catch {}
    };
    readLogo();
    readServerLogo();
    window.addEventListener("storage", readLogo);
    window.addEventListener("nail-japan-settings-updated", readLogo);
    return () => { mounted = false; window.removeEventListener("storage", readLogo); window.removeEventListener("nail-japan-settings-updated", readLogo); };
  }, []);

  return (
    <div className="loginPage">
      <div className="loginBrandPanel">
        {logoUrl ? <img className="brandMark large appLoginLogo" src={logoUrl} alt="Mai Beauty Salon" /> : <div className="brandMark large">M</div>}
        <p className="eyebrow">MAI BEAUTY SALON</p>
        <h1>Mai Beauty Salon</h1>
        <p>{copy.brandText}</p>
      </div>
      <AccountGate language={language} setLanguage={setLanguage} />
    </div>
  );
}

export function CustomerProfile({ language = "vi", onClose }) {
  const tc = (key) => tx(language, "common", key);
  const tr = (key) => tx(language, "customerProfile", key);
  const { currentAccount, logout, updateProfile } = useAccountStore();
  const { orders, updateOrder, cancelOrder, addChatMessage } = useStoreOrders();
  const { bookings } = useBookingStore();
  const [draft, setDraft] = useState(() => ({ name: currentAccount?.name || "", phone: currentAccount?.phone || "", address: currentAccount?.address || "" }));
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState("");
  const imageCopy = {
    vi: { send: "Gửi ảnh", uploading: "Đang gửi ảnh…", sent: "Đã gửi ảnh cho chủ quán.", error: "Không thể gửi ảnh." },
    en: { send: "Send image", uploading: "Sending image…", sent: "Image sent to the salon owner.", error: "Unable to send image." },
    ja: { send: "画像を送信", uploading: "画像を送信中…", sent: "店舗に画像を送信しました。", error: "画像を送信できません。" },
  }[language] || { send: "Gửi ảnh", uploading: "Đang gửi ảnh…", sent: "Đã gửi ảnh cho chủ quán.", error: "Không thể gửi ảnh." };
  const orderActionCopy = {
    vi: { cancel: "Hủy đơn", cannotCancel: "Đơn đã gửi, không thể hủy", cancelConfirm: "Bạn có chắc muốn hủy đơn này?" },
    en: { cancel: "Cancel order", cannotCancel: "Shipped orders cannot be cancelled", cancelConfirm: "Are you sure you want to cancel this order?" },
    ja: { cancel: "注文をキャンセル", cannotCancel: "発送済みの注文はキャンセルできません", cancelConfirm: "この注文をキャンセルしますか？" },
  }[language] || { cancel: "Hủy đơn", cannotCancel: "Đơn đã gửi, không thể hủy", cancelConfirm: "Bạn có chắc muốn hủy đơn này?" };
  const customerEmail = currentAccount?.email?.trim().toLowerCase();
  const customerPhone = currentAccount?.phone?.replace(/\D/g, "");
  const customerOrders = orders.filter((order) =>
    (order.customerAccountId && order.customerAccountId === currentAccount?.id) ||
    (customerEmail && order.email?.trim().toLowerCase() === customerEmail) ||
    (customerPhone && order.phone?.replace(/\D/g, "") === customerPhone)
  );
  const customerBookings = bookings.filter((booking) =>
    (booking.customerAccountId && booking.customerAccountId === currentAccount?.id) ||
    (customerEmail && booking.email?.trim().toLowerCase() === customerEmail) ||
    (customerPhone && booking.phone?.replace(/\D/g, "") === customerPhone)
  );
  const selectedOrder = customerOrders.find((order) => order.id === selectedOrderId) || customerOrders[0];
  const canCancelSelectedOrder = selectedOrder && !["Shipping", "Delivered", "Completed", "Cancelled"].includes(selectedOrder.status);

  useEffect(() => {
    setDraft({ name: currentAccount?.name || "", phone: currentAccount?.phone || "", address: currentAccount?.address || "" });
  }, [currentAccount?.id, currentAccount?.name, currentAccount?.phone, currentAccount?.address]);

  if (!currentAccount) return null;

  function saveProfile() {
    updateProfile(draft);
  }

  function signOut() {
    logout();
    onClose?.();
  }

  function sendMessage() {
    if (!selectedOrder || !chatDraft.trim()) return;
    addChatMessage(selectedOrder.id, chatDraft, "customer");
    setChatDraft("");
  }

  async function sendImage(event) {
    const file = event.target.files?.[0];
    if (!file || !selectedOrder) return;
    setImageUploading(true);
    setImageUploadError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/transfer-upload", { method: "POST", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.url) throw new Error(result.message || imageCopy.error);
      updateOrder(selectedOrder.id, { transferBillUrl: result.url, paymentStatus: "Payment checking" });
      addChatMessage(selectedOrder.id, imageCopy.sent, "customer");
    } catch (error) {
      setImageUploadError(error.message || imageCopy.error);
    } finally {
      setImageUploading(false);
      event.target.value = "";
    }
  }

  function cancelSelectedOrder() {
    if (canCancelSelectedOrder && window.confirm(orderActionCopy.cancelConfirm)) cancelOrder(selectedOrder.id);
  }

  return (
    <div className="customerProfilePanel card">
      <div className="modalHead"><div><p className="eyebrow">MY PAGE</p><h2>{tr("title")}</h2></div><div className="profileModalActions"><button className="ghost dangerGhost" onClick={signOut}>{tr("logout")}</button><button className="ghost" onClick={onClose}>{tc("close")}</button></div></div>
      <div className="profileGrid">
        <label>{tr("name")}<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>{tc("email")}<input value={currentAccount.email || ""} readOnly /></label>
        <label>{tc("phone")}<input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label>
        <label className="fullField">{tc("address")}<input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></label>
        <button className="primary" onClick={saveProfile}>{tr("saveProfile")}</button>
      </div>
      <div className="profileOrders">
        <h3>{language === "ja" ? "予約履歴" : language === "en" ? "Appointments" : "Lịch hẹn của tôi"}</h3>
        <div className="profileBookingList">{customerBookings.length ? customerBookings.map((booking) => <article key={booking.id}><div><strong>{booking.service}</strong><span>{booking.status}</span></div><p>{booking.date || `Day ${booking.day}`} · {booking.start}–{booking.end}</p><small>{booking.staff} · {booking.origin}</small></article>) : <p className="storeNote">{language === "ja" ? "予約はまだありません。" : language === "en" ? "No appointments yet." : "Chưa có lịch hẹn nào."}</p>}</div>
        <h3>{tr("trackOrders")}</h3>
        {selectedOrder && <div className="profileOrderActions"><button className="ghost" onClick={cancelSelectedOrder} disabled={!canCancelSelectedOrder}>{canCancelSelectedOrder ? orderActionCopy.cancel : orderActionCopy.cannotCancel}</button></div>}
        <div className="profileOrderList">{customerOrders.length ? customerOrders.map((order) => <button key={order.id} className={selectedOrder?.id === order.id ? "active" : ""} onClick={() => setSelectedOrderId(order.id)}><strong>{order.orderNumber}</strong><span>{order.productName}</span><small>{order.status} · {order.paymentStatus}</small></button>) : <p className="storeNote">{tr("noOrders")}</p>}</div>
        {selectedOrder && <div className="profileOrderChat"><strong>{selectedOrder.orderNumber}</strong><span>{selectedOrder.status} · {selectedOrder.paymentStatus}</span><small>{tr("pushNote")}</small>{selectedOrder.transferBillUrl && <img className="profileTransferImage" src={selectedOrder.transferBillUrl} alt={imageCopy.send} />}<div>{(selectedOrder.chat || []).map((item) => <p key={item.id} className={item.from === "customer" ? "fromCustomer" : ""}>{item.text}</p>)}</div><div className="chatComposer"><input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder={tr("chatPlaceholder")} /><button className="primary" onClick={sendMessage}>{tc("send")}</button></div><div className="profileImageUpload"><label className="ghost">{imageUploading ? imageCopy.uploading : imageCopy.send}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={sendImage} disabled={imageUploading} /></label>{imageUploadError && <p className="errorNote">{imageUploadError}</p>}</div></div>}
      </div>
    </div>
  );
}
