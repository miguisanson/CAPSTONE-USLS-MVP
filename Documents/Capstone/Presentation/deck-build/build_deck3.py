"""Builds CAP-2521-IT-CAP2DEFPRES v4: short deck, demo slides in the talk, Google Calendar included. usage: build_deck3.py <scratchpad> <out.pptx>"""
import sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from deckkit import *
from PIL import Image as _I

SP, OUT = sys.argv[1], sys.argv[2]
A = SP + "/assets"
SHOT = lambda n: "%s/shots/%s.png" % (A, n)
DOC = lambda n: "%s/docs/%s" % (A, n)
d = Deck()
d.assets = A


def fit(path, x, y, maxw, maxh, **kw):
    iw, ih = _I.open(path).size
    if maxw * ih / iw <= maxh:
        return d.image(path, x, y, w=maxw, **kw)
    return d.image(path, x, y, h=maxh, **kw)


WHY = {"panel": ("WHY: PANEL REVISION", MINT, GREEN), "own": ("WHY: OUR OWN IMPROVEMENT", GOLD_BG, GOLD_INK), "uat": ("WHY: UAT FEEDBACK", DARK, WHITE)}

# ---------------------------------------------------------------- 1 title
d.dark("Title")
d.text(0.9, 0.85, 11, ["CAPSTONE 2   ·   20% IT DEVELOPMENT DEFENSE"], size=13, bold=True, color=ON_DARK_SOFT, spc=140, h=0.28)
d.text(0.9, 1.75, 11.4, ["Developing a Graduate Student Lifecycle", "Monitoring and Analytics Platform"], size=40, bold=True, color=ON_DARK, h=1.5, gap=2, name="Title")
d.text(0.9, 3.42, 11.4, ["for the University of St. La Salle Graduate School"], size=24, color=ON_DARK_SOFT, h=0.5)
d.box(0.9, 5.45, 2.75, 0.78, fill="CFEBDB", radius=0.39, name="Group code")
d.text(0.9, 5.45, 2.75, ["CAP-2521-IT"], size=21, bold=True, color=DARK, align="c", h=0.78, anchor="m")
d.text(4.0, 5.48, 8.6, ["Mendoza   ·   Oseña   ·   Sanson   ·   Tumbaga"], size=18, bold=True, color=ON_DARK, h=0.36)
d.text(4.0, 5.9, 8.6, ["Adviser: Mr. Oliver A. Malabanan      |      November 2026"], size=13, color=ON_DARK_SOFT, h=0.28)
d.notes("Good day. We are CAP-2521-IT. This is our Capstone 2 defense.")

# ---------------------------------------------------------------- 2 problem
d.light("WHERE WE STARTED", "One student, many records, no single view")
for i, t in enumerate(["Status was checked by hand", "Decisions had to wait", "Reports were built by hand"]):
    y = 1.95 + i * 0.92
    d.num(0.6, y, i + 1, d=0.52, fill=GOLD_BG, color=GOLD_INK)
    d.text(1.35, y, 4.75, [t], size=20, bold=True, color=INK, h=0.52, anchor="m")
d.box(0.6, 4.95, 5.5, 1.6, fill=DARK, radius=0.16, name="Our answer")
d.text(0.92, 5.17, 4.9, ["OUR ANSWER"], size=10.5, bold=True, color=ON_DARK_SOFT, spc=80, h=0.22)
d.text(0.92, 5.5, 4.9, ["One place to see where every student stands."], size=21, bold=True, color=ON_DARK, h=0.85, line=1.02)
fit(SHOT("home"), 6.5, 1.9, 6.23, 4.65, alt="Staff home screen of the platform, current build")
d.notes("The problem is the same as in our proposal: a student's status sits in many places. Our answer is one place to see where each student stands. It works beside AIMS and the Registrar. It does not replace them.")

# ---------------------------------------------------------------- 3 capstone 1
d.light("CAPSTONE 1   ·   100% OF THE PROCESSES", "Every process was already complete at Capstone 1")
procs = ["Student Handoff", "Course Adjustments", "Enrollment", "Leave of Absence", "Readmission", "AWOL & Residency",
         "Course Audit", "Research Gate", "Panel Matching", "Defense Scheduling", "Practicum", "Withdrawal & Graduation"]
