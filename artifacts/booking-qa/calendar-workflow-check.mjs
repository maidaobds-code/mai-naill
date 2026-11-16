import assert from 'node:assert/strict';
import { monthDates, scheduleClosedPeriods } from '../../lib/staffSchedule.js';
import { autoAssignBooking } from '../../lib/autoAssignment.js';
import { preserveManualTranslations } from '../../lib/manualTranslations.js';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://supabase.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-key';process.env.ADMIN_USER='admin@test.local';process.env.ADMIN_PASS='test';process.env.ADMIN_SESSION_SECRET='test-secret';process.env.BOOKING_SYNC_SECRET='test-sync';process.env.BOOKING_ASSIGN_SECRET='test-assign';process.env.RESEND_API_KEY='test-email';
const staff=[{id:'a',name:'First',active:true},{id:'b',name:'Second',active:true}];
let settings={openTime:'09:00',closeTime:'23:00'};
let bookings=[];let emails=0;let writes=0;
globalThis.fetch=async(url,options={})=>{
 const text=String(url);
 if(text==='https://api.resend.com/emails'){emails++;return Response.json({id:'test-email'});}
 if(!text.startsWith('https://supabase.test/rest/v1/app_kv'))throw Error(`Unexpected request ${text}`);
 if(options.method==='POST'){writes++;const rows=JSON.parse(options.body);for(const row of rows){if(row.key==='nail-japan-bookings')bookings=row.value;if(row.key==='nail-japan-settings')settings=row.value;}return Response.json(rows);}
 if(text.includes('key=eq.nail-japan-bookings'))return Response.json([{value:bookings}]);
 return Response.json([{key:'nail-japan-staff',value:staff},{key:'nail-japan-settings',value:settings},{key:'nail-japan-services',value:[]},{key:'nail-japan-accounts-v1',value:[{role:'owner',email:'owner@example.test'}]}]);
};
const {createAdminSession}=await import('../../lib/serverAuth.js');
const cookie=`nail_admin_session=${createAdminSession()}`;
const bookingRoute=await import('../../app/api/bookings/route.js');
const syncRoute=await import('../../app/api/booking-sync/route.js');
const bulkRoute=await import('../../app/api/staff-schedule/route.js');
const base={date:'2099-02-01',start:'12:00',end:'13:00',status:'CONFIRMED',source:'direct',service:'Nail'};
function post(list){return bookingRoute.POST(new Request('https://salon.test/api/bookings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({bookings:list})}));}
let response=await post([{...base,id:'first',customer:'A',assignmentStatus:'PENDING_ASSIGNMENT'},{...base,id:'second',customer:'B',assignmentStatus:'PENDING_ASSIGNMENT'}]);
assert.equal(response.status,200);let result=await response.json();
assert.equal(result.value.find(b=>b.id==='first').staffId,'a');assert.equal(result.value.find(b=>b.id==='second').staffId,'b');assert.equal(emails,0,'normal automatic assignments must not send emails');
response=await post([{...base,id:'third',customer:'C',assignmentStatus:'PENDING_ASSIGNMENT'}]);result=await response.json();assert.equal(result.value.find(b=>b.id==='third').assignmentStatus,'PENDING_ASSIGNMENT');assert.equal(emails,1,'only exhausted capacity asks the owner');
bookings=bookings.filter(b=>b.id==='first');
response=await post([{...bookings[0],staffId:'b',staff:'Second',start:'13:00',end:'14:00'}]);assert.equal(response.status,200);
response=await post([{...bookings[0],staffId:'a',staff:'First',start:'14:00',end:'15:00'}]);assert.equal(response.status,200);
result=await (await syncRoute.GET(new Request('https://salon.test/api/booking-sync?provider=hotpepper',{headers:{authorization:'Bearer test-sync'}}))).json();
const hot=result.tasks.filter(t=>t.booking.id==='first');
assert.equal(hot.length,3,'creation and both moves must remain queued');assert.equal(new Set(hot.map(t=>t.taskId)).size,3);assert.deepEqual(hot.map(t=>t.booking.start),['12:00','13:00','14:00']);assert.deepEqual(hot.map(t=>t.booking.staffId),['a','b','a']);assert.equal(hot[2].previousMatch.staffId,'b');
const before=JSON.stringify(bookings);
settings.staffClosedPeriods=['b 2099-02-01 14:00-15:00'];
response=await post([{...bookings[0],staffId:'b',staff:'Second'}]);assert.equal(response.status,409);assert.equal(JSON.stringify(bookings),before,'invalid move must not persist');
settings.staffClosedPeriods=[];bookings=[];
const days=Object.fromEntries(monthDates('2099-02').map(date=>[date,{off:false,start:'12:00',end:'19:00'}]));days['2099-02-02']={off:true};
function bulk(headers={cookie}){return bulkRoute.POST(new Request('https://salon.test/api/staff-schedule',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify({month:'2099-02',staffIds:['a'],days})}));}
response=await bulk({});assert.equal(response.status,401);
response=await bulk();result=await response.json();assert.equal(response.status,200);assert.ok(settings.staffClosedPeriods.includes('a 2099-02-01 09:00-12:00'));assert.ok(settings.staffClosedPeriods.includes('a 2099-02-02 09:00-23:00'));assert.ok(bookings.some(b=>b.pendingSyncActions.some(t=>t.target==='hotpepper'&&t.action==='block')));
const count=bookings.length;response=await bulk();assert.equal(response.status,200);assert.equal(bookings.length,count,'repeated bulk save must not duplicate tasks');
days['2099-02-01']={off:false,start:'09:00',end:'23:00'};response=await bulk();assert.equal(response.status,200);assert.ok(!settings.staffClosedPeriods.includes('a 2099-02-01 09:00-12:00'));assert.ok(bookings.some(b=>b.date==='2099-02-01'&&b.pendingSyncActions.some(t=>t.action==='cancel')));
bookings.push({...base,id:'protected',staffId:'a',staff:'First'});days['2099-02-01']={off:true};const previousWrites=writes;response=await bulk();assert.equal(response.status,409);assert.equal(writes,previousWrites,'occupied dates must reject before any write');
assert.equal(monthDates('2028-02').length,29);
assert.throws(()=>scheduleClosedPeriods('a','2099-02',{'2099-02-01':{start:'19:00',end:'12:00'}},'09:00','23:00'));
const manual={descriptionJa:'自然な説明',manualTranslations:{descriptionJa:true}};assert.equal(preserveManualTranslations({descriptionJa:'machine'},manual).descriptionJa,'自然な説明');
console.log('PASS automatic assignment, capacity exception only, ordered HOT moves, closed-staff rejection, monthly closures/reopen/auth/conflicts, and manual translations');

settings={openTime:'09:00',closeTime:'23:00',staffClosedPeriods:[]};bookings=[];
const emailsBefore=emails;
response=await syncRoute.POST(new Request('https://salon.test/api/booking-sync',{method:'POST',headers:{authorization:'Bearer test-sync','content-type':'application/json'},body:JSON.stringify({provider:'nailie',externalBookingId:'test-auto',booking:{date:'2099-02-01',start:'12:00',end:'13:00',customer:'External',status:'CONFIRMED'}})}));
result=await response.json();assert.equal(result.ok,true);assert.equal(result.result.staffId,'a');assert.ok(result.tasks.some(task=>task.target==='hotpepper'&&task.action==='block'));assert.equal(emails,emailsBefore,'successful Nailie assignment must not notify owner');
bookings=[];
response=await post([{...base,id:'customer-confirmation',customer:'Customer',email:'customer@example.test',assignmentStatus:'PENDING_ASSIGNMENT'}]);result=await response.json();assert.equal(result.assignmentNotifications.length,0);assert.equal(result.customerNotifications.length,1);assert.equal(emails,emailsBefore+1,'customer confirmation must remain independent of staff assignment emails');
console.log('PASS Nailie auto-assignment queues HOT without owner email and customer confirmations remain enabled');
