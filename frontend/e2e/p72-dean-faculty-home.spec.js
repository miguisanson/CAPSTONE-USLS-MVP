// Packet P7.2 (owner decisions IM19 + AD7): pins the Dean home and the faculty home on the shared RoleHome layout.
// Written BEFORE the change and red on the old homes. Through the real UI:
//   - Dean: the first section is "Needs your action" and lists the decisions waiting on the Dean, oldest first, each
//     with a link that opens its case (a leave request is put in front of the Dean first, through each role's own
//     API login, like p31-dean.spec.js); four key numbers, each named once (no wall of per-process tiles - the
//     per-process breakdown is the Approvals Queue); "Recent decisions" links to the Activity Log; the "Open approvals
//     queue" button stays; with nothing waiting the section says so; nothing overflows at 390;
//   - Faculty (the seeded adviser the sweep uses): the first section is "Needs your action" and holds only what this
//     member must do, every row with a working link; four key numbers read from the portal context, each named once;
//     "Upcoming defenses" has its View schedule link; the calendar-connected notice stays; the Google Calendar card
//     moved to My Availability and the home only has a small link to it (I-085); nothing overflows at 390.
// Setup changes data in the throwaway harness database and touches only the demo student Martin Gonzales
// (enrollment-martin), whom no other spec uses.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR, BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

// E2E_SHOTS_TAG lets a before/after comparison write to two folders; the default is "p72".
const SHOTS = join(SCREENS_DIR, "..", process.env.E2E_SHOTS_TAG || "p72");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);

let tracker;
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ page, context }) => {
  tracker = { problems: [], writes: [], where: { role: "?", page: "P7.2 home", viewport: 1366 } };
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
const labels = async (page) => (await main(page).locator('[data-slot="label"]').allTextContents()).map((t) => t.trim().toLowerCase()).sort();
const statValue = (page, name) =>
  main(page).locator('[data-slot="label"]', { hasText: new RegExp(`^${name}$`, "i") }).locator("xpath=..").locator('[data-slot="value"]');
async function shot(page, name) {
  await page.mouse.move(0, 0); // park the mouse so no hover colour is in the picture
  await page.waitForTimeout(600); // the page's own fade-in
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
}

/** The phone-width picture, taken first (so a before/after run has it even when the structure checks fail), then back to 1366. */
async function shotAt390(page, name) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await shot(page, name);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(300);
}

async function apiAs(playwright, email) {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  const res = await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.ok(), `API sign-in as ${email}`).toBeTruthy();
  return ctx;
}
async function okJson(res, what) {
  const body = await res.json().catch(() => ({}));
  expect(res.ok(), `${what}: ${res.status()} ${JSON.stringify(body)}`).toBeTruthy();
  return body;
}

const TERM = "AY 2026-2027 2nd Semester";

/** Martin Gonzales files a Leave of Absence and staff forward it, so it waits on the Dean. */
async function leaveToDean(playwright) {
  const student = await apiAs(playwright, "enrollment.martin@usls.edu.ph");
  const me = await okJson(await student.get("/api/auth/me"), "me");
  const filed = await student.post("/api/student-portal/requests/leave-of-absence", {
    data: { effective_start: TERM, effective_end: TERM, reason_category: "Medical / health", reason_remarks: "Surgery and recovery." },
  });
  const staff = await apiAs(playwright, "staff@usls.edu.ph");
  if (filed.ok()) {
    const caseId = (await filed.json()).case_id;
    await okJson(await staff.post(`/api/leave-cases/${caseId}/transition`, { data: { action: "forward", eligibility_result: "Eligible" } }), "staff forward the leave");
  } else {
    // a re-run on the same database: the request is already in front of the Dean
    expect(filed.status(), `Martin files a leave: ${await filed.text()}`).toBe(409);
  }
  await Promise.all([student.dispose(), staff.dispose()]);
  return { studentId: me.user.student_id };
}

const dateOf = (item) => new Date(item.submitted_at || item.last_activity_at || item.record?.updated_at || 0).getTime();

