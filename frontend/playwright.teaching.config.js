import { defineConfig } from "@playwright/test";
import { join } from "node:path";
import { resolvePython, REPO_ROOT, ARTIFACTS_DIR } from "./e2e/support/paths.mjs";

const port = Number(process.env.E2E_TEACHING_PORT || 5056);
export default defineConfig({
  testDir: "./e2e/teaching-workflow",
  timeout: 120000,
  expect: { timeout: 15000 },
  workers: 1,
  reporter: [["list"]],
  outputDir: join(ARTIFACTS_DIR, "teaching-workflow-results"),
  use: { baseURL: `http://127.0.0.1:${port}`, browserName: "chromium", channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    viewport: { width: 1366, height: 768 } },
  webServer: {
    command: `"${resolvePython()}" scripts/serve_teaching_test.py`,
    cwd: REPO_ROOT,
    url: `http://127.0.0.1:${port}/api/auth/config`,
    timeout: 60000,
    reuseExistingServer: false,
    env: { ...process.env, USLS_SKIP_STARTUP_TASKS: "1", GOOGLE_API_KEY: "", GOOGLE_AI_STUDIO_API_KEY: "" },
  },
});
