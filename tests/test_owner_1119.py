"""Owner requests 2026-11-19 (Withdrawal, Practicum and Graduation only).

- Practicum: the Academic Coordinator first saves the hours actually seen on the certificates; saving keeps the case
  with the Coordinator ("Documents Under Review"). Only then can the Coordinator request additional certificates,
  which reopens the student's Practicum Document submission for a new file.
- Withdrawal: a subject the Dean approved for withdrawal shows "Withdrawn" on the student's own subject list.
"""

import unittest

from tests.test_audit2 import Audit2Base

from app import (
    AcademicTerm, CourseRecord, PracticumRecord, Program, Student, StudentRequestAttachment, SubjectEnrollment,
    Task, WorkflowMessage, app, db, student_enrollment_snapshot,
)


class PracticumHoursFirstThenAdditionalCertificatesTests(Audit2Base):
    def setUp(self):
        super().setUp()
        with app.app_context():
            db.session.get(Program, self.program_id).name = "Master of Arts in Psychology"
            db.session.commit()

    def certificate(self, name="cert.pdf"):
        with app.app_context():
            row = StudentRequestAttachment(
                student_id=self.student_id, request_type="practicum", original_name=name, stored_name=f"o1119-{name}")
            db.session.add(row)
            db.session.commit()
            return row.id

    def under_review(self, claimed=200):
        with app.app_context():
            record = PracticumRecord(
                student_id=self.student_id, required_hours=200, status="Documents Under Review", completed_hours=claimed,
                document_status="Pending Review", certificate_attachment_id=self.certificate(), moa_status="Verified",
                moa_uploaded=True, practicum_site="Test Site",
            )
            db.session.add(record)
            db.session.commit()
            return record.id

    def step(self, **fields):
        return self.client("academic_coordinator").post(
            "/api/transactions/practicum", json={"student_id": self.student_id, **fields})

    def request_more(self):
        return self.step(status="Additional Certificates Requested",
                         return_reason="Upload the certificate for the remaining 50 hours.")

    def test_saving_fewer_verified_hours_keeps_the_case_with_the_coordinator(self):
        record_id = self.under_review(claimed=200)
        saved = self.step(status="Record Verified Hours", verified_hours="150", verified_note="Certificates add up to 150 hours.")
        self.assertEqual(saved.status_code, 200, saved.get_json())
        with app.app_context():
            record = db.session.get(PracticumRecord, record_id)
            self.assertEqual((record.status, record.verified_hours), ("Documents Under Review", 150))
            # Nothing is sent to the student yet: the Coordinator decides next (request additional certificates).
            self.assertEqual(
                WorkflowMessage.query.filter_by(transaction_slug="practicum", student_id=self.student_id,
                                                visibility="student_visible").count(), 0)

    def test_additional_certificates_can_be_requested_only_after_the_hours_are_saved(self):
        record_id = self.under_review(claimed=150)
        refused = self.request_more()
        self.assertEqual(refused.status_code, 400, refused.get_json())
        self.assertIn("verified hours", refused.get_json()["error"].lower())
        with app.app_context():
            self.assertEqual(db.session.get(PracticumRecord, record_id).status, "Documents Under Review")
        self.assertEqual(self.step(status="Record Verified Hours", verified_hours="150").status_code, 200)
        requested = self.request_more()
        self.assertEqual(requested.status_code, 200, requested.get_json())
        with app.app_context():
            self.assertEqual(db.session.get(PracticumRecord, record_id).status, "Additional Certificates Requested")
            self.assertTrue(Task.query.filter_by(student_id=self.student_id, owner_role="Student")
                            .filter(Task.title.contains("additional practicum certificates")).first())

    def test_the_student_can_send_a_new_certificate_and_the_hours_are_verified_again(self):
        record_id = self.under_review(claimed=150)
        self.assertEqual(self.step(status="Record Verified Hours", verified_hours="150").status_code, 200)
        self.assertEqual(self.request_more().status_code, 200)
        new_file = self.certificate("additional.pdf")
        resent = self.client("student").post("/api/student-portal/requests/practicum", json={
            "certificate_attachment_id": new_file, "remarks": "Certificate for the remaining hours."})
        self.assertEqual(resent.status_code, 200, resent.get_json())
        with app.app_context():
            record = db.session.get(PracticumRecord, record_id)
            self.assertIn(record.status, {"Documents Submitted", "Hours Incomplete"})
            self.assertEqual(record.certificate_attachment_id, new_file)
            # The new file is counted again from scratch: the earlier verified total is cleared.
            self.assertIsNone(record.verified_hours)


class WithdrawnSubjectTagTests(Audit2Base):
    def test_a_withdrawn_subject_shows_withdrawn_on_the_students_subject_list(self):
        with app.app_context():
            term = AcademicTerm.query.filter_by(label="Running Term").one()
            db.session.add(SubjectEnrollment(student_id=self.student_id, course_id=self.course_id, term_id=term.id,
                                             status="Withdrawn", source_reference="Approved subject withdrawal"))
            # apply_approved_subject_withdrawal resets the monitoring row to not started
            db.session.add(CourseRecord(student_id=self.student_id, course_id=self.course_id, status="Not Started"))
            db.session.commit()
            snapshot = student_enrollment_snapshot(db.session.get(Student, self.student_id), term)
            subject = next(row for row in snapshot["curriculum_subjects"] if row["id"] == self.course_id)
            self.assertEqual(subject["status"], "Withdrawn")
            self.assertFalse(subject["is_enrolled"])


