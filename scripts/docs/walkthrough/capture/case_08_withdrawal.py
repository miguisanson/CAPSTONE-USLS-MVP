"""Case 08 - Subject Withdrawal per handbook (Elena Navarro), with the closed-window refusal shown first (Joshua Lim)."""
from __future__ import annotations

import re
import time

from playwright.sync_api import Page

from .common import Runtime, click_text
from .helpers_a2 import pick, row_for, scroll_to, shot_at, top, visible_text

SLUG = "withdrawal"
CURRENT = "AY 2026-2027 1st Semester"
ORIGINAL_START = "2026-08-01"
SUBJECT = "MAED-MAJ1"
REASON = "I need to revise my first-semester study load."


def _set_term_start(rt: Runtime, page: Page, start: str, *, shots: tuple[str, str] | None = None) -> None:
    rt.go(page, "/term-settings")
    row = page.locator("tr", has_text=CURRENT).first
    row.get_by_role("button", name=re.compile("Edit dates")).click()
    page.wait_for_timeout(500)
    page.locator("input[type=date]").nth(0).fill(start)
    page.wait_for_timeout(300)
    if shots:
        scroll_to(page, re.compile(r"Edit dates: AY 2026-2027 1st"), offset=260)
        rt.shot(page, shots[0])
    page.get_by_role("button", name=re.compile("Save dates")).click()
    page.wait_for_timeout(1200)
    rt.settle(page)
    if shots:
        page.locator("tr", has_text=CURRENT).first.scroll_into_view_if_needed()
        rt.shot(page, shots[1])


def _open_withdrawal_page(rt: Runtime, page: Page) -> None:
    rt.go(page, "/student/requests/withdrawal")
    page.get_by_text("Send Withdrawal Request").first.wait_for()


def _find_request(page: Page, name: str = "Elena Navarro"):
    """The withdrawal request card of ``name`` on the staff / Dean board (other demo students may have requests too)."""
    return page.get_by_text(name, exact=False).first


