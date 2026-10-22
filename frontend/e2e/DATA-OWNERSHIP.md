# E2E data ownership (who writes what, who reads what)

All specs of one run talk to ONE seeded server and ONE SQLite database, in parallel workers, in any order. A test that passes
alone can fail in the combined run when another spec changed the data it reads (I-100 p51, I-113 p78, I-121 p32).
This file is the map; `e2e/support/check-ownership.mjs` is the guard.

## The rules

1. **One writer per record.** A spec that changes data (UI click or API call that is not answered by `page.route`) says so in
   a header line and owns those records alone:

   ```js
   // e2e-writes: martin, maureen        <- demo students / records this spec CHANGES
   // e2e-writes: none                   <- it reads only, or answers every write with page.route
   ```

   Keys are lower-case words: the demo-student key without its workflow prefix (`maureen` = `leave-of-absence-maureen`), or a
   short name for another record (`plan-mscs-2026-2`). The guard fails the run when two specs declare the same key, when a
   spec has no header, or when a spec that says `none` calls `.post(` / `.put(` / `.patch(` / `.delete(` (other than sign-in)
   on an API context.
2. **No reader asserts state a writer can change.** Counts, "No activity yet", empty lists, a card's column, a status, an
   earlier-cases list: read the API at test time and assert the page agrees, or `page.route`-mock the response, or use a
   student nobody else writes.
3. **A writer uses its own demo student** (list in `WORKFLOW_DEMO_STUDENTS`, `app.py`). Unused today: `enrollment-clarissa`
   (p79), `student-handoff-sofia`, `student-handoff-anton`, `course-adjustments-lianne`, `residency-nicolas`.
4. **Sessions are shared state too.** Never sign an account out that another spec uses. See "Sessions" below.

Run the guard alone: `node e2e/support/check-ownership.mjs` (from `frontend/`). `playwright.config.js` runs it first on every
`npm run e2e` / `node scripts/e2e.mjs test`, so a collision stops the run before the 30-90 s server start.

## Writers (spec -> what it changes)

Measured with a serial run (`--workers=1`), matching every `POST/PUT/PATCH/DELETE` in the Flask log to the test that sent it.

| Spec | Key(s) | What it writes |
|---|---|---|
| `section-j.spec.js` | joshua, miguel, paolo | resets `withdrawal-joshua`, `research-miguel` (student@usls.edu.ph), `practicum-paolo`; Joshua's subject drop; Miguel's Form 1 uploads and endorsement; Paolo's practicum request and the Dean's "Mark reviewed" |
| `p22-monitoring` | monitoring-created | adds a monitoring student of its own, adds and removes one of its subjects |
| `p23-process` | coursework-report-draft | one real "Generate report" (a Draft coursework report) |
| `p31-dean` | andrea | resets `practicum-andrea`, files and moves the practicum request, Dean decides |
| `p32-dean-pages` | maureen, daniel-fernandez, gabriel, plan-mscs-2026-2 | resets `leave-of-absence-maureen`, `-daniel`, `readmission-gabriel`; files and forwards their cases; the MSCS course-offering plan (draft, submit, Dean returns); Dean approves/denies the leave cases |
| `p33-dean-reports` | isabel-flores, dean-queue-graduation | Dean returns every seeded graduation endorsement waiting for the Dean (Hector Ong ...); walks Isabel Flores' batch through staff, coordinators and send-to-Dean; downloads the endorsed list |
| `p51-faculty` | faculty-availability | the picked faculty member's working hours and one availability exception |
| `p62-reports` | daily-changes | marks two daily-change rows "reflected" |
| `p63-faculty-pages` | gian, daniel-bernardo, rafael, marielle, elena-mendoza, faculty-expertise-test | four adviser applications (note, forward, Dean decision); Elena Mendoza's Form 1 upload and endorsement; one expertise row added, edited, deleted |
| `p64-monitoring-pages` | bea-salonga-flag | one manual flag on Bea Salonga, then resolved |
| `p72-dean-faculty-home` | martin | Martin Gonzales files a leave of absence, staff forward it to the Dean |
| `p79-dean-ux` | clarissa | Clarissa (enrollment-clarissa) files a leave of absence, staff forward it (was Martin, shared with p72: collision fixed) |
| `p90-reads` | leave-sync | one click on "Refresh leave dates" (`POST /api/leave-cases/sync`: starts leaves that begin today, flags returns due, proposes AWOL for EVERY leave case) |

