---
name: intelligence-layer
description: >
  Generic model-orchestration layer: the strongest available model acts as
  architect and QA while cheaper, appropriate models (subagents or the Codex
  CLI) execute the individual tasks. Works for any multi-step job — code,
  content, research, migrations — not just codebase audits. Use when the user
  says "intelligence layer", "orchestrate this", "use cheap models for the
  grunt work", "architect and QA this", "delegate but check the work",
  "war-game this", "war-game mode", or "shepherd-style execution", or wants
  cost-efficient delegation with quality gates, move-by-move failure
  planning for risky tasks, or checkpointed/reviewable execution. For the full
  audit-a-codebase workflow, prefer the diagnose-plan-execute skill (it builds
  on these rules).
argument-hint: "[task description]"
version: "2.0"
license: MIT
---

# Intelligence Layer

> **Version 2.0** (2026-07: war-game + shepherd-control upgrade). Bump the
> `version` field on any behavioral change. Dependent skills (e.g.
> video-editing-pipeline) pin against the major version: if they expect a
> different major or this skill is missing, they must warn the user and fall
> back to inline execution instead of delegating.

Split every job into THINKING (expensive, rare) and TYPING (cheap, plentiful).
The strongest model does all the thinking — architecture, task design, review,
integration. Cheaper models do bounded, well-specified execution. Quality
comes from the gate, not from hoping the executor is smart.

## Roles and tier selection (resolve at runtime; never hardcode model names)

| Role | Who | Duties |
|------|-----|--------|
| **Architect / QA** | The session's model — must be the strongest in the current lineup (tell the user to switch via /model if not) | Decompose the job, write task cards, choose executors, review every deliverable against its acceptance criteria, integrate, ship. QA is NEVER delegated below this tier. |
| **Executor: standard** | Workhorse tier, one below architect (today a "sonnet"-class model, via the Agent tool `model` param) | Implementation tasks with judgment inside a bounded scope: write the feature, draft the document, build the analysis. |
| **Executor: mechanical** | Fastest/cheapest tier (today a "haiku"-class model) | Zero-judgment work: bulk renames, format conversions, list gathering, boilerplate from an exact template, search sweeps. |
| **Executor: external** | Codex CLI (`codex exec --full-auto -C <dir> "<card>"`), if installed & logged in (`codex --version`) | Alternative standard executor — useful when subagent quota is tight, for second opinions, or when the user prefers it. Reads AGENTS.md automatically. |
| **Executor: local (free)** | Ollama models through the Codex harness: `codex exec --oss --local-provider ollama -m <model> --full-auto -C <dir> "<card>"` — check `ollama list` for installed models | Zero-API-cost execution: well-bounded low-risk cards, bulk piecework, quota outages, or when the user wants the run free. Match model size to card difficulty (≈14B coder for real implementation, ≈12B for text/docs, 3–4B only for trivial transforms). For text-only piecework touching no files, pipe directly: `ollama run <model> "<prompt>"` and apply the output yourself. |

