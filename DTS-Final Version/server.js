'use strict';
/*
 * Document Tracking & Routing System – server
 * Zero-dependency Node.js server (Node 22.13+). Data lives in SQLite (node:sqlite).
 * The workflow rules in public/engine.js run here as the single source of truth;
 * the browser only displays results and sends requests.
 */
process.env.TZ = process.env.TZ || 'Asia/Manila';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const util = require('node:util');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const COOKIE_SECURE = process.env.COOKIE_SECURE === '1';
const DEMO = process.env.SEED_DEMO === '1';
const PUB = path.join(__dirname, 'public');
const scrypt = util.promisify(crypto.scrypt);

fs.mkdirSync(DATA, { recursive: true });
const db = new DatabaseSync(path.join(DATA, 'dts.sqlite'));
db.exec(`
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, j TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS docs(id TEXT PRIMARY KEY, j TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT, by TEXT, action TEXT, detail TEXT);
CREATE TABLE IF NOT EXISTS schedules(id TEXT PRIMARY KEY, j TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(h TEXT PRIMARY KEY, uid TEXT NOT NULL, created INTEGER, seen INTEGER, remember INTEGER);
-- Special Reports (Phase 11). A schedule (sr_config) owes one report (sr_item) per reporting month; each responsible
-- person has an assignment (sr_assign). The unique keys are what make repeated or overlapping generation harmless.
CREATE TABLE IF NOT EXISTS sr_config(id TEXT PRIMARY KEY, j TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sr_item(id TEXT PRIMARY KEY, cfg_id TEXT NOT NULL, yr INTEGER NOT NULL, mo INTEGER NOT NULL, j TEXT NOT NULL, UNIQUE(cfg_id, yr, mo));
CREATE TABLE IF NOT EXISTS sr_assign(id TEXT PRIMARY KEY, item_id TEXT NOT NULL, user_id TEXT NOT NULL, status TEXT NOT NULL, j TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS sr_assign_one_live ON sr_assign(item_id, user_id) WHERE status IN ('active','completed');
CREATE INDEX IF NOT EXISTS sr_assign_user ON sr_assign(user_id, status);
-- Configurable workflows are isolated from live document lifecycle data until a type is explicitly enabled.
CREATE TABLE IF NOT EXISTS workflows(id TEXT PRIMARY KEY, name TEXT NOT NULL, doc_type TEXT NOT NULL, created_at TEXT NOT NULL, created_by TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS workflow_versions(id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL REFERENCES workflows(id), version INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('DRAFT','PUBLISHED')), definition TEXT NOT NULL, created_at TEXT NOT NULL, created_by TEXT NOT NULL, published_at TEXT, published_by TEXT, validation TEXT NOT NULL DEFAULT '[]', UNIQUE(workflow_id,version));
CREATE INDEX IF NOT EXISTS workflow_versions_latest ON workflow_versions(workflow_id,version DESC);
CREATE TABLE IF NOT EXISTS workflow_nodes(id TEXT NOT NULL, version_id TEXT NOT NULL REFERENCES workflow_versions(id) ON DELETE CASCADE, type TEXT NOT NULL, label TEXT NOT NULL, x REAL NOT NULL DEFAULT 0, y REAL NOT NULL DEFAULT 0, config TEXT NOT NULL DEFAULT '{}', PRIMARY KEY(version_id,id));
CREATE TABLE IF NOT EXISTS workflow_edges(id TEXT NOT NULL, version_id TEXT NOT NULL REFERENCES workflow_versions(id) ON DELETE CASCADE, source TEXT NOT NULL, target TEXT NOT NULL, label TEXT NOT NULL DEFAULT '', condition TEXT NOT NULL DEFAULT '{}', PRIMARY KEY(version_id,id));
CREATE TABLE IF NOT EXISTS workflow_instances(id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL REFERENCES workflows(id), version_id TEXT NOT NULL REFERENCES workflow_versions(id), document_id TEXT NOT NULL, status TEXT NOT NULL, current_node TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS workflow_instance_document ON workflow_instances(document_id);
CREATE TABLE IF NOT EXISTS workflow_history(id INTEGER PRIMARY KEY AUTOINCREMENT, instance_id TEXT NOT NULL REFERENCES workflow_instances(id), at TEXT NOT NULL, by TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS workflow_history_instance ON workflow_history(instance_id,id);
CREATE TABLE IF NOT EXISTS workflow_modes(doc_type TEXT PRIMARY KEY, mode TEXT NOT NULL DEFAULT 'LEGACY' CHECK(mode IN ('LEGACY','ENGINE')), version_id TEXT REFERENCES workflow_versions(id));
`);

/* ---------- workflow engine (shared with the browser) ---------- */
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(PUB, 'engine.js'), 'utf8'), ctx, { filename: 'engine.js' });
const E = ctx.ENGINE;
const S = () => ctx.S;

/* ---------- persistence ---------- */
const st = {
  setKV: db.prepare('INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v'),
  getKV: db.prepare('SELECT v FROM kv WHERE k=?'),
  setUser: db.prepare('INSERT INTO users(id,j) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET j=excluded.j'),
  setDoc: db.prepare('INSERT INTO docs(id,j) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET j=excluded.j'),
  delDoc: db.prepare('DELETE FROM docs WHERE id=?'),
  setSched: db.prepare('INSERT INTO schedules(id,j) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET j=excluded.j'),
  delSched: db.prepare('DELETE FROM schedules WHERE id=?'),
  addAudit: db.prepare('INSERT INTO audit(at,by,action,detail) VALUES(?,?,?,?)'),
  setSrCfg: db.prepare('INSERT INTO sr_config(id,j) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET j=excluded.j'),
  insSrItem: db.prepare('INSERT INTO sr_item(id,cfg_id,yr,mo,j) VALUES(?,?,?,?,?)'),
  updSrItem: db.prepare('UPDATE sr_item SET j=? WHERE id=?'),
  setSrAssign: db.prepare('INSERT INTO sr_assign(id,item_id,user_id,status,j) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status, j=excluded.j')
};
const CONFIG_KEYS = ['perms', 'divisions', 'refs', 'designations', 'holidays', 'oic', 'settings', 'seq', 'leaveTypes'];
const saveKV = k => st.setKV.run(k, JSON.stringify(S()[k]));
const saveUser = u => st.setUser.run(u.id, JSON.stringify(u));
const saveDoc = d => st.setDoc.run(d.id, JSON.stringify(d));
const saveSched = x => st.setSched.run(x.id, JSON.stringify(x));
function tx(fn) { db.exec('BEGIN'); try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } }
function flushAudit() {
  const a = S().audit;
  if (!a.length) return;
  tx(() => a.forEach(r => st.addAudit.run(r.at, r.by || '', r.action, r.detail || '')));
  a.length = 0;
}
const audit = (by, action, detail) => { E.audit(by, action, detail); };
let VERSION = Date.now();
const bump = () => { VERSION += 1; };

async function hashPw(pw) {
  const salt = crypto.randomBytes(16);
  const h = await scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return 'scrypt$' + salt.toString('hex') + '$' + h.toString('hex');
}
async function checkPw(pw, stored) {
  if (!stored || !stored.startsWith('scrypt$')) { await scrypt(pw, Buffer.alloc(16), 64, { N: 16384, r: 8, p: 1 }); return false; }
  const parts = stored.split('$');
  const d = await scrypt(pw, Buffer.from(parts[1], 'hex'), 64, { N: 16384, r: 8, p: 1 });
  const h = Buffer.from(parts[2], 'hex');
  return d.length === h.length && crypto.timingSafeEqual(d, h);
}
function randomPw() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += a[crypto.randomInt(a.length)];
  return s + '#7';
}
const pwProblem = p => (!p || p.length < 8) ? 'The password must have at least 8 characters.' : (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) ? 'The password needs both letters and numbers.' : '';

async function firstRun() {
  const s = E.baseState();
  const lines = ['Initial sign-in details. Each person must change the password at first sign-in.', 'Delete this file after handing the details out.', ''];
  for (const u of s.users) {
    const pw = DEMO ? (u.role === 'sysadmin' ? E.ADMIN_PW : E.DEFAULT_PW) : randomPw();
    u.pw = await hashPw(pw);
    u.mustChange = !DEMO;
    lines.push([u.name, u.username, pw, E.ROLES[u.role]].join('\t'));
  }
  s.spConfigs = []; s.spItems = [];
  ctx.S = s;
  E.rebuildHS();
  if (DEMO) E.seedDemoDocs();
  tx(() => {
    S().users.forEach(saveUser);
    S().docs.forEach(saveDoc);
    CONFIG_KEYS.forEach(saveKV);
  });
  flushAudit();
  srSeedOnce();
  const f = path.join(DATA, 'initial-credentials.txt');
  fs.writeFileSync(f, lines.join('\n') + '\n', { mode: 0o600 });
  console.log('\nFirst run: database created.');
  console.log('Initial sign-in details were written to ' + f + (DEMO ? ' (demo passwords)' : ''));
  console.log('Administrator username: admin\n');
}
function loadAll() {
  const kv = k => { const r = st.getKV.get(k); return r ? JSON.parse(r.v) : null; };
  const s = { v: 1, users: db.prepare('SELECT j FROM users').all().map(r => JSON.parse(r.j)), docs: db.prepare('SELECT j FROM docs').all().map(r => JSON.parse(r.j)), schedules: db.prepare('SELECT j FROM schedules').all().map(r => { try { return normSchedule(JSON.parse(r.j)); } catch (e) { return null; } }).filter(Boolean), audit: [] };
  CONFIG_KEYS.forEach(k => { s[k] = kv(k); });
  s.spConfigs = db.prepare('SELECT j FROM sr_config').all().map(r => { try { return JSON.parse(r.j); } catch (e) { return null; } }).filter(Boolean);
  const spAssign = new Map();
  db.prepare('SELECT j FROM sr_assign').all().forEach(r => { try { const a = JSON.parse(r.j); if (!spAssign.has(a.itemId)) spAssign.set(a.itemId, []); spAssign.get(a.itemId).push(a); } catch (e) { /* skip a damaged row */ } });
  s.spItems = db.prepare('SELECT j FROM sr_item').all().map(r => { try { const it = JSON.parse(r.j); it.assign = (spAssign.get(it.id) || []).sort((x, y) => String(x.assignedAt).localeCompare(String(y.assignedAt))); return it; } catch (e) { return null; } }).filter(Boolean);
  const b = E.baseState();
  s.settings = Object.assign({}, b.settings, s.settings || {});
  s.perms = s.perms || b.perms; s.oic = s.oic || { enabled: false, userId: '' }; s.seq = s.seq || {};
  s.refs = s.refs || b.refs;
  s.refs.comm = Array.isArray(s.refs.comm) ? s.refs.comm : b.refs.comm;
  s.refs.doc = Array.isArray(s.refs.doc) ? s.refs.doc : b.refs.doc;
  s.refs.tx = Array.isArray(s.refs.tx) ? s.refs.tx : b.refs.tx;
  /* Databases created before the Personnel Schedule existed get the starting Leave Type list once. */
  const needLeaveTypes = !Array.isArray(s.leaveTypes);
  if (needLeaveTypes) s.leaveTypes = b.leaveTypes;
  ctx.S = s; E.rebuildHS();
  let srWorkflowMigrated = false;
  s.spItems.forEach(it => { if (!it.workflow) { srWorkflowInit(it); srWorkflowMigrated = true; } });
  if (srWorkflowMigrated) { try { tx(() => s.spItems.forEach(it => st.updSrItem.run(srItemJson(it), it.id))); } catch (e) { console.error('Special Report workflow migration failed:', e.message); } }
  srSeedOnce();
  if (needLeaveTypes) { try { saveKV('leaveTypes'); } catch (e) { console.error('Leave type setup failed:', e.message); } }
  /* Safe, one-off upgrade of older reference lists: plain communication type names gain a
     description and an active flag, and document types gain a prescribed deadline threshold.
     Nothing is deleted and no document is rewritten. */
  if (E.migrateState()) {
    try { saveKV('refs'); audit('', 'Reference lists upgraded', 'Document type deadline thresholds and communication type records added.'); flushAudit(); }
    catch (e) { console.error('Reference list upgrade failed:', e.message); }
  }
}