def run(rt: Runtime) -> None:
    rt.reset("withdrawal-elena", "withdrawal-joshua")
    staff = rt.new_page("staff@usls.edu.ph")

    # make sure an interrupted earlier run did not leave the semester dates moved
    rt.step("Restore the semester start date if a previous run left it moved", lambda: _set_term_start(rt, staff, ORIGINAL_START))

    # ---- Part A: the rule refuses (Joshua Lim, window closed) -------------------------------
    joshua = rt.new_page("withdrawal.joshua@usls.edu.ph")

    def refusal():
        _open_withdrawal_page(rt, joshua)
        rt.note("JOSHUA PAGE: " + visible_text(joshua, "main", 9000).split("Rules applied on this screen")[0][-200:].replace(chr(10), " | "))
        scroll_to(joshua, "Current subject withdrawal stage", offset=90)
        rt.shot(joshua, f"{SLUG}-01")
        txt = visible_text(joshua, "main", 14000)
        i = txt.find("When you can withdraw a subject")
        rt.note("JOSHUA RULE: " + txt[i:i + 900].replace(chr(10), " | "))
        scroll_to(joshua, "Enrolled subject *", offset=120, exact=False)
        rt.shot(joshua, f"{SLUG}-02")
        sel = joshua.get_by_label(re.compile(r"Enrolled subject", re.I)).first
        opts = sel.locator("option").all_inner_texts()
        rt.note(f"JOSHUA OPTIONS: {opts}")
        rt.note("JOSHUA BUTTON ENABLED: " + str(joshua.get_by_role("button", name="Send withdrawal request").is_enabled()))

    rt.step("Joshua Lim: every subject is outside the withdrawal window", refusal)

    # ---- Part B: staff corrects the recorded semester start date (demo clock is week 9) ----
    start_inside = time.strftime("%Y-%m-%d", time.localtime(time.time() - 3 * 86400))
    rt.note(f"new start date {start_inside}")
    rt.step("Staff set the semester start date inside the window", lambda: _set_term_start(rt, staff, start_inside, shots=(f"{SLUG}-03", f"{SLUG}-04")))

    # ---- Part C: student request -------------------------------------------------------------
    elena = rt.new_page("withdrawal.elena@usls.edu.ph")

    def student_form():
        _open_withdrawal_page(rt, elena)
        scroll_to(elena, "Current subject withdrawal stage", offset=90)
        rt.shot(elena, f"{SLUG}-05")

    rt.step("Elena opens Subject Withdrawal", student_form)

    def select_subject():
        scroll_to(elena, "Enrolled subject *", offset=120)
        sel = elena.get_by_label(re.compile(r"Enrolled subject", re.I)).first
        opts = sel.locator("option").all_inner_texts()
        rt.note(f"ELENA OPTIONS: {opts}")
        sel.select_option(label=next(o for o in opts if SUBJECT in o))
        elena.wait_for_timeout(600)
        rt.note("ELENA SELECTED: " + visible_text(elena, "main", 14000).split("Enrolled subject *")[1][:500].replace(chr(10), " | "))
        rt.shot(elena, f"{SLUG}-06")

    rt.step("Select MAED-MAJ1", select_subject)

    def send():
        elena.get_by_label(re.compile(r"Reason for withdrawing", re.I)).fill(REASON)
        elena.wait_for_timeout(300)
        rt.shot(elena, f"{SLUG}-07")
        elena.get_by_role("button", name="Send withdrawal request").click()
        elena.wait_for_timeout(2000)
        rt.settle(elena)
        top(elena)
        rt.note("ELENA SENT: " + visible_text(elena, "main", 3000)[:700].replace(chr(10), " | "))
        scroll_to(elena, "Current subject withdrawal stage", offset=90)
        rt.shot(elena, f"{SLUG}-08")

    rt.step("Send the withdrawal request", send)

    # ---- Part D: GS Staff records and forwards -------------------------------------------------
    def staff_open():
        rt.go(staff, "/workflow/withdrawal")
        try:
            staff.get_by_role("link", name=re.compile("Withdrawal Requests")).first.click()
        except Exception:  # noqa: BLE001
            pass
        rt.settle(staff)
        staff.get_by_text("Elena Navarro").first.wait_for()
        rt.shot(staff, f"{SLUG}-09")

    rt.step("Staff see the request on the board", staff_open)

    VIEW = "xpath=//*[normalize-space(text())='Elena Navarro']/ancestor::*[.//button[normalize-space()='View']][1]//button[normalize-space()='View']"

    def staff_review():
        staff.locator(VIEW).first.click()
        staff.get_by_role("button", name="Record & forward to Dean").wait_for()
        staff.wait_for_timeout(600)
        rt.shot(staff, f"{SLUG}-10")

    rt.step("Staff open Elena's request", staff_review)

    def staff_history():
        staff.get_by_text("View stage history").first.click()
        staff.wait_for_timeout(600)
        staff.get_by_text("Step 6: GS Staff emails").first.scroll_into_view_if_needed()
        rt.shot(staff, f"{SLUG}-11")

    rt.step("Open the stage history", staff_history)

    def staff_forward():
        staff.get_by_role("button", name="Record & forward to Dean").first.click()
        staff.get_by_text("Confirm: Record & forward to Dean").first.wait_for()
        staff.wait_for_timeout(500)
        rt.shot(staff, f"{SLUG}-12")
        staff.get_by_role("button", name="Record & forward to Dean").last.click()
        staff.wait_for_timeout(2500)
        rt.settle(staff)
        rt.note("AFTER FORWARD: " + staff.locator("body").inner_text()[-900:].replace(chr(10), " | "))
        rt.shot(staff, f"{SLUG}-12b")

    rt.step("Record and forward to the Dean", staff_forward)

    # ---- Part E: Dean ----------------------------------------------------------------------
    dean = rt.new_page("dean@usls.edu.ph")

    def dean_open():
        rt.go(dean, "/dean/approvals/withdrawal")
        dean.get_by_text("Elena Navarro").first.wait_for()
        rt.note("DEAN PAGE: " + visible_text(dean, "main", 3000).replace(chr(10), " | "))
        rt.shot(dean, f"{SLUG}-13")

    rt.step("Dean opens Withdrawal Requests", dean_open)

    def dean_approve():
        btn = dean.get_by_role("button", name=re.compile(r"^(Review|View|Open|Approve)"))
        rt.note("DEAN BUTTONS: " + str([b.inner_text() for b in btn.all()][:6]))
        btn.first.click()
        dean.wait_for_timeout(1200)
        rt.note("DEAN DIALOG: " + dean.locator("body").inner_text()[-2500:].replace(chr(10), " | "))
        rt.shot(dean, f"{SLUG}-14")

    rt.step("Dean opens the request", dean_approve)

    def dean_decide():
        dean.get_by_role("button", name="Approve").first.click()
        dean.wait_for_timeout(1500)
        rt.note("DEAN AFTER APPROVE CLICK: " + dean.locator("body").inner_text()[-900:].replace(chr(10), " | "))
        rt.shot(dean, f"{SLUG}-15")
        dean.get_by_role("button", name="Approve current stage").click()
        dean.wait_for_timeout(2500)
        rt.settle(dean)
        rt.note("DEAN AFTER CONFIRM: " + dean.locator("main").last.inner_text()[:700].replace(chr(10), " | "))
        rt.shot(dean, f"{SLUG}-16")

    rt.step("Dean presses Approve and confirms", dean_decide)

    # ---- Part F: staff tag, export ----------------------------------------------------------
    def staff_after_approval():
        rt.go(staff, "/workflow/withdrawal")
        staff.get_by_text("Elena Navarro").first.wait_for()
        rt.shot(staff, f"{SLUG}-17")
        staff.locator(VIEW).first.click()
        staff.wait_for_timeout(1200)
        rt.note("STAFF APPROVED DIALOG: " + staff.locator("body").inner_text()[-2200:].replace(chr(10), " | "))
        rt.shot(staff, f"{SLUG}-18")

    rt.step("Staff reopen the approved request", staff_after_approval)

    def staff_tag():
        staff.get_by_role("button", name="Tag student as withdrawn from subject").first.click()
        staff.wait_for_timeout(1000)
        rt.note("TAG CONFIRM: " + staff.locator("body").inner_text()[-800:].replace(chr(10), " | "))
        rt.shot(staff, f"{SLUG}-19")
        staff.get_by_role("button", name=re.compile(r"Tag student as withdrawn from subject")).last.click()
        staff.wait_for_timeout(2500)
        rt.settle(staff)
        rt.note("AFTER TAG: " + staff.locator("body").inner_text()[-1500:].replace(chr(10), " | "))
        rt.shot(staff, f"{SLUG}-20")

    rt.step("Staff tag the subject as withdrawn", staff_tag)

    def staff_export():
        panel = staff.get_by_text("Approved subject withdrawals").first
        panel.scroll_into_view_if_needed()
        staff.evaluate("window.scrollBy(0, -60)")
        staff.wait_for_timeout(300)
        rt.shot(staff, f"{SLUG}-21")
        # select Elena's row (the row checkbox), else Select all
        row = staff.locator("tr", has_text="Elena Navarro").last
        box = row.locator("input[type=checkbox]")
        if box.count():
            box.first.check()
        else:
            staff.get_by_role("button", name="Select all").first.click()
        staff.wait_for_timeout(400)
        with staff.expect_download(timeout=30000) as dl:
            staff.get_by_role("button", name="Download Excel list").first.click()
        download = dl.value
        import tempfile, pathlib
        target = pathlib.Path(tempfile.mkdtemp()) / download.suggested_filename
        download.save_as(str(target))
        rt.note(f"DOWNLOAD: {download.suggested_filename}")
        try:
            import openpyxl
            wb = openpyxl.load_workbook(str(target))
            for ws in wb:
                for r in ws.iter_rows(values_only=True):
                    rt.note("XLSX ROW: " + " | ".join(str(c) for c in r if c is not None)[:600])
        except Exception as exc:  # noqa: BLE001
            rt.note(f"XLSX unreadable: {exc}")
        staff.wait_for_timeout(1500)
        rt.settle(staff)
        rt.note("AFTER EXPORT: " + staff.locator("body").inner_text()[-1800:].replace(chr(10), " | "))
        rt.shot(staff, f"{SLUG}-22")

    rt.step("Select Elena and download the Excel list", staff_export)

    def got_it():
        staff.get_by_role("button", name="Got it").first.click()
        staff.wait_for_timeout(800)
        staff.locator("xpath=//button[normalize-space()='Close details']").first.click()
        staff.wait_for_timeout(600)
        rt.settle(staff)
        rt.shot(staff, f"{SLUG}-23")

    rt.step("Acknowledge the export notice", got_it)

    # ---- Part G: verify in Enrollment -------------------------------------------------------
    def enrollment_check():
        rt.go(staff, "/enrollment")
        pick(staff, "Program", "MAED ")
        pick(staff, "Academic semester", CURRENT)
        sel = staff.locator("select").nth(2)
        opts = sel.locator("option").all_inner_texts()
        sel.select_option(label=next(o for o in opts if "Navarro, Elena" in o))
        rt.settle(staff)
        staff.get_by_text("Official offered subjects").first.wait_for()
        scroll_to(staff, "Official offered subjects", offset=90, exact=True)
        rt.shot(staff, f"{SLUG}-24")
        rows = staff.locator("tbody tr").all()
        out = []
        for r in rows:
            tx = r.inner_text().replace(chr(10), " ")
            if "MAED-" in tx:
                out.append(tx[:140])
        rt.note("ENROLLMENT ROWS: " + " || ".join(out))
        top(staff)
        rt.note("ENROLLMENT SUMMARY: " + visible_text(staff, "main", 12000).split("Official offered subjects")[0][-420:].replace(chr(10), " | "))
        rt.shot(staff, f"{SLUG}-25")

    rt.step("Enrollment shows only MAED-MAJ1 as Withdrawn for Elena", enrollment_check)

    def student_after():
        _open_withdrawal_page(rt, elena)
        top(elena)
        rt.note("ELENA AFTER: " + visible_text(elena, "main", 3000)[:500].replace(chr(10), " | "))
        rt.shot(elena, f"{SLUG}-26")
        rt.go(elena, "/student/enrollment")
        scroll_to(elena, re.compile(r"^MAED-MAJ1 ·"), offset=260)
        rt.shot(elena, f"{SLUG}-27")

    rt.step("Elena sees the same result", student_after)

    # ---- restore the semester start date -------------------------------------------------------
    rt.step("Restore the semester start date", lambda: _set_term_start(rt, staff, ORIGINAL_START, shots=(f"{SLUG}-28", f"{SLUG}-29")))
