"""Case 21 - Reports & Analytics (staff), as rebuilt in v5.2 (IM20): five reports, the Registrar list and the Analytics tab.

The Reports page is being redesigned again, so this module captures it as it is on 2026-11-02 and keeps the steps close to what
is on screen: one tab per report, the Program / Stage / Risk style filters, Download Excel / Download PDF, the Registrar changes
list and the Analytics charts with their drill-down window.
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
        staff.get_by_role("tab", name="Students at risk").wait_for()
        staff.get_by_text(re.compile(r"\d+ rows?")).first.wait_for()
        rt.note("REPORTS PAGE: " + staff.locator("main").inner_text()[:700].replace(chr(10), " | "))
        scroll_top(staff)
        rt.shot(staff, s(1))
    rt.step("open Reports & Analytics from the sidebar", home)

    def risk_filter():
        _frame(staff)
        staff.locator("main select").nth(2).select_option(label="Delayed")
        Runtime.settle(staff, 1200)
        rt.note("AT-RISK DELAYED: " + staff.locator("main").inner_text()[:500].replace(chr(10), " | "))
        _frame(staff)
        rt.shot(staff, s(2))
    rt.step("Students at risk: filter Risk = Delayed", risk_filter)

    def downloads():
        # The two download buttons are plain links to the same address plus the format: check they answer, without saving a file.
        out = []
        for label in ("Download Excel", "Download PDF"):
            href = staff.get_by_role("link", name=label).get_attribute("href")
            status = staff.evaluate("async (u) => { const r = await fetch(u); return r.status + ' ' + r.headers.get('content-type'); }", href)
            out.append(f"{label}: {status}")
        rt.note("DOWNLOADS: " + " | ".join(out))
    rt.step("check the Excel and PDF download links answer", downloads)

    def next_page():
        staff.locator("main select").nth(2).select_option(index=0)
        Runtime.settle(staff, 900)
        staff.get_by_role("button", name="Next", exact=True).scroll_into_view_if_needed()
        staff.get_by_role("button", name="Next", exact=True).click()
        staff.wait_for_timeout(600)
        rt.note("PAGER: " + staff.get_by_text(re.compile(r"Showing \d+")).first.inner_text() + " | " + staff.get_by_text(re.compile(r"Page \d+ of \d+")).first.inner_text())
        staff.get_by_text(re.compile(r"Showing \d+")).first.scroll_into_view_if_needed()
        rt.shot(staff, s(3))
    rt.step("clear the filter, go to the next page of the table", next_page)

    for chip, shot in [("By year started", 4), ("Overdue and pending", 5), ("Defenses", 6), ("Graduation candidates", 7)]:
        def tab(chip=chip, shot=shot):
            _tab(staff, chip)
            _frame(staff)
            rt.note(f"{chip.upper()}: " + staff.locator("main").inner_text()[:900].replace(chr(10), " | "))
            rt.shot(staff, s(shot))
        rt.step(f"report tab: {chip}", tab)

    def registrar():
        _tab(staff, "Registrar changes")
        staff.get_by_text("Daily changes", exact=True).first.wait_for()
        Runtime.settle(staff, 1200)
        _frame(staff)
        rt.note("REGISTRAR: " + staff.locator("main").inner_text()[:900].replace(chr(10), " | "))
        rt.shot(staff, s(8))
    rt.step("report tab: Registrar changes", registrar)

    def analytics():
        _tab(staff, "Analytics")
        staff.get_by_text("Lifecycle stage distribution").first.wait_for()
        staff.wait_for_timeout(800)
        _frame(staff)
        rt.note("ANALYTICS: " + staff.locator("main").inner_text()[:1500].replace(chr(10), " | "))
        rt.shot(staff, s(9))
        scroll_to(staff.get_by_text("Students by college", exact=True).first, 90)
        staff.mouse.move(1000, 20)
        staff.wait_for_timeout(500)
        rt.shot(staff, s(10))
    rt.step("report tab: Analytics, the four charts", analytics)

    def drill():
        scroll_to(staff.get_by_text("Lifecycle stage distribution", exact=True).first, 90)
        chip = staff.get_by_role("button", name=re.compile(r"^Show Coursework: \d+ records"))
        chip.first.click()
        staff.get_by_role("dialog").first.wait_for()
        Runtime.settle(staff, 1200)
        rt.note("DRILL: " + staff.get_by_role("dialog").first.inner_text()[:600].replace(chr(10), " | "))
        rt.shot(staff, s(11))
    rt.step("Analytics: open the students behind a stage", drill)
    staff.context.close()
