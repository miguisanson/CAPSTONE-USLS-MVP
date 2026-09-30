"""Process chapters 4.6 to 4.10: leave, return, AWOL, residency, comprehensive examination."""

from __future__ import annotations

from .common import (C, H, N, OFFICIAL, P, PRACTICE, PROPOSED, Process, R)

NS = "—"

LOA = Process(
    num="4.6", key="LOA",
    title="Leave of absence (LOA)",
    purpose="To allow a student who does not intend to enroll in a semester to stay connected to the University, and to state the limits on the leave.",
    who=["Student", "GS staff", "Graduate School Dean (or Associate Dean / authorised representative)", "University Registrar (external)", "Cashier (external)"],
    trigger="A student decides not to enroll in a semester for a valid reason (for example medical reasons) while still having units to take.",
    preconditions=["The student is not merely between semesters of continuous enrollment.", "The request is made on or before the deadline (the deadline is not stated; OQ-11).", "It is not within two weeks before the last day of classes."],
    steps=[
        ("Student", "Writes to the Dean stating the reason for the leave and the period requested.", "Written request to the Dean", "On or before the deadline (date not stated)"),
        ("GS staff", "Records the request and checks that the period and the student's earlier leaves are within the limits. Forwards it to the Dean.", "LOA request record", NS),
        ("Dean", "Approves or denies the request. The leave may be approved for one year and renewed for at most another year.", "Dean's decision", NS),
        ("Dean / Associate Dean / authorised representative", "Informs the University Registrar of the leave, stating the reasons and the amount of money refunded to the student, if any.", "Notice to the Registrar", NS),
        ("GS staff", "Records the student's status as On Leave and the effective dates, and sends the student the decision.", "Student status: On Leave", "After the Dean's decision"),
        ("Student", "If the leave is taken after two weeks of classes have passed, pays the withdrawal fee at the Cashier's office.", "Cashier receipt", NS),
    ],
    rules=[
        R("LOA-01", "A student who does not intend to enroll in a semester may apply for a leave of absence; a student on leave does not sever his or her ties with the University.", H("p. 52"), OFFICIAL),
        R("LOA-02", "A request for a leave of absence is made in writing to the Dean and states the reason for the leave and specifies the period.", H("p. 52"), OFFICIAL),
        R("LOA-03", "The leave may be approved for a period of one (1) year but may be renewed for at most another year.", H("p. 52"), OFFICIAL),
        R("LOA-04", "LOA must be done on or before the deadline.", H("p. 52"), OFFICIAL),
        R("LOA-05", "A student who does not intend to enroll for a valid reason (medical reasons) but still has remaining units to enroll is not allowed to enroll in Residency but should file for a Leave of Absence.", H("p. 48"), OFFICIAL),
        R("LOA-06", "A student may file an LOA if the student withdraws after two weeks of classes have elapsed; the student is subject to a withdrawal fee from the Cashier's office.", H("p. 53"), OFFICIAL),
        R("LOA-07", "The Dean, Associate Dean, or the duly authorized representative informs the University Registrar of the leave, indicating the reasons and the amount of money refunded to the student, if any.", H("p. 53"), OFFICIAL),
        R("LOA-08", "For a leave availed of by the student during the second half of the semester, the class standing of the courses enrolled is W (withdrawn); no refund of tuition and fees is provided.", H("p. 53"), OFFICIAL),
        R("LOA-09", "No leave of absence is granted during the semester within two (2) weeks before the last day of classes.", H("p. 53"), OFFICIAL),
        R("LOA-10", "A master's program must be finished within seven academic years and a doctoral program within nine academic years, including the leave of absence.", H("p. 55"), OFFICIAL),
        R("LOA-11", "A student who withdraws from the college without a formal leave of absence is considered absent without leave (AWOL) and has registration privileges curtailed or entirely withdrawn.", H("p. 53"), OFFICIAL),
        R("LOA-12", "The student may file the leave through a structured form in place of a letter, provided the Dean accepts the form as the written request.", N("Consultation 20 July 2026 rehearsal (structured form suggested by the adviser)"), PROPOSED),
        R("LOA-13", "The platform checks a leave request for an approved reason category, a valid start and end term, the student's earlier approved leaves and a future start term, and gives the Dean a recommendation; the Dean decides.", N("Platform (current build): LOA policy review"), PROPOSED),
    ],
    exceptions=[
        "A leave in the second half of the semester: class standing is W and no refund is given (LOA-08). A leave requested within two weeks before the last day of classes is not granted (LOA-09).",
        "The leave ends and the student does not return: the student is treated as absent without leave (see 4.8) unless a further renewal within the two-year limit has been approved (LOA-03).",
        "The student wants to withdraw a pending leave request before the decision: the sources do not say whether this is allowed. The platform does not allow it at present (the adviser said it should; Consultation 20 July 2026) (OQ-12).",
        "A student who stopped attending without filing a leave: see 4.8, absent without leave.",
    ],
    records=[
        ("Written leave request and Dean's decision", "Dean's office; GS staff record"),
        ("Notice of leave with reasons and refund to the Registrar", "University Registrar"),
        ("Student status On Leave with effective dates", "Graduate School record"),
    ],
    platform="The student files a structured leave request (reason category, start and end term, reason, document). GS staff check the limits and forward the request to the Dean; the Dean's decision sets the status to On Leave and GS staff send the notice. The platform has a report of leaves and of prior approved leaves.",
    platform_diff="The platform allows a leave of one or two consecutive semesters, requires fewer than four earlier approved leaves, requires a future start term, and describes the residency clock as paused. The Handbook allows one year renewable for at most another year, does not limit the number of leaves, allows a leave in the second half of a semester (with W and no refund) but not in the last two weeks, and counts leave inside the maximum residence. These are open questions OQ-09 to OQ-11; the Handbook is in force.",
)

