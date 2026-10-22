// Packet P8.1 (issues I-103, I-101, I-112): the app shell.
// Written BEFORE the change; red on the old code. Through the real UI, read only:
//   - I-103  at 1366x768 every sidebar link of every role can be reached: the nav area scrolls between the brand and the
//            role footer, the footer stays below it, nothing in the nav is hidden under the footer, and the page you are on is
//            scrolled into view in the sidebar when the page loads (the last items used to be cut off with no sign of them);
//            the phone menu (drawer) obeys the same rule on a short screen;
//   - I-101  a role that may open Course Audit (staff, academic coordinator, administrator) has a sidebar link for it,
//            between "3 · Enrollment" and "4 · Research Gate", and it opens the page; the other roles do not get the link;
//   - I-112  the faculty pages' titles use the one-name table (Title Case) and Research Gate's title is "Research Gate".
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";
import { ROLES } from "./support/accounts.js";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);
const norm = (text) => (text || "").replace(/\s+/g, " ").trim();

/** For every link in the visible sidebar: scroll it into view, then check that what is at its centre is the link itself. */
async function unreachableLinks(page) {
  const links = page.locator("aside:visible nav a");
  const count = await links.count();
  const problems = [];
  for (let i = 0; i < count; i++) {
    const link = links.nth(i);
    await link.scrollIntoViewIfNeeded();
    const result = await link.evaluate((a) => {
      const rect = a.getBoundingClientRect();
      const nav = a.closest("nav").getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const top = document.elementFromPoint(x, y);
      return {
        href: a.getAttribute("href"),
        label: (a.textContent || "").replace(/\s+/g, " ").trim(),
        onTop: Boolean(top && (top === a || a.contains(top))),
        insideNav: rect.top >= nav.top - 1 && rect.bottom <= nav.bottom + 1,
        insideViewport: rect.top >= 0 && rect.bottom <= window.innerHeight,
      };
    });
    if (!result.onTop) problems.push(`${result.href} "${result.label}": something else covers the link`);
    else if (!result.insideNav) problems.push(`${result.href} "${result.label}": the link is outside the nav area`);
    else if (!result.insideViewport) problems.push(`${result.href} "${result.label}": the link is outside the window`);
  }
  return problems;
}

/** The footer block is below the nav and inside the window. */
async function footerBelowNav(page) {
  return page.locator("aside:visible").first().evaluate((aside) => {
    const nav = aside.querySelector("nav").getBoundingClientRect();
    const footer = [...aside.querySelectorAll("div")].find((el) => el.classList.contains("border-t") && /Graduate School Staff|Dean|Student|Faculty|Administrator|Coordinator/.test(el.textContent || ""));
    if (!footer) return { found: false };
    const rect = footer.getBoundingClientRect();
    return { found: true, belowNav: rect.top >= nav.bottom - 1, inWindow: rect.bottom <= window.innerHeight + 1 };
  });
}

test.describe("I-103: every sidebar link is reachable at 1366x768", () => {
  for (const entry of ROLES) {
    test.describe(entry.key, () => {
      test.use({ storageState: authFile(entry.key), viewport: { width: 1366, height: 768 } });

      test(`${entry.key}: each link can be scrolled into view and is not covered; the footer stays below the nav`, async ({ page }) => {
        await page.goto(entry.home);
        await expect(page.locator("aside:visible nav a").first()).toBeVisible();
        await page.waitForLoadState("networkidle").catch(() => {});
        const problems = await unreachableLinks(page);
        expect(problems, problems.join("\n")).toEqual([]);
        const footer = await footerBelowNav(page);
        expect(footer.found, "the role footer block exists").toBe(true);
        expect(footer.belowNav, "the footer is below the nav area").toBe(true);
        expect(footer.inWindow, "the footer is inside the window").toBe(true);
      });

      test(`${entry.key}: the page you are on is visible in the sidebar when it loads`, async ({ page }) => {
        await page.goto(entry.home);
        await expect(page.locator("aside:visible nav a").first()).toBeVisible();
        const hrefs = await page.locator("aside:visible nav a").evaluateAll((anchors) => anchors.map((a) => a.getAttribute("href")));
        const problems = [];
        for (const href of hrefs) {
          await page.goto(href);
          const active = page.locator('aside:visible nav a[aria-current="page"]').first();
          await active.waitFor({ state: "attached", timeout: 15_000 }).catch(() => {});
          if ((await active.count()) === 0) {
            problems.push(`${href}: no link is marked as the current page`);
            continue;
          }
          // The sidebar scrolls the current page into view in a moment (after the page's first paint).
          const visible = await expect
            .poll(
              () =>
                active.evaluate((a) => {
                  const rect = a.getBoundingClientRect();
                  const nav = a.closest("nav").getBoundingClientRect();
                  return rect.top >= nav.top - 1 && rect.bottom <= nav.bottom + 1;
                }),
              { timeout: 3_000 },
            )
            .toBe(true)
            .then(
              () => true,
              () => false,
            );
          if (!visible) problems.push(`${href}: the current page's link is scrolled out of sight in the sidebar`);
        }
        expect(problems, problems.join("\n")).toEqual([]);
      });
    });
  }
});

