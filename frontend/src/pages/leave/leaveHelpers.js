import { formatDate } from "../../lib/format";

// Small pure helpers for the standalone process board (Leave of Absence, Readmission,
// AWOL & Residency, Withdrawal). Nothing here decides what is allowed: the server sends
// `case.actions` for the signed-in role, and every move is checked again by the server.

export const EMPTY_FILTERS = { query: "", program: "", status: "", reason: "", kind: "", open: false };

// "Open requests only" (the board's ?show=open link, I-196): every status that ends a request leaves the board.
const ENDED_STATUSES = new Set(["Closed", "Approved", "Expired", "Completed", "Denied", "Withdrawn", "Cancelled"]);

// The Dean's "approve" lands on a different status depending on the kind of request.
const APPROVED_STATUSES = ["Leave Scheduled", "Approved"];

export function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many || `${one}s`}`;
}

export function actionTargets(action) {
  if (action.targets?.length) return action.targets;
  return action.to === "*approved*" ? APPROVED_STATUSES : [action.to];
}

export function statusLabelFor(vocabulary, key) {
  if (key === "*approved*") return "Approved";
  return (vocabulary?.statuses || []).find((status) => status.key === key)?.label || key;
}

export function actionsIntoColumn(item, column) {
  return (item.actions || []).filter((action) => actionTargets(action).some((status) => column.statuses.includes(status)));
}

// The steps that can be applied to several requests at once (the server marks them `batch`).
export function batchActionsOf(item) {
  return (item.actions || []).filter((action) => action.batch);
}

// The batch steps every selected request shares, so the bar only offers what works for all of them.
export function commonBatchActions(items) {
  if (!items.length) return [];
  const [first, ...rest] = items.map(batchActionsOf);
  return first.filter((action) => rest.every((list) => list.some((other) => other.action === action.action)));
}

// Up to three short lines describing what the request is about. The server sends `card_lines`
// for AWOL and Withdrawal; Leave and Readmission still build theirs from the period and reason.
export function cardLines(item) {
  if (item.card_lines) return item.card_lines.filter(Boolean);
  const lines = [whenText(item)];
  if (item.reason_category) lines.push(`Reason: ${item.reason_category}`);
  return lines;
}

// The one fact a person scans a card for, shown right under the student's name on every board (I-356, IM24): the reason for a
// leave, the semester a student returns, the residency result of an AWOL case, the subject of a withdrawal. The rest of the
// card (`restLines`) is the detail under it.
export function keyFact(item) {
  if (item.kind === "LOA" || item.kind === "LOA_EXTENSION") return item.reason_category || "Reason not given";
  if (item.kind === "READMISSION") return whenText(item);
  return cardLines(item)[0] || "";
}

export function restLines(item) {
  if (item.kind === "LOA" || item.kind === "LOA_EXTENSION") return [whenText(item)];
  if (item.kind === "READMISSION") return [];
  return cardLines(item).slice(1);
}

// ---- Khloe's card (components/process): the same five facts on every board (IM24) -----------------------------------------
// 1 what it is about (the key fact), 2 its size or period, 3 the status, 4 submitted, 5 updated. Pure text; the card draws them.
export function caseFacts(item) {
  const second = item.kind === "READMISSION"
    ? (item.linked_case?.period_text ? `Leave: ${item.linked_case.period_text}` : "")
    : restLines(item)[0] || "";
  const submitted = item.submitted_at || item.created_at;
  const updated = item.last_activity_at || item.updated_at;
  const short = (value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" }); // no year: it has to fit half a card
  return [
    { text: keyFact(item), wide: true, strong: true, testId: "case-key-fact" },
    { text: second, wide: true },
    { text: item.status_label || item.status, wide: true },
    { text: submitted ? `Submitted ${short(submitted)}` : "Not submitted yet", wide: true },
    { text: updated ? `Updated ${short(updated)}` : "", wide: true },
  ];
}

// The short names of the four readmission checks (the server sends the long handbook wording).
const CHECK_NAMES = [
  [/^Written intention/, "Written intention"],
  [/^Evaluation of subject/, "Subjects evaluated"],
  [/^Clearance from Business/, "Business Office clearance"],
  [/^Interview/, "Interview"],
];

// What this kind of request has to meet, for RequirementBoxes: readmission's system and staff checks, the AWOL residence limit,
// the withdrawal window. Nothing is invented: a process with no requirement returns [].
export function caseRequirements(item) {
  const flagged = (key) => (item.flags || []).some((flag) => flag.key === key);
  if (item.kind === "READMISSION") {
    return (item.checklist || []).map((row) => ({ label: (CHECK_NAMES.find(([pattern]) => pattern.test(row.item)) || [null, row.item])[1], met: Boolean(row.confirmed) }));
  }
  if (item.kind === "AWOL") return [{ label: "Within the residence limits", met: !flagged("residence") }];
  if (item.kind === "WITHDRAWAL") return [{ label: "Within the withdrawal window", met: !flagged("window") }];
  return [];
}

function nothingToDoReason(item, vocabulary) {
  if (item.owner === "Dean") return "A request with the Dean can only be moved by the Dean.";
  if (item.owner === "Student") return "This request is waiting for the student. Only the student can move it.";
  const info = (vocabulary?.statuses || []).find((status) => status.key === item.status);
  if (info?.phase === "done") return "This request is finished, so it cannot be moved.";
  return "No step is open for this request right now.";
}

// The short reason a card sits still, shown on the card itself (StageBoard's lockReason).
export function lockReasonFor(item, vocabulary) {
  if (item.owner) return `Waiting for: ${item.owner}`;
  const info = (vocabulary?.statuses || []).find((status) => status.key === item.status);
  if (info?.phase === "done") return "Finished - nothing more to do";
  return "No step is open right now";
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
  const flags = item.flags ? [...item.flags] : [];
  const hasActions = (item.actions || []).length > 0;
  if (item.flags) {
    // AWOL and Withdrawal: the server already listed what to know; only messages are added here.
    if (item.unresolved_messages > 0) flags.push({ key: "messages", tone: "warn", text: plural(item.unresolved_messages, "open message") });
    return flags;
  }
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
  if (filters.open && ENDED_STATUSES.has(item.status)) return false;
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
