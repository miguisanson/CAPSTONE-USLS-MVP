#!/usr/bin/env python
"""Add the business-rules sections and the Operations Manual appendix to the proposal.

    python scripts/docs/add_business_rules_section.py IN.docx OUT.docx

The panel asked the group to "Document Existing Business Rules/Policies and Proposed Business
Rules/Policies (if any)" and to include the policies of the operations manual.  The script adds

  * Section 4.5  Existing Business Rules and Policies   (end of Chapter 4, The Existing System)
  * Section 5.14 Proposed Business Rules and Policies   (end of Chapter 5, The Proposed System)
  * Appendix AA  Graduate School Operations Manual (Draft for Validation)   (end of the document)

Content is read, never typed:
  * business_rules_catalog.py (repository root)           -> Section 5.14 (proposed = what the portal
                                                              enforces or records, enforced vs documented only,
                                                              rules awaiting validation)
  * Documents/CAPSTONE_ONLY/operations_manual_rules.json  -> Section 4.5 (existing rules: Official and Practice)
                                                              and the further Proposed rules in Section 5.14.3

Idempotent: every block is wrapped by a pair of zero-width bookmarks (BizRules<Part>_begin /
BizRules<Part>_end).  Running the script again removes its own blocks first and writes them anew, so it can be
re-run after the catalog, the manual or the rules JSON change.  Nothing else in the document is touched.
After running it, run scripts/docs/build_proposal.py so that the table of contents, the list of tables and
the chapter-page labels are recalculated.

Tables are numbered with a decimal sub-number after the last table of the chapter (Table 20.1 ... after
Table 20, Table 25.1 ... after Table 25), the same scheme the document already uses for Tables 3.1-3.9 and
15.1-15.2.  This keeps every existing table number and every reference to it valid.
"""
from __future__ import annotations

import argparse
import copy
import json
import re
import sys
import zipfile
from collections import Counter, OrderedDict
from pathlib import Path
from xml.sax.saxutils import escape

from lxml import etree

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(HERE))

import business_rules_catalog as catalog  # noqa: E402
from opsmanual import questions as manual_questions  # noqa: E402

RULES_JSON = ROOT / "Documents" / "CAPSTONE_ONLY" / "operations_manual_rules.json"

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W}
TNR = '<w:rFonts w:ascii="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman"/>'

# Where each part goes.  (anchor heading text, where to insert relative to it)
CH4_NEXT = "The Proposed System"          # Heading 1 that follows Chapter 4
CH5_NEXT = "System Testing"               # Heading 1 that follows Chapter 5
APPENDIX_LAST = "Appendix Z."             # last appendix heading

APPENDIX_LABEL = "Appendix AA"
MANUAL_TITLE = "Graduate School Operations Manual (Draft for Validation)"
MANUAL_FILES = [
    "USLS GS Operations Manual - DRAFT for Validation.docx",
    "USLS GS Operations Manual - DRAFT for Validation.pdf",
    "USLS GS Operations Manual - DRAFT for Validation.md",
    "operations_manual_rules.json",
]

CH4_TABLE_BASE = "20"    # Table 20.1, 20.2 ...   (last numbered table of Chapter 4 is Table 20)
CH5_TABLE_BASE = "25"    # Table 25.1, 25.2 ...   (last numbered table of Chapter 5 is Table 25)


# --------------------------------------------------------------------------- XML builders
def esc(text) -> str:
    return escape(str(text))


def run(text, *, bold=False, italic=False, size=24, color=None) -> str:
    props = TNR
    if bold:
        props += '<w:b w:val="1"/><w:bCs w:val="1"/>'
    if italic:
        props += '<w:i w:val="1"/><w:iCs w:val="1"/>'
    if color:
        props += f'<w:color w:val="{color}"/>'
    props += f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>'
    return f'<w:r><w:rPr>{props}</w:rPr><w:t xml:space="preserve">{esc(text)}</w:t></w:r>'


