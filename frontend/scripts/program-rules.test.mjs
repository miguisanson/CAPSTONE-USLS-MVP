// Test for src/lib/programRules.js (I-416, I-418): a student sees the rules of the student's own program first.
// Run: node --test scripts/program-rules.test.mjs. Written before the module exists.
import test from "node:test";
import assert from "node:assert/strict";
import { programLevelOf, splitRulesByProgram } from "../src/lib/programRules.js";
import { statusTone } from "../src/lib/status.js";
import { forStudent } from "../src/lib/status.js";

const rules = [
  { key: "a", title: "Master's: all requirements within 5 academic years" },
  { key: "b", title: "Doctorate: all requirements within 7 academic years" },
  { key: "c", title: "Extension beyond the normal limit" },
  { key: "d", title: "Doctorate: candidacy within 5 academic years" },
];

test("the program level comes from the student, as the server works it out", () => {
  assert.equal(programLevelOf({ program_name: "Master of Arts in Education", program_code: "MAED" }), "Master's");
  assert.equal(programLevelOf({ program_name: "Doctor of Philosophy in Psychology", program_code: "DPSY" }), "Doctorate");
  assert.equal(programLevelOf({ program_name: "Business", program_code: "DBA" }), "Doctorate");
  assert.equal(programLevelOf({ program_level: "Doctorate", program_name: "x", program_code: "x" }), "Doctorate");
  assert.equal(programLevelOf(null), "");
});

test("rules for the student's level and general rules come first, the other level's rules are set apart", () => {
  const split = splitRulesByProgram(rules, "Master's");
  assert.deepEqual(split.mine.map((r) => r.key), ["a", "c"]);
  assert.deepEqual(split.others.map((r) => r.key), ["b", "d"]);
});

test("with no level known, every rule is listed together", () => {
  const split = splitRulesByProgram(rules, "");
  assert.equal(split.mine.length, 4);
  assert.equal(split.others.length, 0);
});

test("student pages word the red AWOL and Delayed chips calmly, in amber", () => {
  assert.equal(forStudent("AWOL Declared"), "Absent without leave");
  assert.equal(forStudent("Delayed"), "Behind schedule");
  assert.equal(forStudent("Pending"), "Pending");
  assert.equal(statusTone("Absent without leave"), "warning");
  assert.equal(statusTone("Behind schedule"), "warning");
});
