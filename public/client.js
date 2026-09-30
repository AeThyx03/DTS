'use strict';
/* =====================  CLIENT (talks to the server)  ===================== */
function tGet(){try{return localStorage.getItem('dts.theme');}catch(e){return null;}}
function tSet(v){try{localStorage.setItem('dts.theme',v);}catch(e){}}
const API={v:0};
async function api(method,url,body,opts){
 opts=opts||{};let res;
 try{res=await fetch(url,{method:method,credentials:'same-origin',headers:Object.assign({'X-Requested-With':'dts'},body!==undefined?{'Content-Type':'application/json'}:{},opts.poll?{'X-Poll':'1'}:{}),body:body!==undefined?JSON.stringify(body):undefined});}
 catch(e){return{ok:false,status:0,error:'Cannot reach the server. Check your connection and try again.'};}
 let data={};try{data=await res.json();}catch(e){}
 if(data.orgName)UI.orgName=data.orgName;
 const out=Object.assign({},data,{ok:res.ok&&data.ok!==false,status:res.status});
 if(res.status===401&&!opts.noAuthRedirect){sessionEnded(data.error);return out;}
 if(res.status===403&&data.code==='must_change_password'){forcePasswordChange();return out;}
 return out;
}
function suggestPw(){const a='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789',b=new Uint32Array(12);crypto.getRandomValues(b);let s='';b.forEach(x=>{s+=a[x%a.length];});return s+'#7';}
async function refresh(poll,quiet){
 const r=await api('GET','/api/state',undefined,{noAuthRedirect:true,poll:!!poll});
 API.status=r.status;
 if(r.status===401){SESSION.uid=null;S=null;render();return false;}
 if(!r.ok){if(!quiet)toast(r.error||'Could not load the latest data.','bad');return false;}
 if(r.mustChange){SESSION.uid=null;S=null;UI.orgName=r.orgName||UI.orgName;render();forcePasswordChange();return false;}
 S=r.state;S.audit=[];API.v=r.v;rebuildHS();SESSION.uid=r.me;render();return true;
}

