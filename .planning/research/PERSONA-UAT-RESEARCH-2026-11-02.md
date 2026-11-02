# Persona user-testing agents (I-142, 2026-11-02)

Owner: "a user tester like multiple kinds ... human like or as if they are the role".

## Verdict
Persona-driven browser agents find confusing wording, dead ends and inconsistency before real testers arrive. Every
source treats them as a pre-pass, not a replacement for real users. Build one `persona-uat` skill; calibrate it against
Wednesday's real UAT.

## Evidence
- UXAgent (CHI EA 2025): personas from a demographic mix browse real pages; logs actions plus think-aloud-like
  reasoning; agents can be interviewed after. Authors: refine studies before real sessions. arxiv.org/html/2504.09407v2
- PersonaTester (FSE 2026): personas on testing mindset, exploration strategy, interaction habit; more bugs than the
  same agent without persona (mobile examples). arxiv.org/pdf/2603.24160
- Synthetic Cognitive Walkthrough (CHI '26): LLM walkthroughs complete tasks better than humans, so under-report
  navigation problems. arxiv.org/pdf/2512.03568
- Persona Test skill: 8-12 Plan/Act/Reflect steps, screenshot per step, patience budget, abandonment threshold, P0-P3
  with confidence >= 0.6 kept, first-person debrief. claudskills.com/skills/persona-test/SKILL.md (source repo unconfirmed)
- Limits: synthetic users push through friction real people stop at (Userbrain, n=5); NN/g found them too positive and
  shallow (second-hand); agents miss that a task is done (GUITester arxiv.org/html/2601.04500v1).
- Tools: Playwright (installed), browser pane MCP, Claude-in-Chrome, Agent tool — nothing new to install.

## Design: `.claude/skills/persona-uat/`
- `SKILL.md`, `personas/<role>-<n>.md`, small `run-persona.mjs` (login, screenshot per step, console/network errors).
- **Card:** role + demo account; background and tech skill; patience budget (gives up after 3 failed attempts or 12
  steps); device (390 phone / 1366 laptop) and accessibility (keyboard only, 200% zoom); reading style; mood; 3-4 tasks
  written as goals, never click paths.
- **Starter set (one per role):** student new to the rules (Policy Assistant, enrollment, withdrawal); student on leave
  (what AWOL means for them); thesis student (defense schedule); rushed GS Staff at term end (import, report); Dean on a
  phone (approve + export graduation batch); faculty adviser who rarely logs in (pending items, My Calendar);
  non-technical coordinator (schedule a defense, invite panel); admin.
- **Run:** main session seeds and starts a local server; one Sonnet subagent per persona (max 3 at once) drives
  Chromium; acts only on what is on screen, never reads source or calls the API, gives up honestly, stays on localhost.
- **Log:** `step | looking at | expected | did | result | feeling (ok/unsure/lost/annoyed)` + screenshot.
- **Score per task:** success (done / with help / failed), steps vs shortest path, confusion count, wording problems,
  accessibility, consistency with same-kind pages (IM24), console errors.
- **Findings:** one file per persona in the scratchpad; main session de-duplicates against ISSUES.md and files
  `audit: persona-uat <persona>` rows (failed = P1, detour = P2, wording = P3); confidence < 0.6 stays in the report.
  Every BUG reproduced by hand or a Playwright test first (REGRESSION.md row).
- **Cost (estimate):** 8-15 min per persona; full 8-persona sweep in batches of 3 about 30-45 min.
- **After UAT:** compare where real testers got stuck vs agents; tune cards; agent success = upper bound on real success.
