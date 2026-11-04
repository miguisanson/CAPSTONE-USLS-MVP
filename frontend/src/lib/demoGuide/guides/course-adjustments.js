import { STAFF, DEAN, ACADEMIC, NO_CASE } from "./_shared.js";

// The picks, then wait until the MAED subjects are on the page (the list of the program picked before is replaced a moment later).
const PICK = [
  { select: { label: "Program" }, label: "MAED" },
  { select: { label: "Academic year and semester" }, label: "2nd Semester (Next)" },
  { wait: { text: "MAED-MAJ1" } },
  { pause: 600 },
];

export default {
  id: "course-adjustments",
  process: NO_CASE,
  title: "Course Adjustments",
  summary: "The Academic Coordinator plans next semester's offerings from live demand, the Dean approves, the plan is published and given its schedule.",
  walkthrough: "03_course_adjustments",
  accounts: { academic_coordinator: ACADEMIC, dean: DEAN, staff: STAFF },
  steps: [
    {
      id: "ca-draft", title: "Plan the offerings from the demand", role: "academic_coordinator", route: "/course-adjustments", page: "Course Adjustments",
      do: "Choose the program and next semester. Every subject shows how many students need it; set two sections for the busiest one, offer one more subject by hand, and save the draft.",
      actions: [
        ...PICK,
        { click: { role: "button", name: "Start new draft" }, optional: true },
        { type: { label: "Sections for MAED-MAJ1" }, text: "2" },
        { click: { role: "button", name: "Offer MAED-COG10", exact: true }, optional: true },
        { click: { role: "button", name: "draft (" } },
        { wait: { text: "Draft saved" } },
      ],
      doneWhen: { apiWrite: "POST /course-adjustments/plan" },
      rule: "The numbers are decision support: nothing is offered, assigned or published until the Academic Coordinator saves, the Dean approves and the plan is published.",
      ifAsked: [
        { q: "Can a subject be offered when only one student needs it?", a: "Yes. The Academic Coordinator decides; the screen names every student who needs the subject." },
        { q: "Is the faculty member chosen by the system?", a: "The system only suggests. The Academic Coordinator owns every assignment." },
      ],
    },
    {
      id: "ca-submit", title: "Send the plan to the Dean", role: "academic_coordinator", route: "/course-adjustments", page: "Course Adjustments",
      do: "Select Submit for approval and confirm with Submit plan. The plan becomes read-only while it is with the Dean.",
      actions: [
        ...PICK,
        { click: { role: "button", name: "Submit for approval" } },
        { click: { role: "button", name: "Submit plan", in: "dialog" } },
        { wait: { text: "Submitted to Dean" } },
      ],
      doneWhen: "manual", // the draft, the submit and the publish all post the plan to the same path, so the write cannot tell the steps apart: the step waits for the page to say "Submitted to Dean"
      ifAsked: [{ q: "Can the plan still be edited?", a: "No. A draft save on a plan that is with the Dean is refused, so the list under approval cannot change by accident." }],
    },
    {
      id: "ca-approve", title: "The Dean approves the plan", role: "dean", route: "/dean/approvals/course-adjustments", page: "Course Adjustments (Dean)",
      do: "Read the MAED card, then select Approve and confirm. The note to the Academic Coordinator is optional when approving.",
      actions: [
        { click: { role: "button", name: "Approve", exact: true, in: "course-plan-MAED" } },
        { click: { role: "button", name: "Approve", exact: true, in: "dialog" } },
      ],
      doneWhen: { apiWrite: "POST /approvals/*/decide" },
      ifAsked: [
        { q: "What if the Dean returns it?", a: "Return for revision needs a note. The Academic Coordinator corrects the draft and sends it again." },
        { q: "Why is there another plan in the list?", a: "The seed leaves a plan of another program waiting. Only the MAED card is decided here." },
      ],
    },
    {
      id: "ca-publish", title: "Publish the approved plan", role: "academic_coordinator", route: "/course-adjustments", page: "Course Adjustments",
      do: "Select Publish and confirm with Publish plan. The published plan is the official offering list that Enrollment uses.",
      actions: [
        ...PICK,
        { click: { role: "button", name: "Publish", exact: true } },
        { click: { role: "button", name: "Publish plan", in: "dialog" } },
        { wait: { text: "Published on" } },
      ],
      doneWhen: "manual", // as above: the step waits for "Published on"
      ifAsked: [{ q: "What does publishing change?", a: "Enrollment lists only published subjects. No student's curriculum status changes." }],
    },
    {
      id: "ca-setup", title: "Give a subject its schedule and section", role: "academic_coordinator", route: "/course-adjustments", page: "Course Adjustments",
      do: "Open Offering setup, choose the program and semester, pick a class schedule and a section for MAED-MAJ1 and save.",
      actions: [
        { click: { role: "button", name: "Offering setup", exact: true } },
        { select: { label: "Program" }, label: "MAED" },
        { select: { label: "Semester" }, label: "2nd Semester (Next)" },
        { select: { label: "Schedule for MAED-MAJ1" }, index: 1 },
        { select: { label: "Section for MAED-MAJ1" }, label: "A" },
        { click: { role: "button", name: "Save all changes" } },
      ],
      doneWhen: { apiWrite: "PATCH /course-offerings/bulk" },
      ifAsked: [{ q: "Does the system check double-booked faculty?", a: "Not in this prototype: the schedule is chosen from the standard class slots." }],
    },
    {
      id: "ca-semesters", title: "Staff keep the semester calendar", role: "staff", route: "/term-settings", page: "Academic Semesters",
      do: "Open Academic Semesters under Overview. The semester marked Current carries the dates that every handbook window is counted from.",
      actions: [{ pause: 1500, caption: "Showing Academic Semesters" }],
      doneWhen: { route: "/term-settings", roleIs: "staff" },
      ifAsked: [{ q: "Why do the start dates matter?", a: "The withdrawal window (14 days) and the add-subject window (7 days) are counted from the semester start date, so a wrong date moves every deadline." }],
    },
  ],
};
