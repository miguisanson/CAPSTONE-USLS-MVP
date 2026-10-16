// NEGATIVE CONTROL. Runs the same checker as the sweep against a deliberately broken target and
// MUST fail. Only matched when E2E_NEGATIVE=1 (`npm run e2e:negative`). If this ever passes, the
// checker has stopped detecting problems and the sweep result cannot be trusted.
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { AUTH_DIR, ARTIFACTS_DIR } from "./support/paths.mjs";
import { VIEWPORTS, attachWatchers, checkPage, formatProblems, stubExternal } from "./support/checker.js";

test.use({ storageState: join(AUTH_DIR, "admin.json") });

test("negative control: a broken page must be reported", async ({ page, context }) => {
  const tracker = { problems: [], writes: [], where: { role: "negative", page: "(start)", viewport: 1366 } };
  await stubExternal(context);
  attachWatchers(page, tracker);
  const outDir = join(ARTIFACTS_DIR, "screens", "negative");

  // 1. A SPA route that does not exist -> the "not available yet" screen.
  await checkPage(page, tracker, { role: "negative", href: "/this-route-does-not-exist", label: "missing route", viewport: VIEWPORTS[0], outDir });

  // 2. A real page, sabotaged after load: a console error, an uncaught exception, a failing API call
  //    and an oversized element. checkPage navigates, so inject through an init script.
  await context.addInitScript(() => {
    window.addEventListener("load", () => {
      console.error("negative-control: injected console.error");
      setTimeout(() => {
        throw new Error("negative-control: injected uncaught exception");
      }, 0);
      fetch("/api/negative-control-missing-endpoint").catch(() => {});
      const wide = document.createElement("div");
      wide.textContent = "negative-control: oversized element";
      wide.style.cssText = "width:5000px;height:20px;background:#f00";
      document.body.appendChild(wide);
    });
  });
  await checkPage(page, tracker, { role: "negative", href: "/", label: "dashboard (sabotaged)", viewport: VIEWPORTS[2], outDir });

  const report = formatProblems(tracker.problems);
  console.log(`[negative] checker found ${report.length} problem(s):\n${report.join("\n")}`);
  // Sanity: the checker must have noticed each kind of sabotage, otherwise it is blind.
  const text = report.join("\n");
  for (const needle of ["not available", "console error", "uncaught page error", "API 404", "horizontal overflow"]) {
    expect(text, `negative control: checker did not detect "${needle}"`).toContain(needle);
  }
  // The deliberate failure: a clean run is required to pass, and this target is not clean.
  if (report.length) throw new Error(`NEGATIVE CONTROL FAILED AS INTENDED - the checker reported ${report.length} problem(s):\n${report.join("\n")}`);
});
