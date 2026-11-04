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
NARRATION = json.loads((HERE / "narration.json").read_text(encoding="utf-8"))
GREEN = RGBColor(0x0F, 0x5C, 0x3F)
SOFFICE = "E:/LibreOffice/program/soffice.exe"


def ts(sec: float, srt: bool = False) -> str:
    m, s = divmod(max(sec, 0), 60)
    if srt:
        h, m = divmod(int(m), 60)
        return f"{h:02d}:{m:02d}:{int(s):02d},{int((s % 1) * 1000):03d}"
    return f"{int(m)}:{int(s):02d}"


def rows_for(key: str, events: list[dict]) -> list[tuple[float, float, str, str]]:
    """(start, end, on screen, say) for every event that has a line."""
    out, step, seen = [], "", {}
    for i, e in enumerate(events):
        end = events[i + 1]["t"] if i + 1 < len(events) else e["t"] + 3
        if e["kind"] == "step":
            step = e["label"][:1].upper() + e["label"][1:]
            continue
        if e["kind"] == "card":  # marks the moment the login starts; carries no line itself
            continue
        elif e["kind"] == "signin":
            role = e["role"] or "Student"
            seen[role] = seen.get(role, 0) + 1  # a role's second sign-in may have its own ':2' line
            line = NARRATION.get(f"{key}:signin:{role}:{seen[role]}") or NARRATION.get(f"{key}:signin:{role}", "")
            screen = e["label"][:1].upper() + e["label"][1:]
            # the login began at the 'card' event just before: start the line there
            prev = events[i - 1] if i else e
            e = {**e, "t": prev["t"] if prev["kind"] == "card" else e["t"]}
        elif e["kind"] == "hold":
            line, screen = NARRATION.get(e["label"], ""), step
        else:
            continue
        if line:
            out.append((e["t"], end, screen, line))
    return out


def clip_secs(mp4: Path, fallback: float) -> float:
    """Real length of a part, so the joined video's times do not drift (record_demo.py cuts ~1 s after the last event)."""
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.count_frames_and_secs(str(mp4))[1]
    except Exception:  # noqa: BLE001 - no mp4 or no imageio-ffmpeg: the cut point is close enough
        return fallback


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
    ap.add_argument("--full", help="stem of the joined video (e.g. ../Full-Demo): also write one .srt for it and put the "
                                   "script's times on the full video, next to it")
    args = ap.parse_args()
    vids = Path(args.videos)
    full = (vids / args.full).resolve() if args.full else None
    offset, full_srt = 0.0, []

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
        title = stem.replace('-', ' ', 1).replace('-', ' ')
        if full:
            doc.add_heading(f"{title}  (starts at {ts(offset)} in {full.name}.mp4)", 1)
        else:
            doc.add_heading(f"{title}  ({ts(dur)})", 1)
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
            for j, (w, val) in enumerate(((1.4, ts(start + offset if full else start)), (4.6, screen), (11.4, line))):
                cells[j].width = Cm(w)
                cells[j].text = ""
                run = cells[j].paragraphs[0].add_run(val)
                run.font.size = Pt(9 if j == 1 else 10.5)
            srt.append(f"{n}\n{ts(start, True)} --> {ts(max(end - 0.2, start + 1), True)}\n{line}\n")
            full_srt.append(f"{len(full_srt) + 1}\n{ts(start + offset, True)} --> "
                            f"{ts(max(end - 0.2, start + 1) + offset, True)}\n{line}\n")
        (vids / f"{stem}.srt").write_text("\n".join(srt), encoding="utf-8")
        offset += clip_secs(vids / f"{stem}.mp4", dur + 1.0)

    out_dir = full.parent if full else vids
    if full:
        full.with_suffix(".srt").write_text("\n".join(full_srt), encoding="utf-8")
    path = out_dir / "NARRATION-SCRIPT.docx"  # the script lives next to the video it narrates
    doc.save(path)
    subprocess.run([SOFFICE, "--headless", "-env:UserInstallation=file:///E:/Temp/claude/lo-profile-narr", "--convert-to", "pdf",
                    "--outdir", str(out_dir), str(path)], check=False, capture_output=True)
    print("saved", path)


if __name__ == "__main__":
    main()
