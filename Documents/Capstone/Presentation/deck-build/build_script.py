"""Builds the defense script as a plain Word file (opens in Google Docs). usage: build_script.py <out.docx>

Owner 2026-11-19: plain and easy to edit (no tables, no colours), the flow on top, the script straight after, as few
pages as possible. Slides are a 5-minute skim, the live demonstration is 30 minutes. Slide numbers follow deck v7.
Order: Khloe (opening), Migui (features 1-3), Myrine (4-5), Natalie (6-8), Khloe (UAT, conclusions, recommendations).
v2 (owner 2026-11-19, late): Khloe opens; features 1-3 say what changed since Capstone 1; the Operations Manual lines
say only that the Graduate School approved and signed it (never that it had none, or who prepared it).

A line is "text", or ("cue", "text"): the cue is what to click or show and prints in bold square brackets.
"""
import sys
from docx import Document
from docx.shared import Pt, Inches
from docx.oxml.ns import qn

OUT = sys.argv[1]
FONT, SIZE = "Arial", 10.5

doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Inches(8.5), Inches(11)
sec.left_margin = sec.right_margin = Inches(0.7)
sec.top_margin = sec.bottom_margin = Inches(0.6)
normal = doc.styles["Normal"]
normal.font.name, normal.font.size = FONT, Pt(SIZE)
normal.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
normal.paragraph_format.space_before = normal.paragraph_format.space_after = Pt(0)
normal.paragraph_format.line_spacing = 1.0


def run(p, text, bold=False, size=SIZE):
    r = p.add_run(text)
    r.font.name, r.font.size, r.font.bold = FONT, Pt(size), bold
    return r


def head(text, size=SIZE, before=8):
    p = doc.add_paragraph()
    p.paragraph_format.space_before, p.paragraph_format.space_after = Pt(before), Pt(1)
    p.paragraph_format.keep_with_next = True
    run(p, text, bold=True, size=size)


def lines(items):
    for item in items:
        p = doc.add_paragraph()
        if isinstance(item, tuple):
            run(p, "[%s]" % item[0], bold=True)
            if item[1]:
                run(p, " " + item[1])
        else:
            run(p, item)


# ---------------------------------------------------------------- flow
head("CAP-2521-IT CAPSTONE 2 DEFENSE: FLOW AND SCRIPT", size=13, before=0)
lines(["Slides: about 5 minutes. Live demonstration: 30 minutes. Slide numbers follow deck v7."])

head("DEFENSE FLOW", size=11.5)
head("KHLOE - Opening (slides 1-4)", before=3)
head("MIGUI - Features 1, 2, 3", before=3)
lines(["- 1 Monitoring Sheet: say what changed since Capstone 1, pick a program and year admitted, Add student, add a subject entry, Change history.",
       "- 2 Reports: say what changed, show the filters and the six figures, go through each tab, click a number in \"By year started\" to open its list of students.",
       "- 3 Operations Manual: Policy Documents, then the signed sign-off page."])
head("MYRINE - Features 4 and 5", before=3)
lines(["- 4 Business Rules: search \"withdraw\", show the rule with its source document and page.",
       "- 5 Policy Assistant: ask \"Adding a subject is allowed until when?\", show the document and page under the answer."])
head("NATALIE - Features 6, 7, 8", before=3)
lines(["- 6 Panel Matching: pick the student, open \"Why this score\".",
       "- 7 Defense Scheduling: choose the student, show the requirements check and common free times.",
       "- 8 Google Calendar: faculty > My Calendar > Connect Google Calendar."])
head("KHLOE - UAT, conclusions, recommendations (slides 5-12)", before=3)
head("Q&A - all four", before=3)

# ---------------------------------------------------------------- script
head("SCRIPT", size=11.5, before=10)

head("KHLOE - Opening (slides 1-4, about 2 min)", before=3)
lines([("Slide 1", "Good day, members of the panel."),
       "We are CAP-2521-IT.",
       "This is our Capstone 2 defense.",
       ("Slide 2", "At the Capstone 1 defense, one hundred percent of the student lifecycle processes were implemented and demonstrated."),
       "That is all twelve processes.",
       "Capstone 2 covers the remaining work.",
       "That is the panel's revisions, the system refinements, user acceptance testing, and the Operations Manual.",
       ("Slide 3", "These are the eight features added in Capstone 2."),
       "Features 3 to 6 address the revisions required by the panel.",
       "Features 1, 2, 7 and 8 are refinements.",
       ("Slide 4", "We will now show all eight in the live system, in this order."),
       "Migui will begin with features 1 to 3.",
       ("Switch to the browser, signed in as Staff", "")])

