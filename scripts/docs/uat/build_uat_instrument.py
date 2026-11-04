"""Build the revised UAT instrument (Word) for the USLS Graduate School stakeholder meeting.

Run:  E:/Temp/claude/docs-venv/Scripts/python.exe scripts/docs/uat/build_uat_instrument.py
Out:  Documents/Capstone/UAT/[CAP-IT2] UAT Instrument - Revised.docx

Every design choice (size, font, scale, wording) and its source is listed in
Documents/Capstone/UAT/UAT-REVIEW-NOTES.md. Change questions in SECTIONS below,
not in the layout code. Set INCLUDE_SUS = False to drop the one-page SUS.
"""
from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_ROW_HEIGHT_RULE, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

INCLUDE_SUS = True
OUT = Path(__file__).resolve().parents[3] / "Documents/Capstone/UAT/[CAP-IT2] UAT Instrument - Revised.docx"

FONT = "Arial"          # in every Word/LibreOffice install; sans serif per plain-language form guides
SYM = "Segoe UI Symbol"  # carries the tick-box glyphs; Word falls back by itself where it is missing
GREEN, LIGHT, TINT, GREY, LINE = "1F5C3E", "E1EDE5", "F2F6F3", "404040", "8A9A90"
BODY, TABLE, SMALL, FOOT = 12, 11, 10, 9
BOX = "\u2610"  # ☐

# widths in inches; sum = text width of Letter with 0.8 in side margins (6.9 in)
GRID = [0.45, 4.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35]
TEXT_W = sum(GRID)

# ---------------------------------------------------------------- content
ROLES = ["Graduate School Staff", "Academic Coordinator", "Research Coordinator", "Dean",
         "Associate Dean", "Administrator", "Faculty (adviser / panel)", "Student"]


def yn(text):
    return ("yn", text, None)


def rate(text, lo, hi):
    return ("rate", text, f"1 = {lo}   \u00b7   3 = Acceptable   \u00b7   5 = {hi}")


