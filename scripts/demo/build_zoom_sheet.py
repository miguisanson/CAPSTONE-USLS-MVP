"""Build ZOOM-CHEAT-SHEET.docx/.pdf for Migui (generator kept outside the repo)."""
import subprocess
from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

OUT = Path(r"E:\Github_Projects\CAPSTONE-USLS-MVP\Documents\Capstone\Meeting_2026-11-04")
GREEN = RGBColor(0x0F, 0x5C, 0x3F)
SOFFICE = "E:/LibreOffice/program/soffice.exe"

doc = Document()
sec = doc.sections[0]
sec.orientation = WD_ORIENT.LANDSCAPE
sec.page_width, sec.page_height = Cm(29.7), Cm(21.0)
sec.left_margin = sec.right_margin = Cm(1.5)
sec.top_margin = sec.bottom_margin = Cm(1.3)
W = 26.7
base = doc.styles["Normal"]
base.font.name, base.font.size = "Calibri", Pt(10)
base.paragraph_format.space_after = Pt(2)
for name, size in (("Heading 1", 14), ("Heading 2", 11.5), ("Heading 3", 10.5)):
    st = doc.styles[name]
    st.font.name, st.font.size, st.font.bold, st.font.color.rgb = "Calibri", Pt(size), True, GREEN
    st.paragraph_format.space_before, st.paragraph_format.space_after = Pt(7 if size > 12 else 5), Pt(2)
    st.paragraph_format.keep_with_next = True

# page number footer
fp = sec.footer.paragraphs[0]
fp.add_run("Zoom cheat sheet - Migui - 4 Nov 2026 - page ").font.size = Pt(8)
r = fp.add_run()
r.font.size = Pt(8)
for t, txt in (("begin", None), (None, "PAGE"), ("end", None)):
    if t:
        e = OxmlElement("w:fldChar")
        e.set(qn("w:fldCharType"), t)
    else:
        e = OxmlElement("w:instrText")
        e.set(qn("xml:space"), "preserve")
        e.text = txt
    r._r.append(e)


def shade(cell, fill):
    tc = cell._tc.get_or_add_tcPr()
    s = OxmlElement("w:shd")
    s.set(qn("w:val"), "clear")
    s.set(qn("w:color"), "auto")
    s.set(qn("w:fill"), fill)
    tc.append(s)


def rich(p, text, size=None):
    """'Lead: rest' -> bold lead."""
    if ": " in text and text.index(": ") < 45:
        lead, rest = text.split(": ", 1)
        a = p.add_run(lead + ": ")
        a.bold = True
        b = p.add_run(rest)
        runs = (a, b)
    else:
        runs = (p.add_run(text),)
    if size:
        for x in runs:
            x.font.size = Pt(size)


def para(text, size=None):
    p = doc.add_paragraph()
    rich(p, text, size)
    return p


def bullets(items, size=None):
    for it in items:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.space_after = Pt(1)
        rich(p, it, size)


def table(rows, widths, size=8.5, group_rows=(), header=True):
    t = doc.add_table(rows=len(rows), cols=len(rows[0]))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    for i, row in enumerate(rows):
        tr = t.rows[i]._tr
        pr = tr.get_or_add_trPr()
        cs = OxmlElement("w:cantSplit")
        pr.append(cs)
        if i == 0 and header:
            h = OxmlElement("w:tblHeader")
            pr.append(h)
        if i in group_rows:
            m = t.cell(i, 0).merge(t.cell(i, len(row) - 1))
            m.text = ""
            rr = m.paragraphs[0].add_run(row[0])
            rr.bold, rr.font.size = True, Pt(size + 0.5)
            rr.font.color.rgb = GREEN
            shade(m, "EAF4EE")
            m.paragraphs[0].paragraph_format.keep_with_next = True
            continue
        for j, val in enumerate(row):
            c = t.cell(i, j)
            c.width = Cm(widths[j])
            c.text = ""
            c.paragraphs[0].paragraph_format.space_after = Pt(0)
            rr = c.paragraphs[0].add_run(str(val))
            rr.font.size = Pt(size)
            if i == 0 and header:
                rr.bold = True
                shade(c, "DCEFE6")
            elif j == 0:
                rr.bold = True
    for j, w in enumerate(widths):
        t.columns[j].width = Cm(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)


def qa(pairs, size=9.5):
    for q, a in pairs:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.keep_with_next = True
        x = p.add_run("Q: " + q)
        x.bold, x.font.size = True, Pt(size)
        ap = doc.add_paragraph()
        ap.paragraph_format.left_indent = Cm(0.5)
        ap.paragraph_format.space_after = Pt(3)
        y = ap.add_run("A: " + a)
        y.font.size = Pt(size)


# ======================================================================================
t = doc.add_paragraph()
r = t.add_run("Zoom Cheat Sheet - Migui")
r.bold, r.font.size, r.font.color.rgb = True, Pt(19), GREEN
s = doc.add_paragraph()
s.add_run("Meeting with the group and the Graduate School, 4 November 2026. "
          "Order: 1 Forms pack, 2 UAT instrument, 3 Demo parts, 4 Where the files are. "
          "Marked check = the sources do not settle it. Say it as open.").italic = True

# ---------------------------------------------------------------- PART 1
doc.add_heading("Part 1 - USLS Graduate School forms pack (60 documents)", 1)
bullets([
    "What it is: 54 forms (GS-F-01 to GS-F-54) plus 6 policy and control documents: GS-P-01 Forms Approval Sheet, GS-P-02 Forms Routing Guide, GS-P-03 Electronic Approval and Signature Policy, GS-P-04 Data Privacy Notice and Records Retention Schedule, GS-P-05 Platform Access and Roles Matrix, GS-P-06 AIMS and Registrar Data Exchange Specification. One print pack, 108 pages, approval sheet first.",
    "Where each sits: every form is in the folder of its Operations Manual chapter (4.01 to 4.19, for example 4.06 Leave of Absence), with its PDF beside the Word file. 0 Forms Control holds GS-P-01 and GS-P-02. Platform Basis (manual chapters 4.20 to 4.24) holds GS-F-45 to GS-F-48 and GS-P-03 to GS-P-06. Supplementary Forms holds GS-F-49 to GS-F-54, forms the Handbook names that the manual chapters did not cover. Each form names its manual section under its title.",
    "Why it was made: the Graduate School has almost nothing written down besides the Handbook 2022-2023. The Research Protocol describes Forms 1 to 13 but holds no layouts. The group drafted one clean, consistent set that matches the Handbook, the Protocol and the web app's workflows. Every form has blank control fields: form code, revision no. (00), effectivity date.",
    "How it was checked (3 Nov): every rule sentence, citation, form number and title was read against the Handbook, the Protocol and the Operations Manual rules file. About 310 statements and 160 citations. Errors found were fixed. Rules that rest only on working practice are marked 'proposed practice' or 'to be confirmed', or left blank. The forms never state a fee, deadline or limit that the Handbook or Protocol does not state.",
    "Honest line: nothing was shown to the Graduate School before today. The readings are not confirmed with the Dean yet. If the Graduate School already has its own form, that form replaces ours and the GS-F number is retired.",
    "New on 4 Nov (14 documents): GS-P-03 to GS-P-06 and GS-F-45 to GS-F-54. Handbook pages were read from the PDF before any rule was written. Section numbers of RA 8792 and RA 10173 were checked against the text of the Acts. What the platform sends to outside services, its roles and its import files were read from the program code. The new documents print no open questions; each is a numbered question below (29 to 47).",
    "GS-P-01 (the page the Dean signs): lists all 60 documents, grouped by manual chapter. For each document the reviewer marks Approved or writes the change required. The signatures approve the documents at Revision 00 and fix the effectivity date. Reviewers: Research Coordinator, Associate Dean, five Academic Coordinators (one for each college), Graduate Program Secretary. Approver: the Dean.",
    "GS-P-02 (read-only guide): one row per form, with its manual chapter. It shows when the form is used, who submits, who reviews, who decides, where the form goes next, and which web-app step records the same event.",
])

