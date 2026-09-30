"""Research-side logic: verdict outcomes, stage/type rules, protocol rules,
reschedule/cancel, panel changes, task closing.

Ground truth is the Graduate School research protocol
(Documents/CAPSTONE_ONLY/USLS_Documents/Complete-GS-Research-Protocol-...docx).
Set-up pattern copied from tests/test_bpm_workflows.py: a temp SQLite database
whose URL is set before `app` is imported.
"""
import os
import tempfile
import unittest
from datetime import date, datetime, time, timedelta
from unittest.mock import patch

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"

from sqlalchemy import event, text  # noqa: E402

from app import (  # noqa: E402
    ADVISER_APPROVAL_DOCUMENTS,
    AdviserAssignment,
    AdviserDocumentApproval,
    Course,
    CourseRecord,
    DefenseVerdict,
    DocumentCheck,
    Faculty,
    Form1Endorsement,
    PanelAssignment,
    Program,
    ResearchCase,
    ResearchEvidenceFile,
    ScheduleRequest,
    Student,
    Task,
    TransactionLog,
    UserAccount,
    app,
    db,
    detected_research_progress,
    generate_password_hash,
    required_documents_for_gate,
    research_requirement_presentation,
)

TITLE = "Form 1 - Title Defense"
PROPOSAL = "Form 4 - Proposal Defense Readiness"
FINAL = "Final Defense"
POST_DEFENSE_ITEMS = {
    "Form 5.1 - Technical Review Certificate",
    "Ethics Clearance",
    "Ethics clearance status and date",
}
SYSTEM_SOURCES = {
    "system_title_schedule", "system_proposal_schedule", "system_final_schedule",
    "system_defense_result", "system_panel", "coordinator_endorsement", "ethics_clearance_record",
}


def future_weekday(days: int) -> date:
    day = date.today() + timedelta(days=days)
    while day.weekday() >= 5:
        day += timedelta(days=1)
    return day


class ResearchCoreBase(unittest.TestCase):
    PROGRAM_NAME = "Research Core Thesis Program"
    PROGRAM_CODE = "RCT"

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
        self._stored = 0
        with app.app_context():
            db.drop_all()
            db.create_all()
            program = Program(code=self.PROGRAM_CODE, name=self.PROGRAM_NAME, college="Graduate School", has_practicum=False)
            db.session.add(program)
            db.session.flush()
            course = Course(program_id=program.id, code=f"{self.PROGRAM_CODE}-501", title="Core Course", units=3, category="Major")
            db.session.add(course)
            db.session.flush()
            student = Student(
                student_number="GS-RC-0001", first_name="Research", last_name="Student",
                email="rc-student@example.test", program_id=program.id, entry_year=2025,
                academic_year_entry="25-26", year_level="2", current_stage="Proposal Development",
                standing="Active", comprehensive_exam_status="Passed", adviser_name="Adviser Person",
            )
            db.session.add(student)
            db.session.flush()
            db.session.add(CourseRecord(student_id=student.id, course_id=course.id, status="Completed"))
            self.student_id = student.id
            self.program_id = program.id
            self.staff_id = self._account("staff", "rc-staff@example.test").id
            self.academic_id = self._account("academic_coordinator", "rc-academic@example.test").id
            self.research_id = self._account("research_coordinator", "rc-research@example.test").id
            self.student_account_id = self._account("student", "rc-student-login@example.test", student_id=student.id).id
            self.adviser = self._faculty("Adviser Person")
            self.chair = self._faculty("Chair Person")
            self.content = self._faculty("Content Person")
            self.method = self._faculty("Method Person")
            self.external = self._faculty("External Person")
            self.spare = self._faculty("Spare Person")
            self.faculty_ids = {
                f.name: f.id for f in (self.adviser, self.chair, self.content, self.method, self.external, self.spare)
            }
            db.session.add(AdviserAssignment(student_id=student.id, faculty_id=self.adviser.id, status="Active"))
            db.session.commit()
            self.faculty_account_ids = {
                name: UserAccount.query.filter_by(faculty_id=fid).first().id for name, fid in self.faculty_ids.items()
            }

    # ---- builders ---------------------------------------------------------
    def _account(self, role, email, student_id=None, faculty_id=None):
        account = UserAccount(
            email=email, full_name=f"Test {role}", password_hash=generate_password_hash("pw"),
            role=role, active=True, student_id=student_id, faculty_id=faculty_id,
        )
        db.session.add(account)
        db.session.flush()
        return account

    def _faculty(self, name, hours=True):
        faculty = Faculty(
            name=name, college="Graduate School", role="Faculty", specialization="Research",
            email=f"{name.split()[0].lower()}@example.test", active=True,
            eligible_roles="Panel Chair,Content Specialist,Method Specialist,External Panel",
        )
        db.session.add(faculty)
        db.session.flush()
        if hours:
            # Availability is never assumed: a faculty member who has not entered hours is
            # "not entered", so the fixture enters Monday-Friday 8-17 the way a person would.
            from app import FacultyWorkingHour

            for weekday in range(5):
                db.session.add(FacultyWorkingHour(
                    faculty_id=faculty.id, weekday=weekday, start_time=time(8, 0), end_time=time(17, 0), enabled=True,
                ))
        self._account("faculty", f"login-{name.split()[0].lower()}@example.test", faculty_id=faculty.id)
        return faculty

    def client(self, account_id, role):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    def staff(self):
        return self.client(self.staff_id, "staff")

    def research(self):
        return self.client(self.research_id, "research_coordinator")

    def academic(self):
        return self.client(self.academic_id, "academic_coordinator")

    def student(self):
        return self.client(self.student_account_id, "student")

    def faculty_client(self, name):
        return self.client(self.faculty_account_ids[name], "faculty")

    def doc(self, student_id, gate, item):
        found = DocumentCheck.query.filter_by(student_id=student_id, gate=gate, item_name=item).first()
        if not found:
            found = DocumentCheck(student_id=student_id, gate=gate, item_name=item, status="Missing")
            db.session.add(found)
            db.session.flush()
        return found

    def add_file(self, student_id, gate, item, signed_by=None, status="Submitted", copies=1):
        check = self.doc(student_id, gate, item)
        files = []
        for _ in range(copies):
            self._stored += 1
            evidence = ResearchEvidenceFile(
                student_id=student_id, document_check_id=check.id,
                original_name=f"{item}-{self._stored}.pdf",
                stored_name=f"rc-test-{student_id}-{self._stored}-{os.getpid()}.pdf",
                mime_type="application/pdf",
            )
            db.session.add(evidence)
            db.session.flush()
            if signed_by and item in ADVISER_APPROVAL_DOCUMENTS:
                db.session.add(AdviserDocumentApproval(
                    student_id=student_id, evidence_file_id=evidence.id, faculty_id=signed_by,
                    adviser_name="Adviser Person", student_name="Research Student",
                    document_name=item, signature_data="data:image/png;base64,test", status="Signed",
                ))
            files.append(evidence)
        check.status = status
        check.evidence_reference = files[-1].original_name
        db.session.flush()
        return files

    def fill_uploads(self, student_id, gate, signed=True, skip=(), status="Submitted"):
        adviser_id = self.faculty_ids["Adviser Person"]
        for item in required_documents_for_gate(gate):
            if item in skip or item in POST_DEFENSE_ITEMS:
                continue
            presentation = research_requirement_presentation(gate, item)
            if presentation["source_type"] != "student_upload":
                continue
            self.add_file(student_id, gate, item, signed_by=adviser_id if signed else None,
                          copies=presentation["required_file_count"], status=status)

    def endorse(self, student_id):
        if not Form1Endorsement.query.filter_by(student_id=student_id).first():
            db.session.add(Form1Endorsement(
                student_id=student_id, coordinator_name="Test Academic Coordinator",
                signature_data="data:image/png;base64,test", status="Endorsed",
                endorsed_at=datetime.now() - timedelta(days=40),
            ))
            db.session.flush()

    def panel(self, student_id, gate, names=None):
        names = names or ["Chair Person", "Content Person", "Method Person"]
        roles = ["Panel Chair", "Content Specialist", "Method Specialist", "External Panel"]
        rows = []
        for role, name in zip(roles, names):
            row = PanelAssignment(
                student_id=student_id, faculty_id=self.faculty_ids[name], gate=gate,
                panel_role=role, score=90, eligibility_note="test panel",
            )
            db.session.add(row)
            rows.append(row)
        db.session.flush()
        return rows

    def schedule(self, student_id, defense_type, status="Scheduled", day=None, start=time(9, 0), end=time(11, 0), names=None):
        day = day or (date.today() - timedelta(days=2))
        names = names or ["Chair Person", "Content Person", "Method Person"]
        roles = ["Panel Chair", "Content Specialist", "Method Specialist", "External Panel"]
        snapshot = [
            {"faculty_id": self.faculty_ids[name], "name": name, "role": role}
            for role, name in zip(roles, names)
        ]
        import json
        row = ScheduleRequest(
            student_id=student_id, preferred_date=day, preferred_end_date=day, start_time=start, end_time=end,
            defense_type=defense_type, mode="Online", venue="Zoom", status=status, matched_count=len(names),
            panel_snapshot=json.dumps(snapshot), required_forms_status="Complete", confirmed_at=datetime.now(),
        )
        db.session.add(row)
        db.session.flush()
        return row

    def pass_gate(self, student_id, gate, defense_type, names=None):
        """Put one gate fully into the 'Passed' state with the old-style direct rows."""
        if gate == TITLE:
            self.endorse(student_id)
        self.fill_uploads(student_id, gate)
        for item in required_documents_for_gate(gate):
            check = self.doc(student_id, gate, item)
            if item in POST_DEFENSE_ITEMS and not check.evidence_files:
                self.add_file(student_id, gate, item, status="Complete")
            check.status = "Complete"
        panel = self.panel(student_id, gate, names)
        schedule = self.schedule(student_id, defense_type, status="Held", names=names)
        db.session.add(DefenseVerdict(
            student_id=student_id, schedule_request_id=schedule.id, panel_assignment_id=panel[0].id,
            faculty_id=panel[0].faculty_id, gate=gate, defense_type=defense_type, research_title="T",
            chair_name="Chair Person", result="Passed", defense_date=schedule.preferred_date,
        ))
        db.session.flush()
        return schedule

    def student_obj(self):
        return db.session.get(Student, self.student_id)

    def open_tasks(self, like=None):
        query = Task.query.filter(Task.student_id == self.student_id, Task.status.in_(["Pending", "Overdue"]))
        rows = query.all()
        return [t for t in rows if not like or like in t.title]


