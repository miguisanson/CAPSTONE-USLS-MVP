"""Case 17 - Verdict outcomes, reschedule and cancel.

The panel chair can record a verdict only after the defense has started ("A verdict cannot be recorded
before the defense starts"). All seeded upcoming defenses are in the future, so this module does what
a coordinator would do on the day: staff reschedule three of them to a slot a few minutes ahead (with a
reason), the chair tries the verdict form early (blocked), then submits the verdict once the start time
has passed.

    Nico Barrientos (GS-2026-UD-01)  chair Dr. Marco Villanueva     -> Passed with minor revisions
    Bea Salonga     (GS-2026-UD-02)  chair Dr. Angela Cruz          -> Deferred, rebooked, Provisional pass - re-defense required,
                                                                       re-defense booked, then cancelled with a reason
    Gab Tolentino   (GS-2026-UD-03)  chair Dr. Marco Villanueva     -> Failed

The three students are not resettable, so this module works on the state it finds: a student who already
has the verdict is skipped. Needs a weekday between 08:00 and about 16:00 (panel hours are 08:00-17:00).
"""
from __future__ import annotations

import json
import math
import re
from datetime import datetime, timedelta

from . import helpers_a5 as h
from .common import SHOTS, Runtime

SLUG = "verdicts"
VENUE = "Graduate School Conference Room"


def sid(n: int) -> str:
    return f"{SLUG}-{n:02d}"


def hm(dt: datetime) -> str:
    return dt.strftime("%H:%M")


