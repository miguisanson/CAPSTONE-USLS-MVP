import { STAFF, DEAN, from, WITHDRAWAL_ORDER, RESEND, DENIED } from "./_shared.js";

export default {
  id: "withdrawal",
  process: "withdrawal",
  title: "Subject Withdrawal",
  summary: "A student withdraws from one subject inside the handbook window, staff forward it, the Dean decides, staff tag the subject and export the Registrar list.",
  studentNumber: "2690401",
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
      actions: [
        { select: { label: "Enrolled subject" }, label: "MAED-MAJ1" },
        { type: { label: "Reason for withdrawing" }, text: "I need to revise my first-semester study load." },
        { click: "submit" },
        { click: { role: "button", name: "Send request", in: "dialog" } },
      ],
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
      actions: [
        { click: { role: "button", name: "View details for Elena Navarro" } },
        { click: { role: "button", name: "Record and forward to Dean", in: "dialog" } },
        { click: { role: "button", name: "Record and forward to Dean", in: "dialog" } },
        { click: { role: "button", name: "Close details" }, optional: true },
      ],
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
      actions: [
        { click: { role: "button", name: "View details for Elena Navarro" } },
        { click: { role: "button", name: "Approve the withdrawal", in: "dialog" } },
        { click: { role: "button", name: "Approve the withdrawal", in: "dialog" } },
        { click: { role: "button", name: "Close details" }, optional: true },
      ],
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
      actions: [
        { click: { role: "button", name: "View details for Elena Navarro" } },
        { click: { role: "button", name: "Tag the subject as Withdrawn", in: "dialog" } },
        { click: { role: "button", name: "Tag the subject as Withdrawn", in: "dialog" } },
        { click: { role: "button", name: "Close details" }, optional: true },
      ],
      doneWhen: { status: from(WITHDRAWAL_ORDER, "Subject Tagged - Registrar Preparation") },
      ifAsked: [
        { q: "Does the student receive a grade mark?", a: "No. The subject shows Withdrawn in Official Offered Subjects. Any W mark is applied by the Registrar; grades are out of scope for the portal." },
        { q: "Can the subject be reactivated?", a: "Not in the same semester: it is marked withdrawn and cannot be silently reactivated." },
      ],
    },
    {
      id: "wd-export", title: "Staff export the Registrar list", role: "staff", route: "/workflow/withdrawal", page: "Subject Withdrawal",
      do: "Scroll to the Registrar list, select Prepare Excel export, keep the student ticked and select Download Excel list. Staff then email the file to the Registrar.",
      actions: [
        { click: { role: "button", name: "Prepare Excel export" } },
        { click: { role: "button", name: "Download Excel list", in: "dialog" } },
        { click: { role: "button", name: "Got it" }, optional: true },
      ],
      doneWhen: { status: from(WITHDRAWAL_ORDER, "Exported - Ready to Send") },
      ifAsked: [
        { q: "Who tells the Registrar?", a: "A person. The portal prepares the Excel list and sends nothing; the status stays Exported - Ready to Send until the email is sent outside the portal." },
        { q: "Can the list hold several students?", a: "Yes. Every tagged withdrawal is listed with a tick box and one file covers the ticked ones." },
      ],
    },
    {
      id: "wd-result", title: "The student sees the result", role: "student", route: "/student/requests/withdrawal", page: "Subject Withdrawal",
      do: "Sign in as the student: the chip reads Exported - Ready to Send, the Dean decision reads Approved and the six steps are ticked.",
      actions: [{ pause: 1500, caption: "Showing the student's page" }],
      doneWhen: "manual",
      ifAsked: [{ q: "Where does the student read what happened?", a: "In View messages: each stage leaves a note that tells the student what happened." }],
    },
    RESEND("wd-resend", "/student/requests/withdrawal", "Subject Withdrawal", undefined, { doneWhen: { status: from(WITHDRAWAL_ORDER, "Submitted to GS Staff") } }),
    DENIED("wd-denied", "/student/requests/withdrawal", "Subject Withdrawal", undefined),
  ],
};
