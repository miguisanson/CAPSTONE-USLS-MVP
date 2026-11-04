// "What the colours mean" (I-358): the one legend every board and the Reports page show, so a stakeholder never has to
// guess why Approved (green) and Passed (teal) are different. It reads the same tone map the chips read.
import { TONE_NAMES, TONE_MEANING, toneOf } from "../../lib/tone";
import { TONE_ICONS } from "./toneIcons.js";

/**
 * A folded list of the seven colours with an icon, a name and example statuses. Closed by default so it does not push a
 * board down; the summary line is always visible.
 */
export function StatusLegend({ className = "" }) {
  return (
    <details data-status-legend="" className={`rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm ${className}`}>
      <summary className="cursor-pointer select-none font-semibold text-slate-700 max-sm:min-h-11 max-sm:py-2.5">What the colours mean</summary>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
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
    </details>
  );
}
