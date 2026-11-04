import { STAFF, NO_CASE } from "./_shared.js";

const PICK = [
  { type: { css: 'input[placeholder*="Search all students"]' }, text: "Miguel", optional: true },
  { click: { text: "Miguel Yu" }, optional: true },
  { wait: { text: "Coordinate the defense schedule" }, timeout: 30000 },
];

export default {
  id: "defense-scheduling",
  process: NO_CASE,
  title: "Defense Scheduling",
  summary: "Staff check the student is ready, see when the whole panel is free, pick a shared slot and book the defense; the student and every panelist are told.",
  studentNumber: "2260004",
  walkthrough: "14_defense_scheduling",
  accounts: { staff: STAFF },
  steps: [
    {
      id: "ds-pick", title: "Readiness and the matched panel", role: "staff", route: "/workflow/defense-scheduling", page: "Defense Scheduling",
      do: "Open 7 - Defense Scheduling and choose the student. Student readiness lists what is verified and what is still open; Panel members shows the matched panel with each invitation.",
      actions: [...PICK, { pause: 2500, caption: "Readiness and the panel" }],
      doneWhen: "manual",
      rule: "Booking needs a matched panel and the stage requirements; staff can override the requirements only with a written reason.",
      ifAsked: [{ q: "Can a defense be booked before the panel accepts?", a: "Yes, while an invitation is only pending. A declined invitation blocks the booking until the seat is changed." }],
    },
    {
      id: "ds-overlap", title: "When the whole panel is free", role: "staff", route: "/workflow/defense-scheduling", page: "Defense Scheduling",
      do: "Availability overlap shades each half hour by how many of the panel are free; the darkest green means everyone. Best shared options lists the earliest slots where nobody has a clash, starting after the 14-day lead time.",
      actions: [...PICK, { click: { text: "Best shared options" }, optional: true }, { pause: 3000, caption: "The shared slots" }],
      doneWhen: "manual",
      rule: "Nobody is assumed free: a person who has not entered availability is shown as unchecked.",
      ifAsked: [{ q: "Where does availability come from?", a: "From the hours each person entered, or the connected Google Calendar. Staff can ask the panel to enter dates with Ask for availability." }],
    },
    {
      id: "ds-book", title: "Book the earliest shared slot", role: "staff", route: "/workflow/defense-scheduling", page: "Defense Scheduling",
      do: "Select Earliest option, add the venue and select Set defense schedule. The date, time and room are checked for clashes; the student and every panelist are told at once.",
      actions: [
        ...PICK,
        { wait: { text: "Best shared options" }, timeout: 30000 },
        { pause: 2500 },
        { click: { text: "Earliest option" } },
        { pause: 800 },
        { type: { label: "Venue / meeting link" }, text: "Graduate School Conference Room" },
        { type: { label: "Scheduling constraints" }, text: "Panel prefers a morning start." },
        { click: { role: "button", name: "Set defense schedule" } },
        { wait: { text: "This stage is already booked" }, timeout: 30000 },
      ],
      doneWhen: { apiWrite: "POST /transactions/defense-scheduling" },
      ifAsked: [{ q: "What if the date has to change?", a: "The booking is rescheduled or cancelled with a reason and who asked; both are kept in the schedule history." }],
    },
  ],
};
