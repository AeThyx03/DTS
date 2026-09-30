# Document Tracking & Routing System (multi-user)

A small web server plus a browser app. Everyone signs in with their own account; the server keeps
the documents in one SQLite database and checks every action, so what a person may do is enforced
on the server, not only hidden in the screen.

- No dependencies to install. Only **Node.js 22.13 or newer** is needed (it includes SQLite).
- All workflow rules live in `public/engine.js`; the server runs them, the browser only displays results.
- Other users' changes appear on your screen within about 15 seconds.

## Run it

    node server.js                 # http://localhost:3000

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
console keeps them). It uses no internet resources. `start-dts.bat` is unchanged: it still waits for `/healthz`, then opens the page.

## Put it on a server (HTTPS is required for real use)

Passwords travel from the browser to the server, so serve it over HTTPS.

1. Copy this folder to the server (for example `/opt/dts`) and install Node 22.13+.
2. Put an HTTPS reverse proxy in front. With Caddy, `Caddyfile.example` is all you need
   (certificates are automatic). nginx or IIS work too.
3. Run it as a service: `dts.service` is a ready systemd unit. Or use `docker compose up -d`.
4. Open the address, sign in as `admin` with the temporary password, set your own.

## Backups

- The server copies the database to `DATA_DIR/backups/` daily and keeps 14 days.
- Settings & data (administrator) can export or restore a full JSON backup.
- Also copy `DATA_DIR` off the machine regularly.

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
  months, deadline threshold, deadline basis (working days of the month after the reporting month),
  who is responsible, active or inactive. Nothing is hard-coded; edit any of it without touching code.
- Starting schedules: Summary of CMR (monthly, 25), Summary of PPR (monthly, 20), List of Terminated
  (March, June, September, December; 17), PPA to COA (January, March, June, September, December; 17),
  CMR and PPR Tracking (monthly, 15).
  **They start inactive with nobody assigned.** Assign the responsible people and activate each one.
- **Generation:** on the 1st of the month after the reporting month, e.g. "Summary of CMR as of January 2026"
  appears in February 2026. The server checks on start-up and every 15 minutes, so a missed 1st is made up
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

Run them against a fresh `DATA_DIR` each time: the suites change reference lists and documents, so
re-running them on the same database can fail on leftover state rather than on real problems.
