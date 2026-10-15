# Workflow Engine implementation and migration status

## Current application

- Node.js 22.13+ using `node:http`, built-in `node:sqlite`, and static vanilla JavaScript, CSS, and HTML. There is no React app, PostgreSQL service, or ORM.
- `public/engine.js` owns the existing workflow rules and permissions. `server.js` authenticates users and applies document actions. The document status sequence is `received`, `at_focal`, `processing`, `compliance`, `sup_review`, `div_review`, `dept_review`, `cleared`, `return_out`, and `out`.
- Existing rules include focal grants, role permissions, override, designated OIC, and approver fallback through `deptApprovers` (present Department Manager, present Division Manager, nominated OIC). Existing action history remains embedded in document records and in the audit table.

## Added foundation

- Additive SQLite tables store workflows, versions, nodes, transitions, document type mode, execution instance, and instance history. Existing document tables and JSON records are not rewritten.
- Definitions are editable as drafts; published versions are immutable and can be forked into a new draft. The visual editor uses the existing application styles and browser APIs; no package or service was added.
- System Administrator only can access the workflow page and its APIs. The converted existing workflow is a draft with the current review sequence and a return path. Validation catches missing/duplicate start, missing finish, unreachable nodes, dead ends, non-terminating paths, invalid responsibility references, malformed conditions, and invalid decision branches.
- Simulation accepts an optional document ID and only returns a simulated path; it does not write to document state.
- Workflow data is included in newly exported JSON backups. Older backups without workflow fields leave workflow tables untouched when restored.

## Production behavior and migration boundary

Every document type remains `LEGACY`. The current document creation and action handlers were not changed. The `ENGINE` mode is intentionally rejected by the server because document creation, task assignment, permission-aware actions, and status/history projection have not yet been connected to workflow instances. Do not switch production document types until that integration and scenario comparison are complete. Existing documents are not attached to a new version.

This implementation is Phases 1–3 groundwork. It does not yet fulfill production cutover, runtime task execution, or Phase 4 verification. The `workflow_instances` and `workflow_history` tables are reserved for that integration; this release does not write operational instances there.

## OIC and responsibility reuse

The draft records the current manager/OIC fallback and does not add a second OIC configuration. The persisted definition format and validator recognize role, user, division, and role-plus-division responsibility references; the properties panel exposes role, specific user, division, role-plus-division, and current assignee configuration. Read-only simulation resolves candidates; operational task responsibility still needs runtime integration with the existing permission/responsibility rules.

## Capacity and infrastructure

The README describes a single-server office deployment. For that stated usage, the existing Node/SQLite setup is sufficient: graph payloads are capped at 100 nodes and 250 edges, lookup indexes are added, and no polling, background worker, dependency, or external storage is introduced. SQLite WAL and the existing daily database backups remain in use. No major infrastructure increase is needed for definitions and administration. Actual user, document, and execution volumes were not supplied, so larger-scale capacity cannot be certified from repository evidence alone.

## Modified files

- `server.js`: additive schema, protected workflow APIs, validation, simulation, audit, and backup/restore support; no change to current document action logic.
- `public/client.js`: System Administrator navigation and route gate.
- `public/index.html`: workflow assets.
- `public/workflow.js`, `public/workflow.css`: designer, conversion, validation, simulation, version controls, and status display.

## Untouched areas

`public/engine.js`, existing document and Special Report action handlers, user/role/division/OIC data structures, existing document statuses and histories, authentication, and deployment configuration were left unchanged. No package dependency or destructive migration was added.

## Remaining migration work

Implement runtime responsibility resolution and task execution by reusing the current authorization rules; support full condition editing and branch selection; bind new-document creation to a pinned published version; write instance/history rows transactionally alongside legacy-compatible document history; build document-specific simulation scenarios; then compare normal, return/re-review, OIC, manager fallback, override, and clear-for-out behavior for one document type before enabling it. Existing documents must retain their legacy path or an explicitly selected pinned version.

## Designer revision — 7 October 2026

The palette is simplified to Start, Action, Decision and End. An Action defaults to Review and its Action type property chooses Review, Approval, Assignment, Notification, Return/Revision or Clear for Out. The stored type remains the existing supported business type, preserving old workflows and validation/simulation behavior. This does not introduce operational task execution. Connector text now uses the application's actual `--ink` theme token rather than the undefined `--text` token. Return/backward connections route below the nodes and enter the destination's right-side return input; connection properties can explicitly choose left, right or automatic routing. Target-side metadata persists with the connection.

The reference-style diagram update adds a dotted canvas, pastel/slate/minimal themes, diamond decision nodes, rounded terminal nodes, multiline descriptions and right-angle connectors. Layout has hierarchical and adaptive (predecessor-position ordering) modes with left-to-right, right-to-left, top-to-bottom and bottom-to-top directions. Layout runs only when Arrange is selected. Hand mode complements space/middle-button panning. Discard changes confirms and reloads the last saved draft; it does not delete the workflow/version. Browser checks cover all four directions, theme switching, and restoration of saved positions/connections after discarding.

The designer now provides compact workflow/version selectors, a searchable categorized palette, palette drag/drop, shared node content and visual shells, dedicated input/output handles, branch labels, live preview, connection properties and controlled condition fields. START rejects incoming edges, END rejects outgoing edges, self/duplicate handle connections are rejected, and approval/decision outputs persist in edge condition metadata.

Multi-selection, group movement, delete, duplicate, copy/paste, undo/redo, keyboard shortcuts, wheel zoom, space/middle-button pan, calculated fit, grid snapping, minimap and explicit auto layout are implemented. Canvas edits do not send requests for each movement. Save status and unsaved-change protection are visible. Graph fingerprints reject stale saves from a second administrator. Published versions can be validated/simulated without attempting to save them; publishing requires a confirmation dialog.

Simulation now evaluates the supported controlled edge conditions against a selected document, reports responsible user candidates and branch results, calls the existing manager/OIC resolver for department approval responsibility, supports selected branch labels, and bounds revision cycles. This is a read-only trace, not proof of authorization or business-rule equivalence. It does not execute assignments, approvals, notifications or document status transitions.

Remaining master-prompt scope includes executable generic nodes, delay/parallel/merge semantics, activation/archive administration, runtime task/instance APIs, full legacy equivalence and migration verification, context menus and canvas notes. A node registry alone does not make those execution features complete. No production document type was migrated.

Tests use a fresh temporary demo database. The existing API regression suite passed 51 checks. Workflow API checks cover persistence, branch metadata, conditions, responsibility candidates, immutable versions, conflicts, authorization and read-only simulation. Browser checks passed for palette drop, port-drag preview and creation, live labels, saving, undo/redo, duplicate/delete, fit, minimap, and absence of page errors. The tests are in `test/workflow.ui.test.js`; run with Playwright and Chromium or `WF_BROWSER_CHANNEL=msedge` when Edge is installed.
