'use strict';
// Run via run-regression.js: controlled fixtures must never touch the live database.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
assert.ok(process.env.DATA_DIR&&path.resolve(process.env.DATA_DIR).startsWith(path.resolve('.test-runs')+path.sep),'Requires an isolated regression database');
const base='http://127.0.0.1:'+(process.env.PORT||3111);
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.WF_BROWSER_CHANNEL||'msedge'});
 let passed=0;const check=(name,value)=>{assert.ok(value,name);passed++;console.log('PASS '+name);};
 const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Manila'});
 const headers={'X-Requested-With':'dts'};
 const api=async(method,url,data)=>{const r=await context.request.fetch(base+url,{method,headers,...(data===undefined?{}:{data})});return{status:r.status(),body:await r.json()};};
 try{
  check('anonymous division requests require sign-in',(await api('GET','/api/state?reportDivision=CMED')).status===401);
  check('administrator signs in',(await api('POST','/api/login',{username:'admin',password:'Admin@2026'})).status===200);
  const backup=(await api('GET','/api/admin/backup')).body;
  for(const u of backup.users){if(['cruz','tabilas'].includes(u.id))u.division='CMED';if(u.id==='nieva')u.division='CMSD';}
  const clock='2026-02-02T01:00:00.000Z',onTime='2026-02-04T01:00:00.000Z',late='2026-02-09T01:00:00.000Z';
  const sample=backup.docs[0];
  const doc=(id,division,assignee,extra={})=>({...sample,id,trackNo:'QA-'+id,subject:id,division,assignee,docType:'External Communication',txType:'Simple Transaction',region:'',autoRouted:false,receivedAt:clock,clockStart:clock,dueAt:'2026-02-05',stopAt:onTime,outAt:onTime,status:'out',comments:[],history:[],...extra});
  backup.docs=[doc('cmed','CMSD','cruz'),doc('cmsd','CMED','aprochevado'),doc('unknown','CMED','cabalfin'),doc('unassigned','CMSD','',{status:'processing',stopAt:null,outAt:null}),doc('regular','Admin','tabilas',{docType:'Consolidated CMR and PPR',region:'Region 1',reportingPeriod:'January',status:'processing',stopAt:null,outAt:null,autoRouted:true})];
  const special=(id,month,people,completed=false)=>({id,cfgId:backup.spConfigs[0].id,year:2026,month,title:id,periodLabel:'January 2026',genDate:'2026-02-02',generatedAt:clock,clockStart:clock,dueAt:'2026-02-05',dueLabel:'Test deadline',threshold:5,division:'',status:completed?'completed':'pending',stopAt:completed?late:null,completedBy:completed?people[0]:'',workflow:{status:completed?'out':'processing',division:'',assignee:'',clockStart:clock,stopAt:completed?late:null,comments:[],history:[],stageEnteredAt:clock,outAt:completed?late:null},assign:people.map((userId,i)=>({id:id+'-'+i,itemId:id,userId,status:completed?(i?'closed':'completed'):'active',assignedAt:clock}))});
  backup.spItems=[special('CMED special',1,['tabilas'],true),special('CMSD special',2,['aprochevado']),special('Mixed special',3,['tabilas','aprochevado']),special('Unknown special',4,['cabalfin'])];
  check('fixture restore uses only isolated data',(await api('POST','/api/admin/restore',backup)).status===200);
  const cmed=(await api('GET','/api/state?reportDivision=CMED')).body,cmsd=(await api('GET','/api/state?reportDivision=CMSD')).body;
  check('CMED server response contains only assigned CMED documents',JSON.stringify(cmed.state.docs.map(d=>d.id).sort())===JSON.stringify(['cmed','regular']));
  check('CMSD server response follows assignee and unassigned stored ownership',JSON.stringify(cmsd.state.docs.map(d=>d.id).sort())===JSON.stringify(['cmsd','unassigned']));
  check('CMED includes its blank-division Special Report once',cmed.state.spItems.length===1&&cmed.state.spItems[0].id==='CMED special');
  check('CMSD includes only its own Special Report',cmsd.state.spItems.length===1&&cmsd.state.spItems[0].id==='CMSD special');
  check('mixed and unresolved ownership is excluded',[...cmed.state.spItems,...cmsd.state.spItems].every(i=>!['Mixed special','Unknown special'].includes(i.id)));
  check('scoped response retains stored document division',cmed.state.docs.find(d=>d.id==='cmed').division==='CMSD');
  check('invalid division cannot request broader reporting',(await api('GET','/api/state?reportDivision=ALL')).status===400);
  check('empty division is rejected',(await api('GET','/api/state?reportDivision=')).status===400);
  const unchanged=(await api('GET','/api/state')).body.state;
  check('shared state retains every record',unchanged.docs.length===5&&unchanged.spItems.length===4);
  check('report reads do not update stored ownership',unchanged.docs.find(d=>d.id==='cmed').division==='CMSD'&&unchanged.spItems.every(i=>!i.reportingDivision&&!i.division));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await page.goto(base);await page.waitForSelector('.shell');await page.waitForSelector('#splash',{state:'detached'});
  const navigate=async(route,param)=>{await page.evaluate(([r,p])=>go(r,p),[route,param]);if(['cmed','cmsd','regular'].includes(route))await page.waitForFunction(()=>!!UI.divisionReport?.state);};
  const nav=await page.locator('.nav > a').allTextContents();
  check('CMED and CMSD each have one distinct sidebar destination',nav.filter(x=>x==='CMED').length===1&&nav.filter(x=>x==='CMSD').length===1);
  check('sidebar has no duplicate Regular Reports or reporting tabs',await page.locator('.nav [data-r=regular],.nav [data-r=analytics],.nav [data-r=graphs]').count()===0);
  await navigate('cmed');
  check('CMED has Regular Reports and one combined metric tab',await page.locator('.division-tabs a').count()===2);
  check('CMED sidebar active state is correct',await page.locator('.nav [data-r=cmed]').getAttribute('aria-current')==='page');
  check('Consolidated CMR/PPR tab is retained',await page.locator('[data-act=regularTab][data-k=consolidated]').isVisible());
  await page.click('[data-act=regRow][data-v="Region 1"]');
  check('regular region drilldown keeps the division scope',await page.evaluate(()=>UI.route==='dashboard'&&UI.filters.reportDivision==='CMED'&&listDocs(ME()).every(d=>d.id==='regular')));
  await navigate('cmed');await page.click('[data-act=regularTab][data-k=special]');
  check('CMED Special Reports table is scoped',await page.locator('#view tbody').innerText().then(t=>t.includes('CMED special')&&!t.includes('CMSD special')&&!t.includes('Mixed special')));
  await page.click('[data-act=spOpen]');await page.waitForSelector('.sr-detail');
  check('Special Report workflow detail still opens',await page.locator('.sr-detail').innerText().then(t=>t.includes('Review workflow')&&t.includes('Assignment history')));await page.click('[data-act=closeModal]');
  await navigate('regular');check('legacy Regular Reports navigation resolves to CMED',await page.evaluate(()=>UI.route==='cmed'&&UI.param==='regular'));
  await navigate('cmed','turnaround');
  check('turnaround keeps the original working-day calculation',await page.evaluate(()=>buildReport(ME()).rows.find(r=>r[0]==='Division')[5]==='3.5'));
  check('CMED report contains no CMSD grouping',await page.evaluate(()=>buildReport(ME()).rows.filter(r=>r[0]==='Division').every(r=>r[1]==='CMED')));
  check('merged report contains both metric columns',await page.evaluate(()=>buildReport(ME()).cols.length===7&&buildReport(ME()).cols.at(-1)==='On-time rate'));
  await page.click('[data-act=printReport]');check('division print output retains both metrics',await page.locator('#ppBody h1').innerText()==='CMED — Turnaround Time & On-Time Rate');await page.click('[data-act=ppClose]');
  const download=page.waitForEvent('download');await page.click('[data-act=exportReport]');const csv=await download;check('division CSV retains division filename',csv.suggestedFilename().startsWith('cmed-performance-'));
  const csvPath=await csv.path();check('division CSV does not leak CMSD rows',!fs.readFileSync(csvPath,'utf8').includes('CMSD'));
  await navigate('cmed','ontime');check('legacy metric URLs open the merged report',await page.evaluate(()=>divisionSection()==='performance'));
  check('on-time rate retains its original numerator and denominator',await page.evaluate(()=>buildReport(ME()).rows.find(r=>r[0]==='Division')[6]==='50%'));
  await page.fill('[data-k=from]','2026-03-01');check('metric date filter is applied',await page.evaluate(()=>buildReport(ME()).rows.length===0));await page.fill('[data-k=from]','');
  await navigate('cmsd','turnaround');check('CMSD turnaround excludes CMED',await page.evaluate(()=>buildReport(ME()).rows.find(r=>r[0]==='Division')[5]==='2.0'));
  await navigate('cmsd','ontime');check('CMSD on-time calculation is independent',await page.evaluate(()=>buildReport(ME()).rows.find(r=>r[0]==='Division')[6]==='100%'));
  check('CMSD has documents and one combined report',await page.locator('.division-tabs a').count()===2&&await page.locator('.division-tabs [data-k=documents]').count()===1);
  // Exercise the shared registry on enough CMSD-only data to require pagination.
  for(let i=0;i<25;i++)check('create isolated CMSD registry fixture '+i,(await api('POST','/api/docs',{subject:'CMSD registry fixture '+i,source:'CMSD QA office',commType:'Letter',docType:'External Communication',division:'CMSD'})).status===200);
  await page.evaluate(()=>refresh());await navigate('cmsd','documents');
  check('CMSD documents defaults to all scoped records',await page.evaluate(()=>listDocs(ME()).length===28));
  check('CMSD registry exposes every existing column',await page.locator('#regTable thead th').count()===9);
  check('CMSD registry has the shared saved-view and preview controls',await page.locator('[data-chg=uxView],[data-chg=uxPreview]').count()===2);
  check('CMSD source cannot be unlocked with a division selector',await page.locator('.fp [data-k=division]').count()===0);
  await page.click('[data-act=page][data-d="1"]');check('CMSD pagination reaches the next page',await page.locator('#regTable tbody tr').count()===3);
  await page.selectOption('[data-chg=documentPageSize]','50');check('CMSD page size uses the shared control',await page.locator('#regTable tbody tr').count()===28);
  await page.fill('#regSearch','QA-cmsd');await page.waitForFunction(()=>listDocs(ME()).length===1);
  check('CMSD search finds tracking codes',await page.locator('#regTable tbody').innerText().then(t=>t.includes('QA-cmsd')&&!t.includes('QA-cmed')));
  await page.click('[data-act=printList]');check('CMSD registry print remains scoped and labelled',await page.locator('#ppBody').textContent().then(t=>t.includes('CMSD document registry')&&t.includes('QA-cmsd')&&!t.includes('QA-cmed')));await page.click('[data-act=ppClose]');
  const registryDownload=page.waitForEvent('download');await page.click('[data-act=exportList]');const registryCSV=await registryDownload;
  check('CMSD registry CSV downloads the complete shared column set',registryCSV.suggestedFilename().startsWith('cmsd-documents-')&&fs.readFileSync(await registryCSV.path(),'utf8').includes('Lifecycle progress'));
  await page.click('[data-chg=rowSel][data-id=cmsd]');check('CMSD selection uses the shared selection controller',await page.evaluate(()=>selectedDocs().length===1&&selectedDocs()[0].id==='cmsd'));
  await page.click('[data-act=colsMenu]');await page.click('[data-chg=col][data-k=recv]');check('CMSD column visibility is configurable',await page.locator('#regTable thead th').count()===8);await page.click('[data-chg=col][data-k=recv]');await page.click('[data-act=colsMenu]');
  await page.click('[data-act=openDoc][data-id=cmsd]');check('CMSD document opens the original workflow view',await page.locator('.ux-doc-summary').isVisible());
  check('CMSD document keeps its sidebar context',await page.locator('.nav [data-r=cmsd]').getAttribute('aria-current')==='page');
  await page.click('[data-act=uxBack]');await page.waitForSelector('#regSearch');check('back navigation restores CMSD search and selection',await page.inputValue('#regSearch')==='QA-cmsd'&&await page.evaluate(()=>UI.sel.has('cmsd')));
  await page.check('[data-chg=uxPreview]');await page.click('[data-act=openDoc][data-id=cmsd]');check('CMSD preview uses the shared document drawer',await page.locator('.modal.ux-drawer').isVisible());await page.click('.modal [data-act=closeModal]');await page.uncheck('[data-chg=uxPreview]');
  await page.fill('#regSearch','QA-cmed');await page.waitForFunction(()=>listDocs(ME()).length===0);check('CMSD search never exposes a CMED document',await page.locator('#regTable tbody').innerText().then(t=>t.includes('No documents match')));
  await page.click('[data-act=clearAllFilters]');check('clearing filters keeps CMSD scope locked',await page.evaluate(()=>listDocs(ME()).length===28&&baseDocs(ME()).every(d=>d.reportingDivision==='CMSD'||d.specialReport)));
  await page.click('[data-act=toggleMore]');await page.selectOption('#moreF [data-k=status]','out');check('CMSD advanced status filter works',await page.evaluate(()=>listDocs(ME()).length===1));await page.click('[data-act=clearAllFilters]');
  await page.selectOption('[data-chg=sortKey]','trackNo');check('CMSD sort uses the existing comparator',await page.evaluate(()=>{const rows=listDocs(ME());return rows[0].trackNo<=rows.at(-1).trackNo;}));
  await page.fill('#regSearch','CMSD registry fixture 0');await page.waitForFunction(()=>listDocs(ME()).length===1);
  const forwardId=await page.evaluate(()=>listDocs(ME())[0].id);await page.check('[data-chg=rowSel][data-id="'+forwardId+'"]');await page.selectOption('[data-chg=batchSel]','forward');await page.click('[data-act=batchExec]');await page.click('[data-act=uxRunBatch]');await page.waitForFunction(id=>S.docs.find(d=>d.id===id)?.status==='at_focal',forwardId);
  check('CMSD batch forward reaches the existing workflow API',(await api('GET','/api/state')).body.state.docs.find(d=>d.id===forwardId).status==='at_focal');
  await page.click('[data-act=clearAllFilters]');await navigate('dashboard');
  check('CMSD filters and columns do not overwrite the department registry',await page.evaluate(()=>UI.filters.reportDivision==='CMED'&&UI.filters.region==='Region 1'&&UI.hidden.includes('recv')));
  await navigate('cmsd','documents');check('CMSD registry state is restored independently',await page.evaluate(()=>UI.pageSize===50&&!UI.hidden.includes('recv')));
  // CMSD state remains stable across a reload and still cannot broaden its source.
  await page.fill('#regSearch','CMSD QA office');await page.waitForFunction(()=>listDocs(ME()).length===25);await page.reload();await page.waitForSelector('#regSearch');await page.waitForFunction(()=>!!UI.divisionReport?.state);await page.waitForSelector('#splash',{state:'detached'});
  check('CMSD search survives reload',await page.inputValue('#regSearch')==='CMSD QA office');await page.click('[data-act=clearAllFilters]');
  await navigate('reports');check('Operational Reports has no redundant report views',await page.locator('[data-act=repTab],[data-act=printReport],[data-act=exportReport]').count()===0);
  await page.evaluate(()=>{UI.gf={division:'',mode:'single',from:'2026-02',to:'2026-02',months:{}};});
  await navigate('analytics');
  check('analytics still includes the complete authorized receipt cohort',await page.evaluate(()=>periodDocs(ME()).length===9));
  check('analytics print and CSV controls live in the report toolbar',await page.locator('.report-toolbar [data-act=printAnalytics],.report-toolbar [data-act=exportAnalytics]').count()===2);
  check('desktop report toolbar stays compact',await page.locator('.report-toolbar').evaluate(e=>e.getBoundingClientRect().height<125));
  await page.click('[data-act=printAnalytics]');check('analytics print still contains tables',await page.locator('#ppBody table').count()===5);await page.click('[data-act=ppClose]');
  const analyticsCSV=page.waitForEvent('download');await page.click('[data-act=exportAnalytics]');check('analytics CSV downloads',(await analyticsCSV).suggestedFilename().startsWith('analytics-'));
  await navigate('graphs');
  check('charts retain all eight chart panels',await page.locator('.charts > .card').count()===8);
  check('charts print is in the same toolbar',await page.locator('.report-toolbar [data-act=printGraphs]').count()===1);
  check('chart release counts retain their date basis',await page.evaluate(()=>graphsData(ME()).vol[0].o===3));
  await page.click('[data-act=printGraphs]');check('chart print retains volume and legends',await page.locator('#ppBody').textContent().then(t=>t.includes('Volume by month')&&t.includes('Received')&&t.includes('Released')));await page.click('[data-act=ppClose]');
  for(const width of [1440,1024,390]){
   await page.setViewportSize({width,height:1000});
   for(const [route,param] of [['cmed','regular'],['cmed','performance'],['cmsd','documents'],['cmsd','performance'],['analytics'],['graphs'],['schedule']]){
    await navigate(route,param);
    check(route+'/'+(param||'')+' fits '+width+'px',await page.evaluate(()=>{const v=document.querySelector('#view');return v.scrollWidth<=v.clientWidth+1;}));
    if(width!==1024)await page.screenshot({path:path.join(process.env.SHOTS,route+'-'+(param||'main')+'-'+width+'.png')});
   }
  }
  check('Personnel Schedule remains accessible',await page.locator('.cal-bar').isVisible());
  for(const [username,allowed] of [['dcruz',['CMED']],['caprochevado',['CMSD']],['mtabilas',['CMED']],['bnieva',['CMSD']],['acabrera',['CMED']],['maquino',['CMSD']],['mmartinez',['CMED']],['jvillarete',['CMSD']],['mpaling',['CMED','CMSD']],['ohanova',['CMED','CMSD']],['bcabalfin',[]]]){
   await api('POST','/api/logout',{});check(username+' signs in',(await api('POST','/api/login',{username,password:'Track@2026'})).status===200);
   for(const division of ['CMED','CMSD'])check(username+' server scope '+division,(await api('GET','/api/state?reportDivision='+division)).status===(allowed.includes(division)?200:403));
   await page.goto(base+'/#/dashboard');await page.reload();await page.waitForSelector('.shell');await page.waitForSelector('#splash',{state:'detached'});
   for(const division of ['CMED','CMSD'])check(username+' sidebar access '+division,await page.locator('.nav [data-r='+division.toLowerCase()+']').count()===(allowed.includes(division)?1:0));
   const denied=['CMED','CMSD'].find(d=>!allowed.includes(d));if(denied){await page.evaluate(d=>go(d.toLowerCase()),denied);check(username+' direct route is guarded',await page.locator('#view').innerText().then(t=>t.includes('do not have access')));}
  }
  await api('POST','/api/logout',{});await api('POST','/api/login',{username:'admin',password:'Admin@2026'});
  // Permissions are still role-based; removing report grants must leave Regular Reports available.
  await page.setViewportSize({width:1440,height:1000});
  const perms=unchanged.perms;perms.staff=perms.staff.filter(p=>!['report.view','report.print'].includes(p));
  check('test role permissions update',(await api('PUT','/api/config/perms',{value:perms})).status===200);
  await api('POST','/api/logout',{});check('staff signs in',(await api('POST','/api/login',{username:'dcruz',password:'Track@2026'})).status===200);
  await page.reload();await page.waitForSelector('.shell');await page.waitForSelector('#splash',{state:'detached'});
  check('staff without reports keeps CMED Regular Reports but no CMSD or Reports',await page.locator('.nav [data-r=cmed]').count()===1&&await page.locator('.nav [data-r=cmsd],.nav [data-r=reports]').count()===0);
  await navigate('cmed');check('metric tabs respect report.view',await page.locator('.division-tabs a').count()===1);
  await navigate('cmed','turnaround');check('direct metric route cannot bypass report.view',await page.locator('#view').innerText().then(t=>t.includes('do not have access')));
  await navigate('graphs');check('direct Charts route retains its permission guard',await page.locator('#view').innerText().then(t=>t.includes('do not have access')));
  check('CMED staff cannot query CMSD even with a forged request',(await api('GET','/api/state?reportDivision=CMSD')).status===403);
  await api('POST','/api/logout',{});await api('POST','/api/login',{username:'caprochevado',password:'Track@2026'});await page.goto(base+'/#/cmsd/documents');await page.reload();await page.waitForSelector('#regSearch');await page.waitForFunction(()=>!!UI.divisionReport?.state);await page.waitForSelector('#splash',{state:'detached'});
  check('CMSD staff without report.view retains the document registry',await page.locator('.division-tabs a').count()===1&&await page.locator('.nav [data-r=cmed]').count()===0);
  check('CMSD staff cannot query CMED',(await api('GET','/api/state?reportDivision=CMED')).status===403);
  check('no browser JavaScript errors',errors.length===0);
  console.log(passed+' passed, 0 failed');
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
