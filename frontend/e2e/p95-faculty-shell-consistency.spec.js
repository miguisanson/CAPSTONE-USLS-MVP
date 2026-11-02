// e2e-writes: none
// Packet conE (consistency findings 11 and 15, issue I-129): the non-student pages behave like each other.
// Written BEFORE the change (red on the old code). Through the real UI, read only; data that another spec could change is
// replaced by a mocked API answer (e2e/README.md, "Specs share one database"), so the order of the specs does not matter.
//   - 11  a card title never repeats the page title: faculty Assigned Classes, My Advisees, Graduation (staff and Dean);
//   - 15  the faculty identity chip names the role once; the Work Queue's Action column says who acts on a Dean task; a
//         DataTable sorts by default (Work Queue, Faculty list); the staff lifecycle steps are numbered in order, with
//         Course Audit among them;
//   - I-129  the Research Coordinator's "Waiting on others" lists only work about the research process, and a "Review
//         submitted Three concept papers" task opens Research Gate for that student.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

const SHOTS = process.env.P95_SHOTS || "E:/Temp/claude/shots-conE/after";
const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const main = (page) => page.locator("main");
const norm = (text) => (text || "").replace(/\s+/g, " ").trim();

let tracker;
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ page, context }, info) => {
  tracker = { problems: [], writes: [], where: { role: "p95", page: info.title, viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
});
async function shot(page, name) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
}
async function ready(page, path) {
  await page.goto(path);
  await expect(page.locator("main h1")).toBeVisible();
  await page.waitForLoadState("networkidle");
}
/** The h2 texts inside <main>, and the h1 text. */
async function headings(page) {
  const h2 = (await main(page).locator("h2").allInnerTexts()).map(norm);
  const h1 = norm(await main(page).locator("h1").first().innerText());
  return { h1, h2 };
}
/** No section title says the page title again (equal to it, or the page title inside it). */
function expectNoRepeat({ h1, h2 }) {
  const low = h1.toLowerCase();
  const repeats = h2.filter((text) => text.toLowerCase() === low || text.toLowerCase().includes(low));
  expect(repeats, `card titles that repeat the page title "${h1}"`).toEqual([]);
}

// ------------------------------------------------------------------------------------------------ finding 11
test.describe("finding 11: no card title repeats the page title (faculty, staff, Dean)", () => {
  test.describe("faculty", () => {
    test.use({ storageState: authFile("faculty"), viewport: { width: 1366, height: 768 } });

    test("Assigned Classes opens on the filters, not on a second title", async ({ page }) => {
      await ready(page, "/faculty-portal/classes");
      const found = await headings(page);
      expect(found.h1).toBe("Assigned Classes");
      expect(found.h2, "the card title 'Assigned class rosters' is gone").not.toContain("Assigned class rosters");
      expectNoRepeat(found);
      await expect(main(page).getByText("Class rosters for your assigned subjects.")).toBeVisible();
      await shot(page, "faculty-classes-1366.png");
    });

    test("My Advisees: the cards say something the page title does not", async ({ page }) => {
      await ready(page, "/faculty-portal/advisees");
      const found = await headings(page);
      expect(found.h1).toBe("My Advisees");
      expect(found.h2).not.toContain("Advisees");
      expect(found.h2).not.toContain("Your advisees");
      expect(found.h2, "the meter card names what it counts").toContain("Advisee places");
      expectNoRepeat(found);
      await shot(page, "faculty-advisees-1366.png");
    });
  });

  for (const [key, path, shotName] of [["staff", "/workflow/graduation", "staff-graduation-1366.png"], ["dean", "/dean/approvals/graduation", "dean-graduation-1366.png"]]) {
    test.describe(key, () => {
      test.use({ storageState: authFile(key), viewport: { width: 1366, height: 768 } });
      test(`${key}: Graduation Endorsement has no 'Graduation endorsement candidates' card title`, async ({ page }) => {
        await ready(page, path);
        const found = await headings(page);
        expect(found.h1).toBe("Graduation Endorsement");
        expect(found.h2).not.toContain("Graduation endorsement candidates");
        expectNoRepeat(found);
        await shot(page, shotName);
      });
    });
  }
});