H = ["Code", "Document", "What it is for", "Filled by", "Signs / approves", "Based on", "Web-app process"]
Wd = [1.5, 4.0, 5.3, 2.9, 4.6, 3.7, 4.7]
G = []
rows = [H]


def grp(title):
    G.append(len(rows))
    rows.append([title] + [""] * 6)


def row(*a):
    rows.append(list(a))


grp("Admission and enrollment")
row("GS-F-01", "Onboarding Report for the Dean", "Report on a batch of newly admitted students. The Dean accepts it or returns it.", "Graduate School staff", "Academic Coordinator reviews; Dean accepts", "Ops Manual 4.1; Handbook pp. 42-47", "Admission: Dean onboarding gate")
row("GS-F-02", "Academic Advising and Study Plan", "Records the advising step before enrollment: subjects advised for the term.", "Student; Academic Coordinator", "Student; Academic Coordinator", "Handbook pp. 47-48", "Enrollment: study plan, Academic Coordinator review")
row("GS-F-04", "Term Course Offering Plan", "Subjects to offer each term, with undersized (special) classes.", "Academic Coordinator", "Dean approves", "Handbook pp. 48, 51", "Course Adjustments: offering plan")
grp("Subject changes")
row("GS-F-03", "Change or Add of Subject and Advice Slip", "Change or add one subject in the first week of classes. Includes the Advice Slip.", "Student", "Academic Coordinator recommends; Associate Dean approves an added subject; GS Office issues the slip", "Handbook pp. 48-49", "Course Adjustments")
row("GS-F-05", "Application for Withdrawal of Subject", "Withdraw subjects up to the second week; 10% / 20% charges.", "Student", "Academic Coordinator notes; Dean decides; Business Office assesses; Registrar processes", "Handbook pp. 49-51, 53", "Withdrawal: Dean Review, then Registrar")
row("GS-F-06", "Notice of Dropping from a Subject", "Drop when unexcused absence is over 20% of class hours.", "Professor", "Academic Coordinator verifies; student informed; Dean notes", "Handbook p. 52", "Monitoring: drop with absence evidence")
grp("Leave, AWOL, readmission")
row("GS-F-07", "Application for Leave of Absence", "Written request to the Dean for leave (new or extension).", "Student", "Academic Coordinator reviews; Dean decides; Business Office notes fee; Registrar notified", "Handbook pp. 48, 52-53, 55", "Leave of Absence board")
row("GS-F-08", "Application for Readmission (Return from Leave or AWOL)", "Written intention to enroll after a leave or AWOL.", "Student", "Academic Coordinator evaluates; Business Office clears; Dean endorses to Registrar; Registrar receives", "Handbook pp. 45, 53-55", "Readmission board")
row("GS-F-09", "Notice of Absence Without Leave (AWOL)", "Records AWOL status, with the source evidence.", "Graduate School staff or Academic Coordinator", "Dean notes", "Handbook p. 53. Form is a proposal: Handbook gives no notice", "AWOL case (AWOL Declared)")
grp("Residency and practicum")
row("GS-F-10", "Application for Residency Enrollment", "Enroll in residency (no subjects) for thesis, practicum, comprehensive exam, INC or publication.", "Student", "Academic Coordinator verifies; Dean or representative approves; Business Office", "Handbook pp. 48, 54-55", "Residency enrollment")
row("GS-F-11", "Practicum Agreement (Memorandum of Agreement)", "Agreement between student, host organization and the University.", "Student", "Host supervisor and representative; Academic Coordinator; Dean for the University", "Handbook p. 48. Proposed process", "Practicum: MOA Received")
row("GS-F-12", "Practicum Hours Log and Supervisor's Certification", "Daily hours log with supervisor certification.", "Student; host supervisor", "Host supervisor certifies", "Ops Manual 4.17 (no Handbook page)", "Practicum: hours and certificates")
row("GS-F-13", "Practicum Completion Report", "Academic Coordinator reports verified hours to the Dean.", "Academic Coordinator", "Dean reviews (no approval or denial)", "Ops Manual 4.17 (no Handbook page)", "Practicum: Report Sent to Dean, Dean Reviewed")
grp("Comprehensive examination")
row("GS-F-14", "Application for Comprehensive Examination", "Apply for the exam. Withdrawal of application is on the form.", "Student", "Academic Coordinator or College Dean evaluates; Graduate Program Secretary receives", "Handbook pp. 56-57", "Comprehensive exam status")
row("GS-F-15", "Comprehensive Examination Result Sheet", "Records the exam results.", "Academic Coordinator", "Graduate Program Secretary records; Dean notes", "Handbook p. 57", "Comprehensive exam: result recorded")
grp("Research: title, adviser, proposal")
row("GS-F-16", "Application for Title Defense (Protocol Form 1)", "Apply for the title defense.", "Student", "Academic Coordinator endorses; Research Coordinator receives", "Protocol, Title Defense I; Handbook pp. 59-60", "Research gate: Form 1 - Title Defense")
row("GS-F-17", "Panel Nomination and Invitation Reply Slip", "Nominate a panel; nominees reply to the invitation.", "Research Coordinator; nominees reply", "Research Coordinator nominates; Associate Dean notes; Committee deliberates", "Protocol, Title Defense I.4; Handbook pp. 60, 63. Reply slip proposed", "Panel matching and panel invitations")
row("GS-F-18", "Report of Title Defense (Form 2)", "Panel result of the title defense.", "Panel Chair", "Panel Chair and panel members", "Protocol, Title Defense III; Handbook pp. 60-61", "Title defense verdict")
row("GS-F-19", "Application for Designation of Research Adviser (Form 3)", "Student asks for a Research Adviser.", "Student", "Academic Coordinator notes; Research Coordinator forwards; Research Coordinator, Associate Dean, Dean deliberate", "Protocol, Designation I; Handbook pp. 58-59, 61", "Adviser Appointments: Applied, Noted, Under deliberation")
row("GS-F-20", "Appointment for Research Adviser (Form 3.1)", "Appoints the adviser. The adviser accepts or declines.", "Research Coordinator", "Research Coordinator, Associate Dean, Dean; adviser accepts", "Protocol, Designation I; Handbook pp. 58-59, 61-62", "Adviser Appointments: Appointed, Accepted")
row("GS-F-21", "Request for Change of Research Adviser (Form 3.1.1)", "Change of adviser, once only, before the proposal defense.", "Student", "Current and new adviser agree; Research Coordinator, Associate Dean, Dean decide", "Protocol, Change of Adviser; Handbook p. 62", "Adviser Appointments: Change request")
row("GS-F-22", "Research Timetable (Form 3.2)", "Research plan with dates, within 5 days of GS-F-20.", "Student and adviser", "Student; adviser; Research Coordinator receives", "Protocol, Designation II; Handbook pp. 58-59, 61-62", "Adviser Appointments: contract received")
row("GS-F-23", "Thesis / Dissertation Advising Contract (Form 3.3)", "Advising contract between student and adviser, within 5 days of GS-F-20.", "Student and adviser", "Student; adviser; Research Coordinator receives", "Protocol, Designation II; Handbook p. 59", "Adviser Appointments: contract received")
row("GS-F-24", "Request for Change of Title of the Study (Form 3.4)", "Change of title, once only, before the proposal defense application.", "Student", "Adviser endorses; panel decides; Panel Chair emails the decision", "Protocol, Change of Title; Handbook p. 62", "Not a separate step yet")
row("GS-F-25", "Statistical Consultation Form (Form 4.1)", "Statistician's recommendations. For quantitative studies.", "Statistician", "Statistician; student receives; adviser notes", "Protocol, Proposal Defense I; Handbook p. 63", "Research gate: Form 4")
row("GS-F-26", "Co-authorship Information for Publication (Form 4.2)", "Pre-identified co-authors for publication.", "Student", "Student; co-authors; adviser; Panel Chair notes", "Protocol, Proposal Defense I-II; Handbook p. 64", "Not a separate step yet")
grp("Research: defenses and completion")
row("GS-F-27", "Endorsement for Proposal / Final Defense (Form 4)", "Adviser endorses the proposal or closed-door final defense; schedule recorded.", "Research Adviser", "Adviser endorses; student acknowledges; Research Coordinator receives", "Protocol, Proposal Defense I, Final Defense I; Handbook pp. 63, 65-66", "Research gate: Form 4; defense scheduling")
row("GS-F-28", "Request for Rescheduling or Cancellation of a Defense", "Asks to move or cancel a confirmed defense.", "Student, adviser, panel or GS Office", "Adviser notes; Research Coordinator approves", "Ops Manual 4.16; Handbook pp. 63-67. Proposed form", "Defense scheduling: reschedule or cancel with reason")
row("GS-F-29", "Comments Sheet for Proposal Defense (Form 5)", "Panel comments after the proposal defense.", "Panel members", "Panel Chair consolidates", "Protocol, Proposal Defense II-III; Handbook pp. 63-65", "Proposal defense verdict")
row("GS-F-30", "Technical Review Certificate (Form 5.1)", "Technical review of the revised proposal.", "Panel Chair", "Panel members; adviser; Research Coordinator receives", "Protocol, Proposal Defense III; Handbook pp. 64-65", "Research gate: Form 5.1")
row("GS-F-31", "Application for Ethics Review (Form 5.2)", "Apply for ethics review after the proposal defense.", "Student", "Adviser endorses; ethics committee decides", "Protocol, Proposal Defense III; Handbook pp. 23, 65", "Ethics clearance status and date")
row("GS-F-32", "Comments Sheet for Final Defense (Form 6)", "Panel comments after closed-door and public final defense.", "Panel members", "Panel Chair consolidates; adviser records", "Protocol, Final Defense II-IV; Handbook pp. 66-73", "Final defense verdict")
row("GS-F-33", "Evaluation Sheet for Final Defense (Form 7)", "Scores the closed-door final defense. Score below 85 (thesis) or 90 (dissertation) means provisional pass.", "Panel members and adviser", "Research Coordinator receives", "Protocol, Final Defense II-IV; Handbook pp. 66-67, 76", "Final defense verdict with Form 7 score")
row("GS-F-34", "Settlement of Provisional Thesis / Dissertation Approval (Form 8)", "Confirms revisions after a provisional pass.", "Student; adviser", "Adviser certifies; Research Coordinator receives", "Protocol, Final Defense II; Handbook p. 67", "Verdict follow-up: revisions confirmed")
row("GS-F-35", "Endorsement for Public Final Defense (Form 4.3)", "Adviser endorses the public final defense.", "Research Adviser", "Adviser endorses; student acknowledges; Research Coordinator approves schedule", "Protocol, Public Defense I; Handbook pp. 70-73", "Not modeled yet")
row("GS-F-36", "Similarity Index (Turnitin) Certification", "Turnitin similarity certificate for the final manuscript.", "Turnitin administrator", "Turnitin administrator", "Protocol, Final Defense III; Handbook p. 68. Form proposed", "Completion Evidence: Turnitin certificate")
row("GS-F-37", "Editor Certification (Form 9)", "Editor certifies the manuscript.", "Editor", "Editor", "Protocol, Final Defense III; Handbook p. 68", "Completion Evidence: Form 9")
row("GS-F-38", "Approval Sheet (Form 10)", "Final approval of the bound thesis / dissertation.", "GS Office", "Dean accepts (panel and adviser review)", "Protocol, Final Defense III; Handbook pp. 68, 77", "Completion Evidence: Form 10")
grp("Publication")
row("GS-F-39", "Formal Invitation to Co-Author Journal Article (Form 11)", "Student invites a pre-identified co-author.", "Student", "Co-author replies; adviser notes", "Handbook pp. 64, 75", "Not modeled yet")
row("GS-F-40", "Publication Information Form (Form 12)", "Approval to submit to a journal.", "Student", "Research Coordinator, Academic Coordinator, Associate Dean, external expert; Dean decides", "Handbook p. 75", "Not modeled yet")
row("GS-F-41", "Evidence of Publication or Acceptance (Form 13)", "Proof that the article is accepted or published.", "Student", "Research Coordinator checks the evidence is present", "Handbook pp. 75, 77. Form 13 is named only by number there", "Not modeled yet")
grp("Graduation and records")
row("GS-F-42", "Application for Graduation", "Student applies in the review window of the graduating term.", "Student", "Academic Coordinator (coursework); Research Coordinator (research documents); Dean endorses or returns", "Ops Manual 4.18; Handbook pp. 55-56, 68-69, 75-77, 80", "Graduation: signed application, For Review")
row("GS-F-43", "Graduation Endorsement List", "Batch list of checked candidates for the Dean.", "Graduate School staff", "Academic Coordinator; Research Coordinator; Dean approves", "Ops Manual 4.18; Handbook pp. 32, 77", "Graduation: Dean Approved, exported list")
row("GS-F-44", "Records Transmittal to the University Registrar", "Records sent to the Registrar, with acknowledgement.", "Dean, Associate Dean or representative", "Registrar acknowledges", "Ops Manual 4.19; Handbook pp. 32, 49-50, 53. Proposed", "Registrar status and handoff log")
grp("Platform Basis (folder Platform Basis, Ops Manual 4.20 to 4.24)")
row("GS-F-45", "Data Privacy Consent and Acknowledgement", "Paper twin of the privacy notice shown at first sign-in. Consent item by item, for a person without an account or when a signed copy is wanted.", "Person (any account holder)", "Person signs; Graduate School Staff receives", "Ops Manual 4.23; RA 10173 sections 11, 12, 16; GS-P-04", "Privacy notice and consent at first sign-in")
row("GS-F-46", "Platform Account and Role Request", "Ask for an account, a change of role or removal of an account. Every account except a student's.", "Requester", "Head of office endorses; Dean approves; Graduate School Staff or administrator sets up", "Ops Manual 4.21; GS-P-05", "Account set-up by the Graduate School")
row("GS-F-47", "Faculty Course Preference and Availability", "Each term: subjects preferred, usual weekly hours, dated availability, reply to an availability request.", "Faculty member", "Faculty member signs; Academic Coordinator receives and keys it in", "Ops Manual 4.20; fields of the platform's faculty records", "Faculty record: preferences, weekly hours, availability")
row("GS-F-48", "Teaching Load Assignment", "Professor proposed for each subject section, and the load of each professor. The maximum load is left blank (question 42).", "Academic Coordinator", "Academic Coordinator prepares; Dean approves; faculty member acknowledges", "Ops Manual 4.20; GS-F-04, GS-F-47; Handbook p. 48", "Course offering: professor assignment")
row("GS-P-03", "Electronic Approval and Signature Policy", "When an approval recorded in the platform counts as the officer's signature on the matching form. Policy, not a form.", "Capstone group drafts", "Dean approves; Research Coordinator and University legal counsel review", "Ops Manual 4.22; RA 8792 sections 7, 8, 9, 12; Protocol and Handbook pp. 61, 63, 72-73", "Transaction log of every recorded step; role gates")
row("GS-P-04", "Data Privacy Notice and Records Retention Schedule", "What personal data is kept, why, who sees it, what goes to outside services, how long it is kept, rights of the person. Data Protection Officer name left blank.", "Capstone group drafts", "Dean approves; Data Protection Officer reviews", "Ops Manual 4.23; RA 10173 sections 2, 7, 11, 12, 16, 20; outside calls read from the program code on 4 Nov", "First sign-in notice; Policy Assistant (Google Gemini only when a key is set); Google Calendar for a connected faculty member")
row("GS-P-05", "Platform Access and Roles Matrix", "The roles of the platform, what each can see and do, and how an account is requested, set up, reviewed and removed.", "Capstone group drafts", "Dean approves; Academic Coordinators and Graduate School Staff review", "Ops Manual 4.21; roles and role gates of the platform", "Role check on every function; GS-F-46 account set-up")
row("GS-P-06", "AIMS and Registrar Data Exchange Specification", "Files that come in from AIMS and files that go out to the University Registrar: columns, sender, timing. Exchange by file only.", "Capstone group drafts", "Dean approves; University Registrar acknowledges", "Ops Manual 4.24; the platform's import and export files; Documents/Sample_Data/AIMS_Export", "Student Handoff and class-list imports; Registrar lists (sent, acknowledged). The proposed AIMS export workbook is not read yet")
grp("Supplementary Forms (folder Supplementary Forms, named in the Handbook, filed in the chapter each belongs to)")
row("GS-F-49", "Request for Approved Absence", "Absence for a school-sponsored activity, official representation of the University or a Dean-endorsed program activity. Not counted against allowed absences; work missed is still made up.", "Student", "Academic Coordinator recommends; Dean approves", "Ops Manual 4.5; Handbook p. 52", "Kept on paper only (no web-app step)")
row("GS-F-50", "Incomplete Grade Removal Form", "Remove an INC within one academic year by meeting the requirements; final grade given by the professor.", "Student", "Professor gives final grade; Academic Coordinator and Dean note", "Ops Manual 4.5; Handbook pp. 48, 54", "Kept on paper only (grades are outside the platform)")
row("GS-F-51", "Application for Cross-enrollment", "Dean's advance written permission to take a course at another institution. Basis for the permit the Registrar issues.", "Student", "Academic Coordinator verifies conditions; Dean approves; Registrar issues the permit", "Ops Manual 4.2; Handbook p. 50", "Kept on paper only (no web-app step)")
row("GS-F-52", "Request for a Special Class", "Ask for a special class or an undersized class, through the Dean, addressed to the Vice Chancellor for Academic Affairs. Minimum enrollees left blank.", "Academic Coordinator", "Dean (through); Vice Chancellor for Academic Affairs approves", "Ops Manual 4.3; Handbook p. 48", "Kept on paper only (no web-app step)")
row("GS-F-53", "Request for Transfer between Master's Options", "Master's student asks to move to another master's option; Dean decides which subjects are credited.", "Student", "Academic Coordinator recommends; Associate Dean endorses; Dean approves", "Ops Manual 4.2; Handbook p. 48", "Kept on paper only (no web-app step)")
row("GS-F-54", "Nomination for Best Thesis / Dissertation", "Nominate a work after the final defense. Committee scores it (Handbook rubric, 100 points); cut-off 96.", "Research Adviser or Panel Chair", "Committee members score; Dean approves the award", "Ops Manual 4.18; Handbook pp. 76-77", "Kept on paper only (no web-app step)")
grp("Forms control (folder 0 Forms Control)")
row("GS-P-01", "Graduate School Forms Approval Sheet", "The page that approves all 60 documents and fixes the effectivity date.", "Capstone group", "Reviewers (see above); Dean approves", "Inventory (00-INVENTORY.md)", "-")
row("GS-P-02", "Forms Routing Guide", "Who files, reviews, decides and where each form goes next.", "Read-only guide", "-", "Ops Manual chapters 2 and 4", "Maps each form to its web-app step")
table(rows, Wd, size=8, group_rows=G)

