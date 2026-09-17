# Rules for any agent working on this repo

These apply to every agent — Claude Code, Codex, a local model, or a human.
This is the **USLS Graduate School Lifecycle Monitoring & Analytics Platform**
(school capstone): a Flask 3 + Flask-SQLAlchemy JSON API (`app.py`) with a
React + Vite + Tailwind SPA (`frontend/`), SQLite by default. See
[`README.md`](README.md) for what it does. The work queue is
[`CHECKLIST_PHASE_PLAN.md`](CHECKLIST_PHASE_PLAN.md) (the numbered,
phase-gated acceptance checklist — items 1–92, closed in order) and
[`NEXT_SESSION_PLAN.md`](NEXT_SESSION_PLAN.md) (the current BPMN-compliance
gap list). **Those two files are the single source of truth for what to build
and in what order.** `.planning/` (GSD Core) holds only the current phase's
working plan and must never drift from them — if GSD's plan disagrees with
the checklist/plan docs, the checklist/plan docs win.

---

## Rule 1 — The test comes first. Always.

A test written after the code passes that code and proves nothing.

1. Read the goal of the item — a `CHECKLIST_PHASE_PLAN.md` "Required closure"
   row, a `NEXT_SESSION_PLAN.md` acceptance-criteria bullet, or the linked
   BPMN diagram under `Documents/CAPSTONE_ONLY/References_Context/FINAL BPMS/`.
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
| `frontend/src/**` | **no test runner is installed yet** (`frontend/package.json` has no vitest/jest/testing-library). Don't invent one silently mid-task — flag the gap, and until it's added, describe the manual verification you did (which screen, which role, what you clicked) in the commit message instead of skipping verification |

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

## Rule 4 — Official data is read-only; schema changes only add

The confirmed architectural rule (`CHECKLIST_PHASE_PLAN.md`, decisions locked
2026-07-20): **AIMS is the official source for student identity, enrollment,
enrolled subjects, grades, and course-completion status.** This app is a
monitoring, coordination, and decision-support layer over that data — never
a system of record for it.

- Never add a code path (endpoint, form, script) that lets a user
  hand-create or hand-edit an official AIMS-sourced value (student number,
  enrollment, grade, completion status). Corrections come through a new
  AIMS export/import, never a local patch — see the "Official data read-only"
  work already done in Phase 1 (`CHECKLIST_PHASE_PLAN.md` items 7, 29, 71).
- Never overwrite an official value in place; keep provenance/revision
  history the way `MonitoringSheetUpload` / `MonitoringValidationIssue`
  already do in `app.py`.
- Schema changes follow the existing startup pattern in `app.py`: an
  additive `ALTER TABLE … ADD COLUMN`, guarded by a column-existence check,
  inside `with app.app_context():` near the top of the startup block (see
  the many `ALTER TABLE` calls around line 22000+ in `app.py`, and the
  "Build order" note in `NEXT_SESSION_PLAN.md` about putting new migrations
  at the **top** of that block). This runs against the live SQLite/MySQL
  file on every app start — never write a destructive migration (no
  `DROP COLUMN`, no in-place type change, no silent data loss).
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
script — the suite is plain stdlib `unittest` (`tests/test_bpm_workflows.py`,
one file, ~79 tests as of this writing). It builds its own temp SQLite DB
(`tempfile.NamedTemporaryFile` + `DATABASE_URL` set before `app` is
imported), so it does not touch `usls_gs_demo.sqlite3` or need `.env`. If
`pytest` happens to be installed it will also collect and run these
`unittest.TestCase` classes, but don't add it as a dependency just for that.

No frontend gate exists yet (`npm run build:web` / `vite build` is the
closest thing — it only proves the SPA compiles, not that it behaves
correctly).

## How the team splits work

| Agent | Does | Does not |
|---|---|---|
| **Claude** | Architecture, models/contracts, writing the failing tests, reviewing and merging, anything touching official-data integrity or licensing | Grind through bulk mechanical work |
| **Codex** | Makes a written failing test pass; implements a route, model, or screen against a stated contract; works in its own git worktree | Change a test to match its code; widen scope |
| **Local model** (Ollama, `mcp__ollama__ask_local`) | Mechanical work: boilerplate, summaries of long text (e.g. BPMN/proposal docs), commit messages, docstrings | Design, multi-file reasoning, anything unverified |

The failing test is the handoff: a precise, machine-checkable spec. Every
delegated result is reviewed and gated before it merges.

### When an agent is unavailable — the fallback ladder

Best is all three. If one is out — Codex at its usage limit or erroring,
Ollama not running — the work moves down the ladder instead of stopping:

1. **Codex unavailable:** implementation goes to a **Claude subagent on a
   cheaper model** (`Agent` with `model: "sonnet"`) in the same worktree, with
   the same brief Codex would get. Independent packets run in parallel.
   The main Claude session keeps to tests, contracts, review and the gate.
2. **Local model unavailable:** its mechanical work goes to a Claude subagent on
   `haiku` (or `sonnet` when it needs judgement).
3. **Both unavailable:** Claude subagents do both, cheapest model that can.
4. **Only the main session:** it implements inline, in the smallest packets.

Every rung keeps the same shape: failing test first, review, gate, commit test
and implementation together. Return to Codex as soon as it is back. Note in
`.planning/STATE.md` which rung a packet used.

- **Pilot before a batch.** Repetitive delegated work goes out as one item
  first; the rest follow only after that one is reviewed.
