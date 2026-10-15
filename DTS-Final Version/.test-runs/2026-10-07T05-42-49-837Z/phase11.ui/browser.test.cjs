/* Phase 11 browser check. Needs Playwright + Chromium and a fresh server started with
   SEED_DEMO=1 SR_TEST=1 SR_NOW=2026-01-15 DATA_DIR=/tmp/t PORT=3111 node server.js */
const { chromium } = require('playwright');
const B = 'http://localhost:' + (process.env.PORT || 3111);
let pass = 0, failn = 0; const ok = (n, c) => { c ? pass++ : failn++; console.log((c ? 'PASS ' : 'FAIL ') + n); };
async function api(cookieCtx, m, u, b) { const r = await cookieCtx.request.fetch(B + u, { method: m, headers: { 'X-Requested-With': 'dts', 'Content-Type': 'application/json' }, data: b }); return r.json(); }
(async () => {
  const br = await chromium.launch({headless:true,channel:process.env.WF_BROWSER_CHANNEL||'msedge'}); const errs = [];
  async function session(user, pw) { const ctx = await br.newContext({ viewport: { width: 1300, height: 900 } }); const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(user + ': ' + e.message)); await pg.goto(B); await pg.fill('#lu', user); await pg.fill('#lp', pw); await pg.click('button[type=submit]'); await pg.waitForSelector('.shell'); return { ctx, pg }; }
  const adm = await session('admin', 'Admin@2026');
  const st = (await (await adm.ctx.request.get(B + '/api/state')).json()).state;
  const id = un => st.users.find(u => u.username === un).id;
  for (const c of st.spConfigs.filter(c => ['Summary of CMR', 'PPA to COA'].includes(c.name))) {
    const r = await api(adm.ctx, 'PUT', '/api/special-reports/configs/' + c.id, { name: c.name, frequency: c.frequency, months: c.months, threshold: c.threshold, basis: c.basis, assignUsers: [id('bcabalfin')], assignDivisions: [], fromPeriod: '2026-01', active: true });
    ok('configured ' + c.name, r.ok);
  }
  ok('generated for Feb 2026', (await api(adm.ctx, 'POST', '/api/special-reports/generate', { asOf: '2026-02-02' })).created === 2);

  // administrator screens
  const a = adm.pg; await a.goto(B + '/#/spconfig'); await a.reload(); await a.waitForSelector('[data-act=spCfgForm]');
  ok('Special Reports lives within Reference lists', await a.locator('[data-act=refTab][data-k=special][aria-selected=true]').count() === 1);
  ok('schedule table lists all five reports', await a.locator('table.tbl tbody tr').count() === 5);
  const heads = await a.locator('table.tbl thead th').allInnerTexts();
  ok('table shows the required columns', ['Special Report', 'Frequency', 'Reporting month(s)', 'Deadline threshold', 'Deadline basis', 'Assigned to', 'Status', 'Actions'].every((h, i) => heads[i] === h));
  ok('unassigned schedules are flagged', await a.locator('td .badge', { hasText: 'Nobody assigned' }).count() === 3);
  ok('PPA to COA shows its exact months', await a.locator('tr', { hasText: 'PPA to COA' }).locator('text=January, March, June, September, December').count() === 1);
  await a.click('button:has-text("Add Special Report")'); await a.waitForSelector('[data-form=srcfg]');
  await a.click('[data-act=spCfgSave]'); ok('empty form shows a clear validation message', await a.locator('.toast.bad').first().innerText().then(t => /name/i.test(t)));
  await a.click('[data-act=closeModal]');
  await a.click('button:has-text("Generated reports")'); ok('generated reports tab lists both', await a.locator('table.tbl tbody tr').count() === 2);
  ok('admin has no For My Action entry', await a.locator('.nav a', { hasText: 'For My Action' }).count() === 0);
  await a.screenshot({ path: "D:/test server/staging-dts/New folder/dts-final version-workflow/DTS-Final Version/.test-runs/2026-10-07T05-42-49-837Z/phase11.ui/sr-admin.png" });

  // assigned person
  const A = await session('bcabalfin', 'Track@2026'), p = A.pg;
  const cnt0 = Number(await p.locator('.nav a[data-r=action] .cnt').innerText().catch(() => '0'));
  ok('assigned person: For My Action count badge includes the 2 Special Reports', cnt0 >= 2);
  await p.click('.nav a[data-r=action]'); await p.waitForSelector('.sr-action');
  ok('For My Action shows the Special Report cards', await p.locator('.sr-action .sr-item').count() === 2);
  const txt = await p.locator('.sr-action').innerText();
  ok('card shows badge, name, period, deadline, days remaining, status, action', /SPECIAL REPORT/i.test(txt) && /Summary of CMR as of January 2026/.test(txt) && /Reporting period/i.test(txt) && /January 2026/.test(txt) && /Deadline/i.test(txt) && /March 9, 2026|February \d+, 2026/.test(txt) && /Days remaining/i.test(txt) && /(Pending|Overdue|Due)/.test(txt) && (await p.locator('.sr-action button:has-text("Action")').count()) === 2);
  await p.screenshot({ path: "D:/test server/staging-dts/New folder/dts-final version-workflow/DTS-Final Version/.test-runs/2026-10-07T05-42-49-837Z/phase11.ui/sr-action.png" });
  await p.click('.nav a[data-r=dashboard]'); await p.waitForSelector('#regTable [data-act=spOpen]');
  ok('dashboard registry includes both generated reports', await p.locator('#regTable [data-act=spOpen]').count() === 2);
  await p.screenshot({ path: "D:/test server/staging-dts/New folder/dts-final version-workflow/DTS-Final Version/.test-runs/2026-10-07T05-42-49-837Z/phase11.ui/sr-dash.png", fullPage: false });

  // unrelated person
  const C = await session('jtanguilig', 'Track@2026');
  await C.pg.click('.nav a[data-r=action]'); await C.pg.waitForSelector('.pagehead');
  ok('unrelated person: no Special Reports in For My Action', await C.pg.locator('.sr-action').count() === 0);
  await C.pg.click('.nav a[data-r=dashboard]'); await C.pg.waitForSelector('#regTable [data-act=spOpen]');
  ok('unrelated person still sees them on the Dashboard', await C.pg.locator('#regTable [data-act=spOpen]').count() === 2);
  await C.pg.locator('#regTable [data-act=spOpen]').first().click();
  ok('unrelated viewer has no workflow action buttons', await C.pg.locator('[data-act=spDoSubmit], [data-act=spDoReview], [data-act=spDoLogout]').count() === 0);
  await C.pg.click('#modalRoot [data-act=closeModal]');
  ok('no admin menu / route for staff', await C.pg.locator('.nav a[data-r=spconfig]').count() === 0);

  // Submit, return, comply, review, clear and log out using the current browser controls.
  const reports = (await api(adm.ctx, 'GET', '/api/state')).state.spItems;
  const report = reports.find(i => i.name === 'PPA to COA');
  const ni = await session('bnieva', 'Track@2026'), dm = await session('mmartinez', 'Track@2026'), dept = await session('ohanova', 'Track@2026'), logger = await session('mpaling', 'Track@2026');
  const current = async () => (await api(adm.ctx, 'GET', '/api/state')).state.spItems.find(i => i.id === report.id);
  const open = async s => { await s.pg.reload(); await s.pg.waitForSelector('.shell'); await s.pg.click('.nav a[data-r=action]'); await s.pg.locator('[data-act=spOpen][data-id="' + report.id + '"]').click(); };
  const waitStage = async (s, status) => { await s.pg.waitForFunction(({rid,status}) => S.spItems.find(i => i.id === rid)?.workflow.status === status, {rid:report.id,status}); ok('stage persisted: ' + status, (await current()).workflow.status === status); };
  const review = async (s, type, status, text) => { await open(s); const b = s.pg.locator('[data-act=spDoReview][data-type="' + type + '"]'); if(text) await b.locator('xpath=ancestor::*[@data-panel]').locator('textarea[name=text]').fill(text); await b.click(); await waitStage(s,status); };
  await open(A); await p.selectOption('#modalRoot select[name=reviewer]', id('bnieva')); await p.click('[data-act=spDoSubmit]'); await waitStage(A,'sup_review');
  await review(ni,'sup_return','compliance','Attach the supporting schedule');
  await open(A); const submit=p.locator('[data-act=spDoSubmit]'); await submit.locator('xpath=ancestor::*[@data-panel]').locator('textarea[name=text]').fill('Supporting schedule attached'); await submit.click(); await waitStage(A,'sup_review');
  await review(ni,'sup_approve','div_review'); await review(dm,'div_approve','dept_review'); await review(dept,'dept_clear','cleared');
  await open(logger); const logout=logger.pg.locator('[data-act=spDoLogout]'); await logout.locator('xpath=ancestor::*[@data-panel]').locator('input[name=outTo]').fill('Mock Records Office'); await logout.click(); await waitStage(logger,'out');
  ok('completed report retains compliance and release history', (await current()).status==='completed' && (await current()).workflow.cycles===1 && (await current()).workflow.outTo==='Mock Records Office');
  await logger.pg.screenshot({path:process.env.SHOTS+'/sr-completed.png'});
  await p.reload(); await p.waitForSelector('.shell'); await p.click('.nav a[data-r=action]');
  ok('completed report leaves staff action list', await p.locator('.sr-action .sr-item').count()===1);
  await p.click('.nav a[data-r=dashboard]'); await p.waitForSelector('#regTable [data-act=spOpen]');
  ok('completed report stays in dashboard registry', await p.locator('#regTable [data-act=spOpen][data-id="'+report.id+'"]').count()===1);

  // admin reassign in the browser
  await a.reload(); await a.waitForSelector('[data-act=spTab]'); await a.click('button:has-text("Generated reports")');
  await a.locator('tr', { hasText: 'Summary of CMR' }).locator('button:has-text("Reassign")').click(); await a.waitForSelector('[data-form=srre]');
  await a.locator('[data-form=srre] input[data-u]:checked').uncheck(); await a.locator('[data-form=srre] label', { hasText: 'Janelle' }).locator('input').check(); await a.click('[data-act=spReassignSave]');
  await a.waitForFunction(() => /Janelle/.test(document.body.innerText));
  await C.pg.reload(); await C.pg.waitForSelector('.shell'); await C.pg.click('.nav a[data-r=action]');
  await C.pg.waitForSelector('.sr-action'); ok('reassigned person now sees it in For My Action', await C.pg.locator('.sr-action .sr-item').count() === 1);
  await p.reload(); await p.waitForSelector('.shell');
  await p.click('.nav a[data-r=action]'); await p.waitForSelector('.pagehead');
  ok('previous person no longer has it as an action (the other one was completed)', await p.locator('.sr-action').count() === 0);

  ok('no JavaScript errors in any session', errs.length === 0); if (errs.length) console.log(errs);
  console.log('\n' + pass + ' passed, ' + failn + ' failed'); await br.close(); process.exit(failn ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
