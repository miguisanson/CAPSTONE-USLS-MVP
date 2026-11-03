# Semester teaching schedules

The faculty **Schedule** page collects teaching availability for a selected
semester. It is separate from **My Availability**, which remains for defenses.
Students do not submit availability.

## Faculty

1. Open **Schedule** under Teaching and select the semester.
2. Select a calendar day to add an available time range. Edit precise times
   in the list below the calendar. Multiple ranges per day are supported.
3. Optionally add preferred periods within available ranges, or unavailable
   periods. Unavailable periods always take precedence.
4. Save a draft or submit availability. The coordinator uses only submitted
   availability. An unsubmitted semester is unknown, never automatically free.

**Copy previous semester** copies the earlier submission into a draft. Review
and submit it to confirm the new semester. **Confirm no changes** reconfirms
the saved ranges. Availability changes affecting an approved or published
timetable notify the Academic Coordinator; they do not cancel classes.

Published assigned classes appear below the availability editor.

## Academic Coordinator

Open **Course Adjustments → Offering setup**. Assign faculty, then choose a
schedule in the existing **Schedule** column. Use **Save all changes** once to save
every edited faculty assignment, schedule and section in the current program and
semester. Overlaps for the same faculty or confirmed enrolled students are rejected;
conflicting batches save nothing and keep your edits so they can be corrected.
Up to three valid slots receive visual emphasis; option text contains only days
and meeting times. When faculty hours are recorded, only slots fully within those
days and hours appear. Sunday is excluded. When hours are unknown, Mon–Sat slots
remain available with a caution after selection. Known class/defense conflicts are disabled. Availability cautions appear
below the dropdown only after selection; missing availability does not block choosing
a time. Submitted semester teaching hours take precedence; otherwise the recurring
hours already saved in the faculty profile are used directly, without a second
confirmation step or an unconfirmed-hours warning. Both paired and single-day
formats are included without a separate opt-in workflow.

The owner removed Semester class schedule and Faculty submissions sections.
There is no timetable draft, revision, approval or publication step in this UI.
Older timetable endpoints/models remain for compatibility but the dropdown uses
read-only options and the offering save-all endpoint.

The approved paired days are Monday/Thursday, Tuesday/Friday and
Wednesday/Saturday. Defaults are 90-minute sessions, 15-minute gaps and a
07:30–21:00 permitted day. The backend `TEACHING_SCHEDULE_RULES` configuration
can change the time grid. Single-day options contain two 90-minute sessions with a 15-minute internal break.

Hard restrictions include submitted teaching availability, faculty overlaps,
confirmed student subject overlaps, teaching load, and existing class/defense
commitments. Curriculum forecasts produce warnings and influence ranking;
they are not confirmed enrollment. Reasons and equivalent rankings are shown.
Existing `StudyPlanDraft` records are curriculum-derived plans sent for review,
not recorded student commitments; they do not become hard attendance constraints.
If the bounded search reaches its limit, the screen says so; it does not claim
that no feasible timetable exists.

## Publication and revisions

Published timetables are immutable. **Create revision** creates a draft from
the current offerings while the existing publication remains visible. It
preserves prior selections where possible. Approval and publication recheck
availability, enrollment, source offerings and other commitments.

Rebuilding a draft explicitly replaces its unpublished choices. Stale saves
are rejected; reload the semester before retrying. Existing offering-edit
paths cannot remove schedule history or overwrite a governed timetable with
free text. Room entry remains unchanged; this feature does not check rooms,
capacity or room reservations.

Faculty and enrolled students receive an in-app publication notification.
Students open **Schedule** to see published meetings for their recorded
subjects. No schedule is written into AIMS or treated as official enrollment.

**Multiple sections:** the existing enrollment model has no student-to-section
allocation. Until that is supplied, all sections of an enrolled subject are
shown with an unallocated warning. Conflict checking conservatively treats
those students as shared. Students must confirm their section with the
Academic Coordinator; the app does not invent a section assignment.

## Setup and verification

The new models require rebuilding the disposable demo database with
`npm run seed`. This resets the demo data. Restart the app afterward.
Startup never adds columns to an existing database.

- Backend contracts: `.venv/Scripts/python.exe -m unittest tests.test_teaching_engine tests.test_teaching_schedule -v`
- Real browser workflow with its own small temporary database: `npm run e2e:teaching`
- General roles, build and design checks remain in `frontend/e2e/README.md`.

No AI service or new paid dependency is required.
