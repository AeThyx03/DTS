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
  const a = adm.pg; await a.goto(B + '/#/spconfig'); await a.reload(); await a.waitForSelector('.pagehead h1:has-text("Special Reports")');
  ok('admin sees Special Reports in the menu', await a.locator('.nav a', { hasText: 'Special Reports' }).count() === 1);
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
  await a.screenshot({ path: "D:/test server/staging-dts/New folder/dts-final version-workflow/DTS-Final Version/.test-runs/2026-10-07T05-38-07-404Z/phase11.ui/sr-admin.png" });

  // assigned person
  const A = await session('bcabalfin', 'Track@2026'), p = A.pg;
  const cnt0 = Number(await p.locator('.nav a[data-r=action] .cnt').innerText().catch(() => '0'));
  ok('assigned person: For My Action count badge includes the 2 Special Reports', cnt0 >= 2);
  await p.click('.nav a[data-r=action]'); await p.waitForSelector('.sr-action');
  ok('For My Action shows the Special Report cards', await p.locator('.sr-action .sr-item').count() === 2);
  const txt = await p.locator('.sr-action').innerText();
  ok('card shows badge, name, period, deadline, days remaining, status, action', /SPECIAL REPORT/i.test(txt) && /Summary of CMR as of January 2026/.test(txt) && /Reporting period/i.test(txt) && /January 2026/.test(txt) && /Deadline/i.test(txt) && /March 9, 2026|February \d+, 2026/.test(txt) && /Days remaining/i.test(txt) && /(Pending|Overdue|Due)/.test(txt) && (await p.locator('.sr-action button:has-text("Action")').count()) === 2);
  await p.screenshot({ path: "D:/test server/staging-dts/New folder/dts-final version-workflow/DTS-Final Version/.test-runs/2026-10-07T05-38-07-404Z/phase11.ui/sr-action.png" });
  await p.click('.nav a[data-r=dashboard]'); await p.waitForSelector('.sr-dash');
  const d = await p.locator('.sr-dash').innerText();
  ok('dashboard card shows Assigned to and Generated', /Assigned to/i.test(d) && /Generated/i.test(d) && /February 1, 2026/.test(d));
  await p.screenshot({ path: "D:/test server/staging-dts/New folder/dts-final version-workflow/DTS-Final Version/.test-runs/2026-10-07T05-38-07-404Z/phase11.ui/sr-dash.png", fullPage: false });

  // unrelated person
  const C = await session('jtanguilig', 'Track@2026');
  await C.pg.click('.nav a[data-r=action]'); await C.pg.waitForSelector('.pagehead');
  ok('unrelated person: no Special Reports in For My Action', await C.pg.locator('.sr-action').count() === 0);
  await C.pg.click('.nav a[data-r=dashboard]'); await C.pg.waitForSelector('.sr-dash');
  ok('unrelated person still sees them on the Dashboard (not as their action)', await C.pg.locator('.sr-dash .sr-item').count() === 2 && await C.pg.locator('.sr-dash button.primary').count() === 0);
  ok('no admin menu / route for staff', await C.pg.locator('.nav a[data-r=spconfig]').count() === 0);

  // complete in the browser
  await p.click('.nav a[data-r=action]'); await p.click('.sr-action .sr-item >> nth=0 >> button');
  await p.waitForSelector('[data-act=spComplete]'); await p.click('[data-act=spComplete]'); await p.click('[data-act=confirmYes]');
  await p.waitForFunction(() => document.querySelectorAll('.sr-action .sr-item').length === 1);
  ok('completing removes it from For My Action', await p.locator('.sr-action .sr-item').count() === 1);
  await p.click('.nav a[data-r=dashboard]'); await p.click('[data-act=spDashTab][data-k=done]');
  ok('completed report stays on the Dashboard under Completed', await p.locator('.sr-dash .sr-item').count() === 1);

  // admin reassign in the browser
  await a.reload(); await a.waitForSelector('.pagehead h1:has-text("Special Reports")'); await a.click('button:has-text("Generated reports")');
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
