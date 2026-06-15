const { spawnSync } = require("node:child_process");
const { join } = require("node:path");

const isWindows = process.platform === "win32";
const systemPython = isWindows ? "python" : "python3";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error || result.status !== 0) process.exit(result.status ?? 1);
}

run(systemPython, ["-m", "venv", ".venv"]);

const virtualPython = join(
  process.cwd(),
  ".venv",
  isWindows ? "Scripts" : "bin",
  isWindows ? "python.exe" : "python"
);
run(virtualPython, ["-m", "pip", "install", "--upgrade", "pip"]);
run(virtualPython, ["-m", "pip", "install", "-r", "requirements.txt"]);
