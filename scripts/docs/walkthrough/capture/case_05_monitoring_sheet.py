"""Case 05 - Monitoring Sheet: add a student, add / edit / remove subject rows, provenance and change history."""
from __future__ import annotations

import re
import time

from .common import Runtime
from .helpers_a1 import asc, goto_nav, wait_loaded, safe_notes

SLUG = "monitoring-sheet"
PROGRAM = "MSN"


def s(n: int) -> str:
    return f"{SLUG}-{n:02d}"


def pick_program(page, code: str) -> None:
    sel = page.get_by_label("Program")
    label = [o for o in sel.locator("option").all_inner_texts() if o.startswith(code)][0]
    sel.select_option(label=label)
    wait_loaded(page)


def panel(page):
    return page.get_by_role("dialog")


def run(rt: Runtime) -> None:
    safe_notes(rt)
    stamp = time.strftime("%H%M%S")
    last = f"Monitor{stamp}"
    first = "Dana"
    idno = "9" + stamp
    rt.note(f"new student: {first} {last}, IDNO {idno}, program {PROGRAM}")
    page = rt.new_page("staff@usls.edu.ph")

    def open_sheet():
        goto_nav(rt, page, "Monitoring Sheet", "/monitoring-sheet")
        page.get_by_role("heading", name="Monitoring Sheet").first.wait_for()
        pick_program(page, PROGRAM)
        rt.note("sheet: " + page.locator("main").inner_text()[:300].replace("\n", " | "))
        rt.shot(page, s(1))
    rt.step("open Monitoring Sheet, choose MSN", open_sheet)

    def add_dialog():
        page.get_by_role("button", name="Add student").first.click()
        panel(page).wait_for()
        page.wait_for_timeout(500)
        rt.shot(page, s(2))
    rt.step("open Add student", add_dialog)

    def fill_student():
        d = panel(page)
        d.get_by_label("Student ID").fill(idno)
        d.get_by_label("First name").fill(first)
        d.get_by_label("Last name").fill(last)
        d.get_by_label(re.compile("School year")).fill("26-27")
        page.wait_for_timeout(400)
        rt.shot(page, s(3))
        d.get_by_role("button", name="Add student", exact=True).click()
        d.get_by_text(re.compile("was added to the")).wait_for(timeout=20000)
        rt.note("added: " + d.inner_text()[:500].replace("\n", " | "))
        page.wait_for_timeout(400)
        rt.shot(page, s(4))
    rt.step("fill and submit the new student", fill_student)

    def open_record():
        panel(page).get_by_role("button", name="Add subjects now").click()
        page.get_by_text(re.compile("curriculum subjects completed")).first.wait_for()
        page.wait_for_timeout(500)
        rt.shot(page, s(5))
    rt.step("Add subjects now: the record panel", open_record)

    def add_row(code: str, term: str, remarks: str, shot_id: str | None):
        d = panel(page)
        d.get_by_role("button", name=f"Add {code}", exact=True).click()
        f = page.get_by_role("form", name=f"Add {code}")
        f.wait_for()
        f.get_by_label("Status").select_option("Completed")
        f.get_by_label("Term taken").fill(term)
        f.get_by_label("Remarks").fill(remarks)
        page.wait_for_timeout(300)
        if shot_id:
            rt.shot(page, shot_id)
        f.get_by_role("button", name="Add row").click()
        page.get_by_role("form", name=f"Add {code}").wait_for(state="detached", timeout=15000)
        page.wait_for_timeout(800)

    rt.step("add subject row MSN-FED", lambda: add_row("MSN-FED", "AY 2025-2026 2nd Semester", "Credited from a transfer record", s(6)))
    rt.step("add subject row MSN-MOR", lambda: add_row("MSN-MOR", "AY 2025-2026 2nd Semester", "Credited from a transfer record", None))

    def rows_shot():
        rt.note("rows: " + panel(page).inner_text()[:900].replace("\n", " | "))
        rt.shot(page, s(7))
    rt.step("two manual rows with provenance", rows_shot)

    def edit_row():
        d = panel(page)
        d.get_by_role("button", name="Edit MSN-FED", exact=True).click()
        f = page.get_by_role("form", name="Edit MSN-FED")
        f.wait_for()
        f.get_by_label("Remarks").fill("Credited from a transfer record; verified against the transcript")
        page.wait_for_timeout(300)
        rt.shot(page, s(8))
        f.get_by_role("button", name="Save changes").click()
        page.get_by_role("form", name="Edit MSN-FED").wait_for(state="detached", timeout=15000)
        page.wait_for_timeout(800)
    rt.step("edit the remarks of MSN-FED", edit_row)

    def remove_row():
        d = panel(page)
        d.get_by_role("button", name="Remove MSN-MOR", exact=True).click()
        page.get_by_text(re.compile("Remove MSN-MOR\\?")).wait_for()
        dlg = page.get_by_role("dialog").last
        dlg.get_by_label(re.compile("Reason")).fill("Entered by mistake: the subject was not credited")
        page.wait_for_timeout(300)
        rt.shot(page, s(9))
        dlg.get_by_role("button", name="Remove row").click()
        page.get_by_text(re.compile("Remove MSN-MOR\\?")).wait_for(state="detached", timeout=15000)
        page.wait_for_timeout(1000)
        rt.note("after remove: " + panel(page).inner_text()[:500].replace("\n", " | "))
        rt.shot(page, s(10))
    rt.step("remove the MSN-MOR row with a reason", remove_row)

    def history():
        panel(page).get_by_role("tab", name=re.compile("Change history")).click()
        page.wait_for_timeout(1500)
        rt.note("history: " + asc(panel(page).inner_text()[:1500].replace("\n", " | ")))
        rt.shot(page, s(11))
    rt.step("Change history tab", history)

    def back_to_grid():
        page.get_by_role("button", name="Close record panel").click()
        page.wait_for_timeout(800)
        page.get_by_role("button", name=re.compile(f"monitoring record of {last}")).first.scroll_into_view_if_needed()
        page.wait_for_timeout(500)
        rt.shot(page, s(12))
    rt.step("new student appears in the grid, marked Manual", back_to_grid)

    def imported_row():
        # an imported student: editing an imported value needs a reason (nothing is saved here)
        page.get_by_role("button", name=re.compile("monitoring record of Cabrera, Katrina")).first.click()
        d = panel(page)
        d.get_by_text(re.compile("curriculum subjects completed")).first.wait_for()
        page.wait_for_timeout(600)
        rt.note("imported record: " + d.inner_text()[:700].replace("\n", " | "))
        rt.shot(page, s(13))
        d.get_by_role("button", name=re.compile(r"^Edit MSN-", re.I)).first.click()
        page.wait_for_timeout(600)
        rt.note("imported edit form: " + d.inner_text()[:900].replace("\n", " | "))
        rt.shot(page, s(14))
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        page.keyboard.press("Escape")
    rt.step("imported student: provenance and reason required to change an imported value", imported_row)

    page.context.close()
