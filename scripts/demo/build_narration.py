"""Turn the recorded timelines + narration.json into the narration script (Word + PDF) and one .srt per video.

    E:/Temp/claude/docs-venv/Scripts/python.exe scripts/demo/build_narration.py --videos <dir with *.timeline.json>

The .srt files are a teleprompter: load one next to its video in the editor (CapCut, Clipchamp, DaVinci) and read
each line while it shows; delete the subtitle track before exporting if you do not want captions in the final video.
"""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "Documents" / "CAPSTONE_ONLY" / "Demo_Migui"
NARRATION = json.loads((HERE / "narration.json").read_text(encoding="utf-8"))
GREEN = RGBColor(0x0F, 0x5C, 0x3F)
SOFFICE = "E:/LibreOffice/program/soffice.exe"
CLOSING = [
    "Rules with a source. Every rule the workflows follow sits in one register, with the Handbook or Protocol page it comes from, and a label saying whether the system enforces it, only documents it, or still needs review. The same rules appear on the screen where they apply, and a refusal quotes the rule.",
    "A policy library and an assistant that cites its source. The Policy Assistant answers only from the Graduate School's own documents, names the document and the page it used, and says so when the documents do not cover a question.",
    "Panel matching that explains itself. Each faculty member gets a score out of one hundred, from the similarity between the paper and their expertise, their availability and their workload, and the breakdown is on the screen. A person still chooses the panel.",
    "Scheduling that checks before it books. It reads availability, suggests the best shared times, and separates hard stops, like a double-booked panelist, from warnings that can be overridden with a recorded reason.",
    "Shared boards and reports computed from records. Leave, readmission, AWOL, withdrawal, practicum and graduation all run on the same staged boards, every move is recorded, and Reports and Analytics are computed from those records.",
    "What connects all five: each one takes data the Graduate School already has, together with the policy that governs it, and turns it into a decision, a warning or a measurement, instead of only storing a record.",
    "And our honest limits: the portal sends no e-mail, Google Calendar is optional, official student, enrollment and grade data come only from AIMS, and the rules marked Needs review wait for the Graduate School's validation. Thank you.",
]


def ts(sec: float, srt: bool = False) -> str:
    m, s = divmod(max(sec, 0), 60)
    if srt:
        h, m = divmod(int(m), 60)
        return f"{h:02d}:{m:02d}:{int(s):02d},{int((s % 1) * 1000):03d}"
    return f"{int(m)}:{int(s):02d}"


def rows_for(key: str, events: list[dict]) -> list[tuple[float, float, str, str]]:
    """(start, end, on screen, say) for every event that has a line."""
    out, step = [], ""
    for i, e in enumerate(events):
        end = events[i + 1]["t"] if i + 1 < len(events) else e["t"] + 3
        if e["kind"] == "step":
            step = e["label"][:1].upper() + e["label"][1:]
            continue
        if e["kind"] == "card" and e["label"].startswith("Part "):
            line, screen = NARRATION.get(f"{key}:intro", ""), "Title card"
        elif e["kind"] == "card":
            continue
        elif e["kind"] == "signin":
            role = e["role"] or "Student"
            line, screen = NARRATION.get(f"{key}:signin:{role}", ""), e["label"][:1].upper() + e["label"][1:]
            # the sign-in card came just before: start the line there
            prev = events[i - 1] if i else e
            e = {**e, "t": prev["t"] if prev["kind"] == "card" else e["t"]}
        elif e["kind"] == "hold":
            line, screen = NARRATION.get(e["label"], ""), step
        else:
            continue
        if line:
            out.append((e["t"], end, screen, line))
    return out


def shade(cell, fill: str) -> None:
    pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    pr.append(shd)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--videos", required=True)
    args = ap.parse_args()
    vids = Path(args.videos)

    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)
    sec.left_margin = sec.right_margin = Cm(1.8)
    sec.top_margin = sec.bottom_margin = Cm(1.6)
    doc.styles["Normal"].font.name, doc.styles["Normal"].font.size = "Calibri", Pt(10.5)
    for name, size in (("Heading 1", 15), ("Heading 2", 12)):
        st = doc.styles[name]
        st.font.name, st.font.size, st.font.color.rgb = "Calibri", Pt(size), GREEN
        st.paragraph_format.keep_with_next = True
    t = doc.add_paragraph()
    r = t.add_run("Demo Narration Script — Migui's parts")
    r.bold, r.font.size, r.font.color.rgb = True, Pt(20), GREEN
    doc.add_paragraph(
        "Read each line while its screen shows. The time is where the line starts in the video (minutes:seconds). The video "
        "holds still on each screen long enough for its line at a calm pace; if you need longer, pause or slow that clip in "
        "your editor. Each video also has a matching .srt file with the same lines, usable as a teleprompter track.")

    for tl in sorted(vids.glob("*.timeline.json")):
        stem = tl.name.replace(".timeline.json", "")
        key = stem.split("-")[0] + ("-" + stem.split("-")[1] if stem.split("-")[1].isdigit() else "")
        events = json.loads(tl.read_text(encoding="utf-8"))
        rows = rows_for(key, events)
        dur = events[-1]["t"] if events else 0
        doc.add_heading(f"{stem.replace('-', ' ', 1).replace('-', ' ')}  ({ts(dur)})", 1)
        doc.add_paragraph(f"Video: {stem}.mp4").runs[0].italic = True
        table = doc.add_table(rows=1, cols=3)
        table.style = "Table Grid"
        table.autofit = False
        for j, (w, h) in enumerate(((1.4, "Time"), (4.6, "On screen"), (11.4, "Say"))):
            table.columns[j].width = Cm(w)
            c = table.rows[0].cells[j]
            c.width = Cm(w)
            c.text = ""
            run = c.paragraphs[0].add_run(h)
            run.bold = True
            shade(c, "DCEFE6")
        srt = []
        for n, (start, end, screen, line) in enumerate(rows, 1):
            cells = table.add_row().cells
            for j, (w, val) in enumerate(((1.4, ts(start)), (4.6, screen), (11.4, line))):
                cells[j].width = Cm(w)
                cells[j].text = ""
                run = cells[j].paragraphs[0].add_run(val)
                run.font.size = Pt(9 if j == 1 else 10.5)
            srt.append(f"{n}\n{ts(start, True)} --> {ts(max(end - 0.2, start + 1), True)}\n{line}\n")
        (vids / f"{stem}.srt").write_text("\n".join(srt), encoding="utf-8")

    doc.add_heading("2m Best Features (closing, no video — say it over the closing slide, about 2 minutes)", 1)
    for line in CLOSING:
        doc.add_paragraph(line, style="List Number")

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "NARRATION-SCRIPT.docx"
    doc.save(path)
    subprocess.run([SOFFICE, "--headless", "-env:UserInstallation=file:///E:/Temp/claude/lo-profile-narr", "--convert-to", "pdf",
                    "--outdir", str(OUT), str(path)], check=False, capture_output=True)
    print("saved", path)


if __name__ == "__main__":
    main()
