// The colour key (I-358, UX-15): the one legend every board and the Reports page show, so a stakeholder never has to
// guess why Approved (green) and Passed (teal) are different. It reads the same tone map the chips read.
import { useEffect, useRef, useState } from "react";
import { Palette } from "lucide-react";
import { TONE_NAMES, TONE_MEANING, toneOf } from "../../lib/tone";
import { TONE_ICONS } from "./toneIcons.js";

/**
 * UX-15 (2026-11-20): a small "Colour key" button; the seven colours, each with an icon, a name and example statuses,
 * open under it. It no longer takes a full-width row above every board.
 */
export function StatusLegend({ className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    const onDown = (event) => !ref.current?.contains(event.target) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);
  return (
    <div ref={ref} data-status-legend="" className={`relative inline-block ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors duration-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 max-sm:min-h-11"
      >
        <Palette className="h-3.5 w-3.5" aria-hidden="true" />
        Colour key
      </button>
      {open && (
        <ul className="absolute left-0 top-full z-30 mt-1 grid w-[min(40rem,calc(100vw-2rem))] gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lift sm:grid-cols-2">
          {TONE_NAMES.map((name) => {
            const Icon = TONE_ICONS[name];
            const meaning = TONE_MEANING[name];
            return (
              <li key={name} data-legend-tone={name} className="flex items-start gap-2">
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${toneOf(name).chip}`}>
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {meaning.title}
                </span>
                <span className="meta pt-0.5">{meaning.examples}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
