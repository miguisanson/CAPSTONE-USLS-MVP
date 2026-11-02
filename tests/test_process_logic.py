"""Process-logic audit fixes (I-165..I-181): rules checked once must be checked again.

One seeded demo database is built for the whole module; each test changes one named demo student and
puts it back. Fixes for leave / AWOL timing live in tests/test_loa_readmission.py and the Form 7 score
bands in tests/test_research_core.py.
"""
import os
import tempfile
import unittest
from datetime import date, datetime, timedelta

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="uploads-"))

from werkzeug.datastructures import MultiDict  # noqa: E402

from app import (  # noqa: E402
    AcademicTerm,
    AwolCase,
    PanelAssignment,
    PracticumRecord,
    ScheduleRequest,
    Student,
    SubjectEnrollment,
    Task,
    UserAccount,
    WithdrawalApplication,
    app,
    apply_class_list_row,
    apply_practicum_payload,
    build_demo_database,
    db,
    generate_password_hash,
    graduation_eligibility,
    practicum_required_hours,
    student_portal_recommendations,
    student_priority,
    sync_automatic_awol_statuses,
)


class ProcessLogicTests(unittest.TestCase):
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

    # ---- helpers ------------------------------------------------------------------------------
    def client_for(self, email, role):
        with app.app_context():
            account_id = UserAccount.query.filter_by(email=email).one().id
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    def staff(self):
        return self.client_for("staff@usls.edu.ph", "staff")

    def research(self):
        return self.client_for("research@usls.edu.ph", "research_coordinator")

    def academic(self):
        return self.client_for("academic@usls.edu.ph", "academic_coordinator")

    def dean(self):
        return self.client_for("dean@usls.edu.ph", "dean")

    def student_named(self, number):
        return Student.query.filter_by(student_number=number).one()

    def student_client(self, number):
        """A student's own session; makes a portal account when the demo student has none."""
        with app.app_context():
            student = self.student_named(number)
            account = UserAccount.query.filter_by(student_id=student.id, role="student").first()
            if not account:
                account = UserAccount(
                    email=f"{number.lower()}@logic.test", full_name=student.name, role="student", active=True,
                    password_hash=generate_password_hash("test-password"), student_id=student.id,
                )
                db.session.add(account)
                db.session.commit()
            account_id = account.id
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = "student"
        return client

    def set_standing(self, number, standing, tag, stage=None):
        """Change a demo student and put it back at the end of the test."""
        with app.app_context():
            student = self.student_named(number)
            before = (student.standing, student.enrollment_tag, student.current_stage)
            student.standing, student.enrollment_tag = standing, tag
            if stage:
                student.current_stage = stage
            db.session.commit()

        def restore():
            with app.app_context():
                row = self.student_named(number)
                row.standing, row.enrollment_tag, row.current_stage = before
                db.session.commit()
        self.addCleanup(restore)

    # ---- I-171: graduation needs a student who is officially enrolled -----------------------------
    def test_graduation_is_not_eligible_while_awol_on_leave_or_not_enrolled(self):
        with app.app_context():
            self.assertTrue(graduation_eligibility(self.student_named("2260007"))["eligible"])
        for standing, tag, word in (("AWOL", "AWOL", "AWOL"), ("On Leave", "LOA", "leave"), ("Active", "Not Enrolled", "enrolled")):
            self.set_standing("2260007", standing, tag)
            with app.app_context():
                result = graduation_eligibility(self.student_named("2260007"))
            self.assertFalse(result["eligible"], (standing, tag))
            item = next(row for row in result["checklist"] if row["key"] == "enrollment")
            self.assertIs(item["passed"], False)
            self.assertIn(word.lower(), item["note"].lower())

    # ---- I-172: the rules are checked again at every step ---------------------------------------------
    def test_research_gate_and_adviser_routes_refuse_an_awol_student(self):
        self.set_standing("GS-2026-UD-03", "AWOL", "AWOL")
        gate = self.research().post("/api/transactions/research-gate", json={"student_id": self.id_of("GS-2026-UD-03")})
        self.assertEqual(gate.status_code, 400, gate.get_json())
        self.assertIn("awol", gate.get_json()["error"].lower())
        record = self.research().post(
            "/api/adviser-appointments/record", json={"student_id": self.id_of("GS-2026-UD-03"), "faculty_id": 1})
        self.assertIn(record.status_code, (400, 409), record.get_json())
        self.assertIn("awol", record.get_json()["error"].lower())
        change = self.student_client("GS-2026-UD-03").post(
            "/api/student-portal/adviser/change", json={"faculty_id": 1, "reason": "My adviser left the university."})
        self.assertIn(change.status_code, (400, 409), change.get_json())
        self.assertIn("awol", change.get_json()["error"].lower())

    def id_of(self, number):
        with app.app_context():
            return self.student_named(number).id

    def test_a_defense_verdict_for_an_awol_student_is_refused(self):
        self.set_standing("GS-2026-UD-01", "AWOL", "AWOL")
        with app.app_context():
            student = self.student_named("GS-2026-UD-01")
            schedule = ScheduleRequest.query.filter_by(
                student_id=student.id, defense_type="Proposal Defense", status="Scheduled").one()
            chair = PanelAssignment.query.filter_by(student_id=student.id, panel_role="Panel Chair").first()
            email = UserAccount.query.filter_by(faculty_id=chair.faculty_id).first().email
            schedule_id = schedule.id
        response = self.client_for(email, "faculty").post(
            f"/api/faculty-portal/defense-verdicts/{schedule_id}", json={"result": "Passed"})
        self.assertIn(response.status_code, (400, 409), response.get_json())
        self.assertIn("awol", response.get_json()["error"].lower())

    def test_a_booked_defense_is_flagged_for_the_coordinators_when_the_student_goes_awol(self):
        number = "GS-2026-UD-02"
        self.set_standing(number, "AWOL", "AWOL")
        with app.app_context():
            self.assertEqual(sync_automatic_awol_statuses(commit=True) >= 1, True)
            student = self.student_named(number)
            tasks = Task.query.filter(
                Task.student_id == student.id, Task.owner_role == "Research Coordinator",
                Task.title.like("Booked defense%"), Task.status.in_(["Pending", "Overdue"]),
            ).all()
            self.assertEqual(len(tasks), 1)
            self.assertIn("AWOL", tasks[0].title)
            # Flagged, never cancelled for them.
            booked = ScheduleRequest.query.filter_by(student_id=student.id, defense_type="Proposal Defense").one()
            self.assertEqual(booked.status, "Scheduled")

    def test_practicum_steps_are_refused_for_a_student_on_leave(self):
        self.set_standing("2360101", "On Leave", "LOA")
        response = self.academic().post(
            "/api/transactions/practicum", json={"student_id": self.id_of("2360101"), "status": "Completed"})
        self.assertEqual(response.status_code, 400, response.get_json())
        self.assertIn("on leave", response.get_json()["error"].lower())

    # ---- I-173: input the form should not accept --------------------------------------------------------
    def test_a_practicum_payload_cannot_lower_the_required_hours(self):
        with app.app_context():
            student = self.student_named("2360101")
            record = PracticumRecord.query.filter_by(student_id=student.id).one()
            with app.test_request_context():
                apply_practicum_payload(record, MultiDict({"required_hours": "5"}), student)
            self.assertGreaterEqual(record.required_hours, practicum_required_hours())
            db.session.rollback()

    def test_the_dean_can_mark_a_practicum_reviewed_only_after_the_report_was_sent(self):
        with app.app_context():
            record = PracticumRecord.query.filter_by(student_id=self.student_named("2360101").id).one()
            before = record.status
            record.status = "Practicum In Progress"
            db.session.commit()
            record_id = record.id

        def restore():
            with app.app_context():
                db.session.get(PracticumRecord, record_id).status = before
                db.session.commit()
        self.addCleanup(restore)
        response = self.dean().post(f"/api/approvals/workflow/practicum/{record_id}/decide", json={"decision": "approve"})
        self.assertEqual(response.status_code, 400, response.get_json())
        self.assertIn("report", response.get_json()["error"].lower())
        with app.app_context():
            self.assertEqual(db.session.get(PracticumRecord, record_id).status, "Practicum In Progress")

    def test_a_defense_request_needs_a_real_future_date_and_no_booking_already_in_place(self):
        client = self.student_client("GS-2026-UD-01")  # Proposal Defense already booked for this student
        future = (date.today() + timedelta(days=40)).isoformat()
        for bad in ("not-a-date", "2020-01-01"):
            response = client.post("/api/student-portal/requests/defense-scheduling", json={"preferred_date": bad})
            self.assertEqual(response.status_code, 400, (bad, response.get_json()))
            self.assertIn("date", response.get_json()["error"].lower())
        booked = client.post("/api/student-portal/requests/defense-scheduling", json={"preferred_date": future})
        self.assertEqual(booked.status_code, 409, booked.get_json())
        self.assertIn("booked", booked.get_json()["error"].lower())

    # ---- I-169: leaving a subject late goes through Withdrawal -------------------------------------------
    def enrolled_student_in_active_term(self):
        with app.app_context():
            term = AcademicTerm.query.filter_by(is_active_planning_term=True).first()
            counts = {}
            for row in SubjectEnrollment.query.filter_by(term_id=term.id, status="Enrolled").all():
                counts.setdefault(row.student_id, []).append(row.course_id)
            student_id, course_ids = next((k, v) for k, v in sorted(counts.items()) if len(v) >= 2)
            return term.id, student_id, sorted(course_ids)

    def test_removing_an_enrolled_subject_after_the_first_week_goes_through_withdrawal(self):
        term_id, student_id, course_ids = self.enrolled_student_in_active_term()
        with app.app_context():
            term = db.session.get(AcademicTerm, term_id)
            original_start = term.start_date
            term.start_date = date.today() - timedelta(days=40)  # the first week is long over
            db.session.commit()

        def restore():
            with app.app_context():
                db.session.get(AcademicTerm, term_id).start_date = original_start
                db.session.commit()
        self.addCleanup(restore)
        body = {"student_id": student_id, "term_id": term_id, "course_ids": course_ids[1:], "confirmed": True, "resolutions": {}}
        refused = self.staff().post("/api/enrollment", json=body)
        self.assertEqual(refused.status_code, 409, refused.get_json())
        self.assertIn("withdrawal", refused.get_json()["error"].lower())
        with app.app_context():
            self.assertEqual(SubjectEnrollment.query.filter_by(
                student_id=student_id, term_id=term_id, course_id=course_ids[0], status="Enrolled").count(), 1)
        no_evidence = self.academic().post("/api/enrollment", json=body)
        self.assertEqual(no_evidence.status_code, 409, no_evidence.get_json())
        dropped = self.academic().post("/api/enrollment", json={**body, "unexcused_absence_percent": 35})
        self.assertEqual(dropped.status_code, 200, dropped.get_json())

    def test_a_dropped_row_in_a_class_list_closes_a_pending_withdrawal_for_that_subject(self):
        with app.app_context():
            _term_id, student_id, course_ids = self.enrolled_student_in_active_term()
            ledger = SubjectEnrollment.query.filter_by(student_id=student_id, course_id=course_ids[-1], status="Enrolled").first()
            application = WithdrawalApplication(
                student_id=student_id, subject_enrollment_id=ledger.id, reason="Work schedule", status="Dean Review")
            db.session.add(application)
            db.session.commit()
            application_id = application.id
            item = {
                "student": ledger.student, "course": ledger.course, "effective_date": date.today(), "desired": "Dropped",
                "existing": ledger, "remarks": "", "drop_evidence": "Unexcused absences 30% of class hours.",
            }
            apply_class_list_row(item, ledger.term, "class-list.csv", "Registrar")
            db.session.commit()
            self.assertEqual(db.session.get(WithdrawalApplication, application_id).status, "Denied")

    # ---- I-177: the student's status and message agree -----------------------------------------------------
    def test_the_student_home_never_says_on_track_and_lists_outstanding_subjects(self):
        with app.app_context():
            checked = disagree = 0
            for student in Student.query.filter(Student.current_stage.in_(["Coursework", "Admission"])).all():
                level = student_priority(student)["level"]
                codes = {row["code"] for row in student_portal_recommendations(student)}
                checked += 1
                if level == "On Track" and "coursework" in codes:
                    disagree += 1
            self.assertGreater(checked, 5)
            self.assertEqual(disagree, 0, f"{disagree} students are 'On Track' yet told to contact the AC about subjects")


if __name__ == "__main__":
    unittest.main()
