import { STAFF, NO_CASE } from "./_shared.js";

export default {
  id: "calendars",
  process: NO_CASE,
  title: "Calendars",
  summary: "The defense calendar for staff, My Calendar and My Availability for a faculty member, and the Research Calendar for a student.",
  walkthrough: "15_calendars",
  accounts: {
    staff: STAFF,
    faculty: { who: "a faculty member", label: "Dr. Angela Cruz", email: "angela.cruz@usls.edu.ph" },
    student: { who: "the student", label: "Miguel Yu", email: "student@usls.edu.ph" },
  },
  steps: [
    {
      id: "cal-staff", title: "Staff see every defense on one calendar", role: "staff", route: "/workflow/defense-scheduling", page: "Defense Scheduling",
      do: "Open 7 - Defense Scheduling and its Calendar tab: every booked defense with its date, venue and panel, and the deadlines such as the 14-day rule.",
      actions: [{ click: { role: "tab", name: "Calendar" }, optional: true }, { pause: 2000, caption: "Showing the defense calendar" }],
      doneWhen: "manual",
      ifAsked: [{ q: "Can staff share the calendar?", a: "Yes. Create my private link gives an address that any calendar app can subscribe to; anyone with the link can see it, so it is not to be shared widely." }],
    },
    {
      id: "cal-faculty", title: "A faculty member's own calendar", role: "faculty", route: "/faculty-portal/calendar", page: "My Calendar",
      do: "The faculty member sees only the defenses where the panel includes the faculty member or an advisee, with the working hours shaded and the choice of Month, Week or Agenda.",
      actions: [{ click: { role: "button", name: "Month", exact: true }, optional: true }, { pause: 1800, caption: "Showing My Calendar" }],
      doneWhen: "manual",
      ifAsked: [{ q: "Can a faculty member decline a defense?", a: "Selecting a defense offers I cannot attend this defense, which sends a reason to the Research Coordinator." }],
    },
    {
      id: "cal-google", title: "Google Calendar is optional", role: "faculty", route: "/faculty-portal/calendar", page: "My Calendar",
      do: "Select Connect Google Calendar. This server has no Google keys, so a preview opens that says how the calendar would be used: free and busy times only. Not now closes it.",
      actions: [
        { click: { role: "button", name: "Connect Google Calendar" } },
        { wait: { text: "Integration preview" }, timeout: 10000 },
        { pause: 2200, caption: "Reading how the calendar would be used" },
        { click: { role: "button", name: "Not now", in: "dialog" } },
      ],
      doneWhen: "manual",
      ifAsked: [{ q: "What does the system read from Google?", a: "Only whether a time is free or busy. It creates, changes and removes only the defense events it scheduled itself." }],
    },
    {
      id: "cal-availability", title: "Availability is entered by the faculty member", role: "faculty", route: ["/faculty-portal", "/faculty-portal/availability"], page: "My Availability",
      do: "Open My Availability: weekly hours, specific dates when the faculty member is not available, and the requests from the Graduate School. Staff use these entries when looking for a shared date.",
      actions: [{ click: { role: "link", name: "My Availability" } }, { pause: 1800, caption: "Showing My Availability" }],
      doneWhen: "manual",
      ifAsked: [{ q: "Does a busy time block a booking?", a: "A panelist who is double-booked is a hard stop. A short lead time is a warning that needs a recorded reason." }],
    },
    {
      id: "cal-student", title: "The student's Research Calendar", role: "student", route: "/student/calendar", page: "Research Calendar",
      do: "The student sees the next defense, the next deadlines and, when a defense is moved, a notice with the old and the new time.",
      actions: [{ pause: 2000, caption: "Showing the Research Calendar" }],
      doneWhen: "manual",
      ifAsked: [{ q: "How does a student request a defense date?", a: "From the Defense Schedule page, with Request a defense schedule. Staff then book it from the calendar." }],
    },
  ],
};
