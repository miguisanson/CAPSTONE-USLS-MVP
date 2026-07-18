# Program Monitoring Sheets (registrar import files)

Drop the **registrar's** per-program monitoring sheet (`.xlsx`) here — one file per
program. On startup the app imports every sheet in this folder to build the student
roster + coursework. This is the **single source of truth** for who is enrolled and
their coursework; nothing is randomly generated.

The folder ships **empty** — the app has no students until a real sheet is imported
(via startup seed, or Student Handoff → import in the UI).

## File format the importer expects
- `A1` = `PROGRAM: <CODE>`
- Header row: `IDNO`, `COURSE`, `YR`, group labels `BASIC` / `MAJOR` / `COGNATE`, `TOTAL`, `COMPRE`, `NOTE`
- Sub-header row: `AY ENTRY`, `SN` (surname), `FN` (first name), the subject codes, milestone labels `TITLE` / `PROPOSAL` / `ETHICS` / `FINAL`
- One student per row, grouped by entry academic year.
- A subject cell holds the **unit value** (e.g. `3`) when completed, blank when not taken.
- Research progress: `COMPRE` = `PASSED` plus cumulative milestone marks map to a lifecycle stage.

Names may be ALL-CAPS (registrar style); the importer normalizes them to display case.