class VerdictOutcomeTests(ResearchCoreBase):
    """Every verdict leads to a defined next state with a defined actor."""

    def at_proposal_ready_for_verdict(self):
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            self.fill_uploads(self.student_id, PROPOSAL)
            self.panel(self.student_id, PROPOSAL, ["Chair Person", "Content Person", "Method Person", "External Person"])
            schedule = self.schedule(self.student_id, "Proposal Defense", names=["Chair Person", "Content Person", "Method Person", "External Person"])
            db.session.commit()
            return schedule.id

    def submit(self, schedule_id, result, **extra):
        return self.faculty_client("Chair Person").post(
            f"/api/faculty-portal/defense-verdicts/{schedule_id}",
            json={"result": result, **extra},
        )

    def test_failed_proposal_verdict_does_not_delete_signed_files_and_survives_foreign_keys(self):
        """R31: a Failed verdict used to delete files the adviser had signed and crash under MySQL-style FK enforcement."""
        schedule_id = self.at_proposal_ready_for_verdict()

        def fk_on(dbapi_connection, _record):
            dbapi_connection.execute("PRAGMA foreign_keys=ON")

        with app.app_context():
            event.listen(db.engine, "connect", fk_on)
            db.engine.dispose()
        try:
            response = self.submit(schedule_id, "Failed", remarks="Did not meet the recommendations")
            self.assertEqual(response.status_code, 200, response.get_json())
            with app.app_context():
                self.assertEqual(db.session.execute(text("PRAGMA foreign_keys")).scalar(), 1)
                verdict = DefenseVerdict.query.filter_by(schedule_request_id=schedule_id).one()
                self.assertEqual(verdict.result, "Failed")
                signed = AdviserDocumentApproval.query.filter_by(student_id=self.student_id).count()
                self.assertGreater(signed, 0)
                # Signed evidence is superseded (kept with its signature), never deleted.
                kept = ResearchEvidenceFile.query.filter_by(student_id=self.student_id).count()
                self.assertGreaterEqual(kept, signed)
                # The student must resubmit: the current gate items are open again.
                progress = detected_research_progress(self.student_obj())
                self.assertEqual(progress["gate"], PROPOSAL)
                self.assertEqual(progress["status"], "Resubmission Required")
                manuscript = next(i for i in progress["milestone"]["requirements"] if i["item_name"] == "Proposal manuscript")
                self.assertEqual(manuscript["status"], "Missing")
        finally:
            with app.app_context():
                event.remove(db.engine, "connect", fk_on)
                db.engine.dispose()

    def test_student_deleting_an_adviser_signed_file_archives_it_instead_of_crashing(self):
        """R31 (second path): deleting a signed file must keep the signature row and the file."""
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            self.fill_uploads(self.student_id, PROPOSAL)
            evidence = (
                ResearchEvidenceFile.query.join(DocumentCheck)
                .filter(DocumentCheck.gate == PROPOSAL, DocumentCheck.item_name == "Proposal manuscript")
                .one()
            )
            evidence_id = evidence.id
            db.session.commit()

        def fk_on(dbapi_connection, _record):
            dbapi_connection.execute("PRAGMA foreign_keys=ON")

        with app.app_context():
            event.listen(db.engine, "connect", fk_on)
            db.engine.dispose()
        try:
            response = self.student().delete(f"/api/student-portal/research-evidence/{evidence_id}")
            self.assertEqual(response.status_code, 200, response.get_json())
            with app.app_context():
                self.assertIsNotNone(db.session.get(ResearchEvidenceFile, evidence_id))
                self.assertIsNotNone(AdviserDocumentApproval.query.filter_by(evidence_file_id=evidence_id).first())
                current = DocumentCheck.query.filter_by(
                    student_id=self.student_id, gate=PROPOSAL, item_name="Proposal manuscript").one()
                self.assertEqual(len(current.evidence_files), 0)
        finally:
            with app.app_context():
                event.remove(db.engine, "connect", fk_on)
                db.engine.dispose()

    def test_one_vocabulary_is_published_and_legacy_words_are_aliased(self):
        from app import RESEARCH_VERDICTS, normalize_verdict_result
        self.assertEqual(normalize_verdict_result("Passed with revisions"), "Passed with minor revisions")
        self.assertEqual(normalize_verdict_result("For resubmission"), "Failed")
        self.assertIsNone(normalize_verdict_result("Nonsense"))
        self.assertIn("Deferred", RESEARCH_VERDICTS)
        schedule_id = self.at_proposal_ready_for_verdict()
        context = self.faculty_client("Chair Person").get("/api/faculty-portal/context").get_json()
        panel = next(p for p in context["panels"] if p["gate"] == PROPOSAL)
        options = [o["value"] for o in panel["verdict_options"]]
        self.assertEqual(options[0], "Passed")
        self.assertIn("Passed with minor revisions", options)
        self.assertIn("Deferred", options)
        title_options = [o["value"] for o in
                         self.faculty_client("Chair Person").get("/api/faculty-portal/context").get_json()["panels"][0]["verdict_options"]]
        self.assertTrue(title_options)

    def test_minor_revisions_complete_the_stage_after_the_adviser_confirms(self):
        """R30: 'Passed with revisions' used to strand the student."""
        schedule_id = self.at_proposal_ready_for_verdict()
        response = self.submit(schedule_id, "Passed with revisions", remarks="Fix chapter 2")  # legacy word accepted
        self.assertEqual(response.status_code, 200, response.get_json())
        verdict_id = response.get_json()["verdict"]["id"]
        self.assertEqual(response.get_json()["verdict"]["result"], "Passed with minor revisions")
        with app.app_context():
            progress = detected_research_progress(self.student_obj())
            self.assertEqual(progress["gate"], PROPOSAL)
            result_item = next(i for i in progress["milestone"]["requirements"] if i["item_name"] == "Proposal defense result")
            self.assertEqual(result_item["status"], "Pending")
            self.assertEqual(progress["status"], "Revisions Pending")
            self.assertEqual(ScheduleRequest.query.get(schedule_id).status, "Held")
        # Adviser cannot confirm before the student submitted the revisions.
        early = self.faculty_client("Adviser Person").post(
            f"/api/faculty-portal/defense-verdicts/{verdict_id}/confirm-revisions", json={})
        self.assertEqual(early.status_code, 409, early.get_json())
        # Student submits revisions.
        submitted = self.student().post(
            f"/api/student-portal/defense-verdicts/{verdict_id}/revisions", json={"note": "Chapter 2 rewritten"})
        self.assertEqual(submitted.status_code, 200, submitted.get_json())
        # A stranger cannot confirm.
        stranger = self.faculty_client("Spare Person").post(
            f"/api/faculty-portal/defense-verdicts/{verdict_id}/confirm-revisions", json={})
        self.assertEqual(stranger.status_code, 403)
        confirmed = self.faculty_client("Adviser Person").post(
            f"/api/faculty-portal/defense-verdicts/{verdict_id}/confirm-revisions", json={"note": "Checked"})
        self.assertEqual(confirmed.status_code, 200, confirmed.get_json())
        with app.app_context():
            result_item = next(
                i for i in detected_research_progress(self.student_obj())["milestone"]["requirements"]
                if i["item_name"] == "Proposal defense result")
            self.assertEqual(result_item["status"], "Complete")
            self.assertEqual(DefenseVerdict.query.get(verdict_id).revision_status, "Revisions confirmed")

    def test_provisional_pass_with_redefense_reopens_scheduling_for_the_same_stage(self):
        schedule_id = self.at_proposal_ready_for_verdict()
        response = self.submit(schedule_id, "Provisional pass - re-defense required", remarks="Major revisions")
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            progress = detected_research_progress(self.student_obj())
            self.assertEqual(progress["gate"], PROPOSAL)
            self.assertEqual(progress["status"], "Re-defense Required")
            self.assertEqual(ScheduleRequest.query.get(schedule_id).status, "Held")
            # Stage evidence is superseded so the manuscript is resubmitted and re-signed.
            manuscript = next(i for i in progress["milestone"]["requirements"] if i["item_name"] == "Proposal manuscript")
            self.assertEqual(manuscript["status"], "Missing")
            # The panel is kept: the same panel conducts the re-defense.
            self.assertEqual(PanelAssignment.query.filter_by(student_id=self.student_id, gate=PROPOSAL).count(), 4)

    def test_provisional_pass_without_redefense_needs_panel_approval_not_the_adviser(self):
        schedule_id = self.at_proposal_ready_for_verdict()
        response = self.submit(schedule_id, "Provisional pass - revisions for panel approval")
        self.assertEqual(response.status_code, 200, response.get_json())
        verdict_id = response.get_json()["verdict"]["id"]
        self.student().post(f"/api/student-portal/defense-verdicts/{verdict_id}/revisions", json={"note": "done"})
        by_adviser = self.faculty_client("Adviser Person").post(
            f"/api/faculty-portal/defense-verdicts/{verdict_id}/confirm-revisions", json={})
        self.assertEqual(by_adviser.status_code, 403, by_adviser.get_json())
        by_chair = self.faculty_client("Chair Person").post(
            f"/api/faculty-portal/defense-verdicts/{verdict_id}/confirm-revisions", json={})
        self.assertEqual(by_chair.status_code, 200, by_chair.get_json())

    def test_deferred_defense_is_reschedulable_and_the_old_record_is_linked(self):
        schedule_id = self.at_proposal_ready_for_verdict()
        response = self.submit(schedule_id, "Deferred", remarks="Panelist ill")
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            self.assertEqual(ScheduleRequest.query.get(schedule_id).status, "Deferred")
            progress = detected_research_progress(self.student_obj())
            self.assertEqual(progress["status"], "Defense Deferred")
            # Nothing was reset: the student keeps files and the panel.
            manuscript = next(i for i in progress["milestone"]["requirements"] if i["item_name"] == "Proposal manuscript")
            self.assertNotEqual(manuscript["status"], "Missing")
            self.assertTrue(any(
                t.owner_role == "Research Coordinator" and "Reschedule" in t.title for t in self.open_tasks()
            ))

    def test_chair_can_correct_a_verdict_before_it_is_acted_on_with_a_reason(self):
        schedule_id = self.at_proposal_ready_for_verdict()
        verdict_id = self.submit(schedule_id, "Failed").get_json()["verdict"]["id"]
        missing_reason = self.faculty_client("Chair Person").post(
            f"/api/faculty-portal/defense-verdicts/{verdict_id}/correction", json={"result": "Passed"})
        self.assertEqual(missing_reason.status_code, 400)
        not_chair = self.faculty_client("Content Person").post(
            f"/api/faculty-portal/defense-verdicts/{verdict_id}/correction",
            json={"result": "Passed", "reason": "typo"})
        self.assertEqual(not_chair.status_code, 403)
        fixed = self.faculty_client("Chair Person").post(
            f"/api/faculty-portal/defense-verdicts/{verdict_id}/correction",
            json={"result": "Passed", "reason": "Entered Failed by mistake; panel passed the student"})
        self.assertEqual(fixed.status_code, 200, fixed.get_json())
        with app.app_context():
            verdict = DefenseVerdict.query.get(verdict_id)
            self.assertEqual(verdict.result, "Passed")
            self.assertEqual(verdict.original_result, "Failed")
            self.assertIn("mistake", verdict.correction_reason)
            self.assertTrue(TransactionLog.query.filter(TransactionLog.result.like("%correct%")).count() >= 1)
            # The superseded evidence came back when the failed verdict was undone.
            progress = detected_research_progress(self.student_obj())
            manuscript = next(i for i in progress["milestone"]["requirements"] if i["item_name"] == "Proposal manuscript")
            self.assertNotEqual(manuscript["status"], "Missing")
            self.assertEqual(ScheduleRequest.query.get(schedule_id).status, "Held")

    def test_a_verdict_cannot_be_corrected_once_the_student_has_acted_on_it(self):
        schedule_id = self.at_proposal_ready_for_verdict()
        verdict_id = self.submit(schedule_id, "Failed").get_json()["verdict"]["id"]
        with app.app_context():
            self.add_file(self.student_id, PROPOSAL, "Proposal manuscript")  # student resubmitted
            db.session.commit()
        late = self.faculty_client("Chair Person").post(
            f"/api/faculty-portal/defense-verdicts/{verdict_id}/correction",
            json={"result": "Passed", "reason": "too late"})
        self.assertEqual(late.status_code, 409, late.get_json())

    def test_verdict_cannot_be_submitted_before_the_defense_starts(self):
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            self.fill_uploads(self.student_id, PROPOSAL)
            names = ["Chair Person", "Content Person", "Method Person", "External Person"]
            self.panel(self.student_id, PROPOSAL, names)
            schedule = self.schedule(self.student_id, "Proposal Defense", day=future_weekday(20), names=names)
            db.session.commit()
            schedule_id = schedule.id
        response = self.submit(schedule_id, "Passed")
        self.assertEqual(response.status_code, 400)
        self.assertIn("before", response.get_json()["error"].lower())

    def test_title_outcomes_are_approved_or_disapproved_and_do_not_allow_revision_words(self):
        with app.app_context():
            self.endorse(self.student_id)
            self.fill_uploads(self.student_id, TITLE, status="Complete")
            self.panel(self.student_id, TITLE)
            schedule = self.schedule(self.student_id, "Title Defense")
            db.session.commit()
            schedule_id = schedule.id
        bad = self.submit(schedule_id, "Passed with minor revisions")
        self.assertEqual(bad.status_code, 400, bad.get_json())
        ok = self.submit(schedule_id, "Passed", selected_title="The Approved Title")
        self.assertEqual(ok.status_code, 200, ok.get_json())
        with app.app_context():
            self.assertEqual(ResearchCase.query.filter_by(student_id=self.student_id).first().title, "The Approved Title")
            self.assertEqual(detected_research_progress(self.student_obj())["gate"], PROPOSAL)

    def test_disapproved_title_keeps_old_files_and_asks_for_a_new_set_of_three(self):
        with app.app_context():
            self.endorse(self.student_id)
            self.fill_uploads(self.student_id, TITLE)
            self.panel(self.student_id, TITLE)
            schedule = self.schedule(self.student_id, "Title Defense")
            db.session.commit()
            schedule_id = schedule.id
        response = self.submit(schedule_id, "Failed")
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            self.assertEqual(ResearchEvidenceFile.query.filter_by(student_id=self.student_id).count(), 4)  # Form 1 + 3 papers kept
            progress = detected_research_progress(self.student_obj())
            self.assertEqual(progress["gate"], TITLE)
            papers = next(i for i in progress["milestone"]["requirements"] if i["item_name"] == "Three concept papers")
            self.assertEqual(papers["status"], "Missing")
            self.assertEqual(papers["file_count"], 0)

    def test_score_below_threshold_cannot_be_recorded_as_a_plain_pass(self):
        """Protocol Form 7: a provisional pass (re-defense) corresponds to a score below 85 (thesis)."""
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            self.pass_gate(self.student_id, PROPOSAL, "Proposal Defense")
            self.fill_uploads(self.student_id, FINAL)
            names = ["Chair Person", "Content Person", "Method Person", "External Person"]
            self.panel(self.student_id, FINAL, names)
            schedule = self.schedule(self.student_id, "Final Defense", names=names)
            db.session.commit()
            schedule_id = schedule.id
        bad = self.submit(schedule_id, "Passed", evaluation_score=80)
        self.assertEqual(bad.status_code, 400, bad.get_json())
        good = self.submit(schedule_id, "Provisional pass - re-defense required", evaluation_score=80)
        self.assertEqual(good.status_code, 200, good.get_json())


