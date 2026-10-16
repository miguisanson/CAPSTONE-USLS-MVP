"""SQLite only, schema built from the models (owner decisions IM3, IM4).

The app is a demo that never holds real data: there is no MySQL path, no startup
ALTER TABLE patching, and a database whose tables do not match the models is not
patched - the app refuses to start and tells the developer to reseed.
"""

import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class SqliteOnlyTests(unittest.TestCase):
    def test_no_mysql_anywhere_in_the_code_or_dependencies(self):
        for name in ("app.py", "requirements.txt", "README.md", "package.json"):
            text = (ROOT / name).read_text(encoding="utf-8").lower()
            count = text.count("mysql")
            self.assertEqual(0, count, f"{name} still mentions MySQL {count} time(s)")

    def test_no_schema_patching_at_startup(self):
        text = (ROOT / "app.py").read_text(encoding="utf-8")
        count = text.upper().count("ALTER TABLE")
        self.assertEqual(0, count, f"app.py still patches the schema with ALTER TABLE ({count} occurrence(s))")
        self.assertFalse("def run_schema_upgrades" in text, "app.py still defines run_schema_upgrades")


class OutdatedDatabaseTests(unittest.TestCase):
    def test_a_database_with_an_old_schema_is_refused_with_a_reseed_hint(self):
        folder = Path(tempfile.mkdtemp(prefix="old-schema-"))
        db_file = folder / "demo.sqlite3"
        connection = sqlite3.connect(db_file)
        # An old copy of one real table, missing most of today's columns.
        connection.execute("CREATE TABLE student (id INTEGER PRIMARY KEY, student_number VARCHAR(40))")
        connection.execute("INSERT INTO student (id, student_number) VALUES (1, 'OLD-0001')")
        connection.commit()
        connection.close()

        env = dict(os.environ)
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_file.as_posix()}",
                "USLS_UPLOAD_DIR": str(folder / "uploads"),
                "POLICY_DOCUMENT_UPLOAD_DIR": str(folder / "policy-uploads"),
                "RAG_INDEX_DIR": str(folder / "rag-index"),
                "RAG_PREWARM": "0",
            }
        )
        result = subprocess.run(
            [sys.executable, "-c", "import app"],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            timeout=600,
        )
        output = result.stdout + result.stderr
        # A crash must not count as a refusal: exit 1 from the schema check, no traceback.
        self.assertEqual(1, result.returncode, f"expected a clean refusal (exit 1); last lines:\n{output[-1500:]}")
        self.assertFalse("Traceback" in output, f"the app crashed instead of refusing; last lines:\n{output[-1500:]}")
        self.assertTrue("npm run seed" in result.stderr, f"no reseed hint on stderr; last lines:\n{output[-1500:]}")

        # The old data was not touched (no patching, no silent rebuild).
        connection = sqlite3.connect(db_file)
        try:
            columns = [row[1] for row in connection.execute("PRAGMA table_info(student)")]
            self.assertEqual(["id", "student_number"], columns)
        finally:
            connection.close()


if __name__ == "__main__":
    unittest.main()
