import { salonCapacityState } from "./salonCapacity.js";
export function autoAssignBooking(booking, bookings, staff, settings={}, services=[]) {
 if(booking.deletedAt||['CANCELLED','COMPLETED'].includes(String(booking.status).toUpperCase())) return booking;
 const others=bookings.filter(item=>String(item.id)!==String(booking.id));
 const state=salonCapacityState(booking,others,staff,settings,services);
 const member=!state.saturated&&staff.find(item=>state.availableStaff.some(candidate=>String(candidate.id)===String(item.id)));
 if(!member)return {...booking,staff:'',staffId:'',assignmentStatus:'PENDING_ASSIGNMENT',approvalStatus:'OWNER_REVIEW_REQUIRED'};
 return {...booking,staff:member.name,staffId:member.id,staffEmail:member.email||'',staffRole:member.role||'',assignmentStatus:'ASSIGNED',approvalStatus:'AUTO_ASSIGNED',assignedAt:new Date().toISOString()};
}
