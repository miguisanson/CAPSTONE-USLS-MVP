// What the Dean home lists (IM19, packet P7.2): the "Needs your action" decisions, the key numbers and the recent
// decisions, built from the data the Dean pages already load (/api/approvals and the open adviser appointments) - no
// new data. Plain JavaScript on purpose: Node can import it (scripts/dean-home.test.mjs).
//
// A decision's `target` is { to, label }: `to` is an app path, `label` names the page for the link button.
// Dates stay raw (ISO strings); the page formats them.

/** The most "Needs your action" rows shown; the Approvals Queue holds the rest. */
export const MAX_ACTIONS = 8;
const WARNING_DAYS = 8; // amber from 8 days waiting (the Dean's age badge uses the same steps)
const DANGER_DAYS = 15; // red from 15
const WEEK_DAYS = 7;
const DAY = 86400000;

// Approval "processes" as the Dean sees them. Several workflow types share a page (LOA, readmission and AWOL returns
// are all standing changes).
export const DEAN_PROCESSES = {
  "course-adjustments": { label: "Course Adjustments", types: [] },
  "leave-of-absence": { label: "Leave of Absence", types: ["leave-of-absence"] },
  readmission: { label: "Readmission", types: ["readmission"] },
  awol: { label: "AWOL & Residency", types: ["awol-return"] },
  withdrawal: { label: "Withdrawal Requests", types: ["withdrawal"] },
  practicum: { label: "Practicum Reports", types: ["practicum"] },
  graduation: { label: "Graduation Endorsement", types: ["graduation"] },
};

export function processOfType(type) {
  return Object.keys(DEAN_PROCESSES).find((key) => DEAN_PROCESSES[key].types.includes(type)) || null;
}
const labelOfType = (type) => {
  const key = processOfType(type);
  return key ? DEAN_PROCESSES[key].label : type;
};

const stamp = (value) => {
  const t = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(t) || t <= 0 ? null : t;
};
/** Whole days since `value` (never negative); null when there is no date. */
const daysSince = (value, now) => {
  const t = stamp(value);
  return t === null ? null : Math.max(0, Math.floor((now.getTime() - t) / DAY));
};
const toneOfDays = (days) => (days === null ? "info" : days >= DANGER_DAYS ? "danger" : days >= WARNING_DAYS ? "warning" : "info");

const casePath = (item) => `/dean/case/${item.type}/${item.id}`;
const PLAN_PATH = "/dean/approvals/course-adjustments";
const QUEUE_PATH = "/dean/approvals";
const HISTORY_PATH = "/dean/activity";
/** When a case entered the Dean's list: the filing date, else its latest activity. */
const filedAt = (item) => item.submitted_at || item.last_activity_at || item.record?.updated_at || "";
/** The latest thing that happened to a decided case. */
const lastActivity = (item) => item.last_activity_at || item.submitted_at || item.record?.updated_at || "";
const planTitle = (plan) => `Course offerings · ${plan.program_code}`;

/**
 * The decisions waiting on the Dean as "Needs your action" rows: oldest first, the adviser designations (one row,
 * no date) after them.
 * @param pending       /api/approvals `workflow_pending` (already filtered the way the Dean pages filter it)
 * @param plans         /api/approvals `pending` (course offering plans)
 * @param adviserCount  open adviser appointments the Dean can decide
 * @returns { items (at most `limit`), total (decisions waiting), rows (all rows before the cap) }
 */
export function deanActions({ pending = [], plans = [], adviserCount = 0, now = new Date(), limit = MAX_ACTIONS } = {}) {
  const rows = [
    ...pending.map((item) => {
      const days = daysSince(filedAt(item), now);
      return {
        key: `case-${item.type}-${item.id}`,
        kind: "case",
        title: item.title,
        detail: [labelOfType(item.type), item.subtitle].filter(Boolean).join(" · "),
        filedAt: filedAt(item),
        days,
        tone: toneOfDays(days),
        status: item.workflow_status || item.status,
        target: { to: casePath(item), label: "Review" },
      };
    }),
    ...plans.map((plan) => {
      const days = daysSince(plan.submitted_at, now);
      return {
        key: `plan-${plan.id}`,
        kind: "plan",
        title: planTitle(plan),
        detail: ["Course Adjustments", plan.term_label].filter(Boolean).join(" · "),
        filedAt: plan.submitted_at || "",
        days,
        tone: toneOfDays(days),
        status: plan.status,
        target: { to: PLAN_PATH, label: "Review" },
      };
    }),
  ].sort((a, b) => (stamp(a.filedAt) ?? Infinity) - (stamp(b.filedAt) ?? Infinity));
  if (adviserCount > 0) {
    rows.push({
      key: "adviser-designations",
      kind: "adviser",
      title: `${adviserCount} adviser designation${adviserCount === 1 ? "" : "s"} waiting for your decision`,
      detail: "Adviser Designation · research flow",
      filedAt: "",
      days: null,
      tone: "info",
      status: "",
      target: { to: QUEUE_PATH, label: "Adviser designations" },
    });
  }
  return { items: rows.slice(0, limit), total: pending.length + plans.length + adviserCount, rows: rows.length };
}

