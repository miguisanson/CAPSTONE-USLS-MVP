#!/usr/bin/env python
"""Regenerate the whole proposal from the code, in the right order (idempotent).

    python scripts/docs/rebuild_proposal.py IN.docx OUT.docx [--suite | --run-log LOG | --reuse-inventory]

The steps (each is its own script and can be run alone, see PROPOSAL_EDIT_NOTES.md):

  1. collect       sync_proposal_inventories.py collect   (project venv: Flask importable, never a real database)
                   --suite       runs the whole test suite first (about 20 minutes) and records the run
                   --run-log LOG parses the log of an earlier `unittest -v` run (with --started / --ended)
                   --reuse-inventory skips this step and keeps scripts/docs/proposal_inventory.json as it is
  2. business      add_business_rules_section.py           (lxml venv) sections 4.5, 5.14, Appendix AA
  3. inventories   sync_proposal_inventories.py apply      (lxml venv) Appendices V W Y Z, 5.9.2 fields, Chapter 6,
                                                            proposal_text_sync.json
  4. screens       sync_proposal_screens.py                (lxml venv) Section 5.10 entries and portal page tables
  5. paginate      build_proposal.py                       (project venv + LibreOffice) sections, page labels, TOC,
                                                            lists of figures and tables

The two interpreters exist because reading the code needs Flask and editing the .docx needs lxml; on this
machine they are in different virtual environments (defaults below, override with --py-project / --py-lxml).
"""
import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent


def run(cmd, label):
    print(f"\n=== {label}\n    " + " ".join(str(c) for c in cmd), flush=True)
    res = subprocess.run([str(c) for c in cmd], cwd=HERE.parent.parent)
    if res.returncode:
        raise SystemExit(f"step failed: {label} (exit {res.returncode})")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("dst")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--suite", action="store_true", help="run the whole test suite first")
    mode.add_argument("--run-log", help="log of an earlier unittest -v run")
    mode.add_argument("--reuse-inventory", action="store_true", help="keep proposal_inventory.json as it is")
    ap.add_argument("--started")
    ap.add_argument("--ended")
    ap.add_argument("--py-project", default="E:/Github_Projects/CAPSTONE-USLS-MVP/.venv/Scripts/python.exe")
    ap.add_argument("--py-lxml", default="E:/Temp/claude/opsman-venv/Scripts/python.exe")
    ap.add_argument("--profile", default="file:///E:/Temp/claude/lo-profile-docs3")
    ap.add_argument("--workdir", default=str(Path(tempfile.gettempdir()) / "proposal-rebuild"))
    ap.add_argument("--no-render", action="store_true", help="skip the LibreOffice page measuring (estimated labels)")
    a = ap.parse_args(argv)

    work = Path(a.workdir)
    work.mkdir(parents=True, exist_ok=True)
    d = HERE
    if not a.reuse_inventory:
        cmd = [a.py_project, d / "sync_proposal_inventories.py", "collect"]
        if a.suite:
            cmd.append("--run-suite")
        elif a.run_log:
            cmd += ["--run-log", a.run_log]
            if a.started:
                cmd += ["--started", a.started]
            if a.ended:
                cmd += ["--ended", a.ended]
        run(cmd, "1 collect (routes, tables, tests, seeded dataset)")
    mid1, mid2, mid3 = work / "step2.docx", work / "step3.docx", work / "step4.docx"
    run([a.py_lxml, d / "add_business_rules_section.py", a.src, mid1], "2 business rules sections")
    run([a.py_lxml, d / "sync_proposal_inventories.py", "apply", mid1, mid2], "3 inventories, tables, text corrections")
    run([a.py_lxml, d / "sync_proposal_screens.py", mid2, mid3], "4 screens")
    cmd = [a.py_project, d / "build_proposal.py", mid3, a.dst, "--profile", a.profile, "--workdir", work / "pages"]
    if a.no_render:
        cmd.append("--no-render")
    run(cmd, "5 pagination, table of contents, page labels")
    print("\ndone:", a.dst)


if __name__ == "__main__":
    main()
