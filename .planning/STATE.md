# State

## Current Position (2026-09-30)

- **Branch:** `v5-myrine-revisions` (HEAD `9f0a182`). Nothing committed this session.
- **Done this session:**
  - Dev kit installed: `AGENTS.md`, `CLAUDE.md`, `.planning/config.json`,
    `.claude/commands/continue_CAPSTONE-USLS-MVP.md` (restored from commit
    `c7b0d19` on `v4.2-migui`, then pointed at the post-defense priorities),
    `.gitignore` GSD block.
  - `DEFENSE_REVISIONS.md` written — the panel's revisions from the 2026-08-07
    defense, what is built, what is open, and what is waiting on USLS.
  - `.venv` rebuilt on Python 3.14 (old one pointed at a removed Python 3.12).
  - Gate run: 80 tests, 78 pass, 2 fail (DEF-001 demo-reset fixture; a
    date-dependent withdrawal test — see `DEFENSE_REVISIONS.md` C6).
- **Uncommitted in the working tree (owner's changes, not mine):** the old
  `Documents/CAPSTONE_ONLY/*` content was moved into `CAPRIT2 OLD/` (shows as
  ~140 deletions + one untracked folder), two `.docx` files modified, and
  `[CAP-IT1] Overall Document.docx` + `CAP-2521-IT-CAP1DEF.docx` added.
- **GSD not onboarded yet** (`.planning/PROJECT.md`, `ROADMAP.md` missing) —
  the first `/continue_CAPSTONE-USLS-MVP` runs `/gsd-onboard`.

## Exact next action

1. Owner answers the WAITING items in `DEFENSE_REVISIONS.md` (E0 revised
   document from Khloe; C1 which policy values are right; G stakeholder docs).
2. Buildable now without the owner, in this order: C6 (time-bomb test), B1
   (RAG folder path), B2 (upload → answer test), D5 (startup overwrites faculty
   expertise), D1/D2 (panel scores), B6 (housekeeping).

## Not obvious from the code

- The page numbers on the defense form (pp. 213, 365, 378) do not match the
  proposal file in the repo — a newer revised document exists somewhere else.
- The handbook and the system disagree on withdrawal window, LOA length, and
  whether LOA counts toward maximum residence.
- There is no `pandoc` on this machine; Word files are read with a stdlib
  `zipfile` + XML script.
