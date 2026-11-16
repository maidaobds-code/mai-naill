"use client";
import { useEffect, useState } from "react";
import { useStaffStore } from "../lib/staffStore";
import { monthDates, dateRange } from "../lib/staffSchedule";
import { japanToday } from "../lib/bookingMenu";
const names=["Chủ nhật","Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6","Thứ 7"];
export default function StaffSchedule(){
 const {staff}=useStaffStore();
 const [month,setMonth]=useState(()=>japanToday().slice(0,7));
 const [selected,setSelected]=useState([]);
 const [settings,setSettings]=useState({});
 const [days,setDays]=useState({});
 const [selectedDates,setSelectedDates]=useState([]);
 const [from,setFrom]=useState(japanToday);
 const [to,setTo]=useState(japanToday);
 const [rule,setRule]=useState({off:true,start:"12:00",end:"19:00"});
 const [weekly,setWeekly]=useState(()=>names.map(()=>({off:false,start:"12:00",end:"19:00"})));
 const [message,setMessage]=useState("");
 const [saving,setSaving]=useState(false);
 const [showMonth,setShowMonth]=useState(false);
 useEffect(()=>{fetch('/api/settings',{cache:'no-store'}).then(r=>r.json()).then(r=>{if(r.ok)setSettings(r.value||{});}).catch(()=>setMessage('Không tải được cấu hình'));},[]);
 useEffect(()=>{const saved=settings.staffWorkSchedules?.[`${selected[0]}|${month}`];setDays(Object.fromEntries(monthDates(month).map(date=>[date,saved?.[date]||{off:false,start:settings.openTime||'09:00',end:settings.closeTime||'23:00'}])));},[month,selected[0],settings]);
 function toggleDate(date){setSelectedDates(current=>current.includes(date)?current.filter(value=>value!==date):[...current,date].sort());}
 function addRange(){try{const next=[...new Set([...selectedDates,...dateRange(from,to)])].sort();if(next.length>366)throw Error('Mỗi lần chỉ chọn tối đa 366 ngày');setSelectedDates(next);setMonth(from.slice(0,7));setMessage('Đã thêm các ngày trong khoảng. Chọn Nghỉ hoặc Giờ làm rồi lưu.');}catch(error){setMessage(error.message);}}
 function applyWeekly(){setDays(Object.fromEntries(monthDates(month).map(date=>[date,{...weekly[new Date(`${date}T12:00:00Z`).getUTCDay()]}])));setShowMonth(true);setMessage('Đã áp dụng mẫu vào bảng tháng. Có thể sửa từng ngày trước khi lưu.');}
 async function save(partial){
  if(partial&&!selectedDates.length){setMessage('Chọn ít nhất một ngày');return;}
  setSaving(true);setMessage('');
  try{
   const response=await fetch('/api/staff-schedule',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({month,staffIds:selected,partial,days:partial?Object.fromEntries(selectedDates.map(date=>[date,{...rule}])):days})});
   const result=await response.json();if(!response.ok||!result.ok)throw Error(result.message);
   setSettings(result.value);setMessage(`Đã lưu ${partial?selectedDates.length:monthDates(month).length} ngày. ${result.queued} tác vụ đang chờ bot đồng bộ.`);
  }catch(error){setMessage(error.message);}finally{setSaving(false);}
 }
 const dates=monthDates(month);
 const blanks=new Date(`${month}-01T12:00:00Z`).getUTCDay();
 return <section>
  <div className="pageHead"><div><h1>Lịch làm / nghỉ theo nhân viên</h1><p>Chọn ngày bất kỳ hoặc một khoảng ngày. Các ngày khác giữ nguyên; không tự lặp hàng tuần.</p></div></div>
  <div className="card">
   <div className="buttonRow">{staff.map(member=><label key={member.id}><input type="checkbox" checked={selected.includes(String(member.id))} onChange={event=>setSelected(event.target.checked?[...selected,String(member.id)]:selected.filter(id=>id!==String(member.id)))} />{member.name}</label>)}</div>
   <div className="scheduleDateControls">
    <label>Từ ngày<input type="date" value={from} onChange={event=>setFrom(event.target.value)} /></label>
    <label>Đến ngày<input type="date" value={to} onChange={event=>setTo(event.target.value)} /></label>
    <button className="ghost" type="button" onClick={addRange}>Thêm khoảng ngày</button>
   </div>
   <label>Tháng hiển thị<input type="month" required value={month} onChange={event=>{if(event.target.value)setMonth(event.target.value);}} /></label>
   <div className="staffDatePicker">{names.map(name=><strong key={name}>{name}</strong>)}{Array.from({length:blanks},(_,i)=><span key={`blank-${i}`} />)}{dates.map(date=><button type="button" className="staffDateButton" aria-label={date} aria-pressed={selectedDates.includes(date)} key={date} onClick={()=>toggleDate(date)}><strong>{Number(date.slice(-2))}</strong><small>{days[date]?.off?'Nghỉ':settings.staffWorkSchedules?.[`${selected[0]}|${month}`]?.[date]?'Đi làm':'—'}</small></button>)}</div>
   <div className="scheduleSelectionList">{selectedDates.map(date=><button type="button" className="ghost" key={date} onClick={()=>toggleDate(date)} aria-label={`Bỏ chọn ${date}`}>{date} ×</button>)}</div>
   <p>Đã chọn: {selectedDates.length} ngày <button className="ghost" type="button" onClick={()=>setSelectedDates([])}>Bỏ chọn tất cả</button></p>
   <div className="scheduleDateControls">
    <label>Áp dụng cho ngày đã chọn<select value={rule.off?'off':'work'} onChange={event=>setRule({...rule,off:event.target.value==='off'})}><option value="off">Nghỉ cả ngày</option><option value="work">Làm trong khoảng giờ</option></select></label>
    {!rule.off&&<><label>Bắt đầu làm<input type="time" step="1800" value={rule.start} onChange={event=>setRule({...rule,start:event.target.value})} /></label><label>Kết thúc làm<input type="time" step="1800" value={rule.end} onChange={event=>setRule({...rule,end:event.target.value})} /></label></>}
    <button className="primary" type="button" disabled={saving||!selected.length||!selectedDates.length} onClick={()=>save(true)}>{saving?'Đang lưu…':'Lưu các ngày đã chọn'}</button>
   </div>
  </div>
  <details className="card"><summary>Mẫu theo thứ trong tuần (tùy chọn, chỉ áp dụng tháng đang chọn)</summary><div className="staffScheduleGrid">{weekly.map((item,index)=><div className="staffScheduleDay" key={index}><strong>{names[index]}</strong><label><input type="checkbox" checked={item.off} onChange={event=>setWeekly(weekly.map((current,i)=>i===index?{...current,off:event.target.checked}:current))} />Nghỉ cả ngày</label>{!item.off&&<div><input aria-label={`${names[index]} bắt đầu`} type="time" step="1800" value={item.start} onChange={event=>setWeekly(weekly.map((current,i)=>i===index?{...current,start:event.target.value}:current))} />–<input aria-label={`${names[index]} kết thúc`} type="time" step="1800" value={item.end} onChange={event=>setWeekly(weekly.map((current,i)=>i===index?{...current,end:event.target.value}:current))} /></div>}</div>)}</div><button className="ghost" type="button" onClick={applyWeekly}>Áp dụng mẫu cho cả tháng</button></details>
  <details className="card" open={showMonth} onToggle={event=>setShowMonth(event.currentTarget.open)}><summary>Xem và sửa từng ngày của cả tháng</summary><div className="bulkScheduleTableWrap"><table className="bulkScheduleTable"><thead><tr><th>Ngày</th><th>Nghỉ</th><th>Bắt đầu làm</th><th>Kết thúc</th></tr></thead><tbody>{dates.map(date=>{const day=days[date]||{};function edit(patch){setDays({...days,[date]:{...day,...patch}});}return <tr key={date}><td>{date} · {names[new Date(`${date}T12:00:00Z`).getUTCDay()]}</td><td><input type="checkbox" checked={Boolean(day.off)} onChange={event=>edit({off:event.target.checked})} /></td><td><input type="time" step="1800" disabled={day.off} value={day.start||''} onChange={event=>edit({start:event.target.value})} /></td><td><input type="time" step="1800" disabled={day.off} value={day.end||''} onChange={event=>edit({end:event.target.value})} /></td></tr>;})}</tbody></table></div><button className="primary" type="button" onClick={()=>save(false)} disabled={saving||!selected.length}>{saving?'Đang lưu…':'Lưu và đồng bộ lịch tháng'}</button></details>
  <p role="status">{message}</p>
 </section>;
}
