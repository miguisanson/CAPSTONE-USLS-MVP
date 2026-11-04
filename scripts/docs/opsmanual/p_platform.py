"""Process chapters 4.20 to 4.24: the platform basis the lifecycle relies on.

Neither the Handbook nor the Research Protocol covers these areas, so every rule here is Proposed.
A rule that rests on a statute (RA 8792, RA 10173) cites the statute as its basis and is still
Proposed, because the reading of the statute is the group's and the University must confirm it.
Platform statements were checked against app.py, teaching_backend.py and the files in
Documents/AIMS_Export/.
"""

from __future__ import annotations

from .common import C, D, E, GP, N, PLAT, PROPOSED, Process, R

NS = "—"

FACULTY = Process(
    num="4.20", key="FAC",
    title="Faculty course preference and teaching load",
    purpose="To record which subjects each professor prefers to teach and when the professor is available, and to assign professors to the subjects offered in a term within a teaching-load limit, with the Dean's approval of the offering and the professor's acknowledgement. The Handbook says nothing about teaching load. Graduate School staff said that the Academic Coordinator decides which professor teaches each subject (Consultation 21 July 2026). This chapter is therefore the group's proposal and follows what the platform does.",
    who=["Faculty member", "Academic Coordinator", "Graduate School Dean", "GS staff", "Research Coordinator (availability for defenses)"],
    trigger="The offering for a coming term is being planned (CRS-09), a new professor joins, a professor's preferred subjects or hours change, or the Research Coordinator or GS staff need a professor's availability for a defense.",
    preconditions=[
        "The professor has a faculty profile that is Active, with college or department, specialization, email and eligible roles (the login is set up under 4.21).",
        "The subjects to be offered are known from the term offering plan (4.3, GS-F-04).",
        "The professor's college is the college of the program that owns the subject.",
    ],
    steps=[
        ("Faculty member", "Fills GS-F-47: lists the preferred subjects in order of preference (own college only), enters the weekly teaching or consultation hours, and adds dated exceptions (available or unavailable on a date or range, with an optional note). A new professor does this after the profile and login exist.", "GS-F-47", "Before offering planning (proposed)"),
        ("GS staff", "If the professor cannot enter the data, enters it on the professor's behalf from the signed GS-F-47. The record shows who entered it.", "Faculty profile", NS),
        ("Research Coordinator", "When a defense is to be scheduled, asks the panel members to enter availability for a window of dates (by default four weeks from the earliest allowed date) with an optional message. The request stays open until the professor answers.", "Availability request", NS),
        ("Faculty member", "Answers an availability request by entering hours, or by confirming that the hours already on record have not changed. The professor cannot confirm \"no change\" while no hours have been entered.", "Availability record", NS),
        ("Academic Coordinator", "Proposes the professor for each offered subject, considering the preferred subjects, availability, eligible role, qualifications and current load, and prepares GS-F-48 from GS-F-04 and GS-F-47. The platform refuses an assignment that would take the professor past the load limit.", "GS-F-48; offering plan", "During offering planning"),
        ("Graduate School Dean", "Approves the offering plan, or returns it with a reason. The approval covers the assigned professors.", "GS-F-48; plan decision (CRS-10)", NS),
        ("Faculty member", "Acknowledges the assignment on GS-F-48 (signature or email).", "GS-F-48", "Before classes begin (proposed)"),
        ("GS staff", "Files the signed GS-F-47 and GS-F-48 and publishes the offering list.", "Filed forms; published list", NS),
    ],
    rules=[
        R("FAC-01", "Each faculty member has one profile with name, college or department, specialization, email, eligible roles (Faculty Adviser, Panel Member, Panel Chair, Academic Coordinator, Research Coordinator) and an Active or Inactive status. GS staff and the Academic Coordinator create and edit profiles.", (PLAT, "faculty profile"), PROPOSED),
        R("FAC-02", "A faculty member lists preferred subjects in order of preference on GS-F-47. A faculty member may change only the member's own list; GS staff and the Academic Coordinator may enter it on the member's behalf. Only subjects of the member's own college may be listed.", (PLAT, "faculty preferred subjects"), PROPOSED),
        R("FAC-03", "A preferred subject is a wish, not a promise. The Academic Coordinator weighs preference with availability, eligible role, qualification and current load, and the Academic Coordinator's assignment stands (see CRS-07 and CRS-12).", [C("21 July 2026", "the Academic Coordinator decides which professor teaches"), (PLAT, "offering setup")], PROPOSED),
        R("FAC-04", "Availability is recorded as weekly hours with dated exceptions on top. An exception \"available\" replaces the weekly hours for that day; an exception \"unavailable\" removes the day or the stated hours. A weekend needs a dated entry.", (PLAT, "faculty availability and exceptions"), PROPOSED),
        R("FAC-05", "Hours that the system filled in by itself are never counted as availability the professor entered. Until the professor or GS staff enter hours, the record reads \"not entered\" and the professor is not suggested for a subject.", (PLAT, "faculty availability status"), PROPOSED),
        R("FAC-06", "The Research Coordinator and GS staff may request availability from the panel members for a student's defense. A request has a date window, an optional message and a status of Open, Answered or Cancelled, and it is answered when the professor enters hours or confirms the hours on record.", [(PLAT, "availability requests"), N("BPM accurate flow, scheduling")], PROPOSED),
        R("FAC-07", "A professor may be assigned at most 24 teaching units in a semester. An assignment that would pass the limit is refused and the Academic Coordinator chooses another professor or changes the sections. The 24-unit value is a prototype value pending the Graduate School's answer (OQ-45).", (PLAT, "faculty teaching load limit"), PROPOSED),
        R("FAC-08", "Only an Active professor of the same college as the subject's program may be assigned to the subject.", (PLAT, "offering setup"), PROPOSED),
        R("FAC-09", "The Dean approves the offering plan, including its assigned professors, before it is published (CRS-10). GS-F-48 is the paper record of the assignment; the professor acknowledges it before classes begin.", [N("BPM accurate flow, section 3"), (PLAT, "offering plan decision")], PROPOSED),
    ],
    exceptions=[
        "A professor has not entered any availability: the platform does not suggest the professor, but the Academic Coordinator may still choose the professor by hand and sees a caution when the chosen time falls outside the known hours (FAC-05).",
        "The load limit would be passed: the platform refuses the assignment; the Academic Coordinator chooses another professor or splits the sections (FAC-07).",
        "A subject needs a professor from another college: the platform does not allow it; the Academic Coordinator asks the Dean, and the question is open (OQ-45).",
        "A professor becomes unavailable after approval: the Academic Coordinator records the change on a new GS-F-48 with the reason and informs the Dean (proposed).",
        "A professor leaves or is set to Inactive: the login ends and past assignments stay on record (see 4.21).",
    ],
    records=[
        ("GS-F-47 Faculty Course Preference and Availability", "Academic Coordinator; faculty profile in the platform"),
        ("GS-F-48 Teaching Load Assignment", "Dean's office; Academic Coordinator; offering plan in the platform"),
        ("Availability requests and answers", "Platform; Research Coordinator and GS staff"),
    ],
    platform="The platform keeps each faculty profile with preferred subjects in ranked order, weekly working hours, dated availability exceptions, and requests for availability that name a student, a date window and the person who asked. A faculty member can enter or confirm own hours and own preferred subjects. In Offering setup the Academic Coordinator picks a professor and a schedule for each subject; the platform lists only professors who are Active, in the right college and within the load limit, shows the load before and after, and refuses an assignment past the limit. Offering plans move from Draft to Submitted to Approved or Returned to Published, and record who approved.",
    platform_diff="The platform has no field for the professor's signature on the assignment: the acknowledgement on GS-F-48 stays on paper. The 24-unit limit is a prototype value that the Graduate School has not confirmed (OQ-45), and the Handbook states no load limit for professors. The platform allows the Academic Coordinator to assign a professor who has not entered availability; the manual's rule is that such a professor is not suggested.",
)

