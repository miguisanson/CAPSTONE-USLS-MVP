"""Builds CAP-2521-IT-CAP2DEFPRES v6: numbered features, enhancements slide, site traffic. usage: build_deck6.py <scratchpad> <out.pptx>"""
import sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from deckkit2 import *
from PIL import Image as _I

SP, OUT = sys.argv[1], sys.argv[2]
A = SP + "/assets"
SHOT = lambda n: "%s/shots/%s.png" % (A, n)
DOC = lambda n: "%s/docs/%s" % (A, n)
d = Deck()
d.assets = A
RULE = "2F6E55"   # hairline on dark panels


def fit(path, x, y, maxw, maxh, **kw):
    iw, ih = _I.open(path).size
    if maxw * ih / iw <= maxh:
        return d.image(path, x, y, w=maxw, **kw)
    return d.image(path, x, y, h=maxh, **kw)


def points(x, y, w, items, size=14, step=None, color=TEXT, icon_color="green", bold=False):
    """check-marked statements, one under the other; returns the y after the last one"""
    for t in items:
        est = d.text(x + 0.46, y, w - 0.46, [t], size=size, color=color, bold=bold, line=1.08)
        d.icon(x, y + 0.01, 0.28, "check", icon_color)
        y += (step if step else est + 0.3)
    return y


# ================================================================ 1 title
d.dark("Title")
d.text(0.9, 0.9, 11, ["CAPSTONE 2 · IT DEVELOPMENT DEFENSE (20%)"], size=13, bold=True, color=ON_DARK_SOFT, h=0.28)
d.text(0.9, 1.75, 11.4, ["Developing a Graduate Student Lifecycle", "Monitoring and Analytics Platform"], size=40, bold=True, color=ON_DARK, h=1.5, gap=2, name="Title")
d.text(0.9, 3.42, 11.4, ["for the University of St. La Salle Graduate School"], size=24, color=ON_DARK_SOFT, h=0.5)
d.box(0.9, 5.42, 2.55, 0.8, fill="CFEBDB", radius=0.1, name="Group code")
d.text(0.9, 5.42, 2.55, ["CAP-2521-IT"], size=20, bold=True, color=DARK, align="c", h=0.8, anchor="m")
d.text(3.8, 5.46, 8.6, ["Mendoza, Oseña, Sanson, and Tumbaga"], size=18, bold=True, color=ON_DARK, h=0.36)
d.text(3.8, 5.88, 8.6, ["Adviser: Mr. Oliver A. Malabanan | November 2026"], size=13, color=ON_DARK_SOFT, h=0.28)
d.notes("Good day. We are CAP-2521-IT, and this is our Capstone 2 defense.")

# ================================================================ 2 comparison
d.light("layers", "PROJECT SCOPE · CAPSTONE 1 AND CAPSTONE 2", "All processes were implemented in Capstone 1")
# --- Capstone 1
d.box(0.6, 1.7, 7.0, 4.98, fill=DARK, radius=0.1, name="Capstone 1")
d.text(0.95, 1.95, 6.3, ["CAPSTONE 1 · 80% DEFENSE"], size=11, bold=True, color=ON_DARK_SOFT, h=0.24)
d.text(0.95, 2.26, 2.75, ["100%"], size=56, bold=True, color=ON_DARK, h=0.95, anchor="m")
d.text(3.75, 2.26, 3.6, ["of the student lifecycle processes were implemented and demonstrated."], size=15, bold=True, color=ON_DARK, h=0.95, anchor="m", line=1.08)
d.hline(0.95, 3.42, 7.25, color=RULE)
procs = [("handoff", "Student Handoff"), ("adjust", "Course Adjustments"), ("enroll", "Enrollment"), ("leave", "Leave of Absence"),
         ("readmit", "Readmission"), ("awol", "AWOL and Residency"), ("audit", "Course Audit"), ("research", "Research Gate"),
         ("panel", "Panel Matching"), ("schedule", "Defense Scheduling"), ("practicum", "Practicum"), ("graduate", "Withdrawal and Graduation")]
for i, (ic, name) in enumerate(procs):
    r, c = divmod(i, 3)
    x, y = 0.95 + c * 2.12, 3.62 + r * 0.74
    d.icon(x, y + 0.13, 0.3, ic, "white")
    d.text(x + 0.44, y, 1.5, [name], size=12.5, bold=True, color=ON_DARK, h=0.56, anchor="m", line=1.0)
# --- Capstone 2
d.card(7.88, 1.7, 4.85, 4.98, name="Capstone 2")
d.text(8.2, 1.95, 4.2, ["CAPSTONE 2 · 20% DEFENSE"], size=11, bold=True, color=GREEN, h=0.24)
d.text(8.2, 2.3, 4.3, ["The remaining work"], size=26, bold=True, color=INK, h=0.52)
d.text(8.2, 2.9, 4.3, ["Completed in Capstone 2 for this defense."], size=12.5, color=MUTED, h=0.26)
d.hline(8.2, 3.42, 12.41, color=LINE)
rest = [("revise", "Panel revisions", "Policies and business rules integrated into the workflows."),
        ("refine", "System refinements", "Scheduling validation, Google Calendar, and record maintenance."),
        ("usercheck", "User acceptance testing", "Evaluated and accepted by the Graduate School."),
        ("manual", "Operations Manual", "Validated and signed by the Graduate School.")]
