"""Case 16 - Calendars for every role (staff, Dean, faculty, student), private calendar feed, bell, adviser appointment.

Reads the same defense (Gab Tolentino, else Bea Salonga, else Nico Barrientos) from each role's point of view.
Nothing here changes scheduling data; the only write is creating the faculty member's private calendar link.
"""
from __future__ import annotations

import json
import re
import urllib.request

from . import helpers_a5 as h
from .common import BASE, SHOTS, Runtime

SLUG = "calendars"
NAMES = ("Tolentino", "Salonga", "Barrientos")


def sid(n: int) -> str:
    return f"{SLUG}-{n:02d}"


def open_event(page) -> str:
    """Click one defense in the calendar that is on screen; return its visible label."""
    for name in NAMES:
        loc = page.get_by_role("button", name=re.compile(name))
        if loc.count():
            label = loc.first.inner_text()
            loc.first.scroll_into_view_if_needed()
            loc.first.click()
            page.wait_for_timeout(900)
            return label
    raise RuntimeError("no defense visible in this period")


def run(rt: Runtime) -> None:
    facts: dict = {}

    # ---- Part A: staff calendar -------------------------------------------------------------------
    staff = rt.new_page(h.STAFF)

    def staff_calendar():
        try:
            staff.get_by_role("link", name=re.compile("Defense Calendar$")).first.click(timeout=5000)
            rt.settle(staff)
        except Exception:  # noqa: BLE001
            rt.go(staff, "/calendar")
        facts["staff_text"] = h.page_text(staff, 3500)
        rt.shot(staff, sid(1))
        facts["staff_event"] = open_event(staff)
        facts["staff_detail"] = h.page_text(staff, 6000)
        rt.shot(staff, sid(2))
    rt.step("A1 staff opens the calendar and selects a defense", staff_calendar)

    def staff_filter():
        staff.get_by_label("Status").select_option(label="Everything")
        staff.wait_for_timeout(1500)
        staff.get_by_role("button", name="Agenda").click()
        staff.wait_for_timeout(1500)
        facts["staff_agenda"] = h.page_text(staff, 8000)
        rt.shot(staff, sid(3), full=True)
    rt.step("A2 staff filters Everything in the agenda view", staff_filter)

    # ---- Part B: Dean -----------------------------------------------------------------------------
    dean = rt.new_page(h.DEAN)

    def dean_calendar():
        rt.go(dean, "/dean/calendar")
        rt.shot(dean, sid(4))
        facts["dean_event"] = open_event(dean)
        rt.shot(dean, sid(5))
    rt.step("B1 Dean opens the read-only calendar", dean_calendar)

    # ---- Part C: faculty ---------------------------------------------------------------------------
    cruz = rt.new_page(h.FAC["cruz"])

    def faculty_calendar():
        rt.go(cruz, "/faculty-portal/calendar")
        rt.shot(cruz, sid(6))
        cruz.get_by_role("button", name="Month").click()
        cruz.wait_for_timeout(1500)
        facts["cruz_month"] = h.page_text(cruz, 3000)
        rt.shot(cruz, sid(7))
        facts["cruz_event"] = open_event(cruz)
        facts["cruz_detail"] = h.page_text(cruz, 6000)
        rt.shot(cruz, sid(8))
    rt.step("C1 faculty 'My calendar' week, month and a defense", faculty_calendar)

    def availability_editor():
        rt.go(cruz, "/faculty-portal/availability")
        facts["cruz_availability"] = h.page_text(cruz, 5000)
        rt.shot(cruz, sid(9))
    rt.step("C2 faculty availability editor", availability_editor)

    # ---- Part D: private calendar feed -------------------------------------------------------------
    def feed():
        rt.go(cruz, "/faculty-portal/calendar")
        h.scroll_to_text(cruz, "Subscribe to this calendar")
        create = cruz.get_by_role("button", name=re.compile("Create my private link", re.I))
        if create.count():
            create.first.click()
            cruz.wait_for_timeout(2000)
        h.scroll_to_text(cruz, "Subscribe to this calendar")
        url = cruz.locator("#calendar-feed-url").input_value()
        facts["feed_url"] = url
        rt.shot(cruz, sid(10))
        with urllib.request.urlopen(url if url.startswith("http") else BASE + url, timeout=60) as resp:
            body = resp.read().decode("utf-8", "replace")
            facts["feed_content_type"] = resp.headers.get("Content-Type")
        facts["feed_head"] = body[:900]
        facts["feed_events"] = body.count("BEGIN:VEVENT")
    rt.step("D1 faculty creates the private calendar link and the link is read back", feed)

    # ---- Part E: student ---------------------------------------------------------------------------
    student = rt.new_page("student@usls.edu.ph")

    def student_calendar():
        rt.go(student, "/student/calendar")
        facts["student_text"] = h.page_text(student, 3500)
        rt.shot(student, sid(11))
        facts["student_bell"] = h.bell_text(student)
        rt.shot(student, sid(12))
    rt.step("E1 student research calendar and bell", student_calendar)

    # ---- Part F: bells after scheduling ------------------------------------------------------------
    def faculty_bell():
        rt.go(cruz, "/faculty-portal")
        facts["cruz_bell"] = h.bell_text(cruz)
        rt.shot(cruz, sid(13))
    rt.step("F1 faculty notification bell", faculty_bell)

    # ---- Part G: adviser appointment (read-only tour) ------------------------------------------------
    def adviser_staff():
        rt.go(staff, "/adviser-appointments")
        facts["adviser_staff"] = h.page_text(staff, 2500)
        rt.shot(staff, sid(14))
    rt.step("G1 staff adviser appointment screen", adviser_staff)

    def adviser_student():
        rt.go(student, "/student/adviser")
        facts["adviser_student"] = h.page_text(student, 2500)
        rt.shot(student, sid(15))
    rt.step("G2 student adviser page", adviser_student)

    liway = rt.new_page("liwayway.bautista@usls.edu.ph")

    def adviser_faculty():
        rt.go(liway, "/faculty-portal/advisees")
        facts["adviser_faculty"] = h.page_text(liway, 1500)
        rt.shot(liway, sid(16))
    rt.step("G3 faculty advisees page", adviser_faculty)

    (SHOTS / "_facts_16.json").write_text(json.dumps(facts, indent=1, default=str), encoding="utf-8")