SECTIONS = [
    dict(id="A", title="OVERALL SYSTEM AND PROCESS REPRESENTATION", who="Everyone", items=[
        yn("Does the system accurately represent the actual Graduate School student lifecycle, from student handoff to graduation?"),
        yn("Are the responsibilities given to Graduate School Staff, Academic Coordinator, Research Coordinator, Dean, faculty and students appropriate?"),
        yn("Does the system clearly show which records are official (imported from AIMS) and which were added in the portal for monitoring and coordination?"),
        yn("Are the student statuses and lifecycle stages easy to understand?"),
        yn("Does the system give enough information to tell where a student currently is in the Graduate School process?"),
        yn("Does the system show who a student\u2019s case is currently waiting on?"),
        rate("How easy was it to sign in and reach the functions needed for your role?", "Very difficult", "Very easy"),
    ], comment="Comments:"),
    dict(id="B", title="STUDENT RECORDS, COURSE MONITORING, AND ENROLLMENT",
         who="Graduate School Staff, Academic Coordinator", items=[
        yn("Is importing the Academic Coordinator\u2019s monitoring workbook (Excel) and reviewing the result an appropriate process?"),
        yn("Does the Monitoring Sheet show each student\u2019s coursework and progress clearly?"),
        yn("Is it appropriate that Graduate School staff can add or correct student and subject records directly in the Monitoring Sheet?"),
        yn("Is the information kept with each entry (imported or manual entry, who made it, when, and the reason) enough to trust the record?"),
        yn("Is it appropriate that a manual entry cannot overwrite a value imported from AIMS?"),
        yn("Is it acceptable that the portal does not record grades and takes course completion only from the AIMS export?"),
        yn("Does the Course Adjustments screen give enough information (which students still need which subjects) to decide what to offer?"),
        yn("Is the approval route for the offering plan appropriate: the Academic Coordinator prepares it, the Dean approves it, then it is published?"),
        yn("Are the faculty assignment, section, and schedule steps appropriate for preparing the course offering?"),
        yn("Does the Enrollment process correctly represent how the Graduate School should record and monitor enrollment?"),
        yn("Are the enrollment checks appropriate (subject must be offered, completed subjects cannot be added again, adding after the first week, the 12-unit full-time load)?"),
        yn("Is it appropriate that staff can record a documented exception when an enrollment check stops a change?"),
        yn("Is the class-list import (enrolling a batch from the Registrar\u2019s class list) appropriate?"),
        rate("How useful is the Monitoring Sheet compared with the Excel monitoring sheet used today?", "Not useful", "Very useful"),
    ], comment="Comments:"),
    dict(id="C", title="STANDING CHANGES AND EXCEPTION CASES",
         who="Graduate School Staff, Dean, Academic Coordinator, Student", items=[
        yn("Is the Subject Withdrawal workflow (student request, staff, Dean decision, subject tagged Withdrawn) consistent with the Graduate School\u2019s actual process?"),
        yn("Is the withdrawal window shown by the system (until the end of the second week of classes) correct?"),
        yn("Is the withdrawal fee rule shown by the system (10% in week 1, 20% in week 2) correct?"),
        yn("Is the distinction between withdrawing (a student request the Dean approves) and dropping (recorded by the Academic Coordinator when unexcused absences exceed 20%) represented correctly?"),
        yn("Is the Leave of Absence workflow, including staff review, the policy check and the Dean\u2019s decision, appropriate?"),
        yn("Is the Readmission workflow, including the return checklist and the Dean\u2019s approval, appropriate?"),
        yn("Are AWOL, Return from AWOL, and residency handled by the appropriate roles and processes?"),
        yn("Is handing changes to the Registrar as a file that staff download, e-mail and mark as sent an acceptable way to work?"),
        yn("Are unusual or incomplete cases clearly prevented from moving forward until the required action is completed?"),
    ], comment="Comments:"),
    dict(id="D", title="RESEARCH GATE", who="Graduate School Staff, Research Coordinator, Academic Coordinator, Faculty (adviser), Student", items=[
        yn("Does the Research Gate correctly show the student\u2019s current research stage and requirements?"),
        yn("Are the requirements for Title Defense, Proposal Defense, and Final Defense represented correctly?"),
        yn("Are student-submitted documents visible to the appropriate Graduate School users?"),
        yn("Is it appropriate that the system reads the research title from the uploaded Form 1?"),
        yn("Is it appropriate that the system checks the concept papers against the guidelines?"),
        yn("Is document verification assigned to the correct role (Graduate School staff)?"),
        yn("Are the adviser\u2019s signature, the Academic Coordinator\u2019s endorsement, and the Research Coordinator\u2019s ethics clearance assigned to the correct roles?"),
        yn("Does the system prevent a student from moving forward when a required document, signature, clearance, or approval is missing?"),
        yn("Does a student unlock the next research stage only after the panel chair records a passing result for the stage before it?"),
        rate("How useful is the Research Gate for judging a student\u2019s research readiness and pending requirements?", "Not useful", "Very useful"),
    ], comment="Comments:"),
    dict(id="E", title="PANEL MATCHING", who="Graduate School Staff, Research Coordinator, Faculty",
         note="The faculty expertise records in this demonstration are sample data, not the real records.", items=[
        yn("Are the faculty members recommended by the system reasonably related to the student\u2019s research topic?"),
        yn("Are the faculty specialization, matching keywords, availability, and match score useful when selecting panel members?"),
        yn("Is the score breakdown (expertise 60, availability 25, workload 15 out of 100) appropriate for ranking panel candidates?"),
        yn("Is the reason behind each faculty recommendation understandable?"),
        yn("Is it appropriate that the system recommends panel candidates but an authorized user makes the final selection?"),
        yn("Does the ability to search and choose other faculty members give enough flexibility for actual panel assignment?"),
        yn("Do the panel composition rules (including keeping the student\u2019s adviser off the panel) match the Research Protocol?"),
        rate("How useful are the panel recommendations in supporting panel selection?", "Not useful", "Very useful"),
    ], comment="Comments:"),
    dict(id="F", title="DEFENSE SCHEDULING AND DEFENSE OUTCOME",
         who="Graduate School Staff, Research Coordinator, Faculty (panel), Student", items=[
        yn("Does the system correctly check the student\u2019s readiness before defense scheduling?"),
        yn("Are the finalized panel members, the invitation answers, and the availability of each panelist presented clearly?"),
        yn("Are the Best Shared Options useful for finding an appropriate common schedule?"),
        yn("Are the scheduling stops that cannot be overridden appropriate (double-booked panelist or room, declined invitation, date in the past, outside a panelist\u2019s hours)?"),
        yn("Is it appropriate that booking less than 14 days ahead gives a warning that staff can override only with a written reason?"),
        yn("Is it appropriate that authorized staff can reschedule or cancel a defense when the reason is recorded?"),
        yn("Does each role\u2019s calendar (staff, faculty, student) show the booked defenses correctly?"),
        yn("Is the optional Google Calendar connection for faculty (shows busy times, adds booked defenses to the faculty member\u2019s calendar) appropriate?"),
        yn("Is the Panel Chair or Panel Lead the appropriate person to record the official defense verdict?"),
        yn("Is it appropriate that a verdict can be recorded only after the defense has started?"),
        yn("Are the available verdicts (Passed; Passed with minor revisions; Provisional pass \u2013 revisions or re-defense; Deferred; Failed) appropriate?"),
        yn("Does the system correctly handle a failed defense by keeping the student in the same research stage and requiring resubmission?"),
        yn("At the Final Defense, is it correct that a score below 85 (thesis) or 90 (dissertation) cannot be recorded as a plain pass?"),
        rate("How useful is the scheduling module for coordinating student and panel availability?", "Not useful", "Very useful"),
    ], comment="Comments:"),
    dict(id="G", title="PRACTICUM AND GRADUATION",
         who="Graduate School Staff, Academic Coordinator, Research Coordinator, Dean, Student", items=[
        yn("Does the Practicum workflow correctly identify the programs and students to which practicum applies?"),
        yn("Does the system correctly prevent practicum completion when the required hours or documents are incomplete?"),
        yn("Is the process for requesting and resubmitting additional practicum evidence appropriate?"),
        yn("Is the review route appropriate: the Academic Coordinator verifies completion and sends the status report, then the Dean marks it reviewed?"),
        yn("Does the Graduation module correctly check whether the required academic and research conditions (and practicum, where required) are complete?"),
        yn("Is returning an incorrect graduation application to the student for correction an appropriate workflow?"),
        yn("Is the graduation batch route appropriate: Academic Coordinator, Research Coordinator, staff endorsement list, then Dean approval and export?"),
        yn("Does the system keep enough information to show why a student is or is not eligible for graduation endorsement?"),
    ], comment="Comments:"),
    dict(id="H", title="POLICY ASSISTANT, RULES, REPORTS, AND ANALYTICS",
         who="Everyone for the Policy Assistant; Staff, Dean and Coordinators for reports", items=[
        yn("Are the Policy Assistant responses useful for finding relevant Graduate School policies or guidelines?"),
        yn("Is it clear that Policy Assistant responses support decisions and are not official rulings?"),
        yn("Is showing the source document and page useful for checking a Policy Assistant response?"),
        yn("Is the Business Rules register (each rule with its value, its handbook page, and a label such as Enforced, Documented only, or Needs review) easy to understand?"),
        yn("Is it appropriate that staff can add, replace, and keep versions of the policy documents the Policy Assistant uses?"),
        yn("Are the summary numbers at the top of Reports & Analytics (active students, behind schedule, requests waiting, days to decide, defenses held, endorsements) useful for monitoring Graduate School operations?"),
        yn("Are the report tabs (needs attention, where students get stuck, office speed, records to fix, cohorts, graduation candidates, overdue and pending, defenses, Registrar changes) useful for the work of your office?"),
        yn("Did opening the list of students behind a number help in checking the figures?"),
        yn("Are the filters and the Excel and PDF downloads on the reports practical?"),
        yn("Are the presented indicators and analytics easy to understand?"),
        yn("Are the presented indicators and analytics relevant to Graduate School decision-making?"),
        yn("Is it acceptable that risk reads \u201cNot Yet Assessed\u201d until the Graduate School confirms its risk rules?"),
        rate("How useful are the reports and analytics for monitoring many students instead of checking records one by one?", "Not useful", "Very useful"),
    ], comment="If there are missing reports, indicators, or information, please specify:"),
    dict(id="I", title="USER INTERFACE AND EASE OF USE", who="Everyone", items=[
        yn("Is the overall interface clear and organized?"),
        yn("Are the labels, buttons, status indicators, and instructions understandable?"),
        yn("Is navigation between the different Graduate School modules easy to understand?"),
        yn("Is important information easy to find without unnecessary searching?"),
        yn("Do the process boards (Leave of Absence, Readmission, AWOL, Withdrawal, Practicum, Graduation) work the same way?"),
        yn("When the system stopped an action, was the reason clear?"),
        yn("When the system stopped an action, was the next step clear?"),
        rate("How easy was it to understand and move around the system overall?", "Very difficult", "Very easy"),
    ], comment="Comments:"),
    dict(id="J", title="ACCESS, RELIABILITY, AND SYSTEM BEHAVIOR", who="Everyone", items=[
        yn("Does each role give access only to the functions appropriate to that role?"),
        yn("Are important actions such as submissions, approvals, signatures, scheduling, and verdicts clearly recorded (what, who, when)?"),
        yn("Did the system behave as expected when incorrect, incomplete, or unusual cases were shown?"),
        yn("Were the statuses and information shown correct?"),
        yn("Did the system work without unexpected results or error messages?"),
        yn("Was the system responsive enough during the session?"),
        yn("Are the in-system notifications (bell, messages, panel invitations) enough, given that the portal sends no e-mail?"),
    ], comment="Comments (for every item answered No, please say what happened and where):"),
]

