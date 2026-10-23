"use client";
import { useEffect, useRef, useState } from "react";
import { tx } from "../lib/i18nClean";
import { platforms, staff as seedStaff } from "../lib/salonData";
import { useStaffStore } from "../lib/staffStore";
import { useBookingStore } from "../lib/bookingStore";

const slots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00"
];
const intervalSlots = slots.slice(0, -1);
const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthDays = Array.from({ length: 31 }, (_, index) => index + 1);
const timelineStart = 9 * 60;
const timelineEnd = 23 * 60;

const copy = {
  vi: { desc: "Thời gian nằm ngang. Nhân viên là từng hàng dọc. Khối lịch kéo dài theo thời lượng hẹn.", previous: "Trước", today: "Hôm nay", next: "Sau", day: "Ngày", week: "Tuần", month: "Tháng", checkout: "Tính tiền", newBooking: "+ Lịch mới", selectedDay: "Ngày đã chọn", dayBookings: "Lịch trong ngày", weekTotal: "Tổng tuần", monthTotal: "Tổng tháng", dayView: "Xem theo ngày", staff: "Nhân viên", appointment: "lịch hẹn", noBooking: "Chưa có lịch", more: "+{count} lịch khác", newLabel: "LỊCH MỚI", editLabel: "SỬA LỊCH", customer: "Khách hàng", phone: "Số điện thoại", platform: "Nền tảng", start: "Bắt đầu", end: "Kết thúc", deleteBooking: "Xóa lịch", save: "Lưu và đồng bộ" },
  ja: { desc: "時間は横軸、スタッフは縦の行です。予約ブロックは所要時間に合わせて表示されます。", previous: "前へ", today: "今日", next: "次へ", day: "日", week: "週", month: "月", checkout: "会計", newBooking: "+ 新規予約", selectedDay: "選択日", dayBookings: "当日の予約", weekTotal: "週合計", monthTotal: "月合計", dayView: "日表示", staff: "スタッフ", appointment: "予約", noBooking: "予約なし", more: "+{count}件", newLabel: "新規予約", editLabel: "予約編集", customer: "顧客", phone: "電話番号", platform: "プラットフォーム", start: "開始", end: "終了", deleteBooking: "予約削除", save: "保存して同期" },
  en: { desc: "Time runs horizontally. Staff are vertical rows. Booking blocks stretch by appointment duration.", previous: "Previous", today: "Today", next: "Next", day: "Day", week: "Week", month: "Month", checkout: "Checkout", newBooking: "+ New booking", selectedDay: "Selected day", dayBookings: "Day bookings", weekTotal: "Week total", monthTotal: "Month total", dayView: "Day view", staff: "Staff", appointment: "bookings", noBooking: "No bookings", more: "+{count} more", newLabel: "NEW BOOKING", editLabel: "EDIT BOOKING", customer: "Customer", phone: "Phone", platform: "Platform", start: "Start", end: "End", deleteBooking: "Delete booking", save: "Save and sync" },
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

function toMinutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function bookingStyle(booking) {
  const start = Math.max(timelineStart, toMinutes(booking.start));
  const end = Math.min(timelineEnd, toMinutes(booking.end));
  const total = timelineEnd - timelineStart;
  return {
    left: `${((start - timelineStart) / total) * 100}%`,
    width: `${Math.max(5, ((end - start) / total) * 100)}%`,
  };
}

function blankBooking(day, hour, member) {
  return {
    id: `draft-${day}-${hour}-${member.id}`,
    day,
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

export default function CalendarResourceTimeline({ label = "Calendar", language = "vi", onCheckout }) {
  const c = copy[language] || copy.vi;
  const tc = (key) => tx(language, "common", key);
  const [view, setView] = useState("day");
  const [selectedDay, setSelectedDay] = useState(6);
  const [selected, setSelected] = useState(blankBooking(6, "10:00", seedStaff[0]));
  const [modalOpen, setModalOpen] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [paintRange, setPaintRange] = useState(null);
  const { bookings, setBookings } = useBookingStore();
  const { staff: staffMembers } = useStaffStore();
  const staff = staffMembers.length ? staffMembers : seedStaff;
  const pressRef = useRef(null);
  const paintRef = useRef(null);
  const selectedDayBookings = bookings.filter((booking) => bookingDay(booking) === selectedDay);
  const weekTotal = bookings.filter((booking) => bookingDay(booking) >= 6 && bookingDay(booking) <= 12).length;
  const monthTotal = bookings.length;

  useEffect(() => {
    if (!staff.length || !selected?.draft) return;
    const current = staff.find((member) => member.name === selected.staff) || staff[0];
    if (current && current.name !== selected.staff) setSelected((value) => ({ ...value, staff: current.name }));
  }, [staff, selected?.draft, selected?.staff]);

  function openDay(day) {
    setSelectedDay(day);
    setView("day");
    setSelected(blankBooking(day, "10:00", staff[0] || seedStaff[0]));
  }

  function beginSelect(hour, member) {
    setDragStart({ hour, member, startedAt: Date.now() });
  }

  function openSelection(hour, member) {
    if (!dragStart || dragStart.member.id !== member.id) {
      setSelected(blankBooking(selectedDay, hour, member));
      setModalOpen(true);
      setDragStart(null);
      return;
    }
    const startIndex = slots.indexOf(dragStart.hour);
    const endIndex = slots.indexOf(hour);
    const firstIndex = Math.min(startIndex, endIndex);
    const lastIndex = Math.max(startIndex, endIndex);
    setSelected({ ...blankBooking(selectedDay, slots[firstIndex], member), end: slots[Math.min(lastIndex + 1, slots.length - 1)] });
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
    const startIndex = intervalSlots.indexOf(painting.startHour);
    const endIndex = intervalSlots.indexOf(painting.endHour);
    const firstIndex = Math.min(startIndex, endIndex);
    const lastIndex = Math.max(startIndex, endIndex);
    setSelected({ ...blankBooking(selectedDay, slots[firstIndex], painting.member), end: slots[Math.min(lastIndex + 1, slots.length - 1)] });
    paintRef.current = null;
    setPaintRange(null);
    setModalOpen(true);
  }

  function isPainted(hour, memberId) {
    if (!paintRange || paintRange.memberId !== memberId) return false;
    const slotIndex = intervalSlots.indexOf(hour);
    const startIndex = intervalSlots.indexOf(paintRange.startHour);
    const endIndex = intervalSlots.indexOf(paintRange.endHour);
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

  async function notifyAssignedStaff(booking, previousStaff) {
    const assigned = staff.find((member) => member.name === booking.staff);
    if (!assigned?.email || assigned.name === previousStaff) return;
    const isNew = !previousStaff;
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: assigned.email,
        subject: `${isNew ? "Lịch hẹn mới" : "Lịch hẹn đã được cập nhật"} - ${booking.customer}`,
        html: `<p>Xin chào ${assigned.name},</p><p>${isNew ? "Bạn được thêm vào lịch hẹn mới." : "Lịch hẹn của bạn vừa được cập nhật."}</p><p><strong>Khách:</strong> ${booking.customer}<br/><strong>Ngày:</strong> 2026/10/${String(booking.day).padStart(2, "0")}<br/><strong>Giờ:</strong> ${booking.start} - ${booking.end}<br/><strong>Dịch vụ:</strong> ${booking.service || "-"}</p>`,
      }),
    });
    if (!response.ok) throw new Error("Không thể gửi email cho nhân viên");
  }

  async function saveBooking() {
    const previousStaff = selected.draft ? "" : selected.staff;
    const assigned = staff.find((member) => member.name === selected.staff) || staff.find((member) => String(member.id) === String(selected.staffId)) || staff[0] || seedStaff[0];
    const bookingToSave = {
      ...selected,
      staff: assigned.name,
      staffId: assigned.id,
      staffEmail: assigned.email || "",
      staffRole: assigned.role || "",
      staffPhone: assigned.phone || "",
      language: selected.language || "vi",
      id: selected.draft ? `booking-${Date.now()}` : selected.id,
      day: selectedDay,
      customer: selected.customer || "New customer",
      phone: selected.phone || "090-0000-0000",
      draft: false,
    };
    setBookings((current) => {
      const exists = current.some((booking) => booking.id === selected.id);
      if (exists) return current.map((booking) => booking.id === selected.id ? bookingToSave : booking);
      return [...current, bookingToSave];
    });
    setSelected(bookingToSave);
    setModalOpen(false);
    try { await notifyAssignedStaff(bookingToSave, previousStaff); } catch (error) { console.warn(error); }
  }

  function deleteBooking() {
    setBookings((current) => current.filter((booking) => booking.id !== selected.id));
    setSelected(blankBooking(selectedDay, "10:00", staff[0] || seedStaff[0]));
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
          <button className="ghost" onClick={() => setSelectedDay(Math.max(1, selectedDay - 1))}>{c.previous}</button>
          <button className="ghost" onClick={() => setSelectedDay(6)}>{c.today}</button>
          <button className="ghost" onClick={() => setSelectedDay(Math.min(31, selectedDay + 1))}>{c.next}</button>
          <button className={view === "day" ? "ghost activeSoft" : "ghost"} onClick={() => setView("day")}>{c.day}</button>
          <button className={view === "week" ? "ghost activeSoft" : "ghost"} onClick={() => setView("week")}>{c.week}</button>
          <button className={view === "month" ? "ghost activeSoft" : "ghost"} onClick={() => setView("month")}>{c.month}</button>
          <button className="ghost" disabled={selected?.draft} onClick={checkoutSelected}>{c.checkout}</button>
          <button className="primary" onClick={() => { setSelected(blankBooking(selectedDay, "10:00", staff[0] || seedStaff[0])); setModalOpen(true); }}>{c.newBooking}</button>
        </div>
      </div>

      <div className="calendarSummary">
        <div className="card summaryPill"><span>{c.selectedDay}</span><strong>2026/10/{String(selectedDay).padStart(2, "0")}</strong></div>
        <div className="card summaryPill"><span>{c.dayBookings}</span><strong>{selectedDayBookings.length}</strong></div>
        <div className="card summaryPill"><span>{c.weekTotal}</span><strong>{weekTotal}</strong></div>
        <div className="card summaryPill"><span>{c.monthTotal}</span><strong>{monthTotal}</strong></div>
      </div>

      {view === "day" && (
        <section className="card resourceTimelineShell">
          <div className="calendarHeader">
              <strong>2026/10/{String(selectedDay).padStart(2, "0")} · {c.dayView}</strong>
          </div>
          <div className="resourceTimeline">
            <div className="resourceHeader">{c.staff}</div>
            <div className="timeAxis">{slots.map((hour) => <span key={hour}>{hour}</span>)}</div>
            {staff.map((member) => {
              const memberBookings = selectedDayBookings.filter((booking) => booking.staff === member.name || String(booking.staffId || "") === String(member.id));
              return (
                <div className="resourceRow" key={member.id}>
                  <div className="resourceStaff">
                    <div className="avatar small" style={{ background: member.color }}>{member.name[0]}</div>
                    <div><strong>{member.name}</strong><span>{member.status}</span></div>
                  </div>
                  <div className="resourceLane">
                    <div className="slotHitGrid">
                      {intervalSlots.map((hour) => (
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
                          onDoubleClick={() => { setSelected(blankBooking(selectedDay, hour, member)); setModalOpen(true); }}
                        />
                      ))}
                    </div>
                    {memberBookings.map((booking) => {
                      const platform = platformFor(booking.source);
                      return (
                        <button
                          className={selected.id === booking.id ? "timelineBooking selectedBar" : "timelineBooking"}
                          key={booking.id}
                          style={{ ...bookingStyle(booking), borderColor: member.color, background: `${member.color}2b` }}
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
          {weekDays.map((day, index) => {
            const dayNumber = 6 + index;
            const dayBookings = bookings.filter((booking) => bookingDay(booking) === dayNumber).sort((a, b) => a.start.localeCompare(b.start));
            const isSelected = dayNumber === selectedDay;
            return (
              <button className={isSelected ? "weekCol weekDayButton selectedWeekDay" : "weekCol weekDayButton"} key={day} onClick={() => openDay(dayNumber)}>
                <span className="weekDayTop"><small>{day}</small><em>10/{String(dayNumber).padStart(2, "0")}</em></span>
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
                  {dayBookings.length > 3 && <span className="weekMore">{c.more.replace("{count}", dayBookings.length - 3)}</span>}
                </span>
              </button>
            );
          })}
        </section>
      )}

      {view === "month" && (
        <section className="card monthGrid">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName) => <div className="monthHead" key={dayName}>{dayName}</div>)}
          {monthDays.map((day) => {
            const dayBookings = bookings.filter((booking) => bookingDay(booking) === day);
            return <button className={day === selectedDay ? "monthDay selectedMonthDay" : "monthDay"} key={day} onClick={() => openDay(day)}><strong>{day}</strong><span>{dayBookings.length} {c.appointment}</span><em>{dayBookings.slice(0, 4).map((booking) => <i key={booking.id} style={{ background: staffFor(booking.staff).color }} />)}</em></button>;
          })}
        </section>
      )}

      {modalOpen && (
        <div className="bookingModalBackdrop" onMouseDown={() => setModalOpen(false)}>
          <div className="card bookingModal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modalHead"><div><p className="eyebrow">{selected.draft ? c.newLabel : c.editLabel}</p><h2>{selected.customer || c.customer}</h2></div><button className="ghost iconClose" onClick={() => setModalOpen(false)}>{tc("close")}</button></div>
            <div className="selectedRange"><strong>{selected.start} - {selected.end}</strong><span>2026/10/{String(selectedDay).padStart(2, "0")} · {selected.staff}</span>{selected.staffRole && <small>{selected.staffRole}{selected.staffEmail ? ` · ${selected.staffEmail}` : ""}</small>}</div>
            <div className="formGrid modalForm">
              <label>{c.customer}<input value={selected.customer} onChange={(event) => setSelected({ ...selected, customer: event.target.value })} placeholder={c.customer} /></label>
              <label>{c.phone}<input value={selected.phone} onChange={(event) => setSelected({ ...selected, phone: event.target.value })} placeholder="090-0000-0000" /></label>
              <label>{c.staff}<select value={selected.staff} onChange={(event) => { const assigned = staff.find((member) => member.name === event.target.value); setSelected({ ...selected, staff: event.target.value, staffId: assigned?.id || "", staffEmail: assigned?.email || "", staffRole: assigned?.role || "", staffPhone: assigned?.phone || "" }); }}>{staff.map((member) => <option key={member.id} value={member.name}>{member.name}{member.role ? ` · ${member.role}` : ""}</option>)}</select></label>
              <label>{c.platform}<select value={selected.source} onChange={(event) => setSelected({ ...selected, source: event.target.value })}>{platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}</select></label>
              <label>{c.start}<select value={selected.start} onChange={(event) => setSelected({ ...selected, start: event.target.value })}>{slots.map((hour) => <option key={hour}>{hour}</option>)}</select></label>
              <label>{c.end}<select value={selected.end} onChange={(event) => setSelected({ ...selected, end: event.target.value })}>{slots.map((hour) => <option key={hour}>{hour}</option>)}</select></label>
            </div>
            <div className="modalActions">
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


