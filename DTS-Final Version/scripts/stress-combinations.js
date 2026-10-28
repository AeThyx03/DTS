'use strict';
// Exhaust the current finite reference/assignment dimensions without storing millions of fixtures.
const fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {engine}=require('./stress-fixtures');
function run({fixture,root,dir,check,log}) {
  const db=new DatabaseSync(fixture.file,{readOnly:true});let state;
  try{state={users:db.prepare('SELECT j FROM users').all().map(r=>JSON.parse(r.j)),docs:[],audit:[],seq:{}};for(const row of db.prepare('SELECT k,v FROM kv').all())state[row.k]=JSON.parse(row.v);}finally{db.close();}
  const ctx=engine(root,state),E=ctx.ENGINE,workers=state.users.filter(u=>u.active&&['staff','supervisor','focal'].includes(u.role)),admin=state.users.find(u=>u.id===fixture.admin.id);
  const comms=E.activeCommTypes().map(E.commName),types=E.activeDocTypes(),transactions=state.refs.tx;
  const dimensions={documentTypes:types.map(t=>t.name),communicationTypes:comms,transactions:transactions.map(t=>t.name),divisions:state.divisions.map(d=>d.code),assignees:workers.map(u=>u.id),priorities:['Normal','Urgent'],reportingMonths:E.MONTHS};
  const summary={dimensions,attempts:0,accepted:0,expectedRejections:0,failures:[],byDocumentType:{}};
  const now=new Date(),due=new Date(now);due.setDate(due.getDate()+90);
  const regions=state.designations.filter(d=>workers.some(u=>u.id===d.staff));
  function record(type,expected,r) {
    summary.attempts++;const row=summary.byDocumentType[type]??={attempts:0,accepted:0,rejected:0};row.attempts++;
    if(r.ok){summary.accepted++;row.accepted++;}else{summary.expectedRejections++;row.rejected++;}
    if(r.ok!==expected&&summary.failures.length<100)summary.failures.push({type,expectedAccepted:expected,error:r.error||'Unexpected acceptance'});
  }
  for(const type of types)for(const comm of comms)for(const division of state.divisions)for(const priority of dimensions.priorities) {
    if(E.isRegularDoc(type.name)) {
      for(const region of regions)for(const month of E.MONTHS) {
        state.docs=[];state.seq={};const r=E.logDoc({subject:'STRESS parameter matrix',source:'Stress Office',commType:comm,docType:type.name,division:division.code,priority,region:region.name,reportingPeriod:month},admin.id,now,false);
        record(type.name,true,r);
      }
    }else for(const tx of transactions)for(const assignee of workers) {
      state.docs=[];state.seq={};const r=E.logDoc({subject:'STRESS parameter matrix',source:'Stress Office',commType:comm,docType:type.name,division:division.code,priority},admin.id,now,false);
      if(!r.ok){record(type.name,true,r);continue;}
      const forwarded=E.act(r.doc.id,admin.id,'forward',{},now);
      if(!forwarded.ok){record(type.name,!!state.users.find(u=>u.id===division.focal&&u.active),forwarded);continue;}
      const result=E.act(r.doc.id,admin.id,'assign',{docType:type.name,txType:tx.name,assignee:assignee.id,dueDate:E.isoD(due)},now);
      const allowed=tx.name!=='For information only'||assignee.role==='focal'||E.isDivFocal(assignee);
      record(type.name,allowed,result);
    }
  }
  check('Finite reference and assignment combinations',summary.failures.length===0,JSON.stringify(summary.failures.slice(0,5)));
  fs.writeFileSync(path.join(dir,'parameter-combinations.json'),JSON.stringify(summary,null,2));
  log('Reference / assignment combinations: '+summary.attempts+' attempts; '+summary.failures.length+' unexpected outcomes.');
  return summary;
}
module.exports={run};
