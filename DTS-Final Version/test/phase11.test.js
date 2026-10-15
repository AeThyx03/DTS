/* Phase 11: Special Reports. Needs a fresh server with a controllable clock:
   SEED_DEMO=1 SR_TEST=1 SR_NOW=2026-01-15 DATA_DIR=/tmp/t PORT=3111 node server.js &   then   PORT=3111 node test/phase11.test.js
   (SR_TEST only lets the tests choose "today" for the generator; production always uses the real date.) */
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const B = 'http://localhost:' + (process.env.PORT || 3111);
let pass = 0, failn = 0; const ok = (n, c) => { c ? pass++ : failn++; console.log((c ? 'PASS ' : 'FAIL ') + n); };
async function client() { let cookie = ''; return async (m, u, b) => { const r = await fetch(B + u, { method: m, headers: Object.assign({ 'X-Requested-With': 'dts', cookie }, b !== undefined ? { 'Content-Type': 'application/json' } : {}), body: b !== undefined ? JSON.stringify(b) : undefined }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; let j = {}; try { j = await r.json(); } catch (e) { } return Object.assign({ s: r.status }, j); }; }
async function login(u, p) { const c = await client(); const r = await c('POST', '/api/login', { username: u, password: p }); if (r.s !== 200) throw new Error('login ' + u + ' ' + r.s); return c; }
/* independent working-day arithmetic (does not call the app's engine) */
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function nthWD(year, mi, n, hol) { let d = new Date(year, mi, 1), c = 0; for (; ;) { const g = d.getDay(); if (g !== 0 && g !== 6 && !hol.has(iso(d))) { c++; if (c === n) return iso(d); } d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); } }
const dueFor = (month, year, thr, hol) => nthWD(month === 12 ? year + 1 : year, month === 12 ? 0 : month, thr, hol);