// ------------------------------------------------------------------------------------------------ finding 15
test.describe("finding 15: the faculty identity chip names the role once", () => {
  test.use({ storageState: authFile("faculty"), viewport: { width: 1366, height: 768 } });
  test("the top-bar chip reads 'Name · Faculty', not 'Name (Faculty) · Faculty'", async ({ page }) => {
    await ready(page, "/faculty-portal");
    const chip = page.locator("header span[title]").first();
    const text = norm(await chip.innerText());
    expect(text, "the chip names the role").toMatch(/Faculty/);
    expect((text.match(/Faculty/g) || []).length, `the role is said once: "${text}"`).toBe(1);
    expect(norm(await chip.getAttribute("title")).match(/Faculty/g)?.length, "the tooltip says it once too").toBe(1);
    await shot(page, "faculty-home-1366.png");
  });
});

test.describe("finding 15: Work Queue", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });
  const task = (id, title, owner_role, extra = {}) => ({
    id, title, owner_role, student_id: 5, student_name: "Ana Reyes", due_at: "2026-11-0" + (id % 9 + 1), status: "Pending",
    priority: 50, overdue: false, action_url: null, action_label: null, ...extra,
  });
  const TASKS = [
    task(9001, "Zulu decision on the withdrawal request", "Dean"),
    task(9002, "Upload the signed form", "Student"),
    task(9003, "Alpha follow-up call", "Graduate School Staff"),
    task(9004, "Mike check", "Academic Coordinator", { action_url: "/course-adjustments", action_label: "Open Course Adjustments" }),
  ];
  async function mockTasks(page) {
    await page.route("**/api/tasks**", (route) => route.fulfill({ json: { items: TASKS, total: TASKS.length, page: 1, page_size: 50, pages: 1 } }));
  }

  test("a Dean-owned task says 'Dean decides' in Action instead of '-'; every row says something", async ({ page }) => {
    await mockTasks(page);
    await ready(page, "/work-queue");
    const row = (title) => main(page).locator("tbody tr", { hasText: title });
    await expect(row("Zulu decision")).toContainText("Dean decides");
    await expect(row("Upload the signed form")).toContainText("Student acts");
    await expect(row("Mike check").getByRole("link", { name: "Open Course Adjustments" })).toHaveAttribute("href", "/course-adjustments");
    await expect(row("Alpha follow-up").getByRole("link")).toHaveCount(2); // the student link and the action link
    const lastCells = (await main(page).locator("tbody tr td:last-child").allInnerTexts()).map(norm);
    expect(lastCells.filter((text) => text === "-" || text === ""), "no row has an empty Action").toEqual([]);
    await shot(page, "work-queue-1366.png");
  });

  test("column headers sort: Task A to Z, then Z to A; the Action column has no sort button", async ({ page }) => {
    await mockTasks(page);
    await ready(page, "/work-queue");
    const titles = async () => (await main(page).locator("tbody tr td:first-child").allInnerTexts()).map(norm);
    await main(page).getByRole("button", { name: "Task", exact: true }).click();
    expect(await titles()).toEqual(["Alpha follow-up call", "Mike check", "Upload the signed form", "Zulu decision on the withdrawal request"]);
    await main(page).getByRole("button", { name: "Task", exact: true }).click();
    expect((await titles())[0]).toBe("Zulu decision on the withdrawal request");
    await expect(main(page).locator("thead th", { hasText: "Task" })).toHaveAttribute("aria-sort", "descending");
    await expect(main(page).locator("thead th", { hasText: "Action" }).getByRole("button")).toHaveCount(0);
    for (const name of ["Owner", "Student", "Due", "Status"]) await expect(main(page).locator("thead th").getByRole("button", { name, exact: true }), `${name} sorts`).toHaveCount(1);
  });

  test("the staff Faculty list sorts too", async ({ page }) => {
    await ready(page, "/faculty");
    await expect(main(page).locator("thead th button").first(), "at least one sortable column header").toBeVisible();
    expect(await main(page).locator("thead th button").count()).toBeGreaterThanOrEqual(2);
  });
});

