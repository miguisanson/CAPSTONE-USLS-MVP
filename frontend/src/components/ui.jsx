import { Link } from "react-router-dom";
import { StatusChip } from "./ui/StatusChip.jsx";
import { Card as UiCard } from "./ui/Card.jsx";

// P1b shims: the status chip, card and section title now live in ./ui/. Every existing import keeps working.
// Deleted in the last packet (P8) once pages import from "components/ui/index.js".
export { SectionTitle, SectionCard } from "./ui/Card.jsx";

/** Old name of StatusChip (takes `value`, not `status`). */
export function StatusBadge({ value, dot = true, className = "" }) {
  return <StatusChip status={value} dot={dot} className={className} />;
}

/** Old Card: no padding of its own (callers add p-4 / p-5). The new Card in ui/Card.jsx defaults to pad="md". */
export function Card({ children, className = "" }) {
  return <UiCard pad="none" className={className}>{children}</UiCard>;
}

// P1d shims: Spinner, EmptyState and InlineNotice now live in ./ui/Feedback.jsx (InlineNotice info is blue; legacy
// tones warn / error still work). Every existing import keeps working until the last packet.
export { Spinner, EmptyState, InlineNotice } from "./ui/Feedback.jsx";

export function ErrorNote({ message }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      {message}
    </div>
  );
}

export function ProgressBar({ value, className = "" }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-100 ${className}`}>
      <div
        className="h-full rounded-full bg-brand-500 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Pill({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    brand: "bg-brand-50 text-brand-700",
    P0: "bg-brand-600 text-white",
    P1: "bg-amber-100 text-amber-800",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
}

// Shared page header: every role's pages open with the same title / short
// description / primary-action block so the product reads as one system.
export function PageHeader({ title, description, icon: Icon, actions = null, badge = null }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 hidden h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700 sm:grid">
            <Icon className="h-6 w-6" strokeWidth={2} />
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
            {badge}
          </div>
          {description && <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const STAT_TONES = {
  brand: "bg-brand-50 text-brand-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  blue: "bg-blue-50 text-blue-700",
  slate: "bg-slate-100 text-slate-600",
};

// KPI tile used on the Student, Dean and Faculty dashboards. Pass `to` to make
// the whole tile a link to the page where the figure can be acted on. Pass `badge` when the
// value is a status in words rather than a number: it is shown as a badge, not in the big figure font.
export function StatCard({ icon: Icon, label, value, sub, tone = "brand", to, badge = false }) {
  const body = (
    <div className={`card h-full p-5 transition-colors ${to ? "hover:border-brand-200 hover:bg-brand-50/30" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
          {badge
            ? <p className="mt-3"><StatusBadge value={value} dot={false} className="text-sm" /></p>
            : <p className="mt-2 font-display text-3xl font-semibold text-ink">{value}</p>}
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        {Icon && (
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${STAT_TONES[tone] || STAT_TONES.brand}`}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
    </div>
  );
  if (!to) return body;
  return (
    <Link to={to} className="block h-full cursor-pointer rounded-2xl">
      {body}
    </Link>
  );
}
