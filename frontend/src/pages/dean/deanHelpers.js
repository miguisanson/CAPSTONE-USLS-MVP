import { deanStats, processOfType } from "../../lib/deanHome.js";

export const CLARIFICATION_TEMPLATES = [
  "Please upload the correct document.",
  "The submitted file is unreadable. Please re-upload a clearer copy.",
  "Please complete the missing required fields.",
  "The document needs the proper signature before approval.",
  "Please clarify the information entered in this section.",
  "Returned for revision. Please review the comments and resubmit.",
  "Forwarding this request for dean review.",
  "Sending this back to the previous stage for correction.",
  "Other / Custom comment",
];

export function deanItemDate(item) {
  return item.last_activity_at || item.submitted_at || item.record?.updated_at || "";
}

export function deanDateMatches(value, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  const timestamp = new Date(value || 0).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
  return (!from || timestamp >= from) && (!to || timestamp <= to);
}

export function sortDeanItems(items, sort) {
  return [...items].sort((left, right) => {
    if (sort === "student") return (left.student?.name || left.title || "").localeCompare(right.student?.name || right.title || "");
    const leftDate = new Date(deanItemDate(left) || 0).getTime();
    const rightDate = new Date(deanItemDate(right) || 0).getTime();
    return sort === "oldest" ? leftDate - rightDate : rightDate - leftDate;
  });
}

export function graduationBatchLabel(item, fallback = "No batch assigned") {
  return item.batch_name || item.record?.batch_name || fallback;
}

// ---------------------------------------------------------------- Decisions (home and Reports & Analytics)
// The Dean home and Reports & Analytics must give the same numbers (I-074). Both read the decided cases from ONE
// place: this list, built from /api/approvals `workflow_recent` and `workflow_overview` (a decided case can be in
// either) plus the course plans in `recent`.
const OUTCOME_STATUSES = {
  approved: [
    "Approved", "Dean Approved", "Dean Reviewed", "Withdrawn Confirmed", "Approved for Re-enrollment Review", "Published",
    "Leave Scheduled", "On Leave", "Return Due", "Closed", "Expired", "Sent to Registrar", "Registrar Received",
  ],
  returned: ["Returned", "Returned for Clarification", "Returned for Revision", "Additional Certificates Requested"],
  denied: ["Denied", "Rejected", "Cancelled"],
};

/** What the Dean decided on a case or a course plan: "approved", "returned", "denied", or null while it still waits. */
export function deanOutcome(item) {
  const statuses = [item.status, item.workflow_status];
  return Object.keys(OUTCOME_STATUSES).find((outcome) => statuses.some((status) => OUTCOME_STATUSES[outcome].includes(status))) || null;
}

/**
 * Every decision the Dean's pages know about, each once: [{ key, process, outcome, item }]. A course plan has the
 * process "course-adjustments".
 */
export function deanDecisions({ recent = [], overview = [], recentPlans = [] } = {}) {
  const seen = new Set();
  const cases = [...recent, ...overview].flatMap((item) => {
    const key = `${item.type}-${item.id}`;
    const outcome = deanOutcome(item);
    if (!outcome || seen.has(key)) return [];
    seen.add(key);
    return [{ key, process: processOfType(item.type), outcome, item }];
  });
  const plans = recentPlans.flatMap((plan) => {
    const outcome = deanOutcome(plan);
    return outcome ? [{ key: `plan-${plan.id}`, process: "course-adjustments", outcome, item: plan }] : [];
  });
  return [...cases, ...plans];
}

/** How many decisions were made in the last seven days: the Dean home's own figure, so both pages show the same one. */
export function deanDecidedThisWeek({ recent = [], recentPlans = [], now = new Date() } = {}) {
  return deanStats({ recent, recentPlans, now }).find((stat) => stat.key === "decided").value;
}
