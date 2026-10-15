'use strict';
/* =====================  UTILITIES  ===================== */
const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const p2=n=>String(n).padStart(2,'0');
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4);
const sod=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x;};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const isoD=d=>{const x=new Date(d);return x.getFullYear()+'-'+p2(x.getMonth()+1)+'-'+p2(x.getDate());};
const parseD=s=>{const a=String(s).split('-').map(Number);return new Date(a[0],a[1]-1,a[2]);};
const fmtD=d=>d?new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
const fmtT=d=>new Date(d).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
const fmtDT=d=>d?fmtD(d)+', '+fmtT(d):'—';
const fmtWD=d=>d?new Date(d).toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}):'—';
const localInput=d=>{const x=new Date(d);return isoD(x)+'T'+p2(x.getHours())+':'+p2(x.getMinutes());};
const plural=(n,w)=>n+' '+w+(n===1?'':'s');
const initials=n=>String(n||'?').replace(/[^A-Za-z ]/g,'').split(/\s+/).filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase();
const firstName=n=>String(n||'').split(' ')[0];

/* =====================  CONSTANTS  ===================== */
const TX_REGULAR='Regular Report';
/* The Consolidated CMR and PPR deadline rule: the 6th working day of the month after the
   reporting period. Stored as the starting configuration for that one document type; the System
   Administrator can change it, and every other threshold is configured the same way. */
const REGULAR_DOC='Consolidated CMR and PPR',REGULAR_DAYS=6;
const DOC_DESCR={
 'Consolidated CMR and PPR':'Monthly consolidated CMR and PPR of a region or office. Reports the month named as its reporting period.',
 'Consolidated CMR and PPR to COA':'Consolidated CMR and PPR transmitted to COA.',
 'Inspection Report':'Statement of inspection of a project or activity.',
 'External Communication':'Communication received from outside the office.',
 'Internal Communications':'Communication within the office.',
 'Minutes of Meeting':'Minutes of a meeting or conference.',
 'Lacking Documents':'Submission with documents still lacking.',
 'Internal Request':'Request from a unit of the office.',
 'Travel Order':'Travel order or itinerary of travel.'
};
const DEFAULT_PW='Track@2026',ADMIN_PW='Admin@2026';
const ROLES={sysadmin:'System Administrator',admin_staff:'Admin Staff',focal:'Focal / Supervisor',supervisor:'Supervisor',staff:'Staff',div_manager:'Division Manager',dept_manager:'Department Manager'};
const ROLE_ORDER=['sysadmin','admin_staff','focal','supervisor','staff','div_manager','dept_manager'];
const PERMS=[
 ['Admin desk','doc.log','Log / receive new documents'],
 ['Admin desk','doc.edit','Edit document details before forwarding'],
 ['Admin desk','doc.forward','Forward documents to the division focal'],
 ['Admin desk','doc.logout','Log documents out (cleared or for return)'],
 ['Focal / Supervisor','doc.assign','Set transaction type, document type and assign staff'],
 ['Processing','doc.process','Process assigned documents and submit for review'],
 ['Review','doc.review_sup','Review as Supervisor or Focal / Supervisor'],
 ['Review','doc.review_div','Review as Division Manager'],
 ['Review','doc.review_dept','Final review and clearance for out (Department Manager, or Division Manager when acting)'],
 ['Review','doc.return_instruct','Instruct return of a document to sender'],
 ['Review','doc.comment','Add notes to documents'],
 ['Administration','doc.override','Act on behalf of any desk (override)'],
 ['Administration','doc.delete','Delete documents'],
 ['Reports','report.view','Analytics charts and reports'],
 ['Reports','report.print','Print and export'],
 ['Personnel Schedule','schedule.manage','Add, edit and delete inspections, leave and meetings on the Personnel Schedule'],
 ['System','user.manage','Manage user accounts'],
 ['System','role.manage','Edit roles and permissions'],
 ['System','oic.manage','Nominate OIC and set presence of managers'],
 ['System','config.manage','Divisions, reference lists and settings'],
 ['System','data.manage','Backup, restore and reset data'],
 ['System','audit.view','View the audit log']
];
const DEFAULT_PERMS={
 sysadmin:PERMS.map(p=>p[1]),
 admin_staff:['doc.log','doc.edit','doc.forward','doc.logout','doc.comment','report.view','report.print'],
 focal:['doc.assign','doc.process','doc.review_sup','doc.comment','report.view','report.print'],
 supervisor:['doc.process','doc.review_sup','doc.comment','report.view','report.print'],
 staff:['doc.process','doc.comment','report.view','report.print'],
 div_manager:['doc.review_div','doc.review_dept','doc.return_instruct','doc.comment','report.view','report.print'],
 dept_manager:['doc.review_dept','doc.return_instruct','doc.comment','report.view','report.print']
};
const OIC_GRANTS=['doc.review_dept','doc.return_instruct','doc.comment'];
const STAGES={
 received:{label:'Received – Admin desk',short:'Admin desk',tone:'neu',node:'admin',ord:0},
 at_focal:{label:'For assignment – Focal',short:'Focal desk',tone:'info',node:'focal',ord:1},
 processing:{label:'Processing – Staff',short:'Processing',tone:'info',node:'staff',ord:2},
 compliance:{label:'For compliance – Staff',short:'For compliance',tone:'pur',node:'staff',ord:3},
 sup_review:{label:'Supervisor review',short:'Supervisor review',tone:'info',node:'sup',ord:4},
 div_review:{label:'Division Manager review',short:'Division Mgr review',tone:'info',node:'div',ord:5},
 dept_review:{label:'Department Manager review',short:'Dept Mgr review',tone:'info',node:'dept',ord:6},
 cleared:{label:'Cleared for out',short:'Cleared for out',tone:'ok',node:'ready',ord:7},
 return_out:{label:'For return – to be logged out',short:'For return',tone:'warn',node:'ready',ord:8},
 out:{label:'Out – released',short:'Released',tone:'neu',node:'out',ord:9}
};
const NODES=[
 {k:'admin',label:'Admin desk',sub:'Logged'},{k:'focal',label:'Focal',sub:'Assign'},{k:'staff',label:'Staff',sub:'Process'},
 {k:'sup',label:'Supervisor',sub:'Review'},{k:'div',label:'Division Mgr',sub:'Review'},{k:'dept',label:'Dept Mgr',sub:'Final review'},
 {k:'ready',label:'Ready for out',sub:'Cleared or for return'},{k:'out',label:'Out',sub:'Released'}
];
const NODE_STATUSES=k=>Object.keys(STAGES).filter(s=>STAGES[s].node===k);

/* =====================  STATE  ===================== */
var S=null;
const uById=id=>S.users.find(u=>u.id===id)||null;
const uname=id=>{const u=uById(id);return u?u.name:'—';};
var HS=new Set();
function rebuildHS(){HS=new Set(S.holidays.map(h=>h.date));}
/* =====================  CALENDAR AND MONTH HELPERS (used by the deadline engine)  ===================== */
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_ABBR=MONTHS.map(m=>m.slice(0,3));
/* Reads "September", "Sep", "SEPTEMBER", "sept.", "Sept" or "9" and gives back the month name.
   Anything that is not one of the twelve months gives back '' so it can never be saved. */
function normMonth(v){
 if(v==null)return '';
 const s=String(v).trim().replace(/[\s.]+$/,'');
 if(!s)return '';
 if(/^\d{1,2}$/.test(s)){const n=Number(s);return n>=1&&n<=12?MONTHS[n-1]:'';}
 const t=s.toLowerCase();
 let i=MONTHS.findIndex(m=>m.toLowerCase()===t);
 if(i<0)i=MONTH_ABBR.findIndex(m=>m.toLowerCase()===t);
 /* A month name or part of one, optionally followed by a year, e.g. "September", "Sept", "Sep 2026".
    Anything else after the name ("SeptemberBanana") is not a month and is refused. */
 const m=/^([a-z]{3,})([\s,/.-]*\d{0,4})$/.exec(t);
 if(i<0&&m)i=MONTHS.findIndex(x=>x.toLowerCase().startsWith(m[1]));
 return i<0?'':MONTHS[i];
}
const monthIndex=m=>MONTHS.indexOf(m);
function ordinal(n){const s=['th','st','nd','rd'],v=Math.abs(n)%100;return n+(s[(v-20)%10]||s[v]||s[0]);}
/* The n-th working day of a month: Saturdays, Sundays and every listed holiday are skipped. */
function nthWorkdayOfMonth(year,mi,n){
 const last=new Date(year,mi+1,0).getDate();
 let c=0;
 for(let day=1;day<=last;day++){const d=new Date(year,mi,day);if(!isWork(d))continue;c++;if(c>=n)return d;}
 return new Date(year,mi,last);
}
function firstWorkdayOfMonth(year,mi){
 const last=new Date(year,mi+1,0).getDate();
 for(let day=1;day<=last;day++){const d=new Date(year,mi,day);if(isWork(d))return d;}
 return new Date(year,mi,1);
}
/* Which calendar year a reporting month belongs to: the current year, or the year before when that
   month is still ahead of us (a December report is filed for the year that has just ended). */
