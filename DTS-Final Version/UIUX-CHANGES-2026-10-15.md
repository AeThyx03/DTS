# DTS UI/UX implementation — 15 October 2026

Implemented the UI/UX recommendations for the existing document workflow.

## Delivered

| Area | Changes |
| --- | --- |
| Landing and work queues | Fresh staff sign-ins open My work; managers and administrators open Department overview. Deep links retain their destination. Personal queue sorting, selection, printing and CSV export use that queue. |
| Document summary | Status, current responsible person, deadline, time at desk and next action appear together above the workflow. |
| Stage action | The current stage action appears first. Reassignment, return instructions and deletion are grouped under Other document actions; administrative overrides have their own collapsed disclosure. |
| Document organization | Files & links groups original, draft and revised links with their purpose. Details, review comments and movement history follow the action. The duplicate nested Deadline card is removed. |
| Detail layout | Wider desktop metadata column, readable wrapping, responsive stacking and document traversal through the originating queue. |
| Registry preview | Optional right-hand drawer preserves filters, sort, page and registry position. It supports document actions and opening the full document. |
| Registry preferences | Filters, sorting, visible columns and page size survive reloads per account on the current browser. Initial columns emphasize tracking, subject, custodian/desk age, deadline and lifecycle/status. |
| Saved views | My overdue, Awaiting assignment and Ready for dispatch presets; named personal views can be saved, restored and removed. |
| Bulk actions | Per-record eligibility, skipped rows and destination/effect are shown before confirmation. Server checks still apply during execution. |
| Reporting navigation | One Reports sidebar entry with Operational reports, Analytics and Charts tabs. Existing URLs continue to work. |
| Reporting definitions | Receipt-cohort charts retain month, division, category and desk-age filters in registry drilldowns. Empty month selection returns no records and offers Choose months. Release and completion volume use their event dates, including earlier receipts. Current backlog is explicitly all open records, regardless of receipt date. |
| Report coverage | Register, overdue, workload and related report inputs now include Special Report records through the existing workflow projection. |
| Administration | Collapsible grouping with a remembered preference. |
| Save feedback | Saving, Saved and inline failure states. Permission/configuration changes no longer announce success before a response. Confirmed state is restored after rejected optimistic configuration changes. Reference modals close only after a successful response. Failed form values remain available. |
| Validation | Required fields are identified before submission. Registration, assignment, reassignment, submission, compliance, returns and release check required input before sending a request. File links receive URL validation. |
| Unsaved changes | Edited dialogs and page navigation prompt before discarding changes. Poll refreshes avoid replacing dirty forms. Draft values survive account-menu/theme rerenders on the same page. |
| Accessibility | Strong focus outlines; labeled fields; keyboard-operable registry rows and sort buttons; dialog and print-preview focus containment/restoration; inert dialog backgrounds; larger touch targets and reduced-motion support. |
| Visual consistency | Existing teal theme retained. Routine tags and ongoing totals use neutral colors; deadline and error states retain text alongside their warning colors. |

## Files

- `public/ux.js` — UI composition, preferences, validation, save feedback and accessibility behaviors.
- `public/ux.css` — responsive workspace, drawer, document summary and accessibility styling.
- `public/client.js` — unified file links, report data corrections and confirmed configuration save behavior.
- `public/schedule.js` — leave-type modal closes after confirmed save.
- `public/index.html` and `server.js` — load and serve the UI assets.
- `README.md` — usage and browser-test instructions.
- `test/ux.ui.test.js` — UI acceptance coverage; existing browser assertions updated for inline errors and the unified file panel.

## Scope and use

Preferences and personal saved views are local to the account and browser; they do not sync across devices. Document business permissions and workflow execution remain authoritative on the server. Files & links uses the existing original/draft/revised URL fields. This change does not add file uploads, signed-file storage, OCR or Google Drive automation.

Restart the DTS Node process and refresh the browser to load the new static asset routes. Container deployments need a rebuilt image. Test mutations use fresh databases under `.test-runs`; existing application data is not used.

## Verification

Nine API/business-rule suites passed: `api`, `new-rules`, `rules4`, `routing-visibility`, `schedule`, `schedule.attack`, `phase10`, `phase11`, `workflow`.

All six browser suites passed: `ux.ui` (46 checks), `ui-fixes.ui` (21), `document.ui` (15), `schedule.ui` (80), `phase11.ui` (32), and `workflow.ui` (designer interaction assertions). Browser checks include desktop/mobile screenshots and uncaught JavaScript-error detection. Together with the nine API/business-rule suites, all 15 regression suites passed.

API evidence: `.test-runs/2026-10-15T07-06-49-356Z/results.json`.

Final browser evidence: `.test-runs/2026-10-15T07-09-29-846Z/results.json`.