for i, (ic, ttl, body) in enumerate(rest):
    y = 3.62 + i * 0.76
    d.tile(8.2, y + 0.03, 0.5, ic, fill=GOLD_BG, color="gold", radius=0.08)
    d.text(8.88, y, 3.6, [ttl], size=13.5, bold=True, color=INK, h=0.26)
    d.text(8.88, y + 0.27, 3.6, [body], size=11, color=TEXT, h=0.42, line=1.02)
# --- arrow badge on the seam
d.oval(7.46, 3.93, 0.56, 0.56, WHITE, name="Arrow badge")
d.icon(7.6, 4.07, 0.28, "arrow", "green")
d.notes("At the Capstone 1 defense, one hundred percent of the student lifecycle processes were already implemented and demonstrated: all twelve.\n\n"
        "Capstone 2 covers the remaining work: the panel's revisions, refinements to the system, user acceptance testing with the Graduate School, and the Operations Manual.")

# ================================================================ 3 additions in detail (numbered 1 to 8; the next slides follow the same numbers)
d.light("flag", "CAPSTONE 2 · THE REMAINING 20%", "Features added in Capstone 2")
adds = [("rules", "Business rules in every workflow", "Each rule cites its governing policy and page.", True),
        ("assistant", "Policy library and assistant", "Responses cite the source document and page.", True),
        ("panel", "Explained panel matching", "Each recommendation shows the basis for its score.", True),
        ("calcheck", "Defense scheduling validation", "Requirements and availability are verified before a schedule is set.", False),
        ("calplus", "Google Calendar integration", "Faculty may link a calendar to supply their availability.", False),
        ("sheet", "Editable Monitoring Sheet", "Authorized staff may add or correct records, with a change history.", False),
        ("chart", "Group views and reports", "Students are presented by program and year admitted.", False),
        ("manual", "Operations Manual", "Prepared by the group; validated and signed by the Graduate School.", True)]
g = 0.2
cw, ch = (12.13 - 3 * g) / 4, 2.3
for i, (ic, ttl, body, panel) in enumerate(adds):
    r, c = divmod(i, 4)
    x, y = 0.6 + c * (cw + g), 1.7 + r * (ch + g)
    d.card(x, y, cw, ch, name="Feature %d" % (i + 1))
    d.tile(x + 0.24, y + 0.24, 0.56, ic)
    d.text(x + 0.94, y + 0.24, 0.5, [str(i + 1)], size=24, bold=True, color=GREEN, h=0.56, anchor="m", check=False)
    if panel:
        tw = text_w("PANEL REVISION", 8.5, True) + 0.24
        d.tag(x + cw - 0.24 - tw, y + 0.39, "PANEL REVISION")
    d.text(x + 0.24, y + 0.98, cw - 0.48, [ttl], size=14.5, bold=True, color=INK, h=0.5, line=1.02)
    d.text(x + 0.24, y + 1.52, cw - 0.48, [body], size=12, color=TEXT, h=0.66, line=1.06)
tw = d.tag(0.6, 6.67, "PANEL REVISION")
d.text(0.6 + tw + 0.14, 6.67, 9, ["Addresses a revision required by the panel at the Capstone 1 defense."], size=11, color=MUTED, h=0.26, anchor="m")
d.notes("These are the eight features added in Capstone 2. The slides that follow present them in this order, with the same numbers.\n\n"
        "Features 1, 2, 3 and 8 address the revisions required by the panel at the Capstone 1 defense. Features 4 to 7 are refinements.")


# ================================================================ 4-10 the eight features, in order; the boxes at the top right show which one is on screen
def tracker(active):
    n, bw, g = 8, 0.3, 0.07
    x0 = 12.73 - (n * bw + (n - 1) * g)
    for i in range(1, n + 1):
        on = i in active
        x = x0 + (i - 1) * (bw + g)
        d.box(x, 0.86, bw, bw, fill=DARK if on else LIGHT, radius=0.06, line=None if on else LINE, name="Feature %d marker" % i)
        d.text(x, 0.86, bw, [str(i)], size=10, bold=True, color=WHITE if on else MUTED, align="c", h=bw, anchor="m", check=False)


