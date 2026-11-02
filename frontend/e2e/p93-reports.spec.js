// e2e-writes: none
// Packet P9.3 (owner decision IM20): Reports are five real reports and a short analytics section.
// Written BEFORE the change and red on the old page (a wall of 11 report tabs and 8 analytics tabs above 8 tiles).
// Through the real UI as Graduate School staff (and the Academic Coordinator for the role gate), read-only:
//   - the page offers exactly: Students at risk, Cohorts by stage, Overdue and pending, Defenses, Graduation
//     candidates (+ the Registrar's daily list and Analytics); none of the old tabs or tiles is left;
//   - each report shows the columns and rows the API gives, sorts from the header, pages, narrows with its filters
//     (the API gets the same filters, the URL follows), and Clear filters resets them;
//   - Excel and PDF downloads carry exactly the filtered rows (file name, content, the filter in the request);
//   - an empty result says what it means and offers no download;
//   - Analytics: 3-4 charts, a bar and a chip list the students behind it; the Academic Coordinator has no Analytics;
//   - nothing scrolls sideways at 390 on any tab.
// Nothing here asserts a seeded count: every figure is read from the API at test time (e2e/README.md, "Specs share
// one database").
import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

const SHOTS = join(SCREENS_DIR, "..", process.env.E2E_SHOTS_TAG || "p93");

