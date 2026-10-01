"""Case 18 - Miguel Yu: Title Defense verdict, then Proposal Defense and Final Defense through graduation eligibility.

Miguel is advanced with the minimum of scheduling/verdict work (the scheduling and verdict screens are the subject of
another case). The app only accepts a verdict after the defense start time, and refuses past slots, so each defense is
booked a couple of minutes ahead of the real clock (with the staff "warning override" for the 14-day lead time) and the
capture waits for the start time to pass before the panel chair submits the verdict.

Facts read off screens go to shots/_facts_18.json.
"""
from __future__ import annotations

import json
import re
import time
from datetime import datetime, timedelta

from . import helpers_a4 as h
from .common import SHOTS, main_text

SLUG = "proposal_final"
FACTS: dict = {}
# Dr. Teodoro Ramos (the suggested Method Specialist) is double-booked by other demo defenses today, so Dr. Daniel Uy takes that seat.
PANEL_SEATS = {"Content Specialist": "Patricia Salvador", "Method Specialist": "Daniel Uy"}
# Proposal panel (four seats): the suggested Method, Content and External members are booked elsewhere today, so these seats are chosen by staff.
PROPOSAL_SEATS = {"Panel Chair": "Patricia Salvador", "Content Specialist": "Celeste Tan", "Method Specialist": "Daniel Uy", "External Panel": "Adriana Santos"}


def sid(n: int) -> str:
    return f"{SLUG}-{n:02d}"


class Ctx:
    """Holds the open pages and a running screenshot counter."""

    def __init__(self, rt):
        self.rt = rt
        self.n = 0
        self.pages: dict = {}

    def page(self, key: str, email: str):
        if key not in self.pages:
            self.pages[key] = self.rt.new_page(email)
        return self.pages[key]

    def shot(self, page, full: bool = False) -> str:
        self.n += 1
        return self.rt.shot(page, sid(self.n), full=full)

    def close(self):
        for page in self.pages.values():
            try:
                page.context.close()
            except Exception:  # noqa: BLE001
                pass


def book_defense_soon(ctx: Ctx, staff, *, reason_text: str, defense_label: str, manuscript_received: bool, shots: bool = True):
    """Staff: Defense Scheduling > pick Miguel > set a slot that starts about two minutes from now (override of lead time)."""
    rt = ctx.rt
    rt.go(staff, "/workflow/defense-scheduling")
    h.pick_student(staff, "2260004", "Miguel Yu")
    staff.wait_for_timeout(2500)
    if shots:
        ctx.shot(staff)  # readiness and panel
    now = datetime.now()
    start = (now + timedelta(minutes=2)).replace(second=0, microsecond=0)
    end = start + timedelta(hours=2)
    if end.hour > 17 or (end.hour == 17 and end.minute > 0) or start.weekday() >= 5 or start.hour < 8:
        raise RuntimeError(f"Outside the panel's entered hours (weekdays 8:00-17:00): now is {now:%a %H:%M}")
    date_str, start_str, end_str = start.strftime("%Y-%m-%d"), start.strftime("%H:%M"), end.strftime("%H:%M")
    h.scroll_to(staff, staff.get_by_text("Final schedule", exact=True), 80)
    staff.get_by_label(re.compile("Selected date")).fill(date_str)
    staff.get_by_label(re.compile("Start time")).fill(start_str)
    staff.get_by_label(re.compile("End time")).fill(end_str)
    if manuscript_received:
        staff.get_by_label(re.compile("Date the panel received the manuscript")).fill((now - timedelta(days=20)).strftime("%Y-%m-%d"))
    staff.get_by_label(re.compile("Venue")).fill("GS Conference Room")
    staff.wait_for_timeout(1500)
    override = staff.get_by_label(re.compile("Warning override"))
    if override.count() and not override.first.is_checked():
        override.first.check()
    reason = staff.get_by_label(re.compile("Reason for the staff override"))
    if reason.count():
        reason.first.fill(reason_text)
    if shots:
        h.scroll_to(staff, staff.get_by_text("Final schedule", exact=True), 60)
        ctx.shot(staff)
    staff.get_by_role("button", name=re.compile("Set defense schedule|Book the re-defense")).click()
    rt.settle(staff)
    staff.wait_for_timeout(1000)
    FACTS.setdefault("booked", []).append({"label": defense_label, "date": date_str, "start": start_str, "end": end_str})
    if shots:
        staff.get_by_text("Saved.").first.scroll_into_view_if_needed()
        ctx.shot(staff)
    return start


def wait_until(start: datetime, rt):
    """Wait (real time) until the defense start time has passed."""
    delay = (start - datetime.now()).total_seconds() + 8
    if delay > 0:
        rt.note(f"waiting {delay:.0f}s for the defense start time to pass")
        time.sleep(delay)


