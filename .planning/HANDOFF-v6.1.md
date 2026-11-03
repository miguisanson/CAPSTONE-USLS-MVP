# Handoff — branch `v6.1-migui` (2026-11-02 → 2026-11-03)

For the next developer. Branch `v6.1-migui` was cut from Natalie's `v6.0-natalie` (80dd1aa) and is the one line for
User Acceptance Testing (UAT) from Wednesday 2026-11-04. ~150 commits; outside `archive/` and `Documents/`: ~320 files,
+22.8k / -8.2k lines. Owner decisions for this run: IM28–IM33 and AD10–AD12 in `.planning/DECISIONS.md`. Every finding
is a row in `.planning/ISSUES.md` (I-134 … I-217). Where work stands right now: `.planning/STATE.md` (top section).

## Start here
1. Read `AGENTS.md` (rules: test first, never weaken a test, AIMS data read-only, one `app.py` editor at a time),
   `CLAUDE.md`, `README.md`, `UAT.md`.
2. Setup: `npm run setup` (venv, frontend, build, seed). Run: `npm run dev` (local) or `npm run uat` (production-style,
   waitress + ProxyFix, used behind the Cloudflare Tunnel). Reset data: `npm run seed`.
3. Tests: Python `.venv/Scripts/python.exe -m unittest discover -s tests -p "test_*.py"` (~36 min on the PC);
   browser walkthroughs `npm run e2e` (~15 min). Run e2e only in a separate worktree/checkout from where anything else
   runs (it wipes `frontend/e2e-artifacts`). Set `GOOGLE_API_KEY=` empty for tests.
   Faster: the owner's Mac runs both (`bash E:/Github_Projects/dev-kit/workers/pc/run-job.sh --worker mac
   CAPSTONE-USLS-MVP <dir>` ~17 min; `... CAPSTONE-USLS-MVP-e2e <dir>` ~10 min). Last full results are in STATE.md.
4. Design rules for the frontend: load `.claude/skills/ui-ux-pro-max`; `cd frontend && npm run check:ui -- --strict`
   must stay all zeros.

## What changed on this branch
**Natalie's Google Calendar integration (v6.0) — reviewed and hardened.** A defense no longer blocks its own panelists;
deferral/cancel remove events; PATCH after 404 recreates; expired Google login (`invalid_grant`, every 7 days while the
Google app is in Testing mode) shows "Reconnect"; Google errors never fail a booking; fixed event ids, private events;
both scopes required; "only your main calendar counts" note. `.env` keys: see `.env.example` (GOOGLE_CALENDAR_*).

**UAT / public site.** `scripts/serve_uat.py` (`npm run uat`), `UAT.md` runbook (Cloudflare Tunnel to
https://miguisanson.dev, Google Cloud steps, re-seed the morning UAT starts), `.env.example`, `npm run setup:env -- --uat`.
Hardening: `DEMO_SHOW_ACCOUNTS=0` hides demo logins, demo reset staff/admin only, `ASSISTANT_MAX_PER_HOUR`,
`MAX_UPLOAD_MB`, `env_int/env_float` (empty env = unset), security headers, SQLite WAL + busy_timeout, private
`DEMO_PASSWORD` for the seed (see STATE.md for whether that packet landed), demo accounts cannot change passwords,
session-expiry redirect.

**Process logic (audit vs Handbook: `.planning/research/PROCESS-LOGIC-AUDIT-2026-11-02.md`).** Withdrawal demo window
dated from the seed day; Dean practicum return goes back to the Coordinator (AD11) and stays visible to the Dean;
re-confirm runs booking checks; booked manuscript cannot be deleted; stuck withdrawals auto-close; AWOL only after a
leave ends + grace; AWOL return restores the stage; readmission vs leave extension exclusive; graduation needs
enrollment (Handbook s3.11); AWOL/on-leave students blocked from research/adviser/verdict/practicum steps; Form 7 score
checks; late subject removal goes through Withdrawal; full-name student search; one Manila clock (`ph_today()`,
frontend `todayISO()`); admin acts as staff on every board. Policy questions left for the Graduate School: I-167, I-170,
I-174 (do not build without an answer).

**Same-kind pages behave alike (owner's top concern, IM24; `research/CONSISTENCY-PROCESSES-2026-11-02.md`).** One
`StepDialog` for every approve/return; `BoardNotice` (one message place), `SkeletonBoard`, motion tokens (CSS only,
reduced-motion respected); one `Tabs`; Dean Graduation on the shared board; every board becomes a stage-grouped card
list on phones; dashboard tasks open boards filtered `?show=open`; student requests confirm before sending and keep
"Request sent"; Research Gate overview list (AD12); "Discard your changes?" guard; Dean decision footer pinned.

**Reports & Analytics redesign (AD10, `research/REPORTS-SPEC-2026-11-02.md`).** Real stage clock
(`StudentStageEvent`), 6-tile summary strip with comparisons, Needs attention / Where students get stuck / Office speed /
Records to fix, Dean tabs (waiting, decision speed, outcomes, graduation pipeline, students by stage), every number opens
its students, Excel/PDF export, period filter (default last 12 months), seeded report history (two earlier terms).
Endpoints: `/api/reports/summary|attention|stages|records-to-fix|decisions|cycle-times`.

**Panel's defense comments.** Panel matching ranks every demo paper differently (each research student has its own
title/concept papers) and shows "No paper on file" instead of fake scores; the Policy Assistant answers only from the
Handbook, Research Protocol, draft Operations Manual and uploads, with per-role wording; drop/AWOL questions find their
rules.

**Documents and tools.** Walkthrough rebuilt in the team's demo order with presenters
(`Documents/CAPSTONE_ONLY/CAP-2521-IT-WALKTHROUGH.docx`; Reports case needs a re-capture). Persona tester skill
`.claude/skills/persona-uat` (human-like testers per role). Reviews: `research/FULL-REVIEW-2026-11-03.md` (Fable).

## Open work (most important first)
1. (Done: the last backend packet `pkt/fable1` — DEMO_PASSWORD, report tile texts,
   roster access, x_host=0, CSV escape — is merged; re-seed with DEMO_PASSWORD set.)
2. ISSUES.md rows still `open`: I-207 (sidebar numbering — owner's call), I-208 (Mac e2e font/pixel checks), I-214..
   I-217 leftovers (Gemini citations/injection delimiters/panel-matching cache, faculty .ics, raw dates in
   FacultyVerdicts/FacultyResearchWorkspace), I-167/I-170/I-174 (Graduate School questions).
3. Re-capture walkthrough case 20 (Reports) with `scripts/docs/walkthrough/capture_walkthrough.py`, then rebuild.
4. Before UAT the owner must: Cloudflare login + Access, Google client ID/secret in `.env`, testers as Google test
   users, `DEMO_PASSWORD` in `.env`, then `npm run build:web`, `npm run seed`, `npm run uat`.

## Things that bite
- `app.py` is ~39k lines: Grep, never read whole; only one change set touching it at a time (merge conflicts).
- Seed dates are relative to the seed day; tests must read data at test time, not hard-code dates/counts
  (`frontend/e2e/DATA-OWNERSHIP.md`: one writer per record, `// e2e-writes:` header required).
- Never stop processes by name (`taskkill /IM python.exe`): other test servers may be running.
- Never read or commit `.env`, `uploads/`, `*.sqlite3`.
