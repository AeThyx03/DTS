/* Startup splash browser check. Needs Playwright + Chromium and a fresh demo server:
   SEED_DEMO=1 DATA_DIR=/tmp/t PORT=3111 node server.js */
const { chromium } = require('playwright');
const B = 'http://localhost:' + (process.env.PORT || 3111);
let pass = 0, failn = 0; const ok = (n, c) => { c ? pass++ : failn++; console.log((c ? 'PASS ' : 'FAIL ') + n); };
const gone = pg => pg.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 5000 }).then(() => true, () => false);
(async () => {
  const br = await chromium.launch({headless:true,channel:process.env.WF_BROWSER_CHANNEL||'msedge'}); const errs = [];
  const mk = async (opts) => { const ctx = await br.newContext(Object.assign({ viewport: { width: 1366, height: 768 } }, opts || {})); const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); return { ctx, pg }; };

  // 1. first open: splash is there before the app, then the login page appears, nothing protected is visible
  let { ctx, pg } = await mk();
  let release; const held = new Promise(r => { release = r; });
  await pg.route('**/api/state', async route => { await held; route.continue(); });
  await pg.goto(B, { waitUntil: 'domcontentloaded' });
  const txt = await pg.locator('#splash').innerText();
  ok('splash shows title, loading text and wait text', /POSSD DOCUMENT TRACKING AND ROUTING SYSTEM/.test(txt) && /System is loading\.\.\./.test(txt) && /Please wait while the system starts\./.test(txt));
  ok('logo is the existing POSSD logo asset', await pg.locator('.sp-logo').evaluate(i => i.getAttribute('src') === '/logo-white.png'));
  ok('spinner present', await pg.locator('.sp-spin').isVisible());
  ok('splash stays while the server has not answered (no fixed timer)', await (async () => { await pg.waitForTimeout(1500); return pg.locator('#splash').isVisible(); })());
  ok('nothing of the app is reachable behind the splash (inert)', await pg.locator('#app').evaluate(e => e.hasAttribute('inert')));
  ok('error state hidden while loading', !(await pg.locator('.sp-err').isVisible()));
  await pg.screenshot({ path: "D:/test server/staging-dts/New folder/dts-final version-workflow/DTS-Final Version/.test-runs/2026-10-07T05-38-07-404Z/splash/splash-loading.png" });
  release();
  ok('splash removed after the answer', await gone(pg));
  ok('login page shown when signed out', await pg.locator('#lu').isVisible() && await pg.locator('#app').evaluate(e => !e.hasAttribute('inert')));
  ok('no protected content on the login page', await pg.locator('.shell').count() === 0);

  // 2. login, refresh while signed in -> splash then dashboard, no login flash
  await pg.unroute('**/api/state');
  await pg.fill('#lu', 'admin'); await pg.fill('#lp', 'Admin@2026'); await pg.click('button[type=submit]'); await pg.waitForSelector('.shell');
  ok('login still works', await pg.locator('.shell').isVisible());
  await pg.reload({ waitUntil: 'domcontentloaded' });
  ok('reload: splash first', await pg.locator('#splash').count() === 1);
  await pg.waitForSelector('.shell'); ok('reload: goes straight to the dashboard (session kept)', await gone(pg) && await pg.locator('.shell').isVisible() && await pg.locator('#lu').count() === 0);
  await pg.click('.nav a[data-r=users]'); await pg.waitForSelector('text=Reset password'); ok('navigation works after the splash', true);
  await pg.goto(B + '/#/audit'); await pg.reload(); await pg.waitForSelector('.shell'); await gone(pg); ok('direct link / hash route survives refresh', /audit/i.test(await pg.locator('.pagehead h1').innerText()));
  // 3. logout / login again do not bring the splash back or get stuck
  await pg.click('.avatar'); await pg.click('[data-act=signout]'); await pg.waitForSelector('#lu');
  ok('logout works, no splash', await pg.locator('#splash').count() === 0);
  await pg.fill('#lu', 'admin'); await pg.fill('#lp', 'Admin@2026'); await pg.click('button[type=submit]'); await pg.waitForSelector('.shell'); ok('log back in', true);
  await ctx.close();

  // 4. server error -> error state (no technical details), Retry recovers
  ({ ctx, pg } = await mk());
  let bad = true; await pg.route('**/api/state', route => bad ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'SQLITE_ERROR at /srv/x.js:12 stack trace' }) }) : route.continue());
  await pg.goto(B, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#splash[data-state=error] .sp-err', { state: 'visible' });
  const et = await pg.locator('#splash').innerText();
  ok('error state text', /Unable to start the application\./.test(et) && /Please check the server connection and try again\./.test(et) && /Retry/.test(et));
  ok('no technical details or toast shown', !/SQLITE|stack|\.js/.test(et) && await pg.locator('.toast').count() === 0);
  ok('loading text hidden in error state', !(await pg.locator('.sp-load').isVisible()));
  ok('Retry button has keyboard focus', await pg.evaluate(() => document.activeElement && document.activeElement.classList.contains('sp-btn')));
  await pg.screenshot({ path: "D:/test server/staging-dts/New folder/dts-final version-workflow/DTS-Final Version/.test-runs/2026-10-07T05-38-07-404Z/splash/splash-error.png" });
  await pg.click('.sp-btn'); await pg.waitForSelector('#splash[data-state=error] .sp-err', { state: 'visible' }); ok('Retry while still failing returns to the error state', true);
  bad = false; await pg.keyboard.press('Enter'); ok('Retry (keyboard) recovers without closing the browser', await gone(pg) && await pg.locator('#lu').isVisible());
  await ctx.close();

  // 5. server unreachable
  ({ ctx, pg } = await mk());
  let off = true; await pg.route('**/api/state', route => off ? route.abort('connectionrefused') : route.continue());
  await pg.goto(B, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#splash[data-state=error] .sp-err', { state: 'visible' }); ok('unreachable server shows the error state', true);
  off = false; await pg.click('.sp-btn'); ok('Retry works once the server is back', await gone(pg));
  await ctx.close();

  // 6. reduced motion, sizes, no external requests
  for (const [w, h] of [[1920, 1080], [1600, 900], [1366, 768], [1280, 720], [1024, 600], [800, 600]]) {
    ({ ctx, pg } = await mk({ viewport: { width: w, height: h }, reducedMotion: 'reduce' }));
    let rel; const hold = new Promise(r => { rel = r; }); await pg.route('**/api/state', async r => { await hold; r.continue(); });
    await pg.goto(B, { waitUntil: 'domcontentloaded' });
    const box = await pg.locator('.sp-card').boundingBox();
    ok(w + 'x' + h + ': card centered and fully inside the window', box.x >= 0 && box.y >= 0 && box.x + box.width <= w && box.y + box.height <= h && Math.abs((box.x + box.width / 2) - w / 2) < 2);
    if (w === 1366) { ok('reduced motion: spinner is static and the text still explains', await pg.locator('.sp-spin').evaluate(e => getComputedStyle(e).animationName === 'none') && /System is loading/.test(await pg.locator('#splash').innerText())); await pg.screenshot({ path: "D:/test server/staging-dts/New folder/dts-final version-workflow/DTS-Final Version/.test-runs/2026-10-07T05-38-07-404Z/splash/splash-1366.png" }); }
    rel(); await ctx.close();
  }
  ({ ctx, pg } = await mk()); const ext = []; pg.on('request', r => { if (!r.url().startsWith(B)) ext.push(r.url()); });
  await pg.goto(B, { waitUntil: 'domcontentloaded' }); await gone(pg);
  ok('splash needs nothing outside localhost (only the fonts link already in the page may be external)', ext.every(u => /fonts\.(googleapis|gstatic)\.com/.test(u)));
  // 7. fade: element is fading, not removed abruptly
  await ctx.close();
  ({ ctx, pg } = await mk()); let r2; const h2 = new Promise(r => { r2 = r; }); await pg.route('**/api/state', async r => { await h2; r.continue(); });
  await pg.goto(B, { waitUntil: 'domcontentloaded' }); r2();
  const fading = await pg.waitForFunction(() => { const e = document.getElementById('splash'); return e && e.classList.contains('done') ? getComputedStyle(e).opacity : false; }, null, { timeout: 3000 }).then(h => h.jsonValue()).catch(() => false);
  ok('splash fades (opacity transition), then is removed', fading !== false && await gone(pg));
  await ctx.close();
  ok('no JavaScript errors', errs.length === 0); if (errs.length) console.log(errs);
  console.log('\n' + pass + ' passed, ' + failn + ' failed'); await br.close(); process.exit(failn ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
