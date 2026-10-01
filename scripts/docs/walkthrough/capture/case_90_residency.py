"""Case 90 - Residency (Nicolas Valdez), reference."""
from __future__ import annotations

import re

from .helpers_a3 import open_link

KEY = "residency-nicolas"
NOTE = "Thesis writing continues without subject enrollment; adviser confirmed progress this semester."


def run(rt):
    S = "residency"
    rt.step("reset Nicolas", lambda: rt.reset(KEY))
    staff = rt.new_page("staff@usls.edu.ph")

    def pick_and_check():
        open_link(rt, staff, "AWOL & Residency", "/workflow/awol")
        rt.settle(staff, 1500)
        rt.shot(staff, f"{S}-01")
        staff.get_by_role("button", name="Record residency").first.click()
        staff.wait_for_timeout(1000)
        dlg = staff.locator("[role=dialog]").last
        dlg.get_by_placeholder(re.compile("Search all students")).fill("Valdez")
        rt.settle(staff, 1500)
        dlg.get_by_role("button", name=re.compile("Nicolas Valdez")).first.click()
        staff.wait_for_timeout(800)
        dlg.get_by_label(re.compile("Residency purpose", re.I)).select_option(label="Thesis / dissertation work")
        dlg.get_by_label(re.compile(r"^Semester", re.I)).select_option(label="AY 2026-2027 1st Semester")
        dlg.get_by_label(re.compile("Staff verification notes", re.I)).fill(NOTE)
        rt.shot(staff, f"{S}-02")
        dlg.get_by_role("button", name="Run residency policy checker").click()
        rt.settle(staff, 1800)
        rt.note("checker: " + " | ".join(dlg.inner_text().split())[-1600:])
        dlg.get_by_text(re.compile("policy", re.I)).last.scroll_into_view_if_needed()
        rt.shot(staff, f"{S}-03")

    rt.step("staff selects Nicolas, chooses purpose and semester, runs the checker", pick_and_check)

    def record():
        dlg = staff.locator("[role=dialog]").last
        dlg.get_by_role("button", name="Record residency").click()
        rt.settle(staff, 2200)
        rt.note("after record: " + " | ".join(staff.locator("main").inner_text().split())[:900])
        rt.shot(staff, f"{S}-04")

    rt.step("staff records the residency", record)

    def case_board():
        rt.go(staff, "/workflow/awol")
        staff.get_by_role("textbox", name=re.compile("Search", re.I)).first.fill("Nicolas")
        rt.settle(staff, 1000)
        staff.get_by_role("heading", name="Residency", exact=True).first.evaluate("el => el.scrollIntoView({block: 'center', inline: 'center'})")
        staff.wait_for_timeout(500)
        rt.shot(staff, f"{S}-05")
        staff.get_by_role("button", name="View details").first.click()
        rt.settle(staff, 1200)
        rt.shot(staff, f"{S}-06")
        rt.note("residency view: " + " | ".join(staff.locator("[role=dialog]").last.inner_text().split())[:1500])
        staff.get_by_role("button", name="Close details").first.click()

    rt.step("staff finds the Residency card and opens it", case_board)

    def students():
        rt.go(staff, "/students")
        staff.get_by_placeholder(re.compile("Search", re.I)).first.fill("Valdez")
        rt.settle(staff, 1500)
        rt.shot(staff, f"{S}-07")
        rt.note("students row: " + " | ".join(staff.locator("main").inner_text().split("\n"))[:900])

    rt.step("Students directory shows Nicolas", students)
