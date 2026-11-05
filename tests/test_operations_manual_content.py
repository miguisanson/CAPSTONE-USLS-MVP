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
from opsmanual.p_platform import ACCOUNTS, DATAEXCHANGE, EAPPROVAL, FACULTY, PRIVACY  # noqa: E402
from opsmanual.p_research import ADVISER, COMPLETION, FINAL, PROPOSAL, SCHEDULING, TITLE  # noqa: E402

PROCESSES = [
    ADMISSION, ENROLLMENT, OFFERING, WITHDRAWAL, DROPPING, LOA, READMISSION, AWOL, RESIDENCY,
    COMPRE, TITLE, ADVISER, PROPOSAL, FINAL, COMPLETION, SCHEDULING, PRACTICUM, GRADUATION, HANDOFF,
    FACULTY, ACCOUNTS, EAPPROVAL, PRIVACY, DATAEXCHANGE,
]
PLATFORM_CHAPTERS = [FACULTY, ACCOUNTS, EAPPROVAL, PRIVACY, DATAEXCHANGE]


def _codes(prefix, first, last):
    return [f"{prefix}-{n:02d}" for n in range(first, last + 1)]


# The codes .planning/forms-ops/CONTRACT.md assigns to each chapter (GS-F-27 is used in 4.13 and 4.14).
CHAPTER_FORMS = {
    "4.1": ["GS-F-01"], "4.2": ["GS-F-02", "GS-F-51", "GS-F-53"], "4.3": ["GS-F-03", "GS-F-04", "GS-F-52"],
    "4.4": ["GS-F-05"], "4.5": ["GS-F-06", "GS-F-49", "GS-F-50"], "4.6": ["GS-F-07"], "4.7": ["GS-F-08"],
    "4.8": ["GS-F-09"], "4.9": ["GS-F-10"], "4.10": ["GS-F-14", "GS-F-15"],
    "4.11": ["GS-F-16", "GS-F-17", "GS-F-18"], "4.12": _codes("GS-F", 19, 24),
    "4.13": ["GS-F-25", "GS-F-26", "GS-F-27", "GS-F-29", "GS-F-30", "GS-F-31"],
    "4.14": ["GS-F-27", "GS-F-32", "GS-F-33", "GS-F-34", "GS-F-35"], "4.15": _codes("GS-F", 36, 41),
    "4.16": ["GS-F-28"], "4.17": ["GS-F-11", "GS-F-12", "GS-F-13"], "4.18": ["GS-F-42", "GS-F-43", "GS-F-54"],
    "4.19": ["GS-F-44"], "4.20": ["GS-F-47", "GS-F-48"], "4.21": ["GS-P-05", "GS-F-46"],
    "4.22": ["GS-P-03"], "4.23": ["GS-P-04", "GS-F-45"], "4.24": ["GS-P-06"],
}
ALL_CODES = _codes("GS-F", 1, 54) + _codes("GS-P", 1, 6)
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


