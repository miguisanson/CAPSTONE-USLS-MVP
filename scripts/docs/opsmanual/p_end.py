"""Process chapters 4.17 to 4.19: practicum, graduation, handoff to the Registrar."""

from __future__ import annotations

from .common import (C, H, N, OFFICIAL, P, PRACTICE, PROPOSED, Process, R)

NS = "—"

PRACTICUM = Process(
    num="4.17", key="PRC",
    title="Practicum",
    purpose="To record the practicum or internship required by some programs: the agreement with the practicum site, the hours completed, the certificates, and the Graduate School's acceptance of completion. The Handbook mentions the practicum only in passing; most of this chapter is therefore the group's proposal and must be confirmed.",
    who=["Student", "GS staff", "Academic Coordinator", "Graduate School Dean"],
    trigger="A student in a program that requires a practicum or internship has finished the eligible coursework and begins the practicum.",
    preconditions=["The student's program requires a practicum (see OQ-29).", "The student has completed the units the program requires before the practicum (the platform uses Basic 6, Major 9, Cognate 6, total 21 units as prototype values; OQ-29).", "The research stages that precede the practicum are complete according to the program (OQ-29)."],
    steps=[
        ("Student", "Submits the signed memorandum of agreement (MOA) with the practicum site, with the site and supervisor names.", "MOA (PDF)", NS),
        ("GS staff", "Records the MOA and forwards it to the Academic Coordinator.", "Practicum record", NS),
        ("Academic Coordinator", "Reviews the MOA and marks the practicum as in progress.", "MOA review", NS),
        ("Student", "Completes the required practicum hours; prepares the certificate or certificates and submits the practicum documents with the hours completed.", "Certificates (PDF); hours", NS),
        ("GS staff", "Records the submission and forwards the documents to the Academic Coordinator.", "Practicum submission record", NS),
        ("Academic Coordinator", "Reviews the certificates and checks the hours. If the hours are not complete, returns the case with a reason and requests additional certificates; if complete, records completion and sends a practicum status report to the Dean.", "Completion record; status report", NS),
        ("Student", "If returned: submits additional certificates or proof; earlier files are kept.", "Additional certificates", NS),
        ("Graduate School Dean", "Receives and reviews the practicum status report (marks it reviewed).", "Dean review", NS),
    ],
    rules=[
        R("PRC-01", "Students who have finished all their coursework and are just working on the practicum or internship, after a semester of enrollment for it, may enroll for residence.", H("p. 48"), OFFICIAL),
        R("PRC-02", "For the non-thesis track in Education, the integrating course (action research or practicum in the major field) must be completed before the student files for the comprehensive examination.", H("p. 56"), OFFICIAL),
        R("PRC-03", "The curriculum copied in the group's notes for the Doctor of Philosophy in Psychology lists DPSY330 Internship (six units) in the second semester of the second year, before the written comprehensive examination and the dissertation. (The document the curriculum was copied from is not identified in the notes.)", N("'Course stuff' section, program curriculum tables"), PRACTICE),
        R("PRC-04", "The practicum workflow applies only to students in Psychology programs and in the Master of Science in Guidance and Counseling (MSGC); students of other programs are excluded.", N("Proposal and scenario notes, practicum program restriction; Platform (current build)"), PROPOSED),
        R("PRC-05", "A student may begin the practicum only after the platform's check of curriculum completion and research progress is satisfied; if source data are missing the check shows Needs verification, not Pass.", N("Platform (current build): practicum eligibility"), PROPOSED),
        R("PRC-06", "The student submits a signed MOA, the practicum site and the supervisor's name; GS staff record and forward it; the Academic Coordinator reviews it and marks the practicum as in progress.", N("BPM accurate flow, section 11"), PROPOSED),
        R("PRC-07", "The required practicum hours default to 200; the practicum cannot be marked completed below the required hours; completion evidence is one or more certificate PDFs, and several certificates are allowed when the hours come from different companies.", N("Platform (current build); proposal notes"), PROPOSED),
        R("PRC-08", "If the hours are short, the Academic Coordinator returns the case with a reason; the student submits additional evidence; the earlier files stay in the history and are not overwritten.", N("Scenario notes, practicum unusual case"), PROPOSED),
        R("PRC-09", "The Academic Coordinator verifies hours and documents and sends a completed status report to the Dean; the Dean reviews the report and marks it reviewed. The Dean does not approve or deny the practicum.", N("BPM accurate flow, section 11"), PROPOSED),
    ],
    exceptions=[
        "Hours short of the requirement: the case is returned and additional certificates are requested (PRC-08).",
        "Hours across several organizations: several certificates are kept for the same case (PRC-07).",
        "A student of a program with no practicum: excluded from the workflow (PRC-04).",
        "The platform does not record the practicum's start and end dates or a schedule by organization; this is a missing feature (OQ-29).",
    ],
    records=[
        ("MOA, site and supervisor", "GS staff; Academic Coordinator"),
        ("Hours and certificates (all versions)", "GS staff; Academic Coordinator"),
        ("Practicum status report and the Dean's review", "Dean; Graduate School record"),
    ],
    platform="The student submits the MOA, the hours and the certificate PDFs in the platform; GS staff forward to the Academic Coordinator; the Academic Coordinator can request additional certificates; the status report goes to the Dean. Staff can see the cases as a board or table.",
    platform_diff="None of the practicum rules (programs, hours, unit prerequisites, documents) comes from the Handbook or the Research Protocol. The platform counts certificate files, not the validity of each certificate. All of it is the group's proposal and is listed for validation (OQ-29).",
)