test.describe("Dean home", () => {
  test.describe.configure({ mode: "serial" }); // one setup (a second one in another worker would file a second request)
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 768 } });
  let setup;
  test.beforeAll(async ({ playwright }) => {
    setup = await leaveToDean(playwright);
  });

  /** Open the home and hand back what the page itself loaded (so the checks cannot race another spec's data). */
  async function openHome(page) {
    tracker.where = { role: "dean", page: "P7.2 dean home", viewport: 1366 };
    const approvals = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/approvals");
    const advisers = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/adviser-appointments");
    await page.goto("/dean");
    await expect(page.locator("main h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    return { approvals: await (await approvals).json(), advisers: await (await advisers).json().catch(() => ({ appointments: [] })) };
  }
  /** The decisions the home must count: the same filters the Dean pages use. */
  const waitingOf = ({ approvals, advisers }) => {
    const cases = approvals.workflow_pending.filter((item) => item.type !== "graduation" || item.eligibility?.eligible === true);
    const designations = (advisers.appointments || []).filter((row) => (row.actions || []).includes("appoint")).length;
    return { cases, plans: approvals.pending, designations, total: cases.length + approvals.pending.length + designations };
  };

  test("'Needs your action' is first and lists the waiting decisions, oldest first, each with a working link", async ({ page }) => {
    const loaded = await openHome(page);
    await shot(page, "dean-home-1366.png");
    const waiting = waitingOf(loaded);
    expect(waiting.cases.length, "Martin's leave waits on the Dean").toBeGreaterThan(0);

    await expect(main(page).locator("h2").first(), "the first section of the page").toHaveText("Needs your action");
    const mine = sectionOf(page, "Needs your action");
    const rows = mine.locator("li");
    expect(await rows.count(), "a short list: at most eight rows").toBeLessThanOrEqual(8);

    const dated = [
      ...waiting.cases.map((item) => ({ title: item.title, at: dateOf(item), to: `/dean/case/${item.type}/${item.id}` })),
      ...waiting.plans.map((plan) => ({ title: `Course offerings · ${plan.program_code}`, at: dateOf(plan), to: "/dean/approvals/course-adjustments" })),
    ].sort((a, b) => a.at - b.at);
    await expect(rows.first(), "the oldest decision is first").toContainText(dated[0].title);
    const firstLink = rows.first().locator("a").first();
    await expect(firstLink).toHaveAttribute("href", dated[0].to);

    // Martin's request is in the list (or, when more than eight wait, behind View all) and opens his case
    const martin = waiting.cases.find((item) => item.student?.id === setup.studentId);
    expect(martin, "Martin's request is among the waiting cases").toBeTruthy();
    if (dated.findIndex((d) => d.title === martin.title) < 8) {
      const row = rows.filter({ hasText: martin.title });
      await expect(row).toHaveCount(1);
      await expect(row.locator("a")).toHaveAttribute("href", `/dean/case/leave-of-absence/${martin.id}`);
      await row.locator("a").click();
    } else {
      await expect(mine.getByRole("link", { name: /View all/ })).toHaveAttribute("href", "/dean/approvals");
      await firstLink.click();
    }
    await expect(page).toHaveURL(/\/dean\/(case\/|approvals\/course-adjustments)/);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.getByText("This page is not available yet")).toHaveCount(0);
  });

  test("four key numbers, each named once; no wall of per-process tiles; the queue and the Activity Log stay one click away", async ({ page }) => {
    const loaded = await openHome(page);
    await expect(main(page).locator("h2").first()).toHaveText("Needs your action");
    const waiting = waitingOf(loaded);

    expect(await labels(page), "the key-number labels").toEqual(["decided this week", "decisions waiting", "oldest wait", "waiting over 7 days"]);
    await expect(statValue(page, "Decisions waiting")).toHaveText(String(waiting.total));
    const over = [...waiting.cases, ...waiting.plans].filter((item) => Date.now() - dateOf(item) > 7 * 86400000).length;
    await expect(statValue(page, "Waiting over 7 days")).toHaveText(String(over));
    await expect(statValue(page, "Oldest wait")).toHaveText(/^(Today|\d+ days?)$/);
    await expect(statValue(page, "Decided this week")).toHaveText(/^\d+$/);
    // the per-process tiles ("... waiting for your decision") are gone; the breakdown is the Approvals Queue
    await expect(main(page).locator('[data-slot="sub"]', { hasText: "waiting for your decision" })).toHaveCount(0);
    for (const gone of ["Recently decided", "How long items have waited", "Waiting longest"]) {
      await expect(main(page).getByText(gone, { exact: true }), `no "${gone}" block`).toHaveCount(0);
    }
    await expect(main(page).getByRole("link", { name: /Open approvals queue/ })).toHaveAttribute("href", "/dean/approvals");
    await expect(main(page).getByRole("link", { name: /Decisions waiting/ })).toHaveAttribute("href", "/dean/approvals");
    await expect(main(page).getByRole("link", { name: /Decided this week/ })).toHaveAttribute("href", "/dean/activity");

    const recent = sectionOf(page, "Recent decisions");
    await expect(recent.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/dean/activity");
    expect(await recent.locator("li").count(), "a short list").toBeLessThanOrEqual(6);
  });

  test("with nothing waiting the section says so, and the numbers read zero", async ({ page }) => {
    tracker.where = { role: "dean", page: "P7.2 dean home, empty", viewport: 1366 };
    await page.route("**/api/approvals", (route) =>
      route.fulfill({ json: { pending: [], recent: [], workflow_pending: [], workflow_recent: [], workflow_overview: [] } }),
    );
    await page.route("**/api/adviser-appointments*", (route) => route.fulfill({ json: { appointments: [] } }));
    await page.goto("/dean");
    await expect(page.locator("main h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(main(page).locator("h2").first()).toHaveText("Needs your action");
    const mine = sectionOf(page, "Needs your action");
    await expect(mine.locator("li")).toHaveCount(0);
    await expect(mine.getByText("Nothing is waiting for your decision")).toBeVisible();
    await expect(statValue(page, "Decisions waiting")).toHaveText("0");
    await expect(statValue(page, "Oldest wait")).toHaveText("None");
    await expect(statValue(page, "Waiting over 7 days")).toHaveText("0");
    await shot(page, "dean-home-empty-1366.png");
  });

  test("layout: the decisions take the wide column at 1366; one column and no sideways scroll at 390", async ({ page }) => {
    await openHome(page);
    await shotAt390(page, "dean-home-390.png");
    await expect(main(page).locator("h2").first()).toHaveText("Needs your action");
    const actions = sectionOf(page, "Needs your action");
    const recent = sectionOf(page, "Recent decisions");
    const a = await actions.boundingBox();
    const r = await recent.boundingBox();
    expect(a.width, "decisions are wider than the recent-decisions column").toBeGreaterThan(r.width);
    expect(r.x, "recent decisions beside the list at 1366").toBeGreaterThan(a.x + a.width - 2);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const a2 = await actions.boundingBox();
    const r2 = await recent.boundingBox();
    expect(Math.abs(a2.x - r2.x), "one column at 390").toBeLessThan(2);
    expect(r2.y, "recent decisions under the list at 390").toBeGreaterThan(a2.y + a2.height - 2);
    expect(await noOverflow(page), "horizontal overflow at 390").toBeLessThanOrEqual(1);
  });
});

test.describe("Faculty home", () => {
  test.use({ storageState: authFile("faculty"), viewport: { width: 1366, height: 768 } });

  async function openHome(page, query = "") {
    tracker.where = { role: "faculty", page: "P7.2 faculty home", viewport: 1366 };
    const context = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/faculty-portal/context");
    await page.goto(`/faculty-portal${query}`);
    await expect(page.locator("main h1")).toContainText("Welcome,");
    await page.waitForLoadState("networkidle");
    return (await context).json();
  }
  /** What this member must do, counted from the context the page loaded (units of work, as the key number counts them). */
  const unitsOf = (data) =>
    (data.advisees || []).reduce((sum, row) => sum + (row.pending_count || 0), 0) +
    (data.panels || []).filter((p) => p.can_submit_verdict).length +
    (data.panels || []).filter((p) => p.can_confirm_revisions).length +
    (data.counts?.pending_invitations || 0) +
    (data.counts?.pending_adviser_requests || 0) +
    (data.faculty?.availability_entered === false ? 1 : 0);

  test("'Needs your action' is first and holds what the member must do, every row with a working link", async ({ page }) => {
    const data = await openHome(page);
    await shot(page, "faculty-home-1366.png");
    await expect(main(page).locator("h2").first(), "the first section of the page").toHaveText("Needs your action");
    const mine = sectionOf(page, "Needs your action");
    const rows = mine.locator("li");
    const units = unitsOf(data);
    if (units === 0) {
      await expect(rows).toHaveCount(0);
      await expect(mine.getByText("Nothing is waiting on you")).toBeVisible();
      return;
    }
    expect(await rows.count()).toBeGreaterThan(0);
    expect(await rows.count(), "a short list: at most eight rows").toBeLessThanOrEqual(8);
    const links = mine.locator("li a");
    expect(await links.count(), "every row has a link").toBe(await rows.count());
    if (data.counts.pending_invitations > 0) {
      const row = rows.filter({ hasText: /panel invitation/i });
      await expect(row).toHaveCount(1);
      await expect(row.locator("a")).toHaveAttribute("href", "/faculty-portal/invitations");
    }
    if (data.counts.pending_adviser_requests > 0) {
      await expect(rows.filter({ hasText: /adviser request/i }).locator("a")).toHaveAttribute("href", "/faculty-portal/advisees");
    }
    const verdicts = data.panels.filter((p) => p.can_submit_verdict);
    for (const p of verdicts) await expect(rows.filter({ hasText: `Record the verdict for ${p.student.name}` }).locator("a")).toHaveAttribute("href", "/faculty-portal/verdicts");
    const signing = data.advisees.filter((a) => a.pending_count > 0);
    for (const a of signing.slice(0, 3)) await expect(rows.filter({ hasText: a.student.name }).locator("a")).toHaveAttribute("href", "/faculty-portal/signatures");
    // the first row's link opens a real page
    const href = await links.first().getAttribute("href");
    expect(href).toMatch(/^\/faculty-portal\//);
    await links.first().click();
    await expect(page).toHaveURL(new RegExp(href.replace(/\//g, "\\/")));
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.getByText("This page is not available yet")).toHaveCount(0);
  });

  test("four key numbers read from the context, each named once; the old tiles are gone", async ({ page }) => {
    const data = await openHome(page);
    await expect(main(page).locator("h2").first()).toHaveText("Needs your action");
    expect(await labels(page), "the key-number labels").toEqual(["advisees", "panel committees", "upcoming defenses", "your open items"]);
    await expect(statValue(page, "Your open items")).toHaveText(String(unitsOf(data)));
    await expect(statValue(page, "Advisees")).toHaveText(String(data.advisees.length));
    await expect(statValue(page, "Panel committees")).toHaveText(String(data.panels.length));
    await expect(statValue(page, "Upcoming defenses")).toHaveText(String(data.upcoming_defenses.length));
    for (const gone of ["Signatures needed", "Panel assignments", "Verdicts due", "Availability windows"]) {
      await expect(main(page).locator('[data-slot="label"]', { hasText: new RegExp(`^${gone}$`, "i") }), `no "${gone}" tile`).toHaveCount(0);
    }
    await expect(main(page).getByText("What needs your action")).toHaveCount(0);
    await expect(main(page).getByRole("link", { name: /Advisees/ }).first()).toHaveAttribute("href", "/faculty-portal/advisees");
  });

  test("upcoming defenses keep their list and View schedule link; the Google Calendar card is not on the home (only a small link) and the callback notice stays", async ({ page }) => {
    const data = await openHome(page);
    const upcoming = sectionOf(page, "Upcoming defenses");
    await expect(upcoming.getByRole("link", { name: "View schedule" })).toHaveAttribute("href", "/faculty-portal/defenses");
    expect(await upcoming.locator("li").count(), "a short list").toBeLessThanOrEqual(6);
    if (data.upcoming_defenses.length) await expect(upcoming.locator("li").first()).toContainText(data.upcoming_defenses[0].student.name);
    else await expect(upcoming.getByText("No defenses scheduled")).toBeVisible();
    await expect(page.getByRole("region", { name: "Google Calendar connection" })).toHaveCount(0);
    await expect(main(page).getByRole("link", { name: "Calendar connection" })).toHaveAttribute("href", "/faculty-portal/availability");
    // the OAuth callback lands here with ?calendar=connected
    await openHome(page, "?calendar=connected");
    await expect(page.getByRole("status").filter({ hasText: "Google Calendar connected." })).toBeVisible();
  });

  test("layout: the actions take the wide column at 1366; one column and no sideways scroll at 390", async ({ page }) => {
    await openHome(page);
    await shotAt390(page, "faculty-home-390.png");
    await expect(main(page).locator("h2").first()).toHaveText("Needs your action");
    const actions = sectionOf(page, "Needs your action");
    const upcoming = sectionOf(page, "Upcoming defenses");
    const a = await actions.boundingBox();
    const r = await upcoming.boundingBox();
    expect(a.width, "actions are wider than the side column").toBeGreaterThan(r.width);
    expect(r.x, "upcoming defenses beside the actions at 1366").toBeGreaterThan(a.x + a.width - 2);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const a2 = await actions.boundingBox();
    const r2 = await upcoming.boundingBox();
    expect(Math.abs(a2.x - r2.x), "one column at 390").toBeLessThan(2);
    expect(r2.y, "upcoming defenses under the actions at 390").toBeGreaterThan(a2.y + a2.height - 2);
    expect(await noOverflow(page), "horizontal overflow at 390").toBeLessThanOrEqual(1);
  });
});
