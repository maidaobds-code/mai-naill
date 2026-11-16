export function monthDates(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error("Tháng không hợp lệ");
  const [year, number] = month.split("-").map(Number);
  return Array.from({length:new Date(Date.UTC(year,number,0)).getUTCDate()},(_,i)=>`${month}-${String(i+1).padStart(2,"0")}`);
}
export function scheduleClosedPeriods(staffId, month, days, open="09:00", close="23:00") {
  const valid = time => /^(?:[01]\d|2[0-3]):(?:00|30)$/.test(time);
  if (!valid(open) || !valid(close) || open>=close) throw Error("Giờ mở/đóng phải đúng mốc 30 phút trong cùng ngày");
  return monthDates(month).flatMap(date=>{
    const day=days[date]; if(!day) throw Error(`Thiếu lịch ngày ${date}`);
    if(day.off) return [`${staffId} ${date} ${open}-${close}`];
    if(!valid(day.start)||!valid(day.end)||day.start>=day.end||day.start<open||day.end>close) throw Error(`Giờ làm không hợp lệ: ${date}`);
    return [...(open<day.start?[`${staffId} ${date} ${open}-${day.start}`]:[]),...(day.end<close?[`${staffId} ${date} ${day.end}-${close}`]:[])];
  });
}
export function parseStaffPeriod(raw) {const match=String(raw).match(/^(.+?) (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})-(\d{2}:\d{2})$/); return match?{staffId:match[1],date:match[2],start:match[3],end:match[4]}:null;}

export function dateRange(from, to) {
  for(const date of [from,to]) if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!monthDates(date.slice(0,7)).includes(date)) throw Error("Ngày không hợp lệ");
  if(from>to)throw Error("Ngày kết thúc phải từ ngày bắt đầu trở đi");
  const count=Math.round((Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/86400000)+1;
  if(count>366)throw Error("Mỗi lần chỉ chọn tối đa 366 ngày");
  return Array.from({length:count},(_,i)=>new Date(Date.parse(`${from}T12:00:00Z`)+i*86400000).toISOString().slice(0,10));
}
export function closedPeriodsForDates(staffId, days, open="09:00", close="23:00") {
  const dates=Object.keys(days||{}).sort();
  if(!dates.length||dates.length>366)throw Error("Chọn từ 1 đến 366 ngày");
  const months=[...new Set(dates.map(date=>date.slice(0,7)))];
  return months.flatMap(month=>{
    const monthDays=monthDates(month);
    if(dates.filter(date=>date.startsWith(month)).some(date=>!monthDays.includes(date)))throw Error("Ngày không hợp lệ");
    const complete=Object.fromEntries(monthDays.map(date=>[date,days[date]||{off:false,start:open,end:close}]));
    return scheduleClosedPeriods(staffId,month,complete,open,close).filter(raw=>dates.includes(parseStaffPeriod(raw).date));
  });
}
export function staffIsOffAllDay(member, date, settings={}) {
  if(settings.staffWorkSchedules?.[`${member.id}|${date.slice(0,7)}`]?.[date]?.off)return true;
  const open=settings.openTime||"09:00",close=settings.closeTime||"23:00";
  const intervals=(settings.staffClosedPeriods||[]).map(parseStaffPeriod).filter(slot=>slot&&slot.date===date&&[String(member.id).trim().toLowerCase(),String(member.name).trim().toLowerCase()].includes(String(slot.staffId).trim().toLowerCase())).sort((a,b)=>a.start.localeCompare(b.start));
  let end=open;for(const slot of intervals){if(slot.start>end)break;if(slot.end>end)end=slot.end;if(end>=close)return true;}return false;
}
