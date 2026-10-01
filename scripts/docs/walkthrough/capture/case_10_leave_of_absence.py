"""Case 10 - Leave of Absence (Daniel Fernandez) on the staged board with real drag and drop."""
from __future__ import annotations

import re

from .common import main_text
from .helpers_a3 import center_text, column_holds, drag_card, frame_board, open_link

KEY = "leave-of-absence-daniel"
EMAIL = "loa.daniel@usls.edu.ph"
SLUG = "leave-of-absence"
WHO = "Daniel"
REASON = "Employment / professional obligation"
REMARKS = "I have accepted a work assignment in another city and cannot carry a study load for the next two semesters."
STAFF_NOTE = "Two semesters is within the handbook limit and no earlier leave is on record. The minimum-residency check is a prototype rule, so the Dean should confirm."
DEAN_COMMENT = "Approved for two semesters. The student is to file a readmission request before the leave ends."


def _scroll_to_text(page, pattern: str) -> None:
    page.get_by_text(re.compile(pattern, re.I)).first.scroll_into_view_if_needed()
    page.wait_for_timeout(400)


def run(rt):
    S = "leave-of-absence"
    rt.step("reset Daniel", lambda: rt.reset(KEY))

    # ---- Part A: student files the request ------------------------------------------
    student = rt.new_page(EMAIL)

    def open_student_page():
        open_link(rt, student, "Leave of Absence", f"/student/requests/{SLUG}")
        rt.shot(student, f"{S}-01")

    rt.step("student opens Leave of Absence", open_student_page)

    def student_rules():
        student.get_by_text("Rules applied on this screen").first.click()
        student.wait_for_timeout(600)
        rt.shot(student, f"{S}-02", full=True)
        student.get_by_text("Rules applied on this screen").first.click()
        student.wait_for_timeout(400)

    rt.step("student reads the rules panel", student_rules)

    def student_fill():
        sels = student.locator("main select")
        sels.nth(0).select_option(index=2)  # AY 2026-2027 2nd Semester (upcoming)
        student.wait_for_timeout(400)
        sels.nth(1).select_option(index=2)  # one semester later -> two semesters
        sels.nth(2).select_option(label=REASON)
        student.locator("main textarea").fill(REMARKS)
        student.get_by_role("button", name=re.compile("Submit leave request")).scroll_into_view_if_needed()
        rt.shot(student, f"{S}-03", full=True)

    rt.step("student fills the form", student_fill)

    def student_submit():
        student.get_by_role("button", name=re.compile("Submit leave request")).click()
        rt.settle(student, 2000)
        student.evaluate("window.scrollTo(0,0)")
        rt.shot(student, f"{S}-04")

    rt.step("student submits", student_submit)
    print(main_text(student, 900).replace("\n", " | "))

    # ---- Part B: staff on the Leave of Absence board ---------------------------------
    staff = rt.new_page("staff@usls.edu.ph")

    def staff_open():
        open_link(rt, staff, "Leave of Absence", f"/workflow/{SLUG}")
        rt.shot(staff, f"{S}-05")

    rt.step("staff opens the Leave of Absence board", staff_open)

    def staff_rules():
        staff.get_by_text("Rules applied on this screen").first.click()
        staff.wait_for_timeout(600)
        rt.shot(staff, f"{S}-06", full=True)
        staff.get_by_text("Rules applied on this screen").first.click()
        staff.wait_for_timeout(400)

    rt.step("staff reads the rules panel", staff_rules)

    def staff_search():
        staff.get_by_placeholder("Search name").fill(WHO)
        rt.settle(staff, 800)
        frame_board(staff, "Submitted")
        rt.shot(staff, f"{S}-07")

    rt.step("staff finds Daniel in Submitted", staff_search)

    def staff_drag():
        drag_card(rt, staff, WHO, "In staff review")
        assert column_holds(staff, "In staff review", WHO), "card did not land in In staff review"
        frame_board(staff, "Submitted")
        rt.shot(staff, f"{S}-08")

    rt.step("staff drags the card to In staff review", staff_drag)

    def staff_details():
        staff.get_by_role("button", name="View details").first.click()
        rt.settle(staff, 1200)
        rt.shot(staff, f"{S}-09")
        _scroll_to_text(staff, r"^Policy check$|Advice for staff")
        rt.shot(staff, f"{S}-10")

    rt.step("staff opens the request and reads the policy check", staff_details)

    def staff_forward():
        staff.get_by_role("button", name="Forward to Dean").last.click()
        staff.wait_for_timeout(800)
        dlg = staff.locator("[role=dialog]").last
        dlg.locator("textarea").first.fill(STAFF_NOTE)
        rt.shot(staff, f"{S}-11")
        dlg.get_by_role("button", name="Forward to Dean").click()
        rt.settle(staff, 1500)

    rt.step("staff forwards to the Dean", staff_forward)

    def staff_after_forward():
        # the request window may still be open: close it and show the board
        for name in ("Close details",):
            btn = staff.get_by_role("button", name=name)
            if btn.count():
                btn.first.click()
                staff.wait_for_timeout(500)
        frame_board(staff, "Returned to student")
        rt.shot(staff, f"{S}-12")

    rt.step("board shows With the Dean", staff_after_forward)

    # ---- Part C: Dean decides ---------------------------------------------------------
    dean = rt.new_page("dean@usls.edu.ph")

    def dean_open():
        dean.get_by_role("link", name=re.compile(r"Leave . Readmission")).first.click()
        rt.settle(dean, 1500)
        rt.shot(dean, f"{S}-13")

    rt.step("Dean opens Leave / Readmission / AWOL", dean_open)

    def dean_review():
        dean.get_by_role("link", name="Review").first.click()
        rt.settle(dean, 1500)
        rt.shot(dean, f"{S}-14")
        dean.get_by_role("button", name="Approve").first.scroll_into_view_if_needed()
        rt.shot(dean, f"{S}-15")

    rt.step("Dean opens the case", dean_review)

    def dean_approve():
        ta = dean.get_by_label(re.compile("Your comment", re.I))
        if ta.count():
            ta.first.fill(DEAN_COMMENT)
        dean.get_by_role("button", name="Approve", exact=True).first.click()
        dean.wait_for_timeout(900)
        rt.shot(dean, f"{S}-16")
        dean.get_by_role("button", name="Approve current stage").click()
        rt.settle(dean, 2000)
        rt.shot(dean, f"{S}-16b")

    rt.step("Dean approves", dean_approve)

    # ---- staff starts the leave, Registrar list ---------------------------------------
    def staff_board_again():
        rt.go(staff, f"/workflow/{SLUG}")
        staff.get_by_placeholder("Search name").fill(WHO)
        rt.settle(staff, 800)
        frame_board(staff, "With the Dean")
        rt.shot(staff, f"{S}-17")

    rt.step("staff sees the approved request in Leave scheduled", staff_board_again)

    def staff_start():
        staff.get_by_role("button", name="View details").first.click()
        rt.settle(staff, 1200)
        staff.get_by_role("button", name=re.compile("Start the leave now")).last.click()
        staff.wait_for_timeout(800)
        rt.shot(staff, f"{S}-18")
        dlg = staff.locator("[role=dialog]").last
        dlg.get_by_role("button", name=re.compile("Start the leave now")).click()
        rt.settle(staff, 1800)

    rt.step("staff starts the leave now", staff_start)

    def staff_registrar():
        btn = staff.get_by_role("button", name="Close details")
        if btn.count():
            btn.first.click()
            staff.wait_for_timeout(500)
        frame_board(staff, "Leave scheduled")
        rt.shot(staff, f"{S}-19")
        staff.locator("tr").filter(has_text="Daniel").first.evaluate("el => el.scrollIntoView({block: 'center'})")
        staff.wait_for_timeout(500)
        rt.shot(staff, f"{S}-20")

    rt.step("staff sees On leave and the Registrar list", staff_registrar)

    def staff_download():
        with staff.expect_download(timeout=20000) as info:
            staff.get_by_role("button", name=re.compile(r"Download list \(CSV\)")).click()
        name = info.value.suggested_filename
        rt.note(f"downloaded {name}")
        staff.wait_for_timeout(1200)
        staff.locator("tr").filter(has_text="Daniel").first.evaluate("el => el.scrollIntoView({block: 'center'})")
        rt.shot(staff, f"{S}-21")

    rt.step("staff downloads the Registrar list (CSV)", staff_download)
