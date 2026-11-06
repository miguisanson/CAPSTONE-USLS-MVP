// e2e-writes: none
// Packet awol6 (I-416 own program's rules first, I-418 calm tone on the student's pages, I-419 return semester agrees).
// The header year (I-418) is worked out by the server (course_year_label), so it is not tested here.
import { test, expect } from "@playwright/test";
import { BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const TERM = "AY 2026-2027 2nd Semester";
const awolCase = () => ({
  id: 77, kind: "AWOL", kind_label: "Return from AWOL", status: "AWOL Declared", status_label: "AWOL", status_tone: "bad", owner: "Student",
  card_lines: ["Awaiting return intent", "Returning in: not chosen yet"],
  timeline: [{ label: "AWOL flagged", state: "complete" }, { label: "Return filed", state: "current" }],
  summary_rows: [{ label: "AWOL effective date", value: "2026-05-01", date: true }, { label: "Returning in", value: "Not chosen yet" }],
});

async function openAwol(browser, mutate = () => {}) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 390, height: 844 } });
  const res = await context.request.post("/api/auth/login", { data: { email: "student@usls.edu.ph", password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  await context.route("**/api/student-portal/context", async (route) => {
    const response = await route.fetch(); const data = await response.json();
    data.student.standing = "AWOL"; data.student.enrollment_tag = "AWOL";
    data.student.program_name = "Master of Arts in Education"; data.student.program_code = "MAED";
    data.progress_status = { level: "Delayed" };
    data.awol_case = { status: "AWOL Declared" };
    data.awol_return = { last_enrolled_term: "AY 2025-2026 2nd Semester", return_semester_options: [TERM, "AY 2027-2028 1st Semester"], default_return_term: TERM };
    data.leave_overview = { ...(data.leave_overview || {}), banner: { tone: "bad", title: "Your record is marked AWOL", text: "You cannot enroll until a return request is approved." } };
    data.standalone_cases = { ...(data.standalone_cases || {}), awol: [awolCase()] };
    mutate(data);
    await route.fulfill({ response, json: data });
  });
  const page = await context.newPage();
  await page.goto("/student/requests/awol-return");
  await page.waitForLoadState("networkidle");
  return { context, page };
}

test.describe("awol6 student Return from AWOL", () => {
  test("I-416 the rules panel lists the student's own program first and folds the other programs", async ({ browser }) => {
    const { context, page } = await openAwol(browser);
    try {
      await page.getByRole("button", { name: /Rules applied on this screen/ }).click();
      const panel = page.getByRole("region", { name: "Rules applied on this screen" });
      await expect(panel.getByText(/^Master's: all requirements within 5/)).toBeVisible();
      await expect(panel.getByText(/^Doctorate: /)).toHaveCount(0);
      // I-432: a student is not shown the other programs' rules at all
      await expect(panel.getByRole("button", { name: /^Rules for other programs/ })).toHaveCount(0);
    } finally { await context.close(); }
  });

  test("I-419 the side card shows the semester the form shows, and follows a change", async ({ browser }) => {
    const { context, page } = await openAwol(browser);
    try {
      const main = page.locator("main");
      await expect(main.locator("select#awol-term")).toHaveValue(TERM);
      await expect(main.locator("article")).toContainText(`Returning in: ${TERM}`);
      await expect(main.locator("article")).not.toContainText("Not chosen yet");
      await main.locator("select#awol-term").selectOption("AY 2027-2028 1st Semester");
      await expect(main.locator("article")).toContainText("Returning in: AY 2027-2028 1st Semester");
      await expect(main.getByRole("button", { name: "Fill in your return" })).toBeVisible();
    } finally { await context.close(); }
  });

  test("I-419 with a single allowed semester there is no select, only the semester", async ({ browser }) => {
    const { context, page } = await openAwol(browser, (data) => { data.awol_return.return_semester_options = [TERM]; });
    try {
      await expect(page.locator("main select#awol-term")).toHaveCount(0);
      await expect(page.getByTestId("awol-term-fixed")).toHaveText(TERM);
    } finally { await context.close(); }
  });

  test("I-418 no red AWOL or Delayed chip on the student's pages", async ({ browser }) => {
    const { context, page } = await openAwol(browser);
    try {
      const main = page.locator("main");
      await expect(main.getByText("AWOL Declared", { exact: true })).toHaveCount(0);
      const chip = main.getByText("Absent without leave", { exact: true }).first();
      await expect(chip).toBeVisible();
      await expect(page.locator('[data-status-tone="danger"]')).toHaveCount(0);
      await page.goto("/student");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("main").getByText("Behind schedule", { exact: true })).toBeVisible();
      await expect(page.locator('main [data-status-tone="danger"]')).toHaveCount(0);
    } finally { await context.close(); }
  });
});
