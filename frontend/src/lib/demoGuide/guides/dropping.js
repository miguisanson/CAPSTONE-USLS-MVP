import { ACADEMIC, STAFF, NO_CASE } from "./_shared.js";

const NOTE = "Registrar advice received: unexcused absences above the handbook limit.";

export default {
  id: "dropping",
  process: NO_CASE,
  title: "Dropping a Subject",
  summary: "The Academic Coordinator records a dropped subject only when unexcused absences pass 20%: the first try is refused with the rule, the second is accepted.",
  studentNumber: "2690402",
  walkthrough: "07_dropping",
  accounts: { academic_coordinator: ACADEMIC, staff: STAFF },
  steps: [
    {
      id: "dr-open", title: "Open the student's enrolled subjects", role: "academic_coordinator", route: "/enrollment", page: "Enrollment",
      do: "Open Enrollment, choose the program and the current semester, and choose the student. Each enrolled subject shows an Enrolled badge with a Change button.",
      actions: [
        { select: { label: "Program" }, label: "MAED" },
        { select: { label: "Academic semester" }, label: "1st Semester (Current)" },
        { pause: 800 },
        { select: { css: "select", text: "Lim, Joshua" }, label: "Lim, Joshua" },
        { wait: { role: "button", name: "Change MAED-MAJ2 student status" }, timeout: 20000 },
      ],
      doneWhen: "manual",
      ifAsked: [{ q: "Why is only Dropped offered?", a: "Withdrawal is deliberately not offered here: a student who wants to leave a subject files a Subject Withdrawal. A drop is the professor's decision for absences." }],
    },
    {
      id: "dr-refused", title: "A drop with too few absences is refused", role: "academic_coordinator", route: "/enrollment", page: "Enrollment",
      do: "Select Change on the subject, type 10 as the unexcused absences and the note, and select Save Dropped. The system refuses and shows the rule in red; nothing is saved.",
      actions: [
        { click: { role: "button", name: "Change MAED-MAJ2 student status" } },
        { type: "#drop-absence", text: "10" },
        { type: "#drop-note", text: NOTE },
        { click: { role: "button", name: "Save Dropped", in: "dialog" } },
        { wait: { text: "10% was entered" }, timeout: 20000 },
        { pause: 1800 },
      ],
      doneWhen: "manual",
      rule: "A subject can only be dropped when unexcused absences are more than 20% of the class hours (Graduate School Handbook p. 52).",
      ifAsked: [{ q: "What can the student do to leave the subject earlier?", a: "File a Subject Withdrawal, allowed until the end of the second week of classes (14 days, Handbook p. 49)." }],
    },
    {
      id: "dr-accepted", title: "Above the limit, the drop is recorded", role: "academic_coordinator", route: "/enrollment", page: "Enrollment",
      do: "Change the absences to 25 and select Save Dropped. The page confirms that the subject is now marked Dropped.",
      actions: [
        { type: "#drop-absence", text: "25" },
        { click: { role: "button", name: "Save Dropped", in: "dialog" } },
        { wait: { text: "is now marked Dropped" }, timeout: 20000 },
      ],
      doneWhen: { apiWrite: "PATCH /enrollment/subject-status" },
      ifAsked: [{ q: "Can the drop be undone?", a: "Not silently. A dropped subject cannot be reactivated in the same semester." }],
    },
    {
      id: "dr-sheet", title: "The Monitoring Sheet shows the same record", role: "staff", route: "/monitoring-sheet", page: "Monitoring Sheet",
      do: "Open Monitoring Sheet under Records: the subject's cell for the student now reads D for Dropped, while the other enrolled subjects still read R.",
      actions: [
        { select: { label: "Program" }, label: "MAED" },
        { pause: 1800, caption: "Looking for the dropped subject (D)" },
      ],
      doneWhen: { route: "/monitoring-sheet", roleIs: "staff" },
      ifAsked: [{ q: "Does the Registrar get told?", a: "The change appears in the daily Registrar changes list under Reports, so the Registrar can apply it in AIMS." }],
    },
  ],
};
