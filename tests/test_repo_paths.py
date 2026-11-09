"""Every tracked path must be checkout-able on Windows.

v6.6 shipped 35 screenshots under 'frontend/E:/Temp/...' (a Mac run of an e2e spec
whose screenshot folder defaulted to a Windows path); Windows clones then failed with
"error: invalid path". This test fails before such a commit can spread.
"""
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BAD_CHARS = re.compile(r'[<>:"|?*\\]')
RESERVED = re.compile(r"^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$", re.I)


class TrackedPathsWorkOnWindows(unittest.TestCase):
    def test_no_tracked_path_is_invalid_on_windows(self):
        out = subprocess.run(["git", "-c", "core.quotepath=off", "ls-files", "-z"], cwd=ROOT,
                             capture_output=True, check=True).stdout.decode("utf-8")
        bad = []
        for path in filter(None, out.split("\0")):
            for part in path.split("/"):
                if BAD_CHARS.search(part) or RESERVED.match(part) or part.endswith((" ", ".")):
                    bad.append(path)
                    break
        self.assertEqual(bad, [], f"{len(bad)} tracked path(s) cannot be checked out on Windows")


if __name__ == "__main__":
    unittest.main()
