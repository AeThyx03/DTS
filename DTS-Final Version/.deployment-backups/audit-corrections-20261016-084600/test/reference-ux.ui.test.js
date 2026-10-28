'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const path=require('node:path');
const base='http://127.0.0.1:'+(process.env.PORT||3111);
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.WF_BROWSER_CHANNEL||'msedge'});
 let passed=0;const check=(name,value)=>{assert.ok(value,name);passed++;console.log('PASS '+name);};
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Manila',colorScheme:'dark'});
  await context.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(base);await page.fill('#lu','admin');await page.fill('#lp','Admin@2026');await page.click('button[type=submit]');await page.waitForSelector('.shell');await page.waitForSelector('#splash',{state:'detached'});await page.click('.nav [data-r=refs]');
  const state=async()=>(await(await context.request.get(base+'/api/state')).json()).state;
  const tab=async key=>{await page.click('[data-act=refTab][data-k="'+key+'"]');};
  const specs=[
   {tab:'transactions',button:'.ch [data-act=refAddForm]',form:'refnew',save:'refAddSave',name:'QA transaction top dialog',extra:async()=>page.fill('[data-form=refnew] [name=days]','4'),present:s=>s.refs.tx.some(x=>x.name==='QA transaction top dialog'&&x.days===4)},
   {tab:'documents',button:'.ch [data-act=docTypeForm]',form:'doctype',save:'saveDocType',name:'QA document top dialog',extra:async()=>page.fill('[data-form=doctype] [name=threshold]','5'),present:s=>s.refs.doc.some(x=>x.name==='QA document top dialog'&&x.threshold===5)},
   {tab:'communications',button:'.ch [data-act=commTypeForm]',form:'commtype',save:'saveCommType',name:'QA communication top dialog',present:s=>s.refs.comm.some(x=>x.name==='QA communication top dialog')},
   {tab:'leave',button:'.ch [data-act=ltForm]',form:'leavetype',save:'ltSave',name:'QA leave top dialog',present:s=>s.leaveTypes.some(x=>x.name==='QA leave top dialog')},
   {tab:'holidays',button:'.ch [data-act=refAddForm]',form:'refnew',save:'refAddSave',name:'QA holiday top dialog',extra:async()=>page.fill('[data-form=refnew] [name=date]','2030-12-26'),present:s=>s.holidays.some(x=>x.name==='QA holiday top dialog'&&x.date==='2030-12-26')},
   {tab:'designations',button:'.ch [data-act=refAddForm]',form:'refnew',save:'refAddSave',name:'QA region top dialog',extra:async()=>page.selectOption('[data-form=refnew] [name=staff]','cruz'),present:s=>s.designations.some(x=>x.name==='QA region top dialog'&&x.staff==='cruz')}
  ];
  for(const spec of specs){
   await tab(spec.tab);const add=page.locator(spec.button);const a=await add.boundingBox(),table=await page.locator('#view table').first().boundingBox();
   check(spec.tab+' Add action is above its table',a.y+a.height<=table.y);
   check(spec.tab+' has no duplicate bottom creation form',await page.locator('#view input[name=v],#view [data-act=addDocType],#view [data-act=addComm],#view [data-act=ltAdd],#view [data-act=addHol],#view [data-act=addDes],#view [data-act=addTx]').count()===0);
   await add.click();await page.waitForSelector('[data-form='+spec.form+']');
   check(spec.tab+' Add opens its dialog',await page.locator('.modal').isVisible());
   if(spec.tab==='transactions'){await page.click('[data-act='+spec.save+']');check('empty transaction is rejected in the dialog',await page.locator('.ux-error').isVisible());}
   await page.fill('[data-form='+spec.form+'] [name=name]',spec.name);if(spec.extra)await spec.extra();
   if(spec.tab==='holidays'){
    await page.route('**/api/config/holidays',r=>r.fulfill({status:400,contentType:'application/json',body:JSON.stringify({ok:false,error:'QA holiday rejected'})}));
    await page.click('[data-act='+spec.save+']');await page.locator('.ux-error').waitFor();
    check('rejected holiday save retains entered values',await page.inputValue('[data-form=refnew] [name=name]')===spec.name&&await page.inputValue('[data-form=refnew] [name=date]')==='2030-12-26');
    check('rejected holiday does not alter confirmed state',!spec.present(await state())&&await page.evaluate(()=>!S.holidays.some(h=>h.name==='QA holiday top dialog')));
    await page.unroute('**/api/config/holidays');
   }
   await page.click('[data-act='+spec.save+']');await page.waitForSelector('.modal',{state:'detached'});
   check(spec.tab+' dialog saves its record',spec.present(await state()));
  }
  for(const kind of ['holidays','designations']){
   await tab(kind);const list=page.locator('[data-ref-list='+kind+']');
   check(kind+' table expands without an inner vertical scrollbar',await list.evaluate(e=>getComputedStyle(e).maxHeight==='none'&&e.scrollHeight<=e.clientHeight+1));
   const count=await page.evaluate(k=>S[k].length,kind);check(kind+' displays every existing row',await list.locator('tbody tr').count()===count);
   await page.screenshot({path:path.join(process.env.SHOTS,kind+'-expanded.png')});
  }
  await tab('special');
  const id=await page.locator('tr[data-act=spCfgForm]').first().getAttribute('data-id');
  const row=page.locator('tr[data-act=spCfgForm][data-id="'+id+'"]');
  for(let column=0;column<8;column++){
   await row.locator('td').nth(column).click({position:{x:3,y:3}});await page.waitForSelector('[data-form=srcfg]');
   check('Special Report column '+(column+1)+' opens the correct edit dialog',await page.locator('[data-form=srcfg]').getAttribute('data-id')===id);
   await page.click('.modal>header [data-act=closeModal]');
  }
  await page.evaluate(()=>{window.refEditCalls=0;const original=ACTIONS.spCfgForm;ACTIONS.spCfgForm=(...args)=>{window.refEditCalls++;return original(...args);};});
  await row.locator('button[data-act=spCfgForm]').click();await page.waitForSelector('[data-form=srcfg]');
  check('Edit button remains independent and opens only once',await page.evaluate(()=>window.refEditCalls===1));await page.click('.modal>header [data-act=closeModal]');
  for(const key of ['Enter','Space']){await row.focus();await page.keyboard.press(key);await page.waitForSelector('[data-form=srcfg]');check('Special Report row supports '+key,await page.locator('[data-form=srcfg]').getAttribute('data-id')===id);await page.click('.modal>header [data-act=closeModal]');}
  const config=(await state()).spConfigs.find(c=>c.id===id);
  const configured=await context.request.put(base+'/api/special-reports/configs/'+id,{headers:{'X-Requested-With':'dts'},data:{name:config.name,frequency:config.frequency,months:config.months,generationDay:config.generationDay||1,threshold:config.threshold,basis:config.basis,assignUsers:['cruz'],assignDivisions:[],fromPeriod:config.fromPeriod,active:false}});
  assert.equal(configured.status(),200);await page.evaluate(()=>refresh());
  const initial=(await state()).spConfigs.find(c=>c.id===id).active;
  await row.locator('[data-act=spCfgToggle]').click();await page.waitForFunction(({id,initial})=>S.spConfigs.find(c=>c.id===id).active!==initial,{id,initial});
  check('Activate/Deactivate changes status without opening edit',await page.locator('.modal').count()===0&&(await state()).spConfigs.find(c=>c.id===id).active!==initial);
  await row.locator('[data-act=spCfgToggle]').click();await page.waitForFunction(({id,initial})=>S.spConfigs.find(c=>c.id===id).active===initial,{id,initial});
  check('status button still restores the original status',(await state()).spConfigs.find(c=>c.id===id).active===initial);
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('.side').getBoundingClientRect().right<=1);
  for(const spec of specs){await tab(spec.tab);check(spec.tab+' remains within mobile width',await page.evaluate(()=>{const v=document.querySelector('#view');return v.scrollWidth<=v.clientWidth+1;}));await page.locator(spec.button).click();check(spec.tab+' creation dialog fits mobile',await page.locator('.modal').evaluate(e=>e.getBoundingClientRect().right<=innerWidth+1));await page.click('.modal>header [data-act=closeModal]');}
  check('no uncaught JavaScript errors',errors.length===0);console.log(passed+' passed, 0 failed');await context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
