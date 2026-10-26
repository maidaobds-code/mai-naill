"use client";
import { useEffect, useRef, useState } from "react";
import { tx } from "../lib/i18nClean";
import { platforms, staff as seedStaff } from "../lib/salonData";
import { useStaffStore } from "../lib/staffStore";
import { useAccountStore } from "../lib/accountStore";
import { useBookingStore } from "../lib/bookingStore";
import { japanToday } from "../lib/bookingMenu";
import { getAppSettings } from "./Settings";

const slots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00"
];
const intervalSlots = slots.slice(0, -1);
const timelineStart = 9 * 60;
const timelineEnd = 23 * 60;

const copy = {
  zh: { desc: "时间横向显示，员工按行排列，预约块按时长展示。", previous: "上一页", today: "今天", next: "下一页", day: "日", week: "周", month: "月", checkout: "收银", newBooking: "+ 新预约", selectedDay: "已选日期", dayBookings: "当天预约", weekTotal: "本周预约", monthTotal: "本月预约", dayView: "日视图", staff: "员工", appointment: "预约", noBooking: "暂无预约", more: "+{count} 个预约", newLabel: "新预约", editLabel: "编辑预约", customer: "客户", phone: "电话号码", platform: "平台", start: "开始", end: "结束", deleteBooking: "删除预约", save: "保存更改", conflict: "该员工此时间段已有其他预约，请选择其他时间。" },
  ko: { desc: "시간은 가로로, 직원은 세로 행으로 표시됩니다. 예약 블록은 소요 시간에 맞춰 표시됩니다.", previous: "이전", today: "오늘", next: "다음", day: "일", week: "주", month: "월", checkout: "결제", newBooking: "+ 새 예약", selectedDay: "선택한 날짜", dayBookings: "오늘의 예약", weekTotal: "주간 예약", monthTotal: "월간 예약", dayView: "일 보기", staff: "직원", appointment: "예약", noBooking: "예약 없음", more: "+{count}개 예약", newLabel: "새 예약", editLabel: "예약 수정", customer: "고객", phone: "전화번호", platform: "플랫폼", start: "시작", end: "종료", deleteBooking: "예약 삭제", save: "변경 저장", conflict: "이 직원에게 겹치는 예약이 있습니다. 다른 시간을 선택하세요." },
  vi: { desc: "Thời gian nằm ngang. Nhân viên là từng hàng dọc. Khối lịch kéo dài theo thời lượng hẹn.", previous: "Trước", today: "Hôm nay", next: "Sau", day: "Ngày", week: "Tuần", month: "Tháng", checkout: "Tính tiền", newBooking: "+ Lịch mới", selectedDay: "Ngày đã chọn", dayBookings: "Lịch trong ngày", weekTotal: "Tổng tuần", monthTotal: "Tổng tháng", dayView: "Xem theo ngày", staff: "Nhân viên", appointment: "lịch hẹn", noBooking: "Chưa có lịch", more: "+{count} lịch khác", newLabel: "LỊCH HẸN MỚI", editLabel: "CHỈNH SỬA LỊCH HẸN", customer: "Khách hàng", phone: "Số điện thoại", platform: "Nền tảng", start: "Bắt đầu", end: "Kết thúc", deleteBooking: "Xóa lịch hẹn", save: "Lưu thay đổi", conflict: "Khoảng thời gian này đã có lịch hẹn của khách khác với nhân viên này. Vui lòng chọn thời gian khác." },
  ja: { desc: "時間は横軸、スタッフは縦の行です。予約ブロックは所要時間に合わせて表示されます。", previous: "前へ", today: "今日", next: "次へ", day: "日", week: "週", month: "月", checkout: "会計", newBooking: "+ 新規予約", selectedDay: "選択日", dayBookings: "当日の予約", weekTotal: "週合計", monthTotal: "月合計", dayView: "日表示", staff: "スタッフ", appointment: "予約", noBooking: "予約なし", more: "+{count}件", newLabel: "新規予約", editLabel: "予約編集", customer: "顧客", phone: "電話番号", platform: "プラットフォーム", start: "開始", end: "終了", deleteBooking: "予約削除", save: "保存して同期", conflict: "この時間帯には、このスタッフの別の予約があります。別の時間を選択してください。" },
  en: { desc: "Time runs horizontally. Staff are vertical rows. Booking blocks stretch by appointment duration.", previous: "Previous", today: "Today", next: "Next", day: "Day", week: "Week", month: "Month", checkout: "Checkout", newBooking: "+ New booking", selectedDay: "Selected day", dayBookings: "Day bookings", weekTotal: "Week total", monthTotal: "Month total", dayView: "Day view", staff: "Staff", appointment: "bookings", noBooking: "No bookings", more: "+{count} more", newLabel: "NEW BOOKING", editLabel: "EDIT BOOKING", customer: "Customer", phone: "Phone", platform: "Platform", start: "Start", end: "End", deleteBooking: "Delete booking", save: "Save and sync", conflict: "This time overlaps another appointment for the selected staff member. Please choose another time." },
};

