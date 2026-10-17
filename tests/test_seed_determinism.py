"""R-001: every machine gets the same demo data, and starting the app changes none of it.

Owner decisions IM2 (one SQLite setup, identical data everywhere), IM4 (a normal start
changes no data) and IM16 (dates relative to the seed day). Each database here is built
in its own temp folder by a separate Python process, exactly the way a teammate builds
theirs, and compared with scripts/db_fingerprint.py.
"""

import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from db_fingerprint import differing_tables, table_fingerprints  # noqa: E402

SEED_TIMEOUT_SECONDS = 900


def _env_for(folder: Path) -> dict:
    env = dict(os.environ)
    env.update(
        {
            "DATABASE_URL": f"sqlite:///{(folder / 'demo.sqlite3').as_posix()}",
            "USLS_UPLOAD_DIR": str(folder / "uploads"),
            "POLICY_DOCUMENT_UPLOAD_DIR": str(folder / "policy-uploads"),
            "RAG_INDEX_DIR": str(folder / "rag-index"),
            "RAG_PREWARM": "0",
            "PYTHONHASHSEED": "0",
        }
    )
    # A teammate's .env must not leak in: an API key or calendar setting can change what is seeded.
    for key in ("GOOGLE_API_KEY", "GOOGLE_AI_STUDIO_API_KEY", "USLS_SKIP_STARTUP_TASKS"):
        env.pop(key, None)
    return env


def _run(args: list[str], folder: Path) -> subprocess.CompletedProcess:
    result = subprocess.run(
        [sys.executable, *args],
        cwd=ROOT,
        env=_env_for(folder),
        capture_output=True,
        text=True,
        timeout=SEED_TIMEOUT_SECONDS,
    )
    if result.returncode != 0:
        raise AssertionError(
            f"`python {' '.join(args)}` failed with exit {result.returncode}:\n"
            f"{result.stdout[-2000:]}\n{result.stderr[-4000:]}"
        )
    return result


def _seed(folder: Path) -> None:
    """What `npm run seed` does."""
    _run(["app.py", "--seed"], folder)


def _start(folder: Path) -> None:
    """What `npm run dev` does before it starts serving: import the app with startup tasks on."""
    _run(["-c", "import app"], folder)


class SeedDeterminismTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = Path(tempfile.mkdtemp(prefix="seed-determinism-"))
        cls.first, cls.second, cls.plain = (cls.base / name for name in ("first", "second", "plain"))
        for folder in (cls.first, cls.second, cls.plain):
            folder.mkdir()
        _seed(cls.first)
        _seed(cls.second)
        _start(cls.plain)  # an empty database on first start
        cls.first_seeded = table_fingerprints(cls.first / "demo.sqlite3")
        cls.second_seeded = table_fingerprints(cls.second / "demo.sqlite3")
        cls.plain_started = table_fingerprints(cls.plain / "demo.sqlite3")
        _start(cls.first)  # start the app on the seeded database
        cls.first_after_start = table_fingerprints(cls.first / "demo.sqlite3")

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.base, ignore_errors=True)

    def test_two_seeds_give_identical_data(self):
        self.assertEqual(
            [],
            differing_tables(self.first_seeded, self.second_seeded),
            "Two `npm run seed` runs produced different data in these tables",
        )

    def test_first_start_on_an_empty_database_gives_the_seeded_data(self):
        self.assertEqual(
            [],
            differing_tables(self.first_seeded, self.plain_started),
            "Starting the app on an empty database built different data than `npm run seed`",
        )

    def test_starting_the_app_changes_no_data(self):
        self.assertEqual(
            [],
            differing_tables(self.first_seeded, self.first_after_start),
            "Starting the app on a seeded database changed these tables",
        )

    def test_seed_is_not_empty(self):
        students = self.first_seeded.get("student", "0:")
        self.assertGreater(int(students.split(":")[0]), 100, "the seed should build the demo cohort")


if __name__ == "__main__":
    unittest.main()
