"""Build Migui's meeting cheat sheet (Word + PDF) for the 2026-11-04 stakeholder meeting.

    E:/Temp/claude/docs-venv/Scripts/python.exe scripts/demo/build_cheat_sheet.py   (python-docx; PDF via LibreOffice)
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "Documents" / "Capstone" / "Meeting_2026-11-04"
GREEN = RGBColor(0x0F, 0x5C, 0x3F)
SOFFICE = "E:/LibreOffice/program/soffice.exe"

doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)
for side in ("left_margin", "right_margin"):
    setattr(sec, side, Cm(1.8))
sec.top_margin = sec.bottom_margin = Cm(1.6)
base = doc.styles["Normal"]
base.font.name, base.font.size = "Calibri", Pt(10.5)
base.paragraph_format.space_after = Pt(2)
for name, size in (("Heading 1", 15), ("Heading 2", 12.5), ("Heading 3", 11)):
    st = doc.styles[name]
    st.font.name, st.font.size, st.font.bold, st.font.color.rgb = "Calibri", Pt(size), True, GREEN
    st.paragraph_format.space_before, st.paragraph_format.space_after = Pt(8 if size > 12 else 6), Pt(3)
    st.paragraph_format.keep_with_next = True


def shade(cell, hex_fill: str) -> None:
    tc = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill)
    tc.append(shd)


def para(text: str, *, bold_lead: bool = True, style: str | None = None, size: float | None = None):
    """'Lead: rest' renders Lead in bold."""
    p = doc.add_paragraph(style=style)
    if bold_lead and ": " in text and text.index(": ") < 60:
        lead, rest = text.split(": ", 1)
        r = p.add_run(lead + ": ")
        r.bold = True
        p.add_run(rest)
    else:
        p.add_run(text)
    if size:
        for r in p.runs:
            r.font.size = Pt(size)
    return p


def bullets(items, level: int = 0) -> None:
    for it in items:
        if isinstance(it, (list, tuple)):
            bullets(it, level + 1)
            continue
        p = para(it, style="List Bullet" if level == 0 else "List Bullet 2")
        p.paragraph_format.space_after = Pt(1)


def table(rows, widths, header=True) -> None:
    t = doc.add_table(rows=len(rows), cols=len(rows[0]))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    for j, w in enumerate(widths):
        t.columns[j].width = Cm(w)
    for i, row in enumerate(rows):
        for j, val in enumerate(row):
            c = t.cell(i, j)
            c.width = Cm(widths[j])
            c.text = ""
            r = c.paragraphs[0].add_run(str(val))
            r.font.size = Pt(9.5)
            if header and i == 0:
                r.bold = True
                shade(c, "DCEFE6")
    doc.add_paragraph().paragraph_format.space_after = Pt(0)


def qa(pairs) -> None:
    for q, a in pairs:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.keep_with_next = True
        r = p.add_run("Q: " + q)
        r.bold = True
        a_p = doc.add_paragraph()
        a_p.paragraph_format.left_indent = Cm(0.5)
        a_p.paragraph_format.space_after = Pt(4)
        a_p.add_run("A: " + a)


# ---------------------------------------------------------------------------------------------------------------
title = doc.add_paragraph()
r = title.add_run("Meeting Cheat Sheet — Migui")
r.bold, r.font.size, r.font.color.rgb = True, Pt(20), GREEN
sub = doc.add_paragraph()
sub.add_run("Stakeholder meeting, 4 November 2026 · Graduate Student Lifecycle Monitoring and Analytics Platform · CAP-2521-IT").italic = True

doc.add_heading("1. My parts at a glance", 1)
table([
    ["Part", "What", "Sign in as", "Time", "Reset before"],
    ["2d", "Monitoring Sheet", "staff@usls.edu.ph", "8 min", "nothing (adds a new student)"],
    ["2h", "Leave of Absence → Readmission → AWOL", "student, staff, dean", "8 + 6 + 6 min", "Daniel, Therese, Maya (Reset on the sign-in page)"],
    ["2l", "Reports & Analytics", "staff@usls.edu.ph", "6 min", "nothing (read-only)"],
    ["2m", "Best Features (closing)", "no sign-in, slides", "2 min", "—"],
], [1.2, 5.4, 3.6, 2.4, 4.8])
bullets([
    "Password: every demo account uses the same shared demo password. The sign-in page lists the demo accounts under 'Demo accounts' — one click fills them in.",
    "Student demo logins: loa.daniel@usls.edu.ph (LOA), readmission.therese@usls.edu.ph (Readmission), awol.maya@usls.edu.ph (AWOL).",
    "Site: https://miguisanson.dev (runs on my PC through Cloudflare). Backup: this PC runs the same site without Docker (deploy/START-SITE.cmd); open http://127.0.0.1:5000.",
    "If a drag and drop does not go through: use 'Move to…' on the card. It is the same step, checked by the same rules.",
    "Recorded videos of every part are in Documents/Capstone/Meeting_2026-11-04/ — play them if the live site misbehaves.",
])

doc.add_heading("2. The one-sentence story", 1)
para("Problem: the Graduate School tracks each student's journey in separate Excel sheets, e-mails and paper letters, so nobody can see at once where a student is, what is waiting, or who must act next.")
para("Our answer: one portal that follows every student from admission to graduation, applies the Handbook rules on each screen, routes each request to the right office and the Dean, keeps an audit trail of who did what, and turns the records into reports.")
para("What it is not: it is not the system of record. AIMS stays the official source for student identity, enrollment and grades; the portal monitors, coordinates and supports decisions on top of it.")

doc.add_heading("3. Part 2d — Monitoring Sheet", 1)
para("Say: this is the curriculum grid the office used to keep in Excel — one row per student, one column per subject — now kept on the screen, with every entry remembering where it came from.")
bullets([
    "Where: Records > Monitoring Sheet (staff and Academic Coordinator can edit; Research Coordinator and Dean view only).",
    "Steps: choose MSN → Add student (ID, names, AY entry 26-27) → 'Add subjects now' → add MSN-FED and MSN-MOR (Completed, term, remark) → edit a remark → remove one row with a reason → Change history tab → back to the grid (Manual tag, orange dot) → open an imported student (Katrina Cabrera) → Edit asks for a reason.",
    "Provenance: every value is 'Imported' (from the AC workbook) or 'Manual entry' (who, when, reason). Owner decision 2026-10-01: direct add/edit is allowed, but always stamped and audited.",
    "Imported values are protected: changing one needs a written reason that goes into the history. A later workbook upload that disagrees with a portal value is held for review, not overwritten.",
    "Removing a row does not erase it: it goes back to 'not taken' and stays in the history.",
    "Adding a student creates a Student Portal login, same as the sheet import.",
    "Grades are never entered here — AIMS is the official source for grades.",
])
qa([
    ("Why not just keep the Excel file?", "Excel cannot tell you who changed a cell, when or why, and every coordinator keeps a different copy. Here there is one record, every change is audited, and the same data feeds Enrollment, Reports and the student's own view. Upload still works for those who prefer Excel."),
    ("Can someone change official data by mistake?", "Not silently. Imported values need a reason to change, the change is logged with the person's name, and grades and official enrollment are not editable at all."),
    ("Where does the imported data come from?", "The Academic Coordinator's monitoring workbook (the AC Student Monitoring template), uploaded under Student Handoff, and the AIMS export. The import checks required fields and duplicates."),
])

doc.add_heading("4. Part 2h — Leave of Absence, Readmission, AWOL", 1)
para("Say: three standing changes, one kind of board. Once you know one board you know all of them: columns are stages, cards are requests, the request window shows the policy check, and the Registrar list is the hand-off.")
doc.add_heading("Leave of Absence (Daniel Fernandez, MAED)", 3)
bullets([
    "Student: Requests > Leave of Absence → start AY 2026-2027 2nd Sem, end AY 2027-2028 1st Sem (two semesters), reason Employment, explanation → check box → Send.",
    "Staff: Standalone Processes > Leave of Absence → search Daniel → drag Submitted → In staff review → Table/Board → View details → Policy check → Forward to Dean with a note → card locks: 'Waiting for: Dean'.",
    "Dean: drag to Leave scheduled → Approve with a note (Return for revision / Deny need a comment the student reads).",
    "Staff: drag to On leave ('Start the leave now'; normally starts by itself on its first day) → Registrar list → Download list (CSV/Excel) → tick → Mark as sent.",
    "Rules (Handbook p. 52-53): leave approved for one year, renewable for at most another year (portal: up to 2 semesters per request, 4 in total); request in writing to the Dean with reason and period; no leave within 2 weeks before the last day of classes; leave counts toward the maximum residence.",
    "Policy check = advice only. 'Minimum residency' shows Needs review because it is a prototype rule. Only the Dean approves.",
])
doc.add_heading("Readmission (Therese Lacson, MAED, on leave)", 3)
bullets([
    "Student: Requests > Readmission → the leave the student is ending is pre-filled → return semester → why ready → tick 4 checklist items → Send.",
    "Staff: drag to In staff review → View details (return semester, linked leave, checklist 'not verified by staff yet', history: 2 of 4 leave semesters used) → Policy check: 'Return semester after the leave' = Needs review (early return: Dean decides) → Forward, ticking what staff verified (unticked items reach the Dean as Needs review).",
    "Dean: drag to Approved – back in the program. Student is active again; the Academic Coordinator plans the subjects next (readmission does not enroll).",
    "Rule (Handbook p. 53): a returnee declares the intention to enroll in writing to the Registrar through the Dean. p. 45: clearance, interview, evaluation, Advise Slip.",
])
doc.add_heading("AWOL and Return from AWOL (Maya Torres, MAED)", 3)
bullets([
    "Nobody types 'AWOL'. The system flags it from records: an imported AWOL standing, or a full-semester withdrawal with no approved leave (AWOL only after a leave ends plus a grace period).",
    "Staff: AWOL & Residency → search Maya → card in AWOL, 'Waiting for: Student' — staff cannot move it.",
    "Student: Requests > Return from AWOL → return semester, last enrolled semester, written intention, reason → Send. Classified 'Within Maximum Residence'.",
    "Staff: card moved by itself to Return review → policy check 'Eligible for Dean Review' → drag to With the Dean with a note. Dean: drag to Back in the program.",
    "Registrar list here = one report per approved return, Download report. Enrollment afterwards = Academic Coordinator.",
    "Rules (Handbook p. 53-55): leaving without a formal leave = AWOL, registration curtailed; master's: normal 5 years, absolute 7 (with a 2-year extension and a graded 6-unit refresher); doctorate: 7 and 9; leave counts toward residence.",
])
qa([
    ("Why does the portal not e-mail the Registrar?", "On purpose. Official communication goes through the Graduate School's own channel. The portal prepares the list, staff send it, then mark it sent and acknowledged, so there is always a record of what was handed over."),
    ("Can staff approve a leave themselves?", "No. Staff review and forward; the card locks for staff once it is with the Dean. The server refuses any move the rules do not allow, even by drag and drop."),
    ("What does 'Needs review' mean?", "A rule that is a prototype value the Graduate School still has to confirm. It is shown honestly instead of pretending it is official, and the Dean decides."),
    ("What if a student is wrongly flagged AWOL?", "The flag comes from the imported standing or the semester records, so the fix is to correct the source record (or the student files a return). Staff cannot type an AWOL flag by hand, which also means nobody can be flagged by accident."),
    ("Is the paper LOA letter still needed?", "The Handbook asks for a written request to the Dean. The portal's form is the structured written request; whether the Dean accepts it in place of a letter is one of the decisions for the Graduate School (rule LOA-12, Proposed). The drafted forms pack includes the paper version too."),
])

doc.add_heading("5. Part 2l — Reports & Analytics", 1)
para("Say: every case so far followed one student; this screen answers what the Graduate School knows about all students at once. Every number is computed from recorded events, not typed in, and every number opens the students behind it.")
bullets([
    "Where: Overview > Reports & Analytics. Filters on top: Program, Entry cohort, Period (default: last 12 months, compared with the 12 months before).",
    "Six numbers: Active students · Behind schedule (vs target 10%) · Requests waiting more than 7 days · Median days to decide · Defenses held · Endorsements sent to the Dean.",
    "Needs attention: what is holding students back (no progress for a long time, coursework behind, documents missing, AWOL); select a bar to list the students; full list with next owner; Excel/PDF download.",
    "Where students get stuck: per stage, On time (< 120 days), Slow (120–209), Stuck (210+), counted from the day the student entered the stage (real stage clock).",
    "Office speed: which offices take longest to close requests (0–7, 8–14, 15–30, over 30 days).",
    "Records to fix: research students with missing records (e.g. no adviser).",
    "Older lists kept: Cohorts by stage, Graduation candidates, Overdue and pending, Defenses. Registrar changes: the daily list the Registrar must apply in AIMS.",
    "Dean has own tabs (waiting for the Dean, decision speed, outcomes, graduation pipeline, students by stage).",
    "Risk reads 'Not Yet Assessed' where the official risk rules are not confirmed — we do not invent High/Medium/Low.",
])
qa([
    ("Where do the targets (10%, 7 days) come from?", "They are starting values for discussion, not Graduate School policy. We would like the Graduate School to set its own targets; changing them is a setting."),
    ("Is the data real?", "No. Everything on the demo site is seeded demo data (made-up students). It is rebuilt with one command, and no real student data is stored."),
    ("Can we get this for the CHED or university reports?", "Every table downloads as Excel or PDF with the current filters. If there is a fixed report format the Graduate School must submit, give us the template and we can match it."),
])

doc.add_heading("6. Part 2m — Best Features (closing, ~2 minutes)", 1)
bullets([
    "Rules with a source on every screen: one register of rules with the Handbook or Protocol page and a label — Enforced by the system, Documented only, or Needs review. Refusals quote the rule. (Withdrawal, Leave, Enrollment.)",
    "A policy library and an assistant that cites its source: answers only from the Handbook, Research Protocol, the draft Operations Manual and uploaded documents; names the document and page; says so when the library does not cover a question.",
    "Panel matching that explains itself: score out of 100 = topic similarity 60 + availability 25 + workload 15, breakdown on screen; different papers rank differently; the student's adviser is never offered; a person makes the final choice.",
    "Scheduling that checks before it books: hard stops (double-booked panelist or room, declined invitation, slot in the past) vs soft warnings that can be overridden with a recorded reason; calendars for every role; optional Google Calendar per faculty member.",
    "Shared boards and reports computed from records: same board, Board/Table views and request window for Leave, Readmission, AWOL, Withdrawal, Practicum and Graduation; every move recorded; Reports from those records.",
    "Common thread: each feature takes data the Graduate School already has, plus the policy that governs it, and produces a decision, a warning or a measurement — not just storage.",
    "Honest limits: no e-mail from the portal; Google Calendar optional; official data only from the AIMS import; the Operations Manual and rules marked Needs review wait for Graduate School validation.",
])

doc.add_heading("7. Questions the panel or stakeholders may ask (any part)", 1)
qa([
    ("Who can see what?", "Each account has one role: Student, Faculty, GS Staff, Academic Coordinator, Research Coordinator, Dean, Administrator. The server decides which portal opens and checks the role on every action, not only in the menu."),
    ("Is it secure enough for real data?", "It was built and tested as a demo: password sign-in with lockout, role checks on every request, audit log, security headers, uploads size-limited. Before real data it would need the university's sign-in (e.g. Google Workspace), hosting by the university's IT, backups and a data-privacy review under the Data Privacy Act of 2012."),
    ("What technology is it?", "Python (Flask) back end with a SQLite database, React front end. It runs on one computer; for the demo it is published through a Cloudflare Tunnel at miguisanson.dev."),
    ("How was it tested?", "Automated tests run on every change, and the screens of every role were clicked through in a browser before the demo."),
    ("Where did the processes come from?", "The Graduate School Handbook 2022-2023, the Research Protocol AY 2024-2025, the AC monitoring sheets, the defense panel's comments, and our draft Operations Manual, which we ask the Graduate School to validate. Each rule on screen names its source."),
    ("What do you need from us?", "Validation of the Operations Manual and the forms pack (signatures), confirmation of the rules marked Needs review, the UAT evaluation forms, and answers to three open questions (below)."),
    ("Does it replace AIMS?", "No. AIMS stays the official system for identity, enrollment and grades. The portal reads AIMS exports and prepares lists for the Registrar to apply in AIMS."),
    ("Does it work on a phone?", "Yes. Every board becomes a card list on a phone, and the Dean's screens were tested on phone size."),
    ("What about the Policy Assistant giving wrong answers?", "It is decision support, not an official ruling. It answers only from the uploaded policy documents and shows the passage it used so the answer can be checked; when the documents do not cover a question it says so."),
    ("Google Calendar?", "Optional, per faculty member, from My Calendar. It reads only free/busy times (never event details) and writes only the defense events the system creates. Testers must be added as Google test users while the Google app is in testing."),
])

doc.add_heading("8. Open questions to ask the Graduate School", 1)
bullets([
    "Subject withdrawal after the 14-day window: the message says a student may still withdraw from all subjects — is there an 'all subjects' withdrawal process, and how does it run? (I-167, Handbook p. 49/51)",
    "Dropping a subject: should staff be allowed to record a 'documented exception' (e.g. late drop with a reason)? The Handbook p. 52 does not mention one. (I-170)",
    "Title Defense: the catalog says it cannot be scheduled sooner than 14 days — may staff waive this with a recorded reason? (I-174)",
    "Prototype rules marked Needs review (e.g. minimum residency for leave, risk thresholds, report targets): confirm or give the correct values.",
    "Will the Dean accept the portal's structured form as the written LOA / readmission request (rules LOA-12, RDM-05)?",
    "Forms pack: review, sign and set effectivity dates; tell us any form the office already uses that we should match instead.",
])

doc.add_heading("9. Documents to hand over and get signed", 1)
bullets([
    "Forms pack (Documents/Graduate_School/Forms/USLS-GS-Forms-Pack.pdf, print it): 44 Graduate School forms GS-F-01 to GS-F-44 in lifecycle order, plus GS-P-01 Forms Approval Sheet (first page) and GS-P-02 Forms Routing Guide.",
    "How to present it: \"The panel asked for the school's forms. Apart from the Handbook and the Research Protocol, most were never written down, so we drafted them from those two documents, keeping the Protocol's form numbers. Each form cites its rule. Please review, mark changes on the Approval Sheet, and sign it; once signed with an effectivity date they are the official forms, and the portal already asks for the same information.\"",
    "Open questions for the forms are listed at the end of Documents/Graduate_School/Forms/00-INVENTORY.md (e.g. whether the office already has templates for Forms 1-13, defense fees, ethics committee forms). Ask these questions while the Dean signs.",
    "UAT form (Documents/Capstone/UAT/[CAP-IT2] UAT Instrument - Revised.pdf): one per evaluator, after the demo. Sections A, I, J for everyone plus the sections marked for the evaluator's own role. Allow about 20-25 minutes.",
    "Operations Manual (PDF: Documents/Graduate_School/Operations_Manual/USLS GS Operations Manual - DRAFT for Validation.pdf): the process descriptions the forms follow; ask for validation the same way.",
])

doc.add_heading("10. If something goes wrong", 1)
table([
    ["Problem", "Do this"],
    ["Site does not load", "Check the PC is on and the window called 'USLS site - keep open' is still open. If not, double-click deploy/START-SITE.cmd and leave both windows it opens; after a minute https://miguisanson.dev/api/health should say status ok. Docker is not used on this PC. Or play the recorded video."],
    ["A demo student is already used up", "Sign-in page > Demo accounts > Student workflow demos > Reset next to that student."],
    ["Drag and drop does not move the card", "Use 'Move to…' on the card, or the button in View details. Same step."],
    ["Numbers differ from the rehearsal", "Expected: reports are live measurements. Read them off the screen."],
    ["Policy Assistant says \"Offline answer\"", "Expected today: Gemini was failing (HTTP 503) on 4 Nov, so the site runs without it. The answer is still quoted and cited from the Handbook / Protocol."],
    ["Withdrawal window is closed", "The demo semester is dated from the day of the seed; reset in the morning: close the 'USLS site' window, double-click deploy/RESET-DEMO-DATA.cmd, then deploy/START-SITE.cmd again."],
    ["Someone asks for a feature we do not have", "Write it down, say it goes into the improvement list, and ask which office would use it and how often."],
], [5.0, 12.4])

OUT.mkdir(parents=True, exist_ok=True)
docx_path = OUT / "MEETING-CHEAT-SHEET.docx"
doc.save(docx_path)
print("saved", docx_path)
if "--no-pdf" not in sys.argv:
    subprocess.run([SOFFICE, "--headless", "-env:UserInstallation=file:///E:/Temp/claude/lo-profile-cheat", "--convert-to", "pdf",
                    "--outdir", str(OUT), str(docx_path)], check=False, capture_output=True)
    print("pdf", (OUT / "MEETING-CHEAT-SHEET.pdf").exists())
