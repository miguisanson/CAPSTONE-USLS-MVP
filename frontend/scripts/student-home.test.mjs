// Unit test for lib/studentHome.js (IM19, packet P7.0): what goes into the student home's "Needs your action" list
// and "Recent activity" list. Run: npm run test:student-home
import { test } from "node:test";
import assert from "node:assert/strict";
import { studentActions, studentActivity } from "../src/lib/studentHome.js";

const NOW = new Date("2026-10-17T09:00:00");
const RESEARCH = new Set(["Form 1 - Title Defense", "Final Defense"]);
const base = (over = {}) => ({
  student: { current_stage: "Coursework", enrollment_tag: "Regular", standing: "Active" },
  tasks: [],
  workflow_messages: [],
  recommendations: [],
  documents_by_gate: {},
  subject_enrollments: [],
  logs: [],
  ...over,
});
const opts = { now: NOW, researchGates: RESEARCH };

test("a student with nothing waiting has no actions", () => {
  assert.deepEqual(studentActions(base(), opts), []);
});

test("an open clarification request becomes a 'reply needed' action pointing at that request", () => {
  const data = base({
    workflow_messages: [
      { id: 1, recipient_role: "Student", status: "Open", action_type: "return", transaction_slug: "withdrawal", sender_role: "Dean", sender_name: "Dr. Villaruz", comment: "Please attach the signed form.", created_at: "2026-10-16T08:00:00", is_unread: true },
    ],
  });
  const [item, ...rest] = studentActions(data, opts);
  assert.equal(rest.length, 0, "an unread open return is not listed a second time as 'unread messages'");
  assert.match(item.title, /reply needed/i);
  assert.match(item.title, /Subject Withdrawal/);
  assert.match(item.detail, /signed form/);
  assert.deepEqual(item.target, { view: "withdrawal" });
  assert.equal(item.kind, "reply");
});

test("unread messages that are not replies become one 'unread messages' action", () => {
  const msg = (id, extra = {}) => ({ id, recipient_role: "Student", status: "Sent", action_type: "note", transaction_slug: "graduation", is_unread: true, created_at: "2026-10-15T08:00:00", ...extra });
  const items = studentActions(base({ workflow_messages: [msg(1), msg(2), msg(3, { is_unread: false })] }), opts);
  assert.equal(items.length, 1);
  assert.match(items[0].title, /2 unread messages/);
  assert.deepEqual(items[0].target, { to: "/student/messages" });
  assert.match(studentActions(base({ workflow_messages: [msg(1)] }), opts)[0].title, /1 unread message$/);
});

test("tasks: overdue first, then by date; staff-owned tasks say who has them; the link follows the task's action_url", () => {
  const data = base({
    tasks: [
      { id: 1, title: "Later task", owner_role: "Student", due_at: "2026-11-01", status: "Pending", overdue: false },
      { id: 2, title: "Review automatic AWOL policy alert", owner_role: "Academic Coordinator", due_at: "2026-10-17", status: "Pending", overdue: false, action_url: "/workflow/awol" },
      { id: 3, title: "Late task", owner_role: "Student", due_at: "2026-10-01", status: "Pending", overdue: true },
    ],
  });
  const items = studentActions(data, opts);
  assert.deepEqual(items.map((i) => i.title), ["Late task", "Review automatic AWOL policy alert", "Later task"]);
  assert.equal(items[0].tone, "danger");
  assert.match(items[1].detail, /Academic Coordinator/);
  assert.deepEqual(items[1].target, { view: "awol" });
  assert.deepEqual(items[0].target, { to: "/student/requests" }, "a task with no page of its own goes to the Request Center");
  assert.equal(items[2].dueAt, "2026-11-01");
});

test("the leave / AWOL banner is an action only when it is a warning or an alert", () => {
  const withBanner = (tone, extra = {}) => base({ student: { current_stage: "AWOL", enrollment_tag: "AWOL", standing: "AWOL" }, leave_overview: { banner: { tone, title: "Your record is marked AWOL", text: "Open Return from AWOL to start." }, can_file: {}, ...extra } });
  const [item] = studentActions(withBanner("bad"), opts);
  assert.equal(item.title, "Your record is marked AWOL");
  assert.equal(item.tone, "danger");
  assert.deepEqual(item.target, { view: "awol" });
  assert.equal(studentActions(withBanner("info"), opts).length, 0);
  assert.equal(studentActions(withBanner("good"), opts).length, 0);
  const onLeave = base({ student: { current_stage: "LOA", standing: "On Leave" }, leave_overview: { banner: { tone: "warn", title: "Your leave ends soon", text: "x" }, can_file: { readmission: { allowed: true } } } });
  assert.deepEqual(studentActions(onLeave, opts)[0].target, { view: "readmission" });
});