doc.add_heading("Open questions for the Graduate School (numbers match 00-INVENTORY.md)", 2)
Q = [
    ["1", "Do you hold the official Word/PDF for Protocol Forms 1-13, the Withdrawal Form, the comprehensive exam application and the Advice Slip? If yes, yours replace ours."],
    ["2", "Is the code style GS-F-XX / GS-P-XX acceptable? Who sets the effectivity date and revision numbers?"],
    ["3", "Withdrawal: the Handbook says until the second week (10% / 20%). The Associate Dean said before classes or in the first week. Which applies? What does a withdrawal before the first day cost?"],
    ["4", "Dropping: who drops a subject, the professor (Handbook) or the Academic Coordinator? Is a documented reason other than absences allowed? Does DRP 5.0 drop the student from the program?"],
    ["5", "Leave: filing deadline, start term, fee. Does leave count in maximum residence (Handbook says yes)? May a structured form replace the letter to the Dean?"],
    ["6", "Readmission and AWOL: who declares AWOL? Is a written notice sent (GS-F-09 is a proposal)? Who records the returnee interview? May a student with a failed subject be readmitted?"],
    ["7", "Residency: fee, deadline within the semester, number of semesters allowed, who approves."],
    ["8", "Comprehensive exam: before or after the adviser appointment and title defense? Who evaluates doctorate students (Handbook: College Dean)? Is 7.00 the pass mark per course out of 10.00?"],
    ["9", "Adviser: who approves (Dean alone, or with Associate Dean and Research Coordinator)? Do students nominate three faculty? Who approves an external panel member? Is there a cap on panel service?"],
    ["10", "Form 7 uses the Handbook p. 76 rubric (15, 40, 15, 30 points) and the 85 / 90 thresholds of p. 67. Is that the intended rubric? Does it apply to a project paper?"],
    ["11", "Public final defense: apply five days or two weeks before? 30 or 60 minutes? Which admission date decides between public defense and the research-conference track?"],
    ["12", "Defense fees and honoraria: the Protocol fee tables are empty, so the forms state no amounts. Is the practice of handing panel honoraria in an envelope at the defense the one to record?"],
    ["13", "Ethics review: does the ethics committee have its own application and clearance forms? GS-F-31 is a general draft."],
    ["14", "Turnitin certificate: who issues it and in what form? (GS-F-36 is proposed.)"],
    ["15", "Publication: who is the external expert? Does the Scopus / Web of Science / ISI requirement apply to every program from AY 2022-2023? What happens when a student cannot publish in time?"],
    ["16", "Practicum: which programs? How many hours (the platform default of 200 is the group's assumption; forms leave it blank)? Who signs for the University? Does University counsel review the agreement? May a Psychology student do it before the comprehensive exam?"],
    ["17", "Graduation: review window, deadline, late applicants, document checklist. Registrar acknowledgement and file formats."],
    ["18", "Offices and titles: GS-P-01 uses the Handbook's 'Graduate Program Secretary'. Is that the right signatory? Are the mailboxes on the forms current?"],
    ["19", "Adviser rules differ. Handbook p. 58: doctoral degree and one refereed publication; five advisees per semester (p. 59). Protocol: PhD for PhD students, PhD units for MA students; five active advisees per academic year. GS-F-19 states both. Which governs?"],
    ["20", "Project paper: the Protocol gives no provisional-pass score. GS-F-32 and GS-F-33 leave a blank."],
    ["21", "Proposal defense outcomes on GS-F-29: Passed, Passed with minor revisions, Major revisions. Are those the right outcomes?"],
    ["22", "Mixed-methods studies and Form 4.1: the Protocol is silent. GS-F-25 offers only quantitative or qualitative."],
    ["23", "Readmission: GS-F-08 adds three platform checks (updated study plan, adviser consultation, no pending accountability), marked as not Handbook requirements. Keep or strike?"],
    ["24", "AWOL: the Handbook does not say it is reported to the Registrar. Is the Registrar informed, and by which form?"],
    ["25", "Rescheduling a defense (GS-F-28): is a new date subject to the two-week endorsement and 14-Day Rule lead times? Who may ask?"],
    ["26", "Is 'Endorsement for Public Final Defense' (Form 4.3) the official title? Handbook and Protocol word it differently."],
    ["27", "Ethics committee mailbox: Protocol gives rerc@usls.edu.ph, the Handbook another address. The forms use the Protocol's."],
    ["28", "Practicum Agreement wording is the group's draft, not University text. Who reviews it?"],
    ["29", "GS-F-35: five days before the schedule (Protocol) or two weeks (Handbook p. 73)?"],
    ["30", "Project paper: provisional-pass score on GS-F-32 and GS-F-33 (left blank). Are the Handbook p. 76 criteria those of Form 7?"],
    ["31", "GS-F-06: a drop for a documented ground other than absences is arranged between student and Academic Coordinator. Is that the practice?"],
    ["32", "GS-F-09: status recorded from evidence; GS-F-44 used if the Registrar is told. Right?"],
    ["33", "GS-F-17: defense date confirmed once the adviser and all panel members replied. Does the Associate Dean note the form?"],
    ["34", "GS-F-42: a wrong application is returned and replaced by a new form, the first is kept. Is that the practice?"],
    ["35", "GS-F-10 and GS-F-11: residency fee and practicum hours left blank. Which programs have a practicum, and how many hours?"],
    ["36", "GS-F-28 is a Graduate School form, not a Protocol form. Who may ask for a rescheduling and who decides?"],
    ["37", "GS-P-03: does University legal counsel accept the procedure under RA 8792 section 8? The Associate Dean signs forms but has no platform role: add the role or keep paper? How is a delegate designated?"],
    ["38", "GS-P-04: Data Protection Officer name and contact; University retention rules (the schedule prints 5 years, permanent, 1 year); answer period (fifteen working days); data sharing agreement with Google before real data; hosting outside the University."],
    ["39", "GS-P-05 and GS-F-46: should an Academic Coordinator be limited to one program? Who is the named administrator? Roles for the Associate Dean and Graduate Program Secretary? Account review each term? Is the approval chain right?"],
    ["40", "GS-P-06: who exports from AIMS and in what layout? Is the proposed AIMS export workbook acceptable? How often? What does the Registrar need to acknowledge a file? Layouts of the AWOL and residency reports."],
    ["41", "GS-F-45: are the five consent items the ones the Data Protection Officer wants?"],
    ["42", "GS-F-47 and GS-F-48: maximum teaching load (blank, the Handbook states none). Does a faculty member acknowledge the load in writing?"],
    ["43", "GS-F-49: keep the Academic Coordinator's recommendation, which the Handbook does not name?"],
    ["44", "GS-F-50: deadline for the form, and the Registrar's procedure to post the final grade."],
    ["45", "GS-F-51, 52, 53: who checks that the cross-enrolled course is not a major course; minimum enrollees and fee of a special class; credit of subjects, deadline and Registrar notice on a transfer."],
    ["46", "GS-F-54: who may nominate, who sits on the committee, is the final score the average, when nominations close."],
    ["47", "All new documents: do manual chapters 4.20 to 4.24 (faculty load, accounts and roles, electronic approval, data privacy, data exchange) belong in the manual as written?"],
]
table([["#", "Question"]] + Q, [1.0, 25.7], size=8.5)