SUS_ITEMS = [  # Brooke (1996) wording; odd items positive, even items negative by design
    "I think that I would like to use this system frequently.",
    "I found the system unnecessarily complex.",
    "I thought the system was easy to use.",
    "I think that I would need the support of a technical person to be able to use this system.",
    "I found the various functions in this system were well integrated.",
    "I thought there was too much inconsistency in this system.",
    "I would imagine that most people would learn to use this system very quickly.",
    "I found the system very cumbersome to use.",
    "I felt very confident using the system.",
    "I needed to learn a lot of things before I could get going with this system.",
]

VALIDATION = [
    ("Were any steps shown in the system different from the actual Graduate School process?",
     "If yes, please identify the process and the correct procedure:"),
    ("Were any responsibilities assigned to the wrong person or office?", "If yes, please specify:"),
    ("Were any required forms, documents, approvals, or information missing from the system?", "If yes, please specify:"),
    ("Were any statuses, rules, deadlines, or conditions represented incorrectly?",
     "If yes, please specify the correct rule or condition:"),
    ("Did the system allow an action that should not normally be allowed?", "If yes, please describe:"),
    ("Did the system prevent an action that should normally be allowed?", "If yes, please describe:"),
    ("Were any names or terms in the system different from those the Graduate School uses?",
     "If yes, please give the term the Graduate School uses:"),
    ("Are any rules marked \u201cNeeds review\u201d in the Business Rules register wrong?",
     "If yes, please give the rule and the correct value:"),
]

# ---------------------------------------------------------------- low-level helpers


def _fonts(rpr_owner_run, name):
    rpr = rpr_owner_run._r.get_or_add_rPr()
    rf = rpr.find(qn("w:rFonts"))
    if rf is None:
        rf = OxmlElement("w:rFonts")
        rpr.insert(0, rf)
    for a in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        rf.set(qn(a), name)


def run(p, text, size=TABLE, bold=False, italic=False, color=None, font=FONT):
    r = p.add_run(text)
    r.font.size = Pt(size)
    r.bold = bold
    r.italic = italic
    if color:
        r.font.color.rgb = RGBColor.from_string(color)
    _fonts(r, font)
    return r


def box(p, size=14):
    return run(p, BOX, size=size, font=SYM)


def fmt(p, after=0, before=0, align=None, keep_next=False, keep_lines=False, line=1.0):
    pf = p.paragraph_format
    pf.space_after, pf.space_before, pf.line_spacing = Pt(after), Pt(before), line
    pf.keep_with_next, pf.keep_together = keep_next, keep_lines
    if align is not None:
        p.alignment = align
    return p


