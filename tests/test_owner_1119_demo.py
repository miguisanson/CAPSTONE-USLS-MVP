"""Owner 2026-11-19: resetting a Graduation or Withdrawal demo student fills the group-step column with five other students
("Application submitted" for Graduation, "Excel export" for Withdrawal), so "Select all" and "Create batch" can be shown."""
import os
import tempfile
import unittest

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_DB_FILE.name}")
os.environ["GOOGLE_API_KEY"] = ""
os.environ["ANTHROPIC_API_KEY"] = ""  # the tests never call Claude, whatever .env holds
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="uploads-"))

from app import (  # noqa: E402
    DEMO_STUDENT_NUMBERS, GraduationEndorsement, Student, UserAccount, WithdrawalApplication, app, build_demo_database, db,
)


class DemoResetFillsTheGroupColumnTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        with app.app_context():
            build_demo_database()

    def staff(self):
        client = app.test_client()
        with app.app_context():
            account_id = UserAccount.query.filter_by(email="staff@usls.edu.ph").one().id
        with client.session_transaction() as session:
            session["account_id"], session["role"] = account_id, "staff"
        return client

    def reset(self, slug, number):
        with app.app_context():
            student_id = Student.query.filter_by(student_number=number).one().id
        response = self.staff().post(f"/api/transactions/{slug}/demo-reset", json={"student_id": student_id})
        self.assertEqual(response.status_code, 200, response.get_json())

    def others(self, rows):
        demo = set(DEMO_STUDENT_NUMBERS.values())
        return [row for row in rows if row.student and row.student.student_number not in demo]

    def test_graduation_reset_leaves_five_other_submitted_applications(self):
        self.reset("graduation", DEMO_STUDENT_NUMBERS["GRAD-01"])
        with app.app_context():
            waiting = self.others(GraduationEndorsement.query.filter(
                GraduationEndorsement.batch_name.is_(None), GraduationEndorsement.request_attachment_id.isnot(None),
                GraduationEndorsement.endorsement_status == "For Review").all())
            self.assertGreaterEqual(len(waiting), 5)
        rows = self.staff().get("/api/transactions/graduation/context").get_json()["roster"]
        ready = [row for row in rows if row["eligibility"]["eligible"] and row["has_submitted_documents"] and not (row["endorsement"] or {}).get("batch_name")]
        self.assertGreaterEqual(len([row for row in ready if row["student"]["student_number"] not in set(DEMO_STUDENT_NUMBERS.values())]), 5)
        # A second reset does not pile up more.
        self.reset("graduation", DEMO_STUDENT_NUMBERS["GRAD-02"])
        with app.app_context():
            again = self.others(GraduationEndorsement.query.filter(
                GraduationEndorsement.batch_name.is_(None), GraduationEndorsement.request_attachment_id.isnot(None),
                GraduationEndorsement.endorsement_status == "For Review").all())
            self.assertEqual(len(again), len(waiting))

    def test_the_new_graduation_candidates_stay_eligible_and_are_exported(self):
        """The students the reset adds keep their completed research, so the Dean's CSV includes them."""
        from app import graduation_eligibility
        self.reset("graduation", DEMO_STUDENT_NUMBERS["GRAD-01"])
        staff = self.staff()
        for _ in range(2):  # opening the pages syncs the portal; it must not move them back
            staff.get("/api/transactions/graduation/context")
        with app.app_context():
            added = self.others(GraduationEndorsement.query.filter(
                GraduationEndorsement.batch_name.is_(None), GraduationEndorsement.request_attachment_id.isnot(None),
                GraduationEndorsement.endorsement_status == "For Review").all())
            self.assertTrue(added)
            for endorsement in added:
                self.assertTrue(graduation_eligibility(endorsement.student)["eligible"], endorsement.student.name)

    def client(self, email, role):
        client = app.test_client()
        with app.app_context():
            account_id = UserAccount.query.filter_by(email=email).one().id
        with client.session_transaction() as session:
            session["account_id"], session["role"] = account_id, role
        return client

    def test_a_batch_of_the_new_candidates_is_in_the_deans_csv(self):
        self.reset("graduation", DEMO_STUDENT_NUMBERS["GRAD-01"])
        with app.app_context():
            ids = [item.student_id for item in self.others(GraduationEndorsement.query.filter(
                GraduationEndorsement.batch_name.is_(None), GraduationEndorsement.request_attachment_id.isnot(None),
                GraduationEndorsement.endorsement_status == "For Review").all())]
            names = {db.session.get(Student, sid).student_number for sid in ids}
        staff = self.staff()
        academic = self.client("academic@usls.edu.ph", "academic_coordinator")
        research = self.client("research@usls.edu.ph", "research_coordinator")
        dean = self.client("dean@usls.edu.ph", "dean")
        for client, action in [(staff, "create_batch"), (staff, "compile_to_ac"), (academic, "check_coursework"),
                               (research, "validate_research"), (staff, "prepare_endorsement"), (staff, "send_to_dean"),
                               (dean, "approve")]:
            response = client.post("/api/graduation/batch-actions", json={"student_ids": ids, "stage_action": action, "action": action})
            self.assertEqual(response.status_code, 200, (action, response.get_json()))
            body = response.get_json()
            self.assertFalse(body.get("skipped"), (action, body.get("skipped")))
        with app.app_context():
            endorsement_ids = [GraduationEndorsement.query.filter_by(student_id=sid).one().id for sid in ids]
        csv = dean.post("/api/graduation/endorsed.csv", json={"endorsement_ids": endorsement_ids})
        self.assertEqual(csv.status_code, 200, csv.get_data(as_text=True)[:300])
        text = csv.get_data(as_text=True)
        for number in names:
            self.assertIn(number, text)

    def test_withdrawal_reset_leaves_five_others_ready_for_the_excel_export(self):
        self.reset("withdrawal", DEMO_STUDENT_NUMBERS["WD-01"])
        cases = self.staff().get("/api/process-cases?slug=withdrawal").get_json()["cases"]
        demo = set(DEMO_STUDENT_NUMBERS.values())
        ready = [case for case in cases if case["status"] == "Subject Tagged - Registrar Preparation" and case["student"]["student_number"] not in demo]
        self.assertGreaterEqual(len(ready), 5)
        self.assertTrue(all(case["reason"] and case["subject"]["code"] for case in ready))


if __name__ == "__main__":
    unittest.main()
