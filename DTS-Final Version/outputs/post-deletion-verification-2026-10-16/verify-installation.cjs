'use strict';
// Read-only installation, live asset and database checks. No credentials are read.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '../..');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(path.join(root, file));
(async () => {
  const result = { at: new Date().toISOString(), node: process.version, failures: [] };
  const baseline = JSON.parse(read('outputs/verification-2026-10-16/source-sha256.json'));
  result.sourceComparison = Object.entries(baseline).map(([file, expected]) => ({
    file, sha256: sha(read(file)), matchesVerifiedBaseline: sha(read(file)) === expected
  }));
  const server = read('server.js').toString();
  const staticSection = server.slice(server.indexOf('const STATIC ='), server.indexOf('const CSP ='));
  const assets = [...new Set([...staticSection.matchAll(/\[\s*'([^']+)'\s*,\s*'(?:text|image)\//g)].map(match => match[1]))];
  result.staticAssets = [];
  for (const file of assets) {
    const endpoint = file === 'index.html' ? '/' : '/' + file;
    const response = await fetch('http://127.0.0.1:3000' + endpoint, { signal: AbortSignal.timeout(10000) });
    const body = Buffer.from(await response.arrayBuffer());
    const check = { file, status: response.status, matchesDisk: sha(body) === sha(read('public/' + file)) };
    result.staticAssets.push(check);
    if (check.status !== 200 || !check.matchesDisk) result.failures.push('Live asset mismatch: ' + file);
  }
  const references = new Set();
  for (const file of fs.readdirSync(path.join(root, 'public')).filter(file => /\.(html|css|js)$/.test(file))) {
    const source = read('public/' + file).toString();
    for (const match of source.matchAll(/(?:src|href)=["'](\/[^"'#?]+\.(?:js|css|svg|png))["']|url\(["']?(\/[^)'"?#]+)["']?\)/g)) references.add(match[1] || match[2]);
  }
  result.missingReferencedAssets = [...references].filter(ref => !fs.existsSync(path.join(root, 'public', ref.slice(1))));
  result.failures.push(...result.missingReferencedAssets.map(ref => 'Missing asset: ' + ref));
  result.deploymentFiles = ['server.js', 'package.json', 'public/index.html', 'start-dts.bat', 'Dockerfile', 'docker-compose.yml', 'dts.service', 'Caddyfile.example'].map(file => ({ file, exists: fs.existsSync(path.join(root, file)) }));
  for (const item of result.deploymentFiles) if (!item.exists) result.failures.push('Missing deployment file: ' + item.file);
  const db = new DatabaseSync(path.join(root, 'data/dts.sqlite'), { readOnly: true });
  const previous = JSON.parse(read('outputs/verification-2026-10-16/live-before.json'));
  const snapshot = new DatabaseSync(previous.snapshot, { readOnly: true });
  const tableDigest = (connection, table) => {
    const rows = connection.prepare('SELECT * FROM "' + table + '"').all();
    const normalized = rows.map(row => JSON.stringify(Object.fromEntries(Object.keys(row).sort().map(key => [key, row[key]])))).sort();
    return { count: rows.length, sha256: sha(JSON.stringify(normalized)) };
  };
  try {
    db.exec('BEGIN');
    result.database = { quickCheck: db.prepare('PRAGMA quick_check').all(), foreignKeyViolations: db.prepare('PRAGMA foreign_key_check').all(), tables: {} };
    result.database.comparisonSnapshot = previous.snapshot;
    for (const table of Object.keys(previous.tables)) {
      const current = tableDigest(db, table), before = tableDigest(snapshot, table);
      result.database.tables[table] = { ...current, matchesBeforeCleanup: current.sha256 === before.sha256 };
    }
    const oldUsers = new Map(snapshot.prepare('SELECT id,j FROM users').all().map(row => [row.id, JSON.parse(row.j)]));
    result.database.userChangesSincePreviousAudit = [];
    for (const row of db.prepare('SELECT id,j FROM users').all()) {
      const current = JSON.parse(row.j), before = oldUsers.get(row.id);
      const fields = before ? [...new Set([...Object.keys(current), ...Object.keys(before)])].filter(key => JSON.stringify(current[key]) !== JSON.stringify(before[key])) : ['added'];
      if (fields.length) result.database.userChangesSincePreviousAudit.push({ id: row.id, changedFields: fields });
    }
    result.database.invalidJSON = [];
    for (const table of ['users', 'docs', 'schedules', 'sr_config', 'sr_item', 'sr_assign']) {
      const count = db.prepare('SELECT count(*) AS n FROM "' + table + '" WHERE NOT json_valid(j)').get().n;
      if (count) result.database.invalidJSON.push({ table, count });
    }
    db.exec('ROLLBACK');
    if (result.database.quickCheck.some(row => row.quick_check !== 'ok')) result.failures.push('SQLite integrity check failed');
    if (result.database.foreignKeyViolations.length) result.failures.push('SQLite foreign key violations');
    if (result.database.invalidJSON.length) result.failures.push('Malformed persisted JSON');
  } finally { db.close(); snapshot.close(); }
  result.health = await (await fetch('http://127.0.0.1:3000/healthz', { signal: AbortSignal.timeout(10000) })).json();
  if (!result.health.ok) result.failures.push('Live health check failed');
  fs.writeFileSync(path.join(__dirname, 'installation.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.failures.length ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
