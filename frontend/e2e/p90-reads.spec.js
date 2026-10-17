// Packet get-writes (I-038, I-039): opening a page must not write. A page view sends only GET requests to /api.
// Through the real UI: Leave of Absence and Readmission as staff and as admin (I-039 - they used to send
// POST /api/leave-cases/sync on load), and the faculty portal as the seeded adviser (I-038 - its first load used to
// create panel invitations). Nothing is clicked except the sidebar-less direct visit; the "Refresh leave dates" button
// is the explicit action that still sends the sync, and one test pins that it does.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);

/** Open `path`, wait for the page to settle, and return every non-GET /api request it sent. */
async function writesOnOpen(page, path) {
  const writes = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") && request.method() !== "GET") writes.push(`${request.method()} ${url.pathname}`);
  });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500); // an on-load call fires after the first board load
  return writes;
}

for (const role of ["staff", "admin"]) {
  test.describe(`I-039 ${role}: opening a leave page writes nothing`, () => {
    test.use({ storageState: authFile(role) });

    for (const [slug, heading] of [
      ["leave-of-absence", /Leave of Absence/i],
      ["readmission", /Readmission/i],
    ]) {
      test(`/workflow/${slug}`, async ({ page }) => {
        const writes = await writesOnOpen(page, `/workflow/${slug}`);
        await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
        expect(writes, "requests other than GET sent while the page opened").toEqual([]);
      });
    }
  });
}

test.describe("I-039 staff: Refresh leave dates is still an explicit action", () => {
  test.use({ storageState: authFile("staff") });

  test("clicking the button sends the sync", async ({ page }) => {
    await page.goto("/workflow/leave-of-absence");
    await page.waitForLoadState("networkidle");
    const button = page.getByRole("button", { name: /Refresh leave dates/i });
    await expect(button).toBeVisible();
    const sync = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith("/api/leave-cases/sync"));
    await button.click();
    await sync;
  });
});

test.describe("I-038 faculty: opening the faculty portal writes nothing", () => {
  test.use({ storageState: authFile("faculty") });

  for (const path of ["/faculty-portal", "/faculty-portal/invitations"]) {
    test(path, async ({ page }) => {
      const writes = await writesOnOpen(page, path);
      expect(writes, "requests other than GET sent while the page opened").toEqual([]);
    });
  }
});
