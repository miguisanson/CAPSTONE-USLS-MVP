# State

## ACTIVE RUN UPDATE (2026-10-26) — two-way Google Calendar follow-up

- **Branch/worktree:** `pkt/google-calendar-two-way` in `C:/Users/mendo/AppData/Local/Temp/CAPSTONE-USLS-MVP-wt-google-calendar-two-way`, based on `v5.3-migui_test` at `15d6d7f`.
- **Owner request:** keep Google personal events private but use their busy periods during defense scheduling; create/update/delete system-owned defense events on each connected faculty member's primary Google Calendar; put all Google Calendar connection controls only on faculty **My Calendar**, not **My Availability**.
- **Contract:** retain `calendar.freebusy` for conflict checks and add only `calendar.events.owned` for events the system creates on the user's owned primary calendar. Never list or import personal event details. Tag and store every system-created event ID so reschedules/cancellations cannot alter unrelated events.
- **Red evidence:** five targeted backend tests failed for the intended missing scope/helpers and the faculty Playwright walkthrough failed because the connection card was still on My Availability.
- **Implementation in progress:** `ScheduleRequest` now stores only the event IDs created by this system; booking/rescheduling/re-confirming/cancelling invokes best-effort create/update/delete lifecycle hooks; the OAuth scope adds `calendar.events.owned`; manual sync retries future defense events; disconnect removes stored system-owned events before credentials are revoked; and the connection card now renders only on faculty My Calendar.
- **Verification so far:** targeted backend **13/13 PASS**; p96 faculty Playwright checks **8/8 PASS** (the harness later needed Ctrl+C after its completed output because Windows teardown did not exit); production frontend build PASS; strict UI check PASS with every metric zero; 1366/1920/390 screenshots opened and reviewed with no overflow or layout defect. A fresh deterministic demo seed also completed with fingerprint `a1bb81bd4344de5416e397c9536f4cdb945c554b075678d30705165bdbf269aa`.
- **Repository note:** the main checkout branch label changed to `v6.0-natalie`, but it and `v5.3-migui_test` still point to the exact same base commit `15d6d7f`; no newer code diverges from this packet.
- **Full-gate correction:** the first repository-wide run stayed green through the new Google tests, then exposed one obsolete assertion in `ExistingDataTests` that still required the superseded read-only consent copy. The owner explicitly requested two-way event writes, so that test was renamed/replaced with the new narrow two-way permission contract and passed targeted. The interrupted run is not counted as a gate result.
- **Full repository gate:** PASS on 2026-10-27: **684 tests in 9304.119s, OK (1 skipped)**.
- **Exact next action:** commit this verified packet, merge it into the active `v6.0-natalie` branch, rebuild the disposable demo database, and rerun post-merge checks.

## ACTIVE RUN UPDATE (2026-10-26) — Google Calendar implementation merged

- **Branch:** `v5.3-migui_test` at merge commit `cf2ce7d`; reviewed packet `pkt/google-calendar-v53` is merged. The owner completed the Google Cloud console setup and gave the implementation go-ahead.
- **Scope complete in packet:** each faculty member owns their link/reconnect/sync/unlink lifecycle; OAuth requests only OpenID identity, e-mail, and `calendar.freebusy`; callback tokens are Fernet-encrypted; Google identity cannot be reused by another faculty profile; account changes cannot inherit the previous account's refresh token; connect/sync/disconnect are audited; the legacy shared token path is removed; and Google busy periods only subtract from faculty-entered hours and date exceptions.
- **Integrator review corrections:** the default redirect URI now exactly matches the owner's registered URI (`http://localhost:5000/api/integrations/google-calendar/callback`, with the old route retained as a compatibility alias); the scope matches the Google Auth Platform configuration (`calendar.freebusy`); the callback rejects an identity whose e-mail Google did not verify; and the calendar count helper can no longer be called without a faculty availability record.
- **Test-first evidence:** the backend contract was checked on the test-only commit and failed for the intended five reasons, then the reviewed implementation passed all eight targeted Google Calendar tests. A new mobile-order Playwright assertion failed with the Calendar card at y=2627 below Weekly hours at y=328; the responsive layout was corrected and the same walkthrough then passed.
- **Merged verification:** targeted backend **8/8 PASS**; `p96-google-calendar.spec.js` plus all seven role sign-ins **8/8 PASS**; production frontend build PASS; `check:ui:strict` PASS with every metric zero. Screenshots at 1366, 1920, and 390 px were opened and reviewed with no overflow or layout defect. No real Google credentials were read or written.
- **In progress:** the full repository Python gate is running on `cf2ce7d` with external AI keys disabled. After it finishes, record the result, commit this handoff update, and remove the packet worktree.

