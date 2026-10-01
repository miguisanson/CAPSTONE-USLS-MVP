"""Helpers for the A1 cases (sign-in, business rules, policy documents, policy assistant, monitoring sheet)."""
from __future__ import annotations

import re

from playwright.sync_api import Page

from .common import Runtime


def wait_loaded(page: Page, timeout: int = 30000) -> None:
    """Wait until no 'Loading ...' placeholder or spinner text is visible, then settle."""
    Runtime.settle(page, 300)
    try:
        page.wait_for_function(
            r"() => !/Loading[^\n]{0,40}(\.\.\.|\u2026)/.test((document.querySelector('main') || document.body).innerText)",
            timeout=timeout,
        )
    except Exception:  # noqa: BLE001
        pass
    page.wait_for_timeout(500)


def goto_nav(rt: Runtime, page: Page, label: str, fallback_path: str) -> None:
    """Open a screen from the sidebar by visible label; fall back to the URL."""
    try:
        link = page.get_by_role("link", name=re.compile(rf"(^|\s|\u00b7\s*){re.escape(label)}$")).first
        link.click(timeout=6000)
        Runtime.settle(page)
    except Exception:  # noqa: BLE001
        rt.go(page, fallback_path)
    wait_loaded(page)


def body(page: Page, limit: int = 6000) -> str:
    return page.inner_text("body")[:limit]


_SCROLL_JS = """(e, off) => {
  e.scrollIntoView({block: 'start'});
  let p = e.parentElement;
  while (p) {
    if (p.scrollHeight > p.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(p).overflowY)) { p.scrollTop = Math.max(0, p.scrollTop - off); return true; }
    p = p.parentElement;
  }
  window.scrollBy(0, -off);
  return false;
}"""


def scroll_to(locator, offset: int = 90) -> None:
    """Bring an element to the top of the scrolling area (the app scrolls inside its main pane, not the window)."""
    locator.first.evaluate(_SCROLL_JS, offset)
    locator.page.wait_for_timeout(400)


def scroll_top(page: Page) -> None:
    page.evaluate(
        """() => { window.scrollTo(0,0); document.querySelectorAll('main, div').forEach(e => {
            if (e.scrollTop > 0 && e.scrollHeight > e.clientHeight + 4) e.scrollTop = 0; }); }"""
    )
    page.wait_for_timeout(300)


def asc(text: str) -> str:
    """Console-safe text for notes (the Windows console cannot print every character)."""
    return text.encode("ascii", "replace").decode()


def safe_notes(rt) -> None:
    """Make rt.note ASCII-safe (page text can hold arrows etc. that the Windows console cannot print)."""
    if getattr(rt, "_a1_safe", False):
        return
    original = rt.note
    rt.note = lambda message: original(asc(str(message)))
    rt._a1_safe = True