ACCOUNTS = Process(
    num="4.21", key="ACC",
    title="Platform accounts and roles",
    purpose="To state who may hold an account on the platform, what each role may do, and how an account is requested, approved, set up, reviewed and removed, so that every person sees and does only what the person's office requires. The Handbook and the Protocol describe the offices but not the platform; this chapter is the group's proposal.",
    who=["The person who needs an account", "Head of the person's office", "Graduate School Dean", "GS staff", "Platform administrator"],
    trigger="A person joins the Graduate School or a role changes (a new staff member, coordinator, Dean or professor); a student is handed off from admission; or a person leaves.",
    preconditions=[
        "The person's office and role are known (the seven roles in ACC-01).",
        "The person has an institutional email address, which is the sign-in name.",
        "For a student, the student's record is held by the Graduate School (4.1).",
    ],
    steps=[
        ("The person", "Fills GS-F-46: name, institutional email, office, the role asked for and the reason. Students and professors do not file GS-F-46; their accounts come from the handoff (4.1) and from the faculty profile (4.20).", "GS-F-46", NS),
        ("Head of office", "Endorses the request: confirms that the person holds the office and needs the role.", "GS-F-46 (endorsement)", NS),
        ("Graduate School Dean", "Approves the request or declines it. The Dean's own account is approved by the officer the University names (OQ-46).", "GS-F-46 (approval)", NS),
        ("GS staff", "Sets up the account with the approved role and a temporary password, in the platform where the platform allows it, otherwise through the platform administrator, and gives the person the temporary password by a private channel.", "Account record", "Within 3 working days of approval (proposed)"),
        ("The person", "Signs in, chooses a personal password of at least ten characters and accepts the Data Privacy Notice (4.23). Nothing else works until the password is changed.", "Sign-in; notice acceptance", "At first sign-in"),
        ("Graduate School Dean", "Reviews, once a year, the list of active accounts and roles against the staff list and removes what is not needed.", "Account review", "Once a year (proposed)"),
        ("The person or head of office", "When the person leaves or changes office, files GS-F-46 for removal or change of role.", "GS-F-46 (removal)", "On the last working day (proposed)"),
        ("GS staff", "Deactivates the account. The account is not deleted: the log and the cases the person handled stay on record.", "Account record", "Within 5 working days of the request (proposed)"),
    ],
    rules=[
        R("ACC-01", "The platform has seven roles: Graduate School Staff, Academic Coordinator, Research Coordinator, Dean, Student, Faculty Member and Administrator. One account has one role and belongs to one person.", (PLAT, "role labels"), PROPOSED),
        R("ACC-02", "Each screen and each action is open only to the roles that GS-P-05 lists for it (least privilege). A Student sees only the student's own record; a Faculty Member sees only the faculty member's own portal, panel invitations and adviser requests.", (PLAT, "role checks on every request"), PROPOSED),
        R("ACC-03", "A student account is created when the student is handed off from admission (the monitoring workbook import). Each new student account gets its own initial password, shown once to the staff member who imported the file.", (PLAT, "student handoff import"), PROPOSED),
        R("ACC-04", "A faculty account is created together with the faculty profile by GS staff or the Academic Coordinator. The email must not belong to another profile or account.", (PLAT, "faculty creation"), PROPOSED),
        R("ACC-05", "An account for GS staff, a coordinator or the Dean is requested on GS-F-46, endorsed by the head of the person's office, approved by the Dean and set up by GS staff or the platform administrator within three working days of the approval (proposed).", GP, PROPOSED),
        R("ACC-06", "A password set for someone else is temporary: the holder must choose a personal password at first sign-in before anything else works. A personal password has at least ten characters, differs from the old one and is not the email address or a shared demo password.", (PLAT, "change of password"), PROPOSED),
        R("ACC-07", "Repeated failed sign-ins slow the next attempt (after five failures within 15 minutes the wait is 2 seconds and doubles to at most 30 seconds); the account is not locked.", (PLAT, "sign-in brake"), PROPOSED),
        R("ACC-08", "An account is deactivated, not deleted, when the person leaves or changes office, within five working days of the request. A deactivated account cannot sign in. Setting a faculty profile to Inactive deactivates its login.", [(PLAT, "account status"), GP], PROPOSED),
        R("ACC-09", "The Dean reviews the list of active accounts and roles once a year (the interval is proposed, OQ-46).", GP, PROPOSED),
        R("ACC-10", "The Administrator account is held by the person who maintains the platform and not by an office holder. Accounts are personal: a password is never shared, and a shared demonstration login exists only in demonstration mode.", [(PLAT, "administrator and demonstration accounts"), GP], PROPOSED),
    ],
    exceptions=[
        "A person holds two offices (for example a professor who is also an Academic Coordinator): the faculty profile carries the eligible roles; the person asks GS-F-46 for the second role and receives a separate account for it only if the Dean approves (proposed).",
        "A person forgets the password: GS staff set a new temporary password and the person must change it at the next sign-in.",
        "A representative acts for the Dean: the representative signs in under the representative's own account and the decision names the authority (EAP-04).",
        "A student is on leave, AWOL or withdrawn: the account stays active unless the Dean decides otherwise; the platform blocks the actions the status forbids.",
        "A student graduates: the account is kept for the retention period in PRV-08 and then handled under 4.23.",
    ],
    records=[
        ("GS-F-46 Platform Account and Role Request", "Dean's office; GS staff"),
        ("GS-P-05 Platform Access and Roles Matrix", "Graduate School; shown to every new account holder"),
        ("Account list with role and status", "Platform administrator; yearly review by the Dean"),
    ],
    platform="Every request to the platform checks the signed-in account and its role. A request from a signed-out browser is refused, a request from a role not listed for the screen is refused, and an account that still has a temporary password can do nothing except choose a new one. Student accounts are created by the file handoff, faculty accounts by GS staff or the Academic Coordinator, and the other accounts are set up by the administrator. A deactivated account cannot sign in. Passwords are stored only as a salted hash. The Administrator account passes every role check so that it can review all staff screens, and it acts as Graduate School staff in workflows.",
    platform_diff="The current build has no screen to create, change the role of or deactivate a staff, coordinator or Dean account; those are set by the platform administrator in the database. Faculty accounts can be created and set to Inactive by GS staff and the Academic Coordinator. The platform does not yet ask for GS-F-46 or record the endorsement and approval of an account request; the paper form is the record. The Administrator passing every role check is broader than the least-privilege rule ACC-02 and ACC-10, and is an open question (OQ-46).",
)

