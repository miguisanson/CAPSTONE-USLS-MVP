"""Case 20 - Graduation (Carlo Mendoza): return for clarification, batch by drag and drop, five offices, export."""
from __future__ import annotations

import re
import time

from .helpers_a3 import dialog_text, drag_to_section, make_pdf, open_link, show_column

KEY = "graduation-carlo"
EMAIL = "graduation.carlo@usls.edu.ph"
WHO = "Carlo Mendoza"
RETURN_MESSAGE = "The name and student number in the submitted application do not match the official student record. Upload a corrected signed application."
BATCH_NO = "2"
BATCH_NAME = f"Batch {BATCH_NO} October 2026"


def wait_board(page, rt):
    page.get_by_text(re.compile("Application Submitted")).first.wait_for(timeout=40000)
    rt.settle(page, 1500)


def open_graduation(rt, page, staff=True):
    if staff:
        open_link(rt, page, "8 · Graduation", "/workflow/graduation")
        wait_board(page, rt)
    else:
        open_link(rt, page, "Graduation", "/student/graduation")


def show_section(page, prefix, block="start"):
    show_column(page, prefix)


def batch_card(page):
    return page.locator("[draggable=true]").filter(has_text=BATCH_NAME).first


def run(rt):
    S = "graduation"
    rt.step("reset Carlo", lambda: rt.reset(KEY))
    bad = make_pdf("Carlo_Mendoza_Incorrect_Graduation_Application.pdf", "Graduation Application",
                   ["Name: Carlo Mendosa", "Student number: GS-2026-GRAD-20", "Program: MAED"])
    good = make_pdf("Carlo_Mendoza_Corrected_Graduation_Application.pdf", "Graduation Application (corrected)",
                    ["Name: Carlo Mendoza", "Student number: GS-2026-GRAD-02", "Program: MAED"])

    student = rt.new_page(EMAIL)

    def s_open():
        open_graduation(rt, student, staff=False)
        rt.shot(student, f"{S}-01")

    rt.step("student opens Graduation", s_open)

    def s_submit():
        student.locator("main select").first.select_option(index=0)  # AY 2026-2027, the only open year
        student.locator("main input[type=file]").set_input_files(bad)
        student.get_by_label(re.compile("Remarks for the reviewer")).fill("Signed graduation application.")
        rt.shot(student, f"{S}-02", full=True)
        student.get_by_role("button", name="Submit graduation application").click()
        rt.settle(student, 2000)
        student.evaluate("window.scrollTo(0,0)")
        rt.shot(student, f"{S}-03")

    rt.step("student submits the application PDF", s_submit)

    staff = rt.new_page("staff@usls.edu.ph")

    def st_board():
        open_graduation(rt, staff)
        show_section(staff, "1 ·")
        rt.shot(staff, f"{S}-04")
        show_section(staff, "2 ·")
        rt.shot(staff, f"{S}-05")

    rt.step("staff opens the Graduation board", st_board)

    def st_return():
        card = staff.locator("[draggable=true]").filter(has_text=WHO).first
        card.get_by_role("button", name="View student").click()
        staff.wait_for_timeout(1200)
        rt.shot(staff, f"{S}-06")
        dlg = staff.locator("[role=dialog]").last
        dlg.get_by_role("button", name=re.compile(r"Message . Return")).click()
        staff.wait_for_timeout(900)
        dlg = staff.locator("[role=dialog]").last
        selects = dlg.locator("select")
        rt.note("return dialog selects: %d" % selects.count())
        selects.nth(0).select_option(label="Return for clarification")
        selects.nth(1).select_option(label="Student")
        dlg.get_by_label(re.compile("Have student resubmit document")).check()
        dlg.get_by_label(re.compile("Remarks", re.I)).fill(RETURN_MESSAGE)
        rt.shot(staff, f"{S}-07")
        dlg.get_by_role("button", name="Return to student").click()
        rt.settle(staff, 2000)
        rt.shot(staff, f"{S}-08")

    rt.step("staff returns the application for clarification", st_return)

    def st_exception():
        rt.go(staff, "/workflow/graduation")
        wait_board(staff, rt)
        for sec in staff.locator("section[aria-label]").all():
            if WHO in sec.inner_text():
                rt.note("after the return Carlo is in: " + (sec.get_attribute("aria-label") or ""))
                show_section(staff, (sec.get_attribute("aria-label") or "")[:3])
        rt.shot(staff, f"{S}-09")

    rt.step("Carlo is in the Exception Queue", st_exception)

    def s_returned():
        rt.go(student, "/student/graduation")
        rt.shot(student, f"{S}-10", full=True)

    rt.step("student sees the correction request", s_returned)

    def s_resubmit():
        student.locator("main input[type=file]").set_input_files(good)
        student.locator("main select").first.select_option(index=0)
        rt.shot(student, f"{S}-11", full=True)
        student.get_by_role("button", name=re.compile("(Re)?submit graduation application", re.I)).click()
        rt.settle(student, 2000)
        student.evaluate("window.scrollTo(0,0)")
        rt.shot(student, f"{S}-12")

    rt.step("student uploads the corrected PDF and resubmits", s_resubmit)

    def st_stage2():
        rt.go(staff, "/workflow/graduation")
        wait_board(staff, rt)
        show_section(staff, "2 ·")
        rt.shot(staff, f"{S}-13")

    rt.step("Carlo is back in Application Submitted", st_stage2)

    def st_batch():
        card = staff.locator("[draggable=true]").filter(has_text=WHO).first
        drag_to_section(rt, staff, card, "3 ·")
        rt.note("batch dialog: " + dialog_text(staff)[:900])
        dlg = staff.locator("[role=dialog]").last
        dlg.locator("input").first.fill(BATCH_NO)
        rt.shot(staff, f"{S}-14")
        dlg.get_by_role("button", name="Create batch").click()
        rt.settle(staff, 2500)
        show_section(staff, "3 ·")
        rt.shot(staff, f"{S}-15")

    rt.step("staff drags Carlo to Graduation Batch Created and creates the batch", st_batch)

    def drag_batch(page, prefix, shot_dialog, shot_after, confirm_name, pre=None):
        card = batch_card(page)
        card.wait_for(timeout=15000)
        drag_to_section(rt, page, card, prefix)
        rt.note("dialog: " + dialog_text(page)[:700])
        rt.shot(page, shot_dialog)
        dlg = page.locator("[role=dialog]").last
        dlg.get_by_role("button", name=re.compile(confirm_name, re.I)).last.click()
        rt.settle(page, 2500)
        show_section(page, prefix)
        rt.shot(page, shot_after)

    def st_to_ac():
        rt.go(staff, "/workflow/graduation")
        wait_board(staff, rt)
        drag_batch(staff, "4 ·", f"{S}-16", f"{S}-17", "Forward to Academic Coordinator|Send|Forward")

    rt.step("staff drags the batch to Academic Coordinator Coursework Review", st_to_ac)

    ac = rt.new_page("academic@usls.edu.ph")

    def ac_step():
        open_graduation(rt, ac)
        show_section(ac, "4 ·")
        rt.shot(ac, f"{S}-18")
        drag_batch(ac, "5 ·", f"{S}-19", f"{S}-20", "Check coursework completion|Check|Confirm")

    rt.step("Academic Coordinator drags the batch to Research and Practicum Validation", ac_step)

    rc = rt.new_page("research@usls.edu.ph")

    def rc_step():
        open_graduation(rt, rc)
        show_section(rc, "5 ·")
        rt.shot(rc, f"{S}-21")
        drag_batch(rc, "6 ·", f"{S}-22", f"{S}-23", "Validate research|Validate|Confirm")

    rt.step("Research Coordinator drags the batch to Endorsement Preparation", rc_step)

    def st_prepare():
        rt.go(staff, "/workflow/graduation")
        wait_board(staff, rt)
        show_section(staff, "6 ·")
        rt.shot(staff, f"{S}-24")
        card = batch_card(staff)
        card.get_by_role("button", name="Prepare endorsement list").click()
        staff.wait_for_timeout(1000)
        rt.note("dialog: " + dialog_text(staff)[:600])
        rt.shot(staff, f"{S}-25")
        dlg = staff.locator("[role=dialog]").last
        dlg.get_by_role("button", name=re.compile("Prepare endorsement list", re.I)).last.click()
        rt.settle(staff, 2500)
        show_section(staff, "6 ·")
        rt.shot(staff, f"{S}-26")
        rt.note("card: " + " | ".join(batch_card(staff).inner_text().split("\n"))[:400])

    rt.step("staff prepares the endorsement list", st_prepare)

    def st_send():
        drag_batch(staff, "7 ·", f"{S}-27", f"{S}-28", "Send endorsement list to Dean|Send")

    rt.step("staff drags the batch to Dean Review", st_send)

    dean = rt.new_page("dean@usls.edu.ph")

    def d_open():
        dean.get_by_role("link", name=re.compile("Graduation Endorsement")).first.click()
        rt.settle(dean, 2500)
        rt.note("dean graduation url: " + dean.url)
        rt.note("dean sees: " + " | ".join(dean.locator("main").inner_text().split("\n"))[:900])
        rt.shot(dean, f"{S}-29")

    rt.step("Dean opens Graduation Endorsement", d_open)

    def d_approve():
        drag_batch(dean, "8 ·", f"{S}-30", f"{S}-31", "Approve")

    rt.step("Dean drags the batch to Dean Approved and Ready for Export", d_approve)

    def d_export():
        card = dean.locator('section[aria-label^="8 ·"]').first
        rt.note("dean card buttons: " + str([b.inner_text() for b in card.get_by_role("button").all()]))
        with dean.expect_download(timeout=30000) as info:
            card.get_by_role("button", name=re.compile("Export", re.I)).first.click()
        rt.note("downloaded " + info.value.suggested_filename)
        dean.wait_for_timeout(1500)
        rt.note("popup: " + dialog_text(dean)[:900])
        rt.shot(dean, f"{S}-32")
        dlg = dean.locator("[role=dialog]")
        if dlg.count():
            btn = dlg.last.get_by_role("button", name=re.compile("Got it|Close|OK", re.I))
            if btn.count():
                btn.first.click()
                dean.wait_for_timeout(800)
        show_section(dean, "8 ·")
        rt.shot(dean, f"{S}-33")

    rt.step("Dean exports the approved list (CSV) and reads the notice", d_export)

    def st_final():
        rt.go(staff, "/workflow/graduation")
        wait_board(staff, rt)
        show_section(staff, "8 ·")
        rt.shot(staff, f"{S}-34")

    rt.step("staff sees the exported batch", st_final)

    def s_final():
        rt.go(student, "/student/graduation")
        rt.shot(student, f"{S}-35", full=True)

    rt.step("student sees the graduation status", s_final)
