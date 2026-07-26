import HistoryDisclosure from "./HistoryDisclosure";

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

const LOA_STEPS = [
  "Request Submitted",
  "GS Staff Intake and Eligibility Check",
  "Dean Review",
  "Student Standing Updated",
];

export function loaTimelineSteps(status) {
  const activeByStatus = {
    "Not Submitted": 0,
    Submitted: 1,
    "Dean Review": 2,
    Approved: 3,
    "On Leave": 3,
    Denied: 2,
    Withdrawn: 0,
  };
  return numberedStates(LOA_STEPS, activeByStatus[status] ?? 0);
}

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

export default function WorkflowTimeline({ steps = [], title = "Workflow timeline" }) {
  return (
    <HistoryDisclosure label="View stage history" hideLabel="Hide stage history" count={steps.length}>
      <section aria-label={title}>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{title}</p>
        <ol className="grid gap-2 sm:grid-cols-2">
          {steps.map((step, index) => {
            const state = step.state || "upcoming";
            return (
              <li
                key={`${index}-${step.label}`}
                aria-current={state === "current" ? "step" : undefined}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold leading-relaxed ${
                  state === "current"
                    ? "border-brand-600 bg-brand-600 text-white"
                    : state === "complete"
                      ? "border-brand-200 bg-brand-50 text-brand-800"
                      : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                <span className={`font-bold ${state === "upcoming" ? "text-slate-400" : "text-current"}`}>Step {index + 1}:</span>{" "}
                {step.label}
                {step.optional && <span className="ml-1 font-medium opacity-75">(if needed)</span>}
              </li>
            );
          })}
        </ol>
      </section>
    </HistoryDisclosure>
  );
}
