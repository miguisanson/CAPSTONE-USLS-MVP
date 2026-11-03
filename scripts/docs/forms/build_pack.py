#!/usr/bin/env python3
"""Convert every forms .docx to a PDF beside it (LibreOffice) and rebuild the print pack.

Run after build_forms.py:  E:/Temp/claude/docs-venv/Scripts/python.exe scripts/docs/forms/build_pack.py [--no-convert]
Pack order: 0 Forms Control (GS-P-01, GS-P-02), chapter folders 4.01..4.19, Platform Basis, Supplementary Forms.
Needs pymupdf and LibreOffice (path below).
"""
import subprocess
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "Documents" / "USLS_Forms"
SOFFICE = "E:/LibreOffice/program/soffice.exe"
PROFILE = "file:///E:/Temp/claude/lo-profile-fdocs"
PACK = OUT / "USLS-GS-Forms-Pack.pdf"


def folders():
    # alphabetical order is the pack order: "0 ..." < "4.01 ..." < "Platform Basis" < "Supplementary Forms"
    return sorted(p for p in OUT.iterdir() if p.is_dir())


def convert():
    for folder in folders():
        files = sorted(folder.glob("*.docx"))
        if files:
            subprocess.run([SOFFICE, f"-env:UserInstallation={PROFILE}", "--headless", "--convert-to", "pdf",
                            "--outdir", str(folder), *map(str, files)], check=True, capture_output=True)


def pack():
    merged = pymupdf.open()
    counts = {}
    for folder in folders():
        for pdf in sorted(folder.glob("*.pdf")):
            doc = pymupdf.open(pdf)
            counts[pdf.stem] = len(doc)
            merged.insert_pdf(doc)
    merged.save(PACK)
    return counts, len(merged)


if __name__ == "__main__":
    if "--no-convert" not in sys.argv:
        convert()
    counts, total = pack()
    for name, n in counts.items():
        print(f"{n:2d}  {name}")
    print(f"pack: {total} pages, {len(counts)} documents -> {PACK}")
