"use client";
import { bookings, staff } from "../lib/mock";
export default function CalendarView(){
  return <>
    <div className="pageHead">
      <div><p className="eyebrow">CALENDAR</p><h1>Lịch & Booking</h1><p>HotPepper · Minimo · LINE · Instagram · điện thoại · walk-in</p></div>
      <button className="primary">＋ Booking mới</button>
    </div>
    <div className="card">
      <div className="calendarHeader"><button className="ghost">←</button><strong>23 tháng 8, 2026</strong><button className="ghost">→</button></div>
      <div className="calendarGrid">
        <div className="calCorner"></div>
        {staff.map(s=><div className="calStaff" key={s.id}><div className="avatar small" style={{background:s.color}}>{s.name[0]}</div>{s.name}</div>)}
        {["10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"].map(t=>(
          <div className="calRow" key={t}>
            <div className="calTime">{t}</div>
            {staff.map(s=>{
              const b=bookings.find(x=>x.staff===s.name && x.time.startsWith(t.slice(0,2)));
              return <div className="calCell" key={s.id}>{b && <div className="event"><strong>{b.time} {b.customer}</strong><span>{b.service}</span><small>{b.source} · ¥{b.price.toLocaleString()}</small></div>}</div>
            })}
          </div>
        ))}
      </div>
    </div>
  </>
}
