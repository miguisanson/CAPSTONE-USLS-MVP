// e2e-writes: none
// Packet lists5 (I-406, I-410, I-411). Red first.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const main = (page) => page.locator("main");
const CODE = /\b(enrollment|dropping|withdrawal|loa)\.[a-z_]+\b/;

test.describe("Students list", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 1093, height: 614 } });

  test("I-406: the last column is on screen at 1093 px", async ({ page }) => {
    await page.goto("/students");
    const header = main(page).getByRole("columnheader", { name: "Adviser" });
    await expect(header).toBeVisible();
    const box = await header.boundingBox();
    expect(box.x + box.width, "Adviser header right edge").toBeLessThanOrEqual(1093);
  });

  test("I-411: plain words in the check banner; the Compre hint names the exam", async ({ page }) => {
    await page.goto("/students");
    await expect(main(page).getByRole("columnheader", { name: "Compre exam" })).toBeVisible();
    await expect(main(page).getByText("synchronized")).toHaveCount(0);
    await expect(main(page).getByText(/to finish$/)).toHaveCount(0);
    await expect(main(page).getByText(/Compre: eligible after \d+ more subjects?/).first()).toBeVisible();
  });
});

test.describe("Business Rules, Academic Coordinator", () => {
  test.use({ storageState: authFile("academic-coordinator"), viewport: { width: 1366, height: 900 } });

  test("I-410: no rule codes, no 'Documented only' or 'Not enforced'", async ({ page }) => {
    await page.goto("/business-rules");
    await expect(main(page).getByText(/^Source: /).first()).toBeVisible();
    await expect(main(page).getByText(CODE)).toHaveCount(0);
    await expect(main(page).getByText("Documented only")).toHaveCount(0);
    await expect(main(page).getByText(/Not enforced/)).toHaveCount(0);
    await expect(main(page).getByText("Not checked by the system").first()).toBeVisible();
  });
});

test.describe("Business Rules, admin", () => {
  test.use({ storageState: authFile("admin"), viewport: { width: 1366, height: 900 } });

  test("I-410: the admin still sees rule codes", async ({ page }) => {
    await page.goto("/business-rules");
    await expect(main(page).getByText(CODE).first()).toBeVisible();
  });
});