class SchedulingRuleTests(ResearchCoreBase):
    """Stage/type match, protocol lead times, past slots, overrides, reschedule, cancel."""

    FOUR = ["Chair Person", "Content Person", "Method Person", "External Person"]

    def setUp(self):
        super().setUp()
        patcher = patch("app.faculty_calendar_blocks", return_value=[], create=True)
        patcher.start()
        self.addCleanup(patcher.stop)

    def ready_for_proposal(self):
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            self.fill_uploads(self.student_id, PROPOSAL, status="Complete")
            self.panel(self.student_id, PROPOSAL, self.FOUR)
            db.session.commit()

    def ready_for_title(self, endorsed_days_ago=40):
        with app.app_context():
            self.endorse(self.student_id)
            endorsement = Form1Endorsement.query.filter_by(student_id=self.student_id).one()
            endorsement.endorsed_at = datetime.now() - timedelta(days=endorsed_days_ago)
            self.fill_uploads(self.student_id, TITLE, status="Complete")
            self.panel(self.student_id, TITLE)
            db.session.commit()

    def book(self, client=None, **over):
        day = over.pop("day", future_weekday(21))
        payload = {
            "student_id": self.student_id, "preferred_date": day.isoformat(),
            "selected_start": "09:00", "selected_end": "11:00", "defense_type": "Proposal Defense",
            "mode": "Online", "venue": "Zoom room A",
        }
        payload.update(over)
        return (client or self.staff()).post("/api/transactions/defense-scheduling", json=payload)

    def schedules(self):
        return ScheduleRequest.query.filter_by(student_id=self.student_id).order_by(ScheduleRequest.id).all()

    # ---- defense type vs stage ---------------------------------------------
    def test_defense_type_must_match_the_current_stage(self):
        self.ready_for_proposal()
        wrong = self.book(defense_type="Final Defense")
        self.assertEqual(wrong.status_code, 400, wrong.get_json())
        self.assertIn("Proposal Defense", wrong.get_json()["error"])
        title = self.book(defense_type="Title Defense")
        self.assertEqual(title.status_code, 400)
        ok = self.book(defense_type="Proposal Defense")
        self.assertEqual(ok.status_code, 200, ok.get_json())
        with app.app_context():
            self.assertEqual([x.status for x in self.schedules()], ["Held", "Scheduled"])

    def test_public_final_defense_is_not_a_bookable_type(self):
        self.ready_for_proposal()
        response = self.book(defense_type="Public Final Defense")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Public Final Defense", response.get_json()["error"])
        from app import SCHEDULABLE_DEFENSE_TYPES
        self.assertNotIn("Public Final Defense", SCHEDULABLE_DEFENSE_TYPES)

    def test_student_schedule_request_with_the_wrong_type_is_rejected(self):
        self.ready_for_proposal()
        response = self.student().post(
            "/api/student-portal/requests/defense-scheduling",
            json={"defense_type": "Final Defense", "preferred_date": future_weekday(30).isoformat(), "mode": "Online"})
        self.assertEqual(response.status_code, 400, response.get_json())

    # ---- lead times ---------------------------------------------------------
    def test_title_defense_needs_two_weeks_after_the_form_1_endorsement(self):
        self.ready_for_title(endorsed_days_ago=3)
        too_soon = self.book(defense_type="Title Defense", day=future_weekday(8))
        self.assertEqual(too_soon.status_code, 400, too_soon.get_json())
        self.assertIn("14", too_soon.get_json()["error"])
        with app.app_context():
            endorsement = Form1Endorsement.query.filter_by(student_id=self.student_id).one()
            endorsement.endorsed_at = datetime.now() - timedelta(days=30)
            db.session.commit()
        ok = self.book(defense_type="Title Defense", day=future_weekday(2))
        self.assertEqual(ok.status_code, 200, ok.get_json())

    def test_manuscript_lead_time_is_measured_from_the_day_the_panel_received_it(self):
        self.ready_for_proposal()
        soon = self.book(day=future_weekday(10))  # no received date: counts from today
        self.assertEqual(soon.status_code, 400, soon.get_json())
        received = (date.today() - timedelta(days=12)).isoformat()
        ok = self.book(day=future_weekday(10), manuscript_received_on=received)
        self.assertEqual(ok.status_code, 200, ok.get_json())
        with app.app_context():
            self.assertEqual(self.schedules()[-1].manuscript_received_on.isoformat(), received)

    def test_a_future_received_date_is_rejected(self):
        self.ready_for_proposal()
        response = self.book(manuscript_received_on=(date.today() + timedelta(days=3)).isoformat())
        self.assertEqual(response.status_code, 400)

    def test_override_needs_a_recorded_reason_and_is_stored(self):
        self.ready_for_proposal()
        day = future_weekday(9)
        no_reason = self.book(day=day, override_conflicts=True)
        self.assertEqual(no_reason.status_code, 400, no_reason.get_json())
        self.assertIn("reason", no_reason.get_json()["error"].lower())
        ok = self.book(day=day, override_conflicts=True, override_reason="Adviser and panel agreed; manuscript was sent earlier")
        self.assertEqual(ok.status_code, 200, ok.get_json())
        with app.app_context():
            self.assertIn("agreed", self.schedules()[-1].override_reason)

    def test_a_slot_in_the_past_is_never_allowed_even_with_an_override(self):
        self.ready_for_proposal()
        yesterday = date.today() - timedelta(days=1)
        response = self.book(day=yesterday, override_conflicts=True, override_requirements=True, override_reason="please")
        self.assertEqual(response.status_code, 400, response.get_json())
        self.assertIn("past", response.get_json()["error"].lower())

    def test_same_day_slot_earlier_than_now_is_in_the_past(self):
        from app import manila_now
        self.ready_for_title(endorsed_days_ago=40)
        now = manila_now()  # the app reads "now" as Manila time
        if now.hour < 1:
            self.skipTest("needs a same-day hour earlier than now")
        start = f"{now.hour - 1:02d}:00"
        end = f"{now.hour - 1:02d}:30"
        response = self.book(defense_type="Title Defense", day=now.date(), selected_start=start, selected_end=end,
                             override_conflicts=True, override_reason="x")
        self.assertEqual(response.status_code, 400, response.get_json())
        self.assertIn("past", response.get_json()["error"].lower())

    def test_adviser_cannot_sit_on_the_panel_of_their_own_advisee(self):
        self.ready_for_proposal()
        names = ["Chair Person", "Content Person", "Method Person", "Adviser Person"]
        response = self.book(panel_faculty_ids=[self.faculty_ids[n] for n in names], reassign_only=True,
                             panel_change_reason="trying")
        self.assertEqual(response.status_code, 400, response.get_json())
        self.assertIn("adviser", response.get_json()["error"].lower())

    # ---- reschedule / cancel ------------------------------------------------
    def booked(self):
        response = self.book()
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            return self.schedules()[-1].id

    def test_a_second_booking_for_the_same_stage_must_go_through_reschedule(self):
        self.ready_for_proposal()
        self.booked()
        again = self.book(day=future_weekday(25))
        self.assertEqual(again.status_code, 400)
        self.assertIn("reschedule", again.get_json()["error"].lower())

    def test_reschedule_needs_a_reason_and_links_the_old_record(self):
        self.ready_for_proposal()
        old_id = self.booked()
        url = f"/api/defense-schedules/{old_id}/reschedule"
        new_day = future_weekday(28)
        body = {"preferred_date": new_day.isoformat(), "selected_start": "13:00", "selected_end": "15:00",
                "mode": "Online", "venue": "Zoom room B"}
        no_reason = self.staff().post(url, json=body)
        self.assertEqual(no_reason.status_code, 400, no_reason.get_json())
        ok = self.staff().post(url, json={**body, "reason": "External panelist is travelling", "requested_by": "Panel member"})
        self.assertEqual(ok.status_code, 200, ok.get_json())
        with app.app_context():
            rows = self.schedules()
            old, new = rows[-2], rows[-1]
            self.assertEqual(old.id, old_id)
            self.assertEqual(old.status, "Rescheduled")
            self.assertEqual(new.status, "Scheduled")
            self.assertEqual(new.rescheduled_from_id, old_id)
            self.assertIn("travelling", new.change_reason)
            self.assertEqual(new.requested_by, "Panel member")
            self.assertEqual(new.start_time, time(13, 0))
            self.assertTrue(TransactionLog.query.filter(TransactionLog.result.like("%rescheduled%")).count() >= 1)

    def test_reschedule_is_still_subject_to_the_protocol_rules(self):
        self.ready_for_proposal()
        old_id = self.booked()
        response = self.staff().post(f"/api/defense-schedules/{old_id}/reschedule", json={
            "preferred_date": future_weekday(3).isoformat(), "selected_start": "09:00", "selected_end": "11:00",
            "reason": "Student asked", "requested_by": "Student"})
        self.assertEqual(response.status_code, 400, response.get_json())

    def test_cancel_needs_a_reason_and_blocks_the_verdict(self):
        self.ready_for_proposal()
        schedule_id = self.booked()
        no_reason = self.staff().post(f"/api/defense-schedules/{schedule_id}/cancel", json={})
        self.assertEqual(no_reason.status_code, 400)
        ok = self.research().post(f"/api/defense-schedules/{schedule_id}/cancel",
                                  json={"reason": "Venue unavailable", "requested_by": "GS Office"})
        self.assertEqual(ok.status_code, 200, ok.get_json())
        with app.app_context():
            row = db.session.get(ScheduleRequest, schedule_id)
            self.assertEqual(row.status, "Cancelled")
            self.assertEqual(row.change_reason, "Venue unavailable")
            self.assertIsNotNone(row.cancelled_at)
        again = self.staff().post(f"/api/defense-schedules/{schedule_id}/cancel", json={"reason": "again"})
        self.assertEqual(again.status_code, 409)

    # ---- panel change after scheduling ---------------------------------------
    def test_changing_the_panel_flags_the_schedule_and_reconfirmation_rechecks_availability(self):
        self.ready_for_proposal()
        schedule_id = self.booked()
        ids = [self.faculty_ids[n] for n in ["Chair Person", "Content Person", "Method Person", "Spare Person"]]
        no_reason = self.book(panel_faculty_ids=ids, reassign_only=True)
        self.assertEqual(no_reason.status_code, 400, no_reason.get_json())
        changed = self.book(panel_faculty_ids=ids, reassign_only=True, panel_change_reason="External member withdrew")
        self.assertEqual(changed.status_code, 200, changed.get_json())
        with app.app_context():
            row = db.session.get(ScheduleRequest, schedule_id)
            self.assertEqual(row.status, "Needs Re-confirmation")
            self.assertIn("Spare Person", row.panel_snapshot)
            self.assertNotIn("External Person", row.panel_snapshot)
            self.assertIn("External member withdrew", row.conflict_reason)
            self.assertTrue(TransactionLog.query.filter(TransactionLog.result.like("%panel%")).count() >= 1)
        # The booking is not active, so no verdict can be recorded against it yet.
        verdict = self.faculty_client("Chair Person").post(
            f"/api/faculty-portal/defense-verdicts/{schedule_id}", json={"result": "Passed"})
        self.assertEqual(verdict.status_code, 400)
        ok = self.staff().post(f"/api/defense-schedules/{schedule_id}/reconfirm", json={})
        self.assertEqual(ok.status_code, 200, ok.get_json())
        with app.app_context():
            self.assertEqual(db.session.get(ScheduleRequest, schedule_id).status, "Scheduled")

    def test_reconfirmation_fails_when_the_new_member_is_not_available(self):
        from app import FacultyWorkingHour
        self.ready_for_proposal()
        schedule_id = self.booked()
        with app.app_context():
            day = db.session.get(ScheduleRequest, schedule_id).preferred_date
            # The spare member's entered hours are replaced by a single early-morning window.
            FacultyWorkingHour.query.filter_by(faculty_id=self.faculty_ids["Spare Person"]).delete()
            db.session.add(FacultyWorkingHour(
                faculty_id=self.faculty_ids["Spare Person"], weekday=day.weekday(),
                start_time=time(7, 0), end_time=time(8, 0), enabled=True))
            db.session.commit()
        ids = [self.faculty_ids[n] for n in ["Chair Person", "Content Person", "Method Person", "Spare Person"]]
        self.book(panel_faculty_ids=ids, reassign_only=True, panel_change_reason="swap")
        bad = self.staff().post(f"/api/defense-schedules/{schedule_id}/reconfirm", json={})
        self.assertEqual(bad.status_code, 400, bad.get_json())
        with app.app_context():
            row = db.session.get(ScheduleRequest, schedule_id)
            self.assertEqual(row.status, "Needs Re-confirmation")
            self.assertIn("Spare Person", row.conflict_reason)

    def test_panel_carries_from_proposal_to_final_and_replacing_it_needs_a_reason(self):
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            self.pass_gate(self.student_id, PROPOSAL, "Proposal Defense", names=self.FOUR)
            self.fill_uploads(self.student_id, FINAL, status="Complete")
            db.session.commit()
            progress = detected_research_progress(self.student_obj())
            self.assertEqual(progress["gate"], FINAL)
            from app import sync_research_progress
            sync_research_progress(self.student_obj())
            db.session.commit()
            carried = PanelAssignment.query.filter_by(student_id=self.student_id, gate=FINAL).all()
            self.assertEqual(sorted(a.faculty_id for a in carried),
                             sorted(self.faculty_ids[n] for n in self.FOUR))
            self.assertIn("proposal", carried[0].eligibility_note.lower())
        ids = [self.faculty_ids[n] for n in ["Chair Person", "Content Person", "Method Person", "Spare Person"]]
        no_reason = self.book(defense_type="Final Defense", panel_faculty_ids=ids, reassign_only=True)
        self.assertEqual(no_reason.status_code, 400, no_reason.get_json())
        ok = self.book(defense_type="Final Defense", panel_faculty_ids=ids, reassign_only=True,
                       panel_change_reason="External panelist left the university")
        self.assertEqual(ok.status_code, 200, ok.get_json())

    # ---- roles --------------------------------------------------------------
    def test_research_coordinator_can_book_and_academic_coordinator_cannot(self):
        self.ready_for_proposal()
        rc = self.book(client=self.research())
        self.assertEqual(rc.status_code, 200, rc.get_json())
        ac = self.book(client=self.academic(), day=future_weekday(40))
        self.assertEqual(ac.status_code, 403)

    def test_research_coordinator_can_open_panel_matching_and_scheduling_screens(self):
        for slug in ("panel-matching", "defense-scheduling", "research-gate"):
            response = self.research().get(f"/api/transactions/{slug}/context?student_id={self.student_id}")
            self.assertEqual(response.status_code, 200, (slug, response.get_json()))

    def test_panel_matching_needs_the_endorsed_form_1_first(self):
        with app.app_context():
            self.fill_uploads(self.student_id, TITLE, status="Complete")
            db.session.commit()
        response = self.research().post("/api/transactions/panel-matching", json={"student_id": self.student_id})
        self.assertEqual(response.status_code, 400, response.get_json())
        self.assertIn("endorsed", response.get_json()["error"].lower())

    def test_booking_is_refused_for_a_student_who_is_not_active(self):
        self.ready_for_proposal()
        with app.app_context():
            self.student_obj().standing = "AWOL"
            db.session.commit()
        response = self.book()
        self.assertEqual(response.status_code, 400, response.get_json())
        self.assertIn("active", response.get_json()["error"].lower())

    def test_panel_matching_is_refused_for_a_student_who_is_not_active(self):
        with app.app_context():
            self.student_obj().standing = "AWOL"
            db.session.commit()
        response = self.research().post("/api/transactions/panel-matching", json={"student_id": self.student_id})
        self.assertEqual(response.status_code, 400)
        self.assertIn("active", response.get_json()["error"].lower())


