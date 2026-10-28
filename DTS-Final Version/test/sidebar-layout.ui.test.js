'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
const base='http://127.0.0.1:'+(process.env.PORT||3111);
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.WF_BROWSER_CHANNEL||'msedge'});
 let passed=0;const errors=[],check=(name,value)=>{assert.ok(value,name);passed++;console.log('PASS '+name);};
 try{
  const context=await browser.newContext({viewport:{width:2560,height:1250},timezoneId:'Asia/Manila'});
  await context.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.fill('#lu','admin');await page.fill('#lp','Admin@2026');await page.click('button[type=submit]');await page.waitForSelector('.shell');await page.waitForSelector('#splash',{state:'detached'});
  const routes=await page.evaluate(()=>{const nav=navItems(ME());return [...new Set(nav.w.concat(nav.a).map(n=>n[0]).concat(['analytics','graphs']))];});
  for(const route of routes){
   await page.evaluate(r=>go(r),route);
   if(route==='workflow')await page.waitForSelector('#wfSwitch');
   if(route==='audit')await page.waitForSelector('#auditBox table');
   const bounds=await page.evaluate(()=>{const v=document.querySelector('#view'),w=v.querySelector(':scope > .wrap'),a=v.getBoundingClientRect(),b=w.getBoundingClientRect();return{ratio:b.width/v.clientWidth,left:b.left-a.left,right:a.right-b.right,overflow:v.scrollWidth-v.clientWidth};});
   check(route+' uses available desktop width',bounds.ratio>.95&&bounds.left<=25&&bounds.right<=25);
   check(route+' desktop overflow stays within its content',bounds.overflow<=1);
   if(['regular','schedule','reports','settings','refs'].includes(route))await page.screenshot({path:path.join(process.env.SHOTS,route+'-wide.png')});
  }
  await page.evaluate(()=>go('schedule'));
  check('schedule summary spans the calendar width',await page.evaluate(()=>{const a=document.querySelector('.cal-tiles').getBoundingClientRect(),b=document.querySelector('.cal-tile:last-child').getBoundingClientRect();return Math.abs(a.right-b.right)<2;}));
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('.side').getBoundingClientRect().right<=1);
  for(const route of routes){
   await page.evaluate(r=>go(r),route);
   if(route==='workflow')await page.waitForSelector('#wfSwitch');
   if(route==='audit')await page.waitForSelector('#auditBox table');
   const fits=await page.evaluate(()=>{const v=document.querySelector('#view');return v.scrollWidth<=v.clientWidth+1;});
   if(!fits){console.log(await page.evaluate(()=>[...document.querySelectorAll('#view *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,15).map(e=>({tag:e.tagName,class:e.className,width:e.getBoundingClientRect().width}))));await page.screenshot({path:path.join(process.env.SHOTS,route+'-overflow.png')});}
   check(route+' fits mobile page width',fits);
   if(['regular','schedule','reports'].includes(route))await page.screenshot({path:path.join(process.env.SHOTS,route+'-mobile.png')});
  }
  check('no browser JavaScript errors',errors.length===0);
  console.log(passed+' passed, 0 failed');await context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
