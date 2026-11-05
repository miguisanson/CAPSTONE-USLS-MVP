// e2e-writes: none
// Packet P-D (Fable review F5-03, F5-08, F5-09): short Research Gate cards, no second student picker,
// one verdict form, and a Defense Scheduling reschedule without a free-text "Source reference".
// The verdict and reschedule POSTs are never sent (nothing is submitted).
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ARTIFACTS_DIR, AUTH_DIR, BASE_URL } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const shots = join(ARTIFACTS_DIR, "screens", "p125-research-gate-polish");
test.beforeAll(() => mkdirSync(shots, { recursive: true }));

async function staffPage(browser, width = 1366) {
  const context = await browser.newContext({ baseURL: BASE_URL, storageState: authFile("staff"), viewport: { width, height: width === 390 ? 844 : 900 } });
  return { context, page: await context.newPage() };
}

test("F5-03: a card is one short line, the picker is gone, View holds the requirements", async ({ browser }) => {
  for (const width of [1366, 390]) {
    const { context, page } = await staffPage(browser, width);
    try {
      await page.goto("/workflow/research-gate");
      await expect(page.locator("main article").first()).toBeVisible();
      await expect(page.getByText("Select a student to begin")).toHaveCount(0);
      await expect(page.getByText("Choose a student")).toHaveCount(0);
      await expect(page.locator("[data-requirement]"), "no requirement tiles on the board").toHaveCount(0);
      const first = page.locator("main article").first();
      await expect(first).toContainText(/\d+ of \d+ done/);
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      console.log(`P-D page height at ${width}px:`, height);
      if (width === 1366) expect(height, "page far shorter than the old ~5,300 px").toBeLessThan(2600);
      await page.screenshot({ path: join(shots, `gate-${width}.png`), fullPage: true });

      await first.getByRole("button", { name: /^Open the Research Gate record of/ }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.locator("[data-requirement-status]").first()).toBeVisible();
      await expect(dialog).toContainText(/Completed|In progress|Not started|Cannot start yet/);
      await page.screenshot({ path: join(shots, `view-${width}.png`) });
      await dialog.getByRole("button", { name: "Open the full record" }).click();
      await expect(page).toHaveURL(/student_id=\d+/);
      await expect(page.getByRole("heading", { level: 2, name: "Research Gate record" })).toBeVisible();
    } finally {
      await context.close();
    }
  }
});

test("F5-08: reschedule has no Source reference; Requested by follows what opened it", async ({ browser }) => {
  const { context, page } = await staffPage(browser);
  try {
    await page.goto("/workflow/defense-scheduling?student_id=146");
    const main = page.locator("main");
    await expect(main.getByLabel(/Reason for rescheduling/)).toBeVisible();
    await expect(main.getByText("Source reference")).toHaveCount(0);
    await expect(main.getByLabel(/Requested by/), "editable when nothing opened the reschedule").toHaveJSProperty("tagName", "SELECT");
    await context.route("**/api/transactions/defense-scheduling/context*", async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      data.schedules = (data.schedules || []).map((item) => (item.is_active ? { ...item, needs_reconfirmation: true } : item));
      await route.fulfill({ response, json: data });
    });
    await page.reload();
    await expect(main.getByLabel(/Reason for rescheduling/)).toBeVisible();
    await expect(main.getByLabel(/Requested by/), "derived, not picked").not.toHaveJSProperty("tagName", "SELECT");
    await expect(main.getByText("Panel member").first()).toBeVisible();
  } finally {
    await context.close();
  }
});

test("F5-09: the fallback form uses the one verdict label set", async ({ browser }) => {
  const { context, page } = await staffPage(browser);
  const overview = await (await context.request.get("/api/research-gate/overview")).json();
  await context.route("**/api/transactions/research-gate/context*", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.staff_defense_action = {
      schedule: { id: 99114, defense_type: "Final Defense", preferred_date: "2026-11-04", start_time: "13:00", status: "Scheduled" },
      verdict: null, panel_chair_name: "Dr. Spec Chair", gate: "Final Defense", can_submit: true, can_correct: false, can_confirm_revisions: false,
      verdict_options: [{ value: "Passed", label: "Passed" }, { value: "Failed", label: "Failed" }],
    };
    await route.fulfill({ response, json: data });
  });
  try {
    await page.goto(`/workflow/research-gate?student_id=${overview.items[0].student.id}`);
    const panel = page.getByRole("region", { name: "Panel verdict fallback" });
    await expect(panel.getByLabel("Verdict result")).toBeVisible();
    await expect(panel.getByLabel("Remarks or conditions")).toBeVisible();
    await expect(panel.getByLabel("Evaluation score (Form 7)")).toBeVisible();
    await expect(panel.getByText("A pass needs the passing score for the paper type.")).toBeVisible();
  } finally {
    await context.close();
  }
});