class PanelRuleTests(ResearchCoreBase):
    def roles(self, student, gate=None):
        from app import panel_roles_for_student
        return panel_roles_for_student(student, gate) if gate else panel_roles_for_student(student)

    def test_panel_size_by_paper_type_and_stage(self):
        with app.app_context():
            student = self.student_obj()
            # Thesis: external panelist only from the proposal defense onward.
            self.assertEqual(self.roles(student, TITLE), ["Panel Chair", "Content Specialist", "Method Specialist"])
            self.assertEqual(self.roles(student, PROPOSAL)[-1], "External Panel")
            self.assertEqual(len(self.roles(student, PROPOSAL)), 4)
            self.assertEqual(len(self.roles(student, FINAL)), 4)
            self.assertEqual(len(self.roles(student)), 4)  # default = full panel
            # Dissertation: chair + 2 content + method (+ external from proposal).
            student.program.name = "Doctor of Philosophy in Research"
            self.assertEqual(len(self.roles(student, TITLE)), 4)
            self.assertNotIn("External Panel", self.roles(student, TITLE))
            self.assertEqual(len(self.roles(student, PROPOSAL)), 5)
            # Project paper: chair + content + method at every stage, no external.
            student.program.name = "Master of Arts in Psychology"
            for gate in (TITLE, PROPOSAL, FINAL):
                self.assertEqual(self.roles(student, gate), ["Panel Chair", "Content Specialist", "Method Specialist"])
            db.session.rollback()


