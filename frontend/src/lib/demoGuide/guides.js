// Demo Guide content (data only; the rules are in engine.js, the screen is components/DemoGuide.jsx).
// Source: scripts/docs/walkthrough/cases/{09,10,11,05,20}_*.json (steps, notes, policy pages) and the spoken lines of
// scripts/demo/narration.json (a step only names its line with `say`; narration.js looks the words up).
//
// A step: { id, title, role, route, page, say, do, target?, doneWhen, branches?, side?, rule?, dateWait?, ifAsked: [{ q, a }] }
//   role      who must be signed in: student | staff | dean
//   route     the page prefix (or a list of them) where the step happens; page is its name for "Go to ..."
//   doneWhen  { status: [...] } the live case status | { route } | { roleIs } | { apiWrite: "POST /path/*" } | "manual"
//   branches  [{ status: [...], goto: "<side step id>", note }] when the record is at a status off the main path
//   side      true for a step that is only reached through a branch
//   rule      the policy behind a refusal the app may show on this step
// No pronouns for people anywhere in this file (owner rule): the role is named.

const STAFF = { who: "Graduate School staff", label: "Graduate School staff", email: "staff@usls.edu.ph" };
const DEAN = { who: "the Dean", label: "the Dean", email: "dean@usls.edu.ph" };
const ACADEMIC = { who: "the Academic Coordinator", label: "the Academic Coordinator", email: "academic@usls.edu.ph" };
const RESEARCH = { who: "the Research Coordinator", label: "the Research Coordinator", email: "research@usls.edu.ph" };

const from = (order, status) => order.slice(order.indexOf(status));

const LEAVE_ORDER = ["Submitted", "Staff Review", "Dean Review", "Leave Scheduled", "On Leave", "Return Due", "Approved", "Closed", "Expired"];
const READMISSION_ORDER = ["Submitted", "Staff Review", "Dean Review", "Approved", "Closed"];
const WITHDRAWAL_ORDER = ["Submitted to GS Staff", "Dean Review", "Approved - Awaiting Subject Tag", "Subject Tagged - Registrar Preparation", "Exported - Ready to Send", "Sent to Registrar", "Withdrawn Confirmed"];
const PRACTICUM_ORDER = ["MOA Submitted", "MOA Under Review", "Practicum In Progress", "Hours Incomplete", "Documents Submitted", "Documents Under Review", "Additional Certificates Requested", "Completed", "Report Sent to Dean", "Dean Reviewed"];
const GRADUATION_ORDER = ["For Review", "Coursework Review", "Research Review", "Eligibility Confirmed", "Endorsement Prepared", "Ready for Dean Review", "Dean Approved"];
const AWOL_ORDER = ["Return Submitted", "Dean Review", "Return Approved", "Extension Approved - Refresher Required", "Re-enrollment Required", "Re-enrollment Completed"];

const RESEND = (id, route, page, say, extra = {}) => ({
  id,
  side: true,
  title: "Correct it and send it again",
  role: "student",
  route,
  page,
  say,
  do: "Read the comment, change what it asks for, and send the request again. It goes back to Graduate School staff.",
  target: 'main form button[type="submit"]',
  doneWhen: "manual",
  ifAsked: [{ q: "Does the student start over?", a: "No. The same request comes back with the comment. After it is sent again it returns to Submitted and the earlier steps are repeated." }],
  ...extra,
});

const DENIED = (id, route, page, say) => ({
  id,
  side: true,
  title: "Not approved",
  role: "student",
  route,
  page,
  say,
  do: "Show the student's page: the request is marked as not approved and the Dean's note explains why. This is the end of this script; reset the demo student to run it again.",
  doneWhen: "manual",
  ifAsked: [{ q: "What can the student do after a denial?", a: "Graduate School staff tell the student what to do next. A new request can be filed if the reason no longer applies." }],
});

