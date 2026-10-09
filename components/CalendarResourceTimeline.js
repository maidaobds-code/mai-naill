"use client";
import { useRef, useState } from "react";
import { platforms, staff } from "../lib/salonData";
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

function platformFor(id) {
  return platforms.find((platform) => platform.id === id) || platforms[0];
}

function staffFor(name) {
  return staff.find((member) => member.name === name) || staff[0];
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
    source: "direct",
    draft: true,
  };
}

export default function CalendarResourceTimeline({ label = "Calendar", onCheckout }) {
  const [view, setView] = useState("day");
  const [selectedDay, setSelectedDay] = useState(6);
  const [selected, setSelected] = useState(blankBooking(6, "10:00", staff[0]));
  const [modalOpen, setModalOpen] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const { bookings, setBookings } = useBookingStore();
  const pressRef = useRef(null);
  const selectedDayBookings = bookings.filter((booking) => bookingDay(booking) === selectedDay);
  const weekTotal = bookings.filter((booking) => bookingDay(booking) >= 6 && bookingDay(booking) <= 12).length;
  const monthTotal = bookings.length;

  function openDay(day) {
    setSelectedDay(day);
    setView("day");
    setSelected(blankBooking(day, "10:00", staff[0]));
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

  function saveBooking() {
    const bookingToSave = {
      ...selected,
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
  }

  function deleteBooking() {
    setBookings((current) => current.filter((booking) => booking.id !== selected.id));
    setSelected(blankBooking(selectedDay, "10:00", staff[0]));
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
          <p>Time runs horizontally. Staff are vertical rows. Booking blocks stretch by appointment duration.</p>
        </div>
        <div className="toolbar">
          <button className="ghost" onClick={() => setSelectedDay(Math.max(1, selectedDay - 1))}>Previous</button>
          <button className="ghost" onClick={() => setSelectedDay(6)}>Today</button>
          <button className="ghost" onClick={() => setSelectedDay(Math.min(31, selectedDay + 1))}>Next</button>
          <button className={view === "day" ? "ghost activeSoft" : "ghost"} onClick={() => setView("day")}>Ngày</button>
          <button className={view === "week" ? "ghost activeSoft" : "ghost"} onClick={() => setView("week")}>Tuần</button>
          <button className={view === "month" ? "ghost activeSoft" : "ghost"} onClick={() => setView("month")}>Tháng</button>
          <button className="ghost" disabled={selected?.draft} onClick={checkoutSelected}>Tính tiền</button>
          <button className="primary" onClick={() => { setSelected(blankBooking(selectedDay, "10:00", staff[0])); setModalOpen(true); }}>+ Lịch mới</button>
        </div>
      </div>

      <div className="calendarSummary">
        <div className="card summaryPill"><span>Selected day</span><strong>2026/10/{String(selectedDay).padStart(2, "0")}</strong></div>
        <div className="card summaryPill"><span>Day bookings</span><strong>{selectedDayBookings.length}</strong></div>
        <div className="card summaryPill"><span>Week total</span><strong>{weekTotal}</strong></div>
        <div className="card summaryPill"><span>Month total</span><strong>{monthTotal}</strong></div>
      </div>

      {view === "day" && (
        <section className="card resourceTimelineShell">
          <div className="calendarHeader">
              <strong>2026/10/{String(selectedDay).padStart(2, "0")} · Xem theo ngày</strong>
          </div>
          <div className="resourceTimeline">
            <div className="resourceHeader">Nhân viên</div>
            <div className="timeAxis">{slots.map((hour) => <span key={hour}>{hour}</span>)}</div>
            {staff.map((member) => {
              const memberBookings = selectedDayBookings.filter((booking) => booking.staff === member.name);
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
                          className="slotHit"
                          key={`${member.id}-${hour}`}
                          onMouseDown={() => beginSelect(hour, member)}
                          onMouseUp={() => finishSelect(hour, member)}
                          onTouchStart={() => beginSelect(hour, member)}
                          onTouchEnd={() => finishSelect(hour, member)}
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
                <span className="weekCountBadge">{dayBookings.length} lịch hẹn</span>
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
                  {!dayBookings.length && <span className="weekEmptyState">Chưa có lịch</span>}
                  {dayBookings.length > 3 && <span className="weekMore">+{dayBookings.length - 3} lịch khác</span>}
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
            return <button className={day === selectedDay ? "monthDay selectedMonthDay" : "monthDay"} key={day} onClick={() => openDay(day)}><strong>{day}</strong><span>{dayBookings.length} bookings</span><em>{dayBookings.slice(0, 4).map((booking) => <i key={booking.id} style={{ background: staffFor(booking.staff).color }} />)}</em></button>;
          })}
        </section>
      )}

      {modalOpen && (
        <div className="bookingModalBackdrop" onMouseDown={() => setModalOpen(false)}>
          <div className="card bookingModal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modalHead"><div><p className="eyebrow">{selected.draft ? "NEW BOOKING" : "EDIT BOOKING"}</p><h2>{selected.customer || "New customer"}</h2></div><button className="ghost iconClose" onClick={() => setModalOpen(false)}>Close</button></div>
            <div className="selectedRange"><strong>{selected.start} - {selected.end}</strong><span>2026/10/{String(selectedDay).padStart(2, "0")} · {selected.staff}</span></div>
            <div className="formGrid modalForm">
              <label>Customer<input value={selected.customer} onChange={(event) => setSelected({ ...selected, customer: event.target.value })} placeholder="Customer name" /></label>
              <label>Phone<input value={selected.phone} onChange={(event) => setSelected({ ...selected, phone: event.target.value })} placeholder="090-0000-0000" /></label>
              <label>Staff<select value={selected.staff} onChange={(event) => setSelected({ ...selected, staff: event.target.value })}>{staff.map((member) => <option key={member.id}>{member.name}</option>)}</select></label>
              <label>Platform<select value={selected.source} onChange={(event) => setSelected({ ...selected, source: event.target.value })}>{platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}</select></label>
              <label>Start<select value={selected.start} onChange={(event) => setSelected({ ...selected, start: event.target.value })}>{slots.map((hour) => <option key={hour}>{hour}</option>)}</select></label>
              <label>End<select value={selected.end} onChange={(event) => setSelected({ ...selected, end: event.target.value })}>{slots.map((hour) => <option key={hour}>{hour}</option>)}</select></label>
            </div>
            <div className="modalActions">
              <button className="ghost dangerButton" onClick={deleteBooking}>Delete booking</button>
              <button className="ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="ghost" disabled={selected?.draft} onClick={checkoutSelected}>Tính tiền</button>
              <button className="primary" onClick={saveBooking}>Save and sync blocks</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


