"""Handbook and Protocol rules are locked; only prototype rules can be adjusted
(owner feedback, 2026-10-01)."""

import os
import re
import tempfile
import unittest
from pathlib import Path

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"

from app import (  # noqa: E402
    BusinessRule,
    BusinessRuleRevision,
    UserAccount,
    app,
    db,
    ensure_business_rules,
    generate_password_hash,
    rule_value,
)
from business_rules_catalog import BUSINESS_RULE_CATALOG, HANDBOOK, PROTOCOL, PROTOTYPE  # noqa: E402


class RuleLockTests(unittest.TestCase):
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
            account = UserAccount(
                email="lock-staff@example.test", full_name="Lock Staff",
                password_hash=generate_password_hash("test-password"), role="staff", active=True,
            )
            db.session.add(account)
            db.session.commit()
            self.staff_id = account.id
            ensure_business_rules()

    def _staff(self):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = self.staff_id
            session["role"] = "staff"
        return client

    def _rule_id(self, key):
        with app.app_context():
            return BusinessRule.query.filter_by(key=key).one().id

    def _items(self):
        return {item["key"]: item for item in self._staff().get("/api/business-rules").get_json()["items"]}

    def test_handbook_rule_is_locked_in_the_api_and_cannot_be_changed(self):
        items = self._items()
        rule = items["withdrawal.window_days"]
        self.assertTrue(rule["locked"])
        self.assertFalse(rule["editable"])
        self.assertIn("Graduate School Handbook 2022-2023", rule["lock_message"])
        self.assertIn("p. 49", rule["lock_message"])
        self.assertIn("Policy Documents", rule["lock_message"])
        response = self._staff().patch(
            f"/api/business-rules/{self._rule_id('withdrawal.window_days')}",
            json={"value": 30, "reason": "I would like a longer window"},
        )
        self.assertEqual(response.status_code, 403, response.get_json())
        self.assertTrue(response.get_json()["locked"])
        self.assertIn("set by the Graduate School Handbook 2022-2023, p. 49", response.get_json()["error"])
        with app.app_context():
            self.assertEqual(rule_value("withdrawal.window_days"), 14)
            self.assertEqual(BusinessRuleRevision.query.count(), 0)

    def test_research_protocol_rule_is_locked_too(self):
        protocol_keys = [e["key"] for e in BUSINESS_RULE_CATALOG if e["source_title"] == PROTOCOL]
        self.assertTrue(protocol_keys)
        items = self._items()
        for key in protocol_keys:
            self.assertTrue(items[key]["locked"], key)
        response = self._staff().patch(
            f"/api/business-rules/{self._rule_id(protocol_keys[0])}",
            json={"value": 99, "reason": "Trying to change a protocol rule"},
        )
        self.assertEqual(response.status_code, 403)
        self.assertIn("Research Protocol", response.get_json()["error"])

    def test_every_official_rule_is_locked_and_every_prototype_rule_is_editable(self):
        items = self._items()
        for entry in BUSINESS_RULE_CATALOG:
            item = items[entry["key"]]
            if entry["source_title"] in (HANDBOOK, PROTOCOL):
                self.assertTrue(item["locked"], entry["key"])
            else:
                self.assertEqual(entry["source_title"], PROTOTYPE)
                self.assertFalse(item["locked"], entry["key"])
                self.assertTrue(item["editable"], entry["key"])
                self.assertIn("Pending validation", item["edit_label"])

    def test_prototype_rule_can_still_be_adjusted_and_keeps_its_history(self):
        key = "faculty.teaching_load_limit_units"
        self.assertFalse(self._items()[key]["locked"])
        response = self._staff().patch(
            f"/api/business-rules/{self._rule_id(key)}",
            json={"value": 18, "reason": "Dean confirmed the load cap in a memo."},
        )
        self.assertEqual(response.status_code, 200, response.get_json())
        item = response.get_json()["item"]
        self.assertEqual(item["value"], 18)
        self.assertEqual(len(item["history"]), 1)
        self.assertEqual(self._items()[key]["history"][0]["new_value"], "18")

    def test_official_rule_flagged_by_a_new_policy_upload_can_be_reviewed(self):
        # A new policy document flags its rules "needs review"; only then can the
        # value be updated, so the register follows a new policy, not an opinion.
        key = "withdrawal.window_days"
        with app.app_context():
            rule = BusinessRule.query.filter_by(key=key).one()
            rule.status = "needs_review"
            db.session.commit()
        item = self._items()[key]
        self.assertFalse(item["locked"])
        self.assertIn("new policy", item["edit_label"].lower())
        response = self._staff().patch(
            f"/api/business-rules/{self._rule_id(key)}",
            json={"value": 10, "reason": "New handbook edition issued."},
        )
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertTrue(self._items()[key]["locked"])