def runs(parts, size=24) -> str:
    """parts: a string, or a list of strings / (text, 'b'|'i') tuples."""
    if isinstance(parts, str):
        parts = [parts]
    out = []
    for part in parts:
        if isinstance(part, tuple):
            out.append(run(part[0], bold="b" in part[1], italic="i" in part[1], size=size))
        else:
            out.append(run(part, size=size))
    return "".join(out)


def body_para(parts) -> str:
    return (
        '<w:p><w:pPr><w:spacing w:after="120" w:line="360" w:lineRule="auto"/><w:ind w:firstLine="720"/>'
        f'<w:jc w:val="both"/><w:rPr>{TNR}<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr>{runs(parts)}</w:p>'
    )


def marker(name, bid, kind) -> str:
    """Zero-width bookmark marker (collapsed bookmark, or only the end half)."""
    if kind == "pair":
        return f'<w:bookmarkStart w:id="{bid}" w:name="{name}"/><w:bookmarkEnd w:id="{bid}"/>'
    return ""


def heading(level, text, marker_xml="") -> str:
    if level == 2:
        ppr = '<w:pStyle w:val="Heading2"/><w:spacing w:after="240" w:before="240" w:line="276" w:lineRule="auto"/><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>'
    elif level == 3:
        ppr = '<w:pStyle w:val="Heading3"/><w:spacing w:line="276" w:lineRule="auto"/><w:rPr/>'
    else:
        ppr = '<w:pStyle w:val="Heading4"/><w:spacing w:line="276" w:lineRule="auto"/><w:rPr/>'
    return f'<w:p><w:pPr>{ppr}</w:pPr>{marker_xml}<w:r><w:rPr><w:rtl w:val="0"/></w:rPr><w:t xml:space="preserve">{esc(text)}</w:t></w:r></w:p>'


def caption(text) -> str:
    return (
        '<w:p><w:pPr><w:pStyle w:val="Heading5"/><w:keepNext/><w:spacing w:before="120" w:line="276" w:lineRule="auto"/><w:rPr/></w:pPr>'
        f'<w:r><w:rPr><w:rtl w:val="0"/></w:rPr><w:t xml:space="preserve">{esc(text)}</w:t></w:r></w:p>'
    )


def spacer(marker_xml="") -> str:
    return (
        '<w:p><w:pPr><w:spacing w:after="120" w:line="240" w:lineRule="auto"/>'
        f'<w:rPr>{TNR}<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr>{marker_xml}</w:p>'
    )


def page_break(marker_xml="") -> str:
    return (
        f'<w:p><w:pPr><w:spacing w:line="240" w:lineRule="auto"/><w:rPr>{TNR}</w:rPr></w:pPr>{marker_xml}'
        '<w:r><w:br w:type="page"/></w:r></w:p>'
    )


STATUS_FILL = {"Official": "E2F0D9", "Practice": "FFF2CC", "Proposed": "DDEBF7",
               "Enforced": "E2F0D9", "Documented only": "F2F2F2", "Needs review": "FFF2CC", "Active": None}


def cell(paragraphs, width, *, header=False, fill=None, size=18) -> str:
    """paragraphs: list of part-lists (each becomes one paragraph in the cell)."""
    shade = ""
    if header:
        shade = '<w:shd w:fill="d9d9d9" w:val="clear"/>'
    elif fill:
        shade = f'<w:shd w:fill="{fill}" w:val="clear"/>'
    body = []
    for parts in paragraphs:
        if isinstance(parts, str):
            parts = [parts]
        rendered = []
        for part in parts:
            if isinstance(part, tuple):
                flags = part[1]
                rendered.append(run(part[0], bold=header or "b" in flags, italic="i" in flags, size=size if "s" not in flags else size - 2,
                                    color="595959" if "g" in flags else None))
            else:
                rendered.append(run(part, bold=header, size=size))
        body.append(
            f'<w:p><w:pPr>{"<w:keepNext/>" if header else ""}<w:widowControl w:val="0"/><w:spacing w:after="20" w:line="240" w:lineRule="auto"/>'
            f'<w:rPr>{TNR}<w:sz w:val="{size}"/><w:szCs w:val="{size}"/></w:rPr></w:pPr>{"".join(rendered)}</w:p>'
        )
    return (
        f'<w:tc><w:tcPr><w:tcW w:w="{width}" w:type="dxa"/>{shade}'
        '<w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>'
        f'<w:vAlign w:val="top"/></w:tcPr>{"".join(body)}</w:tc>'
    )


