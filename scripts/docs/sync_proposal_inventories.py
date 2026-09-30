#!/usr/bin/env python
"""Make the generated parts of the proposal tell the truth about the code (idempotent).

Two stages, because reading the code needs Flask and editing the .docx needs lxml (they live in
different virtual environments on this machine):

  1. COLLECT  (project venv, Flask importable; never touches a real database)

       python scripts/docs/sync_proposal_inventories.py collect [--run-suite | --run-log LOG]

     Reads `app.url_map` (routes), `db.metadata` and the models (tables, columns), and the test
     files (`tests/test_*.py`).  With --run-suite it also RUNS the whole test suite
     (`python -m unittest discover -s tests -p "test_*.py" -v`, about 15 minutes) and records date,
     count, passed, failed, duration; --run-log parses a log of such a run instead (--started /
     --ended give the wall-clock times if the log is older).  Writes
     `scripts/docs/proposal_inventory.json` (committed, so stage 2 is repeatable without Flask).

  2. APPLY  (lxml venv)

       python scripts/docs/sync_proposal_inventories.py apply IN.docx OUT.docx

     Replaces, from the JSON:
       * Appendix V  Automated Test Case Matrix          (every test, grouped by module, with its result)
       * Appendix W  Automated Test Execution Record     (the recorded run)
       * Appendix Y  As-Built API Endpoint Inventory     (every route: method, path, roles, purpose)
       * Appendix Z  As-Built Database Table Inventory   (every table: purpose, key columns)
       * Section 5.9.2 field tables (name, description, type) of the principal tables
       * Tables 28 to 30 and Sections 6.3.2, 6.3.3 and 6.3.4 of Chapter 6 (module table, run summary,
         defects, per-module results) from the recorded run
     then applies `proposal_text_sync.json` (find -> replace with a note; `{{tokens}}` are filled from
     the inventory, so every count in the prose is the generated one).

Idempotent: the appendices and tables are keyed on their headings / captions and their content is
replaced, never appended; the text entries are skipped when already applied.  Run it BEFORE
`build_proposal.py` (see PROPOSAL_EDIT_NOTES.md, "Regenerating everything").
"""
from __future__ import annotations

import argparse
import ast
import copy
import datetime as dt
import json
import os
import platform
import re
import subprocess
import sys
import tempfile
import zipfile
from collections import OrderedDict
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
INVENTORY = HERE / "proposal_inventory.json"
ENDPOINT_PURPOSES = HERE / "proposal_endpoint_purposes.json"
TABLE_PURPOSES = HERE / "proposal_table_purposes.json"
FIELD_DESCRIPTIONS = HERE / "proposal_field_descriptions.json"
MODULE_PROSE = HERE / "proposal_test_module_prose.json"
TEXT_SYNC = HERE / "proposal_text_sync.json"

# --------------------------------------------------------------------------- route / table / test grouping
ROUTE_MODULES = [  # (regex on path, module) first match wins
    (r"^/$|^/<path:path>$|^/api/(auth|health|meta)", "Application, sign-in and session"),
    (r"^/api/(dashboard|reports|decision-support|activity|tasks)", "Dashboard, reports, work queue and activity log"),
    (r"^/api/(adviser-appointments|availability-requests|panel-invitations|calendar|notifications)|"
     r"^/api/student-portal/(adviser|research-calendar)|"
     r"^/api/faculty-portal/(adviser-requests|availability|panel-invitations|defense-schedules)",
     "Adviser appointment, calendars and notifications"),
    (r"^/api/(monitoring|students)", "Students and monitoring sheet"),
    (r"^/api/(onboarding|transactions)", "Student handoff and workflow transactions"),
    (r"^/api/(admin/terms|terms)", "Academic semesters"),
    (r"^/api/(course-offerings|course-adjustments|curriculum-planning|course-audit|coursework)",
     "Course offering, course adjustments and coursework"),
    (r"^/api/enrollment", "Enrollment"),
    (r"^/api/(research|defense-schedules)", "Research gate and defense scheduling"),
    (r"^/api/(faculty|faculty-portal|faculty-expertise)", "Faculty and faculty portal"),
    (r"^/api/graduation", "Graduation"),
    (r"^/api/(leave|awol|readmission|residency|standing-changes)", "Leave of absence, readmission, AWOL and residency"),
    (r"^/api/withdrawal", "Subject withdrawal"),
    (r"^/api/(student-portal|student-request-attachments)", "Student portal"),
    (r"^/api/approvals", "Dean approvals"),
    (r"^/api/(assistant|policy-documents|business-rules)", "Policy assistant, policy documents and business rules"),
]

TABLE_GROUPS = OrderedDict([
    ("Students, programs, curriculum and enrollment", [
        "program", "student", "course", "curriculum_offering", "course_offering_plan", "course_offering",
        "course_record", "student_curriculum_tag", "study_plan_draft", "academic_term", "term_enrollment",
        "subject_enrollment"]),
    ("Accounts", ["user_account"]),
    ("Monitoring sheet import and editing", [
        "monitoring_sheet_upload", "monitoring_validation_issue", "monitoring_edit", "student_monitoring_flag",
        "onboarding_review", "coursework_report"]),
    ("Research, panel and defense", [
        "research_case", "document_check", "research_evidence_file", "adviser_document_approval",
        "adviser_assignment", "adviser_appointment", "panel_assignment", "panel_invitation", "schedule_request",
        "defense_verdict", "form1_endorsement"]),
    ("Faculty", ["faculty", "faculty_expertise", "faculty_course_preference", "faculty_availability",
                 "faculty_working_hour", "faculty_availability_exception", "availability_request"]),
    ("Practicum, graduation and standing changes", [
        "practicum_record", "graduation_endorsement", "leave_case", "leave_case_event", "leave_export_log",
        "awol_case", "residency_enrollment", "withdrawal_application"]),
    ("Work, messages and audit", ["task", "workflow_message", "student_request_attachment", "transaction_log",
                                  "notification", "calendar_token"]),
    ("Business rules and policy documents", ["business_rule", "business_rule_revision", "policy_document",
                                              "policy_document_version"]),
])

