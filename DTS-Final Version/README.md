# Document Tracking & Routing System (multi-user)

A small web server plus a browser app. Everyone signs in with their own account; the server keeps
the documents in one SQLite database and checks every action, so what a person may do is enforced
on the server, not only hidden in the screen.

- No dependencies to install. Only **Node.js 22.13 or newer** is needed (it includes SQLite).
- All workflow rules live in `public/engine.js`; the server runs them, the browser only displays results.
- Other users' changes appear on your screen within about 15 seconds.

## Run it

    node server.js                 # http://localhost:3000

### Windows desktop launcher and LAN access

Open **`DTS.exe`**, **`DTS` on the desktop/Start menu**, or `start-dts.bat`. The launcher starts this copy of DTS on **port 3000**, listens on all IPv4 interfaces (`0.0.0.0`), and opens the current Ethernet/Wi-Fi IP address in your browser. Ethernet is preferred; both addresses appear in the launcher when available. Other devices use the displayed address, for example `http://192.168.10.143:3000`, while connected to that network.

Search for **DTS** in Start and right-click it to **Pin to Start** or **Pin to taskbar**. You can also open `DTS.exe` and pin its running taskbar icon. Keep the executable in this application folder; the shortcuts point to it. Run `scripts/install-desktop-shortcuts.ps1` again if you move the folder. Rebuild the executable with `scripts/build-desktop-launcher.ps1` after changing its source.

Closing the launcher window hides it in the system tray and leaves DTS available. **Stop server** stops the server started by this launcher; **Exit DTS** in its tray menu stops it and exits. Reopening the shortcut reuses the running launcher. An occupied port 3000 is reported rather than stopping an unrelated process. Keep the PC awake and the launcher running while other devices use DTS. IP addresses are detected each time, so the displayed address can change after a router/DHCP change.

The existing Windows Firewall rule **DTS LAN TCP 3000** allows inbound Node.js TCP port 3000 from `LocalSubnet`. If this folder is moved to a different PC, allow the installed Node.js executable on TCP 3000 from the local subnet there. Devices must have a network route to this PC; isolated guest Wi-Fi can block that connection. This launcher uses direct HTTP; the HTTPS deployment instructions below remain applicable to sensitive production access.

First run creates `data/dts.sqlite` and **`data/initial-credentials.txt`** with a random temporary
password for every person in your workflow document (administrator username: `admin`). Each person
must set their own password at first sign-in. Hand the details out, then delete that file.

Try it with sample documents and simple passwords (never for real use):

    SEED_DEMO=1 DATA_DIR=./demo-data node server.js     # passwords: Track@2026 (admin: Admin@2026)

## Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` / `HOST` | 3000 / 0.0.0.0 | Where to listen. Use `HOST=127.0.0.1` behind a proxy. |
| `DATA_DIR` | `./data` | Database, daily backups, credentials file. |
| `TZ` | `Asia/Manila` | Working-day counts and deadlines use this time zone. |
| `TRUST_PROXY=1` | off | Read the client address and HTTPS status from the reverse proxy. |
| `COOKIE_SECURE=1` | off | Mark the session cookie Secure (always set this with HTTPS). |
| `SEED_DEMO=1` | off | First run only: add sample documents and simple passwords. |

## Startup screen

Opening the page shows the POSSD splash ("System is loading...") straight away. It leaves, with a short fade, as soon
as the server has answered the first request (it fades in and out over about one second each): signed in goes to the dashboard, signed out goes to the sign-in page.
There is no fixed delay. If the server cannot be reached, answers with an error, or does not answer within 15 seconds,
the splash shows "Unable to start the application." with a **Retry** button (no technical details are shown; the browser
console keeps them). It uses no internet resources. The Windows launcher waits for `/healthz` and the DTS page before opening the browser.

## Put it on a server (HTTPS is required for real use)

Passwords travel from the browser to the server, so serve it over HTTPS.

1. Copy this folder to the server (for example `/opt/dts`) and install Node 22.13+.
2. Put an HTTPS reverse proxy in front. With Caddy, `Caddyfile.example` is all you need
   (certificates are automatic). nginx or IIS work too.
3. Run it as a service: `dts.service` is a ready systemd unit. Or use `docker compose up -d`.
4. Open the address, sign in as `admin` with the temporary password, set your own.

The Docker image creates `/data` with ownership for its non-root `node` user. The supplied
Compose file mounts the host's `./data` over that directory. On Linux, ensure that directory,
its existing database files (including SQLite WAL/SHM files), and backups are writable by the
container's `node` user. Image ownership does not change permissions on an existing host bind
mount. Check the deployed host's permissions before starting Compose.

