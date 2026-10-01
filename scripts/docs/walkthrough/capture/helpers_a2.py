"""Helpers shared by the A2 cases (06 course adjustments, 07 enrollment, 08 withdrawal, 09 dropping, 21 reports)."""
from __future__ import annotations

import re

from playwright.sync_api import Page

from .common import Runtime


def scroll_to(page: Page, text: str | re.Pattern, *, offset: int = 90, nth: int = 0, exact: bool = False) -> None:
    """Scroll the first element showing ``text`` near the top of the viewport (window scroll)."""
    loc = page.get_by_text(text, exact=exact) if isinstance(text, str) else page.get_by_text(text)
    el = loc.nth(nth)
    el.wait_for(state="attached", timeout=10000)
    el.evaluate("e => { e.scrollIntoView({block: 'start'}); }")
    page.evaluate(f"window.scrollBy(0, -{offset})")
    page.wait_for_timeout(350)


def shot_at(rt: Runtime, page: Page, shot_id: str, text: str | re.Pattern, *, offset: int = 90, nth: int = 0, exact: bool = False) -> None:
    scroll_to(page, text, offset=offset, nth=nth, exact=exact)
    rt.shot(page, shot_id)


def top(page: Page) -> None:
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(250)


def visible_text(page: Page, selector: str = "main", limit: int = 6000) -> str:
    loc = page.locator(selector)
    return (loc.last.inner_text() if loc.count() else page.inner_text("body"))[:limit]


def pick(page: Page, label: str, option_text: str) -> None:
    """Choose an option (by visible text, substring) in the <select> whose aria-label/label is ``label``."""
    sel = page.get_by_label(re.compile(re.escape(label), re.I)).first
    options = sel.locator("option").all_inner_texts()
    match = next((o for o in options if option_text.lower() in o.lower()), None)
    if match is None:
        raise RuntimeError(f"option {option_text!r} not found in {label!r}: {options[:8]}")
    sel.select_option(label=match)
    page.wait_for_timeout(700)


def row_for(page: Page, code: str):
    """Table row whose subject cell is exactly ``code`` (MAED-COG1 must not match MAED-COG10)."""
    return page.locator("tr", has_text=re.compile(re.escape(code) + r"(?!\d)")).first
