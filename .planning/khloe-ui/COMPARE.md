# Khloe's screens and today's, side by side (packet khloe-ui, 2026-11-04)

Sources: Khloe's `v4.1-khloe` at `9118103` (`WorkflowPage.jsx` 2847-4450, `DeanApprovals.jsx`), and today's
`GraduationRoster.jsx`, `GraduationBatchModal.jsx`, `graduationShared.jsx`, `Practicum.jsx`, `DeanGraduationPage.jsx`,
`DeanPracticumBoard.jsx` (commit `c7e60a5`, "Graduation batches on the shared board, one decision UI", 2026-11-02).

Owner, verbatim: "the graduation endorsement and the practicum had batch stuff.. look at older repos.. it had a different UI
i want that back i want khloe's work back as well. she had a better UI we should have followed that" and later "lets follow that
more and update our other standalone processes... it was good but just needs more POLISH".

## Graduation Endorsement

### What Khloe's page showed, top to bottom (the same page for staff, both coordinators and the Dean)

1. Title "Graduation endorsement candidates" and a line saying who does what ("AC checks coursework, Research validates
   evidence, Staff prepares, and the Dean owns the endorsement export").
2. Filters: search, program, status, and a card "Completed course cohort" with the course filter and a hint line.
3. One wide board (380 px columns, scrolls sideways):
   - **Stage 1 "Academically Eligible - Awaiting Student Application"**: numbered circle, a paragraph of what it holds, a count,
     candidate cards. Not selectable.
   - **Stage 2 "Application Submitted - Ready for Batch Creation"**: numbered, "Select all visible", "Clear selection",
     "Create graduation batch" in the column head; cards with a checkbox and a "View PDF" pill.
   - **Batch columns** (one per step: For Review, Coursework Review, Research Review, Endorsement prep, Dean Review,
     Approved): each column is a list of **batch cards**.
4. **Candidate card**: name, number and program, application status chip, **four green requirement boxes** (Coursework completed,
   Thesis / research completed, Practicum completed or not required, Eligible for graduation), the **"Completed-course cohort:"**
   line, a "View student" button.
5. **Batch card**: batch checkbox, name, "n candidates", "Select batch / n/m selected / Batch selected", status chip, badges
   (Ready for Dean review, Application document issue, n messages); "Students: a, b, c +n more"; "Next: owner(s)"; a **stage-check
   strip** (current step name, "Step n: state" chip, eye button, progress bar in the compact form); buttons **View students**,
   **Select batch**, and the **step button** (Forward to Academic Coordinator, Check coursework completion, ... or, for the Dean,
   Export approved list). Green card and drag handle when the batch is ready to move.
6. **View students** opened the list inside the card. Each student: name, number, status chip, requirement boxes, discussion
   count, **View**, "View coursework completed" (Academic Coordinator), "View research completion details" and
   "View practicum completion details" (Research Coordinator and later), **Message / Return**.
7. The eye opened the **stage check window**: eight numbered steps (student applies, staff create batch, staff forward,
   Academic Coordinator reviews coursework, Research Coordinator validates research and practicum, staff prepare, Dean reviews,
   export), each with Complete / Current / Needs action / Pending and one line of detail.
8. A drafted (never used) **"Created graduation batches"** overview: one row per batch with students, next owner, stage strip,
   Select batch and step button.

### What today's page shows (after c7e60a5)

1. No title block (the page header says it); a one-line summary of counts.
2. One toolbar (search, program, status, completed course) with the Board/Table toggle.
3. The shared `StageBoard` (248 px columns, a column is a plain stage name plus one short line, no numbers).
4. Cards are the process-board skeleton: name, number, one or two lines, "Next:", ONE status chip, one **View details** button.
   No requirement boxes, no cohort line, no "Students:" list, no stage strip, no Select batch.
5. Everything else (stage check, student list, step buttons, Export, Print) is inside the **View details** window.
6. Drag and drop, "Move to...", lock reasons, phone list, Board/Table toggle and the discussion/Edit/e-approval parts.

### What was lost (and is restored by this packet)

| Khloe | Today | Restored? |
|---|---|---|
| Numbered candidate stages with a sentence of what they hold | plain names | yes (numbers, description kept short) |
| Four requirement boxes on every candidate | none on the card | yes |
| "Completed-course cohort:" line | only inside the batch dialog | yes |
| Batch card with Students / Next / stage strip | name + two lines + chip | yes |
| Stage-check strip with progress per batch | only in the window | yes |
| View students in place, with per-student detail toggles | only in the window | yes |
| Select batch, step button on the card | in the window only | yes (the window keeps them too) |
| "Created graduation batches" overview | none | yes |
| Wide columns | narrow | yes (batch columns 340 px) |

Kept from today (not layout): the step dialogs (one `StepDialog`), e-approval note, forms line, discussion with Edit
(`WorkflowDiscussion`/`EditableText`), drag, "Move to...", lock reasons, `data-card-id` ids and button names the Demo Guide
autopilot clicks (`View details for <batch>`, `Move to`, column names), Board/Table toggle, phone stacked list.

## Practicum

Khloe: a title line with "role view", an info banner "Program scope: Psychology and MSGC only", filters, a Board/Table toggle
on its own row, eight 290 px columns. **Card**: name, number, a green card and "Ready for Dean review" pill when the report is
with the Dean (grey "Waiting for documents" pill before any file), a two-column facts grid (site, hours, eligibility status,
updated, submitted), an amber box with the count and the latest message, "Next: owner", and two buttons **View** and
**Message**. Table with MOA, Documents, Hours, Coordinator, Dean report columns. Case window: six detail tiles, the automatic
eligibility checklist, the student submission with file links, timeline.

Today: same columns and table, case window the same; the card lost the scope banner, the facts grid and the Message button,
and the ready/waiting marks are small chips.

Restored: scope banner, facts grid, ready/waiting marks, message box, View + Message on the card. The Dean's practicum board
gets the same card.

## Khloe's design rules

Written so the next packet can put LOA, readmission, AWOL, withdrawal and residency on the same pattern. The pieces are shared
components in `frontend/src/components/process/` (index: `components/process/index.js`).

1. **Page order.** (1) Who-does-what line and scope note (`ProcessScopeNote` for a program limit). (2) Filters, then the
   Board/Table toggle. (3) The group overview when the process works in groups (`GroupOverview`). (4) The board. (5) One case
   window and one step dialog on top. A page never has a second competing list.
2. **A board column** says its stage name, a count and what it holds in one sentence (`StageColumnHeader`). Only the first
   columns, the ones the student or staff fill in before the real workflow starts, carry a number in a circle. Columns that
   hold groups are 340 px wide, columns that hold single cases 248-290 px. An empty column says what is missing, in words.
3. **A group** (a graduation batch; later a withdrawal list, an AWOL review round) is one card, `GroupCard`: checkbox, name, count,
   selection words, ONE status chip, badges for "Ready for Dean review", "Application document issue", "n messages";
   then `Students:` (first three names, "+n more"), `Next:` (owner, brand colour); then the **stage-check strip**
   (`StageCheckStrip`: current step name, "Step n: state", eye, progress bar); then the footer: **View students**, **Select batch**,
   and exactly one primary step button. Green card (`ready`) when the group can move.
4. **Stage check** (`StageCheck`): an ordered list of steps with a numbered circle (green complete, amber current, red needs action,
   white pending), the step's name, its state chip and one line saying what happens. Always owner-first wording: "Academic
   Coordinator reviews coursework", never a system word. The same list appears in the eye window and the overview.
5. **Single case card** (`CaseCardFacts` plus `MessageNote`): name; number and program; status or ready mark top right; a two-column
   facts grid with the same five facts every time (what it is about, size or hours, status, submitted date, updated date);
   the amber message box (count, last message, two lines); `Next: owner`; footer with **View** and **Message**.
6. **Requirement boxes** (`RequirementBoxes`): one box per requirement, green with a check when met, red with a cross when not,
   in a 2-column grid with `aria-label="Completed graduation requirements"` style label. Used on candidate cards, in the student
   list and in the case window, never as decoration.
7. **Student list of a group** opens inside the card (`MemberList`), not in a window: each member shows name, number, status chip,
   requirement boxes, discussion count and buttons **View**, one toggle per detail view (Coursework, Research, Practicum;
   `aria-expanded`), **Message / Return**. The window (eye) is only for the stage check.
8. **Colour and icons.** Green = done or ready to move (emerald 50/200/600), amber = waiting or a message, red = missing or returned,
   brand = who is next and primary buttons, slate = everything else. Icons: Eye = open, Users = students, CheckSquare = select or
   do the step, MessageSquare = discussion, FileText/ArrowUpRight = a file, Download = export. Chips always come from `StatusChip`.
9. **Empty states** are one dashed box inside the column or section with a sentence that says what would fill it ("No submitted
   graduation applications are waiting for batch creation."), never "No data".
10. **Dean view** is the same page and the same cards. What changes is the step button (Approve endorsement list, Export approved
    list), the "Ready for Dean review" mark and that the Dean ticks nothing: the Dean acts on one group at a time. The Dean never
    sees a separate private list.
11. **Polish that Khloe's version needed** (done in the shared parts): column titles wrap and never cut, controls are at least
    44 px tall on a phone, card text never overflows, the stage strip and the facts grid collapse to one column below 640 px,
    every button has a real name for screen readers ("View details for Batch 1", "Message Andrea Villanueva"), plain words only
    (no "cohort" in new text; the old line says "Completed courses" in the filter and keeps Khloe's word out of headings).

Note on rule 11: the owner's wording rule (AGENTS.md rule 6) bans "cohort" on screen. Khloe's line "Completed-course cohort:" is
therefore shown as **"Completed courses:"**. The test pins that word.

## What differs from Khloe's version, and why

- **Columns are 320 px, not 380 px**, so three stages stay whole in view at 1366 px (p77 pins this). Practicum columns stay at the
  shared 248 px: p78 (I-089) pins that Practicum and Withdrawal boards have equal columns; both move together in the next packet.
- **"Completed courses:"**, not "Completed-course cohort:" (AGENTS.md rule 6, no "cohort" on screen).
- **The step button sits on the batch card and also in the View details window**, and the Dean's card has **Export batch** (the
  page-level **Export approved list** stays for all approved batches; the Demo Guide autopilot clicks that name).
- **Drag and drop, "Move to...", lock reasons and the phone list stay** (shared `StageBoard`); Khloe's own board had drag only.
- **Requirement boxes turn red when a requirement is not met** (Khloe's were always green because only eligible students were shown).
- **The overview shows four batches, then "Show all n"**, because the seed has seven.
- **The Dean ticks no batch** (no "Select batch" for the Dean): same rule as today, the Dean acts on one batch at a time.
- The practicum "View" button reads "View" on the card (accessible name stays "View details for <student>").

## Server fields

None needed. Everything is built from today's `/api/transactions/graduation/context` and `/practicum/context` and `/api/approvals`.
