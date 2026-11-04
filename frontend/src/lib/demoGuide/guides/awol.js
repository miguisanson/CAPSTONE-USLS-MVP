import { STAFF, DEAN, from, AWOL_ORDER, RESEND, DENIED } from "./_shared.js";

export default {
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
};
