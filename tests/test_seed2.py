"""pkt/seed2: I-383 (a practicum case waiting at Documents Under Review), the adviser date, the students-list counts."""
import os
import tempfile
import unittest
from datetime import timedelta

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="uploads-"))

from app import (  # noqa: E402
    AdviserAppointment, PracticumRecord, ScheduleRequest, Student, UserAccount, WORKFLOW_DEMO_STUDENTS,
    app, build_demo_database, db, ph_today, practicum_roster_payload,
)


class Seed2Tests(unittest.TestCase):
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

    def client(self, role):
        with app.app_context():
            account_id = UserAccount.query.filter_by(role=role).first().id
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    def test_a_practicum_case_waits_for_the_hours_check(self):
        with app.app_context():
            waiting = PracticumRecord.query.filter_by(status="Documents Under Review").all()
            self.assertEqual(len(waiting), 1)
            record = waiting[0]
            self.assertEqual(record.completed_hours, 200)  # what the student reported
            self.assertIsNone(record.verified_hours)
            self.assertIsNotNone(record.certificate_attachment_id)
            number = db.session.get(Student, record.student_id).student_number
            used = {item["student_number"] for item in WORKFLOW_DEMO_STUDENTS.values()}
            self.assertNotIn(number, used)  # no e2e spec writes to this student
            rows = [r for r in practicum_roster_payload() if r["student"]["student_number"] == number]
            self.assertEqual(rows[0]["record"]["status"], "Documents Under Review")

    def test_the_adviser_is_appointed_before_the_first_defense(self):
        with app.app_context():
            checked = 0
            for student in Student.query.all():
                dates = [d for (d,) in db.session.query(ScheduleRequest.preferred_date).filter_by(student_id=student.id).all() if d]
                if not dates:
                    continue
                first = min(dates)
                if first <= ph_today() - timedelta(weeks=12):
                    continue  # older than the seed window: the seed keeps every appointment inside it (test_seed_quality)
                for item in AdviserAppointment.query.filter_by(student_id=student.id, source="Migrated from the existing adviser record").all():
                    checked += 1
                    self.assertLessEqual(item.applied_at.date(), first, student.student_number)
                    if item.adviser_responded_at:
                        self.assertLessEqual(item.adviser_responded_at.date(), first, student.student_number)
            self.assertGreater(checked, 0)

    def test_the_students_list_counts_current_and_missing_subjects(self):
        payload = self.client("staff").get("/api/students?page_size=100").get_json()
        for item in payload["items"]:
            compre = item["compre_eligibility"]
            self.assertIn("current_count", compre)
            self.assertIn("missing_count", compre)


if __name__ == "__main__":
    unittest.main()
