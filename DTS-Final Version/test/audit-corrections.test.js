'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {DatabaseSync}=require('node:sqlite');
assert.ok(process.env.DATA_DIR&&path.resolve(process.env.DATA_DIR).startsWith(path.resolve(__dirname,'../.test-runs')+path.sep),'Use the isolated regression runner.');
const base='http://127.0.0.1:'+(process.env.PORT||3111);let passed=0;
const check=(name,value)=>{assert.ok(value,name);passed++;console.log('PASS '+name);};
function client(){let cookie='';return async(method,url,body)=>{const r=await fetch(base+url,{method,headers:{cookie,'X-Requested-With':'dts','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return{status:r.status,...await r.json()};};}
(async()=>{
 const api=client();check('admin signs in',(await api('POST','/api/login',{username:'admin',password:'Admin@2026'})).status===200);
 const state=async()=>(await api('GET','/api/state')).state,backup=await api('GET','/api/admin/backup');
 const act=(id,type,payload)=>api('POST','/api/docs/'+id+'/act',{type,payload});
 const create=async(extra={})=>{const r=await api('POST','/api/docs',{commType:'Letter',source:'Regression office',subject:'Correction regression',docType:'External Communication',division:'CMED',...extra});assert.equal(r.status,200,r.error);return r.id;};
 const find=async id=>(await state()).docs.find(d=>d.id===id);
 const refs=(await state()).refs;refs.doc.push({name:'Three working days',threshold:3,basis:'working_days',unit:'working_days',active:true});
 check('deadline type saves',(await api('PUT','/api/config/refs',{value:refs})).status===200);
 const id=await create({docType:'Three working days'}),initial=await find(id);
 check('new received document has no clock',initial.clockStart===null&&initial.dueAt===null);
 check('partial metadata edit succeeds',(await act(id,'edit',{subject:'Edited subject only'})).status===200);
 const edited=await find(id);check('metadata edit preserves unassigned clock',edited.clockStart===null&&edited.dueAt===null&&edited.status==='received'&&!edited.assignee);
 for(const payload of [{source:''},{division:'UNKNOWN'},{commType:'UNKNOWN'},{docType:'UNKNOWN'},{priority:'banana'},{docType:'Consolidated CMR and PPR',reportingPeriod:''},{docType:'Consolidated CMR and PPR',reportingPeriod:'September'},{draftUrl:'javascript:bad'}]){
  const before=JSON.stringify(await find(id));check('invalid edit rejected: '+JSON.stringify(payload),(await act(id,'edit',payload)).status===400);check('rejected edit is atomic',JSON.stringify(await find(id))===before);
 }
 check('forward succeeds',(await act(id,'forward',{})).status===200);
 check('assignment starts prescribed clock',(await act(id,'assign',{docType:'Three working days',txType:'Simple Transaction',assignee:'cruz'})).status===200);
 const assigned=await find(id);check('assigned clock exists',!!assigned.clockStart&&!!assigned.dueAt);
 check('assigned metadata edit succeeds',(await act(id,'edit',{source:'Updated office'})).status===200);
 check('assigned clock and due date stay stable',(await find(id)).clockStart===assigned.clockStart&&(await find(id)).dueAt===assigned.dueAt);
 let config=(await state()).refs;config.doc.find(t=>t.name==='Three working days').active=false;
 check('used type can be deactivated',(await api('PUT','/api/config/refs',{value:config})).status===200);
 check('existing retired type may be retained in metadata edit',(await act(id,'edit',{subject:'Keep retired type'})).status===200);
 config=(await state()).refs;config.doc.find(t=>t.name==='Three working days').name='Renamed used type';check('used type cannot be renamed',(await api('PUT','/api/config/refs',{value:config})).status===400);
 const focal=(await state()).users.find(u=>u.id==='cabrera');
 check('configured focal cannot be deactivated',(await api('PUT','/api/users/'+focal.id,{...focal,active:false})).status===400);
 const account={name:'Concurrent user',username:'race.corrected',role:'staff',division:'CMED',password:'Regression1234'};
 const race=await Promise.all([api('POST','/api/users',account),api('POST','/api/users',{...account,username:'RACE.CORRECTED'})]);
 check('concurrent case-insensitive usernames have one success',race.filter(r=>r.status===200).length===1&&race.filter(r=>r.status===400).length===1);
 check('only one matching user persisted',(await state()).users.filter(u=>u.username.toLowerCase()==='race.corrected').length===1);
 const current=await api('GET','/api/admin/backup'),disk=new DatabaseSync(path.join(process.env.DATA_DIR,'dts.sqlite'),{readOnly:true});
 const durable=()=>JSON.stringify(['users','docs','kv','sr_config','sr_item','sr_assign','schedules'].map(t=>disk.prepare('SELECT * FROM '+t+' ORDER BY 1').all()));
 for(const change of [b=>b.holidays=[null],b=>b.docs[0].status='INVALID',b=>b.docs[0].history=null,b=>b.users.push({...b.users[0],id:'other'}),b=>delete b.users[0].username,b=>b.divisions[0].focal='unknown',b=>b.schedules=[{id:'bad'}],b=>b.workflowVersions=[{id:'bad',definition:'invalid json'}],b=>b.refs.doc[0].active='false',b=>b.workflowNodes=[{id:'bad',version_id:'missing',type:'INVALID',label:'Invalid node',x:0,y:0,config:'{}'}]]){
  const b=structuredClone(current);change(b);const before=durable();check('malformed backup rejected',(await api('POST','/api/admin/restore',b)).status===400);check('invalid restore leaves durable data unchanged',durable()===before);check('invalid restore keeps the current session usable',(await api('GET','/api/state')).status===200);
 }
 const constraint=structuredClone(current);constraint.workflows=[{id:'wf',name:'Bad foreign key fixture',doc_type:'CPES',created_at:new Date().toISOString(),created_by:'sysadmin',active:1}];constraint.workflowVersions=[];constraint.workflowNodes=[{id:'node',version_id:'missing-version',type:'START',label:'Start',x:0,y:0,config:'{}'}];constraint.workflowEdges=[];
 const beforeConstraint=durable();check('database constraint failure rejects restore',(await api('POST','/api/admin/restore',constraint)).status===400);check('transaction failure rolls back persisted data',durable()===beforeConstraint);check('transaction failure restores in-memory state',(await state()).docs.some(d=>d.id===id));
 const owned=structuredClone(backup);owned.docs=[];owned.users.find(u=>u.id==='cruz').division='CMED';
 const time='2026-02-02T01:00:00Z';owned.spItems=[{id:'owned',cfgId:owned.spConfigs[0].id,year:2026,month:1,title:'Owned report',periodLabel:'January 2026',generatedAt:time,clockStart:time,dueAt:'2026-02-10',status:'pending',workflow:{status:'processing',assignee:'cruz',division:'CMED',comments:[],history:[]},assign:[{id:'owned-a',itemId:'owned',userId:'cruz',status:'active',assignedAt:time}]}];
 check('valid backup restores',(await api('POST','/api/admin/restore',owned)).status===200);
 check('valid restore has an independent recovery snapshot',fs.readdirSync(path.join(process.env.DATA_DIR,'backups/restore')).some(f=>f.endsWith('.sqlite')));
 check('personnel/report dependency blocks division removal',(await api('PUT','/api/config/divisions',{value:owned.divisions.filter(d=>d.code!=='CMED')})).status===400);
 check('division report remains available after rejected removal',(await api('GET','/api/state?reportDivision=CMED')).state.spItems.length===1);
 const unused='Related report type';let related=(await state()).refs;related.doc.push({name:unused,threshold:null,basis:'working_days',unit:'working_days',active:true});check('unused reference can be added',(await api('PUT','/api/config/refs',{value:related})).status===200);
 const schedule=(await state()).spConfigs[0];check('report schedule can reference a type',(await api('PUT','/api/special-reports/configs/'+schedule.id,{...schedule,assignUsers:['cruz'],docType:unused})).status===200);
 related=(await state()).refs;related.doc=related.doc.filter(t=>t.name!==unused);check('report schedule dependency blocks type removal',(await api('PUT','/api/config/refs',{value:related})).status===400);
 const graph={nodes:[],edges:[]};check('workflow draft creates',(await api('POST','/api/workflows',{name:'Reference dependency',docType:'CPES',definition:graph})).status===201);
 related=(await state()).refs;related.doc=related.doc.filter(t=>t.name!=='CPES');check('workflow dependency blocks type removal',(await api('PUT','/api/config/refs',{value:related})).status===400);
 const person=(await state()).users.find(u=>u.id==='cruz');check('staff division update saves',(await api('PUT','/api/users/'+person.id,{...person,division:'CMED',active:true})).status===200);
 const region=(await state()).designations;region.find(d=>d.name==='Region 1').staff='cruz';check('regional responsibility saves',(await api('PUT','/api/config/designations',{value:region})).status===200);
 const regular=await create({docType:'Consolidated CMR and PPR',division:'Admin',region:'Region 1',reportingPeriod:'September'});
 check('server overrides logger division with designated personnel division',(await find(regular)).division==='CMED');
 const ctx=vm.createContext({console});vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/engine.js'),'utf8'),ctx);ctx.S=(await state());ctx.S.holidays=[];ctx.ENGINE.rebuildHS();
 ctx.S.refs.doc.push({name:'Long reporting deadline',threshold:25,basis:'reporting_period',unit:'working_days',active:true});
 const due=ctx.ENGINE.computeDeadline({docType:'Long reporting deadline',reportingPeriod:'January',at:new Date(2026,1,10)});
 check('large ordinary threshold stays on a working day',due.dueAt==='2026-03-06'&&ctx.ENGINE.isWork(ctx.ENGINE.parseD(due.dueAt)));
 check('ordinary and recurring reports use the same overflow',due.dueAt===ctx.ENGINE.srDeadline(1,2026,25).dueAt);
 ctx.S.users.find(u=>u.id==='cabrera').active=false;const engineCount=ctx.S.docs.length,sequence=JSON.stringify(ctx.S.seq);
 check('legacy inactive focal cannot receive new forwarded work',!ctx.ENGINE.logDoc({commType:'Letter',source:'Office',subject:'Must reject',docType:'External Communication',division:'CMED'},'sysadmin',new Date(),true).ok);
 check('rejected registration creates no record or sequence',ctx.S.docs.length===engineCount&&JSON.stringify(ctx.S.seq)===sequence);
 disk.close();console.log(passed+' passed, 0 failed');
})().catch(e=>{console.error(e);process.exitCode=1;});
