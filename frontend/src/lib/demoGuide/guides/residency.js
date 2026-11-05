import { STAFF, NO_CASE } from "./_shared.js";

export default {
  id: "residency",
  process: NO_CASE,
  title: "Residency",
  summary: "A student writing a thesis without enrolling in subjects keeps good standing: staff check the policy and record the residency semester.",
  studentNumber: "2691101",
  walkthrough: "35_residency",
  accounts: { staff: STAFF },
  steps: [
    {
      id: "rs-open", title: "Open AWOL & Residency", role: "staff", route: "/workflow/awol", page: "AWOL & Residency",
      do: "Open AWOL & Residency under Standalone processes. The board runs from the cases flagged as AWOL to the Residency column, where no-subject semesters are recorded.",
      actions: [{ pause: 1500, caption: "Showing AWOL & Residency" }],
      doneWhen: { route: "/workflow/awol", roleIs: "staff" },
      ifAsked: [{ q: "Can AWOL be declared by hand?", a: "No. The system flags a student from the records; staff only review the written return. The dialog for Record residency says so." }],
    },
    {
      id: "rs-check", title: "Choose the student and run the policy check", role: "staff", route: "/workflow/awol", page: "AWOL & Residency",
      do: "Select Record residency, find the student, add a note and wait for the policy check. The purpose comes from the student's stage, the semester is the active one, and the result lists three checks.",
      actions: [
        { click: { role: "button", name: "Record residency", exact: true } },
        { type: { label: "Search a student", in: "dialog" }, text: "Valdez" },
        { click: { role: "button", name: "Nicolas Valdez", in: "dialog" } },
        { type: { label: "Staff notes", in: "dialog" }, text: "Thesis writing continues without subject enrollment; adviser confirmed progress this semester." },
        { wait: { text: "Eligible for Residency", in: "dialog" }, timeout: 20000 }, // in the window: the board behind it has the same chip
      ],
      doneWhen: "manual",
      rule: "A residency semester is allowed only with no subject enrollment, for a permitted purpose, and never as a substitute for a leave of absence.",
      ifAsked: [
        { q: "What if the student is enrolled in a subject?", a: "The check fails on No subject enrollment and Record residency stays unavailable." },
        { q: "What are the permitted purposes?", a: "Thesis or dissertation work, practicum or internship completion, the comprehensive examination, and waiting for a research publication." },
      ],
    },
    {
      id: "rs-record", title: "Record the residency", role: "staff", route: "/workflow/awol", page: "AWOL & Residency",
      do: "Select Record residency in the window. The page confirms that the student record, the queue and the monitoring indicators were updated.",
      actions: [
        { click: { role: "button", name: "Record residency", exact: true, in: "dialog" } },
        { wait: { text: "Saved." }, timeout: 20000 },
      ],
      doneWhen: { apiWrite: "POST /transactions/awol" },
      ifAsked: [{ q: "Can a residency be undone?", a: "It is closed from the card's window; the history of the card keeps both entries." }],
    },
    {
      id: "rs-card", title: "The card in the Residency column", role: "staff", route: "/workflow/awol", page: "AWOL & Residency",
      do: "Search the student's name: the card is in the Residency column with the purpose, the semester and the chip Eligible for Residency. View details shows the tracker.",
      actions: [
        { type: { label: "Search requests" }, text: "Nicolas" },
        { click: { role: "button", name: "View details for Nicolas Valdez" } },
        { wait: { text: "Residency active" }, timeout: 15000 },
        { pause: 1800 },
        { click: { role: "button", name: "Close details" }, optional: true },
      ],
      doneWhen: "manual",
      ifAsked: [{ q: "Where else does it show?", a: "In the Students directory the enrollment reads Residency and the standing stays Active; in the reports the semester is counted as a residency semester, not as an absence." }],
    },
  ],
};
