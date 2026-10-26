const { chromium } = require('./node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem('nail-japan-language', 'vi');
    localStorage.setItem('nail-japan-store-language', 'vi');
    localStorage.setItem('nail-japan-current-account', JSON.stringify({ id: 'owner', role: 'owner', name: 'QA Owner', email: 'owner@example.com' }));
  });

  let catalog = [
    { id: 'svc-one', name: 'Gel One Color', price: 6500, duration: 75, owner: 'Admin', staff: ['Mai'], description: 'Màu gel cơ bản', imageUrl: '' },
    { id: 'svc-art', name: 'Magnet + Art', price: 9800, duration: 90, owner: 'Admin', staff: ['Yuki'], description: 'Mẫu nail art', imageUrl: '' },
    { id: 'svc-french', name: 'French Design', price: 8800, duration: 90, owner: 'Admin', staff: ['Hana'], description: 'French design', imageUrl: '' },
  ];
  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/catalog') {
      if (request.method() === 'POST') {
        catalog = request.postDataJSON().value;
        return route.fulfill({ json: { ok: true, value: catalog } });
      }
      return route.fulfill({ json: { ok: true, value: catalog } });
    }
    return route.fulfill({ json: { ok: true, value: [] } });
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:3012/');
  await page.locator('.navItem').nth(4).click();
  await page.locator('.serviceEditorPanel').waitFor();
  assert.equal(await page.locator('tbody tr').count(), 32);

  await page.locator('tbody tr').first().getByRole('button', { name: /Sửa/ }).click();
  const editor = page.locator('.serviceEditorPanel');
  await editor.locator('input[type=number]').first().fill('4200');
  await editor.locator('input[type=file]').setInputFiles({
    name: 'service.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZgQAAAABJRU5ErkJggg==', 'base64'),
  });
  await page.getByRole('button', { name: /Lưu dịch vụ/ }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('nail-japan-services') || '[]').length === 32);
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('nail-japan-services')));
  assert.equal(saved[0].price, 4200);
  assert.match(saved[0].imageUrl, /^data:image\/png/);

  await page.goto('http://localhost:3012/booking');
  const firstService = page.locator('.maiService').first();
  await firstService.waitFor();
  assert.match(await firstService.innerText(), /4,200/);
  assert.equal(await firstService.locator('.maiServiceImage').count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3012/');
  await page.locator('.navItem').nth(4).click();
  await page.locator('.serviceEditorPanel').waitFor();
  const mobileWidth = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(mobileWidth.document <= mobileWidth.viewport, JSON.stringify(mobileWidth));
  assert.deepEqual(errors, []);
  console.log('management catalog 32 services PASS');
  console.log('edit price + image -> booking sync PASS');
  console.log('management mobile 390px overflow check PASS');
  console.log('API mocked; Supabase unchanged during QA');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