def feature(nums, icon, title, shot, alt, items, note, where, panel=False, inset=None):
    label = "FEATURE %d OF 8" % nums[0] if len(nums) == 1 else "FEATURES %d AND %d OF 8" % tuple(nums)
    d.light(icon, label + " · SYSTEM DEMONSTRATION", title, tw=8.25)
    tracker(nums)
    w, h = fit(SHOT(shot), 0.6, 1.7, 8.0, 4.98, alt=alt)
    px = 0.6 + w + 0.32
    pw = 12.73 - px
    d.card(px, 1.7, pw, 4.98, name="Side panel")
    ix, iw = px + 0.28, pw - 0.56
    y = 1.98
    if panel:
        d.tag(ix, y, "PANEL REVISION")
        y += 0.5
    for t in items:
        est = d.text(ix + 0.42, y, iw - 0.42, [t], size=13.5, color=TEXT, line=1.08)
        d.icon(ix, y + 0.01, 0.26, "check", "green")
        y += est + 0.24
    if inset:
        cw_ = 2.95
        top = 6.68 - 0.26 - cw_ * 370 / 682
        d.text(ix, top - 0.3, iw, ["FACULTY PORTAL: MY CALENDAR"], size=9.5, bold=True, color=MUTED, h=0.22)
        d.image(SHOT(inset), ix, top, w=cw_, border=True, shadow=False, alt="Google Calendar connection card in the faculty portal")
    else:
        d.hline(ix, 5.72, px + pw - 0.28, color=LINE)
        d.text(ix, 5.88, iw, ["LOCATION IN THE SYSTEM"], size=9.5, bold=True, color=MUTED, h=0.22)
        d.text(ix, 6.13, iw, [where], size=12.5, bold=True, color=INK, h=0.3)
    d.notes(note)


feature([1], "rules", "Business rules with policy sources", "rules", "Business Rules register showing a rule with its source document and page",
        ["Each rule states its value, its source document, and the page.", "Every workflow screen lists the rules it applies."],
        "Feature 1, Business Rules. Each rule states its value, the source document and the page. The workflow screens list the rules they apply.", "Staff portal: Business Rules", panel=True)
feature([2], "assistant", "Policy assistant with cited sources", "assistant", "Policy Assistant answering a question with its source",
        ["Responses are drawn from the policy documents uploaded by staff.", "Each response identifies the source document and page."],
        "Feature 2, the policy library and assistant. Responses are drawn from the policy documents that staff upload, and each response identifies its source document and page.", "Staff portal: Policy Assistant", panel=True)
feature([3], "panel", "Panel matching with explained scores", "matching", "Panel Matching with the score breakdown open",
        ["Each recommended panelist is shown with the basis for the score.", "The final selection of the panel remains with Graduate School staff."],
        "Feature 3, Panel Matching. Each recommended panelist is shown with the basis for the score. The final selection remains with Graduate School staff.", "Staff portal: Panel Matching", panel=True)
feature([4, 5], "calcheck", "Defense scheduling and Google Calendar", "scheduling", "Defense Scheduling with a student selected and the readiness check",
        ["Student requirements are verified before a defense is scheduled.", "Panel availability is compared to identify common times.",
         "Faculty may link a Google Calendar to supply their availability."],
        "Features 4 and 5, Defense Scheduling and Google Calendar. Student requirements are verified first, and the availability of the panel is compared to identify common times.\n\n"
        "Faculty members may link a Google Calendar from the faculty portal to supply their availability. Linking is optional.\n\n"
        "Reminder for the presenter: the Google connection works only on the demonstration laptop at localhost:5000.", "Staff portal: Defense Scheduling", inset="calendar-card")
feature([6], "sheet", "Editable Monitoring Sheet", "monitoring", "Monitoring Sheet, current build",
        ["Records for a program and year are presented in one grid.", "Authorized staff may add or correct an entry; each change is recorded."],
        "Feature 6, the Monitoring Sheet. Records for a program and year are presented in one grid. Authorized staff may add or correct an entry, and each change is recorded.", "Staff portal: Monitoring Sheet")
feature([7], "chart", "Group views and reports", "reports", "Reports and Analytics, students by year started",
        ["Reports present students by the year they were admitted.", "Each figure is linked to its list of students."],
        "Feature 7, group views and reports. Students are presented by the year they were admitted, and each figure is linked to its list of students.", "Staff portal: Reports and Analytics")

# --- feature 8: the Operations Manual
d.light("manual", "FEATURE 8 OF 8 · OPERATIONS MANUAL", "Operations Manual, validated and signed", tw=8.25)
tracker([8])
d.image(DOC("manual-001.jpg"), 0.6, 1.7, h=4.2, border=True, shadow=False, alt="Cover of the approved Graduate School Operations Manual")
d.image(A + "/docs/manual-signoff.png", 3.87, 1.7, h=4.2, border=True, shadow=False, alt="Sign-off table of the Operations Manual with names, dates and signatures")
d.card(0.6, 6.1, 12.13, 0.58, fill=MINT, line=None, name="Key message")
tw = d.tag(0.84, 6.26, "PANEL REVISION")
d.text(0.84 + tw + 0.2, 6.1, 12.5 - (0.84 + tw + 0.2), ["The Graduate School had no operations manual. The group prepared one; the Graduate School validated and signed it."], size=12, bold=True, color=INK, h=0.58, anchor="m")
d.notes("Feature 8, the Operations Manual. The Graduate School did not have an operations manual. Following the panel's suggestion, the group prepared one, and the Graduate School validated and signed it.")

