import os
import re
import tempfile
import unittest
from datetime import date
from io import BytesIO

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"

from app import (  # noqa: E402
    AcademicTerm,
    AdviserDocumentApproval,
    AwolCase,
    Course,
    CourseOffering,
    CourseOfferingPlan,
    CourseDropRequest,
    CurriculumOffering,
    CourseRecord,
    DefenseVerdict,
    DocumentCheck,
    Faculty,
    FacultyCoursePreference,
    Form1Endorsement,
    GraduationEndorsement,
    PanelAssignment,
    PracticumRecord,
    Program,
    ADVISER_APPROVAL_DOCUMENTS,
    RESEARCH_DEFENSE_RESULT_ITEMS,
    RESEARCH_DEFENSE_SCHEDULE_ITEMS,
    RESEARCH_GATE_DEFENSE_TYPES,
    ResearchCase,
    ResearchEvidenceFile,
    ResidencyEnrollment,
    ScheduleRequest,
    Student,
    SubjectEnrollment,
    StudentRequestAttachment,
    Task,
    TermEnrollment,
    TransactionLog,
    UserAccount,
    WorkflowMessage,
    WithdrawalApplication,
    REQUEST_UPLOAD_ROOT,
    UPLOAD_ROOT,
    app,
    awol_residency_roster_payload,
    compute_course_audit,
    curriculum_offerings_for_term,
    db,
    detected_research_progress,
    enrollment_integrity_payload,
    ensure_authoritative_curricula,
    get_active_term,
    student_current_course_year,
    graduation_eligibility,
    graduation_candidate_payload,
    ensure_demo_accounts,
    panel_roles_for_student,
    practicum_eligibility,
    required_documents_for_gate,
    research_requirement_presentation,
    seed_database,
    submitted_request_students,
    task_dict,
    workflow_approvals_payload,
    generate_password_hash,
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

    def _complete_research_gate_defenses(self, student):
        faculty = Faculty(
            name=f"{student.last_name} Panel Chair",
            college="Graduate School",
            role="Faculty",
            specialization="Graduate Research",
            email=f"panel-{student.id}@example.test",
            eligible_roles="Panel Chair,Content Specialist,Method Specialist,External Panel",
        )
        db.session.add(faculty)
        db.session.flush()
        if not Form1Endorsement.query.filter_by(student_id=student.id).first():
            db.session.add(Form1Endorsement(
                student_id=student.id,
                coordinator_name="Test Academic Coordinator",
                signature_data="data:image/png;base64,test",
                status="Endorsed",
            ))
            db.session.flush()

        evidence_index = 0

        for gate, defense_type in RESEARCH_GATE_DEFENSE_TYPES.items():
            system_items = {
                "Recommended panel set",
                RESEARCH_DEFENSE_SCHEDULE_ITEMS[gate],
                RESEARCH_DEFENSE_RESULT_ITEMS[gate],
            }
            for item_name in required_documents_for_gate(gate):
                doc = DocumentCheck(
                    student_id=student.id,
                    gate=gate,
                    item_name=item_name,
                    status="Complete",
                    evidence_reference="Test completion fixture",
                )
                db.session.add(doc)
                db.session.flush()
                if item_name in system_items:
                    continue
                if item_name in {"Academic Coordinator endorsement/e-signature", "Ethics clearance status and date"}:
                    continue
                file_count = 3 if item_name == "Three concept papers" else 1
                for file_number in range(file_count):
                    evidence_index += 1
                    evidence = ResearchEvidenceFile(
                        student_id=student.id,
                        document_check_id=doc.id,
                        original_name=f"{item_name} {file_number + 1}.pdf",
                        stored_name=f"test-research-{student.id}-{evidence_index}.pdf",
                        mime_type="application/pdf",
                    )
                    db.session.add(evidence)
                    db.session.flush()
                    db.session.add(AdviserDocumentApproval(
                        student_id=student.id,
                        evidence_file_id=evidence.id,
                        faculty_id=faculty.id,
                        adviser_name=faculty.name,
                        student_name=student.name,
                        document_name=item_name,
                        signature_data="data:image/png;base64,test",
                        status="Signed",
                    ))

            chair_assignment = None
            for panel_role in panel_roles_for_student(student):
                assignment = PanelAssignment(
                    student_id=student.id,
                    faculty_id=faculty.id,
                    gate=gate,
                    panel_role=panel_role,
                    score=100,
                    eligibility_note="Test panel assignment",
                )
                db.session.add(assignment)
                db.session.flush()
                if panel_role == "Panel Chair":
                    chair_assignment = assignment

            schedule = ScheduleRequest(
                student_id=student.id,
                preferred_date=date(2026, 8, 1),
                defense_type=defense_type,
                mode="In person",
                venue="Graduate School Conference Room",
                status="Confirmed",
                matched_count=len(panel_roles_for_student(student)),
                required_forms_status="Complete",
            )
            db.session.add(schedule)
            db.session.flush()
            db.session.add(DefenseVerdict(
                student_id=student.id,
                schedule_request_id=schedule.id,
                panel_assignment_id=chair_assignment.id,
                faculty_id=faculty.id,
                gate=gate,
                defense_type=defense_type,
                research_title="Completed research gate test",
                chair_name=faculty.name,
                result="Passed",
                defense_date=schedule.preferred_date,
            ))

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
            self._transition(staff, "practicum", {
                "student_id": self.student.id,
                "status": "MOA Under Review",
                "workflow_comment": "Please review the signed MOA with the Academic Coordinator.",
            })
            self.assertEqual(record.status, "MOA Under Review")
            forward_message = WorkflowMessage.query.filter_by(
                transaction_slug="practicum",
                student_id=self.student_id,
                recipient_role="Academic Coordinator",
                action_type="forward",
                new_status="MOA Under Review",
            ).order_by(WorkflowMessage.id.desc()).first()
            self.assertIsNotNone(forward_message)
            self.assertEqual(forward_message.visibility, "internal")
            self.assertIn("Please review the signed MOA", forward_message.comment)
            audit = TransactionLog.query.filter_by(
                transaction_slug="practicum",
                student_id=self.student_id,
                new_status="MOA Under Review",
            ).order_by(TransactionLog.id.desc()).first()
            self.assertIn("Reviewer comment: Please review the signed MOA", audit.notes)
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
            self._transition(staff, "withdrawal", {
                "student_id": self.student.id,
                "workflow_action": "forward_to_dean",
                "workflow_comment": "Recorded the request and forwarded the signed application to the Dean.",
            })
            dean_item = next(item for item in workflow_approvals_payload()["pending"] if item["id"] == application.id and item["type"] == "withdrawal")
            self.assertEqual(dean_item["workflow_status"], "Dean Review")

            return_response = self._dean_client().post(
                f"/api/approvals/workflow/withdrawal/{application.id}/decide",
                json={"decision": "return", "note": "This path is not in the withdrawal BPM."},
            )
            self.assertEqual(return_response.status_code, 400, return_response.get_json())
            response = self._dean_client().post(f"/api/approvals/workflow/withdrawal/{application.id}/decide", json={"decision": "approve"})
            self.assertEqual(response.status_code, 200)
            db.session.refresh(application)
            self.assertEqual(application.status, "Approved - Follow-through")
            self.assertTrue(Task.query.filter_by(student_id=self.student_id, owner_role="Graduate School Staff").filter(Task.title.contains("follow-through")).first())

            self._transition(staff, "withdrawal", {"student_id": self.student.id, "workflow_action": "coordinator_follow_through"}, 400)
            self._transition(staff, "withdrawal", {
                "student_id": self.student.id,
                "workflow_action": "confirm_withdrawal",
            }, 400)
            self._transition(staff, "withdrawal", {
                "student_id": self.student.id,
                "workflow_action": "confirm_withdrawal",
                "workflow_comment": "Effective AY 2026-2027 Term 1; Registrar and the program office were informed.",
            })
            self.assertEqual(application.status, "Withdrawn Confirmed")
            self.assertEqual(self.student.standing, "Withdrawn")
            self.assertIn("Registrar and the program office", application.staff_remarks)

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
            self.assertEqual(denied_student.enrollment_tag, "Enrolled")

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
            self._transition(staff, "graduation", {
                "student_id": self.student.id,
                "review_window": "AY 2026-2027",
                "endorsement_status": "Coursework Review",
                "workflow_comment": "AC, please validate this candidate's completed coursework.",
            })
            coursework_message = WorkflowMessage.query.filter_by(
                transaction_slug="graduation",
                student_id=self.student_id,
                recipient_role="Academic Coordinator",
                action_type="forward",
                new_status="Coursework Review",
            ).order_by(WorkflowMessage.id.desc()).first()
            self.assertIsNotNone(coursework_message)
            self.assertEqual(coursework_message.visibility, "internal")
            self.assertIn("validate this candidate", coursework_message.comment)
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
            self.assertEqual(endorsement.endorsement_status, "Dean Approved")
            self.assertEqual(endorsement.registrar_status, "Exported - Ready to Send")
            response = self._dean_client().post(
                "/api/graduation/registrar-handoff",
                data={
                    "endorsement_ids": str(endorsement.id),
                    "recipient_email": "registrar@gs.local",
                    "file": (BytesIO(response.data), "graduate-school-endorsed-list.csv"),
                },
                content_type="multipart/form-data",
            )
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(endorsement)
            # The send action is the terminal handoff. The Registrar remains external to the project.
            self.assertEqual(endorsement.registrar_status, "Sent - Awaiting Receipt")
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
            self._transition(staff, "graduation", {"student_id": self.student_id, "endorsement_status": "Not Eligible"}, 400)
            self._transition(staff, "graduation", {
                "student_id": self.student_id,
                "endorsement_status": "Not Eligible",
                "workflow_comment": "Complete the missing coursework before resubmitting your graduation application.",
            })
            not_eligible_notice = WorkflowMessage.query.filter_by(
                transaction_slug="graduation",
                student_id=self.student_id,
                recipient_role="Student",
                action_type="return",
                new_status="Not Eligible",
            ).order_by(WorkflowMessage.id.desc()).first()
            self.assertIsNotNone(not_eligible_notice)
            self.assertEqual(not_eligible_notice.visibility, "student_visible")
            self.assertIn("missing coursework", not_eligible_notice.comment)

            db.session.add(CourseRecord(student_id=self.student_id, course_id=self.course_id, status="Completed"))
            db.session.commit()
            self._transition(staff, "graduation", {"student_id": self.student_id, "endorsement_status": "Coursework Review"})
            self._transition(academic, "graduation", {"student_id": self.student_id, "endorsement_status": "Research Review"})
            self._transition(research, "graduation", {"student_id": self.student_id, "endorsement_status": "Eligibility Confirmed"})
            self.assertEqual(endorsement.endorsement_status, "Research Incomplete")
            self.assertTrue(Task.query.filter_by(student_id=self.student_id, owner_role="Graduate School Staff").filter(Task.title.contains("missing graduation research")).first())
            self._transition(staff, "graduation", {
                "student_id": self.student_id,
                "endorsement_status": "Not Eligible",
                "workflow_comment": "Finish the research gate requirements before resubmitting.",
            })
            self.assertEqual(endorsement.endorsement_status, "Not Eligible")

    def test_graduation_projects_research_workflow_progress_and_uses_it_for_roster_discovery(self):
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            student.current_stage = "Proposal Defense"
            db.session.add(ResearchCase(
                student_id=student.id,
                case_type="Thesis",
                title="Final-stage research evidence",
                current_gate="Final Defense",
                status="Complete",
            ))
            db.session.commit()

            eligibility = graduation_eligibility(student)
            self.assertEqual(
                [stage["name"] for stage in eligibility["research_progress"]["stages"]],
                ["Title Defense", "Proposal Defense", "Final Defense"],
            )
            final_stage = eligibility["research_progress"]["stages"][-1]
            self.assertIn("panel", final_stage)
            self.assertIn("schedule", final_stage)
            self.assertIn("defense", final_stage)
            self.assertFalse(eligibility["research_progress"]["research_gates_complete"])

            self._complete_research_gate_defenses(student)
            db.session.commit()
            eligibility = graduation_eligibility(student)
            self.assertTrue(eligibility["research_progress"]["research_gates_complete"])
            self.assertFalse(eligibility["research_progress"]["completion_evidence"]["complete"])
            self.assertEqual(eligibility["research_status"], "Complete")
            self.assertFalse(eligibility["eligible"])

            roster_ids = {row["student"]["id"] for row in graduation_candidate_payload()}
            self.assertNotIn(student.id, roster_ids)

    def test_student_completion_evidence_uploads_feed_graduation_checklist(self):
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            student.comprehensive_exam_status = "Passed"
            db.session.add(CourseRecord(student_id=student.id, course_id=self.course_id, status="Completed"))
            db.session.add(ResearchCase(
                student_id=student.id,
                case_type="Thesis",
                title="Post-defense completion evidence test",
                current_gate="Final Defense",
                status="Complete",
            ))
            self._complete_research_gate_defenses(student)
            student_account = self._account("student", "student-completion-evidence@example.test")
            student_account.student_id = student.id
            db.session.commit()

            progress = detected_research_progress(student)
            self.assertEqual(progress["stage"], "Completion")
            self.assertEqual(progress["gate"], "Completion Evidence")
            self.assertEqual(progress["milestone"]["student_missing_count"], 5)

            student_client = self._role_client(student_account.id, "student")
            for item_name in required_documents_for_gate("Completion Evidence"):
                response = student_client.post(
                    "/api/student-portal/research-evidence/upload",
                    data={
                        "gate": "Completion Evidence",
                        "item_name": item_name,
                        "file": (BytesIO(b"%PDF-1.4\ncompletion evidence\n%%EOF\n"), f"{item_name}.pdf"),
                    },
                    content_type="multipart/form-data",
                )
                self.assertEqual(response.status_code, 200, response.get_json())
                stored_name = ResearchEvidenceFile.query.order_by(ResearchEvidenceFile.id.desc()).first().stored_name
                self.created_files.append(REQUEST_UPLOAD_ROOT / stored_name)

            progress = detected_research_progress(student)
            self.assertEqual(progress["stage"], "Completion")
            self.assertTrue(progress["milestone"]["student_uploads_ready"])
            self.assertEqual(progress["milestone"]["student_missing_count"], 0)
            self.assertFalse(graduation_eligibility(student)["research_progress"]["completion_evidence"]["complete"])

            response = student_client.post("/api/student-portal/requests/research-gate", json={
                "student_id": student.id,
                "submitted_package": "Final post-defense completion package uploaded.",
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            research_case = ResearchCase.query.filter_by(student_id=student.id).order_by(ResearchCase.opened_at.desc()).first()
            self.assertEqual(research_case.current_gate, "Completion Evidence")
            self.assertEqual(research_case.status, "Awaiting Review")

            self._transition(self._research_client(), "research-gate", {"student_id": student.id})
            db.session.refresh(research_case)
            eligibility = graduation_eligibility(student)
            self.assertEqual(research_case.current_gate, "Completion Evidence")
            self.assertEqual(research_case.status, "Verified Complete")
            self.assertTrue(eligibility["research_progress"]["completion_evidence"]["complete"])
            self.assertEqual(eligibility["research_progress"]["completion_evidence"]["requirements_complete"], 5)

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

    def test_course_adjustments_manual_selection_publishes_to_curriculum_planning(self):
        with app.app_context():
            term = AcademicTerm(
                label="AY 2026-2027 1st Semester",
                start_date=date(2026, 8, 1),
                end_date=date(2026, 12, 15),
                is_active_planning_term=True,
            )
            db.session.add(term)
            db.session.commit()

            academic = self._academic_client()
            payload = academic.get(
                f"/api/course-adjustments?program_id={self.program_id}&term_id={term.id}"
            )
            self.assertEqual(payload.status_code, 200, payload.get_json())
            self.assertTrue(payload.get_json()["permissions"]["can_manage"])
            manual_row = next(
                row
                for row in payload.get_json()["demand"]
                if row["course"]["id"] == self.course_id
            )
            self.assertEqual(manual_row["demand_count"], 0)
            self.assertEqual(manual_row["selection_source"], "Manual")

            staff_payload = self._staff_client().get(
                f"/api/course-adjustments?program_id={self.program_id}&term_id={term.id}"
            )
            self.assertFalse(staff_payload.get_json()["permissions"]["can_manage"])

            draft = academic.post("/api/course-adjustments/plan", json={
                "program_id": self.program_id,
                "term_id": term.id,
                "action": "draft",
                "selections": [{
                    "course_id": self.course_id,
                    "offer": True,
                    "section_count": 1,
                    "notes": "Manual coordinator decision",
                }],
            })
            self.assertEqual(draft.status_code, 200, draft.get_json())
            plan_id = draft.get_json()["data"]["latest_plan"]["id"]

            submitted = academic.post("/api/course-adjustments/plan", json={
                "program_id": self.program_id,
                "term_id": term.id,
                "action": "submit",
            })
            self.assertEqual(submitted.status_code, 200, submitted.get_json())

            approved = self._dean_client().post(
                f"/api/approvals/{plan_id}/decide",
                json={"decision": "approve", "note": "Approved for publication"},
            )
            self.assertEqual(approved.status_code, 200, approved.get_json())

            published = academic.post("/api/course-adjustments/plan", json={
                "program_id": self.program_id,
                "term_id": term.id,
                "action": "publish",
            })
            self.assertEqual(published.status_code, 200, published.get_json())
            self.assertIn("Curriculum Planning", published.get_json()["message"])
            offering = CurriculumOffering.query.filter_by(
                program_id=self.program_id,
                academic_year="2026-2027",
                semester="1st Semester",
                course_id=self.course_id,
            ).first()
            self.assertIsNotNone(offering)
            self.assertIn("Course Adjustments plan", offering.added_by)

    def test_one_student_demand_lists_full_delay_impact(self):
        with app.app_context():
            term = AcademicTerm(
                label="AY 2026-2027 1st Semester",
                start_date=date(2026, 8, 1),
                end_date=date(2026, 12, 15),
                is_active_planning_term=True,
            )
            db.session.add(term)
            db.session.flush()
            db.session.add(TermEnrollment(
                student_id=self.student_id,
                term_id=term.id,
                status="Enrolled",
                source_reference="Demand test",
            ))
            db.session.commit()

            response = self._academic_client().get(
                f"/api/course-adjustments?program_id={self.program_id}&term_id={term.id}"
            )
            self.assertEqual(response.status_code, 200, response.get_json())
            row = next(item for item in response.get_json()["demand"] if item["course"]["id"] == self.course_id)
            self.assertEqual(row["demand_count"], 1)
            self.assertEqual(row["demand_status"], "meets_minimum")
            self.assertEqual(row["affected_count"], 1)
            self.assertEqual(row["delayed_count"], 1)
            self.assertEqual(row["affected_students"][0]["student_number"], "GS-2026-TEST")
            self.assertTrue(row["affected_students"][0]["will_be_delayed"])

    def test_faculty_preference_drives_automatic_assignment_with_24_unit_limit(self):
        with app.app_context():
            term = AcademicTerm(
                label="AY 2026-2027 1st Semester",
                start_date=date(2026, 8, 1),
                end_date=date(2026, 12, 15),
                is_active_planning_term=True,
            )
            faculty = Faculty(
                name="Preferred Teacher",
                college="Graduate School",
                role="Faculty",
                specialization="Completion Course",
                email="preferred-teacher@example.test",
                active=True,
            )
            db.session.add_all([term, faculty])
            db.session.flush()
            db.session.add(FacultyCoursePreference(
                faculty_id=faculty.id, course_id=self.course_id, priority=1
            ))
            db.session.commit()

            draft = self._academic_client().post("/api/course-adjustments/plan", json={
                "program_id": self.program_id,
                "term_id": term.id,
                "action": "draft",
                "selections": [{"course_id": self.course_id, "offer": True, "section_count": 1}],
            })
            self.assertEqual(draft.status_code, 200, draft.get_json())
            offering = CourseOffering.query.filter_by(course_id=self.course_id).first()
            self.assertEqual(offering.assigned_faculty_id, faculty.id)
            self.assertEqual(offering.assignment_status, "Proposed")
            self.assertLessEqual((offering.course.units or 3) * offering.section_count, 24)

            submitted = self._academic_client().post("/api/course-adjustments/plan", json={
                "program_id": self.program_id, "term_id": term.id, "action": "submit",
            })
            self.assertEqual(submitted.status_code, 200, submitted.get_json())
            db.session.refresh(offering)
            self.assertEqual(offering.assignment_status, "Pending Approval")
            plan = CourseOfferingPlan.query.get(offering.plan_id)
            approved = self._dean_client().post(
                f"/api/approvals/{plan.id}/decide", json={"decision": "approve"}
            )
            self.assertEqual(approved.status_code, 200, approved.get_json())
            db.session.refresh(offering)
            self.assertEqual(offering.assignment_status, "Approved")

    def test_student_curriculum_checklist_adds_and_drops_without_approval(self):
        with app.app_context():
            term = AcademicTerm(
                label="AY 2026-2027 1st Semester",
                start_date=date(2026, 8, 1),
                end_date=date(2026, 12, 15),
                is_active_planning_term=True,
            )
            db.session.add(term)
            db.session.flush()
            db.session.add(CurriculumOffering(
                program_id=self.program_id,
                academic_year="2026-2027",
                semester="1st Semester",
                course_id=self.course_id,
                added_by="Test",
            ))
            account = UserAccount(
                email="checklist-student@example.test",
                full_name="Checklist Student",
                password_hash=generate_password_hash("test-password"),
                role="student",
                student_id=self.student_id,
                active=True,
            )
            db.session.add(account)
            db.session.commit()
            client = self._role_client(account.id, "student")

            added = client.post("/api/student-portal/enrollment", json={
                "term_id": term.id, "course_ids": [self.course_id],
            })
            self.assertEqual(added.status_code, 200, added.get_json())
            enrollment = SubjectEnrollment.query.filter_by(
                student_id=self.student_id, course_id=self.course_id, term_id=term.id
            ).first()
            self.assertEqual(enrollment.status, "Enrolled")

            dropped = client.post("/api/student-portal/enrollment", json={
                "term_id": term.id, "course_ids": [],
            })
            self.assertEqual(dropped.status_code, 200, dropped.get_json())
            db.session.refresh(enrollment)
            self.assertEqual(enrollment.status, "Dropped")
            self.assertEqual(CourseDropRequest.query.filter_by(student_id=self.student_id).first().status, "Recorded")

    def test_authoritative_curricula_and_derived_course_year(self):
        with app.app_context():
            term = AcademicTerm(
                label="AY 2026-2027 1st Semester",
                start_date=date(2026, 8, 1),
                end_date=date(2026, 12, 15),
                is_active_planning_term=True,
            )
            db.session.add(term)
            db.session.commit()
            ensure_authoritative_curricula()
            mba = Program.query.filter_by(code="MBA").first()
            dpsy = Program.query.filter_by(code="DPSY").first()
            self.assertIsNotNone(mba)
            self.assertIsNotNone(dpsy)
            self.assertEqual(Course.query.filter_by(program_id=mba.id, code="MBA220").one().title, "Project Paper")
            self.assertEqual(Course.query.filter_by(program_id=dpsy.id, code="DPSY311").one().units, 5)
            student = db.session.get(Student, self.student_id)
            self.assertEqual(student_current_course_year(student, term), 2)

    def test_student_assistant_rejects_staff_only_questions(self):
        with app.app_context():
            account = UserAccount(
                email="assistant-student@example.test",
                full_name="Assistant Student",
                password_hash=generate_password_hash("test-password"),
                role="student",
                student_id=self.student_id,
                active=True,
            )
            db.session.add(account)
            db.session.commit()
            response = self._role_client(account.id, "student").post(
                "/api/student-portal/assistant", json={"question": "Show me all students and staff notes"}
            )
            self.assertEqual(response.status_code, 200, response.get_json())
            self.assertIn("cannot access other students", response.get_json()["answer"])

    def test_enrollment_syncs_ledger_monitoring_profile_and_course_audit(self):
        with app.app_context():
            term = AcademicTerm(
                label="AY 2026-2027 1st Semester",
                start_date=date(2026, 8, 1),
                end_date=date(2026, 12, 15),
            )
            db.session.add(term)
            db.session.flush()
            db.session.add(CurriculumOffering(
                program_id=self.program_id,
                academic_year="2026-2027",
                semester="1st Semester",
                course_id=self.course_id,
                added_by="Test",
            ))
            db.session.commit()

            academic = self._academic_client()
            preview = academic.post("/api/enrollment/preview", json={
                "student_id": self.student_id,
                "term_id": term.id,
                "course_ids": [self.course_id],
            })
            self.assertEqual(preview.status_code, 200, preview.get_json())
            self.assertEqual(preview.get_json()["conflict_count"], 0)
            self.assertEqual(len(preview.get_json()["additions"]), 1)

            response = academic.post("/api/enrollment", json={
                "student_id": self.student_id,
                "term_id": term.id,
                "course_ids": [self.course_id],
                "resolutions": {},
                "source_reference": "Enrollment test",
                "confirmed": True,
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            self.assertEqual(response.get_json()["integrity"]["issue_count"], 0)
            enrollment = SubjectEnrollment.query.filter_by(
                student_id=self.student_id,
                course_id=self.course_id,
                term_id=term.id,
            ).first()
            self.assertIsNotNone(enrollment)
            self.assertEqual(enrollment.status, "Enrolled")
            record = CourseRecord.query.filter_by(
                student_id=self.student_id,
                course_id=self.course_id,
            ).first()
            self.assertEqual(record.status, "Enrolled")
            self.assertEqual(record.term_label, term.label)
            semester = TermEnrollment.query.filter_by(
                student_id=self.student_id,
                term_id=term.id,
            ).first()
            self.assertEqual(semester.status, "Enrolled")

            profile = academic.get(f"/api/students/{self.student_id}")
            self.assertEqual(profile.status_code, 200, profile.get_json())
            self.assertEqual(
                profile.get_json()["subject_enrollments"][0]["course_code"],
                "BPM-501",
            )
            monitoring = academic.get(
                f"/api/monitoring/grid?program_id={self.program_id}&term_id={term.id}"
            )
            self.assertEqual(monitoring.status_code, 200, monitoring.get_json())
            student_row = next(
                row for row in monitoring.get_json()["students"]
                if row["id"] == self.student_id
            )
            self.assertEqual(student_row["cells"][str(self.course_id)], "Enrolled")
            self.assertEqual(student_row["academic_year_entry"], "25-26")
            self.assertEqual(student_row["year_level"], "1")

            response = academic.post("/api/course-audit/roster", json={
                "course_id": self.course_id,
                "term": term.label,
                "statuses": {str(self.student_id): "Completed"},
                "grades": {str(self.student_id): "1.25"},
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(enrollment)
            self.assertEqual(enrollment.status, "Completed")

    def test_enrollment_workspace_uses_monitoring_status_for_subject_eligibility(self):
        with app.app_context():
            term = AcademicTerm(
                label="AY 2026-2027 1st Semester",
                start_date=date(2026, 8, 1),
                end_date=date(2026, 12, 15),
            )
            enrolled_course = Course(
                program_id=self.program_id,
                code="BPM-502",
                title="Already Enrolled Course",
                units=3,
                category="Major",
            )
            missing_course = Course(
                program_id=self.program_id,
                code="BPM-503",
                title="Not Taken Course",
                units=3,
                category="Major",
            )
            db.session.add_all([term, enrolled_course, missing_course])
            db.session.flush()
            term_id = term.id
            completed_course_id = self.course_id
            enrolled_course_id = enrolled_course.id
            missing_course_id = missing_course.id
            db.session.add_all([
                CourseRecord(
                    student_id=self.student_id,
                    course_id=completed_course_id,
                    status="Completed",
                    evidence_reference="Monitoring import",
                ),
                CourseRecord(
                    student_id=self.student_id,
                    course_id=enrolled_course_id,
                    status="Enrolled",
                    evidence_reference="Monitoring import",
                ),
                CourseRecord(
                    student_id=self.student_id,
                    course_id=missing_course_id,
                    status="Missing",
                    evidence_reference="Monitoring import",
                ),
            ])
            for course_id in [
                completed_course_id,
                enrolled_course_id,
                missing_course_id,
            ]:
                db.session.add(CurriculumOffering(
                    program_id=self.program_id,
                    academic_year="2026-2027",
                    semester="1st Semester",
                    course_id=course_id,
                    added_by="Test",
                ))
            db.session.commit()

            academic = self._academic_client()
            workspace = academic.get(
                f"/api/enrollment?program_id={self.program_id}"
                f"&term_id={term_id}&student_id={self.student_id}"
            )
            self.assertEqual(workspace.status_code, 200, workspace.get_json())
            payload = workspace.get_json()
            subjects = {
                item["code"]: item for item in payload["curriculum_subjects"]
            }
            self.assertEqual(subjects["BPM-501"]["enrollment_state"], "completed")
            self.assertFalse(subjects["BPM-501"]["selectable"])
            self.assertEqual(
                subjects["BPM-502"]["enrollment_state"],
                "enrolled_current",
            )
            self.assertFalse(subjects["BPM-502"]["selectable"])
            self.assertIn(enrolled_course_id, payload["current_course_ids"])
            self.assertEqual(subjects["BPM-503"]["enrollment_state"], "available")
            self.assertTrue(subjects["BPM-503"]["selectable"])
            self.assertEqual(payload["subject_status_summary"], {
                "available": 1,
                "completed": 1,
                "enrolled": 1,
                "enrolled_other_term": 0,
                "requires_resolution": 0,
            })

            completed_preview = academic.post("/api/enrollment/preview", json={
                "student_id": self.student_id,
                "term_id": term_id,
                "course_ids": [completed_course_id],
            })
            self.assertEqual(completed_preview.status_code, 200)
            self.assertTrue(completed_preview.get_json()["has_blocking_conflicts"])
            self.assertEqual(
                completed_preview.get_json()["conflicts"][0]["kind"],
                "already_completed",
            )

            valid_ids = [enrolled_course_id, missing_course_id]
            preview = academic.post("/api/enrollment/preview", json={
                "student_id": self.student_id,
                "term_id": term_id,
                "course_ids": valid_ids,
            })
            self.assertEqual(preview.status_code, 200, preview.get_json())
            self.assertEqual(preview.get_json()["conflict_count"], 0)
            self.assertEqual(
                [item["course_id"] for item in preview.get_json()["additions"]],
                [missing_course_id],
            )
            self.assertEqual(preview.get_json()["unchanged_count"], 1)

            saved = academic.post("/api/enrollment", json={
                "student_id": self.student_id,
                "term_id": term_id,
                "course_ids": valid_ids,
                "resolutions": {},
                "source_reference": "Monitoring synchronization test",
                "confirmed": True,
            })
            self.assertEqual(saved.status_code, 200, saved.get_json())
            self.assertEqual(saved.get_json()["added"], 1)
            completed_record = CourseRecord.query.filter_by(
                student_id=self.student_id,
                course_id=completed_course_id,
            ).one()
            self.assertEqual(completed_record.status, "Completed")
            self.assertEqual(
                CourseRecord.query.filter_by(
                    student_id=self.student_id,
                    course_id=enrolled_course_id,
                ).one().status,
                "Enrolled",
            )
            self.assertEqual(
                CourseRecord.query.filter_by(
                    student_id=self.student_id,
                    course_id=missing_course_id,
                ).one().status,
                "Enrolled",
            )
            self.assertEqual(
                SubjectEnrollment.query.filter_by(
                    student_id=self.student_id,
                    term_id=term_id,
                ).count(),
                2,
            )

    def test_enrollment_requires_resolution_for_non_offered_subject(self):
        with app.app_context():
            term = AcademicTerm(
                label="AY 2026-2027 2nd Semester",
                start_date=date(2027, 1, 10),
                end_date=date(2027, 5, 20),
            )
            db.session.add(term)
            db.session.commit()
            academic = self._academic_client()

            preview = academic.post("/api/enrollment/preview", json={
                "student_id": self.student_id,
                "term_id": term.id,
                "course_ids": [self.course_id],
            })
            self.assertEqual(preview.status_code, 200, preview.get_json())
            conflict = next(
                item for item in preview.get_json()["conflicts"]
                if item["kind"] == "not_offered"
            )

            blocked = academic.post("/api/enrollment", json={
                "student_id": self.student_id,
                "term_id": term.id,
                "course_ids": [self.course_id],
                "resolutions": {},
                "confirmed": True,
            })
            self.assertEqual(blocked.status_code, 409, blocked.get_json())

            saved = academic.post("/api/enrollment", json={
                "student_id": self.student_id,
                "term_id": term.id,
                "course_ids": [self.course_id],
                "resolutions": {conflict["id"]: "enroll_override"},
                "source_reference": "Approved exception test",
                "confirmed": True,
            })
            self.assertEqual(saved.status_code, 200, saved.get_json())
            enrollment = SubjectEnrollment.query.filter_by(
                student_id=self.student_id,
                course_id=self.course_id,
                term_id=term.id,
            ).first()
            self.assertIn("enroll_override", enrollment.conflict_override)
            self.assertEqual(saved.get_json()["integrity"]["issue_count"], 0)

    def test_academic_semester_removal_keeps_referenced_history(self):
        with app.app_context():
            unused = AcademicTerm(
                label="AY 2030-2031 1st Semester",
                start_date=date(2030, 8, 1),
                end_date=date(2030, 12, 15),
            )
            referenced = AcademicTerm(
                label="AY 2030-2031 2nd Semester",
                start_date=date(2031, 1, 10),
                end_date=date(2031, 5, 20),
            )
            db.session.add_all([unused, referenced])
            db.session.flush()
            db.session.add(TermEnrollment(
                student_id=self.student_id,
                term_id=referenced.id,
                status="Confirmed",
                source_reference="History test",
            ))
            db.session.commit()
            staff = self._staff_client()

            removed = staff.delete(
                f"/api/admin/terms/{unused.id}",
                json={"confirmed_label": unused.label},
            )
            self.assertEqual(removed.status_code, 200, removed.get_json())
            self.assertIsNone(db.session.get(AcademicTerm, unused.id))

            blocked = staff.delete(
                f"/api/admin/terms/{referenced.id}",
                json={"confirmed_label": referenced.label},
            )
            self.assertEqual(blocked.status_code, 409, blocked.get_json())
            self.assertIsNotNone(db.session.get(AcademicTerm, referenced.id))

    def test_course_drop_is_recorded_immediately_without_reason_or_approval(self):
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
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(record)
            self.assertEqual(record.status, "Dropped")
            drop = CourseDropRequest.query.filter_by(student_id=self.student_id, course_id=self.course_id).first()
            self.assertEqual(drop.status, "Recorded")
            self.assertIsNone(drop.reason)
            task = Task.query.filter_by(student_id=self.student_id, owner_role="Academic Coordinator").filter(Task.title.contains("Review course drop request")).first()
            self.assertIsNone(task)

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
            "staff@usls.edu.ph": "staff",
            "academic@usls.edu.ph": "academic_coordinator",
            "research@usls.edu.ph": "research_coordinator",
        }
        for email, role in expected.items():
            response = app.test_client().post(
                "/api/auth/login",
                json={"role": "staff", "email": email, "password": "DemoPass123!"},
            )
            self.assertEqual(response.status_code, 200, response.get_json())
            self.assertEqual(response.get_json()["user"]["role"], role)

    def test_workflow_demo_students_quick_login_and_central_reset(self):
        with app.app_context():
            seed_database()

        response = app.test_client().get("/api/auth/demo-students")
        self.assertEqual(response.status_code, 200, response.get_json())
        items = response.get_json()["items"]
        self.assertEqual(len(items), 6)
        self.assertEqual(sum(item["workflow"] == "practicum" for item in items), 2)
        self.assertEqual(sum(item["workflow"] == "graduation" for item in items), 2)
        self.assertEqual(sum(item["workflow"] == "withdrawal" for item in items), 2)

        for item in items:
            student_client = app.test_client()
            login_response = student_client.post("/api/auth/login", json={
                "role": "student",
                "email": item["email"],
                "password": item["password"],
            })
            self.assertEqual(login_response.status_code, 200, login_response.get_json())
            self.assertEqual(login_response.get_json()["user"]["role"], "student")
            if item["workflow"] == "practicum":
                portal_response = student_client.get("/api/student-portal/context")
                self.assertEqual(portal_response.status_code, 200, portal_response.get_json())
                portal_eligibility = portal_response.get_json()["practicum_eligibility"]
                self.assertTrue(portal_eligibility["eligible"], item["name"])
                self.assertTrue(
                    all(check["passed"] is True for check in portal_eligibility["checklist"]),
                    item["name"],
                )
            elif item["workflow"] == "withdrawal":
                portal_response = student_client.get("/api/student-portal/context")
                self.assertEqual(portal_response.status_code, 200, portal_response.get_json())
                portal_student = portal_response.get_json()["student"]
                self.assertEqual(portal_student["standing"], "Active")
                self.assertEqual(portal_student["current_stage"], "Coursework")
                self.assertIsNone(portal_response.get_json()["withdrawal_application"])

        practicum_items = [item for item in items if item["workflow"] == "practicum"]
        practicum_item = practicum_items[0]
        graduation_item = next(item for item in items if item["workflow"] == "graduation")
        withdrawal_item = next(item for item in items if item["workflow"] == "withdrawal")
        with app.app_context():
            practicum_student = Student.query.filter_by(student_number=practicum_item["student_number"]).one()
            graduation_student = Student.query.filter_by(student_number=graduation_item["student_number"]).one()
            withdrawal_student = Student.query.filter_by(student_number=withdrawal_item["student_number"]).one()
            for item in practicum_items:
                demo_student = Student.query.filter_by(student_number=item["student_number"]).one()
                practicum_status = practicum_eligibility(demo_student)
                self.assertTrue(practicum_status["eligible"], demo_student.name)
                self.assertTrue(
                    all(check["passed"] is True for check in practicum_status["checklist"]),
                    demo_student.name,
                )
                self.assertGreaterEqual(practicum_status["basic_units_completed"], 6)
                self.assertGreaterEqual(practicum_status["major_units_completed"], 9)
                self.assertGreaterEqual(practicum_status["cognate_units_completed"], 6)
                self.assertGreaterEqual(practicum_status["total_units_completed"], 21)
                practicum_research = ResearchCase.query.filter_by(student_id=demo_student.id).one()
                self.assertEqual(practicum_research.current_gate, "Completion Evidence")
                self.assertEqual(practicum_research.status, "Verified Complete")
            self.assertTrue(graduation_eligibility(graduation_student)["eligible"])
            current_withdrawal_courses = [
                record.course.code
                for record in CourseRecord.query.filter_by(student_id=withdrawal_student.id, status="Current").all()
            ]
            self.assertEqual(current_withdrawal_courses, ["MAED-MAJ1"])
            self.assertEqual(withdrawal_student.standing, "Active")
            self.assertEqual(withdrawal_student.enrollment_tag, "Enrolled")

            attachment = StudentRequestAttachment(
                student_id=practicum_student.id,
                request_type="practicum",
                original_name="demo-certificate.pdf",
                stored_name="workflow-demo-reset-certificate.pdf",
            )
            db.session.add(attachment)
            db.session.flush()
            db.session.add(PracticumRecord(
                student_id=practicum_student.id,
                required_hours=200,
                completed_hours=40,
                certificate_attachment_id=attachment.id,
                status="Certificate Review",
            ))
            db.session.add(WorkflowMessage(
                transaction_slug="practicum",
                student_id=practicum_student.id,
                sender_role="student",
                sender_name=practicum_student.name,
                recipient_role="staff",
                template="Student remark",
                comment="Please review my practicum certificate.",
            ))
            db.session.add(TransactionLog(
                transaction_slug="practicum",
                student_id=practicum_student.id,
                actor_role="Student",
                result="Practicum certificate submitted",
            ))
            db.session.add(Task(
                student_id=practicum_student.id,
                title="Review practicum certificate",
                owner_role="Academic Coordinator",
                due_at=date.today(),
            ))
            db.session.add(GraduationEndorsement(
                student_id=graduation_student.id,
                endorsement_status="Ready for Dean Review",
            ))
            withdrawal_attachment = StudentRequestAttachment(
                student_id=withdrawal_student.id,
                request_type="withdrawal",
                original_name="demo-withdrawal-request.pdf",
                stored_name="workflow-demo-reset-withdrawal.pdf",
            )
            db.session.add(withdrawal_attachment)
            db.session.flush()
            withdrawal_application = WithdrawalApplication(
                student_id=withdrawal_student.id,
                reason="Withdrawal workflow demonstration",
                effective_term="AY 2026-2027 1st Semester",
                request_attachment_id=withdrawal_attachment.id,
                status="Approved - Follow-through",
                dean_decision="Approved",
                requirement_status="Not Applicable",
            )
            db.session.add(withdrawal_application)
            db.session.add(WorkflowMessage(
                transaction_slug="withdrawal",
                student_id=withdrawal_student.id,
                sender_role="Graduate School Staff",
                sender_name="Test Staff",
                recipient_role="Dean",
                template="Withdrawal request forwarded",
                comment="Please review the withdrawal application.",
            ))
            db.session.add(TransactionLog(
                transaction_slug="withdrawal",
                student_id=withdrawal_student.id,
                actor_role="Graduate School Staff",
                result="Withdrawal request forwarded to Dean",
            ))
            db.session.add(Task(
                student_id=withdrawal_student.id,
                title="Perform withdrawal follow-through actions",
                owner_role="Graduate School Staff",
                due_at=date.today(),
            ))
            db.session.commit()
            practicum_student_id = practicum_student.id
            graduation_student_id = graduation_student.id
            withdrawal_student_id = withdrawal_student.id

        reset_response = app.test_client().post(
            f"/api/auth/demo-students/{practicum_item['key']}/reset",
            json={},
        )
        self.assertEqual(reset_response.status_code, 200, reset_response.get_json())
        self.assertEqual(reset_response.get_json()["records_removed"], 1)
        self.assertEqual(reset_response.get_json()["messages_removed"], 1)

        reset_response = app.test_client().post(
            f"/api/auth/demo-students/{withdrawal_item['key']}/reset",
            json={},
        )
        self.assertEqual(reset_response.status_code, 200, reset_response.get_json())
        self.assertEqual(reset_response.get_json()["records_removed"], 1)
        self.assertEqual(reset_response.get_json()["messages_removed"], 1)

        reset_response = app.test_client().post(
            f"/api/auth/demo-students/{graduation_item['key']}/reset",
            json={},
        )
        self.assertEqual(reset_response.status_code, 200, reset_response.get_json())
        self.assertEqual(reset_response.get_json()["records_removed"], 1)

        with app.app_context():
            practicum_student = db.session.get(Student, practicum_student_id)
            graduation_student = db.session.get(Student, graduation_student_id)
            withdrawal_student = db.session.get(Student, withdrawal_student_id)
            self.assertIsNone(PracticumRecord.query.filter_by(student_id=practicum_student_id).first())
            self.assertIsNone(StudentRequestAttachment.query.filter_by(student_id=practicum_student_id, request_type="practicum").first())
            self.assertIsNone(WorkflowMessage.query.filter_by(student_id=practicum_student_id, transaction_slug="practicum").first())
            self.assertIsNone(TransactionLog.query.filter_by(student_id=practicum_student_id, transaction_slug="practicum").first())
            self.assertIsNone(Task.query.filter_by(student_id=practicum_student_id, title="Review practicum certificate").first())
            self.assertTrue(practicum_eligibility(practicum_student)["eligible"])
            self.assertEqual(practicum_student.current_stage, "Final Defense")

            self.assertIsNone(GraduationEndorsement.query.filter_by(student_id=graduation_student_id).first())
            self.assertIsNotNone(PracticumRecord.query.filter_by(student_id=graduation_student_id).first())
            self.assertTrue(graduation_eligibility(graduation_student)["eligible"])
            self.assertEqual(graduation_student.current_stage, "Completed")

            self.assertIsNone(WithdrawalApplication.query.filter_by(student_id=withdrawal_student_id).first())
            self.assertIsNone(StudentRequestAttachment.query.filter_by(student_id=withdrawal_student_id, request_type="withdrawal").first())
            self.assertIsNone(WorkflowMessage.query.filter_by(student_id=withdrawal_student_id, transaction_slug="withdrawal").first())
            self.assertIsNone(TransactionLog.query.filter_by(student_id=withdrawal_student_id, transaction_slug="withdrawal").first())
            self.assertIsNone(Task.query.filter_by(student_id=withdrawal_student_id, title="Perform withdrawal follow-through actions").first())
            self.assertEqual(withdrawal_student.standing, "Active")
            self.assertEqual(withdrawal_student.enrollment_tag, "Enrolled")
            self.assertEqual(withdrawal_student.current_stage, "Coursework")
            self.assertEqual(
                [record.course.code for record in CourseRecord.query.filter_by(student_id=withdrawal_student_id, status="Current").all()],
                ["MAED-MAJ1"],
            )

    def test_maed_monitoring_sheet_seeds_all_policy_valid_demo_personas(self):
        with app.app_context():
            seed_database()

            program = Program.query.filter_by(code="MAED").one()
            active_term = get_active_term()
            all_students = {
                student.student_number: student
                for student in Student.query.filter_by(program_id=program.id).all()
            }
            self.assertEqual(len(all_students), 17)
            students = {
                student_number: student
                for student_number, student in all_students.items()
                if re.fullmatch(r"\d{7}", student_number)
            }
            self.assertEqual(len(students), 11)
            self.assertTrue(all(
                re.fullmatch(r"\d{7}", student.student_number)
                for student in students.values()
            ))
            self.assertTrue(all(
                student.academic_year_entry and student.year_level
                for student in students.values()
            ))
            self.assertTrue(active_term.is_active_planning_term)
            self.assertEqual(
                enrollment_integrity_payload(program, active_term)["issue_count"],
                0,
            )
            self.assertEqual(SubjectEnrollment.query.count(), 0)

            expected_completed = {
                "2560001": 0,
                "2560002": 3,
                "2460003": 9,
                "2260004": 18,
                "2460005": 6,
                "2360006": 12,
                "2260007": 18,
                "2360008": 18,
                "2460009": 9,
                "2360010": 6,
                "2260011": 18,
            }
            for student_number, completed_count in expected_completed.items():
                audit = compute_course_audit(students[student_number])
                self.assertEqual(
                    len(audit["completed"]),
                    completed_count,
                    student_number,
                )
                self.assertEqual(audit["required_count"], 18, student_number)

            daniel = students["2560001"]
            self.assertEqual(daniel.current_stage, "Admission")
            self.assertEqual(
                TermEnrollment.query.filter_by(
                    student_id=daniel.id,
                    term_id=active_term.id,
                ).one().status,
                "Pending Enrollment",
            )

            grace = students["2560002"]
            self.assertEqual(grace.current_stage, "Coursework")
            self.assertEqual(
                {item.course.code for item in curriculum_offerings_for_term(program, active_term)},
                {"MAED-MAJ1", "MAED-MAJ2", "MAED-MAJ3"},
            )

            benjamin = students["2460003"]
            self.assertIsNotNone(TransactionLog.query.filter_by(
                student_id=benjamin.id,
                transaction_slug="leave-of-absence",
                result="LOA application submitted",
            ).first())
            self.assertEqual(
                submitted_request_students("leave-of-absence")[0]["student_number"],
                benjamin.student_number,
            )

            miguel = students["2260004"]
            miguel_progress = graduation_eligibility(miguel)["research_progress"]
            self.assertTrue(miguel_progress["stages"][0]["complete"])
            self.assertTrue(miguel_progress["stages"][1]["complete"])
            self.assertFalse(miguel_progress["stages"][2]["complete"])
            self.assertEqual(PanelAssignment.query.filter_by(
                student_id=miguel.id,
                gate="Final Defense",
            ).count(), 4)

            clarisse = students["2460005"]
            clarisse_case = AwolCase.query.filter_by(student_id=clarisse.id).one()
            self.assertEqual(clarisse_case.status, "Return Submitted")
            self.assertIsNotNone(clarisse_case.intent_attachment_id)

            adrian = students["2360006"]
            self.assertEqual(
                WithdrawalApplication.query.filter_by(student_id=adrian.id).one().status,
                "Submitted to GS Staff",
            )

            isabel = students["2260007"]
            isabel_eligibility = graduation_eligibility(isabel)
            self.assertTrue(isabel_eligibility["eligible"])
            self.assertEqual(isabel_eligibility["coursework_status"], "Complete")
            self.assertEqual(isabel_eligibility["research_status"], "Complete")
            self.assertEqual(isabel_eligibility["practicum_status"], "Dean Reviewed")
            self.assertEqual(
                GraduationEndorsement.query.filter_by(
                    student_id=isabel.id,
                ).one().endorsement_status,
                "For Review",
            )

            hector = students["2360008"]
            hector_eligibility = graduation_eligibility(hector)
            self.assertFalse(hector_eligibility["eligible"])
            self.assertEqual(hector_eligibility["missing_coursework"], [])
            self.assertEqual(hector_eligibility["missing_research_requirements"], [])
            self.assertIn("120/200", hector_eligibility["missing_practicum_requirement"])
            self.assertTrue(
                hector_eligibility["research_progress"]["research_gates_complete"]
            )
            self.assertTrue(
                hector_eligibility["research_progress"]["completion_evidence"]["complete"]
            )

            maria = students["2460009"]
            self.assertEqual(maria.standing, "On Leave")
            self.assertEqual(
                submitted_request_students("readmission")[0]["student_number"],
                maria.student_number,
            )

            paulo = students["2360010"]
            self.assertEqual(paulo.enrollment_tag, "AWOL")
            self.assertEqual(
                AwolCase.query.filter_by(student_id=paulo.id).one().status,
                "AWOL Declared",
            )

            elena = students["2260011"]
            elena_audit = compute_course_audit(elena)
            self.assertEqual(elena_audit["completed_units"], 54)
            self.assertEqual(elena.enrollment_tag, "Residency")
            residency = ResidencyEnrollment.query.filter_by(
                student_id=elena.id,
                term_id=active_term.id,
                status="Active",
            ).one()
            self.assertEqual(residency.reason, "Thesis / dissertation work")
            self.assertEqual(residency.policy_status, "Eligible for Residency")

            # Seeded request claims must be backed by a physical, downloadable
            # PDF rather than a database-only filename.
            attachments = StudentRequestAttachment.query.order_by(
                StudentRequestAttachment.id,
            ).all()
            self.assertEqual(len(attachments), 10)
            for item in attachments:
                path = REQUEST_UPLOAD_ROOT / item.stored_name
                self.assertTrue(path.is_file(), item.original_name)
                self.assertTrue(path.read_bytes().startswith(b"%PDF-"), item.original_name)

            # Completed research gates must have the required number of exact
            # file rows, physical PDFs, and adviser approvals where applicable.
            for student in (miguel, isabel, hector):
                documents = DocumentCheck.query.filter_by(student_id=student.id).all()
                for document in documents:
                    presentation = research_requirement_presentation(
                        document.gate,
                        document.item_name,
                    )
                    if not presentation or presentation["source_type"] != "student_upload":
                        continue
                    self.assertEqual(
                        len(document.evidence_files),
                        presentation["required_file_count"],
                        f"{student.student_number}: {document.item_name}",
                    )
                    for evidence in document.evidence_files:
                        path = UPLOAD_ROOT / evidence.stored_name
                        self.assertTrue(path.is_file(), evidence.original_name)
                        self.assertTrue(path.read_bytes().startswith(b"%PDF-"), evidence.original_name)
                        if document.item_name in ADVISER_APPROVAL_DOCUMENTS:
                            self.assertIsNotNone(
                                AdviserDocumentApproval.query.filter_by(
                                    evidence_file_id=evidence.id,
                                    status="Signed",
                                ).first(),
                                evidence.original_name,
                            )

            staff = UserAccount.query.filter_by(
                email="staff@usls.edu.ph",
                role="staff",
            ).one()
            staff_client = self._role_client(staff.id, "staff")
            for slug, student in (
                ("leave-of-absence", benjamin),
                ("readmission", maria),
                ("awol", clarisse),
            ):
                response = staff_client.post(f"/api/transactions/{slug}/messages", json={
                    "student_id": student.id,
                    "action_type": "note",
                    "recipient_role": "Student",
                    "template": "Please clarify request details",
                    "comment": f"Test message for {slug}.",
                })
                self.assertEqual(response.status_code, 200, response.get_json())

            loa_row = submitted_request_students("leave-of-absence")[0]
            readmission_row = submitted_request_students("readmission")[0]
            awol_row = next(
                row for row in awol_residency_roster_payload()
                if row["student_id"] == clarisse.id
            )
            self.assertEqual(loa_row["student"]["id"], benjamin.id)
            self.assertEqual(readmission_row["student"]["id"], maria.id)
            self.assertTrue(loa_row["messages"])
            self.assertTrue(readmission_row["messages"])
            self.assertTrue(awol_row["messages"])

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

    def test_student_can_upload_additional_practicum_pdf_without_replacing_history(self):
        with app.app_context():
            old_certificate = self._attachment("practicum", "initial-certificate")
            record = PracticumRecord(
                student_id=self.student_id,
                required_hours=200,
                completed_hours=120,
                certificate_attachment_id=old_certificate.id,
                document_status="Pending Review",
                status="Additional Certificates Requested",
            )
            db.session.add(record)
            db.session.flush()
            old_certificate.workflow_request_id = record.id
            old_certificate.workflow_stage = "Practicum Document Submission"
            student_account = self._account("student", "student-practicum-additional@example.test")
            student_account.student_id = self.student_id
            db.session.commit()

            student_client = self._role_client(student_account.id, "student")
            response = student_client.post("/api/student-portal/requests/practicum", json={
                "certificate_attachment_id": old_certificate.id,
                "completed_hours": 200,
                "certificate_count": 99,
            })
            self.assertEqual(response.status_code, 400, response.get_json())
            self.assertIn("additional practicum PDF", response.get_json()["error"])

            response = student_client.post(
                "/api/student-portal/request-attachments/upload",
                data={
                    "request_type": "practicum",
                    "file": (BytesIO(b"%PDF-1.4\nadditional certificate\n%%EOF\n"), "additional-certificate.pdf"),
                },
                content_type="multipart/form-data",
            )
            self.assertEqual(response.status_code, 200, response.get_json())
            new_attachment_id = response.get_json()["attachment"]["id"]
            new_attachment = db.session.get(StudentRequestAttachment, new_attachment_id)
            self.created_files.append(REQUEST_UPLOAD_ROOT / new_attachment.stored_name)

            response = student_client.post("/api/student-portal/requests/practicum", json={
                "certificate_attachment_id": new_attachment_id,
                "completed_hours": 200,
                "certificate_count": 99,
                "remarks": "This additional certificate covers the remaining practicum hours.",
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(record)
            db.session.refresh(old_certificate)
            db.session.refresh(new_attachment)
            self.assertEqual(record.status, "Documents Submitted")
            self.assertEqual(record.certificate_attachment_id, new_attachment_id)
            self.assertEqual(record.certificate_count, 2)
            self.assertEqual(old_certificate.workflow_request_id, record.id)
            self.assertEqual(new_attachment.workflow_request_id, record.id)
            self.assertEqual(
                StudentRequestAttachment.query.filter_by(
                    student_id=self.student_id,
                    request_type="practicum",
                    workflow_request_id=record.id,
                ).count(),
                2,
            )
            submission_remark = WorkflowMessage.query.filter_by(
                transaction_slug="practicum",
                student_id=self.student_id,
                sender_role="Student",
                action_type="submission",
            ).order_by(WorkflowMessage.id.desc()).first()
            self.assertIsNotNone(submission_remark)
            self.assertEqual(submission_remark.recipient_role, "Graduate School Staff")
            self.assertIn("remaining practicum hours", submission_remark.comment)

            staff_message = self._staff_client().post("/api/transactions/practicum/messages", json={
                "student_id": self.student_id,
                "action_type": "note",
                "recipient_role": "Academic Coordinator",
                # Practicum and Graduation deliberately ignore legacy templates;
                # users only enter the actual remarks shown in the discussion.
                "template": "Please clarify request details",
                "comment": "Please review the student's additional certificate.",
            })
            self.assertEqual(staff_message.status_code, 200, staff_message.get_json())
            self.assertEqual(staff_message.get_json()["item"]["template"], "Remarks")
            self.assertEqual(
                staff_message.get_json()["item"]["comment"],
                "Please review the student's additional certificate.",
            )

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
                "bpm_action": "create_batch",
                "review_window": "AY 2026-2027",
                "batch_no": "2",
                "batch_month": "July",
                "batch_year": "2026",
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            self.assertEqual(len(response.get_json()["updated"]), 1)
            self.assertEqual(response.get_json()["batch_name"], "Batch 2 July 2026")
            endorsement = GraduationEndorsement.query.filter_by(student_id=student.id).first()
            self.assertEqual(endorsement.endorsement_status, "For Review")
            self.assertEqual(endorsement.batch_name, "Batch 2 July 2026")

            response = self._staff_client().post("/api/graduation/batch-actions", json={
                "student_ids": [student.id],
                "bpm_action": "compile_to_ac",
                "review_window": "AY 2026-2027",
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            self.assertEqual(len(response.get_json()["updated"]), 1)
            db.session.refresh(endorsement)
            self.assertEqual(endorsement.endorsement_status, "Coursework Review")
            self.assertEqual(endorsement.batch_name, "Batch 2 July 2026")

            response = self._academic_client().post("/api/graduation/batch-actions", json={
                "student_ids": [student.id],
                "bpm_action": "check_coursework",
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(endorsement)
            self.assertEqual(endorsement.endorsement_status, "Research Review")

            response = self._research_client().post("/api/graduation/batch-actions", json={
                "student_ids": [student.id],
                "bpm_action": "validate_research",
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(endorsement)
            self.assertEqual(endorsement.endorsement_status, "Eligibility Confirmed")

            response = self._staff_client().post("/api/graduation/batch-actions", json={
                "student_ids": [student.id],
                "bpm_action": "prepare_endorsement",
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(endorsement)
            self.assertEqual(endorsement.endorsement_status, "Endorsement Prepared")

            response = self._staff_client().post("/api/graduation/batch-actions", json={
                "student_ids": [student.id],
                "bpm_action": "send_to_dean",
            })
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.refresh(endorsement)
            self.assertEqual(endorsement.endorsement_status, "Ready for Dean Review")
            dean_payload = workflow_approvals_payload()
            dean_item = next(
                item for item in dean_payload["pending"]
                if item["type"] == "graduation" and item["student"]["id"] == student.id
            )
            self.assertEqual(dean_item["batch_name"], "Batch 2 July 2026")
            self.assertEqual(dean_item["record"]["batch_name"], "Batch 2 July 2026")

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
            export = self._dean_client().post("/api/graduation/endorsed.csv", json={"endorsement_ids": [endorsement.id]})
            self.assertEqual(export.status_code, 200, export.data.decode())
            self.assertIn("Batch,Student ID,Student Name", export.data.decode())
            self.assertIn("Batch 2 July 2026", export.data.decode())
            db.session.refresh(endorsement)
            self.assertEqual(endorsement.endorsement_status, "Dean Approved")
            self.assertEqual(endorsement.registrar_status, "Exported - Ready to Send")

            endorsement.endorsement_status = "Ready for Dean Review"
            endorsement.registrar_status = "Pending"
            db.session.commit()
            response = self._dean_client().post("/api/graduation/batch-actions", json={
                "student_ids": [student.id],
                "action": "return",
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
            db.session.add(StudentRequestAttachment(
                student_id=self.student.id,
                request_type="graduation-registrar-handoff",
                original_name="endorsed-list.csv",
                stored_name="reset-demo-graduation-registrar-handoff.csv",
                mime_type="text/csv",
            ))
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
            self.assertIsNone(StudentRequestAttachment.query.filter_by(student_id=self.student.id, request_type="graduation-registrar-handoff").first())
            self.assertIsNotNone(CourseRecord.query.filter_by(student_id=self.student.id).first())
            self.assertIsNotNone(ResearchCase.query.filter_by(student_id=self.student.id).first())
            db.session.refresh(self.student)
            self.assertEqual(self.student.standing, "Active")
            self.assertEqual(self.student.current_stage, "Final Defense")


if __name__ == "__main__":
    unittest.main()