def chair_verdict(ctx: Ctx, chair_email: str, *, result_label: str = "Passed", title: str = "", remarks: str = "", score: str = "", shots: bool = True):
    rt = ctx.rt
    fac = ctx.page(f"chair-{chair_email}", chair_email)
    rt.go(fac, "/faculty-portal/verdicts")
    card = fac.locator("article").filter(has_text="Miguel Yu").filter(has_text="Submit panel chair verdict").first
    card.scroll_into_view_if_needed()
    if shots:
        h.scroll_to(fac, card, 80)
        ctx.shot(fac)
    select = card.get_by_label("Verdict result")
    select.select_option(index=0)  # first option is the passing verdict
    if title:
        card.get_by_label(re.compile("Title selected by the panel")).fill(title)
    if remarks:
        card.get_by_label(re.compile("Remarks or conditions")).fill(remarks)
    if score:
        card.get_by_label(re.compile("Evaluation score")).fill(score)
    if shots:
        h.scroll_to(fac, card.get_by_text("Submit panel chair verdict"), 80)
        ctx.shot(fac)
    card.get_by_role("button", name="Submit final verdict").click()
    rt.settle(fac)
    fac.wait_for_timeout(800)
    if shots:
        done = fac.locator("article").filter(has_text="Miguel Yu").filter(has_text="Verdict:").first
        h.scroll_to(fac, done.get_by_text(re.compile("^Verdict:")), 160)
        ctx.shot(fac)
    return fac


def run(rt):
    ctx = Ctx(rt)
    try:
        run_phases(rt, ctx)
    finally:
        (SHOTS / "_facts_18.json").write_text(json.dumps(FACTS, indent=1), encoding="utf-8")
        ctx.close()


def student_id(number: str = "2260004") -> int:
    api = h.api_login("staff@usls.edu.ph")
    data = h.api_get(api, f"/api/students?q={number}&page_size=5")
    return int(data["items"][0]["id"])


