// e2e-writes: none
// Packet stu6 (I-425 one "subjects left" wording, I-426 what happens after a withdrawal request, I-428 graduation page starts with what is left).
import { test, expect } from "@playwright/test";
import { BASE_URL } from "./support/paths.mjs";
import { PASSWORD } from "./support/accounts.js";

const LEFT = /\d+ subjects? left: \d+ this semester, \d+ still to take/;

async function open(browser, path, mutate = () => {}) {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1366, height: 768 } });
  const res = await context.request.post("/api/auth/login", { data: { email: "withdrawal.elena@usls.edu.ph", password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  await context.route("**/api/student-portal/context", async (route) => {
    const response = await route.fetch(); const data = await response.json();
    mutate(data);
    await route.fulfill({ response, json: data });
  });
  const page = await context.newPage();
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  return { context, page };
}

test.describe("stu6 student wording", () => {
  test("I-425 home, My Progress and Request Center say the same thing about subjects left", async ({ browser }) => {
    const seen = [];
    for (const path of ["/student", "/student/progress", "/student/requests"]) {
      const { context, page } = await open(browser, path);
      const text = await page.locator("main").innerText();
      const m = text.match(LEFT);
      expect(m, `${path} has the subjects-left sentence`).not.toBeNull();
      seen.push(m[0]);
      expect(text).not.toMatch(/still to complete|\d+ missing/);
      await context.close();
    }
    expect(new Set(seen).size, `same sentence everywhere: ${seen.join(" | ")}`).toBe(1);
  });

  test("I-426 Subject Withdrawal says what happens after sending (nothing is submitted)", async ({ browser }) => {
    const { context, page } = await open(browser, "/student/requests/withdrawal");
    const note = page.getByTestId("withdrawal-next");
    await expect(note).toContainText("Graduate School staff check the request");
    await expect(note).toContainText("Dean");
    await expect(note).toContainText("Business Office");
    await expect(page.locator("main")).not.toContainText("term's total due");
    await context.close();
  });

  test("I-428 Graduation Endorsement starts with What is left, folded after 5", async ({ browser }) => {
    const { context, page } = await open(browser, "/student/graduation", (d) => {
      d.graduation_eligibility = { ...(d.graduation_eligibility || {}), eligible: false, missing_coursework: ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10"], missing_research_requirements: [], missing_practicum_requirement: "" };
    });
    const box = page.getByText("What is left (10)");
    await expect(box).toBeVisible();
    const top = await box.boundingBox();
    expect(top.y).toBeLessThan(300);
    await expect(page.getByText("Coursework: A5")).toBeVisible();
    await expect(page.getByText("Coursework: A6")).toHaveCount(0);
    await page.getByRole("button", { name: "Show all 10" }).click();
    await expect(page.getByText("Coursework: A10")).toBeVisible();
    const main = page.locator("main");
    await expect(main).toContainText("The Dean sends the list to the Registrar");
    await expect(main).not.toContainText("Dean Emails List and Waits");
    await context.close();
  });
});