def table(header, rows, widths, fills=None, size=18) -> str:
    """rows: list of rows; each cell is a list of paragraphs (see cell()).  fills: {col_index: fn(row)->hex|None}."""
    assert sum(widths) == 9360, sum(widths)
    fills = fills or {}
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    out = [
        '<w:tbl><w:tblPr><w:tblStyle w:val="Table28"/><w:tblW w:w="9360" w:type="dxa"/><w:jc w:val="center"/>'
        '<w:tblBorders>'
        + "".join(f'<w:{side} w:color="000000" w:space="0" w:sz="8" w:val="single"/>'
                  for side in ("top", "left", "bottom", "right", "insideH", "insideV"))
        + '</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblLook w:val="0600"/></w:tblPr>'
        f'<w:tblGrid>{grid}</w:tblGrid>'
    ]
    out.append('<w:tr><w:trPr><w:cantSplit w:val="1"/><w:tblHeader w:val="1"/></w:trPr>'
               + "".join(cell([[h]], w, header=True, size=size) for h, w in zip(header, widths)) + "</w:tr>")
    for row in rows:
        cells = []
        for idx, (content, w) in enumerate(zip(row, widths)):
            fill = fills[idx](row) if idx in fills else None
            cells.append(cell(content, w, fill=fill, size=size))
        out.append('<w:tr><w:trPr><w:cantSplit w:val="1"/></w:trPr>' + "".join(cells) + "</w:tr>")
    out.append("</w:tbl>")
    return "".join(out)


def para_cells(*texts):
    """Helper: each argument becomes one single-paragraph cell."""
    return [[[t]] if isinstance(t, (str, tuple)) else t for t in texts]


# --------------------------------------------------------------------------- source data
def load_manual_rules():
    data = json.loads(RULES_JSON.read_text(encoding="utf-8"))
    by_process = OrderedDict()
    for rule in data["rules"]:
        by_process.setdefault((rule["process_section"], rule["process"]), []).append(rule)
    return data, by_process


def catalog_by_process():
    groups = OrderedDict((key, []) for key, _ in catalog.BUSINESS_RULE_PROCESSES)
    for item in catalog.BUSINESS_RULE_CATALOG:
        groups[item["process"]].append(item)
    return groups


def value_text(item) -> str:
    value = item["value"]
    if item["value_type"] == "bool":
        return "Yes" if value == "true" else "No"
    unit = item.get("unit") or ""
    if value == "1" and unit.endswith("s"):
        unit = unit[:-1]
    return f"{value} {unit}" if unit else value


def source_text(item) -> str:
    title = item["source_title"]
    if title == catalog.PROTOTYPE:
        return "Prototype rule; no official source (pending Graduate School validation)"
    short = {catalog.HANDBOOK: "Handbook 2022-2023", catalog.PROTOCOL: "Research Protocol AY 2024-2025"}.get(title, title)
    bits = [short]
    if item.get("source_section"):
        bits.append(item["source_section"])
    if item.get("source_page"):
        page = item["source_page"]
        bits.append(("pp. " if ("-" in page or "," in page) else "p. ") + page)
    return "; ".join(bits)


def breakable(key: str) -> str:
    """Let Word break a long register key after a dot or an underscore."""
    zero_width_space = "​"
    return key.replace("_", "_" + zero_width_space).replace(".", "." + zero_width_space)


