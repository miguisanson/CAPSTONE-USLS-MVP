import { STAFF, DEAN, ACADEMIC, from, PRACTICUM_ORDER } from "./_shared.js";

export default {
  id: "practicum",
  process: "practicum",
  title: "Practicum",
  summary: "A Psychology or MSGC student sends the MOA and the hours; the Coordinator may ask for more certificates; the Dean reviews the report.",
  studentNumber: "2690202",
  walkthrough: "18_practicum",
  accounts: {
    student: { who: "the student", label: "Paolo Ramirez", email: "practicum.paolo@usls.edu.ph" },
    staff: STAFF,
    academic_coordinator: ACADEMIC,
    dean: DEAN,
  },
  steps: [
    {
      id: "pr-moa", title: "The student sends the MOA", role: "student", route: "/student/practicum", page: "Practicum",
      do: "Type the practicum site and the supervisor, choose the signed MOA PDF, add a remark and select Submit MOA stage, then Send request.",
      actions: [
        { type: "#practicum-site", text: "Guidance and Counseling Partner Center" },
        { type: { label: "Supervisor name" }, text: "Ms. Angela Cruz" },
        { upload: "#practicum-moa", fixture: "practicum-moa.pdf" },
        { type: { label: "Remarks for the reviewer" }, text: "Signed MOA with the partner center." },
        { click: "submit" },
        { click: { role: "button", name: "Send request", in: "dialog" } },
      ],
      doneWhen: { status: from(PRACTICUM_ORDER, "MOA Submitted") },
      rule: "Practicum applies to Psychology programs and MSGC only; the student must have passed the eligibility check first.",
      ifAsked: [
        { q: "Why do other students not see Practicum?", a: "Practicum applies only to Psychology programs and MSGC. Students of other programs never appear on the practicum screens." },
        { q: "Is the eligibility check manual?", a: "No. Courses and research are checked by the system; the student starts at the MOA once every check is Verified." },
      ],
    },
    {
      id: "pr-forward-moa", title: "Staff forward the MOA", role: "staff", route: "/workflow/practicum", page: "Practicum",
      do: "Open View details on the card in Submitted and select Forward to Academic Coordinator, then confirm.",
      actions: [
        { click: { role: "button", name: "View details for Paolo Ramirez" } },
        { click: { role: "button", name: "Forward to Academic Coordinator", exact: true, in: "dialog" } },
        { click: { role: "button", name: "Forward to Academic Coordinator", exact: true, in: "dialog" } },
        { click: { role: "button", name: "Close details" }, optional: true },
      ],
      doneWhen: { status: from(PRACTICUM_ORDER, "MOA Under Review") },
      ifAsked: [
        { q: "Why does a confirmation window open?", a: "Every step shows the status change (MOA Submitted to MOA Under Review) and takes an optional comment before it is saved." },
        { q: "Can the card be dragged?", a: "Yes, only onto the column its next step leads to. The drop opens the same confirmation as the button." },
      ],
    },
    {
      id: "pr-progress", title: "The Coordinator starts the practicum", role: "academic_coordinator", route: "/workflow/practicum", page: "Practicum",
      do: "Open View details on the card in Eligibility Review and select Mark practicum in progress, then confirm.",
      actions: [
        { click: { role: "button", name: "View details for Paolo Ramirez" } },
        { click: { role: "button", name: "Mark practicum in progress", exact: true, in: "dialog" } },
        { click: { role: "button", name: "Mark practicum in progress", exact: true, in: "dialog" } },
        { click: { role: "button", name: "Close details" }, optional: true },
      ],
      doneWhen: { status: from(PRACTICUM_ORDER, "Practicum In Progress") },
      ifAsked: [{ q: "Who owns the practicum after staff?", a: "The Academic Coordinator marks the practicum in progress, requests certificates and verifies completion." }],
    },
    {
      id: "pr-hours", title: "The student sends hours and certificates", role: "student", route: "/student/practicum", page: "Practicum",
      do: "Enter the completed hours (200 for the straight path; fewer shows the Hours Incomplete detour), choose the certificates PDF, add a remark and select Submit completion stage, then Send request.",
      actions: [
        { type: "#practicum-hours", text: "200" },
        { upload: "#practicum-certificates", fixture: "practicum-certificates.pdf" },
        { type: { label: "Remarks for the reviewer" }, text: "Certificates covering all 200 practicum hours." },
        { click: "submit" },
        { click: { role: "button", name: "Send request", in: "dialog" } },
      ],
      doneWhen: { status: from(PRACTICUM_ORDER, "Hours Incomplete") },
      rule: "The required hours (200 for MSGC) are shown by the system. Fewer documented hours leave the case at Hours Incomplete.",
      ifAsked: [
        { q: "What if fewer than 200 hours are entered?", a: "The case is recorded as Hours Incomplete and the practicum cannot be completed. The Coordinator then asks for additional certificates." },
        { q: "Can the student type the required hours?", a: "No. The required hours come from the system, so nobody types a value that is already known." },
      ],
    },
    {
      id: "pr-forward-docs", title: "Staff forward the documents", role: "staff", route: "/workflow/practicum", page: "Practicum",
      do: "Open View details on the card and select Forward documents to Academic Coordinator, then confirm.",
      actions: [
        { click: { role: "button", name: "View details for Paolo Ramirez" } },
        { click: { role: "button", name: "Forward documents to Academic Coordinator", exact: true, in: "dialog" } },
        { click: { role: "button", name: "Forward documents to Academic Coordinator", exact: true, in: "dialog" } },
        { click: { role: "button", name: "Close details" }, optional: true },
      ],
      doneWhen: { status: from(PRACTICUM_ORDER, "Documents Under Review") },
      ifAsked: [{ q: "Is the earlier file lost on a resubmission?", a: "No. The original files stay in the Submitted file history all the way." }],
    },
    {
      id: "pr-check", title: "The Coordinator checks the hours", role: "academic_coordinator", route: "/workflow/practicum", page: "Practicum",
      do: "With fewer hours than required, select Request additional certificates and type the reason. With all hours documented, select Verify completion instead.",
      actions: [
        { click: { role: "button", name: "View details for Paolo Ramirez" } },
        { click: { role: "button", name: "Verify completion", exact: true, in: "dialog" } },
        { click: { role: "button", name: "Verify completion", exact: true, in: "dialog" } },
        { click: { role: "button", name: "Close details" }, optional: true },
      ],
      doneWhen: { status: from(PRACTICUM_ORDER, "Additional Certificates Requested") },
      branches: [
        { status: ["Additional Certificates Requested"], goto: "pr-resubmit", note: "The Coordinator asked for more certificates. The student uploads them and sends the stage again; then staff forward the documents again." },
      ],
      rule: "A reason is required when certificates are requested.",
      ifAsked: [
        { q: "Does the student start over?", a: "No. Step 3 is reopened, the earlier PDF stays under Already submitted and the new one is added." },
        { q: "What if the organization is not accepted?", a: "The Coordinator can mark the completion as not accepted; the student then arranges another organization and sends an updated MOA." },
      ],
    },
    {
      id: "pr-verify", title: "The Coordinator verifies completion", role: "academic_coordinator", route: "/workflow/practicum", page: "Practicum",
      do: "The card is in Completed. Open View details again and select Send status report to Dean, then confirm.",
      actions: [
        { click: { role: "button", name: "View details for Paolo Ramirez" } },
        { click: { role: "button", name: "Send status report to Dean", exact: true, in: "dialog" } },
        { click: { role: "button", name: "Send status report to Dean", exact: true, in: "dialog" } },
        { click: { role: "button", name: "Close details" }, optional: true },
      ],
      doneWhen: { status: from(PRACTICUM_ORDER, "Report Sent to Dean") },
      ifAsked: [{ q: "What does the Dean receive?", a: "A Practicum status report: hours, certificates, the remark, the stage history and the whole case discussion." }],
    },
    {
      id: "pr-dean", title: "The Dean reviews the report", role: "dean", route: "/dean/approvals/practicum", page: "Practicum Reports",
      do: "Open View details on the card in With the Dean, type a review comment and select Mark reviewed, then confirm.",
      actions: [
        { click: { role: "link", name: "View details for Paolo Ramirez" } },
        { type: { label: "Review comment" }, text: "Practicum completed: 200 of 200 hours documented. Reviewed." },
        { click: { role: "button", name: "Mark reviewed" } },
        { click: { role: "button", name: "Mark reviewed", exact: true, in: "dialog" }, optional: true },
      ],
      doneWhen: { status: from(PRACTICUM_ORDER, "Dean Reviewed") },
      // A Dean return puts the record back to "Completed" with a "Revise practicum status report" task for the Coordinator.
      branches: [{ status: ["Completed"], goto: "pr-verify", note: "The Dean returned the report. The Academic Coordinator revises it and sends it to the Dean again." }],
      rule: "The Dean reviews only after the Academic Coordinator has sent the status report.",
      ifAsked: [
        { q: "If the Dean was already signed in, why is the card missing?", a: "The Dean page is read when it opens. Reload it to see the new card." },
        { q: "What does staff see afterwards?", a: "The card in Completed with every file in the Submitted file history and no action due." },
      ],
    },
    {
      id: "pr-resubmit", side: true, title: "The student sends the missing documents again", role: "student", route: "/student/practicum", page: "Practicum",
      do: "Read the Coordinator's message, enter the new completed hours, choose the additional certificate PDF and send the completion stage again.",
      target: 'main form button[type="submit"]',
      actions: [
        { type: "#practicum-hours", text: "200" },
        { upload: "#practicum-certificates", fixture: "practicum-certificates.pdf" },
        { type: { label: "Remarks for the reviewer" }, text: "The additional certificate covers the remaining practicum hours." },
        { click: "submit" },
        { click: { role: "button", name: "Send request", in: "dialog" } },
      ],
      doneWhen: "manual",
      ifAsked: [{ q: "Which message tells the student what is missing?", a: "The newest post in the case discussion, shown in green, with the reason the Coordinator typed." }],
    },
  ],
};
