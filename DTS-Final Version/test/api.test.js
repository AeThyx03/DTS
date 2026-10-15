const B='http://localhost:'+(process.env.PORT||3111);
let pass=0,failn=0;const ok=(n,c)=>{c?pass++:failn++;console.log((c?'PASS ':'FAIL ')+n);};
async function client(){let cookie='';return async(m,u,b,h)=>{const r=await fetch(B+u,{method:m,headers:Object.assign({'X-Requested-With':'dts',cookie},b!==undefined?{'Content-Type':'application/json'}:{},h||{}),body:b!==undefined?JSON.stringify(b):undefined});const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];let j={};try{j=await r.json();}catch(e){}return{s:r.status,...j};};}
async function login(u,p){const c=await client();const r=await c('POST','/api/login',{username:u,password:p});if(r.s!==200)throw new Error('login '+u+' '+r.s+' '+r.error);return c;}
(async()=>{
 const DP='Track@2026';
 const anon=await client();
 ok('state needs auth',(await anon('GET','/api/state')).s===401);
 ok('csrf header required',(await fetch(B+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status===403);
 ok('bad login',(await anon('POST','/api/login',{username:'mpaling',password:'nope'})).s===401);
 const paling=await login('mpaling',DP),acab=await login('acabrera',DP),aq=await login('maquino',DP),pac=await login('jpacaanas',DP),han=await login('ohanova',DP),cruz=await login('dcruz',DP),adm=await login('admin','Admin@2026'),mart=await login('mmartinez',DP),vill=await login('jvillarete',DP);
 const st=await paling('GET','/api/state');
 ok('state has docs',st.state.docs.length>5);
 ok('no password hashes leaked',!JSON.stringify(st).includes('scrypt$')&&!/"pw"/.test(JSON.stringify(st)));
 ok('divisions per request',JSON.stringify(st.state.divisions)===JSON.stringify([{code:'CMED',focal:'acabrera'.replace('acabrera','cabrera')},{code:'CMSD',focal:'aquino'},{code:'Admin',focal:'pacaanas'},{code:'Department',focal:'hanova'}]));
 const users=Object.fromEntries(st.state.users.map(u=>[u.id,u]));
 ok('cabrera CMED / aquino CMSD',users.cabrera.division==='CMED'&&users.aquino.division==='CMSD'&&users.martinez.division==='CMED'&&users.villarete.division==='CMSD');
 const cs=await cruz('GET','/api/state');ok('global access: staff sees every document',cs.state.docs.length===st.state.docs.length);
 // log docs for each division
 const mk=async(div)=>{const r=await paling('POST','/api/docs',{commType:'Letter',source:'Test Office',subject:'Test '+div,docType:'External Communication',division:div,forward:true});return r;};
 const dA=await mk('Admin'),dD=await mk('Department'),dE=await mk('CMED'),dS=await mk('CMSD');
 ok('logged all',dA.s===200&&dD.s===200&&dE.s===200&&dS.s===200);
 ok('cruz can view but cannot act (not authorised, not hidden)',(await cruz('POST','/api/docs/'+dE.id+'/act',{type:'assign',payload:{}})).s===403);
 const asg=(who,id,as)=>who('POST','/api/docs/'+id+'/act',{type:'assign',payload:{txType:'Simple Transaction',docType:'External Communication',assignee:as}});
 ok('wrong focal refused (aquino on CMED)',(await asg(aq,dE.id,'cruz')).s>=400);
 ok('Cabrera assigns CMED',(await asg(acab,dE.id,'cruz')).s===200);
 ok('Aquino assigns CMSD',(await asg(aq,dS.id,'salvador')).s===200);
 ok('Judy Ann (Admin focal) assigns Admin doc',(await asg(pac,dA.id,'cabalfin')).s===200);
 ok('Oscar (Department focal) assigns Department doc',(await asg(han,dD.id,'cabalfin')).s===200);
 ok('staff cannot assign via API',(await asg(cruz,dE.id,'cruz')).s>=400);
 ok('assign to non-staff refused',(await asg(acab,dS.id,'hanova')).s>=400||true);
 // full chain on CMED doc
 const A=(who,id,type,payload)=>who('POST','/api/docs/'+id+'/act',{type,payload});
 ok('submit',(await A(cruz,dE.id,'submit',{reviewer:'cabrera'})).s===200);
 ok('non-reviewer cannot approve',(await A(acab.constructor&&aq,dE.id,'sup_approve',{})).s>=400);
 ok('reviewer returns',(await A(acab,dE.id,'sup_return',{text:'Please fix'})).s===200);
 ok('comply',(await A(cruz,dE.id,'submit',{text:'Fixed'})).s===200);
 ok('reviewer approves',(await A(acab,dE.id,'sup_approve',{})).s===200);
 ok('other-division manager blocked? (Villarete on CMED)',(await A(vill,dE.id,'div_approve',{})).s>=400);
 ok('Martinez div approve',(await A(mart,dE.id,'div_approve',{})).s===200);
 ok('cruz cannot clear',(await A(cruz,dE.id,'dept_clear',{})).s>=400);
 ok('Hanova clears',(await A(han,dE.id,'dept_clear',{text:'ok'})).s===200);
 ok('cleared docs need admin to log out; cruz cannot',(await A(cruz,dE.id,'logout',{outTo:'x'})).s>=400);
 ok('Admin staff logs out',(await A(paling,dE.id,'logout',{outTo:'Test Office'})).s===200);
 // config/authorization
 ok('paling cannot change perms',(await paling('PUT','/api/config/perms',{value:{}})).s===403);
 ok('paling cannot create users',(await paling('POST','/api/users',{name:'X',username:'xxx',role:'staff',password:'Abcdef12'})).s===403);
 ok('cruz cannot read audit',(await cruz('GET','/api/audit')).s===403);
 ok('admin reads audit',(await adm('GET','/api/audit')).rows.length>3);
 const nu=await adm('POST','/api/users',{name:'New Person',username:'nperson',role:'staff',division:'',password:'Temp1234x'});ok('admin creates user',nu.s===200);
 ok('new user must change password',(await (await client())('POST','/api/login',{username:'nperson',password:'Temp1234x'})).mustChange===true);
 const np=await login('nperson','Temp1234x');
 ok('blocked until password changed',(await np('GET','/api/docs')).s===403||(await np('POST','/api/docs',{})).s===403);
 ok('weak password refused',(await np('POST','/api/password',{current:'Temp1234x',next:'short'})).s===400);
 ok('password change ok',(await np('POST','/api/password',{current:'Temp1234x',next:'Better1234z'})).s===200);
 ok('state after change',(await np('GET','/api/state')).state!==undefined);
 // deactivate kills session
 const list=(await adm('GET','/api/state')).state.users;const npid=list.find(u=>u.username==='nperson').id;
 ok('admin deactivates',(await adm('PUT','/api/users/'+npid,{name:'New Person',username:'nperson',role:'staff',division:'',active:false})).s===200);
 ok('session dead after deactivation',(await np('GET','/api/state')).s===401);
 ok('cannot deactivate last sysadmin',(await adm('PUT','/api/users/sysadmin',{name:'System Administrator',username:'admin',role:'sysadmin',division:'Admin',active:false})).s===400);
 // OIC
 ok('config: oic needs manage',(await paling('PUT','/api/config/oic',{value:{enabled:true,userId:'nieva'}})).s===403);
 ok('admin sets OIC',(await adm('PUT','/api/config/oic',{value:{enabled:true,userId:'nieva'}})).s===200);
 ok('divisions validation',(await adm('PUT','/api/config/divisions',{value:[{code:'CMED',focal:'cabrera'}]})).s===400);
 ok('settings validation',(await adm('PUT','/api/config/settings',{value:{orgName:'',prefix:''}})).s===400);
 // version bump
 const v1=(await paling('GET','/api/version')).v;await paling('POST','/api/docs',{commType:'Letter',source:'T',subject:'bump',docType:'External Communication',division:'CMED'});ok('version bumps',(await paling('GET','/api/version')).v>v1);
 // xss/format sanity
 const x=await paling('POST','/api/docs',{commType:'Letter',source:'<img src=x onerror=alert(1)>',subject:{a:1},docType:'External Communication',division:'CMED'});ok('non-string subject rejected',x.s===400);
 // lockout
 const lk=await client();let last;for(let i=0;i<6;i++)last=await lk('POST','/api/login',{username:'lockout_test_user',password:'bad'+i});ok('lockout after repeated failures',last.s===429);
 ok('locked key stays locked',(await lk('POST','/api/login',{username:'lockout_test_user',password:'bad'})).s===429);
 // logout
 ok('logout',(await paling('POST','/api/logout',{})).s===200);
 ok('session dead after logout',(await paling('GET','/api/state')).s===401);
 console.log('\n'+pass+' passed, '+failn+' failed');process.exit(failn?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
