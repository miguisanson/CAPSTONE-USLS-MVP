import { Check, CornerUpLeft, Minus, X } from "lucide-react";

// Shared look for Leave of Absence / Readmission cases. The words and the tone of every
// status come from the server (`status_label`, `status_tone`), so the board columns,
// filters, badges and the student timeline always agree.
const TONE_CLASSES = {
  info: "bg-blue-50 text-blue-700 ring-blue-200",
  good: "bg-brand-50 text-brand-700 ring-brand-200",
  warn: "bg-amber-50 text-amber-800 ring-amber-200",
  bad: "bg-red-50 text-red-700 ring-red-200",
  muted: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function LeaveStatusBadge({ status, label, tone = "info", className = "" }) {
  const text = label || status;
  if (!text) return <span className="text-slate-400">—</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE_CLASSES[tone] || TONE_CLASSES.info} ${className}`}
    >
      {text}
    </span>
  );
}

export function leaveCaseStatusBadge(item, className = "") {
  return <LeaveStatusBadge status={item.status} label={item.status_label} tone={item.status_tone} className={className} />;
}

const STEP_STYLES = {
  complete: { ring: "border-brand-500 bg-brand-500 text-white", text: "text-ink", icon: Check, hint: "Done" },
  current: { ring: "border-brand-600 bg-white text-brand-700 ring-4 ring-brand-100", text: "font-semibold text-ink", icon: null, hint: "Now" },
  upcoming: { ring: "border-slate-300 bg-white text-slate-300", text: "text-slate-400", icon: null, hint: "Later" },
  returned: { ring: "border-amber-500 bg-amber-500 text-white", text: "font-semibold text-amber-800", icon: CornerUpLeft, hint: "Sent back" },
  denied: { ring: "border-red-500 bg-red-500 text-white", text: "font-semibold text-red-700", icon: X, hint: "Denied" },
  stopped: { ring: "border-slate-400 bg-slate-400 text-white", text: "font-semibold text-slate-600", icon: Minus, hint: "Stopped" },
};

/**
 * The steps of one case with where it is now. `steps` is `case.timeline` from the API:
 * [{ label, state }] with state complete, current, upcoming, returned, denied or stopped.
 */
export function LeaveTimeline({ steps = [], title = "Where this request is", compact = false }) {
  if (!steps.length) return null;
  return (
    <section aria-label={title}>
      {!compact && <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{title}</p>}
      <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
        {steps.map((step, index) => {
          const style = STEP_STYLES[step.state] || STEP_STYLES.upcoming;
          const Icon = style.icon;
          return (
            <li key={`${index}-${step.label}`} aria-current={step.state === "current" ? "step" : undefined} className="flex items-center gap-2">
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold ${style.ring}`}>
                {Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
              </span>
              <span className={`text-sm ${style.text}`}>
                {step.label}
                <span className="sr-only"> ({style.hint})</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
