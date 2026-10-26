"use client";

import { useEffect, useState } from "react";

export default function BookingAssignment({ token }) {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/booking-assignment?token=${encodeURIComponent(token || "")}`, { cache: "no-store" })
      .then(async (response) => ({ response, result: await response.json().catch(() => ({})) }))
      .then(({ response, result }) => {
        if (!response.ok) throw new Error(result.message || "Không thể mở lịch hẹn.");
        setData(result);
        setSelected(String(result.booking.staffId || ""));
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function assign(event) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/booking-assignment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, staffId: selected }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.message || "Không thể phân công nhân viên.");
      setData((current) => ({ ...current, booking: result.booking }));
      setMessage(result.notification?.ok ? `Đã phân công cho ${result.booking.staff} và gửi email thông báo.` : `Đã phân công cho ${result.booking.staff}. Nhân viên chưa có email hoặc Resend chưa được cấu hình.`);
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  }

  return <main className="assignmentPage"><section className="assignmentCard">
    <div className="assignmentBrand"><span>M</span><div><strong>Mai Beauty Salon</strong><small>BOOKING ASSIGNMENT</small></div></div>
    {loading && <p className="assignmentStatus">Đang tải lịch hẹn…</p>}
    {!loading && !data && <p className="assignmentStatus error" role="alert">{message}</p>}
    {data && <><header><p className="eyebrow">LịCH HẸN CHỜ PHÂN CÔNG</p><h1>Chọn nhân viên</h1><p>Nhân viên được chọn sẽ nhận email và lịch sẽ cập nhật vào lịch chung.</p></header>
      <div className="assignmentSummary"><p><span>Khách hàng</span><strong>{data.booking.customer}</strong></p><p><span>Ngày giờ</span><strong>{data.booking.date} · {data.booking.start}–{data.booking.end}</strong></p><p><span>Dịch vụ</span><strong>{data.booking.service}</strong></p></div>
      <form onSubmit={assign}><div className="assignmentStaffGrid"><label className={selected === "__NO_PREFERENCE__" ? "selected" : ""}><input type="radio" name="staff" value="__NO_PREFERENCE__" checked={selected === "__NO_PREFERENCE__"} onChange={(event) => setSelected(event.target.value)} /><span className="assignmentAvatar">○</span><span><strong>Không yêu cầu chỉ định</strong><small>Salon tự động chọn nhân viên đang trống phù hợp</small></span></label>{data.staff.map((member) => <label className={selected === String(member.id) ? "selected" : ""} key={member.id}><input type="radio" name="staff" value={member.id} checked={selected === String(member.id)} onChange={(event) => setSelected(event.target.value)} disabled={!member.available} /><span className="assignmentAvatar" style={{ background: member.color || "#a93670" }}>{member.name?.[0]}</span><span><strong>{member.name} · {member.available ? "Trống" : "Đang bận"}</strong><small>{member.role || "Nailist"}{member.previousBooking ? ` · Lịch trước ${member.previousBooking.start}-${member.previousBooking.end}` : " · Trống từ đầu ngày"}{member.hasEmail ? " · Email OK" : " · Chưa có email"}</small></span></label>)}</div><button className="primary" type="submit" disabled={!selected || saving}>{saving ? "Đang phân công…" : "Xác nhận nhân viên"}</button></form>
      {message && <p className="assignmentStatus" role="status">{message}</p>}
    </>}
  </section></main>;
}
