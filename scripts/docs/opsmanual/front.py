"""Front matter (chapters 1-3), appendices, sign-off and control data."""

from __future__ import annotations

VERSION = "0.2"
DOC_DATE = "2026-10-01"
TITLE = "University of St. La Salle Graduate School Operations Manual"
COVER_MARK = (
    "DRAFT v0.2 — prepared by the capstone group for validation by the Graduate "
    "School; not an official USLS document until approved"
)
FILE_STEM = "USLS GS Operations Manual - DRAFT for Validation"

CONTROL_ROWS = [
    ("Document title", "University of St. La Salle Graduate School Operations Manual"),
    ("Version", f"{VERSION} (draft for validation)"),
    ("Date of this version", DOC_DATE),
    ("Prepared by", "Capstone group CAP-IT1, Graduate Student Lifecycle Monitoring and Analytics Platform (University of St. La Salle Graduate School project)"),
    ("To be validated by", "Graduate School Dean and Associate Dean, University of St. La Salle Graduate School (with the Academic Coordinators and the Research Coordinator)"),
    ("Status", "Draft. Every rule marked Practice or Proposed, and every question in Chapter 6, must be confirmed or corrected by the Graduate School before this manual is treated as official."),
    ("Sources", "Graduate Programs Student Handbook 2022-2023; Graduate School Research Protocol AY 2024-2025 (without publication protocol); student monitoring and research monitoring workbooks; the group's consultation notes of July 2026."),
    ("Regeneration", "The manual is kept as structured content in the group's project files, so that corrections from the Graduate School can be entered and the manual reissued with a new version number and change-log entry."),
]