Escalation ladder: local fails ONCE → standard (local models are the weakest
tier; don't burn retries). Mechanical fails → standard. Standard fails twice
on the same card → architect does it directly (or Codex as a second opinion
first). Never solve a bad task card by throwing a bigger model at it —
rewrite the card. Local-executor cards need the tightest specs of all:
prefer single-file changes and fully enumerated steps.

## The loop

1. **Intake (architect):** restate the goal, list constraints, identify what
   is irreversible (deploys, sends, deletes) — those steps stay with the
   architect or get an explicit user go-ahead.
2. **Decompose (architect):** task cards sized for one executor session. Each
   card: objective, exact inputs (paths, data, links), numbered steps with all
   ambiguity resolved, "do not" boundaries, and **acceptance criteria that are
   observable** (a command with expected output, a fixture with expected
   numbers, a DOM state — never "should work correctly").
3. **Dispatch:** pick the cheapest tier that can plausibly pass the acceptance
   criteria. Prompt = card + environment notes + lessons ledger + "commit/save
   locally, do NOT push/send/publish; report each criterion with pass/fail
   evidence; flag anything ambiguous instead of guessing." Run executors in
   the background; dispatch independent cards in parallel, dependent ones in
   sequence.
4. **QA gate (architect, never skipped):**
   - Diff/deliverable review: everything traces to the card; no scope creep.
   - Independently re-verify acceptance criteria — actually run the thing.
     Executor self-verification is a claim, not evidence; "verified by code
     trace" means unverified. UI changes get a real browser click; APIs get
     real requests; documents get read in full.
   - Test failure paths, not just the demo path.
   - Never mark a task complete on model confidence alone — completion
     requires observable evidence of the appropriate kind: tests passed,
     files changed as intended, output matches constraints, citations
     support claims, visual/design criteria met, links work, and no
     unintended scope expansion occurred.
5. **Fix or bounce:** trivial gaps the architect patches (labeled as
   review fixes); real misses go back with the failing evidence attached.
6. **Ship & log:** architect performs the irreversible step (push, publish,
   send). Update the task list. Add any caught defect to the **lessons
   ledger** — one line each — and prepend the ledger to every future
   executor prompt. The ledger is how cheap models get "smarter" over a run.
   Promote a lesson only if it is evidence-backed, reusable, specific, and
   likely to improve future performance — do not log every detail.
7. **Report:** after each shipped card — what shipped, what QA caught, what's
   next. At the end — totals, defects caught, anything left for the user.

## War-Game Mode (upgrade — use selectively)

For tasks with meaningful uncertainty, dependencies, technical risk,
irreversible actions, or many plausible failure paths, do not rely on a
linear plan. Before execution, the architect writes a **war-game**: a
move-by-move simulation of the task. Do NOT war-game simple tasks.

Each major move specifies:

- **action** — what the executor does
- **expected observation** — what success looks like
- **failure observation** — what failure looks like
- **likely cause** — the most probable reason for that failure
- **diagnostic check** — how to confirm the cause
- **countermove** — the pre-planned fix
- **verification method** — how to prove the countermove worked
- **rollback path** — how to undo this move
- **decision fork** — where routes branch and on what evidence
- **abort condition** — when to stop entirely

Branch logic on every move:

- IF expected observation appears → continue.
- IF failure observation appears → diagnose the likely cause, apply the
  countermove, then verify.
- IF the failure is outside the predicted branches → pause, reassess,
  and escalate to the architect (or user) rather than improvising blindly.

Purpose: preload execution intelligence so a cheaper, weaker, or later
executor can follow the path confidently. War-game moves slot directly
into task cards — the branches become the card's numbered steps and
"do not" boundaries.

## Shepherd-Style Execution Control (upgrade — use selectively)

When a task involves code changes, file operations, automation,
multi-step execution, or risky edits — anywhere traceability,
reversibility, supervision, branching, or review would materially
improve the result — wrap execution in a control layer. Do NOT use it
for every task.

If a Shepherd tool is available, use it as an optional execution-control
adapter. If not, emulate the pattern manually (git checkpoints, staged
files in a scratch area, run logs):

- **checkpoints** — pin state before each risky move (extends the
  existing restore-point rail to per-move granularity)
- **execution traces** — log what ran, what was observed, what was decided
- **staged outputs** — deliverables land in a staging area, not the final
  destination, until reviewed
- **review gates** — the architect's QA gate applies per stage, not just
  at the end
- **branching** — when multiple routes are plausible, run them as separate
  branches and compare before choosing
- **rollback / revert paths** — every stage has a known one-step undo
- **supervisor checks** — architect spot-checks long executor runs mid-flight
- **comparison before final acceptance** — diff staged output against the
  card and against pre-change state before shipping

## When to trigger each upgrade

| Task profile | Mode |
|---|---|
| Simple, low-risk | Normal loop only |
| Complex, uncertain, likely to fail in non-obvious ways | + War-Game Mode |
| Needs safe execution, staged review, rollback, branching, traceability | + Shepherd-style control |
| Complex AND high execution risk | Both |

Runtime loop for upgraded tasks:
Task → Recon → War-game (if needed) → Execute with control (if needed) →
Observe → Diagnose → Countermove → Verify → Deliver → Extract lesson (if useful).

## Cost discipline

- Architect time is for leverage: never have the strongest model do work a
  card could specify tightly enough for a cheaper one.
- Executor time is bounded: cards small enough that a failed dispatch is
  cheap to retry.
- Verification is the one place never to save money — a defect that ships
  costs more than every token saved on the run.

## Safety rails

- Executors never hold credentials, never push/deploy/publish/delete, never
  touch production data. Test against local/ephemeral fixtures.
- Before the first change: pin a restore point (git tag, backup copy) and
  tell the user the one-step rollback.
- If an executor's report conflicts with what you observe, trust the
  observation and say so in the run log.

## Pairings

- **diagnose-plan-execute**: the full codebase-improvement pipeline built on
  these rules — prefer it for "audit and fix my app" jobs.
- **ponytail** (if installed): add its ladder to executor prompts for
  minimal diffs, and review with an over-engineering eye.
