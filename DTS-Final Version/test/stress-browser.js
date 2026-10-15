'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'..','.test-runs','stress-1000-20261007');
const base='http://127.0.0.1:3131';
const samples=[],errors=[];
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Manila'});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=500)errors.push(r.status()+' '+r.url());});
  await page.goto(base);await page.fill('#lu','admin');await page.fill('#lp','Admin@2026');
  let start=performance.now();await page.click('button[type=submit]');await page.waitForSelector('#regTable tbody tr');await page.waitForSelector('#splash',{state:'detached'});
  samples.push({operation:'Login to usable dashboard',ms:performance.now()-start});
  assert.equal(await page.evaluate(()=>S.docs.length),1000);
  const time=async(operation,fn)=>{const begin=performance.now();await fn();samples.push({operation,ms:performance.now()-begin});};
  for(let i=0;i<5;i++) {
   await time('Dashboard reload',async()=>{await page.reload();await page.waitForSelector('#regTable tbody tr');await page.waitForSelector('#splash',{state:'detached'});});
   await time('Search 1,000 records',async()=>{await page.fill('#regSearch','STRESS-1000');await page.waitForFunction(()=>document.querySelectorAll('#regTable tbody tr').length===1 && document.querySelector('#regTable').innerText.includes('1000'));});
   await page.fill('#regSearch','');
   await time('Sort by subject',async()=>{await page.selectOption('#sortKey','subject');await page.waitForFunction(()=>UI.sort.k==='subject');});
   await time('Next page',async()=>{await page.locator('[data-act=page][data-d="1"]').click();await page.waitForFunction(()=>UI.page===2);});
   await page.locator('[data-act=page][data-d="-1"]').click();
   await time('Overdue filter',async()=>{await page.click('[data-act=tile][data-k=overdue]');await page.waitForFunction(()=>UI.filters.tile==='overdue');});
   await page.click('[data-act=tile][data-k=total]');
   await time('Document details with history',async()=>{await page.locator('#regTable [data-act=openDoc]').first().click();await page.waitForSelector('.pagehead h1');assert.ok((await page.locator('.pagehead h1').innerText()).includes('STRESS'));});
   await page.click('.nav a[data-r=dashboard]');
  }
  await page.screenshot({path:path.join(out,'dashboard-1000.png'),fullPage:true});
  for(const route of ['analytics','graphs','reports','audit']) {
   await time(route+' navigation',async()=>{await page.click('.nav a[data-r='+route+']');await page.waitForSelector('.pagehead h1');assert.ok(!/could not be displayed/i.test(await page.locator('#view').innerText()));});
   if(route==='graphs')await page.screenshot({path:path.join(out,'graphs-1000.png'),fullPage:true});
  }
  // Measure the app's pure filter/render work separately from Playwright's input delays.
  const renderTimes=await page.evaluate(()=>{
   go('dashboard');const runs=[];
   for(let i=0;i<10;i++){UI.filters={tile:'total',q:''};UI.page=1;let t=performance.now();render();runs.push({operation:'Dashboard JS render',ms:performance.now()-t});UI.filters.q='STRESS-1000';t=performance.now();refreshReg();runs.push({operation:'Search JS filter and render',ms:performance.now()-t});}
   UI.filters={tile:'total'};render();return runs;
  });
  samples.push(...renderTimes);
  const memory=await page.evaluate(()=>performance.memory?{usedJSHeapMiB:performance.memory.usedJSHeapSize/1048576,totalJSHeapMiB:performance.memory.totalJSHeapSize/1048576}:null);
  await page.locator('.avatar').click();await page.click('[data-act=signout]');await page.waitForSelector('#lu');
  await page.fill('#lu','dcruz');await page.fill('#lp','Track@2026');await page.click('button[type=submit]');await page.waitForSelector('.shell');
  await time('Staff For My Action',async()=>{await page.click('.nav a[data-r=action]');await page.waitForSelector('.pagehead h1');});
  assert.equal(await page.evaluate(()=>S.docs.length),1000);
  const staffActionCount=await page.evaluate(()=>actionDocs(ME()).length);
  await page.screenshot({path:path.join(out,'staff-actions-1000.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  const grouped=Object.groupBy(samples,s=>s.operation);
  const summaries=Object.entries(grouped).map(([operation,rows])=>({operation,samples:rows.length,medianMs:rows.map(r=>r.ms).sort((a,b)=>a-b)[Math.floor(rows.length/2)],maxMs:Math.max(...rows.map(r=>r.ms))}));
  const result={samples,summaries,memory,staffActionCount,errors};fs.writeFileSync(path.join(out,'browser-performance.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({summaries,memory,staffActionCount,errors},null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