def shade_par(p, fill):
    ppr = p._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    ppr.append(shd)


def border_par(p, side="bottom", sz=12, color=GREEN, space=4):
    ppr = p._p.get_or_add_pPr()
    b = OxmlElement("w:pBdr")
    e = OxmlElement(f"w:{side}")
    for k, v in (("val", "single"), ("sz", str(sz)), ("space", str(space)), ("color", color)):
        e.set(qn(f"w:{k}"), v)
    b.append(e)
    ppr.append(b)


def shade_cell(cell, fill):
    tcpr = cell._tc.get_or_add_tcPr()
    for old in tcpr.findall(qn("w:shd")):
        tcpr.remove(old)
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    tcpr.append(shd)


def table_base(doc, rows, grid=GRID):
    t = doc.add_table(rows=rows, cols=len(grid))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    tblpr = t._tbl.tblPr
    lay = OxmlElement("w:tblLayout")
    lay.set(qn("w:type"), "fixed")
    tblpr.append(lay)
    w = tblpr.find(qn("w:tblW"))
    if w is None:
        w = OxmlElement("w:tblW")
        tblpr.append(w)
    w.set(qn("w:type"), "dxa")
    w.set(qn("w:w"), str(int(sum(grid) * 1440)))
    borders = OxmlElement("w:tblBorders")
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        e = OxmlElement(f"w:{side}")
        for k, v in (("val", "single"), ("sz", "4"), ("space", "0"), ("color", LINE)):
            e.set(qn(f"w:{k}"), v)
        borders.append(e)
    tblpr.append(borders)
    mar = OxmlElement("w:tblCellMar")
    for side, v in (("top", 50), ("left", 70), ("bottom", 50), ("right", 70)):
        e = OxmlElement(f"w:{side}")
        e.set(qn("w:w"), str(v))
        e.set(qn("w:type"), "dxa")
        mar.append(e)
    tblpr.append(mar)
    for i, gc in enumerate(t._tbl.tblGrid.findall(qn("w:gridCol"))):
        gc.set(qn("w:w"), str(int(grid[i] * 1440)))
    for row in t.rows:
        for i, c in enumerate(row.cells):
            c.width = Inches(grid[i])
    return t


def merge(row, a, b):
    """merge grid columns a..b (inclusive) of a row; returns the cell"""
    return row.cells[a].merge(row.cells[b])


def fix_widths(t, grid=GRID):
    for tr in t._tbl.tr_lst:
        i = 0
        for tc in tr.tc_lst:
            span = tc.grid_span
            tcpr = tc.get_or_add_tcPr()
            w = tcpr.find(qn("w:tcW"))
            if w is None:
                w = OxmlElement("w:tcW")
                tcpr.insert(0, w)
            w.set(qn("w:type"), "dxa")
            w.set(qn("w:w"), str(int(sum(grid[i:i + span]) * 1440)))
            i += span


def row_flags(row, header=False, min_h=None):
    trpr = row._tr.get_or_add_trPr()
    trpr.append(OxmlElement("w:cantSplit"))
    if header:
        trpr.append(OxmlElement("w:tblHeader"))
    if min_h:
        row.height, row.height_rule = Inches(min_h), WD_ROW_HEIGHT_RULE.AT_LEAST


def keep_row_with_next(row):
    for c in row.cells:
        for p in c.paragraphs:
            p.paragraph_format.keep_with_next = True


def cell_text(cell, text, size=TABLE, bold=False, italic=False, color=None, align=None, valign="center"):
    p = cell.paragraphs[0]
    fmt(p, align=align)
    run(p, text, size=size, bold=bold, italic=italic, color=color)
    cell.vertical_alignment = {"center": WD_CELL_VERTICAL_ALIGNMENT.CENTER, "top": WD_CELL_VERTICAL_ALIGNMENT.TOP}[valign]
    return p


def tick_line(cell, groups, size=TABLE, tab_in=2.6):
    """one paragraph per group; each choice is '☐ label', choices in a group are tab-aligned"""
    first = True
    for g in groups:
        p = cell.paragraphs[0] if first else cell.add_paragraph()
        first = False
        fmt(p, after=2)
        tabs = OxmlElement("w:tabs")
        t = OxmlElement("w:tab")
        t.set(qn("w:val"), "left")
        t.set(qn("w:pos"), str(int(tab_in * 1440)))
        tabs.append(t)
        p._p.get_or_add_pPr().append(tabs)
        for j, lab in enumerate(g):
            if j:
                run(p, "	", size=size)
            box(p, 13)
            run(p, " " + lab, size=size)


# ---------------------------------------------------------------- document parts


