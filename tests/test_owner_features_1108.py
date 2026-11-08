"""Owner requests 2026-11-08: practicum hours read from the certificate, automatic graduation batch names,
and a history of exported Registrar lists for Graduation and Withdrawal.

None of these tests changes who may do a step or the order of the steps. They check that:
- the student no longer types practicum hours: the server reads "N hours completed" from the uploaded PDF;
- a certificate with no hours number still goes through, and Graduate School staff enter the hours when they forward it;
- a new graduation batch always gets the next free name for the month, whatever the browser sends;
- every Graduation and Withdrawal export is listed in the export history.

One seeded demo database is built for the whole module; each test puts back what it changed.
"""
import os
import tempfile
import unittest
from io import BytesIO

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ["USLS_UPLOAD_DIR"] = tempfile.mkdtemp(prefix="uploads-")

from app import (  # noqa: E402
    GraduationEndorsement,
    PracticumRecord,
    Program,
    Student,
    UserAccount,
    WithdrawalApplication,
    app,
    build_demo_database,
    db,
    generate_password_hash,
    hours_completed_from_text,
)


def text_pdf(text: str) -> bytes:
    """A one-page PDF whose text layer says `text` (what a typed certificate looks like)."""
    import pymupdf

    document = pymupdf.open()
    page = document.new_page()
    page.insert_text((72, 120), text, fontsize=14)
    data = document.tobytes()
    document.close()
    return data


class HoursFromTextTests(unittest.TestCase):
    def test_reads_the_number_before_hours_completed(self):
        self.assertEqual(hours_completed_from_text("120  hours  completed"), 120)
        self.assertEqual(hours_completed_from_text("This certifies that the student has 200 hours completed."), 200)

    def test_reads_other_common_wordings(self):
        self.assertEqual(hours_completed_from_text("The student completed 150 hours of practicum."), 150)
        self.assertEqual(hours_completed_from_text("Total hours rendered: 210"), 210)
        self.assertEqual(hours_completed_from_text("180 hrs. completed"), 180)
        self.assertEqual(hours_completed_from_text("Student: Paolo Ramirez (MSGC)\nHours certified: 200"), 200)
        self.assertEqual(hours_completed_from_text("This certifies 160 hours rendered at the site."), 160)

    def test_adds_up_several_certificates_in_one_file(self):
        self.assertEqual(hours_completed_from_text("Site A: 120 hours completed\n\nSite B: 80 hours completed"), 200)

    def test_no_number_means_not_found(self):
        self.assertIsNone(hours_completed_from_text("Student has completed OJT hours"))
        self.assertIsNone(hours_completed_from_text("200 hours are required for the practicum"))
        self.assertIsNone(hours_completed_from_text(""))


