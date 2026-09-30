const B='http://localhost:'+(process.env.PORT||3111);
let pass=0,failn=0;const ok=(n,c)=>{c?pass++:failn++;console.log((c?'PASS ':'FAIL ')+n);};
async function client(){let cookie='';return async(m,u,b,h)=>{const r=await fetch(B+u,{method:m,headers:Object.assign({'X-Requested-With':'dts',cookie},b!==undefined?{'Content-Type':'application/json'}:{},h||{}),body:b!==undefined?JSON.stringify(b):undefined});const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];let j={};try{j=await r.json();}catch(e){}return{s:r.status,...j};};}
async function login(u,p){const c=await client();const r=await c('POST','/api/login',{username:u,password:p});if(r.s!==200)throw new Error('login '+u+' '+r.s+' '+r.error);return c;}
(async()=>{
 const DP='Track@2026';
 const paling=await login('mpaling',DP),acab=await login('acabrera',DP),cruz=await login('dcruz',DP),tabilas=await login('mtabilas',DP),torino=await login('rtorino',DP),
       delrosario=await login('adelrosario',DP),salvador=await login('jsalvador',DP),cabalfin=await login('bcabalfin',DP),mart=await login('mmartinez',DP),
       han=await login('ohanova',DP),villarete=await login('jvillarete',DP),nieva=await login('bnieva',DP),mojica=await login('rmojica',DP),adm=await login('admin','Admin@2026');

 // ---- Global access: staff can view (GET state includes) a doc they have nothing to do with
 const st=await cruz('GET','/api/state');
 ok('global access: cruz state includes every doc',st.state.docs.length>10);

 // ---- For-info restriction
 const mk=async(who,div)=>who('POST','/api/docs',{commType:'Memorandum',source:'HQ',subject:'For info test',docType:'For staff reference',division:div,forward:true});
 const d1=await mk(paling,'CMED');
 ok('for-info doc logged',d1.s===200);
 const asg=(who,id,as,tx)=>who('POST','/api/docs/'+id+'/act',{type:'assign',payload:{txType:tx||'For information only',docType:'For staff reference',assignee:as}});
 ok('for-info: cannot assign to staff',(await asg(acab,d1.id,'cabalfin')).s===400);
 ok('for-info: can assign to a Division Focal',(await asg(acab,d1.id,'cabrera')).s===200);
 const d2=await mk(paling,'CMED');
 ok('non-for-info: staff assignment fine',(await asg(acab,d2.id,'cabalfin','Simple Transaction')).s===200);

 // ---- Routing override rules: once assigned, dept manager / div manager / any supervisor can reassign
 ok('supervisor (unrelated, Nieva) can reassign after assignment',(await nieva('POST','/api/docs/'+d2.id+'/act',{type:'reassign',payload:{assignee:'tanguilig'}})).s===200);
 ok('division manager can reassign',(await mart('POST','/api/docs/'+d2.id+'/act',{type:'reassign',payload:{assignee:'cabalfin'}})).s===200);
 ok('department manager can reassign',(await han('POST','/api/docs/'+d2.id+'/act',{type:'reassign',payload:{assignee:'tanguilig'}})).s===200);
 ok('random staff cannot reassign',(await cruz('POST','/api/docs/'+d2.id+'/act',{type:'reassign',payload:{assignee:'cabalfin'}})).s===403||(await cruz('POST','/api/docs/'+d2.id+'/act',{type:'reassign',payload:{assignee:'cabalfin'}})).s===400);

 // ---- Personnel hierarchy: default reviewer suggestion isn't enforced server-side beyond validity, but supervisor chain reviewer must be an active supervisor/focal
 const d3=await mk(paling,'CMED');
 await asg(acab,d3.id,'salvador','Simple Transaction');
 ok('salvador submits to his supervisor (torino)',(await salvador('POST','/api/docs/'+d3.id+'/act',{type:'submit',payload:{reviewer:'torino'}})).s===200);
 ok('torino (supervisor) can approve as reviewer',(await torino('POST','/api/docs/'+d3.id+'/act',{type:'sup_approve',payload:{}})).s===200);

 // ---- CMED region-scope on the client's regionScope logic (server exposes full designations; scoping is client-side) -- verify server still returns all designations to everyone (no server-side restriction), consistent with global-access design
 const desAll=await cruz('GET','/api/state');
 ok('designations list is not filtered server-side (client applies the region scope)',desAll.state.designations.length>=25);

 console.log('\n'+pass+' passed, '+failn+' failed');process.exit(failn?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
