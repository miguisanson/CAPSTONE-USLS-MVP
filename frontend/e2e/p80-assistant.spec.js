// Behaviour pin for the Policy Assistant rebuild (owner decision IM21, packet pkt/assistant).
// There is no Gemini key in the e2e run, so this exercises the offline path and every UI state: the chat list, the
// "Offline answer" label, the sources under an answer (document, page, section), the calm "not covered" state, a
// personal question answered from the signed-in user's own record or queue, and no sideways scroll at 390 px.
// Everything is read-only: a question changes nothing in the database.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";
import { attachWatchers, formatProblems, stubExternal } from "./support/checker.js";

const SHOTS = join(SCREENS_DIR, "..", process.env.E2E_SHOTS_TAG || "p80");
const COVERED = "What is the maximum residence period for a master's program?";
const NOT_COVERED = "What time does the campus gym open on weekends?";
const FIRST_ANSWER_MS = 120_000; // the first policy question reads the Handbook and builds the keyword index

let tracker;
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ page, context }, info) => {
  tracker = { problems: [], writes: [], where: { role: info.project.name, page: "Policy Assistant", viewport: 0 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
});
test.afterEach(async () => {
  const report = formatProblems(tracker.problems);
  expect(report, report.join("\n")).toEqual([]);
});

const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
// On a phone the page grows with the chat (full page); on a desktop the chat scrolls inside its card (what is on screen).
async function shot(page, name) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SHOTS, name), fullPage: page.viewportSize().width < 768 });
}
/** The newest message is in view: the message list is scrolled to its end. */
const atBottom = (page) =>
  page.getByRole("log").evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight <= 4);
const box = (page) => page.getByRole("textbox", { name: "Your question" });
const send = (page) => page.getByRole("button", { name: "Send question" });
const suggestions = (page) => page.getByRole("group", { name: "Suggested questions" }).getByRole("button");
async function ask(page, question) {
  await box(page).fill(question);
  await send(page).click();
}

test.describe("staff", () => {
  test.use({ storageState: join(AUTH_DIR, "staff.json"), viewport: { width: 1366, height: 768 } });

  test("a covered question: offline label, sources with document and page, then a not-covered question and a personal one", async ({ page }) => {
    await page.goto("/assistant");
    await expect(page.getByRole("heading", { level: 1, name: "Policy Assistant" })).toBeVisible();
    // 3-4 suggested questions, one of them personal
    await expect(suggestions(page)).toHaveCount(4);
    await expect(suggestions(page).filter({ hasText: "What is waiting on me?" })).toHaveCount(1);
    await expect(page.getByRole("log")).toContainText("Hi! I'm the Policy Assistant.");

    // covered: answered from the Handbook, offline (no key), with a source that names document and page
    await ask(page, COVERED);
    const badge = page.getByTestId("answer-badge").last();
    await expect(badge).toContainText("Offline answer", { timeout: FIRST_ANSWER_MS });
    await expect(badge).toHaveAttribute("data-offline", "true");
    await expect(page.getByRole("log")).toContainText("seven");
    const sources = page.getByTestId("source-list").last();
    await expect(sources).toContainText("Sources (");
    await expect(sources.locator("summary").first()).toContainText("Handbook");
    await expect(sources.locator("summary").first()).toContainText(/Page \d+/);
    await sources.locator("summary").first().click();
    await expect(sources.locator("blockquote").first()).toBeVisible();
    await expect(page.getByTestId("not-covered")).toHaveCount(0);
    await shot(page, "staff-covered-1366.png");

    // not covered: the calm state, no passages, no "Offline answer" label under it
    const sourceListsBefore = await page.getByTestId("source-list").count();
    await ask(page, NOT_COVERED);
    const notCovered = page.getByTestId("not-covered");
    await expect(notCovered).toBeVisible({ timeout: 30_000 });
    await expect(notCovered).toContainText("Not covered by the policy documents");
    await expect(notCovered).toContainText("don't cover this");
    await expect(notCovered).toContainText("Ask the Graduate School office");
    await expect(page.getByTestId("source-list")).toHaveCount(sourceListsBefore);
    await expect.poll(() => atBottom(page), "the newest answer is scrolled into view").toBe(true);
    await shot(page, "staff-not-covered-1366.png");

    // personal: from the signed-in user's own queue, not a policy search
    await suggestions(page).filter({ hasText: "What is waiting on me?" }).click();
    await expect(page.getByRole("log")).toContainText(/waiting on you|Nothing is waiting/, { timeout: 30_000 });
    await expect(page.getByTestId("answer-badge").last()).toContainText("From your own record");
    await expect(page.getByTestId("source-list")).toHaveCount(sourceListsBefore);
    await shot(page, "staff-personal-1366.png");
    expect(await noOverflow(page), "no sideways scroll at 1366").toBe(true);
  });

  test("the question box takes Enter, shows the input labelled, and keeps the student focus panel", async ({ page }) => {
    await page.goto("/assistant");
    await expect(page.getByRole("heading", { level: 2, name: "Focus on a student" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "How this works" })).toBeVisible();
    await box(page).fill("Which students need attention right now?");
    await box(page).press("Enter");
    await expect(page.getByRole("log")).toContainText("Students needing attention", { timeout: 60_000 });
    await expect(box(page)).toHaveValue("");
  });
});

