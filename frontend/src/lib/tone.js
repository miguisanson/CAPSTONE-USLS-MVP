// The one semantic colour map (UI-SPEC section 3). StatusChip, InlineNotice, StatCard, Stepper and row accents
// all read from here, so "success" looks the same everywhere. Class strings are written out in full so Tailwind
// can see them. `chip` is the pill/tint, `notice` is border + background + text of a banner, `dot` is a small
// marker or bar. Callers add their own ring width, rounding and padding; this file only holds colour.
export const TONES = Object.freeze({
  success: Object.freeze({
    label: "success",
    chip: "bg-brand-50 text-brand-700 ring-brand-200",
    notice: "border-brand-200 bg-brand-50 text-brand-800",
    dot: "bg-brand-500",
  }),
  warning: Object.freeze({
    label: "warning",
    chip: "bg-amber-50 text-amber-800 ring-amber-200",
    notice: "border-amber-200 bg-amber-50 text-amber-900",
    dot: "bg-amber-500",
  }),
  danger: Object.freeze({
    label: "danger",
    chip: "bg-red-50 text-red-700 ring-red-200",
    notice: "border-red-200 bg-red-50 text-red-800",
    dot: "bg-red-500",
  }),
  info: Object.freeze({
    label: "info",
    chip: "bg-blue-50 text-blue-700 ring-blue-200",
    notice: "border-blue-200 bg-blue-50 text-blue-800",
    dot: "bg-blue-500",
  }),
  neutral: Object.freeze({
    label: "neutral",
    chip: "bg-slate-100 text-slate-700 ring-slate-200",
    notice: "border-slate-200 bg-slate-50 text-slate-700",
    dot: "bg-slate-400",
  }),
});

export const TONE_NAMES = Object.freeze(Object.keys(TONES));

// Older callers say warn/error/good/bad/muted or use a colour name. Accepted until the last packet removes them.
const LEGACY = {
  warn: "warning",
  error: "danger",
  good: "success",
  bad: "danger",
  muted: "neutral",
  brand: "success",
  amber: "warning",
  red: "danger",
  blue: "info",
  slate: "neutral",
};

/** Returns the tone entry for a tone name (or a legacy alias). An unknown name gives `neutral`. */
export function toneOf(name) {
  const key = String(name || "").toLowerCase();
  return TONES[key] || TONES[LEGACY[key]] || TONES.neutral;
}
