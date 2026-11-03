# USLS Graduate School forms: inventory

Prepared for the stakeholder meeting of 2026-11-04. The Graduate School has almost nothing written down besides the
Graduate Programs Student Handbook 2022-2023, so the capstone group drafted the forms and process documents the
lifecycle needs. Each form is clean (no watermark, no draft footer) and carries blank control fields: form code,
revision no. (00) and effectivity date. Approval is collected once, on **GS-P-01 Graduate School Forms Approval Sheet**.

All files are built by one script, `scripts/docs/forms/build_forms.py`, so a correction is a one-line change followed by a
re-run (layout, fonts and control fields stay identical). Print pack: `USLS-GS-Forms-Pack.pdf` (approval sheet first, then the routing guide, then GS-F-01 to GS-F-44; 82 pages); the single PDFs are in `pdf/`.
Layout: A4, Arial, 2 cm margins, page X of Y in the footer; instruction boxes 9.5 pt, field captions 9 pt; 13 forms fit one page and 31 two pages (none longer); GS-P-01 is 3 pages and GS-P-02 (landscape, 9 pt table) is 4.

## What already exists officially

| Official document | Where it is named | Do we hold the template? |
|---|---|---|
| Research Protocol Forms 1, 2, 3, 3.1, 3.1.1, 3.2, 3.3, 3.4, 4, 4.1, 4.2, 4.3, 5, 5.1, 5.2, 6, 7, 8, 9, 10, 11, 12, 13 | Research Protocol AY 2024-2025 (all sections) and Handbook pp. 59-75 | **No.** The Protocol describes each form and who accomplishes it, but contains no form layout (the two images in the file are the University letterhead). So every one is drafted here, using the Protocol's own form numbers and wording. |
| Withdrawal Form | Handbook p. 49 | No (drafted: GS-F-05) |
| Application for the comprehensive examination | Handbook pp. 56-57 | No (drafted: GS-F-14) |
| Incomplete Grade Removal Form | Handbook p. 54 (email gsm@usls.edu.ph) | No. Not drafted: grades are out of scope for the platform. |
| Advice Slip | Handbook pp. 45, 49 | No (drafted as a section of GS-F-03) |

If the Graduate School already has its own Word or PDF for any of these, its version replaces ours and the matching
GS-F number is simply retired from the approval sheet.

## Inventory of forms and process documents

"Drafted here" means the content was written by the group from the sources in the Source column. The Protocol form number
is shown in the title line of every research form, so each can be traced to the Protocol.

