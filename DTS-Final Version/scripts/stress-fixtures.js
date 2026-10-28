'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const PASSWORD = 'Stress@3500!';
const ACTIONS = ['forward','assign','reassign','submit','sup_return','sup_approve','div_return','div_approve','dept_return','dept_clear','instruct_return','logout','comment','edit','delete','set_urls'];
const clone = value => JSON.parse(JSON.stringify(value));
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ident = name => '"' + name.replace(/"/g, '""') + '"';
function fingerprints(db) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  return Object.fromEntries(tables.filter(row => !['sessions','audit'].includes(row.name)).map(({name}) => {
    const rows = db.prepare('SELECT * FROM ' + ident(name)).all().map(row => {
      // A concurrent real sign-in may legitimately update lastLogin.
      if (name === 'users') { const u = JSON.parse(row.j); delete u.lastLogin; row.j = JSON.stringify(u); }
      return JSON.stringify(Object.fromEntries(Object.keys(row).sort().map(key => [key,row[key]])));
    }).sort();
    return [name, { count: rows.length, sha256: digest(rows) }];
  }));
}
function sourceFingerprint(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try { db.exec('BEGIN'); const result = fingerprints(db); db.exec('ROLLBACK'); return result; }
  finally { db.close(); }
}
function engine(root, state) {
  const ctx = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(path.join(root,'public/engine.js'),'utf8'),ctx);
  ctx.S = state; ctx.ENGINE.rebuildHS(); return ctx;
}
function prepare({root, dir, source, documents, schedules, reports, log}) {
  const file = path.join(dir,'data','dts.sqlite');
  fs.mkdirSync(path.dirname(file), {recursive:true});
  assert.ok(!fs.existsSync(file),'A stress run must use a new database.');
  const live = new DatabaseSync(source,{readOnly:true});
  try { live.exec("VACUUM INTO '" + file.replace(/'/g,"''") + "'"); } finally { live.close(); }
  const db = new DatabaseSync(file);
  let result;
  try {
    const sourceBefore = fingerprints(db);
    const state = { v:1, docs:[], schedules:[], spConfigs:[], spItems:[], audit:[], users:db.prepare('SELECT j FROM users').all().map(r=>JSON.parse(r.j)) };
    for (const row of db.prepare('SELECT k,v FROM kv').all()) state[row.k] = JSON.parse(row.v);
    const ctx = engine(root,state), E = ctx.ENGINE, defaults = E.baseState();
    for (const key of ['refs','settings','perms','divisions','designations','holidays','oic','leaveTypes']) state[key] ??= defaults[key];
    E.migrateState(); E.rebuildHS(); state.seq = {};
    const active = state.users.filter(u=>u.active), admin = active.find(u=>u.role==='sysadmin');
    assert.ok(admin,'At least one enrolled active System Administrator is required.');
    const workers = active.filter(u=>['staff','supervisor','focal'].includes(u.role));
    assert.ok(workers.length,'No active enrolled processing staff found.');
    const depts = state.divisions.filter(d=>active.some(u=>u.id===d.focal));
    assert.ok(depts.length,'No configured division has an active enrolled focal.');
    state.settings.orgName = '[STRESS TEST :3500] ' + (state.settings.orgName || 'DTS');
    state.settings.idleMinutes = 240;
    const now = new Date(), today = new Date(now.getFullYear(),now.getMonth(),now.getDate(),8);
    const iso = date => E.isoD(date), day = (offset,hour=8) => { const d=new Date(today); d.setDate(d.getDate()+offset); d.setHours(hour,0,0,0); return d; };
    const stamp = now.toISOString();
    const calendarType = '[STRESS] Calendar deadline', noDeadline = '[STRESS] No deadline';
    state.refs.doc.push({name:calendarType,description:'Synthetic stress fixture only',threshold:3,unit:'calendar_days',basis:'calendar_days',active:true,createdAt:stamp,updatedAt:stamp},
      {name:noDeadline,description:'Synthetic stress fixture only',threshold:null,unit:'working_days',basis:'working_days',active:true,createdAt:stamp,updatedAt:stamp});
    const tx = state.refs.tx.find(t=>t.days&&!t.special&&t.name!=='For information only') || state.refs.tx.find(t=>!t.special&&t.name!=='For information only');
    assert.ok(tx,'A non-special processing transaction type is required.');
    const comms = E.activeCommTypes().map(E.commName); assert.ok(comms.length,'No active communication type.');
    const baseTypes = E.activeDocTypes().filter(t=>!E.isRegularDoc(t.name)&&![calendarType,noDeadline].includes(t.name));
    const logger = active.find(u=>E.has(u,'doc.log')&&E.has(u,'doc.forward')&&u.role!=='sysadmin') || admin;
    const roleFallbacks = {};
    function perform(doc,type,payload,at,preferred) {
      const eligible = active.filter(u=>E.can(u,doc,type,true));
      const who = eligible.find(u=>u.id===preferred) || eligible.find(u=>u.role!=='sysadmin') || admin;
      if (who.id===admin.id) roleFallbacks[type]=(roleFallbacks[type]||0)+1;
      const r = E.act(doc.id,who.id,type,payload||{},at);
      assert.ok(r.ok,type+': '+r.error); return who;
    }
    const templates = new Map(), distribution = {statuses:{},deadlines:{},dueToday:0,dueSoon:0,assignedStaff:{},documentTypes:{},transactions:{}};
    function build(i,target) {
      const div = depts[i%depts.length];
      const pool = workers.filter(u=>u.division===div.code), worker = (pool.length?pool:workers)[Math.floor(i/depts.length)%(pool.length||workers.length)];
      const reviewer = active.find(u=>u.id===div.focal&&u.id!==worker.id) || active.find(u=>u.id!==worker.id&&['supervisor','focal','div_manager','dept_manager'].includes(u.role));
      assert.ok(reviewer,'A reviewer other than the assignee is required.');
      const group = Math.floor(i/10)%6, stopped = ['cleared','return_out','out'].includes(target);
      const dueOffset = stopped?-20:group===0?14:group===1?1:group===2?0:group===3?-10:7;
      let start = day(dueOffset-3), type = group===4?noDeadline:group===5&&baseTypes.length?baseTypes[i%baseTypes.length].name:calendarType;
      if(stopped)type=calendarType;
      const usable = state.designations.filter(d=>workers.some(u=>u.id===d.staff));
      const regular = E.activeDocTypes().find(t=>E.isRegularDoc(t.name));
      const useRegular = i%23===0&&regular&&usable.length&&!['received','at_focal'].includes(target);
      const region = useRegular?usable[i%usable.length].name:'';
      if(useRegular) { type=regular.name; start=day(-60-i%300); }
      const rec = {commType:comms[i%comms.length],source:'STRESS Office '+(i%32+1),subject:'STRESS '+String(i+1).padStart(6,'0')+' | '+target+' | '+worker.name+(i%71===0?' | Ñ / 中文 / long subject '.repeat(6):''),refNo:'STRESS-'+String(i+1).padStart(6,'0'),docType:type,division:div.code,priority:i%3===0?'Urgent':'Normal',pages:String(i%60+1),remarks:'Synthetic record. Current enrolled accounts; isolated test database.',region,reportingPeriod:useRegular?E.MONTHS[new Date(start.getFullYear(),start.getMonth()-1,1).getMonth()]:''};
      const r = E.logDoc(rec,logger.id,start,false); assert.ok(r.ok,'Log fixture: '+r.error); const doc=r.doc;
      let tick=0; const at=()=>new Date(start.getTime()+(++tick)*60000);
      if(!useRegular&&target!=='received')perform(doc,'forward',{},at(),logger.id);
      if(!useRegular&&!['received','at_focal'].includes(target))perform(doc,'assign',{txType:group===4?(noneTx||state.refs.tx.at(-1)).name:tx.name,docType:type,assignee:worker.id},at(),div.focal);
      if(!['received','at_focal','processing'].includes(target)) {
        const chosen = active.find(u=>u.id!==doc.assignee&&u.id===reviewer.id) || active.find(u=>u.id!==doc.assignee&&['supervisor','focal','div_manager','dept_manager'].includes(u.role));
        perform(doc,'submit',{reviewer:chosen.id,text:'Stress draft submitted'},at(),doc.assignee);
        if(target==='compliance') {
          const level = Math.floor(i/10)%3;
          if(level>=1)perform(doc,'sup_approve',{},at(),doc.reviewer);
          if(level===2)perform(doc,'div_approve',{},at());
          perform(doc,['sup_return','div_return','dept_return'][level],{text:'Stress compliance request'},at());
        } else if(['div_review','dept_review','cleared','return_out','out'].includes(target)) {
          perform(doc,'sup_approve',{},at(),doc.reviewer);
          if(['dept_review','cleared','return_out','out'].includes(target))perform(doc,'div_approve',{},at());
          if(stopped) {
            const stop = doc.dueAt?new Date(E.parseD(doc.dueAt).getTime()+(Math.floor(i/10)%2?5:-1)*86400000+10*3600000):at();
            if(stop<at())stop.setTime(start.getTime()+86400000);
            perform(doc,target==='return_out'||(target==='out'&&i%20===9)?'instruct_return':'dept_clear',{text:'Stress clearance / return instruction'},stop);
            if(target==='out')perform(doc,'logout',{outTo:'STRESS Records Office',remarks:'Synthetic release'},new Date(stop.getTime()+3600000),logger.id);
          }
        }
      }
      assert.equal(doc.status,target);
      assert.ok(doc.history.every((h,j)=>!j||h.at>=doc.history[j-1].at),'Non-chronological seed history');
      return doc;
    }
    // A no-deadline transaction is needed to distinguish no deadline from pending.
    const noneTx = state.refs.tx.find(t=>!t.days&&!t.special&&t.name!=='For information only');
    if(!noneTx)state.refs.tx.push({name:'[STRESS] No deadline transaction',days:null,special:false});
    const stages = Object.keys(E.STAGES);
    for(let i=0;i<documents;i++) {
      // Assignment always needs a known transaction; no-deadline fixtures use a dedicated transaction below.
      const doc=build(i,stages[i%stages.length]);
      if(!templates.has(doc.status)&&doc.docType===calendarType)templates.set(doc.status,clone(doc));
      const deadline=E.dl(doc);distribution.statuses[doc.status]=(distribution.statuses[doc.status]||0)+1;
      distribution.deadlines[deadline.key]=(distribution.deadlines[deadline.key]||0)+1;
      if(!doc.stopAt&&doc.dueAt===iso(today))distribution.dueToday++;
      if(deadline.key==='soon'&&doc.dueAt>iso(today))distribution.dueSoon++;
      if(doc.assignee)distribution.assignedStaff[doc.assignee]=(distribution.assignedStaff[doc.assignee]||0)+1;
      distribution.documentTypes[doc.docType]=(distribution.documentTypes[doc.docType]||0)+1;
      if(doc.txType)distribution.transactions[doc.txType]=(distribution.transactions[doc.txType]||0)+1;
    }
    for(const stage of stages)assert.ok(distribution.statuses[stage]>0,'Missing stage: '+stage);
    for(const key of ['pending','none','ok','soon','over','done_ok','done_late'])assert.ok(distribution.deadlines[key]>0,'Missing deadline state: '+key);
    assert.ok(distribution.dueToday&&distribution.dueSoon,'Due-today and due-soon fixtures are required.');
    log('Generated '+documents+' documents through the workflow engine.');
    // Isolated copies make each user/stage/action attempt independent of earlier probes.
    const matrix = [];
    for(const user of active)for(const stage of stages)for(const action of ACTIONS) {
      const doc=clone(templates.get(stage)); assert.ok(doc,'Missing matrix template: '+stage);
      doc.id=crypto.randomBytes(12).toString('hex');doc.trackNo='PROBE-'+doc.id;doc.refNo='PROBE-'+doc.id;
      const alternate=workers.find(u=>u.id!==doc.assignee)||workers[0];
      const payload={text:'Stress matrix comment / compliance',note:'Stress reassignment',outTo:'Stress recipient',reviewer:doc.reviewer||active.find(u=>u.id!==doc.assignee&&['focal','supervisor','div_manager','dept_manager'].includes(u.role)).id,assignee:action==='reassign'?alternate.id:workers[0].id,txType:tx.name,docType:calendarType,subject:'Stress metadata edit',url:'https://example.com/stress/original',draftUrl:'https://example.com/stress/draft',revUrl:'https://example.com/stress/revised'};
      state.docs.push(doc);
      const model=clone(doc), at=new Date();state.docs[state.docs.length-1]=model;
      const expected=E.act(model.id,user.id,action,clone(payload),at);
      // Restore the untouched probe even for model deletes.
      if(expected.deleted)state.docs.push(doc);else state.docs[state.docs.length-1]=doc;
      matrix.push({id:doc.id,userId:user.id,stage,action,payload,expectedOK:expected.ok,expectedError:expected.error||'',expected:expected.ok&&!expected.deleted?Object.fromEntries(['status','assignee','reviewer','cycles','source','subject','url','draftUrl','revUrl','outType'].map(k=>[k,model[k]??null])):null,original:doc});
    }
    const enrollment=state.users.map(({id,name,username,role,division,active})=>({id,name,username,role,division,active}));
    const people=active.filter(u=>u.role!=='sysadmin'), leaveTypes=state.leaveTypes.filter(t=>t.active!==false);
    assert.ok(leaveTypes.length,'At least one active leave type is required.');
    for(let i=0;i<schedules;i++) {
      const type=['inspection','leave','meeting'][i%3],person=people[i%people.length],start=day(i<100?0:i%730-365),end=new Date(start);end.setDate(end.getDate()+i%4);
      state.schedules.push({id:'stress-schedule-'+i,type,title:'STRESS '+type+' '+i,project:type==='inspection'?'STRESS Project '+i%30:'',location:'Stress site '+i%15,remarks:'Synthetic schedule',link:type==='meeting'?'https://example.com/stress-meeting':'',organizer:type==='meeting'?person.id:'',personnel:type==='leave'?[person.id]:[...new Set([person.id,people[(i+1)%people.length].id])],leaveTypeId:type==='leave'?leaveTypes[Math.floor(i/3)%leaveTypes.length].id:'',startDate:iso(start),endDate:iso(end),startTime:type==='leave'?'':'08:00',endTime:type==='leave'?'':'17:00',createdBy:admin.id,createdAt:stamp,updatedBy:admin.id,updatedAt:stamp});
    }
    // Separate synthetic schedules prevent the copied live recurring configuration from creating real-looking obligations.
    const cfgs=Array.from({length:12},(_,i)=>({id:'stress-cfg-'+i,name:'STRESS Report '+i,frequency:'monthly',months:[1,2,3,4,5,6,7,8,9,10,11,12],threshold:3+i%25,basis:'working_days',assignUsers:[people[i%people.length].id],assignDivisions:[],docType:'',fromPeriod:'2020-01',generationDay:1,active:false,createdBy:admin.id,createdAt:stamp,updatedBy:admin.id,updatedAt:stamp,issue:null}));
    state.spConfigs=cfgs;
    const reportStages=['processing','compliance','sup_review','div_review','dept_review','cleared','return_out','out'];
    for(let i=0;i<reports;i++) {
      const template=clone(templates.get(reportStages[i%reportStages.length]));const id='stress-report-'+i,cfg=cfgs[i%cfgs.length],period=new Date(today.getFullYear(),today.getMonth()-1-Math.floor(i/cfgs.length),1),person=workers[i%workers.length];
      const generated=new Date(period.getFullYear(),period.getMonth()+1,1,8),deadline=E.srDeadline(period.getMonth()+1,period.getFullYear(),cfg.threshold),shift=generated-new Date(template.receivedAt);
      const shifted=value=>value?new Date(new Date(value).getTime()+shift).toISOString():value;
      for(const key of ['receivedAt','clockStart','stageEnteredAt','stopAt','clearedAt','outAt'])if(template[key])template[key]=shifted(template[key]);
      for(const h of template.history)h.at=shifted(h.at);
      for(const c of template.comments){c.at=shifted(c.at);if(c.resolvedAt)c.resolvedAt=shifted(c.resolvedAt);}
      template.dueAt=deadline.dueAt;template.deadlineLabel=deadline.label;
      if(template.stopAt) {
        const stop=new Date(E.parseD(deadline.dueAt));stop.setDate(stop.getDate()+(i%2?5:-1));stop.setHours(10);
        template.stopAt=stop.toISOString();if(template.clearedAt)template.clearedAt=template.stopAt;
        const last=template.history.at(-1);last.at=template.stopAt;
        if(template.status==='out'){template.outAt=new Date(stop.getTime()+3600000).toISOString();last.at=template.outAt;template.history.at(-2).at=template.stopAt;}
        template.stageEnteredAt=last.at;
      }
      const assigned=[person];
      if(i%5===0){const extra=workers.find(u=>u.id!==person.id&&(i%10===0?u.division!==person.division:u.division===person.division));if(extra)assigned.push(extra);}
      const mixed=new Set(assigned.map(u=>u.division)).size>1;
      template.assignee=template.status==='processing'?'':person.id;template.division=mixed?'':person.division||depts[0].code;
      state.spItems.push({id,cfgId:cfg.id,name:cfg.name,frequency:cfg.frequency,threshold:cfg.threshold,basis:'working_days',docType:'',year:period.getFullYear(),month:period.getMonth()+1,periodLabel:E.MONTHS[period.getMonth()]+' '+period.getFullYear(),title:'STRESS Special Report '+i,genDate:iso(generated),generatedAt:generated.toISOString(),clockStart:generated.toISOString(),dueAt:deadline.dueAt,dueLabel:deadline.label,status:template.status==='out'?'completed':'pending',stopAt:template.status==='out'?template.outAt:null,completedBy:template.outBy||'',completionNote:'',createdBy:'System',division:template.division,url:'',workflow:template,assign:assigned.map((u,j)=>({id:'stress-assignment-'+i+'-'+j,itemId:id,userId:u.id,status:template.status==='out'?'closed':'active',assignedAt:generated.toISOString(),assignedBy:admin.id,endedAt:template.status==='out'?template.outAt:null,endedBy:template.outBy||'',note:'Synthetic assignment'}))});
    }
    // Password changes and synthetic records are written only to this new isolated copy.
    db.exec('PRAGMA foreign_keys=ON; BEGIN');
    try {
      for(const table of ['sessions','docs','schedules','sr_assign','sr_item','sr_config','audit','workflow_history','workflow_instances'])db.exec('DELETE FROM '+ident(table));
      const putUser=db.prepare('UPDATE users SET j=? WHERE id=?');
      for(const user of state.users) {
        const salt=crypto.randomBytes(16);user.pw='scrypt$'+salt.toString('hex')+'$'+crypto.scryptSync(PASSWORD,salt,64,{N:16384,r:8,p:1}).toString('hex');user.mustChange=false;user.lastLogin=null;
        putUser.run(JSON.stringify(user),user.id);
      }
      const putKV=db.prepare('INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v');
      for(const key of ['perms','divisions','refs','designations','holidays','oic','settings','seq','leaveTypes'])putKV.run(key,JSON.stringify(state[key]));
      putKV.run('spSeeded','1');
      const putDoc=db.prepare('INSERT INTO docs(id,j) VALUES(?,?)');state.docs.forEach(doc=>putDoc.run(doc.id,JSON.stringify(doc)));
      const putSched=db.prepare('INSERT INTO schedules(id,j) VALUES(?,?)');state.schedules.forEach(s=>putSched.run(s.id,JSON.stringify(s)));
      const putCfg=db.prepare('INSERT INTO sr_config(id,j) VALUES(?,?)');cfgs.forEach(c=>putCfg.run(c.id,JSON.stringify(c)));
      const putItem=db.prepare('INSERT INTO sr_item(id,cfg_id,yr,mo,j) VALUES(?,?,?,?,?)'),putAssign=db.prepare('INSERT INTO sr_assign(id,item_id,user_id,status,j) VALUES(?,?,?,?,?)');
      state.spItems.forEach(item=>{const row=clone(item);delete row.assign;putItem.run(item.id,item.cfgId,item.year,item.month,JSON.stringify(row));item.assign.forEach(a=>putAssign.run(a.id,a.itemId,a.userId,a.status,JSON.stringify(a)));});
      const putAudit=db.prepare('INSERT INTO audit(at,by,action,detail) VALUES(?,?,?,?)');
      for(const doc of state.docs.slice(0,documents))for(const h of doc.history)putAudit.run(h.at,h.by,h.action,doc.trackNo+' | synthetic movement');
      db.exec('COMMIT');
    } catch(error){db.exec('ROLLBACK');throw error;}
    db.exec('VACUUM');
    result={file,source,sourceBefore,admin:enrollment.find(u=>u.id===admin.id),enrollment,workers:workers.map(u=>u.id),documents,schedules,reports,distribution,roleFallbacks,matrix,calendarType,commType:comms[0],division:depts[0].code,txType:tx.name};
    fs.writeFileSync(path.join(dir,'dataset.json'),JSON.stringify({...result,matrix:undefined,sourceBefore:undefined,password:undefined},null,2));
    fs.writeFileSync(path.join(dir,'matrix-plan.json'),JSON.stringify(matrix.map(({original,...row})=>row),null,2));
    log('Prepared '+matrix.length+' independent user / status / action probes.');
  } finally {db.close();}
  return result;
}
module.exports={prepare,sourceFingerprint,PASSWORD,ACTIONS,engine,clone};