def setup(doc):
    s = doc.sections[0]
    s.orientation = WD_ORIENT.PORTRAIT
    s.page_width, s.page_height = Inches(8.5), Inches(11)  # Letter, like the team's other documents
    s.left_margin = s.right_margin = Inches(0.8)
    s.top_margin, s.bottom_margin = Inches(0.7), Inches(0.8)
    s.footer_distance = Inches(0.4)
    st = doc.styles["Normal"]
    st.font.name, st.font.size = FONT, Pt(TABLE)
    rpr = st.element.get_or_add_rPr()
    rf = rpr.find(qn("w:rFonts"))
    if rf is None:
        rf = OxmlElement("w:rFonts")
    for a in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        rf.set(qn(a), FONT)
    if rf.getparent() is None:
        rpr.insert(0, rf)
    lang = OxmlElement("w:lang")
    lang.set(qn("w:val"), "en-PH")
    rpr.append(lang)
    st.paragraph_format.space_after = Pt(0)
    for name, size in (("Title", 20), ("Heading 1", 12), ("Heading 2", 12)):
        h = doc.styles[name]
        h.font.name, h.font.size, h.font.bold = FONT, Pt(size), True
        h.font.color.rgb = RGBColor.from_string("FFFFFF" if name == "Heading 1" else GREEN)
        r = h.element.get_or_add_rPr()
        f = r.find(qn("w:rFonts"))
        if f is None:
            f = OxmlElement("w:rFonts")
            r.insert(0, f)
        for a in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
            f.set(qn(a), FONT)
        for a in ("w:asciiTheme", "w:hAnsiTheme", "w:eastAsiaTheme", "w:cstheme"):
            if f.get(qn(a)) is not None:
                del f.attrib[qn(a)]
    pb = doc.styles["Title"].element.get_or_add_pPr().find(qn("w:pBdr"))
    if pb is not None:  # python-docx default Title has a blue rule; ours is drawn per paragraph
        pb.getparent().remove(pb)
    doc.core_properties.title = "User Acceptance Testing (UAT) Form"
    doc.core_properties.author = "CAP-2521-IT"
    doc.core_properties.subject = "Graduate Student Lifecycle Monitoring and Analytics Platform, USLS Graduate School"


def field(p, instr, size=FOOT):
    for kind, txt in (("begin", None), (None, instr), ("end", None)):
        r = p.add_run()
        r.font.size = Pt(size)
        _fonts(r, FONT)
        if kind:
            fc = OxmlElement("w:fldChar")
            fc.set(qn("w:fldCharType"), kind)
            r._r.append(fc)
        else:
            it = OxmlElement("w:instrText")
            it.set(qn("xml:space"), "preserve")
            it.text = f" {txt} "
            r._r.append(it)


def footer(doc):
    p = doc.sections[0].footer.paragraphs[0]
    fmt(p)
    ppr = p._p.get_or_add_pPr()
    tabs = OxmlElement("w:tabs")
    for kind, pos in (("center", int(TEXT_W / 2 * 1440)), ("right", int(TEXT_W * 1440))):
        t = OxmlElement("w:tab")
        t.set(qn("w:val"), kind)
        t.set(qn("w:pos"), str(pos))
        tabs.append(t)
    ppr.append(tabs)
    border_par(p, "top", sz=4, color=LINE, space=4)
    run(p, "[CAP-IT2] UAT Form \u2013 CAP-2521-IT", size=FOOT, color=GREY)
    run(p, "\tEvaluator initials: ________\t", size=FOOT, color=GREY)
    run(p, "Page ", size=FOOT, color=GREY)
    field(p, "PAGE")
    run(p, " of ", size=FOOT, color=GREY)
    field(p, "NUMPAGES")


def header_block(doc):
    t = table_base(doc, 3, [2.3, TEXT_W - 2.3])
    rows = [("PROJECT NAME",
             "Graduate Student Lifecycle Monitoring and Analytics Platform for the University of St. La Salle Graduate School"),
            ("PROJECT TEAM", "CAP-2521-IT"),
            ("VERSION TESTED", "Demonstration build with sample data only (no real student records)")]
    for r, (a, b) in zip(t.rows, rows):
        shade_cell(r.cells[0], LIGHT)
        cell_text(r.cells[0], a, bold=True, size=SMALL)
        cell_text(r.cells[1], b)
        row_flags(r)
    p = fmt(doc.add_paragraph(), before=14, after=2, align=WD_ALIGN_PARAGRAPH.CENTER)
    run(p, "UNIVERSITY OF ST. LA SALLE", size=14, bold=True, color=GREEN)
    p = fmt(doc.add_paragraph(), after=4, align=WD_ALIGN_PARAGRAPH.CENTER)
    run(p, "GRADUATE SCHOOL LIFECYCLE MONITORING AND ANALYTICS PLATFORM", size=BODY, bold=True)
    p = doc.add_paragraph("USER ACCEPTANCE TESTING (UAT) FORM", style="Title")
    fmt(p, before=2, after=8, align=WD_ALIGN_PARAGRAPH.CENTER)
    for r in p.runs:
        r.font.color.rgb = RGBColor.from_string(GREEN)
    border_par(p, "bottom", sz=12, color=GREEN, space=6)


def evaluator_block(doc):
    p = doc.add_paragraph("EVALUATOR INFORMATION", style="Heading 2")
    fmt(p, before=10, after=4, keep_next=True)
    t = table_base(doc, 5, [2.3, TEXT_W - 2.3])
    labels = ["Evaluator name", "Position / office", "Role you tested", "How you took part", "Date and session"]
    for r, lab in zip(t.rows, labels):
        shade_cell(r.cells[0], LIGHT)
        cell_text(r.cells[0], lab, bold=True, size=SMALL)
        row_flags(r, min_h=0.34)
        r.cells[1].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    tick_line(t.rows[2].cells[1], [ROLES[0:2], ROLES[2:4], ROLES[4:6], ROLES[6:8], ["Other: ______________"]], size=SMALL + 0.5, tab_in=2.35)
    tick_line(t.rows[3].cells[1], [["I watched the demonstration", "I used the system myself"], ["Both"]], size=SMALL + 0.5, tab_in=2.35)
    for r in t.rows[2:4]:
        r.height = None


