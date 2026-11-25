// Feature inventory: what a person can do on every sidebar page, per role - every button, link, tab, filter and box
// (with folded parts opened: details, the "Closed" strip, the Help panel, the first case window) and every server call
// the page makes. Run it against two builds and diff the files to see what was removed, moved or added.
//   cd frontend && node scripts/feature-inventory.mjs <baseUrl> <out.json>
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const [base, out] = process.argv.slice(2);
const PASSWORD = "DemoPass123!";
const ROLES = [
  ["student", "student@usls.edu.ph", "/student"],
  ["staff", "staff@usls.edu.ph", "/"],
  ["dean", "dean@usls.edu.ph", "/dean"],
  ["faculty", "liwayway.bautista@usls.edu.ph", "/faculty-portal"],
  ["research-coordinator", "research@usls.edu.ph", "/"],
  ["academic-coordinator", "academic@usls.edu.ph", "/"],
];

// "View details for Olivia Cabrera" and "View details for Adrian Lim" are one feature; counts are not features.
const norm = (text) => text.replace(/\s+/g, " ").trim()
  .replace(/\s+(for|of|to|from)\s+[A-Z][^,.:]*$/u, " $1 …")
  .replace(/\d+([.,]\d+)?/g, "#")
  .slice(0, 80);
const apiKey = (method, url) => {
  const u = new URL(url);
  return `${method} ${u.pathname.replace(/\/\d+(?=\/|$)/g, "/#")}${[...u.searchParams.keys()].length ? `?${[...new Set(u.searchParams.keys())].sort().join("&")}` : ""}`;
};

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function controls(scope) {
  return scope.evaluate((root) => {
    const out = [];
    for (const n of root.querySelectorAll("button, a[href], [role=tab], [role=menuitem], select, input, textarea, summary")) {
      if (n.closest("[aria-hidden=true]")) continue;
      const tag = n.tagName.toLowerCase();
      const type = tag === "input" ? `input:${n.type}` : n.getAttribute("role") || tag;
      if (type === "input:hidden") continue;
      let name = n.getAttribute("aria-label") || "";
      if (!name && n.id) { const l = document.querySelector(`label[for="${n.id}"]`); if (l) name = l.textContent; }
      if (!name && n.closest("label")) name = n.closest("label").textContent;
      if (!name) name = n.textContent || n.getAttribute("placeholder") || n.getAttribute("title") || "";
      if (tag === "a") name += ` -> ${new URL(n.href).pathname}`;
      out.push(`${type}: ${name}`);
    }
    return out;
  });
}

const browser = await chromium.launch();
const result = {};
for (const [role, email, home] of ROLES) {
  const context = await browser.newContext({ baseURL: base, viewport: { width: 1366, height: 900 } });
  const login = await context.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
  if (!login.ok()) { result[role] = { error: `login ${login.status()}` }; continue; }
  const page = await context.newPage();
  let calls = new Set();
  page.on("request", (req) => { if (req.url().includes("/api/")) calls.add(apiKey(req.method(), req.url())); });
  await page.goto(home); await settle(page);
  for (const t of await page.locator("[data-nav-toggle][aria-expanded=false]").all()) await t.click().catch(() => {});
  const hrefs = await page.evaluate(() => [...new Set([...document.querySelectorAll("aside nav a[href], nav[aria-label] a[href]")].map((a) => a.getAttribute("href")).filter((h) => h && h.startsWith("/")))]);
  result[role] = {};
  for (const href of hrefs) {
    calls = new Set();
    await page.goto(href); await settle(page);
    const main = page.locator("main");
    // open what is folded: details, the "Closed" strip, every tab's panel is not visited (tabs are listed as controls)
    for (const d of await main.locator("details:not([open]) > summary").all()) await d.click().catch(() => {});
    for (const c of await main.getByRole("button", { name: /^Closed\s*\d+$/ }).all()) { if ((await c.getAttribute("aria-expanded")) === "false") await c.click().catch(() => {}); }
    await page.waitForTimeout(300);
    const entry = { controls: [...new Set((await controls(main)).map(norm))].sort() };
    // the Help panel (Phase 2 moved policy text and some notes there)
    const help = main.getByRole("button", { name: "Help", exact: true }).first();
    if (await help.count()) {
      await help.click().catch(() => {});
      const dialog = page.getByRole("dialog").last();
      if (await dialog.isVisible().catch(() => false)) entry.help = [...new Set((await controls(dialog)).map(norm))].sort();
      await page.keyboard.press("Escape"); await page.waitForTimeout(200);
    }
    // the first case window on a board or list ("View details", "Review", "Open")
    const opener = main.getByRole("button", { name: /^(View details|Review|Open) /i }).first();
    if (await opener.count() && await opener.isVisible().catch(() => false)) {
      await opener.click().catch(() => {});
      await page.waitForTimeout(800);
      const dialog = page.getByRole("dialog").last();
      if (await dialog.isVisible().catch(() => false)) {
        await settle(page);
        entry.caseWindow = [...new Set((await controls(dialog)).map(norm))].sort();
        await page.keyboard.press("Escape"); await page.waitForTimeout(300);
      }
    }
    entry.api = [...calls].sort();
    result[role][href] = entry;
  }
  await context.close();
  console.log(role, hrefs.length, "pages");
}
await browser.close();
writeFileSync(out, JSON.stringify(result, null, 1));
console.log("written", out);