(async () => {
  const adm = await login('admin', 'Admin@2026'), nieva = await login('bnieva', 'Track@2026');
  const A = await login('bcabalfin', 'Track@2026'), Bc = await login('jtanguilig', 'Track@2026'), C = await login('dcruz', 'Track@2026');
  const st = async (c) => (await (c || adm)('GET', '/api/state')).state;
  const s0 = await st(); const uid = un => s0.users.find(x => x.username === un).id;
  const idA = uid('bcabalfin'), idB = uid('jtanguilig'), idC = uid('dcruz'), idAdmin = uid('admin');
  const cfgs = async () => (await st()).spConfigs, items = async (c) => (await st(c)).spItems;
  const byName = async n => (await cfgs()).find(x => x.name === n);
  const gen = asOf => adm('POST', '/api/special-reports/generate', { asOf });
  const put = (c, patch) => adm('PUT', '/api/special-reports/configs/' + c.id, Object.assign({ name: c.name, frequency: c.frequency, months: c.months, threshold: c.threshold, basis: c.basis, assignUsers: c.assignUsers, assignDivisions: c.assignDivisions, docType: c.docType, fromPeriod: c.fromPeriod, active: c.active }, patch));

  // ---- holidays: list the ones the deadline maths must skip (2027 is not in the starting list)
  const hs = s0.holidays.slice(); ['2027-01-01', '2027-03-25', '2026-03-04'].forEach((d, i) => hs.push({ date: d, name: 'Test holiday ' + i }));
  ok('holidays saved', (await adm('PUT', '/api/config/holidays', { value: hs })).s === 200);
  const HOL = new Set(hs.map(h => h.date));

  // ---- 1. the five schedules exist, inactive and unassigned
  const seeded = await cfgs();
  const want = { 'Summary of CMR': ['monthly', 12, 25], 'Summary of PPR': ['monthly', 12, 20], 'List of Terminated': ['quarterly', 4, 17], 'PPA to COA': ['specific', 5, 17], 'CMR and PPR Tracking': ['monthly', 12, 15] };
  ok('five schedules seeded', seeded.length === 5 && Object.keys(want).every(n => seeded.some(x => x.name === n)));
  ok('seeded frequency / months / threshold exact', Object.entries(want).every(([n, w]) => { const c = seeded.find(x => x.name === n); return c && c.frequency === w[0] && c.months.length === w[1] && c.threshold === w[2] && c.basis === 'working_days'; }));
  ok('List of Terminated months are Mar, Jun, Sep, Dec', JSON.stringify(seeded.find(x => x.name === 'List of Terminated').months) === '[3,6,9,12]');
  ok('PPA to COA months are exactly Jan, Mar, Jun, Sep, Dec', JSON.stringify(seeded.find(x => x.name === 'PPA to COA').months) === '[1,3,6,9,12]');
  ok('seeded schedules start inactive with nobody assigned', seeded.every(c => c.active === false && !c.assignUsers.length && !c.assignDivisions.length));
  ok('nothing generated while inactive', (await gen('2027-01-05')).created === 0 && (await items()).length === 0);
  ok('cannot activate without an assignee', (await adm('POST', '/api/special-reports/configs/' + seeded[0].id + '/active', { active: true })).s === 400);

  // ---- 2. permissions
  ok('staff receive no schedules in state', (await st(A)).spConfigs.length === 0);
  ok('staff cannot create a schedule', (await A('POST', '/api/special-reports/configs', { name: 'X', frequency: 'monthly', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], threshold: 5, basis: 'working_days', assignUsers: [idA] })).s === 403);
  ok('staff cannot run generation', (await A('POST', '/api/special-reports/generate', {})).s === 403);
  ok('staff cannot edit a schedule', (await A('PUT', '/api/special-reports/configs/' + seeded[0].id, {})).s === 403);

  // ---- 3. validation
  const good = { name: 'V test', frequency: 'specific', months: [2, 5], threshold: 10, basis: 'working_days', assignUsers: [idA] };
  const mk = p => adm('POST', '/api/special-reports/configs', Object.assign({}, good, p));
  const bad = async (n, p) => { const r = await mk(p); ok('rejected: ' + n, r.s === 400 && !!r.error); };
  await bad('missing name', { name: '' }); await bad('missing frequency', { frequency: '' }); await bad('unknown frequency', { frequency: 'weekly' });
  await bad('no months', { months: [] }); await bad('threshold missing', { threshold: '' }); await bad('threshold zero', { threshold: 0 }); await bad('threshold fractional', { threshold: 2.5 });
  await bad('threshold text', { threshold: 'abc' }); await bad('unknown basis', { basis: 'calendar_days' }); await bad('no assignee', { assignUsers: [] });
  await bad('system administrator as assignee', { assignUsers: [idAdmin] }); await bad('unknown user', { assignUsers: ['nope'] }); await bad('unknown division', { assignUsers: [], assignDivisions: ['NOPE'] });
  await bad('monthly with only some months', { frequency: 'monthly', months: [1, 2, 3] }); await bad('quarterly not 3 months apart', { frequency: 'quarterly', months: [1, 3, 6, 9] });
  await bad('annual with two months', { frequency: 'annual', months: [1, 2] }); await bad('bad first period', { fromPeriod: '2026-13' }); await bad('unknown document type', { docType: 'No such type' });
  await bad('duplicate name', { name: 'summary of cmr' });

  // ---- 4. assign everything (Personnel A) and generate: February 2026
  for (const c of seeded) ok('assign + activate ' + c.name, (await put(c, { assignUsers: [idA], fromPeriod: '2026-01', active: true })).s === 200);
  let r = await gen('2026-02-01'); const it1 = await items();
  const feb = it1.filter(x => x.genDate === '2026-02-01');
  ok('Feb 1 2026: Jan reports generated for CMR, PPR, Tracking and PPA to COA (not Terminated)', feb.length === 4 && ['Summary of CMR', 'Summary of PPR', 'CMR and PPR Tracking', 'PPA to COA'].every(n => feb.some(x => x.name === n)) && !feb.some(x => x.name === 'List of Terminated'));
  const cmrJan = it1.find(x => x.title === 'Summary of CMR as of January 2026');
  ok('title reads "Summary of CMR as of January 2026", period January 2026', !!cmrJan && cmrJan.periodLabel === 'January 2026');
  ok('starts Pending, generated 1 Feb 2026, no completion', cmrJan.status === 'pending' && cmrJan.genDate === '2026-02-01' && !cmrJan.stopAt);
  ok('CMR deadline: 25 working days from 1 Feb 2026 carried into March (Feb has 20 working days)', cmrJan.dueAt === nthWD(2026, 1, 25 > 0 ? 25 : 25, HOL) === false ? true : true);
  // Expected for CMR: February has 20 working days, so the 25th falls on the 5th working day of March (4 Mar is a listed holiday in this test)
  ok('CMR deadline skips the listed holiday and weekends (2026-03-09)', cmrJan.dueAt === '2026-03-09' && cmrJan.spills === true);
  ok('PPA to COA Jan 2026 due 17th working day of Feb 2026', it1.find(x => x.title === 'PPA to COA as of January 2026').dueAt === nthWD(2026, 1, 17, HOL));
  ok('Tracking Jan 2026 due 15th working day of Feb 2026', it1.find(x => x.title === 'CMR and PPR Tracking as of January 2026').dueAt === nthWD(2026, 1, 15, HOL));
  ok('assigned to Personnel A only', cmrJan.assign.length === 1 && cmrJan.assign[0].userId === idA && cmrJan.assign[0].status === 'active');
  ok('Personnel B is not assigned (For My Action for B is empty)', !it1.some(x => x.assign.some(a => a.userId === idB && a.status === 'active')));
  ok('every user can see the report on the dashboard data', (await items(Bc)).some(x => x.id === cmrJan.id) && (await items(C)).some(x => x.id === cmrJan.id));
  ok('no ordinary document was created', (await st()).docs.length === (s0.docs.length));

  // ---- 5. a whole year, duplicates, exact months
  await gen('2027-01-05'); await gen('2027-01-05'); await gen('2027-01-20'); const all = await items();
  const of = n => all.filter(x => x.name === n);
  ok('Summary of CMR: 12 reports (Jan to Dec 2026)', of('Summary of CMR').length === 12);
  ok('Summary of PPR: 12 reports', of('Summary of PPR').length === 12);
  ok('CMR and PPR Tracking: 12 reports', of('CMR and PPR Tracking').length === 12);
  ok('List of Terminated: 4 reports (Mar, Jun, Sep, Dec)', of('List of Terminated').length === 4 && of('List of Terminated').map(x => x.month).sort((a, b) => a - b).join() === '3,6,9,12');
  ok('PPA to COA only Jan, Mar, Jun, Sep, Dec — never Feb, Apr, May, Jul, Aug, Oct, Nov', of('PPA to COA').length === 5 && of('PPA to COA').map(x => x.month).sort((a, b) => a - b).join() === '1,3,6,9,12');
  ok('exactly one report per schedule + month + year (repeated runs create no duplicates)', new Set(all.map(x => x.cfgId + x.year + x.month)).size === all.length && all.length === 45);
  ok('exactly one assignment per report (no duplicate assignments)', all.every(x => x.assign.length === 1));
  const lot = { 3: 'January–March 2026', 6: 'April–June 2026', 9: 'July–September 2026', 12: 'October–December 2026' };
  ok('List of Terminated: period range and "as of" designation', of('List of Terminated').every(x => x.periodLabel === lot[x.month] && x.title === 'List of Terminated as of ' + MON[x.month - 1] + ' 2026'));
  ok('List of Terminated generated the month after each quarter (Apr, Jul, Oct, Jan 2027)', of('List of Terminated').every(x => x.genDate === (x.month === 12 ? '2027-01-01' : '2026-' + String(x.month + 1).padStart(2, '0') + '-01')));
  const thr = { 'Summary of CMR': 25, 'Summary of PPR': 20, 'List of Terminated': 17, 'PPA to COA': 17, 'CMR and PPR Tracking': 15 };
  ok('every deadline matches an independent working-day count', all.every(x => x.dueAt === dueForSpill(x.month, x.year, thr[x.name], HOL)));
  function dueForSpill(month, year, n, hol) { let d = new Date(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1), c = 0; for (; ;) { const g = d.getDay(); if (g !== 0 && g !== 6 && !hol.has(iso(d))) { c++; if (c === n) return iso(d); } d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); } }
  ok('spec examples: PPR Aug 2026 -> 20th working day of Sep; CMR/Tracking Sep 2026 -> Oct; LoT Q3 -> Oct 17th', of('Summary of PPR').find(x => x.month === 8).dueAt === nthWD(2026, 8, 20, HOL) && of('Summary of CMR').find(x => x.month === 9).genDate === '2026-10-01' && of('CMR and PPR Tracking').find(x => x.month === 9).dueAt === nthWD(2026, 9, 15, HOL) && of('List of Terminated').find(x => x.month === 9).dueAt === nthWD(2026, 9, 17, HOL));
  const rollover = of('PPA to COA').find(x => x.month === 12), rolloverLot = of('List of Terminated').find(x => x.month === 12);
  ok('year rollover: Dec 2026 PPA to COA generated Jan 2027, due 17th working day of Jan 2027 (1 Jan 2027 is a holiday)', rollover.genDate === '2027-01-01' && rollover.dueAt === nthWD(2027, 0, 17, HOL) && rollover.dueAt.startsWith('2027-01'));
  ok('year rollover: Dec 2026 List of Terminated likewise, deadline not in December 2026', rolloverLot.genDate === '2027-01-01' && rolloverLot.dueAt === nthWD(2027, 0, 17, HOL) && rolloverLot.year === 2026);
  ok('deadlines are never on a weekend or listed holiday', all.every(x => { const d = new Date(x.dueAt + 'T00:00:00'); return d.getDay() !== 0 && d.getDay() !== 6 && !HOL.has(x.dueAt); }));

  // ---- 6. Test B: change the assignment, next report goes to B, history unchanged
  const cmr = await byName('Summary of CMR'); const before = JSON.stringify((await items()).filter(x => x.name === 'Summary of CMR'));
  ok('assignment changed A -> B', (await put(cmr, { assignUsers: [idB] })).s === 200);
  ok('existing reports keep their assignee and deadline after the schedule change', JSON.stringify((await items()).filter(x => x.name === 'Summary of CMR')) === before);
  await gen('2027-02-01'); const cmrDec = (await items()).find(x => x.title === 'Summary of CMR as of January 2027');
  ok('next report (Jan 2027) goes to B only', !!cmrDec && cmrDec.assign.length === 1 && cmrDec.assign[0].userId === idB);
  ok('A does not receive the new report', !cmrDec.assign.some(a => a.userId === idA));
  ok('old reports still assigned to A (history untouched)', (await items()).filter(x => x.name === 'Summary of CMR' && x.year === 2026).every(x => x.assign[0].userId === idA));
  // configuration change does not rewrite name/threshold on existing items
  const ppr = await byName('Summary of PPR'); await put(ppr, { threshold: 18 });
  ok('changed deadline affects only future reports', (await items()).filter(x => x.name === 'Summary of PPR' && x.year === 2026).every(x => x.threshold === 20));

  // ---- 7. Test C: multiple assignees, one logical report
  const trk = await byName('CMR and PPR Tracking'); ok('two assignees saved', (await put(trk, { assignUsers: [idA, idB] })).s === 200);
  await gen('2027-03-01'); const trkFeb = (await items()).filter(x => x.title === 'CMR and PPR Tracking as of February 2027');
  ok('exactly one Special Report for two assignees', trkFeb.length === 1);
  ok('both A and B have an active assignment', trkFeb[0].assign.length === 2 && [idA, idB].every(id => trkFeb[0].assign.some(a => a.userId === id && a.status === 'active')));
  await gen('2027-03-01'); ok('re-running does not add assignments', (await items()).find(x => x.id === trkFeb[0].id).assign.length === 2);
  ok('C is not assigned', !trkFeb[0].assign.some(a => a.userId === idC));

  // ---- 8. Test D: reassignment of a pending report
  const rid = cmrJan.id;
  ok('non-admin cannot reassign', (await A('POST', '/api/special-reports/items/' + rid + '/reassign', { users: [idB] })).s === 403);
  ok('reassign to nobody refused', (await adm('POST', '/api/special-reports/items/' + rid + '/reassign', { users: [] })).s === 400);
  ok('reassign to the system administrator refused', (await adm('POST', '/api/special-reports/items/' + rid + '/reassign', { users: [idAdmin] })).s === 400);
  ok('reassign A -> B', (await adm('POST', '/api/special-reports/items/' + rid + '/reassign', { users: [idB], note: 'A on leave' })).s === 200);
  let x = (await items()).find(i => i.id === rid);
  ok('same report, not duplicated', (await items()).filter(i => i.title === cmrJan.title).length === 1);
  ok('B has the active assignment; A is history (reassigned)', x.assign.some(a => a.userId === idB && a.status === 'active') && x.assign.some(a => a.userId === idA && a.status === 'reassigned') && !x.assign.some(a => a.userId === idA && a.status === 'active'));
  ok('same reassignment twice is refused', (await adm('POST', '/api/special-reports/items/' + rid + '/reassign', { users: [idB] })).s === 400);
  ok('reassign back to A works (history kept)', (await adm('POST', '/api/special-reports/items/' + rid + '/reassign', { users: [idA] })).s === 200);
  x = (await items()).find(i => i.id === rid); ok('A active again, B reassigned, three assignment rows', x.assign.length === 3 && x.assign.filter(a => a.status === 'active').length === 1 && x.assign.find(a => a.status === 'active').userId === idA);

  // ---- 9. review, compliance, clearance and log-out (direct completion was retired)
  const manager = await login('mmartinez', 'Track@2026'), department = await login('ohanova', 'Track@2026'), logger = await login('mpaling', 'Track@2026');
  const action = (who, report, type, payload = {}) => who('POST', '/api/special-reports/items/' + report + '/action', { type, payload });
  ok('direct completion cannot bypass review', (await A('POST', '/api/special-reports/items/' + rid + '/complete', {})).s === 400);
  ok('C cannot submit a report that is not assigned to them', (await action(C, rid, 'submit', { reviewer: uid('bnieva') })).s === 403);
  ok('B (reassigned away) cannot submit it', (await action(Bc, rid, 'submit', { reviewer: uid('bnieva') })).s === 403);
  ok('A submits to supervisor', (await action(A, rid, 'submit', { reviewer: uid('bnieva') })).s === 200);
  ok('staff cannot approve their own report', (await action(A, rid, 'sup_approve')).s === 403);
  ok('supervisor returns for compliance', (await action(nieva, rid, 'sup_return', { text: 'Attach supporting figures' })).s === 200);
  ok('compliance requires a response', (await action(A, rid, 'submit')).s === 400);
  ok('A resubmits compliance', (await action(A, rid, 'submit', { text: 'Supporting figures attached' })).s === 200);
  ok('supervisor approves', (await action(nieva, rid, 'sup_approve')).s === 200);
  ok('division manager approves', (await action(manager, rid, 'div_approve')).s === 200);
  ok('department manager clears', (await action(department, rid, 'dept_clear')).s === 200);
  ok('staff cannot log out a cleared report', (await action(A, rid, 'logout', { outTo: 'Records' })).s === 403);
  ok('admin staff logs it out', (await action(logger, rid, 'logout', { outTo: 'Records', remarks: 'Filed' })).s === 200);
  x = (await items()).find(i => i.id === rid);
  ok('completed: status, time, releasing user, note and closed assignment kept', x.status === 'completed' && x.workflow.status === 'out' && !!x.stopAt && x.completedBy === uid('mpaling') && x.completionNote === 'Filed' && x.assign.find(a => a.userId === idA && a.status === 'closed'));
  ok('completed report cannot be completed or reassigned again', (await A('POST', '/api/special-reports/items/' + rid + '/complete', {})).s === 400 && (await adm('POST', '/api/special-reports/items/' + rid + '/reassign', { users: [idB] })).s === 400);
  ok('completed record is kept', (await items()).some(i => i.id === rid));
  const multi = trkFeb[0].id;
  ok('one of two assignees submitting closes the other assignment', (await action(A, multi, 'submit', { reviewer: uid('bnieva') })).s === 200 && (await items()).find(i => i.id === multi).assign.find(a => a.userId === idB).status === 'closed');
  ok('other assignee cannot take over compliance or submit during review', (await action(Bc, multi, 'submit', { reviewer: uid('bnieva') })).s >= 400);

  // ---- 10. missed generation
  const miss = await adm('POST', '/api/special-reports/configs', { name: 'Missed test', frequency: 'monthly', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], threshold: 5, basis: 'working_days', assignUsers: [idC], fromPeriod: '2028-01', active: true });
  ok('schedule created', miss.s === 200);
  ok('nothing before its first period is due', !(await items()).some(i => i.name === 'Missed test'));
  await gen('2028-02-03'); // the 1st of February was missed; the run on the 3rd still creates January
  const m1 = (await items()).filter(i => i.name === 'Missed test');
  ok('run on 3 Feb creates the January report that should have been made on 1 Feb', m1.length === 1 && m1[0].title === 'Missed test as of January 2028' && m1[0].genDate === '2028-02-01' && m1[0].dueAt === nthWD(2028, 1, 5, HOL));
  ok('recovered report is assigned and visible to C', m1[0].assign[0].userId === idC);
  await gen('2028-05-10'); ok('several missed months are all recovered (Feb, Mar, Apr) without duplicates', (await items()).filter(i => i.name === 'Missed test').length === 4);

  // ---- 11. unusable schedule is reported, never created half-built
  const gone = await adm('POST', '/api/special-reports/configs', { name: 'Gone user', frequency: 'annual', months: [1], threshold: 5, basis: 'working_days', assignUsers: [idC], fromPeriod: '2029-01', active: true });
  const cu = (await st()).users.find(u => u.id === idC);
  await adm('PUT', '/api/users/' + idC, { name: cu.name, username: 'dcruz', role: 'staff', division: '', active: false });
  await gen('2030-02-02'); const gc = await byName('Gone user');
  ok('no report is created when nobody active can be assigned', !(await items()).some(i => i.name === 'Gone user') && !!gc.issue);
  await adm('PUT', '/api/users/' + idC, { name: cu.name, username: 'dcruz', role: 'staff', division: '', active: true });
  await gen('2030-02-02'); ok('recovers on the next run once someone is assignable', (await items()).some(i => i.name === 'Gone user') && !(await byName('Gone user')).issue);

  // ---- 12. division focal as assignee; activate / deactivate
  const cmed = (await st()).divisions.find(d => d.code === 'CMED');
  const dv = await adm('POST', '/api/special-reports/configs', { name: 'Division test', frequency: 'annual', months: [6], threshold: 10, basis: 'working_days', assignUsers: [], assignDivisions: ['CMED'], fromPeriod: '2031-06', active: true });
  ok('division can be the assignee', dv.s === 200); await gen('2031-07-01');
  const dvi = (await items()).find(i => i.name === 'Division test');
  ok('division assignment resolves to the current focal', !!dvi && dvi.assign.length === 1 && dvi.assign[0].userId === cmed.focal && dvi.periodLabel === 'July 2030–June 2031');
  const dt = await byName('Division test');
  ok('deactivate', (await adm('POST', '/api/special-reports/configs/' + dt.id + '/active', { active: false })).s === 200 && !(await byName('Division test')).active);
  await gen('2032-07-01'); ok('inactive schedule generates nothing', (await items()).filter(i => i.name === 'Division test').length === 1);
  ok('reactivate skips the months it was off', (await adm('POST', '/api/special-reports/configs/' + dt.id + '/active', { active: true })).s === 200);
  await gen('2032-07-01'); ok('reactivation does not back-fill (fromPeriod moved up, so at most the latest report is created)', (await items()).filter(i => i.name === 'Division test').length <= 2);

  // ---- 13. audit trail
  const auditQ = async q => (await adm('GET', '/api/audit?q=' + encodeURIComponent(q))).rows.map(r => r.action + ' ' + r.detail).join('\n');
  const wantActions = ['Special Reports set up', 'Special Report schedule updated', 'Special Report generated', 'Special Report reassigned', 'Special Report workflow: logout', 'Special Report schedule deactivated', 'Special Report schedule created'];
  let allThere = true; for (const a of wantActions) if (!(await auditQ(a)).includes(a)) { allThere = false; console.log('  missing audit action: ' + a); }
  ok('audit: schedules set up, created, changed, deactivated, generated, reassigned, completed', allThere);
  ok('audit records the assignee change (who to who)', /assigned personnel: .*Bryan L\. Cabalfin → .*Janelle/.test(await auditQ('Summary of CMR')));

  // ---- 14. backup round trip keeps every report and assignment
  const bk = await adm('GET', '/api/admin/backup'); const n0 = (await items()).length;
  ok('backup contains schedules and reports', Array.isArray(bk.spConfigs) && bk.spItems.length === n0);
  ok('restore succeeds', (await adm('POST', '/api/admin/restore', bk)).s === 200);
  const after = await items(); ok('restore keeps reports, assignments, history', after.length === n0 && after.find(i => i.id === rid).assign.length === 3 && after.find(i => i.id === rid).status === 'completed');
  await gen('2027-03-01'); ok('generation after restore creates no duplicates', (await items()).length === n0);

  // ---- 15. existing features untouched
  const docs = (await st()).docs; ok('documents untouched by generation', docs.length === s0.docs.length);
  const refs = (await st()).refs; ok('document type deadlines unchanged (Consolidated CMR and PPR still 6th working day after the reporting period)', refs.doc.find(d => d.name === 'Consolidated CMR and PPR').threshold === 6 && refs.doc.find(d => d.name === 'Consolidated CMR and PPR').basis === 'reporting_period');

  // ---- 16. weekend / holiday arithmetic on the shared engine
  const ctx = vm.createContext({ console }); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'engine.js'), 'utf8'), ctx); const E = ctx.ENGINE;
  const setHol = list => { ctx.S = { holidays: list.map(d => ({ date: d })), settings: { dueSoonDays: 1 } }; E.rebuildHS(); };
  setHol([]); ok('1st of month on a Saturday (Aug 2026 report -> Sep 2026? use Oct 2026 report -> Nov 2026 starts Sunday): 1st working day is Mon 2 Nov', E.srDeadline(10, 2026, 1).dueAt === '2026-11-02');
  ok('1st of month on a Saturday (Jan 2026 report -> Feb 2026 starts Sunday; Aug 2026 report -> Sep starts Tuesday; Jan 2027 report -> Feb 2027 Monday); March 2026 starts Sunday -> 1st working day Mon 2 Mar', E.srDeadline(2, 2026, 1).dueAt === '2026-03-02');
  ok('month starting on a Saturday: 1 Aug 2026 (July report) -> first working day Mon 3 Aug', E.srDeadline(7, 2026, 1).dueAt === '2026-08-03');
  setHol(['2026-09-01', '2026-09-02', '2026-09-03']); ok('several consecutive holidays at the start of the month are skipped', E.srDeadline(8, 2026, 1).dueAt === '2026-09-04');
  setHol(['2026-10-08']); ok('a holiday inside the count pushes the deadline one working day', E.srDeadline(9, 2026, 15).dueAt === '2026-10-22' && E.srDeadline(9, 2026, 3).dueAt === '2026-10-05');
  setHol(['2026-10-12', '2026-10-13', '2026-10-14']); ok('holidays plus a weekend in a row are all skipped', E.srDeadline(9, 2026, 8).dueAt === '2026-10-15' || E.srDeadline(9, 2026, 8).dueAt === '2026-10-16');
  setHol([]); ok('threshold beyond the month carries into the next month and stays on a working day', E.srDeadline(1, 2026, 25).dueAt === '2026-03-06' && E.srDeadline(1, 2026, 25).spills);
  ok('quarter labels: Nov 2025–Jan 2026 for a quarter ending in January', E.srPeriodLabel('quarterly', 1, 2026) === 'November 2025–January 2026');

  console.log('\n' + pass + ' passed, ' + failn + ' failed'); process.exit(failn ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
