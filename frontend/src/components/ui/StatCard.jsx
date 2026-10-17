// StatCard (UI-SPEC section 4): one KPI tile. md = the dashboard tile; sm = the compact mini-stat used inside cards.
// Props are a superset of the old components/ui.jsx StatCard ({ icon, label, value, sub, tone, to, badge }).
import { Link } from "react-router-dom";
import { StatusChip } from "./StatusChip.jsx";
import { toneOf } from "../../lib/tone";

/**
 * @param icon    a lucide icon component, shown in a tinted tile
 * @param label   what is counted (small caps line)
 * @param value   the figure, or a status in words when `badge` is set
 * @param sub     one line under the figure
 * @param tone    success | warning | danger | info | neutral (the legacy brand / amber / red / blue / slate still work)
 * @param to      makes the whole tile a link to the page where the figure can be acted on
 * @param badge   the value is a status in words: shown as a StatusChip, not in the figure font
 * @param size    "md" (default) | "sm"
 */
export function StatCard({ icon: Icon, label, value, sub, tone = "success", to, badge = false, size = "md", className = "", ...rest }) {
  const small = size === "sm";
  const tint = toneOf(tone).chip;
  const body = (
    <div
      className={`card h-full transition-colors ${small ? "rounded-xl p-3" : "p-4 sm:p-5"} ${to ? "hover:border-brand-200 hover:bg-brand-50/30" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p data-slot="label" className={small ? "meta font-semibold uppercase tracking-wide" : "eyebrow"}>{label}</p>
          {badge ? (
            <p data-slot="value" className="mt-2">
              <StatusChip status={value} dot={false} className="max-w-full !whitespace-normal text-sm" />
            </p>
          ) : (
            <p data-slot="value" className={`break-words ${small ? "card-title mt-1" : "page-title mt-2"}`}>{value}</p>
          )}
          {sub && <p data-slot="sub" className="meta mt-1">{sub}</p>}
        </div>
        {Icon && (
          <span
            data-slot="icon"
            className={`grid shrink-0 place-items-center ${small ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-xl"} ${tint}`}
          >
            <Icon className={small ? "h-4 w-4" : "h-5 w-5"} aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
  if (!to) {
    return (
      <div {...rest} className={`h-full ${className}`.trim()}>
        {body}
      </div>
    );
  }
  return (
    <Link
      {...rest}
      to={to}
      className={`block h-full cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${className}`.trim()}
    >
      {body}
    </Link>
  );
}