function reportingPeriodInfo(month,at){
 const m=normMonth(month);
 if(!m)return null;
 const now=at?new Date(at):new Date(),mi=monthIndex(m);
 const year=mi<=now.getMonth()?now.getFullYear():now.getFullYear()-1;
 const dm=mi===11?0:mi+1,dy=mi===11?year+1:year;
 return{month:m,monthIndex:mi,year:year,label:m+' '+year,deadlineMonth:MONTHS[dm],deadlineMonthIndex:dm,deadlineYear:dy,deadlineMonthLabel:MONTHS[dm]+' '+dy};
}

function mkUser(id,name,username,role,division){return{id,name,username,role,division:division||'',active:true,present:true,pw:'',mustChange:false,lastLogin:null};}

const now=new Date().toISOString();
/* Starting Leave Type list. It is only a starting point: it is stored in the database and the System
   Administrator adds, edits and activates / deactivates leave types under Reference lists. */
function defaultLeaveTypes(){return ['Vacation Leave','Sick Leave','Special Leave','Other'].map((n,i)=>({id:['vacation','sick','special','other'][i],name:n,description:'',active:true,createdAt:now,updatedAt:now}));}
function baseState(){
 const users=[
  mkUser('sysadmin','System Administrator','admin','sysadmin','Admin'),
  mkUser('paling','Marian Grace Paling','mpaling','admin_staff','Admin'),
  mkUser('pacaanas','Judy Ann T. Pacaanas','jpacaanas','admin_staff','Admin'),
  mkUser('aquino','Mary Flor F. Aquino','maquino','focal','CMSD'),
  mkUser('cabrera','Aubrey Camille C. Cabrera','acabrera','focal','CMED'),
  mkUser('nieva','Benjamin A. Nieva','bnieva','supervisor',''),
  mkUser('tabilas','Maria Urduja Jean V. Tabilas','mtabilas','supervisor',''),
  mkUser('delrosario','Anne Katrina S. Del Rosario','adelrosario','supervisor',''),
  mkUser('mojica','Rey Reginald A. Mojica','rmojica','supervisor',''),
  mkUser('torino','Rodolfo M. Torino Jr','rtorino','supervisor',''),
  mkUser('cabalfin','Bryan L. Cabalfin','bcabalfin','staff',''),
  mkUser('tanguilig','Janelle Vanessa E. Tanguilig','jtanguilig','staff',''),
  mkUser('cruz','Danezel Christian G. Cruz','dcruz','staff',''),
  mkUser('salvador','John Nicolo V. Salvador','jsalvador','staff',''),
  mkUser('aprochevado','Christian Joyce N. Aprochevado','caprochevado','staff','CMSD'),
  mkUser('martinez','Myles Rovi P. Martinez','mmartinez','div_manager','CMED'),
  mkUser('villarete','Judy F. Villarete','jvillarete','div_manager','CMSD'),
  mkUser('hanova','Oscar B. Hanova Jr.','ohanova','dept_manager','Department')
 ];
 const des=[['HTTRD','cabrera'],['GSD','cabrera'],['NORTH Sector','salvador'],['SOUTH Sector','salvador'],['EAST Sector','salvador'],['WEST Sector','salvador'],['Region 1','salvador'],['Region 2','salvador'],
  ['Region 3','cabalfin'],['Region 4','cabalfin'],['R4TYPH','cabalfin'],['Region 5','cabalfin'],['Region 6','torino'],['R6TYPH-DISTRICT 1','torino'],['R6TYPH-DISTRICT 2','torino'],['R6TYPH-DISTRICT 3','torino'],
  ['Region 7','delrosario'],['R7 TYPH','delrosario'],['Region 8','tabilas'],['R8TYPH-LEYTE 1','tabilas'],['R8TYPH-LEYTE 2','tabilas'],['R8TYPH-SAMAR 2','tabilas'],['Region 9','delrosario'],
  ['Region 10','cruz'],['Region 11','cruz'],['Region 12','cruz'],['Region 13','cruz']].map(a=>({name:a[0],staff:a[1]}));
 const docTypes=['Inspection Report','Consolidated CMR and PPR','External Communication','Internal Communications','Minutes of Meeting','Lacking Documents','SM1 and SM2','Internal Request','For review - SOTEVO','For review/Comments - Other docs','Travel Order','Office Order','For staff reference','CPES','Summary of CMR','Summary of PPR','CMR and PPR Tracking','Project Completion Inspection Report','Project Acceptance Report','Acceptance Committee','Cash Advance / Reimbursement','Notice of Inspection','BAC-Other works','Consolidated CMR and PPR to COA','List of Terminated'];
 return{
  v:1,users,docs:[],audit:[],seq:{},schedules:[],leaveTypes:defaultLeaveTypes(),
  perms:JSON.parse(JSON.stringify(DEFAULT_PERMS)),
  divisions:[{code:'CMED',focal:'cabrera'},{code:'CMSD',focal:'aquino'},{code:'Admin',focal:'pacaanas'},{code:'Department',focal:'hanova'}],
  refs:{
   tx:[{name:'Simple Transaction',days:3},{name:'Complex Transaction',days:7},{name:'Highly Technical',days:21},{name:'Regular Report',days:7},{name:'For information only',days:null},{name:'Special Deadline',days:null,special:true}],
   comm:['Memorandum','Letter','Certification','RDTF','Email','Verbal Request'].map(n=>({name:n,description:'',active:true,createdAt:now,updatedAt:now})),
   /* threshold/unit/basis are set by the System Administrator; "regular" is kept only so that data
      written before this configuration existed still loads (see migrateState). */
   doc:docTypes.map(n=>({name:n,description:DOC_DESCR[n]||'',threshold:n===REGULAR_DOC?REGULAR_DAYS:null,unit:'working_days',basis:n===REGULAR_DOC?'reporting_period':'working_days',active:true,regular:false,createdAt:now,updatedAt:now}))
  },
  designations:des,
  holidays:[['2026-01-01',"New Year's Day"],['2026-04-02','Maundy Thursday'],['2026-04-03','Good Friday'],['2026-04-09','Araw ng Kagitingan'],['2026-05-01','Labor Day'],['2026-06-12','Independence Day'],['2026-08-31','National Heroes Day'],['2026-11-30','Bonifacio Day'],['2026-12-25','Christmas Day'],['2026-12-30','Rizal Day']].map(a=>({date:a[0],name:a[1]})),
  oic:{enabled:false,userId:''},
  settings:{orgName:'Document Tracking & Routing System',prefix:'DTS',dueSoonDays:1,adminDeskDays:1,focalDeskDays:1,resubmit:'returner',idleMinutes:30}
 };
}

