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
        staff.get_by_placeholder(re.compile("Search all students")).fill("Valdez")
        rt.settle(staff, 1500)
        staff.get_by_role("button", name=re.compile("Nicolas Valdez")).first.click()
        staff.wait_for_timeout(800)
        selects = staff.locator("main select")
        labels = [s.evaluate("e => e.closest('label')?.innerText.split('\\n')[0] || ''") for s in selects.all()]
        rt.note(f"selects: {labels}")
        staff.get_by_label(re.compile("Residency purpose", re.I)).select_option(label="Thesis / dissertation work")
        staff.get_by_label(re.compile(r"^Semester", re.I)).select_option(label="AY 2026-2027 1st Semester")
        staff.get_by_label(re.compile("Staff verification notes", re.I)).fill(NOTE)
        rt.shot(staff, f"{S}-02", full=True)
        staff.get_by_role("button", name="Run residency policy checker").click()
        rt.settle(staff, 1800)
        rt.note("checker: " + " | ".join(staff.locator("main").inner_text().split("\n"))[1800:4200])
        staff.get_by_text(re.compile("policy", re.I)).last.scroll_into_view_if_needed()
        rt.shot(staff, f"{S}-03", full=True)

    rt.step("staff selects Nicolas, chooses purpose and semester, runs the checker", pick_and_check)

    def record():
        staff.get_by_role("button", name="Record residency").click()
        rt.settle(staff, 2200)
        rt.note("after record: " + " | ".join(staff.locator("main").inner_text().split("\n"))[1500:3000])
        staff.get_by_role("button", name="Record residency").scroll_into_view_if_needed()
        rt.shot(staff, f"{S}-04")

    rt.step("staff records the residency", record)

    def case_board():
        rt.go(staff, "/workflow/awol")
        staff.get_by_label(re.compile("Search AWOL")).fill("Nicolas")
        rt.settle(staff, 1000)
        staff.get_by_role("heading", name=re.compile("AWOL, return, and residency cases")).first.evaluate(
            "el => el.scrollIntoView({block: 'start'})")
        staff.get_by_role("heading", name="Residency", exact=True).first.scroll_into_view_if_needed()
        staff.wait_for_timeout(500)
        rt.shot(staff, f"{S}-05")
        staff.get_by_role("button", name="View", exact=True).first.click()
        rt.settle(staff, 1200)
        rt.shot(staff, f"{S}-06")
        rt.note("residency view: " + " | ".join(staff.locator("[role=dialog]").last.inner_text().split("\n"))[:1500])
        staff.get_by_role("button", name="Close details").first.click()

    rt.step("staff finds the Residency card and opens it", case_board)

    def students():
        rt.go(staff, "/students")
        staff.get_by_placeholder(re.compile("Search", re.I)).first.fill("Valdez")
        rt.settle(staff, 1500)
        rt.shot(staff, f"{S}-07")
        rt.note("students row: " + " | ".join(staff.locator("main").inner_text().split("\n"))[:900])

    rt.step("Students directory shows Nicolas", students)
