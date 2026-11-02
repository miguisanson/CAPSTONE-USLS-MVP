"""Case 10 - Leave of Absence (Daniel Fernandez) on the shared staged board (drag and drop works in the real UI)."""
from __future__ import annotations

import re

from .common import main_text
from .helpers_a3 import column_holds, drag_card, open_link

KEY = "leave-of-absence-daniel"
EMAIL = "loa.daniel@usls.edu.ph"
SLUG = "leave-of-absence"
WHO = "Daniel"
REASON = "Employment / professional obligation"
REMARKS = "I have accepted a work assignment in another city and cannot carry a study load for the next two semesters."
STAFF_NOTE = "Two semesters is within the handbook limit and no earlier leave is on record. The minimum-residency check is a prototype rule, so the Dean should confirm."
DEAN_COMMENT = "Approved for two semesters. The student is to file a readmission request before the leave ends."


def search(page, rt, text: str) -> None:
    page.locator("input[type=search]").first.fill(text)
    rt.settle(page, 800)


def frame(page, first_column: str | None = None, up: int = 110) -> None:
    """Scroll so the search row and the board columns show together, first_column left-most."""
    page.evaluate(
        """([first, up]) => {
            const region = document.querySelector('[role=region][aria-label*="board" i]');
            if (!region) return;
            const box = document.querySelector('input[type=search]');
            (box || region).scrollIntoView({block: 'start'});
            window.scrollBy(0, -up); // the page itself scrolls (no inner scroller)
            if (first) {
                const sec = [...region.querySelectorAll('section[aria-label]')].find(x => x.getAttribute('aria-label') === first);
                if (sec) region.scrollLeft += sec.getBoundingClientRect().left - region.getBoundingClientRect().left - 8;
            }
        }""",
        [first_column, up],
    )
    page.wait_for_timeout(600)