READMISSION = Process(
    num="4.7", key="RDM",
    title="Return from leave of absence and readmission",
    purpose="To state how a student who was on leave of absence, or who was absent without leave, returns to the program.",
    who=["Student", "GS staff", "Graduate School Dean", "University Registrar (external)", "Business Office (external)"],
    trigger="The approved leave period ends, or an absent student wants to resume.",
    preconditions=["The student is within the maximum residence limit (see 4.9), or accepts the extension conditions.", "The student has not failed a subject (failure means no re-admission to the program; DRP-06)."],
    steps=[
        ("Student", "Declares the intention to enroll by writing to the University Registrar through the Graduate School Dean.", "Written return intention", "Before the semester of return (date not stated)"),
        ("GS staff", "Records the request, checks the target return term and the previous leave period, and forwards it to the Dean.", "Readmission request record", NS),
        ("Student", "Obtains a clearance from the Business Office and attends the interview (reason for the delay, residency requirements).", "Business Office clearance; interview", NS),
        ("Academic Coordinator / Dean", "Evaluates the subject and grade requirements; the Dean issues the Advise Slip.", "Advise Slip from the Dean", NS),
        ("Dean", "Approves or denies the readmission and endorses the student's written intent to the University Registrar.", "Dean's decision; endorsement to the Registrar", NS),
        ("GS staff", "Records the student as Active for the return term and notifies the student.", "Student status: Active", "After the Dean's decision"),
    ],
    rules=[
        R("RDM-01", "A student returning from a leave of absence (LOA) or absence without leave (AWOL) declares his or her intention to enroll by writing to the University Registrar through the Graduate School Dean, who then endorses it to the University Registrar.", H("p. 53"), OFFICIAL),
        R("RDM-02", "A returnee must present: (1) clearance from the Business Office, (2) an interview (reason for delay, residency requirements), (3) evaluation of subject and grade requirements, (4) an Advise Slip from the Dean.", H("p. 45"), OFFICIAL),
        R("RDM-03", "Failure in any subject means no re-admission to the program.", H("p. 54"), OFFICIAL),
        R("RDM-04", "A student who cannot finish within the maximum residence (seven years for a master's, nine for a doctorate) must re-enroll all courses taken and earn new credits.", H("p. 55"), OFFICIAL),
        R("RDM-05", "The platform's readmission checklist asks for a structured return intention, a confirmed updated study plan, a program or adviser consultation, and confirmation that no accountability is pending. The Handbook's four requirements (RDM-02) are the official list.", N("Platform (current build): readmission requirements"), PROPOSED),
    ],
    exceptions=[
        "The return term is outside the maximum residence: the student is classified as within the limit, in the extension (two more years with a graded six-unit refresher course), or needing full re-enrollment (see 4.9).",
        "The student was absent without leave: the same written declaration is used (RDM-01).",
        "The student was dropped for failing a subject: no re-admission (RDM-03).",
    ],
    records=[
        ("Written return intention and the Dean's endorsement", "Dean's office; University Registrar"),
        ("Business Office clearance; interview notes; Advise Slip", "Graduate School record"),
        ("Student status: Active from the return term", "Graduate School record"),
    ],
    platform="The student files a structured readmission request with the target return term and the previous leave period; GS staff check the requirements and forward it to the Dean; the decision sets the status to Active.",
    platform_diff="The platform's four-item checklist differs from the Handbook's four requirements (RDM-02). The platform does not record the interview, the Business Office clearance or the Advise Slip (OQ-13).",
)

