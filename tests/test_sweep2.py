"""pkt/sweep2: persona sweep 2 findings I-201 (faculty directory for the Research Coordinator), I-203/I-204 (student's own next step and standing).

One seeded temporary database is built for the module; tests only read.
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

from app import Faculty, UserAccount, app, build_demo_database, db  # noqa: E402


class Sweep2Tests(unittest.TestCase):
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

    def _client(self, role, email=None):
        with app.app_context():
            query = UserAccount.query.filter_by(role=role)
            account = query.filter_by(email=email).first() if email else query.first()
            account_id = account.id
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    # ------------------------------------------------------------------ I-201
    def test_research_coordinator_reads_the_faculty_directory_but_cannot_change_it(self):
        client = self._client("research_coordinator")
        directory = client.get("/api/faculty")
        self.assertEqual(directory.status_code, 200, directory.get_json())
        items = directory.get_json()["items"]
        self.assertTrue(items)
        detail = client.get(f"/api/faculty/{items[0]['id']}")
        self.assertEqual(detail.status_code, 200, detail.get_json())
        with app.app_context():
            faculty_id = Faculty.query.first().id
        self.assertEqual(client.patch(f"/api/faculty/{faculty_id}", json={"specialization": "x"}).status_code, 403)
        self.assertEqual(client.post("/api/faculty", json={"full_name": "x"}).status_code, 403)
        self.assertEqual(client.post(f"/api/faculty/{faculty_id}/cv-rag", json={"question": "What experience?"}).status_code, 403)


if __name__ == "__main__":
    unittest.main()
