import { STAFF, DEAN, NO_CASE } from "./_shared.js";

// Ask a question the way a person does: type it, send it, wait until the answer is on the page (the box shows a busy line meanwhile).
const ASK = (question) => [
  { type: { label: "Your question" }, text: question },
  { click: { role: "button", name: "Send question" } },
  { pause: 700 },
  { gone: { text: "Looking through the policy documents" }, timeout: 40000 },
];

export default {
  id: "policy-assistant",
  process: NO_CASE,
  title: "Policy Assistant",
  summary: "Ask the assistant a policy question as staff, a student, the Dean and a faculty member: every answer names the document and page it came from.",
  walkthrough: "08_policy_assistant",
  accounts: {
    staff: STAFF,
    student: { who: "the student", label: "Miguel Yu", email: "student@usls.edu.ph" },
    dean: DEAN,
    faculty: { who: "a faculty member", label: "Dr. Liwayway Bautista", email: "liwayway.bautista@usls.edu.ph" },
  },
  steps: [
    {
      id: "pa-ask", title: "Staff ask a policy question", role: "staff", route: "/assistant", page: "Policy Assistant",
      do: "Type the question and send it. The answer is taken from the Handbook and names its source.",
      actions: ASK("Can a student withdraw a subject on Day 1, and how much is the fee?"),
      doneWhen: { apiWrite: "POST /assistant" },
      ifAsked: [
        { q: "Is this an AI guess?", a: "No. The assistant finds passages in the policy documents by keyword and quotes the text. Without an AI key every answer is labelled Offline answer." },
        { q: "What if a panelist asks a different question?", a: "Take over and type it. The guide only follows the page." },
      ],
    },
    {
      id: "pa-source", title: "Open the source of the answer", role: "staff", route: "/assistant", page: "Policy Assistant",
      do: "Select the entry under Sources: the document, the section and the exact passage the answer was taken from. A Draft document is tagged every time it is used.",
      actions: [{ click: { css: '[role="log"] summary' } }, { pause: 1800 }],
      doneWhen: "manual",
      ifAsked: [{ q: "What is a Draft source?", a: "A document the Graduate School has not yet validated. Answers that use it say so." }],
    },
    {
      id: "pa-notcovered", title: "A question the library does not cover", role: "staff", route: "/assistant", page: "Policy Assistant",
      do: "Ask what is on the cafeteria menu. The assistant does not guess: it says the policy documents do not cover this and to ask the Graduate School office.",
      actions: [...ASK("What is the cafeteria menu today?"), { wait: { text: "Not covered by the policy documents" } }],
      doneWhen: "manual",
      ifAsked: [{ q: "Why not just answer?", a: "An invented answer about a rule is worse than none. The card says what to do next." }],
    },
    {
      id: "pa-student", title: "A student asks about the student's own situation", role: "student", route: "/student/assistant", page: "Policy Assistant (student)",
      do: "Ask whether a leave of absence can be filed in the last two weeks of the semester. The student's assistant sees only the policy documents and the student's own record.",
      actions: ASK("Can I file a leave of absence during the last two weeks of the semester?"),
      doneWhen: "manual",
      ifAsked: [{ q: "Can a student see other students?", a: "No. The student's assistant is private and read-only: it uses the record of the signed-in account only." }],
    },
    {
      id: "pa-dean", title: "The Dean asks about residence", role: "dean", route: "/dean/assistant", page: "Policy Assistant (Dean)",
      do: "Ask the maximum residence for a master's program. The Dean's assistant uses the policy documents and the Dean's own queue.",
      actions: ASK("What is the maximum residence for a master's program?"),
      doneWhen: "manual",
      ifAsked: [{ q: "Does the Dean's answer differ?", a: "The same documents are searched; only the personal suggestions differ, such as what is waiting for the Dean." }],
    },
    {
      id: "pa-faculty", title: "A faculty member asks about advising", role: "faculty", route: "/faculty-portal/assistant", page: "Policy Assistant (faculty)",
      do: "Ask how many advisees a faculty member can handle in a semester. The Handbook answer is five.",
      actions: ASK("How many advisees can a faculty member handle in a semester?"),
      doneWhen: "manual",
      ifAsked: [{ q: "Where is the limit written?", a: "In the Graduate School Handbook, among the factors the Dean, Associate Dean and Research Coordinator use to decide on an adviser." }],
    },
  ],
};
