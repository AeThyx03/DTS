'use strict';
// Use only with a fresh SEED_DEMO server and an isolated DATA_DIR.
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:' + (process.env.PORT || 3130);
async function client(username) {
  let cookie = '';
  const request = async (method, url, body) => {
    const response = await fetch(base + url, { method, headers: { cookie, 'Content-Type': 'application/json', 'X-Requested-With': 'dts' }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    const data = await response.json();
    assert.ok(response.ok, url + ': ' + JSON.stringify(data));
    return data;
  };
  await request('POST', '/api/login', { username, password: username === 'admin' ? 'Admin@2026' : 'Track@2026' });
  return request;
}
(async () => {
  const admin = await client('admin'), logger = await client('mpaling'), focal = await client('acabrera'), staff = await client('dcruz'), manager = await client('mmartinez'), department = await client('ohanova');
  const stages = ['received', 'at_focal', 'processing', 'compliance', 'sup_review', 'div_review', 'dept_review', 'cleared', 'out'];
  const documents = [];
  for (const stage of stages) {
    const result = await logger('POST', '/api/docs', { commType: 'Letter', source: 'Mock Regional Office', refNo: 'MOCK-' + stage.toUpperCase(), subject: 'MOCK — Inspection correspondence — ' + stage, docType: 'External Communication', division: 'CMED', priority: stage === 'compliance' ? 'Urgent' : 'Normal', remarks: 'Synthetic record for workflow testing', forward: stage !== 'received' });
    const id = result.id;
    const action = (who, type, payload = {}) => who('POST', '/api/docs/' + id + '/act', { type, payload });
    if (!['received', 'at_focal'].includes(stage)) await action(focal, 'assign', { txType: 'Simple Transaction', docType: 'External Communication', assignee: 'cruz' });
    if (!['received', 'at_focal', 'processing'].includes(stage)) await action(staff, 'submit', { reviewer: 'cabrera', text: 'Mock draft ready for review' });
    if (stage === 'compliance') await action(focal, 'sup_return', { text: 'Attach the supporting inspection checklist' });
    if (['div_review', 'dept_review', 'cleared', 'out'].includes(stage)) await action(focal, 'sup_approve');
    if (['dept_review', 'cleared', 'out'].includes(stage)) await action(manager, 'div_approve');
    if (['cleared', 'out'].includes(stage)) await action(department, 'dept_clear');
    if (stage === 'out') await action(logger, 'logout', { outTo: 'Mock Records Office', remarks: 'Mock final release' });
    const doc = (await admin('GET', '/api/state')).state.docs.find(d => d.id === id);
    assert.equal(doc.status, stage); documents.push({ id, trackNo: doc.trackNo, stage });
  }
  const node = (id, type, label, x, y, config = {}) => ({ id, type, label, x, y, config });
  const edge = (id, source, target, label, condition = {}) => ({ id, source, target, label, condition: { sourceHandle: 'next', ...condition } });
  const normal = { nodes: [node('start','START','Received',50,100),node('focal','ASSIGNMENT','Focal assignment',300,100,{responsibilityType:'USER',userId:'cabrera'}),node('staff','REVIEW','Staff processing',550,100,{responsibilityType:'USER',userId:'cruz'}),node('supervisor','APPROVAL','Supervisor review',800,100,{responsibilityType:'USER',userId:'cabrera'}),node('division','APPROVAL','Division review',1050,100,{responsibilityType:'ROLE',role:'div_manager'}),node('department','APPROVAL','Department clearance',1300,100,{responsibilityType:'ROLE',role:'dept_manager'}),node('end','END','Ready for release',1550,100)], edges: [edge('a','start','focal','Forward'),edge('b','focal','staff','Assign'),edge('c','staff','supervisor','Submit'),edge('d','supervisor','division','Approved',{sourceHandle:'APPROVED'}),edge('e','division','department','Approved',{sourceHandle:'APPROVED'}),edge('f','department','end','Clear',{sourceHandle:'APPROVED'}),edge('g','supervisor','staff','Return',{sourceHandle:'RETURNED'})] };
  const branch = { nodes: [node('start','START','Received',50,100),node('decision','DECISION','Urgent?',300,100),node('urgent','REVIEW','Urgent review',600,50,{responsibilityType:'ROLE',role:'dept_manager'}),node('normal','REVIEW','Routine review',600,300,{responsibilityType:'ROLE',role:'supervisor'}),node('end','END','Finished',950,150)], edges: [edge('a','start','decision','Evaluate'),edge('b','decision','urgent','TRUE',{sourceHandle:'TRUE',field:'priority',operator:'equals',value:'Urgent'}),edge('c','decision','normal','FALSE',{sourceHandle:'FALSE',field:'priority',operator:'not_equals',value:'Urgent'}),edge('d','urgent','end','Approved'),edge('e','normal','end','Approved')] };
  const flows = [];
  for (const [name, definition] of [['MOCK — Review and return flow',normal],['MOCK — Urgency decision flow',branch]]) {
    const { workflow } = await admin('POST','/api/workflows',{name,docType:'External Communication',definition});
    const url = '/api/workflows/' + workflow.id + '/versions/' + workflow.versionId;
    assert.deepEqual((await admin('POST',url+'/validate',{})).errors,[]);
    const snapshot = JSON.stringify((await admin('GET','/api/state')).state.docs);
    const sim = await admin('POST',url+'/simulate',{documentId:documents.find(d=>d.stage==='compliance').id});
    assert.equal(sim.terminated,true);
    if (definition === branch) {
      assert.ok(sim.path.some(n => n.id === 'urgent'));
      const routine = await admin('POST',url+'/simulate',{documentId:documents.find(d=>d.stage==='received').id});
      assert.ok(routine.path.some(n => n.id === 'normal'));
    }
    assert.equal(JSON.stringify((await admin('GET','/api/state')).state.docs), snapshot);
    flows.push({id:workflow.id,name,simulation:sim.path.map(n=>n.label)});
  }
  console.log(JSON.stringify({base,documents,flows},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
