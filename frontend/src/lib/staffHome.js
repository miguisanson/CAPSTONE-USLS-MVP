// What the back-office home lists (IM19 + AD7, packet P7.1): the "Needs your action" tasks of the signed-in office,
// the "Waiting on others" tasks other owners hold, the key numbers, and the recent-activity entries. Built from data
// the home already loads (the work-queue API and the dashboard API) - no new data. Plain JavaScript on purpose: Node
// can import it (scripts/staff-home.test.mjs).
//
// A task's `target` is { to, label }: `to` is an app path, `label` names the page for the link button.
// Dates stay raw (ISO strings); the page formats them.

/** The most "Needs your action" rows shown; the work queue holds the rest. */
export const MAX_ACTIONS = 8;
const DUE_SOON_DAYS = 7;
const WARNING_DAYS = 2;
const DAY = 86400000;

const STAFF_OFFICE = "Graduate School Staff";
const OFFICES = Object.freeze({
  staff: STAFF_OFFICE,
  admin: STAFF_OFFICE, // the administrator reviews the Graduate School's screens, so its tasks are that office's
  academic_coordinator: "Academic Coordinator",
  research_coordinator: "Research Coordinator",
});

/** The task-owner label of a role's office ("" for a role that has no back-office home). */
export const officeOf = (role) => OFFICES[role] || "";

/** One spelling per owner: old rows may say "GS Staff". */
const ownerLabel = (value) => {
  const text = String(value || "").trim();
  return ["gs staff", "staff"].includes(text.toLowerCase()) ? STAFF_OFFICE : text;
};
const time = (value) => {
  const t = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
};
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const isOverdue = (task) => Boolean(task.overdue) || task.status === "Overdue";
const byUrgency = (a, b) => Number(isOverdue(b)) - Number(isOverdue(a)) || time(a.due_at) - time(b.due_at);
const sortTasks = (tasks) => [...tasks].sort(byUrgency);
const workQueuePath = (owner) => `/work-queue?owner=${encodeURIComponent(owner)}`;

// Where a task is handled, by what its title names. Order matters: the first match wins.
const TITLE_TARGETS = [
  [/awol|refresher|return declaration|maximum residence/i, "/workflow/awol", "AWOL & Residency"],
  [/readmi/i, "/workflow/readmission", "Readmission"],
  [/leave/i, "/workflow/leave-of-absence", "Leave of Absence"],
  [/practicum/i, "/workflow/practicum", "Practicum"],
  [/withdrawal/i, "/workflow/withdrawal", "Withdrawal"],
  [/graduation|endorse/i, "/workflow/graduation", "Graduation"],
  [/adviser|advisor|forms? 3/i, "/workflow/research-gate?view=adviser", "Research Gate"],
  [/panel/i, "/workflow/panel-matching", "Panel Matching"],
  [/defense|schedule/i, "/workflow/defense-scheduling", "Defense Scheduling"],
  [/handoff|admission/i, "/workflow/student-handoff", "Student Handoff"],
  [/curriculum|offering plan|course adjust/i, "/course-adjustments", "Course Adjustments"],
];
// The Students page is for Graduate School staff, the administrator and the Academic Coordinator.
const CAN_OPEN_STUDENTS = new Set(["staff", "admin", "academic_coordinator"]);

/**
 * Where "Open" leads for one of the viewer's own tasks: the task's own action_url, else the workflow page its title
 * names, else the student's record (when the role has a Students page), else the work queue.
 * @returns { to, label }
 */
export function taskTarget(task, role) {
  if (task.action_url) return { to: task.action_url, label: task.action_label || "Open" };
  for (const [pattern, to, label] of TITLE_TARGETS) if (pattern.test(task.title || "")) return { to, label };
  if (task.student_id && CAN_OPEN_STUDENTS.has(role)) return { to: `/students/${task.student_id}`, label: "Student record" };
  return { to: "/work-queue", label: "Work Queue" };
}

const toneOf = (task, now) => {
  if (isOverdue(task)) return "danger";
  const days = Math.round((time(task.due_at) - startOfDay(now)) / DAY);
  return days <= WARNING_DAYS ? "warning" : "info";
};

/**
 * The viewer's own open tasks as "Needs your action" rows: overdue first (oldest first), then the one due soonest.
 * Tasks another owner holds are officeWaiting()'s.
 * @param tasks open tasks as /api/tasks returns them
 * @returns { items (at most `limit`), total, overdue, dueSoon } - the three counts cover ALL own tasks, not the capped list
 */