| Code | Document | Process | Fills it / signs it | Source | Status |
|---|---|---|---|---|---|
| GS-F-01 | Onboarding Report for the Dean | Admission handoff and onboarding | GS staff fills; Academic Coordinator reviews; Dean accepts | Ops Manual 4.1; Handbook pp. 42-47; app `OnboardingReview` (checklist) | drafted here |
| GS-F-02 | Academic Advising and Study Plan | Enrollment and academic load | Student; Academic Coordinator | Ops Manual 4.2; Handbook pp. 47-48; app `StudyPlanDraft`, `StudentCurriculumTag` | drafted here |
| GS-F-03 | Change or Add of Subject and Advice Slip | Course adjustments | Student; Academic Coordinator recommends; Associate Dean approves; GS Office issues slip | Ops Manual 4.3; Handbook pp. 48-49 | drafted here (Advice Slip official by name, Handbook p. 49) |
| GS-F-04 | Term Course Offering Plan | Course offering | Academic Coordinator; Dean approves | Ops Manual 4.3; Handbook pp. 48, 51; app `CourseOfferingPlan` | drafted here |
| GS-F-05 | Application for Withdrawal of Subject | Withdrawal of subject | Student; Academic Coordinator; Dean decides; Business Office; Registrar | Ops Manual 4.4; Handbook pp. 49-51, 53; app `WithdrawalApplication` | official exists by name (Withdrawal Form, Handbook p. 49), template not held; drafted here |
| GS-F-06 | Notice of Dropping from a Subject | Dropping | Professor; Academic Coordinator; student acknowledges; Dean notes | Ops Manual 4.5; Handbook pp. 52, 54; app drop fields (`unexcused_absence_percent`, `drop_exception_reason`) | drafted here |
| GS-F-07 | Application for Leave of Absence (new and extension) | Leave of absence | Student; Academic Coordinator; Dean decides; Business Office; Registrar notified | Ops Manual 4.6; Handbook pp. 48, 52-53, 55; app `LeaveCase` kinds LOA and LOA_EXTENSION, five reason categories | drafted here |
| GS-F-08 | Application for Readmission (Return from Leave or AWOL) | Return and readmission | Student; Academic Coordinator; Business Office; Dean endorses to Registrar | Ops Manual 4.7; Handbook pp. 45, 53-55; app `LeaveCase` kind READMISSION and the four-item checklist | drafted here |
| GS-F-09 | Notice of Absence Without Leave (AWOL) | AWOL | GS staff or Academic Coordinator; Dean notes | Ops Manual 4.8; Handbook p. 53; app `AwolCase` | drafted here (proposed: the Handbook defines AWOL but gives no notice) |
| GS-F-10 | Application for Residency Enrollment | Residency | Student; Academic Coordinator; Dean or representative; Business Office | Ops Manual 4.9; Handbook pp. 48, 54-55; app `ResidencyEnrollment` (five purposes) | drafted here |
| GS-F-11 | Practicum Agreement (Memorandum of Agreement) | Practicum | Student; host supervisor and representative; Academic Coordinator; Dean | Ops Manual 4.17; Handbook p. 48; app `PracticumRecord` (site, supervisor) | drafted here (proposed process) |
| GS-F-12 | Practicum Hours Log and Supervisor's Certification | Practicum | Student; host supervisor | Ops Manual 4.17; app `PracticumRecord` (hours, certificates) | drafted here |
| GS-F-13 | Practicum Completion Report | Practicum | Academic Coordinator; Dean reviews | Ops Manual 4.17; app `PracticumRecord` (report to Dean) | drafted here |
| GS-F-14 | Application for Comprehensive Examination | Comprehensive examination | Student; Academic Coordinator or College Dean; Graduate Program Secretary | Ops Manual 4.10; Handbook pp. 56-57 | official exists by name (Handbook pp. 56-57), template not held; drafted here |
| GS-F-15 | Comprehensive Examination Result Sheet | Comprehensive examination | Academic Coordinator; Graduate Program Secretary; Dean notes | Ops Manual 4.10; Handbook p. 57; app `comprehensive_exam_status` | drafted here |
| GS-F-16 | Application for Title Defense (Protocol Form 1) | Title defense | Student; Academic Coordinator endorses; Research Coordinator | Protocol, Title Defense I; Handbook p. 59; app research gate "Form 1 - Title Defense" | official exists by name, template not held; drafted here |
| GS-F-17 | Panel Nomination and Invitation Reply Slip | Panel nomination, scheduling | Research Coordinator; nominees reply; Committee deliberates | Protocol, Title Defense I.4; Handbook pp. 60, 63; app `PanelAssignment`, `PanelInvitation` | drafted here (the reply slip is proposed) |
| GS-F-18 | Report of Title Defense (Form 2) | Title defense | Panel members; Panel Chair | Protocol, Title Defense III; Handbook pp. 60-61; app `DefenseVerdict` | official exists by name, template not held; drafted here |
| GS-F-19 | Application for Designation of Research Adviser (Form 3) | Adviser designation | Student; Academic Coordinator notes; Research Coordinator forwards | Protocol, Designation I; Handbook pp. 58-59, 61; app `AdviserAppointment` | official exists by name, template not held; drafted here |
| GS-F-20 | Appointment for Research Adviser (Form 3.1) | Adviser designation | Research Coordinator, Associate Dean, Dean sign; adviser accepts | same | official exists by name, template not held; drafted here |
| GS-F-21 | Request for Change of Research Adviser (Form 3.1.1) | Change of adviser | Student; current and new adviser; Coordinator, Associate Dean, Dean | Protocol, Change of Adviser; Handbook p. 62 | official exists by name, template not held; drafted here |
| GS-F-22 | Research Timetable (Form 3.2) | Research advising | Student; adviser | Protocol, Designation II; Handbook pp. 58, 61-62 | official exists by name, template not held; drafted here |
| GS-F-23 | Thesis / Dissertation Advising Contract (Form 3.3) | Research advising | Student; adviser | Protocol, Designation II; Handbook p. 59 | official exists by name, template not held; drafted here |
| GS-F-24 | Request for Change of Title of the Study (Form 3.4) | Change of title | Student; adviser; panel | Protocol, Change of Title; Handbook p. 62 | official exists by name, template not held; drafted here |
| GS-F-25 | Statistical Consultation Form (Form 4.1) | Proposal defense | Statistician; student; adviser | Protocol, Proposal Defense I; Handbook p. 63 | official exists by name, template not held; drafted here |
| GS-F-26 | Co-authorship Information for Publication (Form 4.2) | Proposal defense | Student; co-authors; adviser; Panel Chair | Protocol, Proposal Defense I-II; Handbook p. 64 | official exists by name, template not held; drafted here |
| GS-F-27 | Endorsement for Proposal / Final Defense (Form 4) | Proposal and closed-door final defense | Adviser endorses; panel agrees to schedule; Research Coordinator | Protocol, Proposal Defense I, Final Defense I; Handbook pp. 63, 65-66; app `ScheduleRequest` | official exists by name, template not held; drafted here |
| GS-F-28 | Request for Rescheduling or Cancellation of a Defense | Defense scheduling | Requester; adviser; Research Coordinator | Ops Manual 4.16; app `ScheduleRequest` (change reason, requested by) | drafted here (proposed) |
| GS-F-29 | Comments Sheet for Proposal Defense (Form 5) | Proposal defense | Panel members; Panel Chair consolidates | Protocol, Proposal Defense II-III; Handbook pp. 64-65 | official exists by name, template not held; drafted here |
| GS-F-30 | Technical Review Certificate (Form 5.1) | Proposal defense, ethics | Panel Chair and members | Protocol, Proposal Defense III; Handbook p. 65 | official exists by name, template not held; drafted here |
| GS-F-31 | Application for Ethics Review (Form 5.2) | Ethics review | Student; adviser; ethics committee | Protocol, Proposal Defense III; Handbook pp. 23, 65 | official exists by name, template not held; drafted here (see question 13) |
| GS-F-32 | Comments Sheet for Final Defense (Form 6) | Final defense | Panel members; Panel Chair | Protocol, Final Defense II-IV; Handbook pp. 66-73 | official exists by name, template not held; drafted here |
| GS-F-33 | Evaluation Sheet for Final Defense (Form 7) | Final defense | Panel members and adviser; Research Coordinator | Protocol, Final Defense II-IV; Handbook pp. 66-67, 76 (criteria) | official exists by name, template not held; drafted here (see question 10) |
| GS-F-34 | Settlement of Provisional Thesis / Dissertation Approval (Form 8) | Revisions and completion | Adviser; panel; Research Coordinator | Protocol, Final Defense II; Handbook p. 67 | official exists by name, template not held; drafted here |
| GS-F-35 | Endorsement for Public Final Defense (Form 4.3) | Public final defense | Adviser; panel; Research Coordinator | Protocol, Public Defense I; Handbook pp. 70-73 | official exists by name, template not held; drafted here |
| GS-F-36 | Similarity Index (Turnitin) Certification | Revisions and completion | Turnitin administrator | Protocol, Final Defense III (Turnitin certificate); Handbook p. 68 | certificate is official by name (no form number); drafted here |
| GS-F-37 | Editor Certification (Form 9) | Revisions and completion | Editor | Protocol, Final Defense III; Handbook p. 68 | official exists by name, template not held; drafted here |
| GS-F-38 | Approval Sheet (Form 10) | Revisions and completion | Panel, adviser; Dean accepts | Protocol, Final Defense III; Handbook pp. 68, 77 | official exists by name, template not held; drafted here |
| GS-F-39 | Formal Invitation to Co-Author Journal Article (Form 11) | Publication | Student; co-author; adviser | Handbook p. 75 | official exists by name, template not held; drafted here |
| GS-F-40 | Publication Information Form (Form 12) | Publication | Student; Research Committee; Dean | Handbook p. 75 | official exists by name, template not held; drafted here |
| GS-F-41 | Evidence of Publication or Acceptance (Form 13) | Publication | Student; Research Coordinator | Handbook pp. 75, 77 | Form 13 is named only by number in the Handbook (p. 75); the title is descriptive; template not held; drafted here |
| GS-F-42 | Application for Graduation | Graduation application | Student; Academic Coordinator; Research Coordinator; Dean | Ops Manual 4.18; Handbook pp. 55-56, 68-69, 75-77, 80; app `GraduationEndorsement` | drafted here |
| GS-F-43 | Graduation Endorsement List | Graduation endorsement | GS staff; coordinators; Dean | Ops Manual 4.18; Handbook pp. 32, 77; app `GraduationEndorsement` (batch, Dean decision, export) | drafted here |
| GS-F-44 | Records Transmittal to the University Registrar | Records handoff | Dean, Associate Dean or representative; Registrar acknowledges | Ops Manual 4.19; Handbook pp. 32, 49, 53; app `LeaveExportLog`, registrar status fields | drafted here (proposed) |
| GS-P-01 | Graduate School Forms Approval Sheet | Control of forms | Dean approves; Associate Dean, Research Coordinator, five Academic Coordinators and Graduate School Secretary review | this inventory | drafted here |
| GS-P-02 | Forms Routing Guide | Control of forms | read-only guide | Ops Manual chapters 2 and 4; app workflow steps | drafted here |

