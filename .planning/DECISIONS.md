# Owner decisions — improvement mode

Settled with the owner through grill-me. Numbered `IM#` so they never collide with the
Decision Register `D1–D10` in `CHECKLIST_PHASE_PLAN.md`. A decision changes only through a
new grill-me with the owner; agents never re-decide these.

## 2026-10-17 — start of improvement mode (v5.2)

| # | Decision | What it means for the work |
|---|---|---|
| IM1 | **No deadline is fixed yet.** | Plan as if ~4 weeks remain. Every phase must leave the app demo-ready on its own, so stopping early never leaves a half-built state. |
| IM2 | **One database setup for the whole team: SQLite + a seed that gives identical data on every machine.** No shared online database. | One command resets any machine to exactly the same demo data. A fingerprint check proves two machines match. (Research: `research/DATABASE-FOR-TEAM.md` — `npm run seed` and a plain start produce different data today, e.g. 45 vs 71 panel assignments; that, not MySQL, is the main cause of mismatches.) |
| IM3 | **MySQL support is removed.** | Delete the MySQL code paths (`normalize_database_url`/`is_mysql`/`ensure_mysql_database` in `app.py`), PyMySQL, and the MySQL sections of README/AGENTS. |
| IM4 | **The app is a demo/prototype only. It never holds real USLS data.** | The schema is built clean from the models. The startup `ALTER TABLE` patches and any data the app changes on a normal start are removed; resetting means rebuilding from the seed. This **replaces** the old "additive-only migrations" part of AGENTS.md Rule 4. The AIMS rule (official values are import-only, manual entries carry provenance) still stands. |
| IM5 | **Split `app.py` into modules** (models, services, one Flask blueprint per area, shared helpers), merging duplicated code on the way. | Behaviour stays the same. The existing unittest suite (~590 tests) is the safety net and runs after every move. Tests' `from app import …` keep working through a thin `app.py`. |
| IM6 | **One design system, not a redesign.** | Build on the existing tokens (`frontend/tailwind.config.js` USLS green, `index.css` `.card`/`.btn`). One scale for type, spacing, radius, shadows; shared components (page header, card, data table, status chip, button, form field, modal, stepper, decision panel); every page moves onto them. Same look, made consistent. |
| IM7 | **Automated browser walkthroughs with Playwright.** | Log in as each role on the seeded data, open every page, walk the main workflows; fail on console errors, failed requests, or overflow. Screenshots at the IM15 widths for the consistency review. |
| IM8 | **Order: foundations first.** | (1) Database + seed + archive dead files, (2) walkthrough tests, (3) `DEFENSE_REVISIONS.md` section J bugs, (4) backend split, (5) design system, (6) performance and the remaining cleanup. Stakeholder-blocked items in `DEFENSE_REVISIONS.md` stay waiting. |
| IM9 | **Work lands on branch `v5.2-migui_again`.** | One small commit per change, each with its test and (for visual changes) screenshots. The owner reviews and says when to merge into `v5.1-migui_clean`. Teammates keep using `v5.1-migui_clean` until then. |
| IM10 | **At most 3 implementer subagents at once.** | Each in its own worktree under `E:\Github_Projects\CAPSTONE-USLS-MVP-wt\<short>`, file sets must not overlap. One integrator (the main session) merges one packet at a time and re-runs the gate after each merge. Drop to 1 after any regression or red gate. Read-only research/audit agents are not capped. |
| IM11 | **No review cap: keep building.** | Agents do not stop at a number of unreviewed changes. Safety comes from IM9: every change is a separate, revertable commit with its own proof. The other stop conditions in `IMPROVE.md` still apply. |
| IM12 | **Proven-unused files and folders move to `archive/`**, not deleted. | "Proven" = grep shows nothing references it and the gate passes without it. `archive/README.md` lists each item, where it came from, and the evidence. Dead code *inside* a file (unused functions, routes, components) is deleted outright — git history keeps it. |
| IM13 | **Ideas from the research: cheap ones are built, the rest go to `IDEAS.md`.** | "Cheap" = frontend-only or one small endpoint, no new table, no change to a workflow rule or role permission, under ~150 changed lines. Anything else is listed in `IDEAS.md` with a recommendation, and waits for the owner's pick. |
| IM14 | **The seed spreadsheets are anonymized** (`Documents/Monitoring_Sheets`, `Documents/Faculty_Sheet`). | Safe to keep in git and to ship in a shared demo database snapshot. |
| IM15 | **Every page must work at 1366 px (laptop), 1920 px (desktop) and 390 px (phone).** | Walkthrough screenshots and the design-system review use these three widths. |
| IM16 | **Seed dates are relative to the day the seed runs.** | Deadlines and schedules always look current in a demo. The R-001 fingerprint compares dates as offsets from the seed day (and ignores salted password hashes), so two machines seeding on different days still match. |
| IM17 | **`outputs/` and the generated files under `scripts/docs/` move to `archive/` and stay tracked in git** (owner changed this on 2026-10-17: keep them just in case). | Only generated output (screenshots, built documents) moves; the scripts in `scripts/docs/` stay where they are, and any script that writes to a moved folder is updated to the new path. Everything in `archive/` is tracked. Closes I-028. |
| IM18 | **During unattended runs the agents never wait for the owner** (owner, 2026-10-17 night: "do not ask for any of my decisions … dont stop building"). | A question that would go to the owner is decided by the main session with its recommended option, logged below as `AD#` (agent decision, owner may veto in the morning), and work continues. Stop condition 5 in `IMPROVE.md` ("queue empty apart from owner items") does not stop the run while any agent-decidable work remains. |

## Agent decisions (owner may veto)

| # | Date | Decision | Why |
|---|---|---|---|
| AD1 | 2026-10-17 | Accept the Phase 5 UI-SPEC's visible changes: info notices blue (were the same green as success); `Completed` standing green; `Draft` policy docs grey; Enter no longer confirms a destructive dialog; `Login.jsx` keeps its large title as the one size exception. | Standard semantic colours (Carbon/GOV.UK, research §3); info and success looked identical; safer destructive dialogs. Same look otherwise (IM6). |
| AD2 | 2026-10-17 | "Returned", "Returned for Revision/Clarification", "Returned to student" are **warning (amber)**, not danger (red) — overriding the draft spec. | Returned means someone must act, not that something failed; red is kept for denied/failed/overdue. |
| AD3 | 2026-10-17 | `frontend/src/lib/print.js` (an HTML string for the print window, not React) is allow-listed in `check-ui.allow.json` for `rawTable`/`rawH1` at P8 close-out instead of being rewritten. | It cannot use PageHeader/DataTable; printing works today. |
