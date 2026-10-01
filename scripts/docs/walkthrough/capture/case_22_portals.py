"""Case 22: the Dean, Faculty and Student portals - sidebar pages for each role.

Read-only tour (no records are changed). Uses the seeded student Sofia Reyes so it
never collides with the research demo student. Each page is reached by clicking
its sidebar entry by name, like a person would.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

from .common import Runtime, main_text

DUMP = os.environ.get("WT_DUMP")  # optional path: write the visible text of each page for authoring


def _dump(label: str, page) -> None:
    if DUMP:
        with open(DUMP, "a", encoding="utf-8") as fh:
            fh.write(f"\n===== {label}\n{main_text(page, 2500)}\n")


def _nav(rt: Runtime, page, label: str) -> None:
    page.get_by_role("link", name=re.compile(rf"^\s*{re.escape(label)}\s*\d*\s*(waiting)?\s*$", re.I)).first.click()
    rt.settle(page)


def _ready(rt: Runtime, page) -> None:
    try:
        page.wait_for_function("!document.body.innerText.includes('Loading')", timeout=20000)
    except Exception:  # noqa: BLE001
        pass
    rt.settle(page, 1200)


def tour(rt: Runtime, page, prefix: str, pages: list[tuple[str, str]]) -> None:
    for n, (label, shot_id) in enumerate(pages, 1):
        rt.step(f"{prefix}: open {label}", lambda label=label: _nav(rt, page, label))
        _ready(rt, page)
        _dump(f"{prefix} / {label}", page)
        rt.shot(page, shot_id)


def run(rt: Runtime) -> None:
    rt.reset("student-handoff-sofia")

    # Dean
    page = rt.new_page("dean@usls.edu.ph")
    _ready(rt, page)
    _dump("dean dashboard", page)
    rt.shot(page, "portals-dean-01")
    tour(rt, page, "Dean", [
        ("Approvals Queue", "portals-dean-02"),
        ("Decision History", "portals-dean-03"),
        ("Reports & Analytics", "portals-dean-04"),
        ("Business Rules", "portals-dean-05"),
    ])
    page.context.close()

    # Faculty
    page = rt.new_page("liwayway.bautista@usls.edu.ph")
    _ready(rt, page)
    _dump("faculty dashboard", page)
    rt.shot(page, "portals-faculty-01")
    tour(rt, page, "Faculty", [
        ("My Advisees", "portals-faculty-02"),
        ("Panel Invitations", "portals-faculty-03"),
        ("My Availability", "portals-faculty-04"),
        ("My Calendar", "portals-faculty-05"),
    ])
    page.context.close()

    # Student
    page = rt.new_page("handoff.sofia@usls.edu.ph")
    _ready(rt, page)
    _dump("student dashboard", page)
    rt.shot(page, "portals-student-01")
    tour(rt, page, "Student", [
        ("My Progress", "portals-student-02"),
        ("Enrollment", "portals-student-03"),
        ("Request Center", "portals-student-04"),
        ("Messages", "portals-student-05"),
    ])
    page.context.close()