g = 0.18
cw, ch = (12.13 - 3 * g) / 4, 0.92
for i, name in enumerate(procs):
    r, c = divmod(i, 4)
    x, y = 0.6 + c * (cw + g), 1.9 + r * (ch + g)
    d.box(x, y, cw, ch, fill=WHITE, shadow=True, name="Process %d" % (i + 1))
    d.tick(x + 0.24, y + 0.26, d=0.4)
    d.text(x + 0.82, y, cw - 0.95, [name], size=15, bold=True, color=INK, h=ch, anchor="m")
d.box(0.6, 5.42, 12.13, 1.2, fill=GOLD_BG, radius=0.14, name="Key message")
d.text(1.0, 5.42, 11.33, ["Capstone 2 made them follow policy, and the Graduate School tested and accepted them."], size=20, bold=True, color=INK, h=1.2, anchor="m", line=1.05)
d.notes("Say this clearly before the demo: every process was already complete and demonstrated at Capstone 1. One hundred percent of the processes.\n\nCapstone 2 was about two things: making the processes follow policy, and having the Graduate School test and accept them.")

# ---------------------------------------------------------------- 4 what is new, and why
d.light("THE FINAL 20%", "What is new in Capstone 2, and why")
cards = [("Business rules in every workflow", "Each rule shows where it comes from.", "panel"),
         ("A signed Operations Manual", "The office had none, so we wrote one.", "panel"),
         ("Policy assistant with sources", "Staff upload the policy files it reads.", "panel"),
         ("Panel matching that explains its score", "The reasons are shown on screen.", "panel"),
         ("Defense scheduling with checks", "Stops double bookings and missing requirements.", "own"),
         ("Google Calendar integration", "Checks busy times and adds the booked defense.", "own"),
         ("A Monitoring Sheet staff can edit", "Every edit keeps who, when and why.", "own"),
         ("Group views of students", "By program and by year started.", "uat")]
g = 0.2
cw, ch = (12.13 - 3 * g) / 4, 2.3
for i, (ttl, line, why) in enumerate(cards):
    r, c = divmod(i, 4)
    x, y = 0.6 + c * (cw + g), 1.85 + r * (ch + g)
    d.box(x, y, cw, ch, fill=WHITE, shadow=True, name="New item %d" % (i + 1))
    d.num(x + 0.24, y + 0.24, i + 1, d=0.42)
    d.text(x + 0.24, y + 0.8, cw - 0.48, [ttl], size=15.5, bold=True, color=INK, h=0.56, line=1.0)
    d.text(x + 0.24, y + 1.4, cw - 0.48, [line], size=11.5, color=TEXT, h=0.4)
    lbl, f, col = WHY[why]
    d.pill(x + 0.24, y + ch - 0.44, lbl, fill=f, color=col, size=8.5, h=0.28)
d.notes("This is the heart of Capstone 2: what we added, and why.\n\nFour came from the panel's revisions. Three are our own improvements: defense scheduling checks, Google Calendar, and a Monitoring Sheet staff can edit. One came from the Graduate School during user acceptance testing.")

# ---------------------------------------------------------------- 5 demo
d.dark("Live demo")
d.text(0.9, 0.85, 11, ["LIVE DEMO"], size=13, bold=True, color=ON_DARK_SOFT, spc=140, h=0.28)
d.text(0.9, 1.3, 11.5, ["The new features"], size=44, bold=True, color=ON_DARK, h=0.85, name="Title")
d.text(0.9, 2.3, 10.8, ["Every process was already complete at Capstone 1. Today we show what Capstone 2 added."], size=17, color=ON_DARK_SOFT, h=0.4)
stops = ["Business rules", "Policy assistant", "Panel matching", "Defense scheduling", "Google Calendar", "Monitoring Sheet", "Group views"]
g = 0.2
cw, ch = (11.53 - 3 * g) / 4, 1.2
for i, ttl in enumerate(stops):
    r, c = divmod(i, 4)
    x, y = 0.9 + c * (cw + g), 3.4 + r * (ch + 0.22)
    d.box(x, y, cw, ch, fill=WHITE, alpha=9, radius=0.14, name="Demo stop %d" % (i + 1))
    d.num(x + 0.24, y + 0.38, i + 1, d=0.44, fill=EMERALD, color=DARK)
    d.text(x + 0.86, y, cw - 1.0, [ttl], size=15.5, bold=True, color=ON_DARK, h=ch, anchor="m", line=1.0)
