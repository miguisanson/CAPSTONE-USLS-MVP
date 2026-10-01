"""Case 07 - Enrollment: class-list import, single student, the enrollment guard, synchronised outputs."""
from __future__ import annotations

import csv
import re
import tempfile
import time
from pathlib import Path

from .common import Runtime, click_text
from .helpers_a2 import pick, row_for, scroll_to, shot_at, top, visible_text

SLUG = "enrollment"
PROGRAM = "MAED"
CURRENT = "AY 2026-2027 1st Semester"
NEXT = "AY 2026-2027 2nd Semester"
CANDIDATES = ["Cruz, Daniel", "Reyes, Grace", "Santos, Benjamin", "Lim, Adrian"]  # seeded MAED students with nothing taken yet
STATE: dict = {}


def _make_class_list() -> Path:
    """A small class list built from real subject codes and student numbers read in the app."""
    path = Path(tempfile.mkdtemp()) / "MAED_Class_List_Walkthrough.csv"
    header = ["Academic Year", "Term", "Student ID", "Last Name", "First Name", "Program", "Subject Code", "Subject Title",
              "Section", "Faculty", "Schedule", "Units", "Enrollment Status", "Status Effective Date", "Remarks"]
    today = time.strftime("%Y-%m-%d")
    rows = [
        ["2026-2027", "1st Semester", "GS-2026-ENR-01", "Dela Cruz", "Clarissa", "MAED", "MAED-MAJ2", "MAED-MAJ2", "A", "Dr. Marlon Geronimo", "Sat 8:00-11:00", "3", "Enrolled", today, "Late enrollment"],
        ["2026-2027", "1st Semester", "GS-2026-ENR-02", "Gonzales", "Martin", "MAED", "MAED-MAJ2", "MAED-MAJ2", "A", "Dr. Marlon Geronimo", "Sat 8:00-11:00", "3", "Enrolled", today, ""],
        ["2026-2027", "1st Semester", "2670001", "Sanson", "Miguel", "MAED", "MAED-MAJ2", "MAED-MAJ2", "A", "Dr. Marlon Geronimo", "Sat 8:00-11:00", "3", "Enrolled", today, "Not a student of record"],
        ["2026-2027", "1st Semester", "2560001", "Cruz", "Daniel", "MAED", "MAED-XYZ9", "Unknown subject", "A", "Dr. Marlon Geronimo", "Sat 8:00-11:00", "3", "Enrolled", today, "Subject code not in the curriculum"],
    ]
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(header)
        writer.writerows(rows)
    return path


def _open_enrollment(rt: Runtime, page, term: str, student: str | None = None) -> None:
    rt.go(page, "/enrollment")
    pick(page, "Program", f"{PROGRAM} ")
    pick(page, "Academic semester", term)
    if student:
        sel = page.locator("select").nth(2)
        opts = sel.locator("option").all_inner_texts()
        sel.select_option(label=next(o for o in opts if student in o))
    rt.settle(page)


def _pick_single_student(rt: Runtime, page) -> str:
    """The seeded student with the fewest subjects already enrolled in the next semester (keeps the case re-runnable
    and below the 12-unit full-time load after two subjects are added)."""
    best, best_count = CANDIDATES[0], 99
    for name in CANDIDATES:
        _open_enrollment(rt, page, NEXT, name)
        page.get_by_text("Official offered subjects").first.wait_for()
        text = visible_text(page, "main", 12000)
        m = re.search(r"Enrolled\s+(\d+)\s+Already active", text)
        count = int(m.group(1)) if m else 99
        if count < best_count:
            best, best_count = name, count
        if count == 0:
            break
    _open_enrollment(rt, page, NEXT, best)
    return best


def _add_subjects(page, count: int) -> list[str]:
    """Click Add on the first ``count`` subjects that can be added; returns their codes."""
    chosen: list[str] = []
    rows = page.locator("tbody tr").all()
    for row in rows:
        btn = row.get_by_role("button", name=re.compile(r"^\s*Add\s*$"))
        if btn.count() and btn.first.is_enabled():
            code = row.locator("td").first.inner_text().split()[0].strip()
            btn.first.click()
            chosen.append(code)
            if len(chosen) >= count:
                break
    return chosen


