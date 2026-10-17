// Stepper (UI-SPEC section 4, idea X-02): an ordered list of steps with a state each. One component for every
// timeline in the app (student lifecycle, leave, course adjustment, graduation check).
// Orientation "auto" = a vertical list below sm and a wrapping row from sm up. A `stopped` step is drawn as a status
// chip (the student left the normal path: LOA, AWOL...). Colour is never the only signal: every step has a
// sr-only state word, and the dot carries an icon or a number.
import { useId } from "react";
import { Check, Pause, RotateCcw, X } from "lucide-react";
import { StatusChip } from "./StatusChip.jsx";
import { statusTone } from "../../lib/status";
import { toneOf } from "../../lib/tone";

/** The state words read by assistive technology. */
const STATE_WORDS = {
  complete: "Complete",
  current: "Current",
  upcoming: "Upcoming",
  returned: "Returned",
  denied: "Denied",
  stopped: "Stopped",
};

// Dot look per state (written out in full so Tailwind sees the classes). `stopped` uses its tone instead.
const DOTS = {
  complete: "border-brand-600 bg-brand-600 text-white",
  current: "border-brand-600 bg-white text-brand-700 ring-4 ring-brand-100",
  upcoming: "border-slate-300 bg-white text-slate-500",
  returned: "border-amber-500 bg-amber-50 text-amber-800",
  denied: "border-red-500 bg-red-50 text-red-700",
};

const LABELS = {
  complete: "text-slate-700",
  current: "font-semibold text-ink",
  upcoming: "text-slate-500",
  returned: "font-semibold text-amber-900",
  denied: "font-semibold text-red-800",
};

function Dot({ state, index, tone }) {
  const cls = state === "stopped" ? `${toneOf(tone).chip.replace(/ring-\S+/, "")} border-current` : DOTS[state] || DOTS.upcoming;
  let content = <span aria-hidden="true">{index + 1}</span>;
  if (state === "complete") content = <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />;
  if (state === "returned") content = <RotateCcw className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />;
  if (state === "denied") content = <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />;
  if (state === "stopped") content = <Pause className="h-3 w-3" strokeWidth={3} aria-hidden="true" />;
  return (
    <span
      data-slot="dot"
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-2xs font-semibold ${cls}`}
    >
      {content}
    </span>
  );
}

/**
 * @param steps        [{ label, state, hint, optional, key, tone }] - state: complete | current | upcoming | returned | denied | stopped
 *                     (an unknown state is shown as upcoming). `tone` colours a stopped step when its label is not a known status.
 * @param orientation  "auto" (default: vertical below sm, wrapping row from sm up) | "horizontal" | "vertical"
 * @param compact      tighter spacing, no hints
 * @param title        a visible title that also names the list for assistive technology
 */
export function Stepper({ steps = [], orientation = "auto", compact = false, title, className = "", ...rest }) {
  const titleId = useId();
  const vertical = orientation === "vertical";
  const horizontal = orientation === "horizontal";
  const listClass = vertical
    ? "flex flex-col"
    : horizontal
      ? "flex flex-row flex-wrap gap-x-5 gap-y-3"
      : "flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-3";
  return (
    <div className={className} {...rest}>
      {title && (
        <p id={titleId} className="eyebrow mb-2">
          {title}
        </p>
      )}
      <ol className={listClass} aria-labelledby={title ? titleId : undefined}>
        {steps.map((step, i) => {
          const state = STATE_WORDS[step.state] ? step.state : "upcoming";
          const last = i === steps.length - 1;
          // the connector line only exists in the vertical layout
          const line = vertical
            ? "before:absolute before:left-3 before:top-6 before:-ml-px before:h-[calc(100%-1.5rem)] before:w-0.5 before:bg-slate-200 last:before:hidden"
            : horizontal
              ? ""
              : "max-sm:before:absolute max-sm:before:left-3 max-sm:before:top-6 max-sm:before:-ml-px max-sm:before:h-[calc(100%-1.5rem)] max-sm:before:w-0.5 max-sm:before:bg-slate-200 max-sm:last:before:hidden";
          const pad = vertical
            ? compact ? "pb-2" : "pb-3"
            : horizontal
              ? ""
              : compact ? "max-sm:pb-2" : "max-sm:pb-3";
          return (
            <li
              key={step.key ?? `${step.label}-${i}`}
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
              className={`relative flex items-start gap-2.5 ${line} ${last ? "pb-0 max-sm:pb-0" : pad}`}
            >
              <Dot state={state} index={i} tone={statusTone(step.label, step.tone || "bad")} />
              <span className="min-w-0 pt-0.5">
                {state === "stopped" ? (
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="sr-only">{STATE_WORDS[state]}: </span>
                    <StatusChip status={step.label} tone={step.tone || "bad"} dot={false} />
                  </span>
                ) : (
                  <>
                    <span className={`block text-sm leading-6 ${LABELS[state]}`}>
                      <span className="sr-only">{STATE_WORDS[state]}: </span>
                      {step.label}
                      {step.optional && <span className="meta ml-1.5 font-normal">(optional)</span>}
                    </span>
                    {step.hint && !compact && <span className="meta block">{step.hint}</span>}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