def run_phases(rt, ctx: Ctx):
    from .case_14_panel_matching import WIDE, snap  # noqa: PLC0415

    rt.step("prepare Miguel up to an accepted title-defense panel (cases 13 and 14, no screenshots)", lambda: h.prepare_miguel_to_panel(rt, seats=PANEL_SEATS, accepters=("Dr. Marlon Geronimo", "Dr. Patricia Salvador", "Dr. Daniel Uy")))
    staff = ctx.page("staff", "staff@usls.edu.ph")
    holder: dict = {}
    override_text = "Demonstration run: booked the same day so that the verdict can follow"

    # ================= Part A: Title Defense booked and the verdict recorded =================
    def title_book():
        holder["start"] = book_defense_soon(ctx, staff, reason_text=override_text, defense_label="Title Defense", manuscript_received=False)

    rt.step("staff: book the Title Defense", title_book)
    if "start" in holder:
        wait_until(holder["start"], rt)
    rt.step("panel chair: Title Defense verdict", lambda: chair_verdict(ctx, h.faculty_email("Dr. Marlon Geronimo"), title=h.MIGUEL_TITLE, remarks="Title approved as submitted."))

    def after_title():
        stu = ctx.page("student", "student@usls.edu.ph")
        rt.go(stu, "/student/research")
        h.scroll_to(stu, stu.get_by_text("AUTOMATICALLY DETECTED STAGE"), 90)
        ctx.shot(stu)

    rt.step("student: stage moved to Proposal Defense", after_title)

    # ================= Part B: Proposal Defense requirements =================
    def proposal_uploads():
        upload_stage_files(ctx, [
            ("Proposal manuscript", "Yu_Miguel_Proposal_Manuscript.pdf"),
            ("Proposal defense endorsement", "Yu_Miguel_Form4_Endorsement_for_Proposal_Defense.pdf"),
            ("Statistical consultation form or qualitative exemption", "Yu_Miguel_Form4-1_Qualitative_Exemption.pdf"),
            ("Proposal manuscript endorsement", "Yu_Miguel_Proposal_Manuscript_Endorsement.pdf"),
        ], "Submit Proposal Defense")

    rt.step("student: upload the proposal documents and submit", proposal_uploads)
    rt.step("adviser: sign the uploaded proposal documents", lambda: adviser_sign_all(ctx))
    rt.step("staff: verify the proposal requirements", lambda: staff_verify_stage(ctx))

    def proposal_panel():
        wide = ctx.page("wide", "staff@usls.edu.ph")
        wide.set_viewport_size(WIDE)
        rt.go(wide, "/workflow/panel-matching")
        h.pick_student(wide, "2260004", "Miguel Yu")
        wide.wait_for_timeout(2000)
        h.scroll_to(wide, wide.get_by_text(re.compile("content ready")).first, 80)
        ctx.n += 1
        snap(rt, wide, sid(ctx.n))
        table = wide.get_by_role("table", name="Ranked panel candidates")
        h.scroll_to(wide, table, 70)
        FACTS["proposal_table"] = table.inner_text()[:2500]
        ctx.n += 1
        snap(rt, wide, sid(ctx.n))
        for role, who in PROPOSAL_SEATS.items():
            seat = wide.locator("label", has_text=role).locator("select")
            seat.select_option(value=seat.locator("option", has_text=who).get_attribute("value"))
        h.scroll_to(wide, wide.get_by_text("Review and adjust the panel set"), 70)
        ctx.n += 1
        snap(rt, wide, sid(ctx.n))
        wide.get_by_role("button", name=re.compile("Finalize selected panel")).click()
        rt.settle(wide)
        ctx.n += 1
        snap(rt, wide, sid(ctx.n))
        h.accept_pending_invitations(rt, [h.faculty_email(n) for n in ("Dr. Patricia Salvador", "Dr. Celeste Tan", "Dr. Daniel Uy", "Dr. Adriana Santos")])

    rt.step("staff: Panel Matching for the proposal (four seats) and invitations", proposal_panel)

    holder.pop("start", None)

    def proposal_book():
        holder["start"] = book_defense_soon(ctx, staff, reason_text=override_text, defense_label="Proposal Defense", manuscript_received=True)

    rt.step("staff: book the Proposal Defense", proposal_book)
    if "start" in holder:
        wait_until(holder["start"], rt)
    rt.step("panel chair: Proposal Defense verdict", lambda: chair_verdict(ctx, h.faculty_email("Dr. Patricia Salvador"), remarks="Proposal approved."))

    # ----- after the proposal defense: Form 5.1, ethics clearance (Form 5.2) -----
    rt.step("student: upload Form 5.1 and the ethics clearance (Form 5.2)", lambda: upload_stage_files(ctx, [
        ("Form 5.1 Technical Review Certificate", "Yu_Miguel_Form5-1_Technical_Review_Certificate.pdf"),
        ("Research Protocol Form 5.2 ethics clearance", "Yu_Miguel_Form5-2_Ethics_Clearance.pdf"),
    ], None))

    def record_ethics():
        rc = ctx.page("rc", "research@usls.edu.ph")
        rt.go(rc, f"/workflow/research-gate?student_id={student_id()}")
        rc.wait_for_timeout(2500)
        rc.get_by_label(re.compile("Clearance status")).wait_for()
        h.scroll_to(rc, rc.get_by_label(re.compile("Clearance status")), 300)
        ctx.shot(rc)
        rc.get_by_label(re.compile("Clearance status")).select_option(label="Cleared")
        rc.get_by_label(re.compile("Clearance date")).fill(datetime.now().strftime("%Y-%m-%d"))
        rc.get_by_role("button", name="Record ethics clearance").click()
        rt.settle(rc)
        rc.wait_for_timeout(1000)
        h.scroll_to(rc, rc.get_by_text("Ethics clearance status and date").first, 120)
        ctx.shot(rc)

    rt.step("research coordinator: record the ethics clearance", record_ethics)

    def verify_after_ethics():
        s = staff_verify_stage(ctx, shots=False)
        h.scroll_to(s, s.get_by_text("Automatic research progress"), 80)
        ctx.shot(s)

    rt.step("staff: verify; Proposal Defense complete", verify_after_ethics)

    # ================= Part C: Final Defense =================
    rt.step("student: upload the final defense documents and submit", lambda: upload_stage_files(ctx, [
        ("Final defense manuscript", "Yu_Miguel_Final_Defense_Manuscript.pdf"),
        ("Final defense endorsement", "Yu_Miguel_Form4_Endorsement_for_Final_Defense.pdf"),
    ], "Submit Final Defense"))
    rt.step("adviser: sign the final documents", lambda: adviser_sign_all(ctx))
    rt.step("staff: verify the final defense requirements", lambda: staff_verify_stage(ctx))

    holder.pop("start", None)

    def final_book():
        holder["start"] = book_defense_soon(ctx, staff, reason_text=override_text, defense_label="Final Defense", manuscript_received=True)

    rt.step("staff: book the Final Defense (the proposal panel carries over)", final_book)
    if "start" in holder:
        wait_until(holder["start"], rt)
    rt.step("panel chair: Final Defense verdict with evaluation score", lambda: chair_verdict(ctx, h.faculty_email("Dr. Patricia Salvador"), remarks="Final defense passed.", score="92"))

    # ================= Part D: completion evidence and graduation eligibility =================
    rt.step("student: upload the completion documents and submit", lambda: upload_stage_files(ctx, [
        ("Final manuscript for archiving", "Yu_Miguel_Final_Manuscript_Archive_Copy.pdf"),
        ("Panel approval confirmations", "Yu_Miguel_Panel_Approval_Emails.pdf"),
        ("Turnitin certificate (SIR 15% or below)", "Yu_Miguel_Turnitin_Certificate_SIR_11.pdf"),
        ("Form 9 editor certification", "Yu_Miguel_Form9_Editor_Certification.pdf"),
        ("Form 10 approval sheet", "Yu_Miguel_Form10_Approval_Sheet.pdf"),
    ], "Submit Completion"))

    def completion_verify():
        s = staff_verify_stage(ctx, shots=False)
        h.scroll_to(s, s.get_by_text("Automatic research progress"), 80)
        ctx.shot(s)

    rt.step("staff: verify the completion evidence", completion_verify)

    def graduation_view():
        gs = ctx.page("staff", "staff@usls.edu.ph")
        rt.go(gs, "/workflow/graduation")
        gs.wait_for_timeout(2000)
        card = gs.get_by_text("Miguel Yu", exact=True).first
        h.scroll_to(gs, card, 260)
        ctx.shot(gs)
        sp = ctx.page("student", "student@usls.edu.ph")
        rt.go(sp, "/student/graduation")
        sp.wait_for_timeout(1500)
        h.scroll_to(sp, sp.get_by_text("Monitoring eligibility recommendation"), 120)
        ctx.shot(sp)

    rt.step("staff and student: graduation eligibility", graduation_view)