# Block types: h2, h3, p, bullets, table {header, rows, widths}, note
CH1 = [
    {"h2": "1.1 Purpose"},
    {"p": "This manual describes, in one place and in the same layout for every process, how the Graduate School (GS) of the University of St. La Salle (USLS) carries out the student lifecycle: from the hand-over of an admitted student to the Graduate School, through enrollment, course adjustments, leave, residency, the comprehensive examination and the thesis, dissertation or project paper, to graduation endorsement."},
    {"p": "The Graduate School has told the capstone group that it does not have an operations manual. Policies exist in the Graduate Programs Student Handbook and in the Graduate School Research Protocol, but the office routines, the business rules that connect the steps, and the records that the office keeps are not written down together. The panel of the group's Stage 1 defense asked that the policies of the operations manual be included in the platform and asked whether business rules had been considered for each process, for example whether a student can drop at any time, even on the first day. The panel's suggestion, accepted by the group, was that the group write a first draft of the manual and that the Graduate School correct and validate it. This document is that first draft."},
    {"h2": "1.2 Scope"},
    {"p": "The manual covers the processes that the Graduate School coordinates for a graduate student. It covers nineteen lifecycle areas, each in its own section of Chapter 4: admission handoff and onboarding; enrollment and academic load; course offering and course adjustments; withdrawal of subject; dropping; leave of absence; return from leave and readmission; absence without leave (AWOL); residency enrollment and maximum residence; the comprehensive examination; the title defense; adviser designation; the proposal defense and ethics review; the final defense; revisions and completion; defense scheduling and rescheduling; practicum; graduation application and endorsement; and the handoff of records to the Registrar."},
    {"p": "The manual does not describe admission testing, billing, grading, the registration system or student discipline and student life (Handbook chapter 7) in detail. Those belong to the Admissions and Scholarship Administration Office, the Business Office and the University Registrar. Where the Graduate School hands a case to one of them, the manual states what is handed over and stops there."},
    {"h2": "1.3 Relationship to the Handbook and the Research Protocol"},
    {"p": "This manual does not replace the Graduate Programs Student Handbook 2022-2023 or the Graduate School Research Protocol AY 2024-2025. Those two documents remain the policy sources. The manual states how the office carries the policies out: who does each step, in what order, with which form, and within which time limit. Where the manual quotes a rule it gives the source and the page."},
    {"p": "Where the Handbook and the Protocol differ from each other, or differ from what office staff described in consultation, the manual does not choose. It states each version, labels it by source, and lists the difference as an open question in Chapter 6 for the Graduate School to decide. Until the Graduate School answers, the platform follows the Handbook, which is the document in force."},
    {"h2": "1.4 How to read this manual"},
    {"p": "Chapter 2 names the roles. Chapter 3 lists the records the office keeps and says which system is the official record for each kind of data. Chapter 4 has one section per process. Every process section has the same parts, in this order:"},
    {"bullets": [
        "Purpose, who is involved, trigger and preconditions.",
        "Procedure: a numbered table with the step, who does it, what they do, the form or record used, and the time limit. A dagger (†) next to a step number marks a step that is not described in the Handbook or the Protocol.",
        "Business rules: a table with a rule number (for example WD-01), the rule in one plain sentence, the source with page or section, and a status.",
        "Exceptions and unusual cases and how they are handled.",
        "Records produced and where they go.",
        "How the platform supports the process, and any difference between the platform and the rule.",
    ]},
    {"p": "Each business rule carries one of three statuses:"},
    {"table": {"header": ["Status", "Meaning", "What the Graduate School is asked to do"], "widths": [2.2, 8.0, 6.4], "rows": [
        ["Official", "Stated in the Handbook or in the Research Protocol. The wording is quoted or closely paraphrased and the page or section is given.", "Check that the rule is still in force and correctly worded."],
        ["Practice", "Described by Graduate School staff in a consultation, or recorded in the group's consultation notes as a stakeholder-confirmed answer, but not written in an official source.", "Confirm, correct, or strike the rule. If it is correct, say whether it should be written into the Handbook or Protocol."],
        ["Proposed", "The group's proposal where no source exists, or where the only basis is the group's own process model or the platform's current behavior.", "Approve, change, or strike the rule."],
    ]}},
    {"p": "Chapter 5 gathers all rules into one register, sorted by process. Chapter 6 lists every question that the group could not answer from the sources, with the options and a blank for the answer. Chapter 7 is the validation and sign-off page."},
    {"h2": "1.5 Evidence used and its limits"},
    {"p": "Only the following sources were used. No policy has been invented; where a step or rule has no source it is labelled Proposed."},
    {"table": {"header": ["Source", "What it gives", "How it is cited"], "widths": [5.2, 6.4, 5.0], "rows": [
        ["Graduate Programs Student Handbook 2022-2023 (Graduate School Handbook, 106 PDF pages)", "Admission, registration, withdrawal, attendance, leave of absence, grading, retention, maximum residence, comprehensive examination, thesis and dissertation guidelines, graduation requirements.", "\"Handbook 2022-2023, p. N\", where N is the page number printed on the page (not the PDF page index). The Handbook's body numbers its sections 3.1 to 3.11 while its table of contents numbers them 6.1 to 6.12; the manual therefore cites pages and headings, not section numbers."],
        ["Graduate School Research Protocol, updated for AY 2024-2025, without publication protocol", "Step-by-step protocol for title defense, adviser designation, change of title and adviser, proposal defense, closed-door final defense, public defense, and completion.", "\"Research Protocol AY2024-2025\" with the part and step, for example \"Title Defense, Part I, step 2\". The Protocol has no page numbers. Its fee tables are blank in the copy supplied."],
        ["Student monitoring workbook (AC-STUDENT-MONITORING template) and Student Research Monitoring workbook", "What the office records per student and per research milestone.", "\"Monitoring workbook\" / \"Research monitoring workbook\"."],
        ["Consultation of 21 July 2026 with the Graduate School Associate Dean (the group's point person at the Graduate School)", "How enrollment, drops, withdrawals and status tagging are done in practice; what goes to the Registrar and the Business Office.", "\"Consultation 21 July 2026\". The transcript file is headed 22 July; the group's file list calls it 21 July and this manual follows the group's file list."],
        ["Consultation notes and sessions of 15, 20 and 29 July 2026 (capstone adviser sessions and rehearsal, with stakeholder answers relayed in the group's checklist)", "Stakeholder-confirmed answers recorded in the group's July 20 checklist (enrollment period, course-adjustment window, source of grades, drop handling), and questions put to the group.", "\"Consultation N July 2026\" or \"Group working notes, July 20 checklist, item N\". A statement made only by the capstone adviser about how schools normally work is not treated as Graduate School practice; it is labelled Proposed."],
        ["Group working notes (process models, BPMN flow, scenario notes)", "The sequence of steps the platform follows and the group's own proposals.", "\"Group working notes, BPM accurate flow, section N\". Steps that rest only on these notes are labelled Proposed."],
        ["The platform (current build)", "What the software enforces today, used only for the paragraph \"How the platform supports the process\".", "\"Platform (current build)\"."],
    ]}},
    {"h2": "1.6 Conventions"},
    {"bullets": [
        "Dates are written as day month year or year-month-day. The version date of this draft is 2026-10-01.",
        "\"First week\" and \"second week\" are quoted from the Handbook. How the weeks are counted is an open question (Chapter 6).",
        "\"GS mailbox\" means the Graduate School research mailbox named in the Research Protocol (gsresearch@usls.edu.ph).",
        "The Academic Coordinators, the Research Coordinator and GS staff are described by role, not by personal name, except where an official source names a person.",
        "Quoted text keeps the source's wording, including its spelling.",
        "In the procedure tables a dash (—) in the \"Time limit\" column means that no time limit is stated in the sources.",
    ]},
]

