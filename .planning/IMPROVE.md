# Improvement mode

A standing way of working, not a phase. Ported from DD-Project-GameMaker and
shelf-and-sword (2026-10-17) and adjusted to this web app and the owner's decisions in
`DECISIONS.md` (IM1–IM15).

**Plain version:** the owner opens a session, types `/continue_CAPSTONE-USLS-MVP`, and leaves
it running. Agents work on branch `v5.2-migui_again`, one small commit per fix or feature,
each with its test and, for anything visual, screenshots. The owner reviews `BOARD.md` when
free and says which commits to merge into `v5.1-migui_clean`. There is no cap on unreviewed
work (IM11); every commit can be reverted on its own.

## Inputs (in this order)

1. **Red gate**: a failing unittest, a failing Playwright walkthrough, or a frontend build error.
2. **`ISSUES.md` rows** with status `open` or `confirmed`, highest severity first
   (this includes `DEFENSE_REVISIONS.md` section J, copied in as I-rows).
3. **Consistency findings** (`consistency:` rows from the sweep below; IM24).
4. **The current `ROADMAP.md` phase** (foundations → walkthroughs → section J → backend split
   → design system → performance/cleanup, IM8).
5. **Cheap ideas** from `IDEAS.md` (IM13 definition), only when 1–3 are empty.
6. **Bug-hunt findings with evidence** (below).

Not inputs: "could be better" with no evidence, new features that are not cheap (they go to
`IDEAS.md`), anything in `Documents/CAPSTONE_ONLY/CAPRIT2 OLD/`, stakeholder-blocked items.

## The cast and the limits

- **Architect, reviewer, integrator: the main (Opus) session.** Writes the failing test and
  the contract, reviews every packet, merges, runs the gate. Never reviews code it wrote.
- **Implementers: Sonnet subagents**, each in its own worktree at
  `E:\Github_Projects\CAPSTONE-USLS-MVP-wt\<short>`. **At most 3 at once** (IM10), only if their
  file sets do not overlap. While `app.py` is still one file, only **one** packet at a time
  may edit it; frontend and test packets can run beside it.
- **Mechanical text: the local model** (Ollama), or a Haiku subagent if Ollama is down.
- **Read-only research or audit agents** are not capped.
- **WIP cap: 4** open packets (specified, in flight, or waiting for review).
- **Drop to 1 implementer** after a regression, a red gate after a merge, or a merge that
  needed manual conflict resolution. Back to 3 after one clean wave.
- **Packet size:** one behaviour per packet, about 300 changed lines and about 5 files at most
  (mechanical moves in the backend split may be larger, but one module per packet). A packet
  that needs "and" is split.
- **Siblings rule:** a fix for one instance of a repeated pattern searches for the others and
  fixes them all, or lists each as its own `ISSUES.md` row.

## The loop

One fix or feature per pass.

0. **Preflight.** Read `STATE.md`, `BOARD.md`, `ISSUES.md`. Confirm the gate is green on
   `v5.2-migui_again`, no `.planning/IMPROVE_STOP` file exists, and usage is below 80% of the
   window and week. If not, stop and report in 5 lines.
1. **Pick** the top input. A question only the owner can answer becomes a `QUESTION` row in
   `ISSUES.md` and a line under "Waiting on you" in `BOARD.md`; pick the next input.
2. **Test first.** Write the failing check (AGENTS.md Rule 1): a unittest for backend
   behaviour, a Playwright step for anything in the browser. Add a `REGRESSION.md` row for a
   bug. Run it; it must fail for the right reason.
3. **Delegate.** Write the contract and hand implementation to a Sonnet subagent in a
   worktree. Pilot one packet before a batch of similar ones.
4. **Review** (main session, evidence in the commit message):
   1. Run the targeted test and the gate yourself. A report that says "green" is not evidence.
   2. Check each Done-when clause with a pointer (file:line, test name, screenshot).
   3. Could the new test fail? Revert the fix or flip the key line and watch it go red.
   4. List any removed or changed assertions by name and justify each.
   5. Open every changed screenshot at 1366, 1920 and 390 px (IM15).
   6. The walkthrough reaches the feature through the real UI, not by calling the API directly.
   7. Sibling sweep: grep other uses of the changed pattern; run the `REGRESSION.md` rows for
      the two nearest areas.
   8. Diff hygiene: no stray `console.log`/`print`, no secrets, nothing outside the packet's file list.
   9. Fix small findings in the same pass; bigger ones become new `ISSUES.md` rows.
