// Playwright harness (owner decisions IM7 and IM15). One command from the repo root: `npm run e2e`.
// See e2e/README.md. Chromium only.
import { defineConfig, devices } from "@playwright/test";
import { BASE_URL, PORT, ARTIFACTS_DIR } from "./e2e/support/paths.mjs";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { assertOwnership } from "./e2e/support/check-ownership.mjs";

// Migui's PC keeps the browsers on E: (drive C: is kept free); use them without anyone setting the variable by hand.
// Any other PC: `npx playwright install chromium` once and the default location is used.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync("E:/DevCache/ms-playwright")) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = "E:/DevCache/ms-playwright";
}

const negative = process.env.E2E_NEGATIVE === "1";

// Data-ownership guard (e2e/DATA-OWNERSHIP.md): two specs may not declare writes to the same record. Runs once, in the
// process that starts the run (workers also load this file; they have TEST_WORKER_INDEX set).
if (!process.env.TEST_WORKER_INDEX) assertOwnership();

export default defineConfig({
  testDir: "./e2e",
  outputDir: join(ARTIFACTS_DIR, "test-results"),
  // A role sweep visits ~20 pages at three viewports in one test, so give it room.
  timeout: 15 * 60 * 1000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: Number(process.env.E2E_WORKERS || 3), // 4 made Windows run out of socket buffers (I-041)
  retries: 0,
  forbidOnly: false,
  reporter: [["list"], ["html", { open: "never", outputFolder: join(ARTIFACTS_DIR, "report") }]],
  use: {
    baseURL: BASE_URL,
    browserName: "chromium",
    ...devices["Desktop Chrome"],
    viewport: { width: 1366, height: 768 },
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    trace: "off",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.js$/ },
    {
      name: negative ? "negative" : "sweep",
      testMatch: negative ? /negative\.spec\.js$/ : /sweep\.spec\.js$/,
      dependencies: ["setup"],
    },
    // Section J bug tests (I-001, I-004, I-008). They change data, so they are not part of the read-only
    // sweep; they only touch demo students the sweep does not read. Not in the negative control.
    ...(negative
      ? []
      : [{ name: "section-j", testMatch: /section-j\.spec\.js$/, dependencies: ["setup"] }]),
    // Page-migration packets (Phase 5): e2e/p<NN>-<name>.spec.js pin page behaviour. Some change data
    // (each uses its own demo students). Not in the negative control. New packets add a spec file only.
    // p115 (the Demo Guide autopilot) plays whole processes with demo students that p32, p114 and section-j also use, so it is not in
    // "pages": its own project runs after every other writer has finished (e2e/DATA-OWNERSHIP.md).
    ...(negative
      ? []
      : [{ name: "pages", testMatch: /(^|[\/])p(?!115-)\d+-[\w-]+\.spec\.js$/, dependencies: ["setup"] }]),
    ...(negative
      ? []
      : [{ name: "autopilot", testMatch: /p115-autopilot\.spec\.js$/, dependencies: ["sweep", "section-j", "pages"] }]),
    // Phase 5 component gallery at /__ui (ui-gallery.spec.js plus one ui-gallery-<packet>.spec.js per packet). Read-only. Needs the e2e build (VITE_UI_GALLERY=1, set by
    // `node scripts/e2e.mjs --build`, which `npm run e2e` uses). Not in the negative control.
    ...(negative
      ? []
      : [{ name: "ui-gallery", testMatch: /ui-gallery[\w-]*\.spec\.js$/, dependencies: ["setup"] }]),
  ],
  globalTeardown: "./e2e/support/teardown.mjs",
  webServer: {
    // Seeds a fresh SQLite database in a temp folder, then runs Flask on PORT. Startup takes 30-90 s.
    command: "node e2e/support/server.mjs",
    url: `${BASE_URL}/api/auth/config`,
    timeout: 5 * 60 * 1000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
    name: `Flask on :${PORT}`,
  },
});
