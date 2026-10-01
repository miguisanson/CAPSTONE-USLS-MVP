"""Case 12 - AWOL and Return from AWOL (Maya Torres)."""
from __future__ import annotations

import re

from .common import main_text
from .helpers_a3 import open_link

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

    def st_open():
        open_link(rt, staff, "AWOL & Residency", "/workflow/awol")
        rt.shot(staff, f"{S}-01")
        staff.get_by_label(re.compile("Search AWOL")).fill("Maya")
        rt.settle(staff, 800)
        staff.get_by_role("heading", name=re.compile("AWOL, return, and residency cases")).first.evaluate(
            "el => el.scrollIntoView({block: 'start'})")
        staff.evaluate("document.querySelector('main')?.scrollBy?.(0, -70)")
        staff.wait_for_timeout(500)
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
        staff.get_by_label(re.compile("Search AWOL")).fill("Maya")
        rt.settle(staff, 800)
        staff.get_by_role("heading", name=re.compile("AWOL, return, and residency cases")).first.evaluate(
            "el => el.scrollIntoView({block: 'start'})")
        staff.wait_for_timeout(500)
        rt.shot(staff, f"{S}-07")
        staff.get_by_role("button", name="View", exact=True).first.click()
        rt.settle(staff, 1200)
        rt.shot(staff, f"{S}-08")

    rt.step("staff opens Maya's submitted return case", st_case)

    def st_check():
        dlg = staff.locator("[role=dialog]").last
        dlg.get_by_role("button", name="Run policy checker").click()
        rt.settle(staff, 1500)
        dlg.get_by_text(re.compile("policy", re.I)).last.scroll_into_view_if_needed()
        rt.note("checker: " + " | ".join(dlg.inner_text().split("\n"))[-1800:])
        rt.shot(staff, f"{S}-09")

    rt.step("staff runs the policy checker", st_check)

    def st_forward():
        dlg = staff.locator("[role=dialog]").last
        notes = dlg.get_by_label(re.compile("Staff review notes", re.I))
        if notes.count():
            notes.first.fill(STAFF_NOTE)
        else:
            dlg.locator("textarea").first.fill(STAFF_NOTE)
        rt.shot(staff, f"{S}-10")
        dlg.get_by_role("button", name="Forward to Dean").click()
        rt.settle(staff, 1800)
        rt.shot(staff, f"{S}-11")

    rt.step("staff adds notes and forwards to the Dean", st_forward)

    dean = rt.new_page("dean@usls.edu.ph")

    def d_open():
        dean.get_by_role("link", name=re.compile(r"Leave . Readmission")).first.click()
        rt.settle(dean, 1500)
        rt.shot(dean, f"{S}-12")
        dean.get_by_role("row").filter(has_text="Maya").get_by_role("link", name="Review").click()
        rt.settle(dean, 1500)
        rt.shot(dean, f"{S}-13")
        dean.get_by_role("button", name="Approve", exact=True).first.scroll_into_view_if_needed()
        rt.shot(dean, f"{S}-14")

    rt.step("Dean opens Maya's case", d_open)

    def d_approve():
        ta = dean.get_by_label(re.compile("Your comment", re.I))
        if ta.count():
            ta.first.fill(DEAN_COMMENT)
        dean.get_by_role("button", name="Approve", exact=True).first.click()
        dean.wait_for_timeout(900)
        rt.shot(dean, f"{S}-15")
        dean.get_by_role("button", name=re.compile(r"^Approve current stage")).click()
        rt.settle(dean, 2000)
        rt.shot(dean, f"{S}-16")

    rt.step("Dean approves", d_approve)

    def st_after():
        rt.go(staff, "/workflow/awol")
        staff.get_by_label(re.compile("Search AWOL")).fill("Maya")
        rt.settle(staff, 800)
        staff.get_by_role("heading", name=re.compile("AWOL, return, and residency cases")).first.evaluate(
            "el => el.scrollIntoView({block: 'start'})")
        staff.wait_for_timeout(500)
        staff.get_by_role("heading", name="Return Outcome").first.scroll_into_view_if_needed()
        staff.wait_for_timeout(500)
        rt.shot(staff, f"{S}-17")
        staff.get_by_role("button", name="View", exact=True).first.click()
        rt.settle(staff, 1200)
        rt.shot(staff, f"{S}-17b")
        staff.get_by_role("button", name="Close details").first.click()
        rt.go(student, "/student/requests/awol-return")
        rt.shot(student, f"{S}-18", full=True)

    rt.step("staff and student see the outcome", st_after)