d.notes("Open with: every process was already complete at Capstone 1, so today we show what is new and why.\n\n"
        "Seven stops. The next seven slides show each one, in the same order, in case the live system cannot be shown.\n\n"
        "1 Business Rules: search 'withdraw'. 2 Policy Assistant: ask when adding a subject is allowed. 3 Panel Matching: open 'Why this score'. "
        "4 Defense Scheduling: choose a student. 5 Google Calendar: sign in as faculty, My Calendar. 6 Monitoring Sheet. 7 Reports, By year started.")


# ---------------------------------------------------------------- 6-12 demo slides, one per new feature
def feature(n, title, shot, alt, points, why, note, inset=None):
    d.light("DEMO   ·   STOP %d" % n, title)
    w, h = fit(SHOT(shot), 0.6, 1.72, 8.0, 5.05, alt=alt)
    px = 0.6 + w + 0.4
    pw = 12.73 - px
    lbl, f, col = WHY[why]
    d.pill(px, 1.76, lbl, fill=f, color=col, size=9, h=0.28)
    y = 2.4
    if inset:
        iw, ih = d.image(SHOT(inset), px, 2.28, w=pw, border=True, alt=alt + ", close-up")
        y = 2.28 + ih + 0.32
    step = 0.98 if not inset else 0.74
    for i, t in enumerate(points):
        d.num(px, y + i * step + 0.1, i + 1, d=0.38)
        d.text(px + 0.55, y + i * step, pw - 0.55, [t], size=15 if not inset else 14, bold=True, color=INK, h=0.58, anchor="m", line=1.0)
    d.notes(note)


feature(1, "Business rules with a source", "rules", "Business Rules register, searched for withdraw",
        ["Every rule shows its source", "Workflows name the rule when they stop an action", "Official rules are locked"], "panel",
        "Business Rules. Search 'withdraw'. Each rule shows the document and page it comes from. The workflows read from this list.")
feature(2, "A policy answer that names its source", "assistant", "Policy Assistant answering a question with its source",
        ["Staff upload the policy files", "Each answer shows the document and page", "It says so when the files do not cover it"], "panel",
        "Policy Assistant. Ask when adding a subject is allowed. The answer shows the document and the page. Staff add new policy files under Policy Documents.")
feature(3, "Panel matching that explains its score", "matching", "Panel Matching with the score breakdown open",
        ["A score with its reasons", "Expertise, availability, workload", "A person makes the final choice"], "panel",
        "Panel Matching. Open 'Why this score'. The score is built from expertise, availability and workload, and a person still makes the final choice.")
feature(4, "Scheduling that checks before it books", "scheduling", "Defense Scheduling with a student chosen and the readiness check",
        ["Checks that requirements are complete", "Finds times the whole panel is free", "Stops double bookings"], "own",
        "Defense Scheduling. Choose a student. The screen checks that the requirements are complete, finds times the whole panel is free, and stops a double booking.")
feature(5, "Google Calendar integration", "calendar", "Faculty My Calendar page with the Google Calendar connection",
        ["Faculty connect their own calendar", "Busy times are kept out of defense slots", "A booked defense is added to the calendar"], "own",
        "Google Calendar. Each faculty member can connect a Google Calendar from My Calendar. Busy times are kept out of the possible defense times, and a booked defense is added to the calendar. It is optional.\n\n"
        "Tip: the Google connection works only on the demo laptop at localhost:5000.", inset="calendar-card")
feature(6, "A Monitoring Sheet staff can edit", "monitoring", "Monitoring Sheet, current build",
        ["A whole group on one grid", "Add or correct a record in the portal", "Every edit keeps who, when and why"], "own",
        "Monitoring Sheet. Pick a program and a year. Staff can add or correct a record here, and each edit keeps who, when and why.")
