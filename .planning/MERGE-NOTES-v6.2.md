# Merge notes: v6.2-migui vs Natalie's new branch (written 2026-11-04 ~14:45)

**Common base:** `v6.2-migui` was created at **`50f6b4f`** (= `v6.1-migui` 50f6b4f). Natalie's branch starts
from there (check with `git merge-base v6.2-migui <natalie-branch>`). Everything below landed on v6.2-migui
*after* that point, so these are the places a later merge can conflict.

## Already on v6.2-migui after 50f6b4f
| Commit | What | Files a merge may touch |
|---|---|---|
| 171a647 | "note": 7 runtime upload files (removed from git again in the commit that adds this file) | `uploads/**` |
| 127add0 | Demo Guide autopilot design | `.planning/demo-guide/DESIGN.md` |
| 9e78f8c + e388e53 | Demo Guide made intuitive: "Start a guided demo" box, Presenter settings switches, one-click "Switch to <role>", "Stop the demo guide" | **`frontend/src/pages/Login.jsx` (large rewrite of the demo area)**, `frontend/src/components/DemoGuide.jsx`, `frontend/src/lib/demoGuide/{engine,prefs,session}.js`, `frontend/e2e/p114-demo-guide.spec.js`, `frontend/e2e/p88-records-login.spec.js` |
| 5fc7d86 | One-take demo video, subtitles, videos folder tidied (Parts/, Archive/) | `Documents/Capstone/Meeting_2026-11-04/videos/**` (files moved), `scripts/demo/build_narration.py`, `scripts/demo/narration.json` |
| 4df98c6 | Edit-with-history contract | `.planning/edit-history/CONTRACT.md` |
| (this commit) | `.gitignore` now ignores all of `uploads/`; 26 upload files untracked (kept on disk); this note | `.gitignore`, `uploads/**` |

## Coming next on v6.2-migui (in progress — expect these)
- **Autopilot** (branch `pkt/autopilot`): `frontend/src/lib/demoGuide/guides.js` is **split into one file per
  guide** under `frontend/src/lib/demoGuide/guides/` (+ `index.js`); new `autopilot.js`, fixtures; small
  `data-demo="..."` attributes added to the components the guides use (student request forms, boards, monitoring
  sheet, reports). New spec p115. If Natalie edits `guides.js`, re-apply her change in the matching
  `guides/<id>.js` file after the merge.
- **Edit anything with history** (contract `.planning/edit-history/CONTRACT.md`): **new table `RecordEdit`**
  in `app.py` (schema change: run `npm run seed` after merging), new `PATCH/GET /api/edits/<entity>/<id>`,
  a shared Edit/Edited UI piece used in the case conversations and request cards of every process.
- **Manual fields round 2**: Monitoring "Add student" school year becomes a dropdown, plus more inputs
  turned into dropdowns / automatic values across the forms.

## Schema changes since v6.1 (both sides must reseed after the merge)
`ResidencyEnrollment.prior_enrollment_tag`, `DefenseVerdict.title_before_verdict` (already on v6.1), and soon the
`RecordEdit` table. No ALTER patches (IM4): merge, then `npm run seed`.

## How to merge (proper merge, later)
1. `git fetch`, then on a new branch from v6.2-migui: `git merge origin/<natalie-branch>`.
2. Hot spots: `app.py` (resolve function by function; both sides add routes), `Login.jsx`, `DemoGuide.jsx`,
   `guides/`, `RequestForms.jsx`, `.planning/STATE.md` / `ISSUES.md` (keep both sides' rows; renumber clashing
   I-numbers after the higher one).
3. `npm run seed`, the full Python gate, `npm run build:web`, `check:ui:strict`, `npm run e2e`.