def intro(doc):
    p = doc.add_paragraph("Welcome to the User Acceptance Testing (UAT) of the Graduate Student Lifecycle Monitoring and Analytics Platform.")
    fmt(p, before=12, after=6)
    for r in p.runs:
        r.font.size = Pt(BODY)
        r.bold = True
        _fonts(r, FONT)
    paras = [
        "The purpose of this UAT is to determine whether the developed system supports the actual monitoring and coordination needs of the University of St. La Salle Graduate School.",
        "During this test, you will see or perform common Graduate School tasks involving student monitoring, research requirements, panel selection, defense scheduling, approvals, and other lifecycle processes. Your responses will help the development team identify functions that work as expected and areas that may still require improvement.",
        "Please evaluate the system based on your actual experience during testing. Only judge what you saw or did. All names and records in the demonstration are sample data.",
    ]
    for t in paras:
        p = fmt(doc.add_paragraph(), after=6)
        run(p, t, size=BODY)
    p = doc.add_paragraph("HOW TO ANSWER", style="Heading 2")
    fmt(p, before=8, after=4, keep_next=True)
    t = table_base(doc, 4, [1.5, TEXT_W - 1.5])
    rows = [
        ("Yes / No / N/A", [("Yes", "The function worked as expected."),
                            ("No", "The function did not work as expected or requires improvement. Please explain in Comments."),
                            ("N/A", "The function was not shown or tested, or does not apply to your role.")]),
        ("Rating questions", [("1\u20135", "Under each rating question, the scale is printed with its own words. 1 is the lowest and 5 the highest. Generally: 1 Very poor / Very difficult, 2 Poor / Difficult, 3 Acceptable, 4 Good / Easy, 5 Excellent / Very easy.")]),
        ("Which sections?", [("", "Everyone answers Sections A, I, J and K and the User Acceptance page, plus the sections marked \u201cMainly for\u201d your role. The SUS page is optional. You may skip the other sections.")]),
        ("Ticking", [("", "TICK")]),
    ]
    for r, (lab, items) in zip(t.rows, rows):
        shade_cell(r.cells[0], LIGHT)
        cell_text(r.cells[0], lab, bold=True, size=SMALL, valign="top")
        c = r.cells[1]
        first = True
        for k, v in items:
            p = c.paragraphs[0] if first else c.add_paragraph()
            first = False
            fmt(p, after=2)
            if k:
                run(p, k + " \u2013 ", size=TABLE - 0.5, bold=True)
            if v == "TICK":
                run(p, "Tick one box in each row. On paper, mark it with a tick or a cross. On a computer, replace ", size=TABLE - 0.5)
                box(p, 12)
                run(p, " with ", size=TABLE - 0.5)
                run(p, "☑", size=12, font=SYM)
                run(p, " (copy and paste the symbol).", size=TABLE - 0.5)
            else:
                run(p, v, size=TABLE - 0.5)
        row_flags(r)
        if r is not t.rows[-1]:
            keep_row_with_next(r)
    p = fmt(doc.add_paragraph(), before=6)
    run(p, "Privacy: your name, position, and signature are used only to record this evaluation for the CAP-2521-IT capstone. These details are not shared outside the project team and the Graduate School (Data Privacy Act of 2012, RA 10173). Taking part is voluntary, and you may skip any question.",
        size=SMALL, italic=True, color=GREY)


def section_bar(doc, sec, title, who, note=None):
    h = p = doc.add_paragraph(f"SECTION {sec} \u2013 {title}" if len(sec) == 1 else title, style="Heading 1")
    fmt(p, before=12, after=0, keep_next=True, keep_lines=True)
    shade_par(p, GREEN)
    if who:
        q = fmt(doc.add_paragraph(), after=3, keep_next=True)
        shade_par(q, GREEN)
        run(q, f"Mainly for: {who}", size=SMALL, color="FFFFFF")
    if note:
        q = fmt(doc.add_paragraph(), after=3, keep_next=True)
        run(q, note, size=SMALL, italic=True, color=GREY)
    return h


def header_row(t, lab_q="Question", lab_a="Your answer (tick one)"):
    r = t.rows[0]
    row_flags(r, header=True)
    for c in r.cells:
        shade_cell(c, LIGHT)
    cell_text(r.cells[0], "No.", bold=True, size=SMALL, align=WD_ALIGN_PARAGRAPH.CENTER)
    cell_text(r.cells[1], lab_q, bold=True, size=SMALL)
    a = merge(r, 2, 7)
    cell_text(a, lab_a, bold=True, size=SMALL, align=WD_ALIGN_PARAGRAPH.CENTER)
    keep_row_with_next(r)


def yn_cells(row, size=TABLE):
    for lab, (a, b) in zip(("Yes", "No", "N/A"), ((2, 3), (4, 5), (6, 7))):
        c = merge(row, a, b)
        p = c.paragraphs[0]
        fmt(p, align=WD_ALIGN_PARAGRAPH.CENTER)
        box(p, 14)
        run(p, f" {lab}", size=size)
        c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER


def rate_cells(row):
    for i, lab in enumerate(("1", "2", "3", "4", "5", "N/A")):
        c = row.cells[2 + i]
        p = c.paragraphs[0]
        fmt(p, align=WD_ALIGN_PARAGRAPH.CENTER)
        box(p, 14)
        p2 = fmt(c.add_paragraph(), align=WD_ALIGN_PARAGRAPH.CENTER)
        run(p2, lab, size=SMALL - 1 if lab == "N/A" else SMALL, bold=True)
        c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER


