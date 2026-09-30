"""Integrity checks for the Graduate School Operations Manual content.

These tests read only the plain-Python content files in scripts/docs/opsmanual/
(no python-docx needed) and guard the properties the stakeholder and the rules
register depend on: unique rule ids, a valid status on every rule, a source on
every Official and Practice rule, consistent open-question references, and a
JSON export that matches the content.
"""

import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "docs"))

from opsmanual import front, questions  # noqa: E402
from opsmanual.common import OFFICIAL, PRACTICE, PROPOSED, STATUSES  # noqa: E402
from opsmanual.p_admission_to_drop import ADMISSION, DROPPING, ENROLLMENT, OFFERING, WITHDRAWAL  # noqa: E402
from opsmanual.p_end import GRADUATION, HANDOFF, PRACTICUM  # noqa: E402
from opsmanual.p_leave_to_compre import AWOL, COMPRE, LOA, READMISSION, RESIDENCY  # noqa: E402
from opsmanual.p_research import ADVISER, COMPLETION, FINAL, PROPOSAL, SCHEDULING, TITLE  # noqa: E402

PROCESSES = [
    ADMISSION, ENROLLMENT, OFFERING, WITHDRAWAL, DROPPING, LOA, READMISSION, AWOL, RESIDENCY,
    COMPRE, TITLE, ADVISER, PROPOSAL, FINAL, COMPLETION, SCHEDULING, PRACTICUM, GRADUATION, HANDOFF,
]
RULES = [r for p in PROCESSES for r in p.rules]
RULE_IDS = {r.rid for r in RULES}
QUESTION_IDS = {q["id"] for q in questions.QUESTIONS}


