#!/usr/bin/env python3
"""Build the University of St. La Salle Graduate School forms and process documents.

One script, one engine: every form is a plain data spec (see FORMS below) rendered
by the same functions, so layout, fonts and control fields stay identical.

Run:  E:/Temp/claude/docs-venv/Scripts/python.exe scripts/docs/forms/build_forms.py
Output: Documents/USLS_Forms/GS-F-XX <Name>.docx, GS-P-01 ..., GS-P-02 ...
Needs python-docx only. Pass form numbers (for example 07 12) to rebuild only those; P rebuilds the two GS-P documents.
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
OUT = ROOT / "Documents" / "USLS_Forms"

FONT = "Arial"
BODY = 10.5      # body text, pt
NOTE = 9.0       # instruction box, control labels, footer
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


def add_text(par, text, size=BODY, bold=False, italic=False, color=None):
    """Add text; every ballot box is set in the symbol font so it renders everywhere."""
    parts = re.split(f"({BOX})", text)
    for part in parts:
        if not part:
            continue
        if part == BOX:
            r = par.add_run(part)
            style_run(r, size=size + 1, font=CHECK_FONT)
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
    cell_text(c, heading, size=NOTE, bold=True, after=2)
    for i, text in enumerate(items, 1):
        p = c.add_paragraph()
        fmt(p, after=1, line=0.93)
        p.paragraph_format.left_indent = Cm(0.5)
        p.paragraph_format.first_line_indent = Cm(-0.5)
        add_text(p, f"{i}.\u00A0\u00A0", size=NOTE)
        add_text(p, text, size=NOTE)
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
    doc.core_properties.author = "University of St. La Salle Graduate School"
    doc.core_properties.subject = spec["process"]
    footer(doc, code, title, width)
    institution_header(doc, width)
    ref = spec.get("ref", "")
    if spec.get("subtitle"):
        ref = re.sub(r"^Protocol Form [0-9.]+;\s*", "", ref)
    sub = " | ".join(x for x in (spec["process"], spec.get("subtitle"), ref) if x)
    title_block(doc, title, sub, width)
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
        chain = (nxt is None) or (nxt[0] != "note" and nxt[1] is None)
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
    outdir.mkdir(parents=True, exist_ok=True)
    path = outdir / f"{code} {safe_name(title)}.docx"
    doc.save(path)
    return path


def safe_name(title):
    return re.sub(r'[\\/:*?"<>|]', "-", title).strip()


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
    FORMS.append(dict(code=f"GS-F-{code}", title=title, process=process, ref=ref, subtitle=subtitle,
                      instructions=instructions or [], sections=sections, gs=gs or [],
                      who=who or ""))


# ---- 01 ------------------------------------------------------------------------------------
add("01", "Onboarding Report for the Dean", "Admission handoff and onboarding",
    instructions=[
        "Prepared by the Graduate School staff for each batch of newly admitted students received from the Registrar (AIMS export) or the Academic Coordinator's monitoring workbook. One report covers one batch.",
        "The Graduate School does not create student numbers or institutional emails; they are received from the University Registrar. Admission requirements are checked by the Admissions office (Handbook 2022-2023, pp. 42-47) and are not re-assessed here.",
        "Every item that is not complete is listed in Part C with the person who will follow it up. The Dean accepts the report only when no item is left open, or records which items remain open.",
    ],
    sections=[
        F("Batch information", ["Program", "Academic year / term of entry", "Source file / workbook name", "Date received",
                                  "Number of students in the batch", "Number of new students", "Prepared by (GS staff)", "Date prepared"]),
        C("Onboarding checklist", "Tick each item that has been checked for every student in the batch.",
          ["Admission handoff recorded (admission approval received)", "Student profile sheet received for each student",
           "Student profiles created from the import", "Program assignment confirmed with the Academic Coordinator",
           "Enrollment signal received (enrolled in the registration system)", "Official transcript of records received",
           "Validation issues in the import resolved", "Curriculum version tagged for each student"], cols=1),
        T("Items needing follow-up", [("Student no.", 2.4), ("Student name", 4.2), ("Missing / unresolved item", 4.6), ("Assigned to", 2.8), ("Date resolved", 2.4)], 5),
        C("Dean's decision", None, ["Onboarding report accepted; admission is complete for this batch", "Returned to the Graduate School for the items marked above"], cols=1),
        B(None, "Dean's remarks:", 1.6),
        S("Review and approval", [("Prepared by", "Graduate School staff"), ("Reviewed by", "Academic Coordinator of the program"),
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
          [["Subject dropped or changed", "", "", "", "", ""], ["Subject taken or added", "", "", "", "", ""],
           ["Subject taken or added", "", "", "", "", ""]], 0.9),
        C("Ground for a change of subject", None, ["The original subject is dissolved", "Schedule conflict", "Failed the prerequisite subject"], cols=1),
        B(None, "Explanation of the student (attach proof where available):", 1.6),
        S("Recommendation and approval", [("Student", None), ("Academic Coordinator", "Recommended  /  Not recommended"),
                                          ("Associate Dean", "Approved  /  Not approved (required for an added subject)")]),
        T("Advice Slip (issued by the Graduate School Office)",
          [("Subject code and title", 7.0), ("Units", 1.4), ("Section", 2.2), ("Enrollment form un-tagged at the Business Office (initials / date)", 6.4)], 2, 0.8),
        F(None, ["Issued by (GS Office)", "Date issued"]),
    ],
    gs=["Recorded in platform on"])

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
        T("Subjects", [("Subject code", 2.0), ("Subject title", 4.6), ("Units", 1.1), ("Students needing it", 1.9), ("Secs.", 1.3), ("Professor assigned", 3.2), ("Schedule", 2.7)], 6, 0.8),
        C("Decision on each subject", "Mark here any subject that will not be offered and name the students who would be delayed:",
          ["All subjects listed above are offered", "Some subjects are not offered (state below)"], cols=1),
        B(None, "Subjects not offered, the reason, and students who would be delayed:", 1.4),
        B(None, "Special / undersized classes requested (subject, number of enrollees, reason):", 1.2),
        S("Approval", [("Prepared by", "Academic Coordinator"), ("Approved by", "Graduate School Dean")]),
    ],
    gs=["Published on"])

# ---- 05 ------------------------------------------------------------------------------------
add("05", "Application for Withdrawal of Subject", "Withdrawal of subject",
    ref="Handbook pp. 49-51, 53",
    instructions=[
        "A student may withdraw subjects until the second week from the start of classes, whether or not classes have been attended. Charges: ten percent (10%) of the total amount due for the term in the first week of classes and twenty percent (20%) in the second week (Handbook pp. 49, 51).",
        "After the second week a student keeps the right to withdraw all subjects but pays the full enrollment fees for the semester; if the reason is justifiable, fees are charged only up to and including the last month of attendance (Handbook pp. 49, 51). A student who will not return should file a leave of absence (GS-F-07).",
        "This form is the written request to the Dean and, once approved, the Withdrawal Form. Fees are assessed only by the Business Office; the Graduate School does not compute them. Copies: Registrar, Accounting Office and the student (Handbook p. 49).",
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
    ref="Handbook pp. 52, 54",
    instructions=[
        "Attendance is counted from the first regular class meeting. The maximum number of absences allowed is 20% of the total class hours of the semester. When unexcused absence is more than 20% of the stipulated hours in one course, the student is automatically dropped from the course by the professor and given the grade DRP with a 5.0 (Handbook p. 52).",
        "Excused absences are a death in the family, illness (with a medical certificate from the USLS clinic or a personal doctor) and a graduate program activity endorsed by the Dean. An Approved Absence is not counted (Handbook p. 52).",
        "A drop at any other time is arranged between the student and the Academic Coordinator. A student who wishes to leave a subject within the first two weeks files GS-F-05. The Graduate School does not enter or change grades; it records the drop in AIMS and in its own record.",
    ],
    sections=[
        F("Student and subject", STU_SHORT + ["Subject code", "Subject title", "Professor", "Academic year / semester", "Section / schedule"]),
        F("Attendance computation", ["Total scheduled class hours", "Hours absent", "Hours excused or approved", "Unexcused absence (hours)", "Unexcused absence (% of total hours)", "Attendance record attached"]),
        C("Basis of the drop", None, ["Unexcused absence is more than 20% of the total class hours (Handbook p. 52)",
                                       "Other documented ground agreed with the Academic Coordinator (state below)"], cols=1),
        B(None, "Other ground, with supporting documents:", 1.3),
        P(None, "The student was informed of this drop on the date shown below and has the right to explain any excused absence in writing to the Dean."),
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
    gs=["Leave starts / ends", "Copy sent to Registrar on", "Platform status"])

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
        C("Requirements of readmission", "Verified by the Graduate School:", [
            "Clearance from the Business Office", "Interview done (reason for delay, residency requirements)",
            "Evaluation of subject and grade requirements; no failed subject", "Updated study plan confirmed",
            "Consultation with the program or research adviser done", "No pending accountability", "Advice Slip issued by the Dean"], cols=1),
        F("Residence standing (Academic Coordinator)", ["Years in the program", "Normal limit (5 master's / 7 doctorate)", "Maximum limit (7 / 9, including leave)", "Refresher of 6 units required?"]),
        C(None, "Classification:", ["Within the normal limit", "Extension: graded six-unit refresher required", "Beyond the maximum: full re-enrollment required"], cols=1),
        S("Signatures and endorsement", [("Student", "Applicant"), ("Academic Coordinator", "Evaluated; study plan confirmed"), ("Business Office", "Clearance issued"),
                                         ("Graduate School Dean", "Endorsed  /  Not endorsed  to the University Registrar"), ("University Registrar", "Received; readmission processed")]),
    ],
    gs=["Endorsed to Registrar on", "Registrar confirmation on"])

# ---- 09 ------------------------------------------------------------------------------------
add("09", "Notice of Absence Without Leave (AWOL)", "Absence without leave",
    ref="Handbook p. 53",
    instructions=[
        "A student who withdraws from the College without a formal leave of absence is in absence-without-leave (AWOL) status and has registration privileges curtailed or entirely withdrawn (Handbook p. 53).",
        "The status is recorded from evidence, for example an imported AWOL standing or an enrollment marked withdrawn with no approved leave. It is never based on absence alone and is not typed in without the source being stated below.",
        "The student is told how to return (GS-F-08). The Registrar is informed through GS-F-44.",
    ],
    sections=[
        F("Student information", STU_SHORT + ["Stage before the AWOL (research or coursework)", "Last term enrolled", "Date AWOL takes effect", "Years in the program"]),
        C("Source of the evidence", None, ["Imported enrollment or standing record (AIMS export)", "Semester enrollment marked withdrawn with no approved leave and no resolved return",
                                           "Report of the Academic Coordinator or professor", "Other (state): ____________________"], cols=1),
        B(None, "Details (what was found, dates, attempts to contact the student):", 2.2),
        P("Notice to the student", "You are recorded as absent without leave from the date above. Your registration privileges are curtailed until you return. To return, file the Application for Readmission (GS-F-08) with the Graduate School Dean. Your years away count in your maximum residence."),
        F(None, ["Student notified on (date)", "Notified by (email / letter)", "Registrar informed on", "Informed by"]),
        S("Signatures", [("Prepared by", "Graduate School staff or Academic Coordinator"), ("Graduate School Dean", "Noted")]),
    ],
    gs=["Platform status"])

# ---- 10 ------------------------------------------------------------------------------------
add("10", "Application for Residency Enrollment", "Residency enrollment and maximum residence",
    ref="Handbook pp. 48, 54-55",
    instructions=[
        "Residency applies to a student who has finished all coursework and is only working on the thesis or dissertation, or the practicum or internship, after a semester of enrollment for it. It also applies to a student who is not enrolled in any subject but will complete an INC, will take the comprehensive examination, or is waiting for the research publication. Registration for residence must be done within the semester (Handbook p. 48).",
        "A student who does not intend to enroll for a valid reason but still has remaining units may not enroll in residency and must file a leave of absence (GS-F-07).",
        "Maximum residence: master's, candidacy within three years and all requirements within five years, with a possible two-year extension that requires a graded six-unit refresher, up to seven years including leave; doctorate, five and seven years, up to nine years including leave (Handbook pp. 54-55). The residency fee is assessed by the Business Office.",
    ],
    sections=[
        F("Student information", STU + ["Date admitted to the program", "Years in the program"]),
        F("Residency requested", ["Academic year / semester", "Date of this application", "Units completed", "Units remaining"]),
        C("Purpose of the residency", None, ["Thesis or dissertation writing (after a semester of enrollment for it)", "Practicum or internship (after a semester of enrollment for it)",
                                              "Comprehensive examination", "Completion of an incomplete grade (INC)", "Waiting for the research publication"], cols=1),
        B(None, "Supporting details (thesis or practicum enrollment semester, subject with INC, exam date, journal and status):", 1.8),
        P(None, "I confirm that I have no remaining subjects that I intend to enroll in this semester and that I will settle the residency fee with the Business Office."),
        S("Signatures and approval", [("Student", "Applicant"), ("Academic Coordinator", "Purpose and eligibility verified"), ("Graduate School Dean or authorized representative", "Approved  /  Not approved"),
                                      ("Business Office", "Residency fee assessed; receipt no. ________")]),
    ],
    gs=["Recorded in platform on"])

# ---- 11 ------------------------------------------------------------------------------------
add("11", "Practicum Agreement (Memorandum of Agreement)", "Practicum",
    ref="Handbook p. 48",
    instructions=[
        "Used for programs with a practicum or internship (Psychology programs and the Master of Science in Guidance and Counseling). Complete it before the practicum starts; the Graduate School keeps the signed original and gives a copy to the host organization.",
        "The Academic Coordinator reviews the agreement and marks the practicum as in progress once it is signed by all parties. The required number of practicum hours is stated by the Graduate School for the program.",
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
        P("Certification of the supervisor", "This is to certify that the student named above rendered the total number of hours stated in this log at the host organization, from the start date to the end date shown, and that the entries are true to the records of the organization."),
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
        "File with the Graduate Program Secretary at least two (2) weeks before the examination. Fee: P1,100 for master's and P2,500 for doctorate, paid at the Business Office; attach the official receipt (Handbook p. 57). The fee is forfeited if the examinee does not appear or send a written note.",
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
        B("Withdrawal of application (only if the student withdraws)", "Reason and date (at least three working days before the examination); signature of the student:", 1.4),
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
        F("Student information", STU_SHORT + ["Examination dates", "Attempt (first, retake 1, retake 2, third)"]),
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
    ref="Protocol Form 1; Handbook p. 59",
    instructions=[
        "Fill in this form and send it with the three (3) concept papers to your Academic Coordinator at least two (2) weeks before the proposed defense. The Academic Coordinator endorses the application to the Research Coordinator (gsresearch@usls.edu.ph) and recommends a set of panel members; the student does not need the Academic Coordinator's handwritten signature when the endorsement is sent by email with the e-signature.",
        "The Graduate School checks only that this form, the three concept papers and the endorsement are complete before a panel is nominated. The panel deliberates the three titles without the student and decides the title to be pursued (GS-F-18).",
        "Answer the four labelled items in Part D completely; they are read into the Graduate School record. Panel composition: project paper, a chair and two members; thesis, a chair and three members; dissertation, a chair and four members. The external panel member joins from the proposal defense onward.",
    ],
    sections=[
        F("Student information", RES_STU + ["Research adviser (if already designated)", "Comprehensive examination passed on"]),
        F("Defense details", ["Type of paper", "Preferred date of title defense", "Preferred mode (onsite / online)", "Date of this application"]),
        T("Concept papers submitted (three required)", [("No.", 0.9), ("Title of concept paper", 9.5), ("Key terms", 4.6), ("Pages", 1.4)], 3, 0.95),
        F("Details of the concept paper preferred by the student",
          [("tall", "Research Title:", 2), ("tall", "Objectives:", 3), ("full", "Research Keywords:"), ("tall", "Proposed Panel Specialization:", 2)], lw=3.4),
        T("Panel members recommended by the Academic Coordinator", [("Role", 3.4), ("Name", 6.2), ("Affiliation", 4.6), ("Expertise", 2.8)],
          [["Panel Chair", "", "", ""], ["Content Specialist", "", "", ""], ["Method Specialist", "", "", ""], ["Content Specialist (dissertation only)", "", "", ""]], 0.8),
        S("Signatures and routing", [("Prepared by", "Student"), ("Endorsed by", "Academic Coordinator (e-signature or endorsement email dated ________)"),
                                      ("Received by", "Research Coordinator")]),
    ],
    gs=["Panel nominated on", "Defense scheduled for"])

# ---- 17 ------------------------------------------------------------------------------------
add("17", "Panel Nomination and Invitation Reply Slip", "Panel nomination and scheduling",
    ref="Handbook pp. 60, 63; Protocol, Title Defense I.4",
    instructions=[
        "The Research Coordinator nominates the panel members as recommended by the Academic Coordinator (title defense) or by the research adviser (proposal and final defense), after deliberation with the GS Research Committee. The recommendation of an external panel member is subject to the approval of the GS Research Committee.",
        "Each nominated member answers the invitation below. A member who is not available on the date marks the slip as unavailable. A defense is confirmed only when the adviser and all required panel members are available.",
        "The Graduate School Office coordinates the schedule with the panel; the panel chair reserves the venue through the Graduate School Office or prepares the online meeting details.",
    ],
    sections=[
        F("Student and defense", RES4 + ["Type of paper", "Defense (title / proposal / final)", "Proposed date and time", "Mode and venue", "Research adviser", "Date of nomination"]),
        T("Panel nominated", [("Role", 3.2), ("Name of nominee", 4.8), ("Affiliation", 3.4), ("Reply (Accept / Decline / Unavailable)", 3.0), ("Signature and date", 2.6)],
          [["Panel Chair", "", "", "", ""], ["Content Specialist", "", "", "", ""], ["Method Specialist", "", "", "", ""],
           ["Content Specialist 2 (dissertation)", "", "", "", ""], ["External Panel (from proposal defense)", "", "", "", ""]], 0.95),
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
        "The panel deliberates the three submitted titles without the student, then decides the title to be pursued. The decision must be reflected on this form. Each panel member accomplishes the form; the panel chair emails the accomplished form to the Research Coordinator (gsresearch@usls.edu.ph) and to the student within the first working day after the defense.",
        "If all the proposed titles are disapproved, the student presents a new set of three (3) titles and follows the same protocol (new GS-F-16).",
        "The student settles the title defense fees by asking the panel members for their preferred mode of payment and emails the proof to the Graduate School Office within the first working day, with the subject line LAST NAME_type of defense_receipt.",
    ],
    sections=[
        F("Student and defense", RES4 + ["Type of paper", "Date of the defense", "Mode and venue", "Research adviser (if any)"]),
        T("Titles deliberated", [("No.", 0.9), ("Title of concept paper", 11.0), ("Decision", 3.2), ("Selected", 1.9)],
          [["1", "", "Approved / Disapproved", ""], ["2", "", "Approved / Disapproved", ""], ["3", "", "Approved / Disapproved", ""]], 0.95),
        C("Result of the title defense", None, ["Approved: the title selected above is to be pursued", "Disapproved: the student presents a new set of three titles"], cols=1),
        F(None, [("full", "Title to be pursued, as finally worded by the panel")]),
        B("Comments and suggestions of the panel", "", 2.6),
        S("Panel signatures", [("Panel Chair", None), ("Content Specialist", None), ("Method Specialist", None), ("Content Specialist (dissertation only)", None)]),
        F("Receipt of the student", ["Date received", "Student's signature"]),
    ],
    gs=["Recorded in platform on"])

# ---- 19 ------------------------------------------------------------------------------------
add("19", "Application for Designation of Research Adviser", "Research adviser designation", subtitle="Research Protocol Form 3",
    ref="Protocol Form 3; Handbook pp. 58-59, 61",
    instructions=[
        "The adviser must be affiliated with the University, in a degree program aligned with the student's. The Protocol requires a PhD degree for PhD students and at least PhD units for MA students (CHED CMO 15), and a maximum of five active advisees in the current academic year; with the Dean's approval an adviser may take more in the exigency of service (Handbook p. 58).",
        "The student may express a preference, but the Dean, the Associate Dean and the Research Coordinator make the final decision, considering degree, expertise, research work, number of advisees and workload (Handbook p. 59). Propose up to three faculty members.",
        "Email this form to your Academic Coordinator, who notes it by email or letter to the Research Coordinator. The Dean's signature is not required at this point. The Research Coordinator sends it to the Dean for deliberation.",
    ],
    sections=[
        F("Student information", RES_STU + ["Type of paper", "Comprehensive examination passed on", ("full", "Research interest or approved title (Form 2), if any")]),
        T("Faculty proposed as adviser (in order of preference)", [("Pref.", 1.1), ("Name of faculty member", 4.8), ("Highest degree", 2.4), ("University-affiliated", 2.2), ("Active advisees now", 2.2), ("Expertise aligned with the study", 4.3)], 3, 0.9),
        B(None, "Reason for the choice and how the expertise of the proposed adviser fits the study:", 1.5),
        S("Signatures and routing", [("Applicant", "Student"), ("Noted by", "Academic Coordinator"), ("Forwarded to the Dean by", "Research Coordinator")]),
        C("Deliberation (Research Coordinator, Associate Dean and Dean)", None, ["An adviser is designated (GS-F-20 issued)", "None of the nominees is approved; the student may nominate again"], cols=1),
    ],
    gs=["Form 3.1 issued on"])

# ---- 20 ------------------------------------------------------------------------------------
add("20", "Appointment of Research Adviser", "Research adviser designation", subtitle="Research Protocol Form 3.1",
    ref="Protocol Form 3.1; Handbook pp. 58-59, 61-62",
    instructions=[
        "Issued by the Research Coordinator after the Research Coordinator, the Associate Dean and the Dean have decided the designation. The Research Coordinator emails this form to the student and the appointed adviser, who email the accomplished form back (acceptance) to gsresearch@usls.edu.ph.",
        "The adviser is bound only to advising and may not be selected as the student's editor or to any other appointment related to the conduct of the study (Handbook p. 59).",
        "The student and the adviser must submit the Research Timetable (GS-F-22) and the Advising Contract (GS-F-23) to the Research Coordinator within five (5) days of receiving this form.",
    ],
    sections=[
        F("Student", RES4 + ["Type of paper", "Approved title (if any)"]),
        F("Appointed research adviser", ["Name of adviser", "Highest degree", "College / department", "Date of appointment", ("full", "Active advisees including this student (above five only with the Dean's approval in the exigency of service)")]),
        P("Appointment", "The Graduate School appoints the adviser named above as research adviser of the student named above, to perform the duties stated in the Handbook (p. 59) and the Research Protocol."),
        S("Appointment signed by", [("Research Coordinator", None), ("Associate Dean", None), ("Graduate School Dean", None)]),
        C("Acceptance of the adviser", None, ["I accept the appointment", "I decline the appointment; reason: ____________________"], cols=1),
        S("Acknowledgement", [("Research Adviser", "Accepted on ________"), ("Student", "Received on ________")]),
    ],
    gs=["Contract due on (5 days)"])

# ---- 21 ------------------------------------------------------------------------------------
add("21", "Request for Change of Research Adviser", "Change of research adviser", subtitle="Research Protocol Form 3.1.1",
    ref="Protocol Form 3.1.1; Handbook p. 62",
    instructions=[
        "A student may make only one (1) request to change the research adviser, for justifiable reasons, and it must be done before the proposal defense application (Handbook p. 62).",
        "The current adviser and the new adviser must both agree and sign this form. The student emails it to the Research Coordinator. The request is deliberated by the Research Coordinator, the Associate Dean and the Dean; if approved, the Research Coordinator prepares a new Appointment (GS-F-20) for the student and the new adviser.",
    ],
    sections=[
        F("Student", RES4 + ["Type of paper", "Approved title", "Date of this request"]),
        F("Advisers", ["Current adviser", "Date appointed", "Proposed new adviser", "Active advisees of the new adviser"]),
        C("Stage of the study", None, ["The student has not yet applied for the proposal defense", "This is the first request to change the adviser"], cols=1),
        B("Justifiable reason for the change", "State the reason clearly:", 2.6),
        S("Agreement", [("Student", "Requests the change"), ("Current Research Adviser", "Agrees to release the advisee"), ("Proposed New Adviser", "Agrees to advise")]),
        C("Deliberation (Research Coordinator, Associate Dean, Dean)", None, ["Approved; a new Form 3.1 is prepared", "Not approved"], cols=2),
        S("Decision", [("Research Coordinator", None), ("Associate Dean", None), ("Graduate School Dean", None)]),
    ],
    gs=["New Form 3.1 issued on"])

# ---- 22 ------------------------------------------------------------------------------------
add("22", "Research Timetable", "Research advising", subtitle="Research Protocol Form 3.2",
    ref="Protocol Form 3.2; Handbook pp. 58-59, 61-62",
    instructions=[
        "Accomplished by the student together with the research adviser after the adviser has accepted the appointment. The adviser monitors the research according to this timetable. Submit it with the Advising Contract (GS-F-23) to the Research Coordinator within five (5) days of receiving the Appointment (GS-F-20).",
        "Time limits: a thesis or project paper must be finished within two (2) years from the title or proposal defense, and the student has one (1) year from the title defense to submit and defend the proposal; a dissertation must be finished within three (3) years from the title defense (Handbook p. 58). Set target dates within these limits.",
    ],
    sections=[
        F("Student and adviser", RES4 + ["Type of paper", "Research adviser", "Date of Form 3.1"]),
        T("Timetable", [("Activity", 8.0), ("Target date", 3.0), ("Actual date", 3.0), ("Adviser's initials", 3.0)],
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
        "Accomplished and signed by the student and the research adviser, and emailed to the Research Coordinator within five (5) days of receipt of the Appointment (GS-F-20).",
        "The responsibilities of the adviser follow the Handbook, p. 59. A change of adviser follows GS-F-21 and may be requested only once, before the proposal defense.",
    ],
    sections=[
        F("Parties", RES4 + ["Type of paper", "Research adviser", "Approved title", "Date of Form 3.1"]),
        P("The adviser agrees to", "(1) monitor the research according to the timetable in Form 3.2; (2) review proposals, questionnaires and chapters and return comments within a reasonable time; (3) give technical and moral guidance; (4) conduct a mock defense when necessary; (5) attend the defense of the advisee and the orientations of the Graduate School; (6) endorse the manuscript for defense only when it complies with the research paper guidelines of the Graduate School; and (7) verify that the panel's recommendations are reflected in the final manuscript. The adviser is bound only to advising and is not the student's editor."),
        P("The student agrees to", "(1) follow the research timetable; (2) send manuscripts to the adviser by email and consult regularly; (3) give the panel the manuscript within the lead times of the Research Protocol, including the 14-Day Rule; (4) settle the defense fees with the panel members and send the proof to the Graduate School Office; (5) keep a copy of every approval; and (6) observe the University's rules on research integrity, ethics clearance and authorship."),
        F("Working arrangements", [("full", "Consultation schedule and mode (meetings, email, online)"), ("full", "How and when the adviser returns comments"), ("full", "Authorship arrangement (see Form 4.2 if there is a co-author)")]),
        S("Signatures", [("Research Adviser", None), ("Student", None), ("Received by", "Research Coordinator")]),
    ],
    gs=["Received on"])

# ---- 24 ------------------------------------------------------------------------------------
add("24", "Request for Change of Title of the Study", "Change of title", subtitle="Research Protocol Form 3.4",
    ref="Protocol Form 3.4; Handbook p. 62",
    instructions=[
        "A student may make only one (1) request to change the title of the study, before the proposal defense application (Handbook p. 62).",
        "Email this form and the new concept paper to the research adviser. The adviser endorses the request to the panel members for deliberation and sends a copy of the email to the Research Coordinator. The panel members decide among themselves; the panel chair emails the decision to the student, the adviser and the Research Coordinator.",
    ],
    sections=[
        F("Student", RES4 + ["Type of paper", "Research adviser", "Date of this request"]),
        F("Title", [("tall", "Present approved title", 2), ("tall", "Proposed new title", 2)]),
        C(None, None, ["The proposal defense has not yet been applied for", "This is the first request to change the title", "The new concept paper is attached"], cols=1),
        B("Reason for the change", "State the reason:", 2.0),
        S("Endorsement", [("Student", None), ("Research Adviser", "Endorses the request to the panel")]),
        T("Decision of the panel", [("Panel member", 4.6), ("Role", 3.4), ("Approve / Disapprove", 3.4), ("Signature and date", 5.6)], 4, 0.8),
        C(None, "Decision of the panel:", ["The change of title is approved", "The change of title is not approved"], cols=2),
        S("Reported by", [("Panel Chair", "Emailed the decision on ________")]),
    ],
    gs=["Title updated on"])

# ---- 25 ------------------------------------------------------------------------------------
add("25", "Statistical Consultation Form", "Proposal defense", subtitle="Research Protocol Form 4.1",
    ref="Protocol Form 4.1; Handbook p. 63",
    instructions=[
        "Required before the proposal defense for quantitative studies, accomplished by the Statistician. It is not required for qualitative studies. The student attaches it to the proposal paper when emailing the research adviser, and the adviser sends it to the Research Coordinator with Form 4.",
    ],
    sections=[
        F("Student", RES4 + ["Type of paper", "Research adviser", "Date of consultation"]),
        F(None, [("tall", "Title of the study", 2)]),
        C("Type of study", None, ["Quantitative", "Qualitative (this form is not required)", "Mixed methods (quantitative part only)"], cols=2),
        F("Design reviewed", [("full", "Research design"), ("full", "Population, sampling and sample size"), ("full", "Instrument and its validity and reliability"), ("full", "Statistical tools to be used")]),
        B("Findings and recommendations of the Statistician", "", 2.6),
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
        F("Student", RES4 + ["Type of paper", "Research adviser", "Date"]),
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
        "Accomplished by the research adviser, with e-signature, once the paper complies with the research paper guidelines of the Graduate School Office. It must reach the Research Coordinator (gsresearch@usls.edu.ph) at least two (2) weeks before the defense.",
        "14-Day Rule: at least fourteen (14) days, inclusive of weekends, must pass from the date the panel members receive their copies of the manuscript to the date of the oral defense (Handbook p. 66). The panel members must not agree to a schedule without the manuscript. The same panel takes part in the proposal and the closed-door final defense. For a student abroad the defense is online.",
        "Attach the manuscript; for a proposal defense of a quantitative study, Form 4.1; for a final defense, the Ethics Clearance. The adviser recommends the external panel member, subject to approval of the GS Research Committee.",
    ],
    sections=[
        F("Student", RES4 + ["Type of paper", "Research adviser", "Date of this endorsement"]),
        F(None, [("tall", "Title of the study", 2)]),
        C("Defense endorsed", None, ["Proposal defense", "Closed-door final defense"], cols=2),
        F("Agreed schedule", ["Date of the defense", "Time", "Mode (onsite / online)", "Venue or online platform", "Manuscript given to the panel on", "Days from receipt to defense"]),
        T("Panel", [("Role", 3.6), ("Name", 5.6), ("Received the manuscript on", 3.6), ("Agrees to the schedule (e-signature)", 4.2)],
          [["Panel Chair", "", "", ""], ["Content Specialist", "", "", ""], ["Method Specialist", "", "", ""], ["Content Specialist 2 (dissertation)", "", "", ""], ["External Panel", "", "", ""]], 0.8),
        C("Attachments", None, ["Manuscript", "Form 4.1 Statistical Consultation (quantitative proposal)", "Ethics Clearance (final defense)", "Form 4.2 Co-authorship (if any)"], cols=2),
        P(None, "I certify that I have reviewed the manuscript, that it complies with the research paper guidelines of the Graduate School Office, and that the student is ready for the defense."),
        S("Signatures", [("Research Adviser", "Endorses the defense"), ("Student", "Acknowledged"), ("Research Coordinator", "Received; schedule recorded")]),
    ],
    gs=["Venue reserved on", "Forms 5 / 6 / 7 sent on"])

# ---- 28 ------------------------------------------------------------------------------------
add("28", "Request for Rescheduling or Cancellation of a Defense", "Defense scheduling and rescheduling",
    ref="Handbook pp. 63-67",
    instructions=[
        "Use this form when a confirmed defense cannot take place on its date. A rescheduled defense follows the same protocol as the original: the lead times and the 14-Day Rule apply to the new date.",
        "Give the reason and say who is asking. The Research Coordinator records the change and informs the panel, the adviser and the student. A defense is confirmed again only when the adviser and every panel member are available.",
    ],
    sections=[
        F("Student and defense", RES4 + ["Defense (title / proposal / final)", "Research adviser", "Present date and time", "Present venue or platform"]),
        C("Request", None, ["Reschedule to the new date and time below", "Cancel the defense"], cols=2),
        F(None, ["New date", "New time", "Mode (onsite / online)", "New venue or platform"]),
        C("Requested by", None, ["Student", "Research Adviser", "Panel member", "Graduate School Office"], cols=2),
        B("Reason for the request", "", 2.2),
        T("Availability of the new date", [("Adviser / panel member", 6.6), ("Role", 3.4), ("Available? (yes / no)", 3.2), ("Initials", 3.8)], 6, 0.65),
        S("Signatures", [("Requested by", "Name and signature of the requester"), ("Research Adviser", "Noted"), ("Research Coordinator", "Approved  /  Not approved")]),
    ],
    gs=["Panel informed on", "Platform schedule updated on"])

# ---- 29 ------------------------------------------------------------------------------------
add("29", "Comments Sheet for Proposal Defense", "Proposal defense", subtitle="Research Protocol Form 5",
    ref="Protocol Form 5; Handbook pp. 63-65",
    instructions=[
        "Each panel member accomplishes a sheet and emails it to the panel chair for consolidation. The panel chair emails the consolidated Form 5 to the student, the adviser and the Research Coordinator within the first working day after the defense. The research adviser records the comments of the panel during the defense.",
        "If major revisions are recommended, the student is advised to do a re-defense following the same protocol, and the decision must be reflected here. After the revisions, the adviser endorses the paper to the panel for approval and the release of the Technical Review Certificate (GS-F-30).",
    ],
    sections=[
        F("Student and defense", RES4 + ["Type of paper", "Research adviser", "Date of the defense", "Mode and venue"]),
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
        "Released after the student has addressed the comments of the proposal defense (Form 5), the adviser has endorsed the revised paper, and the panel members have approved it. The panel chair facilitates the accomplishment of this form and emails it to the student and the research adviser, with a copy to the Research Coordinator.",
        "The student attaches this certificate to the Application for Ethics Review (GS-F-31), which must be filed within one (1) month after the proposal defense.",
    ],
    sections=[
        F("Student", RES4 + ["Type of paper", "Research adviser", "Date of proposal defense", "Date revised paper given to the panel"]),
        F(None, [("tall", "Title of the study", 2)]),
        P("Certification", "This is to certify that the panel members named below reviewed the revised proposal of the student named above, that the comments and suggestions raised at the proposal defense have been addressed, and that the proposal is technically sound and may proceed to ethics review."),
        T("Panel approval", [("Role", 3.4), ("Name of panel member", 5.2), ("Approved", 2.2), ("Signature", 3.6), ("Date", 2.6)],
          [["Panel Chair", "", "☐", "", ""], ["Content Specialist", "", "☐", "", ""], ["Method Specialist", "", "☐", "", ""],
           ["Content Specialist 2 (dissertation)", "", "☐", "", ""], ["External Panel", "", "☐", "", ""]], 0.85),
        S("Noted by", [("Research Adviser", None), ("Research Coordinator", "Received")]),
    ],
    gs=["Recorded in platform on"])

# ---- 31 ------------------------------------------------------------------------------------
add("31", "Application for Ethics Review", "Ethics review", subtitle="Research Protocol Form 5.2",
    ref="Protocol Form 5.2; Handbook pp. 23, 65",
    instructions=[
        "Email this form with the revised manuscript and the Technical Review Certificate (GS-F-30) to the research ethics committee (rerc@usls.edu.ph) within one (1) month after the proposal defense, so that there is enough time for review and revisions.",
        "Ethics clearance is needed before the closed-door final defense; the research adviser submits the Ethics Clearance with Form 4 (GS-F-27). The Graduate School records that the clearance was received; it does not judge its content.",
    ],
    sections=[
        F("Applicant", RES4 + ["Type of paper", "Research adviser", "Date of proposal defense", "Date of this application"]),
        F(None, [("tall", "Title of the study", 2)]),
        F("Study details", [("full", "Research design (quantitative, qualitative or mixed)"), ("full", "Participants or sources of data, and sample size"), ("full", "Where and when data will be gathered"), ("full", "How data will be collected")]),
        C("The study involves", None, ["Human participants", "Minors or vulnerable persons", "Sensitive topics or personal data", "Interviews, focus groups or surveys", "Existing records or secondary data only", "No participants"], cols=2),
        B("Possible risks and how they are reduced; how consent and privacy are handled", "", 2.4),
        C("Attached", None, ["Revised manuscript", "Form 5.1 Technical Review Certificate", "Research instruments", "Informed consent form"], cols=2),
        S("Signatures", [("Applicant", "Student"), ("Research Adviser", "Endorsed")]),
        F("For the research ethics committee", ["Date received", "Clearance no.", "Decision (cleared / revise)", "Date of decision"]),
    ],
    gs=["Clearance recorded on"])


# ---- 32 ------------------------------------------------------------------------------------
add("32", "Comments Sheet for Final Defense", "Closed-door and public final defense", subtitle="Research Protocol Form 6",
    ref="Protocol Form 6; Handbook pp. 66-73",
    instructions=[
        "The Research Coordinator sends this form to the panel members. Each panel member accomplishes it and emails it to the panel chair within the first working day after the defense. The panel chair emails all the sheets with the consolidated comments to the Research Coordinator, the research adviser and the student within the same time.",
        "The student states, for every comment, the action taken and the page number where the improvement appears (Handbook p. 72). At the public final defense, the panel members keep this sheet in hand to check compliance.",
        "A provisional pass with major revisions must be reflected here and must agree with the score on the Evaluation Sheet (GS-F-33): below 85 for a thesis or project paper, below 90 for a dissertation (Handbook p. 67).",
    ],
    sections=[
        F("Student and defense", RES4 + ["Type of paper", "Research adviser", "Date of the defense", "Mode and venue"]),
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
        "Each panel member and the research adviser accomplish this sheet and email it to the Research Coordinator (gsresearch@usls.edu.ph) within the first working day after the defense.",
        "The criteria and points are those of the Handbook (p. 76), out of 100 points. A provisional pass with major revisions (subject to re-defense) must agree with the score: a score below 85 for a thesis or project paper, below 90 for a dissertation (Handbook p. 67).",
        "Mark the box below that matches the paper type and the result recorded in the Comments Sheet (GS-F-32).",
    ],
    sections=[
        F("Student and defense", RES4 + ["Type of paper", "Date of the defense", "Name of evaluator", "Role (panel member or adviser)"]),
        F(None, [("tall", "Title of the study", 2)]),
        T("Evaluation", [("Criterion", 6.0), ("Maximum points", 2.2), ("Score", 2.0), ("Basis of the rating", 6.8)],
          [["Format and content", "15", "", "Theoretical or conceptual framework; conceptualization, nature and sources of data; standard format"],
           ["Analysis and discussion", "40", "", "Method of treating data; analysis and interpretation; related literature; clarity and accuracy of language"],
           ["Findings, action plan or program", "15", "", "Synthesis of results; quality of execution and depth"],
           ["Originality, contribution to new knowledge, applicability", "30", "", "Contribution to knowledge or practice; originality; practicability"],
           ["TOTAL", "100", "", ""]], 1.0),
        C("Result consistent with the score", None, ["Thesis or project paper: score of 85 or above", "Thesis or project paper: score below 85 (provisional pass, major revisions)",
                                                      "Dissertation: score of 90 or above", "Dissertation: score below 90 (provisional pass, major revisions)"], cols=1),
        B(None, "Remarks:", 1.4),
        S("Signature", [("Evaluator", "Panel member / Research Adviser"), ("Research Coordinator", "Received on ________")]),
    ],
    gs=["Score recorded in platform on"])

# ---- 34 ------------------------------------------------------------------------------------
add("34", "Settlement of Provisional Thesis / Dissertation Approval", "Revisions and completion", subtitle="Research Protocol Form 8",
    ref="Protocol Form 8; Handbook p. 67",
    instructions=[
        "Used when the panel gave a provisional pass with major revisions and did not recommend a re-defense. The student complies with the corrections; once the revised manuscript is given to the panel members for approval, the 14-Day Rule applies.",
        "The research adviser accomplishes this form and emails it to the Research Coordinator (gsresearch@usls.edu.ph). If the student fails to meet the recommendations of all panel members at a given time, the student is advised to re-defend following the same protocol.",
    ],
    sections=[
        F("Student and defense", RES4 + ["Type of paper", "Research adviser", "Date of the defense", "Score on Form 7"]),
        F(None, [("tall", "Title of the study", 2), "Revised manuscript given to the panel on", "14 days complete on"]),
        T("Revisions and compliance", [("No.", 1.0), ("Required revision (from Form 6)", 6.0), ("Action taken", 5.0), ("Page", 1.3), ("Member and initials", 3.7)], 7, 0.85),
        T("Panel approval of the revised manuscript", [("Role", 3.4), ("Name of panel member", 5.2), ("Approved", 2.2), ("Signature", 3.6), ("Date", 2.6)],
          [["Panel Chair", "", "☐", "", ""], ["Content Specialist", "", "☐", "", ""], ["Method Specialist", "", "☐", "", ""], ["Content Specialist 2 / External", "", "☐", "", ""]], 0.8),
        P(None, "I certify that the revisions required by the panel are reflected in the revised manuscript."),
        S("Signatures", [("Research Adviser", "Certifies compliance"), ("Student", None), ("Research Coordinator", "Received; provisional approval settled")]),
    ],
    gs=["Result recorded in platform on"])

# ---- 35 ------------------------------------------------------------------------------------
add("35", "Endorsement for Public Final Defense", "Public final defense", subtitle="Research Protocol Form 4.3",
    ref="Protocol Form 4.3; Handbook pp. 70-73",
    instructions=[
        "For students admitted in August 2020 and onwards. The student is given two (2) to four (4) weeks after the closed-door final defense to prepare and apply (Handbook p. 71). Students admitted earlier present at a research conference instead.",
        "The research adviser first checks that the revised manuscript complies with the suggestions of the panel at the closed-door defense, then emails this form to the Research Coordinator. It must be fully accomplished with the e-signature of the panel members and the date the panel received the manuscript. Application is made five (5) days before the preferred schedule for posting; the Handbook and the Protocol also mention two (2) weeks (Handbook pp. 72-73).",
        "The Graduate School Office reserves the venue. The Research Coordinator prepares the public announcement, sends it to the adviser, the student and the panel, with copy to the Associate Dean and the Dean, and posts it on the Graduate School Facebook page with the pre-registration link.",
    ],
    sections=[
        F("Student", RES4 + ["Type of paper", "Research adviser", "Date of the closed-door defense", "Date of this endorsement"]),
        F(None, [("tall", "Title of the study", 2)]),
        F("Preferred schedule", ["Preferred date", "Time", "Mode (onsite / online)", "Venue requested (reserved by the GS Office)"]),
        T("Panel", [("Role", 3.6), ("Name", 5.4), ("Received the revised manuscript on", 3.8), ("E-signature", 4.2)],
          [["Panel Chair", "", "", ""], ["Content Specialist", "", "", ""], ["Method Specialist", "", "", ""], ["Content Specialist 2 (dissertation)", "", "", ""], ["External Panel", "", "", ""]], 0.8),
        C("Attached", None, ["Revised manuscript", "Accomplished Form 6 with the action taken", "Ethics Clearance"], cols=2),
        P(None, "I certify that the revised manuscript complies with the comments and suggestions of the panel at the closed-door final defense and that the student is ready for the public final defense."),
        S("Signatures", [("Research Adviser", "Endorses the public defense"), ("Student", "Acknowledged"), ("Research Coordinator", "Schedule approved; announcement prepared")]),
    ],
    gs=["Announcement posted on", "Venue reserved on"])

# ---- 36 ------------------------------------------------------------------------------------
add("36", "Similarity Index (Turnitin) Certification", "Revisions and completion",
    ref="Handbook p. 68; Protocol, Closed-door Final Defense III",
    instructions=[
        "After the research adviser has verified that the panel's recommendations are reflected in the manuscript and has endorsed it for scanning, the student requests the Turnitin scan by emailing turnitin@usls.edu.ph. A similarity index rating (SIR) of not more than 15% is required before the paper goes to the editor (Handbook p. 68).",
        "The administrator who ran the scan completes and signs this certification. Attach the Turnitin similarity report. The certification is one of the documents the student sends to the Graduate School when the manuscript is ready for hard-bound reproduction.",
    ],
    sections=[
        F("Student and paper", RES4 + ["Type of paper", "Research adviser", "Date endorsed by the adviser for scanning"]),
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
        "The student chooses an editor from the pool of editors affiliated with the University, so that the USLS Institutional Research Format (IRF) is applied. The research adviser may not be the student's editor (Handbook p. 59). The 14-Day Rule applies to the time the editor has for review. The editor gives this certification once the corrections have been carried out.",
        "The student sends the Editor Certification, with the final manuscript, the panel approval emails, the Ethics Clearance and the Turnitin certification, to the Graduate School Office (gsresearch@usls.edu.ph), copy to the ethics committee.",
    ],
    sections=[
        F("Student and paper", RES4 + ["Type of paper", "Research adviser", "Turnitin similarity index (%)"]),
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
        "The Graduate School Office coordinates with the panel members and the adviser for the signing of this sheet. The signed sheet is bound into the bound copies, which must carry the official approval of the members of the defense panel and the official acceptance of the Dean (Handbook p. 77).",
        "Submit the bound copies and the CD with the signed approval sheets as part of the requirements for the diploma, the transcript of records and related documents.",
    ],
    sections=[
        F("Student", RES4 + ["Degree", "Date of the final defense"]),
        F(None, [("tall", "Title of the study", 2)]),
        P("Approval", "This project paper, thesis or dissertation, prepared and submitted by the student named above in partial fulfillment of the requirements for the degree stated, has been examined by the defense panel, has complied with the required revisions, and is recommended for acceptance."),
        T("Panel and adviser", [("Role", 3.8), ("Name", 5.8), ("Signature", 4.2), ("Date", 3.2)],
          [["Research Adviser", "", "", ""], ["Panel Chair", "", "", ""], ["Content Specialist", "", "", ""], ["Method Specialist", "", "", ""],
           ["Content Specialist 2 (dissertation)", "", "", ""], ["External Panel", "", "", ""]], 0.95),
        P("Acceptance", "Accepted by the Graduate School in partial fulfillment of the requirements for the degree."),
        S("Accepted by", [("Graduate School Dean", None)]),
    ],
    gs=["Bound copies and CD received on"])

# ---- 39 ------------------------------------------------------------------------------------
add("39", "Formal Invitation to Co-Author a Journal Article", "Publication", subtitle="Research Protocol Form 11",
    ref="Protocol Form 11; Handbook pp. 64, 75",
    instructions=[
        "Use only if the co-author was pre-identified during the proposal (GS-F-26). The student sends the invitation to the prospective co-author and attaches the signed form to the publication request (GS-F-40).",
        "The student must have the major part and contribute at least 80% (Handbook p. 64). The published article must show the authors' affiliation in the format given in the Handbook, p. 75.",
    ],
    sections=[
        F("Student", RES4 + ["Research adviser", "Date of invitation"]),
        F("Prospective co-author", ["Name", "Position", "Institution and department", "Email", ("full", "Title of the study")]),
        F(None, [("full", "Journal intended for submission (from the PEO list)")]),
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
        F("Student", RES4 + ["Research adviser", "Date of application"]),
        F("Article and journal", [("full", "Title of the article"), ("full", "Name of the journal"), "Publisher", "ISSN", "Journal website"]),
        C("Indexing of the journal", None, ["Scopus", "Web of Science", "ISI", "Peer-reviewed (MA students)", "The journal is on the PEO approved list"], cols=2),
        F(None, [("full", "Authors and affiliations, in the format of the Handbook"), "Professor (if required by a course)", "Course"]),
        C("Attached", None, ["Manuscript", "Ethics Clearance, if any", "Form 11, if any"], cols=3),
        S("Screening by the Research Committee", [("Research Coordinator", None), ("Academic Coordinator", None), ("Associate Dean", None), ("External expert", None)]),
        C("Decision of the Dean", None, ["Approved for submission", "Not approved"], cols=2),
        S(None, [("Graduate School Dean", None)]),
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
        F("Student", RES4 + ["Research adviser", "Date submitted"]),
        F("Article", [("full", "Title of the article"), ("full", "Name of the journal"), "Volume, issue and pages", "DOI or web address", "Date accepted or published", "Date of approval of Form 12"]),
        C("Status", None, ["Accepted for publication", "Published"], cols=2),
        C("Attached", None, ["Copy of the journal", "Certificate of publication or letter of acceptance", "The authors' affiliation follows the Handbook format"], cols=1),
        S("Signatures", [("Student", None), ("Research Coordinator", "Received; evidence checked for presence")]),
    ],
    gs=["Recorded in platform on"])

# ---- 42 ------------------------------------------------------------------------------------
add("42", "Application for Graduation", "Graduation application and endorsement",
    ref="Handbook pp. 55-56, 68-69, 75-77, 80",
    instructions=[
        "A student is considered a graduate only after completing all the requirements below; a student who has not met them may not go up the stage (Handbook p. 77). The student must be officially enrolled in the semester of application.",
        "The Graduate School checks that each document is present. It does not verify the content of the documents. The University Registrar certifies the eligibility of candidates for graduation and honors (Handbook p. 32). An application with wrong information is returned and replaced by a new corrected form; the first form is kept.",
        "Graduating students attend the Alumni seminar and present at the Graduate School Research Conference (Handbook pp. 69, 80).",
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
        "The Graduate School staff compile the candidates whose coursework, research and, where applicable, practicum are complete and who have submitted a signed graduation application (GS-F-42). The Academic Coordinator checks the coursework; the Research Coordinator validates the research completion documents.",
        "The Dean approves the list and sends it to the University Registrar by official email with GS-F-44. The Registrar certifies eligibility and honors; the Graduate School does not issue the diploma.",
    ],
    sections=[
        F("Batch", ["Academic year", "Review window", "Batch name", "Date prepared", "Prepared by (GS staff)", "Number of candidates"]),
        T("Candidates endorsed", [("No.", 0.9), ("Student no.", 2.0), ("Name of student", 3.8), ("Program", 1.8), ("Coursework", 2.3), ("Research", 1.9), ("Practicum", 2.1), ("Remarks", 2.2)], 12, 0.62),
        C("Dean's decision", None, ["The list is approved and endorsed to the University Registrar", "Returned to the Graduate School (see remarks)"], cols=1),
        B(None, "Remarks of the Dean:", 1.2),
        S("Signatures", [("Prepared by", "Graduate School staff"), ("Coursework checked by", "Academic Coordinator"), ("Research documents validated by", "Research Coordinator"), ("Approved by", "Graduate School Dean")]),
    ],
    gs=["File exported on", "Sent to Registrar on"])

# ---- 44 ------------------------------------------------------------------------------------
add("44", "Records Transmittal to the University Registrar", "Records handoff to the Registrar",
    ref="Handbook pp. 32, 49, 53",
    instructions=[
        "Use one transmittal for each handoff to the Registrar: a notice of an approved leave with the reasons and any refund, a copy of the Withdrawal Form, the Dean's endorsement of a returning student, or the graduation endorsement list. The Graduate School's responsibility ends at sending the request to the Registrar.",
        "The Registrar records receipt in the last section. The Graduate School keeps the original and does not treat the matter as done until the Registrar's confirmation is on file. Official enrollment and grade data stay with the Registrar.",
    ],
    sections=[
        F("Transmittal", ["Date sent", "Sent by (name and office)", "Mode (email / hand-carried)", "Reference no."]),
        C("Type of handoff", None, ["Notice of approved leave of absence (GS-F-07)", "Withdrawal Form copies (GS-F-05)", "Endorsement of returning student (GS-F-08)", "Graduation endorsement list (GS-F-43)", "Cross-enrollment or other request", "Other: ____________________"], cols=1),
        T("Records transmitted", [("Student no.", 2.4), ("Name of student", 5.0), ("Document", 4.4), ("Term", 2.4), ("Remarks (reason, refund)", 2.8)], 7, 0.68),
        S("Signatures", [("Sent by", "Dean, Associate Dean or authorized representative"), ("Received by", "University Registrar (name, date, reference no.)")]),
    ],
    gs=["Confirmation of Registrar on"])


# =========================================================================== routing data for GS-P-02
# code: (when used, submitted by, reviewed by, approved / decided by, goes next to, platform step)
ROUTES = {
    "01": ("After each admission handoff or import of the monitoring workbook", "GS staff", "Academic Coordinator", "Dean", "Enrollment and advising", "Admission: Dean onboarding gate"),
    "02": ("Before enrollment each term", "Student", "Academic Coordinator", "Academic Coordinator", "Student enrolls in AIMS; Business Office", "Enrollment: study plan, Academic Coordinator review"),
    "03": ("First week of classes only", "Student", "Academic Coordinator", "Associate Dean (added subject)", "GS Office issues the Advice Slip; Business Office", "Course Adjustments"),
    "04": ("Term break, before enrollment", "Academic Coordinator", "Associate Dean", "Dean", "Published to students; Business Office", "Course Adjustments: offering plan (draft, submitted, approved, published)"),
    "05": ("Up to the second week of classes (later only as the Handbook allows)", "Student", "Academic Coordinator; GS staff", "Dean", "Registrar; Accounting Office; Business Office", "Withdrawal: Dean Review, then Registrar"),
    "06": ("Unexcused absences above 20% of class hours", "Professor", "Academic Coordinator", "Academic Coordinator (Dean noted)", "Registrar (AIMS); GS record", "Monitoring: drop with absence evidence"),
    "07": ("Before a semester the student will not enroll in; not within 2 weeks of the last day of classes", "Student", "Academic Coordinator", "Dean", "Registrar (notice with refund); Business Office", "Leave of Absence board"),
    "08": ("When a student returns from leave or AWOL", "Student", "Academic Coordinator; Business Office", "Dean (endorses to Registrar)", "Registrar; enrollment", "Readmission board"),
    "09": ("When AWOL is found from source evidence", "GS staff or Academic Coordinator", "Academic Coordinator", "Dean (noted)", "Student; Registrar; GS-F-08 on return", "AWOL case (AWOL Declared)"),
    "10": ("Term of residency (thesis, practicum, comprehensive exam, INC, publication)", "Student", "Academic Coordinator", "Dean or authorized representative", "Business Office; enrollment", "Residency enrollment"),
    "11": ("Before the practicum starts", "Student", "Academic Coordinator", "Dean (for the University)", "Host organization; GS file", "Practicum: MOA Received"),
    "12": ("During and at the end of the practicum", "Student; host supervisor", "Academic Coordinator", "Host supervisor certifies", "GS-F-13", "Practicum: hours and certificates"),
    "13": ("When the required hours are complete", "Academic Coordinator", "Academic Coordinator", "Dean reviews (no approval)", "Graduation review", "Practicum: Report Sent to Dean, Dean Reviewed"),
    "14": ("At least 2 weeks before the examination", "Student", "Academic Coordinator or College Dean", "Graduate Program Secretary", "Examination; GS-F-15", "Comprehensive exam status"),
    "15": ("After the examination", "Academic Coordinator", "Graduate Program Secretary", "Dean (noted)", "Monitoring workbook (COMPRE); adviser designation", "Comprehensive exam: result recorded"),
    "16": ("At least 2 weeks before the title defense", "Student", "Academic Coordinator", "Academic Coordinator endorses; Research Coordinator", "Panel nomination (GS-F-17)", "Research gate: Form 1 - Title Defense"),
    "17": ("When a panel is nominated for any defense", "Research Coordinator", "GS Research Committee", "Research Coordinator; Committee for external panel", "Defense scheduling", "Panel matching and panel invitations"),
    "18": ("Within the first working day after the title defense", "Panel Chair", "Panel members", "Panel", "Adviser designation (GS-F-19)", "Title defense verdict"),
    "19": ("After the comprehensive examination, while taking courses or after the title defense", "Student", "Academic Coordinator (notes)", "Research Coordinator, Associate Dean, Dean", "GS-F-20", "Adviser Appointments: Applied, Noted by AC, Under deliberation"),
    "20": ("After the designation is decided", "Research Coordinator", "Associate Dean", "Dean", "Student and adviser; GS-F-22 and GS-F-23 within 5 days", "Adviser Appointments: Appointed, Accepted"),
    "21": ("Once only, before the proposal defense application", "Student", "Current and new adviser", "Research Coordinator, Associate Dean, Dean", "New GS-F-20", "Adviser Appointments: Change request"),
    "22": ("Within 5 days of GS-F-20", "Student and adviser", "Adviser", "Research Coordinator receives", "Research file", "Adviser Appointments: contract received"),
    "23": ("Within 5 days of GS-F-20", "Student and adviser", "Adviser", "Research Coordinator receives", "Research file", "Adviser Appointments: contract received"),
    "24": ("Once only, before the proposal defense application", "Student", "Adviser", "Panel members", "Research file", "Not a separate step yet; title kept in the research case"),
    "25": ("Before the proposal defense (quantitative studies)", "Student", "Statistician", "Statistician", "GS-F-27", "Research gate: Form 4"),
    "26": ("When a co-author is pre-identified", "Student", "Adviser", "Panel Chair (noted)", "GS-F-39 and GS-F-40 at publication", "Not a separate step yet"),
    "27": ("At least 2 weeks before the proposal or closed-door final defense", "Adviser", "Research Coordinator", "Adviser endorses", "Panel; GS-F-29 or GS-F-32 and GS-F-33", "Research gate: Form 4; Final Defense; defense scheduling"),
    "28": ("When a confirmed defense cannot proceed", "Student, adviser, panel or GS Office", "Adviser", "Research Coordinator", "Panel informed; GS-F-27 dates revised", "Defense scheduling: reschedule or cancel with reason"),
    "29": ("After the proposal defense, first working day", "Panel members", "Panel Chair consolidates", "Panel", "Revisions; GS-F-30", "Proposal defense verdict"),
    "30": ("After the revised proposal is approved by the panel", "Panel Chair", "Adviser", "Panel members", "GS-F-31", "Research gate: Form 5.1"),
    "31": ("Within 1 month after the proposal defense", "Student", "Adviser", "Research ethics committee", "Ethics Clearance; GS-F-27 (final)", "Ethics clearance status and date"),
    "32": ("After the closed-door and the public final defense, first working day", "Panel members", "Panel Chair consolidates", "Panel", "Revisions; GS-F-34 or GS-F-35", "Final defense verdict"),
    "33": ("After the closed-door final defense, first working day", "Panel members and adviser", "Research Coordinator", "Panel", "Result and score recorded", "Final defense verdict with Form 7 score"),
    "34": ("After a provisional pass without re-defense", "Adviser", "Panel members", "Panel", "Turnitin and editing (GS-F-36)", "Verdict follow-up: revisions confirmed by the panel chair"),
    "35": ("2 to 4 weeks after the closed-door defense (admitted August 2020 onward)", "Adviser", "Panel members", "Research Coordinator", "Announcement and public defense", "Not modeled yet (Public Final Defense)"),
    "36": ("After the adviser endorses the final manuscript", "Student", "Turnitin administrator", "Turnitin administrator", "Editor (GS-F-37)", "Completion Evidence: Turnitin certificate"),
    "37": ("After the similarity check is passed", "Student", "Editor", "Editor", "GS Office (GS-F-38)", "Completion Evidence: Form 9"),
    "38": ("After the manuscript is ready for hard-bound reproduction", "GS Office", "Panel and adviser", "Dean accepts", "Bound copies and CD; graduation", "Completion Evidence: Form 10"),
    "39": ("When a co-author was pre-identified", "Student", "Adviser", "Co-author accepts", "GS-F-40", "Not modeled yet"),
    "40": ("Before submitting to a journal", "Student", "GS Research Committee", "Dean", "Student submits to the journal", "Not modeled yet"),
    "41": ("When the article is accepted or published", "Student", "Research Coordinator", "Research Coordinator", "Graduation application", "Not modeled yet"),
    "42": ("In the review window of the graduating term", "Student", "Academic Coordinator; Research Coordinator", "Dean", "GS-F-43", "Graduation: signed application, For Review"),
    "43": ("After candidates are checked", "GS staff", "Academic Coordinator; Research Coordinator", "Dean", "Registrar with GS-F-44", "Graduation: Dean Approved, exported list"),
    "44": ("Whenever a record is sent to the Registrar", "Dean, Associate Dean or representative", "GS staff", "University Registrar acknowledges", "Registrar; GS log", "Registrar status and handoff log"),
}


def build_approval_sheet():
    doc = new_document()
    code, title = "GS-P-01", "Graduate School Forms Approval Sheet"
    doc.core_properties.title = f"{code} {title}"
    doc.core_properties.author = "University of St. La Salle Graduate School"
    footer(doc, code, title, PORTRAIT_W)
    institution_header(doc, PORTRAIT_W)
    title_block(doc, title, "Approval of the official forms of the Graduate School", PORTRAIT_W)
    control_box(doc, code, "Control of forms", "", PORTRAIT_W)
    instruction_box(doc, [
        "The forms listed below are the official forms of the Graduate School for the lifecycle of a graduate student: enrollment, course adjustments, withdrawal, dropping, leave of absence, readmission, absence without leave, residency, practicum, the comprehensive examination, research (title, adviser, proposal, ethics, final defense, completion, publication) and graduation.",
        "Forms for the research process keep the form number of the Research Protocol AY 2024-2025, shown in the title line of each form. Every form carries its own control fields: form code, revision number and effectivity date.",
        "For each form, mark Approved, or write the change required in Remarks. The signatures below approve the forms at the revision shown (Revision 00) and fix the effectivity date.",
    ], PORTRAIT_W)
    rows = [[f["code"], f["title"], f["process"], BOX, ""] for f in FORMS]
    section_bar(doc, "A.  Forms reviewed", PORTRAIT_W)
    grid_table(doc, [("Code", 1.8), ("Form", 6.0), ("Process", 4.4), ("Approved", 2.0), ("Remarks", 2.8)], rows, PORTRAIT_W, row_h=0.74, size=NOTE)
    section_bar(doc, "B.  Effectivity", PORTRAIT_W)
    field_grid(doc, ["Revision of all forms", ("full", "Effectivity date of the approved forms"), ("full", "Remarks of the approving officers")], PORTRAIT_W)
    section_bar(doc, "C.  Review and approval", PORTRAIT_W)
    sign_block(doc, [
        ("Submitted by", "Capstone group CAP-IT1 (platform project)"), ("Reviewed by", "Research Coordinator"), ("Reviewed by", "Associate Dean"),
        ("Reviewed by", "Academic Coordinators of the five program clusters"), ("Reviewed by", "Graduate School Secretary"),
        ("Approved by", "Graduate School Dean"),
    ], PORTRAIT_W)
    gs_box(doc, [], PORTRAIT_W)
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{code} {title}.docx"
    doc.save(path)
    return path


def build_routing_guide():
    width = LANDSCAPE_W
    doc = new_document(landscape=True)
    code, title = "GS-P-02", "Forms Routing Guide"
    doc.core_properties.title = f"{code} {title}"
    doc.core_properties.author = "University of St. La Salle Graduate School"
    footer(doc, code, title, width)
    institution_header(doc, width)
    title_block(doc, title, "Who files, who reviews, who decides and where each form goes next", width)
    control_box(doc, code, "Control of forms", "", width)
    paragraph(doc, "Read across a row to follow a form. The last column names the step of the Graduate Student Lifecycle Monitoring platform that records the same event, so the paper form and the platform always show the same facts. Where the Handbook or the Research Protocol states a rule, it is cited on the form itself.",
              size=NOTE, align=WD_ALIGN_PARAGRAPH.LEFT)
    rows = []
    for f in FORMS:
        key = f["code"].split("-")[-1]
        when, sub, rev, appr, nxt, plat = ROUTES[key]
        rows.append([f["code"], f["title"], when, sub, rev, appr, nxt, plat])
    cols = [("Form", 1.9), ("Title", 3.6), ("When used", 4.2), ("Submitted by", 2.5), ("Reviewed by", 2.7), ("Approved / decided by", 2.9), ("Goes next to", 3.4), ("Platform step", 3.5)]
    t = grid_table(doc, cols, rows, width, row_h=0.9, size=8)
    for r in t.rows[1:]:
        no_split(r)
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{code} {title}.docx"
    doc.save(path)
    return path


def main():
    assert len({f["code"] for f in FORMS}) == len(FORMS), "duplicate form codes"
    codes = [f["code"] for f in FORMS]
    assert codes == sorted(codes), "forms must be in lifecycle (numeric) order"
    for f in FORMS:
        assert f["code"].split("-")[-1] in ROUTES, f"no routing row for {f['code']}"
    only = set(sys.argv[1:])
    built = []
    for f in FORMS:
        if only and f["code"] not in only and f["code"].split("-")[-1] not in only:
            continue
        built.append(build_form(f, OUT))
    if not only or "P" in only:
        built.append(build_approval_sheet())
        built.append(build_routing_guide())
    print(f"built {len(built)} files in {OUT}")


if __name__ == "__main__":
    main()