/* ---------- sessions ---------- */
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const DAY = 864e5;
function parseCookies(req) {
  const o = {};
  String(req.headers.cookie || '').split(';').forEach(c => { const i = c.indexOf('='); if (i > 0) o[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); });
  return o;
}
function isHttps(req) { return COOKIE_SECURE || (TRUST_PROXY && req.headers['x-forwarded-proto'] === 'https'); }
function cookie(req, val, maxAge) {
  return 'dts_sid=' + encodeURIComponent(val) + '; Path=/; HttpOnly; SameSite=Strict' + (maxAge != null ? '; Max-Age=' + maxAge : '') + (isHttps(req) ? '; Secure' : '');
}
async function newSession(uid, remember) {
  const tok = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  db.prepare('INSERT INTO sessions(h,uid,created,seen,remember) VALUES(?,?,?,?,?)').run(sha(tok), uid, now, now, remember ? 1 : 0);
  return tok;
}
const killSessions = (uid, exceptHash) => db.prepare('DELETE FROM sessions WHERE uid=? AND h<>?').run(uid, exceptHash || '');
function sessionOf(req, poll) {
  const tok = parseCookies(req).dts_sid;
  if (!tok) return null;
  const h = sha(tok), row = db.prepare('SELECT * FROM sessions WHERE h=?').get(h);
  if (!row) return null;
  const now = Date.now(), idle = Number(S().settings.idleMinutes) || 0;
  if ((idle > 0 && now - row.seen > idle * 60000) || now - row.created > (row.remember ? 30 * DAY : 12 * 3600000)) { db.prepare('DELETE FROM sessions WHERE h=?').run(h); return null; }
  const user = E.uById(row.uid);
  if (!user || !user.active) { db.prepare('DELETE FROM sessions WHERE h=?').run(h); return null; }
  if (!poll && now - row.seen > 15000) db.prepare('UPDATE sessions SET seen=? WHERE h=?').run(now, h);
  return { user, hash: h };
}
setInterval(() => { try { db.prepare('DELETE FROM sessions WHERE created<?').run(Date.now() - 31 * DAY); } catch (e) { /* ignore */ } }, 3600000).unref();

/* ---------- login throttle ---------- */
const fails = new Map();
const clientIp = req => (TRUST_PROXY && req.headers['x-forwarded-for']) ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.socket.remoteAddress;
function throttled(key) { const f = fails.get(key); return f && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 60000) : 0; }
function noteFail(key) { const f = fails.get(key) || { n: 0, until: 0 }; f.n += 1; if (f.n >= 5) { f.until = Date.now() + 15 * 60000; f.n = 0; } fails.set(key, f); }

/* ---------- helpers ---------- */
function send(res, status, obj, headers) {
  const body = JSON.stringify(obj);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers || {}));
  res.end(body);
}
const fail = (res, status, error, code, extra) => send(res, status, Object.assign({ ok: false, error, code }, extra || {}));
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', c => { n += c.length; if (n > limit) { reject(Object.assign(new Error('Request too large.'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(n ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(Object.assign(new Error('Invalid JSON.'), { status: 400 })); } });
    req.on('error', reject);
  });
}
/* the schedule endpoints only accept a JSON object; null, arrays and plain values are treated as an empty request and refused by validation */
const objBody = async (req, limit) => { const b = await readBody(req, limit); return (b && typeof b === 'object' && !Array.isArray(b)) ? b : {}; };
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max || 300) : '');
const bool = v => v === true || v === 1 || v === '1' || v === 'true' || v === 'on';
const isoOrNull = v => { if (typeof v !== 'string' || !v) return null; const d = new Date(v); return isNaN(d) ? null : d; };
const pub = (x, full) => { const o = { id: x.id, name: x.name, role: x.role, division: x.division, active: x.active, present: x.present }; if (full) { o.username = x.username; o.lastLogin = x.lastLogin; } return o; };
const has = (u, p) => E.has(u, p);
const orgName = () => S().settings.orgName;

/* Workflow definitions are versioned independently of documents. Node and edge rows are the
   canonical graph representation; LEGACY is inserted for every known type during startup. */
const WF_NODE_TYPES = ['START','REVIEW','APPROVAL','DECISION','RETURN','ASSIGNMENT','NOTIFICATION','CLEAR_FOR_OUT','END'];
const wfId = p => crypto.randomUUID();
const wfNow = () => new Date().toISOString();
function wfShapeError(d){if(!d||!Array.isArray(d.nodes)||!Array.isArray(d.edges))return 'Provide node and transition lists.';if(d.nodes.length>100||d.edges.length>250)return 'Workflow size limit exceeded (100 nodes, 250 transitions).';const ids=new Set();for(const n of d.nodes){if(!n||typeof n.id!=='string'||!n.id||n.id.length>80||ids.has(n.id)||!WF_NODE_TYPES.includes(n.type)||typeof n.label!=='string'||!n.label.trim()||!Number.isFinite(Number(n.x))||!Number.isFinite(Number(n.y))||!n.config||typeof n.config!=='object'||Array.isArray(n.config))return 'A node has invalid or duplicate fields.';ids.add(n.id);}const edgeIds=new Set();for(const e of d.edges){if(!e||typeof e.id!=='string'||!e.id||e.id.length>80||edgeIds.has(e.id)||typeof e.source!=='string'||typeof e.target!=='string'||typeof e.label!=='string'||!e.condition||typeof e.condition!=='object'||Array.isArray(e.condition))return 'A transition has invalid or duplicate fields.';edgeIds.add(e.id);}return '';}
function wfRead(versionId) {
  const v = db.prepare('SELECT * FROM workflow_versions WHERE id=?').get(versionId);
  if (!v) return null;
  const w = db.prepare('SELECT * FROM workflows WHERE id=?').get(v.workflow_id);
  return { id:w.id, name:w.name, docType:w.doc_type, version:v.version, versionId:v.id, status:v.status,revision:crypto.createHash('sha256').update(JSON.stringify([w.name,w.doc_type,db.prepare('SELECT * FROM workflow_nodes WHERE version_id=? ORDER BY rowid').all(v.id),db.prepare('SELECT * FROM workflow_edges WHERE version_id=? ORDER BY rowid').all(v.id)])).digest('hex'),
    nodes:db.prepare('SELECT id,type,label,x,y,config FROM workflow_nodes WHERE version_id=? ORDER BY rowid').all(v.id).map(n=>({...n,config:JSON.parse(n.config)})),
    edges:db.prepare('SELECT id,source,target,label,condition FROM workflow_edges WHERE version_id=? ORDER BY rowid').all(v.id).map(e=>({...e,condition:JSON.parse(e.condition)})), validation:JSON.parse(v.validation||'[]'), createdAt:v.created_at, publishedAt:v.published_at };
}
function wfValid(d) {
  const errors=[], nodes=Array.isArray(d.nodes)?d.nodes:[], edges=Array.isArray(d.edges)?d.edges:[], ids=new Set(nodes.map(n=>n.id));
  if(nodes.length>100) errors.push('A workflow can contain at most 100 nodes.');
  if(edges.length>250) errors.push('A workflow can contain at most 250 transitions.');
  if(nodes.filter(n=>n.type==='START').length!==1) errors.push('Add exactly one START node.');
  if(!nodes.some(n=>['END','CLEAR_FOR_OUT'].includes(n.type))) errors.push('Add an END or CLEAR_FOR_OUT node.');
  const duplicates=new Set();
  for(const n of nodes){
    if(!n.id||!WF_NODE_TYPES.includes(n.type)) errors.push('A node has a missing ID or unsupported type.');
    const cfg=n.config||{};
    if(['REVIEW','APPROVAL','ASSIGNMENT'].includes(n.type)&&!cfg.responsibilityType) errors.push(n.label+': choose a responsibility type.');
    if(cfg.responsibilityType==='USER'&&(!cfg.userId||!E.uById(cfg.userId)||!E.uById(cfg.userId).active)) errors.push(n.label+': choose an active user.');
    if(['ROLE','ROLE_DIVISION'].includes(cfg.responsibilityType)&&!Object.hasOwn(E.ROLES,cfg.role)) errors.push(n.label+': choose a valid role.');
    if(['DIVISION','ROLE_DIVISION'].includes(cfg.responsibilityType)&&!S().divisions.some(x=>x.code===cfg.division)) errors.push(n.label+': choose a valid division.');
  }
  for(const e of edges){const k=e.source+'>'+e.target+'>'+String(e.label||'');if(duplicates.has(k))errors.push('Duplicate transition: '+(e.label||k));duplicates.add(k);if(!ids.has(e.source)||!ids.has(e.target))errors.push('A transition points to a missing node.');if(e.source===e.target)errors.push('A node cannot transition to itself.');const source=nodes.find(n=>n.id===e.source),target=nodes.find(n=>n.id===e.target),handle=e.condition?.sourceHandle;if(source?.type==='END')errors.push(source.label+': END cannot have outgoing transitions.');if(target?.type==='START')errors.push(target.label+': START cannot have incoming transitions.');if(handle&&!(source?.type==='DECISION'?['TRUE','FALSE']:source?.type==='APPROVAL'?['APPROVED','REJECTED','RETURNED']:['next']).includes(handle))errors.push('A transition has an invalid output handle.');const c={...(e.condition||{})};delete c.sourceHandle;if(c.targetSide&&!['auto','left','right'].includes(c.targetSide))errors.push('A transition has an invalid target side.');delete c.targetSide;if(typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(x=>!['field','operator','value'].includes(x))||(Object.keys(c).length&&(!['status','priority','docType','division'].includes(c.field)||!['equals','not_equals','contains'].includes(c.operator)||typeof c.value!=='string')))errors.push('A transition has an invalid condition.');}
  const start=nodes.find(n=>n.type==='START');
  if(start){const seen=new Set([start.id]), todo=[start.id];while(todo.length){const at=todo.pop();edges.filter(e=>e.source===at).forEach(e=>{if(ids.has(e.target)&&!seen.has(e.target)){seen.add(e.target);todo.push(e.target);}});}nodes.filter(n=>!seen.has(n.id)).forEach(n=>errors.push(n.label+': unreachable from START.'));for(const n of nodes.filter(n=>seen.has(n.id)&&!['END','CLEAR_FOR_OUT'].includes(n.type))){if(!edges.some(e=>e.source===n.id))errors.push(n.label+': dead end has no transition.');}
    const terminal=new Set(nodes.filter(n=>['END','CLEAR_FOR_OUT'].includes(n.type)).map(n=>n.id)),reverse=true;while(reverse){let changed=false;edges.forEach(e=>{if(terminal.has(e.target)&&!terminal.has(e.source)){terminal.add(e.source);changed=true;}});if(!changed)break;}nodes.filter(n=>seen.has(n.id)&&!terminal.has(n.id)).forEach(n=>errors.push(n.label+': cannot reach END or CLEAR_FOR_OUT (check for non-terminating cycles).'));}
  for(const n of nodes.filter(n=>n.type==='DECISION')){const outs=edges.filter(e=>e.source===n.id);if(outs.length<2)errors.push(n.label+': a decision needs at least two branches.');if(outs.some(e=>!e.label))errors.push(n.label+': label every decision branch.');}
  return [...new Set(errors)];
}
function wfStoreGraph(versionId,d){
  db.prepare('DELETE FROM workflow_nodes WHERE version_id=?').run(versionId);db.prepare('DELETE FROM workflow_edges WHERE version_id=?').run(versionId);
  const ni=db.prepare('INSERT INTO workflow_nodes(id,version_id,type,label,x,y,config) VALUES(?,?,?,?,?,?,?)');
  const ei=db.prepare('INSERT INTO workflow_edges(id,version_id,source,target,label,condition) VALUES(?,?,?,?,?,?)');
  d.nodes.forEach(n=>ni.run(str(n.id,80),versionId,n.type,str(n.label,120),Number(n.x)||0,Number(n.y)||0,JSON.stringify(n.config||{})));
  d.edges.forEach(e=>ei.run(str(e.id,80),versionId,str(e.source,80),str(e.target,80),str(e.label,120),JSON.stringify(e.condition||{})));
}
// Read-only execution trace. Responsibility uses the existing state and manager/OIC resolver.
function wfSimulate(d,b){
  const doc=S().docs.find(x=>x.id===b.documentId)||{docType:d.docType,status:'received',priority:'normal',division:''};
  const path=[],warnings=[],visits=new Map();let current=d.nodes.find(n=>n.type==='START'),terminated=false;
  const evaluate=c=>{if(!c.field)return true;const value=String(doc[c.field]??'');return c.operator==='equals'?value===c.value:c.operator==='not_equals'?value!==c.value:c.operator==='contains'?value.includes(c.value):false;};
  while(current&&path.length<100){
    const count=(visits.get(current.id)||0)+1;visits.set(current.id,count);if(count>3){warnings.push('Stopped a repeated revision cycle at '+current.label+'.');break;}
    const cfg=current.config||{},active=S().users.filter(u=>u.active);let users=[];
    if(cfg.responsibilityType==='USER')users=active.filter(u=>u.id===cfg.userId);
    if(cfg.responsibilityType==='ROLE')users=cfg.role==='dept_manager'?E.deptApprovers(doc).users:active.filter(u=>u.role===cfg.role);
    if(cfg.responsibilityType==='DIVISION')users=active.filter(u=>u.division===cfg.division);
    if(cfg.responsibilityType==='ROLE_DIVISION')users=active.filter(u=>u.role===cfg.role&&u.division===cfg.division);
    if(cfg.responsibilityType==='CURRENT_ASSIGNEE')users=active.filter(u=>u.id===doc.assignee);
    const step={id:current.id,type:current.type,label:current.label,responsibility:cfg,responsibleUsers:users.map(u=>({id:u.id,name:u.name,role:u.role})),status:doc.status,conditionResults:[]};path.push(step);
    if(cfg.responsibilityType&&!users.length)warnings.push(current.label+': no active responsible user resolved.');
    const outgoing=d.edges.filter(e=>e.source===current.id);
    if(current.type==='END'||(current.type==='CLEAR_FOR_OUT'&&!outgoing.length)){terminated=true;break;}
    for(const edge of outgoing){step.conditionResults.push({edgeId:edge.id,label:edge.label,result:evaluate(edge.condition||{})});}
    const chosen=b.branchLabels?.[current.id];const eligible=outgoing.filter(e=>evaluate(e.condition||{}));const next=chosen?eligible.find(e=>e.label===chosen):eligible[0];
    if(!chosen&&eligible.length>1)warnings.push(current.label+': multiple eligible branches; first branch used. Choose an outcome for a specific scenario.');
    if(!next){warnings.push(current.label+': no matching transition.');break;}
    step.transition=next.label;step.nextNode=next.target;current=d.nodes.find(n=>n.id===next.target);
  }
  if(path.length>=100)warnings.push('Simulation step limit reached.');
  return {ok:true,documentId:str(b.documentId,100),simulationOnly:true,path,terminated,warnings};
}
function wfAudit(by,action,detail){st.addAudit.run(wfNow(),by,action,detail);}

