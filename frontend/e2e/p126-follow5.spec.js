// e2e-writes: none
// Packet P-H: the frontend follows the server's Withdrawal / Graduation change (Dean approval tags the subject, then Send and
// Acknowledge) and the Research Coordinator home's "Waiting on others".
//   - guide data (no browser): the Withdrawal guide has no staff tag step, and a send step after the export;
//   - status colours: the Registrar-received words have a colour;
//   - Withdrawal board: an exported card offers "Mark as sent to the Registrar" (the server's own move list);
//   - Research Coordinator home: "Waiting on others" lists research_waiting (3 at most) with "View all".
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";
import { GUIDES } from "../src/lib/demoGuide/guides/index.js";
import { STATUS_TONE } from "../src/lib/status.js";

const withdrawal = GUIDES.find((guide) => guide.id === "withdrawal");

test.describe("guide data and status words", () => {
  test("the Withdrawal guide has no staff tag step; a send step follows the export", () => {
    const ids = withdrawal.steps.filter((step) => !step.side).map((step) => step.id);
    expect(ids).toEqual(["wd-file", "wd-forward", "wd-decide", "wd-export", "wd-send", "wd-result"]);
    const everyAction = JSON.stringify(withdrawal.steps.map((step) => step.actions));
    expect(everyAction).not.toContain("Tag the subject as Withdrawn");
    expect(everyAction).toContain("Mark as sent to the Registrar");
    const send = withdrawal.steps.find((step) => step.id === "wd-send");
    expect(send.role).toBe("staff");
    expect(send.doneWhen.status[0]).toBe("Sent to Registrar");
    const decide = withdrawal.steps.find((step) => step.id === "wd-decide");
    expect(decide.doneWhen.status[0], "approval tags the subject at once").toBe("Subject Tagged - Registrar Preparation");
  });

  test("the Registrar statuses have a colour", () => {
    for (const status of ["Sent to Registrar", "Withdrawn Confirmed", "Registrar Received"]) {
      expect(STATUS_TONE[status.toLowerCase()], status).toBe("done");
    }
  });
});

test.describe("staff Withdrawal board", () => {
  test.use({ storageState: join(AUTH_DIR, "staff.json"), viewport: { width: 1366, height: 768 } });

  test("an exported card offers Mark as sent to the Registrar", async ({ page }) => {
    const exported = (item) => ({
      ...item,
      status: "Exported - Ready to Send",
      status_label: "Exported - email to the Registrar",
      actions: [
        { action: "send", label: "Mark as sent to the Registrar", to: "Sent to Registrar", targets: ["Sent to Registrar"], needs_comment: false, tone: "primary", batch: true, confirm: "Use this after the Excel list was emailed to the Registrar.", opens: "" },
      ],
    });
    await page.route(/\/api\/process-cases\?slug=withdrawal/, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      json.cases = json.cases.map((item) => (item.student.name === "Adrian Lim" ? exported(item) : item));
      await route.fulfill({ response, json });
    });
    await page.route(/\/api\/process-cases\/withdrawal\/\d+$/, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      if (json.case?.student?.name === "Adrian Lim") json.case = exported(json.case);
      await route.fulfill({ response, json });
    });
    await page.goto("/workflow/withdrawal");
    await page.getByRole("button", { name: "View details for Adrian Lim" }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Mark as sent to the Registrar" })).toBeVisible();
  });
});

test.describe("Research Coordinator home", () => {
  test.use({ storageState: join(AUTH_DIR, "research-coordinator.json"), viewport: { width: 1366, height: 768 } });

  test("Waiting on others lists the students waiting on a panel verdict, with View all", async ({ page }) => {
    await page.route(/\/api\/dashboard(\?|$)/, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      json.research_waiting = {
        total: 5,
        items: ["Ana Reyes", "Ben Cruz", "Carla Diaz"].map((name, i) => ({
          student_id: 900 + i, student_name: name, stage: "Proposal Defense", reason: "Waiting for the panel verdict", to: "/workflow/research-gate",
        })),
        view_all: "/workflow/research-gate",
      };
      await route.fulfill({ response, json });
    });
    await page.goto("/");
    const waiting = page.locator("main section", { has: page.getByRole("heading", { name: "Waiting on others", exact: true }) });
    await expect(waiting.getByText("Ana Reyes")).toBeVisible();
    await expect(waiting.getByText("Carla Diaz")).toBeVisible();
    expect(await waiting.locator("li").count()).toBeLessThanOrEqual(3);
    await expect(waiting.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/workflow/research-gate");
  });
});

// I-324: Graduation staff moves after the Dean's export (same words as the Withdrawal board).
test.describe("staff Graduation board", () => {
  test.use({ storageState: join(AUTH_DIR, "staff.json"), viewport: { width: 1366, height: 768 } });
  const BATCH = "Batch 1 October 2026";
  const mock = (page, status, registrar) =>
    page.route(/\/api\/transactions\/graduation\/context/, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      const isabel = json.roster.find((row) => row.student.name === "Isabel Flores");
      isabel.has_submitted_documents = false;
      isabel.endorsement = { ...isabel.endorsement, batch_name: BATCH, endorsement_status: status, display_status: status, registrar_status: registrar };
      await route.fulfill({ response, json });
    });

  test("an exported batch offers Mark as sent; a sent batch offers Registrar acknowledged", async ({ page }) => {
    const posts = [];
    await page.route(/\/api\/transactions\/graduation$/, async (route) => {
      posts.push(JSON.parse(route.request().postData() || "{}").endorsement_status);
      await route.fulfill({ json: { message: "Spec: saved." } });
    });
    await mock(page, "Dean Approved", "Exported - Ready to Send");
    await page.goto("/workflow/graduation");
    const send = page.getByRole("button", { name: "Mark as sent to the Registrar" });
    await expect(send).toHaveCount(1);
    await send.click();
    await expect.poll(() => posts).toEqual(["Sent to Registrar"]);

    await page.unroute(/\/api\/transactions\/graduation\/context/);
    await mock(page, "Sent to Registrar", "Sent to Registrar");
    await page.reload();
    await expect(page.getByRole("button", { name: "Registrar acknowledged" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Mark as sent to the Registrar" })).toHaveCount(0);
  });
});
