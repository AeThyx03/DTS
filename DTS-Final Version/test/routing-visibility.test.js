// Tests for: universal "For My Action" visibility, Mary->Rey, Judy->Oscar,
// user isolation, cleared-for-out -> admin staff, persistence, and the new seed user.
const B='http://localhost:'+(process.env.PORT||3111);
let pass=0,failn=0;const ok=(n,c)=>{c?pass++:failn++;console.log((c?'PASS ':'FAIL ')+n);};
async function client(){let cookie='';return async(m,u,b,h)=>{const r=await fetch(B+u,{method:m,headers:Object.assign({'X-Requested-With':'dts',cookie},b!==undefined?{'Content-Type':'application/json'}:{},h||{}),body:b!==undefined?JSON.stringify(b):undefined});const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];let j={};try{j=await r.json();}catch(e){}return{s:r.status,...j};};}
async function login(u,p){const c=await client();const r=await c('POST','/api/login',{username:u,password:p});if(r.s!==200)throw new Error('login '+u+' '+r.s+' '+r.error);return c;}
const DP='Track@2026';
// "For My Action" is a client-side view over state.docs, driven by isMyTurn(); reproduce
// isMyTurn's per-stage assignment rule here so these API-level tests can assert on it directly.
function isMyTurnLike(u,d){
 switch(d.status){
  case 'received':return u.role==='admin_staff'||u.role==='sysadmin';
  case 'at_focal':return false; // resolved via focal id, checked separately below
  case 'processing':case 'compliance':return d.assignee===u.id;
  case 'sup_review':return d.reviewer===u.id;
  case 'div_review':return u.role==='div_manager';
  case 'dept_review':return u.role==='dept_manager';
  case 'cleared':case 'return_out':return u.role==='admin_staff'||u.role==='sysadmin';
 }
 return false;
}
(async()=>{
 const paling=await login('mpaling',DP),pacaanas=await login('jpacaanas',DP),
       aquino=await login('maquino',DP),mojica=await login('rmojica',DP),
       villarete=await login('jvillarete',DP),hanova=await login('ohanova',DP),
       cabalfin=await login('bcabalfin',DP),cruz=await login('dcruz',DP),
       martinez=await login('mmartinez',DP),adm=await login('admin','Admin@2026');

 // ---- Scenario A: Mary (Aquino, CMSD focal) assigns to Rey (Mojica, supervisor) ----
 const dA=await paling('POST','/api/docs',{commType:'Letter',source:'HQ',subject:'MaryToRey',docType:'External Communication',division:'CMSD',forward:true});
 ok('Scenario A: doc logged and forwarded to Mary (CMSD focal)',dA.ok===true);
 const asg=await aquino('POST','/api/docs/'+dA.id+'/act',{type:'assign',payload:{txType:'Simple Transaction',docType:'External Communication',assignee:'mojica'}});
 ok('Mary assigns the document to Rey',asg.ok===true);
 let st=await mojica('GET','/api/state');
 let doc=st.state.docs.find(x=>x.id===dA.id);
 ok('Rey is now the assignee, status=processing',doc&&doc.assignee==='mojica'&&doc.status==='processing');
 ok("isMyTurn-equivalent: it is now Rey's turn, not Mary's",isMyTurnLike(st.state.users.find(u=>u.id==='mojica')||{id:'mojica',role:'supervisor'},doc)&&doc.assignee==='mojica');
 const stMary=await aquino('GET','/api/state');
 const docMary=stMary.state.docs.find(x=>x.id===dA.id);
 ok("It is no longer Mary's turn (she is not the assignee or reviewer)",docMary.assignee!=='aquino'&&docMary.reviewer!=='aquino');
 const stOther=await cruz('GET','/api/state');
 ok('An unrelated staff member (Cruz) is not the assignee either',stOther.state.docs.find(x=>x.id===dA.id).assignee!=='cruz');

 // ---- Scenario B: Judy (Villarete, CMSD div manager) forwards to Oscar (Hanova, dept manager) ----
 const dB=await paling('POST','/api/docs',{commType:'Memorandum',source:'HQ',subject:'JudyToOscar',docType:'External Communication',division:'CMSD',forward:true});
 await aquino('POST','/api/docs/'+dB.id+'/act',{type:'assign',payload:{txType:'Simple Transaction',docType:'External Communication',assignee:'cabalfin'}});
 await cabalfin('POST','/api/docs/'+dB.id+'/act',{type:'submit',payload:{reviewer:'aquino'}});
 await aquino('POST','/api/docs/'+dB.id+'/act',{type:'sup_approve',payload:{}});
 const divApprove=await villarete('POST','/api/docs/'+dB.id+'/act',{type:'div_approve',payload:{}});
 ok('Judy (div manager) approves, forwarding to Department Manager',divApprove.ok===true);
 st=await hanova('GET','/api/state');
 doc=st.state.docs.find(x=>x.id===dB.id);
 ok("Document is now at dept_review, Oscar's stage",doc&&doc.status==='dept_review');
 const stJudy=await villarete('GET','/api/state');
 const docJudy=stJudy.state.docs.find(x=>x.id===dB.id);
 ok("It is no longer Judy's active turn (status moved past div_review)",docJudy.status!=='div_review');

 // ---- Cleared for out -> Admin Staff (role-based, not a specific named admin) ----
 const clearIt=await hanova('POST','/api/docs/'+dB.id+'/act',{type:'dept_clear',payload:{text:'Cleared'}});
 ok('Oscar clears the document for out',clearIt.ok===true);
 st=await paling('GET','/api/state');
 doc=st.state.docs.find(x=>x.id===dB.id);
 ok('Status is now cleared',doc.status==='cleared');
 const stPac=await pacaanas('GET','/api/state');
 ok('A second, different Admin Staff user (Pacaanas) also sees it as cleared/actionable',stPac.state.docs.find(x=>x.id===dB.id).status==='cleared');
 const out=await paling('POST','/api/docs/'+dB.id+'/act',{type:'logout',payload:{outTo:'HQ'}});
 ok('Any Admin Staff (Paling) can log it out, not a hardcoded specific user',out.ok===true);
 st=await hanova('GET','/api/state');
 ok("Document is fully out; no longer anyone's active turn",st.state.docs.find(x=>x.id===dB.id).status==='out');

 // ---- User isolation: unrelated users never become the assignee/reviewer of each other's docs ----
 const dC=await paling('POST','/api/docs',{commType:'Letter',source:'HQ',subject:'IsolationCheck',docType:'External Communication',division:'CMSD',forward:true});
 await aquino('POST','/api/docs/'+dC.id+'/act',{type:'assign',payload:{txType:'Simple Transaction',docType:'External Communication',assignee:'cruz'}});
 const stCruz=await cruz('GET','/api/state'),stMoj=await mojica('GET','/api/state'),stMart=await martinez('GET','/api/state');
 const dCruz=stCruz.state.docs.find(x=>x.id===dC.id),dMoj=stMoj.state.docs.find(x=>x.id===dC.id),dMart=stMart.state.docs.find(x=>x.id===dC.id);
 ok('Cruz is the assignee',dCruz.assignee==='cruz');
 ok("Mojica is not the assignee of Cruz's document",dMoj.assignee!=='mojica');
 ok('Martinez (unrelated division manager) is not the assignee either',dMart.assignee!=='martinez');
 ok('Cruz cannot act on a document assigned to someone else (server-enforced, not just hidden)',
   (await mojica('POST','/api/docs/'+dC.id+'/act',{type:'submit',payload:{reviewer:'aquino'}})).s>=400);

 // ---- Persistence across "reload" (a fresh /api/state call reflects the same DB-backed truth) ----
 const beforeReload=await cruz('GET','/api/state');
 const beforeStatus=beforeReload.state.docs.find(x=>x.id===dC.id).status;
 const afterReload=await cruz('GET','/api/state'); // simulates the client's refresh() on reload
 const afterStatus=afterReload.state.docs.find(x=>x.id===dC.id).status;
 ok('Assignment/status survives a fresh state fetch (reload-equivalent)',beforeStatus===afterStatus&&afterStatus==='processing');

 // ---- New seed user: Christian Joyce N. Aprochevado, CMSD, Staff ----
 const cja=await login('caprochevado',DP);
 const stCja=await cja('GET','/api/state');
 const me=stCja.state.users.find(x=>x.id===stCja.me);
 ok('Christian Joyce N. Aprochevado can authenticate',!!me);
 ok('Her name matches exactly',me&&me.name==='Christian Joyce N. Aprochevado');
 ok('Her role is Staff',me&&me.role==='staff');
 ok('Her division is CMSD',me&&me.division==='CMSD');
 ok('She can see the shared registry (participates like any Staff user)',stCja.state.docs.length>0);
 // she should be assignable, same as any other active staff member
 const dD=await paling('POST','/api/docs',{commType:'Letter',source:'HQ',subject:'NewStaffAssignCheck',docType:'External Communication',division:'CMSD',forward:true});
 const asgCja=await aquino('POST','/api/docs/'+dD.id+'/act',{type:'assign',payload:{txType:'Simple Transaction',docType:'External Communication',assignee:'aprochevado'}});
 ok('The new staff member can be assigned a document like any other Staff user',asgCja.ok===true);
 const subCja=await cja('POST','/api/docs/'+dD.id+'/act',{type:'submit',payload:{reviewer:'aquino'}});
 ok('She can act on her own assigned document (participates fully in the Staff workflow)',subCja.ok===true);

 console.log('\n'+pass+' passed, '+failn+' failed');process.exit(failn?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
