const { chromium } = require('playwright');
const fs = require('fs');
const B = 'http://localhost:' + process.env.PORT;
const SH = "D:/test server/staging-dts/New folder/dts-final version-workflow/DTS-Final Version/.test-runs/2026-10-07T05-38-07-404Z/schedule.ui"; fs.mkdirSync(SH, { recursive: true });
let pass = 0, failn = 0;
const ok = (n, c) => { c ? pass++ : failn++; console.log((c ? 'PASS ' : 'FAIL ') + n); };
const errors = [];

async function newCtx(browser, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1400, height: 950 }, timezoneId: 'Asia/Manila', locale: 'en-US' }, opts || {}));
  await ctx.clock.setFixedTime(new Date('2026-09-29T09:00:00+08:00'));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  return ctx;
}
async function open(ctx, user, pw) {
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_FAILED|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(B);
  await page.fill('#lu', user); await page.fill('#lp', pw);
  await page.click('button[type=submit]');
  await page.waitForSelector('.shell');
  return page;
}
const modalOpen = p => p.locator('#modalRoot .modal').count().then(n => n > 0);

(async () => {
  const browser = await chromium.launch({headless:true,channel:process.env.WF_BROWSER_CHANNEL||'msedge'});
  const ctx = await newCtx(browser);
  const page = await open(ctx, 'admin', 'Admin@2026');

  /* ---------- navigation ---------- */
  ok('"Personnel Schedule" tab is in the sidebar', await page.locator('.nav a[data-r=schedule]').count() === 1);
  await page.click('.nav a[data-r=schedule]');
  await page.waitForSelector('#calBody');
  ok('page title and subtitle', (await page.locator('.pagehead h1').innerText()) === 'Personnel Schedule' && /Inspections, Leave & Meetings/.test(await page.locator('.pagehead p').innerText()));
  ok('opens on the current month (September 2026) with a Today marker', (await page.locator('.cal-label').innerText()) === 'September 2026' && await page.locator('.cal-cell.today').count() === 1);
  ok('legend shows the three event types', (await page.locator('.cal-legend .lg').allInnerTexts()).join('|').replace(/\s+/g, ' ').match(/Inspection.*Leave.*Meeting/) !== null);
  ok('view buttons: Month | Week | Day | Agenda', (await page.locator('.seg button').allInnerTexts()).join('|') === 'Month|Week|Day|Agenda');
  ok('summary tiles start at zero', (await page.locator('.cal-tile .n').allInnerTexts()).join(',') === '0,0,0');
  ok('summary title is "Today\u2019s Personnel Schedule"', /Today\u2019s Personnel Schedule/.test(await page.locator('#calSum h2').innerText()));
  await page.screenshot({ path: SH + '/01-empty-month.png' });

  /* ---------- Test 1: inspection with two personnel ---------- */
  await page.click('button[data-act=calAdd]');
  ok('Add Schedule opens the form; type selector offers Inspection, Leave, Meeting', await modalOpen(page) && (await page.locator('#calFType option').allInnerTexts()).length === 3);
  ok('inspection section is showing, leave and meeting hidden', await page.locator('[data-sect=inspection]').isVisible() && !(await page.locator('[data-sect=leave]').isVisible()) && !(await page.locator('[data-sect=meeting]').isVisible()));
  ok('personnel list is the existing users', await page.locator('input[name=ins_p]').count() >= 17);
  await page.click('button[data-act=calSave]');
  ok('empty inspection is refused with a message (nothing sent)', await page.locator('.toast.bad').count() > 0 && await modalOpen(page));
  ok('new inspection defaults to 8:00 AM - 5:00 PM', (await page.inputValue('input[name=ins_st]'))==='08:00' && (await page.inputValue('input[name=ins_et]'))==='17:00');
  await page.check('[data-sect=inspection] .pick-all input');
  ok('Select all ticks every personnel', await page.locator('input[name=ins_p]:checked').count() === await page.locator('input[name=ins_p]').count());
  await page.uncheck('input[name=ins_p][value=torino]');
  ok('unticking one person clears the Select all box', !(await page.locator('[data-sect=inspection] .pick-all input').isChecked()));
  await page.check('[data-sect=inspection] .pick-all input'); await page.uncheck('[data-sect=inspection] .pick-all input');
  ok('unticking Select all clears everyone', await page.locator('input[name=ins_p]:checked').count() === 0);
  await page.fill('[data-sect=inspection] input[data-inp=calPickQ]', 'rosario');
  await page.check('[data-sect=inspection] .pick-all input');
  ok('Select all applies only to the people shown by the search', await page.locator('input[name=ins_p]:checked').count() === 1);
  await page.fill('[data-sect=inspection] input[data-inp=calPickQ]', '');
  await page.check('input[name=ins_p][value=mojica]'); await page.check('input[name=ins_p][value=delrosario]');
  await page.fill('input[name=ins_title]', 'CPES Inspection');
  await page.fill('input[name=ins_project]', 'Project ABC');
  await page.fill('input[name=ins_location]', 'Project Site');
  await page.fill('input[name=ins_start]', '2026-09-29');
  await page.fill('input[name=ins_et]', '18:00'); await page.fill('input[name=ins_et]', '17:00');
  await page.screenshot({ path: SH + '/02-inspection-form.png' });
  await page.click('button[data-act=calSave]');
  await page.waitForFunction(() => !document.querySelector('#modalRoot .modal')); await page.waitForTimeout(500);
  ok('Test 1: inspection appears on Sept 29', await page.locator('.cal-cell[data-d="2026-09-29"] .cal-ev.ev-inspection').count() === 1);
  ok('summary now counts 2 inspection personnel', (await page.locator('.cal-tile .n').allInnerTexts()).join(',') === '2,0,0');
  await page.waitForSelector('.cal-cell[data-d="2026-09-29"] .cal-ev .et');
  ok('chip shows time, first name and title', /8:00 AM.*Del Rosario \+1.*CPES Inspection/.test(await page.locator('.cal-cell[data-d="2026-09-29"] .cal-ev .et').innerText()));

  /* ---------- Test 2: multi-day leave ---------- */
  await page.click('button[data-act=calAdd]');
  await page.selectOption('#calFType', 'leave');
  ok('leave form shows Personnel, Leave type, dates; inspection fields hidden', await page.locator('select[name=lv_p]').isVisible() && !(await page.locator('input[name=ins_title]').isVisible()));
  ok('leave types come from the reference list (4 starting types)', (await page.locator('select[name=lv_t] option').allInnerTexts()).join('|') === 'Select|Vacation Leave|Sick Leave|Special Leave|Other');
  await page.selectOption('select[name=lv_p]', 'mojica'); await page.selectOption('select[name=lv_t]', { label: 'Vacation Leave' });
  await page.fill('input[name=lv_start]', '2026-10-02'); await page.fill('input[name=lv_end]', '2026-10-01');
  await page.click('button[data-act=calSave]');
  ok('leave end date before start date is refused', await page.locator('.toast.bad', { hasText: 'end date cannot be before' }).count() > 0);
  await page.fill('input[name=lv_start]', '2026-09-30'); await page.fill('input[name=lv_end]', '2026-10-02');
  await page.click('button[data-act=calSave]');
  await page.waitForFunction(() => !document.querySelector('#modalRoot .modal')); await page.waitForTimeout(500);
  ok('Test 2: leave shows on Sept 30, Oct 1 and Oct 2', await page.locator('.cal-ev.ev-leave').count() === 3);
  ok('multi-day leave is drawn as one connected bar (start / mid / end)', await page.locator('.cal-ev.ev-leave.is-start').count() === 1 && await page.locator('.cal-ev.ev-leave.is-mid').count() === 1 && await page.locator('.cal-ev.ev-leave.is-end').count() === 1);
  ok('leave chip shows name and leave type', /Rey Reginald A\. Mojica.*Vacation Leave/.test(await page.locator('.cal-cell[data-d="2026-10-01"] .cal-ev .et').innerText()));

  /* ---------- Test 3 + 4: meeting on a day Engr. A is on leave -> conflict warning ---------- */
  await page.click('button[data-act=calAdd]');
  await page.selectOption('#calFType', 'meeting');
  ok('new meeting defaults to 8:00 AM - 5:00 PM', (await page.inputValue('input[name=mtg_st]'))==='08:00' && (await page.inputValue('input[name=mtg_et]'))==='17:00');
  await page.fill('input[name=mtg_title]', 'CPD Meeting');
  await page.fill('input[name=mtg_start]', '2026-09-30');
  await page.fill('input[name=mtg_st]', '14:00'); await page.fill('input[name=mtg_et]', '16:00');
  await page.fill('input[name=mtg_loc]', 'Conference Room');
  await page.fill('input[name=mtg_link]', 'not a link');
  await page.check('input[name=mtg_p][value=mojica]'); await page.check('input[name=mtg_p][value=delrosario]'); await page.check('input[name=mtg_p][value=torino]');
  await page.click('button[data-act=calSave]');
  ok('an invalid meeting link is refused', await page.locator('.toast.bad', { hasText: 'meeting link' }).count() > 0);
  await page.fill('input[name=mtg_link]', 'https://meet.google.com/abc-defg-hij');
  await page.fill('input[name=mtg_et]', '13:00');
  await page.click('button[data-act=calSave]');
  ok('meeting end time before start time is refused', await page.locator('.toast.bad', { hasText: 'end time must be later' }).count() > 0);
  await page.fill('input[name=mtg_et]', '16:00');
  await page.click('button[data-act=calSave]');
  await page.waitForSelector('#modalRoot .banner.warn');
  const cm = await page.locator('#modalRoot').innerText();
  ok('Test 4: "⚠ Scheduling Conflict" warning appears with the person and the leave', /⚠ Scheduling Conflict/.test(cm) && /Rey Reginald A\. Mojica is already on Vacation Leave during this scheduled meeting\./.test(cm));
  ok('warning offers to go back or save anyway (warn, do not silently block)', await page.locator('button[data-act=calConfBack]').count() === 1 && await page.locator('button[data-act=calConfSave]').count() === 1);
  await page.screenshot({ path: SH + '/03-conflict.png' });
  await page.click('button[data-act=calConfBack]');
  ok('"Go back" returns to the form with everything still filled in', (await page.inputValue('input[name=mtg_title]')) === 'CPD Meeting' && (await page.locator('input[name=mtg_p]:checked').count()) === 3 && (await page.inputValue('input[name=mtg_link]')).startsWith('https://meet'));
  await page.click('button[data-act=calSave]');
  await page.waitForSelector('button[data-act=calConfSave]');
  await page.click('button[data-act=calConfSave]');
  await page.waitForFunction(() => !document.querySelector('#modalRoot .modal')); await page.waitForTimeout(500);
  ok('Test 3: after confirming, the meeting is saved and shows on Sept 30', await page.locator('.cal-cell[data-d="2026-09-30"] .cal-ev.ev-meeting').count() === 1);

  /* ---------- event detail panel ---------- */
  await page.click('.cal-cell[data-d="2026-09-30"] .cal-ev.ev-meeting');
  const md = await page.locator('#modalRoot').innerText();
  ok('meeting detail: title, participants, time, location, link, and a live conflict note', /CPD Meeting/.test(md) && /Participants/.test(md) && /2:00 PM – 4:00 PM/.test(md) && /Conference Room/.test(md) && /meet\.google\.com/.test(md) && /Scheduling Conflict/.test(md));
  ok('meeting link opens safely in a new tab', await page.locator('#modalRoot a[href^="https://meet.google.com"][target=_blank][rel*=noopener]').count() === 1);
  ok('authorised user sees Edit and Delete', await page.locator('button[data-act=calEdit]').count() === 1 && await page.locator('button[data-act=calDelete]').count() === 1);
  await page.screenshot({ path: SH + '/04-detail.png' });
  await page.click('button[data-act=closeModal]');
  await page.click('.cal-cell[data-d="2026-10-01"] .cal-ev.ev-leave');
  const ld = await page.locator('#modalRoot').innerText();
  ok('leave detail: person, leave type, start, end, duration, return date', /Vacation Leave/.test(ld) && /Wed, 30 Sept? 2026/.test(ld) && /Fri, 02 Oct 2026/.test(ld) && /3 calendar days/.test(ld) && /Mon, 05 Oct 2026/.test(ld));
  await page.click('button[data-act=closeModal]');

  /* ---------- edit ---------- */
  await page.click('.cal-cell[data-d="2026-09-29"] .cal-ev.ev-inspection'); await page.click('button[data-act=calEdit]');
  ok('edit form is filled with the saved values and the type is locked', (await page.inputValue('input[name=ins_title]')) === 'CPES Inspection' && await page.locator('input[name=ins_p]:checked').count() === 2 && await page.locator('#calFType').count() === 0);
  await page.fill('input[name=ins_title]', 'CPES Inspection (revised)');
  await page.check('input[name=ins_p][value=torino]');
  await page.click('button[data-act=calSave]');
  await page.waitForFunction(() => !document.querySelector('#modalRoot .modal')); await page.waitForTimeout(500);
  ok('edit saved: still ONE inspection, now three people', await page.locator('.cal-ev.ev-inspection').count() === 1 && /CPES Inspection \(revised\)/.test(await page.locator('.cal-ev.ev-inspection .et').innerText()));

  /* ---------- Test 5: overlap within a day ---------- */
  await page.click('button[data-act=calAdd]');
  await page.selectOption('#calFType', 'meeting');
  await page.fill('input[name=mtg_title]', 'Management Meeting'); await page.fill('input[name=mtg_start]', '2026-09-29');
  await page.fill('input[name=mtg_st]', '10:00'); await page.fill('input[name=mtg_et]', '11:00');
  await page.check('input[name=mtg_p][value=mojica]');
  await page.click('button[data-act=calSave]');
  await page.waitForSelector('button[data-act=calConfSave]');
  ok('Test 5: a 10-11 meeting inside an 8-5 inspection is flagged', /already scheduled for the inspection/.test(await page.locator('#modalRoot').innerText()));
  await page.click('button[data-act=calConfSave]');
  await page.waitForFunction(() => !document.querySelector('#modalRoot .modal')); await page.waitForTimeout(500);

  /* ---------- summary tiles for the selected date ---------- */
  ok('summary for Sept 29: 3 inspection personnel, 0 on leave, 1 meeting person', (await page.locator('.cal-tile .n').allInnerTexts()).join(',') === '3,0,1');

  /* ---------- Test 6: filters ---------- */
  await page.selectOption('select[data-chg=calPerson]', 'torino');
  ok('Test 6: personnel filter shows only Torino\u2019s schedules (inspection + meeting, no leave)', await page.locator('.cal-ev.ev-inspection').count() === 1 && await page.locator('.cal-ev.ev-meeting').count() === 1 && await page.locator('.cal-ev.ev-leave').count() === 0);
  await page.selectOption('select[data-chg=calPerson]', 'mojica');
  ok('Mojica sees inspection, meetings and 3 days of leave', await page.locator('.cal-ev.ev-leave').count() === 3 && await page.locator('.cal-ev.ev-inspection').count() === 1 && await page.locator('.cal-ev.ev-meeting').count() === 2);
  await page.selectOption('select[data-chg=calType]', 'inspection');
  ok('Test 6: person + event type combine (Mojica + Inspection = 1 event)', await page.locator('.cal-ev').count() === 1);
  await page.selectOption('select[data-chg=calPerson]', '');
  ok('All Personnel + Inspection = every inspection, nothing else', await page.locator('.cal-ev.ev-inspection').count() === 1 && await page.locator('.cal-ev.ev-leave, .cal-ev.ev-meeting').count() === 0);
  await page.selectOption('select[data-chg=calType]', '');
  ok('filters cleared: everything is back', await page.locator('.cal-ev').count() === 6);

  /* ---------- summary tile filters the calendar ---------- */
  await page.click('.cal-tile[data-t=inspection]');
  ok('clicking a summary tile filters to that type and opens that date\u2019s day view', (await page.locator('select[data-chg=calType]').inputValue()) === 'inspection' && await page.locator('.cal-day').count() === 1);
  await page.click('.cal-tile[data-t=inspection]');

  /* ---------- views ---------- */
  await page.click('.seg button[data-v=week]');
  ok('Week view: 7 day columns for 28 Sep - 4 Oct 2026', await page.locator('.cal-col').count() === 7 && /28 Sept? – 04 Oct 2026/.test(await page.locator('.cal-label').innerText()));
  ok('Week view shows detailed cards', await page.locator('.cal-card').count() >= 5);
  await page.screenshot({ path: SH + '/05-week.png' });
  await page.click('.seg button[data-v=day]');
  ok('Day view shows the anchor date (Tuesday, September 29, 2026) with its schedules', /Tuesday, September 29, 2026/.test(await page.locator('.cal-day h3').innerText()) && await page.locator('.cal-day .cal-card').count() === 2);
  await page.screenshot({ path: SH + '/06-day.png' });
  await page.click('button[data-act=calNav][data-n="1"]');
  ok('Next moves the day view forward one day', /Wednesday, September 30, 2026/.test(await page.locator('.cal-day h3').innerText()));
  await page.click('button[data-act=calToday]');
  ok('Today returns to the current date', /Tuesday, September 29, 2026/.test(await page.locator('.cal-day h3').innerText()));
  await page.click('.seg button[data-v=agenda]');
  const ag = await page.locator('#calBody').innerText();
  ok('Test 7: Agenda lists dates in order with time, type, people, place', ag.indexOf('September 29, 2026') < ag.indexOf('September 30, 2026') && ag.indexOf('September 29, 2026') >= 0 && /8:00 AM – 5:00 PM/.test(ag) && /Whole Day/.test(ag) && /Project ABC – Project Site/.test(ag));
  ok('Agenda repeats multi-day leave on every date with "Day n of 3"', /Day 1 of 3/.test(ag));
  ok('Agenda shows the meeting participant count', /Participants: 3/.test(ag));
  await page.screenshot({ path: SH + '/07-agenda.png' });
  await page.click('button[data-act=calNav][data-n="1"]');
  ok('Agenda Next moves to October 2026', (await page.locator('.cal-label').innerText()) === 'October 2026');
  await page.click('button[data-act=calToday]');
  await page.click('.seg button[data-v=month]');

  /* ---------- search across all dates ---------- */
  await page.selectOption('select[data-chg=calPerson]', '');
  await page.fill('input[data-inp=calQ]', 'project abc');
  await page.waitForSelector('.cal-sr');
  ok('search finds by project and says it covers all dates', /1 result for “project abc” across all dates/.test(await page.locator('.cal-sr').innerText()));
  await page.fill('input[data-inp=calQ]', 'vacation');
  await page.waitForFunction(() => /vacation/.test(document.querySelector('.cal-srh')?.innerText || ''));
  ok('search finds by leave type', /1 result/.test(await page.locator('.cal-srh').innerText()));
  ok('typing in search keeps the cursor in the box', await page.evaluate(() => document.activeElement && document.activeElement.matches('input[data-inp=calQ]')));
  await page.fill('input[data-inp=calQ]', 'conference');
  await page.waitForFunction(() => /conference/.test(document.querySelector('.cal-srh')?.innerText || ''));
  ok('search finds by location', /1 result/.test(await page.locator('.cal-srh').innerText()));
  await page.fill('input[data-inp=calQ]', 'Del Rosario');
  await page.waitForFunction(() => /rosario/i.test(document.querySelector('.cal-srh')?.innerText || ''));
  ok('search finds by personnel', /2 results/.test(await page.locator('.cal-srh').innerText()));
  await page.screenshot({ path: SH + '/08-search.png' });
  await page.click('button[data-act=calClearQ]');
  ok('Clear search returns to the calendar', await page.locator('.cal-grid').count() === 1 && (await page.inputValue('input[data-inp=calQ]')) === '');

  /* ---------- print ---------- */
  await page.click('button[data-act=calPrint]');
  await page.waitForSelector('#pp.on');
  const pt = await page.locator('#ppBody').innerText();
  ok('print sheet: module title, period, filters, personnel, event type, details', /Personnel Schedule – Inspections, Leave & Meetings/.test(pt) && /September 2026/.test(pt) && /Personnel: All Personnel/.test(pt) && /Event type: All/.test(pt) && /CPES Inspection \(revised\)/.test(pt) && /Vacation Leave/.test(pt) && /CPD Meeting/.test(pt));
  ok('print sheet has no navigation controls', await page.locator('#ppBody .cal-bar, #ppBody .seg, #ppBody button').count() === 0);
  await page.screenshot({ path: SH + '/09-print.png' });
  await page.click('button[data-act=ppClose]');

  /* ---------- delete ---------- */
  await page.click('.cal-cell[data-d="2026-09-29"] .cal-ev.ev-meeting'); await page.click('button[data-act=calDelete]');
  await page.click('button[data-act=confirmYes]');
  await page.waitForFunction(() => !document.querySelector('#modalRoot .modal')); await page.waitForTimeout(500);
  ok('delete asks for confirmation, then removes it', await page.locator('.cal-cell[data-d="2026-09-29"] .cal-ev.ev-meeting').count() === 0);

  /* ---------- Reference lists: Leave types ---------- */
  await page.click('.nav a[data-r=refs]');
  await page.waitForSelector('text=Leave types');
  ok('Leave types card sits on Reference lists with the 4 starting types', await page.locator('.card:has(h3:text-is("Leave types")) tbody tr').count() === 4);
  await page.fill('.card:has(h3:text-is("Leave types")) input[name=v]', 'Maternity Leave');
  await page.click('button[data-act=ltAdd]');
  await page.waitForFunction(() => document.body.innerText.includes('Maternity Leave'));
  ok('add a leave type', await page.locator('.card:has(h3:text-is("Leave types")) tbody tr').count() === 5);
  await page.click('.card:has(h3:text-is("Leave types")) tr:has-text("Maternity Leave") button[data-act=ltForm]');
  await page.fill('[data-form=leavetype] input[name=name]', 'Maternity / Paternity Leave');
  await page.click('button[data-act=ltSave]');
  await page.waitForFunction(() => document.body.innerText.includes('Maternity / Paternity Leave'));
  ok('edit a leave type (the new name is shown)', await page.locator('.card:has(h3:text-is("Leave types")) tr:has-text("Maternity / Paternity Leave")').count() === 1 && await page.locator('.card:has(h3:text-is("Leave types")) tr:has-text("Maternity Leave"):not(:has-text("/"))').count() === 0);
  await page.click('.card:has(h3:text-is("Leave types")) tr:has-text("Maternity / Paternity") button[data-act=ltToggle]');
  await page.waitForSelector('.card:has(h3:text-is("Leave types")) tr:has-text("Maternity / Paternity") .b-neu');
  ok('deactivate a leave type (Inactive badge shown, Activate button offered)', await page.locator('.card:has(h3:text-is("Leave types")) tr:has-text("Maternity / Paternity") button[data-act=ltToggle]:text-is("Activate")').count() === 1);
  await page.screenshot({ path: SH + '/10-leave-types.png', fullPage: false });
  await page.click('.nav a[data-r=schedule]'); await page.click('button[data-act=calAdd]'); await page.selectOption('#calFType', 'leave');
  ok('an inactive leave type is no longer offered for new leave', !(await page.locator('select[name=lv_t]').innerText()).includes('Maternity'));
  await page.click('button[data-act=closeModal]');

  /* ---------- Roles page carries the new permission ---------- */
  await page.click('.nav a[data-r=roles]');
  ok('Roles & permissions lists "Add, edit and delete inspections, leave and meetings"', /inspections, leave and meetings/i.test(await page.locator('.view').innerText()));

  /* ---------- theme + mobile ---------- */
  await page.click('.nav a[data-r=schedule]');
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); });
  await page.screenshot({ path: SH + '/11-dark.png' });
  await page.evaluate(() => { document.documentElement.removeAttribute('data-theme'); });
  await ctx.close();

  /* ---------- a user WITHOUT the permission: view only ---------- */
  const ctx2 = await newCtx(browser);
  const p2 = await open(ctx2, 'dcruz', 'Track@2026');
  await p2.click('.nav a[data-r=schedule]'); await p2.waitForSelector('#calBody');
  ok('ordinary user can view the calendar and its events', await p2.locator('.cal-ev').count() >= 5);
  ok('ordinary user has NO Add Schedule button', await p2.locator('button[data-act=calAdd]').count() === 0);
  await p2.click('.cal-cell[data-d="2026-09-29"] .cal-ev.ev-inspection');
  ok('ordinary user sees details but no Edit / Delete', await p2.locator('#modalRoot .dl').count() === 1 && await p2.locator('button[data-act=calEdit], button[data-act=calDelete]').count() === 0);
  await p2.click('button[data-act=closeModal]');
  ok('ordinary user has no Reference lists page (leave types stay admin-only)', await p2.locator('.nav a[data-r=refs]').count() === 0);
  await p2.evaluate(() => { location.hash = '#/refs'; });
  ok('opening #/refs directly is refused for the ordinary user', /do not have access/.test(await p2.locator('.view').innerText()));
  await ctx2.close();

  /* ---------- phone-size screen ---------- */
  const ctx3 = await newCtx(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p3 = await open(ctx3, 'admin', 'Admin@2026');
  await p3.goto(B + '/#/schedule'); await p3.waitForSelector('#calBody');
  await p3.screenshot({ path: SH + '/12-mobile-month.png' });
  ok('mobile: the page does not scroll sideways', await p3.evaluate(() => document.querySelector('#view').scrollWidth <= document.querySelector('#view').clientWidth + 1));
  await p3.click('.cal-cell[data-d="2026-09-30"] .cal-num');
  await p3.waitForSelector('.cal-day');
  await p3.screenshot({ path: SH + '/13-mobile-day.png' });
  ok('mobile: tapping a day opens the readable day view', await p3.locator('.cal-day .cal-card').count() >= 2);
  await p3.click('.seg button[data-v=week]');
  ok('mobile: week view stacks days vertically', await p3.evaluate(() => { const c = [...document.querySelectorAll('.cal-col')]; return c.length === 7 && c[1].getBoundingClientRect().top > c[0].getBoundingClientRect().top + 10; }));
  await p3.screenshot({ path: SH + '/14-mobile-week.png' });
  await p3.click('button[data-act=calAdd]');
  ok('mobile: the form fits the screen', await p3.evaluate(() => { const m = document.querySelector('.modal'); return m.getBoundingClientRect().width <= window.innerWidth; }));
  await ctx3.close();

  ok('no JavaScript errors in the browser console during the whole run', errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + failn + ' failed');
  process.exit(failn ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(2); });
