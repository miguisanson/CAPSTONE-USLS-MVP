# Roadmap: USLS GS Platform — v5.2 Improvement mode

## Overview

Same app, made right: identical data on every machine, automated walkthroughs, known bugs
closed, a modular backend, one consistent UI, then performance and the last cleanup. Order
from IM8 (`DECISIONS.md`). **The owner reads `BOARD.md`, not this file.**

Rules for every phase:
- Test first (AGENTS.md Rule 1). Each phase ends with `/gsd-verify-work`, `STATE.md` and
  `BOARD.md` updates, and its `REGRESSION.md` rows run on the final commit.
- Every phase leaves the app demo-ready (IM1). Work lands on `v5.2-migui_again` (IM9).
- Improvement mode (`IMPROVE.md`) runs the queue; it is not a phase.
- Behaviour questions go to `DEFENSE_REVISIONS.md` / `CHECKLIST_PHASE_PLAN.md` /
  the USLS policy documents; owner decisions go through grill-me.

## Phases

- [x] **Phase 1: Reproducible data and archive** (done 2026-10-17: gate 593 OK, R-001 green) - deterministic SQLite seed, MySQL removed, clean schema, no data changes on start, dead files to `archive/`
- [x] **Phase 2: Role walkthroughs** (done 2026-10-17: `npm run e2e`, 7 roles, 116 pages, negative control) - Playwright per role on the seeded data, screenshots at 1366/1920/390
- [ ] **Phase 3: Section J bugs** - close I-001…I-014 with tests
- [ ] **Phase 4: Backend split** - `app.py` into models, services and blueprints; duplicates merged
- [ ] **Phase 5: Design system** - tokens, shared components, every page migrated, cheap ideas X-01…X-05
- [ ] **Phase 6: Performance and final cleanup** - N+1 queries, pagination, lazy-loaded pages, remaining dead code, docs in sync

**Lanes.** Phase 2 can start once Phase 1's seed is deterministic (it needs fixed data). Phase 3
needs Phase 2's harness for its UI bugs, but its backend bugs can start after Phase 1. Phase 4
and Phase 5 can run side by side (backend vs `frontend/src`), but Phase 4 is one packet at a
time on `app.py`. Phase 6 needs 4 and 5.

## Phase Details

### Phase 1: Reproducible data and archive
**Goal**: Every team member gets byte-identical demo data from one command, and nothing the app is not using is left in the tree.
**Depends on**: Nothing (first phase)
**Requirements**: DB-01, DB-02, DB-03, CLN-01
**Success Criteria** (what must be TRUE):
  1. `npm run seed` (or its replacement) in two fresh folders produces the same fingerprint; R-001 passes.
  2. Starting the app on a seeded database changes no row (fingerprint unchanged).
  3. `grep -i mysql` finds nothing in code, requirements or docs except history.
  4. No `ALTER TABLE` patch runs at startup; the schema comes from the models.
  5. Every item moved to `archive/` is listed in `archive/README.md` with evidence, and the gate passes.

### Phase 2: Role walkthroughs
**Goal**: A single command proves every role's pages load and their main workflows work, and produces the screenshot set.
**Depends on**: Phase 1
**Requirements**: E2E-01, E2E-02
**Success Criteria** (what must be TRUE):
  1. Playwright is installed in `frontend/` with one command to run it (and it starts its own Flask server on a fresh seed).
  2. Each of the 7 roles logs in and opens every page in its sidebar; a console error, failed request, or horizontal overflow fails the run.
  3. Screenshots of every page at 1366, 1920 and 390 px land in a gitignored folder; the run prints its path.
  4. A deliberately broken page makes the run fail (negative control).

### Phase 3: Section J bugs
**Goal**: The bugs found re-walking the demo are fixed and stay fixed.
**Depends on**: Phase 1 (backend bugs), Phase 2 (UI bugs)
**Requirements**: BUG-01
**Success Criteria** (what must be TRUE):
  1. Each of I-001…I-013 has a `REGRESSION.md` row with a test that failed before its fix and passes after.
  2. I-014 is superseded by the Phase 2 walkthroughs, or the two cases are re-captured.
  3. `DEFENSE_REVISIONS.md` section J items are ticked.

### Phase 4: Backend split
**Goal**: The backend is a set of small modules with no duplicated logic, behaving exactly as before.
**Depends on**: Phase 1
**Requirements**: ARCH-01, ARCH-02
**Success Criteria** (what must be TRUE):
  1. `app.py` is a thin entry point; models, services and per-area blueprints live in their own modules (order in `codebase/ARCHITECTURE.md`).
  2. The full unittest gate and the Phase 2 walkthroughs pass after every module move.
  3. Permission checks, serializers and status transitions each have one shared implementation; the duplication list in `codebase/CLEANUP-CANDIDATES.md` is closed or each row says why not.
  4. Tests' imports still work.

### Phase 5: Design system
**Goal**: Every page uses one set of sizes, spacing, colors and shared components.
**Depends on**: Phase 2 (screenshots to compare)
**Requirements**: UI-01, UI-02
**Success Criteria** (what must be TRUE):
  1. Tokens and components are documented in one place (`frontend/src/components/ui/` + a short UI-SPEC).
  2. No page uses arbitrary pixel values or off-scale type sizes; a lint/grep check enforces it.
  3. Every page passes the walkthrough at 1366/1920/390 with no overflow.
  4. X-01…X-05 from `IDEAS.md` are built.

### Phase 6: Performance and final cleanup
**Goal**: The app is fast on the seeded data and carries no dead weight.
**Depends on**: Phase 4, Phase 5
**Requirements**: PERF-01, CLN-01
**Success Criteria** (what must be TRUE):
  1. List endpoints run a bounded number of queries (tested with a query counter).
  2. Large lists are paginated; pages are lazy-loaded; the main bundle shrinks (numbers before/after).
  3. The rest of `codebase/CLEANUP-CANDIDATES.md` is closed.
  4. README, AGENTS.md and the proposal's system description match the final code.