/* =====================  PERMISSIONS  ===================== */
const isOIC=u=>!!(u&&S.oic.enabled&&S.oic.userId===u.id);
const FOCAL_GRANTS=['doc.assign','doc.review_sup','doc.comment'];
const isDivFocal=u=>!!u&&S.divisions.some(d=>d.focal===u.id);
const SUP_OF={salvador:'torino',cruz:'tabilas',cabalfin:'delrosario'};
const REVIEWER_OF={torino:'cabrera',tabilas:'cabrera',delrosario:'cabrera'};
const FOCAL_REVIEWER={'cabrera':'martinez'};
const REVIEW_LINE=Object.assign({},SUP_OF,REVIEWER_OF,FOCAL_REVIEWER);
const subordinatesOf=uid=>Object.keys(SUP_OF).filter(s=>SUP_OF[s]===uid);
function regionScope(u){
 if(!u||has(u,'doc.override')||['sysadmin','dept_manager','div_manager','focal'].includes(u.role)||isDivFocal(u))return null;
 if(u.role==='supervisor'){const subs=subordinatesOf(u.id);return subs.length?new Set([u.id,...subs]):new Set([u.id]);}
 if(u.role==='staff')return new Set([u.id]);
 return null;
}
function has(u,p){if(!u)return false;if(u.role==='sysadmin')return true;if((S.perms[u.role]||[]).includes(p))return true;if(isOIC(u)&&OIC_GRANTS.includes(p))return true;return FOCAL_GRANTS.includes(p)&&isDivFocal(u);}
const divOf=code=>S.divisions.find(d=>d.code===code)||null;
const divFocal=code=>{const d=divOf(code);return d&&d.focal?uById(d.focal):null;};
function divManagers(d){const all=S.users.filter(u=>u.active&&u.role==='div_manager');const same=all.filter(u=>u.division===d.division);return same.length?same:all;}
function deptApprovers(d){
 const dm=S.users.filter(u=>u.active&&u.role==='dept_manager'&&u.present);
 if(dm.length)return{tier:'Department Manager',users:dm};
 const dv=divManagers(d).filter(u=>u.present);
 if(dv.length)return{tier:'Division Manager (acting)',users:dv};
 const o=S.oic.enabled?uById(S.oic.userId):null;
 if(o&&o.active)return{tier:'OIC',users:[o]};
 return{tier:'none',users:[]};
}
const tierOf=u=>u.role==='dept_manager'?'Department Manager':isOIC(u)&&u.role!=='div_manager'?'OIC':u.role==='div_manager'?'Division Manager (acting)':u.role==='sysadmin'?'System Administrator (override)':isOIC(u)?'OIC':'Authorised signatory';
const isFocalOf=(u,d)=>{const f=divOf(d.division);return !!(f&&f.focal===u.id);};
const isDivMgrOf=(u,d)=>u.role==='div_manager'&&divManagers(d).some(x=>x.id===u.id);
const RETURNABLE=['at_focal','processing','compliance','sup_review','div_review','dept_review'];
function can(u,d,a,strict){
 if(!u||!d)return false;
 const ov=!strict&&has(u,'doc.override');
 switch(a){
  case 'forward':return d.status==='received'&&(has(u,'doc.forward')||ov);
  case 'edit':return d.status==='received'?(has(u,'doc.edit')||ov):ov;
  case 'assign':return d.status==='at_focal'&&((has(u,'doc.assign')&&isFocalOf(u,d))||ov);
  case 'reassign':return ['processing','compliance','sup_review','div_review','dept_review'].includes(d.status)&&((has(u,'doc.assign')&&isFocalOf(u,d))||u.role==='dept_manager'||isDivMgrOf(u,d)||u.role==='supervisor'||ov);
  case 'submit':return (d.status==='processing'||d.status==='compliance')&&((has(u,'doc.process')&&d.assignee===u.id)||ov);
  case 'sup_return':case 'sup_approve':return d.status==='sup_review'&&
   ((d.reviewer===u.id&&(has(u,'doc.review_sup')||['div_manager','dept_manager'].includes(u.role)))||ov);
  case 'div_return':case 'div_approve':return (d.status==='div_review'&&(has(u,'doc.review_div')&&isDivMgrOf(u,d)))||ov;
  case 'dept_return':case 'dept_clear':{
   if(ov)return true;
   if(!['dept_review','div_review','sup_review'].includes(d.status))return false;
   // dept_manager can always clear; div_manager of this division can clear (override capability); OIC when enabled
   if(u.role==='dept_manager'&&u.present)return has(u,'doc.review_dept');
   if(isDivMgrOf(u,d)&&has(u,'doc.review_dept'))return true;
   return has(u,'doc.review_dept')&&deptApprovers(d).users.some(x=>x.id===u.id);
  }
  case 'instruct_return':return RETURNABLE.includes(d.status)&&((has(u,'doc.return_instruct')&&(u.role==='dept_manager'||isOIC(u)||isDivMgrOf(u,d)))||ov);
  case 'logout':return (d.status==='cleared'||d.status==='return_out')&&(has(u,'doc.logout')||ov);
  case 'comment':return has(u,'doc.comment')&&canView(u,d);
  case 'delete':return has(u,'doc.delete');
 }
 return false;
}
function isMyTurn(u,d){
 if(!u||u.role==='sysadmin')return false;
 switch(d.status){
  case 'received':return can(u,d,'forward',true);
  case 'at_focal':return can(u,d,'assign',true);
  case 'processing':case 'compliance':return can(u,d,'submit',true);
  case 'sup_review':return can(u,d,'sup_approve',true);
  case 'div_review':return can(u,d,'div_approve',true);
  case 'dept_review':return can(u,d,'dept_clear',true);
  case 'cleared':case 'return_out':return can(u,d,'logout',true);
 }
 return false;
}
function canView(u,d){return !!u;}
const visibleDocs=u=>u?S.docs:[];

/* =====================  WORKING DAYS & DEADLINES  ===================== */
const isWork=d=>{const g=d.getDay();return g!==0&&g!==6&&!HS.has(isoD(d));};
function addWD(from,n){let d=sod(from),c=0;while(c<n){d=addDays(d,1);if(isWork(d))c++;}return d;}
function wdBetween(a,b){const A=sod(a),B=sod(b);if(+A===+B)return 0;const sign=B>A?1:-1;const s=sign>0?A:B,e=sign>0?B:A;let c=0,d=s;while(d<e){d=addDays(d,1);if(isWork(d))c++;}return sign*c;}
function elapsed(from,to){to=to||new Date();const ms=to-new Date(from);const wd=Math.abs(wdBetween(from,to));if(wd>=1)return plural(wd,'working day');const h=Math.floor(ms/36e5);if(h>=24)return Math.round(h/24)+' calendar days (non-working)';if(h>=1)return h+' h';return Math.max(1,Math.floor(ms/6e4))+' min';}
const getTx=n=>S.refs.tx.find(t=>t.name===n)||null;
function computeDue(tx,at,special){if(!tx)return null;if(tx.special)return special||null;if(tx.days)return isoD(addWD(at,tx.days));return null;}

/* --- document types: the prescribed deadline configuration (database backed, set by the System Administrator) --- */
const DEADLINE_UNITS=[['working_days','Working days'],['calendar_days','Calendar days']];
const DEADLINE_BASES=[
 ['working_days','Working days from assignment'],
 ['calendar_days','Calendar days from assignment'],
 ['reporting_period','Working days in the month after the reporting period']
];
const docTypeOf=name=>S.refs.doc.find(x=>x.name===name)||null;
const isDeadlineBasis=b=>DEADLINE_BASES.some(x=>x[0]===b);
/* The stored basis wins; the old "Regular Report" flag is only read as a fallback for data written
   before the deadline configuration existed. It is no longer used to work out a deadline. */
const docTypeBasis=t=>{if(!t)return 'working_days';if(isDeadlineBasis(t.basis))return t.basis;return 'working_days';};
const docTypeUnit=t=>(t&&t.unit==='calendar_days')?'calendar_days':'working_days';
const docTypeThreshold=t=>{const n=t?Number(t.threshold):NaN;return Number.isFinite(n)&&n>0?Math.round(n):0;};
const isRegularDoc=name=>{const t=docTypeOf(name);return !!t&&docTypeBasis(t)==='reporting_period';};
const activeDocTypes=inc=>S.refs.doc.filter(t=>t.active!==false||t.name===inc);
const activeCommTypes=inc=>S.refs.comm.filter(c=>c.active!==false||c.name===inc);
const commName=c=>typeof c==='string'?c:((c&&c.name)||'');
/* THE ONE PLACE A DUE DATE IS WORKED OUT. Order of precedence:
   1. the prescribed threshold configured for the document type — this always governs, so a
      calculated deadline cannot be typed over from the desk,
      - counted in working or calendar days from assignment, or
      - the n-th working day of the month following the document's reporting period,
   2. for a document type with no threshold of its own, a special deadline chosen by the focal
      (the existing authorised workflow), otherwise the type of transaction. */
function computeDeadline(o){
 o=o||{};
 const at=sod(o.at||new Date()),tx=getTx(o.txType);
 const t=docTypeOf(o.docType),basis=docTypeBasis(t),thr=docTypeThreshold(t),unit=docTypeUnit(t);
 const out={ok:true,clockStart:at.toISOString(),dueAt:null,basis:basis,threshold:thr,unit:unit,period:null,source:'none',label:'No deadline'};
 if(thr>0&&basis==='reporting_period'){
  const info=reportingPeriodInfo(o.reportingPeriod,at);
  if(!info)return{ok:false,error:'Choose the reporting period: the month covered by the report.',needPeriod:true};
  const due=unit==='calendar_days'?new Date(info.deadlineYear,info.deadlineMonthIndex,thr):nthWorkdayOfMonth(info.deadlineYear,info.deadlineMonthIndex,thr);
  out.clockStart=firstWorkdayOfMonth(info.deadlineYear,info.deadlineMonthIndex).toISOString();
  out.dueAt=isoD(due);out.period=info;out.source='document type';
  out.label=(unit==='calendar_days'?plural(thr,'calendar day'):'the '+ordinal(thr)+' working day')+' of '+info.deadlineMonthLabel;
  return out;
 }
 if(thr>0){
  out.dueAt=isoD(unit==='calendar_days'?addDays(at,thr):addWD(at,thr));out.source='document type';
  out.label=unit==='calendar_days'?plural(thr,'calendar day')+' from assignment':plural(thr,'working day')+' from assignment';
  return out;
 }
 if(tx&&tx.special){out.dueAt=o.special||null;out.source='transaction type';out.label=out.dueAt?'Special deadline':'No deadline';return out;}
 if(tx&&tx.days){out.dueAt=isoD(addWD(at,tx.days));out.source='transaction type';out.label=plural(tx.days,'working day')+' from assignment';return out;}
 return out;
}
/* True when the deadline of this document type comes from its configuration, so the desk cannot set it. */
const hasPrescribedDeadline=name=>docTypeThreshold(docTypeOf(name))>0;
/* Safe, repeatable data migration: old reference lists (plain names, and the old "regular" flag)
   are upgraded in place. Nothing is deleted and no document is touched. */
