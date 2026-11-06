// e2e-writes: none
// Packet persona7 (I-385, I-386, I-387 frontend parts). Red first.
//   - the student dashboard words an office-held task as "The Graduate School is reviewing ..." with no due date;
//   - the student Return from AWOL page has no office codes, plain words, the form before the case card, no Edit before filing;
//   - Defense Scheduling without a final panel links to Panel Matching for that student; Panel Matching says what finalizing does.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR, BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);

async function openStudent(browser, path, mutate) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1366, height: 900 } });
  const res = await context.request.post("/api/auth/login", { data: { email: "student@usls.edu.ph", password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  await expect.poll(async () => (await (await context.request.get("/api/auth/me")).json()).user?.email).toBe("student@usls.edu.ph");
  await context.route("**/api/student-portal/context", async (route) => {
    const response = await route.fetch(); const data = await response.json(); mutate(data); await route.fulfill({ response, json: data });
  });
  const page = await context.newPage();
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  return { context, page };
}

const awolCase = () => ({
  id: 77, kind: "AWOL", kind_label: "Return from AWOL", status: "AWOL Declared", status_label: "AWOL", owner: "Student",
  card_lines: ["AWOL (flagged by the system)", "Returning in: not chosen yet"],
  timeline: [{ label: "AWOL flagged", state: "complete" }, { label: "Return filed", state: "current" }, { label: "Dean decision", state: "upcoming" }],
  summary_rows: [
    { label: "Type", value: "Return from AWOL" },
    { label: "AWOL effective date", value: "2026-05-01", date: true },
    { label: "Detection source", value: "Recorded AWOL standing" },
    { label: "Last enrolled semester", value: "1st Semester 2025-2026" },
    { label: "Returning in", value: "Not chosen yet" },
    { label: "Policy classification", value: "Awaiting return intent" },
    { label: "Years in the program", value: "3" },
    { label: "Residence limits", value: "5 normal / 7 absolute (Master's)" },
    { label: "Student's written intention", value: "Not filed yet", full: true,
      edit: { entity: "awol_case", id: 77, field: "return_intent", label: "Written intention", can: true, count: 0 } },
    { label: "Dean decision", value: "Not Submitted" },
  ],
});

test.describe("persona7", () => {
  test("I-385 dashboard: an office task reads as the office's work, with no due date", async ({ browser }) => {
    const { context, page } = await openStudent(browser, "/student", (data) => {
      data.tasks = [{ id: 9001, title: "Review automatic AWOL policy alert", owner_role: "Academic Coordinator", due_at: "2026-11-17T00:00:00", status: "Pending", overdue: false }];
    });
    try {
      const main = page.locator("main");
      await expect(main.getByText("The Graduate School is reviewing the absence check")).toBeVisible();
      await expect(main.getByText("Review automatic AWOL policy alert", { exact: true })).toHaveCount(0);
      await expect(main).not.toContainText(/Due\s+Nov(ember)?\s+17/);
    } finally { await context.close(); }
  });

  test("I-386 Return from AWOL: plain words, form first, no Edit before filing, no office codes", async ({ browser }) => {
    const { context, page } = await openStudent(browser, "/student/requests/awol-return", (data) => {
      data.student.standing = "AWOL"; data.student.enrollment_tag = "AWOL";
      data.awol_case = { status: "AWOL Declared" };
      data.standalone_cases = { ...(data.standalone_cases || {}), awol: [awolCase()] };
    });
    try {
      const main = page.locator("main");
      for (const word of ["GS-F-", "Operations Manual", "Detection source", "Policy classification", "Residence limits", "flagged by the system", "Years in the program"]) {
        await expect(main, word).not.toContainText(word);
      }
      await expect(main).toContainText("Absent without leave (AWOL)");
      await expect(main.getByRole("button", { name: "Edit" })).toHaveCount(0);
      await expect(main.getByText("Not filed yet")).toHaveCount(0);
      const form = await main.getByRole("button", { name: "Submit return declaration" }).boundingBox();
      const facts = await main.getByText("AWOL effective date").boundingBox();
      expect(form.y, "the form comes before the facts").toBeLessThan(facts.y);
      await expect(page.locator("aside nav").getByRole("link", { name: "Messages" })).toBeVisible();
    } finally { await context.close(); }
  });

  test("I-386 the other request pages show no office codes either (LOA, Readmission, Withdrawal)", async ({ browser }) => {
    for (const path of ["/student/requests/leave-of-absence", "/student/requests/readmission", "/student/requests/withdrawal"]) {
      const { context, page } = await openStudent(browser, path, () => {});
      try {
        await expect(page.locator("main"), path).not.toContainText("GS-F-");
        await expect(page.locator("main"), path).not.toContainText("Operations Manual");
      } finally { await context.close(); }
    }
  });

  test("I-387 Defense Scheduling without a panel links to Panel Matching for the student", async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile("research-coordinator"), viewport: { width: 1366, height: 800 } });
    await context.route("**/api/transactions/defense-scheduling/context*", async (route) => {
      const response = await route.fetch(); const data = await response.json(); data.assigned_panel = []; await route.fulfill({ response, json: data });
    });
    const page = await context.newPage();
    try {
      await page.goto("/workflow/defense-scheduling?student_id=146");
      const link = page.locator("main").getByRole("link", { name: /^Open Panel Matching for / });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", "/workflow/panel-matching?student_id=146");
    } finally { await context.close(); }
  });

  test("I-387 Panel Matching says what finalizing does", async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile("research-coordinator"), viewport: { width: 1366, height: 800 } });
    const page = await context.newPage();
    try {
      await page.goto("/workflow/panel-matching?student_id=125");
      const note = page.locator("#finalize-panel-note");
      await expect(note).toContainText("Finalizing makes this the final panel");
      await expect(note).toContainText("Defense Scheduling");
      await expect(page.locator("main").getByRole("button", { name: /(Finalize selected panel|Update final panel)/ })).toBeVisible();
    } finally { await context.close(); }
  });
});
