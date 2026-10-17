// Packet P7.0 (owner decision IM19, one action-first home layout for every role): pins what the STUDENT home shows.
// Written BEFORE the change and red on the old home. Through the real UI, as three demo students (read-only: nothing is
// clicked except navigation links, no data changes):
//   - Maya Torres (AWOL, one open task held by the Academic Coordinator, one recommendation): the first section of
//     the page is "Needs your action" (the AWOL banner, with a working link) and holds only what SHE must do; the
//     coordinator's alert sits in the second section, "Waiting on the Graduate School" (AD7); "Your open tasks" counts 0;
//   - Roberto Aquino (nothing waiting): the same section says "Nothing is waiting on you" and holds no list and there is no empty second group;
//   - Miguel Yu (any stage on the lifecycle path): each key number is shown ONCE (coursework %, research status, open tasks, unread
//     messages), the lifecycle Stepper marks his current stage, "On track" appears at most once, and the blocks that
//     left the home are still one click away: Defense Schedule, Request Center, Leave of Absence, Research Adviser;
//   - at 390 px nothing overflows sideways and the page is one column; at 1366 px the actions take the wide column.
// Students other specs change (Andrea, Bianca, Isabel, Maureen, Daniel, Gabriel, Joshua, Paolo) are not used.
import { test, expect } from "@playwright/test";
import { PASSWORD } from "./support/accounts.js";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

const MAYA = "awol.maya@usls.edu.ph";
const ROBERTO = "roberto.aquino@student.usls.edu.ph";
const MIGUEL = "student@usls.edu.ph";

// A fresh browser context per test, signed in through the login API (the page then uses the same cookie).
test.use({ storageState: { cookies: [], origins: [] } });