function migrateState(){
 if(!S||!S.refs)return false;
 const now=new Date().toISOString();let changed=false;
 S.refs.comm=(S.refs.comm||[]).map(c=>{
  if(typeof c==='string'){changed=true;return{name:c,description:'',active:true,createdAt:now,updatedAt:now};}
  if(!c||!String(c.name||'').trim()){changed=true;return null;}
  const o={name:String(c.name).trim(),description:String(c.description==null?'':c.description),active:c.active===false?false:true,createdAt:c.createdAt||now,updatedAt:c.updatedAt||c.createdAt||now};
  if(o.name!==c.name||c.description===undefined||c.active===undefined||!c.createdAt)changed=true;
  return o;
 }).filter(Boolean);
 S.refs.doc=(S.refs.doc||[]).map(t=>{
  if(!t||!String(t.name||'').trim()){changed=true;return null;}
  const o=Object.assign({},t,{name:String(t.name).trim()});
  if(o.description===undefined){o.description='';changed=true;}
  if(o.threshold===undefined){o.threshold=o.regular?6:null;changed=true;}
  if(o.unit===undefined){o.unit='working_days';changed=true;}
  if(o.basis===undefined){o.basis=o.regular?'reporting_period':'working_days';changed=true;}
  if(o.active===undefined){o.active=true;changed=true;}
  if(!o.createdAt){o.createdAt=now;changed=true;}
  if(!o.updatedAt){o.updatedAt=o.createdAt;changed=true;}
  if(o.regular){o.regular=false;changed=true;} /* the old flag is kept on the record but is no longer used */
  return o;
 }).filter(Boolean);
 return changed;
}
function dl(d){
 if(!d.clockStart)return{key:'pending',label:'Clock not started',tone:'neu'};
 if(!d.dueAt)return{key:'none',label:'No deadline',tone:'neu'};
 const due=parseD(d.dueAt);
 if(d.stopAt){const late=sod(d.stopAt)>due;if(late){const n=wdBetween(due,d.stopAt);return{key:'done_late',label:'Completed late'+(n>0?' by '+plural(n,'working day'):''),tone:'bad'};}return{key:'done_ok',label:'Completed on time',tone:'ok'};}
 const today=sod(new Date()),rem=wdBetween(today,due);
 if(today>due){const n=-rem;return{key:'over',label:'Overdue'+(n>0?' by '+plural(n,'working day'):''),tone:'bad',n:n};}
 if(rem<=S.settings.dueSoonDays)return{key:'soon',label:rem===0?'Due today':'Due in '+plural(rem,'working day'),tone:'warn',n:rem};
 return{key:'ok',label:plural(rem,'working day')+' left',tone:'ok',n:rem};
}
const isClockActive=d=>!!d.clockStart&&!d.stopAt&&d.status!=='out';
function stalled(d){
 let lim=null;
 if(d.status==='received'||d.status==='cleared'||d.status==='return_out')lim=S.settings.adminDeskDays;
 else if(d.status==='at_focal')lim=S.settings.focalDeskDays;
 if(!lim||lim<=0)return false;
 return wdBetween(d.stageEnteredAt,new Date())>lim;
}
function deskInfo(d){
 switch(d.status){
  case 'received':return{label:'Admin desk',who:[uname(d.createdBy)]};
  case 'at_focal':{const f=divFocal(d.division);return{label:'Focal / Supervisor',who:[f?f.name:'(no focal set for '+d.division+')']};}
  case 'processing':return{label:'Staff – processing',who:[uname(d.assignee)]};
  case 'compliance':return{label:'Staff – for compliance',who:[uname(d.assignee)]};
  case 'sup_review':return{label:'Supervisor review',who:[uname(d.reviewer)]};
  case 'div_review':return{label:'Division Manager',who:divManagers(d).map(x=>x.name)};
  case 'dept_review':{const a=deptApprovers(d);return{label:a.tier==='none'?'Department Manager (no one available)':a.tier,who:a.users.map(x=>x.name)};}
  case 'cleared':return{label:'Admin desk – log out',who:['Admin staff']};
  case 'return_out':return{label:'Admin desk – log out (for return)',who:['Admin staff']};
  case 'out':return{label:'Released',who:[d.outBy?uname(d.outBy):'']};
 }
 return{label:'',who:[]};
}
const deskText=d=>{const i=deskInfo(d);const w=i.who.filter(Boolean).join(', ');return i.label+(w&&d.status!=='out'?' – '+w:'');};
const isOpen=d=>d.status!=='out';
function resubmitTarget(d){
 if(d.status==='compliance'&&S.settings.resubmit==='returner'&&d.returnedFrom)return{sup:'sup_review',div:'div_review',dept:'dept_review'}[d.returnedFrom]||'sup_review';
 return 'sup_review';
}

