// e2e-writes: none
// Availability and schedule mutations below are answered in the browser; backend contracts live in unittest.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";
const term = { id: 9901, label: "AY 2099-2100 1st Semester" };
const old = { id: 9900, label: "AY 2098-2099 2nd Semester" };
const windows = [{ weekday: 1, start: "07:30", end: "21:00", kind: "available" }, { weekday: 4, start: "07:30", end: "21:00", kind: "available" }];
const option = { id: "paired-1-4-450", label: "Tuesday / Friday · 7:30–9:00 AM", format: "paired", meetings: [{ weekday: 1, start: "07:30", end: "09:00" }, { weekday: 4, start: "07:30", end: "09:00" }] };
const plan = { id: 9901, version: 1, status: "Draft", allow_single_day: false, sections: [{ id: 1, course_id: 1, code: "TEST-A", title: "Teaching test", section: "1", faculty_id: 1, faculty_name: "Dr. Teaching", options: [option], blocked_options: [{ label: "Monday / Thursday", reason: "Faculty unavailable Thursday" }], option_id: option.id, meetings: option.meetings, warnings: [], errors: [] }], warnings: [], errors: [] };
const shots = join(SCREENS_DIR, "..", "p110");
async function screens(page, name) {
  mkdirSync(shots, { recursive: true });
  for (const width of [1366, 1920, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1080 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: join(shots, `${name}-${width}.png`), fullPage: true, animations: "disabled" });
  }
}
test.describe("semester teaching availability (faculty)", () => {
  test.use({ storageState: join(AUTH_DIR, "faculty.json") });
  test("faculty reaches Schedule, copies and confirms semester availability separately from defense hours", async ({ page }) => {
    let availability = { status: "Missing", version: 0, windows: [] };
    let saved = null;
    await page.route(/\/api\/faculty-portal\/teaching-schedule(\?.*)?$/, async route => {
      if (route.request().method() === "PUT") {
        saved = route.request().postDataJSON();
        availability = { ...availability, ...saved, windows: saved.copy_from_term_id ? windows : saved.windows, status: saved.copy_from_term_id ? "Draft" : saved.status, version: availability.version + 1 };
      }
      await route.fulfill({ json: { term, terms: [term, old], availability, published: [] } });
    });
    await page.goto("/faculty-portal");
    await page.locator("aside nav").getByRole("link", { name: "Schedule", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Schedule", exact: true })).toBeVisible();
    await expect(page.getByText(/teaching availability/i).first()).toBeVisible();
    await page.getByRole("button", { name: "Copy previous semester", exact: true }).click();
    await expect(page.getByText(/Tuesday/).first()).toBeVisible();
    await page.getByRole("button", { name: "Submit availability", exact: true }).click();
    await expect.poll(() => saved?.status).toBe("Submitted");
    await expect(page.getByText("Submitted", { exact: true }).first()).toBeVisible();
    await screens(page, "faculty-schedule");
  });
});
test.describe("semester schedule review (academic coordinator)", () => {
  test.use({ storageState: join(AUTH_DIR, "academic-coordinator.json") });
  // I-236: since 26c8892 the coordinator UI has no Schedule tab, "Create draft", "Approve schedule" or "Publish schedule" (the /api/teaching-schedules/<id> approve/publish endpoints are unused by the UI); schedules are picked per row in Offering setup (p84).
  test.fixme("coordinator reviews draft and explicitly approves and publishes without a Dean decision", async ({ page }) => {
    let active = null;
    const calls = [];
    await page.route(/\/api\/teaching-schedules(?:\/\d+)?(\?.*)?$/, async route => {
      if (route.request().method() !== "GET") {
        const body = route.request().postDataJSON(); calls.push(body.action);
        if (!active) active = structuredClone(plan);
        if (body.action === "approve") active.status = "Approved";
        if (body.action === "publish") active.status = "Published";
        active.version++;
      }
      await route.fulfill({ json: { term, terms: [term], availability: [], plan: active, rules: { start: "07:30", end: "21:00", duration: 90, gap: 15 } } });
    });
    await page.goto("/");
    await page.locator("aside nav").getByRole("link", { name: /Course Adjustments$/ }).click();
    await page.getByRole("tab", { name: "Schedule", exact: true }).click();
    await page.getByRole("button", { name: "Create draft", exact: true }).click();
    await expect(page.getByText("TEST-A", { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel("Schedule for TEST-A", { exact: true })).toBeVisible();
    expect(calls).not.toContain("publish");
    await screens(page, "coordinator-draft");
    await page.getByRole("button", { name: "Approve schedule", exact: true }).click();
    const dialog = page.getByRole("dialog");
    if (await dialog.isVisible()) await dialog.getByRole("button", { name: "Approve schedule", exact: true }).click();
    await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Publish schedule", exact: true }).click();
    if (await dialog.isVisible()) await dialog.getByRole("button", { name: "Publish schedule", exact: true }).click();
    await expect(page.getByText("Published", { exact: true }).first()).toBeVisible();
    expect(calls).toContain("approve"); expect(calls).toContain("publish");
  });
});
