// e2e-writes: none
// Packet ux6 (I-415 focus after navigation, I-398 panel consent line, I-399 Graduation phone order, I-405 student record). Red first.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);

test.describe("I-415 focus moves to the page after a sidebar link", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 800 } });

  test("Enter on a sidebar link puts the focus on the new page, not on the sidebar", async ({ page }) => {
    await page.goto("/");
    const link = page.locator("aside nav a", { hasText: "Students" }).first();
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Students" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => {
      const el = document.activeElement;
      return Boolean(el && (el.id === "main-content" || el.closest("main")) && !el.closest("aside"));
    })).toBe(true);
  });

  test("a query-string change does not pull the focus away", async ({ page }) => {
    await page.goto("/students");
    const search = page.getByRole("searchbox").first();
    await expect(search).toBeVisible();
    await search.focus();
    await search.fill("a");
    await page.waitForTimeout(600);
    await expect(search).toBeFocused();
  });
});

test.describe("I-399 Dean phone Graduation", () => {
  test.use({ storageState: authFile("dean"), viewport: { width: 390, height: 844 } });

  test("the Needs my action chip comes before the filters and the waiting batch shows", async ({ page }) => {
    await page.goto("/dean/approvals/graduation");
    await expect(page.getByRole("heading", { level: 1, name: "Graduation Endorsement" })).toBeVisible();
    const chip = page.getByRole("button", { name: /^Needs my action/ });
    await expect(chip).toBeVisible();
    const chipTop = (await chip.boundingBox()).y;
    const filterTop = (await page.getByRole("searchbox").first().boundingBox()).y;
    expect(chipTop, "chips sit above the filters").toBeLessThan(filterTop);
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("stage-board").locator("[data-card-id]").first()).toBeVisible();
    expect((await page.getByTestId("stage-board").locator("[data-card-id]").first().boundingBox()).y).toBeLessThan(844);
  });
});

test.describe("I-398 panel consent line", () => {
  test.use({ storageState: authFile("faculty"), viewport: { width: 1366, height: 800 } });

  test("the invitation says what Accept means and shows the server's answer", async ({ page }) => {
    await page.route("**/api/faculty-portal/panel-invitations", (route) => route.request().method() === "GET"
      ? route.fulfill({ json: { invitations: [{ id: 1, status: "Invited", defense_type: "Final Defense", panel_role: "Content Specialist", student: { id: 4, name: "Miguel Yu", program_code: "MAED", student_number: "2260004" }, other_members: [], schedule: null }] } })
      : route.continue());
    await page.route("**/api/faculty-portal/panel-invitations/1/respond", (route) => route.fulfill({ status: 409, json: { error: "This invitation was declined. Ask the Research Coordinator to send the invitation again." } }));
    await page.goto("/faculty-portal/invitations");
    const card = page.getByRole("listitem").filter({ hasText: "Miguel Yu" });
    await expect(card).toContainText("Accept records your consent to sit on this panel (form GS-P-03). It is not your verdict. You can still withdraw later");
    await expect(card).not.toContainText("electronic approval");
    await card.getByRole("button", { name: "Accept" }).click();
    await expect(card).toContainText("This invitation was declined. Ask the Research Coordinator to send the invitation again.");
  });
});

test.describe("I-405 student record", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 900 } });

  test("no New Student chip at Data Collection; Show subjects is a button", async ({ page }) => {
    await page.route("**/api/students/1", async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      json.student.current_stage = "Data Collection";
      json.student.monitoring_new_student = true;
      await route.fulfill({ response, json });
    });
    await page.goto("/students/1");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(page.getByText("Data Collection").first()).toBeVisible();
    await expect(page.getByText("New Student", { exact: true })).toHaveCount(0);
    const show = page.getByRole("button", { name: "Show subjects" }).first();
    await expect(show).toBeVisible();
    await show.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Hide subjects" }).first()).toBeVisible();
  });
});