TEST_MODULES = [  # ordered; used for Appendix V, Table 28 and Section 6.3.4
    "Sign-in, access control, API errors and startup",
    "Monitoring sheet, import and data integrity",
    "Enrollment, course offering and course adjustments",
    "Research gate, panel matching and defense scheduling",
    "Practicum",
    "Graduation",
    "Leave of absence and readmission",
    "AWOL and residency",
    "Subject withdrawal and dropping",
    "Policy assistant and policy documents",
    "Business rules register",
    "Operations manual content",
    "Portals, dashboard, reports and work queue",
    "Workflow tasks, messages, audit and data upgrades",
    "Adviser appointment, calendars and notifications",
]
TEST_FILE_DEFAULT = {
    "test_health": TEST_MODULES[0],
    "test_monitoring_crud": TEST_MODULES[1],
    "test_panel_matching": TEST_MODULES[3],
    "test_loa_readmission": TEST_MODULES[6],
    "test_policy_documents": TEST_MODULES[9],
    "test_business_rules": TEST_MODULES[10],
    "test_operations_manual_content": TEST_MODULES[11],
    "test_portals": TEST_MODULES[12],
    "test_calendar_appointments": TEST_MODULES[14],
    "test_academic_fixes": TEST_MODULES[2],
    "test_research_core": TEST_MODULES[3],
    "test_bpm_workflows": TEST_MODULES[13],
    "test_crosscut": TEST_MODULES[13],
}
TEST_NAME_RULES = [  # (regex on the lower-case test name, module); first match wins, for files without a fixed module
    (r"kpi|analytics|standing_filters|at_risk|delay_risk|stage_chart|work_queue|decision_support|queue|attrition|"
     r"residency_watch|overdue_task|report_counts", TEST_MODULES[12]),
    (r"assistant|policy_|handbook|document_rag|rag_|suggested_questions", TEST_MODULES[9]),
    (r"maed_monitoring_sheet", TEST_MODULES[1]),
    (r"awol|residency", TEST_MODULES[7]),
    (r"withdraw|dropp|drop_", TEST_MODULES[8]),
    (r"practicum", TEST_MODULES[4]),
    (r"graduation", TEST_MODULES[5]),
    (r"loa|_loa_|(^|_)leave(_|$)|readmission", TEST_MODULES[6]),
    (r"verdict|defense|panel|schedule|form_1|form_5|ethics|title|manuscript|proposal|redefense|adviser|google|"
     r"calendar|faculty_cv|faculty_pref|availability|lead_time|booking|cancel_|reschedul|reconfirm|override|slot|"
     r"research_coordinator_can", TEST_MODULES[3]),
    (r"class_list|offering|overlap_protection|add_next_semester|enrollment|course_adjust|subject_needs|demand|study_plan|"
     r"curriculum|publish|plan_|dean_approval|dean_must|draft_action|reopen|semester|reenroll|overload|same_subject|"
     r"guard_names|student_self|recommended_year|authoritative|legacy_offering|academic_coordinator_approves|"
     r"return_needs|review_is_blocked|onboarding|coursework_report|course_audit|years_in_program", TEST_MODULES[2]),
    (r"monitoring|import|flag|merge|new_student|credentials|manual_student", TEST_MODULES[1]),
    (r"workflow_submit", TEST_MODULES[13]),
    (r"login|password|access|role_label|secret|throttle|session|demo|account|malformed|unknown_routes|"
     r"profile_and_login|taken_email|faculty_login", TEST_MODULES[0]),
]
ACRONYMS = {
    "loa": "leave of absence", "awol": "AWOL", "dean": "Dean", "rc": "Research Coordinator", "csv": "CSV",
    "pdf": "PDF", "docx": "DOCX", "rag": "retrieval", "maed": "MAEd", "msgc": "MSGC", "usls": "USLS",
    "oauth": "OAuth", "api": "API", "kpi": "KPI", "kpis": "KPIs", "inc": "INC", "freebusy": "free/busy",
    "ui": "UI", "json": "JSON", "id": "ID", "url": "URL", "aims": "AIMS", "moa": "MOA", "ay": "AY",
    "sqlite": "SQLite", "mysql": "MySQL", "gemini": "Gemini", "ics": "ICS", "xlsx": "Excel", "gs": "GS",
    "registrar": "Registrar", "coordinator": "Coordinator", "academic": "Academic", "research": "Research",
    "faculty": "faculty", "google": "Google",
}


def sentence_from_test_name(name: str) -> str:
    words = re.sub(r"^test_?", "", name).split("_")
    out = []
    for w in words:
        if not w:
            continue
        out.append(ACRONYMS.get(w.lower(), w))
    text = " ".join(out)
    text = text.replace("academic Coordinator", "Academic Coordinator").replace("Research Coordinator", "Research Coordinator")
    text = re.sub(r"\bAcademic Coordinator\b", "Academic Coordinator", text)
    text = text[0].upper() + text[1:] if text else name
    return text.rstrip(".") + "."


def classify_test(module: str, name: str) -> str:
    if module in ("test_health", "test_monitoring_crud", "test_panel_matching", "test_loa_readmission",
                  "test_policy_documents", "test_business_rules", "test_operations_manual_content", "test_portals",
                  "test_calendar_appointments"):
        return TEST_FILE_DEFAULT[module]
    low = name.lower()
    for pattern, mod in TEST_NAME_RULES:
        if re.search(pattern, low):
            return mod
    return TEST_FILE_DEFAULT.get(module, TEST_MODULES[13])


# =========================================================================== stage 1: COLLECT
def humanise_endpoint(endpoint: str) -> str:
    return endpoint.replace("_", " ").capitalize() + "."


def collect_routes():
    from app import API_ROLE_REGISTRY, ROLE_LABELS, app  # noqa: E402
    import inspect

    purposes = json.loads(ENDPOINT_PURPOSES.read_text(encoding="utf-8"))
    role_order = list(ROLE_LABELS)
    routes, missing = [], []
    for rule in app.url_map.iter_rules():
        if rule.endpoint == "static":
            continue
        fn = app.view_functions[rule.endpoint]
        methods = sorted(m for m in rule.methods if m not in ("HEAD", "OPTIONS"))
        if rule.endpoint in API_ROLE_REGISTRY:
            roles = sorted(API_ROLE_REGISTRY[rule.endpoint], key=role_order.index)
            access = [ROLE_LABELS[r] for r in roles] if roles else ["Any signed-in account"]
            gate = "decorator"
        else:
            try:
                src = inspect.getsource(fn)
            except OSError:
                src = ""
            access = ["Signed-in account (checked in the handler)"] if "current_account()" in src else ["Public (no sign-in)"]
            gate = "handler" if "current_account()" in src else "public"
        purpose = purposes.get(rule.endpoint) or (fn.__doc__ or "").strip().split("\n")[0]
        if rule.endpoint not in purposes:
            missing.append(rule.endpoint)
            purpose = purpose or humanise_endpoint(rule.endpoint)
        module = next((m for pat, m in ROUTE_MODULES if re.search(pat, rule.rule)), "Other")
        routes.append({"methods": methods, "path": rule.rule, "endpoint": rule.endpoint, "access": access,
                       "gate": gate, "purpose": purpose, "module": module})
    routes.sort(key=lambda r: (r["path"], r["methods"]))
    return routes, missing


def collect_tables():
    from app import db  # noqa: E402

    purposes = json.loads(TABLE_PURPOSES.read_text(encoding="utf-8"))
    out, missing = {}, []
    for mapper in db.Model.registry.mappers:
        cls, table = mapper.class_, mapper.local_table
        cols = []
        for c in table.columns:
            fk = next(iter(c.foreign_keys), None)
            cols.append({"name": c.name, "type": str(c.type), "pk": bool(c.primary_key),
                         "nullable": bool(c.nullable), "fk": fk.target_fullname if fk is not None else None})
        purpose = purposes.get(table.name) or (cls.__doc__ or "").strip().split("\n")[0]
        if table.name not in purposes:
            missing.append(table.name)
            purpose = purpose or table.name.replace("_", " ").capitalize() + "."
        out[table.name] = {"table": table.name, "model": cls.__name__, "purpose": purpose, "columns": cols}
    return out, missing


