'use strict';
// Capture only a disposable copy of the completed stress database.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {spawn}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'../..'),out=__dirname,qa=path.join(out,'qa');
const latest=JSON.parse(fs.readFileSync(path.join(root,'.stress-tests/3500/latest.json')));
const data=path.join(qa,'capture-data-'+Date.now());fs.mkdirSync(data,{recursive:true});
const file=path.join(data,'dts.sqlite');
if(fs.existsSync(file))throw new Error('Capture snapshot already exists; use a fresh capture directory.');
const source=new DatabaseSync(path.join(latest.directory,'data/dts.sqlite'),{readOnly:true});
source.exec("VACUUM INTO '"+file.replace(/'/g,"''")+"'");source.close();
// The stress matrix happens to place every at_focal sample in CMSD. Prepare
// one CMED reference in this disposable capture copy for the focal scene.
const captureDb=new DatabaseSync(file);
const sample=JSON.parse(captureDb.prepare("SELECT j FROM docs WHERE json_extract(j,'$.status')='at_focal' LIMIT 1").get().j);
sample.division='CMED';sample.subject='SHOWCASE SAMPLE | CMED focal assignment';
sample.history[sample.history.length-1].desk='CMED Focal - Aubrey Camille C. Cabrera';
captureDb.prepare('UPDATE docs SET j=? WHERE id=?').run(JSON.stringify(sample),sample.id);captureDb.close();
let server,browser;
(async()=>{
 const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const base='http://127.0.0.1:'+port;
 server=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:data,SEED_DEMO:'0',SR_TEST:'0',COOKIE_SECURE:'0',TRUST_PROXY:'0',TZ:'Asia/Manila'},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',b=>fs.appendFileSync(path.join(qa,'capture-server.log'),b));server.stderr.on('data',b=>fs.appendFileSync(path.join(qa,'capture-server.log'),b));
 let ready=false;for(let i=0;i<400;i++){if(server.exitCode!==null)throw new Error('Capture server exited');try{if((await fetch(base+'/healthz')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}if(!ready)throw new Error('Capture server timeout');
 const modulePath=path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
 const {chromium}=require(modulePath);browser=await chromium.launch({headless:true,channel:'msedge'});
 const contexts=new Map(),errors=[];
 async function account(username){
  if(contexts.has(username))return contexts.get(username);
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Manila'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const auth=await ctx.request.post(base+'/api/login',{headers:{'X-Requested-With':'dts'},data:{username,password:'Stress@3500!'}});if(auth.status()!==200)throw new Error('Capture login '+username);
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.waitForSelector('.shell');await p.waitForSelector('#splash',{state:'detached'});contexts.set(username,{ctx,p});return{ctx,p};
 }
 const adm=await account('admin'),state=await adm.p.evaluate(()=>({users:S.users,docs:S.docs,items:S.spItems}));
 const doc=(status,assignee)=>state.docs.find(d=>d.status===status&&(!assignee||d.assignee===assignee));
 const hero=state.docs.find(d=>d.status==='processing'&&d.assignee==='cruz'&&!d.autoRouted)||doc('processing','cruz'),review=state.docs.find(d=>d.status==='sup_review'&&d.reviewer==='tabilas')||doc('sup_review');
 const focal=state.docs.find(d=>d.status==='at_focal'&&d.division==='CMED');
 if(!focal)throw new Error('Missing CMED focal reference document');
 const reviewUser=state.users.find(u=>u.id===review.reviewer)?.username||'admin';
 const maps={
 S01:['admin','dashboard'],S02:['admin','users'],S04:['dcruz','action'],S05:['admin','dashboard'],S06:['admin','doc',hero.id],S07:['mpaling','dashboard'],S08:['acabrera','doc',focal.id],S09:['admin','dashboard'],S10:['dcruz','doc',hero.id],S11:[reviewUser,'doc',review.id],S12:['ohanova','doc',doc('dept_review').id],S13:['admin','doc',doc('return_out').id],S14:['mpaling','doc',doc('out').id],S15:['admin','cmed','regular'],S16:['admin','cmsd','performance'],S17:['admin','refs'],S18:['admin','cmed','regular'],S19:['admin','schedule'],S20:['admin','analytics'],S21:['admin','graphs'],S22:['admin','dashboard'],S23:['admin','roles'],S24:['admin','delegation'],S25:['admin','refs'],S26:['admin','settings'],S27:['admin','audit'],S28:['admin','settings'],S29:['admin','workflow'],S30:['admin','settings'],S32:['admin','doc',doc('out').id]};
 const captured=[];
 for(let i=1;i<=32;i++){
  const id='S'+String(i).padStart(2,'0');let p;
  if(process.env.ONLY_SCENES&&!process.env.ONLY_SCENES.split(',').includes(id))continue;
  if(id==='S03'){const c=await browser.newContext({viewport:{width:1440,height:1000}});await c.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());p=await c.newPage();await p.goto(base);await p.waitForSelector('#lu');await p.waitForSelector('#splash',{state:'detached'});}
  else if(id==='S31'){p=await adm.ctx.newPage();await p.goto('file:///'+path.join(latest.directory,'report.html').replace(/\\/g,'/'));}
  else {
   const [username,route,param]=maps[id];p=(await account(username)).p;
   await p.evaluate(()=>{closeModal();ACTIONS.ppClose();});
   await p.evaluate(([r,v])=>go(r,v),[route,param]);
   if(['cmed','cmsd'].includes(route))await p.waitForFunction(()=>!!UI.divisionReport?.state);
   if(id==='S07')await p.evaluate(()=>openDocForm(null));
   if(id==='S09')await p.evaluate(()=>{UI.filters={tile:'overdue'};render();});
   if(id==='S17')await p.evaluate(()=>{UI.refTab='special';render();});
   if(id==='S25')await p.evaluate(()=>{UI.refTab='documents';render();});
   if(id==='S18'){const t=p.locator('[data-act=regularTab][data-k=special]');if(await t.count())await t.click();}
   if(id==='S22'){await p.evaluate(()=>{UI.filters={tile:'total'};render();});await p.click('[data-act=printList]');await p.waitForSelector('#ppBody table');}
   if(id==='S28'){const b=p.locator('[data-act=backup]');if(await b.count())await b.scrollIntoViewIfNeeded();}
   if(id==='S29'){
    await p.waitForSelector('#wfSwitch');
    await p.evaluate(async()=>{
     const definition={nodes:[
      {id:'start',type:'START',label:'Start',x:60,y:100,config:{}},
      {id:'review',type:'REVIEW',label:'Supervisor review',x:320,y:100,config:{responsibilityType:'ROLE',role:'supervisor'}},
      {id:'decision',type:'DECISION',label:'Complete?',x:580,y:100,config:{}},
      {id:'end',type:'END',label:'Approved result',x:840,y:30,config:{}},
      {id:'revision',type:'END',label:'Revision path',x:840,y:250,config:{}}
     ],edges:[
      {id:'a',source:'start',target:'review',label:'Begin',condition:{}},
      {id:'b',source:'review',target:'decision',label:'Review complete',condition:{}},
      {id:'c',source:'decision',target:'end',label:'TRUE',condition:{sourceHandle:'TRUE'}},
      {id:'d',source:'decision',target:'revision',label:'FALSE',condition:{sourceHandle:'FALSE'}}
     ]};
     const r=await api('POST','/api/workflows',{name:'SHOWCASE - drafting and simulation only',docType:S.refs.doc[0].name,definition});
     if(!r.ok)throw new Error(r.error);
     await wfList();await wfOpen(r.workflow.id,r.workflow.versionId);wfFit();
    });
    await p.waitForSelector('#wfBoard');await p.waitForTimeout(300);
   }
  }
  await p.waitForTimeout(200);
  const check=await p.evaluate(()=>({modal:!!document.querySelector('#modalRoot')?.children.length,print:!!document.querySelector('#pp.on'),route:typeof UI==='undefined'?null:UI.route}));
  if(check.modal&&id!=='S07')throw new Error(id+' has an unexpected modal');
  if(check.print&&id!=='S22')throw new Error(id+' has an unexpected print preview');
  captured.push({id,...check});
  await p.screenshot({path:path.join(out,'assets','capture-'+id+'.png')});console.log('Captured '+id);
 }
 fs.writeFileSync(path.join(qa,process.env.ONLY_SCENES?'capture-validation-supplement.json':'capture-validation.json'),JSON.stringify({source:'Disposable copy of completed stress database',captures:captured,uncaughtErrors:errors},null,2));if(errors.length)throw new Error(errors.join('; '));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server&&server.exitCode===null){await new Promise(resolve=>{server.once('exit',resolve);server.kill();});}});
