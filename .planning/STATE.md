# State

## Current Position (2026-10-01, unattended run — owner away ~12 h)

- **Branch:** `v5.1-migui_clean` (pushed). Base commit of the run: `85c32b7`.
- **Work queue:** `DEFENSE_REVISIONS.md` (owner decisions of 2026-10-01 at top).
- **Rung used:** Claude subagents (Sonnet; Opus for the proposal XML) instead of
  Codex, because Codex's sandbox cannot run the tests and nobody is here to
  unblock it. Main session = architect: briefs, merges, gate, live check.

### Wave 1 — running in worktrees under `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/`

| Worktree / branch | Job | Status |
|---|---|---|
| `rules` / `pkt/rules` | Business-rules register, handbook values, drop rule, C6 test | running |
| `policy` / `pkt/policy` | Finish policy upload (B1–B6), assistant for all roles | running |
| `panel` / `pkt/panel` | Panel matching by real similarity, expertise records (D1–D6) | running |
| `monitor` / `pkt/monitor` | Monitoring Sheet CRUD in the portal | running |
| `portals` / `pkt/portals` | Dean / Student / Faculty portals on the shared sidebar shell | running |
| `health` / `pkt/health` | Old red test, sign-in / DEMO_MODE, access-control sweep, README | running |
| `docs` / `pkt/docs` | Proposal pagination, TOC, wording fixes | running |
| `opsmanual` / `pkt/opsmanual` | Draft Operations Manual for stakeholder validation | running |

Read-only audits writing to `.planning/audit/`: `academic-workflows.md`,
`research-workflows.md`, `cross-cutting.md` — running.

Each helper follows `.planning/PACKET_BRIEF.md` and commits on its own branch.

### Next (after Wave 1 merges)

1. Merge `pkt/*` one at a time into `v5.1-migui_clean`; after each: targeted
   tests, then the full gate, `npm --prefix frontend run build`, commit, push.
2. Wave 2 packets: LOA + Readmission rebuild (from `audit/academic-workflows.md`),
   defense calendar + adviser appointment (from `audit/research-workflows.md`),
   fixes for critical/high audit findings.
3. Documents: Business Rules section + counts in the proposal, walkthrough
   renumbering and new cases, import the Operations Manual draft into the policy
   library as a Draft document.
4. Live check in the browser (launch config `usls-gs-win`, port 5050) per role.
5. Remove worktrees, final push, update this file.

## If this session died

`git worktree list` shows what exists. A `pkt/*` branch with commits ahead of
`v5.1-migui_clean` is finished work waiting to be merged; a worktree with
uncommitted changes is half-done — read its diff, run its tests, then decide.

## Not obvious from the code

- No Word, LibreOffice or pandoc on this machine: `.docx` files cannot be
  rendered here. Page numbers/TOC in the proposal update when opened in Word.
- `.venv` was rebuilt on Python 3.14 on 2026-09-30.
- Gate baseline before the run: 80 tests, 2 known failures.