class TaskClosingTests(ResearchCoreBase):
    def test_review_tasks_close_when_the_step_completes(self):
        from app import ensure_open_task, sync_research_progress
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            student = self.student_obj()
            ensure_open_task(student.id, f"Review student {TITLE} application", "Research Coordinator", 3)
            ensure_open_task(student.id, "Review submitted Three concept papers", "Research Coordinator", 3)
            ensure_open_task(student.id, "Confirm assigned panel acceptance", "Research Coordinator", 3)
            ensure_open_task(student.id, "Review student Title Defense schedule request", "Research Coordinator", 4)
            ensure_open_task(student.id, f"Resolve {TITLE} requirements", "Student", 5)
            db.session.commit()
            self.assertEqual(len(self.open_tasks()), 5)
            sync_research_progress(student)
            db.session.commit()
            self.assertEqual(self.open_tasks(), [])

    def test_open_tasks_for_the_current_stage_stay_open(self):
        from app import ensure_open_task, sync_research_progress
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            student = self.student_obj()
            ensure_open_task(student.id, f"Resolve {PROPOSAL} requirements", "Research Coordinator", 5)
            db.session.commit()
            sync_research_progress(student)
            db.session.commit()
            self.assertEqual(len(self.open_tasks()), 1)

    def test_uploading_twice_does_not_create_duplicate_review_tasks(self):
        from app import ensure_open_task
        with app.app_context():
            for _ in range(3):
                ensure_open_task(self.student_id, "Review submitted Proposal manuscript", "Research Coordinator", 3)
            db.session.commit()
            self.assertEqual(len(self.open_tasks("Review submitted")), 1)

    def test_a_stale_overdue_task_leaves_the_work_queue_once_its_step_is_done(self):
        from app import ensure_open_task, sync_research_progress
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            task = ensure_open_task(self.student_id, "Review submitted Form 1 - Application for Title Defense", "Research Coordinator", -20)
            task.status = "Overdue"
            db.session.commit()
            sync_research_progress(self.student_obj())
            db.session.commit()
        queue = self.staff().get("/api/tasks?owner=Research Coordinator").get_json()["items"]
        self.assertEqual([t for t in queue if "Form 1" in t["title"]], [])


