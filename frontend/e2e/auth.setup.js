// Signs in once per role through the real Login page (typing into the form, pressing Sign in) and
// saves the session with storageState, so the sweep reuses it. Not an API call.
import { test as setup, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, SIGNIN_DIR } from "./support/paths.mjs";
import { attachWatchers } from "./support/checker.js";
import { PASSWORD, ROLES, emailOf } from "./support/accounts.js";

const wanted = process.env.E2E_NEGATIVE === "1" ? ROLES.filter((r) => r.key === "admin") : ROLES;

for (const entry of wanted) {
  setup(`sign in as ${entry.key}`, async ({ page }) => {
    // Created here, not at load: the webServer command clears these folders when it starts.
    mkdirSync(AUTH_DIR, { recursive: true });
    mkdirSync(SIGNIN_DIR, { recursive: true });
    const email = emailOf(entry);
    expect(email, `no login e-mail known for ${entry.key}`).toBeTruthy();
    // Sign-in is the first request each account ever makes, so problems here (a first-load race, a 500 on a
    // fresh database) are real findings. They are saved and added to this role's sweep report.
    const tracker = { problems: [], writes: [], where: { role: entry.key, page: "sign-in and first landing page", viewport: 1366 } };
    attachWatchers(page, tracker);
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: /^\s*Sign in\s*$/ }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
    await expect(page.locator("aside nav a").first()).toBeVisible({ timeout: 30_000 });
    const me = await page.request.get("/api/auth/me");
    const body = await me.json();
    expect(body.user?.role, `signed in as ${email}`).toBe(entry.role);
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    writeFileSync(join(SIGNIN_DIR, `${entry.key}.json`), JSON.stringify(tracker.problems));
    // UX-27 (Phase 5a): the sidebar groups fold, and a person's open/closed choice is remembered in localStorage. The specs
    // that reuse this session reach pages through the sidebar, so the saved session has every group opened - the choice a
    // person makes once. Folding itself is tested from a fresh browser (p152-ux-phase5a).
    await page.evaluate((role) => {
      const groups = ["Overview", "Records", "Lifecycle Workflows", "Standalone Processes", "Monitoring & support", "Approvals",
        "Monitoring & Support", "Advising & Research", "Teaching", "Support", "Academics", "Research", "Requests"];
      window.localStorage.setItem(`usls.nav.groups.${role}`, JSON.stringify(Object.fromEntries(groups.map((label) => [label, true]))));
    }, entry.role);
    await page.context().storageState({ path: join(AUTH_DIR, `${entry.key}.json`) });
  });
}
