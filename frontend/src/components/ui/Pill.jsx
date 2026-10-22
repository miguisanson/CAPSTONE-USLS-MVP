// A small label pill ("P0", "P1", a brand tag). For a status in words use StatusChip instead.
// Moved here from the old components/ui.jsx (Phase 5 P8).
const TONES = {
  slate: "bg-slate-100 text-slate-600",
  brand: "bg-brand-50 text-brand-700",
  P0: "bg-brand-600 text-white",
  P1: "bg-amber-100 text-amber-800",
};

export function Pill({ children, tone = "slate" }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-2xs font-semibold tracking-wide ${TONES[tone] || TONES.slate}`}>
      {children}
    </span>
  );
}
