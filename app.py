from __future__ import annotations

import os
import random
import re
import sys
from functools import wraps
from datetime import date, datetime, time, timedelta
from urllib.parse import urlparse

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory, session
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func, or_, text
from werkzeug.datastructures import MultiDict
from werkzeug.security import check_password_hash, generate_password_hash


load_dotenv()

db = SQLAlchemy()

FRONTEND_DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", "dist")

# This demo keeps the Flask API, SQLAlchemy models, workflow rules, RAG prototype,
# and seed data in one file so evaluators can trace a workflow end-to-end quickly.


# ---------------------------------------------------------------------------
# Transaction catalogue (source of truth for the workflow screens)
# ---------------------------------------------------------------------------
# Each entry here is exposed through /api/meta and drives the frontend workflow
# navigation. The slug must match a handler in TRANSACTION_HANDLERS below.
TRANSACTIONS = [
    {
        "slug": "student-handoff",
        "priority": "P0",
        "title": "Student Handoff",
        "icon": "user-plus",
        "group": "Intake",
        "short": "Create the Graduate School monitoring record from an admission or enrollment signal.",
        "actor": "GS Staff",
        "data": "Student profile, admission/enrollment signal, program, term, source reference, timestamp, initial status.",
    },
    {
        "slug": "leave-of-absence",
        "priority": "P0",
        "title": "Leave of Absence",
        "icon": "calendar-off",
        "group": "Standing",
        "short": "Record an LOA application, route the Dean decision, and pause the student record when approved.",
        "actor": "Student / GS Staff / Dean",
        "data": "Application reference, request date, effective period, prior LOA count, eligibility check, Dean decision, status update, notice.",
    },
    {
        "slug": "readmission",
        "priority": "P0",
        "title": "Readmission",
        "icon": "user-check",
        "group": "Standing",
        "short": "Record a return request after LOA, route the Dean decision, and reactivate approved students.",
        "actor": "Student / GS Staff / Dean",
        "data": "Application reference, target return term, previous LOA period, return eligibility, missing requirements, Dean decision, status update, notice.",
    },
    {
        "slug": "course-audit",
        "priority": "P1",
        "title": "Course Audit",
        "icon": "clipboard-check",
        "group": "Coursework",
        "short": "Map completed, current, and missing subjects to curriculum requirements.",
        "actor": "Academic Coordinator / GS Staff",
        "data": "Taken/current/missing subjects, AY/term, evidence reference, audit result, offering demand.",
    },
    {
        "slug": "research-gate",
        "priority": "P1",
        "title": "Research Gate Readiness",
        "icon": "file-check",
        "group": "Research",
        "short": "Check Form 1, Form 4, or completion evidence and set readiness or revision state.",
        "actor": "Student / Adviser / Research Coordinator",
        "data": "Form gate, required evidence, missing documents, decision result, next owner, milestone status.",
    },
    {
        "slug": "panel-matching",
        "priority": "P0",
        "title": "Panel Matching",
        "icon": "users",
        "group": "Research",
        "short": "Recommend panel members using specialization, availability, workload, and eligibility notes.",
        "actor": "Research Coordinator / Academic Coordinator",
        "data": "Specialization need, availability reference, workload count, recommended panel, eligibility notes.",
    },
    {
        "slug": "defense-scheduling",
        "priority": "P0",
        "title": "Defense Scheduling",
        "icon": "calendar-check",
        "group": "Research",
        "short": "Match available dates across student, adviser, and panel, then confirm or flag scheduling.",
        "actor": "Research Coordinator / Panel / Adviser / Student",
        "data": "Preferred date, availability responses, constraints, final schedule, mode, venue/link, status.",
    },
]

TRANSACTION_BY_SLUG = {item["slug"]: item for item in TRANSACTIONS}

# Ordered lifecycle labels used by the student detail timeline and dashboard.
STAGES = [
    "Admission",
    "Coursework",
    "Proposal Development",
    "Proposal Defense",
    "Data Collection",
    "Writing",
    "Final Defense",
    "LOA",
    "Completed",
]

# Colleges are shared by programs and faculty so panel matching can prefer
# same-college evaluators while still allowing cross-college matches.
COLLEGES = [
    "Arts and Sciences",
    "Business",
    "Education",
    "Engineering and Technology",
    "Nursing",
]


# ---------------------------------------------------------------------------
# App configuration helpers
# ---------------------------------------------------------------------------
def now_utc() -> datetime:
    return datetime.now()


def normalize_database_url(url: str) -> str:
    if url.startswith("mysql://"):
        return "mysql+pymysql://" + url.removeprefix("mysql://")
    return url


def is_mysql(url: str) -> bool:
    return url.startswith("mysql")


def ensure_mysql_database(database_url: str) -> None:
    """Create the MySQL database if it is missing. No-op for SQLite."""
    if not is_mysql(database_url):
        return

    import pymysql  # imported lazily so SQLite users do not need it

    parsed = urlparse(database_url)
    database_name = parsed.path.strip("/")
    if not database_name:
        raise RuntimeError("DATABASE_URL must include a database name.")

    connection = pymysql.connect(
        host=parsed.hostname or "localhost",
        port=parsed.port or 3306,
        user=parsed.username or "root",
        password=parsed.password or "",
        autocommit=True,
    )
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{database_name}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
    finally:
        connection.close()


def resolve_database_url() -> str:
    """Default to a zero-config SQLite file so `python app.py` just runs.

    Set DATABASE_URL (e.g. mysql://root:1234@localhost:3306/usls_gs_demo) to use MySQL.
    """
    configured = os.getenv("DATABASE_URL")
    if configured:
        return normalize_database_url(configured)
    sqlite_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "usls_gs_demo.sqlite3")
    return f"sqlite:///{sqlite_path}"


def create_app() -> Flask:
    database_url = resolve_database_url()
    ensure_mysql_database(database_url)

    # static_folder disabled: our catch-all route serves both the built assets
    # and the SPA fallback, so Flask's greedy static route does not shadow client routes.
    app = Flask(__name__, static_folder=None)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "demo-only-secret")
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)

    register_routes(app)
    return app


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
# The schema is intentionally compact for the MVP. It stores monitoring signals
# and workflow outcomes, not official registrar/accounting records.
class Program(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(30), unique=True, nullable=False)
    name = db.Column(db.String(160), nullable=False)
    college = db.Column(db.String(120), nullable=False)
    has_practicum = db.Column(db.Boolean, default=False)

    courses = db.relationship("Course", backref="program", lazy=True)
    students = db.relationship("Student", backref="program", lazy=True)


# Central student lifecycle record. Related tables hang off this record so the
# detail page can reconstruct coursework, documents, tasks, schedules, and logs.
class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_number = db.Column(db.String(40), unique=True, nullable=False)
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(160), nullable=False)
    program_id = db.Column(db.Integer, db.ForeignKey("program.id"), nullable=False)
    entry_year = db.Column(db.Integer, nullable=False)
    current_stage = db.Column(db.String(60), nullable=False, default="Admission")
    standing = db.Column(db.String(60), nullable=False, default="Active")
    risk_level = db.Column(db.String(20), nullable=False, default="Low")
    adviser_name = db.Column(db.String(120))
    created_at = db.Column(db.DateTime, default=now_utc)
    updated_at = db.Column(db.DateTime, default=now_utc, onupdate=now_utc)

    enrollments = db.relationship("TermEnrollment", backref="student", lazy=True, cascade="all, delete-orphan")
    course_records = db.relationship("CourseRecord", backref="student", lazy=True, cascade="all, delete-orphan")
    research_cases = db.relationship("ResearchCase", backref="student", lazy=True, cascade="all, delete-orphan")
    document_checks = db.relationship("DocumentCheck", backref="student", lazy=True, cascade="all, delete-orphan")
    tasks = db.relationship("Task", backref="student", lazy=True, cascade="all, delete-orphan")
    logs = db.relationship("TransactionLog", backref="student", lazy=True, cascade="all, delete-orphan")

    @property
    def name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class UserAccount(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(160), unique=True, nullable=False)
    full_name = db.Column(db.String(160), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(40), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"))
    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=now_utc)

    student = db.relationship("Student")


