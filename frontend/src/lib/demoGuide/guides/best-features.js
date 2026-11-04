import { STAFF, NO_CASE } from "./_shared.js";

// The two-minute tour of the five features (case 21). It only opens screens and asks one question; nothing is filed. The pages of the
// research gate, panel matching and defense scheduling are only shown, never driven, so their own guides can come later.
const OPEN = (link) => [{ click: { role: "link", name: link } }];

export default {
  id: "best-features",
  process: NO_CASE,
  title: "Best features tour",
  summary: "Two minutes: rules with a source, a cited policy answer, panel matching that explains itself, scheduling that checks first, and boards computed from records.",
  walkthrough: "21_best_features",
  accounts: { staff: STAFF },
  steps: [
    {
      id: "bf-rules", title: "1. Rules with a source", role: "staff", route: "/business-rules", page: "Business Rules",
      say: "best-features-01",
      do: "Business Rules: every rule the workflows follow, with the Handbook page it comes from and whether the system enforces it. Search a topic and the matching rules come up.",
      actions: [{ type: { label: "Search rules" }, text: "withdraw" }, { pause: 1500 }],
      doneWhen: "manual",
      ifAsked: [{ q: "Where can a panelist read a rule's source?", a: "On every rule: the document and the page. Rules set by the Handbook or the Research Protocol are locked." }],
    },
    {
      id: "bf-assistant", title: "2. A policy answer that names its source", role: "staff", route: "/assistant", page: "Policy Assistant",
      say: "best-features-03",
      do: "Policy Assistant: ask a question and the answer names the document and page it used. Without an AI key it is labelled Offline answer.",
      actions: [
        ...OPEN("Policy Assistant"),
        { type: { label: "Your question" }, text: "Adding a subject is allowed until when?" },
        { click: { role: "button", name: "Send question" } },
        { pause: 700 },
        { gone: { text: "Looking through the policy documents" }, timeout: 40000 },
      ],
      doneWhen: "manual",
      ifAsked: [{ q: "What if the library has no answer?", a: "The assistant says the policy documents do not cover it instead of guessing." }],
    },
    {
      id: "bf-matching", title: "3. Panel matching that explains itself", role: "staff", route: "/workflow/panel-matching", page: "Panel Matching",
      say: "best-features-05",
      do: "Panel Matching: each faculty member gets a score out of 100 from expertise, availability and workload, with the breakdown on screen. A person still makes the final choice.",
      actions: [...OPEN("Panel Matching"), { pause: 2500, caption: "Showing Panel Matching" }],
      doneWhen: "manual",
      ifAsked: [{ q: "Is the match an AI decision?", a: "No. It is a score from the expertise records, the availability and the workload; the Research Coordinator chooses." }],
    },
    {
      id: "bf-scheduling", title: "4. Scheduling that checks before it books", role: "staff", route: "/workflow/defense-scheduling", page: "Defense Scheduling",
      say: "best-features-07",
      do: "Defense Scheduling: it reads everyone's availability and suggests the best shared times. Hard stops cannot be overridden; warnings need a reason on record.",
      actions: [...OPEN("Defense Scheduling"), { pause: 2500, caption: "Showing Defense Scheduling" }],
      doneWhen: "manual",
      ifAsked: [{ q: "What is a hard stop?", a: "A double-booked panelist or room, a declined invitation or a slot in the past. A warning, such as a short lead time, can be overridden with a recorded reason." }],
    },
    {
      id: "bf-boards", title: "5. Shared boards and computed reports", role: "staff", route: "/workflow/leave-of-absence", page: "Leave of Absence",
      say: "best-features-09",
      do: "Leave, readmission, AWOL, withdrawal, practicum and graduation run on the same kind of board, and every move is recorded. Reports are built from those records.",
      actions: [...OPEN("Leave of Absence"), { pause: 2200, caption: "Showing a shared board" }, ...OPEN("Reports & Analytics"), { pause: 2200, caption: "Showing the reports" }],
      doneWhen: "manual",
      ifAsked: [{ q: "Is anything in the reports typed in by hand?", a: "No. Every figure is computed from the recorded transactions." }],
    },
    {
      id: "bf-close", title: "The common thread and the limits", role: "staff", route: "/reports", page: "Reports & Analytics",
      say: "best-features-11",
      do: "Each feature takes data the Graduate School already has, adds the policy behind it, and turns it into a decision, a warning or a measurement. The limits are stated plainly: no e-mail is sent, Google Calendar is optional, official data comes only from AIMS.",
      actions: [{ pause: 2500, caption: "Closing" }],
      doneWhen: "manual",
      ifAsked: [{ q: "What is not built?", a: "E-mail from the portal, a required Google connection, and any edit of official AIMS data. The Operations Manual stays a Draft until the Graduate School validates it." }],
    },
  ],
};
