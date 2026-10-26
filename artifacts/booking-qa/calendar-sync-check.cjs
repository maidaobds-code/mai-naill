const { chromium } = require('./node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  const day = Number(today.slice(-2));
  const booking = { id: 'web-qa', date: today, day, start: '10:00', end: '11:00', customer: 'Booking QA', phone: '090-1111-2222', email: 'qa@example.com', service: 'Nail tay', staff: 'Mai', source: 'direct', status: 'CONFIRMED' };
  await context.addInitScript(() => {
    localStorage.setItem('nail-japan-language', 'vi');
    localStorage.setItem('nail-japan-current-account', JSON.stringify({ id: 'owner', role: 'owner', name: 'QA Owner', email: 'owner@example.com' }));
  });
  await context.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/bookings') return route.fulfill({ json: { ok: true, value: [booking] } });
    if (path === '/api/staff') return route.fulfill({ json: { ok: true, value: [] } });
    return route.fulfill({ json: { ok: true, value: [] } });
  });
  const page = await context.newPage();
  await page.goto('http://localhost:3012/');
  await page.getByText('Booking QA').waitFor();
  assert.match(await page.locator('.summaryPill').first().innerText(), new RegExp(today.replaceAll('-', '/')));
  assert.equal(await page.locator('.timelineBooking').count(), 1);
  await page.getByRole('button', { name: 'Sau' }).click();
  const tomorrow = new Date(`${today}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  assert.match(await page.locator('.summaryPill').first().innerText(), new RegExp(tomorrow.toISOString().slice(0, 10).replaceAll('-', '/')));
  console.log('website booking visible on owner calendar PASS');
  console.log('ISO date navigation PASS');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
