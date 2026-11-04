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

const from = (order, status) => order.slice(order.indexOf(status));

const LEAVE_ORDER = ["Submitted", "Staff Review", "Dean Review", "Leave Scheduled", "On Leave", "Return Due", "Approved", "Closed", "Expired"];
const READMISSION_ORDER = ["Submitted", "Staff Review", "Dean Review", "Approved", "Closed"];
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
];

// The ready-made demo students that the existing reset (POST /api/auth/demo-students/<key>/reset) knows, by student number.
export const RESET_KEYS = {
  "GS-2026-LOA-01": "leave-of-absence-maureen",
  "GS-2026-LOA-02": "leave-of-absence-daniel",
  "GS-2026-READ-01": "readmission-therese",
  "GS-2026-READ-02": "readmission-gabriel",
  "GS-2026-AWOL-01": "awol-maya",
};

export const guideById = (id) => GUIDES.find((guide) => guide.id === id) || null;