feature(7, "Group views of students", "reports", "Reports and Analytics, students by year started",
        ["Students by year started", "Every number opens its list of students", "Boards for Leave and the Research Gate"], "uat",
        "Reports, By year started. One view of each group of students. This came from the Graduate School during user acceptance testing.")

# ---------------------------------------------------------------- UAT how
d.light("USER ACCEPTANCE TESTING", "How we ran the user acceptance test")
xs = [2.1, 5.15, 8.2, 11.25]
d.hline(xs[0], 2.95, xs[-1], color="A9CDB9", width=2.5)
steps = [("4 Nov", "Round 1", "Former Associate Dean", GREEN, WHITE),
         ("By 9 Nov", "Revisions applied", "No workflow had to change", GOLD, WHITE),
         ("9 to 14 Nov", "Round 2", "Dean and Graduate School personnel", GREEN, WHITE),
         ("17 Nov", "Accepted", "Signed papers received", EMERALD, DARK)]
for i, (date, ttl, body, col, ncol) in enumerate(steps):
    cx = xs[i]
    d.text(cx - 1.4, 2.02, 2.8, [date], size=15, bold=True, color=GREEN, align="c", h=0.34)
    d.num(cx - 0.3, 2.65, i + 1, d=0.6, fill=col, color=ncol)
    d.text(cx - 1.45, 3.48, 2.9, [ttl], size=20, bold=True, color=INK, align="c", h=0.42)
    d.text(cx - 1.3, 3.96, 2.6, [body], size=13.5, color=TEXT, align="c", h=0.5)
d.box(0.6, 4.9, 12.13, 1.7, fill=WHITE, shadow=True, name="Each round")
d.text(0.95, 5.1, 4, ["IN EACH ROUND"], size=10.5, bold=True, color=GREEN, spc=80, h=0.22)
x = 0.95
for i, t in enumerate(["Demonstration", "Hands-on testing", "Signed form"]):
    w = d.pill(x, 5.43, t, fill=MINT, color=DARK, size=15, pad=0.3, h=0.56)
    x += w + 0.16
    if i < 2:
        d.chevron(x, 5.56, w=0.2, h=0.3)
        x += 0.2 + 0.16
d.text(0.95, 6.16, 11.4, ["Round 2 ran on Google Meet, with several sessions for each reviewer."], size=12.5, color=MUTED, h=0.26)
d.notes("Two rounds.\n\nRound 1 was with the former Associate Dean, Sir Eddie de Paula. We applied the revisions, and none of them changed a workflow.\n\n"
        "Round 2 was with the Dean, Sir Eric Dio, and the Graduate School personnel, from 9 to 14 November, on Google Meet, with several sessions for each reviewer. Then they tested the web app themselves. The signed papers came on 17 November.")

# ---------------------------------------------------------------- UAT who: two signed forms
d.light("USER ACCEPTANCE TESTING   ·   WHO REVIEWED", "Two signed UAT forms")
cw, ch, cy = 5.955, 3.4, 1.85


def form_card(x, dark, tag, name, role, signed, page, alt):
    c_main, c_soft = (ON_DARK, ON_DARK_SOFT) if dark else (INK, MUTED)
    d.box(x, cy, cw, ch, fill=DARK if dark else WHITE, radius=0.16, shadow=not dark, name=tag)
    iw, ih = d.image(DOC(page), x + 0.32, cy + 0.42, h=2.56, border=True, shadow=False, alt=alt)
    tx = x + 0.32 + iw + 0.34
    tw = x + cw - 0.3 - tx
    d.pill(tx, cy + 0.42, tag, fill=EMERALD if dark else GOLD_BG, color=DARK if dark else GOLD_INK, size=9.5, h=0.3)
    d.text(tx, cy + 1.0, tw, ["SIGNED BY"], size=10, bold=True, color=c_soft, spc=80, h=0.22)
    d.text(tx, cy + 1.27, tw, [name], size=18, bold=True, color=c_main, h=0.4)
    d.text(tx, cy + 1.74, tw, [role], size=14.5, color=c_main, h=0.32)
    d.text(tx, cy + 2.12, tw, [signed], size=12, color=c_soft, h=0.26)