head("DEMO NA:")
head("MIGUI - Feature 1: Monitoring Sheet (about 4 min)", before=2)
lines([("Records > Monitoring Sheet", "Feature 1 is the Monitoring Sheet."),
       "The panel saw this screen at the Capstone 1 defense.",
       "We are presenting it again because it has changed.",
       "At Capstone 1, the sheet was view only.",
       "Records could be entered only by uploading an Excel workbook.",
       "The panel asked why staff could not add or edit a record in the system itself.",
       "That was a shortcoming on our part.",
       "It has been corrected.",
       ("Pick a Program and a Year admitted", "I select a program and the year the students were admitted."),
       "Each row is one student.",
       "Each column is a subject.",
       "Each cell shows the status of that subject for that student.",
       ("Click Add student", "Staff may now add a student directly in the system."),
       "The same checks as an upload apply.",
       "A Student ID that already exists is refused.",
       ("Cancel. Click the pencil beside a student's name", "Staff may also open the record of any student."),
       ("Click Add on a subject, choose a status, click Add row", "They may add a subject entry."),
       "They may change an entry, or remove it.",
       "Removing an entry requires a reason.",
       ("Point to Manual entry", "An entry typed in the system is marked as a manual entry."),
       "It carries the name of the staff member and the time.",
       ("Change history tab", "Every change is recorded here."),
       "It shows the old value, the new value, who made the change, and when.",
       ("Close the record", "Uploading a workbook is still available."),
       "Grades are not entered here.",
       "The official record remains in AIMS.",
       "The view by program and year admitted was requested during user acceptance testing.",
       "It was implemented before the evaluation with the Dean."])

head("MIGUI - Feature 2: Group views and reports (about 5 min)")
lines([("Reports & Analytics", "Feature 2 is group views and reports."),
       "This page was also shown at Capstone 1, and it has been revised.",
       "At Capstone 1, it had seventeen separate tabs of tables.",
       "Staff had to read each table to find what needed action.",
       "Now each tab answers one question that the office asks.",
       ("Point to the filters", "The filters are at the top: program, year started, and period."),
       "They apply to the whole page.",
       ("Point to the six figures", "Below them are the six figures the office asks about most."),
       "Every figure is computed from the recorded transactions.",
       "No figure is entered by hand.",
       ("Needs attention", "The first tab is Needs attention."),
       "It shows which students need action, grouped by cause.",
       ("Click one cause", "Selecting a cause shows only the students it affects."),
       "Each row names the office that can move the student forward.",
       ("Where students get stuck", "The second tab shows how many students are waiting at each stage."),
       "They are counted as on time, slow, or stuck.",
       ("Click one number", "Each figure is linked to its list of students."),
       ("Close the list. Office speed", "The third tab shows how long each office takes to close a request."),
       ("Records to fix", "The fourth tab lists records with missing details, such as a research student with no adviser."),
       "When the record is completed, it leaves the list.",
       ("By year started", "The fifth tab presents students by the year they were admitted."),
       "Each year is divided into three groups: on coursework, on thesis or dissertation, and graduated.",
       "Students on leave, AWOL, or withdrawn are counted separately.",
       ("Click one number", "These are the students counted in that figure."),
       ("Point to Download Excel and Download PDF", "The list may be downloaded as Excel or PDF."),
       ("Close the list", "This view was requested during user acceptance testing with the former Associate Dean."),
       ("Point to Graduation, Overdue and pending, Registrar changes", "The remaining tabs are the graduation list, the pending tasks, and the daily list of changes for the Registrar."),
       "The revision makes the reports more useful in three ways.",
       "First, each report states what needs action and which office is responsible.",
       "Second, every figure can be traced to the students behind it.",
       "Third, the Graduate School can monitor students by group, not only one at a time."])

head("MIGUI - Feature 3: Operations Manual (about 2 min)")
lines([("Policy Documents", "Feature 3 is the Operations Manual."),
       "This addresses a revision required by the panel.",
       "The panel asked that the policies in the Operations Manual be included in the system.",
       "We now have an Operations Manual that the Graduate School has approved and signed.",
       ("Point to the Operations Manual", "We placed it in our Policy Documents, with the Handbook and the Research Protocol."),
       "The Policy Assistant now draws its answers from all three documents.",
       ("Switch to the signed PDF, sign-off page", "This is the approved copy."),
       "This is the sign-off page.",
       "It carries the names, the dates, and the signatures.",
       "Myrine will now present features 4 and 5."])

head("MYRINE - Feature 4: Business Rules (about 3.5 min)")
lines([("Business Rules", "Feature 4 is the business rules."),
       "This addresses a revision required by the panel.",
       "Every rule that the workflows follow is listed here.",
       ("Type withdraw in Search rules", "I search for the word \"withdraw\"."),
       "The matching rules appear.",
       ("Point to one rule", "Each rule states its value."),
       "It states the source document.",
       "It states the page.",
       "Rules set by the Handbook or the Research Protocol are locked.",
       "Every workflow screen lists the rules it applies."])

head("MYRINE - Feature 5: Policy library and assistant (about 4 min)")
lines([("Policy Assistant", "Feature 5 is the policy library and assistant."),
       "This also addresses a revision required by the panel.",
       "Responses are drawn from the policy documents uploaded by staff.",
       ("Type the question, click Send question", "I ask: \"Adding a subject is allowed until when?\""),
       "The assistant searches the policy documents.",
       ("Point to the answer", "This is the response."),
       ("Point to the source under it", "It identifies the source document and the page."),
       "The label shows how the answer was produced.",
       "If the documents do not cover a question, the response states that clearly.",
       "Natalie will now present features 6 to 8."])

