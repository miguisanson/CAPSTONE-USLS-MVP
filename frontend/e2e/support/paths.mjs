// Shared paths and environment for the Playwright harness.
// The browsers live on E: (never drive C:); the temp state lives under e2e-artifacts/.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const FRONTEND_DIR = resolve(here, "..", "..");
export const REPO_ROOT = resolve(FRONTEND_DIR, "..");
export const ARTIFACTS_DIR = join(FRONTEND_DIR, "e2e-artifacts");
export const SCREENS_DIR = join(ARTIFACTS_DIR, "screens");
export const FINDINGS_DIR = join(ARTIFACTS_DIR, "findings");
export const SIGNIN_DIR = join(ARTIFACTS_DIR, ".signin");
export const AUTH_DIR = join(ARTIFACTS_DIR, ".auth");
export const STATE_FILE = join(ARTIFACTS_DIR, ".runtime", "state.json");

export const PORT = Number(process.env.E2E_PORT) || 5055; // E2E_PORT lets two worktrees run the suite side by side
export const BASE_URL = `http://127.0.0.1:${PORT}`;
export const DEFAULT_BROWSERS_PATH = "E:/DevCache/ms-playwright";

const isWindows = process.platform === "win32";
const venvPython = (root) => join(root, ".venv", isWindows ? "Scripts" : "bin", isWindows ? "python.exe" : "python");

/**
 * Find the project's Python. Order:
 *   1. USLS_PYTHON (explicit override)
 *   2. <repoRoot>/.venv
 *   3. the .venv of the main checkout (so a git worktree, which has no venv of its own, works)
 *   4. python / python3 on PATH
 */
export function resolvePython() {
  if (process.env.USLS_PYTHON && existsSync(process.env.USLS_PYTHON)) return process.env.USLS_PYTHON;
  if (existsSync(venvPython(REPO_ROOT))) return venvPython(REPO_ROOT);
  const common = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: REPO_ROOT, encoding: "utf8" });
  if (common.status === 0) {
    const mainRoot = dirname(common.stdout.trim());
    if (existsSync(venvPython(mainRoot))) return venvPython(mainRoot);
  }
  return isWindows ? "python" : "python3";
}

/** Environment every Playwright process must have (browser cache outside drive C:). */
export function playwrightEnv(base = process.env) {
  const env = { ...base };
  // Only on a machine that has the E: drive (the owner's PC); teammates get Playwright's default folder.
  if (!env.PLAYWRIGHT_BROWSERS_PATH && isWindows && existsSync("E:/")) env.PLAYWRIGHT_BROWSERS_PATH = DEFAULT_BROWSERS_PATH;
  return env;
}
