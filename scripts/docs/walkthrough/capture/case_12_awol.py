"""Case 12 - AWOL and Return from AWOL (Maya Torres)."""
from __future__ import annotations

import re

from .common import main_text
from .helpers_a3 import dean_board_decision, drag_card, frame_board, open_link

KEY = "awol-maya"
EMAIL = "awol.maya@usls.edu.ph"
INTENT = "I intend to resume my enrollment and complete my thesis."
REASON = "I have resolved the family matter that kept me away and I am ready to continue."
STAFF_NOTE = "Within the normal residence period for a master's student. Forwarded for the Dean's decision."
DEAN_COMMENT = "Approved. Return in the stated semester; the Academic Coordinator will plan the enrollment."


def run(rt):
    S = "awol"
    rt.step("reset Maya", lambda: rt.reset(KEY))

    staff = rt.new_page("staff@usls.edu.ph")

    def search(page, text):
        page.get_by_role("textbox", name=re.compile("Search", re.I)).first.fill(text)
        rt.settle(page, 800)

    def st_open():
        open_link(rt, staff, "AWOL & Residency", "/workflow/awol")
        rt.shot(staff, f"{S}-01")
        search(staff, "Maya")
        frame_board(staff, "AWOL")
        rt.shot(staff, f"{S}-02")
        rt.note("draggable cards on the AWOL board: %d" % staff.locator("[draggable=true]").count())

    rt.step("staff opens AWOL & Residency and finds Maya (automatic AWOL)", st_open)

    def st_rules():
        staff.get_by_text("Rules applied on this screen").first.click()
        staff.wait_for_timeout(600)
        rt.shot(staff, f"{S}-03", full=True)
        staff.get_by_text("Rules applied on this screen").first.click()

    rt.step("staff reads the rules panel", st_rules)

    student = rt.new_page(EMAIL)

    def s_open():
        open_link(rt, student, "Return from AWOL", "/student/requests/awol-return")
        rt.shot(student, f"{S}-04", full=True)

    rt.step("student opens Return from AWOL", s_open)

    def s_submit():
        sels = student.locator("main select")
        sels.nth(0).select_option(label="AY 2026-2027 2nd Semester")
        sels.nth(1).select_option(label="AY 2025-2026 2nd Semester")
        areas = student.locator("main textarea")
        areas.nth(0).fill(INTENT)
        areas.nth(1).fill(REASON)
        rt.shot(student, f"{S}-05", full=True)
        student.get_by_role("button", name=re.compile("Submit return declaration")).click()
        rt.settle(student, 2000)
        student.evaluate("window.scrollTo(0,0)")
        rt.shot(student, f"{S}-06", full=True)

    rt.step("student submits the return declaration", s_submit)

    def st_case():
        rt.go(staff, "/workflow/awol")
        search(staff, "Maya")
        frame_board(staff, "AWOL")
        rt.shot(staff, f"{S}-07")
        staff.locator("[draggable=true]").filter(has_text="Maya").first.get_by_role("button", name="View details").click()
        rt.settle(staff, 1200)
        rt.shot(staff, f"{S}-08")

    rt.step("staff opens Maya's submitted return case", st_case)

    def st_check():
        dlg = staff.locator("[role=dialog]").last
        chk = dlg.get_by_role("button", name=re.compile("policy checker|policy check", re.I))
        if chk.count():
            chk.first.click()
            rt.settle(staff, 1500)
        dlg.get_by_text(re.compile("policy", re.I)).last.scroll_into_view_if_needed()
        rt.note("checker: " + " | ".join(dlg.inner_text().split())[-1500:])
        rt.shot(staff, f"{S}-09")

    rt.step("staff reads/runs the policy checker", st_check)

    def st_forward():
        dlg = staff.locator("[role=dialog]").last
        rt.note("window buttons: " + str([b.inner_text() for b in dlg.get_by_role("button").all()]))
        rt.shot(staff, f"{S}-10")
        btn = dlg.get_by_role("button", name=re.compile("Forward to Dean", re.I))
        if btn.count():
            btn.last.click()
            staff.wait_for_timeout(900)
            d2 = staff.locator("[role=dialog]").last
            if d2.locator("textarea").count():
                d2.locator("textarea").first.fill(STAFF_NOTE)
            rt.shot(staff, f"{S}-10b")
            d2.get_by_role("button").last.click()
            rt.settle(staff, 1800)
            close = staff.get_by_role("button", name="Close details")
            if close.count():
                close.first.click()
        else:
            staff.get_by_role("button", name="Close details").first.click()
            drag_card(rt, staff, "Maya", "With the Dean")
            d2 = staff.locator("[role=dialog]").last
            if d2.locator("textarea").count():
                d2.locator("textarea").first.fill(STAFF_NOTE)
            rt.shot(staff, f"{S}-10b")
            d2.get_by_role("button").last.click()
            rt.settle(staff, 1800)
        frame_board(staff, "Return review")
        rt.shot(staff, f"{S}-11")

    rt.step("staff forwards to the Dean", st_forward)

    dean = rt.new_page("dean@usls.edu.ph")

    def d_decide():
        dean_board_decision(rt, dean, r"^AWOL & Residency", "Maya", "Back in the program", DEAN_COMMENT,
                            (f"{S}-12", f"{S}-13", f"{S}-14"))

    rt.step("Dean drags the card to Back in the program and confirms", d_decide)

    def st_after():
        rt.go(staff, "/workflow/awol")
        search(staff, "Maya")
        frame_board(staff, "Re-enrollment")
        rt.shot(staff, f"{S}-15")
        staff.locator("[draggable=true], article").filter(has_text="Maya").first.get_by_role("button", name="View details").click()
        rt.settle(staff, 1200)
        rt.shot(staff, f"{S}-16")
        staff.get_by_role("button", name="Close details").first.click()
        rt.go(student, "/student/requests/awol-return")
        rt.shot(student, f"{S}-17", full=True)

    rt.step("staff and student see the outcome", st_after)
