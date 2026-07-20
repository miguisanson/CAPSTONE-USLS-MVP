"""Migrate legacy demo IDs and reimport all corrected monitoring workbooks.

This maintenance command preserves Student primary keys and every related
workflow record. Only the known ``GS-2026-####`` demo identifier is migrated,
using the student's source entry year and four-digit sequence. Each workbook is
then passed through the same parser/importer as the web upload and recorded in
the upload-history table.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app import (
    MONITORING_UPLOAD_ROOT,
    MonitoringSheetUpload,
    Student,
    app,
    db,
    import_ac_monitoring,
    parse_ac_monitoring,
)


WORKBOOK_ROOT = PROJECT_ROOT / "Documents" / "Monitoring_Sheets"
LEGACY_ID = re.compile(r"GS-2026-(\d{4})", re.IGNORECASE)


def migrate_legacy_ids() -> int:
    changed = 0
    students = Student.query.order_by(Student.id).all()
    for student in students:
        match = LEGACY_ID.fullmatch(student.student_number or "")
        if not match:
            continue
        new_number = f"{int(student.entry_year) % 100:02d}6{match.group(1)}"
        collision = Student.query.filter(
            Student.student_number == new_number,
            Student.id != student.id,
        ).first()
        if collision:
            raise ValueError(
                f"Cannot migrate {student.student_number} to {new_number}: "
                f"already used by student row {collision.id}"
            )
        print(
            f"Student {student.id}: {student.student_number} -> {new_number} "
            f"({student.first_name} {student.last_name})"
        )
        student.student_number = new_number
        changed += 1
    db.session.commit()
    return changed


def record_import(path: Path) -> dict:
    file_bytes = path.read_bytes()
    with path.open("rb") as source:
        parsed = parse_ac_monitoring(source)
    result = import_ac_monitoring(parsed)

    MONITORING_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    stored_name = (
        f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-"
        f"{uuid4().hex[:10]}-{path.name}"
    )
    (MONITORING_UPLOAD_ROOT / stored_name).write_bytes(file_bytes)
    upload = MonitoringSheetUpload(
        original_name=path.name,
        stored_name=stored_name,
        program_code=parsed["program_code"],
        row_count=len(parsed["rows"]),
        subject_count=len(parsed["subjects"]),
        snapshot_json=json.dumps(parsed, ensure_ascii=False),
        result_json=json.dumps(result, ensure_ascii=False),
    )
    db.session.add(upload)
    db.session.commit()
    result["upload_id"] = upload.id
    return result


def main() -> None:
    paths = sorted(
        path
        for path in WORKBOOK_ROOT.rglob("*.xlsx")
        if not path.name.startswith("~$")
    )
    if not paths:
        raise SystemExit(f"No monitoring workbooks found under {WORKBOOK_ROOT}")

    with app.app_context():
        migrated = migrate_legacy_ids()
        total_rows = total_created = total_updated = total_conflicts = 0
        for path in paths:
            try:
                result = record_import(path)
            except Exception:
                db.session.rollback()
                raise
            total_rows += result["rows"]
            total_created += result["created"]
            total_updated += result["updated"]
            total_conflicts += result["conflict_count"]
            print(
                f"{path.name}: {result['rows']} row(s), {result['created']} new, "
                f"{result['updated']} AY/YR refreshed, "
                f"{result['conflict_count']} conflict(s)"
            )

        seven_digit_count = sum(
            1
            for student in Student.query.all()
            if re.fullmatch(r"\d{7}", student.student_number or "")
        )
        print(
            f"Completed: {migrated} legacy ID(s) migrated; {len(paths)} workbook(s), "
            f"{total_rows} row(s), {total_created} new student(s), "
            f"{total_updated} AY/YR refresh(es), {total_conflicts} conflict(s)."
        )
        print(
            f"Database now has {Student.query.count()} student(s); "
            f"{seven_digit_count} use seven-digit numeric IDs."
        )


if __name__ == "__main__":
    main()
