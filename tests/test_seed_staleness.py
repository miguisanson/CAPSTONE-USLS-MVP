"""A seed-inputs fingerprint is stamped at seed time; a mismatch is a warning, never a refusal (IM2)."""
import os
import tempfile
import unittest

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))

import app as app_module  # noqa: E402

STALE_WARNING = "Your demo data is out of date. Run npm run seed (this resets the demo data)."


class SeedStalenessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ctx = app_module.app.app_context()
        cls.ctx.push()
        app_module.build_demo_database()

    @classmethod
    def tearDownClass(cls):
        cls.ctx.pop()

    def test_fingerprint_stable_and_ignores_line_endings(self):
        first = app_module.seed_inputs_fingerprint()
        self.assertEqual(first, app_module.seed_inputs_fingerprint())
        self.assertEqual(app_module._normalize_seed_bytes(b"a\r\nb\n"), app_module._normalize_seed_bytes(b"a\nb\n"))

    def test_seeded_database_is_not_stale(self):
        self.assertFalse(app_module.demo_data_stale())
        self.assertFalse(app_module.app.test_client().get("/api/auth/config").get_json()["demo_data_stale"])

    def test_tampered_or_missing_stamp_is_stale(self):
        stamp = app_module.read_seed_stamp()
        try:
            for value in (stamp + 1, 0):
                app_module.write_seed_stamp(value)
                self.assertTrue(app_module.demo_data_stale())
                self.assertEqual(app_module.demo_data_stale_warning(), STALE_WARNING)
                self.assertTrue(app_module.app.test_client().get("/api/auth/config").get_json()["demo_data_stale"])
        finally:
            app_module.write_seed_stamp(stamp)
        self.assertFalse(app_module.demo_data_stale())


if __name__ == "__main__":
    unittest.main()
