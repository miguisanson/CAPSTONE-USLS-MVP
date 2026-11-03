"""Demo part 2l - Reports & Analytics as redesigned on v6.1 (AD10): six-number strip, Needs attention, Where students
get stuck, Office speed, Records to fix, the older lists and Registrar changes. Same ``run(rt)`` contract as the
walkthrough capture cases; read-only (nothing is changed)."""
from __future__ import annotations

import re

from capture.common import Runtime
from capture.helpers_a1 import scroll_to, scroll_top


def s(n: int) -> str:
    return f"reports-tour-{n:02d}"


def run(rt: Runtime) -> None:
    staff = rt.new_page("staff@usls.edu.ph")

    def tab(name: str) -> None:
        staff.get_by_role("tab", name=name).first.click()
        Runtime.settle(staff, 1200)
        scroll_to(staff.get_by_role("tab", name=name), 120)

    def open_page():
        rt.go(staff, "/")
        staff.get_by_role("link", name=re.compile("Reports & Analytics")).first.click()
        staff.get_by_role("tab", name="Needs attention").wait_for()
        Runtime.settle(staff, 1500)
        scroll_top(staff)
        rt.shot(staff, s(1))
    rt.step("open Reports & Analytics", open_page)

    def tiles():
        staff.get_by_text("Behind schedule").first.hover()
        rt.shot(staff, s(2))
        staff.get_by_text("Median days to decide").first.hover()
        rt.shot(staff, s(3))
    rt.step("read the six numbers", tiles)

    def attention():
        scroll_to(staff.get_by_text("What is holding students back?").first, 110)
        rt.shot(staff, s(4))
        # A cause chip filters the list below to that cause ("Show all causes" undoes it).
        staff.get_by_role("group", name="Causes").get_by_role("button").first.click()
        Runtime.settle(staff, 1200)
        scroll_to(staff.get_by_text("Students who need attention", exact=True).first, 110)
        rt.shot(staff, s(5))
        staff.get_by_role("button", name="Show all causes").first.click()
        Runtime.settle(staff, 1000)
        scroll_to(staff.get_by_text("Students who need attention", exact=True).first, 110)
        rt.shot(staff, s(6))
    rt.step("Needs attention: the causes, the students behind a bar, the list", attention)

    def stuck():
        tab("Where students get stuck")
        rt.shot(staff, s(7))
        # Every count is a button that lists the students behind it.
        count = staff.locator("main table button").filter(has_text=re.compile(r"^[1-9]\d*$")).first
        count.scroll_into_view_if_needed()
        count.click()
        staff.get_by_role("dialog").first.wait_for()
        Runtime.settle(staff, 900)
        rt.shot(staff, "reports-tour-07b")
        staff.keyboard.press("Escape")
        staff.wait_for_timeout(600)
    rt.step("Where students get stuck", stuck)

    def speed():
        tab("Office speed")
        rt.shot(staff, s(8))
    rt.step("Office speed", speed)

    def fix():
        tab("Records to fix")
        rt.shot(staff, s(9))
    rt.step("Records to fix", fix)

    for n, name in ((10, "Cohorts by stage"), (11, "Graduation candidates"), (12, "Overdue and pending"), (13, "Defenses")):
        def older(name=name, n=n):
            tab(name)
            rt.shot(staff, s(n))
        rt.step(f"report: {name}", older)

    def registrar():
        tab("Registrar changes")
        rt.shot(staff, s(14))
    rt.step("Registrar changes", registrar)

    def program_filter():
        scroll_top(staff)
        tab("Needs attention")
        scroll_top(staff)
        staff.get_by_label("Program").first.select_option(label="MAED")
        Runtime.settle(staff, 1500)
        rt.shot(staff, s(15))
        staff.get_by_label("Program").first.select_option(index=0)
        Runtime.settle(staff, 1000)
    rt.step("filter by program: every number follows", program_filter)