# ================================================================ 10 UAT procedure
d.light("filecheck", "USER ACCEPTANCE TESTING", "User acceptance testing procedure")
steps = [("4 November", "user", "Evaluation with the former Associate Dean"),
         ("By 9 November", "refine", "Requested enhancements implemented"),
         ("9 to 14 November", "panel", "Evaluation with the Dean and Graduate School personnel"),
         ("17 November", "badge", "Signed acceptance received")]
g = 0.42
cw, ch = (12.13 - 3 * g) / 4, 2.2
for i, (date, ic, ttl) in enumerate(steps):
    x = 0.6 + i * (cw + g)
    last = i == len(steps) - 1
    d.card(x, 1.7, cw, ch, fill=DARK if last else LIGHT, line=None if last else LINE, name="Step %d" % (i + 1))
    d.tile(x + 0.24, 1.92, 0.52, ic, fill=EMERALD if last else DARK, color="dark" if last else "white")
    d.text(x + 0.24, 2.6, cw - 0.48, [date.upper()], size=10.5, bold=True, color=ON_DARK_SOFT if last else GREEN, h=0.24)
    d.text(x + 0.24, 2.88, cw - 0.48, [ttl], size=14.5, bold=True, color=ON_DARK if last else INK, h=0.9, line=1.05)
    if not last:
        d.icon(x + cw + 0.08, 2.67, 0.26, "arrow", "green")
d.card(0.6, 4.12, 5.2, 2.56, fill=WHITE, name="Procedure")
d.text(0.88, 4.32, 4.7, ["PROCEDURE FOLLOWED IN EACH EVALUATION"], size=10, bold=True, color=GREEN, h=0.24)
for i, (ic, t) in enumerate([("present", "System demonstration"), ("click", "Hands-on testing by the evaluator"), ("sign", "Signed UAT form")]):
    y = 4.68 + i * 0.5
    d.tile(0.88, y, 0.4, ic, fill=MINT, color="green", radius=0.07)
    d.text(1.44, y, 4.1, [t], size=13.5, bold=True, color=INK, h=0.4, anchor="m")
d.text(0.88, 6.2, 4.7, ["Sessions with the Dean and personnel were held through Google Meet, with several sessions for each evaluator."], size=10.5, color=MUTED, h=0.4, line=1.05)
d.card(6.02, 4.12, 6.71, 2.56, fill=WHITE, name="Site traffic")
d.text(6.3, 4.32, 6.2, ["SITE TRAFFIC RECORDED BY CLOUDFLARE, 30 DAYS TO 19 NOVEMBER 2026"], size=10, bold=True, color=GREEN, h=0.24)
d.image(SHOT("traffic"), 6.3, 4.68, w=6.15, border=True, shadow=False, alt="Cloudflare analytics charts of page views and visits over time for the deployed site")
d.notes("User acceptance testing was conducted with two sets of evaluators.\n\n"
        "On 4 November we met with the former Associate Dean. The requested enhancements were implemented by 9 November; none of them altered a process workflow.\n\n"
        "From 9 to 14 November we held demonstration and training sessions with the Dean and the Graduate School personnel through Google Meet, with several sessions for each evaluator, after which they tested the system themselves. The signed documents were received on 17 November.\n\n"
        "For the presenter: the chart is the traffic that Cloudflare recorded for the deployed site over the 30 days to 19 November. It counts every request that reached the site, so describe it only as site traffic.\n\n"
        "If the panel notes that the paper mentions one respondent: the paper was submitted on 9 November. The evaluation with the Dean and the Graduate School personnel was completed after that date.")

