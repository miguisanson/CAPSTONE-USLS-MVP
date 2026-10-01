"""Case 14 - Panel Matching with explainable scores.

Miguel Yu (after case 13) and the seven demo students GS-2026-PM-01 .. PM-07.
Also the Faculty page: expertise records and editing (the added record is removed again at the end).
Facts read off the screens are written to shots/_facts_14.json for the case text.
"""
from __future__ import annotations

import json
import re
import time

from . import helpers_a4 as h
from .common import SHOTS, main_text

SLUG = "panel_matching"
WIDE = {"width": 2000, "height": 960}
PM_STUDENTS = [f"GS-2026-PM-0{n}" for n in range(1, 8)]


def sid(n: int) -> str:
    return f"{SLUG}-{n:02d}"


def snap(rt, page, shot_id: str) -> None:
    """Viewport shot of the main column only (sidebar cropped out).

    The ranked table is 980 px wide and normally scrolls sideways inside its card; before the shot the
    scroll container is set to overflow:visible so all four columns (rank, expertise, availability, score) show at once.
    """
    page.evaluate("() => { const t = document.querySelector('[role=table]'); if (t && t.parentElement) { t.parentElement.style.overflow = 'visible'; } }")
    page.wait_for_timeout(400)
    form = page.locator("form").filter(has_text="Panel recommendation workspace")
    right = 1500
    left = 288
    if form.count():
        box = form.first.bounding_box()
        right = box["x"] + box["width"] + 24
        left = max(0, box["x"] - 30)
    table = page.get_by_role("table", name="Ranked panel candidates")
    if table.count():
        tb = table.first.bounding_box()
        if tb:
            right = max(right, tb["x"] + tb["width"] + 24)
    vw = page.viewport_size["width"]
    clip = {"x": left, "y": 0, "width": min(vw - left, max(right - left, 1230)), "height": page.viewport_size["height"]}
    page.screenshot(path=str(SHOTS / f"{shot_id}.png"), clip=clip)
    rt.note(f"shot {shot_id}")


def read_facts(page) -> dict:
    """Read the method label, eligibility note, suggested seats and top rows from the Panel Matching screen."""
    text = main_text(page, 60000)
    table = page.get_by_role("table", name="Ranked panel candidates").inner_text()
    method = re.search(r"(Similarity match[^\n]*|Semantic match[^\n]*)", text)
    title = re.search(r"Research title[^\n]*?:\s*([^\n]+)", text)
    roles = re.search(r"panel needs (\d+) members: ([^\n]+?)\.", text)
    excluded = re.findall(r"Not eligible for this student's panel\s*\n(.+?)(?:\n\n|\nSearch faculty)", text, re.S)
    rows = []
    for m in re.finditer(r"\n(\d+)\n(Dr\. [^\n]+)\n(.*?)([\d.]+)/100\s+([\d.]+)/60 · ([\d.]+)/25 · ([\d.]+)/15", "\n" + table, re.S):
        block = m.group(3)
        rows.append({
            "rank": int(m.group(1)), "name": m.group(2), "score": float(m.group(4)),
            "expertise": float(m.group(5)), "availability": float(m.group(6)), "workload": float(m.group(7)),
            "suggested": (re.search(r"SUGGESTED: ([A-Z ]+)", block).group(1).strip() if re.search(r"SUGGESTED: ([A-Z ]+)", block) else ""),
            "windows": (re.search(r"(\d+) conflict-free windows", block).group(1) if re.search(r"(\d+) conflict-free windows", block) else ""),
            "other_panels": (re.search(r"(\d+) other student panel", block).group(1) if re.search(r"(\d+) other student panel", block) else ""),
            "topics": [t for t in re.findall(r"\n([a-z][a-z \-]+)\n", block)][:5],
        })
    return {
        "method": method.group(1).strip() if method else "",
        "title": title.group(1).strip() if title else "",
        "roles": roles.group(0) if roles else "",
        "excluded": [e.strip().replace("\n", " ") for e in excluded],
        "rows": rows[:6],
    }


