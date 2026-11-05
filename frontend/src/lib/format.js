
// One display style for the whole app (I-207). Every date and time a person reads goes through this block:
//   formatDate      "Aug 19, 2026"            formatDay       "Wed, Aug 19, 2026"   (schedules, where the weekday helps)
//   formatDateTime  "Aug 19, 2026, 10:46 AM"  formatClock     "6:00 PM"
//   formatTimeRange "6:00 – 8:00 PM" (same half of the day) or "11:00 AM – 1:00 PM"
// The locale is fixed so a browser set to another region still shows the same style. The server sends Philippine time
// with no offset, so values are read as written (a bare YYYY-MM-DD is a calendar day, never shifted by the time zone).
const LOCALE = "en-US";
const DAY_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function toDate(value) {
  const day = DAY_ONLY.exec(String(value));
  return day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
}

export function formatDate(value, opts = { month: "short", day: "numeric", year: "numeric" }) {
  if (!value) return "—";
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(LOCALE, opts);
}

/** "Wed, Aug 19, 2026": the date with its weekday, for defenses, appointments and calendar details. */
export function formatDay(value) {
  return formatDate(value, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

/** "6:00 PM" from "18:00", "18:00:00" or "2026-08-19T18:00"; "" when there is no time; the raw text when it is not a time. */
export function formatClock(value) {
  if (!value) return "";
  const match = /(\d{1,2}):(\d{2})/.exec(String(value));
  if (!match) return String(value);
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? "AM" : "PM"}`;
}

/** "6:00 – 8:00 PM" when both ends fall in the same half of the day, else "11:00 AM – 1:00 PM"; one time when there is no end. */
export function formatTimeRange(start, end) {
  const from = formatClock(start);
  if (!end) return from;
  const to = formatClock(end);
  const [fromTime, fromHalf] = from.split(" ");
  return fromHalf && fromHalf === to.split(" ")[1] ? `${fromTime} – ${to}` : `${from} – ${to}`;
}

/** Today's date (YYYY-MM-DD) in Philippine time, the same day the server's ph_today() uses (I-200). */
export function todayISO(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** The day after today (YYYY-MM-DD, Philippine time): the earliest date a request may ask for. */
export function tomorrowISO(now = new Date()) {
  return todayISO(new Date(now.getTime() + 86400000));
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(LOCALE, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
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