GRADUATION = Process(
    num="4.18", key="GRD",
    title="Graduation application and endorsement",
    purpose="To confirm that a student has met every graduation requirement and to hand the endorsed list of candidates to the Registrar, who certifies eligibility.",
    who=["Student", "GS staff", "Academic Coordinator", "Research Coordinator", "Graduate School Dean", "University Registrar (external)"],
    trigger="The student applies for graduation in the semester in which all requirements are to be complete.",
    preconditions=["The student is officially enrolled during the semester of application for graduation.", "Coursework, comprehensive examination, final defense and revisions are complete."],
    steps=[
        ("Student", "Applies for graduation; in the platform, submits a signed graduation application (PDF).", "Graduation application", "In the graduation review window (dates not stated; OQ-30)"),
        ("GS staff", "Compiles the graduation candidate list and sends it to the Academic Coordinator.", "Candidate list", NS),
        ("Academic Coordinator", "Checks coursework completion; if incomplete, returns the list with the missing coursework.", "Coursework check", NS),
        ("Research Coordinator", "Validates the research completion documents (Forms 9 and 10, Turnitin, editor certificate and the other completion documents); if incomplete, returns the list with the missing items.", "Research validation", NS),
        ("GS staff", "Lists missing requirements and marks a student not eligible, or prepares the endorsement list and sends it to the Dean.", "Endorsement list", NS),
        ("Graduate School Dean", "Reviews the list; if not approved, returns it for revision; if approved, sends the endorsed list to the Registrar.", "Dean's approval", NS),
        ("University Registrar", "Receives the endorsed list, certifies the eligibility of candidates for graduation and honors, and confirms receipt.", "Registrar certification", NS),
        ("Student", "Attends the alumni seminar; completes the bound copy and the presentation and publication requirements; is not allowed to go up the stage if any requirement is unmet.", "Alumni seminar", "Before graduation"),
    ],
    rules=[
        R("GRD-01", "A student will only be considered a graduate of the University after completing all the requirements listed below; a student will not be allowed to go up the stage if requirements are not met.", H("p. 77"), OFFICIAL),
        R("GRD-02", "The student must be officially enrolled during the semester of application for graduation.", H("p. 77"), OFFICIAL),
        R("GRD-03", "The student must have completed all the prescribed subjects for the degree.", H("p. 77"), OFFICIAL),
        R("GRD-04", "The student must have passed the comprehensive examination.", H("p. 77"), OFFICIAL),
        R("GRD-05", "The student must have completed a successful final oral defense of the project paper, thesis or dissertation, and complied with the required revisions.", H("p. 77"), OFFICIAL),
        R("GRD-06", "The student must submit one bound approved copy of the project paper, thesis or dissertation and one CD. The bound copy conforms to the standard format of the University and contains the official approval by the members of the defense panel and the official acceptance by the Dean.", H("p. 77"), OFFICIAL),
        R("GRD-07", "The student must have paid all financial obligations to the University; the Graduate School may withhold reports of grades, transcripts of records and diplomas of students who have not fully paid.", [H("p. 77"), H("p. 51")], OFFICIAL),
        R("GRD-08", "The student must have presented the thesis or dissertation in a public seminar series.", H("p. 77"), OFFICIAL),
        R("GRD-09", "The student must have published at least one research paper while enrolled in the program in a Scopus-indexed, Web of Science and ISI journal, for those enrolled from AY 2022-2023 onwards.", [H("p. 77"), H("p. 75")], OFFICIAL),
        R("GRD-10", "Graduating students are required to attend the Alumni seminar given by the Alumni Director.", H("p. 80"), OFFICIAL),
        R("GRD-11", "The Office of the Registrar certifies the eligibility of candidates for graduation and honors.", H("p. 32"), OFFICIAL),
        R("GRD-12", "Academic honors: Highest Academic Honor needs a GPA of 1.1 or better and no grade lower than 1.25; High Academic Honor needs a GPA of 1.25 or better and no grade lower than 1.25 (doctoral) or 1.5 (master's). Both need moral and academic integrity, no repeated subject, no INC, D or W grade, and passing the comprehensive examination with no re-take.", H("pp. 55-56"), OFFICIAL),
        R("GRD-13", "GS staff compile the candidate list; the Academic Coordinator checks coursework; the Research Coordinator validates the research completion documents; GS staff prepare the endorsement list; the Dean approves it and sends it to the Registrar.", N("BPM accurate flow, section 12"), PROPOSED),
        R("GRD-14", "A student is eligible for selection into a graduation batch only after coursework, research and practicum (where applicable) are complete and the student has submitted a signed graduation application; an application with incorrect information is returned and replaced by a completely new corrected document, the original being kept.", N("Scenario notes, graduation standard and unusual cases; Platform (current build)"), PROPOSED),
        R("GRD-15", "Candidates are reviewed within a graduation review window for a school year opened and closed by the Graduate School; the dates, the treatment of late applicants and the treatment of eligible students who miss the window are to be set by the Graduate School.", N("Scenario notes; Platform (current build)"), PROPOSED),
        R("GRD-16", "After the Dean approves a batch, the endorsed list is exported as a file and the Dean sends it to the Registrar by the official email; the platform records the export and the status Exported — Ready to Send, and does not record that an email was sent or that the Registrar acknowledged it.", N("Scenario notes; Platform (current build)"), PROPOSED),
    ],
    exceptions=[
        "Coursework or research incomplete: the student is marked not eligible with the exact missing requirement (GRD-13).",
        "Application contains wrong information: returned and replaced (GRD-14).",
        "Publication evidence missing: the student cannot be declared a graduate or join the ceremony (CMP-10).",
        "Enrolled before AY 2022-2023: the publication requirement as written in GRD-09 applies only to those enrolled from AY 2022-2023 onwards; the earlier requirement is a conference presentation (CMP-08; OQ-25).",
    ],
    records=[
        ("Signed graduation application", "GS staff; platform"),
        ("Candidate list, endorsement list and batch", "GS staff; Dean"),
        ("Endorsed list sent to the Registrar", "University Registrar"),
    ],
    platform="The platform shows which students are academically eligible, asks for the signed application, lets GS staff group eligible students into a named batch, routes the batch to the Academic Coordinator, the Research Coordinator and the Dean, and exports the endorsed list for the Dean to send to the Registrar.",
    platform_diff="The platform does not check the Handbook's requirements for enrollment in the graduation semester, payment, the alumni seminar, public seminar series or publication (GRD-02, GRD-07 to GRD-10). The review window is limited to the active school year and has no opening or closing dates (OQ-30). The graduation document checklist beyond Forms 9 and 10 is to be confirmed (OQ-31).",
)

