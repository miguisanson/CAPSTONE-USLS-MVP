"""Capture detailed, screen-accurate walkthrough screenshots from the live app.

Most captures are read-only.  The standing-change captures use only the
purpose-built demo students, reset those demo cases before the flow, and reset
them again in ``finally`` so the shared demo returns to its documented baseline.
"""

from __future__ import annotations

import argparse
import re
from datetime import date
from pathlib import Path
from typing import Any

from playwright.sync_api import Locator, Page, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
EDGE_PATH = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
PASSWORD = "DemoPass123!"
STANDING_DEMO_KEYS = (
    "leave-of-absence-daniel",
    "readmission-therese",
    "awol-maya",
    "residency-nicolas",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:5050")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT / "outputs" / "walkthrough_screenshots",
    )
    parser.add_argument(
        "--standing-only",
        action="store_true",
        help="Capture only LOA, readmission, AWOL return, Dean, and residency.",
    )
    parser.add_argument(
        "--residency-only",
        action="store_true",
        help="Capture only the controlled Residency workflow.",
    )
    parser.add_argument(
        "--core-only",
        action="store_true",
        help="Capture only records, enrollment, and course-adjustment screens.",
    )
    return parser.parse_args()


def checked_json(response, label: str) -> dict[str, Any]:
    if not response.ok:
        raise RuntimeError(
            f"{label} failed: HTTP {response.status} {response.text()}"
        )
    return response.json()


def sign_in(page: Page, base_url: str, role: str, email: str) -> None:
    page.context.clear_cookies()
    checked_json(
        page.request.post(
            f"{base_url}/api/auth/login",
            data={"role": role, "email": email, "password": PASSWORD},
        ),
        f"Login for {email}",
    )


def wait_for_screen(page: Page) -> None:
    page.wait_for_load_state("domcontentloaded")
    page.locator("main").wait_for(state="visible", timeout=30_000)
    page.wait_for_timeout(900)


def open_screen(page: Page, base_url: str, route: str) -> None:
    page.goto(f"{base_url}{route}", wait_until="domcontentloaded")
    wait_for_screen(page)


def capture(
    page: Page,
    output_dir: Path,
    name: str,
    *,
    scroll_text: str | None = None,
    text_exact: bool = True,
) -> None:
    if scroll_text:
        target = page.get_by_text(scroll_text, exact=text_exact).first
        target.wait_for(state="visible", timeout=20_000)
        target.evaluate("(element) => element.scrollIntoView({block: 'start'})")
        page.wait_for_timeout(400)
    page.screenshot(
        path=output_dir / f"{name}.png",
        full_page=False,
        animations="disabled",
    )
    heading = page.locator("h1").first
    heading_text = heading.inner_text().strip() if heading.count() else "(no h1)"
    print(f"{name}: {page.url} | {heading_text}")


def choose_option_containing(page: Page, selector: str, text: str) -> None:
    select = page.locator(selector).first
    if not select.count():
        return
    option = select.locator("option").filter(has_text=re.compile(text, re.I)).first
    if option.count():
        select.select_option(option.get_attribute("value"))
        page.wait_for_timeout(900)


def click_student_section(page: Page, label: str) -> None:
    page.get_by_role("button", name=label, exact=True).first.click()
    page.wait_for_timeout(700)


def close_dialog(page: Page) -> None:
    close = page.locator(
        'button[aria-label*="Close"], button[aria-label*="close"]'
    ).last
    if close.count():
        close.click()
        page.wait_for_timeout(350)
    else:
        page.keyboard.press("Escape")
        page.wait_for_timeout(350)


def first_nonempty_option(select: Locator) -> str:
    values = select.locator("option").evaluate_all(
        "(options) => options.map((option) => option.value).filter(Boolean)"
    )
    if not values:
        raise RuntimeError("Select has no usable options.")
    return str(values[0])