head("NATALIE - Feature 6: Panel Matching (about 4.5 min)")
lines([("Panel Matching", "Feature 6 is panel matching."),
       "This addresses a revision required by the panel.",
       ("Pick the student", "I select a student and the research paper."),
       "The system recommends panelists for this paper.",
       ("Click Why this score on the top row", "Each recommendation shows the basis for its score."),
       "The score comes from expertise, availability, and workload.",
       "Each paper is scored on its own content.",
       "A different paper gives a different result.",
       "The final selection remains with Graduate School staff."])

head("NATALIE - Feature 7: Defense scheduling validation (about 4 min)")
lines([("Defense Scheduling", "Feature 7 is defense scheduling validation."),
       ("Choose the student", "I choose the student."),
       "The system first verifies the student's requirements.",
       "It then compares the availability of the panel.",
       "It identifies the times when everyone is free.",
       "A double-booked panelist or room cannot be scheduled.",
       "A warning, such as a short lead time, needs a recorded reason."])

head("NATALIE - Feature 8: Google Calendar integration (about 3 min)")
lines([("Sign out. Demo accounts > Faculty", "Feature 8 is Google Calendar integration."),
       "I am now signed in as a faculty member.",
       ("My Calendar > Connect Google Calendar", "A faculty member may link a Google Calendar."),
       ("Finish the Google sign-in", "The calendar supplies the faculty member's availability."),
       "Linking is optional.",
       "This concludes the live demonstration.",
       "Khloe will now present the results of user acceptance testing.",
       ("Switch to the slides, slide 5", "")])

head("KHLOE - UAT, conclusions, recommendations (slides 5-12, about 3 min)")
lines([("Slide 5", "User acceptance testing was conducted with two sets of evaluators."),
       "On 4 November, we met with the former Associate Dean.",
       "From 9 to 14 November, we held demonstration and training sessions with the Dean and the Graduate School personnel.",
       "Each evaluation had a demonstration, hands-on testing, and a signed UAT form.",
       ("Slide 6", "The former Associate Dean, Sir Eddie de Paula, Jr., evaluated the system individually."),
       "The Dean, Dr. Eric Arthur N. Dio, evaluated it together with four Graduate School personnel.",
       "That was one combined evaluation, on one UAT form.",
       ("Slide 7", "The former Associate Dean accepted the system with minor revisions."),
       "The Dean and the Graduate School personnel accepted the system.",
       "No further revisions were required.",
       ("Slide 8", "No defects were reported."),
       "The five requests were enhancements.",
       "All five were implemented.",
       "None of them altered a process workflow.",
       ("Slide 9", "The acceptance is documented in writing."),
       "This is the acceptance letter from the Dean, with the two signed UAT forms.",
       ("Slide 10", "Our conclusions follow the five objectives of the study."),
       "The platform provides the Graduate School with a consolidated, policy-based view of each student's status.",
       ("Slide 11", "These are our recommendations, as stated in Chapter 7 of the paper."),
       "For future study, we recommend the early identification of students at risk of delay.",
       ("Slide 12", "Thank you."),
       "We welcome the questions of the panel."])

# ---------------------------------------------------------------- reminders and likely questions
head("REMINDERS", size=11.5, before=10)
lines(["- Do not say \"round\". Say \"UAT with the former Associate Dean\" and \"UAT with the Dean and Graduate School personnel\" (one combined evaluation).",
       "- The chart on slide 5 is \"site traffic\" only. Our proof is the signed forms.",
       "- Google Calendar only connects on the demo laptop at localhost:5000.",
       "- If the live system fails, continue from the backup feature slides 13 to 19.",
       "- Withdrawal, Practicum and Graduation changes are shown only if the panel asks. Steps are in PANEL_DEMO_CHECKLIST.md."])

head("IF THE PANEL ASKS", size=11.5, before=10)
lines(["- Why does the paper say one respondent? The paper was submitted on 9 November. The evaluation with the Dean was completed after that.",
       "- Where are the detailed UAT scores? On the signed forms in the appendix of the deck.",
       "- Which AI service is used? The system was designed with Google Gemini, and the service is a setting. For this demonstration it runs on Claude, because the free Gemini tier allows only twenty answers a day.",
       "- Is the panel match an AI decision? No. It is a score from expertise, availability and workload. The Research Coordinator makes the choice.",
       "- Is anything in the reports typed by hand? No. Every figure is computed from the recorded transactions.",
       "- What is not built? E-mail from the portal, a required Google connection, and any edit of official AIMS data.",
       "- Withdrawal: the Dean approves; exported lists are one card per batch; staff mark the batch as sent to the Registrar, then as acknowledged; a withdrawn subject shows a red Withdrawn tag.",
       "- Practicum: recording verified hours keeps the case at Documents Under Review; more certificates can be requested only after the hours are saved.",
       "- Graduation: \"Create graduation batch\" is under Select all; \"Mark as acknowledged\" is a button on the batch."])

doc.save(OUT)
print("saved", OUT)
