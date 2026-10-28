# DTS verification after file cleanup — 16 October 2026

**Result: no cleanup-related application errors found. All 24 regression suites passed. The running DTS server remains healthy.**

## Files and running application

- All 39 JavaScript files in the application, scripts and maintained tests passed `node --check`.
- All 19 application assets returned HTTP 200 from the running server at `http://127.0.0.1:3000` and matched their files on disk byte for byte.
- No missing local image, script or stylesheet references were found in the public application sources.
- The server, package manifest, application shell, Windows launcher, Docker files, systemd unit and Caddy example remain present.
- The six main application files recorded in the previous verification manifest retain their verified SHA-256 hashes: server, engine, client, Special Reports adapter, UX layer and package manifest.
- Node.js v24.21.0 satisfies the declared Node.js requirement. The shared Playwright runtime remains available.

## Fresh regression results

| Coverage | Suites passed | Numerical assertions passed |
| --- | ---: | ---: |
| API and business rules | 10 | 558 |
| Headless Edge browser checks | 14 | 710 |
| Total | 24 | 1,268 |

The two workflow suites passed without printing numerical assertion counts; they are included in the 24-suite total.

Coverage includes document registration/editing, validation and permissions, routing and review, compliance returns and release, deadline calculations, personnel scheduling and adversarial inputs, Special Report generation/actions, division reporting and navigation, Analytics/Charts, CSV/print, reference screens, saved views, settings, responsive layouts, splash, cursor effects and the previous audit corrections.

Backend checks used `npm test`. Browser checks used the maintained regression runner, shared Playwright and headless Microsoft Edge. Every suite used its own disposable database; no test suite targeted the live database.

See [results.json](results.json) for each suite and its retained test/server logs.

## Existing data

The live SQLite database was opened read-only. Its integrity check returned `ok`, with zero foreign-key violations and no malformed JSON in the checked record tables.

The database retains 18 users, no ordinary documents, three Special Reports, five Special Report configurations and three report assignments. Comparing the 14 business/configuration tables against the saved pre-cleanup SQLite snapshot found 13 tables identical. The only differing field in the users table was the administrator's `lastLogin` timestamp. No business/configuration record differences were found. This verification did not sign in to or change the live application.

See [installation.json](installation.json) for the hashes, asset checks, database results and final health check. The repeatable [verification script](verify-installation.cjs) reads the live database without updating it.

## Changes and final cleanup

No production source files or live business records were changed. Verification evidence was added in this output directory.

After preserving the results and per-suite logs, the three generated test-run directories created by this verification were removed. Their resolved paths were checked to remain inside this workspace's `.test-runs` directory, and their trees contained no reparse points. Existing data, backups and the shared dependency runtime were retained. See [generated-run-manifest.json](generated-run-manifest.json).

The final check after removing the temporary test databases again confirmed healthy DTS, all 19 assets available, zero missing references and SQLite integrity `ok`.

These results cover the local running application and the listed regression scenarios. Docker deployment, the Linux service, external HTTPS configuration and load testing were not executed during this check.