/* ---------- personnel schedule: validation ---------- */
/* A stored schedule that is missing its basics is skipped (with a note in the log) instead of breaking the calendar for everyone.
   Missing optional text fields are filled in so the screen never meets undefined. */
function normSchedule(x) {
  const d = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v), t = v => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v);
  if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !x.id || !['inspection', 'leave', 'meeting'].includes(x.type)) return null;
  if (!d(x.startDate) || !d(x.endDate) || x.endDate < x.startDate || !Array.isArray(x.personnel)) return null;
  if (x.type !== 'leave' && (!t(x.startTime) || !t(x.endTime) || x.endTime <= x.startTime)) return null;
  return Object.assign({ title: '', project: '', location: '', remarks: '', link: '', organizer: '', leaveTypeId: '', startTime: '', endTime: '', createdBy: '', createdAt: '', updatedBy: '', updatedAt: '' }, x, { personnel: x.personnel.filter(i => typeof i === 'string') });
}
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const SCHED_NAME = { inspection: 'Inspection', leave: 'Leave', meeting: 'Meeting' };
function schedAuditText(x) {
  const when = x.startDate === x.endDate ? x.startDate : x.startDate + ' to ' + x.endDate;
  const who = E.schedPeople(x).map(id => (E.uById(id) || {}).name || id).join(', ');
  return SCHED_NAME[x.type] + ': ' + (x.type === 'leave' ? E.leaveTypeName(x.leaveTypeId) : x.title) + ' (' + when + '; ' + who + ')';
}
/* Checks one schedule from the browser and returns the clean record (or the first problem).
   The type of an existing schedule cannot change; people must be existing user records. */
