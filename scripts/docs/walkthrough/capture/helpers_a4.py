"""Helpers for agent A4 cases (13 research title, 14 panel matching, 18 proposal/final).

Builds small valid PDFs with PyMuPDF (a Form 1 and concept papers) so the capture
can upload real files, and offers a few UI helpers that locate things by text.
"""
from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

import fitz  # PyMuPDF

from .common import BASE, PASSWORD, click_text, main_text  # noqa: F401

UPLOADS = Path("E:/Temp/claude/walkthrough/uploads")

MIGUEL_TITLE = "Learning Analytics Feedback Dashboards and the Engagement of Working Graduate Students in Blended Courses"

CONCEPT_PAPERS = [
    {
        "file": "Yu_Miguel_ConceptPaper1_Dashboard_Feedback_Engagement.pdf",
        "title": "Learning Analytics Feedback Dashboards and the Engagement of Working Graduate Students in Blended Courses",
        "body": {
            "Background and Rationale": (
                "Working graduate students in blended courses leave traces in the learning management system every time they "
                "open a module, submit an activity, or post in a discussion forum. Learning analytics dashboards turn those "
                "interaction traces into feedback that students and instructors can read. Graduate programs at the university "
                "have adopted the learning management system, yet students receive little feedback on how their participation "
                "compares with the expectations of the course. This concept paper proposes to study whether a feedback "
                "dashboard changes how engaged graduate students are in blended courses."
            ),
            "Statement of the Problem": (
                "The study asks how a learning analytics feedback dashboard relates to the engagement and persistence of working "
                "graduate students. It asks what students do with the feedback, and which dashboard features they find useful."
            ),
            "Objectives": (
                "1. Describe the learning management system activity of working graduate students in blended courses. "
                "2. Determine the relationship between dashboard use and student engagement. "
                "3. Explore how students interpret dashboard feedback and how it affects their study habits."
            ),
            "Methodology": (
                "The study uses a sequential explanatory mixed-method research design. Data collection begins with learning "
                "management system activity logs and an engagement questionnaire answered by graduate students enrolled in "
                "blended courses. Regression analysis will test the relationship between dashboard use and engagement. Semi-structured "
                "interviews with selected students will then explain the quantitative results, and interview data will be coded by theme."
            ),
            "Significance and Scope": (
                "The findings can guide the Graduate School in deciding whether to provide dashboards to students and instructors. "
                "The scope is limited to graduate students in one academic year and to courses delivered in a blended format."
            ),
            "References": (
                "Bodily, R., and Verbert, K. (2017). Review of research on student-facing learning analytics dashboards. "
                "Matcha, W., et al. (2020). A systematic review of empirical studies on learning analytics dashboards. "
                "Jivet, I., et al. (2018). License to evaluate: preparing learning analytics dashboards for educational practice."
            ),
        },
    },
    {
        "file": "Yu_Miguel_ConceptPaper2_Predicting_Course_Persistence.pdf",
        "title": "Predicting Course Persistence of Graduate Students from Learning Management System Activity Using Machine Learning",
        "body": {
            "Background and Rationale": (
                "Some graduate students stop attending an online or blended course before the term ends, and the program learns about "
                "it only after grades are filed. Activity logs from the learning management system can be used to train machine "
                "learning classifiers that flag students who are at risk of dropping a course. Educational data mining has shown that "
                "simple features such as login frequency, assignment submission timing, and forum posts carry useful signals."
            ),
            "Statement of the Problem": (
                "The problem is that the Graduate School has no early, data-based signal of which students are likely to stop "
                "participating. The study asks how accurately logistic regression and random forest models can predict course persistence."
            ),
            "Objectives": (
                "1. Build a dataset of learning management system activity features for graduate courses. "
                "2. Compare the accuracy of logistic regression and random forest classifiers in predicting persistence. "
                "3. Identify the activity features that contribute most to the prediction."
            ),
            "Methodology": (
                "This is a quantitative predictive research design. Data collection uses anonymized activity logs and final course "
                "status from past terms. The data will be split into training and test sets, features will be selected, and models will be "
                "compared using accuracy, precision, recall, and cross-validation. The analysis follows the data privacy rules of the university."
            ),
            "Significance and Scope": (
                "An early signal helps instructors and program coordinators reach out to students in time. The scope covers graduate "
                "courses of one college and does not include undergraduate data."
            ),
            "References": (
                "Romero, C., and Ventura, S. (2020). Educational data mining and learning analytics: an updated survey. "
                "Baker, R. (2019). Challenges for the future of educational data mining. "
                "Breiman, L. (2001). Random forests."
            ),
        },
    },
    {
        "file": "Yu_Miguel_ConceptPaper3_Student_Perceptions_Online_Courses.pdf",
        "title": "Motivation and Persistence of Working Adult Learners in Online Graduate Courses: An Interview Study",
        "body": {
            "Background and Rationale": (
                "Working adults who enroll in graduate programs balance coursework with jobs and family duties. Academic motivation, "
                "burnout, and well-being affect whether they finish. Earlier studies of adult learners describe intrinsic motivation "
                "and support from instructors as reasons for persistence, but little is known about the experience of students in "
                "this university's online graduate courses."
            ),
            "Statement of the Problem": (
                "The study asks what motivates working graduate students to persist in online courses, and what makes them consider stopping."
            ),
            "Objectives": (
                "1. Describe the motivations of working graduate students in online courses. "
                "2. Identify the stresses that lead to burnout or to dropping a course. "
                "3. Recommend supports the Graduate School can provide."
            ),
            "Methodology": (
                "The study uses a qualitative case study design. Data collection is through semi-structured interviews with twelve "
                "graduate students. The interview transcripts will be coded by theme using an audit trail so that the procedure can be checked."
            ),
            "Significance and Scope": (
                "The results can help the Graduate School plan advising and support services for working students. The scope is "
                "limited to one college and one academic year."
            ),
            "References": (
                "Deci, E., and Ryan, R. (2000). The what and why of goal pursuits: human needs and self-determination. "
                "Kasworm, C. (2010). Adult workers as undergraduate students: significant challenges for higher education policy and practice. "
                "Schaufeli, W., et al. (2002). Burnout and engagement in university students."
            ),
        },
    },
]


