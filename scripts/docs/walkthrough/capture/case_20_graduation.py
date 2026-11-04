"""Case 20 - Graduation (Carlo Mendoza, MAED): return for clarification, batch on the shared board, five offices, Dean export."""
from __future__ import annotations

import re

from .helpers_a3 import make_pdf, show_column as _show_column

KEY = "graduation-carlo"
EMAIL = "graduation.carlo@usls.edu.ph"
WHO = "Carlo Mendoza"
RETURN_MESSAGE = "The name and student number in the submitted application do not match the official student record. Upload a corrected signed application."
BATCH_NO = "3"  # the seeded batches are 1 (Isabel Flores) and 2 (Hector Ong), so the walkthrough batch is 3
BATCH_RE = re.compile(rf"Batch {BATCH_NO} ")


def confirm_send(rt, page):
    page.get_by_role("dialog").get_by_role("button", name="Send request").click()
    rt.settle(page, 2000)


def wait_board(rt, page):
    page.get_by_text("Academically eligible").first.wait_for(timeout=40000)
    rt.settle(page, 1200)


def open_graduation(rt, page, staff=True):
    if staff:
        rt.go(page, "/workflow/graduation")
        wait_board(rt, page)
    else:
        rt.go(page, "/student/graduation")


def show_column(page, label):
    _show_column(page, label)


def top_of_page(page):
    page.evaluate("""() => { window.scrollTo(0, 0); document.querySelectorAll('*').forEach(el => { if (el.scrollTop > 0) el.scrollTop = 0; }); }""")
    page.wait_for_timeout(500)


def candidate_card(page, who=WHO):
    return page.locator("[draggable=true]").filter(has_text=who).first


def batch_card(page):
    return page.locator("[draggable=true]").filter(has_text=BATCH_RE).first


def drag_to(rt, page, card, column):
    card.scroll_into_view_if_needed()
    target = page.locator(f'section[aria-label^="{column}"]').first
    target.scroll_into_view_if_needed()
    card.drag_to(target, timeout=20000)
    page.get_by_role("dialog").last.wait_for()
    page.wait_for_timeout(700)


def dialog_text(page):
    dlg = page.get_by_role("dialog")
    return " | ".join(dlg.last.inner_text().split("\n")) if dlg.count() else ""


def drag_batch(rt, page, column, confirm_name, shot_dialog, shot_after, *, card=None, after_column=None):
    """Drag the batch card to ``column``; the batch dialog opens; confirm it with ``confirm_name``."""
    card = card or batch_card(page)
    card.wait_for(timeout=15000)
    drag_to(rt, page, card, column)
    rt.note("dialog: " + dialog_text(page)[:500])
    rt.shot(page, shot_dialog)
    page.get_by_role("dialog").last.get_by_role("button", name=confirm_name, exact=True).click()
    rt.settle(page, 2500)
    show_column(page, after_column or column)
    rt.shot(page, shot_after)


