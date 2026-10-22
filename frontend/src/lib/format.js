
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

/** One CSV field: arrays join with "; ", everything is quoted, quotes doubled. A text that starts like a spreadsheet
 *  formula (= @, or + - followed by a letter) gets a leading apostrophe so Excel shows it instead of running it. */
export function csvCell(value) {
  let text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  if (/^(=|@|[+-][^\d.\s])/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Saves a Blob (or text) as a download named `filename`. */
export function downloadBlob(blob, filename) {
  const file = blob instanceof Blob ? blob : new Blob([blob], { type: "text/plain" });
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
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
export const RISK_COLORS = {
  "On Track": "#1c9a59",
  "At Risk of Delay": "#f59e0b",
  Delayed: "#ef4444",
  "Not Yet Assessed": "#94a3b8",
};
export const SCHEDULE_COLORS = { Confirmed: "#0f7a44", "Needs Availability": "#f59e0b", Rescheduled: "#3b82f6" };
