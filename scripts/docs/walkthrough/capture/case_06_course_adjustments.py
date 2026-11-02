"""Case 06 - Course Adjustments (Demand & adjustments, Dean approval, Offering setup) + Academic Semesters + Faculty profiles."""
from __future__ import annotations

import re
import time

from .common import VIEWPORT, Runtime, click_text
from .helpers_a2 import pick, scroll_to, top, visible_text

PROGRAM = "MAED"
TERM = "AY 2026-2027 2nd Semester"
SLUG = "course-adjustments"
SUFFIX = time.strftime("%H%M")
TEST_TERM = "AY 2031-2032 1st Semester"



def _shot(rt: Runtime, page, shot_id: str, **kw) -> str:
    """rt.shot with a retry: Windows now and then refuses the first write of a PNG (OSError 22)."""
    for attempt in range(3):
        try:
            return rt.shot(page, shot_id, **kw)
        except OSError:
            page.wait_for_timeout(700)
    return rt.shot(page, shot_id, **kw)


def shot_at(rt, page, shot_id, text, *, offset=90, nth=0, exact=False):
    scroll_to(page, text, offset=offset, nth=nth, exact=exact)
    _shot(rt, page, shot_id)


def _open_adjustments(rt: Runtime, page) -> None:
    rt.go(page, "/course-adjustments")
    click_text(page, "Demand & adjustments", role="tab")
    page.wait_for_timeout(500)
    pick(page, "Program", f"{PROGRAM} -")
    pick(page, "Academic year and semester", TERM)
    rt.settle(page)


def _scroll_search(page) -> None:
    """Bring the search box above the decisions table to the top of the screen."""
    page.get_by_placeholder("Search a subject or a student").evaluate("e => e.scrollIntoView({block: 'start'})")
    page.evaluate("window.scrollBy(0, -90)")
    page.wait_for_timeout(350)