def run(rt):
    rt.reset("research-miguel")
    facts: dict = {}

    # Put Miguel at the state "Form 1 endorsed" quietly (this is exactly case 13), so this case can run alone.
    def prepare():
        stu = rt.new_page("student@usls.edu.ph")
        h.upload_title_package(rt, stu)
        stu.context.close()
        st = rt.new_page("staff@usls.edu.ph")
        h.staff_verify(rt, st)
        st.context.close()
        ac = rt.new_page("academic@usls.edu.ph")
        h.coordinator_endorse(rt, ac)
        ac.context.close()

    rt.step("prepare Miguel (case 13 steps: upload, verify, endorse)", prepare)

    staff = rt.new_page("staff@usls.edu.ph")
    staff.set_viewport_size(WIDE)
    staff2 = rt.new_page("staff@usls.edu.ph")
    n = 0

    def nxt():
        nonlocal n
        n += 1
        return sid(n)

    # ---------------- Part A: Miguel's workspace ----------------
    def open_pm():
        rt.go(staff, "/workflow/panel-matching")
        h.pick_student(staff, "2260004", "Miguel Yu")
        snap(rt, staff, nxt())
        h.scroll_to(staff, staff.get_by_text("Panel recommendation workspace"), 70)
        snap(rt, staff, nxt())

    rt.step("staff: open Panel Matching, pick Miguel", open_pm)

    def paper_analysis():
        h.scroll_to(staff, staff.get_by_text("content ready").first, 80)
        snap(rt, staff, nxt())
        h.scroll_to(staff, staff.get_by_text("Expertise match (paper vs. faculty records)"), 80)
        snap(rt, staff, nxt())

    rt.step("staff: paper analysis, method label, weights and adviser exclusion", paper_analysis)

    def table_top():
        facts["miguel"] = read_facts(staff)
        h.scroll_to(staff, staff.get_by_role("table", name="Ranked panel candidates"), 70)
        snap(rt, staff, nxt())

    rt.step("staff: ranked candidates for Miguel", table_top)

    def why():
        staff.get_by_text("Why this score").first.click()
        staff.wait_for_timeout(500)
        h.scroll_to(staff, staff.get_by_text("How the score was built").first, 120)
        snap(rt, staff, nxt())
        facts["miguel_why"] = staff.get_by_text("How the score was built").first.locator("xpath=ancestor::div[3]").inner_text()[:1600]
        staff.get_by_text("Hide why").first.click()

    rt.step("staff: Why this score for the top candidate", why)

    def select_panel():
        h.scroll_to(staff, staff.get_by_text("Review and adjust the panel set"), 70)
        snap(rt, staff, nxt())
        seat = staff.locator("label", has_text="Content Specialist").locator("select")
        value = seat.locator("option", has_text="Patricia Salvador").get_attribute("value")
        seat.select_option(value=value)
        staff.wait_for_timeout(500)
        facts["miguel_seats"] = {
            role: staff.locator("label", has_text=role).locator("select").evaluate("e => e.options[e.selectedIndex].text")
            for role in ("Panel Chair", "Content Specialist", "Method Specialist")
        }
        facts["miguel_rules"] = staff.get_by_text("Panel composition rules").locator("xpath=ancestor::div[1]").inner_text()[:1500]
        snap(rt, staff, nxt())

    rt.step("staff: adjust seats (Content Specialist changed to the #3 candidate)", select_panel)

    def finalize():
        staff.get_by_role("button", name=re.compile("Finalize selected panel")).click()
        rt.settle(staff)
        snap(rt, staff, nxt())
        h.scroll_to(staff, staff.get_by_text("Review and adjust the panel set"), 70)
        snap(rt, staff, nxt())

    rt.step("staff: Finalize selected panel", finalize)

    def record_after():
        rt.go(staff2, "/workflow/research-gate")
        h.pick_student(staff2, "2260004", "Miguel Yu")
        h.scroll_to(staff2, staff2.get_by_text("Panel Matching", exact=True).last, 150)
        rt.shot(staff2, nxt())

    rt.step("staff: Research Gate shows the final panel", record_after)

    # ---------------- Part A2: the panelists accept their seats ----------------
    def accept_invitation(email: str, first_shot: bool = False):
        # Silent step (no screenshot): the panelists answer their invitations so that scheduling can follow.
        # (A seat answered in an earlier run can still show Accepted after a reset.)
        fac = rt.new_page(email)
        try:
            fac.get_by_role("link", name="Panel Invitations").click()
            rt.settle(fac)
            try:
                fac.get_by_text("Loading your invitations").wait_for(state="detached", timeout=8000)
            except Exception:  # noqa: BLE001
                pass
            fac.wait_for_timeout(500)
            accept = fac.get_by_role("button", name="Accept", exact=True)
            if accept.count():
                accept.first.click()
                rt.settle(fac)
                rt.note(f"{email}: invitation accepted now")
            else:
                rt.note(f"{email}: no pending invitation (already answered earlier)")
            facts.setdefault("invitation_text", {})[email] = main_text(fac, 600)
        finally:
            fac.context.close()

    rt.step("faculty: panel chair accepts the invitation", lambda: accept_invitation("marlon.geronimo@usls.edu.ph"))
    rt.step("faculty: content specialist accepts", lambda: accept_invitation("patricia.salvador@usls.edu.ph", False))
    rt.step("faculty: method specialist accepts", lambda: accept_invitation("teodoro.ramos@usls.edu.ph", False))

    # ---------------- Part B: seven demo papers ----------------
    rt.go(staff, "/workflow/panel-matching")
    for number in PM_STUDENTS:
        def one(number=number):
            h.pick_student(staff, number)
            facts[number] = read_facts(staff)
            h.scroll_to(staff, staff.get_by_text("Panel recommendation workspace"), 60)
            snap(rt, staff, nxt())
            h.scroll_to(staff, staff.get_by_role("table", name="Ranked panel candidates"), 70)
            snap(rt, staff, nxt())

        rt.step(f"staff: ranking for {number}", one)

    # ---------------- Part C: faculty expertise records ----------------
    stamp = time.strftime("%H%M")
    record_text = f"Trust, perceived risk, and adoption of digital wallets among young working adults (demo record {stamp})"
    target = "Dr. Teresa Lim"

    def before():
        h.pick_student(staff, "GS-2026-PM-04")
        table = staff.get_by_role("table", name="Ranked panel candidates")
        h.scroll_to(staff, table, 70)
        facts["pm04_before"] = [r for r in read_facts(staff)["rows"]]
        full = table.inner_text()
        m = re.search(r"\n(\d+)\nDr\. Teresa Lim\n(.*?)([\d.]+)/100\s+([\d.]+)/60", "\n" + full, re.S)
        facts["pm04_target_before"] = {"rank": m.group(1), "score": m.group(3), "expertise": m.group(4)} if m else None
        snap(rt, staff, nxt())

    rt.step("staff: PM-04 ranking before the expertise edit", before)

    def faculty_page():
        rt.go(staff2, "/faculty")
        staff2.get_by_text(target).first.click()
        rt.settle(staff2)
        h.scroll_to(staff2, staff2.get_by_role("heading", name=re.compile("^Expertise records")), 185)
        rt.shot(staff2, nxt())

    rt.step("staff: Faculty page, open profile, read expertise records", faculty_page)

    def add_record():
        staff2.get_by_label("Kind of new record").select_option(label="Research interest")
        staff2.get_by_label("Text of new record").fill(record_text)
        h.scroll_to(staff2, staff2.get_by_label("Text of new record"), 520)
        rt.shot(staff2, nxt())
        staff2.get_by_role("button", name=re.compile("Add record")).click()
        rt.settle(staff2)
        h.scroll_to(staff2, staff2.get_by_text("Expertise record added").first, 520)
        rt.shot(staff2, nxt())

    rt.step("staff: add a research-interest record", add_record)

    def after():
        rt.go(staff, "/workflow/panel-matching")
        h.pick_student(staff, "GS-2026-PM-04")
        table = staff.get_by_role("table", name="Ranked panel candidates")
        h.scroll_to(staff, table, 70)
        facts["pm04_after"] = [r for r in read_facts(staff)["rows"]]
        full = table.inner_text()
        m = re.search(r"\n(\d+)\nDr\. Teresa Lim\n(.*?)([\d.]+)/100\s+([\d.]+)/60", "\n" + full, re.S)
        facts["pm04_target_after"] = {"rank": m.group(1), "score": m.group(3), "expertise": m.group(4)} if m else None
        snap(rt, staff, nxt())

    rt.step("staff: PM-04 ranking after the edit", after)

    def cleanup():
        rt.go(staff2, "/faculty")
        staff2.get_by_text(target).first.click()
        rt.settle(staff2)
        staff2.get_by_role("button", name=f"Remove record: {record_text}").click()
        staff2.get_by_role("button", name="Remove record", exact=True).click()
        rt.settle(staff2)
        h.scroll_to(staff2, staff2.get_by_text("Expertise record removed").first, 520)
        rt.shot(staff2, nxt())

    rt.step("staff: remove the added record again", cleanup)

    (SHOTS / "_facts_14.json").write_text(json.dumps(facts, indent=1), encoding="utf-8")
    staff.context.close()
    staff2.context.close()