EAPPROVAL = Process(
    num="4.22", key="EAP",
    title="Electronic approval and signatures",
    purpose="To state when an approval recorded in the platform counts as the approving officer's signature on the matching form. The Research Protocol already accepts e-signatures sent by email on the research forms; this chapter extends the same idea to approvals made inside the platform and says what each approval record must show. It rests on Republic Act No. 8792 and is the group's proposal until the University confirms it.",
    who=["Approving officer (Dean, Associate Dean, Academic Coordinator, Research Coordinator, GS staff)", "GS staff", "Graduate School Dean", "University counsel or Information Technology Services (to confirm)"],
    trigger="An officer approves, endorses, returns or declines a request in the platform, or a form needs the signature of an officer who works in the platform.",
    preconditions=[
        "The officer has a personal account with the matching role (4.21) and has accepted the Data Privacy Notice (4.23).",
        "The request has reached the officer's step, so that the platform offers the officer the decision.",
    ],
    steps=[
        ("Approving officer", "Signs in under the officer's own account and opens the request.", "Sign-in", NS),
        ("Approving officer", "Reads the request and its attachments.", "Request and attachments", NS),
        ("Approving officer", "Chooses the decision (approve, endorse, return or decline) and, where the platform asks for it, enters the remarks. A one-line note beside the control says that the decision is an electronic approval under GS-P-03.", "Decision in the platform", NS),
        ("Platform", "Records the officer's name and role, the date and time, the decision, the remarks, the previous and the new status and the next owner. The record cannot be edited by the officer who benefits from it.", "Approval record (transaction log)", NS),
        ("GS staff", "Where the file needs a printed copy, prints the case record or the form with the line \"Approved electronically under GS-P-03 by [name, role] on [date, time]\".", "Printed form or case record", NS),
        ("Approving officer", "Where the Protocol requires the e-signature to be affixed on the form itself (for example Forms 3, 4 and 4.3), also signs the form as the Protocol says; the platform approval is recorded in addition.", "Signed form", "As the Protocol says"),
        ("Graduate School Dean", "On a dispute about an approval, asks GS staff for the case record and decides.", "Case record", NS),
    ],
    rules=[
        R("EAP-01", "The e-signature already used on research forms by email (ADV-09, PRP-02, FIN-12) remains valid. GS-P-03 adds the approval recorded in the platform and does not replace the Protocol.", [(PLAT, "approval records"), ("Research Protocol AY2024-2025", "e-signatures by email, as in ADV-09, PRP-02 and FIN-12")], PROPOSED),
        R("EAP-02", "An electronic document and an electronic signature have legal recognition under RA 8792 (section 7, electronic documents; section 8, electronic signatures). An electronic signature equals a written signature when a method identifies the person to be bound and shows that the person had access to the document to consent or approve it, the method is dependable for its purpose, the person applied the signature to proceed, and the other party can verify it. The University must confirm that the platform's sign-in meets this test (OQ-47).", E("s. 7 and s. 8"), PROPOSED),
        R("EAP-03", "An approval recorded in the platform by the signed-in holder of the approving role is that officer's signature on the matching GS-F form, if the approval record shows the officer's name and role, the date and time, the decision and the remarks.", [E("s. 8"), (PLAT, "approval records")], PROPOSED),
        R("EAP-04", "An officer approves only under the officer's own account and never lends a password. A representative of an officer (for example the Dean's authorised representative) signs in under the representative's own account, and the decision names the officer for whom the representative acts and the authority.", [E("s. 8"), GP], PROPOSED),
        R("EAP-05", "Every approve, endorse, return or decline control in the platform shows a one-line note that the decision is an electronic approval under GS-P-03.", GP, PROPOSED),
        R("EAP-06", "The approval record is kept for as long as the case file it belongs to (PRV-08). It is not edited. A wrong approval is corrected by a new, later entry that states the reason, and both entries stay.", (PLAT, "transaction log"), PROPOSED),
        R("EAP-07", "Where the Protocol requires an e-signature on the form itself, the form keeps it. The platform approval does not take its place until the Graduate School confirms GS-P-03.", GP, PROPOSED),
        R("EAP-08", "Other offices, including the Registrar, receive a platform approval only as a printed or exported case record, or as the form carrying the line \"Approved electronically under GS-P-03 by [name, role] on [date, time]\".", GP, PROPOSED),
    ],
    exceptions=[
        "The officer is away and the platform cannot be reached: the form is signed on paper or by email as before and GS staff enter the decision afterwards, naming the original signer (EAP-07).",
        "An officer says a decision was not made by the officer: the Dean asks GS staff for the case record; the sign-in details and the log are reviewed under 4.23; a wrong decision is corrected by a new entry (EAP-06).",
        "The University decides not to accept platform approvals as signatures: the manual falls back to EAP-01 and EAP-07 and the forms are signed as the Protocol says (OQ-47).",
    ],
    records=[
        ("GS-P-03 Electronic Approval and Signature Policy", "Dean's office; shown beside every decision control"),
        ("Approval record (who, role, date, time, decision, remarks)", "Platform transaction log; printed or exported on request"),
    ],
    platform="Every workflow decision in the platform is made by a signed-in account whose role is checked first, and each decision writes a log entry with the officer's role and name, the time, the result, the previous and new status, the next owner and any note. Decisions are not edited; a later entry follows an earlier one. The platform shows a one-line note citing GS-P-03 beside the approve and decide controls.",
    platform_diff="The platform records the approval and the officer's identity through the officer's account; it does not use a digital certificate or a second sign-in step at the moment of approval, so whether it meets RA 8792 section 8 is for the University to confirm (OQ-47). The one-line note citing GS-P-03 was added with the forms-pack revision of the platform. The platform does not print the line \"Approved electronically under GS-P-03\"; GS staff add it from the case record.",
)

