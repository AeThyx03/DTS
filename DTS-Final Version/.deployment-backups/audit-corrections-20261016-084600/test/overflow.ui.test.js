'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const base='http://127.0.0.1:3131',out=path.resolve(__dirname,'..','.test-runs','stress-1000-20261007','layout-checks');fs.mkdirSync(out,{recursive:true});
let checks=0;const results=[];
const check=(label,condition)=>{assert.ok(condition,label);checks++;console.log('PASS '+label);};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const errors=[],context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Manila'}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.fill('#lu','admin');await page.fill('#lp','Admin@2026');await page.click('button[type=submit]');await page.waitForSelector('#regTable');await page.waitForSelector('#splash',{state:'detached'});
  for(const size of [25,50,100]){
   await page.selectOption('#documentPageSize',String(size));
   check(size+' visible documents',await page.locator('#regTable tbody tr').count()===size);
   await page.locator('[data-act=page][data-d="1"]').click();
   check(size+' pagination updates range',await page.locator('#regMeta').innerText().then(t=>t.includes((size+1)+'–'+(size*2))));
   await page.selectOption('#documentPageSize',size===100?'25':'100');check('page-size change resets page and selection',await page.evaluate(()=>UI.page===1&&UI.sel.size===0));
  }
  await page.selectOption('#documentPageSize','100');await page.locator('[data-chg=selAll]').check();
  check('select all selects 100 visible documents',await page.evaluate(()=>UI.sel.size===100));
  await page.selectOption('#documentPageSize','50');check('page-size change clears prior selection',await page.evaluate(()=>UI.sel.size===0));
  await page.fill('#regSearch','STRESS-1000');check('page-size and search compose',await page.locator('#regTable tbody tr').count()===1);await page.fill('#regSearch','');
  await page.click('.nav a[data-r=graphs]');
  await page.selectOption('[data-chg=gfMode]','range');await page.fill('[data-chg=gfFrom]','2025-01');await page.locator('[data-chg=gfFrom]').dispatchEvent('change');await page.fill('[data-chg=gfTo]','2026-12');await page.locator('[data-chg=gfTo]').dispatchEvent('change');
  const contained=async(selector,container)=>page.locator(selector).evaluateAll((els,parent)=>els.every(el=>{const a=el.getBoundingClientRect(),b=el.closest(parent).getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1;}),container);
  for(const width of [1440,1024,390]){
   await page.setViewportSize({width,height:1000});
   check(width+'px graphs include all 24 months',await page.locator('.charts .vb .col').count()===48);
   check(width+'px monthly bars stay inside chart cards',await contained('.charts .vb .col','.card'));
   check(width+'px graphs do not scroll page sideways',await page.evaluate(()=>document.querySelector('#view').scrollWidth<=document.querySelector('#view').clientWidth+1));
   await page.screenshot({path:path.join(out,'graphs-'+width+'.png'),fullPage:true});
  }
  await page.evaluate(()=>document.documentElement.setAttribute('data-theme','dark'));
  check('dark-theme monthly bars stay inside cards',await contained('.charts .vb .col','.card'));
  await page.screenshot({path:path.join(out,'graphs-dark-390.png'),fullPage:true});
  await page.evaluate(()=>document.documentElement.removeAttribute('data-theme'));
  await page.setViewportSize({width:1440,height:1000});await page.click('[data-act=printGraphs]');
  check('print preview keeps all 24 months in both charts',await page.locator('#ppBody .vb .col').count()===48);
  check('print preview bars stay inside paper',await contained('#ppBody .vb .col','.sheet'));
  await page.screenshot({path:path.join(out,'graphs-print-preview.png'),fullPage:true});
  await page.emulateMedia({media:'print'});await page.setViewportSize({width:718,height:1100});
  check('A4 print bars fit the printable width',await contained('#ppBody .vb .col','.sheet'));
  await page.pdf({path:path.join(out,'graphs-2025-2026.pdf'),format:'A4',printBackground:true});
  await page.emulateMedia({media:'screen'});await page.evaluate(()=>closePP());
  await page.setViewportSize({width:1440,height:1000});await page.click('.nav a[data-r=schedule]');
  await page.evaluate(()=>{CAL.date='2026-10-07';CAL.view='month';CAL.person='';CAL.type='';calRepaint();});
  const state=await page.evaluate(()=>({people:S.users.filter(u=>u.active).length,schedules:S.schedules.length,events:calOnDate(calFiltered(),'2026-10-07').length}));results.push(state);
  check('crowded date has at least 50 events',state.events>=50);
  check('month offers access to hidden entries',await page.locator('.cal-cell[data-d="2026-10-07"] .cal-more').count()===1);
  await page.locator('.cal-cell[data-d="2026-10-07"] .cal-more').click();
  check('more opens all events in day view',await page.locator('.cal-day .cal-card').count()===state.events);
  for(const width of [1440,1024,390]){
   await page.setViewportSize({width,height:1000});
   for(const view of ['month','week','day','agenda']){
    await page.locator('[data-act=calView][data-v='+view+']').click();
    const overflow=await page.evaluate(()=>({page:document.querySelector('#view').scrollWidth-document.querySelector('#view').clientWidth,cards:[...document.querySelectorAll('.cal-card,.ag-row')].filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.innerText.slice(0,100))}));
    check(width+'px '+view+' has no horizontal page overflow',overflow.page<=1);
    check(width+'px '+view+' cards contain long text',overflow.cards.length===0);
    await page.screenshot({path:path.join(out,'schedule-'+view+'-'+width+'.png'),fullPage:width===390?false:true});
   }
  }
  await page.setViewportSize({width:1440,height:1000});await page.selectOption('[data-chg=calPerson]','cruz');await page.selectOption('[data-chg=calType]','leave');
  check('personnel/type filters keep all four leave types',await page.evaluate(()=>new Set(calFiltered().filter(s=>s.type==='leave').map(s=>s.leaveTypeId)).size===4));
  await page.selectOption('[data-chg=calPerson]','');await page.selectOption('[data-chg=calType]','');
  await page.click('[data-act=calView][data-v=month]');await page.click('[data-act=calPrint]');
  check('schedule print includes every matching record',await page.locator('#ppBody tbody tr').count()===await page.evaluate(()=>calFiltered().filter(s=>s.endDate>='2026-10-01'&&s.startDate<='2026-10-31').length));
  await page.emulateMedia({media:'print'});await page.setViewportSize({width:718,height:1100});
  check('schedule print table fits paper',await contained('#ppBody table','.sheet'));
  check('print rows stay together across page breaks',await page.locator('#ppBody tbody tr').first().evaluate(el=>getComputedStyle(el).breakInside==='avoid'));
  await page.pdf({path:path.join(out,'schedule-october-2026.pdf'),format:'A4',printBackground:true});
  await page.emulateMedia({media:'screen'});await page.evaluate(()=>closePP());await page.setViewportSize({width:1440,height:1000});
  await page.locator('.avatar').click();await page.click('[data-act=signout]');await page.waitForSelector('#lu');
  await page.fill('#lu','dcruz');await page.fill('#lp','Track@2026');await page.click('button[type=submit]');await page.waitForSelector('.shell');await page.click('.nav a[data-r=action]');
  await page.selectOption('#documentPageSize','100');
  const actionCount=await page.evaluate(()=>actionDocs(ME()).length);
  check('staff action list supports 100 documents per page',await page.locator('.tbl.reg tbody tr').count()===Math.min(100,actionCount));
  await page.locator('[data-act=page][data-d="1"]').click();
  check('staff action list paginates with chosen page size',await page.locator('.tbl.reg tbody tr').count()===Math.min(100,actionCount-100));
  check('no browser JavaScript errors',errors.length===0);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,results,errors},null,2));
  console.log(checks+' passed, 0 failed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