ROLES_HEADER = ["Role", "What the role does (as stated in the sources)", "Source"]
ROLES = [
    ["Graduate School Dean", "Appoints the research adviser; with the Associate Dean and the Research Coordinator makes the final decision on adviser assignments. Approves a student's written request to withdraw subjects. Receives written leave-of-absence requests; with the Associate Dean or an authorised representative informs the Registrar of a leave. Endorses a returning student's written intent to the Registrar. Gives written permission for cross-enrollment. Approves corrections of grades explained in writing by the professor. Approves master's option transfers after the Academic Coordinator's recommendation and the Associate Dean's endorsement. Requests special classes through the Vice Chancellor for Academic Affairs. Signs the appointment of the research adviser (Form 3.1). Receives the publication request (Form 12) for approval. Officially accepts the project paper, thesis or dissertation for graduation.", "Handbook 2022-2023, pp. 48-50, 52-53, 58-59, 75, 77; Research Protocol AY2024-2025, Designation of the Research Adviser, Part I"],
    ["Associate Dean", "Gives written approval for adding subjects in the first week. Endorses master's transfers. Signs Form 3.1. Takes part in deliberating adviser designation and change of adviser, and sits on the GS Research Committee. Is copied on the public defense announcement.", "Handbook 2022-2023, pp. 48-49, 59, 62, 72, 75; Research Protocol AY2024-2025, Designation of the Research Adviser, Part I, step 3"],
    ["Academic Coordinator (AC)", "One coordinator per program cluster (Arts and Sciences, Business, Education, Engineering and Technology, Nursing). Carries out academic evaluation and electronic advising at enrollment. Recommends master's transfers and requests special classes through the Dean. Evaluates master's students before the comprehensive examination and advises them to enroll in residency for it. Endorses the title defense application (Form 1) and recommends panel members. Notes the adviser application by email or letter to the Research Coordinator. Sits on the GS Research Committee. In practice advises a student which offered subjects to take, tags the student's subject status, and decides which subjects are offered and which professor teaches them.", "Handbook 2022-2023, pp. 14-15, 47-48, 56, 59-60, 75; Research Protocol AY2024-2025, Title Defense, Part I, steps 2-4; Consultation 21 July 2026"],
    ["Research Coordinator (RC)", "Receives research forms at the GS mailbox. Nominates panel members after deliberation with the GS Research Committee, informs panel and student of the schedule, sends the comments and evaluation sheets, emails the appointment of the adviser, prepares and posts the public defense announcement, and coordinates the publication review. With the Dean and the Associate Dean decides adviser assignments.", "Handbook 2022-2023, pp. 59-63, 69-75; Research Protocol AY2024-2025, Title Defense, Designation of the Research Adviser, Proposal Defense, Public Defense"],
    ["Graduate School staff (GS Office) and Graduate Program Secretary", "Coordinate panel schedules and reserve venues with the panel chair, process campus entry for public defenses, receive comprehensive examination applications and the Incomplete Grade Removal Form, issue the Advice Slip for adding subjects, coordinate the Approval Sheet (Form 10), and receive the student's completion documents. In practice they also record handoffs, tag subject status, and forward requests to the Dean.", "Handbook 2022-2023, pp. 49, 54, 56-57, 60, 68, 73; Consultation 21 July 2026"],
    ["Faculty and Research Adviser", "The adviser monitors the research according to the timetable (Form 3.2), reviews proposals and chapters, gives technical and moral guidance, conducts mock defenses when necessary, attends the defense of the advisee, attends Graduate School orientations, endorses defenses (Form 4, Form 4.3), records panel comments, and verifies that panel recommendations are reflected in the final manuscript. The adviser is bound only to advising and may not be the student's editor.", "Handbook 2022-2023, p. 59; Research Protocol AY2024-2025, Proposal Defense and Final Defense sections"],
    ["Panel chair and panel members", "The panel chair hosts the defense, prepares online details or reserves the room through the GS Office, consolidates the comments sheets and emails them within the first working day, and announces the result. A thesis panel has a chair, a content specialist, a method specialist and an external panel member who joins from the proposal defense onward; a dissertation panel has two content specialists. A project paper panel has a chair and two members (one content specialist, one method specialist).", "Handbook 2022-2023, pp. 60-61, 63-66, 70-73; Research Protocol AY2024-2025, Title Defense, Part I, step 4"],
    ["Statistician", "Consults with the student on quantitative studies and accomplishes the Statistical Consultation Form (Form 4.1) before the proposal defense.", "Handbook 2022-2023, p. 63"],
    ["Editor", "Chosen by the student from the pool of editors affiliated with the University so that the USLS Institutional Research Format (IRF) is applied; issues the Editor Certification (Form 9).", "Handbook 2022-2023, p. 68"],
    ["Professor of the subject", "Drops a student from a course when unexcused absences exceed 20% of the scheduled hours; submits grades within one year after the course was enrolled; explains a change of grade in writing to the Dean.", "Handbook 2022-2023, pp. 49, 52"],
    ["Research ethics office (Social Research Ethics Review Office and committee; the Protocol calls it RERC/RERO)", "Receives the Application for Ethics Review (Form 5.2) with the revised manuscript and Technical Review Certificate, and issues the ethics clearance.", "Handbook 2022-2023, pp. 23, 65; Research Protocol AY2024-2025, Proposal Defense, Part III"],
    ["Publication and Engagement Office (PEO)", "Provides the approved list of journals for the publication requirement.", "Handbook 2022-2023, p. 75"],
    ["Student", "Starts each application, prepares the forms and manuscripts, emails them to the right office, meets the lead times, settles the defense fees, and keeps the copy of every approval.", "Handbook 2022-2023, pp. 47-77; Research Protocol AY2024-2025"],
]

