import { STAFF, DEAN, from, READMISSION_ORDER, RESEND, DENIED } from "./_shared.js";

export default {
  id: "readmission",
  process: "readmission",
  title: "Readmission",
  summary: "A student on leave asks to come back, staff verify the return checklist, the Dean approves.",
  studentNumber: "2690901",
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
      actions: [
        { select: "#readmission-term", label: "AY 2026-2027 2nd Semester" },
        { type: "#readmission-intent", text: "My leave is ending and I am ready to resume thesis work with my adviser. My study plan is updated and I have no pending accountability." },
        { click: "submit" },
        { click: { role: "button", name: "Send request", in: "dialog" } },
      ],
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
      actions: [
        { click: { role: "button", name: "Move to", in: { css: "[data-card-id]", text: "Therese Lacson" } } },
        { click: { role: "menuitem", name: "In staff review" } },
        { pause: 900 },
      ],
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
      actions: [
        { click: { role: "button", name: "View details for Therese Lacson" } },
        { click: { role: "button", name: "Forward to Dean", in: "dialog" } },
        { check: { role: "checkbox", in: "dialog", nth: 0 } },
        { check: { role: "checkbox", in: "dialog", nth: 1 } },
        { type: { css: "textarea", in: "dialog" }, text: "Business Office clearance and interview done. Forwarded for the Dean's decision." },
        { click: { role: "button", name: "Forward to Dean", exact: true, in: "dialog" } },
        { click: { role: "button", name: "Close details" }, optional: true },
      ],
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
      actions: [
        { click: { role: "button", name: "Move to", in: { css: "[data-card-id]", text: "Therese Lacson" } } },
        { click: { role: "menuitem", name: "Approved - back in the program" } },
        { type: { css: "textarea", in: "dialog" }, text: "Approved. The Academic Coordinator will plan the enrollment for the return semester." },
        { click: { role: "button", name: "Approve", exact: true, in: "dialog" } },
      ],
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
      actions: [{ pause: 1500, caption: "Showing the student's page" }],
      doneWhen: "manual",
      ifAsked: [{ q: "How does the Registrar learn about it?", a: "From the Registrar list at the bottom of the Readmission board: Pending Handoff, then Sent to Registrar, then acknowledged. Staff download it and email it." }],
    },
    RESEND("re-resend", "/student/requests/readmission", "Readmission", "readmission-03", { doneWhen: { status: from(READMISSION_ORDER, "Submitted") } }),
    DENIED("re-denied", "/student/requests/readmission", "Readmission", "readmission-18"),
  ],
};
