"""Section J demo bugs (DEFENSE_REVISIONS.md J2, J5, J10, J12) - backend regression tests.

Built the way tests/test_bpm_workflows.py builds its throwaway database: the
DATABASE_URL points at a temp SQLite file before ``app`` is imported.
"""
import os
import tempfile
import unittest
from datetime import date

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
# Never write into the committed seed library (uploads/policy_documents/) or the real RAG index.
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))

from app import (  # noqa: E402
    AcademicTerm,
    Course,
    CourseOffering,
    CourseRecord,
    CurriculumOffering,
    DocumentCheck,
    GraduationEndorsement,
    PracticumRecord,
    Program,
    ResearchCase,
    ResidencyEnrollment,
    Student,
    StudentRequestAttachment,
    SubjectEnrollment,
    TransactionLog,
    UserAccount,
    app,
    db,
    generate_password_hash,
    graduation_candidate_payload,
    graduation_eligibility,
    required_documents_for_gate,
)


class SectionJBackendTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        try:
            with app.app_context():
                db.session.remove()
                db.engine.dispose()
            os.unlink(_DB_FILE.name)
        except FileNotFoundError:
            pass

    def setUp(self):
        app.config.update(TESTING=True)
        with app.app_context():
            db.drop_all()
            db.create_all()
            self.program = Program(code="BPM", name="BPM Psychology Program", college="Graduate School", has_practicum=True)
            db.session.add(self.program)
            db.session.flush()
            self.course = Course(program_id=self.program.id, code="BPM-501", title="Completion Course", units=3, category="Major")
            db.session.add(self.course)
            self.student = Student(
                student_number="GS-2026-TEST",
                first_name="Workflow",
                last_name="Student",
                email="workflow@example.test",
                program_id=self.program.id,
                entry_year=2025,
                academic_year_entry="25-26",
                year_level="1",
                current_stage="Final Defense",
                standing="Active",
            )
            db.session.add(self.student)
            db.session.flush()
            self.staff = self._account("staff", "staff@example.test")
            self.academic = self._account("academic_coordinator", "academic@example.test")
            self.research = self._account("research_coordinator", "research@example.test")
            self.dean = self._account("dean", "dean@example.test")
            self.program_id = self.program.id
            self.course_id = self.course.id
            self.student_id = self.student.id
            self.staff_id = self.staff.id
            self.academic_id = self.academic.id
            self.research_id = self.research.id
            self.dean_id = self.dean.id
            db.session.commit()

    def _account(self, role, email):
        account = UserAccount(
            email=email,
            full_name=f"Test {role.title()}",
            password_hash=generate_password_hash("test-password"),
            role=role,
            active=True,
        )
        db.session.add(account)
        db.session.flush()
        return account

    def _role_client(self, account_id, role):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    # ------------------------------------------------------------------ I-010 (J10)
    def test_graduation_batch_moves_to_exported_ready_to_send_after_dean_export(self):
        """J10: after the Dean's CSV export the batch must read 'Exported - Ready to Send'."""
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            db.session.add(CourseRecord(student_id=student.id, course_id=self.course_id, status="Completed"))
            db.session.add(ResearchCase(
                student_id=student.id, case_type="Thesis", title="Completed Research",
                current_gate="Completion Evidence", status="Verified Complete",
            ))
            for item in required_documents_for_gate("Completion Evidence"):
                db.session.add(DocumentCheck(student_id=student.id, gate="Completion Evidence", item_name=item, status="Complete"))
            db.session.add(PracticumRecord(
                student_id=student.id, practicum_site="Test Partner Organization",
                supervisor_name="Test Supervisor", required_hours=200, completed_hours=200,
                document_status="Verified", completion_status="Completed and accepted", status="Dean Reviewed",
            ))
            application_file = StudentRequestAttachment(
                student_id=student.id, request_type="graduation",
                original_name="signed-application.pdf", stored_name="graduation-signed-application-j10.pdf",
            )
            db.session.add(application_file)
            db.session.flush()
            endorsement = GraduationEndorsement(
                student_id=student.id,
                request_attachment_id=application_file.id,
                batch_name="Batch J10",
                review_window="AY 2026-2027",
                endorsement_status="Dean Approved",
                registrar_status="Pending Handoff",
            )
            db.session.add(endorsement)
            db.session.commit()
            endorsement_id = endorsement.id
            self.assertTrue(graduation_eligibility(student)["eligible"])

            response = self._role_client(self.dean_id, "dean").post(
                "/api/graduation/endorsed.csv", json={"endorsement_ids": [endorsement_id]},
            )
            self.assertEqual(response.status_code, 200, response.data[:300])

            row = next(
                item for item in graduation_candidate_payload()
                if item["endorsement"] and item["endorsement"]["id"] == endorsement_id
            )
            self.assertEqual(row["endorsement"].get("display_status"), "Exported - Ready to Send")
            latest_log = (
                TransactionLog.query.filter_by(student_id=student.id, transaction_slug="graduation")
                .order_by(TransactionLog.id.desc()).first()
            )
            self.assertEqual(latest_log.new_status, "Exported - Ready to Send")


if __name__ == "__main__":
    unittest.main()
