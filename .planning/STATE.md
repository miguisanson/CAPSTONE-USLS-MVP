# State

## Current Position (2026-10-01, unattended run — owner away ~12 h)

- **Branch:** `v5.1-migui_clean` (pushed). Base commit of the run: `85c32b7`.
- **Work queue:** `DEFENSE_REVISIONS.md` (owner decisions of 2026-10-01 at top).
- **Rung used:** Claude subagents (Sonnet; Opus for the proposal XML) instead of
  Codex, because Codex's sandbox cannot run the tests and nobody is here to
  unblock it. Main session = architect: briefs, merges, gate, live check.

### Progress (updated as work lands)

Merged into `v5.1-migui_clean` and pushed: `pkt/health`, `pkt/monitor`, `pkt/portals`,
`pkt/opsmanual`, `pkt/panel`, `pkt/docs`, `pkt/policy`, `pkt/rules`. Full gate after
`pkt/rules`: **229 tests, 0 failures**; frontend build passes; headless-Edge live check
of student / dean / faculty / staff pages: no page errors (see `LIVE_CHECK_NOTES.md`).

Running (worktrees under `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/`):

| Branch | Job | Based on |
|---|---|---|
| `pkt/research-core` | Research flow defects from `audit/research-workflows.md` | da33011 |
| `pkt/crosscut` | Cross-cutting defects from `audit/cross-cutting.md` | 793e0c3 |
| `pkt/loa` | LOA + Readmission rebuild (case table, real drag-and-drop board) | 7a8e6e7 |
| `pkt/academic` | Enrollment / class list / offerings / residency fixes | 7a8e6e7 |

Next after those: adviser appointment + availability editor + calendar pages
(from the research audit's requirements list, after `pkt/research-core` merges);
polish items in `LIVE_CHECK_NOTES.md`; then documents (section I of
`DEFENSE_REVISIONS.md`): walkthrough rewrite, proposal ch. 5–6/appendices and the
Business Rules section (re-run `scripts/docs/build_proposal.py` afterwards),
regenerate the Operations Manual "platform differences" paragraphs from the final
rules, add the Operations Manual draft to the policy library as a Draft document.

## If this session died

`git worktree list` shows what exists. A `pkt/*` branch with commits ahead of
`v5.1-migui_clean` is finished work waiting to be merged; a worktree with
uncommitted changes is half-done — read its diff, run its tests, then decide.

## Not obvious from the code

- No Word, LibreOffice or pandoc on this machine: `.docx` files cannot be
  rendered here. Page numbers/TOC in the proposal update when opened in Word.
- `.venv` was rebuilt on Python 3.14 on 2026-09-30.
- Gate baseline before the run: 80 tests, 2 known failures.
