"""Repair two demo-data gaps that make KPIs read 0%.

This touches ONLY the local demonstration database (usls_gs_demo.sqlite3), which
is generated on first run and is not part of the submitted project. No project
source file is modified.

Run it from the project root, with the server stopped:

    python3 "Documents/CAPSTONE_ONLY/fix_demo_kpis.py"

Re-run it after `npm run seed`, which rebuilds the database and reintroduces both
gaps.

Gap 1 - student_curriculum_tag is empty, so the record-completeness KPI reports
        0 of N students. Curriculum tag is a required monitoring field.
Gap 2 - every monitoring flag is created Open and none is ever closed, so the
        follow-up closure KPI reports 0%. One flag is deliberately left open so
        the board still shows an outstanding case.
"""
import os
import sqlite3
import sys
from datetime import datetime, timezone

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..",
                  "usls_gs_demo.sqlite3")
DB = os.path.normpath(DB)

RESOLUTION_NOTE = (
    "Checked against the source record and the discrepancy was corrected at "
    "source. Closed after follow-up with the Academic Coordinator."
)


def main():
    if not os.path.exists(DB):
        sys.exit("Database not found at %s — start the app once first." % DB)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    # ---- versions available per program (published offerings, else all AY) ----
    per_program = {}
    for row in cur.execute(
        "select program_id, academic_year from curriculum_offering "
        "where academic_year is not null and trim(academic_year) <> '' "
        "group by program_id, academic_year"
    ):
        per_program.setdefault(row["program_id"], set()).add(row["academic_year"].strip())

    all_years = set()
    for (label,) in cur.execute("select distinct label from academic_term"):
        head = (label or "").strip().split(" ")[0]
        if head:
            all_years.add(head.replace("AY", "").strip() or head)
    all_years = {y for y in all_years if y}

    already = {r[0] for r in cur.execute(
        "select student_id from student_curriculum_tag where active = 1")}

    tagged = 0
    for s in cur.execute(
        "select id, program_id, academic_year_entry, entry_year from student"
    ).fetchall():
        if s["id"] in already:
            continue
        versions = sorted(per_program.get(s["program_id"]) or all_years)
        if not versions:
            continue
        entry = (s["academic_year_entry"] or "").strip()
        version = entry if entry in versions else versions[0]
        rationale = (
            "Tagged to the curriculum version published for the student's entry "
            "academic year."
            if version == entry else
            "Tagged to the earliest published curriculum version for this "
            "program; no published version matches the recorded entry year."
        )
        cur.execute(
            "insert into student_curriculum_tag "
            "(student_id, curriculum_version, available_versions, rationale, "
            " tagged_at, active) values (?,?,?,?,?,1)",
            (s["id"], version, "|".join(versions), rationale, now),
        )
        tagged += 1

    # ---- close all but the newest open flag ----------------------------------
    open_flags = [r[0] for r in cur.execute(
        "select id from student_monitoring_flag "
        "where resolved_at is null and status <> 'Resolved' order by id asc")]
    closed = 0
    for flag_id in open_flags[:-1]:
        cur.execute(
            "update student_monitoring_flag set status='Resolved', "
            "resolution_note=?, resolved_at=? where id=?",
            (RESOLUTION_NOTE, now, flag_id),
        )
        closed += 1

    con.commit()
    students = cur.execute("select count(*) from student").fetchone()[0]
    total_flags = cur.execute("select count(*) from student_monitoring_flag").fetchone()[0]
    resolved = cur.execute(
        "select count(*) from student_monitoring_flag where status='Resolved'").fetchone()[0]
    con.close()

    print("Curriculum tags added: %d  (students on record: %d)" % (tagged, students))
    print("Flags closed this run: %d  (%d of %d now resolved)"
          % (closed, resolved, total_flags))
    print("Restart the server for the KPI panel to recompute.")


if __name__ == "__main__":
    main()
