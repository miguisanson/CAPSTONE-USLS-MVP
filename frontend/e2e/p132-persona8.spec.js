// e2e-writes: none
// Packet persona8 (I-390, I-391): the faculty portal at 683x384 (1366x768 at 200 % zoom) and plain words. Red first.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

test.use({ storageState: join(AUTH_DIR, "faculty.json"), viewport: { width: 683, height: 384 } });

const ROUTES = ["", "/advisees", "/signatures", "/panels", "/invitations", "/defenses", "/calendar", "/availability", "/verdicts", "/classes"];

test("I-390a: no faculty page needs sideways scrolling at 683 px", async ({ page }) => {
  const wide = [];
  for (const route of ROUTES) {
    await page.goto(`/faculty-portal${route}`);
    await page.waitForLoadState("networkidle");
    const found = await page.evaluate(() => {
      const out = [];
      if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push("page");
      document.querySelectorAll("table").forEach((table) => {
        const box = table.closest(".overflow-x-auto");
        if (box && box.scrollWidth > box.clientWidth + 1) out.push("table");
      });
      return out;
    });
    if (found.length) wide.push(`${route || "/"}: ${found.join(",")}`);
  }
  expect(wide).toEqual([]);
});

test("I-390b: the breadcrumb is whole and clear of the name badge", async ({ page }) => {
  for (const route of ["/signatures", "/panels"]) {
    await page.goto(`/faculty-portal${route}`);
    await page.waitForLoadState("networkidle");
    const crumb = page.getByRole("navigation", { name: "Breadcrumb" });
    const cut = await crumb.locator("[aria-current=page]").evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(cut, `${route} breadcrumb is cut`).toBe(false);
    const gap = await page.evaluate(() => {
      const nav = document.querySelector("nav[aria-label=Breadcrumb]").getBoundingClientRect();
      const badge = [...document.querySelectorAll("header span")].find((el) => el.title && el.offsetParent !== null);
      return badge ? badge.getBoundingClientRect().left - nav.right : 99;
    });
    expect(gap, `${route} gap to badge`).toBeGreaterThanOrEqual(8);
  }
});

test("I-390c: at a short height the menu still shows most links and scrolls to the rest", async ({ page }) => {
  await page.goto("/faculty-portal");
  await page.getByRole("button", { name: "Open menu" }).click();
  const nav = page.getByRole("dialog").locator("nav").last();
  const box = await nav.evaluate((el) => ({ h: el.clientHeight, sh: el.scrollHeight }));
  expect(box.h, "nav height").toBeGreaterThanOrEqual(220);
  if (box.sh > box.h) {
    await nav.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(nav.getByRole("link", { name: /Business Rules/ })).toBeInViewport();
  }
});

test("I-391: advisee rows show no 'None' / 'Not applicable'", async ({ page }) => {
  await page.goto("/faculty-portal/advisees");
  await page.waitForLoadState("networkidle");
  const main = page.locator("main");
  await expect(main).not.toContainText(/Needs signature\s*None/i);
  await expect(main).not.toContainText("Not applicable");
});

test("I-391: availability does not claim it was just saved", async ({ page }) => {
  await page.route("**/api/faculty-portal/availability", async (route) => {
    const res = await route.fetch(); const data = await res.json();
    data.entered = true; data.updated_at = null;
    data.working_hours = [0, 1, 2].map((weekday) => ({ weekday, enabled: true, start: "09:00", end: "12:00" }));
    await route.fulfill({ response: res, json: data });
  });
  await page.goto("/faculty-portal/availability");
  await expect(page.getByText("Weekly hours on file: 3 days a week.")).toBeVisible();
  await expect(page.getByText("Availability entered.")).toHaveCount(0);
});

test("I-391: an accepted invitation offers 'Withdraw my acceptance' with a confirm", async ({ page }) => {
  let posted = null;
  await page.route("**/api/faculty-portal/panel-invitations", async (route) => {
    await route.fulfill({ json: { invitations: [{ id: 2, status: "Accepted", defense_type: "Final Defense", panel_role: "Panel Chair",
      student: { id: 2, name: "Mock Accepted", program_code: "MAED", student_number: "MK-02" }, other_members: [], schedule: null }] } });
  });
  await page.route("**/api/faculty-portal/panel-invitations/2/respond", async (route) => { posted = route.request().postDataJSON(); await route.fulfill({ json: {} }); });
  await page.goto("/faculty-portal/invitations");
  const card = page.getByRole("listitem").filter({ hasText: "Mock Accepted" });
  await expect(card.getByRole("button", { name: "Decline" })).toHaveCount(0);
  await card.getByRole("button", { name: "Withdraw my acceptance" }).click();
  await expect(card).toContainText("asked to find a replacement");
  await card.getByLabel(/Why are you withdrawing/).fill("Clash with another defense");
  await card.getByRole("button", { name: "Confirm withdrawal" }).click();
  await expect.poll(() => posted).toMatchObject({ response: "decline" });
});
