"""B2 (I-141, AD10): GET /api/reports/summary, the six numbers on top of the Reports pages.

Expected values are worked out from the rows built here (known dates and statuses), never from the endpoint.
Terms: T-Prev = 120..60 days ago, T-Now = 59 days ago .. 60 days ahead. Students (program PA / PB, entry cohort):
a1, a2 and a6 (PA, 24-25) and a3 (PB, 25-26) are active; a4 (PB, 24-25) is Completed, a5 (PA, 25-26) is on leave.
"""
import json
import unittest
from datetime import datetime, timedelta

from tests import reports_support  # noqa: F401  (sets the environment before app is imported)
from tests.reports_support import TODAY, ReportsV2Base, db, make_student, now_utc

from app import (  # noqa: E402
    app,
    AcademicTerm, DefenseVerdict, Faculty, GraduationEndorsement, LeaveCase, Program, ScheduleRequest,
    StudentStageEvent, TermEnrollment, TransactionLog, WithdrawalApplication,
)

NOW = now_utc()


def ago(days):
    return NOW - timedelta(days=days)


def _schedule(student, defense_type, day, status):
    request = ScheduleRequest(
        student_id=student.id, preferred_date=day, start_time=datetime(2000, 1, 1, 9, 0).time(),
        end_time=datetime(2000, 1, 1, 10, 0).time(), defense_type=defense_type, mode="Face-to-face", venue="Room 1",
        status=status, panel_snapshot=json.dumps([]),
    )
    db.session.add(request)
    db.session.flush()
    return request


class SummaryBase(ReportsV2Base):
    @classmethod
    def build(cls):
        pa = Program(code="PA", name="Program Alpha", college="Graduate School", has_practicum=False)
        pb = Program(code="PB", name="Program Beta", college="Graduate School", has_practicum=False)
        db.session.add_all([pa, pb])
        db.session.flush()
        cls.pa_id, cls.pb_id = pa.id, pb.id
        s = {
            "a1": make_student(pa, "A-1", "24-25"),
            "a2": make_student(pa, "A-2", "24-25", stage="Proposal Defense", risk="Delayed"),
            "a3": make_student(pb, "A-3", "25-26", risk="At Risk of Delay"),
            "a4": make_student(pb, "A-4", "24-25", stage="Completed"),
            "a5": make_student(pa, "A-5", "25-26", standing="On Leave"),
            "a6": make_student(pa, "A-6", "24-25"),
        }
        cls.ids = {name: student.id for name, student in s.items()}
        prev = AcademicTerm(label="T-Prev", start_date=TODAY - timedelta(days=120), end_date=TODAY - timedelta(days=60))
        db.session.add_all([
            prev,
            AcademicTerm(label="T-Now", start_date=TODAY - timedelta(days=59), end_date=TODAY + timedelta(days=60)),
        ])
        db.session.flush()
        for name in ("a1", "a2", "a4"):
            db.session.add(TermEnrollment(student_id=s[name].id, term_id=prev.id, status="Confirmed"))
        # Open requests: a3 waits 20 days (Dean), a6 waits 9 days, a1 only 3 days; a2's was closed (next owner "None").
        for name, slug, days, owner in (
            ("a3", "readmission", 20, "Dean"), ("a6", "enrollment", 9, "Academic Coordinator"),
            ("a1", "enrollment", 3, "Graduate School Staff"), ("a2", "enrollment", 30, "None"),
        ):
            db.session.add(TransactionLog(
                transaction_slug=slug, student_id=s[name].id, actor_role="Student", result="submitted",
                next_owner=owner, created_at=ago(days),
            ))
        # Decisions made this term take 2, 6 and 10 days (median 6); last term one took 4.
        for name, forwarded, decided in (("a1", 30, 28), ("a2", 20, 14)):
            db.session.add(LeaveCase(
                student_id=s[name].id, kind="LOA", status="Leave Scheduled", forwarded_at=ago(forwarded),
                decided_at=ago(decided), submitted_at=ago(forwarded + 1),
            ))
        for name, created, decided in (("a3", 50, 40), ("a1", 100, 96)):
            db.session.add(WithdrawalApplication(
                student_id=s[name].id, status="Sent to Registrar", dean_decision="Approved",
                created_at=ago(created), decided_at=ago(decided),
            ))
        # Defenses: a2 one held this term and one last term, a1 one in 10 days, a6 one 5 days ago with no verdict.
        faculty = Faculty(name="Dr. Chair", college="GS", role="Faculty", specialization="Methods", email="chair@v2.test")
        db.session.add(faculty)
        db.session.flush()
        held = _schedule(s["a2"], "Proposal Defense", TODAY - timedelta(days=20), "Held")
        db.session.add(DefenseVerdict(
            student_id=s["a2"].id, schedule_request_id=held.id, panel_assignment_id=1, faculty_id=faculty.id,
            gate="Proposal Defense", defense_type="Proposal Defense", chair_name="Dr. Chair", result="Passed",
            defense_date=held.preferred_date,
        ))
        _schedule(s["a2"], "Title Defense", TODAY - timedelta(days=90), "Held")
        _schedule(s["a1"], "Title Defense", TODAY + timedelta(days=10), "Scheduled")
        _schedule(s["a6"], "Title Defense", TODAY - timedelta(days=5), "Scheduled")
        _schedule(s["a3"], "Title Defense", TODAY + timedelta(days=5), "Cancelled")
        # Endorsements sent to the Dean: one this term, two last term.
        for name, days in (("a6", 10), ("a4", 100), ("a1", 90)):
            db.session.add(GraduationEndorsement(
                student_id=s[name].id, review_window="2025-2026", endorsement_status="Ready for Dean Review",
                submitted_at=ago(days),
            ))


