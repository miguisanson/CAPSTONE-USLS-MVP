# Rules for any agent working on this repo

These apply to every agent — Claude Code, a Claude subagent, a local model, or a human.
This is the **USLS Graduate School Lifecycle Monitoring & Analytics Platform**
(school capstone): a Flask 3 + Flask-SQLAlchemy JSON API (`app.py`) with a
React + Vite + Tailwind SPA (`frontend/`), SQLite only (owner decision IM3).
See [`README.md`](README.md) for what it does.

**Improvement mode (v5.2, from 2026-10-17).** The owner's decisions IM1–IM15
are in [`.planning/DECISIONS.md`](.planning/DECISIONS.md); how unattended work
runs is [`.planning/IMPROVE.md`](.planning/IMPROVE.md); the owner's tracker is
[`.planning/BOARD.md`](.planning/BOARD.md); every bug or finding is a row in
[`.planning/ISSUES.md`](.planning/ISSUES.md); every fixed bug adds a row to
[`.planning/REGRESSION.md`](.planning/REGRESSION.md); ideas wait in
[`.planning/IDEAS.md`](.planning/IDEAS.md). All work lands on branch
`v5.2-migui_again`; only the owner merges it into `v5.1-migui_clean` (IM9).
`.planning/ROADMAP.md` orders *how the code is made right* (data → walkthroughs
→ section J bugs → backend split → design system → performance). What the app
must *do* still comes from the files below. The work queue for behaviour is,
in priority order:

1. [`DEFENSE_REVISIONS.md`](DEFENSE_REVISIONS.md) — what the panel required at
   the Stage 1 defense (2026-08-07, Conditional Pass) and what is still open.
   **This comes first**: nothing else matters if these are not closed.
2. [`CHECKLIST_PHASE_PLAN.md`](CHECKLIST_PHASE_PLAN.md) (the numbered,
   phase-gated acceptance checklist — items 1–92, closed in order) and
   [`NEXT_SESSION_PLAN.md`](NEXT_SESSION_PLAN.md) (the BPMN-compliance gap
   list).

**Those three files are the single source of truth for what to build and in
what order.** `.planning/` (GSD Core) holds only the current phase's working
plan and must never drift from them — if GSD's plan disagrees with them, they
win.

**`Documents/CAPSTONE_ONLY/CAPRIT2 OLD/` is an archive of the pre-defense
material. Do not read it as a spec and do not edit it.** Current documents are
the four `.docx` files directly in `Documents/CAPSTONE_ONLY/`; current
stakeholder sources are in `Documents/CAPSTONE_ONLY/USLS_Documents/`. The BPMN
diagrams now exist only inside the archive (`CAPRIT2 OLD/References_Context/
FINAL BPMS/`) — they may be opened as pictures of the intended flow, but where
they disagree with `DEFENSE_REVISIONS.md` or a stakeholder document, those win.

---

## Rule 1 — The test comes first. Always.

A test written after the code passes that code and proves nothing.

1. Read the goal of the item — a `DEFENSE_REVISIONS.md` item, a
   `CHECKLIST_PHASE_PLAN.md` "Required closure" row, a `NEXT_SESSION_PLAN.md`
   acceptance-criteria bullet, or the policy text it cites in
   `Documents/CAPSTONE_ONLY/USLS_Documents/`.
2. Write the test from that goal.
3. **Run it and watch it fail** for the right reason — a wrong value or
   `AttributeError`/`ImportError` for something not implemented yet, not a
   syntax error. Show the output.
4. Implement until it passes. Run the same targeted test again.
5. Then the gate.

Do not weaken, skip or delete a failing test to get green. If you cannot
write a failing test for the goal, stop and say so — the goal is
underspecified.

| Work | Test you write first |
|---|---|
| `app.py` routes, models, workflow/business logic | a `unittest.TestCase` method in `tests/test_bpm_workflows.py` (or a new `tests/test_<area>.py`), using the Flask app context and test client the way the existing tests do — see the imports and fixtures at the top of `tests/test_bpm_workflows.py` |
| `scripts/*.py` (AIMS export template, monitoring-workbook import/export, class-list build) | a targeted `unittest` test against a small in-memory or temp-file fixture, in `tests/` |
| A checklist item or BPMN gap (`CHECKLIST_PHASE_PLAN.md`, `NEXT_SESSION_PLAN.md`) | translate every "Required closure" / acceptance-criteria bullet into one or more `test_*` methods before touching `app.py` |
| `frontend/src/**` | a **Playwright** walkthrough step (owner decision IM7; the harness is built in ROADMAP Phase 2 under `frontend/e2e/`) that logs in as the role, reaches the screen through the real UI and asserts what it shows; for layout work also the screenshots at 1366, 1920 and 390 px (IM15), opened and reviewed. Until Phase 2 lands, describe the manual verification you did (which screen, which role, what you clicked) in the commit message |