# ---------------------------------------------------------------- PART 2
doc.add_heading("Part 2 - UAT instrument (User Acceptance Testing form)", 1)
bullets([
    "What it measures: whether the demonstrated system supports the real monitoring and coordination needs of the Graduate School. Each evaluator judges only what was seen or done. All records are sample data.",
    "Who tests: Graduate School staff, Academic Coordinator, Research Coordinator, Dean, Faculty (adviser or panel), Student, Other. The form records the role tested and whether the evaluator watched, used the system, or both.",
    "Who answers what: everyone answers Sections A, I, J and K and the User Acceptance page. Every other section carries a 'Mainly for' line. The SUS page is optional. Taking part is voluntary and any question may be skipped.",
    "Size: 98 matrix questions (A-J), 10 optional SUS items, 8 process-validation questions (K), then a three-option acceptance and signature block. Revised file: 12 pages, US Letter.",
])
table([
    ["Section", "Topic", "Qs", "Mainly for"],
    ["A", "Overall system and process representation", "7", "Everyone"],
    ["B", "Student records, course monitoring, enrollment", "14", "Graduate School staff, Academic Coordinator"],
    ["C", "Standing changes and exception cases (withdrawal, dropping, leave, readmission, AWOL, residency)", "8", "Staff, Dean, Academic Coordinator, student"],
    ["D", "Research Gate", "9", "Staff, Research Coordinator, Academic Coordinator, adviser, student"],
    ["E", "Panel matching", "8", "Staff, Research Coordinator, faculty"],
    ["F", "Defense scheduling and defense outcome", "14", "Staff, Research Coordinator, panel faculty, student"],
    ["G", "Practicum and graduation", "8", "Staff, Academic Coordinator, Research Coordinator, Dean, student"],
    ["H", "Policy Assistant, rules, reports and analytics", "13", "Everyone (assistant); staff, Dean, coordinators (reports)"],
    ["I", "User interface and ease of use", "7", "Everyone"],
    ["J", "Access, reliability, system behavior", "7", "Everyone"],
    ["SUS", "System Usability Scale, optional", "10", "Anyone who used the system personally"],
    ["K", "Process validation and possible errors", "8", "Anyone who knows the real process"],
], [1.6, 12.2, 1.2, 11.7], size=8.5)
bullets([
    "Scales: Yes / No / N/A on every row. In A-J, Yes always means good. 7 rating rows (A7, B14, D9, E8, F14, H13, I7) use 1-5 with the words printed on the row (for example 1 = Not useful, 3 = Acceptable, 5 = Very useful), plus N/A. Section K is the one reversed part: Yes means a problem was found. It is labelled on the page. SUS is 1-5, Strongly disagree to Strongly agree.",
    "Acceptance: each evaluator ticks one of Accepted, Accepted with minor revisions, Requires major revisions, and gives a reason and the most important changes needed.",
    "Scoring Yes/No sections: every answer traces to one question ID (A1, B3 ...), so the team can tally No answers per question and read the Comments. The notes give no pass percentage: check with the adviser before quoting one.",
    "Scoring SUS (team use, not on the form): odd items score = answer minus 1. Even items score = 5 minus answer. Add the ten scores and multiply by 2.5. Result is 0-100 per evaluator. Average over evaluators. About 68 is the average over many studies. A blank or middle answer counts as 3. Do not read single items alone. With few evaluators, report each score and the range, not only the mean.",
])
doc.add_heading("Main changes from the draft, and the standard behind each", 2)
table([
    ["Change", "Why", "Standard / source"],
    ["Evaluator block added (name, office, role tested, watched or used, date). 'Project created' blank became 'Version tested: demonstration build, sample data only'.", "Results mean something only if the team knows who tested what and in which context.", "ISO 9241-11 (specified users, specified context of use); ISO/IEC/IEEE 29119-3 test documentation"],
    ["N/A added on every row. Intro says 'see or perform' and 'only judge what you saw or did'.", "Some evaluators only watch. Evaluators need a valid answer for features not shown.", "CASRAI questionnaire design (N/A option)"],
    ["Rating anchors printed on every rating row.", "The draft explained the scale only in the intro. The 'useful' rows used 'Very Poor' words.", "TASO Likert guidance (label every point, 5 points); CASRAI"],
    ["Double-barreled questions split to one idea each (for example Access 4 became J4 and J5; Panel and Research items split).", "One question, one answer. The draft Access 4 also had Yes = bad while all others had Yes = good.", "Pew Research (double-barreled); CASRAI (consistent scale direction)"],
    ["Draft 'imported data is read-only, not edited in the portal' replaced by B3-B6.", "Out of date and leading. Staff can now add and correct records with source, who, when and reason. AIMS values are never silently overwritten. No grades in the portal.", "ISO/IEC 25010:2023 security (integrity, accountability); neutral wording"],
    ["New questions for features the draft never asked about: hard stops and the 14-day warning, calendars, Registrar file hand-off, Business Rules register, policy document library, no e-mail notifications, 'Not Yet Assessed' risk, boards behave alike, clear reason when an action is stopped.", "Each is a main feature or design decision shown in the demo.", "ISO/IEC 25010:2023 (user error protection, self-descriptiveness); team decisions"],
    ["Draft Policy questions 5 and 6 were word for word the same. Merged into H10 and H11.", "Duplicate.", "-"],
    ["Format: Arial, 12 pt body, 11 pt matrix, bigger section headings, numbered sections, tick boxes, repeated header rows, wider margins, footer with page X of Y.", "Easier to read and print. Section headings are real Word headings.", "Plain English Campaign forms guide; NZ MSD plain-language checklist; Irish CEUD form design"],
    ["Optional SUS page added.", "One validated number, comparable with the benchmark of about 68. Covers satisfaction, which Yes/No rows do not.", "Brooke 1996 (SUS); MeasuringU; ISO 9241-11 satisfaction"],
], [9.2, 9.0, 8.5], size=8.5)
para("Quality model behind the sections: A-H = functional suitability. I (and A7) = interaction capability (usability). B4, B5, J1, J2 = security. J3-J5 = reliability. J6 = performance efficiency. Not asked, because office staff cannot judge these characteristics: compatibility, maintainability, flexibility, safety.", size=9.5)
doc.add_heading("Likely questions about the UAT", 2)
qa([
    ("Why ISO/IEC 25010 and ISO 9241-11?", "25010 is a quality model of nine characteristics. A UAT with office staff can judge only some characteristics. 9241-11 defines usability as effectiveness, efficiency and satisfaction for specified users in a specified context. That is why the form records role and sample-data context. The notes found no CHED or USLS rule that requires ISO 25010. If the panel asks, check the school's thesis manual."),
    ("Why add SUS?", "It is ten items on one page, validated, and gives one number. It stays optional because SUS is meant for people who used the system, not only watched."),
    ("Why mostly Yes/No and not only 1-5?", "It is a short acceptance check. The draft used Yes/No and the team kept it. Seven rating rows give a degree of usefulness or ease."),
    ("Why is Section K reversed?", "K is a problem-finder, so Yes means a problem. It sits on its own page with a bold label and a 'Problem found?' column, so nobody ticks the wrong box."),
    ("How long does it take?", "Each evaluator answers A, I, J and own sections: about 50-65 questions. The time was not measured; a dry run is needed. Check."),
    ("Are the policy numbers in the questions right?", "Withdrawal window (C2) and 10% / 20% fee (C3): Handbook pp. 49, 51. 20% absence (C4): p. 52. Scores 85 / 90 (F13): p. 67. The 14-day lead time (F5) came from the walkthrough and rules register. Check against the Handbook."),
    ("Who sees the answers?", "The form says names and signatures are used only for the CAP-2521-IT capstone and shared only with the project team and the Graduate School (Data Privacy Act, RA 10173). The wording is the team's own. Check it with the adviser or the Graduate School."),
    ("Does a good result prove the system works?", "No. It records acceptance of a demonstration build with sample data. Evaluators judge only what was shown."),
], size=9)

