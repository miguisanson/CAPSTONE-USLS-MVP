// Behaviour pin for packet P2.1 (Phase 5 migration of the app shell: components/Layout.jsx, RoleSidebar.jsx,
// NotificationBell.jsx, ExportFollowUpModal.jsx, FacultyAssignmentProfile.jsx). Written BEFORE the migration. It reaches
// everything through the real UI and pins what must not change: which sidebar links each role sees (recorded from the old
// code below), how the mobile menu opens and closes, that the sidebar is always there at 1366, what the bell shows.
// It changes no data (the bell items are not clicked: opening one marks it read). Sign out is tested on a fresh login so
// the shared saved sessions stay valid.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { ARTIFACTS_DIR, AUTH_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";
import { PASSWORD, ROLES, emailOf } from "./support/accounts.js";

// "<href> | <label>" for every sidebar link a role sees at 1366 (a trailing count badge is cut off). Recorded from the
// OLD code on 2026-10-17; the migration must leave each list exactly as it is (the role permission list is issue I-036).
const EXPECTED_LINKS = {
  student: [
    "/student | Dashboard",
    "/student/activity | Activity Log",
    "/student/adviser | Research Adviser",
    "/student/assistant | Policy Assistant",
    "/student/calendar | Research Calendar",
    "/student/defense-schedule | Defense Schedule",
    "/student/documents | Documents",
    "/student/enrollment | Enrollment",
    "/student/graduation | Graduation Endorsement",
    "/student/messages | Messages",
    "/student/profile | My Profile",
    "/student/progress | My Progress",
    "/student/requests | Request Center",
    "/student/requests/awol-return | Return from AWOL",
    "/student/requests/leave-of-absence | Leave of Absence",
    "/student/requests/readmission | Readmission",
    "/student/requests/withdrawal | Subject Withdrawal",
    "/student/research | Research Progress",
  ],
  faculty: [
    "/faculty-portal | Dashboard",
    "/faculty-portal/advisees | My Advisees",
    "/faculty-portal/assistant | Policy Assistant",
    "/faculty-portal/availability | My Availability",
    "/faculty-portal/business-rules | Business Rules",
    "/faculty-portal/calendar | My Calendar",
    "/faculty-portal/classes | Assigned Classes",
    "/faculty-portal/defenses | Defense Schedule",
    "/faculty-portal/invitations | Panel Invitations",
    "/faculty-portal/panels | Panel Assignments & Papers",
    "/faculty-portal/signatures | Signatures & Endorsements",
    "/faculty-portal/verdicts | Verdicts",
  ],
  dean: [
    "/dean | Dashboard",
    "/dean/activity | Activity Log",
    "/dean/analytics | Reports & Analytics",
    "/dean/approvals | Approvals Queue",
    "/dean/approvals/awol | AWOL & Residency",
    "/dean/approvals/course-adjustments | Course Adjustments",
    "/dean/approvals/graduation | Graduation Endorsement",
    "/dean/approvals/leave-of-absence | Leave of Absence",
    "/dean/approvals/practicum | Practicum Reports",
    "/dean/approvals/readmission | Readmission",
    "/dean/approvals/withdrawal | Subject Withdrawal",
    "/dean/assistant | Policy Assistant",
    "/dean/business-rules | Business Rules",
    "/dean/gate-reports | Admission & Coursework Reports",
  ],
  staff: [
    "/ | Dashboard",
    "/activity | Activity Log",
    "/assistant | Policy Assistant",
    "/business-rules | Business Rules",
    "/course-adjustments | 2 · Course Adjustments",
    "/enrollment | 3 · Enrollment",
    "/workflow/course-audit | Course Audit",
    "/enrollment-class-list | Enrollment Class List",
    "/faculty | Faculty",
    "/monitoring-sheet | Monitoring Sheet",
    "/policy-documents | Policy Documents",
    "/reports | Reports & Analytics",
    "/students | Students",
    "/term-settings | Academic Semesters",
    "/work-queue | Work Queue",
    "/workflow/awol | AWOL & Residency",
    "/workflow/defense-scheduling | 6 · Defense Scheduling",
    "/workflow/graduation | 8 · Graduation Endorsement",
    "/workflow/leave-of-absence | Leave of Absence",
    "/workflow/panel-matching | 5 · Panel Matching",
    "/workflow/practicum | 7 · Practicum",
    "/workflow/readmission | Readmission",
    "/workflow/research-gate | 4 · Research Gate",
    "/workflow/student-handoff | 1 · Student Handoff",
    "/workflow/withdrawal | Subject Withdrawal",
  ],
  "academic-coordinator": [
    "/assistant | Policy Assistant",
    "/business-rules | Business Rules",
    "/course-adjustments | 2 · Course Adjustments",
    "/enrollment | 3 · Enrollment",
    "/workflow/course-audit | Course Audit",
    "/enrollment-class-list | Enrollment Class List",
    "/faculty | Faculty",
    "/monitoring-sheet | Monitoring Sheet",
    "/reports | Reports & Analytics",
    "/students | Students",
    "/work-queue | Work Queue",
    "/workflow/awol | AWOL & Residency",
    "/workflow/graduation | 8 · Graduation Endorsement",
    "/workflow/panel-matching | 5 · Panel Matching",
    "/workflow/practicum | 7 · Practicum",
    "/workflow/research-gate | 4 · Research Gate",
  ],
  "research-coordinator": [
    "/assistant | Policy Assistant",
    "/business-rules | Business Rules",
    "/monitoring-sheet | Monitoring Sheet",
    "/work-queue | Work Queue",
    "/workflow/defense-scheduling | 6 · Defense Scheduling",
    "/workflow/graduation | 8 · Graduation Endorsement",
    "/workflow/panel-matching | 5 · Panel Matching",
    "/workflow/research-gate | 4 · Research Gate",
  ],
  admin: [
    "/ | Dashboard",
    "/activity | Activity Log",
    "/assistant | Policy Assistant",
    "/business-rules | Business Rules",
    "/course-adjustments | 2 · Course Adjustments",
    "/enrollment | 3 · Enrollment",
    "/workflow/course-audit | Course Audit",
    "/enrollment-class-list | Enrollment Class List",
    "/faculty | Faculty",
    "/monitoring-sheet | Monitoring Sheet",
    "/policy-documents | Policy Documents",
    "/reports | Reports & Analytics",
    "/students | Students",
    "/term-settings | Academic Semesters",
    "/work-queue | Work Queue",
    "/workflow/awol | AWOL & Residency",
    "/workflow/defense-scheduling | 6 · Defense Scheduling",
    "/workflow/graduation | 8 · Graduation Endorsement",
    "/workflow/leave-of-absence | Leave of Absence",
    "/workflow/panel-matching | 5 · Panel Matching",
    "/workflow/practicum | 7 · Practicum",
    "/workflow/readmission | Readmission",
    "/workflow/research-gate | 4 · Research Gate",
    "/workflow/student-handoff | 1 · Student Handoff",
    "/workflow/withdrawal | Subject Withdrawal",
  ],
};

