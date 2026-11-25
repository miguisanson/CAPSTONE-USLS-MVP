// Phase 7 measurement: the same script against the baseline and the current build. Usage:
//   cd frontend && node scripts/measure-ux.mjs <baseUrl> <outJson> [shotDir]   (a running app, e.g. http://127.0.0.1:5000)
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core/axe.min.js");
const [base, out, shotDir] = process.argv.slice(2);
const PASSWORD = "DemoPass123!";
const ROLES = [
  ["student", "student@usls.edu.ph", "/student"],
  ["staff", "staff@usls.edu.ph", "/"],
  ["dean", "dean@usls.edu.ph", "/dean"],
  ["faculty", "liwayway.bautista@usls.edu.ph", "/faculty-portal"],
  ["research-coordinator", "research@usls.edu.ph", "/"],
];
const SIZES = { desktop: { width: 1366, height: 768 }, wide: { width: 1920, height: 1080 }, phone: { width: 390, height: 844 } };
const result = { base, roles: {} };
const browser = await chromium.launch();

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.locator("[aria-busy=true], .animate-spin").first().waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function openGroups(page) {
  for (const toggle of await page.locator("[data-nav-toggle][aria-expanded=false]").all()) await toggle.click().catch(() => {});
}

for (const [role, email, home] of ROLES) {
  const context = await browser.newContext({ baseURL: base, viewport: SIZES.desktop });
  const res = await context.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
  if (!res.ok()) { result.roles[role] = { error: `login ${res.status()}` }; continue; }
  const page = await context.newPage();
  const r = { pages: [] };

  // the home at 1366 and 390: distance to the first work item, height, open-task figure vs rows
  for (const size of ["desktop", "phone"]) {
    await page.setViewportSize(SIZES[size]);
    await page.goto(home); await settle(page);
    r[`home_${size}`] = await page.evaluate(() => {
      const heading = [...document.querySelectorAll("main h2, main h3")].find((h) => /^Needs your action$/.test(h.textContent.trim()));
      const section = heading && heading.closest("section");
      const first = section && section.querySelector("li, a[href]:not(header a)");
      const rows = section ? section.querySelectorAll("ul > li").length : null;
      const stat = [...document.querySelectorAll("main *")].find((n) => n.children.length === 0 && /^(your )?open (tasks|items)$/i.test(n.textContent.trim()));
      let figure = null;
      if (stat) { const card = stat.closest("a, div[class*=rounded]"); const m = card && card.textContent.match(/(\d+)/); figure = m ? Number(m[1]) : null; }
      return {
        firstWorkY: first ? Math.round(first.getBoundingClientRect().top + window.scrollY) : null,
        height: document.documentElement.scrollHeight,
        actionRows: rows, openFigure: figure,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
  }

  // the sidebar at 1366x768
  await page.setViewportSize(SIZES.desktop);
  await page.goto(home); await settle(page);
  r.sidebar = await page.evaluate(() => {
    const nav = document.querySelector("aside nav") || document.querySelector("nav[aria-label]");
    if (!nav) return null;
    const links = [...nav.querySelectorAll("a[href]")].filter((a) => a.getBoundingClientRect().height > 0);
    const scroller = nav.closest("aside") || nav;
    const inView = links.filter((a) => a.getBoundingClientRect().bottom <= window.innerHeight).length;
    return { linksShown: links.length, linksInView: inView, scrolls: scroller.scrollHeight > scroller.clientHeight + 2 };
  });
  await openGroups(page);
  const hrefs = await page.evaluate(() => {
    const nav = document.querySelector("aside nav") || document.querySelector("nav[aria-label]");
    return [...new Set([...(nav ? nav.querySelectorAll("a[href]") : [])].map((a) => a.getAttribute("href")).filter((h) => h && h.startsWith("/")))];
  });
  r.navLinks = hrefs.length;

  // every page: height at 1366, sideways scroll at 390, axe at 1366, small targets at 390 (student)
  for (const href of hrefs) {
    const row = { href };
    await page.setViewportSize(SIZES.desktop);
    await page.goto(href); await settle(page);
    row.height = await page.evaluate(() => document.documentElement.scrollHeight);
    row.title = await page.locator("main h1").first().textContent({ timeout: 3000 }).catch(() => "");
    await page.addScriptTag({ path: AXE });
    const axe = await page.evaluate(async () => {
      const found = await window.axe.run(document.querySelector("main") || document, { resultTypes: ["violations"] });
      return found.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
    });
    row.axe = axe;
    if (shotDir) {
      const name = `${role}${href.replace(/[/?=&]+/g, "-").replace(/-$/, "") || "-home"}`;
      mkdirSync(shotDir, { recursive: true });
      await page.screenshot({ path: `${shotDir}/${name}-1366.png`, fullPage: true });
      await page.setViewportSize(SIZES.wide); await page.waitForTimeout(300);
      await page.screenshot({ path: `${shotDir}/${name}-1920.png`, fullPage: true });
    }
    await page.setViewportSize(SIZES.phone); await page.waitForTimeout(500);
    const phone = await page.evaluate(() => {
      const shown = (n) => { const b = n.getBoundingClientRect(); return b.width > 2 && b.height > 2 && getComputedStyle(n).visibility !== "hidden"; };
      let small = 0;
      for (const n of document.querySelectorAll("main button, main a[href], main [role=tab], main summary, main select, main input[type=checkbox], main input[type=radio]")) {
        if (!shown(n) || n.closest("p")) continue;
        const t = (n.closest("label") || n).getBoundingClientRect();
        if (Math.min(t.width, t.height) < 44) small += 1;
      }
      let smallInputs = 0;
      for (const n of document.querySelectorAll("main input:not([type=checkbox]):not([type=radio]):not([type=hidden]), main select, main textarea")) if (shown(n) && parseFloat(getComputedStyle(n).fontSize) < 16) smallInputs += 1;
      return { overflow: document.documentElement.scrollWidth - window.innerWidth, small, smallInputs, height: document.documentElement.scrollHeight };
    });
    Object.assign(row, { overflow390: phone.overflow, small390: phone.small, smallInputs390: phone.smallInputs, height390: phone.height });
    if (shotDir) {
      const name = `${role}${href.replace(/[/?=&]+/g, "-").replace(/-$/, "") || "-home"}`;
      await page.screenshot({ path: `${shotDir}/${name}-390.png`, fullPage: true });
    }
    r.pages.push(row);
  }
  result.roles[role] = r;
  await context.close();
  console.log(role, "done", r.pages.length, "pages");
}

// two pages the audit named: the Dean's Approvals Queue height and the Leave of Absence board width
{
  const context = await browser.newContext({ baseURL: base, viewport: SIZES.desktop });
  await context.request.post("/api/auth/login", { data: { email: "dean@usls.edu.ph", password: PASSWORD } });
  const page = await context.newPage();
  await page.goto("/dean/approvals"); await settle(page);
  result.deanQueueHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await context.close();
  const staff = await browser.newContext({ baseURL: base, viewport: SIZES.desktop });
  await staff.request.post("/api/auth/login", { data: { email: "staff@usls.edu.ph", password: PASSWORD } });
  const sp = await staff.newPage();
  await sp.goto("/workflow/leave-of-absence"); await settle(sp);
  result.loaBoard = await sp.evaluate(() => {
    const region = [...document.querySelectorAll("[role=region][tabindex='0']")].find((n) => n.scrollWidth > n.clientWidth) || document.querySelector("[role=region][tabindex='0']");
    return region ? { scrollWidth: region.scrollWidth, clientWidth: region.clientWidth } : null;
  });
  await sp.goto("/monitoring-sheet"); await settle(sp);
  result.monitoring = await sp.evaluate(() => {
    const cells = [...document.querySelectorAll("main tbody button[aria-label*=': ']")];
    const swatches = [...document.querySelectorAll("[aria-label='Colour legend'] li > span:first-child")].map((n) => getComputedStyle(n).backgroundColor);
    return { cells: cells.length, blankCells: cells.filter((c) => !c.textContent.trim()).length, legendColours: new Set(swatches).size };
  });
  await staff.close();
}
await browser.close();
writeFileSync(out, JSON.stringify(result, null, 1));
console.log("written", out);
