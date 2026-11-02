"""Case 11 - Readmission (Therese Lacson) on the shared staged board (drag and drop works in the real UI)."""
from __future__ import annotations

import re

from .case_10_leave_of_absence import close_details, frame, search
from .helpers_a3 import column_holds, drag_card, open_link

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
        student.wait_for_timeout(800)
        rt.shot(student, f"{S}-04")  # the "Send this request?" box
        student.locator("[role=dialog]").last.get_by_role("button", name="Send request").click()
        rt.settle(student, 2200)
        student.evaluate("window.scrollTo(0,0)")
        rt.shot(student, f"{S}-05", full=True)

    rt.step("student sends the request", s_submit)

    staff = rt.new_page("staff@usls.edu.ph")

    def st_open():
        open_link(rt, staff, "Readmission", f"/workflow/{SLUG}")
        search(staff, rt, WHO)
        frame(staff, "Submitted")
        rt.shot(staff, f"{S}-06")

    rt.step("staff opens the Readmission board and finds Therese", st_open)

    def st_drag():
        drag_card(rt, staff, WHO, "In staff review")
        assert column_holds(staff, "In staff review", WHO), "card did not land in In staff review"
        frame(staff, "Submitted")
        rt.shot(staff, f"{S}-07")

    rt.step("staff drags the card to In staff review", st_drag)

    def st_details():
        staff.get_by_role("button", name=re.compile("View details for Therese")).first.click()
        rt.settle(staff, 1500)
        rt.shot(staff, f"{S}-08")
        staff.get_by_text("Return checklist", exact=True).first.evaluate("el => el.scrollIntoView({block: 'start'})")
        staff.wait_for_timeout(500)
        rt.shot(staff, f"{S}-09")
        staff.get_by_text("Policy check", exact=True).first.evaluate("el => el.scrollIntoView({block: 'start'})")
        staff.wait_for_timeout(500)
        rt.shot(staff, f"{S}-10")

    rt.step("staff opens the request, reads the checklist and the policy check", st_details)

    def st_forward():
        staff.locator("[role=dialog]").last.get_by_role("button", name="Forward to Dean").click()
        staff.wait_for_timeout(1200)
        dlg = staff.locator("[role=dialog]").last
        for box in dlg.locator("input[type=checkbox]").all():
            box.check()
        dlg.locator("textarea").first.fill(STAFF_NOTE)
        rt.note("dialog: " + " | ".join(dlg.inner_text().split("\n"))[:900])
        rt.shot(staff, f"{S}-11")
        dlg.get_by_role("button", name="Forward to Dean", exact=True).click()
        rt.settle(staff, 1800)
        close_details(staff)
        frame(staff, "Submitted")
        rt.shot(staff, f"{S}-12")

    rt.step("staff verifies the checklist and forwards to the Dean", st_forward)

    dean = rt.new_page("dean@usls.edu.ph")

    def d_decide():
        dean.get_by_role("link", name=re.compile(r"^Readmission")).first.click()
        rt.settle(dean, 2500)
        search(dean, rt, WHO)
        frame(dean, "With the Dean")
        rt.shot(dean, f"{S}-13")
        drag_card(rt, dean, WHO, "Approved - back in the program")
        dean.wait_for_timeout(800)
        dlg = dean.locator("[role=dialog]").last
        dlg.locator("textarea").first.fill(DEAN_COMMENT)
        rt.note("dean dialog: " + " | ".join(dlg.inner_text().split("\n"))[:600])
        rt.shot(dean, f"{S}-14")
        dlg.get_by_role("button", name="Approve", exact=True).click()
        rt.settle(dean, 2200)
        frame(dean, "With the Dean")
        rt.shot(dean, f"{S}-15")

    rt.step("Dean drags the card to Approved and approves", d_decide)

    def st_result():
        rt.go(staff, f"/workflow/{SLUG}")
        search(staff, rt, WHO)
        frame(staff, "With the Dean")
        rt.shot(staff, f"{S}-16")
        staff.get_by_role("heading", name="Registrar list").first.evaluate("el => el.scrollIntoView({block: 'start'})")
        staff.wait_for_timeout(600)
        rt.shot(staff, f"{S}-17")

    rt.step("staff sees the approved request and the Registrar list", st_result)

    def s_result():
        rt.go(student, f"/student/requests/{SLUG}")
        rt.shot(student, f"{S}-18", full=True)

    rt.step("student sees the result", s_result)
