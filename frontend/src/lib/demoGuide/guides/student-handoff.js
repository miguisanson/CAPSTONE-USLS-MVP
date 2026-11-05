import { STAFF, NO_CASE } from "./_shared.js";

const IMPORT = [
  { upload: { label: "Browse files" }, fixture: "handoff-msn-workbook.xlsx" },
  { click: { role: "button", name: "Import students" } },
  { wait: { text: "Imported" }, timeout: 60000 },
];

export default {
  id: "student-handoff",
  process: NO_CASE,
  title: "Student Handoff",
  summary: "New students arrive from the Registrar's monitoring sheet: import the workbook, see the upload kept, and see that importing it again changes nothing.",
  walkthrough: "33_student_handoff",
  accounts: { staff: STAFF },
  steps: [
    {
      id: "ho-open", title: "Open Student Handoff", role: "staff", route: "/workflow/student-handoff", page: "Student Handoff",
      do: "Open Student Handoff under Lifecycle workflows. The first panel imports a monitoring sheet; the Registrar's workbook is the way new students enter the platform.",
      actions: [{ pause: 1500, caption: "Showing Student Handoff" }],
      doneWhen: { route: "/workflow/student-handoff", roleIs: "staff" },
      ifAsked: [{ q: "Why not type new students in?", a: "Official student records come from the Registrar's AIMS export. The workbook import is the controlled way in; a student can also be added by hand on the Monitoring Sheet, marked as a manual entry." }],
    },
    {
      id: "ho-import", title: "Import the workbook", role: "staff", route: "/workflow/student-handoff", page: "Student Handoff",
      do: "Choose the monitoring sheet workbook and select Import students. The result counts the new students, the ones already in the system and the cells that changed; every new student gets a Student Portal login.",
      actions: IMPORT,
      doneWhen: { apiWrite: "POST /transactions/student-handoff/import" },
      rule: "Rows that need a decision are skipped and listed, never guessed.",
      ifAsked: [
        { q: "Where does the workbook come from?", a: "From the Registrar, one workbook per program, as the sample files of the demonstration." },
        { q: "What password do the new logins get?", a: "The shared demonstration password. Real accounts are created by the Graduate School office." },
      ],
    },
    {
      id: "ho-again", title: "Importing the same file again is safe", role: "staff", route: "/workflow/student-handoff", page: "Student Handoff",
      do: "Choose the same workbook and import it again: no student is added twice, and the result says how many were already in the system.",
      actions: IMPORT,
      doneWhen: "manual",
      ifAsked: [{ q: "What if the workbook disagrees with the record?", a: "The difference is held for a decision instead of overwriting the record." }],
    },
    {
      id: "ho-history", title: "Every upload is kept", role: "staff", route: "/workflow/student-handoff", page: "Student Handoff",
      do: "Select View upload history: each uploaded workbook is listed with its program, the number of students, the date and a Backup download.",
      actions: [{ click: { role: "button", name: "View upload history" } }, { pause: 1800 }],
      doneWhen: "manual",
      ifAsked: [{ q: "Can an old version be opened?", a: "Yes. The backup of every upload can be downloaded to review a conflict with the current record." }],
    },
    {
      id: "ho-report", title: "The onboarding report goes to the Dean", role: "staff", route: "/workflow/student-handoff", page: "Student Handoff",
      do: "Scroll to Onboarding report & Dean approval and select Refresh: each import batch is checked and reported to the Dean before it counts as an admission completion.",
      actions: [{ click: { role: "button", name: "Refresh", exact: true } }, { pause: 1800 }],
      doneWhen: "manual",
      ifAsked: [{ q: "Is the checklist ticked by hand?", a: "No. It is derived from the import." }],
    },
  ],
};
