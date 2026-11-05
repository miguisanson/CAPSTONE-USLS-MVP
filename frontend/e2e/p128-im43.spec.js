// e2e-writes: none
// IM43: the comprehensive exam section on the staff student page (I-335), the Advise Slip link on a readmission (I-304),
// and the Research Gate board skeleton while it loads. Writes are answered with page.route, so no seeded record changes.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);

test.describe("staff", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 900 } });

  test("student page: comprehensive exam section, record dialog, future dates blocked", async ({ page }) => {
    const list = await page.request.get("/api/students");
    const body = await list.json();
    const id = body.items[0].id;
    let posted = null;
    await page.route("**/api/students/*/comprehensive-exam", async (route) => {
      posted = route.request().postDataJSON();
      await route.fulfill({ json: { ok: true } });
    });
    await page.goto(`/students/${id}`);
    await expect(page.getByRole("heading", { name: "Comprehensive exam" })).toBeVisible();
    await expect(page.getByTestId("comprehensive-exam-current")).toBeVisible();
    await page.getByRole("button", { name: "Record result" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Save result" })).toBeDisabled();
    await dialog.getByLabel(/^Result/).selectOption("Passed");
    const max = await dialog.getByLabel(/^Date of the exam/).getAttribute("max");
    expect(max).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await dialog.getByLabel(/^Date of the exam/).fill("2026-10-01");
    await dialog.getByLabel(/^Where does the result come from/).fill("Result sheet from the committee");
    await dialog.getByRole("button", { name: "Save result" }).click();
    await expect(dialog).toBeHidden();
    expect(posted).toEqual({ result: "Passed", exam_date: "2026-10-01", reason: "Result sheet from the committee" });
  });

  test("an approved readmission shows the Advise Slip link in the case window", async ({ page }) => {
    await page.route("**/api/process-cases/readmission/*", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const response = await route.fetch();
      const body = await response.json();
      body.case.advise_slip_url = `/api/leave-cases/${body.case.id}/advise-slip`;
      await route.fulfill({ response, json: body });
    });
    await page.goto("/workflow/readmission");
    await page.getByRole("button", { name: /^View details for/ }).first().click();
    const link = page.getByTestId("advise-slip-link");
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", /\/api\/leave-cases\/\d+\/advise-slip$/);
  });

  test("Research Gate board shows the skeleton while it loads", async ({ page }) => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    await page.route("**/api/research-gate/overview*", async (route) => { await gate; await route.continue(); });
    await page.goto("/workflow/research-gate");
    await expect(page.getByTestId("skeleton-board")).toBeVisible();
    release();
    await expect(page.locator("main article").first()).toBeVisible();
  });
});
