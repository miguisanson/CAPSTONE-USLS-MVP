"""Audit round 3 fixes (process audit 2026-11-04): one test class per row."""

import os
import tempfile
import unittest
from unittest.mock import patch
from datetime import date, timedelta

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))

from app import (  # noqa: E402
    AcademicTerm, Course, Faculty, GraduationEndorsement, Program, ResidencyEnrollment, Student, TermEnrollment, UserAccount, app, db,
    generate_password_hash, run_maintenance_sweeps,
)


class Audit3Base(unittest.TestCase):
    ROLES = ("staff", "admin", "dean", "academic_coordinator", "research_coordinator", "student", "faculty")

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
            program = Program(code="A3", name="Audit Three Program", college="Graduate School", has_practicum=False)
            db.session.add(program)
            db.session.flush()
            self.program_id = program.id
            course = Course(program_id=program.id, code="A3-501", title="Audit Course", units=3, category="Major")
            db.session.add(course)
            db.session.flush()
            self.course_id = course.id
            today = date.today()
            for label, start, end in (
                ("Past Term", today - timedelta(days=200), today - timedelta(days=60)),
                ("Running Term", today - timedelta(days=20), today + timedelta(days=100)),
                ("Term One", today + timedelta(days=110), today + timedelta(days=230)),
                ("Term Two", today + timedelta(days=240), today + timedelta(days=360)),
            ):
                db.session.add(AcademicTerm(label=label, start_date=start, end_date=end))
            students = []
            for number, first in (("A3-1", "Ana"), ("A3-2", "Ben")):
                student = Student(
                    student_number=number, first_name=first, last_name="Audit", email=f"{first.lower()}@example.test",
                    program_id=program.id, entry_year=today.year - 1, academic_year_entry="25-26", year_level="1",
                    current_stage="Coursework", standing="Active", enrollment_tag="Enrolled",
                )
                db.session.add(student)
                students.append(student)
            db.session.flush()
            self.student_id, self.other_id = students[0].id, students[1].id
            faculty = Faculty(name="Fay Faculty", college="Graduate School", role="Professor",
                              specialization="Testing", email="fay@example.test")
            db.session.add(faculty)
            db.session.flush()
            self.faculty_id = faculty.id
            self.accounts = {}
            for role in self.ROLES:
                account = UserAccount(
                    email=f"a3-{role}@example.test", full_name=f"Test {role}", role=role, active=True,
                    password_hash=generate_password_hash("test-password"),
                    student_id=self.student_id if role == "student" else None,
                    faculty_id=self.faculty_id if role == "faculty" else None,
                )
                db.session.add(account)
                db.session.flush()
                self.accounts[role] = account.id
            db.session.commit()

    def client(self, role):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = self.accounts[role]
            session["role"] = role
        return client


class DemoSettingsNeedSignInTests(Audit3Base):
    """I-342 / I-351: only a signed-in staff, admin or dean account may flip the global date-wait switch."""

    def setUp(self):
        super().setUp()
        self.addCleanup(lambda: self.client("staff").post("/api/auth/demo-settings", json={"skip_date_waits": None}))

    def test_anonymous_is_refused_and_nothing_changes(self):
        before = app.test_client().get("/api/auth/config").get_json()["skip_date_waits"]
        response = app.test_client().post("/api/auth/demo-settings", json={"skip_date_waits": not before})
        self.assertEqual(response.status_code, 401)
        self.assertIn("Sign in", response.get_json()["error"])
        self.assertEqual(app.test_client().get("/api/auth/config").get_json()["skip_date_waits"], before)

    def test_student_and_faculty_are_refused(self):
        for role in ("student", "faculty"):
            response = self.client(role).post("/api/auth/demo-settings", json={"skip_date_waits": False})
            self.assertEqual(response.status_code, 403, role)

    def test_staff_admin_and_dean_can_flip_it(self):
        for role in ("staff", "admin", "dean"):
            for wanted in (False, True):
                response = self.client(role).post("/api/auth/demo-settings", json={"skip_date_waits": wanted})
                self.assertEqual(response.status_code, 200, (role, response.get_json()))
                self.assertIs(response.get_json()["skip_date_waits"], wanted)


