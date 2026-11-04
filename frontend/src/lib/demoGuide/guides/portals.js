import { DEAN, NO_CASE } from "./_shared.js";

// A read-only tour of the three portals: nothing is filed, answered or saved. Each step opens one page through the sidebar, as a person would.
const LOOK = (link, caption) => [{ click: { role: "link", name: link } }, { pause: 1800, caption }];

export default {
  id: "portals",
  process: NO_CASE,
  title: "Portals tour",
  summary: "What the Dean, a faculty member and a student each see after signing in. Nothing is changed.",
  studentNumber: "2690601",
  walkthrough: "34_portals",
  accounts: {
    dean: DEAN,
    faculty: { who: "a faculty member", label: "Dr. Liwayway Bautista", email: "liwayway.bautista@usls.edu.ph" },
    student: { who: "the student", label: "Sofia Reyes", email: "handoff.sofia@usls.edu.ph" },
  },
  steps: [
    {
      id: "po-dean-home", title: "The Dean's dashboard", role: "dean", route: "/dean", page: "Dean Portal",
      do: "The Dean Portal opens on the Dashboard: the decisions waiting for the Dean, oldest first, each with a Review button.",
      actions: [{ pause: 1800, caption: "Showing the Dean's dashboard" }],
      doneWhen: "manual",
      ifAsked: [{ q: "What can the Dean change?", a: "Only decisions: approve, return or deny. Every decision is recorded against the Dean's account with the date and time." }],
    },
    {
      id: "po-dean-queue", title: "Every approval in one queue", role: "dean", route: ["/dean", "/dean/approvals"], page: "Approvals Queue",
      do: "Open Approvals Queue: every process that needs the Dean is grouped on this page, with filters for the program and the status.",
      actions: LOOK("Approvals Queue", "Opening the approvals queue"),
      doneWhen: "manual",
      ifAsked: [{ q: "Where do older decisions go?", a: "To the Activity Log: each decision with its date and status, newest first." }],
    },
    {
      id: "po-dean-reports", title: "Reports for the Dean", role: "dean", route: ["/dean", "/dean/analytics"], page: "Reports & Analytics (Dean)",
      do: "Open Reports & Analytics: waiting now, decided this week, the approval share and the decisions by process.",
      actions: LOOK("Reports & Analytics", "Opening the Dean's reports"),
      doneWhen: "manual",
      ifAsked: [{ q: "Are the numbers typed in?", a: "No. The figures are computed from the approval records." }],
    },
    {
      id: "po-faculty-home", title: "The faculty dashboard", role: "faculty", route: "/faculty-portal", page: "Faculty Portal",
      do: "The Faculty Portal opens on the Dashboard: what waits for the faculty member, such as a panel invitation, and whether Google Calendar is connected.",
      actions: [{ pause: 1800, caption: "Showing the faculty dashboard" }],
      doneWhen: "manual",
      ifAsked: [{ q: "Is the Google Calendar connection required?", a: "No. It is optional and per faculty member; without it the availability is the weekly hours entered in the portal." }],
    },
    {
      id: "po-faculty-advisees", title: "Advisees and the five-student limit", role: "faculty", route: ["/faculty-portal", "/faculty-portal/advisees"], page: "My Advisees",
      do: "Open My Advisees: how many of the five places are used, and each advisee's stage, documents and what needs a signature.",
      actions: LOOK("My Advisees", "Opening My Advisees"),
      doneWhen: "manual",
      ifAsked: [{ q: "Where does the limit come from?", a: "From the Handbook: at most five advisees per semester." }],
    },
    {
      id: "po-faculty-invitations", title: "Panel invitations", role: "faculty", route: ["/faculty-portal", "/faculty-portal/invitations"], page: "Panel Invitations",
      do: "Open Panel Invitations: each invitation names the student, the defense stage, the role and the other panel members, with Accept and Decline. The guide does not answer for the faculty member.",
      actions: LOOK("Panel Invitations", "Opening Panel Invitations"),
      doneWhen: "manual",
      ifAsked: [{ q: "What if the invitation is declined?", a: "The declined invitation is a hard stop for scheduling until another panelist is chosen." }],
    },
    {
      id: "po-student-home", title: "The student's dashboard", role: "student", route: "/student", page: "Student Portal",
      do: "The Student Portal opens on the Dashboard: the program, what needs the student's action and the lifecycle from Admission to Final Defense with the current step marked.",
      actions: [{ pause: 1800, caption: "Showing the student's dashboard" }],
      doneWhen: "manual",
      ifAsked: [{ q: "Can a student see other students?", a: "No. Every student page shows only the signed-in student's own record." }],
    },
    {
      id: "po-student-progress", title: "My Progress", role: "student", route: ["/student", "/student/progress"], page: "My Progress",
      do: "Open My Progress: the lifecycle strip, the coursework completion and every subject of the program with its status.",
      actions: LOOK("My Progress", "Opening My Progress"),
      doneWhen: "manual",
      ifAsked: [{ q: "Where do the statuses come from?", a: "From the official record imported from AIMS; the student cannot edit the statuses." }],
    },
    {
      id: "po-student-requests", title: "The Request Center", role: "student", route: ["/student", "/student/requests"], page: "Request Center",
      do: "Open Request Center: every request a student can file, with its status, in three groups: Research and Defense, Requests, and Completion.",
      actions: LOOK("Request Center", "Opening the Request Center"),
      doneWhen: "manual",
      ifAsked: [{ q: "Where are staff replies?", a: "Under Messages, filtered by process." }],
    },
  ],
};