let tracker;
test.beforeEach(async ({ page, context }) => {
  tracker = { problems: [], writes: [], where: { role: "student", page: "P7.0 student home", viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
  // opening the home writes nothing (the I-038 / I-039 rule)
  expect(tracker.writes, `non-GET API calls while the home was open: ${tracker.writes.join(", ")}`).toEqual([]);
});

async function openHome(page, context, email) {
  const res = await context.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.ok(), `sign in as ${email}`).toBeTruthy();
  await page.goto("/student");
  await expect(page.locator("main h1")).toContainText("Welcome,");
  await page.waitForLoadState("networkidle");
}

const main = (page) => page.locator("main");
const sectionOf = (page, name) => main(page).locator("section", { has: page.getByRole("heading", { name, exact: true }) });

test.describe("student home, action first (IM19)", () => {
  test("Maya: 'Needs your action' holds what she must do; the coordinator's alert waits under 'Waiting on the Graduate School'", async ({ page, context }) => {
    await openHome(page, context, MAYA);
    const headings = main(page).locator("h2");
    await expect(headings.nth(0), "the first section of the page").toHaveText("Needs your action");
    await expect(headings.nth(1), "the second section, right under it").toHaveText("Waiting on the Graduate School");

    // the AWOL banner is hers to act on: it is in "Needs your action" with a working link
    const mine = sectionOf(page, "Needs your action");
    await expect(mine.getByText("Your record is marked AWOL")).toBeVisible();
    // the coordinator's alert is NOT hers to act on
    await expect(mine.getByText("Review automatic AWOL policy alert"), "an office's task is not a student action").toHaveCount(0);
    await expect(mine.getByText(/With the Academic Coordinator/), "no office-held row under Needs your action").toHaveCount(0);

    const waiting = sectionOf(page, "Waiting on the Graduate School");
    await expect(waiting.getByText("Review automatic AWOL policy alert")).toBeVisible();
    await expect(waiting.getByText(/With the Academic Coordinator/)).toBeVisible();
    await expect(waiting.getByText("Your record is marked AWOL"), "the banner is not duplicated here").toHaveCount(0);
    await expect(waiting.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/student/requests");

    // the key number counts only her own tasks: the coordinator's alert is not one of them
    const card = main(page).locator('[data-slot="label"]', { hasText: /^Your open tasks$/i }).locator("xpath=..");
    await expect(card.locator('[data-slot="value"]')).toHaveText("0");

    // both rows lead to the student page where the case is handled
    const link = mine.locator('a[href$="/student/requests/awol-return"]').first();
    await expect(link, "a link from the banner to the page where it is handled").toBeVisible();
    await expect(waiting.locator('a[href$="/student/requests/awol-return"]').first()).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/student\/requests\/awol-return$/);
    await expect(page.locator("main h1")).toBeVisible();
  });

  test("Roberto: with nothing waiting the section says so and holds no list", async ({ page, context }) => {
    await openHome(page, context, ROBERTO);
    await expect(main(page).locator("h2").first()).toHaveText("Needs your action");
    const section = sectionOf(page, "Needs your action");
    await expect(section.getByText("Nothing is waiting on you")).toBeVisible();
    await expect(section.locator("li")).toHaveCount(0);
    await expect(main(page).getByRole("heading", { name: "Waiting on the Graduate School", exact: true }), "no empty second group").toHaveCount(0);
    await expect(main(page).getByRole("heading", { name: "Recent activity", exact: true })).toBeVisible();
    expect(await main(page).getByText(/on track/i).count(), "'On track' appears at most once").toBeLessThanOrEqual(1);
  });

  test("Miguel: every key number once, the Stepper marks the stage, 'On track' at most once, moved blocks stay reachable", async ({ page, context }) => {
    await openHome(page, context, MIGUEL);
    const m = main(page);
    // other specs move Miguel through the lifecycle (section-j resets him), so read his stage instead of assuming it
    const portal = await (await context.request.get("/api/student-portal/context")).json();
    const stage = portal.student.current_stage;

    // coursework % shown once, research status shown once
    await expect(m.getByText(/^\d+%$/), "coursework percentage appears once").toHaveCount(1);
    const research = (
      await m.locator('[data-slot="label"]', { hasText: /^Research$/i }).locator("xpath=..").locator('[data-slot="value"]').innerText()
    ).trim();
    expect(research, "research status").toBeTruthy();
    await expect(m.getByText(research, { exact: true }), "research status appears once").toHaveCount(1);
    expect(await m.getByText(/on track/i).count(), "'On track' appears at most once").toBeLessThanOrEqual(1);

    // exactly four key numbers, each named once
    const labels = (await m.locator('[data-slot="label"]').allTextContents()).map((t) => t.trim().toLowerCase());
    expect([...labels].sort(), "the key-number labels").toEqual(["coursework", "research", "unread messages", "your open tasks"]);

    // the Stepper marks the student's current stage
    const current = m.locator('ol [aria-current="step"]');
    await expect(current).toHaveCount(1);
    await expect(current).toContainText(stage);

    // blocks that left the home are one click away
    for (const [name, path] of [
      ["Defense Schedule", "/student/defense-schedule"],
      ["Request Center", "/student/requests"],
      ["Leave of Absence", "/student/requests/leave-of-absence"],
      ["Research Adviser", "/student/adviser"],
    ]) {
      await expect(m.getByRole("link", { name: new RegExp(name, "i") }).first(), `link to ${name}`).toHaveAttribute("href", path);
    }
    // one line about the defense, not the whole schedule list
    await expect(m.getByText(/took place|is booked|No defense/i).first()).toBeVisible();
    await expect(m.getByRole("heading", { name: /Schedule requests/i })).toHaveCount(0);
    await m.getByRole("link", { name: /Request Center/i }).first().click();
    await expect(page).toHaveURL(/\/student\/requests$/);
  });

  test("layout: one column at 390 with no sideways scroll, actions in the wide column at 1366", async ({ page, context }) => {
    await openHome(page, context, MAYA);
    await page.setViewportSize({ width: 1366, height: 768 });
    const actions = sectionOf(page, "Needs your action");
    const activity = sectionOf(page, "Recent activity");
    const a = await actions.boundingBox();
    const r = await activity.boundingBox();
    expect(a && r).toBeTruthy();
    expect(a.width, "actions are wider than the activity column").toBeGreaterThan(r.width);
    expect(r.x, "activity sits beside the actions at 1366").toBeGreaterThan(a.x + a.width - 2);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const a2 = await actions.boundingBox();
    const r2 = await activity.boundingBox();
    expect(Math.abs(a2.x - r2.x), "one column at 390: same left edge").toBeLessThan(2);
    expect(r2.y, "activity under the actions at 390").toBeGreaterThan(a2.y + a2.height - 2);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "horizontal overflow at 390").toBeLessThanOrEqual(1);
  });
});