def capture_core_records(
    page: Page,
    base_url: str,
    output_dir: Path,
) -> None:
    sign_in(page, base_url, "staff", "staff@usls.edu.ph")

    open_screen(page, base_url, "/workflow/student-handoff")
    capture(page, output_dir, "student_handoff")
    capture(
        page,
        output_dir,
        "student_handoff_upload_history",
        scroll_text="Upload history",
    )

    open_screen(page, base_url, "/monitoring-sheet")
    choose_option_containing(page, 'select[aria-label="Program"]', r"\bMAED\b")
    capture(page, output_dir, "monitoring_sheet")

    open_screen(page, base_url, "/students")
    capture(page, output_dir, "student_records")
    open_screen(page, base_url, "/students?q=GS-2026-HO-01")
    capture(page, output_dir, "students_filtered")
    student_results = checked_json(
        page.request.get(
            f"{base_url}/api/students?q=GS-2026-HO-01&page_size=10"
        ),
        "Find Student Handoff demo record",
    )
    if student_results.get("items"):
        student_id = student_results["items"][0]["id"]
        open_screen(page, base_url, f"/students/{student_id}")
        capture(page, output_dir, "student_record_detail")
        capture(
            page,
            output_dir,
            "student_record_activity",
            scroll_text="Activity timeline",
        )

    open_screen(page, base_url, "/faculty")
    capture(page, output_dir, "faculty_records")
    first_faculty = page.locator("tbody tr").first
    if first_faculty.count():
        first_faculty.click()
        page.get_by_role("dialog").wait_for(state="visible")
        capture(page, output_dir, "faculty_profile_detail")
        close_dialog(page)

    open_screen(page, base_url, "/enrollment?program_id=9&term_id=7&student_id=107")
    capture(page, output_dir, "enrollment")
    capture(
        page,
        output_dir,
        "enrollment_offered_subjects",
        scroll_text="Official offered subjects",
    )
    class_list = (
        ROOT
        / "Documents"
        / "Stakeholder_Meeting_Prep"
        / "Enrollment_Class_List_Template.csv"
    )
    upload = page.locator('input[type="file"][accept*=".csv"]').first
    if class_list.exists() and upload.count():
        upload.set_input_files(class_list)
        page.get_by_role("dialog").wait_for(state="visible", timeout=30_000)
        capture(page, output_dir, "enrollment_class_list_preview")
        close_dialog(page)

    open_screen(page, base_url, "/enrollment-class-list")
    choose_option_containing(page, 'select[aria-label="Program"]', r"\bMAPSY\b")
    page.locator('select[aria-label="Class list view"]').select_option("all")
    page.wait_for_timeout(900)
    capture(page, output_dir, "enrollment_class_list")


def capture_course_adjustments(
    page: Page,
    base_url: str,
    output_dir: Path,
) -> None:
    sign_in(page, base_url, "staff", "academic@usls.edu.ph")
    open_screen(page, base_url, "/course-adjustments?view=adjustments")
    choose_option_containing(page, 'select[aria-label="Program"]', r"\bMAED\b")
    capture(page, output_dir, "course_adjustments_demand")
    capture(
        page,
        output_dir,
        "course_adjustments_impact",
        scroll_text="Subject-needs report",
    )
    open_screen(page, base_url, "/course-adjustments?view=offerings")
    choose_option_containing(page, 'select[aria-label="Program"]', r"\bMAED\b")
    capture(page, output_dir, "course_adjustments_offerings")


def reset_standing_demos(page: Page, base_url: str) -> None:
    page.context.clear_cookies()
    for demo_key in STANDING_DEMO_KEYS:
        checked_json(
            page.request.post(
                f"{base_url}/api/auth/demo-students/{demo_key}/reset",
                data={},
            ),
            f"Reset {demo_key}",
        )


def student_context(page: Page, base_url: str) -> dict[str, Any]:
    return checked_json(
        page.request.get(f"{base_url}/api/student-portal/context"),
        "Student portal context",
    )


