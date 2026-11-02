"""Case 04 - Policy Assistant, asked live in four role portals (staff, student, Dean, faculty)."""
from __future__ import annotations

import re

from .common import Runtime
from .helpers_a1 import goto_nav, scroll_to, scroll_top, wait_loaded, safe_notes

SLUG = "policy-assistant"


def s(n: int) -> str:
    return f"{SLUG}-{n:02d}"


Q_DAY1 = "Can a student withdraw a subject on Day 1, and how much is the fee?"
Q_RESIDENCE = "What is the maximum residence for a master's program?"
Q_LOA_RES = "Is time on leave of absence included in the maximum years to finish a master's degree?"
Q_ADD = "Adding a subject is allowed until when?"
Q_LEAVE = "Can I file a leave of absence during the last two weeks of the semester?"
Q_ABSENCE = "What happens when a student is absent more than 20 percent of the class hours?"
Q_ADVISEES = "How many advisees can a faculty member handle in a semester?"
Q_NOT_COVERED = "What is the cafeteria menu today?"
Q_ATTENTION = "Which students need attention right now?"
Q_NEXT = "What is my next step?"


def wait_not_busy(page, seconds: int = 90) -> None:
    page.wait_for_timeout(900)
    for _ in range(seconds * 2):
        busy = page.get_by_text("Looking through the policy documents").count()
        if not busy:
            break
        page.wait_for_timeout(500)
    page.wait_for_timeout(500)


def ask_chat(rt: Runtime, page, question: str, shot_id: str, *, chip: bool = False, top: bool = False) -> str:
    """Chat page of every role: type the question and press Enter (or tap the suggested question when ``chip``),
    then show question + answer + sources."""
    if chip:
        page.get_by_role("button", name=question, exact=True).click()
    else:
        page.get_by_label("Your question").click()
        page.get_by_label("Your question").type(question, delay=12)
        page.keyboard.press("Enter")
    wait_not_busy(page)
    log = page.get_by_role("log")
    text = log.inner_text()
    answer = text[text.rfind(question) + len(question):].strip()
    rt.note(f"ANSWER to '{question}': " + answer[:900].replace("\n", " | "))
    # Show the last question at the top of the chat box when its answer and sources fit; otherwise show the end of the answer.
    scroll_to(page.get_by_test_id("assistant-chat"), 24)
    page.get_by_role("log").get_by_text(question, exact=True).last.evaluate(
        """(e, top) => { const row = e.closest('div.flex.justify-end') || e.parentElement; const box = row.parentElement;
        const rel = row.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
        const after = box.scrollHeight - rel;
        box.scrollTop = (top || after <= box.clientHeight + 4) ? rel - 12 : box.scrollHeight; }""",
        top,
    )
    page.wait_for_timeout(300)
    rt.shot(page, shot_id)
    return answer


def run(rt: Runtime) -> None:
    safe_notes(rt)
    # ---- staff ----------------------------------------------------------------
    staff = rt.new_page("staff@usls.edu.ph")

    def open_staff():
        goto_nav(rt, staff, "Policy Assistant", "/assistant")
        staff.get_by_label("Your question").wait_for()
        rt.note("staff assistant heading: " + staff.get_by_role("heading").first.inner_text())
        scroll_to(staff.get_by_test_id("assistant-chat"), 24)
        rt.shot(staff, s(1))
    rt.step("staff: open Policy Assistant", open_staff)

    rt.step("staff: Day 1 withdrawal question", lambda: ask_chat(rt, staff, Q_DAY1, s(2)))

    def open_source():
        summ = staff.get_by_role("log").locator("summary").last
        summ.scroll_into_view_if_needed()
        summ.click()
        staff.wait_for_timeout(600)
        rt.note("source opened: " + staff.get_by_role("log").inner_text()[-900:].replace(chr(10), " | "))
        staff.get_by_role("log").evaluate("e => { e.scrollTop = e.scrollHeight; }")
        rt.shot(staff, s(9))
    rt.step("staff: open the cited source to see the exact passage", open_source)
    rt.step("staff: leave of absence and maximum residence question", lambda: ask_chat(rt, staff, Q_LOA_RES, s(3)))
    rt.step("staff: adding a subject question", lambda: ask_chat(rt, staff, Q_ADD, s(4)))
    rt.step("staff: question the library does not answer", lambda: ask_chat(rt, staff, Q_NOT_COVERED, s(10)))
    rt.step("staff: suggested question about students needing attention", lambda: ask_chat(rt, staff, Q_ATTENTION, s(11), chip=True, top=True))

    # ---- student ----------------------------------------------------------------
    def student_flow():
        student = rt.new_page("student@usls.edu.ph")
        try:
            goto_nav(rt, student, "Policy Assistant", "/student/assistant")
            student.get_by_label("Your question").wait_for()
            rt.note("student page: " + student.locator("main").inner_text()[:1500].replace(chr(10), " | "))
            scroll_to(student.get_by_test_id("assistant-chat"), 24)
            rt.shot(student, s(5))
            ask_chat(rt, student, Q_LEAVE, s(6))
            ask_chat(rt, student, Q_NEXT, s(12), chip=True)
        finally:
            student.context.close()
    rt.step("student: leave-of-absence question, then the personal next-step question", student_flow)

    # ---- Dean ---------------------------------------------------------------------
    def dean_flow():
        dean = rt.new_page("dean@usls.edu.ph")
        try:
            goto_nav(rt, dean, "Policy Assistant", "/dean/assistant")
            dean.get_by_label("Your question").wait_for()
            ask_chat(rt, dean, Q_RESIDENCE, s(7))
        finally:
            dean.context.close()
    rt.step("Dean: maximum residence question", dean_flow)

    # ---- faculty --------------------------------------------------------------------
    def faculty_flow():
        fac = rt.new_page("liwayway.bautista@usls.edu.ph")
        try:
            goto_nav(rt, fac, "Policy Assistant", "/faculty-portal/assistant")
            fac.get_by_label("Your question").wait_for()
            ask_chat(rt, fac, Q_ADVISEES, s(8))
        finally:
            fac.context.close()
    rt.step("faculty: advisee limit question", faculty_flow)

    staff.context.close()
