// Test for src/lib/status.js (Phase 5 UI-SPEC section 3a). Run: node --test scripts/status.test.mjs
// Written before the module exists. status.js must be importable by plain Node (no Vite, no JSX).
import test from "node:test";
import assert from "node:assert/strict";
import { SERVER_TONE, STATUS_GROUPS, STATUS_TONE, statusLabel, statusTone } from "../src/lib/status.js";

test("known statuses map to the tone the spec gives them", () => {
  assert.equal(statusTone("Approved"), "success");
  assert.equal(statusTone("On Track"), "success");
  assert.equal(statusTone("Returned for Revision"), "attention");
  assert.equal(statusTone("At Risk of Delay"), "warning");
  assert.equal(statusTone("Denied"), "danger");
  assert.equal(statusTone("Overdue"), "danger");
  assert.equal(statusTone("Submitted"), "info");
  assert.equal(statusTone("Leave Scheduled"), "info");
  assert.equal(statusTone("Draft"), "neutral");
  assert.equal(statusTone("Archived"), "neutral");
});

test("every Returned... status is attention (orange: a person must act; AD2 and I-358), never danger", () => {
  for (const s of ["Returned", "Returned for Revision", "Returned for Clarification", "Returned to student"]) {
    assert.equal(statusTone(s), "attention", s);
  }
});

test("Approved and Passed are different colours (I-358): a decision is green, a result or a finish is teal", () => {
  assert.equal(statusTone("Approved"), "success");
  assert.equal(statusTone("Dean Approved"), "success");
  for (const s of ["Passed", "Pass", "Completed", "Complete", "Graduated", "Verified"]) assert.equal(statusTone(s), "done", s);
  assert.notEqual(statusTone("Approved"), statusTone("Passed"));
  assert.equal(statusTone("Failed"), "danger");
  assert.equal(statusTone("Withdrawn"), "neutral");
  assert.equal(statusTone("Under Review"), "warning");
});

test("lookup ignores case and surrounding spaces", () => {
  assert.equal(statusTone("active"), "success");
  assert.equal(statusTone("  ACTIVE  "), "success");
  assert.equal(statusTone("returned FOR revision"), "attention");
});

test("an unknown string is neutral, and the server tone is used only for such a string", () => {
  assert.equal(statusTone("Some Brand New Status"), "neutral");
  assert.equal(statusTone("Some Brand New Status", "good"), "success");
  assert.equal(statusTone("Some Brand New Status", "warn"), "warning");
  assert.equal(statusTone("Some Brand New Status", "bad"), "danger");
  assert.equal(statusTone("Some Brand New Status", "info"), "info");
  assert.equal(statusTone("Some Brand New Status", "muted"), "neutral");
  assert.equal(statusTone("Some Brand New Status", "not-a-tone"), "neutral");
});

test("the client map wins over a server tone for a known status", () => {
  assert.equal(statusTone("Approved", "bad"), "success");
  assert.equal(statusTone("Denied", "good"), "danger");
  assert.equal(statusTone("Returned to student", "bad"), "attention");
});

test("empty and non-string values are neutral and do not throw", () => {
  assert.equal(statusTone(""), "neutral");
  assert.equal(statusTone(null), "neutral");
  assert.equal(statusTone(undefined, "good"), "success");
  assert.equal(statusTone(42), "neutral");
});

test("SERVER_TONE translates the five server names to the five tones", () => {
  assert.deepEqual(SERVER_TONE, { good: "success", warn: "warning", bad: "danger", info: "info", muted: "neutral" });
});

test("a status appears in exactly one group (no silent last-one-wins)", () => {
  const seen = new Map();
  for (const [tone, list] of Object.entries(STATUS_GROUPS)) {
    for (const s of list) {
      const key = s.toLowerCase();
      if (seen.has(key)) assert.equal(seen.get(key), tone, `"${s}" is in both ${seen.get(key)} and ${tone}`);
      seen.set(key, tone);
    }
  }
  assert.equal(Object.keys(STATUS_TONE).length, seen.size);
});

test("the tone groups are exactly the seven tones of the colour legend", () => {
  assert.deepEqual(Object.keys(STATUS_GROUPS).sort(), ["attention", "danger", "done", "info", "neutral", "success", "warning"]);
});

test("an Open item is blue, not the green of Approved (Fable F-24)", () => {
  assert.equal(statusTone("Open"), "info");
  assert.equal(statusTone("Approved"), "success");
});

test("a server status that is jargon is shown in words, the tone follows the original (Fable F-19)", () => {
  assert.equal(statusLabel("Noted by AC"), "Noted by Academic Coordinator");
  assert.equal(statusTone("Noted by AC"), "info");
  assert.equal(statusLabel("Approved"), "Approved");
});