## Rule 2 — Run only the tests that matter

```bash
.venv/Scripts/python.exe -m unittest tests.test_bpm_workflows.BpmWorkflowSimulationTests.test_name -v
```

Targeted while working. The full gate once, at the end.

## Rule 3 — Stay inside the item

Do the checklist/plan item you were given. Noticing adjacent work is good;
doing it is not — list it at the end. `CHECKLIST_PHASE_PLAN.md` rule 3 is
explicit about this at the project level too: "A later phase will not start
until the current phase passes its exit gate" — don't reach into Phase N+1
while working Phase N. Read the files the item needs, not the whole
1.1M-character `app.py`.

## Rule 4 — Official data is read-only; the demo database is rebuilt, never patched

The confirmed architectural rule (`CHECKLIST_PHASE_PLAN.md`, decisions locked
2026-07-20): **AIMS is the official source for student identity, enrollment,
enrolled subjects, grades, and course-completion status.** This app is a
monitoring, coordination, and decision-support layer over that data — never
a system of record for it.

- **Owner decision 2026-10-01 (supersedes the old "upload only" rule):** the
  Monitoring Sheet must support adding and editing records directly in the
  portal (students, subject rows, statuses) — sheet upload stays as a second
  way in, not the only one. Every portal-entered or portal-edited value is
  stamped with its provenance ("manual entry", who, when, reason) and written
  to the audit log, so it is always distinguishable from an imported value.
  Grades remain out of scope.
- Never overwrite an official value in place; keep provenance/revision
  history the way `MonitoringSheetUpload` / `MonitoringValidationIssue`
  already do in `app.py`.
- **Schema changes (owner decisions IM2–IM4, 2026-10-17): the app is a demo
  only and never holds real data, so the database is disposable.** The
  schema comes from the SQLAlchemy models; a new column is added by editing
  the model and the seed, and every machine rebuilds its database with the
  one seed command. The startup `ALTER TABLE` patches (`run_schema_upgrades`)
  are being removed in ROADMAP Phase 1 — do not add new ones. A normal app
  start must not change any data (only the seed command writes demo data),
  and the seed must give identical data on every machine (R-001).
- SQLite only. Do not add MySQL, Postgres or any other database path back (IM3).
- Never commit `.env`, `uploads/*`, or `*.sqlite3` (including
  `usls_gs_demo.sqlite3*` backups) — `.gitignore` already excludes them;
  keep it that way, and never read `.env` contents into a commit, a test
  fixture, or a chat response.

## Rule 5 — Leave the repo ready for whoever comes next

Any session can end without warning (usage limit, crash, the owner switching
agents), so an agent never waits until the end to write things down. Keep
`.planning/STATE.md` current as you go:

- **After every step that lands** (a test written, an implementation passing,
  a review done, a commit), update STATE.md's *Current Position*: what is
  done, what is in progress and on which branch or worktree, the exact next
  action, and anything learned that is not obvious from the code. Commit it
  with the work, or on its own if nothing else changed.
- **Before a long or risky step** (a delegated packet, a big refactor, a run
  in the background), write down first what you are about to do and where the
  output will go, so a session that dies halfway through can be picked up.
- **Never leave work only in your context.** Half-finished code gets a WIP
  commit on a branch (not the main branch) or a note in STATE.md naming the
  files it touched. Worktrees and background jobs are listed by path.
- **If you know the session is ending**, run `/gsd-pause-work` (Claude) or
  write the same thing by hand into STATE.md (any other agent).

The next agent starts with `/continue_CAPSTONE-USLS-MVP`, or, outside
Claude, by reading this file and `.planning/STATE.md` and running
`git status`.

---

## The gate

```bash
.venv/Scripts/python.exe -m unittest discover -s tests -p "test_*.py" -v
```

There is no `pytest` in `requirements.txt` and no `package.json` test
script — the suite is plain stdlib `unittest` (19 files under `tests/`, ~590
test methods on 2026-10-17). It builds its own temp SQLite DB
(`tempfile.NamedTemporaryFile` + `DATABASE_URL` set before `app` is
imported), so it does not touch `usls_gs_demo.sqlite3` or need `.env`. If
`pytest` happens to be installed it will also collect and run these
`unittest.TestCase` classes, but don't add it as a dependency just for that.

The frontend gate is `npm run build:web` (proves the SPA compiles) plus, once
ROADMAP Phase 2 lands, the Playwright role walkthroughs (IM7) — their run
command will be recorded here. Run only the walkthrough for the touched area
while working; all roles once before merging a packet that touches
`frontend/src/**` or a route the frontend calls.

Before the owner merges `v5.2-migui_again` into `v5.1-migui_clean`, every
automated row in `.planning/REGRESSION.md` runs on that commit.

