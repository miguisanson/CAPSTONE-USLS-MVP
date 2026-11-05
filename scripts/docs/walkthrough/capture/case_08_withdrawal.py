"""Case 08 - Subject Withdrawal (I-178 page): Joshua Lim is refused (window closed), then Elena Navarro files, staff forward,
the Dean approves, staff tag and export, and the result shows in Enrollment. The semester start date is moved and restored."""
from __future__ import annotations

import pathlib
import re
import tempfile
import time

from playwright.sync_api import Page

from .common import Runtime
from .helpers_a2 import pick, scroll_to, top, visible_text

SLUG = "withdrawal"
CURRENT = "AY 2026-2027 1st Semester"
ORIGINAL_START = "2026-08-01"
SUBJECT = "MAED-MAJ1"
REASON = "I need to revise my first-semester study load."
ELENA = "Elena Navarro"


def s(n: int) -> str:
    return f"{SLUG}-{n:02d}"


def _set_term_start(rt: Runtime, page: Page, start: str, *, shots: tuple[str, str] | None = None) -> None:
    rt.go(page, "/term-settings")
    row = page.locator("tr", has_text=CURRENT).first
    row.get_by_role("button", name=re.compile("Edit dates")).click()
    page.wait_for_timeout(500)
    page.get_by_role("dialog").locator("input[type=date]").nth(0).fill(start)
    page.wait_for_timeout(300)
    if shots:
        rt.shot(page, shots[0])
    page.get_by_role("button", name=re.compile("Save dates")).click()
    page.wait_for_timeout(1200)
    rt.settle(page)
    if shots:
        page.locator("tr", has_text=CURRENT).first.scroll_into_view_if_needed()
        rt.shot(page, shots[1])


def _open_student_page(rt: Runtime, page: Page) -> None:
    rt.go(page, "/student/requests/withdrawal")
    page.get_by_role("heading", name="Subject Withdrawal").first.wait_for()


def _open_board(rt: Runtime, page: Page, path: str) -> None:
    rt.go(page, path)
    page.get_by_role("heading", name="Subject Withdrawal").first.wait_for()
    page.get_by_text(ELENA).first.wait_for()


def _card_button(page: Page, name: str = ELENA):
    return page.get_by_role("button", name=f"View details for {name}").first


def _dialog_button(page: Page, name):
    return page.get_by_role("dialog").last.get_by_role("button", name=name)


def _board_into_view(page: Page, rights: int = 0) -> None:
    """Scroll the page so the board columns fill the screen; ``rights`` clicks the board's right arrow to reach later stages."""
    page.get_by_role("button", name="Scroll board right").first.evaluate("e => e.scrollIntoView({block: 'start'})")
    page.evaluate("window.scrollBy(0, -70)")
    for _ in range(rights):
        arrow = page.get_by_role("button", name="Scroll board right").first
        if not arrow.is_enabled():
            break
        arrow.click()
        page.wait_for_timeout(500)
    page.wait_for_timeout(300)