EXTERNAL_HEADER = ["External office", "Role in the lifecycle", "What the Graduate School hands over or receives", "Source"]
EXTERNAL = [
    ["University Registrar", "Repository of records of academic performance; ensures compliance with CHED requirements; facilitates registration or transfer; certifies the eligibility of candidates for graduation and honors. In practice processes withdrawals in the registration system (AIMS).", "Receives the Withdrawal Form copy, the notice of an approved leave with any refund amount, the Dean's endorsement of a returning student's written intent, cross-enrollment approvals, the graduation endorsement list. Sends enrollment and grade information that the Graduate School can see in AIMS.", "Handbook 2022-2023, pp. 32, 49-50, 53; Consultation 21 July 2026"],
    ["Business Office and Cashiers", "Take enrollment payments, un-tag an enrollment form for adding subjects, release statements of account, execute promissory notes, receive the comprehensive examination fee, charge the withdrawal fee on a leave.", "The Graduate School does not compute fees. It tells the student to go to the Business Office and keeps the receipt.", "Handbook 2022-2023, pp. 47, 49, 51, 53, 57"],
    ["Accounting Office", "Receives a copy of the accomplished Withdrawal Form. In practice the Business Office then arranges any tuition adjustment after the Registrar has processed the withdrawal.", "A copy of the Withdrawal Form.", "Handbook 2022-2023, p. 49; Consultation 21 July 2026"],
    ["Admissions and Scholarship Administration Office (ASAO) and Guidance and Evaluation Center (GEC)", "Receive letters of intent, run the entrance examination and admission requirements through the AIMS applicant account.", "Nothing is handed over by the Graduate School. The Graduate School receives the admitted-student information.", "Handbook 2022-2023, pp. 45-47"],
    ["Information Technology Services (ITS) and AIMS", "AIMS is the University's student information system. The group was told that the platform cannot be integrated with AIMS. In practice the Graduate School can ask ITS for an Excel export.", "No live data exchange; files and manual entry only.", "Consultation 21 July 2026"],
    ["Vice Chancellor for Academic Affairs (VCAA)", "Receives requests for special classes from the Academic Coordinator through the Dean.", "Special class request.", "Handbook 2022-2023, p. 48"],
]

