import { CheckCircle2, XCircle } from "lucide-react";

// Khloe's requirement boxes: one box per requirement, green with a check when met, red with a cross when not.
// `items` is [{ label, met = true }]. Shown on candidate cards, in a group's student list and in the case window.
export function RequirementBoxes({ items, ariaLabel = "Completed graduation requirements", className = "mt-3" }) {
  return (
    <div className={`grid gap-2 sm:grid-cols-2 ${className}`} aria-label={ariaLabel}>
      {items.map(({ label, met = true }) => (
        <div key={label} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${met ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}>
          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-white ${met ? "bg-emerald-600" : "bg-red-600"}`}>
            {met ? <CheckCircle2 className="h-3.5 w-3.5" role="img" aria-label="Met" /> : <XCircle className="h-3.5 w-3.5" role="img" aria-label="Not met" />}
          </span>
          <p className="text-xs font-semibold">{label}</p>
        </div>
      ))}
    </div>
  );
}
