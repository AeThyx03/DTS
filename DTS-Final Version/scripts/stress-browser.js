'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PASSWORD}=require('./stress-fixtures');
async function run({playwrightPath,fixture,dir,check,log}) {
  const {chromium}=require(playwrightPath);
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  const samples=[],errors=[],BASE='http://127.0.0.1:3500';
  const contexts=[];
  const timing=async(operation,fn)=>{const start=performance.now();await fn();samples.push({operation,ms:performance.now()-start});log('Browser '+operation+': '+Math.round(performance.now()-start)+' ms');};
  try {
    const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Manila',acceptDownloads:true});contexts.push(context);
    await context.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    const page=await context.newPage();page.setDefaultTimeout(60000);
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=500)errors.push(r.status()+' '+r.url());});page.on('dialog',d=>d.accept());
    await page.goto(BASE);await page.fill('#lu',fixture.admin.username);await page.fill('#lp',PASSWORD);
    await timing('Login with '+fixture.documents+' documents',async()=>{await page.click('button[type=submit]');await page.waitForSelector('.shell');await page.waitForSelector('#splash',{state:'detached'});});
    check('Browser received entire document dataset',await page.evaluate(n=>S.docs.length>=n,fixture.documents));
    const navigate=async(route)=>{await page.evaluate(r=>go(r),route);if(['cmed','cmsd'].includes(route))await page.waitForFunction(()=>!!UI.divisionReport?.state);await page.waitForSelector('#view h1');assert.ok(!/could not be displayed|unable to display/i.test(await page.locator('#view').innerText()));};
    for(const route of ['dashboard','cmed','cmsd','analytics','graphs','schedule','users','roles','divisions','refs','settings','workflow','audit']) {
      await timing(route+' navigation',()=>navigate(route));check('Browser route '+route,true);
    }
    await navigate('dashboard');
    for(let repeat=0;repeat<3;repeat++) {
      await timing('Dashboard reload',async()=>{await page.reload();await page.waitForSelector('.shell');await page.waitForSelector('#splash',{state:'detached'});});
      await timing('Search last generated document',async()=>{await page.fill('#regSearch','STRESS-'+String(fixture.documents).padStart(6,'0'));await page.waitForFunction(()=>listDocs(ME()).length===1);});
      check('Search finds final generated record',await page.locator('#regTable').innerText().then(t=>t.includes(String(fixture.documents).padStart(6,'0'))));
      await page.fill('#regSearch','');await page.waitForFunction(()=>listDocs(ME()).length>1000);
      await timing('Subject sorting',async()=>{await page.selectOption('#sortKey','subject');await page.waitForFunction(()=>UI.sort.k==='subject');});
      await timing('Next page',async()=>{await page.locator('[data-act=page][data-d="1"]').click();await page.waitForFunction(()=>UI.page===2);});
      await page.locator('[data-act=page][data-d="-1"]').click();
      await timing('Overdue filter',async()=>{await page.click('[data-act=tile][data-k=overdue]');await page.waitForFunction(()=>UI.filters.tile==='overdue');});
      check('Overdue Stay filter contains overdue or stalled open records',await page.evaluate(()=>listDocs(ME()).length>0&&listDocs(ME()).every(d=>(isClockActive(d)&&dl(d).key==='over')||(isOpen(d)&&stalled(d)))));
      await page.click('[data-act=tile][data-k=total]');
    }
    const downloadPromise=page.waitForEvent('download');await page.click('[data-act=exportList]');const download=await downloadPromise;
    const csv=fs.readFileSync(await download.path(),'utf8');check('Large CSV export includes first and last records',csv.includes('STRESS-000001')&&csv.includes('STRESS-'+String(fixture.documents).padStart(6,'0')));
    await timing('Full registry print preview',async()=>{await page.click('[data-act=printList]');await page.waitForSelector('#ppBody table');});
    const lastTrack=await page.evaluate(ref=>S.docs.find(d=>d.refNo===ref).trackNo,'STRESS-'+String(fixture.documents).padStart(6,'0'));
    check('Large print preview includes final generated record',await page.locator('#ppBody').textContent().then(t=>t.includes(lastTrack)));await page.click('[data-act=ppClose]');
    await page.locator('#regTable [data-act=openDoc]').first().click();await page.waitForSelector('.pagehead h1');check('Large-dataset document details open',await page.locator('#view').innerText().then(t=>/Movement history|History/i.test(t)));
    await navigate('analytics');
    const analytics=await page.evaluate(()=>analyticsData(ME()));check('Analytics computes with populated dataset',Array.isArray(analytics.kpi)&&analytics.kpi.length>0);
    await navigate('graphs');await page.screenshot({path:path.join(dir,'stress-graphs.png'),fullPage:true});
    await navigate('schedule');check('Crowded calendar renders',await page.locator('#calBody').count()===1);
    for(const viewport of [{width:1440,height:1000},{width:820,height:1180},{width:390,height:844}]) {
      await page.setViewportSize(viewport);await navigate('cmed');
      check('No page overflow at '+viewport.width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    }
    await page.screenshot({path:path.join(dir,'stress-mobile.png'),fullPage:true});
    await page.setViewportSize({width:1440,height:1000});await navigate('dashboard');
    const renderSamples=await page.evaluate(count=>{const rows=[];for(let i=0;i<5;i++){UI.filters={tile:'total'};UI.page=1;let start=performance.now();render();rows.push({operation:'Dashboard JS render',ms:performance.now()-start});UI.filters.q='STRESS-'+String(count).padStart(6,'0');start=performance.now();refreshReg();rows.push({operation:'Search JS filter/render',ms:performance.now()-start});}UI.filters={tile:'total'};render();return rows;},fixture.documents);samples.push(...renderSamples);
    const heap=await page.evaluate(()=>performance.memory?{usedMiB:performance.memory.usedJSHeapSize/1048576,totalMiB:performance.memory.totalJSHeapSize/1048576}:null);
    await page.screenshot({path:path.join(dir,'stress-dashboard.png'),fullPage:true});
    // Simultaneous real browser sessions, one per represented non-admin role (up to six).
    const users=fixture.enrollment.filter(u=>u.active&&u.role!=='sysadmin').filter((u,i,all)=>all.findIndex(x=>x.role===u.role)===i).slice(0,6);
    await Promise.all(users.map(async user=>{
      const c=await browser.newContext({viewport:{width:1280,height:800}});contexts.push(c);await c.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
      const p=await c.newPage();p.setDefaultTimeout(90000);p.on('pageerror',e=>errors.push(user.username+': '+e.message));
      await p.goto(BASE);await p.fill('#lu',user.username);await p.fill('#lp',PASSWORD);await p.click('button[type=submit]');await p.waitForSelector('.shell');
      await p.evaluate(()=>go('action'));await p.waitForSelector('.pagehead h1');check('Concurrent browser login/action page '+user.username,true);
      await c.close();
    }));
    check('No browser JavaScript errors or HTTP 500 responses',errors.length===0,errors.join('; '));
    return{samples,heap,simultaneousRoleSessions:users.length,errors};
  } finally {await browser.close();}
}
module.exports={run};