PRIVACY = Process(
    num="4.23", key="PRV",
    title="Data privacy and records retention",
    purpose="To state how the Graduate School protects the personal data in its records and in the platform, what each person is told and agrees to, how long records are kept, and what happens when something goes wrong. It rests on Republic Act No. 10173 (Data Privacy Act of 2012) and its Implementing Rules, with the National Privacy Commission as regulator. The Handbook and the Protocol do not cover it, so every rule is the group's proposal and the retention periods are values to be confirmed.",
    who=["Account holder and data subject (student, faculty member, officer)", "GS staff", "Graduate School Dean", "USLS Data Protection Officer (contact to be confirmed)", "Platform administrator"],
    trigger="A person signs in to the platform for the first time or after a new version of the notice; a person asks about or against the use of the person's data; a record reaches the end of its retention period; or a breach is suspected.",
    preconditions=[
        "The University has named a Data Protection Officer and the officer's contact (OQ-48).",
        "The Data Privacy Notice and Retention Schedule (GS-P-04) is approved and has a version number.",
    ],
    steps=[
        ("Platform", "At first sign-in, and again after a new notice version, shows the Data Privacy Notice (GS-P-04) and asks the account holder to accept it before anything else works.", "Notice screen", "At first sign-in"),
        ("Account holder", "Reads and accepts the notice. The platform stores the date, time and notice version with the account.", "Consent record", "At first sign-in"),
        ("GS staff", "For a person who has no account or prefers paper, gives GS-F-45; keeps the signed copy in the person's file and enters the date in the platform record where it applies.", "GS-F-45", NS),
        ("Data subject", "Asks the Graduate School to give access to, correct, block or remove the person's data, or objects to its use.", "Written request to the GS Office", NS),
        ("GS staff", "Logs the request, checks the identity of the person, passes the request to the Data Protection Officer and answers within the time set in PRV-04.", "Request log", "Within 15 working days (proposed)"),
        ("GS staff", "Once a year lists the case files that have passed their retention period (PRV-08) and sends the list to the Dean.", "Retention list", "Once a year (proposed)"),
        ("Graduate School Dean", "Approves disposal of the listed files, or extends one with a reason.", "Disposal decision", NS),
        ("GS staff and administrator", "Dispose of the approved files securely, or remove the names and keep the counts for reports, and record what was disposed of and when.", "Disposal record", NS),
        ("Any staff member", "On a suspected breach, tells the Data Protection Officer and the Dean the same day. The officer decides whether the National Privacy Commission and the affected persons must be told.", "Incident note", "Same day (proposed)"),
    ],
    rules=[
        R("PRV-01", "The Graduate School keeps personal data of students, faculty and officers for the lifecycle processes in this manual. The University's Data Protection Officer oversees the Graduate School's handling of that data, and the Dean is accountable for the Graduate School's records.", [D("s. 21"), GP], PROPOSED),
        R("PRV-02", "The Graduate School collects only the data a process in this manual needs and uses it only for that process (transparency, legitimate purpose and proportionality). Official identity, enrollment and grade data come from AIMS and are not retyped (3.3).", D("s. 11"), PROPOSED),
        R("PRV-03", "At first sign-in the platform shows the Data Privacy Notice (GS-P-04) and records the account holder's acceptance with the date, time and notice version. A person without an account, or who prefers paper, signs GS-F-45. A new version of the notice is shown again at the next sign-in.", [D("s. 12"), GP], PROPOSED),
        R("PRV-04", "A data subject may ask to be told what is held, to see and correct it, to object to its use, and to have it blocked or removed where the law and the retention schedule allow (rights of the data subject). The Graduate School answers within 15 working days (the period is proposed, OQ-48).", D("s. 16"), PROPOSED),
        R("PRV-05", "Personal data are shown only to the roles that need them for their step (4.21). Staff do not keep copies on personal devices or send them through personal email or chat.", [D("s. 20"), GP], PROPOSED),
        R("PRV-06", "The platform protects personal data with role checks on every request, hashed passwords, a sign-in brake, session cookies that scripts cannot read, an audit log of changes, and uploaded files that are only given to roles allowed to see the case.", [D("s. 20"), (PLAT, "security measures")], PROPOSED),
        R("PRV-07", "Any suspected breach is reported the same day to the Data Protection Officer and the Dean. The officer decides whether the National Privacy Commission and the affected persons must be notified.", D("s. 20"), PROPOSED),
        R("PRV-08", "Retention (proposed): a student's case file, the forms, the approval records and the transaction log are kept for 5 years after graduation or after the last enrollment, whichever applies. The graduation list and the transmittals to the Registrar are kept permanently. After the period the files are disposed of securely or kept only without names for reports (OQ-49).", [D("s. 11"), GP], PROPOSED),
        R("PRV-09", "Data go to an outside service only if GS-P-04 names the service and what it receives. The platform can use an outside search service for the policy question box and for reading documents; when it is used, text from the question, the documents or the person's own record leaves the platform. Switching it off must leave the platform working with its own documents (OQ-48). A faculty member's own calendar is linked only when the member connects it.", [D("s. 11 and s. 21"), (PLAT, "outside services")], PROPOSED),
    ],
    exceptions=[
        "A person declines the notice: the person cannot use the platform; GS staff handle the person's business on paper under the same rules (GS-F-45 records the refusal).",
        "A student asks to remove data that a rule requires the Graduate School to keep (for example a graduation record): the request is refused for that data with the reason and granted for the rest (PRV-04, PRV-08).",
        "A court or a government office orders disclosure: the Dean and the Data Protection Officer decide; nothing is released by a staff member alone.",
        "A record is needed after its period (for example a pending complaint): the Dean extends retention in writing for that file only.",
    ],
    records=[
        ("GS-P-04 Data Privacy Notice and Records Retention Schedule", "Dean's office; shown at first sign-in"),
        ("GS-F-45 Data Privacy Consent and Acknowledgement", "GS staff, in the person's file"),
        ("Consent record (date, time and notice version)", "Platform account record"),
        ("Retention list, disposal decision and disposal record", "GS staff; Dean's office"),
        ("Data subject requests and incident notes", "GS Office; Data Protection Officer"),
    ],
    platform="The platform stores the date, time and version of each account holder's acceptance of the notice and asks again when the version changes. It checks roles on every request, stores passwords only as salted hashes, sets session cookies that scripts cannot read, brakes repeated failed sign-ins, and writes a log entry for each change. Imported official data are read-only (4.24). The platform has no automatic disposal: GS staff list and dispose of files by the yearly procedure.",
    platform_diff="The retention periods are proposed values and the platform does not enforce them. The Data Protection Officer's name and contact are not yet known (OQ-48). When the outside search service is switched on, text leaves the platform, which the notice must say; whether that use is allowed is for the University to decide. The first-sign-in notice and the consent record were added with the forms-pack revision of the platform.",
)

