import { STAFF, from } from "./_shared.js";

export default {
  id: "monitoring",
  process: "monitoring",
  title: "Monitoring Sheet",
  summary: "Add a student, add and edit subject rows, read the change history, see how imported values are protected.",
  studentNumber: "2260073",
  walkthrough: "05_monitoring_sheet",
  accounts: { staff: STAFF },
  steps: [
    {
      id: "ms-open", title: "Open the Monitoring Sheet", role: "staff", route: "/monitoring-sheet", page: "Monitoring Sheet",
      say: "monitoring-sheet-01",
      do: "Open Monitoring Sheet under Records: one row per student, one column per subject.",
      doneWhen: { route: "/monitoring-sheet", roleIs: "staff" },
      ifAsked: [{ q: "Where do the values come from?", a: "The sheet is the curriculum record from the imported workbook. Grades, official enrollment and subject results stay in AIMS and are never entered here." }],
    },
    {
      id: "ms-student", title: "Add a student", role: "staff", route: "/monitoring-sheet", page: "Monitoring Sheet",
      say: "monitoring-sheet-02",
      do: "Select Add student, type the Student ID, the names and the school year, then add the student. A Student Portal login is created.",
      doneWhen: { apiWrite: "POST /monitoring/students" },
      rule: "The same required fields and duplicate checks as an import: a Student ID that exists is refused.",
      ifAsked: [
        { q: "Is a manual entry marked?", a: "Yes. Every portal entry carries the badge Manual entry, the staff member's name and the time." },
        { q: "What password does the new login get?", a: "The shared demonstration password. Real accounts are created by the Graduate School office." },
      ],
    },
    {
      id: "ms-subject", title: "Add a subject row", role: "staff", route: "/monitoring-sheet", page: "Monitoring Sheet",
      say: "monitoring-sheet-06",
      do: "In the student's record open Subjects, select Add on a subject, choose Completed, type the term and a remark, and save.",
      doneWhen: { apiWrite: "POST /monitoring/students/*/subjects" },
      ifAsked: [{ q: "Are grades entered here?", a: "No. Only the curriculum status of a subject, the term and a remark. Grades stay out of scope." }],
    },
    {
      id: "ms-history", title: "Read the change history", role: "staff", route: "/monitoring-sheet", page: "Monitoring Sheet",
      say: "monitoring-sheet-11",
      do: "Open the Change history tab: every add, change and removal with the old value, the new value, who made it and when.",
      doneWhen: "manual",
      ifAsked: [{ q: "Can a row be erased?", a: "No. Removing a row needs a reason, the row goes back to not taken, and the history keeps it." }],
    },
    {
      id: "ms-imported", title: "Imported values are protected", role: "staff", route: "/monitoring-sheet", page: "Monitoring Sheet",
      say: "monitoring-sheet-14",
      do: "Open the record of an imported student and select Edit on a subject: a reason is required, kept with the staff member's name.",
      doneWhen: "manual",
      ifAsked: [
        { q: "What if a later upload disagrees with a portal entry?", a: "It is held for review instead of overwriting the portal value." },
        { q: "Who can edit?", a: "Graduate School staff and the Academic Coordinator. The Research Coordinator and the Dean can view only." },
      ],
    },
  ],
};
