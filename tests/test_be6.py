"""pkt/be6: I-183 (seed shows no inconsistencies), I-195 (Manila "today"), I-193 (one active count), I-197 (deliberate history).

One seeded temporary database is built for the module; tests that change data roll back.
"""
import os
import tempfile
import unittest
from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="uploads-"))

import app as app_module  # noqa: E402
from app import (  # noqa: E402
    SubjectEnrollment,
    TermEnrollment,
    UserAccount,
    app,
    build_demo_database,
    db,
    enrollment_integrity_payload,
)


class Be6Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        with app.app_context():
            build_demo_database()

    @classmethod
    def tearDownClass(cls):
        try:
            with app.app_context():
                db.session.remove()
                db.engine.dispose()
            os.unlink(_DB_FILE.name)
        except (FileNotFoundError, PermissionError):
            pass

    def _client(self, role):
        with app.app_context():
            account = UserAccount.query.filter_by(role=role).first()
            account_id = account.id
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    # ------------------------------------------------------------------ I-183
    def test_fresh_seed_has_no_enrollment_inconsistencies(self):
        with app.app_context():
            payload = enrollment_integrity_payload()
            self.assertEqual(payload["issue_count"], 0, payload["issues"])

    def test_a_real_inconsistency_is_still_detected(self):
        with app.app_context():
            item = SubjectEnrollment.query.filter(SubjectEnrollment.status == "Enrolled").first()
            row = TermEnrollment.query.filter_by(student_id=item.student_id, term_id=item.term_id).first()
            self.assertIsNotNone(row)
            row.status = "Dropped"
            db.session.flush()
            try:
                types = {issue["type"] for issue in enrollment_integrity_payload()["issues"]}
                self.assertIn("Semester enrollment missing", types)
            finally:
                db.session.rollback()
    # ------------------------------------------------------------------ I-195
    # 2026-11-02 16:30 UTC is already 00:30 on 3 November in Manila; 15:00 UTC is 23:00 on 2 November.
    @staticmethod
    def _frozen(hour, minute):
        return patch.object(app_module, "_clock_utc", lambda: datetime(2026, 11, 2, hour, minute, tzinfo=timezone.utc))

    def test_ph_today_is_the_manila_date(self):
        with self._frozen(16, 30):
            self.assertEqual(app_module.ph_today(), date(2026, 11, 3))
            self.assertEqual(app_module.now_utc(), datetime(2026, 11, 3, 0, 30))
        with self._frozen(15, 0):
            self.assertEqual(app_module.ph_today(), date(2026, 11, 2))

    def test_a_task_due_on_the_manila_day_is_not_overdue_until_the_next_manila_day(self):
        def overdue_kpi():
            return app_module.dashboard_stats()["kpis"]["overdue_tasks"]

        with app.app_context():
            student = app_module.Student.query.first()
            for hour, minute, extra in ((15, 0, 0), (16, 30, 1)):
                with self._frozen(hour, minute):
                    before = overdue_kpi()
                    db.session.add(app_module.Task(
                        student_id=student.id, title="Due 2 Nov", owner_role="GS Staff",
                        due_at=date(2026, 11, 2), status="Pending",
                    ))
                    db.session.flush()
                    try:
                        self.assertEqual(overdue_kpi() - before, extra, f"{hour}:{minute} UTC")
                        indicators = app_module.student_indicators(student)
                        self.assertGreaterEqual(indicators["overdue_tasks"], extra)
                    finally:
                        db.session.rollback()

    # ------------------------------------------------------------------ I-193
    def test_dashboard_and_reports_count_the_same_active_students(self):
        with app.app_context():
            dashboard = app_module.dashboard_stats()["kpis"]["active_students"]
            tile = next(t for t in app_module.report_summary({})["tiles"] if t["key"] == "active")
            everyone = sum(1 for s in app_module.Student.query.all() if app_module.student_is_active(s))
            self.assertEqual(dashboard, tile["value"])
            self.assertEqual(dashboard, everyone)

    def test_dashboard_active_count_leaves_out_a_completed_student(self):
        with app.app_context():
            before = app_module.dashboard_stats()["kpis"]["active_students"]
            student = next(s for s in app_module.Student.query.all() if app_module.student_is_active(s))
            student.current_stage = "Completed"  # standing stays "Active"
            db.session.flush()
            try:
                self.assertEqual(app_module.dashboard_stats()["kpis"]["active_students"], before - 1)
            finally:
                db.session.rollback()

    def test_the_waiting_tile_says_it_counts_all_offices(self):
        with app.app_context():
            tile = next(t for t in app_module.report_summary({})["tiles"] if t["key"] == "waiting")
            self.assertEqual(tile["scope"], "all offices")

    def test_dean_reads_the_stage_reports_and_a_student_does_not(self):
        for path in ("/api/reports/stages", "/api/reports/attention"):
            self.assertEqual(self._client("dean").get(path).status_code, 200, path)
            self.assertEqual(self._client("student").get(path).status_code, 403, path)

    # ------------------------------------------------------------------ I-197
    def _earlier_terms(self):
        active = app_module.get_active_term()
        recent = app_module.term_before(active)
        return recent, app_module.term_before(recent)

    def test_earlier_terms_have_held_defenses_with_verdicts(self):
        with app.app_context():
            for term in self._earlier_terms():
                rows = app_module.report_defenses({"when": "Held", "term": term.label})["rows"]
                self.assertGreaterEqual(len(rows), 2, term.label)
                self.assertTrue(all(r["verdict"] != app_module.NO_VERDICT_YET for r in rows), term.label)
            tile = next(t for t in app_module.report_summary({})["tiles"] if t["key"] == "defenses")
            self.assertEqual(tile["comparison"]["kind"], "previous_term")
            self.assertGreater(tile["comparison"]["previous"], 0)

    def test_earlier_terms_have_closed_cases_for_cycle_times(self):
        with app.app_context():
            for term in self._earlier_terms():
                rows = app_module.report_cycle_times({"term": term.label})["rows"]
                self.assertGreaterEqual(sum(r["closed_cases"] for r in rows), 4, term.label)
                self.assertTrue(any(r["median_cycle_days"] is not None for r in rows), term.label)

    def test_activity_older_than_twelve_weeks_is_tagged_seeded_history(self):
        with app.app_context():
            cutoff = datetime.combine(app_module.ph_today() - timedelta(weeks=12, days=1), datetime.min.time())
            old = app_module.TransactionLog.query.filter(app_module.TransactionLog.created_at < cutoff).all()
            self.assertTrue(old)
            self.assertEqual({row.source_reference for row in old}, {app_module.SEEDED_HISTORY_SOURCE})

    def test_history_defenses_sit_on_students_with_no_other_story(self):
        with app.app_context():
            requests = app_module.ScheduleRequest.query.filter(app_module.ScheduleRequest.notes.like("Seeded history%")).all()
            self.assertGreaterEqual(len(requests), 4)
            for req in requests:
                student = db.session.get(app_module.Student, req.student_id)
                self.assertIn(student.current_stage, ("Coursework", "Admission"))
                self.assertIsNone(app_module.ResearchCase.query.filter_by(student_id=student.id).first())

    # ------------------------------------------------------------------ board statuses (e2e triage P1)
    def test_every_case_on_every_staff_board_sits_in_one_of_its_columns(self):
        """The board says "Showing N of N" from the list but draws only the cards a column maps (the same mapping the API counts with)."""
        client = self._client("staff")
        for slug in ("leave-of-absence", "readmission", "awol", "withdrawal"):
            data = client.get(f"/api/process-cases?slug={slug}").get_json()
            self.assertGreater(len(data["cases"]), 0, slug)
            unmapped = sorted({c["status"] for c in data["cases"]} - {
                status for column in data["vocabulary"]["columns"][slug] for status in column["statuses"]
            })
            self.assertEqual(unmapped, [], f"{slug}: statuses no column shows")
            self.assertEqual(data["counts"].get("other", 0), 0, slug)
            self.assertEqual(sum(data["counts"].values()), len(data["cases"]), slug)


if __name__ == "__main__":
    unittest.main()