function cleanSchedule(b, prev) {
  const bad = error => ({ ok: false, error });
  const type = prev ? prev.type : b.type;
  if (!E.SCHED_TYPES.includes(type)) return bad('Choose the schedule type: Inspection, Leave or Meeting.');
  const okDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && E.isoD(E.parseD(v)) === v;
  const okTime = v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  const ids = v => [...new Set((Array.isArray(v) ? v : []).map(x => str(x, 40)).filter(Boolean))];
  const keep = id => !!prev && ((prev.personnel || []).includes(id) || prev.organizer === id);
  const known = id => { const x = E.uById(id); return !!x && (x.active || keep(id)); };
  const sch = { type, title: '', project: '', location: '', startDate: '', endDate: '', startTime: '', endTime: '', remarks: str(b.remarks, 2000), personnel: [], organizer: '', link: '', leaveTypeId: '' };
  /* dates and times are read whole (never cut short), so '2026-11-02T08:00' or '08:00:00' is refused rather than quietly trimmed into something valid */
  const whole = v => (typeof v === 'string' ? v.trim() : '');
  const startDate = whole(b.startDate), endDate = whole(b.endDate) || startDate;
  const people = ids(b.personnel);
  if (people.length > 100) return bad('Too many people selected.');
  if (people.some(id => !known(id))) return bad('Choose personnel from the active user list.');
  if (type === 'leave') {
    if (people.length !== 1) return bad('Choose the person who is on leave.');
    const lt = (b.leaveTypeId && (Array.isArray(S().leaveTypes) ? S().leaveTypes : []).find(t => t.id === str(b.leaveTypeId, 40))) || null;
    if (!lt || (lt.active === false && !(prev && prev.leaveTypeId === lt.id))) return bad('Choose an active leave type.');
    if (!okDate(startDate)) return bad('Enter the start date.');
    if (!okDate(endDate)) return bad('Enter the end date.');
    if (endDate < startDate) return bad('The end date cannot be before the start date.');
    Object.assign(sch, { personnel: people, leaveTypeId: lt.id, startDate, endDate });
    return { ok: true, sch };
  }
  const title = str(b.title, 200);
  if (!title) return bad(type === 'inspection' ? 'Enter the inspection title.' : 'Enter the meeting title.');
  if (!okDate(startDate)) return bad('Enter the date.');
  if (!okDate(endDate)) return bad('The end date is not a valid date.');
  if (endDate < startDate) return bad('The end date cannot be before the start date.');
  const startTime = whole(b.startTime), endTime = whole(b.endTime);
  if (!okTime(startTime)) return bad('Enter the start time.');
  if (!okTime(endTime)) return bad('Enter the end time.');
  if (endTime <= startTime) return bad('The end time must be later than the start time.');
  Object.assign(sch, { title, startDate, endDate, startTime, endTime, location: str(b.location, 300) });
  if (type === 'inspection') {
    if (!people.length) return bad('Choose at least one inspector.');
    sch.project = str(b.project, 200);
    if (!sch.project && !sch.location) return bad('Enter the project or the location of the inspection.');
    sch.personnel = people;
  } else {
    const organizer = str(b.organizer, 40);
    if (organizer && !known(organizer)) return bad('Choose the organizer from the active user list.');
    if (!organizer && !people.length) return bad('Choose the organizer or at least one participant.');
    const link = str(b.link, 1000);
    if (link && !/^https?:\/\/[^\s/$.?#][^\s]*$/i.test(link)) return bad('Enter the meeting link as a full web address starting with https://');
    Object.assign(sch, { organizer, link, personnel: people });
  }
  return { ok: true, sch };
}

/* ---------- Special Reports (Phase 11): schedules, automatic generation, assignments ---------- */
/* The clock. SR_TEST + SR_NOW let the test suite pretend it is another day; without SR_TEST the real date is always used. */
const SR_TEST = process.env.SR_TEST === '1';
const srNow = () => { if (SR_TEST && /^\d{4}-\d{2}-\d{2}$/.test(process.env.SR_NOW || '')) return E.parseD(process.env.SR_NOW); return new Date(); };
const srPrevPeriod = now => { const y = now.getFullYear(), m = now.getMonth() + 1; return E.srPeriodKey(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1); };
const srItemJson = it => JSON.stringify(Object.assign({}, it, { assign: undefined }));
const srSaveAssign = a => st.setSrAssign.run(a.id, a.itemId, a.userId, a.status, JSON.stringify(a));
const srSaveCfg = c => st.setSrCfg.run(c.id, JSON.stringify(c));
const srIdOf = () => crypto.randomBytes(6).toString('hex');
const srNames = ids => (ids || []).map(id => (E.uById(id) || {}).name || id).join(', ') || 'nobody';
const srUserOk = id => { const x = E.uById(id); return !!x && x.active && x.role !== 'sysadmin'; };

/* The five schedules of Phase 11. They are created once, INACTIVE and with nobody assigned: the brief names no
   responsible person, and a report must never be generated without one. The administrator assigns people and
   activates each schedule under Special Reports. */
const SR_SEED = [
  ['Summary of CMR', 'monthly', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 25],
  ['Summary of PPR', 'monthly', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 20],
  ['List of Terminated', 'quarterly', [3, 6, 9, 12], 17],
  ['PPA to COA', 'specific', [1, 3, 6, 9, 12], 17],
  ['CMR and PPR Tracking', 'monthly', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 15]
];
function srSeedOnce() {
  try {
    const s = S();
    if (st.getKV.get('spSeeded')) return;
    if (!s.spConfigs.length) {
      const at = new Date().toISOString(), from = srPrevPeriod(srNow());
      tx(() => {
        SR_SEED.forEach(x => {
          const c = { id: srIdOf(), name: x[0], frequency: x[1], months: x[2], threshold: x[3], basis: 'working_days', assignUsers: [], assignDivisions: [], docType: '', fromPeriod: from, active: false, createdBy: 'System', createdAt: at, updatedBy: 'System', updatedAt: at, issue: null };
          s.spConfigs.push(c); srSaveCfg(c);
        });
        st.setKV.run('spSeeded', '1');
      });
      audit('', 'Special Reports set up', 'Five schedules created (inactive until personnel are assigned): ' + SR_SEED.map(x => x[0]).join(', ')); flushAudit();
    } else st.setKV.run('spSeeded', '1');
  } catch (e) { console.error('Special Reports setup failed:', e.message); }
}

/* Who is responsible: the people named on the schedule plus the focal of each named division, looked up NOW. */
function srResolve(cfg) {
  const ids = [], notes = [];
  (cfg.assignUsers || []).forEach(id => { if (srUserOk(id)) ids.push(id); else notes.push((E.uById(id) || {}).name || id); });
  (cfg.assignDivisions || []).forEach(code => {
    const d = S().divisions.find(x => x.code === code), fo = d && d.focal ? E.uById(d.focal) : null;
    if (fo && srUserOk(fo.id)) ids.push(fo.id); else notes.push('focal of ' + code);
  });
  return { ids: [...new Set(ids)], skipped: notes };
}

function srWorkflowInit(it) {
  if (!it.workflow) {
    const at = it.generatedAt || new Date(it.genDate + 'T00:00:00.000Z').toISOString();
    const names = srNames((it.assign || []).map(a => a.userId));
    const completed = it.status === 'completed';
    it.workflow = { status: completed ? 'out' : 'processing', division: it.division || '', assignee: completed ? (it.completedBy || '') : '', reviewer: '', assignedBy: 'System', stageEnteredAt: completed ? (it.stopAt || at) : at, cycles: 0, returnedFrom: null, comments: [],
      history: [{ at, by: 'System', action: 'Generated and assigned to responsible staff', to: 'processing', desk: 'Staff – processing – ' + names, remarks: '' }].concat(completed ? [{ at: it.stopAt || at, by: it.completedBy || 'System', action: 'Previously marked completed', to: 'out', desk: 'Released', remarks: it.completionNote || '' }] : []) };
  }
  return it.workflow;
}
function srWorkflowDoc(it, w) {
  const a = (it.assign || []).find(x => x.status === 'active');
  return { id: it.id, trackNo: 'SR-' + it.year + '-' + String(it.month).padStart(2, '0'), receivedAt: it.generatedAt || it.clockStart, commType: 'Special Report', source: 'System generated', refNo: '', subject: it.title, docType: 'Special Report', division: w.division || it.division || '', pages: '', priority: 'Normal', region: '', reportingPeriod: it.periodLabel, remarks: '', url: it.url || '', draftUrl: '', revUrl: '', txType: 'Special Report', dueAt: it.dueAt, clockStart: it.clockStart, stopAt: w.stopAt || null, deadlineSource: 'special report', threshold: it.threshold, deadlineUnit: 'working_days', deadlineLabel: it.dueLabel, deadlineMonth: '', assignee: w.assignee || (a && a.userId) || '', assignedBy: w.assignedBy || 'System', reviewer: w.reviewer || '', status: w.status || 'processing', createdBy: 'System', stageEnteredAt: w.stageEnteredAt || it.generatedAt, cycles: w.cycles || 0, returnedFrom: w.returnedFrom || null, comments: w.comments || [], history: w.history || [], clearedAt: w.clearedAt || null, clearedBy: w.clearedBy || '', clearedTier: w.clearedTier || '', outAt: w.outAt || null, outBy: w.outBy || '', outTo: w.outTo || '', outType: w.outType || '', outRemarks: w.outRemarks || '' };
}
function srWorkflowSave(it, w, d) {
  Object.assign(w, { status: d.status, division: d.division, assignee: d.assignee, assignedBy: d.assignedBy, reviewer: d.reviewer, stageEnteredAt: d.stageEnteredAt, cycles: d.cycles, returnedFrom: d.returnedFrom, comments: d.comments, history: d.history, stopAt: d.stopAt, clearedAt: d.clearedAt, clearedBy: d.clearedBy, clearedTier: d.clearedTier, outAt: d.outAt, outBy: d.outBy, outTo: d.outTo, outType: d.outType, outRemarks: d.outRemarks });
  if (d.status === 'out') { it.status = 'completed'; it.stopAt = d.outAt || new Date().toISOString(); it.completedBy = d.outBy || ''; it.completionNote = d.outRemarks || ''; }
}

/* Creates ONE report and its assignments in ONE transaction. Nothing half-built is ever left behind. */
function srCreateItem(cfg, per, now) {
  const who = srResolve(cfg);
  if (!who.ids.length) return { ok: false, issue: 'No active person to assign (' + (who.skipped.join(', ') || 'nobody is set') + ').' };
  const d = E.srDeadline(per.month, per.year, cfg.threshold), at = new Date().toISOString();
  const item = { id: srIdOf(), cfgId: cfg.id, name: cfg.name, frequency: cfg.frequency, threshold: cfg.threshold, basis: cfg.basis, docType: cfg.docType || '', year: per.year, month: per.month,
    periodLabel: E.srPeriodLabel(cfg.frequency, per.month, per.year), title: E.srTitle(cfg.name, per.month, per.year), genDate: per.genDate, generatedAt: at,
    clockStart: E.parseD(per.genDate).toISOString(), dueAt: d.dueAt, dueLabel: d.label, spills: d.spills, status: 'pending', stopAt: null, completedBy: '', completionNote: '', createdBy: 'System', division: cfg.assignDivisions.length === 1 ? cfg.assignDivisions[0] : '', url: '', workflow: null, assign: [] };
  const rows = who.ids.map(uid => ({ id: srIdOf(), itemId: item.id, userId: uid, status: 'active', assignedAt: at, assignedBy: 'System', endedAt: null, endedBy: '', note: '' }));
  item.assign = rows; srWorkflowInit(item);
  try {
    tx(() => { st.insSrItem.run(item.id, cfg.id, per.year, per.month, srItemJson(item)); rows.forEach(srSaveAssign); });
  } catch (e) {
    if (/UNIQUE|constraint/i.test(String(e.message))) return { ok: true, duplicate: true };
    return { ok: false, issue: 'Could not save: ' + e.message };
  }
  S().spItems.push(item);
  return { ok: true, item, skipped: who.skipped };
}

/* Looks at every ACTIVE schedule and creates whatever is owed and missing. Safe to run any number of times, at any time:
   what is owed depends only on the date, and what already exists is never created again. */
function srGenerate(now, by) {
  now = now || srNow();
  const s = S(), made = [], issues = [];
  const have = new Set(s.spItems.map(i => i.cfgId + '|' + i.year + '|' + i.month));
  for (const cfg of s.spConfigs) {
    if (!cfg.active) continue;
    let problem = '';
    for (const per of E.srDuePeriods(cfg, now)) {
      if (have.has(cfg.id + '|' + per.year + '|' + per.month)) continue;
      const r = srCreateItem(cfg, per, now);
      if (!r.ok) { problem = r.issue; issues.push({ name: cfg.name, period: E.srPeriodLabel(cfg.frequency, per.month, per.year), issue: r.issue }); break; }
      have.add(cfg.id + '|' + per.year + '|' + per.month);
      if (r.duplicate) continue;
      made.push(r.item);
      audit(by || 'System', 'Special Report generated', r.item.title + ' – deadline ' + r.item.dueAt + ' – assigned to ' + srNames(r.item.assign.map(a => a.userId)) + (r.skipped.length ? ' (not available: ' + r.skipped.join(', ') + ')' : '') + (r.item.spills ? ' – deadline counted on into the next month' : ''));
    }
    /* an unassignable schedule is reported once, then again only when the reason changes */
    const prevIssue = cfg.issue && cfg.issue.text || '';
    if (problem !== prevIssue) {
      cfg.issue = problem ? { text: problem, at: new Date().toISOString() } : null; srSaveCfg(cfg);
      if (problem) audit('System', 'Special Report not generated', cfg.name + ': ' + problem);
    }
  }
  if (made.length || issues.length) { flushAudit(); bump(); }
  return { made, issues };
}
function srTick() { try { srGenerate(srNow(), 'System'); } catch (e) { console.error('Special Report generation failed:', e.message); } }

/* Reads a schedule from the browser and returns the clean record or the first problem. */
function cleanSrConfig(b, prev) {
  const bad = error => ({ ok: false, error });
  const ids = v => [...new Set((Array.isArray(v) ? v : []).map(x => str(x, 40)).filter(Boolean))];
  const c = { name: str(b.name, 120), frequency: str(b.frequency, 20), months: E.srCleanMonths(b.months), generationDay: (b.generationDay === '' || b.generationDay == null) ? 1 : Number(b.generationDay), threshold: (b.threshold === '' || b.threshold == null) ? '' : Number(b.threshold),
    basis: str(b.basis, 40) || 'working_days', assignUsers: ids(b.assignUsers), assignDivisions: ids(b.assignDivisions), docType: str(b.docType, 200), fromPeriod: str(b.fromPeriod, 7) || (prev ? prev.fromPeriod : srPrevPeriod(srNow())),
    active: b.active === undefined ? (prev ? prev.active : true) : bool(b.active) };
  const err = E.srValidate(c, { activeUser: srUserOk, division: code => S().divisions.some(d => d.code === code) });
  if (err) return bad(err);
  if (c.docType && !S().refs.doc.some(d => d.name === c.docType)) return bad('Choose the related document type from the Document Types list, or leave it blank.');
  if (S().spConfigs.some(x => x.name.toLowerCase() === c.name.toLowerCase() && (!prev || x.id !== prev.id))) return bad('A Special Report with that name already exists.');
  return { ok: true, c };
}
function srDiff(prev, c) {
  const d = [], f = (label, a, b) => { if (String(a) !== String(b)) d.push(label + ': ' + a + ' → ' + b); };
  f('name', prev.name, c.name); f('frequency', E.srFreqName(prev.frequency), E.srFreqName(c.frequency)); f('reporting months', E.srMonthsLabel(prev.months), E.srMonthsLabel(c.months));
  f('generation day', prev.generationDay || 1, c.generationDay);
  f('deadline', prev.threshold + ' working days', c.threshold + ' working days'); f('deadline basis', prev.basis, c.basis);
  f('assigned personnel', srNames(prev.assignUsers), srNames(c.assignUsers)); f('assigned divisions', (prev.assignDivisions || []).join(', ') || 'none', c.assignDivisions.join(', ') || 'none');
  f('first period', prev.fromPeriod, c.fromPeriod); f('related document type', prev.docType || 'none', c.docType || 'none'); f('status', prev.active ? 'active' : 'inactive', c.active ? 'active' : 'inactive');
  return d;
}

/* ---------- request handlers ---------- */
const ACT_TYPES = ['forward', 'assign', 'reassign', 'submit', 'sup_return', 'sup_approve', 'div_return', 'div_approve', 'dept_return', 'dept_clear', 'instruct_return', 'logout', 'comment', 'edit', 'delete', 'set_urls'];
function cleanActPayload(p) {
  const o = {};
  ['remarks', 'txType', 'docType', 'assignee', 'note', 'reviewer', 'outTo', 'commType', 'source', 'refNo', 'subject', 'division', 'pages', 'priority', 'reportingPeriod'].forEach(k => { if (p[k] !== undefined) o[k] = str(p[k], k === 'subject' ? 2000 : 300); });
  ['text', 'reason'].forEach(k => { if (p[k] !== undefined) o[k] = str(p[k], 5000); });
  ['url', 'draftUrl', 'revUrl'].forEach(k => { if (p[k] !== undefined) o[k] = str(p[k], 2000); });
  if (typeof p.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.dueDate)) o.dueDate = p.dueDate;
  ['outAt', 'receivedAt'].forEach(k => { const d = isoOrNull(p[k]); if (d) o[k] = d.toISOString(); });
  return o;
}
async function handleApi(req, res, url) {
  const m = req.method, p = url.pathname;
  if (m !== 'GET' && req.headers['x-requested-with'] !== 'dts') return fail(res, 403, 'Blocked request.', 'csrf');

  /* --- public --- */
  if (m === 'POST' && p === '/api/login') {
    const b = await readBody(req, 10000);
    const username = str(b.username, 100), key = clientIp(req) + '|' + username.toLowerCase();
    const wait = throttled(key);
    if (wait) return fail(res, 429, 'Too many failed attempts. Try again in ' + wait + ' minute' + (wait > 1 ? 's' : '') + '.', 'throttled');
    const u = S().users.find(x => x.username.toLowerCase() === username.toLowerCase());
    const ok = await checkPw(String(b.password || ''), u && u.pw);
    if (!u || !ok) { noteFail(key); audit('', 'Failed sign-in', 'Username: ' + username + ' from ' + clientIp(req)); flushAudit(); return fail(res, 401, 'Incorrect username or password.', 'bad_login', { orgName: orgName() }); }
    if (!u.active) return fail(res, 403, 'This account is deactivated. Contact the System Administrator.', 'inactive');
    fails.delete(key);
    u.lastLogin = new Date().toISOString(); saveUser(u);
    const tok = await newSession(u.id, !!b.remember);
    audit(u.id, 'Signed in', clientIp(req)); flushAudit();
    return send(res, 200, { ok: true, mustChange: !!u.mustChange }, { 'Set-Cookie': cookie(req, tok, b.remember ? 30 * 86400 : null) });
  }

  const sess = sessionOf(req, req.headers['x-poll'] === '1');
  if (!sess) return fail(res, 401, 'Please sign in.', 'auth', { orgName: orgName() });
  const u = sess.user;

  if (m === 'POST' && p === '/api/logout') {
    db.prepare('DELETE FROM sessions WHERE h=?').run(sess.hash); audit(u.id, 'Signed out', ''); flushAudit();
    return send(res, 200, { ok: true }, { 'Set-Cookie': cookie(req, '', 0) });
  }
  if (m === 'POST' && p === '/api/password') {
    const b = await readBody(req, 5000);
    if (!(await checkPw(String(b.current || ''), u.pw))) return fail(res, 400, 'Your current password is incorrect.', 'bad_current');
    const e = pwProblem(String(b.next || '')); if (e) return fail(res, 400, e, 'weak');
    if (b.next === b.current) return fail(res, 400, 'Choose a password different from the current one.', 'same');
    u.pw = await hashPw(String(b.next)); u.mustChange = false; saveUser(u); killSessions(u.id, sess.hash);
    audit(u.id, 'Password changed', ''); flushAudit();
    return send(res, 200, { ok: true });
  }
  if (u.mustChange) {
    if (m === 'GET' && p === '/api/state') return send(res, 200, { ok: true, mustChange: true, me: u.id, orgName: orgName() });
    return fail(res, 403, 'You must set a new password before continuing.', 'must_change_password');
  }

  if (m === 'GET' && p === '/api/version') return send(res, 200, { ok: true, v: VERSION });
  if (m === 'GET' && p === '/api/state') {
    const s = S(), manage = has(u, 'user.manage');
    return send(res, 200, {
      ok: true, v: VERSION, me: u.id, mustChange: false,
      state: { users: s.users.map(x => pub(x, manage || x.id === u.id)), docs: s.docs.filter(d => E.canView(u, d)), perms: s.perms, divisions: s.divisions, refs: s.refs, designations: s.designations, holidays: s.holidays, oic: s.oic, settings: s.settings, schedules: s.schedules, leaveTypes: s.leaveTypes, spItems: s.spItems, spConfigs: has(u, 'config.manage') ? s.spConfigs : [] }
    });
  }

  /* --- workflow configuration (System Administrator only; document endpoints stay on legacy rules) --- */
  if (p === '/api/workflows' || p.startsWith('/api/workflows/')) {
    if (u.role !== 'sysadmin') return fail(res, 403, 'Only the System Administrator can manage workflows.', 'forbidden');
    if (m === 'GET' && p === '/api/workflows') {
      const rows=db.prepare(`SELECT w.id,w.name,w.doc_type,w.active,v.id version_id,v.version,v.status,v.published_at
        FROM workflows w LEFT JOIN workflow_versions v ON v.id=(SELECT id FROM workflow_versions WHERE workflow_id=w.id ORDER BY version DESC LIMIT 1) ORDER BY w.name`).all();
      const modes=db.prepare('SELECT doc_type,mode,version_id FROM workflow_modes').all();
      return send(res,200,{ok:true,workflows:rows,modes});
    }
    if (m==='POST' && p==='/api/workflows') {
      const b=await objBody(req,500000), d=b.definition;
      if(!str(b.name,120)||!str(b.docType,200))return fail(res,400,'Provide a workflow name and document type.','invalid');const shape=wfShapeError(d);if(shape)return fail(res,400,shape,'invalid');
      const id=wfId(),versionId=wfId(),at=wfNow(),ver=1;
      tx(()=>{db.prepare('INSERT INTO workflows(id,name,doc_type,created_at,created_by) VALUES(?,?,?,?,?)').run(id,str(b.name,120),str(b.docType,200),at,u.id);db.prepare("INSERT INTO workflow_versions(id,workflow_id,version,status,definition,created_at,created_by) VALUES(?,?,?,'DRAFT','{}',?,?)").run(versionId,id,ver,at,u.id);wfStoreGraph(versionId,d);db.prepare("INSERT OR IGNORE INTO workflow_modes(doc_type,mode) VALUES(?,'LEGACY')").run(str(b.docType,200));wfAudit(u.id,'Workflow created',str(b.name,120)+' for '+str(b.docType,200));wfAudit(u.id,'Workflow version created',str(b.name,120)+' v'+ver+' (draft)');});
      return send(res,201,{ok:true,workflow:wfRead(versionId)});
    }
    const match=p.match(/^\/api\/workflows\/([^/]+)(?:\/versions\/([^/]+)(?:\/(validate|publish|simulate|fork))?)?$/);
    if (!match) return fail(res,404,'Not found.','not_found');
    const [,wid,vid,action]=match;
    if (m==='GET'&&!vid) {const row=db.prepare('SELECT id,name,doc_type,active FROM workflows WHERE id=?').get(wid);if(!row)return fail(res,404,'Workflow not found.','not_found');return send(res,200,{ok:true,workflow:row,versions:db.prepare('SELECT id,version,status,created_at,published_at FROM workflow_versions WHERE workflow_id=? ORDER BY version DESC').all(wid)});}
    if(!vid)return fail(res,404,'Not found.','not_found');
    const current=db.prepare('SELECT * FROM workflow_versions WHERE id=? AND workflow_id=?').get(vid,wid);if(!current)return fail(res,404,'Workflow version not found.','not_found');
    if(m==='GET'&&!action)return send(res,200,{ok:true,workflow:wfRead(vid)});
    if(m==='PUT'&&!action){if(current.status!=='DRAFT')return fail(res,409,'Published versions are immutable. Fork this version to make a draft.','immutable');const b=await objBody(req,500000),d=b.definition,shape=wfShapeError(d);if(shape)return fail(res,400,shape,'invalid');if(!str(b.name,120)||!str(b.docType,200))return fail(res,400,'Provide a workflow name and document type.','invalid');const old=wfRead(vid);if(b.expectedRevision&&b.expectedRevision!==old.revision)return fail(res,409,'This draft was changed by another administrator. Reload before saving.','workflow_conflict');const nextNodes=new Map(d.nodes.map(n=>[n.id,n])),oldNodes=new Map(old.nodes.map(n=>[n.id,n]));tx(()=>{wfStoreGraph(vid,d);db.prepare('UPDATE workflows SET name=?,doc_type=? WHERE id=?').run(str(b.name,120),str(b.docType,200),wid);db.prepare("UPDATE workflow_versions SET validation='[]' WHERE id=?").run(vid);const name=str(b.name,120)+' v'+current.version;d.nodes.filter(n=>!oldNodes.has(n.id)).forEach(n=>wfAudit(u.id,'Workflow node added',name+': '+str(n.label,120)));old.nodes.filter(n=>!nextNodes.has(n.id)).forEach(n=>wfAudit(u.id,'Workflow node removed',name+': '+n.label));d.nodes.filter(n=>oldNodes.has(n.id)&&JSON.stringify(n)!==JSON.stringify(oldNodes.get(n.id))).forEach(n=>wfAudit(u.id,'Workflow node changed',name+': '+str(n.label,120)));if(JSON.stringify(old.edges)!==JSON.stringify(d.edges))wfAudit(u.id,'Workflow transitions changed',name);wfAudit(u.id,'Workflow edited',name);});return send(res,200,{ok:true,workflow:wfRead(vid)});}
    if(m==='POST'&&action==='validate'){const d=wfRead(vid),errors=wfValid(d);db.prepare('UPDATE workflow_versions SET validation=? WHERE id=?').run(JSON.stringify(errors),vid);wfAudit(u.id,'Workflow validated',d.name+' v'+d.version+': '+(errors.length?errors.length+' error(s)':'valid'));return send(res,200,{ok:true,errors});}
    if(m==='POST'&&action==='publish'){if(current.status!=='DRAFT')return fail(res,409,'This version is already published.','immutable');const d=wfRead(vid),errors=wfValid(d);if(errors.length){db.prepare('UPDATE workflow_versions SET validation=? WHERE id=?').run(JSON.stringify(errors),vid);return send(res,400,{ok:false,error:'Fix validation errors before publishing.',code:'invalid_workflow',errors});}const at=wfNow();tx(()=>{db.prepare("UPDATE workflow_versions SET status='PUBLISHED',published_at=?,published_by=?,validation='[]' WHERE id=? AND status='DRAFT'").run(at,u.id,vid);wfAudit(u.id,'Workflow published',d.name+' v'+d.version);});return send(res,200,{ok:true,workflow:wfRead(vid)});}
    if(m==='POST'&&action==='simulate'){const b=await objBody(req,10000),d=wfRead(vid);const result=wfSimulate(d,b);wfAudit(u.id,'Workflow simulated',d.name+' v'+d.version+': '+result.path.length+' steps');return send(res,200,result);}
    if(m==='POST'&&action==='fork'){const d=wfRead(vid),id=wfId(),at=wfNow(),ver=db.prepare('SELECT COALESCE(MAX(version),0)+1 n FROM workflow_versions WHERE workflow_id=?').get(wid).n;tx(()=>{db.prepare("INSERT INTO workflow_versions(id,workflow_id,version,status,definition,created_at,created_by) VALUES(?,?,?,'DRAFT','{}',?,?)").run(id,wid,ver,at,u.id);wfStoreGraph(id,d);wfAudit(u.id,'Workflow version created',d.name+' v'+ver+' forked from v'+d.version);});return send(res,201,{ok:true,workflow:wfRead(id)});}
    return fail(res,404,'Not found.','not_found');
  }
  const modeMatch=p.match(/^\/api\/workflow-modes\/([^/]+)$/);
  if(modeMatch){if(u.role!=='sysadmin')return fail(res,403,'Only the System Administrator can manage workflows.','forbidden');if(m==='PUT'){const b=await objBody(req,10000),docType=decodeURIComponent(modeMatch[1]),mode=b.mode;if(!['LEGACY','ENGINE'].includes(mode))return fail(res,400,'Choose LEGACY or ENGINE.','invalid');if(mode==='ENGINE')return fail(res,409,'Engine execution has not been enabled for document actions yet. Keep this document type in LEGACY until the migration is verified.','migration_not_ready');db.prepare("INSERT INTO workflow_modes(doc_type,mode,version_id) VALUES(?,'LEGACY',NULL) ON CONFLICT(doc_type) DO UPDATE SET mode='LEGACY',version_id=NULL").run(docType);wfAudit(u.id,'Workflow mode changed',docType+' set to LEGACY');return send(res,200,{ok:true});}}

  /* --- documents --- */
  if (m === 'POST' && p === '/api/docs') {
    if (!has(u, 'doc.log')) return fail(res, 403, 'You are not allowed to log documents.', 'forbidden');
    const b = await readBody(req, 50000);
    const o = { commType: str(b.commType, 100), source: str(b.source, 300), refNo: str(b.refNo, 100), subject: str(b.subject, 2000), docType: str(b.docType, 200), division: str(b.division, 60), pages: str(b.pages, 40), priority: b.priority === 'Urgent' ? 'Urgent' : 'Normal', region: str(b.region, 100), reportingPeriod: str(b.reportingPeriod, 20), remarks: str(b.remarks, 1000), url: str(b.url || '', 2000), draftUrl: str(b.draftUrl || '', 2000), revUrl: str(b.revUrl || '', 2000) };
    const s = S();
    if (!s.refs.comm.some(c => E.commName(c) === o.commType && c.active !== false)) return fail(res, 400, 'Choose a valid communication type.', 'invalid');
    if (!s.refs.doc.some(x => x.name === o.docType && x.active !== false)) return fail(res, 400, 'Choose a valid document type.', 'invalid');
    for (const [k, lbl] of [['url', 'Document URL'], ['draftUrl', 'Draft File URL'], ['revUrl', 'Revised File URL']]) if (o[k] && !/^https?:\/\/.{3}/.test(o[k])) return fail(res, 400, lbl + ' must start with http:// or https://', 'invalid');
    if (o.reportingPeriod && !E.normMonth(o.reportingPeriod)) return fail(res, 400, 'Choose the reporting period from the twelve months of the year.', 'invalid');
    o.reportingPeriod = o.reportingPeriod ? E.normMonth(o.reportingPeriod) : '';
    /* a reporting-period report is routed by region and its screen no longer asks for a division;
       logDoc fills one in, so only the other document types are checked here */
    if (!E.uById || (!E.isRegularDoc(o.docType) && !s.divisions.some(x => x.code === o.division))) return fail(res, 400, 'Choose a valid division.', 'invalid');
    let at = isoOrNull(b.receivedAt) || new Date();
    if (at > new Date(Date.now() + DAY)) at = new Date();
    const r = E.logDoc(o, u.id, at, !!b.forward && has(u, 'doc.forward'));
    if (!r.ok) return fail(res, 400, r.error, 'rule');
    saveDoc(r.doc); saveKV('seq'); audit(u.id, 'Document logged', r.doc.trackNo); flushAudit(); bump();
    return send(res, 200, { ok: true, msg: r.msg, id: r.doc.id });
  }
  let mm = p.match(/^\/api\/docs\/([\w-]+)\/act$/);
  if (m === 'POST' && mm) {
    const b = await readBody(req, 50000);
    const d = S().docs.find(x => x.id === mm[1]);
    if (!d || !E.canView(u, d)) return fail(res, 404, 'Document not found.', 'not_found');
    if (!ACT_TYPES.includes(b.type)) return fail(res, 400, 'Unknown action.', 'invalid');
    const payload = cleanActPayload(b.payload && typeof b.payload === 'object' ? b.payload : {});
    const tn = d.trackNo;
    const r = E.act(d.id, u.id, b.type, payload);
    if (!r.ok) return fail(res, /authorised/.test(r.error) ? 403 : 400, r.error, 'rule');
    if (r.deleted) st.delDoc.run(d.id); else saveDoc(d);
    audit(u.id, 'Document action: ' + b.type, tn); flushAudit(); bump();
    return send(res, 200, { ok: true, msg: r.msg, deleted: !!r.deleted });
  }

  /* --- personnel schedule (inspections, leave, meetings) --- */
  if (m === 'POST' && p === '/api/schedules') {
    if (!has(u, 'schedule.manage')) return fail(res, 403, 'You are not allowed to add schedules.', 'forbidden');
    const b = await objBody(req, 30000), r = cleanSchedule(b, null);
    if (!r.ok) return fail(res, 400, r.error, 'invalid');
    const conf = E.scheduleConflicts(r.sch, null);
    if (conf.length && !bool(b.confirm)) return fail(res, 409, 'Scheduling conflict.', 'conflict', { conflicts: conf });
    const at = new Date().toISOString();
    const sch = Object.assign(r.sch, { id: crypto.randomBytes(6).toString('hex'), createdBy: u.id, createdAt: at, updatedBy: u.id, updatedAt: at });
    S().schedules.push(sch); saveSched(sch);
    audit(u.id, 'Schedule added', schedAuditText(sch) + (conf.length ? ' – saved after confirming ' + plural(conf.length, 'conflict warning') : '')); flushAudit(); bump();
    return send(res, 200, { ok: true, id: sch.id, conflicts: conf.length });
  }
  mm = p.match(/^\/api\/schedules\/([\w-]+)$/);
  if (mm && (m === 'PUT' || m === 'DELETE')) {
    if (!has(u, 'schedule.manage')) return fail(res, 403, 'You are not allowed to change schedules.', 'forbidden');
    const s = S(), prev = s.schedules.find(x => x.id === mm[1]);
    if (!prev) return fail(res, 404, 'Schedule not found.', 'not_found');
    if (m === 'DELETE') {
      s.schedules = s.schedules.filter(x => x.id !== prev.id); st.delSched.run(prev.id);
      audit(u.id, 'Schedule deleted', schedAuditText(prev)); flushAudit(); bump();
      return send(res, 200, { ok: true });
    }
    const b = await objBody(req, 30000), r = cleanSchedule(b, prev);
    if (!r.ok) return fail(res, 400, r.error, 'invalid');
    const conf = E.scheduleConflicts(Object.assign({ id: prev.id }, r.sch), prev.id);
    if (conf.length && !bool(b.confirm)) return fail(res, 409, 'Scheduling conflict.', 'conflict', { conflicts: conf });
    Object.assign(prev, r.sch, { updatedBy: u.id, updatedAt: new Date().toISOString() });
    saveSched(prev);
    audit(u.id, 'Schedule updated', schedAuditText(prev) + (conf.length ? ' – saved after confirming ' + plural(conf.length, 'conflict warning') : '')); flushAudit(); bump();
    return send(res, 200, { ok: true, id: prev.id, conflicts: conf.length });
  }
  if (m === 'PUT' && p === '/api/leave-types') {
    if (!has(u, 'config.manage')) return fail(res, 403, 'Not allowed.', 'forbidden');
    const b = await objBody(req, 50000), v = b.value, s = S();
    if (!Array.isArray(v) || v.length > 100) return fail(res, 400, 'Invalid leave types.', 'invalid');
    const prevMap = new Map(s.leaveTypes.map(t => [t.id, t])), at = new Date().toISOString();
    const clean = v.map(t => {
      const old = prevMap.get(str(t && t.id, 40));
      return { id: old ? old.id : crypto.randomBytes(5).toString('hex'), name: str(t && t.name, 100), description: str(t && t.description, 300), active: t && t.active !== undefined ? bool(t.active) : true, createdAt: old ? old.createdAt : at, updatedAt: at };
    });
    if (clean.some(t => !t.name) || new Set(clean.map(t => t.name.toLowerCase())).size !== clean.length) return fail(res, 400, 'Leave type names must be filled in and unique.', 'invalid');
    if (s.leaveTypes.some(t => !clean.some(c => c.id === t.id))) return fail(res, 400, 'A leave type cannot be removed. Deactivate it instead.', 'invalid');
    s.leaveTypes = clean; saveKV('leaveTypes');
    audit(u.id, 'Configuration changed: leaveTypes', str(b.note, 300)); flushAudit(); bump();
    return send(res, 200, { ok: true });
  }

  /* --- special reports (Phase 11) --- */
  if (m === 'POST' && p === '/api/special-reports/configs') {
    if (!has(u, 'config.manage')) return fail(res, 403, 'Not allowed.', 'forbidden');
    const b = await objBody(req, 20000), r = cleanSrConfig(b, null);
    if (!r.ok) return fail(res, 400, r.error, 'invalid');
    const at = new Date().toISOString(), c = Object.assign(r.c, { id: srIdOf(), createdBy: u.id, createdAt: at, updatedBy: u.id, updatedAt: at, issue: null });
    S().spConfigs.push(c); srSaveCfg(c);
    audit(u.id, 'Special Report schedule created', c.name + ' – ' + E.srFreqName(c.frequency) + ', ' + E.srMonthsLabel(c.months) + ', ' + c.threshold + ' working days, assigned to ' + srNames(c.assignUsers) + (c.assignDivisions.length ? ' + division focal(s) ' + c.assignDivisions.join(', ') : '') + ', ' + (c.active ? 'active' : 'inactive'));
    const g = c.active ? srGenerate(srNow(), 'System') : { made: [], issues: [] };
    flushAudit(); bump();
    return send(res, 200, { ok: true, id: c.id, generated: g.made.length });
  }
  mm = p.match(/^\/api\/special-reports\/configs\/([\w-]+)(?:\/(active))?$/);
  if (mm && (m === 'PUT' || m === 'POST')) {
    if (!has(u, 'config.manage')) return fail(res, 403, 'Not allowed.', 'forbidden');
    const prev = S().spConfigs.find(x => x.id === mm[1]);
    if (!prev) return fail(res, 404, 'Special Report not found.', 'not_found');
    const b = await objBody(req, 20000);
    let r;
    if (mm[2] === 'active' && m === 'POST') {
      /* the Activate / Deactivate button: only the status changes. Activating again never back-fills the months the
         schedule was switched off: its first period moves up to last month unless it is already later. */
      const on = bool(b.active), c0 = Object.assign({}, prev, { active: on });
      if (on && !prev.active) { const pp = srPrevPeriod(srNow()); if (String(prev.fromPeriod) < pp) c0.fromPeriod = pp; }
      const err = on ? E.srValidate(c0, { activeUser: srUserOk, division: code => S().divisions.some(d => d.code === code) }) : '';
      if (err) return fail(res, 400, 'Cannot activate yet: ' + err, 'invalid');
      r = { ok: true, c: c0 };
    } else if (m === 'PUT' && !mm[2]) r = cleanSrConfig(b, prev);
    else return fail(res, 404, 'Not found.', 'not_found');
    if (!r.ok) return fail(res, 400, r.error, 'invalid');
    /* pending and completed reports keep the name, deadline and assignees they were generated with */
    const changes = srDiff(prev, r.c);
    Object.assign(prev, r.c, { updatedBy: u.id, updatedAt: new Date().toISOString() });
    if (!r.c.active) prev.issue = null;
    srSaveCfg(prev);
    audit(u.id, mm[2] ? (prev.active ? 'Special Report schedule activated' : 'Special Report schedule deactivated') : 'Special Report schedule updated', prev.name + (changes.length ? ' – ' + changes.join('; ') : ' – no change'));
    const g = prev.active ? srGenerate(srNow(), 'System') : { made: [], issues: [] };
    flushAudit(); bump();
    return send(res, 200, { ok: true, generated: g.made.length });
  }
  if (m === 'POST' && p === '/api/special-reports/generate') {
    if (!has(u, 'config.manage')) return fail(res, 403, 'Not allowed.', 'forbidden');
    const b = await objBody(req, 2000);
    let now = srNow();
    if (b.asOf !== undefined) {
      if (!SR_TEST) return fail(res, 400, 'Generation always uses today’s date.', 'invalid');
      if (typeof b.asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.asOf)) return fail(res, 400, 'asOf must be a date.', 'invalid');
      now = E.parseD(b.asOf);
    }
    const g = srGenerate(now, u.id);
    audit(u.id, 'Special Reports generation run', g.made.length + ' created' + (g.issues.length ? ', ' + g.issues.length + ' could not be created' : '')); flushAudit(); bump();
    return send(res, 200, { ok: true, created: g.made.length, issues: g.issues });
  }
  mm = p.match(/^\/api\/special-reports\/items\/([\w-]+)\/url$/);
  if (m === 'PUT' && mm) {
    const it = S().spItems.find(x => x.id === mm[1]);
    if (!it) return fail(res, 404, 'Special Report not found.', 'not_found');
    const assigned = it.assign.some(a => a.userId === u.id && (a.status === 'active' || a.status === 'completed'));
    if (!has(u, 'config.manage') && !assigned) return fail(res, 403, 'You are not authorised to update this Special Report URL.', 'forbidden');
    const b = await objBody(req, 3000), value = str(b.url || '', 2000).trim();
    if (value && !/^https?:\/\/.{3}/i.test(value)) return fail(res, 400, 'URL must start with http:// or https://', 'invalid');
    const old = it.url || '';
    it.url = value;
    try { tx(() => st.updSrItem.run(srItemJson(it), it.id)); }
    catch (e) { it.url = old; return fail(res, 500, 'Could not save the URL. Nothing was changed.', 'server'); }
    audit(u.id, 'Special Report URL updated', it.title + (value ? (old ? ' – URL changed' : ' – URL added') : ' – URL removed'));
    flushAudit(); bump();
    return send(res, 200, { ok: true });
  }
  mm = p.match(/^\/api\/special-reports\/items\/([\w-]+)\/action$/);
  if (m === 'POST' && mm) {
    const it = S().spItems.find(x => x.id === mm[1]);
    if (!it) return fail(res, 404, 'Special Report not found.', 'not_found');
    if (it.status !== 'pending') return fail(res, 400, 'This Special Report is already logged out.', 'rule');
    const b = await readBody(req, 20000), type = str(b.type, 40);
    const allowed = ['submit', 'sup_return', 'sup_approve', 'div_return', 'div_approve', 'dept_return', 'dept_clear', 'comment', 'logout'];
    if (!allowed.includes(type)) return fail(res, 400, 'Unknown Special Report workflow action.', 'invalid');
    const w = srWorkflowInit(it), priorW = JSON.parse(JSON.stringify(w)), priorItem = { status: it.status, stopAt: it.stopAt, completedBy: it.completedBy, completionNote: it.completionNote }, payload = cleanActPayload(b.payload && typeof b.payload === 'object' ? b.payload : {});
    const mine = it.assign.find(a => a.userId === u.id && a.status === 'active');
    if (type === 'submit' && w.status === 'processing') {
      if (!mine && !has(u, 'doc.override')) return fail(res, 403, 'This Special Report is not assigned to you.', 'forbidden');
      if (w.assignee && w.assignee !== u.id) return fail(res, 403, 'Another assigned person has taken responsibility for this report.', 'forbidden');
      w.assignee = u.id;
    }
    if (type === 'submit' && w.status === 'compliance' && w.assignee !== u.id && !has(u, 'doc.override')) return fail(res, 403, 'Only the staff member responsible for compliance can resubmit this report.', 'forbidden');
    const d = srWorkflowDoc(it, w);
    if (type === 'submit' && w.status === 'processing') d.assignee = u.id;
    S().docs.push(d);
    let result;
    try { result = E.act(it.id, u.id, type, payload); }
    finally { S().docs.pop(); }
    if (!result.ok) { it.workflow = priorW; return fail(res, /authorised/.test(result.error) ? 403 : 400, result.error, 'rule'); }
    const at = new Date().toISOString(), changedAssign = [];
    if (type === 'submit' && priorW.status === 'processing') {
      it.assign.filter(a => a.status === 'active' && a.userId !== u.id).forEach(a => { changedAssign.push({ a, before: Object.assign({}, a) }); Object.assign(a, { status: 'closed', endedAt: at, endedBy: u.id, note: 'Forwarded for review by ' + u.name }); });
    }
    if (d.status === 'out') {
      it.assign.filter(a => a.status === 'active').forEach(a => { changedAssign.push({ a, before: Object.assign({}, a) }); Object.assign(a, { status: 'closed', endedAt: at, endedBy: u.id, note: 'Logged out' }); });
    }
    srWorkflowSave(it, w, d);
    try { tx(() => { st.updSrItem.run(srItemJson(it), it.id); changedAssign.forEach(x => srSaveAssign(x.a)); }); }
    catch (e) {
      it.workflow = priorW; Object.assign(it, priorItem); changedAssign.forEach(x => Object.assign(x.a, x.before));
      return fail(res, 500, 'Could not save the workflow action. Nothing was changed.', 'server');
    }
    audit(u.id, 'Special Report workflow: ' + type, it.title); flushAudit(); bump();
    return send(res, 200, { ok: true, msg: result.msg });
  }
  mm = p.match(/^\/api\/special-reports\/items\/([\w-]+)\/complete$/);
  if (m === 'POST' && mm) return fail(res, 400, 'Use the review, clearance and log-out workflow to complete this report.', 'rule');
  mm = p.match(/^\/api\/special-reports\/items\/([\w-]+)\/reassign$/);
  if (m === 'POST' && mm) {
    const it = S().spItems.find(x => x.id === mm[1]);
    if (!it) return fail(res, 404, 'Special Report not found.', 'not_found');
    const b = await objBody(req, 5000), at = new Date().toISOString();
    if (it.status !== 'pending') return fail(res, 400, 'This Special Report is already completed.', 'rule');
    /* reassign: the administrator names the complete new set of responsible people */
    if (!has(u, 'config.manage')) return fail(res, 403, 'Not allowed.', 'forbidden');
    const wf = srWorkflowInit(it);
    if (wf.status !== 'processing' || wf.assignee) return fail(res, 400, 'This report has entered review and can no longer be reassigned here.', 'rule');
    const want = [...new Set((Array.isArray(b.users) ? b.users : []).map(x => str(x, 40)).filter(Boolean))];
    if (!want.length) return fail(res, 400, 'Choose at least one responsible person.', 'invalid');
    if (want.some(id => !srUserOk(id))) return fail(res, 400, 'Choose responsible personnel from the active users. The System Administrator account has no For My Action list.', 'invalid');
    const live = it.assign.filter(a => a.status === 'active'), drop = live.filter(a => !want.includes(a.userId)), add = want.filter(id => !live.some(a => a.userId === id));
    if (!drop.length && !add.length) return fail(res, 400, 'That is already the current assignment.', 'invalid');
    const note = str(b.note, 300), fresh = add.map(uid => ({ id: srIdOf(), itemId: it.id, userId: uid, status: 'active', assignedAt: at, assignedBy: u.id, endedAt: null, endedBy: '', note }));
    const was = drop.map(a => ({ a, prev: Object.assign({}, a) }));
    drop.forEach(a => Object.assign(a, { status: 'reassigned', endedAt: at, endedBy: u.id, note }));
    try { tx(() => { drop.forEach(srSaveAssign); fresh.forEach(srSaveAssign); }); }
    catch (e) { was.forEach(x => Object.assign(x.a, x.prev)); return fail(res, 500, 'Could not save. Nothing was changed.', 'server'); }
    it.assign.push(...fresh);
    audit(u.id, 'Special Report reassigned', it.title + ' – from ' + srNames(drop.map(a => a.userId)) + ' to ' + srNames(want) + (note ? ' – ' + note : '')); flushAudit(); bump();
    return send(res, 200, { ok: true });
  }

  /* --- users --- */
  if (m === 'POST' && p === '/api/users') {
    if (!has(u, 'user.manage')) return fail(res, 403, 'Not allowed.', 'forbidden');
    const b = await readBody(req, 5000), s = S();
    const name = str(b.name, 120), username = str(b.username, 60), role = b.role, division = str(b.division, 60);
    if (!name) return fail(res, 400, 'Enter the full name.', 'invalid');
    if (!/^[a-z0-9._-]{3,}$/i.test(username)) return fail(res, 400, 'Usernames need at least 3 letters, numbers, dots, dashes or underscores.', 'invalid');
    if (!E.ROLE_ORDER.includes(role)) return fail(res, 400, 'Choose a role.', 'invalid');
    if (division && !s.divisions.some(x => x.code === division)) return fail(res, 400, 'Unknown division.', 'invalid');
    if (s.users.some(x => x.username.toLowerCase() === username.toLowerCase())) return fail(res, 400, 'That username is already taken.', 'dup');
    const e = pwProblem(String(b.password || '')); if (e) return fail(res, 400, e, 'weak');
    const nu = { id: crypto.randomBytes(6).toString('hex'), name, username, role, division, active: true, present: true, pw: await hashPw(String(b.password)), mustChange: true, lastLogin: null };
    s.users.push(nu); saveUser(nu); audit(u.id, 'User created', name + ' (' + E.ROLES[role] + ')'); flushAudit(); bump();
    return send(res, 200, { ok: true });
  }
  mm = p.match(/^\/api\/users\/([\w-]+)(?:\/(reset|presence))?$/);
  if (mm && (m === 'PUT' || m === 'POST')) {
    const t = E.uById(mm[1]); if (!t) return fail(res, 404, 'User not found.', 'not_found');
    const b = await readBody(req, 5000), s = S();
    if (mm[2] === 'presence') {
      if (!(has(u, 'oic.manage') || (t.id === u.id && ['dept_manager', 'div_manager'].includes(u.role)))) return fail(res, 403, 'Not allowed.', 'forbidden');
      t.present = !!b.present; saveUser(t); audit(u.id, 'Presence changed', t.name + ' marked ' + (t.present ? 'present' : 'away')); flushAudit(); bump();
      return send(res, 200, { ok: true });
    }
    if (!has(u, 'user.manage')) return fail(res, 403, 'Not allowed.', 'forbidden');
    if (mm[2] === 'reset') {
      const e = pwProblem(String(b.password || '')); if (e) return fail(res, 400, e, 'weak');
      t.pw = await hashPw(String(b.password)); t.mustChange = true; saveUser(t); killSessions(t.id, t.id === u.id ? sess.hash : '');
      audit(u.id, 'Password reset', t.name); flushAudit(); bump();
      return send(res, 200, { ok: true });
    }
    if (m !== 'PUT') return fail(res, 404, 'Not found.', 'not_found');
    const name = str(b.name, 120), username = str(b.username, 60), role = b.role, division = str(b.division, 60), active = !!b.active;
    if (!name) return fail(res, 400, 'Enter the full name.', 'invalid');
    if (!/^[a-z0-9._-]{3,}$/i.test(username)) return fail(res, 400, 'Usernames need at least 3 letters, numbers, dots, dashes or underscores.', 'invalid');
    if (!E.ROLE_ORDER.includes(role)) return fail(res, 400, 'Choose a role.', 'invalid');
    if (division && !s.divisions.some(x => x.code === division)) return fail(res, 400, 'Unknown division.', 'invalid');
    if (s.users.some(x => x.username.toLowerCase() === username.toLowerCase() && x.id !== t.id)) return fail(res, 400, 'That username is already taken.', 'dup');
    const admins = s.users.filter(x => x.active && x.role === 'sysadmin');
    if (t.role === 'sysadmin' && (role !== 'sysadmin' || !active) && admins.length <= 1) return fail(res, 400, 'At least one active System Administrator is required.', 'rule');
    if (t.id === u.id && !active) return fail(res, 400, 'You cannot deactivate your own account.', 'rule');
    if (t.id === u.id && role !== u.role && u.role === 'sysadmin' && admins.length <= 1) return fail(res, 400, 'At least one active System Administrator is required.', 'rule');
    Object.assign(t, { name, username, role, division, active });
    saveUser(t); if (!active) killSessions(t.id);
    audit(u.id, 'User updated', t.name); flushAudit(); bump();
    return send(res, 200, { ok: true });
  }

  /* --- configuration --- */
  mm = p.match(/^\/api\/config\/(\w+)$/);
  if (m === 'PUT' && mm) {
    const sec = mm[1], b = await readBody(req, 500000), s = S();
    const need = { perms: 'role.manage', oic: 'oic.manage' }[sec] || 'config.manage';
    if (!['perms', 'oic', 'divisions', 'refs', 'designations', 'holidays', 'settings'].includes(sec)) return fail(res, 404, 'Unknown section.', 'not_found');
    if (!has(u, need)) return fail(res, 403, 'Not allowed.', 'forbidden');
    const v = b.value, uidOk = id => !id || (E.uById(id) && E.uById(id).active);
    let clean, err = '';
    if (sec === 'perms') {
      const known = E.PERMS.map(x => x[1]); clean = {};
      E.ROLE_ORDER.forEach(r => { clean[r] = Array.isArray(v && v[r]) ? v[r].filter(x => known.includes(x)) : []; });
      clean.sysadmin = known.slice();
    } else if (sec === 'oic') {
      if (!v || !uidOk(v.userId) || (v.enabled && !v.userId)) err = 'Choose an active user as OIC.'; else clean = { enabled: !!v.enabled, userId: v.userId || '' };
    } else if (sec === 'divisions') {
      if (!Array.isArray(v) || !v.length || v.length > 50) err = 'Invalid divisions.'; else {
        clean = v.map(d => ({ code: str(d.code, 40), focal: str(d.focal, 40) }));
        if (clean.some(d => !d.code || !uidOk(d.focal)) || new Set(clean.map(d => d.code)).size !== clean.length) err = 'Division codes must be unique and focals must be active users.';
        else { const gone = s.divisions.filter(d => !clean.some(c => c.code === d.code)); if (gone.some(d => s.docs.some(x => x.division === d.code))) err = 'A division that has documents cannot be removed.'; }
      }
    } else if (sec === 'refs') {
      if (!v || !Array.isArray(v.tx) || !Array.isArray(v.comm) || !Array.isArray(v.doc)) err = 'Invalid lists.'; else {
        const now = new Date().toISOString();
        const prevDoc = new Map(s.refs.doc.map(d => [d.name, d]));
        const prevComm = new Map(s.refs.comm.map(c => [E.commName(c), c]));
        const thr = t => (t.threshold == null || t.threshold === '') ? null : Math.max(1, Math.min(365, parseInt(t.threshold, 10) || 1));
        clean = {
          tx: v.tx.slice(0, 40).map(t => ({ name: str(t.name, 120), days: (t.days == null || t.days === '') ? null : Math.max(1, Math.min(365, parseInt(t.days, 10) || 1)), special: t.special ? true : undefined })),
          comm: v.comm.slice(0, 60).map(c => {
            const name = str(typeof c === 'string' ? c : c.name, 100), old = prevComm.get(name);
            return { name, description: str(c && c.description, 500), active: c && c.active !== undefined ? bool(c.active) : (old ? old.active !== false : true), createdAt: (old && old.createdAt) || now, updatedAt: now };
          }).filter(c => c.name),
          doc: v.doc.slice(0, 200).map(d => {
            const name = str(d.name, 200), old = prevDoc.get(name), basis = E.isDeadlineBasis(d.basis) ? d.basis : 'working_days';
            return { name, description: str(d.description, 1000), threshold: thr(d), unit: d.unit === 'calendar_days' ? 'calendar_days' : 'working_days', basis, active: d.active !== undefined ? bool(d.active) : (old ? old.active !== false : true), regular: false, createdAt: (old && old.createdAt) || now, updatedAt: now };
          }).filter(d => d.name)
        };
        clean.tx.forEach(t => { if (t.special === undefined) delete t.special; else t.days = null; });
        const commNames = s.refs.comm.map(E.commName);
        const goneComm = commNames.filter(n => !clean.comm.some(c => c.name === n));
        if (goneComm.some(n => s.docs.some(x => x.commType === n))) err = 'A communication type that is used by documents cannot be removed. Deactivate it instead.';
        else if (clean.tx.some(t => !t.name) || new Set(clean.tx.map(t => t.name)).size !== clean.tx.length || new Set(clean.comm.map(c => c.name)).size !== clean.comm.length || new Set(clean.doc.map(d => d.name)).size !== clean.doc.length) err = 'Names must be filled in and unique.';
        else if (clean.doc.some(d => d.basis === 'reporting_period' && !(d.threshold > 0))) err = 'A document type with a reporting-period basis needs a prescribed threshold of at least 1.';
        else {
          const keep = clean.doc.filter(d => d.active && d.basis === 'reporting_period').map(d => d.name);
          if (!keep.length) err = 'At least one active document type must keep a reporting-period basis, so regional reports still route to the designated staff.';
        }
      }
    } else if (sec === 'designations') {
      if (!Array.isArray(v) || v.length > 200) err = 'Invalid designations.'; else {
        clean = v.map(d => ({ name: str(d.name, 100), staff: str(d.staff, 40) }));
        if (clean.some(d => !d.name || !E.uById(d.staff) || !E.uById(d.staff).active) || new Set(clean.map(d => d.name)).size !== clean.length) err = 'Each region needs a unique name and an active designated staff member.';
      }
    } else if (sec === 'holidays') {
      if (!Array.isArray(v) || v.length > 400) err = 'Invalid holidays.'; else {
        clean = v.map(h => ({ date: str(h.date, 10), name: str(h.name, 120) }));
        if (clean.some(h => !/^\d{4}-\d{2}-\d{2}$/.test(h.date) || !h.name)) err = 'Each holiday needs a date and a name.';
      }
    } else if (sec === 'settings') {
      if (!v) err = 'Invalid settings.'; else {
        const n = k => Math.max(0, Math.min(1000, parseInt(v[k], 10) || 0));
        clean = { orgName: str(v.orgName, 150), prefix: str(v.prefix, 12).toUpperCase().replace(/[^A-Z0-9]/g, ''), dueSoonDays: n('dueSoonDays'), adminDeskDays: n('adminDeskDays'), focalDeskDays: n('focalDeskDays'), idleMinutes: n('idleMinutes'), resubmit: v.resubmit === 'restart' ? 'restart' : 'returner' };
        if (!clean.orgName || !clean.prefix) err = 'The office name and prefix cannot be empty.';
      }
    }
    if (err) return fail(res, 400, err, 'invalid');
    s[sec] = clean; saveKV(sec); if (sec === 'holidays') E.rebuildHS();
    audit(u.id, 'Configuration changed: ' + sec, str(b.note, 300)); flushAudit(); bump();
    return send(res, 200, { ok: true });
  }

  /* --- audit, backup --- */
  if (m === 'GET' && p === '/api/audit') {
    if (!has(u, 'audit.view')) return fail(res, 403, 'Not allowed.', 'forbidden');
    const q = str(url.searchParams.get('q') || '', 100).toLowerCase();
    const rows = db.prepare('SELECT at,by,action,detail FROM audit ORDER BY id DESC LIMIT 3000').all().map(r => ({ at: r.at, by: r.by ? ((E.uById(r.by) || {}).name || r.by) : '', action: r.action, detail: r.detail }));
    return send(res, 200, { ok: true, rows: (q ? rows.filter(r => (r.by + ' ' + r.action + ' ' + r.detail).toLowerCase().includes(q)) : rows).slice(0, 200) });
  }
  if (m === 'GET' && p === '/api/admin/backup') {
    if (!has(u, 'data.manage')) return fail(res, 403, 'Not allowed.', 'forbidden');
    const s = S(), out = { format: 'dts-backup', version: 1, exportedAt: new Date().toISOString(), users: s.users, docs: s.docs, schedules: s.schedules, spConfigs: s.spConfigs, spItems: s.spItems,
      workflows:db.prepare('SELECT * FROM workflows').all(),workflowVersions:db.prepare('SELECT * FROM workflow_versions').all(),workflowNodes:db.prepare('SELECT * FROM workflow_nodes').all(),workflowEdges:db.prepare('SELECT * FROM workflow_edges').all(),workflowModes:db.prepare('SELECT * FROM workflow_modes').all(),workflowInstances:db.prepare('SELECT * FROM workflow_instances').all(),workflowHistory:db.prepare('SELECT * FROM workflow_history').all() };
    CONFIG_KEYS.forEach(k => { out[k] = s[k]; });
    out.audit = db.prepare('SELECT at,by,action,detail FROM audit ORDER BY id').all();
    audit(u.id, 'Backup exported', ''); flushAudit();
    return send(res, 200, out, { 'Content-Disposition': 'attachment; filename="dts-backup-' + new Date().toISOString().slice(0, 10) + '.json"' });
  }
  if (m === 'POST' && p === '/api/admin/restore') {
    if (!has(u, 'data.manage')) return fail(res, 403, 'Not allowed.', 'forbidden');
    const b = await readBody(req, 100 * 1024 * 1024);
    if (b.format !== 'dts-backup' || !Array.isArray(b.users) || !Array.isArray(b.docs) || !b.settings || !b.refs || !b.perms || !Array.isArray(b.divisions)) return fail(res, 400, 'This is not a backup from this system.', 'invalid');
    if (!b.users.some(x => x.role === 'sysadmin' && x.active) || b.users.some(x => !x.id || typeof x.pw !== 'string')) return fail(res, 400, 'The backup must contain an active System Administrator.', 'invalid');
    tx(() => {
      db.exec('DELETE FROM users; DELETE FROM docs; DELETE FROM kv; DELETE FROM audit;');
      b.users.forEach(x => st.setUser.run(x.id, JSON.stringify(x)));
      b.docs.forEach(x => st.setDoc.run(x.id, JSON.stringify(x)));
      CONFIG_KEYS.forEach(k => { if (b[k] !== undefined) st.setKV.run(k, JSON.stringify(b[k])); });
      /* schedules are replaced only when the backup has them (backups made before the Personnel Schedule existed leave the current schedules alone) */
      if (Array.isArray(b.schedules)) { db.exec('DELETE FROM schedules'); b.schedules.map(normSchedule).filter(Boolean).forEach(x => st.setSched.run(x.id, JSON.stringify(x))); }
      /* Special Reports are replaced only when the backup has them (older backups leave the current ones alone) */
      if (Array.isArray(b.spConfigs) && Array.isArray(b.spItems)) {
        db.exec('DELETE FROM sr_assign; DELETE FROM sr_item; DELETE FROM sr_config');
        b.spConfigs.filter(x => x && x.id).forEach(srSaveCfg);
        b.spItems.filter(x => x && x.id && x.cfgId).forEach(it => { st.insSrItem.run(it.id, it.cfgId, it.year, it.month, srItemJson(it)); (it.assign || []).forEach(srSaveAssign); });
        st.setKV.run('spSeeded', '1');
      }
      /* Workflow tables are optional in older backups and remain untouched when absent. */
      if(Array.isArray(b.workflows)&&Array.isArray(b.workflowVersions)&&Array.isArray(b.workflowNodes)&&Array.isArray(b.workflowEdges)){
        db.exec('DELETE FROM workflow_history; DELETE FROM workflow_instances; DELETE FROM workflow_modes; DELETE FROM workflow_edges; DELETE FROM workflow_nodes; DELETE FROM workflow_versions; DELETE FROM workflows;');
        b.workflows.forEach(x=>db.prepare('INSERT INTO workflows(id,name,doc_type,created_at,created_by,active) VALUES(?,?,?,?,?,?)').run(x.id,x.name,x.doc_type,x.created_at,x.created_by,x.active));
        b.workflowVersions.forEach(x=>db.prepare('INSERT INTO workflow_versions(id,workflow_id,version,status,definition,created_at,created_by,published_at,published_by,validation) VALUES(?,?,?,?,?,?,?,?,?,?)').run(x.id,x.workflow_id,x.version,x.status,x.definition,x.created_at,x.created_by,x.published_at,x.published_by,x.validation||'[]'));
        b.workflowNodes.forEach(x=>db.prepare('INSERT INTO workflow_nodes(id,version_id,type,label,x,y,config) VALUES(?,?,?,?,?,?,?)').run(x.id,x.version_id,x.type,x.label,x.x,x.y,x.config));
        b.workflowEdges.forEach(x=>db.prepare('INSERT INTO workflow_edges(id,version_id,source,target,label,condition) VALUES(?,?,?,?,?,?)').run(x.id,x.version_id,x.source,x.target,x.label,x.condition));
        (b.workflowModes||[]).forEach(x=>db.prepare('INSERT INTO workflow_modes(doc_type,mode,version_id) VALUES(?,?,?)').run(x.doc_type,x.mode,x.version_id));
        (b.workflowInstances||[]).forEach(x=>db.prepare('INSERT INTO workflow_instances(id,workflow_id,version_id,document_id,status,current_node,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(x.id,x.workflow_id,x.version_id,x.document_id,x.status,x.current_node,x.created_at,x.updated_at));
        (b.workflowHistory||[]).forEach(x=>db.prepare('INSERT INTO workflow_history(id,instance_id,at,by,action,detail) VALUES(?,?,?,?,?,?)').run(x.id,x.instance_id,x.at,x.by,x.action,x.detail));
      }
      (Array.isArray(b.audit) ? b.audit : []).forEach(a => st.addAudit.run(a.at, a.by || '', a.action, a.detail || ''));
    });
    loadAll();
    db.prepare('DELETE FROM sessions WHERE h<>?').run(sess.hash);
    if (!E.uById(u.id)) db.prepare('DELETE FROM sessions').run();
    audit(u.id, 'Backup restored', b.docs.length + ' documents, ' + b.users.length + ' users'); flushAudit(); bump();
    return send(res, 200, { ok: true });
  }
  if (m === 'POST' && p === '/api/admin/clear-docs') {
    if (!has(u, 'data.manage')) return fail(res, 403, 'Not allowed.', 'forbidden');
    S().docs.length = 0; S().seq = {}; db.exec('DELETE FROM docs'); saveKV('seq');
    audit(u.id, 'All documents deleted', ''); flushAudit(); bump();
    return send(res, 200, { ok: true });
  }
  return fail(res, 404, 'Not found.', 'not_found');
}

/* ---------- static files ---------- */
const STATIC = { '/': ['index.html', 'text/html; charset=utf-8'], '/index.html': ['index.html', 'text/html; charset=utf-8'], '/client.js': ['client.js', 'text/javascript; charset=utf-8'], '/engine.js': ['engine.js', 'text/javascript; charset=utf-8'], '/app.css': ['app.css', 'text/css; charset=utf-8'], '/schedule.js': ['schedule.js', 'text/javascript; charset=utf-8'], '/schedule.css': ['schedule.css', 'text/css; charset=utf-8'], '/special.js': ['special.js', 'text/javascript; charset=utf-8'], '/special.css': ['special.css', 'text/css; charset=utf-8'], '/workflow.js': ['workflow.js', 'text/javascript; charset=utf-8'], '/workflow.css': ['workflow.css', 'text/css; charset=utf-8'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'], '/favicon.png': ['favicon.png', 'image/png'], '/logo-black.png': ['logo-black.png', 'image/png'], '/logo-white.png': ['logo-white.png', 'image/png'], '/login-bg.png': ['login-bg.png', 'image/png'] };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', CSP);
  if (isHttps(req)) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/healthz') return send(res, 200, { ok: true });
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    const f = STATIC[url.pathname];
    if (!f) { res.writeHead(url.pathname === '/favicon.ico' ? 204 : 404); return res.end(); }
    const buf = fs.readFileSync(path.join(PUB, f[0]));
    res.writeHead(200, { 'Content-Type': f[1], 'Cache-Control': 'no-cache' });
    return res.end(buf);
  } catch (e) {
    if (!res.headersSent) {
      if (e.status) return fail(res, e.status, e.message, 'bad_request');
      console.error(e);
      return fail(res, 500, 'Something went wrong on the server.', 'server');
    }
    res.end();
  }
});

