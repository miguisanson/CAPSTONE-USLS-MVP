"""Case 15 - Defense Scheduling: shared availability, conflict warnings, set the schedule, panel invitations.

Uses the demonstration student Gab Tolentino (GS-2026-UD-03, MBA, Proposal Defense, four-person panel
plus the research adviser). Every step is a real action on the real screens; the state that the run
needs (an active booking to cancel, an invited panelist) is read first so the module can be re-run
while those records are still in the same state.
"""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta

from . import helpers_a5 as h
from .common import Runtime

SLUG = "defense-scheduling"


def sid(n: int) -> str:
    return f"{SLUG}-{n:02d}"


def run(rt: Runtime) -> None:
    staff_api = h.Api(h.STAFF)
    ids = h.student_ids(staff_api)
    gab = ids["gab"]
    state = h.sched_state(staff_api, gab)
    if any(x.get("verdict") for x in state["schedules"] if x["defense_type"] == "Proposal Defense"):
        def _stop():
            raise RuntimeError("NEEDS A FRESH DATABASE: Gab Tolentino (GS-2026-UD-03) already holds a Proposal Defense verdict "
                               "(case 17 ran on this database); case 15 is skipped and the earlier screenshots are kept.")
        rt.step("precondition: demo student Gab Tolentino still unscored", _stop)
        return
    # Dates follow the server's own clock (the demo 'today' is 2026-10-01, earliest allowed date 2026-10-15)
    avail = state["ctx"].get("availability", {})
    today = date.fromisoformat(avail.get("today") or str(h.now_manila().date()))
    earliest = date.fromisoformat(avail.get("earliest_schedule_date") or str(today + timedelta(days=14)))

    def weekday_on_or_after(d: date) -> date:
        while d.weekday() >= 5:
            d += timedelta(days=1)
        return d

    NEW_DAY = str(weekday_on_or_after(earliest))
    BLOCK_DAY = str(weekday_on_or_after(earliest + timedelta(days=7)))        # Ramos blocks this day
    DECLINE_DAY = str(weekday_on_or_after(earliest + timedelta(days=1)))
    soft = weekday_on_or_after(today + timedelta(days=1))
    SOFT_DAY = str(soft if soft < earliest else today)                       # before the lead time
    rt.note(f"dates: new {NEW_DAY}, blocked {BLOCK_DAY}, soft {SOFT_DAY}, declined-check {DECLINE_DAY}")
    rt.note(f"Gab active booking before: {state['active'] and (state['active']['preferred_date'], state['active']['status'])}")

    staff = h.new_staff_page(rt)
    facts: dict = {}

    # ---- Part A: open the screen, read the readiness, panel, invitations and availability ---------
    def open_and_pick():
        h.open_defense_scheduling(rt, staff)
        rt.shot(staff, sid(1))  # the screen before a student is chosen
        h.pick_student(rt, staff, "Tolentino")
        h.scroll_to_text(staff, "Student readiness")
        rt.shot(staff, sid(2))
    rt.step("A1 open Defense Scheduling, pick Gab", open_and_pick)

    def panel_shot():
        h.scroll_to_text(staff, "Panel members")
        facts["panel_text"] = h.page_text(staff, 6000)
        rt.shot(staff, sid(3))
    rt.step("A2 panel members and invitation chips", panel_shot)

    def availability_shots():
        h.scroll_to_text(staff, "Availability of the panel")
        rt.shot(staff, sid(4))
        h.scroll_to_text(staff, "Availability overlap")
        rt.shot(staff, sid(5))
    rt.step("A3 availability overlap", availability_shots)

    def best_options():
        h.scroll_to_text(staff, "Best shared options")
        rt.shot(staff, sid(6))
    rt.step("A4 best shared options", best_options)

    # ---- Part B: ask for availability, the faculty answers with a date they cannot attend --------
    def ask_availability():
        h.scroll_to_text(staff, "Ask the adviser and the panel for their available dates", exact=False)
        staff.get_by_label("Message (optional)").fill("Please confirm your hours for the Proposal Defense of Gab Tolentino.")
        rt.shot(staff, sid(7))
        staff.get_by_role("button", name=re.compile("Ask for availability", re.I)).click()
        staff.wait_for_timeout(2500)
        facts["ask_result"] = h.page_text(staff, 12000)
        h.scroll_to_text(staff, "Ask the adviser and the panel for their available dates", exact=False)
        rt.shot(staff, sid(8))
    rt.step("B1 staff asks for availability", ask_availability)

    ramos = rt.new_page(h.FAC["ramos"])

    def faculty_availability():
        rt.go(ramos, "/faculty-portal/availability")
        facts["ramos_avail_before"] = h.page_text(ramos, 6000)
        rt.shot(ramos, sid(9), full=True)
        ramos.get_by_text("I am NOT available").first.click()
        ramos.get_by_label("First date").fill(BLOCK_DAY)
        ramos.get_by_label("Note").fill("Out of town")
        rt.shot(ramos, sid(10))
        ramos.get_by_role("button", name=re.compile("Add date", re.I)).click()
        ramos.wait_for_timeout(2000)
        facts["ramos_avail_after"] = h.page_text(ramos, 7000)
        h.scroll_to_text(ramos, "Your dates")
        rt.shot(ramos, sid(11))
    rt.step("B2 Dr. Teodoro Ramos blocks Thu 22 Oct", faculty_availability)

    # ---- Part C: the panel chair-side invitation: Dr. Angela Cruz declines, then accepts ---------
    cruz = rt.new_page(h.FAC["cruz"])

    def card(page):
        return page.locator("li").filter(has_text="Gab Tolentino").first

    def decline():
        rt.go(cruz, "/faculty-portal/invitations")
        facts["cruz_inv_before"] = h.page_text(cruz, 3000)
        rt.shot(cruz, sid(12))
        card(cruz).get_by_role("button", name="Decline").click()
        cruz.wait_for_timeout(600)
        card(cruz).get_by_role("textbox").fill("Clinical rotation clash on the proposed dates; please find a replacement.")
        rt.shot(cruz, sid(13))
        card(cruz).get_by_role("button", name=re.compile("Decline|Send", re.I)).last.click()
        cruz.wait_for_timeout(2000)
        facts["cruz_inv_declined"] = h.page_text(cruz, 3000)
        rt.shot(cruz, sid(14))
    rt.step("C1 Dr. Angela Cruz declines the invitation", decline)

    def staff_sees_decline():
        h.open_defense_scheduling(rt, staff)
        h.pick_student(rt, staff, "Tolentino")
        h.scroll_to_text(staff, "Panel members")
        facts["panel_after_decline"] = h.page_text(staff, 6000)
        rt.shot(staff, sid(15))
    rt.step("C2 staff sees the declined chip", staff_sees_decline)

    # ---- Part D: with the invitation declined, even a clean slot cannot be booked ---------------
    def declined_block():
        h.scroll_to_text(staff, "Final schedule")
        h.fill_slot(staff, DECLINE_DAY, "09:00", "11:00", "Graduate School Conference Room")
        facts["hard_declined_only"] = h.slot_check_text(staff)
        staff.locator("[aria-live=polite]").first.scroll_into_view_if_needed()
        staff.evaluate("window.scrollBy(0, -300)")
        rt.shot(staff, sid(16))
    rt.step("D0 a declined invitation blocks any slot", declined_block)

    # ---- Part E: Dr. Cruz accepts again ------------------------------------------------------------
    def reaccept():
        rt.go(cruz, "/faculty-portal/invitations")
        card(cruz).get_by_role("button", name="Accept").click()
        cruz.wait_for_timeout(2000)
        facts["cruz_inv_reaccepted"] = h.page_text(cruz, 3000)
        rt.shot(cruz, sid(17))
    rt.step("E1 Dr. Angela Cruz accepts", reaccept)

    # ---- Part F0: conflict warnings, read off the screen -------------------------------------------
    def conflicts():
        h.scroll_to_text(staff, "Final schedule")
        # HARD - a panelist's entered availability (Dr. Ramos blocked 22 Oct) and the declined invitation
        h.fill_slot(staff, BLOCK_DAY, "10:00", "12:00", "Graduate School Conference Room")
        facts["hard_unavailable"] = h.slot_check_text(staff)
        staff.evaluate("window.scrollBy(0, 0)")
        rt.shot(staff, sid(19))
        # SOFT - before the 14-day lead time only
        h.fill_slot(staff, SOFT_DAY, "13:00", "14:30", "Graduate School Conference Room")
        facts["soft_lead"] = h.slot_check_text(staff)
        rt.shot(staff, sid(20))
    rt.step("D1 conflict warnings (hard and soft)", conflicts)

    # ---- Part F: cancel the old booking, book the new one ------------------------------------------
    def cancel_old():
        h.open_defense_scheduling(rt, staff)
        h.pick_student(rt, staff, "Tolentino")
        facts["active_before_cancel"] = bool(h.sched_state(staff_api, gab)["active"])
        h.scroll_to_text(staff, "This stage is already booked")
        rt.shot(staff, sid(21))
        staff._prompt_answers[:] = ["Panel chair asked for a later date after the venue changed", "Panel chair"]
        staff.get_by_role("button", name=re.compile("Cancel this booking instead", re.I)).click()
        staff.wait_for_timeout(3000)
        facts["cancel_result"] = h.page_text(staff, 14000)
        try:
            h.scroll_to_text(staff, "Defense cancelled", offset=450)
        except Exception:  # noqa: BLE001
            h.scroll_to_text(staff, "Final schedule")
        rt.shot(staff, sid(22))
    if state["active"]:
        rt.step("F1 cancel Gab's existing 20 Oct booking (reason required)", cancel_old)
    else:
        rt.note("F1 skipped: no active booking")

    def book_new():
        h.scroll_to_text(staff, "Best shared options")
        staff.get_by_text(re.compile("Earliest option")).first.click()
        staff.wait_for_timeout(800)
        staff.get_by_label("Venue / meeting link").fill("Graduate School Conference Room")
        staff.get_by_label("Scheduling constraints").fill("External panelist prefers a morning start.")
        staff.get_by_label(re.compile("Staff override")).check()
        staff.get_by_label(re.compile("Reason for the staff override")).fill(
            "Adviser signatures and endorsements are still being collected; panel and date are fixed now so the panel can prepare."
        )
        staff.wait_for_timeout(1500)
        facts["book_form_check"] = h.slot_check_text(staff)
        h.scroll_to_text(staff, "Final schedule")
        rt.shot(staff, sid(23))
        staff.get_by_role("button", name="Set defense schedule").click()
        try:
            staff.get_by_text(re.compile("The student record, queue")).first.wait_for(timeout=10000)
            facts["book_message"] = "Saved. The student record, queue, and monitoring indicators were updated."
            staff.get_by_text(re.compile("The student record, queue")).first.scroll_into_view_if_needed(timeout=3000)
        except Exception:  # noqa: BLE001 - the banner can disappear while the page reloads the record
            h.scroll_to_text(staff, "This stage is already booked")
        staff.wait_for_timeout(300)
        facts["book_result"] = h.page_text(staff, 16000)
        h.scroll_to_text(staff, "This stage is already booked", offset=60)
        rt.shot(staff, sid(24))
    rt.step("F2 choose the best shared option and set the defense schedule", book_new)

    def after_booking():
        staff.reload()
        rt.settle(staff, 2500)
        h.scroll_to_text(staff, "Panel members")
        facts["panel_after_book"] = h.page_text(staff, 6000)
        rt.shot(staff, sid(25))
        h.scroll_to_text(staff, "View schedule history")
        staff.get_by_text("View schedule history").first.click()
        staff.wait_for_timeout(800)
        facts["history"] = h.page_text(staff, 20000)
        rt.shot(staff, sid(26))
    rt.step("F3 panel chips and schedule history after booking", after_booking)

    # ---- Part F4: a second student cannot take the same slot ---------------------------------------
    def double_booked():
        h.open_defense_scheduling(rt, staff)
        h.pick_student(rt, staff, "Salonga")
        h.scroll_to_text(staff, "Final schedule")
        h.fill_slot(staff, NEW_DAY, "08:00", "10:00", "Graduate School Conference Room")
        facts["hard_double_booked"] = h.slot_check_text(staff)
        staff.locator("[aria-live=polite]").first.scroll_into_view_if_needed()
        staff.evaluate("window.scrollBy(0, -300)")
        rt.shot(staff, sid(29))
    rt.step("F4 another student cannot take the same slot (panel and room clash)", double_booked)

    # ---- Part G: panel invitations as the faculty see them after booking -------------------------
    def invitations_after():
        rt.go(cruz, "/faculty-portal/invitations")
        facts["cruz_inv_after"] = h.page_text(cruz, 3000)
        rt.shot(cruz, sid(27))
        facts["cruz_bell"] = h.bell_text(cruz)
        rt.shot(cruz, sid(28))
    rt.step("G1 Dr. Cruz's invitation page and notification bell", invitations_after)

    # ---- cleanup: remove the test date so other cases see Dr. Ramos unchanged -------------------
    def cleanup():
        rt.go(ramos, "/faculty-portal/availability")
        ramos.get_by_role("button", name=re.compile("^Remove")).first.click()
        ramos.wait_for_timeout(600)
        ramos.get_by_role("dialog").get_by_role("button", name="Remove").click()
        ramos.wait_for_timeout(1500)
        facts["ramos_after_cleanup"] = h.page_text(ramos, 5000)
    rt.step("H1 remove the 22 Oct test date again", cleanup)

    import json
    from .common import SHOTS
    (SHOTS / "_facts_15.json").write_text(json.dumps(facts, indent=1), encoding="utf-8")
