"""Seed data for the business-rules register (see ``BusinessRule`` in app.py).

Every rule the workflows enforce, or that a policy document states but the system
deliberately leaves to people, is listed here once with its plain-language text,
its value and where it comes from. ``ensure_business_rules()`` copies missing
entries into the database; after that the database row is the source of truth
and a Graduate School user can change the value from the Business Rules page.

Sources
-------
* HANDBOOK  - Graduate School Handbook 2022-2023 (confirmed in force by the owner).
  Page numbers are the printed page numbers at the top or bottom of each page.
* PROTOCOL  - Graduate School Research Protocol AY 2024-2025 (a Word file with
  no page numbers, so the section heading is cited instead).
* PROTOTYPE - a value the prototype needs but that neither document states.
  These rows are seeded with status ``needs_review`` until the Graduate School
  confirms them.
"""

from __future__ import annotations

HANDBOOK = "Graduate School Handbook 2022-2023"
PROTOCOL = "Graduate School Research Protocol AY 2024-2025"
PROTOTYPE = "Prototype rule — pending Graduate School validation"

GRADES_OUT_OF_SCOPE = "Grades are outside the system's scope (stakeholder decision)."

# (key, label) - the order here is the order the Business Rules page shows.
BUSINESS_RULE_PROCESSES = [
    ("enrollment", "Enrollment and academic load"),
    ("course_adjustment", "Course adjustments (add or change a subject)"),
    ("withdrawal", "Subject withdrawal"),
    ("dropping", "Dropping a subject and retention"),
    ("loa", "Leave of absence"),
    ("readmission", "Readmission"),
    ("awol_residency", "AWOL, residency and maximum residence"),
    ("research", "Research requirements"),
    ("defense", "Defense scheduling and panels"),
    ("practicum", "Practicum"),
    ("graduation", "Graduation"),
    ("faculty", "Faculty"),
]


def _rule(
    key,
    process,
    title,
    description,
    value,
    value_type,
    unit,
    source_title,
    source_section=None,
    source_page=None,
    *,
    enforced=True,
    reason=None,
    document="handbook",
):
    prototype = source_title == PROTOTYPE
    return {
        "key": key,
        "process": process,
        "title": title,
        "description": description,
        "value": str(value).lower() if value_type == "bool" else str(value),
        "value_type": value_type,
        "unit": unit,
        "source_title": source_title,
        "source_section": source_section,
        "source_page": source_page,
        "enforced": bool(enforced),
        "not_enforced_reason": None if enforced else (reason or GRADES_OUT_OF_SCOPE),
        "status": "needs_review" if prototype else "active",
        # Which uploaded policy document this rule should be linked to, when one
        # with a matching file name exists ("handbook", "protocol" or None).
        "document": None if prototype else document,
    }