# ================================================================ 11 UAT evaluators
d.light("panel", "USER ACCEPTANCE TESTING", "System evaluators")
PH = 4.14
# --- former Associate Dean (individual)
d.card(0.6, 1.7, 4.3, PH, name="Former Associate Dean")
d.text(0.9, 1.96, 3.7, ["UAT WITH THE FORMER ASSOCIATE DEAN"], size=10.5, bold=True, color=GREEN, h=0.24)
d.text(0.9, 2.3, 3.7, ["Individual evaluation"], size=20, bold=True, color=INK, h=0.42)
d.hline(0.9, 2.98, 4.6, color=LINE)
d.tile(0.9, 3.22, 0.66, "user")
d.text(1.74, 3.2, 2.95, ["Eddie de Paula, Jr."], size=16, bold=True, color=INK, h=0.34)
d.text(1.74, 3.56, 2.95, ["Former Associate Dean, Graduate School"], size=12, color=TEXT, h=0.5, line=1.05)
d.icon(0.9, 5.2, 0.26, "sign", "green")
d.text(1.3, 5.16, 3.3, ["UAT form signed on 6 November 2026"], size=12, color=TEXT, h=0.5, line=1.05)
# --- Dean with personnel (combined)
d.box(5.15, 1.7, 7.58, PH, fill=DARK, radius=0.1, name="Dean and personnel")
d.text(5.47, 1.96, 6.9, ["UAT WITH THE DEAN AND THE GRADUATE SCHOOL PERSONNEL"], size=10.5, bold=True, color=ON_DARK_SOFT, h=0.24)
d.text(5.47, 2.3, 6.9, ["One combined evaluation"], size=20, bold=True, color=ON_DARK, h=0.42)
d.hline(5.47, 2.98, 12.41, color=RULE)
d.tile(5.47, 3.2, 0.62, "usercheck", fill=EMERALD, color="dark")
d.text(6.27, 3.17, 5.9, ["Eric Arthur N. Dio, PhD"], size=16, bold=True, color=ON_DARK, h=0.34)
d.text(6.27, 3.52, 5.9, ["Dean, Graduate School"], size=12, color=ON_DARK_SOFT, h=0.26)
people = [("Jiema Calinsag", "Graduate School Staff"), ("Maribeth Pillo, PhD", "Academic Coordinator"),
          ("Ena Apelo, RPsy, RPM", "Research Coordinator"), ("Erika Nicolas, PhD", "Faculty")]
for i, (n, r) in enumerate(people):
    rr, cc = divmod(i, 2)
    x, y = 5.47 + cc * 3.5, 4.02 + rr * 0.58
    d.tile(x, y, 0.46, "user", fill="13573F", color="white", radius=0.08)
    d.text(x + 0.62, y - 0.02, 2.8, [n], size=13, bold=True, color=ON_DARK, h=0.26)
    d.text(x + 0.62, y + 0.24, 2.8, [r], size=10.5, color=ON_DARK_SOFT, h=0.22)
d.icon(5.47, 5.3, 0.26, "sign", "white")
d.text(5.87, 5.29, 6.5, ["One UAT form for all five evaluators, signed by the Dean on 17 November 2026"], size=12, color=ON_DARK, h=0.28)
d.card(0.6, 6.04, 12.13, 0.64, fill=MINT, line=None, name="Key message")
d.text(0.6, 6.04, 12.13, ["Both evaluations used the same UAT form and followed the same procedure."], size=13.5, bold=True, color=INK, align="c", h=0.64, anchor="m")
d.notes("The system was evaluated by the former Associate Dean, Sir Eddie de Paula, Jr., on an individual UAT form.\n\n"
        "It was then evaluated by the Dean, Dr. Eric Arthur N. Dio, together with the Graduate School personnel: Jiema Calinsag of the Graduate School staff; Dr. Maribeth Pillo, the Academic Coordinator; Ena Apelo, the Research Coordinator; and Dr. Erika Nicolas of the faculty. "
        "This was one combined evaluation, recorded on one UAT form that the Dean signed.")

# ================================================================ 12 UAT results
d.light("badge", "USER ACCEPTANCE TESTING", "User acceptance testing results")


def result_card(x, dark, label, verdict, vfill, vcol, items):
    c_main, c_soft = (ON_DARK, ON_DARK_SOFT) if dark else (INK, GREEN)
    if dark:
        d.box(x, 1.7, 5.955, 3.75, fill=DARK, radius=0.1, name=label)
    else:
        d.card(x, 1.7, 5.955, 3.75, name=label)
    d.text(x + 0.32, 1.96, 5.3, [label], size=10.5, bold=True, color=c_soft, h=0.24)
    d.box(x + 0.32, 2.34, 5.3, 0.72, fill=vfill, radius=0.08, name="Decision")
    d.text(x + 0.32, 2.34, 5.3, [verdict], size=19, bold=True, color=vcol, align="c", h=0.72, anchor="m")
    points(x + 0.32, 3.38, 5.3, items, size=13.5, step=0.6, color=c_main, icon_color="white" if dark else "green")


result_card(0.6, False, "FORMER ASSOCIATE DEAN", "Accepted with minor revisions", GOLD_BG, GOLD_INK,
            ["All functional items were confirmed.", "No process discrepancies were identified.", "Five enhancements to existing views were requested."])
result_card(6.775, True, "DEAN AND GRADUATE SCHOOL PERSONNEL", "Accepted", EMERALD, DARK,
            ["All functional items were confirmed.", "No process discrepancies were identified.", "No further revisions were required."])
d.card(0.6, 5.68, 12.13, 1.0, fill=MINT, line=None, name="Quotation")
d.text(0.95, 5.8, 11.43, ["“The group has already implemented all the revisions… so we have no further comments or revisions.”"], size=13.5, bold=True, italic=True, color=INK, h=0.3)
d.text(0.95, 6.2, 11.43, ["The Dean, on the UAT form"], size=11.5, color=MUTED, h=0.26)
d.notes("The former Associate Dean accepted the system with minor revisions. No defects were reported; the revisions were five enhancements to existing views. After they were implemented, the Dean and the Graduate School personnel accepted the system, with no further revisions required.\n\n"
        "If the panel asks for the detailed scores, they are on the signed forms in the appendix.")

