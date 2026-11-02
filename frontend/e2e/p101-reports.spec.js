// e2e-writes: none
// Packet F1 + F2 + F4 (I-141, AD10, .planning/research/REPORTS-SPEC-2026-11-02.md): the Reports pages answer questions.
// Written BEFORE the page and red on the old Reports / Dean analytics pages. Through the real UI, read only:
//   - one frame on every Reports page: a strip of six numbers (value, comparison in words and an arrow, never colour
//     alone); each number opens the students behind it; program / entry cohort / period live in the address and
//     survive a reload; the period starts on "Last 12 months" and the page says so;
//   - tabs per role: staff and Academic Coordinator, Research Coordinator, Dean;
//   - staff views: Needs attention (cause bars -> list), Where students get stuck (stage clock with zones named in
//     words), Office speed, Records to fix; each chart has one question as its title, a hint, a table alternative and
//     says why it is empty;
//   - Dean views: waiting by age band, how fast, outcomes, graduation pipeline; "Decisions waiting" equals the Dean home
//     (I-074).
// Nothing here asserts a seeded count: every figure is read from the API at test time (e2e/README.md).
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

const SHOTS = join(SCREENS_DIR, "..", process.env.E2E_SHOTS_TAG || "p101");
const PERIOD = "term=last-12-months"; // what the page asks for until the user picks another period

let tracker;
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ page, context }) => {
  tracker = { problems: [], writes: [], where: { role: "staff", page: "P101 reports", viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
  expect(tracker.writes, `non-GET API calls while the pages were open: ${tracker.writes.join(", ")}`).toEqual([]);
});

const STAFF_TABS = [
  "Needs attention", "Where students get stuck", "Office speed", "Records to fix",
  "Cohorts by stage", "Graduation candidates", "Overdue and pending", "Defenses", "Registrar changes",
];
const RESEARCH_TABS = ["Needs attention", "Where students get stuck", "Records to fix"];
const DEAN_TABS = ["Waiting for my decision", "How fast decisions are made", "Outcomes", "Graduation pipeline"];

const main = (page) => page.locator("main");
const tab = (page, name) => page.getByRole("tab", { name, exact: true });
const strip = (page) => page.getByRole("group", { name: "Summary numbers" });
const tabNames = async (page) => (await page.getByRole("tab").allTextContents()).map((text) => text.trim());
const field = (page, label) => page.locator("label", { has: page.locator(`span:text-is("${label}")`) }).locator("select");
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const countIn = async (locator) => Number((await locator.innerText()).match(/\d+/)?.[0]);
async function shot(page, name) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
}
async function api(context, path, params = PERIOD) {
  const res = await context.request.get(`/api/reports/${path}?${params}`);
  expect(res.status(), `GET /api/reports/${path}`).toBe(200);
  return res.json();
}
async function open(page, path) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: "Reports & Analytics" })).toBeVisible();
  await expect(strip(page).getByRole("button")).toHaveCount(6);
  await page.waitForLoadState("networkidle");
}

