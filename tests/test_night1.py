"""pkt/night1: old walkthrough findings I-007 (demo reset clears panel-invitation answers) and I-011 (handoff report batches).

One seeded temporary database is built for the module.
"""
import os
import tempfile
import unittest
from io import BytesIO
from unittest.mock import patch

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="uploads-"))

from app import Faculty, OnboardingReview, PanelInvitation, Student, UserAccount, app, build_demo_database, db  # noqa: E402


class Night1Tests(unittest.TestCase):
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
            account_id = UserAccount.query.filter_by(role=role).first().id
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    # ------------------------------------------------------------------ I-007
    def test_demo_reset_clears_the_students_panel_invitation_answers_and_only_theirs(self):
        with app.app_context():
            miguel = Student.query.filter_by(student_number="2260004").one()
            other = Student.query.filter(Student.id != miguel.id).first()
            faculty = Faculty.query.first()
            miguel_id, other_id = miguel.id, other.id
            db.session.add(PanelInvitation(student_id=miguel_id, faculty_id=faculty.id, gate="Form 1 - Title Defense", status="Accepted"))
            db.session.add(PanelInvitation(student_id=other_id, faculty_id=faculty.id, gate="Form 1 - Title Defense", status="Declined", reason="busy"))
            db.session.commit()
            other_before = PanelInvitation.query.filter_by(student_id=other_id).count()
        response = self._client("staff").post("/api/auth/demo-students/research-miguel/reset", json={})
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            self.assertEqual(
                PanelInvitation.query.filter(
                    PanelInvitation.student_id == miguel_id, PanelInvitation.status.in_(("Accepted", "Declined"))
                ).count(),
                0,
                "the reset student keeps no invitation answers",
            )
            self.assertEqual(PanelInvitation.query.filter_by(student_id=other_id).count(), other_before)

    # ------------------------------------------------------------------ I-011
    def test_a_monitoring_import_shows_in_the_onboarding_reviews_the_panel_reads(self):
        parsed = {
            "program_code": "MAED",
            "subjects": [],
            "subject_categories": {},
            "subject_titles": {},
            "issues": [],
            "rows": [{
                "row": 5, "idno": "GS-N1-001", "first_name": "Nora", "last_name": "Night", "course": "MAED",
                "year": "1", "ay_entry": "26-27", "subjects": {}, "milestones": {},
                "comprehensive_exam_passed": False, "note": "",
            }],
        }
        staff = self._client("staff")
        with app.app_context():
            before = len(staff.get("/api/onboarding/reviews").get_json()["items"])
        with patch("app.parse_ac_monitoring", return_value=parsed):
            response = staff.post(
                "/api/transactions/student-handoff/import",
                data={"file": (BytesIO(b"x"), "night1-sheet.xlsx")},
                content_type="multipart/form-data",
            )
        self.assertEqual(response.status_code, 200, response.get_json())
        items = staff.get("/api/onboarding/reviews").get_json()["items"]
        self.assertEqual(len(items), before + 1)
        self.assertEqual(items[0]["source_file"], "night1-sheet.xlsx")
        self.assertEqual(items[0]["student_count"], 1)


if __name__ == "__main__":
    unittest.main()
