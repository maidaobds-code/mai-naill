"use client";
import { useState } from "react";
import { bookings, platforms, staff } from "../lib/salonData";

const hours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function platformFor(id) {
  return platforms.find((platform) => platform.id === id) || platforms[0];
}

export default function CalendarEnhanced({ label = "Calendar" }) {
  const [view, setView] = useState("day");
  const [selected, setSelected] = useState(bookings[0]);

  return (
    <>
      <div className="pageHead">
        <div>
          <p className="eyebrow">BOOKING SOURCE OF TRUTH</p>
          <h1>{label}</h1>
          <p>Nailie, Hot Pepper Beauty, minimo, direct phone, and walk-in bookings are unified here.</p>
        </div>
        <div className="toolbar">
          <button className={view === "day" ? "ghost activeSoft" : "ghost"} onClick={() => setView("day")}>Day</button>
          <button className={view === "week" ? "ghost activeSoft" : "ghost"} onClick={() => setView("week")}>Week</button>
          <button className="primary">+ New Booking</button>
        </div>
      </div>
      <div className="syncBanner card">
        <strong>Auto sync rule</strong>
        <span>When one app receives a booking, this app notifies admin and blocks the same staff/time on every other connected app.</span>
      </div>
      {view === "day" ? (
        <div className="calendarLayout">
          <section className="card dayTimeline">
            <div className="calendarHeader"><button className="ghost">Previous</button><strong>2026/10/06 · Tuesday</strong><button className="ghost">Next</button></div>
            <div className="calendarGrid">
              <div className="calCorner"></div>
              {staff.map((member) => <div className="calStaff" key={member.id}><div className="avatar small" style={{ background: member.color }}>{member.name[0]}</div>{member.name}</div>)}
              {hours.map((hour) => (
                <div className="calRow" key={hour}>
                  <div className="calTime">{hour}</div>
                  {staff.map((member) => {
                    const booking = bookings.find((item) => item.staff === member.name && item.start.slice(0, 2) === hour.slice(0, 2));
                    const platform = booking ? platformFor(booking.source) : null;
                    return (
                      <div className="calCell" key={member.id}>
                        {booking && (
                          <button className="event eventButton" style={{ borderColor: platform.color }} onClick={() => setSelected(booking)}>
                            <strong>{booking.start}-{booking.end} {booking.customer}</strong>
                            <span>{booking.phone}</span>
                            <small>{booking.service} · {booking.staff} · {platform.name}</small>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
          <aside className="card appointmentDrawer">
            <p className="eyebrow">APPOINTMENT</p>
            <h2>{selected.customer}</h2>
            <p>{selected.phone}</p>
            <dl>
              <div><dt>Time</dt><dd>{selected.start}-{selected.end}</dd></div>
              <div><dt>Staff</dt><dd>{selected.staff}</dd></div>
              <div><dt>Service</dt><dd>{selected.service}</dd></div>
              <div><dt>Source</dt><dd>{platformFor(selected.source).name}</dd></div>
              <div><dt>Payroll rule</dt><dd>{selected.commissionRule}</dd></div>
            </dl>
            <div className="drawerActions">
              <button className="ghost">Edit time</button>
              <button className="ghost">Change staff</button>
              <button className="primary">Checkout</button>
            </div>
          </aside>
        </div>
      ) : (
        <section className="card weekGrid">
          {weekDays.map((day, index) => (
            <div className="weekCol" key={day}>
              <strong>{day}</strong>
              {bookings.filter((_, bookingIndex) => bookingIndex % 7 === index % 3).slice(0, 3).map((booking) => (
                <div className="weekEvent" key={`${day}-${booking.id}`}>
                  <span>{booking.start}</span>
                  <strong>{booking.customer}</strong>
                  <small>{booking.staff} · {platformFor(booking.source).name}</small>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
