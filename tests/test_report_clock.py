"""B1 (I-141, AD10): a real stage clock.

"Time in stage" used to be days since ``Student.updated_at``, so any edit (a name fix, a risk refresh) reset it.
Now one hook on ``Student.current_stage`` writes a ``StudentStageEvent`` whenever the stage really changes, and
``stage_days`` is the days since the latest event into the current stage. Dates here are set by the test itself.
"""
import atexit
import os
import tempfile
import unittest
from datetime import timedelta

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
atexit.register(lambda: os.path.exists(_DB_FILE.name) and os.unlink(_DB_FILE.name))
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="usls-uploads-"))
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""

from app import (  # noqa: E402
    Program,
    Student,
    StudentStageEvent,
    app,
    db,
    now_utc,
    stage_days,
    student_indicators,
)


def _events(student_id):
    return (
        StudentStageEvent.query.filter_by(student_id=student_id)
        .order_by(StudentStageEvent.changed_at, StudentStageEvent.id).all()
    )


class StageClockTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        cls.ctx = app.app_context()
        cls.ctx.push()
        db.drop_all()
        db.create_all()
        program = Program(code="CK", name="Clock", college="Graduate School", has_practicum=False)
        db.session.add(program)
        db.session.commit()
        cls.program_id = program.id

    @classmethod
    def tearDownClass(cls):
        db.session.remove()
        db.engine.dispose()
        cls.ctx.pop()

    def make(self, number, stage="Coursework"):
        student = Student(
            student_number=number, first_name="Cy", last_name=number, email=f"{number}@example.test",
            program_id=self.program_id, entry_year=2024, academic_year_entry="24-25", year_level="1",
            current_stage=stage, standing="Active", risk_level="On Track",
        )
        db.session.add(student)
        db.session.commit()
        return student

    def backdate(self, student, days):
        """Pretend the latest event happened `days` days ago."""
        event = _events(student.id)[-1]
        event.changed_at = now_utc() - timedelta(days=days, hours=1)
        db.session.commit()

    def test_a_new_student_gets_a_first_event_and_a_zero_clock(self):
        student = self.make("CK-1")
        events = _events(student.id)
        self.assertEqual([(e.from_stage, e.to_stage) for e in events], [(None, "Coursework")])
        self.assertEqual(stage_days(student), 0)

    def test_clock_counts_days_since_the_event_into_the_current_stage(self):
        student = self.make("CK-2")
        self.backdate(student, 50)
        self.assertEqual(stage_days(student), 50)
        self.assertEqual(student_indicators(student)["days_in_stage"], 50)

    def test_an_unrelated_edit_does_not_reset_the_clock(self):
        student = self.make("CK-3")
        self.backdate(student, 50)
        student.first_name = "Renamed"
        student.risk_level = "At Risk of Delay"
        student.adviser_name = "Dr. Someone"
        db.session.commit()
        self.assertEqual(len(_events(student.id)), 1)
        self.assertEqual(stage_days(student), 50)
        self.assertEqual(student_indicators(student)["days_in_stage"], 50)

    def test_a_stage_change_writes_one_event_and_resets_the_clock(self):
        student = self.make("CK-4")
        self.backdate(student, 50)
        student.current_stage = "Comprehensive Exam"
        db.session.commit()
        events = _events(student.id)
        self.assertEqual([(e.from_stage, e.to_stage) for e in events],
                         [(None, "Coursework"), ("Coursework", "Comprehensive Exam")])
        self.assertEqual(stage_days(student), 0)

    def test_setting_the_same_stage_again_changes_nothing(self):
        student = self.make("CK-5")
        self.backdate(student, 30)
        student.current_stage = "Coursework"
        db.session.commit()
        self.assertEqual(len(_events(student.id)), 1)
        self.assertEqual(stage_days(student), 30)

    def test_going_back_to_an_earlier_stage_starts_the_clock_again(self):
        student = self.make("CK-6")
        student.current_stage = "Comprehensive Exam"
        db.session.commit()
        first, second = _events(student.id)[0], _events(student.id)[1]
        first.changed_at = now_utc() - timedelta(days=90)
        second.changed_at = now_utc() - timedelta(days=40, hours=1)
        db.session.commit()
        student.current_stage = "Coursework"
        db.session.commit()
        self.assertEqual(stage_days(student), 0)
        self.assertEqual(_events(student.id)[-1].from_stage, "Comprehensive Exam")

    def test_a_student_without_events_falls_back_to_the_created_date(self):
        student = self.make("CK-7")
        StudentStageEvent.query.filter_by(student_id=student.id).delete()
        student.created_at = now_utc() - timedelta(days=12, hours=1)
        db.session.commit()
        self.assertEqual(stage_days(student), 12)


if __name__ == "__main__":
    unittest.main()
