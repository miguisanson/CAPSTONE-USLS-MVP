# State

## Current Position (2026-10-01, unattended run — owner away ~12 h)

- **Branch:** `v5.1-migui_clean` (pushed). Base commit of the run: `85c32b7`.
- **Work queue:** `DEFENSE_REVISIONS.md` (owner decisions of 2026-10-01 at top).
- **Rung used:** Claude subagents (Sonnet; Opus for the proposal XML) instead of
  Codex, because Codex's sandbox cannot run the tests and nobody is here to
  unblock it. Main session = architect: briefs, merges, gate, live check.

### Progress (updated as work lands)

Merged and pushed: health, monitor, portals, opsmanual, panel, docs, policy, rules,
research-core, crosscut, academic, docs2, loa. Gate at the LOA merge: 412 tests, all
green after two test expectations were aligned (report now lists LOA cases; years in
program use the academic-year count). Live check: LOA board drag-and-drop really moves
a card and runs the guarded step (headless Edge, `E:/Temp/claude/usls-check/dnd.py`).

Running (worktrees under `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/`):

| Branch | Job |
|---|---|
| `pkt/calendar` | Availability, adviser appointment, calendars, invitations, notifications, private .ics (resumed after a rate limit; has WIP commits) |
| `pkt/polish` | Undefined identifiers, live-check polish, Ops Manual as Draft policy doc, monitoring stubs, drop rule on all paths, rules metadata sync, LOA running semester, demo reset button, a11y sweep, stale workflow descriptions, breadcrumb names |
| `pkt/docs3` | Proposal ch. 5–6 + Appendices V/W/Y/Z regenerated from code (`scripts/docs/sync_proposal_inventories.py`) |

Then: merge calendar, polish, docs3 (gate after each); re-run the proposal pipeline on the
final code (see `PROPOSAL_EDIT_NOTES.md`); walkthrough rewrite re-walked in the live app with
fresh screenshots (also Appendix U screenshots); README/CHANGELOG; final gate + live check; push.

## If this session died

`git worktree list` shows what exists. A `pkt/*` branch with commits ahead of
`v5.1-migui_clean` is finished work waiting to be merged; a worktree with
uncommitted changes is half-done — read its diff, run its tests, then decide.

## Not obvious from the code

- No Word, LibreOffice or pandoc on this machine: `.docx` files cannot be
  rendered here. Page numbers/TOC in the proposal update when opened in Word.
- `.venv` was rebuilt on Python 3.14 on 2026-09-30.
- Gate baseline before the run: 80 tests, 2 known failures.
