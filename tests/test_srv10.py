"""pkt/srv10: I-407 Practicum report on Reports; I-409/I-410 class size (sources give no number, so no flag)."""
import unittest

from tests.test_srv8 import Srv8Tests, app, db  # noqa: F401  (module setup: temp DB)

EXPECTED = ["student", "program", "site", "status", "hours", "owner", "date"]


class Srv10Tests(Srv8Tests):
    def run(self, result=None):
        if not self._testMethodName.startswith("test_srv10"):
            return None
        return super().run(result)

    def get(self, query="", role="staff", email=None):
        client = self.client_for(email or self.role_email(role))
        return client.get("/api/reports/practicum" + query)

    def test_srv10_one_row_per_record_with_columns(self):
        from app import PracticumRecord, scoped_practicum_records_query
        response = self.get()
        self.assertEqual(200, response.status_code)
        data = response.get_json()
        self.assertEqual(EXPECTED, [c["key"] for c in data["columns"]])
        with app.app_context():
            self.assertEqual(scoped_practicum_records_query().count(), len(data["rows"]))
            self.assertGreater(len(data["rows"]), 0)
        row = data["rows"][0]
        for key in EXPECTED:
            self.assertIn(key, row)
        self.assertIn(" of ", row["hours"])

    def test_srv10_downloads(self):
        xlsx = self.get("?format=xlsx")
        self.assertEqual(200, xlsx.status_code)
        self.assertIn("spreadsheetml", xlsx.content_type)
        pdf = self.get("?format=pdf")
        self.assertEqual(200, pdf.status_code)
        self.assertEqual("application/pdf", pdf.content_type)
        self.assertTrue(pdf.data.startswith(b"%PDF"))

    def test_srv10_needs_dean_equals_dean_board(self):
        from app import workflow_approvals_payload
        with self.client_for(self.role_email("dean")).application.app_context():
            board = sum(1 for item in workflow_approvals_payload()["pending"] if item["type"] == "practicum")
        data = self.get("?needs_dean=Yes").get_json()
        self.assertEqual(board, len(data["rows"]))
        self.assertGreater(board, 0)
        self.assertTrue(all(r["status"] == "Report Sent to Dean" for r in data["rows"]))

    def test_srv10_other_roles(self):
        self.assertEqual(200, self.get(role="academic_coordinator").status_code)
        self.assertEqual(403, self.get(email="awol.maya@usls.edu.ph").status_code)

    def test_srv10_no_class_size_rule_invented(self):
        # The Handbook (p. 48) names a minimum but gives no number: no rule in the catalog, no flag on the class list.
        import json, pathlib
        text = pathlib.Path("Documents/Graduate_School/Operations_Manual/operations_manual_rules.json").read_text(encoding="utf-8")
        self.assertNotIn("class_size", text)
        self.assertNotIn("min_students", json.dumps(self.client_for(self.role_email("staff")).get("/api/business-rules").get_json() or {}))


if __name__ == "__main__":
    unittest.main()
