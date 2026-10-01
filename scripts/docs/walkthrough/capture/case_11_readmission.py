"""Case 11 - Readmission (Therese Lacson) on the staged board."""
from __future__ import annotations

import re

from .helpers_a3 import dean_board_decision, center_text, column_holds, drag_card, frame_board, open_link

KEY = "readmission-therese"
EMAIL = "readmission.therese@usls.edu.ph"
SLUG = "readmission"
WHO = "Therese"
INTENT = "My leave is ending and I am ready to resume thesis work with my adviser. My study plan is updated and I have no pending accountability."
STAFF_NOTE = "Return semester is after the leave; checklist is complete. Forwarded for the Dean's decision."
DEAN_COMMENT = "Approved. The Academic Coordinator will plan the enrollment for the return semester."


def run(rt):
    S = "readmission"
    rt.step("reset Therese", lambda: rt.reset(KEY))

    student = rt.new_page(EMAIL)

    def s_open():
        open_link(rt, student, "Readmission", f"/student/requests/{SLUG}")
        rt.shot(student, f"{S}-01")

    rt.step("student opens Readmission", s_open)

    def s_rules():
        student.get_by_text("Rules applied on this screen").first.click()
        student.wait_for_timeout(600)
        rt.shot(student, f"{S}-02")
        student.get_by_text("Rules applied on this screen").first.click()

    rt.step("student reads the rules panel", s_rules)

    def s_fill():
        student.locator("main select").first.select_option(index=1)  # AY 2026-2027 2nd Semester
        student.locator("main textarea").fill(INTENT)
        for box in student.locator("main input[type=checkbox]").all():
            box.check()
        student.get_by_role("button", name=re.compile("Submit readmission")).scroll_into_view_if_needed()
        rt.shot(student, f"{S}-03", full=True)

    rt.step("student fills the request and ticks the four items", s_fill)

    def s_submit():
        student.get_by_role("button", name=re.compile("Submit readmission")).click()
        rt.settle(student, 2000)
        student.evaluate("window.scrollTo(0,0)")
        rt.shot(student, f"{S}-04", full=True)

    rt.step("student submits", s_submit)

    staff = rt.new_page("staff@usls.edu.ph")

    def st_open():
        open_link(rt, staff, "Readmission", f"/workflow/{SLUG}")
        staff.get_by_placeholder("Search name").fill(WHO)
        rt.settle(staff, 800)
        frame_board(staff, "Submitted")
        rt.shot(staff, f"{S}-05")

    rt.step("staff opens the Readmission board and finds Therese", st_open)

    def st_drag():
        drag_card(rt, staff, WHO, "In staff review")
        assert column_holds(staff, "In staff review", WHO)
        frame_board(staff, "Submitted")
        rt.shot(staff, f"{S}-06")

    rt.step("staff drags the card to In staff review", st_drag)

    def st_details():
        staff.get_by_role("button", name="View details").first.click()
        rt.settle(staff, 1200)
        rt.shot(staff, f"{S}-07")
        staff.get_by_text(re.compile(r"Advice for staff")).first.scroll_into_view_if_needed()
        staff.wait_for_timeout(400)
        rt.shot(staff, f"{S}-08")

    rt.step("staff opens the request and reads the policy check", st_details)

    def st_forward():
        staff.get_by_role("button", name=re.compile(r"Forward to Dean|Complete review", re.I)).last.click()
        staff.wait_for_timeout(900)
        dlg = staff.locator("[role=dialog]").last
        for box in dlg.locator("input[type=checkbox]").all():
            box.check()
        if dlg.locator("textarea").count():
            dlg.locator("textarea").first.fill(STAFF_NOTE)
        rt.note("dialog: " + " | ".join(dlg.inner_text().split()))
        rt.shot(staff, f"{S}-09")
        dlg.get_by_role("button", name=re.compile(r"Forward to Dean|Complete review", re.I)).click()
        rt.settle(staff, 1500)
        btn = staff.get_by_role("button", name="Close details")
        if btn.count():
            btn.first.click()
            staff.wait_for_timeout(500)
        frame_board(staff, "Returned to student")
        rt.shot(staff, f"{S}-10")

    rt.step("staff forwards to the Dean", st_forward)

    dean = rt.new_page("dean@usls.edu.ph")

    def d_decide():
        dean_board_decision(rt, dean, r"^Readmission", WHO, "Approved - back in the program", DEAN_COMMENT,
                            (f"{S}-11", f"{S}-12", f"{S}-13"))

    rt.step("Dean drags the card to Approved and confirms", d_decide)

    def st_result():
        rt.go(staff, f"/workflow/{SLUG}")
        staff.get_by_placeholder("Search name").fill(WHO)
        rt.settle(staff, 800)
        frame_board(staff, "With the Dean")
        rt.shot(staff, f"{S}-16")
        staff.get_by_role("button", name="View details").first.click()
        rt.settle(staff, 1200)
        rt.shot(staff, f"{S}-17")

    rt.step("staff sees the approved request", st_result)

    def s_result():
        rt.go(student, f"/student/requests/{SLUG}")
        rt.shot(student, f"{S}-18", full=True)

    rt.step("student sees the result", s_result)
