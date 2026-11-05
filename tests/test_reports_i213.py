"""I-213 (Fable F-07/F-08/F-09): report tile texts say true things, and each tile's headline equals its list.

Fixture is the one in test_reports_summary (T-Prev 120..60 days ago, T-Now 59 ago..60 ahead) plus T-Old
before T-Prev and T-Next after T-Now. T-Now: 1 defense held (a2), 1 upcoming (a1), 1 awaiting a verdict (a6);
1 endorsement sent this term (a6); a decision made this term (median 6.0) and one in T-Prev (4.0).
"""
import unittest
from datetime import timedelta

from tests import reports_support  # noqa: F401  (sets the environment before app is imported)
from tests.reports_support import TODAY, db
from tests.test_reports_summary import SummaryBase

from app import AcademicTerm  # noqa: E402


class SummaryTextTests(SummaryBase):
    @classmethod
    def build(cls):
        super().build()
        db.session.add_all([
            AcademicTerm(label="T-Old", start_date=TODAY - timedelta(days=180), end_date=TODAY - timedelta(days=121)),
            AcademicTerm(label="T-Next", start_date=TODAY + timedelta(days=61), end_date=TODAY + timedelta(days=120)),
        ])

    def tile(self, key, term="T-Now"):
        payload = self.get("/api/reports/summary", term=term)
        return {t["key"]: t for t in payload["tiles"]}[key]

    def drill(self, key, term="T-Now"):
        return self.get(f"/api/reports/summary/{key}", term=term)

    def test_median_text_names_the_current_period_when_it_is_the_empty_side(self):
        tile = self.tile("decide_days", "T-Next")
        self.assertIsNone(tile["value"])
        self.assertEqual(tile["comparison"]["text"], "no decisions in T-Next")

    def test_median_text_names_the_previous_period_only_when_it_is_the_empty_side(self):
        tile = self.tile("decide_days", "T-Prev")
        self.assertEqual(tile["value"], 4.0)
        self.assertEqual(tile["comparison"]["text"], "no decisions in T-Old")

    def test_median_text_unchanged_when_both_sides_have_decisions(self):
        tile = self.tile("decide_days")
        self.assertEqual(tile["comparison"]["text"], "4.0 days in T-Prev")

    def test_defenses_headline_equals_its_list(self):
        tile = self.tile("defenses")
        self.assertEqual(tile["value"], 1)
        self.assertEqual(self.drill("defenses")["count"], 1)
        self.assertEqual(self.drill("defenses_upcoming")["count"], tile["detail"]["next_30_days"])
        self.assertEqual(self.drill("defenses_awaiting")["count"], tile["detail"]["awaiting_verdict"])
        self.assertEqual(tile["detail"], {"held": 1, "next_30_days": 1, "awaiting_verdict": 1})

    def test_graduation_tile_is_named_for_what_it_counts_and_lists_the_same_set(self):
        tile = self.tile("graduation")
        self.assertEqual(tile["label"], "Endorsements sent to the Dean")
        self.assertEqual(tile["value"], 1)
        listing = self.drill("graduation")
        self.assertEqual(listing["count"], 1)
        self.assertTrue(all(r["detail"].startswith("Endorsement") for r in listing["rows"]))
        self.assertEqual(self.drill("graduation_ready")["count"], tile["detail"]["eligible_now"])

    def test_unknown_drill_key_is_still_404(self):
        response = self.client().get("/api/reports/summary/nonsense", query_string={"term": "T-Now"})
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