def submit_student_request(
    page: Page,
    base_url: str,
    request_type: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    return checked_json(
        page.request.post(
            f"{base_url}/api/student-portal/requests/{request_type}",
            data=payload,
        ),
        f"Submit {request_type}",
    )


def capture_student_form(
    page: Page,
    base_url: str,
    output_dir: Path,
    *,
    email: str,
    section: str,
    form_filename: str,
    form_anchor: str | None,
) -> None:
    sign_in(page, base_url, "student", email)
    open_screen(page, base_url, "/student")
    click_student_section(page, section)
    capture(
        page,
        output_dir,
        form_filename,
        scroll_text=form_anchor,
        text_exact=False,
    )
    history = page.get_by_text("View stage history", exact=True)
    if history.count():
        history.first.click()
        page.wait_for_timeout(400)
        capture(page, output_dir, f"{form_filename}_stage_history")


def filter_and_open_staff_request(
    page: Page,
    output_dir: Path,
    *,
    name: str,
    list_filename: str,
    detail_filename: str,
) -> None:
    search = page.locator(
        'input[placeholder*="Search name, student ID, or program"]'
    ).first
    if search.count():
        search.fill(name)
        page.wait_for_timeout(700)
    capture(page, output_dir, list_filename)
    card = page.locator("article").filter(has_text=name).first
    review = (
        card.get_by_role("button", name=re.compile(r"Review|View"))
        if card.count()
        else page.get_by_role("button", name=re.compile(r"Review|View")).first
    )
    if review.count():
        review.click()
        page.get_by_role("dialog").wait_for(state="visible")
        capture(page, output_dir, detail_filename)
        close_dialog(page)


def forward_standing_cases(
    page: Page,
    base_url: str,
    output_dir: Path,
    case_data: dict[str, dict[str, Any]],
) -> None:
    sign_in(page, base_url, "staff", "staff@usls.edu.ph")

    open_screen(page, base_url, "/workflow/leave-of-absence")
    filter_and_open_staff_request(
        page,
        output_dir,
        name="Daniel Fernandez",
        list_filename="loa_staff_requests",
        detail_filename="loa_staff_policy_review",
    )
    loa = case_data["leave-of-absence"]
    checked_json(
        page.request.post(
            f"{base_url}/api/transactions/leave-of-absence",
            data={
                "student_id": loa["student_id"],
                "request_date": date.today().isoformat(),
                **loa["payload"],
                "eligibility_status": "Eligible",
                "staff_notes": (
                    "Structured fields and one-to-two-semester policy checked; "
                    "forwarded for the Dean's recorded decision."
                ),
            },
        ),
        "Forward LOA to Dean",
    )

    open_screen(page, base_url, "/workflow/readmission")
    filter_and_open_staff_request(
        page,
        output_dir,
        name="Therese Lacson",
        list_filename="readmission_staff_requests",
        detail_filename="readmission_staff_policy_review",
    )
    readmission = case_data["readmission"]
    payload = readmission["payload"]
    checked_json(
        page.request.post(
            f"{base_url}/api/transactions/readmission",
            data={
                "student_id": readmission["student_id"],
                **payload,
                "previous_loa_period": (
                    f"{payload['previous_loa_start']} to "
                    f"{payload['previous_loa_end']}"
                ),
                "eligibility_status": "Eligible to Return",
                "missing_requirements": "",
                "staff_notes": (
                    "Return semester, previous LOA, intention, and all checklist "
                    "items verified before Dean routing."
                ),
            },
        ),
        "Forward readmission to Dean",
    )

    open_screen(page, base_url, "/workflow/awol")
    board_search = page.locator(
        'input[placeholder*="Search student, program, status"]'
    ).first
    if board_search.count():
        board_search.fill("Maya Torres")
        page.wait_for_timeout(700)
    capture(page, output_dir, "awol_staff_cases")
    card = page.locator("article").filter(has_text="Maya Torres").first
    if card.count():
        card.get_by_role("button", name="View").click()
        page.get_by_role("dialog").wait_for(state="visible")
        capture(page, output_dir, "awol_staff_policy_review")
        close_dialog(page)
    awol = case_data["awol-return"]
    checked_json(
        page.request.post(
            f"{base_url}/api/transactions/awol",
            data={
                "student_id": awol["student_id"],
                "case_id": awol["case_id"],
                "workflow_action": "forward_return_to_dean",
                "staff_notes": (
                    "Written intention and maximum-residence classification "
                    "reviewed; forwarded to the Dean."
                ),
            },
        ),
        "Forward AWOL return to Dean",
    )


def open_dean_item(
    page: Page,
    output_dir: Path,
    *,
    item_text: str,
    filename: str,
) -> None:
    card = page.locator("article").filter(has_text=item_text).first
    if not card.count():
        return
    card.get_by_role("button", name="View full request").click()
    page.get_by_role("dialog").wait_for(state="visible")
    capture(page, output_dir, filename)
    close_dialog(page)


def capture_dean_standing_queue(
    page: Page,
    base_url: str,
    output_dir: Path,
) -> None:
    sign_in(page, base_url, "dean", "dean@usls.edu.ph")
    open_screen(page, base_url, "/approvals")
    page.locator("button").filter(
        has_text="LOA / Readmission / AWOL"
    ).first.click()
    page.wait_for_timeout(700)
    capture(page, output_dir, "dean_standing_approvals")
    search = page.locator(
        'input[placeholder*="Search student, ID, or item"]'
    ).first
    for query, filename in (
        ("Daniel", "dean_loa_approvals"),
        ("Therese", "dean_readmission_approvals"),
        ("Maya", "dean_awol_return_approvals"),
    ):
        if search.count():
            search.fill(query)
            page.wait_for_timeout(650)
            capture(page, output_dir, filename)
    if search.count():
        search.fill("")
        page.wait_for_timeout(500)
    open_dean_item(
        page,
        output_dir,
        item_text="Daniel Fernandez",
        filename="dean_loa_decision",
    )
    open_dean_item(
        page,
        output_dir,
        item_text="Therese Lacson",
        filename="dean_readmission_decision",
    )
    open_dean_item(
        page,
        output_dir,
        item_text="Maya Torres",
        filename="dean_awol_return_decision",
    )


def capture_residency_flow(
    page: Page,
    base_url: str,
    output_dir: Path,
) -> None:
    checked_json(
        page.request.post(
            f"{base_url}/api/auth/demo-students/residency-nicolas/reset",
            data={},
        ),
        "Reset residency demo",
    )
    sign_in(page, base_url, "staff", "staff@usls.edu.ph")
    open_screen(page, base_url, "/workflow/awol")
    capture(page, output_dir, "awol_residency_staff")

    picker = page.get_by_label("Search a student")
    picker.fill("Valdez")
    page.wait_for_timeout(900)
    result = page.get_by_text("Nicolas Valdez", exact=True).last
    result.wait_for(state="visible", timeout=30_000)
    result.click()
    page.wait_for_timeout(500)

    purpose = page.get_by_label("Residency purpose")
    purpose.select_option(first_nonempty_option(purpose))
    semester = page.get_by_label("Semester")
    semester.select_option(first_nonempty_option(semester))
    page.get_by_role("button", name=re.compile(r"Run residency policy checker")).click()
    page.get_by_text("Residency policy review", exact=True).wait_for(
        state="visible",
        timeout=30_000,
    )
    page.wait_for_timeout(400)
    capture(page, output_dir, "residency_policy_review")

    page.get_by_label("Staff verification notes").fill(
        "Verified research-stage exception with adviser/program confirmation; "
        "recording Residency for the selected semester."
    )
    page.get_by_role("button", name="Record residency").click()
    page.get_by_text(
        re.compile(r"Saved\. The student record", re.I)
    ).first.wait_for(state="visible", timeout=30_000)
    page.wait_for_timeout(900)
    capture(page, output_dir, "residency_recorded")

    board_search = page.locator(
        'input[placeholder*="Search student, program, status"]'
    ).first
    if board_search.count():
        board_search.fill("Nicolas Valdez")
        page.wait_for_timeout(700)
    capture(
        page,
        output_dir,
        "residency_case_board",
        scroll_text="AWOL, return, and residency cases",
    )
    card = page.locator("article").filter(has_text="Nicolas Valdez").first
    if card.count():
        card.get_by_role("button", name="View").click()
        page.get_by_role("dialog").wait_for(state="visible")
        capture(page, output_dir, "residency_case_detail")
        close_dialog(page)

    open_screen(page, base_url, "/students?q=GS-2026-RES-01")
    capture(page, output_dir, "residency_students_sync")
    results = checked_json(
        page.request.get(
            f"{base_url}/api/students?q=GS-2026-RES-01&page_size=10"
        ),
        "Find Residency demo record",
    )
    if results.get("items"):
        open_screen(
            page,
            base_url,
            f"/students/{results['items'][0]['id']}",
        )
        capture(page, output_dir, "residency_student_record")


def capture_standing_changes(
    page: Page,
    base_url: str,
    output_dir: Path,
) -> None:
    reset_standing_demos(page, base_url)
    case_data: dict[str, dict[str, Any]] = {}
    try:
        loa_payload = {
            "effective_start": "AY 2026-2027 1st Semester",
            "effective_end": "AY 2026-2027 2nd Semester",
            "reason_category": "Employment / professional obligation",
            "reason_remarks": (
                "I am requesting two consecutive semesters to complete a "
                "temporary professional assignment."
            ),
        }
        capture_student_form(
            page,
            base_url,
            output_dir,
            email="loa.daniel@usls.edu.ph",
            section="Leave of Absence",
            form_filename="loa_student_form",
            form_anchor=None,
        )
        loa_context = student_context(page, base_url)
        submit_student_request(
            page,
            base_url,
            "leave-of-absence",
            loa_payload,
        )
        case_data["leave-of-absence"] = {
            "student_id": loa_context["student"]["id"],
            "payload": loa_payload,
        }
        open_screen(page, base_url, "/student")
        click_student_section(page, "Leave of Absence")
        capture(page, output_dir, "loa_student_submitted")

        readmission_payload = {
            "target_return_term": "AY 2026-2027 1st Semester",
            "previous_loa_start": "AY 2025-2026 1st Semester",
            "previous_loa_end": "AY 2025-2026 2nd Semester",
            "return_intent": (
                "I intend to resume coursework in the stated semester and have "
                "confirmed my updated study plan with the program."
            ),
        }
        capture_student_form(
            page,
            base_url,
            output_dir,
            email="readmission.therese@usls.edu.ph",
            section="Readmission",
            form_filename="readmission_student_form",
            form_anchor=None,
        )
        readmission_context = student_context(page, base_url)
        readmission_payload["readmission_items"] = readmission_context[
            "readmission_requirements"
        ]
        submit_student_request(
            page,
            base_url,
            "readmission",
            readmission_payload,
        )
        case_data["readmission"] = {
            "student_id": readmission_context["student"]["id"],
            "payload": readmission_payload,
        }
        open_screen(page, base_url, "/student")
        click_student_section(page, "Readmission")
        capture(page, output_dir, "readmission_student_submitted")

        awol_payload = {
            "target_return_term": "AY 2026-2027 1st Semester",
            "last_enrolled_term": "AY 2025-2026 2nd Semester",
            "return_intent": (
                "I intend to resume enrollment and complete the remaining "
                "requirements under the approved study plan."
            ),
            "return_reason": (
                "The circumstances that interrupted enrollment have been "
                "resolved, and I am ready to return."
            ),
        }
        capture_student_form(
            page,
            base_url,
            output_dir,
            email="awol.maya@usls.edu.ph",
            section="Return from AWOL",
            form_filename="return_from_awol_student_form",
            form_anchor=None,
        )
        awol_context = student_context(page, base_url)
        submit_student_request(
            page,
            base_url,
            "awol-return",
            awol_payload,
        )
        awol_submitted_context = student_context(page, base_url)
        case_data["awol-return"] = {
            "student_id": awol_context["student"]["id"],
            "case_id": awol_submitted_context["awol_case"]["id"],
            "payload": awol_payload,
        }
        open_screen(page, base_url, "/student")
        click_student_section(page, "Return from AWOL")
        capture(page, output_dir, "return_from_awol_student_submitted")

        forward_standing_cases(page, base_url, output_dir, case_data)
        capture_dean_standing_queue(page, base_url, output_dir)
        capture_residency_flow(page, base_url, output_dir)
    finally:
        reset_standing_demos(page, base_url)


def main() -> None:
    args = parse_args()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    if not EDGE_PATH.exists():
        raise FileNotFoundError(f"Microsoft Edge was not found at {EDGE_PATH}")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=str(EDGE_PATH),
            headless=True,
        )
        context = browser.new_context(
            viewport={"width": 1600, "height": 1000},
            device_scale_factor=1,
            color_scheme="light",
        )
        page = context.new_page()
        page.set_default_timeout(30_000)

        if args.residency_only:
            try:
                capture_residency_flow(page, args.base_url, output_dir)
            finally:
                reset_standing_demos(page, args.base_url)
        elif args.core_only:
            capture_core_records(page, args.base_url, output_dir)
            capture_course_adjustments(page, args.base_url, output_dir)
        elif not args.standing_only:
            capture_core_records(page, args.base_url, output_dir)
            capture_course_adjustments(page, args.base_url, output_dir)
            capture_standing_changes(page, args.base_url, output_dir)
        else:
            capture_standing_changes(page, args.base_url, output_dir)

        context.close()
        browser.close()


if __name__ == "__main__":
    main()
