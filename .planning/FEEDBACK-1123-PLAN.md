# Owner feedback 2026-11-23 - plan (staged, owner checkpoint after each stage)

Source: the owner's list of 2026-11-23 (29 points). Decisions: IM58 (DECISIONS.md). Rules that still hold: IM50 "say a
thing once", IM51 status words, IM52 Dean boards unchanged. No feature is removed: every change is checked with the
feature inventory (`frontend/scripts/feature-inventory.mjs`) before and after, as in the UX feature check.

## Stage 1 - inventory and measurement (no change to the app)
- Every page and section subtitle, Help text, notice and hint line, with the heading it sits under, sorted into:
  says the heading again / says what the control already shows / adds a fact (a count, a rule, a deadline, a state).
- Every heading shown twice on one page (the student record's Activity log, Documents, Messages; the rest of the site).
- Every place the business rules show outside the Business Rules page (pages, dialogs, Help panels).
- Every filter row and every pager, side by side (which component, which order, where "Clear" sits).
- "3u" style unit labels.
- Page load times per role (server time and browser time) on the demo data, to find what makes the site slow.
- Output: `.planning/FEEDBACK-1123-INVENTORY.md`, the cut list the owner signs off before stage 2.

## Stage 2 - words
- Remove the subtitles and lines the inventory marks (Student Handoff: Import from monitoring sheet, Upload history,
  Onboarding report, the empty state; Enrollment Class List; every page header that its heading explains).
- Policy Assistant: remove "How this works" and the sample questions.
- Course Adjustments: remove the four lines and the summary line the owner listed; the squares show next-term numbers
  (Subjects needed next term, Student seats needed, Delayed if withheld, Selected to offer).
- "3u" becomes "3 units" everywhere.
- Research record: a finished defense does not also say "This defense took place".
- Duplicate headings removed.
- Business rules removed from every page, dialog and Help panel; the Business Rules page keeps them (IM58).

## Stage 3 - student record, Course Audit
- "Outstanding subjects" becomes Curriculum with two tabs: Completed (each subject with the term it was taken, the
  grade) and Outstanding. The four squares open the matching tab; their "Show subjects" buttons go (IM58).

## Stage 4 - one filter row and one pager
- One filter component (search, then the selects, "Clear" in one place) on every list and board; the Monitoring Sheet's
  filter area rebuilt on it, and its "Filters" opening bug fixed.
- One pager (Previous, page numbers, Next, "Showing x-y of n") wherever a list pages.

## Stage 5 - boards
- Graduation, Practicum, AWOL, Leave of Absence, Readmission and Withdrawal staff boards use the Research Gate board's
  card and column design. The Dean's pages stay as they are (IM52, IM58).

## Stage 6 - Policy Documents
- A lighter page: the document list first, one line per document, the details on opening one.

## Stage 7 - speed
- Fix the slowest pages and calls the stage 1 measurement found; measure again.

## Stage 8 - gate and write-back
- Python suite, build, check:ui --strict, full e2e, journeys, feature inventory before/after; write back to the PC.
