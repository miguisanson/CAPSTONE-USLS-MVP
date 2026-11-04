// e2e-writes: none
// FO7 (.planning/forms-ops/CONTRACT.md "App wiring"): the Data Privacy Notice at first sign-in (GS-P-04), the
// "Forms GS-F-xx · Operations Manual x.y" line on each process page (same kind of page, same line: IM24), and the
// e-approval note under every approve / decide control (GS-P-03).
// Seeded accounts are pre-accepted, so the notice is reached by answering GET /api/auth/me and POST /api/auth/privacy-consent
// through page.route; nothing is saved. The form lines are read from the real pages.
// Screenshots go to e2e-artifacts/p112 at 1366 and 390 px.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";

const SHOTS = join(SCREENS_DIR, "..", "p112");
const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const NOTE = "Your decision is recorded as your electronic approval (GS-P-03).";
const HEADING = { level: 1, name: "Data Privacy Notice" };

test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: "ignoreErrors" }); });

async function askForConsent(page, state) {
  await page.route(/\/api\/auth\/me$/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.user.privacy_consent_required = !state.accepted;
    await route.fulfill({ response, json: body });
  });
}

test.describe("Data Privacy Notice at first sign-in", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 800 } });

  test("the notice needs the tick, then the person reaches the page", async ({ page }) => {
    const state = { accepted: false, posts: 0 };
    await askForConsent(page, state);
    await page.route(/\/api\/auth\/privacy-consent$/, async (route) => {
      state.posts += 1;
      state.accepted = true;
      await route.fulfill({ json: { ok: true, user: { privacy_consent_required: false } } });
    });
    await page.goto("/dean");
    await expect(page.getByRole("heading", HEADING)).toBeVisible();
    await expect(page.getByText("Your rights")).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    await page.screenshot({ path: join(SHOTS, "privacy-notice-1366.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await noOverflow(page)).toBe(true);
    await page.screenshot({ path: join(SHOTS, "privacy-notice-390.png"), fullPage: true });
    await page.setViewportSize({ width: 1366, height: 800 });

    await page.getByRole("button", { name: "Accept and continue" }).click();
    await expect(page.getByText("Tick the box to confirm you have read the notice.")).toBeVisible();
    expect(state.posts).toBe(0);

    await page.getByRole("checkbox", { name: /I have read the notice and agree/ }).check();
    await page.getByRole("button", { name: "Accept and continue" }).click();
    await expect(page.getByRole("heading", HEADING)).toHaveCount(0);
    await expect(page.locator("aside nav")).toBeVisible();
    expect(state.posts).toBe(1);
  });
});

// One row per kind of page; every role that has the kind is listed, so a page that forgets the line fails here.
const AWOL = "Forms GS-F-09, GS-F-10 · Operations Manual 4.8, 4.9";
const PRACTICUM = "Forms GS-F-11, GS-F-12, GS-F-13 · Operations Manual 4.17";
const GRADUATION = "Forms GS-F-42, GS-F-43 · Operations Manual 4.18";
const ADVISER = "Forms GS-F-19, GS-F-20, GS-F-21 · Operations Manual 4.12";
const DEFENSE = "Forms GS-F-28 · Operations Manual 4.16";
const PLANS = "Forms GS-F-03, GS-F-04 · Operations Manual 4.3";
const ENROLL = "Forms GS-F-02 · Operations Manual 4.2";
const FORM_LINES = [
  ["staff", "/workflow/leave-of-absence", "Forms GS-F-07 · Operations Manual 4.6"],
  ["student", "/student/requests/leave-of-absence", "Forms GS-F-07 · Operations Manual 4.6"],
  ["dean", "/dean/approvals/leave-of-absence", "Forms GS-F-07 · Operations Manual 4.6"],
  ["staff", "/workflow/readmission", "Forms GS-F-08 · Operations Manual 4.7"],
  ["student", "/student/requests/readmission", "Forms GS-F-08 · Operations Manual 4.7"],
  ["dean", "/dean/approvals/readmission", "Forms GS-F-08 · Operations Manual 4.7"],
  ["staff", "/workflow/awol", AWOL],
  ["student", "/student/requests/awol-return", AWOL],
  ["dean", "/dean/approvals/awol", AWOL],
  ["staff", "/workflow/withdrawal", "Forms GS-F-05 · Operations Manual 4.4"],
  ["student", "/student/requests/withdrawal", "Forms GS-F-05 · Operations Manual 4.4"],
  ["dean", "/dean/approvals/withdrawal", "Forms GS-F-05 · Operations Manual 4.4"],
  ["staff", "/workflow/practicum", PRACTICUM],
  ["student", "/student/practicum", PRACTICUM],
  ["dean", "/dean/approvals/practicum", PRACTICUM],
  ["staff", "/workflow/graduation", GRADUATION],
  ["student", "/student/graduation", GRADUATION],
  ["dean", "/dean/approvals/graduation", GRADUATION],
  ["staff", "/workflow/student-handoff", "Forms GS-F-01 · Operations Manual 4.1"],
  ["staff", "/workflow/research-gate", "Forms GS-F-16, GS-F-18, GS-F-27 · Operations Manual 4.11, 4.13"],
  ["staff", "/workflow/research-gate?view=adviser", ADVISER],
  ["student", "/student/adviser", ADVISER],
  ["faculty", "/faculty-portal/advisees", ADVISER],
  ["staff", "/workflow/panel-matching", "Forms GS-F-17 · Operations Manual 4.11"],
  ["faculty", "/faculty-portal/invitations", "Forms GS-F-17 · Operations Manual 4.11"],
  ["staff", "/workflow/defense-scheduling", DEFENSE],
  ["student", "/student/defense-schedule", DEFENSE],
  ["faculty", "/faculty-portal/defenses", DEFENSE],
  ["staff", "/course-adjustments", PLANS],
  ["dean", "/dean/approvals/course-adjustments", PLANS],
  ["staff", "/enrollment", ENROLL],
  ["student", "/student/enrollment", ENROLL],
  ["faculty", "/faculty-portal/schedule", "Forms GS-F-47, GS-F-48 · Operations Manual 4.20"],
];

test.describe("Forms and Operations Manual line on process pages", () => {
  for (const [role, path, line] of FORM_LINES) {
    test(`${role} ${path}`, async ({ browser }) => {
      const context = await browser.newContext({ storageState: authFile(role), viewport: { width: 1366, height: 800 } });
      const page = await context.newPage();
      try {
        await page.goto(path);
        await expect(page.locator('[data-slot="forms"]').first()).toHaveText(line);
      } finally {
        await context.close();
      }
    });
  }

  test("a page without a form does not show the line", async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile("staff"), viewport: { width: 1366, height: 800 } });
    const page = await context.newPage();
    try {
      await page.goto("/workflow/course-audit");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator('[data-slot="forms"]')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});

test.describe("e-approval note under decision controls", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 800 } });

  test("a Dean case shows the note with its decision buttons", async ({ page }) => {
    await page.goto("/dean/approvals");
    const caseLink = page.locator('a[href^="/dean/case/"]').first();
    await expect(caseLink).toBeVisible();
    await caseLink.click();
    await expect(page.getByText(NOTE).first()).toBeVisible();
    await page.screenshot({ path: join(SHOTS, "dean-case-1366.png"), fullPage: true });
  });
});
