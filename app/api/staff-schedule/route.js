import { createHash } from "node:crypto";
import { isAdminRequest, isOwnerRequest } from "../../../lib/serverAuth.js";
import { salonSettings, staffCatalog, serviceCatalog } from "../../../lib/serverEmail.js";
import { scheduleClosedPeriods, closedPeriodsForDates, parseStaffPeriod, monthDates } from "../../../lib/staffSchedule.js";
import { syncTaskId } from "../../../lib/bookingSync.js";
import { nailieCapacityTask } from "../../../lib/salonCapacity.js";
const owner=process.env.CATALOG_OWNER_ID||"00000000-0000-0000-0000-000000000001";
async function rest(path, options={}) {
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
 const response=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`,{...options,cache:"no-store",headers:{apikey:key,authorization:`Bearer ${key}`,"content-type":"application/json",...options.headers}});
 if(!response.ok) throw Error("Không thể lưu lịch làm/ nghỉ lên server"); return response.json();
}
function record(task,slot,member={}) {
 const fingerprint=[task.target,task.lockOwner||"",slot.date,slot.start,slot.end,member.id||member.name||"salon"].join("|");
 const id=`manual-sync-${createHash("sha256").update(fingerprint).digest("hex").slice(0,24)}`;
 return {id,source:"manual_sync",manualOnly:true,deletedAt:new Date().toISOString(),status:"MANUAL_SYNC",...slot,staffId:member.id||"",staff:member.name||"",pendingSyncActions:[{...task,bookingId:id,taskId:syncTaskId({...task,bookingId:id})}]};
}
export async function POST(request) {
 if(!isAdminRequest(request)&&!isOwnerRequest(request)) return Response.json({ok:false,message:"Unauthorized"},{status:401});
 try {
  const body=await request.json(); if(body.partial!==true)monthDates(body.month);
  const affectedDates=body.partial===true?Object.keys(body.days||{}).sort():monthDates(body.month);
  if(!affectedDates.length||affectedDates.length>366)throw Error("Chọn từ 1 đến 366 ngày");
  const affectedMonths=[...new Set(affectedDates.map(date=>date.slice(0,7)))];

  const [settings,staff,services,rows]=await Promise.all([salonSettings(),staffCatalog(),serviceCatalog(),rest(`app_kv?owner_id=eq.${encodeURIComponent(owner)}&key=eq.nail-japan-bookings&select=value`)]);
  const selected=staff.filter(member=>(body.staffIds||[]).map(String).includes(String(member.id)));
  if(!selected.length) return Response.json({ok:false,message:"Chọn ít nhất một nhân viên"},{status:400});
  const bookings=rows?.[0]?.value||[];
  const work={...settings.staffWorkSchedules}; const owned={...settings.bulkStaffClosedPeriods};
  const removed=[],added=[];
  for(const member of selected){
   const generated=closedPeriodsForDates(member.id,body.days,settings.openTime||"09:00",settings.closeTime||"23:00");
   for(const month of affectedMonths){
    const dates=affectedDates.filter(date=>date.startsWith(month+"-"));monthDates(month);
    const key=`${member.id}|${month}`;const old=owned[key]||[];
    const next=[...old.filter(raw=>!dates.includes(parseStaffPeriod(raw)?.date)),...generated.filter(raw=>dates.includes(parseStaffPeriod(raw).date))];
    removed.push(...old.filter(raw=>!next.includes(raw)));added.push(...next.filter(raw=>!old.includes(raw)));
    owned[key]=next;work[key]={...work[key],...Object.fromEntries(dates.map(date=>[date,body.days[date]]))};
   }
  }
  for(const raw of added){const slot=parseStaffPeriod(raw);if(Date.parse(`${slot.date}T${slot.end}:00+09:00`)<=Date.now())continue;const member=selected.find(m=>String(m.id)===slot.staffId);const conflict=bookings.find(b=>!b.deletedAt&&!['CANCELLED','COMPLETED'].includes(String(b.status).toUpperCase())&&(String(b.staffId)===slot.staffId||b.staff===member?.name)&&b.date===slot.date&&b.start<slot.end&&b.end>slot.start);if(conflict)return Response.json({ok:false,message:`${member.name}: ${slot.date} ${slot.start}–${slot.end} đã có lịch hẹn. Hãy đổi lịch hẹn trước.`},{status:409});}
  const nextSettings={...settings,staffWorkSchedules:work,bulkStaffClosedPeriods:owned,staffClosedPeriods:[...new Set([...(settings.staffClosedPeriods||[]).filter(p=>!removed.includes(p)),...added])]};
  const records=[];
  for(const [periods,action] of [[removed,'cancel'],[added,'block']])for(const raw of periods){const slot=parseStaffPeriod(raw);if(Date.parse(`${slot.date}T${slot.end}:00+09:00`)<=Date.now())continue;const member=selected.find(m=>String(m.id)===slot.staffId);records.push(record({target:'hotpepper',action,match:{...slot,staff:member.name}},slot,member));const capacity=nailieCapacityTask(slot,bookings,staff,nextSettings,'recheck',services);records.push(record(capacity,slot));}
  const pending=new Map();for(const item of records){const prior=pending.get(item.id);pending.set(item.id,prior?{...item,pendingSyncActions:[...new Map([...prior.pendingSyncActions,...item.pendingSyncActions].map(task=>[task.taskId,task])).values()]}:item);}
  const nextBookings=[...pending.values(),...bookings.filter(b=>!pending.has(b.id))];
  await rest('app_kv?on_conflict=owner_id,key',{method:'POST',headers:{prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify([{owner_id:owner,key:'nail-japan-settings',value:nextSettings},{owner_id:owner,key:'nail-japan-bookings',value:nextBookings}])});
  return Response.json({ok:true,value:nextSettings,queued:records.length});
 }catch(error){return Response.json({ok:false,message:error.message},{status:400});}
}
