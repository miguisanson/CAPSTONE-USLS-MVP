// Unit test for lib/deanHome.js (IM19, packet P7.2): what the Dean home lists under "Needs your action", the key
// numbers, and the recent-decision entries. Run: npm run test:dean-home
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEAN_PROCESSES, MAX_ACTIONS, deanActions, deanActivity, deanStats, processOfType } from "../src/lib/deanHome.js";

const NOW = new Date("2026-10-17T09:00:00");
let n = 0;
const ago = (days) => new Date(NOW.getTime() - days * 86400000 - 3600000).toISOString();
const item = (type, daysAgo, over = {}) => ({
  id: ++n,
  type,
  title: `${type} case ${n}`,
  subtitle: "MAED · note",
  status: "Pending",
  workflow_status: "Dean Review",
  student: { id: n, name: `Student ${n}`, program_code: "MAED" },
  submitted_at: ago(daysAgo),
  ...over,
});
const plan = (daysAgo, over = {}) => ({ id: ++n, program_code: "MSCS", term_label: "AY 2026-2027 2nd Semester", status: "Submitted", submitted_at: ago(daysAgo), offerings: [], ...over });

test("a type belongs to one process; an unknown type belongs to none", () => {
  assert.equal(processOfType("awol-return"), "awol");
  assert.equal(processOfType("withdrawal"), "withdrawal");
  assert.equal(processOfType("nonsense"), null);
  assert.equal(DEAN_PROCESSES.awol.label, "AWOL & Residency");
});

test("actions: oldest first across cases and plans, each pointing at its case or its plan page", () => {
  const a = item("practicum", 3);
  const b = item("leave-of-absence", 12);
  const p = plan(8);
  const { items, total } = deanActions({ pending: [a, b], plans: [p], adviserCount: 0, now: NOW });
  assert.deepEqual(items.map((i) => i.key), [`case-leave-of-absence-${b.id}`, `plan-${p.id}`, `case-practicum-${a.id}`]);
  assert.equal(total, 3);
  assert.equal(items[0].target.to, `/dean/case/leave-of-absence/${b.id}`);
  assert.equal(items[0].title, b.title);
  assert.match(items[0].detail, /Leave of Absence/);
  assert.equal(items[0].days, 12);
  assert.equal(items[1].target.to, "/dean/approvals/course-adjustments");
  assert.match(items[1].title, /MSCS/);
  assert.equal(items[1].days, 8);
});

test("actions: the age sets the tone - blue to a week, amber from 8 days, red from 15", () => {
  const { items } = deanActions({ pending: [item("practicum", 1), item("practicum", 9), item("practicum", 20)], plans: [], adviserCount: 0, now: NOW });
  assert.deepEqual(items.map((i) => i.tone), ["danger", "warning", "info"]);
});

test("actions: adviser designations are one row after the dated ones; they count by decision in the total", () => {
  const { items, total } = deanActions({ pending: [item("practicum", 2)], plans: [], adviserCount: 3, now: NOW });
  assert.equal(items.length, 2);
  assert.equal(items[1].kind, "adviser");
  assert.match(items[1].title, /3 adviser designations/);
  assert.equal(items[1].target.to, "/dean/approvals");
  assert.equal(total, 4, "three designations are three decisions");
  assert.match(deanActions({ pending: [], plans: [], adviserCount: 1, now: NOW }).items[0].title, /1 adviser designation\b/);
});

test("actions: capped, the total is not", () => {
  const pending = Array.from({ length: MAX_ACTIONS + 4 }, (_, i) => item("practicum", i));
  const result = deanActions({ pending, plans: [], adviserCount: 0, now: NOW });
  assert.equal(result.items.length, MAX_ACTIONS);
  assert.equal(result.total, MAX_ACTIONS + 4);
  assert.equal(result.rows, MAX_ACTIONS + 4);
  assert.equal(result.items[0].days, MAX_ACTIONS + 3, "the oldest ones are kept");
});

test("actions: nothing waiting gives an empty list", () => {
  assert.deepEqual(deanActions({ pending: [], plans: [], adviserCount: 0, now: NOW }), { items: [], total: 0, rows: 0 });
});

test("stats: four numbers - decisions waiting, oldest wait, waiting over a week, decided this week", () => {
  const stats = deanStats({
    pending: [item("practicum", 2), item("withdrawal", 10), item("graduation", 16)],
    plans: [plan(1)],
    adviserCount: 2,
    recent: [item("practicum", 1), item("practicum", 6), item("practicum", 30)],
    recentPlans: [plan(2, { status: "Approved", updated_at: ago(2) })],
    now: NOW,
  });
  assert.deepEqual(stats.map((s) => s.key), ["waiting", "oldest", "overdue", "decided"]);
  const by = Object.fromEntries(stats.map((s) => [s.key, s]));
  assert.equal(by.waiting.value, 6, "3 cases + 1 plan + 2 designations");
  assert.match(by.waiting.sub, /5 processes/, "practicum, withdrawal, graduation, course adjustments and adviser designation");
  assert.equal(by.oldest.value, "16 days");
  assert.equal(by.oldest.tone, "danger");
  assert.equal(by.overdue.value, 2, "10 and 16 days are over a week");
  assert.equal(by.decided.value, 3, "1 and 6 days ago plus the plan decided 2 days ago; not the 30-day-old one");
  assert.equal(by.decided.to, "/dean/activity");
  assert.equal(by.waiting.to, "/dean/approvals");
});

test("stats: with nothing waiting the numbers say so, in a calm tone", () => {
  const by = Object.fromEntries(deanStats({ pending: [], plans: [], adviserCount: 0, recent: [], recentPlans: [], now: NOW }).map((s) => [s.key, s]));
  assert.equal(by.waiting.value, 0);
  assert.equal(by.waiting.tone, "success");
  assert.equal(by.oldest.value, "None");
  assert.equal(by.overdue.value, 0);
  assert.equal(by.overdue.tone, "success");
  assert.equal(by.decided.value, 0);
});

test("stats: a single day reads '1 day'; a case filed today reads 'Today'", () => {
  const one = deanStats({ pending: [item("practicum", 1)], plans: [], adviserCount: 0, recent: [], recentPlans: [], now: NOW });
  assert.equal(one.find((s) => s.key === "oldest").value, "1 day");
  const today = deanStats({ pending: [item("practicum", 0)], plans: [], adviserCount: 0, recent: [], recentPlans: [], now: NOW });
  assert.equal(today.find((s) => s.key === "oldest").value, "Today");
});

test("activity: recent decisions, newest first, cases and plans together, capped", () => {
  const old = item("practicum", 9, { status: "Dean Reviewed" });
  const mid = item("withdrawal", 4, { status: "Approved", last_activity_at: ago(3) });
  const newPlan = plan(5, { status: "Returned", updated_at: ago(1) });
  const rows = deanActivity({ recent: [old, mid], recentPlans: [newPlan], limit: 2 });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].key, `plan-${newPlan.id}`);
  assert.equal(rows[0].to, "/dean/approvals/course-adjustments");
  assert.match(rows[0].title, /MSCS/);
  assert.equal(rows[0].detail, "Returned");
  assert.equal(rows[1].key, `case-withdrawal-${mid.id}`);
  assert.equal(rows[1].to, `/dean/case/withdrawal/${mid.id}`);
  assert.equal(rows[1].at, mid.last_activity_at, "the latest activity date is preferred over the filing date");
  assert.deepEqual(deanActivity({ recent: [], recentPlans: [] }), []);
});
