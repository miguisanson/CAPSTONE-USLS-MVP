"""pkt/alumni: F8-04 past graduates carry the seeded graduation history, I-421 a defense without a matched panel waits
for Panel Matching, the Registrar daily list has changes dated today."""
import os
import tempfile
import unittest
from unittest import mock

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="uploads-"))

import app as appmod  # noqa: E402
from app import (  # noqa: E402
    GraduationEndorsement, PanelAssignment, ResearchCase, Student, TransactionLog, UserAccount, active_student_clause, app,
    build_demo_database, db, detected_research_progress, ph_today, research_gate_overview_row, panel_roles_for_student,
    DEMO_STUDENT_NUMBERS,
)


class AlumniTests(unittest.TestCase):
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

    # ---- F8-04
    def test_two_earlier_terms_each_have_a_decided_graduation(self):
        with app.app_context():
            decided = [g for g in GraduationEndorsement.query.all() if g.dean_decision_at]
            self.assertGreaterEqual(len({g.review_window for g in decided}), 2)

    def test_every_registrar_received_endorsement_is_on_a_completed_student(self):
        with app.app_context():
            rows = GraduationEndorsement.query.filter(
                GraduationEndorsement.endorsement_status == "Registrar Received").all()
            rows += GraduationEndorsement.query.filter(GraduationEndorsement.registrar_status == "Acknowledged").all()
            self.assertGreaterEqual(len(rows), 4)
            for row in rows:
                self.assertEqual(row.student.current_stage, "Completed", row.student.name)

    def test_graduation_demo_accounts_have_no_history(self):
        with app.app_context():
            for key in ("GRAD-01", "GRAD-02"):
                student = Student.query.filter_by(student_number=DEMO_STUDENT_NUMBERS[key]).one()
                self.assertEqual(student.graduation_endorsements, [], student.name)

    def test_past_graduates_are_not_active(self):
        with app.app_context():
            completed = Student.query.filter_by(current_stage="Completed").count()
            self.assertGreaterEqual(completed, 8)
            self.assertEqual(Student.query.filter(active_student_clause(), Student.current_stage == "Completed").count(), 0)
            self.assertEqual(
                Student.query.filter(active_student_clause()).count(),
                Student.query.filter(Student.standing == "Active", Student.current_stage != "Completed").count())

    # ---- I-421
    def test_a_defense_without_a_matched_panel_waits_for_panel_matching(self):
        with app.app_context():
            checked = 0
            for case in ResearchCase.query.all():
                student = case.student
                if student.current_stage == "Completed":
                    continue
                row = research_gate_overview_row(student, case)
                if not row or row["next_step"] != "panel":
                    continue
                checked += 1
                self.assertIn("panel has not been matched", row["reason"])
                self.assertNotEqual(row["status"], "Ready to Schedule")
            ana = Student.query.filter_by(student_number="2260043").one()
            row = research_gate_overview_row(ana, ResearchCase.query.filter_by(student_id=ana.id).first())
            self.assertEqual((row["state"], row["next_step"]), ("ready", "panel"), row)
            self.assertIn("panel has not been matched", row["reason"])
            self.assertNotEqual(detected_research_progress(ana, ensure_checks=False)["status"], "Ready to Schedule")
            self.assertGreaterEqual(checked, 1)

    def test_no_row_says_schedule_while_its_panel_is_short(self):
        with app.app_context():
            for case in ResearchCase.query.all():
                row = research_gate_overview_row(case.student, case)
                if row and row["next_step"] == "schedule":
                    self.assertGreaterEqual(
                        PanelAssignment.query.filter_by(student_id=case.student_id, gate=row["gate"]).count(),
                        len(panel_roles_for_student(case.student, row["gate"])), case.student.name)

    # ---- Registrar daily list
    def test_the_registrar_daily_list_has_changes_dated_today(self):
        slugs = ("enrollment", "withdrawal", "course-adjustments", "leave-of-absence", "readmission", "awol", "graduation")
        with app.app_context():
            today = TransactionLog.query.filter(
                db.func.date(TransactionLog.created_at) == ph_today().isoformat(),
                TransactionLog.transaction_slug.in_(slugs)).count()
        self.assertGreaterEqual(today, 2)


if __name__ == "__main__":
    unittest.main()
