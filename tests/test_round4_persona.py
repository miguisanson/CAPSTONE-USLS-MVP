"""Round 4 persona fixes (I-394): the Students list and the dashboard count active students the same way."""

import unittest

import tests.test_audit4 as base
from app import Student, app, db


class ActiveStudentsOneDefinitionTests(base.Audit4Base):
    def test_standing_active_filter_matches_the_dashboard_active_count(self):
        with app.app_context():
            # Standing says Active, but the student has already finished: the dashboard never counted this one.
            done = db.session.get(Student, self.other_id)
            done.current_stage = "Completed"
            db.session.commit()
        client = self.client("admin")
        dashboard = client.get("/api/dashboard").get_json()
        listed = client.get("/api/students?standing=Active").get_json()
        self.assertEqual(dashboard["kpis"]["active_students"], 1)
        self.assertEqual(listed["total"], dashboard["kpis"]["active_students"])


if __name__ == "__main__":
    unittest.main()