/* ---------- daily backups of the database file ---------- */
function backupDb() {
  try {
    const dir = path.join(DATA, 'backups'); fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, 'dts-' + new Date().toISOString().slice(0, 10) + '.sqlite');
    if (!fs.existsSync(f)) db.exec("VACUUM INTO '" + f.replace(/'/g, "''") + "'");
    fs.readdirSync(dir).filter(n => n.endsWith('.sqlite')).sort().slice(0, -14).forEach(n => fs.unlinkSync(path.join(dir, n)));
  } catch (e) { console.error('Backup failed:', e.message); }
}

(async () => {
  if (db.prepare('SELECT COUNT(*) c FROM users').get().c === 0) await firstRun(); else loadAll();
  backupDb(); setInterval(backupDb, DAY).unref();
  /* Special Reports: recover anything missed while the server was down, then re-check every 15 minutes (a missed configured generation day is caught by the next check) */
  srTick(); setInterval(srTick, 15 * 60000).unref();
  server.listen(PORT, HOST, () => console.log('Document Tracking & Routing System listening on http://' + (HOST === '0.0.0.0' ? 'localhost' : HOST) + ':' + PORT + '  (time zone ' + process.env.TZ + ')'));
})();
process.on('SIGINT', () => { server.close(); db.close(); process.exit(0); });
process.on('SIGTERM', () => { server.close(); db.close(); process.exit(0); });
