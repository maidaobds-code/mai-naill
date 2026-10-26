const { chromium } = require('./node_modules/playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext();
 await context.addInitScript(()=>{localStorage.setItem('nail-japan-store-language','vi');localStorage.setItem('nail-japan-current-account',JSON.stringify({id:'qa',name:'QA Customer',email:'qa@example.com',phone:'09012345678',role:'customer'}));});
 let posts=[]; let fail=false;
 await context.route('**/api/**',async route=>{const req=route.request(); const path=new URL(req.url()).pathname;if(req.method()==='POST'){posts.push({path,body:req.postDataJSON()});if(path==='/api/bookings')return route.fulfill({status:fail?500:200,json:fail?{ok:false}:{ok:true,value:req.postDataJSON().bookings}});return route.fulfill({json:{ok:true}});}return route.fulfill({json:{ok:true,value:[]}});});
 const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,1024,768,390,320]){
  await page.setViewportSize({width,height:900});await page.goto('http://localhost:3012/booking');await page.locator('.maiService').last().waitFor();
  assert.equal(await page.locator('.maiService').count(),32);assert.equal(await page.locator('.maiOptions input[type=checkbox]').count(),11);
  const sizes=await page.evaluate(()=>({viewport:innerWidth,body:document.documentElement.scrollWidth}));assert.ok(sizes.body<=sizes.viewport,JSON.stringify({width,...sizes}));
  await page.screenshot({path:`artifacts/booking-qa/booking-${width}.png`,fullPage:true});
  console.log('responsive',width,'PASS');
 }
 await page.locator('.maiService').first().click();await page.locator('.maiOptions input[type=checkbox]').first().check();assert.match(await page.locator('.maiTotal').innerText(),/4,900/);
 await page.locator('.maiOptions input[type=checkbox]').nth(1).check();await page.locator('.maiOptions input[type=checkbox]').nth(4).check();assert.equal(await page.locator('.maiOptions input[type=checkbox]:checked').count(),2);assert.match(await page.locator('.maiTotal').innerText(),/5,900/);
 await page.locator('.maiSummary .primary').click();await page.locator('input[type=date]').fill('2026-11-01');await page.locator('.maiTimes button').first().click();await page.locator('.maiSummary .primary').click();
 assert.equal(await page.locator('button[form=mai-confirm]').isDisabled(),true);await page.locator('.maiConsent input').check();fail=true;await page.locator('button[form=mai-confirm]').click();await page.locator('.maiNotice').waitFor();assert.equal(await page.locator('.maiDone').count(),0);fail=false;await page.locator('button[form=mai-confirm]').click();await page.locator('.maiDone').waitFor();
 const booking=posts.find(p=>p.path==='/api/bookings').body.bookings[0];assert.equal(booking.price,5900);assert.match(booking.service,/パラジェル変更/);assert.equal(booking.date,'2026-11-01');assert.equal(booking.end,'11:30');
 assert.deepEqual(errors,[]); console.log('flow / totals / replacement exclusivity / saved payload PASS');console.log('API writes mocked; no Supabase writes');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
