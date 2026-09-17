---
description: Start of any session in CAPSTONE-USLS-MVP — pick up where the project stands and keep building until done or blocked on the owner.
---

Continue building CAPSTONE-USLS-MVP on your own. Work through the open items
one after another until the work is done or you are blocked on something only
the owner can do.

## Ground rules (these override any skill's defaults)

1. Read `CLAUDE.md` and `AGENTS.md` first. AGENTS.md "The process: one owner
   per job" decides which skill does which job. Use every skill that owns a
   job. Do **not** use the ones it marks as not used.
2. `CHECKLIST_PHASE_PLAN.md` (numbered, phase-gated, items 1–92) and
   `NEXT_SESSION_PLAN.md` (current BPMN-compliance gaps) are what to build
   and in what order — closed in numerical/phase order, one phase at a time.
   `.planning/STATE.md` is where the work stands right now. `.planning/`
   holds only the current phase's working plan and must never become a
   second, drifting roadmap — if it disagrees with the checklist/plan docs,
   the checklist/plan docs win.
3. Keep Opus usage low. You write the tests and contracts, review, run the gate
   and commit. **Codex writes implementations** (`mcp__codex__codex` for one
   packet; `codex exec` in git worktrees for several at once). The **local
   Ollama model** (`mcp__ollama__ask_local`) does mechanical text work. If
   Codex or the local model is unavailable, follow the fallback ladder in
   AGENTS.md (Claude subagents on Sonnet/Haiku) instead of stopping. GSD stays
   on the `budget` profile. Keep replies to the owner short.

## Start of every session

1. **Onboarding check.** If `.planning/PROJECT.md` or `.planning/ROADMAP.md` is
   missing, GSD was installed but never onboarded: run `/gsd-onboard` (it maps
   the codebase with parallel agents, reads existing docs and asks the owner
   about goals), then continue below. Do not invent goals — and do not treat
   GSD's ROADMAP as authoritative over `CHECKLIST_PHASE_PLAN.md` /
   `NEXT_SESSION_PLAN.md` even after onboarding.
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

Pick the next open item in `CHECKLIST_PHASE_PLAN.md` order (current phase
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
   3. Implementation to Codex in a worktree (`superpowers:using-git-worktrees`).
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
  completion status) — see AGENTS.md Rule 4; write a destructive schema
  migration; build a live AIMS integration, login, or scraper.

## Keeping this command current

Edit this file when the owner asks, or when a session shows a step is wrong,
missing or obsolete. Rules for every agent belong in `AGENTS.md`; where the
work stands belongs in `.planning/STATE.md` — never here. Replace the step a
change supersedes instead of appending beside it, and commit it on its own
(`chore(continue): …`).

Start now with "Start of every session".
