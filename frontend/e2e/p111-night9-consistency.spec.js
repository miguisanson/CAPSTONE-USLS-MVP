// e2e-writes: none
// Night 9 (I-207 leftovers, owner's consistency rule IM24): same-kind pages behave alike. Written BEFORE the change.
//   (a) a student chosen on one staff workflow page is NOT remembered by the next one. The only carry-over is an explicit link
//       with ?student_id= (the Research Gate list, "Open matching", the defense calendar, a staff task, AD12).
//   (b) every board's "Rules applied on this screen" panel gives Graduate School staff the same summary line: the rule count and
//       how many need review ("none need review" included), not a count that appears only where some rule is flagged.
// Read only: the student id is read from /api/research-gate/overview at test time; nothing is written.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const main = (page) => page.locator("main");

test.describe("(a) the chosen student does not carry over by itself", () => {
  test.use({ storageState: authFile("research-coordinator"), viewport: { width: 1366, height: 768 } });

  test("Research Gate -> Panel Matching / Defense Scheduling / Practicum without a link starts clean; a link still carries the student", async ({ page }) => {
    const overview = await (await page.request.get("/api/research-gate/overview")).json();
    const studentId = overview.items[0]?.student?.id;
    expect(studentId, "the Research Gate list has a student").toBeTruthy();

    await page.goto(`/workflow/research-gate?student_id=${studentId}`);
    await expect(main(page).getByRole("heading", { level: 1, name: "Research Gate" })).toBeVisible();
    await expect(main(page).getByText("Select a student to begin")).toHaveCount(0);

    for (const [slug, title] of [["panel-matching", "Panel Matching"], ["defense-scheduling", "Defense Scheduling"]]) {
      await page.goto(`/workflow/${slug}`);
      await expect(main(page).getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(main(page).getByText("Select a student to begin"), `${title} opened without a link asks for a student`).toBeVisible();
      expect(new URL(page.url()).searchParams.has("student_id"), `${title} URL has no student_id`).toBe(false);
    }

    await page.goto("/workflow/practicum");
    await expect(main(page).getByRole("heading", { level: 1, name: "Practicum" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(new URL(page.url()).searchParams.has("student_id"), "a page that picks no student never gets one in its URL").toBe(false);

    await page.goto(`/workflow/panel-matching?student_id=${studentId}`);
    await expect(main(page).getByText("Select a student to begin")).toHaveCount(0);
  });
});

test.describe("(b) every board's rules panel has the same summary line", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });
  const SUMMARY = /^\d+ rules? from the Graduate School policies · (none|\d+) needs? review$/;

  for (const [slug, title] of [
    ["leave-of-absence", "Leave of Absence"], ["readmission", "Readmission"], ["awol", "AWOL"], ["withdrawal", "Withdrawal"],
    ["research-gate", "Research Gate"], ["panel-matching", "Panel Matching"], ["defense-scheduling", "Defense Scheduling"],
    ["practicum", "Practicum"], ["graduation", "Graduation"],
  ]) {
    test(`${title} (${slug})`, async ({ page }) => {
      await page.goto(`/workflow/${slug}`);
      await expect(main(page).locator("h1")).toBeVisible();
      await page.waitForLoadState("networkidle");
      const panel = page.getByRole("region", { name: "Rules applied on this screen" });
      await expect(panel).toBeVisible();
      const line = (await panel.getByRole("button").first().innerText()).split("\n").map((t) => t.trim()).filter(Boolean).pop();
      expect(line).toMatch(SUMMARY);
    });
  }
});
