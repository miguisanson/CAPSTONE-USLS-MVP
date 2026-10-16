// Page sweep: for each role, sign-in is reused from auth.setup.js, the sidebar is READ at runtime,
// and every link is visited at three viewports. Read-only: nothing is clicked except navigation.
import { test, expect } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AUTH_DIR, FINDINGS_DIR, SCREENS_DIR, SIGNIN_DIR } from "./support/paths.mjs";
import { ROLES } from "./support/accounts.js";
import { VIEWPORTS, attachWatchers, checkPage, formatProblems, stubExternal } from "./support/checker.js";

for (const entry of ROLES) {
  test.describe(`role ${entry.key}`, () => {
    test.use({ storageState: join(AUTH_DIR, `${entry.key}.json`) });

    test(`${entry.key}: every page loads cleanly`, async ({ page, context }) => {
      // Problems seen while auth.setup.js signed this role in (first requests on the fresh database).
      const signinFile = join(SIGNIN_DIR, `${entry.key}.json`);
      const signinProblems = existsSync(signinFile) ? JSON.parse(readFileSync(signinFile, "utf8")) : [];
      const tracker = { problems: [...signinProblems], writes: [], where: { role: entry.key, page: "(start)", viewport: 1366 } };
      await stubExternal(context);
      attachWatchers(page, tracker);

      // Discover the pages from the rendered navigation (desktop width, where the sidebar is visible).
      await page.setViewportSize(VIEWPORTS[0]);
      await page.goto(entry.home, { waitUntil: "load" });
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
      await expect(page.locator("aside nav a").first(), `${entry.key}: sidebar navigation did not render`).toBeVisible();
      const links = await page.locator("aside nav a[href]").evaluateAll((anchors) =>
        anchors.map((a) => ({ href: a.getAttribute("href"), label: (a.textContent || "").trim().replace(/\s+/g, " ") })),
      );
      const seen = new Set();
      const pages = links.filter((l) => l.href && l.href.startsWith("/") && !seen.has(l.href) && seen.add(l.href));
      console.log(`[${entry.key}] ${pages.length} pages: ${pages.map((p) => p.href).join(", ")}`);
      expect(pages.length, `${entry.key}: no navigation links found`).toBeGreaterThan(0);

      const outDir = join(SCREENS_DIR, entry.key);
      for (const link of pages) {
        for (const viewport of VIEWPORTS) {
          await checkPage(page, tracker, { role: entry.key, href: link.href, label: link.label, viewport, outDir });
        }
      }

      if (tracker.writes.length) {
        console.log(`[${entry.key}] note: pages made ${tracker.writes.length} non-GET API call(s): ${[...new Set(tracker.writes)].join("; ")}`);
      }
      console.log(`[${entry.key}] visited ${pages.length} pages x ${VIEWPORTS.length} viewports; screenshots in ${outDir}`);
      const report = formatProblems(tracker.problems);
      mkdirSync(FINDINGS_DIR, { recursive: true });
      writeFileSync(join(FINDINGS_DIR, `${entry.key}.txt`), `${entry.key}: ${pages.length} pages\n${report.join("\n")}\n`);
      if (report.length) {
        throw new Error(`${report.length} problem(s) for ${entry.key} across ${pages.length} pages (role | page | problem | widths | screenshot):\n${report.join("\n")}`);
      }
    });
  });
}
