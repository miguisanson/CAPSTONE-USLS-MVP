// Unit test for lib/facultyHome.js (IM19, packet P7.2): what the faculty home lists under "Needs your action" and
// "Waiting on others", the key numbers and the upcoming-defense entries, all from the portal context the page loads.
// Run: npm run test:faculty-home
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_ACTIONS, facultyActions, facultyStats, facultyUpcoming, facultyWaiting } from "../src/lib/facultyHome.js";

const student = (id, name) => ({ id, name, student_number: `2260${id}`, program_code: "MAED" });
const panel = (id, over = {}) => ({
  student: student(id, `Panel Student ${id}`),
  panel_role: "Panel Chair",
  gate: "Title Defense",
  can_submit_verdict: false,
  can_confirm_revisions: false,
  defense: { id, defense_type: "Title Defense", preferred_date: "2026-10-14", start_time: "09:00", status: "Scheduled", display_status: "Scheduled" },
  ...over,
});
const advisee = (id, over = {}) => ({ student: student(id, `Advisee ${id}`), documents: [], pending_count: 0, revision_reviews: [], ...over });
const ctx = (over = {}) => ({
  faculty: { name: "Dr. Reyes", availability_entered: true },
  panels: [],
  advisees: [],
  upcoming_defenses: [],
  counts: { pending_invitations: 0, pending_adviser_requests: 0 },
  availability: [],
  ...over,
});

test("a faculty member with nothing to do has no actions and no waiting items", () => {
  assert.deepEqual(facultyActions(ctx()), { items: [], total: 0 });
  assert.deepEqual(facultyWaiting(ctx()), { items: [], total: 0 });
});

test("actions: verdicts first (one row per defense), then revisions, invitations, adviser requests, signatures, availability", () => {
  const data = ctx({
    faculty: { name: "Dr. Reyes", availability_entered: false },
    panels: [
      panel(1, { can_submit_verdict: true, defense: { id: 1, defense_type: "Title Defense", preferred_date: "2026-10-10", start_time: "09:00", status: "Scheduled" } }),
      panel(2, { can_submit_verdict: true, defense: { id: 2, defense_type: "Final Defense", preferred_date: "2026-10-05", start_time: "09:00", status: "Scheduled" } }),
      panel(3, { can_confirm_revisions: true }),
    ],
    advisees: [advisee(4, { pending_count: 2 }), advisee(5, { pending_count: 0 }), advisee(6, { pending_count: 1 })],
    counts: { pending_invitations: 3, pending_adviser_requests: 1 },
  });
  const { items, total } = facultyActions(data);
  assert.deepEqual(items.map((i) => i.kind), ["verdict", "verdict", "revisions", "invitations", "adviser", "signatures", "signatures", "availability"]);
  assert.equal(items[0].title, "Record the verdict for Panel Student 2", "the older defense first");
  assert.equal(items[1].title, "Record the verdict for Panel Student 1");
  assert.equal(items[0].target.to, "/faculty-portal/verdicts");
  assert.match(items[2].title, /Confirm the revisions of Panel Student 3/);
  assert.match(items[3].title, /3 panel invitations/);
  assert.equal(items[3].target.to, "/faculty-portal/invitations");
  assert.match(items[4].title, /1 adviser request\b/);
  assert.equal(items[4].target.to, "/faculty-portal/advisees");
  assert.match(items[5].title, /Advisee 4/);
  assert.match(items[5].detail, /2 documents/);
  assert.equal(items[5].target.to, "/faculty-portal/signatures");
  assert.match(items[6].detail, /1 document\b/);
  assert.equal(items[7].target.to, "/faculty-portal/availability");
  assert.equal(items[0].tone, "danger");
  assert.equal(total, 2 + 1 + 3 + 1 + 3 + 1, "units of work: 2 verdicts, 1 revision, 3 invitations, 1 request, 3 documents, availability");
});

test("actions: a panel with nothing to submit is not an action; no availability warning once it is entered", () => {
  const { items } = facultyActions(ctx({ panels: [panel(1)], advisees: [advisee(2)] }));
  assert.deepEqual(items, []);
});