// Screenshots of the shell states the sweep does not reach (menu open, bell open): e2e-artifacts/p21/.
const SHOTS = join(ARTIFACTS_DIR, "p21");
async function shot(page, name) {
  mkdirSync(SHOTS, { recursive: true });
  await page.mouse.move(0, 0); // park the mouse so no hover colour is captured
  await page.waitForTimeout(500); // let the 250 ms fade-up of the panel finish
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

let tracker;
async function watch(page, context, role) {
  tracker = { problems: [], writes: [], where: { role, page: "P2.1 shell", viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
}
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
});

/** Every visible sidebar link as "href | label" (the count badge, if any, is removed). */
async function sidebarLinks(page) {
  return page.locator("aside:visible nav a").evaluateAll((nodes) =>
    nodes.map((a) => {
      const copy = a.cloneNode(true);
      copy.querySelectorAll("[aria-label$='waiting']").forEach((el) => el.remove());
      return `${a.getAttribute("href")} | ${copy.textContent.replace(/\s+/g, " ").trim()}`;
    }),
  );
}

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
}

for (const entry of ROLES) {
  test.describe(`sidebar links: ${entry.key}`, () => {
    test.use({ storageState: join(AUTH_DIR, `${entry.key}.json`) });

    test("1366: the sidebar is always visible and lists the recorded links", async ({ page, context }) => {
      await watch(page, context, entry.key);
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto(entry.home);
      await settle(page);
      await expect(page.locator("aside:visible nav a").first()).toBeVisible();
      // the open-menu button belongs to small screens only
      await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
      const links = await sidebarLinks(page);
      expect(links.length, "the role sees a sidebar").toBeGreaterThan(3);
      expect(links.slice().sort()).toEqual(EXPECTED_LINKS[entry.key].slice().sort());
      // top bar: sign-out and the bell are there
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Notifications/ })).toBeVisible();
    });
  });
}

