// Unit test for lib/staffHome.js (IM19 + AD7, packet P7.1): what the back-office home lists under "Needs your action"
// and "Waiting on others", the key numbers, and the recent-activity entries. Run: npm run test:staff-home
import { test } from "node:test";
import assert from "node:assert/strict";
import { openPageLabel } from "../src/lib/labels.js";
import {
  MAX_ACTIONS,
  activityTitle,
  officeActions,
  officeActivity,
  officeOf,
  officeStats,
  firstNameOf,
  officeWaiting,
  taskTarget,
} from "../src/lib/staffHome.js";

const NOW = new Date("2026-10-17T09:00:00");
let n = 0;
const task = (owner_role, title, due_at, extra = {}) => ({
  id: ++n,
  title,
  owner_role,
  due_at,
  status: "Pending",
  overdue: due_at < "2026-10-17",
  student_id: 7,
  student_name: "Ana Reyes",
  action_url: null,
  ...extra,
});

test("each role has one office; admin works as the Graduate School office", () => {
  assert.equal(officeOf("staff"), "Graduate School Staff");
  assert.equal(officeOf("admin"), "Graduate School Staff");
  assert.equal(officeOf("academic_coordinator"), "Academic Coordinator");
  assert.equal(officeOf("research_coordinator"), "Research Coordinator");
  assert.equal(officeOf("dean"), "");
});

test("actions: only this office's tasks, overdue first (oldest first), then the one due soonest", () => {
  const tasks = [
    task("Graduate School Staff", "Later", "2026-11-01"),
    task("Dean", "Dean's task", "2026-10-01"),
    task("Graduate School Staff", "Soon", "2026-10-18"),
    task("GS Staff", "Old spelling, overdue less", "2026-10-10"),
    task("Graduate School Staff", "Overdue most", "2026-10-02"),
    task("Student", "Student's task", "2026-10-01"),
  ];
  const { items, total, overdue } = officeActions(tasks, "staff", { now: NOW });
  assert.deepEqual(items.map((i) => i.title), ["Overdue most", "Old spelling, overdue less", "Soon", "Later"], "the Dean's and the student's tasks are not this office's action");
  assert.equal(total, 4);
  assert.equal(overdue, 2);
  assert.equal(items[0].tone, "danger");
  assert.equal(items[0].status, "Overdue");
  assert.equal(items[2].tone, "warning", "due within two days");
  assert.equal(items[3].tone, "info");
  assert.equal(items[3].status, "Pending");
  assert.equal(items[0].dueAt, "2026-10-02");
  assert.equal(items[0].detail, "Ana Reyes");
});

test("actions: the admin account sees the Graduate School office's tasks; the coordinators see their own", () => {
  const tasks = [task("Graduate School Staff", "GS", "2026-10-20"), task("Academic Coordinator", "AC", "2026-10-20"), task("Research Coordinator", "RC", "2026-10-20")];
  assert.deepEqual(officeActions(tasks, "admin", { now: NOW }).items.map((i) => i.title), ["GS"]);
  assert.deepEqual(officeActions(tasks, "academic_coordinator", { now: NOW }).items.map((i) => i.title), ["AC"]);
  assert.deepEqual(officeActions(tasks, "research_coordinator", { now: NOW }).items.map((i) => i.title), ["RC"]);
  assert.deepEqual(officeActions([], "staff", { now: NOW }), { items: [], total: 0, overdue: 0, dueSoon: 0 });
});

test("actions: the list is capped, the total and the overdue count are not", () => {
  const tasks = Array.from({ length: MAX_ACTIONS + 5 }, (_, i) => task("Graduate School Staff", `T${i}`, `2026-10-${String(20 + (i % 9)).padStart(2, "0")}`));
  tasks.push(task("Graduate School Staff", "Late", "2026-10-01"));
  const result = officeActions(tasks, "staff", { now: NOW });
  assert.equal(result.items.length, MAX_ACTIONS);
  assert.equal(result.total, MAX_ACTIONS + 6);
  assert.equal(result.overdue, 1);
  assert.equal(result.items[0].title, "Late");
});