test("actions: capped, the total is not", () => {
  const advisees = Array.from({ length: MAX_ACTIONS + 3 }, (_, i) => advisee(i + 1, { pending_count: 1 }));
  const result = facultyActions(ctx({ advisees }));
  assert.equal(result.items.length, MAX_ACTIONS);
  assert.equal(result.total, MAX_ACTIONS + 3);
});

test("waiting: advisees revising after a defense wait on the student; a defense to re-confirm or schedule waits on the Research Coordinator", () => {
  const data = ctx({
    advisees: [advisee(1, { revision_reviews: [{ id: 9, revision_status: "Awaiting revisions", gate: "Title Defense" }] }), advisee(2, { revision_reviews: [{ id: 10, revision_status: "Revisions confirmed" }] })],
    panels: [
      panel(3, { defense: { id: 3, defense_type: "Final Defense", status: "Needs Re-confirmation", preferred_date: "2026-11-01" } }),
      panel(4, { defense: { id: 4, defense_type: "Title Defense", status: "Pending scheduling" } }),
      panel(5, { defense: { id: 5, defense_type: "Title Defense", status: "Scheduled", preferred_date: "2026-11-02" } }),
    ],
  });
  const { items, total } = facultyWaiting(data);
  assert.equal(total, 3);
  assert.deepEqual(items.map((i) => i.kind), ["revising", "reconfirm", "scheduling"]);
  assert.match(items[0].title, /Advisee 1/);
  assert.match(items[0].detail, /With the student/);
  assert.match(items[1].detail, /With the Research Coordinator/);
  assert.equal(items[0].target.to, "/faculty-portal/advisees");
  assert.equal(items[1].target.to, "/faculty-portal/defenses");
});

test("stats: open items, advisees, panel committees and upcoming defenses, each once", () => {
  const data = ctx({
    advisees: [advisee(1, { pending_count: 1 }), advisee(2)],
    panels: [panel(3), panel(4, { can_submit_verdict: true })],
    upcoming_defenses: [{ student: student(7, "S7"), defense: { id: 1, preferred_date: "2026-10-20" }, my_role: "Panelist" }],
    counts: { pending_invitations: 2, pending_adviser_requests: 0 },
  });
  const stats = facultyStats(data);
  assert.deepEqual(stats.map((s) => s.key), ["open", "advisees", "panels", "defenses"]);
  const by = Object.fromEntries(stats.map((s) => [s.key, s]));
  assert.equal(by.open.value, 1 + 1 + 2, "a document, a verdict and two invitations");
  assert.equal(by.advisees.value, 2);
  assert.equal(by.panels.value, 2);
  assert.equal(by.defenses.value, 1);
  assert.equal(by.advisees.to, "/faculty-portal/advisees");
  assert.equal(by.defenses.to, "/faculty-portal/defenses");
  assert.equal(by.open.tone, "warning");
  assert.equal(facultyStats(ctx()).find((s) => s.key === "open").tone, "success");
});

test("upcoming: the next defenses in date order, capped, with the role the member plays", () => {
  const mk = (id, date) => ({ student: student(id, `S${id}`), defense: { id, defense_type: "Title Defense", preferred_date: date, start_time: "10:00", end_time: "11:00", venue: "Room 1", display_status: "Scheduled", status: "Scheduled" }, my_role: "Panel Chair" });
  const rows = facultyUpcoming(ctx({ upcoming_defenses: [mk(2, "2026-10-25"), mk(1, "2026-10-20"), mk(3, "2026-10-30")] }), 2);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].key, "defense-1");
  assert.equal(rows[0].title, "S1");
  assert.match(rows[0].detail, /Title Defense/);
  assert.match(rows[0].detail, /Panel Chair/);
  assert.equal(rows[0].date, "2026-10-20");
  assert.equal(rows[0].start, "10:00");
  assert.equal(rows[0].to, "/faculty-portal/defenses");
});
