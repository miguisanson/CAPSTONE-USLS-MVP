// Test for src/pages/reports/yearStarted.js (I-357): the "By year started" report counts each school year's students in three
// states - on coursework, on thesis / dissertation, graduated - from the stage counts the cohorts report already sends.
// Run: node --test scripts/year-started.test.mjs. Written before the module exists.
import test from "node:test";
import assert from "node:assert/strict";
import { STATES, stateOfStage, summarizeYears, yearLabel } from "../src/pages/reports/yearStarted.js";

test("every lifecycle stage belongs to one state, or to 'other' (leave, AWOL, withdrawn)", () => {
  for (const stage of ["Admission", "Coursework", "Comprehensive Exam"]) assert.equal(stateOfStage(stage), "coursework", stage);
  for (const stage of ["Proposal Development", "Proposal Defense", "Data Collection", "Writing", "Final Defense"]) assert.equal(stateOfStage(stage), "thesis", stage);
  assert.equal(stateOfStage("Completed"), "graduated");
  for (const stage of ["LOA", "AWOL", "Withdrawal In Progress", "Withdrawn"]) assert.equal(stateOfStage(stage), "other", stage);
  assert.equal(stateOfStage("Something new"), "other");
});

test("a year label is the school year in full", () => {
  assert.equal(yearLabel("24-25"), "2024-2025");
  assert.equal(yearLabel("2024-2025"), "2024-2025");
  assert.equal(yearLabel("Not recorded"), "Not recorded");
});

test("rows of several programs add up per year; the three states plus 'other' add up to the total", () => {
  const rows = [
    { program: "MSCS", entry: "23-24", total: 5, s_coursework: 1, s_comprehensive_exam: 1, s_writing: 2, s_completed: 1 },
    { program: "DBA", entry: "23-24", total: 3, s_coursework: 1, s_final_defense: 1, s_withdrawn: 1 },
    { program: "MSCS", entry: "22-23", total: 2, s_completed: 2 },
  ];
  const out = summarizeYears(rows);
  assert.deepEqual(out.map((y) => y.entry), ["22-23", "23-24"]);
  assert.deepEqual(out[0], { entry: "22-23", label: "2022-2023", coursework: 0, thesis: 0, graduated: 2, other: 0, total: 2 });
  assert.deepEqual(out[1], { entry: "23-24", label: "2023-2024", coursework: 3, thesis: 3, graduated: 1, other: 1, total: 8 });
  for (const y of out) assert.equal(y.coursework + y.thesis + y.graduated + y.other, y.total);
});

test("STATES names the three counts the stakeholders asked for, in order", () => {
  assert.deepEqual(STATES.filter((s) => s.key !== "other").map((s) => s.label), ["On coursework", "On thesis / dissertation", "Graduated"]);
});
