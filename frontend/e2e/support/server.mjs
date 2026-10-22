// Playwright `webServer` command: seeds a FRESH SQLite database in a temp folder, then runs Flask on
// port 5055 in the foreground. It builds nothing: Flask serves the SPA from frontend/dist, so the
// `e2e` npm script builds first. Nothing here touches the developer's own database, uploads or .env:
// every path is passed explicitly through the environment.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PORT, REPO_ROOT, FRONTEND_DIR, STATE_FILE, FINDINGS_DIR, SCREENS_DIR, SIGNIN_DIR, resolvePython } from "./paths.mjs";

if (!existsSync(join(FRONTEND_DIR, "dist", "index.html"))) {
  console.error("frontend/dist is missing. Run `npm run e2e` (it builds first) or `npm run build:web`.");
  process.exit(1);
}

// Start every run from clean output so old screenshots and findings cannot be mistaken for new ones.
rmSync(FINDINGS_DIR, { recursive: true, force: true });
rmSync(SIGNIN_DIR, { recursive: true, force: true });
if (process.env.E2E_NEGATIVE !== "1") rmSync(SCREENS_DIR, { recursive: true, force: true });

const base = process.env.USLS_E2E_TMP || tmpdir();
for (const name of readdirSync(base)) {
  if (name.startsWith("usls-e2e-")) rmSync(join(base, name), { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
}

const python = resolvePython();
const tmp = mkdtempSync(join(base, "usls-e2e-"));
const dbFile = join(tmp, "e2e.sqlite3").replaceAll("\\", "/");
const dirs = { uploads: join(tmp, "uploads"), policy: join(tmp, "policy_documents"), rag: join(tmp, "rag_index") };
Object.values(dirs).forEach((d) => mkdirSync(d, { recursive: true }));

const env = {
  ...process.env,
  DATABASE_URL: `sqlite:///${dbFile}`,
  USLS_UPLOAD_DIR: dirs.uploads,
  POLICY_DOCUMENT_UPLOAD_DIR: dirs.policy,
  RAG_INDEX_DIR: dirs.rag,
  FLASK_PORT: String(PORT),
  RAG_PREWARM: "0",
  PYTHONUNBUFFERED: "1",
  PYTHONIOENCODING: "utf-8",
  // The run is keyless on every machine: an empty value wins over the developer's .env
  // (load_dotenv never overrides a variable that is already set), so the assistant takes the offline path.
  GOOGLE_API_KEY: "",
  GOOGLE_AI_STUDIO_API_KEY: "",
};

console.log(`[e2e] python: ${python}`);
console.log(`[e2e] temp folder: ${tmp}`);
console.log("[e2e] seeding a fresh database (python app.py --seed) ...");
const seed = spawnSync(python, ["app.py", "--seed"], { cwd: REPO_ROOT, env, stdio: "inherit" });
if (seed.status !== 0) {
  console.error(`[e2e] seeding failed (exit ${seed.status}).`);
  process.exit(seed.status || 1);
}

// Pick the faculty login with the most active advisees, so the adviser pages have data.
const pick = spawnSync(
  python,
  [
    "-I",
    "-c",
    "import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);" +
      "r=c.execute(\"select ua.email,count(aa.id) n from user_account ua left join adviser_assignment aa on aa.faculty_id=ua.faculty_id and aa.status='Active' " +
      "where ua.role='faculty' and ua.active=1 group by ua.id order by n desc,ua.id limit 1\").fetchone();print(r[0] if r else '')",
    join(tmp, "e2e.sqlite3"),
  ],
  { encoding: "utf8" },
);
const facultyEmail = (pick.stdout || "").trim();
mkdirSync(dirname(STATE_FILE), { recursive: true });
writeFileSync(STATE_FILE, JSON.stringify({ tmp, facultyEmail, python, port: PORT }, null, 2));
console.log(`[e2e] faculty login: ${facultyEmail || "(none found)"}`);

console.log(`[e2e] starting Flask on port ${PORT} ...`);
const server = spawn(python, ["app.py"], { cwd: REPO_ROOT, env, stdio: "inherit" });
server.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK"]) process.on(signal, () => { server.kill(); process.exit(0); });
