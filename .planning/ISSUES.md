# Issues (the single triage table)

Every bug, finding or question — from the owner, a teammate, a review, a walkthrough or a bug
hunt — becomes one row here. Rules adapted from DD-Project-GameMaker.

## Rules

- **Never paraphrase a person.** Rows from a person carry their words in quotes. Rows found by
  an audit or review start with `audit:` and name the file or screen.
- **Class:** BUG (wrong), UI (works but inconsistent or broken layout), PERF (slow),
  DEBT (duplication, dead code, structure), FEATURE (missing), QUESTION (needs the owner).
- **Severity:** P1 blocks a demo flow. P2 hurts. P3 is polish.
- **BUG rows get a `REGRESSION.md` row before the fix.** The failing test is that row.
- **Closing:** a row closes when its test passes on `v5.2-migui_again` and, for UI rows, its
  screenshots were reviewed at 1366/1920/390 px. Status becomes `fixed-on-v5.2` until the owner
  merges it into `v5.1-migui_clean`, then `closed`.
- **Freeze rule:** while any P1 BUG is open, no DEBT or FEATURE work starts.
- **Status values:** `open`, `needs-repro`, `confirmed`, `fixed-on-v5.2`, `closed`,
  `superseded`, `question`.

## Open P1s: 0 confirmed

## Table