DATAEXCHANGE = Process(
    num="4.24", key="DEX",
    title="AIMS and Registrar data exchange",
    purpose="To specify which files come into the platform from AIMS and the Registrar, which files go out to the Registrar, who sends them, how often, and what stays read-only. AIMS is the University's system and the official record of identity, enrollment and grades; the group was told that the platform cannot be integrated with it, so the exchange is by file only. This chapter is the group's proposal and follows what the platform does; the cadence and the columns are for the AIMS and Registrar owner to confirm.",
    who=["GS staff", "Academic Coordinator", "Graduate School Dean", "University Registrar", "Information Technology Services (ITS)"],
    trigger="A term starts or grades are posted (inbound files); a change is made in the platform that the Registrar must apply in AIMS; the Dean approves a leave, a readmission or a graduation endorsement (outbound files).",
    preconditions=[
        "The exporting office (the Registrar or ITS) agrees to supply the file (OQ-50).",
        "For an outbound file, the case has the Dean's approval.",
        "The person sending a file has a platform account with the matching role (4.21).",
    ],
    steps=[
        ("Registrar or ITS", "Supplies an Excel export of identity, enrollment and grades (the group was told the Graduate School can ask ITS for one). The proposed workbook has the sheets Export_Metadata, Students, Enrollment_Subjects, Grades and Subject_Offerings.", "AIMS export workbook", "Start of each term and after grade posting (proposed)"),
        ("GS staff", "Uploads the Academic Coordinator's student monitoring workbook (.xlsx) at student handoff, and the Academic Coordinator or GS staff upload class lists (.csv or .xlsx with a faculty column) to tag students as enrolled or dropped. The platform checks each file, refuses rows it cannot accept, and keeps the original file.", "Uploaded workbook; class list", "Each term"),
        ("Platform", "Imports identity, enrollment and grade values as read-only and reports any difference from the Graduate School's record. A difference is corrected in AIMS and a replacement export is imported; it is never overwritten in the platform.", "Import result; discrepancy list", NS),
        ("Academic Coordinator or GS staff", "Each working day opens the daily change report and applies each listed change in AIMS (or sends it to the Registrar), then marks it reflected.", "Daily change report", "Each working day (proposed)"),
        ("GS staff", "Exports the Dean-approved leave and readmission cases to a CSV or Excel list for the Registrar, emails it, and marks the cases Sent to Registrar and later Acknowledged.", "Registrar list; export log", "After the Dean's approval"),
        ("Graduate School Dean", "Approves the graduation endorsements, exports the endorsed list (CSV) and emails it to the Registrar by the official channel.", "Endorsed graduation list", "After the batch approval"),
        ("GS staff", "Sends each outbound file with a Records Transmittal (GS-F-44) and files the transmittal and the Registrar's acknowledgement.", "GS-F-44; acknowledgement", NS),
    ],
    rules=[
        R("DEX-01", "AIMS stays an external system and the official record of identity, enrollment and grades. The platform has no live link, no AIMS login and no screen reading of AIMS; only files are exchanged.", [C("21 July 2026", "the group was told the platform cannot be integrated with AIMS"), (PLAT, "AIMS boundary")], PROPOSED),
        R("DEX-02", "Files come in by upload by GS staff or the Academic Coordinator: the student monitoring workbook (.xlsx or .xlsm) at handoff, and class lists (.csv or .xlsx with a faculty column) for enrollment tagging. The platform validates a file, refuses rows it cannot accept (for example a row for another semester, or for a student who is on leave, AWOL or withdrawn) and never changes grades.", (PLAT, "student handoff and class list import"), PROPOSED),
        R("DEX-03", "The proposed AIMS export contract (version PROPOSED-1.0, Documents/AIMS_Export/) is a workbook with the sheets Export_Metadata, Students, Enrollment_Subjects, Grades and Subject_Offerings. STUDENT_NUMBER is the identity key; official values are kept as exported. The exact columns, the exporting office and the cadence are for the AIMS and Registrar owner to confirm (OQ-50). The current build does not yet read this workbook.", (PLAT, "Documents/AIMS_Export"), PROPOSED),
        R("DEX-04", "The files from AIMS or the Registrar are supplied at the start of each term, after enrollment closes, and again after grades are posted (proposed). Between those dates the platform sends changes out by the daily change report (DEX-06).", GP, PROPOSED),
        R("DEX-05", "Identity, enrollment, grade and completion values imported from AIMS are read-only. If the Graduate School's record differs, the difference is flagged for follow-up and corrected in AIMS, and a replacement export is imported with its history kept.", [("This manual", "section 3.3"), (PLAT, "read-only official data")], PROPOSED),
        R("DEX-06", "Every change made in the platform that the Registrar must apply in AIMS (enrollment or subject change, withdrawal, course adjustment, leave, readmission, AWOL or residency, graduation) appears on a dated daily change report. The Academic Coordinator or GS staff apply it in AIMS and mark it reflected; the platform does not write to AIMS.", (PLAT, "daily change report"), PROPOSED),
        R("DEX-07", "Only leave and readmission cases that the Dean has approved can be exported to the Registrar list. Each export is logged with the file name, the person and the time, and a case moves from Pending Handoff to Exported - Ready to Send, then to Sent to Registrar and Acknowledged when GS staff record them (see GRD-16, OQ-32).", (PLAT, "leave and readmission Registrar export"), PROPOSED),
        R("DEX-08", "The graduation list is exported only for endorsements the Dean has approved and for students who are still eligible when the file is made. It is a CSV with batch, student number, name, program, coursework status, research status, endorsement status, the Dean's approval date and remarks, and the Registrar export status, and the Dean emails it manually (GRD-16).", (PLAT, "endorsed graduation list"), PROPOSED),
        R("DEX-09", "An outbound file holds only the columns the Registrar needs and goes by official University email, never by personal email or chat (PRV-05).", [D("s. 11"), GP], PROPOSED),
        R("DEX-10", "Each outbound file is sent with a Records Transmittal (GS-F-44). The transmittal and the Registrar's acknowledgement, when one is given, are filed (OQ-32).", GP, PROPOSED),
    ],
    exceptions=[
        "A file is incomplete or a column is blank: the row is held and GS staff ask for a corrected file (Consultation 20 July 2026 discussion; handled as in 4.1).",
        "The Registrar does not acknowledge a file: the case stays at Sent to Registrar; GS staff follow up and the platform does not record receipt unless GS staff enter it (OQ-32).",
        "AIMS shows a student as enrolled while the Graduate School record says otherwise: the AIMS value is followed and the difference is flagged (DEX-05).",
        "No export from AIMS is supplied in a term: the Academic Coordinator's monitoring workbook and class lists remain the working record (OQ-33).",
    ],
    records=[
        ("GS-P-06 AIMS and Registrar Data Exchange Specification", "Graduate School; AIMS and Registrar owner"),
        ("Uploaded workbooks and class lists with the import result", "Platform; GS staff"),
        ("Daily change report with the reflected mark", "Platform; Academic Coordinator and GS staff"),
        ("Leave and readmission export log; endorsed graduation list", "Platform; GS staff; Dean"),
        ("GS-F-44 Records Transmittal and Registrar acknowledgement", "GS staff; Registrar"),
    ],
    platform="GS staff upload the Academic Coordinator's monitoring workbook at handoff; GS staff and the Academic Coordinator upload class lists. The platform shows a daily change report of the changes the Registrar must apply in AIMS, with a reflected mark and the time and person. It exports Dean-approved leave and readmission cases as CSV or Excel with an export log and status changes, and the Dean exports the endorsed graduation list as CSV. Imported official data are read-only, and the proposed AIMS export workbook is kept in Documents/AIMS_Export/.",
    platform_diff="The platform does not read the proposed AIMS export workbook (PROPOSED-1.0) yet; the working inputs are the Academic Coordinator's monitoring workbook and the class lists. The Registrar's acknowledgement of a graduation list is not recorded; the leave export records a manual acknowledgement. The cadence in DEX-04 and the exact columns are proposals (OQ-50).",
)
