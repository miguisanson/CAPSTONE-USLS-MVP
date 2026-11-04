#!/usr/bin/env python3
"""Build the University of St. La Salle Graduate School forms and process documents.

One script, one engine: every form is a plain data spec (see FORMS below) rendered
by the same functions, so layout, fonts and control fields stay identical.

Run:  E:/Temp/claude/docs-venv/Scripts/python.exe scripts/docs/forms/build_forms.py
Output: Documents/Graduate_School/Forms/<folder>/<code> <Name>.docx, one folder per Operations Manual chapter
(see .planning/forms-ops/CONTRACT.md), plus Platform Basis and Supplementary Forms.
Needs python-docx only. Pass codes (for example 07 12 GS-P-04) to rebuild only those; P rebuilds all GS-P documents.
Then run build_pack.py for the PDFs and the print pack.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_ROW_HEIGHT_RULE, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "Documents" / "Graduate_School" / "Forms"

# Operations Manual chapter (as the manual numbers it) -> output folder.
CHAPTER_FOLDERS = {
    "4.1": "4.01 Admission Handoff and Onboarding",
    "4.2": "4.02 Enrollment and Academic Load",
    "4.3": "4.03 Course Offering and Course Adjustments",
    "4.4": "4.04 Withdrawal of Subject",
    "4.5": "4.05 Dropping",
    "4.6": "4.06 Leave of Absence",
    "4.7": "4.07 Return from Leave and Readmission",
    "4.8": "4.08 Absence Without Leave",
    "4.9": "4.09 Residency Enrollment",
    "4.10": "4.10 Comprehensive Examination",
    "4.11": "4.11 Title Defense",
    "4.12": "4.12 Adviser Designation and Change of Title",
    "4.13": "4.13 Proposal Defense and Ethics Review",
    "4.14": "4.14 Final Defense",
    "4.15": "4.15 Revisions, Completion and Publication",
    "4.16": "4.16 Defense Scheduling",
    "4.17": "4.17 Practicum",
    "4.18": "4.18 Graduation",
    "4.19": "4.19 Records Handoff to the Registrar",
}
CONTROL_FOLDER = "0 Forms Control"
PLATFORM_FOLDER = "Platform Basis"
SUPPLEMENTARY_FOLDER = "Supplementary Forms"
# The manual chapter each form belongs to. Forms 45-48 sit in the Platform Basis chapters 4.20-4.24 and forms
# 49-54 in their host chapter; the folder for those two groups is not the chapter folder (see add()).
FORM_CHAPTER = {
    "01": "4.1", "02": "4.2", "03": "4.3", "04": "4.3", "05": "4.4", "06": "4.5", "07": "4.6", "08": "4.7",
    "09": "4.8", "10": "4.9", "11": "4.17", "12": "4.17", "13": "4.17", "14": "4.10", "15": "4.10",
    "16": "4.11", "17": "4.11", "18": "4.11", "19": "4.12", "20": "4.12", "21": "4.12", "22": "4.12",
    "23": "4.12", "24": "4.12", "25": "4.13", "26": "4.13", "27": "4.13", "28": "4.16", "29": "4.13",
    "30": "4.13", "31": "4.13", "32": "4.14", "33": "4.14", "34": "4.14", "35": "4.14", "36": "4.15",
    "37": "4.15", "38": "4.15", "39": "4.15", "40": "4.15", "41": "4.15", "42": "4.18", "43": "4.18",
    "44": "4.19", "45": "4.23", "46": "4.21", "47": "4.20", "48": "4.20", "49": "4.5", "50": "4.5",
    "51": "4.2", "52": "4.3", "53": "4.2", "54": "4.18",
}
ALSO_CHAPTER = {"27": "4.14"}   # Form 4 is used in two chapters; its home folder is the first

FONT = "Arial"
BODY = 10.5      # body text, pt
NOTE = 9.0       # control labels, field captions, footer
INSTR = 9.5      # instruction box
TITLE = 14.0
CHECK_FONT = "Segoe UI Symbol"
BOX = "\u2610"   # ballot box
SECTION_FILL = "E2EBE2"
HEAD_FILL = "D3E3D3"
INSTR_FILL = "F4F7F4"
LINE_COLOR = "7F7F7F"

PORTRAIT_W = 17.0   # A4 minus 2 cm margins
LANDSCAPE_W = 25.7


# --------------------------------------------------------------------------- xml helpers
def _el(tag, **attrs):
    e = OxmlElement(tag)
    for k, v in attrs.items():
        e.set(qn(k.replace("_", ":", 1)), str(v))
    return e


def shade(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    for old in tcPr.findall(qn("w:shd")):
        tcPr.remove(old)
    tcPr.append(_el("w:shd", w_val="clear", w_color="auto", w_fill=fill))


def borders(cell, **sides):
    """sides: top/bottom/left/right = None (no border) or (size_eighths_pt, color)."""
    tcPr = cell._tc.get_or_add_tcPr()
    for old in tcPr.findall(qn("w:tcBorders")):
        tcPr.remove(old)
    b = OxmlElement("w:tcBorders")
    for side in ("top", "left", "bottom", "right"):
        spec = sides.get(side, "keep")
        if spec == "keep":
            continue
        if spec is None:
            b.append(_el(f"w:{side}", w_val="nil"))
        else:
            sz, color = spec
            b.append(_el(f"w:{side}", w_val="single", w_sz=sz, w_space=0, w_color=color))
    tcPr.append(b)


def table_borders(table, spec):
    """spec None -> no borders; else (size, color) all sides + inside."""
    tblPr = table._tbl.tblPr
    for old in tblPr.findall(qn("w:tblBorders")):
        tblPr.remove(old)
    b = OxmlElement("w:tblBorders")
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        if spec is None:
            b.append(_el(f"w:{side}", w_val="nil"))
        else:
            b.append(_el(f"w:{side}", w_val="single", w_sz=spec[0], w_space=0, w_color=spec[1]))
    tblPr.append(b)


def cell_margins(table, top=40, bottom=40, left=80, right=80):
    tblPr = table._tbl.tblPr
    for old in tblPr.findall(qn("w:tblCellMar")):
        tblPr.remove(old)
    m = OxmlElement("w:tblCellMar")
    for side, v in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        m.append(_el(f"w:{side}", w_w=v, w_type="dxa"))
    tblPr.append(m)


def fix_widths(table, widths_cm):
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    tblPr = table._tbl.tblPr
    for old in tblPr.findall(qn("w:tblLayout")):
        tblPr.remove(old)
    tblPr.append(_el("w:tblLayout", w_type="fixed"))
    for old in tblPr.findall(qn("w:tblW")):
        tblPr.remove(old)
    tblPr.append(_el("w:tblW", w_w=int(sum(widths_cm) * 567), w_type="dxa"))
    grid = table._tbl.tblGrid
    for i, gc in enumerate(grid.findall(qn("w:gridCol"))):
        gc.set(qn("w:w"), str(int(widths_cm[i] * 567)))
    for row in table.rows:
        for i, cell in enumerate(row.cells):
            if i < len(widths_cm):
                cell.width = Cm(widths_cm[i])


def row_height(row, cm, exact=False):
    row.height = Cm(cm)
    row.height_rule = WD_ROW_HEIGHT_RULE.EXACTLY if exact else WD_ROW_HEIGHT_RULE.AT_LEAST


def no_split(row):
    trPr = row._tr.get_or_add_trPr()
    trPr.append(_el("w:cantSplit"))


def repeat_header(row):
    trPr = row._tr.get_or_add_trPr()
    trPr.append(_el("w:tblHeader"))


def keep_together(table, include_last=False):
    rows = table.rows if include_last else table.rows[:-1]
    for r in rows:
        for c in r.cells:
            for p in c.paragraphs:
                p.paragraph_format.keep_with_next = True


def valign(cell, where="center"):
    tcPr = cell._tc.get_or_add_tcPr()
    for old in tcPr.findall(qn("w:vAlign")):
        tcPr.remove(old)
    tcPr.append(_el("w:vAlign", w_val=where))


# --------------------------------------------------------------------------- text helpers
def style_run(run, size=BODY, bold=False, italic=False, font=FONT, color=None):
    run.font.name = font
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.insert(0, rFonts)
    for a in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rFonts.set(qn(a), font)
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    if color:
        run.font.color.rgb = RGBColor.from_string(color)


def fmt(par, before=0, after=0, align=None, keep_next=False, line=1.0):
    pf = par.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    pf.line_spacing = line
    if align is not None:
        par.alignment = align
    if keep_next:
        pf.keep_with_next = True


NO_BREAK_CODES = [False]   # the routing guide turns this on: GS-F-17 must not wrap after "GS-"


def add_code_runs(par, text, size, bold, italic, color):
    for part in re.split(r"(GS-[FP]-\d\d)", text):
        if not part:
            continue
        if re.fullmatch(r"GS-[FP]-\d\d", part):
            pieces = part.split("-")
            for i, piece in enumerate(pieces):
                if i:
                    r = par.add_run()
                    style_run(r, size=size, bold=bold, italic=italic, color=color)
                    r._r.append(OxmlElement("w:noBreakHyphen"))
                r = par.add_run(piece)
                style_run(r, size=size, bold=bold, italic=italic, color=color)
        else:
            r = par.add_run(part)
            style_run(r, size=size, bold=bold, italic=italic, color=color)


def add_text(par, text, size=BODY, bold=False, italic=False, color=None):
    """Add text; every ballot box is set in the symbol font so it renders everywhere."""
    parts = re.split(f"({BOX})", text)
    for part in parts:
        if not part:
            continue
        if part == BOX:
            r = par.add_run(part)
            style_run(r, size=size + 1, font=CHECK_FONT)
        elif NO_BREAK_CODES[0]:
            add_code_runs(par, part, size, bold, italic, color)
        else:
            r = par.add_run(part)
            style_run(r, size=size, bold=bold, italic=italic, color=color)


def cell_text(cell, text, size=BODY, bold=False, italic=False, align=None, after=0, color=None):
    par = cell.paragraphs[0]
    fmt(par, align=align, after=after)
    if text:
        add_text(par, text, size=size, bold=bold, italic=italic, color=color)
    return par


def add_field(par, instr, size=NOTE):
    for kind in ("begin", None, "separate", "text", "end"):
        r = par.add_run()
        style_run(r, size=size)
        if kind in ("begin", "separate", "end"):
            r._r.append(_el("w:fldChar", w_fldCharType=kind))
        elif kind is None:
            it = OxmlElement("w:instrText")
            it.set(qn("xml:space"), "preserve")
            it.text = f" {instr} "
            r._r.append(it)
        else:
            t = OxmlElement("w:t")
            t.text = "1"
            r._r.append(t)


def para_border_bottom(par, sz=8, color="000000"):
    pPr = par._p.get_or_add_pPr()
    pb = OxmlElement("w:pBdr")
    pb.append(_el("w:bottom", w_val="single", w_sz=sz, w_space=1, w_color=color))
    pPr.append(pb)


def para_shade(par, fill):
    pPr = par._p.get_or_add_pPr()
    pPr.append(_el("w:shd", w_val="clear", w_color="auto", w_fill=fill))


# --------------------------------------------------------------------------- document skeleton
def new_document(landscape=False):
    doc = Document()
    sec = doc.sections[0]
    if landscape:
        sec.orientation = WD_ORIENT.LANDSCAPE
        sec.page_width, sec.page_height = Cm(29.7), Cm(21.0)
    else:
        sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)
    for side in ("left_margin", "right_margin", "top_margin", "bottom_margin"):
        setattr(sec, side, Cm(2.0))
    sec.header_distance = Cm(1.0)
    sec.footer_distance = Cm(0.9)
    normal = doc.styles["Normal"]
    normal.font.name = FONT
    normal.font.size = Pt(BODY)
    rPr = normal.element.get_or_add_rPr()
    rf = rPr.find(qn("w:rFonts"))
    if rf is None:
        rf = OxmlElement("w:rFonts")
        rPr.insert(0, rf)
    for a in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rf.set(qn(a), FONT)
    normal.paragraph_format.space_after = Pt(0)
    normal.paragraph_format.space_before = Pt(0)
    # python-docx's default template starts with one empty paragraph: remove it
    body = doc.element.body
    for p in list(body.findall(qn("w:p"))):
        body.remove(p)
    return doc


def institution_header(doc, width):
    for text, size, bold in (("UNIVERSITY OF ST. LA SALLE", 13, True), ("Graduate School", BODY, False)):
        p = doc.add_paragraph()
        fmt(p, align=WD_ALIGN_PARAGRAPH.CENTER)
        add_text(p, text, size=size, bold=bold)
    p = doc.add_paragraph()
    fmt(p, after=3, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_text(p, "Bacolod City", size=BODY)
    para_border_bottom(p, sz=10, color="1F5F2E")


def footer(doc, code, title, width):
    sec = doc.sections[0]
    f = sec.footer
    f.is_linked_to_previous = False
    p = f.paragraphs[0]
    fmt(p)
    para_top = OxmlElement("w:pBdr")
    para_top.append(_el("w:top", w_val="single", w_sz=4, w_space=4, w_color=LINE_COLOR))
    p._p.get_or_add_pPr().append(para_top)
    doc.styles["Footer"].paragraph_format.tab_stops.clear_all()
    p.paragraph_format.tab_stops.add_tab_stop(Cm(width), WD_TAB_ALIGNMENT.RIGHT)
    add_text(p, f"{code}  |  {title}  |  Revision 00", size=8.5)
    r = p.add_run()
    r._r.append(OxmlElement("w:tab"))
    add_text(p, "Page ", size=8.5)
    add_field(p, "PAGE", size=8.5)
    add_text(p, " of ", size=8.5)
    add_field(p, "NUMPAGES", size=8.5)


def title_block(doc, title, subtitle, width):
    p = doc.add_paragraph()
    fmt(p, before=4, after=1 if subtitle else 4, align=WD_ALIGN_PARAGRAPH.CENTER, keep_next=True)
    add_text(p, title.upper(), size=TITLE, bold=True)
    if subtitle:
        p = doc.add_paragraph()
        fmt(p, after=4, align=WD_ALIGN_PARAGRAPH.CENTER, keep_next=True)
        add_text(p, subtitle, size=NOTE, italic=True)


def control_box(doc, code, process, ref, width):
    t = doc.add_table(rows=1, cols=6)
    table_borders(t, (4, LINE_COLOR))
    cell_margins(t, top=30, bottom=30)
    fix_widths(t, [2.2, 3.0, 2.6, 1.6, 3.0, width - 12.4])
    r = t.rows[0]
    no_split(r)
    row_height(r, 0.62)
    for i, v in enumerate(("Form code", code, "Revision no.", "00", "Effectivity date", "")):
        c = r.cells[i]
        valign(c)
        if i % 2 == 0:
            shade(c, HEAD_FILL)
            cell_text(c, v, size=NOTE, bold=True)
        else:
            cell_text(c, v, size=BODY, bold=(i == 1))
    gap(doc, 3)
    return t


def gap(doc, pts=3, keep=False):
    p = doc.add_paragraph()
    fmt(p, keep_next=keep)
    p.paragraph_format.line_spacing = Pt(pts)
    r = p.add_run("")
    r.font.size = Pt(1)
    return p


def instruction_box(doc, items, width, heading="INSTRUCTIONS"):
    t = doc.add_table(rows=1, cols=1)
    table_borders(t, (4, LINE_COLOR))
    cell_margins(t, top=50, bottom=50, left=110, right=110)
    fix_widths(t, [width])
    c = t.rows[0].cells[0]
    shade(c, INSTR_FILL)
    cell_text(c, heading, size=INSTR, bold=True, after=2)
    for i, text in enumerate(items, 1):
        p = c.add_paragraph()
        fmt(p, after=1, line=0.93)
        p.paragraph_format.left_indent = Cm(0.5)
        p.paragraph_format.first_line_indent = Cm(-0.5)
        add_text(p, f"{i}.\u00A0\u00A0", size=INSTR)
        add_text(p, text, size=INSTR)
    gap(doc, 5)


def section_bar(doc, label, width):
    p = doc.add_paragraph()
    fmt(p, before=1, after=2, keep_next=True)
    para_shade(p, SECTION_FILL)
    add_text(p, label, size=BODY, bold=True)
    return p


def field_grid(doc, items, width, label_w=None, chain=False):
    """Boxed write-in cells with a small caption on top, on a 6-column grid.
    items: 'Label' (half width) | ('full', 'Label') | ('tall', 'Label', n_lines)
           | ('cols', [(label, span), ...]) with spans adding up to 6."""
    rows, pending = [], None

    def flush():
        nonlocal pending
        if pending is not None:
            rows.append(([(pending, 6)], 1))
            pending = None

    for it in items:
        if isinstance(it, str):
            if pending is None:
                pending = it
            else:
                rows.append(([(pending, 3), (it, 3)], 1))
                pending = None
        else:
            flush()
            if it[0] == "full":
                rows.append(([(it[1], 6)], 1))
            elif it[0] == "tall":
                rows.append(([(it[1], 6)], it[2]))
            elif it[0] == "cols":
                assert sum(sp for _, sp in it[1]) == 6, it
                rows.append((it[1], 1))
    flush()
    t = doc.add_table(rows=len(rows), cols=6)
    table_borders(t, (4, LINE_COLOR))
    cell_margins(t, top=20, bottom=20, left=80, right=80)
    fix_widths(t, [width / 6] * 6)
    for r, (cells, lines) in zip(t.rows, rows):
        no_split(r)
        row_height(r, 0.62 + 0.4 * (lines - 1))
        col = 0
        for label, span in cells:
            c = r.cells[col].merge(r.cells[col + span - 1]) if span > 1 else r.cells[col]
            cell_text(c, label, size=NOTE, color="404040")
            col += span
    keep_together(t, chain)
    gap(doc, 2, chain)
    return t


def checks(doc, prompt, options, width, cols=2, chain=False):
    if prompt:
        p = doc.add_paragraph()
        fmt(p, after=1, keep_next=True)
        add_text(p, prompt, size=BODY)
    nrows = (len(options) + cols - 1) // cols
    t = doc.add_table(rows=nrows, cols=cols)
    table_borders(t, None)
    cell_margins(t, top=8, bottom=8, left=60, right=60)
    fix_widths(t, [width / cols] * cols)
    for i, opt in enumerate(options):
        r, c = i // cols, i % cols
        cell = t.rows[r].cells[c]
        p = cell.paragraphs[0]
        fmt(p)
        p.paragraph_format.left_indent = Cm(0.55)
        p.paragraph_format.first_line_indent = Cm(-0.55)
        add_text(p, f"{BOX}\u00A0\u00A0{opt}", size=BODY)
    for r in t.rows:
        no_split(r)
    keep_together(t, chain)
    gap(doc, 2, chain)
    return t


def grid_table(doc, columns, rows, width, row_h=0.68, header_rows=1, size=None, chain=False):
    row_h = row_h * 0.85
    """columns: [(name, width_cm)]; rows: int (blank rows) or list of lists (prefilled)."""
    size = size or (BODY if len(columns) <= 5 else NOTE + 0.5)
    pre = rows if isinstance(rows, list) else [[""] * len(columns) for _ in range(rows)]
    t = doc.add_table(rows=1 + len(pre), cols=len(columns))
    table_borders(t, (4, LINE_COLOR))
    cell_margins(t, top=30, bottom=30, left=70, right=70)
    total = sum(w for _, w in columns)
    fix_widths(t, [w * width / total for _, w in columns])
    for i, (name, _) in enumerate(columns):
        c = t.rows[0].cells[i]
        shade(c, HEAD_FILL)
        valign(c)
        cell_text(c, name, size=size, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    repeat_header(t.rows[0])
    no_split(t.rows[0])
    for r, vals in zip(t.rows[1:], pre):
        no_split(r)
        row_height(r, row_h)
        for i, v in enumerate(vals):
            valign(r.cells[i])
            cell_text(r.cells[i], v, size=size)
    if len(pre) <= 6:
        keep_together(t, chain)
    gap(doc, 2, chain)
    return t


def text_box(doc, label, height_cm, width, chain=False, into=None):
    if into is not None:
        r = into.add_row()
        c = r.cells[0].merge(r.cells[-1])
        borders(c, top=(4, LINE_COLOR), bottom=(4, LINE_COLOR), left=(4, LINE_COLOR), right=(4, LINE_COLOR))
        no_split(r)
        row_height(r, height_cm)
        cell_text(c, label, size=NOTE, italic=True)
        for rr in into.rows[:-1]:
            for cc in rr.cells:
                for p in cc.paragraphs:
                    p.paragraph_format.keep_with_next = True
        return into
    t = doc.add_table(rows=1, cols=1)
    table_borders(t, (4, LINE_COLOR))
    cell_margins(t, top=40, bottom=40, left=90, right=90)
    fix_widths(t, [width])
    r = t.rows[0]
    no_split(r)
    row_height(r, height_cm)
    cell_text(r.cells[0], label, size=NOTE, italic=True)
    gap(doc, 2)
    return t


def paragraph(doc, text, size=BODY, italic=False, after=3, align=WD_ALIGN_PARAGRAPH.JUSTIFY, keep_next=False):
    p = doc.add_paragraph()
    fmt(p, after=after, align=align, keep_next=keep_next)
    add_text(p, text, size=size, italic=italic)
    return p


def sign_block(doc, rows, width, heading_cols=("Role and action", "Printed name", "Signature", "Date"), chain=False):
    """rows: [(role, action_text_or_None)]"""
    cw = [width * 0.33, width * 0.27, width * 0.27, width * 0.13]
    t = doc.add_table(rows=1 + len(rows), cols=4)
    table_borders(t, (4, LINE_COLOR))
    cell_margins(t, top=30, bottom=30, left=70, right=70)
    fix_widths(t, cw)
    for i, name in enumerate(heading_cols):
        c = t.rows[0].cells[i]
        shade(c, HEAD_FILL)
        valign(c)
        cell_text(c, name, size=NOTE + 0.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    no_split(t.rows[0])
    for r, (role, action) in zip(t.rows[1:], rows):
        no_split(r)
        row_height(r, 0.76)
        c = r.cells[0]
        cell_text(c, role, size=NOTE + 0.5, bold=True)
        if action:
            p = c.add_paragraph()
            fmt(p)
            add_text(p, action, size=NOTE - 0.5)
        valign(c)
    keep_together(t, chain)
    gap(doc, 2, chain)


def gs_box(doc, extra, width):
    labels = ["Date received", "Received by", "Reference no."]
    extra = list(extra or [])
    nrows = 1 + (len(extra) + 1) // 2
    t = doc.add_table(rows=nrows + 2, cols=6)
    tblPr = t._tbl.tblPr
    b = OxmlElement("w:tblBorders")
    for side in ("top", "left", "bottom", "right"):
        b.append(_el(f"w:{side}", w_val="single", w_sz=8, w_space=0, w_color="000000"))
    for side in ("insideH", "insideV"):
        b.append(_el(f"w:{side}", w_val="nil"))
    tblPr.append(b)
    cell_margins(t, top=10, bottom=10, left=80, right=80)
    fix_widths(t, [width / 6] * 6)
    hdr = t.rows[0].cells[0].merge(t.rows[0].cells[5])
    shade(hdr, HEAD_FILL)
    cell_text(hdr, "FOR GRADUATE SCHOOL USE ONLY", size=NOTE + 0.5, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)

    def put(row, c0, c1, label, total):
        c = t.rows[row].cells[c0].merge(t.rows[row].cells[c1])
        valign(c, "bottom")
        cell_text(c, f"{label}: ", size=NOTE)
        add_text(c.paragraphs[0], "_" * max(6, total - len(label)), size=NOTE)

    for i, lab in enumerate(labels):
        put(1, 2 * i, 2 * i + 1, lab, 27)
    for i, lab in enumerate(extra):
        put(2 + i // 2, 3 * (i % 2), 3 * (i % 2) + 2, lab, 38)
    if len(extra) % 2 == 1:
        r = t.rows[1 + (len(extra) + 1) // 2]
        r.cells[3].merge(r.cells[5])
    for r in t.rows[1:nrows + 1]:
        row_height(r, 0.5)
    last = t.rows[-1].cells[0].merge(t.rows[-1].cells[5])
    cell_text(last, "Action taken / remarks:", size=NOTE)
    row_height(t.rows[-1], 0.65)
    for r in t.rows:
        no_split(r)
    keep_together(t)


# --------------------------------------------------------------------------- form renderer
def build_form(spec, outdir: Path) -> Path:
    code, title = spec["code"], spec["title"]
    width = PORTRAIT_W
    doc = new_document()
    doc.core_properties.title = f"{code} {title}"
    doc.core_properties.author = "Capstone group CAP-IT1"
    doc.core_properties.comments = ""
    doc.core_properties.subject = spec["process"]
    footer(doc, code, title, width)
    institution_header(doc, width)
    title_block(doc, title, subtitle_text(spec), width)
    control_box(doc, code, spec["process"], spec.get("ref", ""), width)
    if spec.get("instructions"):
        instruction_box(doc, spec["instructions"], width)
    letter = ord("A")
    secs = spec["sections"]
    last_table = None
    for idx, sec in enumerate(secs):
        kind = sec[0]
        nxt = secs[idx + 1] if idx + 1 < len(secs) else None
        # chained to the next section when that one has no heading of its own;
        # the last section is chained to the Graduate School box
        chain = (nxt is None) or (nxt[0] not in ("note", "para") and nxt[1] is None)
        if kind == "note":
            paragraph(doc, sec[1], size=NOTE, italic=True, align=WD_ALIGN_PARAGRAPH.LEFT)
            continue
        head = sec[1]
        if head:
            section_bar(doc, f"{chr(letter)}.  {head}", width)
            letter += 1
        if kind == "fields":
            last_table = field_grid(doc, sec[2], width, chain=chain)
        elif kind == "checks":
            last_table = checks(doc, sec[2], sec[3], width, cols=sec[4] if len(sec) > 4 else 2, chain=chain)
        elif kind == "table":
            last_table = grid_table(doc, sec[2], sec[3], width, row_h=sec[4] if len(sec) > 4 else 0.68, chain=chain)
        elif kind == "box":
            if head is None and last_table is not None:
                text_box(doc, sec[2], sec[3], width, into=last_table)
            else:
                last_table = text_box(doc, sec[2], sec[3], width, chain=chain)
        elif kind == "para":
            paragraph(doc, sec[2], keep_next=len(sec[2]) < 200)
            last_table = None
        elif kind == "sign":
            sign_block(doc, sec[2], width, chain=chain)
            last_table = None
    gs_box(doc, spec.get("gs"), width)
    return save(doc, spec, outdir)


def safe_name(title):
    return re.sub(r'[\\/:*?"<>|]', "-", title).strip()


def save(doc, spec, outdir: Path) -> Path:
    folder = outdir / spec["folder"]
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{spec['code']} {safe_name(spec['title'])}.docx"
    doc.save(path)
    return path


def manual_text(spec):
    """'Operations Manual 4.6' (or '4.13 and 4.14'); None for the two forms-control documents."""
    if not spec.get("chapter"):
        return None
    also = f" and {spec['also']}" if spec.get("also") else ""
    return f"Operations Manual {spec['chapter']}{also}"


def subtitle_text(spec):
    """The italic line under the title: process | Operations Manual 4.x | Protocol form | Handbook or Protocol reference."""
    ref = spec.get("ref", "")
    if spec.get("subtitle"):
        ref = re.sub(r"^Protocol Form [0-9.]+;\s*", "", ref)
    return " | ".join(x for x in (spec["process"], manual_text(spec), spec.get("subtitle"), ref) if x)


# =========================================================================== form specs
STU = [("cols", [("Student name", 3), ("Student number", 3)]), ("cols", [("Program", 3), ("Track / major", 2), ("AY of entry", 1)]),
       ("cols", [("Institutional email", 3), ("Mobile number", 2), ("Year level", 1)])]
STU_SHORT = [("cols", [("Student name", 3), ("Student number", 3)]), ("cols", [("Program", 3), ("Track / major", 3)])]
EMAIL_GS = "gsresearch@usls.edu.ph"


def F(head, items, lw=3.9):
    return ("fields", head, items, lw)


def C(head, prompt, opts, cols=2):
    return ("checks", head, prompt, opts, cols)


def T(head, cols, rows, h=0.68):
    return ("table", head, cols, rows, h)


def B(head, label, h):
    return ("box", head, label, h)


def P(head, text):
    return ("para", head, text)


def S(head, rows):
    return ("sign", head, rows)


def N(text):
    return ("note", text)


FORMS = []


def add(code, title, process, sections, instructions=None, ref="", subtitle=None, gs=None, stage=None, who=None):
    chapter = FORM_CHAPTER[code]
    n = int(code)
    folder = PLATFORM_FOLDER if 45 <= n <= 48 else SUPPLEMENTARY_FOLDER if n >= 49 else CHAPTER_FOLDERS[chapter]
    FORMS.append(dict(code=f"GS-F-{code}", title=title, process=process, ref=ref, subtitle=subtitle,
                      instructions=instructions or [], sections=sections, gs=gs or [],
                      who=who or "", chapter=chapter, also=ALSO_CHAPTER.get(code), folder=folder))


# ---- 01 ------------------------------------------------------------------------------------
add("01", "Onboarding Report for the Dean", "Admission handoff and onboarding",
    instructions=[
        "Prepared by the Graduate School Staff for each batch of newly admitted students received from the Registrar (AIMS export) or the Academic Coordinator's monitoring workbook. One report covers one batch.",
        "The Graduate School does not create student numbers or institutional emails; they are received from the University Registrar. Admission requirements are checked by the Admissions office (Handbook 2022-2023, pp. 42-47) and are not re-assessed here.",
        "Every item that is not complete is listed in Part C with the person who will follow it up. The Dean accepts the report only when no item is left open, or records which items remain open.",
    ],
    sections=[
        F("Batch information", ["Program", "Academic year / term of entry", "Source file / workbook name", "Date received",
                                  "Number of students in the batch", "Number of new students", "Prepared by (Graduate School Staff)", "Date prepared"]),
        C("Onboarding checklist", "Tick each item that has been checked for every student in the batch.",
          ["Admission handoff recorded (admission approval received)", "Student profile sheet received for each student",
           "Student profiles created from the import", "Program assignment confirmed with the Academic Coordinator",
           "Enrollment signal received (enrolled in the registration system)", "Official transcript of records received",
           "Validation issues in the import resolved", "Curriculum version tagged for each student"], cols=1),
        T("Items needing follow-up", [("Student no.", 2.4), ("Student name", 4.2), ("Missing / unresolved item", 4.6), ("Assigned to", 2.8), ("Date resolved", 2.4)], 5),
        C("Dean's decision", None, ["Onboarding report accepted; admission is complete for this batch", "Returned to the Graduate School for the items marked above"], cols=1),
        B(None, "Dean's remarks:", 1.6),
        S("Review and approval", [("Prepared by", "Graduate School Staff"), ("Reviewed by", "Academic Coordinator of the program"),
                                  ("Accepted by", "Graduate School Dean")]),
    ],
    gs=["Batch no."])

# ---- 02 ------------------------------------------------------------------------------------
add("02", "Academic Advising and Study Plan", "Enrollment and academic load",
    ref="Handbook pp. 47-48",
    instructions=[
        "Enrollment steps: (1) academic evaluation and advising with the Academic Coordinator, (2) payment at the Cashiers in the Business Office, (3) validation in the student's AIMS account, (4) ID issuance or renewal (Handbook p. 47). This form records step 1 only; enrollment itself is done in AIMS.",
        "Normal load: six (6) to nine (9) units per semester for a part-time student and twelve (12) units for a full-time student (Handbook p. 48).",
        "Subjects are advised from the student's curriculum and monitoring record. The Academic Coordinator tags the advised subjects as enrolled in the Graduate School record after the student has enrolled in AIMS.",
    ],
    sections=[
        F("Student information", STU),
        F("Term and curriculum", ["Academic year / semester", "Curriculum version (year)", "Date of advising"]),
        C(None, "Load type:", ["Part-time (6 to 9 units)", "Full-time (12 units)", "Other, with the Academic Coordinator's reason: ____________"], cols=1),
        T("Subjects advised for the term", [("Subject code", 2.4), ("Subject title", 6.0), ("Units", 1.4), ("Schedule", 3.2), ("Professor", 4.0)], 8),
        F(None, ["Total units advised", "Units completed so far", ("full", "Remarks of the Academic Coordinator")]),
        P(None, "I confirm that the subjects above were advised to me and that I will enroll in them in AIMS and settle my account at the Business Office within the enrollment period."),
        S("Signatures", [("Student", None), ("Academic Coordinator", "Advised and evaluated")]),
    ],
    gs=["Recorded in monitoring record on"])

# ---- 03 ------------------------------------------------------------------------------------
add("03", "Change or Add of Subject and Advice Slip", "Course adjustments (change and add of subject)",
    ref="Handbook pp. 48-49",
    instructions=[
        "Changing one subject for another is allowed during the first week of classes only, if: (a) the subject enrolled in is dissolved, (b) the student has a schedule conflict, or (c) the student failed the prerequisite subject (Handbook pp. 48-49).",
        "Adding a subject is allowed during the first week of classes only, upon the written approval of the Associate Dean (Handbook p. 49).",
        "Procedure for an added subject: (1) un-tag the enrollment form at the Business Office, (2) secure the Advice Slip from the Graduate School Office (at the end of this form), (3) go through the enrollment procedure again (Handbook p. 49).",
    ],
    sections=[
        F("Student information", STU_SHORT + ["Academic year / semester", "Date of the first class meeting", "Date of this request"]),
        C("Request", "Type of request:", ["Change of subject", "Addition of subject"], cols=2),
        T("Subject(s)", [("Action", 3.0), ("Subject code", 2.2), ("Subject title", 5.0), ("Units", 1.2), ("Schedule", 2.9), ("Professor", 2.7)],
          [["Subject dropped or changed", "", "", "", "", ""], ["First subject taken or added", "", "", "", "", ""],
           ["Second subject taken or added", "", "", "", "", ""]], 0.9),
        C("Ground for a change of subject", None, ["The original subject is dissolved", "Schedule conflict", "Failed the prerequisite subject"], cols=1),
        B(None, "Explanation of the student (attach proof where available):", 1.6),
        S("Recommendation and approval", [("Student", None), ("Academic Coordinator", "Recommended  /  Not recommended"),
                                          ("Associate Dean", "Approved  /  Not approved (required for an added subject)")]),
        T("Advice Slip (issued by the Graduate School Office)",
          [("Subject code and title", 7.0), ("Units", 1.4), ("Section", 2.2), ("Enrollment form un-tagged at the Business Office (initials / date)", 6.4)], 2, 0.8),
        F(None, ["Issued by (Graduate School Office)", "Date issued"]),
    ],
    gs=["Recorded on"])

# ---- 04 ------------------------------------------------------------------------------------
add("04", "Term Course Offering Plan", "Course offering",
    ref="Handbook pp. 48, 51",
    instructions=[
        "Prepared by the Academic Coordinator for each program and term during the term break, before enrollment. A subject counts as needed when at least one student needs it; a need is not yet an offering.",
        "An undersized class is treated as a special class and is requested by the Academic Coordinator through the Dean, addressed to the Vice Chancellor for Academic Affairs (Handbook p. 48). A full refund is made for any course discontinued by the school (Handbook p. 51).",
        "The Dean approves the plan before it is published to students and the Business Office.",
    ],
    sections=[
        F("Plan information", ["Program", "Academic year / semester", "Prepared by (Academic Coordinator)", "Date prepared", "Reference term for demand", "Number of students enrolled in program"]),
        T("Subjects", [("Subject code", 2.0), ("Subject title", 4.6), ("Units", 1.1), ("Students needing it", 1.9), ("Secs.", 1.3), ("Professor assigned", 3.2), ("Schedule", 2.7)], 4, 0.8),
        C("Decision on each subject", "Mark here any subject that will not be offered and name the students who would be delayed:",
          ["All subjects listed above are offered", "Some subjects are not offered (state below)"], cols=1),
        B(None, "Subjects not offered, the reason, and students who would be delayed:", 1.1),
        B(None, "Special / undersized classes requested (subject, number of enrollees, reason):", 1.0),
        S("Approval", [("Prepared by", "Academic Coordinator"), ("Approved by", "Graduate School Dean")]),
    ],
    gs=["Published on"])

# ---- 05 ------------------------------------------------------------------------------------
add("05", "Application for Withdrawal of Subject", "Withdrawal of subject",
    ref="Handbook pp. 49-51, 53",
    instructions=[
        "A student may withdraw subjects until the second week from the start of classes, whether or not classes have been attended. Charges: ten percent (10%) of the total amount due for the term in the first week of classes and twenty percent (20%) in the second week (Handbook pp. 49, 51).",
        "After the second week a student keeps the right to withdraw all subjects but pays the full enrollment fees for the semester; if the reason is justifiable, fees are charged only up to and including the last month of attendance (Handbook pp. 49, 51). A student who withdraws after the second week may instead file a leave of absence (GS-F-07) (Handbook p. 53).",
        "This form is the written request to the Dean and, once approved, the Withdrawal Form. Fees are assessed by the Business Office. Copies: Registrar, Accounting Office and the student (Handbook p. 49).",
    ],
    sections=[
        F("Student information", STU_SHORT + ["Academic year / semester", "Date of the first class meeting", "Date of this request"]),
        T("Subject(s) to be withdrawn", [("Subject code", 2.4), ("Subject title", 6.2), ("Units", 1.4), ("Section / schedule", 3.4), ("Professor", 3.6)], 4),
        C("Timing of the request", "Counted from the first day of classes:", ["Before classes begin", "First week (days 1 to 7)", "Second week (days 8 to 14)", "After the second week"], cols=2),
        B("Reason for withdrawal", "Reason (attach supporting documents where available):", 2.0),
        C("Dean's decision", None, ["Approved", "Not approved", "Returned for clarification"], cols=3),
        B(None, "Remarks of the Dean:", 1.2),
        F("Business Office assessment (to be completed by the Business Office)",
          ["Assessment applied", "Official receipt no. / date", "Amount due / refund", "Cashier's initials"]),
        S("Signatures and routing", [("Student", "Applicant"), ("Academic Coordinator", "Noted; remarks on file"), ("Graduate School Dean", "Decision above"),
                                     ("Business Office", "Assessment recorded"), ("University Registrar", "Withdrawal processed in AIMS")]),
    ],
    gs=["Copy sent to Registrar on", "Copy sent to Accounting on", "Tagged as withdrawn on"])

# ---- 06 ------------------------------------------------------------------------------------
add("06", "Notice of Dropping from a Subject", "Dropping",
    ref="Handbook p. 52",
    instructions=[
        "Attendance is counted from the first regular class meeting. The maximum number of absences allowed is 20% of the total class hours of the semester. When unexcused absence is more than 20% of the stipulated hours in one course, the student is automatically dropped from the course by the professor and given the grade DRP with a 5.0 (Handbook p. 52).",
        "Excused absences are a death in the family, illness (with a medical certificate from the USLS clinic or a personal doctor) and a graduate program activity endorsed by the Dean. A student who takes part in a school-sponsored activity or represents the University in an official capacity is granted an Approved Absence on the Dean's approval; it is not counted against the allowed absences (Handbook p. 52).",
        "A student who wishes to leave a subject within the first two weeks files GS-F-05. A drop for another documented ground is arranged between the student and the Academic Coordinator. The Graduate School records the drop in AIMS and in its own record.",
    ],
    sections=[
        F("Student and subject", STU_SHORT + ["Subject code", "Subject title", "Professor", "Academic year / semester", "Section / schedule"]),
        F("Attendance computation", ["Total scheduled class hours", "Hours absent", "Hours excused or approved", "Unexcused absence (hours)", "Unexcused absence (% of total hours)", "Attendance record attached"]),
        C("Basis of the drop", None, ["Unexcused absence is more than 20% of the total class hours (Handbook p. 52)",
                                       "Other documented ground agreed with the Academic Coordinator (state below)"], cols=1),
        B(None, "Other ground, with supporting documents:", 0.9),
        P(None, "The student was informed of this drop on the date shown below."),
        S("Signatures", [("Professor of the subject", "Reports the absences"), ("Academic Coordinator", "Verified; recorded as dropped"),
                         ("Student", "Informed of the drop"), ("Graduate School Dean", "Noted")]),
    ],
    gs=["Dropped in AIMS on", "Tagged as dropped on"])

# ---- 07 ------------------------------------------------------------------------------------
add("07", "Application for Leave of Absence", "Leave of absence (new and extension)",
    ref="Handbook pp. 48, 52-53, 55",
    instructions=[
        "A student who does not intend to enroll in a semester may apply for a leave of absence; the student remains tied to the University. The request is made in writing to the Dean, states the reason and specifies the period. A leave may be approved for one (1) year and renewed for at most another year. It must be filed on or before the deadline (Handbook p. 52).",
        "No leave is granted within the two (2) weeks before the last day of classes. A student on leave in the second half of the semester has the class standing W (withdrawn) and no refund of tuition and fees (Handbook p. 53). A student who withdraws after two weeks of classes may file a leave and is subject to a withdrawal fee from the Cashier's office (Handbook p. 53).",
        "The leave counts in the maximum residence: seven (7) academic years for a master's program and nine (9) for a doctoral program, including leave (Handbook p. 55). A student with remaining units who will not enroll must file a leave and may not enroll in residency (Handbook p. 48). Leaving without a leave is absence without leave (AWOL).",
    ],
    sections=[
        F("Student information", STU + ["Date admitted to the program", "Date of this application"]),
        C("Application", "This application is for:", ["A new leave of absence", "An extension of the leave granted for ______________ (renewal, at most another year)"], cols=1),
        F("Period requested", ["From (academic year / semester)", "To (academic year / semester)", "Number of semesters", "Last day of classes of the current term", "Expected return (semester)", "Classes already attended this term?"]),
        C("Reason", "Reason for the leave:", ["Medical / health", "Family emergency", "Financial difficulty", "Employment / professional obligation", "Other documented circumstance"], cols=2),
        B(None, "Explain the reason in your own words and list the documents attached (for example a medical certificate):", 2.2),
        T("Earlier leaves of absence", [("Academic year / semester", 6.0), ("Period approved", 5.0), ("Date approved", 6.0)], 2),
        P(None, "I understand that my leave does not stop the maximum residence from running, that I must declare my intention to return in writing to the University Registrar through the Dean, and that I may not enroll in residency while on leave."),
        S("Signatures and decision", [("Student", "Applicant"), ("Academic Coordinator", "Reviewed: program standing and residence"), ("Graduate School Dean", "Approved  /  Not approved"),
                                      ("Business Office", "Withdrawal fee or refund noted")]),
        F("Notice to the University Registrar (Dean, Associate Dean or authorized representative)", ["Period approved", "Date informed", "Reasons stated", "Amount refunded, if any", ("full", "Informed by")]),
    ],
    gs=["Leave starts / ends", "Copy sent to Registrar on", "Status"])

# ---- 08 ------------------------------------------------------------------------------------
add("08", "Application for Readmission (Return from Leave or AWOL)", "Return from leave of absence and readmission",
    ref="Handbook pp. 45, 53-55",
    instructions=[
        "A student returning from a leave of absence or from absence without leave declares the intention to enroll by writing to the University Registrar through the Graduate School Dean, who endorses it to the Registrar (Handbook p. 53). The declaration of intention below is that written declaration.",
        "A returnee presents: (1) clearance from the Business Office, (2) an interview on the reason for delay and the residency requirements, (3) an evaluation of subject and grade requirements, and (4) an Advice Slip from the Dean (Handbook p. 45).",
        "Failure in any subject means no readmission to the program (Handbook p. 54). Maximum residence is seven (7) years for a master's and nine (9) for a doctorate, including leave; beyond that all courses taken must be re-enrolled (Handbook p. 55).",
    ],
    sections=[
        F("Student information", STU),
        C("Return from", None, ["Approved leave of absence (period: ____________________)", "Absence without leave (last term enrolled: ________________)"], cols=1),
        F("Return", ["Semester of return (target term)", "Date of this application"]),
        P("Declaration of intention to enroll", "To the University Registrar, through the Graduate School Dean: I declare my intention to enroll in the term stated above. I have been away from the program for the reasons written below, and I will comply with the requirements of readmission."),
        B(None, "Reason for the absence and plans to complete the program:", 1.8),
        C("Requirements of readmission (Handbook p. 45)", "Verified by the Graduate School:", [
            "Clearance from the Business Office", "Interview done (reason for delay, residency requirements)",
            "Evaluation of subject and grade requirements; no failed subject (Handbook p. 54)", "Advice Slip issued by the Dean"], cols=1),
        C(None, "Further checks recorded by the Graduate School (not requirements stated in the Handbook):", [
            "Updated study plan confirmed", "Consultation with the program or Research Adviser done", "No pending accountability"], cols=1),
        F("Residence standing (Academic Coordinator)", ["Years in the program", "Normal limit (5 master's / 7 doctorate)", "Maximum limit (7 / 9, including leave)", "Refresher of 6 units required?"]),
        C(None, "Classification:", ["Within the normal limit", "Extension: graded six-unit refresher required", "Beyond the maximum: full re-enrollment required"], cols=1),
        S("Signatures and endorsement", [("Student", "Applicant"), ("Academic Coordinator", "Evaluated subject and grade requirements"), ("Business Office", "Clearance issued"),
                                         ("Graduate School Dean", "Endorsed  /  Not endorsed  to the University Registrar"), ("University Registrar", "Received; readmission processed")]),
    ],
    gs=["Endorsed to Registrar on", "Registrar confirmation on"])

# ---- 09 ------------------------------------------------------------------------------------
add("09", "Notice of Absence Without Leave (AWOL)", "Absence without leave",
    ref="Handbook p. 53",
    instructions=[
        "A student who withdraws from the Graduate School without a formal leave of absence is in absence-without-leave (AWOL) status and has registration privileges curtailed or entirely withdrawn (Handbook p. 53).",
        "The status is recorded from evidence, for example an imported AWOL standing or an enrollment marked withdrawn with no approved leave. It is not based on absence alone and is not entered without the source being stated below.",
        "The student is told how to return (GS-F-08). If the Graduate School reports the absence to the Registrar, GS-F-44 is used.",
    ],
    sections=[
        F("Student information", STU_SHORT + ["Stage before the AWOL (research or coursework)", "Last term enrolled", "Date AWOL takes effect", "Years in the program"]),
        C("Source of the evidence", None, ["Imported enrollment or standing record (AIMS export)", "Semester enrollment marked withdrawn with no approved leave and no resolved return",
                                           "Report of the Academic Coordinator or professor", "Other (state): ____________________"], cols=1),
        B(None, "Details (what was found, dates, attempts to contact the student):", 2.2),
        P("Notice to the student", "You are recorded as absent without leave from the date above. Your registration privileges are curtailed or entirely withdrawn (Handbook p. 53). To return, file the Application for Readmission (GS-F-08) with the Graduate School Dean."),
        F(None, ["Student notified on (date)", "Notified by (email / letter)", "Registrar informed on", "Informed by"]),
        S("Signatures", [("Prepared by", "Graduate School Staff or Academic Coordinator"), ("Graduate School Dean", "Noted")]),
    ],
    gs=["Status"])

# ---- 10 ------------------------------------------------------------------------------------
add("10", "Application for Residency Enrollment", "Residency enrollment and maximum residence",
    ref="Handbook pp. 48, 54-55",
    instructions=[
        "Residency applies to a student who has finished all coursework and is only working on the thesis or dissertation, or the practicum or internship, after a semester of enrollment for it. It also applies to a student who is not enrolled in any subject but will complete an INC, will take the comprehensive examination, or is waiting for the research publication. Registration for residence must be done within the semester (Handbook p. 48).",
        "A student who does not intend to enroll for a valid reason but still has remaining units may not enroll in residency and must file a leave of absence (GS-F-07).",
        "Maximum residence: master's, candidacy within three years and all requirements within five years, with a possible two-year extension that requires a graded six-unit refresher, up to seven years including leave; doctorate, five and seven years, up to nine years including leave (Handbook pp. 54-55).",
    ],
    sections=[
        F("Student information", STU + ["Date admitted to the program", "Years in the program"]),
        F("Residency requested", ["Academic year / semester", "Date of this application", "Units completed", "Units remaining"]),
        C("Purpose of the residency", None, ["Thesis or dissertation writing (after a semester of enrollment for it)", "Practicum or internship (after a semester of enrollment for it)",
                                              "Comprehensive examination", "Completion of an incomplete grade (INC)", "Waiting for the research publication"], cols=1),
        B(None, "Supporting details (thesis or practicum enrollment semester, subject with INC, exam date, journal and status):", 1.8),
        P(None, "I confirm that I have no remaining subjects that I intend to enroll in this semester and that I will settle any fee assessed by the Business Office."),
        S("Signatures and approval", [("Student", "Applicant"), ("Academic Coordinator", "Purpose and eligibility verified"), ("Graduate School Dean or authorized representative", "Approved  /  Not approved"),
                                      ("Business Office", "Fee assessed, if any; receipt no. ________")]),
    ],
    gs=["Recorded on"])

# ---- 11 ------------------------------------------------------------------------------------
add("11", "Practicum Agreement (Memorandum of Agreement)", "Practicum",
    ref="Handbook p. 48",
    instructions=[
        "Used for programs with a practicum or internship. Complete it before the practicum starts; the Graduate School keeps the signed original and gives a copy to the host organization.",
        "The Academic Coordinator reviews the agreement and marks the practicum as in progress once it is signed by all parties.",
    ],
    sections=[
        P("Parties", "This agreement is made between the UNIVERSITY OF ST. LA SALLE, Graduate School, Bacolod City (the University), the HOST ORGANIZATION named below, and the STUDENT named below, for the practicum of the student."),
        F("Student", STU_SHORT + ["Academic year / semester", "Contact number"]),
        F("Host organization", [("full", "Name of host organization"), ("full", "Address of practicum site"), "Name of supervisor", "Position of supervisor", "Supervisor's contact number", "Supervisor's email"]),
        F("Practicum", ["Start date", "End date", "Required hours", "Schedule (days and times)", ("full", "Main activities and learning objectives")]),
        P("Responsibilities", "The University shall endorse the student to the host organization, recognize the practicum hours certified by the host, and designate the Academic Coordinator as its contact. The host organization shall give the student supervised practice in line with the objectives above, certify the hours rendered, and issue a certificate of completion. The student shall follow the policies of the host organization, keep confidential the information entrusted to the student, report the hours truthfully, and inform the Academic Coordinator of any problem. Any party may end the agreement by written notice, and hours already rendered remain subject to evaluation by the Academic Coordinator."),
        S("Signatures", [("Student", None), ("Supervisor, Host organization", "Position: ________"), ("Authorized representative, Host organization", "Position: ________"),
                         ("Academic Coordinator", "Reviewed; practicum in progress"), ("Graduate School Dean", "For the University")]),
    ],
    gs=["MOA received on", "Marked in progress on"])

# ---- 12 ------------------------------------------------------------------------------------
add("12", "Practicum Hours Log and Supervisor's Certification", "Practicum",
    instructions=[
        "The student records every day of practicum. The supervisor initials the entries and signs the certification below. If the hours were rendered in more than one organization, use one form for each organization; the Graduate School accepts several certificates.",
        "Attach the form to GS-F-13 when the required hours are complete.",
    ],
    sections=[
        F("Student and site", STU_SHORT + ["Host organization", "Supervisor", "Period covered"]),
        T("Daily log", [("Date", 2.2), ("Time in", 1.8), ("Time out", 1.8), ("Hours", 1.4), ("Activities done", 7.2), ("Supervisor initials", 2.6)], 9, 0.62),
        F(None, ["Total hours in this log", "Required hours"]),
        P("Certification of the supervisor", "This is to certify that the student named above rendered the total number of hours stated in this log at the host organization, in the period covered shown, and that the entries are true to the records of the organization."),
        F(None, [("cols", [("Supervisor's name", 3), ("Position", 3)]), ("cols", [("Signature", 2), ("Date signed", 2), ("Organization stamp (if any)", 2)])]),
    ],
    gs=["Hours recorded on"])

# ---- 13 ------------------------------------------------------------------------------------
add("13", "Practicum Completion Report", "Practicum",
    instructions=[
        "Prepared by the Academic Coordinator after verifying the hours and documents. The Dean reviews the report; the Dean does not approve or deny the practicum.",
        "If the hours are short, the report is returned to the student with the reason. Earlier files are kept; additional evidence is added, never replaced.",
    ],
    sections=[
        F("Student", STU_SHORT + ["Host organization", "Supervisor", "Period of practicum"]),
        F("Hours", ["Required hours", "Completed hours (all certificates)", "Number of certificates", "Date verified"]),
        C("Documents verified", None, ["Signed Practicum Agreement (GS-F-11)", "Hours log(s) and supervisor's certification (GS-F-12)", "Certificate(s) of completion from the host organization"], cols=1),
        C("Result of verification", None, ["The required hours are complete; practicum is marked completed", "The hours are short; returned to the student for additional evidence"], cols=1),
        B(None, "Remarks of the Academic Coordinator (reason if returned):", 1.4),
        S("Signatures", [("Academic Coordinator", "Verified and reported"), ("Graduate School Dean", "Reviewed (no approval or denial)")]),
    ],
    gs=["Report received on"])

# ---- 14 ------------------------------------------------------------------------------------
add("14", "Application for Comprehensive Examination", "Comprehensive examination",
    ref="Handbook pp. 56-57",
    instructions=[
        "Master's students who have passed all academic requirements and have been evaluated by their Academic Coordinator, and doctorate students evaluated by their College Dean, may apply. Non-thesis students must have completed the integrating courses (Handbook p. 56). The student is advised to enroll in Residency in Comprehensive Examination.",
        "File with the Graduate Program Secretary at least two (2) weeks before the examination. Fee: PHP 1,100 for master's and PHP 2,500 for doctorate, paid at the Business Office; attach the official receipt (Handbook p. 57). The fee is forfeited if the examinee does not appear or send a written note.",
        "To withdraw the application, inform the Graduate Program in writing, with the reason, at least three (3) working days before the examination (last section of this form).",
    ],
    sections=[
        F("Student information", STU),
        C("Level and track", None, ["Master's, thesis track", "Master's, non-thesis track (integrating course completed)", "Doctorate"], cols=1),
        F("Examination", ["Examination date(s)", "Date of application", "Residency enrollment (term)", "Subjects with INC (if any)"]),
        C("Attempt", None, ["First examination", "First retake", "Second retake", "Third and last examination (after refresher)"], cols=2),
        F("Payment", ["Official receipt no.", "Date paid", "Amount paid", "Cashier / Business Office"]),
        C("Evaluation of eligibility", None, ["All academic requirements passed, evaluated by the Academic Coordinator (master's)", "All academic requirements passed, evaluated by the College Dean (doctorate)",
                                              "Integrating course completed (non-thesis)"], cols=1),
        S("Signatures", [("Student", "Applicant"), ("Academic Coordinator or College Dean", "Evaluated"), ("Graduate Program Secretary", "Received with official receipt")]),
        B("Withdrawal of application (only if the student withdraws)", "Reason for withdrawing (at least three working days before the examination):", 1.0),
        S(None, [("Student", "Withdraws the application")]),
    ],
    gs=["Examination schedule"])

# ---- 15 ------------------------------------------------------------------------------------
add("15", "Comprehensive Examination Result Sheet", "Comprehensive examination",
    ref="Handbook p. 57",
    instructions=[
        "The examination covers basic or core courses, the field of concentration, and electives or cognates. For a master's it runs two days (day 1: basic courses and electives or cognates; day 2: major courses). For a doctorate it runs three days (day 1: basic courses and electives or cognates; days 2 and 3: major courses).",
        "A student must score at least 7.00 points (70%) in every course to pass. A student below 7.00 may retake the failed courses, with a second retake within the semester. A student who fails the second retake takes a refresher course in the failed courses the next semester and may sit for a third and last time in the next residency enrollment; failure the fourth time means disqualification from the program (Handbook p. 57).",
        "Passing without a retake is required for special academic honors (Handbook p. 55). The result is recorded in the COMPRE column of the monitoring workbook.",
    ],
    sections=[
        F("Student information", STU_SHORT + ["Examination dates", "Attempt (first examination, first retake, second retake, third and last)"]),
        T("Results by course", [("Day", 1.3), ("Course / area examined", 7.4), ("Score (out of 10.00)", 2.6), ("Passed (7.00 or higher)", 2.8), ("Examiner / remarks", 3.4)], 6, 0.7),
        C("Overall result", None, ["Passed", "Failed; retake of the failed courses", "Failed; refresher course required", "Disqualified from the program (fourth failure)"], cols=2),
        F(None, ["Date result released to the student", "Courses to retake"]),
        S("Signatures", [("Academic Coordinator", "Consolidated the results"), ("Graduate Program Secretary", "Recorded"), ("Graduate School Dean", "Noted")]),
    ],
    gs=["Recorded in COMPRE column on"])


# =========================================================================== research forms (Research Protocol AY 2024-2025)
PANEL_T = [("Role", 3.2), ("Name of panel member", 6.2), ("Affiliation", 4.6), ("University-affiliated?", 3.0)]
PAPER = ["Project Paper / Capstone", "Thesis (or bridging thesis)", "Dissertation"]
RES_STU = [("cols", [("Student name", 3), ("Student number", 3)]), ("cols", [("Program", 3), ("Track / major", 3)]),
           ("cols", [("Institutional email", 3), ("Mobile number", 3)])]
RES4 = RES_STU[:2]

# ---- 16 ------------------------------------------------------------------------------------
add("16", "Application for Title Defense", "Title defense", subtitle="Research Protocol Form 1",
    ref="Protocol Form 1; Handbook pp. 59-60",
    instructions=[
        "Fill in this form and send it with the three (3) concept papers to your Academic Coordinator at least two (2) weeks before the title defense. The Academic Coordinator endorses the application to the Research Coordinator (gsresearch@usls.edu.ph) and recommends a set of panel members; the student does not need the Academic Coordinator's handwritten signature when the endorsement is sent by email with the e-signature.",
        "The Research Coordinator then nominates the panel members as recommended by the Academic Coordinator, after deliberation with the GS Research Committee (GS-F-17). The panel deliberates the three titles without the student and decides the title to be pursued (GS-F-18).",
        "Answer the four labeled items in Part D completely. Panel composition (Handbook p. 60): project paper, a chair and two members; thesis, a chair and three members; dissertation, a chair and four members. The external panel member joins from the proposal defense onward.",
    ],
    sections=[
        F("Student information", RES_STU + ["Research Adviser (if already designated)", "Comprehensive examination passed on"]),
        F("Defense details", ["Type of paper", "Preferred date of title defense", "Preferred mode (onsite / online)", "Date of this application"]),
        T("Concept papers submitted (three required)", [("No.", 0.9), ("Title of concept paper", 9.5), ("Key terms", 4.6), ("Pages", 1.4)], 3, 0.95),
        F("Details of the concept paper preferred by the student",
          [("tall", "Research Title:", 2), ("tall", "Objectives:", 3), ("full", "Research Keywords:"), ("tall", "Proposed Panel Specialization:", 2)], lw=3.4),
        T("Panel members recommended by the Academic Coordinator", [("Role", 3.4), ("Name", 6.2), ("Affiliation", 4.6), ("Expertise", 2.8)],
          [["Panel Chair", "", "", ""], ["Content Specialist", "", "", ""], ["Method Specialist", "", "", ""], ["Content Specialist 2 (dissertation)", "", "", ""]], 0.8),
        S("Signatures and routing", [("Prepared by", "Student"), ("Endorsed by", "Academic Coordinator (e-signature or endorsement email dated ________)"),
                                      ("Received by", "Research Coordinator")]),
    ],
    gs=["Panel nominated on", "Defense scheduled for"])

# ---- 17 ------------------------------------------------------------------------------------
add("17", "Panel Nomination and Invitation Reply Slip", "Panel nomination and scheduling",
    ref="Handbook pp. 60, 63; Protocol, Title Defense I.4",
    instructions=[
        "The Research Coordinator nominates the panel members as recommended by the Academic Coordinator, after deliberation with the GS Research Committee (title defense). For the proposal and final defenses the Research Adviser recommends the external panel member, subject to the approval of the GS Research Committee (Protocol, Proposal Defense I).",
        "Each nominated member answers the invitation below; a member who is not available on the date marks the slip as unavailable. The defense date is confirmed once the Research Adviser and all required panel members have replied that they are available.",
        "The Graduate School Office coordinates the schedule with the panel; the Panel Chair reserves the venue through the Graduate School Office or prepares the online meeting details.",
    ],
    sections=[
        F("Student and defense", RES4 + ["Type of paper", "Defense (title / proposal / final)", "Proposed date and time", "Mode and venue", "Research Adviser", "Date of nomination"]),
        T("Panel nominated", [("Role", 3.2), ("Name of nominee", 4.8), ("Affiliation", 3.4), ("Reply (Accept / Decline / Unavailable)", 3.0), ("Signature and date", 2.6)],
          [["Panel Chair", "", "", "", ""], ["Content Specialist", "", "", "", ""], ["Method Specialist", "", "", "", ""],
           ["Content Specialist 2 (dissertation)", "", "", "", ""], ["External panel member (from proposal defense)", "", "", "", ""]], 0.95),
        C("GS Research Committee", None, ["The Research Committee deliberated on the nomination on ____________", "The external panel member is approved by the Committee"], cols=1),
        B(None, "Reason, if a nominee declined or is unavailable, and the replacement nominated:", 1.5),
        S("Signatures", [("Recommended by", "Academic Coordinator (title defense) or Research Adviser (proposal and final defense)"), ("Nominated by", "Research Coordinator"),
                         ("Noted by", "Associate Dean")]),
    ],
    gs=["Defense confirmed on"])

# ---- 18 ------------------------------------------------------------------------------------
add("18", "Report of Title Defense", "Title defense", subtitle="Research Protocol Form 2",
    ref="Protocol Form 2; Handbook pp. 60-61",
    instructions=[
        "The panel deliberates the three submitted titles without the student, then decides the title to be pursued. The decision must be reflected on this form. Each panel member accomplishes the form; the Panel Chair emails the accomplished form to the Research Coordinator (gsresearch@usls.edu.ph) and to the student within the first working day after the defense.",
        "If all the proposed titles are disapproved, the student presents a new set of three (3) titles and follows the same protocol (new GS-F-16).",
        "The student settles the title defense fees by asking the panel members for their preferred mode of payment and emails the proof to the Graduate School Office within the first working day, with a subject line such as SURNAME_Title Defense_Receipt.",
    ],
    sections=[
        F("Student and defense", RES4 + ["Type of paper", "Date of the defense", "Mode and venue", "Research Adviser (if any)"]),
        T("Titles deliberated", [("No.", 0.9), ("Title of concept paper", 11.0), ("Decision", 3.2), ("Selected", 1.9)],
          [["1", "", "Approved / Not approved", ""], ["2", "", "Approved / Not approved", ""], ["3", "", "Approved / Not approved", ""]], 0.95),
        C("Result of the title defense", None, ["Approved: the title selected above is to be pursued", "Disapproved: the student presents a new set of three titles"], cols=1),
        F(None, [("full", "Title to be pursued, as finally worded by the panel")]),
        B("Comments and suggestions of the panel", "", 2.6),
        S("Panel signatures", [("Panel Chair", None), ("Content Specialist", None), ("Method Specialist", None), ("Content Specialist 2 (dissertation)", None)]),
        F("Receipt of the student", ["Date received", "Student's signature"]),
    ],
    gs=["Recorded on"])

# ---- 19 ------------------------------------------------------------------------------------
add("19", "Application for Designation of Research Adviser", "Research Adviser designation", subtitle="Research Protocol Form 3",
    ref="Protocol Form 3; Handbook pp. 58-59, 61",
    instructions=[
        "The Research Adviser must be affiliated with the University, in a degree program aligned with the student's. The Protocol requires a PhD degree for PhD students and at least PhD units for MA students (CHED CMO 15), and a maximum of five active advisees in the current academic year; the Handbook (p. 58) asks for a doctoral degree aligned with the discipline, and with the Dean's approval a Research Adviser may take more than five advisees in the exigency of service.",
        "The student may express a preference, but the Dean, the Associate Dean and the Research Coordinator make the final decision, considering degree, expertise, research work, number of advisees and workload (Handbook p. 59). List the faculty members you propose in order of preference.",
        "Email this form to your Academic Coordinator, who notes it by email or letter to the Research Coordinator. The Dean's signature is not required at this point. The Research Coordinator sends it to the Dean for deliberation.",
    ],
    sections=[
        F("Student information", RES_STU + ["Type of paper", "Comprehensive examination passed on", ("full", "Research interest or approved title (Form 2), if any")]),
        T("Faculty proposed as Research Adviser (in order of preference)", [("Pref.", 1.1), ("Name of faculty member", 4.8), ("Highest degree", 2.4), ("University-affiliated", 2.2), ("Active advisees now", 2.2), ("Expertise aligned with the study", 4.3)], 3, 0.9),
        B(None, "Reason for the choice and how the expertise of the proposed Research Adviser fits the study:", 1.5),
        S("Signatures and routing", [("Applicant", "Student"), ("Noted by", "Academic Coordinator"), ("Forwarded to the Dean by", "Research Coordinator")]),
        C("Deliberation (Research Coordinator, Associate Dean and Dean)", None, ["A Research Adviser is designated (GS-F-20 issued)", "No proposed faculty member is designated; the Research Coordinator, Associate Dean and Dean decide on another Research Adviser"], cols=1),
    ],
    gs=["Form 3.1 issued on"])

# ---- 20 ------------------------------------------------------------------------------------
add("20", "Appointment for Research Adviser", "Research Adviser designation", subtitle="Research Protocol Form 3.1",
    ref="Protocol Form 3.1; Handbook pp. 58-59, 61-62",
    instructions=[
        "Issued by the Research Coordinator after the Research Coordinator, the Associate Dean and the Dean have decided the designation. The Research Coordinator emails this form to the student and the appointed Research Adviser, who email the accomplished form back (acceptance) to gsresearch@usls.edu.ph.",
        "The Research Adviser is bound only to advising and may not be selected as the student's editor or to any other appointment related to the conduct of the study (Handbook p. 59).",
        "The student and the Research Adviser must submit the Research Timetable (GS-F-22) and the Advising Contract (GS-F-23) to the Research Coordinator within five (5) days of receiving this form.",
    ],
    sections=[
        F("Student", RES4 + ["Type of paper", "Approved title (if any)"]),
        F("Appointed Research Adviser", ["Name of Research Adviser", "Highest degree", "College / department", "Date of appointment", ("full", "Active advisees including this student (above five only with the Dean's approval in the exigency of service)")]),
        P("Appointment", "The Graduate School appoints the Research Adviser named above as Research Adviser of the student named above, to perform the duties stated in the Handbook (p. 59) and the Research Protocol."),
        S("Appointment signed by", [("Research Coordinator", None), ("Associate Dean", None), ("Graduate School Dean", None)]),
        C("Acceptance of the Research Adviser", None, ["I accept the appointment", "I decline the appointment; reason: ____________________"], cols=1),
        S("Acknowledgement", [("Research Adviser", "Accepted on ________"), ("Student", "Received on ________")]),
    ],
    gs=["Contract due on (5 days)"])

# ---- 21 ------------------------------------------------------------------------------------
add("21", "Request for Change of Research Adviser", "Change of Research Adviser", subtitle="Research Protocol Form 3.1.1",
    ref="Protocol Form 3.1.1; Handbook p. 62",
    instructions=[
        "A student may make only one (1) request to change the Research Adviser, for justifiable reasons, and it must be done before the proposal defense (Handbook p. 62).",
        "The current Research Adviser and the new Research Adviser must both agree and sign this form. The student emails it to the Research Coordinator. The request is deliberated by the Research Coordinator, the Associate Dean and the Dean; if approved, the Research Coordinator prepares a new Appointment (GS-F-20) for the student and the new Research Adviser.",
    ],
    sections=[
        F("Student", RES4 + ["Type of paper", "Approved title", "Date of this request"]),
        F("Advisers", ["Current Research Adviser", "Date appointed", "Proposed new Research Adviser", "Active advisees of the new Research Adviser"]),
        C("Stage of the study", None, ["The proposal defense has not yet been held", "This is the first request to change the Research Adviser"], cols=1),
        B("Justifiable reason for the change", "State the reason clearly:", 2.6),
        S("Agreement", [("Student", "Requests the change"), ("Current Research Adviser", "Agrees to release the advisee"), ("Proposed New Research Adviser", "Agrees to advise")]),
        S("Deliberation and decision", [("Research Coordinator", "Approved; a new Form 3.1 is prepared  /  Not approved"), ("Associate Dean", "Approved  /  Not approved"), ("Graduate School Dean", "Approved  /  Not approved")]),
    ],
    gs=["New Form 3.1 issued on"])

# ---- 22 ------------------------------------------------------------------------------------
add("22", "Research Timetable", "Research advising", subtitle="Research Protocol Form 3.2",
    ref="Protocol Form 3.2; Handbook pp. 58-59, 61-62",
    instructions=[
        "Accomplished by the student together with the Research Adviser once the Research Adviser has been appointed. The Research Adviser monitors the research according to this timetable. Submit it with the Advising Contract (GS-F-23) to the Research Coordinator within five (5) days of receiving the Appointment (GS-F-20).",
        "Time limits: a thesis or project paper must be finished within two (2) years from the title or proposal defense; for a thesis and for a dissertation the student has one (1) year from the title defense to submit and defend the proposal; a dissertation must be finished within three (3) years from the title defense (Handbook p. 58). Set target dates within these limits.",
    ],
    sections=[
        F("Student and Research Adviser", RES4 + ["Type of paper", "Research Adviser", "Date of Form 3.1"]),
        T("Timetable", [("Activity", 8.0), ("Target date", 3.0), ("Actual date", 3.0), ("Research Adviser's initials", 3.0)],
          [["Title defense (Form 1 and Form 2)", "", "", ""], ["Chapters 1 to 3 drafted", "", "", ""], ["Statistical consultation (Form 4.1, quantitative studies)", "", "", ""],
           ["Endorsement for proposal defense (Form 4)", "", "", ""], ["Proposal defense", "", "", ""], ["Revisions and technical review (Form 5.1)", "", "", ""],
           ["Application for ethics review (within one month of the proposal defense)", "", "", ""], ["Ethics clearance", "", "", ""], ["Data gathering and analysis", "", "", ""],
           ["Endorsement for closed-door final defense (Form 4)", "", "", ""], ["Closed-door final defense", "", "", ""], ["Public final defense (if required)", "", "", ""],
           ["Turnitin scan, editing (Form 9)", "", "", ""], ["Submission of bound copies and CD (Form 10)", "", "", ""], ["Presentation at a research conference", "", "", ""],
           ["Publication (Forms 12 and 13)", "", "", ""]], 0.6),
        S("Agreed by", [("Student", None), ("Research Adviser", None), ("Received by", "Research Coordinator")]),
    ],
    gs=["Received on"])

# ---- 23 ------------------------------------------------------------------------------------
add("23", "Thesis / Dissertation Advising Contract", "Research advising", subtitle="Research Protocol Form 3.3",
    ref="Protocol Form 3.3; Handbook p. 59",
    instructions=[
        "Accomplished and signed by the student and the Research Adviser, and emailed to the Research Coordinator within five (5) days of receipt of the Appointment (GS-F-20).",
        "The responsibilities of the Research Adviser follow the Handbook, p. 59. A change of Research Adviser follows GS-F-21 and may be requested only once, before the proposal defense.",
    ],
    sections=[
        F("Parties", RES4 + ["Type of paper", "Research Adviser", "Approved title", "Date of Form 3.1"]),
        P("The Research Adviser agrees to", "(1) monitor the research according to the timetable in Form 3.2; (2) review proposals, questionnaires and chapters and return comments as agreed below; (3) give technical and moral guidance; (4) conduct a mock defense when necessary; (5) attend the defense of the advisee and the orientations of the Graduate School; (6) endorse the manuscript for defense only when it complies with the research paper guidelines of the Graduate School; and (7) verify that the panel's recommendations are reflected in the final manuscript. The Research Adviser is bound only to advising and is not the student's editor."),
        P("The student agrees to", "(1) follow the research timetable; (2) send manuscripts to the Research Adviser by email and consult regularly; (3) give the panel the manuscript within the lead times of the Research Protocol, including the 14-Day Rule; (4) settle the defense fees with the panel members and send the proof to the Graduate School Office; (5) keep the emails in which the panel members approve the manuscript; and (6) observe the University's rules on research integrity, ethics clearance and authorship."),
        F("Working arrangements", [("full", "Consultation schedule and mode (meetings, email, online)"), ("full", "How and when the Research Adviser returns comments"), ("full", "Authorship arrangement (see Form 4.2 if there is a co-author)")]),
        S("Signatures", [("Student", None), ("Research Adviser", None), ("Received by", "Research Coordinator")]),
    ],
    gs=["Received on"])

# ---- 24 ------------------------------------------------------------------------------------
add("24", "Request for Change of Title of the Study", "Change of title", subtitle="Research Protocol Form 3.4",
    ref="Protocol Form 3.4; Handbook p. 62",
    instructions=[
        "A student may make only one (1) request to change the title of the study, before the proposal defense application (Handbook p. 62).",
        "Email this form and the new concept paper to the Research Adviser. The Research Adviser endorses the request to the panel members for deliberation and sends a copy of the email to the Research Coordinator. The panel members decide among themselves; the Panel Chair emails the decision to the student, the Research Adviser and the Research Coordinator.",
    ],
    sections=[
        F("Student", RES4 + ["Type of paper", "Research Adviser", "Date of this request"]),
        F("Title", [("tall", "Present approved title", 2), ("tall", "Proposed new title", 2)]),
        C(None, None, ["The proposal defense has not yet been applied for", "This is the first request to change the title", "The new concept paper is attached"], cols=1),
        B("Reason for the change", "State the reason:", 2.0),
        S("Endorsement", [("Student", None), ("Research Adviser", "Endorses the request to the panel")]),
        T("Decision of the panel", [("Panel member", 4.6), ("Role", 3.4), ("Approve / Not approve", 3.4), ("Signature and date", 5.6)], 4, 0.8),
        C(None, "Decision of the panel:", ["The change of title is approved", "The change of title is not approved"], cols=2),
        S("Reported by", [("Panel Chair", "Emailed the decision on ________")]),
    ],
    gs=["Title updated on"])

# ---- 25 ------------------------------------------------------------------------------------
add("25", "Statistical Consultation Form", "Proposal defense", subtitle="Research Protocol Form 4.1",
    ref="Protocol Form 4.1; Handbook p. 63",
    instructions=[
        "Required before the proposal defense for quantitative studies, accomplished by the Statistician. It is not required for qualitative studies. The student attaches it to the proposal paper when emailing the Research Adviser, and the Research Adviser sends it to the Research Coordinator with Form 4.",
    ],
    sections=[
        F("Student", RES4 + ["Type of paper", "Research Adviser", "Date of consultation"]),
        F(None, [("tall", "Title of the study", 2)]),
        C("Type of study", None, ["Quantitative", "Qualitative (this form is not required)"], cols=2),
        F("Design reviewed", [("full", "Research design"), ("full", "Population, sampling and sample size"), ("full", "Instrument and its validity and reliability"), ("full", "Statistical tools to be used")]),
        B("Findings and recommendations of the Statistician", "", 1.8),
        C(None, "Status:", ["The statistical plan is appropriate for the study", "The statistical plan is appropriate after the changes recommended above"], cols=1),
        S("Signatures", [("Statistician", "Position / college: ________"), ("Student", "Received the recommendations"), ("Research Adviser", "Noted")]),
    ],
    gs=["Filed with Form 4 on"])

# ---- 26 ------------------------------------------------------------------------------------
add("26", "Co-authorship Information for Publication", "Proposal defense", subtitle="Research Protocol Form 4.2",
    ref="Protocol Form 4.2; Handbook p. 64",
    instructions=[
        "Submit only if the student has pre-identified one or more co-authors. List each co-author and what each is expected to contribute to the revision of the manuscript for publication.",
        "For co-authorship the student must have the major part and contribute at least 80% during the conduct of the study. The student and the co-authors adhere to the contribution stated here (Handbook p. 64).",
        "Co-authorship and study-grant agreements follow the institutional guidelines of the Center for Research and Engagement.",
    ],
    sections=[
        F("Student", RES4 + ["Type of paper", "Research Adviser", "Date"]),
        F(None, [("tall", "Title of the study", 2)]),
        T("Co-author(s)", [("Name", 3.6), ("Affiliation and email", 3.8), ("Expected contribution to the manuscript", 4.6), ("Share (%)", 1.4), ("Signature", 3.6)], 4, 1.0),
        F(None, ["Student's share (%)", "Study grant (sponsor, if any)"]),
        C(None, None, ["Discussed with the panel at the proposal defense", "The student contributes at least 80% of the work"], cols=1),
        S("Signatures", [("Student", None), ("Co-author(s)", "See table"), ("Research Adviser", None), ("Panel Chair", "Noted at the proposal defense")]),
    ],
    gs=["Filed on"])

# ---- 27 ------------------------------------------------------------------------------------
add("27", "Endorsement for Proposal / Final Defense", "Proposal defense and closed-door final defense", subtitle="Research Protocol Form 4",
    ref="Protocol Form 4; Handbook pp. 63, 65-66",
    instructions=[
        "Accomplished by the Research Adviser, with e-signature, once the paper complies with the research paper guidelines of the Graduate School Office. It must reach the Research Coordinator (gsresearch@usls.edu.ph) at least two (2) weeks before the defense.",
        "14-Day Rule: at least fourteen (14) days, inclusive of weekends, must pass from the date the panel members receive their copies of the manuscript to the date of the oral defense (Handbook p. 66). The panel members must not agree to a schedule without the manuscript. The same set of panel members takes part in the closed-door final defense. For a student who is abroad, the Panel Chair recommends an online defense and sends the online details.",
        "Attach the manuscript; for a proposal defense of a quantitative study, Form 4.1; for a final defense, the Ethics Clearance. The Research Adviser recommends the external panel member, subject to approval of the GS Research Committee.",
    ],
    sections=[
        F("Student", RES4 + ["Type of paper", "Research Adviser", "Date of this endorsement"]),
        F(None, [("tall", "Title of the study", 2)]),
        C("Defense endorsed", None, ["Proposal defense", "Closed-door final defense"], cols=2),
        F("Agreed schedule", ["Date of the defense", "Time", "Mode (onsite / online)", "Venue or online platform", "Manuscript given to the panel on", "Days from receipt to defense"]),
        T("Panel", [("Role", 3.6), ("Name", 5.6), ("Received the manuscript on", 3.6), ("Agrees to the schedule (e-signature)", 4.2)],
          [["Panel Chair", "", "", ""], ["Content Specialist", "", "", ""], ["Method Specialist", "", "", ""], ["Content Specialist 2 (dissertation)", "", "", ""], ["External panel member", "", "", ""]], 0.8),
        C("Attachments", None, ["Manuscript", "Form 4.1 Statistical Consultation (quantitative proposal)", "Ethics Clearance (final defense)", "Form 4.2 Co-authorship (if any)"], cols=2),
        P(None, "I certify that I have reviewed the manuscript, that it complies with the research paper guidelines of the Graduate School Office, and that the student is ready for the defense."),
        S("Signatures", [("Student", "Acknowledged"), ("Research Adviser", "Endorses the defense"), ("Research Coordinator", "Received; schedule recorded")]),
    ],
    gs=["Venue reserved on", "Forms 5 / 6 / 7 sent on"])

# ---- 28 ------------------------------------------------------------------------------------
add("28", "Request for Rescheduling or Cancellation of a Defense", "Defense scheduling and rescheduling",
    ref="Handbook pp. 63-67",
    instructions=[
        "Use this form when a confirmed defense cannot take place on its date. The new date must meet the lead times the Protocol sets for any defense: Form 4 at least two (2) weeks before the defense and the 14-Day Rule.",
        "Give the reason and say who is asking. The Research Coordinator records the change and informs the panel, the Research Adviser and the student. The new date is confirmed once the Research Adviser and every panel member have replied that they are available.",
    ],
    sections=[
        F("Student and defense", RES4 + ["Defense (title / proposal / final)", "Research Adviser", "Present date and time", "Present venue or platform"]),
        C("Request", None, ["Reschedule to the new date and time below", "Cancel the defense"], cols=2),
        F(None, ["New date", "New time", "Mode (onsite / online)", "New venue or platform"]),
        C("Requested by", None, ["Student", "Research Adviser", "Panel member", "Graduate School Office"], cols=2),
        B("Reason for the request", "", 2.2),
        T("Availability of the new date", [("Research Adviser / panel member", 6.6), ("Role", 3.4), ("Available? (yes / no)", 3.2), ("Initials", 3.8)], 6, 0.65),
        S("Signatures", [("Requested by", "Name and signature of the requester"), ("Research Adviser", "Noted"), ("Research Coordinator", "Approved  /  Not approved")]),
    ],
    gs=["Panel informed on", "Schedule updated on"])

# ---- 29 ------------------------------------------------------------------------------------
add("29", "Comments Sheet for Proposal Defense", "Proposal defense", subtitle="Research Protocol Form 5",
    ref="Protocol Form 5; Handbook pp. 63-65",
    instructions=[
        "Each panel member accomplishes a sheet and emails it to the Panel Chair for consolidation. The Panel Chair emails the consolidated Form 5 to the student, the Research Adviser and the Research Coordinator within the first working day after the defense. The Research Adviser records the comments of the panel during the defense.",
        "If major revisions are recommended, the student is advised to do a re-defense following the same protocol, and the decision must be reflected here. After the revisions, the Research Adviser endorses the paper to the panel for approval and the release of the Technical Review Certificate (GS-F-30).",
    ],
    sections=[
        F("Student and defense", RES4 + ["Type of paper", "Research Adviser", "Date of the defense", "Mode and venue"]),
        F(None, [("tall", "Title of the study", 2)]),
        F("Panel member", ["Name of panel member", "Role (chair, content, method, external)"]),
        T("Comments and suggestions", [("No.", 0.9), ("Page / section", 2.4), ("Comment or suggestion", 9.6), ("Action taken by the student", 4.1)], 9, 0.85),
        C("Recommendation", None, ["Passed", "Passed with minor revisions", "Major revisions: re-defense required (same protocol)", "Other (state): ________________"], cols=1),
        S("Signatures", [("Panel member", "Accomplished the sheet"), ("Panel Chair", "Consolidated and emailed on ________")]),
    ],
    gs=["Consolidated sheet received on"])

# ---- 30 ------------------------------------------------------------------------------------
add("30", "Technical Review Certificate", "Proposal defense and ethics review", subtitle="Research Protocol Form 5.1",
    ref="Protocol Form 5.1; Handbook pp. 64-65",
    instructions=[
        "Released after the student has addressed the comments of the proposal defense (Form 5), the Research Adviser has endorsed the revised paper, and the panel members have approved it. The Panel Chair facilitates the accomplishment of this form and emails it to the student and the Research Adviser, with a copy to the Research Coordinator.",
        "The student attaches this certificate to the Application for Ethics Review (GS-F-31), which must be filed within one (1) month after the proposal defense.",
    ],
    sections=[
        F("Student", RES4 + ["Type of paper", "Research Adviser", "Date of proposal defense", "Date revised paper given to the panel"]),
        F(None, [("tall", "Title of the study", 2)]),
        P("Certification", "This is to certify that the panel members named below reviewed the revised proposal of the student named above, that the comments and suggestions raised at the proposal defense have been addressed, and that the proposal is technically sound and may proceed to ethics review."),
        T("Panel approval", [("Role", 3.4), ("Name of panel member", 5.2), ("Approved", 2.2), ("Signature", 3.6), ("Date", 2.6)],
          [["Panel Chair", "", "☐", "", ""], ["Content Specialist", "", "☐", "", ""], ["Method Specialist", "", "☐", "", ""],
           ["Content Specialist 2 (dissertation)", "", "☐", "", ""], ["External panel member", "", "☐", "", ""]], 0.85),
        S("Noted by", [("Research Adviser", None), ("Research Coordinator", "Received")]),
    ],
    gs=["Recorded on"])

# ---- 31 ------------------------------------------------------------------------------------
add("31", "Application for Ethics Review", "Ethics review", subtitle="Research Protocol Form 5.2",
    ref="Protocol Form 5.2; Handbook pp. 23, 65",
    instructions=[
        "Email this form with the revised manuscript and the Technical Review Certificate (GS-F-30) to the research ethics committee (rerc@usls.edu.ph) within one (1) month after the proposal defense, so that there is enough time for review and revisions.",
        "Ethics clearance is needed before the closed-door final defense; the Research Adviser submits the Ethics Clearance with Form 4 (GS-F-27). The Graduate School records that the clearance was received; it does not judge its content.",
    ],
    sections=[
        F("Applicant", RES4 + ["Type of paper", "Research Adviser", "Date of proposal defense", "Date of this application"]),
        F(None, [("tall", "Title of the study", 2)]),
        F("Study details", [("full", "Research design (quantitative, qualitative or mixed)"), ("full", "Participants or sources of data, and sample size"), ("full", "Where and when data will be gathered"), ("full", "How data will be collected")]),
        C("The study involves", None, ["Human participants", "Minors or vulnerable persons", "Sensitive topics or personal data", "Interviews, focus groups or surveys", "Existing records or secondary data only", "No participants"], cols=2),
        B("Possible risks and how they are reduced; how consent and privacy are handled", "", 2.4),
        C("Attached", None, ["Revised manuscript", "Form 5.1 Technical Review Certificate", "Research instruments", "Informed consent form"], cols=2),
        S("Signatures", [("Applicant", "Student"), ("Research Adviser", "Endorsed")]),
        F("For the research ethics committee", ["Date received", "Clearance no.", "Decision (cleared / revise)", "Date of decision"]),
        S(None, [("Chair or authorized member of the research ethics committee", "Decision and clearance")]),
    ],
    gs=["Clearance recorded on"])


# ---- 32 ------------------------------------------------------------------------------------
add("32", "Comments Sheet for Final Defense", "Closed-door and public final defense", subtitle="Research Protocol Form 6",
    ref="Protocol Form 6; Handbook pp. 66-73",
    instructions=[
        "The Research Coordinator sends this form to the panel members. Each panel member accomplishes it and emails it to the Panel Chair within the first working day after the defense. The Panel Chair emails all the sheets with the consolidated comments to the Research Coordinator, the Research Adviser and the student within the same time.",
        "The student states, for every comment, the action taken and the page number where the improvement appears (Handbook pp. 72-73). At the public final defense, the panel members keep this sheet in hand to check compliance.",
        "A provisional pass with major revisions must be reflected here and must agree with the score on the Evaluation Sheet (GS-F-33): below 85 for a thesis, below 90 for a dissertation (Handbook p. 67).",
    ],
    sections=[
        F("Student and defense", RES4 + ["Type of paper", "Research Adviser", "Date of the defense", "Mode and venue"]),
        C(None, "Defense:", ["Closed-door final defense", "Public final defense"], cols=2),
        F(None, [("tall", "Title of the study", 2), "Name of panel member", "Role (chair, content, method, external)"]),
        T("Comments and suggestions", [("No.", 0.8), ("Page", 1.2), ("Comment or suggestion of the panel", 6.4), ("Action taken by the student", 5.0), ("Page where it appears", 1.8), ("Panel check", 1.8)], 8, 0.9),
        C("Recommendation", None, ["Pass", "Pass with minor revisions", "Provisional pass with major revisions; re-defense required", "Provisional pass with major revisions; no re-defense (panel approval of the revisions)"], cols=1),
        S("Signatures", [("Panel member", "Accomplished the sheet"), ("Panel Chair", "Consolidated and emailed on ________"), ("Research Adviser", "Recorded the comments")]),
    ],
    gs=["Consolidated sheets received on"])

# ---- 33 ------------------------------------------------------------------------------------
add("33", "Evaluation Sheet for Final Defense", "Closed-door final defense", subtitle="Research Protocol Form 7",
    ref="Protocol Form 7; Handbook pp. 66-67, 76",
    instructions=[
        "Each panel member and the Research Adviser accomplish this sheet and email it to the Research Coordinator (gsresearch@usls.edu.ph) within the first working day after the defense.",
        "The criteria and points are those the Handbook gives for the selection of the outstanding thesis or dissertation (p. 76), out of 100 points. A provisional pass with major revisions (subject to re-defense) must agree with the score: below 85 for a thesis, below 90 for a dissertation (Handbook p. 67).",
        "Mark the box below that matches the paper type and the result recorded in the Comments Sheet (GS-F-32).",
    ],
    sections=[
        F("Student and defense", RES4 + ["Type of paper", "Date of the defense", "Name of evaluator", "Role (panel member or Research Adviser)"]),
        F(None, [("tall", "Title of the study", 2)]),
        T("Evaluation", [("Criterion", 6.0), ("Maximum points", 2.2), ("Score", 2.0), ("Basis of the rating", 6.8)],
          [["Format and content", "15", "", "Theoretical or conceptual framework; conceptualization, nature and sources of data; standard format"],
           ["Analysis and discussion", "40", "", "Method of treating data; analysis and interpretation; related literature; clarity and accuracy of language"],
           ["Findings, action plan or program", "15", "", "Synthesis of results; quality of execution and depth"],
           ["Originality, contribution to new knowledge, applicability", "30", "", "Contribution to knowledge or practice; originality; practicability"],
           ["TOTAL", "100", "", ""]], 1.0),
        C("Result consistent with the score", None, ["Thesis: score of 85 or above", "Thesis: score below 85 (provisional pass, major revisions)",
                                                      "Dissertation: score of 90 or above", "Dissertation: score below 90 (provisional pass, major revisions)",
                                                      "Project paper: threshold set by the Graduate School: ________"], cols=1),
        B(None, "Remarks:", 1.4),
        S("Signature", [("Evaluator", "Panel member / Research Adviser"), ("Research Coordinator", "Received on ________")]),
    ],
    gs=["Score recorded on"])

# ---- 34 ------------------------------------------------------------------------------------
add("34", "Settlement of Provisional Thesis / Dissertation Approval", "Revisions and completion", subtitle="Research Protocol Form 8",
    ref="Protocol Form 8; Handbook p. 67",
    instructions=[
        "Used when the panel gave a provisional pass with major revisions and did not recommend a re-defense. The student complies with the corrections; once the revised manuscript is given to the panel members for approval, the 14-Day Rule applies.",
        "The Research Adviser accomplishes this form and emails it to the Research Coordinator (gsresearch@usls.edu.ph). If the student fails to meet the recommendations of all panel members at a given time, the student is advised to re-defend following the same protocol.",
    ],
    sections=[
        F("Student and defense", RES4 + ["Type of paper", "Research Adviser", "Date of the defense", "Score on Form 7"]),
        F(None, [("tall", "Title of the study", 2), "Revised manuscript given to the panel on", "14 days complete on"]),
        T("Revisions and compliance", [("No.", 1.0), ("Required revision (from Form 6)", 6.0), ("Action taken", 5.0), ("Page", 1.3), ("Member and initials", 3.7)], 7, 0.85),
        T("Panel approval of the revised manuscript", [("Role", 3.4), ("Name of panel member", 5.2), ("Approved", 2.2), ("Signature", 3.6), ("Date", 2.6)],
          [["Panel Chair", "", "☐", "", ""], ["Content Specialist", "", "☐", "", ""], ["Method Specialist", "", "☐", "", ""], ["Content Specialist 2 (dissertation)", "", "☐", "", ""]], 0.8),
        P(None, "I certify that the revisions required by the panel are reflected in the revised manuscript."),
        S("Signatures", [("Student", None), ("Research Adviser", "Certifies compliance"), ("Research Coordinator", "Received; provisional approval settled")]),
    ],
    gs=["Result recorded on"])

# ---- 35 ------------------------------------------------------------------------------------
add("35", "Endorsement for Public Final Defense", "Public final defense", subtitle="Research Protocol Form 4.3",
    ref="Protocol Form 4.3; Handbook pp. 70-73",
    instructions=[
        "This form applies to students admitted in August 2020 and after. The student is given two (2) to four (4) weeks after the closed-door final defense to prepare and apply (Handbook p. 71). Students admitted earlier present at a research conference instead.",
        "The Research Adviser first checks that the revised manuscript complies with the suggestions of the panel at the closed-door defense, then emails this form to the Research Coordinator. It must be fully accomplished with the e-signature of the panel members and the date the panel received the manuscript. The Protocol requires the application five (5) days before the preferred schedule, for posting.",
        "The Graduate School Office reserves the venue. The Research Coordinator prepares the public announcement, sends it to the Research Adviser, the student and the panel, with copy to the Associate Dean and the Dean, and posts it on the Graduate School Facebook page with the pre-registration link.",
    ],
    sections=[
        F("Student", RES4 + ["Type of paper", "Research Adviser", "Date of the closed-door defense", "Date of this endorsement"]),
        F(None, [("tall", "Title of the study", 2)]),
        F("Preferred schedule", ["Preferred date", "Time", "Mode (onsite / online)", "Venue requested (reserved by the Graduate School Office)"]),
        T("Panel", [("Role", 3.6), ("Name", 5.4), ("Received the revised manuscript on", 3.8), ("E-signature", 4.2)],
          [["Panel Chair", "", "", ""], ["Content Specialist", "", "", ""], ["Method Specialist", "", "", ""], ["Content Specialist 2 (dissertation)", "", "", ""], ["External panel member", "", "", ""]], 0.8),
        C("Attached", None, ["Revised manuscript", "Accomplished Form 6 with the action taken", "Ethics Clearance"], cols=2),
        P(None, "I certify that the revised manuscript complies with the comments and suggestions of the panel at the closed-door final defense and that the student is ready for the public final defense."),
        S("Signatures", [("Student", "Acknowledged"), ("Research Adviser", "Endorses the public defense"), ("Research Coordinator", "Schedule approved; announcement prepared")]),
    ],
    gs=["Announcement posted on", "Venue reserved on"])

# ---- 36 ------------------------------------------------------------------------------------
add("36", "Similarity Index (Turnitin) Certification", "Revisions and completion",
    ref="Handbook p. 68; Protocol, Closed-door Final Defense III",
    instructions=[
        "After the Research Adviser has verified that the panel's recommendations are reflected in the manuscript and has endorsed it for scanning, the student requests the Turnitin scan by emailing turnitin@usls.edu.ph. A similarity index rating (SIR) of not more than 15% is required before the paper goes to the editor (Handbook p. 68).",
        "The administrator who ran the scan completes and signs this certification. Attach the Turnitin similarity report. The certification is one of the documents the student sends to the Graduate School when the manuscript is ready for hard-bound reproduction.",
    ],
    sections=[
        F("Student and paper", RES4 + ["Type of paper", "Research Adviser", "Date endorsed by the Research Adviser for scanning"]),
        F(None, [("tall", "Title of the study", 2)]),
        F("Scan result", ["Date the paper was submitted for scanning", "Date of the scan", "Similarity index rating (%)", "Number of words scanned"]),
        C("Result", None, ["The similarity index is 15% or below; the paper may go to the editor", "The similarity index is above 15%; the student revises and the paper is scanned again"], cols=1),
        C(None, "Attached:", ["Turnitin similarity report"], cols=1),
        S("Certified by", [("Turnitin administrator", "Name and office: ________________")]),
    ],
    gs=["Filed on"])

# ---- 37 ------------------------------------------------------------------------------------
add("37", "Editor Certification", "Revisions and completion", subtitle="Research Protocol Form 9",
    ref="Protocol Form 9; Handbook p. 68",
    instructions=[
        "The student chooses an editor from the pool of editors affiliated with the University, so that the USLS Institutional Research Format (IRF) is applied. The Research Adviser may not be the student's editor (Handbook p. 59). The 14-Day Rule applies to the time the editor has for review. The editor gives this certification once the corrections have been carried out.",
        "The student sends the Editor Certification, with the final manuscript, the panel approval emails, the Ethics Clearance and the Turnitin certification, to the Graduate School Office (gsresearch@usls.edu.ph), copy to the ethics committee.",
    ],
    sections=[
        F("Student and paper", RES4 + ["Type of paper", "Research Adviser", "Turnitin similarity index (%)"]),
        F(None, [("tall", "Title of the study", 2)]),
        F("Editor", ["Name of editor", "College / office (University-affiliated)", "Date manuscript received by the editor", "Date returned to the student"]),
        C("Editing carried out", None, ["The USLS Institutional Research Format (IRF) was applied", "Language, grammar, mechanics and references were checked", "The student carried out the corrections of the editor"], cols=1),
        P("Certification", "This is to certify that I edited the final manuscript of the student named above, that the corrections were carried out, and that the manuscript follows the USLS Institutional Research Format."),
        S("Signature", [("Editor", "Name, signature and date")]),
    ],
    gs=["Filed on"])

# ---- 38 ------------------------------------------------------------------------------------
add("38", "Approval Sheet", "Revisions and completion", subtitle="Research Protocol Form 10",
    ref="Protocol Form 10; Handbook pp. 68, 77",
    instructions=[
        "The Graduate School Office coordinates with the panel members and the Research Adviser for the signing of this sheet. The signed sheet is bound into the bound copies, which must carry the official approval of the members of the defense panel and the official acceptance of the Dean (Handbook p. 77).",
        "Submit the bound copies and the CD with the signed approval sheets as part of the requirements for the diploma, the transcript of records and related documents.",
    ],
    sections=[
        F("Student", RES4 + ["Degree", "Date of the final defense"]),
        F(None, [("tall", "Title of the study", 2)]),
        P("Approval", "This project paper, thesis or dissertation, prepared and submitted by the student named above in partial fulfillment of the requirements for the degree stated, has been examined by the defense panel, has complied with the required revisions, and is recommended for acceptance."),
        T("Panel and Research Adviser", [("Role", 3.8), ("Name", 5.8), ("Signature", 4.2), ("Date", 3.2)],
          [["Research Adviser", "", "", ""], ["Panel Chair", "", "", ""], ["Content Specialist", "", "", ""], ["Method Specialist", "", "", ""],
           ["Content Specialist 2 (dissertation)", "", "", ""], ["External panel member", "", "", ""]], 0.95),
        P("Acceptance", "Accepted by the Graduate School in partial fulfillment of the requirements for the degree."),
        S("Accepted by", [("Graduate School Dean", None)]),
    ],
    gs=["Bound copies and CD received on"])

# ---- 39 ------------------------------------------------------------------------------------
add("39", "Formal Invitation to Co-Author Journal Article", "Publication", subtitle="Research Protocol Form 11",
    ref="Protocol Form 11; Handbook pp. 64, 75",
    instructions=[
        "Use only if the co-author was pre-identified during the proposal (GS-F-26). The student sends the invitation to the prospective co-author and attaches the signed form to the publication request (GS-F-40).",
        "The student must have the major part and contribute at least 80% (Handbook p. 64). The published article must show the authors' affiliation in the format given in the Handbook, p. 75.",
    ],
    sections=[
        F("Student", RES4 + ["Research Adviser", "Date of invitation"]),
        F("Prospective co-author", ["Name", "Position", "Institution and department", "Email", ("full", "Title of the study")]),
        F(None, [("full", "Journal intended for submission (from the list of the Publication and Engagement Office)")]),
        P("Invitation", "I respectfully invite you to be co-author of the journal article prepared from the study named above. Your expected contribution is stated below. I understand that my own contribution remains the major part of the work and not less than 80%."),
        B(None, "Expected contribution of the co-author to the article:", 2.0),
        C("Reply of the invitee", None, ["I accept the invitation", "I decline the invitation"], cols=2),
        S("Signatures", [("Student", "Invites"), ("Co-author", "Replies"), ("Research Adviser", "Noted")]),
    ],
    gs=["Filed on"])

# ---- 40 ------------------------------------------------------------------------------------
add("40", "Publication Information Form", "Publication", subtitle="Research Protocol Form 12",
    ref="Protocol Form 12; Handbook p. 75",
    instructions=[
        "The student chooses a journal from the approved list of the Publication and Engagement Office (PEO). PhD students publish in a Scopus, ISI or Web of Science journal; MA students may choose peer-reviewed journals only (Handbook p. 75).",
        "Email the manuscript, the Ethics Clearance (if applicable), Form 11 (if applicable) and this form to the Research Coordinator, to be reviewed by the Research Committee (Research Coordinator, Academic Coordinator, Associate Dean and the external expert). The members sign, the Research Coordinator endorses to the Dean, and after approval the Research Coordinator emails this form to the student, who may then submit to the journal.",
        "If the paper comes from a course requirement, state the professor and the course. The article must show the authors' affiliation in the format given in the Handbook (p. 75).",
    ],
    sections=[
        F("Student", RES4 + ["Research Adviser", "Date of application"]),
        F("Article and journal", [("full", "Title of the article"), ("full", "Name of the journal"), "Publisher", "ISSN", "Journal website"]),
        C("Indexing of the journal", None, ["Scopus", "Web of Science", "ISI", "Peer-reviewed (MA students)", "The journal is on the PEO approved list"], cols=2),
        F(None, [("full", "Authors and affiliations, in the format of the Handbook"), "Professor (if required by a course)", "Course"]),
        C("Attached", None, ["Manuscript", "Ethics Clearance, if any", "Form 11, if any"], cols=3),
        S("Screening by the Research Committee", [("Research Coordinator", None), ("Academic Coordinator", None), ("Associate Dean", None), ("External expert of the Research Committee", None)]),
        S("Decision of the Dean", [("Graduate School Dean", "Approved for submission  /  Not approved")]),
    ],
    gs=["Returned to the student on"])

# ---- 41 ------------------------------------------------------------------------------------
add("41", "Evidence of Publication or Acceptance", "Publication", subtitle="Research Protocol Form 13",
    ref="Protocol Form 13; Handbook pp. 75, 77",
    instructions=[
        "Submit this form with a copy of the journal and/or the certificate of publication or letter of acceptance, to the Research Coordinator (gsresearch@usls.edu.ph).",
        "A student can only be declared a graduate and join the graduation ceremony once this form and the evidence have been submitted (Handbook p. 75). For students enrolled from AY 2022-2023, at least one research paper must be published in a Scopus, Web of Science or ISI journal while enrolled (Handbook p. 77).",
    ],
    sections=[
        F("Student", RES4 + ["Research Adviser", "Date submitted"]),
        F("Article", [("full", "Title of the article"), ("full", "Name of the journal"), "Volume, issue and pages", "DOI or web address", "Date accepted or published", "Date of approval of Form 12"]),
        C("Status", None, ["Accepted for publication", "Published"], cols=2),
        C("Attached", None, ["Copy of the journal", "Certificate of publication or letter of acceptance", "The authors' affiliation follows the Handbook format"], cols=1),
        S("Signatures", [("Student", None), ("Research Coordinator", "Received; evidence checked for presence")]),
    ],
    gs=["Recorded on"])

# ---- 42 ------------------------------------------------------------------------------------
add("42", "Application for Graduation", "Graduation application and endorsement",
    ref="Handbook pp. 55-56, 68-69, 75-77, 80",
    instructions=[
        "A student is considered a graduate only after completing all the requirements below; a student who has not met them may not take part in the graduation ceremony (Handbook p. 77). The student must be officially enrolled in the semester of application.",
        "The Graduate School checks that each document is present. It does not verify the content of the documents. The University Registrar certifies the eligibility of candidates for graduation and honors (Handbook p. 32). An application with wrong information is returned and replaced by a new corrected form; the first form is kept.",
        "Graduating students attend the Alumni seminar (Handbook p. 80) and present the thesis or dissertation at a research conference, either the Graduate School Research Conference or an external one (Handbook pp. 69, 74).",
    ],
    sections=[
        F("Student", STU + ["Degree applied for", "Term and academic year of graduation"]),
        T("Requirements", [("Requirement", 8.2), ("Evidence", 4.4), ("Checked by (initials)", 2.4), ("Date", 2.0)],
          [["Officially enrolled in the semester of application", "", "", ""], ["All prescribed subjects completed", "", "", ""], ["Comprehensive examination passed", "", "", ""],
           ["Successful final oral defense; required revisions complied with", "", "", ""], ["Practicum completed (programs with a practicum)", "", "", ""],
           ["Ethics Clearance, Turnitin certification, Editor Certification", "", "", ""], ["One bound approved copy and one CD, with Form 10", "", "", ""],
           ["Presented in a public seminar series or research conference", "", "", ""], ["Published at least one paper (Form 13), if enrolled from AY 2022-2023", "", "", ""],
           ["All financial obligations to the University paid", "", "", ""], ["Alumni seminar attended", "", "", ""]], 0.78),
        P(None, "I declare that the information above is true and that I will complete any requirement still open before the graduation date."),
        S("Signatures", [("Student", "Applicant"), ("Academic Coordinator", "Coursework verified"), ("Research Coordinator", "Research documents verified"), ("Graduate School Dean", "Endorsed  /  Returned")]),
    ],
    gs=["Review window", "Batch"])

# ---- 43 ------------------------------------------------------------------------------------
add("43", "Graduation Endorsement List", "Graduation application and endorsement",
    ref="Handbook pp. 32, 77",
    instructions=[
        "The Graduate School Staff compile the candidates whose coursework, research and, where applicable, practicum are complete and who have submitted a signed graduation application (GS-F-42). The Academic Coordinator checks the coursework; the Research Coordinator validates the research completion documents.",
        "The Dean approves the list and sends it to the University Registrar by official email with GS-F-44. The Registrar certifies the eligibility of candidates for graduation and honors (Handbook p. 32).",
    ],
    sections=[
        F("Batch", ["Academic year", "Review window", "Batch name", "Date prepared", "Prepared by (Graduate School Staff)", "Number of candidates"]),
        T("Candidates endorsed", [("No.", 0.9), ("Student no.", 2.0), ("Name of student", 3.8), ("Program", 1.8), ("Coursework", 2.3), ("Research", 1.9), ("Practicum", 2.1), ("Remarks", 2.2)], 12, 0.62),
        C("Dean's decision", None, ["The list is approved and endorsed to the University Registrar", "Returned to the Graduate School (see remarks)"], cols=1),
        B(None, "Remarks of the Dean:", 1.2),
        S("Signatures", [("Prepared by", "Graduate School Staff"), ("Coursework checked by", "Academic Coordinator"), ("Research documents validated by", "Research Coordinator"), ("Approved by", "Graduate School Dean")]),
    ],
    gs=["File exported on", "Sent to Registrar on"])

# ---- 44 ------------------------------------------------------------------------------------
add("44", "Records Transmittal to the University Registrar", "Records handoff to the Registrar",
    ref="Handbook pp. 32, 49-50, 53",
    instructions=[
        "Use one transmittal for each handoff to the Registrar: a notice of an approved leave with the reasons and any refund, a copy of the Withdrawal Form, the Dean's endorsement of a returning student, or the graduation endorsement list. The Graduate School's responsibility ends at sending the request to the Registrar.",
        "The Registrar records receipt in the last section. The Graduate School keeps the original and does not treat the matter as done until the Registrar's confirmation is on file. Official enrollment and grade data stay with the Registrar.",
    ],
    sections=[
        F("Transmittal", ["Date sent", "Sent by (name and office)", "Mode (email / hand-carried)", "Reference no."]),
        C("Type of handoff", None, ["Notice of approved leave of absence (GS-F-07)", "Withdrawal Form copies (GS-F-05)", "Endorsement of returning student (GS-F-08)", "Graduation endorsement list (GS-F-43)", "Cross-enrollment or other request", "Other: ____________________"], cols=1),
        T("Records transmitted", [("Student no.", 2.4), ("Name of student", 5.0), ("Document", 4.4), ("Term", 2.4), ("Remarks (reason, refund)", 2.8)], 5, 0.68),
        S("Signatures", [("Sent by", "Dean, Associate Dean or authorized representative"), ("Received by", "University Registrar (name, date, reference no.)")]),
    ],
    gs=["Confirmation of Registrar on"])


# ---- 45 ------------------------------------------------------------------------------------
add("45", "Data Privacy Consent and Acknowledgement", "Data privacy and records retention",
    ref="RA 10173 (Data Privacy Act of 2012); GS-P-04",
    instructions=[
        "This is the paper twin of the notice shown once to every account holder at first sign-in to the Graduate School platform (GS-P-04, Data Privacy Notice and Records Retention Schedule). Use it for a person without a platform account, or when a signed copy is wanted for the file.",
        "Read GS-P-04 before you sign. It states what personal data the Graduate School keeps, why, who sees it, what leaves the platform for an outside service, how long it is kept, and how you can ask to see, correct or remove it (Data Privacy Act of 2012, sections 11, 12 and 16).",
        "Consent is given item by item. The Data Protection Officer of the University is the contact for questions and complaints (contact: ______________________).",
    ],
    sections=[
        F("Person", [("cols", [("Full name", 3), ("Student number or employee number", 3)]), ("cols", [("Institutional email", 3), ("Program or office", 3)]),
                     ("cols", [("Mobile number", 2), ("Date", 2), ("Revision of GS-P-04 read", 2)])]),
        C("Role", None, ["Student", "Faculty member", "Graduate School Staff or Academic Coordinator", "Research Coordinator or Dean", "Other: ____________________"], cols=2),
        C("Consent", "Tick each item you agree to. An item left blank is recorded as not agreed.",
          ["I have read GS-P-04 and understand it.",
           "I agree that the Graduate School keeps and uses my personal data for the lifecycle of a graduate student (admission, enrollment, requests, research, graduation) as GS-P-04 describes.",
           "I understand that, when the Policy Assistant is switched on, my questions and short policy passages (and, for a personal question, a short summary of my own record or work queue) are sent to an outside service to produce an answer, as GS-P-04 section 5 describes.",
           "Faculty members only: I agree that defense schedules are written to the Google Calendar I connect to the platform, with the defense type, the student's name, the time and the venue.",
           "I know my rights to be informed, to object, to access, to correct, to have data blocked or removed, to data portability and to claim damages, and that I may complain to the National Privacy Commission (RA 10173, section 16)."], cols=1),
        B(None, "Remarks or objections of the person (the Graduate School will answer in writing):", 1.4),
        S("Signatures", [("Person", "Signature over printed name"), ("Received by", "Graduate School Staff")]),
    ],
    gs=["Filed in", "Recorded on"])

# ---- 46 ------------------------------------------------------------------------------------
add("46", "Platform Account and Role Request", "Platform accounts and roles",
    ref="GS-P-05",
    instructions=[
        "Use this form to ask for a platform account, to change the role of an account, or to remove an account when the holder leaves the Graduate School or the role. A student account is created by the platform when the student is handed off from admission; this form is for every other account.",
        "Every account has one role. The role decides what the holder can see and do (GS-P-05, Platform Access and Roles Matrix). Ask for the least access the work needs.",
        "The head of the requester's office endorses, the Dean approves, and the Graduate School Staff or the platform administrator sets up the account and hands over the first password privately. The holder must choose a new password at first sign-in.",
    ],
    sections=[
        F("Requester", [("cols", [("Full name", 3), ("Position", 3)]), ("cols", [("Office or college", 3), ("Institutional email (becomes the sign-in name)", 3)]),
                        ("cols", [("Mobile number", 3), ("Date of request", 3)])]),
        C("Request", None, ["New account", "Change of role on an existing account", "Remove (deactivate) the account"], cols=1),
        C("Role requested", "Choose one:", ["Graduate School Staff", "Academic Coordinator (state the program areas below)", "Research Coordinator", "Dean", "Faculty Member", "Administrator (technical set-up only)"], cols=2),
        F(None, [("full", "Program areas or scope the role covers"), ("full", "Reason for the request (and, for a removal, the date the person leaves)")]),
        P(None, "I will use only my own account and keep my password private. I will choose my own password (at least 10 characters) at first sign-in, never share the account, and tell the Graduate School at once if I think someone else has used it. I have read GS-P-04."),
        S("Request, endorsement and approval", [("Requester", None), ("Head of office or college", "Endorsed  /  Not endorsed"), ("Graduate School Dean", "Approved  /  Not approved")]),
        F("Set-up (Graduate School Staff or platform administrator)", ["Account created or changed on", "Role set", "First password handed over privately on", "Account removed or deactivated on"]),
    ],
    gs=["Set up by"])

# ---- 47 ------------------------------------------------------------------------------------
add("47", "Faculty Course Preference and Availability", "Faculty course preference and teaching load",
    ref="",
    instructions=[
        "Filled by a faculty member for each term, or whenever the hours change. The Academic Coordinator or the Graduate School Staff key the answers into the platform (the faculty member can also enter them in the faculty portal). The same answers are used to propose the teaching load (GS-F-48) and to check defense schedules.",
        "Part B lists the subjects you prefer to teach; priority 1 is the most preferred. A preference does not grant the load. Part C is your usual weekly hours. Part D is for single dates and for dates you cannot be reached; unavailability always wins over available hours.",
        "Part E answers a request from the Graduate School to enter your availability for a student's defense. Times use Philippine local time.",
    ],
    sections=[
        F("Faculty member", [("cols", [("Name", 3), ("College", 3)]), ("cols", [("Role or rank", 2), ("Specialization", 4)]), ("cols", [("Email", 3), ("Academic year / semester", 3)])]),
        T("Subjects preferred (priority 1 = most preferred)", [("Priority", 1.6), ("Subject code", 2.6), ("Subject title", 8.0), ("Program", 4.8)], 5, 0.62),
        T("Usual weekly hours", [("Weekday", 3.0), ("Available? (yes / no)", 3.6), ("From (time)", 3.2), ("To (time)", 3.2)],
          [["Monday", "", "", ""], ["Tuesday", "", "", ""], ["Wednesday", "", "", ""], ["Thursday", "", "", ""], ["Friday", "", "", ""], ["Saturday", "", "", ""]], 0.62),
        T("Dates available or unavailable", [("Available or unavailable", 3.6), ("Start date", 2.8), ("End date (if a range)", 3.0), ("From (time)", 2.2), ("To (time)", 2.2), ("Note", 3.4)], 4, 0.62),
        F("Reply to an availability request (only if the Graduate School asked)", ["Requested by", "Student", "Window from", "Window to", ("full", "Message of the requester and your answer (dates and times you can attend, or that you cannot)")]),
        S("Signatures", [("Faculty member", None), ("Academic Coordinator", "Received and keyed into the platform")]),
    ],
    gs=["Recorded on"])

# ---- 48 ------------------------------------------------------------------------------------
add("48", "Teaching Load Assignment", "Faculty course preference and teaching load",
    ref="GS-F-04, GS-F-47; Handbook p. 48 (special classes)",
    instructions=[
        "Prepared by the Academic Coordinator for each program and term, after the Term Course Offering Plan (GS-F-04) and the faculty answers (GS-F-47) are in. One line for each subject section that needs a professor. The Dean approves the assignment before it is published; each faculty member acknowledges the load.",
        "The Handbook states no limit on the load of a professor, so the maximum load is written in by the Graduate School. A professor is proposed only for dates and hours the professor has entered as available.",
    ],
    sections=[
        F("Plan", ["Program", "Academic year / semester", "Prepared by (Academic Coordinator)", "Date prepared", "Maximum load per professor (units)", "Reference: Term Course Offering Plan dated"]),
        T("Assignment of subjects", [("Subject code", 2.0), ("Subject title", 4.6), ("Units", 1.1), ("Secs.", 1.3), ("Professor proposed", 3.4), ("Preference rank (GS-F-47)", 2.0), ("Schedule", 2.6)], 8, 0.72),
        T("Load of each professor", [("Professor", 5.2), ("Subjects", 1.8), ("Total units", 2.0), ("Within the maximum? (yes / no)", 3.4), ("Acknowledged (signature, date)", 4.6)], 4, 0.72),
        C("Status", None, ["Proposed by the Academic Coordinator", "Approved by the Dean", "Returned for change (see remarks)"], cols=1),
        B(None, "Remarks (subjects without a professor, undersized classes asked for as special classes, changes made):", 1.4),
        S("Approval", [("Prepared by", "Academic Coordinator"), ("Approved by", "Graduate School Dean")]),
    ],
    gs=["Published on"])

# ---- 49 ------------------------------------------------------------------------------------
add("49", "Request for Approved Absence", "Dropping and attendance",
    ref="Handbook p. 52",
    instructions=[
        "A student who takes part in a school-sponsored activity or represents the University in an official capacity is granted an Approved Absence upon the approval of the Dean. The absence is noted on the attendance record and is not counted against the allowed absences in the subject (Handbook p. 52).",
        "The privilege does not relieve the student of the responsibility of making up any work missed (Handbook p. 52). File the request before the activity, with the invitation or endorsement of the organizer.",
        "An absence for a graduate program activity endorsed by the Dean is also an excused absence (Handbook p. 52); this form may be used for it too. The Academic Coordinator recommends; the Dean approves.",
    ],
    sections=[
        F("Student", STU_SHORT + ["Academic year / semester", "Date of this request"]),
        C("Activity", "The absence is for:", ["A school-sponsored activity", "Representing the University in an official capacity", "A graduate program activity endorsed by the Dean"], cols=1),
        F(None, [("full", "Name of the activity and organizer"), "Venue", "Dates of the activity", "Hours of class to be missed", "Attached (invitation, endorsement)"]),
        T("Subjects affected", [("Subject code", 2.4), ("Subject title", 6.0), ("Professor", 4.2), ("Dates missed", 2.6), ("Hours", 1.8)], 4, 0.65),
        P(None, "I will make up all work missed, to the satisfaction of the professor of each subject, and I understand that the Approved Absence does not excuse that work."),
        S("Signatures and decision", [("Student", None), ("Academic Coordinator", "Recommended  /  Not recommended"), ("Graduate School Dean", "Approved  /  Not approved")]),
    ],
    gs=["Noted on attendance record on", "Professors informed on"])

# ---- 50 ------------------------------------------------------------------------------------
add("50", "Incomplete Grade Removal Form", "Incomplete grades",
    ref="Handbook pp. 48, 54",
    instructions=[
        "A grade of INC may be given if the class standing is passing but the student did not take the final examination, or did not complete other requirements for the subject, due to illness or other valid reasons (Handbook p. 54). Removal of the INC must be done within one (1) academic year by meeting all the requirements of the course (Handbook p. 54).",
        "The student submits this form to the Graduate School Office within the set deadline (email gsm@usls.edu.ph). A student who does not comply after a year automatically gets 3.0 (master's) or 2.0 (doctorate) and has to take the subject again; a student with INC in all subjects is dropped from the rolls of the Graduate School (Handbook p. 54). A student not enrolled in any subject who wants to complete an INC enrols in residency (Handbook p. 48).",
        "This form is kept on paper in the Graduate School Office. The Graduate School states the deadline in the space below.",
    ],
    sections=[
        F("Student", STU_SHORT + ["Date of this form", "Contact number"]),
        F("Subject with the INC", ["Subject code", "Subject title", "Professor", "Academic year / semester the INC was given", "Date by which the INC must be removed (one academic year)", "Deadline set by the Graduate School"]),
        C("Reason for the INC", None, ["Did not take the final examination", "Did not complete other requirements of the subject", "Cause: illness", "Cause: other valid reason (state below)"], cols=2),
        T("Requirements to be met", [("Requirement", 8.0), ("Date agreed with the professor", 3.2), ("Date completed", 2.8), ("Professor's initials", 3.0)], 4, 0.65),
        F("Final grade (professor)", ["Final grade after removal", "Date given", ("full", "Remarks")]),
        S("Signatures", [("Student", None), ("Professor of the subject", "Requirements met; final grade given"), ("Academic Coordinator", "Noted"), ("Graduate School Dean", "Noted")]),
    ],
    gs=["Received at Graduate School Office on", "Final grade reported to Registrar on"])

# ---- 51 ------------------------------------------------------------------------------------
add("51", "Application for Cross-enrollment", "Cross-enrollment",
    ref="Handbook p. 50",
    instructions=[
        "Coursework taken at another institution by a regularly enrolled student is not credited unless the student has secured the written permission of the Dean in advance. That permission is the basis of the cross-enrollment permit that the Registrar issues (Handbook p. 50).",
        "Normally cross-enrollment is not allowed unless the student is graduating and the course is not offered in the semester the student is supposed to graduate. A student may not cross-enrol in major elective or major professional courses (Handbook p. 50).",
        "Procedure: (1) secure the Dean's approval, (2) present it to the Registrar for the cross-enrollment permit, (3) after the course, submit the grade to the Registrar for the academic record; the student secures the transcript of credit (Handbook p. 50).",
    ],
    sections=[
        F("Student", STU_SHORT + ["Academic year / semester of graduation", "Date of this application"]),
        F("Course at the other institution", [("full", "Name of institution"), "Course code", "Course title", "Units", "Term and dates", ("full", "Equivalent USLS subject (code and title)")]),
        C("Conditions the Academic Coordinator checks", None,
          ["The student is graduating in the semester named above", "The course is not offered at the University in that semester", "The course is not a major elective or a major professional course"], cols=1),
        B(None, "Reason for the request:", 1.6),
        S("Signatures and decision", [("Student", None), ("Academic Coordinator", "Conditions verified"), ("Graduate School Dean", "Approved  /  Not approved"),
                                      ("University Registrar", "Cross-enrollment permit issued (no. and date)")]),
        F("After the course", ["Transcript of credit received on", "Grade submitted to Registrar on"]),
    ],
    gs=["Permit no."])

# ---- 52 ------------------------------------------------------------------------------------
add("52", "Request for a Special Class", "Special and undersized classes",
    ref="Handbook p. 48",
    instructions=[
        "A special class may be requested and offered when the Academic Coordinator requests it through the Dean, addressed to the Vice Chancellor for Academic Affairs (Handbook p. 48). An undersized class is treated as a special class (Handbook p. 48).",
        "The class follows the Blended Learning Mode: 32 contact hours plus independent study. The fee is computed as for undergraduate courses (the professor's rate per load for 5 months plus the 13th month and administrative expenses, divided by the number of students enrolled) and is added to the regular tuition (Handbook p. 48).",
        "The Dean sees that each new batch reaches the minimum number of enrollees, with an allowance for attrition (Handbook p. 48). The Graduate School writes in the minimum for the program.",
    ],
    sections=[
        F("Class requested", ["Program", "Academic year / semester", "Subject code", "Subject title", "Units", "Number of students who need it", "Minimum enrollees set by the Graduate School", "Professor proposed"]),
        C("Reason", None, ["Undersized class (fewer than the minimum enrollees)", "Subject needed by students who are graduating", "Subject needed to keep a batch on schedule", "Other (state below)"], cols=1),
        T("Students who need the class", [("Student no.", 2.6), ("Name of student", 7.0), ("Year of entry", 2.6), ("Reason needed", 4.8)], 6, 0.62),
        F(None, [("full", "Proposed schedule (blended: 32 contact hours plus independent study)"), ("full", "Other remarks")]),
        P(None, "The fee of the special class is computed by the Business Office with the formula of Handbook p. 48 and is paid in addition to the regular tuition."),
        S("Request and decision", [("Academic Coordinator", "Requests"), ("Graduate School Dean", "Through the Dean"), ("Vice Chancellor for Academic Affairs", "Approved  /  Not approved")]),
    ],
    gs=["Offered as section"])

# ---- 53 ------------------------------------------------------------------------------------
add("53", "Request for Transfer between Master's Options", "Transfer between master's options",
    ref="Handbook p. 48",
    instructions=[
        "A student in the master's program may be allowed to transfer to another master's option, subject to the approval of the Dean, upon the recommendation of the Academic Coordinator and endorsed by the Associate Dean (Handbook p. 48). This form does not apply to a transfer between a master's and a doctorate program.",
        "The Dean decides which subjects already taken are credited to the new option. The Registrar is informed of an approved transfer.",
    ],
    sections=[
        F("Student", STU_SHORT + ["Date admitted to the program", "Date of this request"]),
        F("Transfer", ["Present master's option", "Master's option requested", "Academic year / semester the transfer is to start", "Units completed so far"]),
        B("Reason for the transfer", "", 1.8),
        T("Subjects the student asks to be credited to the new option", [("Subject code", 2.6), ("Subject title", 8.4), ("Units", 1.6), ("Credited? (yes / no)", 4.4)], 5, 0.62),
        S("Recommendation, endorsement and approval", [("Student", None), ("Academic Coordinator", "Recommended  /  Not recommended"), ("Associate Dean", "Endorsed  /  Not endorsed"), ("Graduate School Dean", "Approved  /  Not approved")]),
    ],
    gs=["Registrar informed on", "Program changed on"])

# ---- 54 ------------------------------------------------------------------------------------
add("54", "Nomination for Best Thesis / Dissertation", "Best thesis and dissertation award",
    ref="Handbook pp. 76-77",
    instructions=[
        "Awards are given to the best theses and dissertations to recognize outstanding research (Handbook p. 76). The criteria are Format/Content 15 points, Analysis/Discussion 40 points, Findings/Action Plan/Program 15 points, and Originality/Novelty/Contribution to New Knowledge/Applicability of Research 30 points; total 100 (Handbook p. 76).",
        "A cut-off score of 96 points is set to qualify as an outstanding project paper, thesis or dissertation. The chairman of the committee or the Dean submits the work to the committee for deliberation, and approval by the majority is required (Handbook p. 77).",
        "The Research Adviser or the Panel Chair nominates a work after the final defense. The committee scores it and deliberates.",
    ],
    sections=[
        F("Nominee", STU_SHORT + [("full", "Title of the project paper, thesis or dissertation"), "Research Adviser", "Date of the final defense", "Academic year of graduation"]),
        C(None, "Kind of work:", ["Project paper", "Thesis", "Dissertation"], cols=3),
        F(None, ["Nominated by (Research Adviser or Panel Chair)", "Date of nomination"]),
        T("Score of each committee member (Handbook p. 76)", [("Member", 4.0), ("Format / Content (15)", 2.2), ("Analysis / Discussion (40)", 2.4), ("Findings / Action Plan (15)", 2.4), ("Originality / Applicability (30)", 2.6), ("Total (100)", 1.8), ("Signature", 2.4)], 5, 0.65),
        F("Result", ["Final score (average of the members)", "Cut-off score", "Qualifies as outstanding? (96 or more)", "Majority of the committee approves? (yes / no)"]),
        S("Submission and deliberation", [("Nominated by", None), ("Chairman of the committee or Dean", "Submitted to the committee for deliberation"), ("Graduate School Dean", "Award approved  /  Not approved")]),
    ],
    gs=["Committee met on"])


# =========================================================================== routing data for GS-P-02
# code: (when used, submitted by, reviewed by, approved / decided by, goes next to, platform step)
ROUTES = {
    "01": ("After each admission handoff or import of the monitoring workbook", "Graduate School Staff", "Academic Coordinator", "Dean", "Enrollment and advising", "Admission: Dean onboarding gate"),
    "02": ("Before enrollment each term", "Student", "Academic Coordinator", "Academic Coordinator", "Student enrolls in AIMS; Business Office", "Enrollment: study plan, Academic Coordinator review"),
    "03": ("First week of classes only", "Student", "Academic Coordinator", "Associate Dean (added subject)", "Graduate School Office issues the Advice Slip; Business Office", "Course Adjustments"),
    "04": ("Term break, before enrollment", "Academic Coordinator", "Associate Dean", "Dean", "Published to students; Business Office", "Course Adjustments: offering plan (draft, submitted, approved, published)"),
    "05": ("Up to the second week of classes (later only as the Handbook allows)", "Student", "Academic Coordinator", "Dean", "Registrar; Accounting Office; Business Office", "Withdrawal: Dean Review, then Registrar"),
    "06": ("Unexcused absences above 20% of class hours", "Professor", "Academic Coordinator", "Academic Coordinator (Dean noted)", "Registrar (AIMS); GS record", "Monitoring: drop with absence evidence"),
    "07": ("Before a semester the student will not enroll in; not within 2 weeks of the last day of classes", "Student", "Academic Coordinator", "Dean", "Registrar (notice with refund); Business Office", "Leave of absence case"),
    "08": ("When a student returns from leave or AWOL", "Student", "Academic Coordinator; Business Office", "Dean (endorses to Registrar)", "Registrar; enrollment", "Readmission case"),
    "09": ("When AWOL is found from source evidence", "Graduate School Staff or Academic Coordinator", "—", "Dean (noted)", "Student; Registrar; GS-F-08 on return", "Absence without leave case (declared)"),
    "10": ("Term of residency (thesis, practicum, comprehensive exam, INC, publication)", "Student", "Academic Coordinator", "Dean or authorized representative", "Business Office; enrollment", "Residency enrollment"),
    "11": ("Before the practicum starts", "Student", "Academic Coordinator", "Dean (for the University)", "Host organization; GS file", "Practicum: Practicum Agreement received"),
    "12": ("During and at the end of the practicum", "Student (keeps the log); host supervisor", "Host supervisor", "Host supervisor certifies", "GS-F-13", "Practicum: hours and certificates"),
    "13": ("When the required hours are complete", "Academic Coordinator", "Academic Coordinator", "Dean reviews (no approval)", "Graduation review", "Practicum: report sent to the Dean, reviewed by the Dean"),
    "14": ("At least 2 weeks before the examination", "Student", "Academic Coordinator or College Dean", "Graduate Program Secretary", "Examination; GS-F-15", "Comprehensive exam status"),
    "15": ("After the examination", "Academic Coordinator", "Graduate Program Secretary", "Dean (noted)", "Monitoring workbook (comprehensive examination column); Research Adviser designation", "Comprehensive exam: result recorded"),
    "16": ("At least 2 weeks before the title defense", "Student", "Academic Coordinator", "Academic Coordinator endorses; Research Coordinator", "Panel nomination (GS-F-17)", "Research gate: Form 1 - Title Defense"),
    "17": ("When a panel is nominated for any defense", "Research Coordinator", "GS Research Committee", "Research Coordinator; Committee for external panel; Associate Dean (noted)", "Defense scheduling", "Panel matching and panel invitations"),
    "18": ("Within the first working day after the title defense", "Panel Chair", "Panel members", "Panel", "Research Adviser designation (GS-F-19)", "Title defense verdict"),
    "19": ("After the comprehensive examination, while taking courses or after the title defense", "Student", "Academic Coordinator (notes)", "Research Coordinator, Associate Dean and Dean (they sign GS-F-20)", "GS-F-20", "Adviser Appointments: Applied, Noted by the Academic Coordinator, Under deliberation"),
    "20": ("After the designation is decided", "Research Coordinator", "Associate Dean", "Dean", "Student and Research Adviser; GS-F-22 and GS-F-23 within 5 days", "Adviser Appointments: Appointed, Accepted"),
    "21": ("Once only, before the proposal defense", "Student", "Current and new Research Adviser", "Research Coordinator, Associate Dean, Dean", "New GS-F-20", "Adviser Appointments: Change request"),
    "22": ("Within 5 days of GS-F-20", "Student and Research Adviser", "Research Adviser", "Research Coordinator receives", "Research file", "Adviser Appointments: contract received"),
    "23": ("Within 5 days of GS-F-20", "Student and Research Adviser", "Research Adviser", "Research Coordinator receives", "Research file", "Adviser Appointments: contract received"),
    "24": ("Once only, before the proposal defense application", "Student", "Research Adviser", "Panel members", "Research file", "—"),
    "25": ("Before the proposal defense (quantitative studies)", "Student", "Statistician", "Statistician", "GS-F-27", "Research gate: Form 4"),
    "26": ("When a co-author is pre-identified", "Student", "Research Adviser", "Panel Chair (noted)", "GS-F-39 and GS-F-40 at publication", "—"),
    "27": ("At least 2 weeks before the proposal or closed-door final defense", "Research Adviser", "Research Coordinator", "Panel members agree to the schedule", "Panel; GS-F-29 or GS-F-32 and GS-F-33", "Research gate: Form 4; Final Defense; defense scheduling"),
    "28": ("When a confirmed defense cannot proceed", "Student, Research Adviser, panel or Graduate School Office", "Research Adviser", "Research Coordinator", "Panel informed; GS-F-27 dates revised", "Defense scheduling: reschedule or cancel with reason"),
    "29": ("After the proposal defense, first working day", "Panel members", "Panel Chair consolidates", "Panel", "Revisions; GS-F-30", "Proposal defense verdict"),
    "30": ("After the revised proposal is approved by the panel", "Panel Chair", "Research Adviser", "Panel members", "GS-F-31", "Research gate: Form 5.1"),
    "31": ("Within 1 month after the proposal defense", "Student", "Research Adviser", "Research ethics committee", "Ethics Clearance; GS-F-27 (final)", "Ethics clearance status and date"),
    "32": ("After the closed-door and the public final defense, first working day", "Panel members", "Panel Chair consolidates", "Panel", "Revisions; GS-F-34 or GS-F-35", "Final defense verdict"),
    "33": ("After the closed-door final defense, first working day", "Panel members and Research Adviser", "Research Coordinator", "Panel", "Result and score recorded", "Final defense verdict with Form 7 score"),
    "34": ("After a provisional pass without re-defense", "Research Adviser", "Panel members", "Panel", "Turnitin and editing (GS-F-36)", "Verdict follow-up: revisions confirmed by the Panel Chair"),
    "35": ("2 to 4 weeks after the closed-door defense (admitted August 2020 onward)", "Research Adviser", "Panel members", "Research Coordinator", "Announcement and public defense", "—"),
    "36": ("After the Research Adviser endorses the final manuscript", "Student", "Turnitin administrator", "Turnitin administrator", "Editor (GS-F-37)", "Completion Evidence: Turnitin certificate"),
    "37": ("After the similarity check is passed", "Student", "Editor", "Editor", "Graduate School Office (GS-F-38)", "Completion Evidence: Form 9"),
    "38": ("After the manuscript is ready for hard-bound reproduction", "Graduate School Office", "Panel and Research Adviser", "Dean accepts", "Bound copies and CD; graduation", "Completion Evidence: Form 10"),
    "39": ("When a co-author was pre-identified", "Student", "Research Adviser", "Co-author accepts", "GS-F-40", "—"),
    "40": ("Before submitting to a journal", "Student", "GS Research Committee", "Dean", "Student submits to the journal", "—"),
    "41": ("When the article is accepted or published", "Student", "Research Coordinator", "Research Coordinator", "Graduation application", "—"),
    "42": ("In the review window of the graduating term", "Student", "Academic Coordinator; Research Coordinator", "Dean", "GS-F-43", "Graduation: signed application, For Review"),
    "43": ("After candidates are checked", "Graduate School Staff", "Academic Coordinator; Research Coordinator", "Dean", "Registrar with GS-F-44", "Graduation: Dean Approved, exported list"),
    "44": ("Whenever a record is sent to the Registrar", "Dean, Associate Dean or representative", "Graduate School Staff", "University Registrar acknowledges", "Registrar; GS log", "Registrar status and handoff log"),
    "45": ("At first sign-in to the platform, or when a signed copy is wanted", "Person", "Graduate School Staff", "Graduate School Staff (filed)", "GS file; consent recorded once per account", "Privacy notice and consent at first sign-in"),
    "46": ("When a person needs, changes or no longer needs an account", "Requester", "Head of office or college", "Dean", "Graduate School Staff or administrator sets up the account", "Account set-up by the Graduate School"),
    "47": ("Each term, and whenever the hours change", "Faculty member", "Academic Coordinator", "Academic Coordinator (received)", "GS-F-48; defense scheduling", "Faculty record: preferences, weekly hours, availability"),
    "48": ("After the offering plan (GS-F-04) and the faculty answers, before enrollment", "Academic Coordinator", "Academic Coordinator", "Dean", "Published with GS-F-04; faculty acknowledge", "Course offering: professor assignment"),
    "49": ("Before the school-sponsored activity", "Student", "Academic Coordinator", "Dean", "Professors; attendance record", "—"),
    "50": ("Within one academic year of the INC", "Student", "Professor of the subject", "Professor (final grade)", "Graduate School Office; Registrar", "—"),
    "51": ("Before the course is taken at another institution", "Student", "Academic Coordinator", "Dean", "Registrar issues the cross-enrollment permit", "—"),
    "52": ("Before enrollment, when a class is undersized or special", "Academic Coordinator", "Dean (through)", "Vice Chancellor for Academic Affairs", "Course offering; Business Office (fee)", "—"),
    "53": ("When a master's student asks to change option", "Student", "Academic Coordinator; Associate Dean", "Dean", "Registrar; program change", "—"),
    "54": ("After the final defense, when a work is nominated", "Research Adviser or Panel Chair", "Committee", "Dean", "Award list", "—"),
}


CONTROL_DOCS = [
    dict(code="GS-P-01", title="Graduate School Forms Approval Sheet", process="Control of forms", chapter=None, also=None,
         folder=CONTROL_FOLDER, sections=[], sign=[]),
    dict(code="GS-P-02", title="Forms Routing Guide", process="Control of forms", chapter=None, also=None,
         folder=CONTROL_FOLDER, sections=[], sign=[]),
]
POLICIES = []


def policy(code, title, chapter, process, instructions, sections, sign, ref=""):
    """A policy document (GS-P-03 to GS-P-06). sections: [(heading, [("p", text) | ("t", columns, rows)])]."""
    POLICIES.append(dict(code=f"GS-P-{code}", title=title, process=process, chapter=chapter, also=None, ref=ref, subtitle=None,
                         instructions=instructions, sections=sections, sign=sign, folder=PLATFORM_FOLDER))


def all_documents():
    return CONTROL_DOCS + POLICIES + FORMS


def manual_column(doc):
    if not doc.get("chapter"):
        return "App. A"
    return doc["chapter"] + (f", {doc['also']}" if doc.get("also") else "")


def group_label(folder):
    m = re.match(r"4\.(\d\d) (.*)", folder)
    if m:
        return f"Operations Manual 4.{int(m.group(1))}  -  {m.group(2)}"
    return {CONTROL_FOLDER: "Forms control", PLATFORM_FOLDER: "Platform Basis (Operations Manual 4.20 to 4.24)",
            SUPPLEMENTARY_FOLDER: "Supplementary Forms (named in the Handbook, added to their host chapters)"}[folder]


def grouped_documents():
    """[(folder, [docs])] in manual order: forms control, chapters 4.1 to 4.19, Platform Basis, Supplementary Forms."""
    order = [CONTROL_FOLDER, *CHAPTER_FOLDERS.values(), PLATFORM_FOLDER, SUPPLEMENTARY_FOLDER]
    docs = all_documents()
    return [(folder, sorted([d for d in docs if d["folder"] == folder], key=lambda d: d["code"])) for folder in order]


def build_approval_sheet():
    doc = new_document()
    code, title = "GS-P-01", "Graduate School Forms Approval Sheet"
    doc.core_properties.title = f"{code} {title}"
    doc.core_properties.author = "Capstone group CAP-IT1"
    doc.core_properties.comments = ""
    footer(doc, code, title, PORTRAIT_W)
    institution_header(doc, PORTRAIT_W)
    title_block(doc, title, "Approval of the official forms and policy documents of the Graduate School", PORTRAIT_W)
    control_box(doc, code, "Control of forms", "", PORTRAIT_W)
    instruction_box(doc, [
        "The documents listed below are the official forms and policy documents of the Graduate School for the lifecycle of a graduate student. They are grouped by the chapter of the Graduate School Operations Manual they belong to (Manual column); Appendix A of the Operations Manual lists the same documents. Platform Basis and Supplementary Forms come last.",
        "Forms for the research process keep the form number of the Research Protocol AY 2024-2025, shown in the title line of each form. Every document carries its own control fields: code, revision number and effectivity date.",
        "For each document, mark Approved, or write the change required in Remarks. The signatures below approve the documents at the revision shown (Revision 00) and fix the effectivity date.",
    ], PORTRAIT_W)
    rows, group_rows = [], []
    for folder, docs in grouped_documents():
        group_rows.append(len(rows))
        rows.append([group_label(folder), "", "", "", ""])
        rows.extend([d["code"], d["title"], manual_column(d), BOX, ""] for d in docs)
    section_bar(doc, "A.  Documents reviewed", PORTRAIT_W)
    t = grid_table(doc, [("Code", 1.8), ("Document", 7.4), ("Manual", 1.7), ("Approved", 2.0), ("Remarks", 4.1)], rows, PORTRAIT_W, row_h=0.74, size=NOTE)
    for i in group_rows:
        row = t.rows[i + 1]
        c = row.cells[0].merge(row.cells[-1])
        shade(c, SECTION_FILL)
        for r in c.paragraphs[0].runs:
            r.bold = True
        for p in c.paragraphs:
            p.paragraph_format.keep_with_next = True
    section_bar(doc, "B.  Effectivity", PORTRAIT_W)
    field_grid(doc, ["Revision of all documents", ("full", "Effectivity date of the approved documents"), ("full", "Remarks of the approving officers")], PORTRAIT_W)
    section_bar(doc, "C.  Review and approval", PORTRAIT_W)
    sign_block(doc, [
        ("Submitted by", "Capstone group member (print name)"), ("Submitted by", "Capstone group member (print name)"),
        ("Submitted by", "Capstone group member (print name)"), ("Noted by", "Adviser of the capstone group"),
        ("Reviewed by", "Research Coordinator"), ("Reviewed by", "Associate Dean"),
        ("Reviewed by", "Academic Coordinator, Arts and Sciences"), ("Reviewed by", "Academic Coordinator, Business"),
        ("Reviewed by", "Academic Coordinator, Education"), ("Reviewed by", "Academic Coordinator, Engineering and Technology"),
        ("Reviewed by", "Academic Coordinator, Nursing"), ("Reviewed by", "Graduate Program Secretary"),
        ("Approved by", "Graduate School Dean"),
    ], PORTRAIT_W)
    gs_box(doc, [], PORTRAIT_W)
    return save(doc, CONTROL_DOCS[0], OUT)


def build_routing_guide():
    width = LANDSCAPE_W
    doc = new_document(landscape=True)
    code, title = "GS-P-02", "Forms Routing Guide"
    doc.core_properties.title = f"{code} {title}"
    doc.core_properties.author = "Capstone group CAP-IT1"
    doc.core_properties.comments = ""
    footer(doc, code, title, width)
    institution_header(doc, width)
    title_block(doc, title, "Who files, who reviews, who decides and where each form goes next", width)
    control_box(doc, code, "Control of forms", "", width)
    paragraph(doc, "Read across a row to follow a form. The Manual column gives the chapter of the Graduate School Operations Manual that holds the rule. The last column names the step of the Graduate Student Lifecycle Monitoring system that records the same event, so the paper form and the system always show the same facts; a dash means the event is kept on paper only. Where the Handbook or the Research Protocol states a rule, it is cited on the form itself.",
              size=NOTE, align=WD_ALIGN_PARAGRAPH.LEFT)
    rows = []
    for f in FORMS:
        key = f["code"].split("-")[-1]
        when, sub, rev, appr, nxt, plat = ROUTES[key]
        rows.append([f["code"], manual_column(f), f["title"], when, sub, rev, appr, nxt, plat])
    cols = [("Form", 1.8), ("Manual", 1.4), ("Title", 3.3), ("When used", 3.9), ("Submitted by", 2.4), ("Reviewed by", 2.5), ("Approved / decided by", 2.7), ("Goes next to", 3.2), ("Recorded in the system as", 3.5)]
    NO_BREAK_CODES[0] = True
    try:
        t = grid_table(doc, cols, rows, width, row_h=0.9, size=9)
    finally:
        NO_BREAK_CODES[0] = False
    for r in t.rows[1:]:
        no_split(r)
    return save(doc, CONTROL_DOCS[1], OUT)


def build_policy(spec):
    width = PORTRAIT_W
    doc = new_document()
    code, title = spec["code"], spec["title"]
    doc.core_properties.title = f"{code} {title}"
    doc.core_properties.author = "Capstone group CAP-IT1"
    doc.core_properties.comments = ""
    doc.core_properties.subject = spec["process"]
    footer(doc, code, title, width)
    institution_header(doc, width)
    title_block(doc, title, subtitle_text(spec), width)
    control_box(doc, code, spec["process"], "", width)
    instruction_box(doc, spec["instructions"], width)
    for n, (head, blocks) in enumerate(spec["sections"], 1):
        section_bar(doc, f"{n}.  {head}", width)
        m = 0
        for b in blocks:
            if b[0] == "p":
                m += 1
                paragraph(doc, f"{n}.{m}  {b[1]}", keep_next=False)
            else:
                t = grid_table(doc, b[1], b[2], width, row_h=0.5, size=NOTE)
                for r in t.rows[1:]:
                    no_split(r)
                    for c in r.cells:
                        for par in c.paragraphs:   # long policy tables may break between rows
                            par.paragraph_format.keep_with_next = False
    section_bar(doc, "Review and approval", width)
    sign_block(doc, spec["sign"], width)
    return save(doc, spec, OUT)


# =========================================================================== policy documents
SIGN_STD = lambda reviewer: [("Prepared by", "Capstone group CAP-IT1 (platform project)"), ("Reviewed by", reviewer), ("Approved by", "Graduate School Dean")]

policy("03", "Electronic Approval and Signature Policy", "4.22", "Electronic approval and signatures",
    instructions=[
        "This policy proposes when an approval recorded in the Graduate School platform counts as the signature of the same officer on the matching GS-F form. It takes effect when the Dean signs below.",
        "Until it takes effect, forms are signed on paper or, for the Research Protocol forms, with the e-signature sent by email as the Protocol already requires.",
        "The laws are cited so that the Dean and the University's legal counsel can check them. This document is not legal advice.",
    ],
    sections=[
        ("Purpose and scope", [
            ("p", "Purpose: to let one act (the approval in the platform) stand for the officer's signature on the paper form, so that the platform and the paper file never disagree and nobody signs twice."),
            ("p", "Covered: the endorsements, recommendations, approvals and decisions that the platform records for the holders of the roles Graduate School Staff, Academic Coordinator, Research Coordinator, Dean and Faculty Member (GS-P-05)."),
            ("p", "Not covered: signatures of people without a platform role - the Associate Dean, the Graduate Program Secretary, the Business Office, the University Registrar, the Vice Chancellor for Academic Affairs, host organizations (GS-F-11), editors and the Turnitin administrator. Their signatures stay on paper or by email until each accepts this policy in writing."),
            ("p", "Not covered: a signature that is a legal undertaking by a student, such as the Practicum Agreement (GS-F-11) and the consent on GS-F-45. A request a student files while signed in to the student portal is the student's application for that request; it does not replace the student's signature on a legal undertaking."),
        ]),
        ("Legal basis", [
            ("p", "Republic Act No. 8792, the Electronic Commerce Act of 2000: section 7 gives electronic documents the legal recognition of written ones; section 8 makes an electronic signature equivalent to a handwritten signature when a procedure that the parties cannot alter identifies the signer, is reliable for the purpose, is needed for the signer to go on with the transaction, and can be verified by the other party; section 9 sets a presumption for electronic signatures; section 12 deals with the admissibility and weight of an electronic data message or document. The reading of section 8 is a paraphrase."),
            ("p", "The Graduate School already works this way by email. The Research Protocol AY 2024-2025 and the Handbook (pp. 61, 63, 72-73) require Form 4 and Form 4.3 to be accomplished with e-signature and move Forms 3 and 3.1 by email between the Academic Coordinator, the Research Coordinator and the Dean (Operations Manual rules PRP-02, FIN-12, ADV-09). This policy applies the same idea to the platform."),
        ]),
        ("The rule", [
            ("p", "An approval, endorsement, recommendation or decision recorded in the platform by the signed-in holder of the role named on a GS-F form counts as that officer's signature on that form, at the date and time recorded."),
            ("p", "The record is the transaction-log entry of the platform. It shows who acted (account holder and role), what was done and the result, when, the status before and after, the next owner and the source reference. The log entry, not a screenshot or a printout, is the evidence."),
            ("p", "Only the holder of the account may act. An account is never shared and nobody approves in another person's name. A delegate (an authorized representative, where a form allows one) approves from the delegate's own account, with a written designation filed with the Dean."),
            ("p", "The shared demonstration accounts used to present the platform carry no authority. An approval made with them is a demonstration, not a signature."),
            ("p", "A paper copy is allowed: the Graduate School may print the form with the log entry attached. A correction is a new, later step with its reason; the earlier entry stays."),
            ("t", [("Role", 3.0), ("Approvals the platform records for the role (checked in the role gates of the platform)", 9.2), ("Forms", 4.8)], [
                ["Dean", "Acceptance of the onboarding report; approval of the term course offering plan; decisions on leave, readmission, withdrawal and absence-without-leave cases; approval of adviser appointments; approval of graduation endorsements and the endorsed list", "GS-F-01, 04, 05, 07, 08, 09, 20, 42, 43, 48"],
                ["Academic Coordinator", "Review of study plans and subject status; course adjustment plan; Form 1 endorsement; noting of adviser applications; coursework check for graduation; practicum verification", "GS-F-02, 03, 13, 16, 19, 42"],
                ["Research Coordinator", "Adviser appointment record; panel invitations; defense scheduling decisions; validation of research documents for graduation", "GS-F-17, 19, 20, 21, 27, 28, 43"],
                ["Graduate School Staff", "Preparation and recording (batches, imports, registrar exports); the steps of a case that the staff own. Staff record; they do not approve in place of the Dean", "GS-F-01, 43, 44"],
                ["Faculty Member", "Reply to a panel invitation; acceptance of an adviser appointment; defense verdicts for the member's own panels", "GS-F-17, 18, 20, 29, 32, 33"],
            ]),
        ]),
        ("How the platform meets the legal test", [
            ("t", [("Requirement of RA 8792 section 8 (paraphrased)", 5.0), ("What the platform does (verified in the code)", 8.0), ("Gap or limit", 4.0)], [
                ["The signer is identified", "One account per person; the sign-in name is the institutional email; the role is stored on the account and a role sent by the browser is ignored", "Accounts are created outside the platform for most roles (GS-P-05)"],
                ["The method is reliable", "Passwords are stored as hashes; a generated password must be replaced at first sign-in (at least 10 characters); repeated wrong passwords are slowed (a wait that doubles up to 30 seconds); signing out ends the session; the session cookie is HttpOnly and SameSite Lax, and Secure when the site runs over HTTPS", "No second factor; the wait counter is kept in memory and resets on restart"],
                ["The signature is needed to go on", "A case moves forward only when the role named for the step records it; other roles are refused with a message", "-"],
                ["It cannot be altered and the other party can verify it", "Each step appends a log entry with the actor, role, time and the statuses; no screen or route edits or deletes an entry", "Entries are removed with the student record if that record is ever deleted; the platform's own clock is the only time source; no certificate or hash chain"],
            ]),
        ]),
        ("Limits and fallbacks", [
            ("p", "Where this policy does not apply, or while the platform is unavailable, the form is signed on paper or by email as today and keyed in afterwards, with the note \"signed on paper on [date]\"."),
            ("p", "A person who disputes an approval asks the Dean to review the log entry. The Dean's decision is recorded as a new entry."),
            ("p", "Retention of the log and the forms follows the retention schedule in GS-P-04, section 8."),
        ]),
    ],
    sign=SIGN_STD("Research Coordinator and University legal counsel"))

policy("04", "Data Privacy Notice and Records Retention Schedule", "4.23", "Data privacy and records retention",
    instructions=[
        "This notice tells every account holder of the Graduate School platform what personal data is kept, why, who sees it, what leaves the platform for an outside service, how long it is kept, and how to use the rights the law gives. A short form of it is shown once at first sign-in; GS-F-45 is its paper twin.",
        "Section 5 states what each call to an outside service sends.",
        "At the time of writing the platform is a capstone prototype that holds demonstration data only. This notice is drafted for the day it holds real student records.",
    ],
    sections=[
        ("Purpose, scope and status", [
            ("p", "Purpose: to give effect to the Data Privacy Act of 2012 (Republic Act No. 10173) for the personal data processed by the Graduate School of the University of St. La Salle in its Graduate Student Lifecycle Monitoring platform."),
            ("p", "Scope: students, faculty members, and staff, coordinators, the Dean and the administrator who hold platform accounts, and the people named in the records the platform keeps."),
            ("p", "The notice takes effect when the Dean signs below. Official student, enrollment and grade data remain with the University Registrar's system (AIMS); the platform holds a monitoring copy and never overwrites an official value."),
        ]),
        ("Legal basis and who is responsible", [
            ("p", "RA 10173 and its Implementing Rules and Regulations. The regulator is the National Privacy Commission (NPC), which the Act creates (section 7). The Act's general principles are transparency, legitimate purpose and proportionality (section 11); personal information may be processed on consent and on the other grounds of section 12; the rights of the data subject are in section 16; security is in section 20."),
            ("p", "The University is the personal information controller. The University's Data Protection Officer (DPO) is the contact for this notice. DPO name and contact: ______________________."),
            ("p", "Health information (for example a medical certificate attached to a leave request) is sensitive personal information under the Act and is handled with stricter care: it is attached to the request only when the person chooses to upload it, and it is seen only by the roles that decide the request."),
        ]),
        ("What the platform keeps, why, and who sees it", [
            ("t", [("Data", 4.0), ("Examples", 4.4), ("Purpose", 4.2), ("Seen by (see GS-P-05)", 4.4)], [
                ["Identity and program", "Name, student number, institutional email, program, year of entry", "Know who is enrolled and in which program", "Staff, coordinators, Dean; the student sees the own record"],
                ["Academic progress", "Subjects completed, comprehensive examination, research milestones, standing", "Monitor progress, advise, check graduation", "Staff, coordinators, Dean; the student sees the own record"],
                ["Case records", "Leave, readmission, withdrawal, absence without leave, residency, practicum, graduation endorsement, with reasons and attached files", "Run and decide the requests", "The roles named for each step; the student sees the own cases"],
                ["Research records", "Title, adviser, panel, defense schedule, verdicts, uploaded papers and evidence", "Run the research steps", "Research Coordinator, staff, Academic Coordinator, Dean; faculty see only the own panels"],
                ["Faculty records", "Name, college, specialization, email, course preferences, weekly hours, availability, connected calendar", "Match panels, propose teaching load, schedule defenses", "Staff and coordinators; the faculty member sees the own record"],
                ["Account and log", "Sign-in email, name, role, password hash (never the password), consent time and notice version, transaction log of every recorded step", "Sign-in, accountability, proof of approval (GS-P-03)", "Staff and the Dean read the log; the administrator maintains the system"],
            ]),
        ]),
        ("Sources of the data", [
            ("p", "The Registrar's export or the Academic Coordinator's monitoring workbook (identity, enrollment, subjects), the person's own entries and uploads, the staff's records of each step, and, for faculty members who connect it, Google Calendar (section 5)."),
        ]),
        ("What leaves the platform for an outside service", [
            ("p", "Policy Assistant (Google Gemini, endpoint generativelanguage.googleapis.com). This runs only when a Google API key is set in the server's environment. Without the key the assistant uses keyword search on the server and nothing is sent. When the key is on, the calls below are made."),
            ("t", [("Call", 4.2), ("What is sent to Google", 7.4), ("What is not sent", 5.4)], [
                ["Index of the policy library", "The text of each library passage, with its title and source (Handbook, Research Protocol, the other built-in documents, and PDFs that staff upload), once to be turned into search vectors, and again when a document changes", "Any student, faculty or account data"],
                ["Each question typed in the assistant", "The question text, to be turned into a search vector", "The name or role of the person asking"],
                ["Answer to a policy question", "The question and the four or more best-matching policy passages, with an instruction to answer only from them", "Any student record"],
                ["Personal question by a student (for example \"What is my next step?\")", "The question and a short text built from the student's own record: stage, program, standing, progress status, percentage of subjects completed, missing subjects, open tasks, missing documents, the next defense", "The student's name and student number (they are left out). Open task titles are sent as written and may contain other names"],
                ["Personal question by staff, coordinator, Dean or faculty", "The question and the list of up to eight items waiting on the person: task titles with the student's name and the due date; for faculty, the panel invitations with the student's name", "Passwords, contact numbers, uploaded files"],
                ["Unclear question", "The question text, to decide which kind of question it is", "-"],
                ["Panel matching (staff and coordinators)", "An excerpt of up to 5,000 characters of the text of the student's uploaded research paper, with the name, specialization and matched terms of the faculty considered; the paper text (first 9,000 characters) and each faculty profile text, for similarity vectors", "The student's name, student number and the file name"],
            ]),
            ("p", "Google Calendar (only for a faculty member who connects a calendar from the faculty portal). The platform asks for permission to read free and busy times and to create and change the events it owns. It stores the access and refresh tokens encrypted. When a defense is scheduled it writes an event whose title is the defense type and the student's name, with the time and the venue. The faculty member can disconnect, which asks Google to revoke the access."),
            ("p", "Nothing else sends personal data out of the platform. The platform sends no email: staff send the exports to the Registrar by the University's own email. What each outside service does with the data is governed by its own terms."),
        ]),
        ("Your rights", [
            ("p", "Under section 16 of the Act the person has the right to be informed, to object, to access, to correct, to have the data suspended, withdrawn, blocked, removed or destroyed, to data portability, and to claim damages. Consent given at first sign-in may be withdrawn in writing; the Graduate School then keeps only what a rule of the University or the law requires."),
            ("p", "To use a right, write to the Graduate School Office or the DPO (contact: ______________________). The Graduate School answers in writing within fifteen working days. A complaint may be filed with the National Privacy Commission."),
        ]),
        ("Security measures", [
            ("p", "Passwords are stored as hashes. A generated password must be replaced at first sign-in. Every function behind the sign-in is limited to the roles named for it (GS-P-05). Repeated wrong passwords are slowed. The session cookie is HttpOnly and SameSite Lax, and Secure when the site is served over HTTPS (to be switched on when the platform is hosted). Uploaded files are kept in a folder on the server, not in the web page area. Google tokens are stored encrypted."),
            ("p", "A suspected breach is reported at once to the DPO. The IRR requires the NPC and the affected people to be notified within seventy-two (72) hours of knowledge of a breach that meets the stated conditions."),
        ]),
        ("Retention schedule", [
            ("t", [("Record", 6.2), ("Kept for", 5.4), ("Then", 5.4)], [
                ["Student case files: requests, forms, practicum, research records, log entries of the case", "5 years after graduation or after the last enrollment", "Delete or anonymize, with the Dean's approval"],
                ["Graduation endorsement lists (GS-F-43) and Registrar transmittals (GS-F-44)", "Permanently", "Kept in the Graduate School archive"],
                ["Uploaded papers and evidence (research, practicum, medical certificates)", "As the case file they belong to; medical certificates 1 year after the case closes", "Delete"],
                ["Faculty availability and preferences", "While the person teaches in the Graduate School, then 1 year", "Delete"],
                ["Google Calendar tokens", "Until the faculty member disconnects or leaves", "Delete at once"],
                ["Account record and consent record", "While the account is active, then 5 years (proof of consent and of approvals)", "Delete"],
                ["Policy Assistant questions", "Not stored by the platform; Google's own handling is outside the platform", "-"],
                ["Official enrollment and grade data", "Not owned by the Graduate School; the Registrar's schedule applies", "-"],
            ]),
        ]),
    ],
    sign=SIGN_STD("Data Protection Officer of the University"))

policy("05", "Platform Access and Roles Matrix", "4.21", "Platform accounts and roles",
    instructions=[
        "This document lists the roles that exist in the Graduate School platform, what each can see and do, and how an account is requested, approved, set up, reviewed and removed (request form GS-F-46). The roles are the ones in the platform's role list; the summary groups the functions of the platform by role.",
        "It is a summary, not a list of every function. Where the Handbook or the Research Protocol names an officer who has no role in the platform (the Associate Dean, the Graduate Program Secretary), that officer signs on paper.",
        "It takes effect when the Dean signs below.",
    ],
    sections=[
        ("Purpose and principles", [
            ("p", "Purpose: to make sure each person sees and does only what the person's work in the Graduate School needs, and that every approval can be traced to a named person (GS-P-03)."),
            ("p", "Least privilege: ask for the role that fits the work, not the widest one. One person holds one account and one role. Accounts are never shared. The Administrator role passes every role gate in the platform and acts as Graduate School Staff in workflow steps, so it is limited to the named person who maintains the system and is not used for approvals."),
        ]),
        ("Roles and what each can see and do", [
            ("t", [("Role", 2.8), ("Can see and do", 9.2), ("Cannot", 5.0)], [
                ["Graduate School Staff", "Imports the monitoring workbook and class lists; manages the policy library and the business rules; prepares and exports registrar lists; terms and records to fix; reports and the activity log; records the steps they own in each process; keeps faculty records", "Take the Dean's decisions; approve in place of the Dean"],
                ["Academic Coordinator", "Student monitoring and study plans; course offerings and course adjustment plan; subject status; Form 1 endorsement; graduation coursework check; practicum, comprehensive examination and absence-without-leave records; reports; faculty records", "Upload to the policy library; import the admission handoff; take the Dean's decisions"],
                ["Research Coordinator", "Research gates; panel matching and invitations; defense scheduling; adviser appointments; availability requests; validation of research documents for graduation; reports", "See enrollment and leave cases outside the research steps"],
                ["Dean", "Decisions and approvals: onboarding reports, term course offering plan, leave, readmission, withdrawal and absence cases, adviser appointments, graduation endorsement and the endorsed list; reports and decision support; policy questions", "Edit records; see the work of other roles beyond the cases that reach the Dean"],
                ["Faculty Member", "Own profile, course preferences, availability and calendar link; replies to panel invitations; adviser requests; defense schedules and verdicts of own panels; policy questions", "See student records beyond the own panels; see other faculty members' details"],
                ["Student", "Own record, requests and attachments, adviser, research evidence, defense calendar, messages; questions about the own record and policy", "See any other student; decide any request"],
                ["Administrator", "Every function (passes all role gates); acts as Graduate School Staff in workflow steps", "Not for approvals"],
            ]),
        ]),
        ("Account lifecycle", [
            ("p", "Request: the person fills GS-F-46; the head of the person's office endorses; the Dean approves. Nobody receives an account without the Dean's approval, except a student, whose account is created by the platform when the student is handed off from admission."),
            ("p", "Set-up as the platform works today: a student account is created at the admission handoff import; a faculty login is created by Graduate School Staff or an Academic Coordinator from the Faculty page with a temporary password; the other roles are set up by the administrator, because the platform has no screen to create them. The temporary or generated password is handed over privately and must be replaced at first sign-in (at least 10 characters, not the email name)."),
            ("p", "First sign-in: choose a new password, then read and accept the privacy notice (GS-P-04, GS-F-45). The acceptance is stored once per account with the notice version."),
            ("p", "Review: each term, the Academic Coordinators and the Graduate School Staff check the list of accounts against the people who still hold the role. A change of role uses GS-F-46."),
            ("p", "Removal: when a person leaves the Graduate School or the role, GS-F-46 asks for the account to be deactivated the same day. A deactivated account cannot sign in; its log entries stay."),
        ]),
        ("Rules for every account holder", [
            ("p", "Use your own account only; do not share the password; sign out on a shared computer. Tell the Graduate School at once if you think someone else used your account. The demonstration accounts are for presenting the platform and have no authority (GS-P-03)."),
            ("p", "The platform slows repeated wrong passwords, ends the session at sign-out, and refuses a function the role is not allowed (message: this account cannot access that area)."),
        ]),
    ],
    sign=SIGN_STD("Academic Coordinators of the five program areas and Graduate School Staff"))

policy("06", "AIMS and Registrar Data Exchange Specification", "4.24", "AIMS and Registrar data exchange",
    instructions=[
        "This specification states which files come into the Graduate School platform from the Registrar's system (AIMS), which files go out to the University Registrar, who sends them, and when.",
        "Data exchange is by file only. The platform does not connect to AIMS, stores no AIMS credentials and does not copy AIMS screens. Official student, enrollment and grade data stay with AIMS and are read-only in the platform; a correction is made in AIMS and arrives in a later file.",
        "It takes effect when the Dean signs below.",
    ],
    sections=[
        ("Purpose and principles", [
            ("p", "Purpose: to make the hand-over of student data between the Registrar and the Graduate School a known, repeatable routine and to say exactly what each file holds."),
            ("p", "Principles: AIMS is the source of record for identity, enrollment, subjects, grades and course completion. The platform checks and previews a file before it imports it, keeps the uploaded file and its result, and never overwrites an official value in place. A value typed in the platform is marked as manual entry with who, when and why."),
        ]),
        ("Files that come in", [
            ("t", [("File", 4.0), ("Columns the import reads", 7.6), ("Type, sent by, when", 5.4)], [
                ["Program monitoring sheet (AC Student Monitoring workbook) - the import that works today", "A1 = PROGRAM: code. Header row with IDNO and COURSE (and YR, COMPRE, NOTE); the row under it with AY ENTRY, SN, FN, the subject codes and the milestones TITLE, PROPOSAL, ETHICS, FINAL. One student per row; a subject cell with a unit value means completed. Required per row: student ID, first name, last name, school year of entry (a row missing one is reported, not imported)", "Excel .xlsx or .xlsm. The Registrar or the Academic Coordinator sends it; Graduate School Staff upload it through Student Handoff. When: at the start of each term and after grades are posted"],
                ["Class list", "Student ID, Subject code, Faculty (the column must exist), and optionally Academic year, Term, Enrollment status (enrolled or current, or dropped), Status effective date, Remarks, first and last name, program. A row for a different semester than the one chosen is refused; a subject the program does not offer is refused", "CSV or Excel. The Registrar sends it; Graduate School Staff or an Academic Coordinator preview and import it. When: each term after enrollment closes"],
            ]),
        ]),
        ("Files that go out to the University Registrar", [
            ("t", [("File", 4.6), ("Contents", 7.2), ("Made by, form", 5.2)], [
                ["Approved leave of absence and approved readmission lists", "Request, student ID, name, program, leave from and until, return semester, reason, Dean's decision date and remarks, endorsement for the Registrar, handoff status", "Graduate School Staff; CSV or Excel; sent with GS-F-44"],
                ["Approved subject withdrawals workbook", "Application ID, student ID and name, program, subject code, title and units, semester and its start, withdrawal deadline, request and Dean approval dates, reason, Registrar action, record effect, status, fee tier (information only)", "Graduate School Staff; Excel; sent with GS-F-44"],
                ["Graduation endorsed list", "Batch, student ID, name, program, coursework and research status, endorsement status, Dean's approval date and remarks, export status", "The Dean; CSV; sent with GS-F-44 and GS-F-43"],
                ["Absence-without-leave return and residency reports", "Student, ID, program, the dates and terms, the Dean's decision and the policy check.", "Graduate School Staff or Academic Coordinator; CSV"],
                ["Monitoring export", "The program's monitoring workbook with the portal's changes and their provenance, in the layout of the import so it can be uploaded again", "Staff, coordinators, Dean; Excel"],
            ]),
            ("p", "The platform does not send email. The sender emails each file to the Registrar through the University's channel, records the hand-over (sent, then acknowledged) in the platform, and files GS-F-44 with the Registrar's acknowledgement."),
        ]),
        ("Quality rules", [
            ("p", "A class list is previewed before it is imported; every row is marked ready, warning or error with its reason. The monitoring sheet import reports rows with missing required fields as issues. The uploaded monitoring sheet and the result of its import are kept with the upload record, so a later file can be compared with it. Importing a class list twice does not enrol a student twice (rows already enrolled are counted as already enrolled)."),
            ("p", "The files carry personal data. They are sent only to the Registrar's named address, kept in the Graduate School's own folders and retained as GS-P-04 section 8 states."),
        ]),
    ],
    sign=SIGN_STD("University Registrar (acknowledgement of the specification)"))

def main():
    docs = all_documents()
    assert len({d["code"] for d in docs}) == len(docs), "duplicate document codes"
    codes = [f["code"] for f in FORMS]
    assert codes == sorted(codes), "forms must be in numeric code order"
    for f in FORMS:
        assert f["code"].split("-")[-1] in ROUTES, f"no routing row for {f['code']}"
    only = set(sys.argv[1:])
    built = []
    for f in FORMS:
        if only and f["code"] not in only and f["code"].split("-")[-1] not in only:
            continue
        built.append(build_form(f, OUT))
    for p in POLICIES:
        if not only or "P" in only or p["code"] in only:
            built.append(build_policy(p))
    if not only or "P" in only or "GS-P-01" in only:
        built.append(build_approval_sheet())
    if not only or "P" in only or "GS-P-02" in only:
        built.append(build_routing_guide())
    print(f"built {len(built)} files in {OUT}")


if __name__ == "__main__":
    main()