form_card(0.6, False, "FORM 1   ·   ROUND 1", "Eddie de Paula, Jr.", "Former Associate Dean", "Signed 6 November 2026",
          "r1-001.jpg", "First page of the Round 1 UAT form")
form_card(0.6 + cw + 0.22, True, "FORM 2   ·   ROUND 2", "Eric Arthur N. Dio, PhD", "Dean, Graduate School", "Signed 17 November 2026",
          "r2-001.jpg", "First page of the Round 2 UAT form")
d.box(0.6, 5.47, 12.13, 1.25, fill=MINT, radius=0.14, name="Personnel on form 2")
d.text(0.92, 5.62, 11.5, ["FORM 2 ALSO COVERS THE GRADUATE SCHOOL PERSONNEL"], size=10, bold=True, color=GREEN, spc=80, h=0.22)
for i, (n, r) in enumerate([("Jiema Calinsag", "Graduate School Staff"), ("Maribeth Pillo, PhD", "Academic Coordinator"),
                            ("Ena Apelo, RPsy, RPM", "Research Coordinator"), ("Erika Nicolas, PhD", "Faculty")]):
    x = 0.92 + i * 2.95
    d.text(x, 5.95, 2.8, [n], size=14, bold=True, color=INK, h=0.3)
    d.text(x, 6.26, 2.8, [r], size=11.5, color=TEXT, h=0.25)
d.notes("We have two signed UAT forms.\n\nForm 1, Round 1: signed by Sir Eddie de Paula, the former Associate Dean.\n\n"
        "Form 2, Round 2: signed by the Dean, Sir Eric Dio, for himself and the Graduate School personnel who took part: the staff, the two coordinators and a faculty member. The form says so.")

# ---------------------------------------------------------------- UAT result
d.light("UAT RESULT", "Accepted with minor revisions, then accepted")


def result_card(x, dark, tag, who, points, verdict, vfill, vcol):
    c_main = ON_DARK if dark else INK
    d.box(x, 1.85, 5.6, 3.9, fill=DARK if dark else WHITE, radius=0.16, shadow=not dark, name=tag)
    d.pill(x + 0.35, 2.12, tag, fill=EMERALD if dark else MINT, color=DARK if dark else GREEN, size=10, h=0.3)
    d.text(x + 0.35, 2.58, 4.9, [who], size=19, bold=True, color=c_main, h=0.4)
    for i, t in enumerate(points):
        y = 3.2 + i * 0.52
        d.tick(x + 0.35, y + 0.02, d=0.32, fill=EMERALD if dark else GREEN)
        d.text(x + 0.85, y, 4.45, [t], size=14.5, color=c_main, h=0.36, anchor="m")
    d.box(x + 0.35, 4.95, 4.9, 0.54, fill=vfill, radius=0.27, name="Decision")
    d.text(x + 0.35, 4.95, 4.9, [verdict], size=15, bold=True, color=vcol, align="c", h=0.54, anchor="m")


result_card(0.6, False, "ROUND 1   ·   EDDIE DE PAULA, JR.", "Former Associate Dean",
            ["Every function check confirmed", "Matches the Graduate School's process", "Five small changes requested"],
            "Accepted with minor revisions", GOLD_BG, GOLD_INK)
result_card(7.13, True, "ROUND 2   ·   ERIC ARTHUR N. DIO, PHD", "Dean and Graduate School personnel",
            ["Every function check confirmed", "Matches the Graduate School's process", "No further revisions"],
            "Accepted", EMERALD, DARK)
d.chevron(6.42, 3.55, w=0.3, h=0.5, fill=EMERALD)
d.chevron(6.6, 3.55, w=0.3, h=0.5, fill="A9CDB9")
d.text(0.6, 6.12, 12.13, [[("“The group has already implemented all the revisions… so we have no further comments or revisions.”", {"italic": True, "bold": True, "color": INK})]], size=14, align="c", h=0.3)
d.text(0.6, 6.5, 12.13, ["The Dean, on the Round 2 form"], size=11.5, color=MUTED, align="c", h=0.24)
d.notes("Round 1: accepted with minor revisions. Round 2: accepted, with no further revisions.\n\nIf asked for the scores: they are on the signed forms in the backup slides.")

