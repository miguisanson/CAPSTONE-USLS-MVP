// e2e-writes: none
// Fable review 4 (F8-02, F8-03, I-417): Course Audit lists missing subjects per program from the real audit, the roster
// count line counts the class only, and the AWOL student finds the absence notice in the bell and the Activity Log.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const main = (page) => page.locator("main");

test.describe("academic coordinator", () => {
  test.use({ storageState: authFile("academic-coordinator"), viewport: { width: 1366, height: 900 } });

  test("Course Audit: a Program select drives the missing-subjects table; the count matches the student record", async ({ page }) => {
    await page.goto("/workflow/course-audit");
    const program = main(page).getByRole("combobox", { name: "Program" });
    await expect(program.locator("option").nth(1)).toBeAttached();
    const rows = main(page).getByRole("table", { name: "Students with missing subjects" }).locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    const missing = Number((await rows.first().locator("td").nth(1).innerText()).trim());
    expect(missing).toBeGreaterThan(0);
    await rows.first().getByRole("link", { name: "Open record" }).click();
    await expect(page.getByText(new RegExp(`${missing} (more )?subjects?`)).first()).toBeVisible();
    await page.goBack();
    await program.selectOption({ index: 1 });
    await expect(main(page).getByRole("table", { name: "Students with missing subjects" })).toBeVisible();
    const subject = main(page).getByRole("combobox", { name: "Subject" });
    await expect(subject.locator("option").nth(1)).toBeAttached();
    await subject.selectOption({ index: 1 });
    const line = main(page).getByText(/^\d+ in the class · \d+ completed · \d+ not completed yet$/);
    await expect(line).toBeVisible();
    const [inClass, done, rest] = (await line.innerText()).match(/\d+/g).map(Number);
    expect(inClass).toBe(done + rest);
  });
});

test.describe("AWOL student", () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test("the bell and the Activity Log say the student was marked absent without leave", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill("awol.maya@usls.edu.ph");
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: /^\s*Sign in\s*$/ }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
    await page.goto("/student/activity");
    await main(page).getByRole("button", { name: /^View logs/ }).click();
    await expect(main(page).getByText("The Graduate School marked you absent without leave").first()).toBeVisible();
    await expect(main(page).getByText("No activity yet")).toHaveCount(0);
    await page.getByRole("button", { name: /^Notifications/ }).click();
    await expect(page.getByText(/marked you as absent without leave/).first()).toBeVisible();
  });
});