# ================================================================ 13 enhancements requested (no defects)
d.light("revise", "USER ACCEPTANCE TESTING", "Enhancements requested during user acceptance testing", size=26)
d.box(0.6, 1.7, 4.5, 4.98, fill=DARK, radius=0.1, name="No defects")
d.tile(0.92, 2.0, 0.64, "shield", fill=EMERALD, color="dark")
d.text(0.92, 2.86, 3.9, ["No defects were reported"], size=21, bold=True, color=ON_DARK, h=0.42)
d.hline(0.92, 3.5, 4.78, color=RULE)
points(0.92, 3.72, 3.9, ["All functional items confirmed", "No process discrepancies identified", "Requests were for additional views"], size=13, step=0.5, color=ON_DARK, icon_color="white")
d.box(0.92, 5.56, 3.86, 0.82, fill=EMERALD, radius=0.08, name="Key message")
d.text(1.04, 5.56, 3.62, ["All five were implemented. None altered a process workflow."], size=12.5, bold=True, color=DARK, align="c", h=0.82, anchor="m", line=1.06)
d.text(5.35, 1.72, 7.38, ["FIVE ENHANCEMENTS REQUESTED BY THE FORMER ASSOCIATE DEAN, ALL IMPLEMENTED"], size=10, bold=True, color=GREEN, h=0.24)
enh = [("sheet", "Monitoring Sheet by program and year admitted", "Requested: a group view of students and their subjects"),
       ("leave", "Leave history on the student record", "Requested: a review of previous leaves of absence"),
       ("research", "Research Gate board and table", "Requested: a group view of research milestones"),
       ("panel", "Staff may record panelist actions", "Requested: staff action when a panelist does not use the system"),
       ("chart", "Reports by year started", "Requested: students by year admitted in one interface")]
rh = 0.82
for i, (ic, ttl, req) in enumerate(enh):
    y = 2.08 + i * (rh + 0.1)
    d.card(5.35, y, 7.38, rh, name="Enhancement %d" % (i + 1))
    d.tile(5.53, y + 0.16, 0.5, ic, radius=0.08)
    d.text(6.22, y + 0.13, 5.8, [ttl], size=14, bold=True, color=INK, h=0.28)
    d.text(6.22, y + 0.45, 5.8, [req], size=11.5, color=MUTED, h=0.26)
    d.icon(12.2, y + 0.27, 0.28, "check", "green")
d.notes("To be clear, user acceptance testing did not report any defect. All functional items were confirmed and no process discrepancy was identified.\n\n"
        "The former Associate Dean requested five enhancements, all of them additional views of records the system already held. All five were implemented before the evaluation with the Dean and the Graduate School personnel, and none of them altered a process workflow.")

# ================================================================ 14 written acceptance
d.light("sign", "USER ACCEPTANCE TESTING", "Written acceptance from the Graduate School")
CROP = (0.0, 0.17, 0.0, 0.07)
d.tag(0.6, 1.72, "ACCEPTANCE LETTER FROM THE DEAN", fill=DARK, color=WHITE)
d.image(DOC("letter-001.jpg"), 0.6, 2.12, h=4.5, border=True, shadow=False, alt="Acceptance letter signed by the Dean of the Graduate School, 17 November 2026")
d.tag(3.75, 1.72, "UAT FORM: DEAN AND GRADUATE SCHOOL PERSONNEL", fill=MINT, color=GREEN)
d.image(DOC("r2hi-012.jpg"), 3.75, 2.12, w=4.2, border=True, shadow=False, crop=CROP, alt="UAT form of the Dean and Graduate School personnel, signed acceptance page")
d.tag(8.53, 1.72, "UAT FORM: FORMER ASSOCIATE DEAN")
d.image(DOC("r1hi-012.jpg"), 8.53, 2.12, w=4.2, border=True, shadow=False, crop=CROP, alt="UAT form of the former Associate Dean, signed acceptance page")
d.text(3.75, 6.3, 8.98, ["“…presented, demonstrated, tested, reviewed, and accepted…”"], size=12.5, bold=True, color=INK, h=0.28)
d.text(3.75, 6.58, 8.98, ["Acceptance letter from the Dean, 17 November 2026"], size=10.5, color=MUTED, h=0.24)
d.notes("The acceptance is documented in writing: the acceptance letter from the Dean and the two signed UAT forms. Every page is in the appendix.")