# ---------------------------------------------------------------- PART 3
doc.add_heading("Part 3 - Walkthrough of my demo parts", 1)
para("Demo accounts: all use the same demo password. The sign-in page lists the accounts. Demo students: loa.daniel@usls.edu.ph (leave), readmission.therese@usls.edu.ph (readmission), awol.maya@usls.edu.ph (AWOL). Staff: staff@usls.edu.ph. Dean: dean@usls.edu.ph. If a drag and drop fails, use 'Move to...' on the card. It is the same step with the same rules. Videos are on this PC only.", size=9.5)

doc.add_heading("2d - Monitoring Sheet (8 min) - video 2d-Monitoring-Sheet.mp4 (about 4:30)", 2)
para("One line: the curriculum grid the office kept in Excel is now kept on screen. Every entry shows where it came from.")
bullets([
    "Steps: sign in as staff. Records > Monitoring Sheet. Pick MSN. Add student (ID, names, AY entry 26-27). 'Add subjects now'. Add MSN-FED and MSN-MOR as Completed. Edit a remark. Remove MSN-MOR with a reason. Change history tab. Back on the grid: the Manual tag and the orange dot. Open the imported student Katrina Cabrera: editing an imported value needs a reason.",
    "Rule behind it: no Handbook page. It is a project rule. Official student, enrollment and grade data come only from the AIMS import and cannot be edited. Manual entries are allowed but stamped with source, who, when and reason. A later workbook that disagrees with a portal value is held for review, not overwritten.",
    "Say: removing a row does not erase it. The row goes back to 'not taken' and stays in the history. Adding a student creates a Student Portal login.",
])
qa([
    ("Why not keep the Excel file?", "Excel cannot show who changed a cell, when or why. Here there is one record, every change is audited, and the same data feeds Enrollment, Reports and the student's own view. Workbook upload still works."),
    ("Can staff change official data by mistake?", "Not silently. An imported value needs a written reason. The change is logged with the name of the staff member. Grades and official enrollment cannot be edited at all."),
], size=9)