Total: 44 forms, 2 process documents.

### Not drafted (named in the Handbook, outside the lifecycle processes listed)

Incomplete Grade Removal Form (p. 54), cross-enrollment permission (p. 50), transfer between master's options (p. 48),
request for a special class (p. 48), admission application and entrance documents (pp. 42-47, Admissions office), approved
absence (p. 52) and the best thesis / dissertation nomination (pp. 76-77). They can be added with the same script.

## Matching the platform

Each form asks for the fields the platform records, so a paper form can be keyed into the platform without a missing
value. Examples: GS-F-07 uses the platform's five leave reason categories; GS-F-08 carries the platform's four-item
readmission checklist next to the Handbook's four requirements; GS-F-06 asks for the unexcused-absence percentage;
GS-F-33 carries the score the platform validates against 85 / 90. **GS-F-16 keeps the four labels the platform's Form 1
PDF reader looks for** ("Research Title:", "Objectives:", "Research Keywords:", "Proposed Panel Specialization:", then
"Prepared by"), so an uploaded filled Form 1 can still be read automatically. GS-P-02 maps each form to the platform step.

## Public examples consulted (to make the content realistic)

Search-result listings were reviewed for the usual fields and signature lines. Two PDFs could not be fetched (HTTP 404 or
binary only), so no text was copied; the forms here are original wording built on the Handbook and Protocol.

