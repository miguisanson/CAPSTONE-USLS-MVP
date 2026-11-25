# Owner feedback 2026-11-23 - stage 1 inventory

Crawled on the new demo data (85 students), every sidebar page of the six roles plus two student records, each tab, the Help panel and the first case window: 101 pages. `#` stands for a number. Names and record values are left out.

Proposal column: **cut** = the heading or the control already says it (IM50/owner 2026-11-23); **keep** = it adds a fact the heading does not (a count, a state, a rule the user must act on); **reword** = keep the fact, drop the rest. The owner marks any line to change before stage 2.


## Summary - what stage 2 onwards would change

| Area | Found | Proposal |
|---|---|---|
| Subtitles under headings (A) | 119 distinct | Cut every subtitle the heading explains (most of them); keep the few that carry a count or a state. |
| Hint and helper lines (B) | about 620 distinct lines, some are record data the filter could not tell apart | Cut lines marked **cut**; **review** lines hold a rule or a condition (when a step opens, what is required) - shorten to the condition, or drop when the page already shows it (a disabled button, an empty state). |
| Notices (C) | 21 distinct | Same rule as B. |
| Headings said twice (D) | 28 views | Student portal: Messages / "Inbox / Messages", Documents / "Administrative Documents", Activity Log twice, Progress / "Curriculum progress", Calendar, Adviser; every Policy Assistant page ("Assistant"); Policy Documents ("Documents"); Research Gate (page title and its first tab). The second heading goes or names something new. Not real repeats: Enrollment draft / history, AWOL & Residency sections - kept. |
| Business rules (E) | the "Rules applied on this screen" Help section on 30 pages, two "rules applied" boxes on Enrollment and Course Adjustments, the rules count line on the Dean pages | All removed (IM58); the Business Rules page keeps them. |
| Filter rows (F) | 50 different layouts | One filter row (stage 4). |
| Paging (G) | Previous / Next with "Showing x-y of n" on Reports, Work Queue, Activity; "Showing n of n students/records/requests/cases" without paging on boards | One pager and one "Showing" line (stage 4). |
| Unit labels (H) | "3u" on Course Adjustments > Offering setup, "15/36u" on the student record | "3 units", "15 of 36 units". |
| Speed (I) | Slowest calls: the class-schedule options on Enrollment (1.7 s), Reports "Needs attention" (1.1-1.4 s), the Research Gate overview (0.5-0.9 s, also loaded by Panel Matching and Defense Scheduling), the Dean's approvals count (0.5-0.8 s, loaded again on every Dean page), the dashboard (0.7 s), the faculty portal context (0.5 s) | Stage 7: make these calls cheaper, load the Dean's counts once, not on every page. |
| Monitoring Sheet filters (J) | Opening "Filters" pushes Sort and Export to the right and drops the four selects under them; the Student, Program and Semester boxes are a second, different row | Stage 4: one filter row, with "More filters" opening below the whole row. |
| Research record | A finished (Held) defense also says "This defense took place." | Stage 2: the line goes. |


## A. Subtitles under headings (119 distinct)

| Heading | Subtitle | Where | Proposal |
|---|---|---|---|
| Your lifecycle | You are at: Final Defense | student /student | cut |
| Application / Review Window | This step opens only after coursework, research, completion documents, and any required practicum are complete. | student /student/graduation | cut |
| Staff and Coursework Review | This stage opens after the application is submitted. | student /student/graduation | cut |
| Requirements Validation | Coursework, research, practicum, and completion records are checked here. | student /student/graduation | cut |
| Dean Endorsement | Available after eligibility is confirmed and staff prepares the endorsement. | student /student/graduation | cut |
| The list is saved as a file | Available after Dean approval. | student /student/graduation | cut |
| The Dean sends the list to the Registrar | Available after the endorsed list is exported. | student /student/graduation | cut |
| Next deadlines | Earliest first. | student /student/calendar | cut |
| Subscribe to this calendar | Defenses and deadlines in your own calendar app | research-coordinator /workflow/defense-scheduling, staff /workflow/defense-scheduling, student /student/calendar | cut |
| Research & Defense | Upload your milestone files, submit the files for review, then request scheduling after a panel is assigned. | student /student/requests | cut |
| Requests | Submit a standalone standing-change or subject-withdrawal request. | student /student/requests | cut |
| Completion | Submit practicum evidence when required and request Graduate School graduation endorsement review. | student /student/requests | cut |
| Ask for a leave of absence | Choose the semesters you want to be away and tell us why. Graduate School staff check your request first, then the Dean decides. | student /student/requests/leave-of-absence | cut |
| Assistant | Policy documents and your own record only | student /student/assistant | cut |
| What is holding students back? | Start with the longest bar: that cause affects the most students. Select a bar to list those students. | academic-coordinator /reports, research-coordinator /reports, staff /reports | cut |
| Students who need attention | Most delayed first, then longest in the same stage. The next owner is the office that can move the student on. | academic-coordinator /reports, research-coordinator /reports, staff /reports | cut |
| Where do students wait the longest? | Look for stages with slow or stuck students, open each stage, and ask the next owner what is blocking each one. | academic-coordinator /reports, research-coordinator /reports, staff /reports | cut |
| Which offices are slow to close requests? | Offices with a long red bar have requests waiting over # days: ask those offices first. The table gives the days an office takes to close a request. | academic-coordinator /reports, staff /reports | cut |
| Which research students have records missing? | Open each student and add the missing research record or adviser; the student then leaves this list. | academic-coordinator /reports, research-coordinator /reports, staff /reports | cut |
| Where are the students of each year started? | Each bar is one school year students started. Select a number to see those students. | academic-coordinator /reports, staff /reports | cut |
| More detail | The same students, looked at another way. | academic-coordinator /reports, staff /reports | cut |
| Students by year started and stage | How many students of each program and entry year are at each lifecycle stage. | academic-coordinator /reports, staff /reports | cut |
| Graduation candidates | Who can graduate, what is still missing, and where each student stands in a batch. | academic-coordinator /reports, staff /reports | cut |
| Overdue milestones and pending requests by office | Overdue tasks and requests still waiting for an answer, by office, longest wait first. | academic-coordinator /reports, staff /reports | cut |
| Daily changes | Export or print the day's changes for the Registrar, then mark each one sent. | academic-coordinator /reports, staff /reports | cut |
| Add a manual flag | Choose what is being flagged and record the observation. Source-correctable flags can close automatically after a clean monitoring upload. | academic-coordinator /monitoring-sheet, research-coordinator /monitoring-sheet, staff /monitoring-sheet | cut |
| MAED-COG1 — Teaching Strategies in Higher Education | Enrollment-synchronized class list | academic-coordinator /enrollment-class-list, staff /enrollment-class-list | cut |
| Import from monitoring sheet | Students, programs and course audits are created from the monitoring sheet. | staff /workflow/student-handoff | cut |
| Upload history | Every uploaded workbook is preserved. Open a version to review conflicts between its values and the current record. | staff /workflow/student-handoff | cut |
| Student Handoff | Help | staff /workflow/student-handoff | cut |
| Adjustments and subject demand | Demand is recalculated from the current student records. | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| Course offering decisions | MAED · Master of Arts in Education · planning for AY #-# #st Semester · generated Nov #, #, #:# AM | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| Course Offering Setup | Faculty suggestions are references only; every assignment can be changed. | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| Course Adjustments | Help | academic-coordinator /course-adjustments, dean /dean/approvals/course-adjustments, staff /course-adjustments | cut |
| Official offered subjects | Only Not taken subjects can be added; the rest are locked. | academic-coordinator /enrollment, staff /enrollment | cut |
| Enrollment draft | # subjects · # units | academic-coordinator /enrollment, staff /enrollment | keep |
| Enrollment history | Durable semester records for this student. | academic-coordinator /enrollment, staff /enrollment | cut |
| Enrollment | Help | academic-coordinator /enrollment, staff /enrollment | cut |
| Subject roster | Who completed the chosen subject at the end of the term. | academic-coordinator /workflow/course-audit, staff /workflow/course-audit | cut |
| Students with missing subjects | Subjects not taken yet or failed, in curriculum order; subjects in progress are not missing. | academic-coordinator /workflow/course-audit, staff /workflow/course-audit | cut |
| Course Audit | Help | academic-coordinator /workflow/course-audit, staff /workflow/course-audit | cut |
| Title Defense | Form # is endorsed, the panel is matched and the title is defended. | academic-coordinator /workflow/research-gate, research-coordinator /workflow/research-gate, staff /workflow/research-gate | cut |
| Proposal Defense | The proposal is prepared, signed by the adviser and defended. | academic-coordinator /workflow/research-gate, research-coordinator /workflow/research-gate, staff /workflow/research-gate | cut |
| Final Defense | Final defense requirements and panel decision, then completion evidence. | academic-coordinator /workflow/research-gate, research-coordinator /workflow/research-gate, staff /workflow/research-gate | cut |
| Research Gate | Help | academic-coordinator /workflow/research-gate, research-coordinator /workflow/research-gate, staff /workflow/research-gate | cut |
| Using the board | A card moves to the next column by itself as each step is recorded; this board is for viewing. | academic-coordinator /workflow/research-gate, research-coordinator /workflow/research-gate, staff /workflow/research-gate | cut |
| Waiting for a panel | Students whose documents are in and whose next step is this one | academic-coordinator /workflow/panel-matching, research-coordinator /workflow/panel-matching, staff /workflow/panel-matching | cut |
| Panel Matching | Help | academic-coordinator /workflow/panel-matching, research-coordinator /workflow/panel-matching, staff /workflow/panel-matching | cut |
| Waiting for a defense date | Students whose documents are in and whose next step is this one | research-coordinator /workflow/defense-scheduling, staff /workflow/defense-scheduling | cut |
| Defense Scheduling | Help | research-coordinator /workflow/defense-scheduling, staff /workflow/defense-scheduling | cut |
| Practicum | Help | academic-coordinator /workflow/practicum, staff /workflow/practicum | cut |
| Using the board | A card moves to the next column by itself as each step is approved. Drag a card up or down to reorder it inside its column. | academic-coordinator /workflow/graduation, academic-coordinator /workflow/practicum, dean /dean/approvals/withdrawal (+4) | cut |
| Academically eligible | Waiting for the student's signed application. | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| Application submitted | Staff can now create a graduation batch. | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| Batch created | Staff forward it for coursework review. | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| Coursework review | The Academic Coordinator checks coursework. | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| Research and practicum check | The Research Coordinator checks the evidence. | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| Endorsement prep or revision | Staff prepare the list or revise it. | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| Dean review | The Dean approves or returns the list. | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| Approved, ready to export | The Dean exports; staff then mark it sent. | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| Created graduation batches | Every batch and where it stands. Open the stage check to follow it step by step. | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| Graduation Endorsement | Help | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| Submitted | Waiting for Graduate School staff to start. | dean /dean/approvals/leave-of-absence, dean /dean/approvals/readmission, staff /workflow/leave-of-absence (+1) | cut |
| With the Dean | Waiting for the Dean's decision. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, dean /dean/approvals/leave-of-absence (+6) | cut |
| Leave scheduled | Approved; the leave has not started yet. | dean /dean/approvals/leave-of-absence, staff /workflow/leave-of-absence | cut |
| On leave | The student is away. Enrollment is closed. | dean /dean/approvals/leave-of-absence, staff /workflow/leave-of-absence | cut |
| Registrar list | Dean-approved requests that go to the Registrar. The portal does not send any email: download the list, email it yourself, then mark it as sent. Mark it as acknowledged when the Registrar confirms. | staff /workflow/awol, staff /workflow/leave-of-absence, staff /workflow/readmission | cut |
| Leave of Absence | Help | dean /dean/approvals/leave-of-absence, staff /workflow/leave-of-absence | cut |
| Using the board | Drag a card to another column, or use "Move to..." on the card; both do the same as the buttons in its window. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, dean /dean/approvals/leave-of-absence (+5) | cut |
| Policy check | Advice for staff - the Dean decides. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, dean /dean/approvals/leave-of-absence (+6) | cut |
| Messages | Notes and returns about this request, newest at the bottom. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, dean /dean/approvals/leave-of-absence (+6) | cut |
| Readmission | Help | dean /dean/approvals/readmission, staff /workflow/readmission | cut |
| AWOL | Flagged from source records. Waiting for the student's written return. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, staff /workflow/awol | cut |
| Return review | Staff check the written return against the residence limits, then forward it. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, staff /workflow/awol | cut |
| Residency | Active no-subject residency semesters. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, staff /workflow/awol | cut |
| Residency reports | Recorded residency semesters go to the Registrar. Download the report and email it through the official channel. | staff /workflow/awol | cut |
| AWOL & Residency | Help | academic-coordinator /workflow/awol, dean /dean/approvals/awol, staff /workflow/awol | cut |
| Submitted | Waiting for Graduate School staff to record and forward. | dean /dean/approvals/withdrawal, staff /workflow/withdrawal | cut |
| Subject tagging | Approved. Staff tag the subject as Withdrawn. | dean /dean/approvals/withdrawal, staff /workflow/withdrawal | cut |
| Excel export | Tagged. Staff export the approved-withdrawals Excel list. | dean /dean/approvals/withdrawal, staff /workflow/withdrawal | cut |
| Registrar list | Dean-approved withdrawals whose subject is tagged go to the Registrar. The portal does not send any email: download the Excel list, email it through the official channel, and wait for the Registrar to acknowledge. | staff /workflow/withdrawal | cut |
| Subject Withdrawal | Help | dean /dean/approvals/withdrawal, staff /workflow/withdrawal | cut |
| Assistant | General · policy documents and all students | staff /assistant | cut |
| Focus on a student | Optional: ground answers in one record | staff /assistant | cut |
| Test a question | See which passages the Policy Assistant would use for a question. | staff /policy-documents | cut |
| Documents | Staff uploads can be edited, replaced, or removed. Built-in sources are view-only. | staff /policy-documents | cut |
| USLS Graduate School Operations Manual (draft for validation) | USLS_GS_Operations_Manual_-_DRAFT_for_Validation.docx | staff /policy-documents | cut |
| Graduate School Research Protocol (AY 2024-2025) | Complete-GS-Research-Protocol-Updated-for-AY#-#-without-publication-protocol-#.docx | staff /policy-documents | cut |
| Graduate School Handbook 2022-2023 | GRADUATE-SCHOOL-HANDBOOK-#-#.pdf | staff /policy-documents | keep |
| Business Rules | Help | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| Course audit | Completed, current, and missing subjects vs curriculum | staff /students/1, staff /students/5 | cut |
| Comprehensive exam | The result decides whether the research steps open | staff /students/1, staff /students/5 | cut |
| Research case & evidence | Milestone gate and required document checklist | staff /students/1, staff /students/5 | cut |
| Leave history | Earlier leave of absence and readmission cases (view only) | staff /students/1, staff /students/5 | cut |
| Recommended actions | Computed from this record | staff /students/1, staff /students/5 | cut |
| Course offerings · MIT | AY #-# #nd Semester · # subject(s) proposed · submitted Oct #, # | dean /dean/approvals/course-adjustments | cut |
| Practicum Reports | Help | dean /dean/approvals/practicum | cut |
| Which decisions have waited the longest? | Decide the red and orange bars first: those requests have waited over a week. Select a bar to see the cases. | dean /dean/analytics | cut |
| How fast are decisions made? | A bar past the dashed line is slower than the target. A long gap between the median and the slowest #% means a few cases wait far longer than most. | dean /dean/analytics | cut |
| What was decided? | Many returns for one process mean its requests reach you incomplete: ask that office to check each request before sending. Select a bar to see the cases. | dean /dean/analytics | cut |
| How many graduation candidates are at each step? | A step with many students and nothing in the next one is where candidates are stuck: ask that office to move those students on. | dean /dean/analytics | cut |
| How many active students are at each stage? | Select a bar or a count to see the students. A stage with many students and few in the next one is where students wait. | dean /dean/analytics | cut |
| Assistant | Policy documents and your own queue | academic-coordinator /assistant, dean /dean/assistant, faculty /faculty-portal/assistant (+1) | cut |
| Advisee places | You can advise at most # students. | faculty /faculty-portal/advisees | keep |
| Contracts and signatures | Forms #.# and #.# (adviser contract) are due # days after Form #.#. | faculty /faculty-portal/advisees | cut |
| My Advisees | Help | faculty /faculty-portal/advisees | cut |
| Panel Invitations | Help | faculty /faculty-portal/invitations | cut |
| Defense Schedule | Help | faculty /faculty-portal/defenses | cut |
| Weekly hours | Tick the days and set the hours, in Philippine time. | faculty /faculty-portal/availability | cut |
| Specific dates | Vacations, travel or one-off changes. Specific hours on a date replace your weekly hours for that day. | faculty /faculty-portal/availability | cut |
| Your dates | No specific dates. Your weekly hours apply. Dates that have passed are not shown. | faculty /faculty-portal/availability | cut |
| Requests from the Graduate School | Saving your weekly hours or a specific date also answers these requests. | faculty /faculty-portal/availability | cut |
| Other open windows | Read only. Times the Graduate School has on record. | faculty /faculty-portal/availability | cut |
| Needs your verdict | You are the chair or lead and no verdict is recorded yet. | faculty /faculty-portal/verdicts | cut |
| Waiting on others | The chair or lead has not recorded the verdict yet. | faculty /faculty-portal/verdicts | cut |
| Verdict history | Newest first. | faculty /faculty-portal/verdicts | cut |
| Weekly teaching calendar | Select a day to add a time range. Use the editable list below for precise times. | faculty /faculty-portal/schedule | cut |
| Schedule | Help | faculty /faculty-portal/schedule | cut |
| Semester schedule | Prepare the semester schedule to collect every offered class and its meeting times in one draft. | academic-coordinator /course-adjustments | cut |

