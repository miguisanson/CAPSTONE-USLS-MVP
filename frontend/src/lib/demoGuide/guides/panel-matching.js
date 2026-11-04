import { STAFF, NO_CASE } from "./_shared.js";

const PICK = [
  { type: { css: 'input[placeholder*="Search all students"]' }, text: "Miguel" },
  { click: { text: "Miguel Yu" } },
  { wait: { text: "Panel recommendation workspace" }, timeout: 30000 },
];

// Later steps pick the student again only when the page has lost the choice (a reload, a take-over).
const PICK_AGAIN = PICK.map((action) => ({ ...action, optional: true }));

export default {
  id: "panel-matching",
  process: NO_CASE,
  title: "Panel Matching",
  summary: "After Form 1 is endorsed, the system ranks the faculty by expertise, availability and workload, explains every score, and staff finalize the panel.",
  studentNumber: "2260004",
  walkthrough: "13_panel_matching",
  accounts: { staff: STAFF },
  steps: [
    {
      id: "pm-pick", title: "Choose the student and read the paper analysis", role: "staff", route: "/workflow/panel-matching", page: "Panel Matching",
      do: "Open 6 - Panel Matching and choose the student. The three concept papers are read for keywords; the page names the method used and the weights: expertise 60, availability 25, workload 15.",
      actions: [...PICK, { pause: 2500, caption: "The papers were read for keywords" }],
      doneWhen: "manual",
      rule: "A panel is matched only after the Academic Coordinator has endorsed Form 1.",
      ifAsked: [{ q: "Is the match made by an AI service?", a: "No. The method is a local keyword match between the papers and the faculty records. The page says which method ran." }],
    },
    {
      id: "pm-why", title: "Every score can be explained", role: "staff", route: "/workflow/panel-matching", page: "Panel Matching",
      do: "The faculty are ranked with a score out of 100. Select Why this score on the top row to see how the expertise, availability and workload points were built. The student's adviser is listed as not eligible.",
      actions: [
        ...PICK_AGAIN,
        { click: { role: "button", name: "Why this score" } },
        { pause: 3000, caption: "The evidence behind the score" },
        { click: { role: "button", name: "Hide why" }, optional: true },
      ],
      doneWhen: "manual",
      ifAsked: [{ q: "Can staff choose someone else?", a: "Yes. Each seat has a list; the system only suggests, and the composition rules are checked again on the server." }],
    },
    {
      id: "pm-final", title: "Finalize the panel", role: "staff", route: "/workflow/panel-matching", page: "Panel Matching",
      do: "The suggested panel is preselected: a chair, a content specialist and a method specialist. Check the composition rules and select Finalize selected panel. Each panel member is invited and can accept or decline.",
      actions: [
        ...PICK_AGAIN,
        { pause: 1500, caption: "The panel composition rules are all met" },
        { click: { role: "button", name: "Finalize selected panel" } },
        { wait: { role: "button", name: "Update final panel" }, timeout: 30000 },
      ],
      doneWhen: { apiWrite: "POST /transactions/panel-matching" },
      rule: "The seats must satisfy the Research Protocol: the adviser cannot sit on the panel, and every seat holds a different member.",
      ifAsked: [{ q: "What if a panelist declines?", a: "The decline shows on Defense Scheduling and no date can be booked until the seat is changed or the invitation is accepted again." }],
    },
  ],
};
