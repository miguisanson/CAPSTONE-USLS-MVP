import HistoryDisclosure from "./HistoryDisclosure";
import { Stepper } from "./ui/index.js";

const WITHDRAWAL_STEPS = [
  "Student sends a subject withdrawal request",
  "GS Staff records and forwards the request to the Dean",
  "Dean reviews and approves or denies the request",
  "GS Staff tags the student as Withdrawn from the selected subject",
  "GS Staff exports the approved-withdrawals Excel list",
  "GS Staff emails the approved list and waits for Registrar acknowledgement",
];

const GRADUATION_STEPS = [
  "Graduation Review Window Open",
  "Candidate List Compiled",
  "Coursework Completion Checked",
  "Research Requirements Validated",
  "Endorsement List Prepared",
  "Dean Review",
  "Endorsement List Revised and Resubmitted",
  "Dean Approval",
  "Endorsed List Exported — Manual Registrar Email Required",
];

function numberedStates(labels, activeIndex, optionalIndexes = []) {
  return labels.map((label, index) => ({
    label,
    state: index < activeIndex ? "complete" : index === activeIndex ? "current" : "upcoming",
    optional: optionalIndexes.includes(index),
  }));
}

export function withdrawalTimelineSteps(status) {
  const activeByStatus = {
    "Submitted to GS Staff": 1,
    "Dean Review": 2,
    "Approved - Awaiting Subject Tag": 3,
    "Approved - Registrar Preparation": 3,
    "Subject Tagged - Registrar Preparation": 4,
    "Exported - Ready to Send": 5,
    "Sent to Registrar": 5,
    "Withdrawn Confirmed": WITHDRAWAL_STEPS.length,
    Denied: 2,
    Returned: 0,
    "Returned for Clarification": 0,
  };
  return numberedStates(WITHDRAWAL_STEPS, activeByStatus[status] ?? 0);
}

export function graduationTimelineSteps(status, eligibility = {}) {
  let activeIndex = 0;
  if (status === "For Review") {
    activeIndex = 1;
  } else if (status === "Coursework Review") {
    activeIndex = 2;
  } else if (status === "Research Review") {
    activeIndex = 3;
  } else if (status === "Coursework Incomplete") {
    activeIndex = 2;
  } else if (status === "Research Incomplete") {
    activeIndex = 3;
  } else if (status === "Not Eligible") {
    activeIndex = eligibility.coursework_status === "Complete" ? 3 : 2;
  } else if (["Eligibility Confirmed", "Endorsement Prepared"].includes(status)) {
    activeIndex = 4;
  } else if (["Ready for Dean Review", "Returned for Revision"].includes(status)) {
    activeIndex = status === "Returned for Revision" ? 6 : 5;
  } else if (status === "Dean Approved") {
    activeIndex = 7;
  }
  return numberedStates(GRADUATION_STEPS, activeIndex, [6]);
}

// The step builders above stay as they were; this only draws their result. The list is behind "View stage history":
// long step names read best one per line, so it is a vertical Stepper.
export default function WorkflowTimeline({ steps = [], title = "Workflow timeline" }) {
  return (
    <HistoryDisclosure label="View stage history" hideLabel="Hide stage history" count={steps.length}>
      <section aria-label={title}>
        <Stepper steps={steps} title={title} orientation="vertical" compact />
      </section>
    </HistoryDisclosure>
  );
}