doc.add_heading("2h - Leave of Absence, Readmission, AWOL (8 + 6 + 6 min)", 2)
para("One line: three standing changes on one kind of board. Columns are stages, cards are requests, the request window shows the policy check, and the Registrar list is the hand-off.")
table([
    ["Part / video", "Steps on screen", "Rule behind it (Handbook)"],
    ["Leave of Absence\n2h-1-Leave-of-Absence.mp4\n(about 6:37)\nStudent Daniel Fernandez",
     "Student: Requests > Leave of Absence. Picks start and end (two semesters), reason, explanation. Checks the summary. Sends.\nStaff: Leave of Absence board. Drag Submitted to In staff review. Table / Board switch. Open request. Read the policy check. Forward to the Dean with a note. Card shows 'Waiting for: Dean' and is locked for staff.\nDean: drag to Leave scheduled. Approve with a note (or return for revision / deny, both with a comment).\nStaff: drag to On leave. Registrar list: download CSV, tick, mark as sent. The portal sends no e-mail.",
     "p. 52: written request to the Dean, with reason and period. Leave approved for one year, renewed at most one more year. Portal shows: two semesters at a time, renewable once, four in total.\np. 53: no leave within two weeks before the last day of classes.\np. 55 (as GS-F-07 cites it): leave counts in maximum residence.\nPolicy check is advice only. 'Minimum residency' reads Needs review (prototype rule). Only the Dean decides."],
    ["Readmission\n2h-2-Readmission.mp4\n(about 4:28)\nStudent Therese Lacson, on approved leave",
     "Student: Requests > Readmission. The leave being ended is filled in. Picks return semester, writes why ready, ticks four checklist items. Sends.\nStaff: Readmission board. Drag to In staff review. Open request: return semester, linked leave, checklist 'not verified by staff yet', history (two of four leave semesters used). Policy check: return before the leave ends needs the Dean (Needs review). Forward, ticking the items verified. Unticked items reach the Dean as Needs review.\nDean: drag to Approved. The student is active again. The Academic Coordinator plans subjects next. Readmission does not enroll.",
     "p. 53: a returning student declares the intention to enroll in writing to the Registrar through the Dean. The rules panel shows this one rule, 'enforced by the system'.\np. 45: returnee presents Business Office clearance, interview, evaluation of subject and grade requirements, Advice Slip from the Dean.\np. 54: failure in any subject means no readmission.\nNote: the portal's four checklist items are not the Handbook's four requirements (open question 23)."],
    ["AWOL and Return from AWOL\n2h-3-AWOL-and-Return-from-AWOL.mp4\n(about 5:08)\nStudent Maya Torres",
     "Nobody types 'AWOL'. The system flags the student from records.\nStaff: AWOL & Residency board. Maya's card is in AWOL, 'Waiting for: Student'. Staff cannot move it. Rules panel: residence limits.\nStudent: Requests > Return from AWOL. Return semester, last enrolled semester, written intention, reason. Sends. Classified 'Within Maximum Residence'.\nStaff: card moved to Return review by itself. Policy check: Eligible for Dean Review. Drag to With the Dean with a note.\nDean: drag to Back in the program. The Registrar list holds one report per approved return.",
     "p. 53: leaving without a formal leave is AWOL. Registration privileges are curtailed or entirely withdrawn.\npp. 54-55: maximum residence. Master's: 5 years normal, 7 absolute (two-year extension with a graded six-unit refresher). Doctorate: 7 and 9. Leave counts in residence.\nHandbook does not say AWOL is reported to the Registrar (open question 24)."],
], [4.8, 12.2, 9.7], size=8.5)
qa([
    ("Why does the portal not e-mail the Registrar?", "On purpose. The portal prepares the list. Graduate School staff send it through the official channel, then mark it sent and acknowledged. There is always a record of what was handed over."),
    ("Can staff approve a leave?", "No. Graduate School staff review and forward. The card locks for staff once the Dean has it. The server refuses any move the rules do not allow, even by drag and drop."),
    ("What does 'Needs review' mean?", "A prototype rule value that the Graduate School still has to confirm. The portal shows it honestly. The Dean decides."),
    ("Is the paper leave letter still needed?", "The Handbook asks for a written request to the Dean (p. 52). The portal form is a structured written request. Whether the Dean accepts it in place of a letter is open question 5. The forms pack has the paper version GS-F-07."),
    ("What if a student is flagged AWOL by mistake?", "The flag comes from an imported standing or the semester records. The fix is to correct the source record. Staff cannot type the flag by hand, so no student is flagged by accident."),
], size=9)

