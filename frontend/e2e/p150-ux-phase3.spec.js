// e2e-writes: none
// UX audit Phase 3 (2026-11-20, issues UX-18..UX-22). Written before the change. Reads only.
// Owner 2026-11-20 (IM50): say a thing once. Owner IM51: one word per meaning for status (merge synonyms).
//   UX-18 a status shows one word per meaning: no "Ready for Dean Review", "Report Sent to Dean", "Dean Review" chips
//   UX-19 a board card does not repeat its column as its status line, and has no "Awaiting your review" flag
//   UX-20 the drag / "Move to..." hint is in the Help panel ("Using the board"), not above the board
//   UX-21 no form-number line under a page title; a page with form numbers has a Help button that shows them
//   UX-22 a page description is one short sentence; no description or section subtitle says the same thing twice
import { test, expect } from "@playwright/test";
import { BASE_URL } from "./support/paths.mjs";
import { PASSWORD, loadState } from "./support/accounts.js";

async function signedIn(browser, email, viewport = { width: 1366, height: 768 }) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport });
  const res = await context.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  return context;
}
const main = (page) => page.locator("main");
const norm = (text) => String(text || "").replace(/\s+/g, " ").trim();
const sentences = (text) => (norm(text).replace(/\b(Dr|Mr|Ms|Mrs|Prof|St)\./g, "$1").match(/[.!?](\s|$)/g) || []).length;

// Every page in each portal's sidebar (portalNav.jsx, Layout.jsx), plus pages reached from them.
const PAGES = {
  staff: ["staff@usls.edu.ph", [
    "/", "/reports", "/term-settings", "/students", "/faculty", "/monitoring-sheet", "/enrollment-class-list",
    "/workflow/student-handoff", "/course-adjustments", "/enrollment", "/workflow/course-audit", "/workflow/research-gate",
    "/workflow/panel-matching", "/workflow/defense-scheduling", "/workflow/practicum", "/workflow/graduation",
    "/workflow/leave-of-absence", "/workflow/readmission", "/workflow/awol", "/workflow/withdrawal",
    "/work-queue", "/activity", "/assistant", "/policy-documents", "/business-rules",
  ]],
  dean: ["dean@usls.edu.ph", [
    "/dean", "/dean/approvals", "/dean/approvals/course-adjustments", "/dean/approvals/leave-of-absence", "/dean/approvals/readmission",
    "/dean/approvals/awol", "/dean/approvals/withdrawal", "/dean/approvals/practicum", "/dean/approvals/graduation", "/dean/gate-reports",
    "/dean/analytics", "/dean/activity", "/dean/assistant", "/dean/business-rules",
  ]],
  faculty: [() => loadState().facultyEmail, [
    "/faculty-portal", "/faculty-portal/advisees", "/faculty-portal/signatures", "/faculty-portal/panels", "/faculty-portal/invitations",
    "/faculty-portal/defenses", "/faculty-portal/calendar", "/faculty-portal/availability", "/faculty-portal/verdicts",
    "/faculty-portal/classes", "/faculty-portal/schedule", "/faculty-portal/assistant", "/faculty-portal/business-rules",
  ]],
  student: ["student@usls.edu.ph", [
    "/student", "/student/progress", "/student/enrollment", "/student/class-schedule", "/student/graduation", "/student/research",
    "/student/adviser", "/student/defense-schedule", "/student/calendar", "/student/requests", "/student/requests/leave-of-absence",
    "/student/requests/readmission", "/student/requests/awol-return", "/student/requests/withdrawal", "/student/messages",
    "/student/documents", "/student/activity", "/student/assistant", "/student/profile",
  ]],
};