class OperationsManualContentTest(unittest.TestCase):
    def test_rule_ids_are_unique_and_prefixed_by_chapter(self):
        self.assertEqual(len(RULE_IDS), len(RULES), "duplicate rule id")
        for proc in PROCESSES:
            for rule in proc.rules:
                self.assertRegex(rule.rid, rf"^{proc.key}-\d{{2}}$", rule.rid)

    def test_every_rule_has_a_valid_status(self):
        for rule in RULES:
            self.assertIn(rule.status, STATUSES, rule.rid)

    def test_official_rules_cite_a_page_or_section(self):
        for rule in RULES:
            if rule.status == OFFICIAL:
                self.assertTrue(rule.sources, f"{rule.rid} is Official but has no source")
                for doc, loc in rule.sources:
                    self.assertTrue(loc, f"{rule.rid} Official source {doc!r} has no page or section")

    def test_handbook_citations_use_printed_page_numbers(self):
        # The handbook has 82 printed pages of policy text (pp. 1-97 in total).
        for rule in RULES:
            for doc, loc in rule.sources:
                if doc.startswith("Handbook"):
                    pages = [int(n) for n in re.findall(r"\d+", loc)]
                    self.assertTrue(pages, f"{rule.rid}: handbook citation without a page")
                    self.assertTrue(all(1 <= n <= 97 for n in pages), f"{rule.rid}: {loc}")

    def test_practice_rules_name_a_consultation_or_notes(self):
        for rule in RULES:
            if rule.status == PRACTICE:
                self.assertTrue(rule.sources, f"{rule.rid} Practice has no source")
                joined = " ".join(d for d, _ in rule.sources)
                self.assertRegex(joined, r"Consultation|Group working notes|Monitoring", rule.rid)

    def test_every_chapter_has_the_same_parts(self):
        for proc in PROCESSES:
            self.assertTrue(proc.purpose and proc.who and proc.trigger and proc.preconditions, proc.num)
            self.assertTrue(proc.steps and proc.rules and proc.exceptions and proc.records, proc.num)
            self.assertTrue(proc.platform and proc.platform_diff, proc.num)
            for step in proc.steps:
                self.assertEqual(len(step), 4, proc.num)

    def test_open_question_references_exist(self):
        text_sources = []
        for proc in PROCESSES:
            text_sources += [proc.purpose, proc.platform, proc.platform_diff, proc.callout or ""]
            text_sources += proc.exceptions + proc.preconditions
            text_sources += [s[3] for s in proc.steps] + [s[1] for s in proc.steps]
            text_sources += [r.text for r in proc.rules]
            for extra in proc.extras:
                for row in extra["rows"]:
                    text_sources += row
        for blob in text_sources:
            for ref in re.findall(r"OQ-\d{2}", blob):
                self.assertIn(ref, QUESTION_IDS, f"{ref} is referenced but not defined")

    def test_rule_references_in_text_exist(self):
        blobs = []
        for proc in PROCESSES:
            blobs += [proc.purpose, proc.platform, proc.platform_diff, proc.callout or ""]
            blobs += proc.exceptions + proc.preconditions + [proc.trigger]
            blobs += [s[1] + " " + s[3] for s in proc.steps]
            blobs += [r.text for r in proc.rules]
            for extra in proc.extras:
                for row in extra["rows"]:
                    blobs += row
        for q in questions.QUESTIONS:
            blobs += q["says"] + [q["question"]] + q["options"]
        prefixes = "|".join(sorted({p.key for p in PROCESSES}))
        for blob in blobs:
            for ref in re.findall(rf"(?:{prefixes})-\d{{2}}", blob):
                self.assertIn(ref, RULE_IDS, f"{ref} is referenced but not defined: {blob[:80]}")

    def test_rule_ids_are_consecutive_within_a_chapter(self):
        for proc in PROCESSES:
            numbers = [int(r.rid.split("-")[1]) for r in proc.rules]
            self.assertEqual(numbers, list(range(1, len(numbers) + 1)), proc.key)

    def test_question_affects_only_existing_rules(self):
        for q in questions.QUESTIONS:
            for rid in q["affects"]:
                self.assertIn(rid, RULE_IDS, f"{q['id']} affects unknown rule {rid}")
            self.assertTrue(q["says"] and q["question"] and q["options"], q["id"])

    def test_question_ids_are_sequential(self):
        expected = [f"OQ-{i:02d}" for i in range(1, len(questions.QUESTIONS) + 1)]
        self.assertEqual([q["id"] for q in questions.QUESTIONS], expected)

    def test_panel_question_is_answered_in_withdrawal_and_dropping(self):
        self.assertIn("Day 1", WITHDRAWAL.callout)
        self.assertIn("10%", WITHDRAWAL.callout)
        self.assertIn("20%", WITHDRAWAL.callout)
        self.assertIn("Day 1", DROPPING.callout)

    def test_cover_and_control_data(self):
        self.assertIn("not an official USLS document until approved", front.COVER_MARK)
        self.assertEqual(front.DOC_DATE, "2026-10-01")
        labels = [a for a, _ in front.CONTROL_ROWS]
        for needed in ("Version", "Date of this version", "Prepared by", "To be validated by"):
            self.assertIn(needed, labels)

    def test_no_mention_of_ai_in_manual_text(self):
        blob = json.dumps([r.text for r in RULES]) + json.dumps(front.CH1) + json.dumps(front.ROLES)
        self.assertNotRegex(blob, r"\b(AI|artificial intelligence|Gemini|RAG)\b")


class OperationsManualJsonTest(unittest.TestCase):
    def test_generated_json_matches_content_when_present(self):
        path = ROOT / "Documents" / "CAPSTONE_ONLY" / "operations_manual_rules.json"
        if not path.exists():
            self.skipTest("run scripts/docs/build_operations_manual.py first")
        data = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual({r["id"] for r in data["rules"]}, RULE_IDS)
        self.assertEqual(data["counts"][OFFICIAL] + data["counts"][PRACTICE] + data["counts"][PROPOSED], len(RULES))
        for item in data["rules"]:
            for key in ("id", "process", "rule", "source", "page", "status"):
                self.assertIn(key, item)


if __name__ == "__main__":
    unittest.main()
