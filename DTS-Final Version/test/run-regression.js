'use strict';
// Each suite gets its own demo database. Existing application data is never used.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const run = path.join(root, '.test-runs', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(run, { recursive: true });
const suites = process.argv.slice(2).length ? process.argv.slice(2) : [
  'api', 'new-rules', 'rules4', 'routing-visibility', 'schedule',
  'schedule.attack', 'phase10', 'phase11', 'workflow', 'audit-corrections'
];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const results = [];
async function ready(server, port) {
  for (let i = 0; i < 450; i++) {
    if (server.exitCode !== null) throw new Error('Server exited before becoming ready');
    try { if ((await fetch('http://127.0.0.1:' + port + '/healthz')).ok) return; } catch {}
    await sleep(100);
  }
  throw new Error('Server startup timed out');
}
(async () => {
  console.log('Artifacts: ' + run);
  for (const name of suites) {
    if (!/^[a-z0-9.-]+$/.test(name)) throw new Error('Invalid suite name');
    const dir = path.join(run, name);
    fs.mkdirSync(dir, { recursive: true });
    const port = Number(process.env.TEST_PORT || 3111);
    const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port),
      DATA_DIR: path.join(dir, 'data'), SEED_DEMO: '1', SR_TEST: '1',
      SR_NOW: '2026-01-15', TZ: 'Asia/Manila', SHOTS: dir,
      WF_BROWSER_CHANNEL: process.env.WF_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : '') };
    let serverLog = '';
    const server = spawn(process.execPath, ['server.js'], { cwd: root, env, windowsHide: true });
    server.stdout.on('data', b => { serverLog += b; });
    server.stderr.on('data', b => { serverLog += b; });
    let output = '', code = 2;
    try {
      await ready(server, port);
      let file = path.join(__dirname, name + '.test.js');
      if (name.endsWith('.ui') || name === 'splash') {
        // Portable copies keep the original assertions while adapting old Linux paths.
        let source = fs.readFileSync(file, 'utf8');
        source = source.replace(/chromium\.launch\(\)/g,
          "chromium.launch({headless:true,...(process.env.WF_BROWSER_CHANNEL?{channel:process.env.WF_BROWSER_CHANNEL}:{})})");
        source = source.replace("const B = 'http://localhost:3111';",
          "const B = 'http://localhost:' + process.env.PORT;");
        source = source.replace(/'\/home\/claude\/shots2?'/g, JSON.stringify(dir.replace(/\\/g, '/')));
        source = source.replace(/'\/tmp\/([^']+)'/g, (_, f) => JSON.stringify(path.join(dir, f).replace(/\\/g, '/')));
        file = path.join(dir, 'browser.test.cjs');
        fs.writeFileSync(file, source);
      }
      const child = spawn(process.execPath, [file], { cwd: root, env, windowsHide: true });
      child.stdout.on('data', b => { output += b; });
      child.stderr.on('data', b => { output += b; });
      const timer = setTimeout(() => child.kill(), 240000);
      code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', c => resolve(c)); });
      clearTimeout(timer);
    } catch (error) { output += error.stack; }
    finally {
      const stopped = new Promise(resolve => server.once('exit', resolve));
      if (server.exitCode === null) { server.kill(); await stopped; }
      fs.writeFileSync(path.join(dir, 'server.log'), serverLog);
      fs.writeFileSync(path.join(dir, 'test.log'), output);
    }
    const summary = output.match(/\d+ passed, \d+ failed/)?.[0];
    const result = { suite: name, exitCode: code, summary, directory: dir };
    results.push(result);
    console.log(name + ': ' + (code === 0 ? 'PASS' : 'FAIL') + (summary ? ' (' + summary + ')' : ''));
    if (code !== 0) console.log(output.slice(-5000));
    fs.writeFileSync(path.join(run, 'results.json'), JSON.stringify(results, null, 2));
  }
  process.exitCode = results.some(r => r.exitCode !== 0) ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