test("actions: dueSoon counts own tasks that are not overdue and fall due within seven days", () => {
  const tasks = [task("Dean", "x", "2026-10-18"), task("Academic Coordinator", "a", "2026-10-17"), task("Academic Coordinator", "b", "2026-10-24"), task("Academic Coordinator", "c", "2026-10-25"), task("Academic Coordinator", "late", "2026-10-01")];
  assert.equal(officeActions(tasks, "academic_coordinator", { now: NOW }).dueSoon, 2);
});

test("where a task opens: its own action_url, else the workflow page its title names, else the student record, else the work queue", () => {
  const to = (title, role = "staff", extra = {}) => taskTarget(task("Graduate School Staff", title, "2026-10-20", extra), role).to;
  assert.equal(to("Anything", "staff", { action_url: "/workflow/awol" }), "/workflow/awol");
  assert.equal(to("Record and forward practicum MOA"), "/workflow/practicum");
  assert.equal(to("Record and forward withdrawal request"), "/workflow/withdrawal");
  assert.equal(to("Prepare graduation endorsement list"), "/workflow/graduation");
  assert.equal(to("Export endorsed list for manual Registrar email"), "/workflow/graduation");
  assert.equal(to("Complete admission handoff missing items"), "/workflow/student-handoff");
  assert.equal(to("Resolve missing curriculum subjects"), "/course-adjustments");
  assert.equal(to("Tell the Registrar the approved leave was cancelled"), "/workflow/leave-of-absence");
  assert.equal(to("Review student readmission request"), "/workflow/readmission");
  assert.equal(to("Send the adviser application to the Dean"), "/workflow/research-gate?view=adviser");
  assert.equal(to("Receive Forms 3.2 and 3.3 (advising contract)"), "/workflow/research-gate?view=adviser");
  assert.equal(to("Something unknown"), "/students/7", "staff may open the student record");
  assert.equal(taskTarget(task("Research Coordinator", "Something unknown", "2026-10-20"), "research_coordinator").to, "/work-queue", "the Research Coordinator has no Students page");
  assert.equal(taskTarget(task("Graduate School Staff", "Something unknown", "2026-10-20", { student_id: null }), "staff").to, "/work-queue");
  assert.ok(taskTarget(task("Graduate School Staff", "Record and forward practicum MOA", "2026-10-20"), "staff").label);
});

test("waiting: tasks held by another office or the student, overdue first, each pointing at that owner's Work Queue", () => {
  const tasks = [
    task("Graduate School Staff", "Mine", "2026-10-02"),
    task("Dean", "Dean late", "2026-10-05"),
    task("Student", "Student soon", "2026-10-19"),
    task("Academic Coordinator", "AC later", "2026-11-02"),
    task("Dean", "Dean later", "2026-10-30"),
  ];
  const waiting = officeWaiting(tasks, "staff", { now: NOW });
  assert.deepEqual(waiting.items.map((i) => i.title), ["Dean late", "Student soon", "Dean later", "AC later"]);
  assert.equal(waiting.total, 4);
  assert.ok(waiting.items.every((i) => i.tone === "neutral"));
  assert.match(waiting.items[0].detail, /With the Dean/);
  assert.match(waiting.items[1].detail, /With the Student/);
  assert.equal(waiting.items[0].target.to, "/work-queue?owner=Dean");
  assert.equal(waiting.items[3].target.to, "/work-queue?owner=Academic%20Coordinator");
  assert.equal(waiting.items[0].status, "Overdue");
  assert.deepEqual(officeWaiting([], "staff", { now: NOW }), { items: [], total: 0 });
});