# ---------------------------------------------------------------- feedback -> changes
d.light("GRADUATE SCHOOL FEEDBACK", "What Round 1 asked for, and what we added")
fb = [("Monitoring Sheet", "A whole group and its subjects on one grid"),
      ("Leave history", "Earlier leaves shown before a decision"),
      ("Research Gate board", "Every student's milestone at a glance"),
      ("Acting for the panel", "Staff can record for a panelist"),
      ("Reports by year started", "One view for each group of students")]
rh, rg = 0.76, 0.09
for i, (lead, body) in enumerate(fb):
    y = 1.85 + i * (rh + rg)
    d.box(0.6, y, 5.1, rh, fill=WHITE, shadow=True, name="Feedback %d" % (i + 1))
    d.num(0.8, y + 0.19, i + 1, d=0.38, fill=GOLD_BG, color=GOLD_INK)
    d.text(1.42, y + 0.13, 4.1, [lead], size=15, bold=True, color=INK, h=0.3)
    d.text(1.42, y + 0.43, 4.1, [body], size=12.5, color=MUTED, h=0.26)
d.box(0.6, 6.13, 5.1, 0.56, fill=GOLD_BG, radius=0.14, name="Key message")
d.text(0.6, 6.13, 5.1, ["None of these changed a workflow."], size=14, bold=True, color=INK, align="c", h=0.56, anchor="m")
w, h = fit(SHOT("gate"), 6.0, 1.85, 6.73, 4.55, alt="Research Gate board, current build")
d.text(6.0, 1.85 + h + 0.1, w, ["Research Gate board, current build"], size=10.5, color=MUTED, align="c", h=0.22)
d.notes("Round 1 asked for five small changes. All five were added before Round 2. None of them changed a workflow: they changed how information is grouped and who can act.")

# ---------------------------------------------------------------- accepted, in writing
d.light("SIGNED BY THE GRADUATE SCHOOL", "Accepted by the Graduate School, in writing")
d.pill(0.6, 1.72, "ACCEPTANCE LETTER   ·   THE DEAN", fill=DARK, color=WHITE, size=9, h=0.27)
d.image(DOC("letter-001.jpg"), 0.6, 2.12, h=4.5, border=True, alt="Acceptance letter signed by the Dean of the Graduate School, 17 November 2026")
CROP = (0.0, 0.17, 0.0, 0.07)
d.pill(3.75, 1.72, "UAT FORM 2   ·   THE DEAN   ·   ACCEPTED", fill=MINT, color=GREEN, size=9, h=0.27)
d.image(DOC("r2hi-012.jpg"), 3.75, 2.12, w=4.2, border=True, crop=CROP, alt="Round 2 UAT form, acceptance page signed by the Dean")
d.pill(8.53, 1.72, "UAT FORM 1   ·   FORMER ASSOCIATE DEAN", fill=GOLD_BG, color=GOLD_INK, size=9, h=0.27)
d.image(DOC("r1hi-012.jpg"), 8.53, 2.12, w=4.2, border=True, crop=CROP, alt="Round 1 UAT form, acceptance page signed by the former Associate Dean")
d.text(3.75, 6.42, 8.98, [[("“…presented, demonstrated, tested, reviewed, and accepted…”", {"bold": True, "color": INK}), ("     Acceptance letter", {"color": MUTED})]], size=12, h=0.28)
d.notes("The acceptance is in writing: the letter from the Dean and both signed forms. Every page is in the backup slides.")

# ---------------------------------------------------------------- operations manual
d.light("OPERATIONS MANUAL", "The Operations Manual is approved and signed")
d.image(DOC("manual-001.jpg"), 0.6, 1.8, h=4.4, border=True, alt="Cover of the approved Graduate School Operations Manual")
d.image(A + "/docs/manual-signoff.png", 4.05, 1.8, h=4.4, border=True, alt="Sign-off table of the Operations Manual with names, dates and signatures")
d.text(0.6, 6.42, 12.13, ["The Graduate School had no operations manual. We wrote one, and the Graduate School validated and signed it."], size=15, color=INK, h=0.34)
d.notes("The Graduate School had no operations manual. The panel suggested we write one. We did, and the Graduate School validated and signed it.")

