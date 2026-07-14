import os
import tempfile
import unittest
from datetime import date

from werkzeug.security import generate_password_hash


_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"

from app import (  # noqa: E402
    AcademicTerm,
    AwolCase,
    Course,
    CourseDropRequest,
    CourseRecord,
    DocumentCheck,
    GraduationEndorsement,
    PracticumRecord,
    Program,
    ResearchCase,
    ResidencyEnrollment,
    Student,
    StudentRequestAttachment,
    Task,
    TermEnrollment,
    TransactionLog,
    UserAccount,
    WorkflowMessage,
    WithdrawalApplication,
    REQUEST_UPLOAD_ROOT,
    app,
    db,
    graduation_eligibility,
    ensure_demo_accounts,
    required_documents_for_gate,
    submitted_request_students,
    task_dict,
    workflow_approvals_payload,
)


class BpmWorkflowSimulationTests(unittest.TestCase):
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
        self.created_files = []
        with app.app_context():
            db.drop_all()
            db.create_all()
            self.program = Program(code="BPM", name="BPM Practicum Program", college="Graduate School", has_practicum=True)
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

    def tearDown(self):
        for path in self.created_files:
            path.unlink(missing_ok=True)

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

    def _attachment(self, request_type, suffix):
        item = StudentRequestAttachment(
            student_id=self.student_id,
            request_type=request_type,
            original_name=f"{suffix}.pdf",
            stored_name=f"{request_type}-{suffix}.pdf",
        )
        db.session.add(item)
        db.session.flush()
        return item

    def _role_client(self, account_id, role):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    def _dean_client(self):
        return self._role_client(self.dean_id, "dean")

    def _staff_client(self):
        return self._role_client(self.staff_id, "staff")

    def _academic_client(self):
        return self._role_client(self.academic_id, "academic_coordinator")

    def _research_client(self):
        return self._role_client(self.research_id, "research_coordinator")

    def _transition(self, client, slug, payload, expected=200):
        response = client.post(f"/api/transactions/{slug}", json=payload)
        self.assertEqual(response.status_code, expected, response.get_json())
        return response

    def test_practicum_complete_and_incomplete_certificate_loop(self):
        with app.app_context():
            self.student = db.session.get(Student, self.student_id)
            moa = self._attachment("practicum", "moa")
            certificates = self._attachment("practicum", "certificates")
            record = PracticumRecord(
                student_id=self.student.id,
                moa_attachment_id=moa.id,
                moa_uploaded=True,
                moa_status="Uploaded",
                practicum_site="Partner Site",
                required_hours=200,
                completed_hours=120,
                certificate_attachment_id=certificates.id,
                document_status="Pending Review",
                certificate_count=1,
                status="MOA Submitted",
            )
            db.session.add(record)
            db.session.commit()

            staff = self._staff_client()
            academic = self._academic_client()
            self._transition(staff, "practicum", {"student_id": self.student.id, "status": "MOA Under Review"})
            self.assertEqual(record.status, "MOA Under Review")
            self.assertTrue(Task.query.filter_by(student_id=self.student_id, owner_role="Academic Coordinator").filter(Task.title.contains("practicum MOA")).first())
            self._transition(staff, "practicum", {"student_id": self.student.id, "status": "Practicum In Progress"}, 400)
            self._transition(academic, "practicum", {"student_id": self.student.id, "status": "Practicum In Progress"})
            self.assertEqual(record.status, "Practicum In Progress")

            record.status = "Hours Incomplete"
            db.session.commit()
            self._transition(staff, "practicum", {"student_id": self.student.id, "status": "Documents Under Review"})
            self.assertEqual(record.status, "Documents Under Review")
            self._transition(academic, "practicum", {
                "student_id": self.student.id,
                "status": "Additional Certificates Requested",
                "return_reason": "Upload the signed completion certificate.",
            })
            self.assertEqual(record.status, "Additional Certificates Requested")

            record.completed_hours = 200
            record.status = "Documents Submitted"
            db.session.commit()
            self._transition(staff, "practicum", {"student_id": self.student.id, "status": "Documents Under Review"})
            self._transition(academic, "practicum", {"student_id": self.student.id, "status": "Completed", "document_status": "Verified"})
            self._transition(academic, "practicum", {"student_id": self.student.id, "status": "Report Sent to Dean", "document_status": "Verified"})
            self.assertEqual(record.status, "Report Sent to Dean")
            dean_item = next(item for item in workflow_approvals_payload()["pending"] if item["type"] == "practicum" and item["id"] == record.id)
            self.assertEqual(dean_item["timeline"][9]["label"], "Status Report Sent to Dean")
            self.assertEqual(dean_item["timeline"][9]["state"], "current")

            response = self._dean_client().post(f"/api/approvals/workflow/practicum/{record.id}/decide", json={"decision": "review"})
            self.assertEqual(response.status_code, 200)
            db.session.refresh(record)
            self.assertEqual(record.status, "Dean Reviewed")

    def test_withdrawal_approval_sequence_and_denial_branch(self):
        with app.app_context():
            self.student = db.session.get(Student, self.student_id)
            request_file = self._attachment("withdrawal", "request")
            proof_file = self._attachment("withdrawal", "proof")
            application = WithdrawalApplication(
                student_id=self.student.id,
                reason="Personal",
                effective_term="AY 2026-2027 Term 1",
                request_attachment_id=request_file.id,
                status="Submitted to GS Staff",
            )
            db.session.add(application)
            db.session.commit()
            self.assertFalse(any(item["id"] == application.id and item["type"] == "withdrawal" for item in workflow_approvals_payload()["pending"]))

            staff = self._staff_client()
            academic = self._academic_client()
            self._transition(staff, "withdrawal", {"student_id": self.student.id, "workflow_action": "forward_to_dean"})
            dean_item = next(item for item in workflow_approvals_payload()["pending"] if item["id"] == application.id and item["type"] == "withdrawal")
            self.assertEqual(dean_item["workflow_status"], "Dean Review")

            response = self._dean_client().post(f"/api/approvals/workflow/withdrawal/{application.id}/decide", json={"decision": "approve"})
            self.assertEqual(response.status_code, 200)
            db.session.refresh(application)
            self.assertEqual(application.status, "Approved - Follow-through")

            self._transition(staff, "withdrawal", {"student_id": self.student.id, "workflow_action": "coordinator_follow_through"}, 400)
            self._transition(academic, "withdrawal", {"student_id": self.student.id, "workflow_action": "coordinator_follow_through"})
            self.assertEqual(application.status, "Coordinator Follow-through Complete")
            self.assertTrue(Task.query.filter_by(student_id=self.student_id, owner_role="Graduate School Staff").filter(Task.title.contains("Inform student")).first())
            self._transition(staff, "withdrawal", {"student_id": self.student.id, "workflow_action": "notify_student_of_approval"})
            application.proof_attachment_id = proof_file.id
            application.status = "Requirements Submitted"
            db.session.commit()
            self._transition(staff, "withdrawal", {
                "student_id": self.student.id,
                "workflow_action": "return_requirements",
                "return_reason": "Upload the signed clearance page.",
            })
            self.assertEqual(application.status, "Requirements Pending")
            application.status = "Requirements Submitted"
            db.session.commit()
            self._transition(staff, "withdrawal", {"student_id": self.student.id, "workflow_action": "verify_requirements"})
            self.assertEqual(application.status, "Requirements Verified")
            self.assertTrue(Task.query.filter_by(student_id=self.student_id, owner_role="Graduate School Staff").filter(Task.title.contains("Confirm the completed withdrawal")).first())
            self._transition(staff, "withdrawal", {"student_id": self.student.id, "workflow_action": "confirm_withdrawal"})
            self.assertEqual(application.status, "Withdrawn Confirmed")
            self.assertEqual(self.student.standing, "Withdrawn")

            denied_student = Student(
                student_number="BPM-002",
                first_name="Denied",
                last_name="Student",
                email="denied@example.test",
                program_id=self.program_id,
                entry_year=2025,
                current_stage="Coursework",
                standing="Active",
            )
            db.session.add(denied_student)
            db.session.flush()
            denied = WithdrawalApplication(student_id=denied_student.id, status="Dean Review", dean_decision="Pending")
            db.session.add(denied)
            db.session.commit()
            response = self._dean_client().post(
                f"/api/approvals/workflow/withdrawal/{denied.id}/decide",
                json={"decision": "deny", "note": "The request does not meet the approved withdrawal grounds."},
            )
            self.assertEqual(response.status_code, 200)
            db.session.refresh(denied_student)
            self.assertEqual(denied.status, "Denied")
            self.assertEqual(denied_student.standing, "Active")

    def test_graduation_return_resubmit_approve_and_export(self):
        with app.app_context():
            self.student = db.session.get(Student, self.student_id)
            db.session.add(CourseRecord(student_id=self.student.id, course_id=self.course_id, status="Completed"))
            db.session.add(ResearchCase(
                student_id=self.student.id,
                case_type="Thesis",
                title="Completed Research",
                current_gate="Completion Evidence",
                status="Verified Complete",
            ))
            for item in required_documents_for_gate("Completion Evidence"):
                db.session.add(DocumentCheck(student_id=self.student.id, gate="Completion Evidence", item_name=item, status="Complete"))
            db.session.add(PracticumRecord(
                student_id=self.student.id,
                practicum_site="Test Partner Organization",
                supervisor_name="Test Supervisor",
                required_hours=200,
                completed_hours=200,
                document_status="Verified",
                completion_status="Completed and accepted",
                status="Dean Reviewed",
            ))
            db.session.commit()

            # Graduation readiness now gates on coursework, research, and
            # accepted practicum completion for programs that require it.
            self.assertTrue(graduation_eligibility(self.student)["eligible"])
            staff = self._staff_client()
            academic = self._academic_client()
            research = self._research_client()
            self._transition(staff, "graduation", {"student_id": self.student.id, "review_window": "AY 2026-2027", "endorsement_status": "Coursework Review"})
            self.assertTrue(Task.query.filter_by(student_id=self.student_id, owner_role="Academic Coordinator").filter(Task.title.contains("coursework completion")).first())
            self._transition(staff, "graduation", {"student_id": self.student.id, "endorsement_status": "Research Review"}, 400)
            self._transition(academic, "graduation", {"student_id": self.student.id, "endorsement_status": "Research Review"})
            self.assertTrue(Task.query.filter_by(student_id=self.student_id, owner_role="Research Coordinator").filter(Task.title.contains("research completion")).first())
            self._transition(research, "graduation", {"student_id": self.student.id, "endorsement_status": "Eligibility Confirmed"})
            self._transition(staff, "graduation", {"student_id": self.student.id, "endorsement_status": "Endorsement Prepared"})
            self._transition(staff, "graduation", {"student_id": self.student.id, "endorsement_status": "Ready for Dean Review"})
            endorsement = GraduationEndorsement.query.filter_by(student_id=self.student.id).first()
            db.session.commit()
            dean_item = next(item for item in workflow_approvals_payload()["pending"] if item["type"] == "graduation" and item["id"] == endorsement.id)
            self.assertTrue(dean_item["eligibility"]["eligible"])

            response = self._dean_client().post(
                f"/api/approvals/workflow/graduation/{endorsement.id}/decide",
                json={"decision": "return", "note": "Correct the endorsement list before resubmitting."},
            )
            self.assertEqual(response.status_code, 200)
            db.session.refresh(endorsement)
            self.assertEqual(endorsement.endorsement_status, "Returned for Revision")
            self._transition(staff, "graduation", {"student_id": self.student.id, "endorsement_status": "Ready for Dean Review"})
            response = self._dean_client().post(f"/api/approvals/workflow/graduation/{endorsement.id}/decide", json={"decision": "approve"})
            self.assertEqual(response.status_code, 200)

            response = self._dean_client().post("/api/graduation/endorsed.csv", json={"endorsement_ids": [endorsement.id]})
            self.assertEqual(response.status_code, 200)
            db.session.refresh(endorsement)
            # Export is the terminal step: the endorsed list is handed off externally,
            # with no in-app Registrar receipt (Registrar is not an in-system actor).
            self.assertEqual(endorsement.endorsement_status, "Sent to Registrar")
            self.assertFalse(Task.query.filter_by(student_id=self.student_id, owner_role="Registrar").first())

    def test_graduation_incomplete_coursework_and_research_are_routed_to_staff(self):
        with app.app_context():
            staff = self._staff_client()
            academic = self._academic_client()
            research = self._research_client()

            self._transition(staff, "graduation", {"student_id": self.student_id, "endorsement_status": "Coursework Review"})
            self._transition(academic, "graduation", {"student_id": self.student_id, "endorsement_status": "Research Review"})
            endorsement = GraduationEndorsement.query.filter_by(student_id=self.student_id).first()
            self.assertEqual(endorsement.endorsement_status, "Coursework Incomplete")
            self.assertTrue(Task.query.filter_by(student_id=self.student_id, owner_role="Graduate School Staff").filter(Task.title.contains("missing graduation coursework")).first())
            self._transition(research, "graduation", {"student_id": self.student_id, "endorsement_status": "Eligibility Confirmed"}, 400)
            self._transition(staff, "graduation", {"student_id": self.student_id, "endorsement_status": "Not Eligible"})

            db.session.add(CourseRecord(student_id=self.student_id, course_id=self.course_id, status="Completed"))
            db.session.commit()
            self._transition(staff, "graduation", {"student_id": self.student_id, "endorsement_status": "Coursework Review"})
            self._transition(academic, "graduation", {"student_id": self.student_id, "endorsement_status": "Research Review"})
            self._transition(research, "graduation", {"student_id": self.student_id, "endorsement_status": "Eligibility Confirmed"})
            self.assertEqual(endorsement.endorsement_status, "Research Incomplete")
            self.assertTrue(Task.query.filter_by(student_id=self.student_id, owner_role="Graduate School Staff").filter(Task.title.contains("missing graduation research")).first())
            self._transition(staff, "graduation", {"student_id": self.student_id, "endorsement_status": "Not Eligible"})
            self.assertEqual(endorsement.endorsement_status, "Not Eligible")

    def test_course_audit_bulk_grades_and_overdue_incomplete_requires_retake(self):
        with app.app_context():
            academic = self._academic_client()

            response = academic.post("/api/course-audit/roster", json={
                "course_id": self.course_id,
                "term": "AY 2026-2027 1st Semester",
                "statuses": {str(self.student_id): "Completed"},
                "grades": {str(self.student_id): "1.25"},
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            record = CourseRecord.query.filter_by(student_id=self.student_id, course_id=self.course_id).first()
            self.assertEqual(record.status, "Completed")
            self.assertEqual(record.grade_status, "Passed")
            self.assertEqual(record.grade_value, "1.25")

            response = academic.post("/api/course-audit/roster", json={
                "course_id": self.course_id,
                "statuses": {str(self.student_id): "Incomplete"},
                "incomplete_deadlines": {str(self.student_id): "2020-01-01"},
                "remarks": {str(self.student_id): "Awaiting final output"},
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(record)
            self.assertEqual(record.status, "Retake Required")
            self.assertEqual(record.grade_status, "No Credit - Retake Required")
            self.assertEqual(record.grade_value, "3.0")
            self.assertIsNone(record.incomplete_deadline)
            self.assertIn("must be retaken", record.remarks)
            self.assertIsNotNone(Task.query.filter_by(student_id=self.student_id, owner_role="Academic Coordinator").filter(Task.title.contains("lapsed INC")).first())
            notices = WorkflowMessage.query.filter_by(
                transaction_slug="course-audit",
                student_id=self.student_id,
                recipient_role="Student",
                visibility="student_visible",
            ).all()
            self.assertTrue(any("Incomplete grade recorded" in item.template for item in notices))
            self.assertTrue(any("Incomplete deadline passed" in item.template for item in notices))
            student = db.session.get(Student, self.student_id)
            self.assertFalse(graduation_eligibility(student)["eligible"])

    def test_course_drop_request_requires_academic_coordinator_approval(self):
        with app.app_context():
            record = CourseRecord(student_id=self.student_id, course_id=self.course_id, status="Enrolled", term_label="AY 2026-2027 Term 1")
            db.session.add(record)
            student_account = UserAccount(
                email="drop-student@example.test",
                full_name="Drop Request Student",
                password_hash=generate_password_hash("test-password"),
                role="student",
                student_id=self.student_id,
                active=True,
            )
            db.session.add(student_account)
            db.session.commit()

            student_client = self._role_client(student_account.id, "student")
            response = student_client.post("/api/student-portal/requests/course-drop", json={
                "course_id": self.course_id,
                "term_label": "AY 2026-2027 Term 1",
                "reason": "Schedule conflict",
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(record)
            self.assertEqual(record.status, "Enrolled")
            drop = CourseDropRequest.query.filter_by(student_id=self.student_id, course_id=self.course_id).first()
            self.assertEqual(drop.status, "Submitted")
            task = Task.query.filter_by(student_id=self.student_id, owner_role="Academic Coordinator").filter(Task.title.contains("Review course drop request")).first()
            self.assertIsNotNone(task)
            self.assertEqual(task_dict(task)["action_url"], "/workflow/course-audit")

            staff_response = self._staff_client().post(f"/api/course-drop/requests/{drop.id}/decide", json={"decision": "approve"})
            self.assertEqual(staff_response.status_code, 403)
            response = self._academic_client().post(f"/api/course-drop/requests/{drop.id}/decide", json={"decision": "approve", "remarks": "Approved for demo"})
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(record)
            db.session.refresh(drop)
            self.assertEqual(record.status, "Dropped")
            self.assertEqual(drop.status, "Approved")
            db.session.refresh(task)
            self.assertEqual(task.status, "Done")

    def test_eligible_loa_and_readmission_auto_approve(self):
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            db.session.add(TransactionLog(
                transaction_slug="leave-of-absence",
                student_id=student.id,
                actor_role="Student",
                source_reference="loa-request.pdf",
                result="LOA application submitted",
                next_owner="GS Staff",
                notes=(
                    "Student submitted a Leave of Absence application for staff eligibility review.\n"
                    "Requested period: AY 2026-2027 1st Semester to AY 2026-2027 2nd Semester.\n"
                    "Reason/remarks: Health leave."
                ),
            ))
            db.session.commit()

            response = self._staff_client().post("/api/transactions/leave-of-absence", json={
                "student_id": student.id,
                "application_reference": "loa-request.pdf",
                "effective_start": "AY 2026-2027 1st Semester",
                "effective_end": "AY 2026-2027 2nd Semester",
                "reason_remarks": "Health leave",
                "eligibility_status": "Eligible",
                "prior_loa_count": 0,
                "dean_action": "Approve",
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(student)
            self.assertEqual(student.standing, "On Leave")
            self.assertEqual(student.enrollment_tag, "LOA")
            forwarded = TransactionLog.query.filter_by(
                transaction_slug="leave-of-absence",
                student_id=student.id,
                result="LOA request forwarded to Dean",
            ).first()
            self.assertIsNotNone(forwarded)
            self.assertEqual(forwarded.actor_user_id, self.staff_id)
            auto_approved = TransactionLog.query.filter_by(
                transaction_slug="leave-of-absence",
                student_id=student.id,
                result="LOA auto-approved by RAG",
            ).first()
            self.assertIsNotNone(auto_approved)
            loa_rows = submitted_request_students("leave-of-absence")
            self.assertEqual(loa_rows[0]["status"], "Approved")
            self.assertEqual(loa_rows[0]["next_action_owner"], "Graduate School Staff")
            self.assertFalse(any(
                item["id"] == forwarded.id and item["type"] == "leave-of-absence"
                for item in workflow_approvals_payload()["pending"]
            ))

            db.session.add(TransactionLog(
                transaction_slug="readmission",
                student_id=student.id,
                actor_role="Student",
                source_reference="readmission-request.pdf",
                result="Readmission request submitted",
                next_owner="GS Staff",
                notes=(
                    "Student submitted a readmission request for staff review.\n"
                    "Target return semester: AY 2027-2028 1st Semester.\n"
                    "Previous LOA period: AY 2026-2027 1st Semester to AY 2026-2027 2nd Semester."
                ),
            ))
            db.session.commit()

            response = self._staff_client().post("/api/transactions/readmission", json={
                "student_id": student.id,
                "application_reference": "readmission-request.pdf",
                "target_return_term": "AY 2027-2028 1st Semester",
                "previous_loa_period": "AY 2026-2027 1st Semester to AY 2026-2027 2nd Semester",
                "eligibility_status": "Eligible to Return",
                "readmission_items": [
                    "Return intent letter",
                    "Updated study plan",
                    "Program/adviser endorsement",
                    "No pending accountability",
                ],
                "dean_action": "Deny",
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(student)
            self.assertEqual(student.standing, "Active")
            self.assertEqual(student.enrollment_tag, "Enrolled")
            forwarded = TransactionLog.query.filter_by(
                transaction_slug="readmission",
                student_id=student.id,
                result="Readmission request forwarded to Dean",
            ).first()
            self.assertIsNotNone(forwarded)
            auto_approved = TransactionLog.query.filter_by(
                transaction_slug="readmission",
                student_id=student.id,
                result="Readmission auto-approved by RAG",
            ).first()
            self.assertIsNotNone(auto_approved)
            readmission_rows = submitted_request_students("readmission")
            self.assertEqual(readmission_rows[0]["status"], "Approved")
            self.assertEqual(readmission_rows[0]["next_action_owner"], "Academic Coordinator")
            self.assertFalse(any(
                item["id"] == forwarded.id and item["type"] == "readmission"
                for item in workflow_approvals_payload()["pending"]
            ))
            self.assertIsNotNone(Task.query.filter_by(
                student_id=student.id,
                owner_role="Academic Coordinator",
                title="Confirm return-semester study plan",
            ).first())

    def test_readmission_needs_review_still_goes_to_dean(self):
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            student.current_stage = "LOA"
            student.standing = "On Leave"
            student.enrollment_tag = "LOA"
            db.session.add(TransactionLog(
                transaction_slug="readmission",
                student_id=student.id,
                actor_role="Student",
                source_reference="readmission-incomplete.pdf",
                result="Readmission request submitted",
                next_owner="GS Staff",
                notes=(
                    "Student submitted a readmission request for staff review.\n"
                    "Target return semester: AY 2027-2028 1st Semester.\n"
                    "Previous LOA period: AY 2026-2027 1st Semester to AY 2026-2027 2nd Semester."
                ),
            ))
            db.session.commit()

            response = self._staff_client().post("/api/transactions/readmission", json={
                "student_id": student.id,
                "application_reference": "readmission-incomplete.pdf",
                "target_return_term": "AY 2027-2028 1st Semester",
                "previous_loa_period": "AY 2026-2027 1st Semester to AY 2026-2027 2nd Semester",
                "eligibility_status": "Needs Review",
                "readmission_items": [
                    "Return intent letter",
                    "Updated study plan",
                    "Program/adviser endorsement",
                ],
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(student)
            self.assertEqual(student.standing, "On Leave")
            self.assertEqual(student.enrollment_tag, "LOA")
            forwarded = TransactionLog.query.filter_by(
                transaction_slug="readmission",
                student_id=student.id,
                result="Readmission request forwarded to Dean",
            ).first()
            self.assertIsNotNone(forwarded)
            self.assertIsNone(TransactionLog.query.filter_by(
                transaction_slug="readmission",
                student_id=student.id,
                result="Readmission auto-approved by RAG",
            ).first())
            readmission_rows = submitted_request_students("readmission")
            self.assertEqual(readmission_rows[0]["status"], "In Progress")
            self.assertEqual(readmission_rows[0]["next_action_owner"], "Dean")
            self.assertTrue(any(
                item["id"] == forwarded.id and item["type"] == "readmission"
                for item in workflow_approvals_payload()["pending"]
            ))

    def test_awol_return_is_policy_reviewed_and_decided_by_dean(self):
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            student.entry_year = date.today().year - 2
            student.current_stage = "Coursework"
            student.standing = "Active"
            student.enrollment_tag = "Enrolled"
            student_account = self._account("student", "awol-return-student@example.test")
            student_account.student_id = student.id
            db.session.commit()

            response = self._staff_client().post("/api/transactions/awol", json={
                "student_id": student.id,
                "workflow_action": "declare_awol",
                "awol_effective_date": date.today().isoformat(),
                "last_enrolled_term": "AY 2025-2026 2nd Semester",
                "staff_notes": "No formal leave was filed.",
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(student)
            self.assertEqual(student.enrollment_tag, "AWOL")
            item = AwolCase.query.filter_by(student_id=student.id).first()
            self.assertEqual(item.status, "AWOL Declared")

            attachment = self._attachment("awol-return", "written-intent")
            attachment.student_id = student.id
            db.session.commit()
            response = self._role_client(student_account.id, "student").post("/api/student-portal/requests/awol-return", json={
                "attachment_id": attachment.id,
                "target_return_term": "AY 2026-2027 1st Semester",
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(item)
            self.assertEqual(item.status, "Return Submitted")
            self.assertEqual(item.policy_classification, "Within Maximum Residence")

            response = self._staff_client().post("/api/transactions/awol", json={
                "student_id": student.id,
                "case_id": item.id,
                "workflow_action": "forward_return_to_dean",
                "staff_notes": "Written intent verified.",
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(item)
            self.assertEqual(item.status, "Dean Review")
            pending = workflow_approvals_payload()["pending"]
            self.assertTrue(any(row["type"] == "awol-return" and row["id"] == item.id for row in pending))

            response = self._dean_client().post(
                f"/api/approvals/workflow/awol-return/{item.id}/decide",
                json={"decision": "approve", "note": "Return endorsed."},
            )
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(item)
            db.session.refresh(student)
            self.assertEqual(item.status, "Return Approved")
            self.assertEqual(student.standing, "Active")
            self.assertEqual(student.enrollment_tag, "Enrolled")

    def test_awol_absolute_limit_requires_reenrollment_and_valid_residency_is_recorded(self):
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            student.entry_year = date.today().year - 8
            student.current_stage = "Coursework"
            student.standing = "Active"
            student.enrollment_tag = "Enrolled"
            student_account = self._account("student", "awol-limit-student@example.test")
            student_account.student_id = student.id
            db.session.commit()

            self.assertEqual(self._staff_client().post("/api/transactions/awol", json={
                "student_id": student.id,
                "workflow_action": "declare_awol",
            }).status_code, 200)
            attachment = self._attachment("awol-return", "over-limit-intent")
            attachment.student_id = student.id
            db.session.commit()
            response = self._role_client(student_account.id, "student").post("/api/student-portal/requests/awol-return", json={
                "attachment_id": attachment.id,
                "target_return_term": "AY 2026-2027 1st Semester",
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            item = AwolCase.query.filter_by(student_id=student.id).first()
            self.assertEqual(item.policy_classification, "Full Re-enrollment Required")
            self.assertTrue(item.full_reenrollment_required)
            self.assertEqual(self._staff_client().post("/api/transactions/awol", json={
                "student_id": student.id,
                "case_id": item.id,
                "workflow_action": "forward_return_to_dean",
            }).status_code, 200)
            response = self._dean_client().post(
                f"/api/approvals/workflow/awol-return/{item.id}/decide",
                json={"decision": "approve", "note": "Proceed with full course re-evaluation."},
            )
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(item)
            db.session.refresh(student)
            self.assertEqual(item.status, "Re-enrollment Required")
            self.assertEqual(student.enrollment_tag, "AWOL")

            student.entry_year = date.today().year
            student.standing = "Active"
            student.enrollment_tag = "Enrolled"
            student.current_stage = "Coursework"
            db.session.add(CourseRecord(
                student_id=student.id,
                course_id=self.course_id,
                status="Incomplete",
                grade_status="Incomplete",
            ))
            term = AcademicTerm(
                label="AY 2026-2027 1st Semester",
                start_date=date(date.today().year, 1, 1),
                end_date=date(date.today().year, 5, 31),
                is_active_planning_term=True,
            )
            db.session.add(term)
            db.session.commit()
            response = self._staff_client().post("/api/transactions/awol", json={
                "student_id": student.id,
                "workflow_action": "record_residency",
                "term_id": term.id,
                "residency_reason": "Completing an INC",
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            residency = ResidencyEnrollment.query.filter_by(student_id=student.id, status="Active").first()
            enrollment = TermEnrollment.query.filter_by(student_id=student.id, term_id=term.id).first()
            db.session.refresh(student)
            self.assertIsNotNone(residency)
            self.assertEqual(enrollment.status, "Residency")
            self.assertEqual(student.enrollment_tag, "Residency")

    def test_demo_backoffice_accounts_sign_in_as_distinct_roles(self):
        with app.app_context():
            ensure_demo_accounts()
            db.session.commit()
        expected = {
            "staff@gs.local": "staff",
            "academic@gs.local": "academic_coordinator",
            "research@gs.local": "research_coordinator",
        }
        for email, role in expected.items():
            response = app.test_client().post(
                "/api/auth/login",
                json={"role": "staff", "email": email, "password": "DemoPass123!"},
            )
            self.assertEqual(response.status_code, 200, response.get_json())
            self.assertEqual(response.get_json()["user"]["role"], role)

    def test_workflow_clarification_can_be_returned_and_answered(self):
        with app.app_context():
            application = WithdrawalApplication(
                student_id=self.student_id,
                reason="Needs clarification test",
                effective_term="AY 2026-2027 Term 1",
                status="Dean Review",
                dean_decision="Pending",
            )
            request_file = self._attachment("withdrawal", "clarification-request")
            application.request_attachment_id = request_file.id
            student_account = self._account("student", "student-clarification@example.test")
            student_account.student_id = self.student_id
            db.session.add(application)
            db.session.commit()
            student_account_id = student_account.id

            response = self._staff_client().post("/api/transactions/withdrawal/messages", json={
                "student_id": self.student_id,
                "action_type": "return",
                "recipient_role": "Student",
                "template": "Missing required document",
                "comment": "",
            })
            self.assertEqual(response.status_code, 400, response.get_json())

            response = self._staff_client().post("/api/transactions/withdrawal/messages", json={
                "student_id": self.student_id,
                "action_type": "return",
                "recipient_role": "Student",
                "template": "Missing required document",
                "comment": "Upload the signed request form.",
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(application)
            self.assertEqual(application.status, "Returned for Clarification")
            message = WorkflowMessage.query.filter_by(student_id=self.student_id, status="Open").first()
            self.assertEqual(message.previous_status, "Dean Review")
            self.assertEqual(message.workflow_request_id, application.id)
            self.assertEqual(message.workflow_stage, "Returned for Clarification")
            self.assertEqual(message.visibility, "student_visible")
            self.assertEqual(
                WorkflowMessage.query.filter_by(
                    transaction_slug="withdrawal",
                    student_id=self.student_id,
                    visibility="student_visible",
                    previous_status="Dean Review",
                    new_status="Returned for Clarification",
                ).count(),
                1,
            )

            student_client = self._role_client(student_account_id, "student")
            response = student_client.post("/api/transactions/withdrawal/messages", json={
                "action_type": "response",
                "recipient_role": "Graduate School Staff",
                "template": "Please clarify request details",
                "comment": "The signed request form has been uploaded.",
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(application)
            db.session.refresh(message)
            self.assertEqual(application.status, "Returned for Clarification")
            self.assertEqual(message.status, "Open")
            response_message = WorkflowMessage.query.filter_by(
                student_id=self.student_id,
                action_type="response",
            ).first()
            self.assertEqual(response_message.status, "Sent")

            response = student_client.post("/api/student-portal/requests/withdrawal", json={
                "reason": application.reason,
                "effective_term": application.effective_term,
                "attachment_id": request_file.id,
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(application)
            db.session.refresh(message)
            db.session.refresh(request_file)
            self.assertEqual(application.status, "Submitted to GS Staff")
            self.assertEqual(application.reason, "Needs clarification test")
            self.assertEqual(application.request_attachment_id, request_file.id)
            self.assertEqual(message.status, "Responded")
            self.assertEqual(request_file.workflow_request_id, application.id)
            self.assertEqual(request_file.workflow_stage, "Withdrawal Application")
            self.assertEqual(request_file.uploaded_by_user_id, student_account_id)
            self.assertEqual(request_file.uploaded_by_role, "Student")

    def test_student_practicum_submission_is_locked_until_eligible(self):
        with app.app_context():
            attachment = self._attachment("practicum", "locked-moa")
            student_account = self._account("student", "student-practicum@example.test")
            student_account.student_id = self.student_id
            db.session.commit()

            response = self._role_client(student_account.id, "student").post(
                "/api/student-portal/requests/practicum",
                json={
                    "attachment_id": attachment.id,
                    "practicum_site": "Partner Site",
                },
            )
            self.assertEqual(response.status_code, 409, response.get_json())
            self.assertIsNone(PracticumRecord.query.filter_by(student_id=self.student_id).first())

    def test_request_files_are_scoped_to_student_and_workflow_role(self):
        with app.app_context():
            attachment = self._attachment("withdrawal", "private-request")
            student_account = self._account("student", "student-files@example.test")
            student_account.student_id = self.student_id
            other_record = Student(
                student_number="GS-2026-OTHER-FILE",
                first_name="Other",
                last_name="File Student",
                email="other-file@example.test",
                program_id=self.program_id,
                entry_year=2025,
                current_stage="Coursework",
                standing="Active",
            )
            db.session.add(other_record)
            db.session.flush()
            other_student = self._account("student", "other-student@example.test")
            other_student.student_id = other_record.id
            REQUEST_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
            stored_path = REQUEST_UPLOAD_ROOT / attachment.stored_name
            stored_path.write_bytes(b"%PDF-1.4\n%%EOF\n")
            self.created_files.append(stored_path)
            db.session.commit()

            response = self._role_client(other_student.id, "student").get(
                f"/api/student-request-attachments/{attachment.id}/file"
            )
            self.assertEqual(response.status_code, 403)

            response = self._research_client().get(
                f"/api/student-request-attachments/{attachment.id}/file"
            )
            self.assertEqual(response.status_code, 403)

            response = self._role_client(student_account.id, "student").get(
                f"/api/student-request-attachments/{attachment.id}/file"
            )
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.data.startswith(b"%PDF-"))
            response.close()
            staff_response = self._staff_client().get(
                f"/api/student-request-attachments/{attachment.id}/file"
            )
            self.assertEqual(staff_response.status_code, 200)
            staff_response.close()
            dean_response = self._dean_client().get(
                f"/api/student-request-attachments/{attachment.id}/file"
            )
            self.assertEqual(dean_response.status_code, 200)
            dean_response.close()

            stored_path.unlink()
            response = self._role_client(student_account.id, "student").get(
                f"/api/student-request-attachments/{attachment.id}/file"
            )
            self.assertEqual(response.status_code, 404)
            self.assertIn("unavailable", response.get_json()["error"].lower())

    def test_student_inbox_hides_internal_messages_and_tracks_read_state(self):
        with app.app_context():
            application = WithdrawalApplication(
                student_id=self.student_id,
                reason="Message privacy test",
                effective_term="AY 2026-2027 Term 1",
                status="Dean Review",
                dean_decision="Pending",
            )
            db.session.add(application)
            student_account = self._account("student", "student-inbox@example.test")
            student_account.student_id = self.student_id
            other_record = Student(
                student_number="GS-2026-OTHER-INBOX",
                first_name="Other",
                last_name="Inbox Student",
                email="other-inbox@example.test",
                program_id=self.program_id,
                entry_year=2025,
                current_stage="Coursework",
                standing="Active",
            )
            db.session.add(other_record)
            db.session.flush()
            other_account = self._account("student", "other-inbox-account@example.test")
            other_account.student_id = other_record.id
            db.session.commit()

            internal_response = self._staff_client().post("/api/transactions/withdrawal/messages", json={
                "student_id": self.student_id,
                "action_type": "note",
                "recipient_role": "Academic Coordinator",
                "visibility": "internal",
                "template": "This request requires additional review",
                "comment": "Internal reviewer concern.",
            })
            self.assertEqual(internal_response.status_code, 200, internal_response.get_json())
            internal = internal_response.get_json()["item"]
            self.assertEqual(internal["visibility"], "internal")
            self.assertEqual(internal["request_id"], application.id)
            self.assertEqual(internal["stage"], "Dean Review")
            self.assertEqual(internal["sender_user_id"], self.staff_id)

            visible_response = self._staff_client().post("/api/transactions/withdrawal/messages", json={
                "student_id": self.student_id,
                "action_type": "note",
                "recipient_role": "Student",
                "visibility": "student_visible",
                "template": "Please clarify the information entered in this section.",
                "comment": "Please confirm the requested effective term.",
            })
            self.assertEqual(visible_response.status_code, 200, visible_response.get_json())
            visible = visible_response.get_json()["item"]
            self.assertTrue(visible["is_unread"])

            student_client = self._role_client(student_account.id, "student")
            context_response = student_client.get("/api/student-portal/context")
            self.assertEqual(context_response.status_code, 200, context_response.get_json())
            inbox_ids = {item["id"] for item in context_response.get_json()["workflow_messages"]}
            self.assertIn(visible["id"], inbox_ids)
            self.assertNotIn(internal["id"], inbox_ids)
            student_log_notes = " ".join(
                item.get("notes") or ""
                for item in context_response.get_json()["logs"]
            )
            self.assertNotIn("Internal reviewer concern.", student_log_notes)
            internal_log = TransactionLog.query.filter(
                TransactionLog.notes.contains("Internal reviewer concern.")
            ).first()
            self.assertEqual(internal_log.visibility, "internal")

            read_response = student_client.post("/api/student-portal/messages/read", json={
                "message_ids": [internal["id"], visible["id"]],
            })
            self.assertEqual(read_response.status_code, 200, read_response.get_json())
            self.assertEqual(read_response.get_json()["message_ids"], [visible["id"]])
            db.session.refresh(db.session.get(WorkflowMessage, visible["id"]))
            self.assertIsNotNone(db.session.get(WorkflowMessage, visible["id"]).read_at)

            other_context = self._role_client(other_account.id, "student").get("/api/student-portal/context")
            self.assertEqual(other_context.status_code, 200, other_context.get_json())
            other_ids = {item["id"] for item in other_context.get_json()["workflow_messages"]}
            self.assertNotIn(visible["id"], other_ids)
            self.assertNotIn(internal["id"], other_ids)

    def test_reviewer_transition_creates_linked_student_notice_and_audit(self):
        with app.app_context():
            application = WithdrawalApplication(
                student_id=self.student_id,
                reason="Approval notice test",
                effective_term="AY 2026-2027 Term 1",
                status="Dean Review",
                dean_decision="Pending",
            )
            db.session.add(application)
            student_account = self._account("student", "student-notice@example.test")
            student_account.student_id = self.student_id
            db.session.commit()

            response = self._dean_client().post(
                f"/api/approvals/workflow/withdrawal/{application.id}/decide",
                json={"decision": "approve", "note": "Approved for follow-through."},
            )
            self.assertEqual(response.status_code, 200, response.get_json())
            notice = WorkflowMessage.query.filter_by(
                transaction_slug="withdrawal",
                student_id=self.student_id,
                action_type="notice",
            ).first()
            self.assertIsNotNone(notice)
            self.assertEqual(notice.workflow_request_id, application.id)
            self.assertEqual(notice.workflow_stage, "Approved - Follow-through")
            self.assertEqual(notice.visibility, "student_visible")
            audit = TransactionLog.query.filter_by(
                transaction_slug="withdrawal",
                student_id=self.student_id,
                new_status="Approved - Follow-through",
            ).order_by(TransactionLog.id.desc()).first()
            self.assertEqual(audit.workflow_request_id, application.id)
            self.assertEqual(audit.actor_user_id, self.dean_id)
            self.assertEqual(audit.action_type, "approve")

    def test_graduation_batch_skips_unverified_and_sends_eligible_candidates(self):
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            db.session.add(CourseRecord(student_id=student.id, course_id=self.course_id, status="Completed"))
            db.session.add(ResearchCase(
                student_id=student.id,
                case_type="Thesis",
                title="Batch-ready research",
                current_gate="Completion Evidence",
                status="Verified Complete",
            ))
            for item in required_documents_for_gate("Completion Evidence"):
                db.session.add(DocumentCheck(student_id=student.id, gate="Completion Evidence", item_name=item, status="Complete"))
            db.session.add(PracticumRecord(
                student_id=student.id,
                required_hours=200,
                completed_hours=200,
                document_status="Verified",
                completion_status="Completed and accepted",
                status="Dean Reviewed",
            ))
            db.session.commit()

            response = self._staff_client().post("/api/graduation/batch-actions", json={
                "student_ids": [student.id],
                "action": "send_to_dean",
                "review_window": "AY 2026-2027",
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            self.assertEqual(len(response.get_json()["updated"]), 1)
            endorsement = GraduationEndorsement.query.filter_by(student_id=student.id).first()
            self.assertEqual(endorsement.endorsement_status, "Ready for Dean Review")

            blocked_student = Student(
                student_number="GS-2026-BATCH-BLOCKED",
                first_name="Blocked",
                last_name="Candidate",
                email="batch-blocked@example.test",
                program_id=self.program_id,
                entry_year=2025,
                current_stage="Final Defense",
                standing="Active",
            )
            db.session.add(blocked_student)
            db.session.flush()
            blocked = GraduationEndorsement(
                student_id=blocked_student.id,
                review_window="AY 2026-2027",
                endorsement_status="For Review",
            )
            db.session.add(blocked)
            db.session.commit()

            response = self._dean_client().post("/api/graduation/batch-actions", json={
                "student_ids": [student.id, blocked_student.id],
                "action": "approve",
                "comment": "Approved in the Dean review batch.",
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            self.assertEqual(len(response.get_json()["updated"]), 1)
            self.assertEqual(len(response.get_json()["skipped"]), 1)
            db.session.refresh(endorsement)
            self.assertEqual(endorsement.endorsement_status, "Dean Approved")
            self.assertEqual(blocked.endorsement_status, "For Review")

            endorsement.endorsement_status = "Ready for Dean Review"
            db.session.commit()
            response = self._dean_client().post("/api/graduation/batch-actions", json={
                "student_ids": [student.id],
                "action": "return",
                "recipient_role": "Graduate School Staff",
                "comment": "",
            })
            self.assertEqual(response.status_code, 400, response.get_json())

    def test_staff_can_reset_each_demo_case_without_deleting_source_data(self):
        with app.app_context():
            self.student = db.session.get(Student, self.student_id)
            db.session.add(CourseRecord(student_id=self.student.id, course_id=self.course_id, status="Completed"))
            research = ResearchCase(
                student_id=self.student.id,
                case_type="Thesis",
                title="Source data kept after demo resets",
                current_gate="Completion Evidence",
                status="Verified Complete",
            )
            db.session.add(research)
            moa = self._attachment("practicum", "reset-moa")
            db.session.add(PracticumRecord(student_id=self.student.id, moa_attachment_id=moa.id, status="Dean Reviewed"))
            db.session.add(WithdrawalApplication(student_id=self.student.id, status="Withdrawn Confirmed", dean_decision="Approved"))
            db.session.add(GraduationEndorsement(student_id=self.student.id, endorsement_status="Sent to Registrar"))
            self.student.standing = "Withdrawn"
            self.student.current_stage = "Withdrawn"
            self.student.enrollment_tag = "Withdrawn"
            db.session.commit()

            dean_response = self._dean_client().post(
                "/api/transactions/practicum/demo-reset",
                json={"student_id": self.student.id},
            )
            self.assertEqual(dean_response.status_code, 403)

            staff = self._staff_client()
            for slug in ("practicum", "withdrawal", "graduation"):
                response = staff.post(f"/api/transactions/{slug}/demo-reset", json={"student_id": self.student.id})
                self.assertEqual(response.status_code, 200, response.get_json())

            self.assertIsNone(PracticumRecord.query.filter_by(student_id=self.student.id).first())
            self.assertIsNone(WithdrawalApplication.query.filter_by(student_id=self.student.id).first())
            self.assertIsNone(GraduationEndorsement.query.filter_by(student_id=self.student.id).first())
            self.assertIsNotNone(CourseRecord.query.filter_by(student_id=self.student.id).first())
            self.assertIsNotNone(ResearchCase.query.filter_by(student_id=self.student.id).first())
            db.session.refresh(self.student)
            self.assertEqual(self.student.standing, "Active")
            self.assertEqual(self.student.current_stage, "Final Defense")


if __name__ == "__main__":
    unittest.main()
