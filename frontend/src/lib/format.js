// Centralised status -> colour mapping so badges stay consistent and meaningful.
// Colour is never the ONLY signal: every badge also shows a label and (where used) a dot.

const STATUS_STYLES = {
  // risk
  Low: "bg-brand-50 text-brand-700 ring-brand-200",
  Medium: "bg-amber-50 text-amber-700 ring-amber-200",
  High: "bg-red-50 text-red-700 ring-red-200",
  // standing
  Active: "bg-brand-50 text-brand-700 ring-brand-200",
  "On Leave": "bg-amber-50 text-amber-700 ring-amber-200",
  Completed: "bg-blue-50 text-blue-700 ring-blue-200",
  // enrollment tag
  LOA: "bg-amber-50 text-amber-700 ring-amber-200",
  AWOL: "bg-red-50 text-red-700 ring-red-200",
  // scheduling
  Confirmed: "bg-brand-50 text-brand-700 ring-brand-200",
  "Needs Availability": "bg-amber-50 text-amber-700 ring-amber-200",
  Rescheduled: "bg-blue-50 text-blue-700 ring-blue-200",
  // research gate results
  Ready: "bg-brand-50 text-brand-700 ring-brand-200",
  "Verified Complete": "bg-brand-50 text-brand-700 ring-brand-200",
  "Revisions Required": "bg-amber-50 text-amber-700 ring-amber-200",
  "Missing Requirements": "bg-red-50 text-red-700 ring-red-200",
  "Pending Staff Action": "bg-amber-50 text-amber-700 ring-amber-200",
  "Awaiting Review": "bg-blue-50 text-blue-700 ring-blue-200",
  Returned: "bg-red-50 text-red-700 ring-red-200",
  // document / course statuses
  Complete: "bg-brand-50 text-brand-700 ring-brand-200",
  Verified: "bg-brand-50 text-brand-700 ring-brand-200",
  "Verified by staff": "bg-brand-50 text-brand-700 ring-brand-200",
  "Submitted for review": "bg-blue-50 text-blue-700 ring-blue-200",
  "Upload required": "bg-red-50 text-red-700 ring-red-200",
  "Pending staff verification": "bg-amber-50 text-amber-700 ring-amber-200",
  "Waiting for student files": "bg-slate-100 text-slate-700 ring-slate-200",
  "Waiting for student submission": "bg-blue-50 text-blue-700 ring-blue-200",
  "Pending panel matching": "bg-amber-50 text-amber-700 ring-amber-200",
  "Pending confirmed schedule": "bg-amber-50 text-amber-700 ring-amber-200",
  Submitted: "bg-blue-50 text-blue-700 ring-blue-200",
  Current: "bg-blue-50 text-blue-700 ring-blue-200",
  Enrolled: "bg-blue-50 text-blue-700 ring-blue-200",
  Incomplete: "bg-amber-50 text-amber-700 ring-amber-200",
  Dropped: "bg-amber-50 text-amber-700 ring-amber-200",
  Missing: "bg-red-50 text-red-700 ring-red-200",
  // tasks
  Pending: "bg-amber-50 text-amber-700 ring-amber-200",
  Overdue: "bg-red-50 text-red-700 ring-red-200",
  Done: "bg-brand-50 text-brand-700 ring-brand-200",
  // planning
  Generated: "bg-brand-50 text-brand-700 ring-brand-200",
  Synced: "bg-brand-50 text-brand-700 ring-brand-200",
  "Sync pending": "bg-amber-50 text-amber-700 ring-amber-200",
  "Needs generation": "bg-amber-50 text-amber-700 ring-amber-200",
  Draft: "bg-slate-100 text-slate-700 ring-slate-200",
  "For Dean Review": "bg-amber-50 text-amber-700 ring-amber-200",
  Submitted: "bg-amber-50 text-amber-700 ring-amber-200",
  Returned: "bg-red-50 text-red-700 ring-red-200",
  Approved: "bg-blue-50 text-blue-700 ring-blue-200",
  Published: "bg-brand-50 text-brand-700 ring-brand-200",
  Suggested: "bg-blue-50 text-blue-700 ring-blue-200",
  "Not Offered": "bg-slate-100 text-slate-700 ring-slate-200",
};

export function statusClass(value) {
  return STATUS_STYLES[value] || "bg-slate-100 text-slate-700 ring-slate-200";
}

export function formatDate(value, opts = { month: "short", day: "numeric", year: "numeric" }) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, opts);
}

export function relativeDays(value) {
  if (!value) return "";
  const d = new Date(value);
  const diff = Math.round((d - new Date()) / 86400000);
  if (diff === 0) return "today";
  if (diff > 0) return `in ${diff}d`;
  return `${Math.abs(diff)}d ago`;
}

export function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

// Brand-aligned chart palette.
export const SEVERITY = {
  high: { label: "High", badge: "bg-red-50 text-red-700 ring-red-200", bar: "bg-red-500", dot: "bg-red-500" },
  medium: { label: "Medium", badge: "bg-amber-50 text-amber-700 ring-amber-200", bar: "bg-amber-500", dot: "bg-amber-500" },
  low: { label: "Low", badge: "bg-brand-50 text-brand-700 ring-brand-200", bar: "bg-brand-500", dot: "bg-brand-500" },
};

export const CHART_COLORS = ["#0f7a44", "#1c9a59", "#3fb673", "#71d094", "#a6e4ba", "#138096", "#f59e0b", "#ef4444"];
export const RISK_COLORS = { Low: "#1c9a59", Medium: "#f59e0b", High: "#ef4444" };
export const SCHEDULE_COLORS = { Confirmed: "#0f7a44", "Needs Availability": "#f59e0b", Rescheduled: "#3b82f6" };