# ---------------------------------------------------------------- conclusions
d.light("CONCLUSIONS", "What the study achieved")
concl = [("Understand how the Graduate School works", "Written into a manual the Graduate School signed"),
         ("Find the right solution", "A monitoring layer beside AIMS and the Registrar"),
         ("Build the modules", "Every process records who did what, and when"),
         ("Deliver analytics", "Reports that show many students at once"),
         ("Test with the intended users", "Two rounds, accepted by the Graduate School")]
rh, rg = 0.72, 0.1
for i, (obj, found) in enumerate(concl):
    y = 1.8 + i * (rh + rg)
    d.box(0.6, y, 12.13, rh, fill=WHITE, shadow=True, name="Objective %d" % (i + 1))
    d.tick(0.82, y + 0.18, d=0.36)
    d.text(1.45, y, 4.7, [obj], size=15.5, bold=True, color=INK, h=rh, anchor="m")
    d.text(6.4, y, 6.1, [found], size=14.5, color=TEXT, h=rh, anchor="m")
d.box(0.6, 5.98, 12.13, 0.78, fill=DARK, radius=0.14, name="Conclusion")
d.text(0.95, 5.98, 11.45, ["One view of each student's journey, built on the Graduate School's own rules, and accepted in writing."], size=16, bold=True, color=ON_DARK, h=0.78, anchor="m", line=1.02)
d.notes("Our conclusions follow the five objectives of the study, one row each.")

# ---------------------------------------------------------------- recommendations
d.light("RECOMMENDATIONS", "What comes next")
recs = ["Test with graduate students", "Confirm the remaining policy values and risk rules", "Measure the KPIs defined in the paper",
        "Pilot with real records, with data privacy approval", "A short guide for each role", "A Registrar step that confirms a change was applied"]
cw, ch, g = (12.13 - 0.25) / 2, 1.08, 0.2
for i, t in enumerate(recs):
    r, c = divmod(i, 2)
    x, y = 0.6 + c * (cw + 0.25), 1.85 + r * (ch + g)
    d.box(x, y, cw, ch, fill=WHITE, shadow=True, name="Recommendation %d" % (i + 1))
    d.num(x + 0.28, y + 0.32, i + 1, d=0.44)
    d.text(x + 0.95, y, cw - 1.2, [t], size=16, bold=True, color=INK, h=ch, anchor="m", line=1.0)
d.box(0.6, 5.85, 12.13, 0.82, fill=MINT, radius=0.14, name="Future study")
d.text(0.95, 5.85, 11.45, [[("For future study: ", {"bold": True, "color": GREEN}), ("early warning for students at risk of delay.", {"bold": True, "color": INK})]], size=16, h=0.82, anchor="m")
d.notes("What comes next. The first is testing with graduate students, the one group that has not tested yet.")

# ---------------------------------------------------------------- closing
d.dark("Thank you")
d.text(0.9, 2.2, 11, ["Thank you"], size=66, bold=True, color=ON_DARK, h=1.2, name="Title")
d.text(0.9, 3.55, 11, ["We welcome the panel's questions."], size=22, color=ON_DARK_SOFT, h=0.45)
d.hline(0.9, 4.75, 3.4, color=EMERALD, width=2.5)
d.text(0.9, 4.98, 11, ["CAP-2521-IT   ·   Mendoza, Oseña, Sanson, Tumbaga"], size=16, bold=True, color=ON_DARK, h=0.34)
d.text(0.9, 5.4, 11, ["Capstone 2   ·   20% IT Development Defense   ·   November 2026"], size=13, color=ON_DARK_SOFT, h=0.28)
d.notes("Thank you. We welcome your questions.")

# ================================================================ backup
d.dark("Backup")
d.text(0.9, 0.85, 11, ["APPENDIX"], size=13, bold=True, color=ON_DARK_SOFT, spc=140, h=0.28)
d.text(0.9, 1.5, 11.5, ["Backup slides"], size=44, bold=True, color=ON_DARK, h=0.85, name="Title")
for i, (k, t) in enumerate([("A", "Signed documents, page by page"), ("B", "Capstone 1 panel revisions"), ("C", "System screens")]):
    y = 3.1 + i * 0.82
    d.num(0.9, y, k, d=0.5, fill=EMERALD, color=DARK, size=17)
    d.text(1.65, y, 9, [t], size=20, color=ON_DARK, h=0.5, anchor="m")


