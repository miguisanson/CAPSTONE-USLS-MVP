"""Case 12 - AWOL and Return from AWOL (Maya Torres) on the shared staged board (drag and drop works in the real UI)."""
from __future__ import annotations

import re

from .case_10_leave_of_absence import close_details, frame, search
from .helpers_a3 import column_holds, drag_card, open_link

KEY = "awol-maya"
EMAIL = "awol.maya@usls.edu.ph"
WHO = "Maya"
INTENT = "I intend to resume my enrollment and complete my thesis."
REASON = "I have resolved the family matter that kept me away and I am ready to continue."
STAFF_NOTE = "Within the normal residence period for a master's student. Forwarded for the Dean's decision."
DEAN_COMMENT = "Approved. Return in the stated semester; the Academic Coordinator will plan the enrollment."


def run(rt):
    S = "awol"
    rt.step("reset Maya", lambda: rt.reset(KEY))

    staff = rt.new_page("staff@usls.edu.ph")

    def st_open():
        open_link(rt, staff, "AWOL & Residency", "/workflow/awol")
        rt.shot(staff, f"{S}-01")
        search(staff, rt, WHO)
        frame(staff, "AWOL")
        rt.shot(staff, f"{S}-02")

    rt.step("staff opens AWOL & Residency and finds Maya (flagged by the system)", st_open)

    def st_rules():
        staff.get_by_text("Rules applied on this screen").first.click()
        staff.wait_for_timeout(600)
        rt.shot(staff, f"{S}-03", full=True)
        staff.get_by_text("Rules applied on this screen").first.click()

    rt.step("staff reads the rules panel", st_rules)

    def st_locked():
        # a card that waits for the student cannot be moved: the board says why
        staff.get_by_role("button", name=re.compile("View details for Maya")).first.click()
        rt.settle(staff, 1500)
        rt.shot(staff, f"{S}-04")
        close_details(staff)

    rt.step("staff opens Maya's AWOL card", st_locked)

    student = rt.new_page(EMAIL)

    def s_open():
        open_link(rt, student, "Return from AWOL", "/student/requests/awol-return")
        rt.shot(student, f"{S}-05", full=True)

    rt.step("student opens Return from AWOL", s_open)

    def s_submit():
        # The next open semester is preselected and the last enrolled semester comes from the records.
        student.locator("main select").first.select_option(label="AY 2026-2027 2nd Semester")
        areas = student.locator("main textarea")
        areas.nth(0).fill(INTENT)
        areas.nth(1).fill(REASON)
        rt.shot(student, f"{S}-06", full=True)
        student.get_by_role("button", name=re.compile("Submit return declaration")).click()
        student.wait_for_timeout(800)
        rt.shot(student, f"{S}-07")  # the "Send this request?" box
        student.locator("[role=dialog]").last.get_by_role("button", name="Send request").click()
        rt.settle(student, 2200)
        student.evaluate("window.scrollTo(0,0)")
        rt.shot(student, f"{S}-08", full=True)

    rt.step("student fills and sends the return declaration", s_submit)

    def st_case():
        rt.go(staff, "/workflow/awol")
        search(staff, rt, WHO)
        frame(staff, "AWOL")
        rt.shot(staff, f"{S}-09")
        staff.get_by_role("button", name=re.compile("View details for Maya")).first.click()
        rt.settle(staff, 1500)
        rt.shot(staff, f"{S}-10")
        rt.note("details: " + " | ".join(staff.locator("[role=dialog]").last.inner_text().split("\n"))[:1600])
        close_details(staff)

    rt.step("staff opens Maya's submitted return case", st_case)

    def st_forward():
        drag_card(rt, staff, WHO, "With the Dean")
        staff.wait_for_timeout(800)
        dlg = staff.locator("[role=dialog]").last
        if dlg.locator("textarea").count():
            dlg.locator("textarea").first.fill(STAFF_NOTE)
        rt.note("forward dialog: " + " | ".join(dlg.inner_text().split("\n"))[:600])
        rt.shot(staff, f"{S}-11")
        dlg.get_by_role("button", name="Forward to Dean", exact=True).click()
        rt.settle(staff, 1800)
        frame(staff, "AWOL")
        rt.shot(staff, f"{S}-12")

    rt.step("staff drags the card to With the Dean and forwards", st_forward)

    dean = rt.new_page("dean@usls.edu.ph")

    def d_decide():
        dean.get_by_role("link", name=re.compile(r"^AWOL & Residency")).first.click()
        rt.settle(dean, 2500)
        search(dean, rt, WHO)
        frame(dean, "Return review")
        rt.shot(dean, f"{S}-13")
        drag_card(rt, dean, WHO, "Back in the program")
        dean.wait_for_timeout(800)
        dlg = dean.locator("[role=dialog]").last
        if dlg.locator("textarea").count():
            dlg.locator("textarea").first.fill(DEAN_COMMENT)
        rt.note("dean dialog: " + " | ".join(dlg.inner_text().split("\n"))[:600])
        rt.shot(dean, f"{S}-14")
        dlg.get_by_role("button", name="Approve the return", exact=True).click()
        rt.settle(dean, 2200)
        frame(dean, "Return review")
        rt.shot(dean, f"{S}-15")

    rt.step("Dean drags the card to Back in the program and approves", d_decide)

    def st_after():
        rt.go(staff, "/workflow/awol")
        search(staff, rt, WHO)
        frame(staff, "With the Dean")
        rt.shot(staff, f"{S}-16")
        staff.get_by_role("button", name=re.compile("View details for Maya")).first.click()
        rt.settle(staff, 1500)
        rt.shot(staff, f"{S}-17")
        close_details(staff)
        staff.get_by_role("heading", name="Registrar list").first.evaluate("el => el.scrollIntoView({block: 'start'})")
        staff.wait_for_timeout(600)
        rt.shot(staff, f"{S}-18")

    rt.step("staff sees the outcome and the Registrar list", st_after)

    def st_report():
        with staff.expect_download(timeout=20000) as info:
            staff.locator("tr").filter(has_text="Maya").get_by_role("link", name=re.compile("Download report")).click()
        rt.note(f"downloaded {info.value.suggested_filename}")

    rt.step("staff downloads the Registrar report", st_report)

    def s_result():
        rt.go(student, "/student/requests/awol-return")
        rt.shot(student, f"{S}-19", full=True)

    rt.step("student sees the outcome", s_result)
