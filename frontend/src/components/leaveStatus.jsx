import { StatusChip, Stepper } from "./ui/index.js";

// Shared look for Leave of Absence / Readmission cases. The words come from the server (`status_label`); the colour
// comes from the one status map (lib/status.js), with the server's `status_tone` only as the fallback for a word the
// map does not know. So the board columns, filters, badges and the student timeline always agree.

/**
 * A status chip for a case or a flag. `status` is the server's status (it picks the colour); `label` is the words to
 * show when they differ; `tone` (info / good / warn / bad / muted) is the fallback colour for an unknown word.
 */
export function LeaveStatusBadge({ status, label, tone = "info", className = "" }) {
  return <StatusChip status={status || label} label={label} tone={tone} dot={false} className={className} />;
}

export function leaveCaseStatusBadge(item, className = "") {
  return <LeaveStatusBadge status={item.status} label={item.status_label} tone={item.status_tone} className={className} />;
}

// A step where the case stopped is drawn as a neutral chip: the case ended there, which is not an error.
const withNeutralStop = (step) => (step.state === "stopped" ? { ...step, tone: "neutral" } : step);

/**
 * The steps of one case with where it is now. `steps` is `case.timeline` from the API:
 * [{ label, state }] with state complete, current, upcoming, returned, denied or stopped.
 */
export function LeaveTimeline({ steps = [], title = "Where this request is", compact = false }) {
  if (!steps.length) return null;
  return (
    <section aria-label={title}>
      <Stepper steps={steps.map(withNeutralStop)} title={compact ? undefined : title} compact={compact} />
    </section>
  );
}