AWOL = Process(
    num="4.8", key="AWL",
    title="Absence without leave (AWOL)",
    purpose="To state what happens to a student who stops enrolling without a formal leave of absence.",
    who=["Student", "GS staff", "Graduate School Dean", "University Registrar (external)"],
    trigger="A student withdraws from the University, or stops enrolling, without a formal leave of absence.",
    preconditions=["No approved leave of absence covers the period."],
    steps=[
        ("GS staff", "Notices that the student has no approved leave and no enrollment for a semester, and marks the student as absent without leave after checking the official record.", "AWOL status (source evidence)", NS),
        ("Registrar", "Curtails or withdraws the student's registration privileges.", "Registration privileges", NS),
        ("Student", "Returns by declaring the intention to enroll in writing through the Graduate School Dean (see 4.7).", "Written return intention", NS),
        ("Dean", "Endorses the written intent to the University Registrar; the maximum residence classification of the student decides the conditions of return.", "Endorsement; classification", NS),
    ],
    rules=[
        R("AWL-01", "A student who withdraws from a college without a formal leave of absence is considered in \"absent without leave\" status (AWOL) and has registration privileges curtailed or entirely withdrawn.", H("p. 53"), OFFICIAL),
        R("AWL-02", "A student returning from AWOL declares the intention to enroll by writing to the University Registrar through the Graduate School Dean, who endorses it to the Registrar.", H("p. 53"), OFFICIAL),
        R("AWL-03", "A returnee presents a Business Office clearance, an interview, an evaluation of subject and grade requirements and an Advise Slip from the Dean.", H("p. 45"), OFFICIAL),
        R("AWL-04", "An AWOL status has the same effect as a leave of absence for reporting: it is communicated to the Registrar.", C("20 July 2026", "adviser's statement; not confirmed by Graduate School staff"), PROPOSED),
        R("AWL-05", "AWOL is flagged from source evidence (an imported AWOL standing, or a full semester without enrollment and without an approved leave), not typed in by a user.", N("Platform (current build): AWOL policy review"), PROPOSED),
        R("AWL-06", "On return, the student is classified by years in the program: within the normal limit (five years master's, seven years doctorate), extension with a graded six-unit refresher (up to seven and nine), or full re-enrollment beyond that.", [H("pp. 54-55")], PROPOSED),
    ],
    exceptions=[
        "It is not clear whether the period of AWOL counts toward maximum residence; the Handbook counts LOA (LOA-10) but is silent about AWOL (OQ-14).",
        "A student with an approved leave is never AWOL; a student whose leave lapsed without return may become AWOL (Proposed).",
    ],
    records=[
        ("AWOL status and its source evidence", "Graduate School record"),
        ("Written return intention and endorsement", "Dean's office; University Registrar"),
    ],
    platform="The platform flags a student as AWOL from source evidence and cannot be told by a user to declare AWOL. When the student returns it shows the classification by years in the program and requires the Dean's endorsement of the written intent.",
    platform_diff="The Handbook does not say how the Graduate School learns of an AWOL or who declares it (OQ-14). The platform's classification (AWL-06) applies the maximum-residence figures; the calculation counts years from the student's year of entry and is approximate.",
)

