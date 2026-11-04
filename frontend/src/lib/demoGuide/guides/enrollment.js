import { STAFF, NO_CASE } from "./_shared.js";

// The program and the semester that every step of this demo uses; the student list reloads a moment after the picks.
const PICK = [
  { select: { label: "Program" }, label: "MAED" },
  { select: { label: "Academic semester" }, label: "1st Semester (Current)" },
  { pause: 800 },
];

export default {
  id: "enrollment",
  process: NO_CASE,
  title: "Enrollment",
  summary: "Import a class list with a preview, see it on the roster, and enroll one student in a subject.",
  walkthrough: "04_enrollment",
  accounts: { staff: STAFF },
  steps: [
    {
      id: "en-open", title: "Open Enrollment", role: "staff", route: "/enrollment", page: "Enrollment",
      do: "Open 3 - Enrollment under Lifecycle workflows and choose the program and the semester. Enrollment assigns the official offerings to a student and keeps the class list, the Monitoring Sheet and the student's portal in step.",
      actions: [...PICK],
      doneWhen: "manual",
      rule: "A full-time load is 12 units and a part-time load 6 to 9 units; a load above that needs a documented exception (Graduate School Handbook p. 48).",
      ifAsked: [{ q: "Where do the offered subjects come from?", a: "From the plan the Dean approved and the Academic Coordinator published in Course Adjustments. Nothing else is offered." }],
    },
    {
      id: "en-import", title: "Import a class list, with a preview first", role: "staff", route: "/enrollment", page: "Enrollment",
      do: "Choose the class list file. A preview opens before any record changes: rows ready to import, rows already enrolled and rows that need review. Select Confirm import, then Done.",
      actions: [
        ...PICK,
        { upload: { label: "Upload class list" }, fixture: "enrollment-class-list.csv" },
        { wait: { text: "Preview class list" }, timeout: 20000 },
        { pause: 1500, caption: "Reading the preview" },
        { click: { role: "button", name: "Confirm import", in: "dialog" } },
        { wait: { text: "Class list imported" }, timeout: 20000 },
        { pause: 1200 },
        { click: { role: "button", name: "Done", in: "dialog" } },
      ],
      doneWhen: { apiWrite: "POST /enrollment/class-list-import" },
      rule: "Rows that need review are skipped and listed, never guessed: a student who is not on record, or a subject that is not in the curriculum.",
      ifAsked: [
        { q: "What if a row is wrong?", a: "It shows Needs review in the preview and is skipped on import. Nothing changes until Confirm import." },
        { q: "Can the same list be imported twice?", a: "Yes. Rows already enrolled are counted as Already enrolled and not added again." },
      ],
    },
    {
      id: "en-roster", title: "The same result on the class list", role: "staff", route: "/enrollment-class-list", page: "Enrollment Class List",
      do: "Open Enrollment Class List under Records. It is a read-only roster: the imported students appear under their subject. Changes are made in Enrollment, never here.",
      actions: [{ click: { role: "link", name: "Enrollment Class List" } }, { pause: 1800 }],
      doneWhen: { route: "/enrollment-class-list", roleIs: "staff" },
      ifAsked: [{ q: "Can the roster be edited?", a: "No. It is read-only so the class list always matches what Enrollment confirmed." }],
    },
    {
      id: "en-one", title: "Enroll one student", role: "staff", route: "/enrollment", page: "Enrollment",
      do: "Go back to Enrollment, choose the student, select Add on a subject that has not been taken, and select Confirm enrollment. The page confirms what was saved.",
      actions: [
        { click: { role: "link", name: "3 · Enrollment" } },
        ...PICK,
        { select: { css: "select", text: "Cruz, Daniel" }, label: "Cruz, Daniel" },
        { pause: 1800 },
        { click: { role: "button", name: "Add", exact: true } },
        { click: { role: "button", name: "Confirm enrollment" } },
        { wait: { text: "Enrollment saved" }, timeout: 20000 },
      ],
      doneWhen: { apiWrite: "POST /enrollment" },
      rule: "Adding a second subject after the first week of classes needs the written approval of the Associate Dean: the page stops and asks for a decision before anything is saved.",
      ifAsked: [
        { q: "What stops an overload?", a: "Above the normal load the page shows the rule and saves only with a documented exception." },
        { q: "Can a completed subject be added again?", a: "No. Completed and already enrolled subjects show a locked button." },
      ],
    },
  ],
};
