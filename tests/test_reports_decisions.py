"""B5 (I-141, AD10): D1-D3 for the Dean and S4 office cycle times.

GET /api/reports/decisions   waiting for a decision (age bands), how fast decisions are made (median / p90), outcomes
GET /api/reports/cycle-times open cases by age and closed-case cycle times per office, plus the scheduling cycle

Expected numbers come from timestamps built here (whole days before one fixed "now"), never from the endpoint.
Terms: T-Prev = 120..60 days ago, T-Now = 59 days ago .. 60 days ahead.
"""
import json
import unittest
from datetime import datetime, timedelta

from tests import reports_support  # noqa: F401  (sets the environment before app is imported)
from tests.reports_support import TODAY, ReportsV2Base, db, make_student, now_utc

from app import (  # noqa: E402
    AcademicTerm, AdviserAppointment, CourseworkReport, Faculty, GraduationEndorsement, LeaveCase, Program,
    ScheduleRequest, TransactionLog, WithdrawalApplication,
)

NOW = now_utc()


def ago(days):
    return NOW - timedelta(days=days)


def _leave(student, kind, status, forwarded, decided=None):
    db.session.add(LeaveCase(
        student_id=student.id, kind=kind, status=status, forwarded_at=ago(forwarded),
        submitted_at=ago(forwarded + 1), decided_at=ago(decided) if decided is not None else None,
    ))


class DecisionsBase(ReportsV2Base):
    @classmethod
    def build(cls):
        pa = Program(code="PA", name="Program Alpha", college="Graduate School", has_practicum=False)
        pb = Program(code="PB", name="Program Beta", college="Graduate School", has_practicum=False)
        db.session.add_all([pa, pb])
        faculty = Faculty(name="Dr. Adviser", college="GS", role="Faculty", specialization="Methods", email="adv@v2.test")
        db.session.add(faculty)
        db.session.add_all([
            AcademicTerm(label="T-Prev", start_date=TODAY - timedelta(days=120), end_date=TODAY - timedelta(days=60)),
            AcademicTerm(label="T-Now", start_date=TODAY - timedelta(days=59), end_date=TODAY + timedelta(days=60)),
        ])
        db.session.flush()
        cls.pa_id, cls.pb_id = pa.id, pb.id
        s = {n: make_student(pa if n != "d3" else pb, f"D-{n}") for n in ("d1", "d2", "d3", "d4")}
        cls.ids = {name: student.id for name, student in s.items()}
        # Waiting with the Dean: LOA 2 days and 10 days, readmission 20 days, withdrawal 5 days, graduation 1 day,
        # adviser designation 16 days.
        _leave(s["d1"], "LOA", "Dean Review", 2)
        _leave(s["d2"], "LOA", "Dean Review", 10)
        _leave(s["d3"], "READMISSION", "Dean Review", 20)
        db.session.add(WithdrawalApplication(student_id=s["d1"].id, status="Dean Review", dean_decision="Pending", created_at=ago(5)))
        db.session.add(GraduationEndorsement(student_id=s["d2"].id, endorsement_status="Ready for Dean Review", submitted_at=ago(1)))
        db.session.add(AdviserAppointment(
            student_id=s["d4"].id, faculty_id=faculty.id, status="Under deliberation", forwarded_at=ago(16),
        ))
        # Decided this term: LOA took 4 (approved), 10 (denied), 2 (approved) and 6 (returned) days.
        _leave(s["d1"], "LOA", "Leave Scheduled", 30, 26)
        _leave(s["d2"], "LOA", "Denied", 25, 15)
        _leave(s["d3"], "LOA", "Leave Scheduled", 40, 38)
        _leave(s["d4"], "LOA", "Returned", 50, 44)
        # Decided last term: LOA took 10 and 6 days.
        _leave(s["d1"], "LOA", "Leave Scheduled", 100, 90)
        _leave(s["d2"], "LOA", "Leave Scheduled", 110, 104)
        # A withdrawal took 5 days, a coursework report 3 days (this term).
        db.session.add(WithdrawalApplication(
            student_id=s["d3"].id, status="Sent to Registrar", dean_decision="Approved", created_at=ago(45), decided_at=ago(40),
        ))
        db.session.add(CourseworkReport(
            program_id=pa.id, term_label="T-Now", status="Acknowledged", sent_at=ago(30), dean_decision="Acknowledged",
            dean_decision_at=ago(27),
        ))