- UP Visayas Graduate School leave of absence form (graduate adviser note, Graduate School Secretary): https://crs.upv.edu.ph/views/GS%20Leave%20of%20Absence.pdf
- UP Los Baños Graduate School, clearance for leave of absence and a separate AWOL form endorsed to the Dean: https://gs.uplb.edu.ph/wp-content/uploads/2022/10/Clearance-for-Leave-of-Absence.docx.pdf and https://gs.uplb.edu.ph/wp-content/uploads/2025/01/FORM-FOR-AWOL.pdf
- Visayas State University Graduate School, FM-OGS-17 Leave of Absence (letter to the Dean): https://www.vsu.edu.ph/images/OGS/gs_forms/March2023/FM-OGS-17_Leave_of_Absence_v3_12-21-2021.docx
- UP Open University, Request Form for Filing Leave of Absence: https://registrar.upou.edu.ph/wp-content/uploads/2024/10/Request-Form-for-Filing-Leave-of-Absence-1.pdf
- De La Salle University, thesis proposal endorsement (ACM-F022) and approval sheet (ACM-F026): https://www.dlsu.edu.ph/wp-content/uploads/2018/06/acm-f022-thesis-proposal-endorsement.pdf and https://www.dlsu.edu.ph/wp-content/uploads/2018/06/acm-f026-thesis-proposal-approval-sheet.pdf
- UP Diliman College of Science, request for thesis / dissertation defense schedule: https://csrc.science.upd.edu.ph/storage/2024/08/Request-for-Thesis.Dissertation-Defense-Schedule-Form2023.pdf
- UP Diliman thesis and dissertation checklist (separate forms for the defense request and the result): https://kssp.upd.edu.ph/images//Admissions/Graduate_Program/December_2023_Revised_GPO_Forms/Thesis_and_Dissertation_Checklist.pdf
- UP Manila, result of defense form: https://ngohs.upm.edu.ph/wp-content/uploads/2025/05/UPM-NGS-00-00-RESULT-DEFENSE-2023.pdf
- Tarlac State University Graduate School, Application for Graduation (TSU-OAR-SF-17): https://www.tsu.edu.ph/media/mgpnzqm0/f-application-for-graduation-graduate-school.pdf
- UP Los Baños Graduate School, application for the final examination (MS with thesis): https://gs.uplb.edu.ph/wp-content/uploads/2024/02/FINAL-EXAM-FOR-MS.pdf
- Ateneo de Manila graduate research mentoring FAQ, on CMO 15 s. 2019 content and method specialists on the panel: https://sites.google.com/ateneo.edu/gradresearchmentoring/faqs
- CHED CMO 15 s. 2019 itself was not retrieved; the adviser and panel rules cited on the forms are the Handbook's and the Protocol's own statements of it.

