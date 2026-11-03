"""pkt/night5: the Academic Coordinator reads Academic Semesters (read-only); Enrollment subject list (item 4).

Item 3: the coordinator could not see the semester dates anywhere. She may now read the list; every edit stays with
Graduate School Staff (and Admin).
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

from app import AcademicTerm, UserAccount, app, build_demo_database, db  # noqa: E402


class Night5Base(unittest.TestCase):
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


class AcademicSemestersReadOnlyTests(Night5Base):
    def test_academic_coordinator_can_read_the_semesters_but_not_edit_them(self):
        coordinator = self.client_for("academic@usls.edu.ph")
        listing = coordinator.get("/api/admin/terms")
        self.assertEqual(listing.status_code, 200, listing.get_json())
        body = listing.get_json()
        self.assertTrue(body["items"], "the semester list is empty")
        self.assertFalse(body["permissions"]["can_manage"], "the coordinator must be told the page is read-only")
        with app.app_context():
            term_id = AcademicTerm.query.first().id
        edits = [
            ("post", "/api/admin/terms", {"label": "AY 2099-2100 1st Semester"}),
            ("post", "/api/admin/terms/add-next", {}),
            ("patch", f"/api/admin/terms/{term_id}", {"start_date": "2030-08-01"}),
            ("patch", f"/api/admin/terms/{term_id}/set-active", {}),
            ("delete", f"/api/admin/terms/{term_id}", {"confirmed_label": "x"}),
        ]
        for method, path, payload in edits:
            response = getattr(coordinator, method)(path, json=payload)
            self.assertEqual(response.status_code, 403, f"{method.upper()} {path} must stay refused for the coordinator")

    def test_staff_still_manage_the_semesters(self):
        staff = self.client_for("staff@usls.edu.ph")
        body = staff.get("/api/admin/terms").get_json()
        self.assertTrue(body["permissions"]["can_manage"])

    def test_other_roles_still_cannot_read_the_semesters(self):
        for email in ("dean@usls.edu.ph", "student@usls.edu.ph"):
            self.assertEqual(self.client_for(email).get("/api/admin/terms").status_code, 403, email)


if __name__ == "__main__":
    unittest.main()
