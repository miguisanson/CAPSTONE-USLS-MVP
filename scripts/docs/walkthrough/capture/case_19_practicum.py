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


def confirm_send(rt, page):
    """The student pages ask "Send this request?" before every send: press Send request."""
    page.get_by_role("dialog").get_by_role("button", name="Send request").click()
    rt.settle(page, 2000)


def open_practicum(rt, page, staff=True):
    if staff:
        open_link(rt, page, "8 · Practicum", "/workflow/practicum")
        page.get_by_text("Awaiting Submission").first.wait_for(timeout=20000)
    else:
        open_link(rt, page, "Practicum", "/student/practicum")
    rt.settle(page, 800)


def board_ready(rt, page):
    page.get_by_text("Awaiting Submission").first.wait_for(timeout=20000)
    rt.settle(page, 600)


def show_column(page, label):
    """Scroll the board sideways so the column called ``label`` is the left-most one."""
    page.evaluate(
        """(label) => {
            const section = [...document.querySelectorAll('section[aria-label]')].find(s => (s.getAttribute('aria-label') || '').startsWith(label));
            if (!section) return;
            const region = section.closest('[role=region]') || section.parentElement;
            region.scrollIntoView({block: 'center'});
            region.scrollLeft += section.getBoundingClientRect().left - region.getBoundingClientRect().left - 8;
        }""", label)
    page.wait_for_timeout(600)


def open_case(rt, page, who=WHO):
    """Open the case window of a practicum card: the "View details" button of its card."""
    btn = page.get_by_role("button", name=f"View details for {who}").first
    btn.scroll_into_view_if_needed()
    btn.click()
    page.get_by_role("dialog").last.wait_for()
    rt.settle(page, 1000)


