"""Case 21 - Reports & Analytics (staff): operational reports, analytics, KPI measurements, dashboard overview."""
from __future__ import annotations

import re

from .common import Runtime
from .helpers_a2 import scroll_to, top, visible_text

SLUG = "reports"


def _chip(page, name: str) -> None:
    page.get_by_role("button", name=name).first.click()
    page.wait_for_timeout(900)
    Runtime.settle(page, 500)


def run(rt: Runtime) -> None:
    staff = rt.new_page("staff@usls.edu.ph")

    def dashboard():
        rt.go(staff, "/")
        staff.get_by_text("Graduate School Overview").first.wait_for()
        rt.note("DASHBOARD: " + visible_text(staff, "main", 5000).split("Lifecycle stage distribution")[0][-260:].replace(chr(10), " | "))
        rt.shot(staff, f"{SLUG}-01")
        scroll_to(staff, "Lifecycle stage distribution", offset=90, exact=True)
        rt.shot(staff, f"{SLUG}-02")

    rt.step("Dashboard overview", dashboard)

    def reports_home():
        rt.go(staff, "/reports")
        staff.get_by_text("Students monitored").first.wait_for()
        t = visible_text(staff, "main", 4000)
        rt.note("REPORTS CHIPS: " + " | ".join(re.findall(r"[A-Za-z/& \-]+ · \d+", t)))
        rt.note("REPORTS SUMMARY: " + t.split("Dashboard summary")[-1][:400].replace(chr(10), " | "))
        rt.shot(staff, f"{SLUG}-03")
        staff.evaluate("window.scrollBy(0, 330)")
        staff.wait_for_timeout(300)
        rt.shot(staff, f"{SLUG}-04")

    rt.step("Reports: operational report set and summary", reports_home)

    for idx, (chip, shot) in enumerate([("Missing requirements", "05"), ("At-risk", "06"), ("LOA/readmission", "07"), ("Open/overdue tasks", "08")]):
        def op(chip=chip, shot=shot):
            _chip(staff, chip)
            t = visible_text(staff, "main", 9000)
            i = t.find("Research completion")
            rt.note(f"REPORT {chip}: " + t[i + 20:i + 700].replace(chr(10), " | "))
            staff.evaluate("window.scrollBy(0, 330)")
            staff.wait_for_timeout(300)
            rt.shot(staff, f"{SLUG}-{shot}")

        rt.step(f"Operational report: {chip}", op)

    def bottlenecks():
        _chip(staff, "Stage bottlenecks")
        scroll_to(staff, "Module KPI measurements", offset=90, exact=True)
        rt.shot(staff, f"{SLUG}-09")
        scroll_to(staff, re.compile(r"^Computed from recorded event history"), offset=160)
        rt.shot(staff, f"{SLUG}-10")

    rt.step("Stage bottlenecks and the KPI measurements", bottlenecks)

    def kpis():
        t = visible_text(staff, "main", 14000)
        i = t.find("Module KPI measurements")
        rt.note("KPI BLOCK: " + t[i:i + 2600].replace(chr(10), " | "))
        scroll_to(staff, "Module KPI measurements", offset=90, exact=True)
        staff.evaluate("window.scrollBy(0, 320)")
        staff.wait_for_timeout(300)
        rt.shot(staff, f"{SLUG}-11")

    rt.step("Read the KPI basis lines", kpis)

    for chip, shot in [("Queue aging & backlog", "12"), ("Residency watchlist", "13"), ("Workload & turnaround", "14"), ("Completion & attrition", "15"),
                       ("Scheduling cycle time", "16"), ("Follow-up closure", "17")]:
        def an(chip=chip, shot=shot):
            _chip(staff, chip)
            t = visible_text(staff, "main", 14000)
            i = t.find("Computed from recorded event history")
            rt.note(f"ANALYTICS {chip}: " + t[i - 60:i + 900].replace(chr(10), " | "))
            scroll_to(staff, re.compile(r"^Computed from recorded event history"), offset=160)
            rt.shot(staff, f"{SLUG}-{shot}")

        rt.step(f"Analytics report: {chip}", an)
