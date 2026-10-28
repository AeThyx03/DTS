/* Phase 9 - Personnel Schedule: adversarial tests. These try to BREAK the module.
   Run against a fresh DATA_DIR:
     SEED_DEMO=1 DATA_DIR=/tmp/t PORT=3111 node server.js &
     PORT=3111 node test/schedule.attack.test.js */
const B='http://localhost:'+(process.env.PORT||3111);
let pass=0,failn=0;const ok=(n,c)=>{c?pass++:failn++;console.log((c?'PASS ':'FAIL ')+n);};
async function client(){let cookie='';const f=async(m,u,b,raw,hdr)=>{const r=await fetch(B+u,{method:m,headers:Object.assign({'X-Requested-With':'dts',cookie},(b!==undefined||raw!==undefined)?{'Content-Type':'application/json'}:{},hdr||{}),body:raw!==undefined?raw:(b!==undefined?JSON.stringify(b):undefined)});const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];let j={};try{j=await r.json();}catch(e){}return Object.assign({s:r.status},j);};return f;}
async function login(u,p){const c=await client();const r=await c('POST','/api/login',{username:u,password:p});if(r.s!==200)throw new Error('login '+u+' '+r.s);return c;}
(async()=>{
 const adm=await login('admin','Admin@2026'),paling=await login('mpaling','Track@2026');
 const state=async()=>(await adm('GET','/api/state')).state;
 const lt=(await state()).leaveTypes;const VAC=lt[0].id;
 const base={type:'inspection',title:'T',project:'P',location:'',startDate:'2026-11-02',endDate:'2026-11-02',startTime:'08:00',endTime:'17:00',personnel:['bnieva'.replace('bnieva','nieva')]};
 const post=(o)=>adm('POST','/api/schedules',o);
 let day=2;const nextDay=()=>{day++;return '2026-12-'+String(day).padStart(2,'0');};   /* a fresh date each time so tests never collide */

 /* ---------- 1. malformed request bodies must never cause a 500 ---------- */
 for(const [label,raw] of [['null','null'],['array','[]'],['number','123'],['string','"hello"'],['true','true'],['empty object','{}']]){
  const r=await adm('POST','/api/schedules',undefined,raw);ok('body '+label+' -> clean 400 (not 500)',r.s===400);
 }
 ok('broken JSON -> 400',(await adm('POST','/api/schedules',undefined,'{bad')).s===400);
 ok('leave-types body null -> 400',(await adm('PUT','/api/leave-types',undefined,'null')).s===400);
 ok('leave-types body {} -> 400',(await adm('PUT','/api/leave-types',{})).s===400);
 ok('leave-types value is an object -> 400',(await adm('PUT','/api/leave-types',{value:{a:1}})).s===400);
 ok('leave-types with null entries -> 400',(await adm('PUT','/api/leave-types',{value:[null,1,'x']})).s===400);
 let big='reset';try{big=(await adm('POST','/api/schedules',{title:'x'.repeat(1000000)})).s;}catch(e){}
 ok('oversized body (1 MB) is refused or the connection is cut, never accepted or a 500',big==='reset'||[400,413].includes(big));
 ok('server still healthy after all that',(await fetch(B+'/healthz')).status===200);

 /* ---------- 2. wrong types in fields ---------- */
 const bad=async(o,label)=>{const r=await post(Object.assign({},base,o));ok(label,r.s===400);};
 await bad({personnel:'nieva'},'personnel as a string is refused');
 await bad({personnel:{a:1}},'personnel as an object is refused');
 await bad({personnel:[123,null,{}]},'personnel of non-strings is refused (they are dropped, none left)');
 await bad({title:12345},'title as a number is refused');
 await bad({title:['a']},'title as an array is refused');
 await bad({title:'   '},'whitespace-only title is refused');
 await bad({startDate:20261102},'date as a number is refused');
 await bad({startDate:'2026-02-30',endDate:'2026-02-30'},'impossible date 30 Feb refused');
 await bad({startDate:'2026-13-01',endDate:'2026-13-01'},'month 13 refused');
 await bad({startDate:'2026-1-5',endDate:'2026-1-5'},'non-padded date refused');
 await bad({startDate:'2026-11-02T08:00',endDate:'2026-11-02'},'date with a time attached refused');
 await bad({startDate:'0001-01-01',endDate:'0001-01-01'},'year 0001 refused');
 await bad({startTime:'24:00'},'time 24:00 refused');
 await bad({startTime:'8:00'},'unpadded time refused');
 await bad({startTime:'08:00:00'},'time with seconds refused');
 await bad({endTime:'12:60'},'minute 60 refused');
 await bad({startTime:'12:00',endTime:'12:00'},'zero-length time refused');
 await bad({project:'',location:''},'no project and no location refused');
 await bad({type:'Inspection'},'type is case-sensitive (unknown type refused)');
 await bad({type:['leave']},'type as an array refused');
 await bad({type:'__proto__'},'type __proto__ refused');
 ok('prototype pollution attempt in the body is harmless',(await adm('POST','/api/schedules',undefined,'{"__proto__":{"type":"leave"},"constructor":{"prototype":{"x":1}}}')).s===400&&({}).x===undefined);
 ok('leave: personnel as string refused',(await post({type:'leave',personnel:'nieva',leaveTypeId:VAC,startDate:'2026-11-02',endDate:'2026-11-02'})).s===400);
 ok('leave: leaveTypeId as an object refused',(await post({type:'leave',personnel:['nieva'],leaveTypeId:{a:1},startDate:'2026-11-02',endDate:'2026-11-02'})).s===400);
 ok('meeting: link with spaces refused',(await post({type:'meeting',title:'M',startDate:nextDay(),startTime:'09:00',endTime:'10:00',organizer:'nieva',personnel:[],link:'https://a b'})).s===400);
 ok('meeting: link ftp:// refused',(await post({type:'meeting',title:'M',startDate:nextDay(),startTime:'09:00',endTime:'10:00',organizer:'nieva',personnel:[],link:'ftp://x.com/a'})).s===400);
 ok('meeting: link data: URL refused',(await post({type:'meeting',title:'M',startDate:nextDay(),startTime:'09:00',endTime:'10:00',organizer:'nieva',personnel:[],link:'data:text/html,<script>1</script>'})).s===400);
 ok('meeting: link "https://" alone refused',(await post({type:'meeting',title:'M',startDate:nextDay(),startTime:'09:00',endTime:'10:00',organizer:'nieva',personnel:[],link:'https://'})).s===400);
 ok('meeting: organizer that is not a user refused',(await post({type:'meeting',title:'M',startDate:nextDay(),startTime:'09:00',endTime:'10:00',organizer:'ghost',personnel:[]})).s===400);

 /* ---------- 3. saving text: length limits and dedupe ---------- */
 const d1=nextDay();
 const long=await post(Object.assign({},base,{startDate:d1,endDate:d1,title:'x'.repeat(5000),remarks:'r'.repeat(9000),location:'l'.repeat(2000),personnel:['nieva','nieva','nieva','delrosario']}));
 ok('very long text is accepted but trimmed to the limits',long.s===200);
 const rec=(await state()).schedules.find(x=>x.id===long.id);
 ok('title cut to 200, remarks to 2000, location to 300',rec.title.length===200&&rec.remarks.length===2000&&rec.location.length===300);
 ok('duplicate personnel ids are stored once',rec.personnel.length===2);
 ok('HTML in text is stored as plain text (escaping happens on display)',(await(async()=>{const x=nextDay();return post(Object.assign({},base,{startDate:x,endDate:x,title:'<img src=x onerror=alert(1)>',personnel:['torino']}));})()).s===200);

 /* ---------- 4. overlap rules: boundaries ---------- */
 const P=['tabilas'];const e=(o)=>Object.assign({},base,{personnel:P},o);
 const dd=nextDay();
 ok('setup: 08:00-12:00 saved',(await post(e({title:'A',startDate:dd,endDate:dd,startTime:'08:00',endTime:'12:00'}))).s===200);
 ok('back-to-back 12:00-17:00 is NOT a conflict',(await post(e({title:'B',startDate:dd,endDate:dd,startTime:'12:00',endTime:'17:00'}))).s===200);
 const r1=await post(e({title:'C',startDate:dd,endDate:dd,startTime:'11:59',endTime:'12:01'}));
 ok('one minute of overlap IS a conflict (against both neighbours)',r1.s===409&&r1.conflicts.length===2);
 ok('a whole-day-covering 00:00-23:59 window overlaps both',(await post(e({title:'D',startDate:dd,endDate:dd,startTime:'00:00',endTime:'23:59'}))).conflicts.length===2);
 ok('a different person at the same time is NOT a conflict',(await post(e({title:'E',startDate:dd,endDate:dd,startTime:'08:00',endTime:'12:00',personnel:['cabalfin']}))).s===200);
 const d3=nextDay(),d4=(()=>{day++;return '2026-12-'+String(day).padStart(2,'0');})();
 ok('setup: multi-day inspection covers two days',(await post(e({title:'M1',startDate:d3,endDate:d4}))).s===200);
 ok('a meeting on its second day is flagged',(await post(e({type:'meeting',title:'M2',startDate:d4,endDate:d4,startTime:'10:00',endTime:'11:00',organizer:'',personnel:P}))).s===409);
 const d5=nextDay();
 ok('the day after the multi-day inspection is free',(await post(e({title:'M3',startDate:d5,endDate:d5}))).s===200);
 /* leave vs leave */
 const l0=nextDay(),l1=nextDay(),l2=nextDay();
 ok('setup: leave one day',(await post({type:'leave',personnel:['cruz'],leaveTypeId:VAC,startDate:l0,endDate:l1})).s===200);
 const ll=await post({type:'leave',personnel:['cruz'],leaveTypeId:VAC,startDate:l1,endDate:l2});
 ok('overlapping leave for the same person is flagged (shares one day)',ll.s===409&&/already has Vacation Leave that overlaps this leave/.test(ll.conflicts[0].message));
 ok('leave starting the day after the previous one ends is fine',(await post({type:'leave',personnel:['cruz'],leaveTypeId:VAC,startDate:l2,endDate:l2})).s===200);
 /* organizer counts as a person on the meeting */
 const dO=nextDay();
 ok('setup: inspection for cabrera',(await post(e({title:'IO',startDate:dO,endDate:dO,personnel:['cabrera']}))).s===200);
 ok('a meeting where the person is ONLY the organizer conflicts with their inspection',(await post({type:'meeting',title:'MO',startDate:dO,endDate:dO,startTime:'09:00',endTime:'10:00',organizer:'cabrera',personnel:[]})).s===409);
 /* two people in conflict -> one line each */
 const dT=nextDay();
 await post(e({title:'X1',startDate:dT,endDate:dT,personnel:['salvador','tanguilig']}));
 const two=await post(e({type:'meeting',title:'X2',startDate:dT,endDate:dT,startTime:'09:00',endTime:'10:00',organizer:'',personnel:['salvador','tanguilig','cabalfin']}));
 ok('two people clashing give one warning line each (and the third, free, none)',two.s===409&&two.conflicts.length===2&&!two.conflicts.some(c=>c.userId==='cabalfin'));

 /* ---------- 5. edits: no self-conflict, no type change, conflicts on edit ---------- */
 const dE=nextDay();const ed=await post(e({title:'EDIT',startDate:dE,endDate:dE,personnel:['aprochevado']}));
 ok('an unchanged re-save does not clash with itself',(await adm('PUT','/api/schedules/'+ed.id,e({title:'EDIT',startDate:dE,endDate:dE,personnel:['aprochevado']}))).s===200);
 ok('editing time inside its own old window is fine',(await adm('PUT','/api/schedules/'+ed.id,e({title:'EDIT',startDate:dE,endDate:dE,startTime:'09:00',endTime:'10:00',personnel:['aprochevado']}))).s===200);
 ok('PUT to an id that does not exist is 404',(await adm('PUT','/api/schedules/doesnotexist',e({}))).s===404);
 ok('PUT with a broken body on a real id is 400, and the record is unchanged',(await adm('PUT','/api/schedules/'+ed.id,undefined,'null')).s===400&&(await state()).schedules.find(x=>x.id===ed.id).title==='EDIT');
 ok('DELETE twice: second is 404',(await adm('DELETE','/api/schedules/'+ed.id)).s===200&&(await adm('DELETE','/api/schedules/'+ed.id)).s===404);

 /* ---------- 6. inactive users ---------- */
 const dI=nextDay();const keep=await post(e({title:'KEEP',startDate:dI,endDate:dI,personnel:['torino']}));
 const users=(await state()).users;const t=users.find(x=>x.id==='torino');
 ok('deactivate a user who has a schedule',(await adm('PUT','/api/users/torino',{name:t.name,username:'rtorino',role:t.role,division:t.division,active:false})).s===200);
 const inact=await(async()=>{const x=nextDay();return post(e({title:'NEW',startDate:x,endDate:x,personnel:['torino']}));})();
 ok('a NEW schedule cannot use an inactive user (and the message says why)',inact.s===400&&/active user list/.test(inact.error));
 ok('an existing schedule with that user can still be edited (they stay on it)',(await adm('PUT','/api/schedules/'+keep.id,e({title:'KEEP2',startDate:dI,endDate:dI,personnel:['torino']}))).s===200);
 ok('their old schedule still exists and still shows in conflicts',(await post(e({type:'meeting',title:'ZZ',startDate:dI,endDate:dI,startTime:'09:00',endTime:'10:00',organizer:'',personnel:['nieva']}))).s===200);
 await adm('PUT','/api/users/torino',{name:t.name,username:'rtorino',role:t.role,division:t.division,active:true});

 /* ---------- 7. permissions and sessions ---------- */
 const anon=await client();
 ok('not signed in: add refused (401)',(await anon('POST','/api/schedules',base)).s===401);
 ok('not signed in: delete refused (401)',(await anon('DELETE','/api/schedules/x')).s===401);
 ok('not signed in: leave types refused (401)',(await anon('PUT','/api/leave-types',{value:[]})).s===401);
 ok('missing CSRF header: refused (403)',(await fetch(B+'/api/schedules/x',{method:'DELETE'})).status===403);
 ok('a plain user cannot add / edit / delete',(await paling('POST','/api/schedules',base)).s===403&&(await paling('PUT','/api/schedules/'+keep.id,base)).s===403&&(await paling('DELETE','/api/schedules/'+keep.id)).s===403);
 ok('a plain user cannot use the permission by putting it in the request',(await paling('POST','/api/schedules',Object.assign({},base,{permissions:['schedule.manage'],role:'sysadmin'}))).s===403);
 ok('unsupported method gives 404, not a crash',(await adm('PATCH','/api/schedules/'+keep.id,base)).s===404);
 ok('GET on the schedule collection is not an API (404)',(await adm('GET','/api/schedules')).s===404);
 ok('a schedule id with odd characters is 404',(await adm('DELETE','/api/schedules/..%2F..%2Fetc')).s===404);
 ok('the permission cannot be granted by editing your own role unless you can manage roles',(await paling('PUT','/api/config/perms',{value:{}})).s===403);

 /* ---------- 8. change detection so other users see updates ---------- */
 const v0=(await adm('GET','/api/version')).v;const dV=nextDay();
 const vr=await post(e({title:'VER',startDate:dV,endDate:dV,personnel:['aprochevado']}));
 const v1=(await adm('GET','/api/version')).v;
 await adm('DELETE','/api/schedules/'+vr.id);const v2=(await adm('GET','/api/version')).v;
 ok('the state version changes on add and on delete (so other screens refresh)',v1!==v0&&v2!==v1);
 ok('another user sees the schedule in their state',(await paling('GET','/api/state')).state.schedules.some(x=>x.title==='KEEP2'));

 /* ---------- 9. concurrency ---------- */
 const dC=nextDay();
 const many=await Promise.all(Array.from({length:25},(_,i)=>post(e({title:'C'+i,startDate:dC,endDate:dC,startTime:'08:00',endTime:'09:00',personnel:['delrosario'],project:'P'+i}))));
 const saved=many.filter(r=>r.s===200),ids=new Set(saved.map(r=>r.id));
 ok('25 simultaneous adds: none crash, all answered 200 or 409',many.every(r=>r.s===200||r.s===409));
 ok('all saved records have unique ids',ids.size===saved.length);
 /* the requests run one after another on the server, so of 25 identical time slots for one person exactly one can win */
 ok('only ONE of the identical simultaneous bookings for the same person was accepted (the rest were flagged)',saved.length===1&&many.filter(r=>r.s===409).length===24);
 const many2=await Promise.all(Array.from({length:25},(_,i)=>post(e({title:'D'+i,startDate:dC,endDate:dC,startTime:'08:00',endTime:'09:00',personnel:['delrosario'],confirm:true}))));
 ok('the same 25 with confirm=true are all saved (allowed on purpose)',many2.every(r=>r.s===200));
 ok('deleting them all leaves the rest untouched',(await Promise.all([...saved,...many2].map(r=>adm('DELETE','/api/schedules/'+r.id)))).every(r=>r.s===200));

 /* ---------- 10. leave types ---------- */
 const cur=(await state()).leaveTypes;
 ok('101 leave types refused',(await adm('PUT','/api/leave-types',{value:Array.from({length:101},(_,i)=>({name:'LT'+i}))})).s===400);
 ok('case-insensitive duplicate refused',(await adm('PUT','/api/leave-types',{value:cur.concat([{name:'VACATION LEAVE'}])})).s===400);
 ok('a name of only spaces refused',(await adm('PUT','/api/leave-types',{value:cur.concat([{name:'    '}])})).s===400);
 ok('a client cannot invent an id for a new type (the server issues it)',(await adm('PUT','/api/leave-types',{value:cur.concat([{id:'hacked',name:'Study Leave'}])})).s===200&&!(await state()).leaveTypes.some(x=>x.id==='hacked'));
 ok('a name of 500 characters is trimmed to 100',(await adm('PUT','/api/leave-types',{value:(await state()).leaveTypes.concat([{name:'Z'.repeat(500)}])})).s===200&&(await state()).leaveTypes.some(x=>x.name==='Z'.repeat(100)));
 ok('deactivating every leave type is allowed (then leave cannot be added, and says why)',(await adm('PUT','/api/leave-types',{value:(await state()).leaveTypes.map(x=>Object.assign({},x,{active:false}))})).s===200&&(await post({type:'leave',personnel:['cruz'],leaveTypeId:VAC,startDate:nextDay(),endDate:day&&'2026-12-31'})).s===400);
 await adm('PUT','/api/leave-types',{value:(await state()).leaveTypes.map(x=>Object.assign({},x,{active:true}))});

 /* ---------- 11. backup / restore with damaged data ---------- */
 const bk=await adm('GET','/api/admin/backup');const goodCount=bk.schedules.length;
 const dirty=Object.assign({},bk,{schedules:bk.schedules.concat([null,1,'x',{},{id:'a',type:'leave'},{id:'b',type:'meeting',startDate:'2026-01-01',endDate:'2026-01-01',personnel:'no'},{id:'c',type:'inspection',startDate:'2026-05-05',endDate:'2026-05-01',personnel:[],startTime:'08:00',endTime:'09:00'},{id:'d',type:'inspection',startDate:'2026-05-05',endDate:'2026-05-05',personnel:[],startTime:'10:00',endTime:'09:00'},{id:'e',type:'party',startDate:'2026-05-05',endDate:'2026-05-05',personnel:[]}])});
 const beforeRestore=JSON.stringify(await state());
 ok('restore with damaged schedule rows is rejected',(await adm('POST','/api/admin/restore',dirty)).s===400);
 ok('rejected restore preserves all current state',JSON.stringify(await state())===beforeRestore);
 ok('every kept schedule has all its text fields (no undefined for the screen)',(await state()).schedules.every(x=>['title','project','location','remarks','link','organizer','leaveTypeId'].every(k=>typeof x[k]==='string')&&Array.isArray(x.personnel)));
 ok('restore with schedules = "oops" rejects the backup and leaves current schedules alone',(await adm('POST','/api/admin/restore',Object.assign({},bk,{schedules:'oops'}))).s===400&&(await state()).schedules.length===goodCount);
 ok('users, documents and reference lists survive all restores',(await state()).docs.length>5&&(await state()).users.length>=18);

 /* ---------- 12. audit ---------- */
 const au=await adm('GET','/api/audit?q=Schedule');
 ok('audit shows who did what, without exposing anything sensitive',au.rows.length>10&&au.rows.every(r=>!/scrypt|password/i.test(r.detail)));
 console.log('\n'+pass+' passed, '+failn+' failed');process.exit(failn?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
