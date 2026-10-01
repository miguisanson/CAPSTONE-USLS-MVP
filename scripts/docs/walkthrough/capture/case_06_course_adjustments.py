"""Case 06 - Course Adjustments (Demand & adjustments, Dean approval, Offering setup) + Academic Semesters + Faculty profiles."""
from __future__ import annotations

import re
import time

from .common import Runtime, click_text
from .helpers_a2 import pick, scroll_to, shot_at, top, visible_text

PROGRAM = "MAED"
TERM = "AY 2026-2027 2nd Semester"
SLUG = "course-adjustments"
SUFFIX = time.strftime("%H%M")
TEST_TERM = "AY 2031-2032 1st Semester"


def _open_adjustments(rt: Runtime, page) -> None:
    rt.go(page, "/course-adjustments")
    click_text(page, "Demand & adjustments", role="tab")
    page.wait_for_timeout(500)
    pick(page, "Program", f"{PROGRAM} -")
    pick(page, "Academic year and semester", TERM)
    rt.settle(page)


def _plan_status(page) -> str:
    txt = visible_text(page, "main", 9000)
    m = re.search(r"(Draft saved\.|Submitted to Dean|Returned by Dean|Approved by|Published on)", txt)
    return m.group(1) if m else "none"


def run(rt: Runtime) -> None:
    rt.reset("course-adjustments-lianne", "course-adjustments-roberto")

    # ---- Part A: Academic Semesters (staff) ------------------------------------------------
    staff = rt.new_page("staff@usls.edu.ph")

    def semesters_list():
        rt.go(staff, "/term-settings")
        staff.get_by_text("AY 2026-2027 1st Semester").first.wait_for()
        rt.shot(staff, f"{SLUG}-01")

    rt.step("Academic Semesters list", semesters_list)

    def edit_form_open():
        row = staff.locator("tr", has_text="AY 2026-2027 1st Semester").first
        row.get_by_role("button", name=re.compile("Edit dates")).click()
        staff.wait_for_timeout(500)
        scroll_to(staff, re.compile(r"Edit dates: AY 2026-2027 1st"), offset=260)
        rt.shot(staff, f"{SLUG}-02")
        staff.get_by_role("button", name=re.compile("Cancel")).first.click()

    rt.step("Open Edit dates on the current semester (cancel)", edit_form_open)

    def add_semester():
        # leave a clean state when a previous run stopped half way
        staff.get_by_role("button", name=re.compile(r"^\s*Add semester")).click()
        staff.get_by_placeholder("AY 2026-2027 1st Semester").fill(TEST_TERM)
        dates = staff.locator("input[type=date]")
        dates.nth(0).fill("2031-08-01")
        dates.nth(1).fill("2031-11-29")
        staff.wait_for_timeout(300)
        rt.shot(staff, f"{SLUG}-03")
        staff.get_by_role("button", name=re.compile("Save semester")).click()
        staff.get_by_text(TEST_TERM).first.wait_for()
        rt.settle(staff)
        rt.shot(staff, f"{SLUG}-04")

    # remove a leftover test semester from an earlier run
    def cleanup_term():
        rt.go(staff, "/term-settings")
        row = staff.locator("tr", has_text=TEST_TERM)
        if row.count():
            row.first.get_by_role("button", name=re.compile("Remove")).click()
            staff.get_by_role("button", name="Remove semester").click()
            staff.wait_for_timeout(1000)

    rt.step("Remove leftover test semester (re-run)", cleanup_term)
    rt.step("Add a semester as staff", add_semester)

    def edit_and_remove():
        row = staff.locator("tr", has_text=TEST_TERM).first
        row.get_by_role("button", name=re.compile("Edit dates")).click()
        staff.wait_for_timeout(400)
        staff.locator("input[type=date]").nth(1).fill("2031-11-30")
        staff.get_by_role("button", name=re.compile("Save dates")).click()
        staff.wait_for_timeout(1000)
        rt.shot(staff, f"{SLUG}-05")
        row = staff.locator("tr", has_text=TEST_TERM).first
        row.get_by_role("button", name=re.compile("Remove")).click()
        staff.get_by_role("button", name="Remove semester").wait_for()
        rt.shot(staff, f"{SLUG}-05b")
        staff.get_by_role("button", name="Remove semester").click()
        staff.wait_for_timeout(1000)
        rt.settle(staff)

    rt.step("Edit the new semester's dates, then remove it", edit_and_remove)

    # ---- Part B: Faculty profiles (Academic Coordinator) -----------------------------------
    coord = rt.new_page("academic@usls.edu.ph")

    def faculty_directory():
        rt.go(coord, "/faculty")
        coord.get_by_text("Showing").first.wait_for()
        rt.shot(coord, f"{SLUG}-06")

    rt.step("Faculty directory", faculty_directory)

    def faculty_profile():
        coord.get_by_text("Dr. Liwayway Bautista").first.click()
        coord.wait_for_timeout(1200)
        rt.shot(coord, f"{SLUG}-07")
        coord.keyboard.press("Escape")

    rt.step("Open a faculty profile", faculty_profile)

    # ---- Part C: Demand-backed draft -------------------------------------------------------
    def open_demand():
        _open_adjustments(rt, coord)
        # a previous run leaves the plan Published: start a new draft
        btn = coord.get_by_role("button", name=re.compile("Start new draft"))
        if btn.count():
            btn.first.click()
            coord.wait_for_timeout(1200)
            rt.settle(coord)
        top(coord)
        coord.get_by_text("Subject needs are calculated automatically").first.scroll_into_view_if_needed()
        rt.shot(coord, f"{SLUG}-08")

    rt.step("Open Demand & adjustments for MAED", open_demand)

    def rules_panel():
        top(coord)
        coord.get_by_text("Adding or changing a subject: rules applied").first.click()
        coord.wait_for_timeout(700)
        rt.note("RULES PANEL: " + visible_text(coord, "main", 2500).split("Adjustments and subject demand")[0].replace(chr(10), " | "))
        rt.shot(coord, f"{SLUG}-08b")
        coord.get_by_text("Adding or changing a subject: rules applied").first.click()

    rt.step("Expand the rules-applied panel", rules_panel)

    def governance_and_report():
        shot_at(rt, coord, f"{SLUG}-09", "Demand numbers are guidance", offset=200)
        shot_at(rt, coord, f"{SLUG}-10", "Subject-needs report", offset=90, exact=True)

    rt.step("Metrics and subject-needs report", governance_and_report)

    def decisions_table():
        shot_at(rt, coord, f"{SLUG}-11", "Course offering decisions", offset=90, exact=True)

    rt.step("Course offering decisions table", decisions_table)

    def edit_draft():
        # two sections for the subject with the highest demand, and a faculty choice for it
        first = coord.get_by_label(re.compile(r"^Sections for MAED-COG10$"))
        first.fill("2")
        fac = coord.get_by_label(re.compile(r"^Faculty assignment for MAED-COG10$"))
        opts = fac.locator("option").all_inner_texts()
        suggested = coord.get_by_text(re.compile(r"^Suggested: ")).first.inner_text().replace("Suggested: ", "").strip()
        match = next(o for o in opts if suggested in o)
        fac.select_option(label=match)
        coord.wait_for_timeout(400)
        # add one subject the demand rule did not propose: a manual offering decision
        extra = coord.get_by_role("button", name=re.compile(r"^Offer MAED-MAJ1$"))
        if extra.count():
            extra.first.click()
            coord.wait_for_timeout(400)
        first.scroll_into_view_if_needed()
        coord.evaluate("window.scrollBy(0, -260)")
        coord.wait_for_timeout(300)
        rt.shot(coord, f"{SLUG}-12")

    rt.step("Adjust sections, choose faculty, offer one extra subject", edit_draft)

    def save_draft():
        btn = coord.get_by_role("button", name=re.compile(r"(Save|Update) draft"))
        btn.first.click()
        coord.wait_for_timeout(1500)
        rt.settle(coord)
        top(coord)
        coord.get_by_text("Subject needs are calculated automatically").first.scroll_into_view_if_needed()
        shot_at(rt, coord, f"{SLUG}-13", re.compile(r"Draft saved\."), offset=140, exact=False)

    rt.step("Save draft", save_draft)

    def submit():
        coord.get_by_role("button", name=re.compile("Submit for approval")).click()
        coord.get_by_text(re.compile(r"Submitted to Dean")).first.wait_for()
        rt.settle(coord)
        shot_at(rt, coord, f"{SLUG}-14", re.compile(r"Submitted to Dean"), offset=120)

    rt.step("Submit for approval (plan becomes read-only)", submit)

    # ---- Part D: Dean decision -------------------------------------------------------------
    dean = rt.new_page("dean@usls.edu.ph")

    def dean_queue():
        rt.go(dean, "/dean/approvals/course-adjustments")
        rt.shot(dean, f"{SLUG}-15")
        btn = dean.get_by_role("button", name=re.compile(r"^Approve"))
        btn.first.scroll_into_view_if_needed()
        dean.evaluate("window.scrollBy(0, 250)")
        dean.wait_for_timeout(300)
        rt.shot(dean, f"{SLUG}-15b")

    rt.step("Dean opens Course Adjustments approvals", dean_queue)

    def dean_approve():
        dean.get_by_role("button", name=re.compile(r"^Approve")).first.click()
        dean.wait_for_timeout(1500)
        rt.settle(dean)
        rt.shot(dean, f"{SLUG}-16")

    rt.step("Dean approves the plan", dean_approve)

    # ---- Part E: publish and Offering setup -------------------------------------------------
    def publish():
        _open_adjustments(rt, coord)
        coord.get_by_text(re.compile(r"Approved by")).first.wait_for()
        rt.shot(coord, f"{SLUG}-17")
        coord.get_by_role("button", name=re.compile(r"^Publish$")).click()
        coord.get_by_text(re.compile(r"Published on")).first.wait_for()
        rt.settle(coord)
        shot_at(rt, coord, f"{SLUG}-18", re.compile(r"Published on"), offset=120)

    rt.step("Coordinator publishes the approved plan", publish)

    def offering_setup():
        click_text(coord, "Offering setup", role="tab")
        coord.get_by_text("Course Offering Setup").first.wait_for()
        pick(coord, "Program", f"{PROGRAM} ")
        pick(coord, "Semester", TERM)
        rt.settle(coord)
        rt.shot(coord, f"{SLUG}-19")

    rt.step("Open Offering setup", offering_setup)

    def fill_setup():
        code = "MAED-COG10"
        fac = coord.get_by_label(re.compile(rf"^Faculty for {code}$"))
        print("   faculty for", code, "=", fac.input_value())
        coord.get_by_label(re.compile(rf"^Schedule for {code}$")).fill("Sat 8:00-11:00")
        coord.get_by_label(re.compile(rf"^Section for {code}$")).fill("A")
        coord.wait_for_timeout(300)
        row = coord.locator("tr", has_text=code).first
        row.get_by_role("button", name=re.compile("Save")).click()
        coord.wait_for_timeout(1200)
        rt.settle(coord)
        shot_at(rt, coord, f"{SLUG}-20", code, offset=260)

    rt.step("Set faculty, schedule and section and save", fill_setup)

    def staff_view():
        rt.go(staff, "/course-adjustments")
        click_text(staff, "Demand & adjustments", role="tab")
        pick(staff, "Program", f"{PROGRAM} -")
        pick(staff, "Academic year and semester", TERM)
        rt.settle(staff)
        scroll_to(staff, re.compile(r"Published on"), offset=120)
        rt.shot(staff, f"{SLUG}-21")

    rt.step("Staff see the published plan read-only", staff_view)
