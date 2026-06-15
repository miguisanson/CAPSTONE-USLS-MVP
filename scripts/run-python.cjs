const { existsSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const { join } = require("node:path");

const isWindows = process.platform === "win32";
const virtualPython = join(
  process.cwd(),
  ".venv",
  isWindows ? "Scripts" : "bin",
  isWindows ? "python.exe" : "python"
);
const python = existsSync(virtualPython) ? virtualPython : isWindows ? "python" : "python3";
const result = spawnSync(python, process.argv.slice(2), { stdio: "inherit" });

if (result.error) {
  console.error(`Could not start Python with ${python}: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