/* =====================  WORKFLOW ENGINE  ===================== */
function audit(by,action,detail){S.audit.push({at:new Date().toISOString(),by:by||'',action,detail:detail||''});if(S.audit.length>800)S.audit.splice(0,S.audit.length-800);}
function createDoc(o,by,at){
 const yr=at.getFullYear();S.seq[yr]=(S.seq[yr]||0)+1;
 const d={id:uid(),trackNo:S.settings.prefix+'-'+yr+'-'+String(S.seq[yr]).padStart(4,'0'),receivedAt:at.toISOString(),commType:o.commType,source:o.source,refNo:o.refNo||'',subject:o.subject,docType:o.docType,division:o.division,pages:o.pages||'',priority:o.priority||'Normal',region:o.region||'',reportingPeriod:o.reportingPeriod?normMonth(o.reportingPeriod):'',remarks:o.remarks||'',url:o.url||'',draftUrl:o.draftUrl||'',revUrl:o.revUrl||'',revCount:0,txType:'',dueAt:null,clockStart:null,stopAt:null,deadlineSource:'',deadlineLabel:'',threshold:null,deadlineUnit:'',deadlineMonth:'',assignee:'',reviewer:'',status:'received',createdBy:by,stageEnteredAt:at.toISOString(),cycles:0,returnedFrom:null,comments:[],history:[]};
 d.history.push({at:d.receivedAt,by:by,action:'Received and logged',to:'received',desk:'Admin desk',remarks:o.remarks||''});
 S.docs.push(d);return d;
}
/* validates and logs a document; document types whose deadline runs from a reporting period bypass the focal */
function logDoc(o,by,at,forward,seed){
 at=at||new Date();
 if(!o.subject||!o.subject.trim())return{ok:false,error:'Enter the subject or particulars of the document.'};
 const t=docTypeOf(o.docType);
 if(!t)return{ok:false,error:'Choose a valid document type.'};
 const reg=isRegularDoc(o.docType);
 /* A report whose deadline runs from a reporting period is routed by region, so its screen no longer
    asks for a division. Fill it in here so the record always carries one for the register, the tiles
    and the reports: the division of the staff designated for that region when it is known, otherwise
    the division of the person logging it. Routing itself stays by region and is untouched. */
 if(reg&&!S.divisions.some(x=>x.code===o.division)){
  const desig=S.designations.find(x=>x.name===o.region),dst=desig?uById(desig.staff):null;
  const me=by?uById(by):null;
  const pick=[dst&&dst.division,me&&me.division].find(v=>v&&S.divisions.some(x=>x.code===v));
  o.division=pick||(S.divisions[0]?S.divisions[0].code:'');
 }
 if(!o.commType||!o.docType||!o.division||!(o.source||'').trim())return{ok:false,error:'Communication type, source, document type and division are required.'};
 if(!activeCommTypes(o.commType).length)return{ok:false,error:'That communication type is no longer in use. Choose another one.'};
 const period=o.reportingPeriod?normMonth(o.reportingPeriod):'';
 if(o.reportingPeriod&&!period)return{ok:false,error:'Choose the reporting period from the twelve months of the year.'};
 let des=null;
 if(reg){des=S.designations.find(x=>x.name===o.region);if(!des)return{ok:false,error:'Choose the region or office this report came from.'};const st=uById(des.staff);if(!st||!st.active)return{ok:false,error:'The staff designated for '+o.region+' is inactive. Update it in Reference lists.'};}
 const regPeriod=docTypeThreshold(t)>0&&docTypeBasis(t)==='reporting_period';
 if(regPeriod&&!period)return{ok:false,error:'Choose the reporting period: the month covered by this report.'};
 if(!reg&&forward&&!divFocal(o.division))return{ok:false,error:'No Focal / Supervisor is set for '+o.division+'. Ask the System Administrator to set one under Divisions & focals, or save without forwarding.'};
 const d=createDoc(o,by,at);
 d.reportingPeriod=period;
 if(reg){
  const x=computeDeadline({docType:o.docType,at:at,reportingPeriod:period});
  if(!x.ok)return{ok:false,error:x.error};
  d.txType=TX_REGULAR;d.assignee=des.staff;d.autoRouted=true;
  d.clockStart=x.clockStart||at.toISOString();d.dueAt=x.dueAt||null;
  d.deadlineSource=x.source;d.deadlineLabel=x.label;d.threshold=x.threshold||null;d.deadlineUnit=x.unit||'working_days';
  if(x.period){d.deadlineMonth=x.period.deadlineMonthLabel;d.reportingYear=x.period.year;}
  d.status='processing';d.stageEnteredAt=at.toISOString();
  d.history.push({at:at.toISOString(),by:by,action:'Routed straight to designated staff (focal bypassed)',to:'processing',desk:deskText(d),remarks:(period?'Reporting period: '+period+'. ':'')+'Region / office: '+o.region});
  return{ok:true,doc:d,msg:d.trackNo+' logged and routed to '+uname(des.staff)+'.'};
 }
 if(forward){const r=act(d.id,by,'forward',{},at,{seed:seed});if(!r.ok){return r;}return{ok:true,doc:d,msg:d.trackNo+' logged and forwarded to '+r.msg.replace('Forwarded to ','')};}
 return{ok:true,doc:d,msg:d.trackNo+' logged. It is waiting at the Admin desk to be forwarded.'};
}
function act(id,actorId,type,p,at,opts){
 p=p||{};at=at||new Date();opts=opts||{};
 const d=S.docs.find(x=>x.id===id),u=uById(actorId);
 const bad=e=>({ok:false,error:e});
 if(!d)return bad('Document not found.');
 if(!u)return bad('Unknown user.');
 if(!opts.seed&&type!=='set_urls'&&!can(u,d,type))return bad('You are not authorised to do that at this stage.');
 const mv=(action,to,remarks)=>{d.status=to;d.stageEnteredAt=at.toISOString();d.history.push({at:at.toISOString(),by:u.id,action:action,to:to,desk:deskText(d),remarks:remarks||''});};
 const note=(action,remarks)=>{d.history.push({at:at.toISOString(),by:u.id,action:action,to:d.status,desk:deskText(d),remarks:remarks||''});};
 const txt=(p.text||'').trim();
 switch(type){
  case 'forward':{
   const f=divFocal(d.division);if(!f)return bad('No Focal / Supervisor is set for '+d.division+'. Ask the System Administrator to set one under Divisions & focals.');
   d.forwardedAt=at.toISOString();mv('Forwarded to Focal / Supervisor','at_focal',p.remarks);return{ok:true,msg:'Forwarded to '+f.name+'.'};}
  case 'assign':{
   const tx=getTx(p.txType);
   if(!tx)return bad('Choose the type of transaction.');
   if(!p.docType)return bad('Choose the document type.');
   if(!p.assignee)return bad('Choose the staff who will process this document.');
   {const as=uById(p.assignee);if(!as||!as.active||!['staff','supervisor','focal'].includes(as.role))return bad('Choose an active staff member, supervisor or focal to process this document.');
    if(tx.name==='For information only'&&!(as.role==='focal'||isDivFocal(as)))return bad('Documents marked "For information only" can only be assigned to a Division Focal.');}
   if(tx.special&&!p.dueDate&&!hasPrescribedDeadline(p.docType))return bad('Set the special deadline date.');
   if(tx.special&&p.dueDate&&sod(parseD(p.dueDate))<sod(at)&&!hasPrescribedDeadline(p.docType))return bad('The special deadline cannot be in the past.');
   const period=p.reportingPeriod!==undefined?(normMonth(p.reportingPeriod)||''):(d.reportingPeriod||'');
   if(p.reportingPeriod&&!period)return bad('Choose the reporting period from the twelve months of the year.');
   const x=computeDeadline({docType:p.docType,txType:tx.name,at:at,special:p.dueDate,reportingPeriod:period});
   if(!x.ok)return bad(x.error);
   const changed=d.docType!==p.docType;d.docType=p.docType;d.txType=tx.name;d.assignee=p.assignee;d.assignedBy=u.id;
   d.reportingPeriod=period;d.clockStart=x.clockStart||at.toISOString();d.dueAt=x.dueAt||null;
   d.deadlineSource=x.source;d.deadlineLabel=x.label;d.threshold=x.threshold||null;d.deadlineUnit=x.unit||'working_days';
   d.deadlineMonth=x.period?x.period.deadlineMonthLabel:'';if(x.period)d.reportingYear=x.period.year;
   mv('Assigned to '+uname(p.assignee)+' ('+tx.name+')','processing',(p.note||'')+(changed?((p.note?'\n':'')+'Document type set to '+p.docType+'.'):''));
   return{ok:true,msg:'Assigned to '+uname(p.assignee)+'. The clock started'+(d.dueAt?'; due '+fmtD(parseD(d.dueAt))+' ('+d.deadlineLabel+').':'.')};}
  case 'reassign':{
   if(!p.assignee||p.assignee===d.assignee)return bad('Choose a different staff member.');
   {const as=uById(p.assignee);if(!as||!as.active||!['staff','supervisor','focal'].includes(as.role))return bad('Choose an active staff member, supervisor or focal.');}
   const from=uname(d.assignee);d.assignee=p.assignee;mv('Reassigned from '+from+' to '+uname(p.assignee),d.status,p.note);return{ok:true,msg:'Reassigned to '+uname(p.assignee)+'.'};}
  case 'submit':{
   const comp=d.status==='compliance',target=resubmitTarget(d);
   if(comp&&!txt)return bad('Describe how you complied with the comments.');
   if(target==='sup_review'){const rv=p.reviewer||(comp?d.reviewer:'');if(!rv)return bad('Choose the Supervisor or Focal / Supervisor who will review.');{const rr=uById(rv);if(!rr||!rr.active||!(['supervisor','focal','div_manager','dept_manager'].includes(rr.role)||isDivFocal(rr)))return bad('The reviewer must be an active Supervisor, Focal / Supervisor, or Manager.');}if(rv===u.id)return bad('You cannot review your own work.');d.reviewer=rv;}
   d.comments.forEach(c=>{if(!c.resolved&&c.level!=='instruction'){c.resolved=true;c.resolvedAt=at.toISOString();c.response=txt;}});
   d.returnedFrom=null;
   mv(comp?'Complied and resubmitted':'Submitted for review',target,txt);
   return{ok:true,msg:'Submitted to '+deskText(d).replace(/^.*? – /,'')+'.'};}
  case 'sup_return':case 'div_return':case 'dept_return':{
   const lvl=type.split('_')[0];
   if(!txt)return bad('Enter your comments. The document goes back to staff for compliance.');
   d.comments.push({id:uid(),at:at.toISOString(),by:u.id,level:lvl,text:txt,resolved:false});
   d.returnedFrom=lvl;d.cycles=(d.cycles||0)+1;mv('Returned to staff for compliance','compliance',txt);return{ok:true,msg:'Returned to '+uname(d.assignee)+' for compliance.'};}
  case 'sup_approve':mv('Reviewed by Supervisor – no comments','div_review',txt);return{ok:true,msg:'Forwarded to the Division Manager.'};
  case 'div_approve':mv('Reviewed by Division Manager – no comments','dept_review',txt);return{ok:true,msg:'Forwarded for final review.'};
  case 'dept_return':case 'dept_clear':{
   const tier=tierOf(u);d.clearedAt=at.toISOString();d.clearedBy=u.id;d.clearedTier=tier;d.stopAt=at.toISOString();
   mv('Cleared for out ('+tier+')','cleared',txt);return{ok:true,msg:'Cleared for out. The Admin desk can now log it out.'};}
  case 'instruct_return':{
   const reason=txt||(p.reason||'').trim();
   if(!reason)return bad('Enter the reason for returning the document.');
   const tier=tierOf(u);d.returnInstructedBy=u.id;d.returnTier=tier;d.stopAt=d.stopAt||at.toISOString();
   d.comments.push({id:uid(),at:at.toISOString(),by:u.id,level:'instruction',text:reason,resolved:true});
   mv('Instructed to return to sender ('+tier+')','return_out',reason);return{ok:true,msg:'The Admin desk will log this out with the remark "For return".'};}
  case 'logout':{
   if(!(p.outTo||'').trim())return bad('Enter who the document is released to.');
   const ret=d.status==='return_out';
   let when=p.outAt?new Date(p.outAt):at;if(isNaN(when))when=at;const last=new Date(d.history[d.history.length-1].at);if(when<last)when=last;if(when>new Date(at.getTime()+6e4*5)&&!opts.seed)when=at;
   at=when;d.outAt=when.toISOString();d.outBy=u.id;d.outTo=p.outTo.trim();d.outType=ret?'For return':'Cleared for out';
   d.outRemarks=ret?('For return'+(p.remarks?' – '+p.remarks:'')):(p.remarks||'');
   mv(ret?'Logged out – for return':'Logged out – cleared for out','out',d.outRemarks);return{ok:true,msg:'Logged out.'};}
  case 'set_urls':{
   const allowed=has(u,'doc.override')||u.id===d.assignee||(REVIEW_LINE[d.assignee]===u.id)||isDivMgrOf(u,d)||u.role==='dept_manager'||u.role==='sysadmin';
   if(!allowed)return bad('Only the assigned staff, their supervisor, a Division Manager or System Administrator can update file links.');
   const urlOk=v=>!v||/^https?:\/\/.{3}/.test(v);
   if(p.draftUrl!==undefined&&!urlOk(p.draftUrl))return bad('Draft File URL must start with http:// or https://');
   if(p.revUrl!==undefined&&!urlOk(p.revUrl))return bad('Revised File URL must start with http:// or https://');
   if(p.url!==undefined&&!urlOk(p.url))return bad('Document URL must start with http:// or https://');
   const changed=[];
   if(p.draftUrl!==undefined&&p.draftUrl!==d.draftUrl){d.draftUrl=p.draftUrl;changed.push('Draft File URL');}
   if(p.revUrl!==undefined&&p.revUrl!==d.revUrl){
    if(d.revUrl&&p.revUrl)d.revCount=(d.revCount||0)+1;
    d.revUrl=p.revUrl;changed.push('Revised File URL (revision #'+d.revCount+')');
   }
   if(p.url!==undefined&&p.url!==d.url){d.url=p.url;changed.push('Document URL');}
   if(!changed.length)return{ok:true,msg:'No changes made.'};
   note('URLs updated: '+changed.join(', '),'');
   return{ok:true,msg:'URLs saved.'};
  }
  case 'comment':{if(!txt)return bad('Write a note first.');note('Note added',txt);return{ok:true,msg:'Note added.'};}
  case 'edit':{
   const f=['commType','source','refNo','subject','docType','division','pages','priority','remarks'];
   if(!(p.subject||'').trim())return bad('Enter the subject or particulars.');
   if(p.docType&&!docTypeOf(p.docType))return bad('Choose a valid document type.');
   if(p.reportingPeriod!==undefined&&p.reportingPeriod&&!normMonth(p.reportingPeriod))return bad('Choose the reporting period from the twelve months of the year.');
   for(const [k,l] of [['draftUrl','Draft File URL'],['revUrl','Revised File URL'],['url','Document URL']])if(p[k]&&!/^https?:\/\/.{3}/.test(String(p[k]).trim()))return bad(l+' must start with http:// or https://');
   f.forEach(k=>{if(p[k]!==undefined)d[k]=typeof p[k]==='string'?p[k].trim():p[k];});
   ['draftUrl','url'].forEach(k=>{if(p[k]!==undefined)d[k]=p[k].trim();});
   if(p.revUrl!==undefined){const nv=p.revUrl.trim();if(d.revUrl&&nv&&nv!==d.revUrl)d.revCount=(d.revCount||0)+1;d.revUrl=nv;}
   /* the division is not shown for a reporting-period report, so never let it be blanked */
   if(isRegularDoc(d.docType)&&!S.divisions.some(x=>x.code===d.division))d.division=S.divisions[0]?S.divisions[0].code:'';
   if(p.reportingPeriod!==undefined)d.reportingPeriod=normMonth(p.reportingPeriod);
   if(p.receivedAt){const ra=new Date(p.receivedAt);if(!isNaN(ra)){d.receivedAt=ra.toISOString();}}
   /* the calculated deadline is derived again from the document type configuration and the reporting period */
   if(!d.stopAt){
    const x=computeDeadline({docType:d.docType,txType:d.txType,at:d.clockStart?new Date(d.clockStart):new Date(d.receivedAt),special:d.deadlineSource==='transaction type'?d.dueAt:null,reportingPeriod:d.reportingPeriod});
    if(x.ok&&!(x.source==='none'&&d.dueAt&&d.deadlineSource!=='document type')){
     d.clockStart=x.clockStart||d.clockStart;d.dueAt=x.dueAt||null;d.deadlineSource=x.source;d.deadlineLabel=x.label;d.threshold=x.threshold||null;d.deadlineUnit=x.unit||'working_days';
     d.deadlineMonth=x.period?x.period.deadlineMonthLabel:'';if(x.period)d.reportingYear=x.period.year;
    }
   }
   note('Details edited','');return{ok:true,msg:'Details updated.'};}
  case 'delete':{S.docs.splice(S.docs.indexOf(d),1);return{ok:true,msg:'Document deleted.',deleted:true};}
 }
 return bad('Unknown action.');
}