class FormsCrosswalkTest(unittest.TestCase):
    def test_new_platform_chapters_exist_with_contract_keys_and_titles(self):
        expected = [
            (FACULTY, "4.20", "FAC", "Faculty course preference and teaching load"),
            (ACCOUNTS, "4.21", "ACC", "Platform accounts and roles"),
            (EAPPROVAL, "4.22", "EAP", "Electronic approval and signatures"),
            (PRIVACY, "4.23", "PRV", "Data privacy and records retention"),
            (DATAEXCHANGE, "4.24", "DEX", "AIMS and Registrar data exchange"),
        ]
        for proc, num, key, title in expected:
            self.assertEqual((proc.num, proc.key, proc.title), (num, key, title))

    def test_new_platform_rules_are_proposed_and_cite_a_basis(self):
        for proc in PLATFORM_CHAPTERS:
            self.assertGreaterEqual(len(proc.rules), 5, proc.key)
            for rule in proc.rules:
                self.assertEqual(rule.status, PROPOSED, rule.rid)
                self.assertTrue(rule.sources, f"{rule.rid} names no basis")

    def test_privacy_and_approval_chapters_cite_the_statutes(self):
        self.assertIn("8792", json.dumps([r.sources for r in EAPPROVAL.rules]))
        self.assertIn("10173", json.dumps([r.sources for r in PRIVACY.rules]))

    def test_every_chapter_names_its_forms(self):
        self.assertEqual({p.num for p in PROCESSES}, set(CHAPTER_FORMS))
        for proc in PROCESSES:
            self.assertEqual(sorted(c for c, _t in proc.forms), sorted(CHAPTER_FORMS[proc.num]), proc.num)

    def test_appendix_a_lists_every_code_with_its_chapter(self):
        rows = {row[0]: row for row in front.FORMS}
        self.assertEqual(set(rows), set(ALL_CODES))
        self.assertEqual(front.FORMS_HEADER, ["Code", "Form", "Protocol / Handbook name", "Chapter", "Status"])
        for code, row in rows.items():
            self.assertTrue(row[1] and row[2] and row[3], code)
            self.assertIn(row[4], ("Official by name", "Proposed"), code)
        for num, codes in CHAPTER_FORMS.items():
            for code in codes:
                self.assertIn(num, rows[code][3], f"{code} should list chapter {num}")

    def test_supplementary_forms_have_rules_in_their_host_chapters(self):
        def has(proc, *words):
            return any(all(w in r.text.lower() for w in words) for r in proc.rules)
        self.assertTrue(has(ENROLLMENT, "cross-enrollment", "permit"))
        self.assertTrue(has(ENROLLMENT, "transfer", "master"))
        self.assertTrue(has(OFFERING, "special class", "vice chancellor"))
        self.assertTrue(has(DROPPING, "approved absence"))
        self.assertTrue(has(DROPPING, "incomplete grade removal form"))
        self.assertTrue(has(GRADUATION, "best", "96"))

    def test_oq27_carries_the_honoraria_practice_note(self):
        oq = next(q for q in questions.QUESTIONS if q["id"] == "OQ-27")
        text = " ".join(oq["says"]).lower()
        self.assertIn("2026-11-04", text)
        self.assertIn("honorari", text)
        self.assertIn("envelope", text)
        self.assertIn("no form", text)

    def test_new_text_never_mentions_the_banned_terms(self):
        blobs = []
        for proc in PLATFORM_CHAPTERS:
            blobs += [proc.purpose, proc.trigger, proc.platform, proc.platform_diff] + proc.who + proc.preconditions
            blobs += proc.exceptions + [r.text for r in proc.rules] + [x for s in proc.steps for x in s]
            blobs += [x for rec in proc.records for x in rec]
        blobs += [x for row in front.FORMS for x in row] + [json.dumps(questions.QUESTIONS)]
        for blob in blobs:
            self.assertNotRegex(blob, r"(AI|artificial intelligence|Gemini|RAG)")

    def test_changelog_has_the_forms_revision_entry(self):
        self.assertTrue(any(row[1] == "2026-11-04" for row in front.CHANGELOG))


class OperationsManualJsonTest(unittest.TestCase):
    def test_generated_json_matches_content_when_present(self):
        path = ROOT / "Documents" / "Graduate_School" / "Operations_Manual" / "operations_manual_rules.json"
        if not path.exists():
            self.skipTest("run scripts/docs/build_operations_manual.py first")
        data = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual({r["id"] for r in data["rules"]}, RULE_IDS)
        self.assertEqual(data["counts"][OFFICIAL] + data["counts"][PRACTICE] + data["counts"][PROPOSED], len(RULES))
        for item in data["rules"]:
            for key in ("id", "process", "rule", "source", "page", "status"):
                self.assertIn(key, item)



def _chapter_text(proc):
    parts = [proc.purpose, proc.platform, proc.platform_diff] + proc.exceptions
    parts += [x for st in proc.steps for x in (st[1], st[3])]
    for extra in proc.extras:
        parts += [extra["title"]] + [c for row in extra["rows"] for c in row]
    return " ".join(parts)


class FinalLoopManualTests(unittest.TestCase):
    """IM42-IM44 (2026-11-05): the manual matches the server and names the deferred features."""

    def test_known_gaps_list_names_every_deferred_and_planned_item(self):
        text = _chapter_text(DATAEXCHANGE)
        self.assertIn("Known gaps (not built in this version)", text)
        for ref in ("I-279", "I-293", "I-317", "I-319", "I-326", "I-346"):
            self.assertIn(ref, text)
        for ref in ("I-248", "I-252"):
            self.assertIn(ref, text)
        self.assertIn("planned", text.lower())
        # built on 2026-11-05 (pkt/im43): no longer gaps
        for ref in ("I-304", "I-335"):
            self.assertNotIn(ref, text)

    def test_the_advise_slip_and_the_exam_result_are_described_where_they_happen(self):
        self.assertIn("produces the Advise Slip", _chapter_text(READMISSION))
        self.assertIn("record the examination result", _chapter_text(COMPRE))

    def test_withdrawal_chapter_follows_the_new_rules(self):
        text = _chapter_text(WITHDRAWAL)
        self.assertIn("tags the subject Withdrawn automatically", text)
        self.assertIn("Sent to Registrar", text)
        self.assertIn("keeps its first submission date", text)
        self.assertIn("file a Leave of Absence", text)

    def test_readmission_and_awol_need_clearance_and_interview_before_the_dean(self):
        for proc in (READMISSION, AWOL):
            text = _chapter_text(proc)
            self.assertIn("Business Office clearance", text, proc.key)
            self.assertIn("interview", text, proc.key)

    def test_defense_lead_time_is_a_hard_rule(self):
        text = _chapter_text(SCHEDULING)
        self.assertIn("hard rule", text)
        self.assertNotIn("a warning that staff may override", text)

if __name__ == "__main__":
    unittest.main()
