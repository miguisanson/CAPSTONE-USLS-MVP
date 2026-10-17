// Packet P7.1 (owner decisions IM19 + AD7 + IM20): pins the back-office home and the analytics that moved to Reports.
// Written BEFORE the change and red on the old home. Through the real UI, read-only (nothing but navigation and
// dialogs is touched, no data changes):
//   - Graduate School staff: the first section is "Needs your action" and lists the office's OWN open tasks, overdue
//     first, then the one due soonest, each with a link that opens a real page; tasks held by other offices are not in
//     it but in "Waiting on others" (at most 3 rows and a View all); no chart is on the home; 3-4 key numbers, each
//     named once; "Recent activity" has a View all link to the Activity Log; nothing overflows at 390;
//   - Reports gets an "Analytics" tab with the charts (every stage bar has its label), the drill-down dialog still
//     opens from a category, the Reports filters narrow the charts, and the dialog's student rows link to records;
//   - Academic Coordinator: "/" works for that office (its own tasks, no 403 from an API it may not call);
//     the Analytics tab is not offered (the dashboard API is Graduate School only).
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

// E2E_SHOTS_TAG lets a before/after comparison write to two folders; the default is "p71".
const SHOTS = join(SCREENS_DIR, "..", process.env.E2E_SHOTS_TAG || "p71");

