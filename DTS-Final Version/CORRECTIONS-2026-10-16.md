# DTS corrections and cleanup — 16 October 2026

All 12 defects from the application audit have been corrected. The local server was restarted with the tested code and is healthy at `http://127.0.0.1:3000`. Refresh an existing browser tab to load the updated interface.

## Corrections

| Audit ID | Result |
| --- | --- |
| A10 | Restore validates nested records, identities, references and workflow structures before writing. It creates an independent SQLite recovery copy, builds the replacement state inside the transaction, and rolls back both persisted and in-memory state if loading fails. Older backups still preserve optional modules they omit. Malformed supplied modules are rejected rather than silently dropping records. |
| A01 | Metadata edits preserve unstarted assignment clocks. Already assigned documents retain their clock basis and deadline. |
| A02 | Registration and edits share validation for required fields, communication/document types, divisions, priority, periods and file URLs. Edits validate a proposed record before committing it. A metadata edit cannot convert between regional and ordinary routing or change a routed report's region. |
| A03 | Removing or renaming a document type is blocked when documents, Special Report schedules or workflows depend on it. Deactivation remains available. Used transaction types are also protected. |
| A09 | Division removal/renaming checks personnel, ordinary documents, Special Reports and workflow dependencies. Failed configuration saves reload authoritative state into the browser. |
| A06 | New regular reports derive division from their designated person when that person has a configured division. Server scopes, Analytics, Charts and their drilldowns share the same assignment-based reporting ownership helper. Existing stored workflow divisions are preserved. |
| A07 | Shared report ownership is independent of the viewer. Mixed/unresolved ownership is labelled in department reporting and excluded from individual division metrics. Viewer-specific assignment actions are preserved. |
| A11 | Special Report document rows carry release and clearance dates. Release totals include reports received in earlier months and released in the selected period. |
| A04 | Inactive focals cannot receive forwarded work. A configured focal must be replaced before their account can be deactivated. |
| A05 | Account creation rechecks case-insensitive username uniqueness after asynchronous password hashing and checks the current session before writing. |
| A08 | CSV export neutralizes formula-like user text, including leading whitespace/control characters, while retaining CSV escaping and numeric values. |
| A13 | Ordinary and Special Reports use the same working-day counter, carrying large thresholds into the next month and labelling the resulting date accurately. |

The existing department-wide viewing policy, CMED/CMSD permissions, document workflows and Node.js + SQLite architecture remain in place. No database schema migration or rewriting of existing records was performed. `npm test` now uses the isolated regression runner.

## Verification

**24 suites passed: 1,268 numerical assertions, plus the backend and browser workflow suites that do not print counts.** This includes 81 targeted API/business-rule assertions and 15 targeted browser assertions for the corrections.

The suite set covers API validation/permissions, routing, document lifecycle and compliance, Personnel Schedule and adversarial inputs, Special Reports, workflow design, reporting/navigation, responsive sidebar layout, Analytics/Charts controls, CSV/print, reference screens, splash and cursor behavior. Expected old assertions were updated for corrected Special Report release totals and rejection of malformed backups. The adversarial schedule browser test now accepts the intended discard confirmation and exercises legacy report URLs through the router. The test server startup allowance was extended for concurrent test load.

Additional checks opened 14 screens, Special Report details and the mobile CMED layout using an isolated snapshot of the existing database. The live login page and updated reporting helper loaded successfully. This check changed only the disposable copy.

The live database returned `quick_check: ok` and zero foreign-key violations. SHA-256 comparisons of 14 business/configuration tables before restart, after restart and after cleanup found **no changed tables**. Operational session/audit tables were excluded from this comparison. Existing users, documents, Special Reports, workflow definitions and settings were preserved.

- [Suite results](<D:/test server/staging-dts/New folder/dts-final version-workflow/DTS-Final Version/outputs/verification-2026-10-16/results.json>)
- [Existing-data browser checks](<D:/test server/staging-dts/New folder/dts-final version-workflow/DTS-Final Version/outputs/verification-2026-10-16/existing-data-smoke.json>)
- [Final integrity, record comparison and asset checks](<D:/test server/staging-dts/New folder/dts-final version-workflow/DTS-Final Version/outputs/verification-2026-10-16/post-cleanup.json>)

## Cleanup

Removed **1,959 generated files, freeing about 335 MB**:

- Completed `.test-runs/` databases, logs, screenshots, copied test scripts and temporary fixtures. The latest verification summaries and per-suite logs were retained under `outputs/verification-2026-10-16/`.
- The unused `public/workflow.before-designer.bak` source copy.
- The generated spreadsheet `.inspect.ndjson` cache; the actual workbook was retained.

A junction inside an old test directory pointed at the shared dependency runtime. The junction entry was removed without recursively traversing its target, and the shared Playwright installation remains present. Live `data/`, recovery backups, application assets, deployment/startup files, maintained tests, the cursor preview and the feature workbook were retained.

The complete removal manifest is [cleanup.json](<D:/test server/staging-dts/New folder/dts-final version-workflow/DTS-Final Version/outputs/verification-2026-10-16/cleanup.json>). Source recovery copies are under `.deployment-backups/audit-corrections-20261016-084600/`; the consistent database recovery copy is identified in [live-before.json](<D:/test server/staging-dts/New folder/dts-final version-workflow/DTS-Final Version/outputs/verification-2026-10-16/live-before.json>).

After deletion, the live health check passed, all assets referenced by the application shell remained present, and business/configuration data remained identical. Test artifacts can be regenerated by the maintained runner. Historical audit documents may refer to earlier generated runs that were deliberately removed during cleanup.