test.describe("student", () => {
  test.use({ storageState: join(AUTH_DIR, "student.json"), viewport: { width: 390, height: 844 } });

  test("at 390 px: suggested questions, a personal answer from the student's own record, a not-covered answer", async ({ page }) => {
    await page.goto("/student/assistant");
    await expect(page.getByRole("heading", { level: 1, name: "Policy Assistant" })).toBeVisible();
    await expect(page.getByText("Private and read-only")).toBeVisible();
    await expect(suggestions(page)).toHaveCount(4);
    for (const button of await suggestions(page).all()) {
      const { height } = await button.boundingBox();
      expect(height, "suggestion tap target").toBeGreaterThanOrEqual(43);
    }
    await suggestions(page).filter({ hasText: "What is my next step?" }).click();
    await expect(page.getByRole("log")).toContainText("From your own record", { timeout: 60_000 });
    await expect(page.getByTestId("answer-badge").last()).toContainText("Offline answer");
    await expect(page.getByTestId("source-list")).toHaveCount(0);
    expect(await noOverflow(page), "no sideways scroll at 390 after a personal answer").toBe(true);
    await shot(page, "student-personal-390.png");

    await ask(page, NOT_COVERED);
    await expect(page.getByTestId("not-covered")).toBeVisible({ timeout: 60_000 });
    expect(await noOverflow(page), "no sideways scroll at 390 after a not-covered answer").toBe(true);
    await shot(page, "student-not-covered-390.png");

    await ask(page, COVERED);
    await expect(page.getByTestId("source-list").last()).toContainText("Handbook", { timeout: FIRST_ANSWER_MS });
    expect(await noOverflow(page), "no sideways scroll at 390 after sources").toBe(true);
    await shot(page, "student-sources-390.png");
  });
});

test.describe("dean and faculty", () => {
  for (const [role, path] of [["dean", "/dean/assistant"], ["faculty", "/faculty-portal/assistant"]]) {
    test.describe(role, () => {
      test.use({ storageState: join(AUTH_DIR, `${role}.json`), viewport: { width: 390, height: 844 } });
      test(`${role}: policy question with sources, no sideways scroll at 390`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1, name: "Policy Assistant" })).toBeVisible();
        await expect(suggestions(page)).toHaveCount(4);
        await ask(page, COVERED);
        await expect(page.getByTestId("source-list").last()).toContainText("Handbook", { timeout: FIRST_ANSWER_MS });
        await expect(page.getByTestId("answer-badge").last()).toContainText("Offline answer");
        expect(await noOverflow(page), "no sideways scroll at 390").toBe(true);
        await shot(page, `${role}-sources-390.png`);
      });
    });
  }
});