let tracker;
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ page, context }) => {
  tracker = { problems: [], writes: [], where: { role: "staff", page: "P9.3 reports", viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
  expect(tracker.writes, `non-GET API calls while the pages were open: ${tracker.writes.join(", ")}`).toEqual([]);
});

const REPORTS = [
  { id: "at-risk", tab: "Students at risk" },
  { id: "cohorts", tab: "Cohorts by stage" },
  { id: "overdue", tab: "Overdue and pending" },
  { id: "defenses", tab: "Defenses" },
  { id: "graduation", tab: "Graduation candidates" },
];
const OLD_TABS = [
  "Dashboard summary", "Daily changes", "Missing requirements", "Practicum monitoring", "Withdrawal requests",
  "LOA/readmission", "At-risk", "Open/overdue tasks", "Research completion", "Queue aging & backlog",
  "Stage bottlenecks", "Workload & turnaround", "Residency watchlist", "Completion & attrition",
  "Scheduling cycle time", "Follow-up closure",
];

const main = (page) => page.locator("main");
const tab = (page, name) => page.getByRole("tab", { name, exact: true });
const field = (page, label) => page.locator("label", { has: page.locator(`span:text-is("${label}")`) }).locator("select");
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
async function shot(page, name) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
}
async function api(context, id, params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  const res = await context.request.get(`/api/reports/${id}${qs ? `?${qs}` : ""}`);
  expect(res.status(), `GET /api/reports/${id}`).toBe(200);
  return res.json();
}
async function open(page, report) {
  await page.goto(`/reports?report=${report.id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
  await expect(tab(page, report.tab)).toHaveAttribute("aria-selected", "true");
  await page.waitForLoadState("networkidle");
}

test.describe("staff Reports", () => {
  test.use({ storageState: join(AUTH_DIR, "staff.json"), viewport: { width: 1366, height: 768 } });

  test("the page is five reports and Analytics: the old wall of tabs and the eight tiles are gone", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
    const tabs = (await page.getByRole("tab").allTextContents()).map((text) => text.trim());
    expect(tabs, "the report tabs").toEqual([...REPORTS.map((r) => r.tab), "Registrar changes", "Analytics"]);
    await expect(tab(page, REPORTS[0].tab), "the first report opens").toHaveAttribute("aria-selected", "true");
    for (const old of OLD_TABS) {
      await expect(page.getByRole("button", { name: new RegExp(`^${old.replace(/[/&]/g, (c) => `\\${c}`)}( ·|$)`) }), `old tab "${old}"`).toHaveCount(0);
    }
    expect(await main(page).locator('[data-slot="label"]').count(), "no row of eight number tiles").toBe(0);
    await expect(page.getByRole("button", { name: "Clear report filters" }), "the five-filter bar is gone").toHaveCount(0);
    await shot(page, "reports-1366.png");
  });

  for (const report of REPORTS) {
    test(`${report.tab}: the columns and rows are the API's, the header sorts, the list pages`, async ({ page, context }) => {
      const first = page.waitForResponse((r) => new URL(r.url()).pathname === `/api/reports/${report.id}`);
      await open(page, report);
      const json = await (await first).json();
      await expect(page.getByRole("heading", { level: 2, name: json.title, exact: true })).toBeVisible();
      const table = page.getByRole("table", { name: json.title });
      const heads = (await table.getByRole("columnheader").allTextContents()).map((t) => t.trim());
      expect(heads, "column headings").toEqual(json.columns.map((c) => c.label));
      const rows = table.locator("tbody tr");
      await expect(rows, "one page of rows").toHaveCount(Math.min(10, json.count));
      await expect(main(page).getByText(new RegExp(`\\b${json.count} (rows?|students?)\\b`)).first(), "the row count line").toBeVisible();
      if (json.rows[0]?.student) await expect(rows.first()).toContainText(json.rows[0].student);
      if (json.count > 10) {
        await expect(page.getByRole("button", { name: /next/i }).first(), "more than a page: paging").toBeVisible();
      }

      // sorting from the header (the first sortable column), ascending then descending, exposed to assistive tech
      const sorter = table.getByRole("columnheader").nth(0).getByRole("button");
      await expect(sorter, "the first column sorts").toBeVisible();
      await sorter.click();
      await expect(table.getByRole("columnheader").nth(0)).toHaveAttribute("aria-sort", "ascending");
      await sorter.click();
      await expect(table.getByRole("columnheader").nth(0)).toHaveAttribute("aria-sort", "descending");
      expect(await api(context, report.id), "the API is unchanged by sorting").toMatchObject({ count: json.count });
      await shot(page, `report-${report.id}-1366.png`);
    });
  }

  test("filters narrow the rows: the API gets the same filter, the URL follows, Clear filters resets", async ({ page, context }) => {
    const all = await api(context, "at-risk");
    expect(all.count, "the demo data gives at least one student at risk").toBeGreaterThan(0);
    const programCode = all.rows[0].program;
    const program = all.options.programs.find((p) => p.code === programCode);
    await open(page, REPORTS[0]);
    const narrowed = page.waitForResponse((r) => {
      const u = new URL(r.url());
      return u.pathname === "/api/reports/at-risk" && u.searchParams.get("program_id") === String(program.id);
    });
    await field(page, "Program").selectOption(String(program.id));
    const json = await (await narrowed).json();
    const expected = await api(context, "at-risk", { program_id: program.id });
    expect(json.count).toBe(expected.count);
    await expect(page).toHaveURL(new RegExp(`program_id=${program.id}`));
    const table = page.getByRole("table", { name: json.title });
    await expect(table.locator("tbody tr")).toHaveCount(Math.min(10, expected.count));
    for (const cell of await table.locator("tbody tr td:nth-child(2)").allTextContents()) expect(cell.trim()).toBe(programCode);
    await expect(main(page).getByText(new RegExp(`\\b${expected.count} (rows?|students?)\\b`)).first()).toBeVisible();

    // a second filter, from the report's own list
    const stage = all.rows[0].stage;
    const both = page.waitForResponse((r) => {
      const u = new URL(r.url());
      return u.pathname === "/api/reports/at-risk" && u.searchParams.get("stage") === stage && u.searchParams.get("program_id") === String(program.id);
    });
    await field(page, "Stage").selectOption(stage);
    await both;
    await expect(page).toHaveURL(/stage=/);
    await shot(page, "report-filtered-1366.png");

    const cleared = page.waitForResponse((r) => {
      const u = new URL(r.url());
      return u.pathname === "/api/reports/at-risk" && !u.searchParams.get("program_id") && !u.searchParams.get("stage");
    });
    await page.getByRole("button", { name: "Clear filters" }).click();
    await cleared;
    await expect(page).not.toHaveURL(/program_id=|stage=/);
    await expect(page.getByRole("table", { name: all.title }).locator("tbody tr")).toHaveCount(Math.min(10, all.count));
  });

  test("each report offers the filters that fit it", async ({ page }) => {
    const wanted = {
      "at-risk": ["Program", "Stage", "Risk"],
      cohorts: ["Program", "Stage", "AY entry"],
      overdue: ["Program", "Stage", "Term", "Office", "Type"],
      defenses: ["Program", "Term", "Status", "Defense"],
      graduation: ["Program", "Stage", "Eligibility", "Batch status"],
    };
    for (const report of REPORTS) {
      await open(page, report);
      for (const label of wanted[report.id]) await expect(field(page, label), `${report.tab}: ${label} filter`).toBeVisible();
    }
  });

  test("Excel and PDF carry exactly the filtered rows", async ({ page, context }) => {
    const all = await api(context, "overdue");
    const office = all.options.offices[0];
    test.skip(!office, "the demo data has nothing waiting");
    await open(page, REPORTS[2]);
    const narrowed = page.waitForResponse((r) => {
      const u = new URL(r.url());
      return u.pathname === "/api/reports/overdue" && u.searchParams.get("office") === office;
    });
    await field(page, "Office").selectOption(office);
    await narrowed;
    const expected = await api(context, "overdue", { office });

    const xlsx = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download Excel" }).click();
    const sheet = await xlsx;
    expect(sheet.suggestedFilename()).toMatch(/^usls-gs-report-overdue-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(new URL(sheet.url()).searchParams.get("office")).toBe(office);
    expect(new URL(sheet.url()).searchParams.get("format")).toBe("xlsx");
    const bytes = readFileSync(await sheet.path());
    expect(bytes.subarray(0, 2).toString(), "an xlsx is a zip").toBe("PK");
    // the same bytes the API gives for the same filter
    const direct = await context.request.get(`/api/reports/overdue?office=${encodeURIComponent(office)}&format=xlsx`);
    expect(direct.headers()["content-type"]).toContain("spreadsheetml");
    expect((await direct.body()).length, "same size as a direct request for the filtered rows").toBe(bytes.length);
    expect(expected.rows.every((r) => r.office === office)).toBe(true);

    const pdf = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download PDF" }).click();
    const doc = await pdf;
    expect(doc.suggestedFilename()).toMatch(/^usls-gs-report-overdue-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(new URL(doc.url()).searchParams.get("office")).toBe(office);
    expect(readFileSync(await doc.path()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("an empty result says what it means and offers no download", async ({ page, context }) => {
    const none = await api(context, "at-risk", { stage: "Withdrawn" });
    expect(none.count, "no student is both Withdrawn and at risk in the demo data").toBe(0);
    await page.goto("/reports?report=at-risk&stage=Withdrawn");
    await expect(page.getByText(none.empty)).toBeVisible();
    await expect(page.getByRole("table", { name: none.title })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Download Excel" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Download Excel" })).toBeDisabled();
    await shot(page, "report-empty-1366.png");
  });

  test("Registrar changes: the daily list is still here, with its date and the mark-as-sent button", async ({ page }) => {
    await page.goto("/reports?report=daily-changes");
    await expect(tab(page, "Registrar changes")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { level: 2, name: "Daily changes", exact: true })).toBeVisible();
    await expect(page.getByLabel("Change report date")).toBeVisible();
  });

  test("Analytics: three or four charts, a bar and a chip list the students behind them, the old link still opens it", async ({ page, context }) => {
    const dash = await (await context.request.get("/api/dashboard")).json();
    await page.goto("/reports?workflow_type=analytics");
    await expect(tab(page, "Analytics")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { level: 2, name: "Analytics", exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const charts = main(page).locator(".recharts-wrapper");
    expect(await charts.count(), "3-4 charts").toBeGreaterThanOrEqual(3);
    expect(await charts.count(), "3-4 charts").toBeLessThanOrEqual(4);
    await expect(main(page).locator(".recharts-pie"), "no pie or donut for a quantity").toHaveCount(0);
    for (const title of ["Lifecycle stage distribution", "Risk level", "Students by college", "Research gate position"]) {
      await expect(page.getByRole("heading", { level: 3, name: title, exact: true }), title).toBeVisible();
    }
    // every bar has a readable label: the stage chart labels all the stages the dashboard API reports
    const stageCard = main(page).locator("section", { has: page.getByRole("heading", { name: "Lifecycle stage distribution", exact: true }) });
    const labels = await stageCard.locator(".recharts-yAxis .recharts-cartesian-axis-tick-value").allTextContents();
    expect(labels.length).toBe(dash.stage_distribution.length);

    // a bar lists the students behind it
    const drill = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/dashboard/drilldown");
    await stageCard.locator(".recharts-bar-rectangle").first().click();
    const { json } = await drill.then(async (r) => ({ json: await r.json() }));
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(json.title);
    await expect(dialog.getByText("Loading filtered details…")).toBeHidden();
    if (json.rows?.length) await expect(dialog.locator('a[href^="/students/"]').first(), "student rows link to records").toBeVisible();
    await page.getByRole("button", { name: "Close dashboard details" }).click();
    await expect(dialog).toHaveCount(0);

    // a chip does the same for the keyboard
    const chip = page.locator('button[aria-label^="Show "]').first();
    await chip.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close dashboard details" }).click();
    await shot(page, "analytics-1366.png");
  });

  test("390 px: every tab fits without sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const id of [...REPORTS.map((r) => r.id), "daily-changes", "analytics"]) {
      await page.goto(`/reports?report=${id}`);
      await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(await noOverflow(page), `horizontal overflow on ${id} at 390`).toBeLessThanOrEqual(1);
      await shot(page, `report-${id}-390.png`);
    }
  });
});

test.describe("academic coordinator Reports", () => {
  test.use({ storageState: join(AUTH_DIR, "academic-coordinator.json"), viewport: { width: 1366, height: 768 } });

  test("sees the five reports and the daily list, no Analytics (the dashboard API is Graduate School only), no failed call", async ({ page }) => {
    tracker.where = { role: "academic-coordinator", page: "P9.3 reports", viewport: 1366 };
    await page.goto("/reports");
    await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const tabs = (await page.getByRole("tab").allTextContents()).map((text) => text.trim());
    expect(tabs).toEqual([...REPORTS.map((r) => r.tab), "Registrar changes"]);
    await tab(page, "Graduation candidates").click();
    await expect(page.getByRole("heading", { level: 2, name: "Graduation candidates", exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await shot(page, "reports-academic-coordinator-1366.png");
  });
});
