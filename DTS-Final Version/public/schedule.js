'use strict';
/* =====================  PERSONNEL SCHEDULE (Phase 9) – browser side  =====================
   Inspections, leave and meetings on one calendar. This file only DISPLAYS and SENDS: the server
   validates every record, decides about conflicts and stores everything. The conflict rules are
   the shared functions in engine.js (scheduleConflicts, schedOverlap), so what the screen warns
   about is exactly what the server checks.
   It is loaded before client.js, so nothing here touches VIEWS / ACTIONS until calInstall() runs. */

/* One place that describes the three event types (label, icon, colour class). The colours
   themselves are the tokens .ev-inspection / .ev-leave / .ev-meeting in schedule.css. */
const CAL_TYPES={
 inspection:{label:'Inspection',plural:'Inspections',icon:'\u{1F50D}',cls:'ev-inspection'},
 leave:{label:'Leave',plural:'On Leave',icon:'\u{1F3D6}\uFE0F',cls:'ev-leave'},
 meeting:{label:'Meeting',plural:'Meetings',icon:'\u{1F4C5}',cls:'ev-meeting'}
};
const CAL_VIEWS=[['month','Month'],['week','Week'],['day','Day'],['agenda','Agenda']];
const CAL={view:'month',date:isoD(new Date()),person:'',type:'',q:'',pending:null};
const CAL_LT={q:'',page:1};

/* ---------- small helpers ---------- */
const calCan=()=>{const u=ME();return !!u&&has(u,'schedule.manage');};
const calAll=()=>(S&&S.schedules)||[];
const calToday=()=>isoD(new Date());
const calAdd=(d,n)=>isoD(addDays(parseD(d),n));
const calMonday=d=>calAdd(d,-((parseD(d).getDay()+6)%7));
const calMS=d=>d.slice(0,8)+'01';
const calME=d=>{const x=parseD(d);return isoD(new Date(x.getFullYear(),x.getMonth()+1,0));};
function calShiftMonth(d,n){const x=parseD(d),last=new Date(x.getFullYear(),x.getMonth()+n+1,0).getDate();return isoD(new Date(x.getFullYear(),x.getMonth()+n,Math.min(x.getDate(),last)));}
const calDays=(a,b)=>{const o=[];for(let d=a;d<=b&&o.length<400;d=calAdd(d,1))o.push(d);return o;};
const calLong=d=>parseD(d).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
const calDayNo=(s,d)=>Math.round((parseD(d)-parseD(s.startDate))/864e5)+1;
const calSpan=s=>Math.round((parseD(s.endDate)-parseD(s.startDate))/864e5)+1;
const calOnDate=(list,d)=>list.filter(s=>s.startDate<=d&&d<=s.endDate);
const calTime=s=>s.type==='leave'?'Whole Day':(fmtHM(s.startTime)+' – '+fmtHM(s.endTime));
const calNames=(s,max)=>{const n=schedPeople(s).map(uname);return(max&&n.length>max)?n.slice(0,max).join(', ')+' +'+(n.length-max):n.join(', ');};
const calPlace=s=>s.type==='meeting'?(s.location||''):[s.project,s.location].filter(Boolean).join(' – ');
const calByName=(a,b)=>a.name.localeCompare(b.name);
/* timed schedules first, by start time; whole-day leave after them (as in the agenda example); then by title */
function calSort(a,b){
 const al=a.type==='leave',bl=b.type==='leave';
 if(al!==bl)return al?1:-1;
 if(a.startTime!==b.startTime)return String(a.startTime)<String(b.startTime)?-1:1;
 return schedTitle(a).localeCompare(schedTitle(b));
}
const calCmp=(a,b)=>a.startDate!==b.startDate?(a.startDate<b.startDate?-1:1):calSort(a,b);
/* the day after leave ends, moved forward to the next working day (weekends and listed holidays skipped) */
function calReturn(s){let d=calAdd(s.endDate,1),n=0;while(!isWork(parseD(d))&&n<60){d=calAdd(d,1);n++;}return d;}
const calUsers=keep=>S.users.filter(x=>x.active||(keep||[]).includes(x.id)).sort(calByName);

/* ---------- what is on screen ---------- */
function calFiltered(){return calAll().filter(s=>(!CAL.type||s.type===CAL.type)&&(!CAL.person||schedPeople(s).includes(CAL.person)));}
function calMatch(s,q){
 const hay=[schedPeople(s).map(uname).join(' '),s.project,s.title,s.type==='leave'?leaveTypeName(s.leaveTypeId):'',s.location].join(' ').toLowerCase();
 return q.toLowerCase().split(/\s+/).filter(Boolean).every(w=>hay.includes(w));
}
function calPeriod(){
 const d=CAL.date;
 if(CAL.view==='month')return{from:calMonday(calMS(d)),to:calAdd(calMonday(calME(d)),6),ms:calMS(d),me:calME(d)};
 if(CAL.view==='week'){const a=calMonday(d);return{from:a,to:calAdd(a,6)};}
 if(CAL.view==='day')return{from:d,to:d};
 return{from:calMS(d),to:calME(d)};   /* agenda: the month */
}
/* the dates a printout covers: the month for month and agenda, the week, or the day */
function calPrintRange(){const d=CAL.date;return CAL.view==='week'?calPeriod():CAL.view==='day'?{from:d,to:d}:{from:calMS(d),to:calME(d)};}
function calLabel(){
 const d=parseD(CAL.date);
 if(CAL.view==='month'||CAL.view==='agenda')return MONTHS[d.getMonth()]+' '+d.getFullYear();
 if(CAL.view==='week'){const a=parseD(calMonday(CAL.date));return a.toLocaleDateString('en-GB',{day:'numeric',month:'short'})+' – '+fmtD(addDays(a,6));}
 return calLong(CAL.date);
}

