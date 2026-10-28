/* Phase 9 - Personnel Schedule: acceptance tests at the API level.
   Run against a fresh DATA_DIR, like the other suites:
     SEED_DEMO=1 DATA_DIR=/tmp/t PORT=3111 node server.js &
     PORT=3111 node test/schedule.test.js */
const B='http://localhost:'+(process.env.PORT||3111);
let pass=0,failn=0;const ok=(n,c)=>{c?pass++:failn++;console.log((c?'PASS ':'FAIL ')+n);};
async function client(){let cookie='';return async(m,u,b)=>{const r=await fetch(B+u,{method:m,headers:Object.assign({'X-Requested-With':'dts',cookie},b!==undefined?{'Content-Type':'application/json'}:{}),body:b!==undefined?JSON.stringify(b):undefined});const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];let j={};try{j=await r.json();}catch(e){}return Object.assign({s:r.status},j);};}
async function login(u,p){const c=await client();const r=await c('POST','/api/login',{username:u,password:p});if(r.s!==200)throw new Error('login '+u+' '+r.s+' '+r.error);return c;}
(async()=>{
 const DP='Track@2026';
 const adm=await login('admin','Admin@2026'),paling=await login('mpaling',DP),cruz=await login('dcruz',DP);
 const st=await adm('GET','/api/state');
 ok('state carries schedules and leave types',Array.isArray(st.state.schedules)&&Array.isArray(st.state.leaveTypes));
 const lt=Object.fromEntries(st.state.leaveTypes.map(t=>[t.name,t]));
 ok('starting leave types exist and are active',['Vacation Leave','Sick Leave','Special Leave','Other'].every(n=>lt[n]&&lt[n].active));
 const A='mojica',Bp='delrosario',C='torino';   /* stand-ins for Engr. A, B, C: existing user records */
 ok('personnel are the existing users (no second personnel table)',st.state.users.some(u=>u.id===A)&&st.state.users.some(u=>u.id===Bp));

 /* --- permissions --- */
 const ins={type:'inspection',title:'CPES Inspection',project:'Project ABC',location:'Project Site',startDate:'2026-09-29',endDate:'2026-09-29',startTime:'08:00',endTime:'17:00',personnel:[A,Bp],remarks:''};
 ok('a user without the permission cannot add (403)',(await paling('POST','/api/schedules',ins)).s===403);
 ok('a user without the permission can still view',(await cruz('GET','/api/state')).state.schedules!==undefined);
 ok('a user without config.manage cannot change leave types (403)',(await paling('PUT','/api/leave-types',{value:st.state.leaveTypes})).s===403);
 ok('csrf header still required',(await fetch(B+'/api/schedules',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status===403);

 /* --- Test 1: inspection, two personnel, one record --- */
 const r1=await adm('POST','/api/schedules',ins);
 ok('Test 1: inspection saved',r1.s===200&&r1.id);
 let all=(await adm('GET','/api/state')).state.schedules;
 const i1=all.find(x=>x.id===r1.id);
 ok('Test 1: ONE record holds both inspectors',all.filter(x=>x.title==='CPES Inspection').length===1&&i1.personnel.length===2&&i1.personnel.includes(A)&&i1.personnel.includes(Bp));
 ok('audit fields recorded (created by / at, updated by / at)',i1.createdBy==='sysadmin'&&!!i1.createdAt&&i1.updatedBy==='sysadmin'&&!!i1.updatedAt);

 /* --- Test 2: multi-day leave --- */
 const lv={type:'leave',personnel:[A],leaveTypeId:lt['Vacation Leave'].id,startDate:'2026-09-30',endDate:'2026-10-02',remarks:'family trip'};
 const r2=await adm('POST','/api/schedules',lv);
  /* Engr. A is on the Sept 29 inspection only; Sept 30 - Oct 2 does not touch it */
 ok('Test 2: leave saved with no conflict',r2.s===200);
 all=(await adm('GET','/api/state')).state.schedules;
 const l2=all.find(x=>x.id===r2.id);
 ok('Test 2: leave spans Sept 30 to Oct 2',l2&&l2.startDate==='2026-09-30'&&l2.endDate==='2026-10-02'&&l2.leaveTypeId===lt['Vacation Leave'].id);

 /* --- Test 3: meeting with three participants --- */
 const mt={type:'meeting',title:'CPD Meeting',startDate:'2026-09-30',endDate:'2026-09-30',startTime:'14:00',endTime:'16:00',location:'Conference Room',link:'https://meet.google.com/abc-defg-hij',organizer:'nieva',personnel:[A,Bp,C],remarks:'Agenda: Q3'};
 const r3a=await adm('POST','/api/schedules',mt);
 /* Engr. A is on vacation leave that day, so this MUST warn first (Test 4 logic applies) */
 ok('Test 3/4: meeting on a day Engr. A is on leave warns first (409 conflict, nothing saved)',r3a.s===409&&r3a.code==='conflict'&&r3a.conflicts.some(c=>c.userId===A));
 ok('the warning is worded for the person',/already on Vacation Leave/.test(r3a.conflicts[0].message)&&/Rey Reginald A\. Mojica/.test(r3a.conflicts[0].message));
 ok('nothing was saved by the refused attempt',(await adm('GET','/api/state')).state.schedules.length===2);
 const r3=await adm('POST','/api/schedules',Object.assign({},mt,{confirm:true}));
 ok('Test 3: an authorised user can review and confirm (warn, then allow)',r3.s===200&&r3.conflicts===1);
 all=(await adm('GET','/api/state')).state.schedules;
 const m3=all.find(x=>x.id===r3.id);
 ok('Test 3: meeting stored with organizer, participants, link and location',m3.organizer==='nieva'&&m3.personnel.length===3&&m3.link.startsWith('https://')&&m3.location==='Conference Room');

 /* --- Test 4: leave vs inspection, whole-day rule --- */
 const insLeaveDay={type:'inspection',title:'Follow-up inspection',project:'Project XYZ',location:'',startDate:'2026-09-30',endDate:'2026-09-30',startTime:'08:00',endTime:'12:00',personnel:[A]};
 const r4=await adm('POST','/api/schedules',insLeaveDay);
 ok('Test 4: inspection on a leave day is flagged',r4.s===409&&r4.conflicts.length>=1&&/already on Vacation Leave during this scheduled inspection/.test(r4.conflicts[0].message));

 /* --- Test 5: time overlap, the 8-5 inspection vs a 10-11 meeting --- */
 const mt5={type:'meeting',title:'Management Meeting',startDate:'2026-09-29',endDate:'2026-09-29',startTime:'10:00',endTime:'11:00',location:'HQ',organizer:'',personnel:[A]};
 const r5=await adm('POST','/api/schedules',mt5);
 ok('Test 5: a meeting inside an inspection window is flagged',r5.s===409&&r5.conflicts.some(c=>c.otherType==='inspection'&&c.userId===A));
 const mt5b=Object.assign({},mt5,{startTime:'17:00',endTime:'18:00'});
 ok('a meeting that only starts when the inspection ends is NOT a conflict (touching times)',(await adm('POST','/api/schedules',mt5b)).s===200);

 /* --- Example 3: sick leave whole-day vs a 2 PM meeting --- */
 const sick={type:'leave',personnel:[Bp],leaveTypeId:lt['Sick Leave'].id,startDate:'2026-10-05',endDate:'2026-10-05'};
 ok('sick leave saved',(await adm('POST','/api/schedules',sick)).s===200);
 const mSick={type:'meeting',title:'Sync',startDate:'2026-10-05',endDate:'2026-10-05',startTime:'14:00',endTime:'15:00',organizer:'',personnel:[Bp]};
 const rs=await adm('POST','/api/schedules',mSick);
 ok('Example 3: a meeting at 2 PM on a sick-leave day is flagged',rs.s===409&&rs.conflicts.length===1);

 /* --- multi-day inspection --- */
 const multi={type:'inspection',title:'Multi-day CPES',project:'Project LMN',location:'Laguna',startDate:'2026-10-13',endDate:'2026-10-15',startTime:'08:00',endTime:'17:00',personnel:[C]};
 const rm=await adm('POST','/api/schedules',multi);
 ok('multi-day inspection saved',rm.s===200);
 const mMid={type:'meeting',title:'Mid-inspection call',startDate:'2026-10-14',endDate:'2026-10-14',startTime:'09:00',endTime:'10:00',organizer:'',personnel:[C]};
 ok('a meeting on the middle day of a multi-day inspection is flagged',(await adm('POST','/api/schedules',mMid)).s===409);

 /* --- validation: prevent invalid records --- */
 const bad=async(o,label)=>ok(label,(await adm('POST','/api/schedules',o)).s===400);
 await bad(Object.assign({},ins,{personnel:[]}),'inspection needs personnel');
 await bad(Object.assign({},ins,{title:''}),'inspection needs a title');
 await bad(Object.assign({},ins,{startDate:''}),'inspection needs a date');
 await bad(Object.assign({},ins,{startTime:''}),'inspection needs a start time');
 await bad(Object.assign({},ins,{startTime:'17:00',endTime:'08:00'}),'inspection end time must be after start');
 await bad(Object.assign({},ins,{project:'',location:''}),'inspection needs a project or a location');
 await bad(Object.assign({},ins,{endDate:'2026-09-01'}),'inspection end date cannot be before the start date');
 await bad(Object.assign({},ins,{personnel:['nobody']}),'inspection personnel must be existing users');
 await bad(Object.assign({},lv,{leaveTypeId:''}),'leave needs a leave type');
 await bad(Object.assign({},lv,{leaveTypeId:'zzz'}),'leave type must exist');
 await bad(Object.assign({},lv,{personnel:[]}),'leave needs a person');
 await bad(Object.assign({},lv,{personnel:[A,Bp]}),'leave is for exactly one person');
 await bad(Object.assign({},lv,{startDate:'',endDate:''}),'leave needs a start date');
 await bad(Object.assign({},lv,{startDate:'2026-10-05',endDate:'2026-10-01'}),'leave end date cannot be before start date');
 await bad(Object.assign({},mt,{title:''}),'meeting needs a title');
 await bad(Object.assign({},mt,{startDate:''}),'meeting needs a date');
 await bad(Object.assign({},mt,{endTime:'13:00'}),'meeting end time cannot be earlier than start time');
 await bad(Object.assign({},mt,{link:'javascript:alert(1)'}),'meeting link must be a web address (scripts refused)');
 await bad(Object.assign({},mt,{organizer:'',personnel:[]}),'meeting needs an organizer or a participant');
 await bad({type:'party'},'unknown schedule type refused');
 ok('meeting links: Google Meet, Teams and Zoom addresses are accepted',(await Promise.all(['https://teams.microsoft.com/l/meetup-join/abc','https://us02web.zoom.us/j/123456789'].map((l,i)=>adm('POST','/api/schedules',Object.assign({},mt,{startDate:'2026-11-0'+(i+2),endDate:'2026-11-0'+(i+2),link:l,personnel:[Bp],organizer:''}))))).every(r=>r.s===200));

 /* --- edit / delete --- */
 const e1=await adm('PUT','/api/schedules/'+r1.id,Object.assign({},ins,{title:'CPES Inspection (revised)',personnel:[A,Bp,C]}));
 all=(await adm('GET','/api/state')).state.schedules;
 const i1b=all.find(x=>x.id===r1.id);
 ok('edit keeps ONE record, adds the third inspector and changes the title',e1.s===200&&i1b.personnel.length===3&&i1b.title==='CPES Inspection (revised)'&&all.filter(x=>x.id===r1.id).length===1);
 ok('edit keeps who created it, records who updated it',i1b.createdBy==='sysadmin'&&i1b.updatedBy==='sysadmin'&&i1b.createdAt===i1.createdAt);
 const tchg=await adm('PUT','/api/schedules/'+r1.id,Object.assign({},ins,{type:'leave',personnel:[A,Bp,C]}));
 ok('the type of an existing schedule cannot be changed by an edit',tchg.s===200&&(await adm('GET','/api/state')).state.schedules.find(x=>x.id===r1.id).type==='inspection');
 ok('a schedule does not conflict with itself when edited',(await adm('PUT','/api/schedules/'+r1.id,Object.assign({},ins,{personnel:[A,Bp,C]}))).s===200);
 ok('editing into a clash warns',(await adm('PUT','/api/schedules/'+r1.id,Object.assign({},ins,{startDate:'2026-09-30',endDate:'2026-09-30'}))).s===409);
 ok('a user without the permission cannot edit (403)',(await paling('PUT','/api/schedules/'+r1.id,ins)).s===403);
 ok('a user without the permission cannot delete (403)',(await paling('DELETE','/api/schedules/'+r1.id)).s===403);
 ok('unknown schedule id is 404',(await adm('DELETE','/api/schedules/nope')).s===404);
 const before=(await adm('GET','/api/state')).state.schedules.length;
 const dm=await adm('DELETE','/api/schedules/'+rm.id);
 ok('delete removes a real schedule',dm.s===200&&(await adm('GET','/api/state')).state.schedules.length===before-1);

 /* --- granting the permission to a role --- */
 const perms=(await adm('GET','/api/state')).state.perms;
 perms.admin_staff=perms.admin_staff.concat(['schedule.manage']);
 ok('the permission can be granted to a role on the Roles page',(await adm('PUT','/api/config/perms',{value:perms})).s===200);
 const paling2=await login('mpaling',DP);
 const rp=await paling2('POST','/api/schedules',{type:'meeting',title:'Admin desk huddle',startDate:'2026-12-01',endDate:'2026-12-01',startTime:'09:00',endTime:'09:30',organizer:'paling',personnel:[]});
 ok('a role with the permission can add schedules',rp.s===200);
 ok('but it still cannot manage leave types (needs config.manage)',(await paling2('PUT','/api/leave-types',{value:st.state.leaveTypes})).s===403);

 /* --- leave types: add, edit, deactivate; nothing hard-coded --- */
 let types=(await adm('GET','/api/state')).state.leaveTypes.map(t=>Object.assign({},t));
 types.push({name:'Maternity Leave',description:'',active:true});
 ok('add a leave type',(await adm('PUT','/api/leave-types',{value:types})).s===200);
 types=(await adm('GET','/api/state')).state.leaveTypes;
 const mat=types.find(t=>t.name==='Maternity Leave');
 ok('new leave type got its own id',!!mat&&!!mat.id);
 ok('a duplicate name is refused',(await adm('PUT','/api/leave-types',{value:types.concat([{name:'maternity leave',active:true}])})).s===400);
 ok('a blank name is refused',(await adm('PUT','/api/leave-types',{value:types.concat([{name:' ',active:true}])})).s===400);
 ok('a leave type cannot be removed',(await adm('PUT','/api/leave-types',{value:types.filter(t=>t.name!=='Other')})).s===400);
 const renamed=types.map(t=>t.id===mat.id?Object.assign({},t,{name:'Maternity / Paternity Leave'}):t);
 ok('edit (rename) a leave type',(await adm('PUT','/api/leave-types',{value:renamed})).s===200);
 const usedLv=await adm('POST','/api/schedules',{type:'leave',personnel:['cruz'],leaveTypeId:mat.id,startDate:'2027-01-11',endDate:'2027-01-15'});
 ok('a leave using it saves',usedLv.s===200);
 ok('the rename is stored on the leave type itself (leave records point to it by id)',(await adm('GET','/api/state')).state.leaveTypes.find(t=>t.id===mat.id).name==='Maternity / Paternity Leave');
 const deact=renamed.map(t=>t.id===mat.id?Object.assign({},t,{name:'Maternity / Paternity Leave',active:false}):t);
 ok('deactivate a leave type',(await adm('PUT','/api/leave-types',{value:deact})).s===200);
 ok('an inactive leave type cannot be chosen for a NEW leave',(await adm('POST','/api/schedules',{type:'leave',personnel:['salvador'],leaveTypeId:mat.id,startDate:'2027-02-01',endDate:'2027-02-02'})).s===400);
 ok('but an existing leave that already uses it can still be edited',(await adm('PUT','/api/schedules/'+usedLv.id,{type:'leave',personnel:['cruz'],leaveTypeId:mat.id,startDate:'2027-01-11',endDate:'2027-01-16'})).s===200);

 /* --- audit trail --- */
 const au=await adm('GET','/api/audit?q=Schedule');
 ok('schedule changes are in the audit log',au.rows.some(r=>r.action==='Schedule added')&&au.rows.some(r=>r.action==='Schedule updated')&&au.rows.some(r=>r.action==='Schedule deleted'));
 ok('a confirmed conflict is noted in the audit log',au.rows.some(r=>/confirming 1 conflict warning/.test(r.detail)));
 ok('leave type changes are in the audit log',(await adm('GET','/api/audit?q=leaveTypes')).rows.length>=3);

 /* --- backup / restore keeps schedules and leave types --- */
 const bk=await adm('GET','/api/admin/backup');
 ok('backup contains schedules and leave types',Array.isArray(bk.schedules)&&bk.schedules.length>0&&Array.isArray(bk.leaveTypes)&&bk.leaveTypes.length>=5);
 const n=bk.schedules.length;
 await adm('DELETE','/api/schedules/'+usedLv.id);
 ok('restore brings the schedules back',(await adm('POST','/api/admin/restore',bk)).s===200&&(await adm('GET','/api/state')).state.schedules.length===n);
 const olderBackup=Object.assign({},bk);delete olderBackup.schedules;delete olderBackup.leaveTypes;
 ok('restoring an older backup (no schedules) leaves current schedules alone and re-seeds leave types',(await adm('POST','/api/admin/restore',olderBackup)).s===200&&(await adm('GET','/api/state')).state.schedules.length===n&&(await adm('GET','/api/state')).state.leaveTypes.length===4);

 /* --- existing modules untouched --- */
 const fin=await adm('GET','/api/state');
 ok('documents, users and reference lists are still served',fin.state.docs.length>5&&fin.state.users.length>=18&&fin.state.refs.doc.length>5&&fin.state.refs.comm.length>=6);
 ok('no password hashes leaked in the state',!JSON.stringify(fin).includes('scrypt$'));
 console.log('\n'+pass+' passed, '+failn+' failed');process.exit(failn?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
