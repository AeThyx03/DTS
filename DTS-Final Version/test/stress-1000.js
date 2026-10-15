'use strict';
// Dedicated local stress demo only. Replaces that demo's document set with exactly 1,000 synthetic records.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
process.env.TZ = 'Asia/Manila';
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.test-runs', 'stress-1000-20261007');
const base = 'http://127.0.0.1:3131';
fs.mkdirSync(out, { recursive: true });
const percentile = (values, fraction) => [...values].sort((a,b)=>a-b)[Math.ceil(values.length*fraction)-1];
async function login() {
  const r = await fetch(base+'/api/login', {method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'dts'},body:JSON.stringify({username:'admin',password:'Admin@2026'})});
  assert.equal(r.status,200); return r.headers.get('set-cookie').split(';')[0];
}
async function measure(cookie, label, concurrency, requests = 60, endpoint = '/api/state', body) {
  let next=0, bytes=0; const times=[], ttfb=[], errors=[]; const start=performance.now();
  await Promise.all(Array.from({length:concurrency},async()=>{
    while(next++ < requests) {
      const at=performance.now();
      try {
        const r=await fetch(base+endpoint,{method:body?'POST':'GET',headers:{cookie,'X-Requested-With':'dts','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
        ttfb.push(performance.now()-at); const text=await r.text(); bytes+=Buffer.byteLength(text); JSON.parse(text);
        if(!r.ok)errors.push(r.status); times.push(performance.now()-at);
      }catch(e){errors.push(e.message);}
    }
  }));
  const seconds=(performance.now()-start)/1000;
  return {label,endpoint,concurrency,requests,errors,averageMs:times.reduce((a,b)=>a+b,0)/times.length,medianMs:percentile(times,.5),p95Ms:percentile(times,.95),maxMs:Math.max(...times),ttfbP95Ms:percentile(ttfb,.95),requestsPerSecond:requests/seconds,payloadKiB:bytes/requests/1024};
}
(async()=>{
  const cookie=await login();
  const headers={cookie,'X-Requested-With':'dts','Content-Type':'application/json'};
  const backup=await(await fetch(base+'/api/admin/backup',{headers})).json();
  assert.equal(backup.format,'dts-backup');
  assert.ok(backup.docs.length===20 || backup.docs.every(d=>d.refNo.startsWith('STRESS-')), 'Refusing to replace a non-stress dataset');
  fs.writeFileSync(path.join(out,'before-seed.json'),JSON.stringify(backup));
  const baseline=await measure(cookie,'Before seeding ('+backup.docs.length+' documents)',1,30);
  const ctx=vm.createContext({console}); vm.runInContext(fs.readFileSync(path.join(root,'public','engine.js'),'utf8'),ctx);
  backup.docs=[]; backup.seq={}; backup.audit=[]; ctx.S=backup; ctx.ENGINE.rebuildHS();
  const E=ctx.ENGINE, today=new Date();today.setHours(8,0,0,0);
  const at=(start,days,hour=9)=>{const date=new Date(start);date.setDate(date.getDate()+days);date.setHours(hour,0,0,0);return date;};
  const stages=['processing','compliance','sup_review','div_review','dept_review'];
  for(let i=0;i<1000;i++) {
    const category=i<400?'ONGOING':i<700?'COMPLETED':'OVERDUE', late=category==='COMPLETED'&&i>=625;
    const div=i%2?'CMED':'CMSD', focal=div==='CMED'?'cabrera':'aquino', staff=div==='CMED'?'cruz':'salvador', manager=div==='CMED'?'martinez':'villarete';
    const start=at(today,category==='ONGOING'?0:-(30+i%120),8);
    const result=E.logDoc({commType:['Letter','Memorandum'][i%2],source:'Stress Mock Regional Office '+(i%16+1),refNo:'STRESS-'+String(i+1).padStart(4,'0'),subject:'STRESS '+category+' '+(late?'LATE ':'')+'— '+String(i+1).padStart(4,'0')+' — Inspection correspondence',docType:'External Communication',division:div,priority:i%5===0?'Urgent':'Normal',pages:String(2+i%18),remarks:'Synthetic performance dataset'},'paling',start,true);
    assert.ok(result.ok,result.error);const doc=result.doc;
    const action=(who,type,payload,days=0,hour=9)=>{const r=E.act(doc.id,who,type,payload||{},at(start,days,hour));assert.ok(r.ok,type+': '+r.error);};
    action(focal,'assign',{txType:'Simple Transaction',docType:'External Communication',assignee:staff});
    const stage=category==='COMPLETED'?'out':stages[i%stages.length];
    const reviewDay=late?13:0;
    if(stage!=='processing')action(staff,'submit',{reviewer:focal,text:'Mock report ready for review'},reviewDay,10);
    if(stage==='compliance')action(focal,'sup_return',{text:'Attach the supporting mock checklist'},0,11);
    if(['div_review','dept_review','out'].includes(stage))action(focal,'sup_approve',{},reviewDay,11);
    if(['dept_review','out'].includes(stage))action(manager,'div_approve',{},reviewDay,12);
    if(stage==='out'){action('hanova','dept_clear',{},late?14:0,13);action('paling','logout',{outTo:'Stress Mock Records Office',remarks:'Synthetic completion'},late?15:1,10);}
    assert.equal(doc.status,stage);
    assert.ok(doc.history.every((h,j)=>j===0||h.at>=doc.history[j-1].at));
    if(category==='OVERDUE')assert.equal(E.dl(doc).key,'over');
    if(category==='ONGOING')assert.ok(!['over','done_late'].includes(E.dl(doc).key));
    if(category==='COMPLETED')assert.equal(E.dl(doc).key,late?'done_late':'done_ok');
  }
  // Preserve synthetic movement audit for meaningful audit-page load.
  backup.audit=backup.docs.flatMap(d=>d.history.map(h=>({at:h.at,by:h.by,action:h.action,detail:d.trackNo+' — '+d.subject}))).sort((a,b)=>a.at.localeCompare(b.at));
  fs.writeFileSync(path.join(out,'stress-backup.json'),JSON.stringify(backup));
  const begin=performance.now();
  const restored=await fetch(base+'/api/admin/restore',{method:'POST',headers,body:JSON.stringify(backup)});assert.equal(restored.status,200,await restored.text());
  const seedMs=performance.now()-begin;
  const state=await(await fetch(base+'/api/state',{headers})).json();assert.equal(state.state.docs.length,1000);
  const mix={ongoingOnTime:400,ongoingOverdue:300,completedOnTime:225,completedLate:75,total:1000,movementEvents:backup.audit.length};
  const measurements=[baseline];
  await measure(cookie,'warmup',1,5);
  for(const concurrency of [1,5,20])measurements.push(await measure(cookie,'1,000 documents',concurrency));
  measurements.push(await measure(cookie,'Polling version endpoint',20,100,'/api/version'));
  const writeDoc=backup.docs.find(d=>d.status==='processing');
  measurements.push(await measure(cookie,'Audit/history writes',5,30,'/api/docs/'+writeDoc.id+'/act',{type:'comment',payload:{text:'Synthetic performance test comment'}}));
  assert.ok(measurements.every(m=>m.errors.length===0),'Request errors occurred');
  const result={base,date:new Date().toISOString(),node:process.version,mix,seedMs,measurements};
  fs.writeFileSync(path.join(out,'api-performance.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
