"use client";
import { useMemo, useState } from "react";
import { bookings as seedBookings, platforms, staff } from "../lib/salonData";

const hours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthDays = Array.from({ length: 31 }, (_, index) => index + 1);

function platformFor(id) {
  return platforms.find((platform) => platform.id === id) || platforms[0];
}

function staffFor(name) {
  return staff.find((member) => member.name === name) || staff[0];
}

function bookingDay(booking) {
  return booking.day || 6;
}

function blankBooking(day, hour, member) {
  return {
    id: `draft-${day}-${hour}-${member.id}`,
    day,
    start: hour,
    end: `${String(Number(hour.slice(0, 2)) + 1).padStart(2, "0")}:00`,
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
  const bookings = useMemo(() => seedBookings.map((booking, index) => ({ ...booking, day: [6, 6, 7, 8, 10, 12][index] || 6 })), []);
  const selectedDayBookings = bookings.filter((booking) => bookingDay(booking) === selectedDay);
  const weekTotal = bookings.filter((booking) => bookingDay(booking) >= 6 && bookingDay(booking) <= 12).length;
  const monthTotal = bookings.length;

  function openDay(day) {
    setSelectedDay(day);
    setView("day");
    const nextBooking = bookings.find((booking) => bookingDay(booking) === day);
    if (nextBooking) setSelected(nextBooking);
  }

  function openSlot(hour, member) {
    const existing = selectedDayBookings.find((booking) => booking.staff === member.name && booking.start.slice(0, 2) === hour.slice(0, 2));
    setSelected(existing || blankBooking(selectedDay, hour, member));
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
          <button className={view === "day" ? "ghost activeSoft" : "ghost"} onClick={() => setView("day")}>Day</button>
          <button className={view === "week" ? "ghost activeSoft" : "ghost"} onClick={() => setView("week")}>Week</button>
          <button className={view === "month" ? "ghost activeSoft" : "ghost"} onClick={() => setView("month")}>Month</button>
          <button className="primary" onClick={() => setSelected(blankBooking(selectedDay, "10:00", staff[0]))}>+ New Booking</button>
        </div>
      </div>

      <div className="calendarSummary">
        <div className="card summaryPill"><span>Selected day</span><strong>2026/10/{String(selectedDay).padStart(2, "0")}</strong></div>
        <div className="card summaryPill"><span>Day bookings</span><strong>{selectedDayBookings.length}</strong></div>
        <div className="card summaryPill"><span>Week total</span><strong>{weekTotal}</strong></div>
        <div className="card summaryPill"><span>Month total</span><strong>{monthTotal}</strong></div>
      </div>

      {view === "day" && (
        <div className="calendarLayout">
          <section className="card dayTimeline">
            <div className="calendarHeader">
              <button className="ghost" onClick={() => setSelectedDay(Math.max(1, selectedDay - 1))}>Previous</button>
              <strong>2026/10/{String(selectedDay).padStart(2, "0")} · Day View</strong>
              <button className="ghost" onClick={() => setSelectedDay(Math.min(31, selectedDay + 1))}>Next</button>
            </div>
            <div className="calendarGrid paintCalendar">
              <div className="calCorner"></div>
              {staff.map((member) => <div className="calStaff" key={member.id}><div className="avatar small" style={{ background: member.color }}>{member.name[0]}</div>{member.name}</div>)}
              {hours.map((hour) => (
                <div className="calRow" key={hour}>
                  <div className="calTime">{hour}</div>
                  {staff.map((member) => {
                    const booking = selectedDayBookings.find((item) => item.staff === member.name && item.start.slice(0, 2) === hour.slice(0, 2));
                    const platform = booking ? platformFor(booking.source) : null;
                    const memberColor = staffFor(member.name).color;
                    const selectedClass = selected.id === booking?.id ? " selectedEvent" : "";
                    return (
                      <button className={booking ? `calCell paintCell hasBooking${selectedClass}` : "calCell paintCell"} key={member.id} onClick={() => openSlot(hour, member)}>
                        {booking ? (
                          <span className="event eventButton staffEvent" style={{ borderColor: memberColor, background: `${memberColor}22` }}>
                            <strong>{booking.start}-{booking.end} {booking.customer}</strong>
                            <span>{booking.phone}</span>
                            <small>{booking.service} · {booking.staff} · {platform.name}</small>
                          </span>
                        ) : (
                          <span className="emptySlot">Click or drag area to add</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
          <aside className="card appointmentDrawer">
            <p className="eyebrow">{selected.draft ? "NEW BOOKING" : "EDIT BOOKING"}</p>
            <h2>{selected.customer || "New customer"}</h2>
            <div className="formGrid">
              <label>Customer<input value={selected.customer} onChange={(event) => setSelected({ ...selected, customer: event.target.value })} placeholder="Customer name" /></label>
              <label>Phone<input value={selected.phone} onChange={(event) => setSelected({ ...selected, phone: event.target.value })} placeholder="090-0000-0000" /></label>
              <label>Start<select value={selected.start} onChange={(event) => setSelected({ ...selected, start: event.target.value })}>{hours.map((hour) => <option key={hour}>{hour}</option>)}</select></label>
              <label>End<select value={selected.end} onChange={(event) => setSelected({ ...selected, end: event.target.value })}>{hours.concat("19:00").map((hour) => <option key={hour}>{hour}</option>)}</select></label>
              <label>Staff<select value={selected.staff} onChange={(event) => setSelected({ ...selected, staff: event.target.value })}>{staff.map((member) => <option key={member.id}>{member.name}</option>)}</select></label>
              <label>Source<select value={selected.source} onChange={(event) => setSelected({ ...selected, source: event.target.value })}>{platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}</select></label>
            </div>
            <div className="drawerActions">
              <button className="ghost">Cancel booking</button>
              <button className="ghost">Remove block</button>
              <button className="primary">Save and sync blocks</button>
            </div>
          </aside>
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
          {monthDays.map((day) => {
            const count = bookings.filter((booking) => bookingDay(booking) === day).length;
            return (
              <button className={day === selectedDay ? "monthDay selectedMonthDay" : "monthDay"} key={day} onClick={() => openDay(day)}>
                <strong>{day}</strong>
                <span>{count} bookings</span>
                {count > 0 && <small>{bookings.filter((booking) => bookingDay(booking) === day).map((booking) => booking.staff).join(", ")}</small>}
              </button>
            );
          })}
        </section>
      )}
    </>
  );
}