/* =====================  UI CORE  ===================== */
const UI={route:'dashboard',param:null,filters:{tile:'total'},sort:{k:'receivedAt',dir:-1},page:1,menu:null,side:false,dash:{division:'',period:'all'},fails:0,lockUntil:0,lastAct:Date.now(),silent:false,report:'register',rf:{},theme:'auto',notice:''};
const SESSION={uid:null};
const ME=()=>(S&&SESSION.uid)?uById(SESSION.uid):null;
const ICONS={
 dashboard:'<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
 docs:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
 regular:'<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
 reports:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
 users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14a6 6 0 0 1 3 6"/>',
 shield:'<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
 swap:'<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
 building:'<path d="M4 21V5l8-2v18M12 8h8v13M2 21h20M7 9h2M7 13h2M7 17h2M15 12h2M15 16h2"/>',
 list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
 bell:'<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 print:'<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><rect x="6" y="14" width="12" height="7"/>',
 download:'<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
 menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
 alert:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
 x:'<path d="M6 6l12 12M18 6L6 18"/>',
 check:'<path d="M5 12l5 5 9-10"/>',
 back:'<path d="M15 6l-6 6 6 6"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
 arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>'
};
const ic=n=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(ICONS[n]||'')+'</svg>';
function renderUrl(url,label){
 if(!url)return '<span class="muted">—</span>';
 const safe=esc(url),lbl=esc(label||url.replace(/^https?:\/\//,'').slice(0,60));
 return '<a href="'+safe+'" target="_blank" rel="noopener noreferrer" class="docurl" data-preview="'+safe+'">'+ic('send').replace('<svg','<svg class="uic"')+lbl+'</a>';
}
/* Reusable Draft/Revised file links for ANY document record (display, add, edit, remove, open).
   */
function DocumentFileLinks(d,editable){
 const row=(lbl,url,open)=>'<dt>'+lbl+'</dt><dd>'+(url?renderUrl(url,open):'<span class="muted">Not provided</span>')+'</dd>';
 const fld=(lbl,name,val,hint)=>'<div class="fld"><label>'+lbl+'</label><input type="url" name="'+name+'" placeholder="https://" value="'+esc(val||'')+'">'+(hint?'<p class="hint">'+hint+'</p>':'')+'</div>';
 return '<div class="card pad" data-filelinks><div class="row sp"><h3>Files / Document Links</h3>'+(d.revCount?'<span class="badge b-pur">'+d.revCount+' revision'+(d.revCount>1?'s':'')+'</span>':'')+'</div>'+
  '<dl class="dl" style="margin-bottom:12px">'+row('Draft File',d.draftUrl,'Open Draft File')+row('Revised File',d.revUrl,'Open Revised File')+'</dl>'+
  (editable?'<div data-form="urls">'+fld('Draft File URL','draftUrl',d.draftUrl)+fld('Revised File URL','revUrl',d.revUrl,'Both are optional. Clear a box and save to remove that link. Replacing an existing Revised File URL increments the revision counter.')+'<button class="btn" data-act="saveUrls" data-id="'+d.id+'">Save links</button></div>':'')+'</div>';
}
const badge=(tone,text,title)=>'<span class="badge b-'+tone+'"'+(title?' title="'+esc(title)+'"':'')+'>'+esc(text)+'</span>';
const stageBadge=d=>badge(STAGES[d.status].tone,STAGES[d.status].short);
const dlBadge=d=>{const x=dl(d);return badge(x.tone,x.label);};
const roleName=r=>ROLES[r]||r;
const opt=(v,l,sel)=>'<option value="'+esc(v)+'"'+(sel?' selected':'')+'>'+esc(l)+'</option>';
const nl=s=>esc(s).replace(/\n/g,'<br>');

function toast(msg,kind){const t=document.createElement('div');t.className='toast'+(kind==='bad'?' bad':'');t.textContent=msg;$('#toasts').appendChild(t);setTimeout(()=>t.remove(),kind==='bad'?7000:3800);}
function openModal(title,body,opts){opts=opts||{};$('#modalRoot').innerHTML='<div class="modal-back"'+(opts.locked?' data-locked="1"':' data-act="modalBack"')+'><div class="modal'+(opts.wide?' wide':'')+'" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><header><h2>'+esc(title)+'</h2>'+(opts.locked?'':'<button class="iconbtn" data-act="closeModal" aria-label="Close">'+ic('x')+'</button>')+'</header><div class="mb">'+body+'</div>'+(opts.foot?'<footer>'+opts.foot+'</footer>':'')+'</div></div>';const f=$('#modalRoot input:not([type=hidden]),#modalRoot select,#modalRoot textarea');if(f&&!opts.nofocus)f.focus();}
function closeModal(){$('#modalRoot').innerHTML='';}
function confirmBox(title,msg,yes,fn,danger){UI.confirmFn=fn;openModal(title,'<p>'+esc(msg)+'</p>',{nofocus:1,foot:'<button class="btn" data-act="closeModal">Cancel</button><button class="btn '+(danger?'danger':'primary')+'" data-act="confirmYes">'+esc(yes)+'</button>'});}
function formVals(root){const o={};$$('input,select,textarea',root).forEach(e=>{if(!e.name)return;if(e.type==='checkbox')o[e.name]=e.checked;else if(e.type==='radio'){if(e.checked)o[e.name]=e.value;}else o[e.name]=e.value;});return o;}
function openPP(html){$('#ppBody').innerHTML=html;$('#ppHint').textContent='If the print dialog does not open, use Ctrl/Cmd + P.';$('#pp').classList.add('on');document.body.classList.add('printing');$('#pp').scrollTop=0;}
function closePP(){$('#pp').classList.remove('on');document.body.classList.remove('printing');}

/* downloads */
function csvCell(v){const s=String(v==null?'':v);return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function saveFile(filename,data,mime){
 try{const blob=new Blob([data],{type:mime||'text/plain;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);toast('Saved '+filename);}
 catch(e){toast('Could not save the file.','bad');}
}
function exportCSV(name,cols,rows){saveFile(name+'-'+isoD(new Date())+'.csv','\ufeff'+[cols].concat(rows).map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');}

/* =====================  ROUTER  ===================== */
function parseHash(){const a=String(location.hash||'').replace(/^#\/?/,'').split('/');UI.route=a[0]||'dashboard';if(UI.route==='documents')UI.route='dashboard';UI.param=a[1]||null;}
function go(route,param){if(route==='documents')route='dashboard';UI.route=route;UI.param=param||null;UI.menu=null;UI.side=false;const h='#/'+route+(param?'/'+param:'');if(location.hash!==h){UI.silent=true;try{location.hash=h;}catch(e){UI.silent=false;}}render();}
window.addEventListener('hashchange',()=>{if(UI.silent){UI.silent=false;return;}parseHash();render();});

/* =====================  SIGN-IN  ===================== */
const ORG_NAME=()=>(S&&S.settings&&S.settings.orgName)||UI.orgName||'Document Tracking & Routing System';
const LOGO_WHITE='<img class="logo" src="/logo-white.png" alt="'+esc(ORG_NAME())+'">';
const LOGO_BLACK='<img class="logo" src="/logo-black.png" alt="'+esc(ORG_NAME())+'">';
function AppLogo(cls){return '<span class="logo-auto '+(cls||'')+'"><img class="logo lg-b" src="/logo-black.png" alt="'+esc(ORG_NAME())+'"><img class="logo lg-w" src="/logo-white.png" alt=""></span>';}
function loginHTML(){
 return '<div class="login"><section class="lg-brand"><img class="lg-logo" src="/logo-white.png" alt="POSSD">'+
 '<div class="lg-brandtxt"><span class="lg-org">Project Operations Support Services</span><h1 class="lg-dept">Department</h1><i class="lg-rule" aria-hidden="true"></i><p class="lg-app">'+esc(ORG_NAME())+'</p></div></section><main class="lg-form"><div class="lg-card"><h1 class="lg-sign-title">Sign in</h1>'+
 (UI.notice?'<div class="banner warn" role="alert">'+ic('info')+'<div>'+esc(UI.notice)+'</div></div>':'')+
 '<form data-submit="login" autocomplete="on">'+
 '<div class="fld"><label for="lu">Username</label><div class="lg-in">'+ic('user')+'<input id="lu" name="username" placeholder="Enter your username" autocomplete="username" autocapitalize="none" spellcheck="false" required></div></div>'+
 '<div class="fld"><label for="lp">Password</label><div class="lg-in">'+ic('lock')+'<input id="lp" name="password" type="password" placeholder="Enter your password" autocomplete="current-password" required></div></div>'+
 '<div class="lg-opts"><label class="chk"><input type="checkbox" name="remember"> Keep me signed in on this device</label><label class="chk"><input type="checkbox" data-chg="showpw"> Show password</label></div>'+
 '<div id="lerr" class="banner bad" role="alert" hidden></div><button class="lg-btn" type="submit"><span>Sign in</span>'+ic('arrow')+'</button></form>'+
 '<p class="lg-help">Forgot your password? Ask the System Administrator to reset it.</p></div></main></div>';
}
function sessionEnded(msg){
 if(S&&S.settings)UI.orgName=S.settings.orgName;
 const had=!!SESSION.uid;SESSION.uid=null;S=null;
 UI.notice=had?(msg&&msg!=='Please sign in.'?msg:'Your session has ended. Please sign in again.'):UI.notice;
 UI.menu=null;closeModal();closePP();render();
}
async function signOut(msg){
 if(S&&S.settings)UI.orgName=S.settings.orgName;
 await api('POST','/api/logout',{},{noAuthRedirect:true});
 SESSION.uid=null;S=null;UI.notice=msg||'';UI.menu=null;closeModal();closePP();
 try{history.replaceState(null,'',location.pathname+location.search);}catch(e){}
 render();
}
function forcePasswordChange(){
 if($('[data-form=fpw]'))return;
 openModal('Set a new password','<p>Your account was issued with a temporary password. Choose your own to continue.</p><div data-form="fpw"><div class="fld"><label>Temporary password</label><input type="password" name="cur" autocomplete="current-password"></div><div class="g2"><div class="fld"><label>New password</label><input type="password" name="n1" autocomplete="new-password"></div><div class="fld"><label>Confirm new password</label><input type="password" name="n2" autocomplete="new-password"></div></div><p class="hint">At least 8 characters, with letters and numbers.</p></div>',{locked:1,foot:'<button class="btn" data-act="signout">Sign out</button><button class="btn primary" data-act="saveForcedPw">Save password</button>'});
}
/* =====================  SHELL  ===================== */
function navItems(u){
 const w=[['dashboard','Dashboard','dashboard']];
 if(u.role!=='sysadmin')w.push(['action','For My Action','alertc']);
 w.push(['regular','Regular reports','regular']);
 w.push(['schedule','Personnel Schedule','calendar']);
 if(has(u,'report.view')){w.push(['analytics','Analytics','reports']);w.push(['graphs','Graphs','graph']);w.push(['reports','Reports','docs']);}
 const a=[];
 if(has(u,'user.manage'))a.push(['users','Users','users']);
 if(has(u,'role.manage'))a.push(['roles','Roles & permissions','shield']);
 if(has(u,'oic.manage')||u.role==='dept_manager'||u.role==='div_manager')a.push(['delegation','Delegation & OIC','swap']);
 if(has(u,'config.manage')){a.push(['divisions','Divisions & focals','building']);a.push(['refs','Reference lists','list']);a.push(['settings','System Admin Settings','gear']);}
 if(has(u,'audit.view'))a.push(['audit','Audit log','clock']);
 return{w:w,a:a};
}
const ROUTE_OK={dashboard:()=>true,documents:()=>true,analytics:u=>has(u,'report.view'),graphs:u=>has(u,'report.view'),doc:()=>true,action:u=>u.role!=='sysadmin',regular:()=>true,schedule:()=>true,reports:u=>has(u,'report.view'),users:u=>has(u,'user.manage'),roles:u=>has(u,'role.manage'),delegation:u=>has(u,'oic.manage')||u.role==='dept_manager'||u.role==='div_manager',divisions:u=>has(u,'config.manage'),refs:u=>has(u,'config.manage'),spconfig:u=>has(u,'config.manage'),settings:u=>has(u,'config.manage'),audit:u=>has(u,'audit.view')};
function myQueue(u){return visibleDocs(u).filter(d=>isMyTurn(u,d));}
const actionDocs=myQueue; // "For My Action" is exactly: every document where it is this user's turn to act (isMyTurn), for every role and every stage. No stage/role special-casing here — that was the root cause of the previous bug (assignees, dept managers and admin staff were excluded from this list even though isMyTurn already correctly recognised their turn).

function shellHTML(){
 const u=ME(),nav=navItems(u),q=myQueue(u),spN=spMine(u).length;
 const link=n=>'<a href="#/'+n[0]+'" data-act="nav" data-r="'+n[0]+'"'+((UI.route===n[0]||(UI.route==='doc'&&n[0]==='dashboard'))?' aria-current="page"':'')+'>'+ic(n[2])+'<span>'+esc(n[1])+'</span>'+(n[0]==='action'&&(q.length+spN)?'<span class="cnt" title="Waiting for your action">'+(q.length+spN)+'</span>':'')+'</a>';
 return '<div class="shell"><aside class="side'+(UI.side?' open':'')+'" aria-label="Main navigation"><div class="brand">'+LOGO_WHITE+'<div><b>Document Tracking</b><span>&amp; Routing System</span></div></div>'+
 '<nav class="nav"><h4>Workspace</h4>'+nav.w.map(link).join('')+(nav.a.length?'<h4>Administration</h4>'+nav.a.map(link).join(''):'')+'</nav>'+
 '<div class="sidefoot"><div class="nm">'+esc(u.name)+'</div><div>'+esc(roleName(u.role))+(isOIC(u)?' · acting as OIC':'')+'</div></div></aside><div class="scrim'+(UI.side?' on':'')+'" data-act="closeSide"></div>'+
 '<div class="main"><header class="top"><button class="iconbtn burger" data-act="openSide" aria-label="Open menu">'+ic('menu')+'</button>'+AppLogo('topLogo')+
 '<form class="search" data-submit="topSearch" role="search"><span aria-hidden="true">'+ic('search')+'</span><input name="q" placeholder="Find by tracking no., subject or sender" aria-label="Search documents"></form><div class="grow"></div>'+
 (has(u,'doc.log')?'<button class="btn primary" data-act="newDoc">'+ic('plus')+'<span class="hide-md">Log document</span></button>':'')+
 '<button class="iconbtn" data-act="shortcuts" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">'+ic('help')+'</button>'+'<div class="menu-wrap"><button class="iconbtn" data-act="menu" data-m="bell" aria-label="Documents waiting for you" aria-expanded="'+(UI.menu==='bell')+'">'+ic('bell')+(q.length?'<span class="dotn">'+q.length+'</span>':'')+'</button>'+(UI.menu==='bell'?bellMenu(u,q):'')+'</div>'+
 '<div class="menu-wrap"><button class="avatar" data-act="menu" data-m="user" aria-label="Account menu" aria-expanded="'+(UI.menu==='user')+'">'+esc(initials(u.name))+'</button>'+(UI.menu==='user'?userMenu(u):'')+'</div></header>'+
 '<main class="view" id="view" tabindex="-1"></main></div></div>';
}
function bellMenu(u,q){
 const top=q.slice().sort((a,b)=>({over:0,soon:1}[dl(a).key]??2)-({over:0,soon:1}[dl(b).key]??2)).slice(0,6);
 return '<div class="menu" role="menu"><div class="mh">Waiting for your action ('+q.length+')</div>'+(top.length?top.map(d=>'<a class="mi" href="#/doc/'+d.id+'" data-act="openDoc" data-id="'+d.id+'"><b class="mono small">'+esc(d.trackNo)+'</b> '+esc(d.subject.slice(0,60))+'<small>'+esc(STAGES[d.status].short)+' – '+esc(dl(d).label)+'</small></a>').join(''):(spMine(u).length?'':'<div class="empty">Nothing is waiting on you.</div>'))+
 (spMine(u).length?'<a class="mi" href="#/action" data-act="nav" data-r="action"><b>'+plural(spMine(u).length,'Special Report')+'</b> for your action<small>Open For My Action</small></a>':'')+
 (q.length?'<button class="mi b" data-act="myQueue">See all in My queue</button>':'')+'</div>';
}
function userMenu(u){
 const away=(u.role==='dept_manager'||u.role==='div_manager');
 return '<div class="menu" role="menu"><div class="mh">'+esc(u.name)+'<div class="small muted">'+esc(roleName(u.role))+(u.division?' – '+esc(u.division):'')+'</div></div>'+
 '<button class="mi" data-act="myAccount">My account<small>Change your password</small></button>'+
 (away?'<button class="mi" data-act="togglePresence" data-id="'+u.id+'">'+(u.present?'Mark myself as away':'Mark myself as present')+'<small>'+(u.present?'You are shown as present':'Reviews route to your alternate while you are away')+'</small></button>':'')+
 '<div class="mi" style="cursor:default"><span class="lbl">Theme</span><div class="row" style="margin-top:6px">'+['auto','light','dark'].map(t=>'<button class="btn sm'+(UI.theme===t?' primary':'')+'" data-act="theme" data-t="'+t+'">'+t[0].toUpperCase()+t.slice(1)+'</button>').join('')+'</div></div>'+
 '<button class="mi" data-act="signout">Sign out</button></div>';
}
function applyTheme(){const r=document.documentElement;if(UI.theme==='auto')r.removeAttribute('data-theme');else r.setAttribute('data-theme',UI.theme);}

function render(){
 const old=$('#view'),key=UI.route+'/'+UI.param,st=(old&&UI._key===key)?old.scrollTop:0;
 if(!ME()){$('#app').innerHTML=loginHTML();UI._key='';return;}
 $('#app').innerHTML=shellHTML();
 const v=$('#view');
 const okf=ROUTE_OK[UI.route];
 let h;
 try{
  if(!okf)h=VIEWS.notfound(ME());
  else if(!okf(ME()))h='<div class="wrap"><div class="card empty"><b>You do not have access to this page.</b>Ask the System Administrator if your role should include it.</div></div>';
  else h=VIEWS[UI.route](ME(),UI.param);
 }catch(e){console.error(e);h='<div class="wrap"><div class="card empty"><b>This page could not be displayed.</b>'+esc(e.message)+'</div></div>';}
 v.innerHTML=h;v.scrollTop=st;UI._key=key;
 if(UI.route==='dashboard')refreshReg();
 markSeen();
 if(UI.route==='audit'&&ME())setTimeout(loadAudit,0);
}
const VIEWS={notfound:()=>'<div class="wrap"><div class="card empty"><b>Page not found.</b><a href="#/dashboard" data-act="nav" data-r="dashboard">Back to the dashboard</a></div></div>'};

/* =====================  GLOBAL EVENTS  ===================== */
const ACTIONS={},CHANGES={},INPUTS={};
document.addEventListener('click',ev=>{
 UI.lastAct=Date.now();
 const t=ev.target.closest('[data-act]');
 if(UI.menu&&!ev.target.closest('.menu-wrap')){UI.menu=null;$$('.menu').forEach(m=>m.remove());}
 if(!t)return;
 const a=t.dataset.act;
 if(a==='modalBack'&&ev.target!==t)return;
 const fn=ACTIONS[a];
 if(fn){if(t.tagName==='A')ev.preventDefault();fn(t,ev);}
});
document.addEventListener('change',ev=>{const t=ev.target.closest('[data-chg]');if(t&&CHANGES[t.dataset.chg])CHANGES[t.dataset.chg](t,ev);});
document.addEventListener('input',ev=>{const t=ev.target.closest('[data-inp]');if(t&&INPUTS[t.dataset.inp])INPUTS[t.dataset.inp](t,ev);});
document.addEventListener('submit',ev=>{const f=ev.target.closest('[data-submit]');if(f){ev.preventDefault();if(ACTIONS[f.dataset.submit])ACTIONS[f.dataset.submit](f,ev);}});
document.addEventListener('keydown',ev=>{UI.lastAct=Date.now();if(ev.key==='Escape'){if($('#pp.on'))closePP();else if($('.modal-back')&&!$('.modal-back[data-locked]'))closeModal();else if(UI.menu){UI.menu=null;$$('.menu').forEach(m=>m.remove());}}});

ACTIONS.nav=(t)=>go(t.dataset.r);
ACTIONS.openDoc=(t)=>go('doc',t.dataset.id);
ACTIONS.openSide=()=>{UI.side=true;render();};
ACTIONS.closeSide=()=>{UI.side=false;render();};
ACTIONS.closeModal=()=>closeModal();
ACTIONS.modalBack=()=>closeModal();
ACTIONS.confirmYes=()=>{const f=UI.confirmFn;closeModal();UI.confirmFn=null;if(f)f();};
ACTIONS.ppClose=()=>closePP();
ACTIONS.ppPrint=()=>{try{window.print();}catch(e){toast('Use Ctrl/Cmd + P to print this preview.');}};
ACTIONS.menu=(t)=>{UI.menu=UI.menu===t.dataset.m?null:t.dataset.m;render();};
ACTIONS.theme=(t)=>{UI.theme=t.dataset.t;tSet(UI.theme);applyTheme();render();};
ACTIONS.signout=()=>signOut('');
ACTIONS.myQueue=()=>{UI.filters={tile:'action'};UI.page=1;UI.sel.clear();go('dashboard');};
CHANGES.showpw=(t)=>{$('#lp').type=t.checked?'text':'password';};
ACTIONS.login=async(f)=>{
 const v=formVals(f),e=$('#lerr'),btn=$('button[type=submit]',f);
 btn.disabled=true;
 const r=await api('POST','/api/login',{username:v.username,password:v.password,remember:!!v.remember},{noAuthRedirect:true});
 btn.disabled=false;
 if(!r.ok){e.hidden=false;e.innerHTML=ic('alert')+'<div>'+esc(r.error||'Could not sign in.')+'</div>';return;}
 UI.notice='';UI.lastAct=Date.now();parseHash();await refresh();
};
ACTIONS.topSearch=(f)=>{const q=formVals(f).q.trim();UI.filters={tile:'total',q:q};UI.page=1;UI.sel.clear();go('dashboard');};
ACTIONS.togglePresence=async(t)=>{
 const u=uById(t.dataset.id);if(!u)return;UI.menu=null;
 const r=await api('POST','/api/users/'+u.id+'/presence',{present:!u.present});
 if(!r.ok)return toast(r.error,'bad');
 toast(u.name+' is now shown as '+(u.present?'away':'present')+'.');await refresh();
};
ACTIONS.myAccount=()=>{UI.menu=null;const u=ME();openModal('My account',
 '<dl class="dl" style="margin-bottom:16px"><dt>Name</dt><dd>'+esc(u.name)+'</dd><dt>Username</dt><dd class="mono">'+esc(u.username||'')+'</dd><dt>Role</dt><dd>'+esc(roleName(u.role))+'</dd><dt>Last sign-in</dt><dd>'+fmtDT(u.lastLogin)+'</dd></dl><h3 style="margin-bottom:8px">Change password</h3><div data-form="pw"><div class="fld"><label>Current password</label><input type="password" name="cur" autocomplete="current-password"></div><div class="g2"><div class="fld"><label>New password</label><input type="password" name="n1" autocomplete="new-password"></div><div class="fld"><label>Confirm new password</label><input type="password" name="n2" autocomplete="new-password"></div></div><p class="hint">Use at least 8 characters with a mix of letters and numbers.</p></div>',
 {foot:'<button class="btn" data-act="closeModal">Close</button><button class="btn primary" data-act="savePw">Save password</button>'});};
async function changePw(sel,done){
 const v=formVals($(sel));
 const pe=pwProblem(v.n1);if(pe)return toast(pe,'bad');if(v.n1!==v.n2)return toast('The new passwords do not match.','bad');
 const r=await api('POST','/api/password',{current:v.cur,next:v.n1},{noAuthRedirect:true});
 if(!r.ok)return toast(r.error||'Could not change the password.','bad');
 closeModal();toast('Password updated.');await done();
}
ACTIONS.savePw=()=>changePw('[data-form=pw]',()=>refresh());
ACTIONS.saveForcedPw=()=>changePw('[data-form=fpw]',()=>refresh());
function pwProblem(p){if(!p||p.length<8)return 'The password must have at least 8 characters.';if(!/[A-Za-z]/.test(p)||!/[0-9]/.test(p))return 'The password needs both letters and numbers.';return '';}

/* idle sign-out and live updates from other users */
setInterval(()=>{const m=S&&S.settings?S.settings.idleMinutes:0;if(ME()&&m>0&&Date.now()-UI.lastAct>m*60000)signOut('You were signed out after '+m+' minutes of inactivity.');},20000);
(()=>{
 let tip=null;
 document.addEventListener('mouseover',ev=>{
  const a=ev.target.closest('[data-preview]');
  if(!a)return;
  if(tip)tip.remove();
  const url=a.dataset.preview;
  const t=document.createElement('div');
  t.className='url-tip';
  t.innerHTML='<div class="url-tip-inner"><div class="url-tip-bar">'+ic('send').replace('<svg','<svg width="14" height="14"')+'<span>'+esc(url.replace(/^https?:\/\//,'').slice(0,80))+'</span></div><iframe src="'+esc(url)+'" sandbox="allow-same-origin" title="URL preview" loading="lazy"></iframe></div>';
  document.body.appendChild(t);
  tip=t;
  const r=a.getBoundingClientRect();
  t.style.cssText='position:fixed;z-index:200;left:'+Math.min(r.left,window.innerWidth-320)+'px;top:'+(r.bottom+8)+'px';
 },true);
 document.addEventListener('mouseout',ev=>{
  const a=ev.target.closest('[data-preview]');
  if(!a)return;
  const to=ev.relatedTarget;if(to&&(a.contains(to)||tip&&tip.contains(to)))return;
  if(tip){tip.remove();tip=null;}
 },true);
})();

function typing(){const a=document.activeElement;return !!a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&(a.type==='checkbox'||a.type==='radio'?false:(a.value||'').length>0);}
setInterval(async()=>{
 if(!ME()||document.hidden)return;
 const r=await api('GET','/api/version',undefined,{poll:true,noAuthRedirect:true});
 if(r.status===401){sessionEnded('Your session has ended. Please sign in again.');return;}
 if(r.ok&&r.v!==API.v){if($('#modalRoot').innerHTML||$('#pp.on')||typing())return;await refresh(true);}
},15000);

/* Broaden what counts as activity: click and keydown already update UI.lastAct (see the
   delegated listeners above); mouse movement, scrolling and touch are added here so a
   person reading or scrolling without clicking is still correctly treated as active. */
['mousemove','scroll','touchstart','pointerdown'].forEach(evName=>document.addEventListener(evName,()=>{UI.lastAct=Date.now();},{passive:true}));

/* Auto-refresh after 60 seconds of no activity. This re-fetches state and re-renders the
   CURRENT route in place (render() never resets UI.route/UI.filters/UI.page/UI.sel/UI.sort),
   so the active tab, filters, search text, pagination and selected rows all survive exactly
   as if nothing happened — there is no separate reload/navigation. The existing signed-in
   session is reused via the same cookie; if the server has separately timed out the session
   (see the idle sign-out above, which uses a much longer default), refresh() already handles
   that by returning to the sign-in screen, same as it does for the 15-second poll above. */
let lastIdleRefresh=0;
setInterval(()=>{
 if(!ME()||document.hidden)return;
 const idleFor=Date.now()-UI.lastAct;
 if(idleFor<60000)return;
 if(Date.now()-lastIdleRefresh<60000)return;
 if($('#modalRoot').innerHTML||$('#pp.on')||typing())return;
 lastIdleRefresh=Date.now();
 refresh(true);
},5000);

/* =====================  ICONS ADDED FOR THE NEW LAYOUT  ===================== */
Object.assign(ICONS,{
 help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.6-1.4c.5.8.3 1.6-.4 2.2l-.7.6c-.6.5-1 1-1 1.9M12 17h.01"/>',
 inbox:'<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z"/>',
 alertc:'<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5h.01"/>',
 timer:'<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M9.5 2.5h5M12 2.5V6"/>',
 shieldcheck:'<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
 columns:'<path d="M4 6h5M4 12h5M4 18h5M15 6h5M15 12h5M15 18h5"/>',
 send:'<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
 trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/>',
 graph:'<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
 person:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 sort:'<path d="M12 5v14M6 13l6 6 6-6"/>'
});

/* =====================  LIFECYCLE PROGRESS  ===================== */
const LC_STEPS=[{l:'Logged'},{l:'Focal'},{l:'Staff'},{l:'Supervisor'},{l:'Division'},{l:'Dept. Mgr'},{l:'Cleared'},{l:'Out'}];
const LC_IDX={received:0,at_focal:1,processing:2,compliance:2,sup_review:3,div_review:4,dept_review:5,cleared:6,return_out:6,out:7};
const LEVEL_SHORT={sup:'Supervisor',div:'Division',dept:'Dept. Mgr'};
const ago=t=>{const m=Math.floor((Date.now()-new Date(t))/60000);if(m<1)return 'just now';if(m<60)return m+' min ago';const h=Math.floor(m/60);if(h<24)return h+' h ago';const dd=Math.floor(h/24);return dd+' day'+(dd>1?'s':'')+' ago';};
function lcInfo(d){
 const idx=LC_IDX[d.status],last=LC_STEPS.length-1,over=isClockActive(d)&&dl(d).key==='over';
 let chip='',tone='neu',ring=over?'bad':'warn';
 switch(d.status){
  case 'received':chip='Awaiting forwarding';tone='neu';break;
  case 'at_focal':chip='Awaiting assignment';tone='info';break;
  case 'processing':chip=d.autoRouted&&!d.cycles?'With designated staff':'With staff';tone='info';break;
  case 'compliance':{const oc=openComments(d),lv=oc.length?oc[oc.length-1].level:d.returnedFrom;chip=(LEVEL_SHORT[lv]||'Reviewer')+' comment: comply';tone='pur';ring=over?'bad':'pur';break;}
  case 'sup_review':chip='In supervisor review';tone='info';break;
  case 'div_review':chip='In division review';tone='info';break;
  case 'dept_review':chip='Final review';tone='info';break;
  case 'cleared':chip='Cleared for out';tone='ok';ring='ok';break;
  case 'return_out':chip='For return: to log out';tone='warn';ring='warn';break;
  case 'out':chip=d.outType==='For return'?'Returned to sender':'Dispatched';tone=d.outType==='For return'?'warn':'ok';ring='ok';break;
 }
 return{idx:idx,pct:Math.round(idx/last*100),chip:chip,tone:tone,ring:ring,over:over,label:LC_STEPS[idx].l,last:last};
}
function lcTitle(d){const h=d.history[d.history.length-1];return h?'Last change: '+h.action+' by '+uname(h.by)+', '+fmtDT(h.at):'';}
function lcBar(d){
 const L=lcInfo(d),n=LC_STEPS.length;let h='';
 for(let i=0;i<n;i++){
  const st=i<L.idx?'done':(i===L.idx?(L.idx===L.last?'done':'now'):'todo'),skip=d.autoRouted&&i===1&&L.idx>1;
  h+='<i class="lc-d '+st+(skip?' skip':'')+'"></i>';
  if(i<n-1){const sg=(i+1<L.idx)||(L.idx===L.last)?'done':((i+1===L.idx)?'lead':'todo');h+='<b class="lc-s '+sg+'"></b>';}
 }
 const sig=d.history.length+':'+d.status,flash=UI.sig&&UI.sig[d.id]!==undefined&&UI.sig[d.id]!==sig;
 return '<div class="lcw ring-'+L.ring+(flash?' flash':'')+'" title="'+esc(lcTitle(d))+'"><div class="lc-top"><span class="badge b-'+L.tone+' lc-chip">'+esc(L.chip)+'</span><span class="lc-pct">'+L.pct+'%</span></div><div class="lc">'+h+'</div><div class="lc-cur">'+esc(L.label)+' <span>step '+(L.idx+1)+' of '+n+'</span></div></div>';
}
function lcCard(d){
 const L=lcInfo(d),reach={};
 d.history.forEach(h=>{const i=LC_IDX[h.to];if(i!==undefined&&reach[i]===undefined)reach[i]=h.at;});
 const lastH=d.history[d.history.length-1];
 const steps=LC_STEPS.map((s,i)=>{
  const st=i<L.idx?'done':(i===L.idx?(L.idx===L.last?'done':'now'):'todo'),skip=d.autoRouted&&i===1&&L.idx>1;
  return '<li class="'+(skip?'skip':st)+'"><i></i><b>'+esc(s.l)+'</b><span>'+(skip?'Bypassed':reach[i]?fmtD(reach[i])+', '+fmtT(reach[i]):(i===L.idx?'Now':'Pending'))+'</span></li>';
 }).join('');
 return '<div class="card pad lcc ring-'+L.ring+'"><div class="row sp"><div class="row"><h3>Lifecycle progress</h3><span class="badge b-'+L.tone+'">'+esc(L.chip)+'</span></div><div class="lc-pct big">'+L.pct+'%</div></div><ol class="lcf">'+steps+'</ol><p class="small muted" style="margin:10px 0 0">'+(lastH?'Last change '+esc(ago(lastH.at))+': '+esc(lastH.action)+' by '+esc(uname(lastH.by))+'. The bar updates whenever the document changes.':'')+(d.cycles?' Returned for compliance '+plural(d.cycles,'time')+'.':'')+'</p></div>';
}

/* =====================  FILTERS, SORT, REGISTRY  ===================== */
const GROUPS={incoming:['received','at_focal'],assigned:['processing'],review:['sup_review','div_review','dept_review'],remarks:['compliance'],cleared:['cleared','return_out','out']};
const PILLS=[['','All Status'],['incoming','Incoming'],['assigned','Assigned'],['review','In Review'],['remarks','Remarks'],['cleared','Cleared Out']];
function matchDoc(d,f,u){
 if(f.tile==='ongoing'&&!isOpen(d))return false;
 if(f.tile==='action'&&!isMyTurn(u,d))return false;
 if(f.tile==='overdue'&&!((isClockActive(d)&&dl(d).key==='over')||(isOpen(d)&&stalled(d))))return false;
 if(f.tile==='cleared'&&d.status!=='cleared')return false;
 if(f.group&&!GROUPS[f.group].includes(d.status))return false;
 if(f.priority&&d.priority!==f.priority)return false;
 if(f.node&&STAGES[d.status].node!==f.node)return false;
 if(f.status&&d.status!==f.status)return false;
 if(f.division&&d.division!==f.division)return false;
 if(f.txType&&d.txType!==f.txType)return false;
 if(f.docType&&d.docType!==f.docType)return false;
 if(f.comm&&d.commType!==f.comm)return false;
 if(f.assignee&&d.assignee!==f.assignee)return false;
 if(f.region&&d.region!==f.region)return false;
 if(f.regular&&!isRegularDoc(d.docType))return false;
 if(f.open&&!isOpen(d))return false;
 if(f.dl){const k=dl(d).key;if(k!==f.dl)return false;}
 if(f.stalled&&!stalled(d))return false;
 if(f.from&&isoD(d.receivedAt)<f.from)return false;
 if(f.to&&isoD(d.receivedAt)>f.to)return false;
 if(f.outFrom&&!(d.outAt&&isoD(d.outAt)>=f.outFrom))return false;
 if(f.q){const hay=[d.trackNo,d.subject,d.source,d.refNo,d.docType,d.region,d.division,uname(d.assignee),deskInfo(d).who.join(' '),d.commType,d.txType].join(' ').toLowerCase();if(!hay.includes(f.q.toLowerCase()))return false;}
 return true;
}
const SORTERS={receivedAt:d=>d.receivedAt,trackNo:d=>d.trackNo,subject:d=>d.subject.toLowerCase(),source:d=>d.source.toLowerCase(),division:d=>d.division,stage:d=>STAGES[d.status].ord,tx:d=>d.txType||'~',due:d=>d.dueAt||'9999',desk:d=>+new Date(d.stageEnteredAt)};
const SORT_LABELS=[['receivedAt','Date Inflow'],['trackNo','Tracking Code'],['due','Deadline'],['desk','Time in Desk'],['stage','Lifecycle Stage'],['subject','Title']];
function specialDocRows(){return spItems().map(i=>{const d=spWorkflowDoc(i,ME());return Object.assign(d,{id:'sr-'+i.id,specialReport:true,specialId:i.id,source:'System generated',reportingPeriod:i.periodLabel,autoRouted:false});});}
function baseDocs(u){const f=UI.filters;return visibleDocs(u).concat(specialDocRows()).filter(d=>(!f.division||d.division===f.division)&&(!f.priority||d.priority===f.priority));}
function listDocs(u){
 const f=UI.filters,fn=SORTERS[UI.sort.k]||SORTERS.receivedAt,dir=UI.sort.dir;
 return baseDocs(u).filter(d=>matchDoc(d,f,u)).sort((a,b)=>{const x=fn(a),y=fn(b);return (x<y?-1:x>y?1:0)*dir;});
}
const FILTER_LABELS={node:'Desk',status:'Status',txType:'Transaction',docType:'Document type',comm:'Communication',assignee:'Assigned to',region:'Region',dl:'Deadline',stalled:'Stalled at desk',from:'Received from',to:'Received to',outFrom:'Released from',regular:'Regular reports',open:'Open only'};
function filterChips(){
 const f=UI.filters,out=[];
 Object.keys(FILTER_LABELS).forEach(k=>{
  if(f[k]===''||f[k]===undefined||f[k]===false)return;
  let v=f[k];
  if(k==='node')v=(NODES.find(n=>n.k===v)||{}).label;else if(k==='status')v=STAGES[v]?STAGES[v].short:v;else if(k==='assignee')v=uname(v);
  else if(k==='dl')v={over:'Overdue',soon:'Due soon',ok:'On track',done_late:'Completed late',done_ok:'Completed on time',pending:'Clock not started',none:'No deadline'}[v]||v;
  else if(k==='stalled'||k==='regular'||k==='open')v='Yes';
  out.push('<button class="chip" data-act="clearFilter" data-k="'+k+'" title="Remove filter">'+esc(FILTER_LABELS[k])+': '+esc(v)+' '+ic('x').replace('<svg','<svg width="12" height="12"')+'</button>');
 });
 return out.length?'<div class="chips" style="margin:12px 0 0">'+out.join('')+'<button class="btn ghost sm" data-act="clearAllFilters">Clear all</button></div>':'';
}
const COLS=[
 {k:'trk',l:'Tracking Code',s:'trackNo'},{k:'title',l:'Title & Classification',s:'subject'},{k:'origin',l:'Origin & Time Inflow',s:'source'},
 {k:'recv',l:'Date Received',s:'receivedAt'},{k:'fwd',l:'Forwarded To & Officer',s:'division'},{k:'cust',l:'Current Custodian',s:'desk'},
 {k:'due',l:'Deadline',s:'due'},{k:'life',l:'Lifecycle Progress',s:'stage'}
];
try{UI.hidden=JSON.parse(localStorage.getItem('dts.colsHidden')||'[]');}catch(e){UI.hidden=[];}
UI.sel=new Set();UI.batch='';UI.sig=undefined;
const prLabel=p=>p==='Urgent'?'Urgent':'Routine';
function cell(k,d){
 const di=deskInfo(d),x=dl(d);
 switch(k){
  case 'trk':return '<span class="mono">'+esc(d.trackNo)+'</span> <span class="tag '+(d.priority==='Urgent'?'tag-urgent':'tag-routine')+'">'+prLabel(d.priority)+'</span>';
  case 'title':return '<div class="subj">'+esc(d.subject)+'</div><div class="sub">'+esc(d.commType)+' &bull; '+esc(d.docType)+(d.txType?' &bull; '+esc(d.txType):'')+'</div>';
  case 'origin':return '<div class="b">'+esc(d.source)+'</div><div class="sub">Logged '+fmtT(d.receivedAt)+'</div>';
  case 'recv':return '<span class="nowrap">'+ic('calendar').replace('<svg','<svg class="cic"')+' '+fmtD(d.receivedAt)+'</span>';
  case 'fwd':{const f=divFocal(d.division);return '<span class="pilldiv">'+esc(d.division)+'</span><div class="sub">'+esc(d.autoRouted?uname(d.assignee):(f?f.name:'No focal set'))+'</div>'+(d.reportingPeriod?'<div class="sub">Reporting period: '+esc(d.reportingPeriod)+'</div>':'');}
  case 'cust':return '<div class="cust"><span class="cav">'+ic('person')+'</span><div><div class="b">'+esc(di.who.filter(Boolean)[0]||'—')+(di.who.filter(Boolean).length>1?' +'+(di.who.filter(Boolean).length-1):'')+'</div><div class="sub">'+esc(di.label)+(d.status!=='out'?', '+esc(elapsed(d.stageEnteredAt)):'')+'</div>'+(stalled(d)?'<div>'+badge('warn','Stalled at desk')+'</div>':'')+'</div></div>';
  case 'due':return (d.dueAt?'<div class="nowrap">'+fmtD(parseD(d.dueAt))+'</div>':'')+badge(x.tone,x.label);
  case 'life':return lcBar(d)+((d.draftUrl||d.revUrl)?'<div style="margin-top:5px">'+renderUrl(d.draftUrl||'','Draft')+(d.revUrl?' '+renderUrl(d.revUrl,'Rev '+(d.revCount||1)):'')+'</div>':'');
 }
 return '';
}
function regRow(d,cols){
 if(d.specialReport){const item=spItems().find(x=>x.id===d.specialId),active=srActiveAssign(item||{}),first=active[0],status=item?srStatus(item):{tone:'info',chip:'Pending'};return '<tr class="click" data-act="spOpen" data-id="'+esc(d.specialId)+'"><td class="selc" data-act="noop"><input type="checkbox" aria-label="Select '+esc(d.trackNo)+'" data-chg="rowSel" data-id="'+esc(d.id)+'"'+(UI.sel.has(d.id)?' checked':'')+'></td>'+cols.map(c=>'<td>'+(c.k==='title'?'<span class="sr-tag">SPECIAL REPORT</span><div class="subj">'+esc(d.subject)+'</div><div class="sub">Reporting period: '+esc(d.reportingPeriod)+'</div>':c.k==='trk'?'<span class="mono">'+esc(d.trackNo)+'</span>':c.k==='origin'?'<div class="b">System generated</div><div class="sub">Generated '+fmtD(d.receivedAt)+'</div>':c.k==='recv'?'<span class="nowrap">'+ic('calendar').replace('<svg','<svg class="cic"')+' '+fmtD(d.receivedAt)+'</span>':c.k==='fwd'?(d.division?'<span class="pilldiv">'+esc(d.division)+'</span>':'<span class="pilldiv">—</span>')+'<div class="sub">'+esc(first?uname(first.userId):'No focal set')+'</div>':c.k==='cust'?'<div class="cust"><span class="cav">'+ic('person')+'</span><div><div class="b">'+esc(deskInfo(d).who.filter(Boolean)[0]||'—')+'</div><div class="sub">'+esc(deskInfo(d).label)+(d.status!=='out'?', '+esc(elapsed(d.stageEnteredAt)):'')+'</div></div></div>':c.k==='due'?(d.dueAt?fmtD(parseD(d.dueAt)):'—')+' '+badge(status.tone,status.chip):c.k==='life'?lcBar(d):'')+'</td>').join('')+'</tr>';}
 const x=dl(d),act=isClockActive(d),cls=act&&x.key==='over'?'r-over':(act&&x.key==='soon')||(isOpen(d)&&stalled(d))?'r-soon':d.status==='cleared'?'r-ok':'';
 return '<tr class="click '+cls+'" data-act="openDoc" data-id="'+d.id+'"><td class="selc" data-act="noop"><input type="checkbox" aria-label="Select '+esc(d.trackNo)+'" data-chg="rowSel" data-id="'+d.id+'"'+(UI.sel.has(d.id)?' checked':'')+'></td>'+cols.map(c=>'<td>'+cell(c.k,d)+'</td>').join('')+'</tr>';
}
const PAGE=25;
const paging=list=>{const pages=Math.max(1,Math.ceil(list.length/PAGE));if(UI.page>pages)UI.page=pages;return{pages:pages,rows:list.slice((UI.page-1)*PAGE,UI.page*PAGE)};};
function pageRows(list){return paging(list);}
function regMeta(u,list){
 const pg=pageRows(list),a=list.length?(UI.page-1)*PAGE+1:0,b=Math.min(list.length,UI.page*PAGE);
 return (has(u,'doc.delete')?'<span class="delpill">'+ic('trash')+' Deletion allowed (System Admin)</span>':'')+
  '<span class="muted">Showing <b>'+a+'&ndash;'+b+'</b> of <b>'+list.length+'</b> records</span>'+
  '<span class="sortsel"><label for="sortKey">Sorted by:</label><select id="sortKey" data-chg="sortKey">'+SORT_LABELS.map(s=>opt(s[0],s[1],UI.sort.k===s[0])).join('')+'</select><button class="btn sm" data-act="sortDir" aria-label="Reverse the sort order" title="Reverse the sort order">'+(UI.sort.dir<0?'&darr;':'&uarr;')+'</button></span>';
}
function regTable(u,list){
 const cols=COLS.filter(c=>!UI.hidden.includes(c.k)),pg=pageRows(list),allOn=pg.rows.length&&pg.rows.every(d=>UI.sel.has(d.id)),n=UI.sel.size;
 const acts=[['','Select batch action...']];
 if(has(u,'report.print')){acts.push(['print','Print routing slips']);acts.push(['csv','Download selected as CSV']);}
 if(has(u,'doc.forward'))acts.push(['forward','Forward to focal']);
 if(has(u,'doc.logout'))acts.push(['logout','Log out (cleared or for return)']);
 if(has(u,'doc.delete'))acts.push(['delete','Delete selected']);
 const th=c=>'<th class="sortable" data-act="sort" data-k="'+c.s+'" aria-sort="'+(UI.sort.k===c.s?(UI.sort.dir>0?'ascending':'descending'):'none')+'">'+c.l+(UI.sort.k===c.s?(UI.sort.dir>0?' &uarr;':' &darr;'):'')+'</th>';
 return '<div class="card"><div class="rt"><label class="chk b"><input type="checkbox" data-chg="selAll"'+(allOn?' checked':'')+'> Select all visible ('+pg.rows.length+')</label>'+(n?'<span class="badge b-info">'+n+' selected</span>':'')+'<div class="grow"></div>'+
  '<div class="menu-wrap"><button class="btn sm" data-act="colsMenu">'+ic('columns')+' View Columns</button>'+(UI.menu==='cols'?'<div class="menu" style="width:250px;right:0"><div class="mh">Show columns</div>'+COLS.map(c=>c.k==='trk'?'':'<label class="mi chk"><input type="checkbox" data-chg="col" data-k="'+c.k+'"'+(UI.hidden.includes(c.k)?'':' checked')+'> '+esc(c.l)+'</label>').join('')+'</div>':'')+'</div>'+
  (has(u,'report.print')?'<button class="btn sm csv" data-act="exportList">'+ic('download')+' Download CSV</button>':'')+
  (acts.length>1?'<select class="batch" data-chg="batchSel" aria-label="Batch action">'+acts.map(a=>opt(a[0],a[1],UI.batch===a[0])).join('')+'</select><button class="btn sm primary" data-act="batchExec"'+(n&&UI.batch?'':' disabled')+'>'+ic('send')+' Execute Action</button>':'')+
  (has(u,'report.print')?'<button class="btn sm" data-act="printList">'+ic('print')+' Print Registry</button>':'')+'</div>'+
  '<div class="tw" style="border:0;border-radius:0"><table class="tbl reg"><thead><tr><th class="selc"></th>'+cols.map(th).join('')+'</tr></thead><tbody>'+
  (pg.rows.length?pg.rows.map(d=>regRow(d,cols)).join(''):'<tr><td colspan="'+(cols.length+1)+'"><div class="empty"><b>No documents match.</b>Change or clear the filters, or log a new document.</div></td></tr>')+'</tbody></table></div>'+
  '<div class="pager" style="padding:10px 16px"><span>'+plural(list.length,'document')+'</span><span class="row"><button class="btn sm" data-act="page" data-d="-1"'+(UI.page<=1?' disabled':'')+'>Previous</button><span>Page '+UI.page+' of '+pg.pages+'</span><button class="btn sm" data-act="page" data-d="1"'+(UI.page>=pg.pages?' disabled':'')+'>Next</button></span></div></div>';
}
function markSeen(){UI.sig=UI.sig||{};S.docs.forEach(d=>{UI.sig[d.id]=d.history.length+':'+d.status;});}
function refreshReg(){
 const u=ME();if(!u||!$('#regTable'))return;
 const list=listDocs(u);
 $('#regMeta').innerHTML=regMeta(u,list);$('#regChips').innerHTML=filterChips();$('#regTable').innerHTML=regTable(u,list);
}
const clearSel=()=>{UI.sel.clear();UI.batch='';};
ACTIONS.noop=()=>{};
ACTIONS.sort=(t)=>{const k=t.dataset.k;if(UI.sort.k===k)UI.sort.dir*=-1;else{UI.sort.k=k;UI.sort.dir=1;}refreshReg();};
ACTIONS.sortDir=()=>{UI.sort.dir*=-1;refreshReg();};
CHANGES.sortKey=(t)=>{UI.sort.k=t.value;UI.sort.dir=(t.value==='receivedAt'||t.value==='desk')?-1:1;refreshReg();};
ACTIONS.page=(t)=>{UI.page+=Number(t.dataset.d);refreshReg();};
ACTIONS.clearFilter=(t)=>{delete UI.filters[t.dataset.k];UI.page=1;clearSel();render();};
ACTIONS.clearAllFilters=()=>{UI.filters={tile:'total'};UI.page=1;clearSel();render();};
CHANGES.filter=(t)=>{UI.filters[t.dataset.k]=t.value;UI.page=1;clearSel();refreshReg();};
CHANGES.filterFull=(t)=>{UI.filters[t.dataset.k]=t.value;UI.page=1;clearSel();render();};
INPUTS.filter=(t)=>{UI.filters[t.dataset.k]=t.value.trim();UI.page=1;clearSel();refreshReg();};
ACTIONS.tile=(t)=>{const k=t.dataset.k;UI.filters.tile=(UI.filters.tile===k&&k!=='total')?'total':k;UI.filters.group='';UI.page=1;clearSel();render();};
ACTIONS.pill=(t)=>{UI.filters.group=t.dataset.g;UI.filters.tile='total';UI.page=1;clearSel();render();};
ACTIONS.toggleMore=()=>{const e=$('#moreF');if(e)e.hidden=!e.hidden;};
ACTIONS.colsMenu=()=>{UI.menu=UI.menu==='cols'?null:'cols';refreshReg();};
CHANGES.col=(t)=>{const k=t.dataset.k;UI.hidden=UI.hidden.filter(x=>x!==k);if(!t.checked)UI.hidden.push(k);try{localStorage.setItem('dts.colsHidden',JSON.stringify(UI.hidden));}catch(e){}refreshReg();};
CHANGES.rowSel=(t)=>{if(t.checked)UI.sel.add(t.dataset.id);else UI.sel.delete(t.dataset.id);refreshReg();};
CHANGES.selAll=(t)=>{pageRows(listDocs(ME())).rows.forEach(d=>{if(t.checked)UI.sel.add(d.id);else UI.sel.delete(d.id);});refreshReg();};
CHANGES.batchSel=(t)=>{UI.batch=t.value;refreshReg();};
/* Centralized keyboard-shortcut config — both the handler below and the cheat-sheet
   modal (ACTIONS.shortcuts) read from this single list, so the two can never drift apart. */
const SHORTCUTS=[
 {key:'/',label:'Search',desc:'Focus the search box on the dashboard'},
 {key:'a',label:'For My Action',desc:'Go to your action queue'},
 {key:'d',label:'Dashboard',desc:'Go to the dashboard'},
 {key:'r',label:'Regular reports',desc:'Go to regular reports'},
 {key:'l',label:'Log document',desc:'Open the log-document form (if you are allowed to log documents)'},
 {key:'c',label:'Clear / log out',desc:'On an open document, jump to its clear or log-out action — always asks you to confirm first'},
 {key:'?',label:'Keyboard shortcuts',desc:'Show this list'},
 {key:'Esc',label:'Close',desc:'Close a dialog, menu or the print preview'}
];
document.addEventListener('keydown',ev=>{
 if(ev.ctrlKey||ev.metaKey||ev.altKey)return;
 const a=document.activeElement;if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))return;
 if($('#modalRoot').innerHTML||$('#pp.on'))return; // never fire behind an open dialog or print preview
 if(ev.key==='/'){const s=$('#regSearch');if(s){ev.preventDefault();s.focus();}return;}
 if(!ME())return;
 if(ev.key==='?'){ev.preventDefault();ACTIONS.shortcuts();return;}
 if(ev.key==='a'){ev.preventDefault();go('action');return;}
 if(ev.key==='d'){ev.preventDefault();go('dashboard');return;}
 if(ev.key==='r'){ev.preventDefault();go('regular');return;}
 if(ev.key==='l'){if(has(ME(),'doc.log')){ev.preventDefault();openDocForm(null);}return;}
 if(ev.key==='c'){
  if(UI.route!=='doc')return;
  const clearBtn=document.querySelector('[data-act=doReview][data-type=dept_clear]');
  const overrideBtn=document.querySelector('[data-act=overrideClear]');
  const logoutBtn=document.querySelector('[data-act=doLogout]');
  ev.preventDefault();
  if(clearBtn)confirmBox('Clear for out','No comments — clear this document for out?','Clear for out',()=>clearBtn.click());
  else if(overrideBtn)overrideBtn.click(); // this button already opens its own confirm dialog
  else if(logoutBtn)logoutBtn.closest('[data-panel]').querySelector('input[name=outTo]')?.focus();
  else toast('Nothing to clear or log out on this document right now.');
 }
});
ACTIONS.shortcuts=()=>{
 const rows=SHORTCUTS.map(s=>'<tr><td><kbd class="kbd">'+esc(s.key)+'</kbd></td><td><b>'+esc(s.label)+'</b><div class="small muted">'+esc(s.desc)+'</div></td></tr>').join('');
 openModal('Keyboard shortcuts','<p class="hint" style="margin-bottom:12px">Shortcuts are ignored while typing in a text field, and never trigger a change without asking you to confirm first.</p><table class="tbl"><tbody>'+rows+'</tbody></table>',{foot:'<button class="btn" data-act="closeModal">Close</button>'});
};

/* --- batch actions --- */
const BATCH={
 forward:{type:'forward',title:'Forward to focal',verb:'Forwarded',ok:d=>!d.specialReport&&d.status==='received',pl:()=>({remarks:'Batch forward'}),why:'not a regular document at the Admin desk'},
 logout:{type:'logout',title:'Log out documents',verb:'Logged out',ok:d=>!d.specialReport&&(d.status==='cleared'||d.status==='return_out'),pl:d=>({outTo:d.source,outAt:new Date().toISOString(),remarks:'Batch log out'}),why:'not a regular document cleared or for return'},
 'delete':{type:'delete',title:'Delete documents',verb:'Deleted',ok:d=>!d.specialReport,pl:()=>({}),why:'Special Reports cannot be deleted with document actions'}
};
function selectedDocs(){const all=visibleDocs(ME()).concat(specialDocRows());return [...UI.sel].map(id=>all.find(d=>d.id===id)||S.docs.find(d=>d.id===id)).filter(Boolean);}
ACTIONS.batchExec=()=>{
 const docs=selectedDocs(),a=UI.batch;
 if(!a||!docs.length)return;
 if(a==='print'){openPP(docs.map((d,i)=>'<div class="'+(i<docs.length-1?'sheet-break':'')+'">'+slipHTML(d)+'</div>').join(''));return;}
 if(a==='csv'){exportCSV('documents-selected',DOC_COLS,docExportRows(docs));return;}
 const sp=BATCH[a];if(!sp)return;
 const elig=docs.filter(sp.ok);
 if(!elig.length)return toast('None of the selected documents can take that action at their current stage.','bad');
 const skipped=docs.length-elig.length;
 confirmBox(sp.title,(a==='logout'?'Each document is released to its original sender, dated now. ':'')+'This applies to '+elig.length+' of '+docs.length+' selected'+(skipped?'. '+skipped+' will be skipped ('+sp.why+')':'')+'.',sp.title,async()=>{
  let done=0,failed=0,err='';
  for(const d of elig){const r=await api('POST','/api/docs/'+d.id+'/act',{type:sp.type,payload:sp.pl(d)});if(r.ok)done++;else{failed++;err=r.error;}}
  clearSel();toast(sp.verb+' '+plural(done,'document')+(failed?'. '+failed+' failed: '+err:'.'),failed?'bad':'ok');await refresh();
 },a==='delete');
};

/* --- export / print --- */
function docExportRows(list){return list.map(d=>[d.trackNo,fmtD(d.receivedAt),d.commType,d.source,d.refNo,d.subject,d.docType,d.division,d.region,d.txType,d.dueAt?fmtD(parseD(d.dueAt)):'',STAGES[d.status].label,deskText(d),dl(d).label,lcInfo(d).pct+'%',d.clearedAt?fmtDT(d.clearedAt):'',d.outAt?fmtDT(d.outAt):'',d.outType||'']);}
const DOC_COLS=['Tracking no.','Date received','Communication type','Received from','Reference no.','Subject','Document type','Division','Region / office','Type of transaction','Due date','Status','Current desk','Deadline status','Lifecycle progress','Cleared for out','Logged out','Out type'];
const exportRowsNow=()=>{const sel=selectedDocs();return sel.length?sel:listDocs(ME());};
ACTIONS.exportList=()=>exportCSV('registry',DOC_COLS,docExportRows(exportRowsNow()));
ACTIONS.printList=()=>{const l=exportRowsNow();openPP(listSheet('Document registry',(UI.sel.size?'Selected documents':'Filtered view')+', '+plural(l.length,'document'),l));};
function sheetHead(title,sub){return '<div class="sh"><div class="row" style="gap:10px;align-items:flex-start"><img class="sheetlogo" src="/logo-black.png" alt=""><div><div class="org">'+esc(S.settings.orgName)+'</div><h1>'+esc(title)+'</h1>'+(sub?'<div>'+esc(sub)+'</div>':'')+'</div></div><div style="text-align:right">Printed '+fmtDT(new Date())+'<br>By '+esc(ME().name)+'</div></div>';}
function listSheet(title,sub,list){
 return sheetHead(title,sub)+'<table><thead><tr><th>Tracking no.</th><th>Received</th><th>Subject / document type</th><th>From</th><th>Division</th><th>Current desk</th><th>Due</th><th>Lifecycle</th></tr></thead><tbody>'+
 (list.length?list.map(d=>'<tr><td>'+esc(d.trackNo)+'</td><td>'+fmtD(d.receivedAt)+'</td><td><b>'+esc(d.subject)+'</b><br>'+esc(d.docType)+'</td><td>'+esc(d.source)+'</td><td>'+esc(d.division)+'</td><td>'+esc(deskText(d))+'</td><td>'+(d.dueAt?fmtD(parseD(d.dueAt)):'—')+'<br>'+esc(dl(d).label)+'</td><td>'+esc(lcInfo(d).chip)+' ('+lcInfo(d).pct+'%)</td></tr>').join(''):'<tr><td colspan="8">No documents.</td></tr>')+'</tbody></table><div class="foot"><span>'+plural(list.length,'document')+'</span><span>End of registry</span></div>';
}

/* =====================  DASHBOARD (dashboard and documents merged)  ===================== */
function kpiTile(k,tone,icon,label,n,sub,on,hot){
 return '<button class="kt kt-'+tone+(on?' on':'')+(hot?' hot':'')+'" data-act="tile" data-k="'+k+'" aria-pressed="'+(on?'true':'false')+'"><span class="kt-h"><span class="kt-l">'+esc(label)+'</span><span class="kt-i">'+ic(icon)+'</span></span><span class="kt-n">'+n+'</span><span class="kt-s">'+esc(sub)+'</span></button>';
}
VIEWS.dashboard=(u)=>{
 const f=UI.filters;if(!f.tile)f.tile='total';
 const base=baseDocs(u),open=base.filter(isOpen);
 const over=base.filter(d=>isClockActive(d)&&dl(d).key==='over'),stall=open.filter(d=>stalled(d)),soon=base.filter(d=>isClockActive(d)&&dl(d).key==='soon');
 const overdueN=new Set(over.concat(stall).map(d=>d.id)).size,mine=base.filter(d=>isMyTurn(u,d)),clr=base.filter(d=>d.status==='cleared');
 const ap=deptApprovers({division:''});
 const banner=(ap.tier!=='Department Manager')?'<div class="banner warn">'+ic('alert')+'<div><b>The Department Manager is away.</b> Final review and clearance currently go to: '+(ap.tier==='none'?'no one. Nominate an OIC (System Administrator) so documents can be cleared.':esc(ap.tier)+' - '+esc(ap.users.map(x=>x.name).join(', '))+'.')+'</div></div>':'';
 const hr=new Date().getHours(),adv=Object.keys(FILTER_LABELS).some(k=>f[k]);
 const sel=(k,label,items,full)=>'<select data-chg="'+(full?'filterFull':'filter')+'" data-k="'+k+'" aria-label="'+label+'"><option value="">'+label+'</option>'+items.map(i=>opt(i[0],i[1],f[k]===i[0])).join('')+'</select>';
 const people=S.users.filter(x=>x.active&&['staff','supervisor','focal'].includes(x.role));
 return '<div class="wrap"><div class="hello"><div><h1>Good '+(hr<12?'morning':hr<18?'afternoon':'evening')+', '+esc(firstName(u.name))+'</h1><p>'+esc(new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}))+'. '+(mine.length?'You have '+plural(mine.length,'document')+' waiting for action.':'Nothing is waiting on you.')+'</p></div></div>'+banner+
 '<div class="kts">'+
 kpiTile('total','info','docs','Total Monitored',base.length,'Documents in the registry',f.tile==='total')+
 kpiTile('ongoing','warn','inbox','Ongoing',open.length,'Under desk routing & action',f.tile==='ongoing')+
 kpiTile('action','pur','alertc','Action Required',mine.length,'Waiting on my desk',f.tile==='action')+
 kpiTile('overdue','bad','timer','Overdue Stay',overdueN,soon.length?'Past threshold or stalled; '+soon.length+' due soon':'Exceeded desk or deadline threshold',f.tile==='overdue',overdueN>0)+
 kpiTile('cleared','ok','shieldcheck','Cleared for Out',clr.length,'Manager sign-off authorized',f.tile==='cleared')+'</div>'+
 '<section class="card fp"><div class="fp-top"><label class="srch">'+ic('search')+'<input id="regSearch" type="search" placeholder="Search tracking number, subject, originating office, custodian..." aria-label="Search the registry" value="'+esc(f.q||'')+'" data-inp="filter" data-k="q"><kbd>/</kbd></label>'+
 '<div class="pills" role="group" aria-label="Filter by status"><span class="fp-l">Filter:</span>'+PILLS.map(p=>'<button class="pill" data-act="pill" data-g="'+p[0]+'" aria-pressed="'+((f.group||'')===p[0])+'">'+p[1]+'</button>').join('')+'</div></div>'+
 '<div class="fp-row"><label class="fsel">Priority '+sel('priority','All Priorities',[['Normal','Routine'],['Urgent','Urgent']],true)+'</label><label class="fsel">Target Division '+sel('division','All Divisions',S.divisions.map(d=>[d.code,d.code]),true)+'</label><button class="btn sm ghost" data-act="toggleMore">'+ic('columns')+' More filters</button><div class="grow"></div><div class="meta" id="regMeta"></div></div>'+
 '<div id="moreF" class="fbar" style="margin:12px 0 0"'+(adv?'':' hidden')+'>'+sel('txType','All transactions',S.refs.tx.map(t=>[t.name,t.name]))+sel('docType','All document types',S.refs.doc.map(t=>[t.name,t.name]))+sel('comm','All communication types',S.refs.comm.map(t=>[t,t]))+sel('assignee','Anyone assigned',people.map(p=>[p.id,p.name]))+
 sel('dl','Any deadline',[['over','Overdue'],['soon','Due soon'],['ok','On track'],['done_ok','Completed on time'],['done_late','Completed late'],['none','No deadline'],['pending','Clock not started']])+sel('status','Any status',Object.keys(STAGES).map(s=>[s,STAGES[s].short]))+
 '<input type="date" aria-label="Received from" title="Received from" value="'+esc(f.from||'')+'" data-chg="filter" data-k="from"><input type="date" aria-label="Received to" title="Received to" value="'+esc(f.to||'')+'" data-chg="filter" data-k="to"></div><div id="regChips"></div></section>'+
 '<div id="regTable" style="margin-top:16px"></div></div>';
};
VIEWS.documents=VIEWS.dashboard;
VIEWS.action=(u)=>{
 const list=actionDocs(u),sp=spActionHTML(u);
 return '<div class="wrap"><div class="pagehead"><div><h1>For My Action</h1><p>Every document where it is your turn to act — to forward, assign, process, review, clear, or log out. '+plural(list.length,'document')+(sp?' and '+plural(spMine(u).length,'Special Report'):'')+'.</p></div></div>'+sp+
  (list.length?regTable(u,list):sp?'':'<div class="card empty"><b>Nothing is waiting on you right now.</b>New documents that need your action will appear here as soon as they reach your desk.</div>')+'</div>';
};
function afterDashboard(){if(UI.route==='dashboard'){refreshReg();}markSeen();}

/* =====================  REPORTING PERIOD (MONTHS) FILTER  =====================
   One shared filter for Analytics and Graphs: a single month, a continuous range of months, or any
   set of individual months. Everything downstream reads periodMonths(), so both pages, their print
   output and their CSV export always agree on the period. */
function monthKey(d){const x=new Date(d);return x.getFullYear()+'-'+p2(x.getMonth()+1);}
const keyYear=k=>Number(String(k).slice(0,4));
const keyMonth=k=>Number(String(k).slice(5,7));
const keyValid=k=>/^\d{4}-(0[1-9]|1[0-2])$/.test(String(k||''));
function keyAdd(k,n){let y=keyYear(k),m=keyMonth(k)-1+n;y+=Math.floor(m/12);m=((m%12)+12)%12;return y+'-'+p2(m+1);}
function keyLabel(k,short){if(!keyValid(k))return '';return (short?MONTH_ABBR[keyMonth(k)-1]:MONTHS[keyMonth(k)-1])+' '+keyYear(k);}
function monthsBetween(a,b){
 if(!keyValid(a)||!keyValid(b))return [];
 let s=a,e=b;if(s>e){const t=s;s=e;e=t;}
 const out=[];let k=s,guard=0;
 while(k<=e&&guard++<600){out.push(k);k=keyAdd(k,1);}
 return out;
}
UI.gf={division:'',mode:'range',from:monthKey(new Date()),to:monthKey(new Date()),months:{}};
function periodMonths(){
 const g=UI.gf;
 if(g.mode==='single')return keyValid(g.from)?[g.from]:[];
 if(g.mode==='range')return monthsBetween(g.from,g.to);
 return Object.keys(g.months).filter(k=>g.months[k]&&keyValid(k)).sort();
}
function periodLabel(){
 const ms=periodMonths();
 if(!ms.length)return 'no month selected';
 if(ms.length===1)return keyLabel(ms[0]);
 const a=ms[0],b=ms[ms.length-1];
 if(monthsBetween(a,b).length===ms.length){
  if(keyYear(a)===keyYear(b))return MONTH_ABBR[keyMonth(a)-1]+'–'+keyLabel(b);
  return keyLabel(a)+' – '+keyLabel(b);
 }
 return ms.map(k=>keyLabel(k)).join(', ');
}
function availableMonths(){
 const set=new Set();
 S.docs.forEach(d=>{const k=isoD(d.receivedAt).slice(0,7);if(keyValid(k))set.add(k);});
 const now=monthKey(new Date());
 for(let i=0;i<18;i++)set.add(keyAdd(now,-i));
 return [...set].sort().reverse().slice(0,36);
}
function monthPicker(){
 const g=UI.gf,list=availableMonths();
 return '<details class="mpick"><summary>Choose months ('+periodMonths().length+' selected)</summary><div class="mgrid">'+list.map(k=>'<label class="chk"><input type="checkbox" data-chg="gfMonth" data-k="'+k+'"'+(g.months[k]?' checked':'')+'> '+esc(keyLabel(k))+'</label>').join('')+'</div></details>';
}
function chartFilters(){
 const g=UI.gf;
 const mode='<select data-chg="gfMode" aria-label="How the reporting period is chosen">'+[['single','One month'],['range','A range of months'],['months','Several months']].map(p=>opt(p[0],p[1],g.mode===p[0])).join('')+'</select>';
 let ctl='';
 if(g.mode==='single')ctl='<input type="month" data-chg="gfFrom" value="'+esc(g.from)+'" aria-label="Reporting month">';
 else if(g.mode==='range')ctl='<input type="month" data-chg="gfFrom" value="'+esc(g.from)+'" aria-label="From month"> <span class="muted small">to</span> <input type="month" data-chg="gfTo" value="'+esc(g.to)+'" aria-label="To month">';
 else ctl=monthPicker();
 return '<div class="filters">'+mode+ctl+'<select data-chg="gfDiv" aria-label="Division"><option value="">All divisions</option>'+S.divisions.map(d=>opt(d.code,d.code,g.division===d.code)).join('')+'</select></div>'+
  '<div class="periodline small">Reporting period: <b>'+esc(periodLabel())+'</b></div>';
}
function periodDocs(u){
 let docs=visibleDocs(u).concat(specialDocRows());const g=UI.gf;
 if(g.division)docs=docs.filter(d=>d.division===g.division);
 const ms=periodMonths();
 if(ms.length)docs=docs.filter(d=>ms.includes(isoD(d.receivedAt).slice(0,7)));
 return docs;
}
CHANGES.gfDiv=(t)=>{UI.gf.division=t.value;render();};
CHANGES.gfMode=(t)=>{
 UI.gf.mode=t.value;
 if(UI.gf.mode==='months'){const cur=UI.gf.from;UI.gf.months=Object.assign({},UI.gf.months,keyValid(cur)?{[cur]:true}:{});}
 render();
};
CHANGES.gfFrom=(t)=>{UI.gf.from=t.value;if(UI.gf.mode==='single')UI.gf.to=t.value;render();};
CHANGES.gfTo=(t)=>{UI.gf.to=t.value;render();};
CHANGES.gfMonth=(t)=>{const k=t.dataset.k;if(t.checked)UI.gf.months[k]=true;else delete UI.gf.months[k];render();};
function hbars(items,act,max){
 max=max||Math.max(1,...items.map(i=>i.total));
 if(!items.length)return '<div class="empty">Nothing to show yet.</div>';
 const inner=i=>'<span class="lab">'+esc(i.label)+'</span><span class="bar">'+i.segs.map(s=>s.n?'<i class="seg-'+s.c+'" style="width:'+(s.n/max*100)+'%"></i>':'').join('')+'</span><span class="v">'+i.total+'</span>';
 /* With no action (the print sheet) the same bars are plain rows, so no button appears on paper. */
 return items.map(i=>act?'<button class="hb" data-act="'+act+'" data-v="'+esc(i.key)+'" title="Open these documents">'+inner(i)+'</button>':'<div class="hb">'+inner(i)+'</div>').join('');
}
function donut(parts,centre){
 const tot=parts.reduce((a,p)=>a+p.n,0);let acc=0;
 const stops=parts.filter(p=>p.n).map(p=>{const a=acc/tot*360;acc+=p.n;return p.c+' '+a+'deg '+(acc/tot*360)+'deg';}).join(',');
 return '<div class="dn"><div class="ring" style="background:'+(tot?'conic-gradient('+stops+')':'var(--sunk)')+'"><span>'+esc(String(centre==null?tot:centre))+'</span></div><ul class="legend2">'+parts.map(p=>'<li><i style="background:'+p.c+'"></i>'+esc(p.l)+' <b>'+p.n+'</b></li>').join('')+'</ul></div>';
}
/* Everything the Graphs page shows, worked out once and shared with its Print output. */
function graphsData(u){
 const docs=periodDocs(u),open=docs.filter(isOpen),ms=periodMonths();
 const months=ms.length?ms:[monthKey(new Date())];
 const nodeHtml=NODES.map(n=>{const ds=docs.filter(d=>STAGES[d.status].node===n.k),hot=ds.some(d=>isClockActive(d)&&dl(d).key==='over');
  return '<button class="rn'+(ds.length?' has':'')+(hot?' hot':'')+'" data-act="node" data-k="'+n.k+'" title="Open the documents at '+esc(n.label)+'"><span class="cir">'+ds.length+'</span>'+(hot?'<span class="fl">overdue</span>':'')+'<b>'+esc(n.label)+'</b><span>'+esc(n.sub)+'</span></button>';}).join('');
 const inMonth=(iso,k)=>!!iso&&isoD(iso).slice(0,7)===k;
 const vol=months.map(k=>({l:keyLabel(k,true),full:keyLabel(k),
  r:docs.filter(d=>inMonth(d.receivedAt,k)).length,
  o:docs.filter(d=>inMonth(d.outAt,k)).length,
  ok:docs.filter(d=>d.stopAt&&d.dueAt&&inMonth(d.stopAt,k)&&dl(d).key==='done_ok').length,
  late:docs.filter(d=>d.stopAt&&d.dueAt&&inMonth(d.stopAt,k)&&dl(d).key==='done_late').length}));
 const vb=(rows,a,b,ca,cb)=>{const m=Math.max(1,...rows.map(w=>Math.max(w[a],w[b])));return '<div class="vb">'+rows.map(w=>'<div class="col" title="'+esc(w.full||w.l)+'"><div class="pair"><i class="seg-'+ca+'" style="height:'+(w[a]/m*100)+'%"><em>'+(w[a]||'')+'</em></i><i class="seg-'+cb+'" style="height:'+(w[b]/m*100)+'%"><em>'+(w[b]||'')+'</em></i></div><span class="x">'+esc(w.l)+'</span></div>').join('')+'</div>';};
 const wl={};open.forEach(d=>{if(!d.assignee)return;const k=dl(d).key;const o=wl[d.assignee]||(wl[d.assignee]={ok:0,soon:0,over:0});if(isClockActive(d)&&k==='over')o.over++;else if(isClockActive(d)&&k==='soon')o.soon++;else o.ok++;});
 const wlItems=Object.keys(wl).map(k=>({key:k,label:uname(k),total:wl[k].ok+wl[k].soon+wl[k].over,segs:[{n:wl[k].over,c:'bad'},{n:wl[k].soon,c:'warn'},{n:wl[k].ok,c:'ok'}]})).sort((a,b)=>b.total-a.total);
 const cnt=(fn)=>{const o={};docs.forEach(d=>{const k=fn(d);if(k)o[k]=(o[k]||0)+1;});return Object.keys(o).map(k=>({key:k,label:k,total:o[k]})).sort((a,b)=>b.total-a.total);};
 const txItems=cnt(d=>d.txType||'Not yet classified').map(i=>Object.assign(i,{segs:[{n:i.total,c:'brand'}]}));
 const dvItems=cnt(d=>d.division).map(i=>Object.assign(i,{segs:[{n:i.total,c:'info'}]}));
 const gcount=g=>docs.filter(d=>GROUPS[g].includes(d.status)).length;
 const status=donut([{l:'Incoming',n:gcount('incoming'),c:'var(--neu)'},{l:'Assigned',n:gcount('assigned'),c:'var(--info)'},{l:'In review',n:gcount('review'),c:'#5B8DEF'},{l:'Remarks',n:gcount('remarks'),c:'var(--pur)'},{l:'Cleared out',n:gcount('cleared'),c:'var(--ok)'}],docs.length);
 const act=open.filter(isClockActive),dlc=k=>act.filter(d=>dl(d).key===k).length;
 const health=donut([{l:'Overdue',n:dlc('over'),c:'var(--bad)'},{l:'Due soon',n:dlc('soon'),c:'#E0A020'},{l:'On track',n:dlc('ok'),c:'var(--ok)'},{l:'No deadline',n:open.filter(d=>isClockActive(d)&&dl(d).key==='none').length+open.filter(d=>!d.clockStart).length,c:'var(--neu)'}],act.length);
 const bk=[['Under 1 working day',d=>wdBetween(d.stageEnteredAt,new Date())<1],['1 working day',d=>wdBetween(d.stageEnteredAt,new Date())===1],['2 to 3 working days',d=>{const n=wdBetween(d.stageEnteredAt,new Date());return n>=2&&n<=3;}],['4 to 7 working days',d=>{const n=wdBetween(d.stageEnteredAt,new Date());return n>=4&&n<=7;}],['8 or more working days',d=>wdBetween(d.stageEnteredAt,new Date())>=8]];
 const ageItems=bk.map((b,i)=>{const n=open.filter(b[1]).length;return{key:b[0],label:b[0],total:n,segs:[{n:n,c:i>=3?'bad':i===2?'warn':'ok'}]};});
 return{docs:docs,open:open,months:months,nodeHtml:nodeHtml,vol:vol,vb:vb,wlItems:wlItems,ageItems:ageItems,txItems:txItems,dvItems:dvItems,status:status,health:health};
}
VIEWS.graphs=(u)=>{
 const g=graphsData(u);
 return '<div class="wrap"><div class="pagehead"><div><h1>Graphs</h1><p>Visual view of volume, workload and delays for the reporting period below. Select a bar or a desk to open those documents in the registry.</p></div><div class="row">'+chartFilters()+(has(u,'report.print')?'<button class="btn" data-act="printGraphs">'+ic('print')+'Print</button>':'')+'</div></div>'+
 '<div class="card pad"><div class="row sp"><h2>Where documents are right now</h2><span class="hint">Select a desk</span></div><div class="route">'+g.nodeHtml+'</div></div>'+
 '<div class="charts" style="margin-top:16px">'+
 '<div class="card pad"><div class="row sp"><h3>Volume by month</h3><span class="legend"><span><i class="seg-brand"></i>Received</span><span><i class="seg-ok"></i>Released</span></span></div>'+g.vb(g.vol,'r','o','brand','ok')+'</div>'+
 '<div class="card pad"><div class="row sp"><h3>Finished on time or late, by month</h3><span class="legend"><span><i class="seg-ok"></i>On time</span><span><i class="seg-bad"></i>Late</span></span></div>'+g.vb(g.vol,'ok','late','ok','bad')+'</div>'+
 '<div class="card pad"><h3>Status mix</h3>'+g.status+'</div><div class="card pad"><h3>Deadline health of running clocks</h3>'+g.health+'</div>'+
 '<div class="card pad"><div class="row sp"><h3>Open documents by assigned staff</h3><span class="legend"><span><i class="seg-bad"></i>Overdue</span><span><i class="seg-warn"></i>Due soon</span><span><i class="seg-ok"></i>Other</span></span></div>'+hbars(g.wlItems.slice(0,10),'wl')+'</div>'+
 '<div class="card pad"><h3>Time at the current desk (open documents)</h3>'+hbars(g.ageItems,'agebar')+'</div>'+
 '<div class="card pad"><h3>By type of transaction</h3>'+hbars(g.txItems,'txbar')+'</div><div class="card pad"><h3>By division</h3>'+hbars(g.dvItems,'dvbar')+'</div></div></div>';
};
/* Print the graphs exactly as displayed, with titles, legends, labels and the reporting period,
   and without any of the application's navigation, filters or buttons. */
ACTIONS.printGraphs=()=>{
 const g=graphsData(ME());
 const block=(title,legend,body)=>'<div class="gblock"><h2>'+esc(title)+'</h2>'+(legend?'<div class="legend">'+legend+'</div>':'')+'<div>'+body+'</div></div>';
 const L=(label,cls)=>'<span><i class="seg-'+cls+'"></i>'+esc(label)+'</span>';
 const numbers=(rows,cols)=>({cols:cols,rows:rows});
 const volTable=numbers(g.vol.map(w=>[w.full,w.r,w.o,w.ok,w.late]),['Month','Received','Released','Finished on time','Finished late']);
 const printTable=t=>'<table><thead><tr>'+t.cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+t.rows.map(r=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 openPP(sheetHead('Graphs','Reporting period: '+periodLabel()+(UI.gf.division?' • Division '+UI.gf.division:''))+
  block('Where documents are right now','<span class="hint">Number of documents at each desk</span>','<div class="route">'+g.nodeHtml+'</div>')+
  block('Volume by month',L('Received','brand')+L('Released','ok'),g.vb(g.vol,'r','o','brand','ok')+printTable(volTable))+
  block('Finished on time or late, by month',L('On time','ok')+L('Late','bad'),g.vb(g.vol,'ok','late','ok','bad'))+
  block('Status mix','',g.status)+block('Deadline health of running clocks','',g.health)+
  block('Open documents by assigned staff',L('Overdue','bad')+L('Due soon','warn')+L('Other','ok'),hbars(g.wlItems.slice(0,10)))+
  block('Time at the current desk (open documents)','',hbars(g.ageItems))+
  block('By type of transaction','',hbars(g.txItems))+block('By division','',hbars(g.dvItems))+
  '<div class="foot"><span>'+plural(g.docs.length,'document')+' received in '+esc(periodLabel())+'</span><span>End of graphs</span></div>');
};
function goFilter(f){UI.filters=Object.assign({tile:'total'},f);UI.page=1;clearSel();go('dashboard');}
ACTIONS.node=(t)=>{const k=t.dataset.k;goFilter(k==='out'?{node:'out'}:{tile:'ongoing',node:k});};
ACTIONS.wl=(t)=>goFilter({tile:'ongoing',assignee:t.dataset.v});
ACTIONS.txbar=(t)=>goFilter({txType:t.dataset.v==='Not yet classified'?'':t.dataset.v});
ACTIONS.dvbar=(t)=>goFilter({division:t.dataset.v});
ACTIONS.grp=(t)=>goFilter({group:t.dataset.v});
ACTIONS.dlbar=(t)=>goFilter({tile:'ongoing',dl:t.dataset.v});
ACTIONS.agebar=(t)=>goFilter({tile:'ongoing'});

function analyticsData(u){
 const docs=periodDocs(u),fin=docs.filter(d=>d.clockStart&&d.stopAt),act=docs.filter(isClockActive);
 const over=act.filter(d=>dl(d).key==='over').length,stall=docs.filter(d=>isOpen(d)&&stalled(d)).length;
 const ms=periodMonths();
 const released=ms.length?docs.filter(d=>d.outAt&&ms.includes(isoD(d.outAt).slice(0,7))).length:docs.filter(d=>d.outAt).length;
 const kpi=[
  ['On-time rate',ontimePct(docs),'Finished within the threshold','ok'],['Average turnaround',avgTat(docs)==='—'?'—':avgTat(docs)+' days','Working days, assignment to clearance','info'],
  ['Completed late',String(docs.filter(d=>dl(d).key==='done_late').length),'Cleared after the due date','bad'],['Overdue now',String(over),'Running clocks past due','bad'],
  ['Stalled at a desk',String(stall),'Too long at Admin or Focal','warn'],['Compliance returns',fin.length?(fin.reduce((a,d)=>a+(d.cycles||0),0)/fin.length).toFixed(1):'—','Average per finished document','pur'],
  ['Released in the reporting period',String(released),'Logged out during the selected month or months','ok'],['Documents',String(docs.length),'Received in the selected month or months','info']
 ];
 const grp=(title,label,fn,names)=>({title:title,cols:[label,'Documents','Open','Finished','Avg. turnaround (working days)','On-time rate'],rows:names.map(n=>{const ds=docs.filter(d=>fn(d)===n);return [n,ds.length,ds.filter(isOpen).length,ds.filter(d=>d.stopAt).length,avgTat(ds),ontimePct(ds)];}).filter(r=>r[1]>0)});
 const tx=grp('By type of transaction','Type of transaction',d=>d.txType||'Not yet classified',S.refs.tx.map(t=>t.name).concat(['Not yet classified']));
 const dv=grp('By division','Division',d=>d.division,S.divisions.map(d=>d.code));
 const dts=[...new Set(docs.map(d=>d.docType))].sort((a,b)=>docs.filter(d=>d.docType===b).length-docs.filter(d=>d.docType===a).length).slice(0,10);
 const dt=grp('By document type (top 10)','Document type',d=>d.docType,dts);
 const staff={title:'Staff performance',cols:['Name','Role','Open','Overdue','Finished','Avg. turnaround (working days)','On-time rate','Comments received'],rows:S.users.filter(x=>x.active&&['staff','supervisor','focal'].includes(x.role)).map(x=>{const ds=docs.filter(d=>d.assignee===x.id),op=ds.filter(isOpen);return[x.name,roleName(x.role),op.length,op.filter(d=>isClockActive(d)&&dl(d).key==='over').length,ds.filter(d=>d.stopAt).length,avgTat(ds),ontimePct(ds),ds.reduce((a,d)=>a+d.comments.filter(c=>c.level!=='instruction').length,0)];}).filter(r=>r[2]||r[4]||r[7])};
 return{kpi:kpi,tables:[tx,dv,dt,staff]};
}
function analyticsSub(){
 const g=UI.gf;
 return 'Reporting period: '+periodLabel()+(g.division?'. Division '+g.division:'')+'. ';
}
function tableHTML(t){
 return '<div class="card pad"><h3 style="margin-bottom:10px">'+esc(t.title)+'</h3><div class="tw" style="border:0"><table class="tbl"><thead><tr>'+t.cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+(t.rows.length?t.rows.map(r=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+t.cols.length+'"><div class="empty">No data yet.</div></td></tr>')+'</tbody></table></div></div>';
}
VIEWS.analytics=(u)=>{
 const a=analyticsData(u);
 return '<div class="wrap"><div class="pagehead"><div><h1>Analytics</h1><p>Figures behind the workflow for the reporting period below: who is on time, how the work is spread and where documents are held up.</p></div><div class="row">'+chartFilters()+(has(u,'report.print')?'<button class="btn" data-act="printAnalytics">'+ic('print')+'Print</button><button class="btn" data-act="exportAnalytics">'+ic('download')+'Export CSV</button>':'')+'</div></div>'+
 '<div class="tiles" style="grid-template-columns:repeat(auto-fill,minmax(210px,1fr))">'+a.kpi.map(k=>'<div class="tile '+k[3]+'"><span class="n">'+esc(k[1])+'</span><span class="l">'+esc(k[0])+'</span><span class="s">'+esc(k[2])+'</span></div>').join('')+'</div>'+
 '<div class="stack" style="margin-top:18px">'+a.tables.map(tableHTML).join('')+'</div></div>';
};
ACTIONS.printAnalytics=()=>{const a=analyticsData(ME());openPP(sheetHead('Analytics summary',analyticsSub()+(a.tables.length?'':'No tables to show.'))+'<table><thead><tr><th>Measure</th><th>Value</th><th>Note</th></tr></thead><tbody>'+a.kpi.map(k=>'<tr><td>'+esc(k[0])+'</td><td>'+esc(k[1])+'</td><td>'+esc(k[2])+'</td></tr>').join('')+'</tbody></table>'+a.tables.map(t=>'<h2>'+esc(t.title)+'</h2><table><thead><tr>'+t.cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+t.rows.map(r=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>').join('')+'<div class="foot"><span>'+esc(periodLabel())+'</span><span>End of summary</span></div>');};
ACTIONS.exportAnalytics=()=>{const a=analyticsData(ME()),rows=[['Reporting period',periodLabel(),UI.gf.division||'All divisions'],[]];rows.push(['Measure','Value','Note']);a.kpi.forEach(k=>rows.push([k[0],k[1],k[2]]));a.tables.forEach(t=>{rows.push([]);rows.push([t.title]);rows.push(t.cols);t.rows.forEach(r=>rows.push(r));});
 saveFile('analytics-'+isoD(new Date())+'.csv','\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');};


/* =====================  DOCUMENT DETAIL  ===================== */
const RV_LABEL={sup:'Supervisor review',div:'Division Manager',dept:'Department Manager',instruction:'Return instruction'};
const TARGET_LABEL={sup_review:'Supervisor review',div_review:'the Division Manager',dept_review:'the Department Manager'};
function staffOptions(sel){
 const g=(role,label)=>{const us=S.users.filter(x=>x.active&&x.role===role);return us.length?'<optgroup label="'+label+'">'+us.map(x=>opt(x.id,x.name+' ('+S.docs.filter(d=>d.assignee===x.id&&isOpen(d)).length+' open)',sel===x.id)).join('')+'</optgroup>':'';};
 return '<option value="">Select staff</option>'+g('staff','Staff')+g('supervisor','Supervisors')+g('focal','Focal / Supervisors');
}
function focalOptions(sel){
 const us=S.users.filter(x=>x.active&&(x.role==='focal'||isDivFocal(x)));
 return '<option value="">Select a Division Focal</option>'+us.map(x=>opt(x.id,x.name+(x.role!=='focal'?' (Division Focal)':''),sel===x.id)).join('');
}
function reviewerOptions(d,u){
 const def=d.reviewer||REVIEW_LINE[d.assignee]||d.assignedBy||(divFocal(d.division)||{}).id||'';
 const g=(label,fn)=>{const us=S.users.filter(x=>x.active&&x.id!==u.id&&fn(x));return us.length?'<optgroup label="'+label+'">'+us.map(x=>opt(x.id,x.name,def===x.id)).join('')+'</optgroup>':'';};
 return '<option value="">Select reviewer</option>'+g('Focal / Supervisors',x=>x.role==='focal'||isDivFocal(x))+g('Supervisors',x=>x.role==='supervisor'&&!isDivFocal(x));
}
function openComments(d){return d.comments.filter(c=>!c.resolved&&c.level!=='instruction');}
function actionPanel(d,u,opts){
 let main='',misc='';
 const canAct=a=>can(u,d,a,!!(opts&&opts.strict));
 const ta=(n,l,ph,rows)=>'<div class="fld"><label>'+l+'</label><textarea name="'+n+'" rows="'+(rows||3)+'" placeholder="'+esc(ph||'')+'"></textarea></div>';
 if(canAct('forward')){const f=divFocal(d.division);
  main='<h3>Forward to the division focal</h3><p class="muted">'+(f?esc(d.division)+' is handled by <b>'+esc(f.name)+'</b>.':'<span style="color:var(--bad)">No Focal / Supervisor is set for '+esc(d.division)+'. Ask the System Administrator to set one under Divisions &amp; focals.</span>')+'</p>'+ta('remarks','Forwarding remarks (optional)','',2)+'<button class="btn primary" data-act="doForward" data-id="'+d.id+'"'+(f?'':' disabled')+'>'+ic('send')+'Forward'+(f?' to '+esc(f.name):'')+'</button>';}
 else if(canAct('assign')){
  const t=docTypeOf(d.docType),thr=docTypeThreshold(t),basis=docTypeBasis(t),perPeriod=basis==='reporting_period'&&thr>0;
  const info=perPeriod?'<div class="banner">'+ic('info')+'<div><b>Prescribed deadline for this document type:</b> '+esc(docTypeTerm(t))+'. It is worked out from the reporting period, not from the day you assign.</div></div>':'';
  main='<h3>Classify and assign</h3>'+
  '<div class="g2"><div class="fld"><label>Type of transaction</label><select name="txType" data-chg="txType"><option value="">Select</option>'+S.refs.tx.map(t2=>opt(t2.name,t2.name+(t2.days?' ('+t2.days+' working days)':t2.special?' (you set the date)':' (no deadline)'))).join('')+'</select></div><div class="fld"><label>Document type</label><select name="docType" data-chg="txType">'+activeDocTypes(d.docType).map(t2=>opt(t2.name,t2.name,t2.name===d.docType)).join('')+'</select></div></div>'+
  info+'<p class="hint">'+esc(thr>0?(perPeriod?'The prescribed threshold for '+(t?t.name:d.docType)+' is counted from the reporting period.':'The prescribed threshold for '+(t?t.name:d.docType)+' is '+plural(thr,thr===1?'day':'days')+' counted from to-day.'):'The type of transaction sets the deadline for this document type.')+'</p>'+
  '<div class="fld" id="specialWrap" hidden><label>Special deadline</label><input type="date" name="dueDate" min="'+isoD(new Date())+'"></div><p class="hint" id="duePrev"></p><div class="g2"><div class="fld"><label>Assign to</label><select name="assignee" id="assigneeSel">'+staffOptions('')+'</select><p class="hint" id="forInfoHint" hidden>Documents marked &ldquo;For information only&rdquo; can only be assigned to a Division Focal.</p></div>'+ta('note','Instructions (optional)','',2)+'</div><button class="btn primary" data-act="doAssign" data-id="'+d.id+'">'+ic('send')+'Assign and start the clock</button>';}
 else if(canAct('submit')){
  const comp=d.status==='compliance',target=resubmitTarget(d),oc=openComments(d);
  main='<h3>'+(comp?'Comply with the comments':'Submit for review')+'</h3>'+(comp?oc.map(c=>'<div class="cmt"><div class="small muted">'+esc(RV_LABEL[c.level])+', '+esc(uname(c.by))+', '+fmtDT(c.at)+'</div>'+nl(c.text)+'</div>').join(''):'<p class="muted">When you are done, send it to a Supervisor or Focal / Supervisor.</p>')+
  ta('text',comp?'How you complied (required)':'Processing notes (optional)','',3)+(target==='sup_review'?'<div class="fld"><label>Reviewer</label><select name="reviewer">'+reviewerOptions(d,u)+'</select></div>':'<p class="hint">After compliance, this goes back to '+TARGET_LABEL[target]+'.</p>')+
  '<button class="btn primary" data-act="doSubmit" data-id="'+d.id+'">'+ic('send')+(comp?'Submit compliance':'Submit for review')+'</button>';}
 else if(canAct('sup_approve')||canAct('div_approve')||canAct('dept_clear')){
  const st=d.status,lvl=st==='sup_review'?'sup':st==='div_review'?'div':'dept';
  const ap=lvl==='dept'?deptApprovers(d):null;
  main='<h3>'+(lvl==='dept'?'Final review and clearance':lvl==='div'?'Division Manager review':'Supervisor review')+'</h3>'+(ap&&ap.tier!=='Department Manager'?'<div class="banner warn">'+ic('alert')+'<div>The Department Manager is away. You are acting as '+esc(ap.tier)+'.</div></div>':'')+
  ta('text','Comments','Required when you return it. Leave empty if there are none.',3)+'<div class="row"><button class="btn primary" data-act="doReview" data-id="'+d.id+'" data-type="'+(lvl==='dept'?'dept_clear':lvl+'_approve')+'">'+ic('check')+(lvl==='dept'?'No comments: clear for out':lvl==='sup'?'No comments: send to Division Manager':'No comments: send to Department Manager')+'</button><button class="btn" data-act="doReview" data-id="'+d.id+'" data-type="'+lvl+'_return">Return to staff for compliance</button></div>';}
 else if(canAct('logout')){
  const ret=d.status==='return_out';
  main='<h3>Log this document out</h3><p class="muted">'+(ret?'Instructed to return by '+esc(uname(d.returnInstructedBy))+' ('+esc(d.returnTier)+'). It will be logged with the remark “For return”.':'Cleared for out by '+esc(uname(d.clearedBy))+' ('+esc(d.clearedTier)+').')+'</p><div class="g2"><div class="fld"><label>Released to</label><input name="outTo" value="'+esc(d.source)+'"></div><div class="fld"><label>Date and time out</label><input type="datetime-local" name="outAt" value="'+localInput(new Date())+'"></div></div>'+ta('remarks',ret?'Additional remarks (“For return” is added automatically)':'Remarks (optional)','',2)+'<button class="btn primary" data-act="doLogout" data-id="'+d.id+'">'+ic('check')+'Log out document</button>';}
 if(!(opts&&opts.special)&&canAct('instruct_return'))misc+='<div data-panel><details class="more"><summary>Instruct return to sender</summary><p class="hint">The Admin desk will log the document out with the remark “For return”.</p>'+ta('reason','Reason','',2)+'<button class="btn danger sm" data-act="doInstructReturn" data-id="'+d.id+'">Instruct return</button></details></div>';
 if(!(opts&&opts.special)&&canAct('reassign'))misc+='<div data-panel><details class="more"><summary>Reassign to another staff member</summary><div class="fld"><select name="assignee">'+staffOptions('')+'</select></div>'+ta('note','Reason (optional)','',2)+'<button class="btn sm" data-act="doReassign" data-id="'+d.id+'">Reassign</button></details></div>';
 if(!(opts&&opts.special)&&canAct('edit'))misc+='<div data-panel><details class="more"><summary>Edit details</summary><button class="btn sm" data-act="editDoc" data-id="'+d.id+'">Open the details form</button></details></div>';
 if(!(opts&&opts.special)&&canAct('delete'))misc+='<div data-panel><details class="more"><summary>Delete this document</summary><p class="hint">This removes the document and its history for good.</p><button class="btn danger sm" data-act="deleteDoc" data-id="'+d.id+'">Delete document</button></details></div>';
 if(!main&&!misc){
  if(d.status==='out')return '';
  const di=deskInfo(d);return '<div class="panel wait"><b>Waiting on '+esc(di.label)+'</b><div class="muted">'+esc(di.who.filter(Boolean).join(', '))+'. Here for '+esc(elapsed(d.stageEnteredAt))+'.</div></div>';}
 return '<div class="panel">'+(main?'<div data-panel>'+main+'</div>':'')+misc+'</div>';
}
function kindOf(h){const a=h.action;return /^Returned/.test(a)?'k-pur':/Cleared|cleared/.test(a)&&!/Instructed/.test(a)?'k-ok':/Instructed|for return/.test(a)?'k-warn':/^Note|^Details/.test(a)?'k-neu':'';}
function timeline(d){
 const H=d.history,isNote=h=>/^Note added|^Details edited/.test(h.action);
 return '<ol class="tl">'+H.map((h,i)=>{
  let dur='';if(!isNote(h)){let j=i+1;while(j<H.length&&isNote(H[j]))j++;if(j<H.length)dur='Time at this desk: '+elapsed(h.at,new Date(H[j].at));else if(d.status!=='out'&&d.status===h.to)dur='At this desk now: '+elapsed(h.at);}
  const by=uById(h.by);
  return '<li class="'+kindOf(h)+'"><div class="when">'+fmtDT(h.at)+'</div><div class="act">'+esc(h.action)+'</div><div class="small">By '+esc(by?by.name:'—')+(by?' ('+esc(roleName(by.role))+')':'')+(h.desk&&!isNote(h)?'. Now with '+esc(h.desk):'')+'</div>'+(h.remarks?'<div class="rem">'+nl(h.remarks)+'</div>':'')+(dur?'<div class="small muted">'+esc(dur)+'</div>':'')+'</li>';}).join('')+'</ol>';
}
/* The deadline panel. For documents whose deadline runs from a reporting period it also shows the
   reporting period, the deadline month, the calculated deadline, the days remaining and the status. */
function deadlinePanel(d){
 const x=dl(d),t=docTypeOf(d.docType);
 const thr=d.threshold!=null?d.threshold:docTypeThreshold(t);
 const unitTxt=d.deadlineUnit==='calendar_days'?'Calendar days':'Working days';
 const total=(thr&&docTypeBasis(t)!=='reporting_period')?thr:(d.dueAt?Math.max(1,wdBetween(d.clockStart||d.receivedAt,parseD(d.dueAt))):0);
 const el=Math.max(0,wdBetween(d.clockStart||d.receivedAt,d.stopAt?new Date(d.stopAt):new Date()));
 const pct=total?Math.min(100,el/total*100):0;
 const rows=[['Document type',d.docType],['Prescribed threshold',thr?(plural(thr,d.deadlineUnit==='calendar_days'?'calendar day':'working day')):'None set'],['Deadline basis',basisText(docTypeBasis(t))]];
 if(d.reportingPeriod)rows.push(['Reporting period',(d.reportingPeriod)+(d.reportingYear?' '+d.reportingYear:'')]);
 if(d.deadlineMonth)rows.push(['Deadline month',d.deadlineMonth]);
 rows.push(['Clock started',d.clockStart?fmtDT(d.clockStart):'Not started']);
 rows.push(['Calculated deadline',d.dueAt?fmtWD(parseD(d.dueAt)):'Not applicable']);
 if(d.dueAt&&!d.stopAt){const rem=wdBetween(new Date(),parseD(d.dueAt));rows.push(['Working days remaining',String(rem)]);rows.push(['Calendar days remaining',String(Math.round((sod(parseD(d.dueAt))-sod(new Date()))/864e5))]);}
 if(d.stopAt)rows.push(['Clock stopped',fmtDT(d.stopAt)]);
 return '<div class="card pad"><h3 style="margin-bottom:8px">Deadline</h3><dl class="dl">'+rows.map(r=>'<dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd>').join('')+'</dl>'+
  '<div style="margin-top:10px">'+dlBadge(d)+'</div>'+
  (total?'<div class="meter '+(x.key==='over'||x.key==='done_late'?'over':x.key==='soon'?'soon':'')+'" role="img" aria-label="'+el+' of '+total+' working days used"><i style="width:'+pct+'%"></i></div><div class="small muted">'+el+' of '+total+' working days used</div>':'')+
  '<p class="hint" style="margin-top:8px">Calculated from the document type configuration'+(d.reportingPeriod?' and the reporting period':'')+'. It is not typed in by hand'+(d.deadlineSource==='transaction type'?' — this one follows the type of transaction':'')+'.</p></div>';
}
VIEWS.doc=(u,id)=>{
 const d=S.docs.find(x=>x.id===id);
 if(!d||!canView(u,d))return '<div class="wrap"><div class="card empty"><b>Document not found</b>It may have been deleted, or you may not have access. <a href="#/documents" data-act="nav" data-r="documents">Back to documents</a></div></div>';
 const x=dl(d),tx=getTx(d.txType),di=deskInfo(d);
 const dlc=deadlinePanel(d);
 // route progress
 const fm=divFocal(d.division);
 const people=[['Logged by',uname(d.createdBy)],['Division focal',fm?fm.name:'Not set'],['Assigned to',d.assignee?uname(d.assignee):'—'],['Assigned by',d.assignedBy?uname(d.assignedBy):(d.autoRouted?'Automatic (report designation)':'—')],['Reviewer',d.reviewer?uname(d.reviewer):'—'],['Division Manager',divManagers(d).map(m=>m.name).join(', ')||'—'],['Cleared by',d.clearedBy?uname(d.clearedBy)+' ('+d.clearedTier+')':'—'],['Logged out by',d.outBy?uname(d.outBy):'—']];
 const det=[['Date received',fmtDT(d.receivedAt)],['Communication type',d.commType],['Received from',d.source],['Reference no.',d.refNo||'—'],['Document type',d.docType],['Division',d.division]];
 if(d.reportingPeriod)det.push(['Reporting period',d.reportingPeriod+(d.reportingYear?' '+d.reportingYear:'')]);
 det.push(['Region / office',d.region||'—'],['Pages / attachments',d.pages||'—'],['Priority',d.priority],['Remarks at logging',d.remarks||'—']);
 if(d.outAt)det.push(['Logged out',fmtDT(d.outAt)+' to '+d.outTo],['Out type',d.outType+(d.outRemarks&&d.outRemarks!==d.outType?'. '+d.outRemarks:'')]);
 const urlsEditable=u.id===d.assignee||REVIEW_LINE[d.assignee]===u.id||has(u,'doc.override')||u.role==='dept_manager'||u.role==='sysadmin'||(u.role==='div_manager'&&divManagers(d).some(m=>m.id===u.id));
const regUrls=DocumentFileLinks(d,urlsEditable);
const overrideClear=(has(u,'doc.override')&&['sup_review','div_review','dept_review'].includes(d.status))?'<div class="banner warn">'+ic('alert')+'<div><b>Override available.</b> As '+(u.role==='sysadmin'?'System Administrator':u.role==='dept_manager'?'Department Manager':'Division Manager')+', you can clear this document without completing the current review stage.<br><button class="btn sm danger" data-act="overrideClear" data-id="'+d.id+'" style="margin-top:8px">Clear for out (override)</button></div></div>':'';
const cm=d.comments.length?'<div class="card pad"><h3 style="margin-bottom:10px">Reviewer comments and instructions</h3>'+d.comments.map(c=>'<div class="cmt'+(c.resolved?' done':'')+'"><div class="row sp"><b>'+esc(RV_LABEL[c.level])+'</b>'+(c.level==='instruction'?badge('warn','For return'):c.resolved?badge('ok','Complied'):badge('pur','Open'))+'</div><div class="small muted">'+esc(uname(c.by))+', '+fmtDT(c.at)+'</div><div>'+nl(c.text)+'</div>'+(c.response?'<div class="small" style="margin-top:6px"><b>Compliance:</b> '+nl(c.response)+' <span class="muted">('+fmtDT(c.resolvedAt)+')</span></div>':'')+'</div>').join('')+'</div>':'';
 const noteBox=can(u,d,'comment')?'<div data-panel class="row" style="align-items:flex-start;margin-bottom:16px"><textarea name="text" rows="2" placeholder="Add a note to the routing history" style="flex:1;min-width:200px"></textarea><button class="btn" data-act="doNote" data-id="'+d.id+'">Add note</button></div>':'';
 return '<div class="wrap"><p><a href="#/documents" data-act="nav" data-r="documents">'+ic('back').replace('<svg','<svg width="14" height="14" style="vertical-align:-2px"')+' Back to dashboard</a></p>'+
 '<div class="pagehead"><div><div class="row"><span class="mono trk">'+esc(d.trackNo)+'</span>'+stageBadge(d)+(d.priority==='Urgent'?badge('bad','Urgent'):'')+(d.autoRouted?badge('neu','Regular report'):'')+(stalled(d)?badge('warn','Stalled at desk'):'')+'</div><h1 style="margin-top:6px;max-width:900px">'+esc(d.subject)+'</h1></div>'+
 (has(u,'report.print')?'<div class="row"><button class="btn" data-act="printSlip" data-id="'+d.id+'">'+ic('print')+'Print routing slip</button></div>':'')+'</div>'+
 overrideClear+lcCard(d)+'<div class="dgrid" style="margin-top:16px"><div class="stack">'+actionPanel(d,u)+regUrls+'<div class="card pad"><h3 style="margin-bottom:10px">Details</h3><dl class="dl">'+det.map(r=>'<dt>'+esc(r[0])+'</dt><dd>'+(r[1]==='__URL__'?renderUrl(d.url):esc(r[1]))+'</dd>').join('')+'</dl></div>'+cm+
 '<div class="card pad"><h3 style="margin-bottom:12px">Desk movement</h3>'+noteBox+timeline(d)+'</div></div>'+
 '<div class="stack"><div class="card pad"><h3 style="margin-bottom:8px">Deadline</h3>'+dlc+'</div><div class="card pad"><h3 style="margin-bottom:4px">Current desk</h3><div class="b">'+esc(di.label)+'</div><div class="muted">'+esc(di.who.filter(Boolean).join(', '))+'</div>'+(d.status!=='out'?'<div class="small muted" style="margin-top:4px">Here for '+esc(elapsed(d.stageEnteredAt))+'</div>':'')+(d.cycles?'<div class="small muted">Returned for compliance '+plural(d.cycles,'time')+'</div>':'')+'</div>'+
 '<div class="card pad"><h3 style="margin-bottom:10px">People on this document</h3><dl class="dl" style="grid-template-columns:120px 1fr">'+people.map(r=>'<dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd>').join('')+'</dl></div></div></div></div>';
};
const pv=t=>formVals(t.closest('[data-panel]'));
async function runAct(type,id,payload){
 const r=await api('POST','/api/docs/'+id+'/act',{type:type,payload:payload});
 if(!r.ok){toast(r.error||'That did not work.','bad');return false;}
 toast(r.msg||'Done.');await refresh();if(r.deleted)go('documents');return true;
}
ACTIONS.doForward=(t)=>runAct('forward',t.dataset.id,{remarks:pv(t).remarks});
ACTIONS.doAssign=(t)=>{const v=pv(t);runAct('assign',t.dataset.id,{txType:v.txType,docType:v.docType,assignee:v.assignee,dueDate:v.dueDate,note:v.note});};ACTIONS.doReassign=(t)=>{const v=pv(t);runAct('reassign',t.dataset.id,{assignee:v.assignee,note:v.note});};
ACTIONS.doSubmit=(t)=>{const v=pv(t);runAct('submit',t.dataset.id,{reviewer:v.reviewer,text:v.text});};
ACTIONS.doReview=(t)=>runAct(t.dataset.type,t.dataset.id,{text:pv(t).text});
ACTIONS.doInstructReturn=(t)=>confirmBox('Instruct return to sender','The document will stop here and go to the Admin desk to be logged out with the remark “For return”.','Instruct return',()=>runAct('instruct_return',t.dataset.id,{reason:pv(t).reason}),true);
ACTIONS.doLogout=(t)=>{const v=pv(t);runAct('logout',t.dataset.id,{outTo:v.outTo,outAt:v.outAt?new Date(v.outAt).toISOString():'',remarks:v.remarks});};
ACTIONS.doNote=(t)=>runAct('comment',t.dataset.id,{text:pv(t).text});
ACTIONS.saveUrls=async(t)=>{
 const f=$('[data-form=urls]'),v=formVals(f);
 const payload={};
 if('draftUrl' in v)payload.draftUrl=v.draftUrl;
 if('revUrl' in v)payload.revUrl=v.revUrl;
 if('url' in v)payload.url=v.url;
 await runAct('set_urls',t.dataset.id,payload);
};
ACTIONS.overrideClear=(t)=>confirmBox('Override: clear for out','This clears the document immediately, bypassing the current review stage. It will be marked with your tier.','Clear for out (override)',()=>runAct('dept_clear',t.dataset.id,{text:'Cleared via override by '+tierOf(ME())}),true);

ACTIONS.deleteDoc=(t)=>confirmBox('Delete document','This permanently removes the document and its history.','Delete',()=>runAct('delete',t.dataset.id,{}),true);
ACTIONS.editDoc=(t)=>{const d=S.docs.find(x=>x.id===t.dataset.id);const v=d?Object.assign({},d,{reportingPeriod:d.reportingPeriod||''}):d;openDocForm(v);};
CHANGES.txType=(t)=>{const p=t.closest('[data-panel]'),tx=getTx(t.value);$('#specialWrap',p).hidden=!(tx&&tx.special);
 /* the preview always comes from the centralized engine, so it can never drift from the real deadline */
 const f=$('[data-form=doc]'),fv=f?formVals(f):{};
 const docType=(p.querySelector('[name=docType]')||{}).value||'';
 const x=docType?computeDeadline({docType:docType,txType:t.value,at:new Date(),special:'',reportingPeriod:fv.reportingPeriod||''}):null;
 $('#duePrev',p).textContent=!tx?'':tx.special?'Choose the deadline date below.':x&&x.dueAt?'Due '+fmtWD(parseD(x.dueAt))+' ('+x.label+').':x&&!x.ok?x.error:'No deadline will apply.';
 const sel=$('#assigneeSel',p),hint=$('#forInfoHint',p);
 if(sel){const forInfo=tx&&tx.name==='For information only';if(hint)hint.hidden=!forInfo;const cur=sel.value;sel.innerHTML=forInfo?focalOptions(cur):staffOptions(cur);}
};

/* =====================  LOG / EDIT FORM  ===================== */
function regionOptions(sel,d){const names=S.designations.map(x=>x.name);if(d&&d.region&&!names.includes(d.region))names.push(d.region);return names.map(n=>opt(n,n,sel===n)).join('');}
/* Reporting period: a dropdown of the twelve months that also accepts typing “Sep”, “sept” or
   “SEPTEMBER”, and always normalises what is entered to the full month name. */
function reportingPeriodControl(d){
 return '<div class="fld" id="dfPeriod" hidden><label for="dfPeriodInput">Reporting period (the month covered by the report)</label>'+
  '<input id="dfPeriodInput" name="reportingPeriod" list="monthList" data-inp="dfPeriod" autocomplete="off" spellcheck="false" placeholder="Type a month, e.g. Sep" value="'+esc((d&&d.reportingPeriod)||'')+'">'+
  '<p class="hint" id="dfPeriodHint"></p></div>';
}
ACTIONS.newDoc=(t)=>openDocForm(null,t&&t.dataset&&t.dataset.region);
function openDocForm(d,region,forceReg){
 const src=[...new Set(S.docs.map(x=>x.source))].sort();
 const regDefault=(region||forceReg)?S.refs.doc.find(x=>x.active!==false&&isRegularDoc(x.name)):null;
 const v=d||{receivedAt:new Date().toISOString(),commType:'',source:'',refNo:'',subject:'',docType:regDefault?regDefault.name:'',division:'',pages:'',priority:'Normal',remarks:'',region:region||'',reportingPeriod:'',url:''};
 const edit=!!d;
 const body='<div data-form="doc" data-id="'+(d?d.id:'')+'"><datalist id="srcList">'+src.map(s=>'<option value="'+esc(s)+'">').join('')+'</datalist><datalist id="monthList">'+MONTHS.map(m=>'<option value="'+esc(m)+'">').join('')+'</datalist>'+
 '<div class="g2"><div class="fld"><label>Date and time received</label><input type="datetime-local" name="receivedAt" value="'+localInput(v.receivedAt)+'"></div><div class="fld"><label>Communication type</label><select name="commType"><option value="">Select</option>'+activeCommTypes(v.commType).map(c=>opt(commName(c),commName(c),commName(c)===v.commType)).join('')+'</select></div></div>'+
 '<div class="g2"><div class="fld"><label>Received from</label><input name="source" list="srcList" value="'+esc(v.source)+'" placeholder="Office, agency or person"></div><div class="fld"><label>Reference no. (optional)</label><input name="refNo" value="'+esc(v.refNo)+'"></div></div>'+
 '<div class="fld"><label>Subject or particulars</label><textarea name="subject" rows="2">'+esc(v.subject)+'</textarea></div>'+
 '<div class="g2"><div class="fld"><label>Document type</label><select name="docType" data-chg="dfType"><option value="">Select</option>'+activeDocTypes(v.docType).map(c=>opt(c.name,c.name+(c.active===false?' (inactive)':''),c.name===v.docType)).join('')+'</select></div><div class="fld" id="dfDiv"><label>Division to forward to</label><select name="division" data-chg="dfType"><option value="">Select</option>'+S.divisions.map(c=>opt(c.code,c.code,c.code===v.division)).join('')+'</select></div>'+reportingPeriodControl(v)+'</div>'+
 (edit?'<div class="fld"><label>Region or office (report designation)</label><select name="region"><option value="">Select</option>'+regionOptions(v.region,d)+'</select></div>':'<div class="fld" id="dfRegion" hidden><label>Region or office (report designation)</label><select name="region" data-chg="dfType"><option value="">Select</option>'+regionOptions(v.region,null)+'</select></div>')+
  '<div class="g2"><div class="fld"><label>Document URL (optional)</label><input name="url" type="url" placeholder="https://" value="'+esc(v.url||'')+'"></div><div class="fld"><label>Remarks (optional)</label><input name="remarks" value="'+esc(v.remarks)+'"></div></div>'+
'<div class="g3"><div class="fld"><label>Pages / attachments</label><input name="pages" value="'+esc(v.pages)+'"></div><div class="fld"><label>Priority</label><select name="priority">'+['Normal','Urgent'].map(p=>opt(p,p,p===v.priority)).join('')+'</select></div></div>'+
 (edit?'':'<div class="banner" id="dfRoute">'+ic('info')+'<div></div></div>')+'</div>';
 openModal(edit?'Edit '+d.trackNo:'Log a new document',body,{wide:1,foot:'<button class="btn" data-act="closeModal">Cancel</button>'+(edit?'<button class="btn primary" data-act="saveDoc" data-mode="edit">Save changes</button>':'<button class="btn" id="btnSave" data-act="saveDoc" data-mode="hold">Save without forwarding</button><button class="btn primary" id="btnFwd" data-act="saveDoc" data-mode="fwd">Log and forward</button>')});
 CHANGES.dfType();
}
/* For a document type whose deadline runs from a reporting period (Consolidated CMR and PPR) the
   division is not asked for: the report is routed to the staff designated for its region, and the
   field is replaced by the Reporting Period — the month the report covers. The division stays on
   the record for reporting, filled in the background, so nothing else has to change. */
function syncPeriodField(){
 const f=$('[data-form=doc]');if(!f)return;
 const v=formVals(f),reg=isRegularDoc(v.docType),dv=$('#dfDiv'),pd=$('#dfPeriod'),rg=$('#dfRegion');
 if(rg)rg.hidden=!reg;
 if(dv)dv.hidden=reg;
 if(pd)pd.hidden=!reg;
 if(reg&&dv&&!v.division){const me=ME(),own=me&&S.divisions.some(x=>x.code===me.division)?me.division:'',sel=$('select',dv);if(sel)sel.value=own||(S.divisions[0]?S.divisions[0].code:'');}
 periodHint();
}
/* Live feedback under the Reporting Period box: accepts “Sep”, “sept”, “SEPTEMBER” or “9” and shows
   the month it will be saved as, together with the deadline that follows from it. */
function periodHint(){
 const f=$('[data-form=doc]'),el=$('#dfPeriodHint');if(!f||!el)return;
 const v=formVals(f),t=docTypeOf(v.docType),thr=docTypeThreshold(t);
 if(!(thr>0)){el.textContent='This document type has no prescribed deadline.';return;}
 if(docTypeBasis(t)!=='reporting_period'){el.textContent='The prescribed deadline is counted from the day this report is logged.';return;}
 const typed=String(v.reportingPeriod||'').trim();
 if(!typed){el.textContent='Type or choose the month this report covers.';return;}
 const m=normMonth(typed);
 if(!m){el.textContent='“'+typed+'” is not one of the twelve months. Type it again, for example Sep.';return;}
 const x=computeDeadline({docType:v.docType,at:new Date(),reportingPeriod:m});
 el.textContent=m+(x&&x.ok&&x.dueAt?' — deadline '+fmtWD(parseD(x.dueAt))+' ('+x.label+').':' — the month this report covers.');
}
INPUTS.dfPeriod=()=>periodHint();
CHANGES.dfType=()=>{
 const f=$('[data-form=doc]');if(!f)return;
 syncPeriodField();
 if(f.dataset.id)return; /* editing: the region and the onward route are already settled */
 const v=formVals(f),reg=isRegularDoc(v.docType),rt=$('#dfRoute div'),hold=$('#btnSave'),fwd=$('#btnFwd');
 if(hold)hold.hidden=reg;
 if(fwd)fwd.textContent=reg?'Log and route to staff':'Log and forward';
 if(!rt)return;
 if(reg){const des=S.designations.find(x=>x.name===v.region),x=computeDeadline({docType:v.docType,at:new Date(),reportingPeriod:v.reportingPeriod});
  rt.textContent=(des?'Report: goes straight to '+uname(des.staff)+' for '+v.region+'.':'Report: choose the region or office. It goes straight to the staff designated for it.')+(x&&x.ok&&x.dueAt?' Deadline: '+fmtWD(parseD(x.dueAt))+' ('+x.label+').':'');}
 else{const fc=v.division?divFocal(v.division):null;rt.textContent=!v.division?'Choose a division. The document is forwarded to that division’s Focal / Supervisor.':fc?'Will be forwarded to '+fc.name+', Focal / Supervisor of '+v.division+'.':'No Focal / Supervisor is set for '+v.division+'. You can save it now and forward it once one is set.';}
};
ACTIONS.saveDoc=async(t)=>{
 const f=$('[data-form=doc]'),v=formVals(f),mode=t.dataset.mode;
 const rec=v.receivedAt?new Date(v.receivedAt):null,iso=rec&&!isNaN(rec)?rec.toISOString():'';
 const month=normMonth(v.reportingPeriod);
 if(v.reportingPeriod&&!month)return toast('Choose the reporting period from the twelve months of the year.','bad');
 if(month){v.reportingPeriod=month;$('#dfPeriodInput').value=month;}
 else v.reportingPeriod='';
 /* a reporting-period report is routed by region, so no division is asked for on screen; the field
    still has to carry a division for the register, so it is filled from the reporting type */
 if(isRegularDoc(v.docType)&&!S.divisions.some(x=>x.code===v.division))v.division=(ME()&&S.divisions.some(x=>x.code===ME().division))?ME().division:(S.divisions[0]?S.divisions[0].code:'');
 if(v.reportingPeriod&&isRegularDoc(v.docType)&&!v.division)return toast('No division is available for this report. Ask the System Administrator to check Divisions & focals.','bad');
 t.disabled=true;
 if(mode==='edit'){
  const r=await api('POST','/api/docs/'+f.dataset.id+'/act',{type:'edit',payload:Object.assign({},v,{receivedAt:iso})});
  t.disabled=false;if(!r.ok)return toast(r.error,'bad');closeModal();toast(r.msg);await refresh();return;
 }
 const r=await api('POST','/api/docs',Object.assign({},v,{receivedAt:iso,forward:mode==='fwd',url:v.url||''}));
 t.disabled=false;if(!r.ok)return toast(r.error,'bad');closeModal();toast(r.msg);await refresh();go('doc',r.id);
};

/* =====================  PRINT: ROUTING SLIP  ===================== */
function slipHTML(d){
 const tx=getTx(d.txType),kv=(k,v,full)=>'<div'+(full?' style="grid-column:1/-1"':'')+'><small>'+esc(k)+'</small>'+esc(v)+'</div>';
 const H=d.history;
 const rows=H.map((h,i)=>{const by=uById(h.by);const note=/^Note added|^Details edited/.test(h.action);let dur='';if(!note){let j=i+1;while(j<H.length&&/^Note added|^Details edited/.test(H[j].action))j++;dur=j<H.length?elapsed(h.at,new Date(H[j].at)):(d.status!=='out'?elapsed(h.at)+' (now)':'');}
  return '<tr><td>'+(i+1)+'</td><td>'+fmtDT(h.at)+'</td><td>'+esc(h.action)+'</td><td>'+esc(by?by.name:'')+'</td><td>'+esc(h.desk)+'</td><td>'+nl(h.remarks)+'</td><td>'+esc(dur)+'</td></tr>';}).join('');
 const cm=d.comments.map(c=>'<tr><td>'+esc(RV_LABEL[c.level])+'</td><td>'+esc(uname(c.by))+'<br>'+fmtDT(c.at)+'</td><td>'+nl(c.text)+'</td><td>'+(c.level==='instruction'?'—':c.resolved?'Complied '+fmtD(c.resolvedAt)+(c.response?': '+esc(c.response):''):'Open')+'</td></tr>').join('');
 return sheetHead('Document routing slip','')+
 '<div class="row sp" style="margin-bottom:8px"><div class="trkbig">'+esc(d.trackNo)+'</div><div><b>Status:</b> '+esc(STAGES[d.status].label)+(d.priority==='Urgent'?' &nbsp; <b>URGENT</b>':'')+'</div></div>'+
 '<div class="kv">'+kv('Subject or particulars',d.subject,1)+kv('Date and time received',fmtDT(d.receivedAt))+kv('Communication type',d.commType)+kv('Received from',d.source)+kv('Reference no.',d.refNo||'—')+kv('Document type',d.docType)+kv('Division',d.division+(d.region?' / '+d.region:''))+kv('Pages / attachments',d.pages||'—')+
 kv('Type of transaction',d.txType||'Not yet classified')+kv('Threshold',tx&&tx.days?plural(tx.days,'working day'):d.dueAt?'Special deadline':'None')+kv('Clock started',d.clockStart?fmtDT(d.clockStart):'Not started')+kv('Due date',d.dueAt?fmtWD(parseD(d.dueAt)):'—')+kv('Assigned to',d.assignee?uname(d.assignee):'—')+kv('Current desk',deskText(d))+
 (d.outAt?kv('Logged out',fmtDT(d.outAt)+' to '+d.outTo)+kv('Out type',d.outType+(d.outRemarks&&d.outRemarks!==d.outType?' – '+d.outRemarks:'')):'')+'</div>'+
 '<h2>Desk movement</h2><table><thead><tr><th>#</th><th>Date and time</th><th>Action</th><th>By</th><th>Now with</th><th>Remarks</th><th>Time at desk</th></tr></thead><tbody>'+rows+'</tbody></table>'+
 (cm?'<h2>Reviewer comments and compliance</h2><table><thead><tr><th>Level</th><th>By</th><th>Comment</th><th>Compliance</th></tr></thead><tbody>'+cm+'</tbody></table>':'')+
 '<div class="sig"><div>Received by (Admin staff)<br><b>'+esc(uname(d.createdBy))+'</b></div><div>Reviewed by<br><b>'+esc(d.reviewer?uname(d.reviewer):' ')+'</b></div><div>Cleared by<br><b>'+esc(d.clearedBy?uname(d.clearedBy):' ')+'</b></div><div>Logged out by<br><b>'+esc(d.outBy?uname(d.outBy):' ')+'</b></div></div>'+
 '<div class="foot"><span>'+esc(d.trackNo)+'</span><span>Routing slip generated from the Document Tracking &amp; Routing System</span></div>';
}
ACTIONS.printSlip=(t)=>{const d=t.dataset.id.startsWith('sr-')?specialDocRows().find(x=>x.id===t.dataset.id):S.docs.find(x=>x.id===t.dataset.id);if(d)openPP(slipHTML(d));};

/* =====================  REGULAR REPORTS  ===================== */
const isOver=d=>isClockActive(d)&&dl(d).key==='over';
UI.regTab=UI.regTab||'consolidated';
VIEWS.regular=(u)=>{
 const tabs='<div class="tabs" role="tablist"><button class="tab" role="tab" data-act="regularTab" data-k="consolidated" aria-selected="'+(UI.regTab==='consolidated')+'">Consolidated CMR and PPR</button><button class="tab" role="tab" data-act="regularTab" data-k="special" aria-selected="'+(UI.regTab==='special')+'">Special Report</button></div>';
 if(UI.regTab==='special'){
  const items=spItems().slice().sort((a,b)=>String(b.genDate).localeCompare(String(a.genDate)));
  return '<div class="wrap"><div class="pagehead"><div><h1>Regular reports</h1><p>System generated Special Reports in the document tracking workflow.</p></div></div>'+tabs+'<div class="tw"><table class="tbl"><thead><tr><th>Special Report Name</th><th>Reporting Period</th><th>Assigned To</th><th>Generation Date</th><th>Deadline</th><th>Status</th><th>Action</th></tr></thead><tbody>'+spGenRows(items)+'</tbody></table></div></div>';
 }
 const scope=regionScope(u);
 const desigs=scope?S.designations.filter(des=>scope.has(des.staff)):S.designations;
 const rows=desigs.map(des=>{
  const ds=visibleDocs(u).filter(d=>isRegularDoc(d.docType)&&d.region===des.name),op=ds.filter(isOpen),ov=op.filter(isOver),rev=REVIEW_LINE[des.staff];
  return{des,op,ov,rel:ds.filter(d=>!isOpen(d)).length,rev};
 });
 const totOpen=rows.reduce((a,r)=>a+r.op.length,0),totOver=rows.reduce((a,r)=>a+r.ov.length,0);
 const trs=rows.map(r=>'<tr class="click'+(r.ov.length?' r-over':(r.op.length?'':''))+'" data-act="regRow" data-v="'+esc(r.des.name)+'"><td class="b">'+esc(r.des.name)+'</td><td>'+esc(uname(r.des.staff))+'</td><td class="muted">'+esc(r.rev?uname(r.rev):'—')+'</td><td>'+r.op.length+'</td><td>'+(r.ov.length?badge('bad',String(r.ov.length)):'0')+'</td><td>'+r.rel+'</td></tr>').join('');
 const rd=activeDocTypes().find(x=>docTypeBasis(x)==='reporting_period'&&docTypeThreshold(x)>0);
 const ruleTxt=rd?(rd.name+' go straight to the staff designated for each region or office, with a prescribed threshold of '+docTypeTerm(rd)+'.'):'Reporting-period documents go straight to the staff designated for each region or office.';
 return '<div class="wrap"><div class="pagehead"><div><h1>Regular reports</h1><p>'+esc(ruleTxt)+' '+plural(totOpen,'report')+' open'+(totOver?', '+totOver+' overdue':'')+'.'+(scope?' Showing the regions assigned to you or your team.':'')+'</p></div></div>'+tabs+
 (rows.length?'<div class="tw"><table class="tbl"><thead><tr><th>Region / office</th><th>Designated staff</th><th>Reviewer</th><th>Open</th><th>Overdue</th><th>Released</th></tr></thead><tbody>'+trs+'</tbody></table></div>':'<div class="card empty"><b>No regions are assigned to you.</b>Ask the System Administrator if this looks wrong.</div>')+'</div>';
};
ACTIONS.regRow=(t)=>{UI.filters={tile:'total',region:t.dataset.v};UI.page=1;UI.sel.clear();go('dashboard');};
 ACTIONS.regularTab=(t)=>{UI.regTab=t.dataset.k;render();};
ACTIONS.regNew=()=>openDocForm(null,'',true);

/* =====================  REPORTS  ===================== */
const REPORTS=[['register','Document register'],['overdue','Overdue and due soon'],['workload','Staff workload'],['regular','Regular reports by region'],['turnaround','Turnaround and on-time rate']];
const avgTat=ds=>{const a=ds.filter(d=>d.clockStart&&d.stopAt).map(d=>wdBetween(d.clockStart,d.stopAt));return a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1):'—';};
const ontimePct=ds=>{const c=ds.filter(d=>d.stopAt&&d.dueAt);if(!c.length)return '—';return Math.round(c.filter(d=>dl(d).key==='done_ok').length/c.length*100)+'%';};
function buildReport(u){
 const rf=UI.rf;let docs=visibleDocs(u);
 if(rf.division)docs=docs.filter(d=>d.division===rf.division);
 if(rf.from)docs=docs.filter(d=>isoD(d.receivedAt)>=rf.from);
 if(rf.to)docs=docs.filter(d=>isoD(d.receivedAt)<=rf.to);
 const sub=(rf.division?rf.division+'. ':'All divisions. ')+(rf.from||rf.to?'Received '+(rf.from?'from '+fmtD(parseD(rf.from)):'')+(rf.to?' to '+fmtD(parseD(rf.to)):'')+'.':'All dates.');
 switch(UI.report){
  case 'overdue':{const l=docs.filter(d=>isClockActive(d)&&['over','soon'].includes(dl(d).key)).sort((a,b)=>(a.dueAt||'').localeCompare(b.dueAt||''));
   return{title:'Overdue and due-soon documents',sub,cols:['Tracking no.','Subject','Division','Assigned to','Current desk','Due','Status'],rows:l.map(d=>[d.trackNo,d.subject,d.division,uname(d.assignee),deskText(d),fmtD(parseD(d.dueAt)),dl(d).label])};}
  case 'workload':{const us=S.users.filter(x=>x.active&&['staff','supervisor','focal'].includes(x.role));
   return{title:'Staff workload',sub,cols:['Name','Role','Open','Overdue','Due soon','Finished','Avg. turnaround (working days)','On-time rate'],rows:us.map(x=>{const ds=docs.filter(d=>d.assignee===x.id),op=ds.filter(isOpen);return[x.name,roleName(x.role),op.length,op.filter(isOver).length,op.filter(d=>isClockActive(d)&&dl(d).key==='soon').length,ds.filter(d=>d.stopAt).length,avgTat(ds),ontimePct(ds)];})};}
  case 'regular':{const rd=docs.filter(d=>isRegularDoc(d.docType));
   return{title:'Regular reports (Consolidated CMR and PPR) by region',sub,cols:['Region or office','Designated staff','Received','Open','Overdue','Released','Avg. turnaround (working days)','On-time rate'],rows:S.designations.map(x=>{const ds=rd.filter(d=>d.region===x.name);return[x.name,uname(x.staff),ds.length,ds.filter(isOpen).length,ds.filter(isOver).length,ds.filter(d=>!isOpen(d)).length,avgTat(ds),ontimePct(ds)];})};}
  case 'turnaround':{const rows=[];S.refs.tx.forEach(t=>{const ds=docs.filter(d=>d.txType===t.name);if(ds.length)rows.push(['Transaction',t.name,t.days?String(t.days):'—',ds.length,ds.filter(d=>d.stopAt).length,avgTat(ds),ontimePct(ds)]);});
   S.divisions.forEach(v=>{const ds=docs.filter(d=>d.division===v.code);if(ds.length)rows.push(['Division',v.code,'—',ds.length,ds.filter(d=>d.stopAt).length,avgTat(ds),ontimePct(ds)]);});
   return{title:'Turnaround and on-time rate',sub,cols:['Group','Name','Threshold (working days)','Documents','Finished','Avg. turnaround (working days)','On-time rate'],rows};}
  default:return{title:'Document register',sub,cols:DOC_COLS,rows:docExportRows(docs.sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt)))};
 }
}
VIEWS.reports=(u)=>{
 const r=buildReport(u),rf=UI.rf,wide=r.cols.length>9;
 return '<div class="wrap"><div class="pagehead"><div><h1>Reports</h1><p>Choose a report, narrow it, then print it or export it.</p></div><div class="row">'+(has(u,'report.print')?'<button class="btn" data-act="printReport">'+ic('print')+'Print</button><button class="btn" data-act="exportReport">'+ic('download')+'Export CSV</button>':'')+'</div></div>'+
 '<div class="tabs" role="tablist">'+REPORTS.map(x=>'<button class="tab" role="tab" data-act="repTab" data-k="'+x[0]+'" aria-selected="'+(UI.report===x[0])+'">'+x[1]+'</button>').join('')+'</div>'+
 '<div class="fbar" style="max-width:640px"><select data-chg="repF" data-k="division" aria-label="Division"><option value="">All divisions</option>'+S.divisions.map(d=>opt(d.code,d.code,rf.division===d.code)).join('')+'</select><input type="date" data-chg="repF" data-k="from" value="'+esc(rf.from||'')+'" aria-label="Received from" title="Received from"><input type="date" data-chg="repF" data-k="to" value="'+esc(rf.to||'')+'" aria-label="Received to" title="Received to"></div>'+
 '<div class="card pad"><h2>'+esc(r.title)+'</h2><p class="muted">'+esc(r.sub)+' '+plural(r.rows.length,'row')+'.</p><div class="tw"><table class="tbl"><thead><tr>'+r.cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+(r.rows.length?r.rows.map(x=>'<tr>'+x.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+r.cols.length+'"><div class="empty">No data for these filters.</div></td></tr>')+'</tbody></table></div></div></div>';
};
ACTIONS.repTab=(t)=>{UI.report=t.dataset.k;render();};
CHANGES.repF=(t)=>{UI.rf[t.dataset.k]=t.value;render();};
ACTIONS.printReport=()=>{const r=buildReport(ME());openPP(sheetHead(r.title,r.sub)+'<table><thead><tr>'+r.cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+r.rows.map(x=>'<tr>'+x.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table><div class="foot"><span>'+plural(r.rows.length,'row')+'</span><span>End of report</span></div>');};
ACTIONS.exportReport=()=>{const r=buildReport(ME());exportCSV(UI.report,r.cols,r.rows);};

/* =====================  ADMIN: USERS  ===================== */
async function cfg(sec,a,d){const r=await api('PUT','/api/config/'+sec,{value:S[sec],note:a+(d?': '+d:'')});if(!r.ok)toast(r.error||'Could not save that change.','bad');await refresh();}
const sysAdmins=()=>S.users.filter(u=>u.active&&u.role==='sysadmin');
VIEWS.users=(u)=>{
 return '<div class="wrap"><div class="pagehead"><div><h1>Users</h1><p>Accounts, roles and sign-in details. Deactivate an account rather than deleting it so document history stays intact.</p></div><button class="btn primary" data-act="userForm">'+ic('plus')+'Add user</button></div>'+
 '<div class="tw"><table class="tbl"><thead><tr><th>Name</th><th>Username</th><th>Role</th><th class="hide-md">Division</th><th>Status</th><th class="hide-md">Last sign-in</th><th></th></tr></thead><tbody>'+
 S.users.map(x=>'<tr><td class="b">'+esc(x.name)+(isOIC(x)?' '+badge('warn','OIC'):'')+'</td><td class="mono">'+esc(x.username)+'</td><td>'+esc(roleName(x.role))+'</td><td class="hide-md">'+esc(x.division||'—')+'</td><td>'+(x.active?badge('ok','Active'):badge('neu','Deactivated'))+(['div_manager','dept_manager'].includes(x.role)&&!x.present?' '+badge('warn','Away'):'')+'</td><td class="hide-md">'+(x.lastLogin?fmtDT(x.lastLogin):'Never')+'</td><td class="nowrap right"><button class="btn sm" data-act="userForm" data-id="'+x.id+'">Edit</button> <button class="btn sm" data-act="resetPw" data-id="'+x.id+'">Reset password</button></td></tr>').join('')+'</tbody></table></div></div>';
};
ACTIONS.userForm=(t)=>{
 const x=t.dataset.id?uById(t.dataset.id):null;
 openModal(x?'Edit '+x.name:'Add a user','<div data-form="user" data-id="'+(x?x.id:'')+'"><div class="fld"><label>Full name</label><input name="name" value="'+esc(x?x.name:'')+'"></div><div class="g2"><div class="fld"><label>Username</label><input name="username" autocapitalize="none" value="'+esc(x?x.username:'')+'"></div>'+(x?'<div class="fld"><label>Status</label><select name="active">'+opt('1','Active',x.active)+opt('0','Deactivated',!x.active)+'</select></div>':'<div class="fld"><label>Temporary password (must be changed at first sign-in)</label><input name="pw" value="'+suggestPw()+'"></div>')+'</div><div class="g2"><div class="fld"><label>Role</label><select name="role">'+ROLE_ORDER.map(r=>opt(r,ROLES[r],x&&x.role===r)).join('')+'</select></div><div class="fld"><label>Division</label><select name="division">'+opt('','None',!x||!x.division)+S.divisions.map(d=>opt(d.code,d.code,x&&x.division===d.code)).join('')+'</select></div></div><p class="hint">Roles decide what a person can do. Change them under Roles &amp; permissions. To make someone a division’s focal, use Divisions &amp; focals.</p></div>',
 {foot:'<button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="saveUser">Save user</button>'});
};
ACTIONS.saveUser=async(t)=>{
 const f=$('[data-form=user]'),v=formVals(f),id=f.dataset.id;
 if(!v.name.trim())return toast('Enter the full name.','bad');
 t.disabled=true;
 const body={name:v.name,username:v.username,role:v.role,division:v.division};
 const r=id?await api('PUT','/api/users/'+id,Object.assign(body,{active:v.active==='1'})):await api('POST','/api/users',Object.assign(body,{password:v.pw}));
 t.disabled=false;if(!r.ok)return toast(r.error||'Could not save the user.','bad');
 closeModal();toast('User saved.');await refresh();
};
ACTIONS.resetPw=(t)=>{const x=uById(t.dataset.id);openModal('Reset password for '+x.name,'<div data-form="rp" data-id="'+x.id+'"><div class="fld"><label>New password</label><input name="pw" value="'+suggestPw()+'"></div><p class="hint">Share the new password with '+esc(firstName(x.name))+' privately. They must choose their own at the next sign-in.</p></div>',{foot:'<button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="saveReset">Set password</button>'});};
ACTIONS.saveReset=async()=>{const f=$('[data-form=rp]'),v=formVals(f),x=uById(f.dataset.id),pe=pwProblem(v.pw);if(pe)return toast(pe,'bad');
 const r=await api('POST','/api/users/'+x.id+'/reset',{password:v.pw});if(!r.ok)return toast(r.error,'bad');closeModal();toast('Password reset for '+x.name+'. They must change it at next sign-in.');await refresh();};

/* =====================  ADMIN: ROLES & PERMISSIONS  ===================== */
VIEWS.roles=()=>{
 let last='';
 const rows=PERMS.map(p=>{let h='';if(p[0]!==last){h='<tr class="grp"><td colspan="'+(ROLE_ORDER.length+1)+'">'+esc(p[0])+'</td></tr>';last=p[0];}
  return h+'<tr><td>'+esc(p[2])+'</td>'+ROLE_ORDER.map(r=>'<td><input type="checkbox" aria-label="'+esc(ROLES[r]+': '+p[2])+'" data-chg="perm" data-r="'+r+'" data-p="'+p[1]+'"'+((S.perms[r]||[]).includes(p[1])||r==='sysadmin'?' checked':'')+(r==='sysadmin'?' disabled':'')+'></td>').join('')+'</tr>';}).join('');
 return '<div class="wrap"><div class="pagehead"><div><h1>Roles &amp; permissions</h1><p>Tick what each role may do. The System Administrator always has everything. Everyone can already open any document to see its basic details and print it; these permissions control who can act on a document, not who can see it. Some actions also depend on the desk: for example, only the assigned staff can submit a document, and only the division’s focal can assign it. Anyone named as a division’s focal also receives the focal abilities (assign, review) whatever their role.</p></div><button class="btn" data-act="resetPerms">Restore defaults</button></div><div class="tw"><table class="tbl matrix"><thead><tr><th>Permission</th>'+ROLE_ORDER.map(r=>'<th>'+esc(ROLES[r])+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div></div>';
};
CHANGES.perm=(t)=>{const r=t.dataset.r,p=t.dataset.p,a=S.perms[r]||(S.perms[r]=[]);const i=a.indexOf(p);if(t.checked&&i<0)a.push(p);if(!t.checked&&i>=0)a.splice(i,1);cfg('perms','Permission changed',ROLES[r]+': '+p+' '+(t.checked?'granted':'removed'));toast('Permission updated.');};
ACTIONS.resetPerms=()=>confirmBox('Restore default permissions','Every role goes back to the starting permissions.','Restore',()=>{S.perms=JSON.parse(JSON.stringify(DEFAULT_PERMS));cfg('perms','Permissions reset','');toast('Defaults restored.');render();});

/* =====================  ADMIN: DELEGATION & OIC  ===================== */
VIEWS.delegation=(u)=>{
 const ap=deptApprovers({division:''}),mgrs=S.users.filter(x=>x.active&&['dept_manager','div_manager'].includes(x.role)),can2=has(u,'oic.manage');
 const o=S.oic.userId?uById(S.oic.userId):null;
 const cand=S.users.filter(x=>x.active&&x.role!=='sysadmin');
 return '<div class="wrap"><div class="pagehead"><div><h1>Delegation &amp; OIC</h1><p>Only the Department Manager, or the Division Manager while the Department Manager is away, may clear a document for out. If both are away, the OIC nominated by the System Administrator steps in.</p></div></div>'+
 '<div class="banner '+(ap.tier==='Department Manager'?'ok':ap.tier==='none'?'bad':'warn')+'">'+ic('info')+'<div><b>Right now, final review and clearance go to:</b> '+(ap.tier==='none'?'no one. Mark a manager present or enable an OIC.':esc(ap.tier)+' – '+esc(ap.users.map(x=>x.name).join(', ')))+'</div></div>'+
 '<div class="charts"><div class="card pad"><h3 style="margin-bottom:10px">Presence of managers</h3>'+mgrs.map(m=>'<div class="row sp" style="padding:8px 0;border-bottom:1px solid var(--line2)"><div><b>'+esc(m.name)+'</b><div class="small muted">'+esc(roleName(m.role))+(m.division?' – '+esc(m.division):'')+'</div></div>'+((can2||m.id===u.id)?'<button class="btn sm" data-act="togglePresence" data-id="'+m.id+'">'+(m.present?'Present. Mark away':'Away. Mark present')+'</button>':badge(m.present?'ok':'warn',m.present?'Present':'Away'))+'</div>').join('')+'</div>'+
 '<div class="card pad"><h3 style="margin-bottom:10px">Officer-in-Charge (OIC)</h3>'+(can2?'<div data-panel><div class="fld"><label>Nominee</label><select name="oic">'+opt('','No nominee',!S.oic.userId)+cand.map(x=>opt(x.id,x.name+' ('+ROLES[x.role]+')',S.oic.userId===x.id)).join('')+'</select></div><label class="chk" style="margin-bottom:12px"><input type="checkbox" name="on"'+(S.oic.enabled?' checked':'')+'> Enable OIC authority</label><button class="btn primary" data-act="saveOic">Save OIC</button></div><p class="hint" style="margin-top:10px">While enabled, the nominee can clear documents for out, but only when the Department Manager and the Division Managers are all away.</p>':'<p>'+(S.oic.enabled&&o?esc(o.name)+' is the enabled OIC.':'No OIC is enabled. Only the System Administrator can enable one.')+'</p>')+'</div></div></div>';
};
ACTIONS.saveOic=(t)=>{const v=formVals(t.closest('[data-panel]'));if(v.on&&!v.oic)return toast('Choose a nominee before enabling the OIC.','bad');S.oic={enabled:!!v.on,userId:v.oic||''};cfg('oic','OIC updated',(v.on?'Enabled: ':'Disabled: ')+uname(v.oic));toast(v.on?'OIC enabled.':'OIC settings saved.');render();};

/* =====================  ADMIN: DIVISIONS  ===================== */
VIEWS.divisions=()=>{
 const foc=S.users.filter(x=>x.active&&x.role!=='sysadmin');
 return '<div class="wrap"><div class="pagehead"><div><h1>Divisions &amp; focals</h1><p>Each division has one Focal / Supervisor. Documents forwarded to a division go to that person to be classified and assigned.</p></div></div><div class="tw"><table class="tbl"><thead><tr><th>Division</th><th>Focal / Supervisor</th><th>Division Manager</th><th>Documents</th><th></th></tr></thead><tbody>'+
 S.divisions.map(d=>{const n=S.docs.filter(x=>x.division===d.code).length;return '<tr><td class="b">'+esc(d.code)+'</td><td><select data-chg="divFocal" data-code="'+esc(d.code)+'" aria-label="Focal for '+esc(d.code)+'">'+opt('','Not set',!d.focal)+foc.map(x=>opt(x.id,x.name+' ('+roleName(x.role)+')',d.focal===x.id)).join('')+'</select></td><td>'+esc(S.users.filter(x=>x.active&&x.role==='div_manager'&&x.division===d.code).map(x=>x.name).join(', ')||'None. Any Division Manager may review.')+'</td><td>'+n+'</td><td class="right">'+(n?'':'<button class="btn sm" data-act="delDiv" data-code="'+esc(d.code)+'">Remove</button>')+'</td></tr>';}).join('')+'</tbody></table></div>'+
 '<div class="card pad" style="margin-top:16px" data-panel><h3 style="margin-bottom:8px">Add a division</h3><div class="row"><input name="code" placeholder="Division code" style="max-width:240px"><button class="btn" data-act="addDiv">Add division</button></div></div><p class="hint" style="margin-top:12px">Any active user can be named focal. Naming someone gives them the focal abilities for that division. Set a user’s own division and role under Users.</p></div>';
};
CHANGES.divFocal=(t)=>{const d=divOf(t.dataset.code);d.focal=t.value;cfg('divisions','Focal set',d.code+': '+uname(t.value));toast('Focal saved for '+d.code+'.');};
ACTIONS.addDiv=(t)=>{const c=formVals(t.closest('[data-panel]')).code.trim();if(!c)return toast('Enter a division code.','bad');if(divOf(c))return toast('That division already exists.','bad');S.divisions.push({code:c,focal:''});cfg('divisions','Division added',c);render();};
ACTIONS.delDiv=(t)=>confirmBox('Remove division','Remove '+t.dataset.code+'? It has no documents.','Remove',()=>{S.divisions=S.divisions.filter(d=>d.code!==t.dataset.code);cfg('divisions','Division removed',t.dataset.code);render();},true);

/* =====================  ADMIN: REFERENCE LISTS  ===================== */
const addRow=(name,ph,extra)=>'<div class="row" data-panel style="margin-top:12px"><input name="v" placeholder="'+ph+'" style="flex:1;min-width:160px">'+(extra||'')+'<button class="btn sm" data-act="'+name+'">Add</button></div>';
const basisText=b=>({working_days:'from assignment',calendar_days:'from assignment',reporting_period:'after the reported month'}[b]||'from assignment');
const unitText=u=>u==='calendar_days'?'Calendar days':'Working days';
function docTypeTerm(t){
 const basis=docTypeBasis(t),thr=docTypeThreshold(t),unit=docTypeUnit(t);
 if(!thr)return '<span class="muted">No deadline</span>';
 if(basis==='reporting_period')return (unit==='calendar_days'?plural(thr,'calendar day'):'The '+ordinal(thr)+' working day')+' of the month after the reporting period';
 return plural(thr,unit==='calendar_days'?'calendar day':'working day')+' from assignment';
}
function refsFilterRows(rows,q){
 if(!q)return rows;
 return rows.filter(r=>JSON.stringify(r).toLowerCase().includes(q));
}
function refsPager(key,list){
 const s=UI.rfPages[key]||(UI.rfPages[key]={q:'',sort:'name',dir:1,page:1});
 const pages=Math.max(1,Math.ceil(list.length/PAGE));
 if(s.page>pages)s.page=pages;
 return{meta:s,rows:list.slice((s.page-1)*PAGE,s.page*PAGE),pages:pages};
}
function refsHead(key,label){
 const s=UI.rfPages[key],n=refsMatchCount(key);
 return '<div class="rt"><div class="row" style="flex:1"><input type="search" placeholder="Search '+esc(label).toLowerCase()+'" style="max-width:260px" value="'+esc(s.q)+'" data-inp="refQ" data-t="'+key+'" aria-label="Search '+esc(label)+'">'+(s.q?'<button class="btn sm ghost" data-act="refClear" data-t="'+key+'">Clear</button>':'')+'</div><span class="muted small">'+(s.q?plural(n,'match')+' — ':'')+'sorted by '+(s.sort==='active'?'status':esc(s.sort))+' ('+(s.dir>0?'ascending':'descending')+')</span></div>';
}
function refsMatchCount(key){
 const s=UI.rfPages[key],q=s.q.toLowerCase();
 const rows=key==='doc'?S.refs.doc.map(t=>[t.name,t.description||'',docTypeBasis(t),docTypeUnit(t)]):S.refs.comm.map(c=>[commName(c),(c&&c.description)||'']);
 return q?rows.filter(r=>JSON.stringify(r).toLowerCase().includes(q)).length:rows.length;
}
function refsPagerHTML(key,list,pages){
 const s=UI.rfPages[key];
 return '<div class="pager" style="padding:10px 16px"><span>'+plural(list.length,'record')+'</span><span class="row"><button class="btn sm" data-act="refPage" data-t="'+key+'" data-d="-1"'+(s.page<=1?' disabled':'')+'>Previous</button><span>Page '+s.page+' of '+pages+'</span><button class="btn sm" data-act="refPage" data-t="'+key+'" data-d="1"'+(s.page>=pages?' disabled':'')+'>Next</button></span></div>';
}UI.rfPages={doc:{q:'',sort:'name',dir:1,page:1},comm:{q:'',sort:'name',dir:1,page:1}};
function docTypesCard(){
 const s=UI.rfPages.doc;
 const list=refsFilterRows(S.refs.doc.map((t,i)=>Object.assign({i:i},t)),s.q.toLowerCase())
  .sort((a,b)=>{const v=k=>k==='name'?String(a.name):k==='term'?(docTypeThreshold(a)||0):(docTypeBasis(a));const w=k=>k==='name'?String(b.name):k==='term'?(docTypeThreshold(b)||0):(docTypeBasis(b));
   if(s.sort==='active')return ((a.active!==false?1:0)-(b.active!==false?1:0))*s.dir;
   const x=v(s.sort),y=w(s.sort);return (x<y?-1:x>y?1:0)*s.dir;});
 const pg=refsPager('doc',list);
 return '<div class="card"><div class="ch"><h3>Document types &amp; prescribed deadlines</h3><button class="btn sm primary" data-act="docTypeForm">'+ic('plus')+'Add document type</button></div>'+
  refsHead('doc','Document type')+
  '<div class="tw" style="border:0;border-radius:0"><table class="tbl"><thead><tr><th class="sortable" data-act="refSort" data-t="doc" data-k="name" aria-sort="'+(s.sort==='name'?(s.dir>0?'ascending':'descending'):'none')+'">Document type'+(s.sort==='name'?(s.dir>0?' &uarr;':' &darr;'):'')+'</th><th>Description</th><th class="sortable" data-act="refSort" data-t="doc" data-k="term">Prescribed deadline threshold'+(s.sort==='term'?(s.dir>0?' &uarr;':' &darr;'):'')+'</th><th class="sortable" data-act="refSort" data-t="doc" data-k="basis">Deadline unit / basis'+(s.sort==='basis'?(s.dir>0?' &uarr;':' &darr;'):'')+'</th><th class="sortable" data-act="refSort" data-t="doc" data-k="active">Status'+(s.sort==='active'?(s.dir>0?' &uarr;':' &darr;'):'')+'</th><th class="right">Actions</th></tr></thead><tbody>'+
  (pg.rows.length?pg.rows.map(t=>'<tr'+(t.active===false?' class="muted"':'')+'><td class="b">'+esc(t.name)+'</td><td class="small muted">'+esc(t.description||'—')+'</td><td>'+docTypeTerm(t)+'</td><td class="small">'+esc(unitText(docTypeUnit(t)))+'<div class="muted">'+esc(basisText(docTypeBasis(t)))+'</div></td><td>'+(t.active!==false?badge('ok','Active'):badge('neu','Inactive'))+'</td>'+
   '<td class="right nowrap"><button class="btn sm" data-act="docTypeForm" data-i="'+t.i+'">Edit</button> <button class="btn sm" data-act="docTypeToggle" data-i="'+t.i+'">'+(t.active!==false?'Deactivate':'Activate')+'</button> <button class="btn ghost sm" data-act="delDocType" data-i="'+t.i+'" aria-label="Remove">'+ic('x')+'</button></td></tr>').join(''):'<tr><td colspan="6"><div class="empty">No document types match.</div></td></tr>')+'</tbody></table></div>'+
  refsPagerHTML('doc',list,pg.pages)+
  '<div class="pgrid" style="padding:12px 16px;border-top:1px solid var(--line2)"><h4>Add a document type</h4><p class="hint">The prescribed threshold is used for every deadline of this type. No deadline is written into the application itself.</p><div data-panel><input name="v" placeholder="Name of the document type" style="width:100%;max-width:420px"><input name="description" placeholder="Description (optional)" style="margin-top:8px;width:100%;max-width:520px"><div class="row" style="margin-top:8px"><input name="threshold" type="number" min="1" max="365" placeholder="Threshold" style="width:120px"><select name="basis">'+DEADLINE_BASES.map(b=>opt(b[0],b[1],b[0]==='working_days')).join('')+'</select><select name="unit">'+DEADLINE_UNITS.map(u=>opt(u[0],u[1],u[0]==='working_days')).join('')+'</select><button class="btn sm primary" data-act="addDocType">Add</button></div></div></div></div>';
}
function commTypesCard(){
 const s=UI.rfPages.comm;
 const list=refsFilterRows(S.refs.comm.map((c,i)=>({i:i,name:commName(c),description:(c&&c.description)||'',active:!(c&&c.active===false)})),s.q.toLowerCase())
  .sort((a,b)=>{const v=k=>String(a[k]||''),w=k=>String(b[k]||'');if(s.sort==='active')return ((a.active?1:0)-(b.active?1:0))*s.dir;const x=v(s.sort),y=w(s.sort);return (x<y?-1:x>y?1:0)*s.dir;});
 const pg=refsPager('comm',list);
 return '<div class="card"><div class="ch"><h3>Communication types</h3><button class="btn sm primary" data-act="commTypeForm">'+ic('plus')+'Add communication type</button></div>'+
  refsHead('comm','Communication type')+
  '<div class="tw" style="border:0;border-radius:0"><table class="tbl"><thead><tr><th class="sortable" data-act="refSort" data-t="comm" data-k="name">Communication type'+(s.sort==='name'?(s.dir>0?' &uarr;':' &darr;'):'')+'</th><th>Description</th><th class="sortable" data-act="refSort" data-t="comm" data-k="active">Status'+(s.sort==='active'?(s.dir>0?' &uarr;':' &darr;'):'')+'</th><th class="right">Actions</th></tr></thead><tbody>'+
  (pg.rows.length?pg.rows.map(c=>'<tr'+(c.active?'':' class="muted"')+'><td class="b">'+esc(c.name)+'</td><td class="small muted">'+esc(c.description||'—')+'</td><td>'+(c.active?badge('ok','Active'):badge('neu','Inactive'))+'</td>'+
   '<td class="right nowrap"><button class="btn sm" data-act="commTypeForm" data-i="'+c.i+'">Edit</button> <button class="btn sm" data-act="commTypeToggle" data-i="'+c.i+'">'+(c.active?'Deactivate':'Activate')+'</button> <button class="btn ghost sm" data-act="delComm" data-i="'+c.i+'" aria-label="Remove">'+ic('x')+'</button></td></tr>').join(''):'<tr><td colspan="4"><div class="empty">No communication types match.</div></td></tr>')+'</tbody></table></div>'+
  refsPagerHTML('comm',list,pg.pages)+
  '<div class="pgrid" style="padding:12px 16px;border-top:1px solid var(--line2)"><h4>Add a communication type</h4><div data-panel><div class="row"><input name="v" placeholder="Name of the communication type" style="flex:1;min-width:200px"><input name="description" placeholder="Description (optional)" style="flex:1;min-width:200px"><button class="btn sm primary" data-act="addComm">Add</button></div></div></div></div>';
}
UI.refTab=UI.refTab||'transactions';
VIEWS.refs=()=>{
 const staff=S.users.filter(x=>x.active&&['staff','supervisor','focal'].includes(x.role));
 const tabs=[['transactions','Transactions'],['documents','Document types'],['communications','Communication types'],['leave','Leave types'],['holidays','Holidays'],['designations','Report designations'],['special','Special Reports']];
 let content='';
 if(UI.refTab==='transactions')content='<div class="card pad"><h3>Types of transaction</h3><p class="hint">Working days from assignment to clearance. Leave blank for no deadline.</p><table class="tbl"><tbody>'+S.refs.tx.map((t,i)=>'<tr><td>'+esc(t.name)+(t.special?' '+badge('neu','date set by focal'):'')+'</td><td style="width:90px">'+(t.special?'—':'<input type="number" min="1" data-chg="txDays" data-i="'+i+'" value="'+(t.days||'')+'" aria-label="Days for '+esc(t.name)+'">')+'</td><td class="right" style="width:70px"><button class="btn ghost sm" data-act="delTx" data-i="'+i+'" aria-label="Remove">'+ic('x')+'</button></td></tr>').join('')+'</tbody></table>'+addRow('addTx','New type of transaction','<input name="days" type="number" min="1" placeholder="Days" style="width:90px">')+'</div>';
 else if(UI.refTab==='documents')content=docTypesCard();
 else if(UI.refTab==='communications')content=commTypesCard();
 else if(UI.refTab==='leave')content=leaveTypesCard();
 else if(UI.refTab==='holidays')content='<div class="card pad"><h3>Holidays</h3><p class="hint">Excluded from working-day counts and from every prescribed deadline. Check these against the official calendar each year.</p><div style="max-height:300px;overflow:auto"><table class="tbl"><tbody>'+S.holidays.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(h=>'<tr><td class="nowrap">'+fmtD(parseD(h.date))+'</td><td>'+esc(h.name)+'</td><td class="right"><button class="btn ghost sm" data-act="delHol" data-d="'+h.date+'" aria-label="Remove">'+ic('x')+'</button></td></tr>').join('')+'</tbody></table></div><div class="row" data-panel style="margin-top:12px"><input type="date" name="date" style="width:auto"><input name="v" placeholder="Holiday name" style="flex:1;min-width:140px"><button class="btn sm" data-act="addHol">Add</button></div></div>';
 else if(UI.refTab==='designations')content='<div class="card pad"><h3>Report designations</h3><p class="hint">Each region or office has one staff member who processes its Consolidated CMR and PPR.</p><div style="max-height:380px;overflow:auto"><table class="tbl"><tbody>'+S.designations.map((d,i)=>'<tr><td>'+esc(d.name)+'</td><td><select data-chg="desStaff" data-i="'+i+'" aria-label="Staff for '+esc(d.name)+'">'+staff.map(x=>opt(x.id,x.name,d.staff===x.id)).join('')+'</select></td><td class="right" style="width:60px"><button class="btn ghost sm" data-act="delDes" data-i="'+i+'" aria-label="Remove">'+ic('x')+'</button></td></tr>').join('')+'</tbody></table></div><div class="row" data-panel style="margin-top:12px"><input name="v" placeholder="New region or office" style="flex:1;min-width:160px"><select name="staff" style="width:auto">'+staff.map(x=>opt(x.id,x.name)).join('')+'</select><button class="btn sm" data-act="addDes">Add</button></div></div>';
 else if(UI.refTab==='special')content=spConfigPage(true);
 return '<div class="wrap"><div class="pagehead"><div><h1>Reference lists</h1><p>Manage the options and schedules used across document tracking and reporting.</p></div></div><div class="tabs" role="tablist" aria-label="Reference list categories">'+tabs.map(x=>'<button class="tab" role="tab" data-act="refTab" data-k="'+x[0]+'" aria-selected="'+(UI.refTab===x[0])+'">'+x[1]+'</button>').join('')+'</div>'+content+'</div>';
};
ACTIONS.refTab=t=>{UI.refTab=t.dataset.k;render();};
const pval=t=>formVals(t.closest('[data-panel]'));
CHANGES.txDays=(t)=>{S.refs.tx[t.dataset.i].days=t.value?Number(t.value):null;cfg('refs','Threshold changed',S.refs.tx[t.dataset.i].name+': '+(t.value||'none'));toast('Threshold saved. It applies to documents assigned from now on.');};
ACTIONS.addTx=(t)=>{const v=pval(t);if(!v.v.trim())return toast('Enter a name.','bad');if(getTx(v.v.trim()))return toast('That already exists.','bad');S.refs.tx.push({name:v.v.trim(),days:v.days?Number(v.days):null});cfg('refs','Transaction type added',v.v);render();};
ACTIONS.delTx=(t)=>{const x=S.refs.tx[t.dataset.i];confirmBox('Remove transaction type','Remove “'+x.name+'”? Existing documents keep it.','Remove',()=>{S.refs.tx.splice(t.dataset.i,1);cfg('refs','Transaction type removed',x.name);render();},true);};
/* Saves the reference lists on the server. The server validates everything and refuses a change that
   would break a document, so what the screen shows is always what is stored. */
async function saveRefs(note){
 const r=await api('PUT','/api/config/refs',{value:S.refs,note:note});
 if(!r.ok){toast(r.error||'Could not save that change.','bad');await refresh();return false;}
 await refresh();return true;
}
const refsRefresh=()=>render();
ACTIONS.refSort=(t)=>{const s=UI.rfPages[t.dataset.t];const k=t.dataset.k;if(s.sort===k)s.dir*=-1;else{s.sort=k;s.dir=1;}refsRefresh();};
INPUTS.refQ=(t)=>{const s=UI.rfPages[t.dataset.t];s.q=t.value;s.page=1;clearTimeout(UI._rfq);UI._rfq=setTimeout(refsRefresh,250);};
ACTIONS.refClear=(t)=>{const s=UI.rfPages[t.dataset.t];s.q='';s.page=1;refsRefresh();};
ACTIONS.refPage=(t)=>{const s=UI.rfPages[t.dataset.t];s.page=Math.max(1,s.page+Number(t.dataset.d));refsRefresh();};

/* --- communication types --- */
ACTIONS.commTypeForm=(t)=>{
 const i=t.dataset.i,idx=i===undefined?null:Number(i),c=idx==null?null:S.refs.comm[idx];
 const name=input=>'<div class="fld"><label>Communication type name</label><input name="name" value="'+esc(name)+'" autocomplete="off"></div>';
 openModal(c?'Edit communication type':'Add a communication type','<div data-form="commtype" data-i="'+(idx==null?'':idx)+'">'+
  name(c?commName(c):'')+
  '<div class="fld"><label>Description (optional)</label><input name="description" value="'+esc(c&&c.description||'')+'"></div>'+
  '<div class="fld"><label>Status</label><select name="active">'+opt('1','Active',!c||c.active!==false)+opt('0','Inactive',!!c&&c.active===false)+'</select></div>'+
  '<p class="hint">Deactivating keeps every existing document unchanged; the type simply stops being offered.</p></div>',
 {foot:'<button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="saveCommType">Save</button>'});
};
ACTIONS.saveCommType=async(t)=>{
 const f=$('[data-form=commtype]'),v=formVals(f),name=(v.name||'').trim();
 if(!name)return toast('Enter the name of the communication type.','bad');
 const idx=f.dataset.i===''?null:Number(f.dataset.i);
 const dup=S.refs.comm.some((c,i)=>i!==idx&&commName(c).toLowerCase()===name.toLowerCase());
 if(dup)return toast('That communication type already exists.','bad');
 const now=new Date().toISOString();
 if(idx==null)S.refs.comm.push({name:name,description:v.description||'',active:v.active==='1',createdAt:now,updatedAt:now});
 else Object.assign(S.refs.comm[idx],{name:name,description:v.description||'',active:v.active==='1',updatedAt:now});
 closeModal();
 if(await saveRefs((idx==null?'Communication type added: ':'Communication type updated: ')+name))toast('Communication type saved.');
};
ACTIONS.commTypeToggle=async(t)=>{
 const i=Number(t.dataset.i),c=S.refs.comm[i],now=new Date().toISOString();
 const on=c.active===false;c.active=on;c.updatedAt=now;
 if(await saveRefs('Communication type '+(on?'activated':'deactivated')+': '+commName(c)))toast(commName(c)+(on?' is now active.':' is now inactive.'));
};
ACTIONS.addComm=async(t)=>{
 const v=pval(t),name=(v.v||'').trim();
 if(!name)return toast('Enter a name.','bad');
 if(S.refs.comm.some(c=>commName(c).toLowerCase()===name.toLowerCase()))return toast('That already exists.','bad');
 const now=new Date().toISOString();
 S.refs.comm.push({name:name,description:(v.description||'').trim(),active:true,createdAt:now,updatedAt:now});
 if(await saveRefs('Communication type added: '+name)){toast('Communication type added.');refsRefresh();}
};
ACTIONS.delComm=(t)=>{
 const i=Number(t.dataset.i),c=S.refs.comm[i],name=commName(c);
 confirmBox('Remove communication type','Remove “'+name+'”? A type already used by a document cannot be removed — deactivate it instead.','Remove',async()=>{
  S.refs.comm.splice(i,1);
  if(await saveRefs('Communication type removed: '+name))toast('Communication type removed.');
 },true);
};

/* --- document types and their prescribed deadline --- */
ACTIONS.docTypeForm=(t)=>{
 const i=t.dataset.i,idx=i===undefined?null:Number(i),d=idx==null?null:S.refs.doc[idx];
 const basis=docTypeBasis(d),unit=docTypeUnit(d),thr=d&&d.threshold!=null?d.threshold:'';
 openModal(d?'Edit document type':'Add a document type','<div data-form="doctype" data-i="'+(idx==null?'':idx)+'">'+
  '<div class="fld"><label>Document type name</label><input name="name" value="'+esc(d?d.name:'')+'" autocomplete="off"></div>'+
  '<div class="fld"><label>Description (optional)</label><input name="description" value="'+esc(d&&d.description||'')+'"></div>'+
  '<div class="g2"><div class="fld"><label>Prescribed deadline threshold</label><input name="threshold" type="number" min="1" max="365" value="'+esc(thr)+'" placeholder="e.g. 6"><p class="hint">Leave blank for a document type with no prescribed deadline.</p></div>'+
  '<div class="fld"><label>Deadline unit</label><select name="unit">'+DEADLINE_UNITS.map(u=>opt(u[0],u[1],u[0]===unit)).join('')+'</select><p class="hint">What one unit of the threshold means: working days skip weekends and the listed holidays; calendar days do not.</p></div></div>'+
  '<div class="fld"><label>Deadline basis</label><select name="basis">'+DEADLINE_BASES.map(b=>opt(b[0],b[1],b[0]===basis)).join('')+'</select><p class="hint">From assignment counts from the day the focal assigns the document. After the reporting period counts from the month the report covers — for example the 6th working day of the month after the reporting period.</p></div>'+
  '<div class="fld"><label>Status</label><select name="active">'+opt('1','Active',!d||d.active!==false)+opt('0','Inactive',!!d&&d.active===false)+'</select></div></div>',
 {foot:'<button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="saveDocType">Save</button>'});
};
ACTIONS.saveDocType=async(t)=>{
 const f=$('[data-form=doctype]'),v=formVals(f),name=(v.name||'').trim();
 if(!name)return toast('Enter the name of the document type.','bad');
 const idx=f.dataset.i===''?null:Number(f.dataset.i);
 if(S.refs.doc.some((d,i)=>i!==idx&&d.name.toLowerCase()===name.toLowerCase()))return toast('That document type already exists.','bad');
 const thr=(v.threshold===''||v.threshold==null)?null:Math.max(1,Math.min(365,parseInt(v.threshold,10)||1));
 if(v.basis==='reporting_period'&&!thr)return toast('A document type with a reporting-period basis needs a prescribed threshold of at least 1.','bad');
 const now=new Date().toISOString();
 const rec={name:name,description:v.description||'',threshold:thr,unit:v.unit==='calendar_days'?'calendar_days':'working_days',basis:DEADLINE_BASES.some(b=>b[0]===v.basis)?v.basis:'working_days',active:v.active==='1',regular:false,
  createdAt:idx==null?now:(S.refs.doc[idx].createdAt||now),updatedAt:now};
 if(idx==null)S.refs.doc.push(rec);else S.refs.doc[idx]=Object.assign({},S.refs.doc[idx],rec);
 closeModal();
 if(await saveRefs((idx==null?'Document type added: ':'Document type updated: ')+name))toast('Document type saved.');
};
ACTIONS.docTypeToggle=(t)=>{
 const i=Number(t.dataset.i),d=S.refs.doc[i],now=new Date().toISOString();
 const on=d.active===false;d.active=on;d.updatedAt=now;
 saveRefs('Document type '+(on?'activated':'deactivated')+': '+d.name).then(ok=>{if(ok)toast(d.name+(on?' is now active.':' is now inactive.'));});
};
ACTIONS.addDocType=async(t)=>{
 const v=pval(t),name=(v.v||'').trim();
 if(!name)return toast('Enter a name.','bad');
 if(S.refs.doc.some(d=>d.name.toLowerCase()===name.toLowerCase()))return toast('That already exists.','bad');
 const thr=(v.threshold===''||v.threshold==null)?null:Math.max(1,Math.min(365,parseInt(v.threshold,10)||1));
 if(v.basis==='reporting_period'&&!thr)return toast('A document type with a reporting-period basis needs a prescribed threshold of at least 1.','bad');
 const now=new Date().toISOString();
 S.refs.doc.push({name:name,description:(v.description||'').trim(),threshold:thr,unit:v.unit==='calendar_days'?'calendar_days':'working_days',basis:DEADLINE_BASES.some(b=>b[0]===v.basis)?v.basis:'working_days',active:true,regular:false,createdAt:now,updatedAt:now});
 if(await saveRefs('Document type added: '+name)){toast('Document type added.');refsRefresh();}
};
ACTIONS.delDocType=(t)=>{
 const i=Number(t.dataset.i),d=S.refs.doc[i];
 confirmBox('Remove document type','Remove “'+d.name+'”? Existing documents keep it, but it can no longer be chosen. Deactivating keeps it in the list instead.','Remove',async()=>{
  S.refs.doc.splice(i,1);
  if(await saveRefs('Document type removed: '+d.name))toast('Document type removed.');
 },true);
};
ACTIONS.addHol=(t)=>{const v=pval(t);if(!v.date||!v.v.trim())return toast('Enter the date and the name.','bad');if(S.holidays.some(h=>h.date===v.date))return toast('That date is already listed.','bad');S.holidays.push({date:v.date,name:v.v.trim()});rebuildHS();cfg('holidays','Holiday added',v.date);render();};
ACTIONS.delHol=(t)=>{S.holidays=S.holidays.filter(h=>h.date!==t.dataset.d);rebuildHS();cfg('holidays','Holiday removed',t.dataset.d);render();};
CHANGES.desStaff=(t)=>{S.designations[t.dataset.i].staff=t.value;cfg('designations','Designation changed',S.designations[t.dataset.i].name+': '+uname(t.value));toast('Saved.');};
ACTIONS.addDes=(t)=>{const v=pval(t);if(!v.v.trim())return toast('Enter the region or office.','bad');if(S.designations.some(d=>d.name===v.v.trim()))return toast('That already exists.','bad');S.designations.push({name:v.v.trim(),staff:v.staff});cfg('designations','Designation added',v.v);render();};
ACTIONS.delDes=(t)=>{const x=S.designations[t.dataset.i];S.designations.splice(t.dataset.i,1);cfg('designations','Designation removed',x.name);render();};

/* =====================  ADMIN: SETTINGS & DATA  ===================== */
VIEWS.settings=()=>{
 const s=S.settings;
 return '<div class="wrap"><div class="pagehead"><div><h1>System Admin Settings</h1><p>Configure system behavior.</p></div></div><div class="charts"><div class="card pad" data-panel><h3 style="margin-bottom:10px">System settings</h3>'+ 
 '<div class="fld"><label>Office name (shown on printouts)</label><input name="orgName" value="'+esc(s.orgName)+'"></div><div class="g2"><div class="fld"><label>Tracking number prefix</label><input name="prefix" value="'+esc(s.prefix)+'"></div><div class="fld"><label>Sign out after inactivity (minutes, 0 = never)</label><input type="number" min="0" name="idleMinutes" value="'+s.idleMinutes+'"></div></div>'+
 '<div class="g3"><div class="fld"><label>Due soon (working days)</label><input type="number" min="0" name="dueSoonDays" value="'+s.dueSoonDays+'"></div><div class="fld"><label>Admin desk limit (working days)</label><input type="number" min="0" name="adminDeskDays" value="'+s.adminDeskDays+'"></div><div class="fld"><label>Focal desk limit (working days)</label><input type="number" min="0" name="focalDeskDays" value="'+s.focalDeskDays+'"></div></div>'+
 '<div class="fld"><label>After staff comply with comments, the document goes to</label><select name="resubmit">'+opt('returner','The reviewer who returned it',s.resubmit==='returner')+opt('restart','The Supervisor review again (restart the chain)',s.resubmit==='restart')+'</select></div><button class="btn primary" data-act="saveSettings">Save settings</button></div>'+
 '<div class="card pad"><h3 style="margin-bottom:10px">Backup and data</h3><p class="muted">The server keeps a daily copy of the database for 14 days. You can also export a full backup here. It contains password hashes, so keep it private.</p><div class="row"><button class="btn" data-act="backup">'+ic('download')+'Export backup (JSON)</button><label class="btn" style="cursor:pointer">Restore from backup<input type="file" accept=".json,application/json" data-chg="restore" hidden></label></div><hr style="border:0;border-top:1px solid var(--line2);margin:16px 0"><div class="row"><button class="btn danger" data-act="clearDocs">Delete all documents</button></div></div></div>'+
 '<div class="banner" style="margin-top:16px">'+ic('info')+'<div><b>Accounts and sessions.</b> Sign-in is checked by the server, passwords are stored as salted hashes, and every action is authorised on the server, not just hidden in the screen. Deactivating a user ends their sessions immediately.</div></div></div>';
};
ACTIONS.saveSettings=(t)=>{const v=formVals(t.closest('[data-panel]')),s=S.settings,n=k=>Math.max(0,parseInt(v[k],10)||0);
 if(!v.orgName.trim()||!v.prefix.trim())return toast('The office name and prefix cannot be empty.','bad');
 Object.assign(s,{orgName:v.orgName.trim(),prefix:v.prefix.trim().toUpperCase(),idleMinutes:n('idleMinutes'),dueSoonDays:n('dueSoonDays'),adminDeskDays:n('adminDeskDays'),focalDeskDays:n('focalDeskDays'),resubmit:v.resubmit});adminAct('Settings saved','');toast('Settings saved.');render();};
ACTIONS.backup=async()=>{try{const res=await fetch('/api/admin/backup',{credentials:'same-origin'});if(!res.ok){toast('Could not create the backup.','bad');return;}saveFile('dts-backup-'+isoD(new Date())+'.json',await res.text(),'application/json');}catch(e){toast('Could not reach the server.','bad');}};
CHANGES.restore=(t)=>{const f=t.files[0];if(!f)return;const r=new FileReader();
 r.onload=()=>{let o;try{o=JSON.parse(r.result);}catch(e){toast('That file could not be read.','bad');return;}
  if(o.format!=='dts-backup'){toast('This is not a backup from this system.','bad');return;}
  confirmBox('Restore backup','This replaces all current data on the server with the backup ('+plural((o.docs||[]).length,'document')+', '+plural((o.users||[]).length,'user')+'). Other people are signed out.','Restore',async()=>{const x=await api('POST','/api/admin/restore',o);if(!x.ok)return toast(x.error||'Restore failed.','bad');toast('Backup restored.');await refresh();},true);};
 r.readAsText(f);t.value='';};
ACTIONS.clearDocs=()=>confirmBox('Delete all documents','Every document and its history will be removed for everyone. Users and settings stay.','Delete all documents',async()=>{const x=await api('POST','/api/admin/clear-docs',{});if(!x.ok)return toast(x.error,'bad');toast('All documents deleted.');await refresh();},true);

/* =====================  ADMIN: AUDIT LOG  ===================== */
function auditTable(rows){return '<div class="tw"><table class="tbl"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Detail</th></tr></thead><tbody>'+(rows.length?rows.map(a=>'<tr><td class="nowrap">'+fmtDT(a.at)+'</td><td>'+esc(a.by||'—')+'</td><td>'+esc(a.action)+'</td><td>'+esc(a.detail)+'</td></tr>').join(''):'<tr><td colspan="4"><div class="empty">No entries.</div></td></tr>')+'</tbody></table></div>';}
VIEWS.audit=(u)=>'<div class="wrap"><div class="pagehead"><div><h1>Audit log</h1><p>Sign-ins, document actions and administration changes, recorded by the server. The latest 200 matching entries are shown.</p></div><div class="row">'+(has(u,'report.print')?'<button class="btn" data-act="printAudit">'+ic('print')+'Print</button><button class="btn" data-act="exportAudit">'+ic('download')+'Export CSV</button>':'')+'</div></div><div class="fbar" style="max-width:360px"><input type="search" placeholder="Search the log" value="'+esc(UI.auditQ||'')+'" data-inp="auditQ" aria-label="Search the log"></div><div id="auditBox"><div class="empty">Loading…</div></div></div>';
async function loadAudit(){const r=await api('GET','/api/audit?q='+encodeURIComponent(UI.auditQ||''));const b=$('#auditBox');if(!b)return;if(!r.ok){b.innerHTML='<div class="empty">'+esc(r.error||'Could not load the log.')+'</div>';return;}UI.auditRows=r.rows;b.innerHTML=auditTable(r.rows);}
INPUTS.auditQ=(t)=>{UI.auditQ=t.value;clearTimeout(UI._at);UI._at=setTimeout(loadAudit,250);};
ACTIONS.printAudit=()=>openPP(sheetHead('Audit log','')+'<table><thead><tr><th>When</th><th>User</th><th>Action</th><th>Detail</th></tr></thead><tbody>'+(UI.auditRows||[]).map(a=>'<tr><td>'+fmtDT(a.at)+'</td><td>'+esc(a.by||'—')+'</td><td>'+esc(a.action)+'</td><td>'+esc(a.detail)+'</td></tr>').join('')+'</tbody></table>');
ACTIONS.exportAudit=()=>exportCSV('audit-log',['When','User','Action','Detail'],(UI.auditRows||[]).map(a=>[fmtDT(a.at),a.by||'',a.action,a.detail]));

/* =====================  BOOT  ===================== */
calInstall();
spInstall();
/* Startup splash (markup is in index.html so it is on screen before this file runs). It stays until the first
   state load has ANSWERED: signed in, signed out (401) or password change required all count as ready. A network
   failure, a server error or no answer within 15 seconds shows the error state with Retry. No fixed delay. */
const SPLASH_LIMIT_MS=15000;
function splashState(state){
 const e=$('#splash');if(!e)return;
 e.dataset.state=state;
 if(state==='error'){const b=$('.sp-btn',e);if(b)b.focus();}
}
function splashHide(){
 const e=$('#splash');if(!e)return;
 $('#app').removeAttribute('inert');
 e.classList.add('done');
 setTimeout(()=>e.remove(),1100); /* a little longer than the 1 s fade in app.css */
}
async function bootApp(){
 splashState('loading');
 /* the sign-in screen has a large background picture; have it ready so the fade never shows an empty page */
 const bg=new Promise(res=>{const i=new Image();i.onload=i.onerror=()=>res();i.src='/login-bg.png';});
 let timer;const limit=new Promise(res=>{timer=setTimeout(()=>res('timeout'),SPLASH_LIMIT_MS);});
 let ready=false;
 try{
  const r=await Promise.race([refresh(false,true),limit]);
  ready=r!=='timeout'&&(r===true||API.status===401||API.status===200);
 }catch(e){console.error('Startup failed:',e);}
 clearTimeout(timer);
 if(!ready)return splashState('error');
 if(!ME())await Promise.race([bg,new Promise(res=>setTimeout(res,1500))]);
 splashHide();
}
ACTIONS.splashRetry=()=>bootApp();
UI.theme=tGet()||'auto';applyTheme();parseHash();bootApp();
