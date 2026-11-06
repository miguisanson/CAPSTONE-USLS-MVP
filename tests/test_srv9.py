"""pkt/srv9: I-432 shorter, plain student assistant answer without office words or the offline note."""
import unittest

from tests.test_srv8 import MAYA, ELENA, QUESTION, Srv8Tests, app, db  # noqa: F401  (module setup: temp DB)

SHORT = "If you stop attending without a leave of absence, the Graduate School may mark you absent without leave."


class Srv9Tests(Srv8Tests):
    # reuse the setup helpers only; do not re-run srv8's own tests
    def run(self, result=None):
        if not self._testMethodName.startswith("test_srv9"):
            return None
        return super().run(result)

    def test_srv9_student_answer_is_short_and_plain(self):
        for email in (MAYA, ELENA):
            data = self.ask(email)
            text = data["answer"]
            for bad in ("AWOL evidence", "the platform treats", "without AI", "may be treated as absent"):
                self.assertNotIn(bad, text, email)
            self.assertTrue(text.startswith(SHORT), text)
            self.assertIn("Sources:", text)
            self.assertIn("What you can do: Open Return from AWOL", text)
            passages = [p for p in text.split("\n\n") if not p.startswith(("What you can do", "Some of this", "Sources"))]
            self.assertLessEqual(len(passages) - 1, 2, text)  # opening sentence + at most 2 passages
            self.assertIsNone(data["source"]["note"], email)
            self.assertNotIn("without AI", str(data["source"]))

    def test_srv9_staff_answer_unchanged(self):
        data = self.ask("dean@usls.edu.ph")
        self.assertIn("pending Graduate School validation", data["answer"] + str(data["citations"]))
        self.assertEqual("Offline answer", data["source"]["badge"])
        self.assertNotIn("What you can do", data["answer"])

    def test_srv9_function_dedupes_and_rewrites(self):
        from app import _student_plain_policy
        text = ("A student may be treated as absent without leave. It counts as AWOL evidence.\nSource: Graduate School Handbook (p. 53)\n\n"
                "A student may be treated as absent without leave; this counts as AWOL evidence too.\nSource: Graduate School Handbook (p. 54)\n\n"
                "Registration privileges are withdrawn.\nSource: Graduate School Handbook (p. 55)\n\n"
                "Staff confirm the record.\nSource: Graduate School Handbook (p. 56)")
        out, _ = _student_plain_policy(text, [], "What happens if I stop coming to class?")
        self.assertEqual(1, out.count("marked absent without leave"), out)
        self.assertNotIn("AWOL evidence", out)
        self.assertNotIn("Staff confirm", out)  # capped at 2 passages


if __name__ == "__main__":
    unittest.main()