function seedDemoDocs(){
 rebuildHS();
 const T=(a,h,m)=>{const d=addDays(sod(new Date()),-a);d.setHours(h==null?9:h,m||0,0,0);return d;};
 const A=(d,type,by,p,at)=>{if(!d)return;const r=act(d.id,by,type,p,at,{seed:true});if(!r.ok)console.warn('seed',type,r.error);};
 const L=(o,by,at,fwd)=>{const r=logDoc(o,by,at,fwd,true);if(!r.ok){console.warn('seed log',r.error);return null;}return r.doc;};
 const REG=(region,div,by,at)=>{
  const r=new Date(at||new Date());
  const pm=new Date(r.getFullYear(),r.getMonth()-1,1);
  const period=MONTHS[pm.getMonth()];
  return L({commType:'Memorandum',source:'Regional Office – '+region,refNo:'CMR-'+region.replace(/\W+/g,'').toUpperCase().slice(0,8),subject:'Consolidated CMR and PPR – '+region+', '+period+' '+pm.getFullYear(),docType:'Consolidated CMR and PPR',division:div,region:region,reportingPeriod:period,pages:String(30+Math.floor(Math.random()*30))},by,at,false);
 };
 let d;
 // Consolidated CMR and PPR (deadline: the 6th working day of the month after the reporting period)
 d=REG('Region 3','CMED','paling',T(13,9,10));
 d=REG('Region 10','CMED','pacaanas',T(2,10,5));
 d=REG('Region 6','CMSD','paling',T(8,9,30));A(d,'submit','torino',{reviewer:'nieva',text:'Consolidated report checked against the regional submissions.'},T(6,15));
 d=REG('R8TYPH-LEYTE 1','CMED','pacaanas',T(9,9,0));A(d,'submit','tabilas',{reviewer:'mojica',text:'Ready for review.'},T(8,14));A(d,'sup_approve','mojica',{},T(7,10));A(d,'div_return','martinez',{text:'Reconcile the physical accomplishment figures in Table 3 with the regional summary.'},T(5,11));
 d=REG('Region 1','CMSD','paling',T(10,9,0));A(d,'submit','salvador',{reviewer:'aquino',text:'Submitted for review.'},T(9,13));A(d,'sup_approve','aquino',{},T(8,9));A(d,'div_approve','villarete',{},T(7,14));
 d=REG('Region 12','CMED','pacaanas',T(11,9,0));A(d,'submit','cruz',{reviewer:'cabrera',text:'For review.'},T(10,10));A(d,'sup_approve','cabrera',{},T(9,9));A(d,'div_approve','martinez',{},T(8,10));A(d,'dept_clear','hanova',{text:'Cleared.'},T(3,11));
 d=REG('Region 4','CMSD','paling',T(26,9,0));A(d,'submit','cabalfin',{reviewer:'nieva',text:'For review.'},T(24,10));A(d,'sup_approve','nieva',{},T(23,10));A(d,'div_approve','villarete',{},T(22,10));A(d,'dept_clear','hanova',{text:'Cleared.'},T(21,10));A(d,'logout','paling',{outTo:'Central Office – Regional Coordination',outAt:T(20,10).toISOString(),remarks:'Hand-carried.'},T(20,10));
 // Regular flow through the focal
 d=L({commType:'Letter',source:"Provincial Engineer's Office",refNo:'PEO-2026-0412',subject:'Request for site inspection – Bridge Package B',docType:'External Communication',division:'CMED',pages:'6'},'paling',T(4,9,20),true);
 A(d,'assign','cabrera',{txType:'Complex Transaction',docType:'External Communication',assignee:'tanguilig',note:'Coordinate with the inspection team.'},T(3,9,40));
 d=L({commType:'Memorandum',source:'Bureau of Design',refNo:'BD-MEMO-118',subject:'Technical review of revised structural plans – Package 3',docType:'For review/Comments - Other docs',division:'CMSD',pages:'32'},'pacaanas',T(9,10,0),true);
 A(d,'assign','aquino',{txType:'Highly Technical',docType:'For review/Comments - Other docs',assignee:'salvador',note:'Compare with the approved design.'},T(8,9,15));
 d=L({commType:'Email',source:'JV Alpha (contractor)',refNo:'',subject:'Request for certification of completion – Project 26-0117',docType:'Project Completion Inspection Report',division:'CMED'},'paling',T(4,14,0),true);
 d=L({commType:'Certification',source:'Auditing Unit',refNo:'AU-2026-118',subject:'Certification request – accomplished projects, second quarter',docType:'External Communication',division:'CMSD'},'pacaanas',T(0,7,30),false);
 d=L({commType:'Verbal Request',source:'Office of the Department Manager',refNo:'',subject:'Travel order – site visit, Region 7',docType:'Travel Order',division:'CMED'},'paling',T(8,9,0),true);
 A(d,'assign','cabrera',{txType:'Simple Transaction',docType:'Travel Order',assignee:'cruz'},T(7,9,30));
 d=L({commType:'RDTF',source:'Regional Task Force',refNo:'',subject:'Advisory on the quarterly RDTF coordination schedule',docType:'For staff reference',division:'CMSD'},'pacaanas',T(3,10,0),true);
 A(d,'assign','aquino',{txType:'For information only',docType:'For staff reference',assignee:'aquino'},T(3,11,0));
 d=L({commType:'Letter',source:'Regional Office – Region 5',refNo:'R5-0931',subject:'Inspection report – Bridge Package 4 (expedite)',docType:'Inspection Report',division:'CMSD',priority:'Urgent',pages:'14'},'paling',T(2,9,0),true);
 A(d,'assign','aquino',{txType:'Special Deadline',docType:'Inspection Report',assignee:'tanguilig',dueDate:isoD(addDays(new Date(),3)),note:'Needed for the Monday briefing.'},T(2,10,0));
 d=L({commType:'Memorandum',source:'Bureau of Construction',refNo:'BOC-OO-77',subject:'Office order – reconstitution of the Acceptance Committee',docType:'Office Order',division:'CMED',pages:'3'},'paling',T(9,9,0),true);
 A(d,'assign','cabrera',{txType:'Simple Transaction',docType:'Office Order',assignee:'cruz'},T(8,9,0));A(d,'submit','cruz',{reviewer:'cabrera',text:'Draft prepared.'},T(7,10));A(d,'sup_approve','cabrera',{},T(6,9));A(d,'div_approve','martinez',{},T(5,10));
 A(d,'instruct_return','hanova',{text:'Return to the originating bureau. The attached roster is outdated.'},T(1,11));
 d=L({commType:'Letter',source:'Project Management Office',refNo:'PMO-2026-055',subject:'Minutes of meeting – progress conference, Package 2',docType:'Minutes of Meeting',division:'CMSD'},'pacaanas',T(24,9,0),true);
 A(d,'assign','aquino',{txType:'Simple Transaction',docType:'Minutes of Meeting',assignee:'salvador'},T(23,9,0));A(d,'submit','salvador',{reviewer:'nieva',text:'For review.'},T(17,10));A(d,'sup_approve','nieva',{},T(16,10));A(d,'div_approve','villarete',{},T(15,10));A(d,'dept_clear','hanova',{text:'Cleared.'},T(13,10));A(d,'logout','pacaanas',{outTo:'Project Management Office',outAt:T(12,10).toISOString()},T(12,10));
 d=L({commType:'Memorandum',source:'Finance Unit',refNo:'FIN-CA-204',subject:'Cash advance – field inspection, Region 9',docType:'Cash Advance / Reimbursement',division:'CMED'},'paling',T(6,9,0),true);
 A(d,'assign','cabrera',{txType:'Simple Transaction',docType:'Cash Advance / Reimbursement',assignee:'cruz'},T(5,9,30));A(d,'submit','cruz',{reviewer:'cabrera',text:'Liquidation attached.'},T(4,10));A(d,'sup_approve','cabrera',{},T(3,10));A(d,'div_approve','martinez',{},T(2,10));
 d=L({commType:'Letter',source:'Delta Builders (contractor)',refNo:'DB-0088-L2',subject:'Lacking documents – Contract 26-0088',docType:'Lacking Documents',division:'CMSD'},'pacaanas',T(6,9,0),true);
 A(d,'assign','aquino',{txType:'Complex Transaction',docType:'Lacking Documents',assignee:'salvador'},T(5,9,0));A(d,'submit','salvador',{reviewer:'aquino',text:'For review.'},T(3,10));A(d,'sup_return','aquino',{text:"Attach the updated bill of quantities and the inspector's sign-off sheet."},T(2,10));
 d=L({commType:'Memorandum',source:'Acceptance Committee Secretariat',refNo:'ACS-2026-19',subject:'Acceptance committee – final inspection schedule',docType:'Acceptance Committee',division:'CMED'},'paling',T(6,9,30),true);
 A(d,'assign','cabrera',{txType:'Highly Technical',docType:'Acceptance Committee',assignee:'tanguilig'},T(5,10,0));A(d,'submit','tanguilig',{reviewer:'nieva',text:'Schedule reconciled with the committee.'},T(1,15));
 d=L({commType:'Memorandum',source:'HR Unit',refNo:'HR-2026-041',subject:'Compliance report – CMSD staff onboarding checklist',docType:'Internal Request',division:'CMSD'},'pacaanas',T(1,9,0),true);
 A(d,'assign','aquino',{txType:'Simple Transaction',docType:'Internal Request',assignee:'aprochevado',note:'Welcome aboard \u2013 first assignment.'},T(1,9,30));
 audit('sysadmin','Demo data created','Sample documents were generated for testing.');
 return S;
}


