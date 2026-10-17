// Packet P2.3 (Phase 5 design system, shared components stream): pins what the shared process components DO, so moving
// ProcessGates.jsx, ProcessBoardPage.jsx, StageBoard.jsx, leaveStatus.jsx and WorkflowTimeline.jsx onto the component
// library (InlineNotice, StatusChip, Stepper, PageHeader) cannot change it. Written against the old code; it must pass on
// both. Through the real UI:
//   - the four staff process boards (Leave of Absence, Readmission, AWOL & Residency, Withdrawal): the page title, the board
//     region, every stage column in order with its count equal to the cards in it, and the seeded cards in their columns;
//     the Table view shows each case's status chip;
//   - the Graduation board (StageBoard with its own column headers) and, inside a graduation case window, the stage
//     timeline behind "View stage history": nine steps in order, the first one current;
//   - a student's request pages (Leave of Absence, Return from AWOL): the "Where this request is" list with each step's
//     label, which one is current, which are done;
//   - the process-gate banner: a refused "Generate report" and a failed curriculum lookup show their server message; a
//     real report then shows its status chip and "Send to Dean";
//   - at 390 px a board scrolls inside its own region and the page never scrolls sideways.
// Words only a screen reader hears changed on purpose (old "(Done)" / "(Now)", new "Complete:" / "Current:"), so those are
// matched with either wording. Demo data used: Therese Lacson, Maya Torres, Benjamin Santos, Clarisse Tan, Elena Mendoza,
// Adrian Lim, Maria Dela Cruz and graduation candidates Bianca Santos (no other spec uses them). Only the "Generate report"
// step writes (one Draft coursework report in the throwaway harness database).
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR, BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const SHOTS = join(SCREENS_DIR, "..", "p23-process");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);

/** No sideways page scroll (IM15). */
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** A page of a demo student, signed in through the API (their own cookie jar). */
async function studentPage(browser, email, viewport = { width: 1366, height: 768 }) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport });
  const res = await context.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.ok(), `sign in as ${email}`).toBeTruthy();
  return { context, page: await context.newPage() };
}

// What the server's vocabulary gives each board (standalone_process.py / leave_workflow.py), left to right.
const BOARDS = [
  {
    slug: "leave-of-absence",
    title: "Leave of Absence",
    region: "Leave of absence board",
    columns: ["Submitted", "In staff review", "Returned to student", "With the Dean", "Leave scheduled", "On leave", "Return due", "Ended", "Not approved"],
    cards: [["Submitted", "Benjamin Santos"], ["On leave", "Therese Lacson"]],
  },
  {
    slug: "readmission",
    title: "Readmission",
    region: "Readmission board",
    columns: ["Submitted", "In staff review", "Returned to student", "With the Dean", "Approved - back in the program", "Not approved"],
    cards: [["Submitted", "Maria Dela Cruz"]],
  },
  {
    slug: "awol",
    title: "AWOL & Residency",
    region: "AWOL and residency board",
    columns: ["AWOL", "Return review", "With the Dean", "Re-enrollment", "Back in the program", "Not approved", "Residency", "Residency closed"],
    cards: [["AWOL", "Maya Torres"], ["Return review", "Clarisse Tan"], ["Residency", "Elena Mendoza"]],
  },
  {
    slug: "withdrawal",
    title: "Withdrawal Requests",
    region: "Subject withdrawal board",
    columns: ["Submitted", "Returned to student", "With the Dean", "Subject tagging", "Excel export", "Exported - email the Registrar", "Not approved"],
    cards: [["Submitted", "Adrian Lim"]],
  },
];

const column = (board, name) => board.locator("section").filter({ has: board.page().getByRole("heading", { name, exact: true, level: 3 }) });

test.describe.configure({ mode: "serial" });

