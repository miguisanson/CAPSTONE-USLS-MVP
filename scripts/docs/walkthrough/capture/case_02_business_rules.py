"""Case 02 - Business Rules register and the rules shown on each workflow screen (incl. "can a student drop on Day 1?")."""
from __future__ import annotations

import re

from .common import Runtime
from .helpers_a1 import body, goto_nav, wait_loaded, safe_notes

SLUG = "business-rules"


def s(n: int) -> str:
    return f"{SLUG}-{n:02d}"


def open_rules_panel(page, title_pattern: str) -> None:
    """Expand the PolicyRules section whose button text matches ``title_pattern`` (no-op when already open)."""
    btn = page.locator("button[aria-expanded]").filter(has_text=re.compile(title_pattern, re.I)).first
    btn.wait_for(timeout=15000)
    if btn.get_attribute("aria-expanded") != "true":
        btn.click()
    page.wait_for_timeout(700)
    btn.scroll_into_view_if_needed()
    page.evaluate("window.scrollBy(0, -120)")
    page.wait_for_timeout(300)


def run(rt: Runtime) -> None:
    safe_notes(rt)
    staff = rt.new_page("staff@usls.edu.ph")

    # ---- Part A: the register ------------------------------------------------
    def open_register():
        goto_nav(rt, staff, "Business Rules", "/business-rules")
        staff.get_by_role("heading", name=re.compile("Business rules", re.I)).first.wait_for()
        rt.note("register header: " + staff.locator("main").inner_text()[:700].replace("\n", " | "))
        rt.shot(staff, s(1))
    rt.step("open Business Rules", open_register)

    search = staff.get_by_placeholder("Search rules or pages")

    def search_withdrawal():
        search.fill("withdraw")
        staff.wait_for_timeout(700)
        rt.shot(staff, s(2), full=True)
    rt.step("search withdraw", search_withdrawal)

    def search_week():
        search.fill("week")
        staff.wait_for_timeout(700)
        rt.note("week search: " + staff.locator("main").inner_text()[900:3500].replace("\n", " | "))
        rt.shot(staff, s(3), full=True)
    rt.step("search week", search_week)

    def history():
        search.fill("Subject withdrawal window")
        staff.wait_for_timeout(700)
        staff.get_by_role("button", name=re.compile("Change history", re.I)).first.click()
        staff.wait_for_timeout(600)
        rt.note("history: " + staff.locator("main").inner_text()[700:2200].replace("\n", " | "))
        rt.shot(staff, s(4))
    rt.step("open Change history on the withdrawal window rule", history)

    def needs_review():
        search.fill("")
        staff.get_by_role("button", name=re.compile(r"^Needs review", re.I)).first.click()
        staff.wait_for_timeout(800)
        rt.shot(staff, s(5))
    rt.step("filter Needs review", needs_review)

    def documented():
        staff.get_by_role("button", name=re.compile(r"^Documented only", re.I)).first.click()
        staff.wait_for_timeout(800)
        rt.shot(staff, s(6))
    rt.step("filter Documented only", documented)

    # ---- Part B: rules on the workflow screens (staff) ------------------------
    def withdrawal_screen():
        goto_nav(rt, staff, "Withdrawal Requests", "/workflow/withdrawal")
        open_rules_panel(staff, "Rules applied on this screen")
        rt.note("withdrawal screen: " + staff.locator("main").inner_text()[:2500].replace("\n", " | "))
        rt.shot(staff, s(7))
    rt.step("Withdrawal Requests: rules panel", withdrawal_screen)

    def loa_screen():
        goto_nav(rt, staff, "Leave of Absence", "/workflow/leave-of-absence")
        open_rules_panel(staff, "Rules applied on this screen")
        rt.shot(staff, s(8))
    rt.step("Leave of Absence: rules panel", loa_screen)

    def readmission_screen():
        goto_nav(rt, staff, "Readmission", "/workflow/readmission")
        open_rules_panel(staff, "Rules applied on this screen")
        rt.shot(staff, s(9))
    rt.step("Readmission: rules panel", readmission_screen)

    def course_adjustments():
        goto_nav(rt, staff, "Course Adjustments", "/course-adjustments")
        open_rules_panel(staff, "Adding or changing a subject")
        rt.note("course adjustments: " + staff.locator("main").inner_text()[:2500].replace("\n", " | "))
        rt.shot(staff, s(10))
    rt.step("Course Adjustments: rules panel", course_adjustments)

    def enrollment():
        goto_nav(rt, staff, "Enrollment", "/enrollment")
        open_rules_panel(staff, "Enrollment and academic load")
        rt.shot(staff, s(11))
    rt.step("Enrollment: rules panel", enrollment)

    def drop_dialog():
        # pick a program/student that has subjects enrolled, then open the status dialog (cancelled, nothing saved)
        selects = staff.locator("main select")
        prog = selects.nth(0)
        maed = [o for o in prog.locator("option").all_inner_texts() if o.startswith("MAED")][0]
        prog.select_option(label=maed)
        wait_loaded(staff)
        stu = selects.nth(3)
        label = [o for o in stu.locator("option").all_inner_texts() if o.startswith("Roberto Aquino")][0]
        stu.select_option(label=label)
        wait_loaded(staff)
        staff.locator("button[title=\"Change student status\"]").first.click()
        staff.get_by_role("dialog").wait_for()
        staff.wait_for_timeout(800)
        rt.note("drop dialog: " + staff.get_by_role("dialog").inner_text()[:1800].replace("\n", " | "))
        # the dialog is taller than a 768 px window (see BUG note in the report): enlarge the window to show all of it
        height = int(staff.get_by_role("dialog").bounding_box()["height"]) + 60
        staff.set_viewport_size({"width": 1366, "height": min(height, 2600)})
        staff.wait_for_timeout(800)
        rt.shot(staff, s(12))
        staff.set_viewport_size({"width": 1366, "height": 768})
        staff.keyboard.press("Escape")
        staff.wait_for_timeout(500)
    rt.step("Enrollment: Record dropped subject dialog shows when a subject can be dropped", drop_dialog)

    def research_gate():
        goto_nav(rt, staff, "Research Gate", "/workflow/research-gate")
        open_rules_panel(staff, "Rules applied on this screen")
        rt.shot(staff, s(13))
    rt.step("Research Gate: rules panel", research_gate)

    def practicum():
        goto_nav(rt, staff, "Practicum", "/workflow/practicum")
        open_rules_panel(staff, "Rules applied on this screen")
        rt.shot(staff, s(14))
    rt.step("Practicum: rules panel (prototype rules need review)", practicum)

    # ---- Part C: student side ---------------------------------------------------
    def student_withdrawal():
        student = rt.new_page("withdrawal.elena@usls.edu.ph")
        try:
            goto_nav(rt, student, "Subject Withdrawal", "/student/requests/withdrawal")
            student.wait_for_timeout(800)
            rt.note("student withdrawal: " + student.locator("main").inner_text()[:3500].replace("\n", " | "))
            rt.shot(student, s(15))
            rt.shot(student, s(16), full=True)
        finally:
            student.context.close()
    rt.step("Student Subject Withdrawal page shows the deadline rule", student_withdrawal)

    def semesters():
        goto_nav(rt, staff, "Academic Semesters", "/term-settings")
        cur = staff.get_by_text(re.compile(r"AY 2026-2027 1st Semester")).first
        cur.scroll_into_view_if_needed()
        staff.wait_for_timeout(500)
        rt.shot(staff, s(17))
    rt.step("Academic Semesters: dates the window is counted from", semesters)

    staff.context.close()
