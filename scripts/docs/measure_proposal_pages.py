#!/usr/bin/env python
"""Measure the real page of every heading and caption from a LibreOffice render and write labels.json.

Usage (from the repository root, with the project venv):
    python scripts/docs/paginate_proposal.py SRC.docx STEP1.docx
    "E:/LibreOffice/program/soffice.exe" -env:UserInstallation=file:///E:/Temp/claude/lo-profile-docs \
        --headless --convert-to pdf --outdir OUTDIR STEP1.docx
    python scripts/docs/measure_proposal_pages.py STEP1.docx OUTDIR/STEP1.pdf labels.json
    python scripts/docs/paginate_proposal.py SRC.docx FINAL.docx --labels labels.json

The labels are "ii", "xii", "1-1", "5-34", "R-2", "G-3", "A-17" ... computed from the PDF page on which each
heading / caption starts, relative to the first page of its section. LibreOffice lays the document out a little
differently from Word, so these are a much better estimate than the old numbers, but still only a cache: Word
recalculates them when the fields are updated.
"""
import json
import re
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import paginate_proposal as pp  # noqa: E402


def squash(s):
    s = s.replace("\u2013", "-").replace("\u2014", "-").replace("\u2019", "'").replace("\u00a0", " ")
    return re.sub(r"\s+", " ", s).strip().lower()


def measure(docx, pdf):
    """Return (labels {anchor: label}, stats dict) for a paginated docx and its LibreOffice PDF."""
    import pymupdf

    tmp = Path(tempfile.mkdtemp()) / "measure.docx"
    rep = pp.transform(docx, str(tmp))
    targets = rep["targets"]
    doc = pymupdf.open(pdf)
    pages = []
    for i in range(doc.page_count):
        raw = doc[i].get_text()
        lines = [squash(l) for l in raw.split("\n") if l.strip()]
        pages.append((squash(raw), lines))

    def page_heading(i, text):
        """True when the page starts with this heading (front matter headings begin their page)."""
        want = squash(text)
        return any(l == want for l in pages[i][1][:4])

    # the first page of chapter 1 separates the front matter from the body
    body_start = next(i for i in range(len(pages)) if page_heading(i, targets[[t["sec"] for t in targets].index("ch1")]["text"]))
    cursor = 0
    found = {}
    unmatched = []
    for t in targets:
        if t["sec"] in ("front", "toc", "lists"):
            p = next((i for i in range(cursor, body_start) if page_heading(i, t["text"])), None)
        else:
            want = squash(t["text"])
            p = None
            for probe in (want, want[:48], want[:28]):
                p = next((i for i in range(max(cursor, body_start), len(pages)) if probe in pages[i][0]), None)
                if p is not None:
                    break
        if p is None:
            unmatched.append(t["text"])
            continue
        cursor = p
        found[t["anchor"]] = p
    first = {}
    for t in targets:
        if t["anchor"] in found and t["sec"] not in first:
            first[t["sec"]] = found[t["anchor"]]
    labels = {}
    last = None
    for t in targets:
        sec = t["sec"]
        if t["anchor"] in found:
            p = found[t["anchor"]]
            n = p - first[sec] + 1
            if sec in ("front", "toc", "lists"):
                lab = pp.roman(p)  # title page = 0, abstract = i
            elif sec.startswith("ch"):
                lab = "%s-%d" % (sec[2:], n)
            else:
                lab = "%s%d" % (pp.PREFIX[sec], n)
            last = lab
        else:
            lab = last  # carry the previous label forward
        if lab:
            labels[t["anchor"]] = lab
    stats = {"pdf_pages": len(pages), "targets": len(targets), "matched": len(found), "unmatched": unmatched}
    return labels, stats


def main(argv):
    docx, pdf, out = argv[1:4]
    labels, stats = measure(docx, pdf)
    Path(out).write_text(json.dumps(labels, indent=0, ensure_ascii=False), encoding="utf-8")
    print("pages in PDF: %d; targets: %d; matched: %d; unmatched: %d" %
          (stats["pdf_pages"], stats["targets"], stats["matched"], len(stats["unmatched"])))
    for u in stats["unmatched"][:20]:
        print("  unmatched:", u[:90])


if __name__ == "__main__":
    main(sys.argv)
