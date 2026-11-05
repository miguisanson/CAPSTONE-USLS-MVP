"""pkt/seedfix: I-374 (Dean's "ready" list = what the export accepts), I-376 (server wording and record stage),
I-378 (finished board columns), I-379 (group forward and the returnee checks). One seeded database for the module."""
import os
import tempfile
import unittest

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="uploads-"))

from app import GraduationEndorsement, UserAccount, app, build_demo_database, db, graduation_eligibility  # noqa: E402


class SeedFixTests(unittest.TestCase):
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

    def client(self, role):
        with app.app_context():
            account_id = UserAccount.query.filter_by(role=role).first().id
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    # ---- I-374
    def test_seeded_history_decided_endorsements_are_already_handled(self):
        with app.app_context():
            stuck = [
                e.id for e in GraduationEndorsement.query.filter_by(dean_remarks="Seeded history.", endorsement_status="Dean Approved").all()
            ]
            self.assertEqual(stuck, [], "past approved endorsements must carry the final Registrar state")
            done = GraduationEndorsement.query.filter_by(dean_remarks="Seeded history.", endorsement_status="Registrar Received").all()
            self.assertTrue(done)
            for item in done:
                self.assertEqual(item.registrar_status, "Acknowledged")
                self.assertIsNotNone(item.registrar_received_at)

    def test_every_dean_approved_endorsement_the_page_calls_ready_exports(self):
        with app.app_context():
            ids = [e.id for e in GraduationEndorsement.query.filter_by(endorsement_status="Dean Approved").all()
                   if e.registrar_status != "Exported - Ready to Send"]
            ineligible = [e.id for e in GraduationEndorsement.query.filter_by(endorsement_status="Dean Approved").all()
                          if not graduation_eligibility(e.student)["eligible"]]
        self.assertEqual(ineligible, [])
        if ids:
            response = self.client("dean").post("/api/graduation/endorsed.csv", json={"endorsement_ids": ids})
            self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
            self.assertNotIn("No longer eligible", response.get_data(as_text=True))

    def test_ineligible_dean_approved_row_says_why_on_the_roster(self):
        with app.app_context():
            item = GraduationEndorsement.query.filter_by(dean_remarks="Seeded history.", endorsement_status="Registrar Received").first()
            self.assertIsNotNone(item)
            student_id, before = item.student_id, (item.endorsement_status, item.registrar_status)
            item.endorsement_status, item.registrar_status = "Dean Approved", "Pending Handoff"
            db.session.commit()
            eligible = graduation_eligibility(item.student)["eligible"]
        self.assertFalse(eligible)
        rows = self.client("dean").get("/api/transactions/graduation/context").get_json()["roster"]
        row = next(r for r in rows if r["student"]["id"] == student_id)
        self.assertTrue(row.get("export_blocked_reason"))
        with app.app_context():
            item = GraduationEndorsement.query.filter_by(student_id=student_id).first()
            item.endorsement_status, item.registrar_status = before
            db.session.commit()

    # ---- I-378
    def test_withdrawal_board_keeps_finished_cards_out_of_the_to_do_column(self):
        from standalone_process import BOARD_COLUMNS, SLUG_WITHDRAWAL
        columns = BOARD_COLUMNS[SLUG_WITHDRAWAL]
        todo = next(c for c in columns if "Exported - Ready to Send" in c["statuses"])
        self.assertEqual(todo["statuses"], ["Exported - Ready to Send"])
        done = next(c for c in columns if "Sent to Registrar" in c["statuses"])
        self.assertIn("Withdrawn Confirmed", done["statuses"])
        self.assertNotEqual(done["key"], todo["key"])
        for column in columns:
            self.assertLessEqual(len(column["description"]), 90, column["key"])

    # ---- I-376 (server part)
    def test_student_record_names_the_approved_leave(self):
        from app import Student, active_leave_case
        with app.app_context():
            student = next(s for s in Student.query.all() if active_leave_case(s.id))
            student_id = student.id
        data = self.client("staff").get(f"/api/students/{student_id}").get_json()
        leave = data.get("approved_leave")
        self.assertTrue(leave and leave["status"] and leave["period"])
        other = self.client("staff").get("/api/students/1").get_json()
        with app.app_context():
            expected = active_leave_case(1)
        self.assertEqual(bool(other.get("approved_leave")), bool(expected))
        self.assertTrue(data["student"]["current_stage"])

    def test_reports_waiting_figure_says_what_it_counts(self):
        from app import REPORT_WAITING_DAYS  # noqa: F401
        data = self.client("dean").get("/api/reports/summary").get_json()
        tile = next(t for t in data["tiles"] if t["key"] == "waiting")
        self.assertIn("how long a request has been open", tile.get("note", ""))

    # ---- I-379
    def _returnee_cases(self):
        from app import AwolCase, LeaveCase
        with app.app_context():
            readmission = LeaveCase.query.filter(LeaveCase.kind == "READMISSION", LeaveCase.status.in_(("Submitted", "Staff Review"))).first()
            awol = AwolCase.query.filter_by(status="Return Submitted").first()
            self.assertTrue(readmission and awol, "the seed needs one open readmission and one submitted AWOL return")
            return readmission.id, f"awol-{awol.id}"

    def test_group_forward_is_not_offered_for_returnees_and_is_refused_with_one_line(self):
        readmission_id, awol_ref = self._returnee_cases()
        staff = self.client("staff")
        for slug, key in (("readmission", readmission_id), ("awol", awol_ref)):
            cases = staff.get(f"/api/process-cases?slug={slug}").get_json()["cases"]
            case = next(c for c in cases if str(c["id"]) == str(key) or c.get("ref") == key)
            forward = next(a for a in case["actions"] if a["action"] == "forward")
            self.assertFalse(forward["batch"], slug)
            response = staff.post(f"/api/process-cases/{slug}/batch", json={"case_ids": [key], "action": "forward"})
            self.assertEqual(response.status_code, 400, slug)
            self.assertIn("one at a time", response.get_json()["error"])
            self.assertLessEqual(len(response.get_json()["error"]), 140)
