import { CheckCircle2, XCircle } from "lucide-react";
import { toneOf } from "../../lib/tone.js";

// Khloe's requirement boxes: one box per requirement, with a check when met and a cross when not. Colours come from the
// one status vocabulary (I-358): met = "done" (a finish), not met = "attention" (still to do) - not the red of an error or a denial.
// `items` is [{ label, met = true }]. Shown on candidate cards, in a group's student list and in the case window.
export function RequirementBoxes({ items, ariaLabel = "Completed graduation requirements", className = "mt-3" }) {
  return (
    <div className={`grid gap-2 sm:grid-cols-2 ${className}`} aria-label={ariaLabel}>
      {items.map(({ label, met = true }) => (
        <div key={label} data-requirement={met ? "met" : "not-met"} className={`flex items-center gap-2 rounded-lg px-3 py-2 ring-1 ${toneOf(met ? "done" : "attention").chip}`}>
          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-white ${toneOf(met ? "done" : "attention").dot}`}>
            {met ? <CheckCircle2 className="h-3.5 w-3.5" role="img" aria-label="Met" /> : <XCircle className="h-3.5 w-3.5" role="img" aria-label="Not met" />}
          </span>
          <p className="text-xs font-semibold">{label}</p>
        </div>
      ))}
    </div>
  );
}