## Backups

- The server copies the database to `DATA_DIR/backups/` daily and keeps 14 days.
- Settings & data (administrator) can export or restore a full JSON backup.
- Restore validates the backup before replacing data and saves a recovery copy under
  `DATA_DIR/backups/restore/`. Invalid backups leave the current data intact.
- Also copy `DATA_DIR` off the machine regularly.

## Regression checks and generated files

For an interactive 6,000-document stress test using the current enrolled staff, double-click
`start-dts-stress-test.bat`. It uses an isolated database on port 3500, opens DTS automatically,
measures concurrent API/browser performance and saves a report. See [STRESS-TEST.md](STRESS-TEST.md)
for credentials, coverage, results and larger workloads.

Run `npm test` for the API and business-rule suites. Each suite starts its own server and disposable
database under `.test-runs/`; it does not use the existing `data/` database. Browser suites can be
selected with `node test/run-regression.js reporting.ui audit-corrections.ui` when Playwright and a
supported browser are available in the development environment.

After tests finish, `.test-runs/` can be deleted. It contains generated databases, logs and screenshots
and is recreated on the next run. Keep `test/` for regression coverage, and retain `data/`, `public/`,
the server and deployment files. Recovery copies under `data/backups/` contain application data.

## Who is who (set up from your workflow)

- CMED: focal Aubrey Camille C. Cabrera, manager Myles Rovi P. Martinez
- CMSD: focal Mary Flor F. Aquino, manager Judy F. Villarete
- Admin: focal Judy Ann T. Pacaanas
- Department: focal Oscar B. Hanova Jr.
- Anyone named as a division's focal gets the focal abilities (assign, review, see the division), whatever their role.
- The Admin and Department divisions have no Division Manager, so any Division Manager may do the division review for them.
- Change all of this later under Users and Divisions & focals.

## Deadlines (set them in Reference list)

Every deadline comes from the Document Type, so nothing is hard-coded in the app. Under
**Reference list → Document Types** the administrator sets, per document type:

- **Prescribed threshold** - how many working days (or calendar days) are allowed.
- **Unit / basis** - `working days`, `calendar days`, or `nth working day of the month after the
  reporting period` (used by Consolidated CMR and PPR).
- **Active / inactive** - an inactive type stays valid on old records but cannot be chosen for new ones.

One function in `public/engine.js` (`computeDeadline`) works out every deadline for the whole system:
logging, editing, the live form preview and the displayed status. Working-day counts skip Saturdays,
Sundays and the holidays listed under Reference list → Holidays.

**Consolidated CMR and PPR** uses **Reporting period** (the month the report covers) instead of a
division. The deadline is the **6th working day of the month right after** the reporting period.
Type `Sep`, `september` or `9` and it settles on `September`; anything else is refused, and the
deadline cannot be typed over by hand.

## Special Reports (mandatory recurring reports, created by the system)

**Reference lists → Special Reports** (needs the configuration permission). Users never log these by hand:
the server creates each report when it falls due, gives it a deadline and assigns it.

- **Schedules** tab: name, frequency (Monthly / Quarterly / Specific months / Annual), the exact reporting
  months, generation day in the following month, deadline threshold, deadline basis (working days of the month after the reporting month),
  who is responsible, active or inactive. Nothing is hard-coded; edit any of it without touching code.
- Starting schedules: Summary of CMR (monthly, 25), Summary of PPR (monthly, 20), List of Terminated
  (March, June, September, December; 17), PPA to COA (January, March, June, September, December; 17),
  CMR and PPR Tracking (monthly, 15).
  **They start inactive with nobody assigned.** Assign the responsible people and activate each one.
