# USLS Graduate School Lifecycle Monitoring & Analytics Platform

## What This Is

A school capstone web app for the University of St. La Salle (Bacolod) Graduate School. It
tracks master's and doctoral students from admission through coursework, adviser appointment,
research gates, proposal and final defense, panel verdicts, leave of absence, practicum,
residency and graduation, for seven roles (student, faculty/adviser, program chair, research
coordinator, dean, GS staff/registrar, admin). AIMS stays the official system of record; this
app only imports AIMS exports and monitors, coordinates and reports on top of them.

Stack: Flask 3 + Flask-SQLAlchemy JSON API (`app.py`, ~37,500 lines, being split — IM5) and a
React 18 + Vite 5 + Tailwind 3 SPA (`frontend/`). SQLite only (IM2, IM3). Details:
`codebase/STACK.md`, `codebase/ARCHITECTURE.md`.

The project passed its Stage 1 defense (2026-08-07, Conditional Pass). It is in its last stage.
The current milestone is **v5.2 "Improvement mode"**: the same app, made consistent, cleaner,
reproducible on every machine and bug-free — not new scope.

## Core Value

Every role can walk their part of a student's lifecycle on the seeded demo, on any team
member's machine, without a broken page, a mismatched number, or a screen that looks different
from its neighbours.

If a choice has to be made between a new feature and a demo that works the same everywhere,
the demo wins.

## Business Context

- **Audience:** the capstone panel and adviser (defense demo), the USLS Graduate School as
  stakeholder. Demo/prototype only — never real data (IM4).
- **Team:** several developers run it locally; until v5.2 their data did not match (I-015).
- **Deadline:** not fixed yet (IM1); plan as ~4 weeks, every phase leaves the app demo-ready.

## Requirements

### Validated

- Lifecycle workflows built and tested through v5.1 (~590 unittest methods green on
  2026-10-01; see `DEFENSE_REVISIONS.md` and `CHECKLIST_PHASE_PLAN.md` implementation log).

### Active (v5.2)

- **DB-01** One command resets any machine to byte-for-byte the same demo data; a fingerprint test proves it (IM2).
- **DB-02** SQLite only; MySQL code, dependency and docs removed (IM3).
- **DB-03** Schema built clean from the models; no startup `ALTER TABLE` patches; a normal start changes no data (IM4).
- **CLN-01** Proven-unused files and folders moved to `archive/` with an index; dead code removed (IM12).
- **E2E-01** Playwright walkthroughs per role on the seeded data, failing on console errors, failed requests and overflow (IM7).
- **E2E-02** Screenshot set at 1366, 1920 and 390 px for every page (IM15).
- **BUG-01** `DEFENSE_REVISIONS.md` section J bugs (I-001…I-014) closed with tests.
- **ARCH-01** `app.py` split into models, services and per-area blueprints with the same behaviour (IM5).
- **ARCH-02** Duplicated backend code merged (permission checks, serializers, status transitions).
- **UI-01** One design system on the existing USLS tokens; shared components; every page migrated (IM6).
- **UI-02** Every page passes at 1366/1920/390 px with no horizontal scroll or overflow.
- **PERF-01** No N+1 queries in list endpoints; paginated large lists; pages lazy-loaded.

### Out of Scope

- New features that are not "cheap" (IM13) unless the owner picks them from `IDEAS.md`.
- A shared online database, MySQL, Postgres, Docker (IM2, IM3).
- Real student data, production deployment, migrations for live data (IM4).
- A live AIMS integration, login or scraper (AGENTS.md Rule 4).
- Stakeholder-blocked items in `DEFENSE_REVISIONS.md` (section G).

## Context

- Work queue: `DEFENSE_REVISIONS.md` first, then `CHECKLIST_PHASE_PLAN.md` and
  `NEXT_SESSION_PLAN.md` — these stay the source of truth for *what the app must do*. v5.2's
  `ROADMAP.md` covers *how the code is made right*; where they disagree on behaviour, those
  files win.
- The owner's tracker is `BOARD.md`. Owner decisions: `DECISIONS.md`. Process: `IMPROVE.md`.
- Research: `research/REFERENCE-PORTALS.md` (12 comparable portals, top 10 patterns),
  `research/DATABASE-FOR-TEAM.md`.

## Constraints

- Test first (AGENTS.md Rule 1). Never weaken a test.
- Official AIMS-sourced values stay import-only; manual entries carry provenance (Rule 4).
- Never read or commit `.env*` or `uploads/` contents.
- At most 3 implementer subagents at once (IM10). Work lands on `v5.2-migui_again` (IM9).

## Key Decisions

See `DECISIONS.md` (IM1–IM15, 2026-10-17) and the Decision Register D1–D10 in
`CHECKLIST_PHASE_PLAN.md`.

## Project Reference

- Rules: `AGENTS.md`, `CLAUDE.md`. Start (attended or unattended): `/continue_CAPSTONE-USLS-MVP`.
- Codebase map: `codebase/` (STACK, INTEGRATIONS, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, CONCERNS, CLEANUP-CANDIDATES).
