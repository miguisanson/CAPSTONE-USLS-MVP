"""Case 01 - real typed sign-in, demo accounts panel, demo student reset, role landing pages, sign-out."""
from __future__ import annotations

import re

from .common import BASE, PASSWORD, Runtime
from .helpers_a1 import body, wait_loaded, safe_notes

SLUG = "signin"


def s(n: int) -> str:
    return f"{SLUG}-{n:02d}"


LANDINGS = [
    # email, shot number, what to wait for
    ("academic@usls.edu.ph", 9),
    ("research@usls.edu.ph", 10),
    ("admin@usls.edu.ph", 11),
    ("dean@usls.edu.ph", 12),
    ("liwayway.bautista@usls.edu.ph", 13),
    ("student@usls.edu.ph", 14),
]


def run(rt: Runtime) -> None:
    safe_notes(rt)
    page = rt.new_page()

    # 1. empty sign-in form
    def empty_form():
        rt.go(page, "/login")
        assert page.get_by_label(re.compile("email", re.I)).first.input_value() == ""
        assert page.locator("input[type=password]").first.input_value() == ""
        rt.shot(page, s(1))
    rt.step("empty sign-in form", empty_form)

    # 2. wrong password is refused
    def wrong_password():
        page.get_by_label(re.compile("email", re.I)).first.type("staff@usls.edu.ph", delay=25)
        page.locator("input[type=password]").first.type("not-the-password", delay=25)
        page.get_by_role("button", name=re.compile(r"^sign in", re.I)).first.click()
        page.wait_for_timeout(1500)
        rt.note("wrong-password message: " + body(page, 1500).replace("\n", " | "))
        rt.shot(page, s(2))
    rt.step("wrong password refused", wrong_password)

    # 3. typed credentials, then sign in
    def typed():
        page.get_by_label(re.compile("email", re.I)).first.fill("")
        page.locator("input[type=password]").first.fill("")
        page.get_by_label(re.compile("email", re.I)).first.type("staff@usls.edu.ph", delay=30)
        page.locator("input[type=password]").first.type(PASSWORD, delay=30)
        rt.shot(page, s(3))
    rt.step("type staff email and password", typed)

    def submit():
        page.get_by_role("button", name=re.compile(r"^sign in", re.I)).first.click()
        page.wait_for_url(lambda u: "/login" not in u, timeout=20000)
        wait_loaded(page)
        rt.note("staff landing url: " + page.url)
        rt.shot(page, s(4))
    rt.step("sign in as staff, landing page", submit)

    # 4. notification bell
    def bell():
        page.get_by_role("button", name=re.compile("notifications", re.I)).first.click()
        page.wait_for_timeout(1200)
        rt.note("bell: " + body(page, 2500).split("Grace Fernandez")[-1][:600].replace("\n", " | "))
        rt.shot(page, s(5))
        page.keyboard.press("Escape")
    rt.step("notification bell", bell)

    # 5. sign out
    def sign_out():
        rt.logout(page)
        rt.shot(page, s(6))
    rt.step("sign out", sign_out)

    # 6. demo accounts panel
    def panel():
        page.get_by_role("button", name=re.compile("Demo accounts", re.I)).first.click()
        page.wait_for_timeout(1500)
        rt.shot(page, s(7), full=True)
    rt.step("demo accounts panel", panel)

    # 7. reset one demo student (window.confirm is auto-accepted by new_page)
    def reset():
        page.get_by_role("button", name=re.compile(r"Student-Handoff|1 . Student Handoff", re.I)).first.click()
        page.wait_for_timeout(600)
        page.get_by_role("button", name=re.compile(r"Reset Anton Bautista", re.I)).first.click()
        page.wait_for_timeout(2500)
        page.get_by_text(re.compile(r"Reset Anton Bautista's")).first.wait_for(timeout=30000)
        rt.note("reset notice: " + page.get_by_text(re.compile(r"Reset Anton Bautista's")).first.inner_text())
        rt.shot(page, s(8), full=True)
    rt.step("reset Anton Bautista demo student", reset)

    # 8. role landings, each through a typed sign-in in its own browser session
    for email, n in LANDINGS:
        def landing(email=email, n=n):
            pg = rt.new_page(email)
            wait_loaded(pg)
            try:
                header = pg.locator("header").first.inner_text()
            except Exception:  # noqa: BLE001
                header = ""
            rt.note(f"landing {email}: {pg.url.replace(BASE, '')} header='{header.strip()[:120]}'")
            rt.shot(pg, s(n))
            pg.context.close()
        rt.step(f"landing page for {email}", landing)

    page.context.close()
