// e2e-writes: teaching-workflow-fixture
// Runs only with playwright.teaching.config.js against a separate small disposable DB.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { SCREENS_DIR } from "../support/paths.mjs";

async function login(page, email) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("test-password");
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await expect(page.locator("aside nav a").first()).toBeVisible();
}

test("faculty confirms term availability, coordinator approves/publishes, student sees real class times", async ({ browser }) => {
  const facultyContext = await browser.newContext();
  const faculty = await facultyContext.newPage();
  await login(faculty, "teaching@example.test");
  await faculty.locator("aside nav").getByRole("link", { name: "Schedule", exact: true }).click();
  const terms = await faculty.getByLabel("Semester", { exact: true }).locator("option").evaluateAll(nodes => nodes.map(n => ({ value: n.value, label: n.textContent })));
  const next = terms.find(t => t.label.includes("2nd Semester"));
  expect(next).toBeTruthy();
  await faculty.getByLabel("Semester", { exact: true }).selectOption(next.value);
  await expect(faculty.getByText("Availability not submitted", { exact: true })).toBeVisible();
  await faculty.getByRole("button", { name: "Copy previous semester", exact: true }).click();
  await expect(faculty.getByText("Draft", { exact: true }).first()).toBeVisible();
  await faculty.getByRole("button", { name: "Submit availability", exact: true }).click();
  await expect(faculty.getByText("Submitted", { exact: true }).first()).toBeVisible();
  const coordinatorContext = await browser.newContext();
  const coordinator = await coordinatorContext.newPage();
  await login(coordinator, "ac-acd@example.test");
  await coordinator.locator("aside nav").getByRole("link", { name: /Course Adjustments$/ }).click();
  await coordinator.getByRole("tab", { name: "Schedule", exact: true }).click();
  await coordinator.getByLabel("Schedule semester", { exact: true }).selectOption(next.value);
  await coordinator.getByRole("button", { name: "Create draft", exact: true }).click();
  await expect(coordinator.getByLabel("Schedule for ACD-501", { exact: true })).not.toHaveValue("");
  await expect(coordinator.getByLabel("Schedule for ACD-502", { exact: true })).not.toHaveValue("");
  const keep = coordinator.getByRole("checkbox", { name: "Keep this schedule for ACD-501", exact: true });
  await keep.check();
  await expect(keep).toBeChecked();
  await keep.uncheck();
  await expect(keep).not.toBeChecked();
  const shots = join(SCREENS_DIR, "..", "teaching-live"); mkdirSync(shots, { recursive: true });
  for (const width of [1366, 1920, 390]) {
    await faculty.setViewportSize({ width, height: 900 });
    await coordinator.setViewportSize({ width, height: 900 });
    for (const [page, name] of [[faculty, "faculty"], [coordinator, "coordinator"]]) {
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: join(shots, `${name}-${width}.png`), fullPage: true, animations: "disabled" });
    }
  }
  await coordinator.getByRole("button", { name: "Approve schedule", exact: true }).click();
  await coordinator.getByRole("dialog").getByRole("button", { name: "Approve schedule", exact: true }).click();
  await expect(coordinator.getByText("Approved", { exact: true }).first()).toBeVisible();
  await coordinator.getByRole("button", { name: "Publish schedule", exact: true }).click();
  await coordinator.getByRole("dialog").getByRole("button", { name: "Publish schedule", exact: true }).click();
  await expect(coordinator.getByText("Published", { exact: true }).first()).toBeVisible();
  const studentContext = await browser.newContext();
  const student = await studentContext.newPage();
  await login(student, "ana-acd@example.test");
  await student.locator("aside nav").getByRole("link", { name: "Schedule", exact: true }).click();
  await student.getByLabel("Class schedule semester", { exact: true }).selectOption(next.value);
  await expect(student.getByText(/ACD-501/).first()).toBeVisible();
  await expect(student.getByText(/ACD-502/).first()).toBeVisible();
  await expect(student.getByText(/Tuesday/).first()).toBeVisible();
  await expect(student.getByText(/Friday/).first()).toBeVisible();
  for (const width of [1366, 1920, 390]) {
    await student.setViewportSize({ width, height: 844 });
    await student.evaluate(() => window.scrollTo(0, 0));
    expect(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await student.screenshot({ path: join(shots, `student-${width}.png`), fullPage: true, animations: "disabled" });
  }
  await facultyContext.close(); await coordinatorContext.close(); await studentContext.close();
});