Every other spec declares `none`. `POST /api/assistant`, `/api/student-portal/assistant`, `/api/enrollment/class-list-preview`
and `/api/policy-documents/test-question` are POSTs that change no rows. Specs that look like writers but answer the write
with `page.route` (p41, p42, p82 forms, p86 dialogs, p87 shared parts, p88 login/accounts, the p77 board) change nothing.

## Readers (spec -> state it reads -> how it stays order-independent)

| Spec | Reads (shared, mutable) | Written by | Made order-independent by |
|---|---|---|---|
| `p32:350` Leave card (Maureen) | the student's earlier cases and approved-leave count | p32 itself, plus any leave case or legacy log adopted into a case at someone's sign-in or by p90's sync | reads `/api/leave-cases/<id>` and asserts the page shows exactly `earlier_cases` and `approved_leave_semesters` (I-121) |
| `p32` dashboard / queue | number of decisions waiting for the Dean | p32, p33, p72, p79 | lower bound ("at least the four it filed"), rows found by name |
| `p51` My Advisees | the faculty member's advisees and adviser-request inbox | p63 (appoints advisers to Dr. Bautista, faculty 1) | advisees from `/api/faculty-portal/context`; inbox from `/api/faculty-portal/adviser-requests`: empty note if empty, otherwise every waiting student shown (collision found by the reversed run) |
| `p51` invitations / roster | pending invitations, roster size | p51 itself, p63 | `page.route` for the invitation count; roster size read from the API (I-100) |
| `p78` Practicum board / scheduling | practicum roster, "No activity yet", "Waiting for documents" | section-j, p31 | roster answer edited with `page.route`; texts read from the page's own data (I-113) |
| `p70`, `p82`, `p42`, `p80` student pages | Miguel Yu's (student@usls.edu.ph) stage, uploads, requests | section-j | expectations read from `/api/student-portal/context` or the context answer is replaced with `page.route` |
| `p72`, `p79` Dean home / queue | which cases wait for the Dean | p32, p33, p72, p79 | `page.route` fixed scenario (p79), or find the spec's own student in the API list (p72) |
| `p77` Graduation board | Isabel's batch, Hector, Bianca, Carlo | p33 | roster answer edited with `page.route` (`setBatchStatus`, `staffScenario`) |
| `p23` process boards | which cards sit in which column | p32, p72, p79, p90 | cards looked up by name, no column counts |
| `p61`, `p73`-`p76`, `p81`, `p83`-`p87`, `p89` | page structure on whatever data exists | - | read-only; expectations come from the API or the page itself |
| `sweep` | every sidebar page loads without errors | all writers | checks errors and overflow only, never data |

## Sessions (sign-in and sign-out)

- A session is a signed cookie holding the account id and a fresh `sid` per sign-in (`app.py`, `auth_login`). Signing out
  (`/api/auth/logout`) revokes only that one `sid`. The server has no rule that ends other sessions of an account, and a reset
  (`/api/auth/demo-students/<key>/reset`) keeps the account and its sessions.
- Specs that sign out for real: `p21-shell` (a fresh admin login of its own) and `p88-records-login` (signs in as the demo
  student the Login page resets, then out; pinned to `withdrawal-elena`, whom no other spec uses; the reset call itself is
  mocked). Neither can end a session another spec holds.
- The front end (`auth.jsx`) treats ANY failed `/api/auth/me` (network error, 500) as "signed out" and shows the Login page.
  That is the only way a signed-in test can find the Login form, so: sign in through the API, then wait until
  `/api/auth/me` answers with the account before opening the page (done in `p42` `formPage`). A signed-in spec must never
  `page.goto("/login")` or call logout on a shared storage-state account (`.auth/<role>.json`).
- Known cause of failed API reads in combined runs: SQLite `database is locked` (500s on `GET /api/student-portal/context`
  were in the v5.3 gate log) when several workers write. That is an app/database setting (busy timeout), not a spec problem;
  it is listed in the packet report.

## Adding a spec

1. Decide what it writes. Writes nothing: `// e2e-writes: none`. Writes: pick a demo student nobody else uses, declare it.
2. Assert nothing about seeded state another spec can change (rule 2).
3. Before merging, pass the combined run `node scripts/e2e.mjs test --project=sweep --project=section-j --project=pages`
   at default workers, with `--workers=1`, and once in reverse file order (README "Order checks").