| ID | Class | Sev | What (source) | Repro / evidence | Status |
|----|-------|-----|---------------|------------------|--------|
| I-001 | UI | P1 | Enrollment "Record dropped subject" dialog is taller than the screen at 1366×768 — Save unreachable. (DEFENSE_REVISIONS J1) | `scripts/docs/walkthrough/cases/` | open |
| I-002 | BUG | P1 | Demo reset sets subjects to "Not Started", which blocks single-student enrollment. (J2) | walkthrough cases | open |
| I-003 | BUG | P2 | Withdrawal report re-judges the window at report time ("window closed / Fee 100%") instead of using the window recorded at submission. (J3) | walkthrough cases | open |
| I-004 | BUG | P2 | After "Endorse and sign Form 1" a "Cannot read properties of null (reading 'getContext')" banner appears; the endorsement saves. (J4) | walkthrough cases | open |
| I-005 | BUG | P1 | Research Coordinator's student search in Research Gate always says "No students match" (opening with `?student_id=` works). (J5) | walkthrough cases | open |
| I-006 | BUG | P2 | Defense Scheduling "Change panel" shows existing members under the wrong role labels. (J6) | walkthrough cases | open |
| I-007 | BUG | P2 | Panel invitation answers survive a demo reset. (J7) | walkthrough cases | open |
| I-008 | UI | P3 | Practicum: the Dean's "Mark reviewed" window is titled "Approve current stage". (J8) | walkthrough cases | open |
| I-009 | BUG | P2 | A signed-in Dean does not see a new practicum report until reload. (J9) | walkthrough cases | open |
| I-010 | BUG | P1 | Graduation: after the Dean's CSV export the batch stays "Dean Approved" instead of "Exported - Ready to Send". (J10) | walkthrough cases | open |
| I-011 | BUG | P2 | After a monitoring-sheet import the Onboarding report panel still says "No import batches yet". (J11) | walkthrough cases | open |
| I-012 | BUG | P1 | Residency can be recorded when the checker says "Needs Human Review". (J12) | walkthrough cases | open |
| I-013 | BUG | P3 | Policy Assistant still returns loosely related passages for some questions the library does not cover. (J13) | walkthrough cases | open |
| I-014 | FEATURE | P2 | Walkthrough cases 9 and 18 not fully re-captured on the final build. (J14) — superseded by the Playwright walkthroughs (IM7) once they exist | `scripts/docs/walkthrough/` | open |
| I-015 | BUG | P1 | "multiple people are struggling with having mismatch data" (owner, 2026-10-17). audit: `npm run seed` and a plain start build different data (panel assignments 45 vs 71, adviser assignments 28 vs 31); the app also changes data on every normal start. | `research/DATABASE-FOR-TEAM.md`, `codebase/STACK.md` | confirmed |
| I-016 | UI | P2 | "a lot of inconsistencies, different UI sizes" (owner, 2026-10-17) | `codebase/CONCERNS.md` (UI inventory) | confirmed |
| I-017 | DEBT | P2 | "so many code just duplicated and doing the same things" (owner, 2026-10-17) | `codebase/CONCERNS.md`, `codebase/CLEANUP-CANDIDATES.md` | confirmed |
| I-018 | DEBT | P3 | "delete stuff that's not even being used anymore" (owner, 2026-10-17) | `codebase/CLEANUP-CANDIDATES.md` | confirmed |
| I-019 | BUG | P3 | audit: README says the seed builds ~350 students; it builds 145. | `research/DATABASE-FOR-TEAM.md` | confirmed |
| I-020 | BUG | P3 | audit: `.gitignore` covers only 2 of the 4 `uploads/` subfolders; 17 monitoring sheets and 2 policy documents are tracked. | `codebase/STACK.md` | confirmed |
| I-021 | BUG | P3 | audit: login lockout counters live in memory and reset on restart. | `codebase/ARCHITECTURE.md` | open |
| I-022 | UI | P2 | audit: no shared table or modal — 39 raw `<table>` in 27 files (12 class sets), 19 hand-built modals (17 backdrop variants); 12 text sizes + 184 arbitrary `text-[9–15px]`; 12 `h2` variants; 24 dialog `max-w-*`; 21 pages hand-write `<h1>` though `PageHeader` exists. | `codebase/CONCERNS.md` §3 | confirmed |
| I-023 | PERF | P2 | audit: whole SPA ships as one 1.7 MB JS file; no page is lazy-loaded. `WorkflowPage.jsx` is 4,956 lines (93 functions, 71 `useState`). | `codebase/CONCERNS.md` §2, §4 | confirmed |
| I-024 | PERF | P2 | audit: only `/api/students` is paginated; withdrawal board runs 3–6 queries per row (`app.py:8863`); compre-eligibility recomputes per student (`app.py:12349`); `api.meta()` fetched separately by 8 pages. | `codebase/CONCERNS.md` §4 | confirmed |
| I-025 | DEBT | P2 | audit: the permission matrix is written 3 times (`@require_api_login`, `ACCESS_CONTROL_SPEC` `app.py:22975`, `Layout.jsx:102`); role names are bare strings (`"staff"` ×182). | `codebase/CONCERNS.md` §1 | confirmed |
| I-026 | DEBT | P3 | audit: commit/rollback/error block written ~24 times; leave and standalone-process workflows each carry their own transition engine. | `codebase/CONCERNS.md` §1 | confirmed |
| I-027 | DEBT | P3 | audit: certain-unused — `templates/`, `static/`, `.codex/`, `_handout/`, `RoleAssistantPage.jsx`, 7 `api.js` methods, 18 Python functions (~400 lines), 4 uncalled routes incl. `/api/terms/active`. | `codebase/CLEANUP-CANDIDATES.md` | confirmed |
| I-028 | QUESTION | P3 | audit: `outputs/` (27 MB) and `scripts/docs/` (71 MB) are tracked; `.git` is 513 MB. Move to `archive/` (IM12) or untrack? Moving keeps the size in git history either way. | `codebase/CLEANUP-CANDIDATES.md` | question |
| I-029 | BUG | P2 | audit: all test modules share one app process, so probably only the first module's temp database is used (likely, not confirmed). | `codebase/TESTING.md` | needs-repro |
| I-030 | DEBT | P3 | audit: dates mix `date.today()` (100) and `now_utc()` (265); ~2,370 lines of seed/demo code run from `app.py` at startup. | `codebase/CONCERNS.md` §6 | confirmed |
