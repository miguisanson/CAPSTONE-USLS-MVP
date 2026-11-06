"""pkt/f8 (Fable review 4): F8-02 Course Audit missing subjects from the real audit, F8-05 no-record wording,
F8-08 next_step only for the panel / schedule steps, I-417 the AWOL student is told in the bell and the Activity Log."""
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
    Notification, Program, Student, UserAccount, app, build_demo_database, compute_course_audit, db,
    graduation_missing_text, research_gate_overview_row,
)


class F8Tests(unittest.TestCase):
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

    def client_for(self, email):
        with app.app_context():
            account = UserAccount.query.filter_by(email=email).one()
            account_id, role = account.id, account.role
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    def staff_client(self):
        with app.app_context():
            email = UserAccount.query.filter_by(role="staff", active=True).first().email
        return self.client_for(email)

    # ---- F8-02
    def test_missing_subjects_equal_the_student_record_audit(self):
        client = self.staff_client()
        with app.app_context():
            program_ids = [p.id for p in Program.query.order_by(Program.code).all()]
        checked, programs_seen = 0, set()
        for program_id in program_ids:
            body = client.get(f"/api/course-audit/missing?program_id={program_id}").get_json()
            self.assertTrue(body["programs"])
            for row in body["items"][:2]:
                with app.app_context():
                    audit = compute_course_audit(db.session.get(Student, row["id"]))
                self.assertEqual(audit["missing_count"], row["missing_count"], row["name"])
                self.assertGreater(row["missing_count"], 0)
                self.assertEqual(
                    [r["course"].code for r in audit["missing"] + audit["incomplete"]][:2], row["next_codes"], row["name"],
                )
                checked += 1
                programs_seen.add(program_id)
        self.assertGreaterEqual(checked, 3)
        self.assertGreaterEqual(len(programs_seen), 2)

    def test_missing_subjects_is_read_only_and_for_staff_roles(self):
        self.assertEqual(405, self.staff_client().post("/api/course-audit/missing", json={}).status_code)
        self.assertEqual(200, self.client_for("academic@usls.edu.ph").get("/api/course-audit/missing").status_code)
        self.assertEqual(403, self.client_for("student@usls.edu.ph").get("/api/course-audit/missing").status_code)

    # ---- F8-05
    def test_no_record_items_keep_their_no_record_note(self):
        self.assertEqual(
            "Title Defense not passed yet (no research record on file)",
            graduation_missing_text({"key": "research_title", "label": "Title Defense workflow", "passed": None}),
        )
        self.assertEqual(
            "Practicum not completed yet (no practicum record on file)",
            graduation_missing_text({"key": "practicum", "label": "Practicum", "passed": None}),
        )
        self.assertEqual(
            "Practicum not completed yet", graduation_missing_text({"key": "practicum", "label": "Practicum", "passed": False}),
        )

    # ---- F8-08
    def test_submitted_document_waiting_for_review_is_not_listed_as_waiting_for_a_panel(self):
        progress = {
            "gate": appmod.RESEARCH_GATE_PROPOSAL, "stage": "Proposal Defense",
            "milestone": {"overall_complete": False, "requirements": [
                {"label": "Form 4", "source_type": "student_upload", "student_upload": True, "status": "Submitted", "status_label": "Submitted"},
                {"label": "Panel", "source_type": "system_panel", "student_upload": False, "status": "Pending", "status_label": "Pending"},
            ]},
        }
        with app.app_context():
            student = Student.query.first()
            with mock.patch.object(appmod, "detected_research_progress", return_value=progress):
                row = research_gate_overview_row(student, None)
        self.assertIn("waiting for review", row["reason"])
        self.assertIsNone(row["next_step"])

    # ---- I-417
    def test_awol_student_is_told_in_the_bell_and_the_activity_log(self):
        client = self.client_for("awol.maya@usls.edu.ph")
        with app.app_context():
            account = UserAccount.query.filter_by(email="awol.maya@usls.edu.ph").one()
            notes = Notification.query.filter_by(account_id=account.id).all()
        self.assertTrue([n for n in notes if "absent without leave" in (n.body or "")], [n.title for n in notes])
        logs = client.get("/api/student-portal/context").get_json()["logs"]
        self.assertTrue([l for l in logs if "absent" in l["result"].lower()], [l["result"] for l in logs])


if __name__ == "__main__":
    unittest.main()
