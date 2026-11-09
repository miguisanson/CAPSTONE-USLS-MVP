"""UAT E8: staff / Research Coordinator can answer a panel invitation and enter weekly hours for a panelist."""

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
    Faculty, FacultyWorkingHour, PanelAssignment, PanelInvitation, Student, TransactionLog, UserAccount,
    app, build_demo_database, db,
)

GATE = "Proposal Defense"


class StaffForPanelistTests(unittest.TestCase):
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

    def client_for(self, role):
        with app.app_context():
            account = UserAccount.query.filter_by(role=role).first()
            account_id = account.id
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"], session["role"] = account_id, role
        return client

    def make_invitation(self):
        with app.app_context():
            student, faculty = Student.query.first(), Faculty.query.first()
            PanelInvitation.query.filter_by(student_id=student.id, faculty_id=faculty.id, gate=GATE).delete()
            PanelAssignment.query.filter_by(student_id=student.id, faculty_id=faculty.id, gate=GATE).delete()
            db.session.add(PanelAssignment(student_id=student.id, faculty_id=faculty.id, gate=GATE, panel_role="Panel Member"))
            row = PanelInvitation(student_id=student.id, faculty_id=faculty.id, gate=GATE, panel_role="Panel Member", status="Invited")
            db.session.add(row)
            db.session.commit()
            return row.id, faculty.id

    def test_staff_accepts_for_panelist(self):
        invitation_id, _ = self.make_invitation()
        response = self.client_for("staff").post(
            f"/api/panel-invitations/{invitation_id}/respond-for-panelist",
            json={"response": "accept", "reason": "Panelist said yes by phone"})
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
        with app.app_context():
            row = db.session.get(PanelInvitation, invitation_id)
            self.assertEqual(row.status, "Accepted")
            actors = [log.actor_role for log in TransactionLog.query.filter_by(student_id=row.student_id).all()]
            self.assertTrue(any("(for the panel)" in actor for actor in actors))

    def test_reason_required(self):
        invitation_id, _ = self.make_invitation()
        response = self.client_for("staff").post(
            f"/api/panel-invitations/{invitation_id}/respond-for-panelist", json={"response": "accept"})
        self.assertEqual(response.status_code, 400)
        with app.app_context():
            self.assertEqual(db.session.get(PanelInvitation, invitation_id).status, "Invited")

    def test_student_forbidden(self):
        invitation_id, faculty_id = self.make_invitation()
        client = self.client_for("student")
        self.assertEqual(client.post(
            f"/api/panel-invitations/{invitation_id}/respond-for-panelist",
            json={"response": "accept", "reason": "no right"}).status_code, 403)
        self.assertEqual(client.put(
            f"/api/faculty/{faculty_id}/availability/working-hours", json={"hours": []}).status_code, 403)

    def test_staff_saves_hours_for_panelist(self):
        _, faculty_id = self.make_invitation()
        hours = [{"weekday": 1, "enabled": True, "start": "09:00", "end": "12:00"}]
        response = self.client_for("research_coordinator").put(
            f"/api/faculty/{faculty_id}/availability/working-hours", json={"hours": hours, "reason": "Sent by email"})
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
        with app.app_context():
            rows = FacultyWorkingHour.query.filter_by(faculty_id=faculty_id).all()
            self.assertEqual([(r.weekday, r.source) for r in rows], [(1, "staff")])
            self.assertIsNotNone(db.session.get(Faculty, faculty_id).availability_updated_at)


if __name__ == "__main__":
    unittest.main()
