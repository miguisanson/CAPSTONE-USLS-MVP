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
  // CHANGED BY data cleanup (IM54-IM57, 2026-11-22): Camille Bernardo (DBA) is gone, so the spec finds a student in the
  // same situation (nothing offered can be added, some not-taken subjects are not offered) instead of naming one.
  const first = await (await page.request.get("/api/enrollment")).json();
  let found = null;
  for (const prog of first.programs) {
    const program = await (await page.request.get(`/api/enrollment?program_id=${prog.id}`)).json();
    for (const student of program.students || []) {
      const data = await (await page.request.get(`/api/enrollment?program_id=${prog.id}&student_id=${student.id}`)).json();
      const addable = (data.offered_subjects || []).filter((s) => s.enrollment_state === "available");
      const notOffered = (data.curriculum_subjects || []).filter((s) => !s.is_offered && s.enrollment_state === "available");
      if (addable.length === 0 && notOffered.length > 0) { found = { prog, student, notOffered }; break; }
    }
    if (found) break;
  }
  expect(found, "premise: a student has nothing offered to add and not-taken subjects that are not offered").toBeTruthy();
  const { prog, student, notOffered } = found;

  await page.goto(`/enrollment?program_id=${prog.id}&student_id=${student.id}`);
  await expect(page.getByText("Official offered subjects", { exact: true })).toBeVisible();
  const note = page.locator("main").getByText(/not on this semester's offering list/);
  await expect(note).toBeVisible();
  await expect(note).toContainText(notOffered[0].code);
  await expect(note).toContainText("Offering list");
});
