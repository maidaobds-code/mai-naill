"use client";

import { useEffect, useState } from "react";
import { verifySignupToken } from "../../../lib/supabaseBrowser";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Đang xác nhận email…");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token_hash") || params.get("token");
    if (!token) { setMessage("Liên kết xác nhận không hợp lệ hoặc đã hết hạn."); return; }
    verifySignupToken(token, params.get("type") || "signup")
      .then(() => setMessage("Email đã được xác nhận. Bạn có thể quay lại đăng nhập."))
      .catch((error) => setMessage(error.message));
  }, []);
  return <main className="loginPage"><section className="accountAuth card"><h1>Mai Beauty Salon</h1><p>{message}</p><a className="primary" href="/">Quay lại đăng nhập</a></section></main>;
}