def doc_grid(title, files, first_page):
    d.light("BACKUP   ·   SIGNED DOCUMENTS", title, size=26)
    gap = 0.3
    pw = (12.13 - gap * 2) / 3
    for i, f in enumerate(files):
        x = 0.6 + i * (pw + gap)
        w, h = d.image(f, x, 1.58, w=pw, border=True, alt="%s, page %d" % (title, first_page + i))
        d.text(x, 1.58 + h + 0.06, pw, ["Page %d" % (first_page + i)], size=10, color=MUTED, align="c", h=0.2, check=False)


for k in range(4):
    doc_grid("UAT form 1, signed by Eddie de Paula, Jr. (pages %d to %d)" % (k * 3 + 1, k * 3 + 3), [DOC("r1-%03d.jpg" % p) for p in range(k * 3 + 1, k * 3 + 4)], k * 3 + 1)
for k in range(4):
    doc_grid("UAT form 2, signed by Dean Eric Dio (pages %d to %d)" % (k * 3 + 1, k * 3 + 3), [DOC("r2-%03d.jpg" % p) for p in range(k * 3 + 1, k * 3 + 4)], k * 3 + 1)

d.light("BACKUP   ·   SIGNED DOCUMENTS", "Acceptance letter and the Operations Manual", size=26)
x = 0.6
for f, cap in [(DOC("letter-001.jpg"), "Acceptance letter"), (DOC("manual-001.jpg"), "Operations Manual, cover"),
               (DOC("manual-003.jpg"), "Operations Manual, contents"), (DOC("manual-109.jpg"), "Operations Manual, sign-off page")]:
    w, h = d.image(f, x, 1.72, h=4.2, border=True, alt=cap)
    d.text(x, 6.0, w, [cap], size=10, color=MUTED, align="c", h=0.2, check=False)
    x += w + 0.215

# ---- B: panel revisions
d.light("BACKUP   ·   CAPSTONE 1 PANEL REVISIONS", "What the panel asked for, and what we did", size=26)
asks = [("Upload more documents and policies", "Policy Documents library"),
        ("Put policies into the student lifecycle", "Business rules inside every workflow"),
        ("Business rules: can a student drop on Day 1?", "Add, drop and withdrawal follow the Handbook"),
        ("Matching gave every record the same score", "Each paper now gets its own score"),
        ("Include the operations manual", "Written, validated and signed"),
        ("Policy chat and sign-in were not shown", "Both are in today's demo")]
rh, rg = 0.7, 0.1
for i, (ask, did) in enumerate(asks):
    y = 1.75 + i * (rh + rg)
    d.box(0.6, y, 12.13, rh, fill=WHITE, shadow=True, name="Revision %d" % (i + 1))
    d.num(0.8, y + 0.17, i + 1, d=0.36)
    d.text(1.4, y, 5.0, [ask], size=14.5, bold=True, color=INK, h=rh, anchor="m")
    d.chevron(6.55, y + 0.19, w=0.2, h=0.32)
    d.text(7.0, y, 5.5, [did], size=14.5, color=TEXT, h=rh, anchor="m")

# ---- C: system screens (Policy Documents left out: that page still labels the manual a draft)
screens = [(f, c) for f, c in json.load(open(A + "/screens.json")) if c != "Policy Documents"]
per = 6
for k in range(0, len(screens), per):
    chunk = screens[k:k + per]
    d.light("BACKUP   ·   CURRENT BUILD", "System screens", size=26)
    iw = 3.7
    for i, (f, cap) in enumerate(chunk):
        r, c = divmod(i, 3)
        x, y = 0.6 + c * (iw + 0.515), 1.6 + r * 2.68
        w, h = d.image(f, x, y, w=iw, border=True, alt=cap + " screen")
        d.text(x, y + h + 0.06, iw, [cap], size=10.5, bold=True, color=INK, align="c", h=0.22, check=False)

d.save(OUT)
print("slides:", len(d.prs.slides), "screens:", len(screens))
for wmsg in WARN:
    print("WARN", wmsg)
