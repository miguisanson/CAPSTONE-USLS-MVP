# State

## HANDOFF AT USAGE LIMIT (2026-10-22 evening) — do this first

Branch `v5.3-migui_test` is pushed and green at the last merge (python gate 661 OK on e7be427; later merges were
frontend-only, each checked with targeted e2e). Three helpers were still running when the limit hit; their work is
on branches, NOT merged:
1. MERGED `pkt/be4` (96ded3d; R-014; full gate on it: **680 OK**), `pkt/wire` (bell refresh, staff Refresh
   data, coordinator homes), `pkt/conA` (Dean consistency). In flight: `pkt/rep` (wt/rep, port 5335, the only app.py
   editor: Reports rebuild IM20 = five real reports + short analytics, I-068), `pkt/conD` (wt/conD, port 5336: student
   consistency I-128 part), `pkt/conE` (wt/conE, port 5337: faculty/Layout nits, I-129, AD9 in standalone_process.py), `pkt/iso` (e2e order class).
   MERGED since: `pkt/conC`, `pkt/conD` (+ I-131 sign-out race fix). `pkt/a11y2` (wt/a11y2, port 5338): I-120 a11y follow-ups + p89 scans every sidebar page. Next: packet B (list toolbars/Activity Log I-124/I-125 - after pkt/rep), I-120 a11y.
2. MERGED `pkt/p8` (a14d173): Phase 5 DONE - check:ui --strict all zeros, shims deleted, AGENTS.md gate updated.
3. `pkt/iso` (wt/iso) - e2e order-independence class fix (I-100/I-113/I-121): DATA-OWNERSHIP.md + guard.
In flight since: `pkt/conA` (wt/conA, port 5332: Dean Practicum board, Dean Course Adjustments DecisionPanel, Dean board copy - I-122, I-127) and `pkt/conC` (wt/conC, port 5333: guide/activity in one place, Practicum/Graduation summary + 'View details' - I-123, I-126). Remaining consistency packets B (list toolbars/Activity Log, I-124/I-125), D (student pages, I-128 part), E (faculty/Layout nits).
Then: consistency findings I-122..I-128 (`research/CONSISTENCY-2026-10-22.md` ends with a 5-packet split A-E;
packets touching FacultyPages/DeanReportPages/Layout must not run together); I-120 a11y follow-ups; Reports rebuild
IM20 (I-068, needs app.py) + coordinator home frontend on be4's API; I-119 server strings; I-105 batch 'Next: Dean'.
Worktree junction rule: `cmd //c rmdir <wt>rontend
ode_modules` BEFORE `git worktree remove`.
Leftover locked folders to delete after a reboot: wt/vocab, wt/enr, wt/seed2, wt/ca, wt/leave, wt/p24, wt/p65, wt/p66,
wt/lists, wt/stu, wt/a11y (deregistered already).

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
