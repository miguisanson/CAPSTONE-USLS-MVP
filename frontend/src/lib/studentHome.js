// What the student home lists (IM19, packet P7.0): the "Needs your action" items and the "Recent activity" entries,
// built from the portal context the student pages already load - no new data. Plain JavaScript on purpose: Node can
// import it (scripts/student-home.test.mjs).
//
// An item names its destination as a `target`: { view } is a request view id (research, schedule, loa, readmission,
// awol, withdrawal, practicum, graduation - the page turns it into a path with STUDENT_REQUEST_PATHS) or { to } is a
// student path. Dates stay raw (ISO strings); the page formats them.

/** Short names of the request pages, as the sidebar and the Request Center call them. */
export const VIEW_LABELS = Object.freeze({
  research: "Research Progress",
  schedule: "Defense Schedule",
  loa: "Leave of Absence",
  readmission: "Readmission",
  awol: "Return from AWOL",
  withdrawal: "Subject Withdrawal",
  practicum: "Practicum",
  graduation: "Graduation",
});

/** workflow message `transaction_slug` -> request view id (the slugs that have a student page). */
export const VIEW_BY_SLUG = Object.freeze({
  "leave-of-absence": "loa",
  readmission: "readmission",
  awol: "awol",
  practicum: "practicum",
  withdrawal: "withdrawal",
  graduation: "graduation",
});

const SLUG_LABELS = Object.freeze({ ...Object.fromEntries(Object.entries(VIEW_BY_SLUG).map(([slug, view]) => [slug, VIEW_LABELS[view]])), "course-audit": "Course Audit" });

/** Task `action_url` (set by app.py task_dict) -> request view id. */
const VIEW_BY_TASK_URL = Object.freeze({
  "/workflow/awol": "awol",
  "/workflow/readmission": "readmission",
  "/workflow/leave-of-absence": "loa",
});

export const WITHDRAWAL_WINDOW_DAYS = 14;
const MAX_RECOMMENDATIONS = 3;
const MESSAGES_PATH = "/student/messages";
const REQUEST_CENTER_PATH = "/student/requests";

