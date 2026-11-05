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
        ("GS staff", "Records the request and checks that the period and the total of the student's approved leave are within the limits. Forwards it to the Dean.", "LOA request record", NS),
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
        R("LOA-13", "The platform checks a leave request for an allowed reason category, a written reason, a valid start and end semester (at most two semesters per request and four in total with earlier approved leave), the filing date (not within fourteen days before the last day of classes) and the prototype minimum of one completed semester, and gives the Dean a recommendation; the Dean decides.", N("Platform (current build): LOA policy review"), PROPOSED),
    ],
    exceptions=[
        "A leave in the second half of the semester: class standing is W and no refund is given (LOA-08). A leave requested within two weeks before the last day of classes is not granted (LOA-09).",
        "The leave ends and the student does not return: the student is treated as absent without leave (see 4.8) unless a further renewal within the two-year limit has been approved (LOA-03).",
        "The student wants to withdraw a pending leave request before the decision: the sources do not say whether this is allowed. The platform allows it while the request is Submitted or in Dean Review, as the adviser suggested (Consultation 20 July 2026); the student may then file a new request (OQ-12).",
        "A student who stopped attending without filing a leave: see 4.8, absent without leave.",
    ],
    records=[
        ("Written leave request and Dean's decision", "Dean's office; GS staff record"),
        ("Notice of leave with reasons and refund to the Registrar", "University Registrar"),
        ("Student status On Leave with effective dates", "Graduate School record"),
    ],
    platform="The student files a structured leave request in the portal: a reason category, the reason, and the start and end semester. There is no letter or document to upload. The platform blocks the submission when the request covers more than the register allows for one request (2 semesters, loa.max_period_semesters), when the semesters already approved plus the request would pass 4 semesters in total (loa.max_total_semesters, renewals included), when the start semester is already over or is running with 14 days or fewer before its last day of classes (loa.no_filing_days_before_term_end), or when another leave request is already in progress. A request filed in the second half of a running semester is accepted with a note that the enrolled courses become W and no refund is given; the platform only shows that note, it does not mark the courses W or work out a refund. The number of earlier leaves is not limited, only the semesters. The platform also estimates whether the student has completed the prototype minimum of one semester; a shortfall is shown to the Dean as Needs Review and blocks nothing. Until the Dean decides, the student can withdraw a pending request (Submitted or Dean Review) and file a new one. GS staff review the same checks and forward the request to the Dean, who approves, denies or returns it for revision. Approval sets the status On Leave, which also stops the student being enrolled in subjects, and staff can download a provisional notice for the Registrar (period and reason category; no refund amount). The residency clock keeps running during the leave.",
    platform_diff="The platform now follows the Handbook on the points where the earlier build had differed: a leave of up to one year (two semesters) per request, renewable up to four semesters in total, no limit on the number of leaves, a leave allowed in the second half of a semester (with W and no refund shown) but not within the last two weeks, and time on leave counted inside the maximum residence (the residency clock is never paused). Differences remain. The Handbook's filing deadline is not stated (LOA-04), so the platform applies only the two date checks above. The withdrawal fee after two weeks (LOA-06), the refund amount in the notice to the Registrar (LOA-07) and the marking of courses W (LOA-08) are not computed. A semester is counted by its position in the list of semesters set up in the platform, so a year of leave is two semesters, not three terms (OQ-09). The Dean's approval sets On Leave at once, not from the start semester, and does not run the limit checks again. The student form lists only future semesters, although the platform's check would also accept a semester that is running (OQ-11). These points are open questions OQ-09 to OQ-12; the Handbook is in force.",
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
    platform="The student files a structured return request in the portal: a return semester that starts after today, the start and end of the previous leave, a written return intention, and four ticked confirmations (a structured return intention, an updated study plan, a consultation with the program or the adviser, and no pending accountability). The ticks are the student's own statement; nothing is uploaded or verified. GS staff review the request and forward it to the Dean. The review marks Needs Review when the student is not on leave, but does not block the request. The Dean approves, denies or returns it for revision. Approval sets the status Active, tags the student Not Enrolled for the return term and opens a task for the Academic Coordinator on the study plan and enrollment; a denial leaves the record as it was. Staff can download a provisional file for the Registrar with the return semester and the previous leave period.",
    platform_diff="The platform's four-item checklist differs from the Handbook's four requirements (RDM-02). The platform does not record the interview, the Business Office clearance or the Advise Slip (OQ-13), and it does not check failed subjects (RDM-03) or the maximum residence for a return from leave (RDM-04); these are left to people. The classification by years in the program is applied only to a return from AWOL (see 4.8), not to a return from leave. The portal does not require that the student is on leave before the request is filed; staff see a flag when the student is not.",
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
        R("AWL-05", "AWOL is flagged from source evidence (an imported AWOL standing, or a semester enrollment marked Withdrawn with no approved leave and no resolved return), not typed in by a user and not inferred from absence alone.", N("Platform (current build): AWOL policy review"), PROPOSED),
        R("AWL-06", "On return, the student is classified by years in the program: within the normal limit (five years master's, seven years doctorate), extension with a graded six-unit refresher (up to seven and nine), or full re-enrollment beyond that.", [H("pp. 54-55")], PROPOSED),
    ],
    exceptions=[
        "It is not clear whether the period of AWOL counts toward maximum residence; the Handbook counts LOA (LOA-10) but is silent about AWOL (OQ-14).",
        "A student with an approved leave is never AWOL; a student whose leave lapsed without return may become AWOL (Proposed; the platform does not do this automatically).",
    ],
    records=[
        ("AWOL status and its source evidence", "Graduate School record"),
        ("Written return intention and endorsement", "Dean's office; University Registrar"),
    ],
    platform="The platform flags a student as AWOL from evidence only and refuses an attempt by a user to declare AWOL. The evidence is an imported AWOL standing or tag, or a latest semester enrollment marked Withdrawn when the student has no leave of absence and no resolved return case; absence alone is not taken as evidence. When a student is flagged the platform sets the status, raises a monitoring alert, opens a task for the Academic Coordinator and stops the student being enrolled in subjects. To return, the student files a structured declaration (a future return semester, the last semester enrolled, a written intent and a reason); staff forward it and the Dean decides. The outcome depends on the student's years in the program measured against the register: within the normal limit (5 years for a master's, 7 for a doctorate) the return is approved and the student becomes Active; within the extension (up to 7 and 9 years) the return is approved with a graded six-unit refresher required and a task is opened; beyond that the student stays AWOL and a task for a re-enrollment evaluation is opened. After the Dean approves, staff can download a provisional file for the Registrar.",
    platform_diff="The Handbook does not say how the Graduate School learns of an AWOL or who declares it (OQ-14); the platform's rule is the evidence above. A leave that lapsed without a return is not turned into AWOL automatically. The AWOL period counts toward the maximum residence, because the residency clock is never paused. The Business Office clearance, the interview and the Advise Slip (AWL-03) are not recorded. Years are counted in academic years from the student's entry academic year, which is approximate (see 4.9).",
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
        R("RES-11", "The platform records each residency enrollment with its purpose (thesis or dissertation work, practicum or internship, comprehensive examination, awaiting publication) and marks a purpose as unsupported if the student's record does not match it; staff may still record it with notes that explain the exception.", N("Platform (current build): residency policy review"), PROPOSED),
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
    platform="GS staff or an Academic Coordinator record a residency enrollment with its purpose (thesis or dissertation work, practicum or internship, comprehensive examination, awaiting publication); it is not started by the student. The platform reviews the record. The student must have no subject currently enrolled; the purpose must fit the student's record (the comprehensive examination needs the Comprehensive Exam stage, publication needs the writing, final defense or completed stage, thesis or practicum work needs no missing subjects); and the record must not be a substitute for a leave. A record that fails the review can be saved only with staff notes that explain the exception. A student who is AWOL, on leave, withdrawn or completed is blocked. A student can have one active residency enrollment per semester, and the number of residency semesters is not limited. The platform counts years in the program in academic years (the entry academic year is year 1 and the count steps up each June) and never reduces the count for a leave. It classifies each student against the register (master's: 5 normal and 7 absolute years; doctorate: 7 and 9; an extension of 2 years with a graded 6-unit refresher) and lists students on a watchlist as Within, Approaching or Exceeded.",
    platform_diff="The platform no longer pauses the residency clock during a leave of absence: it follows the Handbook, where maximum residence includes leave (RES-07, RES-09; register value residency.includes_loa). The year count starts from the entry academic year and not from the date of admission, so it can differ from the Handbook's count by up to a year (OQ-16). With the Handbook's two-year extension, the year after the normal period is already within one year of the absolute limit, so the watchlist shows Approaching and a separate state for a student past the normal period does not appear. The purpose of completing an INC (RES-02) is not among the platform's purposes. The platform creates a task for the refresher course when the Dean approves an extension but does not track the course or approve the extension (RES-06), and it does not track candidacy dates (RES-05, RES-08) or the research writing limits (RES-10); the register shows these as documented only. The fee and the number of residency semesters are open (OQ-15).",
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
        R("CEX-13", "The platform keeps all research stages from the title defense onward locked until the comprehensive examination status is Passed and all curriculum subjects are complete; the Graduate School can switch the examination requirement off in the register.", N("Platform (current build): comprehensive exam eligibility"), PROPOSED),
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
    platform="The platform works out whether a student is eligible for the comprehensive examination and does not let a user mark it. For the MBA and the Doctor of Psychology curricula, which it holds in full, eligibility is judged by the units completed in each category; for other programs every curriculum subject must be complete. In both cases no subject may be failed. The result of the examination (Not Taken or Passed) is not entered in the portal; it reaches the student's record only from the COMPRE column of the monitoring workbook. The platform does not record the application, the fee, the score per course, retakes or the refresher course. Until the status is Passed and the curriculum is complete, all research stages from the title defense onward are locked (register rule research.comprehensive_exam_before_research). The Graduate School can switch that rule off in the register, in which case research opens when the student is eligible.",
    platform_diff="The platform blocks the research steps until the examination is passed (CEX-13), which the Research Protocol does not state and the Handbook states only as the step before the student confers with the Dean for an adviser (p. 57). The Handbook also says an adviser may be assigned while the student is still taking courses (ADV-08); the sequence relative to the title defense is an open question (OQ-17). The evaluation by the Academic Coordinator or College Dean (CEX-03), the application, fee, scoring and retakes (CEX-05 to CEX-09) and the honors condition (CEX-11) are not modelled and are left to people.",
)