5. **Merge** to `v5.2-migui_again` as one commit: code, test, `REGRESSION.md` row.
6. **After every merge** (not once after several): re-run the gate on the merged tree. If red,
   revert at once and log it in `ISSUES.md`.
7. **Record.** Update `STATE.md`, `BOARD.md` and `ISSUES.md`. For a visual change, add the
   screenshot paths to the BOARD entry so the owner can review without running the app.
8. **Stop check** (below), then loop.

## Bug hunt (bounded, evidence only)

One pass after every 3 merged commits. **At most 5 findings filed per pass.** An empty pass
is a correct result. Three empty passes in a row with an empty queue: stop and report.

Methods:
0. **Consistency sweep (owner decision IM24 — do this every pass, it is the owner's top concern).**
   Pages of the same kind must look and behave the same. Group the app's pages by kind and compare them
   feature by feature, through the real UI, for every role that sees them:
   - process/workflow boards (Leave of Absence, Readmission, AWOL & Residency, Withdrawal, the WorkflowPage
     boards such as Graduation, Practicum, Research Gate);
   - role homes (student, staff, coordinators, dean, faculty — all on `RoleHome`);
   - request/submission forms; list pages with tables; record/detail pages; decision dialogs; history panels;
     report pages; the assistant pages.
   For each group, check: same layout and component library pieces; same controls (view toggle, filters, search,
   batch actions, export, drag / "Move to…"); same states (loading, empty, error, locked); same wording for the
   same thing; same sizes at 1366/1920/390. **Any difference with no visible policy reason is a finding.**
   Worked example (I-049, 2026-10-17): Leave of Absence and Readmission cards could be dragged but some AWOL &
   Residency cards could not, and nothing on the card said why (they were waiting on the student). The fix is
   never "make AWOL different" — it is "make every board show why a card is locked". A difference that policy
   requires stays, but it must be visible on the page.
   Write each finding as an ISSUES.md row tagged `consistency:` with both pages named, and keep
   `.planning/phases/05-design-system/board-parity.md` (and a parity table per page group) current.
1. Run the Playwright walkthroughs for every role; any console error, failed request, page
   wider than the viewport, or text overflow is a finding.
2. Open the screenshot set at all three widths; compare pages that should look alike.
3. Static sweeps for known bug classes in this code: role checks that differ between sibling
   routes; status strings typed by hand instead of the shared constants; N+1 queries in
   list endpoints; date logic that uses "today" where the recorded date should be used
   (section J3 class); state that survives a demo reset (J7 class).
4. The sibling sweep for any bug fixed since the last pass.

**Evidence rule:** every finding carries a failing test, a log line, or a screenshot path,
and becomes an `ISSUES.md` row. No evidence, no row. Findings are fixed in later passes.

## Stop conditions

Stop dispatching, report in 5 lines, and wait for the owner when any of these is true:

1. The gate is red at the start of a pass and the cause is not obvious.
2. A regression from the previous wave is found in two waves in a row. Switch to
   stabilisation: only regressions and repairs until a wave is clean.
3. The same bug class shows up a second time: fix the class, add a guard, then ask.
4. Any "done" is later found not done. Re-review the last 10 done rows before new work.
5. The queue is empty apart from items that need the owner.
6. Usage above 80% of the window or week. Do not start a wave you cannot finish and verify.
7. An agent wants to change a rule or process. Only the owner changes process.
8. `.planning/IMPROVE_STOP` exists, or the owner types stop.

There is **no** stop for "too many unreviewed changes" (IM11).

## How the owner starts and stops it

1. Open a session in `E:\Github_Projects\CAPSTONE-USLS-MVP`.
2. Type `/continue_CAPSTONE-USLS-MVP`. Leave the session open and the PC awake.
3. To stop: type `stop`, or create an empty file `.planning/IMPROVE_STOP`.
4. When back: open `.planning/BOARD.md`, look at the "Ready for your review" list and its
   screenshots, answer "Waiting on you", and say which commits to merge into `v5.1-migui_clean`.

---
*Created 2026-10-17 from DD-Project-GameMaker `IMPROVE.md` and shelf-and-sword's process rules.*
