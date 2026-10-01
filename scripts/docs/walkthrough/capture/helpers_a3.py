"""Helpers for the standalone-process, practicum and graduation cases (agent A3)."""
from __future__ import annotations

import re
from pathlib import Path

from playwright.sync_api import Page

from .common import Runtime, main_text

UPLOADS = Path("E:/Temp/claude/walkthrough/uploads")


def make_pdf(name: str, title: str, lines: list[str] | None = None) -> str:
    """Create a small valid PDF (PyMuPDF) under the uploads folder and return its path."""
    import fitz  # PyMuPDF

    UPLOADS.mkdir(parents=True, exist_ok=True)
    path = UPLOADS / name
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 90), title, fontsize=16)
    y = 130
    for line in lines or []:
        page.insert_text((72, y), line, fontsize=11)
        y += 20
    doc.save(str(path))
    doc.close()
    return str(path)


def open_link(rt: Runtime, page: Page, label: str, fallback_path: str | None = None) -> None:
    """Open a sidebar link by visible text; fall back to the URL."""
    try:
        page.get_by_role("link", name=re.compile(rf"(^|\s|·\s*){re.escape(label)}\s*$", re.I)).first.click(timeout=6000)
        rt.settle(page, 1200)
    except Exception:  # noqa: BLE001
        if not fallback_path:
            raise
        rt.go(page, fallback_path)


def drag_card(rt: Runtime, page: Page, who: str, column_label: str) -> None:
    """Drag the board card that contains ``who`` onto the column called ``column_label``
    (real pointer drag and drop, no buttons)."""
    source = page.locator("[draggable=true]").filter(has_text=who).first
    source.scroll_into_view_if_needed()
    target = page.locator("section[aria-label]").filter(has=page.get_by_role("heading", name=column_label, exact=True)).first
    if target.count() == 0:
        target = page.get_by_role("region", name=column_label).first
    target.scroll_into_view_if_needed()
    source.drag_to(target, timeout=15000)
    rt.settle(page, 1500)


def board_text(page: Page) -> str:
    return main_text(page, 12000)


def column_holds(page: Page, column_label: str, who: str) -> bool:
    col = page.locator("section[aria-label]").filter(has=page.get_by_role("heading", name=column_label, exact=True)).first
    return who in col.inner_text()


def button(page: Page, name: str, *, exact: bool = False, nth: int = 0, timeout: int = 10000):
    loc = page.get_by_role("button", name=name if exact else re.compile(re.escape(name), re.I))
    return loc.nth(nth)


def frame_board(page: Page, first_column: str | None = None, *, block: str = "center") -> None:
    """Scroll the board into view; with ``first_column`` also scroll the board sideways so that
    column is the left-most one shown."""
    region = page.get_by_role("region", name=re.compile("board", re.I)).first
    region.evaluate(f"el => el.scrollIntoView({{block: '{block}'}})")
    if first_column:
        col = page.locator("section[aria-label]").filter(has=page.get_by_role("heading", name=first_column, exact=True)).first
        col.evaluate("el => { const r = el.closest('[role=region]'); r.scrollLeft += el.getBoundingClientRect().left - r.getBoundingClientRect().left - 8; }")
    page.wait_for_timeout(500)


def center_text(page: Page, pattern: str, *, nth: int = 0) -> None:
    """Scroll an element whose text matches ``pattern`` to the middle of the screen."""
    loc = page.get_by_text(re.compile(pattern, re.I)).nth(nth)
    loc.evaluate("el => el.scrollIntoView({block: 'center'})")
    page.wait_for_timeout(500)


def drag_to_section(rt: Runtime, page: Page, source, section_prefix: str) -> None:
    """Real drag of ``source`` (a locator for a draggable card) onto the board section whose
    aria-label starts with ``section_prefix`` (for example "3 ·")."""
    source.scroll_into_view_if_needed()
    target = page.locator(f'section[aria-label^="{section_prefix}"]').first
    target.scroll_into_view_if_needed()
    source.drag_to(target, timeout=20000)
    rt.settle(page, 1500)


def dialog_text(page: Page) -> str:
    dlg = page.locator("[role=dialog]")
    return " | ".join(dlg.last.inner_text().split("\n")) if dlg.count() else ""


def show_column(page: Page, prefix: str, region_label: str = "board") -> None:
    """Bring the board to the top of the screen with the section whose aria-label starts with
    ``prefix`` as the left-most visible column (header included)."""
    page.evaluate(
        """([prefix, regionLabel]) => {
            const section = document.querySelector(`section[aria-label^="${prefix}"]`);
            if (!section) return;
            const region = section.closest('[role=region]') || section.parentElement;
            region.scrollIntoView({block: 'start'});
            region.scrollLeft += section.getBoundingClientRect().left - region.getBoundingClientRect().left - 8;
            let el = region.parentElement;
            while (el) {
                const st = getComputedStyle(el);
                if (el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(st.overflowY)) { el.scrollTop -= 80; break; }
                el = el.parentElement;
            }
        }""",
        [prefix, region_label],
    )
    page.wait_for_timeout(600)
