"""Helpers shared by the Defense Scheduling / Calendars / Verdicts captures (cases 15-17).

Nothing here stages data: it only drives the real screens and reads state through the same
JSON API the pages use (signed in as the same demo accounts) so a capture can tell where the
demonstration defenses are before it acts.
"""
from __future__ import annotations

import http.cookiejar
import json
import re
import time
import urllib.request
from datetime import datetime, timedelta, timezone

from playwright.sync_api import Page

from .common import BASE, PASSWORD, Runtime

MANILA = timezone(timedelta(hours=8))

STAFF = "staff@usls.edu.ph"
DEAN = "dean@usls.edu.ph"
# Faculty logins follow first.last@usls.edu.ph, password DemoPass123!
FAC = {
    "cruz": "angela.cruz@usls.edu.ph",
    "villanueva": "marco.villanueva@usls.edu.ph",
    "ramos": "teodoro.ramos@usls.edu.ph",
    "reyes": "benjamin.reyes@usls.edu.ph",
    "navarro": "paolo.navarro@usls.edu.ph",
    "lim": "teresa.lim@usls.edu.ph",
    "geronimo": "marlon.geronimo@usls.edu.ph",
}
# The three demonstration students with an upcoming Proposal Defense (seeded in demo mode).
UD = {
    "nico": ("GS-2026-UD-01", "Barrientos"),
    "bea": ("GS-2026-UD-02", "Salonga"),
    "gab": ("GS-2026-UD-03", "Tolentino"),
}


class Api:
    """Tiny JSON client (cookie session) for reading state; never used to change data."""

    def __init__(self, email: str, password: str = PASSWORD):
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.call("/api/auth/login", {"email": email, "password": password})

    def call(self, path: str, data=None):
        req = urllib.request.Request(
            BASE + path, data=(json.dumps(data).encode() if data is not None else None),
            method="POST" if data is not None else "GET", headers={"Content-Type": "application/json"},
        )
        for attempt in range(4):
            try:
                with self.op.open(req, timeout=120) as resp:
                    return json.loads(resp.read().decode() or "null")
            except urllib.error.HTTPError as exc:
                body = exc.read().decode()
                if "locked" in body and attempt < 3:
                    time.sleep(2)
                    continue
                return {"HTTP": exc.code, "body": body[:400]}
        return None


def student_ids(staff: Api) -> dict[str, int]:
    out = {}
    res = staff.call("/api/students?q=GS-2026-UD&page_size=50")
    for item in res.get("items", []):
        for key, (number, _name) in UD.items():
            if item["student_number"] == number:
                out[key] = item["id"]
    return out


def sched_state(staff: Api, student_id: int) -> dict:
    ctx = staff.call(f"/api/transactions/defense-scheduling/context?student_id={student_id}")
    schedules = ctx.get("schedules", [])
    active = next((s for s in schedules if s.get("is_active") and s["defense_type"] == "Proposal Defense"), None)
    return {"ctx": ctx, "schedules": schedules, "active": active, "outcome": ctx.get("verdict_outcome")}


def now_manila() -> datetime:
    return datetime.now(MANILA).replace(tzinfo=None)


def wait_until(target: datetime, rt: Runtime | None = None) -> None:
    while True:
        remaining = (target - now_manila()).total_seconds()
        if remaining <= 0:
            return
        if rt:
            rt.note(f"waiting {int(remaining)} s until {target:%H:%M:%S}")
        time.sleep(min(remaining + 1, 30))


# -- pages ------------------------------------------------------------------------------------
def new_staff_page(rt: Runtime, email: str = STAFF) -> Page:
    """A signed-in page whose prompt() dialogs are answered with the text in page._prompt_answers."""
    page = rt.new_page(email, accept_dialogs=False)
    page._prompt_answers = []  # type: ignore[attr-defined]

    def on_dialog(dialog):
        answers = page._prompt_answers  # type: ignore[attr-defined]
        if dialog.type == "prompt":
            text = answers.pop(0) if answers else (dialog.default_value or "GS Office")
            rt.note(f"prompt: {dialog.message[:70]!r} -> {text!r}")
            dialog.accept(text)
        else:
            dialog.accept()

    page.on("dialog", on_dialog)
    return page


def open_defense_scheduling(rt: Runtime, page: Page) -> None:
    try:
        page.get_by_role("link", name=re.compile(r"Defense Scheduling$")).first.click(timeout=6000)
        rt.settle(page)
    except Exception:  # noqa: BLE001
        rt.go(page, "/workflow/defense-scheduling")


def pick_student(rt: Runtime, page: Page, surname: str) -> None:
    """Choose a student in the Defense Scheduling picker by typing a surname."""
    if page.get_by_text("Selected student").count():
        page.get_by_label("Clear selected student").click()
        page.wait_for_timeout(500)
    box = page.get_by_label("Search a student")
    box.click()
    box.fill(surname)
    page.wait_for_timeout(1500)
    page.get_by_text(surname, exact=False).first.click()
    rt.settle(page, 2500)
    page.get_by_text("Coordinate the defense schedule").wait_for(timeout=15000)


def fill_slot(page: Page, day: str, start: str, end: str, venue: str | None = None) -> None:
    page.get_by_label("Selected date").fill(day)
    page.get_by_label("Start time").fill(start)
    page.get_by_label("End time").fill(end)
    if venue is not None:
        page.get_by_label("Venue / meeting link").fill(venue)
    page.wait_for_timeout(1800)


def slot_check_text(page: Page) -> str:
    return " | ".join(t.strip() for t in page.locator("[aria-live=polite]").all_inner_texts() if t.strip())


def scroll_to_text(page: Page, text: str, *, exact: bool = False, offset: int = 120) -> None:
    """Bring the first element with this text to the top of the screen (below the header)."""
    loc = page.get_by_text(text, exact=exact).first
    loc.wait_for(timeout=15000)
    loc.evaluate("e => e.scrollIntoView({block: 'start'})")
    page.evaluate("(o) => { for (const el of [document.scrollingElement, document.querySelector('main'), document.querySelector('main')?.parentElement]) { if (el) el.scrollTop -= o; } }", offset)
    page.wait_for_timeout(500)


def page_text(page: Page, limit: int = 3000) -> str:
    loc = page.locator("main")
    return (loc.last.inner_text() if loc.count() else page.inner_text("body"))[:limit]


def bell_text(page: Page) -> str:
    """Open the notification bell and return its text (left open for a screenshot)."""
    page.get_by_role("button", name=re.compile("^Notifications", re.I)).first.click()
    page.wait_for_timeout(1200)
    return page.get_by_role("region", name="Notifications").inner_text()