def run(rt):
    S = "graduation"
    rt.step("reset Carlo", lambda: rt.reset(KEY))
    bad = make_pdf("Carlo_Mendoza_Incorrect_Graduation_Application.pdf", "Graduation Application",
                   ["Name: Carlo Mendosa", "Student number: 2691120", "Program: MAED"])
    good = make_pdf("Carlo_Mendoza_Corrected_Graduation_Application.pdf", "Graduation Application (corrected)",
                    ["Name: Carlo Mendoza", "Student number: 2690302", "Program: MAED"])

    student = rt.new_page(EMAIL)

    def s_open():
        open_graduation(rt, student, staff=False)
        rt.shot(student, f"{S}-01")

    rt.step("student opens Graduation Endorsement", s_open)

    def s_submit():
        student.locator("main input[type=file]").set_input_files(bad)
        student.get_by_label(re.compile("Remarks for the reviewer")).fill("Signed graduation application.")
        rt.shot(student, f"{S}-02", full=True)
        student.get_by_role("button", name="Submit graduation application").click()
        student.get_by_role("dialog").get_by_role("button", name="Send request").wait_for()
        rt.shot(student, f"{S}-03")
        confirm_send(rt, student)
        student.evaluate("window.scrollTo(0,0)")
        rt.shot(student, f"{S}-04")

    rt.step("student submits the application PDF", s_submit)

    staff = rt.new_page("staff@usls.edu.ph")

    def st_board():
        open_graduation(rt, staff)
        top_of_page(staff)
        rt.shot(staff, f"{S}-05")
        show_column(staff, "Academically eligible")
        rt.shot(staff, f"{S}-06")
        show_column(staff, "Application submitted")
        rt.shot(staff, f"{S}-07")

    rt.step("staff opens the Graduation Endorsement board", st_board)

    def st_return():
        staff.get_by_role("button", name=f"View details for {WHO}").first.click()
        staff.get_by_role("dialog").last.wait_for()
        staff.wait_for_timeout(1200)
        rt.shot(staff, f"{S}-08")
        staff.get_by_role("dialog").last.get_by_role("button", name=re.compile(r"Message . Return")).click()
        staff.get_by_text("Message / return for clarification").wait_for()
        staff.wait_for_timeout(700)
        dlg = staff.get_by_role("dialog").last
        selects = dlg.locator("select")
        rt.note("return dialog selects: %d" % selects.count())
        selects.nth(0).select_option(label="Return for clarification")
        selects.nth(1).select_option(label="Student")
        dlg.get_by_label(re.compile("Have student resubmit document")).check()
        dlg.get_by_label(re.compile("Remarks")).fill(RETURN_MESSAGE)
        rt.shot(staff, f"{S}-09")
        dlg.get_by_role("button", name="Return to student").click()
        rt.settle(staff, 2500)
        top_of_page(staff)
        rt.shot(staff, f"{S}-10")

    rt.step("staff returns the application for clarification", st_return)

    def st_back():
        top_of_page(staff)
        show_column(staff, "Academically eligible")
        staff.mouse.wheel(0, -90)
        staff.wait_for_timeout(500)
        rt.note("Carlo is back in the first column: " + str(WHO in staff.locator('section[aria-label^="Academically eligible"]').first.inner_text()))
        rt.shot(staff, f"{S}-11")

    rt.step("Carlo is back in Academically eligible", st_back)

    def s_returned():
        rt.go(student, "/student/graduation")
        rt.shot(student, f"{S}-12", full=True)

    rt.step("student sees the correction request", s_returned)

    def s_resubmit():
        student.locator("main input[type=file]").set_input_files(good)
        rt.shot(student, f"{S}-13", full=True)
        student.get_by_role("button", name=re.compile("(Re)?submit graduation application", re.I)).click()
        confirm_send(rt, student)
        student.evaluate("window.scrollTo(0,0)")
        rt.shot(student, f"{S}-14")

    rt.step("student uploads the corrected PDF and resubmits", s_resubmit)

    def st_stage2():
        open_graduation(rt, staff)
        show_column(staff, "Application submitted")
        rt.shot(staff, f"{S}-15")

    rt.step("Carlo is back in Application submitted", st_stage2)

    def st_batch():
        drag_to(rt, staff, candidate_card(staff), "Batch created")
        rt.note("batch dialog: " + dialog_text(staff)[:700])
        dlg = staff.get_by_role("dialog").last
        dlg.get_by_label("Batch No.").fill(BATCH_NO)
        rt.shot(staff, f"{S}-16")
        dlg.get_by_role("button", name="Create batch", exact=True).click()
        rt.settle(staff, 2500)
        show_column(staff, "Batch created")
        rt.shot(staff, f"{S}-17")

    rt.step("staff drags Carlo to Batch created and creates the batch", st_batch)

    def st_to_ac():
        open_graduation(rt, staff)
        drag_batch(rt, staff, "Coursework review", "Forward to Academic Coordinator", f"{S}-18", f"{S}-19")

    rt.step("staff drags the batch to Coursework review", st_to_ac)

    ac = rt.new_page("academic@usls.edu.ph")

    def ac_step():
        open_graduation(rt, ac)
        show_column(ac, "Coursework review")
        rt.shot(ac, f"{S}-20")
        drag_batch(rt, ac, "Research and practicum check", "Check coursework completion", f"{S}-21", f"{S}-22")

    rt.step("Academic Coordinator drags the batch to Research and practicum check", ac_step)

    rc = rt.new_page("research@usls.edu.ph")

    def rc_step():
        open_graduation(rt, rc)
        show_column(rc, "Research and practicum check")
        rt.shot(rc, f"{S}-23")
        drag_batch(rt, rc, "Endorsement prep or revision", "Validate research and practicum requirements", f"{S}-24", f"{S}-25")

    rt.step("Research Coordinator drags the batch to Endorsement prep or revision", rc_step)

    def st_prepare():
        open_graduation(rt, staff)
        show_column(staff, "Endorsement prep or revision")
        rt.shot(staff, f"{S}-26")
        staff.get_by_role("button", name=re.compile(rf"View details for Batch {BATCH_NO} ")).first.click()
        staff.get_by_role("dialog").last.wait_for()
        staff.wait_for_timeout(1000)
        rt.shot(staff, f"{S}-27")
        staff.get_by_role("dialog").last.get_by_role("button", name="Prepare endorsement list", exact=True).click()
        staff.get_by_role("dialog").last.get_by_text("Selected action").wait_for()
        staff.wait_for_timeout(700)
        rt.note("dialog: " + dialog_text(staff)[:500])
        rt.shot(staff, f"{S}-28")
        staff.get_by_role("dialog").last.get_by_role("button", name="Prepare endorsement list", exact=True).click()
        rt.settle(staff, 2500)
        show_column(staff, "Endorsement prep or revision")
        rt.shot(staff, f"{S}-29")

    rt.step("staff prepares the endorsement list", st_prepare)

    def st_send():
        drag_batch(rt, staff, "Dean review", "Send endorsement list to Dean", f"{S}-30", f"{S}-31")

    rt.step("staff drags the batch to Dean review", st_send)

    dean = rt.new_page("dean@usls.edu.ph")

    def d_open():
        rt.go(dean, "/dean/approvals/graduation")
        dean.get_by_text("Roster & workflow").first.wait_for(timeout=30000)
        rt.settle(dean, 1500)
        top_of_page(dean)
        rt.shot(dean, f"{S}-32")
        dean.get_by_role("tab", name="Endorsement batches").click()
        rt.settle(dean, 1500)
        top_of_page(dean)
        rt.shot(dean, f"{S}-33")
        show_column(dean, "Dean review")
        rt.shot(dean, f"{S}-33b")

    rt.step("Dean opens Graduation Endorsement and the Endorsement batches tab", d_open)

    def d_approve():
        card = batch_card(dean)
        card.wait_for(timeout=15000)
        drag_to(rt, dean, card, "Approved, ready to export")
        rt.note("dialog: " + dialog_text(dean)[:500])
        rt.shot(dean, f"{S}-34")
        dean.get_by_role("dialog").last.get_by_role("button", name="Approve endorsement list", exact=True).click()
        rt.settle(dean, 2500)
        show_column(dean, "Approved, ready to export")
        rt.shot(dean, f"{S}-35")

    rt.step("Dean drags the batch to Approved, ready to export", d_approve)

    def d_export():
        dean.get_by_role("button", name=re.compile(rf"View details for Batch {BATCH_NO} ")).first.click()
        dean.get_by_role("dialog").last.wait_for()
        dean.wait_for_timeout(1000)
        rt.shot(dean, f"{S}-36")
        with dean.expect_download(timeout=30000) as info:
            dean.get_by_role("dialog").last.get_by_role("button", name=re.compile("Export approved list")).click()
        rt.note("downloaded " + info.value.suggested_filename)
        dean.get_by_text("Graduation CSV export complete").wait_for()
        dean.wait_for_timeout(800)
        rt.shot(dean, f"{S}-37")
        dean.get_by_role("button", name="Got it").click()
        rt.settle(dean, 1500)
        show_column(dean, "Approved, ready to export")
        rt.shot(dean, f"{S}-38")

    rt.step("Dean exports the approved list (CSV) and reads the notice", d_export)

    def st_final():
        open_graduation(rt, staff)
        show_column(staff, "Approved, ready to export")
        rt.shot(staff, f"{S}-39")

    rt.step("staff sees the exported batch", st_final)

    def s_final():
        rt.go(student, "/student/graduation")
        rt.shot(student, f"{S}-40", full=True)

    rt.step("student sees the graduation status", s_final)