def press(rt, page, name, *, note_text=None, shot=None, shot_dialog=None, column=None):
    """Press the step button in the open case window; the confirm window (StepDialog) opens;
    fill its reason box if asked, then press the same button in it."""
    footer_btn = page.get_by_role("dialog").last.get_by_role("button", name=name, exact=True)
    footer_btn.scroll_into_view_if_needed()
    footer_btn.click()
    page.get_by_role("dialog").last.get_by_text(f"Confirm: {name}").wait_for()
    page.wait_for_timeout(500)
    top = page.get_by_role("dialog").last
    ta = top.locator("textarea")
    if note_text and ta.count():
        ta.last.fill(note_text)
    if shot_dialog:
        rt.shot(page, shot_dialog)
    top.get_by_role("button", name=name, exact=True).click()
    rt.settle(page, 2000)
    if column:
        show_column(page, column)
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
        student.get_by_role("dialog").get_by_role("button", name="Send request").wait_for()
        rt.shot(student, f"{S}-03")
        confirm_send(rt, student)
        student.evaluate("window.scrollTo(0,0)")
        rt.shot(student, f"{S}-04")

    rt.step("student submits the MOA", s_moa)

    staff = rt.new_page("staff@usls.edu.ph")
    coord = rt.new_page("academic@usls.edu.ph")
    dean = rt.new_page("dean@usls.edu.ph")

    def st_board():
        open_practicum(rt, staff)
        show_column(staff, "Submitted")
        rt.shot(staff, f"{S}-05")
        open_case(rt, staff)
        rt.shot(staff, f"{S}-06")

    rt.step("staff opens the Practicum board and Paolo's case window", st_board)

    def st_forward():
        press(rt, staff, "Forward to Academic Coordinator", shot_dialog=f"{S}-07", shot=f"{S}-08")

    rt.step("staff forwards the MOA to the Academic Coordinator", st_forward)

    def st_table():
        staff.get_by_role("button", name="Table").click()
        rt.settle(staff, 1000)
        rt.shot(staff, f"{S}-09")
        staff.get_by_role("button", name="Board").click()
        rt.settle(staff, 800)

    rt.step("staff switches the board to the table and back", st_table)

    def co_progress():
        open_practicum(rt, coord)
        show_column(coord, "Eligibility Review")
        rt.shot(coord, f"{S}-10")
        open_case(rt, coord)
        rt.shot(coord, f"{S}-11")
        coord.get_by_role("dialog").last.get_by_role("button", name="Close details").click()
        rt.settle(coord, 600)
        # a real drag and drop: the card goes to the column the step leads to and the same confirm window opens
        show_column(coord, "Eligibility Review")
        card = coord.locator("[draggable=true]").filter(has_text=WHO).first
        target = coord.locator('section[aria-label^="In Progress"]').first
        card.drag_to(target, timeout=20000)
        coord.get_by_role("dialog").last.get_by_text("Confirm: Mark practicum in progress").wait_for()
        coord.wait_for_timeout(500)
        rt.shot(coord, f"{S}-12")
        coord.get_by_role("dialog").last.get_by_role("button", name="Mark practicum in progress", exact=True).click()
        rt.settle(coord, 2000)
        show_column(coord, "Eligibility Review")
        rt.shot(coord, f"{S}-13")

    rt.step("Academic Coordinator marks the practicum in progress", co_progress)

    def s_hours():
        rt.go(student, "/student/practicum")
        rt.shot(student, f"{S}-14", full=True)
        student.get_by_label(re.compile("Completed hours")).fill("120")
        student.locator("main input[type=file]").last.set_input_files(initial)
        student.get_by_label(re.compile("Remarks for the reviewer")).fill("Initial certificates covering 120 completed practicum hours.")
        rt.shot(student, f"{S}-15", full=True)
        student.get_by_role("button", name=re.compile("Submit completion stage", re.I)).click()
        confirm_send(rt, student)
        student.evaluate("window.scrollTo(0,0)")
        rt.shot(student, f"{S}-16", full=True)

    rt.step("student submits only 120 hours", s_hours)

    def st_incomplete():
        rt.go(staff, "/workflow/practicum")
        board_ready(rt, staff)
        show_column(staff, "In Progress")
        rt.shot(staff, f"{S}-17")
        open_case(rt, staff)
        rt.shot(staff, f"{S}-18")
        press(rt, staff, "Forward documents to Academic Coordinator", shot_dialog=f"{S}-19")

    rt.step("staff sees Hours Incomplete and forwards the documents", st_incomplete)

    def co_request():
        rt.go(coord, "/workflow/practicum")
        board_ready(rt, coord)
        open_case(rt, coord)
        rt.shot(coord, f"{S}-20")
        press(rt, coord, "Request additional certificates", note_text=REQUEST_REASON, shot_dialog=f"{S}-21", shot=f"{S}-22", column="In Progress")

    rt.step("Academic Coordinator requests additional certificates", co_request)

    def s_center():
        rt.go(student, "/student/requests")
        rt.shot(student, f"{S}-23")
        rt.go(student, "/student/practicum")
        rt.shot(student, f"{S}-24", full=True)

    rt.step("student sees the request and the reopened step", s_center)

    def s_resubmit():
        student.get_by_label(re.compile("Completed hours")).fill("200")
        student.locator("main input[type=file]").last.set_input_files(extra)
        student.get_by_label(re.compile("Remarks for the reviewer")).fill("The additional certificate covers the remaining 80 practicum hours.")
        rt.shot(student, f"{S}-25", full=True)
        student.get_by_role("button", name=re.compile("(Re)?submit completion stage", re.I)).click()
        confirm_send(rt, student)
        student.evaluate("window.scrollTo(0,0)")
        rt.shot(student, f"{S}-26", full=True)

    rt.step("student resubmits 200 hours with the new certificate", s_resubmit)

    def st_again():
        rt.go(staff, "/workflow/practicum")
        board_ready(rt, staff)
        open_case(rt, staff)
        press(rt, staff, "Forward documents to Academic Coordinator", shot=f"{S}-27", column="Documents Review")

    rt.step("staff forwards the updated documents", st_again)

    def co_verify():
        rt.go(coord, "/workflow/practicum")
        board_ready(rt, coord)
        show_column(coord, "Documents Review")
        rt.shot(coord, f"{S}-28")
        open_case(rt, coord)
        rt.shot(coord, f"{S}-29")
        press(rt, coord, "Verify completion", shot_dialog=f"{S}-30", shot=f"{S}-31", column="Completion Review")
        open_case(rt, coord)
        press(rt, coord, "Send status report to Dean", shot_dialog=f"{S}-32", shot=f"{S}-33", column="Completed")

    rt.step("Academic Coordinator verifies completion and sends the report to the Dean", co_verify)

    def d_review():
        # a fresh page load, so the list reflects what the Coordinator just sent
        rt.go(dean, "/dean/approvals/practicum")
        rt.settle(dean, 2500)
        dean.get_by_role("link", name=f"View details for {WHO}").first.wait_for(timeout=20000)
        dean.evaluate("""() => { window.scrollTo(0, 0); document.querySelectorAll('*').forEach(el => { if (el.scrollTop > 0) el.scrollTop = 0; }); }""")
        dean.wait_for_timeout(500)
        rt.shot(dean, f"{S}-34")
        dean.get_by_role("link", name=f"View details for {WHO}").first.click()
        rt.settle(dean, 2000)
        rt.shot(dean, f"{S}-35", full=True)
        _log_buttons(rt, dean, "dean case")

    rt.step("Dean opens the practicum report", d_review)

    def d_mark():
        dean.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        dean.get_by_label(re.compile("Review comment", re.I)).first.fill("Practicum completed: 200 of 200 hours documented. Reviewed.")
        btn = dean.get_by_role("button", name=re.compile("Mark reviewed", re.I)).first
        btn.scroll_into_view_if_needed()
        btn.click()
        dean.wait_for_timeout(900)
        rt.shot(dean, f"{S}-36")
        dlg = dean.locator("[role=dialog]")
        if dlg.count():
            dlg.last.get_by_role("button", name=re.compile("^Mark reviewed$", re.I)).click()
        rt.settle(dean, 2000)
        rt.shot(dean, f"{S}-37")

    rt.step("Dean marks the report reviewed", d_mark)

    def final():
        rt.go(staff, "/workflow/practicum")
        board_ready(rt, staff)
        show_column(staff, "Completed")
        rt.shot(staff, f"{S}-38")
        open_case(rt, staff)
        staff.get_by_text(re.compile("SUBMITTED FILE HISTORY", re.I)).first.scroll_into_view_if_needed()
        staff.wait_for_timeout(400)
        rt.shot(staff, f"{S}-39")

    rt.step("staff sees Dean Reviewed and the file history", final)
