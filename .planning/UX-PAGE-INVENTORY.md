# UX page inventory (UX audit, owner IM50 "say a thing once")

Every page of every portal, checked in Phase 3 (2026-11-20) against IM50/IM51. "-" means the page was checked and
nothing needed to change in that phase. The automated check is `frontend/e2e/p150-ux-phase3.spec.js`: it opens every page
below and fails on a form line under a title, a page line longer than one short sentence (110 characters), or the same
sentence twice in a page's descriptions and section subtitles.

Status words (IM51, every page): one word per meaning — "With the Dean" (was Dean Review / Ready for Dean Review / Report
Sent to Dean), "In review", "In staff review", "Submitted", "Returned", "Acknowledged by Registrar", "AWOL", "Completed",
"Verified", "Passed", "On leave", "Not eligible", "Not taken". Only the screen words change (`lib/status.js` SAME_MEANING).

## Graduate School staff (also Academic Coordinator, Research Coordinator, admin: same pages by role)

| Page | Path | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|---|
| Dashboard | `/` | sidebar footer note removed | header line, subtitles, Refresh / Reports buttons removed; unread dot; arrow links; "Overdue since" once | - |
| Reports & Analytics | `/reports` | - | - | page line shortened |
| Academic Semesters | `/term-settings` | - | - | page line, "Add semester" subtitle shortened |
| Students | `/students` | - | - | page line, duplicate-review subtitle shortened; cells 1px tighter so "On leave" fits at 1093 px |
| Student record | `/students/:id` | - | - | "Activity timeline" subtitle removed |
| Faculty | `/faculty` | - | - | page line shortened |
| Monitoring Sheet | `/monitoring-sheet` | - | - | - (Phase 6) |
| Enrollment Class List | `/enrollment-class-list` | - | - | page line shortened |
| 1 · Student Handoff | `/workflow/student-handoff` | - | Help button | page line; import subtitle shortened; server text in Help |
| 2 · Course Adjustments | `/course-adjustments` | - | - | page line; form numbers in Help; subtitles shortened |
| 3 · Enrollment | `/enrollment` | - | - | page line; Dropped-row rule and form numbers in Help; subtitle shortened |
| 4 · Course Audit | `/workflow/course-audit` | - | Help button | page line; subtitle shortened |
| 5 · Research Gate | `/workflow/research-gate` | board count sentence (screen-reader only) | Help; Colour key; Export in filter box; no second heading | page line; board hint in Help; adviser protocol in Help |
| 6 · Panel Matching | `/workflow/panel-matching` | - | Help button | page line; subtitle shortened |
| 7 · Defense Scheduling | `/workflow/defense-scheduling` | - | Help button | page line; subtitles shortened |
| 8 · Practicum | `/workflow/practicum` | board count sentence | Help; Colour key; Export in filter box | page line; board hint in Help; status words merged |
| 9 · Graduation Endorsement | `/workflow/graduation` | board count sentence | Help; Colour key; Export in filter box | page line; board hint in Help; status words merged; stage-check subtitle removed |
| Leave of Absence | `/workflow/leave-of-absence` | board count sentence; column scroll | Help; Colour key; Export in filter box | page line; board hint in Help; card status line not repeated; no "Awaiting your review" |
| Readmission | `/workflow/readmission` | same | same | same |
| AWOL & Residency | `/workflow/awol` | same | same | same |
| Subject Withdrawal | `/workflow/withdrawal` | same | same | same |
| Work Queue | `/work-queue` | opens on the signed-in office | - | page line shortened |
| Activity Log | `/activity` | - | - | page line shortened |
| Policy Assistant | `/assistant` | - | - | page line shortened |
| Policy Documents | `/policy-documents` | - | - | page line, "Test a question" subtitle shortened |
| Business Rules | `/business-rules` | - | - | page line shortened; locking and edit rules in Help |
| Form 1 Endorsements | (Academic Coordinator) | - | - | page line; form numbers in Help |
| Adviser appointments | (Research Gate, adviser tab) | - | - | page line; protocol steps and form numbers in Help |

## Dean