HANDOFF = Process(
    num="4.19", key="HND",
    title="Records handoff to the Registrar",
    purpose="To list what the Graduate School sends to the University Registrar and the Business Office, how it is sent, and how the office knows the Registrar has acted. The Graduate School decides; the Registrar records officially.",
    who=["GS staff", "Graduate School Dean", "University Registrar (external)", "Business Office and Accounting Office (external)"],
    trigger="The Dean approves a leave, a withdrawal, a readmission, a cross-enrollment or a graduation endorsement, or a change of grade is approved.",
    preconditions=["The Dean's decision is recorded."],
    steps=[
        ("GS staff", "Prepares the handoff: copy of the Withdrawal Form, notice of leave with reasons and refund, return intention endorsement, cross-enrollment approval, or the endorsed list.", "Handoff file or email", "After the Dean's decision"),
        ("Dean / Associate Dean", "Informs the University Registrar of a leave (reasons and refund) or endorses a returning student's written intent; sends the endorsed graduation list.", "Notice / endorsement", NS),
        ("GS staff", "Sends the file or email to the Registrar. There is no system integration: the exchange is by file or email.", "Email to Registrar", NS),
        ("Registrar", "Processes the change in the official record and, for a withdrawal, the Business Office then arranges the tuition adjustment.", "Registrar record", NS),
        ("GS staff", "Records in the Graduate School record that the handoff was sent, when and by whom, and the Registrar's confirmation when received (proposed).", "Handoff log", NS),
    ],
    rules=[
        R("HND-01", "The accomplished Withdrawal Form is provided to the Registrar, the Accounting Office, and the student.", H("p. 49"), OFFICIAL),
        R("HND-02", "The Dean, Associate Dean or authorized representative informs the University Registrar of a leave of absence, indicating the reasons and the amount of money refunded to the student, if any.", H("p. 53"), OFFICIAL),
        R("HND-03", "The Graduate School Dean endorses a returning student's written intention to enroll to the University Registrar.", H("p. 53"), OFFICIAL),
        R("HND-04", "Cross-enrollment: the Dean's written permission is presented to the Registrar, who issues the cross-enrollment permit; after the course the student submits the grade to the Registrar for inclusion in the academic record.", H("p. 50"), OFFICIAL),
        R("HND-05", "A professor submits his or her grades within one year after the course was enrolled; an error in grades is corrected after the professor explains in writing to the Dean and secures approval, before the Registrar submits grades to CHED.", H("p. 49"), OFFICIAL),
        R("HND-06", "The Registrar is the repository of the records of academic performance and certifies the eligibility of candidates for graduation and honors.", H("p. 32"), OFFICIAL),
        R("HND-07", "For a withdrawal, the request is sent to the Registrar, who processes it in the system, and the Business Office then arranges any tuition adjustment; the Graduate School's responsibility ends at sending the request to the Registrar.", C("21 July 2026"), PRACTICE),
        R("HND-08", "There is no integration between AIMS and the Graduate School record. The Graduate School cannot pull data from AIMS and may ask the ITS for an Excel export.", C("21 July 2026"), PRACTICE),
        R("HND-09", "The Graduate School keeps a log of each handoff (what, when, by whom, to which office) and of the Registrar's confirmation when one is received; the platform does not claim that the Registrar has acted until a confirmation is recorded.", [N("July 20 checklist, item 57"), C("20 July 2026", "adviser's remark that the Registrar must confirm")], PROPOSED),
        R("HND-10", "The export for the Registrar is a file (for withdrawals, an Excel list of approved withdrawals; for graduation, a CSV list of endorsed candidates) sent by the responsible person by email; column layouts are to be confirmed by the Registrar.", N("Scenario notes; Platform (current build)"), PROPOSED),
    ],
    exceptions=[
        "The Registrar does not confirm: not stated in the sources; the Graduate School follows up (Proposed; OQ-32).",
        "A handoff was sent for a request later cancelled: the log records the cancellation (Proposed).",
    ],
    records=[
        ("Handoff log", "GS staff"),
        ("Registrar's confirmation (if any)", "GS staff"),
    ],
    platform="The platform prepares the withdrawal Excel file and the graduation CSV file and shows a notice that nothing has been sent; the responsible person sends the file by email. The platform does not record the Registrar's confirmation.",
    platform_diff="Whether the Graduate School should record a Registrar acknowledgement, with a reference number and date, or leave acknowledgement outside the platform, is an open decision (OQ-32). The export columns and file names are not yet confirmed by the Registrar.",
)
