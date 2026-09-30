import { formatDate } from "../../lib/format";

// Small pure helpers for the Leave of Absence / Readmission staff screen.
// Nothing here decides what is allowed: the server sends `case.actions` for the signed-in
// role, and every move is checked again by the server.

export const EMPTY_FILTERS = { query: "", program: "", status: "", reason: "", kind: "" };

// The Dean's "approve" lands on a different status depending on the kind of request.
const APPROVED_STATUSES = ["Leave Scheduled", "Approved"];

export function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many || `${one}s`}`;
}

export function actionTargets(action) {
  return action.to === "*approved*" ? APPROVED_STATUSES : [action.to];
}

export function statusLabelFor(vocabulary, key) {
  if (key === "*approved*") return "Approved";
  return (vocabulary?.statuses || []).find((status) => status.key === key)?.label || key;
}

export function actionsIntoColumn(item, column) {
  return (item.actions || []).filter((action) => actionTargets(action).some((status) => column.statuses.includes(status)));
}

export function batchForwardAction(item) {
  return (item.actions || []).find((action) => action.action === "forward" && action.batch) || null;
}

function nothingToDoReason(item, vocabulary) {
  if (item.owner === "Dean") return "A request with the Dean can only be moved by the Dean.";
  if (item.owner === "Student") return "This request is waiting for the student. Only the student can move it.";
  const info = (vocabulary?.statuses || []).find((status) => status.key === item.status);
  if (info?.phase === "done") return "This request is finished, so it cannot be moved.";
  return "No step is open for this request right now.";
}

// Used by the board for every drop and every "Move to..." choice.
export function checkMoveFor(item, column, vocabulary) {
  const actions = item.actions || [];
  if (!column) return { allowed: false, reason: "That column does not exist." };
  if (actionsIntoColumn(item, column).length) return { allowed: true };
  if (!actions.length) return { allowed: false, reason: nothingToDoReason(item, vocabulary) };
  return {
    allowed: false,
    reason: `From ${item.status_label} you can: ${actions.map((action) => action.label).join(", ")}.`,
  };
}

export function whenText(item) {
  if (item.kind === "READMISSION") return item.target_term ? `Returning: ${item.target_term}` : "Return semester not chosen yet";
  const period = item.period || {};
  const text = period.text || [period.start_label, period.end_label].filter(Boolean).join(" to ");
  if (!text) return "Period not set";
  return period.semesters ? `${text} (${plural(period.semesters, "semester")})` : text;
}

export function whenDates(item) {
  if (item.kind === "READMISSION") return "";
  const period = item.period || {};
  if (!period.start_date && !period.end_date) return "";
  return `${formatDate(period.start_date)} to ${formatDate(period.end_date)}`;
}

export function caseFlags(item, role) {
  const flags = [];
  const hasActions = (item.actions || []).length > 0;
  if (role === "staff" && ["Submitted", "Staff Review"].includes(item.status) && hasActions) {
    flags.push({ key: "review", tone: "info", text: "Awaiting your review" });
  }
  if (item.awol_proposed) flags.push({ key: "awol", tone: "warn", text: "AWOL proposed - confirm or follow up" });
  if (item.overdue_days > 0) {
    flags.push({ key: "overdue", tone: "bad", text: `Overdue ${plural(item.overdue_days, "day")}` });
  } else if (
    ["On Leave", "Return Due"].includes(item.status) &&
    item.days_until_end !== null &&
    item.days_until_end !== undefined &&
    item.days_until_end >= 0 &&
    item.days_until_end <= 60
  ) {
    flags.push({ key: "ends", tone: "muted", text: item.days_until_end === 0 ? "Ends today" : `Ends in ${plural(item.days_until_end, "day")}` });
  }
  if (item.unresolved_messages > 0) flags.push({ key: "messages", tone: "warn", text: plural(item.unresolved_messages, "open message") });
  const registrar = item.registrar?.status;
  if (registrar && registrar !== "Not Ready") {
    flags.push({ key: "registrar", tone: registrar === "Acknowledged" ? "good" : "info", text: `Registrar: ${registrar}` });
  }
  if (item.batch_name) flags.push({ key: "batch", tone: "muted", text: `Batch: ${item.batch_name}` });
  return flags;
}

export function matchesFilters(item, filters) {
  if (filters.program && item.student?.program_code !== filters.program) return false;
  if (filters.status && item.status !== filters.status) return false;
  if (filters.reason && item.reason_category !== filters.reason) return false;
  if (filters.kind && item.kind !== filters.kind) return false;
  const query = (filters.query || "").trim().toLowerCase();
  if (query) {
    const haystack = [item.student?.name, item.student?.student_number, item.student?.program_code, item.student?.program_name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  return true;
}

// "LOA Batch AY 2026-2027 1st Sem" from the start date of the first selected request.
// Philippine school year: 1st Sem starts in August, 2nd Sem in January, Summer in June.
export function defaultBatchName(item, slug) {
  const prefix = slug === "readmission" ? "Readmission Batch" : "LOA Batch";
  if (!item) return prefix;
  const raw = slug === "readmission" ? item.target_start_date || item.period?.start_date : item.period?.start_date;
  const [year, month] = String(raw || "").slice(0, 10).split("-").map(Number);
  if (!year || !month) {
    const label = item.period?.start_label || item.target_term;
    return label ? `${prefix} ${label}` : prefix;
  }
  const zeroMonth = month - 1;
  const startYear = zeroMonth >= 7 ? year : year - 1;
  const semester = zeroMonth >= 7 ? "1st Sem" : zeroMonth <= 4 ? "2nd Sem" : "Summer";
  return `${prefix} AY ${startYear}-${startYear + 1} ${semester}`;
}

export function syncSummary(result) {
  const count = (value) => (Array.isArray(value) ? value.length : Number(value) || 0);
  const started = count(result?.started);
  const returnDue = count(result?.return_due);
  const awol = count(result?.awol_proposed);
  const adopted = count(result?.adopted);
  const parts = [];
  if (started) parts.push(`${plural(started, "leave")} started`);
  if (returnDue) parts.push(`${plural(returnDue, "leave")} now due to return`);
  if (awol) parts.push(`${plural(awol, "leave")} ended with no return filed (AWOL proposed)`);
  if (adopted) parts.push(`${plural(adopted, "older record")} brought in`);
  return { changed: parts.length > 0, text: parts.length ? `Leave dates checked: ${parts.join("; ")}.` : "Leave dates checked. Nothing changed." };
}