def run(rt: Runtime) -> None:
    rt.reset("enrollment-clarissa", "enrollment-martin")
    staff = rt.new_page("staff@usls.edu.ph")
    csv_path = _make_class_list()

    # ---- Part A: class list import --------------------------------------------------------
    def enrollment_home():
        _open_enrollment(rt, staff, CURRENT)
        rt.shot(staff, f"{SLUG}-01")

    rt.step("Open Enrollment for MAED, current semester", enrollment_home)

    def rules_panel():
        staff.get_by_text("Enrollment and academic load: rules applied").first.click()
        staff.wait_for_timeout(600)
        t = visible_text(staff, "main", 4000)
        rt.note("LOAD RULES: " + t.split("Adding or changing a subject")[0].replace(chr(10), " | ")[-1800:])
        rt.shot(staff, f"{SLUG}-02")
        staff.get_by_text("Enrollment and academic load: rules applied").first.click()

    rt.step("Expand the load rules panel", rules_panel)

    def preview():
        staff.locator("input[type=file]").first.set_input_files(str(csv_path))
        staff.get_by_text("Preview class list").first.wait_for()
        staff.wait_for_timeout(900)
        rt.note("PREVIEW: " + staff.locator("[role=presentation]").last.inner_text()[:1500].replace(chr(10), " | "))
        rt.shot(staff, f"{SLUG}-03")

    rt.step("Class list preview", preview)

    def confirm_import():
        staff.get_by_role("button", name="Confirm import").click()
        staff.get_by_text("Class list imported").first.wait_for()
        rt.note("IMPORT RESULT: " + staff.get_by_text("Class list imported").first.locator("xpath=ancestor::div[3]").inner_text()[:800].replace(chr(10), " | "))
        rt.shot(staff, f"{SLUG}-04")
        staff.get_by_role("button", name="Done").click()
        rt.settle(staff)

    rt.step("Confirm import", confirm_import)

    # ---- Part B: synchronised outputs of the import ----------------------------------------
    def class_list_screen():
        rt.go(staff, "/enrollment-class-list")
        pick(staff, "Program", f"{PROGRAM} ")
        pick(staff, "Semester", CURRENT)
        pick(staff, "Class list view", "MAED-MAJ2")
        rt.settle(staff)
        staff.get_by_text("Clarissa").first.wait_for()
        rt.note("CLASS LIST: " + visible_text(staff, "main", 2500).replace(chr(10), " | "))
        rt.shot(staff, f"{SLUG}-05")

    rt.step("Enrollment Class List shows the imported roster", class_list_screen)

    # ---- Part C: single student enrollment (next semester, published offerings) -------------
    def single_before():
        STATE["student"] = _pick_single_student(rt, staff)
        rt.note(f"SINGLE STUDENT: {STATE['student']}")
        rt.shot(staff, f"{SLUG}-06")

    rt.step("Open Enrollment for Daniel Cruz, next semester", single_before)

    chosen: list[str] = []

    def single_select():
        chosen.extend(_add_subjects(staff, 2))
        rt.note(f"SINGLE: added {chosen}")
        scroll_to(staff, "Enrollment draft", offset=120, exact=True)
        rt.shot(staff, f"{SLUG}-07")

    rt.step("Select two subjects", single_select)

    def single_confirm():
        staff.get_by_role("button", name="Confirm enrollment").click()
        staff.wait_for_timeout(2500)
        rt.settle(staff)
        top(staff)
        rt.note("SINGLE RESULT: " + visible_text(staff, "main", 6000).split("Student")[0][-300:].replace(chr(10), " | "))
        staff.get_by_text(re.compile(r"enrol", re.I)).first.wait_for()
        rt.shot(staff, f"{SLUG}-08")

    rt.step("Confirm the enrollment", single_confirm)

    def single_outputs():
        rt.go(staff, "/enrollment-class-list")
        pick(staff, "Program", f"{PROGRAM} ")
        pick(staff, "Semester", NEXT)
        rt.settle(staff)
        rt.note("CLASS LIST NEXT: " + visible_text(staff, "main", 2500).replace(chr(10), " | "))
        rt.shot(staff, f"{SLUG}-09")

    rt.step("Class list of the next semester", single_outputs)

    # ---- Part D: the guard -----------------------------------------------------------------
    def guard_window():
        # First registration in a semester is not an "addition"; the rule bites once the student already has a
        # subject in it. Register one subject if needed, then try to add another.
        guard_student = None
        for name in CANDIDATES:
            _open_enrollment(rt, staff, CURRENT, name)
            staff.get_by_text("Official offered subjects").first.wait_for()
            adds = [b for b in staff.get_by_role("button", name=re.compile(r"^\s*Add\s*$")).all() if b.is_enabled()]
            if len(adds) >= 2:
                guard_student = name
                break
        rt.note(f"GUARD STUDENT: {guard_student}")
        for attempt in range(2):
            _open_enrollment(rt, staff, CURRENT, guard_student)
            staff.get_by_text("Official offered subjects").first.wait_for()
            codes = _add_subjects(staff, 1)
            rt.note(f"GUARD window attempt {attempt}: tried {codes}")
            scroll_to(staff, "Enrollment draft", offset=120, exact=True)
            rt.shot(staff, f"{SLUG}-10a")
            staff.get_by_role("button", name="Confirm enrollment").click()
            staff.wait_for_timeout(2500)
            if staff.get_by_text("A business rule applies to this change").count():
                break
        alert = staff.get_by_role("heading", name="A business rule applies to this change").locator("xpath=../../..")
        rt.note("GUARD TEXT: " + alert.inner_text()[:1500].replace(chr(10), " | "))
        scroll_to(staff, "A business rule applies to this change", offset=120, exact=True)
        rt.shot(staff, f"{SLUG}-10")

    rt.step("Add a second subject after the first week: rule panel", guard_window)

    def guard_refuse():
        sel = staff.get_by_label(re.compile(r"^Decision for", re.I)).first
        opts = sel.locator("option").all_inner_texts()
        rt.note(f"GUARD OPTIONS: {opts}")
        sel.select_option(label=next(o for o in opts if "Do not enroll" in o))
        staff.wait_for_timeout(300)
        rt.shot(staff, f"{SLUG}-11")
        staff.get_by_role("button", name="Save with these decisions").click()
        staff.wait_for_timeout(2500)
        rt.settle(staff)
        top(staff)
        rt.note("GUARD RESULT: " + visible_text(staff, "main", 5000).split("Student")[0][-400:].replace(chr(10), " | "))
        rt.shot(staff, f"{SLUG}-12")

    rt.step("Choose Do not enroll", guard_refuse)

    def guard_load():
        _open_enrollment(rt, staff, NEXT, STATE['student'])
        staff.get_by_text("Official offered subjects").first.wait_for()
        codes = _add_subjects(staff, 4)
        rt.note(f"GUARD load: added {codes}")
        scroll_to(staff, "Enrollment draft", offset=120, exact=True)
        rt.shot(staff, f"{SLUG}-13")
        staff.get_by_role("button", name="Confirm enrollment").click()
        staff.get_by_text("A business rule applies to this change").first.wait_for()
        rt.note("LOAD TEXT: " + staff.get_by_role("heading", name="A business rule applies to this change").locator("xpath=../../..").inner_text()[:1500].replace(chr(10), " | "))
        scroll_to(staff, "A business rule applies to this change", offset=120, exact=True)
        rt.shot(staff, f"{SLUG}-14")
        staff.get_by_role("button", name=re.compile("Cancel, change the selection")).click()

    rt.step("Go over the full-time load: rule panel", guard_load)

    # ---- Part E: Monitoring Sheet -----------------------------------------------------------
    def monitoring():
        rt.go(staff, "/monitoring-sheet")
        sels = staff.locator("select")
        opts = sels.nth(0).locator("option").all_inner_texts()
        sels.nth(0).select_option(label=next(o for o in opts if o.startswith("MAED")))
        staff.wait_for_timeout(800)
        topts = sels.nth(1).locator("option").all_inner_texts()
        sels.nth(1).select_option(label=next(o for o in topts if CURRENT in o))
        rt.settle(staff)
        row = staff.locator("tr", has_text="GS-2026-ENR-01").first
        row.scroll_into_view_if_needed()
        staff.evaluate("window.scrollBy(0, 180)")
        staff.wait_for_timeout(400)
        rt.note("MONITORING ROW: " + row.inner_text()[:400].replace(chr(10), " | "))
        rt.shot(staff, f"{SLUG}-15")

    rt.step("Monitoring Sheet shows the imported enrollment", monitoring)
