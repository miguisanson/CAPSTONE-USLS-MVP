"""Audit round 2 fixes (process audit 2026-11-04): one test class per row, rows I-341 ... I-339."""

import os
import tempfile
import unittest
from datetime import date, timedelta

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))

from app import (  # noqa: E402
    AcademicTerm, DocumentCheck, AwolCase, CourseRecord, LeaveCase, SubjectEnrollment, leave_policy_review, Course, Faculty, PanelAssignment, PracticumRecord, Program, ScheduleRequest, Task, Student, UserAccount,
    Notification, app, db, generate_password_hash, notify_workflow_owner,
)


class Audit2Base(unittest.TestCase):
    ROLES = ("staff", "dean", "academic_coordinator", "research_coordinator", "student", "faculty")

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
            program = Program(code="A2", name="Audit Two Program", college="Graduate School", has_practicum=False)
            db.session.add(program)
            db.session.flush()
            self.program_id = program.id
            course = Course(program_id=program.id, code="A2-501", title="Audit Course", units=3, category="Major")
            db.session.add(course)
            db.session.flush()
            self.course_id = course.id
            today = date.today()
            for label, start, end in (
                ("Running Term", today - timedelta(days=20), today + timedelta(days=100)),
                ("Term One", today + timedelta(days=110), today + timedelta(days=230)),
                ("Term Two", today + timedelta(days=240), today + timedelta(days=360)),
                ("Term Three", today + timedelta(days=370), today + timedelta(days=490)),
            ):
                db.session.add(AcademicTerm(label=label, start_date=start, end_date=end))
            students = []
            for number, first in (("A2-1", "Ana"), ("A2-2", "Ben")):
                student = Student(
                    student_number=number, first_name=first, last_name="Audit", email=f"{first.lower()}@example.test",
                    program_id=program.id, entry_year=today.year - 1, academic_year_entry="25-26", year_level="1",
                    current_stage="Coursework", standing="Active", enrollment_tag="Enrolled",
                )
                db.session.add(student)
                students.append(student)
            db.session.flush()
            self.student_id, self.other_id = students[0].id, students[1].id
            self.faculty = Faculty(name="Fay Faculty", college="Graduate School", role="Professor",
                                   specialization="Testing", email="fay@example.test")
            db.session.add(self.faculty)
            db.session.flush()
            self.faculty_id = self.faculty.id
            self.accounts = {}
            for role in self.ROLES:
                account = UserAccount(
                    email=f"a2-{role}@example.test", full_name=f"Test {role}", role=role, active=True,
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


class GuideStatePrivacyTests(Audit2Base):
    """I-341: a faculty member sees only the cases of students they advise or sit on the panel of."""

    def test_faculty_sees_only_own_students_in_guide_state(self):
        with app.app_context():
            for sid in (self.student_id, self.other_id):
                db.session.add(AwolCase(student_id=sid, status="AWOL Declared"))
            db.session.add(PanelAssignment(student_id=self.student_id, faculty_id=self.faculty_id, panel_role="Member"))
            db.session.commit()
        faculty = self.client("faculty")
        data = faculty.get("/api/demo/guide-state?process=awol").get_json()
        self.assertEqual([c["student_id"] for c in data["candidates"]], [self.student_id])
        own = faculty.get(f"/api/demo/guide-state?process=awol&student_id={self.student_id}").get_json()
        self.assertIsNotNone(own["case"])
        other = faculty.get(f"/api/demo/guide-state?process=awol&student_id={self.other_id}").get_json()
        self.assertIsNone(other["student"])
        self.assertIsNone(other["case"])
        # staff still see every candidate
        staff = self.client("staff").get("/api/demo/guide-state?process=awol").get_json()
        self.assertEqual(len(staff["candidates"]), 2)


class WorkflowNoticeLinkTests(Audit2Base):
    """I-336: the bell notice opens a page the recipient's role can open."""

    def link_for(self, slug, owner_label, role):
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            notify_workflow_owner(slug, student, "Test step", owner_label, f"t:{slug}:{role}")
            row = Notification.query.filter_by(account_id=self.accounts[role], kind="workflow_waiting").first()
            return row.link

    def test_dean_notice_opens_dean_page(self):
        self.assertEqual(self.link_for("readmission", "Dean", "dean"), "/dean/approvals/readmission")
        self.assertEqual(self.link_for("awol-return", "Dean", "dean"), "/dean/approvals/awol")

    def test_academic_coordinator_notice_for_readmission_opens_work_queue(self):
        self.assertEqual(self.link_for("readmission", "Academic Coordinator", "academic_coordinator"), "/work-queue")
        self.assertEqual(self.link_for("practicum", "Academic Coordinator", "academic_coordinator"), "/workflow/practicum")

    def test_staff_notice_keeps_workflow_page(self):
        self.assertEqual(self.link_for("withdrawal", "Graduate School Staff", "staff"), "/workflow/withdrawal")


class DailySweepTests(Audit2Base):
    """I-270: date-driven leave moves run by themselves, once a day, on the first signed-in API request."""

    def tearDown(self):
        app.config.pop("FORCE_DAILY_SWEEP", None)

    def make_scheduled_leave(self):
        with app.app_context():
            term = AcademicTerm.query.filter_by(label="Running Term").one()
            case = LeaveCase(student_id=self.student_id, kind="LOA", status="Leave Scheduled",
                             start_term_id=term.id, end_term_id=term.id, start_label=term.label, end_label=term.label)
            db.session.add(case)
            db.session.commit()
            return case.id

    def status(self, case_id):
        with app.app_context():
            return db.session.get(LeaveCase, case_id).status

    def test_first_signed_in_request_of_the_day_starts_due_leaves_once(self):
        import app as app_module
        app.config["FORCE_DAILY_SWEEP"] = True
        app_module._DAILY_SWEEP_STATE["day"] = None
        case_id = self.make_scheduled_leave()
        client = self.client("staff")
        self.assertEqual(self.status(case_id), "Leave Scheduled")  # nothing ran yet
        self.assertEqual(app.test_client().get("/api/health").status_code, 200)
        self.assertEqual(self.status(case_id), "Leave Scheduled")  # public/anonymous calls do not run it
        self.assertEqual(client.get("/api/auth/me").status_code, 200)
        self.assertEqual(self.status(case_id), "On Leave")
        # same day: a second leave made due later is left for the next day (once per day)
        second = self.make_scheduled_leave()
        client.get("/api/auth/me")
        self.assertEqual(self.status(second), "Leave Scheduled")

    def test_sweep_is_off_while_testing_unless_forced(self):
        import app as app_module
        app_module._DAILY_SWEEP_STATE["day"] = None
        case_id = self.make_scheduled_leave()
        self.client("staff").get("/api/auth/me")
        self.assertEqual(self.status(case_id), "Leave Scheduled")


class MonitoringEnrolledRowTests(Audit2Base):
    """I-275: an actively enrolled current-term subject cannot be withdrawn, dropped, completed or removed on the sheet."""

    def setUp(self):
        super().setUp()
        with app.app_context():
            term = AcademicTerm.query.filter_by(label="Running Term").one()
            record = CourseRecord(student_id=self.student_id, course_id=self.course_id, status="Enrolled", term_label=term.label)
            db.session.add(record)
            db.session.add(SubjectEnrollment(student_id=self.student_id, course_id=self.course_id, term_id=term.id, status="Enrolled"))
            db.session.commit()
            self.record_id = record.id
        self.url = f"/api/monitoring/students/{self.student_id}/subjects/{self.record_id}"

    def record_status(self):
        with app.app_context():
            return db.session.get(CourseRecord, self.record_id).status

    def test_status_changes_that_belong_to_workflows_are_refused(self):
        staff = self.client("staff")
        for status in ("Withdrawn", "Dropped", "Completed"):
            response = staff.patch(self.url, json={"status": status, "reason": "typo", "drop_reason": "x"})
            self.assertEqual(response.status_code, 409, status)
            self.assertIn("Withdrawal", response.get_json()["error"])
            self.assertEqual(self.record_status(), "Enrolled")

    def test_removing_an_enrolled_row_is_refused(self):
        response = self.client("staff").delete(self.url, json={"reason": "wrong row"})
        self.assertEqual(response.status_code, 409)
        self.assertIn("Enrollment", response.get_json()["error"])
        with app.app_context():
            self.assertIsNone(db.session.get(CourseRecord, self.record_id).removed_at)

    def test_remarks_still_editable_and_history_rows_still_change(self):
        staff = self.client("staff")
        self.assertEqual(staff.patch(self.url, json={"remarks": "note", "reason": "added note"}).status_code, 200)
        with app.app_context():
            enrollment = SubjectEnrollment.query.one()
            enrollment.status = "Completed"  # no longer actively enrolled this term
            db.session.commit()
        self.assertEqual(staff.patch(self.url, json={"status": "Completed", "reason": "late grade"}).status_code, 200)


class ReadmissionGapTests(Audit2Base):
    """I-267: a return semester later than the one right after the leave is flagged, naming the gap semesters."""

    def check_for(self, target_label):
        with app.app_context():
            terms = {t.label: t for t in AcademicTerm.query.all()}
            running = terms["Running Term"]
            leave = LeaveCase(student_id=self.student_id, kind="LOA", status="On Leave", start_term_id=running.id,
                              end_term_id=running.id, start_label=running.label, end_label=running.label)
            db.session.add(leave)
            db.session.flush()
            case = LeaveCase(student_id=self.student_id, kind="READMISSION", status="Submitted", linked_case_id=leave.id,
                             target_term_id=terms[target_label].id, target_label=target_label)
            db.session.add(case)
            db.session.flush()
            checks = leave_policy_review(case)["checks"]
            return next(c for c in checks if c["label"] == "Return semester after the leave")

    def test_next_semester_passes(self):
        self.assertEqual(self.check_for("Term One")["status"], "Pass")

    def test_later_semester_needs_review_and_names_the_gap(self):
        check = self.check_for("Term Three")
        self.assertEqual(check["status"], "Needs Review")
        self.assertIn("Term One", check["detail"])
        self.assertIn("Term Two", check["detail"])


class PracticumPayloadTests(Audit2Base):
    """I-286: hours, document status, site and completion status are never taken from a back-office payload."""

    def setUp(self):
        super().setUp()
        with app.app_context():
            db.session.get(Program, self.program_id).name = "Master of Arts in Psychology"
            db.session.commit()

    def make_record(self, **fields):
        with app.app_context():
            record = PracticumRecord(student_id=self.student_id, required_hours=200, **fields)
            db.session.add(record)
            db.session.commit()
            return record.id

    def record(self, record_id):
        return db.session.get(PracticumRecord, record_id)

    def test_academic_coordinator_cannot_complete_with_made_up_hours_and_no_certificate(self):
        record_id = self.make_record(status="Practicum In Progress", completed_hours=0, document_status="Pending Review")
        response = self.client("academic_coordinator").post("/api/transactions/practicum", json={
            "student_id": self.student_id, "status": "Completed", "completed_hours": "200", "document_status": "Verified",
        })
        self.assertEqual(response.status_code, 400, response.get_json())
        with app.app_context():
            record = self.record(record_id)
            self.assertEqual((record.status, record.completed_hours, record.document_status), ("Practicum In Progress", 0, "Pending Review"))

    def test_completion_needs_the_certificate_on_file(self):
        record_id = self.make_record(status="Documents Under Review", completed_hours=200, document_status="Pending Review")
        response = self.client("academic_coordinator").post("/api/transactions/practicum", json={
            "student_id": self.student_id, "status": "Completed",
        })
        self.assertEqual(response.status_code, 400, response.get_json())
        self.assertIn("certificate", response.get_json()["error"].lower())
        with app.app_context():
            self.assertEqual(self.record(record_id).status, "Documents Under Review")

    def test_staff_forward_does_not_store_site_hours_or_statuses_from_the_payload(self):
        record_id = self.make_record(status="MOA Submitted", completed_hours=10, practicum_site="Real Site")
        response = self.client("staff").post("/api/transactions/practicum", json={
            "student_id": self.student_id, "status": "MOA Under Review", "completed_hours": "199",
            "document_status": "Verified", "practicum_site": "Other Site", "completion_status": "Completed and accepted",
        })
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            record = self.record(record_id)
            self.assertEqual(record.status, "MOA Under Review")
            self.assertEqual((record.completed_hours, record.practicum_site), (10, "Real Site"))
            self.assertNotEqual(record.document_status, "Verified")
            self.assertNotEqual(record.completion_status, "Completed and accepted")


class GenericDocumentUploadTests(Audit2Base):
    """I-280: the generic upload route does not bypass the Research Gate rules."""

    def make_doc(self, gate, item_name):
        with app.app_context():
            doc = DocumentCheck(student_id=self.student_id, gate=gate, item_name=item_name, status="Missing")
            db.session.add(doc)
            db.session.commit()
            return doc.id

    def upload(self, doc_id):
        from io import BytesIO
        return self.client("student").post(
            f"/api/student-portal/documents/{doc_id}/upload",
            data={"file": (BytesIO(b"%PDF-1.4\nx\n%%EOF\n"), "x.pdf")}, content_type="multipart/form-data",
        )

    def test_research_gate_documents_are_refused_and_stay_missing(self):
        for gate, item in (("Form 4 - Proposal Defense Readiness", "Ethics Clearance"), ("Form 1 - Title Defense", "Academic Coordinator endorsement/e-signature")):
            doc_id = self.make_doc(gate, item)
            response = self.upload(doc_id)
            self.assertEqual(response.status_code, 409, (gate, response.get_json()))
            self.assertIn("Research Gate", response.get_json()["error"])
            with app.app_context():
                self.assertEqual(db.session.get(DocumentCheck, doc_id).status, "Missing")


class CoordinatorHomeScopeTests(Audit2Base):
    """I-339: the risk and defense numbers of a coordinator's home count the same students the list pages show."""

    def test_risk_and_defense_numbers_are_school_wide_for_a_coordinator(self):
        with app.app_context():
            db.session.add(Task(student_id=self.student_id, title="Own task", owner_role="Academic Coordinator", due_at=date.today()))
            other = db.session.get(Student, self.other_id)
            other.risk_level = "At Risk of Delay"
            db.session.add(ScheduleRequest(
                student_id=self.other_id, preferred_date=date.today() + timedelta(days=9), defense_type="Proposal Defense",
                mode="Online", venue="Zoom", status="Scheduled",
            ))
            db.session.commit()
        for role in ("academic_coordinator", "research_coordinator"):
            kpis = self.client(role).get("/api/dashboard").get_json()["kpis"]
            self.assertEqual((kpis["at_risk"], kpis["confirmed_schedules"]), (1, 1), role)
        # the caseload number stays the caseload
        kpis = self.client("academic_coordinator").get("/api/dashboard").get_json()["kpis"]
        self.assertEqual(kpis["total_students"], 1)


if __name__ == "__main__":
    unittest.main()
