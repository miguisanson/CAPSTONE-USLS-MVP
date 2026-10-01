"""Case 03 - Policy Documents: library, Draft Operations Manual, upload, test a question, replace (version), remove own upload."""
from __future__ import annotations

import re
import tempfile
import time
from pathlib import Path

from .common import Runtime
from .helpers_a1 import goto_nav, scroll_to, scroll_top, wait_loaded, safe_notes

SLUG = "policy-documents"


def s(n: int) -> str:
    return f"{SLUG}-{n:02d}"


def make_pdf(path: Path, title: str, limit: str) -> None:
    import fitz  # PyMuPDF

    doc = fitz.open()
    page = doc.new_page()
    lines = [
        title,
        "",
        "Graduate School Lounge Reservation Rule (walkthrough memo, made-up for demonstration only).",
        "",
        f"Section 1. A student organisation may reserve the Graduate School lounge at most {limit} times per semester.",
        "Section 2. A reservation must be filed with the Graduate School office at least three working days ahead.",
        "Section 3. This memo is an example uploaded during the demonstration and is not a Graduate School policy.",
    ]
    y = 72
    for line in lines:
        page.insert_text((72, y), line, fontsize=11)
        y += 22
    doc.save(str(path))
    doc.close()


def run(rt: Runtime) -> None:
    safe_notes(rt)
    stamp = time.strftime("%Y%m%d-%H%M")
    title = f"Walkthrough Memo - Lounge Reservation {stamp}"
    work = Path(tempfile.gettempdir()) / "wt_policy_docs"
    work.mkdir(exist_ok=True)
    v1 = work / f"Lounge_Reservation_Memo_{stamp}.pdf"
    v2 = work / f"Lounge_Reservation_Memo_{stamp}_v2.pdf"
    make_pdf(v1, title, "four (4)")
    make_pdf(v2, title, "six (6)")
    question = "How many times may a student organisation reserve the Graduate School lounge per semester?"
    rt.note(f"document title: {title}; files {v1.name}, {v2.name}")

    page = rt.new_page("staff@usls.edu.ph")
    created = {"ok": False}

    def library():
        goto_nav(rt, page, "Policy Documents", "/policy-documents")
        page.get_by_role("heading", name=re.compile("Policy document library", re.I)).first.wait_for()
        page.wait_for_timeout(800)
        rt.shot(page, s(1), full=True)
    rt.step("open Policy Documents", library)

    def draft_manual():
        page.get_by_placeholder("Search documents").fill("Operations Manual")
        page.wait_for_timeout(600)
        page.get_by_role("button", name=re.compile(r"Version history", re.I)).first.click()
        page.wait_for_timeout(500)
        rt.shot(page, s(2))
        page.get_by_placeholder("Search documents").fill("")
    rt.step("Operations Manual is a Draft pending validation", draft_manual)

    def day_one_test():
        page.get_by_placeholder(re.compile("library tablets")).fill("Can a student withdraw a subject on Day 1?")
        page.get_by_role("button", name=re.compile("Find passages", re.I)).click()
        page.get_by_text(re.compile(r"passages? found by")).first.wait_for(timeout=60000)
        page.wait_for_timeout(600)
        scroll_to(page.get_by_role("heading", name="Test a question"), 90)
        rt.note("day-1 test: " + page.locator("main").inner_text()[-1800:].replace("\n", " | "))
        rt.shot(page, s(3))
    rt.step("Test a question: Day 1 withdrawal", day_one_test)

    def add_dialog():
        scroll_top(page)
        page.get_by_role("button", name=re.compile(r"Add document", re.I)).first.click()
        page.get_by_role("dialog").wait_for()
        page.wait_for_timeout(500)
        rt.shot(page, s(4))
    rt.step("open Add policy document", add_dialog)

    def fill_upload():
        dlg = page.get_by_role("dialog")
        dlg.locator("input[type=file]").set_input_files(str(v1))
        dlg.get_by_label(re.compile("Document title", re.I)).fill(title)
        dlg.get_by_label(re.compile("Category", re.I)).select_option("Memo")
        dlg.get_by_label(re.compile("Description", re.I)).fill("Made-up lounge reservation rule, uploaded during the walkthrough to show that a new policy is searchable at once.")
        dlg.get_by_label(re.compile("Version note", re.I)).fill("First upload for the walkthrough")
        page.wait_for_timeout(400)
        rt.shot(page, s(5))
    rt.step("choose file and fill details", fill_upload)

    def submit_upload():
        page.get_by_role("dialog").get_by_role("button", name=re.compile("Upload and index", re.I)).click()
        page.get_by_role("status").filter(has_text=re.compile("added|uploaded|indexed|saved", re.I)).first.wait_for(timeout=90000)
        created["ok"] = True
        page.get_by_placeholder("Search documents").fill(stamp)
        page.wait_for_timeout(700)
        scroll_top(page)
        rt.note("upload notice: " + page.get_by_role("status").first.inner_text())
        rt.shot(page, s(6))
        scroll_to(page.get_by_role("heading", name=re.compile(stamp)), 200)
        rt.shot(page, s(13))
    rt.step("upload and index", submit_upload)

    def test_v1():
        page.get_by_placeholder("Search documents").fill("")
        page.get_by_placeholder(re.compile("library tablets")).fill(question)
        page.get_by_role("button", name=re.compile("Find passages", re.I)).click()
        page.get_by_text(re.compile(r"passages? found by")).first.wait_for(timeout=60000)
        page.wait_for_timeout(600)
        scroll_to(page.get_by_role("heading", name="Test a question"), 90)
        rt.note("lounge v1: " + page.locator("main").inner_text()[-1800:].replace("\n", " | "))
        rt.shot(page, s(7))
    rt.step("Test a question: the new memo is found (version 1)", test_v1)

    def replace_file():
        page.get_by_placeholder("Search documents").fill(stamp)
        page.wait_for_timeout(600)
        page.get_by_role("button", name=re.compile(rf"Actions for .*{stamp}")).click()
        page.get_by_role("menuitem", name=re.compile("Replace file", re.I)).click()
        dlg = page.get_by_role("dialog")
        dlg.wait_for()
        dlg.locator("input[type=file]").set_input_files(str(v2))
        dlg.get_by_label(re.compile("What changed", re.I)).fill("Raised the limit from four to six reservations")
        page.wait_for_timeout(400)
        rt.shot(page, s(8))
        dlg.get_by_role("button", name=re.compile("Replace and re-index", re.I)).click()
        page.get_by_role("status").filter(has_text=re.compile("replac|version|indexed", re.I)).first.wait_for(timeout=90000)
        page.wait_for_timeout(600)
        page.get_by_role("button", name=re.compile(r"Version history", re.I)).first.click()
        page.wait_for_timeout(500)
        scroll_top(page)
        rt.note("replace notice: " + page.get_by_role("status").first.inner_text())
        rt.shot(page, s(9))
        scroll_to(page.get_by_role("heading", name=re.compile(stamp)), 200)
        rt.shot(page, s(14))
    rt.step("replace the file (version 2) and open Version history", replace_file)

    def test_v2():
        page.get_by_placeholder("Search documents").fill("")
        page.get_by_placeholder(re.compile("library tablets")).fill(question)
        page.get_by_role("button", name=re.compile("Find passages", re.I)).click()
        page.get_by_text(re.compile(r"passages? found by")).first.wait_for(timeout=60000)
        page.wait_for_timeout(600)
        scroll_to(page.get_by_role("heading", name="Test a question"), 90)
        rt.note("lounge v2: " + page.locator("main").inner_text()[-1800:].replace("\n", " | "))
        rt.shot(page, s(10))
    rt.step("Test a question again: the new version is what is searched", test_v2)

    def remove_own():
        page.get_by_placeholder("Search documents").fill(stamp)
        page.wait_for_timeout(600)
        page.get_by_role("button", name=re.compile(rf"Actions for .*{stamp}")).click()
        page.get_by_role("menuitem", name=re.compile("Remove", re.I)).click()
        page.get_by_role("button", name=re.compile("Remove document", re.I)).wait_for()
        page.wait_for_timeout(500)
        rt.shot(page, s(11))
        page.get_by_role("button", name=re.compile("Remove document", re.I)).click()
        page.wait_for_timeout(1500)
        page.get_by_placeholder("Search documents").fill("")
        page.wait_for_timeout(800)
        rt.note("after removal: " + page.locator("main").inner_text()[:600].replace("\n", " | "))
        scroll_top(page)
        rt.shot(page, s(12))
    rt.step("remove the uploaded memo (only the one created here)", remove_own)

    page.context.close()
