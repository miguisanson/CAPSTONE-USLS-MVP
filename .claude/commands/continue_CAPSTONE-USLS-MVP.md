---
description: Start of any session in CAPSTONE-USLS-MVP — pick up where the project stands and keep building until done or blocked on the owner.
---

Continue building CAPSTONE-USLS-MVP on your own. Work through the open items
one after another until the work is done or you are blocked on something only
the owner can do.

**This is the only start command, attended or unattended.** Since 2026-10-17
it runs **improvement mode** exactly as `.planning/IMPROVE.md` describes ("The
loop", bug hunts, stop conditions, reviewer rules). Keep going until a stop
condition in that file is hit, the owner types `stop`, or
`.planning/IMPROVE_STOP` exists. Questions only the owner can answer become
`QUESTION` rows in `.planning/ISSUES.md` plus a line under "Waiting on you" in
`.planning/BOARD.md`, and work continues on other items; use grill-me only
while the owner is present. **Usage limits are not a stop:** before the
window runs out, commit, push `v5.2-migui_again`, and write the exact next
step into `.planning/STATE.md` so the next session (or the scheduled resume
task) picks it up.

## Ground rules (these override any skill's defaults)

1. Read `CLAUDE.md` and `AGENTS.md` first. AGENTS.md "The process: one owner
   per job" decides which skill does which job. Use every skill that owns a
   job. Do **not** use the ones it marks as not used.
2. **Since 2026-10-17 the project is in improvement mode (v5.2).** Work lands
   on branch `v5.2-migui_again`; the order is `.planning/ROADMAP.md` (owner
   decision IM8: data → walkthroughs → section J bugs → backend split →
   design system → performance), fed by `.planning/ISSUES.md`. The owner's
   decisions are `.planning/DECISIONS.md` (IM1–IM15); the owner reads
   `.planning/BOARD.md` — keep it current with STATE.md. For an unattended
   run the same command runs `.planning/IMPROVE.md`.
   For what the app must *do*: `DEFENSE_REVISIONS.md` (the panel's required
   revisions from the 2026-08-07 defense) is worked **first**, top to bottom. After it is fully closed,
   `CHECKLIST_PHASE_PLAN.md` (numbered, phase-gated, items 1–92) and
   `NEXT_SESSION_PLAN.md` (BPMN-compliance gaps) are what to build
   and in what order — closed in numerical/phase order, one phase at a time.
   Never use `Documents/CAPSTONE_ONLY/CAPRIT2 OLD/` as a spec (archive).
   `.planning/STATE.md` is where the work stands right now. `.planning/`
   holds only the current phase's working plan and must never become a
   second, drifting roadmap — if it disagrees with the checklist/plan docs,
   the checklist/plan docs win.
3. Keep Opus usage low. You write the tests and contracts, review, run the gate
   and commit. **Sonnet subagents write implementations** (`Agent` with
   `model: "sonnet"`, in git worktrees, several at once when independent). The
   **local Ollama model** (`mcp__ollama__ask_local`) does mechanical text work.
   If the local model or subagents are unavailable, follow the fallback ladder
   in AGENTS.md (Haiku subagent, then inline in small packets) instead of stopping. GSD stays
   on the `balanced` profile. Keep replies to the owner short.

## Start of every session

1. **Onboarding check.** GSD was onboarded on 2026-10-17 (`.planning/PROJECT.md`,
   `ROADMAP.md`, `codebase/`). If either file is missing again, run
   `/gsd-onboard`. `ROADMAP.md` orders the v5.2 code work; it never overrides
   `CHECKLIST_PHASE_PLAN.md` / `NEXT_SESSION_PLAN.md` on what the app does.
2. Run `/gsd-progress` (or `/gsd-resume-work` if a pause handoff exists).
3. Run `git status`, `git worktree list`, and the gate from AGENTS.md
   (`.venv/Scripts/python.exe -m unittest discover -s tests -p "test_*.py" -v`).
   If `.venv/Scripts/python.exe` fails with `No Python at '...'`, the venv's
   base interpreter is gone (see AGENTS.md Traps) — recreate it with
   `npm run install:python` before anything else, don't just skip the gate.
   If the gate is red for a real reason, use `superpowers:systematic-debugging`
   before anything else. If worktrees are left over, land them or say why you
   can't.
4. Recover from a hard stop: if STATE.md names work in progress, or
   `git status`, WIP branches or worktrees show changes it doesn't mention,
   the last session ended abruptly. Work out what that work was, finish or
   discard it, and fix STATE.md before starting anything new. From here on,
   follow the AGENTS.md handoff rule (update STATE.md after every step that lands).

## The loop — repeat until done

Pick the next item from the current `ROADMAP.md` phase or the top open row of
`.planning/ISSUES.md` (P1 first; `DEFENSE_REVISIONS.md` section J is copied
there as I-001…I-014), as `.planning/IMPROVE.md` "Inputs" orders them. After
v5.2 is done, fall back to the order below. Pick the next open item in
`DEFENSE_REVISIONS.md`. Items marked
**WAITING ON OWNER / STAKEHOLDER** are skipped (remind the owner in one line);
everything else is fair game. Only when that file has no open buildable item:
pick the next open item in `CHECKLIST_PHASE_PLAN.md` order (current phase
first — don't start a later phase before the current one's exit gate
passes), or the next unchecked item in `NEXT_SESSION_PLAN.md` if that's what
the owner is currently focused on.

a. **Decide who decides.** If the item touches a Decision Register entry
   (D1–D10 in `CHECKLIST_PHASE_PLAN.md`), a BPMN conflict already flagged as
   "leave as-is" in `NEXT_SESSION_PLAN.md`, a data model, or changes what
   counts as an official AIMS value, run **grill-me** with the owner before
   planning. Never guess their answer. Otherwise `/gsd-discuss-phase`.
b. **Load the domain skills** the AGENTS.md table names for the item
   (`ui-ux-pro-max` for `frontend/src/**` work, `intelligence-layer` for a
   large delegated job).
c. `/gsd-plan-phase`, then `/gsd-execute-phase`. Every task follows the fixed
   shape in AGENTS.md:
   1. `superpowers:test-driven-development`: failing test, watched failing.
   2. Write the contract.
   3. Implementation to a `sonnet` subagent in a worktree (`superpowers:using-git-worktrees`).
      Independent packets in parallel; pilot one before a batch.
   4. Run the targeted tests and the gate yourself.
   5. `superpowers:requesting-code-review`, then `superpowers:receiving-code-review`.
   6. `superpowers:verification-before-completion`.
   7. Commit test and implementation together, then
      `superpowers:finishing-a-development-branch` to clean up the worktree.
d. `/gsd-verify-work`, mark the item done in `CHECKLIST_PHASE_PLAN.md` /
   `NEXT_SESSION_PLAN.md` (not only in `.planning/`), commit.
e. When a milestone is done: `/gsd-audit-milestone`, then `/gsd-complete-milestone`.

## When to stop and ask the owner

- Your context is getting full: `/gsd-pause-work`, commit, report in three lines.
- You need a design decision, credentials or API keys, a deploy, a git push,
  a history rewrite, or anything that deletes data: ask.
- **Never:** weaken, skip or delete a test to get green; commit secrets
  (`.env*`) or user uploads (`uploads/*`); commit a `*.sqlite3` database;
  force-push or `reset --hard`; add a code path that lets a user hand-edit
  an official AIMS-sourced value (student number, enrollment, grade,
  completion status) — see AGENTS.md Rule 4; add MySQL or a startup schema
  patch back (IM3/IM4); build a live AIMS integration, login, or scraper;
  merge into `v5.1-migui_clean` without the owner's word (IM9).

## Keeping this command current

Edit this file when the owner asks, or when a session shows a step is wrong,
missing or obsolete. Rules for every agent belong in `AGENTS.md`; where the
work stands belongs in `.planning/STATE.md` — never here. Replace the step a
change supersedes instead of appending beside it, and commit it on its own
(`chore(continue): …`).

Start now with "Start of every session".
