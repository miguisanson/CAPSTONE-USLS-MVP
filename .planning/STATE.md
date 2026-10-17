# State

## HANDOVER FOR THE NEXT SESSION / ACCOUNT (kept current; read this first)

The owner's plan for this account ends **2026-10-17 17:00 +08**. A new session (any account) starts with
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
6. The hourly scheduled task "Keep CAPSTONE improvement mode running" restarts the run if
   `.planning/.run-heartbeat` is older than 45 min; keep the heartbeat fresh while working.

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
