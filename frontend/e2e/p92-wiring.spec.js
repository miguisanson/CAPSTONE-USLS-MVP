// Packet "wire" (I-071, I-072, I-066 / F-12): wires the pages to the backend that stopped writing on GET and on login.
// Written BEFORE the change and red on the old pages. Through the real UI:
//   - the notification bell asks the server to make the due reminders (POST /api/notifications/refresh) on mount, and
//     only then reads the list (GET /api/notifications); one refresh per page load, never two;
//   - the Graduate School home has a "Refresh data" button (staff and administrator only) that runs the date-driven
//     sweeps (POST /api/maintenance/refresh), says what came back, and reloads the home;
//   - the Academic Coordinator and the Research Coordinator get the same action-first home as every other role:
//     "Dashboard" first in their sidebar, Login sends them to it, "Needs your action", key numbers from their own
//     caseload, recent activity - with no 403 and no call to the staff-only drill-down; Reports' "Back to dashboard"
//     leads to it.
// Specs share one database (e2e/README.md): every expected value is read from the API at test time, and the one
// call that writes (the sweeps) is idempotent.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, ARTIFACTS_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";
import { PASSWORD, ROLES, emailOf } from "./support/accounts.js";

const SHOTS = process.env.WIRE_SHOTS || join(ARTIFACTS_DIR, "p92");

let tracker;
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ page, context }) => {
  tracker = { problems: [], writes: [], where: { role: "?", page: "p92 wiring", viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
});

const main = (page) => page.locator("main");
const sectionOf = (page, name) => main(page).locator("section", { has: page.getByRole("heading", { name, exact: true }) });
const stat = (page, label) =>
  main(page)
    .locator('[data-slot="label"]', { hasText: new RegExp(`^${label}$`, "i") })
    .locator("xpath=ancestor::div[contains(@class,'card')][1]");
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
async function shot(page, name) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
}
const entryOf = (key) => ROLES.find((r) => r.key === key);
// A mocked failure makes the browser log "Failed to load resource" itself: that is the mock, not a finding.
const forgetMockedFailure = () => {
  tracker.problems = tracker.problems.filter((p) => !/API 500|Failed to load resource/.test(p.problem));
};

// ------------------------------------------------------------------------------------------------ bell
test.describe("notification bell asks for the due reminders first", () => {
  for (const key of ["staff", "student", "academic-coordinator"]) {
    test.describe(key, () => {
      test.use({ storageState: join(AUTH_DIR, `${key}.json`), viewport: { width: 1366, height: 768 } });

      test("one POST /api/notifications/refresh on load, sent before the GET of the list", async ({ page }) => {
        tracker.where = { role: key, page: "p92 bell", viewport: 1366 };
        const calls = [];
        page.on("request", (request) => {
          const path = new URL(request.url()).pathname;
          if (path === "/api/notifications" || path === "/api/notifications/refresh") calls.push(`${request.method()} ${path}`);
        });
        await page.goto(entryOf(key).home);
        await expect(page.locator("main h1")).toBeVisible();
        await page.waitForLoadState("networkidle");
        await expect(page.getByRole("button", { name: /^Notifications/ })).toBeVisible();
        const posts = calls.filter((call) => call === "POST /api/notifications/refresh");
        const firstGet = calls.indexOf("GET /api/notifications");
        expect(posts.length, `refresh POSTs on one page load (${calls.join(", ")})`).toBe(1);
        expect(firstGet, `the list is read (${calls.join(", ")})`).toBeGreaterThanOrEqual(0);
        expect(calls.indexOf("POST /api/notifications/refresh"), "the refresh comes before the list").toBeLessThan(firstGet);
      });
    });
  }

  test.describe("a refresh that fails", () => {
    test.use({ storageState: join(AUTH_DIR, "staff.json"), viewport: { width: 1366, height: 768 } });

    test("stays silent: the list still loads and no error shows", async ({ page }) => {
      tracker.where = { role: "staff", page: "p92 bell refresh fails", viewport: 1366 };
      await page.route("**/api/notifications/refresh", (route) => route.fulfill({ status: 500, json: { error: "boom" } }));
      const loaded = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/notifications" && r.request().method() === "GET");
      await page.goto("/");
      await loaded;
      await expect(page.locator("main h1")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: /^Notifications/ }).click();
      const region = page.getByRole("region", { name: "Notifications" });
      await expect(region).toBeVisible();
      await expect(region.getByText("boom")).toHaveCount(0);
      forgetMockedFailure();
    });
  });
});