test("key numbers, staff: own open tasks, students monitored, at risk or delayed, confirmed defenses - four, each once", () => {
  const kpis = { total_students: 120, active_students: 100, at_risk: 14, high_risk: 3, confirmed_schedules: 5, needs_availability: 2 };
  const stats = officeStats({ role: "staff", own: { total: 6, overdue: 2, dueSoon: 1 }, waiting: { total: 9 }, kpis });
  assert.deepEqual(stats.map((s) => s.key), ["tasks", "students", "risk", "defenses"]);
  assert.equal(stats[0].value, 6);
  assert.match(stats[0].sub, /2 overdue/);
  assert.equal(stats[0].tone, "danger");
  assert.equal(stats[1].value, 120);
  assert.match(stats[1].sub, /100 active/);
  assert.equal(stats[1].to, "/students");
  assert.equal(stats[2].value, 14);
  assert.match(stats[2].sub, /3 delayed/);
  assert.match(stats[2].to, /^\/students\?risk=/);
  assert.equal(stats[3].value, 5);
  assert.match(stats[3].sub, /2 awaiting availability/);
  assert.equal(new Set(stats.map((s) => s.label)).size, 4);
  assert.equal(officeStats({ role: "staff", own: { total: 0, overdue: 0, dueSoon: 0 }, waiting: { total: 0 }, kpis })[0].tone, "neutral");
});

test("key numbers, a coordinator (no dashboard figures): own open tasks, due within seven days, held by other offices", () => {
  const stats = officeStats({ role: "research_coordinator", own: { total: 3, overdue: 0, dueSoon: 2 }, waiting: { total: 11 }, kpis: null });
  assert.deepEqual(stats.map((s) => s.key), ["tasks", "soon", "waiting"]);
  assert.deepEqual(stats.map((s) => s.value), [3, 2, 11]);
  assert.equal(stats[0].to, "/work-queue?owner=Research%20Coordinator");
  assert.ok(stats.every((s) => !String(s.to || "").startsWith("/students")), "the Research Coordinator has no Students page");
});

test("activity: recent transactions, newest first, capped, each pointing at its student", () => {
  const logs = [
    { id: 1, result: "Form 1 endorsed", student_id: 4, student_name: "Ana Reyes", next_owner: "Dean", created_at: "2026-10-10T08:00:00" },
    { id: 2, result: "Course audit run", student_id: null, source_reference: "Course audit", next_owner: "", created_at: "2026-10-12T08:00:00" },
    { id: 3, result: "Graduation list sent", student_id: 5, student_name: "Ben Cruz", next_owner: "Registrar", created_at: "2026-10-14T08:00:00" },
  ];
  const items = officeActivity(logs, 2);
  assert.deepEqual(items.map((i) => i.key), ["log-3", "log-2"]);
  assert.equal(items[0].title, "Graduation list sent");
  assert.match(items[0].detail, /Ben Cruz/);
  assert.match(items[0].detail, /next: Registrar/);
  assert.equal(items[0].to, "/students/5");
  assert.equal(items[1].to, undefined, "an entry about no student has no link");
  assert.match(items[1].detail, /Course audit/);
  assert.deepEqual(officeActivity([], 5), []);
});

test("the welcome name skips an honorific", () => {
  assert.equal(firstNameOf("Grace Fernandez"), "Grace");
  assert.equal(firstNameOf("Dr. Ramon Alvarez"), "Ramon");
  assert.equal(firstNameOf("Prof Ana Lim"), "Ana");
  assert.equal(firstNameOf(""), "");
  assert.equal(firstNameOf(undefined), "");
});

