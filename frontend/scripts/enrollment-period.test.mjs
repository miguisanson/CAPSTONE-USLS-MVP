// Test for src/lib/enrollmentPeriod.js (I-355). Run: node --test scripts/enrollment-period.test.mjs
// The enrollment period is the term's planning window (planning_window_open .. planning_window_close). Written before the module exists.
import test from "node:test";
import assert from "node:assert/strict";
import { enrollmentPeriod } from "../src/lib/enrollmentPeriod.js";

const TODAY = "2026-11-04";

test("inside the window: open, with the closing date", () => {
  const p = enrollmentPeriod({ planning_window_open: "2026-10-01", planning_window_close: "2026-11-20" }, TODAY);
  assert.equal(p.state, "open");
  assert.equal(p.closed, false);
  assert.equal(p.until, "2026-11-20");
  assert.equal(p.reason, "");
});

test("the closing day itself is still open", () => {
  assert.equal(enrollmentPeriod({ planning_window_close: "2026-11-04" }, TODAY).state, "open");
});

test("after the closing date: closed since that date, with the reason the controls show", () => {
  const p = enrollmentPeriod({ planning_window_open: "2026-08-01", planning_window_close: "2026-11-03" }, TODAY);
  assert.equal(p.state, "closed");
  assert.equal(p.closed, true);
  assert.equal(p.since, "2026-11-03");
  assert.match(p.reason, /enrollment period/i);
});

test("before the opening date: closed, and says when it opens", () => {
  const p = enrollmentPeriod({ planning_window_open: "2026-12-01", planning_window_close: "2026-12-20" }, TODAY);
  assert.equal(p.state, "closed");
  assert.equal(p.opens, "2026-12-01");
  assert.equal(p.since, undefined);
});

test("no dates set: open, without a closing date (the Graduate School has not set one)", () => {
  const p = enrollmentPeriod({ planning_window_open: null, planning_window_close: null }, TODAY);
  assert.equal(p.state, "open");
  assert.equal(p.until, null);
});

test("no term: nothing to say", () => {
  assert.equal(enrollmentPeriod(null, TODAY), null);
});
