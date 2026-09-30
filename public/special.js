'use strict';
/* =====================  SPECIAL REPORTS (Phase 11) – browser side  =====================
   Mandatory recurring reports that the SERVER creates on a schedule. This file only DISPLAYS and SENDS:
   the server decides what is owed, calculates deadlines, assigns people and checks every request.
   Who sees a report in For My Action is decided by the assignment records the server sends (item.assign),
   never by names or by the report's title. Deadlines and status use the same engine.js functions as documents.
   Loaded before client.js; nothing here touches VIEWS / ACTIONS until spInstall() runs. */

const SP={tab:'sched',dtab:'pending',dshow:false,fStatus:'',fCfg:'',reassign:null};
const spItems=()=>(S&&S.spItems)||[];
const spCfgs=()=>(S&&S.spConfigs)||[];
const spCan=()=>{const u=ME();return !!u&&has(u,'config.manage');};
const spMine=u=>u?spItems().filter(i=>srIsMine(i,u.id)).sort(spByDue):[];
const spByDue=(a,b)=>String(a.dueAt).localeCompare(String(b.dueAt))||String(a.title).localeCompare(String(b.title));
const spLong=d=>d?parseD(d).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}):'—';
const spWho=i=>{const a=srActiveAssign(i);return a.length?a.map(x=>uname(x.userId)).join(', '):(i.workflow&&i.workflow.assignee?uname(i.workflow.assignee):(i.status==='completed'?uname(i.completedBy):'—'));};
const spCfgWho=c=>{const p=(c.assignUsers||[]).map(uname).concat((c.assignDivisions||[]).map(d=>{const dv=divOf(d);return 'Focal of '+d+(dv&&dv.focal?' ('+uname(dv.focal)+')':'');}));return p.length?p.join(', '):'';};
const spChip=i=>{const x=srStatus(i);return badge(x.tone,x.chip);};
const spTag='<span class="sr-tag">Special Report</span>';
const spActiveUsers=()=>S.users.filter(x=>x.active&&x.role!=='sysadmin').sort((a,b)=>a.name.localeCompare(b.name));

/* one report as a card; "where" is 'dash' (shows Assigned To and Generated) or 'action' */
function spCard(i,where,u){
 const x=srStatus(i),mine=srIsMine(i,u.id);
 const f=(l,v)=>`<div><dt>${l}</dt><dd>${v}</dd></div>`;
 return `<article class="sr-item${x.key==='over'?' sr-over':''}" data-sr="${esc(i.id)}">
 <div class="sr-top">${spTag}${spChip(i)}${i.status==='pending'&&x.key!=='over'?'':''}</div>
 <h3 class="sr-title">${esc(i.title)}</h3>
 <dl class="sr-facts">${f('Reporting period',esc(i.periodLabel))}${where==='dash'?f('Assigned to',esc(spWho(i))):''}${where==='dash'?f('Generated',esc(spLong(i.genDate))):''}${f('Deadline',esc(spLong(i.dueAt))+'<small>'+esc(i.dueLabel)+'</small>')}${f(i.status==='completed'?'Completed':'Days remaining',i.status==='completed'?esc(fmtD(i.stopAt))+'<small>'+esc(x.label)+'</small>':esc(x.days))}</dl>
 <div class="sr-act"><button class="btn ${mine?'primary':''} sm" data-act="spOpen" data-id="${esc(i.id)}">${mine?(where==='dash'?'View / Action':'Action'):'View'}</button></div>
 </article>`;
}

/* Special Reports use their own lifecycle: the system generates the item, assigns it, then a responsible
   person completes it. Keep the same progress-card treatment as document lifecycle cards. */