class AcademicTerm(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    label = db.Column(db.String(40), unique=True, nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)


class Course(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    program_id = db.Column(db.Integer, db.ForeignKey("program.id"), nullable=False)
    code = db.Column(db.String(40), unique=True, nullable=False)
    title = db.Column(db.String(160), nullable=False)
    units = db.Column(db.Integer, default=3)
    recommended_term = db.Column(db.String(40), default="Year 1")


# Term-level enrollment signal copied from an institutional source such as AIMS.
class TermEnrollment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    term_id = db.Column(db.Integer, db.ForeignKey("academic_term.id"), nullable=False)
    status = db.Column(db.String(40), nullable=False)
    source_reference = db.Column(db.String(160))
    confirmed_at = db.Column(db.DateTime, default=now_utc)

    term = db.relationship("AcademicTerm")


# Monitoring copy of a student's subject status against the program curriculum.
class CourseRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)
    status = db.Column(db.String(40), nullable=False)
    term_label = db.Column(db.String(40))
    evidence_reference = db.Column(db.String(160))
    updated_at = db.Column(db.DateTime, default=now_utc)

    course = db.relationship("Course")


# Research milestone container for thesis, dissertation, or project-paper cases.
class ResearchCase(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    case_type = db.Column(db.String(40), nullable=False)
    title = db.Column(db.String(220), nullable=False)
    current_gate = db.Column(db.String(80), nullable=False)
    status = db.Column(db.String(60), nullable=False)
    adviser_name = db.Column(db.String(120))
    opened_at = db.Column(db.DateTime, default=now_utc)


# Checklist-style evidence tracking per lifecycle gate or research milestone.
class DocumentCheck(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    gate = db.Column(db.String(80), nullable=False)
    item_name = db.Column(db.String(160), nullable=False)
    status = db.Column(db.String(40), nullable=False)
    evidence_reference = db.Column(db.String(160))
    updated_at = db.Column(db.DateTime, default=now_utc)


# Faculty reference data used by panel matching and scheduling availability.
class Faculty(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    college = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(80), nullable=False)
    specialization = db.Column(db.String(160), nullable=False)
    active = db.Column(db.Boolean, default=True)

    availabilities = db.relationship("FacultyAvailability", backref="faculty", lazy=True, cascade="all, delete-orphan")


# Date/time windows that make defense scheduling checkable in the demo.
class FacultyAvailability(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    faculty_id = db.Column(db.Integer, db.ForeignKey("faculty.id"), nullable=False)
    available_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)


# Result of the panel matching transaction, including the rule score shown to users.
class PanelAssignment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    faculty_id = db.Column(db.Integer, db.ForeignKey("faculty.id"), nullable=False)
    panel_role = db.Column(db.String(60), nullable=False)
    score = db.Column(db.Integer, default=0)
    eligibility_note = db.Column(db.String(220))
    assigned_at = db.Column(db.DateTime, default=now_utc)

    student = db.relationship("Student")
    faculty = db.relationship("Faculty")


# Defense scheduling request and computed confirmation status.
class ScheduleRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    preferred_date = db.Column(db.Date, nullable=False)
    mode = db.Column(db.String(40), nullable=False)
    venue = db.Column(db.String(160), nullable=False)
    status = db.Column(db.String(40), nullable=False)
    matched_count = db.Column(db.Integer, default=0)
    notes = db.Column(db.String(260))
    created_at = db.Column(db.DateTime, default=now_utc)
    confirmed_at = db.Column(db.DateTime)

    student = db.relationship("Student")


# Work queue item. Tasks represent the next owner and next action after a transaction.
class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    title = db.Column(db.String(180), nullable=False)
    owner_role = db.Column(db.String(80), nullable=False)
    due_at = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(40), nullable=False, default="Pending")
    priority = db.Column(db.Integer, default=10)


# Append-style activity record for transactions and accountability demos.
class TransactionLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    transaction_slug = db.Column(db.String(80), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"))
    actor_role = db.Column(db.String(80), nullable=False)
    source_reference = db.Column(db.String(160))
    result = db.Column(db.String(160), nullable=False)
    next_owner = db.Column(db.String(80))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=now_utc)


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------
# These helpers shape SQLAlchemy objects into stable JSON contracts for React.
# Keeping them separate from routes makes the API response shape easy to review.
def iso(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def program_dict(program: Program) -> dict:
    return {
        "id": program.id,
        "code": program.code,
        "name": program.name,
        "college": program.college,
        "has_practicum": program.has_practicum,
    }


def term_dict(term: AcademicTerm) -> dict:
    return {"id": term.id, "label": term.label, "start_date": iso(term.start_date), "end_date": iso(term.end_date)}


def faculty_dict(faculty: Faculty) -> dict:
    return {
        "id": faculty.id,
        "name": faculty.name,
        "college": faculty.college,
        "role": faculty.role,
        "specialization": faculty.specialization,
        "active": faculty.active,
    }


def student_brief(student: Student) -> dict:
    return {
        "id": student.id,
        "student_number": student.student_number,
        "name": student.name,
        "first_name": student.first_name,
        "last_name": student.last_name,
        "email": student.email,
        "program_code": student.program.code,
        "program_name": student.program.name,
        "college": student.program.college,
        "entry_year": student.entry_year,
        "current_stage": student.current_stage,
        "standing": student.standing,
        "risk_level": student.risk_level,
        "adviser_name": student.adviser_name,
        "search_label": student_search_label(student),
    }


def course_audit_dict(audit: dict) -> dict:
    def row(item):
        return {
            "code": item["course"].code,
            "title": item["course"].title,
            "units": item["course"].units,
            "recommended_term": item["course"].recommended_term,
            "status": item["status"],
            "term_label": item["record"].term_label if item["record"] else None,
            "evidence_reference": item["record"].evidence_reference if item["record"] else None,
        }

    return {
        "required_count": audit["required_count"],
        "completed": [row(r) for r in audit["completed"]],
        "current": [row(r) for r in audit["current"]],
        "incomplete": [row(r) for r in audit["incomplete"]],
        "missing": [row(r) for r in audit["missing"]],
        "missing_count": audit["missing_count"],
        "completion_rate": audit["completion_rate"],
    }


def research_case_dict(case: ResearchCase | None) -> dict | None:
    if not case:
        return None
    return {
        "id": case.id,
        "case_type": case.case_type,
        "title": case.title,
        "current_gate": case.current_gate,
        "status": case.status,
        "adviser_name": case.adviser_name,
        "opened_at": iso(case.opened_at),
    }


def document_check_dict(doc: DocumentCheck) -> dict:
    return {
        "id": doc.id,
        "gate": doc.gate,
        "item_name": doc.item_name,
        "status": doc.status,
        "evidence_reference": doc.evidence_reference,
        "updated_at": iso(doc.updated_at),
    }


def panel_assignment_dict(assignment: PanelAssignment) -> dict:
    return {
        "id": assignment.id,
        "panel_role": assignment.panel_role,
        "score": assignment.score,
        "eligibility_note": assignment.eligibility_note,
        "faculty_name": assignment.faculty.name if assignment.faculty else None,
        "specialization": assignment.faculty.specialization if assignment.faculty else None,
        "assigned_at": iso(assignment.assigned_at),
    }


def schedule_request_dict(req: ScheduleRequest) -> dict:
    return {
        "id": req.id,
        "preferred_date": iso(req.preferred_date),
        "mode": req.mode,
        "venue": req.venue,
        "status": req.status,
        "matched_count": req.matched_count,
        "notes": req.notes,
        "created_at": iso(req.created_at),
        "confirmed_at": iso(req.confirmed_at),
    }


def task_dict(task: Task) -> dict:
    return {
        "id": task.id,
        "student_id": task.student_id,
        "student_name": task.student.name if task.student else None,
        "title": task.title,
        "owner_role": task.owner_role,
        "due_at": iso(task.due_at),
        "status": task.status,
        "priority": task.priority,
        "overdue": task.status != "Done" and task.due_at < date.today(),
    }


def log_dict(log: TransactionLog) -> dict:
    return {
        "id": log.id,
        "transaction_slug": log.transaction_slug,
        "student_id": log.student_id,
        "student_name": log.student.name if log.student else None,
        "actor_role": log.actor_role,
        "source_reference": log.source_reference,
        "result": log.result,
        "next_owner": log.next_owner,
        "notes": log.notes,
        "created_at": iso(log.created_at),
    }


def account_dict(account: UserAccount) -> dict:
    return {
        "id": account.id,
        "email": account.email,
        "full_name": account.full_name,
        "role": account.role,
        "student_id": account.student_id,
    }


def current_account() -> UserAccount | None:
    account_id = session.get("account_id")
    if not account_id:
        return None
    account = UserAccount.query.get(account_id)
    if not account or not account.active:
        session.clear()
        return None
    return account


def require_api_login(role: str | None = None):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            account = current_account()
            if not account:
                return jsonify({"error": "Please sign in to continue."}), 401
            if role and account.role != role:
                return jsonify({"error": "This account cannot access that area."}), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator


# ---------------------------------------------------------------------------
# Module 5 — Prescriptive decision support (rule-based, computed in the backend)
# ---------------------------------------------------------------------------
# These indicators + recommendations are the SOURCE OF TRUTH. They are computed
# deterministically from recorded transactions, never by the assistant/LLM.
STALL_WARN_DAYS = 120
STALL_HIGH_DAYS = 210


def student_indicators(student: Student) -> dict:
    """Computed indicators for one student (Table 13 in the proposal)."""
    audit = compute_course_audit(student)
    open_tasks = Task.query.filter(
        Task.student_id == student.id, Task.status.in_(["Pending", "Overdue"])
    ).order_by(Task.due_at.asc()).all()
    overdue = [t for t in open_tasks if t.due_at < date.today()]
    max_overdue_days = max(((date.today() - t.due_at).days for t in overdue), default=0)
    upcoming = [t for t in open_tasks if t.due_at >= date.today()]
    next_due_days = min(((t.due_at - date.today()).days for t in upcoming), default=None)
    next_upcoming_title = (
        sorted(upcoming, key=lambda t: t.due_at)[0].title if upcoming else None
    )
    case = (
        ResearchCase.query.filter_by(student_id=student.id).order_by(ResearchCase.opened_at.desc()).first()
    )
    missing_docs = DocumentCheck.query.filter_by(student_id=student.id, status="Missing").count()
    sched = (
        ScheduleRequest.query.filter_by(student_id=student.id).order_by(ScheduleRequest.created_at.desc()).first()
    )
    last_log = (
        TransactionLog.query.filter_by(student_id=student.id).order_by(TransactionLog.created_at.desc()).first()
    )
    anchor = student.updated_at or student.created_at or now_utc()
    days_in_stage = max((now_utc() - anchor).days, 0)
    next_owner = (last_log.next_owner if last_log else None) or (open_tasks[0].owner_role if open_tasks else None)
    return {
        "stage": student.current_stage,
        "standing": student.standing,
        "risk": student.risk_level,
        "completion_rate": audit["completion_rate"],
        "missing_subjects": audit["missing_count"],
        "open_tasks": len(open_tasks),
        "overdue_tasks": len(overdue),
        "max_overdue_days": max_overdue_days,
        "research_gate": case.current_gate if case else None,
        "research_status": case.status if case else None,
        "missing_documents": missing_docs,
        "schedule_status": sched.status if sched else None,
        "days_in_stage": days_in_stage,
        "next_owner": next_owner,
    }


# Priority score = weighted urgency, so same-severity items can be ranked.
# Severity is DERIVED from the score, so the badge and the score never disagree.
SCORE_HIGH = 67
SCORE_MEDIUM = 34


def band_from_score(score: int) -> str:
    if score >= SCORE_HIGH:
        return "high"
    if score >= SCORE_MEDIUM:
        return "medium"
    return "low"


def _make_rec(code, base_score, trigger, recommendation, owner, bonus=0):
    score = max(1, min(100, int(base_score + bonus)))
    return {
        "code": code,
        "score": score,
        "severity": band_from_score(score),
        "trigger": trigger,
        "recommendation": recommendation,
        "owner": owner or "GS Staff",
    }


def student_recommendations(student: Student) -> dict:
    """Turn indicators into prescriptive, scored, owner-assigned next actions."""
    ind = student_indicators(student)
    owner = ind["next_owner"] or "GS Staff"
    recs: list[dict] = []

    if ind["overdue_tasks"] > 0:
        d = ind["max_overdue_days"]
        recs.append(_make_rec(
            "overdue", 68, f"{ind['overdue_tasks']} task(s) overdue — oldest is {d} day(s) past due",
            f"Escalate the overdue task(s) to {owner} and confirm the next step ({d} day(s) late).",
            owner, bonus=min(d * 2, 32)))
    if ind["missing_documents"] > 0 and ind["research_gate"]:
        n = ind["missing_documents"]
        recs.append(_make_rec(
            "evidence", 42, f"{n} required document(s) missing at {ind['research_gate']}",
            f"Return to the student to submit the {n} missing item(s) for {ind['research_gate']}.",
            "Student", bonus=min(n * 4, 24)))
    if ind["missing_subjects"] > 0 and ind["stage"] not in ("Admission", "LOA", "Completed"):
        n = ind["missing_subjects"]
        recs.append(_make_rec(
            "coursework", 36, f"{n} subject(s) missing or incomplete in the course audit",
            f"Resolve the {n} outstanding subject(s) with the Academic Coordinator.",
            "Academic Coordinator", bonus=min(n * 2, 18)))
    if ind["schedule_status"] == "Needs Availability":
        recs.append(_make_rec(
            "schedule", 46, "Defense schedule has no confirmed panel availability",
            "Collect panel and adviser availability, then re-confirm the defense date.",
            "Research Coordinator"))
    if ind["standing"] == "On Leave":
        recs.append(_make_rec(
            "residency", 40, "Student is on Leave of Absence",
            "Check the LOA expiry and prepare the readmission follow-up.", "GS Staff"))
    if ind["days_in_stage"] >= STALL_WARN_DAYS and ind["stage"] != "Completed":
        d = ind["days_in_stage"]
        recs.append(_make_rec(
            "stalled", 48, f"No recorded update in {d} days at the {ind['stage']} stage",
            f"Follow up — the case has been inactive for {d} days at {ind['stage']}.",
            owner, bonus=min(d // 8, 40)))

    recs.sort(key=lambda r: -r["score"])
    return {"indicators": ind, "recommendations": recs}


def student_priority(student: Student) -> dict:
    """A student's overall priority = the highest-scoring recommendation. Keeps the
    student record consistent with the Decision Support queue."""
    recs = student_recommendations(student)["recommendations"]
    if not recs:
        return {"level": "Low", "score": 0, "reason": "On track — no flagged actions"}
    top = recs[0]
    return {
        "level": band_from_score(top["score"]).capitalize(),
        "score": top["score"],
        "reason": top["trigger"],
    }


def recompute_risk(student: Student) -> None:
    """Persist the derived priority into risk_level so every view agrees."""
    student.risk_level = student_priority(student)["level"]


def _portfolio_row(rec, student):
    row = dict(rec)
    row.update({
        "student_id": student.id,
        "student_name": student.name,
        "student_number": student.student_number,
        "program_code": student.program.code,
        "stage": student.current_stage,
    })
    return row


def portfolio_recommendations(limit: int = 150) -> dict:
    """Action queue across the population, each item scored and specific (cheap queries)."""
    today = date.today()
    rows: list[dict] = []

    for t in (
        Task.query.filter(Task.status.in_(["Pending", "Overdue"]), Task.due_at < today)
        .order_by(Task.due_at.asc())
        .limit(80)
        .all()
    ):
        if not t.student:
            continue
        d = (today - t.due_at).days
        rows.append(_portfolio_row(_make_rec(
            "overdue", 68, f"“{t.title}” is {d} day(s) overdue (due {t.due_at.isoformat()})",
            f"Escalate “{t.title}” to {t.owner_role} — {d} day(s) past due.",
            t.owner_role, bonus=min(d * 2, 32)), t.student))

    cutoff = now_utc() - timedelta(days=STALL_WARN_DAYS)
    for s in (
        Student.query.filter(
            Student.standing == "Active",
            Student.current_stage != "Completed",
            Student.updated_at < cutoff,
        )
        .order_by(Student.updated_at.asc())
        .limit(50)
        .all()
    ):
        d = max((now_utc() - (s.updated_at or s.created_at)).days, 0)
        owner = "Research Coordinator" if s.current_stage in (
            "Proposal Development", "Proposal Defense", "Data Collection", "Writing", "Final Defense"
        ) else "Academic Coordinator" if s.current_stage == "Coursework" else "GS Staff"
        rows.append(_portfolio_row(_make_rec(
            "stalled", 48, f"No recorded update in {d} days at {s.current_stage}",
            f"Follow up — inactive for {d} days at {s.current_stage}.",
            owner, bonus=min(d // 8, 40)), s))

    for sc in (
        ScheduleRequest.query.filter(ScheduleRequest.status == "Needs Availability")
        .order_by(ScheduleRequest.created_at.desc())
        .limit(40)
        .all()
    ):
        if sc.student:
            rows.append(_portfolio_row(_make_rec(
                "schedule", 46, "Defense schedule has no confirmed panel availability",
                "Collect panel and adviser availability, then re-confirm the defense date.",
                "Research Coordinator"), sc.student))

    for sid, n in (
        db.session.query(DocumentCheck.student_id, func.count(DocumentCheck.id))
        .filter(DocumentCheck.status == "Missing")
        .group_by(DocumentCheck.student_id)
        .limit(50)
        .all()
    ):
        s = Student.query.get(sid)
        if s and s.standing == "Active":
            rows.append(_portfolio_row(_make_rec(
                "evidence", 42, f"{n} required document(s) missing",
                f"Request the {n} missing required document(s) from the student.",
                "Student", bonus=min(n * 4, 24)), s))

    seen = {(r["student_id"], r["code"]) for r in rows}
    for s in Student.query.filter(Student.standing == "On Leave").limit(40).all():
        if (s.id, "residency") not in seen:
            rows.append(_portfolio_row(_make_rec(
                "residency", 40, "Student is on Leave of Absence",
                "Check the LOA expiry and prepare the readmission follow-up.", "GS Staff"), s))

    rows.sort(key=lambda r: -r["score"])
    rows = rows[:limit]

    by_severity: dict[str, int] = {}
    by_owner: dict[str, int] = {}
    for r in rows:
        by_severity[r["severity"]] = by_severity.get(r["severity"], 0) + 1
        by_owner[r["owner"]] = by_owner.get(r["owner"], 0) + 1

    return {
        "items": rows,
        "summary": {
            "total": len(rows),
            "students_flagged": len({r["student_id"] for r in rows}),
            "by_severity": [
                {"severity": sev, "count": by_severity.get(sev, 0)}
                for sev in ["high", "medium", "low"]
                if by_severity.get(sev, 0) > 0
            ],
            "by_owner": [{"owner": o, "count": n} for o, n in sorted(by_owner.items(), key=lambda x: -x[1])],
        },
    }


# ---------------------------------------------------------------------------
# Module 6 — RAG policy & case guidance
# Source A: computed indicators above (backend = truth).
# Source B: the curated policy corpus below (retrieved, then cited).
# Generation: Google AI Studio when a key is set; otherwise an offline grounded
# responder so the feature is fully demonstrable without any external service.
# ---------------------------------------------------------------------------
# For the MVP, the "retrieval corpus" is a curated in-code set of policy snippets.
# A production version would ingest approved DOCX/PDF/XLSX documents into chunks.
POLICY_SNIPPETS = [
    {"id": "loa-residency", "title": "Leave of Absence & Residency", "source": "GS Research Protocol / Handbook",
     "tags": ["loa", "leave", "residency", "terms", "pause", "eligible", "eligibility"],
     "text": "A student may file a Leave of Absence with an approved reason. The residency clock is paused for the approved LOA period. LOA is limited (prototype rule: up to 4 terms total) and the student must have completed at least one term of residency before filing. The Dean approves the request; GS Staff records the effective dates."},
    {"id": "readmission", "title": "Readmission of Returning Students", "source": "GS Research Protocol / Handbook",
     "tags": ["readmission", "return", "re-enroll", "comeback"],
     "text": "A returning student files for readmission with a return-intent letter, an updated study plan, a program/adviser endorsement, and clearance of any pending accountability. On approval the student is marked active for the return term."},
    {"id": "onboarding", "title": "Admission Handoff & Onboarding", "source": "GS Onboarding Checklist",
     "tags": ["onboarding", "handoff", "admission", "intake", "requirements"],
     "text": "At admission handoff, GS verifies admission approval, the student profile sheet, program assignment, the enrollment signal, and the official transcript. Missing items are flagged and assigned to GS Staff for follow-up."},
    {"id": "title-defense", "title": "Title Defense Readiness (Form 1)", "source": "GS Research Protocol — Title Defense",
     "tags": ["form 1", "title", "title defense", "concept", "concept papers"],
     "text": "Title defense readiness requires Form 1 (Application for Title Defense), three concept papers, the Academic Coordinator endorsement, and a recommended panel set."},
    {"id": "title-result", "title": "Title Defense Result (Form 2)", "source": "GS Research Protocol — Title Defense",
     "tags": ["form 2", "title result", "approved title", "result"],
     "text": "The title defense outcome is recorded on Form 2 (approved / for revision / not approved). An approved title advances the student to proposal preparation."},
    {"id": "adviser", "title": "Research Adviser Designation (Form 3 / 3.1)", "source": "GS Research Protocol — Advising",
     "tags": ["adviser", "designation", "form 3", "appointment"],
     "text": "Research adviser designation uses Form 3 (Application) and Form 3.1 (Appointment), routed for Dean approval. The appointed adviser is recorded with the date."},
    {"id": "proposal", "title": "Proposal Defense Readiness (Form 4)", "source": "GS Research Protocol — Proposal Defense",
     "tags": ["form 4", "proposal", "defense readiness", "statistical", "manuscript"],
     "text": "Proposal defense readiness requires the Form 4 endorsement, the proposal manuscript, the adviser endorsement, Form 4.1 statistical consultation (quantitative) or a qualitative exemption, and an agreed schedule."},
    {"id": "panel", "title": "Panel Composition & Matching", "source": "GS Research Protocol — Panel",
     "tags": ["panel", "composition", "members", "chair", "external", "specialization"],
     "text": "A thesis panel has a Chair, content and method specialists, and an external panel member; a dissertation panel adds a second content specialist. Panels are matched by specialization, availability, and current workload."},
    {"id": "scheduling", "title": "Defense Scheduling & Lead Time", "source": "GS Research Protocol — Scheduling",
     "tags": ["schedule", "scheduling", "lead time", "defense date", "availability"],
     "text": "A defense is confirmed only when the assigned panel is available on the chosen date and the required lead time is met (prototype: 14 days for proposal/final, 5 days for the public final). Otherwise the case waits for availability."},
    {"id": "ethics", "title": "Ethics Review & Clearance", "source": "GS Research Protocol — Ethics (RERC)",
     "tags": ["ethics", "clearance", "rerc", "review"],
     "text": "Studies requiring ethics review submit for RERC clearance. Ethics clearance is recorded before data-collection and writing milestones proceed."},
    {"id": "final-defense", "title": "Final Defense Readiness", "source": "GS Research Protocol — Final Defense",
     "tags": ["final defense", "final", "form 6", "form 7", "14 days"],
     "text": "Final defense readiness requires the Form 4 endorsement for final defense, the final manuscript, ethics clearance, and the panel receiving the manuscript at least 14 days before the defense."},
    {"id": "completion", "title": "Completion Evidence", "source": "GS Research Protocol — Completion",
     "tags": ["completion", "turnitin", "editor", "approval sheet", "form 9", "form 10", "similarity"],
     "text": "Completion requires the final manuscript, panel approval, ethics clearance, a Turnitin certificate (similarity not more than 15%), the Form 9 editor certification, and the Form 10 approval sheet."},
    {"id": "withdrawal", "title": "Withdrawal", "source": "GS Handbook — Withdrawal",
     "tags": ["withdrawal", "withdraw", "attrition", "drop out"],
     "text": "A withdrawal request is routed for a Dean decision. On approval the case is closed with a recorded reason and monitoring stops."},
    {"id": "graduation", "title": "Graduation Endorsement", "source": "GS Handbook — Graduation",
     "tags": ["graduation", "endorsement", "candidate", "registrar"],
     "text": "Graduation endorsement checks coursework, research, practicum (if applicable), and clearance completion, then compiles the candidate endorsement list for Dean approval and registrar hand-off."},
    {"id": "practicum", "title": "Practicum / OJT (Program-dependent)", "source": "GS Handbook — Practicum",
     "tags": ["practicum", "ojt", "hours", "moa", "certificate"],
     "text": "Programs requiring practicum track the required hours, the MOA, and uploaded certificates as completion evidence."},
    {"id": "course-audit", "title": "Course Audit & Curriculum", "source": "AC Student Monitoring",
     "tags": ["course audit", "subjects", "curriculum", "completion", "missing"],
     "text": "Course audit maps completed, current, and missing subjects against the curriculum. Clearing all subjects signals readiness to move to proposal development."},
    {"id": "escalation", "title": "Delay, Time-in-Stage & Escalation", "source": "Monitoring Policy",
     "tags": ["delay", "delayed", "time in stage", "escalation", "overdue", "follow up", "stalled"],
     "text": "Cases that exceed the allowed time-in-stage or carry overdue tasks are escalated to the responsible coordinator; incomplete evidence is returned to the student queue."},
    {"id": "risk", "title": "Risk Flags & Intervention", "source": "Monitoring Policy",
     "tags": ["risk", "at risk", "monitoring", "intervention", "attention"],
     "text": "Students are flagged for attention based on overdue tasks, missing evidence, stalled stages, or residency nearing its limit, prompting a follow-up intervention with recorded closure."},
]

_STOPWORDS = set(
    "the a an of to and or for in on with is are be by at as your you student students case "
    "what who which how when does do this that it should can will".split()
)


def _tokenize(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9]+", (text or "").lower()) if w not in _STOPWORDS and len(w) > 2]


def retrieve_policy(query: str, k: int = 3) -> list[dict]:
    """Lightweight lexical retriever over the policy corpus (no embeddings needed)."""
    q_terms = set(_tokenize(query))
    q_lower = (query or "").lower()
    scored = []
    for sn in POLICY_SNIPPETS:
        tags = {t.lower() for t in sn["tags"]}
        title_terms = set(_tokenize(sn["title"]))
        body_terms = set(_tokenize(sn["text"]))
        score = 0
        for w in q_terms:
            if w in tags:
                score += 3
            if w in title_terms:
                score += 2
            if w in body_terms:
                score += 1
        for tag in sn["tags"]:
            if " " in tag and tag in q_lower:
                score += 4
        if score > 0:
            scored.append((score, sn))
    scored.sort(key=lambda x: -x[0])
    return [sn for _, sn in scored[:k]]


def _status_sentence(student: Student, ind: dict) -> str:
    bits = [f"{student.name} ({student.student_number}, {student.program.code}) is at the {ind['stage']} stage"]
    bits.append(f"standing {ind['standing']}, risk {ind['risk']}")
    if ind["research_gate"]:
        bits.append(f"research gate {ind['research_gate']} — {ind['research_status']}")
    bits.append(f"coursework {ind['completion_rate']}% complete")
    return ", ".join(bits) + "."


def local_grounded_answer(question: str, student: Student | None, payload: dict | None, snippets: list[dict]) -> str:
    """Offline, deterministic responder. Grounds answers in computed indicators + retrieved policy.
    Stands in for Google AI Studio so the feature is demonstrable without an API key."""
    q = (question or "").lower()
    out: list[str] = []
    ind = payload["indicators"] if payload else None
    recs = payload["recommendations"] if payload else []

    asks_status = any(w in q for w in ["status", "pending", "where", "next", "owner", "summary", "doing", "standing"])
    asks_policy = any(w in q for w in ["loa", "leave", "residency", "readmission", "eligible", "require", "requirement",
                                       "form", "ethics", "panel", "schedule", "completion", "graduat", "withdraw", "practicum", "policy", "rule"])
    asks_portfolio = any(w in q for w in ["delayed", "overdue", "at risk", "risk", "stalled", "which students",
                                          "attention", "bottleneck", "escalate", "behind"])

    if student and (asks_status or (not asks_policy and not asks_portfolio)):
        out.append(_status_sentence(student, ind))
        if ind["overdue_tasks"]:
            out.append(f"There {'is' if ind['overdue_tasks'] == 1 else 'are'} {ind['overdue_tasks']} overdue task(s).")
        if ind["missing_documents"] and ind["research_gate"]:
            out.append(f"{ind['missing_documents']} required document(s) are still missing at {ind['research_gate']}.")
        out.append(f"The next action is owned by {ind['next_owner'] or 'GS Staff'}.")
        if recs:
            out.append("Recommended next steps: " + "; ".join(f"{r['recommendation']} ({r['owner']})" for r in recs[:3]))
        else:
            out.append("No outstanding follow-ups are flagged for this student.")

    elif asks_portfolio and not student:
        port = portfolio_recommendations()
        s = port["summary"]
        out.append(f"{s['students_flagged']} student(s) currently need attention "
                   f"({s['by_severity']['high']} high, {s['by_severity']['medium']} medium).")
        for r in port["items"][:5]:
            out.append(f"• {r['student_name']} ({r['program_code']}, {r['stage']}): {r['trigger']} → {r['recommendation']} [{r['owner']}]")

    else:
        if snippets:
            top = snippets[0]
            out.append(f"{top['title']}: {top['text']}")
        if student and ind:
            out.append("For this student — " + _status_sentence(student, ind))
            if recs:
                out.append("Suggested action: " + recs[0]["recommendation"] + f" ({recs[0]['owner']}).")
        if not snippets and not student:
            out.append("I could not find a matching policy. Try mentioning a stage, form, or topic "
                       "(e.g. LOA, Form 4, panel, ethics, completion).")

    return " ".join(out).strip()


def call_google_ai_studio(question: str, snippets: list[dict], payload: dict | None, api_key: str) -> str:
    """Real provider integration point (Google AI Studio / Gemini).

    Intentionally a thin stub: in the demo no key is set, so this is never called.
    When GOOGLE_AI_STUDIO_API_KEY is provided, build the grounded prompt from
    `snippets` + `payload` and POST to the AI Studio endpoint here, then return the text.
    """
    raise NotImplementedError("Google AI Studio not connected in this build.")


def generate_answer(question: str, student_id: int | None = None) -> dict:
    student = Student.query.get(student_id) if student_id else None
    payload = student_recommendations(student) if student else None
    snippets = retrieve_policy(question, k=3)

    # The assistant is advisory only: it retrieves policy snippets and explains
    # backend-computed facts. It never changes records or approves decisions.
    api_key = os.getenv("GOOGLE_AI_STUDIO_API_KEY")
    mode = "offline"
    if api_key:
        try:
            answer = call_google_ai_studio(question, snippets, payload, api_key)
            mode = "google-ai-studio"
        except Exception:
            answer = local_grounded_answer(question, student, payload, snippets)
            mode = "offline-fallback"
    else:
        answer = local_grounded_answer(question, student, payload, snippets)

    return {
        "answer": answer,
        "mode": mode,
        "citations": [{"id": s["id"], "title": s["title"], "source": s["source"], "text": s["text"]} for s in snippets],
        "grounded": payload["indicators"] if payload else None,
        "recommendations": payload["recommendations"] if payload else [],
        "student": student_brief(student) if student else None,
    }


# ---------------------------------------------------------------------------
# Routes (JSON API + SPA hosting)
# ---------------------------------------------------------------------------
def register_routes(app: Flask) -> None:
    # Lightweight smoke-check endpoint for setup/demo verification.
    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "students": Student.query.count()})

    @app.route("/api/auth/me")
    def auth_me():
        account = current_account()
        return jsonify({"user": account_dict(account) if account else None})

    @app.route("/api/auth/login", methods=["POST"])
    def auth_login():
        body = request.get_json(silent=True) or {}
        role = (body.get("role") or "").strip().lower()
        email = (body.get("email") or "").strip().lower()
        password = body.get("password") or ""
        if role not in ["staff", "student"]:
            return jsonify({"error": "Choose Staff or Student to sign in."}), 400
        account = UserAccount.query.filter_by(email=email, role=role, active=True).first()
        if not account or not check_password_hash(account.password_hash, password):
            return jsonify({"error": "Invalid email, password, or account type."}), 401
        session.clear()
        session["account_id"] = account.id
        session["role"] = account.role
        session["student_id"] = account.student_id
        return jsonify({"user": account_dict(account)})

    @app.route("/api/auth/logout", methods=["POST"])
    def auth_logout():
        session.clear()
        return jsonify({"ok": True})

    # Shared reference data used to render filters, dropdowns, and workflow cards.
    @app.route("/api/meta")
    @require_api_login()
    def meta():
        programs = Program.query.order_by(Program.college, Program.name).all()
        terms = AcademicTerm.query.order_by(AcademicTerm.start_date.desc()).all()
        faculty = Faculty.query.filter(Faculty.active.is_(True)).order_by(Faculty.name).all()
        return jsonify(
            {
                "transactions": TRANSACTIONS,
                "stages": STAGES,
                "colleges": COLLEGES,
                "programs": [program_dict(p) for p in programs],
                "terms": [term_dict(t) for t in terms],
                "faculty": [faculty_dict(f) for f in faculty],
            }
        )

    # Dashboard metrics are computed live from transaction-backed tables.
    @app.route("/api/dashboard")
    @require_api_login("staff")
    def dashboard():
        return jsonify(dashboard_stats())

    # Searchable/paginated directory for the Students page.
    @app.route("/api/students")
    @require_api_login("staff")
    def students_list():
        query = Student.query.join(Program)
        q = request.args.get("q", "").strip()
        if q:
            pattern = f"%{q}%"
            query = query.filter(
                or_(
                    Student.student_number.ilike(pattern),
                    Student.first_name.ilike(pattern),
                    Student.last_name.ilike(pattern),
                    Student.email.ilike(pattern),
                    Program.code.ilike(pattern),
                    Program.name.ilike(pattern),
                )
            )
        stage = request.args.get("stage", "").strip()
        if stage:
            query = query.filter(Student.current_stage == stage)
        program_id = request.args.get("program_id", type=int)
        if program_id:
            query = query.filter(Student.program_id == program_id)
        risk = request.args.get("risk", "").strip()
        if risk:
            query = query.filter(Student.risk_level == risk)
        standing = request.args.get("standing", "").strip()
        if standing:
            query = query.filter(Student.standing == standing)

        page = max(request.args.get("page", 1, type=int), 1)
        page_size = min(max(request.args.get("page_size", 25, type=int), 5), 100)
        total = query.count()
        items = (
            query.order_by(Student.last_name.asc(), Student.first_name.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return jsonify(
            {
                "items": [student_brief(s) for s in items],
                "total": total,
                "page": page,
                "page_size": page_size,
                "pages": (total + page_size - 1) // page_size,
            }
        )

    # Full student profile: lifecycle stage, audit, research, docs, panel,
    # schedules, tasks, activity trail, and decision-support recommendations.
    @app.route("/api/students/<int:student_id>")
    @require_api_login("staff")
    def student_detail(student_id: int):
        student = Student.query.get_or_404(student_id)
        audit = compute_course_audit(student)
        research_case = (
            ResearchCase.query.filter_by(student_id=student.id).order_by(ResearchCase.opened_at.desc()).first()
        )
        document_checks = (
            DocumentCheck.query.filter_by(student_id=student.id)
            .order_by(DocumentCheck.gate, DocumentCheck.item_name)
            .all()
        )
        panel = (
            PanelAssignment.query.filter_by(student_id=student.id).order_by(PanelAssignment.score.desc()).all()
        )
        schedules = (
            ScheduleRequest.query.filter_by(student_id=student.id)
            .order_by(ScheduleRequest.created_at.desc())
            .limit(8)
            .all()
        )
        tasks = (
            Task.query.filter_by(student_id=student.id)
            .order_by(Task.status.desc(), Task.due_at.asc())
            .limit(20)
            .all()
        )
        logs = (
            TransactionLog.query.filter(TransactionLog.student_id == student.id)
            .order_by(TransactionLog.created_at.desc())
            .limit(25)
            .all()
        )
        enrollments = (
            TermEnrollment.query.filter_by(student_id=student.id)
            .order_by(TermEnrollment.confirmed_at.desc())
            .all()
        )
        docs_by_gate: dict[str, list] = {}
        for doc in document_checks:
            docs_by_gate.setdefault(doc.gate, []).append(document_check_dict(doc))

        return jsonify(
            {
                "student": student_brief(student),
                "stages": STAGES,
                "stage_index": STAGES.index(student.current_stage) if student.current_stage in STAGES else 0,
                "course_audit": course_audit_dict(audit),
                "research_case": research_case_dict(research_case),
                "documents_by_gate": docs_by_gate,
                "panel": [panel_assignment_dict(p) for p in panel],
                "schedules": [schedule_request_dict(s) for s in schedules],
                "tasks": [task_dict(t) for t in tasks],
                "logs": [log_dict(l) for l in logs],
                "recommendations": student_recommendations(student)["recommendations"],
                "enrollments": [
                    {
                        "id": e.id,
                        "term_label": e.term.label if e.term else None,
                        "status": e.status,
                        "source_reference": e.source_reference,
                        "confirmed_at": iso(e.confirmed_at),
                    }
                    for e in enrollments
                ],
            }
        )

    # Student-facing portal context. This mirrors the staff record but keeps the
    # response focused on what a student needs to see and act on.
    @app.route("/api/student-portal/context")
    @require_api_login("student")
    def student_portal_context():
        account = current_account()
        student_id = account.student_id if account else None
        if not student_id:
            return jsonify({"error": "No students are available in the demo dataset."}), 404

        student = Student.query.get_or_404(student_id)
        audit = compute_course_audit(student)
        research_case = (
            ResearchCase.query.filter_by(student_id=student.id).order_by(ResearchCase.opened_at.desc()).first()
        )
        document_checks = (
            DocumentCheck.query.filter_by(student_id=student.id)
            .order_by(DocumentCheck.gate, DocumentCheck.item_name)
            .all()
        )
        schedules = (
            ScheduleRequest.query.filter_by(student_id=student.id)
            .order_by(ScheduleRequest.created_at.desc())
            .limit(5)
            .all()
        )
        tasks = (
            Task.query.filter(
                Task.student_id == student.id,
                Task.status.in_(["Pending", "Overdue"]),
            )
            .order_by(Task.priority.desc(), Task.due_at.asc())
            .limit(12)
            .all()
        )
        logs = (
            TransactionLog.query.filter(TransactionLog.student_id == student.id)
            .order_by(TransactionLog.created_at.desc())
            .limit(18)
            .all()
        )
        docs_by_gate: dict[str, list] = {}
        for doc in document_checks:
            docs_by_gate.setdefault(doc.gate, []).append(document_check_dict(doc))

        return jsonify(
            {
                "student": student_brief(student),
                "stages": STAGES,
                "stage_index": STAGES.index(student.current_stage) if student.current_stage in STAGES else 0,
                "course_audit": course_audit_dict(audit),
                "research_case": research_case_dict(research_case),
                "documents_by_gate": docs_by_gate,
                "schedules": [schedule_request_dict(s) for s in schedules],
                "tasks": [task_dict(t) for t in tasks],
                "logs": [log_dict(l) for l in logs],
                "recommendations": student_recommendations(student)["recommendations"],
                "gate_requirements": {
                    gate: required_documents_for_gate(gate)
                    for gate in [
                        "Form 1 - Title Defense",
                        "Form 4 - Proposal Defense Readiness",
                        "Final Defense",
                        "Completion Evidence",
                    ]
                },
                "readmission_requirements": readmission_requirements(),
            }
        )

    @app.route("/api/student-portal/requests/research-gate", methods=["POST"])
    @require_api_login("student")
    def student_research_gate_request():
        data = request_payload()
        account = current_account()
        student = Student.query.get_or_404(account.student_id)
        gate = data.get("gate", "Form 1 - Title Defense")
        title = (data.get("research_title") or "").strip()
        source = (data.get("source_reference") or data.get("submitted_package") or "").strip()
        submitted = data.getlist("submitted_items")
        clean_submitted = [
            item.split("||", 1)[1] if item.startswith(f"{gate}||") else item
            for item in submitted
        ]
        notes = [
            f"Student submitted a {gate} request for staff review.",
            f"Research title: {title or 'Not provided'}.",
            f"Submitted items: {', '.join(clean_submitted) if clean_submitted else 'None listed'}.",
        ]
        if data.get("submitted_package"):
            notes.append(f"Student notes/package reference: {data.get('submitted_package')}.")

        add_task(student.id, f"Review student {gate} application", "Research Coordinator", 3, 55)
        add_log(
            "research-gate",
            student.id,
            "Student",
            source,
            f"{gate} application submitted",
            "Research Coordinator",
            "\n".join(notes),
        )
        db.session.commit()
        return jsonify({"ok": True, "message": "Submitted. Research staff will review your application."})

    @app.route("/api/student-portal/requests/leave-of-absence", methods=["POST"])
    @require_api_login("student")
    def student_loa_request():
        data = request_payload()
        account = current_account()
        student = Student.query.get_or_404(account.student_id)
        source = (data.get("source_reference") or data.get("application_reference") or "").strip()
        effective_start = (data.get("effective_start") or "").strip()
        effective_end = (data.get("effective_end") or "").strip()
        period = " to ".join([part for part in [effective_start, effective_end] if part]) or "Not specified"
        notes = [
            "Student submitted a Leave of Absence application for staff eligibility review.",
            f"Requested period: {period}.",
        ]
        if data.get("reason_remarks"):
            notes.append(f"Reason/remarks: {data.get('reason_remarks')}.")
        if data.get("application_reference"):
            notes.append(f"Attachment/reference: {data.get('application_reference')}.")

        add_task(student.id, "Review student Leave of Absence application", "GS Staff", 3, 55)
        add_log(
            "leave-of-absence",
            student.id,
            "Student",
            source,
            "LOA application submitted",
            "GS Staff",
            "\n".join(notes),
        )
        db.session.commit()
        return jsonify({"ok": True, "message": "Submitted. Graduate School staff will review your LOA application."})

    @app.route("/api/student-portal/requests/readmission", methods=["POST"])
    @require_api_login("student")
    def student_readmission_request():
        data = request_payload()
        account = current_account()
        student = Student.query.get_or_404(account.student_id)
        source = (data.get("source_reference") or data.get("application_reference") or "").strip()
        submitted = set(data.getlist("readmission_items"))
        missing = [item for item in readmission_requirements() if item not in submitted]
        notes = [
            "Student submitted a readmission request for staff review.",
            f"Target return term: {data.get('target_return_term') or 'Not specified'}.",
            f"Checklist submitted: {len(submitted)} item(s); missing/not marked: {', '.join(missing) if missing else 'None'}.",
        ]
        if data.get("previous_loa_period"):
            notes.append(f"Previous LOA period: {data.get('previous_loa_period')}.")
        if data.get("application_reference"):
            notes.append(f"Attachment/reference: {data.get('application_reference')}.")

        add_task(student.id, "Review student readmission request", "GS Staff", 3, 55)
        add_log(
            "readmission",
            student.id,
            "Student",
            source,
            "Readmission request submitted",
            "GS Staff",
            "\n".join(notes),
        )
        db.session.commit()
        return jsonify({"ok": True, "message": "Submitted. Graduate School staff will review your readmission request."})

    @app.route("/api/student-portal/requests/defense-scheduling", methods=["POST"])
    @require_api_login("student")
    def student_defense_schedule_request():
        data = request_payload()
        account = current_account()
        student = Student.query.get_or_404(account.student_id)
        source = (data.get("source_reference") or data.get("venue") or "").strip()
        preferred_date = (data.get("preferred_date") or "").strip()
        defense_type = data.get("defense_type", "Proposal Defense")
        notes = [
            f"Student requested scheduling support for {defense_type}.",
            f"Preferred date: {preferred_date or 'Not specified'}.",
            f"Mode: {data.get('mode') or 'Not specified'}.",
        ]
        if data.get("venue"):
            notes.append(f"Venue/link preference: {data.get('venue')}.")
        if data.get("constraints"):
            notes.append(f"Constraints: {data.get('constraints')}.")

        add_task(student.id, f"Review student {defense_type} schedule request", "Research Coordinator", 4, 45)
        add_log(
            "defense-scheduling",
            student.id,
            "Student",
            source,
            f"{defense_type} schedule requested",
            "Research Coordinator",
            "\n".join(notes),
        )
        db.session.commit()
        return jsonify({"ok": True, "message": "Submitted. Research staff will review your preferred schedule."})

    # Role-filterable work queue.
    @app.route("/api/tasks")
    @require_api_login("staff")
    def tasks_list():
        owner = request.args.get("owner", "").strip()
        query = Task.query.filter(Task.status.in_(["Pending", "Overdue"]))
        if owner:
            query = query.filter(Task.owner_role == owner)
        tasks = query.order_by(Task.priority.desc(), Task.due_at.asc()).limit(100).all()
        return jsonify({"items": [task_dict(t) for t in tasks]})

    # Human-facing audit feed; generated seed history is hidden for clarity.
    @app.route("/api/activity")
    @require_api_login("staff")
    def activity():
        logs = (
            TransactionLog.query.filter(TransactionLog.actor_role != "Demo Data")
            .order_by(TransactionLog.created_at.desc())
            .limit(40)
            .all()
        )
        return jsonify({"items": [log_dict(l) for l in logs]})

    # Faculty reference endpoint for panels and scheduling.
    @app.route("/api/faculty")
    @require_api_login("staff")
    def faculty_list():
        faculty = Faculty.query.filter(Faculty.active.is_(True)).order_by(Faculty.name).all()
        return jsonify({"items": [faculty_dict(f) for f in faculty]})

    # Population-level queue of rule-based recommendations.
    @app.route("/api/decision-support")
    @require_api_login("staff")
    def decision_support():
        return jsonify(portfolio_recommendations())

    # RAG-style policy/case guidance endpoint.
    @app.route("/api/assistant", methods=["POST"])
    @require_api_login("staff")
    def assistant():
        data = request_payload()
        question = (data.get("question") or "").strip()
        if not question:
            return jsonify({"error": "Ask a question to get started."}), 400
        student_id = data.get("student_id")
        try:
            student_id = int(student_id) if student_id else None
        except (TypeError, ValueError):
            student_id = None
        return jsonify(generate_answer(question, student_id))

    # Starter questions for the Assistant UI.
    @app.route("/api/assistant/suggestions")
    @require_api_login("staff")
    def assistant_suggestions():
        return jsonify({
            "items": [
                "Which students need attention right now?",
                "What does a student need for proposal defense readiness?",
                "Explain the LOA and residency rule.",
                "What evidence is required for completion?",
                "How is a defense panel composed?",
            ]
        })

    # Supplies each workflow screen with student-specific context before
    # submission, such as current audit status or panel recommendations.
    @app.route("/api/transactions/<slug>/context")
    @require_api_login("staff")
    def transaction_context(slug: str):
        if slug not in TRANSACTION_BY_SLUG:
            return jsonify({"error": "Unknown workflow."}), 404
        student_id = request.args.get("student_id", type=int)
        specialization = request.args.get("specialization", "")
        return jsonify(serialize_transaction_context(slug, student_id, specialization))

    # Single transaction entry point. The slug selects the workflow handler,
    # Student Handoff via file upload: ingest an AC Student Monitoring .xlsx.
    @app.route("/api/transactions/student-handoff/import", methods=["POST"])
    @require_api_login("staff")
    def student_handoff_import():
        file = request.files.get("file")
        if not file or not file.filename:
            return jsonify({"error": "No file uploaded. Choose an AC Student Monitoring .xlsx file."}), 400
        if not file.filename.lower().endswith((".xlsx", ".xlsm")):
            return jsonify({"error": "Please upload an Excel .xlsx file in the AC Student Monitoring format."}), 400
        try:
            parsed = parse_ac_monitoring(file.stream)
            if not parsed["rows"]:
                return jsonify({"error": "No student rows found. Check that the sheet matches the AC Monitoring template."}), 400
            result = import_ac_monitoring(parsed)
            db.session.commit()
        except Exception as exc:  # noqa: BLE001 - surface a friendly error to the UI
            db.session.rollback()
            return jsonify({"error": f"Could not import the sheet: {exc}"}), 400
        return jsonify(result)

    # then the resulting records are committed as one database transaction.
    @app.route("/api/transactions/<slug>", methods=["POST"])
    @require_api_login("staff")
    def transaction_submit(slug: str):
        if slug not in TRANSACTION_BY_SLUG:
            return jsonify({"error": "Unknown workflow."}), 404
        data = request_payload()
        handler = TRANSACTION_HANDLERS[slug]
        try:
            student_id = handler(data)
            if student_id:
                target = Student.query.get(student_id)
                if target:
                    recompute_risk(target)  # keep priority consistent with the new signals
            db.session.commit()
        except Exception as exc:  # noqa: BLE001 - surface a friendly error to the UI
            db.session.rollback()
            return jsonify({"error": str(exc)}), 400
        return jsonify(
            {
                "ok": True,
                "student_id": student_id,
                "message": "Saved. The student record, queue, and monitoring indicators were updated.",
            }
        )

    # ---- SPA hosting -----------------------------------------------------
    @app.route("/")
    def index():
        return _serve_spa()

    @app.route("/<path:path>")
    def catch_all(path: str):
        candidate = os.path.join(FRONTEND_DIST, path)
        if path and os.path.isfile(candidate):
            return send_from_directory(FRONTEND_DIST, path)
        return _serve_spa()

    def _serve_spa():
        index_path = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.isfile(index_path):
            return send_from_directory(FRONTEND_DIST, "index.html")
        return (
            "<h1>USLS GS Platform API</h1>"
            "<p>The React frontend has not been built yet. Run "
            "<code>cd frontend &amp;&amp; npm install &amp;&amp; npm run build</code>, "
            "or use the Vite dev server (<code>npm run dev</code>) which proxies to this API.</p>",
            200,
        )


# ---------------------------------------------------------------------------
# Payload helper (works for both JSON bodies and classic form posts)
# ---------------------------------------------------------------------------
def request_payload() -> MultiDict:
    # Workflow forms submit JSON from React, but MultiDict keeps list-handling
    # compatible with classic Flask form posts and getlist().
    if request.is_json:
        body = request.get_json(silent=True) or {}
        md = MultiDict()
        for key, value in body.items():
            if isinstance(value, list):
                for item in value:
                    md.add(key, item)
            else:
                md.add(key, value)
        return md
    return request.form


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
def dashboard_stats() -> dict:
    # The dashboard intentionally uses live SQL aggregates instead of cached
    # values so every completed workflow is visible immediately during the demo.
    total_students = Student.query.count()
    active_students = Student.query.filter(Student.standing == "Active").count()
    on_leave = Student.query.filter(Student.standing == "On Leave").count()
    completed = Student.query.filter(Student.current_stage == "Completed").count()
    at_risk = Student.query.filter(Student.risk_level.in_(["Medium", "High"])).count()
    high_risk = Student.query.filter(Student.risk_level == "High").count()
    pending_tasks = Task.query.filter(Task.status.in_(["Pending", "Overdue"])).count()
    overdue_tasks = Task.query.filter(Task.due_at < date.today(), Task.status != "Done").count()
    confirmed_schedules = ScheduleRequest.query.filter(ScheduleRequest.status == "Confirmed").count()
    needs_availability = ScheduleRequest.query.filter(ScheduleRequest.status == "Needs Availability").count()

    stage_counts = dict(
        db.session.query(Student.current_stage, func.count(Student.id)).group_by(Student.current_stage).all()
    )
    stage_distribution = [{"stage": stage, "count": stage_counts.get(stage, 0)} for stage in STAGES]

    risk_counts = dict(
        db.session.query(Student.risk_level, func.count(Student.id)).group_by(Student.risk_level).all()
    )
    risk_distribution = [{"risk": level, "count": risk_counts.get(level, 0)} for level in ["Low", "Medium", "High"]]

    college_rows = (
        db.session.query(Program.college, func.count(Student.id))
        .join(Student, Student.program_id == Program.id)
        .group_by(Program.college)
        .order_by(func.count(Student.id).desc())
        .all()
    )
    college_distribution = [{"college": c, "count": n} for c, n in college_rows]

    gate_rows = (
        db.session.query(ResearchCase.current_gate, func.count(ResearchCase.id))
        .group_by(ResearchCase.current_gate)
        .all()
    )
    gate_distribution = [{"gate": g, "count": n} for g, n in gate_rows]

    owner_rows = (
        db.session.query(Task.owner_role, func.count(Task.id))
        .filter(Task.status.in_(["Pending", "Overdue"]))
        .group_by(Task.owner_role)
        .order_by(func.count(Task.id).desc())
        .all()
    )
    tasks_by_owner = [{"owner": o, "count": n} for o, n in owner_rows]

    schedule_rows = (
        db.session.query(ScheduleRequest.status, func.count(ScheduleRequest.id))
        .group_by(ScheduleRequest.status)
        .all()
    )
    schedule_distribution = [{"status": s, "count": n} for s, n in schedule_rows]

    recent_logs = (
        TransactionLog.query.filter(TransactionLog.actor_role != "Demo Data")
        .order_by(TransactionLog.created_at.desc())
        .limit(8)
        .all()
    )
    open_tasks = (
        Task.query.filter(Task.status.in_(["Pending", "Overdue"]))
        .order_by(Task.priority.desc(), Task.due_at.asc())
        .limit(8)
        .all()
    )

    return {
        "kpis": {
            "total_students": total_students,
            "active_students": active_students,
            "on_leave": on_leave,
            "completed": completed,
            "at_risk": at_risk,
            "high_risk": high_risk,
            "pending_tasks": pending_tasks,
            "overdue_tasks": overdue_tasks,
            "confirmed_schedules": confirmed_schedules,
            "needs_availability": needs_availability,
        },
        "stage_distribution": stage_distribution,
        "risk_distribution": risk_distribution,
        "college_distribution": college_distribution,
        "gate_distribution": gate_distribution,
        "tasks_by_owner": tasks_by_owner,
        "schedule_distribution": schedule_distribution,
        "recent_logs": [log_dict(l) for l in recent_logs],
        "open_tasks": [task_dict(t) for t in open_tasks],
    }


# ---------------------------------------------------------------------------
# Transaction context (data needed by each workflow screen)
# ---------------------------------------------------------------------------
def serialize_transaction_context(slug: str, selected_student_id: int | None, specialization: str = "") -> dict:
    # Context responses are read-only preparation data for workflow screens.
    # The actual record changes happen only in the transaction handlers.
    selected_student = None
    if slug != "student-handoff" and selected_student_id:
        selected_student = Student.query.get(selected_student_id)

    recent_logs = (
        TransactionLog.query.filter(
            TransactionLog.transaction_slug == slug,
            TransactionLog.actor_role != "Demo Data",
        )
        .order_by(TransactionLog.created_at.desc())
        .limit(8)
        .all()
    )

    context: dict = {
        "slug": slug,
        "transaction": TRANSACTION_BY_SLUG[slug],
        "selected_student": student_brief(selected_student) if selected_student else None,
        "recent_logs": [log_dict(l) for l in recent_logs],
        "gate_requirements": {
            gate: required_documents_for_gate(gate)
            for gate in [
                "Form 1 - Title Defense",
                "Form 4 - Proposal Defense Readiness",
                "Final Defense",
                "Completion Evidence",
            ]
        },
        "readmission_requirements": readmission_requirements(),
        "onboarding_requirements": onboarding_requirements(),
    }

    if slug == "student-handoff":
        context["programs"] = [program_dict(p) for p in Program.query.order_by(Program.college, Program.name).all()]
        context["terms"] = [term_dict(t) for t in AcademicTerm.query.order_by(AcademicTerm.start_date.desc()).all()]

    if selected_student:
        context["panel_roles"] = panel_roles_for_student(selected_student)
        context["research_case_type"] = research_case_type(selected_student)
        if slug == "course-audit":
            context["course_audit"] = course_audit_dict(compute_course_audit(selected_student))
            context["courses"] = [
                {"id": c.id, "code": c.code, "title": c.title}
                for c in Course.query.filter(Course.program_id == selected_student.program_id)
                .order_by(Course.code)
                .all()
            ]
            context["offering_demand"] = [
                {"code": row["course"].code, "title": row["course"].title, "count": row["count"]}
                for row in compute_offering_demand()
            ]
        if slug == "research-gate":
            context["research_case"] = research_case_dict(
                ResearchCase.query.filter_by(student_id=selected_student.id)
                .order_by(ResearchCase.opened_at.desc())
                .first()
            )
            context["documents_by_gate"] = {}
            for doc in DocumentCheck.query.filter_by(student_id=selected_student.id).all():
                context["documents_by_gate"].setdefault(doc.gate, []).append(document_check_dict(doc))
        if slug == "panel-matching":
            context["panel_recommendations"] = [
                {
                    "faculty_id": row["faculty"].id,
                    "faculty_name": row["faculty"].name,
                    "college": row["faculty"].college,
                    "specialization": row["faculty"].specialization,
                    "score": row["score"],
                    "note": row["note"],
                }
                for row in recommend_panel(selected_student, specialization)[:12]
            ]
            context["assigned_panel"] = [
                panel_assignment_dict(p)
                for p in PanelAssignment.query.filter_by(student_id=selected_student.id)
                .order_by(PanelAssignment.score.desc())
                .all()
            ]
        if slug == "defense-scheduling":
            context["assigned_panel"] = [
                panel_assignment_dict(p)
                for p in PanelAssignment.query.filter_by(student_id=selected_student.id)
                .order_by(PanelAssignment.score.desc())
                .all()
            ]
            context["schedules"] = [
                schedule_request_dict(s)
                for s in ScheduleRequest.query.filter_by(student_id=selected_student.id)
                .order_by(ScheduleRequest.created_at.desc())
                .limit(6)
                .all()
            ]

    return context


def student_search_label(student: Student | None) -> str:
    if not student:
        return ""
    return f"{student.student_number} - {student.last_name}, {student.first_name} - {student.program.code}"


def add_log(slug: str, student_id: int | None, actor: str, source: str, result: str, next_owner: str, notes: str) -> None:
    # Every workflow records what happened, who acted, where the evidence came
    # from, and who owns the next action.
    db.session.add(
        TransactionLog(
            transaction_slug=slug,
            student_id=student_id,
            actor_role=actor,
            source_reference=source,
            result=result,
            next_owner=next_owner,
            notes=notes,
        )
    )


def add_task(student_id: int, title: str, owner: str, days: int, priority: int = 20, status: str = "Pending") -> None:
    # Tasks make workflow follow-ups visible in the Work Queue.
    db.session.add(
        Task(
            student_id=student_id,
            title=title,
            owner_role=owner,
            due_at=date.today() + timedelta(days=days),
            priority=priority,
            status=status,
        )
    )


# ---------------------------------------------------------------------------
# Student Handoff via file upload — AC Student Monitoring sheet importer
# ---------------------------------------------------------------------------
def _norm(value) -> str:
    return "" if value is None else str(value).strip()


def _entry_year_from_ay(ay: str) -> int:
    """'23-24' -> 2023, '2023-2024' -> 2023, fallback to current year."""
    m = re.search(r"(\d{2,4})", ay or "")
    if not m:
        return date.today().year
    n = int(m.group(1))
    return n if n >= 1900 else 2000 + n


def parse_ac_monitoring(stream) -> dict:
    """Parse an AC Student Monitoring .xlsx into a structured payload.

    Layout: A1 = 'PROGRAM: <code>'. A two-row header (row N has IDNO/COURSE/YR,
    row N+1 has AY ENTRY/SN/FN and the subject codes), then one student per row.
    """
    import openpyxl  # imported lazily so the rest of the app has no hard dependency

    wb = openpyxl.load_workbook(stream, data_only=True, read_only=True)
    ws = wb.active
    max_col = ws.max_column or 40

    grid = [[_norm(c.value) for c in row] for row in ws.iter_rows(min_row=1, max_row=ws.max_row)]

    def cell(r, c):  # 1-indexed helpers over the cached grid
        if 1 <= r <= len(grid) and 1 <= c <= len(grid[r - 1]):
            return grid[r - 1][c - 1]
        return ""

    program_code = ""
    for r in range(1, min(5, len(grid)) + 1):
        for c in range(1, min(6, max_col) + 1):
            v = cell(r, c)
            if v and "PROGRAM" in v.upper():
                program_code = v.split(":", 1)[1].strip() if ":" in v else v.upper().replace("PROGRAM", "").strip()
                break
        if program_code:
            break

    # header row = the one containing IDNO and COURSE
    hdr = None
    for r in range(1, min(15, len(grid)) + 1):
        rowvals = [cell(r, c).upper() for c in range(1, max_col + 1)]
        if "IDNO" in rowvals and "COURSE" in rowvals:
            hdr = r
            break
    if not hdr:
        raise ValueError("Could not find the header row (expected an 'IDNO' and 'COURSE' header).")
    sub = hdr + 1

    def find(row, label):
        for c in range(1, max_col + 1):
            if cell(row, c).upper() == label:
                return c
        return None

    idno_c = find(hdr, "IDNO")
    course_c = find(hdr, "COURSE")
    yr_c = find(hdr, "YR")
    note_c = find(hdr, "NOTE")
    sn_c = find(sub, "SN")
    fn_c = find(sub, "FN")
    ay_c = find(sub, "AY ENTRY") or 1
    milestone_cols = {m: find(sub, m) for m in ("TITLE", "PROPOSAL", "ETHICS", "FINAL")}

    stop_cols = [c for c in list(milestone_cols.values()) + [note_c] if c]
    milestone_start = min(stop_cols) if stop_cols else max_col + 1

    subjects = []  # (col, code)
    if yr_c:
        for c in range(yr_c + 1, milestone_start):
            code = cell(sub, c)
            group = cell(hdr, c).upper()
            if not code or code == "-" or code.isdigit() or code.upper() in ("SN", "FN", "TOTAL"):
                continue
            if group == "TOTAL":
                continue
            subjects.append((c, code))

    rows = []
    last_ay = None
    for r in range(sub + 1, len(grid) + 1):
        idno = cell(r, idno_c) if idno_c else ""
        ay_here = cell(r, ay_c) if ay_c else ""
        if ay_here:
            last_ay = ay_here
        if not idno:
            continue
        last = cell(r, sn_c) if sn_c else ""
        first = cell(r, fn_c) if fn_c else ""
        if not last and not first:
            continue
        subj = {code: bool(cell(r, c)) for c, code in subjects}
        milestones = {m: bool(cell(r, mc)) for m, mc in milestone_cols.items() if mc}
        rows.append({
            "idno": idno,
            "last_name": last,
            "first_name": first,
            "course": cell(r, course_c) if course_c else "",
            "year": cell(r, yr_c) if yr_c else "",
            "ay_entry": ay_here or last_ay or "",
            "subjects": subj,
            "milestones": milestones,
            "note": cell(r, note_c) if note_c else "",
        })

    if not program_code:
        program_code = "IMPORT"
    return {"program_code": program_code, "subjects": [s[1] for s in subjects], "rows": rows}


def _stage_from_sheet(milestones: dict, completed_subjects: int) -> str:
    if milestones.get("FINAL"):
        return "Final Defense"
    if milestones.get("ETHICS"):
        return "Data Collection"
    if milestones.get("PROPOSAL"):
        return "Proposal Defense"
    if milestones.get("TITLE"):
        return "Proposal Development"
    if completed_subjects > 0:
        return "Coursework"
    return "Admission"


def import_ac_monitoring(parsed: dict) -> dict:
    program = Program.query.filter_by(code=parsed["program_code"]).first()
    if not program:
        program = Program(code=parsed["program_code"], name=f"{parsed['program_code']} (imported)", college="Imported")
        db.session.add(program)
        db.session.flush()

    # ensure a Course row exists for each subject code on the sheet (for this program)
    course_by_code: dict[str, Course] = {}
    for code in parsed["subjects"]:
        existing = Course.query.filter_by(code=code).first()
        if not existing:
            existing = Course(program_id=program.id, code=code, title=code, units=3)
            db.session.add(existing)
            db.session.flush()
        course_by_code[code] = existing

    term = AcademicTerm.query.order_by(AcademicTerm.start_date.desc()).first()

    created, updated, sample = 0, 0, []
    for row in parsed["rows"]:
        student = Student.query.filter_by(student_number=row["idno"]).first()
        is_new = student is None
        if is_new:
            student = Student(student_number=row["idno"], program_id=program.id, standing="Active")
            db.session.add(student)
        student.first_name = row["first_name"] or student.first_name or "—"
        student.last_name = row["last_name"] or student.last_name or "—"
        student.program_id = program.id
        student.entry_year = _entry_year_from_ay(row["ay_entry"])
        if is_new or not student.email:
            student.email = f"{str(row['idno']).lower()}@student.usls.edu.ph"
        completed = sum(1 for v in row["subjects"].values() if v)
        student.current_stage = _stage_from_sheet(row["milestones"], completed)
        db.session.flush()

        # per-subject course records (real subjects from the sheet)
        for code, done in row["subjects"].items():
            course = course_by_code[code]
            rec = CourseRecord.query.filter_by(student_id=student.id, course_id=course.id).first()
            if not rec:
                rec = CourseRecord(student_id=student.id, course_id=course.id)
                db.session.add(rec)
            rec.status = "Completed" if done else "Missing"
            rec.term_label = row["ay_entry"]
            rec.evidence_reference = "AC Student Monitoring import"
            rec.updated_at = now_utc()

        # onboarding evidence treated as complete (record came from the official sheet)
        if is_new and term:
            db.session.add(TermEnrollment(
                student_id=student.id, term_id=term.id, status="Confirmed",
                source_reference="AC Student Monitoring import"))
            for item in onboarding_requirements():
                db.session.add(DocumentCheck(
                    student_id=student.id, gate="Admission Handoff", item_name=item,
                    status="Complete", evidence_reference="AC Student Monitoring import"))

        add_log("student-handoff", student.id, "GS Staff", "AC Student Monitoring import",
                f"{'Created' if is_new else 'Updated'} from monitoring sheet — {completed}/{len(row['subjects'])} subjects complete",
                "Academic Coordinator",
                f"Program {program.code}; course track {row['course']}; AY entry {row['ay_entry']}.")
        recompute_risk(student)

        if is_new:
            created += 1
        else:
            updated += 1
        if len(sample) < 10:
            sample.append({
                "id": student.id, "name": student.name, "student_number": student.student_number,
                "program_code": program.code, "stage": student.current_stage,
                "completed": completed, "total_subjects": len(row["subjects"]),
            })

    return {
        "ok": True,
        "program": program.code,
        "subjects": len(parsed["subjects"]),
        "rows": len(parsed["rows"]),
        "created": created,
        "updated": updated,
        "sample": sample,
        "message": f"Imported {created + updated} student(s) from the {program.code} monitoring sheet "
                   f"({created} new, {updated} updated).",
    }


# ---------------------------------------------------------------------------
# Transaction handlers (now accept a MultiDict payload from JSON or form)
# ---------------------------------------------------------------------------
def handle_student_handoff(data: MultiDict) -> int:
    # Intake transaction: create the monitoring record, mirror the enrollment
    # signal, compare onboarding evidence, and open a follow-up if anything is missing.
    program = Program.query.get(int(data["program_id"]))
    count = Student.query.count() + 1
    student_number = (data.get("student_number") or "").strip() or f"2026-{count:04d}"
    first_name = data["first_name"].strip()
    last_name = data["last_name"].strip()
    submitted_onboarding = set(data.getlist("onboarding_items"))
    missing_items = [item for item in onboarding_requirements() if item not in submitted_onboarding]
    missing_items.extend(split_items(data.get("additional_missing_items", "")))
    student = Student(
        student_number=student_number,
        first_name=first_name,
        last_name=last_name,
        email=(data.get("email") or "").strip() or f"{student_number.lower()}@student.usls.edu.ph",
        program_id=program.id,
        entry_year=int(data.get("entry_year") or date.today().year),
        current_stage="Admission",
        standing="Active",
        risk_level="Medium" if missing_items else "Low",
    )
    db.session.add(student)
    db.session.flush()

    term = AcademicTerm.query.get(int(data["term_id"]))
    db.session.add(
        TermEnrollment(
            student_id=student.id,
            term_id=term.id,
            status=data["admission_signal"],
            source_reference=data.get("source_reference", ""),
        )
    )

    for item in onboarding_requirements():
        db.session.add(
            DocumentCheck(
                student_id=student.id,
                gate="Admission Handoff",
                item_name=item,
                status="Missing" if item in missing_items else "Complete",
                evidence_reference=data.get("source_reference", ""),
            )
        )

    if missing_items:
        for item in split_items(data.get("additional_missing_items", "")):
            db.session.add(
                DocumentCheck(
                    student_id=student.id,
                    gate="Admission Handoff",
                    item_name=item,
                    status="Missing",
                    evidence_reference=data.get("source_reference", ""),
                )
            )
        add_task(student.id, "Complete admission handoff missing items", "GS Staff", 3, 40)

    add_log(
        "student-handoff",
        student.id,
        "GS Staff",
        data.get("source_reference", ""),
        f"Monitoring record created from {data['admission_signal']}; {len(missing_items)} onboarding item(s) missing",
        "GS Staff",
        f"Program: {program.code}; Compared {len(submitted_onboarding)} received item(s) against "
        f"{len(onboarding_requirements())} required item(s). Missing: "
        f"{', '.join(missing_items) if missing_items else 'None'}",
    )
    return student.id


def handle_leave_of_absence(data: MultiDict) -> int:
    # Stop/pause transaction: record the student's LOA application, document the
    # eligibility check, and mark the student on leave only after Dean approval.
    student = Student.query.get_or_404(int(data["student_id"]))
    dean_action = data.get("dean_action", "Approve")
    source = (data.get("source_reference") or data.get("application_reference") or "").strip()
    application_reference = (data.get("application_reference") or "").strip()
    request_date = (data.get("request_date") or "").strip()
    effective_start = (data.get("effective_start") or "").strip()
    effective_end = (data.get("effective_end") or "").strip()
    reason = (data.get("reason_remarks") or "").strip()
    staff_notes = (data.get("staff_notes") or "").strip()
    prior_loa_count = int(data.get("prior_loa_count") or 0)
    eligibility_status = (data.get("eligibility_status") or "Checked").strip()
    period = " to ".join([part for part in [effective_start, effective_end] if part])
    is_return = dean_action.lower().startswith("return")

    if dean_action == "Approve":
        student.current_stage = "LOA"
        student.standing = "On Leave"
        student.risk_level = "Medium"
        result = "LOA approved; student status set to On Leave"
        if period:
            result = f"{result} for {period}"
        next_owner = "GS Staff"
        status_note = "Graduate School Staff recorded student status as On Leave."
    elif dean_action == "Deny":
        result = "LOA denied; student status unchanged"
        next_owner = "GS Staff"
        student.risk_level = "Medium"
        status_note = f"Graduate School Staff left student status as {student.standing}."
    elif is_return:
        result = "LOA returned for revision; student status unchanged"
        next_owner = "Student"
        student.risk_level = "Medium"
        status_note = f"Graduate School Staff left student status as {student.standing}."
        add_task(student.id, "Revise Leave of Absence application", "Student", 5, 35)
    else:
        result = f"LOA decision recorded: {dean_action}"
        next_owner = "GS Staff"
        status_note = f"Graduate School Staff left student status as {student.standing}."

    notes = [
        f"LOA request recorded from {application_reference or source or 'uploaded application/email'}"
        f"{f' on {request_date}' if request_date else ''}.",
        f"Prior LOA count checked: {prior_loa_count}; eligibility result: {eligibility_status}.",
        "Graduate School Staff forwarded the LOA request to the Dean.",
        f"Dean reviewed the LOA request and sent decision: {dean_action}.",
        status_note,
        "LOA notice sent to the student. This is a stop/pause process for the approved period.",
    ]
    if period:
        notes.append(f"Approved/requested LOA period: {period}.")
    if reason:
        notes.append(f"Reason/remarks: {reason}")
    if staff_notes:
        notes.append(f"Staff notes: {staff_notes}")

    add_log("leave-of-absence", student.id, "GS Staff / Dean", source, result, next_owner, "\n".join(notes))
    return student.id


def handle_readmission(data: MultiDict) -> int:
    # Return/re-entry transaction: record the readmission request and reactivate
    # the student only after the Dean approves the return.
    student = Student.query.get_or_404(int(data["student_id"]))
    dean_action = data.get("dean_action", "Approve")
    source = (data.get("source_reference") or data.get("application_reference") or "").strip()
    application_reference = (data.get("application_reference") or "").strip()
    target_return_term = (data.get("target_return_term") or "").strip()
    previous_loa_period = (data.get("previous_loa_period") or "").strip()
    eligibility_status = (data.get("eligibility_status") or "Checked").strip()
    submitted = set(data.getlist("readmission_items"))
    missing = [item for item in readmission_requirements() if item not in submitted]
    missing.extend(split_items(data.get("missing_requirements", "")))
    staff_notes = (data.get("staff_notes") or "").strip()
    is_return = dean_action.lower().startswith("return")

    if dean_action == "Approve":
        if student.current_stage == "LOA":
            student.current_stage = "Coursework"
        student.standing = "Active"
        student.risk_level = "Low"
        result = "Readmission approved; student status set to Active"
        if target_return_term:
            result = f"{result} for {target_return_term}"
        next_owner = "Academic Coordinator"
        status_note = "Graduate School Staff recorded student status as Active."
        add_task(student.id, "Confirm return-term study plan", "Academic Coordinator", 5, 25)
    elif dean_action == "Deny":
        result = "Readmission denied; student status unchanged"
        next_owner = "GS Staff"
        student.risk_level = "Medium"
        status_note = f"Graduate School Staff left student status as {student.standing}."
    elif is_return:
        result = "Readmission returned for revision; student status unchanged"
        next_owner = "Student"
        student.risk_level = "Medium"
        status_note = f"Graduate School Staff left student status as {student.standing}."
        add_task(student.id, "Complete readmission requirements", "Student", 5, 40)
    else:
        result = f"Readmission decision recorded: {dean_action}"
        next_owner = "GS Staff"
        status_note = f"Graduate School Staff left student status as {student.standing}."

    notes = [
        f"Readmission request recorded from {application_reference or source or 'uploaded application/email'}.",
        f"Eligibility to return checked for {target_return_term or 'the target return term'}: {eligibility_status}.",
        "Graduate School Staff forwarded the readmission request to the Dean.",
        f"Dean reviewed the readmission request and sent decision: {dean_action}.",
        status_note,
        "Readmission notice sent to the student. This is the return/re-entry process after LOA.",
        f"Return checklist submitted: {len(submitted)} item(s); missing: {', '.join(missing) if missing else 'None'}.",
    ]
    if previous_loa_period:
        notes.append(f"Previous LOA period: {previous_loa_period}.")
    if staff_notes:
        notes.append(f"Staff notes: {staff_notes}")

    add_log("readmission", student.id, "GS Staff / Dean", source, result, next_owner, "\n".join(notes))
    return student.id


def handle_course_audit(data: MultiDict) -> int:
    # Coursework transaction: upsert one subject status, then recompute the whole
    # curriculum audit to determine risk and readiness.
    student = Student.query.get_or_404(int(data["student_id"]))
    course = Course.query.get_or_404(int(data["course_id"]))
    status = data["status"]
    existing = CourseRecord.query.filter_by(student_id=student.id, course_id=course.id).first()
    if not existing:
        existing = CourseRecord(student_id=student.id, course_id=course.id)
        db.session.add(existing)
    existing.status = status
    existing.term_label = data.get("term_label", "")
    existing.evidence_reference = data.get("evidence_reference", "")
    existing.updated_at = now_utc()

    audit = compute_course_audit(student)
    if audit["missing_count"] > 0:
        add_task(student.id, "Resolve missing curriculum subjects", "Academic Coordinator", 7, 25)
        student.risk_level = "Medium" if audit["missing_count"] >= 3 else student.risk_level
    if audit["missing_count"] == 0:
        student.current_stage = "Proposal Development"

    add_log(
        "course-audit",
        student.id,
        "Academic Coordinator",
        data.get("evidence_reference", ""),
        f"{course.code} marked {status}; {audit['missing_count']} subject(s) missing",
        "Academic Coordinator",
        "Course audit updated from monitoring signal.",
    )
    return student.id


def handle_research_gate(data: MultiDict) -> int:
    # Research gate transaction: compare submitted evidence against the selected
    # protocol checklist and route missing/revision work to the next owner.
    student = Student.query.get_or_404(int(data["student_id"]))
    gate = data["gate"]
    source = data.get("source_reference", "")
    required_items = required_documents_for_gate(gate)
    package_text = data.get("submitted_package", "")
    submitted_items = {
        item.split("||", 1)[1] for item in data.getlist("submitted_items") if item.startswith(f"{gate}||")
    }
    submitted_items.update(infer_submitted_research_items(gate, package_text))
    missing_items = [item for item in required_items if item not in submitted_items]
    revision_required = data.get("revision_required") == "yes"

    if missing_items:
        result = "Missing Requirements"
        next_owner = "Student"
    elif revision_required:
        result = "Revisions Required"
        next_owner = "Adviser"
    elif gate == "Completion Evidence":
        result = "Verified Complete"
        next_owner = "GS Staff"
    else:
        result = "Ready"
        next_owner = "Research Coordinator"

    research_case = ResearchCase.query.filter_by(student_id=student.id).first()
    if not research_case:
        research_case = ResearchCase(
            student_id=student.id,
            case_type="Dissertation" if "PhD" in student.program.name else "Thesis",
            title=(data.get("research_title") or "").strip() or f"{student.program.code} graduate research case",
            current_gate=gate,
            status=result,
            adviser_name=student.adviser_name,
        )
        db.session.add(research_case)
    else:
        research_case.current_gate = gate
        research_case.status = result
        if data.get("research_title"):
            research_case.title = data["research_title"].strip()

    for item in required_items:
        status = "Missing" if item in missing_items else "Complete"
        existing = DocumentCheck.query.filter_by(student_id=student.id, gate=gate, item_name=item).first()
        if not existing:
            existing = DocumentCheck(student_id=student.id, gate=gate, item_name=item)
            db.session.add(existing)
        existing.status = status
        existing.evidence_reference = source
        existing.updated_at = now_utc()

    if result in ["Missing Requirements", "Revisions Required", "Returned"]:
        add_task(student.id, f"Resolve {gate} requirements", next_owner, 5, 45)
        student.risk_level = "High" if result == "Returned" else "Medium"
    elif gate == "Form 1 - Title Defense" and result == "Ready":
        student.current_stage = "Proposal Development"
    elif gate == "Form 4 - Proposal Defense Readiness" and result == "Ready":
        student.current_stage = "Proposal Defense"
    elif gate == "Completion Evidence" and result == "Verified Complete":
        student.current_stage = "Completed"

    add_log(
        "research-gate",
        student.id,
        "Research Coordinator",
        source,
        f"{gate}: {result}",
        next_owner,
        f"Compared evidence package against {len(required_items)} required item(s). Detected: "
        f"{', '.join(sorted(submitted_items)) if submitted_items else 'None'}. Missing: "
        f"{', '.join(missing_items) if missing_items else 'None'}",
    )
    return student.id


def handle_panel_matching(data: MultiDict) -> int:
    # Panel transaction: replace the current assignment with the highest-scoring
    # faculty recommendations for the student's required panel roles.
    student = Student.query.get_or_404(int(data["student_id"]))
    specialization = (data.get("specialization") or "").strip() or student.program.name
    recommendations = recommend_panel(student, specialization)
    required_roles = panel_roles_for_student(student)

    PanelAssignment.query.filter_by(student_id=student.id).delete()
    for index, row in enumerate(recommendations[: len(required_roles)]):
        db.session.add(
            PanelAssignment(
                student_id=student.id,
                faculty_id=row["faculty"].id,
                panel_role=required_roles[index],
                score=row["score"],
                eligibility_note=row["note"],
            )
        )

    add_log(
        "panel-matching",
        student.id,
        "Research Coordinator",
        data.get("source_reference", ""),
        f"{len(required_roles)}-member {research_case_type(student)} panel matched for {specialization}",
        "Research Coordinator",
        "; ".join(
            [
                f"{required_roles[index]}: {row['faculty'].name} ({row['score']})"
                for index, row in enumerate(recommendations[: len(required_roles)])
            ]
        ),
    )
    add_task(student.id, "Confirm assigned panel acceptance", "Research Coordinator", 3, 30)
    return student.id


def handle_defense_scheduling(data: MultiDict) -> int:
    # Scheduling transaction: confirm only when the assigned panel is complete,
    # enough members are available, and the required lead time is met.
    student = Student.query.get_or_404(int(data["student_id"]))
    preferred_date = parse_date(data["preferred_date"])
    defense_type = data.get("defense_type", "Title Defense")
    mode = data["mode"]
    venue = data.get("venue", "")
    panel = PanelAssignment.query.filter_by(student_id=student.id).all()
    panel_ids = [assignment.faculty_id for assignment in panel]
    required_panel_count = len(panel_roles_for_student(student))
    lead_days = defense_lead_days(defense_type)
    lead_ok = preferred_date >= date.today() + timedelta(days=lead_days)
    matching_slots = (
        FacultyAvailability.query.filter(
            FacultyAvailability.faculty_id.in_(panel_ids),
            FacultyAvailability.available_date == preferred_date,
        ).all()
        if panel_ids
        else []
    )
    matched_count = len({slot.faculty_id for slot in matching_slots})
    enough_panel = len(panel_ids) >= required_panel_count and matched_count >= required_panel_count
    status = "Confirmed" if enough_panel and lead_ok else "Needs Availability"
    status_reason = []
    if not lead_ok:
        status_reason.append(f"{defense_type} needs at least {lead_days} days lead time")
    if len(panel_ids) < required_panel_count:
        status_reason.append(f"{research_case_type(student)} requires {required_panel_count} panel members")
    elif matched_count < required_panel_count:
        status_reason.append(f"only {matched_count} of {required_panel_count} panel members are available")
    schedule = ScheduleRequest(
        student_id=student.id,
        preferred_date=preferred_date,
        mode=mode,
        venue=venue,
        status=status,
        matched_count=matched_count,
        notes=f"{defense_type}; {'; '.join(status_reason) if status_reason else 'all scheduling checks passed'}; "
        f"{data.get('constraints', '')}",
        confirmed_at=now_utc() if status == "Confirmed" else None,
    )
    db.session.add(schedule)

    if status == "Confirmed":
        student.current_stage = "Proposal Defense" if student.current_stage != "Final Defense" else "Final Defense"
        next_owner = "Panel Chair"
    else:
        add_task(student.id, "Collect panel/adviser availability", "Research Coordinator", 2, 50)
        student.risk_level = "Medium"
        next_owner = "Research Coordinator"

    add_log(
        "defense-scheduling",
        student.id,
        "Research Coordinator",
        data.get("source_reference", ""),
        f"{defense_type} schedule {status}; {matched_count}/{required_panel_count} panel availability match(es)",
        next_owner,
        f"{mode}; {venue}; {'; '.join(status_reason) if status_reason else 'lead time and availability passed'}",
    )
    return student.id


TRANSACTION_HANDLERS = {
    "student-handoff": handle_student_handoff,
    "leave-of-absence": handle_leave_of_absence,
    "readmission": handle_readmission,
    "course-audit": handle_course_audit,
    "research-gate": handle_research_gate,
    "panel-matching": handle_panel_matching,
    "defense-scheduling": handle_defense_scheduling,
}


# ---------------------------------------------------------------------------
# Domain rules / helpers
# ---------------------------------------------------------------------------
def split_items(value: str) -> list[str]:
    # Accept either comma-separated or newline-separated checklist additions.
    return [item.strip() for item in value.replace(",", "\n").splitlines() if item.strip()]


def parse_date(value: str | None) -> date:
    if not value:
        return date.today()
    return datetime.strptime(value, "%Y-%m-%d").date()


def required_documents_for_gate(gate: str) -> list[str]:
    # Prototype research protocol checklist. The Research Gate workflow uses
    # these items as the source of truth for missing/complete evidence.
    if gate == "Form 1 - Title Defense":
        return [
            "Form 1 - Application for Title Defense",
            "Three concept papers",
            "Academic Coordinator endorsement/e-signature",
            "Recommended panel set",
        ]
    if gate == "Form 4 - Proposal Defense Readiness":
        return [
            "Form 4 - Endorsement for Proposal Defense",
            "Proposal manuscript",
            "Adviser e-signature/endorsement",
            "Form 4.1 Statistical Consultation Form or qualitative exemption",
            "Agreed defense schedule in Form 4",
        ]
    if gate == "Final Defense":
        return [
            "Form 4 - Endorsement for Final Defense",
            "Final manuscript",
            "Ethics Clearance",
            "Panel received manuscript at least 14 days before defense",
            "Agreed final defense schedule",
        ]
    return [
        "Soft copy of final manuscript",
        "Panel approval emails",
        "Ethics Clearance",
        "Turnitin Certificate with SIR not more than 15%",
        "Form 9 - Editor Certification",
        "Form 10 - Approval Sheet",
    ]


def research_evidence_aliases(gate: str) -> dict[str, list[str]]:
    # Loose aliases let the demo infer checklist items from free-text package
    # notes without requiring exact document names.
    aliases = {
        "Form 1 - Application for Title Defense": ["form 1", "application for title defense"],
        "Three concept papers": ["three concept", "3 concept", "concept papers", "concept paper"],
        "Academic Coordinator endorsement/e-signature": [
            "academic coordinator",
            "ac endorsement",
            "ac e-signature",
            "e-signature",
            "endorsed by ac",
        ],
        "Recommended panel set": ["recommended panel", "panel recommendation", "panel set"],
        "Form 4 - Endorsement for Proposal Defense": ["form 4", "endorsement for proposal"],
        "Proposal manuscript": ["proposal manuscript", "proposal paper", "proposal draft"],
        "Adviser e-signature/endorsement": ["adviser endorsement", "adviser e-signature", "endorsed by adviser"],
        "Form 4.1 Statistical Consultation Form or qualitative exemption": [
            "form 4.1",
            "statistical consultation",
            "qualitative exemption",
            "statistician",
        ],
        "Agreed defense schedule in Form 4": ["agreed schedule", "schedule in form 4", "defense schedule"],
        "Form 4 - Endorsement for Final Defense": ["form 4", "endorsement for final"],
        "Final manuscript": ["final manuscript", "final paper", "closed-door manuscript"],
        "Ethics Clearance": ["ethics clearance", "rerc clearance"],
        "Panel received manuscript at least 14 days before defense": [
            "14-day",
            "14 day",
            "two weeks",
            "panel received manuscript",
        ],
        "Agreed final defense schedule": ["final defense schedule", "agreed final schedule"],
        "Soft copy of final manuscript": ["soft copy", "final manuscript"],
        "Panel approval emails": ["panel approval", "approval emails", "email approval"],
        "Turnitin Certificate with SIR not more than 15%": ["turnitin", "sir", "similarity index"],
        "Form 9 - Editor Certification": ["form 9", "editor certification", "editor's certification"],
        "Form 10 - Approval Sheet": ["form 10", "approval sheet"],
    }
    return {item: aliases.get(item, [item.lower()]) for item in required_documents_for_gate(gate)}


def infer_submitted_research_items(gate: str, package_text: str) -> set[str]:
    text_value = package_text.lower()
    detected = set()
    for item, aliases in research_evidence_aliases(gate).items():
        if any(alias.lower() in text_value for alias in aliases):
            detected.add(item)
    return detected


def research_case_type(student: Student) -> str:
    # Program metadata decides which research track and panel size applies.
    name = student.program.name.lower()
    if "doctor" in name or "phd" in name:
        return "Dissertation"
    if student.program.has_practicum:
        return "Project Paper"
    return "Thesis"


def panel_roles_for_student(student: Student) -> list[str]:
    # Required roles are derived from the case type, then used by panel matching
    # and defense scheduling.
    case_type = research_case_type(student)
    if case_type == "Project Paper":
        return ["Panel Chair", "Content Specialist", "Method Specialist"]
    if case_type == "Dissertation":
        return ["Panel Chair", "Content Specialist 1", "Content Specialist 2", "Method Specialist", "External Panel"]
    return ["Panel Chair", "Content Specialist", "Method Specialist", "External Panel"]


def defense_lead_days(defense_type: str) -> int:
    # Lead-time rule used by scheduling confirmation.
    if defense_type == "Public Final Defense":
        return 5
    return 14


def onboarding_requirements() -> list[str]:
    # Intake checklist for creating a complete Graduate School monitoring record.
    return [
        "Admission approval",
        "Student profile sheet",
        "Program assignment",
        "Enrollment signal",
        "Official transcript",
    ]


def readmission_requirements() -> list[str]:
    # Return checklist for moving a student from LOA back to active monitoring.
    return [
        "Return intent letter",
        "Updated study plan",
        "Program/adviser endorsement",
        "No pending accountability",
    ]


def compute_course_audit(student: Student) -> dict:
    # Builds the student's curriculum picture from required program subjects and
    # recorded subject statuses.
    required_courses = Course.query.filter_by(program_id=student.program_id).order_by(Course.code).all()
    records = {record.course_id: record for record in CourseRecord.query.filter_by(student_id=student.id).all()}
    completed = []
    current = []
    missing = []
    incomplete = []

    for course in required_courses:
        record = records.get(course.id)
        status = record.status if record else "Missing"
        row = {"course": course, "record": record, "status": status}
        if status == "Completed":
            completed.append(row)
        elif status in ["Current", "Enrolled"]:
            current.append(row)
        elif status in ["Incomplete", "Dropped"]:
            incomplete.append(row)
        else:
            missing.append(row)

    return {
        "required_count": len(required_courses),
        "completed": completed,
        "current": current,
        "missing": missing,
        "incomplete": incomplete,
        "missing_count": len(missing) + len(incomplete),
        "completion_rate": round((len(completed) / len(required_courses)) * 100, 1) if required_courses else 0,
    }


def compute_offering_demand() -> list[dict]:
    # Planning helper: counts which missing subjects appear most often among
    # active students, useful for course offering discussions.
    demand: dict[int, dict] = {}
    students = Student.query.filter(Student.standing == "Active").limit(500).all()
    for student in students:
        audit = compute_course_audit(student)
        for row in audit["missing"][:4]:
            course = row["course"]
            if course.id not in demand:
                demand[course.id] = {"course": course, "count": 0, "students": []}
            demand[course.id]["count"] += 1
            demand[course.id]["students"].append(student)
    return sorted(demand.values(), key=lambda item: item["count"], reverse=True)[:12]


def recommend_panel(student: Student, specialization: str) -> list[dict]:
    # Scoring model for the demo: same college, specialization match, upcoming
    # availability, and lower current workload all improve the recommendation.
    specialization = specialization.lower().strip()
    faculty_members = Faculty.query.filter_by(active=True).all()
    rows = []
    for faculty in faculty_members:
        workload = PanelAssignment.query.filter_by(faculty_id=faculty.id).count()
        availability_count = FacultyAvailability.query.filter(
            FacultyAvailability.faculty_id == faculty.id,
            FacultyAvailability.available_date >= date.today(),
        ).count()
        score = 40
        if student.program.college == faculty.college:
            score += 20
        if specialization and specialization in faculty.specialization.lower():
            score += 35
        elif any(word in faculty.specialization.lower() for word in specialization.split() if len(word) > 3):
            score += 15
        score += min(20, availability_count * 4)
        score -= workload * 3
        reasons = []
        if student.program.college == faculty.college:
            reasons.append("same college")
        if specialization and specialization in faculty.specialization.lower():
            reasons.append("matching expertise")
        elif any(word in faculty.specialization.lower() for word in specialization.split() if len(word) > 3):
            reasons.append("related expertise")
        if availability_count:
            reasons.append(f"{availability_count} available dates")
        if workload <= 1:
            reasons.append("low current panel load")
        note = ", ".join(reasons) if reasons else "available for review"
        rows.append({"faculty": faculty, "score": max(score, 1), "note": note})
    return sorted(rows, key=lambda row: row["score"], reverse=True)


# ---------------------------------------------------------------------------
# Database reset + seed
# ---------------------------------------------------------------------------
def reset_database() -> None:
    # MySQL requires temporarily disabling FK checks before dropping related tables.
    if is_mysql(db.engine.url.render_as_string(hide_password=True)):
        db.session.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        db.drop_all()
        db.session.execute(text("SET FOREIGN_KEY_CHECKS=1"))
        db.session.commit()
    else:
        db.drop_all()
    db.create_all()


def seed_database(count: int = 350) -> None:
    # Deterministic seed data keeps demos repeatable while still showing varied
    # stages, risks, documents, panels, schedules, and activity history.
    reset_database()
    random.seed(20260603)

    program_specs = [
        ("MSCS", "Master of Science in Computer Science", "Engineering and Technology", False),
        ("MIT", "Master in Information Technology", "Engineering and Technology", False),
        ("MBA", "Master of Business Administration", "Business", False),
        ("DBA", "Doctor of Business Administration", "Business", False),
        ("MAED", "Master of Arts in Education", "Education", True),
        ("EDD", "Doctor of Education", "Education", True),
        ("MSN", "Master of Science in Nursing", "Nursing", True),
        ("MAN", "Master of Arts in Nursing", "Nursing", True),
        ("MAPSY", "Master of Arts in Psychology", "Arts and Sciences", False),
        ("MASS", "Master of Arts in Social Sciences", "Arts and Sciences", False),
    ]
    programs = []
    for code, name, college, practicum in program_specs:
        program = Program(code=code, name=name, college=college, has_practicum=practicum)
        db.session.add(program)
        programs.append(program)
    db.session.flush()

    terms = []
    for label, start in [
        ("AY 2024-2025 Term 1", date(2024, 8, 1)),
        ("AY 2024-2025 Term 2", date(2025, 1, 10)),
        ("AY 2025-2026 Term 1", date(2025, 8, 1)),
        ("AY 2025-2026 Term 2", date(2026, 1, 10)),
        ("AY 2026-2027 Term 1", date(2026, 8, 1)),
    ]:
        term = AcademicTerm(label=label, start_date=start, end_date=start + timedelta(days=120))
        db.session.add(term)
        terms.append(term)

    course_titles = [
        "Research Methods",
        "Advanced Seminar",
        "Statistics for Graduate Studies",
        "Program Core I",
        "Program Core II",
        "Special Topics",
        "Thesis/Dissertation Writing",
        "Practicum/Field Application",
    ]
    for program in programs:
        for idx, title in enumerate(course_titles, start=1):
            db.session.add(
                Course(
                    program_id=program.id,
                    code=f"{program.code}-{500 + idx}",
                    title=f"{title} ({program.code})",
                    units=3,
                    recommended_term=f"Year {1 if idx <= 4 else 2}",
                )
            )

    specializations = [
        "analytics and information systems",
        "educational leadership and curriculum",
        "business strategy and operations",
        "nursing practice and health systems",
        "psychology and social research",
        "engineering systems and optimization",
        "statistics and research design",
        "ethics review and technical writing",
    ]
    for idx in range(1, 56):
        college = COLLEGES[idx % len(COLLEGES)]
        faculty = Faculty(
            name=f"Dr. Faculty {idx:02d}",
            college=college,
            role="Adviser / Panel",
            specialization=specializations[idx % len(specializations)],
            active=True,
        )
        db.session.add(faculty)
        db.session.flush()
        for offset in range(1, 8):
            if (idx + offset) % 3 != 0:
                db.session.add(
                    FacultyAvailability(
                        faculty_id=faculty.id,
                        available_date=date.today() + timedelta(days=offset * 3 + (idx % 4)),
                        start_time=time(9 + (idx % 3), 0),
                        end_time=time(11 + (idx % 3), 0),
                    )
                )

    first_names = [
        "Ana", "Ben", "Carla", "Daniel", "Elise", "Francis", "Grace", "Hector", "Irene", "Jon",
        "Miguel", "Patricia", "Ramon", "Lara", "Joshua", "Nicole", "Martin", "Camille", "Rafael", "Bianca",
        "Adrian", "Clarisse", "Diane", "Enrico", "Fatima", "Gian", "Hazel", "Isabel", "Jerome", "Katrina",
    ]
    last_names = [
        "Santos", "Reyes", "Tan", "Uy", "Co", "Lim", "Ong", "Yu", "Flores", "Pang",
        "Alvarez", "Bautista", "Cabrera", "Delos Reyes", "Escobar", "Fernandez", "Garcia", "Hernandez",
        "Mendoza", "Villanueva", "Abad", "Bernardo", "Chua", "Dizon", "Evangelista", "Francisco",
        "Gonzales", "Jacinto", "Lacson", "Navarro",
    ]
    name_pairs = [(first, last) for first in first_names for last in last_names]
    random.shuffle(name_pairs)
    if count > len(name_pairs):
        raise ValueError(
            f"Seed count {count} exceeds the {len(name_pairs)} unique generated student names available."
        )
    stage_weights = [
        "Admission",
        "Coursework",
        "Coursework",
        "Proposal Development",
        "Proposal Defense",
        "Data Collection",
        "Writing",
        "Final Defense",
        "LOA",
        "Completed",
    ]

    db.session.flush()
    courses_by_program = {program.id: Course.query.filter_by(program_id=program.id).all() for program in programs}
    faculty_list = Faculty.query.all()

    for idx in range(1, count + 1):
        # Each generated student receives enough related records to exercise the
        # dashboards, student detail view, work queue, and workflow context screens.
        program = programs[idx % len(programs)]
        stage = random.choice(stage_weights)
        risk = "High" if idx % 17 == 0 else "Medium" if idx % 5 == 0 or stage == "LOA" else "Low"
        standing = "On Leave" if stage == "LOA" else "Completed" if stage == "Completed" else "Active"
        first_name, last_name = name_pairs[idx - 1]
        student = Student(
            student_number=f"GS-2026-{idx:04d}",
            first_name=first_name,
            last_name=last_name,
            email=f"gs-{idx:04d}@student.usls.edu.ph",
            program_id=program.id,
            entry_year=2022 + (idx % 5),
            current_stage=stage,
            standing=standing,
            risk_level=risk,
            adviser_name=random.choice(faculty_list).name,
        )
        db.session.add(student)
        db.session.flush()

        db.session.add(
            TermEnrollment(
                student_id=student.id,
                term_id=random.choice(terms).id,
                status="Confirmed" if standing != "On Leave" else "On Hold",
                source_reference=f"AIMS batch {idx % 12}",
                confirmed_at=now_utc() - timedelta(days=random.randint(5, 240)),
            )
        )

        program_courses = courses_by_program[program.id]
        complete_cutoff = random.randint(2, len(program_courses))
        for course_index, course in enumerate(program_courses):
            if stage in ["Admission", "LOA"] and course_index > 2:
                continue
            status = (
                "Completed"
                if course_index < complete_cutoff
                else "Current"
                if course_index == complete_cutoff
                else "Missing"
            )
            if idx % 13 == 0 and course_index == 1:
                status = "Incomplete"
            db.session.add(
                CourseRecord(
                    student_id=student.id,
                    course_id=course.id,
                    status=status,
                    term_label=random.choice(terms).label,
                    evidence_reference=f"Monitoring sheet row {idx}",
                )
            )

        if stage not in ["Admission", "Coursework", "LOA"]:
            case = ResearchCase(
                student_id=student.id,
                case_type="Dissertation" if "Doctor" in program.name else "Thesis",
                title=f"{program.code} graduate research topic {idx}",
                current_gate=random.choice(
                    ["Form 1 - Title Defense", "Form 4 - Proposal Defense Readiness", "Final Defense"]
                ),
                status=random.choice(["Ready", "Missing Requirements", "Revisions Required", "Verified Complete"]),
                adviser_name=student.adviser_name,
                opened_at=now_utc() - timedelta(days=random.randint(10, 180)),
            )
            db.session.add(case)
            for gate in ["Form 1 - Title Defense", "Form 4 - Proposal Defense Readiness"]:
                for item in required_documents_for_gate(gate):
                    db.session.add(
                        DocumentCheck(
                            student_id=student.id,
                            gate=gate,
                            item_name=item,
                            status="Missing" if idx % 11 == 0 and "manuscript" in item.lower() else "Complete",
                            evidence_reference=f"Research monitoring file {idx}",
                        )
                    )

        if idx % 4 == 0:
            add_task(
                student.id,
                random.choice([
                    "Verify submitted requirements",
                    "Follow up on the adviser's decision",
                    "Request the missing document",
                    "Route the case to the next reviewer",
                    "Check the student's readiness to advance",
                ]),
                "GS Staff",
                random.randint(-5, 10),
                random.randint(15, 60),
                "Overdue" if idx % 12 == 0 else "Pending",
            )
        if idx % 6 == 0:
            top_panel = random.sample(faculty_list, 3)
            for panel_index, faculty in enumerate(top_panel):
                db.session.add(
                    PanelAssignment(
                        student_id=student.id,
                        faculty_id=faculty.id,
                        panel_role="Chair" if panel_index == 0 else "Panel Member",
                        score=random.randint(55, 95),
                        eligibility_note=f"{faculty.specialization}; generated assignment",
                    )
                )
        if idx % 8 == 0:
            db.session.add(
                ScheduleRequest(
                    student_id=student.id,
                    preferred_date=date.today() + timedelta(days=random.randint(3, 30)),
                    mode=random.choice(["On-site", "Online", "Hybrid"]),
                    venue=random.choice(["GS Conference Room", "Zoom", "LRC Seminar Room"]),
                    status=random.choice(["Confirmed", "Needs Availability", "Rescheduled"]),
                    matched_count=random.randint(1, 3),
                    notes="Generated defense scheduling case.",
                    confirmed_at=now_utc() if idx % 16 != 0 else None,
                )
            )

        if idx % 3 == 0:
            add_log(
                random.choice([item["slug"] for item in TRANSACTIONS]),
                student.id,
                "Demo Data",
                f"Generated source {idx}",
                "Demo monitoring history",
                random.choice(["GS Staff", "Academic Coordinator", "Research Coordinator", "Student"]),
                "Generated background history for the demo dataset.",
            )

    db.session.commit()

    # Derive each student's risk/priority from the same signals the Decision Support
    # engine uses, so the student record and the recommendation queue always agree.
    for student in Student.query.all():
        recompute_risk(student)
    ensure_demo_accounts()
    db.session.commit()


def ensure_demo_accounts() -> None:
    staff = UserAccount.query.filter_by(email="staff@gs.local").first()
    if not staff:
        db.session.add(
            UserAccount(
                email="staff@gs.local",
                full_name="Graduate School Staff Demo",
                password_hash=generate_password_hash("DemoPass123!"),
                role="staff",
                active=True,
            )
        )

    linked_student = Student.query.order_by(Student.student_number.asc()).first()
    if linked_student:
        student_account = UserAccount.query.filter_by(email="student@gs.local").first()
        if not student_account:
            student_account = UserAccount(
                email="student@gs.local",
                full_name=f"{linked_student.name} Demo",
                password_hash=generate_password_hash("DemoPass123!"),
                role="student",
                active=True,
            )
            db.session.add(student_account)
        student_account.student_id = linked_student.id
        student_account.full_name = f"{linked_student.name} Demo"


app = create_app()


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        seed_count = int(os.getenv("DEMO_SEED_COUNT", "350"))
        if "--seed" in sys.argv:
            seed_database(seed_count)
            print(f"Seeded {seed_count} students plus supporting workflow data.")
            raise SystemExit(0)
        if Student.query.count() == 0:
            seed_database(seed_count)
            print(f"Database was empty, so {seed_count} demo students were seeded.")
        if UserAccount.query.count() == 0:
            ensure_demo_accounts()
            db.session.commit()
            print("Demo staff and student accounts were created.")

    port = int(os.getenv("FLASK_PORT", "5000"))
    print(f"USLS Graduate School platform running at http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
