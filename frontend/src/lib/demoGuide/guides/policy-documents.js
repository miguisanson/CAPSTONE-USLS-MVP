import { STAFF, NO_CASE } from "./_shared.js";

const TITLE = "Walkthrough Memo - Lounge Reservation {stamp}";

export default {
  id: "policy-documents",
  process: NO_CASE,
  title: "Policy Documents",
  summary: "The library the Policy Assistant answers from: test a question, add a memo, see that the answer uses it, and remove it again.",
  walkthrough: "32_policy_documents",
  accounts: { staff: STAFF },
  steps: [
    {
      id: "pd-open", title: "Open the policy library", role: "staff", route: "/policy-documents", page: "Policy Documents",
      do: "Open Policy Documents under Monitoring & support. The Handbook and the Research Protocol are built in and view-only; the Operations Manual is a Draft until the Graduate School validates it.",
      actions: [{ pause: 1500, caption: "Showing the policy library" }],
      doneWhen: { route: "/policy-documents", roleIs: "staff" },
      ifAsked: [{ q: "What does Draft mean?", a: "The document is searched, but every assistant answer that uses it says it is pending Graduate School validation." }],
    },
    {
      id: "pd-test", title: "Test a question before anyone asks it", role: "staff", route: "/policy-documents", page: "Policy Documents",
      do: "Under Test a question, type a question and select Find passages: the passages found by keyword search, with an answer preview extracted without any AI.",
      actions: [
        { type: { label: "Question to test" }, text: "Can a student withdraw a subject on Day 1?" },
        { click: { role: "button", name: "Find passages" } },
        { wait: { text: "Answer preview" }, timeout: 20000 },
      ],
      doneWhen: "manual",
      ifAsked: [{ q: "Is the preview an AI answer?", a: "No. It is extracted from the passages so the office can check what the assistant would be given." }],
    },
    {
      id: "pd-add", title: "Add a memo", role: "staff", route: "/policy-documents", page: "Policy Documents",
      do: "Select Add document, choose the PDF, type its title, set the category to Memo, add a version note and select Upload and index. The file is read and indexed at once.",
      actions: [
        { click: { role: "button", name: "Add document", exact: true } },
        { upload: { label: "Choose a PDF or Word file", in: "dialog" }, fixture: "policy-memo-lounge.pdf" },
        { type: { label: "Document title", in: "dialog" }, text: TITLE },
        { select: { label: "Category", in: "dialog" }, label: "Memo" },
        { type: { label: "Version note", in: "dialog" }, text: "First upload for the demonstration" },
        { click: { role: "button", name: "Upload and index", in: "dialog" } },
        { wait: { text: "added to the Policy Assistant library" } },
      ],
      doneWhen: { apiWrite: "POST /policy-documents" },
      ifAsked: [
        { q: "Which files are accepted?", a: "PDF or Word files up to 20 MB. A scanned PDF is read with OCR when it is installed." },
        { q: "Can a built-in document be removed?", a: "No. Only staff uploads can be replaced or removed." },
      ],
    },
    {
      id: "pd-use", title: "The assistant now uses it", role: "staff", route: "/policy-documents", page: "Policy Documents",
      do: "Ask how many times a student organisation may reserve the lounge. The answer preview quotes the new memo, with its page.",
      actions: [
        { type: { label: "Question to test" }, text: "How many times may a student organisation reserve the Graduate School lounge per semester?" },
        { click: { role: "button", name: "Find passages" } },
        { wait: { text: "four (4) times" }, timeout: 20000 },
      ],
      doneWhen: "manual",
      ifAsked: [{ q: "What if the memo changes?", a: "Replace file uploads a new version. The old one stays in the version history and is no longer searched." }],
    },
    {
      id: "pd-remove", title: "Remove the memo", role: "staff", route: "/policy-documents", page: "Policy Documents",
      do: "Open the Actions menu on the memo, choose Remove and confirm with Remove document. The assistant stops using it at once.",
      actions: [
        { click: { role: "button", name: `Actions for ${TITLE}` } },
        { click: { role: "menuitem", name: "Remove" } },
        { click: { role: "button", name: "Remove document", in: "dialog" } },
      ],
      doneWhen: { apiWrite: "DELETE /policy-documents/*" },
      ifAsked: [{ q: "Can it be kept without being searched?", a: "Yes. Setting the status to Archived keeps the record without searching it." }],
    },
  ],
};