## How the team splits work

| Agent | Does | Does not |
|---|---|---|
| **Claude** | Architecture, models/contracts, writing the failing tests, reviewing and merging, anything touching official-data integrity or licensing | Grind through bulk mechanical work |
| **Sonnet subagent** (`Agent`, `model: "sonnet"`) | Makes a written failing test pass; implements a route, model, or screen against a stated contract; works in its own git worktree and can run the tests | Change a test to match its code; widen scope |
| **Local model** (Ollama, `mcp__ollama__ask_local`) | Mechanical work: boilerplate, summaries of long text (e.g. BPMN/proposal docs), commit messages, docstrings | Design, multi-file reasoning, anything unverified |

The failing test is the handoff: a precise, machine-checkable spec. Every
delegated result is reviewed and gated before it merges.

### When a helper is unavailable — the fallback ladder

If one is out — Ollama not running, subagents unavailable — the work moves
down the ladder instead of stopping:

1. **Local model unavailable (Ollama down):** its mechanical work goes to a
   Claude subagent on `haiku` (or `sonnet` when it needs judgement).
2. **Subagents unavailable:** the main session implements inline, in the
   smallest packets.

Every rung keeps the same shape: failing test first, review, gate, commit test
and implementation together. Note in `.planning/STATE.md` which rung a packet
used.

- **Pilot before a batch.** Repetitive delegated work goes out as one item
  first; the rest follow only after that one is reviewed.
- **Escalate, don't retry.** If a packet fails twice, or passing it would
  change a locked type, contract or test, it comes back to the main session.

### Parallel subagent packets

```bash
git worktree add -b <branch> E:/Github_Projects/CAPSTONE-USLS-MVP-wt/<short> HEAD
```

Then one `Agent` call per packet with `model: "sonnet"`, telling it to work
only in `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/<short>`. Independent packets go out in
parallel, each in its own worktree, branched from `v5.2-migui_again`.

- **At most 3 implementer subagents at once** (owner, IM10), and only if their
  file sets do not overlap. While `app.py` is still one file, only **one**
  packet at a time may edit it. Read-only research/audit agents are not capped.
  **WIP cap 4.** **One integrator** (the main session) merges one packet at a
  time and **re-runs the gate after every merge**. Drop to 1 implementer after
  a regression, a red gate after a merge, or a merge that needed manual
  conflict resolution.
- **Packets** are one behaviour, about 300 changed lines and about 5 files at
  most (a backend-split move may be larger, but one module per packet).
- **Reviewer rules** (never the builder; assume the report is wrong): run the
  tests yourself; flip the fix and watch the new test go red; take expected
  values from the policy text or the owner, not the code's own output; list
  removed or changed assertions by name; open every changed screenshot at
  1366/1920/390 px; reach the feature through the real UI; grep siblings of the
  changed pattern; no stray `console.log`/`print`, no secrets, nothing outside
  the packet's file list. Fix small findings in the same session.
- **Unused files and folders are moved to `archive/`, not deleted** (owner,
  IM12), each listed in `archive/README.md` with where it came from and the
  grep evidence that nothing uses it. Dead code inside a file is deleted
  (git history keeps it). "Proven unused" = nothing references it and the gate
  passes without it.
- **Cheap improvements** (IM13: frontend-only or one small endpoint, no new
  table, no workflow-rule or permission change, under ~150 lines) may be built
  without asking; anything bigger goes to `.planning/IDEAS.md` for the owner.

The prompt starts with: read `AGENTS.md`; the test is the spec, **do not modify
it**; stop and explain if something looks wrong; touch only the named files.
Subagents can run the tests themselves, but the main session still re-runs the
targeted tests and the gate before landing a packet. Remove the worktree after
landing.

### The process: one owner per job

Several installed skill sets overlap if used naively, so every job has exactly
one owner. When a skill's default disagrees with this file, this file wins.