const requestLabel = (slug) => SLUG_LABELS[slug] || "your request";
const clip = (text, max = 140) => {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const time = (value) => {
  const t = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
};

const isAwol = (student = {}) => student.standing === "AWOL" || student.enrollment_tag === "AWOL" || student.current_stage === "AWOL";
const SEVERITY_TONE = { high: "danger", medium: "warning" };

function bannerTarget(data) {
  if (isAwol(data.student)) return { view: "awol" };
  if (data.leave_overview?.can_file?.readmission?.allowed) return { view: "readmission" };
  return { view: "loa" };
}

/**
 * The items of "Needs your action", most pressing first:
 * replies staff are waiting for, other unread messages, the leave / AWOL alert, open tasks, recommendations,
 * documents to upload, and subject-withdrawal windows closing within two weeks.
 * @param opts.now           the date to measure "within two weeks" from (tests)
 * @param opts.researchGates Set of document gates the Research page owns (left out of "documents to upload")
 * @returns [{ key, kind, title, detail, dueAt, tone, target, status? }]
 */
export function studentActions(data, { now = new Date(), researchGates = new Set() } = {}) {
  const items = [];
  const messages = (data.workflow_messages || []).filter((m) => m.recipient_role === "Student");

  // 1. clarification requests the student has not answered
  const replies = messages.filter((m) => m.status === "Open" && m.action_type === "return");
  for (const m of [...replies].sort((a, b) => time(a.created_at) - time(b.created_at))) {
    const view = VIEW_BY_SLUG[m.transaction_slug];
    items.push({
      key: `reply-${m.id}`,
      kind: "reply",
      title: `Reply needed: ${requestLabel(m.transaction_slug)}`,
      detail: clip(`${m.sender_name || m.sender_role || "Staff"}: ${m.comment || m.template || "asked you for clarification"}`),
      dueAt: m.created_at,
      tone: "warning",
      target: view ? { view } : { to: MESSAGES_PATH },
      status: "Returned for Clarification",
      statusLabel: "Reply needed",
    });
  }

  // 2. everything else that is unread, as one line
  const replyIds = new Set(replies.map((m) => m.id));
  const unread = messages.filter((m) => m.is_unread && !replyIds.has(m.id)).length;
  if (unread > 0) {
    items.push({
      key: "unread",
      kind: "unread",
      title: `${plural(unread, "unread message")}`,
      detail: "Replies and notices on your requests.",
      tone: "info",
      target: { to: MESSAGES_PATH },
    });
  }

  // 3. the leave / AWOL notice when it asks for something
  const banner = data.leave_overview?.banner;
  if (banner && (banner.tone === "bad" || banner.tone === "warn")) {
    items.push({
      key: "leave-banner",
      kind: "banner",
      title: banner.title,
      detail: banner.text || "",
      tone: banner.tone === "bad" ? "danger" : "warning",
      target: bannerTarget(data),
    });
  }

  // 4. tasks on the student's record: overdue first, then by date
  const tasks = [...(data.tasks || [])].sort((a, b) => Number(Boolean(b.overdue)) - Number(Boolean(a.overdue)) || time(a.due_at) - time(b.due_at));
  for (const task of tasks) {
    const view = VIEW_BY_TASK_URL[task.action_url];
    const mine = task.owner_role === "Student";
    items.push({
      key: `task-${task.id}`,
      kind: "task",
      title: task.title,
      detail: mine ? "Assigned to you." : `With the ${task.owner_role || "Graduate School"}.`,
      dueAt: task.due_at,
      tone: task.overdue ? "danger" : mine ? "warning" : "info",
      target: view ? { view } : { to: REQUEST_CENTER_PATH },
      status: task.overdue ? "Overdue" : task.status,
    });
  }

  // 5. what the system recommends
  (data.recommendations || []).slice(0, MAX_RECOMMENDATIONS).forEach((rec, i) => {
    items.push({
      key: `rec-${rec.code || i}-${i}`,
      kind: "recommendation",
      title: rec.recommendation,
      detail: rec.owner ? `Owner: ${rec.owner}` : "",
      tone: SEVERITY_TONE[rec.severity] || "info",
      target: { to: rec.code === "coursework" ? "/student/progress" : REQUEST_CENTER_PATH },
    });
  });

  // 6. administrative documents still missing
  const missing = Object.entries(data.documents_by_gate || {})
    .filter(([gate]) => !researchGates.has(gate))
    .flatMap(([, docs]) => (docs || []).filter((d) => d.status === "Missing"));
  if (missing.length) {
    const names = missing.slice(0, 2).map((d) => d.display_name || d.item_name).filter(Boolean).join(", ");
    items.push({
      key: "documents",
      kind: "documents",
      title: `${plural(missing.length, "document")} to upload`,
      detail: names ? `${names}${missing.length > 2 ? ` and ${missing.length - 2} more` : ""}.` : "",
      tone: "warning",
      target: { to: "/student/documents" },
    });
  }

  // 7. subject withdrawal windows about to close
  const horizon = now.getTime() + WITHDRAWAL_WINDOW_DAYS * 86400000;
  for (const subject of data.subject_enrollments || []) {
    const deadline = subject.withdrawal_eligible ? subject.withdrawal_window?.deadline : null;
    if (!deadline) continue;
    const t = time(deadline);
    if (!t || t < now.getTime() - 86400000 || t > horizon) continue;
    items.push({
      key: `withdraw-${subject.id}`,
      kind: "deadline",
      title: `Subject withdrawal window closes: ${subject.course_code}`,
      detail: subject.term_label || "",
      dueAt: deadline,
      tone: "warning",
      target: { view: "withdrawal" },
    });
  }
  return items;
}

/**
 * Recent activity: the student's activity-log entries and the staff messages sent to them, newest first.
 * @returns [{ key, title, detail, at, unread?, target? }]
 */
export function studentActivity(data, limit = 6) {
  const rows = [];
  for (const log of data.logs || []) {
    rows.push({
      key: `log-${log.id}`,
      title: log.result,
      detail: `${log.actor_role || "System"} - next: ${log.next_owner || "Pending"}`,
      at: log.created_at,
    });
  }
  for (const m of data.workflow_messages || []) {
    if (m.recipient_role !== "Student") continue;
    const view = VIEW_BY_SLUG[m.transaction_slug];
    rows.push({
      key: `message-${m.id}`,
      title: `${requestLabel(m.transaction_slug)}: message from ${m.sender_name || m.sender_role || "staff"}`,
      detail: clip(m.comment || m.template, 100),
      at: m.created_at,
      unread: Boolean(m.is_unread),
      target: view ? { view } : { to: MESSAGES_PATH },
    });
  }
  return rows.sort((a, b) => time(b.at) - time(a.at)).slice(0, limit);
}