test.describe("mobile menu (390 px)", () => {
  test.use({ storageState: join(AUTH_DIR, "staff.json"), viewport: { width: 390, height: 844 } });

  test("the menu button opens the sidebar with the same links as at 1366", async ({ page, context }) => {
    await watch(page, context, "staff");
    await page.goto("/");
    await settle(page);
    await expect(page.locator("aside:visible")).toHaveCount(0);
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.locator("aside:visible nav a").first()).toBeVisible();
    expect((await sidebarLinks(page)).sort()).toEqual(EXPECTED_LINKS.staff.slice().sort());
    await expect(page.getByRole("button", { name: "Close menu" })).toBeVisible();
    await shot(page, "menu-open-staff-390");
  });

  test("a nav link navigates and closes the menu", async ({ page, context }) => {
    await watch(page, context, "staff");
    await page.goto("/");
    await settle(page);
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.locator("aside:visible nav").getByRole("link", { name: "Students", exact: true }).click();
    await expect(page).toHaveURL(/\/students$/);
    await expect(page.locator("aside:visible")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  });

  test("the close button and a tap on the backdrop close the menu", async ({ page, context }) => {
    await watch(page, context, "staff");
    await page.goto("/");
    await settle(page);
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.locator("aside:visible")).toHaveCount(1);
    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(page.locator("aside:visible")).toHaveCount(0);
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.locator("aside:visible")).toHaveCount(1);
    await page.mouse.click(385, 400); // the dimmed strip to the right of the 18rem panel
    await expect(page.locator("aside:visible")).toHaveCount(0);
  });

  test("Escape closes the menu and the focus returns to the menu button", async ({ page, context }) => {
    await watch(page, context, "staff");
    await page.goto("/");
    await settle(page);
    const menu = page.getByRole("button", { name: "Open menu" });
    await menu.click();
    await expect(page.locator("aside:visible nav a").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("aside:visible")).toHaveCount(0);
    await expect(menu).toBeFocused();
  });

  test("the menu lists the same links for student and dean as at 1366", async ({ browser }) => {
    for (const key of ["student", "dean"]) {
      const entry = ROLES.find((r) => r.key === key);
      const context = await browser.newContext({ storageState: join(AUTH_DIR, `${key}.json`), viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await watch(page, context, key);
      await page.goto(entry.home);
      await settle(page);
      await page.getByRole("button", { name: "Open menu" }).click();
      await expect(page.locator("aside:visible nav a").first()).toBeVisible();
      expect((await sidebarLinks(page)).sort(), key).toEqual(EXPECTED_LINKS[key].slice().sort());
      await shot(page, `menu-open-${key}-390`);
      await context.close();
    }
  });
});

test.describe("notification bell", () => {
  for (const key of ["staff", "student", "dean", "faculty"]) {
    test.describe(key, () => {
      test.use({ storageState: join(AUTH_DIR, `${key}.json`) });

      test("opens its list, shows the count, closes on Escape and on an outside click", async ({ page, context }) => {
        await watch(page, context, key);
        const entry = ROLES.find((r) => r.key === key);
        const loaded = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/notifications" && r.request().method() === "GET");
        await page.goto(entry.home);
        const body = await (await loaded).json();
        await settle(page);
        const unread = body.unread_count || 0;
        const bell = page.getByRole("button", { name: /^Notifications/ });
        await expect(bell).toHaveAttribute("aria-label", unread ? `Notifications, ${unread} unread` : "Notifications");
        if (unread) await expect(bell).toContainText(unread > 9 ? "9+" : String(unread));
        await expect(bell).toHaveAttribute("aria-expanded", "false");

        await bell.click();
        const region = page.getByRole("region", { name: "Notifications" });
        await expect(region).toBeVisible();
        await expect(bell).toHaveAttribute("aria-expanded", "true");
        await expect(region.getByText("Mark all read")).toBeVisible();
        const shown = Math.min((body.items || []).length, 30);
        if (shown === 0) await expect(region.getByText("You have no notifications.")).toBeVisible();
        else await expect(region.locator("li")).toHaveCount(shown);
        await shot(page, `bell-open-${key}-1366`);

        await page.keyboard.press("Escape");
        await expect(region).toBeHidden();
        await bell.click();
        await expect(region).toBeVisible();
        await page.locator("main").click({ position: { x: 5, y: 5 } });
        await expect(region).toBeHidden();
      });
    });
  }
});

test.describe("sign out", () => {
  test("Sign out ends the session and shows the login page (fresh login, shared sessions untouched)", async ({ browser }) => {
    const entry = ROLES.find((r) => r.key === "admin");
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    await watch(page, context, "admin");
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(emailOf(entry));
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: /^\s*Sign in\s*$/ }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
    await expect(page.locator("aside:visible nav a").first()).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await context.close();
  });
});
