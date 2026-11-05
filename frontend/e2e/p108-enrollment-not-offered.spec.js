// e2e-writes: none
// Night 5, item 4: Camille Bernardo (DBA) has DBA-COG4..COG10 "Not taken" on her Monitoring Sheet, but this semester's
// offering list holds only DBA-MAJ3/4/5, which she completed. The server is right (only offered, not-taken subjects can be
// added); the Enrollment page must say why her not-taken subjects are not in the list instead of looking empty-handed.
// Read from the API at test time (DATA-OWNERSHIP.md: specs share one database); nothing is saved.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

test.use({ storageState: join(AUTH_DIR, "academic-coordinator.json") });

test("Enrollment: when nothing offered can be added, the page names the not-taken subjects that are not offered", async ({ page }) => {
  const first = await (await page.request.get("/api/enrollment")).json();
  const dba = first.programs.find((p) => p.code === "DBA");
  const program = await (await page.request.get(`/api/enrollment?program_id=${dba.id}`)).json();
  const camille = program.students.find((s) => s.name === "Camille Bernardo");
  const data = await (await page.request.get(`/api/enrollment?program_id=${dba.id}&student_id=${camille.id}`)).json();
  const addable = data.offered_subjects.filter((s) => s.enrollment_state === "available");
  const notOffered = data.curriculum_subjects.filter((s) => !s.is_offered && s.enrollment_state === "available");
  expect(addable, "premise: nothing on the offering list can be added for her").toHaveLength(0);
  expect(notOffered.length, "premise: she has not-taken subjects that are not offered").toBeGreaterThan(0);

  await page.goto(`/enrollment?program_id=${dba.id}&student_id=${camille.id}`);
  await expect(page.getByText("Official offered subjects", { exact: true })).toBeVisible();
  const note = page.locator("main").getByText(/not on this semester's offering list/);
  await expect(note).toBeVisible();
  await expect(note).toContainText(notOffered[0].code);
  await expect(note).toContainText("Offering list");
});