class DecisionsTests(DecisionsBase):
    def decisions(self, role="dean", **params):
        return self.get("/api/reports/decisions", role=role, term="T-Now", **params)

    @staticmethod
    def by_process(payload, section):
        return {row["process"]: row for row in payload[section]["rows"]}

    def test_waiting_for_a_decision_by_age_band(self):
        payload = self.decisions()
        self.assertEqual(payload["waiting"]["bands"], ["0-3 days", "4-7 days", "8-14 days", "15+ days"])
        rows = self.by_process(payload, "waiting")
        self.assertEqual(rows["leave-of-absence"]["bands"], {"0-3 days": 1, "4-7 days": 0, "8-14 days": 1, "15+ days": 0})
        self.assertEqual((rows["leave-of-absence"]["total"], rows["leave-of-absence"]["oldest_days"]), (2, 10))
        self.assertEqual(rows["readmission"]["bands"]["15+ days"], 1)
        self.assertEqual(rows["withdrawal"]["bands"]["4-7 days"], 1)
        self.assertEqual(rows["adviser"]["bands"]["15+ days"], 1)
        self.assertEqual(rows["practicum"]["total"], 0)
        # d2's graduation endorsement is Ready for Dean Review, but the student is not eligible: like the Dean's own
        # list, the report does not count it as waiting.
        self.assertEqual(rows["graduation"]["total"], 0)
        self.assertEqual(payload["waiting"]["total"], 5)

    def test_median_and_p90_days_to_decide_this_term_and_last(self):
        rows = self.by_process(self.decisions(), "speed")
        loa = rows["leave-of-absence"]
        # this term 4, 10, 2, 6 days: median (4 + 6) / 2, nearest-rank p90 is the 4th of 4 values
        self.assertEqual(loa["this_term"], {"count": 4, "median_days": 5.0, "p90_days": 10.0})
        self.assertEqual(loa["last_term"], {"count": 2, "median_days": 8.0, "p90_days": 10.0})
        self.assertEqual(loa["change_days"], -3.0)
        self.assertEqual(rows["withdrawal"]["this_term"], {"count": 1, "median_days": 5.0, "p90_days": 5.0})
        self.assertIsNone(rows["withdrawal"]["last_term"])
        self.assertEqual(rows["coursework"]["this_term"]["median_days"], 3.0)
        self.assertEqual(rows["practicum"]["this_term"], {"count": 0, "median_days": None, "p90_days": None})
        # all six decisions of the term: 2, 3, 4, 5, 6 and 10 days -> median (4 + 5) / 2, p90 is the 6th of 6
        overall = self.decisions()["speed"]["overall"]
        self.assertEqual(overall["this_term"], {"count": 6, "median_days": 4.5, "p90_days": 10.0})

    def test_outcomes_this_term(self):
        rows = self.by_process(self.decisions(), "outcomes")
        self.assertEqual({k: rows["leave-of-absence"][k] for k in ("approved", "returned", "denied", "total")},
                         {"approved": 2, "returned": 1, "denied": 1, "total": 4})
        self.assertEqual(rows["withdrawal"]["approved"], 1)
        self.assertEqual(rows["coursework"]["approved"], 1)  # "Acknowledged" is an approval
        self.assertEqual(self.decisions()["outcomes"]["totals"], {"approved": 4, "returned": 1, "denied": 1, "total": 6})

    def test_the_case_list_matches_the_numbers(self):
        payload = self.decisions()
        waiting = [c for c in payload["cases"] if c["state"] == "waiting"]
        decided = [c for c in payload["cases"] if c["state"] == "decided"]
        self.assertEqual(len(waiting), payload["waiting"]["total"])
        self.assertEqual(len(decided), payload["outcomes"]["totals"]["total"])
        loa_waiting = [c for c in waiting if c["process"] == "leave-of-absence"]
        self.assertEqual(sorted(c["days"] for c in loa_waiting), [2, 10])
        self.assertTrue(all(c["band"] for c in waiting))
        self.assertTrue(all(c["outcome"] in ("approved", "returned", "denied") for c in decided))
        self.assertEqual(sorted(c["days"] for c in decided if c["process"] == "leave-of-absence"), [2.0, 4.0, 6.0, 10.0])

    def test_program_filter_leaves_program_level_cases_of_that_program(self):
        rows = self.by_process(self.decisions(program_id=self.pb_id), "waiting")
        self.assertEqual(rows["readmission"]["total"], 1)  # d3 is in PB
        self.assertEqual(rows["leave-of-absence"]["total"], 0)
        decided = self.by_process(self.decisions(program_id=self.pa_id), "outcomes")
        self.assertEqual(decided["coursework"]["total"], 1)
        self.assertEqual(self.by_process(self.decisions(program_id=self.pb_id), "outcomes")["coursework"]["total"], 0)

    def test_who_may_open_it(self):
        for role in ("dean", "staff", "academic_coordinator"):
            self.assertEqual(self.client(role).get("/api/reports/decisions").status_code, 200, role)
        self.assertEqual(self.client("student").get("/api/reports/decisions").status_code, 403)


