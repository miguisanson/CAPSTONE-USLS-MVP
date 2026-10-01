# State

## Current Position (2026-10-01, unattended run — owner away ~12 h)

- **Branch:** `v5.1-migui_clean` (pushed). Base commit of the run: `85c32b7`.
- **Work queue:** `DEFENSE_REVISIONS.md` (owner decisions of 2026-10-01 at top).
- **Rung used:** Claude subagents (Sonnet; Opus for the proposal XML) instead of
  Codex, because Codex's sandbox cannot run the tests and nobody is here to
  unblock it. Main session = architect: briefs, merges, gate, live check.

### Handover (2026-10-01, paused by the owner)

Branch `v5.1-migui_clean` is the whole state — committed and pushed, in sync with GitHub.
All `pkt/*` helper branches were merged and deleted; temporary worktrees removed
(`E:/Github_Projects/CAPSTONE-USLS-MVP-wt/monitor` is a leftover locked folder, safe to delete
after a reboot). To run it: see README (`npm run setup`, then `npm run dev`; demo password
`DemoPass123!`). The work queue for whoever continues: `DEFENSE_REVISIONS.md` section J, then
the "Next session" list below.

### Progress (2026-10-01 11:00)

Everything is merged into `v5.1-migui_clean` and pushed, including the walkthrough.
Full gate on the final code: 591 tests; the only failure was a randomly-seeded test
(fixed in 6ade188, verified with three hash seeds). Frontend build passes.

Next session: section J of `DEFENSE_REVISIONS.md` (13 bugs found while re-walking the
demo + re-capture walkthrough cases 9 and 18), then re-run `scripts/docs/rebuild_proposal.py`
so the proposal reflects the last merges, and refresh the proposal's Appendix U screenshots
from `Documents/CAPSTONE_ONLY/walkthrough_screenshots/`.

## If this session died

`git worktree list` shows what exists. A `pkt/*` branch with commits ahead of
`v5.1-migui_clean` is finished work waiting to be merged; a worktree with
uncommitted changes is half-done — read its diff, run its tests, then decide.

## Not obvious from the code

- No Word, LibreOffice or pandoc on this machine: `.docx` files cannot be
  rendered here. Page numbers/TOC in the proposal update when opened in Word.
- `.venv` was rebuilt on Python 3.14 on 2026-09-30.
- Gate baseline before the run: 80 tests, 2 known failures.