def matrix(doc, sec):
    items = sec["items"]
    n_rows = 1 + len(items) + 1
    t = table_base(doc, n_rows)
    header_row(t)
    for i, (kind, text, anchors) in enumerate(items, 1):
        r = t.rows[i]
        row_flags(r, min_h=0.36)
        cell_text(r.cells[0], f"{sec['id']}{i}", bold=True, size=SMALL + 0.5, align=WD_ALIGN_PARAGRAPH.CENTER)
        q = r.cells[1]
        fmt(q.paragraphs[0])
        run(q.paragraphs[0], text)
        q.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        if kind == "yn":
            yn_cells(r)
        else:
            p = fmt(q.add_paragraph(), before=2)
            run(p, "Rating: " + anchors, size=SMALL, italic=True, color=GREY)
            for c in r.cells:
                shade_cell(c, TINT)
            rate_cells(r)
        if i == 1:  # keep the heading row with the first item, the last item with its comment box
            keep_row_with_next(r)
    for r in t.rows[-3:-1]:  # last two items stay with the comment box
        keep_row_with_next(r)
    last = t.rows[-1]
    row_flags(last, min_h=0.6)
    c = merge(last, 0, 7)
    cell_text(c, sec["comment"], bold=True, size=SMALL, valign="top")
    fix_widths(t)


def process_validation(doc):
    section_bar(doc, "K", "PROCESS VALIDATION AND POSSIBLE ERRORS", "Everyone").paragraph_format.page_break_before = True
    p = fmt(doc.add_paragraph(), after=4, keep_next=True)
    run(p, "Please answer based on your knowledge of the actual Graduate School process. ", size=BODY)
    run(p, "In this part, Yes means you found a problem.", size=BODY, bold=True)
    t = table_base(doc, 1 + len(VALIDATION))
    header_row(t, "Question", "Problem found?")
    for i, (q, prompt) in enumerate(VALIDATION, 1):
        r = t.rows[i]
        row_flags(r, min_h=0.95)
        cell_text(r.cells[0], f"K{i}", bold=True, size=SMALL + 0.5, align=WD_ALIGN_PARAGRAPH.CENTER, valign="top")
        c = r.cells[1]
        fmt(c.paragraphs[0])
        run(c.paragraphs[0], q)
        p2 = fmt(c.add_paragraph(), before=4)
        run(p2, prompt, size=SMALL, italic=True, color=GREY)
        yn_cells(r)
        for cc in r.cells[2:]:
            cc.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP
    fix_widths(t)
    p = fmt(doc.add_paragraph(), before=8, keep_next=True)
    run(p, "Other comments or suggestions:", size=TABLE, bold=True)
    t2 = table_base(doc, 1, [TEXT_W])
    row_flags(t2.rows[0], min_h=1.2)


def acceptance(doc):
    p = doc.add_paragraph("USER ACCEPTANCE", style="Heading 1")
    fmt(p, before=14, after=4, keep_next=True, keep_lines=True)
    shade_par(p, GREEN)
    p = fmt(doc.add_paragraph(), before=4, after=4, keep_next=True)
    run(p, "Based on the system demonstrated and tested in this session (with sample data), please select the statement that best represents your assessment. Tick one box.", size=BODY)
    opts = [("ACCEPTED", "The demonstrated system sufficiently represents and supports the tested Graduate School processes."),
            ("ACCEPTED WITH MINOR REVISIONS", "The system generally represents the Graduate School process correctly, but some minor improvements or corrections are recommended."),
            ("REQUIRES MAJOR REVISIONS", "Important workflow, requirement, role, or system issues must be addressed before the system can be considered acceptable.")]
    t = table_base(doc, 3, [0.6, TEXT_W - 0.6])
    for r, (a, b) in zip(t.rows, opts):
        row_flags(r, min_h=0.7)
        keep_row_with_next(r)
        p = fmt(r.cells[0].paragraphs[0], align=WD_ALIGN_PARAGRAPH.CENTER)
        box(p, 20)
        r.cells[0].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        c = r.cells[1]
        run(fmt(c.paragraphs[0]), a, bold=True, size=BODY)
        run(fmt(c.add_paragraph(), before=2), b, size=TABLE)
        c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    fmt(doc.add_paragraph(), after=4)
    t = table_base(doc, 2, [TEXT_W])
    row_flags(t.rows[0], min_h=1.0)
    row_flags(t.rows[1], min_h=1.0)
    keep_row_with_next(t.rows[0])
    cell_text(t.rows[0].cells[0], "Reason for assessment:", bold=True, size=SMALL, valign="top")
    cell_text(t.rows[1].cells[0], "The most important changes needed before the Graduate School could use the system:", bold=True, size=SMALL, valign="top")
    p = fmt(doc.add_paragraph(), before=8, after=2, keep_next=True)
    box(p, 13)
    run(p, " I agree that my answers on this form may be used in the CAP-2521-IT capstone paper. Taking part is voluntary.", size=SMALL + 0.5)
    p = fmt(doc.add_paragraph(), before=6, keep_next=True)
    run(p, "Evaluator", size=TABLE, bold=True)
    t = table_base(doc, 2, [1.7, TEXT_W / 2 - 1.7, 1.2, TEXT_W / 2 - 1.2])
    cells = [("Printed name", "Position / office"), ("Signature", "Date")]
    for r, (a, b) in zip(t.rows, cells):
        row_flags(r, min_h=0.5)
        keep_row_with_next(r)
        shade_cell(r.cells[0], LIGHT)
        shade_cell(r.cells[2], LIGHT)
        cell_text(r.cells[0], a, bold=True, size=SMALL)
        cell_text(r.cells[2], b, bold=True, size=SMALL)