class OwnerFeatureTests(unittest.TestCase):
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
    def client_for(self, account_id, role):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    def account_id(self, email):
        with app.app_context():
            return UserAccount.query.filter_by(email=email).one().id

    def staff(self):
        return self.client_for(self.account_id("staff@usls.edu.ph"), "staff")

    def practicum_student(self):
        """A practicum-scope student with a record at 'Practicum In Progress' and a signed-in student client."""
        with app.app_context():
            program = Program.query.filter(Program.code == "MSGC").first() or Program.query.filter(Program.name.ilike("%psychology%")).first()
            self.assertIsNotNone(program, "the seed has no practicum program")
            student = Student.query.filter_by(program_id=program.id).filter(Student.standing.in_(["Active", None, ""])).first() \
                or Student.query.filter_by(program_id=program.id).first()
            previous = [(row.id, row.status, row.completed_hours, row.certificate_attachment_id) for row in
                        PracticumRecord.query.filter_by(student_id=student.id).all()]
            standing = (student.standing, student.enrollment_tag)
            student.standing, student.enrollment_tag = "Active", "Enrolled"
            record = PracticumRecord(student_id=student.id, status="Practicum In Progress", required_hours=200,
                                     completed_hours=0, moa_uploaded=True, moa_status="Verified", practicum_site="Test Site")
            db.session.add(record)
            email = f"practicum-hours-{student.id}-{len(previous)}-{os.getpid()}@example.test"
            account = UserAccount(email=email, full_name="Test Student", password_hash=generate_password_hash("x"),
                                  role="student", active=True, student_id=student.id)
            db.session.add(account)
            db.session.commit()
            student_id, record_id, account_id = student.id, record.id, account.id

        def restore():
            with app.app_context():
                db.session.delete(db.session.get(PracticumRecord, record_id))
                db.session.delete(db.session.get(UserAccount, account_id))
                row = db.session.get(Student, student_id)
                row.standing, row.enrollment_tag = standing
                db.session.commit()
        self.addCleanup(restore)
        return student_id, record_id, self.client_for(account_id, "student")

    def upload(self, client, text):
        response = client.post(
            "/api/student-portal/request-attachments/upload",
            data={"request_type": "practicum", "file": (BytesIO(text_pdf(text)), "certificate.pdf")},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()["attachment"]["id"]

    # ---- practicum hours come from the certificate ----------------------------------------------
    def test_the_upload_preview_says_how_many_hours_the_certificate_states(self):
        _student_id, _record_id, client = self.practicum_student()
        attachment_id = self.upload(client, "150 hours completed")
        response = client.get(f"/api/student-portal/practicum/certificate-hours/{attachment_id}")
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(response.get_json()["hours"], 150)

    def test_the_server_uses_the_hours_on_the_certificate_not_a_typed_number(self):
        _student_id, record_id, client = self.practicum_student()
        attachment_id = self.upload(client, "210 hours completed")
        response = client.post("/api/student-portal/requests/practicum",
                               json={"certificate_attachment_id": attachment_id, "completed_hours": 5})
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            record = db.session.get(PracticumRecord, record_id)
            self.assertEqual(record.completed_hours, 210)
            self.assertEqual(record.status, "Documents Submitted")

    def test_fewer_hours_than_required_on_the_certificate_is_hours_incomplete(self):
        _student_id, record_id, client = self.practicum_student()
        attachment_id = self.upload(client, "120 hours completed")
        response = client.post("/api/student-portal/requests/practicum",
                               json={"certificate_attachment_id": attachment_id, "completed_hours": 999})
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            record = db.session.get(PracticumRecord, record_id)
            self.assertEqual(record.completed_hours, 120)
            self.assertEqual(record.status, "Hours Incomplete")

    def test_a_certificate_without_a_number_still_goes_through_and_staff_enter_the_hours(self):
        student_id, record_id, client = self.practicum_student()
        attachment_id = self.upload(client, "Student has completed OJT hours")
        response = client.post("/api/student-portal/requests/practicum",
                               json={"certificate_attachment_id": attachment_id, "completed_hours": 200})
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertIn("staff", response.get_json()["message"].lower())
        with app.app_context():
            record = db.session.get(PracticumRecord, record_id)
            self.assertIsNone(record.completed_hours, "a typed number must not be used when the file states none")
            self.assertEqual(record.status, "Documents Submitted")

        staff = self.staff()
        refused = staff.post("/api/transactions/practicum", json={"student_id": student_id, "status": "Documents Under Review"})
        self.assertGreaterEqual(refused.status_code, 400, refused.get_json())
        self.assertIn("hours", refused.get_json()["error"].lower())

        done = staff.post("/api/transactions/practicum",
                          json={"student_id": student_id, "status": "Documents Under Review", "completed_hours": 205})
        self.assertEqual(done.status_code, 200, done.get_json())
        with app.app_context():
            record = db.session.get(PracticumRecord, record_id)
            self.assertEqual(record.completed_hours, 205)
            self.assertEqual(record.status, "Documents Under Review")

    def test_staff_cannot_overwrite_hours_the_certificate_already_stated(self):
        student_id, record_id, client = self.practicum_student()
        attachment_id = self.upload(client, "210 hours completed")
        client.post("/api/student-portal/requests/practicum", json={"certificate_attachment_id": attachment_id})
        done = self.staff().post("/api/transactions/practicum",
                                 json={"student_id": student_id, "status": "Documents Under Review", "completed_hours": 50})
        self.assertEqual(done.status_code, 200, done.get_json())
        with app.app_context():
            self.assertEqual(db.session.get(PracticumRecord, record_id).completed_hours, 210)

    # ---- graduation batch names are assigned, never typed -----------------------------------------
    def test_a_new_batch_gets_the_next_free_name_whatever_the_browser_sends(self):
        from app import default_graduation_batch_name
        with app.app_context():
            # The seeded candidate with an application already sits in a batch; take it out so it can be batched again.
            target = GraduationEndorsement.query.filter(
                GraduationEndorsement.endorsement_status == "For Review",
                GraduationEndorsement.request_attachment_id.isnot(None),
            ).first()
            self.assertIsNotNone(target, "the seed has no candidate with a submitted application")
            original_name = target.batch_name
            target.batch_name = None
            db.session.commit()
            expected = default_graduation_batch_name()
            snapshot = (target.id, original_name, target.endorsement_status, target.review_window)
            student_id = target.student_id
            # The browser tries to choose its own name (an old, already used batch); it must be ignored.
            taken = GraduationEndorsement.query.filter(GraduationEndorsement.endorsement_status == "Dean Approved").first().batch_name
            from app import default_graduation_school_year
            school_year = default_graduation_school_year()

        def restore():
            with app.app_context():
                row = db.session.get(GraduationEndorsement, snapshot[0])
                row.batch_name, row.endorsement_status, row.review_window = snapshot[1], snapshot[2], snapshot[3]
                db.session.commit()
        self.addCleanup(restore)

        response = self.staff().post("/api/graduation/batch-actions", json={
            "student_ids": [student_id], "stage_action": "create_batch", "action": "create_batch", "batch_name": taken,
            "batch_no": "1", "batch_month": "January", "batch_year": "2020", "review_window": school_year,
        })
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            self.assertEqual(db.session.get(GraduationEndorsement, snapshot[0]).batch_name, expected)
            self.assertNotEqual(expected, taken)

    def test_the_next_batch_name_counts_up_within_the_month(self):
        from app import default_graduation_batch_name
        with app.app_context():
            first = default_graduation_batch_name()
            row = GraduationEndorsement.query.first()
            saved = row.batch_name
            row.batch_name = first
            db.session.flush()
            second = default_graduation_batch_name()
            row.batch_name = saved
            db.session.commit()
        self.assertNotEqual(first, second)
        self.assertEqual(int(second.split()[1]), int(first.split()[1]) + 1)

    # ---- export history for Graduation and Withdrawal ----------------------------------------------
    def test_a_graduation_export_is_listed_in_the_export_history_with_its_batch(self):
        # The seeded Dean-approved candidates no longer pass the live eligibility check, so an eligible one is approved here.
        with app.app_context():
            row = GraduationEndorsement.query.filter_by(endorsement_status="For Review").first()
            endorsement_id, batch = row.id, row.batch_name
            before = (row.endorsement_status, row.registrar_status)
            row.endorsement_status = "Dean Approved"
            db.session.commit()

        def restore():
            with app.app_context():
                item = db.session.get(GraduationEndorsement, endorsement_id)
                item.endorsement_status, item.registrar_status = before
                db.session.commit()
        self.addCleanup(restore)
        dean = self.client_for(self.account_id("dean@usls.edu.ph"), "dean")
        response = dean.post("/api/graduation/endorsed.csv", json={"endorsement_ids": [endorsement_id]})
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
        self.assertTrue(response.headers.get("X-Registrar-Email"))
        history = dean.get("/api/leave-cases/export-log?slug=graduation").get_json()["items"]
        self.assertTrue(history, "the export was not recorded")
        latest = history[0]
        self.assertEqual(latest["slug"], "graduation")
        self.assertIn(endorsement_id, latest["case_ids"])
        self.assertIn(batch, latest["details"])
        self.assertTrue(latest["exported_by"])

    def test_a_withdrawal_export_is_listed_in_the_export_history_with_the_student(self):
        with app.app_context():
            application = WithdrawalApplication.query.filter(WithdrawalApplication.dean_decision == "Approved").first()
            self.assertIsNotNone(application, "the demo data has no Dean-approved withdrawal")
            before = (application.status, application.registrar_status, application.registrar_report_generated_at,
                      application.subject_enrollment.status if application.subject_enrollment else None)
            application.status, application.registrar_status = "Subject Tagged - Registrar Preparation", "Pending Excel Export"
            if application.subject_enrollment:
                application.subject_enrollment.status = "Withdrawn"
            db.session.commit()
            application_id, name = application.id, application.student.name

        def restore():
            with app.app_context():
                row = db.session.get(WithdrawalApplication, application_id)
                row.status, row.registrar_status, row.registrar_report_generated_at, enrollment_status = before
                if row.subject_enrollment and enrollment_status:
                    row.subject_enrollment.status = enrollment_status
                db.session.commit()
        self.addCleanup(restore)

        staff = self.staff()
        response = staff.post("/api/withdrawal/approved.xlsx", json={"application_ids": [application_id]})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.headers.get("X-Registrar-Email"))
        history = staff.get("/api/leave-cases/export-log?slug=withdrawal").get_json()["items"]
        self.assertTrue(history, "the export was not recorded")
        self.assertTrue(all(item["slug"] == "withdrawal" for item in history))
        self.assertIn(application_id, history[0]["case_ids"])
        self.assertIn(name, history[0]["details"])

if __name__ == "__main__":
    unittest.main()