CH3_INTRO = "The Graduate School keeps the following records. Chapter 4 says, for each process, which record is produced and where it goes."
RECORDS_HEADER = ["Record", "Kept by", "What it holds", "Source"]
RECORDS = [
    ["Student monitoring workbook (one sheet per program and curriculum year)", "Academic Coordinator", "One row per student: academic year of entry, name, ID number, program and track (for example thesis or non-thesis), year, completed units under Basic, Major and Cognate courses with totals, the comprehensive examination result, the thesis, capstone or dissertation status, and a note column. It is the full curriculum plan for each student and shows which subjects are taken.", "Monitoring workbook (AC-STUDENT-MONITORING template); Consultation 21 July 2026"],
    ["Student research monitoring workbook", "Research Coordinator and GS Office", "One row per student: academic year first enrolled in the capstone or thesis, current academic year and semester, name, program, research adviser, and dated milestones: endorsement for title defense, schedule of title defense, approved title (from Form 2), endorsement for research proposal, schedule of proposal, technical clearance, submission for ethics review, ethics clearance, endorsement for final defense, schedule of final defense, schedule of public defense, Turnitin scan certificate, editor's certification, final approval sheet, and publication.", "Research monitoring workbook"],
    ["Class list or enrolled list per subject offering", "Academic Coordinator and GS staff", "Student first name, last name and ID number for each subject offered in a term; built by importing a class list or by searching for a student and tagging the student as enrolled. The group was told there is no standard Excel file, so the fields are defined by the office.", "Consultation 21 July 2026"],
    ["Subject status per student and subject", "Academic Coordinator and GS staff", "One status per student-subject pair: not taken, enrolled, taken, dropped, withdrawn, and (as reported by faculty) incomplete or failed. The status is a tag; it is not a grade.", "Consultation 21 July 2026"],
    ["Subject offering list per term", "Academic Coordinator", "Program, subject code, subject, faculty and schedule for each subject offered in a semester.", "Group working notes, July 20 checklist, items 35 and 69 (stakeholder-identified fields)"],
    ["Forms and approvals", "Research Coordinator and GS Office", "Forms 1 to 13 and their sub-forms (Appendix A), kept with the e-signatures and dates, and the Withdrawal Form, the Incomplete Grade Removal Form, the comprehensive examination application and the Advice Slip.", "Handbook 2022-2023, pp. 49, 54, 56-57, 59-75; Research Protocol AY2024-2025"],
    ["Defense fee receipts", "GS mailbox", "The student's screenshot or deposit slip, sent within the first working day after a defense, with the subject line format LAST NAME_type of defense_receipt.", "Research Protocol AY2024-2025, Title Defense, Part III, step 4"],
    ["Leave, withdrawal, return and residency requests", "Graduate School Dean's office and GS staff", "The written request and the decision, the effective term, and the copy sent to the Registrar.", "Handbook 2022-2023, pp. 49, 52-53"],
    ["Practicum and graduation files", "Academic Coordinator and GS staff", "Practicum agreement (MOA), hours and certificates; the graduation candidate list and endorsement list. Their structure is the group's proposal (see Chapters 4.17 and 4.18).", "Group working notes, BPM accurate flow, sections 11 and 12"],
]