if __name__ == "__main__":
    unittest.main()


class WithdrawnTagInAnotherSemesterTests(Audit2Base):
    def test_a_subject_withdrawn_for_next_semester_shows_withdrawn_now(self):
        """The demo withdrawals are for the semester that starts next ("Before classes begin"), not the running one."""
        with app.app_context():
            later = AcademicTerm.query.filter_by(label="Term One").one()
            running = AcademicTerm.query.filter_by(label="Running Term").one()
            db.session.add(SubjectEnrollment(student_id=self.student_id, course_id=self.course_id, term_id=later.id,
                                             status="Withdrawn", source_reference="Approved subject withdrawal"))
            db.session.add(CourseRecord(student_id=self.student_id, course_id=self.course_id, status="Not Started"))
            db.session.commit()
            snapshot = student_enrollment_snapshot(db.session.get(Student, self.student_id), running)
            subject = next(row for row in snapshot["curriculum_subjects"] if row["id"] == self.course_id)
            self.assertEqual(subject["status"], "Withdrawn")


class WithdrawalBatchAndRegistrarColumnTests(Audit2Base):
    """Owner 2026-11-19 (second list): one export = one automatic batch name; a 'Waiting for Registrar acknowledgement'
    column; the card carries the reason so the staff and Dean confirm windows can show it."""

    def exported(self, at, count=1):
        from datetime import datetime  # noqa: F401
        from app import WithdrawalApplication
        ids = []
        with app.app_context():
            for _ in range(count):
                application = WithdrawalApplication(
                    student_id=self.student_id, reason="Work schedule clash.",
                    status="Exported - Ready to Send", dean_decision="Approved", registrar_status="Exported - Ready to Send",
                    registrar_report_generated_at=at,
                )
                db.session.add(application)
                db.session.flush()
                ids.append(application.id)
            db.session.commit()
        return ids

    def test_one_export_is_one_batch_named_by_month(self):
        from datetime import datetime
        from app import WithdrawalApplication, withdrawal_process_case
        first = self.exported(datetime(2026, 11, 3, 9, 0), count=2)
        second = self.exported(datetime(2026, 11, 10, 14, 30))
        other_month = self.exported(datetime(2026, 12, 1, 8, 0))
        with app.app_context():
            names = {i: withdrawal_process_case(db.session.get(WithdrawalApplication, i))["batch_name"] for i in first + second + other_month}
        self.assertEqual({names[i] for i in first}, {"Batch 1 November 2026"})
        self.assertEqual(names[second[0]], "Batch 2 November 2026")
        self.assertEqual(names[other_month[0]], "Batch 1 December 2026")

    def test_the_card_carries_the_reason(self):
        from datetime import datetime
        from app import WithdrawalApplication, withdrawal_process_case
        [application_id] = self.exported(datetime(2026, 11, 3, 9, 0))
        with app.app_context():
            case = withdrawal_process_case(db.session.get(WithdrawalApplication, application_id))
        self.assertEqual(case["reason"], "Work schedule clash.")

    def test_sent_lists_wait_in_their_own_registrar_column(self):
        import standalone_process as sp
        columns = {column["key"]: column for column in sp.BOARD_COLUMNS["withdrawal"]}
        waiting = next(column for column in columns.values() if column["label"] == "Waiting for Registrar acknowledgement")
        self.assertEqual(waiting["statuses"], ["Sent to Registrar"])
        self.assertEqual(columns["sent"]["statuses"], ["Exported - Ready to Send"])
        acknowledged = next(column for column in columns.values() if "Withdrawn Confirmed" in column["statuses"])
        self.assertEqual(acknowledged["label"], "Acknowledged by Registrar")


class WithdrawalReasonIsTheStudentsTests(Audit2Base):
    """Owner 2026-11-19: staff and the Dean read the student's reason; only the student can change it."""

    def test_staff_and_dean_cannot_edit_the_reason_but_the_student_can(self):
        from app import WithdrawalApplication, withdrawal_process_case
        with app.app_context():
            application = WithdrawalApplication(student_id=self.student_id, reason="Work clash.", status="Submitted to GS Staff")
            db.session.add(application)
            db.session.commit()
            application_id = application.id
        for role in ("staff", "dean"):
            refused = self.client(role).patch(f"/api/edits/withdrawal_application/{application_id}",
                                              json={"field": "reason", "value": "Changed", "reason": "typo"})
            self.assertEqual(refused.status_code, 403, (role, refused.get_json()))
        case = self.client("staff").get(f"/api/process-cases/withdrawal/{application_id}").get_json()["case"]
        reason_row = next(row for row in case["summary_rows"] if row["label"] == "Reason")
        self.assertFalse((reason_row.get("edit") or {}).get("can"), reason_row.get("edit"))
        ok = self.client("student").patch(f"/api/edits/withdrawal_application/{application_id}",
                                          json={"field": "reason", "value": "Work schedule clash.", "reason": "typo"})
        self.assertEqual(ok.status_code, 200, ok.get_json())