| Page | Path | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|---|
| Dashboard | `/dean` | - | header line, subtitles, "Open approvals queue", row chips removed; unread dot; arrows | - |
| Approvals Queue | `/dean/approvals` | - | - | page line shortened (one table: Phase 4) |
| Course Adjustments | `/dean/approvals/course-adjustments` | - | - | page line; form numbers in Help |
| Leave of Absence / Readmission / AWOL / Withdrawal | `/dean/approvals/...` | board count sentence | Help; Colour key | Dean page lines shortened; board hint in Help |
| Practicum Reports | `/dean/approvals/practicum` | - | Help; Colour key | page line; board hint in Help; status words merged |
| Graduation Endorsement | `/dean/approvals/graduation` | - | - | page line; form numbers in Help |
| A case | `/dean/case/...` | - | - | form numbers in Help; "Case not found" line shortened |
| Admission & Coursework Reports | `/dean/gate-reports` | - | - | page line shortened |
| Reports & Analytics | `/dean/analytics` | - | - | page line shortened |
| Activity Log | `/dean/activity` | - | - | page line shortened |
| Policy Assistant | `/dean/assistant` | - | - | page line shortened |
| Business Rules | `/dean/business-rules` | - | - | page line; rules detail in Help |

## Faculty

| Page | Path | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|---|
| Dashboard | `/faculty-portal` | - | subtitles removed; unread dot; arrows | - |
| My Advisees | `/faculty-portal/advisees` | - | - | page line; form numbers in Help; adviser-request subtitle shortened |
| Signatures & Endorsements | `/faculty-portal/signatures` | - | - | page line; subtitle that copied it removed; revisions subtitle shortened |
| Panel Assignments & Papers | `/faculty-portal/panels` | - | - | page line; subtitle removed |
| Panel Invitations | `/faculty-portal/invitations` | - | - | page line; form numbers in Help |
| Defense Schedule | `/faculty-portal/defenses` | - | - | page line; form numbers in Help |
| My Calendar | `/faculty-portal/calendar` | - | - | page line shortened |
| My Availability | `/faculty-portal/availability` | - | - | page line; "Weekly hours" subtitle shortened (Philippine time said once) |
| Verdicts | `/faculty-portal/verdicts` | - | - | page line; section subtitles shortened |
| Assigned Classes | `/faculty-portal/classes` | - | - | page line removed (it repeated the title) |
| Schedule | `/faculty-portal/schedule` | - | - | page line; form numbers in Help |
| Policy Assistant | `/faculty-portal/assistant` | - | - | page line shortened |
| Business Rules | `/faculty-portal/business-rules` | - | - | page line; rules detail in Help |

## Student

| Page | Path | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|---|
| Dashboard | `/student` | open-task count = action rows; "Elsewhere in your portal" removed; Research chip fits | subtitles removed; unread dot; arrows; "Overdue since" once | "My Academic Status" / request-list subtitles removed |
| My Progress | `/student/progress` | - | - | page line; curriculum subtitle removed |
| Enrollment | `/student/enrollment` | - | - | page line; the subtitle that copied it removed |
| Schedule | `/student/class-schedule` | - | - | page line shortened |
| Practicum | `/student/practicum` | - | - | page line shortened |
| Graduation Endorsement | `/student/graduation` | card says when not yet eligible | - | page line shortened |
| Research | `/student/research` | - | - | page line shortened |
| Research Adviser | `/student/adviser` | - | - | - |
| Defense Schedule | `/student/defense-schedule` | - | - | page line shortened |
| Research Calendar | `/student/calendar` | - | - | page line; "Calendar" subtitle removed; deadlines subtitle shortened |
| Request Center | `/student/requests` | Graduation card locked with reason | - | page line shortened |
| Leave of Absence / Readmission / Return from AWOL / Subject Withdrawal | `/student/requests/...` | - | - | page lines shortened |
| Messages | `/student/messages` | - | - | page line; the subtitle that copied it removed |
| Documents | `/student/documents` | - | - | page line; the subtitle that copied it removed |
| Activity Log | `/student/activity` | - | - | page line; the subtitle that copied it removed |
| Policy Assistant | `/student/assistant` | - | - | page line shortened |
| My Profile | `/student/profile` | - | - | page line shortened |

## Shared

| Page | Phase 3 |
|---|---|
| Sign in | page line shortened |
| Data Privacy Notice, Change password | - |
| Every board | drag / "Move to..." hint said once, in Help ("Using the board") |
| Every page with form numbers | the form line moved from under the title into Help (PageHeader `forms` adds the Help button) |

## Not changed on purpose (waiting for the owner)

- The green "Ready for Dean review" mark and the green card colour on the boards (Khloe's design; UX-10).
- The "New for you" mark on board cards (owner 2026-11-19, p145).
- The lock line under a card that cannot be moved ("Waiting for: Dean"), which sits under "Next: Dean". It takes the place of
  "Move to..." on purpose (p73); dropping it touches the drag behaviour the owner chose to keep (IM48).
- The four Graduation requirement boxes (UX-10).
