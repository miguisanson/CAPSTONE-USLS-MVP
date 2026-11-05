"""Audit round 4 fixes (process audit 2026-11-04): one test class per row."""

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


class Audit4Base(unittest.TestCase):
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
            program = Program(code="A4", name="Audit Three Program", college="Graduate School", has_practicum=False)
            db.session.add(program)
            db.session.flush()
            self.program_id = program.id
            course = Course(program_id=program.id, code="A4-501", title="Audit Course", units=3, category="Major")
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
            for number, first in (("A4-1", "Ana"), ("A4-2", "Ben")):
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
                    email=f"a4-{role}@example.test", full_name=f"Test {role}", role=role, active=True,
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


class PracticumClosedStandingTests(Audit4Base):
    """I-290: an AWOL / On Leave student is refused at submit, with the reason, not left in a dead end."""

    def make_practicum_student(self, standing, tag):
        from app import PracticumRecord
        with app.app_context():
            program = db.session.get(Program, self.program_id)
            program.has_practicum = True
            program.code = "MSGC"
            program.name = "Master of Science in Guidance and Counseling"
            student = db.session.get(Student, self.student_id)
            student.standing, student.enrollment_tag = standing, tag
            db.session.add(PracticumRecord(student_id=student.id, status="Practicum In Progress", required_hours=200, moa_uploaded=True))
            db.session.commit()

    def test_awol_student_is_refused_with_reason(self):
        self.make_practicum_student("AWOL", "AWOL")
        response = self.client("student").post("/api/student-portal/requests/practicum", json={"remarks": "x"})
        self.assertEqual(response.status_code, 409, response.get_json())
        self.assertIn("AWOL", response.get_json()["error"])
        self.assertIn("practicum", response.get_json()["error"])

    def test_on_leave_student_is_refused(self):
        self.make_practicum_student("On Leave", "LOA")
        response = self.client("student").post("/api/student-portal/requests/practicum", json={"remarks": "x"})
        self.assertEqual(response.status_code, 409, response.get_json())
        self.assertIn("On Leave", response.get_json()["error"])

    def test_active_student_is_not_blocked_by_standing(self):
        self.make_practicum_student("Active", "Enrolled")
        response = self.client("student").post("/api/student-portal/requests/practicum", json={"remarks": "x"})
        self.assertNotEqual(response.status_code, 409, response.get_json())
        self.assertNotIn("not an active student", str(response.get_json()))


class PanelEligibleRolesTests(Audit4Base):
    """I-283: a faculty profile that does not list Panel Chair / Panel Member cannot be seated, and the refusal says why."""

    def make_faculty(self, name, roles):
        import json
        with app.app_context():
            faculty = Faculty(name=name, college="Graduate School", role="Professor", specialization="Testing",
                              email=f"{name.split()[0].lower()}@example.test", active=True,
                              eligible_roles=json.dumps(roles) if roles is not None else None)
            db.session.add(faculty)
            db.session.flush()
            db.session.add(UserAccount(email=f"p-{faculty.id}@example.test", full_name=name, role="faculty", active=True,
                                       password_hash=generate_password_hash("x"), faculty_id=faculty.id))
            db.session.commit()
            return faculty.id

    def select(self, ids):
        from app import RESEARCH_GATE_TITLE, validate_panel_selection
        with app.app_context():
            return validate_panel_selection(db.session.get(Student, self.student_id), RESEARCH_GATE_TITLE, ids)

    def test_member_without_panel_member_role_is_refused(self):
        everyone = ["Faculty Adviser", "Panel Member", "Panel Chair"]
        chair, content = self.make_faculty("Chair One", everyone), self.make_faculty("Content One", everyone)
        method = self.make_faculty("Method One", ["Faculty Adviser", "Panel Chair"])
        with self.assertRaises(ValueError) as caught:
            self.select([chair, content, method])
        self.assertIn("Method One", str(caught.exception))
        self.assertIn("Panel Member", str(caught.exception))

    def test_chair_without_panel_chair_role_is_refused(self):
        everyone = ["Faculty Adviser", "Panel Member", "Panel Chair"]
        chair = self.make_faculty("Chair Two", ["Panel Member"])
        content, method = self.make_faculty("Content Two", everyone), self.make_faculty("Method Two", everyone)
        with self.assertRaises(ValueError) as caught:
            self.select([chair, content, method])
        self.assertIn("Panel Chair", str(caught.exception))

    def test_eligible_or_unset_profiles_are_accepted(self):
        chair = self.make_faculty("Chair Three", ["Panel Chair"])
        content = self.make_faculty("Content Three", None)
        method = self.make_faculty("Method Three", ["Panel Member"])
        self.assertEqual(len(self.select([chair, content, method])), 3)


