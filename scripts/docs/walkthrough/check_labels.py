"""List the **bold** labels in each case that do not appear on the matching screen.

    python scripts/docs/walkthrough/check_labels.py [slug ...]

capture_walkthrough.py saves the visible text of every screenshot next to the picture (shot_text/<id>.txt).
For every step this script takes its **bold** terms and looks for each in the text of the step's own
screenshots (or, for a step without a picture, in all of the case's screens). A term that is not found is
either a stale label or a name typed by the presenter; read the report, do not trust it blindly.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEXTS = HERE.parent.parent.parent / "archive" / "scripts-docs" / "walkthrough" / "shot_text"


def norm(s: str) -> str:
    return re.sub(r"[\s ]+", " ", s.replace("’", "'").replace("…", "...")).strip().lower()


def screen(shot_id: str) -> str:
    f = TEXTS / f"{shot_id}.txt"
    return norm(f.read_text(encoding="utf-8")) if f.exists() else ""


def main() -> int:
    only = set(sys.argv[1:])
    total = 0
    for path in sorted((HERE / "cases").glob("*.json")):
        case = json.loads(path.read_text(encoding="utf-8"))
        if only and case.get("slug") not in only and path.stem not in only:
            continue
        shot_ids = [s["id"] for part in case["parts"] for st in part["steps"] if isinstance(st, dict) for s in st.get("shots", [])]
        everything = " ".join(screen(i) for i in shot_ids)
        if not everything:
            print(f"-- {path.name}: no screen text (not captured yet)")
            continue
        step_no = 0
        lines = []
        for part in case["parts"]:
            for st in part["steps"]:
                step_no += 1
                st = {"text": st} if isinstance(st, str) else st
                ids = [s["id"] for s in st.get("shots", [])]
                hay = " ".join(screen(i) for i in ids) if ids else everything
                for term in re.findall(r"\*\*(.+?)\*\*", st["text"]):
                    t = norm(re.sub(r"^\d+\s*[·.]\s*", "", term))
                    if t and t not in hay:
                        in_case = t in everything
                        lines.append(f"   step {step_no}: {term!r}" + ("  (found on another screen of the case)" if in_case else "  NOT on any screen of the case"))
        print(f"-- {path.name}: {len(lines)} unmatched")
        total += len(lines)
        print("\n".join(lines))
    print(f"total unmatched: {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