/* ---------- event pieces (chips in the month grid, cards in week / day, rows in agenda / search) ---------- */
function calTip(s){return CAL_TYPES[s.type].label+': '+schedTitle(s)+' – '+calNames(s)+' – '+schedDates(s)+' – '+calTime(s)+(calPlace(s)?' – '+calPlace(s):'');}
function calChip(s,d){
 const t=CAL_TYPES[s.type],pos=s.startDate===s.endDate?'':(d===s.startDate?' is-start':d===s.endDate?' is-end':' is-mid');
 const txt=s.type==='leave'?calNames(s,1)+' · '+schedTitle(s):s.type==='inspection'?fmtHM(s.startTime)+' '+calNames(s,1)+' · '+s.title:fmtHM(s.startTime)+' '+s.title;
 return '<button type="button" class="cal-ev '+t.cls+pos+'" data-act="calEvent" data-id="'+esc(s.id)+'" title="'+esc(calTip(s))+'" aria-label="'+esc(calTip(s))+'"><span class="ei" aria-hidden="true">'+t.icon+'</span><span class="et">'+esc(txt)+'</span></button>';
}
/* the head line and the smaller lines under it, the same for every layout */
function calLines(s,d){
 const multi=s.startDate!==s.endDate,dayTag=(multi&&d)?'Day '+calDayNo(s,d)+' of '+calSpan(s):'';
 if(s.type==='inspection')return{head:s.title,sub:[calNames(s),calPlace(s),dayTag]};
 if(s.type==='leave')return{head:calNames(s),sub:[schedTitle(s),multi?schedDates(s):'',dayTag]};
 return{head:s.title,sub:[s.location||(s.link?'Online meeting':''),'Participants: '+schedPeople(s).length,dayTag]};
}
function calCard(s,d){
 const t=CAL_TYPES[s.type],l=calLines(s,d);
 return '<button type="button" class="cal-card '+t.cls+'" data-act="calEvent" data-id="'+esc(s.id)+'"><div class="cc-h"><span>'+t.icon+' '+esc(t.label)+'</span><span class="cc-t">'+esc(calTime(s))+'</span></div><b>'+esc(l.head)+'</b>'+l.sub.filter(Boolean).map(x=>'<div class="cc-s">'+esc(x)+'</div>').join('')+'</button>';
}
function calRow(s,d,lead){
 const t=CAL_TYPES[s.type],l=calLines(s,d);
 return '<button type="button" class="ag-row '+t.cls+'" data-act="calEvent" data-id="'+esc(s.id)+'"><div class="ag-t">'+esc(lead)+'</div><div><div class="ag-h">'+t.icon+' '+esc(l.head)+'</div>'+l.sub.filter(Boolean).map(x=>'<div class="ag-s">'+esc(x)+'</div>').join('')+'</div></button>';
}

/* ---------- the four views ---------- */
/* Lanes: inside one week row every schedule gets a fixed lane (row), so a multi-day bar stays at the
   same height on every day it covers and reads as one connected bar. Multi-day schedules are placed
   first, then the rest by start time. */