from datetime import date as _date  # noqa: E402
from tests.test_research_core import PROPOSAL, TITLE, ResearchCoreBase, future_weekday  # noqa: E402


class PanelAcceptanceTaskTests(ResearchCoreBase):
    """I-314: booking warns about unanswered panel invitations; the acceptance task closes on acceptance, not on booking."""

    FOUR = ["Chair Person", "Content Person", "Method Person", "External Person"]
    TASK = "Confirm assigned panel acceptance (Proposal Defense)"

    def setUp(self):
        super().setUp()
        patcher = patch("app.faculty_calendar_blocks", return_value=[], create=True)
        patcher.start()
        self.addCleanup(patcher.stop)
        from app import ensure_open_task
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            self.fill_uploads(self.student_id, PROPOSAL, status="Complete")
            self.panel(self.student_id, PROPOSAL, self.FOUR)
            ensure_open_task(self.student_id, self.TASK, "Research Coordinator", 3)
            db.session.commit()

    def book(self):
        return self.staff().post("/api/transactions/defense-scheduling", json={
            "student_id": self.student_id, "preferred_date": future_weekday(21).isoformat(),
            "selected_start": "09:00", "selected_end": "11:00", "defense_type": "Proposal Defense",
            "mode": "Online", "venue": "Zoom room A",
        })

    def task_status(self):
        from app import Task
        with app.app_context():
            return Task.query.filter_by(student_id=self.student_id, title=self.TASK).one().status

    def test_booking_warns_who_has_not_answered_and_keeps_the_task(self):
        response = self.book()
        self.assertEqual(response.status_code, 200, response.get_json())
        message = response.get_json()["message"]
        self.assertIn("not yet answered", message)
        for name in self.FOUR:
            self.assertIn(name, message)
        self.assertEqual(self.task_status(), "Pending")

    def test_task_closes_when_the_last_panelist_accepts(self):
        from app import PanelInvitation
        self.assertEqual(self.book().status_code, 200)
        with app.app_context():
            ids = [(row.id, row.faculty_id) for row in PanelInvitation.query.filter_by(student_id=self.student_id, gate=PROPOSAL).all()]
        names = {self.faculty_ids[name]: name for name in self.FOUR}
        for position, (invitation_id, faculty_id) in enumerate(ids):
            self.assertEqual(self.task_status(), "Pending", position)
            response = self.faculty_client(names[faculty_id]).post(
                f"/api/faculty-portal/panel-invitations/{invitation_id}/respond", json={"response": "accept"})
            self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(self.task_status(), "Done")

    def test_no_warning_when_everyone_already_accepted(self):
        from app import PanelInvitation
        with app.app_context():
            for row in PanelInvitation.query.filter_by(student_id=self.student_id, gate=PROPOSAL).all():
                row.status = "Accepted"
            db.session.commit()
        response = self.book()
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertNotIn("not yet answered", response.get_json()["message"])
        self.assertEqual(self.task_status(), "Done")


class DefenseModeVocabularyTests(unittest.TestCase):
    """I-321: seeds write only the modes the forms offer (the server refuses the rest, tests.test_research_core)."""

    def test_no_seed_writes_a_mode_outside_the_form_vocabulary(self):
        import pathlib
        import re
        from app import DEFENSE_MODES
        root = pathlib.Path(__file__).resolve().parent.parent
        for name in ("app.py", "panel_demo_data.py"):
            for mode in re.findall(r"""mode\s*=\s*["']([^"']+)["']""", (root / name).read_text(encoding="utf8")):
                if mode in ("On-site", "Online", "Hybrid", "In person"):
                    self.assertIn(mode, DEFENSE_MODES, f"{name} writes mode {mode!r}")


