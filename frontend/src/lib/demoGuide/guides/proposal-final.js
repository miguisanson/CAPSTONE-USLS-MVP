import { STAFF, RESEARCH, NO_CASE } from "./_shared.js";

// The file input of the card whose description holds `text` (a card's input is disabled while it uploads, so a position would shift).
const CARD = (text) => ({ css: 'input[type="file"]', in: { css: "div.rounded-xl.py-3", text } });
const SUBMIT = (name) => [
  { click: { role: "button", name }, timeout: 20000 },
  { click: { role: "button", name: "Send request", in: "dialog" } },
  { wait: { text: "Request sent" }, timeout: 20000 },
];

// One document signed by the adviser: select it, draw, finalize, sign; the panel closes when it is saved.
const SIGN = [
  { click: { role: "button", name: "Review and sign" } },
  { wait: { css: "canvas" }, timeout: 20000 },
  { draw: { css: "canvas" } },
  { click: { role: "button", name: "Finalize signature" } },
  { click: { role: "button", name: "Sign this document" } },
  { gone: { role: "button", name: "Sign this document" }, timeout: 20000 },
  { pause: 2500 },
];
const FIND = [
  { type: { label: "Search requests" }, text: "Miguel", optional: true },
  { wait: { role: "button", name: "Open the Research Gate record of Miguel Yu" }, timeout: 20000 },
];
const VERIFY = [
  ...FIND,
  { click: { role: "button", name: "Open the Research Gate record of Miguel Yu" } },
  { wait: { role: "button", name: "Verify submitted requirements" }, timeout: 20000 },
  { pause: 1200, caption: "The documents and what is still pending" },
  { click: { role: "button", name: "Verify submitted requirements" } },
  { wait: { text: "Saved." }, timeout: 20000 },
];
const PICK = (page) => [
  { type: { css: 'input[placeholder*="Search all students"]' }, text: "Miguel", optional: true },
  { click: { text: "Miguel Yu" }, optional: true },
  { wait: { text: page }, timeout: 30000 },
];
const BOOK = [
  ...PICK("Coordinate the defense schedule"),
  { wait: { text: "Best shared options" }, timeout: 30000 },
  { pause: 2500 },
  { click: { text: "Earliest option" } },
  { pause: 800 },
  { type: { label: "Venue / meeting link" }, text: "Graduate School Conference Room" },
  { click: { role: "button", name: "Set defense schedule" } },
  { wait: { text: "This stage is already booked" }, timeout: 30000 },
];
const VERDICT = (extra = []) => [
  ...FIND,
  { click: { role: "button", name: "Record the verdict for the panel for Miguel Yu" } },
  { wait: { text: "Record the verdict for the panel" }, timeout: 20000 },
  { select: { label: "Verdict", in: "dialog" }, label: "Passed" },
  ...extra,
  { type: { label: "Why are you recording this for the panel", in: "dialog" }, text: "The panel chair sent the result by email." },
  { click: { role: "button", name: "Record for the panel", exact: true, in: "dialog" } },
  { gone: { css: '[role="dialog"]' }, timeout: 30000 },
];
const times = (n, list) => Array.from({ length: n }, () => list).flat();

