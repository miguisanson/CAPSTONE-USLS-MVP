// The page checker shared by the sweep and the negative control.
// It collects problems instead of throwing, so one run reports every broken page.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { SCREENS_DIR } from "./paths.mjs";

export const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
];

// API responses with status >= 400 that are expected. Every entry needs a written reason.
// Matching is `${method} ${pathname}`. Keep this list empty unless a status is the app working as designed.
export const API_ALLOW_LIST = [
  // { match: /^GET \/api\/example$/, status: 404, reason: "why this is correct behaviour" },
];

// Third-party hosts are stubbed so the run needs no internet: Google Fonts is a non-blocking stylesheet.
export async function stubExternal(context) {
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.fulfill({ status: 200, contentType: "text/css", body: "" }),
  );
}

export const slugify = (href) =>
  (href || "").replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "home";

/** Watches a page and attributes events to whatever `tracker.where` currently names. */
// Windows can run out of socket buffers when several browsers load pages at once (I-041). That is the test
// machine, not the app: such a failure is logged as a note and not counted as a problem.
const MACHINE_NETWORK_ERROR = /ERR_NO_BUFFER_SPACE/;

// The notification bell makes the due reminders with this POST on every page load (I-071/I-072: a read never does).
// It is a refresh, not something a page view changed on its own, so it is not counted as a write by the specs
// that assert "no non-GET API calls while the pages were open". Its own spec (p92) asserts it is sent.
const REFRESH_CALLS = new Set(["POST /api/notifications/refresh"]);

export function attachWatchers(page, tracker) {
  const add = (problem) => tracker.problems.push({ ...tracker.where, problem });
  const machineHiccup = (text) => {
    if (!MACHINE_NETWORK_ERROR.test(text || "")) return false;
    console.warn(`[e2e] ignored a machine network error (I-041) on ${tracker.where?.page || "?"}: ${String(text).slice(0, 160)}`);
    return true;
  };
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (machineHiccup(message.text())) return;
    const loc = message.location();
    const at = loc?.url ? ` (${loc.url.replace(/^https?:\/\/[^/]+/, "")}${loc.lineNumber ? `:${loc.lineNumber}` : ""})` : "";
    add(`console error: ${message.text().slice(0, 300)}${at}`);
  });
  page.on("pageerror", (error) => add(`uncaught page error: ${String(error.message || error).slice(0, 300)}`));
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith("/api/")) return;
    const method = response.request().method();
    if (method !== "GET" && !REFRESH_CALLS.has(`${method} ${url.pathname}`)) tracker.writes.push(`${method} ${url.pathname} -> ${response.status()} (${tracker.where.page})`);
    if (response.status() < 400) return;
    const key = `${method} ${url.pathname}`;
    if (API_ALLOW_LIST.some((a) => a.match.test(key) && (!a.status || a.status === response.status()))) return;
    add(`API ${response.status()}: ${key}`);
  });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (machineHiccup(request.failure()?.errorText)) return;
    if (url.pathname.startsWith("/api/")) add(`API request failed: ${request.method()} ${url.pathname} (${request.failure()?.errorText})`);
  });
}

/** In-page checks run after the page has settled: overflow, error banners, "not available" screens. */
export async function inspectPage(page) {
  return page.evaluate(() => {
    const out = { overflow: null, banners: [] };
    const doc = document.documentElement;
    if (doc.scrollWidth > window.innerWidth + 1) {
      const offenders = [];
      for (const el of document.body.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > window.innerWidth + 1) {
          const cls = el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
          offenders.push({ label: el.tagName.toLowerCase() + cls, right: Math.round(r.right), text: (el.textContent || "").trim().slice(0, 40) });
        }
      }
      out.overflow = { scrollWidth: doc.scrollWidth, innerWidth: window.innerWidth, offenders: offenders.slice(0, 3) };
    }
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    // InlineNotice tone="danger" = red bordered box; role=alert is the accessible error region.
    const seen = new Set();
    for (const el of document.querySelectorAll(".border-red-200.bg-red-50, [role='alert']")) {
      if (!visible(el)) continue;
      const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 200);
      if (text && !seen.has(text)) {
        seen.add(text);
        out.banners.push(text);
      }
    }
    const body = document.body.innerText || "";
    if (/something went wrong/i.test(body)) out.banners.push("text 'Something went wrong' is visible");
    if (/this page is not available yet/i.test(body)) out.banners.push("'This page is not available yet' screen (route has no page)");
    return out;
  });
}

/** Visit one URL at one viewport, check it, screenshot it. Never throws for an app problem. */
export async function checkPage(page, tracker, { role, href, label, viewport, outDir = join(SCREENS_DIR, role) }) {
  tracker.where = { role, page: `${label || href} [${href}]`, viewport: viewport.width };
  const shot = join(outDir, `${slugify(href)}-${viewport.width}.png`);
  const before = tracker.problems.length;
  await page.setViewportSize(viewport);
  try {
    await page.goto(href, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {
      tracker.problems.push({ ...tracker.where, problem: "network never went idle within 20 s (requests still in flight)" });
    });
    await page.waitForTimeout(400);
  } catch (error) {
    tracker.problems.push({ ...tracker.where, problem: `navigation failed: ${String(error.message).split("\n")[0]}` });
  }
  const found = await inspectPage(page).catch((error) => ({ overflow: null, banners: [`could not inspect page: ${error.message}`] }));
  if (found.overflow) {
    const o = found.overflow;
    const who = o.offenders.map((x) => `${x.label} right=${x.right}px "${x.text}"`).join("; ");
    tracker.problems.push({ ...tracker.where, problem: `horizontal overflow at ${viewport.width}px: scrollWidth ${o.scrollWidth} > ${o.innerWidth}. Offenders: ${who}` });
  }
  for (const banner of found.banners) tracker.problems.push({ ...tracker.where, problem: `error banner visible: ${banner}` });
  mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  for (const p of tracker.problems.slice(before)) p.screenshot = shot;
  return shot;
}

/** Collapse duplicates (same page + problem across viewports) and format a readable report. */
export function formatProblems(problems) {
  const groups = new Map();
  for (const p of problems) {
    const key = `${p.role} | ${p.page} | ${p.problem}`;
    if (!groups.has(key)) groups.set(key, { ...p, widths: new Set(), shots: [] });
    const g = groups.get(key);
    g.widths.add(p.viewport);
    if (p.screenshot) g.shots.push(p.screenshot);
  }
  return [...groups.values()].map((g) => `${g.role} | ${g.page} | ${g.problem} | @${[...g.widths].join("/")}px | ${g.shots[0] || "-"}`);
}
