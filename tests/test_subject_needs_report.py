"""Subject-needs report (Course Adjustments): who needs which subject.

Two different numbers per subject, never the same number twice:
  * not_taken_count - expected-to-enroll students whose curriculum has the subject and who
    have neither completed it nor are enrolled in it (the whole backlog);
  * need_count      - the subset for whom it is in their NEXT semester group (the same
    'next subjects' the course-demand figure uses) - what the coordinator must offer.
"""

import os
import tempfile
import unittest

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))

from app import (  # noqa: E402
    Course,
    CourseRecord,
    Program,
    Student,
    UserAccount,
    app,
    db,
    generate_password_hash,
    subject_needs_report_payload,
)

Y1S1, Y1S2, Y2S1 = "Year 1 - 1st Semester", "Year 1 - 2nd Semester", "Year 2 - 1st Semester"


class SubjectNeedsReportTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        try:
            with app.app_context():
                db.session.remove()
                db.engine.dispose()
            os.unlink(_DB_FILE.name)
        except (FileNotFoundError, PermissionError):
            pass

    def setUp(self):
        app.config.update(TESTING=True)
        with app.app_context():
            db.drop_all()
            db.create_all()
            program = Program(code="SNR", name="Subject Needs Program", college="Graduate School", has_practicum=False)
            db.session.add(program)
            db.session.flush()
            self.program_id = program.id
            spec = [("SNR-101", Y1S1), ("SNR-102", Y1S1), ("SNR-201", Y1S2), ("SNR-301", Y2S1)]
            self.course = {}
            for code, term in spec:
                course = Course(program_id=program.id, code=code, title=f"Title {code}", units=3,
                                category="Major", recommended_term=term)
                db.session.add(course)
                db.session.flush()
                self.course[code] = course.id
            ana = self._student("GS-SNR-1", "Ana", "Active", "Enrolled")
            ben = self._student("GS-SNR-2", "Ben", "Active", "Not Enrolled")
            cara = self._student("GS-SNR-3", "Cara", "Active", "Enrolled")
            dan = self._student("GS-SNR-4", "Dan", "On Leave", "LOA", stage="LOA")
            self.ids = {"ana": ana.id, "ben": ben.id, "cara": cara.id, "dan": dan.id}
            # Ana: finished 101, is sitting 102 now.  Ben: nothing yet.
            # Cara: failed 101, finished 102.  Dan is on leave: never counted.
            self._record(ana, "SNR-101", "Completed")
            self._record(ana, "SNR-102", "Current")
            self._record(cara, "SNR-101", "Failed")
            self._record(cara, "SNR-102", "Completed")
            self._record(dan, "SNR-101", "Missing")
            staff = UserAccount(email="staff-snr@example.test", full_name="Staff", role="staff", active=True,
                                password_hash=generate_password_hash("x"))
            db.session.add(staff)
            db.session.commit()
            self.staff_id = staff.id

    def _student(self, number, first, standing, tag, stage="Coursework"):
        student = Student(
            student_number=number, first_name=first, last_name="Tester", email=f"{number.lower()}@example.test",
            program_id=self.program_id, entry_year=2026, academic_year_entry="", year_level="1",
            current_stage=stage, standing=standing, enrollment_tag=tag,
        )
        db.session.add(student)
        db.session.flush()
        return student

    def _record(self, student, code, status):
        db.session.add(CourseRecord(student_id=student.id, course_id=self.course[code], status=status))

    def _report(self):
        with app.app_context():
            return subject_needs_report_payload(db.session.get(Program, self.program_id), None)

    def _row(self, payload, code):
        return next(row for row in payload["rows"] if row["course"]["code"] == code)

    def _names(self, row, **flags):
        return sorted(
            student["first_name"] for student in row["students"]
            if all(student[key] == value for key, value in flags.items())
        )

    def test_not_taken_is_the_whole_backlog_and_excludes_completed_current_and_leave(self):
        payload = self._report()
        self.assertEqual(payload["summary"]["students_reviewed"], 3)  # Dan is on leave
        self.assertEqual(self._names(self._row(payload, "SNR-101")), ["Ben", "Cara"])  # Ana completed it
        self.assertEqual(self._names(self._row(payload, "SNR-102")), ["Ben"])  # Ana is enrolled, Cara completed
        self.assertEqual(self._names(self._row(payload, "SNR-201")), ["Ana", "Ben", "Cara"])
        self.assertEqual(self._names(self._row(payload, "SNR-301")), ["Ana", "Ben", "Cara"])
        for code, expected in (("SNR-101", 2), ("SNR-102", 1), ("SNR-201", 3), ("SNR-301", 3)):
            self.assertEqual(self._row(payload, code)["not_taken_count"], expected, code)

    def test_need_is_the_subset_due_in_the_students_next_semester_group(self):
        payload = self._report()
        # Ben is at the start: his next group is 101 + 102.  Cara must retake 101.
        self.assertEqual(self._names(self._row(payload, "SNR-101"), due_next=True), ["Ben", "Cara"])
        self.assertEqual(self._names(self._row(payload, "SNR-102"), due_next=True), ["Ben"])
        # Ana's 1st-semester subjects are done or under way, so 201 is her next subject.
        self.assertEqual(self._names(self._row(payload, "SNR-201"), due_next=True), ["Ana"])
        self.assertEqual(self._names(self._row(payload, "SNR-301"), due_next=True), [])
        self.assertEqual(
            {code: self._row(payload, code)["need_count"] for code in self.course},
            {"SNR-101": 2, "SNR-102": 1, "SNR-201": 1, "SNR-301": 0},
        )
        # need can never exceed the backlog, and the two figures are not simply equal
        for row in payload["rows"]:
            self.assertLessEqual(row["need_count"], row["not_taken_count"])
        self.assertNotEqual(self._row(payload, "SNR-301")["need_count"], self._row(payload, "SNR-301")["not_taken_count"])

    def test_retakes_are_marked_and_counted_apart(self):
        payload = self._report()
        row = self._row(payload, "SNR-101")
        self.assertEqual(row["retake_count"], 1)
        cara = next(s for s in row["students"] if s["first_name"] == "Cara")
        self.assertEqual(cara["reason"], "Failed")
        ben = next(s for s in row["students"] if s["first_name"] == "Ben")
        self.assertEqual(ben["reason"], "Not taken")

    def test_summary_rows_are_sorted_by_need_and_carry_the_student_columns(self):
        payload = self._report()
        needs = [row["need_count"] for row in payload["rows"]]
        self.assertEqual(needs, sorted(needs, reverse=True))
        self.assertEqual(payload["summary"]["subjects_with_need"], 3)
        self.assertEqual(payload["summary"]["student_subject_needs"], 4)
        self.assertEqual(payload["summary"]["subjects_not_taken"], 4)
        student = self._row(payload, "SNR-101")["students"][0]
        for key in ("name", "student_number", "year_level", "status", "reason", "due_next"):
            self.assertIn(key, student)

    def test_the_api_returns_the_same_report(self):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = self.staff_id
            session["role"] = "staff"
        response = client.get(f"/api/course-adjustments/subject-needs-report?program_id={self.program_id}")
        self.assertEqual(response.status_code, 200, response.get_json())
        payload = response.get_json()
        self.assertEqual(self._row(payload, "SNR-101")["need_count"], 2)
        self.assertEqual(self._row(payload, "SNR-301")["not_taken_count"], 3)


if __name__ == "__main__":
    unittest.main()
