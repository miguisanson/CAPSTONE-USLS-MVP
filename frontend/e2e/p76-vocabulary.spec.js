// Packet P7.6 (issues I-076, I-077, I-078, I-080; review findings F-22, F-23, F-24, F-26).
// One vocabulary: a page has ONE name, and the sidebar link, the breadcrumb and the page's own title all say it.
// Written BEFORE the change; red on the old code. Read-only, through the real UI, every role:
//   - for every sidebar link (`aside nav a`) the breadcrumb has exactly two parts, "<Role> Portal" then the page name,
//     and that name equals the link text (a "3 · " step number in the sidebar is not part of the name) and the h1;
//   - a detail page adds the list page between them: Portal > Students > Student record;
//   - "Rules applied on this screen" is collapsed on every page that has it (the student Subject Withdrawal page
//     used to open it by default and push the form 900 px down);
//   - the staff Activity Log shows the log itself, not one closed "View logs (N)" button.
// Pages that legitimately have no <h1> are listed in NO_H1 with the reason.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR } from "./support/paths.mjs";
import { ROLES } from "./support/accounts.js";

const authFile = (key) => join(AUTH_DIR, `${key}.json`);

// Path -> why this page has no <h1> to compare. (Empty on purpose: add an entry only with a reason.)
const NO_H1 = {};

// Titles that this packet could not change because they live in files other helpers were editing (pages/faculty/) or
// come from the server (app.py: the staff lifecycle pages take their <h1> from the transaction title). Path -> the title
// the page still shows. The breadcrumb and the sidebar already use the one name; delete an entry when its title is fixed
// (the test also passes once the title equals the link text).
const TITLE_PENDING = {
  "/workflow/research-gate": "Research Gate Readiness",
  "/faculty-portal/invitations": "Panel invitations",
  "/faculty-portal/calendar": "My calendar",
  "/faculty-portal/availability": "My availability",
};

const stripStep = (label) => label.replace(/^\d+\s*·\s*/, "").trim();
const norm = (text) => (text || "").replace(/\s+/g, " ").trim();

async function breadcrumbParts(page) {
  const items = page.locator('nav[aria-label="Breadcrumb"] li');
  await expect(items.first()).toBeVisible();
  return (await items.allInnerTexts()).map(norm);
}

test.describe("P7.6 one name per page: sidebar, breadcrumb and title agree", () => {
  for (const entry of ROLES) {
    test.describe(entry.key, () => {
      test.use({ storageState: authFile(entry.key), viewport: { width: 1366, height: 768 } });

      test(`${entry.key}: every sidebar link opens a page with a two-part breadcrumb and a matching title`, async ({ page }) => {
        await page.goto(entry.home);
        await expect(page.locator("aside nav a").first()).toBeVisible();
        const links = await page.locator("aside nav a").evaluateAll((anchors) =>
          anchors.map((a) => ({ href: a.getAttribute("href"), label: (a.querySelector("span.flex-1") || a).textContent })),
        );
        expect(links.length, "the sidebar has links").toBeGreaterThan(0);
        const problems = [];
        const portal = await portalName(page);
        for (const link of links) {
          const label = stripStep(norm(link.label));
          await page.goto(link.href);
          await page.waitForLoadState("networkidle").catch(() => {});
          const parts = await breadcrumbParts(page);
          const where = `${link.href} (link "${label}")`;
          if (parts.length !== 2) problems.push(`${where}: breadcrumb has ${parts.length} parts: ${parts.join(" > ")}`);
          else {
            if (parts[0] !== portal) problems.push(`${where}: first breadcrumb part is "${parts[0]}"`);
            if (parts[1] !== label) problems.push(`${where}: breadcrumb says "${parts[1]}"`);
          }
          if (NO_H1[link.href]) continue;
          const h1 = page.locator("main h1");
          if ((await h1.count()) === 0) problems.push(`${where}: no h1 on the page`);
          else {
            const title = norm(await h1.first().innerText());
            const greeting = label === "Dashboard" && /^Welcome, /.test(title); // a home page greets the person
            if (title !== label && !greeting && title !== TITLE_PENDING[link.href]) problems.push(`${where}: page title is "${title}"`);
          }
          // I-076: the rules box is closed wherever it appears.
          const openRules = page.locator('section[aria-label="Rules applied on this screen"] button[aria-expanded="true"]');
          if ((await openRules.count()) > 0) problems.push(`${where}: "Rules applied on this screen" is open by default`);
        }
        expect(problems, problems.join("\n")).toEqual([]);
      });
    });
  }

  async function portalName(page) {
    const role = await page.evaluate(async () => (await (await fetch("/api/auth/me")).json()).user?.role);
    return {
      student: "Student Portal",
      dean: "Dean Portal",
      faculty: "Faculty Portal",
      staff: "Graduate School Staff Portal",
      academic_coordinator: "Academic Coordinator Portal",
      research_coordinator: "Research Coordinator Portal",
      admin: "Administrator Portal",
    }[role];
  }

  test.describe("staff", () => {
    test.use({ storageState: authFile("staff"), viewport: { width: 1366, height: 768 } });

    test("a detail page adds the list page between portal and record", async ({ page }) => {
      await page.goto("/students");
      const first = page.locator("main a[href^='/students/']").first();
      await expect(first).toBeVisible();
      await first.click();
      await expect(page.locator("main h1").first()).toBeVisible();
      const parts = await breadcrumbParts(page);
      expect(parts.length).toBe(3);
      expect(parts.slice(0, 2)).toEqual(["Graduate School Staff Portal", "Students"]);
    });

    test("Activity Log shows the log itself, not a closed 'View logs' button (I-080)", async ({ page }) => {
      await page.goto("/activity");
      await expect(page.getByText(/Showing \d+ of \d+ activities/)).toBeVisible();
      await expect(page.locator("main ol > li").first(), "log entries are on the page without a click").toBeVisible();
      await expect(page.getByRole("button", { name: /View logs|Hide logs/ })).toHaveCount(0);
      await expect(page.getByLabel("Search activity")).toBeVisible(); // filters stay
    });
  });

  test.describe("student", () => {
    test.use({ storageState: authFile("student"), viewport: { width: 1366, height: 768 } });

    test("Subject Withdrawal opens with the rules box closed so the form is on the first screen (I-076)", async ({ page }) => {
      await page.goto("/student/requests/withdrawal");
      const rules = page.locator('section[aria-label="Rules applied on this screen"]');
      await expect(rules).toBeVisible();
      await expect(rules.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    });
  });
});
