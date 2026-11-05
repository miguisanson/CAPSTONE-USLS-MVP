// e2e-writes: none
// Owner revision 2026-11-04: Research Gate is a three-column board and Graduate School staff can
// record a panel verdict as a fallback. The verdict POST is mocked, so the disposable database is unchanged.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ARTIFACTS_DIR, AUTH_DIR, BASE_URL } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const shots = join(ARTIFACTS_DIR, "screens", "p124-research-gate");
const stages = [
  { key: "Title Defense", label: "Title Defense" },
  { key: "Proposal Defense", label: "Proposal Defense" },
  { key: "Completion", label: "Final Defense" },
];

test.beforeAll(() => mkdirSync(shots, { recursive: true }));

test("Research Gate shows the three stages as columns at desktop and phone widths", async ({ browser }) => {
  for (const width of [1366, 1920, 390]) {
    const context = await browser.newContext({
      baseURL: BASE_URL,
      storageState: authFile("staff"),
      viewport: { width, height: width === 390 ? 844 : 900 },
    });
    const page = await context.newPage();
    try {
      const overview = await (await context.request.get("/api/research-gate/overview")).json();
      await page.goto("/workflow/research-gate");
      const board = page.getByTestId("stage-board");
      await expect(board).toBeVisible();
      const boardHeight = await board.evaluate((element) => element.getBoundingClientRect().height);
      expect(boardHeight, "the stage board stays compact so the student record remains nearby").toBeLessThan(width === 390 ? 1300 : 700);
      if (width > 390) {
        await expect(page.getByTestId("board-scroll-hint"), "all three stages fit without horizontal board scrolling at desktop widths").toHaveCount(0);
      }
      for (const { key, label } of stages) {
        const region = page.getByRole("region", { name: label });
        await expect(region).toBeVisible();
        await expect(region.getByTestId("stage-scroll")).toBeVisible();
        const total = overview.items.filter((row) => row.board_stage === key).length;
        await expect(region.getByTestId("stage-count")).toHaveText(String(total));
      }
      for (const row of overview.items) {
        const stage = stages.find(({ key }) => key === row.board_stage);
        expect(stage).toBeTruthy();
        const name = `Open the Research Gate record of ${row.student.name}, ${row.student.student_number}`;
        await expect(page.getByRole("button", { name, exact: true })).toHaveCount(1);
        await expect(page.getByRole("region", { name: stage.label }).getByRole("button", { name, exact: true })).toHaveCount(1);
      }
      await expect(page.getByRole("columnheader")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.screenshot({ path: join(shots, `research-gate-${width}.png`), fullPage: true });
    } finally {
      await context.close();
    }
  }
});

test("Graduate School staff can record one of the five verdicts for the panel", async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    storageState: authFile("staff"),
    viewport: { width: 1366, height: 900 },
  });
  const overview = await (await context.request.get("/api/research-gate/overview")).json();
  const student = overview.items[0].student;
  const writes = [];

  await context.route("**/api/transactions/research-gate/context*", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.staff_defense_action = {
      schedule: { id: 99114, defense_type: "Proposal Defense", preferred_date: "2026-11-04", start_time: "13:00", status: "Scheduled" },
      verdict: null,
      panel_chair_name: "Dr. Spec Chair",
      can_submit: true,
      can_correct: false,
      can_confirm_revisions: false,
      verdict_options: [
        { value: "Passed", label: "Passed" },
        { value: "Passed with minor revisions", label: "Passed with minor revisions" },
        { value: "Provisional pass - revisions or re-defense", label: "Provisional pass – revisions or re-defense" },
        { value: "Deferred", label: "Deferred" },
        { value: "Failed", label: "Failed" },
      ],
    };
    await route.fulfill({ response, json: data });
  });
  await context.route("**/api/faculty-portal/defense-verdicts/99114", async (route) => {
    writes.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true, message: "Defense verdict recorded for the panel." } });
  });

  const page = await context.newPage();
  try {
    await page.goto(`/workflow/research-gate?student_id=${student.id}`);
    await expect(page.locator("main")).toContainText("panel chair or Graduate School staff");
    await expect(page.getByText("Read-only for GS staff", { exact: false })).toHaveCount(0);
    const panel = page.getByRole("region", { name: "Panel verdict fallback" });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Panel chair: Dr. Spec Chair")).toBeVisible();
    const outcome = panel.getByLabel("Verdict result");
    await expect(outcome.locator("option")).toHaveText([
      "Passed",
      "Passed with minor revisions",
      "Provisional pass – revisions or re-defense",
      "Deferred",
      "Failed",
    ]);
    await outcome.selectOption("Provisional pass - revisions or re-defense");
    await panel.getByRole("combobox", { name: /^Required follow-up/ }).selectOption("re-defense");
    await panel.getByLabel("Remarks or conditions").fill("Recorded from the signed panel result.");
    // Merge v6.4 (owner decision M3): staff give a reason when recording for the panel.
    await panel.getByLabel("Reason for recording for the panel").fill("The chair is away; signed result received.");
    await panel.getByRole("button", { name: "Record panel verdict" }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toEqual({
      result: "Provisional pass - revisions or re-defense",
      provisional_follow_up: "re-defense",
      remarks: "Recorded from the signed panel result.",
      reason: "The chair is away; signed result received.",
    });
  } finally {
    await context.close();
  }
});
