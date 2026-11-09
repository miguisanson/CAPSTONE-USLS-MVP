// Login-page Demo Guide list follows the student's life: lifecycle, then side processes, then tools.
import test from "node:test";
import assert from "node:assert/strict";
import { GUIDES } from "../src/lib/demoGuide/guides/index.js";

const EXPECTED = [
  "student-handoff", "course-adjustments", "enrollment", "dropping",
  "research-title", "panel-matching", "defense-scheduling", "verdicts", "proposal-final",
  "practicum", "graduation",
  "leave-of-absence", "readmission", "awol", "residency", "withdrawal",
  "monitoring", "reports", "calendars", "business-rules", "policy-documents",
  "policy-assistant", "portals", "best-features",
];

test("demo guides are listed in lifecycle order", () => {
  assert.deepEqual(GUIDES.map((g) => g.id), EXPECTED);
});
