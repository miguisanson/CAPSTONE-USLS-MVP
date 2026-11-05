"""Front-matter screenshots: the empty sign-in page and the staff dashboard after a typed sign-in."""
from __future__ import annotations

from .common import BASE, Runtime


def run(rt: Runtime) -> None:
    page = rt.new_page()
    page.goto(BASE + "/login")
    rt.settle(page)
    rt.shot(page, "front-login")
    page.context.close()

    page = rt.new_page("staff@usls.edu.ph")
    try:
        page.wait_for_function("!document.body.innerText.includes('Loading')", timeout=20000)
    except Exception:  # noqa: BLE001
        pass
    rt.settle(page, 2500)
    rt.shot(page, "front-dashboard")
    page.context.close()
