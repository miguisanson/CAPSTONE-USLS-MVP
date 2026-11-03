"""pkt/night4: the faculty Assigned Classes page lists only subjects whose roster the faculty member may open.

The roster endpoint (pkt/fable1, I-216) lets faculty read a course they teach or the rows of students they advise.
The portal context used to list every subject with a roster, so the page opened on a subject the server refuses (403).
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

from app import UserAccount, app, build_demo_database, course_audit_subject_items, db  # noqa: E402


class FacultyAssignedClassesTests(unittest.TestCase):
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

    def _faculty_clients(self):
        with app.app_context():
            accounts = [(a.id, a.email) for a in UserAccount.query.filter_by(role="faculty").all() if a.faculty_id]
        for account_id, email in accounts:
            client = app.test_client()
            with client.session_transaction() as session:
                session["account_id"] = account_id
                session["role"] = "faculty"
            yield email, client

    def test_every_listed_subject_opens_its_roster(self):
        checked = 0
        for email, client in self._faculty_clients():
            context = client.get("/api/faculty-portal/context")
            self.assertEqual(context.status_code, 200, email)
            for subject in context.get_json()["subjects"]:
                response = client.get(f"/api/course-audit/roster?course_id={subject['id']}")
                self.assertEqual(response.status_code, 200, f"{email}: {subject['code']} is listed but its roster is refused")
                checked += 1
        self.assertGreater(checked, 0, "no faculty member had any subject to check")

    def test_subjects_a_faculty_member_neither_teaches_nor_advises_are_not_listed(self):
        with app.app_context():
            every_subject = {item["id"] for item in course_audit_subject_items()}
        for email, client in self._faculty_clients():
            listed = {item["id"] for item in client.get("/api/faculty-portal/context").get_json()["subjects"]}
            refused = {cid for cid in every_subject - listed
                       if client.get(f"/api/course-audit/roster?course_id={cid}").status_code == 403}
            self.assertEqual(refused, every_subject - listed, f"{email}: a subject the server allows is missing from the list")
            self.assertLess(len(listed), len(every_subject), f"{email}: every subject is listed")


if __name__ == "__main__":
    unittest.main()
