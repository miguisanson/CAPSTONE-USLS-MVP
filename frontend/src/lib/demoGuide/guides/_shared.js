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
//   actions   what the autopilot does on the page (lib/demoGuide/autopilot.js lists the action kinds and the target forms); the steps follow
//             the main path (the tested click paths of scripts/docs/walkthrough/capture/case_*.py), the side steps are the return and deny branches
// No pronouns for people anywhere in this file (owner rule): the role is named.

export const STAFF = { who: "Graduate School staff", label: "Graduate School staff", email: "staff@usls.edu.ph" };
export const DEAN = { who: "the Dean", label: "the Dean", email: "dean@usls.edu.ph" };
export const ACADEMIC = { who: "the Academic Coordinator", label: "the Academic Coordinator", email: "academic@usls.edu.ph" };
export const RESEARCH = { who: "the Research Coordinator", label: "the Research Coordinator", email: "research@usls.edu.ph" };

export const from = (order, status) => order.slice(order.indexOf(status));

export const LEAVE_ORDER = ["Submitted", "Staff Review", "Dean Review", "Leave Scheduled", "On Leave", "Return Due", "Approved", "Closed", "Expired"];
export const READMISSION_ORDER = ["Submitted", "Staff Review", "Dean Review", "Approved", "Closed"];
export const WITHDRAWAL_ORDER = ["Submitted to GS Staff", "Dean Review", "Approved - Awaiting Subject Tag", "Subject Tagged - Registrar Preparation", "Exported - Ready to Send", "Sent to Registrar", "Withdrawn Confirmed"];
export const PRACTICUM_ORDER = ["MOA Submitted", "MOA Under Review", "Practicum In Progress", "Hours Incomplete", "Documents Submitted", "Documents Under Review", "Additional Certificates Requested", "Completed", "Report Sent to Dean", "Dean Reviewed"];
export const GRADUATION_ORDER = ["For Review", "Coursework Review", "Research Review", "Eligibility Confirmed", "Endorsement Prepared", "Ready for Dean Review", "Dean Approved"];
export const AWOL_ORDER = ["Return Submitted", "Dean Review", "Return Approved", "Extension Approved - Refresher Required", "Re-enrollment Required", "Re-enrollment Completed"];

export const RESEND = (id, route, page, say, extra = {}) => ({
  id,
  side: true,
  title: "Correct it and send it again",
  role: "student",
  route,
  page,
  say,
  do: "Read the comment, change what it asks for, and send the request again. It goes back to Graduate School staff.",
  target: 'main form button[type="submit"]',
  // Autopilot sends the form as it stands (the earlier answers are still in it); the presenter takes over to change what the comment asks for.
  actions: [{ click: "submit" }, { click: { role: "button", name: "Send request", in: "dialog" } }],
  doneWhen: "manual",
  ifAsked: [{ q: "Does the student start over?", a: "No. The same request comes back with the comment. After it is sent again it returns to Submitted and the earlier steps are repeated." }],
  ...extra,
});

export const DENIED = (id, route, page, say) => ({
  id,
  side: true,
  title: "Not approved",
  role: "student",
  route,
  page,
  say,
  do: "Show the student's page: the request is marked as not approved and the Dean's note explains why. This is the end of this script; reset the demo student to run it again.",
  actions: [{ pause: 1500, caption: "Showing the notice the student sees" }],
  doneWhen: "manual",
  ifAsked: [{ q: "What can the student do after a denial?", a: "Graduate School staff tell the student what to do next. A new request can be filed if the reason no longer applies." }],
});

// Guides for a screen or a process that keeps no case row ask the server for no record: GET /api/demo/guide-state only knows the
// slug "reports" for that (it answers `case: null`), and every step says when it is done by route or by the write that came back 2xx.
export const NO_CASE = "reports";
