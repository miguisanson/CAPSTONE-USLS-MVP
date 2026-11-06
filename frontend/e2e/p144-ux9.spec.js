// e2e-writes: none
// Packet ux9 (I-432 student pages, I-433 Dean on a phone), 390 x 844. Written before the change. Reads only: the student
// context and the Dean's approvals are answered through page.route, so no other spec's data matters.
import { test, expect } from "@playwright/test";
import { BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const TERM = "AY 2026-2027 2nd Semester";
async function signedIn(browser, email) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 390, height: 844 } });
  const res = await context.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  return context;
}
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function awolStudent(browser) {
  const context = await signedIn(browser, "student@usls.edu.ph");
  await context.route("**/api/student-portal/context", async (route) => {
    const response = await route.fetch(); const data = await response.json();
    data.student.standing = "AWOL"; data.student.enrollment_tag = "AWOL"; data.student.current_stage = "AWOL";
    data.progress_status = { level: "Delayed" };
    data.awol_case = { status: "AWOL Declared" };
    data.awol_return = { last_enrolled_term: "AY 2025-2026 2nd Semester", return_semester_options: [TERM], default_return_term: TERM };
    data.tasks = [{ id: 901, title: "Review automatic AWOL policy alert", owner_role: "Academic Coordinator", status: "Pending", overdue: false, action_url: "/workflow/awol" }];
    await route.fulfill({ response, json: data });
  });
  return context;
}

test.describe("ux9 student pages (AWOL)", () => {
  test("I-432a/c the home does not say the Graduate School reviews an absence check before the return is sent, and the lifecycle is one line", async ({ browser }) => {
    const context = await awolStudent(browser);
    const page = await context.newPage();
    try {
      await page.goto("/student");
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(/reviewing the absence check/i)).toHaveCount(0);
      const line = page.getByTestId("lifecycle-paused");
      await expect(line).toHaveText(/^Paused.*: absence without leave$/);
      await expect(page.getByText("Stopped:")).toHaveCount(0);
    } finally { await context.close(); }
  });

  test("I-432b the rules panel shows plain rules to a student: no enforcement badges, no other programs", async ({ browser }) => {
    const context = await awolStudent(browser);
    const page = await context.newPage();
    try {
      await page.goto("/student/requests/awol-return");
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: /Rules applied on this screen/ }).click();
      const panel = page.getByRole("region", { name: "Rules applied on this screen" });
      await expect(panel.getByText("Source:").first()).toBeVisible();
      await expect(panel.getByText(/Not checked by the system|Enforced by the system/)).toHaveCount(0);
      await expect(panel.getByRole("button", { name: /^Rules for other programs/ })).toHaveCount(0);
    } finally { await context.close(); }
  });

  test("I-432d the two return boxes each say how they differ", async ({ browser }) => {
    const context = await awolStudent(browser);
    const page = await context.newPage();
    try {
      await page.goto("/student/requests/awol-return");
      await page.waitForLoadState("networkidle");
      await expect(page.getByLabel(/Written intention to resume enrollment/)).toHaveAccessibleDescription(/you want to enroll again, and from which semester/);
      await expect(page.getByLabel(/Reason for returning and readiness/)).toHaveAccessibleDescription(/What changed, and how you are ready to continue/);
    } finally { await context.close(); }
  });
});

test.describe("ux9 Dean on a phone", () => {
  test("I-433e the course plan table fits the screen and Approve is on the page", async ({ browser }) => {
    const context = await signedIn(browser, "dean@usls.edu.ph");
    await context.route("**/api/approvals", async (route) => {
      const response = await route.fetch(); const data = await response.json();
      const offerings = [1, 2, 3].map((n) => ({ id: 9000 + n, code: `SUBJ ${n}00`, title: "A long subject title for the phone", status: "Offered", demand_count: n, section_count: 1, assigned_faculty_name: "Dr. Faculty Member", delayed_count: n }));
      data.pending = [{ id: 9001, program_code: "MAED", term_label: TERM, status: "Submitted", submitted_at: "2026-10-01T08:00:00", offerings }];
      await route.fulfill({ response, json: data });
    });
    const page = await context.newPage();
    try {
      await page.goto("/dean/approvals/course-adjustments");
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("button", { name: /^Approve/ }).first()).toBeVisible();
      expect(await noSideScroll(page), "no sideways scroll").toBe(true);
      const table = page.getByRole("table", { name: /Subjects proposed for MAED/ });
      const box = await table.boundingBox();
      expect(box.x + box.width).toBeLessThanOrEqual(391);
    } finally { await context.close(); }
  });

  test("I-433f Practicum on a phone has no dragging hint", async ({ browser }) => {
    const context = await signedIn(browser, "dean@usls.edu.ph");
    const page = await context.newPage();
    try {
      await page.goto("/dean/approvals/practicum");
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(/Dragging a card/)).toHaveCount(0);
    } finally { await context.close(); }
  });

  test("I-433g the phone menu scrolled to the end shows its last item in full", async ({ browser }) => {
    const context = await signedIn(browser, "dean@usls.edu.ph");
    const page = await context.newPage();
    try {
      await page.goto("/dean");
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "Open menu" }).click();
      const nav = page.getByRole("dialog").locator("nav").last();
      await nav.evaluate((el) => { el.scrollTop = el.scrollHeight; });
      await page.waitForTimeout(300);
      const last = nav.getByRole("link").last();
      await expect(last).toHaveText(/Reports & Analytics|Assistant|./);
      const r = await last.boundingBox(); const n = await nav.boundingBox();
      expect(r.y + r.height, "the last item ends above the bottom of the list").toBeLessThanOrEqual(n.y + n.height - 8);
      const covered = await last.evaluate((el) => { const b = el.getBoundingClientRect(); const top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height - 2); return !el.contains(top); });
      expect(covered, "nothing sits over the last item").toBe(false);
    } finally { await context.close(); }
  });
});
