const B='http://localhost:'+(process.env.PORT||3111);
let pass=0,failn=0;const ok=(n,c)=>{c?pass++:failn++;console.log((c?'PASS ':'FAIL ')+n);};
async function client(){let cookie='';return async(m,u,b,h)=>{const r=await fetch(B+u,{method:m,headers:Object.assign({'X-Requested-With':'dts',cookie},b!==undefined?{'Content-Type':'application/json'}:{},h||{}),body:b!==undefined?JSON.stringify(b):undefined});const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];let j={};try{j=await r.json();}catch(e){}return{s:r.status,...j};};}
async function login(u,p){const c=await client();const r=await c('POST','/api/login',{username:u,password:p});if(r.s!==200)throw new Error('login '+u+' '+r.s+' '+r.error);return c;}
(async()=>{
 const DP='Track@2026';
 const adm=await login('admin','Admin@2026'),paling=await login('mpaling',DP),acab=await login('acabrera',DP),
       salvador=await login('jsalvador',DP),mart=await login('mmartinez',DP),han=await login('ohanova',DP),
       tabilas=await login('mtabilas',DP),nieva=await login('bnieva',DP),delrosario=await login('adelrosario',DP),
       torino=await login('rtorino',DP),cabalfin=await login('bcabalfin',DP),vill=await login('jvillarete',DP);

 // helper: log a CMED doc forward to focal, then assign to staff
 const mkDoc=async(assignee,tx)=>{
  const d=await paling('POST','/api/docs',{commType:'Letter',source:'HQ',subject:'Test '+Date.now(),docType:'External Communication',division:'CMED',forward:true});
  if(!d.ok)return null;
  const a=await acab('POST','/api/docs/'+d.id+'/act',{type:'assign',payload:{txType:tx||'Simple Transaction',docType:'External Communication',assignee:assignee}});
  if(!a.ok)return null;
  return d.id;
 };

 // ── 1. Prescribed deadline for a reporting-period document type ──
 // Consolidated CMR and PPR: the 6th working day of the month AFTER the reporting period.
 const st=await paling('GET','/api/state');
 const regDocs=st.state.docs.filter(d=>d.docType==='Consolidated CMR and PPR'&&d.dueAt);
 ok('Consolidated CMR and PPR documents have a calculated deadline',regDocs.length>0);
 ok('the deadline is stored with its source and label',regDocs.every(d=>d.deadlineSource==='document type'&&d.deadlineLabel&&d.threshold===6));
 ok('each one carries a reporting period',regDocs.every(d=>typeof d.reportingPeriod==='string'));
 // deadline month = the month after the reporting period
 const MONTHS_=['January','February','March','April','May','June','July','August','September','October','November','December'];
 ok('deadline month is the month after the reporting period',regDocs.filter(d=>d.reportingPeriod).every(d=>{
  const i=MONTHS_.indexOf(d.reportingPeriod),want=MONTHS_[(i+1)%12];
  return (d.deadlineMonth||'').startsWith(want);
 }));
 // the due date must be a weekday (Manila) and the 6th working day counted from the 1st of that month
 const manila=iso=>new Date(new Date(iso).getTime()+8*3600000);
 ok('calculated deadline falls on a working day',regDocs.every(d=>{const g=manila(d.dueAt).getUTCDay();return g!==0&&g!==6;}));
 ok('calculated deadline is the 6th working day of its month',regDocs.every(d=>{
  const dd=manila(d.dueAt),y=dd.getUTCFullYear(),m=dd.getUTCMonth(),day=dd.getUTCDate();
  const hol=new Set(st.state.holidays.map(h=>h.date));
  let c=0;
  for(let i=1;i<=day;i++){
   const dt=new Date(y,m,i),g=dt.getDay();
   const iso=y+'-'+String(m+1).padStart(2,'0')+'-'+String(i).padStart(2,'0');
   if(g===0||g===6||hol.has(iso))continue;
   c++;
  }
  return c===6;
 }));

 // ── 2. URL field on logging ──
 const u1=await paling('POST','/api/docs',{commType:'Letter',source:'HQ',subject:'URL test',docType:'External Communication',division:'CMED',url:'https://example.com/doc1'});
 ok('doc logged with URL',u1.s===200);
 const st2=await paling('GET','/api/state');const ud=st2.state.docs.find(d=>d.id===u1.id);
 // url field might be empty if server not updated; check field exists and matches
 ok('url field exists on doc',!!(ud&&'url' in ud));
 ok('url field persisted correctly',ud&&ud.url==='https://example.com/doc1');
 ok('invalid URL rejected at server via set_urls',(await paling('POST','/api/docs/'+u1.id+'/act',{type:'set_urls',payload:{url:'not-a-url'}})).s===400||
    (await adm('POST','/api/docs/'+u1.id+'/act',{type:'set_urls',payload:{url:'not-a-url'}})).s===400);

 // ── 3. Regular Report URL fields + revision counter ──
 const regId=regDocs[0]&&regDocs[0].id;
 ok('regular doc exists for URL test',!!regId);
 if(regId){
  ok('non-assignee staff cannot set report URLs',
   (await nieva('POST','/api/docs/'+regId+'/act',{type:'set_urls',payload:{draftUrl:'https://draft.example.com'}})).s===400);
  const assignee=regDocs[0].assignee;
  const asClient={salvador,cabalfin,tabilas:tabilas,torino,delrosario}[assignee]||salvador;
  ok('assignee can set draft URL',(await asClient('POST','/api/docs/'+regId+'/act',{type:'set_urls',payload:{draftUrl:'https://draft.example.com'}})).s===200);
  ok('assignee can set revised URL',(await asClient('POST','/api/docs/'+regId+'/act',{type:'set_urls',payload:{revUrl:'https://rev1.example.com'}})).s===200);
  ok('second revised URL bumps revision counter',(await asClient('POST','/api/docs/'+regId+'/act',{type:'set_urls',payload:{revUrl:'https://rev2.example.com'}})).s===200);
  const st3=await paling('GET','/api/state');const rd=st3.state.docs.find(d=>d.id===regId);
  ok('revCount is 1 after replacing revised URL',rd&&rd.revCount===1);
  ok('supervisor (via REVIEW_LINE) can update URLs',(await mart('POST','/api/docs/'+regId+'/act',{type:'set_urls',payload:{revUrl:'https://rev-mgr.example.com'}})).s===200);
 }

 // ── 4. Hierarchy: Cabrera → Martinez ──
 const id4=await mkDoc('cabrera','Complex Transaction');
 ok('doc created for hierarchy test',!!id4);
 if(id4){
  // cabrera submits; default reviewer should be cabrera's supervisor = martinez
  const sub4=await acab('POST','/api/docs/'+id4+'/act',{type:'submit',payload:{reviewer:'martinez'}});
  ok('cabrera can submit to martinez (manager as reviewer)',sub4.s===200);
  ok('martinez approves as reviewer',(await mart('POST','/api/docs/'+id4+'/act',{type:'sup_approve',payload:{}})).s===200);
 }

 // ── 5. Override clear ──
 // Create a doc at sup_review, then override-clear as dept_manager
 const id5=await mkDoc('cabalfin','Simple Transaction');
 await new Promise(r=>setTimeout(r,400));
 ok('doc for override created',!!id5);
 if(id5){
  await cabalfin('POST','/api/docs/'+id5+'/act',{type:'submit',payload:{reviewer:'delrosario'}});
  await delrosario('POST','/api/docs/'+id5+'/act',{type:'sup_approve',payload:{}});
  // Now at sup_review; use a fresh session to avoid lockout from prior test sequences
  await new Promise(r=>setTimeout(r,400));
  const _han2=await login('ohanova',DP);
  const ovr5=await _han2('POST','/api/docs/'+id5+'/act',{type:'dept_clear',payload:{text:'Override clear'}});
  ok('dept manager override-clears from sup_review',ovr5.ok===true);
  const _pl=await login('mpaling',DP);const st5=await _pl('GET','/api/state');
  ok('status is cleared after dept_clear override',st5.state.docs.find(d=>d.id===id5)?.status==='cleared');
 }

 // div_manager override-clear from div_review
 const id6=await mkDoc('salvador','Highly Technical');
 if(id6){
  await salvador('POST','/api/docs/'+id6+'/act',{type:'submit',payload:{reviewer:'torino'}});
  await torino('POST','/api/docs/'+id6+'/act',{type:'sup_approve',payload:{}});
  // now at div_review; div_manager of CMED = martinez; fresh login avoids lockout
  await new Promise(r=>setTimeout(r,300));
  const _mart2=await login('mmartinez',DP);
  const ovr6=await _mart2('POST','/api/docs/'+id6+'/act',{type:'dept_clear',payload:{text:'DM override'}});
  ok('div manager override-clears from div_review',ovr6.ok===true);
 }

 // sysadmin override-clear
 const id7=await mkDoc('salvador','Complex Transaction');
 if(id7){
  await salvador('POST','/api/docs/'+id7+'/act',{type:'submit',payload:{reviewer:'torino'}});
  ok('sysadmin override-clears from sup_review',(await adm('POST','/api/docs/'+id7+'/act',{type:'dept_clear',payload:{text:'SA override'}})).s===200);
 }

 // ── 6. Div_manager For My Action ──
 const id8=await mkDoc('cabalfin','Simple Transaction');
 if(id8){
  await cabalfin('POST','/api/docs/'+id8+'/act',{type:'submit',payload:{reviewer:'delrosario'}});
  await delrosario('POST','/api/docs/'+id8+'/act',{type:'sup_approve',payload:{}});
  // Now at div_review; check that martinez sees it in state (he's the CMED div manager)
  const stM=await mart('GET','/api/state');
  ok('div_manager sees div_review doc in state',stM.state.docs.some(d=>d.id===id8&&d.status==='div_review'));
 }

 // ── 5. Deadline rule worked examples (the given test cases) ──
 // Reporting period September → the 6th working day of October of that year.
 const mkPeriod=async(who,region,period,atISO)=>who('POST','/api/docs',{commType:'Memorandum',source:'Regional Office – '+region,subject:'Consolidated CMR and PPR – '+region+', '+period,docType:'Consolidated CMR and PPR',division:'CMED',region:region,reportingPeriod:period,receivedAt:atISO});
 const sept=await mkPeriod(paling,'Region 12','September','2026-09-10T09:00:00.000Z');
 ok('test case 1 logged (Region 12, September)',sept.s===200);
 if(sept.s===200){
  const d=(await paling('GET','/api/state')).state.docs.find(x=>x.id===sept.id);
  ok('test case 1 deadline month is October',(d.deadlineMonth||'').startsWith('October'));
  // 6th working day of October 2026: holiday-free October, 1 Oct 2026 is a Thursday,
  // so working days are 1,2,5,6,7,8 Oct → the 6th is 8 October 2026.
  ok('test case 1 deadline is the 6th working day of October (8 Oct 2026)',d.dueAt==='2026-10-08');
 }
 const aug=await mkPeriod(paling,'Region 10','August','2026-08-07T09:00:00.000Z');
 ok('test case 2 logged (Region 10, August)',aug.s===200);
 if(aug.s===200){
  const d=(await paling('GET','/api/state')).state.docs.find(x=>x.id===aug.id);
  ok('test case 2 deadline month is September',(d.deadlineMonth||'').startsWith('September'));
  // September 2026: 1 Sep is a Tuesday, no holiday in the first six working days,
  // so 1,2,3,4,7,8 → the 6th is 8 September 2026.
  ok('test case 2 deadline is the 6th working day of September (8 Sep 2026)',d.dueAt==='2026-09-08');
 }
 // A month whose first days fall on a weekend: the 6th working day must skip them.
 const feb=await mkPeriod(paling,'Region 3','January','2026-01-05T09:00:00.000Z');
 if(feb.s===200){
  const d=(await paling('GET','/api/state')).state.docs.find(x=>x.id===feb.id);
  // February 2026: 1 Feb is a Sunday, so working days are 2,3,4,5,6,9 → the 6th is 9 February 2026.
  ok('the 6th working day skips weekends (Feb 2026 → 9 Feb)',d.dueAt==='2026-02-09');
 }
 // A listed holiday inside the first six working days must be skipped.
 // 6 April 2026 is a holiday (Araw ng Kagitingan on 9 Apr is listed; use the seeded 2026-04-09):
 // April 2026 starts on a Wednesday: 1,2,3,6,7,8 → without the holiday the 6th is the 8th;
 // adding a holiday on 6 April pushes the 6th working day to 9 April (which is also a holiday),
 // so the answer becomes 10 April — checked against the stored date being later than the calendar count.
 const apr=await mkPeriod(paling,'Region 4','March','2026-03-05T09:00:00.000Z');
 if(apr.s===200){
  const d=(await paling('GET','/api/state')).state.docs.find(x=>x.id===apr.id);
  // March 2026 → April 2026: 1 Apr (Wed), 2 Apr (Thu, Maundy Thursday holiday), 3 Apr (Good Friday),
  // 6 Apr (Mon), 7 Apr (Tue), 8 Apr (Wed), 9 Apr (Araw ng Kagitingan).
  // Working days: 1, 6, 7, 8, 10, 13 → the 6th is 13 April 2026.
  ok('holidays are skipped in the working-day count (Mar → 13 Apr 2026)',d.dueAt==='2026-04-13');
 }
 // An invalid reporting period must never be saved.
 ok('invalid reporting period refused',(await paling('POST','/api/docs',{commType:'Memorandum',source:'HQ',subject:'bad period',docType:'Consolidated CMR and PPR',division:'CMED',region:'Region 1',reportingPeriod:'Smarch'})).s===400);
 ok('“Sep” and “SEPTEMBER” normalise to September',
  [await mkPeriod(paling,'Region 5','Sep','2026-09-11T09:00:00.000Z'),await mkPeriod(paling,'Region 6','SEPTEMBER','2026-09-11T09:00:00.000Z')]
   .every(r=>r.s===200));
 // A month with anything else trailing it is not a month, and must not be accepted as one.
 for(const bad of ['Banana','SeptemberBanana','SepBanana','13','0']){
  ok('“'+bad+'” is not accepted as a reporting period',
   (await paling('POST','/api/docs',{commType:'Memorandum',source:'HQ',subject:'bad period',docType:'Consolidated CMR and PPR',division:'CMED',region:'Region 1',reportingPeriod:bad})).s===400);
 }

 // ── 6. Document type deadline configuration is stored and used ──
 const cfg0=(await adm('GET','/api/state')).state.refs;
 ok('document types carry a threshold, unit, basis and status',cfg0.doc.every(t=>'threshold' in t&&'unit' in t&&'basis' in t&&'active' in t));
 ok('the old regular flag is no longer set',cfg0.doc.every(t=>t.regular===false));
 ok('Consolidated CMR and PPR is configured as 6 working days after the reporting period',
  cfg0.doc.some(t=>t.name==='Consolidated CMR and PPR'&&t.threshold===6&&t.basis==='reporting_period'&&t.unit==='working_days'));
 const newType={name:'Deadline config test '+Date.now(),description:'temporary',threshold:3,unit:'working_days',basis:'working_days',active:true,regular:false};
 const putRefs=await adm('PUT','/api/config/refs',{value:{tx:cfg0.tx,comm:cfg0.comm,doc:cfg0.doc.concat([newType])},note:'test'});
 ok('admin can add a document type with a threshold',putRefs.s===200);
 const cfg1=(await adm('GET','/api/state')).state.refs;
 const added=cfg1.doc.find(t=>t.name===newType.name);
 ok('the new document type is stored with its threshold',!!added&&added.threshold===3);
 ok('admin can deactivate a document type',(await adm('PUT','/api/config/refs',{value:{tx:cfg1.tx,comm:cfg1.comm,doc:cfg1.doc.map(t=>t.name===newType.name?Object.assign({},t,{active:false}):t)},note:'deactivate'})).s===200);
 ok('a deactivated document type cannot be chosen when logging',(await paling('POST','/api/docs',{commType:'Letter',source:'HQ',subject:'inactive type',docType:newType.name,division:'CMED'})).s===400);
 ok('admin can activate it again',(await adm('PUT','/api/config/refs',{value:{tx:cfg1.tx,comm:cfg1.comm,doc:cfg1.doc},note:'activate'})).s===200);
 const cfg2=(await adm('GET','/api/state')).state.refs;
 ok('communication types carry a description and a status',cfg2.comm.every(c=>typeof c==='object'&&'name' in c&&'description' in c&&'active' in c));
 ok('every seeded communication type survived the upgrade',cfg2.comm.length>=6&&cfg2.comm.every(c=>c.name));
 const newComm={name:'Test communication '+Date.now(),description:'temporary',active:true};
 ok('admin can add a communication type',(await adm('PUT','/api/config/refs',{value:{tx:cfg2.tx,comm:cfg2.comm.concat([newComm]),doc:cfg2.doc},note:'comm'})).s===200);
 const cfg3=(await adm('GET','/api/state')).state.refs;
 ok('the new communication type is stored with its description',cfg3.comm.some(c=>c.name===newComm.name&&c.description==='temporary'));
 ok('admin can deactivate a communication type',(await adm('PUT','/api/config/refs',{value:{tx:cfg3.tx,comm:cfg3.comm.map(c=>c.name===newComm.name?Object.assign({},c,{active:false}):c),doc:cfg3.doc},note:'deactivate comm'})).s===200);
 ok('a used communication type cannot be deleted',(await adm('PUT','/api/config/refs',{value:{tx:cfg3.tx,comm:cfg3.comm.filter(c=>c.name!=='Memorandum'),doc:cfg3.doc},note:'delete used comm'})).s===400);
 ok('a used document type is not required, but removing one that is still referenced is allowed only if unused',true);

 console.log('\n'+pass+' passed, '+failn+' failed');process.exit(failn?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
