"""Case 01b - Reset Demo: put a demo student back to the start.

Two real controls are shown: the red Reset button next to each student in the sign-in page's Demo accounts panel,
and the staff Reset demo case button inside the Practicum case window. Run with ``--only 01b``.
"""
from __future__ import annotations

import re

from .common import Runtime
from .helpers_a3 import make_pdf

SLUG = "reset-demo"
LOGIN_STUDENT = "Anton Bautista"   # student-handoff-anton: harmless to reset, always back at the start
PRACTICUM_STUDENT = "Andrea Villanueva"
PRACTICUM_EMAIL = "practicum.andrea@usls.edu.ph"


def s(n: int) -> str:
    return f"{SLUG}-{n:02d}"


def run(rt: Runtime) -> None:
    dialogs: list[str] = []

    # ---- 1. sign-in page: Demo accounts -> Student workflow demos -> Reset ---------------------------------
    page = rt.new_page(accept_dialogs=False)
    page.on("dialog", lambda d: (dialogs.append(d.message), d.accept()))

    def panel():
        rt.go(page, "/login")
        page.get_by_role("button", name=re.compile("Demo accounts", re.I)).first.click()
        page.get_by_text("Student workflow demos").first.wait_for()
        page.wait_for_timeout(600)
        rt.shot(page, s(1), full=True)
    rt.step("sign-in page: Demo accounts panel", panel)

    def group():
        page.get_by_role("button", name=re.compile(r"1 . Student Handoff", re.I)).first.click()
        page.wait_for_timeout(600)
        rt.shot(page, s(2), full=True)
    rt.step("open the Student Handoff group, the red Reset buttons", group)

    def reset():
        page.get_by_role("button", name=re.compile(f"Reset {LOGIN_STUDENT}", re.I)).first.click()
        page.get_by_text(re.compile(f"Reset {LOGIN_STUDENT}'s")).first.wait_for(timeout=60000)
        rt.note("confirm dialog: " + (dialogs[-1] if dialogs else "NONE").replace("\n", " | "))
        rt.note("notice: " + page.get_by_text(re.compile(f"Reset {LOGIN_STUDENT}'s")).first.inner_text())
        rt.shot(page, s(3), full=True)
    rt.step(f"press Reset for {LOGIN_STUDENT}, the notice", reset)
    page.context.close()

    # ---- 2. staff side: Reset demo case inside the Practicum case window ---------------------------------------
    moa = make_pdf("Andrea_Villanueva_Signed_MOA.pdf", "Memorandum of Agreement - Practicum",
                   [f"Student: {PRACTICUM_STUDENT} (MAPSY)", "Site: Demo Partner Center", "Supervisor: Ms. Demo Supervisor"])
    rt.step("start Andrea clean (a re-run leaves her case behind)", lambda: rt.reset("practicum-andrea"))
    student = rt.new_page(PRACTICUM_EMAIL)

    def submit_moa():
        rt.go(student, "/student/practicum")
        student.get_by_label("Practicum site / company").fill("Demo Partner Center")
        student.get_by_label("Supervisor name").fill("Ms. Demo Supervisor")
        student.locator("main input[type=file]").set_input_files(moa)
        student.get_by_label("Remarks for the reviewer").fill("Signed MOA with the partner center.")
        student.get_by_role("button", name="Submit MOA stage").click()
        student.get_by_role("dialog").get_by_role("button", name="Send request").click()
        rt.settle(student, 2000)
        rt.note("student page after submit: " + student.inner_text("main")[:500].replace("\n", " | "))
    rt.step("student submits a MOA so the staff board has a case to reset", submit_moa)
    student.context.close()

    staff = rt.new_page("staff@usls.edu.ph", accept_dialogs=False)
    staff.on("dialog", lambda d: (dialogs.append(d.message), d.accept()))

    def open_case():
        rt.go(staff, "/workflow/practicum")
        rt.note("practicum page: " + staff.inner_text("main")[:700].replace("\n", " | "))
        card = staff.locator("[draggable=true]").filter(has_text=PRACTICUM_STUDENT).first
        card.scroll_into_view_if_needed()
        staff.evaluate("window.scrollBy(0, 0)")
        rt.shot(staff, s(4))
        card.get_by_role("button", name=f"View details for {PRACTICUM_STUDENT}").click()
        rt.settle(staff, 1200)
        btn = staff.get_by_role("button", name="Reset demo case")
        btn.wait_for()
        btn.scroll_into_view_if_needed()
        rt.shot(staff, s(5))
    rt.step("staff opens the Practicum case window, the Reset demo case button", open_case)

    def press():
        n = len(dialogs)
        staff.get_by_role("button", name="Reset demo case").click()
        staff.get_by_text(re.compile(r"demo case\. The student can start")).first.wait_for(timeout=30000)
        rt.note("staff confirm dialog: " + (dialogs[n] if len(dialogs) > n else "NONE").replace("\n", " | "))
        rt.note("staff notice: " + staff.get_by_text(re.compile(r"demo case\. The student can start")).first.inner_text())
        rt.shot(staff, s(6))
    rt.step("press Reset demo case, the notice", press)
    staff.context.close()