RESIDENCY = Process(
    num="4.9", key="RES",
    title="Residency enrollment and maximum residence",
    purpose="To state when a student with no subjects must still enroll (residency) and the longest time a student may take to finish a program.",
    who=["Student", "Academic Coordinator", "GS staff", "Graduate School Dean"],
    trigger="A student has finished all coursework and is working on the thesis, dissertation or practicum; or is not enrolled in any subject but is completing an INC, taking the comprehensive examination, or waiting for a research publication.",
    preconditions=["The student has finished all coursework (except for completing an INC or taking the comprehensive examination)."],
    steps=[
        ("Academic Coordinator", "For the comprehensive examination, makes the initial evaluation of the student's courses and advises the student to enroll in Residency in Comprehensive Examination.", "Initial evaluation", NS),
        ("Student", "Registers for residence within the semester, for the purpose that applies (thesis or dissertation writing, practicum or internship, completing an INC, comprehensive examination, waiting for publication).", "Residency enrollment", "Within the semester"),
        ("GS staff", "Records the residency enrollment with its purpose and checks that the student is not simply skipping a semester (a student who does not intend to enroll should file a leave of absence).", "Residency record", NS),
        ("GS staff", "Watches the student's years in the program against the maximum residence.", "Residency watchlist", NS),
    ],
    rules=[
        R("RES-01", "Students who have finished all their coursework and are just working on their thesis or dissertation and practicum or internship, after a semester of enrollment for thesis writing and practicum, may enroll for residence.", H("p. 48"), OFFICIAL),
        R("RES-02", "Students who are not enrolled in any subject but who want to complete an INC, will take the comprehensive exam, or are waiting for their research publication must also enroll for residence. Registration for residence should be done within the semester.", H("p. 48"), OFFICIAL),
        R("RES-03", "A student who does not intend to enroll for a valid reason but still has remaining units is not allowed to enroll in Residency, but files a leave of absence.", H("p. 48"), OFFICIAL),
        R("RES-04", "For the comprehensive examination the Academic Coordinator does the initial evaluation and the student is advised to enroll in Residency in Comprehensive Examination.", H("p. 56"), OFFICIAL),
        R("RES-05", "Master's program: candidacy must be attained within three academic years from the date of admission and all requirements completed within five academic years.", H("p. 54"), OFFICIAL),
        R("RES-06", "Master's program: a student who cannot comply within five years is allowed a maximum two-year extension but must enroll in a graded six-unit refresher course related to the area of specialization.", H("p. 54"), OFFICIAL),
        R("RES-07", "A master's program must be finished within a maximum of seven academic years including leave of absence; a student who cannot finish within seven years must re-enroll all the courses taken and earn new credits.", H("p. 55"), OFFICIAL),
        R("RES-08", "Doctorate program: candidacy within five academic years from admission; all requirements including the dissertation within seven academic years.", H("p. 55"), OFFICIAL),
        R("RES-09", "Doctorate program: beyond seven years a maximum two-year extension with a graded six-unit refresher course; the program must be finished within nine academic years including leave of absence, after which the student must re-enroll all courses taken and earn credit units.", H("p. 55"), OFFICIAL),
        R("RES-10", "Thesis or project paper writing must be finished within two years from the title or proposal defense; dissertation writing within three years from the title defense.", H("p. 58"), OFFICIAL),
        R("RES-11", "The platform records each residency enrollment with its purpose (thesis or dissertation work, practicum or internship, comprehensive examination, awaiting publication) and marks a purpose as unsupported if the student's record does not match it.", N("Platform (current build): residency policy review"), PROPOSED),
    ],
    exceptions=[
        "A student past five (master's) or seven (doctorate) years: extension with a graded six-unit refresher course is possible up to seven or nine years (RES-06, RES-09).",
        "A student past seven (master's) or nine (doctorate) years: all courses must be re-enrolled (RES-07, RES-09).",
        "A student with units remaining who will not enroll: a leave of absence, not residency (RES-03).",
        "The Handbook does not state a fee for residency enrollment or a limit on the number of residency semesters (OQ-15).",
    ],
    records=[
        ("Residency enrollment and its purpose", "Graduate School record; AIMS"),
        ("Years in program and residence classification", "Graduate School record (residency watchlist)"),
    ],
    platform="The platform records residency enrollment with a purpose, checks the purpose against the student's record, classifies a student by years in the program, and lists students near the limit on a watchlist.",
    platform_diff="The platform treats the residency clock as paused during a leave of absence, which the Handbook does not allow because maximum residence includes leave (OQ-10). Its year count uses the calendar year of entry and is approximate (OQ-16).",
)

