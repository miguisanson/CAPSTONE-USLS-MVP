"""Case 16 - Calendars for every role (staff, faculty with the Google Calendar card, student), private calendar link, bell.

Reads the same defense (Gab Tolentino, else Bea Salonga, else Nico Barrientos) from the staff, faculty and student points of view.
Nothing here changes scheduling data; the only write is creating the staff member's private calendar link.
The server has no Google OAuth keys, so the faculty Connect Google Calendar button opens the "Integration preview" dialog:
the capture only shows it (and closes it with Not now); no Google account is ever connected.
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


def snap(rt: Runtime, page, shot_id: str, **kw) -> None:
    """rt.shot with a retry: Windows now and then refuses to write a PNG that a scanner has just opened."""
    for _ in range(4):
        try:
            rt.shot(page, shot_id, **kw)
            return
        except OSError:
            page.wait_for_timeout(1500)
    rt.shot(page, shot_id, **kw)


def centre(page, locator) -> None:
    locator.first.evaluate("e => e.scrollIntoView({block: 'center'})")
    page.wait_for_timeout(500)


def open_event(page) -> str:
    """Click one defense in the calendar that is on screen; return its visible label."""
    try:
        page.get_by_role("button", name=re.compile("|".join(NAMES))).first.wait_for(timeout=12000)
    except Exception:  # noqa: BLE001
        pass
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
        h.open_defense_scheduling(rt, staff)
        staff.get_by_role("tab", name=re.compile("Calendar")).first.click(timeout=8000)
        rt.settle(staff)
        facts["staff_text"] = h.page_text(staff, 3500)
        snap(rt, staff, sid(1))
        facts["staff_event"] = open_event(staff)
        facts["staff_detail"] = h.page_text(staff, 6000)
        h.scroll_to_text(staff, "26912", offset=110)
        snap(rt, staff, sid(2))
    rt.step("A1 staff opens the Calendar tab and selects a defense", staff_calendar)

    def staff_filter():
        staff.evaluate("window.scrollTo(0, 0); document.querySelector('main')?.scrollTo(0, 0)")
        staff.get_by_label("Status").select_option(label="Everything")
        staff.wait_for_timeout(1500)
        staff.get_by_role("button", name="Agenda").click()
        staff.wait_for_timeout(1500)
        facts["staff_agenda"] = h.page_text(staff, 8000)
        snap(rt, staff, sid(3), full=True)
    rt.step("A2 staff filters Everything in the agenda view", staff_filter)

    # ---- Part B: private calendar link (staff and student pages carry it; faculty use the Google card) ------
    def feed():
        staff.get_by_role("button", name="Month").click()
        staff.wait_for_timeout(1200)
        create = staff.get_by_role("button", name=re.compile("Create my private link", re.I))
        if create.count():
            create.first.click()
            staff.wait_for_timeout(2000)
        staff.get_by_text("Subscribe to this calendar").first.wait_for(timeout=15000)
        url = staff.locator("#calendar-feed-url").input_value()
        facts["feed_url"] = url
        facts["feed_card"] = staff.locator("#calendar-feed-url").locator("xpath=ancestor::div[contains(@class,'card')][1]").inner_text()
        centre(staff, staff.locator("#calendar-feed-url"))
        snap(rt, staff, sid(4))
        with urllib.request.urlopen(url if url.startswith("http") else BASE + url, timeout=60) as resp:
            body = resp.read().decode("utf-8", "replace")
            facts["feed_content_type"] = resp.headers.get("Content-Type")
        facts["feed_head"] = body[:900]
        facts["feed_events"] = body.count("BEGIN:VEVENT")
    rt.step("B1 staff creates the private calendar link and the link is read back", feed)

    # ---- Part C: faculty ---------------------------------------------------------------------------
    cruz = rt.new_page(h.FAC["cruz"])

    def faculty_calendar():
        rt.go(cruz, "/faculty-portal/calendar")
        facts["cruz_week"] = h.page_text(cruz, 3000)
        snap(rt, cruz, sid(5))
        cruz.get_by_role("button", name="Month").click()
        cruz.wait_for_timeout(1500)
        facts["cruz_month"] = h.page_text(cruz, 3000)
        snap(rt, cruz, sid(6))
        facts["cruz_event"] = open_event(cruz)
        facts["cruz_detail"] = h.page_text(cruz, 6000)
        h.scroll_to_text(cruz, "26912", offset=110)
        snap(rt, cruz, sid(7))
    rt.step("C1 faculty My Calendar: week, month and a defense", faculty_calendar)

    def google_preview():
        rt.go(cruz, "/faculty-portal/calendar")
        card = cruz.get_by_label("Google Calendar connection")
        facts["google_card"] = card.inner_text()
        cruz.get_by_role("button", name="Connect Google Calendar").click()
        cruz.get_by_role("dialog").wait_for(timeout=10000)
        cruz.wait_for_timeout(600)
        facts["google_preview"] = cruz.get_by_role("dialog").inner_text()
        snap(rt, cruz, sid(8))
        cruz.get_by_role("button", name="Not now").click()  # nothing is connected; the preview only explains the permission step
        cruz.wait_for_timeout(800)
        facts["google_after"] = card.inner_text()
    rt.step("C2 faculty selects Connect Google Calendar (keyless: Integration preview dialog)", google_preview)

    def availability_editor():
        rt.go(cruz, "/faculty-portal/availability")
        facts["cruz_availability"] = h.page_text(cruz, 5000)
        snap(rt, cruz, sid(9))
    rt.step("C3 faculty My Availability", availability_editor)

    def faculty_dashboard():
        rt.go(cruz, "/faculty-portal")
        facts["cruz_dashboard"] = h.page_text(cruz, 3000)
        snap(rt, cruz, sid(10))
        facts["cruz_bell"] = h.bell_text(cruz)
        snap(rt, cruz, sid(11))
    rt.step("C4 faculty dashboard line for Google Calendar and the notification bell", faculty_dashboard)

    # ---- Part D: student ---------------------------------------------------------------------------
    student = rt.new_page("student@usls.edu.ph")

    def student_calendar():
        rt.go(student, "/student/calendar")
        facts["student_text"] = h.page_text(student, 3500)
        snap(rt, student, sid(12))
        facts["student_bell"] = h.bell_text(student)
        snap(rt, student, sid(13))
    rt.step("D1 student Research Calendar and bell", student_calendar)

    (SHOTS / "_facts_16.json").write_text(json.dumps(facts, indent=1, default=str), encoding="utf-8")
