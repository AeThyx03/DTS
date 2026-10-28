# DTS stress launcher validation — 16 October 2026

**Final result: PASS.** The new launcher and its components were validated on an isolated copy of the enrolled-staff database. Production application source and the original business/configuration records were not changed.

- 6,000 documents: 600 in each of the ten workflow stages.
- 1,200 personnel schedules; baseline 240 Special Reports, plus one report generated and completed by the API scenario checks.
- 18 enrolled accounts; all 12 eligible processing staff received assignments.
- 150,480 reference/assignment combinations: no unexpected outcomes.
- 2,880 independent account × workflow-stage × document-action API probes: no unexpected outcomes or rejected-action data changes.
- 35 large-dataset browser assertions passed, including six simultaneous enrolled-role sessions, large CSV/print, responsive layouts and all major screens. No browser JavaScript errors or HTTP 500 responses.
- All 24 maintained regression suites passed: 1,268 numerical assertions plus the two workflow suites.
- 45 JavaScript files passed syntax checks; the batch file's argument/help path was executed successfully.
- Stress-server restart retained documents, schedules and Special Reports. SQLite integrity and foreign-key checks passed. Original business/configuration data matched the initial snapshot.

## Measured performance

| Full-state API concurrency | p95 latency | Request errors |
| ---: | ---: | ---: |
| 1 | 212 ms | 0 |
| 5 | 514 ms | 0 |
| 15 | 1,574 ms | 0 |
| 30 | 2,886 ms | 0 |

The full-state response was about 12.52 MiB. Peak sampled server working set was approximately 299 MiB. Browser used heap was approximately 98 MiB. Large print-preview creation took approximately 2.4 seconds. Concurrent history writes had no lost updates.

This machine held the tested dataset and concurrency without request failures. Full-state latency at 30 requests was close to the default 3-second budget; an earlier development run measured 3.37 seconds. Compare repeated runs before assuming more capacity. The report retains actual timings rather than treating successful HTTP responses as proof of unlimited performance.

## Validation history

Development validation caught test-harness setup issues: a reviewer equalled the submitter; the dashboard used a different heading container; Overdue Stay includes stalled records as well as overdue deadlines; and the print table displays tracking numbers rather than reference numbers. These harness expectations were corrected. The corrected API scenarios and browser component passed. Earlier outputs and the browser recheck are preserved; the final report records this history explicitly.

The browser component recheck ran against the same isolated 6,000-document instance while maintained regressions used separate fixtures. The validation invocation suppressed opening the interactive browser and stopped the test server on completion. A normal double-click opens DTS in a separate Edge/Chrome profile and keeps port 3500 running for inspection. The installed interactive browser executable was found.

See [STRESS-TEST.md](../STRESS-TEST.md) for launching, credentials and options. The final run is identified by [.stress-tests/3500/latest.json](../.stress-tests/3500/latest.json), with its interactive HTML report, timings, action results, source-data comparison and logs retained in that run directory.
