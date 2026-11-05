#!/usr/bin/env python
"""Build the paginated proposal end to end and measure it with LibreOffice.

    python scripts/docs/build_proposal.py SRC.docx OUT.docx [--workdir DIR] [--soffice PATH] [--no-render]

1. paginate_proposal.py SRC -> step1 (estimated labels)
2. LibreOffice renders step1 to PDF, measure_proposal_pages.py reads the page of every heading/caption
3. paginate_proposal.py SRC --labels measured -> OUT
4. LibreOffice renders OUT again and the labels are measured once more; the run is "stable" when they match

Use --no-render when LibreOffice is not installed: OUT then carries estimated labels only.
Always run it on the ORIGINAL document or on a previous OUT - both give the same result (idempotent).
"""
import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import measure_proposal_pages as mp  # noqa: E402
import paginate_proposal as pp  # noqa: E402

DEFAULT_SOFFICE = "E:/LibreOffice/program/soffice.exe"
DEFAULT_PROFILE = "file:///E:/Temp/claude/lo-profile-docs"


def render(soffice, profile, docx, outdir):
    outdir.mkdir(parents=True, exist_ok=True)
    subprocess.run([soffice, "-env:UserInstallation=" + profile, "--headless", "--convert-to", "pdf",
                    "--outdir", str(outdir), str(docx)], check=True, capture_output=True, timeout=900)
    return outdir / (Path(docx).stem + ".pdf")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--workdir", default=str(Path(tempfile.gettempdir()) / "proposal-build"))
    ap.add_argument("--soffice", default=DEFAULT_SOFFICE)
    ap.add_argument("--profile", default=DEFAULT_PROFILE)
    ap.add_argument("--no-render", action="store_true")
    a = ap.parse_args(argv)
    work = Path(a.workdir)
    work.mkdir(parents=True, exist_ok=True)
    step1 = work / "step1.docx"
    pp.transform(a.src, str(step1))
    if a.no_render or not Path(a.soffice).exists():
        pp.transform(a.src, a.out)
        print("written without measured labels:", a.out)
        return
    labels, st = mp.measure(str(step1), str(render(a.soffice, a.profile, step1, work / "pdf1")))
    print("pass 1: %(pdf_pages)d pdf pages, %(matched)d/%(targets)d matched" % st)
    (work / "labels.json").write_text(json.dumps(labels, indent=0, ensure_ascii=False), encoding="utf-8")
    pp.transform(a.src, a.out, labels)
    labels2, st2 = mp.measure(a.out, str(render(a.soffice, a.profile, Path(a.out), work / "pdf2")))
    print("pass 2: %(pdf_pages)d pdf pages, %(matched)d/%(targets)d matched" % st2)
    print("labels stable:", labels == labels2)


if __name__ == "__main__":
    main()