def _maed_card(page):
    """The Dean's card of the MAED plan (the seed also leaves plans of other programs waiting; never decide those)."""
    return page.locator("div").filter(has_text="Course offerings · MAED").filter(has=page.get_by_role("button", name=re.compile(r"^Approve"))).last


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
        _shot(rt, staff, f"{SLUG}-01")

    rt.step("Academic Semesters list", semesters_list)

    def edit_form_open():
        row = staff.locator("tr", has_text="AY 2026-2027 1st Semester").first
        row.get_by_role("button", name=re.compile("Edit dates")).click()
        staff.wait_for_timeout(500)
        scroll_to(staff, re.compile(r"Edit dates: AY 2026-2027 1st"), offset=260)
        _shot(rt, staff, f"{SLUG}-02")
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
        _shot(rt, staff, f"{SLUG}-03")
        staff.get_by_role("button", name=re.compile("Save semester")).click()
        staff.get_by_text(TEST_TERM).first.wait_for()
        rt.settle(staff)
        _shot(rt, staff, f"{SLUG}-04")

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
        _shot(rt, staff, f"{SLUG}-05")
        row = staff.locator("tr", has_text=TEST_TERM).first
        row.get_by_role("button", name=re.compile("Remove")).click()
        staff.get_by_role("button", name="Remove semester").wait_for()
        _shot(rt, staff, f"{SLUG}-05b")
        staff.get_by_role("button", name="Remove semester").click()
        staff.wait_for_timeout(1000)
        rt.settle(staff)

    rt.step("Edit the new semester's dates, then remove it", edit_and_remove)

    # ---- Part B: Faculty profiles (Academic Coordinator) -----------------------------------
    coord = rt.new_page("academic@usls.edu.ph")

    def faculty_directory():
        rt.go(coord, "/faculty")
        coord.get_by_text("Showing").first.wait_for()
        _shot(rt, coord, f"{SLUG}-06")

    rt.step("Faculty directory", faculty_directory)

    def faculty_profile():
        coord.get_by_text("Dr. Liwayway Bautista").first.click()
        coord.wait_for_timeout(1200)
        _shot(rt, coord, f"{SLUG}-07")
        cal = coord.get_by_text("Calendar connection").first
        cal.scroll_into_view_if_needed()
        coord.wait_for_timeout(600)
        rt.note("PROFILE TEXT: " + coord.get_by_role("dialog").inner_text()[:2500].replace(chr(10), " | "))
        _shot(rt, coord, f"{SLUG}-07b")
        coord.keyboard.press("Escape")

    rt.step("Open a faculty profile", faculty_profile)

    # ---- Part C: Demand-backed draft -------------------------------------------------------
    wide = {"width": 1600, "height": 900}  # the decisions table is wider than the 1366 px frame

    def open_demand():
        _open_adjustments(rt, coord)
        # a previous run leaves the plan Published: start a new draft
        btn = coord.get_by_role("button", name=re.compile("Start new draft"))
        if btn.count():
            btn.first.click()
            coord.wait_for_timeout(1200)
            rt.settle(coord)
        top(coord)
        _shot(rt, coord, f"{SLUG}-08")

    rt.step("Open Demand & adjustments for MAED", open_demand)

    def rules_panel():
        top(coord)
        coord.get_by_text("Adding or changing a subject: rules applied").first.click()
        coord.wait_for_timeout(700)
        rt.note("RULES PANEL: " + visible_text(coord, "main", 2500).split("Adjustments and subject demand")[0].replace(chr(10), " | "))
        _shot(rt, coord, f"{SLUG}-08b")
        coord.get_by_text("Adding or changing a subject: rules applied").first.click()

    rt.step("Expand the rules-applied panel", rules_panel)

    def strip_and_counters():
        shot_at(rt, coord, f"{SLUG}-09", "Offering plan progress", offset=90, exact=True)

    rt.step("Plan strip, plan buttons and counters", strip_and_counters)

    def report_header():
        coord.set_viewport_size(wide)
        coord.wait_for_timeout(500)
        shot_at(rt, coord, f"{SLUG}-10", "Course offering decisions", offset=90, exact=True)

    rt.step("Course offering decisions header and summary", report_header)

    def filter_pill():
        coord.get_by_role("button", name=re.compile(r"^Needed next term \(")).click()
        coord.wait_for_timeout(500)
        _scroll_search(coord)
        rt.note("NEEDED NEXT TERM ROWS: " + " / ".join(r.inner_text().split(chr(10))[0] for r in coord.locator("tbody tr").all()))
        _shot(rt, coord, f"{SLUG}-11")
        coord.get_by_role("button", name=re.compile(r"^All subjects \(")).click()
        coord.wait_for_timeout(300)

    rt.step("Filter: Needed next term", filter_pill)

    def details_drawer():
        btn = coord.get_by_role("button", name=re.compile(r"^Details for MAED-MAJ1$"))
        btn.first.scroll_into_view_if_needed()
        btn.first.click()
        coord.get_by_role("dialog").wait_for()
        coord.wait_for_timeout(500)
        _shot(rt, coord, f"{SLUG}-11b")
        coord.get_by_role("button", name="Close details").click()
        coord.wait_for_timeout(400)

    rt.step("Details drawer of MAED-MAJ1", details_drawer)

    def edit_draft():
        # two sections for the subject with the highest demand, and the suggested faculty member for it
        first = coord.get_by_label(re.compile(r"^Sections for MAED-MAJ1$"))
        first.fill("2")
        fac = coord.get_by_label(re.compile(r"^Faculty assignment for MAED-MAJ1$"))
        opts = fac.locator("option").all_inner_texts()
        note = coord.locator("p", has_text="is the same suggested faculty member").first
        suggested = note.locator("span").first.inner_text().strip() if note.count() else ""
        rt.note(f"SUGGESTED FACULTY: {suggested!r}; options {opts[:3]}")
        match = next(o for o in opts if suggested and suggested in o)
        fac.select_option(label=match)
        coord.wait_for_timeout(400)
        # add one subject the demand rule did not propose: a manual offering decision
        extra = coord.get_by_role("button", name=re.compile(r"^Offer MAED-COG10$"))
        if extra.count():
            extra.first.click()
            coord.wait_for_timeout(400)
        _scroll_search(coord)
        _shot(rt, coord, f"{SLUG}-12")

    rt.step("Adjust sections, choose faculty, offer one extra subject", edit_draft)

    def save_draft():
        coord.set_viewport_size(VIEWPORT)
        btn = coord.get_by_role("button", name=re.compile(r"(Save|Update) draft"))
        btn.first.click()
        coord.wait_for_timeout(1500)
        rt.settle(coord)
        top(coord)
        shot_at(rt, coord, f"{SLUG}-13", "Offering plan progress", offset=90, exact=True)

    rt.step("Save draft", save_draft)

    def submit():
        coord.get_by_role("button", name=re.compile("Submit for approval")).click()
        coord.get_by_role("dialog").wait_for()
        coord.wait_for_timeout(400)
        _shot(rt, coord, f"{SLUG}-14a")
        coord.get_by_role("dialog").get_by_role("button", name="Submit plan").click()
        coord.get_by_text(re.compile(r"Submitted to Dean")).first.wait_for()
        rt.settle(coord)
        shot_at(rt, coord, f"{SLUG}-14", "Offering plan progress", offset=90, exact=True)

    rt.step("Submit for approval (plan becomes read-only)", submit)

    # ---- Part D: Dean decision -------------------------------------------------------------
    dean = rt.new_page("dean@usls.edu.ph")

    def dean_queue():
        rt.go(dean, "/dean/approvals/course-adjustments")
        dean.get_by_text("Course offerings · MAED").first.wait_for()
        rt.note("DEAN PLANS: " + " / ".join(dean.locator("h2").all_inner_texts()))
        top(dean)
        _shot(rt, dean, f"{SLUG}-15")
        scroll_to(dean, "Course offerings · MAED", offset=90, exact=True)
        _shot(rt, dean, f"{SLUG}-15a")
        _maed_card(dean).get_by_role("button", name=re.compile(r"^Approve")).scroll_into_view_if_needed()
        dean.evaluate("window.scrollBy(0, 250)")
        dean.wait_for_timeout(300)
        _shot(rt, dean, f"{SLUG}-15b")

    rt.step("Dean opens Course Adjustments approvals", dean_queue)

    def dean_approve():
        _maed_card(dean).get_by_role("button", name=re.compile(r"^Approve")).click()
        dean.get_by_role("dialog").wait_for()
        dean.wait_for_timeout(400)
        rt.note("DEAN CONFIRM: " + dean.get_by_role("dialog").inner_text().replace(chr(10), " | "))
        _shot(rt, dean, f"{SLUG}-15c")
        dean.get_by_role("dialog").get_by_role("button", name="Approve").click()
        dean.wait_for_timeout(1500)
        rt.settle(dean)
        top(dean)
        _shot(rt, dean, f"{SLUG}-16")

    rt.step("Dean approves the plan", dean_approve)

    # ---- Part E: publish and Offering setup -------------------------------------------------
    def publish():
        _open_adjustments(rt, coord)
        coord.get_by_text(re.compile(r"Approved by")).first.wait_for()
        shot_at(rt, coord, f"{SLUG}-17", "Offering plan progress", offset=90, exact=True)
        coord.get_by_role("button", name=re.compile(r"^Publish$")).click()
        coord.get_by_role("dialog").wait_for()
        coord.wait_for_timeout(400)
        _shot(rt, coord, f"{SLUG}-17b")
        coord.get_by_role("dialog").get_by_role("button", name="Publish plan").click()
        coord.get_by_text(re.compile(r"Published on")).first.wait_for()
        rt.settle(coord)
        shot_at(rt, coord, f"{SLUG}-18", "Offering plan progress", offset=90, exact=True)

    rt.step("Coordinator publishes the approved plan", publish)

    def offering_setup():
        click_text(coord, "Offering setup", role="tab")
        coord.get_by_text("Course Offering Setup").first.wait_for()
        pick(coord, "Program", f"{PROGRAM} ")
        pick(coord, "Semester", TERM)
        rt.settle(coord)
        top(coord)
        _shot(rt, coord, f"{SLUG}-19")

    rt.step("Open Offering setup", offering_setup)

    def fill_setup():
        code = "MAED-MAJ1"
        fac = coord.get_by_label(re.compile(rf"^Faculty for {code}$"))
        print("   faculty for", code, "=", fac.input_value())
        coord.get_by_label(re.compile(rf"^Schedule for {code}$")).fill("Sat 8:00-11:00")
        coord.get_by_label(re.compile(rf"^Section for {code}$")).fill("A")
        coord.wait_for_timeout(300)
        row = coord.locator("tr", has_text=re.compile(code + r"(?!\d)")).first
        row.get_by_role("button", name=re.compile("Save")).click()
        coord.wait_for_timeout(1200)
        rt.settle(coord)
        rt.note("SETUP ROW: " + row.inner_text().replace(chr(10), " | "))
        row.evaluate("e => e.scrollIntoView({block: 'center'})")
        coord.wait_for_timeout(400)
        _shot(rt, coord, f"{SLUG}-20")

    rt.step("Set schedule and section and save", fill_setup)

    def staff_view():
        rt.go(staff, "/course-adjustments")
        click_text(staff, "Demand & adjustments", role="tab")
        pick(staff, "Program", f"{PROGRAM} -")
        pick(staff, "Academic year and semester", TERM)
        rt.settle(staff)
        scroll_to(staff, "Offering plan progress", offset=90, exact=True)
        _shot(rt, staff, f"{SLUG}-21")

    rt.step("Staff see the published plan read-only", staff_view)
