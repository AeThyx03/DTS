/* Phase 10: Draft/Revised File URLs for every document type.
   Run against a fresh demo server: SEED_DEMO=1 DATA_DIR=/tmp/t PORT=3111 node server.js & */
const B='http://localhost:'+(process.env.PORT||3111);
let pass=0,failn=0;const ok=(n,c)=>{c?pass++:failn++;console.log((c?'PASS ':'FAIL ')+n);};
async function client(){let cookie='';return async(m,u,b)=>{const r=await fetch(B+u,{method:m,headers:Object.assign({'X-Requested-With':'dts',cookie},b!==undefined?{'Content-Type':'application/json'}:{}),body:b!==undefined?JSON.stringify(b):undefined});const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];let j={};try{j=await r.json();}catch(e){}return Object.assign({s:r.status},j);};}
async function login(u,p){const c=await client();const r=await c('POST','/api/login',{username:u,password:p});if(r.s!==200)throw new Error('login '+u+' '+r.s);return c;}
(async()=>{
 const adm=await login('admin','Admin@2026'),paling=await login('mpaling','Track@2026'),nieva=await login('bnieva','Track@2026');
 const docs=async()=>(((await adm('GET','/api/state')).state||{}).docs||[]);
 const find=async(subj)=>(await docs()).find(d=>d.subject===subj);
 const mk=async(subj,docType)=>{await paling('POST','/api/docs',{commType:'Letter',source:'P10 Office',subject:subj,docType,division:'CMED',forward:true});return find(subj);};
 const set=(id,p,c)=>(c||adm)('POST','/api/docs/'+id+'/act',{type:'set_urls',payload:p});
 const G='https://drive.google.com/file/d/abc/view',S='https://contoso.sharepoint.com/sites/x/doc.docx';

 // Test 2: existing non-CMR type; Test 3: newly created type
 const a=await mk('P10 memo','External Communication'),cp=await mk('P10 cpes','CPES');
 ok('docs created for two non-CMR types',!!a&&!!cp);
 ok('new records start with empty draft/revised fields',a.draftUrl===''&&a.revUrl==='');
 ok('External Communication: draft+revised saved',(await set(a.id,{draftUrl:G,revUrl:S})).s===200);
 let x=await find('P10 memo');ok('External Communication: values persisted',x.draftUrl===G&&x.revUrl===S);
 const refs=(await adm('GET','/api/state')).state.refs;refs.doc.push({name:'P10 New Type',description:'',threshold:5,unit:'working_days',basis:'working_days',active:true});
 ok('new document type created (reference list)',(await adm('PUT','/api/config/refs',{value:refs})).s===200);
 const nd=await mk('P10 newtype','P10 New Type');
 ok('doc of the new type created',!!nd);
 if(nd){ok('newly created type: draft+revised saved',(await set(nd.id,{draftUrl:G,revUrl:S})).s===200);x=await find('P10 newtype');ok('newly created type: values persisted',x.draftUrl===G&&x.revUrl===S);}

 // Tests 4-6: draft only, revised only, neither
 ok('draft only saves',(await set(cp.id,{draftUrl:G})).s===200);
 x=await find('P10 cpes');ok('draft only: revised stays empty',x.draftUrl===G&&x.revUrl==='');
 ok('remove draft (empty string) saves',(await set(cp.id,{draftUrl:''})).s===200);
 ok('revised only saves',(await set(cp.id,{revUrl:S})).s===200);
 x=await find('P10 cpes');ok('revised only: draft empty',x.draftUrl===''&&x.revUrl===S);
 ok('neither: clear both',(await set(cp.id,{draftUrl:'',revUrl:''})).s===200);
 x=await find('P10 cpes');ok('neither: both empty, record intact',x.draftUrl===''&&x.revUrl===''&&x.subject==='P10 cpes');

 // validation
 ok('malformed draft URL rejected',(await set(a.id,{draftUrl:'not-a-url'})).s===400);
 ok('javascript: URL rejected',(await set(a.id,{revUrl:'javascript:alert(1)'})).s===400);
 x=await find('P10 memo');ok('rejected values did not overwrite',x.draftUrl===G&&x.revUrl===S);

 // permissions: view-only / non-involved staff cannot modify
 ok('non-authorised user cannot modify links',(await set(a.id,{draftUrl:'https://evil.example.com'},nieva)).s!==200);
 x=await find('P10 memo');ok('unauthorised attempt left values unchanged',x.draftUrl===G);

 // create with URLs, edit them, and validation on create/edit
 const cr=await paling('POST','/api/docs',{commType:'Letter',source:'P10',subject:'P10 created',docType:'Internal Request',division:'CMED',draftUrl:G,revUrl:''});
 ok('create with draft URL only',cr.s===200);x=await find('P10 created');ok('created record keeps draft, empty revised',x&&x.draftUrl===G&&x.revUrl==='');
 ok('create with bad URL rejected',(await paling('POST','/api/docs',{commType:'Letter',source:'P10',subject:'P10 bad',docType:'Internal Request',division:'CMED',draftUrl:'ftp://x'})).s===400);
 ok('edit action rejects bad URL',(await adm('POST','/api/docs/'+x.id+'/act',{type:'edit',payload:{subject:'P10 created',draftUrl:'nope'}})).s===400);
 ok('edit action updates and removes links',(await adm('POST','/api/docs/'+x.id+'/act',{type:'edit',payload:{subject:'P10 created',draftUrl:'',revUrl:S}})).s===200);
 x=await find('P10 created');ok('edit result: draft removed, revised set',x.draftUrl===''&&x.revUrl===S);

 // Test 1: Consolidated CMR and PPR unchanged
 const reg=(await docs()).find(d=>d.docType==='Consolidated CMR and PPR');
 ok('CMR/PPR record exists',!!reg);
 if(reg){const before={p:reg.reportingPeriod,dueAt:reg.dueAt,region:reg.region};
  ok('CMR/PPR: draft+revised saved',(await set(reg.id,{draftUrl:G,revUrl:S})).s===200);
  const r2=(await docs()).find(d=>d.id===reg.id);
  ok('CMR/PPR: URLs persisted',r2.draftUrl===G&&r2.revUrl===S);
  ok('CMR/PPR: reporting period, region and deadline untouched',r2.reportingPeriod===before.p&&r2.dueAt===before.dueAt&&r2.region===before.region);}
 console.log('\n'+pass+' passed, '+failn+' failed');process.exit(failn?1:0);
})().catch(e=>{console.log('ERR',e);process.exit(1);});