// ------------------------------------------------------------------------------------------------ refresh data
test.describe("Graduate School home: Refresh data", () => {
  for (const key of ["staff", "admin"]) {
    test.describe(key, () => {
      test.use({ storageState: join(AUTH_DIR, `${key}.json`), viewport: { width: 1366, height: 768 } });

      test("the button runs the sweeps, shows the result and reloads the home", async ({ page }) => {
        tracker.where = { role: key, page: "p92 refresh data", viewport: 1366 };
        await page.goto("/");
        await expect(page.locator("main h1")).toBeVisible();
        await page.waitForLoadState("networkidle");
        const button = page.getByRole("button", { name: "Refresh data" });
        await expect(button).toBeVisible();
        const sweep = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/maintenance/refresh" && r.request().method() === "POST");
        const reload = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/dashboard" && r.request().method() === "GET");
        await button.click();
        const response = await sweep;
        expect(response.status()).toBe(200);
        const body = await response.json();
        await reload; // the home is read again after the sweeps
        await expect(main(page).getByRole("status").filter({ hasText: body.message })).toBeVisible();
        await expect(button).toBeEnabled();
        await shot(page, `${key}-refresh-1366.png`);
      });
    });
  }

  test.describe("staff, when the sweeps fail", () => {
    test.use({ storageState: join(AUTH_DIR, "staff.json"), viewport: { width: 1366, height: 768 } });

    test("says so in words and leaves the home as it was", async ({ page }) => {
      tracker.where = { role: "staff", page: "p92 refresh data fails", viewport: 1366 };
      await page.route("**/api/maintenance/refresh", (route) => route.fulfill({ status: 500, json: { error: "The sweeps could not run." } }));
      await page.goto("/");
      await expect(page.locator("main h1")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "Refresh data" }).click();
      await expect(main(page).getByText("The sweeps could not run.")).toBeVisible();
      await expect(sectionOf(page, "Needs your action")).toBeVisible();
      forgetMockedFailure();
    });
  });

  for (const key of ["academic-coordinator", "research-coordinator"]) {
    test.describe(key, () => {
      test.use({ storageState: join(AUTH_DIR, `${key}.json`), viewport: { width: 1366, height: 768 } });

      test("has no Refresh data button (the sweeps are the Graduate School's)", async ({ page }) => {
        tracker.where = { role: key, page: "p92 no refresh data", viewport: 1366 };
        await page.goto("/");
        await expect(page.locator("main h1")).toBeVisible();
        await page.waitForLoadState("networkidle");
        await expect(page.getByRole("button", { name: "Refresh data" })).toHaveCount(0);
      });
    });
  }
});

