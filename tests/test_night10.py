"""pkt/night10: stakeholder-demo findings I-237 (graduation candidates) and I-239b (dashboard vs Reports counts).

One seeded temporary database is built for the module.
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

from app import (  # noqa: E402
    GRADUATION_CANDIDATE_STAGES, GraduationEndorsement, Student, UserAccount, app, build_demo_database, db,
)


class Night10Tests(unittest.TestCase):
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

    # ------------------------------------------------------------------ I-237
    def test_only_students_who_reached_the_writing_stage_have_a_graduation_endorsement(self):
        allowed = set(GRADUATION_CANDIDATE_STAGES) | {"Completed"}
        with app.app_context():
            bad = [
                f"{item.student.name} ({item.student.current_stage}): {item.endorsement_status}"
                for item in GraduationEndorsement.query.all()
                if item.student.current_stage not in allowed
            ]
        self.assertEqual([], bad)

    def test_graduation_candidates_report_lists_no_coursework_student(self):
        rows = self._client("staff").get("/api/reports/graduation").get_json()["rows"]
        self.assertTrue(rows)
        self.assertEqual([], [f"{r['student']} ({r['stage']})" for r in rows if r["stage"] in ("Admission", "Coursework")])

    def test_what_is_missing_names_the_gap_instead_of_to_verify(self):
        rows = self._client("staff").get("/api/reports/graduation").get_json()["rows"]
        self.assertEqual([], [r["student"] for r in rows if "(to verify)" in r["missing"]])
        practicum = next(r for r in rows if r["student"] == "Andrea Villanueva")
        self.assertIn("Practicum completed (no practicum record on file)", practicum["missing"])


if __name__ == "__main__":
    unittest.main()