class ChairSetsVenueTests(ResearchCoreBase):
    """I-318: the panel chair sets the venue / meeting link on the booked defense; it is recorded, and everyone is told."""

    FOUR = ["Chair Person", "Content Person", "Method Person", "External Person"]

    def setUp(self):
        super().setUp()
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            self.fill_uploads(self.student_id, PROPOSAL, status="Complete")
            self.panel(self.student_id, PROPOSAL, self.FOUR)
            self.schedule_id = self.schedule(
                self.student_id, "Proposal Defense", names=self.FOUR, day=_date.today() + timedelta(days=14)).id
            db.session.commit()

    def url(self):
        return f"/api/faculty-portal/defense-schedules/{self.schedule_id}/venue"

    def panel_row(self, name):
        context = self.faculty_client(name).get("/api/faculty-portal/context").get_json()
        return next(item for item in context["panels"] if item["gate"] == PROPOSAL)

    def test_chair_sets_the_link_and_it_is_recorded_and_announced(self):
        link = "https://meet.example.test/proposal-defense"
        response = self.faculty_client("Chair Person").post(self.url(), json={"venue": f"  {link} "})
        self.assertEqual(response.status_code, 200, response.get_json())
        row = self.panel_row("Chair Person")
        self.assertEqual(row["defense"]["venue"], link)
        self.assertTrue(row["can_set_venue"])
        self.assertEqual([(h["from"], h["to"]) for h in row["venue_history"]], [("Zoom", link)])
        self.assertIn("Chair Person", row["venue_history"][0]["by"])
        from app import Notification
        with app.app_context():
            titles = [n.title for n in Notification.query.filter_by(account_id=self.student_account_id).all()]
        self.assertTrue(any("venue" in title.lower() for title in titles), titles)

    def test_a_second_change_keeps_the_first_in_the_history(self):
        chair = self.faculty_client("Chair Person")
        chair.post(self.url(), json={"venue": "Room 101"})
        chair.post(self.url(), json={"venue": "Room 202"})
        history = self.panel_row("Chair Person")["venue_history"]
        self.assertEqual([(h["from"], h["to"]) for h in history], [("Room 101", "Room 202"), ("Zoom", "Room 101")])

    def test_only_the_chair_may_set_it_and_it_cannot_be_blank(self):
        member = self.faculty_client("Content Person")
        self.assertEqual(member.post(self.url(), json={"venue": "Room 5"}).status_code, 403)
        self.assertFalse(self.panel_row("Content Person")["can_set_venue"])
        self.assertEqual(self.faculty_client("Chair Person").post(self.url(), json={"venue": "  "}).status_code, 400)
        self.assertEqual(self.faculty_client("Chair Person").post(self.url(), json={"venue": "x" * 161}).status_code, 400)


class AssistantDeanCountTests(Audit4Base):
    """I-340: the assistant tells the Dean the same number the Dean home shows, and counts a leave case once."""

    def test_dean_count_matches_the_home_and_counts_leave_once(self):
        from app import (
            ADVISER_STATUS_DELIBERATION, AdviserAppointment, LeaveCase, Task, account_assistant_queue, queue_answer,
            workflow_approvals_payload,
        )
        with app.app_context():
            db.session.add(LeaveCase(student_id=self.student_id, kind="LOA", status="Dean Review"))
            db.session.add(AdviserAppointment(student_id=self.other_id, faculty_id=self.faculty_id, status=ADVISER_STATUS_DELIBERATION))
            for title in ("Dean decision on the leave", "Some other Dean task the home does not count"):
                db.session.add(Task(student_id=self.student_id, title=title, owner_role="Dean", status="Pending",
                                    due_at=date.today() + timedelta(days=3), priority=10))
            db.session.commit()
            home = len(workflow_approvals_payload()["pending"]) + 1  # the Dean home adds the adviser appointment waiting for the Dean
            queue = account_assistant_queue(db.session.get(UserAccount, self.accounts["dean"]))
            self.assertEqual(home, 2)
            self.assertEqual(queue["total"] + len(queue["extras"]), home)
            self.assertIn("2 item(s)", queue_answer(queue))


