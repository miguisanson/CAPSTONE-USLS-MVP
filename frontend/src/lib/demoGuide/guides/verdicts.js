import { STAFF, NO_CASE } from "./_shared.js";

const FIND = [
  { type: { label: "Search requests" }, text: "Miguel", optional: true },
  { wait: { role: "button", name: "Open the Research Gate record of Miguel Yu" }, timeout: 20000 },
];

export default {
  id: "verdicts",
  process: NO_CASE,
  title: "Verdicts",
  summary: "After a defense, Graduate School staff record the panel's verdict from the student's card, with a reason; the verdict is stamped as recorded for the panel and the student moves to the next stage.",
  studentNumber: "2260004",
  walkthrough: "16_verdicts",
  accounts: { staff: STAFF },
  steps: [
    {
      id: "vd-card", title: "The card that waits for a verdict", role: "staff", route: "/workflow/research-gate", page: "Research Gate",
      do: "Open Research Gate and search the student. The card is in Title Defense with the booked defense and the line Next: Panel chair. The panel chair can record the verdict from the Faculty Portal; when the chair cannot, staff record it for the panel.",
      actions: [...FIND, { pause: 2500, caption: "The defense is booked; the verdict is the next thing to record" }],
      doneWhen: "manual",
      rule: "A verdict can be recorded only for a defense that has taken place; the demonstration skips the date wait.",
      ifAsked: [
        { q: "Does the panel chair have to sign in?", a: "No. The chair can record the verdict in the Faculty Portal, but staff and the Research Coordinator can record it for the panel from the card. Either way the verdict names who recorded it." },
        { q: "What are the possible verdicts?", a: "Approved moves the student on; Deferred means the defense did not take place and is rescheduled; Disapproved means a new title set or a re-defense." },
      ],
    },
    {
      id: "vd-record", title: "Record the verdict for the panel", role: "staff", route: "/workflow/research-gate", page: "Research Gate",
      do: "Select Record for the panel. Choose the verdict, enter the title the panel selected, give the reason for recording it for the panel, and select Record for the panel.",
      actions: [
        ...FIND,
        { click: { role: "button", name: "Record the verdict for the panel for Miguel Yu" } },
        { wait: { text: "Record the verdict for the panel" }, timeout: 20000 },
        { select: { label: "Verdict", in: "dialog" }, label: "Approved" },
        { type: { label: "Remarks or conditions", in: "dialog" }, text: "Title approved as submitted." },
        { type: { label: "Title selected by the panel", in: "dialog" }, text: "Learning Analytics Feedback Dashboards and the Engagement of Working Graduate Students in Blended Courses" },
        { type: { label: "Why are you recording this for the panel", in: "dialog" }, text: "The panel chair sent the result by email." },
        { click: { role: "button", name: "Record for the panel", exact: true, in: "dialog" } },
        { gone: { css: "[role=\"dialog\"]" }, timeout: 30000 },
      ],
      doneWhen: { apiWrite: "POST /research-gate/*/verdict" },
      rule: "Recording for the panel always needs a reason of at least five characters; it is saved in the history.",
      ifAsked: [{ q: "Can the verdict be corrected?", a: "Yes, with Correct verdict and a reason, until the student or staff have built on it. The first entry stays in the history." }],
    },
    {
      id: "vd-after", title: "The student moves on and the stamp stays", role: "staff", route: "/workflow/research-gate", page: "Research Gate",
      do: "Search the student again: the card is now in the Proposal Defense column and carries the stamp Recorded by Graduate School staff for the panel. The chair, the adviser and the student see the same stamp.",
      actions: [...FIND, { pause: 3000, caption: "The card moved to Proposal Defense" }],
      doneWhen: "manual",
      ifAsked: [{ q: "Who is told?", a: "The student and the adviser are notified, and the panel chair can still correct the verdict." }],
    },
  ],
};
