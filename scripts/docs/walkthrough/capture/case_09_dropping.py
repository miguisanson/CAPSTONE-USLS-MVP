"""Case 09 - Dropping a subject (Academic Coordinator, Joshua Lim)."""
from __future__ import annotations

import re
import time

from .common import Runtime
from .helpers_a2 import pick, scroll_to, top, visible_text

SLUG = "dropping"
CURRENT = "AY 2026-2027 1st Semester"
SUBJECT = "MAED-MAJ2"
STUDENT = "Lim, Joshua"
NOTE = "Registrar advice received: unexcused absences above the handbook limit."


def _open_student(rt: Runtime, page) -> None:
    rt.go(page, "/enrollment")
    pick(page, "Program", "MAED ")
    pick(page, "Academic semester", CURRENT)
    sel = page.locator("select").nth(2)
    opts = sel.locator("option").all_inner_texts()
    sel.select_option(label=next(o for o in opts if STUDENT in o))
    rt.settle(page)
    page.get_by_text("Official offered subjects").first.wait_for()


TALL = {"width": 1366, "height": 2300}  # the dialog with its open rules panel is taller than 768 px and does not scroll


def _open_dialog(page) -> None:
    page.set_viewport_size(TALL)
    page.wait_for_timeout(300)
    page.get_by_role("button", name=f"Change {SUBJECT} student status").click()
    page.get_by_text("Record dropped subject").first.wait_for()
    page.wait_for_timeout(600)


def _collapse_rules(page) -> None:
    """Fold the rules panel so the form fits on a normal screen, then use a viewport tall enough for the dialog."""
    page.get_by_role("dialog").get_by_text("When a subject can be dropped").first.click()
    page.set_viewport_size({"width": 1366, "height": 1000})
    page.wait_for_timeout(500)


def run(rt: Runtime) -> None:
    rt.reset("withdrawal-joshua")
    coord = rt.new_page("academic@usls.edu.ph")

    def list_view():
        _open_student(rt, coord)
        scroll_to(coord, "Official offered subjects", offset=90, exact=True)
        rt.shot(coord, f"{SLUG}-01")

    rt.step("Academic Coordinator opens Enrollment for Joshua Lim", list_view)

    def dialog():
        _open_dialog(coord)
        pass
        rt.shot(coord, f"{SLUG}-02")

    rt.step("Open the status dialog from the Enrolled badge", dialog)

    def fill(percent: str, effective: str | None = None):
        dlg = coord.get_by_role("dialog")
        dlg.get_by_label("New status").select_option(label="Dropped")
        if effective:
            dlg.locator("input[type=date]").fill(effective)
        dlg.get_by_label(re.compile("Unexcused absences")).fill(percent)
        dlg.get_by_label("Coordinator note").fill(NOTE)
        coord.wait_for_timeout(300)

    def refused():
        _collapse_rules(coord)
        fill("10")
        rt.shot(coord, f"{SLUG}-03")
        coord.get_by_role("dialog").get_by_role("button", name=re.compile(r"^Save Dropped")).click()
        coord.wait_for_timeout(1800)
        rt.note("REFUSAL: " + coord.get_by_role("dialog").inner_text()[-900:].replace(chr(10), " | "))
        rt.shot(coord, f"{SLUG}-04")
        coord.get_by_role("dialog").get_by_role("button", name="Cancel").click()
        coord.set_viewport_size({"width": 1366, "height": 768})

    rt.step("Try to drop with 10% unexcused absences", refused)

    def accepted():
        _open_student(rt, coord)
        row_btn = coord.get_by_role("button", name=f"Change {SUBJECT} student status")
        if row_btn.count() == 0:
            rt.note("subject already dropped in an earlier step; nothing left to drop")
            return
        _open_dialog(coord)
        _collapse_rules(coord)
        fill("25")
        rt.shot(coord, f"{SLUG}-05")
        coord.get_by_role("dialog").get_by_role("button", name=re.compile(r"^Save Dropped")).click()
        coord.wait_for_timeout(2500)
        rt.settle(coord)
        top(coord)
        rt.note("ACCEPTED: " + visible_text(coord, "main", 6000).split("Student")[0][-100:])
        coord.set_viewport_size({"width": 1366, "height": 768})
        rt.shot(coord, f"{SLUG}-06")

    rt.step("Drop with 25% unexcused absences", accepted)

    def after():
        _open_student(rt, coord)
        scroll_to(coord, "Official offered subjects", offset=90, exact=True)
        rows = []
        for r in coord.locator("tbody tr").all():
            tx = r.inner_text().replace(chr(10), " ")
            if "MAED-" in tx:
                rows.append(tx[:110])
        rt.note("ROWS AFTER: " + " || ".join(rows))
        rt.shot(coord, f"{SLUG}-07")

    rt.step("Enrollment shows the dropped subject", after)

    def monitoring():
        rt.go(coord, "/monitoring-sheet")
        sels = coord.locator("select")
        opts = sels.nth(0).locator("option").all_inner_texts()
        sels.nth(0).select_option(label=next(o for o in opts if o.startswith("MAED")))
        coord.wait_for_timeout(800)
        topts = sels.nth(1).locator("option").all_inner_texts()
        sels.nth(1).select_option(label=next(o for o in topts if CURRENT in o))
        rt.settle(coord)
        row = coord.locator("tr", has_text="GS-2026-WD-02").first
        row.scroll_into_view_if_needed()
        coord.evaluate("window.scrollBy(0, 180)")
        coord.wait_for_timeout(400)
        rt.note("MONITORING ROW: " + row.inner_text()[:300].replace(chr(10), " | "))
        rt.shot(coord, f"{SLUG}-08")

    rt.step("Monitoring Sheet shows the same subject as Dropped", monitoring)