class StartupTests(ResearchCoreBase):
    def test_startup_sync_does_not_reset_a_password_that_a_faculty_member_chose(self):
        from app import ensure_faculty_account_schema
        from werkzeug.security import check_password_hash
        with app.app_context():
            account = UserAccount.query.filter_by(faculty_id=self.faculty_ids["Chair Person"]).one()
            account.password_hash = generate_password_hash("my-own-password")
            db.session.commit()
            ensure_faculty_account_schema()
            account = UserAccount.query.filter_by(faculty_id=self.faculty_ids["Chair Person"]).one()
            self.assertTrue(check_password_hash(account.password_hash, "my-own-password"))
            self.assertFalse(check_password_hash(account.password_hash, "DemoPass123!"))

    def test_a_new_faculty_account_still_gets_the_initial_password(self):
        from app import ensure_faculty_user_account
        from werkzeug.security import check_password_hash
        with app.app_context():
            faculty = Faculty(name="Brand New", college="GS", role="Faculty", specialization="x", email="brand.new@example.test", active=True)
            db.session.add(faculty)
            db.session.flush()
            account = ensure_faculty_user_account(faculty, "DemoPass123!")
            db.session.commit()
            self.assertTrue(check_password_hash(account.password_hash, "DemoPass123!"))


class EthicsOrderTests(ResearchCoreBase):
    """Protocol: proposal defense -> Form 5.1 -> ethics review (Form 5.2) -> needed before the final stage."""

    FOUR = ["Chair Person", "Content Person", "Method Person", "External Person"]

    def items(self, progress):
        return {i["item_name"]: i for i in progress["milestone"]["requirements"]}

    def test_ethics_is_not_needed_to_schedule_the_proposal_defense(self):
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            self.fill_uploads(self.student_id, PROPOSAL, status="Complete")
            self.panel(self.student_id, PROPOSAL, self.FOUR)
            db.session.commit()
            names = required_documents_for_gate(PROPOSAL)
            self.assertLess(names.index("Proposal defense result"), names.index("Ethics Clearance"))
            self.assertIn("Form 5.1 - Technical Review Certificate", names)
            progress = detected_research_progress(self.student_obj())
            self.assertEqual(progress["gate"], PROPOSAL)
            items = self.items(progress)
            self.assertEqual(items["Ethics Clearance"]["status"], "Pending")
            self.assertIn("after the proposal defense", items["Ethics Clearance"]["status_label"].lower())
            # Not counted as something the student is missing before the defense.
            self.assertEqual(progress["milestone"]["student_missing_count"], 0)

    def test_students_cannot_upload_ethics_before_the_defense_passed(self):
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            self.fill_uploads(self.student_id, PROPOSAL, status="Complete")
            db.session.commit()
        from io import BytesIO
        response = self.student().post(
            "/api/student-portal/research-evidence/upload",
            data={"gate": PROPOSAL, "item_name": "Ethics Clearance", "file": (BytesIO(b"%PDF-1.4\nx\n%%EOF\n"), "e.pdf")},
            content_type="multipart/form-data")
        self.assertEqual(response.status_code, 409, response.get_json())

    def test_after_a_pass_form_5_1_and_ethics_become_the_missing_items_and_block_final(self):
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            self.fill_uploads(self.student_id, PROPOSAL, status="Complete")
            for item in required_documents_for_gate(PROPOSAL):
                if item not in POST_DEFENSE_ITEMS:
                    self.doc(self.student_id, PROPOSAL, item).status = "Complete"
            panel = self.panel(self.student_id, PROPOSAL, self.FOUR)
            schedule = self.schedule(self.student_id, "Proposal Defense", status="Held", names=self.FOUR)
            db.session.add(DefenseVerdict(
                student_id=self.student_id, schedule_request_id=schedule.id, panel_assignment_id=panel[0].id,
                faculty_id=panel[0].faculty_id, gate=PROPOSAL, defense_type="Proposal Defense", research_title="T",
                chair_name="Chair Person", result="Passed", defense_date=schedule.preferred_date))
            db.session.commit()
            progress = detected_research_progress(self.student_obj())
            self.assertEqual(progress["gate"], PROPOSAL)  # stage not finished: ethics still to do
            items = self.items(progress)
            self.assertEqual(items["Proposal defense result"]["status"], "Complete")
            self.assertEqual(items["Form 5.1 - Technical Review Certificate"]["status"], "Missing")
            self.assertEqual(items["Ethics Clearance"]["status"], "Missing")
            # Complete them and the student moves on to the final stage.
            for item in POST_DEFENSE_ITEMS:
                self.add_file(self.student_id, PROPOSAL, item, status="Complete")
            self.doc(self.student_id, PROPOSAL, "Ethics clearance status and date").status = "Complete"
            db.session.commit()
            self.assertEqual(detected_research_progress(self.student_obj())["gate"], FINAL)

    def test_a_record_that_predates_form_5_1_stays_valid_when_ethics_is_cleared(self):
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            self.pass_gate(self.student_id, PROPOSAL, "Proposal Defense", names=self.FOUR)
            # Old record: no Form 5.1 row or file at all, ethics cleared.
            check = DocumentCheck.query.filter_by(
                student_id=self.student_id, gate=PROPOSAL, item_name="Form 5.1 - Technical Review Certificate").first()
            for evidence in list(check.evidence_files):
                db.session.delete(evidence)
            db.session.delete(check)
            db.session.commit()
            progress = detected_research_progress(self.student_obj())
            self.assertEqual(progress["gate"], FINAL)