let tracker;
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ page, context }) => {
  tracker = { problems: [], writes: [], where: { role: "staff", page: "P7.1 staff home", viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
  expect(tracker.writes, `non-GET API calls while the pages were open: ${tracker.writes.join(", ")}`).toEqual([]);
});

const main = (page) => page.locator("main");
const sectionOf = (page, name) => main(page).locator("section", { has: page.getByRole("heading", { name, exact: true }) });
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
async function shot(page, name) {
  await page.mouse.move(0, 0); // park the mouse so no hover colour is in the picture
  await page.waitForTimeout(600); // the page's own fade-in
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
}
/** The office's open tasks the way the home must order them: overdue first (oldest first), then due soonest. */
const urgent = (tasks) =>
  [...tasks].sort((a, b) => Number(Boolean(b.overdue)) - Number(Boolean(a.overdue)) || new Date(a.due_at) - new Date(b.due_at));

test.describe("staff home", () => {
  test.use({ storageState: join(AUTH_DIR, "staff.json"), viewport: { width: 1366, height: 768 } });

  test("'Needs your action' is first and lists the office's own tasks, most urgent first, with working links", async ({ page, context }) => {
    const own = await (await context.request.get("/api/tasks?owner=Graduate%20School%20Staff&page_size=200")).json();
    expect(own.items.length, "the demo data gives the Graduate School office open tasks").toBeGreaterThan(0);
    await page.goto("/");
    await expect(page.locator("main h1")).toBeVisible();
    await page.waitForLoadState("networkidle");

    await expect(main(page).locator("h2").first(), "the first section of the page").toHaveText("Needs your action");
    const mine = sectionOf(page, "Needs your action");
    const rows = mine.locator("li");
    const expected = urgent(own.items);
    await expect(rows.first()).toContainText(expected[0].title);
    expect(await rows.count(), "a short list: at most eight rows").toBeLessThanOrEqual(8);
    expect(await rows.count()).toBe(Math.min(8, expected.length));
    for (let i = 0; i < Math.min(3, expected.length); i++) await expect(rows.nth(i), `row ${i + 1} is the ${i + 1}. most urgent task`).toContainText(expected[i].title);
    // none of the rows is a task another office holds
    const others = (await (await context.request.get("/api/tasks?owner=Dean&page_size=50")).json()).items;
    for (const t of others.slice(0, 5)) await expect(mine.getByText(t.title, { exact: true }), `Dean's task "${t.title}" is not this office's action`).toHaveCount(0);

    // every row has a link; the first one opens a real page
    const links = mine.locator("li a");
    expect(await links.count(), "every row has a link").toBe(await rows.count());
    const href = await links.first().getAttribute("href");
    expect(href).toMatch(/^\//);
    await links.first().click();
    await expect(page).toHaveURL(new RegExp(`${href.split("?")[0].replace(/\//g, "\\/")}`));
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.getByText("This page is not available yet")).toHaveCount(0);
  });

  test("tasks held by other offices wait in their own group (three rows at most), and the number of own tasks is shown once", async ({ page, context }) => {
    await page.goto("/");
    await expect(main(page).locator("h2").first()).toHaveText("Needs your action");
    await page.waitForLoadState("networkidle");
    const all = await (await context.request.get("/api/tasks?page_size=200")).json();
    const heldByOthers = all.items.filter((t) => !/^(Graduate School Staff|GS Staff)$/.test(t.owner_role));
    if (heldByOthers.length) {
      await expect(main(page).locator("h2").nth(1), "the second section, right under the actions").toHaveText("Waiting on others");
      const waiting = sectionOf(page, "Waiting on others");
      expect(await waiting.locator("li").count()).toBeLessThanOrEqual(3);
      await expect(waiting.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/work-queue");
      await expect(sectionOf(page, "Needs your action").getByText(/^With the /), "no office-held row under Needs your action").toHaveCount(0);
    }
    const label = main(page).locator('[data-slot="label"]', { hasText: /^Your open tasks$/i }).locator("xpath=..");
    const own = await (await context.request.get("/api/tasks?owner=Graduate%20School%20Staff&page_size=1")).json();
    await expect(label.locator('[data-slot="value"]')).toHaveText(String(own.total));
  });

  test("no chart on the home; four key numbers, each named once; recent activity links to the Activity Log", async ({ page, context }) => {
    await page.goto("/");
    await expect(main(page).locator("h2").first()).toHaveText("Needs your action");
    await page.waitForLoadState("networkidle");
    expect(await main(page).locator(".recharts-wrapper, svg.recharts-surface").count(), "charts left the home (IM20)").toBe(0);

    const labels = (await main(page).locator('[data-slot="label"]').allTextContents()).map((t) => t.trim().toLowerCase());
    expect([...labels].sort(), "the key-number labels").toEqual(["at risk or delayed", "confirmed defenses", "students monitored", "your open tasks"]);
    const kpis = (await (await context.request.get("/api/dashboard")).json()).kpis;
    const value = (name) => main(page).locator('[data-slot="label"]', { hasText: new RegExp(`^${name}$`, "i") }).locator("xpath=..").locator('[data-slot="value"]');
    await expect(value("Students monitored")).toHaveText(String(kpis.total_students));
    await expect(value("At risk or delayed")).toHaveText(String(kpis.at_risk));
    await expect(value("Confirmed defenses")).toHaveText(String(kpis.confirmed_schedules));
    // every figure is on the page once: the old second strip (Active / On leave / Completed / Overdue tasks) is gone
    for (const gone of ["Active", "On leave", "Completed", "Overdue tasks"]) {
      await expect(main(page).locator('[data-slot="label"]', { hasText: new RegExp(`^${gone}$`, "i") }), `no "${gone}" tile`).toHaveCount(0);
    }

    const activity = sectionOf(page, "Recent activity");
    await expect(activity.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/activity");
    expect(await activity.locator("li").count(), "a short list").toBeLessThanOrEqual(6);
    // the old filter bar is gone from the home (it lives on Reports)
    await expect(page.getByRole("button", { name: "Clear dashboard filters" })).toHaveCount(0);
    await expect(main(page).locator("select")).toHaveCount(0);
    // the moved blocks stay one click away
    await expect(main(page).getByRole("link", { name: "Reports", exact: true }).first()).toHaveAttribute("href", "/reports");
    await expect(main(page).getByRole("link", { name: "Analytics", exact: true })).toHaveAttribute("href", "/reports?workflow_type=analytics");
    await shot(page, "staff-home-1366.png");
  });

  test("layout: one column at 390 with no sideways scroll; the actions take the wide column at 1366", async ({ page }) => {
    await page.goto("/");
    await expect(main(page).locator("h2").first()).toHaveText("Needs your action");
    await page.waitForLoadState("networkidle");
    const actions = sectionOf(page, "Needs your action");
    const activity = sectionOf(page, "Recent activity");
    const a = await actions.boundingBox();
    const r = await activity.boundingBox();
    expect(a.width, "actions are wider than the activity column").toBeGreaterThan(r.width);
    expect(r.x, "activity beside the actions at 1366").toBeGreaterThan(a.x + a.width - 2);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const a2 = await actions.boundingBox();
    const r2 = await activity.boundingBox();
    expect(Math.abs(a2.x - r2.x), "one column at 390").toBeLessThan(2);
    expect(r2.y, "activity under the actions at 390").toBeGreaterThan(a2.y + a2.height - 2);
    expect(await noOverflow(page), "horizontal overflow at 390").toBeLessThanOrEqual(1);
    await shot(page, "staff-home-390.png");
  });
});

test.describe("analytics on Reports", () => {
  test.use({ storageState: join(AUTH_DIR, "staff.json"), viewport: { width: 1366, height: 768 } });

  test("the Analytics tab shows the charts with every stage labelled, and a category opens the drill-down dialog", async ({ page, context }) => {
    const dash = await (await context.request.get("/api/dashboard")).json();
    await page.goto("/reports");
    await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
    await page.getByRole("button", { name: "Analytics", exact: true }).click();
    await expect(page).toHaveURL(/workflow_type=analytics/);
    await expect(page.getByRole("heading", { level: 2, name: "Analytics", exact: true })).toBeVisible();
    for (const title of ["Lifecycle stage distribution", "Risk level", "Students by college", "Research gate position"]) {
      await expect(page.getByRole("heading", { level: 3, name: title, exact: true }), title).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Open work queue by owner" }), "the two-bar owner chart is dropped").toHaveCount(0);
    await page.waitForLoadState("networkidle");
    await expect(main(page).locator(".recharts-wrapper").first()).toBeVisible();
    expect(await main(page).locator(".recharts-wrapper").count(), "3-4 charts").toBeGreaterThanOrEqual(3);
    expect(await main(page).locator(".recharts-wrapper").count(), "3-4 charts").toBeLessThanOrEqual(4);

    // the stage chart: one readable label per bar (the old chart skipped axis labels)
    const stageCard = main(page).locator("section", { has: page.getByRole("heading", { name: "Lifecycle stage distribution", exact: true }) });
    const stageLabels = await stageCard.locator(".recharts-yAxis .recharts-cartesian-axis-tick-value").allTextContents();
    expect(stageLabels.length, "every stage has an axis label").toBe(dash.stage_distribution.length);
    // (a long name may wrap onto two lines, whose pieces the page text joins without a space)
    const squash = (text) => text.replace(/\s+/g, "");
    for (const row of dash.stage_distribution) expect(stageLabels.map(squash), `label for ${row.stage}`).toContain(squash(row.stage));

    // a category opens the dialog: rows come from the drill-down API, the X closes it, the page behind stays
    const chip = page.locator('button[aria-label^="Show "]').first();
    await expect(chip).toBeVisible();
    const drill = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/dashboard/drilldown");
    await chip.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const { params, json } = await drill.then(async (r) => ({ params: new URL(r.url()).searchParams, json: await r.json() }));
    expect(params.get("type")).toBeTruthy();
    await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(json.title);
    await expect(dialog.getByText("Loading filtered details…")).toBeHidden();
    const student = dialog.locator('a[href^="/students/"]').first();
    if (json.rows?.length) {
      await expect(dialog).toContainText(json.rows[0].name || json.rows[0].student?.name || json.rows[0].title);
      await expect(student, "student rows link to records").toBeVisible();
    }
    await page.getByRole("button", { name: "Close dashboard details" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
    await shot(page, "reports-analytics-1366.png");
  });

  test("the Reports filters narrow the charts (the dashboard API gets the same filters) and ?workflow_type=analytics opens the tab", async ({ page }) => {
    await page.goto("/reports?workflow_type=analytics");
    await expect(page.getByRole("heading", { level: 2, name: "Analytics", exact: true })).toBeVisible();
    const field = (label) => page.locator("label", { has: page.locator(`span:text-is("${label}")`) }).locator("select");
    const program = field("Program");
    const value = await program.locator("option").nth(1).getAttribute("value");
    const narrowed = page.waitForResponse((r) => {
      const u = new URL(r.url());
      return u.pathname === "/api/dashboard" && u.searchParams.get("program_id") === value;
    });
    await program.selectOption(value);
    await narrowed;
    await expect(page).toHaveURL(new RegExp(`program_id=${value}`));
    await expect(page.getByRole("heading", { level: 2, name: "Analytics", exact: true }), "the tab stays open under a filter").toBeVisible();
    const risk = page.waitForResponse((r) => {
      const u = new URL(r.url());
      return u.pathname === "/api/dashboard" && u.searchParams.get("risk") === "On Track" && u.searchParams.get("program_id") === value;
    });
    await field("Risk").selectOption("On Track");
    await risk;
  });

  test("no sideways scroll at 390", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/reports?workflow_type=analytics");
    await expect(page.getByRole("heading", { level: 2, name: "Analytics", exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(await noOverflow(page), "horizontal overflow at 390").toBeLessThanOrEqual(1);
    await shot(page, "reports-analytics-390.png");
  });
});

test.describe("academic coordinator home", () => {
  test.use({ storageState: join(AUTH_DIR, "academic-coordinator.json"), viewport: { width: 1366, height: 768 } });

  test("'/' shows that office's own tasks, with no call the account may not make; Reports offers no Analytics tab", async ({ page, context }) => {
    tracker.where = { role: "academic-coordinator", page: "P7.1 coordinator home", viewport: 1366 };
    const own = await (await context.request.get("/api/tasks?owner=Academic%20Coordinator&page_size=200")).json();
    expect(own.items.length, "the demo data gives the Academic Coordinator open tasks").toBeGreaterThan(0);
    await page.goto("/");
    await expect(page.locator("main h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(main(page).locator("h2").first()).toHaveText("Needs your action");
    await expect(page.locator("main h1"), "the welcome uses a first name, not 'Dr.'").toHaveText(/^Welcome, (?!Dr\.?$)\S+/);
    const mine = sectionOf(page, "Needs your action");
    await expect(mine.locator("li").first()).toContainText(urgent(own.items)[0].title);
    expect(await mine.locator("li").count()).toBe(Math.min(8, own.items.length));
    // no chart, no filter bar, and no Graduate-School-only figures
    expect(await main(page).locator(".recharts-wrapper").count()).toBe(0);
    await expect(main(page).locator('[data-slot="label"]', { hasText: /^Your open tasks$/i })).toHaveCount(1);
    await expect(page.getByText("Could not load dashboard")).toHaveCount(0);
    expect(await noOverflow(page)).toBeLessThanOrEqual(1);
    await shot(page, "coordinator-home-1366.png");

    await page.goto("/reports");
    await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Analytics", exact: true })).toHaveCount(0);
  });
});