def run(rt: Runtime) -> None:
    rt.reset("withdrawal-elena", "withdrawal-joshua")
    staff = rt.new_page("staff@usls.edu.ph")

    # an interrupted earlier run must not leave the semester dates moved
    rt.step("Restore the semester start date if a previous run left it moved", lambda: _set_term_start(rt, staff, ORIGINAL_START))

    # ---- Part A: the rule refuses (Joshua Lim, window closed) ----------------------------------
    joshua = rt.new_page("withdrawal.joshua@usls.edu.ph")

    def refusal():
        _open_student_page(rt, joshua)
        joshua.get_by_text("Subject withdrawal is closed right now").first.wait_for()
        rt.note("JOSHUA PAGE: " + visible_text(joshua, "main", 3000).replace(chr(10), " | ")[:900])
        rt.shot(joshua, s(1))
        joshua.get_by_role("button", name=re.compile("Rules applied on this screen")).click()
        joshua.wait_for_timeout(600)
        rt.note("JOSHUA RULES: " + visible_text(joshua, "main", 6000).replace(chr(10), " | ")[300:1500])
        rt.shot(joshua, s(2))

    rt.step("Joshua Lim: every subject is outside the withdrawal window", refusal)

    # ---- Part B: staff correct the recorded semester start date (demo clock is week 9) ---------
    start_inside = time.strftime("%Y-%m-%d", time.localtime(time.time() - 3 * 86400))
    rt.note(f"new start date {start_inside}")
    rt.step("Staff set the semester start date inside the window",
            lambda: _set_term_start(rt, staff, start_inside, shots=(s(3), s(4))))

    # ---- Part C: student request -----------------------------------------------------------------
    elena = rt.new_page("withdrawal.elena@usls.edu.ph")

    def student_form():
        _open_student_page(rt, elena)
        elena.get_by_text("Ask to withdraw from a subject").first.wait_for()
        rt.note("ELENA PAGE: " + visible_text(elena, "main", 4000).replace(chr(10), " | ")[:900])
        rt.shot(elena, s(5))

    rt.step("Elena opens Subject Withdrawal", student_form)

    def select_subject():
        sel = elena.get_by_label(re.compile(r"Enrolled subject", re.I)).first
        opts = sel.locator("option").all_inner_texts()
        rt.note(f"ELENA OPTIONS: {opts}")
        sel.select_option(label=next(o for o in opts if SUBJECT in o))
        elena.wait_for_timeout(600)
        scroll_to(elena, "Ask to withdraw from a subject", offset=100)
        rt.shot(elena, s(6))

    rt.step("Select MAED-MAJ1", select_subject)

    def send():
        elena.get_by_label(re.compile(r"Reason for withdrawing", re.I)).fill(REASON)
        elena.wait_for_timeout(300)
        rt.shot(elena, s(7))
        elena.get_by_role("button", name="Submit withdrawal request").click()
        elena.get_by_role("dialog").get_by_text("Send this request?").first.wait_for()
        elena.wait_for_timeout(400)
        rt.note("ELENA CONFIRM: " + elena.get_by_role("dialog").inner_text().replace(chr(10), " | ")[:500])
        rt.shot(elena, s(8))
        elena.get_by_role("dialog").get_by_role("button", name="Send request").click()
        elena.wait_for_timeout(2500)
        rt.settle(elena)
        top(elena)
        rt.note("ELENA SENT: " + visible_text(elena, "main", 4000).replace(chr(10), " | ")[:900])
        rt.shot(elena, s(9))

    rt.step("Send the withdrawal request", send)

    # ---- Part D: GS Staff record and forward ------------------------------------------------------
    def staff_open():
        rt.go(staff, "/workflow/withdrawal")
        staff.get_by_role("heading", name="Subject Withdrawal").first.wait_for()
        staff.get_by_text(ELENA).first.wait_for()
        rt.note("STAFF BOARD: " + visible_text(staff, "main", 8000).replace(chr(10), " | ")[:1500])
        _board_into_view(staff)
        rt.shot(staff, s(10))

    rt.step("Staff see the request on the board", staff_open)

    def staff_table():
        staff.get_by_role("button", name="Table", exact=True).click()
        staff.wait_for_timeout(800)
        rt.note("STAFF TABLE: " + visible_text(staff, "main", 6000).replace(chr(10), " | ")[:1200])
        rt.shot(staff, s(11))
        staff.get_by_role("button", name="Board", exact=True).click()
        staff.wait_for_timeout(600)

    rt.step("Switch the board to the Table view and back", staff_table)

    def staff_review():
        _card_button(staff).click()
        staff.get_by_role("dialog").get_by_text("Record and forward to Dean").first.wait_for()
        staff.wait_for_timeout(800)
        rt.note("STAFF DETAIL: " + staff.get_by_role("dialog").inner_text().replace(chr(10), " | ")[:2500])
        rt.shot(staff, s(12))

    rt.step("Staff open Elena's request", staff_review)

    def staff_history():
        dlg = staff.get_by_role("dialog").last
        toggle = dlg.get_by_role("button", name=re.compile("Who did what")).element_handle()  # its label changes once open
        toggle.click()
        staff.wait_for_timeout(600)
        toggle.evaluate("e => e.scrollIntoView({block: 'start'})")
        staff.wait_for_timeout(300)
        rt.note("STAFF HISTORY: " + dlg.inner_text().replace(chr(10), " | ")[-500:])
        rt.shot(staff, s(13))

    rt.step("Open the stage history in the request window", staff_history)

    def staff_forward():
        _dialog_button(staff, re.compile("Record and forward to Dean")).click()
        staff.wait_for_timeout(1000)
        rt.note("STAFF FORWARD DIALOG: " + staff.get_by_role("dialog").last.inner_text().replace(chr(10), " | ")[:700])
        rt.shot(staff, s(14))
        _dialog_button(staff, re.compile("Record and forward to Dean")).last.click()
        staff.wait_for_timeout(2500)
        rt.settle(staff)
        rt.note("AFTER FORWARD: " + visible_text(staff, "main", 6000).replace(chr(10), " | ")[:1200])
        rt.shot(staff, s(15))

    rt.step("Record and forward to the Dean", staff_forward)

    # ---- Part E: Dean ------------------------------------------------------------------------------
    dean = rt.new_page("dean@usls.edu.ph")

    def dean_open():
        _open_board(rt, dean, "/dean/approvals/withdrawal")
        rt.note("DEAN PAGE: " + visible_text(dean, "main", 6000).replace(chr(10), " | ")[:1500])
        _board_into_view(dean)
        rt.shot(dean, s(16))

    rt.step("Dean opens Subject Withdrawal", dean_open)

    def dean_detail():
        _card_button(dean).click()
        dean.get_by_role("dialog").get_by_text("Approve the withdrawal").first.wait_for()
        dean.wait_for_timeout(800)
        rt.note("DEAN DETAIL: " + dean.get_by_role("dialog").inner_text().replace(chr(10), " | ")[:2500])
        rt.shot(dean, s(17))

    rt.step("Dean opens the request", dean_detail)

    def dean_decide():
        _dialog_button(dean, re.compile(r"^Approve the withdrawal")).click()
        dean.wait_for_timeout(1000)
        rt.note("DEAN APPROVE DIALOG: " + dean.get_by_role("dialog").last.inner_text().replace(chr(10), " | ")[:700])
        rt.shot(dean, s(18))
        _dialog_button(dean, re.compile(r"^Approve the withdrawal")).last.click()
        dean.wait_for_timeout(2500)
        rt.settle(dean)
        rt.note("DEAN AFTER APPROVE: " + visible_text(dean, "main", 6000).replace(chr(10), " | ")[:1200])
        rt.shot(dean, s(19))

    rt.step("Dean approves the withdrawal", dean_decide)

    # ---- Part F: export, then mark as sent (the Dean's approval already tagged the subject) ---------
    def staff_after_approval():
        _open_board(rt, staff, "/workflow/withdrawal")
        _board_into_view(staff, rights=1)
        rt.shot(staff, s(20))
        rt.note("STAFF AFTER APPROVAL: " + visible_text(staff, "main", 8000).replace(chr(10), " | ")[:1500])
        rt.shot(staff, s(22))

    rt.step("Staff see the approved request already tagged, ready for export", staff_after_approval)

    def staff_export():
        staff.get_by_role("button", name="Prepare Excel export").first.scroll_into_view_if_needed()
        staff.evaluate("window.scrollBy(0, -120)")
        staff.wait_for_timeout(300)
        rt.shot(staff, s(23))
        staff.get_by_role("button", name="Prepare Excel export").first.click()
        staff.get_by_role("dialog").get_by_text("Approved subject withdrawals").first.wait_for()
        staff.wait_for_timeout(800)
        rt.note("EXPORT WINDOW: " + staff.get_by_role("dialog").inner_text().replace(chr(10), " | ")[:900])
        rt.shot(staff, s(24))
        with staff.expect_download(timeout=30000) as dl:
            staff.get_by_role("dialog").get_by_role("button", name="Download Excel list").click()
        download = dl.value
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
        rt.note("AFTER EXPORT: " + staff.get_by_role("dialog").last.inner_text().replace(chr(10), " | ")[:900])
        rt.shot(staff, s(25))

    rt.step("Download the Excel list", staff_export)

    def got_it():
        staff.get_by_role("button", name="Got it").first.click()
        staff.wait_for_timeout(800)
        rt.settle(staff)
        rt.note("AFTER GOT IT: " + visible_text(staff, "main", 8000).replace(chr(10), " | ")[:1500])
        _board_into_view(staff, rights=2)
        rt.shot(staff, s(26))

    rt.step("Acknowledge the export notice", got_it)

    def staff_send():
        _card_button(staff).click()
        staff.get_by_role("dialog").get_by_text(re.compile("Mark as sent to the Registrar")).first.wait_for()
        staff.wait_for_timeout(1000)
        _dialog_button(staff, re.compile("Mark as sent to the Registrar")).click()
        staff.wait_for_timeout(1000)
        rt.note("SEND DIALOG: " + staff.get_by_role("dialog").last.inner_text().replace(chr(10), " | ")[:700])
        rt.shot(staff, s(21))
        _dialog_button(staff, re.compile("Mark as sent to the Registrar")).last.click()
        staff.wait_for_timeout(2500)
        rt.settle(staff)
        rt.note("AFTER SEND: " + visible_text(staff, "main", 8000).replace(chr(10), " | ")[:1500])

    rt.step("Staff mark the list as sent to the Registrar", staff_send)

    # ---- Part G: verify in Enrollment ---------------------------------------------------------------
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
        rt.shot(staff, s(27))
        out = []
        for r in staff.locator("tbody tr").all():
            tx = r.inner_text().replace(chr(10), " ")
            if "MAED-" in tx:
                out.append(tx[:140])
        rt.note("ENROLLMENT ROWS: " + " || ".join(out))

    rt.step("Enrollment shows only MAED-MAJ1 as Withdrawn for Elena", enrollment_check)

    def student_after():
        _open_student_page(rt, elena)
        top(elena)
        rt.note("ELENA AFTER: " + visible_text(elena, "main", 4000).replace(chr(10), " | ")[:900])
        scroll_to(elena, re.compile(r"^Subject withdrawal$"), offset=110)
        rt.shot(elena, s(28))
        rt.go(elena, "/student/enrollment")
        scroll_to(elena, re.compile(r"^MAED-MAJ1 ·"), offset=200)
        rt.note("ELENA ENROLLMENT: " + visible_text(elena, "main", 6000).replace(chr(10), " | ")[1500:2500])
        rt.shot(elena, s(29))

    rt.step("Elena sees the same result", student_after)

    # ---- restore the semester start date ---------------------------------------------------------------
    rt.step("Restore the semester start date", lambda: _set_term_start(rt, staff, start_inside, shots=(s(30), s(31))))