class VerdictFlowTests(ResearchCoreBase):
    """Whole loops: every verdict ends in a defined next state and the stage can still finish."""

    FOUR = ["Chair Person", "Content Person", "Method Person", "External Person"]

    def setUp(self):
        super().setUp()
        patcher = patch("app.faculty_calendar_blocks", return_value=[], create=True)
        patcher.start()
        self.addCleanup(patcher.stop)

    def proposal_booked_and_held(self, result, **extra):
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            self.fill_uploads(self.student_id, PROPOSAL, status="Complete")
            self.panel(self.student_id, PROPOSAL, self.FOUR)
            schedule = self.schedule(self.student_id, "Proposal Defense", names=self.FOUR)
            db.session.commit()
            schedule_id = schedule.id
        response = self.faculty_client("Chair Person").post(
            f"/api/faculty-portal/defense-verdicts/{schedule_id}", json={"result": result, **extra})
        self.assertEqual(response.status_code, 200, response.get_json())
        return schedule_id, response.get_json()["verdict"]["id"]

    def book(self, **over):
        day = over.pop("day", future_weekday(21))
        payload = {
            "student_id": self.student_id, "preferred_date": day.isoformat(),
            "selected_start": "09:00", "selected_end": "11:00", "defense_type": "Proposal Defense",
            "mode": "Online", "venue": "Zoom room A",
        }
        payload.update(over)
        return self.staff().post("/api/transactions/defense-scheduling", json=payload)

    def test_redefense_loop_finishes_the_stage_after_the_second_defense_passes(self):
        first_id, _ = self.proposal_booked_and_held("Provisional pass - re-defense required")
        with app.app_context():
            # The student resubmits (signed again) ...
            self.fill_uploads(self.student_id, PROPOSAL, status="Complete")
            db.session.commit()
        # ... and staff book the re-defense with the same panel.
        booked = self.book()
        self.assertEqual(booked.status_code, 200, booked.get_json())
        with app.app_context():
            rows = ScheduleRequest.query.filter_by(student_id=self.student_id, defense_type="Proposal Defense").order_by(ScheduleRequest.id).all()
            self.assertEqual([r.status for r in rows], ["Held", "Scheduled"])
            second_id = rows[-1].id
            rows[-1].preferred_date = date.today() - timedelta(days=1)  # the defense day has come
            db.session.commit()
        passed = self.faculty_client("Chair Person").post(
            f"/api/faculty-portal/defense-verdicts/{second_id}", json={"result": "Passed"})
        self.assertEqual(passed.status_code, 200, passed.get_json())
        with app.app_context():
            items = {i["item_name"]: i for i in detected_research_progress(self.student_obj())["milestone"]["requirements"]}
            self.assertEqual(items["Proposal defense result"]["status"], "Complete")
            self.assertEqual(items["Agreed defense schedule in Form 4"]["status"], "Complete")

    def test_deferred_defense_is_rebooked_and_linked_to_the_deferred_record(self):
        deferred_id, _ = self.proposal_booked_and_held("Deferred", remarks="Chair was ill")
        booked = self.book()
        self.assertEqual(booked.status_code, 200, booked.get_json())
        with app.app_context():
            newest = ScheduleRequest.query.filter_by(student_id=self.student_id, defense_type="Proposal Defense").order_by(ScheduleRequest.id.desc()).first()
            self.assertEqual(newest.rescheduled_from_id, deferred_id)
            self.assertEqual(db.session.get(ScheduleRequest, deferred_id).status, "Deferred")
            # The "reschedule the deferred defense" task is closed by the new booking.
            self.assertEqual([t for t in self.open_tasks() if "Reschedule deferred" in t.title], [])

    def test_failed_proposal_is_rebooked_after_resubmission(self):
        self.proposal_booked_and_held("Failed")
        blocked = self.book()  # nothing resubmitted yet: the requirements are missing again
        self.assertEqual(blocked.status_code, 400, blocked.get_json())
        with app.app_context():
            self.fill_uploads(self.student_id, PROPOSAL, status="Complete")
            db.session.commit()
        ok = self.book()
        self.assertEqual(ok.status_code, 200, ok.get_json())

    def test_no_new_defense_can_be_booked_while_minor_revisions_are_pending(self):
        self.proposal_booked_and_held("Passed with minor revisions")
        response = self.book()
        self.assertEqual(response.status_code, 400, response.get_json())
        self.assertIn("revisions", response.get_json()["error"].lower())

    def test_confirmed_revisions_count_as_a_passed_defense_for_graduation(self):
        from app import graduation_research_progress
        _schedule_id, verdict_id = self.proposal_booked_and_held("Passed with minor revisions")
        with app.app_context():
            stage = next(s for s in graduation_research_progress(self.student_obj())["stages"] if s["gate"] == PROPOSAL)
            self.assertFalse(stage["defense"]["complete"])
        self.student().post(f"/api/student-portal/defense-verdicts/{verdict_id}/revisions", json={"note": "done"})
        self.faculty_client("Adviser Person").post(f"/api/faculty-portal/defense-verdicts/{verdict_id}/confirm-revisions", json={})
        with app.app_context():
            stage = next(s for s in graduation_research_progress(self.student_obj())["stages"] if s["gate"] == PROPOSAL)
            self.assertTrue(stage["defense"]["complete"])

    def test_student_context_tells_the_student_what_to_do_after_the_verdict(self):
        _schedule_id, verdict_id = self.proposal_booked_and_held("Passed with minor revisions")
        context = self.student().get("/api/student-portal/context").get_json()
        follow_up = context["defense_follow_up"]
        self.assertTrue(follow_up["can_submit_revisions"])
        self.assertEqual(follow_up["verdict"]["id"], verdict_id)
        self.assertEqual(follow_up["confirmed_by_role"], "Research Adviser")
        self.assertIn("Passed with minor revisions", [v["value"] for v in context["research_vocabulary"]["verdicts"]])

    def test_faculty_context_offers_correction_to_the_chair_until_it_is_acted_on(self):
        _schedule_id, _verdict_id = self.proposal_booked_and_held("Failed")
        context = self.faculty_client("Chair Person").get("/api/faculty-portal/context").get_json()
        panel = next(p for p in context["panels"] if p["gate"] == PROPOSAL)
        self.assertTrue(panel["can_correct_verdict"])
        self.assertFalse(panel["can_submit_verdict"])

    def test_the_rc_review_does_not_mark_locked_ethics_items_complete(self):
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            self.fill_uploads(self.student_id, PROPOSAL, status="Submitted")
            db.session.commit()
        response = self.research().post("/api/transactions/research-gate", json={"student_id": self.student_id})
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            ethics = DocumentCheck.query.filter_by(student_id=self.student_id, gate=PROPOSAL, item_name="Ethics Clearance").first()
            self.assertNotEqual(ethics.status, "Complete")
            from app import student_ethics_cleared
            self.assertFalse(student_ethics_cleared(self.student_obj()))

    def test_ethics_can_be_recorded_only_after_a_passed_defense_with_form_5_1(self):
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            self.fill_uploads(self.student_id, PROPOSAL, status="Complete")
            db.session.commit()
        early = self.research().post("/api/transactions/research-gate", json={
            "student_id": self.student_id, "ethics_clearance_status": "Cleared", "ethics_clearance_date": date.today().isoformat()})
        self.assertEqual(early.status_code, 400, early.get_json())
        self.assertIn("after the proposal defense", early.get_json()["error"])

    def test_disapproved_title_needs_a_new_panel_match_when_the_student_resubmits(self):
        from io import BytesIO
        with app.app_context():
            self.endorse(self.student_id)
            self.fill_uploads(self.student_id, TITLE, status="Complete")
            self.panel(self.student_id, TITLE)
            schedule = self.schedule(self.student_id, "Title Defense")
            db.session.commit()
            schedule_id = schedule.id
        self.faculty_client("Chair Person").post(f"/api/faculty-portal/defense-verdicts/{schedule_id}", json={"result": "Failed"})
        response = self.student().post(
            "/api/student-portal/research-evidence/upload",
            data={"gate": TITLE, "item_name": "Three concept papers", "file": (BytesIO(b"%PDF-1.4\nnew title one\n%%EOF\n"), "new-1.pdf")},
            content_type="multipart/form-data")
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            self.assertEqual(PanelAssignment.query.filter_by(student_id=self.student_id, gate=TITLE).count(), 0)
            self.assertIsNone(Form1Endorsement.query.filter_by(student_id=self.student_id).first())
            # The older papers are still on record (superseded, not deleted).
            self.assertGreaterEqual(ResearchEvidenceFile.query.filter_by(student_id=self.student_id).count(), 5)
            for evidence in ResearchEvidenceFile.query.filter(ResearchEvidenceFile.original_name == "new-1.pdf").all():
                from app import UPLOAD_ROOT
                (UPLOAD_ROOT / evidence.stored_name).unlink(missing_ok=True)

    def test_existing_old_vocabulary_rows_are_migrated(self):
        from app import migrate_research_vocabulary
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            self.fill_uploads(self.student_id, PROPOSAL)
            panel = self.panel(self.student_id, PROPOSAL, self.FOUR)
            scheduled = self.schedule(self.student_id, "Proposal Defense", status="Scheduled", names=self.FOUR)
            db.session.add(DefenseVerdict(
                student_id=self.student_id, schedule_request_id=scheduled.id, panel_assignment_id=panel[0].id,
                faculty_id=panel[0].faculty_id, gate=PROPOSAL, defense_type="Proposal Defense", research_title="T",
                chair_name="Chair Person", result="Passed with revisions", defense_date=scheduled.preferred_date))
            legacy_current = self.schedule(self.student_id, "Final Defense", status="Rescheduled", names=self.FOUR)
            db.session.commit()
            migrate_research_vocabulary()
            db.session.commit()
            verdict = DefenseVerdict.query.filter_by(defense_type="Proposal Defense").one()
            self.assertEqual(verdict.result, "Passed with minor revisions")
            self.assertEqual(verdict.revision_status, "Awaiting revisions")
            self.assertEqual(db.session.get(ScheduleRequest, scheduled.id).status, "Held")
            self.assertEqual(db.session.get(ScheduleRequest, legacy_current.id).status, "Scheduled")
            migrate_research_vocabulary()  # idempotent
            db.session.commit()
            self.assertEqual(db.session.get(ScheduleRequest, scheduled.id).status, "Held")


if __name__ == "__main__":
    unittest.main()