test.describe("finding 15: the lifecycle steps are numbered in order, Course Audit among them", () => {
  const LIFECYCLE = /^\/(course-adjustments|enrollment|workflow\/(student-handoff|course-audit|research-gate|panel-matching|defense-scheduling|practicum|graduation))$/;
  async function lifecycleLabels(page) {
    await ready(page, "/");
    const links = await page.locator("aside:visible nav a").evaluateAll((anchors) => anchors.map((a) => [a.getAttribute("href"), (a.textContent || "").replace(/\s+/g, " ").trim()]));
    return links.filter(([href]) => LIFECYCLE.test(href)).map(([, label]) => label);
  }
  test.describe("staff", () => {
    test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });
    test("nine steps, 1 to 9, in the order of the sidebar", async ({ page }) => {
      expect(await lifecycleLabels(page)).toEqual([
        "1 · Student Handoff", "2 · Course Adjustments", "3 · Enrollment", "4 · Course Audit", "5 · Research Gate",
        "6 · Panel Matching", "7 · Defense Scheduling", "8 · Practicum", "9 · Graduation Endorsement",
      ]);
    });
  });
  test.describe("research coordinator", () => {
    test.use({ storageState: authFile("research-coordinator"), viewport: { width: 1366, height: 768 } });
    test("every step it can open is numbered, and the numbers go up", async ({ page }) => {
      const labels = await lifecycleLabels(page);
      expect(labels.length).toBeGreaterThan(0);
      const numbers = labels.map((label) => Number((label.match(/^(\d+) · /) || [])[1]));
      expect(numbers.every((n) => n > 0), `all numbered: ${labels.join(" | ")}`).toBe(true);
      expect(numbers, "in order").toEqual([...numbers].sort((a, b) => a - b));
    });
  });
});

// ------------------------------------------------------------------------------------------------ I-129
test.describe("I-129: Research Coordinator home", () => {
  test.use({ storageState: authFile("research-coordinator"), viewport: { width: 1366, height: 768 } });
  const task = (id, title, owner_role, extra = {}) => ({
    id, title, owner_role, student_id: 70 + (id % 10), student_name: `Student ${id}`, due_at: "2026-11-05", status: "Pending",
    priority: 50, overdue: false, action_url: null, action_label: null, ...extra,
  });
  const ALL = [
    task(9101, "Review submitted Three concept papers", "Research Coordinator", { student_id: 77, student_name: "Ana Reyes" }),
    task(9102, "Review automatic AWOL policy alert", "Dean"),
    task(9103, "Tell the Registrar the approved leave was cancelled", "Graduate School Staff"),
    task(9104, "Decide on the readmission request", "Dean"),
    task(9105, "Endorse Form 1 and the three concept papers", "Academic Coordinator"),
    task(9106, "Appoint the panel for the title defense", "Dean"),
    task(9107, "Upload the signed withdrawal form", "Student"),
  ];
  test("Waiting on others lists only research-process work; the concept-paper task opens Research Gate for that student", async ({ page }) => {
    await page.route("**/api/tasks**", (route) => {
      const owner = new URL(route.request().url()).searchParams.get("owner");
      const items = owner ? ALL.filter((t) => t.owner_role === owner) : ALL;
      return route.fulfill({ json: { items, total: items.length, page: 1, page_size: 200, pages: 1 } });
    });
    await ready(page, "/");
    const waiting = main(page).locator("section", { has: page.getByRole("heading", { name: "Waiting on others", exact: true }) });
    await expect(waiting).toContainText("concept papers");
    await expect(waiting).toContainText("panel");
    for (const unrelated of [/AWOL/i, /leave/i, /readmission/i, /withdrawal/i]) {
      await expect(waiting, `unrelated work ${unrelated} is not listed`).not.toContainText(unrelated);
    }
    const mine = main(page).locator("section", { has: page.getByRole("heading", { name: "Needs your action", exact: true }) });
    const row = mine.locator("li", { hasText: "Review submitted Three concept papers" });
    await expect(row.getByRole("link", { name: "Open Research Gate" })).toHaveAttribute("href", "/workflow/research-gate?student_id=77");
    await shot(page, "research-coordinator-home-1366.png");
  });
});