export const GUIDES = [
  {
    id: "leave-of-absence",
    process: "leave-of-absence",
    title: "Leave of Absence",
    summary: "A student asks for a leave, staff check it, the Dean approves, staff start the leave.",
    studentNumber: "GS-2026-LOA-02",
    walkthrough: "09_leave_of_absence",
    accounts: {
      student: { who: "the student", label: "Daniel Fernandez", email: "loa.daniel@usls.edu.ph" },
      staff: STAFF,
      dean: DEAN,
    },
    steps: [
      {
        id: "loa-file", title: "The student asks for a leave", role: "student", route: "/student/requests/leave-of-absence", page: "Leave of Absence",
        say: "leave-of-absence-03",
        do: "Pick when the leave starts and ends (two semesters at most), a reason and a short explanation, then send the request.",
        target: 'main form button[type="submit"]',
        doneWhen: { status: from(LEAVE_ORDER, "Submitted") },
        rule: "A leave covers at most two semesters at a time (Graduate School Handbook); leave counts toward the maximum residence.",
        ifAsked: [
          { q: "How long can a leave be?", a: "Two semesters at a time. Leave counts toward the maximum residence; the request window shows how many of the 4 leave semesters are already approved." },
          { q: "Why does the policy check say Needs review?", a: "The Minimum residency rule is a prototype value this demo student does not meet. Rules marked Needs review are prototype values waiting for Graduate School validation. The Dean still decides." },
        ],
      },
      {
        id: "loa-review", title: "Staff start the review", role: "staff", route: "/workflow/leave-of-absence", page: "Leave of Absence",
        say: "leave-of-absence-07",
        do: "Find the card in Submitted and move it to In staff review (drag it, or use Move to... on the card). Open View details and read the policy check.",
        target: '[aria-label="Leave of absence board"]',
        doneWhen: { status: from(LEAVE_ORDER, "Staff Review") },
        rule: "The server checks every move. A card that is waiting for the student or the Dean cannot be moved by staff.",
        ifAsked: [
          { q: "Does the policy check approve the request?", a: "No. It is advice for staff with Pass or Needs review. Only the Dean decides." },
          { q: "Can staff just drag the card anywhere?", a: "No. Dragging is the same guarded step as the buttons. The server refuses a move the rules do not allow." },
        ],
      },
      {
        id: "loa-forward", title: "Staff forward it to the Dean", role: "staff", route: "/workflow/leave-of-absence", page: "Leave of Absence",
        say: "leave-of-absence-11",
        do: "Click Forward to Dean, keep the eligibility result on the policy check, write a note for the Dean and forward it.",
        doneWhen: { status: from(LEAVE_ORDER, "Dean Review") },
        ifAsked: [{ q: "Why does staff add a note?", a: "The note tells the Dean what staff checked, for example that two semesters is within the Handbook limit and no earlier leave is on record." }],
      },
      {
        id: "loa-decide", title: "The Dean decides", role: "dean", route: ["/dean/approvals/leave-of-absence", "/dean/case/leave-of-absence"], page: "Leave of Absence (Dean)",
        say: "leave-of-absence-14",
        do: "Open the request in the Dean's queue and approve it with a note. Return for revision and Deny are the other choices.",
        doneWhen: { status: from(LEAVE_ORDER, "Leave Scheduled") },
        branches: [
          { status: ["Returned"], goto: "loa-resend", note: "The request was returned with a comment. The student corrects it and sends it again." },
          { status: ["Denied"], goto: "loa-denied", note: "The Dean denied the request." },
        ],
        rule: "Only the Dean approves, returns or denies a leave.",
        ifAsked: [
          { q: "Is an email sent to the Registrar?", a: "No. The portal sends no email. Staff download the Registrar list, email it, then mark it sent and acknowledged." },
          { q: "What if the Dean does not approve?", a: "The Dean can return it for revision (the student corrects and sends again) or deny it (the student is told why)." },
        ],
      },
      {
        id: "loa-start", title: "Staff start the leave", role: "staff", route: "/workflow/leave-of-absence", page: "Leave of Absence", dateWait: true,
        say: "leave-of-absence-17",
        do: "For the demo, move the card from Leave scheduled to On leave with Start the leave now. Enrollment closes for the student.",
        doneWhen: { status: from(LEAVE_ORDER, "On Leave") },
        ifAsked: [{ q: "Does a leave start by itself?", a: "Yes, on the first day of the leave semester. Starting it by hand is only for the demo, so nobody waits for a real date." }],
      },
      {
        id: "loa-result", title: "The student sees On leave", role: "student", route: "/student/requests/leave-of-absence", page: "Leave of Absence",
        say: "leave-of-absence-22",
        do: "Sign in as the student: the badge reads On leave and the discussion shows every message from the steps. Enrollment is closed.",
        doneWhen: "manual",
        ifAsked: [{ q: "How does the student come back?", a: "By filing a Readmission request before the leave ends. Open the Readmission guide for that." }],
      },
      RESEND("loa-resend", "/student/requests/leave-of-absence", "Leave of Absence", "leave-of-absence-03", { doneWhen: { status: from(LEAVE_ORDER, "Submitted") } }),
      DENIED("loa-denied", "/student/requests/leave-of-absence", "Leave of Absence", "leave-of-absence-15"),
    ],
  },
  {
    id: "readmission",
    process: "readmission",
    title: "Readmission",
    summary: "A student on leave asks to come back, staff verify the return checklist, the Dean approves.",
    studentNumber: "GS-2026-READ-01",
    walkthrough: "10_readmission",
    accounts: {
      student: { who: "the student", label: "Therese Lacson", email: "readmission.therese@usls.edu.ph" },
      staff: STAFF,
      dean: DEAN,
    },
    steps: [
      {
        id: "re-file", title: "Ask to come back", role: "student", route: "/student/requests/readmission", page: "Readmission",
        say: "readmission-03",
        do: "Choose the semester to return in, write why you are ready, and send the request. There is nothing to tick.",
        target: 'main form button[type="submit"]',
        doneWhen: { status: from(READMISSION_ORDER, "Submitted") },
        rule: "A returning student writes an intent to enroll (Graduate School Handbook 2022-2023, p. 53).",
        ifAsked: [
          { q: "Can the student come back before the leave ends?", a: "The student can ask. The Dean decides whether the leave may end early; the policy check shows Needs review for an early return." },
          { q: "What must the student write?", a: "A written intention to enroll (Handbook p. 53). The system checks the written intention and the subjects still to take; staff confirm the Business Office clearance and the interview (Handbook p. 45)." },
        ],
      },
      {
        id: "re-review", title: "Start the staff review", role: "staff", route: "/workflow/readmission", page: "Readmission",
        say: "readmission-08",
        do: "Move the card from Submitted to In staff review, then open View details: return semester, intention, linked leave, return checklist and policy check.",
        target: '[aria-label="Readmission board"]',
        doneWhen: { status: from(READMISSION_ORDER, "Staff Review") },
        rule: "The server checks every move. A card that is waiting for the student or the Dean cannot be moved by staff.",
        ifAsked: [
          { q: "Does the policy check decide?", a: "No. It is advice for staff with Pass or Needs review. Only the Dean decides whether the leave may end early." },
          { q: "Why does it say Needs review?", a: "The student asks to return before the approved leave ends. Only the Dean can allow that, so the check shows Needs review." },
        ],
      },
      {
        id: "re-forward", title: "Staff forward it to the Dean", role: "staff", route: "/workflow/readmission", page: "Readmission",
        say: "readmission-11",
        do: "Click Forward to Dean, tick the two office checks (Business Office clearance and the interview), write a note and forward it.",
        doneWhen: { status: from(READMISSION_ORDER, "Dean Review") },
        ifAsked: [
          { q: "What if an office check is not ticked?", a: "Anything left unticked reaches the Dean as Needs review." },
          { q: "Is an email sent to the Registrar?", a: "No. The portal sends no email. Staff download the Registrar list, email it and mark it sent." },
        ],
      },
      {
        id: "re-decide", title: "The Dean decides", role: "dean", route: ["/dean/approvals/readmission", "/dean/case/readmission"], page: "Readmission (Dean)",
        say: "readmission-14",
        do: "Open the request in the Dean's queue and approve it with a note. Return for revision and Deny are the other choices.",
        doneWhen: { status: from(READMISSION_ORDER, "Approved") },
        branches: [
          { status: ["Returned"], goto: "re-resend", note: "The request was returned with a comment. The student corrects it and sends it again." },
          { status: ["Denied"], goto: "re-denied", note: "The Dean did not approve the return." },
        ],
        rule: "Only the Dean approves, returns or denies a readmission.",
        ifAsked: [
          { q: "Does approval enroll the student in subjects?", a: "No. Readmission restores standing. The Academic Coordinator plans the enrollment afterwards, as a separate step." },
          { q: "Can the Dean send it back?", a: "Yes: Return for revision (the student corrects and sends again) or Deny." },
        ],
      },
      {
        id: "re-result", title: "The student is back", role: "student", route: "/student/requests/readmission", page: "Readmission",
        say: "readmission-18",
        do: "Sign in as the student: the badge reads Approved and the discussion shows the messages from staff and the Dean.",
        doneWhen: "manual",
        ifAsked: [{ q: "How does the Registrar learn about it?", a: "From the Registrar list at the bottom of the Readmission board: Pending Handoff, then Sent to Registrar, then acknowledged. Staff download it and email it." }],
      },
      RESEND("re-resend", "/student/requests/readmission", "Readmission", "readmission-03", { doneWhen: { status: from(READMISSION_ORDER, "Submitted") } }),
      DENIED("re-denied", "/student/requests/readmission", "Readmission", "readmission-18"),
    ],
  },
  {
    id: "awol",
    process: "awol",
    title: "AWOL return",
    summary: "The system flags a student as AWOL, the student files a return, staff forward it, the Dean decides.",
    studentNumber: "GS-2026-AWOL-01",
    walkthrough: "11_awol",
    accounts: {
      student: { who: "the student", label: "Maya Torres", email: "awol.maya@usls.edu.ph" },
      staff: STAFF,
      dean: DEAN,
    },
    steps: [
      {
        id: "aw-flag", title: "Show the flag", role: "staff", route: "/workflow/awol", page: "AWOL & Residency",
        say: "awol-02",
        do: "Open the board and find the card in the AWOL column. It says Waiting for: Student. Staff cannot move it; only the student files the return.",
        target: '[aria-label="AWOL and residency board"]',
        doneWhen: "manual",
        ifAsked: [
          { q: "Can staff declare a student AWOL by hand?", a: "No. AWOL is a standing the policy engine derives from the enrollment records. Nobody types AWOL." },
          { q: "What are the residence limits?", a: "For a master's student 5 years normal and 7 absolute; for a doctorate 7 and 9." },
        ],
      },
      {
        id: "aw-file", title: "The student files the return", role: "student", route: "/student/requests/awol-return", page: "Return from AWOL",
        say: "awol-06",
        do: "The next open semester is already chosen and the last enrolled semester comes from the records. Write the intention and the reason, then send the declaration.",
        target: 'main form button[type="submit"]',
        doneWhen: { status: from(["AWOL Declared", ...AWOL_ORDER], "Return Submitted") },
        rule: "The return semester must be one that has not started, and the student must be within the maximum residence (master's: 5 years normal, 7 absolute).",
        ifAsked: [{ q: "Why can the student not pick the last enrolled semester?", a: "It is shown from the enrollment records, so nobody types a value the system already knows." }],
      },
      {
        id: "aw-forward", title: "Staff forward the return", role: "staff", route: "/workflow/awol", page: "AWOL & Residency", dateWait: true,
        say: "awol-11",
        do: "The card has moved itself to Return review. Check the policy check, then move it to With the Dean with a note.",
        doneWhen: { status: from(AWOL_ORDER, "Dean Review") },
        rule: "A card that is waiting for the student or the Dean cannot be moved by staff.",
        ifAsked: [{ q: "Why did the card move by itself?", a: "The student filed the return declaration, so the system moved the case to Return review." }],
      },
      {
        id: "aw-decide", title: "The Dean decides", role: "dean", route: ["/dean/approvals/awol", "/dean/case/awol"], page: "AWOL & Residency (Dean)",
        say: "awol-14",
        do: "Open the return in the Dean's queue and approve it. Approval restores standing; return for revision and deny are the other choices.",
        doneWhen: { status: from(AWOL_ORDER, "Return Approved") },
        branches: [
          { status: ["Returned for Revision"], goto: "aw-resend", note: "The Dean returned the declaration. The student corrects it and files it again." },
          { status: ["Return Denied"], goto: "aw-denied", note: "The Dean denied the return. The student stays AWOL." },
        ],
        rule: "Only the Dean decides the outcome of a return.",
        ifAsked: [{ q: "Does approval enroll the student?", a: "No. The Academic Coordinator is the next owner, since enrollment is a separate step." }],
      },
      {
        id: "aw-result", title: "The student is active", role: "student", route: "/student/requests/awol-return", page: "Return from AWOL",
        say: "awol-19",
        do: "Sign in as the student: the status is Return Approved and the discussion shows the messages from staff and the Dean.",
        doneWhen: "manual",
        ifAsked: [{ q: "Where does the Registrar see it?", a: "The Registrar list on the AWOL & Residency board holds one report per approved return. Staff download it and send it officially." }],
      },
      RESEND("aw-resend", "/student/requests/awol-return", "Return from AWOL", "awol-06", { doneWhen: { status: from(AWOL_ORDER, "Return Submitted") } }),
      DENIED("aw-denied", "/student/requests/awol-return", "Return from AWOL", "awol-19"),
    ],
  },
  {
    id: "monitoring",
    process: "monitoring",
    title: "Monitoring Sheet",
    summary: "Add a student, add and edit subject rows, read the change history, see how imported values are protected.",
    studentNumber: "2260073",
    walkthrough: "05_monitoring_sheet",
    accounts: { staff: STAFF },
    steps: [
      {
        id: "ms-open", title: "Open the Monitoring Sheet", role: "staff", route: "/monitoring-sheet", page: "Monitoring Sheet",
        say: "monitoring-sheet-01",
        do: "Open Monitoring Sheet under Records: one row per student, one column per subject.",
        doneWhen: { route: "/monitoring-sheet", roleIs: "staff" },
        ifAsked: [{ q: "Where do the values come from?", a: "The sheet is the curriculum record from the imported workbook. Grades, official enrollment and subject results stay in AIMS and are never entered here." }],
      },
      {
        id: "ms-student", title: "Add a student", role: "staff", route: "/monitoring-sheet", page: "Monitoring Sheet",
        say: "monitoring-sheet-02",
        do: "Select Add student, type the Student ID, the names and the school year, then add the student. A Student Portal login is created.",
        doneWhen: { apiWrite: "POST /monitoring/students" },
        rule: "The same required fields and duplicate checks as an import: a Student ID that exists is refused.",
        ifAsked: [
          { q: "Is a manual entry marked?", a: "Yes. Every portal entry carries the badge Manual entry, the staff member's name and the time." },
          { q: "What password does the new login get?", a: "The shared demonstration password. Real accounts are created by the Graduate School office." },
        ],
      },
      {
        id: "ms-subject", title: "Add a subject row", role: "staff", route: "/monitoring-sheet", page: "Monitoring Sheet",
        say: "monitoring-sheet-06",
        do: "In the student's record open Subjects, select Add on a subject, choose Completed, type the term and a remark, and save.",
        doneWhen: { apiWrite: "POST /monitoring/students/*/subjects" },
        ifAsked: [{ q: "Are grades entered here?", a: "No. Only the curriculum status of a subject, the term and a remark. Grades stay out of scope." }],
      },
      {
        id: "ms-history", title: "Read the change history", role: "staff", route: "/monitoring-sheet", page: "Monitoring Sheet",
        say: "monitoring-sheet-11",
        do: "Open the Change history tab: every add, change and removal with the old value, the new value, who made it and when.",
        doneWhen: "manual",
        ifAsked: [{ q: "Can a row be erased?", a: "No. Removing a row needs a reason, the row goes back to not taken, and the history keeps it." }],
      },
      {
        id: "ms-imported", title: "Imported values are protected", role: "staff", route: "/monitoring-sheet", page: "Monitoring Sheet",
        say: "monitoring-sheet-14",
        do: "Open the record of an imported student and select Edit on a subject: a reason is required, kept with the staff member's name.",
        doneWhen: "manual",
        ifAsked: [
          { q: "What if a later upload disagrees with a portal entry?", a: "It is held for review instead of overwriting the portal value." },
          { q: "Who can edit?", a: "Graduate School staff and the Academic Coordinator. The Research Coordinator and the Dean can view only." },
        ],
      },
    ],
  },
  {
    id: "reports",
    process: "reports",
    title: "Reports",
    summary: "The numbers the office asks about, the filters, the detail behind each number and the Registrar changes.",
    walkthrough: "20_reports",
    accounts: { staff: STAFF },
    steps: [
      {
        id: "rp-open", title: "Open Reports and Analytics", role: "staff", route: "/reports", page: "Reports & Analytics",
        say: "reports-tour-01",
        do: "Open Reports & Analytics under Overview. Filters on top; below, the first report.",
        doneWhen: { route: "/reports", roleIs: "staff" },
        ifAsked: [{ q: "Where do the numbers come from?", a: "The figures are computed live from recorded transactions. Read the figures off the screen; the numbers change as cases are run." }],
      },
      {
        id: "rp-filter", title: "Filters cover the whole page", role: "staff", route: "/reports", page: "Reports & Analytics",
        say: "reports-tour-15",
        do: "Set a filter, for example Risk = Delayed. The table narrows and the downloads use the same filters. Clear filters brings everything back.",
        doneWhen: "manual",
        ifAsked: [{ q: "Why does risk say Not Yet Assessed?", a: "Where the official risk rules are not confirmed, the page says Not Yet Assessed instead of an invented High, Medium or Low." }],
      },
      {
        id: "rp-tabs", title: "The other reports", role: "staff", route: "/reports", page: "Reports & Analytics",
        say: "reports-tour-10",
        do: "Open By year started, Overdue and pending, Defenses and Graduation candidates in turn. Each has its own filters and downloads.",
        doneWhen: "manual",
        ifAsked: [{ q: "Can a report be downloaded?", a: "Yes, as Excel and PDF on every report; the Registrar changes list also has CSV and Print." }],
      },
      {
        id: "rp-registrar", title: "Registrar changes", role: "staff", route: "/reports", page: "Reports & Analytics",
        say: "reports-tour-14",
        do: "Open Registrar changes: the daily list of changes the Registrar must apply in AIMS. Pick a date, then download the CSV or print it.",
        doneWhen: "manual",
        ifAsked: [{ q: "Does the portal change AIMS?", a: "No. AIMS stays the official record. This list tells the Registrar what to apply." }],
      },
      {
        id: "rp-analytics", title: "Analytics", role: "staff", route: "/reports", page: "Reports & Analytics",
        say: "reports-tour-11",
        do: "Open Analytics and select a chip, for example Coursework: a window lists the students behind the figure.",
        doneWhen: "manual",
        ifAsked: [{ q: "Who sees the Analytics tab?", a: "Graduate School staff and administrators only." }],
      },
    ],
  },
  {
    id: "withdrawal",
    process: "withdrawal",
    title: "Subject Withdrawal",
    summary: "A student withdraws from one subject inside the handbook window, staff forward it, the Dean decides, staff tag the subject and export the Registrar list.",
    studentNumber: "GS-2026-WD-01",
    walkthrough: "06_withdrawal",
    accounts: {
      student: { who: "the student", label: "Elena Navarro", email: "withdrawal.elena@usls.edu.ph" },
      staff: STAFF,
      dean: DEAN,
    },
    steps: [
      {
        id: "wd-file", title: "The student asks to withdraw from a subject", role: "student", route: "/student/requests/withdrawal", page: "Subject Withdrawal",
        do: "Choose one enrolled subject, type the reason, select Submit withdrawal request and confirm with Send request.",
        target: 'main form button[type="submit"]',
        doneWhen: { status: from(WITHDRAWAL_ORDER, "Submitted to GS Staff") },
        rule: "A subject can be withdrawn until the end of the second week of classes (14 calendar days from the start of classes; Graduate School Handbook p. 49).",
        dateWait: true,
        ifAsked: [
          { q: "Why does another student see no form?", a: "The window is counted from the semester start date kept under Academic Semesters. Outside the 14 days the page shows only the reason, with the deadline of each subject." },
          { q: "Is a fee charged?", a: "The portal shows the fee as information only: 10% of the term's total due in the first week, 20% in the second. The Business Office settles fees; the portal collects nothing." },
        ],
      },
      {
        id: "wd-forward", title: "Staff record and forward it", role: "staff", route: "/workflow/withdrawal", page: "Subject Withdrawal",
        do: "Open View details on the card, read the six steps and the history, then select Record and forward to Dean (a note for the Dean is optional).",
        target: '[aria-label="Subject withdrawal board"]',
        doneWhen: { status: from(WITHDRAWAL_ORDER, "Dean Review") },
        rule: "Staff can return a request to the student only while it is still Submitted; after that the card waits for the Dean.",
        ifAsked: [
          { q: "Can staff approve it?", a: "No. At Dean Review the card is locked for staff (Waiting for: Dean). Only the Dean approves, returns or denies." },
          { q: "What if the request arrived after the deadline?", a: "A request is judged on the date it was submitted, so it stays valid if reviewers act after the deadline." },
        ],
      },
      {
        id: "wd-decide", title: "The Dean decides", role: "dean", route: "/dean/approvals/withdrawal", page: "Subject Withdrawal (Dean)",
        do: "Open View details on the card and select Approve the withdrawal, confirm in the dialog. Return to student and Deny the withdrawal are the other choices.",
        doneWhen: { status: from(WITHDRAWAL_ORDER, "Approved - Awaiting Subject Tag") },
        branches: [
          { status: ["Returned", "Returned for Clarification"], goto: "wd-resend", note: "The request was returned with a comment. The student corrects it and sends it again." },
          { status: ["Denied"], goto: "wd-denied", note: "The Dean denied the request." },
        ],
        rule: "Only the Dean approves, returns or denies a withdrawal.",
        ifAsked: [
          { q: "What does approval do?", a: "It sends the request back to staff to tag the subject as Withdrawn. The student keeps the other subjects and the program standing." },
          { q: "Does the Dean send an email?", a: "No. The portal sends no email at any step." },
        ],
      },
      {
        id: "wd-tag", title: "Staff tag the subject as Withdrawn", role: "staff", route: "/workflow/withdrawal", page: "Subject Withdrawal",
        do: "Open View details on the card in Subject tagging and select Tag the subject as Withdrawn, then confirm.",
        doneWhen: { status: from(WITHDRAWAL_ORDER, "Subject Tagged - Registrar Preparation") },
        ifAsked: [
          { q: "Does the student receive a grade mark?", a: "No. The subject shows Withdrawn in Official Offered Subjects. Any W mark is applied by the Registrar; grades are out of scope for the portal." },
          { q: "Can the subject be reactivated?", a: "Not in the same semester: it is marked withdrawn and cannot be silently reactivated." },
        ],
      },
      {
        id: "wd-export", title: "Staff export the Registrar list", role: "staff", route: "/workflow/withdrawal", page: "Subject Withdrawal",
        do: "Scroll to the Registrar list, select Prepare Excel export, keep the student ticked and select Download Excel list. Staff then email the file to the Registrar.",
        doneWhen: { status: from(WITHDRAWAL_ORDER, "Exported - Ready to Send") },
        ifAsked: [
          { q: "Who tells the Registrar?", a: "A person. The portal prepares the Excel list and sends nothing; the status stays Exported - Ready to Send until the email is sent outside the portal." },
          { q: "Can the list hold several students?", a: "Yes. Every tagged withdrawal is listed with a tick box and one file covers the ticked ones." },
        ],
      },
      {
        id: "wd-result", title: "The student sees the result", role: "student", route: "/student/requests/withdrawal", page: "Subject Withdrawal",
        do: "Sign in as the student: the chip reads Exported - Ready to Send, the Dean decision reads Approved and the six steps are ticked.",
        doneWhen: "manual",
        ifAsked: [{ q: "Where does the student read what happened?", a: "In View messages: each stage leaves a note that tells the student what happened." }],
      },
      RESEND("wd-resend", "/student/requests/withdrawal", "Subject Withdrawal", undefined, { doneWhen: { status: from(WITHDRAWAL_ORDER, "Submitted to GS Staff") } }),
      DENIED("wd-denied", "/student/requests/withdrawal", "Subject Withdrawal", undefined),
    ],
  },
  {
    id: "practicum",
    process: "practicum",
    title: "Practicum",
    summary: "A Psychology or MSGC student sends the MOA and the hours; the Coordinator may ask for more certificates; the Dean reviews the report.",
    studentNumber: "GS-2026-PRAC-02",
    walkthrough: "18_practicum",
    accounts: {
      student: { who: "the student", label: "Paolo Ramirez", email: "practicum.paolo@usls.edu.ph" },
      staff: STAFF,
      academic_coordinator: ACADEMIC,
      dean: DEAN,
    },
    steps: [
      {
        id: "pr-moa", title: "The student sends the MOA", role: "student", route: "/student/practicum", page: "Practicum",
        do: "Type the practicum site and the supervisor, choose the signed MOA PDF, add a remark and select Submit MOA stage, then Send request.",
        doneWhen: { status: from(PRACTICUM_ORDER, "MOA Submitted") },
        rule: "Practicum applies to Psychology programs and MSGC only; the student must have passed the eligibility check first.",
        ifAsked: [
          { q: "Why do other students not see Practicum?", a: "Practicum applies only to Psychology programs and MSGC. Students of other programs never appear on the practicum screens." },
          { q: "Is the eligibility check manual?", a: "No. Courses and research are checked by the system; the student starts at the MOA once every check is Verified." },
        ],
      },
      {
        id: "pr-forward-moa", title: "Staff forward the MOA", role: "staff", route: "/workflow/practicum", page: "Practicum",
        do: "Open View details on the card in Submitted and select Forward to Academic Coordinator, then confirm.",
        doneWhen: { status: from(PRACTICUM_ORDER, "MOA Under Review") },
        ifAsked: [
          { q: "Why does a confirmation window open?", a: "Every step shows the status change (MOA Submitted to MOA Under Review) and takes an optional comment before it is saved." },
          { q: "Can the card be dragged?", a: "Yes, only onto the column its next step leads to. The drop opens the same confirmation as the button." },
        ],
      },
      {
        id: "pr-progress", title: "The Coordinator starts the practicum", role: "academic_coordinator", route: "/workflow/practicum", page: "Practicum",
        do: "Open View details on the card in Eligibility Review and select Mark practicum in progress, then confirm.",
        doneWhen: { status: from(PRACTICUM_ORDER, "Practicum In Progress") },
        ifAsked: [{ q: "Who owns the practicum after staff?", a: "The Academic Coordinator marks the practicum in progress, requests certificates and verifies completion." }],
      },
      {
        id: "pr-hours", title: "The student sends hours and certificates", role: "student", route: "/student/practicum", page: "Practicum",
        do: "Enter the completed hours, choose the certificates PDF, add a remark and select Submit completion stage, then Send request.",
        doneWhen: { status: from(PRACTICUM_ORDER, "Hours Incomplete") },
        rule: "The required hours (200 for MSGC) are shown by the system. Fewer documented hours leave the case at Hours Incomplete.",
        ifAsked: [
          { q: "What if fewer than 200 hours are entered?", a: "The case is recorded as Hours Incomplete and the practicum cannot be completed. The Coordinator then asks for additional certificates." },
          { q: "Can the student type the required hours?", a: "No. The required hours come from the system, so nobody types a value that is already known." },
        ],
      },
      {
        id: "pr-forward-docs", title: "Staff forward the documents", role: "staff", route: "/workflow/practicum", page: "Practicum",
        do: "Open View details on the card and select Forward documents to Academic Coordinator, then confirm.",
        doneWhen: { status: from(PRACTICUM_ORDER, "Documents Under Review") },
        ifAsked: [{ q: "Is the earlier file lost on a resubmission?", a: "No. The original files stay in the Submitted file history all the way." }],
      },
      {
        id: "pr-check", title: "The Coordinator checks the hours", role: "academic_coordinator", route: "/workflow/practicum", page: "Practicum",
        do: "With fewer hours than required, select Request additional certificates and type the reason. With all hours documented, select Verify completion instead.",
        doneWhen: { status: from(PRACTICUM_ORDER, "Additional Certificates Requested") },
        branches: [
          { status: ["Additional Certificates Requested"], goto: "pr-resubmit", note: "The Coordinator asked for more certificates. The student uploads them and sends the stage again; then staff forward the documents again." },
        ],
        rule: "A reason is required when certificates are requested.",
        ifAsked: [
          { q: "Does the student start over?", a: "No. Step 3 is reopened, the earlier PDF stays under Already submitted and the new one is added." },
          { q: "What if the organization is not accepted?", a: "The Coordinator can mark the completion as not accepted; the student then arranges another organization and sends an updated MOA." },
        ],
      },
      {
        id: "pr-verify", title: "The Coordinator verifies completion", role: "academic_coordinator", route: "/workflow/practicum", page: "Practicum",
        do: "Select Verify completion and confirm; the card moves to Completion Review. Open it again and select Send status report to Dean.",
        doneWhen: { status: from(PRACTICUM_ORDER, "Report Sent to Dean") },
        ifAsked: [{ q: "What does the Dean receive?", a: "A Practicum status report: hours, certificates, the remark, the stage history and the whole case discussion." }],
      },
      {
        id: "pr-dean", title: "The Dean reviews the report", role: "dean", route: "/dean/approvals/practicum", page: "Practicum Reports",
        do: "Open View details on the card in With the Dean, type a review comment and select Mark reviewed, then confirm.",
        doneWhen: { status: from(PRACTICUM_ORDER, "Dean Reviewed") },
        // A Dean return puts the record back to "Completed" with a "Revise practicum status report" task for the Coordinator.
        branches: [{ status: ["Completed"], goto: "pr-verify", note: "The Dean returned the report. The Academic Coordinator revises it and sends it to the Dean again." }],
        rule: "The Dean reviews only after the Academic Coordinator has sent the status report.",
        ifAsked: [
          { q: "If the Dean was already signed in, why is the card missing?", a: "The Dean page is read when it opens. Reload it to see the new card." },
          { q: "What does staff see afterwards?", a: "The card in Completed with every file in the Submitted file history and no action due." },
        ],
      },
      {
        id: "pr-resubmit", side: true, title: "The student sends the missing documents again", role: "student", route: "/student/practicum", page: "Practicum",
        do: "Read the Coordinator's message, enter the new completed hours, choose the additional certificate PDF and send the completion stage again.",
        target: 'main form button[type="submit"]',
        doneWhen: "manual",
        ifAsked: [{ q: "Which message tells the student what is missing?", a: "The newest post in the case discussion, shown in green, with the reason the Coordinator typed." }],
      },
    ],
  },
  {
    id: "graduation",
    process: "graduation",
    title: "Graduation",
    summary: "An eligible student applies, staff create a batch, the coordinators check it, the Dean approves and exports the list.",
    studentNumber: "GS-2026-GRAD-02",
    walkthrough: "19_graduation",
    accounts: {
      student: { who: "the student", label: "Carlo Mendoza", email: "graduation.carlo@usls.edu.ph" },
      staff: STAFF,
      academic_coordinator: ACADEMIC,
      research_coordinator: RESEARCH,
      dean: DEAN,
    },
    steps: [
      {
        id: "gr-file", title: "The student sends the graduation application", role: "student", route: "/student/graduation", page: "Graduation Endorsement",
        do: "Choose the open school year, choose the signed application PDF, add a remark and select Submit graduation application, then Send request.",
        doneWhen: { status: from(GRADUATION_ORDER, "For Review") },
        branches: [{ status: ["Returned for Clarification"], goto: "gr-resend", note: "Staff returned the application for clarification. The student sends a corrected PDF." }],
        rule: "Only students whose coursework and research (and a practicum when the program needs one) are complete are listed.",
        ifAsked: [
          { q: "Why are the other school years grey?", a: "Only the open school year can be selected." },
          { q: "Is being eligible enough?", a: "No. Batch creation waits until the signed application PDF is on file." },
        ],
      },
      {
        id: "gr-batch", title: "Staff create the batch", role: "staff", route: "/workflow/graduation", page: "Graduation Endorsement",
        do: "Drag the card from Application submitted to Batch created, set the batch number, month and year, create it, then drag the batch to Coursework review.",
        doneWhen: { status: from(GRADUATION_ORDER, "Coursework Review") },
        rule: "A drop opens the same window as the button and the server checks the rules again.",
        ifAsked: [
          { q: "What if the PDF has the wrong name or number?", a: "Staff select Message / Return and return it for clarification with Have student resubmit document ticked; the original PDF stays in the file history." },
          { q: "Can any card be dragged anywhere?", a: "No. A card moves one column at a time, only to the column its next step leads to." },
        ],
      },
      {
        id: "gr-coursework", title: "The Academic Coordinator checks coursework", role: "academic_coordinator", route: "/workflow/graduation", page: "Graduation Endorsement",
        do: "Drag the batch from Coursework review to Research and practicum check, open View coursework completed if asked, and confirm.",
        doneWhen: { status: from(GRADUATION_ORDER, "Research Review") },
        ifAsked: [{ q: "What does the Coordinator verify?", a: "That the coursework of each candidate is complete. The system already lists only candidates whose coursework is done." }],
      },
      {
        id: "gr-research", title: "The Research Coordinator checks research", role: "research_coordinator", route: "/workflow/graduation", page: "Graduation Endorsement",
        do: "Drag the batch to Endorsement prep or revision and validate the research and practicum requirements in the dialog.",
        doneWhen: { status: from(GRADUATION_ORDER, "Eligibility Confirmed") },
        ifAsked: [{ q: "What if the research is not complete?", a: "The case shows Research Incomplete (or Practicum Incomplete) and does not move on until the requirement is met." }],
      },
      {
        id: "gr-prepare", title: "Staff prepare the list and send it to the Dean", role: "staff", route: "/workflow/graduation", page: "Graduation Endorsement",
        do: "Open View details on the batch and select Prepare endorsement list, then drag the batch to Dean review and send the endorsement list.",
        doneWhen: { status: from(GRADUATION_ORDER, "Ready for Dean Review") },
        ifAsked: [{ q: "Why is Prepare endorsement list a button and not a drag?", a: "It does not change the column. Steps that stay in the same column are buttons in the batch View details window." }],
      },
      {
        id: "gr-dean", title: "The Dean approves and exports", role: "dean", route: "/dean/approvals/graduation", page: "Graduation Endorsement (Dean)",
        do: "Open the Endorsement batches tab, drag the batch to Approved, ready to export and approve; then select Export approved list in View details.",
        doneWhen: { status: from(GRADUATION_ORDER, "Dean Approved") },
        branches: [{ status: ["Returned for Revision"], goto: "gr-revise", note: "The Dean returned the list for revision. Staff correct it and send it again." }],
        rule: "Only the Dean approves the endorsement list and exports the CSV.",
        ifAsked: [
          { q: "Does the portal email the Registrar?", a: "No. The Dean emails the downloaded CSV to the Registrar and waits for the acknowledgement; the screens only show Exported - Ready to Send." },
          { q: "Can the Dean send the list back?", a: "Yes: Return for revision, from the same Dean decision window." },
        ],
      },
      {
        id: "gr-result", title: "The student sees Dean Approved", role: "student", route: "/student/graduation", page: "Graduation Endorsement",
        do: "Sign in as the student: the status is Dean Approved, steps 1 to 5 are Completed and step 6 waits for the Dean's email to the Registrar.",
        doneWhen: "manual",
        ifAsked: [{ q: "Who sends the list to the Registrar?", a: "The Dean, outside the portal. Step 6 stays Pending review because the portal does not send that email." }],
      },
      RESEND("gr-resend", "/student/graduation", "Graduation Endorsement", undefined, { title: "Send a corrected application", do: "Read the staff message, choose the corrected signed PDF and select Resubmit graduation application, then Send request.", doneWhen: { status: from(GRADUATION_ORDER, "For Review") } }),
      {
        id: "gr-revise", side: true, title: "Staff correct the list and send it again", role: "staff", route: "/workflow/graduation", page: "Graduation Endorsement",
        do: "Read the Dean's comment, correct the endorsement list, select Prepare endorsement list again and send it to the Dean.",
        doneWhen: { status: from(GRADUATION_ORDER, "Ready for Dean Review") },
        ifAsked: [{ q: "Does the batch start over?", a: "No. It stays in Endorsement prep or revision until staff send the corrected list." }],
      },
    ],
  },
];

// The ready-made demo students that the existing reset (POST /api/auth/demo-students/<key>/reset) knows, by student number.
export const RESET_KEYS = {
  "GS-2026-LOA-01": "leave-of-absence-maureen",
  "GS-2026-LOA-02": "leave-of-absence-daniel",
  "GS-2026-READ-01": "readmission-therese",
  "GS-2026-READ-02": "readmission-gabriel",
  "GS-2026-AWOL-01": "awol-maya",
  "GS-2026-WD-01": "withdrawal-elena",
  "GS-2026-PRAC-02": "practicum-paolo",
  "GS-2026-GRAD-02": "graduation-carlo",
};

export const guideById = (id) => GUIDES.find((guide) => guide.id === id) || null;