# ---------------------------------------------------------------------------
# Reusable stage helpers (proposal and final defense follow the same pattern)
# ---------------------------------------------------------------------------
def upload_stage_files(ctx: Ctx, items: list[tuple[str, str]], submit_label: str | None, shots: bool = True):
    """Student > Research: upload one PDF per card (card found by its visible label), then optionally submit."""
    rt = ctx.rt
    stu = ctx.page("student", "student@usls.edu.ph")
    rt.go(stu, "/student/research")
    if shots:
        ctx.shot(stu)
    for label, file_name in items:
        lines = [
            "Miguel Yu, 2260004, Master of Arts in Education.",
            "Demonstration document prepared for the walkthrough.",
            "Learning Analytics Feedback Dashboards and the Engagement of Working Graduate Students in Blended Courses.",
        ]
        if "manuscript" in label.lower() and "endorsement" not in label.lower():
            lines += list(h.CONCEPT_PAPERS[0]["body"].values())
        pdf = h.make_generic_pdf(file_name, label, lines)
        card_input = stu.get_by_text(label, exact=True).first.locator("xpath=ancestor::div[.//input[@type='file']][1]").locator("input[type=file]")
        card_input.set_input_files(str(pdf))
        rt.settle(stu)
    if shots:
        ctx.shot(stu)
    if submit_label:
        btn = stu.get_by_role("button", name=re.compile(submit_label))
        btn.scroll_into_view_if_needed()
        btn.click()
        rt.settle(stu)
        stu.get_by_role("button", name=re.compile(submit_label)).scroll_into_view_if_needed()
        if shots:
            ctx.shot(stu)
    return stu


def adviser_sign_all(ctx: Ctx, shots: bool = True):
    rt = ctx.rt
    adv = ctx.page("adviser", "liwayway.bautista@usls.edu.ph")
    rt.go(adv, "/faculty-portal/signatures")
    if shots:
        ctx.shot(adv)
    signed = 0
    for _ in range(8):
        pending = adv.get_by_role("button").filter(has_text="Needs signature")
        if not pending.count():
            break
        pending.first.click()
        adv.wait_for_timeout(400)
        h.draw_signature(adv, adv.locator("canvas").first)
        fin = adv.get_by_role("button", name=re.compile("Finalize signature"))
        if fin.count():
            fin.first.click()
            adv.wait_for_timeout(300)
        if shots and signed == 0:
            ctx.shot(adv)
        adv.get_by_role("button", name=re.compile("Sign this document")).click()
        rt.settle(adv)
        adv.wait_for_timeout(500)
        signed += 1
    if shots:
        ctx.shot(adv)
    FACTS.setdefault("signed_documents", []).append(signed)
    return signed


def staff_verify_stage(ctx: Ctx, shots: bool = True):
    rt = ctx.rt
    staff = ctx.page("staff", "staff@usls.edu.ph")
    rt.go(staff, "/workflow/research-gate")
    h.pick_student(staff, "2260004", "Miguel Yu")
    staff.wait_for_timeout(1000)
    if shots:
        h.scroll_to(staff, staff.get_by_text("Research Gate record"), 80)
        ctx.shot(staff)
    btn = staff.get_by_role("button", name="Verify submitted requirements")
    btn.click()
    rt.settle(staff)
    if shots:
        h.scroll_to(staff, staff.get_by_text(re.compile(r"requirements$")).first, 90)
        ctx.shot(staff)
    return staff
