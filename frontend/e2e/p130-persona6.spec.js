// e2e-writes: none
// Packet persona6 (I-380, I-381, I-382, I-384 frontend parts). Red first.
//   - student Research Progress: the header says whose move it is (same words as the dashboard) and links to Defense Schedule;
//     a Verified file has no "Add another" / file picker; the adviser page shows a one-line summary once there is an adviser;
//   - Course Adjustments and Offering setup each say which approval they are and link to the other;
//   - Course Audit has a next step; the record counts subjects like the Students list and names the withdrawal line;
//     Stepper words are Done / Now / Upcoming; names in board cards do not break mid-word.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR, BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const STAGES = ["Title Defense", "Proposal Defense", "Final Defense", "Completed"].map((name, i) => ({ name, complete: i < 2 }));
const upload = (item_name, label, fileName) => ({
  item_name, label, description: "Spec upload", source_type: "student_upload", student_upload: true, required_file_count: 1,
  file_count: 1, status: "Complete", status_label: "Verified", files: [{ id: item_name.length + 700, name: fileName, url: `/spec/${fileName}` }],
});
function atFinalDefense(data) {
  data.student.adviser_name = "Dr. Spec Adviser";
  data.research_case = { id: 1, title: "Spec Title", status: "Active", adviser_name: "Dr. Spec Adviser" };
  data.panel = [{ id: 1, faculty_name: "Dr. Panel One", panel_role: "Panel Chair", specialization: "Spec" }];
  data.schedules = []; data.tasks = []; data.workflow_messages = [];
  data.research_progress = {
    gate: "Final Defense", stage: "Final Defense", stage_index: 2, status: "Pending Staff Action", stages: STAGES,
    milestone: {
      value: "Final Defense", label: "Final Defense Readiness", short_label: "Final Defense", description: "Spec milestone.",
      student_uploads_ready: true, student_missing_count: 0, overall_complete: false,
      requirements: [
        upload("Form 4 - Endorsement for Final Defense", "Final defense endorsement", "endorsement-spec.pdf"),
        upload("Final manuscript", "Final defense manuscript", "manuscript-spec.pdf"),
        { item_name: "Agreed final defense schedule", label: "Confirmed final defense schedule", source_type: "system_final_schedule", student_upload: false,
          description: "Added automatically after staff confirms.", status: "Pending", status_label: "Pending", files: [] },
      ],
    },
  };
}
async function openStudent(browser, path, routes) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1366, height: 900 } });
  const res = await context.request.post("/api/auth/login", { data: { email: "student@usls.edu.ph", password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  await expect.poll(async () => (await (await context.request.get("/api/auth/me")).json()).user?.email).toBe("student@usls.edu.ph");
  await context.route("**/api/student-portal/context", async (route) => {
    const response = await route.fetch(); const data = await response.json(); atFinalDefense(data); await route.fulfill({ response, json: data });
  });
  for (const [pattern, json] of Object.entries(routes || {})) await context.route(pattern, (route) => route.fulfill({ json }));
  const page = await context.newPage();
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  return { context, page };
}

test.describe("student pages", () => {
  test("Research Progress header says it is the student's move, links to Defense Schedule, no Add another on Verified files", async ({ browser }) => {
    const { context, page } = await openStudent(browser, "/student/research");
    try {
      const main = page.locator("main");
      await expect(main).not.toContainText("Pending Staff Action");
      await expect(main.getByText("Your next step:")).toBeVisible();
      await expect(main.getByRole("link", { name: "Request your Final Defense date" })).toHaveAttribute("href", "/student/defense-schedule");
      await expect(main.getByText("Add another")).toHaveCount(0);
      await expect(main.locator('input[type="file"]')).toHaveCount(0);
    } finally { await context.close(); }
  });

  test("Adviser page: one line once there is an adviser, the Form 3 intro only without one", async ({ browser }) => {
    const current = { id: 1, status: "Appointed", faculty_id: 3, faculty_name: "Dr. Spec Adviser", form31_issued_on: "2026-10-20", contract: { status: "Not applicable" }, steps: [] };
    let r = await openStudent(browser, "/student/adviser", { "**/api/student-portal/adviser": { current, open: null, history: [], can_apply: false, can_request_change: false, candidates: [] } });
    try {
      const main = r.page.locator("main");
      await expect(main).toContainText("Your adviser: Dr. Spec Adviser");
      await expect(main).not.toContainText("You nominate an adviser on Form 3");
    } finally { await r.context.close(); }
    r = await openStudent(browser, "/student/adviser", { "**/api/student-portal/adviser": { current: null, open: null, history: [], can_apply: true, candidates: [] } });
    try {
      await expect(r.page.locator("main")).toContainText("You nominate an adviser on Form 3");
    } finally { await r.context.close(); }
  });
});

test.describe("academic coordinator", () => {
  test.use({ storageState: authFile("academic-coordinator"), viewport: { width: 1366, height: 900 } });
  test("Course Adjustments and Offering setup point at each other", async ({ page }) => {
    await page.goto("/course-adjustments?view=adjustments");
    const main = page.locator("main");
    await expect(main.getByRole("link", { name: "Offering setup" }).first()).toBeVisible();
    await expect(main).toContainText("The Academic Coordinator approves and publishes the class schedule on Offering setup");
    await page.goto("/course-adjustments?view=offerings");
    const panel = page.getByRole("region", { name: "Semester schedule" });
    await expect(panel.getByRole("link", { name: "Course Adjustments" })).toBeVisible();
    await expect(panel).toContainText("The Dean approves which subjects are offered on Course Adjustments");
  });

  test("Course Adjustments stepper words: Now / Done / Upcoming", async ({ page }) => {
    await page.goto("/course-adjustments?view=adjustments");
    const steps = page.getByRole("list", { name: "Offering plan progress" });
    await expect(steps).toBeVisible();
    const words = await steps.locator(".sr-only").allTextContents();
    expect(words.length).toBe(4);
    for (const w of words) expect(["Now: ", "Done: ", "Upcoming: ", "Returned: "]).toContain(w);
  });

  test("Course Audit page names where the coordinator acts", async ({ page }) => {
    await page.goto("/workflow/course-audit");
    const main = page.locator("main");
    await expect(main).toContainText("Students with missing subjects");
    await expect(main.getByRole("link", { name: "Course Adjustments" }).first()).toHaveAttribute("href", /course-adjustments/);
  });

  test("Practicum card names do not break mid-word", async ({ page }) => {
    await page.goto("/workflow/practicum");
    const names = page.locator("article p.break-words.font-semibold");
    await expect(names.first()).toBeVisible();
    const bad = await names.evaluateAll((els) => els.filter((el) => {
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 20;
      return Math.round(el.getBoundingClientRect().height / lh) > el.textContent.trim().split(/\s+/).length;
    }).map((el) => el.textContent));
    expect(bad, "a name wrapped inside a word").toEqual([]);
  });
});

test.describe("staff", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 900 } });
  test("student record counts subjects like the list and labels the withdrawal line", async ({ page }) => {
    const list = await (await page.request.get("/api/students")).json();
    const id = (list.items || list)[0].id;
    await page.goto(`/students/${id}`);
    const main = page.locator("main");
    await expect(main.getByTestId("subjects-to-finish")).toHaveText(/^\d+ subjects? to finish \(\d+ current, \d+ missing\)$/);
    await expect(main.locator("li", { hasText: /subject withdrawal/i }).first()).toBeVisible();
  });
});