/** "Today", "1 day", "12 days". */
export const wordDays = (days) => (days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"}`);

/**
 * The four key numbers, each once: decisions waiting, the oldest wait, how many wait over a week, decisions made in
 * the last seven days. The per-process breakdown is the Approvals Queue.
 * @param recent       /api/approvals `workflow_recent`
 * @param recentPlans  /api/approvals `recent`
 * @returns [{ key, label, value, sub, tone, to }]
 */
export function deanStats({ pending = [], plans = [], adviserCount = 0, recent = [], recentPlans = [], now = new Date() } = {}) {
  const waitingTotal = pending.length + plans.length + adviserCount;
  const aged = [
    ...pending.map((item) => ({ item, days: daysSince(filedAt(item), now), to: casePath(item) })),
    ...plans.map((plan) => ({ item: plan, days: daysSince(plan.submitted_at, now), to: PLAN_PATH })),
  ].filter((entry) => entry.days !== null);
  const oldest = aged.sort((a, b) => b.days - a.days)[0];
  const overWeek = aged.filter((entry) => entry.days > WEEK_DAYS).length;
  const processes = new Set([
    ...pending.map((item) => processOfType(item.type) || item.type),
    ...(plans.length ? ["course-adjustments"] : []),
    ...(adviserCount ? ["adviser"] : []),
  ]).size;
  const weekAgo = now.getTime() - WEEK_DAYS * DAY;
  const decided = [
    ...recent.map((item) => stamp(lastActivity(item))),
    ...recentPlans.map((plan) => stamp(plan.updated_at || plan.approved_at || plan.submitted_at)),
  ].filter((t) => t !== null && t >= weekAgo).length;
  return [
    {
      key: "waiting",
      label: "Decisions waiting",
      value: waitingTotal,
      sub: waitingTotal ? `Across ${processes} process${processes === 1 ? "" : "es"}` : "Nothing is waiting",
      tone: waitingTotal ? "warning" : "success",
      to: QUEUE_PATH,
    },
    {
      key: "oldest",
      label: "Oldest wait",
      value: oldest ? wordDays(oldest.days) : "None",
      sub: oldest ? oldest.item.title || planTitle(oldest.item) : "No decision is waiting",
      tone: oldest ? toneOfDays(oldest.days) : "success",
      to: oldest ? oldest.to : QUEUE_PATH,
    },
    {
      key: "overdue",
      label: "Waiting over 7 days",
      value: overWeek,
      sub: overWeek ? "Decide these first" : "Nothing has waited a week",
      tone: overWeek ? "danger" : "success",
      to: QUEUE_PATH,
    },
    {
      key: "decided",
      label: "Decided this week",
      value: decided,
      sub: "See Decision History",
      tone: "neutral",
      to: HISTORY_PATH,
    },
  ];
}

/**
 * Recent decisions, newest first (cases and course plans together).
 * @returns [{ key, title, detail (the status), at, to }]
 */
export function deanActivity({ recent = [], recentPlans = [], limit = 6 } = {}) {
  return [
    ...recent.map((item) => ({ key: `case-${item.type}-${item.id}`, title: item.title, detail: item.status, at: lastActivity(item), to: casePath(item) })),
    ...recentPlans.map((plan) => ({
      key: `plan-${plan.id}`,
      title: planTitle(plan),
      detail: plan.status,
      at: plan.updated_at || plan.approved_at || plan.submitted_at || "",
      to: PLAN_PATH,
    })),
  ]
    .sort((a, b) => (stamp(b.at) ?? 0) - (stamp(a.at) ?? 0))
    .slice(0, limit);
}