SOURCE_OF_RECORD_HEADER = ["Kind of data", "Official record", "What the Graduate School and the platform do with it"]
SOURCE_OF_RECORD = [
    ["Student identity, student number and institutional email", "University Registrar, through AIMS", "The Graduate School does not generate student numbers or emails. It receives them from the monitoring workbook or an AIMS export. Basis: student numbers are created by the Registrar (Consultation 15 July 2026, recorded in Group working notes, July 20 checklist, items 3 and 4)."],
    ["Enrollment and enrolled subjects", "AIMS and the University Registrar", "The student enrolls in AIMS after advising by the Academic Coordinator. The Academic Coordinator also tags the subject as enrolled in the Graduate School's record (Consultation 21 July 2026). The platform is a monitoring record; it does not enroll students."],
    ["Grades and subject completion", "AIMS and the University Registrar (faculty submit grades through the Registrar's process)", "The Graduate School does not create or alter grades. It may tag subject status for monitoring (Consultation 21 July 2026; Group working notes, July 20 checklist, items 21 and 80)."],
    ["Fees, payments, refunds and promissory notes", "Business Office and Cashiers", "The Graduate School never computes fees. It may show the student the Handbook's percentages as information."],
    ["Approval of leave, withdrawal, dropping and readmission", "The decision is the Graduate School Dean's; the official record of the change of status is the Registrar's", "The Graduate School records the request and the decision, sends a copy to the Registrar, and waits for the Registrar to process it (Handbook 2022-2023, pp. 49, 53; Consultation 21 July 2026)."],
    ["Research milestones, forms, panels and schedules", "Graduate School (Research Coordinator and GS Office)", "The platform and the research monitoring workbook are the working record for these milestones. They do not exist in AIMS."],
    ["Comprehensive examination result", "Graduate School (Academic Coordinator and Graduate Program Secretary)", "Recorded in the COMPRE column of the monitoring workbook."],
    ["Graduation eligibility, honors and diploma", "University Registrar certifies eligibility; the Dean endorses", "The Graduate School compiles the endorsement list; the Registrar certifies and issues."],
]

CH3_NOTES = [
    {"h2": "3.3 Principles for keeping records"},
    {"bullets": [
        "An official value (student number, enrollment, grade) is never retyped from memory or overwritten by a Graduate School note. If the Graduate School record and the official record differ, the official record is followed and the difference is flagged for follow-up (Proposed; based on the group's consultation of 20 July 2026).",
        "Every change to a record is traceable to a person, a date and a reason (Proposed).",
        "A document is checked for completeness by the office. The office does not certify the academic quality, authenticity or ethical validity of its content (Proposed; Group working notes, July 20 checklist, item 42).",
        "Unresolved duplicate students are identified by student number, not by name, and do not count in totals until resolved (Proposed; Group working notes, July 20 checklist, items 13 and 14).",
    ]},
]