export function officeActions(tasks, role, { now = new Date(), limit = MAX_ACTIONS } = {}) {
  const office = officeOf(role);
  const own = sortTasks((tasks || []).filter((task) => office && ownerLabel(task.owner_role) === office));
  const today = startOfDay(now);
  const horizon = today + (DUE_SOON_DAYS + 1) * DAY; // "within seven days" counts the seventh day
  const items = own.slice(0, limit).map((task) => ({
    key: `task-${task.id}`,
    kind: "task",
    title: task.title,
    detail: task.student_name || "",
    dueAt: task.due_at,
    overdue: isOverdue(task),
    tone: toneOf(task, now),
    status: isOverdue(task) ? "Overdue" : task.status || "Pending",
    target: taskTarget(task, role),
  }));
  return {
    items,
    total: own.length,
    overdue: own.filter(isOverdue).length,
    dueSoon: own.filter((task) => !isOverdue(task) && time(task.due_at) >= today && time(task.due_at) < horizon).length,
  };
}

/**
 * "Waiting on others": open tasks the viewer's office does not hold (another office, or the student). The viewer has
 * nothing to do for them, so they never appear under "Needs your action". Each row opens that owner's work queue.
 * @returns { items (all, overdue first), total }
 */
export function officeWaiting(tasks, role) {
  const office = officeOf(role);
  const held = sortTasks((tasks || []).filter((task) => ownerLabel(task.owner_role) !== office));
  const items = held.map((task) => {
    const owner = ownerLabel(task.owner_role) || "another office";
    return {
      key: `waiting-${task.id}`,
      kind: "waiting",
      title: task.title,
      detail: [`With the ${owner}.`, task.student_name].filter(Boolean).join(" "),
      dueAt: task.due_at,
      overdue: isOverdue(task),
      tone: "neutral",
      status: isOverdue(task) ? "Overdue" : task.status || "Pending",
      target: { to: workQueuePath(owner), label: "Work Queue" },
    };
  });
  return { items, total: items.length };
}

/**
 * The key numbers (3-4, each once). The Graduate School office and the administrator have the dashboard figures;
 * a coordinator has only what the work queue tells (the dashboard API is not theirs to call).
 * @param own      officeActions() result
 * @param waiting  { total } of officeWaiting()
 * @param kpis     /api/dashboard `kpis`, or null
 * @returns [{ key, label, value, sub, tone, to }]
 */
export function officeStats({ role, own, waiting, kpis }) {
  const queue = workQueuePath(officeOf(role));
  const tasks = {
    key: "tasks",
    label: "Your open tasks",
    value: own.total,
    sub: `${own.overdue} overdue`,
    tone: own.overdue ? "danger" : own.total ? "warning" : "neutral",
    to: queue,
  };
  if (kpis) {
    return [
      tasks,
      { key: "students", label: "Students monitored", value: kpis.total_students, sub: `${kpis.active_students} active`, tone: "success", to: "/students" },
      { key: "risk", label: "At risk or delayed", value: kpis.at_risk, sub: `${kpis.high_risk} delayed`, tone: "warning", to: "/students?risk=At Risk of Delay/Delayed" },
      { key: "defenses", label: "Confirmed defenses", value: kpis.confirmed_schedules, sub: `${kpis.needs_availability} awaiting availability`, tone: "info", to: "/workflow/defense-scheduling" },
    ];
  }
  return [
    tasks,
    { key: "soon", label: "Due in 7 days", value: own.dueSoon, sub: "Your tasks, not yet overdue", tone: own.dueSoon ? "warning" : "neutral", to: queue },
    { key: "waiting", label: "Held by others", value: waiting.total, sub: "Other offices and students", tone: "neutral", to: "/work-queue" },
  ];
}

/**
 * Recent activity: the latest recorded transactions, newest first.
 * @param logs /api/dashboard `recent_logs`
 * @returns [{ key, title, detail, at, to? }]
 */
export function officeActivity(logs, limit = 6) {
  return [...(logs || [])]
    .sort((a, b) => time(b.created_at) - time(a.created_at))
    .slice(0, limit)
    .map((log) => ({
      key: `log-${log.id}`,
      title: log.result,
      detail: `${log.student_name || log.source_reference || "Workflow"} · next: ${log.next_owner || "—"}`,
      at: log.created_at,
      to: log.student_id ? `/students/${log.student_id}` : undefined,
    }));
}

/** The first name for "Welcome, ..." - an honorific ("Dr.", "Prof.") is not a name. */
export function firstNameOf(fullName) {
  const words = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  while (words.length > 1 && /^(dr|prof|mr|mrs|ms|engr|atty|fr|sr)\.?$/i.test(words[0])) words.shift();
  return words[0] || "";
}