## Questions for the Graduate School

Policy facts the group could not confirm. Where a number is unknown the form leaves a blank, and the form never states a
fee, deadline or limit that the Handbook or Protocol does not state. Numbers in brackets are the open questions of the
Operations Manual (OQ).

1. Do you already hold the official Word or PDF forms for Protocol Forms 1 to 13, the Withdrawal Form, the comprehensive
   examination application and the Advice Slip? If yes, theirs replace ours; the Protocol describes them but the copy we
   have contains no layouts.
2. Is the code style GS-F-XX / GS-P-XX acceptable, and who assigns the effectivity date and revision numbers?
3. Withdrawal of subject: the Handbook allows it until the second week with 10% / 20% charges; the group was told by the
   Associate Dean it is before classes or in the first week. Which applies, what does a withdrawal before the first day
   cost, and may a single subject be withdrawn after the second week (OQ-01 to OQ-04, OQ-08)? GS-F-05 follows the Handbook.
4. Dropping: who drops a subject (professor, as the Handbook says, or the Academic Coordinator), is a drop for a
   documented reason other than absences allowed, and is the DRP 5.0 meant to drop the student from the program (OQ-05, OQ-06)?
5. Leave of absence: the filing deadline, the start term, whether leave counts in maximum residence (the Handbook says it
   does), the filing fee, and whether a structured form may replace the letter to the Dean (OQ-09 to OQ-12).
6. Readmission and AWOL: who declares AWOL, is a written notice sent (GS-F-09 is a proposal), who records the returnee
   interview, and may a failed-subject student ever be readmitted (OQ-13, OQ-14)?
7. Residency enrollment: the fee, the deadline within the semester, the number of semesters allowed, and who approves
   (OQ-15, OQ-16).
8. Comprehensive examination: before or after the adviser appointment and the title defense, who evaluates doctorate
   students (the Handbook says College Dean), and is the 7.00 pass mark per course out of 10.00 (OQ-17, OQ-18)?
9. Research adviser: who approves (Dean alone, or with the Associate Dean and Research Coordinator), do students nominate
   three faculty members, does a faculty member accept or decline, who approves an external panel member, and is there a
   cap on panel service (OQ-19 to OQ-22)?
10. Form 7: GS-F-33 uses the criteria and points of the Handbook's outstanding-thesis rubric (p. 76: 15, 40, 15, 30
    points) and the 85 / 90 thresholds of p. 67. Is that the intended rubric, and does it apply to a project paper?
11. Public final defense: application five days or two weeks before; 30 or 60 minutes; and which admission date decides
    between the public defense and the research-conference track (OQ-23, OQ-24, OQ-40).
12. Defense fees and honoraria: the fee tables in the Protocol copy are empty, so the forms state no amounts (OQ-27).
13. Ethics review: does the ethics committee have its own application and clearance forms? GS-F-31 is a general draft.
14. Turnitin certificate: who issues it and in what form (GS-F-36 is proposed).
15. Publication: who is the external expert on the Research Committee, does the Scopus / Web of Science / ISI requirement
    apply to every program from AY 2022-2023, and what happens to a student who cannot publish in time (OQ-25)?