test("recommendations: at most three, coursework goes to My Progress, severity sets the tone", () => {
  const rec = (code, severity, n) => ({ code, severity, owner: "Academic Coordinator", recommendation: `Rec ${n}` });
  const items = studentActions(base({ recommendations: [rec("coursework", "high", 1), rec("research", "medium", 2), rec("x", "low", 3), rec("y", "low", 4)] }), opts);
  assert.equal(items.length, 3);
  assert.deepEqual(items[0].target, { to: "/student/progress" });
  assert.deepEqual(items[1].target, { to: "/student/requests" });
  assert.deepEqual(items.map((i) => i.tone), ["danger", "warning", "info"]);
  assert.match(items[0].detail, /Owner: Academic Coordinator/);
});

test("missing administrative documents are one action; research gates are left to the Research page", () => {
  const data = base({
    documents_by_gate: {
      Admission: [{ id: 1, status: "Missing", item_name: "Transcript" }, { id: 2, status: "Verified", item_name: "ID" }, { id: 3, status: "Missing", display_name: "Birth certificate" }],
      "Final Defense": [{ id: 4, status: "Missing", item_name: "Manuscript" }],
    },
  });
  const items = studentActions(data, opts);
  assert.equal(items.length, 1);
  assert.match(items[0].title, /2 documents to upload/);
  assert.match(items[0].detail, /Transcript/);
  assert.deepEqual(items[0].target, { to: "/student/documents" });
});

test("subject withdrawal windows count only when they close within 14 days", () => {
  const sub = (id, deadline) => ({ id, course_code: `C-${id}`, term_label: "AY 2026-2027 1st", withdrawal_eligible: true, withdrawal_window: { deadline } });
  const items = studentActions(base({ subject_enrollments: [sub(1, "2026-10-20"), sub(2, "2026-12-30"), { id: 3, course_code: "C-3", withdrawal_eligible: false, withdrawal_window: { deadline: "2026-10-19" } }] }), opts);
  assert.equal(items.length, 1);
  assert.match(items[0].title, /C-1/);
  assert.equal(items[0].dueAt, "2026-10-20");
  assert.deepEqual(items[0].target, { view: "withdrawal" });
});

test("order: replies, banner, tasks, recommendations, documents, deadlines", () => {
  const data = base({
    student: { current_stage: "AWOL", enrollment_tag: "AWOL", standing: "AWOL" },
    leave_overview: { banner: { tone: "bad", title: "B", text: "t" }, can_file: {} },
    tasks: [{ id: 1, title: "T", owner_role: "Student", due_at: "2026-10-18", status: "Pending", overdue: false }],
    recommendations: [{ code: "x", severity: "low", owner: "o", recommendation: "R" }],
    documents_by_gate: { Admission: [{ id: 1, status: "Missing", item_name: "D" }] },
    subject_enrollments: [{ id: 1, course_code: "W", withdrawal_eligible: true, withdrawal_window: { deadline: "2026-10-18" } }],
    workflow_messages: [{ id: 1, recipient_role: "Student", status: "Open", action_type: "return", transaction_slug: "graduation", is_unread: false, created_at: "2026-10-16T08:00:00" }],
  });
  assert.deepEqual(studentActions(data, opts).map((i) => i.kind), ["reply", "banner", "task", "recommendation", "documents", "deadline"]);
});

test("activity: activity-log entries and replies from staff, newest first, capped", () => {
  const data = base({
    logs: [
      { id: 1, result: "Form 1 submitted", actor_role: "Student", next_owner: "Research Coordinator", created_at: "2026-10-10T08:00:00" },
      { id: 2, result: "Form 1 endorsed", actor_role: "Adviser", next_owner: "", created_at: "2026-10-12T08:00:00" },
    ],
    workflow_messages: [
      { id: 7, recipient_role: "Student", sender_role: "Dean", sender_name: "Dr. V", transaction_slug: "graduation", comment: "Approved.", created_at: "2026-10-14T08:00:00", is_unread: true },
      { id: 8, recipient_role: "Dean", sender_role: "Student", transaction_slug: "graduation", comment: "mine", created_at: "2026-10-15T08:00:00" },
    ],
  });
  const items = studentActivity(data, 6);
  assert.deepEqual(items.map((i) => i.key), ["message-7", "log-2", "log-1"]);
  assert.match(items[0].title, /Graduation/);
  assert.equal(items[0].unread, true);
  assert.deepEqual(items[0].target, { view: "graduation" });
  assert.match(items[1].detail, /Pending/);
  assert.equal(studentActivity(data, 2).length, 2);
  assert.deepEqual(studentActivity(base(), 6), []);
});