doc.add_heading("2l - Reports & Analytics (6 min) - video 2l-Reports-Analytics.mp4 (about 4:19)", 2)
para("One line: what the Graduate School knows about all students at once. Every number is computed from recorded events, not typed in, and every count opens the students behind it.")
bullets([
    "Steps: sign in as staff. Overview > Reports & Analytics. Filters: program, year started, period (default last 12 months). Strip of six numbers (for example Behind schedule, Median days to decide). Needs attention tab: select a cause to narrow the list, 'Show all causes', download Excel or PDF. Where students get stuck (on time, slow, stuck). Office speed. Records to fix. Older lists: By year started, Graduation candidates, Overdue and pending, Defenses. Registrar changes (daily list). Pick one program: every number follows.",
    "Rule behind it: no Handbook page. These are measurements of the records. Targets and day limits are starting values for discussion, not Graduate School policy. Risk reads 'Not Yet Assessed' until the Graduate School confirms its risk rules. The portal never invents High, Medium or Low.",
    "Careful: the written walkthrough (Case 20) still describes the older seven-tab layout. The video and narration show the new page. Read figures off the screen.",
])
qa([
    ("Where do the targets come from?", "The targets are starting values. The Graduate School should set its own targets. Changing a target is a setting. Check the exact values on screen before quoting any."),
    ("Is the data real?", "No. The demo site holds sample data (made-up students). No real student data is stored."),
    ("Can this feed CHED or university reports?", "Every table downloads as Excel or PDF with the current filters. If a fixed report format exists, the Graduate School can give the template and the team can match it."),
], size=9)

