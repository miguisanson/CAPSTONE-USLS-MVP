"""Print a fingerprint of a demo database so two machines can check they hold the same data.

Usage (from the project root):

    .venv/Scripts/python.exe scripts/db_fingerprint.py                 # usls_gs_demo.sqlite3
    .venv/Scripts/python.exe scripts/db_fingerprint.py path/to/db.sqlite3 --tables

Two databases seeded on the same day from the same commit must print the same
fingerprint (owner decisions IM2/IM16). What is ignored, and why:

- the time of day inside timestamps (only the date counts), because "now" moves
  between two seeds even seconds apart;
- salted password hashes, because the same password hashes differently every time.

Everything else - every table, row and column - counts.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sqlite3
import sys
from pathlib import Path

DEFAULT_DB = Path(__file__).resolve().parent.parent / "usls_gs_demo.sqlite3"

# 2026-10-17 05:31:02.123456, 2026-10-17T05:31:02+00:00, 2026-10-17 05:31 ...
_TIME_OF_DAY = re.compile(
    r"(\d{4}-\d{2}-\d{2})[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?"
)
_PASSWORD_HASH = re.compile(r"^(?:scrypt|pbkdf2|argon2)[:$]")


def _normalise(value):
    if value is None:
        return None
    if isinstance(value, bytes):
        return "blob:" + hashlib.sha256(value).hexdigest()
    if isinstance(value, float):
        return round(value, 6)
    if isinstance(value, str):
        if _PASSWORD_HASH.match(value):
            return "<password-hash>"
        return _TIME_OF_DAY.sub(r"\1", value)
    return value


def table_fingerprints(db_path: str | Path) -> dict[str, str]:
    """Return {table name: sha256 of its normalised, sorted rows}."""
    connection = sqlite3.connect(f"file:{Path(db_path)}?mode=ro", uri=True)
    try:
        tables = [
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
            )
        ]
        result = {}
        for table in tables:
            columns = [row[1] for row in connection.execute(f'PRAGMA table_info("{table}")')]
            rows = sorted(
                repr(tuple(_normalise(value) for value in row))
                for row in connection.execute(f'SELECT * FROM "{table}"')
            )
            digest = hashlib.sha256()
            digest.update(repr(columns).encode())
            for row in rows:
                digest.update(row.encode())
                digest.update(b"\n")
            result[table] = f"{len(rows)}:{digest.hexdigest()}"
        return result
    finally:
        connection.close()


def database_fingerprint(db_path: str | Path) -> str:
    """One sha256 over every table's fingerprint."""
    digest = hashlib.sha256()
    for table, value in sorted(table_fingerprints(db_path).items()):
        digest.update(f"{table}={value}\n".encode())
    return digest.hexdigest()


def differing_tables(left: dict[str, str], right: dict[str, str]) -> list[str]:
    """Tables whose fingerprint differs, with row counts, for a readable failure message."""
    lines = []
    for table in sorted(set(left) | set(right)):
        if left.get(table) != right.get(table):
            left_count = (left.get(table) or "missing:").split(":")[0]
            right_count = (right.get(table) or "missing:").split(":")[0]
            lines.append(f"{table} ({left_count} rows vs {right_count} rows)")
    return lines


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("database", nargs="?", default=str(DEFAULT_DB))
    parser.add_argument("--tables", action="store_true", help="also print one line per table")
    args = parser.parse_args(argv)
    if not Path(args.database).exists():
        print(f"No database at {args.database}. Run `npm run seed` first.", file=sys.stderr)
        return 1
    if args.tables:
        for table, value in sorted(table_fingerprints(args.database).items()):
            print(f"{table:45} {value}")
    print(database_fingerprint(args.database))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