FORMS_HEADER = ["Form", "Name", "Used in", "Source"]
FORMS = [
    ["Admission Application Form", "Admission Application Form (with two recommendation letters, ID picture, transcript of record, transfer credentials)", "4.1 Admission handoff and onboarding", "Handbook 2022-2023, p. 42"],
    ["Signed Undertaking Form / Recommendation Form / Essay Questionnaire", "Admission forms downloaded from the Graduate School web page", "4.1", "Handbook 2022-2023, pp. 46-47"],
    ["Advice Slip", "Advice Slip from the Graduate School Office (adding subjects) and Advise Slip from the Dean (returnees)", "4.3, 4.7", "Handbook 2022-2023, pp. 45, 49"],
    ["Withdrawal Form", "Accomplished after the Dean approves the student's letter; copies to the Registrar, the Accounting Office and the student. The blank form was not available to the group.", "4.4", "Handbook 2022-2023, p. 49"],
    ["Incomplete Grade Removal Form", "Submitted to the Graduate School Office (gsm mailbox) within the set deadline", "4.5", "Handbook 2022-2023, p. 54"],
    ["Application for the comprehensive examination", "Filed with the Graduate Program Secretary at least two weeks before the examination, with the official receipt", "4.10", "Handbook 2022-2023, pp. 56-57"],
    ["Cross-enrollment permit", "Issued by the Registrar on the Dean's written permission", "4.2, 4.19", "Handbook 2022-2023, p. 50"],
    ["Form 1", "Application for Title Defense", "4.11 step 1", "Handbook 2022-2023, p. 59"],
    ["Form 2", "Report of Title Defense", "4.11 steps 5, 8-9", "Handbook 2022-2023, pp. 60-61"],
    ["Form 3", "Application for Designation of Research Adviser", "4.12 step 1", "Handbook 2022-2023, p. 61"],
    ["Form 3.1", "Appointment for Research Adviser", "4.12 steps 4-5", "Handbook 2022-2023, p. 61"],
    ["Form 3.1.1", "Request for Change of Research Adviser", "4.12", "Handbook 2022-2023, p. 62"],
    ["Form 3.2", "Research Timetable", "4.12", "Handbook 2022-2023, pp. 59, 61"],
    ["Form 3.3", "Thesis/Dissertation Advising Contract", "4.12", "Handbook 2022-2023, p. 61"],
    ["Form 3.4", "Request for Change of Title of the Study", "4.12", "Handbook 2022-2023, p. 62"],
    ["Form 4", "Endorsement for Proposal/Final Defense", "4.13, 4.14", "Handbook 2022-2023, pp. 63, 65"],
    ["Form 4.1", "Statistical Consultation Form (quantitative studies)", "4.13", "Handbook 2022-2023, p. 63"],
    ["Form 4.2", "Co-authorship Information for Publication", "4.13", "Handbook 2022-2023, pp. 63-64"],
    ["Form 4.3", "Endorsement for Public Defense", "4.14", "Handbook 2022-2023, p. 72"],
    ["Form 5", "Comments Sheet for Proposal Defense", "4.13", "Handbook 2022-2023, p. 64"],
    ["Form 5.1", "Technical Review Certificate", "4.13", "Handbook 2022-2023, p. 65"],
    ["Form 5.2", "Application for Ethics Review", "4.13", "Handbook 2022-2023, p. 65"],
    ["Form 6", "Comments Sheet for Final Defense", "4.14", "Handbook 2022-2023, p. 66"],
    ["Form 7", "Evaluation Sheet for Final Defense", "4.14", "Handbook 2022-2023, p. 66"],
    ["Form 8", "Settlement of Provisional Thesis/Dissertation Approval", "4.14", "Handbook 2022-2023, p. 67"],
    ["Form 9", "Editor Certification", "4.15", "Handbook 2022-2023, p. 68"],
    ["Form 10", "Approval Sheet", "4.15", "Handbook 2022-2023, p. 68"],
    ["Form 11", "Formal Invitation to Co-Author Journal Article", "4.15", "Handbook 2022-2023, p. 75"],
    ["Form 12", "Publication Information Form", "4.15", "Handbook 2022-2023, p. 75"],
    ["Form 13", "Named in the Handbook as the form accomplished with the copy of the journal or certificate of publication; its title was not given in the sources", "4.15, 4.18", "Handbook 2022-2023, p. 75"],
    ["Practicum agreement (MOA)", "Memorandum of agreement with the practicum site; named in the group's process model only, no official form number", "4.17", "Group working notes, BPM accurate flow, section 11"],
    ["Graduation application", "Signed graduation application; named in the platform only, no official form number", "4.18", "Platform (current build)"],
]

