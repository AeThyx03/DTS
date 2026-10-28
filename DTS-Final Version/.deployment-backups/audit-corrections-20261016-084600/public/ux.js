'use strict';
/* UI composition and interaction layer. Workflow decisions remain in engine.js. */
(() => {
 const trailRoot=document.createElement('div');trailRoot.className='particle-trail-overlay';trailRoot.setAttribute('aria-hidden','true');document.body.append(trailRoot);
 // An older running server may not expose the new asset until it is restarted.
 const cursorTrail=typeof createParticleTrail==='function'?createParticleTrail(trailRoot,document):{setEnabled(){}};
 const clone=v=>JSON.parse(JSON.stringify(v)), storeKey=()=> 'dts.workspace.v1.'+SESSION.uid;
 const read=()=>{try{const value=JSON.parse(localStorage.getItem(storeKey())||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}};
 const write=value=>{try{localStorage.setItem(storeKey(),JSON.stringify(value));}catch{}};
 let owner=null, prefs={}, confirmed={}, pending=0, actionRoot=null, focusReturn=null, modalBase='', modalInert=false, statusTimer;
 const dirty=new Set();
 const rootOf=t=>t?.closest('[data-form],[data-panel]')||t?.closest('.modal')||t?.closest('#view');
 const snapshot=root=>JSON.stringify(root?formVals(root):{});
 const registryPrefs=state=>({filters:clone(state.filters),sort:{...state.sort},hidden:[...state.hidden],pageSize:[25,50,100].includes(state.pageSize)?state.pageSize:25});
 function remember(){if(!ME())return;prefs={...prefs,...registryPrefs(REGISTRY_STATE.department),cmedRegistry:registryPrefs(REGISTRY_STATE.cmed),cmsdRegistry:registryPrefs(REGISTRY_STATE.cmsd)};write(prefs);}
 function restore(){
  if(!ME()||owner===SESSION.uid)return;
  owner=SESSION.uid;prefs=read();dirty.clear();
  for(const [state,saved,defaultHidden] of [[REGISTRY_STATE.department,prefs,['origin','recv','fwd']],[REGISTRY_STATE.cmed,prefs.cmedRegistry||{},[]],[REGISTRY_STATE.cmsd,prefs.cmsdRegistry||{},[]]]){
   state.filters=saved.filters&&typeof saved.filters==='object'?saved.filters:{tile:'total'};
   state.sort=saved.sort&&SORTERS[saved.sort.k]&&[1,-1].includes(saved.sort.dir)?saved.sort:{k:'receivedAt',dir:-1};
   state.hidden=Array.isArray(saved.hidden)?saved.hidden.filter(k=>COLS.some(c=>c.k===k)&&k!=='trk'):defaultHidden;
   state.pageSize=[25,50,100].includes(saved.pageSize)?saved.pageSize:25;state.page=1;state.sel.clear();state.batch='';
  }
  if(!location.hash||location.hash==='#/'||location.hash==='#'){
   UI.route=['sysadmin','dept_manager','div_manager'].includes(ME().role)?'dashboard':'action';
   history.replaceState(null,'','#/'+UI.route);
  }
 }
 function status(message,bad){
  let box=$('#uxSaveStatus');if(!box){box=document.createElement('div');box.id='uxSaveStatus';box.setAttribute('role','status');box.setAttribute('aria-live','polite');document.body.append(box);}
  clearTimeout(statusTimer);if(box.textContent!==message)box.textContent=message;box.className=bad?'ux-save bad':'ux-save';
  if(message==='Saved')statusTimer=setTimeout(()=>box.remove(),4000);
 }
 function clearErrors(root){if(!root)return;$$('.ux-error',root).forEach(e=>e.remove());$$('[aria-invalid]',root).forEach(e=>{e.removeAttribute('aria-invalid');e.removeAttribute('aria-describedby');});}
 function error(root,message,field){
  if(!root?.isConnected)root=$('#modalRoot .mb')||$('#view');if(!root)return;
  clearErrors(root);const box=document.createElement('div');box.className='ux-error banner bad';box.setAttribute('role','alert');box.id='uxFormError';box.textContent=message;root.prepend(box);
  const input=field&&root.querySelector('[name="'+field+'"]');if(input){input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby',box.id);input.focus();}else box.scrollIntoView({block:'nearest'});
 }
 const baseToast=toast;
 toast=(message,kind)=>{if(kind==='bad'&&actionRoot?.isConnected){error(actionRoot,message);return;}baseToast(message,kind);};
 const baseApi=api;
 api=async(method,url,body,opts)=>{
  const saving=!['GET','HEAD'].includes(method)&&!['/api/login','/api/logout'].includes(url);
  const root=actionRoot?.isConnected?actionRoot:null, buttons=saving&&root?$$('button,input,select,textarea',root).filter(e=>!e.disabled):[];
  if(saving){pending++;clearErrors(root);status('Saving…');buttons.forEach(e=>e.disabled=true);}
  try{
   const result=await baseApi(method,url,body,opts);
   if(url==='/api/state'&&result.ok&&result.state){for(const sec of ['settings','refs','perms','oic','divisions','holidays','designations'])confirmed[sec]=clone(result.state[sec]);}
   if(saving){
    if(result.ok){status('Saved');dirty.delete(root);if($('#modalRoot .modal')&&root&&$('#modalRoot').contains(root))modalBase=snapshot($('#modalRoot'));}
    else{status('Save failed — your entries are kept. Retry when ready.',true);error(root,result.error||'Could not save. Please try again.');}
   }
   return result;
  }finally{if(saving){pending--;buttons.forEach(e=>{if(e.isConnected)e.disabled=false;});}}
 };
 cfg=async(sec,a,d)=>{
  const value=clone(S[sec]),r=await api('PUT','/api/config/'+sec,{value,note:a+(d?': '+d:'')});
  if(!r.ok){if(confirmed[sec])S[sec]=clone(confirmed[sec]);rebuildHS();return false;}
  confirmed[sec]=value;toast(a+'.');await refresh();return true;
 };
 saveRefs=async note=>{
  const value=clone(S.refs),r=await api('PUT','/api/config/refs',{value,note});
  if(!r.ok){if(confirmed.refs)S.refs=clone(confirmed.refs);return false;}
  confirmed.refs=value;await refresh();return true;
 };
 const baseRefresh=refresh;
 refresh=async(poll,quiet)=>{if(poll&&(pending||[...dirty].some(e=>e.isConnected)))return false;const ok=await baseRefresh(poll,quiet);if(ok&&UI.previewId&&$('#modalRoot .ux-drawer')){modalBase=snapshot($('#modalRoot'));preview(UI.previewId);}return ok;};

 // One Insights destination for Analytics and Charts; legacy Reports URLs remain aliases.
 const baseNav=navItems;
 navItems=u=>{const n=baseNav(u);n.w=n.w.filter(x=>!['analytics','graphs'].includes(x[0])).map(x=>x[0]==='dashboard'?['dashboard','Department overview',x[2]]:x[0]==='action'?['action','My work',x[2]]:x);return n;};
 const reportTabs=()=>'<nav class="ux-tabs" aria-label="Insights sections">'+[['analytics','Analytics'],['graphs','Charts']].map(([r,label])=>'<a class="btn'+(UI.route===r?' primary':'')+'" href="#/'+r+'" data-act="nav" data-r="'+r+'"'+(UI.route===r?' aria-current="page"':'')+'>'+label+'</a>').join('')+'</nav>';
 const baseShell=shellHTML;
 shellHTML=()=>{
  const el=document.createElement('div');el.innerHTML=baseShell();
  const nav=el.querySelector('.nav'),head=[...nav.querySelectorAll('h4')].find(e=>e.textContent==='Administration');
  if(head){const group=document.createElement('details');group.className='ux-admin';group.open=prefs.adminOpen!==false||navItems(ME()).a.some(n=>n[0]===UI.route);group.innerHTML='<summary>Administration</summary>';let next=head.nextSibling;while(next){const after=next.nextSibling;group.append(next);next=after;}head.replaceWith(group);}
  if(['analytics','graphs'].includes(UI.route))el.querySelector('.nav [data-r=reports]')?.setAttribute('aria-current','page');
  if(UI.route==='doc'&&queueRoute==='action'){el.querySelector('.nav [data-r=dashboard]')?.removeAttribute('aria-current');el.querySelector('.nav [data-r=action]')?.setAttribute('aria-current','page');}
  if(UI.route==='doc'&&['cmed','cmsd'].includes(queueRoute)){el.querySelector('.nav [data-r=dashboard]')?.removeAttribute('aria-current');el.querySelector('.nav [data-r='+queueRoute+']')?.setAttribute('aria-current','page');}
  const bell=el.querySelector('[data-m=bell] .dotn'),n=myQueue(ME()).length+spMine(ME()).length;
  if(bell)bell.textContent=n;else if(n)el.querySelector('[data-m=bell]').insertAdjacentHTML('beforeend','<span class="dotn">'+n+'</span>');
  const mh=el.querySelector('[data-m=bell]')?.parentElement.querySelector('.mh');if(mh)mh.textContent='Waiting for your action ('+n+')';
  return el.innerHTML;
 };
 document.addEventListener('toggle',event=>{if(event.target.matches('.ux-admin')){prefs.adminOpen=event.target.open;write(prefs);}},true);

 const presetFilters={overdue:()=>({tile:'action',dl:'over'}),assignment:()=>({tile:'total',status:'at_focal'}),dispatch:()=>({tile:'total',status:'cleared'})};
 function viewsBar(){
  return '<div class="ux-views row"><label>Saved view <select data-chg="uxView" aria-label="Saved registry view"><option value="">Choose a view…</option><option value="overdue">My overdue</option><option value="assignment">Awaiting assignment</option><option value="dispatch">Ready for dispatch</option>'+Object.keys(prefs.views||{}).map((name,i)=>opt('custom:'+i,name,false)).join('')+'</select></label><button class="btn sm" data-act="uxSaveView">Save current view</button><button class="btn sm" data-act="uxManageViews">Manage saved views</button><label class="chk"><input type="checkbox" data-chg="uxPreview"'+(prefs.preview?' checked':'')+'> Preview in drawer</label><span class="hint">Filters, sort, columns and page size are remembered on this browser.</span></div>';
 }
 CHANGES.uxPreview=t=>{prefs.preview=t.checked;remember();};
 CHANGES.uxView=t=>{
  if(!t.value)return;
  if(presetFilters[t.value])UI.filters=presetFilters[t.value]();
  else{const name=Object.keys(prefs.views||{})[Number(t.value.split(':')[1])],v=prefs.views[name];if(!v)return;UI.filters=clone(v.filters);UI.sort={...v.sort};UI.hidden=[...v.hidden];UI.pageSize=v.pageSize;}
  UI.page=1;clearSel();render();
 };
 ACTIONS.uxSaveView=()=>openModal('Save current registry view','<div data-form="uxview"><div class="fld"><label for="uxViewName">View name</label><input id="uxViewName" name="name" maxlength="60" placeholder="e.g. CMED due this week"></div><p class="hint">Saves your filters, sort, columns and page size for this account on this browser.</p></div>',{foot:'<button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="uxStoreView">Save view</button>'});
 ACTIONS.uxStoreView=()=>{const root=$('[data-form=uxview]'),name=formVals(root).name.trim();if(!name)return error(root,'Enter a name for this view.','name');prefs.views={...(prefs.views||{}),[name]:{filters:clone(UI.filters),sort:{...UI.sort},hidden:[...UI.hidden],pageSize:documentPageSize()}};remember();dirty.delete(root);modalBase=snapshot($('#modalRoot'));closeModal();toast('View saved.');render();};
 ACTIONS.uxManageViews=()=>openModal('Manage saved views',Object.keys(prefs.views||{}).map((name,i)=>'<div class="row sp ux-view-item"><span>'+esc(name)+'</span><button class="btn sm" data-act="uxDeleteView" data-i="'+i+'">Remove</button></div>').join('')||'<p>No personal views saved yet.</p>');
 ACTIONS.uxDeleteView=t=>{delete prefs.views[Object.keys(prefs.views)[Number(t.dataset.i)]];remember();ACTIONS.uxManageViews();};
 const baseDashboard=VIEWS.dashboard;
 VIEWS.dashboard=u=>{
  const el=document.createElement('div');el.innerHTML=baseDashboard(u);
  el.querySelector('.wrap').classList.add('ux-workspace');
  const heading=el.querySelector('.hello h1'),subtitle=el.querySelector('.hello p'),greeting=heading.textContent;
  heading.textContent='Department overview';subtitle.textContent=greeting+'. '+subtitle.textContent;
  const ongoing=el.querySelector('.kt-warn');if(ongoing)ongoing.classList.replace('kt-warn','kt-neu');
  el.querySelector('.kts').setAttribute('aria-label','Registry totals for the selected division and priority. Choose a tile to filter the records below.');
  el.querySelector('.fp').insertAdjacentHTML('afterbegin',viewsBar());
  el.querySelector('#regTable').style.marginTop='12px';
  return el.innerHTML;
 };
 VIEWS.documents=VIEWS.dashboard;
 for(const route of ['cmed','cmsd']){
  const divisionView=VIEWS[route];
  VIEWS[route]=u=>{const el=document.createElement('div');el.innerHTML=divisionView(u);if(el.querySelector('#regSearch'))el.querySelector('.fp').insertAdjacentHTML('afterbegin',viewsBar());return el.innerHTML;};
 }
 function sortedQueue(u){const fn=SORTERS[UI.sort.k]||SORTERS.receivedAt;return actionDocs(u).slice().sort((a,b)=>{const x=fn(a),y=fn(b);return(x<y?-1:x>y?1:0)*UI.sort.dir;});}
 VIEWS.action=u=>{const list=sortedQueue(u),special=spActionHTML(u);return '<div class="wrap ux-workspace"><div class="pagehead"><div><h1>My work</h1><p>'+plural(list.length,'document')+' and '+plural(spMine(u).length,'Special Report')+' waiting for your action.</p></div></div><p class="ux-context hint">Open a record to continue its workflow. Every document where it is your turn to forward, assign, process, review or release appears here.</p>'+special+(list.length?regTable(u,list):special?'':'<div class="card empty"><b>Nothing is waiting on you right now.</b>New documents will appear when they reach your desk.</div>')+'</div>';};
 const currentRegistry=()=>{const selected=selectedDocs();return selected.length?selected:UI.route==='action'?sortedQueue(ME()):listDocs(ME());};
 ACTIONS.exportList=()=>exportCSV(isDivisionDocuments()?UI.route+'-documents':'registry',DOC_COLS,docExportRows(currentRegistry()));
 ACTIONS.printList=()=>{const list=currentRegistry();openPP(listSheet(UI.route==='action'?'My work documents':isDivisionDocuments()?UI.route.toUpperCase()+' document registry':'Document registry',(UI.sel.size?'Selected documents':'Current view')+', '+plural(list.length,'document'),list));};

 // Explicit metadata filters also make chart drilldowns inspectable and removable.
 const ageRanges={'Under 1 working day':[0,0],'1 working day':[1,1],'2 to 3 working days':[2,3],'4 to 7 working days':[4,7],'8 or more working days':[8,Infinity]};
 Object.assign(FILTER_LABELS,{q:'Search',division:'Division',priority:'Priority',age:'Time at desk',months:'Received months',unclassified:'Transaction unclassified'});
 const baseMatch=matchDoc;
 matchDoc=(d,f,u)=>{
  if(f.months&&!f.months.split(',').includes(isoD(d.receivedAt).slice(0,7)))return false;
  if(f.unclassified&&d.txType)return false;
  if(f.age){const range=ageRanges[f.age],n=Math.max(0,wdBetween(d.stageEnteredAt,new Date()));if(range&&(n<range[0]||n>range[1]))return false;}
  return baseMatch(d,f,u);
 };
 const drill=f=>goFilter({...f,...(UI.gf.division?{division:UI.gf.division}:{}),months:periodMonths().join(',')||'none'});
 ACTIONS.node=t=>drill({node:t.dataset.k});
 ACTIONS.wl=t=>drill({tile:'ongoing',assignee:t.dataset.v});
 ACTIONS.txbar=t=>drill(t.dataset.v==='Not yet classified'?{unclassified:true}:{txType:t.dataset.v});
 ACTIONS.dvbar=t=>drill({division:t.dataset.v});
 ACTIONS.grp=t=>drill({group:t.dataset.v});
 ACTIONS.dlbar=t=>drill({tile:'ongoing',dl:t.dataset.v});
 ACTIONS.agebar=t=>drill({tile:'ongoing',age:t.dataset.v});
 const baseReg=refreshReg;
 refreshReg=()=>{if(UI.route==='action')render();else baseReg();remember();keyboardRows();};
 CHANGES.selAll=t=>{pageRows(UI.route==='action'?sortedQueue(ME()):listDocs(ME())).rows.forEach(d=>{if(t.checked)UI.sel.add(d.id);else UI.sel.delete(d.id);});refreshReg();};
 function keyboardRows(){
  $$('#view tr[data-act=openDoc],#view tr[data-act=spOpen]').forEach(row=>{row.tabIndex=0;row.setAttribute('aria-label','Open '+row.querySelector('.mono')?.textContent);});
  $$('#view th.sortable').forEach(th=>{if(th.querySelector('.ux-sort'))return;const button=document.createElement('button');button.className='ux-sort';button.dataset.act='sort';button.dataset.k=th.dataset.k;button.innerHTML=th.innerHTML;th.replaceChildren(button);});
 }
 // Queue traversal captures the current filtered ordering, including off-page records.
 let queue=[],queueRoute='dashboard',queueParam=null;
 function captureQueue(){if(['dashboard','action'].includes(UI.route)||isDivisionDocuments()){queue=(UI.route==='action'?sortedQueue(ME()):listDocs(ME()).filter(d=>!d.specialReport)).map(d=>d.id);queueRoute=UI.route;queueParam=isDivisionDocuments()?'documents':null;}}
 const baseOpenDoc=ACTIONS.openDoc;
 ACTIONS.openDoc=t=>{captureQueue();if(prefs.preview&&(UI.route==='dashboard'||isDivisionDocuments()))return preview(t.dataset.id);baseOpenDoc(t);};
 function traversal(id){const i=queue.indexOf(id);return '<div class="row ux-traverse"><button class="btn sm" data-act="uxBack">Back to '+(queueRoute==='action'?'my work':['cmed','cmsd'].includes(queueRoute)?queueRoute.toUpperCase()+' documents':'registry')+'</button><span class="grow"></span><button class="btn sm" data-act="uxPrevious"'+(i>0?'':' disabled')+'>Previous document</button><span class="hint">'+(i>=0?(i+1)+' of '+queue.length:'Document')+'</span><button class="btn sm" data-act="uxNext"'+(i>=0&&i<queue.length-1?'':' disabled')+'>Next document</button></div>';}
 ACTIONS.uxBack=()=>go(queueRoute,queueParam);
 ACTIONS.uxPrevious=()=>{const id=UI.previewId||UI.param,i=queue.indexOf(id);if(i>0){if(UI.previewId)preview(queue[i-1]);else go('doc',queue[i-1]);}};
 ACTIONS.uxNext=()=>{const id=UI.previewId||UI.param,i=queue.indexOf(id);if(i>=0&&i<queue.length-1){if(UI.previewId)preview(queue[i+1]);else go('doc',queue[i+1]);}};
 function preview(id){
  const d=S.docs.find(d=>d.id===id);if(!d||!canView(ME(),d))return;
  if($('#modalRoot .modal')&&snapshot($('#modalRoot'))!==modalBase&&!confirm('Discard unsaved changes in this preview?'))return;
  UI.previewId=id;openModal('Document preview',VIEWS.doc(ME(),id),{wide:1,foot:'<button class="btn" data-act="closeModal">Close preview</button><button class="btn primary" data-act="uxFullDocument" data-id="'+esc(id)+'">Open full document</button>'});$('#modalRoot .modal').classList.add('ux-drawer');
 }
 ACTIONS.uxFullDocument=t=>{const id=t.dataset.id;if(closeModal()===false)return;go('doc',id);};
 function nextAction(d,u){const checks=[['forward','Forward to focal'],['assign','Assign document'],['submit',d.status==='compliance'?'Submit compliance':'Submit for review'],['sup_approve','Review document'],['div_approve','Review document'],['dept_clear','Review and clear'],['logout','Release document']];return checks.find(x=>can(u,d,x[0]))?.[1]||(d.status==='out'?'Released':'Awaiting responsible desk');}
 function summary(d,u){const di=deskInfo(d);return '<section class="card ux-doc-summary" aria-label="Document summary"><div><span>Status</span><b>'+esc(STAGES[d.status].short)+'</b></div><div><span>Responsible now</span><b>'+esc(di.who.filter(Boolean).join(', ')||di.label)+'</b></div><div><span>Deadline</span><b>'+(d.dueAt?fmtD(parseD(d.dueAt))+' · ':'')+esc(dl(d).label)+'</b></div><div><span>Time at desk</span><b>'+esc(d.status==='out'?'Released':elapsed(d.stageEnteredAt))+'</b></div><div><span>Next action</span><b>'+esc(nextAction(d,u))+'</b></div></section>';}
 const baseDoc=VIEWS.doc;
 VIEWS.doc=(u,id)=>{
  const el=document.createElement('div');el.innerHTML=baseDoc(u,id);const d=S.docs.find(d=>d.id===id);if(!d||!canView(u,d))return el.innerHTML;
  const wrap=el.querySelector('.wrap'),head=el.querySelector('.pagehead');wrap.querySelector(':scope > p')?.remove();wrap.prepend(document.createRange().createContextualFragment(traversal(id)));head.insertAdjacentHTML('afterend',summary(d,u));
  const grid=el.querySelector('.dgrid'),left=grid?.firstElementChild,right=grid?.lastElementChild;
  if(right?.firstElementChild?.querySelector('.card'))right.firstElementChild.replaceWith(right.firstElementChild.querySelector('.card'));
  const panel=left?.querySelector('.panel');
  if(panel){
   const primary=panel.querySelector('[data-panel]');if(primary&&!primary.querySelector('details')){const cta=primary.querySelector('.btn.primary');if(cta)cta.classList.add('ux-primary-action');}
   const extras=[...panel.children].filter(e=>e.querySelector('details'));
   if(extras.length){const details=document.createElement('details');details.className='ux-secondary';details.innerHTML='<summary>Other document actions</summary>';extras.forEach(e=>details.append(e));panel.append(details);}
   head.nextElementSibling.after(panel);
  }
  const override=[...el.querySelectorAll('.banner.warn')].find(e=>e.querySelector('[data-act=overrideClear]'));
  if(override){const detail=document.createElement('details');detail.className='ux-secondary card pad';detail.innerHTML='<summary>Administrative override</summary>';override.replaceWith(detail);detail.append(override);}
  const files=el.querySelector('[data-filelinks] h3');if(files)files.textContent='Files & links';
  // The original URL is presented once in the unified file panel.
  [...el.querySelectorAll('.dl dt')].filter(e=>e.textContent==='Document URL').forEach(e=>{e.nextElementSibling.remove();e.remove();});
  const history=[...el.querySelectorAll('h3')].find(e=>e.textContent==='Desk movement');if(history)history.textContent='Movement history & notes';
  return el.innerHTML;
 };

 // The data definition for each report is visible at the point of use.
 for(const route of ['graphs','analytics']){
  const view=VIEWS[route];VIEWS[route]=u=>{
   const el=document.createElement('div');el.innerHTML=view(u);const wrap=el.querySelector('.wrap');wrap.prepend(document.createRange().createContextualFragment(reportTabs()));
   const head=el.querySelector('.pagehead');head.insertAdjacentHTML('afterend','<p class="ux-report-note hint">Received: receipt date in the selected period. Released: release date in that period, including earlier receipts. Current backlog: open now. Status, workload and desk-age charts show the selected receipt cohort at its current stage. Includes Special Reports.</p>');
   if(!periodMonths().length){head.nextElementSibling.insertAdjacentHTML('afterend','<div class="card empty ux-period-empty"><b>No reporting months selected.</b><p>Choose at least one month to show figures and charts.</p><button class="btn primary" data-act="uxChooseMonths">Choose months</button></div>');el.querySelectorAll('.charts,.tiles,.stack,.card.pad').forEach(e=>e.remove());}
   return el.innerHTML;
  };
 }
 ACTIONS.uxChooseMonths=()=>{const picker=$('.mpick');if(picker){picker.open=true;picker.querySelector('input')?.focus();}else $('[data-chg=gfFrom]')?.focus();};

 // Bulk changes are reviewed record by record before any request is sent.
 const baseBatch=ACTIONS.batchExec;
 ACTIONS.batchExec=()=>{
  const spec=BATCH[UI.batch],docs=selectedDocs();if(!spec||!docs.length)return baseBatch();
  const action=UI.batch,eligible=docs.filter(spec.ok);if(!eligible.length)return toast('None of the selected documents can take that action at their current stage.','bad');
  const rows=docs.map(d=>{const ok=spec.ok(d),dest=action==='logout'?d.source:action==='forward'?(divFocal(d.division)?.name||'No focal configured'): 'Permanently removed';return '<tr><td>'+esc(d.trackNo)+'</td><td>'+esc(d.subject)+'</td><td>'+esc(ok?'Eligible':'Skipped: '+spec.why)+'</td><td>'+esc(ok?dest:'—')+'</td></tr>';}).join('');
  openModal('Review bulk action','<p><b>'+esc(spec.title)+'</b>: '+eligible.length+' eligible, '+(docs.length-eligible.length)+' skipped.</p><p class="hint">Destinations are shown below. Permissions and stage eligibility are checked again by the server.</p><div class="tw"><table class="tbl"><thead><tr><th>Tracking no.</th><th>Subject</th><th>Eligibility</th><th>Destination / effect</th></tr></thead><tbody>'+rows+'</tbody></table></div>',{wide:1,foot:'<button class="btn" data-act="closeModal">Cancel</button><button class="btn '+(action==='delete'?'danger':'primary')+'" data-act="uxRunBatch">Confirm '+esc(spec.title.toLowerCase())+'</button>'});
  UI.uxBatch={action,ids:eligible.map(d=>d.id)};
 };
 ACTIONS.uxRunBatch=async t=>{
  if(t.disabled)return;const batch=UI.uxBatch;if(!batch)return;UI.uxBatch=null;t.disabled=true;
  const spec=BATCH[batch.action];let done=0,failed=0,message='';
  for(const id of batch.ids){const d=S.docs.find(d=>d.id===id);if(!d||!spec.ok(d)){failed++;continue;}const r=await api('POST','/api/docs/'+id+'/act',{type:spec.type,payload:spec.pl(d)});if(r.ok)done++;else{failed++;message=r.error||'';}}
  modalBase=snapshot($('#modalRoot'));closeModal();clearSel();await refresh();toast(spec.verb+' '+done+' document(s).'+(failed?' '+failed+' failed. '+message:''),failed?'bad':undefined);
 };

 // Validate the required fields before submitting, retaining all entered values.
 function validate(t){
  const a=t.dataset.act;if(!/^(save|do|spDo|spSave|calSave|ltSave|add|uxStoreView)/.test(a))return true;
  const root=a==='saveDoc'?$('[data-form=doc]'):rootOf(t);if(!root)return true;
  clearErrors(root);const v=formVals(root),require=(key,label)=>{if(!String(v[key]||'').trim()){error(root,label+' is required.',key);return false;}return true;};
  if(a==='saveDoc'){
   for(const [key,label] of [['receivedAt','Received date'],['commType','Communication type'],['source','Received from'],['subject','Subject'],['docType','Document type']])if(!require(key,label))return false;
   if(isRegularDoc(v.docType)){if(!require('region','Region / office'))return false;if(docTypeBasis(docTypeOf(v.docType))==='reporting_period'&&docTypeThreshold(docTypeOf(v.docType))>0&&!require('reportingPeriod','Reporting period'))return false;}
   else if(!require('division','Division'))return false;
   if(v.reportingPeriod&&!normMonth(v.reportingPeriod)){error(root,'Choose a valid reporting month.','reportingPeriod');return false;}
  }
  if(a==='doAssign'&&(!require('txType','Transaction type')||!require('assignee','Assignee')))return false;
  if(a==='doAssign'&&getTx(v.txType)?.special&&!require('dueDate','Special deadline'))return false;
  if(a==='doReassign'&&!require('assignee','Assignee'))return false;
  if(a==='doSubmit'){
   const d=S.docs.find(d=>d.id===t.dataset.id);if('reviewer' in v&&!require('reviewer','Reviewer'))return false;
   if(d?.status==='compliance'&&!require('text','Compliance response'))return false;
  }
  if(a==='doReview'&&t.dataset.type.endsWith('_return')&&!require('text','Return comments'))return false;
  if(a==='doLogout'&&(!require('outTo','Release destination')||!require('outAt','Release date')))return false;
  if(a==='doNote'&&!require('text','Note'))return false;
  if(a==='doInstructReturn'&&!require('reason','Reason for return'))return false;
  if(a==='saveSettings'&&(!require('orgName','Office name')||!require('prefix','Tracking prefix')))return false;
  if(['saveDoc','saveUrls','spUrlSave'].includes(a))for(const input of $$('input[type=url]',root)){if(input.value&&!/^https?:\/\/[^\s]+$/i.test(input.value)){error(root,'Enter a complete HTTP or HTTPS file link.',input.name);return false;}}
  return true;
 }
 document.addEventListener('click',event=>{
  const t=event.target.closest('[data-act]');if(!t||t.dataset.act==='modalBack'&&event.target!==t)return;
  if(t.matches('button:disabled'))return;
  actionRoot=rootOf(t);
  if(!validate(t)){event.preventDefault();event.stopImmediatePropagation();return;}
  if(pending&&/^(save|do|add|del|reset|uxRunBatch)/.test(t.dataset.act)){event.preventDefault();event.stopImmediatePropagation();}
 },true);
 document.addEventListener('change',event=>{actionRoot=rootOf(event.target);},true);
 document.addEventListener('input',event=>{
  if(event.target.closest('[data-transient]'))return;
  const root=event.target.closest('[data-form],[data-panel]');if(root){dirty.add(root);event.target.removeAttribute('aria-invalid');if(!pending)status('Unsaved changes');}
 },true);
 window.addEventListener('beforeunload',event=>{if([...dirty].some(e=>e.isConnected)){event.preventDefault();event.returnValue='';}});
 const baseGo=go;
 go=(route,param)=>{if(pending){toast('Saving… Please wait before changing pages.');return;}if([...dirty].some(e=>e.isConnected)&&!confirm('Discard unsaved changes before leaving this page?'))return;dirty.clear();if(route==='action'&&UI.route!=='doc'&&UI.route!=='action')clearSel();baseGo(route,param);$('#view')?.focus({preventScroll:true});};
 window.addEventListener('hashchange',event=>{
  if(UI.silent||!ME())return;
  if(pending||([...dirty].some(e=>e.isConnected)&&!confirm('Discard unsaved changes before leaving this page?'))){event.stopImmediatePropagation();history.replaceState(null,'','#/'+UI.route+(UI.param?'/'+UI.param:''));return;}
  dirty.clear();
 },true);

 const baseOpenModal=openModal,baseCloseModal=closeModal;
 openModal=(title,body,opts)=>{
  if(!$('#modalRoot .modal')){focusReturn=document.activeElement;modalInert=$('#app').inert;}
  baseOpenModal(title,body,opts);$('#app').inert=true;modalBase=snapshot($('#modalRoot'));labelFields($('#modalRoot'));
  if(!$('#modalRoot').contains(document.activeElement))$('#modalRoot button')?.focus();
 };
 closeModal=()=>{
  if(pending&&ME()){toast('Saving… Please wait before closing this dialog.');return false;}
  if(ME()&&$('#modalRoot .modal')&&snapshot($('#modalRoot'))!==modalBase&&!confirm('Discard unsaved changes in this dialog?'))return false;
  const wasOpen=!!$('#modalRoot .modal');baseCloseModal();UI.previewId=null;if(wasOpen)$('#app').inert=modalInert;
  for(const root of dirty)if(!root.isConnected)dirty.delete(root);
  if(wasOpen){if(focusReturn?.isConnected)focusReturn.focus();else $('#view')?.focus();}return true;
 };
 const baseOpenPP=openPP,baseClosePP=closePP;let printFocus=null,printInert=false;
 openPP=html=>{printFocus=document.activeElement;printInert=$('#app').inert;baseOpenPP(html);$('#app').inert=true;$('#modalRoot').inert=true;$('#pp button')?.focus();};
 closePP=()=>{const wasOpen=!!$('#pp.on');baseClosePP();if(wasOpen){$('#app').inert=printInert;$('#modalRoot').inert=false;if(printFocus?.isConnected)printFocus.focus();else $('#view')?.focus();}};
 document.addEventListener('keydown',event=>{
  const dialog=$('#pp.on')||$('#modalRoot .modal');
  if(dialog&&event.key==='Tab'){
   const focusable=$$('a[href],button,input,select,textarea,[tabindex="0"]',dialog).filter(e=>!e.disabled&&!e.closest('[hidden]')&&e.getClientRects().length);
   const first=focusable[0],last=focusable.at(-1);if(!first){event.preventDefault();return;}
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
  if(!dialog&&['Enter',' '].includes(event.key)&&event.target.matches('tr[data-act],th.sortable')){event.preventDefault();event.target.click();}
 },true);
 let labelId=0;
 function labelFields(root){
  $$('.fld',root).forEach(field=>{
   const label=field.querySelector('label'),input=field.querySelector('input,select,textarea');if(!label||!input)return;
   if(!label.htmlFor){if(!input.id)input.id='uxField'+(++labelId);label.htmlFor=input.id;}
   const form=input.closest('[data-form=doc]'),panel=input.closest('[data-panel]');let required=false;
   if(form){const v=formVals(form),regular=isRegularDoc(v.docType);required=['receivedAt','commType','source','subject','docType'].includes(input.name)||input.name==='division'&&!regular||input.name==='region'&&regular||input.name==='reportingPeriod'&&regular&&docTypeBasis(docTypeOf(v.docType))==='reporting_period'&&docTypeThreshold(docTypeOf(v.docType))>0;}
   else if(panel){
    if(panel.querySelector('[data-act=doAssign]'))required=['txType','assignee'].includes(input.name)||input.name==='dueDate'&&!!getTx(formVals(panel).txType)?.special;
    if(panel.querySelector('[data-act=doReassign]'))required=input.name==='assignee';
    const submit=panel.querySelector('[data-act=doSubmit],[data-act=spDoSubmit]');if(submit){const d=S.docs.find(d=>d.id===submit.dataset.id);required=input.name==='reviewer'||input.name==='text'&&d?.status==='compliance';}
    if(panel.querySelector('[data-act=doLogout],[data-act=spDoLogout]'))required=['outTo','outAt'].includes(input.name);
    if(panel.querySelector('[data-act=saveSettings]'))required=['orgName','prefix'].includes(input.name);
   }
   if(input.closest('[data-form=commtype],[data-form=doctype]')&&input.name==='name')required=true;
   if(input.closest('[data-form=refnew]')&&['name','date','staff'].includes(input.name))required=true;
   if(required){input.setAttribute('aria-required','true');if(!label.querySelector('.ux-required'))label.insertAdjacentHTML('beforeend',' <span class="ux-required">Required</span>');}
   else{input.removeAttribute('aria-required');label.querySelector('.ux-required')?.remove();}
  });
  $$('input:not([type=hidden]),select,textarea',root).forEach(input=>{if(!input.labels?.length&&!input.hasAttribute('aria-label')&&!input.hasAttribute('aria-labelledby'))input.setAttribute('aria-label',input.placeholder||input.name?.replace(/([a-z])([A-Z])/g,'$1 $2')||'Option');});
 }
 const baseSyncPeriod=syncPeriodField;
 syncPeriodField=()=>{baseSyncPeriod();const form=$('[data-form=doc]');if(form)labelFields(form);};
 const baseTxChange=CHANGES.txType;
 CHANGES.txType=t=>{baseTxChange(t);labelFields(t.closest('[data-panel]'));};
 const baseRender=render;
 const sidebarPages=new Set(['dashboard','action','cmed','cmsd','regular','schedule','reports','analytics','graphs','users','roles','delegation','divisions','refs','spconfig','settings','workflow','audit']);
 render=()=>{
  restore();
  // Preserve drafts during account-menu/theme rerenders on the same route.
  const key=UI.route+'/'+UI.param, drafts=UI._key===key?[...dirty].filter(e=>e.isConnected&&!e.closest('#modalRoot')).map(e=>({form:e.dataset.form,panel:e.hasAttribute('data-panel'),index:[...document.querySelectorAll('[data-panel]')].indexOf(e),values:formVals(e)})):[];
  if(UI._key!==key&&!pending)$('#uxSaveStatus')?.remove();
  baseRender();
  cursorTrail.setEnabled(!!ME()&&S.settings.cursorTrail!==false);
  if(!ME()){owner=null;confirmed={};dirty.clear();return;}
  $('#view').classList.toggle('ux-page',sidebarPages.has(UI.route));
  for(const draft of drafts){const root=draft.form?document.querySelector('[data-form="'+draft.form+'"]'):document.querySelectorAll('[data-panel]')[draft.index];if(root){$$('[name]',root).forEach(input=>{if(input.name in draft.values){if(input.type==='checkbox')input.checked=draft.values[input.name];else input.value=draft.values[input.name];}});dirty.add(root);}}
  labelFields($('#view'));keyboardRows();remember();
  if($('#modalRoot .modal'))$('#app').inert=true;
 };
 cursorTrail.setEnabled(!!ME()&&S.settings.cursorTrail!==false);
})();
