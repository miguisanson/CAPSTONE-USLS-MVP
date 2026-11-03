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

1. Complete offering approval/publication and faculty assignment through the
   existing Course Adjustments and Offering setup workflow.
2. Open **Course Adjustments → Schedule**, select the term and review faculty
   submission statuses.
3. Create a draft from the term's offering list. Valid initial choices are
   selected using a search across the semester, not published automatically.
4. Review up to three recommended choices and the other valid choices for
   each subject. Expand unavailable options to inspect representative reasons.
5. Changing a selection saves it and checks affected choices again.
   **Keep this schedule** fixes the selection during later recommendations.
   Clear it when the search may move that subject.
6. Save any format changes, then explicitly **Approve schedule** and
   **Publish schedule**. These are separate actions. Only the Academic
   Coordinator can approve or publish, including when an admin is signed in.

Existing faculty suggestions remain tentative assignment aids. They do not
certify that a class fits the new semester teaching availability; the Schedule
tab performs that check against the faculty member's submitted teaching hours.

The approved paired days are Monday/Thursday, Tuesday/Friday and
Wednesday/Saturday. Defaults are 90-minute sessions, 15-minute gaps and a
07:30–21:00 permitted day. The backend `TEACHING_SCHEDULE_RULES` configuration
can change the time grid. Single-day fallback is off until the coordinator
explicitly enables it: two 90-minute sessions with a 15-minute internal break.

Hard restrictions include submitted teaching availability, faculty overlaps,
confirmed student subject overlaps, teaching load, and existing class/defense
commitments. Curriculum forecasts produce warnings and influence ranking;
they are not confirmed enrollment. Reasons and equivalent rankings are shown.
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
