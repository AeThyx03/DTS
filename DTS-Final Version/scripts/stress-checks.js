'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {PASSWORD,clone}=require('./stress-fixtures');
const BASE='http://127.0.0.1:3500';
const percentile=(values,f)=>values.length?[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.ceil(values.length*f)-1)]:null;
function client(user) {
  let cookie='';
  const api=async(method,url,body,timeout=120000)=>{
    const r=await fetch(BASE+url,{method,headers:{cookie,'Content-Type':'application/json','X-Requested-With':'dts'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});
    const header=r.headers.get('set-cookie');if(header)cookie=header.split(';')[0];
    const text=await r.text();let data;try{data=JSON.parse(text);}catch{throw new Error(url+' returned invalid JSON (HTTP '+r.status+')');}
    return{status:r.status,data,bytes:Buffer.byteLength(text)};
  };
  api.login=async()=>{const r=await api('POST','/api/login',{username:user.username,password:PASSWORD});assert.equal(r.status,user.active?200:403,'Sign-in: '+user.username);return r;};
  api.cookie=()=>cookie;api.user=user;return api;
}
async function functional({fixture,dir,log,check}) {
  const clients=new Map();
  for(const user of fixture.enrollment) {
    const c=client(user);await c.login();if(user.active)clients.set(user.id,c);
    check('Account sign-in: '+user.username,true);
  }
  const admin=clients.get(fixture.admin.id),db=new DatabaseSync(fixture.file,{readOnly:true}),matrix=[];
  try {
    const read=id=>{const row=db.prepare('SELECT j FROM docs WHERE id=?').get(id);return row?JSON.parse(row.j):null;};
    let nextProbe=0,completed=0;
    await Promise.all(Array.from({length:4},async()=>{while(true){
      const index=nextProbe++;if(index>=fixture.matrix.length)break;
      const probe=fixture.matrix[index];
      const response=await clients.get(probe.userId)('POST','/api/docs/'+probe.id+'/act',{type:probe.action,payload:probe.payload});
      const expectedStatus=probe.expectedOK?200:/authorised/.test(probe.expectedError)?403:400;
      let match=response.status===expectedStatus,reason=match?'':'Expected HTTP '+expectedStatus+', got '+response.status+' '+(response.data.error||'');
      const actual=read(probe.id);
      if(probe.expectedOK&&probe.action==='delete')match&&=!actual;
      else if(probe.expectedOK) {
        for(const [key,value]of Object.entries(probe.expected))if(JSON.stringify(actual?.[key]??null)!==JSON.stringify(value)){match=false;reason+=' Field '+key+' differs.';}
      } else if(JSON.stringify(actual)!==JSON.stringify(probe.original)){match=false;reason+=' Rejected action modified stored document.';}
      matrix[index]={userId:probe.userId,stage:probe.stage,action:probe.action,expectedStatus,actualStatus:response.status,pass:match,reason};
      check('Matrix '+probe.userId+' / '+probe.stage+' / '+probe.action,match,reason);
      if(actual){const deleted=await admin('POST','/api/docs/'+probe.id+'/act',{type:'delete'});assert.equal(deleted.status,200,'Clean isolated matrix probe');}
      completed++;if(completed%250===0)log('Action matrix: '+completed+' / '+fixture.matrix.length);
    }}));
    fs.writeFileSync(path.join(dir,'action-matrix.json'),JSON.stringify(matrix,null,2));
    // Independent expectations supplement API/engine consistency probes.
    const state=async()=>{const r=await admin('GET','/api/state');assert.equal(r.status,200);return r.data.state;};
    let s=await state();check('Base document count survives action matrix',s.docs.length===fixture.documents);
    for(const user of fixture.enrollment.filter(u=>u.active)) {
      for(const division of ['CMED','CMSD'].filter(code=>s.divisions.some(d=>d.code===code))) {
        const focal=s.divisions.find(d=>d.code===division)?.focal;
        const allowed=['sysadmin','admin_staff','dept_manager'].includes(user.role)||user.division===division||user.id===focal;
        const r=await clients.get(user.id)('GET','/api/state?reportDivision='+division);
        check('Division scope '+user.username+' / '+division,r.status===(allowed?200:403));
        if(r.status===200)check('Scope acknowledgement '+user.username+' / '+division,r.data.reportScope===division);
      }
    }
    const docInput={commType:fixture.commType,source:'Stress API Office',subject:'STRESS live lifecycle',docType:fixture.calendarType,division:fixture.division,priority:'Urgent',refNo:'STRESS-API-LIFECYCLE'};
    const created=await admin('POST','/api/docs',docInput);check('API document creation',created.status===200);const id=created.data.id;
    for(const patch of [{subject:''},{division:'UNKNOWN'},{commType:'UNKNOWN'},{url:'javascript:alert(1)'}]) {
      const before=JSON.stringify(read(id));const r=await admin('POST','/api/docs/'+id+'/act',{type:'edit',payload:patch});check('Invalid edit '+Object.keys(patch)[0],r.status===400&&JSON.stringify(read(id))===before);
    }
    const actorFor=(doc,type,preferred)=>{
      // Choose actual enrolled actors using the browser-shared capability definition.
      const {engine}=require('./stress-fixtures');const ctx=engine(path.resolve(__dirname,'..'),s);
      const options=s.users.filter(u=>u.active&&ctx.ENGINE.can(u,doc,type,true));
      return clients.get((options.find(u=>u.id===preferred)||options.find(u=>u.role!=='sysadmin')||fixture.admin).id);
    };
    const move=async(type,payload,preferred)=>{const doc=read(id),who=actorFor(doc,type,preferred),r=await who('POST','/api/docs/'+id+'/act',{type,payload});check('Enrolled lifecycle '+type,r.status===200,r.data.error);return read(id);};
    let d=await move('forward',{});check('Forward -> at_focal',d.status==='at_focal');
    d=await move('assign',{txType:fixture.txType,docType:fixture.calendarType,assignee:fixture.workers[0]});check('Assign -> processing',d.status==='processing');
    const reviewer=s.users.find(u=>u.active&&u.id!==d.assignee&&['supervisor','focal','div_manager','dept_manager'].includes(u.role));
    d=await move('submit',{reviewer:reviewer.id,text:'Ready for review'},d.assignee);
    for(const [back,approve,target]of [['sup_return','sup_approve','div_review'],['div_return','div_approve','dept_review'],['dept_return','dept_clear','cleared']]) {
      d=await move(back,{text:'Attach stress checklist'});check(back+' -> compliance',d.status==='compliance');
      d=await move('submit',{reviewer:reviewer.id,text:'Checklist supplied'},d.assignee);
      // Resubmission may restart supervisor review or return directly to the returning desk.
      if(back==='div_return'&&d.status==='sup_review')d=await move('sup_approve',{});
      if(back==='dept_return'){if(d.status==='sup_review')d=await move('sup_approve',{});if(d.status==='div_review')d=await move('div_approve',{});}
      d=await move(approve,{});check(approve+' -> '+target,d.status===target);
    }
    d=await move('logout',{outTo:'Stress release desk'});check('Lifecycle reaches released status',d.status==='out'&&d.cycles===3&&d.comments.every(c=>c.resolved));
    await admin('POST','/api/docs/'+id+'/act',{type:'delete'});
    // All three schedule types, conflict detection, confirmation, edit and deletion.
    const person=fixture.workers[0],date=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Manila'}),leave=s.leaveTypes.find(t=>t.active!==false);
    const createdSchedules=[];
    for(const type of ['inspection','leave','meeting']) {
      const input={type,title:'STRESS API '+type,project:'STRESS Project',location:'STRESS Site',personnel:[person],organizer:type==='meeting'?person:'',leaveTypeId:type==='leave'?leave.id:'',startDate:date,endDate:date,startTime:'09:00',endTime:'11:00',confirm:true};
      if(type!=='inspection'){const r=await admin('POST','/api/schedules',{...input,confirm:false});check(type+' conflict warning',r.status===409);}
      const r=await admin('POST','/api/schedules',input);check(type+' create and confirm',r.status===200);createdSchedules.push(r.data.id);
      const edited=await admin('PUT','/api/schedules/'+r.data.id,{...input,remarks:'Updated stress schedule'});check(type+' update',edited.status===200);
    }
    for(const schedule of createdSchedules)check('Schedule delete',(await admin('DELETE','/api/schedules/'+schedule)).status===200);
    for(const bad of [{type:'unknown'},{type:'leave',personnel:['UNKNOWN'],startDate:date,endDate:date},{type:'meeting',title:'Bad',personnel:[person],startDate:date,endDate:date,startTime:'25:00',endTime:'99:00'}])check('Reject invalid schedule',(await admin('POST','/api/schedules',bad)).status===400);
    const csrf=await fetch(BASE+'/api/docs',{method:'POST',headers:{cookie:admin.cookie(),'Content-Type':'application/json'},body:JSON.stringify(docInput)});check('CSRF missing header rejected',csrf.status===403);await csrf.text();
    const unauth=await fetch(BASE+'/api/admin/backup');check('Unauthenticated backup rejected',unauth.status===401);await unauth.text();
    for(const user of fixture.enrollment.filter(u=>u.active&&u.role!=='sysadmin')) {
      const c=clients.get(user.id),r=await c('GET','/api/workflows');check('Workflow designer denied for '+user.username,r.status===403);
    }
    // Configuration generation is isolated and idempotent; no clock override is enabled on this server.
    const previousMonth=new Date(new Date().getFullYear(),new Date().getMonth()-1,1),period=previousMonth.getFullYear()+'-'+String(previousMonth.getMonth()+1).padStart(2,'0');
    const cfg=await admin('POST','/api/special-reports/configs',{name:'STRESS API Generation',frequency:'monthly',months:[1,2,3,4,5,6,7,8,9,10,11,12],generationDay:1,threshold:5,basis:'working_days',assignUsers:[person],assignDivisions:[],docType:'',fromPeriod:period,active:true});check('Special Report schedule create',cfg.status===200);
    await admin('POST','/api/special-reports/generate',{});const first=(await state()).spItems.length;await admin('POST','/api/special-reports/generate',{});check('Special Report generation idempotent',(await state()).spItems.length===first);
    await admin('POST','/api/special-reports/configs/'+cfg.data.id+'/active',{active:false});
    const item=(await state()).spItems.find(i=>i.cfgId===cfg.data.id);
    if(item) {
      const other=fixture.workers.find(uid=>uid!==person)||person;
      const specialReviewer=s.users.find(u=>u.active&&u.id!==other&&['supervisor','focal','div_manager','dept_manager'].includes(u.role));
      if(other!==person)check('Special Report reassignment',(await admin('POST','/api/special-reports/items/'+item.id+'/reassign',{users:[other],note:'Stress reassignment'})).status===200);
      const action=async(type,payload,who=admin)=>{const r=await who('POST','/api/special-reports/items/'+item.id+'/action',{type,payload});check('Special Report '+type,r.status===200,r.data.error);};
      await action('submit',{reviewer:specialReviewer.id,text:'Stress draft'},clients.get(other));
      await action('sup_return',{text:'Stress compliance'});await action('submit',{reviewer:specialReviewer.id,text:'Stress corrected'},clients.get(other));
      await action('sup_approve',{});await action('div_approve',{});await action('dept_clear',{});await action('logout',{outTo:'Stress report release'});
      check('Special Report completion persists',(await state()).spItems.find(i=>i.id===item.id).status==='completed');
    }
    // Full-size valid restore and invalid-restore atomicity; save counts before any restore.
    const backup=await admin('GET','/api/admin/backup');check('Large JSON backup exports',backup.status===200&&backup.data.docs.length>=fixture.documents);
    const malformed=clone(backup.data);malformed.holidays=[null];
    const rejected=await admin('POST','/api/admin/restore',malformed);check('Invalid restore rejected atomically',rejected.status===400&&(await state()).docs.length===backup.data.docs.length);
    const begin=performance.now(),restored=await admin('POST','/api/admin/restore',backup.data);check('Full-size backup restores',restored.status===200,restored.data.error);
    // Restore intentionally ends all sessions; renewed sessions verify copied account access afterwards.
    for(const c of clients.values())await c.login();
    check('Restore retains base dataset',(await state()).docs.length===backup.data.docs.length);
    return{clients,admin,restoreMs:performance.now()-begin,matrixCases:matrix.length,matrixFailures:matrix.filter(r=>!r.pass).length};
  } finally {db.close();fs.writeFileSync(path.join(dir,'action-matrix.json'),JSON.stringify(matrix,null,2));}
}
async function measure({clients,admin,concurrency,requests,log,check}) {
  const measurements=[],sessions=[...clients.values()];
  async function load(label,endpoint,parallel,total,method='GET',body) {
    let next=0,bytes=0;const samples=[],errors=[],started=performance.now();
    await Promise.all(Array.from({length:Math.min(parallel,total)},async(_,worker)=>{
      while(true){const i=next++;if(i>=total)return;const begin=performance.now();try{
        const c=endpoint.includes('reportDivision')||endpoint.startsWith('/api/admin/')||endpoint==='/api/audit'||method!=='GET'?admin:sessions[(worker+i)%sessions.length];
        const r=await c(method,endpoint,body);bytes+=r.bytes;if(r.status!==200)errors.push({status:r.status,error:r.data.error});
        samples.push(performance.now()-begin);
      }catch(error){errors.push({error:error.message});}}
    }));
    const seconds=(performance.now()-started)/1000;
    const row={label,endpoint,concurrency:parallel,requests:total,successful:total-errors.length,errors,averageMs:samples.reduce((a,b)=>a+b,0)/(samples.length||1),medianMs:percentile(samples,.5),p95Ms:percentile(samples,.95),maxMs:samples.length?Math.max(...samples):null,requestsPerSecond:total/seconds,meanPayloadMiB:bytes/Math.max(1,total)/1048576};
    measurements.push(row);check(label+' c='+parallel+' HTTP correctness',errors.length===0,JSON.stringify(errors.slice(0,3)));log(label+' c='+parallel+': p95 '+Math.round(row.p95Ms||0)+' ms; '+row.requestsPerSecond.toFixed(1)+' req/s; '+errors.length+' errors');
  }
  for(const parallel of concurrency){await load('Full application state','/api/state',parallel,requests);await load('CMED scoped state','/api/state?reportDivision=CMED',parallel,requests);await load('Version polling','/api/version',parallel,requests*3);}
  const s=(await admin('GET','/api/state')).data.state,doc=s.docs.find(d=>d.status==='processing');
  await load('Concurrent history writes','/api/docs/'+doc.id+'/act',Math.min(15,concurrency.at(-1)),requests,'POST',{type:'comment',payload:{text:'STRESS concurrent write'}});
  const after=(await admin('GET','/api/state')).data.state.docs.find(d=>d.id===doc.id);
  check('Concurrent writes have no lost history',after.history.length===doc.history.length+requests);
  await load('Full backup export','/api/admin/backup',1,3);
  await load('Audit listing','/api/audit',5,Math.min(requests,15));
  return measurements;
}
module.exports={functional,measure,client,percentile};
