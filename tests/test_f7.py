"""pkt/f7 (Fable review 3): F7-01 chips show the live research status, F7-02 graduation history only on eligible
students, F7-04 Ops Manual citation in plain words, F7-06 active-student definition, F7-08 a withdrawn panelist cannot
re-accept. One seeded database for the module."""
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

from app import (  # noqa: E402
    GraduationEndorsement, PanelInvitation, ResearchCase, Student, UserAccount, app, build_demo_database, db,
    graduation_eligibility,
)


class F7Tests(unittest.TestCase):
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

    def client(self, role, **kw):
        with app.app_context():
            q = UserAccount.query.filter_by(role=role)
            if kw:
                q = q.filter_by(**kw)
            account_id = q.first().id
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    # ---- F7-01
    def test_research_chip_status_is_the_live_progress_status(self):
        staff = self.client("staff")
        with app.app_context():
            ids = [sid for (sid,) in db.session.query(ResearchCase.student_id).all()]
        self.assertTrue(ids)
        mismatched = []
        for sid in ids[:40]:
            body = staff.get(f"/api/students/{sid}").get_json()
            case, progress = body["research_case"], body["research_progress"]
            live = "Verified Complete" if progress["gate"] == "Completion Evidence" and progress["status"] == "Complete" else progress["status"]
            if case["status"] != live or case["current_gate"] != progress["gate"]:
                mismatched.append((sid, case["status"], live))
        self.assertEqual(mismatched, [])

    def test_student_home_shows_one_research_status(self):
        with app.app_context():
            sid = Student.query.filter_by(student_number="2260011").first().id
        body = self.client("student", student_id=sid).get("/api/student-portal/context").get_json()
        live = body["research_progress"]["status"]
        self.assertEqual(body["research_case"]["status"], live)

    def test_cancelling_a_defense_syncs_the_stored_research_case(self):
        from app import ScheduleRequest, SLOT_HOLDING_DEFENSE_STATUSES
        with app.app_context():
            sched = ScheduleRequest.query.filter(ScheduleRequest.status.in_(SLOT_HOLDING_DEFENSE_STATUSES)).first()
            self.assertIsNotNone(sched)
            sid, schedule_id = sched.student_id, sched.id
        rc = self.client("research_coordinator")
        resp = rc.post(f"/api/defense-schedules/{schedule_id}/cancel", json={"reason": "Panel unavailable", "requested_by": "GS office"})
        self.assertEqual(resp.status_code, 200, resp.get_data(as_text=True))
        with app.app_context():
            from app import detected_research_progress
            case = ResearchCase.query.filter_by(student_id=sid).first()
            live = detected_research_progress(Student.query.get(sid), ensure_checks=False)
            self.assertEqual((case.current_gate, case.status), (live["gate"], live["status"]))

    # ---- F7-02
    def test_graduation_history_only_on_eligible_students(self):
        with app.app_context():
            bad = []
            received = GraduationEndorsement.query.filter_by(endorsement_status="Registrar Received").all()
            self.assertTrue(received, "F8-04: the seed has no Registrar Received history")
            for e in received:
                st = db.session.get(Student, e.student_id)
                if st.current_stage != "Completed":
                    bad.append((st.name, st.current_stage))
            self.assertEqual(bad, [])

    # ---- F7-04
    def test_student_policy_answer_names_the_ops_manual_in_plain_words(self):
        from app import _student_plain_policy
        text = "Stop coming?\nSource: USLS Graduate School Operations Manual (Proposed › 4.6.6 Exceptions and unusual cases)"
        out, _ = _student_plain_policy(text, [])
        self.assertNotIn("Source:", out)
        self.assertNotIn("Proposed", out)
        self.assertIn("Sources: Operations Manual 4.6.6", out)  # one Sources line (I-427)
        out, _ = _student_plain_policy("x\nSource: Graduate School Handbook (p. 54)", [])
        self.assertIn("Sources: Graduate School Handbook p. 54", out)

    # ---- F7-06
    def test_withdrawn_student_is_not_stalled_nor_in_the_graduation_loop(self):
        import app as appmod
        with app.app_context():
            rows = appmod.portfolio_recommendations(limit=1000)["items"]
            stalled = [r for r in rows if r["code"] == "stalled"]
            self.assertTrue(stalled, "seed has no stalled student to test with")
            sid = stalled[0]["student_id"]
            student = db.session.get(Student, sid)
            old = student.current_stage
            seen = []
            real = appmod.graduation_eligibility
            appmod.graduation_eligibility = lambda st, *a, **k: (seen.append(st.id), real(st, *a, **k))[1]
            try:
                student.current_stage = "Withdrawn"
                db.session.flush()
                after = appmod.portfolio_recommendations(limit=1000)["items"]
                appmod._graduation_forecast_report()
            finally:
                appmod.graduation_eligibility = real
                student.current_stage = old
                db.session.flush()
            self.assertFalse([r for r in after if r["student_id"] == sid and r["code"] == "stalled"])
            self.assertNotIn(sid, seen)

    # ---- F7-08
    def test_declined_panelist_cannot_accept_again(self):
        with app.app_context():
            inv = PanelInvitation.query.first()
            inv_id, fid = inv.id, inv.faculty_id
            inv.status = "Declined"
            db.session.commit()
            fac_account = UserAccount.query.filter_by(role="faculty", faculty_id=fid).first()
        self.assertIsNotNone(fac_account)
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = fac_account.id
            session["role"] = "faculty"
        resp = client.post(f"/api/faculty-portal/panel-invitations/{inv_id}/respond", json={"response": "accept"})
        self.assertEqual(resp.status_code, 409, resp.get_data(as_text=True))
        self.assertIn("send the invitation again", resp.get_json()["error"])
        with app.app_context():
            self.assertEqual(db.session.get(PanelInvitation, inv_id).status, "Declined")


if __name__ == "__main__":
    unittest.main()
