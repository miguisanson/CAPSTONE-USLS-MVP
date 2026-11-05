// e2e-writes: none
// I-006: Defense Scheduling "Change panel" lists each existing member under the role that member holds (not by position).
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

test.use({ storageState: join(AUTH_DIR, "research-coordinator.json"), viewport: { width: 1366, height: 900 } });
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: "ignoreErrors" }); });

test("Change panel shows each member under their own role, whatever order the server lists them", async ({ page }) => {
  let panel = [];
  await page.route(/\/api\/transactions\/defense-scheduling\/context/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.assigned_panel = [...body.assigned_panel].reverse();
    panel = body.assigned_panel;
    await route.fulfill({ response, json: body });
  });
  await page.goto("/workflow/defense-scheduling?student_id=146");
  await page.getByRole("button", { name: "Change panel" }).click();
  expect(panel.length).toBeGreaterThan(1);
  const seats = await page.locator("main label").allTextContents();
  for (const member of panel.filter((m) => seats.some((t) => t.startsWith(m.panel_role)))) {
    const select = page.locator("main label", { hasText: member.panel_role }).locator("select").first();
    await expect(select, `${member.panel_role} shows ${member.faculty_name}`).toHaveValue(String(member.faculty_id));
  }
});

// I-371: the graduation stage check finishes the export step once the list is exported, and "Sent to the Registrar" at Sent.
test.describe("I-371 graduation stage check after the Dean's yes", () => {
  test.use({ storageState: join(AUTH_DIR, "dean.json"), viewport: { width: 1366, height: 900 } });
  const BATCH = "Batch 1 October 2026";
  const cases = [
    ["approved, not exported", { endorsement_status: "Dean Approved", registrar_status: "Pending" }, ["Complete", "Current", "Pending"]],
    ["exported", { endorsement_status: "Dean Approved", registrar_status: "Exported - Ready to Send" }, ["Complete", "Complete", "Current"]],
    ["sent to the Registrar", { endorsement_status: "Sent to Registrar", registrar_status: "Sent to Registrar" }, ["Complete", "Complete", "Complete"]],
  ];
  for (const [name, fields, last3] of cases) {
    test(name, async ({ page }) => {
      await page.route(/\/api\/transactions\/graduation\/context/, async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        body.roster.forEach((row) => { row.endorsement = { ...(row.endorsement || {}), batch_name: null }; });
        const row = body.roster.find((item) => item.student.name === "Isabel Flores");
        row.endorsement = { ...(row.endorsement || {}), batch_name: BATCH, ...fields, display_status: fields.endorsement_status };
        await route.fulfill({ response, json: body });
      });
      await page.goto("/dean/approvals/graduation?tab=batches");
      await page.getByRole("button", { name: `View details for ${BATCH}` }).first().click();
      const dialog = page.getByRole("dialog");
      const steps = ["Dean reviews graduation batch", "Export Dean-approved list", "Sent to the Registrar"];
      const expected = [last3[0], last3[1], last3[2]];
      for (const [i, label] of steps.entries()) {
        const item = dialog.getByRole("listitem").filter({ hasText: label });
        await expect(item, label).toHaveCount(1);
        await expect(item, `${label} is ${expected[i]}`).toContainText(expected[i]);
      }
    });
  }
});
