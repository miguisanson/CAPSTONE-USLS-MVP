"""Demo data cleanup (owner 2026-11-22, IM54 + IM55; plan .planning/DATA-CLEANUP-PLAN.md).

The demo database keeps a small, readable set: the made-up demo students (tours, board steps, panel queue, upcoming
defenses), the 13 imported students that carry a case on a board, MAED for everyone but the practicum students, seven
faculty (all of them can sign in: a panel member needs a faculty login), and one login for each office. Every other
program keeps its definition and curriculum, with no students. Written before the change, seen failing.
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

from panel_demo_data import (  # noqa: E402
    ADVISER_APPLICATION_STUDENTS, HISTORY_DEMO_STUDENTS, HISTORY_PRACTICUM_STUDENTS, QUIET_DEMO_STUDENT,
    WALKTHROUGH_LOGIN_STUDENTS,
)
from app import (  # noqa: E402
    DEAN_DEMO_STUDENTS,
    DEMO_STUDENT_NUMBERS,
    Course,
    Faculty,
    Program,
    Student,
    UserAccount,
    app,
    build_demo_database,
    db,
)

# The imported students that stay (each carries a case on a board, the Research Gate or a Dean screen).
KEPT_SHEET_STUDENTS = {
    "2260004",  # Miguel Yu (student@): research, panels, defenses, verdicts
    "2260007",  # Isabel Flores: graduation For Review
    "2260011",  # Elena Mendoza: residency, Research Gate missing requirements
    "2360006",  # Adrian Lim: withdrawal for staff, at risk (Monitoring tour)
    "2360008",  # Hector Ong: graduation list with the Dean
    "2360010",  # Paulo Garcia: AWOL declared
    "2460003",  # Benjamin Santos: leave for staff
    "2460005",  # Clarisse Tan: AWOL return for staff
    "2460009",  # Maria Dela Cruz: readmission for staff
    "2560001",  # Daniel Cruz: new admission handoff
    "2560002",  # Grace Reyes: early coursework
    "2360101",  # Isabel Mendoza (MAPSY): practicum report with the Dean
    "2360092",  # Nicole Alvarez (MAPSY): practicum hours check
}
PAST_GRADUATES = {"2260904", "2260907", "2260908"}  # Angelica Pascual and two more (IM57): the graduation history
PRACTICUM_PROGRAMS = {"MSGC", "MAPSY"}
KEPT_FACULTY = {
    "Dr. Liwayway Bautista", "Dr. Angela Cruz", "Dr. Celeste Tan",  # the tours sign in as these three
    "Dr. Teodoro Ramos", "Dr. Patricia Salvador", "Dr. Marlon Geronimo",
    "Dr. Benjamin Reyes",  # IM56: a seventh adviser, because the kept students need 33 adviser seats (5 each)
}
FACULTY_LOGINS = set(KEPT_FACULTY)  # stage 4: every faculty member signs in (a panel member needs a login)
ALL_PROGRAMS = {"MSCS", "MIT", "MBA", "DBA", "MAED", "EDD", "MSN", "MAN", "MAPSY", "DPSY", "MSGC", "MASS"}


class DemoDataSizeTests(unittest.TestCase):
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

    def test_students_are_the_demo_set_and_nothing_else(self):
        with app.app_context():
            numbers = {s.student_number for s in Student.query.all()}
        history = {row[0] for row in HISTORY_DEMO_STUDENTS + HISTORY_PRACTICUM_STUDENTS}  # IM57
        walkthrough = {row[0] for row in ADVISER_APPLICATION_STUDENTS} | {QUIET_DEMO_STUDENT[0]}  # IM57: p63, p70
        expected = set(DEMO_STUDENT_NUMBERS.values()) | KEPT_SHEET_STUDENTS | PAST_GRADUATES | history | walkthrough
        self.assertEqual(sorted(numbers - expected), [], "students that should be gone")
        self.assertEqual(sorted(expected - numbers), [], "demo students that are missing")

    def test_everyone_is_maed_except_the_practicum_students(self):
        with app.app_context():
            others = sorted(
                (s.student_number, s.program.code) for s in Student.query.all()
                if s.program.code != "MAED" and s.program.code not in PRACTICUM_PROGRAMS
            )
            practicum = [s for s in Student.query.all() if s.program.code in PRACTICUM_PROGRAMS]
            self.assertTrue(all(s.program.has_practicum for s in practicum), "a non-MAED student outside a practicum program")
        self.assertEqual(others, [])

    def test_every_program_keeps_its_definition_and_curriculum(self):
        with app.app_context():
            codes = {p.code for p in Program.query.all()}
            self.assertTrue(ALL_PROGRAMS <= codes, sorted(ALL_PROGRAMS - codes))
            empty = [p.code for p in Program.query.all() if p.code in ALL_PROGRAMS and not Course.query.filter_by(program_id=p.id).count()]
        self.assertEqual(empty, [], "programs left without a curriculum")

    def test_seven_faculty_all_of_them_sign_in(self):
        with app.app_context():
            names = {f.name for f in Faculty.query.all()}
            logins = {f.name for f in Faculty.query.all() if f.email and UserAccount.query.filter_by(email=f.email).first()}
            faculty_accounts = UserAccount.query.filter_by(role="faculty").count()
        self.assertEqual(names, KEPT_FACULTY)
        self.assertEqual(logins, FACULTY_LOGINS)
        self.assertEqual(faculty_accounts, 7)  # stage 4: a panel member needs a faculty login

    def test_one_login_per_office(self):
        with app.app_context():
            for role in ("staff", "dean", "academic_coordinator", "research_coordinator", "admin"):
                self.assertEqual(UserAccount.query.filter_by(role=role).count(), 1, role)

    def test_student_logins_are_student_at_and_the_demo_students(self):
        with app.app_context():
            demo = (set(DEMO_STUDENT_NUMBERS.values()) | {row[0] for row in ADVISER_APPLICATION_STUDENTS}
                    | {QUIET_DEMO_STUDENT[0]} | set(WALKTHROUGH_LOGIN_STUDENTS))
            stray = []
            for account in UserAccount.query.filter_by(role="student").all():
                student = Student.query.filter_by(email=account.email).first() or (
                    Student.query.get(account.student_id) if getattr(account, "student_id", None) else None
                )
                number = student.student_number if student else None
                if account.email != "student@usls.edu.ph" and number not in demo:
                    stray.append(account.email)
        self.assertEqual(sorted(stray), [], "student logins for imported students other than student@")

    def test_the_dean_cases_belong_to_maed_demo_students(self):
        """Stage 3 (IM56): the Dean's waiting and decided cases sit with MAED demo students (practicum: MAPSY), each with
        a sign-in, so they stay when the imported students are trimmed."""
        with app.app_context():
            rows = {key: Student.query.filter_by(student_number=number).first() for key, number in DEAN_DEMO_STUDENTS.items()}
            missing = sorted(key for key, student in rows.items() if student is None)
            wrong = sorted(
                (key, student.program.code) for key, student in rows.items()
                if student and student.program.code != "MAED" and key != "practicum"
            )
            unreachable = sorted(
                key for key, student in rows.items()
                if student and key not in {"practicum", "graduation"}
                and not UserAccount.query.filter_by(student_id=student.id, role="student").first()
            )
        self.assertEqual(missing, [], "Dean demo students that are missing")
        self.assertEqual(wrong, [], "Dean demo students outside MAED")
        self.assertEqual(unreachable, [], "Dean demo students without a sign-in")

    def test_the_reports_have_a_small_history_in_both_earlier_terms(self):
        """IM57: each history student holds exactly one decided case or held defense; none signs in."""
        from app import AdviserAppointment, DefenseVerdict, TransactionLog, SEEDED_HISTORY_SOURCE
        with app.app_context():
            numbers = {row[0] for row in HISTORY_DEMO_STUDENTS + HISTORY_PRACTICUM_STUDENTS}
            students = Student.query.filter(Student.student_number.in_(numbers)).all()
            used = [s for s in students if TransactionLog.query.filter_by(student_id=s.id, source_reference=SEEDED_HISTORY_SOURCE).first()
                    or DefenseVerdict.query.filter_by(student_id=s.id).first()
                    or AdviserAppointment.query.filter_by(student_id=s.id).first()]
            logins = [s.student_number for s in students if UserAccount.query.filter_by(student_id=s.id).first()]
        self.assertEqual(len(students), len(numbers))
        self.assertEqual(sorted(s.student_number for s in students if s not in used), [], "history students left unused")
        self.assertEqual(logins, [])

    def test_faculty_named_by_students_exist(self):
        """Advisers named on the kept students are kept faculty (removed ones are mapped to a kept colleague)."""
        with app.app_context():
            names = {f.name for f in Faculty.query.all()}
            missing = sorted({s.adviser_name for s in Student.query.all() if s.adviser_name and s.adviser_name not in names})
        self.assertEqual(missing, [])


if __name__ == "__main__":
    unittest.main()
