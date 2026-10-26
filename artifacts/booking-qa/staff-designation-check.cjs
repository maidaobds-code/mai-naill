const { chromium } = require('./node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let staff = [{ id: 'staff-1', name: 'Mai', role: 'staff', status: 'Working', color: '#a93670', email: 'mai@example.com', external: {}, designationFee: 1100, bookingVisible: true }];
  let bookingPayload = null;
  const service = { id: 'mai-menu-1', category: 'hand', name: 'Clear Nail', price: 3900, duration: 60, staff: [], description: '', imageUrl: '', catalogVersion: 1 };
  await context.addInitScript(() => {
    localStorage.setItem('nail-japan-language', 'vi');
    localStorage.setItem('nail-japan-store-language', 'vi');
    localStorage.setItem('nail-japan-current-account', JSON.stringify({ id: 'owner', role: 'owner', name: 'Owner', email: 'owner@example.com' }));
  });
  await context.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/staff') {
      if (request.method() === 'POST') { staff = request.postDataJSON().value; return route.fulfill({ json: { ok: true, value: staff } }); }
      return route.fulfill({ json: { ok: true, value: staff } });
    }
    if (path === '/api/catalog') return route.fulfill({ json: { ok: true, value: [service] } });
    if (path === '/api/bookings') {
      if (request.method() === 'POST') { bookingPayload = request.postDataJSON().bookings[0]; return route.fulfill({ json: { ok: true, value: [bookingPayload], assignmentNotifications: [] } }); }
      return route.fulfill({ json: { ok: true, value: [] } });
    }
    return route.fulfill({ json: { ok: true, value: [] } });
  });
  const page = await context.newPage();
  await page.goto('http://localhost:3012/');
  await page.locator('.navItem').nth(10).click();
  await page.getByRole('button', { name: /Cài đặt hiển thị/ }).click();
  const editor = page.locator('.staffBookingEditor');
  await editor.getByLabel('Tên hiển thị').fill('Mai Design');
  await editor.getByLabel('Phí chỉ định (JPY)').fill('1500');
  await editor.getByLabel('Mô tả hiển thị cho khách').fill('Chuyên design theo yêu cầu.');
  await editor.locator('input[type=file]').setInputFiles({ name: 'mai.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZgQAAAABJRU5ErkJggg==', 'base64') });
  await editor.getByRole('button', { name: 'Lưu cài đặt chỉ định' }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('nail-japan-staff') || '[]')[0]?.designationFee === 1500);
  assert.equal(staff[0].displayName, 'Mai Design');
  assert.match(staff[0].avatarUrl, /^data:image\/png/);

  await page.goto('http://localhost:3012/booking');
  await page.locator('.maiService').first().click();
  await page.locator('.maiSummary .primary').click();
  const staffButton = page.locator('.maiStaffPicker>button').nth(1);
  await staffButton.waitFor();
  assert.match(await staffButton.innerText(), /Mai Design/);
  assert.match(await staffButton.innerText(), /1,500/);
  assert.match(await staffButton.innerText(), /Chuyên design/);
  assert.equal(await staffButton.locator('img').count(), 1);
  await staffButton.click();
  assert.match(await page.locator('.maiTotal').innerText(), /5,400/);
  await page.locator('.maiTimes button').first().click();
  await page.locator('.maiSummary .primary').click();
  await page.getByLabel('Số điện thoại').fill('09012345678');
  await page.locator('.maiConsent input').check();
  await page.getByRole('button', { name: 'Đồng ý và đặt lịch' }).click();
  await page.locator('.maiDone').waitFor();
  assert.equal(bookingPayload.staff, 'Mai');
  assert.equal(bookingPayload.designationFee, 1500);
  assert.equal(bookingPayload.price, 5400);
  await page.setViewportSize({ width: 390, height: 844 });
  const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(sizes.document <= sizes.viewport, JSON.stringify(sizes));
  console.log('staff display settings save PASS');
  console.log('name/image/description/fee sync to booking PASS');
  console.log('designation fee included in total PASS');
  console.log('booking staff picker mobile 390px PASS');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