function spLifecycle(i){
 const w=i.workflow||{},st=w.status||(i.status==='completed'?'out':'processing');
 const assignedIds=w.assignee?[w.assignee]:srActiveAssign(i).map(a=>a.userId);
 const focalOnly=assignedIds.length>0&&assignedIds.every(id=>{const u=S.users.find(x=>x.id===id);return !!u&&u.role==='focal';});
 const labels=focalOnly?['Generated','Assigned','Division','Dept. Manager','Cleared','Out']:['Generated','Assigned','Supervisor','Division','Dept. Manager','Cleared','Out'];
 const stage=focalOnly?{processing:1,compliance:1,sup_review:1,div_review:2,dept_review:3,cleared:4,return_out:4,out:5}:{processing:1,compliance:1,sup_review:2,div_review:3,dept_review:4,cleared:5,return_out:5,out:6};
 const last=labels.length-1,idx=stage[st]===undefined?1:stage[st],done=st==='out'||i.status==='completed',cur=done?last:idx,pct=Math.round(cur/last*100),tone=done?'ok':st==='compliance'?'pur':'info';
 const whenAt=v=>fmtD(v)+', '+fmtT(v),history=w.history||[];
 const lastAt=code=>{const h=history.slice().reverse().find(x=>x.to===code);return h?whenAt(h.at):'';};
 const assigned=(i.assign||[]).map(a=>a.assignedAt).filter(Boolean).sort()[0]||i.generatedAt;
 const allTimes=[i.generatedAt?whenAt(i.generatedAt):spLong(i.genDate),lastAt('processing')||whenAt(assigned),lastAt('sup_review'),lastAt('div_review'),lastAt('dept_review'),lastAt(st==='return_out'?'return_out':'cleared'),lastAt('out')];
 const times=focalOnly?[allTimes[0],allTimes[1],allTimes[3],allTimes[4],allTimes[5],allTimes[6]]:allTimes;
 if(done&&i.stopAt)times[last]=whenAt(i.stopAt)+' · '+uname(i.completedBy||w.outBy||'');
 const steps=labels.map((label,n)=>{
  const state=n<cur?'done':n===cur?(done?'done':'now'):'todo';
  const when=times[n]||(n<cur?'Completed':n===cur?'Current':'Pending');
  return `<li class="${state}"><i></i><b>${label}</b><span>${esc(when)}</span></li>`;
 });
 const chip=st==='out'?'Out':st==='cleared'?'Cleared':st==='return_out'?'For return':st==='dept_review'?'Department Manager':st==='div_review'?'Division':st==='sup_review'?(focalOnly?'Focal review':'Supervisor'):st==='compliance'?'Returned for compliance':'Assigned';
 return `<div class="card pad lcc ring-${done?'ok':st==='compliance'?'pur':'warn'}"><div class="row sp"><div class="row"><h3>Lifecycle progress</h3><span class="badge b-${tone}">${chip}</span></div><div class="lc-pct big">${pct}%</div></div><ol class="lcf sr-lifecycle">${steps.join('')}</ol><p class="small muted" style="margin:10px 0 0">${done?'This Special Report has completed its review and has been logged out.':'Generated automatically and assigned to '+esc(spWho(i))+'.'}</p></div>`;
}

/* Dashboard: every generated report, pending first */
function spDashHTML(u){
 const all=spItems();if(!all.length)return '';
 const pend=all.filter(i=>i.status==='pending').sort(spByDue),done=all.filter(i=>i.status==='completed').sort((a,b)=>String(b.stopAt).localeCompare(String(a.stopAt)));
 const tab=SP.dtab,list=tab==='pending'?pend:tab==='done'?done:pend.concat(done),limit=SP.dshow?list.length:6,mineN=spMine(u).length;
 const tb=(k,l,n)=>`<button class="tab" role="tab" data-act="spDashTab" data-k="${k}" aria-selected="${tab===k}">${l}<span class="badge b-neu">${n}</span></button>`;
 return `<section class="card sr-dash" aria-label="Special Reports"><div class="ch"><div><h2>Special Reports</h2><p class="hint" style="margin:2px 0 0">Created automatically by the system on a schedule${mineN?' · '+mineN+' assigned to you':''}</p></div></div>
 <div class="tabs" role="tablist" style="padding:0 14px;margin:0">${tb('pending','Pending',pend.length)}${tb('done','Completed',done.length)}${tb('all','All',all.length)}</div>
 <div class="sr-list">${list.length?list.slice(0,limit).map(i=>spCard(i,'dash',u)).join(''):'<div class="empty"><b>Nothing here.</b>'+(tab==='pending'?'No Special Report is pending.':'No Special Report has been completed yet.')+'</div>'}</div>
 ${list.length>6?`<div class="sr-more"><button class="btn sm" data-act="spDashMore">${SP.dshow?'Show fewer':'Show all '+list.length}</button></div>`:''}</section>`;
}
/* For My Action: only the reports with an active assignment for this user */
function spActionHTML(u){
 const list=spMine(u);if(!list.length)return '';
 return `<section class="sr-action" aria-label="Special Reports for my action"><div class="row sp" style="margin:0 0 8px"><h2 style="font-size:16px">Special Reports <span class="badge b-pur">${list.length}</span></h2><span class="hint">Forward reports for review, respond to remarks, and log them out by their deadlines.</span></div><div class="sr-list">${list.map(i=>spCard(i,'action',u)).join('')}</div></section>`;
}

