# DTS stress test launcher

Double-click **`start-dts-stress-test.bat`**. It creates a fresh stress database, starts DTS at **http://127.0.0.1:3500**, opens Microsoft Edge or Chrome directly to DTS in a separate browser profile, runs the checks and keeps the server available for inspection. Keep the console open. Press **Ctrl+C** to stop the stress server.

The usual DTS on port 3000 and its enrolled accounts, passwords and business records are not changed. Port 3500 must be free; the launcher refuses to take over an existing server.

The separate browser profile also preserves the live DTS sign-in: browser cookies are shared across ports on the same hostname. If neither Edge nor Chrome is installed, automatic opening is reported as unavailable; use a private browser window for the stress instance.

## Sign in and inspect

The stress copy uses the **current enrolled accounts**, including their usernames, names, active states, roles, permissions, divisions and focal relationships. Every copied account uses the test password **`Stress@3500!`**; the console prints the current administrator username. Inactive accounts remain inactive. The organization heading identifies the stress instance.

Wait for the console's **RESULT** before editing records manually. Automated tests create, delete, restore and restart this isolated database, which can require signing in again. After RESULT, you can use the current staff accounts to inspect their work queues and exercise DTS yourself.

## Default workload

- **6,000 ordinary/regional documents**, generated through the shared workflow engine, spread over all ten statuses: received, at focal, processing, compliance, supervisor review, division review, department review, cleared, for return and released.
- Unstarted clocks, no deadlines, ongoing on time, due soon, due today, overdue, completed on time and completed late. Dates are based on the day the test runs. Every eligible active processing staff member receives work.
- **1,200 personnel schedules**, including inspections, leave and meetings; dense overlapping days, multiple personnel, all current active leave types and multi-day records across a two-year range.
- **240 Special Reports**, with processing/review/compliance/clearance/release states and single/shared assignments. Report deadlines use the application's working-day calculation.
- Synthetic movement histories and audit rows, current workflow definitions and the current reference lists. Two clearly named stress-only document types and, when needed, one no-deadline transaction are added in the copy to guarantee deadline-state coverage. Copied Special Report schedules are replaced by twelve inactive synthetic schedules so the test does not generate real-looking obligations. The copied session timeout is extended for the test.

## Automated coverage

1. **Reference combinations:** every active document type, communication type, configured division and priority. Ordinary documents additionally cross every transaction and every eligible enrolled assignee; regional reports cross designated regions and all twelve reporting months. Expected information-only assignment restrictions are checked.
2. **API action matrix:** every active enrolled account × every workflow stage × every supported document action. Each attempt has its own document copy. The harness compares HTTP behavior with the shared engine rules, checks persisted results and verifies that rejected actions did not change the record. With the present 18 active accounts, this is **2,880 independent API probes**. Probe copies are removed before performance measurement, leaving the 6,000-document dataset.
3. **Independent API scenarios:** enrolled-user authentication, division permissions, document creation and invalid edits, the full review/compliance/release lifecycle, all three schedule types, conflict warnings and confirmation, schedule editing/deletion, CSRF, unauthenticated access, workflow permissions, report generation/deduplication/reassignment/review/release, large backup export and valid/invalid restore.
4. **Concurrent load:** full state, scoped division state and polling at **1, 5, 15 and 30 simultaneous requests**. Default 30 requests per tier, with more polling requests; concurrent history writes check for lost updates. Backup export and audit listing are measured too. Reports include median, p95, maximum latency, throughput, response size, HTTP errors, server memory and CPU samples.
5. **Browser stress:** login, major screens, repeated reload/search/sort/page/filter operations, large CSV export, analytics, crowded calendar, responsive layouts, document details, JavaScript rendering timings, browser heap and simultaneous sessions across enrolled roles. Screenshots are saved.
6. **Maintained regressions:** all 24 existing backend/browser suites run on their own fresh standard fixtures and a separate automatically selected local port. These exercise standard validation/security/workflow cases; the enrolled-staff load instance stays on port 3500.
7. **Recovery:** restart the stress server, compare persisted document/schedule/report data, run SQLite integrity and foreign-key checks, and compare the original business/configuration tables against the initial read-only snapshot. Operational session/audit records and last-login timestamps are excluded from the original-data comparison.

This exhausts the listed finite dimensions. Arbitrary action sequences, every possible text input and future configurations are unbounded. The report records the actual coverage; it does not promise that future software changes cannot introduce errors. The server's configurable workflow designer remains in its supported publish/simulate mode; live routing continues to use the existing engine.

## Results

Each launch saves a new run under **`.stress-tests/3500/runs/`**. Open **`report.html`** inside that run. **`.stress-tests/3500/latest.json`** identifies the latest completed run. Detailed evidence includes `results.json`, `dataset.json`, `action-matrix.json`, `parameter-combinations.json`, screenshots and server/runner logs. Existing regression suites also retain their own `.test-runs` artifacts.

- **PASS:** requested checks completed without failures or warnings.
- **PARTIAL / REVIEW:** a coverage component was skipped or a measured API p95 exceeded the default **3,000 ms** budget. A latency warning reports slowness independently of request correctness.
- **FAIL:** an unexpected result, error, data mismatch or incomplete/interrupted run occurred.

Check CPU and memory samples when comparing runs. Results depend on this machine and the selected concurrency, request count, record count and current staff/configuration. Automated request concurrency is distinct from the smaller set of simultaneous real browser sessions.

Node.js **22.13+** is required. API/data checks have no external dependencies. Browser checks additionally require **Playwright and Microsoft Edge on Windows**. The launcher finds Playwright through the project, `NODE_PATH` or the Codex shared runtime. Missing browser tooling is reported as skipped coverage, never silently treated as a complete pass.

## Options

Run these from a command prompt in the DTS folder:

```bat
start-dts-stress-test.bat
start-dts-stress-test.bat --documents=10000 --concurrency=1,10,30,60 --requests=60
start-dts-stress-test.bat --documents=6000 --schedules=2000 --reports=480
start-dts-stress-test.bat --p95-ms=5000
```

Other options: `--no-browser` suppresses opening the interactive browser; `--no-ui` skips automated browser checks; `--skip-regression` skips the maintained suites; `--exit` stops the stress server after checks; `--source="D:\path\to\dts.sqlite"` selects a different enrolled-staff database read-only. Skipped coverage is clearly marked. Use `--help` to list options.

Every normal launch starts fresh; it does not overwrite earlier stress runs. Keep the run folders you need for comparison. Close the stress server before removing an old run's disposable database.
