"""Owner's Aeb1/Bea2 scheduling examples; no Flask or database required."""
import unittest
from teaching_engine import generate_options, rank_schedules, validate_schedule


class TeachingEngineTests(unittest.TestCase):
    def availability(self, days):
        return [{"weekday": day, "start": "07:30", "end": "21:00", "kind": "available"} for day in days]

    def test_only_tuesday_friday_pair_for_professor_available_mon_tue_fri(self):
        options = generate_options(self.availability([0, 1, 4]), allow_single_day=False)
        self.assertTrue(options)
        self.assertEqual({tuple(m["weekday"] for m in o["meetings"]) for o in options}, {(1, 4)})
        self.assertTrue(all(m["end"] <= "21:00" for o in options for m in o["meetings"]))

    def test_monday_only_requires_explicit_single_day_fallback(self):
        self.assertEqual(generate_options(self.availability([0])), [])
        options = generate_options(self.availability([0]), allow_single_day=True)
        self.assertTrue(options)
        first = options[0]["meetings"]
        self.assertEqual(first, [{"weekday": 0, "start": "07:30", "end": "09:00"},
                                 {"weekday": 0, "start": "09:15", "end": "10:45"}])

    def test_missing_and_unavailable_are_never_silently_free(self):
        self.assertEqual(generate_options([]), [])
        windows = self.availability([1, 4]) + [{"weekday": 4, "start": "07:30", "end": "21:00", "kind": "unavailable"}]
        self.assertEqual(generate_options(windows), [])

    def test_shared_professor_and_confirmed_student_cannot_overlap(self):
        options = generate_options(self.availability([1, 4]))
        a = {"id": "Aeb1", "faculty_id": 1, "confirmed_student_ids": [1, 2], "forecast_student_ids": []}
        b = {"id": "Bea2", "faculty_id": 1, "confirmed_student_ids": [1, 3], "forecast_student_ids": []}
        sections = [a, b]
        errors, warnings = validate_schedule(sections, {"Aeb1": options[0], "Bea2": options[0]})
        self.assertTrue(any("faculty" in e.lower() for e in errors))
        self.assertTrue(any("student" in e.lower() for e in errors))
        results = rank_schedules(sections, {"Aeb1": options, "Bea2": options}, limit=3)
        self.assertTrue(results["schedules"])
        self.assertFalse(validate_schedule(sections, results["schedules"][0]["selections"])[0])

    def test_forecast_conflict_is_warning_not_hard_constraint(self):
        option = generate_options(self.availability([1, 4]))[0]
        sections = [{"id": "a", "faculty_id": 1, "confirmed_student_ids": [], "forecast_student_ids": [8]},
                    {"id": "b", "faculty_id": 2, "confirmed_student_ids": [], "forecast_student_ids": [8]}]
        errors, warnings = validate_schedule(sections, {"a": option, "b": option})
        self.assertEqual(errors, [])
        self.assertTrue(warnings)

    def test_whole_semester_search_does_not_greedily_block_constrained_class(self):
        options = generate_options(self.availability([1, 4]))[:2]
        sections = [{"id": "flexible", "faculty_id": 1}, {"id": "constrained", "faculty_id": 1}]
        results = rank_schedules(sections, {"flexible": options, "constrained": [options[0]]}, limit=3)
        self.assertTrue(results["schedules"])
        selected = results["schedules"][0]["selections"]
        self.assertEqual(selected["flexible"], options[1])
        self.assertEqual(selected["constrained"], options[0])

    def test_search_limit_is_distinct_from_proven_infeasibility(self):
        options = generate_options(self.availability([1, 4]))
        result = rank_schedules([{"id": "a", "faculty_id": 1}], {"a": options}, max_nodes=0)
        self.assertTrue(result["search_limited"])

    def test_locked_choice_is_preserved(self):
        options = generate_options(self.availability([1, 4]))
        result = rank_schedules([{"id": "a", "faculty_id": 1}], {"a": options}, pinned={"a": options[-1]})
        self.assertEqual(result["schedules"][0]["selections"]["a"], options[-1])
