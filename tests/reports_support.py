"""Shared set-up for the Reports v2 tests (I-141, AD10): a temp database, small builders and a test client.

Import this module before ``app`` so the environment is in place. Not a test module itself.
"""
import atexit
import os
import tempfile
import unittest
from datetime import date, datetime, timedelta

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
atexit.register(lambda: os.path.exists(_DB_FILE.name) and os.unlink(_DB_FILE.name))
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_DB_FILE.name}")
os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="usls-uploads-"))
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""

from app import (  # noqa: E402
    AcademicTerm, Program, Student, StudentStageEvent, UserAccount, app, db, generate_password_hash, now_utc,
)

TODAY = date.today()


def days_ago(days, hours=1):
    """A timestamp a whole number of days (plus an hour, so the day count never lands on a boundary) ago."""
    return now_utc() - timedelta(days=days, hours=hours)


def make_account(role, email):
    account = UserAccount(
        email=email, full_name=f"Test {role}", password_hash=generate_password_hash("test-password"),
        role=role, active=True,
    )
    db.session.add(account)
    db.session.flush()
    return account.id


def make_student(program, number, entry="24-25", stage="Coursework", risk="On Track", standing="Active"):
    student = Student(
        student_number=number, first_name=f"F{number}", last_name=f"L{number}", email=f"{number.lower()}@example.test",
        program_id=program.id, entry_year=2000 + int(entry[:2]), academic_year_entry=entry, year_level="1",
        current_stage=stage, standing=standing, risk_level=risk,
    )
    db.session.add(student)
    db.session.flush()
    return student


def set_stage_clock(student, days):
    """The student entered the current stage `days` days ago (the stage events are the clock)."""
    StudentStageEvent.query.filter_by(student_id=student.id).delete()
    db.session.add(StudentStageEvent(student_id=student.id, from_stage=None, to_stage=student.current_stage, changed_at=days_ago(days)))
    db.session.flush()


class ReportsV2Base(unittest.TestCase):
    """Build one small, fully known fixture once; the endpoints under test only read it."""

    ROLES = ("staff", "academic_coordinator", "dean", "research_coordinator", "student")

    @classmethod
    def build(cls):
        raise NotImplementedError

    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        with app.app_context():
            db.drop_all()
            db.create_all()
            cls.accounts = {role: make_account(role, f"{role}@v2.test") for role in cls.ROLES}
            cls.build()
            db.session.commit()

    @classmethod
    def tearDownClass(cls):
        with app.app_context():
            db.session.remove()
            db.engine.dispose()

    def client(self, role="staff"):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = self.accounts[role]
            session["role"] = role
        return client

    def get(self, path, role="staff", **params):
        response = self.client(role).get(path, query_string=params)
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True)[:300])
        return response.get_json()