- **Generation:** on the configured day of the month after the reporting month (default 1; a day beyond that month's
  length uses its last day), e.g. "Summary of CMR as of January 2026" appears in February 2026. The server checks on start-up and every 15 minutes, so a missed generation date is made up
  on the next check (up to 24 months back, never before the schedule's first period). Repeats never duplicate:
  the database allows one report per schedule + year + month and one assignment per person per report.
- **Deadline:** the n-th working day counted from the 1st of the month after the reporting month, using the same
  working-day rules and holiday list as every other deadline. If n is larger than the month has working days
  (25 in February 2026, which has 20), the count carries on into the next month. Add each year's holidays
  under Reference list → Holidays; a warning shows when the current or next year has none.
- **Review workflow:** the assigned staff member submits the report to a Supervisor, then it moves through Division Manager and Department Manager review, clearance, and log out. Reviewers can return it for compliance; remarks are kept in its movement history.
- **For My Action / Dashboard:** assigned people and the current reviewer see the report in For My Action (and in its count). Generated
  reports appear in the existing dashboard registry with a Special Report badge. Logging one out removes it from the action list; the record stays.
- **Reassign** a pending report from the Generated reports tab; the report is the same, the old assignment is
  kept as history. Changing a schedule affects only reports generated afterwards. The Regular reports page has
  Consolidated CMR and PPR and Special Report tabs; analytics and graphs include generated reports by generation date.
  Special Reports do not create Drive links or Personnel Schedule events.
- Included in the JSON backup/restore and in the Audit log. The System Administrator account has no For My Action
  list, so it cannot be assigned a report.

## Personnel Schedule (inspections, leave and meetings)

A calendar (Month / Week / Day / Agenda) showing who is on inspection, on leave or in a meeting.
Everyone signed in can view it; adding, editing and deleting needs the **Add, edit and delete
inspections, leave and meetings** permission (System Administrator has it; grant it to other roles
under Roles & permissions).

- People are the existing user accounts; there is no second personnel list. One inspection or
  meeting is one record with several people assigned.
- Leave types are configured under **Reference lists → Leave types** (needs the configuration permission).
- Overlaps (same person, overlapping dates and times; leave counts as the whole day) show a warning.
  An authorised user can review it and choose **Save anyway**. Nothing is blocked silently.
- Schedules are included in the JSON backup and restore. Changes appear in the Audit log.
- Projects: the application has no project records yet, so an inspection's project is typed in
  (suggestions come from projects already used on earlier inspections).

## Security notes

- Passwords: scrypt with a random salt. Sessions: random token in an HttpOnly, SameSite=Strict cookie; the server
  stores only its hash. Idle timeout is set in Settings (default 30 minutes).
- Five wrong passwords lock that username and address out for 15 minutes.
- Requests must carry a custom header (CSRF), and the page uses a strict Content-Security-Policy.
- Deactivating a user or resetting their password ends their sessions at once.
- Everything is audited (Audit log page).

## Limits

- One server process holds the data in memory and writes to SQLite. That comfortably suits an office,
  but do not run several copies against the same database.
- No email, so password resets are done by the administrator.

## Division reporting and navigation

The sidebar groups Regular Reports under **CMED**, alongside **List of Documents** and one
combined **Turnaround Time & On-Time Rate** report. **CMSD** contains **List of Documents** and the same combined
performance report. Personnel Schedule
retains its existing page. **Insights** groups Analytics and Charts. Operational Reports
has been removed; the legacy `#/reports` URL opens Analytics. The legacy `#/regular` URL
still opens CMED Regular Reports.

Division pages request `/api/state?reportDivision=CMED` or `CMSD`. The server applies the
existing document access check and resolves reporting ownership from the assigned person's
current division. For a Special Report, the workflow's responsible person takes precedence;
otherwise all active/completed responsible assignments must resolve to one division. A report
with several people in that same division counts once. Mixed or unidentified divisions are
excluded. An unassigned record can use its recorded division. This read-only scope does not
change stored document divisions, assignments, workflows, schedules, or database schemas.
Reassigning a report or changing its responsible person's division changes its reporting scope.

Regular Reports keeps its region/team visibility rules, Special Report details and actions.
Staff, supervisors, focals, and division managers can open only their assigned division
(including their configured division-focal relationship). Admin staff, System Administrators,
and Department Managers can open both. The shared `canAccessDivision` rule guards sidebar
entries, direct routes, and scoped server requests. A user without an identifiable division
cannot open either division unless their role grants access to both.

Both division document lists reuse the Department overview registry's search, filters, all eight
available columns, sorting, pagination, selection, saved views, preview/details, workflow
actions, print, and full CSV export. Their filters, columns, page size, and selections are
independent of each other and Department overview. Clearing filters cannot unlock a list's
server-scoped division source. List of Documents is the default tab when opening CMED or CMSD;
the explicit CMED list URL is `#/cmed/documents`. The old `turnaround` and `ontime` division
URLs still open the combined report.
The metric tab still requires `report.view`; print/CSV still require `report.print`.
The default state endpoint, department-wide Analytics/Charts, their calculations and existing
division/month filters are unchanged. Their filters and actions now share one report toolbar.
After updating server.js, restart DTS before using the division pages. They fail closed when
an older server does not acknowledge the requested scope.

Run the focused end-to-end checks with `node test/run-regression.js reporting.ui` (Playwright
and Edge on Windows). This suite restores controlled fixtures only into an isolated `.test-runs`
database and verifies server scoping, known metric results, permissions, legacy navigation,
workflow details, print, CSV downloads, and desktop/tablet/mobile layouts.

## Tests

    SEED_DEMO=1 DATA_DIR=/tmp/t PORT=3111 node server.js &   # then, each suite in turn:
    PORT=3111 node test/api.test.js
    PORT=3111 node test/new-rules.test.js
    PORT=3111 node test/rules4.test.js
    PORT=3111 node test/routing-visibility.test.js
    PORT=3111 node test/schedule.test.js
    PORT=3111 node test/schedule.attack.test.js        # tries to break the schedule API
    # Special Reports need a server whose clock the tests may set (SR_TEST is for testing only):
    SEED_DEMO=1 SR_TEST=1 SR_NOW=2026-01-15 DATA_DIR=/tmp/t PORT=3111 node server.js &
    PORT=3111 node test/phase11.test.js
    PORT=3111 node test/phase11.ui.test.js             # browser check (Playwright)
    # the two browser suites need Playwright + Chromium (npm i playwright):
    node test/schedule.ui.test.js
    node test/schedule.attack.ui.test.js

The focused settings, communication-type and original-document-link browser checks can be run
with a fresh isolated database through `node test/run-regression.js ui-fixes.ui`. This suite needs
Playwright and a browser; on Windows the runner uses Microsoft Edge. If Playwright is installed
outside this folder, set `NODE_PATH` to the directory containing its package.

Run them against a fresh `DATA_DIR` each time: the suites change reference lists and documents, so
re-running them on the same database can fail on leftover state rather than on real problems.

## Workspace and document UI

- Staff open **My work** on a fresh sign-in; administrators and managers open **Department overview**.
  Direct document links and bookmarked pages still open their requested destination.
- Registry filters, sort order, visible columns and page size are remembered for each account on
  the same browser. Use **Saved view** for the preset queues, or **Save current view** for personal
  combinations. **Manage saved views** removes personal views. Preferences do not sync between devices.
- Enable **Preview in drawer** to inspect and act on a document while keeping the registry in place.
  **Open full document** opens the full page. Previous/next follows the queue from which it was opened.
- Document pages put status, responsible desk, deadline, desk age and next action first, followed by
  the current action. Other actions are grouped below it. **Files & links** groups original, draft
  and revised links; movement history remains further down the page.
- **Insights** contains Analytics and Charts. Receipt-cohort charts retain the
  selected months, division and clicked band when opening the registry. Release counts use release
  dates, including documents received earlier. Current backlog includes all receipt dates.
- Every sidebar page uses the available screen width with consistent compact spacing. Calendar
  summaries span the calendar, and wide tables scroll inside their own containers on small screens.
- Special Report assignment and reassignment offer personnel search with autocomplete suggestions.
  Each entry displays **Name - Role - Division** on one line. Search accepts names, roles and divisions;
  checked people remain selected when filtered out. On narrow screens the personnel list scrolls sideways.
- Reference lists use header **Add** buttons and dialogs consistently across transactions, document
  types, communication types, leave types, holidays and report designations. Holidays and report
  designations expand with their rows. Click any Special Report schedule row, or use Enter/Space,
  to edit it; its Edit and Activate/Deactivate buttons retain their separate actions.
- Saves show pending, success or inline failure feedback. Failed forms retain entered values for
  correction or retry. Leaving an edited form prompts before discarding changes. Dialogs keep keyboard
  focus inside and restore focus when closed.

Run `node test/run-regression.js ux.ui ui-fixes.ui document.ui schedule.ui phase11.ui workflow.ui`
for browser acceptance coverage, using the Playwright `NODE_PATH` setup described above.

System Admin Settings includes **Cursor particle trail**, enabled by default. Save settings to
turn the decorative effect on or off system-wide for signed-in users. Each browser respects its
reduced-motion preference and fine-pointer capability, including preference changes while open.
The native cursor stays visible; the 48-particle pool never intercepts clicks. Animation stops
after two idle seconds and is cleared while the tab is hidden. Other users receive the saved
setting through the existing live refresh (when they have no unsaved form or open dialog).
Restart the server after updating to register the new static assets and saved setting, then
hard-refresh the browser. A self-contained preview is available at
`outputs/white-particle-cursor.html`; rebuild it with `node scripts/build-cursor-preview.js`.
