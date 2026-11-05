"""Case 13 - Research title: Form 1 and concept papers, Research Gate verification, Form 1 endorsement, adviser.

Miguel Yu (demo key research-miguel, student@usls.edu.ph), stage Title Defense.
Stops where the panel is chosen (Panel Matching is the next case).
"""
from __future__ import annotations

import re

from . import helpers_a4 as h
from .common import click_text, main_text

SLUG = "research_title"


def shot(rt, page, shot_id: str, **kw):
    """rt.shot with a retry: Windows now and then refuses a write to a png ([Errno 22]); a second try works."""
    for attempt in range(4):
        try:
            return rt.shot(page, shot_id, **kw)
        except OSError:
            page.wait_for_timeout(1500)
    return rt.shot(page, shot_id, **kw)


def sid(n: int) -> str:
    return f"{SLUG}-{n:02d}"


def run(rt):
    rt.reset("research-miguel")
    h.make_miguel_title_package()

    # ---------------- Part A: the student submits the title package ----------------
    stu = rt.new_page("student@usls.edu.ph")
    rt.step("student: open Research", lambda: (rt.go(stu, "/student/research"), shot(rt, stu, sid(1))))

    def show_rules():
        stu.get_by_text("Rules applied on this screen").first.click()
        stu.wait_for_timeout(600)
        h.scroll_to(stu, stu.get_by_text("Rules applied on this screen"), 70)
        shot(rt, stu, sid(2))
        h.scroll_to(stu, stu.get_by_text("Similarity index of at most 15%"), 120)
        shot(rt, stu, sid(3))
        stu.get_by_text("Rules applied on this screen").first.click()  # collapse again
        stu.wait_for_timeout(400)

    rt.step("student: read the rules shown on the screen", show_rules)

    form1, papers = h.make_miguel_title_package()

    def upload_form1():
        stu.locator("input[type=file]").nth(0).set_input_files(str(form1))
        rt.settle(stu)
        h.scroll_to(stu, stu.get_by_text("Research title from uploaded Form 1"), 100)
        shot(rt, stu, sid(4))

    rt.step("student: upload Form 1", upload_form1)

    def upload_papers():
        for paper in papers:
            stu.locator("input[type=file]").nth(1).set_input_files(str(paper))
            rt.settle(stu)
        h.scroll_to(stu, stu.get_by_text("Upload each of the three concept papers"), 110)
        shot(rt, stu, sid(5))
        # open the first compliance summary to show the checks
        stu.locator("details summary").first.click()
        stu.wait_for_timeout(500)
        h.scroll_to(stu, stu.locator("details").first, 140)
        shot(rt, stu, sid(6))

    rt.step("student: upload three concept papers and read compliance check", upload_papers)

    def submit():
        stu.get_by_role("button", name=re.compile("Submit Title Defense")).click()
        stu.get_by_role("button", name="Send request").wait_for()
        shot(rt, stu, sid(7))  # the "Send this request?" dialog
        stu.get_by_role("button", name="Send request").click()
        rt.settle(stu)
        h.scroll_to(stu, stu.get_by_text("Request sent", exact=True), 140)  # the notice sits at the top of the page
        shot(rt, stu, sid(24))

    rt.step("student: submit Title Defense for review", submit)

    # ---------------- Part B: adviser (recorded and accepted) ----------------
    rt.step("student: Research Adviser page", lambda: (rt.go(stu, "/student/adviser"), shot(rt, stu, sid(8))))

    def staff_adviser_view():
        rc = rt.new_page("research@usls.edu.ph")
        rt.go(rc, "/workflow/research-gate")
        tab = rc.get_by_role("tab", name=re.compile("Adviser designation"))
        if tab.count():
            tab.first.click()
        else:
            rc.get_by_role("button", name=re.compile("Adviser designation")).first.click()
        rt.settle(rc)
        rc.get_by_role("tab", name=re.compile("^All")).click()
        rt.settle(rc)
        h.scroll_to(rc, rc.get_by_text("Miguel Yu", exact=True).first, 160)
        shot(rt, rc, sid(9))
        rc.context.close()

    rt.step("research coordinator: adviser appointment record", staff_adviser_view)

    def faculty_view():
        fac = rt.new_page("celeste.tan@usls.edu.ph")
        fac.get_by_role("link", name="My Advisees").click()
        rt.settle(fac)
        h.scroll_to(fac, fac.get_by_text("Miguel Yu", exact=True), 330)
        shot(rt, fac, sid(10))
        fac.context.close()

    rt.step("faculty (adviser Dr. Celeste Tan): My Advisees lists Miguel", faculty_view)

    # ---------------- Part C: GS staff verifies in Research Gate ----------------
    staff = rt.new_page("staff@usls.edu.ph")

    def open_gate():
        rt.go(staff, "/workflow/research-gate")
        h.pick_student(staff, "2260004", "Miguel Yu")
        h.scroll_to(staff, staff.get_by_text("Research Gate record"), 80)
        shot(rt, staff, sid(11))

    rt.step("staff: open Research Gate and pick Miguel", open_gate)

    def see_files():
        h.scroll_to(staff, staff.get_by_text("Title Defense requirements"), 90)
        shot(rt, staff, sid(12))

    rt.step("staff: submitted files visible", see_files)

    def verify():
        staff.get_by_role("button", name="Verify submitted requirements").click()
        rt.settle(staff)
        h.scroll_to(staff, staff.get_by_text("Title Defense requirements"), 90)
        shot(rt, staff, sid(13))
        staff.get_by_role("button", name="Verify submitted requirements").scroll_into_view_if_needed()
        shot(rt, staff, sid(14))

    rt.step("staff: Verify submitted requirements", verify)

    # ---------------- Part D: Academic Coordinator endorses Form 1 ----------------
    ac = rt.new_page("academic@usls.edu.ph")

    def open_ac():
        rt.go(ac, "/workflow/research-gate")
        h.pick_student(ac, "2260004", "Miguel Yu")
        ac.get_by_role("button", name=re.compile("Miguel Yu.*Waiting", re.S)).first.click()
        ac.wait_for_timeout(500)
        h.scroll_to(ac, ac.get_by_role("heading", name="Form 1 Endorsements"), 80)
        shot(rt, ac, sid(15))

    rt.step("academic coordinator: open Form 1 endorsements and select Miguel", open_ac)

    def sign():
        h.draw_signature(ac)
        h.scroll_to(ac, ac.get_by_text("Draw signature"), 90)
        shot(rt, ac, sid(16))
        ac.get_by_role("button", name=re.compile("Finalize signature")).click()
        ac.wait_for_timeout(400)
        shot(rt, ac, sid(17))

    rt.step("academic coordinator: draw and finalize signature", sign)

    def endorse():
        ac.get_by_role("button", name=re.compile("Endorse and sign")).click()
        rt.settle(ac)
        try:
            rt.note("after endorse, on screen: " + " / ".join(ac.get_by_text(re.compile("endorsed successfully|Cannot read", re.I)).all_inner_texts())[:200])
        except Exception:  # noqa: BLE001
            pass
        banner = ac.get_by_text(re.compile("Cannot read", re.I)).count()
        rt.note(f"red error line after endorse: {banner}")
        if not ac.get_by_text("Endorsed by").count():  # the queue did not refresh by itself: reload to see the result
            rt.go(ac, "/workflow/research-gate")
            h.pick_student(ac, "2260004", "Miguel Yu")
            ac.get_by_role("button", name=re.compile("Miguel Yu.*Endorsed", re.S)).first.click()
            ac.wait_for_timeout(500)
        h.scroll_to(ac, ac.get_by_role("heading", name="Form 1 Endorsements"), 80)
        shot(rt, ac, sid(18))
        h.scroll_to(ac, ac.get_by_text("Endorsed by").first, 160)
        shot(rt, ac, sid(19))

    rt.step("academic coordinator: Endorse and sign Form 1", endorse)

    def gate_after():
        rt.go(staff, "/workflow/research-gate")
        h.pick_student(staff, "2260004", "Miguel Yu")
        h.scroll_to(staff, staff.get_by_text("Title Defense requirements"), 90)
        shot(rt, staff, sid(20))
        h.scroll_to(staff, staff.get_by_text("System-generated from the active paper body"), 300)
        shot(rt, staff, sid(21))

    rt.step("staff: Research Gate after endorsement; panel matching is next", gate_after)

    # ---------------- Part E: faculty expertise records (adviser's profile, read only) ----------------
    def expertise():
        rt.go(staff, "/faculty")
        staff.get_by_text("Dr. Liwayway Bautista").first.click()
        rt.settle(staff)
        shot(rt, staff, sid(22))
        h.scroll_to(staff, staff.get_by_role("heading", name=re.compile("^Expertise records")), 185)
        shot(rt, staff, sid(23))

    rt.step("staff: faculty profile and expertise records", expertise)

    for ctxpage in (stu, staff, ac):
        try:
            ctxpage.context.close()
        except Exception:  # noqa: BLE001
            pass