# ================================================================ 16 conclusions
d.light("target", "CONCLUSIONS", "Conclusions by objective")
d.box(0.6, 1.7, 12.13, 0.46, fill=DARK, radius=0.06, name="Table header")
d.text(1.5, 1.7, 4.6, ["OBJECTIVE"], size=10.5, bold=True, color=ON_DARK, h=0.46, anchor="m")
d.text(6.3, 1.7, 6.2, ["OUTCOME"], size=10.5, bold=True, color=ON_DARK, h=0.46, anchor="m")
concl = [("search", "Analyze the operations of the Graduate School", "Processes and rules were documented in an Operations Manual signed by the Graduate School."),
         ("compass", "Identify an appropriate solution", "A monitoring platform that complements AIMS and the Office of the Registrar."),
         ("layers", "Develop the system modules", "All twelve lifecycle processes were implemented, each with a record of actions taken."),
         ("chart", "Provide analytics for monitoring", "Reports allow students to be monitored by group."),
         ("usercheck", "Evaluate the system with its intended users", "The system was accepted by the Graduate School through user acceptance testing.")]
rh = 0.66
for i, (ic, obj, out) in enumerate(concl):
    y = 2.24 + i * (rh + 0.07)
    d.card(0.6, y, 12.13, rh, fill=LIGHT if i % 2 == 0 else WHITE, name="Objective %d" % (i + 1))
    d.tile(0.78, y + 0.1, 0.46, ic, radius=0.08)
    d.text(1.5, y, 4.55, [obj], size=13.5, bold=True, color=INK, h=rh, anchor="m", line=1.05)
    d.text(6.3, y, 6.2, [out], size=12.5, color=TEXT, h=rh, anchor="m", line=1.05)
d.box(0.6, 5.94, 12.13, 0.76, fill=DARK, radius=0.08, name="Conclusion")
d.text(0.95, 5.94, 11.43, ["The platform provides the Graduate School with a consolidated, policy-based view of each student's status."], size=15, bold=True, color=ON_DARK, h=0.76, anchor="m", line=1.05)
d.notes("Our conclusions follow the five objectives of the study. In summary, the platform provides the Graduate School with a consolidated, policy-based view of each student's status.\n\n"
        "If asked: the paper, submitted on 9 November, records the fifth objective as achieved in part, because one evaluator had taken part by then. The evaluation with the Dean and the Graduate School personnel followed. For the fourth objective, the KPI computations and the risk indicators remain as recommendations.")

# ================================================================ 17 recommendations
d.light("compass", "RECOMMENDATIONS", "Recommendations")
recs = [("usercheck", "Extend user acceptance testing to graduate students."),
        ("rules", "Finalize the remaining policy values and risk indicators with the Graduate School."),
        ("chart", "Measure the key performance indicators defined in the study."),
        ("shield", "Conduct a pilot using actual records, in compliance with the Data Privacy Act."),
        ("manual", "Prepare a user guide for each role."),
        ("filecheck", "Add a confirmation step for the Office of the Registrar on approved changes.")]
cw, ch, g = (12.13 - 0.25) / 2, 1.12, 0.18
for i, (ic, t) in enumerate(recs):
    r, c = divmod(i, 2)
    x, y = 0.6 + c * (cw + 0.25), 1.7 + r * (ch + g)
    d.card(x, y, cw, ch, name="Recommendation %d" % (i + 1))
    d.tile(x + 0.26, y + 0.28, 0.56, ic)
    d.text(x + 1.06, y, cw - 1.3, [t], size=14.5, bold=True, color=INK, h=ch, anchor="m", line=1.06)
d.card(0.6, 5.72, 12.13, 0.96, fill=MINT, line=None, name="Future study")
d.text(0.95, 5.86, 11.43, ["FOR FUTURE STUDY"], size=10.5, bold=True, color=GREEN, h=0.24)
d.text(0.95, 6.14, 11.43, ["Early identification of students at risk of delay, using the records the platform accumulates."], size=14.5, bold=True, color=INK, h=0.34)
d.notes("These are our recommendations, as stated in Chapter 7 of the paper. For future study, we recommend the early identification of students at risk of delay, using the records the platform accumulates.")

# ================================================================ 18 closing
d.dark("Thank you")
d.text(0.9, 2.2, 11, ["Thank you"], size=66, bold=True, color=ON_DARK, h=1.2, name="Title")
d.text(0.9, 3.55, 11, ["We welcome the questions of the panel."], size=22, color=ON_DARK_SOFT, h=0.45)
d.hline(0.9, 4.75, 3.4, color=EMERALD, width=2.5)
d.text(0.9, 4.98, 11, ["CAP-2521-IT | Mendoza, Oseña, Sanson, and Tumbaga"], size=16, bold=True, color=ON_DARK, h=0.34)
d.text(0.9, 5.4, 11, ["Capstone 2 · IT Development Defense (20%) · November 2026"], size=13, color=ON_DARK_SOFT, h=0.28)
d.notes("Thank you. We welcome your questions.")

# ================================================================ appendix
d.dark("Appendix")
d.text(0.9, 0.9, 11, ["APPENDIX"], size=13, bold=True, color=ON_DARK_SOFT, h=0.28)
d.text(0.9, 1.5, 11.5, ["Supporting documents"], size=44, bold=True, color=ON_DARK, h=0.85, name="Title")
for i, (k, t) in enumerate([("A", "Signed documents, page by page"), ("B", "Capstone 1 panel revisions"), ("C", "System screens")]):
    y = 3.1 + i * 0.82
    d.num(0.9, y, k, d=0.5, fill=EMERALD, color=DARK, size=17)
    d.text(1.65, y, 9, [t], size=20, color=ON_DARK, h=0.5, anchor="m")