def collect_test_files():
    """{'module.Class.test_name': {file, cls, name, doc}} from the source (static)."""
    found = {}
    for path in sorted((ROOT / "tests").glob("test_*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in tree.body:
            if isinstance(node, ast.ClassDef):
                for fn in node.body:
                    if isinstance(fn, ast.FunctionDef) and fn.name.startswith("test"):
                        tid = f"{path.stem}.{node.name}.{fn.name}"
                        found[tid] = {"file": f"tests/{path.name}", "cls": node.name, "name": fn.name,
                                      "doc": (ast.get_docstring(fn) or "").strip().split("\n")[0]}
    return found


RESULT_RE = re.compile(r"\.\.\. (ok|FAIL|ERROR|skipped\b[^\n]*|expected failure|unexpected success)")
RESULT_LINE_RE = re.compile(r"^(ok|FAIL|ERROR|skipped\b[^\n]*|expected failure|unexpected success)\s*$", re.M)  # result alone on a line (warnings in between)
HEAD_RE = re.compile(r"^(test\w*) \(([\w.]+)\)", re.M)


def parse_run_log(text: str):
    heads = list(HEAD_RE.finditer(text))
    results = OrderedDict()
    for i, m in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        chunk = text[m.end():end]
        r = RESULT_RE.search(chunk) or RESULT_LINE_RE.search(chunk)
        status = "unknown"
        if r:
            word = r.group(1)
            status = {"ok": "passed", "FAIL": "failed", "ERROR": "error"}.get(word, "skipped" if word.startswith("skipped") else word)
        results[m.group(2)] = status
    # the authoritative failure list is the report at the end of the run
    failures = []
    for m in re.finditer(r"^(FAIL|ERROR): (\w+) \(([\w.]+)\)\n-{70}\n(.*?)(?=\n={70}|\nRan \d+ tests?)", text, re.S | re.M):
        trace = m.group(4).strip().splitlines()
        failures.append({"kind": m.group(1), "id": m.group(3), "last_line": trace[-1][:300] if trace else ""})
        results[m.group(3)] = "failed" if m.group(1) == "FAIL" else "error"
    ran = re.search(r"^Ran (\d+) tests? in ([\d.]+)s", text, re.M)
    outcome = re.search(r"^(OK[^\n]*|FAILED[^\n]*)$", text, re.M)
    return results, failures, (int(ran.group(1)), float(ran.group(2))) if ran else None, outcome.group(1) if outcome else None


def run_suite(workdir: Path):
    log = workdir / "test_run.log"
    started = dt.datetime.now().astimezone()
    cmd = [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py", "-v"]
    with open(log, "w", encoding="utf-8", errors="replace") as fh:
        subprocess.run(cmd, cwd=ROOT, stdout=fh, stderr=subprocess.STDOUT, check=False)
    return log, started, dt.datetime.now().astimezone()


def collect_seed():
    """Seed a temporary database exactly as a first start does and measure the demonstration dataset, the
    report counts and the KPI measurements (never touches a real database: DATABASE_URL is a temp file)."""
    import app as A

    with A.app.app_context():
        A.run_startup_tasks()
        client = A.app.test_client()
        login = client.post("/api/auth/login", json={"email": "admin@usls.edu.ph", "password": "DemoPass123!"})
        out = {
            "demo_mode": bool(A.demo_mode_enabled()),
            "students": A.Student.query.count(), "programs": A.Program.query.count(),
            "subjects": A.Course.query.count(), "faculty": A.Faculty.query.count(),
            "accounts": A.UserAccount.query.count(),
            "accounts_by_role": {r: A.UserAccount.query.filter_by(role=r).count() for r in A.ROLE_LABELS},
            "demo_student_accounts": len(A.WORKFLOW_DEMO_STUDENTS),
            "business_rules": A.BusinessRule.query.count(),
            "operational_reports": len(A.OPERATIONAL_REPORT_KEYS), "analytics_reports": len(A.ANALYTICS_REPORTS),
            "kpis": [], "reports": {}, "analytics": {}, "login_status": login.status_code,
        }
        if login.status_code == 200:
            reports = client.get("/api/reports").get_json() or {}
            out["reports"] = {k: v["count"] for k, v in reports.items() if isinstance(v, dict) and "count" in v}
            dash = (client.get("/api/dashboard").get_json() or {}).get("kpis", {})
            out["reports"]["summary"] = dash.get("total_students")
            analytics = client.get("/api/reports/analytics").get_json() or {}
            out["analytics"] = {k: v.get("count") for k, v in analytics.items() if isinstance(v, dict) and "count" in v}
            out["kpis"] = [{"module": k["module"], "kpi": k["kpi"], "value": k["value"], "unit": k["unit"],
                            "target": k["target"], "met": k["met"]} for k in analytics.get("kpis", [])]
        return out


def collect_versions():
    def pkg(name):
        for base in (ROOT / "frontend" / "node_modules", Path("E:/Github_Projects/CAPSTONE-USLS-MVP/frontend/node_modules")):
            f = base / name / "package.json"
            if f.exists():
                return json.loads(f.read_text(encoding="utf-8")).get("version")
        return None

    try:
        node = subprocess.run(["node", "--version"], capture_output=True, text=True, timeout=20).stdout.strip().lstrip("v")
    except Exception:  # noqa: BLE001
        node = None
    req = {}
    for line in (ROOT / "requirements.txt").read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Za-z0-9_.-]+)\s*(==|>=)\s*([\w.]+)", line)
        if m:
            req[m.group(1).lower()] = m.group(3)
    return {"node": node, "vite": pkg("vite"), "react": pkg("react"), "tailwindcss": pkg("tailwindcss"),
            "python": platform.python_version(), "flask": req.get("flask"), "flask_sqlalchemy": req.get("flask-sqlalchemy"),
            "os": f"{platform.system()} {platform.release()}, version {platform.version()}"}


def collect(args) -> None:
    os.environ.setdefault("USLS_SKIP_STARTUP_TASKS", "1")
    tmp = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
    tmp.close()
    os.environ["DATABASE_URL"] = "sqlite:///" + tmp.name.replace("\\", "/")
    sys.path.insert(0, str(ROOT))

    routes, missing_r = collect_routes()
    tables, missing_t = collect_tables()
    static_tests = collect_test_files()

    run = None
    started = ended = None
    log_path = None
    if args.run_suite:
        workdir = Path(tempfile.mkdtemp(prefix="proposal-suite-"))
        log_path, started, ended = run_suite(workdir)
    elif args.run_log:
        log_path = Path(args.run_log)
        if args.started:
            started = dt.datetime.fromisoformat(args.started)
        if args.ended:
            ended = dt.datetime.fromisoformat(args.ended)
    tests = []
    if log_path:
        text = log_path.read_text(encoding="utf-8", errors="replace")
        results, failures, ran, outcome = parse_run_log(text)
        count, secs = ran if ran else (len(results), None)
        counts = {k: sum(1 for v in results.values() if v == k) for k in ("passed", "failed", "error", "skipped")}
        run = {
            "command": 'python -m unittest discover -s tests -p "test_*.py" -v',
            "started": started.isoformat(timespec="seconds") if started else None,
            "ended": ended.isoformat(timespec="seconds") if ended else None,
            "date": (started or dt.datetime.fromtimestamp(log_path.stat().st_mtime)).date().isoformat(),
            "count": count, "passed": counts["passed"], "failed": counts["failed"], "errors": counts["error"],
            "skipped": counts["skipped"], "duration_seconds": secs, "result_line": outcome,
            "failures": failures, "log_parsed_ok": len(results) == count,
            "environment": {"os": platform.platform(), "python": platform.python_version()},
        }
        for tid, status in results.items():
            mod, cls, name = tid.rsplit(".", 2) if tid.count(".") >= 2 else ("", "", tid)
            info = static_tests.get(tid, {"file": f"tests/{mod}.py", "cls": cls, "name": name, "doc": ""})
            tests.append({"id": tid, "file": info["file"], "cls": info["cls"], "name": info["name"],
                          "module": classify_test(mod, name), "line": info["doc"] or sentence_from_test_name(name),
                          "result": status})
    else:  # static only: no results known
        for tid, info in static_tests.items():
            mod = tid.split(".")[0]
            tests.append({"id": tid, "file": info["file"], "cls": info["cls"], "name": info["name"],
                          "module": classify_test(mod, info["name"]),
                          "line": info["doc"] or sentence_from_test_name(info["name"]), "result": None})
    if run and set(static_tests) != {t["id"] for t in tests}:
        run["note_static_vs_run"] = "differences: %s" % sorted(set(static_tests) ^ {t["id"] for t in tests})[:10]

    methods_paths = sum(len(r["methods"]) for r in routes)
    inventory = {
        "generated": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
        "counts": {"routes": len(routes), "route_method_pairs": methods_paths, "tables": len(tables),
                   "columns": sum(len(t["columns"]) for t in tables.values()),
                   "tests_discovered": len(static_tests), "test_files": len({t["file"] for t in tests}),
                   "test_modules": len({t["module"] for t in tests})},
        "routes": routes, "tables": list(tables.values()), "tests": tests, "run": run,
        "seed": None if args.skip_seed else collect_seed(), "versions": collect_versions(),
        "missing_endpoint_purposes": missing_r, "missing_table_purposes": missing_t,
    }
    INVENTORY.write_text(json.dumps(inventory, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({**inventory["counts"], "run": {k: run[k] for k in ("date", "count", "passed", "failed", "errors",
                                                                          "duration_seconds", "result_line", "log_parsed_ok")} if run else None,
                      "missing_endpoint_purposes": missing_r, "missing_table_purposes": missing_t}, indent=1))
    by_mod = {}
    for t in tests:
        by_mod[t["module"]] = by_mod.get(t["module"], 0) + 1
    print(json.dumps(by_mod, indent=1))


# =========================================================================== stage 2: APPLY
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W}


def q(tag):
    return "{%s}%s" % (W, tag)


def zwsp_break(text: str) -> str:
    """Let Word break a long route after a slash or an underscore."""
    z = "​"
    return text.replace("/", "/" + z).replace("_", "_" + z).replace("<", z + "<")


def seconds_text(secs):
    if secs is None:
        return "not recorded"
    minutes, rest = divmod(secs, 60)
    return "%.3f seconds (%d min %.0f s)" % (secs, minutes, rest) if secs >= 60 else "%.3f seconds" % secs


def long_date(iso):
    d = dt.date.fromisoformat(iso)
    return "%s %d, %d" % (d.strftime("%B"), d.day, d.year)


class Doc:
    def __init__(self, src):
        from lxml import etree
        self.etree = etree
        with zipfile.ZipFile(src) as z:
            self.infos = z.infolist()
            self.parts = {i.filename: z.read(i.filename) for i in self.infos}
        self.root = etree.fromstring(self.parts["word/document.xml"])
        self.body = self.root.find(q("body"))

    def save(self, dst):
        self.parts["word/document.xml"] = self.etree.tostring(self.root, xml_declaration=True, encoding="UTF-8",
                                                               standalone=True)
        with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
            for info in self.infos:
                z.writestr(info, self.parts[info.filename])

    def fragment(self, xml):
        decl = " ".join(f'xmlns:{p}="{u}"' for p, u in self.root.nsmap.items() if p)
        wrapper = self.etree.fromstring(f"<root {decl}>{xml}</root>")
        return list(wrapper)

    @staticmethod
    def text(el):
        return "".join(t.text or "" for t in el.iter(q("t")))

    def style(self, p):
        s = p.find("w:pPr/w:pStyle", NS)
        return s.get(q("val")) if s is not None else ""

    def find_paragraph(self, prefix, styles=None, nth=0):
        hits = [c for c in self.body if c.tag == q("p") and self.text(c).strip().startswith(prefix)
                and (styles is None or self.style(c) in styles)]
        if len(hits) <= nth:
            raise SystemExit(f"paragraph not found: {prefix!r} (hits={len(hits)})")
        return hits[nth]

    def next_bookmark_id(self):
        ids = [int(x) for x in self.root.xpath("//w:bookmarkStart/@w:id", namespaces=NS) if str(x).isdigit()]
        return max(ids or [0]) + 1

    def replace_between(self, start_el, stop_pred, xml):
        """Delete everything after start_el up to (not including) the first element for which stop_pred is true,
        then insert the fragment there.  Returns number of deleted elements."""
        children = list(self.body)
        i = children.index(start_el) + 1
        j = i
        while j < len(children) and not stop_pred(children[j]):
            if children[j].tag == q("sectPr"):
                break
            j += 1
        for el in children[i:j]:
            self.body.remove(el)
        anchor = children[j] if j < len(children) else self.body.find(q("sectPr"))
        for el in self.fragment(xml):
            anchor.addprevious(el)
        return j - i


def heading_stop(doc, styles=("Heading1", "Heading2", "Heading3")):
    def pred(el):
        if el.find(".//w:bookmarkStart[@w:name]", NS) is not None and any(
                (b.get(q("name")) or "").startswith("BizRules") for b in el.iter(q("bookmarkStart"))):
            return True  # the marker of a block owned by add_business_rules_section.py (e.g. Appendix AA)
        return el.tag == q("p") and doc.style(el) in styles and doc.text(el).strip() != ""
    return pred


# ---- builders (same look as add_business_rules_section.py) ----------------------------------
def builders():
    sys.path.insert(0, str(HERE))
    import add_business_rules_section as br
    return br


def group_row(br, text, widths):
    total = sum(widths)
    return (
        '<w:tr><w:trPr><w:cantSplit w:val="1"/></w:trPr><w:tc><w:tcPr>'
        f'<w:tcW w:w="{total}" w:type="dxa"/><w:gridSpan w:val="{len(widths)}"/><w:shd w:fill="F2F2F2" w:val="clear"/>'
        '<w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/>'
        '<w:right w:w="80" w:type="dxa"/></w:tcMar></w:tcPr>'
        '<w:p><w:pPr><w:keepNext/><w:spacing w:after="20" w:line="240" w:lineRule="auto"/></w:pPr>'
        f'{br.run(text, bold=True, size=18)}</w:p></w:tc></w:tr>'
    )


def grouped_table(br, header, groups, widths, size=16, fills=None):
    """groups: list of (group title or None, [row, ...]); row = list of cell content (list of paragraphs)."""
    assert sum(widths) == 9360
    fills = fills or {}
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    out = ['<w:tbl><w:tblPr><w:tblStyle w:val="Table28"/><w:tblW w:w="9360" w:type="dxa"/><w:jc w:val="center"/><w:tblBorders>'
           + "".join(f'<w:{s} w:color="000000" w:space="0" w:sz="8" w:val="single"/>'
                     for s in ("top", "left", "bottom", "right", "insideH", "insideV"))
           + '</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblLook w:val="0600"/></w:tblPr>'
           f'<w:tblGrid>{grid}</w:tblGrid>']
    out.append('<w:tr><w:trPr><w:cantSplit w:val="1"/><w:tblHeader w:val="1"/></w:trPr>'
               + "".join(br.cell([[h]], w, header=True, size=size + 2) for h, w in zip(header, widths)) + "</w:tr>")
    for title, rows in groups:
        if title:
            out.append(group_row(br, title, widths))
        for row in rows:
            cells = []
            for idx, (content, w) in enumerate(zip(row, widths)):
                fill = fills[idx](row) if idx in fills else None
                cells.append(br.cell(content, w, fill=fill, size=size))
            out.append('<w:tr><w:trPr><w:cantSplit w:val="1"/></w:trPr>' + "".join(cells) + "</w:tr>")
    out.append("</w:tbl>")
    return "".join(out)


RESULT_FILL = {"Passed": "E2F0D9", "Failed": "F8CBAD", "Error": "F8CBAD", "Skipped": "FFF2CC"}


def result_word(r):
    return {"passed": "Passed", "failed": "Failed", "error": "Error", "skipped": "Skipped", None: "Not run"}.get(r, str(r))


def group_by(items, key):
    out = OrderedDict()
    for it in items:
        out.setdefault(key(it), []).append(it)
    return out


def ordered_modules(tests):
    present = {t["module"] for t in tests}
    return [m for m in TEST_MODULES if m in present] + sorted(present - set(TEST_MODULES))


# ---- Appendix V ------------------------------------------------------------------------------
def build_appendix_v(br, inv):
    tests, run = inv["tests"], inv["run"]
    mods = ordered_modules(tests)
    if run:
        summary = (f"The suite holds {len(tests)} automated test cases in {inv['counts']['test_files']} test files. "
                   f"The table lists every one of them, grouped by module, with a plain-language line saying what is "
                   f"verified, the test file and class, and the result recorded in the run of {long_date(run['date'])} "
                   f"(Appendix W). The execution summary is given in Section 6.3.2.")
    else:
        summary = f"The suite holds {len(tests)} automated test cases; no run is recorded."
    groups = []
    n = 0
    for mod in mods:
        rows = []
        for t in [t for t in tests if t["module"] == mod]:
            n += 1
            word = result_word(t["result"])
            rows.append([
                [[f"TC-{n:03d}"]],
                [[t["line"]]],
                [[(zwsp_break(f"{t['file'].split('/')[-1]}"), "s")], [(zwsp_break(f"{t['cls']}.{t['name']}"), "sg")]],
                [[(word, "b")]],
            ])
        groups.append((f"{mod} ({len(rows)} test cases)", rows))
    xml = br.body_para(summary)
    xml += grouped_table(br, ["ID", "Test case: what is verified", "Test file and method", "Result"], groups,
                         [850, 4650, 2960, 900], size=16, fills={3: lambda row: RESULT_FILL.get(row[3][0][0][0])})
    xml += br.spacer()
    if run:
        xml += br.body_para(f"Total: {run['count']} test cases, {run['passed']} passed, {run['failed']} failed"
                            + (f", {run['errors']} with errors" if run["errors"] else "")
                            + (f", {run['skipped']} skipped" if run["skipped"] else "") + ".")
    xml += br.spacer()
    return xml


# ---- Appendix W ------------------------------------------------------------------------------
def build_appendix_w(br, inv):
    run = inv["run"]
    xml = br.body_para("The summary of the test execution reported in Section 6.3.2, recorded from the run itself.")
    if not run:
        return xml + br.body_para("No test run has been recorded.") + br.spacer()
    failing = "; ".join(f["id"] for f in run["failures"]) or "None"
    rows = [
        ("Command", run["command"]),
        ("Date of the run", long_date(run["date"]) + (f" (started {run['started'][11:16]}, finished {run['ended'][11:16]})"
                                                  if run.get("started") and run.get("ended") else "")),
        ("Test files", f"{inv['counts']['test_files']} files in the tests folder (test_*.py)"),
        ("Machine", f"{(inv.get('versions') or {}).get('os') or run['environment']['os']}; Python {run['environment']['python']}"),
        ("Database", "Temporary SQLite file created for the run"),
        ("Tests run", str(run["count"])),
        ("Passed", str(run["passed"])),
        ("Failed", str(run["failed"])),
        ("Errors", str(run["errors"])),
        ("Skipped", str(run["skipped"])),
        ("Execution time", seconds_text(run["duration_seconds"])),
        ("Result line", run["result_line"] or "not recorded"),
        ("Failing cases", failing),
    ]
    xml += br.table(["Field", "Recorded value"], [[[[a]], [[b]]] for a, b in rows], [2600, 6760], size=20)
    xml += br.spacer()
    if run["failures"]:
        xml += br.body_para("The failures are analysed in Section 6.3.3.")
    else:
        xml += br.body_para("The run ended without a failure or an error.")
    xml += br.spacer()
    return xml


# ---- Appendix Y ------------------------------------------------------------------------------
def build_appendix_y(br, inv, bm_start):
    routes = inv["routes"]
    c = inv["counts"]
    xml = br.body_para(
        f"The application server exposes the {c['routes']} routes below, read from the running application's routing "
        f"table ({c['route_method_pairs']} method and path combinations). They are grouped by module. The roles are those "
        "the route is registered with; the Administrator account passes every role gate. A route marked Any "
        "signed-in account requires a session but no particular role, and the handler then limits what is returned "
        "to the account's own data or scope. Routes marked Public need no session (sign-in, configuration and the "
        "application shell).")
    mods = group_by(routes, lambda r: r["module"])
    order = [m for _, m in ROUTE_MODULES]
    seen = []
    for m in order:
        if m in mods and m not in seen:
            seen.append(m)
    seen += [m for m in mods if m not in seen]
    for i, m in enumerate(seen, 1):
        rows = []
        for r in sorted(mods[m], key=lambda r: (r["path"], r["methods"])):
            rows.append([[[(", ".join(r["methods"]), "b")]], [[zwsp_break(r["path"])]], [[", ".join(r["access"])]],
                         [[r["purpose"]]]])
        xml += br.heading(3, f"Appendix Y.{i}. {m} ({len(rows)} routes)")
        xml += br.table(["Method", "Route", "Roles", "Purpose"], rows, [900, 3150, 1850, 3460], size=16)
        xml += br.spacer()
    xml += br.body_para(f"Total routes implemented: {c['routes']}.")
    xml += br.spacer()
    return xml


# ---- Appendix Z ------------------------------------------------------------------------------
def key_columns(t):
    cols = t["columns"]
    keys = [c["name"] + " (PK)" for c in cols if c["pk"]]
    keys += [f"{c['name']} -> {c['fk'].split('.')[0]}" for c in cols if c["fk"]]
    rest = [c["name"] for c in cols if not c["pk"] and not c["fk"]]
    shown = keys + rest[: max(0, 8 - len(keys))]
    more = len(cols) - len(shown)
    text = ", ".join(shown)
    if more > 0:
        text += f", and {more} more"
    return text


def build_appendix_z(br, inv):
    tables = {t["table"]: t for t in inv["tables"]}
    c = inv["counts"]
    xml = br.body_para(
        f"The implemented database comprises the {c['tables']} tables below, read from the application's data model "
        f"({c['columns']} columns in all), grouped by area and presented with the purpose of each and its key columns "
        "(primary key, foreign keys and the first other columns). Field-level specifications for the principal tables "
        "are given in Section 5.9.2.")
    groups, used = [], set()
    for title, names in TABLE_GROUPS.items():
        rows = []
        for n in names:
            if n in tables:
                used.add(n)
                t = tables[n]
                rows.append([[[(zwsp_break(n), "b")]], [[t["purpose"]]], [[(key_columns(t) + f" ({len(t['columns'])} columns)", "s")]]])
        if rows:
            groups.append((title, rows))
    extra = [n for n in sorted(tables) if n not in used]
    if extra:
        groups.append(("Other tables", [[[[(zwsp_break(n), "b")]], [[tables[n]["purpose"]]],
                                          [[(key_columns(tables[n]) + f" ({len(tables[n]['columns'])} columns)", "s")]]] for n in extra]))
    xml += grouped_table(br, ["Table", "Purpose", "Key columns"], groups, [1900, 3300, 4160], size=16)
    xml += br.spacer()
    xml += br.body_para(f"Total tables implemented: {c['tables']}.")
    xml += br.spacer()
    return xml


# ---- Section 5.9.2 field tables ----------------------------------------------------------------
def sql_type(t: str) -> str:
    t = t.upper()
    t = re.sub(r"VARCHAR\((\d+)\)", r"VARCHAR(\1)", t)
    return t


def apply_field_tables(doc, inv):
    if not FIELD_DESCRIPTIONS.exists():
        return {}
    desc = json.loads(FIELD_DESCRIPTIONS.read_text(encoding="utf-8"))
    tables = {t["table"]: t for t in inv["tables"]}
    report = {}
    body = list(doc.body)
    for idx, el in enumerate(body):
        if el.tag != q("p") or doc.style(el) != "Heading4":
            continue
        m = re.match(r"^5\.9\.2\.\d+ (\w+)$", doc.text(el).strip())
        if not m or m.group(1) not in tables:
            continue
        name = m.group(1)
        tbl = body[idx + 1]
        if tbl.tag != q("tbl"):
            continue
        rows = tbl.findall("w:tr", NS)
        header, sample = rows[0], rows[1]
        table = tables[name]
        table_desc = desc.get(name, {})
        for r in rows[1:]:
            tbl.remove(r)
        missing = []
        for col in table["columns"]:
            new = copy.deepcopy(sample)
            cells = new.findall("w:tc", NS)
            d = table_desc.get(col["name"])
            if not d:
                d = col["name"].replace("_", " ").capitalize() + "."
                missing.append(col["name"])
            dtype = sql_type(col["type"]) + (" PK" if col["pk"] else "") + (f" FK {col['fk']}" if col["fk"] else "")
            for cell, value in zip(cells, (col["name"], d, dtype)):
                ts = list(cell.iter(q("t")))
                for t in ts[1:]:
                    t.text = ""
                if ts:
                    ts[0].text = value
                    ts[0].set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
                else:
                    raise SystemExit("field table sample cell has no text run")
            tbl.append(new)
        report[name] = {"columns": len(table["columns"]), "missing_descriptions": missing}
    return report


# ---- Chapter 6 (module table, summary, defects, per-module prose) ------------------------------
def replace_table_after_caption(doc, caption_prefix, br, xml):
    cap = doc.find_paragraph(caption_prefix, styles=("Heading5",))
    children = list(doc.body)
    i = children.index(cap)
    tbl = children[i + 1]
    if tbl.tag != q("tbl"):
        raise SystemExit(f"no table after caption {caption_prefix!r}")
    for el in doc.fragment(xml):
        tbl.addprevious(el)
    doc.body.remove(tbl)


def apply_chapter6(doc, inv, br):
    run = inv["run"]
    if not run:
        return {"chapter6": "skipped (no run recorded)"}
    tests = inv["tests"]
    mods = ordered_modules(tests)
    prose = json.loads(MODULE_PROSE.read_text(encoding="utf-8")) if MODULE_PROSE.exists() else {}

    def counts(ts):
        return (len(ts), sum(1 for t in ts if t["result"] == "passed"),
                sum(1 for t in ts if t["result"] in ("failed", "error")))

    # Table 28
    rows = []
    for m in mods:
        n, p, f = counts([t for t in tests if t["module"] == m])
        rows.append([[[m]], [[str(n)]], [[str(p)]], [[str(f)]]])
    n, p, f = counts(tests)
    rows.append([[[("Total", "b")]], [[(str(n), "b")]], [[(str(p), "b")]], [[(str(f), "b")]]])
    replace_table_after_caption(doc, "Table 28.", br, br.table(["Module", "Test cases", "Passed", "Failed"], rows,
                                                               [5160, 1400, 1400, 1400], size=20))
    # Table 29
    pct = 100.0 * run["passed"] / run["count"] if run["count"] else 0
    rows = [("Test cases executed", str(run["count"])),
            ("Passed", f"{run['passed']} ({pct:.1f}%)"), ("Failed", str(run["failed"])),
            ("Errors", str(run["errors"])), ("Skipped", str(run["skipped"])),
            ("Execution time", seconds_text(run["duration_seconds"])),
            ("Date of the run", long_date(run["date"])),
            ("Outcome", run["result_line"] or "not recorded")]
    replace_table_after_caption(doc, "Table 29.", br, br.table(["Measure", "Result"], [[[[a]], [[b]]] for a, b in rows],
                                                               [3000, 6360], size=20))
    # Section 6.3.3 : defects (everything between the 6.3.3 and 6.3.4 headings is regenerated)
    h = doc.find_paragraph("6.3.3", styles=("Heading3",))
    h4 = doc.find_paragraph("6.3.4", styles=("Heading3",))
    children = list(doc.body)
    for el in children[children.index(h) + 1:children.index(h4)]:
        doc.body.remove(el)
    if run["failures"]:
        xml = br.body_para("The suite identified the following failing cases. Each is recorded here rather than deferred.")
        xml += br.caption("Table 30. Failing test cases in the recorded run")
        xml += br.table(["Test case", "Kind", "Last line of the report"],
                        [[[[zwsp_break(f["id"])]], [[f["kind"]]], [[f["last_line"]]]] for f in run["failures"]],
                        [3600, 900, 4860], size=18)
        xml += br.spacer()
    else:
        xml = br.body_para(
            f"The recorded run of {long_date(run['date'])} ended with {run['count']} test cases passed and no failure or "
            "error, so no defect is open against the suite. The one defect recorded at the CAP-IT1 milestone, DEF-001, "
            "was a failure of the reset test for the demonstration accounts: it expected the subject withdrawal "
            "demonstration student to hold one subject in Current status, but the demonstration baseline enrolls the "
            "student in three active subjects, from one of which the student withdraws in the walkthrough. The "
            "baseline was as designed and the expectation of the test was wrong, so the defect was closed by "
            "correcting the assertion of the test (test_workflow_demo_students_quick_login_and_central_reset), which "
            "now passes; the seeding routine was not changed. The defect never affected the subject withdrawal "
            "workflow itself.")
    anchor = h4
    for el in doc.fragment(xml):
        anchor.addprevious(el)
    # Section 6.3.4 : per-module prose
    h4 = doc.find_paragraph("6.3.4", styles=("Heading3",))
    children = list(doc.body)
    hi = children.index(h4)
    j = hi + 1
    while j < len(children) and not (children[j].tag == q("p") and doc.style(children[j]) in ("Heading1", "Heading2")):
        j += 1
    for el in children[hi + 1:j]:
        doc.body.remove(el)
    xml = ""
    for m in mods:
        n, p, f = counts([t for t in tests if t["module"] == m])
        xml += br.heading(4, m)
        xml += br.body_para(f"{n} test cases, {p} passed, {f} failed. " + prose.get(m, ""))
    anchor = list(doc.body)[hi + 1]
    for el in doc.fragment(xml):
        anchor.addprevious(el)
    return {"chapter6": "applied", "module_prose_missing": [m for m in mods if m not in prose]}


REPORT_SPECS = [  # (key, group, purpose) - the report views of the Reports screen (Table 24)
    ("summary", "Dashboard summary", "Headline monitoring figures: students monitored, at risk or delayed, open and overdue tasks, practicum records, withdrawal requests, graduation candidates, confirmed defenses."),
    ("daily_changes", "Daily changes (Registrar)", "Changes recorded on a given date that are relevant to the Registrar, with a mark-reflected action to record that a change has been carried across."),
    ("graduation_candidates", "Graduation candidates", "Graduation endorsement records with coursework, research and practicum status and the endorsement state."),
    ("missing_requirements", "Missing requirements", "Students with outstanding coursework, research, or practicum requirements."),
    ("practicum_monitoring", "Practicum monitoring", "Practicum records with the hours entered against the hours required, and the document state."),
    ("withdrawal_requests", "Withdrawal requests", "Subject withdrawal applications by stage and Dean decision."),
    ("loa_readmission", "LOA / readmission", "Leave of absence and readmission cases, and on-leave students with no case on file, with request kind, status, period or return semester, next owner and Registrar list status."),
    ("at_risk", "At-risk", "Students flagged At Risk of Delay or Delayed by the risk indicator."),
    ("open_overdue_tasks", "Open / overdue tasks", "Open work items with the owning role, due date and status."),
    ("research_completion", "Research completion", "Research cases by gate and completion state."),
    ("queue_aging", "Queue aging and backlog (analytics)", "Open case backlog per process area, in age buckets."),
    ("stage_bottlenecks", "Stage bottlenecks (analytics)", "Time in stage for each lifecycle stage, showing where delays accumulate."),
    ("owner_workload", "Workload and turnaround (analytics)", "Open load and turnaround for each owning role."),
    ("residency_watchlist", "Residency watchlist (analytics)", "Students measured against the normal and absolute residency limits; time on leave counts."),
    ("completion_attrition", "Completion and attrition (analytics)", "Completion and attrition per program, with the average time to finish."),
    ("scheduling_cycle_time", "Scheduling cycle time (analytics)", "Time from request to confirmed defense schedule, and reschedule counts."),
    ("followup_closure", "Follow-up closure (analytics)", "Follow-up and closure logging for flagged cases, the measurement behind the Module 4 indicator."),
]


def apply_report_table(doc, inv, br):
    seed = inv.get("seed")
    if not seed or not seed.get("reports"):
        return {"report_table": "skipped (no seed measurement)"}
    rows = []
    for key, label, purpose in REPORT_SPECS:
        if key == "summary":
            count = f"{seed['students']} students"
        elif key == "daily_changes":
            count = "By date"
        elif key in seed["reports"]:
            count = str(seed["reports"][key])
        else:
            count = str(seed["analytics"].get(key, ""))
        rows.append([[[label]], [[purpose]], [[count]]])
    replace_table_after_caption(doc, "Table 24.", br, br.table(["Report", "Purpose", "Observed count"], rows,
                                                               [2300, 5160, 1900], size=20))
    return {"report_table": f"{len(rows)} rows"}


# ---- text sync engine ---------------------------------------------------------------------------
def tokens_from(inv):
    c = inv["counts"]
    run = inv["run"] or {}
    seed = inv.get("seed") or {}
    ver = inv.get("versions") or {}
    tok = {
        "routes": str(c["routes"]), "route_method_pairs": str(c["route_method_pairs"]), "tables": str(c["tables"]),
        "columns": str(c["columns"]), "tests": str(run.get("count", c["tests_discovered"])),
        "tests_passed": str(run.get("passed", "")), "tests_failed": str(run.get("failed", "")),
        "tests_errors": str(run.get("errors", "")),
        "test_files": str(c["test_files"]), "test_modules": str(c["test_modules"]),
        "test_duration": seconds_text(run.get("duration_seconds")) if run else "",
        "test_date": long_date(run["date"]) if run else "",
        "test_pct": ("%.1f" % (100.0 * run["passed"] / run["count"])) if run and run.get("count") else "",
        "seed_students": str(seed.get("students", "")), "seed_programs": str(seed.get("programs", "")),
        "seed_subjects": str(seed.get("subjects", "")), "seed_faculty": str(seed.get("faculty", "")),
        "seed_demo_students": str(seed.get("demo_student_accounts", "")),
        "seed_accounts": str(seed.get("accounts", "")),
        "operational_reports": str(seed.get("operational_reports", "")),
        "analytics_reports": str(seed.get("analytics_reports", "")),
        "report_views": str(seed.get("operational_reports", 0) + seed.get("analytics_reports", 0)) if seed else "",
        "os": ver.get("os", ""), "python": ver.get("python", ""), "node": ver.get("node") or "",
        "vite": ver.get("vite") or "", "react": ver.get("react") or "", "tailwind": ver.get("tailwindcss") or "",
        "flask": ver.get("flask") or "", "flask_sqlalchemy": ver.get("flask_sqlalchemy") or "",
        "python_minor": ".".join((ver.get("python") or "").split(".")[:2]),
        "node_major_minor": ".".join((ver.get("node") or "").split(".")[:2]),
    }
    return tok


def fill(text, tok):
    text = re.sub(r"\{\{(\w+)\}\}", lambda m: tok[m.group(1)], text)
    return text.replace("'", "’")


def set_paragraph_text(doc, p, new):
    """Replace the whole text of a paragraph, keeping the formatting of the first text run."""
    ts = list(p.iter(q("t")))
    if not ts:
        raise SystemExit("paragraph without text run: " + new[:40])
    ts[0].text = new
    ts[0].set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    for t in ts[1:]:
        t.text = ""


def replace_in_paragraph(p, start, end, new):
    ts = list(p.iter(q("t")))
    pos, first = 0, True
    for t in ts:
        txt = t.text or ""
        a, b = pos, pos + len(txt)
        pos = b
        if b <= start or a >= end:
            continue
        lo, hi = max(start, a) - a, min(end, b) - a
        t.text = txt[:lo] + (new if first else "") + txt[hi:]
        t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
        first = False


def all_paragraphs(doc):
    skip = ("TableofFigures", "TOC")  # the lists of figures and tables are regenerated from the captions
    return [p for p in doc.root.iter(q("p"))
            if not any(a.tag == q("sdt") for a in p.iterancestors())
            and not doc.style(p).startswith(skip)]


inv_run = []


def norm(s):
    return s.replace("’", "'").replace("“", '"').replace("”", '"')


def apply_text_sync(doc, entries, tok, log):
    run = inv_run[0] if inv_run else None
    for e in entries:
        mode = e.get("mode", "replace")
        eid = e["id"]
        if e.get("requires_all_passed") and (not run or run["failed"] or run["errors"]):
            raise SystemExit(f"[{eid}] this text says every test passed, but the recorded run has failures or errors: "
                             "re-read Chapter 6 (sections 6.3, 6.6, 6.8) before regenerating.")
        paras = all_paragraphs(doc)
        texts = [doc.text(p) for p in paras]
        ntexts = [norm(t) for t in texts]
        expect = e.get("expect", 1)
        if mode == "replace":  # in-paragraph replacement; literal `find` (or `regex`)
            new = fill(e["replace"], tok)
            done = 0
            if "regex" in e:
                rx = re.compile(e["regex"])
                for p, t in zip(paras, texts):
                    for m in reversed(list(rx.finditer(t))):
                        replacement = fill(e["replace"], tok)
                        if t[m.start():m.end()] != replacement:
                            replace_in_paragraph(p, m.start(), m.end(), replacement)
                            t = doc.text(p)
                        done += 1
                if done < 1:
                    if any(norm(new) in t for t in ntexts):
                        log.append((eid, "already applied"))
                        continue
                    raise SystemExit(f"[{eid}] regex matched nothing: {e['regex']}")
                log.append((eid, f"regex matched {done}"))
            else:
                old = norm(e["find"])
                nnew = norm(new)
                hits = [(p, t) for p, t in zip(paras, ntexts) if old in t and nnew not in t]
                if hits:
                    if len(hits) != expect:
                        raise SystemExit(f"[{eid}] find matched {len(hits)} paragraphs, expected {expect}")
                    for p, t in hits:
                        i = t.index(old)
                        replace_in_paragraph(p, i, i + len(old), new)
                    log.append((eid, "applied"))
                elif any(norm(new) in t for t in ntexts):
                    log.append((eid, "already applied"))
                else:
                    raise SystemExit(f"[{eid}] text not found: {e['find'][:80]!r}")
        elif mode == "paragraph":  # replace a whole paragraph found by a prefix (old or new)
            new = fill(e["replace"], tok)
            prefixes = e["match"] if isinstance(e["match"], list) else [e["match"]]
            prefixes = [norm(fill(x, tok)) for x in prefixes]
            lead = norm(new)[:60]
            if e.get("auto_lead", True) and lead not in prefixes:
                prefixes.append(lead)
            hits = [p for p, t in zip(paras, ntexts) if any(t.strip().startswith(x) for x in prefixes)]
            if len(hits) != expect:
                raise SystemExit(f"[{eid}] paragraph match found {len(hits)}, expected {expect}: {prefixes}")
            for p in hits:
                if doc.text(p) == new:
                    log.append((eid, "already applied"))
                else:
                    set_paragraph_text(doc, p, new)
                    log.append((eid, "applied"))
        elif mode == "insert_after":  # new paragraph after the paragraph found by a prefix
            new = fill(e["replace"], tok)
            key = norm(e.get("key") or e["replace"][:50])
            present = [p for p, t in zip(paras, ntexts) if t.strip().startswith(key)]
            if present:
                for p in present:
                    if doc.text(p) != new:
                        set_paragraph_text(doc, p, new)
                log.append((eid, "already present"))
                continue
            hits = [p for p, t in zip(paras, ntexts) if t.strip().startswith(norm(e["match"]))]
            if len(hits) != 1:
                raise SystemExit(f"[{eid}] insert anchor found {len(hits)}: {e['match']!r}")
            anchor = hits[0]
            newp = copy.deepcopy(anchor)
            for child in list(newp):
                if child.tag in (q("bookmarkStart"), q("bookmarkEnd")):
                    newp.remove(child)
            ppr = newp.find("w:pPr", NS)
            if ppr is not None and ppr.find("w:sectPr", NS) is not None:
                ppr.remove(ppr.find("w:sectPr", NS))
            set_paragraph_text(doc, newp, new)
            anchor.addnext(newp)
            log.append((eid, "inserted"))
        elif mode == "delete":
            hits = [p for p, t in zip(paras, ntexts) if t.strip().startswith(norm(e["match"]))]
            if not hits:
                log.append((eid, "already removed"))
                continue
            if len(hits) != expect:
                raise SystemExit(f"[{eid}] delete matched {len(hits)}, expected {expect}")
            for p in hits:
                p.getparent().remove(p)
            log.append((eid, "removed"))
        else:
            raise SystemExit(f"[{eid}] unknown mode {mode}")


# ---- driver ----------------------------------------------------------------------------------
def apply(args) -> None:
    inv = json.loads(INVENTORY.read_text(encoding="utf-8"))
    br = builders()
    doc = Doc(args.src)
    report = {}

    def section(prefix, builder, stop_styles=("Heading2", "Heading3")):
        heading = doc.find_paragraph(prefix, styles=("Heading2",))
        # the section ends at the next Heading 2 (the next appendix) - appendix Y has Heading 3 children
        removed = doc.replace_between(heading, heading_stop(doc, ("Heading1", "Heading2")), builder())
        report[prefix] = f"replaced {removed} elements"

    section("Appendix V.", lambda: build_appendix_v(br, inv))
    section("Appendix W.", lambda: build_appendix_w(br, inv))
    section("Appendix Y.", lambda: build_appendix_y(br, inv, None))
    section("Appendix Z.", lambda: build_appendix_z(br, inv))
    report["fields"] = apply_field_tables(doc, inv)
    report.update(apply_chapter6(doc, inv, br))
    report.update(apply_report_table(doc, inv, br))
    entries = json.loads(TEXT_SYNC.read_text(encoding="utf-8"))["entries"] if TEXT_SYNC.exists() else []
    log = []
    inv_run[:] = [inv["run"]] if inv["run"] else []
    apply_text_sync(doc, entries, tokens_from(inv), log)
    report["text_sync"] = {"entries": len(entries), "applied": sum(1 for _, s in log if s in ("applied", "inserted", "removed")
                                                                     or s.startswith("regex"))}
    doc.save(args.dst)
    print(json.dumps(report, indent=1, default=str))
    for eid, status in log:
        if status not in ("already applied", "already present", "already removed"):
            print("  text:", eid, "-", status)
    if inv["missing_endpoint_purposes"]:
        print("endpoints without a purpose line:", inv["missing_endpoint_purposes"])
    if inv["missing_table_purposes"]:
        print("tables without a purpose line:", inv["missing_table_purposes"])


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("collect")
    c.add_argument("--run-suite", action="store_true", help="run the whole test suite (about 15 minutes)")
    c.add_argument("--run-log", help="parse the log of an earlier `unittest -v` run instead")
    c.add_argument("--started", help="ISO start time of the logged run")
    c.add_argument("--ended", help="ISO end time of the logged run")
    c.add_argument("--skip-seed", action="store_true", help="do not seed a temporary database to measure the demo dataset")
    a = sub.add_parser("apply")
    a.add_argument("src")
    a.add_argument("dst")
    args = ap.parse_args(argv)
    (collect if args.cmd == "collect" else apply)(args)


if __name__ == "__main__":
    main()
