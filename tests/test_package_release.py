import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from package_release import classify  # noqa: E402


class ClassifyTests(unittest.TestCase):
    def test_paths(self):
        cases = {
            ".claude/x": "ai",
            ".planning/STATE.md": "ai",
            "archive/codex/a.md": "ai",
            "AGENTS.md": "ai",
            "CLAUDE.md": "ai",
            ".rag_index/x": "app",
            "policy_rag.py": "app",
            "app.py": "app",
            "archive/README.md": "skip",
            "archive/scripts-docs/a.md": "skip",
            "tests/__pycache__/x.cpython-311.pyc": "skip",
            "app.pyc": "skip",
            "__pycache__/a": "skip",
            "frontend/.env": "skip",
            ".env.example": "app",
            "test-results/x": "skip",
            "frontend/e2e-artifacts/a.png": "skip",
            "outputs/a": "skip",
            "demo_sandboxes/a.sqlite3": "skip",
            "Documents/Old/thing.zip": "skip",
        }
        for path, want in cases.items():
            self.assertEqual(classify(path), want, path)


if __name__ == "__main__":
    unittest.main()
