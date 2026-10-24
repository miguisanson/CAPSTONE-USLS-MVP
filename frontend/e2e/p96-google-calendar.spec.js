// R-015 / I-132. Faculty link status and unlinking live on My Availability.
// Google itself is not contacted: the browser test fixes the API contract and the real OAuth flow is covered by unittest.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SCREENS_DIR } from "./support/paths.mjs";
import { stubExternal } from "./support/checker.js";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const SHOTS = process.env.E2E_SHOTS_DIR || join(SCREENS_DIR, "..", "p96-google-calendar");
const WIDTHS = [[1366, 768], [1920, 1080], [390, 844]];

test.use({ storageState: authFile("faculty"), viewport: { width: 1366, height: 768 } });
test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ context }) => stubExternal(context));

async function screenshots(page, name) {
  for (const [width, height] of WIDTHS) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: join(SHOTS, `${name}-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
}

test("faculty sees the real linked account, checks it, then unlinks it without losing entered hours", async ({ page }) => {
  const contextResponse = await page.request.get("/api/faculty-portal/context");
  expect(contextResponse.ok()).toBe(true);
  const portal = await contextResponse.json();
  let calendar = {
    provider: "Google Calendar",
    connected: true,
    status: "Connected",
    connected_email: "real-owned-calendar@gmail.com",
    connected_at: "2026-10-24T08:00:00",
    last_synced_at: "2026-10-24T09:30:00",
    last_error: null,
  };
  const calls = [];

  await page.route("**/api/faculty-portal/context", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...portal, faculty: { ...portal.faculty, calendar } }),
    });
  });
  await page.route("**/api/faculty-portal/google-calendar/sync", async (route) => {
    calls.push(route.request().method());
    calendar = { ...calendar, last_synced_at: "2026-10-24T10:00:00", last_error: null };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(calendar) });
  });
  await page.route("**/api/faculty-portal/google-calendar", async (route) => {
    if (route.request().method() !== "DELETE") return route.fallback();
    calls.push("DELETE");
    calendar = {
      provider: "Google Calendar",
      connected: false,
      status: "Not connected",
      connected_email: null,
      connected_at: null,
      last_synced_at: null,
      last_error: null,
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ connected: false, revoked_at_google: true, calendar }),
    });
  });

  await page.goto("/faculty-portal/availability");
  await expect(page.getByRole("heading", { level: 1, name: "My Availability" })).toBeVisible();
  const card = page.getByRole("region", { name: "Google Calendar connection" });
  await expect(card).toContainText("Connected");
  await expect(card).toContainText("real-owned-calendar@gmail.com");
  await expect(card).toContainText(/Last checked/i);
  await expect(card.getByRole("button", { name: "Reconnect calendar" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Check calendar now" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Disconnect calendar" })).toBeVisible();
  await screenshots(page, "connected");

  await card.getByRole("button", { name: "Check calendar now" }).click();
  await expect(card).toContainText(/Last checked/i);
  expect(calls).toContain("POST");

  await card.getByRole("button", { name: "Disconnect calendar" }).click();
  const dialog = page.getByRole("dialog", { name: "Disconnect Google Calendar?" });
  await expect(dialog).toContainText("Your entered working hours and availability exceptions will stay in place.");
  await dialog.getByRole("button", { name: "Disconnect calendar" }).click();
  await expect(card).toContainText("Not connected");
  await expect(card.getByRole("button", { name: "Connect Google Calendar" })).toBeVisible();
  expect(calls).toContain("DELETE");
});
