"""Reports v2 period choices (I-141): term=all, term=previous and term=last-12-months beside a named term.

Same fixture as the summary tests (T-Prev 120..60 days ago, T-Now 59 days ago .. 60 ahead). Expected values come from
the rows built there: decisions took 2, 6 (leave), 10, 4 (withdrawal) days -- 2 and 6 and 10 in T-Now, 4 in T-Prev.
"""
import unittest

from tests.test_reports_summary import SummaryBase


class PeriodTests(SummaryBase):
    def tiles(self, **params):
        payload = self.get("/api/reports/summary", **params)
        return payload, {tile["key"]: tile for tile in payload["tiles"]}

    def test_all_time_counts_every_decision_and_has_no_earlier_period(self):
        payload, tiles = self.tiles(term="all")
        self.assertEqual(payload["term"]["label"], "All time")
        self.assertIsNone(payload["previous_term"])
        self.assertEqual((tiles["decide_days"]["count"], tiles["decide_days"]["value"]), (4, 5.0))
        self.assertEqual(tiles["decide_days"]["comparison"]["kind"], "none")
        self.assertEqual(tiles["graduation"]["detail"]["endorsed_this_term"], 3)
        self.assertEqual(tiles["defenses"]["value"], 2)  # the held defense of each term

    def test_previous_means_the_term_before_the_current_one(self):
        payload, tiles = self.tiles(term="previous")
        self.assertEqual(payload["term"]["label"], "T-Prev")
        self.assertIsNone(payload["previous_term"])
        self.assertEqual((tiles["decide_days"]["count"], tiles["decide_days"]["value"]), (1, 4.0))
        self.assertEqual(tiles["graduation"]["value"], 2)

    def test_last_12_months_is_compared_with_the_12_months_before(self):
        payload, tiles = self.tiles(term="last-12-months")
        self.assertEqual(payload["term"]["label"], "Last 12 months")
        self.assertEqual(payload["previous_term"]["label"], "the 12 months before")
        self.assertEqual(tiles["decide_days"]["count"], 4)
        self.assertEqual(tiles["graduation"]["comparison"]["previous"], 0)
        self.assertEqual(tiles["decide_days"]["comparison"]["kind"], "none")

    def test_the_label_the_page_echoes_can_be_sent_back(self):
        listing = self.get("/api/reports/summary/decide_days", term="Last 12 months")
        self.assertEqual(listing["count"], 4)
        self.assertEqual(self.get("/api/reports/summary/decide_days", term="All time")["count"], 4)

    def test_the_summary_lists_the_entry_cohorts_to_filter_by(self):
        self.assertEqual(self.get("/api/reports/summary", role="dean")["options"]["cohorts"], ["24-25", "25-26"])

    def test_decisions_and_cycle_times_take_the_same_choices(self):
        decisions = self.get("/api/reports/decisions", role="dean", term="all")
        self.assertEqual(decisions["term"]["label"], "All time")
        self.assertEqual(decisions["speed"]["overall"]["this_term"]["count"], 4)
        self.assertEqual(self.get("/api/reports/cycle-times", term="last-12-months")["count"], len(self.get("/api/reports/cycle-times", term="all")["rows"]))


if __name__ == "__main__":
    unittest.main()