NUMBER_WORDS = {1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten"}


def plural(n, word):
    return f"{n} {word}" + ("" if n == 1 else "s")


# --------------------------------------------------------------------------- section builders
def build_section_4_5(data, by_process, ids):
    counts = data["counts"]
    n_off, n_pr = counts["Official"], counts["Practice"]
    n_existing = n_off + n_pr
    n_proc = len(by_process)
    n_questions = len(manual_questions.QUESTIONS)
    out = []
    out.append(heading(2, "4.5 Existing Business Rules and Policies", marker("BizRulesExisting_begin", ids[0], "pair")))
    out.append(body_para(
        "At the Stage 1 defense the panel asked the group to document the existing business rules and policies and the "
        "proposed ones, and to include the policies of the operations manual. This section answers the first part. It "
        "lists the rules that govern the graduate student lifecycle today, process by process in lifecycle order, "
        "before any system support is added. The proposed rules, which the Graduate School Lifecycle Portal enforces or "
        "records, are in Section 5.14."))
    out.append(body_para(
        "The Graduate School has no operations manual of its own. Its policies are written in the Graduate Programs "
        "Student Handbook 2022-2023, which the group treats as the document in force, and in the Graduate School Research "
        "Protocol AY 2024-2025. The routines that connect the steps were described by Graduate School staff in "
        "consultations held in July 2026 and are written nowhere. To bring the two together the group drafted a Graduate "
        f"School Operations Manual ({APPENDIX_LABEL}). This section reproduces the existing rules of that draft: "
        f"{n_off} rules that the Handbook or the Protocol states, labelled Official, and {n_pr} rules that staff described "
        "in consultation but that no official document states, labelled Practice. "
        f"They are grouped in {n_proc} processes, from admission to the records handoff to the Registrar."))
    out.append(body_para(
        f"Where the Handbook and the Protocol differ from each other, or from practice, this section does not choose. The "
        f"Operations Manual records each difference as an open question ({n_questions} in the current draft), and the "
        "portal follows the Handbook until the Graduate School answers. The draft has not yet been validated by the "
        "Graduate School: the Practice rules in particular are statements by staff that the Dean and the Associate Dean "
        "still have to confirm or correct."))

    out.append(heading(3, "4.5.1 Sources and Labels"))
    out.append(body_para(
        "Every rule is shown with the document and the page or section it comes from, and with one of two labels. "
        f"Table {CH4_TABLE_BASE}.1 explains the labels and gives the number of rules of each kind."))
    out.append(caption(f"Table {CH4_TABLE_BASE}.1. Labels used for existing business rules"))
    out.append(table(
        ["Label", "Meaning", "Source shown", "Rules"],
        [
            [[["Official"]], [["Stated in the Graduate Programs Student Handbook 2022-2023 or in the Graduate School Research Protocol AY 2024-2025. The wording is quoted or closely paraphrased."]],
             [["Handbook page number, or Protocol section heading (the Protocol copy has no page numbers)."]], [[str(n_off)]]],
            [[["Practice"]], [["Described by Graduate School staff in a consultation, or recorded in the group's notes as a stakeholder-confirmed answer, but not written in an official document. To be confirmed by the Graduate School."]],
                                   [["Consultation date, or the group's working notes."]], [[str(n_pr)]]],
            [[[("Total", "b")]], [["Existing rules documented in this section."]], [[""]], [[(str(n_existing), "b")]]],
        ],
        [1300, 4660, 2500, 900],
        fills={0: lambda row: STATUS_FILL.get(row[0][0][0] if isinstance(row[0][0][0], str) else "")},
    ))
    out.append(spacer())

    out.append(heading(3, "4.5.2 Existing Rules by Process"))
    out.append(body_para(
        "The tables below follow the order of the student lifecycle. The rule numbers are those of the Operations Manual "
        "(for example WD-01 is the first rule of the chapter on withdrawal of subject), so that a rule can be traced to its "
        "procedure, exceptions and records there."))
    notes = {
        "Withdrawal of subject": (
            "This answers the panel's question on whether a student can drop at any time, including the first day. According "
            "to the Handbook a student may withdraw a subject on the first day, because it falls inside the first week, but "
            "only with the approval of the Dean and not free of charge: 10% of the total amount due for the term is charged "
            "in the first week and 20% in the second. After the second week the student may still withdraw from all subjects "
            "at any time but pays the full fees for the semester. Dropping is different: it is the automatic consequence of "
            "unexcused absences above 20% of the class hours. What the Handbook does not say is listed as open questions in "
            "the Operations Manual."),
    }
    n = 0
    for (section, process), rules in by_process.items():
        existing = [r for r in rules if r["status"] in ("Official", "Practice")]
        if not existing:
            continue
        n += 1
        out.append(heading(4, f"4.5.2.{n} {process}"))
        n_off_p = sum(1 for r in existing if r["status"] == "Official")
        n_pr_p = len(existing) - n_off_p
        detail = f"{n_off_p} Official" + (f" and {n_pr_p} Practice" if n_pr_p else "")
        out.append(body_para(
            f"This process has {plural(len(existing), 'existing rule')} ({detail}); the procedure, exceptions and "
            f"records are in section {section} of the Operations Manual."))
        if process in notes:
            out.append(body_para(notes[process]))
        out.append(caption(f"Table {CH4_TABLE_BASE}.{n + 1}. Existing business rules: {process}"))
        rows = []
        for r in existing:
            rows.append([[[r["id"]]], [[r["rule"]]], [[r["source"]]], [[r["status"]]]])
        out.append(table(["Rule", "Existing rule or practice", "Source", "Label"], rows, [900, 4860, 2560, 1040],
                         fills={3: lambda row: STATUS_FILL.get(row[3][0][0])}))
        out.append(spacer())
    end_marker = marker("BizRulesExisting_end", ids[1], "pair")
    out.append(spacer(end_marker))
    return "".join(out)


def build_section_5_14(data, by_process, ids):
    groups = catalog_by_process()
    cat = catalog.BUSINESS_RULE_CATALOG
    n_total = len(cat)
    n_enf = sum(1 for r in cat if r["enforced"])
    n_doc = n_total - n_enf
    n_review = sum(1 for r in cat if r["status"] == "needs_review")
    n_groups = len(groups)
    proposed = [r for rules in by_process.values() for r in rules if r["status"] == "Proposed"]
    base = CH5_TABLE_BASE
    out = []
    out.append(heading(2, "5.14 Proposed Business Rules and Policies", marker("BizRulesProposed_begin", ids[0], "pair")))
    out.append(body_para(
        "This section answers the second part of the panel's request: the business rules and policies of the proposed "
        "system. The portal does not hard-code its rules. Every rule it enforces or records is one row of a business-rules "
        "register, with the rule in plain language, its value and unit, the policy document and page it comes from, whether "
        "the portal enforces it or only documents it, and a status. The workflows read the value from the register, so the "
        "number used in a check is always the one the Graduate School sees and can cite."))
    out.append(body_para(
        f"The register holds {n_total} rules in {n_groups} groups. {n_enf} are enforced, {n_doc} are documented only, and "
        f"{n_review} are values that the prototype needs but that no official document states; these {n_review} are marked "
        "as awaiting validation by the Graduate School. Enforced means that the workflow checks the rule: it blocks the "
        "action, or flags it so that it can proceed only with a documented exception. Documented only means that the rule "
        "is recorded and shown to the user, together with the reason the portal does not check it: for example the decision "
        "belongs to the Business Office, or the information, such as a grade, is outside the portal by decision of the "
        "stakeholders. Status Active means the rule comes from the Handbook or the Research Protocol; Needs review means it "
        "is a prototype value pending validation."))
    out.append(body_para(
        "A Graduate School staff member or administrator can change a rule's value on the Business Rules page. A change "
        "needs a reason, is kept in a revision history with who made it and when, and takes effect in the workflows "
        "immediately. The register was aligned with the Graduate Programs Student Handbook 2022-2023 during the revision "
        "that followed the Stage 1 defense: where the earlier prototype differed from the Handbook (for example in the "
        "subject withdrawal window, the length of a leave of absence, whether a leave counts toward maximum residence, "
        "and the size of a project paper panel), the Handbook now governs."))
    out.append(body_para(
        "The complete set of rules, the procedure for each process and the open questions are in the Graduate School "
        f"Operations Manual draft ({APPENDIX_LABEL}). The draft has not yet been validated by the Graduate School; until "
        "it is, the rules below marked Needs review, and the further proposed rules in Section 5.14.3, are the group's "
        "proposals and not official policy."))

    out.append(heading(3, "5.14.1 Summary of the Register"))
    out.append(body_para(
        f"Table {base}.1 gives the number of rules in each group, how many the portal enforces, how many it only "
        "documents, and how many await validation."))
    out.append(caption(f"Table {base}.1. Business-rules register by process"))
    rows = []
    for key, label in catalog.BUSINESS_RULE_PROCESSES:
        items = groups[key]
        rows.append([[[label]], [[str(len(items))]], [[str(sum(1 for r in items if r["enforced"]))]],
                     [[str(sum(1 for r in items if not r["enforced"]))]],
                     [[str(sum(1 for r in items if r["status"] == "needs_review"))]]])
    rows.append([[[("Total", "b")]], [[(str(n_total), "b")]], [[(str(n_enf), "b")]], [[(str(n_doc), "b")]], [[(str(n_review), "b")]]])
    out.append(table(["Process", "Rules", "Enforced", "Documented only", "Awaiting validation"], rows, [3960, 1000, 1400, 1600, 1400]))
    out.append(spacer())

    out.append(heading(3, "5.14.2 Rules by Process"))
    out.append(body_para(
        "Each table lists the rules of one group in the order of the register. The value column shows the value now "
        "stored; the source column gives the policy document and the page or section. The treatment column states "
        "whether the portal enforces the rule or documents it only and, for a documented-only rule, why."))
    n = 0
    for key, label in catalog.BUSINESS_RULE_PROCESSES:
        items = groups[key]
        if not items:
            continue
        n += 1
        out.append(heading(4, f"5.14.2.{n} {label}"))
        out.append(caption(f"Table {base}.{n + 1}. Proposed business rules: {label}"))
        rows = []
        for r in items:
            rule_cell = [[(r["title"], "b")], [r["description"]], [(breakable(r["key"]), "igs")]]
            treatment = [[("Enforced", "b")]] if r["enforced"] else [[("Documented only", "b")], [r["not_enforced_reason"]]]
            status = "Needs review" if r["status"] == "needs_review" else "Active"
            rows.append([rule_cell, [[value_text(r)]], [[source_text(r)]], treatment, [[status]], ])
        out.append(table(["Rule", "Value", "Source", "Treatment", "Status"], rows, [3300, 950, 1790, 2160, 1160],
                         fills={3: lambda row: STATUS_FILL["Enforced"] if row[3][0][0][0] == "Enforced" else STATUS_FILL["Documented only"],
                                4: lambda row: STATUS_FILL["Needs review"] if row[4][0][0] == "Needs review" else None}))
        out.append(spacer())

    table_no = n + 2
    out.append(heading(3, "5.14.3 Further Proposed Rules from the Operations Manual Draft"))
    out.append(body_para(
        f"The Operations Manual draft contains {len(proposed)} rules that the group proposes where no Handbook, Protocol or "
        "consultation statement exists, or where the only basis is the group's own process model. They are not existing "
        "policy. Each is marked Proposed in the manual and must be approved, changed or struck by the Graduate School. How "
        "the portal treats each one is described in the paragraph on platform support in the chapter of the manual that "
        f"holds the rule. Table {base}.{table_no} lists them."))
    out.append(caption(f"Table {base}.{table_no}. Further proposed rules awaiting Graduate School validation"))
    rows = []
    for r in proposed:
        rows.append([[[r["id"]]], [[r["process"]]], [[r["rule"]]], [[r["source"]]]])
    out.append(table(["Rule", "Process", "Proposed rule", "Basis"], rows, [940, 1660, 4600, 2160]))
    out.append(spacer())

    table_no += 1
    review = [r for r in cat if r["status"] == "needs_review"]
    out.append(heading(3, "5.14.4 Rules Awaiting Validation"))
    out.append(body_para(
        f"{NUMBER_WORDS.get(len(review), str(len(review)))} {'value' if len(review) == 1 else 'values'} in the register "
        f"{'is' if len(review) == 1 else 'are'} not stated in any policy document the group received. The portal needs them, so they were set from the group's working notes and are "
        f"marked Needs review. Table {base}.{table_no} lists them so that the Graduate School can confirm or replace each "
        "value on the Business Rules page. In addition, the Operations Manual draft lists its open questions, in which the "
        "Handbook, the Protocol and practice differ or are silent; each has a blank for the Graduate School's answer."))
    out.append(caption(f"Table {base}.{table_no}. Register rules awaiting Graduate School validation"))
    rows = []
    for r in review:
        rows.append([[[breakable(r["key"])]], [[r["title"]], [r["description"]]], [[value_text(r)]], [[dict(catalog.BUSINESS_RULE_PROCESSES)[r["process"]]]]])
    out.append(table(["Key", "Rule", "Value now", "Process"], rows, [2300, 4260, 1000, 1800]))
    out.append(spacer())
    out.append(spacer(marker("BizRulesProposed_end", ids[1], "pair")))
    return "".join(out)


def build_appendix(data, ids):
    counts = data["counts"]
    total = sum(counts.values())
    out = [page_break(marker("BizRulesAppendix_begin", ids[0], "pair"))]
    out.append(heading(2, f"{APPENDIX_LABEL}. {MANUAL_TITLE}"))
    out.append(body_para(
        "The panel required that the policies of the operations manual be included. The Graduate School has no operations "
        "manual, so the group wrote a draft for the Graduate School to validate. It is a separate document and is not "
        "reproduced here."))
    out.append(body_para(
        f"The draft (version {data['version']}, dated {data['date']}) contains the purpose and scope, the roles and the "
        "offices outside the Graduate School, the records and the official source of each kind of data, nineteen process "
        "chapters from admission to the records handoff to the Registrar, a consolidated register of the business rules, "
        "the open questions for the Graduate School, a validation and sign-off page, the forms named in the sources, and a "
        "glossary. Each process chapter gives the purpose, the people involved, the trigger, the numbered procedure, the "
        "business rules with their sources, the exceptions, the records produced, and how the portal supports the process "
        "together with any difference between the portal and the rule."))
    out.append(body_para(
        f"The register holds {total} rules: {counts['Official']} Official (stated in the Handbook or the Research "
        f"Protocol), {counts['Practice']} Practice (described by staff in consultation) and {counts['Proposed']} Proposed "
        "(the group's proposals). The existing rules are reproduced in Section 4.5 and the proposed ones in Section 5.14. "
        "The draft awaits validation by the Graduate School Dean and Associate Dean; until the sign-off page is signed it "
        "is not an official University document."))
    out.append(body_para(
        "Files, in the folder Documents/CAPSTONE_ONLY of the project repository: "
        + "; ".join(MANUAL_FILES[:3]) + " (the same manual in Word, PDF and plain text); and "
        + MANUAL_FILES[3] + " (the rules register in machine-readable form)."))
    out.append(spacer(marker("BizRulesAppendix_end", ids[1], "pair")))
    return "".join(out)


# --------------------------------------------------------------------------- document surgery
def q(tag):
    return "{%s}%s" % (W, tag)


def parse_fragment(xml: str, root):
    decl = " ".join(f'xmlns:{p}="{u}"' for p, u in root.nsmap.items() if p)
    wrapper = etree.fromstring(f"<root {decl}>{xml}</root>")
    return list(wrapper)


def text_of(el) -> str:
    return "".join(el.itertext())


def find_bookmark_paragraph(body, name):
    for child in body:
        if child.find(f'.//w:bookmarkStart[@w:name="{name}"]', NS) is not None:
            return child
    return None


def remove_block(body, begin_name, end_name) -> bool:
    start = find_bookmark_paragraph(body, begin_name)
    end = find_bookmark_paragraph(body, end_name)
    if start is None and end is None:
        return False
    if start is None or end is None:
        raise SystemExit(f"{begin_name}/{end_name}: only one marker found; the block was edited by hand. Stop.")
    children = list(body)
    i, j = children.index(start), children.index(end)
    if j < i:
        raise SystemExit(f"{end_name} comes before {begin_name}.")
    for child in children[i:j + 1]:
        body.remove(child)
    return True


def heading1_index(body, text):
    """Index of the body-level Heading 1 paragraph whose text is exactly `text` (outside the TOC)."""
    hits = []
    for idx, child in enumerate(body):
        if child.tag != q("p"):
            continue
        style = child.find("w:pPr/w:pStyle", NS)
        if style is not None and style.get(q("val")) == "Heading1" and text_of(child).strip() == text:
            hits.append(idx)
    if len(hits) != 1:
        raise SystemExit(f"expected exactly one Heading 1 '{text}', found {len(hits)}")
    return hits[0]


def next_bookmark_id(root) -> int:
    ids = [int(x) for x in root.xpath("//w:bookmarkStart/@w:id", namespaces=NS) if str(x).isdigit()]
    return max(ids or [0]) + 1


def transform(src: str, dst: str) -> dict:
    data, by_process = load_manual_rules()
    with zipfile.ZipFile(src) as zin:
        infos = zin.infolist()
        parts = {i.filename: zin.read(i.filename) for i in infos}
    root = etree.fromstring(parts["word/document.xml"])
    body = root.find(q("body"))

    for begin, end in (("BizRulesExisting_begin", "BizRulesExisting_end"),
                       ("BizRulesProposed_begin", "BizRulesProposed_end"),
                       ("BizRulesAppendix_begin", "BizRulesAppendix_end")):
        remove_block(body, begin, end)

    next_id = next_bookmark_id(root)
    stats = {}

    # Chapter 5 first (later in the file) so earlier indices stay valid
    # --- appendix: before the final sectPr, after Appendix Z
    last_appendix = [c for c in body if c.tag == q("p") and text_of(c).strip().startswith(APPENDIX_LAST)]
    if not last_appendix:
        raise SystemExit(f"'{APPENDIX_LAST}' heading not found; cannot place {APPENDIX_LABEL}.")
    sect = body.find(q("sectPr"))
    xml = build_appendix(data, (next_id, next_id + 1))
    next_id += 2
    for el in parse_fragment(xml, root):
        sect.addprevious(el)
    stats["appendix_elements"] = len(parse_fragment(xml, root))

    # --- Section 5.14: before the empty section-break paragraph that precedes Heading 1 'System Testing'
    idx = heading1_index(body, CH5_NEXT)
    carrier = body[idx - 1]
    if carrier.find(".//w:sectPr", NS) is None:
        raise SystemExit("the paragraph before 'System Testing' is not the chapter's section break")
    xml = build_section_5_14(data, by_process, (next_id, next_id + 1))
    next_id += 2
    els = parse_fragment(xml, root)
    for el in els:
        carrier.addprevious(el)
    stats["section_5_14_elements"] = len(els)

    # --- Section 4.5
    idx = heading1_index(body, CH4_NEXT)
    carrier = body[idx - 1]
    if carrier.find(".//w:sectPr", NS) is None:
        raise SystemExit("the paragraph before 'The Proposed System' is not the chapter's section break")
    xml = build_section_4_5(data, by_process, (next_id, next_id + 1))
    next_id += 2
    els = parse_fragment(xml, root)
    for el in els:
        carrier.addprevious(el)
    stats["section_4_5_elements"] = len(els)

    parts["word/document.xml"] = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
        for info in infos:
            zout.writestr(info, parts[info.filename])
    stats["catalog_rules"] = len(catalog.BUSINESS_RULE_CATALOG)
    stats["manual_counts"] = data["counts"]
    return stats


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("dst")
    a = ap.parse_args(argv)
    stats = transform(a.src, a.dst)
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()