test("waiting (I-083): identical alerts held by one owner are one row with a count; other titles stay single", () => {
  const alert = (student) => task("Academic Coordinator", "Review automatic AWOL policy alert", "2026-10-22", { student_name: student });
  const waiting = officeWaiting(
    [alert("Paulo Garcia"), alert("Clarisse Tan"), alert("Maya Torres"), task("Dean", "Review automatic AWOL policy alert", "2026-10-23"), task("Student", "Upload the signed form", "2026-10-25")],
    "staff",
  );
  assert.deepEqual(waiting.items.map((i) => i.title), ["3 automatic AWOL policy alerts", "Review automatic AWOL policy alert", "Upload the signed form"], "the Dean's single alert is not merged with the Academic Coordinator's three");
  assert.equal(waiting.total, 5, "the total counts tasks, not rows");
  assert.equal(waiting.items[0].count, 3);
  assert.match(waiting.items[0].detail, /With the Academic Coordinator\. Paulo Garcia, Clarisse Tan, Maya Torres/);
  // I-116: the grouped row opens that owner's queue already searching for the alert's title; a single row does not
  assert.equal(waiting.items[0].target.to, "/work-queue?owner=Academic%20Coordinator&q=Review%20automatic%20AWOL%20policy%20alert");
  assert.equal(waiting.items[1].target.to, "/work-queue?owner=Dean");
});

test("button words (I-116): every 'Open <page>' label is the page's name from labels.js", () => {
  const label = (title, extra = {}) => taskTarget(task("Graduate School Staff", title, "2026-10-20", extra), "staff").label;
  assert.equal(label("Anything", { action_url: "/workflow/withdrawal", action_label: "Open Withdrawal" }), "Open Subject Withdrawal", "the server's own words are replaced by the page's name");
  assert.equal(label("Anything", { action_url: "/workflow/awol", action_label: "Open AWOL & Residency" }), "Open AWOL & Residency");
  assert.equal(label("Record and forward withdrawal request"), "Open Subject Withdrawal");
  assert.equal(label("Prepare graduation endorsement list"), "Open Graduation Endorsement");
  assert.equal(label("Something unknown"), "Open Student Record");
  assert.equal(label("Something unknown", { student_id: null }), "Open Work Queue");
  assert.equal(label("Anything", { action_url: "/somewhere-new", action_label: "Open Elsewhere" }), "Open Elsewhere", "an unknown path keeps the server's label");
  assert.equal(openPageLabel("/workflow/research-gate?view=adviser"), "Open Research Gate");
  assert.equal(officeWaiting([task("Dean", "x", "2026-10-20")], "staff").items[0].target.label, "Open Work Queue");
});

test("activity titles (I-116): the category word 'Other' never stands alone as a title", () => {
  assert.equal(activityTitle("Other resolved"), "Monitoring flag resolved");
  assert.equal(activityTitle("Other flagged for Ana Reyes (2260001) on the whole record."), "Monitoring flag raised for Ana Reyes (2260001) on the whole record.");
  assert.equal(activityTitle("Missing record resolved"), "Missing record resolved");
  assert.equal(activityTitle("Other things happened"), "Other things happened");
  assert.equal(activityTitle(undefined), "");
  const [entry] = officeActivity([{ id: 1, result: "Other resolved", student_id: 4, student_name: "Ana Reyes", next_owner: "Academic Coordinator", created_at: "2026-10-10T08:00:00" }]);
  assert.equal(entry.title, "Monitoring flag resolved");
});

test("where a task opens (I-109): a coordinator is never sent to a page its role cannot open", () => {
  const ac = (title, extra = {}) => taskTarget(task("Academic Coordinator", title, "2026-10-20", extra), "academic_coordinator").to;
  assert.equal(ac("Schedule the proposal defense"), "/students/7", "Defense Scheduling is the Research Coordinator's page");
  assert.equal(ac("Complete admission handoff missing items"), "/students/7");
  assert.equal(ac("Review student readmission request", { action_url: "/workflow/readmission" }), "/students/7");
  assert.equal(ac("Record and forward practicum MOA"), "/workflow/practicum", "the Academic Coordinator keeps its own pages");
  assert.equal(ac("Resolve missing curriculum subjects"), "/course-adjustments");
  const rc = (title, extra = {}) => taskTarget(task("Research Coordinator", title, "2026-10-20", extra), "research_coordinator").to;
  assert.equal(rc("Schedule the proposal defense"), "/workflow/defense-scheduling");
  assert.equal(rc("Resolve missing curriculum subjects"), "/work-queue", "no Course Adjustments for the Research Coordinator, and no Students page");
});
