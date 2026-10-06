"use client";
import { useMemo, useState } from "react";
import { bookings as seedBookings, platforms, staff } from "../lib/salonData";

const slots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"
];
const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthDays = Array.from({ length: 31 }, (_, index) => index + 1);
const intervalSlots = slots.slice(0, -1);
const timelineStart = 9 * 60;
const timelineEnd = 21 * 60;

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
    end: slots[slots.indexOf(hour) + 2] || "21:00",
    customer: "",
    phone: "",
    service: "Gel One Color",
    staff: member.name,
    source: "direct",
    price: 0,
    status: "DRAFT",
    origin: "Direct",
    commissionRule: "Direct 55%",
    draft: true,
  };
}

export default function CalendarPlanner({ label = "Calendar" }) {
  const [view, setView] = useState("day");
  const [selectedDay, setSelectedDay] = useState(6);
  const [selected, setSelected] = useState({ ...seedBookings[0], day: 6 });
  const [modalOpen, setModalOpen] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const bookings = useMemo(() => seedBookings.map((booking, index) => ({ ...booking, day: [6, 6, 7, 8, 10, 12][index] || 6 })), []);
  const selectedDayBookings = bookings.filter((booking) => bookingDay(booking) === selectedDay);
  const weekTotal = bookings.filter((booking) => bookingDay(booking) >= 6 && bookingDay(booking) <= 12).length;
  const monthTotal = bookings.length;
  const dateTitle = view === "day"
    ? `2026/10/${String(selectedDay).padStart(2, "0")}`
    : view === "week"
      ? "2026/10/06 - 2026/10/12"
      : "October 2026";

  function openDay(day) {
    setSelectedDay(day);
    setView("day");
    const nextBooking = bookings.find((booking) => bookingDay(booking) === day);
    if (nextBooking) setSelected(nextBooking);
  }

  function openSlot(hour, member) {
    const existing = selectedDayBookings.find((booking) => booking.staff === member.name && booking.start === hour);
    setSelected(existing || blankBooking(selectedDay, hour, member));
    setModalOpen(true);
  }

  function beginSelect(hour, member) {
    setDragStart({ hour, member });
  }

  function finishSelect(hour, member) {
    if (!dragStart || dragStart.member.id !== member.id) {
      openSlot(hour, member);
      setDragStart(null);
      return;
    }

    const startIndex = slots.indexOf(dragStart.hour);
    const endIndex = slots.indexOf(hour);
    const firstIndex = Math.min(startIndex, endIndex);
    const lastIndex = Math.max(startIndex, endIndex);
    const start = slots[firstIndex];
    const end = slots[Math.min(lastIndex + 1, slots.length - 1)] || "21:00";
    const existing = selectedDayBookings.find((booking) => booking.staff === member.name && booking.start === start);
    setSelected(existing || { ...blankBooking(selectedDay, start, member), end });
    setModalOpen(true);
    setDragStart(null);
  }

  function movePeriod(direction) {
    if (view === "day") setSelectedDay(Math.min(31, Math.max(1, selectedDay + direction)));
    if (view === "week") setSelectedDay(Math.min(25, Math.max(1, selectedDay + direction * 7)));
  }

  return (
    <>
      <div className="pageHead">
        <div>
          <p className="eyebrow">BOOKING CALENDAR</p>
          <h1>{label}</h1>
          <p>Default screen. Select Day, Week, or Month; click a week/month day to open that day schedule.</p>
        </div>
        <div className="toolbar">
          <button className="ghost" onClick={() => movePeriod(-1)}>Previous</button>
          <button className="ghost" onClick={() => setSelectedDay(6)}>Today</button>
          <button className="ghost" onClick={() => movePeriod(1)}>Next</button>
          <button className={view === "day" ? "ghost activeSoft" : "ghost"} onClick={() => setView("day")}>Day</button>
          <button className={view === "week" ? "ghost activeSoft" : "ghost"} onClick={() => setView("week")}>Week</button>
          <button className={view === "month" ? "ghost activeSoft" : "ghost"} onClick={() => setView("month")}>Month</button>
          <button className="primary" onClick={() => { setSelected(blankBooking(selectedDay, "10:00", staff[0])); setModalOpen(true); }}>+ New Booking</button>
        </div>
      </div>

      <div className="calendarSummary">
        <div className="card summaryPill"><span>Selected day</span><strong>2026/10/{String(selectedDay).padStart(2, "0")}</strong></div>
        <div className="card summaryPill"><span>Visible range</span><strong>{dateTitle}</strong></div>
        <div className="card summaryPill"><span>Day bookings</span><strong>{selectedDayBookings.length}</strong></div>
        <div className="card summaryPill"><span>Week total</span><strong>{weekTotal}</strong></div>
        <div className="card summaryPill"><span>Month total</span><strong>{monthTotal}</strong></div>
      </div>

      {view === "day" && (
        <div className="calendarLayout">
          <section className="card dayTimeline fullTimeline">
            <div className="calendarHeader">
              <button className="ghost" onClick={() => setSelectedDay(Math.max(1, selectedDay - 1))}>Previous</button>
              <strong>2026/10/{String(selectedDay).padStart(2, "0")} · Day View</strong>
              <button className="ghost" onClick={() => setSelectedDay(Math.min(31, selectedDay + 1))}>Next</button>
            </div>
            <div className="calendarGrid paintCalendar">
              <div className="calCorner"></div>
              {staff.map((member) => <div className="calStaff" key={member.id}><div className="avatar small" style={{ background: member.color }}>{member.name[0]}</div>{member.name}</div>)}
              {slots.map((hour) => (
                <div className="calRow" key={hour}>
                  <div className="calTime">{hour}</div>
                  {staff.map((member) => {
                    const booking = selectedDayBookings.find((item) => item.staff === member.name && item.start === hour);
                    const platform = booking ? platformFor(booking.source) : null;
                    const memberColor = staffFor(member.name).color;
                    const selectedClass = selected.id === booking?.id ? " selectedEvent" : "";
                    return (
                      <button
                        className={booking ? `calCell paintCell hasBooking${selectedClass}` : "calCell paintCell"}
                        key={member.id}
                        onMouseDown={() => beginSelect(hour, member)}
                        onMouseUp={() => finishSelect(hour, member)}
                        onTouchStart={() => beginSelect(hour, member)}
                        onTouchEnd={() => finishSelect(hour, member)}
                      >
                        {booking ? (
                          <span className="event eventButton staffEvent" style={{ borderColor: memberColor, background: `${memberColor}22` }}>
                            <strong>{booking.start}-{booking.end} {booking.customer}</strong>
                            <span>{booking.phone}</span>
                            <small>{booking.service} · {booking.staff} · {platform.name}</small>
                          </span>
                        ) : (
                          <span className="emptySlot">Drag/select to add</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {view === "week" && (
        <section className="card weekGrid weekCalendar">
          {weekDays.map((day, index) => {
            const dayNumber = 6 + index;
            const count = bookings.filter((booking) => bookingDay(booking) === dayNumber).length;
            return (
              <button className="weekCol weekDayButton" key={day} onClick={() => openDay(dayNumber)}>
                <span>{day} · 10/{String(dayNumber).padStart(2, "0")}</span>
                <strong>{count} bookings</strong>
                {bookings.filter((booking) => bookingDay(booking) === dayNumber).slice(0, 4).map((booking) => (
                  <span className="weekEvent" key={booking.id}>
                    <b>{booking.start}</b>
                    <strong>{booking.customer}</strong>
                    <small>{booking.staff} · {platformFor(booking.source).name}</small>
                  </span>
                ))}
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
            const count = dayBookings.length;
            return (
              <button className={day === selectedDay ? "monthDay selectedMonthDay" : "monthDay"} key={day} onClick={() => openDay(day)}>
                <strong>{day}</strong>
                <span>{count} bookings</span>
                {count > 0 && <small>{dayBookings.map((booking) => booking.staff).join(", ")}</small>}
                <em>{dayBookings.slice(0, 4).map((booking) => <i key={booking.id} style={{ background: staffFor(booking.staff).color }} />)}</em>
              </button>
            );
          })}
        </section>
      )}

      {modalOpen && (
        <div className="bookingModalBackdrop" onMouseDown={() => setModalOpen(false)}>
          <div className="card bookingModal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modalHead">
              <div>
                <p className="eyebrow">{selected.draft ? "NEW BOOKING" : "EDIT BOOKING"}</p>
                <h2>{selected.customer || "New customer"}</h2>
              </div>
              <button className="ghost iconClose" onClick={() => setModalOpen(false)}>Close</button>
            </div>
            <div className="selectedRange">
              <strong>{selected.start} - {selected.end}</strong>
              <span>2026/10/{String(selectedDay).padStart(2, "0")} · {selected.staff}</span>
            </div>
            <div className="formGrid modalForm">
              <label>Customer<input value={selected.customer} onChange={(event) => setSelected({ ...selected, customer: event.target.value })} placeholder="Customer name" /></label>
              <label>Phone<input value={selected.phone} onChange={(event) => setSelected({ ...selected, phone: event.target.value })} placeholder="090-0000-0000" /></label>
              <label>Staff<select value={selected.staff} onChange={(event) => setSelected({ ...selected, staff: event.target.value })}>{staff.map((member) => <option key={member.id}>{member.name}</option>)}</select></label>
              <label>Platform<select value={selected.source} onChange={(event) => setSelected({ ...selected, source: event.target.value })}>{platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}</select></label>
              <label>Start<select value={selected.start} onChange={(event) => setSelected({ ...selected, start: event.target.value })}>{slots.map((hour) => <option key={hour}>{hour}</option>)}</select></label>
              <label>End<select value={selected.end} onChange={(event) => setSelected({ ...selected, end: event.target.value })}>{slots.map((hour) => <option key={hour}>{hour}</option>)}</select></label>
              <label>Service<input value={selected.service || ""} onChange={(event) => setSelected({ ...selected, service: event.target.value })} /></label>
              <label>Note<input value={selected.note || ""} onChange={(event) => setSelected({ ...selected, note: event.target.value })} placeholder="Customer note" /></label>
            </div>
            <div className="modalActions">
              <button className="ghost" onClick={() => setModalOpen(false)}>Cancel booking</button>
              <button className="ghost" onClick={() => setModalOpen(false)}>Remove block</button>
              <button className="primary" onClick={() => setModalOpen(false)}>Save and sync blocks</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
