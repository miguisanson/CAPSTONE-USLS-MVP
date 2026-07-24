// Centralised status -> colour mapping so badges stay consistent and meaningful.
// Colour is never the ONLY signal: every badge also shows a label and (where used) a dot.

const STATUS_STYLES = {
  // risk
  Low: "bg-brand-50 text-brand-700 ring-brand-200",
  Medium: "bg-amber-50 text-amber-700 ring-amber-200",
  High: "bg-red-50 text-red-700 ring-red-200",
  Critical: "bg-red-100 text-red-800 ring-red-300",
  // standing
  Active: "bg-brand-50 text-brand-700 ring-brand-200",
  "On Leave": "bg-amber-50 text-amber-700 ring-amber-200",
  "Withdrawal In Progress": "bg-amber-50 text-amber-700 ring-amber-200",
  Withdrawn: "bg-slate-100 text-slate-700 ring-slate-200",
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
  Uploaded: "bg-blue-50 text-blue-700 ring-blue-200",
  "Pending Review": "bg-amber-50 text-amber-700 ring-amber-200",
  "MOA Received": "bg-blue-50 text-blue-700 ring-blue-200",
  "MOA Submitted": "bg-blue-50 text-blue-700 ring-blue-200",
  "MOA Under Review": "bg-amber-50 text-amber-700 ring-amber-200",
  "Practicum In Progress": "bg-blue-50 text-blue-700 ring-blue-200",
  "Documents Submitted": "bg-blue-50 text-blue-700 ring-blue-200",
  "Under Review": "bg-amber-50 text-amber-700 ring-amber-200",
  "Hours Incomplete": "bg-red-50 text-red-700 ring-red-200",
  "Additional Certificates Requested": "bg-red-50 text-red-700 ring-red-200",
  "Report Sent to Dean": "bg-blue-50 text-blue-700 ring-blue-200",
  "Dean Reviewed": "bg-brand-50 text-brand-700 ring-brand-200",
  "Dean Review": "bg-amber-50 text-amber-700 ring-amber-200",
  "Approved - Follow-through": "bg-blue-50 text-blue-700 ring-blue-200",
  "Approved - Registrar Preparation": "bg-blue-50 text-blue-700 ring-blue-200",
  "Sent to Registrar": "bg-violet-50 text-violet-700 ring-violet-200",
  "Awaiting Implementation": "bg-amber-50 text-amber-700 ring-amber-200",
  Implemented: "bg-brand-50 text-brand-700 ring-brand-200",
  "Requirements Pending": "bg-amber-50 text-amber-700 ring-amber-200",
  "Requirements Verified": "bg-blue-50 text-blue-700 ring-blue-200",
  "Withdrawn Confirmed": "bg-brand-50 text-brand-700 ring-brand-200",
  Denied: "bg-red-50 text-red-700 ring-red-200",
  Cleared: "bg-brand-50 text-brand-700 ring-brand-200",
  "Not Cleared": "bg-red-50 text-red-700 ring-red-200",
  "Record Updated": "bg-brand-50 text-brand-700 ring-brand-200",
  "Not Required": "bg-slate-100 text-slate-700 ring-slate-200",
  "Not Eligible": "bg-slate-100 text-slate-700 ring-slate-200",
  "Not eligible": "bg-slate-100 text-slate-700 ring-slate-200",
  "Needs verification": "bg-amber-50 text-amber-700 ring-amber-200",
  "Not met": "bg-red-50 text-red-700 ring-red-200",
  Passed: "bg-brand-50 text-brand-700 ring-brand-200",
  "Returned for Clarification": "bg-red-50 text-red-700 ring-red-200",
  "Not Accepted - New Organization Required": "bg-red-50 text-red-700 ring-red-200",
  "For Review": "bg-blue-50 text-blue-700 ring-blue-200",
  "Ready for Dean Review": "bg-amber-50 text-amber-700 ring-amber-200",
  "Returned for Revision": "bg-red-50 text-red-700 ring-red-200",
  "Sent to Registrar": "bg-brand-50 text-brand-700 ring-brand-200",
  "Dean Approved": "bg-brand-50 text-brand-700 ring-brand-200",
  "Pending Handoff": "bg-amber-50 text-amber-700 ring-amber-200",
  Eligible: "bg-brand-50 text-brand-700 ring-brand-200",
  "Eligible to Return": "bg-brand-50 text-brand-700 ring-brand-200",
  Pass: "bg-brand-50 text-brand-700 ring-brand-200",
  Present: "bg-brand-50 text-brand-700 ring-brand-200",
  Fail: "bg-red-50 text-red-700 ring-red-200",
  "Needs Review": "bg-amber-50 text-amber-700 ring-amber-200",
  Compliant: "bg-brand-50 text-brand-700 ring-brand-200",
  "Needs Revision": "bg-amber-50 text-amber-700 ring-amber-200",
  "Not Enough Evidence": "bg-red-50 text-red-700 ring-red-200",
  Open: "bg-brand-50 text-brand-700 ring-brand-200",
  Upcoming: "bg-blue-50 text-blue-700 ring-blue-200",
  Closed: "bg-slate-100 text-slate-700 ring-slate-200",
  Archived: "bg-slate-100 text-slate-500 ring-slate-200",
  "Not set": "bg-slate-100 text-slate-500 ring-slate-200",
  "Active planning": "bg-brand-50 text-brand-700 ring-brand-200",
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
  "Not taken": "bg-slate-100 text-slate-600 ring-slate-200",
  Incomplete: "bg-amber-50 text-amber-700 ring-amber-200",
  Failed: "bg-red-50 text-red-700 ring-red-200",
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

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
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
export const RISK_COLORS = { Low: "#1c9a59", Medium: "#f59e0b", High: "#ef4444", Critical: "#991b1b" };
export const SCHEDULE_COLORS = { Confirmed: "#0f7a44", "Needs Availability": "#f59e0b", Rescheduled: "#3b82f6" };
