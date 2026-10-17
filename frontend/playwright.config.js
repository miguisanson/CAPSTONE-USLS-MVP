// Playwright harness (owner decisions IM7 and IM15). One command from the repo root: `npm run e2e`.
// See e2e/README.md. Chromium only.
import { defineConfig, devices } from "@playwright/test";
import { BASE_URL, PORT, ARTIFACTS_DIR } from "./e2e/support/paths.mjs";
import { join } from "node:path";

const negative = process.env.E2E_NEGATIVE === "1";

export default defineConfig({
  testDir: "./e2e",
  outputDir: join(ARTIFACTS_DIR, "test-results"),
  // A role sweep visits ~20 pages at three viewports in one test, so give it room.
  timeout: 15 * 60 * 1000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: Number(process.env.E2E_WORKERS || 4),
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
