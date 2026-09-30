#!/usr/bin/env python
"""Build the Graduate School Operations Manual (Word, Markdown, JSON, PDF).

Content lives in scripts/docs/opsmanual/*.py.  Run from the repository root:

    python scripts/docs/build_operations_manual.py            # docx + md + json
    python scripts/docs/build_operations_manual.py --pdf      # also render a PDF and
                                                              # fill the table of contents

python-docx is NOT a project dependency.  Install it in a throwaway environment:

    python -m venv E:/Temp/claude/opsman-venv
    E:/Temp/claude/opsman-venv/Scripts/pip install python-docx pymupdf

``--pdf`` also needs LibreOffice (soffice) and PyMuPDF (fitz); it makes two passes so the
table of contents carries real page numbers even in viewers that do not update fields.
Word updates the table of contents itself when the file is opened (updateFields is set).
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))

from opsmanual import common, front, questions  # noqa: E402
from opsmanual.common import STATUSES  # noqa: E402
from opsmanual.p_admission_to_drop import ADMISSION, DROPPING, ENROLLMENT, OFFERING, WITHDRAWAL  # noqa: E402
from opsmanual.p_end import GRADUATION, HANDOFF, PRACTICUM  # noqa: E402
from opsmanual.p_leave_to_compre import AWOL, COMPRE, LOA, READMISSION, RESIDENCY  # noqa: E402
from opsmanual.p_research import ADVISER, COMPLETION, FINAL, PROPOSAL, SCHEDULING, TITLE  # noqa: E402

OUT_DIR = ROOT / "Documents" / "CAPSTONE_ONLY"
STEM = front.FILE_STEM
SOFFICE = Path("E:/LibreOffice/program/soffice.exe")
LO_PROFILE = "file:///E:/Temp/claude/lo-profile-opsman"

PROCESSES = [
    ADMISSION, ENROLLMENT, OFFERING, WITHDRAWAL, DROPPING, LOA, READMISSION, AWOL, RESIDENCY,
    COMPRE, TITLE, ADVISER, PROPOSAL, FINAL, COMPLETION, SCHEDULING, PRACTICUM, GRADUATION, HANDOFF,
]

SHORT = {
    "4.1": "4.1 Admission", "4.2": "4.2 Enrollment", "4.3": "4.3 Course offering", "4.4": "4.4 Withdrawal",
    "4.5": "4.5 Dropping", "4.6": "4.6 Leave of absence", "4.7": "4.7 Readmission", "4.8": "4.8 AWOL",
    "4.9": "4.9 Residency", "4.10": "4.10 Comprehensive exam", "4.11": "4.11 Title defense", "4.12": "4.12 Adviser",
    "4.13": "4.13 Proposal defense", "4.14": "4.14 Final defense", "4.15": "4.15 Completion", "4.16": "4.16 Scheduling",
    "4.17": "4.17 Practicum", "4.18": "4.18 Graduation", "4.19": "4.19 Registrar handoff",
}

# Steps that rest on Practice or Proposed rules, or on the group's process model, rather than on the
# Handbook or the Research Protocol.  They are marked with a dagger in the procedure tables.
STEP_FLAGS = {
    "4.1": [6, 7, 8, 9], "4.2": [2, 6], "4.3": [1, 2, 3, 4], "4.4": [5, 6], "4.5": [2, 3, 4, 5],
    "4.6": [2, 5], "4.7": [2, 6], "4.8": [1], "4.9": [3, 4], "4.16": [2, 3, 4, 5],
    "4.17": [1, 2, 3, 4, 5, 6, 7, 8], "4.18": [1, 2, 3, 4, 5, 6], "4.19": [3, 4, 5],
}
STEP_NOTE = (
    "† This step rests on a rule marked Practice or Proposed in section {n}.5, or on the group's process model; "
    "it is not described in the Handbook or the Research Protocol and is to be confirmed by the Graduate School."
)


def step_rows(proc):
    flagged = set(STEP_FLAGS.get(proc.num, []))
    return [[f"{i}†" if i in flagged else str(i), w, a, f, t] for i, (w, a, f, t) in enumerate(proc.steps, 1)]


SUBHEADS = [
    ("1", "Purpose"), ("2", "Who is involved"), ("3", "Trigger and preconditions"),
    ("4", "Procedure"), ("5", "Business rules"), ("6", "Exceptions and unusual cases"),
    ("7", "Records produced and where they go"), ("8", "How the platform supports this process"),
]

CH4_INTRO = (
    "Each of the nineteen sections below follows the same layout: purpose, who is involved, trigger and "
    "preconditions, the procedure as a numbered table, the business rules table, exceptions, records, and how "
    "the platform supports the process together with any difference between the platform and the rule. "
    "Rule statuses are Official, Practice and Proposed (see 1.4). Rows marked Practice or Proposed are the ones "
    "the Graduate School is asked to confirm."
)

CH5_INTRO = (
    "This register lists every business rule in this manual, sorted by process. The platform's rules register "
    "will be checked against this list. A machine-readable copy is saved as operations_manual_rules.json. "
    "The status column is Official (Handbook or Protocol), Practice (described by staff in consultation) or "
    "Proposed (the group's proposal); Practice and Proposed rows must be confirmed by the Graduate School."
)

CH6_INTRO = (
    "The group could not answer the following questions from the sources. Each states where the sources conflict, "
    "where they are silent, or where practice differs from the Handbook, gives the options the group can see, "
    "and leaves a blank for the Graduate School's answer. Where a question affects rules, the rule numbers are listed. "
    "Until a question is answered, the platform follows the Handbook."
)

CH7_INTRO = (
    "By signing below the reviewer confirms that they have read this manual, have corrected or confirmed every rule "
    "marked Practice or Proposed, and have answered the questions in Chapter 6 (or recorded why not). Until this page is "
    "signed by the Graduate School Dean, this manual is a draft and not an official USLS document."
)

# --------------------------------------------------------------------------------------
# Data helpers shared by all three outputs
# --------------------------------------------------------------------------------------


def all_rules() -> list[common.Rule]:
    rules = []
    for proc in PROCESSES:
        for rule in proc.rules:
            rule.process = proc.title
            rules.append(rule)
    return rules


def rule_counts() -> dict[str, int]:
    counts = {s: 0 for s in STATUSES}
    for rule in all_rules():
        counts[rule.status] += 1
    return counts


def rules_json() -> dict:
    items = []
    for proc in PROCESSES:
        for rule in proc.rules:
            items.append({
                "id": rule.rid,
                "process": proc.title,
                "process_section": proc.num,
                "rule": rule.text,
                "source": rule.source_text(),
                "sources": [{"document": d, "location": l} for d, l in rule.sources],
                "page": rule.page_text(),
                "status": rule.status,
            })
    return {
        "document": front.TITLE,
        "version": front.VERSION,
        "date": front.DOC_DATE,
        "note": "Draft for validation. Practice and Proposed rules are not confirmed by the Graduate School.",
        "counts": rule_counts(),
        "rules": items,
    }


# --------------------------------------------------------------------------------------
# Markdown
# --------------------------------------------------------------------------------------


def md_cell(text: str) -> str:
    return str(text).replace("|", "\\|").replace("\n", " ")


def md_table(header, rows) -> list[str]:
    lines = ["| " + " | ".join(md_cell(h) for h in header) + " |", "|" + "|".join(["---"] * len(header)) + "|"]
    for row in rows:
        lines.append("| " + " | ".join(md_cell(c) for c in row) + " |")
    lines.append("")
    return lines


def render_blocks_md(blocks) -> list[str]:
    out: list[str] = []
    for b in blocks:
        if "h2" in b:
            out += [f"### {b['h2']}", ""]
        elif "h3" in b:
            out += [f"#### {b['h3']}", ""]
        elif "p" in b:
            out += [b["p"], ""]
        elif "bullets" in b:
            out += [f"- {x}" for x in b["bullets"]] + [""]
        elif "table" in b:
            out += md_table(b["table"]["header"], b["table"]["rows"])
    return out


def build_markdown() -> str:
    L: list[str] = []
    L += [f"# {front.TITLE}", "", f"**{front.COVER_MARK}**", ""]
    L += ["## Document control", ""] + md_table(["Item", "Detail"], front.CONTROL_ROWS)
    L += ["## Contents", ""]
    toc = toc_entries()
    for lvl, text in toc:
        L.append(("- " if lvl == 1 else "  - ") + text)
    L.append("")
    L += ["## 1 Purpose, scope and how to read this manual", ""] + render_blocks_md(front.CH1)
    L += ["## 2 Roles and responsibilities", ""]
    L += ["### 2.1 Graduate School roles", ""] + md_table(front.ROLES_HEADER, front.ROLES)
    L += ["### 2.2 External offices and what is handed to them", ""] + md_table(front.EXTERNAL_HEADER, front.EXTERNAL)
    L += ["## 3 Records and sources of record", "", front.CH3_INTRO, ""]
    L += ["### 3.1 Records the office maintains", ""] + md_table(front.RECORDS_HEADER, front.RECORDS)
    L += ["### 3.2 Official source for each kind of data", "",
          "AIMS and the University Registrar are the official record for enrollment and grades. The platform is a monitoring and coordination layer and does not replace them.", ""]
    L += md_table(front.SOURCE_OF_RECORD_HEADER, front.SOURCE_OF_RECORD)
    L += render_blocks_md(front.CH3_NOTES)
    L += ["## 4 Process chapters", "", CH4_INTRO, ""]
    for proc in PROCESSES:
        L += process_md(proc)
    L += ["## 5 Consolidated business rules register", "", CH5_INTRO, ""]
    counts = rule_counts()
    L += [f"Total rules: {sum(counts.values())} (Official {counts['Official']}, Practice {counts['Practice']}, Proposed {counts['Proposed']}).", ""]
    rows = [[r.rid, r.process, r.text, r.source_text(), r.status] for r in all_rules()]
    L += md_table(["Rule", "Process", "Rule", "Source", "Status"], rows)
    L += ["## 6 Open questions for validation", "", CH6_INTRO, ""]
    for q in questions.QUESTIONS:
        L += [f"### {q['id']} {q['topic']}", "", f"*Kind:* {q['kind']}.", "", "**What the sources say**", ""]
        L += [f"- {s}" for s in q["says"]] + [""]
        L += [f"**Question.** {q['question']}", "", "**Options**", ""]
        L += [f"- {o}" for o in q["options"]] + [""]
        L += [f"**Affects rules:** {', '.join(q['affects']) or 'none'}", "", "**Stakeholder's answer:** ____________________________________________", "",
              "**Decided by / date:** ____________________", ""]
    L += ["## 7 Validation and sign-off", "", CH7_INTRO, "", "### 7.1 Sign-off", ""]
    L += md_table(front.SIGNOFF_HEADER, [[""] * 5 for _ in range(front.SIGNOFF_ROWS)])
    L += ["### 7.2 Change log", ""] + md_table(front.CHANGELOG_HEADER, front.CHANGELOG)
    L += ["## Appendix A Forms named in the sources", ""] + md_table(front.FORMS_HEADER, front.FORMS)
    L += ["## Appendix B Glossary", ""] + md_table(["Term", "Meaning"], [[a, b] for a, b in front.GLOSSARY])
    return "\n".join(L) + "\n"


def process_md(proc) -> list[str]:
    L = [f"### {proc.num} {proc.title}", ""]
    if proc.callout:
        L += [f"> {proc.callout}", ""]
    L += [f"#### {proc.num}.1 Purpose", "", proc.purpose, ""]
    L += [f"#### {proc.num}.2 Who is involved", ""] + [f"- {w}" for w in proc.who] + [""]
    L += [f"#### {proc.num}.3 Trigger and preconditions", "", f"**Trigger.** {proc.trigger}", "", "**Preconditions.**", ""]
    L += [f"- {p}" for p in proc.preconditions] + [""]
    L += [f"#### {proc.num}.4 Procedure", ""]
    L += md_table(["Step", "Who", "What they do", "Form / record", "Time limit"], step_rows(proc))
    if STEP_FLAGS.get(proc.num):
        L += [STEP_NOTE.format(n=proc.num), ""]
    for extra in proc.extras:
        L += [f"**{extra['title']}**", ""] + md_table(extra["header"], extra["rows"])
    L += [f"#### {proc.num}.5 Business rules", ""]
    L += md_table(["Rule", "Rule statement", "Source", "Status"], [[r.rid, r.text, r.source_text(), r.status] for r in proc.rules])
    L += [f"#### {proc.num}.6 Exceptions and unusual cases", ""] + [f"- {e}" for e in proc.exceptions] + [""]
    L += [f"#### {proc.num}.7 Records produced and where they go", ""]
    L += md_table(["Record", "Where it goes"], [list(r) for r in proc.records])
    L += [f"#### {proc.num}.8 How the platform supports this process", "", proc.platform, "", f"**Difference between the platform and the rule.** {proc.platform_diff}", ""]
    return L


# --------------------------------------------------------------------------------------
# Table of contents entries (shared by Word and Markdown)
# --------------------------------------------------------------------------------------


def toc_entries() -> list[tuple[int, str]]:
    e: list[tuple[int, str]] = [
        (1, "1 Purpose, scope and how to read this manual"),
        (1, "2 Roles and responsibilities"),
        (1, "3 Records and sources of record"),
        (1, "4 Process chapters"),
    ]
    e += [(2, f"{p.num} {p.title}") for p in PROCESSES]
    e += [
        (1, "5 Consolidated business rules register"),
        (1, "6 Open questions for validation"),
        (1, "7 Validation and sign-off"),
        (1, "Appendix A Forms named in the sources"),
        (1, "Appendix B Glossary"),
    ]
    return e


# --------------------------------------------------------------------------------------
# Word
# --------------------------------------------------------------------------------------


def build_docx(path: Path, toc_pages: dict[str, int] | None) -> None:
    from docx import Document
    from docx.enum.section import WD_SECTION  # noqa: F401
    from docx.enum.style import WD_STYLE_TYPE
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_TAB_ALIGNMENT, WD_TAB_LEADER
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Cm, Pt, RGBColor

    GREEN = "1F4E3D"
    GREY = "595959"
    STATUS_FILL = {"Official": "E2F0D9", "Practice": "FFF2CC", "Proposed": "DDEBF7"}
    HEADER_FILL = "1F4E3D"

    doc = Document()

    # ---- page setup (A4) ----
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)
    sec.left_margin = sec.right_margin = Cm(2.0)
    sec.top_margin, sec.bottom_margin = Cm(2.3), Cm(2.1)
    sec.header_distance, sec.footer_distance = Cm(1.0), Cm(0.9)
    sec.different_first_page_header_footer = True
    usable = 17.0

    # ---- styles ----
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10)
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
    normal.paragraph_format.space_after = Pt(5)
    normal.paragraph_format.line_spacing = 1.08

    def style_heading(name, size, color, before, after, page_break=False):
        st = styles[name]
        st.font.name = "Calibri"
        st.font.size = Pt(size)
        st.font.bold = True
        st.font.italic = False
        st.font.color.rgb = RGBColor.from_string(color)
        rfonts = st.element.rPr.rFonts
        for att in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
            rfonts.set(qn(att), "Calibri")
        for att in ("w:asciiTheme", "w:hAnsiTheme", "w:eastAsiaTheme", "w:cstheme"):
            if rfonts.get(qn(att)) is not None:
                del rfonts.attrib[qn(att)]
        st.paragraph_format.space_before = Pt(before)
        st.paragraph_format.space_after = Pt(after)
        st.paragraph_format.keep_with_next = True
        st.paragraph_format.page_break_before = page_break

    style_heading("Heading 1", 18, GREEN, 0, 10, page_break=True)
    style_heading("Heading 2", 14, GREEN, 6, 6, page_break=False)
    style_heading("Heading 3", 11, "2E2E2E", 10, 4)

    tt = styles.add_style("TableText", WD_STYLE_TYPE.PARAGRAPH)
    tt.base_style = normal
    tt.font.size = Pt(8)
    tt.paragraph_format.space_after = Pt(1)
    tt.paragraph_format.space_before = Pt(1)
    tt.paragraph_format.line_spacing = 1.0

    th = styles.add_style("TableHead", WD_STYLE_TYPE.PARAGRAPH)
    th.base_style = tt
    th.font.bold = True
    th.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

    for nm, ind in (("toc 1", 0.0), ("toc 2", 0.6)):
        st = styles.add_style(nm, WD_STYLE_TYPE.PARAGRAPH)
        st.base_style = normal
        st.paragraph_format.left_indent = Cm(ind)
        st.paragraph_format.space_after = Pt(2)
        st.paragraph_format.tab_stops.add_tab_stop(Cm(usable), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
        if nm == "toc 1":
            st.font.bold = True

    fh = styles.add_style("FrontHeading", WD_STYLE_TYPE.PARAGRAPH)
    fh.base_style = normal
    fh.font.size = Pt(18)
    fh.font.bold = True
    fh.font.color.rgb = RGBColor.from_string(GREEN)
    fh.paragraph_format.space_after = Pt(10)
    fh.paragraph_format.keep_with_next = True
    fh.paragraph_format.page_break_before = True

    cov_t = styles.add_style("CoverTitle", WD_STYLE_TYPE.PARAGRAPH)
    cov_t.base_style = normal
    cov_t.font.size = Pt(28)
    cov_t.font.bold = True
    cov_t.font.color.rgb = RGBColor.from_string(GREEN)
    cov_t.paragraph_format.space_after = Pt(8)
    cov_s = styles.add_style("CoverSub", WD_STYLE_TYPE.PARAGRAPH)
    cov_s.base_style = normal
    cov_s.font.size = Pt(14)
    cov_s.font.color.rgb = RGBColor.from_string(GREY)

    # ---- low-level helpers ----
    def shade(cell, fill):
        tcPr = cell._tc.get_or_add_tcPr()
        for old in tcPr.findall(qn("w:shd")):
            tcPr.remove(old)
        shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:color"), "auto")
        shd.set(qn("w:fill"), fill)
        tcPr.append(shd)

    def cell_margins(table, top=25, bottom=25, left=60, right=60):
        tblPr = table._tbl.tblPr
        mar = OxmlElement("w:tblCellMar")
        for side, val in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
            el = OxmlElement(f"w:{side}")
            el.set(qn("w:w"), str(val))
            el.set(qn("w:type"), "dxa")
            mar.append(el)
        tblPr.append(mar)

    def table_borders(table, color="BFBFBF"):
        tblPr = table._tbl.tblPr
        borders = OxmlElement("w:tblBorders")
        for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
            el = OxmlElement(f"w:{side}")
            el.set(qn("w:val"), "single")
            el.set(qn("w:sz"), "4")
            el.set(qn("w:space"), "0")
            el.set(qn("w:color"), color)
            borders.append(el)
        tblPr.append(borders)

    def fix_layout(table, widths):
        tblPr = table._tbl.tblPr
        lay = OxmlElement("w:tblLayout")
        lay.set(qn("w:type"), "fixed")
        tblPr.append(lay)
        for old in tblPr.findall(qn("w:tblW")):
            tblPr.remove(old)
        tw = OxmlElement("w:tblW")
        tw.set(qn("w:w"), str(int(sum(widths) * 567)))
        tw.set(qn("w:type"), "dxa")
        tblPr.insert(1, tw) if len(tblPr) else tblPr.append(tw)
        grid = table._tbl.tblGrid
        for gc, w in zip(grid.findall(qn("w:gridCol")), widths):
            gc.set(qn("w:w"), str(int(w * 567)))
        for row in table.rows:
            for c, w in zip(row.cells, widths):
                c.width = Cm(w)

    def clear_default_tabs(paragraph):
        pPr = paragraph._p.get_or_add_pPr()
        tabs = pPr.find(qn("w:tabs"))
        if tabs is None:
            tabs = OxmlElement("w:tabs")
            pPr.append(tabs)
        for pos in ("4680", "9360"):
            tab = OxmlElement("w:tab")
            tab.set(qn("w:val"), "clear")
            tab.set(qn("w:pos"), pos)
            tabs.append(tab)

    def repeat_header(row):
        trPr = row._tr.get_or_add_trPr()
        el = OxmlElement("w:tblHeader")
        el.set(qn("w:val"), "true")
        trPr.append(el)

    def cant_split(row):
        trPr = row._tr.get_or_add_trPr()
        el = OxmlElement("w:cantSplit")
        el.set(qn("w:val"), "true")
        trPr.append(el)

    def row_height(row, cm):
        trPr = row._tr.get_or_add_trPr()
        el = OxmlElement("w:trHeight")
        el.set(qn("w:val"), str(int(cm * 567)))
        el.set(qn("w:hRule"), "atLeast")
        trPr.append(el)

    def set_text(cell, text, style="TableText", bold=False, color=None):
        cell.text = ""
        parts = str(text).split("\n") if text is not None else [""]
        for i, part in enumerate(parts):
            p = cell.paragraphs[0] if i == 0 else cell.add_paragraph()
            p.style = styles[style]
            r = p.add_run(part)
            if bold:
                r.bold = True
            if color:
                r.font.color.rgb = RGBColor.from_string(color)

    def add_table(header, rows, widths, status_col=None, bold_first=False, header_repeat=True, split_ok=False):
        t = doc.add_table(rows=1, cols=len(header))
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        table_borders(t)
        cell_margins(t)
        for i, h in enumerate(header):
            set_text(t.rows[0].cells[i], h, style="TableHead")
            shade(t.rows[0].cells[i], HEADER_FILL)
        if header_repeat:
            repeat_header(t.rows[0])
        cant_split(t.rows[0])
        for row in rows:
            cells = t.add_row().cells
            for i, val in enumerate(row):
                set_text(cells[i], val, bold=(bold_first and i == 0))
                if status_col is not None and i == status_col and val in STATUS_FILL:
                    shade(cells[i], STATUS_FILL[val])
                    for r_ in cells[i].paragraphs[0].runs:
                        r_.bold = True
            if not split_ok:
                cant_split(t.rows[-1])
        fix_layout(t, widths)
        sp = doc.add_paragraph()
        sp.paragraph_format.space_after = Pt(4)
        sp.paragraph_format.space_before = Pt(0)
        for r_ in sp.runs:
            r_.font.size = Pt(2)
        return t

    def para(text, style=None, bold=False, italic=False, size=None, color=None, align=None, after=None):
        p = doc.add_paragraph(style=style)
        r = p.add_run(text)
        r.bold = bold
        r.italic = italic
        if size:
            r.font.size = Pt(size)
        if color:
            r.font.color.rgb = RGBColor.from_string(color)
        if align is not None:
            p.alignment = align
        if after is not None:
            p.paragraph_format.space_after = Pt(after)
        return p

    def bullets(items):
        for it in items:
            p = doc.add_paragraph(style="List Bullet")
            p.paragraph_format.space_after = Pt(2)
            p.add_run(it)

    def heading(text, level):
        return doc.add_heading(text, level=level)

    def add_field(paragraph, instr, result_text="1"):
        def r_with(child):
            r = paragraph.add_run()
            r._r.append(child)
            return r
        b = OxmlElement("w:fldChar")
        b.set(qn("w:fldCharType"), "begin")
        r_with(b)
        it = OxmlElement("w:instrText")
        it.set(qn("xml:space"), "preserve")
        it.text = f" {instr} "
        r_with(it)
        s = OxmlElement("w:fldChar")
        s.set(qn("w:fldCharType"), "separate")
        r_with(s)
        paragraph.add_run(result_text)
        e = OxmlElement("w:fldChar")
        e.set(qn("w:fldCharType"), "end")
        r_with(e)

    def box(text, fill="FFF2CC", border="BF9000", size=9.5, bold_lead=None):
        t = doc.add_table(rows=1, cols=1)
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        tblPr = t._tbl.tblPr
        borders = OxmlElement("w:tblBorders")
        for side in ("top", "left", "bottom", "right"):
            el = OxmlElement(f"w:{side}")
            el.set(qn("w:val"), "single")
            el.set(qn("w:sz"), "8")
            el.set(qn("w:space"), "0")
            el.set(qn("w:color"), border)
            borders.append(el)
        tblPr.append(borders)
        cell_margins(t, 90, 90, 140, 140)
        c = t.rows[0].cells[0]
        shade(c, fill)
        c.text = ""
        p = c.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        if bold_lead and text.startswith(bold_lead):
            r = p.add_run(bold_lead)
            r.bold = True
            r.font.size = Pt(size)
            r2 = p.add_run(text[len(bold_lead):])
            r2.font.size = Pt(size)
        else:
            r = p.add_run(text)
            r.font.size = Pt(size)
        fix_layout(t, [usable])
        cant_split(t.rows[0])
        p.paragraph_format.keep_with_next = True
        sp = doc.add_paragraph()
        sp.paragraph_format.space_after = Pt(4)
        sp.paragraph_format.keep_with_next = True

    # ---- header and footer ----
    hdr = sec.header
    hp = hdr.paragraphs[0]
    hp.text = ""
    clear_default_tabs(hp)
    hp.paragraph_format.tab_stops.add_tab_stop(Cm(usable), WD_TAB_ALIGNMENT.RIGHT)
    r = hp.add_run("USLS Graduate School Operations Manual")
    r.font.size = Pt(8.5)
    r.font.color.rgb = RGBColor.from_string(GREY)
    r = hp.add_run("\tDRAFT v0.1 for validation")
    r.font.size = Pt(8.5)
    r.bold = True
    r.font.color.rgb = RGBColor.from_string("C00000")
    pPr = hp._p.get_or_add_pPr()
    bd = OxmlElement("w:pBdr")
    bt = OxmlElement("w:bottom")
    bt.set(qn("w:val"), "single")
    bt.set(qn("w:sz"), "6")
    bt.set(qn("w:space"), "1")
    bt.set(qn("w:color"), GREEN)
    bd.append(bt)
    pPr.append(bd)

    ftr = sec.footer
    fp = ftr.paragraphs[0]
    fp.text = ""
    clear_default_tabs(fp)
    fp.paragraph_format.tab_stops.add_tab_stop(Cm(usable), WD_TAB_ALIGNMENT.RIGHT)
    r = fp.add_run("Not an official USLS document until approved by the Graduate School")
    r.font.size = Pt(8)
    r.font.color.rgb = RGBColor.from_string(GREY)
    r = fp.add_run("\tPage ")
    r.font.size = Pt(8.5)
    add_field(fp, "PAGE")
    r = fp.add_run(" of ")
    r.font.size = Pt(8.5)
    add_field(fp, "NUMPAGES", "60")
    for run in fp.runs:
        run.font.size = Pt(8.5)

    # ---- cover ----
    for _ in range(5):
        doc.add_paragraph()
    para("UNIVERSITY OF ST. LA SALLE", style="CoverSub", bold=True, color=GREEN)
    para("Graduate School", style="CoverSub")
    doc.add_paragraph()
    para("Graduate School Operations Manual", style="CoverTitle", bold=True)
    para("How the Graduate School carries out the student lifecycle: roles, records, procedures and business rules", style="CoverSub")
    doc.add_paragraph()
    doc.add_paragraph()
    box(front.COVER_MARK, fill="FDE9E7", border="C00000", size=12, bold_lead="DRAFT v0.1")
    doc.add_paragraph()
    para(f"Version {front.VERSION}  |  {front.DOC_DATE}", style="CoverSub")
    para("Prepared by the capstone group CAP-IT1 (Graduate Student Lifecycle Monitoring and Analytics Platform)", style="CoverSub")
    para("To be validated by the Graduate School Dean and Associate Dean", style="CoverSub")

    # ---- document control ----
    para("Document control", style="FrontHeading")
    add_table(["Item", "Detail"], front.CONTROL_ROWS, [4.0, 13.0], bold_first=True)
    para("Counts in this draft", bold=True)
    counts = rule_counts()
    add_table(["Rules", "Official", "Practice", "Proposed", "Open questions"],
              [[str(sum(counts.values())), str(counts["Official"]), str(counts["Practice"]), str(counts["Proposed"]), str(len(questions.QUESTIONS))]],
              [3.4, 3.4, 3.4, 3.4, 3.4])

    # ---- table of contents (field + stored entries) ----
    para("Table of contents", style="FrontHeading")
    entries = toc_entries()
    for idx, (lvl, text) in enumerate(entries):
        p = doc.add_paragraph(style="toc 1" if lvl == 1 else "toc 2")
        if idx == 0:
            b = OxmlElement("w:fldChar")
            b.set(qn("w:fldCharType"), "begin")
            b.set(qn("w:dirty"), "true")
            rr = p.add_run()
            rr._r.append(b)
            it = OxmlElement("w:instrText")
            it.set(qn("xml:space"), "preserve")
            it.text = ' TOC \\o "1-2" \\h \\z \\u '
            rr = p.add_run()
            rr._r.append(it)
            s = OxmlElement("w:fldChar")
            s.set(qn("w:fldCharType"), "separate")
            rr = p.add_run()
            rr._r.append(s)
        p.add_run(text)
        pg = toc_pages.get(text) if toc_pages else None
        p.add_run("\t" + (str(pg) if pg else ""))
        if idx == len(entries) - 1:
            e = OxmlElement("w:fldChar")
            e.set(qn("w:fldCharType"), "end")
            rr = p.add_run()
            rr._r.append(e)
    note = para("The page numbers update when the file is opened in Word (answer Yes to the prompt to update fields, or press F9 after selecting the contents).", italic=True, size=8.5, color=GREY)

    # ---- chapter 1 ----
    def render_blocks(blocks):
        for b in blocks:
            if "h2" in b:
                heading(b["h2"], 2)
            elif "h3" in b:
                heading(b["h3"], 3)
            elif "p" in b:
                para(b["p"])
            elif "bullets" in b:
                bullets(b["bullets"])
            elif "table" in b:
                t = b["table"]
                add_table(t["header"], t["rows"], t["widths"], status_col=0 if t["header"][0] == "Status" else None)

    heading("1 Purpose, scope and how to read this manual", 1)
    render_blocks(front.CH1)

    # ---- chapter 2 ----
    heading("2 Roles and responsibilities", 1)
    para("This chapter names the roles that appear in the procedures. Responsibilities are taken from the Handbook and the Research Protocol; where an office's routine is described only in consultation, the sentence says so.")
    heading("2.1 Graduate School roles", 2)
    add_table(front.ROLES_HEADER, front.ROLES, [3.2, 9.8, 4.0], bold_first=True, split_ok=True)
    heading("2.2 External offices and what is handed to them", 2)
    add_table(front.EXTERNAL_HEADER, front.EXTERNAL, [3.0, 4.6, 5.6, 3.8], bold_first=True, split_ok=True)

    # ---- chapter 3 ----
    heading("3 Records and sources of record", 1)
    para(front.CH3_INTRO)
    heading("3.1 Records the office maintains", 2)
    add_table(front.RECORDS_HEADER, front.RECORDS, [3.6, 2.8, 7.6, 3.0], bold_first=True, split_ok=True)
    heading("3.2 Official source for each kind of data", 2)
    para("AIMS and the University Registrar are the official record for enrollment and grades. The platform is a monitoring and coordination layer: it records what the Graduate School decides and tracks, and it does not replace the official record.")
    add_table(front.SOURCE_OF_RECORD_HEADER, front.SOURCE_OF_RECORD, [4.0, 4.4, 8.6], bold_first=True, split_ok=True)
    render_blocks(front.CH3_NOTES)

    # ---- chapter 4 ----
    heading("4 Process chapters", 1)
    para(CH4_INTRO)
    add_table(["Section", "Process", "Rule prefix", "Rules"],
              [[p.num, p.title, p.key, str(len(p.rules))] for p in PROCESSES], [2.0, 10.6, 2.4, 2.0])

    for proc in PROCESSES:
        h = heading(f"{proc.num} {proc.title}", 2)
        h.paragraph_format.space_before = Pt(18)
        if proc.callout:
            box(proc.callout, bold_lead="Panel question:")
        n = proc.num
        heading(f"{n}.1 Purpose", 3)
        para(proc.purpose)
        heading(f"{n}.2 Who is involved", 3)
        para("; ".join(proc.who) + ".")
        heading(f"{n}.3 Trigger and preconditions", 3)
        p = para("")
        p.runs[0].text = "Trigger. "
        p.runs[0].bold = True
        p.add_run(proc.trigger)
        p = para("")
        p.runs[0].text = "Preconditions."
        p.runs[0].bold = True
        bullets(proc.preconditions)
        heading(f"{n}.4 Procedure", 3)
        add_table(["Step", "Who", "What they do", "Form / record", "Time limit"],
                  step_rows(proc), [1.0, 2.9, 7.2, 3.1, 2.8], split_ok=False)
        if STEP_FLAGS.get(proc.num):
            para(STEP_NOTE.format(n=proc.num), italic=True, size=8.5, color=GREY)
        for extra in proc.extras:
            para(extra["title"], bold=True)
            add_table(extra["header"], extra["rows"], [3.2, 6.6, 3.8, 3.4])
        heading(f"{n}.5 Business rules", 3)
        add_table(["Rule", "Rule statement", "Source", "Status"],
                  [[r_.rid, r_.text, r_.source_text(), r_.status] for r_ in proc.rules],
                  [1.6, 8.0, 5.3, 2.1], status_col=3, bold_first=True)
        heading(f"{n}.6 Exceptions and unusual cases", 3)
        bullets(proc.exceptions)
        heading(f"{n}.7 Records produced and where they go", 3)
        add_table(["Record", "Where it goes"], [list(r_) for r_ in proc.records], [8.0, 9.0])
        heading(f"{n}.8 How the platform supports this process", 3)
        para(proc.platform)
        p = para("")
        p.runs[0].text = "Difference between the platform and the rule. "
        p.runs[0].bold = True
        p.add_run(proc.platform_diff)

    # ---- chapter 5 ----
    heading("5 Consolidated business rules register", 1)
    para(CH5_INTRO)
    counts = rule_counts()
    add_table(["Status", "Number of rules", "Meaning"],
              [["Official", str(counts["Official"]), "Stated in the Handbook or the Research Protocol"],
               ["Practice", str(counts["Practice"]), "Described by staff in consultation; to be confirmed"],
               ["Proposed", str(counts["Proposed"]), "The group's proposal; to be confirmed"],
               ["Total", str(sum(counts.values())), ""]],
              [3.0, 3.6, 10.4], status_col=0)
    add_table(["Rule", "Process", "Rule statement", "Source", "Status"],
              [[r_.rid, SHORT[r_.process_num], r_.text, r_.source_text(), r_.status] for r_ in all_rules()],
              [1.5, 2.3, 7.4, 4.2, 1.6], status_col=4, bold_first=True)

    # ---- chapter 6 ----
    heading("6 Open questions for validation", 1)
    para(CH6_INTRO)
    summary = [[q["id"], q["topic"], q["kind"]] for q in questions.QUESTIONS]
    heading("6.1 List of questions", 2)
    add_table(["No.", "Topic", "Kind"], summary, [1.8, 12.2, 3.0])
    heading("6.2 Questions in detail", 2)
    for q in questions.QUESTIONS:
        t = doc.add_table(rows=0, cols=2)
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        table_borders(t, "7F7F7F")
        cell_margins(t)
        head = t.add_row().cells
        head[0].merge(head[1])
        set_text(head[0], f"{q['id']}  {q['topic']}", style="TableHead")
        shade(head[0], HEADER_FILL)
        repeat_header(t.rows[0])
        rows = [
            ("Kind", q["kind"]),
            ("What the sources say", "\n".join("\u2022 " + s for s in q["says"])),
            ("Question", q["question"]),
            ("Options", "\n".join(q["options"])),
            ("Affects rules", ", ".join(q["affects"]) or "None"),
            ("Stakeholder's answer", ""),
            ("Decided by / date", ""),
        ]
        for lab, val in rows:
            cells = t.add_row().cells
            set_text(cells[0], lab, bold=True)
            shade(cells[0], "F2F2F2")
            set_text(cells[1], val)
            cant_split(t.rows[-1])
            if lab == "Stakeholder's answer":
                row_height(t.rows[-1], 1.8)
            if lab == "Decided by / date":
                row_height(t.rows[-1], 0.7)
        fix_layout(t, [3.4, 13.6])
        for row in t.rows[:2]:
            for c in row.cells:
                for p_ in c.paragraphs:
                    p_.paragraph_format.keep_with_next = True
        sp = doc.add_paragraph()
        sp.paragraph_format.space_after = Pt(6)

    # ---- chapter 7 ----
    heading("7 Validation and sign-off", 1)
    para(CH7_INTRO)
    heading("7.1 Sign-off", 2)
    t = add_table(front.SIGNOFF_HEADER, [[""] * 5 for _ in range(front.SIGNOFF_ROWS)], [3.6, 3.2, 2.2, 3.4, 4.6])
    for row in t.rows[1:]:
        row_height(row, 1.1)
    heading("7.2 Change log", 2)
    add_table(front.CHANGELOG_HEADER, front.CHANGELOG, [1.6, 2.4, 3.2, 7.4, 2.4])

    # ---- appendices ----
    heading("Appendix A Forms named in the sources", 1)
    para("Forms named in the Handbook and the Research Protocol, with the process step in which each is used. The blank forms were not supplied to the group except where stated.")
    add_table(front.FORMS_HEADER, front.FORMS, [3.6, 7.0, 2.6, 3.8], bold_first=True)
    heading("Appendix B Glossary", 1)
    add_table(["Term", "Meaning"], [[a, b] for a, b in front.GLOSSARY], [3.6, 13.4], bold_first=True)

    # ---- settings: ask Word to update fields (table of contents) on open ----
    settings = doc.settings.element
    uf = OxmlElement("w:updateFields")
    uf.set(qn("w:val"), "true")
    later = {"hdrShapeDefaults", "footnotePr", "endnotePr", "compat", "docVars", "rsids", "mathPr",
             "attachedSchema", "themeFontLang", "clrSchemeMapping", "doNotIncludeSubdocsInStats",
             "doNotAutoCompressPictures", "forceUpgrade", "captions", "readModeInkLockDown", "smartTagType",
             "schemaLibrary", "shapeDefaults", "doNotEmbedSmartTags", "decimalSymbol", "listSeparator"}
    anchor = None
    for child in settings:
        if child.tag.split("}")[1] in later:
            anchor = child
            break
    if anchor is not None:
        anchor.addprevious(uf)
    else:
        settings.append(uf)

    # ---- put schema-ordered children in order (python-docx appends; Word wants the schema order) ----
    TBLPR_ORDER = ["tblStyle", "tblpPr", "tblOverlap", "bidiVisual", "tblStyleRowBandSize", "tblStyleColBandSize",
                   "tblW", "jc", "tblCellSpacing", "tblInd", "tblBorders", "shd", "tblLayout", "tblCellMar", "tblLook",
                   "tblCaption", "tblDescription"]
    PPR_ORDER = ["pStyle", "keepNext", "keepLines", "pageBreakBefore", "framePr", "widowControl", "numPr",
                 "suppressLineNumbers", "pBdr", "shd", "tabs", "suppressAutoHyphens", "kinsoku", "wordWrap",
                 "overflowPunct", "topLinePunct", "autoSpaceDE", "autoSpaceDN", "bidi", "adjustRightInd", "snapToGrid",
                 "spacing", "ind", "contextualSpacing", "mirrorIndents", "suppressOverlap", "jc", "textDirection",
                 "textAlignment", "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr", "pPrChange"]

    def reorder(el, order):
        def key(child):
            name = child.tag.split("}")[1]
            return order.index(name) if name in order else len(order)
        kids = list(el)
        kids_sorted = sorted(kids, key=key)
        if kids != kids_sorted:
            for k in kids:
                el.remove(k)
            for k in kids_sorted:
                el.append(k)

    roots = [doc.element.body, sec.header._element, sec.footer._element, doc.styles.element]
    for root in roots:
        for tblPr in root.iter(qn("w:tblPr")):
            reorder(tblPr, TBLPR_ORDER)
        for pPr in root.iter(qn("w:pPr")):
            reorder(pPr, PPR_ORDER)
    for zoom in settings.iter(qn("w:zoom")):
        if zoom.get(qn("w:percent")) is None:
            zoom.set(qn("w:percent"), "100")

    cp = doc.core_properties
    cp.title = front.TITLE + " (DRAFT v0.1 for validation)"
    cp.subject = "Operations manual draft for validation by the Graduate School"
    cp.author = "Capstone group CAP-IT1"
    cp.comments = front.COVER_MARK
    cp.keywords = "USLS, Graduate School, operations manual, business rules, draft"

    doc.save(str(path))


# --------------------------------------------------------------------------------------
# PDF rendering and table-of-contents page numbers
# --------------------------------------------------------------------------------------


def render_pdf(docx_path: Path, out_dir: Path) -> Path:
    cmd = [str(SOFFICE), f"-env:UserInstallation={LO_PROFILE}", "--headless", "--convert-to", "pdf", "--outdir", str(out_dir), str(docx_path)]
    res = subprocess.run(cmd, capture_output=True, text=True)
    pdf = out_dir / (docx_path.stem + ".pdf")
    if not pdf.exists():
        raise RuntimeError(f"PDF conversion failed: {res.stdout}\n{res.stderr}")
    return pdf


def heading_pages(pdf_path: Path) -> dict[str, int]:
    import fitz  # PyMuPDF

    doc = fitz.open(str(pdf_path))
    texts = [page.get_text() for page in doc]
    # find where the table of contents ends: the first page that holds "1 Purpose, scope" as a heading
    # after the contents page
    toc_page = next((i for i, t in enumerate(texts) if "Table of contents" in t), 0)
    pages: dict[str, int] = {}
    for _lvl, text in toc_entries():
        needle = text
        for i in range(toc_page + 1, len(texts)):
            lines = [ln.strip() for ln in texts[i].splitlines()]
            # a heading line, and not a TOC line (TOC lines hold a tab/number)
            if needle in lines:
                pages[text] = i + 1
                break
    return pages


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", action="store_true", help="also render a PDF with LibreOffice and fill the table of contents page numbers")
    ap.add_argument("--out-dir", default=str(OUT_DIR))
    args = ap.parse_args()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    docx_path = out_dir / f"{STEM}.docx"
    md_path = out_dir / f"{STEM}.md"
    json_path = out_dir / "operations_manual_rules.json"

    md_path.write_text(build_markdown(), encoding="utf-8")
    json_path.write_text(json.dumps(rules_json(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    toc_pages = None
    build_docx(docx_path, toc_pages)
    if args.pdf:
        pdf = render_pdf(docx_path, out_dir)
        toc_pages = heading_pages(pdf)
        missing = [t for _l, t in toc_entries() if t not in toc_pages]
        if missing:
            print("WARNING: headings not found in PDF:", missing)
        build_docx(docx_path, toc_pages)
        pdf = render_pdf(docx_path, out_dir)
        import fitz
        print(f"PDF pages: {len(fitz.open(str(pdf)))}")
    counts = rule_counts()
    print(f"Wrote {docx_path.name}, {md_path.name}, {json_path.name}; rules {sum(counts.values())} {counts}; questions {len(questions.QUESTIONS)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