16. Practicum: which programs, how many hours (the platform default of 200 is the group's assumption, left blank on the
    forms), who signs the agreement for the University, does University counsel review the agreement, and may a Psychology
    student do the practicum before the comprehensive examination (OQ-29)?
17. Graduation: the review window, the deadline and the treatment of late applicants, and the checklist of documents
    (OQ-30, OQ-31). The Registrar's acknowledgement and file formats (OQ-32).
18. Offices and titles: is the signatory "Graduate School Secretary" on GS-P-01 the same person as the "Graduate Program
    Secretary" in the Handbook, and are the mailboxes in the forms (gsresearch@, rerc@, turnitin@, gsm@usls.edu.ph) current (OQ-39)?

19. Research adviser rules differ between the sources: the Handbook (p. 58) asks for a faculty member of the Graduate School
    with a doctoral degree aligned with the discipline and at least one refereed publication, and counts five advisees per
    semester (p. 59); the Protocol asks for a PhD for PhD students and at least PhD units for MA students (CHED CMO 15) and
    five active advisees per academic year. GS-F-19 states both. Which governs?
20. Project paper: the Protocol gives the provisional-pass score only for a thesis (below 85) and a dissertation (below 90).
    GS-F-32 and GS-F-33 leave the project-paper threshold as a blank to be filled by the Graduate School.
21. Proposal defense outcomes: the Protocol names the final-defense decisions (pass, pass with minor revisions, provisional
    pass with major revisions) but only says that major revisions at the proposal defense mean a re-defense. GS-F-29 offers
    Passed, Passed with minor revisions, Major revisions. Are those the outcomes to use?
22. Mixed-methods studies and Form 4.1: the Protocol requires it for quantitative studies and excludes qualitative studies;
    it says nothing about mixed methods. GS-F-25 offers only those two options.
23. Readmission: the Handbook (p. 45) lists four requirements. GS-F-08 also records three platform checks (updated study
    plan, adviser consultation, no pending accountability) under a separate heading marked as not Handbook requirements.
    Keep or strike them?
24. AWOL: the Handbook (p. 53) defines the status but does not say it is reported to the Registrar. GS-F-09 says so only as
    "to be confirmed". Is the Registrar informed, and by which form?
25. Rescheduling a defense (GS-F-28): is a new date subject to the two-week endorsement and 14-Day Rule lead times, as the
    form states, and who may ask for it?
26. Public final defense endorsement (Form 4.3): the Handbook names it "Endorsement for Public Defense" (pp. 72-73) and, in
    a note, "Endorsement for Final Defense"; the Protocol uses "Endorsement for Public Final Defense" in a note. GS-F-35 uses
    the Protocol's note wording. Is that the official title?
27. Ethics committee mailbox: the Protocol gives rerc@usls.edu.ph, the Handbook (pp. 65, 68) gives another address; the forms
    use the Protocol's. The Handbook calls the body the Social Research Ethics Committee (p. 23).
28. Practicum Agreement (GS-F-11): the responsibilities paragraph is the group's draft wording, not a University text.
    Who reviews it before it is used?

Also still open from the process audit: waiver of the two-week rules (OQ-43), time limits and what follows when they are
exceeded (OQ-41), and whether weekends and holidays count in lead times.

## Verification (2026-11-03)

Every rule sentence, citation, form number and form title in `build_forms.py` was checked against the Handbook
(`GRADUATE-SCHOOL-HANDBOOK-22-23.pdf`, printed page = PDF page minus four, the convention of the rule register), the
Research Protocol (AY 2024-2025 copy) and `operations_manual_rules.json`. About 310 statements (229 instruction sentences,
21 paragraph blocks, checklist and classification lines) and about 160 citations were read against the source passage.
Result: the numbers, periods, percentages, fees, scores and page cites were correct except as listed below. Statements that
rest only on the register's Practice or Proposed rules (the Graduate School's own working practice, not the Handbook) are
now marked on the form ("proposed practice", "to be confirmed") or left as blanks.

