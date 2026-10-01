"""Case 19 - Practicum (Paolo Ramirez, MSGC): hours incomplete, additional certificates, Dean review."""
from __future__ import annotations

import re

from .helpers_a3 import make_pdf, open_link

KEY = "practicum-paolo"
EMAIL = "practicum.paolo@usls.edu.ph"
WHO = "Paolo Ramirez"
SITE = "Guidance and Counseling Partner Center"
SUPERVISOR = "Ms. Angela Cruz"
REQUEST_REASON = "Only 120 of the required 200 practicum hours are documented. Upload a new certificate covering the remaining hours."


def _log_buttons(rt, page, label):
    names = [b.inner_text().strip().split("\n")[0][:45] for b in page.get_by_role("button").all() if b.is_visible()]
    rt.note(f"{label} buttons: {names}")


def open_practicum(rt, page, staff=True):
    if staff:
        open_link(rt, page, "7 · Practicum", "/workflow/practicum")
    else:
        open_link(rt, page, "Practicum", "/student/practicum")
    rt.settle(page, 800)


def show_board(page):
    """Scroll so that the board columns of the practicum page are in view."""
    try:
        page.get_by_text(WHO, exact=True).first.evaluate(
            "el => el.scrollIntoView({block: 'center', inline: 'center'})")
    except Exception:  # noqa: BLE001
        pass
    page.wait_for_timeout(500)


def open_case(rt, page, who=WHO):
    """Open the View window of a practicum card (staff / coordinator pages)."""
    card = page.locator("article, div").filter(has_text=who).filter(has=page.get_by_role("button", name="View", exact=True)).last
    card.scroll_into_view_if_needed()
    card.get_by_role("button", name="View", exact=True).click()
    rt.settle(page, 1200)


def press(rt, page, name, *, confirm=True, note_text=None, shot=None, shot_dialog=None):
    """Press an action button inside the open case window; fill the reason box and confirm if a
    second window opens."""
    btn = page.get_by_role("button", name=re.compile(name, re.I)).last
    btn.scroll_into_view_if_needed()
    btn.click()
    page.wait_for_timeout(900)
    dlgs = page.locator("[role=dialog]")
    top = dlgs.last
    ta = top.locator("textarea")
    if note_text and ta.count():
        ta.last.fill(note_text)
    if shot_dialog:
        rt.shot(page, shot_dialog)
    # a confirm button carrying the same label may appear in a second window
    inner = top.get_by_role("button", name=re.compile(name, re.I))
    if confirm and dlgs.count() >= 2 and inner.count():
        inner.last.click()
    elif confirm and dlgs.count() >= 1 and inner.count() and dlgs.count() != 1:
        inner.last.click()
    rt.settle(page, 1500)
    if shot:
        rt.shot(page, shot)


