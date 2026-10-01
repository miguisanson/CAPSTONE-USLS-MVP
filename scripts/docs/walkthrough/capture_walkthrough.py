"""Re-walk the demonstration in a running copy of the app and save screenshots.

Use a FRESH throw-away database (cases 15 and 17 consume seeded demo students that cannot be reset),
demo mode, and a port of your own (5074 here; 5061 is blocked by Chromium):

    npm --prefix frontend run build
    DATABASE_URL=sqlite:///E:/Temp/claude/walkthrough/wt2.sqlite3 FLASK_PORT=5074 DEMO_MODE=1         .venv/Scripts/python.exe app.py          # first start seeds; wait for GET /api/auth/config -> 200

then, from the repo root (``WT_BASE`` defaults to http://127.0.0.1:5074):

    PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -u scripts/docs/walkthrough/capture_walkthrough.py            # every case, ~45 min
    ... capture_walkthrough.py --only 05 07          # chosen cases

Cases touch disjoint demo students, so these groups can run in parallel processes against one server (about 25 min):
    --only 00 01 02 03 04 05 | --only 06 07 08 09 21 | --only 10 11 12 19 20 90 | --only 13 14 18 | --only 15 16 17 ; then --only 22
Order constraints inside a group: 06 before 07, 13 before 14 before 18, 15 before 16 and 17. Cases 15/17/18 book defenses a few minutes
ahead and wait for the start time, so run them on a weekday between 08:00 and 16:00 (Asia/Manila).

Each ``capture/case_NN_*.py`` mirrors ``cases/NN_*.json``. Screenshots go to ``shots/``; a per-step log goes to
``shots/_capture_log.json`` (overwritten by every process). A failed step keeps the screenshot from the previous run.
Then build the document:  E:/Temp/claude/wt-venv/Scripts/python.exe scripts/docs/walkthrough/build_walkthrough.py
"""
from __future__ import annotations

import argparse
import importlib
import pkgutil
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from playwright.sync_api import sync_playwright  # noqa: E402

import capture  # noqa: E402
from capture.common import Runtime  # noqa: E402


def case_modules():
    names = sorted(m.name for m in pkgutil.iter_modules(capture.__path__) if m.name.startswith("case_"))
    return names


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", nargs="*", help="case numbers to run, e.g. 01 05")
    args = parser.parse_args()
    names = case_modules()
    if args.only:
        names = [n for n in names if any(n.startswith(f"case_{o}") for o in args.only)]
    started = time.time()
    failures = 0
    with sync_playwright() as pw:
        rt = Runtime(pw)
        for name in names:
            module = importlib.import_module(f"capture.{name}")
            rt.case = name
            print(f"== {name}")
            try:
                module.run(rt)
            except Exception as exc:  # noqa: BLE001
                failures += 1
                rt.log.append({"case": name, "kind": "FAIL", "message": "case aborted", "detail": repr(exc)[:300]})
                print(f"  [{name}] CASE ABORTED: {exc!r}")
            finally:
                rt.write_log()
        rt.browser.close()
    bad = [e for e in rt.log if e["kind"] == "FAIL"]
    print(f"done in {time.time() - started:.0f}s; failed steps: {len(bad)}")
    for entry in bad:
        print("  FAIL", entry["case"], "-", entry["message"], "-", entry.get("detail", ""))
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