// ------------------------------------------------------------------------------------------------ coordinator homes
for (const key of ["academic-coordinator", "research-coordinator"]) {
  test.describe(`${key} home`, () => {
    const entry = entryOf(key);
    const office = key === "academic-coordinator" ? "Academic Coordinator" : "Research Coordinator";

    test.describe("after sign-in", () => {
      test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1366, height: 768 } });

      test("Login sends the account to the Dashboard", async ({ page }) => {
        tracker.where = { role: key, page: "p92 sign-in", viewport: 1366 };
        await page.goto("/login");
        await page.locator('input[name="email"]').fill(emailOf(entry));
        await page.locator('input[name="password"]').fill(PASSWORD);
        await page.getByRole("button", { name: /^\s*Sign in\s*$/ }).click();
        await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
        expect(new URL(page.url()).pathname, "where Login sends this role").toBe("/");
        await expect(sectionOf(page, "Needs your action")).toBeVisible();
      });
    });

    test.describe("the home", () => {
      test.use({ storageState: join(AUTH_DIR, `${key}.json`), viewport: { width: 1366, height: 768 } });

      test("Dashboard is first in the sidebar; action-first home with key numbers and recent activity, no 403", async ({ page, context }) => {
        tracker.where = { role: key, page: "p92 coordinator home", viewport: 1366 };
        const drilldown = [];
        page.on("request", (request) => new URL(request.url()).pathname.startsWith("/api/dashboard/drilldown") && drilldown.push(request.url()));
        const own = await (await context.request.get(`/api/tasks?owner=${encodeURIComponent(office)}&page_size=200`)).json();
        const payload = await (await context.request.get("/api/dashboard")).json();
        expect(payload.viewer?.role, "the dashboard answers a coordinator with their own viewer").toBe(entry.role);

        await page.goto("/");
        await expect(page.locator("main h1")).toBeVisible();
        await page.waitForLoadState("networkidle");

        const first = page.locator("aside:visible nav a").first();
        await expect(first).toHaveText("Dashboard");
        await expect(first).toHaveAttribute("href", "/");
        await expect(first).toHaveAttribute("aria-current", "page");
        await expect(main(page).locator("h2").first()).toHaveText("Needs your action");
        await expect(page.locator("main h1")).toHaveText(/^Welcome, (?!Dr\.?$)\S+/);
        if (own.items.length) await expect(sectionOf(page, "Needs your action").locator("li").first()).toBeVisible();

        // 3-4 key numbers from the coordinator payload, each named once
        const labels = await main(page).locator('[data-slot="label"]').allTextContents();
        expect(labels.length, `key numbers: ${labels.join(", ")}`).toBeGreaterThanOrEqual(3);
        expect(labels.length).toBeLessThanOrEqual(4);
        expect(new Set(labels).size, "each number named once").toBe(labels.length);
        await expect(stat(page, "Students with open work").locator('[data-slot="value"]')).toHaveText(String(payload.kpis.total_students));
        await expect(stat(page, "Your open tasks").locator('[data-slot="value"]')).toHaveText(String(own.total));

        await expect(page.getByRole("heading", { name: "Recent activity", exact: true })).toBeVisible();

        // every link on the home opens a page this role can open; none is the staff-only drill-down or activity log
        const sidebar = await page.locator("aside nav a").evaluateAll((els) => els.map((a) => new URL(a.href).pathname));
        const links = await main(page).locator("a").evaluateAll((els) => els.map((a) => new URL(a.href).pathname));
        for (const path of links) {
          const ok = sidebar.includes(path) || (path.startsWith("/students/") && key === "academic-coordinator");
          expect(ok, `${path} is reachable from this role's own sidebar (${sidebar.join(", ")})`).toBe(true);
        }
        expect(links, "the activity log is staff-only").not.toContain("/activity");
        expect(drilldown, "the drill-down is staff-only").toEqual([]);
        expect(await noOverflow(page)).toBeLessThanOrEqual(1);
        await shot(page, `${key}-home-1366.png`);
      });

      test("390: no sideways scroll", async ({ page }) => {
        tracker.where = { role: key, page: "p92 coordinator home 390", viewport: 390 };
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/");
        await expect(page.locator("main h1")).toBeVisible();
        await page.waitForLoadState("networkidle");
        expect(await noOverflow(page)).toBeLessThanOrEqual(1);
        await shot(page, `${key}-home-390.png`);
      });
    });
  });
}

test.describe("academic coordinator: Reports", () => {
  test.use({ storageState: join(AUTH_DIR, "academic-coordinator.json"), viewport: { width: 1366, height: 768 } });

  test("'Back to dashboard' leads to the coordinator's own home", async ({ page }) => {
    tracker.where = { role: "academic-coordinator", page: "p92 reports back link", viewport: 1366 };
    await page.goto("/reports");
    await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Back to dashboard" }).click();
    await page.waitForURL((url) => url.pathname === "/");
    await expect(sectionOf(page, "Needs your action")).toBeVisible();
    await expect(page.locator("aside:visible nav a").first()).toHaveAttribute("aria-current", "page");
  });
});