class AwolRegistrarHandoffTests(Audit4Base):
    """I-296: an approved AWOL return is tracked to the Registrar like a leave: Pending Handoff, a task, Exported, Sent, Acknowledged."""

    TASK = "Send the approved AWOL return to the Registrar"

    def approved_case(self):
        from app import AwolCase
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            student.standing, student.enrollment_tag, student.current_stage = "AWOL", "AWOL", "AWOL"
            case = AwolCase(student_id=student.id, status="Dean Review", dean_decision="Pending", prior_stage="Coursework",
                            awol_effective_date=date.today() - timedelta(days=200), return_intent="I wish to return.",
                            target_return_term="Term One")
            db.session.add(case)
            db.session.commit()
            case_id = case.id
        response = self.client("dean").post(f"/api/approvals/workflow/awol-return/{case_id}/decide",
                                            json={"decision": "approve", "note": "Endorsed."})
        self.assertEqual(response.status_code, 200, response.get_json())
        return case_id

    def task_status(self):
        from app import Task
        with app.app_context():
            row = Task.query.filter_by(student_id=self.student_id, title=self.TASK).first()
            return row.status if row else None

    def test_dean_approval_starts_the_registrar_handoff_with_a_task(self):
        from app import AwolCase
        case_id = self.approved_case()
        with app.app_context():
            self.assertEqual(db.session.get(AwolCase, case_id).registrar_status, "Pending Handoff")
        self.assertEqual(self.task_status(), "Pending")

    def test_the_registrar_report_marks_it_exported_and_closes_the_task_then_staff_advance_it(self):
        case_id = self.approved_case()
        staff = self.client("staff")
        self.assertEqual(staff.get(f"/api/awol/{case_id}/registrar-report").status_code, 200)
        from app import AwolCase
        with app.app_context():
            self.assertEqual(db.session.get(AwolCase, case_id).registrar_status, "Exported - Ready to Send")
        self.assertEqual(self.task_status(), "Done")
        skip = staff.post(f"/api/awol/{case_id}/registrar-handoff", json={"target": "Acknowledged"})
        self.assertEqual(skip.status_code, 409, skip.get_json())
        for target in ("Sent to Registrar", "Acknowledged"):
            step = staff.post(f"/api/awol/{case_id}/registrar-handoff", json={"target": target})
            self.assertEqual(step.status_code, 200, step.get_json())
            self.assertEqual(step.get_json()["case"]["registrar_status"], target)


    def test_the_board_row_carries_the_registrar_status_for_the_registrar_list(self):
        # The AWOL board's Registrar list (same component as LOA / readmission) reads row["registrar"].
        from app import AwolCase, awol_process_case
        case_id = self.approved_case()
        self.client("staff").get(f"/api/awol/{case_id}/registrar-report")
        with app.app_context():
            row = awol_process_case(db.session.get(AwolCase, case_id), "staff")
            self.assertEqual(row["registrar"]["status"], "Exported - Ready to Send")
            self.assertTrue(row["registrar"]["exported_at"])

class DemoDataAgeNoticeTests(Audit4Base):
    """I-332: staff are told when the demo data is old (the withdrawal window closes about 11 days after a seed)."""

    def age_the_seed(self, days):
        from datetime import datetime
        with app.app_context():
            for account in UserAccount.query.all():
                account.created_at = datetime.utcnow() - timedelta(days=days)
            db.session.commit()

    def notice(self, role):
        return self.client(role).get("/api/auth/me").get_json().get("demo_notice")

    def test_old_seed_shows_staff_a_reset_notice(self):
        self.age_the_seed(9)
        for role in ("staff", "admin"):
            notice = self.notice(role)
            self.assertIsNotNone(notice, role)
            self.assertEqual(notice["age_days"], 9)
            self.assertIn("npm run seed", notice["message"])
            self.assertIn("9 days", notice["message"])

    def test_fresh_seed_and_other_roles_get_no_notice(self):
        self.age_the_seed(2)
        self.assertIsNone(self.notice("staff"))
        self.age_the_seed(30)
        for role in ("student", "faculty"):
            self.assertIsNone(self.notice(role), role)

    def test_no_notice_outside_demo_mode(self):
        self.age_the_seed(30)
        with patch.dict(os.environ, {"DEMO_MODE": "0"}):
            self.assertIsNone(self.notice("staff"))