Corrected:

- Titles to the Protocol's wording: GS-F-20 "Appointment of Research Adviser" became "Appointment for Research Adviser"
  (Form 3.1); GS-F-39 "Formal Invitation to Co-Author a Journal Article" became "Formal Invitation to Co-Author Journal
  Article" (Form 11). Old files removed.
- GS-F-05: removed "a student who will not return should file a leave"; now "a student who withdraws after the second week may
  file a leave (Handbook p. 53)". Removed the claim that only the Business Office computes fees.
- GS-F-06: citation p. 54 removed (p. 52 only); the Approved Absence rule now states who grants it (Dean's approval); removed an
  invented right of the student to explain an absence to the Dean; the drop for another ground is marked "to be confirmed".
- GS-F-08: the three non-Handbook checks (study plan, adviser consultation, pending accountability) moved to a separate list
  marked as not Handbook requirements; the Handbook's four requirements now cited (p. 45) with no failed subject (p. 54).
- GS-F-09: "curtailed until you return" became "curtailed or entirely withdrawn" (p. 53); removed the unsourced statement that
  the years away count in maximum residence and that the Registrar is informed through GS-F-44 (now "to be confirmed").
- GS-F-10: removed the unsourced "residency fee"; the Handbook states none.
- GS-F-11: removed the unsourced list of programs (Psychology, MS Guidance and Counseling).
- GS-F-16: removed "the Graduate School checks only completeness" and "read into the Graduate School record"; cited pp. 59-60.
- GS-F-17: nomination rule restated as the Protocol states it (Academic Coordinator recommends; the research adviser
  recommends the external member, GS Research Committee approves).
- GS-F-19: removed "propose up to three faculty members"; removed the invented "nominate again" outcome; added that the Handbook
  asks for a doctoral degree.
- GS-F-21: "before the proposal defense application" became "before the proposal defense" (the Protocol's wording for the adviser;
  the title change keeps "application", GS-F-24).
- GS-F-22: one year to submit and defend the proposal applies to a thesis and a dissertation, not a project paper (p. 58).
- GS-F-23: removed "within a reasonable time"; reworded "keep a copy of every approval".
- GS-F-25: removed the mixed-methods option (not in the Protocol).
- GS-F-27: "the same panel takes part in the proposal and final defense" became "the same set takes part in the closed-door
  final defense"; students abroad: the panel chair recommends an online defense.
- GS-F-32, GS-F-33: provisional-pass scores are below 85 for a thesis and below 90 for a dissertation only; the Protocol gives
  none for a project paper (blank). GS-F-33 now says the criteria are the Handbook's outstanding thesis rubric (p. 76).
  GS-F-32 cites pp. 72-73.
- GS-F-35: the two-week rule is the Handbook's (p. 73), not the Protocol's; the Protocol says five days.
- GS-F-42: the conference requirement is now stated as the Handbook and Protocol state it (GS Research Conference or an external
  one; p. 80 for the Alumni seminar); the replacement-of-application rule is marked proposed practice.
- GS-F-43: removed "the Graduate School does not issue the diploma"; GS-F-44 cites p. 50.
- Role names unified (Research Adviser, Panel Chair, Graduate School Staff); signature order unified to student, adviser,
  then coordinators and Dean (GS-F-23, 27, 34, 35 changed). GS-P-01: "program clusters" became "program areas".
- Typography: instruction boxes 9.5 pt; GS-P-02 table 9 pt (4 pages). Three forms grew from one to two pages; none exceeds two.

Could not verify: the content of Protocol Forms 1 to 13 themselves (the sources describe them but hold no layout); the Handbook
does not name Form 13; the copy of the Protocol has no fee amounts; no residency fee, practicum hours or review-window dates
exist in the sources; the CHED memorandum and the Facebook and e-mail addresses were not opened.

## Not verified

- Nothing was shown to the Graduate School yet; every statement of policy on the forms is cited to a Handbook page or a
  Protocol section, but the group has not confirmed the readings with the Dean.
- The Handbook copy is the 2022-2023 edition; the owner decided on 2026-10-01 that it is still in force.
- The Handbook page numbers cited are the printed page numbers (PDF page minus four).
