// e2e-writes: none
// Packet gate6 (I-424): the Research Gate board never says "0 of 0", cards say why they are blocked, no adviser line before
// the title defense, and the faculty popup shows availability first. Reads only.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

test.use({ storageState: join(AUTH_DIR, "research-coordinator.json"), viewport: { width: 1366, height: 768 } });

const overview = async (page) => (await (await page.request.get("/api/research-gate/overview")).json()).items;

test("no '0 of 0' while the board loads", async ({ page }) => {
  await page.route("**/api/research-gate/overview", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await route.continue();
  });
  await page.goto("/workflow/research-gate");
  await expect(page.getByLabel("Loading the Research Gate board")).toBeVisible();
  expect(await page.locator("main").innerText(), "no count line while loading").not.toMatch(/Showing \d+ of \d+/); // toHaveCount(0) would retry until the data arrives
  await expect(page.getByRole("region", { name: "Research Gate board" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Showing \d+ of [1-9]\d* students/)).toBeVisible();
});

test("blocked and waiting cards give the reason first; Title Defense cards without an adviser stay quiet", async ({ page }) => {
  const rows = await overview(page);
  await page.goto("/workflow/research-gate");
  await expect(page.getByRole("region", { name: "Research Gate board" })).toBeVisible();
  const blocked = rows.find((row) => row.state === "blocked" && row.reason);
  expect(blocked, "a blocked row with a reason").toBeTruthy();
  const card = page.locator("article").filter({ hasText: blocked.student.name }).first();
  await expect(card.getByTestId("gate-reason")).toHaveText(blocked.reason);
  const title = rows.find((row) => String(row.column) === "1" && !row.adviser_name);
  expect(title, "a Title Defense row without an adviser").toBeTruthy();
  await expect(page.locator("article").filter({ hasText: title.student.name }).first()).not.toContainText("No adviser yet");
});

test("the faculty profile shows availability in the first viewport", async ({ page }) => {
  await page.goto("/faculty");
  await page.locator("table tbody tr").first().locator("td").nth(2).click();
  const dialog = page.getByRole("dialog");
  const heading = dialog.getByRole("heading", { name: /Weekly availability/ });
  await expect(heading).toBeVisible();
  const box = await heading.boundingBox();
  expect(box.y + box.height).toBeLessThan(768);
  await page.keyboard.press("PageDown");
  await expect.poll(() => dialog.locator("[data-modal-body]").evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});
