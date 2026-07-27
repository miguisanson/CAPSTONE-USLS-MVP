"""Capture the current USLS portal screens used by the demo walkthrough.

The script is intentionally read-only: it signs in with seeded demo accounts,
navigates to the requested pages, and captures screenshots without submitting
or changing workflow records.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from playwright.sync_api import Page, sync_playwright


EDGE_PATH = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
PASSWORD = "DemoPass123!"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:5050")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("outputs") / "walkthrough_screenshots",
    )
    return parser.parse_args()


def sign_in(page: Page, base_url: str, role: str, email: str) -> None:
    page.context.clear_cookies()
    response = page.request.post(
        f"{base_url}/api/auth/login",
        data={"role": role, "email": email, "password": PASSWORD},
    )
    if not response.ok:
        raise RuntimeError(
            f"Login failed for {email}: HTTP {response.status} {response.text()}"
        )


def wait_for_screen(page: Page) -> None:
    page.wait_for_load_state("domcontentloaded")
    page.locator("main").wait_for(state="visible", timeout=30_000)
    page.wait_for_timeout(1_000)


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
        target.scroll_into_view_if_needed()
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
        page.wait_for_timeout(1_000)


def click_student_section(page: Page, label: str) -> None:
    button = page.get_by_role("button", name=label, exact=True)
    button.first.click()
    page.wait_for_timeout(700)


def capture_staff_records(page: Page, base_url: str, output_dir: Path) -> None:
    sign_in(page, base_url, "staff", "staff@usls.edu.ph")
    screens = [
        ("student_handoff", "/workflow/student-handoff"),
        ("monitoring_sheet", "/monitoring-sheet"),
        ("student_records", "/students"),
        ("faculty_records", "/faculty"),
        ("enrollment_class_list", "/enrollment-class-list"),
        ("enrollment", "/enrollment?program_id=9&term_id=7&student_id=107"),
        ("loa_staff_review", "/workflow/leave-of-absence"),
        ("readmission_staff_review", "/workflow/readmission"),
        ("awol_residency_staff", "/workflow/awol"),
    ]
    for name, route in screens:
        open_screen(page, base_url, route)
        if name == "monitoring_sheet":
            choose_option_containing(page, 'select[aria-label="Program"]', r"\bMAED\b")
        elif name == "enrollment_class_list":
            choose_option_containing(page, 'select[aria-label="Program"]', r"\bMAPSY\b")
            page.locator('select[aria-label="Class list view"]').select_option("all")
            page.wait_for_timeout(1_000)
        capture(page, output_dir, name)


def capture_course_adjustments(
    page: Page, base_url: str, output_dir: Path
) -> None:
    sign_in(
        page,
        base_url,
        "staff",
        "academic@usls.edu.ph",
    )
    open_screen(page, base_url, "/course-adjustments?view=adjustments")
    choose_option_containing(page, 'select[aria-label="Program"]', r"\bMAED\b")
    capture(
        page,
        output_dir,
        "course_adjustments_demand",
    )
    report = page.get_by_text("Subject-needs report", exact=True).first
    report.evaluate("(element) => element.scrollIntoView({block: 'start'})")
    page.wait_for_timeout(400)
    capture(page, output_dir, "course_adjustments_impact")
    open_screen(page, base_url, "/course-adjustments?view=offerings")
    choose_option_containing(page, 'select[aria-label="Program"]', r"\bMAED\b")
    capture(page, output_dir, "course_adjustments_offerings")


def capture_student_workflow(
    page: Page,
    base_url: str,
    output_dir: Path,
    *,
    email: str,
    section: str,
    filename: str,
    scroll_text: str,
) -> None:
    sign_in(page, base_url, "student", email)
    open_screen(page, base_url, "/student")
    click_student_section(page, section)
    capture(
        page,
        output_dir,
        filename,
        scroll_text=scroll_text,
        text_exact=False,
    )


def capture_dean_approvals(page: Page, base_url: str, output_dir: Path) -> None:
    sign_in(page, base_url, "dean", "dean@usls.edu.ph")
    open_screen(page, base_url, "/approvals")
    standing_tab = page.locator("button").filter(
        has_text="LOA / Readmission / AWOL"
    )
    if standing_tab.count():
        standing_tab.first.click()
        page.wait_for_timeout(700)
    capture(page, output_dir, "dean_standing_approvals")


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
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

        capture_staff_records(page, args.base_url, args.output_dir)
        capture_course_adjustments(page, args.base_url, args.output_dir)
        capture_student_workflow(
            page,
            args.base_url,
            args.output_dir,
            email="loa.daniel@usls.edu.ph",
            section="Leave of Absence",
            filename="loa_student_form",
            scroll_text="Leave of Absence Application",
        )
        capture_student_workflow(
            page,
            args.base_url,
            args.output_dir,
            email="readmission.therese@usls.edu.ph",
            section="Readmission",
            filename="readmission_student_form",
            scroll_text="Submit readmission request",
        )
        capture_student_workflow(
            page,
            args.base_url,
            args.output_dir,
            email="awol.maya@usls.edu.ph",
            section="Return from AWOL",
            filename="return_from_awol_student_form",
            scroll_text="Current AWOL return case",
        )
        capture_dean_approvals(page, args.base_url, args.output_dir)
        context.close()
        browser.close()


if __name__ == "__main__":
    main()
