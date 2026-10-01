"""Re-walk the demonstration in a running copy of the app and save screenshots.

Start the app first (demo mode, any database you can throw away):

    DATABASE_URL=sqlite:///E:/Temp/claude/walkthrough/wt.sqlite3 FLASK_PORT=5074 DEMO_MODE=1 \
        .venv/Scripts/python.exe app.py

then (``WT_BASE`` defaults to http://127.0.0.1:5074):

    .venv/Scripts/python.exe scripts/docs/walkthrough/capture_walkthrough.py            # every case
    .venv/Scripts/python.exe scripts/docs/walkthrough/capture_walkthrough.py --only 05 07

Each ``capture/case_NN_*.py`` module mirrors ``cases/NN_*.json``. Screenshots go
to ``shots/``; a per-step result log goes to ``shots/_capture_log.json``.
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
