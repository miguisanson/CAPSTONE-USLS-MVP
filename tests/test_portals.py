"""Portal deep links (student / dean / faculty).

The student, dean and faculty portals are real routes now (``/student/progress``,
``/dean/case/withdrawal/3`` ...). A browser refresh on any of them must still
land on the single-page app, and the old entry URLs must keep working. The UI
itself has no test runner yet; these tests cover the server side of that promise.
"""
import os
import tempfile
import unittest

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"

from app import app, db  # noqa: E402

PORTAL_DEEP_LINKS = [
    "/student",
    "/student/progress",
    "/student/requests/leave-of-absence",
    "/student/requests/withdrawal",
    "/student/practicum",
    "/dean",
    "/dean/approvals/withdrawal",
    "/dean/approvals/graduation?tab=batches",
    "/dean/case/withdrawal/3",
    "/approvals",  # old Dean URL, redirected inside the SPA
    "/faculty-portal",
    "/faculty-portal/verdicts",
    "/faculty-portal?calendar=connected",  # Google Calendar OAuth return address
]


class PortalDeepLinkTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        with app.app_context():
            db.create_all()

    @classmethod
    def tearDownClass(cls):
        try:
            with app.app_context():
                db.session.remove()
                db.engine.dispose()
            os.unlink(_DB_FILE.name)
        except (FileNotFoundError, PermissionError):
            pass

    def test_portal_deep_links_serve_the_single_page_app(self):
        client = app.test_client()
        bodies = set()
        for path in PORTAL_DEEP_LINKS:
            response = client.get(path)
            self.assertEqual(response.status_code, 200, path)
            bodies.add(response.get_data())
            response.close()
        # Every deep link returns the same shell document, never a per-path 404 page.
        self.assertEqual(len(bodies), 1)

    def test_api_routes_are_not_swallowed_by_the_spa_fallback(self):
        response = app.test_client().get("/api/student-portal/context")
        self.assertEqual(response.status_code, 401)
        self.assertIn("error", response.get_json())


if __name__ == "__main__":
    unittest.main()
