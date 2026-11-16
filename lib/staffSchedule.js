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
