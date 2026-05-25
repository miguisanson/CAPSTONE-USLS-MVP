const { spawn } = require("node:child_process");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";
const command = isWindows ? "powershell.exe" : "bash";
const args = isWindows
  ? ["-ExecutionPolicy", "Bypass", "-File", path.join(rootDir, "dev-local.ps1")]
  : [path.join(rootDir, "dev-local.sh")];

const child = spawn(command, args, {
  cwd: rootDir,
  env: process.env,
  stdio: "inherit",
});

const stopChild = () => {
  if (!child.killed) {
    child.kill("SIGINT");
  }
};

process.on("SIGINT", stopChild);
process.on("SIGTERM", stopChild);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