function platformFor(id) {
  return platforms.find((platform) => platform.id === id) || platforms[0];
}

function staffFor(name, staffList = seedStaff) {
  return staffList.find((member) => member.name === name) || staffList[0] || seedStaff[0];
}

function bookingDay(booking) {
  return booking.day || 6;
}

function addDays(date, amount) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function dateLabel(date) {
  return String(date || "").replaceAll("-", "/");
}

function sameBookingDate(booking, date) {
  if (booking.date) return booking.date === date;
  return bookingDay(booking) === Number(date.slice(-2));
}

function mondayFor(date) {
  const value = new Date(`${date}T12:00:00Z`);
  const offset = (value.getUTCDay() + 6) % 7;
  return addDays(date, -offset);
}

function monthDates(date) {
  const [year, month] = date.split("-").map(Number);
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`);
}

function toMinutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function bookingStyle(booking, rangeStart = timelineStart, rangeEnd = timelineEnd) {
  const start = Math.max(rangeStart, toMinutes(booking.start));
  const end = Math.min(rangeEnd, toMinutes(booking.end));
  const total = rangeEnd - rangeStart;
  return {
    left: `${((start - rangeStart) / total) * 100}%`,
    width: `${Math.max(5, ((end - start) / total) * 100)}%`,
  };
}

function blankBooking(date, hour, member) {
  const day = Number(String(date).slice(-2));
  return {
    id: `draft-${day}-${hour}-${member.id}`,
    day,
    date,
    start: hour,
    end: slots[slots.indexOf(hour) + 2] || "23:00",
    customer: "",
    phone: "",
    service: "Gel One Color",
    staff: member.name,
    staffId: member.id,
    staffEmail: member.email || "",
    staffRole: member.role || "",
    staffPhone: member.phone || "",
    source: "direct",
    draft: true,
  };
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

export default function CalendarResourceTimeline({ label = "Calendar", language = "vi", onCheckout }) {
  const c = copy[language] || copy.vi;
  const tc = (key) => tx(language, "common", key);
  const [view, setView] = useState("day");
  const [selectedDate, setSelectedDate] = useState(japanToday);
  const selectedDay = Number(selectedDate.slice(-2));
  const [selected, setSelected] = useState(() => blankBooking(japanToday(), "10:00", seedStaff[0]));
  const [modalOpen, setModalOpen] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [paintRange, setPaintRange] = useState(null);
  const [bookingError, setBookingError] = useState("");
  const [settings, setSettings] = useState(getAppSettings);
  const { bookings, setBookings, removeBooking } = useBookingStore();
  const { staff: staffMembers } = useStaffStore();
  const { accounts, currentAccount } = useAccountStore();
  const staff = staffMembers.length ? staffMembers : seedStaff;
  const startMinutes = toMinutes(settings.openTime || "09:00");
  const endMinutes = toMinutes(settings.closeTime || "23:00");
  const visibleSlots = slots.filter((slot) => toMinutes(slot) >= startMinutes && toMinutes(slot) <= endMinutes);
  const visibleIntervalSlots = visibleSlots.slice(0, -1);
  const pressRef = useRef(null);
  const paintRef = useRef(null);
  const selectedDayBookings = bookings.filter((booking) => sameBookingDate(booking, selectedDate));
  const weekStart = mondayFor(selectedDate);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const visibleMonthDates = monthDates(selectedDate);
  const weekTotal = bookings.filter((booking) => weekDates.some((date) => sameBookingDate(booking, date))).length;
  const monthTotal = bookings.filter((booking) => visibleMonthDates.some((date) => sameBookingDate(booking, date))).length;

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" }).then((response) => response.json()).then((result) => result.value && setSettings((current) => ({ ...current, ...result.value }))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!staff.length || !selected?.draft) return;
    const current = staff.find((member) => member.name === selected.staff) || staff[0];
    if (current && current.name !== selected.staff) setSelected((value) => ({ ...value, staff: current.name }));
  }, [staff, selected?.draft, selected?.staff]);

  function openDay(date) {
    setSelectedDate(date);
    setView("day");
    setSelected(blankBooking(date, "10:00", staff[0] || seedStaff[0]));
  }

  function beginSelect(hour, member) {
    setDragStart({ hour, member, startedAt: Date.now() });
  }

  function openSelection(hour, member) {
    if (!dragStart || dragStart.member.id !== member.id) {
      setSelected(blankBooking(selectedDate, hour, member));
      setModalOpen(true);
      setDragStart(null);
      return;
    }
    const startIndex = visibleSlots.indexOf(dragStart.hour);
    const endIndex = visibleSlots.indexOf(hour);
    const firstIndex = Math.min(startIndex, endIndex);
    const lastIndex = Math.max(startIndex, endIndex);
    setSelected({ ...blankBooking(selectedDate, visibleSlots[firstIndex], member), end: visibleSlots[Math.min(lastIndex + 1, visibleSlots.length - 1)] });
    setModalOpen(true);
    setDragStart(null);
  }

  function finishSelect(hour, member) {
    if (!dragStart) return;
    if (Date.now() - dragStart.startedAt < 850) {
      setDragStart(null);
      return;
    }
    openSelection(hour, member);
  }

  function beginPaint(event, hour, member) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    paintRef.current = { pointerId: event.pointerId, member, startHour: hour, endHour: hour };
    setPaintRange({ memberId: member.id, startHour: hour, endHour: hour });
  }

  function movePaint(event) {
    const painting = paintRef.current;
    if (!painting || painting.pointerId !== event.pointerId) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".slotHit");
    const hour = target?.dataset?.hour;
    const memberId = target?.dataset?.member;
    if (!hour || memberId !== painting.member.id || hour === painting.endHour) return;
    painting.endHour = hour;
    setPaintRange({ memberId, startHour: painting.startHour, endHour: hour });
  }

  function finishPaint(event) {
    const painting = paintRef.current;
    if (!painting || painting.pointerId !== event.pointerId) return;
    event.preventDefault();
    const startIndex = visibleIntervalSlots.indexOf(painting.startHour);
    const endIndex = visibleIntervalSlots.indexOf(painting.endHour);
    const firstIndex = Math.min(startIndex, endIndex);
    const lastIndex = Math.max(startIndex, endIndex);
    setSelected({ ...blankBooking(selectedDate, visibleSlots[firstIndex], painting.member), end: visibleSlots[Math.min(lastIndex + 1, visibleSlots.length - 1)] });
    paintRef.current = null;
    setPaintRange(null);
    setModalOpen(true);
  }

  function isPainted(hour, memberId) {
    if (!paintRange || paintRange.memberId !== memberId) return false;
    const slotIndex = visibleIntervalSlots.indexOf(hour);
    const startIndex = visibleIntervalSlots.indexOf(paintRange.startHour);
    const endIndex = visibleIntervalSlots.indexOf(paintRange.endHour);
    return slotIndex >= Math.min(startIndex, endIndex) && slotIndex <= Math.max(startIndex, endIndex);
  }

  function openBookingAfterHold(booking) {
    clearTimeout(pressRef.current);
    pressRef.current = setTimeout(() => {
      setSelected(booking);
      setModalOpen(true);
    }, 900);
  }

  function cancelHold() {
    clearTimeout(pressRef.current);
  }

  async function notifyAssignedStaff(booking, previousBooking) {
    const actorEmail = String(currentAccount?.email || "").trim().toLowerCase();
    const accountFor = (member, bookingRecord) => accounts.find((account) => account.email === member?.email || account.name === member?.name || account.staffName === member?.name || account.id === `staff-${member?.id}`) || accounts.find((account) => account.email === bookingRecord?.staffEmail);
    const assigned = staff.find((member) => member.name === booking.staff);
    const previousAssigned = previousBooking && staff.find((member) => member.name === previousBooking.staff);
    const assignedAccount = accountFor(assigned, booking);
    const previousAccount = accountFor(previousAssigned, previousBooking);
    const managerAccounts = accounts.filter((account) => ["owner", "manager"].includes(account.role) && account.email);
    const recipientPairs = [[assigned, assignedAccount, booking.staffEmail], [previousAssigned, previousAccount, previousBooking?.staffEmail], ...managerAccounts.map((account) => [null, account, account.email])];
    const recipients = [...new Map(recipientPairs.filter(([member, account, storedEmail]) => member?.email || account?.email || storedEmail).map(([member, account, storedEmail]) => {
      const email = String(member?.email || account?.email || storedEmail || "").trim().toLowerCase();
      return [email, { ...(member || {}), ...(account || {}), email, name: member?.name || account?.name || booking.staff }];
    })).values()].filter((recipient) => !actorEmail || recipient.email !== actorEmail);
    if (!recipients.length) return;
    const isNew = !previousBooking;
    const relevantFields = ["day", "start", "end", "customer", "phone", "service", "source", "status", "staff", "note"];
    const changed = isNew || relevantFields.some((field) => String(previousBooking?.[field] ?? "") !== String(booking?.[field] ?? ""));
    if (!changed) return;
    const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
    const title = isNew ? "Lịch hẹn mới được phân công" : "Lịch hẹn đã được cập nhật";
    const button = siteUrl ? `<p style="text-align:center;margin:24px 0"><a href="${escapeHtml(siteUrl)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#9333ea;color:#fff;text-decoration:none;font-weight:700">Mở trang quản lý lịch</a></p>` : "";
    const responses = await Promise.all(recipients.map((member) => fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: member.email,
        subject: `Mai Beauty Salon · ${title} · ${booking.customer || "Khách hàng"}`,
        text: `${title}\nKhách hàng: ${booking.customer}\nNgày: ${booking.date || selectedDate}\nGiờ: ${booking.start} - ${booking.end}\nDịch vụ: ${booking.service || "-"}`,
        html: `<div style="margin:0;background:#fff7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#332936"><div style="max-width:600px;margin:auto;background:#fff;border:1px solid #f0dce8;border-radius:20px;overflow:hidden"><div style="padding:22px 28px;background:linear-gradient(135deg,#f6d8ec,#eadcff);font-size:12px;letter-spacing:2px;color:#7c3f62">MAI BEAUTY SALON</div><div style="padding:28px"><h1 style="margin:0 0 16px;font-size:24px">${escapeHtml(title)}</h1><p style="font-size:15px;line-height:1.7">Xin chào ${escapeHtml(member.name)},<br/>${isNew ? "Bạn được phân công một lịch hẹn mới." : "Lịch hẹn liên quan đến bạn vừa được cập nhật."}</p><div style="margin:20px 0;padding:16px;border-radius:14px;background:#fff7fb;border:1px solid #f0dce8"><strong>Khách hàng:</strong> ${escapeHtml(booking.customer)}<br/><strong>Ngày:</strong> ${escapeHtml(booking.date || selectedDate)}<br/><strong>Giờ:</strong> ${escapeHtml(booking.start)} – ${escapeHtml(booking.end)}<br/><strong>Dịch vụ:</strong> ${escapeHtml(booking.service || "-")}</div>${button}<p style="margin:24px 0 0;color:#7b6b78;font-size:13px">Trân trọng,<br/><strong>Mai Beauty Salon</strong></p></div></div></div>`,
      }),
    }).catch(() => null)));
    if (responses.some((response) => !response?.ok)) throw new Error("Không thể gửi email cho nhân viên");
  }

  async function saveBooking() {
    const previousBooking = selected.draft ? null : bookings.find((booking) => booking.id === selected.id) || selected;
    const assigned = staff.find((member) => member.name === selected.staff) || staff.find((member) => String(member.id) === String(selected.staffId)) || staff[0] || seedStaff[0];
    const bookingToSave = {
      ...selected,
      staff: assigned.name,
      staffId: assigned.id,
      staffEmail: assigned.email || accounts.find((account) => account.name === assigned.name || account.staffName === assigned.name)?.email || "",
      staffRole: assigned.role || "",
      staffPhone: assigned.phone || "",
      language: selected.language || "vi",
      id: selected.draft ? `booking-${Date.now()}` : selected.id,
      day: selectedDay,
      date: selectedDate,
      customer: selected.customer || "New customer",
      phone: selected.phone || "090-0000-0000",
      draft: false,
    };
    const startMinutes = toMinutes(bookingToSave.start);
    const endMinutes = toMinutes(bookingToSave.end);
    if (endMinutes <= startMinutes) {
      setBookingError(c.conflict);
      return;
    }
    const conflict = bookings.find((booking) => booking.id !== selected.id && sameBookingDate(booking, selectedDate) && (booking.staff === bookingToSave.staff || String(booking.staffId || "") === String(bookingToSave.staffId)) && startMinutes < toMinutes(booking.end) && endMinutes > toMinutes(booking.start));
    if (conflict) {
      setBookingError(c.conflict);
      return;
    }
    setBookingError("");
    setBookings((current) => {
      const exists = current.some((booking) => booking.id === selected.id);
      if (exists) return current.map((booking) => booking.id === selected.id ? bookingToSave : booking);
      return [...current, bookingToSave];
    });
    setSelected(bookingToSave);
    setModalOpen(false);
    try { await notifyAssignedStaff(bookingToSave, previousBooking); } catch (error) { console.warn(error); }
  }

  async function closeSchedule(scope) {
    const period = `${selectedDate} ${selected.start}-${selected.end}`;
    const next = { ...settings };
    if (scope === "salon") next.closedPeriods = Array.from(new Set([...(settings.closedPeriods || []), period]));
    else next.staffClosedPeriods = Array.from(new Set([...(settings.staffClosedPeriods || []), `${selected.staffId || staff.find((member) => member.name === selected.staff)?.id || selected.staff} ${period}`]));
    setSettings(next);
    window.localStorage.setItem("nail-japan-settings", JSON.stringify(next));
    try { await fetch("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(next) }); } catch {}
    setModalOpen(false);
  }

  function deleteBooking() {
    removeBooking(selected.id);
    setSelected(blankBooking(selectedDate, "10:00", staff[0] || seedStaff[0]));
    setModalOpen(false);
  }

  function checkoutSelected() {
    const bookingToCheckout = selected?.draft ? null : selected;
    if (!bookingToCheckout) return;
    window.localStorage.setItem("nail-japan-checkout-appointment", String(bookingToCheckout.id));
    setModalOpen(false);
    if (onCheckout) onCheckout(String(bookingToCheckout.id));
  }

  return (
    <>
      <div className="pageHead">
        <div>
          <p className="eyebrow">BOOKING CALENDAR</p>
          <h1>{label}</h1>
          <p>{c.desc}</p>
        </div>
        <div className="toolbar">
          <button className="ghost" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>{c.previous}</button>
          <button className="ghost" onClick={() => setSelectedDate(japanToday())}>{c.today}</button>
          <button className="ghost" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>{c.next}</button>
          <button className={view === "day" ? "ghost activeSoft" : "ghost"} onClick={() => setView("day")}>{c.day}</button>
          <button className={view === "week" ? "ghost activeSoft" : "ghost"} onClick={() => setView("week")}>{c.week}</button>
          <button className={view === "month" ? "ghost activeSoft" : "ghost"} onClick={() => setView("month")}>{c.month}</button>
          <button className="ghost" disabled={selected?.draft} onClick={checkoutSelected}>{c.checkout}</button>
          <button className="primary" onClick={() => { setSelected(blankBooking(selectedDate, "10:00", staff[0] || seedStaff[0])); setModalOpen(true); }}>{c.newBooking}</button>
        </div>
      </div>

      <div className="calendarSummary">
        <div className="card summaryPill"><span>{c.selectedDay}</span><strong>{dateLabel(selectedDate)}</strong></div>
        <div className="card summaryPill"><span>{c.dayBookings}</span><strong>{selectedDayBookings.length}</strong></div>
        <div className="card summaryPill"><span>{c.weekTotal}</span><strong>{weekTotal}</strong></div>
        <div className="card summaryPill"><span>{c.monthTotal}</span><strong>{monthTotal}</strong></div>
      </div>

      {view === "day" && (
        <section className="card resourceTimelineShell">
          <div className="calendarHeader">
              <strong>{dateLabel(selectedDate)} · {c.dayView}</strong>
          </div>
          <div className="resourceTimeline">
            <div className="resourceHeader">{c.staff}</div>
            <div className="timeAxis" style={{ gridTemplateColumns: `repeat(${visibleSlots.length}, 64px)` }}>{visibleSlots.map((hour) => <span key={hour}>{hour}</span>)}</div>
            {staff.map((member) => {
              const memberBookings = selectedDayBookings.filter((booking) => booking.staff === member.name || String(booking.staffId || "") === String(member.id));
              return (
                <div className="resourceRow" key={member.id}>
                  <div className="resourceStaff">
                    <div className="avatar small" style={{ background: member.color }}>{member.name[0]}</div>
                    <div><strong>{member.name}</strong><span>{member.status}</span></div>
                  </div>
                  <div className="resourceLane" style={{ backgroundSize: `${100 / Math.max(1, visibleIntervalSlots.length)}% 100%` }}>
                    <div className="slotHitGrid" style={{ gridTemplateColumns: `repeat(${visibleIntervalSlots.length}, 64px)` }}>
                      {visibleIntervalSlots.map((hour) => (
                        <button
                          className={isPainted(hour, member.id) ? "slotHit painting" : "slotHit"}
                          key={`${member.id}-${hour}`}
                          data-hour={hour}
                          data-member={member.id}
                          style={{ "--paint-color": member.color }}
                          onPointerDown={(event) => beginPaint(event, hour, member)}
                          onPointerMove={movePaint}
                          onPointerUp={finishPaint}
                          onPointerCancel={() => { paintRef.current = null; setPaintRange(null); }}
                          onDoubleClick={() => { setSelected(blankBooking(selectedDate, hour, member)); setModalOpen(true); }}
                        />
                      ))}
                    </div>
                    {memberBookings.map((booking) => {
                      const platform = platformFor(booking.source);
                      return (
                        <button
                          className={selected.id === booking.id ? "timelineBooking selectedBar" : "timelineBooking"}
                          key={booking.id}
                          style={{ ...bookingStyle(booking, startMinutes, endMinutes), borderColor: member.color, background: `${member.color}2b` }}
                          onMouseDown={() => openBookingAfterHold(booking)}
                          onMouseUp={cancelHold}
                          onMouseLeave={cancelHold}
                          onTouchStart={() => openBookingAfterHold(booking)}
                          onTouchEnd={cancelHold}
                          onDoubleClick={() => { setSelected(booking); setModalOpen(true); }}
                        >
                          <strong>{booking.start} - {booking.end}</strong>
                          <span>{booking.customer}</span>
                          <small>{booking.phone} · {booking.service} · {platform.name}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {view === "week" && (
        <section className="card weekGrid weekCalendar">
          {weekDates.map((date) => {
            const dayName = new Intl.DateTimeFormat(language === "ja" ? "ja-JP" : language === "vi" ? "vi-VN" : "en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
            const dayNumber = Number(date.slice(-2));
            const dayBookings = bookings.filter((booking) => sameBookingDate(booking, date)).sort((a, b) => a.start.localeCompare(b.start));
            const isSelected = date === selectedDate;
            return (
              <button className={isSelected ? "weekCol weekDayButton selectedWeekDay" : "weekCol weekDayButton"} key={date} onClick={() => openDay(date)}>
                <span className="weekDayTop"><small>{dayName}</small><em>{date.slice(5).replace("-", "/")}</em></span>
                <strong className="weekDayNumber">{dayNumber}</strong>
                <span className="weekCountBadge">{dayBookings.length} {c.appointment}</span>
                <span className="weekBookingList">
                  {dayBookings.slice(0, 3).map((booking) => {
                    const member = staffFor(booking.staff);
                    const platform = platformFor(booking.source);
                    return (
                      <span className="weekBookingCard" key={booking.id} style={{ borderColor: member.color, background: `${member.color}16` }}>
                        <i style={{ background: member.color }} />
                        <span><b>{booking.start}</b> {booking.customer}</span>
                        <small>{booking.service} · {platform.name}</small>
                      </span>
                    );
                  })}
                  {!dayBookings.length && <span className="weekEmptyState">{c.noBooking}</span>}
                  {dayBookings.length > 3 && <span className="weekMore">{String(c.more || "+{count} more").replace("{count}", dayBookings.length - 3)}</span>}
                </span>
              </button>
            );
          })}
        </section>
      )}

      {view === "month" && (
        <section className="card monthGrid">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName) => <div className="monthHead" key={dayName}>{dayName}</div>)}
          {Array.from({ length: (new Date(`${visibleMonthDates[0]}T12:00:00Z`).getUTCDay() + 6) % 7 }, (_, index) => <div className="monthDay monthBlank" key={`blank-${index}`} />)}
          {visibleMonthDates.map((date) => {
            const day = Number(date.slice(-2));
            const dayBookings = bookings.filter((booking) => sameBookingDate(booking, date));
            return <button className={date === selectedDate ? "monthDay selectedMonthDay" : "monthDay"} key={date} onClick={() => openDay(date)}><strong>{day}</strong><span>{dayBookings.length} {c.appointment}</span><em>{dayBookings.slice(0, 4).map((booking) => <i key={booking.id} style={{ background: staffFor(booking.staff).color }} />)}</em></button>;
          })}
        </section>
      )}

      {modalOpen && (
        <div className="bookingModalBackdrop" onMouseDown={() => setModalOpen(false)}>
          <div className="card bookingModal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modalHead"><div><p className="eyebrow">{selected.draft ? c.newLabel : c.editLabel}</p><h2>{selected.customer || c.customer}</h2></div><button className="ghost iconClose" onClick={() => setModalOpen(false)}>{tc("close")}</button></div>
            <div className="selectedRange"><strong>{selected.start} - {selected.end}</strong><span>{dateLabel(selectedDate)} · {selected.staff}</span>{selected.staffRole && <small>{selected.staffRole}{selected.staffEmail ? ` · ${selected.staffEmail}` : ""}</small>}</div>
            <div className="formGrid modalForm">
              <label>{c.customer}<input value={selected.customer} onChange={(event) => setSelected({ ...selected, customer: event.target.value })} placeholder={c.customer} /></label>
              <label>{c.phone}<input value={selected.phone} onChange={(event) => setSelected({ ...selected, phone: event.target.value })} placeholder="090-0000-0000" /></label>
              <label>{c.staff}<select value={selected.staff} onChange={(event) => { const assigned = staff.find((member) => member.name === event.target.value); setSelected({ ...selected, staff: event.target.value, staffId: assigned?.id || "", staffEmail: assigned?.email || "", staffRole: assigned?.role || "", staffPhone: assigned?.phone || "" }); }}>{staff.map((member) => <option key={member.id} value={member.name}>{member.name}{member.role ? ` · ${member.role}` : ""}</option>)}</select></label>
              <label>{c.platform}<select value={selected.source} onChange={(event) => setSelected({ ...selected, source: event.target.value })}>{platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}</select></label>
              <label>{c.start}<select value={selected.start} onChange={(event) => setSelected({ ...selected, start: event.target.value })}>{visibleSlots.map((hour) => <option key={hour}>{hour}</option>)}</select></label>
              <label>{c.end}<select value={selected.end} onChange={(event) => setSelected({ ...selected, end: event.target.value })}>{visibleSlots.map((hour) => <option key={hour}>{hour}</option>)}</select></label>
            </div>
            {bookingError && <p className="bookingConflictNotice" role="alert">{bookingError}</p>}
            <div className="modalActions">
              <button className="ghost" type="button" onClick={() => closeSchedule("staff")}>Đóng lịch nhân viên</button>
              <button className="ghost" type="button" onClick={() => closeSchedule("salon")}>Đóng lịch cả quán</button>
              <button className="ghost dangerButton" onClick={deleteBooking}>{c.deleteBooking}</button>
              <button className="ghost" onClick={() => setModalOpen(false)}>{tc("cancel")}</button>
              <button className="ghost" disabled={selected?.draft} onClick={checkoutSelected}>{c.checkout}</button>
              <button className="primary" onClick={saveBooking}>{c.save}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


