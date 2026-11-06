// Test for src/lib/stages.js (Phase 5 UI-SPEC section 4, Stepper row, idea X-02). Run: node --test scripts/stages.test.mjs
// Written before the module exists. stages.js must be importable by plain Node (no Vite, no JSX).
// The stage list is the API's `meta.stages` (app.py STAGES, 13 values): the first 8 are the lifecycle path, the last 5
// (LOA, AWOL, Withdrawal In Progress, Withdrawn, Completed) are off the normal path.
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_STAGES, OFF_TRACK_STAGES, isOffTrack, lifecycleStages, stageSteps, stageWords } from "../src/lib/stages.js";

const API_STAGES = [
  "Admission", "Coursework", "Comprehensive Exam", "Proposal Development", "Proposal Defense", "Data Collection",
  "Writing", "Final Defense", "LOA", "AWOL", "Withdrawal In Progress", "Withdrawn", "Completed",
];
const states = (steps) => steps.map((s) => s.state);

test("the lifecycle is the first 8 stages; the other 5 are off-track", () => {
  assert.deepEqual(lifecycleStages(API_STAGES), API_STAGES.slice(0, 8));
  assert.deepEqual([...OFF_TRACK_STAGES], ["LOA", "AWOL", "Withdrawal In Progress", "Withdrawn", "Completed"]);
  assert.deepEqual(DEFAULT_STAGES, API_STAGES);
  assert.equal(isOffTrack("LOA"), true);
  assert.equal(isOffTrack("Writing"), false);
});

test("a mid-lifecycle stage: earlier steps complete, that one current, later upcoming", () => {
  const steps = stageSteps("Proposal Defense", API_STAGES);
  assert.equal(steps.length, 8);
  assert.deepEqual(steps.map((s) => s.label), API_STAGES.slice(0, 8));
  assert.deepEqual(states(steps), ["complete", "complete", "complete", "complete", "current", "upcoming", "upcoming", "upcoming"]);
});

test("first and last lifecycle stage", () => {
  assert.deepEqual(states(stageSteps("Admission", API_STAGES)), ["current", ...Array(7).fill("upcoming")]);
  assert.deepEqual(states(stageSteps("Final Defense", API_STAGES)), [...Array(7).fill("complete"), "current"]);
});

test("an off-track stage gives a stopped step with that stage's name", () => {
  for (const stage of ["LOA", "AWOL", "Withdrawal In Progress", "Withdrawn"]) {
    const steps = stageSteps(stage, API_STAGES);
    const stopped = steps.filter((s) => s.state === "stopped");
    assert.equal(stopped.length, 1, stage);
    assert.equal(stopped[0].label, stageWords(stage));
    assert.equal(steps.some((s) => s.state === "current"), false, `${stage} has no current step`);
  }
});

test("Completed finishes every step (no stopped step)", () => {
  const steps = stageSteps("Completed", API_STAGES);
  assert.equal(steps.some((s) => s.state === "stopped"), false);
  assert.equal(steps.every((s) => s.state === "complete"), true);
  assert.equal(steps.at(-1).label, "Completed");
});

test("an unknown, empty or missing stage marks nothing as done; a missing list falls back to the default stages", () => {
  assert.deepEqual(states(stageSteps("Nonsense", API_STAGES)), Array(8).fill("upcoming"));
  assert.deepEqual(states(stageSteps("", API_STAGES)), Array(8).fill("upcoming"));
  assert.deepEqual(states(stageSteps(null)), Array(8).fill("upcoming"));
  assert.deepEqual(states(stageSteps("Writing")), ["complete", "complete", "complete", "complete", "complete", "complete", "current", "upcoming"]);
});

test("the steps follow the list the API sends, not a hard-coded one", () => {
  const custom = ["Admission", "Coursework", "Writing", "LOA", "Completed"];
  const steps = stageSteps("Coursework", custom);
  assert.deepEqual(steps.map((s) => s.label), ["Admission", "Coursework", "Writing"]);
  assert.deepEqual(states(steps), ["complete", "current", "upcoming"]);
});

// I-206: a student who is off the path (AWOL, on leave) still did the work of the earlier stages; My Progress shows it.
test("an off-track student's finished work still shows as complete", () => {
  const done = { courseAudit: { completed: [1, 2, 3, 4], missing_count: 0 }, comprehensivePassed: true };
  assert.deepEqual(states(stageSteps("AWOL", API_STAGES, done)).slice(0, 4), ["complete", "complete", "complete", "upcoming"]);
  const partial = { courseAudit: { completed: [1, 2, 3, 4], missing_count: 14 }, comprehensivePassed: false };
  assert.deepEqual(states(stageSteps("LOA", API_STAGES, partial)).slice(0, 3), ["complete", "current", "upcoming"]);
  const none = { courseAudit: { completed: [], missing_count: 18 }, comprehensivePassed: false };
  assert.deepEqual(states(stageSteps("AWOL", API_STAGES, none)).slice(0, 2), ["complete", "upcoming"]);
});

test("the record changes nothing on the path or when completed", () => {
  const rec = { courseAudit: { completed: [1], missing_count: 0 }, comprehensivePassed: true };
  assert.deepEqual(stageSteps("Writing", API_STAGES, rec), stageSteps("Writing", API_STAGES));
  assert.deepEqual(stageSteps("Completed", API_STAGES, rec), stageSteps("Completed", API_STAGES));
});

test("I-397: stageWords spells out LOA and AWOL and leaves other stages alone", () => {
  assert.equal(stageWords("LOA"), "Leave of Absence");
  assert.equal(stageWords("AWOL"), "AWOL (absent without leave)");
  assert.equal(stageWords("Writing"), "Writing");
  assert.equal(stageWords(""), "");
});
