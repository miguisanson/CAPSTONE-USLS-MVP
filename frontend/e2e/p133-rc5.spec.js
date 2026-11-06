// e2e-writes: none
// Packet rc5 (persona coordinator-research: I-388, I-387 server part, I-389). Red first.
//   - the Research Coordinator home lists the Ready students under "Needs your action";
//   - the student search in Panel Matching says "Ready" for a student the Research Gate calls Ready;
//   - the faculty directory and Panel Matching count panels the same way and say what is counted;
//   - a faculty member tagged Overloaded who is suggested for a seat gets a warning on that seat.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const main = (page) => page.locator("main");

test.use({ storageState: authFile("research-coordinator"), viewport: { width: 1366, height: 900 } });

async function anaId(page) {
  const overview = await (await page.request.get("/api/research-gate/overview")).json();
  const ana = overview.items.find((row) => row.student.name === "Ana Abad");
  expect(ana?.state, "Ana Abad is Ready on the Research Gate").toBe("ready");
  return ana.student.id;
}

test("I-388: the Research Coordinator home lists Ready students under Needs your action", async ({ page }) => {
  const overview = await (await page.request.get("/api/research-gate/overview")).json();
  const ready = overview.items.filter((row) => row.state === "ready");
  expect(ready.length).toBeGreaterThan(3);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Welcome/ })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(main(page).getByText("Nothing is waiting on you")).toHaveCount(0);
  await expect(main(page).getByRole("link", { name: `View all ${ready.length} ready students` })).toHaveAttribute("href", "/workflow/research-gate");
  await expect(main(page).getByText("Ready", { exact: true }).first()).toBeVisible();
  // persona round 6 (coordinator-research): the open-tasks tile read "undefined tasks past the due date" when Ready students were listed
  await expect(main(page).getByText(/undefined|NaN/)).toHaveCount(0);
  await expect(main(page).getByText(/\d+ tasks? past the due date/)).toBeVisible();
});

test("I-387: the student search says Ready for a Ready student", async ({ page }) => {
  await anaId(page);
  await page.goto("/workflow/panel-matching");
  await page.getByLabel("Search a student").fill("Abad");
  const option = page.getByRole("button", { name: /Ana Abad/ });
  await expect(option).toBeVisible();
  await expect(option).toContainText("Ready");
  await expect(option).not.toContainText("Missing Requirements");
});

test("I-389: one panel count on both screens, and an overloaded suggested member is warned about", async ({ page }) => {
  const id = await anaId(page);
  await page.goto("/faculty");
  const head = page.locator("main table thead th", { hasText: "Student panels" });
  await expect(head).toBeVisible();
  const ramos = page.locator("main table tbody tr").filter({ hasText: "Dr. Teodoro Ramos" });
  const directoryCount = (await ramos.locator("td").nth(4).innerText()).trim();

  await page.goto(`/workflow/panel-matching?student_id=${id}`);
  await expect(main(page).getByText("Dr. Teodoro Ramos").first()).toBeVisible();
  const row = main(page).locator("div").filter({ hasText: /other student panels?/ }).filter({ hasText: "Dr. Teodoro Ramos" }).last();
  await expect(row).toContainText(`${directoryCount} other student panels`);

  const warning = main(page).getByTestId("seat-overload-warning");
  await expect(warning.first()).toBeVisible();
  await expect(warning.first()).toContainText("Overloaded");
});
