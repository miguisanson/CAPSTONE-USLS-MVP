# Merge checklist — `pkt/forms-ops` into `v6.1-migui` (2026-11-04)

For the integrating session ("Session progress report"). Written by the forms session at 08:25 before the 09:00 stop.
Tick every box; anything that does not match is a finding, not something to skip.

## 0. What the branch is

- Branch `pkt/forms-ops`, worktree `E:/Github_Projects/CAPSTONE-USLS-MVP-wt/forms`. Base `576cebd` (v6.1 at 07:17).
- Contains three merged packets: `pkt/fdocs` (forms pack), `pkt/fman` (Operations Manual), `pkt/fapp` (app wiring),
  plus the contract, the spec test, a privacy-screen wording fix and STATE notes. `git log --oneline 576cebd..pkt/forms-ops`.
- Files outside `Documents/USLS_Forms/` (46): `git diff --name-only 576cebd...pkt/forms-ops`.

## 1. Known overlap — the Documents reorganisation (resolve FIRST)

The shared checkout has an uncommitted reorganisation that moves:
`Documents/USLS_Forms/` -> `Documents/Graduate_School/Forms/` and the Operations Manual files + `operations_manual_rules.json`
from `Documents/CAPSTONE_ONLY/` -> `Documents/Graduate_School/Operations_Manual/`, and edits the same path constants in
`scripts/docs/forms/build_forms.py`, `scripts/docs/build_operations_manual.py`, `tests/test_operations_manual_content.py`,
`app.py` (different lines from ours). This branch still uses the OLD paths.

Recommended order:
- [ ] 1. Commit the reorganisation on v6.1-migui first (and `git fetch` + merge origin — Myrine pushes to v6.1).
- [ ] 2. `git merge --no-ff pkt/forms-ops`. Expect conflicts:
  - `Documents/USLS_Forms/*` flat files: theirs renamed them, ours deleted them and made chapter subfolders.
    Resolve: **keep ours (the chapter folders), move them under `Documents/Graduate_School/Forms/`**; no flat
    `GS-F-*.docx` and no `pdf/` folder may remain at the Forms root.
  - Manual `.docx/.md/.pdf/.json`: theirs renamed, ours rewrote. Resolve: keep ours, at the new path.
  - `build_forms.py`, `build_operations_manual.py`, `tests/test_operations_manual_content.py`: keep both — our content,
    their new path constants.
  - `.planning/STATE.md`: keep both sections.
- [ ] 3. Update the old paths left in our files to the new ones: `scripts/docs/forms/build_pack.py` (pack + folders),
  `tests/test_forms_pack.py`, `scripts/docs/opsmanual/front.py` (chapter 1 text names `Documents/USLS_Forms/`),
  `Documents/Graduate_School/Forms/00-INVENTORY.md` (paths in "How this pack is organised" and the build commands).
  `git grep -n "USLS_Forms\|CAPSTONE_ONLY/USLS GS Operations"` must show only archive/history hits.
- [ ] 4. **Regenerate instead of hand-merging binaries**: `E:/Temp/claude/docs-venv/Scripts/python.exe scripts/docs/forms/build_forms.py`,
  then `.../python.exe scripts/docs/forms/build_pack.py` (LibreOffice `E:/LibreOffice/program/soffice.exe`), then
  `.../python.exe scripts/docs/build_operations_manual.py --pdf` (LibreOffice on PATH). `git status` afterwards should show
  only the files you expected to change.

## 2. Content checks after the merge

- [ ] `Documents/Graduate_School/Forms/` has 22 folders: `0 Forms Control`, `4.01 …` to `4.19 …`, `Platform Basis`,
  `Supplementary Forms`, plus `00-INVENTORY.md` and `USLS-GS-Forms-Pack.pdf` (108 pages). Every `.docx` has its `.pdf` beside it
  (60 of each).
- [ ] Codes: GS-F-01..44 and GS-P-01/02 have the same numbers and titles as before. New: GS-P-03..06, GS-F-45..54.
- [ ] No printed "to be confirmed" / "proposed practice" on any form PDF (Fable P1a):
  `python -c` over the PDFs with pymupdf, count must be 0. Open questions live only in `00-INVENTORY.md` (questions 1-47).
- [ ] Spot-open: GS-P-01 page 1 (five Academic Coordinator rows, "Graduate Program Secretary"), GS-F-40 last page (Dean block
  together), GS-F-07 (subtitle "Operations Manual 4.6"), GS-P-04 page 1.
- [ ] Operations Manual: chapters 4.20-4.24 present; every chapter's "Records produced" opens with its forms line; Appendix A
  lists all 60 codes; 113 pages; no "AI/Gemini/RAG" in rule text (test checks).
- [ ] Fable findings left open, by design: the declaration line still begins page 2 of GS-F-10 and GS-F-42; some P3 polish.

## 3. App checks

- [ ] `app.py`: `PRIVACY_NOTICE_VERSION`, `UserAccount.privacy_consent_at` / `privacy_notice_version`,
  `POST /api/auth/privacy-consent`, `accept_privacy_notice_for_seeded_accounts()` at the end of `build_demo_database`.
  Their path edits in app.py must still be there (merge both).
- [ ] No ALTER TABLE added (IM4). The live site database needs a **reseed** before restart, or sign-in fails on the new columns.
- [ ] Frontend: `pages/PrivacyConsent.jsx`, `lib/formRefs.js`, `components/ui/EApprovalNote.jsx`; `PageHeader forms=` on the
  process pages; note under Approve/Deny in Dean case view.

## 4. Gate (run on the merged commit)

- [ ] `E:/Temp/claude/docs-venv/Scripts/python.exe -m unittest tests.test_forms_pack -v` -> 10 OK (skips without python-docx).
- [ ] `.venv/Scripts/python.exe -m unittest tests.test_operations_manual_content tests.test_privacy_consent tests.test_privacy_consent_seed -v` -> all OK.
- [ ] Full gate `.venv/Scripts/python.exe -m unittest discover -s tests -p "test_*.py"`. On `pkt/forms-ops` before the merge:
  see STATE.md "Full Python gate result" (filled in by the forms session if it finished before 09:00).
- [ ] `npm run build:web`; `npm --prefix frontend run check:ui:strict` -> every metric 0.
- [ ] `npm run e2e` (set `E2E_PORT` if 5055 is busy). Expected known failures that are NOT from this branch: p110 "coordinator
  approves a schedule" and p84 line 373 "Offering setup" (Course Adjustments has no "Schedule" tab / Save on the base code —
  p110 reproduced on base 576cebd); p79 flaky (passes alone). p112 (new) must pass: 43 tests.

## 5. After landing

- [ ] Reseed + restart the live site (`START-SITE` / `npm run seed`), then sign in as the demo Dean: no privacy screen
  (seeded accounts pre-accepted). Create a student through the admission handoff and sign in: change-password screen,
  then the Data Privacy Notice, then the portal.
- [ ] Rebuild `ZOOM-CHEAT-SHEET` with the new code list; update `scripts/demo/build_cheat_sheet.py` and
  `README-FOR-MIGUI.md` where they say "44 forms" or name `Documents/USLS_Forms`.
- [ ] Remove the merged worktrees `wt/fdocs`, `wt/fman`, `wt/fapp`, `wt/forms` — **first** `cmd /c rmdir frontend\node_modules`
  inside `wt/fapp` and `wt/forms` (they are junctions to the main checkout's node_modules).
- [ ] Do not push until the owner says so.
