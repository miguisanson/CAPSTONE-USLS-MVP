import { STAFF, DEAN, ACADEMIC, RESEARCH, from, GRADUATION_ORDER, RESEND } from "./_shared.js";

export default {
  id: "graduation",
  process: "graduation",
  title: "Graduation",
  summary: "An eligible student applies, staff create a batch, the coordinators check it, the Dean approves and exports the list.",
  studentNumber: "GS-2026-GRAD-02",
  walkthrough: "19_graduation",
  accounts: {
    student: { who: "the student", label: "Carlo Mendoza", email: "graduation.carlo@usls.edu.ph" },
    staff: STAFF,
    academic_coordinator: ACADEMIC,
    research_coordinator: RESEARCH,
    dean: DEAN,
  },
  steps: [
    {
      id: "gr-file", title: "The student sends the graduation application", role: "student", route: "/student/graduation", page: "Graduation Endorsement",
      do: "Choose the open school year, choose the signed application PDF, add a remark and select Submit graduation application, then Send request.",
      doneWhen: { status: from(GRADUATION_ORDER, "For Review") },
      branches: [{ status: ["Returned for Clarification"], goto: "gr-resend", note: "Staff returned the application for clarification. The student sends a corrected PDF." }],
      rule: "Only students whose coursework and research (and a practicum when the program needs one) are complete are listed.",
      ifAsked: [
        { q: "Why are the other school years grey?", a: "Only the open school year can be selected." },
        { q: "Is being eligible enough?", a: "No. Batch creation waits until the signed application PDF is on file." },
      ],
    },
    {
      id: "gr-batch", title: "Staff create the batch", role: "staff", route: "/workflow/graduation", page: "Graduation Endorsement",
      do: "Drag the card from Application submitted to Batch created, set the batch number, month and year, create it, then drag the batch to Coursework review.",
      doneWhen: { status: from(GRADUATION_ORDER, "Coursework Review") },
      rule: "A drop opens the same window as the button and the server checks the rules again.",
      ifAsked: [
        { q: "What if the PDF has the wrong name or number?", a: "Staff select Message / Return and return it for clarification with Have student resubmit document ticked; the original PDF stays in the file history." },
        { q: "Can any card be dragged anywhere?", a: "No. A card moves one column at a time, only to the column its next step leads to." },
      ],
    },
    {
      id: "gr-coursework", title: "The Academic Coordinator checks coursework", role: "academic_coordinator", route: "/workflow/graduation", page: "Graduation Endorsement",
      do: "Drag the batch from Coursework review to Research and practicum check, open View coursework completed if asked, and confirm.",
      doneWhen: { status: from(GRADUATION_ORDER, "Research Review") },
      ifAsked: [{ q: "What does the Coordinator verify?", a: "That the coursework of each candidate is complete. The system already lists only candidates whose coursework is done." }],
    },
    {
      id: "gr-research", title: "The Research Coordinator checks research", role: "research_coordinator", route: "/workflow/graduation", page: "Graduation Endorsement",
      do: "Drag the batch to Endorsement prep or revision and validate the research and practicum requirements in the dialog.",
      doneWhen: { status: from(GRADUATION_ORDER, "Eligibility Confirmed") },
      ifAsked: [{ q: "What if the research is not complete?", a: "The case shows Research Incomplete (or Practicum Incomplete) and does not move on until the requirement is met." }],
    },
    {
      id: "gr-prepare", title: "Staff prepare the list and send it to the Dean", role: "staff", route: "/workflow/graduation", page: "Graduation Endorsement",
      do: "Open View details on the batch and select Prepare endorsement list, then drag the batch to Dean review and send the endorsement list.",
      doneWhen: { status: from(GRADUATION_ORDER, "Ready for Dean Review") },
      ifAsked: [{ q: "Why is Prepare endorsement list a button and not a drag?", a: "It does not change the column. Steps that stay in the same column are buttons in the batch View details window." }],
    },
    {
      id: "gr-dean", title: "The Dean approves and exports", role: "dean", route: "/dean/approvals/graduation", page: "Graduation Endorsement (Dean)",
      do: "Open the Endorsement batches tab, drag the batch to Approved, ready to export and approve; then select Export approved list in View details.",
      doneWhen: { status: from(GRADUATION_ORDER, "Dean Approved") },
      branches: [{ status: ["Returned for Revision"], goto: "gr-revise", note: "The Dean returned the list for revision. Staff correct it and send it again." }],
      rule: "Only the Dean approves the endorsement list and exports the CSV.",
      ifAsked: [
        { q: "Does the portal email the Registrar?", a: "No. The Dean emails the downloaded CSV to the Registrar and waits for the acknowledgement; the screens only show Exported - Ready to Send." },
        { q: "Can the Dean send the list back?", a: "Yes: Return for revision, from the same Dean decision window." },
      ],
    },
    {
      id: "gr-result", title: "The student sees Dean Approved", role: "student", route: "/student/graduation", page: "Graduation Endorsement",
      do: "Sign in as the student: the status is Dean Approved, steps 1 to 5 are Completed and step 6 waits for the Dean's email to the Registrar.",
      doneWhen: "manual",
      ifAsked: [{ q: "Who sends the list to the Registrar?", a: "The Dean, outside the portal. Step 6 stays Pending review because the portal does not send that email." }],
    },
    RESEND("gr-resend", "/student/graduation", "Graduation Endorsement", undefined, { title: "Send a corrected application", do: "Read the staff message, choose the corrected signed PDF and select Resubmit graduation application, then Send request.", doneWhen: { status: from(GRADUATION_ORDER, "For Review") } }),
    {
      id: "gr-revise", side: true, title: "Staff correct the list and send it again", role: "staff", route: "/workflow/graduation", page: "Graduation Endorsement",
      do: "Read the Dean's comment, correct the endorsement list, select Prepare endorsement list again and send it to the Dean.",
      doneWhen: { status: from(GRADUATION_ORDER, "Ready for Dean Review") },
      ifAsked: [{ q: "Does the batch start over?", a: "No. It stays in Endorsement prep or revision until staff send the corrected list." }],
    },
  ],
};
