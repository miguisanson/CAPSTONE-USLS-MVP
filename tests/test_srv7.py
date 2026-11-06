"""pkt/srv7: I-412 research status before a defense date is requested, I-413 named graduation gaps, I-414 adviser dates and change rule."""
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

from app import (  # noqa: E402
    AdviserAppointment, ScheduleRequest, Student, UserAccount, adviser_tracker_payload, app, build_demo_database, db,
    graduation_eligibility,
)


class Srv7Tests(unittest.TestCase):
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

    def student_client(self):
        with app.app_context():
            account_id = UserAccount.query.filter_by(email="student@usls.edu.ph").one().id
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = "student"
        return client

    def test_status_is_ready_to_schedule_until_the_student_asks(self):
        client = self.student_client()
        context = client.get("/api/student-portal/context").get_json()
        self.assertEqual("Ready to Schedule", context["research_progress"]["status"])
        self.assertEqual(context["research_progress"]["status"], context["research_progress"]["milestone"].get("status", "Ready to Schedule"))
        response = client.post("/api/student-portal/requests/defense-scheduling", json={})
        self.assertEqual(200, response.status_code, response.get_json())
        after = client.get("/api/student-portal/context").get_json()
        self.assertNotEqual("Ready to Schedule", after["research_progress"]["status"])
        self.assertEqual("Pending Staff Action", after["research_progress"]["status"])

    def test_graduation_next_action_names_what_is_missing(self):
        with app.app_context():
            student = UserAccount.query.filter_by(email="student@usls.edu.ph").one().student
            action = graduation_eligibility(student)["next_action"]
        self.assertNotIn("Resolve graduation missing research requirements", action)
        self.assertIn("Final Defense", action)

    def test_no_adviser_appointment_is_after_the_first_defense(self):
        with app.app_context():
            late = []
            for student in Student.query.all():
                days = [r.preferred_date for r in ScheduleRequest.query.filter_by(student_id=student.id).all() if r.preferred_date]
                if not days:
                    continue
                for row in AdviserAppointment.query.filter_by(student_id=student.id, ended_at=None).all():
                    when = row.form31_issued_on or (row.adviser_responded_at.date() if row.adviser_responded_at else None)
                    if when and when > min(days):
                        late.append((student.name, when, min(days)))
            self.assertEqual([], late)

    def test_change_rule_after_the_proposal_defense_says_it_is_closed(self):
        with app.app_context():
            from app import student_past_proposal_defense
            past = [s for s in Student.query.all() if student_past_proposal_defense(s)]
            self.assertTrue(past)
            for student in past:
                reason = adviser_tracker_payload(student)["change_blocked_reason"]
                self.assertNotIn("must be done before", reason or "")
            text = [adviser_tracker_payload(s)["change_blocked_reason"] or "" for s in past]
            self.assertTrue(any("no longer possible" in t for t in text))


if __name__ == "__main__":
    unittest.main()