def run(rt):
    S = "practicum"
    rt.step("reset Paolo", lambda: rt.reset(KEY))
    moa = make_pdf("Paolo_Ramirez_Signed_MOA.pdf", "Memorandum of Agreement - Practicum",
                   ["Student: Paolo Ramirez (MSGC)", f"Site: {SITE}", f"Supervisor: {SUPERVISOR}"])
    initial = make_pdf("Paolo_Ramirez_Initial_Practicum_Certificates.pdf", "Practicum Hours Certificates",
                       ["Student: Paolo Ramirez (MSGC)", "Hours certified: 120"])
    extra = make_pdf("Paolo_Ramirez_Additional_Practicum_Certificate.pdf", "Additional Practicum Hours Certificate",
                     ["Student: Paolo Ramirez (MSGC)", "Hours certified: 80 (total 200)"])

    student = rt.new_page(EMAIL)

    def s_open():
        open_practicum(rt, student, staff=False)
        rt.shot(student, f"{S}-01")

    rt.step("student opens Practicum (eligibility)", s_open)

    def s_moa():
        boxes = student.locator("main input[type=text], main input:not([type])")
        boxes.nth(0).fill(SITE)
        boxes.nth(1).fill(SUPERVISOR)
        student.locator("main input[type=file]").set_input_files(moa)
        student.locator("main textarea").fill("Signed MOA with the partner center.")
        student.get_by_role("button", name="Submit MOA stage").scroll_into_view_if_needed()
        rt.shot(student, f"{S}-02")
        student.get_by_role("button", name="Submit MOA stage").click()
        rt.settle(student, 2000)
        student.evaluate("window.scrollTo(0,0)")
        rt.shot(student, f"{S}-03")

    rt.step("student submits the MOA", s_moa)

    staff = rt.new_page("staff@usls.edu.ph")
    coord = rt.new_page("academic@usls.edu.ph")
    dean = rt.new_page("dean@usls.edu.ph")

    def st_board():
        open_practicum(rt, staff)
        show_board(staff)
        rt.shot(staff, f"{S}-04")
        open_case(rt, staff)
        rt.shot(staff, f"{S}-05")

    rt.step("staff opens the Practicum board and Paolo's MOA", st_board)

    def st_forward():
        press(rt, staff, "Forward to Academic Coordinator", shot_dialog=f"{S}-06")
        _log_buttons(rt, staff, "after forward")

    rt.step("staff forwards the MOA to the Academic Coordinator", st_forward)

    def co_progress():
        open_practicum(rt, coord)
        show_board(coord)
        rt.shot(coord, f"{S}-07")
        open_case(rt, coord)
        rt.shot(coord, f"{S}-08")
        _log_buttons(rt, coord, "coordinator")
        press(rt, coord, "Mark practicum in progress", shot_dialog=f"{S}-09")

    rt.step("Academic Coordinator marks the practicum in progress", co_progress)

    def s_hours():
        rt.go(student, "/student/practicum")
        rt.shot(student, f"{S}-10", full=True)
        student.get_by_label(re.compile("Completed hours")).fill("120")
        student.locator("main input[type=file]").last.set_input_files(initial)
        student.get_by_label(re.compile("Remarks for the reviewer")).fill("Initial certificates covering 120 completed practicum hours.")
        rt.shot(student, f"{S}-11", full=True)
        student.get_by_role("button", name=re.compile("Submit completion stage", re.I)).click()
        rt.settle(student, 2000)
        student.evaluate("window.scrollTo(0,0)")
        rt.shot(student, f"{S}-12", full=True)

    rt.step("student submits only 120 hours", s_hours)

    def st_incomplete():
        rt.go(staff, "/workflow/practicum")
        show_board(staff)
        rt.shot(staff, f"{S}-13")
        open_case(rt, staff)
        rt.shot(staff, f"{S}-14")
        press(rt, staff, "Forward documents to Academic Coordinator", shot_dialog=f"{S}-15")

    rt.step("staff sees Hours Incomplete and forwards the documents", st_incomplete)

    def co_request():
        rt.go(coord, "/workflow/practicum")
        open_case(rt, coord)
        rt.shot(coord, f"{S}-16")
        press(rt, coord, "Request additional certificates", note_text=REQUEST_REASON, shot_dialog=f"{S}-17", shot=f"{S}-18")

    rt.step("Academic Coordinator requests additional certificates", co_request)

    def s_center():
        rt.go(student, "/student/requests")
        rt.shot(student, f"{S}-19")
        rt.go(student, "/student/practicum")
        rt.shot(student, f"{S}-20", full=True)

    rt.step("student sees the request and the reopened step", s_center)

    def s_resubmit():
        student.get_by_label(re.compile("Completed hours")).fill("200")
        student.locator("main input[type=file]").last.set_input_files(extra)
        student.get_by_label(re.compile("Remarks for the reviewer")).fill("The additional certificate covers the remaining 80 practicum hours.")
        rt.shot(student, f"{S}-21", full=True)
        student.get_by_role("button", name=re.compile("(Re)?submit completion stage", re.I)).click()
        rt.settle(student, 2000)
        student.evaluate("window.scrollTo(0,0)")
        rt.shot(student, f"{S}-22", full=True)

    rt.step("student resubmits 200 hours with the new certificate", s_resubmit)

    def st_again():
        rt.go(staff, "/workflow/practicum")
        open_case(rt, staff)
        press(rt, staff, "Forward documents to Academic Coordinator", shot=f"{S}-23")

    rt.step("staff forwards the updated documents", st_again)

    def co_verify():
        rt.go(coord, "/workflow/practicum")
        show_board(coord)
        rt.shot(coord, f"{S}-24")
        open_case(rt, coord)
        rt.shot(coord, f"{S}-25")
        press(rt, coord, "Verify completion", shot_dialog=f"{S}-26")
        if not coord.get_by_role("button", name=re.compile("Send status report to Dean", re.I)).count():
            open_case(rt, coord)
        coord.wait_for_timeout(500)
        rt.shot(coord, f"{S}-27")
        press(rt, coord, "Send status report to Dean", shot_dialog=f"{S}-27b", shot=f"{S}-28")

    rt.step("Academic Coordinator verifies completion and sends the report to the Dean", co_verify)

    def d_review():
        # a fresh page load, so the list reflects what the Coordinator just sent
        rt.go(dean, "/dean/approvals/practicum")
        rt.settle(dean, 2500)
        dean.get_by_text("Waiting for your decision").first.wait_for()
        dean.get_by_role("row").filter(has_text=WHO).first.wait_for(timeout=15000)
        rt.shot(dean, f"{S}-29")
        dean.get_by_role("row").filter(has_text=WHO).get_by_role("link", name="Review").click()
        rt.settle(dean, 2000)
        rt.shot(dean, f"{S}-30", full=True)
        _log_buttons(rt, dean, "dean case")

    rt.step("Dean opens the practicum report", d_review)

    def d_mark():
        dean.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        dean.get_by_label(re.compile("Review comment", re.I)).first.fill("Practicum completed: 200 of 200 hours documented. Reviewed.")
        btn = dean.get_by_role("button", name=re.compile("Mark reviewed", re.I)).first
        btn.scroll_into_view_if_needed()
        btn.click()
        dean.wait_for_timeout(900)
        rt.shot(dean, f"{S}-31")
        dlg = dean.locator("[role=dialog]")
        if dlg.count():
            dlg.last.get_by_role("button", name=re.compile("Approve current stage", re.I)).click()
        rt.settle(dean, 2000)
        rt.shot(dean, f"{S}-32")

    rt.step("Dean marks the report reviewed", d_mark)

    def final():
        rt.go(staff, "/workflow/practicum")
        show_board(staff)
        rt.shot(staff, f"{S}-33")
        open_case(rt, staff)
        staff.get_by_text(re.compile("SUBMITTED FILE HISTORY", re.I)).first.scroll_into_view_if_needed()
        staff.wait_for_timeout(400)
        rt.shot(staff, f"{S}-34")

    rt.step("staff sees Dean Reviewed and the file history", final)