BUSINESS_RULE_CATALOG = [
    # ---- Enrollment and academic load ------------------------------------
    _rule(
        "enrollment.part_time_min_units", "enrollment",
        "Normal part-time load: lower bound",
        "The normal load of a part-time graduate student starts at 6 units per semester. "
        "The portal shows the load on the enrollment preview; a lighter load is allowed for "
        "residency, thesis or final-term students, so it is information rather than a block.",
        6, "int", "units", HANDBOOK, "Registration - Academic Load", "48",
        enforced=False,
        reason="The handbook calls this the normal load, not a hard limit; the portal shows it as information only.",
    ),
    _rule(
        "enrollment.part_time_max_units", "enrollment",
        "Normal part-time load: upper bound",
        "The normal load of a part-time graduate student is at most 9 units per semester. "
        "Above 9 units the student is carrying a full-time load.",
        9, "int", "units", HANDBOOK, "Registration - Academic Load", "48",
        enforced=False,
        reason="The handbook calls this the normal load, not a hard limit; the portal shows it as information only.",
    ),
    _rule(
        "enrollment.full_time_units", "enrollment",
        "Full-time load",
        "The normal load of a full-time graduate student is 12 units per semester. Enrolling "
        "more than this in one semester is flagged on the enrollment preview and needs a "
        "documented exception before it can be saved.",
        12, "int", "units", HANDBOOK, "Registration - Academic Load", "48",
    ),
    _rule(
        "enrollment.residency_only_after_coursework", "enrollment",
        "Residency enrollment is only for research, practicum, comprehensive exam or publication",
        "A student with no subjects to take may enroll for residence only to work on the "
        "thesis/dissertation, the practicum/internship, to complete an INC, to take the "
        "comprehensive exam or to wait for a publication. A student who simply will not "
        "enroll for a semester but still has units to take files a Leave of Absence instead.",
        True, "bool", None, HANDBOOK, "Registration - Residency Enrollment", "48",
    ),
    _rule(
        "enrollment.inc_completion_years", "enrollment",
        "Removal of an INC grade",
        "An incomplete grade must be removed within one academic year, otherwise it becomes 3.0 "
        "(master's) or 2.0 (doctorate) and the subject must be taken again. A student with an "
        "INC in every subject is dropped from the rolls.",
        1, "int", "years", HANDBOOK, "Academic Performance - Incomplete Grades", "54",
        enforced=False,
    ),
    # ---- Course adjustments ------------------------------------------------
    _rule(
        "course_adjustment.add_subject_window_days", "course_adjustment",
        "Adding a subject: first week of classes only",
        "Adding subjects is allowed during the first week of classes (7 calendar days from the "
        "start of classes) with the written approval of the Associate Dean. After that, an "
        "addition is flagged on the enrollment preview and can only be saved with a documented "
        "exception (the Associate Dean's written approval).",
        7, "int", "days", HANDBOOK, "Registration - Adding of Subject/s", "49",
    ),
    _rule(
        "course_adjustment.change_subject_window_days", "course_adjustment",
        "Changing one subject for another: first week of classes only",
        "Changing one subject for another is allowed during the first week of classes (7 calendar "
        "days from the start of classes) only if the original subject was dissolved, the student "
        "has a schedule conflict, or the student failed the prerequisite subject.",
        7, "int", "days", HANDBOOK, "Registration - Change of Subject", "48-49",
    ),
    _rule(
        "course_adjustment.change_conditions", "course_adjustment",
        "Conditions for a change of subject",
        "The reason for a change must be one of: the original subject is dissolved, a conflict "
        "in schedules, or failure in the prerequisite subject. Staff confirm the reason; the "
        "system records the exception but cannot see the schedule or the grade.",
        "Subject dissolved; schedule conflict; failed prerequisite", "text", None,
        HANDBOOK, "Registration - Change of Subject", "49",
        enforced=False,
        reason="The reason is confirmed by staff and the Associate Dean; schedules and grades are outside the portal.",
    ),
    # ---- Withdrawal --------------------------------------------------------
    _rule(
        "withdrawal.window_days", "withdrawal",
        "Subject withdrawal window",
        "A student may withdraw subjects until the end of the second week from the start of "
        "classes (14 calendar days), whether or not classes were attended. The request needs "
        "the Dean's approval. It is not free: the fee consequence below applies. After the "
        "window a single subject can no longer be withdrawn; the student may still withdraw "
        "from all subjects (paying the full fees for the semester) or file a Leave of Absence.",
        14, "int", "days", HANDBOOK, "Registration - Withdrawal of Subject", "49",
    ),
    _rule(
        "withdrawal.first_week_days", "withdrawal",
        "First week of classes (fee tier boundary)",
        "Withdrawals filed within the first 7 calendar days of classes fall in the first-week "
        "fee tier; days 8 to 14 fall in the second-week tier.",
        7, "int", "days", HANDBOOK, "Fees and Expenses - Refund of Fees", "50-51",
    ),
    _rule(
        "withdrawal.fee_percent_first_week", "withdrawal",
        "Fee charged for a first-week withdrawal",
        "10% of the total amount due for the term is charged when the subject is withdrawn "
        "within the first week of classes, regardless of whether classes were attended.",
        10, "int", "percent", HANDBOOK, "Registration - Withdrawal of Subject; Fees - Refund of Fees", "49, 51",
        enforced=False,
        reason="The portal shows the fee consequence as information; it does not compute or collect payments (Business Office).",
    ),
    _rule(
        "withdrawal.fee_percent_second_week", "withdrawal",
        "Fee charged for a second-week withdrawal",
        "20% of the total amount due for the term is charged when the subject is withdrawn "
        "within the second week of classes.",
        20, "int", "percent", HANDBOOK, "Registration - Withdrawal of Subject; Fees - Refund of Fees", "49, 51",
        enforced=False,
        reason="The portal shows the fee consequence as information; it does not compute or collect payments (Business Office).",
    ),
    _rule(
        "withdrawal.fee_percent_after_window", "withdrawal",
        "Fee charged after the second week",
        "After the second week the student may still withdraw all subjects at any time of the "
        "semester but pays the full enrollment fees for the semester (a justifiable reason "
        "limits the charge to the last month of attendance).",
        100, "int", "percent", HANDBOOK, "Fees and Expenses - Refund of Fees", "51",
        enforced=False,
        reason="The portal shows the fee consequence as information; it does not compute or collect payments (Business Office).",
    ),
    # ---- Dropping and retention -------------------------------------------
    _rule(
        "dropping.absence_limit_percent", "dropping",
        "A subject is dropped only when unexcused absences exceed 20%",
        "A student is expected to attend regularly; the maximum absences allowed is 20% of the "
        "class hours for the semester. When unexcused absences in one subject go beyond 20%, "
        "the professor automatically drops the student from that subject (grade DRP, 5.0). "
        "The Academic Coordinator can only record a Dropped status when the unexcused-absence "
        "percentage entered is above this limit; a student who wants to leave a subject earlier "
        "files a Subject Withdrawal instead (see the withdrawal window).",
        20, "int", "percent", HANDBOOK, "Attendance - Limits on Absences", "52",
    ),
    _rule(
        "dropping.drp_grade", "dropping",
        "Grade given to a subject dropped for absences",
        "A subject dropped for absences carries the grade DRP with a value of 5.0.",
        "DRP (5.0)", "text", None, HANDBOOK, "Attendance - Limits on Absences", "52",
        enforced=False,
    ),
    _rule(
        "dropping.retention_master_average", "dropping",
        "Retention: master's weighted average",
        "To remain in good standing a master's student keeps a weighted average of 2.0 or better "
        "at the end of each academic year.",
        2.0, "decimal", "grade", HANDBOOK, "Academic Performance - Retention Policy", "54",
        enforced=False,
    ),
    _rule(
        "dropping.retention_doctorate_average", "dropping",
        "Retention: doctorate weighted average",
        "To remain in good standing a doctorate student keeps a weighted average of 1.75 or "
        "better at the end of each academic year.",
        1.75, "decimal", "grade", HANDBOOK, "Academic Performance - Retention Policy", "54",
        enforced=False,
    ),
    _rule(
        "dropping.failing_grade_dropped_from_program", "dropping",
        "A grade of 5.0 drops the student from the program",
        "A student who gets a 5.0 is automatically dropped from the program, and failure in any "
        "subject means no re-admission to the program.",
        True, "bool", None, HANDBOOK, "Academic Performance - Retention Policy", "54",
        enforced=False,
    ),
    # ---- Leave of absence --------------------------------------------------
    _rule(
        "loa.written_request_required", "loa",
        "Written request with reason and period",
        "A request for a leave of absence is made in writing to the Dean. It states the reason "
        "for the leave and specifies the period.",
        True, "bool", None, HANDBOOK, "Attendance - Leave of Absence", "52",
    ),
    _rule(
        "loa.max_period_semesters", "loa",
        "A leave is approved for up to one year",
        "A leave of absence may be approved for a period of one year (two semesters).",
        2, "int", "semesters", HANDBOOK, "Attendance - Leave of Absence", "52",
    ),
    _rule(
        "loa.max_total_semesters", "loa",
        "A leave may be renewed for at most another year",
        "The leave may be renewed for at most another year, so all approved leave together "
        "cannot pass two years (four semesters).",
        4, "int", "semesters", HANDBOOK, "Attendance - Leave of Absence", "52",
    ),
    _rule(
        "loa.no_filing_days_before_term_end", "loa",
        "No leave within two weeks before the last day of classes",
        "No leave of absence is granted during a semester within two weeks (14 days) before "
        "the last day of classes.",
        14, "int", "days", HANDBOOK, "Attendance - Leave of Absence, guideline 3", "53",
    ),
    _rule(
        "loa.second_half_marks_w", "loa",
        "A leave filed in the second half of a semester marks the courses W",
        "For a leave filed by the student himself or herself during the second half of the "
        "semester, the class standing of the enrolled courses becomes W (withdrawn) and no "
        "refund of tuition and fees is given. The portal shows this on the request.",
        True, "bool", None, HANDBOOK, "Attendance - Leave of Absence, guideline 2", "53",
    ),
    _rule(
        "loa.min_completed_semesters", "loa",
        "Minimum semesters completed before a leave",
        "The student must have completed at least one semester before filing a leave.",
        1, "int", "semesters", PROTOTYPE, enforced=True,
    ),
    _rule(
        "leave.return_due_days", "loa",
        "A leave is marked Return Due this many days before it ends",
        "Graduate School staff see the leave as Return Due, and the student is reminded to file a "
        "readmission request or ask for an extension, this many days before the leave ends.",
        30, "int", "days", PROTOTYPE, enforced=True,
    ),
    _rule(
        "leave.return_grace_days", "loa",
        "Days after a leave ends before AWOL is proposed",
        "If a leave has ended and no readmission was filed after this many days, the system proposes "
        "AWOL. A Graduate School staff member confirms it; nothing changes automatically.",
        14, "int", "days", PROTOTYPE, enforced=True,
    ),
    _rule(
        "loa.awol_if_no_leave", "loa",
        "Leaving without a formal leave is AWOL",
        "A student who withdraws from the college without a formal leave of absence is "
        "considered absent without leave (AWOL) and has registration privileges curtailed or "
        "withdrawn.",
        True, "bool", None, HANDBOOK, "Attendance - Leave of Absence", "53",
    ),
    # ---- Readmission -------------------------------------------------------
    _rule(
        "readmission.written_intent_required", "readmission",
        "A returning student writes an intent to enroll",
        "A student returning from a leave of absence or AWOL declares the intention to enroll "
        "by writing to the University Registrar through the Graduate School Dean, who endorses "
        "it to the Registrar.",
        True, "bool", None, HANDBOOK, "Attendance - Leave of Absence (return)", "53",
    ),
    # ---- AWOL, residency and maximum residence ------------------------------
    _rule(
        "residency.master_normal_years", "awol_residency",
        "Master's: all requirements within 5 academic years",
        "A master's student completes all requirements within five academic years from the date "
        "of admission. Beyond that the student needs the extension below.",
        5, "int", "years", HANDBOOK, "Maximum Residence - Master's Program", "54",
    ),
    _rule(
        "residency.master_absolute_years", "awol_residency",
        "Master's: absolute maximum of 7 academic years, including leave of absence",
        "A master's program must be finished within seven academic years including leave of "
        "absence. A student who cannot finish within seven years re-enrolls all courses taken. "
        "The residence clock is not paused during a leave.",
        7, "int", "years", HANDBOOK, "Maximum Residence - Master's Program", "55",
    ),
    _rule(
        "residency.doctorate_normal_years", "awol_residency",
        "Doctorate: all requirements within 7 academic years",
        "A doctorate student completes all requirements, including the dissertation, within "
        "seven academic years from the date of admission.",
        7, "int", "years", HANDBOOK, "Maximum Residence - Doctorate Program", "55",
    ),
    _rule(
        "residency.doctorate_absolute_years", "awol_residency",
        "Doctorate: absolute maximum of 9 academic years, including leave of absence",
        "A doctoral program must be finished within nine academic years including leave of "
        "absence. A student who cannot finish within nine years re-enrolls all courses taken. "
        "The residence clock is not paused during a leave.",
        9, "int", "years", HANDBOOK, "Maximum Residence - Doctorate Program", "55",
    ),
    _rule(
        "residency.extension_years", "awol_residency",
        "Extension beyond the normal limit",
        "A student who cannot comply with the normal maximum residence is allowed a maximum "
        "two-year extension.",
        2, "int", "years", HANDBOOK, "Maximum Residence", "54-55",
    ),
    _rule(
        "residency.refresher_units", "awol_residency",
        "Graded refresher course during the extension",
        "During the two-year extension the student enrolls in a graded 6-unit refresher course "
        "related to the area of specialization.",
        6, "int", "units", HANDBOOK, "Maximum Residence", "54-55",
    ),
    _rule(
        "residency.includes_loa", "awol_residency",
        "Time on leave of absence counts toward maximum residence",
        "The maximum-residence limits include leave of absence. The residency clock keeps "
        "running while a student is on leave; it is never paused.",
        True, "bool", None, HANDBOOK, "Maximum Residence", "55",
    ),
    _rule(
        "residency.master_candidacy_years", "awol_residency",
        "Master's: candidacy within 3 academic years",
        "Candidacy to the degree must be attained within three academic years from the date "
        "of admission.",
        3, "int", "years", HANDBOOK, "Maximum Residence - Master's Program", "54",
        enforced=False,
        reason="Candidacy status is decided by the Graduate School and is not tracked as a date in the system.",
    ),
    _rule(
        "residency.doctorate_candidacy_years", "awol_residency",
        "Doctorate: candidacy within 5 academic years",
        "Candidacy to the degree must be attained within five academic years from the date "
        "of admission.",
        5, "int", "years", HANDBOOK, "Maximum Residence - Doctorate Program", "55",
        enforced=False,
        reason="Candidacy status is decided by the Graduate School and is not tracked as a date in the system.",
    ),
    # ---- Research ----------------------------------------------------------
    _rule(
        "research.comprehensive_exam_before_research", "research",
        "Comprehensive exam must be passed before the title defense",
        "A student who passes the comprehensive examination confers with the Dean for an "
        "adviser and is advanced to candidacy. Research stages (Form 1 title defense onward) "
        "stay locked until the comprehensive exam is marked Passed.",
        True, "bool", None, HANDBOOK, "Comprehensive Examinations - Advancement to Candidacy", "57",
    ),
    _rule(
        "research.thesis_writing_years", "research",
        "Thesis / project paper writing period",
        "Thesis or project paper writing must be finished within two years from the title "
        "defense (or proposal defense). The proposal must be submitted and defended within one "
        "year of the title defense.",
        2, "int", "years", HANDBOOK, "Project Paper, Thesis & Dissertation - Standards", "58",
        enforced=False,
        reason="The deadline is tracked by staff; the system shows time in stage but does not block on it.",
    ),
    _rule(
        "research.dissertation_writing_years", "research",
        "Dissertation writing period",
        "Dissertation writing must be finished within three years from the title defense. "
        "The proposal must be submitted and defended within one year of the title defense.",
        3, "int", "years", HANDBOOK, "Project Paper, Thesis & Dissertation - Standards", "58",
        enforced=False,
        reason="The deadline is tracked by staff; the system shows time in stage but does not block on it.",
    ),
    _rule(
        "research.turnitin_max_percent", "research",
        "Similarity index of at most 15%",
        "The final draft undergoes Turnitin scanning and a similarity index rating of not more "
        "than 15% is required before the paper goes to the editor.",
        15, "int", "percent", PROTOCOL, "Closed-door Final Defense - After the defense (Turnitin scanning)", None,
        enforced=False,
        reason="Staff check the uploaded Turnitin certificate; the percentage is not read from the file automatically.",
        document="protocol",
    ),
    _rule(
        "research.title_change_max", "research",
        "One change of title only",
        "A student may request only one change of the title of the study, before applying for "
        "the proposal defense.",
        1, "int", "requests", PROTOCOL, "Change of Title of the Study", None,
        enforced=False,
        reason="Not tracked by the system yet; the panel and the Research Coordinator enforce it.",
        document="protocol",
    ),
    _rule(
        "research.adviser_change_max", "research",
        "One change of research adviser only",
        "A student may request only one change of research adviser, before the proposal defense.",
        1, "int", "requests", PROTOCOL, "Request for Change of Research Adviser", None,
        document="protocol",
    ),
    _rule(
        "research.adviser_contract_days", "research",
        "Advising contract forms within 5 days of Form 3.1",
        "Once the research adviser is appointed, the student emails Form 3.2 (Research Timetable) and "
        "Form 3.3 (Thesis/Dissertation Advising Contract) to the GS Research Coordinator within 5 days "
        "of receiving Form 3.1. The adviser tracker shows the due date and flags it when it is overdue.",
        5, "int", "days", PROTOCOL, "Designation of the Research Adviser - II. Advising Contract", None,
        document="protocol",
    ),
    # ---- Defense scheduling and panels --------------------------------------
    _rule(
        "defense.title_lead_days", "defense",
        "Title defense: apply at least 2 weeks before",
        "Form 1 with the three concept papers must reach the Academic Coordinator, and be "
        "endorsed to the Research Coordinator, at least two weeks (14 days) before the "
        "scheduled title defense. A title defense cannot be scheduled sooner than this.",
        14, "int", "days", PROTOCOL, "Title Defense - I. Application for Title Defense", None,
        document="protocol",
    ),
    _rule(
        "defense.proposal_lead_days", "defense",
        "Proposal defense: endorse at least 2 weeks before",
        "Form 4 is endorsed at least two weeks (14 days) before the proposal defense; the panel "
        "members receive the manuscript two weeks before to review it (the 14-Day Rule).",
        14, "int", "days", PROTOCOL, "Proposal Defense - I. Application for Proposal Defense", None,
        document="protocol",
    ),
    _rule(
        "defense.final_lead_days", "defense",
        "Closed-door final defense: endorse at least 2 weeks before",
        "Form 4 and the manuscript are endorsed at least two weeks (14 days) before the "
        "closed-door final defense, following the 14-Day Rule (14 days, weekends included, "
        "from the day the panel receives the manuscript).",
        14, "int", "days", PROTOCOL, "Closed-door Final Defense - I. Application", None,
        document="protocol",
    ),
    _rule(
        "defense.public_final_lead_days", "defense",
        "Public final defense: apply 5 days before",
        "The application for the public final defense (Form 4.3) is made 5 days before the "
        "preferred schedule so that the Graduate School can post the announcement.",
        5, "int", "days", PROTOCOL, "Public Defense - I. Application for the Public Defense", None,
        document="protocol",
    ),
    _rule(
        "defense.panel_size_project_paper", "defense",
        "Project paper panel: chair and 2 members",
        "A project paper panel has 1 Panel Chair and 2 members (1 Content Specialist, "
        "1 Method Specialist), 3 in all.",
        3, "int", "members", HANDBOOK, "Guidelines for Thesis/Dissertation - Application for Title Defense", "60",
    ),
    _rule(
        "defense.panel_size_thesis", "defense",
        "Thesis panel: chair and 3 members",
        "A thesis panel has 1 Panel Chair and 3 members (1 Content Specialist, 1 Method "
        "Specialist, 1 External Panel), 4 in all. The external member joins from the proposal "
        "defense onward.",
        4, "int", "members", HANDBOOK, "Guidelines for Thesis/Dissertation - Application for Title Defense", "60",
    ),
    _rule(
        "defense.panel_size_dissertation", "defense",
        "Dissertation panel: chair and 4 members",
        "A dissertation panel has 1 Panel Chair and 4 members (2 Content Specialists, 1 Method "
        "Specialist, 1 External Panel), 5 in all. The external member joins from the proposal "
        "defense onward.",
        5, "int", "members", HANDBOOK, "Guidelines for Thesis/Dissertation - Application for Title Defense", "60",
    ),
    _rule(
        "defense.thesis_major_revision_score", "defense",
        "Thesis final defense: below 85 is a provisional pass with major revisions",
        "For a thesis a score below 85 on Form 7 is a provisional pass with major revisions "
        "(subject for re-defense). For a dissertation the line is 90. The panel chair enters the "
        "Form 7 score in the verdict form, which refuses a plain pass below this value.",
        85, "int", "score", PROTOCOL, "Closed-door Final Defense - II. During the defense", None,
        document="protocol",
    ),
    _rule(
        "defense.dissertation_major_revision_score", "defense",
        "Dissertation final defense: below 90 is a provisional pass with major revisions",
        "For a dissertation a score below 90 on Form 7 is a provisional pass with major "
        "revisions (subject for re-defense). The verdict form refuses a plain pass below this value.",
        90, "int", "score", PROTOCOL, "Closed-door Final Defense - II. During the defense", None,
        document="protocol",
    ),
    # ---- Practicum ---------------------------------------------------------
    _rule(
        "practicum.required_hours", "practicum",
        "Practicum hours required",
        "The number of practicum hours a student must complete before the practicum is "
        "marked complete.",
        200, "int", "hours", PROTOTYPE,
    ),
    _rule(
        "practicum.required_units_basic", "practicum",
        "Practicum eligibility: Basic units",
        "Basic-course units a student must have completed before starting the practicum.",
        6, "int", "units", PROTOTYPE,
    ),
    _rule(
        "practicum.required_units_major", "practicum",
        "Practicum eligibility: Major units",
        "Major-course units a student must have completed before starting the practicum.",
        9, "int", "units", PROTOTYPE,
    ),
    _rule(
        "practicum.required_units_cognate", "practicum",
        "Practicum eligibility: Cognate units",
        "Cognate-course units a student must have completed before starting the practicum.",
        6, "int", "units", PROTOTYPE,
    ),
    _rule(
        "practicum.required_units_total", "practicum",
        "Practicum eligibility: total units",
        "Total course units a student must have completed before starting the practicum.",
        21, "int", "units", PROTOTYPE,
    ),
    # ---- Graduation --------------------------------------------------------
    _rule(
        "graduation.research_conference_presentation", "graduation",
        "Present the thesis or dissertation at a research conference",
        "A student who enrolled in August 2020 or later presents the thesis or dissertation at a "
        "research conference (the Graduate School Research Conference or an external one) and "
        "submits the certificate of presentation. Only graduating students join the ceremony.",
        True, "bool", None, PROTOCOL, "Public Defense - After the Public Defense (note)", None,
        enforced=False,
        reason="The certificate of presentation is submitted to the Graduate School Office and checked by staff.",
        document="protocol",
    ),
    _rule(
        "graduation.completion_documents", "graduation",
        "Documents needed before hard-bound copies",
        "Before the hard-bound copies: soft copy of the final manuscript, panel approval emails, "
        "ethics clearance, Turnitin certificate and the editor's certification (Form 9); then "
        "the approval sheet (Form 10).",
        "Final manuscript; panel approval; ethics clearance; Turnitin certificate; editor certification (Form 9); approval sheet (Form 10)",
        "text", None, PROTOCOL, "Closed-door Final Defense - After the defense", None,
        document="protocol",
    ),
    # ---- Faculty -----------------------------------------------------------
    _rule(
        "faculty.teaching_load_limit_units", "faculty",
        "Faculty teaching load limit",
        "The most teaching units a faculty member can be assigned in one semester when course "
        "offerings are matched to faculty.",
        24, "int", "units", PROTOTYPE,
    ),
    _rule(
        "faculty.max_advisees", "faculty",
        "Faculty: at most five advisees per semester",
        "A faculty member can be assigned at most five active advisees per semester; more only with "
        "the approval of the Dean. The Research Protocol (Designation of the Research Adviser) "
        "says the same. The adviser appointment blocks a sixth advisee unless the Dean records an "
        "exception with a note.",
        5, "int", "advisees", HANDBOOK,
        "Project Paper, Thesis & Dissertation - Adviser", "59",
    ),
    _rule(
        "defense.reminder_days", "defense",
        "Defense reminders: 14, 7, 2 and 1 day before",
        "The student, the adviser and the panel get an in-app reminder this many days before a "
        "confirmed defense (the first is also the 14-Day Rule check that the panel has the manuscript).",
        "14,7,2,1", "text", "days", PROTOTYPE,
    ),
    _rule(
        "research.signature_reminder_days", "research",
        "Adviser signature waiting: remind after 3 days",
        "An adviser is reminded when an advisee's manuscript or endorsement has waited for their "
        "signature this many days.",
        3, "int", "days", PROTOTYPE,
    ),
    _rule(
        "defense.availability_reminder_days", "defense",
        "Panelist with no availability: remind within 3 days of the request",
        "A panelist whose availability is still not entered this many days after staff asked for it "
        "is reminded again.",
        3, "int", "days", PROTOTYPE,
    ),
]

BUSINESS_RULE_BY_KEY = {item["key"]: item for item in BUSINESS_RULE_CATALOG}
assert len(BUSINESS_RULE_BY_KEY) == len(BUSINESS_RULE_CATALOG), "duplicate business rule key"
