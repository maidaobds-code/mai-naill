const { chromium } = require('./node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  let assigned = false;
  await context.route('**/api/booking-assignment**', async route => {
    if (route.request().method() === 'POST') {
      assigned = true;
      return route.fulfill({ json: { ok: true, booking: { id: 'web-1', customer: 'Khách A', date: '2026-11-02', start: '10:00', end: '11:00', service: 'Gel Nail', staff: 'Mai', staffId: 'staff-1', assignmentStatus: 'ASSIGNED' }, notification: { ok: true } } });
    }
    return route.fulfill({ json: { ok: true, booking: { id: 'web-1', customer: 'Khách A', date: '2026-11-02', start: '10:00', end: '11:00', service: 'Gel Nail', staff: 'Chưa phân công', staffId: '', assignmentStatus: 'PENDING_ASSIGNMENT' }, staff: [{ id: 'staff-1', name: 'Mai', role: 'Nailist', color: '#a93670', hasEmail: true }, { id: 'staff-2', name: 'Hana', role: 'Nailist', color: '#7c3aed', hasEmail: false }] } });
  });
  const page = await context.newPage();
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('http://localhost:3012/assign-booking?token=test-token');
    await page.getByRole('heading', { name: 'Chọn nhân viên' }).waitFor();
    const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert.ok(sizes.document <= sizes.viewport, JSON.stringify({ width, ...sizes }));
  }
  await page.getByText('Mai', { exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận nhân viên' }).click();
  await page.getByText(/gửi email thông báo/).waitFor();
  assert.equal(assigned, true);
  console.log('assignment page responsive 1280/390/320 PASS');
  console.log('staff selection confirmation PASS');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
