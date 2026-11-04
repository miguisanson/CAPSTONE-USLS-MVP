"""Demo part 2m - Best Features: the five things the portal does beyond storing records (rules with a source, the Policy
Assistant, explainable panel matching, defense scheduling that checks before booking, shared boards and computed
reports). Same ``run(rt)`` contract as the walkthrough capture cases; read-only: nothing is saved (the schedule form is
only filled in to show its checks, then left unsent)."""
from __future__ import annotations

import re

from capture import helpers_a1 as a1
from capture import helpers_a4 as a4
from capture import helpers_a5 as a5
from capture.case_04_policy_assistant import Q_DAY1, ask_chat
from capture.case_10_leave_of_absence import frame
from capture.common import Runtime


def s(n: int) -> str:
    return f"best-features-{n:02d}"


def run(rt: Runtime) -> None:
    a1.safe_notes(rt)
    staff = rt.new_page("staff@usls.edu.ph")

    # 1. Business Rules register: the rule, its Handbook / Protocol page, and a label.
    def register():
        a1.goto_nav(rt, staff, "Business Rules", "/business-rules")
        staff.get_by_role("heading", name=re.compile("Business rules", re.I)).first.wait_for()
        rt.shot(staff, s(1))
        staff.get_by_placeholder("Search rules or pages").fill("withdraw")
        staff.wait_for_timeout(500)
        a1.scroll_to(staff.get_by_placeholder("Search rules or pages"), 110)
        rt.shot(staff, s(2))
    rt.step("1 Business Rules: every rule with its page and a label", register)

    # 2. Policy Assistant: one question, an answer that names its source (offline answer: no Gemini key on this site).
    def assistant():
        a1.goto_nav(rt, staff, "Policy Assistant", "/assistant")
        staff.get_by_label("Your question").wait_for()
        ask_chat(rt, staff, Q_DAY1, s(3))
        summ = staff.get_by_role("log").locator("summary").last
        summ.scroll_into_view_if_needed()
        summ.click()
        staff.wait_for_timeout(400)
        staff.get_by_role("log").evaluate("e => { e.scrollTop = e.scrollHeight; }")
        rt.shot(staff, s(4))
    rt.step("2 Policy Assistant: question, cited answer, the exact passage", assistant)

    # 3. Panel Matching: ranked faculty, then the score breakdown of the top candidate (demo student PM-01, nothing saved).
    def panel():
        rt.go(staff, "/workflow/panel-matching")
        a4.pick_student(staff, "GS-2026-PM-01")
        table = staff.get_by_role("table", name="Ranked panel candidates")
        a4.scroll_to(staff, table, 70)
        rt.shot(staff, s(5))
        staff.get_by_text("Why this score").first.click()
        staff.wait_for_timeout(400)
        a4.scroll_to(staff, staff.get_by_text("How the score was built").first, 120)
        rt.shot(staff, s(6))
    rt.step("3 Panel Matching: ranked candidates and how the score was built", panel)

    # 4. Defense Scheduling: shared times, then a slot that is a hard stop and a warning at once (form left unsent).
    def scheduling():
        api = a5.Api(a5.STAFF)
        nico = a5.sched_state(api, a5.student_ids(api)["nico"])["active"]
        a5.open_defense_scheduling(rt, staff)
        a5.pick_student(rt, staff, "Salonga")
        staff.get_by_text(re.compile(r"[1-9]\d* conflict-free found")).first.wait_for(timeout=30000)  # the overlap loads after the picker
        a5.scroll_to_text(staff, "Best shared options")
        rt.shot(staff, s(7))
        a5.scroll_to_text(staff, "Final schedule")
        # Nico Barrientos' own booked slot, tried for another student: panel and room clash (hard) plus before the lead time (warning)
        a5.fill_slot(staff, nico["preferred_date"], nico["start_time"], nico["end_time"], nico["venue"])
        a5.scroll_to_text(staff, "Final schedule", offset=40)
        rt.shot(staff, s(8))
    rt.step("4 Defense Scheduling: best shared options, hard stop versus warning", scheduling)

    # 5. A staged board and the computed reports.
    def board():
        rt.go(staff, "/workflow/leave-of-absence")
        staff.locator('[role=region][aria-label*="board" i]').first.wait_for()
        Runtime.settle(staff, 900)
        frame(staff, "Submitted")
        rt.shot(staff, s(9))
    rt.step("5 a staged board: stages as columns, requests as cards", board)

    def reports():
        rt.go(staff, "/")
        staff.get_by_role("link", name=re.compile("Reports & Analytics")).first.click()
        staff.get_by_role("tab", name="Needs attention").wait_for()
        Runtime.settle(staff, 1500)
        a1.wait_loaded(staff)
        a1.scroll_top(staff)
        rt.shot(staff, s(10))
        a1.scroll_to(staff.get_by_text("What is holding students back?").first, 110)
        rt.shot(staff, s(11))
        rt.go(staff, "/")
        rt.shot(staff, s(12))
    rt.step("5 Reports and Analytics computed from the records", reports)
