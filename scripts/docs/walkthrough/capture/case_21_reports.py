"""Case 21 - Reports & Analytics (staff), as redesigned on 2026-11-04 (I-141, I-357): seven tabs, each answering one question.

Needs attention (causes chart, then the list), Where students get stuck, Office speed, Records to fix, By year started (with its
"More detail" buttons), Overdue and pending, Registrar changes; the students behind a figure open from a count. Follows
scripts/docs/walkthrough/cases/20_reports.json; shot ids reports-01 .. reports-11.
"""
from __future__ import annotations

import re

from .common import Runtime
from .helpers_a1 import scroll_to, scroll_top

SLUG = "reports"


def s(n: int) -> str:
    return f"{SLUG}-{n:02d}"


def _tab(page, name: str) -> None:
    page.get_by_role("tab", name=name).click()
    Runtime.settle(page, 900)


def _frame(page, offset: int = 78) -> None:
    """Bring the tab strip to the top of the scrolling area, so the filters and the start of the table show."""
    scroll_to(page.get_by_role("tablist", name="Reports"), offset)


def run(rt: Runtime) -> None:
    staff = rt.new_page("staff@usls.edu.ph")

    def home():
        rt.go(staff, "/")
        staff.get_by_role("link", name=re.compile("Reports & Analytics")).first.click()
        staff.get_by_role("tab", name="Needs attention").wait_for()
        staff.get_by_text("What is holding students back?").first.wait_for()
        Runtime.settle(staff, 1200)
        rt.note("REPORTS PAGE: " + staff.locator("main").inner_text()[:900].replace(chr(10), " | "))
        scroll_top(staff)
        rt.shot(staff, s(1))
    rt.step("open Reports & Analytics from the sidebar", home)

    def cause():
        # A cause chip narrows the list below to that cause; "Show all causes" undoes it.
        scroll_to(staff.get_by_text("What is holding students back?").first, 110)
        staff.get_by_role("group", name="Causes").get_by_role("button").first.click()
        Runtime.settle(staff, 1200)
        staff.get_by_role("button", name="Show all causes").first.wait_for()
        rt.note("ONE CAUSE: " + staff.locator("main").inner_text()[:700].replace(chr(10), " | "))
        scroll_to(staff.get_by_text("Students who need attention", exact=True).first, 110)
        rt.shot(staff, s(2))
    rt.step("Needs attention: pick one cause", cause)

    def downloads():
        # The two download buttons are plain links to the same address plus the format: check they answer, without saving a file.
        out = []
        for label in ("Download Excel", "Download PDF"):
            href = staff.get_by_role("link", name=label).first.get_attribute("href")
            status = staff.evaluate("async (u) => { const r = await fetch(u); return r.status + ' ' + r.headers.get('content-type'); }", href)
            out.append(f"{label}: {status}")
        rt.note("DOWNLOADS: " + " | ".join(out))
    rt.step("check the Excel and PDF download links answer", downloads)

    def next_page():
        staff.get_by_role("button", name="Show all causes").first.click()
        Runtime.settle(staff, 1000)
        nxt = staff.get_by_role("button", name="Next", exact=True).first
        nxt.scroll_into_view_if_needed()
        nxt.click()
        staff.wait_for_timeout(600)
        rt.note("PAGER: " + staff.get_by_text(re.compile(r"Showing \d+")).first.inner_text() + " | " + staff.get_by_text(re.compile(r"Page \d+ of \d+")).first.inner_text())
        staff.get_by_text(re.compile(r"Showing \d+")).first.scroll_into_view_if_needed()
        rt.shot(staff, s(3))
    rt.step("Show all causes, go to the next page of the table", next_page)

    for tab, shot in [("Where students get stuck", 4), ("Office speed", 5), ("Records to fix", 6), ("By year started", 7)]:
        def show(tab=tab, shot=shot):
            _tab(staff, tab)
            _frame(staff)
            rt.note(f"{tab.upper()}: " + staff.locator("main").inner_text()[:900].replace(chr(10), " | "))
            rt.shot(staff, s(shot))
        rt.step(f"report tab: {tab}", show)

    def more_detail():
        staff.get_by_role("group", name="More detail").get_by_role("button", name="Graduation candidates").click()
        Runtime.settle(staff, 1200)
        scroll_to(staff.get_by_text("More detail", exact=True).first, 90)
        rt.note("MORE DETAIL: " + staff.locator("main").inner_text()[:900].replace(chr(10), " | "))
        rt.shot(staff, s(8))
    rt.step("By year started: More detail, Graduation candidates", more_detail)

    def overdue():
        _tab(staff, "Overdue and pending")
        _frame(staff)
        rt.note("OVERDUE: " + staff.locator("main").inner_text()[:900].replace(chr(10), " | "))
        rt.shot(staff, s(9))
    rt.step("report tab: Overdue and pending", overdue)

    def registrar():
        _tab(staff, "Registrar changes")
        staff.get_by_text("Daily changes", exact=True).first.wait_for()
        Runtime.settle(staff, 1200)
        _frame(staff)
        rt.note("REGISTRAR: " + staff.locator("main").inner_text()[:900].replace(chr(10), " | "))
        rt.shot(staff, s(10))
    rt.step("report tab: Registrar changes", registrar)

    def drill():
        # The strip of six numbers sits above the tabs (not on Registrar changes): open the students behind Active students.
        _tab(staff, "Needs attention")
        scroll_top(staff)
        staff.get_by_role("group", name="Summary numbers").get_by_role("button", name=re.compile("Active students")).first.click()
        staff.get_by_role("dialog").first.wait_for()
        Runtime.settle(staff, 1200)
        rt.note("DRILL: " + staff.get_by_role("dialog").first.inner_text()[:600].replace(chr(10), " | "))
        rt.shot(staff, s(11))
    rt.step("open the students behind a figure", drill)
    staff.context.close()