function calLanes(list,days){
 const first=days[0],last=days[days.length-1],lane=new Map(),used=[];
 list.filter(s=>s.startDate<=last&&s.endDate>=first).sort((a,b)=>((calSpan(b)>1)-(calSpan(a)>1))||(a.startDate<b.startDate?-1:a.startDate>b.startDate?1:0)||calSort(a,b)).forEach(s=>{
  const cover=days.filter(d=>s.startDate<=d&&d<=s.endDate);let n=0;
  while(used[n]&&cover.some(d=>used[n].has(d)))n++;
  if(!used[n])used[n]=new Set();
  cover.forEach(d=>used[n].add(d));lane.set(s.id,n);
 });
 return lane;
}
const CAL_LANES_SHOWN=3;
function calMonthHTML(list){
 const p=calPeriod(),today=calToday(),dow=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],all=calDays(p.from,p.to);
 let cells='';
 for(let w=0;w<all.length;w+=7){
  const days=all.slice(w,w+7),lane=calLanes(list,days);
  days.forEach(d=>{
   const evs=calOnDate(list,d),byLane=[];
   evs.forEach(s=>{byLane[lane.get(s.id)]=s;});
   let top=-1;for(let i=0;i<CAL_LANES_SHOWN;i++)if(byLane[i])top=i;
   let chips='';for(let i=0;i<=top;i++)chips+=byLane[i]?calChip(byLane[i],d):'<span class="cal-sp" aria-hidden="true"></span>';
   const more=evs.filter(s=>lane.get(s.id)>=CAL_LANES_SHOWN).length;
   cells+='<div class="cal-cell'+((d>=p.ms&&d<=p.me)?'':' out')+(d===today?' today':'')+(d===CAL.date?' sel':'')+'" role="gridcell" data-act="calDay" data-d="'+d+'"><div class="cal-dn"><button type="button" class="cal-num" data-act="calDay" data-d="'+d+'" aria-label="'+esc(calLong(d))+'">'+parseD(d).getDate()+'</button>'+(evs.length?'<em class="cal-cnt" title="'+plural(evs.length,'schedule')+'">'+evs.length+'</em>':'')+'</div>'+
    chips+(more>0?'<button type="button" class="cal-more" data-act="calDay" data-d="'+d+'">+'+more+' more</button>':'')+'</div>';
  });
 }
 return '<div class="cal-grid" role="grid" aria-label="'+esc(calLabel())+'">'+dow.map(x=>'<div class="cal-dow" role="columnheader">'+x+'</div>').join('')+cells+'</div>';
}
function calWeekHTML(list){
 const p=calPeriod(),today=calToday();
 return '<div class="cal-week">'+calDays(p.from,p.to).map(d=>{
  const evs=calOnDate(list,d).sort(calSort),x=parseD(d);
  return '<div class="cal-col'+(d===today?' today':'')+(d===CAL.date?' sel':'')+'"><button type="button" class="cal-colh" data-act="calDay" data-d="'+d+'">'+x.toLocaleDateString('en-GB',{weekday:'short'})+' <b>'+x.getDate()+'</b> '+x.toLocaleDateString('en-GB',{month:'short'})+'</button>'+
   (evs.length?evs.map(s=>calCard(s,d)).join(''):'<div class="cal-none">Nothing scheduled</div>')+'</div>';
 }).join('')+'</div>';
}
function calDayHTML(list){
 const d=CAL.date,evs=calOnDate(list,d).sort(calSort);
 return '<div class="cal-day"><h3>'+esc(calLong(d))+(d===calToday()?' <span class="badge b-ok">Today</span>':'')+'</h3>'+
  (evs.length?evs.map(s=>calCard(s,d)).join(''):'<div class="empty"><b>Nothing scheduled on this day.</b>'+(CAL.person||CAL.type?'The filters above may be hiding schedules.':'')+'</div>')+'</div>';
}
function calAgendaHTML(list){
 const p=calPeriod(),today=calToday(),days=calDays(p.from,p.to).filter(d=>calOnDate(list,d).length);
 if(!days.length)return '<div class="empty"><b>Nothing scheduled in '+esc(calLabel())+'.</b>'+(CAL.person||CAL.type?'The filters above may be hiding schedules.':'')+'</div>';
 return days.map(d=>'<section class="ag-day'+(d===today?' today':'')+'"><h3>'+esc(parseD(d).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}))+' <span class="muted small" style="font-weight:500">'+esc(parseD(d).toLocaleDateString('en-US',{weekday:'long'}))+'</span>'+(d===today?' <span class="badge b-ok">Today</span>':'')+'</h3>'+
  calOnDate(list,d).sort(calSort).map(s=>calRow(s,d,calTime(s))).join('')+'</section>').join('');
}
/* Search looks through EVERY date, not only the period on screen (it says so). */
function calSearchList(){const q=CAL.q.trim();return calFiltered().filter(s=>calMatch(s,q)).sort(calCmp);}
function calSearchHTML(){
 const list=calSearchList();
 return '<div class="cal-sr"><div class="row sp cal-srh"><span><b>'+plural(list.length,'result')+'</b> for “'+esc(CAL.q.trim())+'” across all dates</span><button class="btn sm" data-act="calClearQ">Clear search</button></div>'+
  (list.length?list.map(s=>calRow(s,s.startDate,schedDates(s)+(s.type==='leave'?'':' · '+calTime(s)))).join(''):'<div class="empty"><b>No schedules match.</b>Search looks at personnel, project, inspection and meeting titles, leave type and location.</div>')+'</div>';
}
function calBodyHTML(){
 if(CAL.q.trim())return calSearchHTML();
 const list=calFiltered();
 return CAL.view==='month'?calMonthHTML(list):CAL.view==='week'?calWeekHTML(list):CAL.view==='day'?calDayHTML(list):calAgendaHTML(list);
}

/* ---------- summary, toolbar, page ---------- */
function calSummaryHTML(){
 const d=CAL.date,on=calOnDate(calAll(),d),isToday=d===calToday();
 const n=t=>new Set(on.filter(s=>s.type===t).reduce((a,s)=>a.concat(schedPeople(s)),[])).size;
 return '<div class="sect" style="margin-top:0"><h2>'+(isToday?'Today’s Personnel Schedule':'Personnel Schedule')+'</h2><span class="muted small">'+esc(calLong(d))+'</span></div><div class="tiles cal-tiles">'+
  SCHED_TYPES.map(t=>{const k=CAL_TYPES[t];return '<button type="button" class="tile cal-tile '+k.cls+'" data-act="calTile" data-t="'+t+'" aria-pressed="'+(CAL.type===t)+'" title="Show only '+esc(k.plural.toLowerCase())+' on this date"><span class="ti">'+k.icon+'</span><span class="n">'+n(t)+'</span><span class="l">'+esc(k.plural)+'</span><span class="s">personnel</span></button>';}).join('')+'</div>';
}
function calBarHTML(){
 const ppl=S.users.filter(x=>x.active||calAll().some(s=>schedPeople(s).includes(x.id))).sort(calByName);
 return '<div class="cal-bar"><div class="cal-nav"><button class="btn" data-act="calNav" data-n="-1" aria-label="Previous">'+ic('back')+'<span class="hide-sm">Previous</span></button><button class="btn" data-act="calToday">Today</button><b class="cal-label" aria-live="polite">'+esc(calLabel())+'</b><button class="btn" data-act="calNav" data-n="1" aria-label="Next"><span class="hide-sm">Next</span><span class="flip">'+ic('back')+'</span></button></div>'+
  '<div class="seg" role="group" aria-label="Calendar view">'+CAL_VIEWS.map(v=>'<button type="button" data-act="calView" data-v="'+v[0]+'" aria-pressed="'+(CAL.view===v[0])+'">'+v[1]+'</button>').join('')+'</div></div>'+
  '<div class="cal-filters"><label>Personnel <select data-chg="calPerson" aria-label="Personnel filter">'+opt('','All Personnel',!CAL.person)+ppl.map(x=>opt(x.id,x.name,CAL.person===x.id)).join('')+'</select></label>'+
  '<label>Event type <select data-chg="calType" aria-label="Event type filter">'+opt('','All',!CAL.type)+SCHED_TYPES.map(t=>opt(t,CAL_TYPES[t].label,CAL.type===t)).join('')+'</select></label>'+
  '<label>Search <input type="search" data-inp="calQ" value="'+esc(CAL.q)+'" placeholder="Person, project, title, leave type, location" aria-label="Search the whole schedule"></label></div>'+
  '<div class="cal-legend" aria-label="Legend">'+SCHED_TYPES.map(t=>'<span class="lg '+CAL_TYPES[t].cls+'"><i class="sw"></i>'+CAL_TYPES[t].icon+' '+esc(CAL_TYPES[t].label)+'</span>').join('')+'</div>';
}
function calPageHTML(u){
 return '<div class="wrap"><div class="pagehead"><div><h1>Personnel Schedule</h1><p>Inspections, Leave &amp; Meetings</p></div><div class="row">'+
  (has(u,'report.print')?'<button class="btn" data-act="calPrint">'+ic('print')+'Print</button>':'')+
  (has(u,'schedule.manage')?'<button class="btn primary" data-act="calAdd">'+ic('plus')+'Add Schedule</button>':'')+'</div></div>'+
  '<div id="calSum">'+calSummaryHTML()+'</div><div class="card cal-wrap"><div id="calBar">'+calBarHTML()+'</div><div id="calBody">'+calBodyHTML()+'</div></div></div>';
}
/* Redraw only what changed. While typing in the search box the toolbar is left alone so the cursor stays put. */
function calRepaint(keepBar){
 const c=$('#calBody');if(!c){render();return;}
 const s=$('#calSum'),b=$('#calBar');
 if(s)s.innerHTML=calSummaryHTML();
 if(b&&!keepBar)b.innerHTML=calBarHTML();
 c.innerHTML=calBodyHTML();
}