test.describe("staff Reports frame", () => {
  test.use({ storageState: join(AUTH_DIR, "staff.json"), viewport: { width: 1366, height: 768 } });

  test("six numbers with a comparison each; the period starts on the last 12 months and says so", async ({ page, context }) => {
    await open(page, "/reports");
    const summary = await api(context, "summary");
    expect(summary.tiles.map((t) => t.key)).toEqual(["active", "behind", "waiting", "decide_days", "defenses", "graduation"]);
    const buttons = strip(page).getByRole("button");
    for (let i = 0; i < 6; i++) {
      const tile = summary.tiles[i];
      const button = buttons.nth(i);
      await expect(button, tile.label).toContainText(tile.label);
      await expect(button, `${tile.label}: the value`).toContainText(tile.value == null ? "-" : String(tile.value));
      // The comparison is words (and an arrow icon), so it does not depend on colour.
      await expect(button.locator("[data-comparison]"), `${tile.label}: comparison`).toHaveText(/\S/);
      await expect(button.locator("[data-comparison]")).toHaveAttribute("data-trend", /^(up|down|flat|target-met|target-missed|none)$/);
    }
    await expect(field(page, "Period")).toHaveValue("last-12-months");
    await expect(main(page).getByText(/Showing the last 12 months/)).toBeVisible();
    await shot(page, "staff-attention-1366.png");
  });

  test("a number opens the students behind it, with the same count and a download", async ({ page, context }) => {
    await open(page, "/reports");
    const summary = await api(context, "summary");
    for (const key of ["active", "behind", "waiting"]) {
      const tile = summary.tiles.find((t) => t.key === key);
      await strip(page).getByRole("button", { name: new RegExp(`^${tile.label}`) }).click();
      const dialog = page.getByRole("dialog", { name: tile.label });
      await expect(dialog).toBeVisible();
      const expected = tile.count ?? tile.value;
      expect(await countIn(dialog.getByText(/^\d+ rows?$/)), `${tile.label}: rows in the list`).toBe(expected);
      await expect(dialog.getByRole("link", { name: "Download Excel" })).toHaveAttribute("href", new RegExp(`/api/reports/summary/${key}\\?.*format=xlsx`));
      await expect(dialog.getByRole("link", { name: "Download PDF" })).toHaveAttribute("href", /format=pdf/);
      if (key === "active") await shot(page, "staff-tile-list-1366.png");
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
  });

  test("program, cohort and period are in the address and survive a reload", async ({ page }) => {
    await open(page, "/reports");
    const program = field(page, "Program");
    const options = await program.locator("option").evaluateAll((list) => list.map((o) => o.value).filter(Boolean));
    expect(options.length, "the demo has programs").toBeGreaterThan(0);
    await program.selectOption(options[0]);
    await field(page, "Period").selectOption("all");
    await expect(page).toHaveURL(new RegExp(`program_id=${options[0]}`));
    await expect(page).toHaveURL(/period=all/);
    const asked = page.waitForRequest((r) => /\/api\/reports\/summary\?/.test(r.url()) && r.url().includes("term=all") && r.url().includes(`program_id=${options[0]}`));
    await page.reload();
    await asked;
    await expect(strip(page).getByRole("button")).toHaveCount(6);
    await expect(field(page, "Program")).toHaveValue(options[0]);
    await expect(field(page, "Period")).toHaveValue("all");
    // The filters stay when the tab changes.
    await tab(page, "Where students get stuck").click();
    await expect(page).toHaveURL(/report=stages/);
    await expect(page).toHaveURL(new RegExp(`program_id=${options[0]}`));
    await expect(field(page, "Period")).toHaveValue("all");
  });

  test("the staff tabs, and the dropped views are gone", async ({ page }) => {
    await open(page, "/reports");
    expect(await tabNames(page)).toEqual(STAFF_TABS);
    await expect(tab(page, "Needs attention")).toHaveAttribute("aria-selected", "true");
    for (const gone of ["Analytics", "Students at risk"]) await expect(tab(page, gone), gone).toHaveCount(0);
    for (const gone of ["Students by college", "Risk level", "Research gate position", "Pending load by program"]) {
      await expect(main(page).getByText(gone, { exact: true }), gone).toHaveCount(0);
    }
  });

  test("Needs attention: cause bars, a table alternative, and a cause opens its students", async ({ page, context }) => {
    await open(page, "/reports");
    const data = await api(context, "attention");
    expect(data.causes.length, "the demo has causes").toBeGreaterThan(0);
    const card = page.getByRole("region", { name: "What is holding students back?" });
    await expect(card).toBeVisible();
    await expect(card.getByText(/^Start with the longest bar/)).toBeVisible();
    // table alternative
    await card.getByRole("button", { name: "Show as table" }).click();
    const alt = card.getByRole("table", { name: /What is holding students back/ });
    await expect(alt.locator("tbody tr")).toHaveCount(data.causes.length);
    await expect(alt).toContainText(data.causes[0].label);
    await card.getByRole("button", { name: "Show as chart" }).click();
    await expect(alt).toHaveCount(0);
    // a cause -> the list below has the same length
    const cause = data.causes[0];
    await card.getByRole("button", { name: `Show ${cause.label}: ${cause.count} students` }).click();
    await expect(page).toHaveURL(new RegExp(`cause=${cause.key}`));
    const list = page.getByRole("region", { name: "Students who need attention" });
    await expect(list.getByText(`${cause.count} rows`)).toBeVisible();
    await expect(list.getByRole("link", { name: "Download Excel" })).toHaveAttribute("href", new RegExp(`/api/reports/attention\\?.*cause=${cause.key}.*format=xlsx|/api/reports/attention\\?.*format=xlsx.*cause=${cause.key}`));
    await shot(page, "staff-attention-cause-1366.png");
  });

  test("Where students get stuck: the stage clock, zones in words, a count opens its students", async ({ page, context }) => {
    await open(page, "/reports?report=stages");
    const data = await api(context, "stages");
    await expect(page.getByRole("region", { name: "Where do students wait the longest?" })).toBeVisible();
    const table = page.getByRole("table", { name: "Stage clock" });
    const heads = (await table.getByRole("columnheader").allTextContents()).map((t) => t.trim());
    for (const head of ["Stage", "Students", "Median days", "Slowest 10% (days)", "On time", "Slow", "Stuck"]) expect(heads, head).toContain(head);
    await expect(table.locator("tbody tr")).toHaveCount(data.rows.length);
    await expect(main(page).getByText(`On time: under ${data.thresholds.warn} days`, { exact: false })).toBeVisible();
    const row = data.rows.find((r) => r.green > 0);
    await table.getByRole("button", { name: `Show ${row.green} students in ${row.stage} who are on time` }).click();
    const dialog = page.getByRole("dialog");
    expect(await countIn(dialog.getByText(/^\d+ rows?$/))).toBe(row.green);
    await page.keyboard.press("Escape");
    await shot(page, "staff-stages-1366.png");
  });

  test("Office speed and Records to fix list what the API lists", async ({ page, context }) => {
    await open(page, "/reports?report=speed");
    const cycles = await api(context, "cycle-times");
    await expect(page.getByRole("region", { name: "Which offices are slow to close requests?" })).toBeVisible();
    const table = page.getByRole("table", { name: "Office cycle times" });
    await expect(table.locator("tbody tr")).toHaveCount(cycles.rows.length);
    const withOpen = cycles.rows.find((r) => r.open_cases > 0);
    if (withOpen) {
      await table.getByRole("button", { name: `Show ${withOpen.open_cases} open requests in ${withOpen.process_area}` }).click();
      expect(await countIn(page.getByRole("dialog").getByText(/^\d+ rows?$/))).toBe(withOpen.open_cases);
      await page.keyboard.press("Escape");
    }
    await shot(page, "staff-speed-1366.png");

    await tab(page, "Records to fix").click();
    const fix = await api(context, "records-to-fix");
    const list = page.getByRole("region", { name: "Which research students have records missing?" });
    await expect(list).toBeVisible();
    await expect(list.getByText(`${fix.count} rows`)).toBeVisible();
    await expect(list.getByRole("link", { name: "Download Excel" })).toBeVisible();
    await shot(page, "staff-fix-1366.png");
  });

  test("an empty chart says why", async ({ page }) => {
    await open(page, "/reports?report=attention&cohort=99-00");
    await expect(main(page).getByText("No students need attention for these filters")).toBeVisible();
  });

  test("the old addresses still open the new page", async ({ page }) => {
    await page.goto("/reports?workflow_type=analytics");
    await expect(page.getByRole("heading", { level: 1, name: "Reports & Analytics" })).toBeVisible();
    await expect(tab(page, "Needs attention")).toHaveAttribute("aria-selected", "true");
  });

  for (const view of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
    test(`no sideways scroll at ${view.width}`, async ({ page }) => {
      await page.setViewportSize(view);
      for (const path of ["/reports", "/reports?report=stages", "/reports?report=speed", "/reports?report=fix"]) {
        await open(page, path);
        expect(await noOverflow(page), `${path} at ${view.width}`).toBe(true);
      }
      await open(page, "/reports?report=stages");
      await shot(page, `staff-stages-${view.width}.png`);
      await open(page, "/reports");
      await shot(page, `staff-attention-${view.width}.png`);
    });
  }
});

test.describe("coordinators", () => {
  test("the Academic Coordinator has the staff tabs", async ({ browser }) => {
    const context = await browser.newContext({ storageState: join(AUTH_DIR, "academic-coordinator.json"), viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    await open(page, "/reports");
    expect(await tabNames(page)).toEqual(STAFF_TABS);
    await context.close();
  });

  test("the Research Coordinator has Reports in the sidebar and three tabs", async ({ browser }) => {
    const context = await browser.newContext({ storageState: join(AUTH_DIR, "research-coordinator.json"), viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    attachWatchers(page, tracker);
    await page.goto("/");
    await expect(page.locator("aside nav").getByRole("link", { name: "Reports & Analytics" })).toHaveAttribute("href", "/reports");
    await open(page, "/reports");
    expect(await tabNames(page)).toEqual(RESEARCH_TABS);
    await expect(page.getByRole("region", { name: "What is holding students back?" })).toBeVisible();
    await shot(page, "research-attention-1366.png");
    await context.close();
  });
});

test.describe("Dean reports", () => {
  test.use({ storageState: join(AUTH_DIR, "dean.json"), viewport: { width: 1366, height: 768 } });

  test("the same frame: six numbers, the Dean tabs, and Decisions waiting equals the Dean home", async ({ page, context }) => {
    await page.goto("/dean");
    const home = page.locator('[data-slot="label"]', { hasText: /^Decisions waiting$/i }).locator("xpath=..").locator('[data-slot="value"]');
    await expect(home).toBeVisible();
    const homeWaiting = Number((await home.innerText()).trim());

    await open(page, "/dean/analytics");
    expect(await tabNames(page)).toEqual(DEAN_TABS);
    await expect(tab(page, "Waiting for my decision")).toHaveAttribute("aria-selected", "true");
    const waiting = main(page).locator('[data-slot="label"]', { hasText: /^Decisions waiting$/i }).locator("xpath=..").locator('[data-slot="value"]');
    await expect(waiting).toBeVisible();
    expect(Number((await waiting.innerText()).trim()), "the same decisions are counted on both pages (I-074)").toBe(homeWaiting);
    const decisions = await api(context, "decisions");
    expect(decisions.waiting.total).toBe(homeWaiting);
    await shot(page, "dean-waiting-1366.png");
  });

  test("Waiting for my decision: age bands per process, a count opens its cases, a table alternative", async ({ page, context }) => {
    await open(page, "/dean/analytics");
    const data = await api(context, "decisions");
    const card = page.getByRole("region", { name: "Which decisions have waited the longest?" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Show as table" }).click();
    const table = card.getByRole("table", { name: /Which decisions have waited the longest/ });
    for (const band of data.waiting.bands) await expect(table.getByRole("columnheader", { name: band }), band).toBeVisible();
    await expect(table.locator("tbody tr")).toHaveCount(data.waiting.rows.length);
    const row = data.waiting.rows.find((r) => r.total > 0);
    await table.getByRole("button", { name: `Show ${row.total} waiting in ${row.label}` }).click();
    expect(await countIn(page.getByRole("dialog").getByText(/^\d+ rows?$/))).toBe(row.total);
    await page.keyboard.press("Escape");
  });

  test("How fast and Outcomes: tables, a target line, and an empty period says why", async ({ page, context }) => {
    await open(page, "/dean/analytics?report=speed");
    const data = await api(context, "decisions");
    const fast = page.getByRole("region", { name: "How fast are decisions made?" });
    await expect(fast).toBeVisible();
    await expect(fast.getByText(/Target: decide within \d+ days/)).toBeVisible();
    await fast.getByRole("button", { name: "Show as table" }).click();
    const table = fast.getByRole("table", { name: /How fast are decisions made/ });
    await expect(table.locator("tbody tr")).toHaveCount(data.speed.rows.length);
    await shot(page, "dean-speed-1366.png");

    await tab(page, "Outcomes").click();
    const outcomes = page.getByRole("region", { name: "What was decided?" });
    await expect(outcomes).toBeVisible();
    await outcomes.getByRole("button", { name: "Show as table" }).click();
    await expect(outcomes.getByRole("table", { name: /What was decided/ }).locator("tbody tr")).toHaveCount(data.outcomes.rows.length);
    await shot(page, "dean-outcomes-1366.png");

    // The previous term had no decisions: the chart says so instead of drawing nothing.
    await field(page, "Period").selectOption("previous");
    await expect(outcomes.getByText("No decisions in this period")).toBeVisible();
    await tab(page, "How fast decisions are made").click();
    await expect(page.getByRole("region", { name: "How fast are decisions made?" }).getByText("No decisions in this period")).toBeVisible();
  });

  test("Graduation pipeline lists each step with its students", async ({ page }) => {
    await open(page, "/dean/analytics?report=graduation");
    const card = page.getByRole("region", { name: "How many graduation candidates are at each step?" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Show as table" }).click();
    await expect(card.getByRole("table", { name: /graduation candidates are at each step/ }).locator("tbody tr")).not.toHaveCount(0);
    await shot(page, "dean-graduation-1366.png");
  });

  for (const view of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
    test(`no sideways scroll at ${view.width}`, async ({ page }) => {
      await page.setViewportSize(view);
      for (const path of ["/dean/analytics", "/dean/analytics?report=speed", "/dean/analytics?report=outcomes", "/dean/analytics?report=graduation"]) {
        await open(page, path);
        expect(await noOverflow(page), `${path} at ${view.width}`).toBe(true);
      }
      await open(page, "/dean/analytics");
      await shot(page, `dean-waiting-${view.width}.png`);
    });
  }
});
