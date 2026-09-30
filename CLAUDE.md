# Claude Code — project notes

**Read [`AGENTS.md`](AGENTS.md) first.** It holds the rules every agent
follows (test first, targeted tests, stay inside the item, official-data
read-only, leave the repo ready) and how work is split between Claude, Codex,
and the local model. Do not restate them here.

- **The work queue** is first [`DEFENSE_REVISIONS.md`](DEFENSE_REVISIONS.md)
  (panel revisions from the 2026-08-07 defense — highest priority), then
  [`CHECKLIST_PHASE_PLAN.md`](CHECKLIST_PHASE_PLAN.md) (numbered, phase-gated
  acceptance checklist, items 1–92) and
  [`NEXT_SESSION_PLAN.md`](NEXT_SESSION_PLAN.md) (BPMN-compliance gaps). They
  are the single source of truth for what to build next — `.planning/` must
  never drift from them.
- **`Documents/CAPSTONE_ONLY/CAPRIT2 OLD/` is archived pre-defense material** —
  do not use it as a spec, do not edit it.
- **Load `ui-ux-pro-max`** (`.claude/skills/ui-ux-pro-max/`) before planning
  or reviewing anything under `frontend/src/**`.
- **Load `intelligence-layer`** (`.claude/skills/intelligence-layer/`) for a
  large multi-step job that benefits from architect/QA + cheaper-model
  delegation, beyond the Claude/Codex/Ollama split AGENTS.md already defines.
- **Stakeholder policy sources** in `Documents/CAPSTONE_ONLY/USLS_Documents/`
  (Graduate School Handbook, Research Protocol) and the proposal
  `Documents/CAPSTONE_ONLY/Final Proposal Document - CAP-IT1.docx` are the
  ground truth for what a workflow should do — read the relevant policy text
  before changing or extending a workflow's behavior. The Word files have no
  `pandoc` here; read them with a small stdlib `zipfile` + XML script.

Commands: `/continue_CAPSTONE-USLS-MVP` (start any session with it).

## Claude-specific conventions

- `app.py` is one ~23,000-line Flask file holding every model, route, and
  business rule. `Grep` for the symbol you need; don't read it end to end.
- Tests are plain stdlib `unittest` in `tests/test_bpm_workflows.py`
  (no `pytest` dependency, no `package.json` test script). They build their
  own temp SQLite DB before importing `app`, so they never touch
  `usls_gs_demo.sqlite3` or need `.env`.
- Schema changes are additive `ALTER TABLE … ADD COLUMN` statements, guarded
  by an existence check, added near the top of the startup
  `with app.app_context():` block in `app.py` — never a destructive
  migration. See AGENTS.md Rule 4.
- Official student/enrollment/grade data is read-only and sourced only from
  an AIMS export import — never add a path that lets a user hand-edit it.
  See AGENTS.md Rule 4.
- Never read or quote `.env`, `.env.*`, or the contents of `uploads/` —
  they hold local secrets and user-submitted files and are gitignored.
- The `.venv` can go stale if the machine's Python version changed since it
  was created (`.venv/pyvenv.cfg` pins an absolute interpreter path) — see
  AGENTS.md Traps before assuming the gate will just run.