export default {
  id: "proposal-final",
  process: NO_CASE,
  title: "Proposal and Final Defense",
  summary: "From the approved title to completion: the proposal documents, the adviser's signatures, a panel, a booked defense and a recorded verdict, then the same for the final defense.",
  studentNumber: "2260004",
  walkthrough: "17_proposal_final",
  accounts: {
    student: { who: "the student", label: "Miguel Yu", email: "student@usls.edu.ph" },
    staff: STAFF,
    faculty: { who: "the adviser", label: "Dr. Celeste Tan", email: "celeste.tan@usls.edu.ph" },
    research_coordinator: RESEARCH,
  },
  steps: [
    {
      id: "pf-docs", title: "The student uploads the proposal documents", role: "student", route: "/student/research", page: "Research",
      do: "The stage now reads Proposal Defense. Upload the four documents, each on its own card, and select Submit Proposal Defense for review.",
      actions: [
        { upload: CARD("Upload the proposal manuscript. The"), fixture: "proposal-manuscript.pdf" },
        { upload: CARD("Upload the proposal defense endorsement"), fixture: "proposal-endorsement.pdf" },
        { upload: CARD("Upload Form 4.1"), fixture: "proposal-qualitative-exemption.pdf" },
        { upload: CARD("Upload the proposal manuscript endorsement"), fixture: "proposal-manuscript-endorsement.pdf" },
        { pause: 1500, caption: "Four documents are in" },
        ...SUBMIT("Submit Proposal Defense"),
      ],
      doneWhen: { apiWrite: "POST /student-portal/requests/research-gate" },
      ifAsked: [{ q: "Who signs the documents?", a: "The adviser signs the exact uploaded files inside the system; the next step shows it." }],
    },
    {
      id: "pf-sign", title: "The adviser signs each document", role: "faculty", route: "/faculty-portal/signatures", page: "Signatures & Endorsements",
      do: "The adviser opens Signatures & Endorsements, reviews each of the three uploaded documents that need a signature, draws a signature, finalizes it and signs. The signature is saved with that exact file.",
      actions: [...times(3, SIGN), { pause: 1500, caption: "All three documents are signed" }],
      doneWhen: { apiWrite: "POST /faculty-portal/adviser-approvals/*" },
      rule: "The adviser signs the exact file the student uploaded; replacing the file removes the signature.",
      ifAsked: [{ q: "Can staff sign for the adviser?", a: "No. Only the assigned adviser can sign an adviser document." }],
    },
    {
      id: "pf-verify", title: "Staff verify the proposal requirements", role: "staff", route: "/workflow/research-gate", page: "Research Gate",
      do: "On Research Gate, open the student's record and select Verify submitted requirements. The proposal documents are checked against the stored files and the adviser's signatures.",
      actions: VERIFY,
      doneWhen: { apiWrite: "POST /transactions/research-gate" },
      ifAsked: [{ q: "What if a signature is missing?", a: "The requirement stays pending and the card says the student or the adviser has to act." }],
    },
    {
      id: "pf-panel", title: "Match a panel for the proposal", role: "staff", route: "/workflow/panel-matching", page: "Panel Matching",
      do: "Open Panel Matching for the same student: the proposal panel has four seats. Keep the suggested panel and select Finalize selected panel.",
      actions: [...PICK("Panel recommendation workspace"), { pause: 1500, caption: "The suggested panel" }, { click: { role: "button", name: "Finalize selected panel" } }, { wait: { role: "button", name: "Update final panel" }, timeout: 30000 }],
      doneWhen: { apiWrite: "POST /transactions/panel-matching" },
      ifAsked: [{ q: "Is the title panel reused?", a: "The panel is matched again for each stage; the final defense keeps the proposal panel." }],
    },
    {
      id: "pf-book", title: "Book the Proposal Defense", role: "staff", route: "/workflow/defense-scheduling", page: "Defense Scheduling",
      do: "Open Defense Scheduling, choose the earliest shared option, add the venue and select Set defense schedule.",
      actions: BOOK,
      doneWhen: { apiWrite: "POST /transactions/defense-scheduling" },
      ifAsked: [{ q: "Is there a lead time?", a: "Yes, 14 days after the requirements are complete; staff can override it only with a written reason." }],
    },
    {
      id: "pf-verdict", title: "Record the Proposal Defense verdict for the panel", role: "staff", route: "/workflow/research-gate", page: "Research Gate",
      do: "On the student's card select Record for the panel, choose Passed, give the reason and record it. The Proposal Defense is passed; Form 5.1 and the ethics clearance open for the student.",
      actions: VERDICT(),
      doneWhen: { apiWrite: "POST /research-gate/*/verdict" },
      ifAsked: [{ q: "Does the panel chair have to sign in?", a: "No. Staff record it for the panel with a reason; the verdict says who recorded it." }],
    },
    {
      id: "pf-forms", title: "The student uploads Form 5.1 and the ethics clearance", role: "student", route: "/student/research", page: "Research",
      do: "After the defense, two more cards open: Form 5.1 Technical Review Certificate and the Form 5.2 ethics clearance signed by the Ethics Office. Upload both.",
      actions: [
        { upload: CARD("Released by the panel chair"), fixture: "form-5-1-technical-review.pdf" },
        { upload: CARD("Upload the ethics clearance form"), fixture: "form-5-2-ethics-clearance.pdf" },
        { pause: 1500, caption: "Both forms are in" },
      ],
      doneWhen: "manual",
      ifAsked: [{ q: "Is the ethics clearance needed before the final defense?", a: "Yes. The Research Coordinator records it first." }],
    },
    {
      id: "pf-ethics", title: "The Research Coordinator records the ethics clearance", role: "research_coordinator", route: "/workflow/research-gate", page: "Research Gate",
      do: "Open the student's record, check the signed Form 5.2, and select Record ethics clearance with the status Cleared and the date.",
      actions: [
        ...FIND,
        { click: { role: "button", name: "Open the Research Gate record of Miguel Yu" } },
        { wait: { role: "button", name: "Record ethics clearance" }, timeout: 20000 },
        { click: { role: "button", name: "Record ethics clearance" } },
        { wait: { text: "Saved." }, timeout: 20000 },
      ],
      doneWhen: "manual",
      rule: "The clearance date cannot be in the future.",
      ifAsked: [{ q: "What if the clearance is not granted?", a: "The status Returned or Not cleared keeps the Final Defense closed." }],
    },
    {
      id: "pf-verify2", title: "Staff verify: the Proposal Defense is complete", role: "staff", route: "/workflow/research-gate", page: "Research Gate",
      do: "Verify submitted requirements once more: the proposal stage is complete and the card moves to the Final Defense requirements.",
      actions: VERIFY,
      doneWhen: "manual",
      ifAsked: [{ q: "Does the card move by itself?", a: "Yes. The stage is worked out from the records." }],
    },
    {
      id: "pf-final-docs", title: "The student uploads the final defense documents", role: "student", route: "/student/research", page: "Research",
      do: "The stage now reads Final Defense. Upload the final manuscript and its endorsement and select Submit Final Defense for review.",
      actions: [
        { upload: CARD("Final defense manuscript"), fixture: "final-manuscript.pdf" },
        { upload: CARD("Final defense endorsement"), fixture: "final-endorsement.pdf" },
        { pause: 1200 },
        ...SUBMIT("Submit Final Defense"),
      ],
      doneWhen: "manual",
      ifAsked: [{ q: "Is the final manuscript signed too?", a: "Yes. The adviser signs the final manuscript and its endorsement, as for the proposal." }],
    },
    {
      id: "pf-final-sign", title: "The adviser signs the final documents", role: "faculty", route: "/faculty-portal/signatures", page: "Signatures & Endorsements",
      do: "The adviser signs the final manuscript and the endorsement the same way.",
      actions: [...times(2, SIGN), { pause: 1500, caption: "Both final documents are signed" }],
      doneWhen: "manual",
      ifAsked: [{ q: "Can the student submit again after a signature?", a: "Replacing a file removes its signature, so the adviser signs the new file." }],
    },
    {
      id: "pf-final-verify", title: "Staff verify the final defense requirements", role: "staff", route: "/workflow/research-gate", page: "Research Gate",
      do: "Verify submitted requirements again for the Final Defense.",
      actions: VERIFY,
      doneWhen: "manual",
      ifAsked: [{ q: "What is checked?", a: "That each file is stored and that the adviser signatures and the ethics clearance are on record." }],
    },
    {
      id: "pf-final-book", title: "Book the Final Defense", role: "staff", route: "/workflow/defense-scheduling", page: "Defense Scheduling",
      do: "The proposal panel carries over. Choose the earliest shared option, add the venue and select Set defense schedule.",
      actions: BOOK,
      doneWhen: "manual",
      ifAsked: [{ q: "Why is the panel not matched again?", a: "The final defense keeps the proposal panel unless staff change a seat with a reason." }],
    },
    {
      id: "pf-final-verdict", title: "Record the Final Defense verdict with the score", role: "staff", route: "/workflow/research-gate", page: "Research Gate",
      do: "Record Passed for the panel and enter the Form 7 evaluation score. A pass needs the passing score for the paper type.",
      actions: VERDICT([{ type: { label: "Evaluation score", in: "dialog" }, text: "92" }]),
      doneWhen: "manual",
      ifAsked: [{ q: "What if the score is below the passing score?", a: "The pass is refused until the score is corrected or the verdict is changed." }],
    },
    {
      id: "pf-completion", title: "The student uploads the completion evidence", role: "student", route: "/student/research", page: "Research",
      do: "Last stage: the archive copy of the final manuscript, the panel approval confirmations, the similarity certificate (15% or below), the editor certification and the approval sheet. Upload all five and select Submit Completion for review.",
      actions: [
        { upload: CARD("Final manuscript for archiving"), fixture: "completion-archive-copy.pdf" },
        { upload: CARD("Panel approval confirmations"), fixture: "completion-panel-approvals.pdf" },
        { upload: CARD("Turnitin certificate"), fixture: "completion-turnitin-certificate.pdf" },
        { upload: CARD("Form 9 editor certification"), fixture: "completion-form9-editor.pdf" },
        { upload: CARD("Form 10 approval sheet"), fixture: "completion-form10-approval-sheet.pdf" },
        { pause: 1200 },
        ...SUBMIT("Submit Completion"),
      ],
      doneWhen: "manual",
      ifAsked: [{ q: "What is the 15% in the similarity certificate?", a: "The similarity index of the final manuscript may be at most 15%, as the Research Protocol requires." }],
    },
    {
      id: "pf-complete", title: "Staff verify: research is complete", role: "staff", route: "/workflow/research-gate", page: "Research Gate",
      do: "Verify submitted requirements: every stage is complete and the card sits in the Completion column, ready for graduation.",
      actions: VERIFY,
      doneWhen: "manual",
      ifAsked: [{ q: "What comes next?", a: "The student can apply for graduation; research counts as complete." }],
    },
  ],
};