class SummaryTests(SummaryBase):
    def tiles(self, role="staff", **params):
        payload = self.get("/api/reports/summary", role=role, term="T-Now", **params)
        return payload, {tile["key"]: tile for tile in payload["tiles"]}

    def ids_of(self, *names):
        return sorted(self.ids[name] for name in names)

    def test_six_tiles_in_order(self):
        payload, _ = self.tiles()
        self.assertEqual([t["key"] for t in payload["tiles"]],
                         ["active", "behind", "waiting", "decide_days", "defenses", "graduation"])
        self.assertEqual(payload["term"]["label"], "T-Now")
        self.assertEqual(payload["previous_term"]["label"], "T-Prev")

    def test_active_students_against_last_terms_enrollment(self):
        _, tiles = self.tiles()
        tile = tiles["active"]
        self.assertEqual(tile["value"], 4)
        self.assertEqual(tile["comparison"]["kind"], "previous_term")
        self.assertEqual((tile["comparison"]["previous"], tile["comparison"]["delta"]), (3, 1))

    def test_behind_schedule_is_a_share_of_active_against_the_target(self):
        _, tiles = self.tiles()
        tile = tiles["behind"]
        self.assertEqual((tile["count"], tile["of"], tile["value"]), (2, 4, 50.0))
        self.assertEqual(tile["comparison"]["kind"], "target")
        self.assertEqual(tile["comparison"]["target"], 10)
        self.assertFalse(tile["comparison"]["met"])

    def test_requests_waiting_over_seven_days(self):
        _, tiles = self.tiles()
        tile = tiles["waiting"]
        self.assertEqual(tile["value"], 2)  # a3 (20 days) and a6 (9 days); a1 is 3 days, a2's was closed
        self.assertEqual(tile["comparison"], {"kind": "target", "target": 0, "met": False, "text": "target 0"})

    def test_median_days_to_decide_this_term_and_last(self):
        _, tiles = self.tiles()
        tile = tiles["decide_days"]
        self.assertEqual(tile["value"], 6.0)
        self.assertEqual(tile["count"], 3)
        self.assertEqual((tile["comparison"]["previous"], tile["comparison"]["delta"]), (4.0, 2.0))

    def test_defenses_held_upcoming_and_awaiting_a_verdict(self):
        _, tiles = self.tiles()
        tile = tiles["defenses"]
        self.assertEqual(tile["value"], 1)
        self.assertEqual(tile["detail"], {"held": 1, "next_30_days": 1, "awaiting_verdict": 1})
        self.assertEqual(tile["comparison"]["previous"], 1)

    def test_graduation_endorsed_to_the_dean_this_term_and_last(self):
        _, tiles = self.tiles()
        tile = tiles["graduation"]
        self.assertEqual(tile["value"], 1)
        self.assertEqual((tile["comparison"]["previous"], tile["comparison"]["delta"]), (2, -1))
        self.assertIn("eligible_now", tile["detail"])

    def test_the_first_term_says_there_is_no_earlier_term(self):
        payload = self.get("/api/reports/summary", term="T-Prev")
        self.assertIsNone(payload["previous_term"])
        for tile in payload["tiles"]:
            if tile["comparison"]["kind"] != "target":
                self.assertEqual(tile["comparison"], {"kind": "none", "text": "no earlier term yet"}, tile["key"])

    def test_program_and_cohort_filters(self):
        _, tiles = self.tiles(program_id=self.pa_id)
        self.assertEqual(tiles["active"]["value"], 3)  # a1, a2, a6 (a5 is on leave)
        self.assertEqual((tiles["behind"]["count"], tiles["behind"]["of"]), (1, 3))
        _, tiles = self.tiles(cohort="2025-2026")  # the long spelling of 25-26: a3 and a5
        self.assertEqual(tiles["active"]["value"], 1)
        self.assertEqual(tiles["waiting"]["value"], 1)

    def test_each_tile_opens_the_students_behind_it(self):
        _, tiles = self.tiles()
        for key, tile in tiles.items():
            self.assertEqual(tile["drill"]["url"], f"/api/reports/summary/{key}", key)
        active = self.get("/api/reports/summary/active", term="T-Now")
        self.assertEqual(sorted(r["student_id"] for r in active["rows"]), self.ids_of("a1", "a2", "a3", "a6"))
        self.assertEqual(active["count"], tiles["active"]["value"])
        waiting = self.get("/api/reports/summary/waiting", term="T-Now")
        self.assertEqual(sorted(r["student_id"] for r in waiting["rows"]), self.ids_of("a3", "a6"))
        behind = self.get("/api/reports/summary/behind", term="T-Now")
        self.assertEqual(sorted(r["student_id"] for r in behind["rows"]), self.ids_of("a2", "a3"))
        for key in tiles:
            listing = self.get(f"/api/reports/summary/{key}", term="T-Now")
            self.assertEqual(listing["count"], len(listing["rows"]), key)
            for row in listing["rows"]:
                self.assertTrue({"student", "detail"} <= set(row), key)

    def test_unknown_tile_is_404(self):
        self.assertEqual(self.client().get("/api/reports/summary/nope").status_code, 404)

    def test_who_may_open_it(self):
        for role in ("staff", "academic_coordinator", "research_coordinator", "dean"):
            self.assertEqual(self.client(role).get("/api/reports/summary").status_code, 200, role)
        self.assertEqual(self.client("student").get("/api/reports/summary").status_code, 403)

    def test_opening_it_writes_nothing(self):
        def counts():
            with app.app_context():
                return TransactionLog.query.count(), StudentStageEvent.query.count()
        before = counts()
        self.get("/api/reports/summary", term="T-Now")
        self.get("/api/reports/summary/defenses", term="T-Now")
        self.assertEqual(counts(), before)


if __name__ == "__main__":
    unittest.main()
