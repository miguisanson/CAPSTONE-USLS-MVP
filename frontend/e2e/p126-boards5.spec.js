// e2e-writes: none
// Packet P-B boards (Fable review 2026-11-05: F5-04, F5-05, F5-07, F5-11, I-348). Written BEFORE the change; red on the old code.
// Through the real UI, reads only. The server answers are edited in the browser (page.route) where the demo data cannot show the case.
//   F5-04  a Dean-approved graduation batch has no "Application document issue" badge; Next = "Dean (export)", then "Done - with the Registrar".
//   F5-05  on a phone every process board opens only the stages that hold a card waiting on the signed-in role; finished stages
//          sit behind "Show finished (n)" at the end.
//   F5-07  a finished (Denied) card never says "Waiting for: ..." even if the server still names an owner.
//   F5-11  an AWOL card's first line is the kind, not the residence check result.
//   I-348  ?student_id= opens that student's request window on the four request boards.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const BATCH = "Batch 1 October 2026";
const getJson = (page, url) => page.evaluate(async (u) => (await fetch(u, { credentials: "same-origin" })).json(), url);

async function mockRoster(page, mutate) {
  await page.route(/\/api\/transactions\/graduation\/context/, async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    mutate(json.roster);
    await route.fulfill({ response, json });
  });
}
function approvedBatch(roster, registrar = "Pending") {
  const isabel = roster.find((row) => row.student.name === "Isabel Flores");
  isabel.has_submitted_documents = false;
  isabel.endorsement = { ...isabel.endorsement, batch_name: BATCH, endorsement_status: "Dean Approved", display_status: "Dean Approved", registrar_status: registrar };
  isabel.next_action_owner = "Dean (export)";
}

test.describe("F5-04 approved graduation batch (Dean)", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 768 } });

  test("no document badge; Next says Dean (export), then Done - with the Registrar", async ({ page }) => {
    await mockRoster(page, (roster) => approvedBatch(roster));
    await page.goto("/dean/approvals/graduation");
    const card = page.locator("div[draggable]").filter({ hasText: BATCH });
    await expect(card).toHaveCount(1);
    await expect(card.getByText("Application document issue")).toHaveCount(0);
    await expect(card).toContainText(/Next:\s*Dean \(export\)/);
    await page.unroute(/\/api\/transactions\/graduation\/context/);
    await mockRoster(page, (roster) => approvedBatch(roster, "Exported - Ready to Send"));
    await page.reload();
    const done = page.locator("div[draggable]").filter({ hasText: BATCH });
    await expect(done).toContainText("Done - with the Registrar");
  });
});

const BOARDS = [
  ["leave-of-absence", "Leave of absence board"],
  ["readmission", "Readmission board"],
  ["awol", "AWOL and residency board"],
  ["withdrawal", "Subject withdrawal board"],
  ["practicum", "Practicum workflow board"],
  ["graduation", "Graduation candidates by stage"],
];

for (const role of ["staff", "dean"]) {
  test.describe(`F5-05 phone list as ${role}`, () => {
    test.use({ storageState: authFile(role), viewport: { width: 390, height: 844 } });
    for (const [slug, phoneName] of BOARDS) {
      test(`${slug}: only stages with a card for ${role} are open; finished ones are behind Show finished`, async ({ page }) => {
        await page.goto(role === "dean" ? `/dean/approvals/${slug}` : `/workflow/${slug}`);
        const list = page.getByRole("region", { name: phoneName });
        await expect(list).toBeVisible();
        const headers = list.locator("section h3 button[aria-expanded]");
        expect(await headers.count()).toBeGreaterThan(0);
        for (const section of await list.locator("section").all()) {
          const open = (await section.locator("button[aria-expanded]").first().getAttribute("aria-expanded")) === "true";
          const cards = section.locator("div[draggable]");
          if (open) {
            expect(await cards.count(), "an open stage holds a card").toBeGreaterThan(0);
            await expect(cards.filter({ hasText: /Finished - nothing more to do|Exported\./ }), "an open stage holds no finished card").toHaveCount(0);
          } else {
            await expect(cards).toHaveCount(0);
          }
        }
        // No finished card is on screen until "Show finished" is pressed.
        await expect(list.getByText("Finished - nothing more to do")).toHaveCount(0);
        const show = list.getByRole("button", { name: /^Show finished \(\d+\)$/ });
        if (await show.count()) {
          await show.click();
          await expect(list.getByRole("button", { name: /^Hide finished/ })).toBeVisible();
        }
      });
    }
  });
}

test.describe("F5-07 and F5-11 card text (Dean, 1366)", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 1366, height: 768 } });

  test("a Denied card reads Finished even when the server still names an owner", async ({ page }) => {
    await page.route(/\/api\/process-cases\?slug=leave-of-absence/, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      for (const item of json.cases) if (item.status === "Denied") { item.owner = "Graduate School Staff"; item.actions = []; }
      await route.fulfill({ response, json });
    });
    await page.goto("/");
    const probe = await getJson(page, "/api/process-cases?slug=leave-of-absence");
    test.skip(!probe.cases.some((c) => c.status === "Denied"), "no Denied leave request in the demo data");
    await page.goto("/dean/approvals/leave-of-absence");
    const board = page.getByRole("region", { name: "Leave of absence board" });
    await expect(board).toBeVisible();
    const denied = probe.cases.find((c) => c.status === "Denied");
    const card = board.locator("div[draggable]").filter({ hasText: denied.student.name }).filter({ hasText: "Denied" }).first();
    await expect(card).toContainText("Finished - nothing more to do");
    await expect(card).not.toContainText("Waiting for:");
  });

  test("an AWOL card's first line is its kind; the residence result is not the headline", async ({ page }) => {
    await page.goto("/dean/approvals/awol");
    const board = page.getByRole("region", { name: "AWOL and residency board" });
    await expect(board).toBeVisible();
    const facts = await board.getByTestId("case-key-fact").allTextContents();
    expect(facts.length).toBeGreaterThan(0);
    for (const text of facts) expect(text).not.toMatch(/Within Maximum Residence|Awaiting return intent/);
  });
});

test.describe("I-348 ?student_id= opens that student's request", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });
  for (const slug of ["leave-of-absence", "readmission", "awol", "withdrawal"]) {
    test(`${slug}`, async ({ page }) => {
      await page.goto("/");
      const res = await getJson(page, `/api/process-cases?slug=${slug}`);
      const ended = new Set(["Closed", "Approved", "Expired", "Completed", "Denied", "Withdrawn", "Cancelled"]);
      const open = res.cases.find((c) => !ended.has(c.status));
      test.skip(!open, "no open request in the demo data");
      await page.goto(`/workflow/${slug}?show=open&student_id=${open.student.id}`);
      await expect(page.getByRole("dialog")).toContainText(open.student.name);
      await expect(page).not.toHaveURL(/student_id=/);
    });
  }
});
