// e2e-writes: none
// Packet persona5 (I-375, I-377, I-240 staff part). Red first.
//   - a staff task "Send the approved ... to the Registrar" opens the board at the Registrar list with that student's row
//     ticked (no case window that cannot send);
//   - the Dean's Reports list popups fit a 390 px phone: rows stack, the reason is readable, the page does not scroll sideways;
//   - Graduation and Practicum offer "Export CSV" and "Print" of the list on screen (staff).
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { AUTH_DIR } from "./support/paths.mjs";
import { taskTarget } from "../src/lib/staffHome.js";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: "ignoreErrors" }); });

test("the task link names the Registrar list for each board", () => {
  for (const [title, board] of [
    ["Send the approved Leave of Absence to the Registrar", "leave-of-absence"],
    ["Send the approved readmission to the Registrar", "readmission"],
    ["Send the approved AWOL return to the Registrar", "awol"],
  ]) {
    const { to } = taskTarget({ title, student_id: 7 }, "staff");
    expect(to, title).toContain(`/workflow/${board}?`);
    expect(to, title).toContain("section=registrar");
  }
  expect(taskTarget({ title: "Review student Leave of Absence application", student_id: 7 }, "staff").to).not.toContain("section=registrar");
});

test.describe("staff: Registrar task", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });
  test("opens at the Registrar list with the student ticked", async ({ page }) => {
    let student;
    await page.route(/\/api\/process-cases\?slug=leave-of-absence/, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      json.cases = json.cases.map((item, i) => (i === 0 ? { ...item, status: "Approved", registrar: { status: "Pending Handoff" } } : item));
      student = json.cases[0].student;
      await route.fulfill({ response, json });
    });
    const probe = await (await page.request.get("/api/process-cases?slug=leave-of-absence")).json();
    const id = probe.cases[0].student.id;
    const { to } = taskTarget({ title: "Send the approved Leave of Absence to the Registrar", student_id: id }, "staff");
    await page.goto(to);
    await expect(page.getByRole("heading", { name: "Registrar list" })).toBeInViewport();
    await expect(page.getByRole("checkbox", { name: `Tick ${student.name}` })).toBeChecked();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("dean phone: Reports list popup", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 390, height: 844 } });
  test("Behind schedule stacks its rows and shows the reason", async ({ page }) => {
    const behind = await (await page.request.get("/api/reports/summary/behind?term=last-12-months")).json();
    await page.goto("/dean/analytics");
    await page.getByRole("button", { name: /Behind schedule/ }).click();
    const dialog = page.getByRole("dialog", { name: "Behind schedule" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("table")).toBeVisible();
    const fits = await dialog.evaluate((el) => {
      const wrap = el.querySelector("[data-table-scroll]");
      return { table: wrap.scrollWidth <= wrap.clientWidth + 1, page: document.documentElement.scrollWidth <= window.innerWidth + 1 };
    });
    expect(fits).toEqual({ table: true, page: true });
    const detail = behind.rows[0].detail;
    if (detail) await expect(dialog.getByText(detail, { exact: false }).first()).toBeInViewport({ ratio: 1 });
  });
});

test.describe("staff: Export CSV and Print", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });
  for (const [name, path, first] of [["Graduation", "/workflow/graduation", "Student ID"], ["Practicum", "/workflow/practicum", "Student ID"]]) {
    test(`${name} exports and prints the list`, async ({ page }) => {
      await page.goto(path);
      const csv = page.getByRole("button", { name: "Export CSV" });
      await expect(csv).toBeVisible();
      await expect(page.getByRole("button", { name: "Print" })).toBeVisible();
      const [download] = await Promise.all([page.waitForEvent("download"), csv.click()]);
      const text = readFileSync(await download.path(), "utf8");
      expect(text).toContain(first);
      expect(download.suggestedFilename()).toMatch(/\.csv$/);
    });
  }
});
