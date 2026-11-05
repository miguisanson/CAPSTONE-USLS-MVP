"""pkt/night11 review item 3: right after the Dean approves a graduation endorsement the student is Completed.

One seeded temporary database for the module (Hector Ong: Final Defense, endorsement Ready for Dean Review).
"""
import os
import tempfile
import unittest

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="uploads-"))

from app import GraduationEndorsement, Student, UserAccount, app, build_demo_database, db  # noqa: E402


class DeanApprovalCompletesTheStudentTests(unittest.TestCase):
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

    def setUp(self):
        with app.app_context():
            student = Student.query.filter_by(student_number="2360008").one()
            endorsement = GraduationEndorsement.query.filter_by(student_id=student.id).one()
            self.assertEqual((student.current_stage, endorsement.endorsement_status), ("Final Defense", "Ready for Dean Review"))
            self.student_id, self.endorsement_id = student.id, endorsement.id
            account_id = UserAccount.query.filter_by(role="dean").first().id
        self.dean = app.test_client()
        with self.dean.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = "dean"

    def tearDown(self):
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            endorsement = db.session.get(GraduationEndorsement, self.endorsement_id)
            student.current_stage = "Final Defense"
            endorsement.endorsement_status = "Ready for Dean Review"
            db.session.commit()

    def stage(self):
        with app.app_context():
            db.session.expire_all()
            return db.session.get(Student, self.student_id).current_stage

    def test_approving_in_the_approvals_inbox_completes_the_student_at_once(self):
        response = self.dean.post(f"/api/approvals/workflow/graduation/{self.endorsement_id}/decide", json={"decision": "approve"})
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(self.stage(), "Completed")

    def test_approving_in_the_graduation_batch_completes_the_student_at_once(self):
        response = self.dean.post("/api/graduation/batch-actions", json={"student_ids": [self.student_id], "action": "approve"})
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(len(response.get_json()["updated"]), 1, response.get_json())
        self.assertEqual(self.stage(), "Completed")

    def test_returning_the_endorsement_leaves_the_student_in_final_defense(self):
        response = self.dean.post(f"/api/approvals/workflow/graduation/{self.endorsement_id}/decide", json={"decision": "return", "note": "Fix the list"})
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(self.stage(), "Final Defense")


if __name__ == "__main__":
    unittest.main()