class CycleTimesTests(ReportsV2Base):
    @classmethod
    def build(cls):
        pa = Program(code="PA", name="Program Alpha", college="Graduate School", has_practicum=False)
        db.session.add(pa)
        db.session.add_all([
            AcademicTerm(label="T-Old", start_date=TODAY - timedelta(days=200), end_date=TODAY - timedelta(days=100)),
            AcademicTerm(label="T-Now", start_date=TODAY - timedelta(days=59), end_date=TODAY + timedelta(days=60)),
        ])
        db.session.flush()
        s = {n: make_student(pa, f"C-{n}") for n in ("c1", "c2", "c3", "c4")}
        cls.ids = {name: student.id for name, student in s.items()}

        def log(name, slug, days, owner):
            db.session.add(TransactionLog(
                transaction_slug=slug, student_id=s[name].id, actor_role="Student", result="step", next_owner=owner, created_at=ago(days),
            ))
        # Enrollment: c1 closed after 10 days, c2 after 15 days; c3 is still open and has waited 12 days.
        log("c1", "enrollment", 30, "Academic Coordinator"); log("c1", "enrollment", 20, "None")
        log("c2", "enrollment", 40, "Academic Coordinator"); log("c2", "enrollment", 25, "None")
        log("c3", "enrollment", 12, "Graduate School Staff")
        # Course adjustments: c4 opened 3 days ago.
        log("c4", "course-adjustments", 3, "Academic Coordinator")
        # Scheduling: two confirmed Title Defense requests took 5 and 10 days.
        for created, confirmed in ((20, 15), (30, 20)):
            db.session.add(ScheduleRequest(
                student_id=s["c1"].id, preferred_date=TODAY + timedelta(days=5), start_time=datetime(2000, 1, 1, 9, 0).time(),
                end_time=datetime(2000, 1, 1, 10, 0).time(), defense_type="Title Defense", mode="Face-to-face", venue="Room 1",
                status="Scheduled", panel_snapshot=json.dumps([]), created_at=ago(created), confirmed_at=ago(confirmed),
            ))

    def rows(self, **params):
        payload = self.get("/api/reports/cycle-times", **params)
        return payload, {row["slug"]: row for row in payload["rows"]}

    def test_closed_case_cycle_times_and_open_cases_by_age(self):
        payload, rows = self.rows()
        enrollment = rows["enrollment"]
        self.assertEqual(enrollment["process_area"], "Enrollment")
        self.assertEqual((enrollment["closed_cases"], enrollment["median_cycle_days"], enrollment["p90_cycle_days"]), (2, 12.5, 15.0))
        self.assertEqual((enrollment["open_cases"], enrollment["bucket_8_14"], enrollment["oldest_age_days"]), (1, 1, 12))
        adjustments = rows["course-adjustments"]
        self.assertEqual((adjustments["open_cases"], adjustments["bucket_0_7"], adjustments["closed_cases"]), (1, 1, 0))
        self.assertIsNone(adjustments["median_cycle_days"])
        self.assertNotIn("awol", rows)  # an office with no cases is not listed

    def test_open_case_list_matches_the_counts(self):
        payload, rows = self.rows()
        self.assertEqual(len(payload["cases"]), sum(row["open_cases"] for row in rows.values()))
        self.assertEqual(sorted(c["days"] for c in payload["cases"]), [3, 12])

    def test_scheduling_cycle_is_reused(self):
        payload, _ = self.rows()
        title = next(r for r in payload["scheduling"]["rows"] if r["defense_type"] == "Title Defense")
        self.assertEqual((title["confirmed"], title["median_cycle_days"], title["longest_cycle_days"]), (2, 7.5, 10))

    def test_a_chosen_term_counts_the_cases_closed_in_it(self):
        _, rows = self.rows(term="T-Now")
        self.assertEqual(rows["enrollment"]["closed_cases"], 2)
        _, rows = self.rows(term="T-Old")
        self.assertEqual(rows["enrollment"]["closed_cases"], 0)

    def test_who_may_open_it(self):
        for role in ("staff", "academic_coordinator"):
            self.assertEqual(self.client(role).get("/api/reports/cycle-times").status_code, 200, role)
        self.assertEqual(self.client("student").get("/api/reports/cycle-times").status_code, 403)


if __name__ == "__main__":
    unittest.main()
