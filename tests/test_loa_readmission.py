"""Leave of Absence and Readmission run on real case records.

Before this, status was guessed from the newest log row and the period, reason and
checklist were free text read back with regular expressions. These tests cover the
case table, the guarded transitions, the student-status side effects, the staff
board endpoints, the Registrar list and the dead ends the audit found (LR-01..LR-03,
AW-01).
"""

import os
import tempfile
import unittest
from datetime import date, datetime, timedelta

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"

import app as app_module  # noqa: E402
from app import (  # noqa: E402
    AcademicTerm,
    AwolCase,
    Course,
    CourseRecord,
    LeaveCase,
    LeaveCaseEvent,
    Program,
    Student,
    SubjectEnrollment,
    Task,
    TermEnrollment,
    TransactionLog,
    UserAccount,
    WorkflowMessage,
    add_log,
    adopt_legacy_leave_logs,
    app,
    db,
    generate_password_hash,
    submitted_request_students,
    sync_automatic_awol_statuses,
    leave_checklist_state as leave_workflow_checklist,
    sync_leave_cases,
)
import leave_workflow  # noqa: E402

CHECKLIST = [
    "Structured return intention completed",
    "Updated study plan confirmed",
    "Program or adviser consultation completed",
    "No pending accountability confirmed",
]