## ACTIVE RUN (2026-10-24) — Google Calendar integration adjustment

- **Branch:** `v5.3-migui_test` at `02ff818`; owner resumed work and asked for the Google Calendar integration to be completed against v5.3.
- **Scope:** faculty-owned link/reconnect/unlink from the Faculty Portal; minimum free/busy OAuth permission; encrypted stored tokens; connection/sync status and internal audit entries; Defense Scheduling must intersect entered working hours and manual exceptions with Google busy periods (Google never invents working hours or exposes event details).
- **Finding:** v5.3 already has a partial OAuth/free-busy path, but it requests `calendar.readonly`, stores callback tokens as plaintext, has no unlink endpoint/UI, records no calendar audit event or last successful sync, retains a legacy shared-token path, and can assume 08:00–18:00 when a connected faculty member entered no working hours. Filed as I-132; regression contract R-015.
- **Execution:** main session writes and proves the failing tests first. Implementation then goes to one Sonnet packet in its own worktree because `app.py` is touched. No other `app.py` packet may run concurrently.
- **Red contract landed in packet worktree:** five targeted backend checks fail for the intended reasons (invented 08:00-18:00 availability, hidden entered hours, broad `calendar.readonly`, selected real Google identity not stored/encrypted/audited, and missing sync/disconnect routes). `frontend/e2e/p96-google-calendar.spec.js` also reaches the faculty screen and fails because v5.3 has no last-checked status or sync/disconnect controls. Playwright Chromium was installed; its first attempted run was infrastructure-red before installation, then the feature-red run reached the assertion.
- **Exact next action:** commit the red tests and hand the fixed contract to the Sonnet implementer in this worktree; then main reviews, reruns the targeted tests, checks screenshots at 1366/1920/390, and runs the required gates.

## PAUSED BY THE OWNER (2026-10-22 night) — read this first

Owner: "put a pause on things and wrap up". All helpers were stopped. `v5.3-migui_test` is pushed; last full Python
gate 680 OK (after pkt/be4), every later merge checked with targeted e2e + strict design check (all zeros).

Finished but NOT merged (each on its own branch + worktree in `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/<name>`;
review per AGENTS.md, merge one at a time, gate after each):
1. `pkt/rep` (5 commits) - Reports rebuild IM20: five real reports (at-risk, cohorts, overdue, defenses, graduation)
   with xlsx/pdf export + a short Analytics tab (I-068, I-014-class). Its full Python gate was still running when
   stopped - re-run the gate and `p93-reports.spec.js` + p62 + p33 before merging. Only app.py editor.
2. `pkt/conE` (4 commits) - AD9 (staff locked on Dean Review withdrawals, test first), consistency findings 11/15,
   I-129 coordinator home (own-process waiting items, concept papers open Research Gate). Its combined e2e re-run
   was cut off - re-run p95 + the combined run before merging.
3. `pkt/iso` (2 commits) - e2e data-ownership map + guard + collisions fixed (I-100/I-113/I-121 class); run A of
   three passed, reversed/1-worker runs not done.
4. `pkt/a11y2` (0 commits; WIP stashed in wt/a11y2: `git -C ../CAPSTONE-USLS-MVP-wt/a11y2 stash list`) - I-120
   a11y follow-ups barely started; redo from the brief in this file's history if the stash is unclear.
