import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { chromium } from 'playwright';

const source = fs.readFileSync('automation/salonboard-worker.mjs', 'utf8');
const loginSource = source.slice(source.indexOf('async function tryAutoLogin('), source.indexOf('function internalStaffName('));
const root = path.resolve('vendor/playwright-browsers');
const revision = fs.readdirSync(root).find(name => /^chromium-\d+$/.test(name));
const browser = await chromium.launch({ executablePath: path.join(root, revision, 'chrome-win64/chrome.exe'), headless: true });
try {
  const page = await browser.newPage();
  let navigateOnClick = true;
  // Public SALON BOARD form structure observed on 2026-11-13. Test credentials only.
  await page.route('https://salonboard.test/**', route => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: route.request().url().includes('expired-login') ? '<p>一定時間操作されなかったため、ログインの有効期限が\n切れました。再度ログインしなおしてください。</p><a href="/login/">ログインへ</a>' : `<form id="idPasswordInputForm"><input type="text" name="userId"><input type="password" name="password" id="jsiPwInput"><a href="javascript:void(0);" class="common-CNCcommon__primaryBtn loginBtnSize" onclick="dologin(event); return false;">ログイン</a></form><script>window.submissions=0; function dologin(event){ event.preventDefault(); window.submissions++; ${navigateOnClick ? "location.href='/KLP/schedule/salonSchedule/';" : ''} }</script>`,
  }));
  function context(username = 'test-id', password = 'test-password') {
    const result = vm.createContext({ page, loginUsername: username, loginPassword: password, log: () => {}, isLoginPage: p => /login/.test(p.url()), isSessionExpired: async () => false });
    vm.runInContext(`let autoLoginAttempts=0; ${loginSource}`, result);
    return result;
  }
  await page.goto('https://salonboard.test/login/');
  assert.equal(await vm.runInContext('tryAutoLogin(page)', context()), true, 'real anchor login must navigate successfully');
  assert.match(page.url(), /\/KLP\/schedule/);

  await page.goto('https://salonboard.test/login/');
  await page.locator('[name=userId]').fill('browser-prefilled-id');
  await page.locator('[name=password]').fill('browser-prefilled-password');
  assert.equal(await vm.runInContext('tryAutoLogin(page)', context('', '')), true, 'prefilled browser credentials must work without config');

  await page.goto('https://salonboard.test/login/');
  assert.equal(await vm.runInContext('tryAutoLogin(page)', context('', '')), false, 'empty form without credentials must not submit');
  assert.equal(await page.evaluate(() => window.submissions), 0);

  navigateOnClick = false;
  await page.goto('https://salonboard.test/login/');
  // Avoid long waits in the rejected-login fixture; retain a real browser click.
  const rejectedPage = { locator: (...args) => page.locator(...args), mouse: page.mouse, waitForURL: async () => {}, url: () => page.url() };
  const rejected = context();
  rejected.page = rejectedPage;
  for (let i = 0; i < 3; i++) assert.equal(await vm.runInContext('tryAutoLogin(page)', rejected), false);
  assert.equal(await page.evaluate(() => window.submissions), 2, 'anchor submission must retain the two-attempt limit');
  navigateOnClick = true;
  const expirySource = source.slice(source.indexOf('async function isSessionExpired('), source.indexOf('async function navigate('));
  const branchStart = source.indexOf('      if (await isSessionExpired(page)) {');
  const branchEnd = source.indexOf(' else if (isLoginPage(page)) {', branchStart);
  const branch = source.slice(branchStart, branchEnd);
  const recovery = vm.createContext({
    page, loginUsername: 'test-id', loginPassword: 'test-password',
    isLoginPage: p => /login/.test(p.url()), log: () => {}, alertAdmin: async () => {},
    loginUrl: 'https://salonboard.test/login/', pollMs: 10,
    setTimeout: resolve => resolve(),
  });
  vm.runInContext(`let autoLoginAttempts=0; ${expirySource} ${loginSource}`, recovery);
  await page.goto('https://salonboard.test/expired-login/');
  assert.equal(await vm.runInContext('isSessionExpired(page)', recovery), true, 'expiry notice must be recognized even at login URL and with line breaks');
  await vm.runInContext(`(async () => { let sessionEstablished=true; for (let i=0; i<1; i++) { ${branch} throw Error('Must not process tasks on expired page'); } })()`, recovery);
  assert.match(page.url(), /\/KLP\/schedule/, 'expiry screen must recover through the real anchor login flow');
  assert.equal(await vm.runInContext('isSessionExpired(page)', recovery), false, 'ordinary page must not be mistaken for expiry');
  console.log('PASS real-browser anchor login, prefilled credentials, retry limit, and expired-login notice recovery');
} finally {
  await browser.close();
}