doc.add_heading("2m - Best Features (closing, about 2 min, no video)", 2)
para("One line: five features, then the common thread. Say it over the closing slide. The full text is at the end of NARRATION-SCRIPT.docx.")
bullets([
    "1 Rules with a source: one register, each rule with Handbook or Protocol page and a label: Enforced by the system, Documented only, or Needs review. A refusal quotes the rule.",
    "2 Policy library and an assistant that cites its source: answers only from the Graduate School's documents, names the document and page, says so when the documents do not cover a question. Today it runs offline (Gemini errors on 4 Nov), so the label reads 'Offline answer'.",
    "3 Panel matching that explains itself: score out of 100 = topic similarity 60 + availability 25 + workload 15. The breakdown is on screen. The student's own adviser is never offered. A person chooses the panel.",
    "4 Scheduling that checks before it books: hard stops (double-booked panelist or room, declined invitation, slot in the past) and warnings that can be overridden with a recorded reason. Calendars for every role.",
    "5 Shared boards and reports computed from records: leave, readmission, AWOL, withdrawal, practicum and graduation run on the same boards. Every move is recorded.",
    "Common thread: each feature takes data the Graduate School already has, plus the policy that governs it, and produces a decision, a warning or a measurement.",
    "Honest limits: no e-mail from the portal. Google Calendar is optional. Official data comes only from AIMS. Rules marked Needs review wait for Graduate School validation.",
])
qa([
    ("Is the 60 / 25 / 15 weighting policy?", "No. It is a design choice. The UAT form asks evaluators (E3) whether it is sensible. The Graduate School should confirm it."),
    ("Does the assistant ever guess?", "It is decision support, not an official ruling. It shows the passage used, and says so when the library has no answer."),
], size=9)

# ---------------------------------------------------------------- PART 4
doc.add_heading("Where every file is", 1)
table([
    ["What", "Where (under E:\\Github_Projects\\CAPSTONE-USLS-MVP\\Documents\\)"],
    ["Forms pack to print (108 pages, approval sheet first)", "Graduate_School\\Forms\\USLS-GS-Forms-Pack.pdf. Each form is in the folder of its manual chapter (Graduate_School\\Forms\\4.01 ... 4.19, plus 0 Forms Control, Platform Basis, Supplementary Forms), with its single PDF beside the .docx. Inventory and open questions 1-47: Graduate_School\\Forms\\00-INVENTORY.md"],
    ["UAT instrument", "Capstone\\UAT\\[CAP-IT2] UAT Instrument - Revised.docx (and .pdf). Every change and source: UAT-REVIEW-NOTES.md. Original draft: C:\\Users\\Windows10\\Downloads\\[CAP-IT2] UAT Instrument Draft.docx"],
    ["Videos (this PC only)", "Capstone\\Meeting_2026-11-04\\videos\\ - 2d-Monitoring-Sheet, 2h-1-Leave-of-Absence, 2h-2-Readmission, 2h-3-AWOL-and-Return-from-AWOL, 2l-Reports-Analytics (.mp4 with .srt subtitles)"],
    ["Narration script", "Capstone\\Meeting_2026-11-04\\NARRATION-SCRIPT.docx (and .pdf). 2m Best Features is at the end."],
    ["Longer meeting sheet and start-here notes", "Capstone\\Meeting_2026-11-04\\MEETING-CHEAT-SHEET.docx / .pdf and README-FOR-MIGUI.md"],
    ["Operations Manual", "Graduate_School\\Operations_Manual\\USLS GS Operations Manual - DRAFT for Validation.pdf (and .docx). The web app reads it: do not rename."],
    ["Folder map", "README.md in the Documents folder: what is current, what is archive."],
    ["Team walkthrough", "Capstone\\Walkthrough\\CAP-2521-IT-WALKTHROUGH.docx (Case 5 = 2d, Cases 9-11 = 2h, Case 20 = 2l, Case 21 = 2m)"],
], [7.5, 19.2], size=8.5)

OUT.mkdir(parents=True, exist_ok=True)
p = OUT / "ZOOM-CHEAT-SHEET.docx"
doc.save(p)
print("saved", p)
r = subprocess.run([SOFFICE, "--headless", "-env:UserInstallation=file:///E:/Temp/claude/lo-profile-zoom", "--convert-to", "pdf",
                    "--outdir", str(OUT), str(p)], capture_output=True, text=True)
print(r.stdout, r.stderr)
