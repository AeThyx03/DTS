/* Personnel Schedule: adversarial BROWSER tests (needs Playwright + Chromium).
   Start a fresh server first (SEED_DEMO=1 DATA_DIR=/tmp/x PORT=3111 node server.js), then run this file. */
const { chromium } = require('playwright');
const fs = require('fs');
const B = 'http://localhost:' + (process.env.PORT || 3111);
const SH = process.env.SHOTS || "D:/test server/staging-dts/New folder/dts-final version-workflow/DTS-Final Version/.test-runs/2026-10-07T05-38-07-404Z/schedule.attack.ui"; fs.mkdirSync(SH, { recursive: true });
let pass = 0, failn = 0; const errors = [];
const ok = (n, c) => { c ? pass++ : failn++; console.log((c ? 'PASS ' : 'FAIL ') + n); };

async function api() {
  let cookie = '';
  const f = async (m, u, b) => { const r = await fetch(B + u, { method: m, headers: Object.assign({ 'X-Requested-With': 'dts', cookie }, b !== undefined ? { 'Content-Type': 'application/json' } : {}), body: b !== undefined ? JSON.stringify(b) : undefined }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; let j = {}; try { j = await r.json(); } catch (e) {} return Object.assign({ s: r.status }, j); };
  await f('POST', '/api/login', { username: 'admin', password: 'Admin@2026' });
  return f;
}
async function ctxFor(browser, o) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1400, height: 950 }, timezoneId: 'Asia/Manila', locale: 'en-US' }, o || {}));
  await ctx.clock.setFixedTime(new Date('2026-09-29T09:00:00+08:00'));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  return ctx;
}
async function openPage(ctx, user, pw, hash) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('dialog', d => { errors.push('DIALOG (script ran!): ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_FAILED|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await p.goto(B); await p.fill('#lu', user || 'admin'); await p.fill('#lp', pw || 'Admin@2026'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  await p.goto(B + (hash || '/#/schedule')); await p.waitForSelector('#calBody');
  return p;
}
const goto = (p, date, view) => p.evaluate(([d, v]) => { CAL.date = d; CAL.view = v; CAL.person = ''; CAL.type = ''; CAL.q = ''; calRepaint(); }, [date, view]);
const overflowX = p => p.evaluate(() => { const v = document.querySelector('#view'); return v.scrollWidth - v.clientWidth; });

(async () => {
  const A = await api();
  const st = (await A('GET', '/api/state')).state, VAC = st.leaveTypes[0].id;
  const add = (o) => A('POST', '/api/schedules', Object.assign({ confirm: true }, o));

  /* ----- seed: hostile text everywhere, plus alignment and long-text cases ----- */
  const XSS = '<img src=x onerror="window.__xss=1">';
  await add({ type: 'inspection', title: XSS, project: '"><script>window.__xss=2</script>', location: '<b>bold</b>&amp;', startDate: '2026-10-06', endDate: '2026-10-06', startTime: '08:00', endTime: '17:00', personnel: ['mojica'], remarks: '<svg onload="window.__xss=3">' });
  await add({ type: 'meeting', title: '<script>window.__xss=4</script>', startDate: '2026-10-06', endDate: '2026-10-06', startTime: '09:00', endTime: '10:00', location: '</td><h1>BIG</h1>', link: 'https://example.com/"onmouseover="window.__xss=5', organizer: 'nieva', personnel: ['delrosario'], remarks: 'javascript:alert(1)' });
  await add({ type: 'leave', personnel: ['cruz'], leaveTypeId: VAC, startDate: '2026-10-06', endDate: '2026-10-06', remarks: '<iframe src="javascript:window.__xss=6">' });
  /* alignment: a 3-day inspection with early single-day events on its middle day */
  await add({ type: 'inspection', title: 'Multi-day bar', project: 'P', startDate: '2026-10-13', endDate: '2026-10-15', startTime: '08:00', endTime: '17:00', personnel: ['torino'] });
  await add({ type: 'meeting', title: 'Early call', startDate: '2026-10-14', endDate: '2026-10-14', startTime: '06:00', endTime: '07:00', organizer: 'nieva', personnel: [] });
  await add({ type: 'leave', personnel: ['cabalfin'], leaveTypeId: VAC, startDate: '2026-10-12', endDate: '2026-10-16' });
  await add({ type: 'meeting', title: 'Second call', startDate: '2026-10-14', endDate: '2026-10-14', startTime: '07:30', endTime: '08:30', organizer: 'nieva', personnel: [] });
  await add({ type: 'meeting', title: 'Third call', startDate: '2026-10-14', endDate: '2026-10-14', startTime: '07:45', endTime: '08:45', organizer: 'nieva', personnel: [] });
  /* long unbroken text */
  const LONG = 'W'.repeat(190);
  await add({ type: 'inspection', title: LONG, project: 'P'.repeat(190), location: 'L'.repeat(290), startDate: '2026-10-20', endDate: '2026-10-20', startTime: '08:00', endTime: '17:00', personnel: ['salvador'], remarks: 'R'.repeat(1500) });
  /* whole-day leave vs timed on the same day (agenda order) */
  await add({ type: 'leave', personnel: ['tanguilig'], leaveTypeId: VAC, startDate: '2026-10-27', endDate: '2026-10-27' });
  await add({ type: 'meeting', title: 'Late meeting', startDate: '2026-10-27', endDate: '2026-10-27', startTime: '15:00', endTime: '16:00', organizer: 'nieva', personnel: [] });
  await add({ type: 'inspection', title: 'Early inspection', project: 'P', startDate: '2026-10-27', endDate: '2026-10-27', startTime: '07:00', endTime: '09:00', personnel: ['aprochevado'] });

  const browser = await chromium.launch({headless:true,channel:process.env.WF_BROWSER_CHANNEL||'msedge'});
  const ctx = await ctxFor(browser);
  const p = await openPage(ctx);

  /* ---------- A. hostile text must stay text in EVERY view ---------- */
  await goto(p, '2026-10-06', 'month');
  const noXss = async (where) => ok('XSS payloads inert in ' + where, (await p.evaluate(() => window.__xss)) === undefined && (await p.locator('#calBody img[src="x"], #calBody script, #calBody iframe, #calBody svg[onload], #modalRoot img[src="x"], #modalRoot iframe, #ppBody img[src="x"]').count()) === 0);
  await noXss('the month grid');
  ok('the hostile title is shown as literal text', /<img src=x onerror/.test(await p.locator('.cal-cell[data-d="2026-10-06"]').innerText()));
  await goto(p, '2026-10-06', 'week'); await noXss('the week view');
  await goto(p, '2026-10-06', 'day'); await noXss('the day view');
  ok('day view shows the literal <b>bold</b> text, not bold', /<b>bold<\/b>&amp;/.test(await p.locator('.cal-day').innerText()) && (await p.locator('.cal-day b:text-is("bold")').count()) === 0);
  await goto(p, '2026-10-06', 'agenda'); await noXss('the agenda');
  await p.fill('input[data-inp=calQ]', 'script'); await p.waitForSelector('.cal-sr'); await noXss('search results');
  await p.click('button[data-act=calClearQ]');
  await goto(p, '2026-10-06', 'day');
  for (const t of ['inspection', 'meeting', 'leave']) {
    await p.click('.cal-card.ev-' + t); await noXss('the ' + t + ' detail panel');
    if (t !== 'leave') { await p.click('button[data-act=calEdit]'); await noXss('the ' + t + ' edit form'); ok('edit form keeps hostile text as the field value', /</.test(await p.locator(t === 'inspection' ? 'input[name=ins_title]' : 'input[name=mtg_title]').inputValue())); }
    await p.click('button[data-act=closeModal]');
  }
  await p.click('.cal-card.ev-meeting');
  ok('a link containing a quote cannot break out of its attribute', await p.locator('#modalRoot a').count() === 1 && (await p.locator('#modalRoot a').getAttribute('href')).includes('"onmouseover=') && (await p.locator('#modalRoot a').evaluate(a => a.getAttributeNames().join(','))) === 'href,target,rel');
  await p.click('button[data-act=closeModal]');
  await p.click('button[data-act=calPrint]'); await p.waitForSelector('#pp.on'); await noXss('the print sheet');
  ok('print sheet shows the hostile title as text', /<img src=x onerror/.test(await p.locator('#ppBody').innerText()));
  await p.click('button[data-act=ppClose]');

  /* ---------- B. multi-day bars stay at one height ---------- */
  await goto(p, '2026-10-14', 'month');
  const tops = async (sel) => p.evaluate(s => [...document.querySelectorAll(s)].map(e => Math.round(e.getBoundingClientRect().top)), sel);
  const insTops = await tops('.cal-ev.ev-inspection[title*="Multi-day bar"]');
  const leaveTops = await tops('.cal-ev.ev-leave[title*="Leave"]');
  ok('the 3-day inspection is drawn on 3 days', insTops.length === 3);
  ok('the 3-day inspection sits at the SAME height on all 3 days (one connected bar)', new Set(insTops).size === 1);
  const wk = await p.evaluate(() => [...document.querySelectorAll('.cal-ev.ev-leave')].filter(e => /Bryan/.test(e.title)).map(e => Math.round(e.getBoundingClientRect().top)));
  ok('the 5-day leave is drawn on 5 days at one height', wk.length === 5 && new Set(wk).size === 1);
  ok('the two multi-day bars are on different rows (they do not overlap)', insTops[0] !== wk[0]);
  const box = await p.evaluate(() => [...document.querySelectorAll('.cal-ev.ev-inspection[title*="Multi-day bar"]')].map(e => { const r = e.getBoundingClientRect(); return [r.left, r.right]; }));
  ok('adjacent bar segments touch (no gaps between the days)', Math.abs(box[0][1] - box[1][0]) <= 1.5 && Math.abs(box[1][1] - box[2][0]) <= 1.5);
  ok('with 3 lanes full the 4th event on that day says "+n more"', (await p.locator('.cal-cell[data-d="2026-10-14"] .cal-more').innerText()).match(/\+\d+ more/) !== null);
  await p.screenshot({ path: SH + '/A-month-lanes.png' });
  await p.click('.cal-cell[data-d="2026-10-14"] .cal-more');
  ok('"+n more" opens that day with every event listed', (await p.locator('.cal-day .cal-card').count()) === 5);

  /* ---------- C. ordering: timed first, whole-day last ---------- */
  await goto(p, '2026-10-27', 'agenda');
  const ag = (await p.locator('.ag-day:has(h3:has-text("October 27")) .ag-row .ag-t').allInnerTexts()).map(s => s.trim());
  ok('agenda: 7:00 AM, 3:00 PM, then Whole Day (matches the spec example)', ag.join('|') === '7:00 AM – 9:00 AM|3:00 PM – 4:00 PM|Whole Day');
  await goto(p, '2026-10-27', 'day');
  ok('day view uses the same order', (await p.locator('.cal-day .cal-card .cc-t').allInnerTexts()).join('|').replace(/\s+/g, ' ') === '7:00 AM – 9:00 AM|3:00 PM – 4:00 PM|Whole Day');

  /* ---------- D. long unbroken text never breaks the layout ---------- */
  for (const v of ['month', 'week', 'day', 'agenda']) { await goto(p, '2026-10-20', v); ok('long text: no sideways scroll in ' + v + ' view', (await overflowX(p)) <= 1); }
  await goto(p, '2026-10-20', 'day'); await p.click('.cal-card.ev-inspection');
  ok('long text: detail panel stays inside the screen', await p.evaluate(() => { const m = document.querySelector('.modal'); const r = m.getBoundingClientRect(); return r.right <= innerWidth && m.scrollWidth <= m.clientWidth + 1; }));
  await p.click('button[data-act=closeModal]');

  /* ---------- E. calendar arithmetic ---------- */
  await goto(p, '2026-12-15', 'month'); await p.click('button[data-act=calNav][data-n="1"]'); await p.click('button[data-act=calNav][data-n="1"]');
  ok('Dec 2026 -> Next -> Next = February 2027 (crossing the new year)', (await p.locator('.cal-label').innerText()) === 'February 2027');
  ok('Feb 2027 shows 4 weeks (starts Monday, 28 days)', await p.locator('.cal-cell').count() === 28);
  await goto(p, '2026-08-15', 'month');
  ok('Aug 2026 needs 6 weeks (42 cells), first cell is Mon 27 Jul', await p.locator('.cal-cell').count() === 42 && (await p.locator('.cal-cell').first().getAttribute('data-d')) === '2026-07-27');
  await goto(p, '2028-02-10', 'month');
  ok('leap day 29 Feb 2028 exists', await p.locator('.cal-cell[data-d="2028-02-29"]:not(.out)').count() === 1);
  await goto(p, '2027-01-31', 'month'); await p.click('button[data-act=calNav][data-n="1"]');
  ok('31 Jan + Next month lands in February (no jump to March)', (await p.locator('.cal-label').innerText()) === 'February 2027');
  await p.click('button[data-act=calNav][data-n="-1"]'); await p.click('button[data-act=calNav][data-n="-1"]');
  ok('going back two months from Feb 2027 gives December 2026', (await p.locator('.cal-label').innerText()) === 'December 2026');
  await goto(p, '2026-10-31', 'week');
  ok('a week that crosses months is labelled with both (26 Oct - 01 Nov 2026)', /26 Oct – 01 Nov 2026/.test(await p.locator('.cal-label').innerText()));
  await goto(p, '2026-10-31', 'day'); await p.click('button[data-act=calNav][data-n="1"]');
  ok('Day view Next from 31 Oct = 1 November', /Sunday, November 1, 2026/.test(await p.locator('.cal-day h3').innerText()));
  await goto(p, '2026-10-06', 'week'); await p.click('button[data-act=calNav][data-n="1"]');
  ok('Week Next moves exactly 7 days', /12 Oct – 18 Oct 2026/.test(await p.locator('.cal-label').innerText()));
  await p.click('button[data-act=calToday]');
  ok('Today button in Week view returns to the week of 29 Sep 2026', /28 Sept? – 04 Oct 2026/.test(await p.locator('.cal-label').innerText()));
  ok('today is marked in week view', await p.locator('.cal-col.today').count() === 1);

  /* ---------- F. double clicks and repeated actions ---------- */
  await goto(p, '2026-11-10', 'month');
  const before = (await A('GET', '/api/state')).state.schedules.length;
  await p.click('button[data-act=calAdd]'); await p.check('input[name=ins_p][value=nieva]');
  await p.fill('input[name=ins_title]', 'Double click'); await p.fill('input[name=ins_project]', 'P'); await p.fill('input[name=ins_start]', '2026-11-10');
  await p.dblclick('button[data-act=calSave]'); await p.waitForTimeout(900);
  ok('double-clicking Save creates ONE schedule, not two', (await A('GET', '/api/state')).state.schedules.length === before + 1);
  await p.click('button[data-act=calAdd]'); await p.check('input[name=ins_p][value=nieva]');
  await p.fill('input[name=ins_title]', 'Clash'); await p.fill('input[name=ins_project]', 'P'); await p.fill('input[name=ins_start]', '2026-11-10');
  await p.click('button[data-act=calSave]'); await p.waitForSelector('button[data-act=calConfSave]');
  await p.dblclick('button[data-act=calConfSave]'); await p.waitForTimeout(900);
  ok('double-clicking "Save anyway" also creates ONE schedule', (await A('GET', '/api/state')).state.schedules.length === before + 2);
  await p.click('.cal-cell[data-d="2026-11-10"] .cal-ev >> nth=0'); await p.click('button[data-act=calDelete]'); await p.click('button[data-act=closeModal]');
  ok('Cancel on the delete confirmation keeps the schedule', (await A('GET', '/api/state')).state.schedules.length === before + 2);

  /* ---------- G. keyboard ---------- */
  await goto(p, '2026-10-06', 'month');
  await p.locator('.cal-cell[data-d="2026-10-06"] .cal-ev >> nth=0').focus(); await p.keyboard.press('Enter');
  ok('a chip can be opened from the keyboard (Enter)', await p.locator('#modalRoot .modal').count() === 1);
  await p.keyboard.press('Escape');
  ok('Escape closes the detail panel', await p.locator('#modalRoot .modal').count() === 0);
  await p.click('input[data-inp=calQ]'); await p.keyboard.type('adrl');
  ok('typing letters that are app shortcuts (a, d, r, l) into search does NOT trigger them', (await p.evaluate(() => location.hash)) === '#/schedule' && await p.locator('#modalRoot .modal').count() === 0 && (await p.inputValue('input[data-inp=calQ]')) === 'adrl');
  await p.fill('input[data-inp=calQ]', ''); await p.waitForTimeout(400);
  ok('every calendar button and field has an accessible name', await p.evaluate(() => [...document.querySelectorAll('#calBar button, #calBar select, #calBar input, .cal-ev, .cal-num')].every(e => (e.getAttribute('aria-label') || e.innerText || e.title || (e.labels && e.labels.length) || '').toString().trim())));

  /* ---------- H. state survives the auto-refresh / another user's change ---------- */
  await goto(p, '2026-10-14', 'week');
  await p.selectOption('select[data-chg=calPerson]', 'torino'); await p.selectOption('select[data-chg=calType]', 'inspection');
  await p.evaluate(() => refresh(true)); await p.waitForTimeout(500);
  ok('after the automatic refresh the view, date and both filters are unchanged', (await p.locator('.seg button[aria-pressed=true]').innerText()) === 'Week' && /12 Oct – 18 Oct 2026/.test(await p.locator('.cal-label').innerText()) && (await p.locator('select[data-chg=calPerson]').inputValue()) === 'torino' && (await p.locator('select[data-chg=calType]').inputValue()) === 'inspection' && await p.locator('.cal-card').count() === 3);
  const ctxB = await ctxFor(browser); const p2 = await openPage(ctxB, 'mpaling', 'Track@2026');
  await goto(p2, '2026-10-14', 'week');
  const n1 = await p2.locator('.cal-card').count();
  await add({ type: 'inspection', title: 'Added by someone else', project: 'P', startDate: '2026-10-14', endDate: '2026-10-14', startTime: '13:00', endTime: '14:00', personnel: ['salvador'] });
  await p2.evaluate(() => refresh(true)); await p2.waitForTimeout(500);
  ok('another user\u2019s new schedule appears on the next refresh, without losing the view', await p2.locator('.cal-card').count() === n1 + 1 && /12 Oct – 18 Oct 2026/.test(await p2.locator('.cal-label').innerText()));
  await ctxB.close();

  /* ---------- I. form behaviour ---------- */
  await goto(p, '2026-11-17', 'month'); await p.selectOption('select[data-chg=calPerson]', ''); await p.selectOption('select[data-chg=calType]', '');
  await p.click('button[data-act=calAdd]');
  await p.fill('input[name=ins_title]', 'Kept text'); await p.selectOption('#calFType', 'leave'); await p.selectOption('#calFType', 'inspection');
  ok('switching the schedule type back and forth keeps what was typed', (await p.inputValue('input[name=ins_title]')) === 'Kept text');
  ok('a new form opens on the calendar\u2019s selected date', (await p.inputValue('input[name=ins_start]')) === '2026-11-17');
  await p.selectOption('#calFType', 'meeting');
  ok('meeting defaults 8:00 AM - 5:00 PM and hides the inspection fields', (await p.inputValue('input[name=mtg_st]')) === '08:00' && (await p.inputValue('input[name=mtg_et]')) === '17:00' && !(await p.locator('input[name=ins_title]').isVisible()));
  await p.fill('input[name=mtg_st]', '10:30');
  await p.selectOption('#calFType', 'inspection'); await p.selectOption('#calFType', 'meeting');
  ok('a changed time is kept when switching type', (await p.inputValue('input[name=mtg_st]')) === '10:30');
  await p.click('button[data-act=closeModal]');
  await p.click('button[data-act=calAdd]');
  ok('a fresh form starts from the defaults again (8:00 AM - 5:00 PM), not from the last one', (await p.inputValue('input[name=ins_st]')) === '08:00' && (await p.inputValue('input[name=ins_title]')) === '');
  await p.click('button[data-act=closeModal]');
  await p.click('.cal-tile[data-t=leave]'); await p.click('button[data-act=calAdd]');
  ok('with the Leave tile active, Add Schedule opens on Leave', (await p.inputValue('#calFType')) === 'leave');
  await p.click('button[data-act=closeModal]'); await p.click('.cal-tile[data-t=leave]');

  /* ---------- J. leave type shown as inactive when editing old leave ---------- */
  const lts = (await A('GET', '/api/state')).state.leaveTypes;
  await A('PUT', '/api/leave-types', { value: lts.map(t => t.id === VAC ? Object.assign({}, t, { active: false }) : t) });
  await p.evaluate(() => refresh(true)); await p.waitForTimeout(400);
  await goto(p, '2026-10-27', 'day'); await p.click('.cal-card.ev-leave'); await p.click('button[data-act=calEdit]');
  ok('editing old leave whose type is now inactive still shows that type (marked inactive)', /Vacation Leave \(inactive\)/.test(await p.locator('select[name=lv_t]').innerText()) && (await p.locator('select[name=lv_t]').inputValue()) === VAC);
  await p.click('button[data-act=closeModal]');
  await A('PUT', '/api/leave-types', { value: (await A('GET', '/api/state')).state.leaveTypes.map(t => Object.assign({}, t, { active: true })) });

  /* ---------- K. print variants ---------- */
  await p.evaluate(() => refresh(true)); await p.waitForTimeout(400);
  await goto(p, '2026-10-14', 'week'); await p.selectOption('select[data-chg=calPerson]', 'torino');
  await p.click('button[data-act=calPrint]'); await p.waitForSelector('#pp.on');
  const pt = await p.locator('#ppBody').innerText();
  ok('week print lists only the chosen person and states the filters', /Personnel: Rodolfo M\. Torino Jr/.test(pt) && /Multi-day bar/.test(pt) && !/Early call/.test(pt) && /Week of/.test(pt));
  await p.click('button[data-act=ppClose]'); await p.selectOption('select[data-chg=calPerson]', '');
  await goto(p, '2026-10-27', 'day'); await p.click('button[data-act=calPrint]'); await p.waitForSelector('#pp.on');
  ok('day print lists that day only', /Late meeting/.test(await p.locator('#ppBody').innerText()) && !/Multi-day bar/.test(await p.locator('#ppBody').innerText()));
  await p.click('button[data-act=ppClose]');
  await p.fill('input[data-inp=calQ]', 'nothing-matches-this'); await p.waitForSelector('.cal-sr'); await p.click('button[data-act=calPrint]'); await p.waitForSelector('#pp.on');
  ok('print of an empty search says "Nothing scheduled" and names the search', /Nothing scheduled/.test(await p.locator('#ppBody').innerText()) && /nothing-matches-this/.test(await p.locator('#ppBody').innerText()));
  await p.click('button[data-act=ppClose]'); await p.click('button[data-act=calClearQ]');

  /* ---------- L. other time zones: a date is a date ---------- */
  for (const tz of ['America/Los_Angeles', 'Pacific/Auckland', 'Pacific/Kiritimati']) {
    const cz = await ctxFor(browser, { timezoneId: tz }); const pz = await openPage(cz);
    await goto(pz, '2026-10-06', 'month');
    ok(tz + ': the 6 Oct inspection is on 6 Oct (not shifted a day)', await pz.locator('.cal-cell[data-d="2026-10-06"] .cal-ev.ev-inspection').count() === 1 && await pz.locator('.cal-cell[data-d="2026-10-05"] .cal-ev.ev-inspection, .cal-cell[data-d="2026-10-07"] .cal-ev.ev-inspection').count() === 0);
    await pz.click('.cal-cell[data-d="2026-10-06"] .cal-ev.ev-inspection'); ok(tz + ': the detail shows 06 Oct 2026, 8:00 AM \u2013 5:00 PM', /06 Oct 2026/.test(await pz.locator('#modalRoot .dl').innerText()) && /8:00 AM – 5:00 PM/.test(await pz.locator('#modalRoot .dl').innerText()));
    await cz.close();
  }

  /* ---------- M. other screen sizes ---------- */
  for (const [w, h] of [[1024, 768], [820, 1180], [390, 844], [320, 640]]) {
    const cm = await ctxFor(browser, { viewport: { width: w, height: h }, isMobile: w < 800, hasTouch: w < 800 }); const pm = await openPage(cm);
    for (const v of ['month', 'week', 'day', 'agenda']) { await goto(pm, '2026-10-14', v); if ((await overflowX(pm)) > 1) ok(w + 'px ' + v + ' view: no sideways scroll', false); }
    ok(w + 'px: no view scrolls sideways (month, week, day, agenda)', true);
    await goto(pm, '2026-10-14', 'month');
    if (w === 390) await pm.screenshot({ path: SH + '/B-mobile-month.png' });
    if (w === 1024) await pm.screenshot({ path: SH + '/C-1024.png' });
    await pm.click('button[data-act=calAdd]');
    ok(w + 'px: the Add Schedule form fits on screen', await pm.evaluate(() => { const r = document.querySelector('.modal').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; }));
    if (w === 320) await pm.screenshot({ path: SH + '/D-320-form.png' });
    await cm.close();
  }

  /* ---------- N. the rest of the app still works ---------- */
  await p.click('.nav a[data-r=dashboard]'); await p.waitForSelector('.tiles, .kts, #regBody, .card');
  ok('Dashboard still opens', /Dashboard|Document|documents/i.test(await p.locator('.view').innerText()));
  for (const r of ['action', 'regular', 'analytics', 'graphs', 'reports', 'users', 'roles', 'divisions', 'refs', 'settings', 'audit']) {
    await p.click('.nav a[data-r=' + r + ']').catch(() => {}); await p.waitForTimeout(150);
    ok('existing page "' + r + '" still renders without an error message', !/could not be displayed/.test(await p.locator('.view').innerText()));
  }
  await p.click('.nav a[data-r=audit]'); await p.waitForTimeout(500);
  ok('Audit log page lists schedule activity', /Schedule (added|updated|deleted)/.test(await p.locator('.view').innerText()));

  ok('no JavaScript errors, no unexpected dialogs and no script execution during the whole run', errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + failn + ' failed');
  process.exit(failn ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(2); });