GLOSSARY = [
    ("AC", "Academic Coordinator."),
    ("AIMS", "The University's academic information management system used by the Registrar for admission, enrollment and grades."),
    ("Advice Slip", "A slip issued by the Graduate School Office (or by the Dean for returnees) that allows a subject to be added or a returning student to enroll."),
    ("Approved absence", "Absence for a school-sponsored activity or official representation of the University, approved by the Dean, not counted against the allowed absences."),
    ("Bridging course", "Subjects a student must take to make up for an insufficient background, for example six units of thesis for an applicant with a non-thesis master's degree."),
    ("Closed-door final defense", "The first final oral defense of a thesis or dissertation before the panel, without an audience."),
    ("CHED CMO 15", "CHED Memorandum Order No. 15, series of 2019, cited by the Handbook and the Protocol for adviser qualifications."),
    ("Cognate", "An elective group of subjects in a graduate curriculum."),
    ("DRP", "The grade symbol given when a student is automatically dropped from a course for absences (Handbook p. 52); the grading table also lists the symbol D (Dropped)."),
    ("14-Day Rule", "At least fourteen days, inclusive of weekends, from the date the panel members receive the manuscript to the date of the oral defense."),
    ("GS", "Graduate School of the University of St. La Salle."),
    ("GS Research Committee", "The committee of the Dean, Associate Dean, Academic Coordinator and Research Coordinator that deliberates on panel and research matters (Research Protocol, Proposal Defense, Part I, step 4; Handbook p. 75 lists the Research Coordinator, Academic Coordinator, Associate Dean and an external expert)."),
    ("INC", "Incomplete grade. Must be removed within one academic year."),
    ("IRF", "USLS Institutional Research Format applied by the editor."),
    ("LOA", "Leave of absence."),
    ("Maximum residence", "The longest period a student may take to finish a program: master's seven academic years, doctorate nine, in each case including leave of absence."),
    ("MOA", "Memorandum of agreement with a practicum site."),
    ("Panel chair", "The university-affiliated panel member who hosts the defense and emails the consolidated forms."),
    ("Project paper", "The final requirement of a non-thesis master's option (for example the MBA project paper)."),
    ("PEO", "Publication and Engagement Office."),
    ("RC", "Research Coordinator."),
    ("Residency enrollment", "Enrollment with no subjects, allowed only for thesis or dissertation writing, practicum or internship, completing an incomplete grade, the comprehensive examination, or waiting for a research publication."),
    ("RERC / RERO / SRERO", "Research ethics committee and office. The Handbook uses Social Research Ethics Committee and Office; the Protocol uses RERC and RERO. Whether these are the same office is an open question."),
    ("SIR", "Similarity index rating from Turnitin. Not more than 15% is required."),
    ("Subject", "A course in the curriculum. A program is a degree."),
    ("TOR", "Transcript of record."),
    ("W", "Grade symbol for a withdrawn subject."),
    ("AWOL", "Absent without leave: withdrawing from the University without a formal leave of absence."),
]

SIGNOFF_HEADER = ["Reviewer name", "Position", "Date", "Signature", "Remarks"]
SIGNOFF_ROWS = 8
CHANGELOG_HEADER = ["Version", "Date", "Changed by", "Summary of change", "Approved by"]
CHANGELOG = [
    ["0.1", "2026-10-01", "Capstone group CAP-IT1", "First draft prepared from the Handbook 2022-2023, the Research Protocol AY 2024-2025, the office workbooks and the group's July 2026 consultation notes. Submitted for validation.", "Not yet approved"],
    ["0.2", DOC_DATE, "Capstone group CAP-IT1", "Platform paragraphs and the open questions brought in line with the platform as it now runs, after the ruling that the Handbook 2022-2023 is in force: subject withdrawal window and fees, length of a leave of absence, leave counted toward maximum residence, panel sizes, lead times, load, drop rule, first-week window for adding and changing subjects. Rules that describe the platform were reworded where they no longer matched. No Official or Practice rule changed.", "Not yet approved"],
    ["", "", "", "", ""],
]