| Job | Owner | Not used for this job |
|---|---|---|
| Memory across sessions, the phase loop, context rot | **GSD Core** (local install, `balanced` model profile). `/gsd-progress` or `/gsd-resume-work` to start; per phase `/gsd-discuss-phase` → `/gsd-plan-phase` → `/gsd-execute-phase` → `/gsd-verify-work`; `/gsd-pause-work` to stop; `/gsd-complete-milestone` | Superpowers `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `dispatching-parallel-agents`; hand-written handoff files |
| Discipline inside a task: test first, debugging, proving it works, code review, worktrees, closing a branch | **Superpowers**: `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`, `using-git-worktrees`, `finishing-a-development-branch` | GSD `/gsd-add-tests`, `/gsd-debug`, `/gsd-code-review`, `/gsd-audit-fix` |
| Stress-testing a design decision that is the owner's to make (e.g. a Decision Register entry D1–D10 in `CHECKLIST_PHASE_PLAN.md`, a BPMN conflict) | **grill-me** (user-level skill, never committed: it has no licence) | ad-hoc question batches |
| Writing implementation code | **Sonnet subagent** in a worktree, else the fallback ladder above | The main Opus session writing implementations |
| Mechanical text work | **Local model** (Ollama) | Opus |
| Frontend UI/UX work (`frontend/src/**`) | project skill `ui-ux-pro-max` (`.claude/skills/ui-ux-pro-max/`) — load it while planning or reviewing a screen for layout, accessibility, color, and component patterns | game-dev/domain-craft skills (`game-ui-ux`, `game-feel`, `save-systems`, `audio-design`, `create-game-assets`, `threejs-*`) — this is not a game, don't load them |
| Cost-efficient delegation with review gates on a large, multi-step job | project skill `intelligence-layer` (`.claude/skills/intelligence-layer/`) | — |

**The task shape inside `/gsd-execute-phase` is fixed:** (1) Claude writes the
failing test and watches it fail for the right reason; (2) Claude writes the
contract and hands implementation to a `sonnet` subagent in a worktree; (3) Claude runs the
targeted tests and the gate itself; (4) `requesting-code-review` on the diff;
(5) `verification-before-completion`; (6) commit test and implementation
together. Implementation goes to a `sonnet` subagent in a worktree; GSD's
executor on the `balanced` profile is acceptable.

## Where things are

```
app.py             single Flask app — every model, route, and workflow/business
                    rule (~37,500 lines; 55 models, 210 routes inside
                    register_routes). Being split into modules in ROADMAP
                    Phase 4; line map in .planning/codebase/ARCHITECTURE.md.
templates/, static/ legacy server-rendered pages — never served (no
                    render_template; static_folder=None). Moving to archive/.
archive/            (from Phase 1) unused files kept for reference; see its README.
frontend/           React 18 + Vite 5 + Tailwind 3 SPA (src/pages, src/components,
                    src/api.js, src/auth.jsx) — the actual staff/student UI.
scripts/            setup (.venv + npm install), seed, AIMS export template
                    generation, monitoring-workbook import/export, class-list
                    and demo-walkthrough tooling.
tests/              unittest suite (19 files), run against a disposable temp
                    SQLite DB, never the real one.
Documents/          capstone documentation: BPMN diagrams (References_Context/
                    FINAL BPMS/), the proposal, AIMS export samples, demo
                    walkthroughs — source of truth for what a workflow should do.
uploads/            user-submitted files at runtime — gitignored, never commit.
.planning/          GSD Core: PROJECT, ROADMAP (v5.2 improvement phases), STATE,
                    and improvement mode — BOARD (owner's tracker), DECISIONS
                    (IM1–IM15), IMPROVE, ISSUES, REGRESSION, IDEAS; codebase/
                    (code map) and research/. Must never contradict
                    DEFENSE_REVISIONS.md / CHECKLIST_PHASE_PLAN.md /
                    NEXT_SESSION_PLAN.md on what the app does.
```

## Traps

- **The project `.venv` can go stale if the machine's Python is upgraded.**
  Its `pyvenv.cfg` pins an absolute path to the Python that created it
  (e.g. `...\Python312\python.exe`); if that interpreter is later removed
  (system upgraded to a newer Python), `.venv/Scripts/python.exe` fails with
  `No Python at '...'` even though the folder still exists. Check
  `.venv/pyvenv.cfg` and `.venv/Scripts/python.exe` before assuming the gate
  will run. Fix by recreating it: `npm run install:python` (runs
  `scripts/setup-python.cjs`: `python -m venv .venv` with whatever system
  Python is current, then `pip install -r requirements.txt`).
- **`pytest` and Flask are not on the system/global Python** — only inside
  `.venv`. Don't run tests with a bare `python`/`python3` unless you've
  checked it's the venv's.
- **`app.py` is ~37,500 lines in one file** (until Phase 4). Use `Grep` for
  the model/route you need; don't try to read it end to end.
- **Importing `app` has side effects**: it creates the app, upgrades the
  schema and runs seed/maintenance code. Tests stay safe only because they set
  `DATABASE_URL` and temp dirs *before* `import app`. Keep that true in any
  new test and in the Phase 4 split.
- **Until Phase 1 lands, a normal start changes demo data** and
  `npm run seed` vs a plain start give different data (I-015) — compare two
  machines only after both ran the same seed command.
- **AIMS is external and read-only by design** (Phase 1 decision). Never
  build a live AIMS integration, login, or scraper — only the approved
  file export/import contract in `Documents/AIMS_Export/`.
- **The `Documents/` folder holds the real specs.** BPMN diagrams and the
  proposal document are the ground truth for what a workflow should do —
  check them before trusting a screen's current behavior or an assumption
  about role authority (e.g. which role can approve what).