class PrivacyNoticeEnforcedByTheApiTests(Audit3Base):
    """I-349: an account that has not accepted the Data Privacy Notice gets nothing from the API but auth, consent and health."""

    def setUp(self):
        super().setUp()
        app.config["ENFORCE_PRIVACY_CONSENT"] = True  # off while TESTING so the other suites need no consent step
        self.addCleanup(lambda: app.config.pop("ENFORCE_PRIVACY_CONSENT", None))

    def accept(self, role, accepted=True):
        from app import PRIVACY_NOTICE_VERSION
        with app.app_context():
            account = db.session.get(UserAccount, self.accounts[role])
            account.privacy_notice_version = PRIVACY_NOTICE_VERSION if accepted else None
            db.session.commit()

    def test_account_that_has_not_accepted_is_refused(self):
        self.accept("staff", accepted=False)
        client = self.client("staff")
        response = client.get("/api/meta")
        self.assertEqual(response.status_code, 403)
        self.assertTrue(response.get_json()["privacy_consent_required"])
        self.assertIn("Privacy", response.get_json()["error"])

    def test_auth_consent_and_health_still_answer(self):
        self.accept("staff", accepted=False)
        client = self.client("staff")
        self.assertEqual(client.get("/api/auth/me").status_code, 200)
        self.assertEqual(client.get("/api/health").status_code, 200)
        self.assertEqual(client.post("/api/auth/privacy-consent", json={"accept": True}).status_code, 200)
        self.assertEqual(client.get("/api/meta").status_code, 200)

    def test_accepted_account_is_not_affected(self):
        self.accept("dean")
        self.assertEqual(self.client("dean").get("/api/meta").status_code, 200)


class ResidencyClosesAtSemesterEndTests(Audit3Base):
    """I-300: the daily sweep closes a residency whose semester is over and gives the student the earlier tag back."""

    def residency(self, label, student_id=None):
        term = AcademicTerm.query.filter_by(label=label).one()
        student = db.session.get(Student, student_id or self.student_id)
        student.enrollment_tag = "Residency"
        db.session.add(TermEnrollment(student_id=student.id, term_id=term.id, status="Residency"))
        item = ResidencyEnrollment(student_id=student.id, term_id=term.id, reason="Thesis writing",
                                   policy_status="Eligible for Residency", status="Active", prior_enrollment_tag="Enrolled")
        db.session.add(item)
        db.session.commit()
        return item.id

    def test_a_past_semester_residency_is_closed_and_the_tag_restored(self):
        with app.app_context():
            item_id = self.residency("Past Term")
            run_maintenance_sweeps()
            db.session.commit()
            item = db.session.get(ResidencyEnrollment, item_id)
            self.assertEqual(item.status, "Completed")
            self.assertIsNotNone(item.ended_at)
            self.assertEqual(db.session.get(Student, self.student_id).enrollment_tag, "Enrolled")
            self.assertEqual(TermEnrollment.query.filter_by(student_id=self.student_id).one().status, "Completed")

    def test_a_residency_in_the_running_semester_stays_active(self):
        with app.app_context():
            item_id = self.residency("Running Term")
            run_maintenance_sweeps()
            db.session.commit()
            self.assertEqual(db.session.get(ResidencyEnrollment, item_id).status, "Active")
            self.assertEqual(db.session.get(Student, self.student_id).enrollment_tag, "Residency")


class GraduationBatchRechecksEligibilityTests(Audit3Base):
    """I-322: Dean batch approve re-checks eligibility like the single decide; the export names what it leaves out."""

    def setUp(self):
        super().setUp()
        with app.app_context():
            for sid in (self.student_id, self.other_id):
                db.session.add(GraduationEndorsement(student_id=sid, endorsement_status="Ready for Dean Review", batch_name="B1"))
            db.session.commit()
        self.eligible_ids = {self.student_id}
        patcher = patch("app.graduation_eligibility", side_effect=lambda student: {"eligible": student.id in self.eligible_ids})
        patcher.start()
        self.addCleanup(patcher.stop)

    def status(self, sid):
        with app.app_context():
            return GraduationEndorsement.query.filter_by(student_id=sid).one().endorsement_status

    def test_batch_approve_skips_an_ineligible_student_with_the_reason(self):
        response = self.client("dean").post("/api/graduation/batch-actions", json={
            "student_ids": [self.student_id, self.other_id], "action": "approve"})
        self.assertEqual(response.status_code, 200, response.get_json())
        body = response.get_json()
        self.assertEqual([row["student_id"] for row in body["updated"]], [self.student_id])
        self.assertEqual([row["student_id"] for row in body["skipped"]], [self.other_id])
        self.assertIn("eligible", body["skipped"][0]["reason"])
        self.assertEqual(self.status(self.student_id), "Dean Approved")
        self.assertEqual(self.status(self.other_id), "Ready for Dean Review")

    def test_export_names_the_students_it_leaves_out(self):
        with app.app_context():
            for row in GraduationEndorsement.query.all():
                row.endorsement_status = "Dean Approved"
            db.session.commit()
        dean = self.client("dean")
        mixed = dean.post("/api/graduation/endorsed.csv", json={})
        self.assertEqual(mixed.status_code, 200)
        self.assertEqual(mixed.headers["X-Exported-Count"], "1")
        self.assertIn("Ben Audit", mixed.headers["X-Left-Out"])
        self.eligible_ids = set()
        none = dean.post("/api/graduation/endorsed.csv", json={})
        self.assertEqual(none.status_code, 400)
        self.assertIn("Ana Audit", none.get_json()["error"])


if __name__ == "__main__":
    unittest.main()
