"""The USLS forms pack is organised around the Operations Manual (contract FO1-FO8).

Every document is a data spec in scripts/docs/forms/build_forms.py. These tests read the specs only
(nothing is rendered), so they run in a second. python-docx is not a project dependency: the module is
skipped where it is not installed.
"""
import importlib.util
import re
import unittest
from pathlib import Path

try:
    import docx  # noqa: F401
    HAVE_DOCX = True
except ImportError:  # pragma: no cover
    HAVE_DOCX = False

ROOT = Path(__file__).resolve().parents[1]

# .planning/forms-ops/CONTRACT.md, "Folder layout": folder -> codes
CONTRACT_FOLDERS = {
    "0 Forms Control": ["GS-P-01", "GS-P-02"],
    "4.01 Admission Handoff and Onboarding": ["GS-F-01"],
    "4.02 Enrollment and Academic Load": ["GS-F-02"],
    "4.03 Course Offering and Course Adjustments": ["GS-F-03", "GS-F-04"],
    "4.04 Withdrawal of Subject": ["GS-F-05"],
    "4.05 Dropping": ["GS-F-06"],
    "4.06 Leave of Absence": ["GS-F-07"],
    "4.07 Return from Leave and Readmission": ["GS-F-08"],
    "4.08 Absence Without Leave": ["GS-F-09"],
    "4.09 Residency Enrollment": ["GS-F-10"],
    "4.10 Comprehensive Examination": ["GS-F-14", "GS-F-15"],
    "4.11 Title Defense": ["GS-F-16", "GS-F-17", "GS-F-18"],
    "4.12 Adviser Designation and Change of Title": [f"GS-F-{n}" for n in range(19, 25)],
    "4.13 Proposal Defense and Ethics Review": ["GS-F-25", "GS-F-26", "GS-F-27", "GS-F-29", "GS-F-30", "GS-F-31"],
    "4.14 Final Defense": ["GS-F-32", "GS-F-33", "GS-F-34", "GS-F-35"],
    "4.15 Revisions, Completion and Publication": [f"GS-F-{n}" for n in range(36, 42)],
    "4.16 Defense Scheduling": ["GS-F-28"],
    "4.17 Practicum": ["GS-F-11", "GS-F-12", "GS-F-13"],
    "4.18 Graduation": ["GS-F-42", "GS-F-43"],
    "4.19 Records Handoff to the Registrar": ["GS-F-44"],
    "Platform Basis": ["GS-P-03", "GS-P-04", "GS-P-05", "GS-P-06", "GS-F-45", "GS-F-46", "GS-F-47", "GS-F-48"],
    "Supplementary Forms": [f"GS-F-{n}" for n in range(49, 55)],
}
EXPECTED_FOLDER = {code: folder for folder, codes in CONTRACT_FOLDERS.items() for code in codes}

# Manual chapter of each document (CONTRACT "New documents" and "New manual chapters" tables).
EXPECTED_CHAPTER = {
    "GS-P-03": "4.22", "GS-P-04": "4.23", "GS-P-05": "4.21", "GS-P-06": "4.24",
    "GS-F-45": "4.23", "GS-F-46": "4.21", "GS-F-47": "4.20", "GS-F-48": "4.20",
    "GS-F-49": "4.5", "GS-F-50": "4.5", "GS-F-51": "4.2", "GS-F-52": "4.3", "GS-F-53": "4.2", "GS-F-54": "4.18",
}


def load_builder():
    spec = importlib.util.spec_from_file_location("build_forms", ROOT / "scripts" / "docs" / "forms" / "build_forms.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@unittest.skipUnless(HAVE_DOCX, "python-docx is not installed")
class FormsPackTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bf = load_builder()
        cls.docs = cls.bf.all_documents()
        cls.by_code = {d["code"]: d for d in cls.docs}

    def test_form_codes_01_to_54_present_once(self):
        codes = [f["code"] for f in self.bf.FORMS]
        self.assertEqual(sorted(codes), [f"GS-F-{n:02d}" for n in range(1, 55)])
        self.assertEqual(len(codes), len(set(codes)), "duplicate form code")

    def test_policy_documents_p01_to_p06_exist_once(self):
        codes = [d["code"] for d in self.docs if d["code"].startswith("GS-P-")]
        self.assertEqual(sorted(codes), [f"GS-P-{n:02d}" for n in range(1, 7)])

    def test_every_document_is_in_the_contract_folder(self):
        self.assertEqual(set(self.by_code), set(EXPECTED_FOLDER))
        for code, doc in self.by_code.items():
            self.assertEqual(doc["folder"], EXPECTED_FOLDER[code], code)

    def test_every_form_and_policy_has_a_manual_chapter(self):
        for code, doc in self.by_code.items():
            if code in ("GS-P-01", "GS-P-02"):
                continue
            self.assertRegex(doc["chapter"] or "", r"^4\.\d{1,2}$", code)
            if code in EXPECTED_CHAPTER:
                self.assertEqual(doc["chapter"], EXPECTED_CHAPTER[code], code)

    def test_chapter_folders_match_their_chapter(self):
        for code, doc in self.by_code.items():
            m = re.match(r"^4\.(\d\d) ", doc["folder"])
            if not m:
                continue
            home = "4." + str(int(m.group(1)))
            self.assertEqual(doc["chapter"], home, f"{code} sits in {doc['folder']}")

    def test_subtitle_names_the_manual_section_before_the_source(self):
        for code, doc in self.by_code.items():
            if code in ("GS-P-01", "GS-P-02"):
                continue
            line = self.bf.subtitle_text(doc)
            m = re.search(r"Operations Manual 4\.\d{1,2}", line)
            self.assertIsNotNone(m, f"{code}: {line!r}")
            for later in ("Handbook", "Protocol"):
                if later in line:
                    self.assertLess(m.start(), line.index(later), f"{code}: manual must come first")
        self.assertIn("Operations Manual 4.13 and 4.14", self.bf.subtitle_text(self.by_code["GS-F-27"]))

    def test_every_form_has_a_routes_row(self):
        for f in self.bf.FORMS:
            self.assertIn(f["code"].split("-")[-1], self.bf.ROUTES, f["code"])

    def test_forms_are_in_numeric_code_order(self):
        codes = [f["code"] for f in self.bf.FORMS]
        self.assertEqual(codes, sorted(codes))

    def test_no_fee_or_honorarium_form(self):
        for f in self.bf.FORMS:
            self.assertNotRegex(f["title"].lower(), r"honorarium|fee")

    def test_policy_documents_have_a_sign_block_and_numbered_sections(self):
        for code in ("GS-P-03", "GS-P-04", "GS-P-05", "GS-P-06"):
            doc = self.by_code[code]
            self.assertGreaterEqual(len(doc["sections"]), 4, code)
            self.assertEqual([role for role, _action in doc["sign"]], ["Prepared by", "Reviewed by", "Approved by"], code)
            self.assertEqual(doc["sign"][-1][1], "Graduate School Dean", code)


if __name__ == "__main__":
    unittest.main()