- **Escalate, don't retry.** If a packet fails twice, or passing it would
  change a locked type, contract or test, it comes back to Claude.

### Parallel Codex packets

```bash
git worktree add -b <branch> E:/Github_Projects/CAPSTONE-USLS-MVP-wt/<short> HEAD
codex exec -C "E:/Github_Projects/CAPSTONE-USLS-MVP-wt/<short>" -s workspace-write \
  --add-dir "E:/Github_Projects/CAPSTONE-USLS-MVP/.git" --skip-git-repo-check \
  -o <short>.out.md - < <short>.prompt.md
```

The prompt starts with: read `AGENTS.md`; the test is the spec, **do not modify
it**; stop and explain if something looks wrong; touch only the named files.
**Codex's sandbox cannot spawn processes** — it cannot run the tests. Always run
them yourself before landing a packet. Remove the worktree after landing.

### The process: one owner per job

Several installed skill sets overlap if used naively, so every job has exactly
one owner. When a skill's default disagrees with this file, this file wins.

| Job | Owner | Not used for this job |
|---|---|---|
| Memory across sessions, the phase loop, context rot | **GSD Core** (local install, `budget` model profile). `/gsd-progress` or `/gsd-resume-work` to start; per phase `/gsd-discuss-phase` → `/gsd-plan-phase` → `/gsd-execute-phase` → `/gsd-verify-work`; `/gsd-pause-work` to stop; `/gsd-complete-milestone` | Superpowers `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `dispatching-parallel-agents`; hand-written handoff files |
| Discipline inside a task: test first, debugging, proving it works, code review, worktrees, closing a branch | **Superpowers**: `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`, `using-git-worktrees`, `finishing-a-development-branch` | GSD `/gsd-add-tests`, `/gsd-debug`, `/gsd-code-review`, `/gsd-audit-fix` |
| Stress-testing a design decision that is the owner's to make (e.g. a Decision Register entry D1–D10 in `CHECKLIST_PHASE_PLAN.md`, a BPMN conflict) | **grill-me** (user-level skill, never committed: it has no licence) | ad-hoc question batches |
| Writing implementation code | **Codex**, else the fallback ladder above | Claude subagents writing implementations while Codex is available, including GSD's executor |
| Mechanical text work | **Local model** (Ollama) | Opus |
| Frontend UI/UX work (`frontend/src/**`) | project skill `ui-ux-pro-max` (`.claude/skills/ui-ux-pro-max/`) — load it while planning or reviewing a screen for layout, accessibility, color, and component patterns | game-dev/domain-craft skills (`game-ui-ux`, `game-feel`, `save-systems`, `audio-design`, `create-game-assets`, `threejs-*`) — this is not a game, don't load them |
| Cost-efficient delegation with review gates on a large, multi-step job | project skill `intelligence-layer` (`.claude/skills/intelligence-layer/`) | — |

**The task shape inside `/gsd-execute-phase` is fixed:** (1) Claude writes the
failing test and watches it fail for the right reason; (2) Claude writes the
contract and hands implementation to Codex in a worktree; (3) Claude runs the
targeted tests and the gate itself; (4) `requesting-code-review` on the diff;
(5) `verification-before-completion`; (6) commit test and implementation
together. If GSD's executor starts writing the implementation in a Claude
subagent while Codex is available, stop and route the task to Codex.

## Where things are

```
app.py             single Flask app — every model, route, and workflow/business
                    rule (~23k lines). The whole backend lives here; there is
                    no separate models/routes/services split yet.
templates/          legacy server-rendered Flask pages (base/index/transaction) —
                    the React SPA in frontend/ is the primary UI, not these.
static/             Flask-served static assets for the templates above.
frontend/           React 18 + Vite 5 + Tailwind 3 SPA (src/pages, src/components,
                    src/api.js, src/auth.jsx) — the actual staff/student UI.
scripts/            setup (.venv + npm install), seed, AIMS export template
                    generation, monitoring-workbook import/export, class-list
                    and demo-walkthrough tooling.
tests/              unittest suite — test_bpm_workflows.py, run against a
                    disposable temp SQLite DB, never the real one.
Documents/          capstone documentation: BPMN diagrams (References_Context/
                    FINAL BPMS/), the proposal, AIMS export samples, demo
                    walkthroughs — source of truth for what a workflow should do.
uploads/            user-submitted files at runtime — gitignored, never commit.
.planning/          GSD Core's current-phase working plan only — must track,
                    never replace, CHECKLIST_PHASE_PLAN.md / NEXT_SESSION_PLAN.md.
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
- **`app.py` is ~23,000 lines in one file.** Use `Grep` for the model/route
  you need; don't try to read it end to end.
- **Additive-only migrations run on every startup**, guarded by
  `information_schema`/`PRAGMA`-style existence checks scattered through the
  `with app.app_context():` block. A new column needs its own guarded
  `ALTER TABLE`, added near the top of that block per the existing
  convention (see Rule 4).
- **AIMS is external and read-only by design** (Phase 1 decision). Never
  build a live AIMS integration, login, or scraper — only the approved
  file export/import contract in `Documents/AIMS_Export/`.
- **The `Documents/` folder holds the real specs.** BPMN diagrams and the
  proposal document are the ground truth for what a workflow should do —
  check them before trusting a screen's current behavior or an assumption
  about role authority (e.g. which role can approve what).