Then remaining: consistency packet B (list toolbars / Activity Log I-124/I-125, after pkt/rep), I-120 rest
(faculty signatures nested buttons), I-119 server strings, I-105, I-107, I-114/I-115, Phase 4 app.py split, Phase 6.
Junction rule: `cmd //c rmdir <wt>rontend
ode_modules` BEFORE `git worktree remove`. Locked leftover folders in
the -wt directory (already deregistered) can be deleted after a reboot.

## CURRENT RUN (2026-10-22, v5.3) — read this first

- **Branch:** `v5.3-migui_test` (from `v5.2-migui_again` @ c426b6f, pushed). Owner decisions IM25-IM27 (4 helpers, agent decides everything, bolder improvements allowed).
- **In flight (worktrees in `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/`; each `frontend/node_modules` is a JUNCTION to the main checkout — before `git worktree remove`, run `cmd //c rmdir <wt>rontend
ode_modules` so the main node_modules is not deleted):**
  - MERGED `pkt/be` (I-010, I-012, I-005, I-002; R-011).
  - MERGED `pkt/be2` (I-055..I-058, I-036, I-073; R-012).
  - MERGED `pkt/seed2` (I-060, I-061, I-062, I-070, I-095; R-013; AD8 for I-094). Gate on e7be427: python **661 OK**; e2e 388/389 + 1 skipped (p84 row-height bound fixed after).
  - `be4` / `pkt/be4` — the only app.py editor: I-059 notifications on decisions, I-071/I-072 GETs and login stop writing, I-066 coordinator home API, I-093 N+1 /api/students, I-047 daily changes student_id (port 5322).
  - MERGED `pkt/shell` (I-103, I-101, I-112); RoleSidebar.jsx deleted (unused).
  - MERGED `pkt/enr` (P6.7/P6.8, I-082, I-081 part). Folder wt/enr locked by a helper process; delete later.
  - MERGED `pkt/lists` (I-075, I-083, I-098, I-104, I-109). I-116 filed.
  - MERGED `pkt/p66` (P6.6, I-116). I-119 for the server strings.
  - `p8` / `pkt/p8` — Phase 5 P8 close-out: last check:ui hits, shims removed, `--strict` in npm run e2e, ModalShell out (I-118) (port 5326).
  - Gate on 176b0cf: python **652 OK**; e2e 315/318 (3 p78 order failures, fixed by pkt/bpol). LESSON: run the full pages project after every merge that changes a nav or label (p21 was red after pkt/be2 until pkt/shell).
  - MERGED `pkt/bpol` (I-110, I-108, I-106, I-111, I-113).
  - MERGED `pkt/p65` (P6.5, I-069, I-081 part). I-115 filed.
  - MERGED `pkt/p24` (P2.4). New: I-117, I-118.
  - MERGED `pkt/ca` (I-117). I-121 filed (p32 order dependence).
  - `iso` / `pkt/iso` — class fix for e2e order dependence (I-100/I-113/I-121): DATA-OWNERSHIP.md, collisions fixed, ownership guard, three run orders (port 5327).
  - Read-only consistency sweep (IM24) on 726c3c8 -> `E:/Temp/claude/review53/CONSISTENCY-2026-10-22.md` (port 5331).
  - MERGED `pkt/a11y` (p89 axe check, contrast tokens, table scroll regions). Follow-up I-120.
  - NEXT: P8 close-out after p66 merges (StudentPicker, graduationShared, MonitoringGrid allow-list I-097, ui.jsx/forms.jsx shims, print.js AD3, --strict); Reports rebuild IM20 (app.py after be4); coordinator home frontend (after be4's API); ModalShell adapter out of ProcessBoardPage (I-118). NEXT after a slot frees: P6.6 StudentDetail/Assistant/ChangePassword/Login; then P8 close-out; Reports rebuild IM20 (needs app.py after seed2).
  - MERGED `pkt/stu` (P4.3/P4.4, I-087, I-086, error summaries).
  - MERGED `pkt/leave` (P5.3-P5.5).
  - MERGED `pkt/vocab` (I-076..I-078, I-080). Folder `wt/vocab` is deregistered but a locked file kept it on disk - delete it after a reboot. Follow-up I-112.
  - MERGED `pkt/fac` (P5.1+P5.2 faculty pages). e2e after it -> `E:/Temp/claude/gate53/e2e_after_fac.txt`.
  - MERGED `pkt/board` (I-067, I-088). Follow-up: Practicum `w-[300px]` and Graduation `w-[380px]` column overrides (workflow packet).
  - `vocab` / `pkt/vocab` — one name table `lib/labels.js`, breadcrumb rule Portal > Page (I-077, I-078), rules collapsed (I-076), Activity Log open (I-080) (spec `e2e/p76-vocabulary.spec.js`, port 5306).
  - Full Python gate on 00eda43 (after wf, be, fac, mon merges + source-test path fix): **643 tests OK** (38 min). Worktree `wt/gate` is kept for the next gate run (`git -C ../CAPSTONE-USLS-MVP-wt/gate checkout --detach <sha>`).
  - Fixed on the branch: I-096 e2e harness now keyless (the main checkout's .env key broke p80).
  - MERGED `pkt/mon` (P6.4 Monitoring Sheet / class list / adviser record).
  - MERGED `pkt/fac2` (I-079, I-090, I-085, I-099, I-100). Its worktree `wt/fac2` may still have a helper process; remove it later (rmdir junction first).
  - MERGED `pkt/wf` (P7.1-P7.4 move-only split of WorkflowPage.jsx into `pages/workflow/`); e2e after it -> `E:/Temp/claude/gate53/e2e_after_wf.txt`.
  - MERGED `pkt/wf2` (P7.5 restyle of six workflow files, dead code out).
  - MERGED `pkt/grad` (I-065, I-051). New: I-105 (batch 'Next: Dean' wrong), I-106, I-107.
  - MERGED `pkt/wf4` (I-063, I-089, I-102).
  - MERGED `pkt/dean` (I-074, I-084, I-106 part). Follow-up I-111.
  - After `pkt/vocab` merges (it owns Layout.jsx): sidebar nav clipped by the footer (I-103, P2) + course-audit nav entry (I-101).
  - Fable review DONE -> `.planning/research/FULL-REVIEW-2026-10-22.md`; findings F-01..F-41 filed as I-055..I-095 (I-0xx = F-xx + 54). Worktree `review` can be removed (rmdir junction first).
- **Wave plan from the review (backend lane is serial, one app.py packet at a time):**
  - be3 seed data: I-060 (F-06 advisers <=5, adviser never on panel), I-061 (F-07 stage vs units, titles, departments), I-062 (F-08 one case in every Dean queue), I-070 (F-16 dates spread over past weeks, R-001 stays green), I-094 (F-40), I-095 (F-41).
  - be4: I-059 (F-05 notify student on decisions), I-071/I-072 (F-17/F-18 GETs and login write), I-066 (F-12 coordinator home API), I-093 (F-39 N+1).
  - be5 + frontend: I-064 (F-10 rosters on Research Gate/Panel Matching/Defense Scheduling), I-068 (F-14 IM20 five real reports), I-074 (F-20).
  - frontend lanes: wf3 Graduation onto StageBoard + table (I-065/I-051) and Practicum/DefenseScheduling/Availability restyle (I-063, I-089); StageBoard columns at 1366 (I-067) + empty states (I-088); vocabulary/breadcrumbs (I-077, I-078, I-076); faculty advisees/verdicts (I-079, I-090, after pkt/fac); jargon (I-081, I-082, I-069); small UI (I-075, I-080, I-083..I-087, I-091); a11y sweep (I-092) + axe-core check from UX research.
- UX research saved: `.planning/research/UX-RESEARCH-2026-10-22.md` (top 15 checks at the end).
- **Baseline gate** on v5.3 start: running -> `E:/Temp/claude/gate53/baseline.txt`.
- **Next:** review + merge each packet one at a time (gate after each), file the Fable findings into ISSUES.md and plan the next waves from them.


## HANDOVER FOR THE NEXT SESSION / ACCOUNT (kept current; read this first)

Session closed by the owner on 2026-10-17 evening (their usage limit resets Thursday, not today). The next session starts with
`/continue_CAPSTONE-USLS-MVP` and continues from here. Never ask the owner for decisions during unattended runs
(IM18): take the recommended option and log it as an `AD#` row in `DECISIONS.md`.

1. `git switch v5.2-migui_again && git pull`. `git worktree list`: any `pkt/*` branch with commits ahead of
   `v5.2-migui_again` is finished helper work - review it (AGENTS.md reviewer rules), merge one at a time, re-run
   the gate. A worktree with uncommitted changes is half-done work - read its diff and finish or discard it.
   Helper worktrees live in `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/<name>`.
2. Gates: Python `.venv/Scripts/python.exe -m unittest discover -s tests -p "test_*.py"` (~28 min, run in the
   background); frontend `npm run e2e` (~6 min; the only known failure is I-036, academic-coordinator 403) and
   `npm run e2e:negative` (must FAIL). When helpers run e2e at the same time, give each its own
   `E2E_PORT=<51xx>` and `USLS_E2E_TMP=E:\Temp\claude\e2e-<name>`. `cd frontend && npm run check:ui` must
   never rise (`--update` after a packet lowers it; resolve baseline merge conflicts by taking either side and
   running `--update`).
3. Order of the remaining work (ROADMAP.md): (a) finish Phase 5 page migrations - the remaining rows of
   `.planning/phases/05-design-system/05-UI-SPEC.md` section 8 (each packet pins behaviour first with
   `frontend/e2e/p<NN>-<name>.spec.js`, which the `pages` Playwright project picks up without a config edit),
   then P8 close-out (`check:ui --strict` = all zeros; allow-list `lib/print.js`, AD3); (b) Phase 3 backend
   section J bugs I-002, I-003, I-005, I-006, I-007, I-009..I-013 plus I-036 and I-043 - **only one packet at a
   time may edit app.py**; (c) Phase 4 split of app.py (order in `codebase/ARCHITECTURE.md`); (d) Phase 6.
4. Max 3 Sonnet implementer subagents at once (IM10). Copy the brief style of earlier packets (git log of
   merged `pkt/*` branches shows what each did).
5. After every merge: update this file's Current Position, `BOARD.md`, `ISSUES.md`, `REGRESSION.md`; commit and
   push `v5.2-migui_again`. Never merge into `v5.1-migui_clean` (owner only).
6. The hourly watchdog task "Keep CAPSTONE improvement mode running" is DISABLED (owner starts sessions by
   hand with `/continue_CAPSTONE-USLS-MVP`). Do not re-enable it unless the owner asks.
7. **Consistency sweep every session (IM24, owner's top concern):** `.planning/IMPROVE.md` bug hunt method 0.
   Compare same-kind pages (boards, role homes, forms, lists, detail pages, dialogs, reports) feature by
   feature; file unexplained differences as `consistency:` rows. Worked example: I-049 (AWOL cards).

## Current Position (2026-10-17 — improvement mode set up)

- **Branch:** `v5.2-migui_again` (new, from `v5.1-migui_clean` at e6460e0; not pushed).
- **Milestone:** v5.2 Improvement mode. Owner decisions IM1–IM15 in `DECISIONS.md`
  (grill-me 2026-10-17). Plan: `ROADMAP.md` (6 phases). Owner's tracker: `BOARD.md`.
- **Done this session:** GSD onboarded (PROJECT, ROADMAP, `codebase/` map by two Sonnet
  mapper agents), reference-portal + team-database research (`research/`), improvement mode
  ported from DD-Project-GameMaker / shelf-and-sword (IMPROVE, ISSUES, REGRESSION, IDEAS,
  BOARD, `/continue_CAPSTONE-USLS-MVP`), AGENTS.md / CLAUDE.md / `/continue_` updated.
- **Counters:** open P1 issues 5 (I-001, I-002, I-005, I-010, I-012 — unconfirmed repros,
  copied from section J) + I-015 confirmed. Regressions since last stable: 0.
- **In flight (Phase 1, 2026-10-17 ~06:10):** red tests written, uncommitted in the main checkout: `tests/test_seed_determinism.py` (R-001), `tests/test_sqlite_only.py`, tool `scripts/db_fingerprint.py`. Sonnet packets: `pkt/archive` in `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/archive` (move unused files to archive/, delete certain-dead frontend code; no app.py) and `pkt/sqlite-only` in `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/sqlite-only` (remove MySQL + startup ALTER patching, refuse outdated DB with a reseed hint). After both merge: packet C `pkt/seed` = make R-001 green (identical seed, start changes nothing).
- **FIRST THING NEXT SESSION (session closed cleanly 2026-10-17 ~20:00):** nothing is in flight - no worktrees, no helper branches, all work merged on `v5.2-migui_again` and pushed. Merged this evening: `pkt/assistant` (grounded Gemini assistant), `pkt/assistant-tune` (complete answers, 429 retry, strength bar 0.45, test isolation; full gate 639 tests on its branch, the one teardown error fixed and re-checked), `pkt/board-consistency` (IM24/I-049: every board shows why a card cannot move; Practicum on StageBoard; `.planning/phases/05-design-system/board-parity.md`), `pkt/ui-p42` (student forms). Start with: (1) full Python gate with `GOOGLE_API_KEY= GOOGLE_AI_STUDIO_API_KEY=` (last full run on main had 2 isolation failures, fixed by assistant-tune - confirm 0); (2) `npm run e2e` (expect only I-036); (3) live `.venv/Scripts/python.exe scripts/assistant_eval.py` (uses the owner's key in .env) and compare with `E:/Temp/claude/assistant_eval_run1.txt` - answers must be complete sentences, Q2/Q3/Q5 answered, gym/restaurant not covered; (4) the consistency sweep (IM24) - open I-051..I-053 from the board audit; then the NEXT list below.
- **Packets (16:40 local, end of this account's plan):** MERGED today: archive, sqlite-only, e2e, mobile, j-frontend, seed (Phases 1+2 DONE), get-writes, ui-p1a..p1f, ui-p61, ui-p31..p33, ui-p21..p23, ui-p41, ui-p62, ui-p63, fix-p41, and all four role homes (student, staff, dean, faculty). e2e on d0064be: 229 passed, only I-036 fails. Python gate last green at 598 OK (after get-writes; later merges were frontend-only except the Gemini default fix + its test). **(evening update)** `pkt/assistant` MERGED (bf550e4); gate after it running -> /e/Temp/claude/gate/after_assistant.txt (run with GOOGLE_API_KEY empty so tests never call Gemini). Live eval found I-050 -> `pkt/assistant-tune` in flight (wt/assistant-tune). Also in flight: `pkt/board-consistency` (IM24/I-049; port 5271) and `pkt/ui-p42` resumed (port 5261). Earlier note: (1) `pkt/assistant` @ b86b7fa (grounded Gemini assistant IM21: retrieval threshold, not-covered answer, personal answers, offline fallback, new AssistantChat UI, tests/test_policy_assistant.py 24 OK, p80 spec 12/12) - NOT yet verified: full Python gate on the final commit (an earlier run had 2 housekeeping failures in test_policy_documents because a run wrote the Operations Manual draft into the worktree's uploads/policy_documents - check on a clean checkout), full e2e, final screenshots, live answers. After merging run `.venv/Scripts/python.exe scripts/assistant_eval.py` in the MAIN checkout (its .env has the owner's key) and tune `RAG_MIN_SIMILARITY` (0.60 is a guess). (2) `pkt/ui-p42` @ f849aa8 holds only the P4.2 pinning spec (`frontend/e2e/p42-student-forms.spec.js`); the migration of RequestForms/ResearchForms/CompletionForms is not started - redo P4.2 from that commit. Worktrees `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/assistant` and `.../ui-p42` still exist; remove them after merging. NEXT after those: Reports rebuild into the 5 real reports (IM20, includes I-047); coordinators' landing '/' (they reach the new staff home only by typing /); backend section J bugs one app.py packet at a time (I-002, I-003, I-005, I-006, I-007, I-009..I-012) + I-036 + I-043; remaining UI-SPEC s8 packets (P2.4, P4.3-4.4, P5.1-5.5, P6.4-6.8, P7.x WorkflowPage split, P8 close-out); Phase 4 app.py split; Phase 6.
- **Gate baseline (2026-10-17 06:20, v5.2-migui_again @05145bb):** 591 tests OK, 20 min. R-001 red as expected: two seeds already match; start-on-empty differs from `--seed` (adviser_assignment 28 vs 31, panel_assignment 45 vs 71, panel_invitation 0 vs 13, course_record, document_check, form1_endorsement, defense_verdict, policy_document…) and a normal start adds/changes rows (adviser_appointment 0→28 …).
- **Resume:** scheduled task `capstone-resume-after-limit` runs `/continue_CAPSTONE-USLS-MVP` at 2026-10-17 06:35 +08:00 (after the 5-hour usage reset) unless another session is working here.
- **Next action:** Phase 1 (dates relative to seed day IM16; big generated folders to `archive/`, still tracked in git, IM17) — `/gsd-discuss-phase 1` then plan: write R-001 (seed fingerprint
  test, two temp dirs, plus "normal start changes nothing"), watch it fail, then remove MySQL,
  replace `run_schema_upgrades` with model-built schema, make start side-effect-free, unify
  the seed command; move proven-unused files to `archive/`.
- **Not obvious:** `npm run seed` and a plain start build different data (research); the seed
  makes 145 students, not 350; importing `app` runs schema upgrade + seed/maintenance.

## Earlier position (2026-10-01, unattended run — owner away ~12 h)

- **Branch:** `v5.1-migui_clean` (pushed). Base commit of the run: `85c32b7`.
- **Work queue:** `DEFENSE_REVISIONS.md` (owner decisions of 2026-10-01 at top).
- **Rung used:** Claude subagents (Sonnet; Opus for the proposal XML) instead of
  Codex, because Codex's sandbox cannot run the tests and nobody is here to
  unblock it. Main session = architect: briefs, merges, gate, live check.

### Handover (2026-10-01, paused by the owner)

Branch `v5.1-migui_clean` is the whole state — committed and pushed, in sync with GitHub.
All `pkt/*` helper branches were merged and deleted; temporary worktrees removed
(`E:/Github_Projects/CAPSTONE-USLS-MVP-wt/monitor` is a leftover locked folder, safe to delete
after a reboot). To run it: see README (`npm run setup`, then `npm run dev`; demo password
`DemoPass123!`). The work queue for whoever continues: `DEFENSE_REVISIONS.md` section J, then
the "Next session" list below.

### Progress (2026-10-01 11:00)

Everything is merged into `v5.1-migui_clean` and pushed, including the walkthrough.
Full gate on the final code: 591 tests; the only failure was a randomly-seeded test
(fixed in 6ade188, verified with three hash seeds). Frontend build passes.

Next session: section J of `DEFENSE_REVISIONS.md` (13 bugs found while re-walking the
demo + re-capture walkthrough cases 9 and 18), then re-run `scripts/docs/rebuild_proposal.py`
so the proposal reflects the last merges, and refresh the proposal's Appendix U screenshots
from `Documents/CAPSTONE_ONLY/walkthrough_screenshots/`.

## If this session died

`git worktree list` shows what exists. A `pkt/*` branch with commits ahead of
`v5.1-migui_clean` is finished work waiting to be merged; a worktree with
uncommitted changes is half-done — read its diff, run its tests, then decide.

## Not obvious from the code

- No Word, LibreOffice or pandoc on this machine: `.docx` files cannot be
  rendered here. Page numbers/TOC in the proposal update when opened in Word.
- `.venv` was rebuilt on Python 3.14 on 2026-09-30.
- Gate baseline before the run: 80 tests, 2 known failures.