def _write_pdf(path: Path, blocks: list[tuple[str, int, bool]]) -> None:
    import math

    doc = fitz.open()
    page = doc.new_page()
    y = 60.0
    for text, size, bold in blocks:
        font = "hebo" if bold else "helv"
        lines = sum(max(1, math.ceil(len(part) * size * 0.52 / 484)) for part in text.split(chr(10)))
        height = lines * size * 1.3 + 8
        if y + height > 780:
            page = doc.new_page()
            y = 60.0
        page.insert_textbox(fitz.Rect(56, y, 540, y + height), text, fontsize=size, fontname=font)
        y += height + 6
    path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(path))
    doc.close()


def make_form1(student_name: str, student_no: str, program: str, title: str, keywords: str, panel_spec: str,
               file_name: str = "Yu_Miguel_Form1_Application_for_Title_Defense.pdf") -> Path:
    path = UPLOADS / file_name
    objectives = (
        "1. Describe the learning management system activity of working graduate students in blended courses. "
        "2. Determine the relationship between dashboard use and student engagement. "
        "3. Explore how students use the feedback that the dashboard gives them."
    )
    blocks = [
        ("UNIVERSITY OF ST. LA SALLE - GRADUATE SCHOOL", 12, True),
        ("FORM 1: APPLICATION FOR TITLE DEFENSE", 14, True),
        (f"Student: {student_name}\nStudent Number: {student_no}\nProgram: {program}", 11, False),
        (f"Research Title: {title}", 11, False),
        (f"Objectives: {objectives}", 11, False),
        (f"Research Keywords: {keywords}", 11, False),
        (f"Proposed Panel Specialization: {panel_spec}", 11, False),
        ("Prepared by: " + student_name, 11, False),
    ]
    _write_pdf(path, blocks)
    return path


def make_concept_paper(spec: dict) -> Path:
    path = UPLOADS / spec["file"]
    blocks = [("CONCEPT PAPER", 10, True), (f"Title: {spec['title']}", 13, True), ("Student: Miguel Yu, Master of Arts in Education", 10, False)]
    for heading, text in spec["body"].items():
        blocks.append((heading, 11, True))
        blocks.append((text, 10, False))
    path = UPLOADS / spec["file"]
    _write_pdf(path, blocks)
    return path


