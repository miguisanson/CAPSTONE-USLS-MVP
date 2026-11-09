#!/usr/bin/env python3
"""Build dist_release/CAP-2521-IT-CAPSTONE-PROJECT.zip from the tracked files.

  python scripts/package_release.py --dry-run     counts only, no zip
  python scripts/package_release.py --seed-db     run `npm run seed` first, then zip
  python scripts/package_release.py               zip (adds usls_gs_demo.sqlite3 if present)

Tracked files only (git ls-files), so .venv, node_modules, .env, caches never get in.
AI coding-assistant files (agent rules, plans, skills) are left out; the in-app Policy
Assistant (policy_rag.py, .rag_index) is an app feature and stays. Stdlib only.
"""
from __future__ import annotations

import argparse
import sqlite3
import subprocess
import sys
import zipfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOP = "CAP-2521-IT-CAPSTONE-PROJECT"
OUT = ROOT / "dist_release" / f"{TOP}.zip"
DB = "usls_gs_demo.sqlite3"

AI_PREFIXES = (".claude/", ".codex/", ".planning/", ".agents/", ".cursor", ".windsurf", ".github/copilot", "archive/codex/")
AI_FILES = {"AGENTS.md", "CLAUDE.md", "GEMINI.md", ".cursorrules", ".windsurfrules",
            "NEXT_SESSION_PLAN.md", "CHECKLIST_PHASE_PLAN.md", "DEFENSE_REVISIONS.md",  # agent work queues
            "Documents/Capstone/Proposal/PROPOSAL_EDIT_NOTES.md", "Documents/Capstone/UAT/UAT-REVIEW-NOTES.md",
            "scripts/package_release.py", "tests/test_package_release.py"}
SKIP_PREFIXES = ("test-results/", "frontend/e2e-artifacts/", "outputs/", "demo_sandboxes/", "dist_release/", "archive/", "Documents/Archive/")

HOW_TO = """USLS Graduate School platform - how to run it

Needs only Python 3.11 or newer (no Node.js). The first run needs internet once, to install the Python packages.

Windows
  Start:  double-click Start.exe   (first run installs packages: a few minutes, internet needed)
  Stop:   double-click Stop.exe

Mac
  Start:  double-click Start.command   (first time: right-click > Open)
  Stop:   double-click Stop.command

The browser opens at http://localhost:5000
Demo accounts: the sign-in page has a "Demo accounts" panel listing every demo login and the shared
demo password. Click one to fill the form.
If something fails, see instance/app.log.
"""


def classify(path: str) -> str:
    """'ai' or 'skip' (both left out of the zip) or 'app' (zipped)."""
    p = path.replace("\\", "/")
    if p in AI_FILES or p.startswith(AI_PREFIXES):
        return "ai"
    name = p.rsplit("/", 1)[-1]
    if (name == ".env" or (name.startswith(".env.") and name != ".env.example")) or "__pycache__/" in p or p.endswith((".pyc", ".pyo")):
        return "skip"
    if p.startswith(SKIP_PREFIXES) or p.lower().endswith(".zip"):
        return "skip"
    return "app"


def tracked() -> list[str]:
    out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, check=True, capture_output=True).stdout
    return [f for f in out.decode("utf-8").split("\0") if f]


def seed() -> None:
    subprocess.run("npm run seed", cwd=ROOT, shell=True, check=True)
    db = ROOT / DB
    if db.exists():  # fold the -wal into the main file so zipping the .sqlite3 alone is complete
        with sqlite3.connect(db) as con:
            con.execute("PRAGMA wal_checkpoint(TRUNCATE)")


def plan() -> tuple[list[tuple[Path, str]], Counter, Counter]:
    """(disk path, arcname inside top folder) list, category counts, top-level counts of AI files."""
    items, cats, ai_top = [], Counter(), Counter()
    for f in tracked():
        kind = classify(f)
        if not (ROOT / f).is_file():
            cats["missing"] += 1
            continue
        cats[kind] += 1
        if kind == "ai":
            ai_top[f.split("/")[0]] += 1
        if kind != "app":
            continue
        items.append((ROOT / f, f))
    extras = [DB, "Start.exe", "Stop.exe"]
    dist = ROOT / "frontend" / "dist"  # prebuilt web pages so the target machine does not need Node
    if dist.is_dir():
        extras += [str(p.relative_to(ROOT)).replace("\\", "/") for p in dist.rglob("*") if p.is_file()]
    names = {a for _, a in items}
    for e in extras:
        if (ROOT / e).is_file() and e not in names:
            items.append((ROOT / e, e))
            cats["extra"] += 1
    return items, cats, ai_top


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--seed-db", action="store_true")
    ap.add_argument("--no-build", action="store_true", help="reuse the existing frontend/dist")
    args = ap.parse_args()
    if args.seed_db and not args.dry_run:
        seed()
    dist = ROOT / "frontend" / "dist"
    if not args.dry_run:
        if not args.no_build:
            subprocess.run("npm run build:web", cwd=ROOT, shell=True, check=True)
        if not (dist / "index.html").is_file():
            sys.exit("frontend/dist/index.html is missing: build the web pages first (or drop --no-build).")
        (dist / ".prebuilt").write_text("prebuilt by package_release.py\n")
    items, cats, ai_top = plan()
    print("files per category:", dict(cats))
    print("left out (AI tooling):", ai_top.most_common(8))
    for name in ("usls_gs_demo.sqlite3", "Start.exe", "Stop.exe"):
        if not (ROOT / name).is_file():
            print(f"note: {name} not found, not included")
    if args.dry_run:
        print(f"dry run: {len(items)} files would be zipped")
        return 0
    OUT.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for disk, arc in items:
            if arc.endswith((".command", ".sh")):  # Mac/Linux scripts: LF endings + executable bit
                info = zipfile.ZipInfo.from_file(disk, f"{TOP}/{arc}")
                info.external_attr = 0o100755 << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                z.writestr(info, disk.read_bytes().replace(b"\r\n", b"\n"))
            else:
                z.write(disk, f"{TOP}/{arc}")
        z.writestr(f"{TOP}/HOW-TO-RUN.txt", HOW_TO)
    print(f"wrote {OUT}: {len(items) + 1} files, {OUT.stat().st_size / 1e6:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