test.describe("P2.3 shared process components", () => {
  test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));

  test.describe("staff process boards", () => {
    test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

    for (const spec of BOARDS) {
      test(`${spec.title}: title, stage columns, counts and seeded cards`, async ({ page }) => {
        await page.goto(`/workflow/${spec.slug}`);
        await expect(page.getByRole("heading", { level: 1, name: spec.title })).toBeVisible();
        const board = page.getByRole("region", { name: spec.region });
        await expect(board).toBeVisible();

        // every stage column, in order
        const names = await board.locator("section > header h3").allTextContents();
        expect(names).toEqual(spec.columns);

        // each column's count bubble equals the cards under it
        let total = 0;
        for (const name of spec.columns) {
          const col = column(board, name);
          const cards = await col.getByRole("button", { name: /^View details for / }).count();
          const bubble = col.locator("header").getByLabel(/^\d+ requests?$|^\d+ shown of \d+$/);
          await expect(bubble, `${name}: count bubble`).toHaveText(String(cards));
          total += cards;
        }
        expect(total).toBeGreaterThan(0);
        await expect(page.getByText(new RegExp(`Showing ${total} of ${total} `))).toBeVisible();

        // seeded cards sit in their column and keep their "View details" link
        for (const [columnName, student] of spec.cards) {
          const col = column(board, columnName);
          await expect(col.getByText(student, { exact: true }), `${student} in ${columnName}`).toBeVisible();
          await expect(col.getByRole("button", { name: `View details for ${student}` })).toBeVisible();
        }
        await page.screenshot({ path: join(SHOTS, `board-${spec.slug}-1366.png`), fullPage: true });
      });
    }

    test("Leave of Absence: the Table view shows each case's status chip", async ({ page }) => {
      await page.goto("/workflow/leave-of-absence");
      await page.getByRole("button", { name: "Table", exact: true }).click();
      const row = (name) => page.getByRole("table").first().getByRole("row").filter({ hasText: name });
      await expect(row("Therese Lacson")).toContainText("On leave");
      await expect(row("Benjamin Santos")).toContainText("Submitted");
      await page.screenshot({ path: join(SHOTS, "table-leave-of-absence-1366.png"), fullPage: true });
    });

    test("Leave of Absence: the case window lists the six steps with the current one marked", async ({ page }) => {
      await page.goto("/workflow/leave-of-absence");
      await page.getByRole("button", { name: "View details for Therese Lacson" }).click();
      const dialog = page.getByRole("dialog");
      const list = dialog.getByRole("region", { name: "Where this request is" }).getByRole("listitem");
      await expect(list).toHaveCount(6);
      const labels = ["Request submitted", "Staff review", "Dean decision", "Leave begins", "Return", "Back in the program"];
      for (let i = 0; i < labels.length; i++) await expect(list.nth(i)).toContainText(labels[i]);
      await expect(dialog.locator('[aria-current="step"]')).toHaveCount(1);
      await expect(dialog.locator('[aria-current="step"]')).toContainText("Leave begins");
      await page.screenshot({ path: join(SHOTS, "case-window-leave-of-absence-1366.png") });
    });

    test("Graduation board: columns, counts, and the stage timeline in a case window", async ({ page }) => {
      await page.goto("/workflow/graduation");
      const board = page.getByRole("region", { name: "Graduation workflow Kanban board" });
      await expect(board).toBeVisible();
      const titles = await board.locator("section").evaluateAll((sections) => sections.map((s) => s.getAttribute("aria-label")));
      expect(titles.length).toBeGreaterThanOrEqual(3);
      expect(titles[0]).toMatch(/Academically Eligible/);
      await expect(board.getByText("Bianca Santos", { exact: true })).toBeVisible();

      // Bianca's own card (other specs move other students into this column, so "the first one" is not safe)
      await board
        .getByText("Bianca Santos", { exact: true })
        .locator("xpath=ancestor::div[.//button[normalize-space()='View student']][1]")
        .getByRole("button", { name: "View student", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Bianca Santos" })).toBeVisible();
      const toggle = dialog.getByRole("button", { name: /stage history/ });
      await expect(toggle).toContainText("View stage history");
      await expect(toggle).toContainText("9");
      await toggle.click();
      await expect(toggle).toContainText("Hide stage history");
      const steps = dialog.getByRole("region", { name: "Graduation endorsement timeline" }).getByRole("listitem");
      await expect(steps).toHaveCount(9);
      const expected = [
        "Graduation Review Window Open",
        "Candidate List Compiled",
        "Coursework Completion Checked",
        "Research Requirements Validated",
        "Endorsement List Prepared",
        "Dean Review",
        "Endorsement List Revised and Resubmitted",
        "Dean Approval",
        "Endorsed List Exported",
      ];
      for (let i = 0; i < expected.length; i++) await expect(steps.nth(i)).toContainText(expected[i]);
      await expect(steps.nth(6)).toContainText(/\(if needed\)|\(optional\)/); // the revision step is optional
      await expect(dialog.locator('[aria-current="step"]')).toHaveCount(1);
      await expect(dialog.locator('[aria-current="step"]')).toContainText("Graduation Review Window Open");
      await page.screenshot({ path: join(SHOTS, "graduation-timeline-1366.png") });
    });
  });

  test.describe("a student's request pages", () => {
    test("Therese Lacson: Leave of Absence shows where the request is", async ({ browser }) => {
      const { context, page } = await studentPage(browser, "readmission.therese@usls.edu.ph");
      try {
        await page.goto("/student/requests/leave-of-absence");
        const region = page.getByRole("region", { name: "Where this request is" });
        await expect(region).toBeVisible();
        const items = region.getByRole("listitem");
        await expect(items).toHaveCount(6);
        const labels = ["Request submitted", "Staff review", "Dean decision", "Leave begins", "Return", "Back in the program"];
        for (let i = 0; i < labels.length; i++) await expect(items.nth(i)).toContainText(labels[i]);
        for (let i = 0; i < 3; i++) await expect(items.nth(i)).toContainText(/Done|Complete/);
        await expect(items.nth(3)).toContainText(/Now|Current/);
        for (let i = 4; i < 6; i++) await expect(items.nth(i)).toContainText(/Later|Upcoming/);
        await expect(region.locator('[aria-current="step"]')).toHaveCount(1);
        await expect(region.locator('[aria-current="step"]')).toContainText("Leave begins");
        // the status chip of the case card
        await expect(page.getByText("On leave", { exact: true }).first()).toBeVisible();
        await page.screenshot({ path: join(SHOTS, "student-leave-1366.png"), fullPage: true });
      } finally {
        await context.close();
      }
    });

    test("Maya Torres: Return from AWOL shows four steps, the first current", async ({ browser }) => {
      const { context, page } = await studentPage(browser, "awol.maya@usls.edu.ph");
      try {
        await page.goto("/student/requests/awol-return");
        const region = page.getByRole("region", { name: "Where this request is" });
        const items = region.getByRole("listitem");
        await expect(items).toHaveCount(4);
        const labels = ["AWOL flagged", "Return filed", "Dean decision", "Back in the program"];
        for (let i = 0; i < labels.length; i++) await expect(items.nth(i)).toContainText(labels[i]);
        await expect(region.locator('[aria-current="step"]')).toHaveCount(1);
        await expect(region.locator('[aria-current="step"]')).toContainText("AWOL flagged");
        for (let i = 1; i < 4; i++) await expect(items.nth(i)).toContainText(/Later|Upcoming/);
        await page.screenshot({ path: join(SHOTS, "student-awol-1366.png"), fullPage: true });
      } finally {
        await context.close();
      }
    });
  });

  test.describe("process-gate banner", () => {
    test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

    test("a refused Generate report shows the server's message; a real one shows its status chip", async ({ page }) => {
      await page.goto("/course-adjustments?view=adjustments");
      await expect(page.getByRole("heading", { name: "Coursework status report to the Dean" })).toBeVisible();

      // the server refuses: the message appears in the panel
      await page.route("**/api/coursework/reports", (route) =>
        route.request().method() === "POST"
          ? route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "Pretend the report cannot be made right now." }) })
          : route.continue(),
      );
      await page.getByRole("button", { name: "Generate report" }).click();
      await expect(page.getByText("Pretend the report cannot be made right now.")).toBeVisible();
      await page.screenshot({ path: join(SHOTS, "gate-banner-1366.png"), fullPage: true });
      await page.unroute("**/api/coursework/reports");

      // the real call: a Draft report with its status chip and the "Send to Dean" step; the message is gone
      await page.getByRole("button", { name: "Generate report" }).click();
      await expect(page.getByText("Pretend the report cannot be made right now.")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Send to Dean" }).first()).toBeVisible();
      await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("reviewed").first()).toBeVisible();
      await page.screenshot({ path: join(SHOTS, "gate-report-1366.png"), fullPage: true });
    });

    test("a failed curriculum lookup shows the server's message in the study-plan panel", async ({ page }) => {
      await page.goto("/enrollment");
      await expect(page.getByRole("heading", { name: "Curriculum version & study plan draft" })).toBeVisible();
      await page.route("**/api/enrollment/curriculum-tag/*", (route) =>
        route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "No curriculum is on file for this student." }) }),
      );
      await page.locator('select[aria-label="Student"]').selectOption({ index: 1 });
      await expect(page.getByText("No curriculum is on file for this student.")).toBeVisible();
      await page.screenshot({ path: join(SHOTS, "study-plan-banner-1366.png"), fullPage: true });
    });
  });

  test.describe("at 390 px", () => {
    test.use({ storageState: authFile("staff"), viewport: { width: 390, height: 844 } });

    for (const [slug, region] of [
      ["leave-of-absence", "Leave of absence board"],
      ["awol", "AWOL and residency board"],
      ["graduation", "Graduation workflow Kanban board"],
    ]) {
      test(`${slug}: the board scrolls inside itself and the page does not`, async ({ page }) => {
        await page.goto(`/workflow/${slug}`);
        const board = page.getByRole("region", { name: region });
        await expect(board).toBeVisible();
        const sizes = await board.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, overflowX: getComputedStyle(el).overflowX }));
        expect(sizes.overflowX).toBe("auto");
        expect(sizes.scroll).toBeGreaterThan(sizes.client + 50); // there is more board than fits
        expect(await noOverflow(page)).toBe(true);
        await board.evaluate((el) => (el.scrollLeft = 200));
        expect(await board.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
        expect(await noOverflow(page)).toBe(true);
        await page.screenshot({ path: join(SHOTS, `board-${slug}-390.png`), fullPage: true });
      });
    }

    test("Leave of Absence: a case window and the gate pages fit the screen", async ({ page }) => {
      await page.goto("/workflow/leave-of-absence");
      await page.getByRole("button", { name: "View details for Therese Lacson" }).click();
      await expect(page.getByRole("dialog").getByRole("region", { name: "Where this request is" })).toBeVisible();
      expect(await noOverflow(page)).toBe(true);
      await page.keyboard.press("Escape");
      await page.goto("/course-adjustments?view=adjustments");
      await expect(page.getByRole("heading", { name: "Coursework status report to the Dean" })).toBeVisible();
      expect(await noOverflow(page)).toBe(true);
    });
  });

  test.describe("a student at 390 px", () => {
    test("Therese Lacson: the steps stack and the page fits", async ({ browser }) => {
      const { context, page } = await studentPage(browser, "readmission.therese@usls.edu.ph", { width: 390, height: 844 });
      try {
        await page.goto("/student/requests/leave-of-absence");
        const items = page.getByRole("region", { name: "Where this request is" }).getByRole("listitem");
        await expect(items).toHaveCount(6);
        const tops = await items.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
        expect(new Set(tops).size).toBe(6); // one step per line
        expect(await noOverflow(page)).toBe(true);
        await page.screenshot({ path: join(SHOTS, "student-leave-390.png"), fullPage: true });
      } finally {
        await context.close();
      }
    });
  });
});
