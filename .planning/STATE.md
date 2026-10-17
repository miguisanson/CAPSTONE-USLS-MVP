# State

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
- **Packets (12:55):** MERGED: archive, sqlite-only, e2e, mobile, j-frontend, ui-p1a..p1f (the whole component library; e2e 102 pass, only I-036). e2e after p1d/p1e: 75 pass, only I-036 fails. In flight (3 = cap): `pkt/seed` (wt/seed - uncommitted work in progress; delete main checkout's untracked `tests/test_seed_determinism.py` + `scripts/db_fingerprint.py` before merging), `pkt/ui-p31` (dean shared parts + DecisionPanel; port 5111), `pkt/ui-p61` (first page migration: Students, Dashboard, WorkQueue; port 5101). Decision: ui.jsx PageHeader/StatCard stay as the OLD components (no shim) - pages move to `components/ui/index.js` one packet at a time; P8 deletes the old ones. Next page packets: P2.1 (Layout etc.), P3.1 dean (after P1f), P6.2... per UI-SPEC section 8. Main-checkout e2e: `E2E_PORT=5066 USLS_E2E_TMP=E:/Temp/claude/e2e-main`.
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
