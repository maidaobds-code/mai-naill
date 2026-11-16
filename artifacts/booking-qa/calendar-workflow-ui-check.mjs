import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import { chromium } from 'playwright';
const root=path.resolve('vendor/playwright-browsers');const revision=fs.readdirSync(root).find(n=>/^chromium-\d+$/.test(n));
const browser=await chromium.launch({headless:true,executablePath:path.join(root,revision,'chrome-win64/chrome.exe')});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo'}).format(new Date());
const owner={id:'owner',role:'owner',name:'Test Owner',email:'owner@example.test'};
const staff=[{id:'a',name:'First',color:'#a93670',role:'staff',email:'first@example.test'},{id:'b',name:'Second',color:'#06b6d4',role:'staff',email:'second@example.test'}];
let settings={salonName:'QA Salon',openTime:'09:00',closeTime:'23:00',closedPeriods:[],staffClosedPeriods:[],bookingNotice:'Nội dung gốc'};
let bookings=[{id:'drag-test',customer:'Drag test customer',date:today,start:'12:00',end:'13:00',staffId:'a',staff:'First',status:'CONFIRMED',source:'direct',service:'Test service'}];
let moved=null;let bulk=null;let settingsWrites=0;
const services=[{id:'service',name:'Test service',description:'Menu description',price:1000,duration:60,staff:['a','b']}];
await page.addInitScript(({owner,staff,bookings})=>{localStorage.setItem('nail-japan-current-account',JSON.stringify(owner));localStorage.setItem('nail-japan-accounts-v1',JSON.stringify([owner]));localStorage.setItem('nail-japan-staff',JSON.stringify(staff));localStorage.setItem('nail-japan-bookings',JSON.stringify(bookings));localStorage.setItem('nail-japan-language','vi');},{owner,staff,bookings});
await page.route('**/api/**',async route=>{
 const request=route.request(),url=new URL(request.url()),body=request.postDataJSON?.();let value={ok:true,value:[]};
 if(url.pathname==='/api/staff')value={ok:true,value:staff};
 if(url.pathname==='/api/accounts')value={ok:true,value:[owner]};
 if(url.pathname==='/api/bookings'){if(request.method()==='POST'){moved=body.bookings[0];bookings=body.bookings;}value={ok:true,value:bookings};}
 if(url.pathname==='/api/settings'){if(request.method()==='POST'){settings=body;settingsWrites++;}value={ok:true,value:settings};}
 if(url.pathname==='/api/catalog')value={ok:true,value:url.searchParams.get('key')==='nail-japan-services'?services:[]};
 if(url.pathname==='/api/staff-schedule'){bulk=body;value={ok:true,value:settings,queued:2};}
 if(url.pathname==='/api/bot-tasks')value={ok:true,active:[],history:[]};
 if(url.pathname==='/api/printer-settings')value={ok:true,value:{mode:'star-usb',identifier:'desktop-only',printerLogoUrl:''}};
 if(url.pathname==='/api/translation-memory')value={ok:true,translations:{}};
 await route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
});
try{
 await page.goto('http://127.0.0.1:3100');await page.locator('.timelineBooking').filter({hasText:'Drag test customer'}).waitFor();
 const booking=page.locator('.timelineBooking').filter({hasText:'Drag test customer'});const box=await booking.boundingBox();const target=await page.locator('.resourceLane[data-member="b"]').boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(750);await page.mouse.move(box.x+box.width/2,target.y+target.height/2,{steps:12});await page.locator('.bookingDragGhost').waitFor();const ghost=await page.locator('.bookingDragGhost').boundingBox();assert.ok(Math.abs(ghost.y-(target.y+target.height/2-box.height/2))<3,'dragged block must follow the pointer before release');assert.equal(await page.locator('.bookingDropPreview').textContent(),'12:00–13:00');await page.screenshot({path:'artifacts/booking-qa/calendar-drag-preview.png'});await page.mouse.up();
 await page.waitForFunction(()=>document.body.innerText.includes('Đã chuyển lịch.'));
 assert.equal(moved.staffId,'b');assert.equal(moved.start,'12:00');assert.equal(moved.end,'13:00');
 await page.screenshot({path:'artifacts/booking-qa/calendar-drag-after.png',fullPage:true});
 await page.locator('.sidebarMenuToggle').click();assert.equal(await page.locator('#main-navigation').isVisible(),false);await page.locator('.sidebarMenuToggle').click();
 await page.locator('.navItem').filter({hasText:'Lịch làm / nghỉ'}).click();await page.getByRole('heading',{name:'Lịch làm / nghỉ theo nhân viên'}).waitFor();
 await page.getByLabel('First',{exact:true}).check();await page.getByText('Mẫu theo thứ trong tuần (tùy chọn, chỉ áp dụng tháng đang chọn)',{exact:true}).click();await page.getByRole('button',{name:'Áp dụng mẫu cho cả tháng'}).click();await page.getByRole('button',{name:'Lưu và đồng bộ lịch tháng'}).click();await page.waitForFunction(()=>document.body.innerText.includes('Đã lưu '));assert.deepEqual(bulk.staffIds,['a']);assert.ok(Object.values(bulk.days).every(day=>day.start==='12:00'&&day.end==='19:00'));
 await page.getByLabel('Từ ngày',{exact:true}).fill('2099-02-28');await page.getByLabel('Đến ngày',{exact:true}).fill('2099-03-02');await page.getByRole('button',{name:'Thêm khoảng ngày',exact:true}).click();await page.getByRole('button',{name:'Lưu các ngày đã chọn',exact:true}).click();await page.waitForTimeout(100);assert.equal(bulk.partial,true);assert.deepEqual(Object.keys(bulk.days),['2099-02-28','2099-03-01','2099-03-02']);
 await page.screenshot({path:'artifacts/booking-qa/staff-month-schedule.png',fullPage:true});
 assert.equal(await page.locator('.navItem').filter({hasText:/botTasks|Tác vụ bot/i}).count(),0);
 await page.locator('.navItem').filter({hasText:'Cài đặt'}).click();await page.locator('.settingsTask').filter({hasText:'Tác vụ bot'}).click();await page.getByRole('heading',{name:'Quản lý tác vụ bot'}).waitFor();assert.equal(await page.locator('#settingsForm').isVisible(),false);await page.locator('.settingsTask').filter({hasText:'Tên, chi nhánh'}).click();
 const editor=page.locator('.localizedEditor').filter({hasText:'Quy định / lưu ý khi đến salon'});await editor.locator('select').selectOption('ja');await editor.locator('textarea').fill('ご来店を心よりお待ちしております。');
 await page.locator('form').first().evaluate(form=>form.requestSubmit());await page.waitForTimeout(300);assert.equal(settings.bookingNoticeJa,'ご来店を心よりお待ちしております。');assert.equal(settings.manualTranslations.bookingNoticeJa,true);
 await page.addInitScript(()=>{Object.defineProperty(navigator,'userAgent',{get:()=> 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120 Mobile/15E148 Safari/604.1'});});
 await page.reload();await page.locator('.navItem').filter({hasText:'Cài đặt'}).click();await page.locator('.settingsTask').filter({hasText:'Máy in hóa đơn'}).click();await page.locator('.printerButton').click();assert.equal(await page.getByRole('button',{name:'Kết nối mPOP bằng USB',exact:true}).isDisabled(),true);const beforeSettingsWrites=settingsWrites;await page.getByRole('button',{name:'In qua Star PassPRNT (Bluetooth / mobile)',exact:true}).click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('nail-japan-printer-settings')).mode),'passprnt');assert.equal(settingsWrites,beforeSettingsWrites,'selecting a printer must not submit the settings form');await page.getByRole('button',{name:'Đóng',exact:true}).click();
 settings.staffClosedPeriods=[`a ${today} 09:00-23:00`];await page.locator('.navItem').first().click();await page.reload();await page.waitForFunction(()=>!document.querySelector('.resourceLane[data-member=a]')&&document.querySelector('.resourceLane[data-member=b]'));assert.equal(await page.locator('.resourceStaff').filter({hasText:'First'}).count(),0);
 await page.setViewportSize({width:390,height:700});await page.locator('.navItem').last().scrollIntoViewIfNeeded();const last=await page.locator('.navItem').last().boundingBox();assert.ok(last.y>=0&&last.y+last.height<=700,'last navigation item must stay reachable on phone');assert.ok((await page.locator('.sidebar').boundingBox()).height<=490,'mobile menu must not cover the whole screen');
 await page.screenshot({path:'artifacts/booking-qa/sidebar-mobile.png',fullPage:true});await page.goto('http://127.0.0.1:3100/bot-tasks');await page.getByRole('heading',{name:'Quản lý tác vụ bot'}).waitFor();assert.ok(page.url().includes('127.0.0.1:3100'));assert.deepEqual(errors,[]);
 console.log('PASS real UI long-press drag preserves duration/time, arbitrary date ranges, hidden off-duty rows, Bot Tasks in Settings, iPad printer options and mobile navigation');
}finally{await browser.close();}
