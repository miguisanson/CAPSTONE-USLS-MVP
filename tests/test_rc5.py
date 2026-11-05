"""RC5 (persona coordinator-research): Research Coordinator home, one readiness word, one panel-load count."""
import unittest

from tests import test_standalone_consistency as base  # noqa: E402  (sets DATABASE_URL before app is imported)
from app import (  # noqa: E402
    Faculty, PanelAssignment, Student, app, db, faculty_dict, faculty_profile_dict, panel_matching_result,
    research_gate_overview_rows, student_directory_brief,
)


class Rc5Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from app import build_demo_database
        app.config.update(TESTING=True)
        with app.app_context():
            db.drop_all()
            db.create_all()
            build_demo_database()

    def client_for(self, email, role):
        with app.app_context():
            account_id = base.UserAccount.query.filter_by(email=email).one().id
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    # I-388
    def test_research_coordinator_home_lists_ready_students(self):
        research = self.client_for("research@usls.edu.ph", "research_coordinator")
        with app.app_context():
            ready = [row for row in research_gate_overview_rows() if row["state"] == "ready"]
        self.assertTrue(ready)
        block = research.get("/api/dashboard").get_json()["research_ready"]
        self.assertEqual(block["total"], len(ready))
        self.assertLessEqual(len(block["items"]), 3)
        self.assertEqual(block["view_all"], "/workflow/research-gate")
        ready_ids = {row["student"]["id"] for row in ready}
        for item in block["items"]:
            self.assertIn(item["student_id"], ready_ids)
            self.assertTrue(item["reason"])
        staff = self.client_for("staff@usls.edu.ph", "staff").get("/api/dashboard").get_json()
        self.assertIsNone(staff["research_ready"])

    # I-387
    def test_student_picker_status_agrees_with_the_research_gate(self):
        with app.app_context():
            ana = next(s for s in Student.query.all() if s.name == "Ana Abad")
            row = next(r for r in research_gate_overview_rows() if r["student"]["id"] == ana.id)
            self.assertEqual(row["state"], "ready")
            self.assertEqual(student_directory_brief(ana)["readiness_status"], "Ready")
            for other in research_gate_overview_rows():
                if other["state"] == "ready":
                    student = db.session.get(Student, other["student"]["id"])
                    self.assertEqual(student_directory_brief(student)["readiness_status"], "Ready", other["student"]["name"])

    def test_the_picker_asks_for_the_live_status_and_the_plain_list_stays_cheap(self):
        # the student picker sends readiness=live (I-387); the plain list keeps the stored status so its query
        # count does not grow with the page size (test_v53_backend2)
        staff = self.client_for("staff@usls.edu.ph", "staff")
        live = staff.get("/api/students", query_string={"q": "Ana Abad", "readiness": "live"}).get_json()["items"]
        self.assertEqual([row["readiness_status"] for row in live if row["name"] == "Ana Abad"], ["Ready"])

    # I-389
    def test_panel_load_is_one_count_on_both_screens(self):
        with app.app_context():
            ana = next(s for s in Student.query.all() if s.name == "Ana Abad")
            rows = {r["faculty"].id: r for r in panel_matching_result(ana)["rows"]}
            checked = 0
            for faculty_id, result_row in rows.items():
                faculty = db.session.get(Faculty, faculty_id)
                distinct = {a.student_id for a in PanelAssignment.query.filter_by(faculty_id=faculty_id).all()}
                self.assertEqual(faculty_dict(faculty)["panel_load"], len(distinct), faculty.name)
                self.assertEqual(result_row["workload"], len(distinct - {ana.id}), faculty.name)
                checked += 1
            self.assertGreater(checked, 5)

    def test_faculty_profile_lists_each_student_once_per_role(self):
        with app.app_context():
            seen_any_two_gates = False
            for faculty in Faculty.query.all():
                keys = [(a["student_name"], a["panel_role"]) for a in faculty_profile_dict(faculty)["current_assignments"]]
                self.assertEqual(len(keys), len(set(keys)), faculty.name)
                rows = PanelAssignment.query.filter_by(faculty_id=faculty.id).all()
                if len({(r.student_id, r.panel_role) for r in rows}) < len(rows):
                    seen_any_two_gates = True
            self.assertTrue(seen_any_two_gates, "the demo data has a student seated twice across gates")


if __name__ == "__main__":
    unittest.main()