class LeaveCaseTests(unittest.TestCase):
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
            program = Program(code="LVE", name="Leave Program", college="Graduate School", has_practicum=False)
            db.session.add(program)
            db.session.flush()
            self.program_id = program.id
            course = Course(program_id=program.id, code="LVE-501", title="Leave Course", units=3, category="Major")
            db.session.add(course)
            db.session.flush()
            self.course_id = course.id
            student = Student(
                student_number="GS-LVE-1",
                first_name="Lea",
                last_name="Vest",
                email="lea.vest@example.test",
                program_id=program.id,
                entry_year=date.today().year - 1,
                academic_year_entry="25-26",
                year_level="1",
                current_stage="Coursework",
                standing="Active",
                enrollment_tag="Enrolled",
            )
            db.session.add(student)
            db.session.flush()
            self.student_id = student.id
            self.staff_id = self._account("staff", "lve-staff@example.test").id
            self.dean_id = self._account("dean", "lve-dean@example.test").id
            self.academic_id = self._account("academic_coordinator", "lve-ac@example.test").id
            account = self._account("student", "lve-student@example.test")
            account.student_id = student.id
            self.student_account_id = account.id
            # Terms by distance from today: one over, one running, four ahead.
            today = date.today()
            specs = [
                ("Past Term", today - timedelta(days=200), today - timedelta(days=80)),
                ("Running Term", today - timedelta(days=20), today + timedelta(days=100)),
                ("Term One", today + timedelta(days=110), today + timedelta(days=230)),
                ("Term Two", today + timedelta(days=240), today + timedelta(days=360)),
                ("Term Three", today + timedelta(days=370), today + timedelta(days=490)),
                ("Term Four", today + timedelta(days=500), today + timedelta(days=620)),
            ]
            self.term_ids = {}
            for label, start, end in specs:
                term = AcademicTerm(label=label, start_date=start, end_date=end)
                db.session.add(term)
                db.session.flush()
                self.term_ids[label] = term.id
            db.session.commit()

    # ---- fixtures -------------------------------------------------------------
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

    def _client(self, account_id, role):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    def student_client(self):
        return self._client(self.student_account_id, "student")

    def staff_client(self):
        return self._client(self.staff_id, "staff")

    def dean_client(self):
        return self._client(self.dean_id, "dean")

    def file_loa(self, start="Term One", end="Term Two", client=None, **extra):
        body = {
            "effective_start": start,
            "effective_end": end,
            "reason_category": "Medical / health",
            "reason_remarks": "Surgery and recovery.",
            **extra,
        }
        return (client or self.student_client()).post("/api/student-portal/requests/leave-of-absence", json=body)

    def act(self, client, case_id, action, **body):
        return client.post(f"/api/leave-cases/{case_id}/transition", json={"action": action, **body})

    def case(self, case_id=None):
        with app.app_context():
            query = LeaveCase.query
            item = db.session.get(LeaveCase, case_id) if case_id else query.order_by(LeaveCase.id.desc()).first()
            return item.id if item else None

    def status_of(self, case_id):
        with app.app_context():
            return db.session.get(LeaveCase, case_id).status

    def file_and_forward(self, start="Term One", end="Term Two"):
        response = self.file_loa(start, end)
        self.assertEqual(response.status_code, 200, response.get_json())
        case_id = self.case()
        forwarded = self.act(self.staff_client(), case_id, "forward", eligibility_result="Eligible")
        self.assertEqual(forwarded.status_code, 200, forwarded.get_json())
        return case_id

    def approve(self, case_id, note=""):
        response = self.act(self.dean_client(), case_id, "approve", comment=note)
        self.assertEqual(response.status_code, 200, response.get_json())
        return response

    def make_on_leave(self, start="Running Term", end="Term One"):
        """File, forward and approve a leave that starts in an already running term."""
        case_id = self.file_and_forward(start, end)
        self.approve(case_id)
        return case_id

    # ---- the vocabulary ---------------------------------------------------------
    def test_one_status_list_drives_columns_and_every_move_is_between_known_statuses(self):
        known = set(leave_workflow.STATUS_KEYS)
        for slug, columns in leave_workflow.BOARD_COLUMNS.items():
            on_board = {status for column in columns for status in column["statuses"]}
            self.assertLessEqual(on_board, known, slug)
        # Dean Review and Withdrawn used to be missing from the staff board.
        loa_columns = {s for c in leave_workflow.BOARD_COLUMNS["leave-of-absence"] for s in c["statuses"]}
        self.assertIn("Dean Review", loa_columns)
        self.assertIn("Withdrawn", loa_columns)
        for move in leave_workflow.TRANSITIONS:
            self.assertLessEqual(set(move["from"]), known, move["action"])
            if not move["to"].startswith("*"):
                self.assertIn(move["to"], known, move["action"])
        response = self.staff_client().get("/api/leave-cases?slug=leave-of-absence")
        self.assertEqual(response.status_code, 200, response.get_json())
        vocabulary = response.get_json()["vocabulary"]
        self.assertEqual([s["key"] for s in vocabulary["statuses"]], leave_workflow.STATUS_KEYS)

    # ---- the case record ---------------------------------------------------------
    def test_a_student_request_is_a_case_row_with_its_own_fields(self):
        response = self.file_loa("Term One", "Term Two")
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            case = LeaveCase.query.one()
            self.assertEqual(case.kind, "LOA")
            self.assertEqual(case.status, "Submitted")
            self.assertEqual(case.start_term.label, "Term One")
            self.assertEqual(case.end_term.label, "Term Two")
            self.assertEqual(case.reason_category, "Medical / health")
            self.assertEqual(case.reason_text, "Surgery and recovery.")
            self.assertIsNotNone(case.submitted_at)
            events = LeaveCaseEvent.query.filter_by(case_id=case.id).all()
            self.assertEqual([(e.from_status, e.to_status, e.action) for e in events], [(None, "Submitted", "submit")])
            log = TransactionLog.query.filter_by(result="LOA application submitted").one()
            self.assertEqual(log.workflow_request_id, case.id)
            self.assertEqual(events[0].log_id, log.id)

    def test_reason_text_with_odd_characters_is_kept_exactly(self):
        text = "Line one.\nReason/remarks: pretend field. Ends with periods..."
        response = self.file_loa(reason_remarks=text)
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            self.assertEqual(LeaveCase.query.one().reason_text, text)

    def test_old_log_history_becomes_cases_once_and_keeps_its_story(self):
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            add_log("leave-of-absence", student.id, "Student", "Structured LOA portal form",
                    "LOA application submitted", "GS Staff",
                    "Requested period: Term One to Term Two.\nRequested duration: 2 semester(s).\n"
                    "Reason category: Medical / health.\nReason/remarks: Surgery.\n",
                    previous_status=None, new_status="Submitted")
            add_log("leave-of-absence", student.id, "Graduate School Staff", "Structured LOA portal form",
                    "LOA request forwarded to Dean", "Dean",
                    "Requested semester period: Term One to Term Two.\nEligibility result: Eligible.",
                    previous_status="Submitted", new_status="Dean Review")
            add_log("leave-of-absence", student.id, "Dean", "Approvals",
                    "LOA approved by Dean", "Student", "Requested semester period: Term One to Term Two.",
                    previous_status="Dean Review", new_status="Approved")
            student.standing = "On Leave"
            student.current_stage = "LOA"
            student.enrollment_tag = "LOA"
            db.session.commit()

            created = adopt_legacy_leave_logs()
            self.assertEqual(created, 1)
            case = LeaveCase.query.one()
            self.assertEqual((case.kind, case.status), ("LOA", "On Leave"))
            self.assertEqual((case.start_term.label, case.end_term.label), ("Term One", "Term Two"))
            self.assertEqual(case.reason_category, "Medical / health")
            self.assertEqual(case.reason_text, "Surgery")
            self.assertEqual(case.source, "migrated")
            self.assertEqual(LeaveCaseEvent.query.filter_by(case_id=case.id).count(), 3)
            # The student keeps the standing the old approval gave them.
            self.assertEqual(db.session.get(Student, self.student_id).standing, "On Leave")
            # Running it again changes nothing.
            self.assertEqual(adopt_legacy_leave_logs(), 0)
            self.assertEqual(LeaveCase.query.count(), 1)
            self.assertEqual(LeaveCaseEvent.query.filter_by(case_id=case.id).count(), 3)

    def test_old_readmission_and_returned_history_is_adopted_with_the_right_status(self):
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            add_log("readmission", student.id, "Student", "Structured readmission portal form",
                    "Readmission request submitted", "GS Staff",
                    "Target return semester: Term Three.\nPrevious LOA period: Term One to Term Two.\n"
                    "Return intention: I am ready.", new_status="Submitted")
            add_log("readmission", student.id, "Graduate School Staff", "Workflow message",
                    "Readmission returned for clarification", "Student", "Please attach the plan.",
                    previous_status="Submitted", new_status="Returned for Clarification")
            adopt_legacy_leave_logs()
            case = LeaveCase.query.filter_by(kind="READMISSION").one()
            self.assertEqual(case.status, "Returned")
            self.assertEqual(case.target_term.label, "Term Three")
            self.assertEqual(case.return_intent, "I am ready")  # old rows lost the final period

    def test_staff_roster_helper_reads_cases_and_adopts_old_rows_on_the_fly(self):
        with app.app_context():
            add_log("leave-of-absence", self.student_id, "Student", "Structured LOA portal form",
                    "LOA application submitted", "GS Staff",
                    "Requested period: Term One to Term One.\nReason/remarks: Family.",
                    new_status="Submitted")
            db.session.commit()
            rows = submitted_request_students("leave-of-absence")
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["status"], "Submitted")
            self.assertEqual(rows[0]["student"]["id"], self.student_id)
            self.assertEqual(LeaveCase.query.count(), 1)

    # ---- the guarded transitions ---------------------------------------------------
    def test_each_move_needs_the_right_status_and_the_right_role(self):
        self.assertEqual(self.file_loa().status_code, 200)
        case_id = self.case()
        # A student cannot forward; staff cannot decide; the Dean cannot approve before staff forward.
        self.assertEqual(self.act(self.student_client(), case_id, "forward").status_code, 403)
        self.assertEqual(self.act(self.staff_client(), case_id, "approve").status_code, 403)
        too_early = self.act(self.dean_client(), case_id, "approve")
        self.assertEqual(too_early.status_code, 409, too_early.get_json())
        self.assertEqual(self.status_of(case_id), "Submitted")
        # A return needs a reason.
        no_reason = self.act(self.staff_client(), case_id, "return")
        self.assertEqual(no_reason.status_code, 400, no_reason.get_json())
        self.assertEqual(self.act(self.staff_client(), case_id, "start_review").status_code, 200)
        self.assertEqual(self.status_of(case_id), "Staff Review")
        self.assertEqual(self.act(self.staff_client(), case_id, "forward").status_code, 200)
        self.assertEqual(self.status_of(case_id), "Dean Review")
        # Staff can no longer move it; the Dean can.
        self.assertEqual(self.act(self.staff_client(), case_id, "forward").status_code, 409)
        self.assertEqual(self.act(self.dean_client(), case_id, "deny").status_code, 400)  # comment required
        denied = self.act(self.dean_client(), case_id, "deny", comment="Not within the handbook limits.")
        self.assertEqual(denied.status_code, 200, denied.get_json())
        self.assertEqual(self.status_of(case_id), "Denied")
        self.assertEqual(self.act(self.dean_client(), case_id, "approve").status_code, 409)

    def test_every_move_is_written_to_the_case_history_with_who_and_why(self):
        case_id = self.file_and_forward()
        self.act(self.dean_client(), case_id, "return", comment="Add the doctor's memo.")
        with app.app_context():
            events = LeaveCaseEvent.query.filter_by(case_id=case_id).order_by(LeaveCaseEvent.id).all()
            self.assertEqual([e.to_status for e in events], ["Submitted", "Dean Review", "Returned"])
            self.assertEqual(events[-1].comment, "Add the doctor's memo.")
            self.assertEqual(events[-1].actor_role, "Dean")
            self.assertTrue(all(e.log_id for e in events))

    # ---- LR-02: a message never strands a case --------------------------------------
    def test_a_message_does_not_change_status_or_block_forwarding_or_withdrawing(self):
        self.assertEqual(self.file_loa().status_code, 200)
        case_id = self.case()
        note = self.staff_client().post("/api/transactions/leave-of-absence/messages", json={
            "student_id": self.student_id, "action_type": "note", "recipient_role": "Student",
            "template": "Remarks", "comment": "We will look at this tomorrow.",
        })
        self.assertEqual(note.status_code, 200, note.get_json())
        reply = self.student_client().post("/api/transactions/leave-of-absence/messages", json={
            "action_type": "note", "recipient_role": "Graduate School Staff",
            "template": "Remarks", "comment": "Thank you.",
        })
        self.assertEqual(reply.status_code, 200, reply.get_json())
        self.assertEqual(self.status_of(case_id), "Submitted")
        forwarded = self.act(self.staff_client(), case_id, "forward")
        self.assertEqual(forwarded.status_code, 200, forwarded.get_json())
        withdrawn = self.student_client().post(f"/api/student-portal/leave-cases/{case_id}/withdraw")
        self.assertEqual(withdrawn.status_code, 200, withdrawn.get_json())
        self.assertEqual(self.status_of(case_id), "Withdrawn")

    # ---- LR-03: a returned request can be corrected and sent again -------------------
    def test_a_returned_request_reopens_and_sending_it_again_closes_the_return(self):
        self.assertEqual(self.file_loa().status_code, 200)
        case_id = self.case()
        returned = self.act(self.staff_client(), case_id, "return", comment="State the start semester clearly.")
        self.assertEqual(returned.status_code, 200, returned.get_json())
        self.assertEqual(self.status_of(case_id), "Returned")
        with app.app_context():
            open_returns = WorkflowMessage.query.filter_by(
                student_id=self.student_id, action_type="return", status="Open").count()
            self.assertEqual(open_returns, 1)
            self.assertEqual(Task.query.filter(Task.owner_role == "Student", Task.status == "Pending",
                                               Task.title.contains("Leave of Absence")).count(), 1)
        # The student's form is editable again and the same case is sent once more.
        again = self.file_loa("Term One", "Term One", reason_remarks="Clearer wording.")
        self.assertEqual(again.status_code, 200, again.get_json())
        with app.app_context():
            self.assertEqual(LeaveCase.query.count(), 1)
            case = LeaveCase.query.one()
            self.assertEqual((case.status, case.reason_text, case.end_term.label), ("Submitted", "Clearer wording.", "Term One"))
            self.assertEqual(WorkflowMessage.query.filter_by(action_type="return", status="Open").count(), 0)
            self.assertEqual(Task.query.filter(Task.owner_role == "Student", Task.status == "Pending").count(), 0)
            # Exactly one open staff task, not one per submission.
            self.assertEqual(Task.query.filter(Task.owner_role.in_(["Graduate School Staff", "GS Staff"]),
                                               Task.status == "Pending",
                                               Task.title.contains("Leave of Absence")).count(), 1)

    # ---- LR-10: one open request per student and kind ----------------------------------
    def test_a_second_request_while_one_is_open_is_refused_with_a_helpful_message(self):
        self.assertEqual(self.file_loa().status_code, 200)
        again = self.file_loa("Term Three", "Term Three")
        self.assertEqual(again.status_code, 409, again.get_json())
        self.assertIn("already in progress", again.get_json()["error"])
        with app.app_context():
            self.assertEqual(LeaveCase.query.count(), 1)

    def test_withdrawing_lets_the_student_file_a_new_request(self):
        self.assertEqual(self.file_loa().status_code, 200)
        case_id = self.case()
        self.assertEqual(self.student_client().post(f"/api/student-portal/leave-cases/{case_id}/withdraw").status_code, 200)
        self.assertEqual(self.file_loa("Term Three", "Term Three").status_code, 200)
        with app.app_context():
            self.assertEqual(LeaveCase.query.count(), 2)

    # ---- student standing at every step (B6-B10) ---------------------------------------
    def enroll(self, term_label, status="Enrolled"):
        with app.app_context():
            term = AcademicTerm.query.filter_by(label=term_label).one()
            item = SubjectEnrollment(
                student_id=self.student_id, course_id=self.course_id, term_id=term.id,
                status=status, source_reference="Leave test fixture",
            )
            db.session.add(item)
            record = CourseRecord(student_id=self.student_id, course_id=self.course_id, status="Enrolled",
                                  term_label=term_label)
            db.session.add(record)
            db.session.add(TermEnrollment(student_id=self.student_id, term_id=term.id, status="Enrolled"))
            db.session.commit()

    def student_state(self):
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            return student.standing, student.current_stage, student.enrollment_tag

    def test_an_approved_leave_that_starts_later_is_scheduled_and_begins_on_its_first_day(self):
        self.enroll("Running Term")
        case_id = self.file_and_forward("Term One", "Term Two")
        self.approve(case_id)
        self.assertEqual(self.status_of(case_id), "Leave Scheduled")
        self.assertEqual(self.student_state(), ("Active", "Coursework", "Enrolled"))
        with app.app_context():
            self.assertEqual(TermEnrollment.query.filter_by(status="LOA").count(), 0)
            # The subject the student is taking now is not touched.
            self.assertEqual(SubjectEnrollment.query.one().status, "Enrolled")
            term_one_start = AcademicTerm.query.filter_by(label="Term One").one().start_date
        with app.app_context():
            sync_leave_cases(today=date.today(), commit=True)
        self.assertEqual(self.status_of(case_id), "Leave Scheduled")
        with app.app_context():
            sync_leave_cases(today=term_one_start, commit=True)
        self.assertEqual(self.status_of(case_id), "On Leave")
        self.assertEqual(self.student_state(), ("On Leave", "LOA", "LOA"))
        with app.app_context():
            case = db.session.get(LeaveCase, case_id)
            self.assertEqual((case.prior_stage, case.prior_enrollment_tag), ("Coursework", "Enrolled"))
            labels = sorted(row.term.label for row in TermEnrollment.query.filter_by(status="LOA").all())
            self.assertEqual(labels, ["Term One", "Term Two"])
            actions = [event.action for event in case.events]
            self.assertIn("start_leave", actions)
            self.assertEqual(SubjectEnrollment.query.one().status, "Enrolled")  # the running semester ended normally
            self.assertTrue(WorkflowMessage.query.filter_by(
                student_id=self.student_id, recipient_role="Student", template="Your leave of absence has started").count())

    def test_a_leave_that_starts_in_the_running_semester_closes_its_subjects_at_once(self):
        self.enroll("Running Term")
        case_id = self.file_and_forward("Running Term", "Term One")
        self.approve(case_id)
        self.assertEqual(self.status_of(case_id), "On Leave")
        self.assertEqual(self.student_state(), ("On Leave", "LOA", "LOA"))
        with app.app_context():
            enrollment = SubjectEnrollment.query.one()
            self.assertEqual(enrollment.status, "Withdrawn")
            self.assertIn("leave of absence", enrollment.status_note.lower())
            record = CourseRecord.query.one()
            self.assertEqual(record.status, "Not Started")
            labels = sorted(row.term.label for row in TermEnrollment.query.filter_by(status="LOA").all())
            self.assertEqual(labels, ["Running Term", "Term One"])

    def test_a_leave_filed_in_the_second_half_of_the_semester_marks_subjects_w(self):
        with app.app_context():
            today = date.today()
            term = AcademicTerm(label="Late Term", start_date=today - timedelta(days=90), end_date=today + timedelta(days=30))
            db.session.add(term)
            db.session.commit()
        self.enroll("Late Term")
        case_id = self.file_and_forward("Late Term", "Late Term")
        self.approve(case_id)
        with app.app_context():
            enrollment = SubjectEnrollment.query.one()
            self.assertEqual(enrollment.status, "Withdrawn")
            self.assertIn("Marked W", enrollment.status_note)
            self.assertIn("no refund", enrollment.status_note)

    def test_the_student_can_cancel_an_approved_leave_that_has_not_started(self):
        case_id = self.file_and_forward("Term One", "Term Two")
        self.approve(case_id)
        cancelled = self.student_client().post(f"/api/student-portal/leave-cases/{case_id}/cancel")
        self.assertEqual(cancelled.status_code, 200, cancelled.get_json())
        self.assertEqual(self.status_of(case_id), "Cancelled")
        self.assertEqual(self.student_state(), ("Active", "Coursework", "Enrolled"))
        # Nobody can cancel a leave that is already running.
        other = self.make_on_leave("Running Term", "Running Term")
        blocked = self.student_client().post(f"/api/student-portal/leave-cases/{other}/cancel")
        self.assertEqual(blocked.status_code, 409, blocked.get_json())

    def test_a_leave_that_is_ending_becomes_return_due_then_awol_is_proposed_and_staff_confirm(self):
        case_id = self.make_on_leave("Running Term", "Running Term")
        with app.app_context():
            end = AcademicTerm.query.filter_by(label="Running Term").one().end_date
            sync_leave_cases(today=end - timedelta(days=100), commit=True)
        self.assertEqual(self.status_of(case_id), "On Leave")
        with app.app_context():
            sync_leave_cases(today=end - timedelta(days=20), commit=True)
        self.assertEqual(self.status_of(case_id), "Return Due")
        with app.app_context():
            self.assertTrue(WorkflowMessage.query.filter_by(
                student_id=self.student_id, template="Your leave of absence is ending").count())
            self.assertTrue(Task.query.filter_by(owner_role="Graduate School Staff", status="Pending",
                                                 title="Follow up with a student whose leave is ending").count())
            self.assertFalse(db.session.get(LeaveCase, case_id).awol_proposed_at)
            sync_leave_cases(today=end + timedelta(days=30), commit=True)
            case = db.session.get(LeaveCase, case_id)
            self.assertIsNotNone(case.awol_proposed_at)
            self.assertEqual(case.status, "Return Due")  # only proposed: a person confirms
        self.assertEqual(self.student_state()[0], "On Leave")
        shown = self.staff_client().get(f"/api/leave-cases/{case_id}").get_json()["case"]
        self.assertTrue(shown["awol_proposed"])  # staff see the proposal and must confirm it
        self.assertEqual([a["action"] for a in shown["actions"]], ["confirm_awol"])
        no_comment = self.act(self.staff_client(), case_id, "confirm_awol")
        self.assertEqual(no_comment.status_code, 400)
        confirmed = self.act(self.staff_client(), case_id, "confirm_awol", comment="No reply to two emails.")
        self.assertEqual(confirmed.status_code, 200, confirmed.get_json())
        self.assertEqual(self.status_of(case_id), "Expired")
        self.assertFalse(self.staff_client().get(f"/api/leave-cases/{case_id}").get_json()["case"]["awol_proposed"])
        self.assertEqual(self.student_state(), ("AWOL", "AWOL", "AWOL"))
        with app.app_context():
            self.assertEqual(AwolCase.query.filter_by(student_id=self.student_id).count(), 1)
            sync_automatic_awol_statuses(commit=True)
            self.assertEqual(AwolCase.query.filter_by(student_id=self.student_id).count(), 1)

    def test_a_student_on_leave_can_extend_once_and_only_right_after_the_leave(self):
        parent_id = self.make_on_leave("Running Term", "Running Term")
        overview = self.student_client().get("/api/student-portal/context").get_json()["leave_overview"]
        self.assertTrue(overview["can_file"]["extension"]["allowed"])
        self.assertFalse(overview["can_file"]["loa"]["allowed"])
        gap = self.file_loa("Term Two", "Term Two")
        self.assertEqual(gap.status_code, 400, gap.get_json())
        self.assertIn("right after", gap.get_json()["error"])
        ok = self.file_loa("Term One", "Term Two")
        self.assertEqual(ok.status_code, 200, ok.get_json())
        ext_id = self.case()
        with app.app_context():
            extension = db.session.get(LeaveCase, ext_id)
            self.assertEqual((extension.kind, extension.linked_case_id), ("LOA_EXTENSION", parent_id))
        self.act(self.staff_client(), ext_id, "forward")
        self.approve(ext_id)
        with app.app_context():
            parent = db.session.get(LeaveCase, parent_id)
            self.assertEqual(parent.end_term.label, "Term Two")
            self.assertEqual(parent.status, "On Leave")
            self.assertEqual(db.session.get(LeaveCase, ext_id).status, "Approved")
            labels = sorted(row.term.label for row in TermEnrollment.query.filter_by(status="LOA").all())
            self.assertEqual(labels, ["Running Term", "Term One", "Term Two"])
        again = self.file_loa("Term Three", "Term Three")
        self.assertEqual(again.status_code, 409, again.get_json())
        self.assertIn("only once", again.get_json()["error"])

    def test_readmission_is_only_for_a_student_on_leave_and_is_linked_to_that_leave(self):
        body = {"target_return_term": "Term Two", "return_intent": "I am ready to return.",
                "readmission_items": CHECKLIST}
        active = self.student_client().post("/api/student-portal/requests/readmission", json=body)
        self.assertEqual(active.status_code, 409, active.get_json())
        self.assertIn("not on leave", active.get_json()["error"])
        leave_id = self.make_on_leave("Running Term", "Term One")
        late = self.student_client().post("/api/student-portal/requests/readmission",
                                          json={**body, "target_return_term": "Past Term"})
        self.assertEqual(late.status_code, 400)
        ok = self.student_client().post("/api/student-portal/requests/readmission", json=body)
        self.assertEqual(ok.status_code, 200, ok.get_json())
        with app.app_context():
            case = LeaveCase.query.filter_by(kind="READMISSION").one()
            self.assertEqual(case.linked_case_id, leave_id)
            self.assertEqual(case.target_term.label, "Term Two")
            self.assertEqual(case.start_term.label, "Running Term")  # the leave being ended
            self.assertEqual({row["item"]: row["checked"] for row in leave_workflow_checklist(case)}, {i: True for i in CHECKLIST})
        # A second request while one is open is refused.
        dup = self.student_client().post("/api/student-portal/requests/readmission", json=body)
        self.assertEqual(dup.status_code, 409)
        # AWOL students use the AWOL return process.
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            student.standing, student.enrollment_tag = "AWOL", "AWOL"
            db.session.commit()
        blocked = self.student_client().post("/api/student-portal/requests/readmission", json=body)
        self.assertEqual(blocked.status_code, 409, blocked.get_json())
        self.assertIn("AWOL", blocked.get_json()["error"])

    def readmit(self, target="Term Two"):
        body = {"target_return_term": target, "return_intent": "I am ready to return.",
                "readmission_items": CHECKLIST}
        response = self.student_client().post("/api/student-portal/requests/readmission", json=body)
        self.assertEqual(response.status_code, 200, response.get_json())
        case_id = self.case()
        forwarded = self.act(self.staff_client(), case_id, "forward", confirmed_items=CHECKLIST)
        self.assertEqual(forwarded.status_code, 200, forwarded.get_json())
        self.approve(case_id)
        return case_id

    def test_an_approved_readmission_restores_the_stage_and_closes_the_leave(self):
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            student.current_stage = "Final Defense"
            db.session.commit()
        leave_id = self.make_on_leave("Running Term", "Term One")
        self.assertEqual(self.student_state(), ("On Leave", "LOA", "LOA"))
        case_id = self.readmit("Term Two")
        self.assertEqual(self.student_state(), ("Active", "Final Defense", "Not Enrolled"))
        with app.app_context():
            self.assertEqual(db.session.get(LeaveCase, case_id).status, "Approved")
            leave = db.session.get(LeaveCase, leave_id)
            self.assertEqual(leave.status, "Closed")
            self.assertIn("Readmitted", leave.closed_reason)
            self.assertEqual(Task.query.filter_by(owner_role="Academic Coordinator",
                                                  title="Review readmitted student study plan and enrollment").count(), 1)

    def test_returning_before_the_leave_ends_is_an_early_return_and_frees_the_later_semesters(self):
        leave_id = self.make_on_leave("Running Term", "Term One")
        self.readmit("Term One")
        with app.app_context():
            leave = db.session.get(LeaveCase, leave_id)
            self.assertEqual(leave.status, "Closed")
            self.assertIn("Early return", leave.closed_reason)
            labels = sorted(row.term.label for row in TermEnrollment.query.filter_by(status="LOA").all())
            self.assertEqual(labels, ["Running Term"])  # Term One is no longer a leave semester

    def test_a_student_can_file_a_second_leave_after_coming_back(self):
        self.make_on_leave("Running Term", "Running Term")
        self.readmit("Term One")
        second = self.file_loa("Term Two", "Term Three")
        self.assertEqual(second.status_code, 200, second.get_json())  # 1 + 2 = 3 of 4 semesters
        second_id = self.case()
        self.act(self.staff_client(), second_id, "forward")
        self.approve(second_id)
        with app.app_context():
            self.assertEqual(LeaveCase.query.filter_by(kind="LOA").count(), 2)
            self.assertEqual(db.session.get(LeaveCase, second_id).status, "Leave Scheduled")

    def test_the_checklist_is_stored_item_by_item_and_staff_verify_each_item(self):
        self.make_on_leave("Running Term", "Term One")
        response = self.student_client().post("/api/student-portal/requests/readmission", json={
            "target_return_term": "Term Two", "return_intent": "Ready.", "readmission_items": CHECKLIST})
        self.assertEqual(response.status_code, 200)
        case_id = self.case()
        detail = self.staff_client().get(f"/api/leave-cases/{case_id}").get_json()["case"]
        self.assertEqual([row["item"] for row in detail["checklist"]], CHECKLIST)
        self.assertTrue(all(row["checked"] for row in detail["checklist"]))
        self.assertFalse(any(row["confirmed"] for row in detail["checklist"]))  # staff start unverified
        self.act(self.staff_client(), case_id, "forward", confirmed_items=CHECKLIST[:2])
        detail = self.staff_client().get(f"/api/leave-cases/{case_id}").get_json()["case"]
        self.assertEqual([row["confirmed"] for row in detail["checklist"]], [True, True, False, False])
        self.assertEqual(detail["eligibility_result"], "Needs Review")
        self.assertEqual(detail["policy_snapshot"]["recommendation"], "Needs Review")

    def test_the_policy_check_uses_the_date_the_request_was_filed(self):
        with app.app_context():
            today = date.today()
            edge = AcademicTerm(label="Edge Term", start_date=today - timedelta(days=100), end_date=today + timedelta(days=10))
            db.session.add(edge)
            db.session.flush()
            case = LeaveCase(student_id=self.student_id, kind="LOA", status="Submitted", start_term_id=edge.id,
                             end_term_id=edge.id, start_label="Edge Term", end_label="Edge Term",
                             reason_category="Medical / health", reason_text="x",
                             submitted_at=datetime.utcnow() - timedelta(days=5))
            db.session.add(case)
            db.session.commit()
            from app import leave_policy_review
            filing = next(c for c in leave_policy_review(case)["checks"] if c["label"] == "Filing date")
            self.assertEqual(filing["status"], "Pass")  # 15 days were left when it was filed
            case.submitted_at = datetime.utcnow()
            filing = next(c for c in leave_policy_review(case)["checks"] if c["label"] == "Filing date")
            self.assertEqual(filing["status"], "Fail")  # only 10 days left today

    # ---- one task per step, notices on every step ---------------------------------------
    def open_tasks(self, owner):
        with app.app_context():
            return sorted(t.title for t in Task.query.filter(
                Task.student_id == self.student_id, Task.status == "Pending",
                Task.owner_role.in_([owner, "GS Staff"] if owner == "Graduate School Staff" else [owner])).all())

    def test_each_step_leaves_exactly_one_open_task_for_the_next_owner(self):
        self.file_loa()
        case_id = self.case()
        self.assertEqual(self.open_tasks("Graduate School Staff"), ["Review student Leave of Absence application"])
        self.act(self.staff_client(), case_id, "start_review")
        self.assertEqual(self.open_tasks("Graduate School Staff"), ["Review student Leave of Absence application"])
        self.act(self.staff_client(), case_id, "forward")
        self.assertEqual(self.open_tasks("Graduate School Staff"), [])
        self.assertEqual(self.open_tasks("Dean"), ["Decide Leave of Absence request"])
        self.approve(case_id)
        self.assertEqual(self.open_tasks("Dean"), [])
        self.assertEqual(self.open_tasks("Graduate School Staff"), ["Send the approved Leave of Absence to the Registrar"])

    def test_a_denial_gives_staff_a_follow_up_and_tells_the_student_what_happens_next(self):
        case_id = self.file_and_forward()
        self.act(self.dean_client(), case_id, "deny", comment="Two leaves are already on file.")
        self.assertEqual(self.open_tasks("Graduate School Staff"), ["Tell the student about the denied Leave of Absence"])
        with app.app_context():
            notice = WorkflowMessage.query.filter_by(student_id=self.student_id,
                                                     template="Your Leave of Absence request was denied").one()
            self.assertIn("Two leaves are already on file.", notice.comment)
            self.assertEqual(notice.visibility, "student_visible")

    def test_the_student_gets_a_notice_for_every_step(self):
        case_id = self.file_and_forward()
        self.approve(case_id)
        with app.app_context():
            titles = [m.template for m in WorkflowMessage.query.filter_by(
                student_id=self.student_id, recipient_role="Student", visibility="student_visible").order_by(WorkflowMessage.id)]
        self.assertEqual(titles[:2], ["Your Leave of Absence request was submitted", "Your Leave of Absence request is with the Dean"])
        self.assertIn("Your Leave of Absence request was approved", titles)

    def test_the_student_context_carries_case_cards_timeline_and_what_may_be_filed(self):
        case_id = self.file_and_forward()
        overview = self.student_client().get("/api/student-portal/context").get_json()["leave_overview"]
        card = overview["cases"][0]
        self.assertEqual((card["id"], card["status"], card["status_label"]), (case_id, "Dean Review", "With the Dean"))
        self.assertEqual([step["state"] for step in card["timeline"]][:3], ["complete", "complete", "current"])
        self.assertEqual(card["owner"], "Dean")
        self.assertEqual([a["action"] for a in card["actions"] if a["action"] != "withdraw"], [])
        self.assertFalse(overview["can_file"]["loa"]["allowed"])
        self.assertIn("already in progress", overview["can_file"]["loa"]["reason"])
        self.assertTrue(card["history"])
        self.assertTrue(card["messages"])

    # ---- several at once ------------------------------------------------------------------
    def extra_student(self, number):
        """Another student with a portal account; returns (student_id, client)."""
        with app.app_context():
            student = Student(
                student_number=f"GS-LVE-{number}", first_name=f"Extra{number}", last_name="Student",
                email=f"extra{number}@example.test", program_id=self.program_id,
                entry_year=date.today().year - 1, academic_year_entry="25-26", year_level="1",
                current_stage="Coursework", standing="Active", enrollment_tag="Enrolled",
            )
            db.session.add(student)
            db.session.flush()
            account = self._account("student", f"extra{number}@example.test")
            account.student_id = student.id
            db.session.commit()
            return student.id, self._client(account.id, "student")

    def test_staff_forward_several_requests_together_and_the_dean_decides_them_together(self):
        ids = []
        for number in (2, 3):
            _sid, client = self.extra_student(number)
            self.assertEqual(self.file_loa(client=client).status_code, 200)
            ids.append(self.case())
        self.assertEqual(self.file_loa().status_code, 200)
        withdrawn_id = self.case()
        self.student_client().post(f"/api/student-portal/leave-cases/{withdrawn_id}/withdraw")
        staff = self.staff_client()
        batch = staff.post("/api/leave-cases/batch", json={
            "case_ids": ids + [withdrawn_id], "action": "forward", "batch_name": "LOA Batch AY 2026-2027 1st Sem"})
        self.assertEqual(batch.status_code, 200, batch.get_json())
        body = batch.get_json()
        self.assertEqual(len(body["updated"]), 2)
        self.assertEqual([row["case_id"] for row in body["skipped"]], [withdrawn_id])
        self.assertIn("not available", body["skipped"][0]["reason"])
        with app.app_context():
            self.assertEqual({LeaveCase.query.get(i).batch_name for i in ids}, {"LOA Batch AY 2026-2027 1st Sem"})
        # Staff cannot make the Dean's decision, even for a whole batch.
        refused = staff.post("/api/leave-cases/batch", json={"case_ids": ids, "action": "approve"})
        self.assertEqual(len(refused.get_json()["skipped"]), 2)
        dean = self.dean_client()
        no_reason = dean.post("/api/leave-cases/batch", json={"case_ids": ids, "action": "return"})
        self.assertEqual(no_reason.status_code, 400)
        approved = dean.post("/api/leave-cases/batch", json={"case_ids": ids, "action": "approve", "comment": "Approved together."})
        self.assertEqual(len(approved.get_json()["updated"]), 2, approved.get_json())
        self.assertEqual({self.status_of(i) for i in ids}, {"Leave Scheduled"})
        not_batchable = staff.post("/api/leave-cases/batch", json={"case_ids": ids, "action": "start_review"})
        self.assertEqual(not_batchable.status_code, 400)

    # ---- Registrar list ---------------------------------------------------------------------
    def test_the_registrar_list_is_case_based_with_handoff_states_and_an_export_log(self):
        first = self.file_and_forward()
        self.approve(first)
        _sid, other_client = self.extra_student(2)
        self.assertEqual(self.file_loa(client=other_client).status_code, 200)
        second = self.case()
        self.act(self.staff_client(), second, "forward")
        self.approve(second)
        staff = self.staff_client()
        self.assertEqual(self.dean_client().post("/api/leave-cases/registrar-export", json={"slug": "leave-of-absence"}).status_code, 403)
        exported = staff.post("/api/leave-cases/registrar-export", json={"slug": "leave-of-absence", "format": "csv"})
        self.assertEqual(exported.status_code, 200)
        text = exported.get_data(as_text=True)
        self.assertIn("GS-LVE-1", text)
        self.assertIn("GS-LVE-2", text)
        self.assertIn("Term One", text)
        self.assertIn("Term Two", text)
        self.assertEqual(exported.headers["X-Exported-Count"], "2")
        with app.app_context():
            for case_id in (first, second):
                case = db.session.get(LeaveCase, case_id)
                self.assertEqual(case.registrar_status, "Exported - Ready to Send")
                self.assertIsNotNone(case.registrar_exported_at)
        # Exporting again gives the same list and does not repeat the per-case history.
        again = staff.post("/api/leave-cases/registrar-export", json={"slug": "leave-of-absence", "format": "xlsx"})
        self.assertEqual(again.status_code, 200)
        from openpyxl import load_workbook
        from io import BytesIO
        sheet = load_workbook(BytesIO(again.data)).active
        numbers = [cell.value for cell in sheet["B"] if cell.value and str(cell.value).startswith("GS-LVE")]
        self.assertEqual(sorted(numbers), ["GS-LVE-1", "GS-LVE-2"])
        with app.app_context():
            exports = [e for e in LeaveCaseEvent.query.filter_by(case_id=first).all() if e.action == "export"]
            self.assertEqual(len(exports), 1)
        log = staff.get("/api/leave-cases/export-log?slug=leave-of-absence").get_json()["items"]
        self.assertEqual([item["case_count"] for item in log], [2, 2])
        self.assertEqual({item["file_format"] for item in log}, {"csv", "xlsx"})
        # Sent, then acknowledged, one step at a time.
        skip = staff.post("/api/leave-cases/handoff", json={"case_ids": [first], "status": "Acknowledged"})
        self.assertEqual(len(skip.get_json()["skipped"]), 1)
        sent = staff.post("/api/leave-cases/handoff", json={"case_ids": [first, second], "status": "Sent to Registrar"})
        self.assertEqual(len(sent.get_json()["updated"]), 2)
        done = staff.post("/api/leave-cases/handoff", json={"case_ids": [first], "status": "Acknowledged"})
        self.assertEqual(len(done.get_json()["updated"]), 1)
        with app.app_context():
            self.assertEqual(db.session.get(LeaveCase, first).registrar_status, "Acknowledged")
            self.assertEqual(db.session.get(LeaveCase, second).registrar_status, "Sent to Registrar")
        nothing = staff.post("/api/leave-cases/registrar-export", json={"slug": "leave-of-absence"})
        self.assertEqual(nothing.status_code, 400)  # nothing is waiting any more

    def test_a_request_that_was_not_approved_never_reaches_the_registrar_list(self):
        self.assertEqual(self.file_loa().status_code, 200)
        case_id = self.case()
        response = self.staff_client().post("/api/leave-cases/registrar-export", json={"slug": "leave-of-absence", "case_ids": [case_id]})
        self.assertEqual(response.status_code, 409, response.get_json())

    def test_the_per_student_registrar_sheet_uses_the_latest_approved_case(self):
        case_id = self.file_and_forward()
        self.approve(case_id)
        sheet = self.staff_client().get(f"/api/standing-changes/leave-of-absence/{self.student_id}/registrar-report")
        self.assertEqual(sheet.status_code, 200)
        self.assertIn("GS-LVE-1", sheet.get_data(as_text=True))
        denied = self.staff_client().get(f"/api/standing-changes/readmission/{self.student_id}/registrar-report")
        self.assertEqual(denied.status_code, 400)

    # ---- the Dean's routes ---------------------------------------------------------------------
    def test_the_dean_page_lists_cases_and_the_old_decide_route_takes_the_case_id(self):
        case_id = self.file_and_forward()
        payload = self.dean_client().get("/api/approvals").get_json()
        item = next(i for i in payload["workflow_pending"] if i["type"] == "leave-of-absence")
        self.assertEqual(item["id"], case_id)
        with app.app_context():
            # Academic-year count (entry AY = year 1, steps up in June), the one shared definition.
            expected_years = app_module.years_in_program(Student.query.get(self.student_id))
        self.assertEqual(item["case"]["student_summary"]["years_in_program"], expected_years)
        self.assertIn("checks", item["case"]["policy_review"])
        self.assertEqual(item["case"]["earlier_cases"], [])
        wrong = self.dean_client().post(f"/api/approvals/workflow/readmission/{case_id}/decide", json={"decision": "approve"})
        self.assertEqual(wrong.status_code, 400)
        no_note = self.dean_client().post(f"/api/approvals/workflow/leave-of-absence/{case_id}/decide", json={"decision": "deny"})
        self.assertEqual(no_note.status_code, 400)
        ok = self.dean_client().post(f"/api/approvals/workflow/leave-of-absence/{case_id}/decide", json={"decision": "approve"})
        self.assertEqual(ok.status_code, 200, ok.get_json())
        again = self.dean_client().post(f"/api/approvals/workflow/leave-of-absence/{case_id}/decide", json={"decision": "approve"})
        self.assertEqual(again.status_code, 400)
        recent = self.dean_client().get("/api/approvals").get_json()["workflow_recent"]
        self.assertTrue(any(i["id"] == case_id for i in recent))

    # ---- AW-01: an AWOL return that needs full re-enrollment is finished by staff -----------------
    def awol_student_with_case(self, status="Re-enrollment Required"):
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            student.standing, student.current_stage, student.enrollment_tag = "AWOL", "AWOL", "AWOL"
            case = AwolCase(
                student_id=student.id, status=status, dean_decision="Approved for Re-enrollment Review",
                full_reenrollment_required=True, automatically_flagged_at=datetime.utcnow(),
                awol_effective_date=date.today() - timedelta(days=400),
            )
            db.session.add(case)
            db.session.commit()
            return case.id

    def test_reenrollment_required_does_not_spawn_a_second_awol_case(self):
        awol_id = self.awol_student_with_case()
        with app.app_context():
            sync_automatic_awol_statuses(commit=True)
            self.assertEqual(AwolCase.query.filter_by(student_id=self.student_id).count(), 1)
            self.assertEqual(db.session.get(AwolCase, awol_id).status, "Re-enrollment Required")

    def test_staff_can_complete_a_full_reenrollment_and_the_student_is_active_again(self):
        awol_id = self.awol_student_with_case()
        with app.app_context():
            from app import StudentMonitoringFlag
            db.session.add(StudentMonitoringFlag(student_id=self.student_id, category="AWOL policy alert",
                                                 note="flag", source="Automatic", status="Open"))
            db.session.commit()
        response = self.staff_client().post("/api/transactions/awol", json={
            "student_id": self.student_id, "workflow_action": "complete_reenrollment", "case_id": awol_id,
            "staff_notes": "All courses re-enrolled with the Academic Coordinator."})
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(self.student_state(), ("Active", "Coursework", "Not Enrolled"))
        with app.app_context():
            self.assertEqual(db.session.get(AwolCase, awol_id).status, "Re-enrollment Completed")
            self.assertEqual(StudentMonitoringFlag.query.filter_by(student_id=self.student_id, status="Open").count(), 0)
            sync_automatic_awol_statuses(commit=True)
            self.assertEqual(AwolCase.query.filter_by(student_id=self.student_id).count(), 1)
            self.assertEqual(db.session.get(Student, self.student_id).standing, "Active")

    def test_complete_reenrollment_is_refused_for_other_awol_statuses(self):
        awol_id = self.awol_student_with_case(status="AWOL Declared")
        response = self.staff_client().post("/api/transactions/awol", json={
            "student_id": self.student_id, "workflow_action": "complete_reenrollment", "case_id": awol_id})
        self.assertEqual(response.status_code, 400, response.get_json())
        self.assertIn("re-enrollment", response.get_json()["error"].lower())

    # ---- reports read the case table -----------------------------------------------------------------
    def test_the_leave_report_lists_pending_denied_and_withdrawn_requests_too(self):
        self.assertEqual(self.file_loa().status_code, 200)
        pending_id = self.case()
        _s2, client2 = self.extra_student(2)
        self.file_loa(client=client2)
        denied_id = self.case()
        self.act(self.staff_client(), denied_id, "forward")
        self.act(self.dean_client(), denied_id, "deny", comment="No.")
        from app import reports_payload
        with app.app_context():
            rows = reports_payload({})["loa_readmission"]["rows"]
        by_id = {row["id"]: row for row in rows}
        self.assertEqual(by_id[pending_id]["status"], "Submitted")
        self.assertEqual(by_id[denied_id]["status"], "Denied")
        self.assertEqual(by_id[denied_id]["kind_label"], "Leave of Absence")
        self.assertEqual(by_id[pending_id]["owner"], "Graduate School Staff")

    # ---- the task list links to the right page -------------------------------------------------------------
    def test_work_queue_tasks_for_leave_and_readmission_link_to_their_pages(self):
        self.file_loa()
        from app import task_dict
        with app.app_context():
            task = Task.query.filter(Task.title.contains("Leave of Absence")).first()
            self.assertEqual(task_dict(task)["action_url"], "/workflow/leave-of-absence")
            other = Task(student_id=self.student_id, title="Review student readmission request",
                         owner_role="Graduate School Staff", due_at=date.today(), status="Pending")
            db.session.add(other)
            db.session.flush()
            self.assertEqual(task_dict(other)["action_url"], "/workflow/readmission")

    # ---- a term used by a leave request cannot be deleted ----------------------------------------------------
    def test_a_semester_used_by_a_leave_request_cannot_be_removed(self):
        self.assertEqual(self.file_loa().status_code, 200)
        response = self.staff_client().delete(
            f"/api/admin/terms/{self.term_ids['Term One']}", json={"confirmed_label": "Term One"})
        self.assertEqual(response.status_code, 409, response.get_json())
        self.assertIn("leave or readmission", response.get_json()["error"])

    # ---- the demo students keep their stories ------------------------------------------------------
    def test_the_demo_students_keep_their_stories_on_the_case_table(self):
        from app import get_active_term, seed_database
        with app.app_context():
            seed_database()
        items = app.test_client().get("/api/auth/demo-students").get_json()["items"]
        by_key = {item["key"]: item for item in items}

        def login(key):
            client = app.test_client()
            response = client.post("/api/auth/login", json={"email": by_key[key]["email"], "password": by_key[key]["password"]})
            self.assertEqual(response.status_code, 200, response.get_json())
            return client

        with app.app_context():
            benjamin = Student.query.filter_by(student_number="2460003").one()
            loa = LeaveCase.query.filter_by(student_id=benjamin.id).one()
            self.assertEqual((loa.kind, loa.status, loa.source), ("LOA", "Submitted", "migrated"))
            maria = Student.query.filter_by(student_number="2460009").one()
            back = LeaveCase.query.filter_by(student_id=maria.id).one()
            self.assertEqual((back.kind, back.status), ("READMISSION", "Submitted"))

        # Daniel is active and may file a leave; Maureen too.
        daniel = login("leave-of-absence-daniel").get("/api/student-portal/context").get_json()
        self.assertEqual(daniel["student"]["standing"], "Active")
        self.assertTrue(daniel["leave_overview"]["can_file"]["loa"]["allowed"])

        # Therese and Gabriel are on an approved leave that is a real case.
        therese_client = login("readmission-therese")
        context = therese_client.get("/api/student-portal/context").get_json()
        self.assertEqual(context["student"]["standing"], "On Leave")
        permission = context["leave_overview"]["can_file"]["readmission"]
        self.assertTrue(permission["allowed"], permission)
        self.assertTrue(permission["linked_case_id"])
        target = context["leave_overview"]["return_semester_options"][1]
        filed = therese_client.post("/api/student-portal/requests/readmission", json={
            "target_return_term": target, "return_intent": "I am ready to return.", "readmission_items": CHECKLIST})
        self.assertEqual(filed.status_code, 200, filed.get_json())
        # Signing in again must not undo her progress.
        again = login("readmission-therese").get("/api/student-portal/context").get_json()
        self.assertEqual(again["student"]["standing"], "On Leave")
        self.assertEqual(again["leave_overview"]["cases"][0]["status"], "Submitted")
        with app.app_context():
            gabriel = Student.query.filter_by(student_number="GS-2026-READ-02").one()
            leave = LeaveCase.query.filter_by(student_id=gabriel.id, kind="LOA").one()
            self.assertEqual((leave.status, leave.start_label, leave.end_label),
                             ("On Leave", "AY 2026-2027 1st Semester", "AY 2026-2027 2nd Semester"))
        # Reset gives her the starting point again: still on her leave, no readmission request.
        reset = app.test_client().post("/api/auth/demo-students/readmission-therese/reset")
        self.assertEqual(reset.status_code, 200, reset.get_json())
        with app.app_context():
            therese = Student.query.filter_by(student_number="GS-2026-READ-01").one()
            self.assertEqual(LeaveCase.query.filter_by(student_id=therese.id, kind="READMISSION").count(), 0)
            self.assertEqual(LeaveCase.query.filter_by(student_id=therese.id, kind="LOA").one().status, "On Leave")
            self.assertEqual((therese.standing, therese.enrollment_tag), ("On Leave", "LOA"))

    def test_a_demo_leave_survives_signing_in_again_and_reset_restores_the_closed_subjects(self):
        from app import get_active_term, seed_database
        with app.app_context():
            seed_database()
        items = app.test_client().get("/api/auth/demo-students").get_json()["items"]
        maureen = next(item for item in items if item["key"] == "leave-of-absence-maureen")
        client = app.test_client()
        client.post("/api/auth/login", json={"email": maureen["email"], "password": maureen["password"]})
        with app.app_context():
            student = Student.query.filter_by(student_number="GS-2026-LOA-01").one()
            student_id = student.id
            enrolled_before = SubjectEnrollment.query.filter_by(student_id=student_id, status="Enrolled").count()
            self.assertGreater(enrolled_before, 0)
            term = get_active_term()
            staff = UserAccount.query.filter_by(email="staff@usls.edu.ph").one()
            dean = UserAccount.query.filter_by(email="dean@usls.edu.ph").one()
            staff_id, dean_id = staff.id, dean.id
            running = term.label
        body = {"effective_start": running, "effective_end": running, "reason_category": "Medical / health",
                "reason_remarks": "Recovery."}
        filed = client.post("/api/student-portal/requests/leave-of-absence", json=body)
        self.assertEqual(filed.status_code, 200, filed.get_json())
        with app.app_context():
            case_id = LeaveCase.query.filter_by(student_id=student_id).one().id
        self.assertEqual(self._client(staff_id, "staff").post(f"/api/leave-cases/{case_id}/transition", json={"action": "forward"}).status_code, 200)
        self.assertEqual(self._client(dean_id, "dean").post(f"/api/leave-cases/{case_id}/transition", json={"action": "approve"}).status_code, 200)
        with app.app_context():
            self.assertEqual(SubjectEnrollment.query.filter_by(student_id=student_id, status="Enrolled").count(), 0)
        # Signing in again does not put her back in class or undo the leave.
        client.post("/api/auth/login", json={"email": maureen["email"], "password": maureen["password"]})
        with app.app_context():
            self.assertEqual(SubjectEnrollment.query.filter_by(student_id=student_id, status="Enrolled").count(), 0)
            self.assertEqual(db.session.get(Student, student_id).standing, "On Leave")
        reset = app.test_client().post("/api/auth/demo-students/leave-of-absence-maureen/reset")
        self.assertEqual(reset.status_code, 200, reset.get_json())
        with app.app_context():
            self.assertEqual(LeaveCase.query.filter_by(student_id=student_id).count(), 0)
            self.assertEqual(db.session.get(Student, student_id).standing, "Active")
            self.assertEqual(SubjectEnrollment.query.filter_by(student_id=student_id, status="Enrolled").count(), enrolled_before)

    # ---- guard rails ---------------------------------------------------------------------------
    def test_the_message_window_return_goes_through_the_same_guarded_step(self):
        self.assertEqual(self.file_loa().status_code, 200)
        case_id = self.case()
        to_dean = self.staff_client().post("/api/transactions/leave-of-absence/messages", json={
            "student_id": self.student_id, "action_type": "return", "recipient_role": "Dean",
            "template": "Remarks", "comment": "Back to the Dean."})
        self.assertEqual(to_dean.status_code, 400, to_dean.get_json())
        no_reason = self.staff_client().post("/api/transactions/leave-of-absence/messages", json={
            "student_id": self.student_id, "action_type": "return", "recipient_role": "Student",
            "template": "Remarks", "comment": ""})
        self.assertEqual(no_reason.status_code, 400)
        returned = self.staff_client().post("/api/transactions/leave-of-absence/messages", json={
            "student_id": self.student_id, "action_type": "return", "recipient_role": "Student",
            "template": "Remarks", "comment": "Please name the semester you mean."})
        self.assertEqual(returned.status_code, 200, returned.get_json())
        self.assertEqual(self.status_of(case_id), "Returned")
        with app.app_context():
            self.assertIn("return", [event.action for event in db.session.get(LeaveCase, case_id).events])
        # Once the Dean has the request it cannot be returned by staff from the message window.
        self.file_loa("Term One", "Term One")
        self.act(self.staff_client(), case_id, "forward")
        blocked = self.staff_client().post("/api/transactions/leave-of-absence/messages", json={
            "student_id": self.student_id, "action_type": "return", "recipient_role": "Student",
            "template": "Remarks", "comment": "Too late."})
        self.assertEqual(blocked.status_code, 400, blocked.get_json())
        self.assertEqual(self.status_of(case_id), "Dean Review")

    def test_students_only_reach_their_own_cases_and_only_while_the_step_is_open(self):
        self.assertEqual(self.file_loa().status_code, 200)
        case_id = self.case()
        _sid, other = self.extra_student(2)
        self.assertEqual(other.post(f"/api/student-portal/leave-cases/{case_id}/withdraw").status_code, 404)
        self.assertEqual(self.student_client().post(f"/api/student-portal/leave-cases/{case_id}/approve").status_code, 400)
        self.act(self.staff_client(), case_id, "forward")
        self.approve(case_id)
        late = self.student_client().post(f"/api/student-portal/leave-cases/{case_id}/withdraw")
        self.assertEqual(late.status_code, 409, late.get_json())
        self.assertEqual(self.status_of(case_id), "Leave Scheduled")

    def test_staff_can_revoke_a_leave_before_it_starts_but_must_give_a_reason(self):
        case_id = self.file_and_forward()
        self.approve(case_id)
        self.assertEqual(self.act(self.staff_client(), case_id, "revoke").status_code, 400)
        done = self.act(self.staff_client(), case_id, "revoke", comment="The student asked us to cancel by email.")
        self.assertEqual(done.status_code, 200, done.get_json())
        self.assertEqual(self.status_of(case_id), "Cancelled")
        self.assertEqual(self.student_state(), ("Active", "Coursework", "Enrolled"))
        self.assertEqual(self.file_loa("Term Three", "Term Three").status_code, 200)

    def test_students_who_are_awol_or_finished_cannot_file_a_leave(self):
        for standing, tag in (("AWOL", "AWOL"), ("Active", "Completed")):
            with app.app_context():
                student = db.session.get(Student, self.student_id)
                student.standing, student.enrollment_tag = standing, tag
                db.session.commit()
            response = self.file_loa()
            self.assertEqual(response.status_code, 409, response.get_json())
        with app.app_context():
            self.assertEqual(LeaveCase.query.count(), 0)

    def test_running_the_date_sweep_twice_changes_nothing_the_second_time(self):
        case_id = self.make_on_leave("Running Term", "Running Term")
        with app.app_context():
            end = AcademicTerm.query.filter_by(label="Running Term").one().end_date
            sync_leave_cases(today=end + timedelta(days=30), commit=True)
            tasks = Task.query.count()
            events = LeaveCaseEvent.query.count()
            messages = WorkflowMessage.query.count()
            second = sync_leave_cases(today=end + timedelta(days=30), commit=True)
            self.assertEqual((second["started"], second["return_due"], second["awol_proposed"]), (0, 0, 0))
            self.assertEqual((Task.query.count(), LeaveCaseEvent.query.count(), WorkflowMessage.query.count()),
                             (tasks, events, messages))

    def test_a_pending_return_stops_the_awol_proposal(self):
        case_id = self.make_on_leave("Running Term", "Running Term")
        self.assertTrue(case_id)
        body = {"target_return_term": "Term One", "return_intent": "Ready.", "readmission_items": CHECKLIST}
        self.assertEqual(self.student_client().post("/api/student-portal/requests/readmission", json=body).status_code, 200)
        with app.app_context():
            end = AcademicTerm.query.filter_by(label="Running Term").one().end_date
            sync_leave_cases(today=end + timedelta(days=60), commit=True)
            self.assertIsNone(db.session.get(LeaveCase, case_id).awol_proposed_at)
        shown = self.staff_client().get(f"/api/leave-cases/{case_id}").get_json()["case"]
        self.assertFalse(shown["awol_proposed"])

    def test_an_unverified_readmission_checklist_reaches_the_dean_as_needs_review(self):
        self.make_on_leave("Running Term", "Term One")
        body = {"target_return_term": "Term Two", "return_intent": "Ready.", "readmission_items": CHECKLIST}
        self.assertEqual(self.student_client().post("/api/student-portal/requests/readmission", json=body).status_code, 200)
        case_id = self.case()
        self.assertEqual(self.act(self.staff_client(), case_id, "forward").status_code, 200)
        detail = self.dean_client().get(f"/api/leave-cases/{case_id}").get_json()["case"]
        self.assertEqual(detail["eligibility_result"], "Needs Review")
        self.assertFalse(any(row["confirmed"] for row in detail["checklist"]))
        bad = self.act(self.staff_client(), self.case(), "forward", confirmed_items=["Made-up item"])
        self.assertIn(bad.status_code, {400, 409})

    def test_the_old_staff_context_still_serves_case_rows(self):
        self.assertEqual(self.file_loa().status_code, 200)
        context = self.staff_client().get("/api/transactions/leave-of-absence/context").get_json()
        rows = context["submitted_requests"]
        self.assertEqual(len(rows), 1)
        self.assertEqual((rows[0]["status"], rows[0]["student"]["id"]), ("Submitted", self.student_id))
        self.assertEqual(rows[0]["effective_start"], "Term One")

    def test_timeline_states_show_where_a_case_stopped(self):
        steps = leave_workflow.timeline_steps
        self.assertEqual([s["state"] for s in steps("LOA", "Dean Review", {"Submitted", "Dean Review"})][:4],
                         ["complete", "complete", "current", "upcoming"])
        self.assertEqual([s["state"] for s in steps("LOA", "Returned", {"Submitted", "Staff Review", "Returned"})][:3],
                         ["complete", "returned", "upcoming"])
        self.assertEqual([s["state"] for s in steps("LOA", "Denied", {"Submitted", "Dean Review", "Denied"})][:4],
                         ["complete", "complete", "denied", "upcoming"])
        self.assertEqual({s["state"] for s in steps("LOA", "Closed", set())}, {"complete"})
        self.assertEqual({s["state"] for s in steps("READMISSION", "Approved", set())}, {"complete"})
        self.assertEqual([s["state"] for s in steps("LOA", "On Leave", set())],
                         ["complete", "complete", "complete", "current", "upcoming", "upcoming"])


if __name__ == "__main__":
    unittest.main()