def sus_page(doc):
    p = doc.add_paragraph("SYSTEM USABILITY SCALE (SUS) \u2013 OPTIONAL", style="Heading 1")
    fmt(p, before=0, after=0, keep_next=True)
    p.paragraph_format.page_break_before = True
    shade_par(p, GREEN)
    q = fmt(doc.add_paragraph(), after=3, keep_next=True)
    shade_par(q, GREEN)
    run(q, "Mainly for: anyone who used the system during the session", size=SMALL, color="FFFFFF")
    p = fmt(doc.add_paragraph(), before=4, after=6)
    run(p, "Think about the system as a whole. Give your first reaction to each statement; do not think about it for long. If you cannot decide, tick the middle box (3). If you only watched the demonstration, you may skip this page.", size=TABLE)
    grid = [0.5, 3.1, 0.66, 0.66, 0.66, 0.66, 0.66]
    t = table_base(doc, 2 + len(SUS_ITEMS), grid)
    r0 = t.rows[0]
    row_flags(r0, header=True)
    for c in r0.cells:
        shade_cell(c, LIGHT)
    cell_text(r0.cells[0], "No.", bold=True, size=SMALL, align=WD_ALIGN_PARAGRAPH.CENTER)
    cell_text(r0.cells[1], "Statement", bold=True, size=SMALL)
    for i in range(5):
        c = r0.cells[2 + i]
        p = fmt(c.paragraphs[0], align=WD_ALIGN_PARAGRAPH.CENTER)
        run(p, str(i + 1), size=SMALL, bold=True)
        if i in (0, 4):
            for word in (("Strongly", "disagree") if i == 0 else ("Strongly", "agree")):
                run(fmt(c.add_paragraph(), align=WD_ALIGN_PARAGRAPH.CENTER), word, size=SMALL - 1)
    for i, text in enumerate(SUS_ITEMS, 1):
        r = t.rows[i]
        row_flags(r, min_h=0.45)
        cell_text(r.cells[0], f"S{i}", bold=True, size=SMALL + 0.5, align=WD_ALIGN_PARAGRAPH.CENTER)
        cell_text(r.cells[1], text)
        for k in range(5):
            p = fmt(r.cells[2 + k].paragraphs[0], align=WD_ALIGN_PARAGRAPH.CENTER)
            box(p, 14)
            r.cells[2 + k].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    last = t.rows[-1]
    row_flags(last)
    c = last.cells[0].merge(last.cells[6])
    cell_text(c, "1 = Strongly disagree   \u00b7   3 = Neither   \u00b7   5 = Strongly agree", size=SMALL, italic=True, color=GREY,
              align=WD_ALIGN_PARAGRAPH.CENTER)
    fix_widths(t, grid)



# Word is strict about child order inside these property blocks; helpers above append, so sort once at the end.
ORDER = {
    "pPr": "pStyle keepNext keepLines pageBreakBefore framePr widowControl numPr suppressLineNumbers pBdr shd tabs suppressAutoHyphens kinsoku wordWrap overflowPunct topLinePunct autoSpaceDE autoSpaceDN bidi adjustRightInd snapToGrid spacing ind contextualSpacing mirrorIndents suppressOverlap jc textDirection textAlignment textboxTightWrap outlineLvl divId cnfStyle rPr sectPr pPrChange",
    "trPr": "cnfStyle divId gridBefore gridAfter wBefore wAfter cantSplit trHeight tblHeader tblCellSpacing jc hidden",
    "tcPr": "cnfStyle tcW gridSpan hMerge vMerge tcBorders shd noWrap tcMar textDirection tcFitText vAlign hideMark",
    "tblPr": "tblStyle tblpPr tblOverlap bidiVisual tblStyleRowBandSize tblStyleColBandSize tblW jc tblCellSpacing tblInd tblBorders shd tblLayout tblCellMar tblLook tblCaption tblDescription",
}


def normalize(root):
    for tag, names in ORDER.items():
        rank = {n: i for i, n in enumerate(names.split())}
        for el in root.iter(qn(f"w:{tag}")):
            kids = list(el)
            seen, keep = set(), []
            for k in kids:
                name = k.tag.split("}")[1]
                if name in ("cantSplit", "tblHeader") and name in seen:
                    el.remove(k)
                    continue
                seen.add(name)
                keep.append(k)
            for k in keep:
                el.remove(k)
            for k in sorted(keep, key=lambda k: rank.get(k.tag.split("}")[1], 999)):
                el.append(k)


# ---------------------------------------------------------------- build


def build():
    doc = Document()
    setup(doc)
    footer(doc)
    header_block(doc)
    evaluator_block(doc)
    intro(doc)
    p = doc.add_paragraph("USABILITY CRITERIA MATRIX", style="Heading 1")
    fmt(p, before=14, after=4, keep_next=True)
    shade_par(p, GREEN)
    first = True
    for sec in SECTIONS:
        if first:
            first = False
            q = fmt(doc.add_paragraph(), before=4, after=2, keep_next=True)
            run(q, "Sections A\u2013J. Yes always means the system worked or is appropriate.", size=SMALL, italic=True, color=GREY)
        section_bar(doc, sec["id"], sec["title"], sec["who"], sec.get("note"))
        matrix(doc, sec)
    if INCLUDE_SUS:
        sus_page(doc)
    process_validation(doc)
    acceptance(doc)
    for root in (doc.element, doc.styles.element, doc.sections[0].footer._element):
        normalize(root)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUT)
    print("saved", OUT)


if __name__ == "__main__":
    build()