test.describe("I-103: the phone menu (drawer) on a short screen", () => {
  test.use({ storageState: authFile("staff"), viewport: { width: 390, height: 640 } });

  test("every link in the menu can be reached and the footer stays below the nav", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.locator("aside:visible nav a").first()).toBeVisible();
    await page.waitForTimeout(500); // the panel's fade-up
    const problems = await unreachableLinks(page);
    expect(problems, problems.join("\n")).toEqual([]);
    const footer = await footerBelowNav(page);
    expect(footer.found, "the role footer block exists").toBe(true);
    expect(footer.belowNav, "the footer is below the nav area").toBe(true);
    expect(footer.inWindow, "the footer is inside the window").toBe(true);
  });
});

test.describe("I-101: Course Audit has a sidebar entry for the roles that may open it", () => {
  for (const key of ["staff", "academic-coordinator", "admin"]) {
    test.describe(key, () => {
      test.use({ storageState: authFile(key), viewport: { width: 1366, height: 768 } });

      test(`${key}: a Course Audit link sits between Enrollment and Research Gate and opens the page`, async ({ page }) => {
        const entry = ROLES.find((r) => r.key === key);
        await page.goto(entry.home);
        await expect(page.locator("aside:visible nav a").first()).toBeVisible();
        const labels = (await page.locator("aside:visible nav a").allInnerTexts()).map(norm);
        const audit = labels.findIndex((label) => /^Course Audit/.test(label));
        expect(audit, `sidebar: ${labels.join(" | ")}`).toBeGreaterThanOrEqual(0);
        const enrollment = labels.findIndex((label) => /^3 · Enrollment/.test(label));
        const gate = labels.findIndex((label) => /^4 · Research Gate/.test(label));
        expect(audit).toBeGreaterThan(enrollment);
        expect(audit).toBeLessThan(gate);
        await page.locator("aside:visible nav a", { hasText: /^\s*Course Audit/ }).click();
        await expect(page).toHaveURL(/\/workflow\/course-audit$/);
        await expect(page.locator("main").getByRole("heading", { level: 1, name: "Course Audit", exact: true })).toBeVisible();
        const crumbs = (await page.locator('nav[aria-label="Breadcrumb"] li').allInnerTexts()).map(norm);
        expect(crumbs[crumbs.length - 1]).toBe("Course Audit");
        await expect(page.locator('aside:visible nav a[aria-current="page"]')).toContainText("Course Audit");
      });
    });
  }

  for (const key of ["student", "faculty", "dean", "research-coordinator"]) {
    test.describe(key, () => {
      test.use({ storageState: authFile(key), viewport: { width: 1366, height: 768 } });

      test(`${key}: no Course Audit link (the role may not open it)`, async ({ page }) => {
        const entry = ROLES.find((r) => r.key === key);
        await page.goto(entry.home);
        await expect(page.locator("aside:visible nav a").first()).toBeVisible();
        const labels = (await page.locator("aside:visible nav a").allInnerTexts()).map(norm);
        expect(labels.filter((label) => /Course Audit/.test(label))).toEqual([]);
      });
    });
  }
});

test.describe("I-112: titles follow the one-name table", () => {
  test.describe("faculty", () => {
    test.use({ storageState: authFile("faculty"), viewport: { width: 1366, height: 768 } });
    for (const [path, title] of [
      ["/faculty-portal/invitations", "Panel Invitations"],
      ["/faculty-portal/calendar", "My Calendar"],
      ["/faculty-portal/availability", "My Availability"],
    ]) {
      test(`${path} is titled "${title}" exactly`, async ({ page }) => {
        await page.goto(path);
        const h1 = page.locator("main h1").first();
        await expect(h1).toBeVisible();
        expect(norm(await h1.innerText())).toBe(title);
      });
    }
  });

  test.describe("staff", () => {
    test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });
    test("Research Gate is titled \"Research Gate\" exactly", async ({ page }) => {
      await page.goto("/workflow/research-gate");
      const h1 = page.locator("main h1").first();
      await expect(h1).toBeVisible();
      expect(norm(await h1.innerText())).toBe("Research Gate");
    });
  });
});