def make_generic_pdf(file_name: str, title: str, lines: list[str]) -> Path:
    path = UPLOADS / file_name
    blocks = [(title, 14, True)] + [(line, 11, False) for line in lines]
    _write_pdf(path, blocks)
    return path


def make_miguel_title_package() -> tuple[Path, list[Path]]:
    form1 = make_form1(
        "Miguel Yu", "2260004", "Master of Arts in Education (MAED)", MIGUEL_TITLE,
        "learning analytics, student engagement, online learning, blended learning, graduate education",
        "learning analytics, education technology, online learning",
    )
    papers = [make_concept_paper(spec) for spec in CONCEPT_PAPERS]
    return form1, papers


def api_login(email: str, password: str = PASSWORD):
    """Return a cookie-aware opener logged in through the JSON API (for reading data only)."""
    import http.cookiejar

    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    req = urllib.request.Request(f"{BASE}/api/auth/login", data=json.dumps({"email": email, "password": password}).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    opener.open(req, timeout=60).read()
    return opener


def api_get(opener, path: str):
    return json.loads(opener.open(f"{BASE}{path}", timeout=60).read().decode())


def pick_student(page, query: str, result_text: str | None = None) -> None:
    """In a workflow page, clear any selected student, search, and click the matching result."""
    import re as _re

    from .common import Runtime

    clear = page.get_by_role("button", name="Clear selected student")
    if clear.count():
        clear.first.click()
        page.wait_for_timeout(400)
    box = page.get_by_placeholder(_re.compile("Search all students"))
    box.click()
    box.fill(query)
    page.wait_for_timeout(1500)
    page.get_by_text(result_text or query).first.click()
    Runtime.settle(page)


def scroll_to(page, locator, offset: int = 90) -> None:
    """Scroll so the element sits near the top of the viewport (for readable viewport shots)."""
    locator.first.evaluate("(el, off) => { const r = el.getBoundingClientRect(); "
                           "let p = el.parentElement; while (p && !(p.scrollHeight > p.clientHeight + 5 && /(auto|scroll)/.test(getComputedStyle(p).overflowY))) p = p.parentElement; "
                           "(p || document.scrollingElement).scrollBy(0, r.top - off); }", offset)
    page.wait_for_timeout(350)


def draw_signature(page, canvas=None) -> None:
    """Draw a simple signature stroke with the mouse on the first canvas of the page."""
    import math

    canvas = canvas or page.locator("canvas").first
    canvas.scroll_into_view_if_needed()
    box = canvas.bounding_box()
    x0, y0, w, h = box["x"], box["y"], box["width"], box["height"]
    page.mouse.move(x0 + 0.1 * w, y0 + 0.6 * h)
    page.mouse.down()
    steps = 60
    for i in range(steps + 1):
        page.mouse.move(x0 + 0.1 * w + i * (0.8 * w / steps), y0 + 0.5 * h + math.sin(i / 4) * 0.22 * h)
    page.mouse.up()
    page.wait_for_timeout(400)


def upload_title_package(rt, page) -> None:
    """Student portal > Research: upload Form 1 and three concept papers, then submit."""
    import re as _re

    form1, papers = make_miguel_title_package()
    rt.go(page, "/student/research")
    page.locator("input[type=file]").nth(0).set_input_files(str(form1))
    rt.settle(page)
    for paper in papers:
        page.locator("input[type=file]").nth(1).set_input_files(str(paper))
        rt.settle(page)
    page.get_by_role("button", name=_re.compile("Submit Title Defense")).click()
    rt.settle(page)


def staff_verify(rt, page, query: str = "2260004", result: str = "Miguel Yu", gate_path: str = "/workflow/research-gate") -> None:
    import re as _re

    rt.go(page, gate_path)
    pick_student(page, query, result)
    page.get_by_role("button", name="Verify submitted requirements").click()
    rt.settle(page)


def coordinator_endorse(rt, page, query_text: str = "2260004") -> None:
    """Academic Coordinator: Research Gate > select student > Form 1 endorsements > sign > endorse."""
    import re as _re

    rt.go(page, "/workflow/research-gate")
    pick_student(page, query_text, "Miguel Yu")
    page.get_by_role("button", name=_re.compile("Miguel Yu.*Waiting", _re.S)).first.click()
    page.wait_for_timeout(500)
    draw_signature(page)
    page.get_by_role("button", name=_re.compile("Finalize signature")).click()
    page.wait_for_timeout(400)
    page.get_by_role("button", name=_re.compile("Endorse and sign")).click()
    rt.settle(page)


def finalize_suggested_panel(rt, page, number: str = "2260004", name: str = "Miguel Yu", route: str = "/workflow/panel-matching", seats: dict | None = None) -> None:
    """Panel Matching: keep the suggested panel (or change named seats, e.g. {"Method Specialist": "Daniel Uy"}) and finalize it."""
    import re as _re

    rt.go(page, route)
    pick_student(page, number, name)
    page.wait_for_timeout(1500)
    for role, who in (seats or {}).items():
        seat = page.locator("label", has_text=role).locator("select")
        value = seat.locator("option", has_text=who).get_attribute("value")
        seat.select_option(value=value)
    page.get_by_role("button", name=_re.compile("Finalize selected panel|Update final panel")).click()
    rt.settle(page)


def accept_pending_invitations(rt, emails: list[str]) -> None:
    import re as _re

    for email in emails:
        fac = rt.new_page(email)
        try:
            fac.get_by_role("link", name="Panel Invitations").click()
            rt.settle(fac)
            try:
                fac.get_by_text("Loading your invitations").wait_for(state="detached", timeout=8000)
            except Exception:  # noqa: BLE001
                pass
            fac.wait_for_timeout(500)
            accept = fac.get_by_role("button", name="Accept", exact=True)
            while accept.count():
                accept.first.click()
                rt.settle(fac)
                fac.wait_for_timeout(500)
        finally:
            fac.context.close()


def faculty_email(name: str) -> str:
    """'Dr. Marlon Geronimo' -> marlon.geronimo@usls.edu.ph (the demo naming pattern)."""
    parts = name.replace("Dr.", "").split()
    return f"{parts[0].lower()}.{parts[-1].lower()}@usls.edu.ph"


def prepare_miguel_to_panel(rt, seats: dict | None = None, accepters: tuple = ("Dr. Marlon Geronimo", "Dr. Celeste Tan", "Dr. Patricia Salvador", "Dr. Teodoro Ramos")) -> None:
    """Reset Miguel and run the case 13/14 steps without screenshots: package, verify, endorse, panel, invitations."""
    rt.reset("research-miguel")
    stu = rt.new_page("student@usls.edu.ph")
    upload_title_package(rt, stu)
    stu.context.close()
    st = rt.new_page("staff@usls.edu.ph")
    staff_verify(rt, st)
    ac = rt.new_page("academic@usls.edu.ph")
    coordinator_endorse(rt, ac)
    ac.context.close()
    finalize_suggested_panel(rt, st, seats=seats)
    st.context.close()
    accept_pending_invitations(rt, [faculty_email(n) for n in accepters])


def scroll_parent_bottom(page, locator) -> None:
    """Scroll the nearest scrollable ancestor (for example the faculty profile dialog) to its end."""
    locator.first.evaluate("(el) => { let p = el.parentElement; while (p && !(p.scrollHeight > p.clientHeight + 5 && /(auto|scroll)/.test(getComputedStyle(p).overflowY))) p = p.parentElement; "
                           "if (p) p.scrollTop = p.scrollHeight; }")
    page.wait_for_timeout(350)


def change_panel_in_scheduling(rt, page, seats: dict, reason: str, number: str = "2260004", name: str = "Miguel Yu") -> None:
    """Defense Scheduling > Change panel: reassign named seats from the full faculty list with a recorded reason."""
    import re as _re

    rt.go(page, "/workflow/defense-scheduling")
    pick_student(page, number, name)
    page.wait_for_timeout(2500)
    page.get_by_role("button", name="Change panel").click()
    page.wait_for_timeout(500)
    for role, who in seats.items():
        sel = page.locator("label", has=page.get_by_text(role, exact=True)).locator("select").first
        value = sel.locator("option", has_text=who).first.get_attribute("value")
        sel.select_option(value=value)
    page.get_by_placeholder(_re.compile("external panelist withdrew")).fill(reason)
    page.get_by_role("button", name="Update panel").click()
    rt.settle(page)
    page.wait_for_timeout(1500)
