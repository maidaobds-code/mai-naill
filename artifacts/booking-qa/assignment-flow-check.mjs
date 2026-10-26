import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.BOOKING_ASSIGN_SECRET = 'test-assignment-secret';
process.env.RESEND_API_KEY = 'test-resend-key';
process.env.RESEND_FROM = 'Mai Beauty Salon <booking@example.com>';
process.env.NEXT_PUBLIC_SITE_URL = 'https://salon.example.com';

let bookings = [];
const accounts = [
  { id: 'owner', role: 'owner', name: 'Owner', email: 'owner@example.com' },
  { id: 'manager', role: 'manager', name: 'Manager', email: 'manager@example.com' },
];
const staff = [{ id: 'staff-1', name: 'Mai', role: 'Nailist', email: 'mai@example.com', color: '#a93670' }];
const emails = [];

globalThis.fetch = async (url, options = {}) => {
  const value = String(url);
  if (value === 'https://api.resend.com/emails') {
    emails.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ id: `email-${emails.length}` }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (value.startsWith('https://supabase.test/rest/v1/app_kv')) {
    if ((options.method || 'GET') === 'POST') {
      const row = JSON.parse(options.body)[0];
      if (row.key === 'nail-japan-bookings') bookings = row.value;
      return new Response(JSON.stringify([row]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (value.includes('key=eq.nail-japan-bookings')) return Response.json([{ value: bookings }]);
    const rows = [];
    if (value.includes('nail-japan-settings')) rows.push({ key: 'nail-japan-settings', value: { email: 'owner@example.com' } });
    if (value.includes('nail-japan-accounts-v1')) rows.push({ key: 'nail-japan-accounts-v1', value: accounts });
    if (value.includes('nail-japan-staff')) rows.push({ key: 'nail-japan-staff', value: staff });
    return Response.json(rows);
  }
  throw new Error(`Unexpected fetch: ${value}`);
};

const bookingRoute = await import('../../app/api/bookings/route.js');
const assignmentRoute = await import('../../app/api/booking-assignment/route.js');
const pending = { id: 'web-test-1', date: '2026-11-02', day: 2, start: '10:00', end: '11:00', customer: 'Test Customer', email: 'customer@example.com', service: 'Gel Nail', staff: 'Chưa phân công', staffId: '', assignmentStatus: 'PENDING_ASSIGNMENT', approvalStatus: 'PENDING_OWNER_CONFIRMATION', status: 'CONFIRMED', source: 'direct' };
const createResponse = await bookingRoute.POST(new Request('https://salon.example.com/api/bookings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bookings: [pending] }) }));
const createResult = await createResponse.json();
assert.equal(createResult.ok, true);
assert.equal(emails.length, 1);
assert.deepEqual(emails[0].to.sort(), ['manager@example.com', 'owner@example.com']);
const token = decodeURIComponent(emails[0].html.match(/assign-booking\?token=([^"&]+)/)[1]);

const detailResponse = await assignmentRoute.GET(new Request(`https://salon.example.com/api/booking-assignment?token=${encodeURIComponent(token)}`));
const detail = await detailResponse.json();
assert.equal(detail.booking.id, pending.id);
assert.equal(detail.staff[0].name, 'Mai');

const assignResponse = await assignmentRoute.POST(new Request('https://salon.example.com/api/booking-assignment', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, staffId: 'staff-1' }) }));
const assigned = await assignResponse.json();
assert.equal(assigned.ok, true);
assert.equal(bookings[0].staff, 'Mai');
assert.equal(bookings[0].assignmentStatus, 'ASSIGNED');
assert.equal(emails.length, 3);
assert.deepEqual(emails[1].to, ['mai@example.com']);
assert.deepEqual(emails[2].to, ['customer@example.com']);
assert.match(emails[2].html, /Lịch hẹn đã được chấp nhận/);
assert.match(emails[2].html, /Hủy hẹn/);
const alreadyAssigned = { id: 'web-test-2', date: '2026-11-02', day: 2, start: '12:00', end: '13:00', customer: 'Assigned Customer', service: 'Gel Nail', staff: 'Mai', staffId: 'staff-1', assignmentStatus: 'ASSIGNED', status: 'CONFIRMED', source: 'direct' };
const assignedCreateResponse = await bookingRoute.POST(new Request('https://salon.example.com/api/bookings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bookings: [...bookings, alreadyAssigned] }) }));
const assignedCreateResult = await assignedCreateResponse.json();
assert.equal(assignedCreateResult.ok, true);
assert.equal(emails.length, 4);
assert.match(emails[3].html, /Chọn \/ đổi nhân viên/);
assert.match(emails[3].html, /Nhân viên hiện tại:<\/strong> Mai/);
console.log('pending booking -> owner and manager email PASS');
console.log('signed assignment link -> staff selection PASS');
console.log('Supabase booking update -> employee email PASS');
console.log('preassigned booking -> Gmail choose/change staff button PASS');