/* ---------- details ---------- */
function calShowEvent(id){
 const s=calAll().find(x=>x.id===id);
 if(!s)return toast('That schedule no longer exists.','bad');
 const t=CAL_TYPES[s.type],conf=scheduleConflicts(s,s.id),multi=s.startDate!==s.endDate;
 const li=ids=>ids.length?'<ul class="cal-ppl">'+ids.map(i=>'<li>'+esc(uname(i))+'</li>').join('')+'</ul>':'—';
 let rows;
 if(s.type==='inspection')rows=[['Inspection title',esc(s.title)],['Personnel',li(s.personnel)],['Project',esc(s.project||'—')],['Location',esc(s.location||'—')],['Date',esc(schedDates(s))],['Time',esc(calTime(s))+(multi?' each day':'')],['Remarks',s.remarks?nl(s.remarks):'—']];
 else if(s.type==='leave')rows=[['Personnel',li(s.personnel)],['Leave type',esc(schedTitle(s))],['Start date',esc(fmtWD(parseD(s.startDate)))],['End date',esc(fmtWD(parseD(s.endDate)))],['Duration',esc(plural(calSpan(s),'calendar day'))],['Returns (next working day)',esc(fmtWD(parseD(calReturn(s))))],['Remarks',s.remarks?nl(s.remarks):'—']];
 else rows=[['Meeting title',esc(s.title)],['Organizer',s.organizer?esc(uname(s.organizer)):'—'],['Participants',li(s.personnel)],['Date',esc(schedDates(s))],['Time',esc(calTime(s))+(multi?' each day':'')],['Location',esc(s.location||'—')],
  ['Meeting link',s.link?(/^https?:\/\//i.test(s.link)?'<a href="'+esc(s.link)+'" target="_blank" rel="noopener noreferrer">'+esc(s.link)+'</a>':esc(s.link)):'—'],['Agenda / Remarks',s.remarks?nl(s.remarks):'—']];
 const body=(conf.length?'<div class="banner warn"><div><b>⚠ Scheduling Conflict</b><ul class="cal-conf">'+conf.map(c=>'<li>'+esc(c.message)+'<div class="small">'+esc(c.detail)+'</div></li>').join('')+'</ul></div></div>':'')+
  '<dl class="dl">'+rows.map(r=>'<dt>'+r[0]+'</dt><dd>'+r[1]+'</dd>').join('')+'</dl>'+
  '<div class="cal-meta">Added by '+esc(uname(s.createdBy))+', '+fmtDT(s.createdAt)+(s.updatedAt&&s.updatedAt!==s.createdAt?' · Last updated by '+esc(uname(s.updatedBy))+', '+fmtDT(s.updatedAt):'')+'</div>';
 openModal(t.icon+' '+t.label+' details',body,{nofocus:1,foot:(calCan()?'<button class="btn danger" data-act="calDelete" data-id="'+esc(s.id)+'">'+ic('trash')+'Delete</button><button class="btn" data-act="calEdit" data-id="'+esc(s.id)+'">Edit</button>':'')+'<button class="btn primary" data-act="closeModal">Close</button>'});
}

/* ---------- add / edit form ---------- */
function calPicker(name,sel){
 const users=calUsers(sel);
 const all=users.length>0&&users.every(x=>sel.includes(x.id));
 return '<div class="pick"><input type="search" placeholder="Search personnel" data-inp="calPickQ" aria-label="Search personnel" autocomplete="off"><label class="chk pick-all"><input type="checkbox" data-chg="calPickAll"'+(all?' checked':'')+'><span>Select all personnel <span class="hint">(applies to the people shown; use the search box to narrow the list)</span></span></label><div class="pick-list">'+
  users.map(x=>'<label class="chk" data-nm="'+esc(x.name.toLowerCase())+'"><input type="checkbox" name="'+name+'" value="'+esc(x.id)+'" data-chg="calPickOne"'+(sel.includes(x.id)?' checked':'')+'><span>'+esc(x.name)+(x.active?'':' (inactive)')+'</span></label>').join('')+'</div></div>';
}
function calForm(id,pre){
 const ex=id?calAll().find(x=>x.id===id):null;
 if(id&&!ex)return toast('That schedule no longer exists.','bad');
 const v=pre||ex||{},type=(ex?ex.type:v.type)||'inspection';
 const val=k=>esc(v[k]||''),ppl=v.personnel||[],endPre=(v.endDate&&v.endDate!==v.startDate)?v.endDate:'';
 const projects=[...new Set(calAll().map(x=>x.project).filter(Boolean))].sort();
 const sect=k=>'<div data-sect="'+k+'"'+(type===k?'':' hidden')+'>';
 const DEF={startTime:'08:00',endTime:'17:00'};   /* a NEW schedule starts at 8:00 AM to 5:00 PM; the times can be changed */
 const time=(n,label,k)=>'<div class="fld"><label>'+label+' <span class="req">*</span></label><input type="time" name="'+n+'" value="'+esc(v[k]||(ex?'':DEF[k]))+'"></div>';
 const active=(v.leaveTypeId&&(S.leaveTypes||[]).some(t=>t.id===v.leaveTypeId&&t.active===false))?v.leaveTypeId:'';
 const body='<div data-form="cal" data-id="'+esc(id||'')+'"'+(ex?' data-type="'+ex.type+'"':'')+'>'+
  (ex?'<div class="fld"><label>Schedule type</label><div><b>'+CAL_TYPES[type].icon+' '+esc(CAL_TYPES[type].label)+'</b> <span class="hint">The type of an existing schedule cannot be changed.</span></div></div>':
   '<div class="fld"><label for="calFType">Schedule type</label><select id="calFType" name="type" data-chg="calFormType">'+SCHED_TYPES.map(k=>opt(k,CAL_TYPES[k].icon+' '+CAL_TYPES[k].label,k===type)).join('')+'</select></div>')+
  /* inspection */
  sect('inspection')+'<div class="fld"><label>Personnel / Inspector <span class="req">*</span></label>'+calPicker('ins_p',ppl)+'<div class="hint">Choose one or more. It is saved once and shows on every assigned person’s schedule.</div></div>'+
  '<div class="fld"><label>Inspection title <span class="req">*</span></label><input name="ins_title" value="'+val('title')+'" placeholder="Regular CPES Inspection" autocomplete="off"></div>'+
  '<div class="g2"><div class="fld"><label>Project</label><input name="ins_project" list="calProjects" value="'+val('project')+'" autocomplete="off"></div><div class="fld"><label>Location</label><input name="ins_location" value="'+val('location')+'" placeholder="Project location or another place" autocomplete="off"></div></div><datalist id="calProjects">'+projects.map(p=>'<option value="'+esc(p)+'">').join('')+'</datalist><p class="hint">Enter the project, the location, or both.</p>'+
  '<div class="g2"><div class="fld"><label>Date <span class="req">*</span></label><input type="date" name="ins_start" value="'+val('startDate')+'"></div><div class="fld"><label>End date (multi-day)</label><input type="date" name="ins_end" value="'+esc(endPre)+'"><span class="hint">Leave blank for a one-day inspection.</span></div></div>'+
  '<div class="g2">'+time('ins_st','Start time','startTime')+time('ins_et','End time','endTime')+'</div>'+
  '<div class="fld"><label>Remarks</label><textarea name="ins_remarks">'+val('remarks')+'</textarea></div></div>'+
  /* leave */
  sect('leave')+'<div class="fld"><label>Personnel <span class="req">*</span></label><select name="lv_p"><option value="">Select</option>'+calUsers(ppl).map(x=>opt(x.id,x.name+(x.active?'':' (inactive)'),ppl[0]===x.id)).join('')+'</select></div>'+
  '<div class="fld"><label>Leave type <span class="req">*</span></label><select name="lv_t"><option value="">Select</option>'+(S.leaveTypes||[]).filter(t=>t.active!==false||t.id===active).map(t=>opt(t.id,t.name+(t.active===false?' (inactive)':''),v.leaveTypeId===t.id)).join('')+'</select></div>'+
  '<div class="g2"><div class="fld"><label>Start date <span class="req">*</span></label><input type="date" name="lv_start" value="'+val('startDate')+'"></div><div class="fld"><label>End date <span class="req">*</span></label><input type="date" name="lv_end" value="'+val('endDate')+'"></div></div>'+
  '<div class="fld"><label>Remarks</label><textarea name="lv_remarks">'+val('remarks')+'</textarea></div></div>'+
  /* meeting */
  sect('meeting')+'<div class="fld"><label>Meeting title <span class="req">*</span></label><input name="mtg_title" value="'+val('title')+'" placeholder="CPD Meeting" autocomplete="off"></div>'+
  '<div class="g2"><div class="fld"><label>Date <span class="req">*</span></label><input type="date" name="mtg_start" value="'+val('startDate')+'"></div><div class="fld"><label>End date (only if it runs several days)</label><input type="date" name="mtg_end" value="'+esc(endPre)+'"></div></div>'+
  '<div class="g2">'+time('mtg_st','Start time','startTime')+time('mtg_et','End time','endTime')+'</div>'+
  '<div class="g2"><div class="fld"><label>Location</label><input name="mtg_loc" value="'+val('location')+'" placeholder="Conference Room" autocomplete="off"></div><div class="fld"><label>Meeting link</label><input name="mtg_link" value="'+val('link')+'" placeholder="https://" inputmode="url" autocomplete="off"><span class="hint">Google Meet, Microsoft Teams, Zoom or any other meeting address.</span></div></div>'+
  '<div class="fld"><label>Organizer</label><select name="mtg_org"><option value="">None</option>'+calUsers((ppl||[]).concat(v.organizer?[v.organizer]:[])).map(x=>opt(x.id,x.name+(x.active?'':' (inactive)'),v.organizer===x.id)).join('')+'</select></div>'+
  '<div class="fld"><label>Participants</label>'+calPicker('mtg_p',ppl)+'<div class="hint">Choose the organizer, at least one participant, or both.</div></div>'+
  '<div class="fld"><label>Agenda / Remarks</label><textarea name="mtg_remarks">'+val('remarks')+'</textarea></div></div></div>';
 openModal(ex?'Edit schedule':'Add schedule',body,{wide:true,foot:'<button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="calSave">Save schedule</button>'});
}
function calRead(f){
 const g=n=>{const e=f.querySelector('[name="'+n+'"]');return e?e.value.trim():'';};
 const pk=n=>$$('input[name="'+n+'"]:checked',f).map(x=>x.value);
 const type=f.dataset.type||g('type');
 if(type==='inspection')return{type,title:g('ins_title'),project:g('ins_project'),location:g('ins_location'),startDate:g('ins_start'),endDate:g('ins_end')||g('ins_start'),startTime:g('ins_st'),endTime:g('ins_et'),remarks:g('ins_remarks'),personnel:pk('ins_p')};
 if(type==='leave')return{type,personnel:g('lv_p')?[g('lv_p')]:[],leaveTypeId:g('lv_t'),startDate:g('lv_start'),endDate:g('lv_end'),remarks:g('lv_remarks')};
 return{type,title:g('mtg_title'),startDate:g('mtg_start'),endDate:g('mtg_end')||g('mtg_start'),startTime:g('mtg_st'),endTime:g('mtg_et'),location:g('mtg_loc'),link:g('mtg_link'),organizer:g('mtg_org'),personnel:pk('mtg_p'),remarks:g('mtg_remarks')};
}
/* The same checks the server makes, so a mistake is caught before anything is sent. The server still decides. */
function calValidate(b){
 if(b.type==='leave'){
  if(b.personnel.length!==1)return 'Choose the person who is on leave.';
  if(!b.leaveTypeId)return 'Choose the leave type.';
  if(!b.startDate)return 'Enter the start date.';
  if(!b.endDate)return 'Enter the end date.';
  if(b.endDate<b.startDate)return 'The end date cannot be before the start date.';
  return '';
 }
 if(b.type==='inspection'&&!b.personnel.length)return 'Choose at least one inspector.';
 if(!b.title)return b.type==='inspection'?'Enter the inspection title.':'Enter the meeting title.';
 if(b.type==='inspection'&&!b.project&&!b.location)return 'Enter the project or the location of the inspection.';
 if(!b.startDate)return 'Enter the date.';
 if(b.endDate<b.startDate)return 'The end date cannot be before the start date.';
 if(!b.startTime)return 'Enter the start time.';
 if(!b.endTime)return 'Enter the end time.';
 if(b.endTime<=b.startTime)return 'The end time must be later than the start time.';
 if(b.type==='meeting'){
  if(!b.organizer&&!b.personnel.length)return 'Choose the organizer or at least one participant.';
  if(b.link&&!/^https?:\/\/\S+$/i.test(b.link))return 'Enter the meeting link as a full web address starting with https://';
 }
 return '';
}
async function calSubmit(confirm,btn){
 const p=CAL.pending;if(!p)return;
 if(btn)btn.disabled=true;
 const body=Object.assign({},p.body,{confirm:!!confirm});
 const r=p.id?await api('PUT','/api/schedules/'+p.id,body):await api('POST','/api/schedules',body);
 if(btn)btn.disabled=false;
 if(r.status===409&&r.code==='conflict')return calConflictModal(r.conflicts||[]);
 if(!r.ok)return toast(r.error||'Could not save the schedule.','bad');
 CAL.date=p.body.startDate;CAL.pending=null;closeModal();
 toast((p.id?'Schedule updated.':'Schedule added.')+(r.conflicts?' Saved with '+plural(r.conflicts,'conflict warning')+'.':''));
 await refresh();
}
function calConflictModal(list){
 openModal('Scheduling conflict','<div class="banner warn"><div><b>⚠ Scheduling Conflict</b><ul class="cal-conf">'+list.map(c=>'<li>'+esc(c.message)+'<div class="small">'+esc(c.detail||'')+'</div></li>').join('')+'</ul></div></div><p>This schedule has not been saved yet. Go back to change it, or save it anyway if the overlap is intended (for example, leave that is not final yet).</p>',
  {nofocus:1,foot:'<button class="btn" data-act="calConfBack">Go back and edit</button><button class="btn primary" data-act="calConfSave">Save anyway</button>'});
}

/* ---------- printing (uses the application's print preview and sheet header) ---------- */
function calPrintHTML(){
 const searching=!!CAL.q.trim(),r=calPrintRange();
 const list=(searching?calSearchList():calFiltered().filter(s=>s.endDate>=r.from&&s.startDate<=r.to).sort(calCmp));
 const period=searching?'Search results, all dates':(CAL.view==='week'?'Week of ':CAL.view==='day'?'':'')+calLabel();
 const flt='Personnel: '+(CAL.person?uname(CAL.person):'All Personnel')+' · Event type: '+(CAL.type?CAL_TYPES[CAL.type].label:'All')+(searching?' · Search: “'+CAL.q.trim()+'”':'')+' · View: '+(CAL_VIEWS.find(v=>v[0]===CAL.view)||['',''])[1];
 const detail=s=>s.type==='inspection'?(s.project?'Project: '+s.project:''):s.type==='leave'?'Returns '+fmtD(parseD(calReturn(s)))+(s.remarks?' · '+s.remarks:''):(s.organizer?'Organizer: '+uname(s.organizer):'')+(s.link?' · '+s.link:'');
 return sheetHead('Personnel Schedule – Inspections, Leave & Meetings',period)+'<div class="fl-line">'+esc(flt)+'</div>'+
  '<table><thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Personnel</th><th>Schedule</th><th>Location</th></tr></thead><tbody>'+
  (list.length?list.map(s=>'<tr><td>'+esc(schedDates(s))+'</td><td>'+esc(calTime(s))+'</td><td class="ty">'+esc(CAL_TYPES[s.type].label)+'</td><td>'+esc(calNames(s))+'</td><td><b>'+esc(schedTitle(s))+'</b>'+(detail(s)?'<br>'+esc(detail(s)):'')+'</td><td>'+esc(calPlace(s)||'—')+'</td></tr>').join(''):'<tr><td colspan="6">Nothing scheduled.</td></tr>')+
  '</tbody></table><div class="foot"><span>'+plural(list.length,'schedule')+'</span><span>End of schedule</span></div>';
}

/* ---------- Leave Types (Reference lists page): same layout as the other reference lists ---------- */
function leaveTypesCard(){
 const q=CAL_LT.q.toLowerCase();
 const list=(S.leaveTypes||[]).filter(t=>!q||(t.name+' '+(t.description||'')).toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name));
 const pages=Math.max(1,Math.ceil(list.length/PAGE));if(CAL_LT.page>pages)CAL_LT.page=pages;
 const rows=list.slice((CAL_LT.page-1)*PAGE,CAL_LT.page*PAGE);
 return '<div class="card"><div class="ch ref-list-heading"><h3>Leave types</h3><button class="btn sm primary" data-act="ltForm">'+ic('plus')+'Add leave type</button></div>'+
  '<div class="rt"><div class="row" style="flex:1"><input type="search" placeholder="Search leave types" style="max-width:260px" value="'+esc(CAL_LT.q)+'" data-inp="ltQ" aria-label="Search leave types">'+(CAL_LT.q?'<button class="btn sm ghost" data-act="ltClear">Clear</button>':'')+'</div><span class="muted small">Used by the Personnel Schedule</span></div>'+
  '<div class="tw" style="border:0;border-radius:0"><table class="tbl"><thead><tr><th>Leave type</th><th>Description</th><th>Status</th><th class="right">Actions</th></tr></thead><tbody>'+
  (rows.length?rows.map(t=>'<tr'+(t.active===false?' class="muted"':'')+'><td class="b">'+esc(t.name)+'</td><td class="small muted">'+esc(t.description||'—')+'</td><td>'+(t.active!==false?badge('ok','Active'):badge('neu','Inactive'))+'</td><td class="right nowrap"><button class="btn sm" data-act="ltForm" data-id="'+esc(t.id)+'">Edit</button> <button class="btn sm" data-act="ltToggle" data-id="'+esc(t.id)+'">'+(t.active!==false?'Deactivate':'Activate')+'</button></td></tr>').join(''):'<tr><td colspan="4"><div class="empty">No leave types match.</div></td></tr>')+'</tbody></table></div>'+
  '<div class="pager" style="padding:10px 16px"><span>'+plural(list.length,'record')+'</span><span class="row"><button class="btn sm" data-act="ltPage" data-d="-1"'+(CAL_LT.page<=1?' disabled':'')+'>Previous</button><span>Page '+CAL_LT.page+' of '+pages+'</span><button class="btn sm" data-act="ltPage" data-d="1"'+(CAL_LT.page>=pages?' disabled':'')+'>Next</button></span></div></div>';
}
async function calSaveLeaveTypes(list,note){
 const r=await api('PUT','/api/leave-types',{value:list,note:note});
 if(!r.ok){toast(r.error||'Could not save that change.','bad');await refresh();return false;}
 await refresh();return true;
}
const calLTList=()=>(S.leaveTypes||[]).map(t=>Object.assign({},t));

/* ---------- hook everything into the application (called once, from client.js, before the app starts) ---------- */
function calInstall(){
 VIEWS.schedule=(u)=>calPageHTML(u);

 ACTIONS.calNav=(t)=>{const n=Number(t.dataset.n),v=CAL.view;CAL.date=(v==='month'||v==='agenda')?calShiftMonth(CAL.date,n):v==='week'?calAdd(CAL.date,7*n):calAdd(CAL.date,n);calRepaint();};
 ACTIONS.calToday=()=>{CAL.date=calToday();calRepaint();};
 ACTIONS.calView=(t)=>{CAL.view=t.dataset.v;calRepaint();};
 ACTIONS.calDay=(t)=>{CAL.date=t.dataset.d;CAL.view='day';calRepaint();};
 ACTIONS.calTile=(t)=>{const k=t.dataset.t;if(CAL.type===k){CAL.type='';}else{CAL.type=k;CAL.view='day';}calRepaint();};
 ACTIONS.calClearQ=()=>{CAL.q='';calRepaint();};
 CHANGES.calPerson=(t)=>{CAL.person=t.value;calRepaint();};
 CHANGES.calType=(t)=>{CAL.type=t.value;calRepaint();};
 INPUTS.calQ=(t)=>{CAL.q=t.value;clearTimeout(CAL._q);CAL._q=setTimeout(()=>calRepaint(true),200);};
 CHANGES.calPickAll=(t)=>{const box=t.closest('.pick');$$('.chk:not(.pick-all)',box).forEach(l=>{if(!l.hidden)$('input',l).checked=t.checked;});};
 CHANGES.calPickOne=(t)=>{const box=t.closest('.pick'),all=$('.pick-all input',box),vis=$$('.chk:not(.pick-all)',box).filter(l=>!l.hidden);all.checked=vis.length>0&&vis.every(l=>$('input',l).checked);};
 INPUTS.calPickQ=(t)=>{const q=t.value.trim().toLowerCase();$$('.chk:not(.pick-all)',t.closest('.pick')).forEach(l=>{l.hidden=!!q&&!l.dataset.nm.includes(q);});const box=t.closest('.pick'),vis=$$('.chk:not(.pick-all)',box).filter(l=>!l.hidden);$('.pick-all input',box).checked=vis.length>0&&vis.every(l=>$('input',l).checked);};

 ACTIONS.calEvent=(t)=>calShowEvent(t.dataset.id);
 ACTIONS.calAdd=()=>{if(!calCan())return;CAL.pending=null;calForm(null,{type:CAL.type||'inspection',startDate:CAL.date,endDate:CAL.date});};
 ACTIONS.calEdit=(t)=>{if(!calCan())return;CAL.pending=null;calForm(t.dataset.id);};
 CHANGES.calFormType=(t)=>{$$('[data-sect]',t.closest('[data-form]')).forEach(x=>{x.hidden=x.dataset.sect!==t.value;});};
 ACTIONS.calSave=async(t)=>{
  const f=$('[data-form=cal]');if(!f)return;
  const b=calRead(f),err=calValidate(b);
  if(err)return toast(err,'bad');
  CAL.pending={id:f.dataset.id||'',body:b};
  await calSubmit(false,t);
 };
 ACTIONS.calConfBack=()=>{const p=CAL.pending;if(!p)return closeModal();calForm(p.id||null,p.body);};
 ACTIONS.calConfSave=(t)=>calSubmit(true,t);
 ACTIONS.calDelete=(t)=>{
  const s=calAll().find(x=>x.id===t.dataset.id);if(!s||!calCan())return;
  confirmBox('Delete schedule','Delete the '+s.type+' “'+schedTitle(s)+'” ('+schedDates(s)+')? This cannot be undone.','Delete',async()=>{
   const r=await api('DELETE','/api/schedules/'+s.id);
   if(!r.ok)return toast(r.error||'Could not delete the schedule.','bad');
   toast('Schedule deleted.');await refresh();
  },true);
 };
 ACTIONS.calPrint=()=>openPP(calPrintHTML());

 /* leave types (Reference lists) */
 INPUTS.ltQ=(t)=>{CAL_LT.q=t.value;CAL_LT.page=1;clearTimeout(CAL._lq);CAL._lq=setTimeout(()=>{render();const el=$('[data-inp=ltQ]');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}},250);};
 ACTIONS.ltClear=()=>{CAL_LT.q='';CAL_LT.page=1;render();};
 ACTIONS.ltPage=(t)=>{CAL_LT.page=Math.max(1,CAL_LT.page+Number(t.dataset.d));render();};
 ACTIONS.ltForm=(t)=>{
  const x=t.dataset.id?(S.leaveTypes||[]).find(y=>y.id===t.dataset.id):null;
  openModal(x?'Edit leave type':'Add a leave type','<div data-form="leavetype" data-id="'+esc(x?x.id:'')+'"><div class="fld"><label>Leave type name</label><input name="name" value="'+esc(x?x.name:'')+'" autocomplete="off"></div><div class="fld"><label>Description (optional)</label><input name="description" value="'+esc(x&&x.description||'')+'"></div><div class="fld"><label>Status</label><select name="active">'+opt('1','Active',!x||x.active!==false)+opt('0','Inactive',!!x&&x.active===false)+'</select></div><p class="hint">Deactivating keeps every existing leave record unchanged; the type simply stops being offered.</p></div>',
   {foot:'<button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="ltSave">Save</button>'});
 };
 ACTIONS.ltSave=async()=>{
  const f=$('[data-form=leavetype]'),name=(f.querySelector('[name=name]').value||'').trim(),desc=f.querySelector('[name=description]').value.trim(),act=f.querySelector('[name=active]').value==='1',id=f.dataset.id;
  if(!name)return toast('Enter the name of the leave type.','bad');
  if((S.leaveTypes||[]).some(x=>x.id!==id&&x.name.toLowerCase()===name.toLowerCase()))return toast('That leave type already exists.','bad');
  const list=calLTList();
  if(id)Object.assign(list.find(x=>x.id===id),{name:name,description:desc,active:act});else list.push({name:name,description:desc,active:act});
  if(await calSaveLeaveTypes(list,(id?'Leave type updated: ':'Leave type added: ')+name)){closeModal();toast('Leave type saved.');}
 };
 ACTIONS.ltToggle=async(t)=>{
  const list=calLTList(),x=list.find(y=>y.id===t.dataset.id);if(!x)return;
  x.active=x.active===false;
  if(await calSaveLeaveTypes(list,'Leave type '+(x.active?'activated':'deactivated')+': '+x.name))toast('Leave type '+(x.active?'activated':'deactivated')+'.');
 };
 ACTIONS.ltAdd=async(t)=>{
  const v=formVals(t.closest('[data-panel]')),name=(v.v||'').trim();
  if(!name)return toast('Enter the name of the leave type.','bad');
  if((S.leaveTypes||[]).some(x=>x.name.toLowerCase()===name.toLowerCase()))return toast('That leave type already exists.','bad');
  const list=calLTList();list.push({name:name,description:(v.description||'').trim(),active:true});
  if(await calSaveLeaveTypes(list,'Leave type added: '+name))toast('Leave type saved.');
 };
}