/* =====================  PERSONNEL SCHEDULE (Phase 9)  =====================
   One schedule record = one inspection, one leave or one meeting. The people on it are ids of the
   existing user records (no second personnel table). Dates are 'YYYY-MM-DD' and times 'HH:MM', kept
   as text so the office time zone can never shift them. Conflict detection lives here so the server
   (which decides) and the browser (which displays) use exactly the same rules. */
const SCHED_TYPES=['inspection','leave','meeting'];
const leaveTypeById=id=>(S.leaveTypes||[]).find(t=>t.id===id)||null;
const leaveTypeName=id=>{const t=leaveTypeById(id);return t?t.name:'Leave';};
/* Everyone on a schedule: inspection = assigned personnel, leave = the one person, meeting = organizer + participants. */
function schedPeople(s){const a=[];if(s.type==='meeting'&&s.organizer)a.push(s.organizer);(s.personnel||[]).forEach(id=>{if(!a.includes(id))a.push(id);});return a;}
const hmMin=t=>{const a=String(t||'').split(':').map(Number);return a[0]*60+a[1];};
function fmtHM(t){if(!/^\d{2}:\d{2}$/.test(t||''))return '';const a=t.split(':').map(Number),h=a[0]%12||12;return h+':'+p2(a[1])+' '+(a[0]<12?'AM':'PM');}
const schedDates=s=>s.startDate===s.endDate?fmtD(parseD(s.startDate)):fmtD(parseD(s.startDate))+' – '+fmtD(parseD(s.endDate));
const schedTimes=s=>(s.type==='leave'||!s.startTime)?'Whole day':fmtHM(s.startTime)+' – '+fmtHM(s.endTime);
const schedTitle=s=>s.type==='leave'?leaveTypeName(s.leaveTypeId):(s.title||'');
/* Two schedules overlap when their dates meet and, if both have hours, the hours meet too.
   Leave is a whole-day matter, so any shared date with a leave is an overlap. */
function schedOverlap(a,b){
 if(a.startDate>b.endDate||b.startDate>a.endDate)return false;
 if(a.type==='leave'||b.type==='leave'||!a.startTime||!b.startTime)return true;
 return hmMin(a.startTime)<hmMin(b.endTime)&&hmMin(b.startTime)<hmMin(a.endTime);
}
/* Returns one entry per person per clashing schedule; an empty list means no conflict.
   'excludeId' is the schedule being edited, so it never conflicts with itself. */
function scheduleConflicts(c,excludeId){
 const out=[],mine=schedPeople(c);
 (S.schedules||[]).forEach(o=>{
  if(o.id===excludeId||(c.id&&o.id===c.id))return;
  const shared=schedPeople(o).filter(id=>mine.includes(id));
  if(!shared.length||!schedOverlap(c,o))return;
  const when=schedDates(o)+((o.type!=='leave'&&o.startTime)?', '+schedTimes(o):'');
  const detail=(o.type==='leave'?schedTitle(o):o.type[0].toUpperCase()+o.type.slice(1)+': '+schedTitle(o))+' – '+when;
  shared.forEach(id=>{
   const n=uname(id);let msg;
   if(c.type==='leave'&&o.type==='leave')msg=n+' already has '+schedTitle(o)+' that overlaps this leave.';
   else if(o.type==='leave')msg=n+' is already on '+schedTitle(o)+' during this scheduled '+c.type+'.';
   else if(c.type==='leave')msg=n+' is already scheduled for the '+o.type+' "'+schedTitle(o)+'" during this leave.';
   else msg=n+' is already scheduled for the '+o.type+' "'+schedTitle(o)+'" that overlaps this '+c.type+'.';
   out.push({userId:id,name:n,otherId:o.id,otherType:o.type,message:msg,detail:detail});
  });
 });
 return out;
}



/* =====================  SPECIAL REPORTS (Phase 11)  =====================
   Mandatory recurring reports the SYSTEM creates on a schedule (they are never logged by hand).
   A schedule (configuration) says which months apply, how many working days are allowed and who
   is responsible. Each due month produces ONE report obligation; each assignee gets an
   assignment that appears in For My Action.
   Deadlines reuse nthWorkdayOfMonth() (weekends and the holidays list are skipped) and the
   displayed status reuses dl(), so nothing here is a second deadline system.
   Months are stored as numbers 1-12. A period is identified by (schedule, year, month) where
   month is the "as of" month of the report (March for a quarter ending in March). */