COMPRE = Process(
    num="4.10", key="CEX",
    title="Comprehensive examination",
    purpose="To state who may take the comprehensive examination, how to apply, how it is scored, and what happens after a failure.",
    who=["Student", "Academic Coordinator (master's) or College Dean (doctorate)", "Graduate Program Secretary", "Business Office (external)", "Graduate School Dean"],
    trigger="A student has passed all academic requirements and has been evaluated by the Academic Coordinator (master's) or the Dean (doctorate).",
    preconditions=["Master's: all academic requirements passed and evaluation by the Graduate School Academic Coordinator.", "Non-thesis track: the integrating courses (feasibility study, project study, case study, applied research, or action research or practicum) are completed.", "Doctorate: evaluation by the College Dean."],
    steps=[
        ("Academic Coordinator", "Makes an initial evaluation of the student's academic courses and advises the student to enroll in Residency in Comprehensive Examination.", "Initial evaluation", NS),
        ("Student", "Files the application with the Graduate Program Secretary.", "Application for the comprehensive examination", "At least two weeks before the scheduled examination"),
        ("Student", "Pays the examination fee at the Business Office and presents the official receipt to the secretary before taking the exam.", "Official receipt", "Before the exam"),
        ("Student (if withdrawing)", "Informs the Graduate Program in writing, with the reason.", "Written withdrawal of application", "At least three working days before the examination"),
        ("Student", "Takes the examination: two days for a master's, three for a doctorate, not more than eight hours per day.", "Examination", "As scheduled"),
        ("Graduate School", "Scores the examination; a retake applies to failed courses.", "Score per course", NS),
        ("Student / Dean", "After passing, confers with the Dean for a thesis or dissertation adviser; the student is considered advanced to candidacy.", "Advancement to candidacy", NS),
    ],
    rules=[
        R("CEX-01", "The comprehensive examinations cover all basic or core courses, fields of concentration, and electives or cognates. They are given for two days for a master's and three days for a doctorate, with two-day intervals between examinations or consecutively as arranged, and last a maximum of eight hours per day.", H("p. 56"), OFFICIAL),
        R("CEX-02", "Master's scope: first day basic courses and electives or cognates; second day major courses. Doctorate scope: first day basic courses and electives or cognates; second and third days major courses.", H("p. 56"), OFFICIAL),
        R("CEX-03", "Master's students who have passed all academic requirements and been evaluated by their Graduate School Academic Coordinators may file an application; doctorate students evaluated by their College Deans may likewise file.", H("p. 56"), OFFICIAL),
        R("CEX-04", "Non-thesis students must have completed the integrating courses (feasibility study, project study, case study or applied research in the major field for MBA; action research or practicum in the major field for Education).", H("p. 56"), OFFICIAL),
        R("CEX-05", "The application is filed with the Graduate Program Secretary at least two weeks before the scheduled examination; an examinee who withdraws the application informs the Graduate Program in writing with the reason at least three working days before the examination.", H("pp. 56-57"), OFFICIAL),
        R("CEX-06", "The examination fee is P1,100 for a master's and P2,500 for a doctorate, paid to the Business Office; the official receipt attached to the application is presented to the secretary before the exam.", H("p. 57"), OFFICIAL),
        R("CEX-07", "The fee is forfeited if the examinee fails to appear during the examination dates or fails to inform the Graduate Program Services Office by a written note.", H("p. 57"), OFFICIAL),
        R("CEX-08", "A student must get a minimum score of 7.00 points (70%) in all courses to pass. A student below 7.00 may take a first retake in the failed courses within the residency enrollment and is allowed two retakes within the semester.", H("p. 57"), OFFICIAL),
        R("CEX-09", "A student who fails the second retake takes a refresher course on the failed courses the following semester and may take the examination for the third and last time in the following residency enrollment; failure the fourth time means disqualification from the program.", H("p. 57"), OFFICIAL),
        R("CEX-10", "A student who passes the comprehensive examination confers with the Dean for a thesis or dissertation adviser and is considered advanced to candidacy.", H("p. 57"), OFFICIAL),
        R("CEX-11", "Passing the comprehensive examination is a graduation requirement; for special academic honors the examination must be passed with no retake.", H("pp. 55, 77"), OFFICIAL),
        R("CEX-12", "The monitoring workbook records the comprehensive examination in its own column.", N("Monitoring workbook, COMPRE column"), PRACTICE),
        R("CEX-13", "The platform accepts a title defense application only after the comprehensive examination is passed and all curriculum subjects are complete.", N("Platform (current build): comprehensive exam eligibility"), PROPOSED),
    ],
    exceptions=[
        "The Handbook's sentence on a student who fails to take the examination on the scheduled dates is cut off in the copy supplied (Handbook 2022-2023, p. 57); the consequence is an open question (OQ-18).",
        "A student who fails a retake takes a refresher course the next semester (CEX-09).",
        "A master's student is evaluated by the Academic Coordinator but a doctorate student by the College Dean; the office may prefer the Graduate School Dean (OQ-18).",
    ],
    records=[
        ("Application, official receipt and score per course", "Graduate Program Secretary; Academic Coordinator"),
        ("Comprehensive examination result", "Monitoring workbook (COMPRE column)"),
    ],
    platform="The platform checks that all curriculum subjects are complete before it allows the student to be marked eligible, and keeps the examination status (not taken, passed) in the student record.",
    platform_diff="The platform blocks all research steps until the examination is passed (CEX-13). The Handbook says the student confers with the Dean for an adviser after passing, but also that an adviser may be assigned while the student is still taking courses (see ADV-08); the sequence relative to the title defense is an open question (OQ-17).",
)