## B. Hint and helper lines (624 distinct, 25+ characters)

| Line | Where | Proposal |
|---|---|---|
| Your panel is in place. Choose the date you prefer on the Defense Schedule page. | student /student | cut |
| You are at: Final Defense | student /student | cut |
| # completed. No subjects left | student /student | keep |
| Submissions, decisions and replies will appear here. | student /student | cut |
| Your stage, requirements and curriculum, from the monitoring record. | student /student/progress | cut |
| # completed. No subjects left. | student /student/progress | keep |
| No withdrawal request is active. | student /student/progress | cut |
| Pass the Final Defense first | student /student/progress | cut |
| Subjects already on your record stay locked. | student /student/enrollment | cut |
| Current and completed subjects stay locked as part of your academic record. You may select additional subjects only when the subjects are offered this semester. | student /student/enrollment | review |
| # units · Year # - #nd Semester | student /student/enrollment | keep |
| # units · Year # - #st Semester | student /student/enrollment | keep |
| # subjects checked for this semester. | student /student/enrollment | keep |
| Class times for your subjects; check your section with the Academic Coordinator. | student /student/class-schedule | cut |
| Only finalized class schedules appear here. | faculty /faculty-portal/schedule, student /student/class-schedule | review |
| Apply once coursework, research and any practicum are complete. | student /student/graduation | cut |
| # rules from the Graduate School policies | dean /dean/approvals/awol, dean /dean/approvals/leave-of-absence, dean /dean/approvals/practicum (+7) | keep |
| Your application stays visible while each reviewing office completes its part. | student /student/graduation | cut |
| This step opens only after coursework, research, completion documents, and any required practicum are complete. | student /student/graduation | review |
| This stage opens after the application is submitted. | student /student/graduation | review |
| Coursework, research, practicum, and completion records are checked here. | student /student/graduation | cut |
| What is left is listed at the top of this page. | student /student/graduation | cut |
| Available after eligibility is confirmed and staff prepares the endorsement. | student /student/graduation | review |
| Available after Dean approval. | student /student/graduation | review |
| Available after the endorsed list is exported. | student /student/graduation | review |
| Upload milestone files and follow your title, proposal and final defense requirements. | student /student/research | cut |
| Submit the final defense manuscript and final defense endorsement. The assigned adviser signs the uploaded files in-system before staff verifies the confirmed defense schedule. | student /student/research | review |
| Only these items require action from you for this milestone. | student /student/research | review |
| Upload the final defense endorsement. The assigned adviser reviews and signs the exact uploaded file in-system. | student /student/research | cut |
| Upload the final defense manuscript. The assigned adviser must sign the exact uploaded file before it is complete. | student /student/research | review |
| These update automatically after review, panel matching, or scheduling. | student /student/research | review |
| Request your defense date on Defense Schedule. It is added here once staff confirm it. | student /student/research | cut |
| Recorded by the panel chair after the scheduled final defense; revisions, if any, are confirmed before the stage completes. | student /student/research | review |
| Optional context for this submission. | student /student/research | cut |
| Every file for this milestone is already verified. Nothing is left to submit. | student /student/research | cut |
| Appointed: Wed, Jun #, # | student /student/adviser | cut |
| The proposal defense is done, so a change of adviser is no longer possible (Research Protocol, Request for Change of Research Adviser). | student /student/adviser | cut |
| Request a date once your panel is matched; the Research Coordinator confirms it. | student /student/defense-schedule | cut |
| #:# – #:# AM (Philippine time) - On-site - Graduate School Conference Room | student /student/defense-schedule | keep |
| Earliest date: Nov #, #, # days after the adviser signed Form # and the panel received the manuscript. | student /student/defense-schedule | review |
| Your defense date and the deadlines before it, in Philippine time. | student /student/calendar | review |
| When the Research Coordinator books your defense, the date, time and panel appear here. | student /student/calendar | cut |
| Due dates such as sending your manuscript to the panel appear here once a defense is booked. | student /student/calendar | cut |
| Booked defenses, classes and deadlines appear here once a date is set. | student /student/calendar | cut |
| Select a defense or a deadline in the calendar to see its details. | student /student/calendar | review |
| Defenses and deadlines in your own calendar app | research-coordinator /workflow/defense-scheduling, staff /workflow/defense-scheduling, student /student/calendar | cut |
| Get a private link that keeps your phone or Google Calendar up to date with your defenses and deadlines. | research-coordinator /workflow/defense-scheduling, staff /workflow/defense-scheduling, student /student/calendar | cut |
| Choose the request that matches your situation. | student /student/requests | cut |
| Upload your milestone files, submit the files for review, then request scheduling after a panel is assigned. | student /student/requests | review |
| Submit a standalone standing-change or subject-withdrawal request. | student /student/requests | cut |
| Readmission is for students on an approved leave of absence. | student /student/requests | cut |
| Available only while your student record is marked AWOL. | student /student/requests | review |
| Submit practicum evidence when required and request Graduate School graduation endorsement review. | student /student/requests | review |
| Practicum is available only to Psychology and Master of Science in Guidance and Counseling (MSGC) students. | student /student/requests | review |
| The graduation application opens only after coursework, research, completion documents, and any required practicum are complete. | student /student/requests | review |
| Ask for a leave, or more time on one; staff check it, then the Dean decides. | student /student/requests/leave-of-absence | cut |
| Choose the semesters you want to be away and tell us why. Graduate School staff check your request first, then the Dean decides. | student /student/requests/leave-of-absence | cut |
| A leave can last up to # semesters at a time. It can be renewed once. All your leave together can never be more than # semesters. | student /student/requests/leave-of-absence | cut |
| Ask to return when your leave is ending; staff check it, then the Dean decides. | student /student/requests/readmission | cut |
| # rule from the Graduate School policies | dean /dean/approvals/readmission, student /student/requests/readmission | keep |
| Tell the Graduate School you intend to resume while your record is marked AWOL. | student /student/requests/awol-return | cut |
| One subject, until the end of the second week of classes (fees apply). | student /student/requests/withdrawal | review |
| Questions and replies about your requests. | student /student/messages | cut |
| Clarification requests, sent questions, and staff replies will appear here. | student /student/messages | cut |
| Your admission and general files; research files are on the Research page. | student /student/documents | cut |
| Every step on your record and who acts next. | student /student/activity | cut |
| Answers come only from the policy documents and your own records; decisions stay with the office. | academic-coordinator /assistant, dean /dean/assistant, faculty /faculty-portal/assistant (+3) | review |
| Policy documents and your own record only | student /student/assistant | review |
| Enter to send · Shift+Enter for a new line | academic-coordinator /assistant, dean /dean/assistant, faculty /faculty-portal/assistant (+3) | cut |
| Contact the Graduate School office to correct anything here. | student /student/profile | cut |
| # tasks past the due date | academic-coordinator /, research-coordinator /, staff / | keep |
| in the next # days, # awaiting availability | research-coordinator /, staff / | cut |
| Filter a report, then download it as Excel or PDF. | academic-coordinator /reports, research-coordinator /reports, staff /reports | cut |
| Showing the last # months (Nov #, # to Nov #, #), compared with the # months before. The current term is new, so this shows the decisions and defenses of earlier terms too. Choose This term to see only the current term. | academic-coordinator /reports, dean /dean/analytics, research-coordinator /reports (+1) | keep |
| Standing Active, not completed or withdrawn | academic-coordinator /reports, dean /dean/analytics, research-coordinator /reports (+1) | cut |
| # held · # in the next # days · # waiting for a verdict | academic-coordinator /reports, dean /dean/analytics, research-coordinator /reports (+1) | keep |
| # sent to the Dean · # ready now | academic-coordinator /reports, dean /dean/analytics, research-coordinator /reports (+1) | keep |
| Start with the longest bar: that cause affects the most students. Select a bar to list those students. | academic-coordinator /reports, research-coordinator /reports, staff /reports | cut |
| # students need attention: # delayed and # at risk of delay. A student can have more than one cause. | academic-coordinator /reports, research-coordinator /reports, staff /reports | keep |
| Most delayed first, then longest in the same stage. The next owner is the office that can move the student on. | academic-coordinator /reports, research-coordinator /reports, staff /reports | cut |
| Look for stages with slow or stuck students, open each stage, and ask the next owner what is blocking each one. | academic-coordinator /reports, research-coordinator /reports, staff /reports | cut |
| On time: under # days in the stage. Slow: # to # days. Stuck: # days or more. Days in a stage are counted from the day the student entered it. | academic-coordinator /reports, research-coordinator /reports, staff /reports | cut |
| Offices with a long red bar have requests waiting over # days: ask those offices first. The table gives the days an office takes to close a request. | academic-coordinator /reports, staff /reports | cut |
| Open each student and add the missing research record or adviser; the student then leaves this list. | academic-coordinator /reports, research-coordinator /reports, staff /reports | cut |
| Each bar is one school year students started. Select a number to see those students. | academic-coordinator /reports, staff /reports | cut |
| On coursework: Admission, Coursework and Comprehensive Exam. On thesis / dissertation: Proposal Development up to Final Defense. Graduated: Completed. Students on leave, AWOL or withdrawn are counted apart. | academic-coordinator /reports, staff /reports | cut |
| The same students, looked at another way. | academic-coordinator /reports, staff /reports | cut |
| How many students of each program and entry year are at each lifecycle stage. | academic-coordinator /reports, staff /reports | cut |
| Who can graduate, what is still missing, and where each student stands in a batch. | academic-coordinator /reports, staff /reports | cut |
| Overdue tasks and requests still waiting for an answer, by office, longest wait first. | academic-coordinator /reports, staff /reports | cut |
| Export or print the day's changes for the Registrar, then mark each one sent. | academic-coordinator /reports, staff /reports | cut |
| Pick another date, or make changes in Enrollment, Withdrawal, or the standing-change workflows. | academic-coordinator /reports, staff /reports | cut |
| Mark the current planning semester; enrollment and reports use it. | academic-coordinator /term-settings, staff /term-settings | cut |
| Planning: Nov #, # — Dec #, # | academic-coordinator /term-settings, staff /term-settings | cut |
| Open a student for the full record. | academic-coordinator /students, staff /students | cut |
| Showing #–# of # students | academic-coordinator /students, staff /students | keep |
| Compre: eligible after # more subjects | academic-coordinator /students, staff /students | review |
| Open a faculty member to see expertise, panel load and availability. | academic-coordinator /faculty, staff /faculty | cut |
| Select a faculty member to open the profile | academic-coordinator /faculty, staff /faculty | cut |
| Adviser / Panel · angela.cruz@usls.edu.ph | academic-coordinator /faculty, staff /faculty | cut |
| Adviser / Panel · benjamin.reyes@usls.edu.ph | academic-coordinator /faculty, staff /faculty | cut |
| Adviser / Panel · celeste.tan@usls.edu.ph | academic-coordinator /faculty, staff /faculty | cut |
| Adviser / Panel · liwayway.bautista@usls.edu.ph | academic-coordinator /faculty, staff /faculty | cut |
| Adviser / Panel · marlon.geronimo@usls.edu.ph | academic-coordinator /faculty, staff /faculty | cut |
| Adviser / Panel · patricia.salvador@usls.edu.ph | academic-coordinator /faculty, staff /faculty | cut |
| Adviser / Panel · teodoro.ramos@usls.edu.ph | academic-coordinator /faculty, staff /faculty | cut |
| Choose what is being flagged and record the observation. Source-correctable flags can close automatically after a clean monitoring upload. | academic-coordinator /monitoring-sheet, research-coordinator /monitoring-sheet, staff /monitoring-sheet | review |
| Class rosters, filled in from confirmed enrollments. | academic-coordinator /enrollment-class-list, staff /enrollment-class-list | cut |
| Faculty not assigned · Schedule not set · Section not set | academic-coordinator /enrollment-class-list, staff /enrollment-class-list | cut |
| Create a monitoring record from an admission or enrollment signal. | staff /workflow/student-handoff | cut |
| Students, programs and course audits are created from the monitoring sheet. | staff /workflow/student-handoff | cut |
| Expected format: Academic Coordinator Student Monitoring template — program in cell A#, one student per row. | staff /workflow/student-handoff | cut |
| Every uploaded workbook is preserved. Open a version to review conflicts between its values and the current record. | staff /workflow/student-handoff | cut |
| Each import batch is checked, reported to the Dean, and only then recorded as an admission completion. The checklist is derived from the import — it is not ticked by hand. | dean /dean/gate-reports, staff /workflow/student-handoff | review |
| Import a monitoring sheet to open an onboarding report. | staff /workflow/student-handoff | cut |
| Create the Graduate School monitoring record from an admission or enrollment signal. | staff /workflow/student-handoff | cut |
| Forms GS-F-# · Operations Manual #.# | academic-coordinator /enrollment, academic-coordinator /workflow/panel-matching, dean /dean/approvals/leave-of-absence (+13) | cut |
| Decide which subjects to offer, then set the schedule and faculty. | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| # rules from the Graduate School policies · none awaiting sign-off | academic-coordinator /course-adjustments, academic-coordinator /enrollment, academic-coordinator /workflow/awol (+7) | keep |
| Demand is recalculated from the current student records. | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| Draft saved. Review the demand list and submit when ready. | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| This is the Dean's approval of which subjects are offered. The Academic Coordinator approves and publishes the class schedule on Offering setup. | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| Demand numbers are guidance. Every curriculum subject remains available for a manual offering decision. | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| MAED · Master of Arts in Education · planning for AY #-# #st Semester · generated Nov #, #, #:# AM | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| # students reviewed · # subjects needed next term · # student seats needed · # subjects with a backlog | academic-coordinator /course-adjustments, staff /course-adjustments | keep |
| Needing next term: the subject is in the student's next semester group, or the student must retake it. This is the number to plan an offering from. Not taken yet: everyone who still has to take it at some point; never sm | academic-coordinator /course-adjustments, staff /course-adjustments | review |
| Curriculum Development and Evaluation | academic-coordinator /course-adjustments, academic-coordinator /enrollment, staff /course-adjustments (+1) | cut |
| Methods of Educational Research | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| School Administration and Supervision | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| Educational Policy and Planning | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| Teaching Strategies in Higher Education | academic-coordinator /course-adjustments, academic-coordinator /enrollment, staff /course-adjustments (+1) | cut |
| Guidance and Student Development | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| Language and Literacy Education | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| Seminar on Contemporary Issues in Education | academic-coordinator /course-adjustments, academic-coordinator /enrollment, staff /course-adjustments (+1) | cut |
| Action Research in the Classroom | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| Educational Technology and Instruction | academic-coordinator /course-adjustments, academic-coordinator /enrollment, staff /course-adjustments (+1) | cut |
| Educational Leadership and Management | academic-coordinator /course-adjustments, academic-coordinator /enrollment, staff /course-adjustments (+1) | cut |
| Completion issues and missing subjects for the active term, compiled for the Dean's review. | academic-coordinator /course-adjustments, dean /dean/gate-reports, staff /course-adjustments | cut |
| Generate one to send to the Dean. | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| Faculty suggestions are references only; every assignment can be changed. | academic-coordinator /course-adjustments, staff /course-adjustments | review |
| Teaching Strategies in Higher Education · #u | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| Seminar on Contemporary Issues in Education · #u | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| Curriculum Development and Evaluation · #u | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| Educational Leadership and Management · #u | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| Assessment of Learning · #u | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| Educational Technology and Instruction · #u | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| Philosophy of Education · #u | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| Forms GS-F-#, GS-F-# · Operations Manual #.# | academic-coordinator /course-adjustments, academic-coordinator /workflow/graduation, dean /dean/approvals/course-adjustments (+5) | cut |
| Confirming runs every check and updates the class list, monitoring sheet and profile at once. | academic-coordinator /enrollment, staff /enrollment | cut |
| Already finished; cannot be added again. | academic-coordinator /enrollment, staff /enrollment | review |
| Already active in the selected semester. | academic-coordinator /enrollment, staff /enrollment | cut |
| Can be added when offered. | academic-coordinator /enrollment, staff /enrollment | cut |
| Active in another term or has an unresolved monitoring status. | academic-coordinator /enrollment, staff /enrollment | cut |
| Only Not taken subjects can be added; the rest are locked. | academic-coordinator /enrollment, staff /enrollment | review |
| Already completed in the monitoring sheet; it cannot be enrolled again. | academic-coordinator /enrollment, staff /enrollment | review |
| Choose Add on a subject in the list to start this semester's draft. | academic-coordinator /enrollment, staff /enrollment | cut |
| The draft already matches the saved enrollment. Add or remove a subject to change it. | academic-coordinator /enrollment, staff /enrollment | cut |
| Conflict checks run automatically. Safe warnings follow the authoritative record; blocking conflicts are reported without changing enrollment. | academic-coordinator /enrollment, staff /enrollment | cut |
| Durable semester records for this student. | academic-coordinator /enrollment, staff /enrollment | cut |
| Confirm an enrollment draft and its subjects will be listed here. | academic-coordinator /enrollment, staff /enrollment | cut |
| Tag the curriculum version the student is tracked against, then generate the study plan from the curriculum audit and send it to the Academic Coordinator. The plan is derived, never typed. | academic-coordinator /enrollment, staff /enrollment | cut |
| · the student chosen at the top of the page | academic-coordinator /enrollment, staff /enrollment | cut |
| · the only version published | academic-coordinator /enrollment, staff /enrollment | review |
| Assign official semester offerings to an individual student. A class list row marked Dropped is accepted only with an "Unexcused Absence Percent" column above the handbook limit (#%), or a "Drop Exception Reason" that ex | academic-coordinator /enrollment, staff /enrollment | review |
| Completed, current and missing subjects against each curriculum. | academic-coordinator /workflow/course-audit, staff /workflow/course-audit | cut |
| Who completed the chosen subject at the end of the term. | academic-coordinator /workflow/course-audit, staff /workflow/course-audit | cut |
| Subjects not taken yet or failed, in curriculum order; subjects in progress are not missing. | academic-coordinator /workflow/course-audit, staff /workflow/course-audit | cut |
| Decide which subjects are offered on Course Adjustments. | academic-coordinator /workflow/course-audit, staff /workflow/course-audit | cut |
| Map completed, current, and missing subjects to curriculum requirements. | academic-coordinator /workflow/course-audit, staff /workflow/course-audit | cut |
| Form #, Form # and completion evidence for each defense. | academic-coordinator /workflow/research-gate, research-coordinator /workflow/research-gate, staff /workflow/research-gate | cut |
| Showing # of # studentsExport CSVPrint | academic-coordinator /workflow/practicum, academic-coordinator /workflow/research-gate, research-coordinator /workflow/research-gate (+2) | keep |
| Form # is endorsed, the panel is matched and the title is defended. | academic-coordinator /workflow/research-gate, research-coordinator /workflow/research-gate, staff /workflow/research-gate | cut |
| Form # application is submitted and waiting for review. | academic-coordinator /workflow/research-gate, research-coordinator /workflow/research-gate, staff /workflow/research-gate | cut |
| Next: Academic Coordinator | academic-coordinator /workflow/practicum, academic-coordinator /workflow/research-gate, research-coordinator /workflow/research-gate (+2) | cut |
| Next: Research Coordinator | academic-coordinator /workflow/research-gate, research-coordinator /workflow/research-gate, staff /workflow/research-gate | cut |
| The proposal is prepared, signed by the adviser and defended. | academic-coordinator /workflow/research-gate, research-coordinator /workflow/research-gate, staff /workflow/research-gate | cut |
| Still to upload: Proposal defense endorsement; Statistical consultation form or qualitative exemption | academic-coordinator /workflow/research-gate, research-coordinator /workflow/research-gate, staff /workflow/research-gate | cut |
| Final defense requirements and panel decision, then completion evidence. | academic-coordinator /workflow/research-gate, research-coordinator /workflow/research-gate, staff /workflow/research-gate | cut |
| Next: No one, this stage is complete | academic-coordinator /workflow/research-gate, research-coordinator /workflow/research-gate, staff /workflow/research-gate | cut |
| Requests to appoint a research adviser, from Form # to the adviser's acceptance. | academic-coordinator /workflow/research-gate, dean /dean/approvals, research-coordinator /workflow/research-gate (+1) | cut |
| Applications that need your note, forwarding, decision or receipt show up here. | academic-coordinator /workflow/research-gate, dean /dean/approvals, research-coordinator /workflow/research-gate (+1) | cut |
| Form # → Academic Coordinator notes → Research Coordinator sends to the Dean → Dean, Associate Dean or Research Coordinator approves (Form #.#) → adviser accepts → student sends Forms #.# and #.# within # days. | academic-coordinator /workflow/research-gate, research-coordinator /workflow/research-gate, staff /workflow/research-gate | review |
| A card moves to the next column by itself as each step is recorded; this board is for viewing. | academic-coordinator /workflow/research-gate, research-coordinator /workflow/research-gate, staff /workflow/research-gate | cut |
| # rules from the Graduate School policies · # awaiting sign-off | academic-coordinator /workflow/panel-matching, academic-coordinator /workflow/practicum, academic-coordinator /workflow/research-gate (+8) | keep |
| Forms GS-F-#, GS-F-#, GS-F-# · Operations Manual #.# | academic-coordinator /workflow/practicum, academic-coordinator /workflow/research-gate, dean /dean/approvals/practicum (+4) | cut |
| Nominate the panel once the Academic Coordinator endorses Form #. | academic-coordinator /workflow/panel-matching, research-coordinator /workflow/panel-matching, staff /workflow/panel-matching | cut |
| Students whose documents are in and whose next step is this one | academic-coordinator /workflow/panel-matching, research-coordinator /workflow/defense-scheduling, research-coordinator /workflow/panel-matching (+2) | cut |
| Nominate panel members (after the Academic Coordinator's endorsement of Form #) using specialization, availability, workload, and eligibility notes. | academic-coordinator /workflow/panel-matching, research-coordinator /workflow/panel-matching, staff /workflow/panel-matching | review |
| Find a date the student, adviser and panel share, then book it. | research-coordinator /workflow/defense-scheduling, staff /workflow/defense-scheduling | cut |
| All defenses with stage, status, panel and venue, plus the protocol deadlines. Open a defense to reschedule it in the Scheduling tab. | research-coordinator /workflow/defense-scheduling, staff /workflow/defense-scheduling | cut |
| Select a defense or a deadline to see the details. | faculty /faculty-portal/calendar, research-coordinator /workflow/defense-scheduling, staff /workflow/defense-scheduling | review |
| Flagged items (amber or red outline) need someone to act. | faculty /faculty-portal/calendar, research-coordinator /workflow/defense-scheduling, staff /workflow/defense-scheduling | cut |
| Match available dates across student, adviser, and panel, then book, reschedule, or cancel the defense with a recorded reason. | research-coordinator /workflow/defense-scheduling, staff /workflow/defense-scheduling | cut |
| MOA, hours, certificates and the completion report, for Psychology and MSGC students. | academic-coordinator /workflow/practicum, staff /workflow/practicum | cut |
| Practicum is restricted to students enrolled in a Psychology program or the Master of Science in Guidance and Counseling (MSGC). Students from every other program are excluded from the practicum roster and actions. | academic-coordinator /workflow/practicum, staff /workflow/practicum | cut |
| # more stages to the right → | academic-coordinator /workflow/graduation, academic-coordinator /workflow/practicum, dean /dean/approvals/graduation (+7) | keep |
| Waiting for the student's MOA. | academic-coordinator /workflow/practicum, staff /workflow/practicum | cut |
| Staff receive the MOA and forward it. | academic-coordinator /workflow/practicum, staff /workflow/practicum | cut |
| Next: Graduate School Staff | academic-coordinator /workflow/awol, academic-coordinator /workflow/graduation, academic-coordinator /workflow/practicum (+12) | cut |
| The Academic Coordinator checks the MOA. | academic-coordinator /workflow/practicum, staff /workflow/practicum | cut |
| Waiting for: Academic Coordinator | dean /dean/approvals/graduation, research-coordinator /workflow/graduation, staff /workflow/graduation (+1) | cut |
| Certificates and hours are being checked. | academic-coordinator /workflow/practicum, staff /workflow/practicum | cut |
| Open the case to: Forward documents to Academic Coordinator | staff /workflow/practicum | cut |
| The student is completing the hours. | academic-coordinator /workflow/practicum, staff /workflow/practicum | cut |
| Hours verified. The report goes to the Dean. | academic-coordinator /workflow/practicum, staff /workflow/practicum | cut |
| Track practicum MOA receipt, hours, certificates, completion report, and Dean review for Psychology and MSGC students only. Practicum applies to Psychology and MSGC students only; other programs are not listed. | academic-coordinator /workflow/practicum, staff /workflow/practicum | review |
| A card moves to the next column by itself as each step is approved. Drag a card up or down to reorder it inside its column. | academic-coordinator /workflow/graduation, academic-coordinator /workflow/practicum, dean /dean/approvals/withdrawal (+4) | cut |
| MSGC - Master of Science in Guidance and Counseling / Psychology program or MSGC | academic-coordinator /workflow/practicum, staff /workflow/practicum | cut |
| Final Defense / Completed | academic-coordinator /workflow/practicum, staff /workflow/practicum | cut |
| System-detected certificate submissions: # | academic-coordinator /workflow/practicum, staff /workflow/practicum | cut |
| New submissions, messages, and decisions will appear here. | academic-coordinator /workflow/graduation, academic-coordinator /workflow/practicum, research-coordinator /workflow/graduation (+2) | cut |
| Awaiting student submission. | academic-coordinator /workflow/practicum, staff /workflow/practicum | cut |
| Eligibility checks, the Dean's endorsement and the list for the Registrar. | academic-coordinator /workflow/graduation, research-coordinator /workflow/graduation, staff /workflow/graduation | cut |
| Showing # of # recordsExport CSVPrint | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | keep |
| Waiting for the student's signed application. | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| Thesis / research completed | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| Completed courses: MAED-FED, MAED-MOR, MAED-STAT, MAED-COG# +# more | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| Waiting for: Student (signed application) | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| Staff can now create a graduation batch. | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| Staff forward it for coursework review. | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| # candidate · Select batch | academic-coordinator /workflow/graduation, research-coordinator /workflow/graduation, staff /workflow/graduation | keep |
| The Academic Coordinator checks coursework. | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| Nothing to do yet – waiting for Academic Coordinator to act on this batch. | dean /dean/approvals/graduation, research-coordinator /workflow/graduation, staff /workflow/graduation | cut |
| The Research Coordinator checks the evidence. | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| Nothing to do yet – waiting for Research Coordinator to act on this batch. | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, staff /workflow/graduation | cut |
| Waiting for: Research Coordinator | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, staff /workflow/graduation | cut |
| Staff prepare the list or revise it. | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| The Dean approves or returns the list. | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| Nothing to do yet – waiting for Dean to decide on this batch. | academic-coordinator /workflow/graduation, research-coordinator /workflow/graduation, staff /workflow/graduation | cut |
| The Dean exports; staff then mark it sent. | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| # candidates · Select batch | academic-coordinator /workflow/graduation, research-coordinator /workflow/graduation, staff /workflow/graduation | keep |
| Waiting for: Dean (export) | academic-coordinator /workflow/graduation, research-coordinator /workflow/graduation, staff /workflow/graduation | cut |
| Every batch and where it stands. Open the stage check to follow it step by step. | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | cut |
| # candidate · Updated Oct #, # | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | keep |
| # candidate · Updated Sep #, # | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | keep |
| # candidate · Updated Mar #, # | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | keep |
| # candidate · Updated Nov #, # | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation (+1) | keep |
| Review candidate eligibility across coursework, research, practicum, Dean endorsement, and CSV export for manual Registrar email. The Academic Coordinator checks coursework, the Research Coordinator validates research ev | academic-coordinator /workflow/graduation, research-coordinator /workflow/graduation, staff /workflow/graduation | cut |
| Nothing to do yet – waiting for Student to act on this batch. | academic-coordinator /workflow/graduation, research-coordinator /workflow/graduation, staff /workflow/graduation | cut |
| Time on leave still counts toward the maximum residence. | staff /workflow/leave-of-absence | cut |
| Showing # of # requestsExport CSVPrint | dean /dean/approvals/leave-of-absence, dean /dean/approvals/readmission, dean /dean/approvals/withdrawal (+3) | keep |
| Waiting for Graduate School staff to start. | dean /dean/approvals/leave-of-absence, dean /dean/approvals/readmission, staff /workflow/leave-of-absence (+1) | cut |
| Waiting for the Dean's decision. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, dean /dean/approvals/leave-of-absence (+6) | cut |
| Approved; the leave has not started yet. | dean /dean/approvals/leave-of-absence, staff /workflow/leave-of-absence | cut |
| The student is away. Enrollment is closed. | dean /dean/approvals/leave-of-absence, staff /workflow/leave-of-absence | cut |
| Dean-approved requests that go to the Registrar. The portal does not send any email: download the list, email it yourself, then mark it as sent. Mark it as acknowledged when the Registrar confirms. | staff /workflow/awol, staff /workflow/leave-of-absence, staff /workflow/readmission | cut |
| Nothing ticked: a download includes every request still waiting to go out. | staff /workflow/awol, staff /workflow/leave-of-absence | cut |
| Drag a card to another column, or use "Move to..." on the card; both do the same as the buttons in its window. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, dean /dean/approvals/leave-of-absence (+5) | cut |
| Advice for staff - the Dean decides. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, dean /dean/approvals/leave-of-absence (+6) | cut |
| Suggested for the Dean: Approve | dean /dean/approvals/leave-of-absence, dean /dean/approvals/withdrawal, staff /workflow/leave-of-absence (+1) | cut |
| Student portal Leave of Absence application | dean /dean/approvals/leave-of-absence, staff /workflow/leave-of-absence | cut |
| Family and health reasons | dean /dean/approvals/leave-of-absence, staff /workflow/leave-of-absence | cut |
| AY #-# #st Semester to AY #-# #st Semester (# semester(s)); a leave may be approved for up to # semester(s) at a time (Graduate School Handbook #-#, p. #). | dean /dean/approvals/leave-of-absence, staff /workflow/leave-of-absence | cut |
| # semester(s) of leave already approved + # requested = #. A leave may be renewed for at most another year, so all leave together cannot pass # semesters (Graduate School Handbook #-#, p. #). | dean /dean/approvals/leave-of-absence, staff /workflow/leave-of-absence | keep |
| Estimated completed residency: # semester(s) from entry year #; at least # expected (Proposed rule (agreed with the Graduate School, awaiting sign-off)). | dean /dean/approvals/leave-of-absence, staff /workflow/leave-of-absence | cut |
| Normal length # years. The most allowed is # years. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, dean /dean/approvals/leave-of-absence (+4) | cut |
| Earlier leaves count toward the total limit. | dean /dean/approvals/leave-of-absence, dean /dean/approvals/readmission, staff /students/1 (+3) | cut |
| No earlier requests in this process. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, dean /dean/approvals/leave-of-absence (+6) | cut |
| Notes and returns about this request, newest at the bottom. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, dean /dean/approvals/leave-of-absence (+6) | cut |
| No files were uploaded for this request. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, dean /dean/approvals/leave-of-absence (+4) | cut |
| Dean-approved requests go on the Registrar list below the board. The portal does not send any email: download the list, email it through the official channel and wait for the Registrar's acknowledgement. | dean /dean/approvals/leave-of-absence, dean /dean/approvals/readmission, staff /workflow/leave-of-absence (+1) | cut |
| Nothing to send yet. The link appears after the Dean approves. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, dean /dean/approvals/leave-of-absence (+6) | review |
| Approved students become active in the program again. | staff /workflow/readmission | cut |
| Business Office clearance | dean /dean/approvals/readmission, staff /workflow/readmission | cut |
| Approved requests appear here after the Dean decides. | staff /workflow/readmission | review |
| # rule from the Graduate School policies · none awaiting sign-off | staff /workflow/readmission | keep |
| Suggested for the Dean: Return for Revision | dean /dean/approvals/readmission, staff /workflow/readmission | cut |
| Student portal readmission request | dean /dean/approvals/readmission, staff /workflow/readmission | cut |
| AY #-# #nd Semester | dean /dean/approvals/readmission, staff /workflow/readmission | cut |
| AY #-# #st Semester | dean /dean/approvals/readmission, staff /workflow/readmission | cut |
| All checklist items are selected. | dean /dean/approvals/readmission, staff /workflow/readmission | cut |
| Student is currently recorded as on leave. | dean /dean/approvals/readmission, staff /workflow/readmission | cut |
| No leave case is on file; the previous leave period was entered in the request. Confirm it with the Registrar record. | dean /dean/approvals/readmission, staff /workflow/readmission | cut |
| The written intention and the subject evaluation are confirmed by the records. | dean /dean/approvals/readmission, staff /workflow/readmission | cut |
| Checked by the system: The reason written in this request is the written intention to enroll. | dean /dean/approvals/readmission, staff /workflow/readmission | cut |
| Checked by the system: # of # subjects completed; # still to take. Adviser on record: none. | dean /dean/approvals/readmission, staff /workflow/readmission | cut |
| Not verified by staff yet. | dean /dean/approvals/readmission, staff /workflow/readmission | cut |
| AWOL cases flagged by policy, return declarations and residency records. | academic-coordinator /workflow/awol, staff /workflow/awol | cut |
| Showing # of # casesExport CSVPrint | academic-coordinator /workflow/awol, dean /dean/approvals/awol, staff /workflow/awol | keep |
| # more stage to the right → | academic-coordinator /workflow/awol, dean /dean/approvals/awol, staff /workflow/awol | keep |
| Flagged from source records. Waiting for the student's written return. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, staff /workflow/awol | cut |
| Within the residence limits: # of # years used | academic-coordinator /workflow/awol, dean /dean/approvals/awol, staff /workflow/awol | review |
| Staff check the written return against the residence limits, then forward it. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, staff /workflow/awol | cut |
| Active no-subject residency semesters. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, staff /workflow/awol | cut |
| Recorded residency semesters go to the Registrar. Download the report and email it through the official channel. | staff /workflow/awol | cut |
| Forms GS-F-#, GS-F-# · Operations Manual #.#, #.# | academic-coordinator /workflow/awol, dean /dean/approvals/awol, staff /workflow/awol | cut |
| Suggested for the Dean: Return for Missing Information | academic-coordinator /workflow/awol, dean /dean/approvals/awol, staff /workflow/awol | cut |
| Student is currently recorded AWOL. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, staff /workflow/awol | cut |
| Complete the structured written return declaration addressed through the Graduate School Dean. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, staff /workflow/awol | cut |
| # year(s) in program; normal Master's limit is # years. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, staff /workflow/awol | keep |
| After the Dean approves a return, staff download the return report and send it to the Registrar through the official channel. Enrollment itself stays a separate Academic Coordinator step. | academic-coordinator /workflow/awol, dean /dean/approvals/awol, staff /workflow/awol | review |
| One subject, until the end of the second week of classes; standing does not change. | staff /workflow/withdrawal | review |
| Waiting for Graduate School staff to record and forward. | dean /dean/approvals/withdrawal, staff /workflow/withdrawal | cut |
| Within the withdrawal window | dean /dean/approvals/withdrawal, staff /workflow/withdrawal | review |
| Approved. Staff tag the subject as Withdrawn. | dean /dean/approvals/withdrawal, staff /workflow/withdrawal | cut |
| Tagged. Staff export the approved-withdrawals Excel list. | dean /dean/approvals/withdrawal, staff /workflow/withdrawal | cut |
| Tick the students to put in one batch. | staff /workflow/withdrawal | cut |
| Dean-approved withdrawals whose subject is tagged go to the Registrar. The portal does not send any email: download the Excel list, email it through the official channel, and wait for the Registrar to acknowledge. | staff /workflow/withdrawal | cut |
| # tagged withdrawal waiting for the Excel list. | staff /workflow/withdrawal | keep |
| The selected subject is Enrolled. | dean /dean/approvals/withdrawal, staff /workflow/withdrawal | cut |
| The request form is on file. | dean /dean/approvals/withdrawal, staff /workflow/withdrawal | cut |
| Tagged withdrawals go out on the approved-withdrawals Excel list. The portal does not send any email: export the list, email it through the official channel and wait for the Registrar's acknowledgement. | dean /dean/approvals/withdrawal, staff /workflow/withdrawal | cut |
| Open tasks, students at risk of delay, and monitoring conflicts. | academic-coordinator /work-queue, research-coordinator /work-queue, staff /work-queue | cut |
| Every recorded step, with who did it and when. | staff /activity | cut |
| Showing # of # activities | staff /activity | keep |
| Seeded for the panel demo. | staff /activity | cut |
| Subject: MAED-COG#. Effective semester: AY #-# #st Semester. | staff /activity | cut |
| Seeded for the panel demo: the Academic Coordinator sends the report to the Dean. | staff /activity | cut |
| Seeded for the panel demo: the Academic Coordinator verifies completion. | staff /activity | cut |
| Seeded for the panel demo: staff forward; the Academic Coordinator requests more certificates. | staff /activity | cut |
| Seeded for the panel demo: staff enter the hours (the certificate states none) and forward. | staff /activity | cut |
| Seeded for the panel demo: the student uploads the certificate. | staff /activity | cut |
| Seeded for the panel demo: the Academic Coordinator marks the practicum in progress. | staff /activity | cut |
| Seeded for the panel demo: staff forward the MOA. | staff /activity | cut |
| The student sent the certificates and reported # hours. | staff /activity | cut |
| Approved for the Registrar list; ready to export. | staff /activity | cut |
| GS Staff · AC Student Monitoring import · next owner: Academic Coordinator | staff /activity | cut |
| Program MASS; # subjects; # subject status change(s) across # student(s). | staff /activity | cut |
| Requested period: AY #-# #nd Semester. Approved. The leave starts next semester. | staff /activity | cut |
| Eligibility result: Needs Review. Policy check: Needs Review. The LOA request needs staff review because required details are missing or uncertain. | staff /activity | review |
| Graduate School staff started checking the request against the handbook rules. | staff /activity | cut |
| Requested period: AY #-# #nd Semester. Semesters: #. Reason: Family emergency. Caring for a family member during the coming semester. Filed through the student portal form. | staff /activity | cut |
| Program MSCS; # subjects; # subject status change(s) across # student(s). | staff /activity | cut |
| Coursework, research and post-defense evidence are complete. | staff /activity | cut |
| Program DBA; # subjects; # subject status change(s) across # student(s). | staff /activity | cut |
| The official/imported student standing is AWOL. Registration privileges are restricted pending a structured return declaration. | staff /activity | cut |
| The Graduate School has no enrollment for you this semester and has marked you as absent without leave. You are still a student. Open Return from AWOL to tell the Graduate School you are coming back. | staff /activity | cut |
| Target return semester: AY #-# #st Semester. Policy classification: Within Maximum Residence. | staff /activity | review |
| Program MAN; # subjects; # subject status change(s) across # student(s). | staff /activity | cut |
| Academic Coordinator · Course Adjustments · next owner: Dean | staff /activity | cut |
| Proposed offerings from the subject demand of the current students. | staff /activity | cut |
| Policy classification: Within Maximum Residence. | staff /activity | review |
| Coursework, research, and post-defense evidence are complete. Candidate is ready to begin graduation endorsement review. | staff /activity | cut |
| Program MBA; # subjects; # subject status change(s) across # student(s). | staff /activity | cut |
| No formal leave or enrollment was recorded. The student may submit a written return intent when ready. | staff /activity | cut |
| Program MSN; # subjects; # subject status change(s) across # student(s). | staff /activity | cut |
| General · policy documents and all students | staff /assistant | cut |
| Optional: ground answers in one record | staff /assistant | cut |
| The documents the Policy Assistant searches; documents not yet validated are flagged. | staff /policy-documents | cut |
| See which passages the Policy Assistant would use for a question. | staff /policy-documents | cut |
| Staff uploads can be edited, replaced, or removed. Built-in sources are view-only. | staff /policy-documents | review |
| USLS_GS_Operations_Manual_-_DRAFT_for_Validation.docx | staff /policy-documents | cut |
| The capstone group's written description of how the Graduate School carries out each process, with the business rules register. A draft: every answer that uses it says it is pending validation. | staff /policy-documents | cut |
| DOCX# KB# searchable sections | staff /policy-documents | cut |
| System Administrator · Nov #, #, #:# PM | staff /policy-documents | cut |
| Complete-GS-Research-Protocol-Updated-for-AY#-#-without-publication-protocol-#.docx | staff /policy-documents | cut |
| Built-in policy source managed with the application files. | staff /policy-documents | cut |
| System library · Nov #, #, #:# PM | staff /policy-documents | cut |
| GRADUATE-SCHOOL-HANDBOOK-#-#.pdf | staff /policy-documents | cut |
| Each rule with its handbook or protocol page; where the system and the handbook disagree, the handbook wins. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| The normal load of a part-time graduate student starts at # units per semester. The portal shows the load on the enrollment preview; a lighter load is allowed for residency, thesis or final-term students, so it is inform | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| Source: Graduate School Handbook #-#, p. # · Registration - Academic Load | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| This rule is set by the Graduate School Handbook #-#, p. #. It changes only when the Graduate School issues a new policy; upload the new policy under Policy Documents. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Not checked by the system: The handbook calls this the normal load, not a hard limit; the portal shows it as information only. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| The normal load of a part-time graduate student is at most # units per semester. Above # units the student is carrying a full-time load. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| The normal load of a full-time graduate student is # units per semester. Enrolling more than this in one semester is flagged on the enrollment preview and needs a documented exception before it can be saved. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| A student with no subjects to take may enroll for residence only to work on the thesis/dissertation, the practicum/internship, to complete an INC, to take the comprehensive exam or to wait for a publication. A student wh | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Handbook #-#, p. # · Registration - Residency Enrollment | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| An incomplete grade must be removed within one academic year, otherwise it becomes #.# (master's) or #.# (doctorate) and the subject must be taken again. A student with an INC in every subject is dropped from the rolls. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Handbook #-#, p. # · Academic Performance - Incomplete Grades | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| Not checked by the system: Grades are outside the system's scope (stakeholder decision). | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| Adding subjects is allowed during the first week of classes (# calendar days from the start of classes) with the written approval of the Associate Dean. After that, an addition is flagged on the enrollment preview and ca | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Handbook #-#, p. # · Registration - Adding of Subject/s | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| Changing one subject for another is allowed during the first week of classes (# calendar days from the start of classes) only if the original subject was dissolved, the student has a schedule conflict, or the student fai | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Handbook #-#, pp. #-# · Registration - Change of Subject | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| This rule is set by the Graduate School Handbook #-#, pp. #-#. It changes only when the Graduate School issues a new policy; upload the new policy under Policy Documents. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| The reason for a change must be one of: the original subject is dissolved, a conflict in schedules, or failure in the prerequisite subject. Staff confirm the reason; the system records the exception but cannot see the sc | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Handbook #-#, p. # · Registration - Change of Subject | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| Not checked by the system: The reason is confirmed by staff and the Associate Dean; schedules and grades are outside the portal. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| A student may withdraw subjects until the end of the second week from the start of classes (# calendar days), whether or not classes were attended. The request needs the Dean's approval. It is not free: the fee consequen | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Handbook #-#, p. # · Registration - Withdrawal of Subject | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| Withdrawals filed within the first # calendar days of classes fall in the first-week fee tier; days # to # fall in the second-week tier. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Handbook #-#, pp. #-# · Fees and Expenses - Refund of Fees | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| #% of the total amount due for the term is charged when the subject is withdrawn within the first week of classes, regardless of whether classes were attended. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | keep |
| Source: Graduate School Handbook #-#, pp. #, # · Registration - Withdrawal of Subject; Fees - Refund of Fees | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| This rule is set by the Graduate School Handbook #-#, pp. #, #. It changes only when the Graduate School issues a new policy; upload the new policy under Policy Documents. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Not checked by the system: The portal shows the fee consequence as information; it does not compute or collect payments (Business Office). | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| #% of the total amount due for the term is charged when the subject is withdrawn within the second week of classes. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | keep |
| After the second week a single subject cannot be withdrawn. To leave the semester, file a Leave of Absence (full fees apply, Handbook p.#); a justifiable reason limits the charge to the last month of attendance. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Handbook #-#, p. # · Fees and Expenses - Refund of Fees | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| A student is expected to attend regularly; the maximum absences allowed is #% of the class hours for the semester. When unexcused absences in one subject go beyond #%, the professor automatically drops the student from t | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Handbook #-#, p. # · Attendance - Limits on Absences | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| A subject dropped for absences carries the grade DRP with a value of #.#. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| To remain in good standing a master's student keeps a weighted average of #.# or better at the end of each academic year. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| Source: Graduate School Handbook #-#, p. # · Academic Performance - Retention Policy | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| To remain in good standing a doctorate student keeps a weighted average of #.# or better at the end of each academic year. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| A student who gets a #.# is automatically dropped from the program, and failure in any subject means no re-admission to the program. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| A request for a leave of absence is made in writing to the Dean. It states the reason for the leave and specifies the period. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| Source: Graduate School Handbook #-#, p. # · Attendance - Leave of Absence | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| A leave of absence may be approved for a period of one year (two semesters). | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| The leave may be renewed for at most another year, so all approved leave together cannot pass two years (four semesters). | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| No leave of absence is granted during a semester within two weeks (# days) before the last day of classes. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Handbook #-#, p. # · Attendance - Leave of Absence, guideline # | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| For a leave filed by the student himself or herself during the second half of the semester, the class standing of the enrolled courses becomes W (withdrawn) and no refund of tuition and fees is given. The portal shows th | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| The student must have completed at least one semester before filing a leave. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Proposed rule (agreed with the Graduate School, awaiting sign-off) | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| Pending validation — can be adjusted until the Graduate School confirms | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Check this value against the policy, then confirm or adjust it to clear the flag. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| Graduate School staff see the leave as Return Due, and the student is reminded to file a readmission request or ask for an extension, this many days before the leave ends. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| If a leave has ended and no readmission was filed after this many days, the system proposes AWOL. A Graduate School staff member confirms it; nothing changes automatically. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| A student who withdraws from the college without a formal leave of absence is considered absent without leave (AWOL) and has registration privileges curtailed or withdrawn. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| A student returning from a leave of absence or AWOL declares the intention to enroll by writing to the University Registrar through the Graduate School Dean, who endorses it to the Registrar. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| Source: Graduate School Handbook #-#, p. # · Attendance - Leave of Absence (return) | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| A master's student completes all requirements within five academic years from the date of admission. Beyond that the student needs the extension below. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Handbook #-#, p. # · Maximum Residence - Master's Program | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| A master's program must be finished within seven academic years including leave of absence. A student who cannot finish within seven years re-enrolls all courses taken. The residence clock is not paused during a leave. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| A doctorate student completes all requirements, including the dissertation, within seven academic years from the date of admission. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Handbook #-#, p. # · Maximum Residence - Doctorate Program | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| A doctoral program must be finished within nine academic years including leave of absence. A student who cannot finish within nine years re-enrolls all courses taken. The residence clock is not paused during a leave. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| A student who cannot comply with the normal maximum residence is allowed a maximum two-year extension. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Handbook #-#, pp. #-# · Maximum Residence | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| During the two-year extension the student enrolls in a graded #-unit refresher course related to the area of specialization. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| The maximum-residence limits include leave of absence. The residency clock keeps running while a student is on leave; it is never paused. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| Source: Graduate School Handbook #-#, p. # · Maximum Residence | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| Candidacy to the degree must be attained within three academic years from the date of admission. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Not checked by the system: Candidacy status is decided by the Graduate School and is not tracked as a date in the system. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| Candidacy to the degree must be attained within five academic years from the date of admission. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| A student who passes the comprehensive examination confers with the Dean for an adviser and is advanced to candidacy. Research stages (Form # title defense onward) stay locked until the comprehensive exam is marked Passe | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Handbook #-#, p. # · Comprehensive Examinations - Advancement to Candidacy | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| Thesis or project paper writing must be finished within two years from the title defense (or proposal defense). The proposal must be submitted and defended within one year of the title defense. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Handbook #-#, p. # · Project Paper, Thesis & Dissertation - Standards | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| Not checked by the system: The deadline is tracked by staff; the system shows time in stage but does not block on it. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Dissertation writing must be finished within three years from the title defense. The proposal must be submitted and defended within one year of the title defense. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| The final draft undergoes Turnitin scanning and a similarity index rating of not more than #% is required before the paper goes to the editor. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Research Protocol AY #-# · Closed-door Final Defense - After the defense (Turnitin scanning) | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| This rule is set by the Graduate School Research Protocol AY #-# (Closed-door Final Defense - After the defense (Turnitin scanning)). It changes only when the Graduate School issues a new policy; upload the new policy un | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| A student may request only one change of the title of the study, before applying for the proposal defense. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Research Protocol AY #-# · Change of Title of the Study | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| This rule is set by the Graduate School Research Protocol AY #-# (Change of Title of the Study). It changes only when the Graduate School issues a new policy; upload the new policy under Policy Documents. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Not checked by the system: Not tracked by the system yet; the panel and the Research Coordinator enforce it. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| A student may request only one change of research adviser, before the proposal defense. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Research Protocol AY #-# · Request for Change of Research Adviser | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| This rule is set by the Graduate School Research Protocol AY #-# (Request for Change of Research Adviser). It changes only when the Graduate School issues a new policy; upload the new policy under Policy Documents. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Once the research adviser is appointed, the student emails Form #.# (Research Timetable) and Form #.# (Thesis/Dissertation Advising Contract) to the GS Research Coordinator within # days of receiving Form #.#. The advise | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Research Protocol AY #-# · Designation of the Research Adviser - II. Advising Contract | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| This rule is set by the Graduate School Research Protocol AY #-# (Designation of the Research Adviser - II. Advising Contract). It changes only when the Graduate School issues a new policy; upload the new policy under Po | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| An adviser is reminded when an advisee's manuscript or endorsement has waited for their signature this many days. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| Form # with the three concept papers must reach the Academic Coordinator, and be endorsed to the Research Coordinator, at least two weeks (# days) before the scheduled title defense. A title defense cannot be scheduled s | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Research Protocol AY #-# · Title Defense - I. Application for Title Defense | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| This rule is set by the Graduate School Research Protocol AY #-# (Title Defense - I. Application for Title Defense). It changes only when the Graduate School issues a new policy; upload the new policy under Policy Docume | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Form # is endorsed at least two weeks (# days) before the proposal defense; the panel members receive the manuscript two weeks before to review it (the #-Day Rule). | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Research Protocol AY #-# · Proposal Defense - I. Application for Proposal Defense | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| This rule is set by the Graduate School Research Protocol AY #-# (Proposal Defense - I. Application for Proposal Defense). It changes only when the Graduate School issues a new policy; upload the new policy under Policy  | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Form # and the manuscript are endorsed at least two weeks (# days) before the closed-door final defense, following the #-Day Rule (# days, weekends included, from the day the panel receives the manuscript). | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Research Protocol AY #-# · Closed-door Final Defense - I. Application | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| This rule is set by the Graduate School Research Protocol AY #-# (Closed-door Final Defense - I. Application). It changes only when the Graduate School issues a new policy; upload the new policy under Policy Documents. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| The application for the public final defense (Form #.#) is made # days before the preferred schedule so that the Graduate School can post the announcement. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Research Protocol AY #-# · Public Defense - I. Application for the Public Defense | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| This rule is set by the Graduate School Research Protocol AY #-# (Public Defense - I. Application for the Public Defense). It changes only when the Graduate School issues a new policy; upload the new policy under Policy  | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| A project paper panel has # Panel Chair and # members (# Content Specialist, # Method Specialist), # in all. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| Source: Graduate School Handbook #-#, p. # · Guidelines for Thesis/Dissertation - Application for Title Defense | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| A thesis panel has # Panel Chair and # members (# Content Specialist, # Method Specialist, # External Panel), # in all. The external member joins from the proposal defense onward. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| A dissertation panel has # Panel Chair and # members (# Content Specialists, # Method Specialist, # External Panel), # in all. The external member joins from the proposal defense onward. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| For a thesis a score below # on Form # is a provisional pass with major revisions (subject for re-defense). For a dissertation the line is #. The panel chair enters the Form # score in the verdict form, which refuses a p | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| Source: Graduate School Research Protocol AY #-# · Closed-door Final Defense - II. During the defense | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| This rule is set by the Graduate School Research Protocol AY #-# (Closed-door Final Defense - II. During the defense). It changes only when the Graduate School issues a new policy; upload the new policy under Policy Docu | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| For a dissertation a score below # on Form # is a provisional pass with major revisions (subject for re-defense). The verdict form refuses a plain pass below this value. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| The student, the adviser and the panel get an in-app reminder this many days before a confirmed defense (the first is also the #-Day Rule check that the panel has the manuscript). | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| A panelist whose availability is still not entered this many days after staff asked for it is reminded again. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| The number of practicum hours a student must complete before the practicum is marked complete. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Basic-course units a student must have completed before starting the practicum. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Major-course units a student must have completed before starting the practicum. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Cognate-course units a student must have completed before starting the practicum. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Total course units a student must have completed before starting the practicum. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| A student who enrolled in August # or later presents the thesis or dissertation at a research conference (the Graduate School Research Conference or an external one) and submits the certificate of presentation. Only grad | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Research Protocol AY #-# · Public Defense - After the Public Defense (note) | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| This rule is set by the Graduate School Research Protocol AY #-# (Public Defense - After the Public Defense (note)). It changes only when the Graduate School issues a new policy; upload the new policy under Policy Docume | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Not checked by the system: The certificate of presentation is submitted to the Graduate School Office and checked by staff. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| Before the hard-bound copies: soft copy of the final manuscript, panel approval emails, ethics clearance, Turnitin certificate and the editor's certification (Form #); then the approval sheet (Form #). | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Research Protocol AY #-# · Closed-door Final Defense - After the defense | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| This rule is set by the Graduate School Research Protocol AY #-# (Closed-door Final Defense - After the defense). It changes only when the Graduate School issues a new policy; upload the new policy under Policy Documents | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| The most teaching units a faculty member can be assigned in one semester when course offerings are matched to faculty. | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| A faculty member can be assigned at most five active advisees per semester; more only with the approval of the Dean. The Research Protocol (Designation of the Research Adviser) says the same. The adviser appointment bloc | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | review |
| Source: Graduate School Handbook #-#, p. # · Project Paper, Thesis & Dissertation - Adviser | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) | cut |
| The Graduate School Handbook #-# is in force. Rules set by the Handbook or the Research Protocol are locked: those rules change only when the Graduate School issues a new policy (upload it under Policy Documents). Protot | staff /business-rules | review |
| isabel.flores@student.usls.edu.ph | staff /students/1 | cut |
| Completed, current, and missing subjects vs curriculum | staff /students/1, staff /students/5 | cut |
| The result decides whether the research steps open | staff /students/1, staff /students/5 | cut |
| Milestone gate and required document checklist | staff /students/1, staff /students/5 | review |
| Thesis · current gate: Completion Evidence | staff /students/1 | cut |
| Earlier leave of absence and readmission cases (view only) | staff /students/1, staff /students/5 | review |
| This student has no leave of absence or readmission case. | staff /students/1, staff /students/5 | cut |
| No active withdrawal request | staff /students/1 | cut |
| Current review window · For Review | staff /students/1 | cut |
| Computed from this record | staff /students/1, staff /students/5 | cut |
| No recommended follow-ups for this student. | staff /students/1 | cut |
| On-site · Graduate School Conference Room | staff /students/1 | cut |
| adrian.lim@student.usls.edu.ph | staff /students/5 | cut |
| No research case opened yet. | staff /students/5 | cut |
| Dean: Pending · fees: Pending | staff /students/5 | cut |
| Resolve graduation missing coursework | staff /students/5 | cut |
| Why: No recorded update in # days at the Coursework stage | staff /students/5 | cut |
| Owner: Graduate School Staff | staff /students/5 | cut |
| Why: # subject(s) missing or incomplete in the course audit | staff /students/5 | cut |
| Owner: Academic Coordinator | staff /students/5 | cut |
| Readmission · MAED · AY #-# #nd Semester | dean /dean | cut |
| Waiting # days · filed Sep #, # | dean /dean | cut |
| Practicum Reports · MAPSY · #/# hours · Report Sent to Dean | dean /dean | cut |
| Subject Withdrawal · MAED · MAED-COG# · AY #-# #st Semester | dean /dean, dean /dean/activity | cut |
| Leave of Absence · MAED · AY #-# #nd Semester | dean /dean, dean /dean/activity | cut |
| Course Adjustments · AY #-# #nd Semester | dean /dean, dean /dean/activity | cut |
| Waiting # days · filed Oct #, # | dean /dean | cut |
| AWOL & Residency · MAED · Within Maximum Residence | dean /dean | review |
| Graduation Endorsement · MAED · Batch # October # · Current review window | dean /dean | cut |
| Open a case to see its files and history before you decide. | dean /dean/approvals | review |
| MAED · AY #-# #nd Semester | dean /dean/approvals | cut |
| MAPSY · #/# hours · Report Sent to Dean | dean /dean/approvals | cut |
| MAED · MAED-COG# · AY #-# #st Semester | dean /dean/approvals | cut |
| MAED · Within Maximum Residence | dean /dean/approvals | review |
| MAED · Batch # October # · Current review window | dean /dean/approvals | cut |
| Applications waiting on someone else show up here. | dean /dean/approvals | cut |
| Accepted advisers whose Forms #.# and #.# are still to come show up here. | dean /dean/approvals | cut |
| # of # advisees - at the limit | dean /dean/approvals | keep |
| Approve each course offering plan or return it for revision. | dean /dean/approvals/course-adjustments | cut |
| AY #-# #nd Semester · # subject(s) proposed · submitted Oct #, # | dean /dean/approvals/course-adjustments | cut |
| Required to return for revision. | dean /dean/approvals/course-adjustments | review |
| Your decision is recorded as your electronic approval (GS-P-#). | dean /dean/approvals/course-adjustments | cut |
| Approve, return or deny each request forwarded to you. | dean /dean/approvals/leave-of-absence, dean /dean/approvals/readmission | cut |
| Waiting for: Graduate School Staff | academic-coordinator /workflow/graduation, academic-coordinator /workflow/practicum, dean /dean/approvals/awol (+5) | cut |
| No step is open right now. | dean /dean/approvals/leave-of-absence, dean /dean/approvals/readmission, dean /dean/approvals/withdrawal | cut |
| Return declarations forwarded to you, and the residency records on file. | dean /dean/approvals/awol | cut |
| Approve each withdrawal, or return it to the student to correct. | dean /dean/approvals/withdrawal | cut |
| Completion reports sent to you for a final review. | dean /dean/approvals/practicum | cut |
| Reports the Academic Coordinator sent to you. | dean /dean/approvals/practicum | cut |
| Marked reviewed by the Dean. | dean /dean/approvals/practicum | cut |
| Finished - nothing more to do | dean /dean/approvals/practicum | cut |
| Approve or return each endorsement list, then export it for the Registrar. | dean /dean/approvals/graduation | cut |
| # approved batch is waiting to be exported for the Registrar (# already exported). | dean /dean/approvals/graduation | keep |
| Only Graduate School Staff create a graduation batch. | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation | review |
| Nothing to do yet – waiting for Graduate School Staff to forward this batch. | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, research-coordinator /workflow/graduation | cut |
| Approved. Export it from this card. | dean /dean/approvals/graduation | cut |
| Showing # of # batchesExport CSVPrint | dean /dean/approvals/graduation | keep |
| The Academic Coordinator checks coursework, the Research Coordinator validates research evidence, and Graduate School staff prepare the endorsement list. You approve or return it, then export the approved list for the Re | dean /dean/approvals/graduation | cut |
| # candidate · Step #: GS Staff forwards batch for coursework review | dean /dean/approvals/graduation | keep |
| The signed application / review-window PDF is saved before the candidate can be selected. | dean /dean/approvals/graduation | review |
| Candidates who submitted an application are grouped into one batch. | dean /dean/approvals/graduation | cut |
| The created batch is sent to the Academic Coordinator. | dean /dean/approvals/graduation | cut |
| Completed curriculum requirements are revalidated for every candidate. | dean /dean/approvals/graduation | cut |
| Research, post-defense evidence, and any required practicum completion are revalidated. | dean /dean/approvals/graduation | review |
| Validated candidates are prepared as an endorsement list and sent to the Dean. | dean /dean/approvals/graduation | cut |
| The Dean approves the endorsement list or returns it to GS Staff for revision. | dean /dean/approvals/graduation | cut |
| The approved candidates are ready for CSV download and manual Registrar email. | dean /dean/approvals/graduation | cut |
| Staff or the Dean record that the Registrar confirmed receipt of the emailed list. | dean /dean/approvals/graduation | cut |
| The admission onboarding report and the coursework status report. | dean /dean/gate-reports | cut |
| When Graduate School staff report an import batch, it appears here for your approval. | dean /dean/gate-reports | cut |
| When Graduate School staff send a coursework status report, it appears here for your review. | dean /dean/gate-reports | cut |
| Your waiting decisions, how fast decisions are made, outcomes and the graduation pipeline. | dean /dean/analytics | cut |
| Decide the red and orange bars first: those requests have waited over a week. Select a bar to see the cases. | dean /dean/analytics | cut |
| A bar past the dashed line is slower than the target. A long gap between the median and the slowest #% means a few cases wait far longer than most. | dean /dean/analytics | cut |
| Target: decide within # days. # decisions in this period, median #.# days, against # days in the earlier period. | dean /dean/analytics | review |
| Many returns for one process mean its requests reach you incomplete: ask that office to check each request before sending. Select a bar to see the cases. | dean /dean/analytics | review |
| # decisions in this period: # approved, # returned, # denied. | dean /dean/analytics | keep |
| A step with many students and nothing in the next one is where candidates are stuck: ask that office to move those students on. | dean /dean/analytics | cut |
| Hand-off to the Registrar is not part of this view yet. | dean /dean/analytics | cut |
| Select a bar or a count to see the students. A stage with many students and few in the next one is where students wait. | dean /dean/analytics | cut |
| Your recorded decisions, newest first. | dean /dean/activity | cut |
| Leave of Absence · MAED · AY #-# #st Semester | dean /dean/activity | cut |
| Graduation Endorsement · MAED · Batch # November # · AY #-# | dean /dean/activity | cut |
| Leave of Absence · MAED · AY #-# #st Semester to AY #-# #nd Semester | dean /dean/activity | cut |
| Subject Withdrawal · MAED · MAED-MAJ# · AY #-# #nd Semester | dean /dean/activity | cut |
| Policy documents and your own queue | academic-coordinator /assistant, dean /dean/assistant, faculty /faculty-portal/assistant (+1) | cut |
| The Graduate School Handbook #-# is in force. Rules set by the Handbook or the Research Protocol are locked: those rules change only when the Graduate School issues a new policy (upload it under Policy Documents). Only G | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+1) | review |
| Accept or decline a seat on a student's panel | faculty /faculty-portal | cut |
| Proposal Defense · External Panel · Graduate School Conference Room | faculty /faculty-portal | cut |
| Mon, Nov #, # · #:# – #:# AM | faculty /faculty-portal | cut |
| Proposal Defense · External Panel · Zoom (link sent by the Graduate School) | faculty /faculty-portal | cut |
| Thu, Dec #, # · #:# – #:# PM | faculty /faculty-portal | cut |
| Fri, Dec #, # · #:# – #:# AM | faculty /faculty-portal | cut |
| Google Calendar not connected.Calendar connection | faculty /faculty-portal | cut |
| The stage of each advisee and the documents waiting for your signature. | faculty /faculty-portal/advisees | cut |
| You can advise at most # students. | faculty /faculty-portal/advisees | cut |
| You are at the limit. The Dean can assign a sixth advisee only as a recorded exception. | faculty /faculty-portal/advisees | review |
| Forms #.# and #.# (adviser contract) are due # days after Form #.#. | faculty /faculty-portal/advisees | review |
| Sign the exact manuscript version your advisee uploaded. | faculty /faculty-portal/signatures | cut |
| Nothing is waiting for your signature. The documents you signed are listed below. | faculty /faculty-portal/signatures | cut |
| Final manuscript · Final Defense | faculty /faculty-portal/signatures | cut |
| Form # - Endorsement for Final Defense · Final Defense | faculty /faculty-portal/signatures | cut |
| Form # - Endorsement for Proposal Defense · Form # - Proposal Defense Readiness | faculty /faculty-portal/signatures | cut |
| Proposal manuscript · Form # - Proposal Defense Readiness | faculty /faculty-portal/signatures | cut |
| The papers for each panel you sit on. | faculty /faculty-portal/panels | cut |
| MAED · Form # - Title Defense | faculty /faculty-portal/panels, faculty /faculty-portal/verdicts | cut |
| MAED · Form # - Proposal Defense Readiness | faculty /faculty-portal/panels, faculty /faculty-portal/verdicts | cut |
| No uploaded papers for this assigned stage. | faculty /faculty-portal/panels | cut |
| You can correct it until the student or staff act on it. The reason is recorded. | faculty /faculty-portal/panels | review |
| Accept or decline each panel; tell the Graduate School early if you cannot attend. | faculty /faculty-portal/invitations | review |
| Your role on the panel: Content Specialist | faculty /faculty-portal/invitations | cut |
| No date has been booked yet. | faculty /faculty-portal/invitations | cut |
| Accept records your consent to sit on this panel (form GS-P-#). It is not your verdict. You can still withdraw later; the Research Coordinator then finds a replacement. | faculty /faculty-portal/invitations | cut |
| Your role on the panel: External Panel | faculty /faculty-portal/invitations | cut |
| Your role on the panel: Panel Chair | faculty /faculty-portal/invitations | cut |
| Answered Aug #, #, #:# AM | faculty /faculty-portal/invitations | cut |
| Your consent to sit on this panel is recorded (form GS-P-#). It is not your verdict. If you withdraw, the Research Coordinator finds a replacement. | faculty /faculty-portal/invitations | cut |
| Keep your availability current so staff can confirm dates. | faculty /faculty-portal/defenses | cut |
| Graduate School Conference Room | faculty /faculty-portal/defenses | cut |
| Zoom (link sent by the Graduate School) | faculty /faculty-portal/defenses | cut |
| Your defenses, your advisees' deadlines and your availability. | faculty /faculty-portal/calendar | cut |
| Connect once to check busy times (your main Google calendar only) and add new defense schedules automatically. | faculty /faculty-portal/calendar | review |
| When you can sit in a defense. | faculty /faculty-portal/availability | cut |
| Tick the days and set the hours, in Philippine time. | faculty /faculty-portal/availability | cut |
| Vacations, travel or one-off changes. Specific hours on a date replace your weekly hours for that day. | faculty /faculty-portal/availability | cut |
| Optional. Fill it in for a range, such as a vacation. | faculty /faculty-portal/availability | cut |
| Leave empty for the whole day. | faculty /faculty-portal/availability | cut |
| Optional. For example: Out of town. | faculty /faculty-portal/availability | cut |
| No specific dates. Your weekly hours apply. Dates that have passed are not shown. | faculty /faculty-portal/availability | cut |
| Saving your weekly hours or a specific date also answers these requests. | faculty /faculty-portal/availability | cut |
| No open requests. The Graduate School is not waiting on you. | faculty /faculty-portal/availability | cut |
| Read only. Times the Graduate School has on record. | faculty /faculty-portal/availability | review |
| The panel chair or lead submits the verdict for each scheduled defense. | faculty /faculty-portal/verdicts | cut |
| You are the chair or lead and no verdict is recorded yet. | faculty /faculty-portal/verdicts | cut |
| A verdict form appears here once a defense is scheduled for a panel you chair. | faculty /faculty-portal/verdicts | cut |
| The chair or lead has not recorded the verdict yet. | faculty /faculty-portal/verdicts | cut |
| Your teaching hours each semester; defense hours are in My Availability. | faculty /faculty-portal/schedule | cut |
| Available periods permit scheduling. Preferred periods improve recommendations within your availability. Unavailable periods always take precedence. All times are Philippine time. | faculty /faculty-portal/schedule | review |
| Select a day to add a time range. Use the editable list below for precise times. | faculty /faculty-portal/schedule | cut |
| Add your available periods, then optionally mark preferred or unavailable periods. | faculty /faculty-portal/schedule | cut |
| Title Defense. Documents are in; the panel has not been matched yet. | research-coordinator / | cut |
| Your tasks are about these students | academic-coordinator /, research-coordinator / | cut |
| Your tasks, not yet overdue | academic-coordinator /, research-coordinator / | cut |
| Exported. Waiting for: Graduate School Staff or Dean (Registrar acknowledgement) | academic-coordinator /workflow/graduation, research-coordinator /workflow/graduation | cut |
| Clear a filter or broaden the search. | research-coordinator /work-queue | cut |
| Prepare the semester schedule to collect every offered class and its meeting times in one draft. | academic-coordinator /course-adjustments | cut |
| The Academic Coordinator approves and publishes the class schedule here. The Dean approves which subjects are offered on Course Adjustments. | academic-coordinator /course-adjustments | cut |
| Availability and current teaching load | academic-coordinator /course-adjustments | cut |
| Open the case to: Save verified hours | academic-coordinator /workflow/practicum | cut |

## C. Notices and status boxes (21 distinct)

| Notice | Where | Proposal |
|---|---|---|
| Enrollment is OPEN until Dec #, #Subjects can be added or changed until then. After that date, changes are not allowed. | academic-coordinator /course-adjustments, academic-coordinator /enrollment, staff /course-adjustments (+2) | review |
| What is left (#)• Research: Final Defense requirements (#/# complete)• Research: Final Defense confirmed defense schedule• Research: Final Defense passing defense result | student /student/graduation | cut |
| Finish what is left (see the list at the top of this page) before you apply for graduation. | student /student/graduation | review |
| If your defense is moved, a notice with the old and the new time arrives in the bell at the top of the page. | student /student/calendar | cut |
| Readmission is for students on an approved leave of absence. | student /student/requests/readmission | cut |
| Available only while your student record is marked AWOL. | student /student/requests/awol-return | review |
| Subject withdrawal is closed right nowYou have no enrolled subject this semester. | student /student/requests/withdrawal | cut |
| Student, enrollment and monitoring records agree.Review enrollment | academic-coordinator /students, staff /students | cut |
| Read-only roster.Confirm or change enrollment in the Enrollment workspace; this list updates automatically. | academic-coordinator /enrollment-class-list, staff /enrollment-class-list | review |
| Subject needs are calculated automaticallyCounts below update with the selected program and semester. The counts support the decision; the counts do not publish an offering or assign a faculty member by themselves. | academic-coordinator /course-adjustments, staff /course-adjustments | cut |
| Graduate School Staff have read-only access. An Academic Coordinator can change, submit, and publish the offering plan. | staff /course-adjustments | review |
| Records are read-onlyCompletion comes from the AIMS export. To correct a record, ask the Registrar to fix it in AIMS, then import the new export. | academic-coordinator /workflow/course-audit, staff /workflow/course-audit | cut |
| Draft — pending Graduate School validation. Assistant answers that use this document say so. Note: Prepared by the capstone group for Graduate School validation | staff /policy-documents | cut |
| # appointments, newest first. | dean /dean/approvals | keep |
| No adviser requests are waiting for you. | faculty /faculty-portal/advisees | cut |
| Nothing is waiting for your signature. The documents you signed are listed below. | faculty /faculty-portal/signatures | cut |
| # invitations are waiting for your answer. | faculty /faculty-portal/invitations | keep |
| Weekly hours on file: # days a week. | faculty /faculty-portal/availability | cut |
| Grades and subject outcomes are encoded and maintained in the authorized source systems. The Monitoring Sheet is a synchronized, read-only view. | faculty /faculty-portal/classes | review |
| Availability not submittedThe coordinator will see your availability as unknown until you submit it. | faculty /faculty-portal/schedule | review |
| You can read the semesters and dates here. Only Graduate School staff can change a semester. | academic-coordinator /term-settings | review |

## D. Headings shown twice (28 views)

- student /student/progress: Curriculum progress (repeats the page title My Progress)
- student /student/adviser: Your research adviser (repeats the page title Research Adviser)
- student /student/calendar: Calendar (repeats the page title Research Calendar)
- student /student/requests/leave-of-absence: Ask for a leave of absence (repeats the page title Leave of Absence)
- student /student/messages: Inbox / Messages (repeats the page title Messages)
- student /student/documents: Administrative Documents (repeats the page title Documents)
- student /student/activity: Activity Log; Activity Log (repeats the page title Activity Log)
- student /student/assistant: Assistant (repeats the page title Policy Assistant)
- staff /enrollment: Enrollment draft (repeats the page title Enrollment); Enrollment history (repeats the page title Enrollment)
- staff /workflow/research-gate: Research Gate (heading = tab)
- staff /workflow/research-gate (tab:Research Gate): Research Gate (heading = tab)
- staff /workflow/research-gate (tab:Adviser designation): Research Gate (heading = tab)
- staff /workflow/awol: AWOL (repeats the page title AWOL & Residency); Residency (repeats the page title AWOL & Residency)
- staff /assistant: Assistant (repeats the page title Policy Assistant)
- staff /policy-documents: Documents (repeats the page title Policy Documents)
- dean /dean/approvals/awol: AWOL (repeats the page title AWOL & Residency); Residency (repeats the page title AWOL & Residency)
- dean /dean/assistant: Assistant (repeats the page title Policy Assistant)
- faculty /faculty-portal/assistant: Assistant (repeats the page title Policy Assistant)
- research-coordinator /workflow/research-gate: Research Gate (heading = tab)
- research-coordinator /workflow/research-gate (tab:Research Gate): Research Gate (heading = tab)
- research-coordinator /workflow/research-gate (tab:Adviser designation): Research Gate (heading = tab)
- research-coordinator /assistant: Assistant (repeats the page title Policy Assistant)
- academic-coordinator /enrollment: Enrollment draft (repeats the page title Enrollment); Enrollment history (repeats the page title Enrollment)
- academic-coordinator /workflow/research-gate: Research Gate (heading = tab)
- academic-coordinator /workflow/research-gate (tab:Research Gate): Research Gate (heading = tab)
- academic-coordinator /workflow/research-gate (tab:Adviser designation): Research Gate (heading = tab)
- academic-coordinator /workflow/awol: AWOL (repeats the page title AWOL & Residency); Residency (repeats the page title AWOL & Residency)
- academic-coordinator /assistant: Assistant (repeats the page title Policy Assistant)

## E. Business rules outside the Business Rules page (IM58: all removed)

- **Rules applied on this screen** - academic-coordinator /workflow/awol (help), academic-coordinator /workflow/graduation (help), academic-coordinator /workflow/panel-matching (help), academic-coordinator /workflow/practicum (help), academic-coordinator /workflow/research-gate (help), dean /dean/approvals/awol (help), dean /dean/approvals/leave-of-absence (help), dean /dean/approvals/practicum (help) (+22)
- **Adding or changing a subject: rules applied** - academic-coordinator /course-adjustments, academic-coordinator /course-adjustments (tab:Demand & adjustments), academic-coordinator /course-adjustments (tab:Offering setup), academic-coordinator /enrollment, staff /course-adjustments, staff /course-adjustments (tab:Demand & adjustments), staff /course-adjustments (tab:Offering setup), staff /enrollment
- **Enrollment and academic load: rules applied** - academic-coordinator /enrollment, staff /enrollment

## F. Filter rows (50 distinct layouts)

| Kind | Controls in order | Where |
|---|---|---|
| select:Filter by program |  | academic-coordinator /workflow/awol, academic-coordinator /workflow/graduation, academic-coordinator /workflow/panel-matching (+29) |
| div:Report filters | select:All programsDPSYMAPSYMASSDBAMBAEDDMAEDMS | select:All years22-2323-2424-2525-2626-27 | select:Last 12 monthsThis termPrevious termAll  | academic-coordinator /reports, academic-coordinator /reports (tab:By year started), academic-coordinator /reports (tab:Graduation) (+23) |
| loose | select:Program All programsDPSYMAPSYMASSDBAMBAE | select:Year started All years22-2323-2424-2525- | select:Period Last 12 monthsThis termPrevious t | academic-coordinator /reports, academic-coordinator /reports (tab:Needs attention), academic-coordinator /reports (tab:Office speed) (+17) |
| select:Filter by status |  | academic-coordinator /workflow/awol, academic-coordinator /workflow/practicum, academic-coordinator /workflow/research-gate (+16) |
| select:Filter by lifecycle stage |  | academic-coordinator /workflow/panel-matching, research-coordinator /workflow/defense-scheduling, research-coordinator /workflow/defense-scheduling (tab:Scheduling) (+5) |
| loose | input:Search a student | select:Filter by program | select:Filter by lifecycle stage | academic-coordinator /workflow/panel-matching, research-coordinator /workflow/defense-scheduling, research-coordinator /workflow/defense-scheduling (tab:Scheduling) (+5) |
| filter-box | input:Search students | select:Filter by program | select:Filter by status | select:Year admitted | button:Export CSV | button:Print | academic-coordinator /workflow/research-gate, academic-coordinator /workflow/research-gate (tab:Research Gate), research-coordinator /workflow/research-gate (+3) |
| filter-box | input:Search students | select:Filter by program | select:Filter by status | button:Export CSV | button:Print | academic-coordinator /workflow/practicum, dean /dean/approvals/readmission, dean /dean/approvals/withdrawal (+3) |
| filter-box | input:Search students | select:Filter by program | select:Filter by workflow stage or status | select:Filter by completed courses | button:Export CSV | button:Print | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, dean /dean/approvals/graduation (tab:Endorsement batches) (+3) |
| select:Filter by workflow stage or status |  | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, dean /dean/approvals/graduation (tab:Endorsement batches) (+3) |
| select:Filter by completed courses |  | academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, dean /dean/approvals/graduation (tab:Endorsement batches) (+3) |
| loose | input:Search task, student, or owner… | academic-coordinator /work-queue, academic-coordinator /work-queue (tab:Mine), research-coordinator /work-queue (+3) |
| select:Filter by office |  | academic-coordinator /work-queue (tab:All), academic-coordinator /work-queue (tab:Waiting on others), research-coordinator /work-queue (tab:All) (+3) |
| loose | input:Search task, student, or owner… | select:Filter by office | academic-coordinator /work-queue (tab:All), academic-coordinator /work-queue (tab:Waiting on others), research-coordinator /work-queue (tab:All) (+3) |
| div:Filter rules | button:All rules | button:Enforced by the system | button:Not checked by the system | button:Needs review | button:Official (locked) | button:Pending validation | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) |
| loose | input:Search rules or pages | academic-coordinator /business-rules, dean /dean/business-rules, faculty /faculty-portal/business-rules (+2) |
| select:Filter Dean list by program |  | dean /dean/approvals, dean /dean/approvals (tab:Accepted - contract), dean /dean/approvals (tab:All) (+2) |
| select:Filter Dean list by stage or status |  | dean /dean/approvals, dean /dean/approvals (tab:Accepted - contract), dean /dean/approvals (tab:All) (+2) |
| loose | input:Search student, ID, or item… | select:Filter Dean list by program | select:Filter Dean list by stage or status | dean /dean/approvals, dean /dean/approvals (tab:Accepted - contract), dean /dean/approvals (tab:All) (+2) |
| loose | select:Program | select:Academic year and semester | input:Search a subject or a student | select:Faculty assignment for MAED-MAJ1 | select:Faculty assignment for MAED-STAT | select:Faculty assignment | academic-coordinator /course-adjustments, academic-coordinator /course-adjustments (tab:Demand & adjustments), staff /course-adjustments (+1) |
| loose | input:Name or student ID | select:Program | select:Semester | select:Year admitted | select:Progress | select:Risk | select:Enrollment status | select:Sort monitoring sheet | academic-coordinator /monitoring-sheet, research-coordinator /monitoring-sheet, staff /monitoring-sheet |
| filter-box | input:Search students | select:Filter by program | select:Filter by status | select:Filter by type of request | button:Export CSV | button:Print | academic-coordinator /workflow/awol, dean /dean/approvals/awol, staff /workflow/awol |
| select:Filter by type of request |  | academic-coordinator /workflow/awol, dean /dean/approvals/awol, staff /workflow/awol |
| loose | select:Program All programsDPSYMAPSYMASSDBAMBAE | select:Year started All years22-2323-2424-2525- | select:Period Last 12 monthsThis termPrevious t | select:Stage Any stageAdmissionCourseworkCompre |  | academic-coordinator /reports (tab:By year started), staff /reports (tab:By year started) |
| loose | select:Program All programsDPSYMAPSYMASSDBAMBAE | select:Year started All years22-2323-2424-2525- | select:Period Last 12 monthsThis termPrevious t | select:Stage Any stageAdmissionCourseworkCompre |  | academic-coordinator /reports (tab:Graduation), staff /reports (tab:Graduation) |
| loose | select:Program All programsDPSYMAPSYMASSDBAMBAE | select:Year started All years22-2323-2424-2525- | select:Period Last 12 monthsThis termPrevious t | select:Stage Any stageAdmissionCourseworkCompre |  | academic-coordinator /reports (tab:Overdue and pending), staff /reports (tab:Overdue and pending) |
| loose | input:Search name, number, or program… | select:All student status | select:All stage | select:All risk | select:All standing | select:All program | academic-coordinator /students, staff /students |
| select:Filter by department |  | academic-coordinator /faculty, staff /faculty |
| select:Filter by availability |  | academic-coordinator /faculty, staff /faculty |
| loose | input:Search by name, department, or specializ | select:Filter by department | select:Filter by availability | academic-coordinator /faculty, staff /faculty |
| loose | select:Program | select:Semester | select:Class list view | academic-coordinator /enrollment-class-list, staff /enrollment-class-list |
| loose | select:Program DBA — Doctor of Business Adminis | select:Academic semester AY 2028-2029 2nd Semes | select:Student Almario, Miko — 2690105Aquino, R | input:Filter the student picker… | academic-coordinator /enrollment, staff /enrollment |
| loose | select:Subject | select:Program | academic-coordinator /workflow/course-audit, staff /workflow/course-audit |
| loose | select:Program All programsDBA · Doctor of Busi | select:Stage All stagesTitle DefenseProposal De | select:Status Booked and heldScheduledNeeds Re- | select:Panelist or adviser AnyoneDr. Angela Cru | research-coordinator /workflow/defense-scheduling (tab:Calendar), staff /workflow/defense-scheduling (tab:Calendar) |
| filter-box | input:Search students | select:Filter by program | select:Filter by status | select:Filter by reason | button:Export CSV | button:Print | dean /dean/approvals/leave-of-absence, staff /workflow/leave-of-absence |
| select:Filter by reason |  | dean /dean/approvals/leave-of-absence, staff /workflow/leave-of-absence |
| loose | select:Class schedule semester | student /student/class-schedule |
| loose | select:Mode On-siteOnlineHybrid | student /student/defense-schedule |
| loose | select:Leave starts *Choose a semesterAY 2026-2 | select:Leave ends *Choose when it starts first | select:Reason *Choose a reasonMedical / healthF | student /student/requests/leave-of-absence |
| loose | select: | student /student/messages |
| loose | select:Program | select:Semester | staff /course-adjustments (tab:Offering setup) |
| loose | input:Search activity or student… | select:Workflow All workflowsAWOL & ResidencyCo | select:Next owner All next ownersAcademic Coord | staff /activity |
| select:Filter by category |  | staff /policy-documents |
| loose | input:Search documents | select:Filter by category | select:Filter by status | staff /policy-documents |
| filter-box | input:Search students | select:Filter by program | select:Filter by status | dean /dean/approvals/practicum |
| loose | select:Process All processesCourse AdjustmentsL | dean /dean/activity |
| loose | select:Correct verdictPassedPassed with minor r | faculty /faculty-portal/panels |
| loose | select:Semester AY 2028-2029 2nd SemesterAY 202 | select:Subject MAED-COG1 — Teaching Strategies  | faculty /faculty-portal/classes |
| loose | select:Semester | faculty /faculty-portal/schedule |
| loose | select:Program | select:Semester | select:Subject to add to this semester's offeri | select:Faculty for MAED-COG1 | select:Schedule for MAED-COG1 | select:Section for MAED-COG1 | select:Faculty for MA | academic-coordinator /course-adjustments (tab:Offering setup) |

## G. Paging controls

- `Previous` - academic-coordinator /reports, academic-coordinator /reports (tab:Graduation), academic-coordinator /reports (tab:Needs attention), academic-coordinator /reports (tab:Overdue and pending) (+14)
- `Next` - academic-coordinator /reports, academic-coordinator /reports (tab:Graduation), academic-coordinator /reports (tab:Needs attention), academic-coordinator /reports (tab:Overdue and pending) (+14)
- `Next owner` - academic-coordinator /reports, academic-coordinator /reports (tab:Graduation), academic-coordinator /reports (tab:Needs attention), research-coordinator /reports (+4)
- `Showing #–# of #` - academic-coordinator /reports, academic-coordinator /reports (tab:By year started), academic-coordinator /reports (tab:Graduation), academic-coordinator /reports (tab:Needs attention) (+38)
- `Showing # of # students` - academic-coordinator /workflow/practicum, academic-coordinator /workflow/research-gate, academic-coordinator /workflow/research-gate (tab:Research Gate), research-coordinator /workflow/research-gate (+4)
- `Showing # of # records` - academic-coordinator /workflow/graduation, dean /dean/approvals/graduation, dean /dean/approvals/graduation (tab:Roster & workflow), research-coordinator /workflow/graduation (+1)
- `Showing # of # requests` - dean /dean/approvals/leave-of-absence, dean /dean/approvals/readmission, dean /dean/approvals/withdrawal, staff /workflow/leave-of-absence (+2)
- `Showing # of # cases` - academic-coordinator /workflow/awol, dean /dean/approvals/awol, staff /workflow/awol
- `Showing # of # activities` - staff /activity
- `Showing # of # reports` - dean /dean/approvals/practicum
- `Showing # of # batches` - dean /dean/approvals/graduation (tab:Endorsement batches)

## H. Unit labels like `3u`

- `Teaching Strategies in Higher Education · #u` - academic-coordinator /course-adjustments (tab:Offering setup), staff /course-adjustments (tab:Offering setup)
- `Seminar on Contemporary Issues in Education · #u` - academic-coordinator /course-adjustments (tab:Offering setup), staff /course-adjustments (tab:Offering setup)
- `Learning Analytics · #u` - academic-coordinator /course-adjustments (tab:Offering setup), staff /course-adjustments (tab:Offering setup)
- `Curriculum Development and Evaluation · #u` - academic-coordinator /course-adjustments (tab:Offering setup), staff /course-adjustments (tab:Offering setup)
- `Educational Leadership and Management · #u` - academic-coordinator /course-adjustments (tab:Offering setup), staff /course-adjustments (tab:Offering setup)
- `Assessment of Learning · #u` - academic-coordinator /course-adjustments (tab:Offering setup), staff /course-adjustments (tab:Offering setup)
- `Educational Technology and Instruction · #u` - academic-coordinator /course-adjustments (tab:Offering setup), staff /course-adjustments (tab:Offering setup)
- `Philosophy of Education · #u` - academic-coordinator /course-adjustments (tab:Offering setup), staff /course-adjustments (tab:Offering setup)
- `#/#u` - staff /students/1, staff /students/5

## I. Load times (1366 px, the dev server on the demo data; time to the h1 / time until the page is quiet)

| Role | Page | First view ms | Settled ms | Slowest calls (ms) |
|---|---|---|---|---|
| academic-coordinator | /enrollment | 1796 | 2278 | /api/teaching-schedules?mode=options&offering_id=2&term_id=5 1721; /api/enrollment 535; /api/auth/config 169 |
| research-coordinator | /reports | 412 | 2266 | /api/reports/attention?term=last-12-months 1374; /api/reports/summary?term=last-12-months 502; /api/meta 156 |
| staff | /reports | 361 | 2148 | /api/reports/attention?term=last-12-months 1256; /api/reports/summary?term=last-12-months 465; /api/meta 177 |
| academic-coordinator | /reports | 383 | 1996 | /api/reports/attention?term=last-12-months 1109; /api/reports/summary?term=last-12-months 463; /api/meta 156 |
| research-coordinator | /workflow/research-gate | 461 | 1925 | /api/research-gate/overview 936; /api/meta 135; /api/notifications/refresh 41 |
| dean | /dean/approvals/graduation | 653 | 1845 | /api/approvals 545; /api/transactions/graduation/context 422; /api/notifications/refresh 30 |
| research-coordinator | /workflow/graduation | 507 | 1796 | /api/transactions/graduation/context 857; /api/meta 130; /api/notifications?limit=30 29 |
| dean | /dean/approvals/awol | 1073 | 1684 | /api/approvals 726; /api/notifications/refresh 45; /api/process-cases?slug=awol 33 |
| dean | /dean/business-rules | 365 | 1668 | /api/approvals 786; /api/notifications/refresh 59; /api/adviser-appointments?scope=open 35 |
| dean | /dean/analytics | 368 | 1578 | /api/approvals 694; /api/reports/summary?term=last-12-months 308; /api/reports/summary/active?term=last-12-months 202 |
| research-coordinator | / | 1158 | 1576 | /api/dashboard 665; /api/notifications/refresh 50; /api/tasks?page_size=200 31 |
| research-coordinator | /workflow/defense-scheduling | 410 | 1573 | /api/research-gate/overview 693; /api/meta 115; /api/notifications/refresh 54 |
| dean | /dean/approvals/course-adjustments | 1175 | 1571 | /api/approvals 604; /api/adviser-appointments?scope=open 49; /api/notifications/refresh 41 |
| staff | /workflow/defense-scheduling | 389 | 1568 | /api/research-gate/overview 606; /api/meta 143; /api/notifications/refresh 55 |
| dean | /dean/approvals/withdrawal | 1127 | 1558 | /api/approvals 586; /api/adviser-appointments?scope=open 47; /api/notifications/refresh 40 |
| research-coordinator | /workflow/panel-matching | 421 | 1553 | /api/research-gate/overview 626; /api/meta 69; /api/notifications/refresh 35 |
| dean | /dean/activity | 1122 | 1545 | /api/approvals 608; /api/notifications/refresh 47; /api/auth/config 41 |
| dean | /dean/approvals | 1124 | 1540 | /api/approvals 628; /api/adviser-appointments?scope=all 89; /api/notifications/refresh 44 |
| staff | /workflow/graduation | 392 | 1527 | /api/transactions/graduation/context 584; /api/meta 126; /api/notifications/refresh 65 |
| staff | /workflow/panel-matching | 383 | 1527 | /api/research-gate/overview 623; /api/meta 98; /api/auth/config 64 |
| academic-coordinator | /workflow/panel-matching | 324 | 1517 | /api/research-gate/overview 617; /api/meta 76; /api/notifications/refresh 33 |
| academic-coordinator | /workflow/research-gate | 359 | 1512 | /api/research-gate/overview 606; /api/meta 107; /api/notifications/refresh 49 |
| faculty | /faculty-portal/invitations | 527 | 1498 | /api/faculty-portal/context 337; /api/faculty-portal/panel-invitations 237; /api/notifications/refresh 56 |
| dean | /dean/assistant | 347 | 1498 | /api/approvals 602; /api/notifications/refresh 56; /api/adviser-appointments?scope=open 29 |
| faculty | /faculty-portal/assistant | 1127 | 1452 | /api/faculty-portal/context 525; /api/notifications/refresh 88; /api/auth/config 11 |
| dean | /dean | 1093 | 1445 | /api/approvals 536; /api/notifications/refresh 53; /api/auth/config 40 |
| staff | /workflow/research-gate | 332 | 1440 | /api/research-gate/overview 526; /api/meta 71; /api/adviser-appointments?scope=open 56 |
| dean | /dean/approvals/readmission | 1108 | 1439 | /api/approvals 541; /api/notifications/refresh 46; /api/adviser-appointments?scope=open 27 |
| faculty | /faculty-portal/defenses | 1133 | 1434 | /api/faculty-portal/context 511; /api/notifications/refresh 113; /api/auth/config 20 |
| dean | /dean/approvals/leave-of-absence | 588 | 1425 | /api/approvals 504; /api/notifications/refresh 41; /api/process-cases?slug=leave-of-absence 41 |

## J. Observed while crawling

- Monitoring Sheet: the Filters disclosure sits in the same wrapping row as Sort and Export, so opening it moves them right and puts the four selects (Year admitted, Progress, Risk, Enrollment status) in a narrow column under the button (screenshot in the stage 1 report to the owner).
- The crawler's per-page timings are from the cloud dev server (one Flask process, two cores); the PC will be faster, the order of the slow calls is what matters.