def doc_grid(title, files, first_page):
    d.light("filecheck", "APPENDIX A · SIGNED DOCUMENTS", title, size=22)
    gap = 0.3
    pw = (12.13 - gap * 2) / 3
    for i, f in enumerate(files):
        x = 0.6 + i * (pw + gap)
        w, h = d.image(f, x, 1.6, w=pw, border=True, shadow=False, alt="%s, page %d" % (title, first_page + i))
        d.text(x, 1.6 + h + 0.06, pw, ["Page %d" % (first_page + i)], size=10, color=MUTED, align="c", h=0.2, check=False)


for k in range(4):
    doc_grid("UAT form, former Associate Dean (pages %d to %d)" % (k * 3 + 1, k * 3 + 3), [DOC("r1-%03d.jpg" % p) for p in range(k * 3 + 1, k * 3 + 4)], k * 3 + 1)
for k in range(4):
    doc_grid("UAT form, Dean and personnel (pages %d to %d)" % (k * 3 + 1, k * 3 + 3), [DOC("r2-%03d.jpg" % p) for p in range(k * 3 + 1, k * 3 + 4)], k * 3 + 1)

d.light("filecheck", "APPENDIX A · SIGNED DOCUMENTS", "Acceptance letter and Operations Manual", size=22)
x = 0.6
for f, cap in [(DOC("letter-001.jpg"), "Acceptance letter"), (DOC("manual-001.jpg"), "Operations Manual, cover"),
               (DOC("manual-003.jpg"), "Operations Manual, contents"), (DOC("manual-109.jpg"), "Operations Manual, sign-off page")]:
    w, h = d.image(f, x, 1.72, h=4.2, border=True, shadow=False, alt=cap)
    d.text(x, 6.0, w, [cap], size=10, color=MUTED, align="c", h=0.2, check=False)
    x += w + 0.215

# ---- B: panel revisions
d.light("revise", "APPENDIX B · CAPSTONE 1 PANEL REVISIONS", "Panel revisions and the action taken", size=22)
d.box(0.6, 1.7, 12.13, 0.46, fill=DARK, radius=0.06, name="Table header")
d.text(1.4, 1.7, 5.0, ["REVISION REQUIRED BY THE PANEL"], size=10.5, bold=True, color=ON_DARK, h=0.46, anchor="m")
d.text(7.0, 1.7, 5.5, ["ACTION TAKEN"], size=10.5, bold=True, color=ON_DARK, h=0.46, anchor="m")
asks = [("Add a feature to upload additional documents and policies", "Policy Documents library"),
        ("Integrate policies into the student lifecycle", "Business rules applied in every workflow"),
        ("Consider business rules, such as when a student may drop", "Adding, dropping, and withdrawal follow the Handbook"),
        ("Matching should give different results for different records", "Each paper is scored on its own content"),
        ("Include the policies of the operations manual", "Operations Manual prepared, validated, and signed"),
        ("Demonstrate the policy chat and the sign-in", "Both are included in the demonstration")]
rh = 0.66
for i, (ask, did) in enumerate(asks):
    y = 2.24 + i * (rh + 0.07)
    d.card(0.6, y, 12.13, rh, fill=LIGHT if i % 2 == 0 else WHITE, name="Revision %d" % (i + 1))
    d.num(0.8, y + 0.15, i + 1, d=0.36)
    d.text(1.4, y, 5.0, [ask], size=12.5, color=INK, h=rh, anchor="m", line=1.05)
    d.icon(6.5, y + 0.21, 0.24, "arrow", "green")
    d.text(7.0, y, 5.5, [did], size=12.5, bold=True, color=INK, h=rh, anchor="m", line=1.05)

# ---- C: system screens (Policy Documents left out: that page still labels the manual a draft)
screens = [(f, c.replace(" · ", " ").replace("&", "and")) for f, c in json.load(open(A + "/screens.json")) if c != "Policy Documents"]
per = 6
for k in range(0, len(screens), per):
    chunk = screens[k:k + per]
    d.light("layers", "APPENDIX C · SYSTEM SCREENS", "System screens", size=22)
    iw = 3.7
    for i, (f, cap) in enumerate(chunk):
        r, c = divmod(i, 3)
        x, y = 0.6 + c * (iw + 0.515), 1.62 + r * 2.68
        w, h = d.image(f, x, y, w=iw, border=True, shadow=False, alt=cap + " screen")
        d.text(x, y + h + 0.06, iw, [cap], size=10.5, bold=True, color=INK, align="c", h=0.22, check=False)

d.save(OUT)
print("slides:", len(d.prs.slides), "screens:", len(screens))
for wmsg in WARN:
    print("WARN", wmsg)