FRONTEND = Path(__file__).resolve().parent.parent / "frontend" / "src"


def _src(relative):
    return (FRONTEND / relative).read_text(encoding="utf-8")


class NavigationStructureTests(unittest.TestCase):
    """The calendar, adviser designation and recommendations are not processes of their own."""

    def test_recommendations_page_is_gone_and_redirects_to_the_work_queue(self):
        self.assertFalse((FRONTEND / "pages" / "DecisionSupport.jsx").exists())
        app_jsx = _src("App.jsx")
        self.assertNotIn("DecisionSupport", app_jsx)
        self.assertRegex(app_jsx, r'path="/decision-support" element=\{<Navigate to="/work-queue')
        self.assertNotIn("Recommendations", _src("components/Layout.jsx"))
        work_queue = _src("pages/WorkQueue.jsx")
        self.assertIn("Suggested next step", work_queue)
        self.assertIn("api.decisionSupport()", work_queue)  # the endpoint stays: the Work Queue uses it

    def test_staff_and_coordinator_sidebar_has_no_calendar_or_adviser_item(self):
        layout = _src("components/Layout.jsx")
        self.assertNotIn('label: "Defense Calendar"', layout)
        self.assertNotIn('label: "Adviser Appointments"', layout)
        self.assertNotIn('"/calendar"', layout)
        self.assertNotIn('"/adviser-appointments"', layout)

    def test_dean_sidebar_has_no_calendar_or_adviser_item_and_queue_holds_adviser_decisions(self):
        nav = _src("components/portalNav.jsx")
        self.assertNotIn("/dean/calendar", nav)
        self.assertNotIn("/dean/adviser-appointments", nav)
        self.assertIn("/dean/approvals", nav)
        queue = _src("pages/dean/DeanPages.jsx")
        self.assertIn("Adviser Designation", queue)
        self.assertIn("<AdviserAppointments", queue)

    def test_old_urls_redirect_to_the_new_places(self):
        app_jsx = _src("App.jsx")
        self.assertIn('path="/calendar" element={<Navigate to="/workflow/defense-scheduling?view=calendar"', app_jsx)
        self.assertIn('path="/adviser-appointments" element={<Navigate to="/workflow/research-gate?view=adviser"', app_jsx)
        dean_routes = _src("pages/dean/DeanRoutes.jsx")
        self.assertRegex(dean_routes, r'path="calendar" element=\{<Navigate to="/dean/approvals"')
        self.assertRegex(dean_routes, r'path="adviser-appointments" element=\{<Navigate to="/dean/approvals"')

    def test_calendar_and_adviser_designation_are_tabs_inside_the_research_flow(self):
        workflow = _src("pages/WorkflowPage.jsx")
        self.assertIn('"research-gate": [', workflow)
        self.assertIn("Adviser designation", workflow)
        self.assertIn('"defense-scheduling": [', workflow)
        self.assertRegex(workflow, r'key: "calendar", label: "Calendar"')
        self.assertIn("<CalendarPage", workflow)
        self.assertIn("<AdviserAppointments", workflow)

    def test_student_and_faculty_portals_keep_the_pages_under_the_research_group(self):
        nav = _src("components/portalNav.jsx")
        student = nav.split("export const STUDENT_NAV_GROUPS")[1].split("export const DEAN_NAV_GROUPS")[0]
        research = student.split('label: "Research",')[1].split("\n  }")[0]
        for path in ("/student/adviser", "/student/defense-schedule", "/student/calendar"):
            self.assertIn(path, research)
        faculty = nav.split("export const FACULTY_NAV_GROUPS")[1].split("export const PORTAL_NAV")[0]
        advising = faculty.split('label: "Advising & Research",')[1].split("\n  }")[0]
        self.assertIn("/faculty-portal/calendar", advising)


if __name__ == "__main__":
    unittest.main()