/* ---------- one report: details, completion, reassignment ---------- */
function spWorkflowDoc(i,u){
 const w=i.workflow||{},active=srActiveAssign(i),mine=active.some(a=>a.userId===u.id),assignee=w.assignee||(w.status==='processing'&&mine?u.id:(active[0]||{}).userId)||'';
 return Object.assign({},i,{id:i.id,trackNo:'SR-'+i.year+'-'+String(i.month).padStart(2,'0'),receivedAt:i.generatedAt||i.clockStart,commType:'Special Report',source:'System generated',refNo:'',subject:i.title,docType:'Special Report',division:w.division||i.division||(S.users.find(x=>x.id===assignee)||{}).division||'',pages:'',priority:'Normal',region:'',reportingPeriod:i.periodLabel,remarks:'',txType:'Special Report',dueAt:i.dueAt,clockStart:i.clockStart,stopAt:w.stopAt||null,status:w.status||(i.status==='completed'?'out':'processing'),stageEnteredAt:w.stageEnteredAt||i.generatedAt,assignee:assignee,assignedBy:w.assignedBy||'System',reviewer:w.reviewer||'',createdBy:'System',history:w.history||[],comments:w.comments||[],cycles:w.cycles||0,returnedFrom:w.returnedFrom||null,clearedBy:w.clearedBy||'',clearedTier:w.clearedTier||'',outBy:w.outBy||'',outTo:w.outTo||'',outType:w.outType||'',outRemarks:w.outRemarks||''});
}
function spActionPanel(i,u){
 const d=spWorkflowDoc(i,u);
 return actionPanel(d,u,{special:true,strict:true}).replaceAll('data-act="doSubmit"','data-act="spDoSubmit"').replaceAll('data-act="doReview"','data-act="spDoReview"').replaceAll('data-act="doLogout"','data-act="spDoLogout"');
}
function spDetail(id){
 const i=spItems().find(x=>x.id===id),u=ME();if(!i)return;
 const x=srStatus(i),admin=spCan()&&i.status==='pending'&&(!i.workflow||i.workflow.status==='processing')&&!(i.workflow&&i.workflow.assignee);
 const wd=spWorkflowDoc(i,u),noteBox=has(u,'doc.comment')?'<div data-panel class="row" style="align-items:flex-start;margin-bottom:12px"><textarea name="text" rows="2" placeholder="Add a remark to the workflow history" style="flex:1;min-width:200px"></textarea><button class="btn" data-act="spDoNote" data-id="'+esc(i.id)+'">Add remark</button></div>':'';
 const urlEditable=spCan()||i.assign.some(a=>a.userId===u.id&&(a.status==='active'||a.status==='completed'));
 const stLbl={active:'Assigned',completed:'Completed it',closed:'Closed (completed by someone else)',reassigned:'Reassigned'};
 const hist=i.assign.map(a=>`<tr><td>${esc(uname(a.userId))}</td><td>${badge(a.status==='active'?'info':a.status==='completed'?'ok':'neu',stLbl[a.status]||a.status)}</td><td class="nowrap">${fmtDT(a.assignedAt)}</td><td>${a.endedAt?fmtDT(a.endedAt)+(a.endedBy&&a.endedBy!==a.userId?' by '+esc(uname(a.endedBy)):''):'—'}</td></tr>`).join('');
 const body=`<div class="sr-detail">${spTag} ${spChip(i)}<h3 style="margin:8px 0 12px">${esc(i.title)}</h3>${spLifecycle(i)}
 <dl class="dl"><dt>Reporting period</dt><dd>${esc(i.periodLabel)}</dd><dt>Assigned to</dt><dd>${esc(spWho(i))}</dd><dt>Generated</dt><dd>${esc(spLong(i.genDate))} (by the system)</dd><dt>Deadline</dt><dd>${esc(spLong(i.dueAt))}<br><span class="hint">${esc(i.dueLabel)}. ${esc(i.threshold+' working days; weekends and listed holidays are not counted.')}</span></dd><dt>${i.status==='completed'?'Result':'Days remaining'}</dt><dd>${esc(x.label)}</dd><dt>URL</dt><dd>${i.url?renderUrl(i.url,'Open URL'):'<span class="muted">Not provided</span>'}</dd>${i.status==='completed'?`<dt>Completed</dt><dd>${fmtDT(i.stopAt)} by ${esc(uname(i.completedBy))}${i.completionNote?'<br>'+nl(i.completionNote):''}</dd>`:''}</dl>
 ${urlEditable?`<div class="fld" style="margin-top:12px" data-form="spurl"><label for="sp-url">URL</label><div class="row"><input id="sp-url" name="url" type="url" placeholder="https://" maxlength="2000" value="${esc(i.url||'')}" style="flex:1;min-width:220px"><button class="btn" data-act="spUrlSave" data-id="${esc(i.id)}">Save URL</button></div><p class="hint">Optional. Use an http:// or https:// link. Clear the field and save to remove it.</p></div>`:''}
 <h4 style="margin:14px 0 6px">Review workflow</h4>${spActionPanel(i,u)}<h4 style="margin:14px 0 6px">Remarks and movement</h4>${noteBox}${timeline(wd)}
 <h4 style="margin:14px 0 6px">Assignment history</h4><div class="tw"><table class="tbl"><thead><tr><th>Person</th><th>Status</th><th>Assigned</th><th>Ended</th></tr></thead><tbody>${hist}</tbody></table></div></div>`;
 openModal('Special Report',body,{wide:1,foot:(has(u,'report.print')?`<button class="btn" data-act="printSlip" data-id="sr-${esc(i.id)}">${ic('print')}Print routing slip</button>`:'')+'<button class="btn" data-act="closeModal">Close</button>'+(admin?`<button class="btn" data-act="spReassign" data-id="${esc(i.id)}">Reassign</button>`:'')});
}
function spPicker(selected,name){
 return `<div class="sr-pick" data-pick="${name}">${spActiveUsers().map(x=>`<label class="chk"><input type="checkbox" data-u="${esc(x.id)}"${selected.includes(x.id)?' checked':''}> ${esc(x.name)} <small class="muted">${esc(roleName(x.role))}</small></label>`).join('')}</div>`;
}
const spPicked=root=>$$('input[data-u]:checked',root).map(x=>x.dataset.u);

/* ---------- administrator: Special Reports ---------- */
function spSchedRow(c){
 const who=spCfgWho(c),issue=c.issue&&c.issue.text;
 return `<tr><td class="b">${esc(c.name)}${c.docType?'<div class="hint">Document type: '+esc(c.docType)+'</div>':''}${issue?'<div class="hint" style="color:var(--bad)">Not generated: '+esc(issue)+'</div>':''}</td>
 <td>${esc(srFreqName(c.frequency))}</td><td>${esc(srMonthsLabel(c.months))}</td><td>${esc(c.threshold)} working days</td><td>${esc((SR_BASES.find(b=>b[0]===c.basis)||[0,c.basis])[1])}</td>
 <td>${who?esc(who):badge('warn','Nobody assigned')}</td><td>${c.active?badge('ok','Active'):badge('neu','Inactive')}</td>
 <td class="right nowrap"><button class="btn sm" data-act="spCfgForm" data-id="${esc(c.id)}">Edit</button> <button class="btn sm" data-act="spCfgToggle" data-id="${esc(c.id)}">${c.active?'Deactivate':'Activate'}</button></td></tr>`;
}
function spHolidayWarning(){
 if(!spCfgs().some(c=>c.active))return '';
 const n=new Date(),years=[...new Set([n.getFullYear(),new Date(n.getFullYear(),n.getMonth()+1,1).getFullYear()])].filter(y=>!S.holidays.some(h=>h.date.startsWith(y+'-')));
 return years.length?`<div class="banner warn">${ic('alert')}<div><b>No holidays are listed for ${years.join(' and ')}.</b> Deadlines counted in ${years.length>1?'those years':'that year'} will not skip its public holidays until they are added under Reference lists → Holidays.</div></div>`:'';
}
function spGenRows(list){
 return list.length?list.map(i=>`<tr><td class="b">${esc(i.title)}</td><td>${esc(i.periodLabel)}</td><td>${esc(spWho(i))}</td><td class="nowrap">${esc(fmtD(parseD(i.genDate)))}</td><td class="nowrap">${esc(fmtD(parseD(i.dueAt)))}</td><td>${spChip(i)}</td><td class="right nowrap"><button class="btn sm" data-act="spOpen" data-id="${esc(i.id)}">View</button>${i.status==='pending'&&(!i.workflow||i.workflow.status==='processing')&&!(i.workflow&&i.workflow.assignee)?` <button class="btn sm" data-act="spReassign" data-id="${esc(i.id)}">Reassign</button>`:''}</td></tr>`).join(''):'<tr><td colspan="7"><div class="empty"><b>No Special Reports match.</b>Reports appear here once an active schedule has something due.</div></td></tr>';
}
function spConfigPage(embedded=false){
 const cf=spCfgs(),unassigned=cf.filter(c=>!spCfgWho(c)).length;
 const tab=(k,l)=>`<button class="tab" role="tab" data-act="spTab" data-k="${k}" aria-selected="${SP.tab===k}">${l}</button>`;
 let body;
 if(SP.tab==='sched'){
  body=`${unassigned?`<div class="banner warn">${ic('alert')}<div><b>${unassigned===1?'One schedule has':unassigned+' schedules have'} nobody assigned.</b> A Special Report is only generated for an active schedule that has someone responsible. Choose Edit to assign personnel, then activate it.</div></div>`:''}${spHolidayWarning()}
  <div class="tw"><table class="tbl"><thead><tr><th>Special Report</th><th>Frequency</th><th>Reporting month(s)</th><th>Deadline threshold</th><th>Deadline basis</th><th>Assigned to</th><th>Status</th><th class="right">Actions</th></tr></thead><tbody>${cf.length?cf.map(spSchedRow).join(''):'<tr><td colspan="8"><div class="empty"><b>No Special Reports are configured.</b>Add the first one.</div></td></tr>'}</tbody></table></div>
  <p class="hint" style="margin-top:10px">Changes apply to reports generated from now on. Reports already generated keep the deadline and people they were created with; use Reassign on the Generated reports tab to move a pending one.</p>`;
 }else{
  let list=spItems().slice().sort((a,b)=>String(b.genDate).localeCompare(String(a.genDate))||spByDue(a,b));
  if(SP.fStatus)list=list.filter(i=>SP.fStatus==='over'?(i.status==='pending'&&srStatus(i).key==='over'):i.status===SP.fStatus);
  if(SP.fCfg)list=list.filter(i=>i.cfgId===SP.fCfg);
  body=`<div class="fbar" style="margin-bottom:12px"><select data-chg="spFilter" data-k="fStatus" aria-label="Status"><option value="">Any status</option>${opt('pending','Pending',SP.fStatus==='pending')}${opt('over','Overdue',SP.fStatus==='over')}${opt('completed','Completed',SP.fStatus==='completed')}</select><select data-chg="spFilter" data-k="fCfg" aria-label="Special Report"><option value="">All Special Reports</option>${cf.map(c=>opt(c.id,c.name,SP.fCfg===c.id)).join('')}</select></div>
  <div class="tw"><table class="tbl"><thead><tr><th>Report</th><th>Period</th><th>Assigned to</th><th>Generated</th><th>Deadline</th><th>Status</th><th class="right">Actions</th></tr></thead><tbody>${spGenRows(list.slice(0,200))}</tbody></table></div><p class="hint" style="margin-top:10px">${plural(list.length,'report')}${list.length>200?' (latest 200 shown)':''}. Special Reports are created by the system; they cannot be logged or deleted by hand.</p>`;
 }
 const head=embedded?'':`<div class="pagehead"><div><h1>Special Reports</h1><p>Mandatory recurring reports the system creates by itself on the schedules below. Each one appears on the Dashboard and in the For My Action list of the people assigned to it.</p></div></div>`;
 return `${embedded?'':'<div class="wrap">'}${head}<div class="row" style="justify-content:flex-end;margin:0 0 10px"><button class="btn" data-act="spRun">${ic('regular')}Run generation now</button><button class="btn primary" data-act="spCfgForm">${ic('plus')}Add Special Report</button></div><div class="tabs" role="tablist">${tab('sched','Schedules')}${tab('gen','Generated reports')}</div>${body}${embedded?'':'</div>'}`;
}
const SP_FREQ_HINT={monthly:'Generated every month: all twelve months apply.',quarterly:'Four months, three months apart. Each report covers the three months ending in that month (for example March covers January–March).',specific:'Tick exactly the months that apply. Nothing is generated for the other months.',annual:'One month only. The report covers the twelve months ending in it.'};
const SP_PRESET={monthly:[1,2,3,4,5,6,7,8,9,10,11,12],quarterly:[3,6,9,12]};
function spCfgFormOpen(c){
 const cur=c||{name:'',frequency:'monthly',months:SP_PRESET.monthly,threshold:'',basis:'working_days',assignUsers:[],assignDivisions:[],docType:'',fromPeriod:'',active:true};
 const months=srCleanMonths(cur.months);
 const body=`<div data-form="srcfg" data-id="${c?esc(c.id):''}">
 <div class="fld"><label>Special Report name</label><input name="name" value="${esc(cur.name)}" autocomplete="off" maxlength="120" placeholder="e.g. Summary of CMR"></div>
 <div class="g2"><div class="fld"><label>Frequency</label><select name="frequency" data-chg="spFreq">${SR_FREQ.map(f=>opt(f[0],f[1],f[0]===cur.frequency)).join('')}</select></div>
 <div class="fld"><label>Status</label><select name="active">${opt('1','Active',cur.active)}${opt('0','Inactive',!cur.active)}</select></div></div>
 <div class="fld"><label>Reporting month(s)</label><div class="sr-months">${MONTHS.map((m,k)=>`<label class="chk"><input type="checkbox" data-m="${k+1}"${months.includes(k+1)?' checked':''}${cur.frequency==='monthly'?' disabled':''}> ${m.slice(0,3)}</label>`).join('')}</div><p class="hint" id="srFreqHint">${esc(SP_FREQ_HINT[cur.frequency]||'')} The report is generated on the 1st of the month that follows.</p></div>
 <div class="g2"><div class="fld"><label>Deadline threshold</label><input name="threshold" type="number" min="1" max="60" step="1" value="${esc(cur.threshold)}" placeholder="e.g. 20"></div>
 <div class="fld"><label>Deadline basis</label><select name="basis">${SR_BASES.map(b=>opt(b[0],b[1],b[0]===cur.basis)).join('')}</select></div></div>
 <p class="hint" style="margin:-6px 0 12px">The deadline is that many working days counted from the 1st of the month after the reporting month. Weekends and the holidays under Reference lists are not counted. If the count is longer than the month, it carries into the next month.</p>
 <div class="fld"><label>Assigned to — personnel</label>${spPicker(cur.assignUsers||[],'users')}<p class="hint">Everyone ticked receives the report in For My Action. It is still ONE report; any one of them can complete it.</p></div>
 <div class="fld"><label>Assigned to — division focal (optional)</label><div class="sr-pick sr-pick-s" data-pick="divs">${S.divisions.map(d=>`<label class="chk"><input type="checkbox" data-d="${esc(d.code)}"${(cur.assignDivisions||[]).includes(d.code)?' checked':''}> ${esc(d.code)} <small class="muted">${esc(d.focal?uname(d.focal):'no focal set')}</small></label>`).join('')}</div><p class="hint">The division’s focal at the time each report is generated.</p></div>
 <div class="g2"><div class="fld"><label>First reporting period to generate</label><input name="fromPeriod" type="month" value="${esc(cur.fromPeriod||'')}"><p class="hint">Reports for earlier periods are not created. Leave blank to start with last month. Choose an earlier month to create reports that were missed.</p></div>
 <div class="fld"><label>Related document type (optional)</label><select name="docType"><option value="">None</option>${S.refs.doc.map(d=>opt(d.name,d.name,d.name===cur.docType)).join('')}</select><p class="hint">For reference only. It does not change that type’s own deadline.</p></div></div></div>`;
 openModal(c?'Edit Special Report':'Add Special Report',body,{wide:1,foot:'<button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="spCfgSave">Save</button>'});
}
function spReadCfg(f){
 const v=formVals(f);
 return{name:(v.name||'').trim(),frequency:v.frequency,months:$$('input[data-m]',f).filter(x=>x.checked).map(x=>Number(x.dataset.m)),threshold:v.threshold===''?'':Number(v.threshold),basis:v.basis,
  assignUsers:spPicked($('[data-pick=users]',f)),assignDivisions:$$('input[data-d]:checked',f).map(x=>x.dataset.d),docType:v.docType||'',fromPeriod:v.fromPeriod||'',active:v.active==='1'};
}

function spInstall(){
 VIEWS.spconfig=()=>{UI.refTab='special';return VIEWS.refs();};
 ACTIONS.spTab=(t)=>{SP.tab=t.dataset.k;render();};
 CHANGES.spFilter=(t)=>{SP[t.dataset.k]=t.value;render();};
 ACTIONS.spDashTab=(t)=>{SP.dtab=t.dataset.k;SP.dshow=false;render();};
 ACTIONS.spDashMore=()=>{SP.dshow=!SP.dshow;render();};
 ACTIONS.spOpen=(t)=>spDetail(t.dataset.id);
 ACTIONS.spUrlSave=async(t)=>{
  const f=$('[data-form=spurl]'),url=(formVals(f).url||'').trim();
  if(url&&!/^https?:\/\/.{3}/i.test(url))return toast('URL must start with http:// or https://','bad');
  t.disabled=true;const r=await api('PUT','/api/special-reports/items/'+t.dataset.id+'/url',{url});t.disabled=false;
  if(!r.ok)return toast(r.error||'Could not save the URL.','bad');
  closeModal();toast(url?'URL saved.':'URL removed.');await refresh();
 };
 const spWorkflowAction=async(id,type,payload)=>{
  const r=await api('POST','/api/special-reports/items/'+id+'/action',{type,payload});
  if(!r.ok)return toast(r.error||'That workflow action could not be completed.','bad');
  closeModal();toast(r.msg||'Special Report updated.');await refresh();spDetail(id);
 };
 ACTIONS.spDoSubmit=t=>{const v=pv(t);spWorkflowAction(t.dataset.id,'submit',{reviewer:v.reviewer,text:v.text});};
 ACTIONS.spDoReview=t=>{const v=pv(t);spWorkflowAction(t.dataset.id,t.dataset.type,{text:v.text});};
 ACTIONS.spDoLogout=t=>{const v=pv(t);spWorkflowAction(t.dataset.id,'logout',{outTo:v.outTo,outAt:v.outAt?new Date(v.outAt).toISOString():'',remarks:v.remarks});};
 ACTIONS.spDoNote=t=>{const v=pv(t);spWorkflowAction(t.dataset.id,'comment',{text:v.text});};
 ACTIONS.spCfgForm=(t)=>{if(!spCan())return;spCfgFormOpen(t.dataset.id?spCfgs().find(x=>x.id===t.dataset.id):null);};
 CHANGES.spFreq=(t)=>{
  const f=t.closest('[data-form]'),fr=t.value,boxes=$$('input[data-m]',f);
  if(SP_PRESET[fr])boxes.forEach(b=>{b.checked=SP_PRESET[fr].includes(Number(b.dataset.m));});
  else if(fr==='annual'){const on=boxes.filter(b=>b.checked);boxes.forEach(b=>{b.checked=false;});(on[on.length-1]||boxes[11]).checked=true;}
  boxes.forEach(b=>{b.disabled=fr==='monthly';});
  $('#srFreqHint',f).textContent=(SP_FREQ_HINT[fr]||'')+' The report is generated on the 1st of the month that follows.';
 };
 ACTIONS.spCfgSave=async(t)=>{
  const f=$('[data-form=srcfg]');if(!f)return;
  const body=spReadCfg(f),err=srValidate(body,{activeUser:id=>spActiveUsers().some(x=>x.id===id),division:c=>S.divisions.some(d=>d.code===c)});
  if(err)return toast(err,'bad');
  if(body.fromPeriod==='')delete body.fromPeriod;
  t.disabled=true;
  const id=f.dataset.id,r=await api(id?'PUT':'POST',id?'/api/special-reports/configs/'+id:'/api/special-reports/configs',body);
  t.disabled=false;
  if(!r.ok)return toast(r.error||'Could not save the Special Report.','bad');
  closeModal();toast('Special Report saved.'+(r.generated?' '+plural(r.generated,'report')+' generated.':''));await refresh();
 };
 ACTIONS.spCfgToggle=async(t)=>{
  const c=spCfgs().find(x=>x.id===t.dataset.id);if(!c)return;
  const r=await api('POST','/api/special-reports/configs/'+c.id+'/active',{active:!c.active});
  if(!r.ok)return toast(r.error||'Could not change the status.','bad');
  toast(c.name+(c.active?' is now inactive.':' is now active.')+(r.generated?' '+plural(r.generated,'report')+' generated.':''));await refresh();
 };
 ACTIONS.spRun=async(t)=>{
  t.disabled=true;const r=await api('POST','/api/special-reports/generate',{});t.disabled=false;
  if(!r.ok)return toast(r.error||'Could not run the generation.','bad');
  toast(r.created?plural(r.created,'Special Report')+' created.':'Nothing new is due.'+(r.issues&&r.issues.length?' '+plural(r.issues.length,'report')+' could not be created: '+r.issues[0].issue:''));
  await refresh();
 };
 ACTIONS.spReassign=(t)=>{
  const i=spItems().find(x=>x.id===t.dataset.id);if(!i||!spCan()||i.status!=='pending')return;
  openModal('Reassign Special Report',`<div data-form="srre" data-id="${esc(i.id)}"><p style="margin-bottom:10px"><b>${esc(i.title)}</b><br><span class="muted">Now with: ${esc(spWho(i))}</span></p><div class="fld"><label>Responsible personnel</label>${spPicker(srActiveAssign(i).map(a=>a.userId),'users')}<p class="hint">People you untick stop seeing it in For My Action (their history stays). People you tick receive it. It remains the same report.</p></div><div class="fld"><label>Reason (optional)</label><input name="note" maxlength="300" placeholder="e.g. on leave"></div></div>`,
   {wide:1,foot:'<button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="spReassignSave">Reassign</button>'});
 };
 ACTIONS.spReassignSave=async(t)=>{
  const f=$('[data-form=srre]');if(!f)return;
  const users=spPicked(f);if(!users.length)return toast('Choose at least one responsible person.','bad');
  t.disabled=true;const r=await api('POST','/api/special-reports/items/'+f.dataset.id+'/reassign',{users,note:formVals(f).note});t.disabled=false;
  if(!r.ok)return toast(r.error||'Could not reassign.','bad');
  closeModal();toast('Special Report reassigned.');await refresh();
 };
}