test.describe("UX Phase 3: every page says a thing once", () => {
  test.describe.configure({ timeout: 240_000 });
  for (const [role, [email, paths]] of Object.entries(PAGES)) {
    test(`UX-21/22 ${role}: short page lines, no form line under the title, nothing said twice`, async ({ browser }) => {
      const context = await signedIn(browser, typeof email === "function" ? email() : email);
      const page = await context.newPage();
      const problems = [];
      try {
        for (const path of paths) {
          await page.goto(path);
          await expect(main(page).locator("h1").first(), `${path} has a title`).toBeVisible();
          await page.waitForLoadState("networkidle");
          if (await main(page).locator("header [data-slot=forms]").count()) problems.push(`${path}: a form line under the title`);
          for (const description of await main(page).locator("header [data-slot=description]").allInnerTexts()) {
            if (norm(description).length > 110) problems.push(`${path}: description is ${norm(description).length} characters: ${norm(description)}`);
            if (sentences(description) > 1) problems.push(`${path}: description has ${sentences(description)} sentences: ${norm(description)}`);
          }
          const lines = (await main(page).locator("[data-slot=description], [data-slot=subtitle]").allInnerTexts()).map(norm).filter((text) => text.length >= 20);
          const twice = lines.filter((text, index) => lines.indexOf(text) !== index);
          if (twice.length) problems.push(`${path}: said twice: ${[...new Set(twice)].join(" | ")}`);
          for (const subtitle of await main(page).locator("[data-slot=subtitle]").allInnerTexts()) {
            if (norm(subtitle).length > 110) problems.push(`${path}: subtitle is ${norm(subtitle).length} characters: ${norm(subtitle)}`);
          }
        }
        expect(problems, problems.join("\n")).toEqual([]);
      } finally { await context.close(); }
    });
  }

  test("UX-21 a page with form numbers shows them in its Help panel", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      for (const path of ["/course-adjustments", "/enrollment"]) {
        await page.goto(path);
        await main(page).getByRole("button", { name: "Help", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog.locator("[data-slot=forms]"), path).toContainText(/GS-F-|Operations Manual/);
        await dialog.getByRole("button", { name: "Close help" }).click();
      }
    } finally { await context.close(); }
  });
});

test.describe("UX Phase 3: boards", () => {
  const BOARDS = ["/workflow/leave-of-absence", "/workflow/readmission", "/workflow/awol", "/workflow/withdrawal", "/workflow/practicum", "/workflow/graduation", "/workflow/research-gate"];

  test("UX-20 the board hint is in Help, not above the board", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      for (const path of BOARDS) {
        await page.goto(path);
        await expect(main(page).locator("h1")).toBeVisible();
        await page.waitForLoadState("networkidle");
        await expect(main(page).getByText(/Dragging a card to another column|A card moves to the next column/), path).toHaveCount(0);
        await main(page).getByRole("button", { name: "Help", exact: true }).click();
        // owner 2026-11-19: Withdrawal, Practicum and Graduation move cards by themselves; Research Gate is for viewing
        const words = /withdrawal|practicum|graduation/.test(path) ? "moves to the next column by itself" : /research-gate/.test(path) ? "for viewing" : "Move to";
        await expect(page.getByRole("dialog").getByRole("region", { name: "Using the board" }), path).toContainText(words);
        await page.getByRole("dialog").getByRole("button", { name: "Close help" }).click();
      }
    } finally { await context.close(); }
  });

  test("UX-18 one word per meaning: no process-specific name for a Dean wait", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      for (const path of ["/workflow/graduation", "/workflow/practicum", "/workflow/withdrawal", "/workflow/leave-of-absence"]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        for (const view of ["Board", "Table"]) {
          const toggle = main(page).getByRole("button", { name: view, exact: true });
          if (await toggle.count()) await toggle.first().click();
          const chips = (await main(page).locator("[data-status-tone]").allInnerTexts()).map(norm);
          for (const word of ["Ready for Dean Review", "Report Sent to Dean", "Dean Review", "Submitted to GS Staff", "Returned for Clarification", "Registrar Received"]) {
            expect(chips.filter((chip) => chip === word), `${path} ${view}: "${word}" chip`).toEqual([]);
          }
        }
      }
    } finally { await context.close(); }
  });

  test("UX-19 a card does not repeat its column, and has no Awaiting your review flag", async ({ browser }) => {
    const context = await signedIn(browser, "staff@usls.edu.ph");
    const page = await context.newPage();
    try {
      for (const path of ["/workflow/leave-of-absence", "/workflow/readmission"]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const board = main(page).getByTestId("stage-board");
        await expect(board).toBeVisible();
        await expect(board.getByText("Awaiting your review"), path).toHaveCount(0);
        const columns = board.locator("section[aria-label]");
        for (let i = 0; i < (await columns.count()); i++) {
          const label = norm(await columns.nth(i).getAttribute("aria-label"));
          const facts = (await columns.nth(i).locator('[data-testid="case-facts"] li').allInnerTexts()).map(norm);
          expect(facts.filter((fact) => fact.toLowerCase() === label.toLowerCase()), `${path}: a card in "${label}" says "${label}" again`).toEqual([]);
        }
      }
    } finally { await context.close(); }
  });
});
