"""Shared helpers for the walkthrough capture scripts.

Every case module in this package exposes ``run(rt)`` where ``rt`` is a
:class:`Runtime`. A case logs in (typing the email and password, like a real
user), performs the steps of the matching ``cases/NN_*.json`` file and saves
screenshots through ``rt.shot``.  Steps are wrapped in ``rt.step`` so one
failing step is recorded in ``shots/_capture_log.json`` instead of stopping the
whole run; nothing is faked — a step that cannot be performed is listed as a
failure and the case text must be written around what works.
"""
from __future__ import annotations

import json
import os
import re
import time
import traceback
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

HERE = Path(__file__).resolve().parent.parent
SHOTS = HERE / "shots"
BASE = os.environ.get("WT_BASE", "http://127.0.0.1:5074").rstrip("/")
PASSWORD = "DemoPass123!"
VIEWPORT = {"width": 1366, "height": 768}


class Runtime:
    def __init__(self, playwright):
        self.pw = playwright
        self.browser = playwright.chromium.launch(channel="msedge", headless=True)
        self.log: list[dict] = []
        self.case = "?"
        SHOTS.mkdir(parents=True, exist_ok=True)

    # -- browser sessions ---------------------------------------------------
    def new_page(self, email: str | None = None, *, accept_dialogs: bool = True) -> Page:
        """Open a fresh browser context. With ``email``, sign in by typing."""
        ctx = self.browser.new_context(viewport=VIEWPORT, accept_downloads=True)
        page = ctx.new_page()
        page.set_default_timeout(15000)
        if accept_dialogs:
            page.on("dialog", lambda d: d.accept())
        if email:
            self.login(page, email)
        return page

    def login(self, page: Page, email: str, password: str = PASSWORD) -> None:
        page.goto(BASE + "/login")
        page.wait_for_load_state("networkidle")
        page.get_by_label(re.compile("email", re.I)).first.fill(email)
        page.locator("input[type=password]").first.fill(password)
        page.get_by_role("button", name=re.compile(r"^(sign in|log in)", re.I)).first.click()
        page.wait_for_url(lambda url: "/login" not in url, timeout=20000)
        self.settle(page)

    def logout(self, page: Page) -> None:
        page.get_by_role("button", name=re.compile("sign out", re.I)).first.click()
        page.wait_for_url(re.compile("/login"))
        self.settle(page)

    def go(self, page: Page, path: str) -> None:
        page.goto(BASE + path)
        self.settle(page)

    @staticmethod
    def settle(page: Page, ms: int = 900) -> None:
        try:
            page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:  # noqa: BLE001
            pass
        page.wait_for_timeout(ms)

    # -- demo data ------------------------------------------------------------
    def reset(self, *keys: str) -> None:
        """Reset demo students from the public demo endpoint (same call the
        sign-in page's reset button makes)."""
        import urllib.request

        for key in keys:
            req = urllib.request.Request(f"{BASE}/api/auth/demo-students/{key}/reset", method="POST", data=b"{}",
                                         headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=180) as resp:
                body = json.loads(resp.read().decode())
            self.note(f"reset {key}: {body.get('message')}")

    # -- evidence -------------------------------------------------------------
    def shot(self, page: Page, shot_id: str, *, full: bool = False, locator=None, clip_to_main: bool = False) -> str:
        """Save ``shots/<shot_id>.png`` (1366x768 viewport; ``full`` = full page, capped at 3000 px)."""
        path = SHOTS / f"{shot_id}.png"
        page.wait_for_timeout(400)
        if locator is not None:
            locator.screenshot(path=str(path))
        elif full:
            height = min(int(page.evaluate("Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)")), 3000)
            page.set_viewport_size({"width": VIEWPORT["width"], "height": max(VIEWPORT["height"], height)})
            page.wait_for_timeout(500)
            page.screenshot(path=str(path))
            page.set_viewport_size(VIEWPORT)
        else:
            page.screenshot(path=str(path))
        self.note(f"shot {shot_id}")
        return shot_id

    def note(self, message: str) -> None:
        self.log.append({"case": self.case, "kind": "note", "message": message})
        print(f"  [{self.case}] {message}")

    def step(self, label: str, fn):
        """Run ``fn``; record success/failure. Returns fn's result or None."""
        try:
            result = fn()
            self.log.append({"case": self.case, "kind": "ok", "message": label})
            print(f"  [{self.case}] ok   {label}")
            return result
        except Exception as exc:  # noqa: BLE001
            detail = "".join(traceback.format_exception_only(type(exc), exc)).strip().splitlines()[0][:300]
            self.log.append({"case": self.case, "kind": "FAIL", "message": label, "detail": detail})
            print(f"  [{self.case}] FAIL {label}: {detail}")
            return None

    def write_log(self) -> None:
        (SHOTS / "_capture_log.json").write_text(json.dumps(self.log, indent=1), encoding="utf-8")


# -- small UI helpers used by several cases ---------------------------------
def click_text(page: Page, text: str, *, role: str | None = None, exact: bool = False, nth: int = 0, timeout: int = 10000) -> None:
    if role:
        loc = page.get_by_role(role, name=text if exact else re.compile(re.escape(text), re.I))
    else:
        loc = page.get_by_text(text, exact=exact)
    loc.nth(nth).click(timeout=timeout)


def open_nav(page: Page, label: str) -> None:
    """Click a sidebar item by its visible label (the leading number is optional)."""
    nav = page.locator("aside, nav").filter(has_text=re.compile(re.escape(label)))
    page.get_by_role("link", name=re.compile(rf"(^|\s|·\s*){re.escape(label)}$")).first.click()
    Runtime.settle(page)


def main_text(page: Page, limit: int = 4000) -> str:
    loc = page.locator("main")
    return (loc.last.inner_text() if loc.count() else page.inner_text("body"))[:limit]