def run(rt: Runtime) -> None:
    api = h.Api(h.STAFF)
    ids = h.student_ids(api)
    facts: dict = {}
    today = h.now_manila().date()
    now = h.now_manila()
    base = (now + timedelta(minutes=9)).replace(second=0, microsecond=0)
    slots = {
        "nico": (base, base + timedelta(minutes=4)),
        "bea": (base + timedelta(minutes=6), base + timedelta(minutes=10)),
        "gab": (base + timedelta(minutes=12), base + timedelta(minutes=16)),
        "bea2": (base + timedelta(minutes=18), base + timedelta(minutes=22)),
    }
    rt.note("slots: " + ", ".join(f"{k} {hm(a)}-{hm(b)}" for k, (a, b) in slots.items()))

    def _verdict_count() -> int:
        n = 0
        for k in ("nico", "bea", "gab"):
            st = h.sched_state(api, ids[k])
            n += any(x.get("verdict") for x in st["schedules"] if x["defense_type"] == "Proposal Defense")
        return n

    if len(ids) < 3:
        rt.step("precondition: demo students GS-2026-UD-01..03 exist", lambda: (_ for _ in ()).throw(
            RuntimeError("The demonstration students GS-2026-UD-01..03 are missing: start the app in demo mode on a fresh database.")))
        return
    if _verdict_count() == 3:
        rt.step("precondition: fresh demo database", lambda: (_ for _ in ()).throw(
            RuntimeError("NEEDS A FRESH DATABASE: Nico, Bea and Gab (GS-2026-UD-01..03) already hold their verdicts, so case 17 "
                         "cannot be repeated. Restart the demo on a new SQLite file; the existing verdicts-*.png are kept.")))
        return
    if now.weekday() >= 5 or now.hour < 8 or now.hour >= 16:
        rt.step("precondition: weekday 08:00-16:00", lambda: (_ for _ in ()).throw(
            RuntimeError("Run case 17 on a weekday between 08:00 and 16:00 Manila time: the verdict form opens only after the defense "
                         "start time and panel availability is entered for 08:00-17:00.")))
        return

    def has_verdict(key: str) -> bool:
        st = h.sched_state(api, ids[key])
        return any(s.get("verdict") for s in st["schedules"] if s["defense_type"] == "Proposal Defense")

    staff = h.new_staff_page(rt)

    # -- staff: reschedule a booking to a slot a few minutes ahead ---------------------------------
    def reschedule_soon(key: str, surname: str, shot_ids: tuple[int, int] | None, reason: str, who: str, *, fresh: bool = False) -> None:
        start, end = slots[key]
        ukey = key.rstrip("2")  # "bea2" is the second booking of Bea
        h.open_defense_scheduling(rt, staff)
        h.pick_student(rt, staff, surname)
        h.scroll_to_text(staff, "Final schedule")
        h.fill_slot(staff, str(today), hm(start), hm(end), VENUE)
        staff.get_by_label("Scheduling constraints").fill("Booked as a short session for the walkthrough.")
        for pattern in ("Staff override", "Warning override"):
            box = staff.get_by_label(re.compile(pattern))
            if box.count():
                box.first.check()
        staff.get_by_label(re.compile("Reason for the staff override")).fill(
            "Requirements and lead time are waived for this demonstration defense; panel confirmed by phone."
        )
        resched = staff.get_by_label(re.compile("Reason for rescheduling")).count() > 0
        if resched:
            staff.get_by_label(re.compile("Reason for rescheduling")).fill(reason)
            staff.get_by_label(re.compile("Requested by")).select_option(label=who)
        staff.wait_for_timeout(1200)
        facts[f"{key}_slot_check"] = h.slot_check_text(staff)
        if shot_ids:
            rt.shot(staff, sid(shot_ids[0]))
        label = "Reschedule defense" if resched else re.compile("Set defense schedule|Book the re-defense")
        staff.get_by_role("button", name=label).click()
        staff.wait_for_timeout(3500)
        state = h.sched_state(api, ids[ukey])
        act = state["active"]
        facts[f"{key}_booked"] = act and (act["preferred_date"], act["start_time"], act["end_time"], act["status"])
        if not act or act["start_time"] != hm(start):
            raise RuntimeError(f"booking for {key} not saved: {facts[f'{key}_booked']} | {h.page_text(staff, 12000)[-900:]}")
        if shot_ids:
            h.scroll_to_text(staff, "This stage is already booked", offset=60)
            rt.shot(staff, sid(shot_ids[1]))

    # ---- Part A: staff reschedule Nico, Bea and Gab to short slots today ---------------------------
    for key, surname, shots_, who, n in (
        ("nico", "Barrientos", (1, 2), "Panel chair", "A1"),
        ("bea", "Salonga", (3, 4), "Research adviser", "A2"),
        ("gab", "Tolentino", (5, 6), "Student", "A3"),
    ):
        if has_verdict(key):
            rt.note(f"{n} skipped: {key} already has a verdict")
            continue
        _act = h.sched_state(api, ids[key])["active"]
        if _act and _act["preferred_date"] == str(today) and _act["start_time"] <= hm(h.now_manila()):
            rt.note(f"{n} skipped: {key} is already booked today at {_act['start_time']}")
            continue
        rt.step(f"{n} staff reschedules {key} to today with a reason", lambda k=key, s=surname, sh=shots_, w=who: reschedule_soon(
            k, s, sh, {"nico": "Panel chair asked to bring the defense forward to today",
                       "bea": "Research adviser asked for the first available slot",
                       "gab": "Student asked to be heard earlier"}[k], w))

    # ---- Part B: the chair opens the verdict form before the start time ---------------------------
    villanueva = rt.new_page(h.FAC["villanueva"])
    cruz = rt.new_page(h.FAC["cruz"])

    def article(page, name):
        # the Proposal Defense row of this student (earlier Title Defense rows are finished)
        return page.locator("article").filter(has_text=name).filter(has_text="Proposal Defense Readiness").first

    def early_look():
        rt.go(villanueva, "/faculty-portal/verdicts")
        art = article(villanueva, "Nico Barrientos")
        art.scroll_into_view_if_needed()
        facts["early_nico"] = art.inner_text()[-900:]
        rt.shot(villanueva, sid(7))
    if not has_verdict("nico"):
        rt.step("B1 chair opens the verdict page before the defense starts", early_look)

    # ---- Part C: Nico - Passed with minor revisions -------------------------------------------------
    def verdict(page, name, result_label, remarks, shot_form, shot_done, key):
        start = slots[key][0]
        act = h.sched_state(api, ids[key.rstrip("2")])["active"]
        if act:  # the booking that is really on record (a resumed run may have booked it earlier)
            start = datetime.strptime(f"{act['preferred_date']} {act['start_time']}", "%Y-%m-%d %H:%M")
        h.wait_until(start + timedelta(seconds=8), rt)
        rt.go(page, "/faculty-portal/verdicts")
        art = article(page, name)
        art.scroll_into_view_if_needed()
        art.get_by_label("Verdict result").select_option(label=result_label)
        art.get_by_label("Remarks or conditions").fill(remarks)
        facts[f"{key}_form"] = art.inner_text()[-1200:]
        art.scroll_into_view_if_needed()
        rt.shot(page, sid(shot_form))
        art.get_by_role("button", name="Submit final verdict").click()
        page.wait_for_timeout(3000)
        art = article(page, name)
        facts[f"{key}_done"] = art.inner_text()[-1500:]
        facts[f"{key}_notice"] = h.page_text(page, 400)
        art.scroll_into_view_if_needed()
        rt.shot(page, sid(shot_done))

    if not has_verdict("nico"):
        rt.step("C1 Dr. Villanueva records 'Passed with minor revisions' for Nico", lambda: verdict(
            villanueva, "Nico Barrientos", "Passed with minor revisions",
            "Clarify the sampling frame in Chapter 3 and correct the citation format.", 8, 9, "nico"))

    def adviser_view():
        navarro = rt.new_page(h.FAC["navarro"])
        rt.go(navarro, "/faculty-portal/signatures")
        facts["navarro_signatures"] = h.page_text(navarro, 3000)
        try:
            h.scroll_to_text(navarro, "Revisions to confirm")
        except Exception:  # noqa: BLE001
            pass
        rt.shot(navarro, sid(10))
        facts["navarro_bell"] = h.bell_text(navarro)
        rt.shot(navarro, sid(11))
    rt.step("C2 adviser Dr. Navarro sees the revisions waiting for the student", adviser_view)

    def staff_after_nico():
        h.open_defense_scheduling(rt, staff)
        h.pick_student(rt, staff, "Barrientos")
        facts["nico_staff"] = h.page_text(staff, 3500)
        h.scroll_to_text(staff, "Last verdict")
        rt.shot(staff, sid(12))
    rt.step("C3 staff sees the last verdict on the scheduling screen", staff_after_nico)

    # ---- Part D: Bea - Deferred, rebook, re-defense verdict, re-defense booked then cancelled --------
    if not has_verdict("bea"):
        rt.step("D1 Dr. Cruz records 'Deferred' for Bea", lambda: verdict(
            cruz, "Bea Salonga", "Deferred", "Two panelists could not attend; the session did not take place.", 13, 14, "bea"))

    def staff_after_deferred():
        h.open_defense_scheduling(rt, staff)
        h.pick_student(rt, staff, "Salonga")
        facts["bea_deferred_staff"] = h.page_text(staff, 3500)
        h.scroll_to_text(staff, "Last verdict")
        rt.shot(staff, sid(15))
    rt.step("D2 staff sees Deferred and the schedule status", staff_after_deferred)

    def rebook_bea():
        t = h.now_manila() + timedelta(minutes=5)
        # the panels share panelists: start after Gab's slot has ended, never overlapping it
        gab_act = h.sched_state(api, ids["gab"])["active"]
        if gab_act:
            gab_end = datetime.strptime(f"{gab_act['preferred_date']} {gab_act['end_time']}", "%Y-%m-%d %H:%M") + timedelta(minutes=2)
            t = max(t, gab_end)
        t = t.replace(second=0, microsecond=0)
        slots["bea2"] = (t, t + timedelta(minutes=4))
        reschedule_soon("bea2", "Salonga", None, "", "", fresh=True)
    bea_state = h.sched_state(api, ids["bea"])
    if not bea_state["active"] and (bea_state["outcome"] or {}).get("effect") == "reschedule":
        rt.step("D3 staff books Bea's deferred defense again (a few minutes ahead)", lambda: [rebook_bea(), h.scroll_to_text(staff, "This stage is already booked", offset=60), rt.shot(staff, sid(16))])

    def redefense_verdict():
        start = slots["bea2"][0]
        verdict_key = "bea2"
        verdict(cruz, "Bea Salonga", "Provisional pass - re-defense required",
                "Research questions need restating; the panel will hear the paper again after a full revision.", 17, 18, verdict_key)
    if (h.sched_state(api, ids["bea"])["outcome"] or {}).get("effect") != "redefense":
        rt.step("D4 Dr. Cruz records 'Provisional pass - re-defense required'", redefense_verdict)

    def staff_redefense():
        h.open_defense_scheduling(rt, staff)
        h.pick_student(rt, staff, "Salonga")
        facts["bea_redefense_staff"] = h.page_text(staff, 4000)
        h.scroll_to_text(staff, "Last verdict")
        rt.shot(staff, sid(19))
        # book the re-defense for a normal future date from the Best Shared Options
        h.scroll_to_text(staff, "Best shared options")
        staff.get_by_text(re.compile("Earliest option")).first.click()
        staff.get_by_label("Venue / meeting link").fill(VENUE)
        for pattern in ("Staff override", "Warning override"):
            box = staff.get_by_label(re.compile(pattern))
            if box.count():
                box.first.check()
        staff.get_by_label(re.compile("Reason for the staff override")).fill("Re-defense follows the same protocol; requirements are re-checked when the student resubmits.")
        staff.wait_for_timeout(1500)
        facts["bea_redefense_check"] = h.slot_check_text(staff)
        h.scroll_to_text(staff, "Final schedule")
        rt.shot(staff, sid(20))
        staff.get_by_role("button", name=re.compile("Book the re-defense|Set defense schedule")).click()
        staff.wait_for_timeout(3500)
        facts["bea_redefense_booked"] = h.sched_state(api, ids["bea"])["active"] and h.sched_state(api, ids["bea"])["active"]["preferred_date"]
        h.scroll_to_text(staff, "This stage is already booked", offset=60)
        rt.shot(staff, sid(21))
    if not h.sched_state(api, ids["bea"])["active"]:
        rt.step("D5 staff books the re-defense", staff_redefense)

    def cancel_redefense():
        staff._prompt_answers[:] = ["The student asked for more time to finish the full revision", "Student"]
        staff.get_by_role("button", name=re.compile("Cancel this booking instead", re.I)).click()
        staff.wait_for_timeout(3500)
        facts["bea_cancel_page"] = h.page_text(staff, 14000)[-1500:]
        try:
            h.scroll_to_text(staff, "Defense cancelled", offset=450)
        except Exception:  # noqa: BLE001
            h.scroll_to_text(staff, "Final schedule")
        rt.shot(staff, sid(22))
        h.scroll_to_text(staff, "View schedule history")
        staff.get_by_text("View schedule history").first.click()
        staff.wait_for_timeout(800)
        facts["bea_history"] = h.page_text(staff, 20000)
        rt.shot(staff, sid(23))
    if h.sched_state(api, ids["bea"])["active"]:
        rt.step("D6 staff cancels the re-defense with a reason", cancel_redefense)

    # ---- Part E: Gab - Failed ----------------------------------------------------------------------
    if not has_verdict("gab"):
        rt.step("E1 Dr. Villanueva records 'Failed' for Gab", lambda: verdict(
            villanueva, "Gab Tolentino", "Failed",
            "The study design does not yet answer the research questions; resubmit a revised proposal for a new defense.", 24, 25, "gab"))

    def staff_after_failed():
        h.open_defense_scheduling(rt, staff)
        h.pick_student(rt, staff, "Tolentino")
        facts["gab_staff"] = h.page_text(staff, 4000)
        h.scroll_to_text(staff, "Last verdict")
        rt.shot(staff, sid(26))
    rt.step("E2 staff sees Failed and the re-defense rule", staff_after_failed)

    # ---- Part F: the calendar afterwards ------------------------------------------------------------
    def calendar_after():
        rt.go(staff, "/calendar")
        facts["calendar_text"] = h.page_text(staff, 4000)
        rt.shot(staff, sid(27))
    rt.step("F1 staff calendar after the verdicts", calendar_after)

    (SHOTS / "_facts_17.json").write_text(json.dumps(facts, indent=1, default=str), encoding="utf-8")
