# Packet brief — rules for every implementation helper (v5.1 run, 2026-10-01)

You are one of several helpers working **in parallel**, each in its own git
worktree on its own branch. The architect (main session) merges your branch
afterwards. The owner is away; nobody can answer questions. Make the sensible
choice, write it down in your report, keep going.

## Read first
- `AGENTS.md` (rules), `DEFENSE_REVISIONS.md` (what the defense panel required).
- Only the parts of `app.py` you need — it is ~25,000 lines. Use Grep.
- `Documents/CAPSTONE_ONLY/CAPRIT2 OLD/` is an archive. Never use or edit it.

## Hard rules
1. **Work only inside your worktree directory.** Never touch
   `E:/Github_Projects/CAPSTONE-USLS-MVP` itself except to *run* its Python
   (below). Never switch branches. Never push. Never `reset --hard`, never
   rewrite history.
2. **Test first.** Write the failing test, run it, see it fail for the right
   reason, then implement. Never weaken, skip or delete an existing test to get
   green. If an existing test encodes a rule that the owner has now changed
   (listed in your task), update that test to the new rule and say so.
3. **Put your new tests in a NEW file** `tests/test_<your packet>.py` (copy the
   setup pattern from the top of `tests/test_bpm_workflows.py`: temp SQLite DB,
   `DATABASE_URL` set before importing `app`). Do not append to
   `tests/test_bpm_workflows.py` — parallel helpers would collide. Edit an
   existing test there only when rule 2 requires it.
4. **Keep your `app.py` edits local** to the functions of your area; do not
   reformat, reorder or "clean up" unrelated code — other helpers are editing
   the same file and every unrelated line you touch becomes a merge conflict.
   New helper functions/classes: place them next to the code they serve.
5. **Schema changes are additive only** (new table via `db.create_all()`, or a
   guarded `ALTER TABLE … ADD COLUMN` following the existing startup pattern).
   Must work on both SQLite and MySQL.
6. Never read `.env`. Never commit `uploads/*` user files or `*.sqlite3`.
7. No new heavy dependencies. Python: only what is in `requirements.txt`.
   Frontend: only what is in `frontend/package.json` (React 18, Vite, Tailwind,
   lucide-react etc. — check the file).
8. The handbook (`Documents/CAPSTONE_ONLY/USLS_Documents/GRADUATE-SCHOOL-
   HANDBOOK-22-23.pdf`) **is in force**. Where the system and the handbook
   disagree, the handbook wins.

## How to run things from your worktree
```bash
# Python (the venv lives in the main checkout; run it with your worktree as cwd)
PY="E:/Github_Projects/CAPSTONE-USLS-MVP/.venv/Scripts/python.exe"
$PY -m unittest tests.test_<your packet> -v                 # your tests
$PY -m unittest tests.test_bpm_workflows.BpmWorkflowSimulationTests.<name> -v   # one old test
$PY -m unittest discover -s tests -p "test_*.py"            # full gate (~4 min) — ONCE at the end
# Frontend compile check (node_modules is a junction to the main checkout)
npm --prefix frontend run build
```
Known before you started: the full gate has exactly 2 failures
(`test_workflow_clarification_can_be_returned_and_answered` — a date time-bomb,
and `test_workflow_demo_students_quick_login_and_central_reset` — old fixture
bug). Anything else red after your change is yours to fix.

Do **not** start the dev server or open a browser — several helpers share this
machine and port 5050. The architect does the live check after merging.

## Frontend conventions
- Pages in `frontend/src/pages`, shared pieces in `frontend/src/components`
  (`ui.jsx`, `forms.jsx`, `Layout.jsx`, `RoleSidebar.jsx`), API calls in
  `frontend/src/api.js`, routes in `App.jsx`. Reuse the existing components and
  Tailwind classes so screens look like the rest of the app. Load the project
  skill `ui-ux-pro-max` when designing a screen.
- The Graduation workflow page is the quality bar the owner likes (staged
  board, drag and drop, clear stage history).

## When you finish
1. Full gate once + `npm --prefix frontend run build` if you touched frontend.
2. Commit everything on your branch (`git add -A && git commit`), message in
   plain English, ending with:
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
3. Final report (this is all the architect sees), max ~400 words:
   - what you built (routes, tables, screens) and the owner-visible behaviour
   - decisions you made without asking, and why
   - exact test commands you ran and their real results (counts)
   - anything not finished, anything you noticed but did not touch
   - files you changed outside your own area (merge-conflict warning)