def close_details(page) -> None:
    btn = page.get_by_role("button", name="Close details")
    if btn.count():
        btn.first.click()
        page.wait_for_timeout(500)


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
        student.wait_for_timeout(800)
        rt.shot(student, f"{S}-04")  # the "Send this request?" box
        dlg = student.locator("[role=dialog]").last
        dlg.get_by_role("button", name="Send request").click()
        rt.settle(student, 2200)
        student.evaluate("window.scrollTo(0,0)")
        rt.shot(student, f"{S}-05", full=True)

    rt.step("student sends the request", student_submit)
    print(main_text(student, 900).replace("\n", " | "))

    # ---- Part B: staff on the Leave of Absence board ---------------------------------
    staff = rt.new_page("staff@usls.edu.ph")

    def staff_open():
        open_link(rt, staff, "Leave of Absence", f"/workflow/{SLUG}")
        search(staff, rt, WHO)
        frame(staff, "Submitted")
        rt.shot(staff, f"{S}-06")

    rt.step("staff opens the Leave of Absence board and finds Daniel", staff_open)

    def staff_drag():
        drag_card(rt, staff, WHO, "In staff review")
        assert column_holds(staff, "In staff review", WHO), "card did not land in In staff review"
        frame(staff, "Submitted")
        rt.shot(staff, f"{S}-07")

    rt.step("staff drags the card to In staff review", staff_drag)

    def staff_table():
        staff.get_by_role("button", name="Table").click()
        rt.settle(staff, 800)
        staff.get_by_role("table").first.evaluate("el => el.scrollIntoView({block: 'center'})")
        staff.wait_for_timeout(400)
        rt.shot(staff, f"{S}-08")
        staff.get_by_role("button", name="Board").click()
        rt.settle(staff, 600)

    rt.step("staff switches to Table and back to Board", staff_table)

    def staff_details():
        frame(staff, "Submitted")
        staff.get_by_role("button", name=re.compile("View details for Daniel")).first.click()
        rt.settle(staff, 1500)
        rt.shot(staff, f"{S}-09")
        staff.get_by_text("Policy check", exact=True).first.evaluate("el => el.scrollIntoView({block: 'start'})")
        staff.wait_for_timeout(500)
        rt.shot(staff, f"{S}-10")

    rt.step("staff opens the request and reads the policy check", staff_details)

    def staff_forward():
        staff.locator("[role=dialog]").last.get_by_role("button", name="Forward to Dean").click()
        staff.wait_for_timeout(1200)
        dlg = staff.locator("[role=dialog]").last
        dlg.locator("textarea").first.fill(STAFF_NOTE)
        rt.note("forward dialog: " + " | ".join(dlg.inner_text().split("\n"))[:700])
        rt.shot(staff, f"{S}-11")
        dlg.get_by_role("button", name="Forward to Dean", exact=True).click()
        rt.settle(staff, 1800)
        close_details(staff)
        frame(staff, "Submitted")
        rt.shot(staff, f"{S}-12")

    rt.step("staff forwards to the Dean", staff_forward)

    # ---- Part C: Dean decides ---------------------------------------------------------
    dean = rt.new_page("dean@usls.edu.ph")

    def dean_decide():
        dean.get_by_role("link", name=re.compile(r"^Leave of Absence")).first.click()
        rt.settle(dean, 2500)
        search(dean, rt, WHO)
        frame(dean, "With the Dean")
        rt.shot(dean, f"{S}-13")
        drag_card(rt, dean, WHO, "Leave scheduled")
        dean.wait_for_timeout(800)
        dlg = dean.locator("[role=dialog]").last
        dlg.locator("textarea").first.fill(DEAN_COMMENT)
        rt.note("dean dialog: " + " | ".join(dlg.inner_text().split("\n"))[:600])
        rt.shot(dean, f"{S}-14")
        dlg.get_by_role("button", name="Approve", exact=True).click()
        rt.settle(dean, 2200)
        frame(dean, "With the Dean")
        rt.shot(dean, f"{S}-15")

    rt.step("Dean drags the card to Leave scheduled and approves", dean_decide)

    # ---- staff starts the leave, Registrar list ---------------------------------------
    def staff_board_again():
        rt.go(staff, f"/workflow/{SLUG}")
        search(staff, rt, WHO)
        frame(staff, "With the Dean")
        rt.shot(staff, f"{S}-16")

    rt.step("staff sees the approved request in Leave scheduled", staff_board_again)

    def staff_start():
        drag_card(rt, staff, WHO, "On leave")
        staff.wait_for_timeout(800)
        dlg = staff.locator("[role=dialog]").last
        rt.note("start dialog: " + " | ".join(dlg.inner_text().split("\n"))[:500])
        rt.shot(staff, f"{S}-17")
        dlg.get_by_role("button", name="Start the leave now", exact=True).click()
        rt.settle(staff, 1800)
        frame(staff, "With the Dean")
        rt.shot(staff, f"{S}-18")

    rt.step("staff drags the card to On leave and starts the leave", staff_start)

    def staff_registrar():
        staff.get_by_role("heading", name="Registrar list").first.evaluate("el => el.scrollIntoView({block: 'start'})")
        staff.wait_for_timeout(600)
        rt.shot(staff, f"{S}-19")

    rt.step("staff sees the Registrar list", staff_registrar)

    def staff_download():
        with staff.expect_download(timeout=20000) as info:
            staff.get_by_role("button", name=re.compile(r"Download list \(CSV\)")).click()
        rt.note(f"downloaded {info.value.suggested_filename}")
        staff.wait_for_timeout(1500)
        rt.shot(staff, f"{S}-20")
        rt.note("export dialog: " + " | ".join(staff.locator("[role=dialog]").last.inner_text().split("\n"))[:600])

    rt.step("staff downloads the Registrar list (CSV)", staff_download)

    def staff_mark():
        dlg = staff.locator("[role=dialog]")
        if dlg.count():
            dlg.last.get_by_role("button", name=re.compile("Close|Done|OK", re.I)).first.click()
            staff.wait_for_timeout(600)
        staff.get_by_role("checkbox", name=re.compile("Tick Daniel")).check()
        staff.get_by_role("button", name="Mark as sent").click()
        rt.settle(staff, 1500)
        staff.get_by_role("heading", name="Registrar list").first.evaluate("el => el.scrollIntoView({block: 'start'})")
        staff.wait_for_timeout(500)
        rt.shot(staff, f"{S}-21")

    rt.step("staff marks the list as sent", staff_mark)

    def student_result():
        rt.go(student, f"/student/requests/{SLUG}")
        rt.shot(student, f"{S}-22")

    rt.step("student sees the leave", student_result)