const SR_FREQ=[['monthly','Monthly'],['quarterly','Quarterly'],['specific','Specific months'],['annual','Annual']];
/* deadline bases: only one today; the list exists so another basis can be added without touching callers */
const SR_BASES=[['working_days','Working days of the month after the reporting period']];
const SR_SPAN={monthly:1,specific:1,quarterly:3,annual:12};
const SR_HORIZON_MONTHS=24; /* missed generation is recovered for this many months back, never further */
const srFreqName=f=>(SR_FREQ.find(x=>x[0]===f)||[f,f])[1];
const isSrFreq=f=>SR_FREQ.some(x=>x[0]===f);
const isSrBasis=b=>SR_BASES.some(x=>x[0]===b);
const srCleanMonths=a=>[...new Set((Array.isArray(a)?a:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=12))].sort((x,y)=>x-y);
function srMonthsLabel(months){
 const m=srCleanMonths(months);
 if(m.length===12)return 'January–December';
 return m.map(i=>MONTHS[i-1]).join(', ')||'—';
}
/* "January 2026", or "January–March 2026" for a quarter, "January–December 2026" for a year */
function srPeriodLabel(freq,month,year){
 const span=SR_SPAN[freq]||1;
 if(span===1)return MONTHS[month-1]+' '+year;
 const sm=month-span+1;
 if(sm>=1)return MONTHS[sm-1]+'–'+MONTHS[month-1]+' '+year;
 return MONTHS[sm+11]+' '+(year-1)+'–'+MONTHS[month-1]+' '+year;
}
const srTitle=(name,month,year)=>name+' as of '+MONTHS[month-1]+' '+year;
/* the month after the reporting month: where the report is generated and where its deadline is counted */
const srGenMonth=(month,year)=>({month:month===12?1:month+1,year:month===12?year+1:year});
const srGenerationDate=(month,year,day)=>{const g=srGenMonth(month,year),n=Math.max(1,Math.min(31,Number(day)||1));return new Date(g.year,g.month-1,Math.min(n,new Date(g.year,g.month,0).getDate()));};
function srWorkdaysIn(year,mi){let c=0;const last=new Date(year,mi+1,0).getDate();for(let d=1;d<=last;d++)if(isWork(new Date(year,mi,d)))c++;return c;}
/* The deadline: the n-th working day counted from the 1st of the month after the reporting month.
   When the threshold fits inside that month (15, 17, 20 working days in practice) this IS the n-th working day
   of that month, worked out by the existing nthWorkdayOfMonth(). When it does not fit (25 working days is more
   than any month has: February 2026 has 20) the count simply carries on into the next month, still skipping
   weekends and listed holidays, so the date is always a real working day (spills is set). */
function srDeadline(month,year,thr){
 const g=srGenMonth(month,year),mi=g.month-1,avail=srWorkdaysIn(g.year,mi),base=MONTHS[mi]+' '+g.year;
 if(thr<=avail){const due=nthWorkdayOfMonth(g.year,mi,thr);return{dueAt:isoD(due),genYear:g.year,genMonth:g.month,spills:false,label:'the '+ordinal(thr)+' working day of '+base};}
 let d=new Date(g.year,mi+1,1),left=thr-avail;
 while(!(isWork(d)&&--left<=0))d=addDays(d,1);
 return{dueAt:isoD(d),genYear:g.year,genMonth:g.month,spills:true,label:'the '+ordinal(thr)+' working day counted from the start of '+base+' (falls in '+MONTHS[d.getMonth()]+' '+d.getFullYear()+')'};
}
const srParsePeriod=v=>{const m=/^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(v||''));return m?{year:Number(m[1]),month:Number(m[2])}:null;};
const srPeriodKey=(y,m)=>y+'-'+p2(m);
/* The reporting periods a schedule owes RIGHT NOW: every configured month, from the schedule's
   first period up to the latest one whose configured generation date in the following month has come.
   This is what makes a missed run recoverable: the answer depends only on the date, never on
   whether an earlier run happened. Existing reports are filtered out by the caller. */
function srDuePeriods(cfg,now){
 const today=sod(now||new Date()),months=srCleanMonths(cfg.months),from=srParsePeriod(cfg.fromPeriod);
 const out=[];if(!months.length||!from)return out;
 const floor=new Date(today.getFullYear(),today.getMonth()-SR_HORIZON_MONTHS,1);
 for(let y=from.year;y<=today.getFullYear();y++){
  for(const m of months){
   if(y===from.year&&m<from.month)continue;
   const g=srGenMonth(m,y),genDate=srGenerationDate(m,y,cfg.generationDay);
   if(genDate>today||genDate<floor)continue;
   out.push({year:y,month:m,genDate:isoD(genDate),genYear:g.year,genMonth:g.month});
  }
 }
 return out;
}
/* A whole schedule checked in one place; the server runs this again before saving.
   ctx.activeUser(id) and ctx.division(code) come from the caller. Returns '' when valid. */
function srValidate(c,ctx){
 ctx=ctx||{};
 if(!String(c.name||'').trim())return 'Enter the Special Report name.';
 if(!c.frequency)return 'Choose the frequency.';
 if(!isSrFreq(c.frequency))return 'Choose a valid frequency.';
 const generationDay=Number(c.generationDay==null?1:c.generationDay);
 if(!Number.isInteger(generationDay)||generationDay<1||generationDay>31)return 'Choose a generation day from 1 to 31.';
 const months=srCleanMonths(c.months);
 if(!months.length)return 'Choose at least one reporting month.';
 if(c.frequency==='monthly'&&months.length!==12)return 'A monthly report is generated every month. Use “Specific months” for a chosen set of months.';
 if(c.frequency==='annual'&&months.length!==1)return 'An annual report has exactly one reporting month.';
 if(c.frequency==='quarterly'){
  if(months.length!==4||months.some(m=>(m-months[0])%3!==0))return 'A quarterly report needs four reporting months, three months apart (for example March, June, September, December).';
 }
 const thr=Number(c.threshold);
 if(c.threshold===''||c.threshold==null||!Number.isInteger(thr))return 'Enter the deadline threshold as a whole number of working days.';
 if(thr<1||thr>60)return 'The deadline threshold must be between 1 and 60 working days.';
 if(!isSrBasis(c.basis))return 'Choose a valid deadline basis.';
 const users=Array.isArray(c.assignUsers)?c.assignUsers:[],divs=Array.isArray(c.assignDivisions)?c.assignDivisions:[];
 if(!users.length&&!divs.length)return 'Choose who is responsible: at least one person or one division.';
 if(ctx.activeUser&&users.some(id=>!ctx.activeUser(id)))return 'Choose responsible personnel from the active users. The System Administrator account has no For My Action list, so it cannot be assigned.';
 if(ctx.division&&divs.some(d=>!ctx.division(d)))return 'Choose divisions from the existing division list.';
 if(c.fromPeriod&&!srParsePeriod(c.fromPeriod))return 'The first reporting period must be a month, for example 2026-01.';
 return '';
}
/* status shown for a generated report: the existing deadline states, plus Pending / Completed wording */
function srStatus(item){
 const x=dl(item);
 if(item.status==='completed')return{key:x.key,chip:'Completed',tone:x.key==='done_late'?'bad':'ok',label:x.label,days:x.label};
 if(x.key==='over')return{key:'over',chip:'Overdue',tone:'bad',label:x.label,days:x.label};
 if(x.key==='soon')return{key:'soon',chip:x.n===0?'Due today':'Due soon',tone:'warn',label:x.label,days:x.label};
 return{key:x.key,chip:'Pending',tone:'info',label:x.label,days:x.label};
}
const srActiveAssign=item=>(item.assign||[]).filter(a=>a.status==='active');
const srIsMine=(item,userId)=>{
 if(item.status!=='pending')return false;
 const u=uById(userId),w=item.workflow;
 if(!u)return false;
 if(!w)return srActiveAssign(item).some(a=>a.userId===userId);
 const d=Object.assign({},item,w,{status:w.status||'processing'});
 if(d.status==='processing'&&!d.assignee&&srActiveAssign(item).some(a=>a.userId===userId))d.assignee=userId;
 return isMyTurn(u,d);
};

var ENGINE={act,logDoc,baseState,seedDemoDocs,migrateState,canView,has,can,isMyTurn,rebuildHS,uById,createDoc,getTx,isRegularDoc,audit,computeDeadline,computeDue,hasPrescribedDeadline,reportingPeriodInfo,normMonth,nthWorkdayOfMonth,firstWorkdayOfMonth,isWork,addWD,wdBetween,isoD,parseD,docTypeOf,docTypeBasis,docTypeUnit,docTypeThreshold,isDeadlineBasis,activeDocTypes,activeCommTypes,commName,DEADLINE_UNITS,DEADLINE_BASES,MONTHS,REGULAR_DOC,REGULAR_DAYS,PERMS,ROLES,ROLE_ORDER,DEFAULT_PERMS,DEFAULT_PW,ADMIN_PW,isDivFocal,deptApprovers,REVIEW_LINE,pwPolicy:null,SCHED_TYPES,schedPeople,schedOverlap,scheduleConflicts,leaveTypeName,defaultLeaveTypes,SR_FREQ,SR_BASES,SR_SPAN,srFreqName,isSrFreq,isSrBasis,srCleanMonths,srMonthsLabel,srPeriodLabel,srTitle,srGenMonth,srGenerationDate,srDeadline,srParsePeriod,srPeriodKey,srDuePeriods,srValidate,srStatus,srActiveAssign,srIsMine,dl};
