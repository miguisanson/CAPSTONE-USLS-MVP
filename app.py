from __future__ import annotations

import os
import random
import re
import shutil
import sys
import json
import csv
import io
import html
import threading
from collections import Counter
from functools import wraps
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import quote_plus, urlparse
from uuid import uuid4

from dotenv import load_dotenv
from flask import Flask, Response, has_request_context, jsonify, request, send_from_directory, session
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func, inspect, or_, text
from werkzeug.datastructures import MultiDict
from werkzeug.utils import secure_filename
from werkzeug.security import check_password_hash
from werkzeug.security import generate_password_hash as _werkzeug_generate_password_hash


def generate_password_hash(password, method="pbkdf2:sha256", salt_length=16):
    # Default to pbkdf2 so hashing works on Python builds without hashlib.scrypt
    # (e.g. Apple's system Python 3.9 on macOS).
    return _werkzeug_generate_password_hash(password, method=method, salt_length=salt_length)


load_dotenv()

db = SQLAlchemy()

FRONTEND_DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", "dist")
UPLOAD_ROOT = Path(os.path.dirname(os.path.abspath(__file__))) / "uploads" / "research_evidence"
REQUEST_UPLOAD_ROOT = Path(os.path.dirname(os.path.abspath(__file__))) / "uploads" / "student_requests"
MONITORING_UPLOAD_ROOT = Path(os.path.dirname(os.path.abspath(__file__))) / "uploads" / "monitoring_sheets"
BASE_DIR = Path(os.path.dirname(os.path.abspath(__file__)))
RAG_DOCUMENT_PATHS = [
    BASE_DIR / "data",
    BASE_DIR / "Documents" / "USLS_Documents",
]
CONCEPT_PAPER_RAG_SOURCE = BASE_DIR / "Documents" / "RAG_Source" / "Concept_Paper"
_RAG_CHAT_ENGINE = None
_RAG_LOAD_ERROR = None
PDF_OCR_MIN_WORDS = int(os.getenv("PDF_OCR_MIN_WORDS", "30"))
PDF_OCR_MAX_PAGES = int(os.getenv("PDF_OCR_MAX_PAGES", "8"))
PDF_OCR_DPI = int(os.getenv("PDF_OCR_DPI", "200"))

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
        "data": "Student profile, admission/enrollment signal, program, semester, source reference, timestamp, initial status.",
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
        "data": "Application reference, target return semester, previous LOA period, return eligibility, missing requirements, Dean decision, status update, notice.",
    },
    {
        "slug": "awol",
        "priority": "P0",
        "title": "AWOL & Residency",
        "icon": "user-x",
        "group": "Standing",
        "short": "Declare AWOL, review written return intent under maximum-residence rules, and record valid residency enrollment without subjects.",
        "actor": "Student / GS Staff / Dean / Academic Coordinator",
        "data": "AWOL effective date, return-intent letter, years in program, residence classification, refresher or re-enrollment requirement, residency reason, Dean decision, and notices.",
    },
    {
        "slug": "course-audit",
        "priority": "P1",
        "title": "Course Audit",
        "icon": "clipboard-check",
        "group": "Coursework",
        "short": "Map completed, current, and missing subjects to curriculum requirements.",
        "actor": "Academic Coordinator / GS Staff",
        "data": "Taken/current/missing subjects, academic year/semester, evidence reference, audit result, offering demand.",
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
    {
        "slug": "practicum",
        "priority": "P1",
        "title": "Practicum",
        "icon": "briefcase-business",
        "group": "Completion",
        "short": "Track practicum MOA receipt, hours, certificates, completion report, and Dean review for practicum programs.",
        "actor": "Student / GS Staff / Academic Coordinator / Dean",
        "data": "MOA status, practicum site, required/completed hours, certificates, document status, remarks, status report.",
    },
    {
        "slug": "withdrawal",
        "priority": "P0",
        "title": "Withdrawal Application",
        "icon": "log-out",
        "group": "Standing",
        "short": "Record withdrawal requests, route Dean decisions, verify requirements and fees, then close approved withdrawals.",
        "actor": "Student / GS Staff / Dean / Academic Coordinator / Registrar",
        "data": "Reason, effective semester, forms and proof, fee/requirement status, Dean decision, coordinator and registrar remarks.",
    },
    {
        "slug": "graduation",
        "priority": "P0",
        "title": "Graduation Endorsement",
        "icon": "graduation-cap",
        "group": "Completion",
        "short": "Review candidate eligibility across coursework, research, practicum, Dean endorsement, and Registrar handoff.",
        "actor": "GS Staff / Academic Coordinator / Research Coordinator / Dean / Registrar",
        "data": "Review semester, candidate, coursework/research/practicum status, missing items, endorsement status, Dean and Registrar notes.",
    },
]

TRANSACTION_BY_SLUG = {item["slug"]: item for item in TRANSACTIONS}

# Ordered lifecycle labels used by the student detail timeline and dashboard.
STAGES = [
    "Admission",
    "Coursework",
    "Comprehensive Exam",
    "Proposal Development",
    "Proposal Defense",
    "Data Collection",
    "Writing",
    "Final Defense",
    "LOA",
    "AWOL",
    "Withdrawal In Progress",
    "Withdrawn",
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
    # Current-term enrollment tag (per AC notes): Enrolled / LOA / AWOL / Completed.
    enrollment_tag = db.Column(db.String(20), nullable=False, default="Enrolled")
    comprehensive_exam_status = db.Column(db.String(30), nullable=False, default="Not Taken")
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
    practicum_records = db.relationship("PracticumRecord", backref="student", lazy=True, cascade="all, delete-orphan")
    withdrawal_applications = db.relationship("WithdrawalApplication", backref="student", lazy=True, cascade="all, delete-orphan")
    graduation_endorsements = db.relationship("GraduationEndorsement", backref="student", lazy=True, cascade="all, delete-orphan")
    workflow_messages = db.relationship("WorkflowMessage", backref="student", lazy=True, cascade="all, delete-orphan")

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
    faculty_id = db.Column(db.Integer, db.ForeignKey("faculty.id"))
    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=now_utc)

    student = db.relationship("Student")
    faculty = db.relationship("Faculty")


class AcademicTerm(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    label = db.Column(db.String(40), unique=True, nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    is_active_planning_term = db.Column(db.Boolean, default=False)
    planning_window_open = db.Column(db.Date)
    planning_window_close = db.Column(db.Date)
    grade_submission_deadline = db.Column(db.Date)
    status = db.Column(db.String(20))


class Course(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    program_id = db.Column(db.Integer, db.ForeignKey("program.id"), nullable=False)
    code = db.Column(db.String(40), unique=True, nullable=False)
    title = db.Column(db.String(160), nullable=False)
    units = db.Column(db.Integer, default=3)
    recommended_term = db.Column(db.String(40), default="Year 1")
    category = db.Column(db.String(40), default="Core")  # Basic / Major / Cognate (from monitoring sheet groups)


class CourseOfferingPlan(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    program_id = db.Column(db.Integer, db.ForeignKey("program.id"), nullable=False)
    term_label = db.Column(db.String(60), nullable=False)
    status = db.Column(db.String(40), nullable=False, default="Draft")
    notes = db.Column(db.String(260))
    created_at = db.Column(db.DateTime, default=now_utc)
    updated_at = db.Column(db.DateTime, default=now_utc, onupdate=now_utc)
    submitted_at = db.Column(db.DateTime)
    approved_at = db.Column(db.DateTime)
    approved_by = db.Column(db.String(120))  # the account that approved (by role, not hardcoded)
    published_at = db.Column(db.DateTime)
    target_term_id = db.Column(db.Integer, db.ForeignKey("academic_term.id"))
    reference_term_id = db.Column(db.Integer, db.ForeignKey("academic_term.id"))

    program = db.relationship("Program")
    target_term = db.relationship("AcademicTerm", foreign_keys=[target_term_id])
    reference_term = db.relationship("AcademicTerm", foreign_keys=[reference_term_id])
    offerings = db.relationship("CourseOffering", backref="plan", lazy=True, cascade="all, delete-orphan")


class CourseOffering(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    plan_id = db.Column(db.Integer, db.ForeignKey("course_offering_plan.id"), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)
    demand_count = db.Column(db.Integer, default=0)
    section_count = db.Column(db.Integer, default=0)
    availability_count = db.Column(db.Integer, default=0)
    status = db.Column(db.String(40), nullable=False, default="Suggested")
    notes = db.Column(db.String(220))

    course = db.relationship("Course")


class CurriculumOffering(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    program_id = db.Column(db.Integer, db.ForeignKey("program.id"), nullable=False)
    academic_year = db.Column(db.String(20), nullable=False)
    semester = db.Column(db.String(20), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)
    added_by = db.Column(db.String(160))
    created_at = db.Column(db.DateTime, default=now_utc)
    updated_at = db.Column(db.DateTime, default=now_utc, onupdate=now_utc)

    program = db.relationship("Program")
    course = db.relationship("Course")


# Term-level enrollment signal copied from an institutional source such as AIMS.
class TermEnrollment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    term_id = db.Column(db.Integer, db.ForeignKey("academic_term.id"), nullable=False)
    status = db.Column(db.String(40), nullable=False)
    source_reference = db.Column(db.String(160))
    confirmed_at = db.Column(db.DateTime, default=now_utc)

    term = db.relationship("AcademicTerm")


class SubjectEnrollment(db.Model):
    """Durable student-to-subject enrollment for one academic semester.

    CourseRecord remains the monitoring/profile projection used throughout the
    existing app. This table preserves the semester-level enrollment history so
    adding a class in a later semester never erases the earlier transaction.
    """

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)
    term_id = db.Column(db.Integer, db.ForeignKey("academic_term.id"), nullable=False)
    status = db.Column(db.String(40), nullable=False, default="Enrolled")
    source_reference = db.Column(db.String(160))
    conflict_override = db.Column(db.Text)
    enrolled_at = db.Column(db.DateTime, default=now_utc, nullable=False)
    cancelled_at = db.Column(db.DateTime)
    updated_at = db.Column(db.DateTime, default=now_utc, onupdate=now_utc)

    student = db.relationship("Student")
    course = db.relationship("Course")
    term = db.relationship("AcademicTerm")

    __table_args__ = (
        db.UniqueConstraint(
            "student_id",
            "course_id",
            "term_id",
            name="uq_subject_enrollment_student_course_term",
        ),
    )


class AwolCase(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    status = db.Column(db.String(80), nullable=False, default="AWOL Declared")
    awol_effective_date = db.Column(db.Date)
    last_enrolled_term = db.Column(db.String(80))
    return_requested_at = db.Column(db.DateTime)
    target_return_term = db.Column(db.String(80))
    intent_attachment_id = db.Column(db.Integer, db.ForeignKey("student_request_attachment.id"))
    years_in_program = db.Column(db.Integer)
    normal_residence_years = db.Column(db.Integer)
    absolute_residence_years = db.Column(db.Integer)
    policy_classification = db.Column(db.String(100))
    refresher_required = db.Column(db.Boolean, default=False)
    full_reenrollment_required = db.Column(db.Boolean, default=False)
    dean_decision = db.Column(db.String(40), nullable=False, default="Not Submitted")
    staff_notes = db.Column(db.Text)
    decided_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=now_utc)
    updated_at = db.Column(db.DateTime, default=now_utc, onupdate=now_utc)

    student = db.relationship("Student")
    intent_attachment = db.relationship("StudentRequestAttachment")


class ResidencyEnrollment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    term_id = db.Column(db.Integer, db.ForeignKey("academic_term.id"), nullable=False)
    reason = db.Column(db.String(100), nullable=False)
    policy_status = db.Column(db.String(80), nullable=False)
    status = db.Column(db.String(40), nullable=False, default="Active")
    staff_notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=now_utc)
    ended_at = db.Column(db.DateTime)
    updated_at = db.Column(db.DateTime, default=now_utc, onupdate=now_utc)

    student = db.relationship("Student")
    term = db.relationship("AcademicTerm")


# Monitoring copy of a student's subject status against the program curriculum.
class CourseRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)
    status = db.Column(db.String(40), nullable=False)
    term_label = db.Column(db.String(40))
    evidence_reference = db.Column(db.String(160))
    grade_value = db.Column(db.String(40))
    grade_status = db.Column(db.String(40), nullable=False, default="No Grade")
    incomplete_deadline = db.Column(db.Date)
    resolved_at = db.Column(db.DateTime)
    remarks = db.Column(db.Text)
    updated_at = db.Column(db.DateTime, default=now_utc)

    course = db.relationship("Course")


class MonitoringSheetUpload(db.Model):
    """Immutable backup and comparison result for every monitoring-sheet upload."""
    id = db.Column(db.Integer, primary_key=True)
    original_name = db.Column(db.String(220), nullable=False)
    stored_name = db.Column(db.String(220), nullable=False, unique=True)
    program_code = db.Column(db.String(30), nullable=False)
    row_count = db.Column(db.Integer, default=0)
    subject_count = db.Column(db.Integer, default=0)
    snapshot_json = db.Column(db.Text, nullable=False)
    result_json = db.Column(db.Text, nullable=False)
    uploaded_at = db.Column(db.DateTime, default=now_utc, nullable=False)


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

    evidence_files = db.relationship(
        "ResearchEvidenceFile",
        backref="document_check",
        lazy=True,
        cascade="all, delete-orphan",
    )


# Student-uploaded research evidence. Checklist status is derived from these
# rows so staff cannot mark a document as received when no file exists.
class ResearchEvidenceFile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    document_check_id = db.Column(db.Integer, db.ForeignKey("document_check.id"), nullable=False)
    original_name = db.Column(db.String(220), nullable=False)
    stored_name = db.Column(db.String(220), nullable=False, unique=True)
    mime_type = db.Column(db.String(100), nullable=False, default="application/pdf")
    extracted_text = db.Column(db.Text)
    compliance_status = db.Column(db.String(40))
    compliance_score = db.Column(db.Integer)
    compliance_summary = db.Column(db.Text)
    compliance_result_json = db.Column(db.Text)
    uploaded_at = db.Column(db.DateTime, default=now_utc)


class Form1Endorsement(db.Model):
    """Academic Coordinator sign-off for the student's Form 1 submission."""
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False, unique=True)
    coordinator_name = db.Column(db.String(160), nullable=False)
    signature_data = db.Column(db.Text)
    status = db.Column(db.String(40), nullable=False, default="Endorsed")
    endorsed_at = db.Column(db.DateTime, default=now_utc, nullable=False)

    student = db.relationship("Student")


class AdviserDocumentApproval(db.Model):
    """In-system adviser signature for a specific uploaded research paper."""
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    evidence_file_id = db.Column(db.Integer, db.ForeignKey("research_evidence_file.id"), nullable=False, unique=True)
    faculty_id = db.Column(db.Integer, db.ForeignKey("faculty.id"), nullable=False)
    adviser_name = db.Column(db.String(160), nullable=False)
    student_name = db.Column(db.String(160), nullable=False)
    document_name = db.Column(db.String(220), nullable=False)
    signature_data = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(40), nullable=False, default="Signed")
    signed_at = db.Column(db.DateTime, default=now_utc, nullable=False)

    student = db.relationship("Student")
    evidence_file = db.relationship("ResearchEvidenceFile")
    faculty = db.relationship("Faculty")


class StudentRequestAttachment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    request_type = db.Column(db.String(60), nullable=False)
    workflow_request_id = db.Column(db.Integer)
    workflow_stage = db.Column(db.String(100))
    uploaded_by_user_id = db.Column(db.Integer, db.ForeignKey("user_account.id"))
    uploaded_by_name = db.Column(db.String(160))
    uploaded_by_role = db.Column(db.String(80))
    original_name = db.Column(db.String(220), nullable=False)
    stored_name = db.Column(db.String(220), nullable=False, unique=True)
    mime_type = db.Column(db.String(100), nullable=False, default="application/pdf")
    uploaded_at = db.Column(db.DateTime, default=now_utc)


class PracticumRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    moa_status = db.Column(db.String(60), nullable=False, default="Pending Review")
    moa_uploaded = db.Column(db.Boolean, default=False)
    practicum_site = db.Column(db.String(180))
    supervisor_name = db.Column(db.String(160))
    required_hours = db.Column(db.Integer, default=0)
    completed_hours = db.Column(db.Integer, default=0)
    document_status = db.Column(db.String(60), nullable=False, default="Missing")
    certificate_count = db.Column(db.Integer, default=0)
    remarks = db.Column(db.Text)
    completion_status = db.Column(db.String(80), nullable=False, default="Pending")
    status = db.Column(db.String(80), nullable=False, default="MOA Received")
    moa_attachment_id = db.Column(db.Integer, db.ForeignKey("student_request_attachment.id"))
    certificate_attachment_id = db.Column(db.Integer, db.ForeignKey("student_request_attachment.id"))
    report_sent_at = db.Column(db.DateTime)
    dean_reviewed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=now_utc)
    updated_at = db.Column(db.DateTime, default=now_utc, onupdate=now_utc)

    moa_attachment = db.relationship("StudentRequestAttachment", foreign_keys=[moa_attachment_id])
    certificate_attachment = db.relationship("StudentRequestAttachment", foreign_keys=[certificate_attachment_id])


class WithdrawalApplication(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    reason = db.Column(db.Text)
    effective_term = db.Column(db.String(80))
    request_attachment_id = db.Column(db.Integer, db.ForeignKey("student_request_attachment.id"))
    proof_attachment_id = db.Column(db.Integer, db.ForeignKey("student_request_attachment.id"))
    fee_status = db.Column(db.String(40), nullable=False, default="Pending")
    requirement_status = db.Column(db.String(40), nullable=False, default="Pending")
    dean_decision = db.Column(db.String(40), nullable=False, default="Pending")
    staff_remarks = db.Column(db.Text)
    academic_coordinator_remarks = db.Column(db.Text)
    registrar_status = db.Column(db.String(80), nullable=False, default="Pending")
    status = db.Column(db.String(80), nullable=False, default="Dean Review")
    decided_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=now_utc)
    updated_at = db.Column(db.DateTime, default=now_utc, onupdate=now_utc)

    request_attachment = db.relationship("StudentRequestAttachment", foreign_keys=[request_attachment_id])
    proof_attachment = db.relationship("StudentRequestAttachment", foreign_keys=[proof_attachment_id])


class CourseDropRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)
    term_label = db.Column(db.String(80))
    reason = db.Column(db.Text)
    attachment_id = db.Column(db.Integer, db.ForeignKey("student_request_attachment.id"))
    status = db.Column(db.String(60), nullable=False, default="Submitted")
    reviewer_remarks = db.Column(db.Text)
    decided_by = db.Column(db.String(160))
    decided_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=now_utc)
    updated_at = db.Column(db.DateTime, default=now_utc, onupdate=now_utc)

    student = db.relationship("Student")
    course = db.relationship("Course")
    attachment = db.relationship("StudentRequestAttachment")


class GraduationEndorsement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    review_window = db.Column(db.String(80), nullable=False, default="Current review window")
    batch_name = db.Column(db.String(120))
    coursework_status = db.Column(db.String(60), nullable=False, default="Pending")
    research_status = db.Column(db.String(60), nullable=False, default="Pending")
    practicum_status = db.Column(db.String(60), nullable=False, default="Not Required")
    missing_coursework = db.Column(db.Text)
    missing_research_requirements = db.Column(db.Text)
    missing_practicum_requirement = db.Column(db.Text)
    endorsement_status = db.Column(db.String(80), nullable=False, default="For Review")
    dean_remarks = db.Column(db.Text)
    registrar_status = db.Column(db.String(80), nullable=False, default="Pending")
    request_attachment_id = db.Column(db.Integer, db.ForeignKey("student_request_attachment.id"))
    submitted_at = db.Column(db.DateTime)
    dean_decision_at = db.Column(db.DateTime)
    registrar_received_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=now_utc)
    updated_at = db.Column(db.DateTime, default=now_utc, onupdate=now_utc)

    request_attachment = db.relationship("StudentRequestAttachment")


class WorkflowMessage(db.Model):
    """Clarification or status notice tied to one existing workflow case."""
    id = db.Column(db.Integer, primary_key=True)
    transaction_slug = db.Column(db.String(80), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    workflow_request_id = db.Column(db.Integer)
    workflow_stage = db.Column(db.String(100))
    sender_user_id = db.Column(db.Integer, db.ForeignKey("user_account.id"))
    sender_role = db.Column(db.String(80), nullable=False)
    sender_name = db.Column(db.String(160), nullable=False)
    recipient_user_id = db.Column(db.Integer, db.ForeignKey("user_account.id"))
    recipient_role = db.Column(db.String(80), nullable=False)
    visibility = db.Column(db.String(30), nullable=False, default="student_visible")
    template = db.Column(db.String(180), nullable=False)
    comment = db.Column(db.Text)
    action_type = db.Column(db.String(40), nullable=False, default="note")
    previous_status = db.Column(db.String(100))
    new_status = db.Column(db.String(100))
    status = db.Column(db.String(40), nullable=False, default="Open")
    created_at = db.Column(db.DateTime, default=now_utc)
    resolved_at = db.Column(db.DateTime)
    read_at = db.Column(db.DateTime)


# Faculty reference data used by panel matching and scheduling availability.
class Faculty(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    college = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(80), nullable=False)
    specialization = db.Column(db.String(160), nullable=False)
    email = db.Column(db.String(160), unique=True)
    eligible_roles = db.Column(db.Text)
    active = db.Column(db.Boolean, default=True)

    availabilities = db.relationship("FacultyAvailability", backref="faculty", lazy=True, cascade="all, delete-orphan")
    working_hours = db.relationship("FacultyWorkingHour", backref="faculty", lazy=True, cascade="all, delete-orphan")


# Date/time windows that make defense scheduling checkable in the demo.
class FacultyAvailability(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    faculty_id = db.Column(db.Integer, db.ForeignKey("faculty.id"), nullable=False)
    available_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)


# Recurring profile hours. Monday-Friday defaults are used when a legacy
# faculty record has no rows; weekends require an explicit dated availability.
class FacultyWorkingHour(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    faculty_id = db.Column(db.Integer, db.ForeignKey("faculty.id"), nullable=False)
    weekday = db.Column(db.Integer, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    enabled = db.Column(db.Boolean, default=True)


# Result of the panel matching transaction, including the rule score shown to users.
class PanelAssignment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    faculty_id = db.Column(db.Integer, db.ForeignKey("faculty.id"), nullable=False)
    gate = db.Column(db.String(80))
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
    preferred_end_date = db.Column(db.Date)
    start_time = db.Column(db.Time)
    end_time = db.Column(db.Time)
    defense_type = db.Column(db.String(60))
    mode = db.Column(db.String(40), nullable=False)
    venue = db.Column(db.String(160), nullable=False)
    status = db.Column(db.String(40), nullable=False)
    matched_count = db.Column(db.Integer, default=0)
    panel_snapshot = db.Column(db.Text)
    required_forms_status = db.Column(db.String(40))
    conflict_reason = db.Column(db.Text)
    notes = db.Column(db.String(260))
    created_at = db.Column(db.DateTime, default=now_utc)
    confirmed_at = db.Column(db.DateTime)

    student = db.relationship("Student")


class DefenseVerdict(db.Model):
    """Schedule-bound verdict submitted only by the assigned panel chair/lead."""
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    schedule_request_id = db.Column(db.Integer, db.ForeignKey("schedule_request.id"), nullable=False, unique=True)
    # Audit snapshot of the assignment used for authorization. It deliberately
    # is not an FK because a failed stage may clear and regenerate its panel.
    panel_assignment_id = db.Column(db.Integer, nullable=False)
    faculty_id = db.Column(db.Integer, db.ForeignKey("faculty.id"), nullable=False)
    gate = db.Column(db.String(80), nullable=False)
    defense_type = db.Column(db.String(60), nullable=False)
    research_title = db.Column(db.String(220))
    chair_name = db.Column(db.String(160), nullable=False)
    result = db.Column(db.String(60), nullable=False)
    remarks = db.Column(db.Text)
    defense_date = db.Column(db.Date, nullable=False)
    submitted_at = db.Column(db.DateTime, default=now_utc, nullable=False)

    student = db.relationship("Student")
    schedule = db.relationship("ScheduleRequest")
    faculty = db.relationship("Faculty")


class AdviserAssignment(db.Model):
    """Student-specific adviser role linked to the faculty's general account."""
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    faculty_id = db.Column(db.Integer, db.ForeignKey("faculty.id"), nullable=False)
    status = db.Column(db.String(40), nullable=False, default="Active")
    assigned_at = db.Column(db.DateTime, default=now_utc, nullable=False)

    student = db.relationship("Student")
    faculty = db.relationship("Faculty")


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
    workflow_request_id = db.Column(db.Integer)
    actor_user_id = db.Column(db.Integer, db.ForeignKey("user_account.id"))
    action_type = db.Column(db.String(40))
    visibility = db.Column(db.String(30), nullable=False, default="student_visible")
    actor_role = db.Column(db.String(80), nullable=False)
    source_reference = db.Column(db.String(160))
    result = db.Column(db.String(160), nullable=False)
    next_owner = db.Column(db.String(80))
    notes = db.Column(db.Text)
    previous_status = db.Column(db.String(100))
    new_status = db.Column(db.String(100))
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


def term_ordinal(term: AcademicTerm) -> int | None:
    """A sortable integer for a semester (start-year*2 + semester index) so we can
    tell how far a term is from the active one."""
    ay, sem = split_academic_term_label(term.label)
    if not ay:
        return None
    try:
        start_year = int(ay.split("-")[0])
    except (ValueError, IndexError):
        return None
    return start_year * 2 + (1 if ("2nd" in sem or "Second" in sem) else 0)


def term_relative_label(term: AcademicTerm, active: AcademicTerm | None) -> str:
    """'Current' / 'Next' / 'Previous' / '+2' / '-3' relative to the active semester."""
    if not active:
        return ""
    if term.id == active.id:
        return "Current"
    a, b = term_ordinal(term), term_ordinal(active)
    if a is None or b is None:
        return ""
    diff = a - b
    if diff == 1:
        return "Next"
    if diff == -1:
        return "Previous"
    return f"+{diff}" if diff > 0 else f"{diff}"


def term_dict(term: AcademicTerm, active: AcademicTerm | None = None) -> dict:
    active = active if active is not None else get_active_term()
    return {
        "id": term.id,
        "label": term.label,
        "start_date": iso(term.start_date),
        "end_date": iso(term.end_date),
        "planning_window_open": iso(term.planning_window_open),
        "planning_window_close": iso(term.planning_window_close),
        "grade_submission_deadline": iso(term.grade_submission_deadline),
        "status": term.status,
        "is_active_planning_term": bool(term.is_active_planning_term),
        "relative_label": term_relative_label(term, active),
    }


def get_active_term() -> AcademicTerm | None:
    active = AcademicTerm.query.filter_by(is_active_planning_term=True).first()
    if active:
        return active
    # Date-aware "current semester": the one in session, else the next upcoming, else latest.
    today = date.today()
    current = (
        AcademicTerm.query.filter(AcademicTerm.start_date <= today, AcademicTerm.end_date >= today)
        .order_by(AcademicTerm.start_date.desc())
        .first()
    )
    if current:
        return current
    upcoming = (
        AcademicTerm.query.filter(AcademicTerm.start_date > today)
        .order_by(AcademicTerm.start_date.asc())
        .first()
    )
    return upcoming or AcademicTerm.query.order_by(AcademicTerm.start_date.desc()).first()


def visible_terms() -> list[AcademicTerm]:
    """The semesters worth showing in dropdowns: the one immediately before the
    active semester, the active semester itself, and one semester ahead for
    planning the next term. Older/future semesters stay in the database (history
    and references are intact) but are hidden from the pickers to keep them tidy."""
    terms = AcademicTerm.query.order_by(AcademicTerm.start_date.asc()).all()
    active = get_active_term()
    if not active or not terms:
        return terms
    idx = next((i for i, t in enumerate(terms) if t.id == active.id), None)
    if idx is None:
        return terms
    lo = max(0, idx - 1)
    hi = min(len(terms), idx + 2)  # active + one planning semester ahead
    return terms[lo:hi]


def course_audit_subject_items() -> list[dict]:
    """Subjects that currently have a class roster."""
    counts = dict(db.session.query(CourseRecord.course_id, func.count(CourseRecord.id)).group_by(CourseRecord.course_id).all())
    return [
        {"id": course.id, "code": course.code, "title": course.title, "program_id": course.program_id, "enrolled": counts[course.id]}
        for course in Course.query.order_by(Course.code).all() if counts.get(course.id)
    ]


def faculty_grade_alerts() -> list[dict]:
    """Deadline reminders; after five days the same item is flagged for AC escalation."""
    today = date.today()
    alerts = []
    for term in AcademicTerm.query.filter(AcademicTerm.grade_submission_deadline.isnot(None)).all():
        missing = CourseRecord.query.filter(
            CourseRecord.term_label == term.label,
            CourseRecord.status.in_(["Current", "Enrolled"]),
            or_(CourseRecord.grade_value.is_(None), CourseRecord.grade_value == ""),
        ).count()
        if not missing:
            continue
        days_late = max((today - term.grade_submission_deadline).days, 0)
        alerts.append({
            "term_label": term.label, "deadline": iso(term.grade_submission_deadline),
            "missing_grades": missing, "days_late": days_late,
            "coordinator_escalated": days_late >= 5,
        })
    return alerts


# Academic calendar is semester-based: two semesters per academic year (not trimester).
SEMESTER_NAMES = ["1st Semester", "2nd Semester"]


def academic_semester_label(start_year: int, sem_index: int) -> str:
    return f"AY {start_year}-{start_year + 1} {SEMESTER_NAMES[sem_index]}"


def generate_semester_calendar(from_year: int = 2023, to_year: int = 2030) -> list[tuple[str, date]]:
    """(label, start_date) for every semester in the range — 1st Sem in Aug, 2nd in Jan."""
    rows: list[tuple[str, date]] = []
    for year in range(from_year, to_year + 1):
        rows.append((academic_semester_label(year, 0), date(year, 8, 1)))
        rows.append((academic_semester_label(year, 1), date(year + 1, 1, 10)))
    return rows


def upcoming_semester_labels(count: int = 5, reference: date | None = None) -> list[str]:
    """The current and next few semesters (by label), for student/staff dropdowns."""
    reference = reference or date.today()
    terms = AcademicTerm.query.order_by(AcademicTerm.start_date.asc()).all()
    upcoming = [t for t in terms if (t.end_date or t.start_date) >= reference]
    chosen = (upcoming or terms[-count:])[:count]
    return [t.label for t in chosen]


def split_academic_term_label(label: str) -> tuple[str, str]:
    ay_match = re.search(r"(\d{4}\s*-\s*\d{4})", label or "")
    sem_match = re.search(r"((?:1st|2nd|3rd|First|Second|Third)\s*Semester|Term\s*\d+)", label or "", flags=re.IGNORECASE)
    academic_year = ay_match.group(1).replace(" ", "") if ay_match else ""
    semester = ""
    if sem_match:
        matched = re.sub(r"\s+", " ", sem_match.group(1)).strip()
        lowered = matched.lower()
        if lowered.startswith(("1st", "first")):
            semester = "1st Semester"
        elif lowered.startswith(("2nd", "second")):
            semester = "2nd Semester"
        elif lowered.startswith(("3rd", "third")):
            semester = "3rd Semester"
        else:
            semester = matched.title()
    return academic_year, semester


def faculty_dict(faculty: Faculty) -> dict:
    workload = PanelAssignment.query.filter_by(faculty_id=faculty.id).count()
    working_hours = faculty_working_hours(faculty)
    calendar_id = faculty_calendar_id(faculty)
    calendar_ready = google_calendar_configured(faculty)
    first_faculty_id = db.session.query(Faculty.id).order_by(Faculty.id.asc()).limit(1).scalar()
    mock_calendar = faculty.id == first_faculty_id
    return {
        "id": faculty.id,
        "name": faculty.name,
        "college": faculty.college,
        "role": faculty.role,
        "specialization": faculty.specialization,
        "email": faculty.email or faculty_contact_email(faculty),
        "eligible_roles": faculty_eligible_roles(faculty),
        "account": faculty_account_dict(faculty),
        "matching_keywords": matching_tokens(faculty.specialization)[:12],
        "active": faculty.active,
        "availability_status": "Available" if any(day["enabled"] for day in working_hours) else "Unavailable",
        "panel_load": workload,
        "working_hours": working_hours,
        "calendar": {
            "provider": "Google Calendar",
            "connected": calendar_ready,
            "demo_mode": bool(mock_calendar and not calendar_ready),
            "status": "Connected" if calendar_ready else "Not connected",
            "sync_status": "FreeBusy checks enabled" if calendar_ready else ("Mock Google Calendar schedule" if mock_calendar else "Profile schedule"),
            "connect_url": "https://calendar.google.com/calendar/u/0/r/settings",
            "feed_url": f"/api/faculty/{faculty.id}/calendar.ics",
            "calendar_id": calendar_id,
        },
    }


def student_brief(student: Student) -> dict:
    return {
        "id": student.id,
        "student_number": student.student_number,
        "name": student.name,
        "first_name": student.first_name,
        "last_name": student.last_name,
        "email": student.email,
        "program_id": student.program_id,
        "program_code": student.program.code,
        "program_name": student.program.name,
        "program_has_practicum": bool(student.program.has_practicum),
        "college": student.program.college,
        "entry_year": student.entry_year,
        "current_stage": student.current_stage,
        "standing": student.standing,
        "enrollment_tag": student.enrollment_tag,
        "comprehensive_exam_status": student.comprehensive_exam_status,
        "risk_level": student.risk_level,
        "adviser_name": student.adviser_name,
        "search_label": student_search_label(student),
    }


COMPRE_UNIT_REQUIREMENTS = {"Basic": 6, "Major": 9, "Cognate": 6}
COMPRE_TOTAL_UNITS_REQUIRED = 21

MONITORING_CURRICULUM_TEMPLATE = [
    ("200-STAT", "Statistics", "Basic", 3, "Year 1"),
    ("201-MOR", "Methods of Research", "Basic", 3, "Year 1"),
    ("202-OD", "Organization Development", "Basic", 3, "Year 1"),
    ("210-MGRACCT", "Managerial Accounting", "Major", 3, "Year 1"),
    ("211-ECON", "Economics", "Major", 3, "Year 1"),
    ("212-MDHR", "Managing and Developing Human Resources", "Major", 3, "Year 1"),
    ("213COMPFM", "Computerized Financial Management", "Major", 3, "Year 2"),
    ("214-MRKTMANGT", "Marketing Management", "Major", 3, "Year 2"),
    ("220", "Cognate 220", "Cognate", 3, "Year 2"),
    ("221", "Cognate 221", "Cognate", 3, "Year 2"),
    ("222", "Cognate 222", "Cognate", 3, "Year 2"),
    ("223", "Cognate 223", "Cognate", 3, "Year 2"),
    ("224", "Cognate 224", "Cognate", 3, "Year 2"),
    ("225", "Cognate 225", "Cognate", 3, "Year 2"),
    ("226", "Cognate 226", "Cognate", 3, "Year 2"),
    ("227", "Cognate 227", "Cognate", 3, "Year 2"),
    ("228", "Cognate 228", "Cognate", 3, "Year 2"),
    ("229", "Cognate 229", "Cognate", 3, "Year 2"),
]


def monitoring_course_code(program_code: str, suffix: str) -> str:
    return f"{program_code}{suffix}" if suffix[:1].isdigit() else f"{program_code}-{suffix}"


def monitoring_course_title(program_code: str, suffix: str, title: str) -> str:
    if title.startswith("Cognate "):
        return f"{program_code} {title}"
    return title


def monitoring_template_codes(program_code: str) -> list[str]:
    return [monitoring_course_code(program_code, suffix) for suffix, *_ in MONITORING_CURRICULUM_TEMPLATE]


def monitoring_curriculum_courses(program: Program) -> list[Course]:
    """Prefer the AC template columns for monitoring when the program has them."""
    template_codes = monitoring_template_codes(program.code)
    courses = Course.query.filter_by(program_id=program.id).order_by(Course.category, Course.code).all()
    by_code = {course.code: course for course in courses}
    template_courses = [by_code[code] for code in template_codes if code in by_code]
    return template_courses if template_courses else courses


def ensure_monitoring_template_courses() -> int:
    """Add the AC monitoring-template subject columns to existing programs."""
    changed = 0
    for program in Program.query.all():
        for suffix, title, category, units, recommended_term in MONITORING_CURRICULUM_TEMPLATE:
            code = monitoring_course_code(program.code, suffix)
            expected_title = monitoring_course_title(program.code, suffix, title)
            course = Course.query.filter_by(program_id=program.id, code=code).first()
            if not course:
                db.session.add(Course(
                    program_id=program.id,
                    code=code,
                    title=expected_title,
                    units=units,
                    recommended_term=recommended_term,
                    category=category,
                ))
                changed += 1
                continue
            if course.title == course.code and expected_title != course.code:
                course.title = expected_title
                changed += 1
            if (course.category or "Core") != category:
                course.category = category
                changed += 1
            if not course.units:
                course.units = units
                changed += 1
            if not course.recommended_term:
                course.recommended_term = recommended_term
                changed += 1
    if changed:
        db.session.commit()
    return changed


def comprehensive_exam_eligibility(student: Student) -> dict:
    """Require all curriculum subjects to be completed before comprehensive exam eligibility."""
    audit = compute_course_audit(student)
    completed = {row["category"]: row["completed_units"] for row in audit.get("by_category", [])}
    categories = [
        {
            "category": category,
            "completed": completed.get(category, 0),
            "required": required,
            "complete": completed.get(category, 0) >= required,
        }
        for category, required in COMPRE_UNIT_REQUIREMENTS.items()
    ]
    qualifying_total = sum(item["completed"] for item in categories)
    missing_count = len(audit.get("missing", [])) + len(audit.get("current", [])) + len(audit.get("incomplete", []))
    failed_count = sum(1 for row in audit.get("incomplete", []) if row.get("status") == "Failed")
    eligible = missing_count == 0 and failed_count == 0 and bool(audit.get("completed"))
    return {
        "eligible": eligible,
        "status": "Eligible for Comprehensive Exam" if eligible else "Not Eligible",
        "exam_status": student.comprehensive_exam_status or "Not Taken",
        "passed": (student.comprehensive_exam_status or "").lower() == "passed",
        "research_allowed": eligible and (student.comprehensive_exam_status or "").lower() == "passed",
        "categories": categories,
        "completed_units": qualifying_total,
        "required_units": COMPRE_TOTAL_UNITS_REQUIRED,
        "missing_subjects": missing_count,
        "failed_subjects": failed_count,
        "required_subjects": len(audit.get("completed", [])) + missing_count,
    }


def monitoring_research_milestones(student: Student) -> dict:
    stage = student.current_stage
    idx = STAGES.index(stage) if stage in STAGES else 0
    research_allowed = comprehensive_exam_eligibility(student)["research_allowed"]
    return {
        "title": research_allowed and stage != "LOA" and idx >= STAGES.index("Proposal Development"),
        "proposal": research_allowed and idx >= STAGES.index("Proposal Defense"),
        "ethics": research_allowed and idx >= STAGES.index("Data Collection"),
        "final": research_allowed and idx >= STAGES.index("Final Defense"),
    }


def require_research_prerequisite(student: Student) -> dict:
    prerequisite = comprehensive_exam_eligibility(student)
    if not prerequisite["eligible"]:
        raise ValueError("Complete all curriculum subjects before taking the comprehensive exam.")
    if not prerequisite["passed"]:
        raise ValueError("The comprehensive exam must be marked Passed before starting Title, Proposal, Ethics, or Final research activities.")
    return prerequisite


def course_audit_dict(audit: dict) -> dict:
    def row(item):
        record = item["record"]
        return {
            "course_id": item["course"].id,
            "code": item["course"].code,
            "title": item["course"].title,
            "units": item["course"].units,
            "recommended_term": item["course"].recommended_term,
            "status": item["status"],
            "term_label": record.term_label if record else None,
            "evidence_reference": record.evidence_reference if record else None,
            "grade_value": record.grade_value if record else "",
            "grade_status": record.grade_status if record else "No Grade",
            "incomplete_deadline": record.incomplete_deadline.isoformat() if record and record.incomplete_deadline else None,
            "remarks": record.remarks if record else "",
        }

    return {
        "required_count": audit["required_count"],
        "completed": [row(r) for r in audit["completed"]],
        "current": [row(r) for r in audit["current"]],
        "incomplete": [row(r) for r in audit["incomplete"]],
        "missing": [row(r) for r in audit["missing"]],
        "missing_count": audit["missing_count"],
        "completion_rate": audit["completion_rate"],
        "total_units": audit.get("total_units", 0),
        "completed_units": audit.get("completed_units", 0),
        "units_rate": audit.get("units_rate", 0),
        "by_category": audit.get("by_category", []),
        "eligibility": audit.get("eligibility", {}),
    }


def course_record_dict(record: CourseRecord, pending_drop: "CourseDropRequest | None" = None) -> dict:
    return {
        "id": record.id,
        "course_id": record.course_id,
        "code": record.course.code if record.course else None,
        "title": record.course.title if record.course else None,
        "units": record.course.units if record.course else 0,
        "category": record.course.category if record.course else None,
        "status": record.status,
        "term_label": record.term_label,
        "evidence_reference": record.evidence_reference,
        "grade_value": record.grade_value or "",
        "grade_status": record.grade_status or "No Grade",
        "incomplete_deadline": record.incomplete_deadline.isoformat() if record.incomplete_deadline else None,
        "resolved_at": iso(record.resolved_at),
        "remarks": record.remarks or "",
        "updated_at": iso(record.updated_at),
        "drop_request": course_drop_request_dict(pending_drop, include_student=False) if pending_drop else None,
    }


def latest_course_drop_request(student_id: int, course_id: int) -> "CourseDropRequest | None":
    return (
        CourseDropRequest.query.filter_by(student_id=student_id, course_id=course_id)
        .order_by(CourseDropRequest.created_at.desc(), CourseDropRequest.id.desc())
        .first()
    )


def course_drop_request_dict(request_item: "CourseDropRequest | None", include_student: bool = True) -> dict | None:
    if not request_item:
        return None
    data = {
        "id": request_item.id,
        "student_id": request_item.student_id,
        "course_id": request_item.course_id,
        "course_code": request_item.course.code if request_item.course else None,
        "course_title": request_item.course.title if request_item.course else None,
        "term_label": request_item.term_label,
        "reason": request_item.reason,
        "status": request_item.status,
        "reviewer_remarks": request_item.reviewer_remarks,
        "decided_by": request_item.decided_by,
        "decided_at": iso(request_item.decided_at),
        "created_at": iso(request_item.created_at),
        "updated_at": iso(request_item.updated_at),
        "attachment": attachment_dict(request_item.attachment),
    }
    if include_student and request_item.student:
        data["student"] = student_brief(request_item.student)
    return data


def research_case_dict(case: ResearchCase | None) -> dict | None:
    if not case:
        return None
    milestone = RESEARCH_MILESTONES.get(case.current_gate, {})
    return {
        "id": case.id,
        "case_type": case.case_type,
        "title": case.title,
        "current_gate": case.current_gate,
        "current_gate_label": milestone.get("label", case.current_gate),
        "status": case.status,
        "adviser_name": case.adviser_name,
        "opened_at": iso(case.opened_at),
    }


def document_check_dict(doc: DocumentCheck) -> dict:
    files = sorted(doc.evidence_files, key=lambda item: item.uploaded_at or now_utc(), reverse=True)
    presentation = research_requirement_presentation(doc.gate, doc.item_name)
    state = research_requirement_state(Student.query.get(doc.student_id), doc.gate, doc.item_name, doc)
    return {
        "id": doc.id,
        "gate": doc.gate,
        "item_name": doc.item_name,
        "status": state["status"] if presentation else doc.status,
        "status_label": state["status_label"] if presentation else doc.status,
        "display_name": presentation["label"] if presentation else doc.item_name,
        "description": presentation["description"] if presentation else None,
        "source_type": presentation["source_type"] if presentation else "record",
        "student_upload": presentation["source_type"] == "student_upload" if presentation else True,
        "required_file_count": presentation["required_file_count"] if presentation else 1,
        "evidence_reference": doc.evidence_reference,
        "updated_at": iso(doc.updated_at),
        "file_count": len(files),
        "files": [
            {
                "id": item.id,
                "name": item.original_name,
                "mime_type": item.mime_type,
                "uploaded_at": iso(item.uploaded_at),
                "url": f"/api/research-evidence/{item.id}/file",
            }
            for item in files
        ],
    }


def form1_endorsement_dict(endorsement: Form1Endorsement | None) -> dict | None:
    if not endorsement:
        return None
    return {
        "id": endorsement.id,
        "student_id": endorsement.student_id,
        "coordinator_name": endorsement.coordinator_name,
        "signature_data": endorsement.signature_data,
        "status": endorsement.status,
        "endorsed_at": iso(endorsement.endorsed_at),
    }


FACULTY_ELIGIBLE_ROLES = {
    "Faculty Adviser",
    "Panel Member",
    "Panel Chair",
    "Academic Coordinator",
    "Research Coordinator",
}


def faculty_eligible_roles(faculty: Faculty) -> list[str]:
    try:
        roles = json.loads(faculty.eligible_roles or "[]")
    except (TypeError, json.JSONDecodeError):
        roles = []
    roles = [role for role in roles if role in FACULTY_ELIGIBLE_ROLES]
    return roles or ["Faculty Adviser", "Panel Member", "Panel Chair"]


def faculty_account_dict(faculty: Faculty) -> dict | None:
    account = UserAccount.query.filter_by(faculty_id=faculty.id).first()
    if not account:
        return None
    return {"id": account.id, "email": account.email, "active": account.active, "role": account.role}


def faculty_email_local_part(faculty: Faculty) -> str:
    cleaned = re.sub(r"\b(?:dr|prof|mr|ms|mrs)\.?\b", " ", faculty.name or "", flags=re.IGNORECASE)
    tokens = re.findall(r"[a-z0-9]+", cleaned.lower())
    if len(tokens) >= 2:
        return f"{tokens[0]}.{tokens[-1]}"
    if tokens:
        return tokens[0]
    return f"faculty{faculty.id or ''}" or "faculty"


def faculty_email_needs_generation(email: str | None) -> bool:
    # Only synthesize an email when the faculty sheet did not provide a usable one.
    # Real institutional addresses (e.g. name@usls.edu.ph) are kept as-is so the
    # faculty roster stays a real source of truth, not generated placeholders.
    value = (email or "").strip().lower()
    return not value or "@" not in value


def default_faculty_email(faculty: Faculty) -> str:
    local = faculty_email_local_part(faculty)
    base = f"{local}@usls.edu.ph"
    candidate = base
    suffix = 2
    while (
        Faculty.query.filter(func.lower(Faculty.email) == candidate.lower(), Faculty.id != faculty.id).first()
        or UserAccount.query.filter(
            func.lower(UserAccount.email) == candidate.lower(),
            or_(UserAccount.faculty_id.is_(None), UserAccount.faculty_id != faculty.id),
        ).first()
    ):
        candidate = f"{local}{suffix}@usls.edu.ph"
        suffix += 1
    return candidate


def ensure_faculty_user_account(
    faculty: Faculty,
    temporary_password: str = "DemoPass123!",
    *,
    reset_password: bool = False,
) -> UserAccount:
    """Idempotently connect one general faculty login to a Faculty row."""
    email = (faculty.email or "").strip().lower()
    if not email:
        email = default_faculty_email(faculty)
        faculty.email = email
    account = UserAccount.query.filter_by(faculty_id=faculty.id).first()
    email_account = UserAccount.query.filter(func.lower(UserAccount.email) == email).first()
    if email_account and account and email_account.id != account.id:
        raise ValueError("That faculty email is already connected to another account.")
    if email_account and email_account.faculty_id not in {None, faculty.id}:
        raise ValueError("That faculty email is already connected to another faculty member.")
    if not account:
        account = email_account
    if account and account.role != "faculty":
        raise ValueError("That email already belongs to a non-faculty login account.")
    if not account:
        account = UserAccount(
            email=email,
            full_name=f"{faculty.name} (Faculty)",
            password_hash=generate_password_hash(temporary_password),
            role="faculty",
            faculty_id=faculty.id,
            active=bool(faculty.active),
        )
        db.session.add(account)
    elif reset_password:
        account.password_hash = generate_password_hash(temporary_password)
    account.email = email
    account.full_name = f"{faculty.name} (Faculty)"
    account.role = "faculty"
    account.faculty_id = faculty.id
    account.active = bool(faculty.active)
    return account


def faculty_is_adviser_for_student(faculty_id: int, student_id: int) -> bool:
    assignment = AdviserAssignment.query.filter_by(
        faculty_id=faculty_id, student_id=student_id, status="Active"
    ).first()
    if assignment:
        return True
    faculty = Faculty.query.get(faculty_id)
    student = Student.query.get(student_id)
    return bool(faculty and student and student.adviser_name == faculty.name)


def adviser_approval_dict(approval: AdviserDocumentApproval | None) -> dict | None:
    if not approval:
        return None
    return {
        "id": approval.id,
        "student_id": approval.student_id,
        "evidence_file_id": approval.evidence_file_id,
        "faculty_id": approval.faculty_id,
        "adviser_name": approval.adviser_name,
        "student_name": approval.student_name,
        "document_name": approval.document_name,
        "signature_data": approval.signature_data,
        "status": approval.status,
        "signed_at": iso(approval.signed_at),
    }


def defense_verdict_dict(verdict: DefenseVerdict | None) -> dict | None:
    if not verdict:
        return None
    return {
        "id": verdict.id,
        "student_id": verdict.student_id,
        "schedule_request_id": verdict.schedule_request_id,
        "panel_assignment_id": verdict.panel_assignment_id,
        "faculty_id": verdict.faculty_id,
        "gate": verdict.gate,
        "defense_type": verdict.defense_type,
        "research_title": verdict.research_title,
        "chair_name": verdict.chair_name,
        "result": verdict.result,
        "remarks": verdict.remarks,
        "defense_date": iso(verdict.defense_date),
        "submitted_at": iso(verdict.submitted_at),
    }


def student_portal_stage(student: Student, case: ResearchCase | None) -> str:
    if student.standing == "On Leave":
        return "LOA"
    if student.standing == "AWOL" or student.enrollment_tag == "AWOL":
        return "AWOL"
    if student.standing == "Withdrawn":
        return "Withdrawn"
    if student.current_stage == "Withdrawal In Progress":
        return "Withdrawal In Progress"
    if not case:
        return student.current_stage
    return {
        "Form 1 - Title Defense": "Proposal Development",
        "Form 4 - Proposal Defense Readiness": "Proposal Defense",
        "Final Defense": "Final Defense",
        "Completion Evidence": "Completed",
    }.get(case.current_gate, student.current_stage)


def panel_assignment_dict(assignment: PanelAssignment) -> dict:
    faculty = assignment.faculty
    workload = (
        PanelAssignment.query.filter(
            PanelAssignment.faculty_id == assignment.faculty_id,
            PanelAssignment.student_id != assignment.student_id,
        ).count()
        if faculty
        else 0
    )
    return {
        "id": assignment.id,
        "faculty_id": assignment.faculty_id,
        "gate": assignment.gate,
        "panel_role": assignment.panel_role,
        "score": assignment.score,
        "eligibility_note": assignment.eligibility_note,
        "faculty_name": faculty.name if faculty else None,
        "college": faculty.college if faculty else None,
        "specialization": faculty.specialization if faculty else None,
        "workload": workload,
        "assigned_at": iso(assignment.assigned_at),
    }


def schedule_request_dict(req: ScheduleRequest) -> dict:
    try:
        panelists = json.loads(req.panel_snapshot or "[]")
    except (TypeError, json.JSONDecodeError):
        panelists = []
    gate = RESEARCH_DEFENSE_TYPES_TO_GATES.get(req.defense_type or "")
    outcome = latest_defense_outcome(req.student, gate, req.id) if gate and req.student else None
    display_status = req.status
    display_conflict_reason = req.conflict_reason
    if req.status == "Rescheduled" and req.defense_type:
        older_same_stage_schedule = ScheduleRequest.query.filter(
            ScheduleRequest.student_id == req.student_id,
            ScheduleRequest.defense_type == req.defense_type,
            ScheduleRequest.created_at < req.created_at,
        ).first()
        if not older_same_stage_schedule:
            display_status = "Scheduled"
    if outcome and outcome["result"] in {"Passed", "Passed with revisions"}:
        display_status = "Finished"
        if display_conflict_reason in {
            "Superseded by a staff-approved reschedule.",
            "Superseded by a staff-approved schedule update.",
        }:
            display_conflict_reason = None
    elif outcome:
        display_status = outcome["result"]
    elif req.status == "Cancelled" and display_conflict_reason == "Superseded by a staff-approved reschedule.":
        display_conflict_reason = "Superseded by a staff-approved schedule update."
    return {
        "id": req.id,
        "preferred_date": iso(req.preferred_date),
        "preferred_end_date": iso(req.preferred_end_date),
        "start_time": req.start_time.strftime("%H:%M") if req.start_time else None,
        "end_time": req.end_time.strftime("%H:%M") if req.end_time else None,
        "defense_type": req.defense_type,
        "mode": req.mode,
        "venue": req.venue,
        "status": req.status,
        "display_status": display_status,
        "defense_outcome": outcome["result"] if outcome else None,
        "verdict": outcome.get("verdict") if outcome else None,
        "display_conflict_reason": display_conflict_reason,
        "matched_count": req.matched_count,
        "panelists": panelists,
        "required_forms_status": req.required_forms_status,
        "conflict_reason": req.conflict_reason,
        "notes": req.notes,
        "created_at": iso(req.created_at),
        "confirmed_at": iso(req.confirmed_at),
    }


def attachment_dict(attachment: StudentRequestAttachment | None) -> dict | None:
    if not attachment:
        return None
    file_exists = (REQUEST_UPLOAD_ROOT / attachment.stored_name).exists()
    return {
        "id": attachment.id,
        "request_id": attachment.workflow_request_id,
        "stage": attachment.workflow_stage,
        "name": attachment.original_name,
        "uploaded_at": iso(attachment.uploaded_at),
        "url": f"/api/student-request-attachments/{attachment.id}/file",
        "file_exists": file_exists,
        "uploaded_by_user_id": attachment.uploaded_by_user_id,
        "uploaded_by": attachment.uploaded_by_name or "Uploader not recorded",
        "uploaded_by_role": attachment.uploaded_by_role or "Unknown",
        "status": "Uploaded",
        "status_label": "Pending Review" if file_exists else "File unavailable",
    }


def workflow_attachments(student_id: int, *request_types: str, request_id: int | None = None) -> list[dict]:
    """Return every saved upload for a case, including superseded revisions."""
    query = StudentRequestAttachment.query.filter(
        StudentRequestAttachment.student_id == student_id,
        StudentRequestAttachment.request_type.in_(request_types),
    )
    if request_id is not None:
        query = query.filter(
            or_(
                StudentRequestAttachment.workflow_request_id == request_id,
                StudentRequestAttachment.workflow_request_id.is_(None),
            )
        )
    rows = query.order_by(
        StudentRequestAttachment.uploaded_at.asc(),
        StudentRequestAttachment.id.asc(),
    ).all()
    return [attachment_dict(item) for item in rows]


def latest_practicum_record(student_id: int) -> PracticumRecord | None:
    return (
        PracticumRecord.query.filter_by(student_id=student_id)
        .order_by(PracticumRecord.updated_at.desc(), PracticumRecord.id.desc())
        .first()
    )


def latest_withdrawal_application(student_id: int) -> WithdrawalApplication | None:
    return (
        WithdrawalApplication.query.filter_by(student_id=student_id)
        .order_by(WithdrawalApplication.updated_at.desc(), WithdrawalApplication.id.desc())
        .first()
    )


def latest_graduation_endorsement(student_id: int) -> GraduationEndorsement | None:
    return (
        GraduationEndorsement.query.filter_by(student_id=student_id)
        .order_by(GraduationEndorsement.updated_at.desc(), GraduationEndorsement.id.desc())
        .first()
    )


def practicum_record_dict(record: PracticumRecord | None, include_student: bool = True) -> dict | None:
    if not record:
        return None
    eligibility = practicum_eligibility(record.student)
    coordinator_status = "Pending"
    if record.status in {"MOA Under Review", "Practicum In Progress", "Documents Submitted", "Documents Under Review", "Hours Incomplete", "Additional Certificates Requested"}:
        coordinator_status = "Under Review"
    elif record.status in {"Completed", "Report Sent to Dean", "Dean Reviewed"}:
        coordinator_status = "Completed"
    dean_report_status = "Reviewed" if record.dean_reviewed_at else "Sent" if record.report_sent_at else "Not Sent"
    payload = {
        "id": record.id,
        "student_id": record.student_id,
        "moa_status": record.moa_status,
        "moa_uploaded": bool(record.moa_uploaded),
        "practicum_site": record.practicum_site,
        "supervisor_name": record.supervisor_name,
        "required_hours": record.required_hours or 0,
        "completed_hours": record.completed_hours or 0,
        "document_status": record.document_status,
        "certificate_count": record.certificate_count or 0,
        "remarks": record.remarks,
        "completion_status": record.completion_status,
        "status": record.status,
        "practicum_eligibility_status": eligibility["status"],
        "moa_upload_status": "Submitted" if record.moa_uploaded else "Missing",
        "practicum_documents_upload_status": "Submitted" if record.certificate_attachment_id else "Missing",
        "practicum_hours_completed": record.completed_hours or 0,
        "practicum_hours_required": record.required_hours or 0,
        "coordinator_review_status": coordinator_status,
        "dean_report_status": dean_report_status,
        "eligibility": eligibility,
        "timeline": practicum_timeline(record, eligibility),
        "moa_attachment": attachment_dict(record.moa_attachment),
        "certificate_attachment": attachment_dict(record.certificate_attachment),
        "attachments": workflow_attachments(record.student_id, "practicum", request_id=record.id),
        "report_sent_at": iso(record.report_sent_at),
        "dean_reviewed_at": iso(record.dean_reviewed_at),
        "created_at": iso(record.created_at),
        "updated_at": iso(record.updated_at),
    }
    if include_student and record.student:
        payload["student"] = student_brief(record.student)
    return payload


def withdrawal_application_dict(application: WithdrawalApplication | None, include_student: bool = True) -> dict | None:
    if not application:
        return None
    payload = {
        "id": application.id,
        "student_id": application.student_id,
        "reason": application.reason,
        "effective_term": application.effective_term,
        "fee_status": application.fee_status,
        "requirement_status": application.requirement_status,
        "dean_decision": application.dean_decision,
        "staff_remarks": application.staff_remarks,
        "academic_coordinator_remarks": application.academic_coordinator_remarks,
        "registrar_status": application.registrar_status,
        "status": application.status,
        "request_attachment": attachment_dict(application.request_attachment),
        "proof_attachment": attachment_dict(application.proof_attachment),
        "attachments": workflow_attachments(application.student_id, "withdrawal", request_id=application.id),
        "decided_at": iso(application.decided_at),
        "completed_at": iso(application.completed_at),
        "created_at": iso(application.created_at),
        "updated_at": iso(application.updated_at),
    }
    if include_student and application.student:
        payload["student"] = student_brief(application.student)
    return payload


def graduation_endorsement_dict(endorsement: GraduationEndorsement | None, include_student: bool = True) -> dict | None:
    if not endorsement:
        return None
    payload = {
        "id": endorsement.id,
        "student_id": endorsement.student_id,
        "review_window": endorsement.review_window,
        "batch_name": endorsement.batch_name,
        "coursework_status": endorsement.coursework_status,
        "research_status": endorsement.research_status,
        "practicum_status": endorsement.practicum_status,
        "missing_coursework": split_items(endorsement.missing_coursework or ""),
        "missing_research_requirements": split_items(endorsement.missing_research_requirements or ""),
        "missing_practicum_requirement": endorsement.missing_practicum_requirement,
        "endorsement_status": endorsement.endorsement_status,
        "dean_remarks": endorsement.dean_remarks,
        "registrar_status": endorsement.registrar_status,
        "request_attachment": attachment_dict(endorsement.request_attachment),
        "attachments": workflow_attachments(
            endorsement.student_id,
            "graduation",
            "graduation-endorsement",
            request_id=endorsement.id,
        ),
        "submitted_at": iso(endorsement.submitted_at),
        "dean_decision_at": iso(endorsement.dean_decision_at),
        "registrar_received_at": iso(endorsement.registrar_received_at),
        "created_at": iso(endorsement.created_at),
        "updated_at": iso(endorsement.updated_at),
    }
    if include_student and endorsement.student:
        payload["student"] = student_brief(endorsement.student)
    return payload


def workflow_message_dict(message: WorkflowMessage) -> dict:
    record = workflow_case_record(message.transaction_slug, message.student_id)
    request_id = message.workflow_request_id or (record.id if record else None)
    return {
        "id": message.id,
        "request_id": request_id,
        "thread_key": f"{message.transaction_slug}:{request_id or message.student_id}",
        "stage": message.workflow_stage,
        "transaction_slug": message.transaction_slug,
        "student_id": message.student_id,
        "student_name": message.student.name if message.student else None,
        "sender_user_id": message.sender_user_id,
        "sender_role": message.sender_role,
        "sender_name": message.sender_name,
        "recipient_user_id": message.recipient_user_id,
        "recipient_role": message.recipient_role,
        "visibility": message.visibility,
        "template": message.template,
        "comment": message.comment,
        "action_type": message.action_type,
        "previous_status": message.previous_status,
        "new_status": message.new_status,
        "status": message.status,
        "created_at": iso(message.created_at),
        "resolved_at": iso(message.resolved_at),
        "read_at": iso(message.read_at),
        "is_unread": bool(
            message.visibility == "student_visible"
            and message.recipient_role == "Student"
            and message.read_at is None
        ),
    }


def workflow_messages_for(
    slug: str,
    student_id: int,
    limit: int = 20,
    request_id: int | None = None,
    student_visible_only: bool = False,
) -> list[dict]:
    query = WorkflowMessage.query.filter_by(transaction_slug=slug, student_id=student_id)
    if request_id is not None:
        query = query.filter(
            or_(
                WorkflowMessage.workflow_request_id == request_id,
                WorkflowMessage.workflow_request_id.is_(None),
            )
        )
    if student_visible_only:
        query = query.filter(WorkflowMessage.visibility == "student_visible")
    messages = query.order_by(
        WorkflowMessage.created_at.desc(),
        WorkflowMessage.id.desc(),
    ).limit(limit).all()
    return [workflow_message_dict(item) for item in messages]


def workflow_case_meta(slug: str, student_id: int) -> dict:
    record = workflow_case_record(slug, student_id)
    request_id = record.id if record else None
    log_query = TransactionLog.query.filter_by(transaction_slug=slug, student_id=student_id)
    if request_id is not None:
        log_query = log_query.filter(
            or_(
                TransactionLog.workflow_request_id == request_id,
                TransactionLog.workflow_request_id.is_(None),
            )
        )
    latest_log = log_query.order_by(
        TransactionLog.created_at.desc(),
        TransactionLog.id.desc(),
    ).first()
    open_query = WorkflowMessage.query.filter_by(
        transaction_slug=slug,
        student_id=student_id,
        status="Open",
    )
    if request_id is not None:
        open_query = open_query.filter(
            or_(
                WorkflowMessage.workflow_request_id == request_id,
                WorkflowMessage.workflow_request_id.is_(None),
            )
        )
    open_messages = open_query.count()
    return {
        "request_id": request_id,
        "next_action_owner": latest_log.next_owner if latest_log else None,
        "last_activity_at": iso(latest_log.created_at) if latest_log else None,
        "unresolved_messages": open_messages,
        "messages": workflow_messages_for(slug, student_id, request_id=request_id),
        "history": [
            log_dict(item)
            for item in log_query
            .order_by(TransactionLog.created_at.desc(), TransactionLog.id.desc())
            .limit(30)
            .all()
        ],
    }


def task_dict(task: Task) -> dict:
    action_url = None
    action_label = None
    if task.title.startswith("Review course drop request") or "lapsed INC" in task.title:
        action_url = "/workflow/course-audit"
        action_label = "Open Course Audit"
    elif any(value in task.title.lower() for value in ["awol", "refresher", "re-enroll courses after maximum residence"]):
        action_url = "/workflow/awol"
        action_label = "Open AWOL & Residency"
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
        "action_url": action_url,
        "action_label": action_label,
    }


def course_offering_dict(offering: CourseOffering) -> dict:
    return {
        "id": offering.id,
        "course_id": offering.course_id,
        "code": offering.course.code if offering.course else None,
        "title": offering.course.title if offering.course else None,
        "demand_count": offering.demand_count,
        "section_count": offering.section_count,
        "availability_count": offering.availability_count,
        "status": offering.status,
        "notes": offering.notes,
    }


def curriculum_offering_dict(offering: CurriculumOffering) -> dict:
    return {
        "id": offering.id,
        "program_id": offering.program_id,
        "program_code": offering.program.code if offering.program else None,
        "academic_year": offering.academic_year,
        "semester": offering.semester,
        "course_id": offering.course_id,
        "course_code": offering.course.code if offering.course else None,
        "course_title": offering.course.title if offering.course else None,
        "course_units": offering.course.units if offering.course else None,
        "course_category": offering.course.category if offering.course else None,
        "added_by": offering.added_by,
        "created_at": iso(offering.created_at),
        "updated_at": iso(offering.updated_at),
    }


ACTIVE_SUBJECT_ENROLLMENT_STATUSES = {"Enrolled", "Current", "Incomplete"}
RECORDED_SUBJECT_ENROLLMENT_STATUSES = ACTIVE_SUBJECT_ENROLLMENT_STATUSES | {
    "Completed",
    "Failed",
    "Retake Required",
    "Dropped",
}


def subject_enrollment_dict(item: SubjectEnrollment) -> dict:
    return {
        "id": item.id,
        "student_id": item.student_id,
        "student_name": item.student.name if item.student else None,
        "student_number": item.student.student_number if item.student else None,
        "course_id": item.course_id,
        "course_code": item.course.code if item.course else None,
        "course_title": item.course.title if item.course else None,
        "course_units": item.course.units if item.course else None,
        "course_category": item.course.category if item.course else None,
        "term_id": item.term_id,
        "term_label": item.term.label if item.term else None,
        "status": item.status,
        "source_reference": item.source_reference,
        "conflict_override": item.conflict_override,
        "enrolled_at": iso(item.enrolled_at),
        "cancelled_at": iso(item.cancelled_at),
        "updated_at": iso(item.updated_at),
    }


def curriculum_offerings_for_term(program: Program, term: AcademicTerm) -> list[CurriculumOffering]:
    academic_year, semester = split_academic_term_label(term.label)
    if not academic_year or not semester:
        return []
    return (
        CurriculumOffering.query.filter_by(
            program_id=program.id,
            academic_year=academic_year,
            semester=semester,
        )
        .join(Course, Course.id == CurriculumOffering.course_id)
        .order_by(Course.category, Course.code)
        .all()
    )


def ensure_term_enrollment(
    student: Student,
    term: AcademicTerm,
    status: str = "Enrolled",
    source_reference: str = "",
) -> TermEnrollment:
    item = TermEnrollment.query.filter_by(student_id=student.id, term_id=term.id).first()
    if not item:
        item = TermEnrollment(
            student_id=student.id,
            term_id=term.id,
            status=status,
            source_reference=source_reference,
        )
        db.session.add(item)
    else:
        item.status = status
        item.source_reference = source_reference or item.source_reference
        item.confirmed_at = now_utc()
    return item


def cancel_active_subject_enrollments(
    student: Student,
    source_reference: str,
    course_status: str = "Dropped",
) -> int:
    """Close active class rows when a student exits active monitoring."""
    rows = SubjectEnrollment.query.filter(
        SubjectEnrollment.student_id == student.id,
        SubjectEnrollment.status.in_(ACTIVE_SUBJECT_ENROLLMENT_STATUSES),
    ).all()
    changed = 0
    for item in rows:
        item.status = "Cancelled"
        item.cancelled_at = now_utc()
        item.updated_at = now_utc()
        item.source_reference = source_reference
        record = CourseRecord.query.filter_by(
            student_id=student.id,
            course_id=item.course_id,
        ).first()
        if (
            record
            and record.term_label == item.term.label
            and record.status in ACTIVE_SUBJECT_ENROLLMENT_STATUSES
        ):
            record.status = course_status
            record.grade_status = "No Grade"
            record.incomplete_deadline = None
            record.resolved_at = None
            record.remarks = source_reference
            record.evidence_reference = "Enrollment synchronization"
            record.updated_at = now_utc()
        term_row = TermEnrollment.query.filter_by(
            student_id=student.id,
            term_id=item.term_id,
        ).first()
        if term_row and term_row.status in {"Confirmed", "Enrolled", "Active"}:
            term_row.status = "Withdrawn"
            term_row.source_reference = source_reference
            term_row.confirmed_at = now_utc()
        changed += 1
    return changed


def sync_subject_enrollment_from_course_record(
    student: Student,
    course: Course,
    term_label: str | None,
    status: str,
    source_reference: str,
) -> SubjectEnrollment | None:
    """Keep the durable enrollment ledger aligned with monitoring/audit edits."""
    if not term_label:
        return None
    term = AcademicTerm.query.filter_by(label=term_label).first()
    if not term:
        return None
    item = SubjectEnrollment.query.filter_by(
        student_id=student.id,
        course_id=course.id,
        term_id=term.id,
    ).first()
    if status == "Missing":
        if item and item.status in ACTIVE_SUBJECT_ENROLLMENT_STATUSES:
            item.status = "Cancelled"
            item.cancelled_at = now_utc()
            item.updated_at = now_utc()
            item.source_reference = source_reference
        return item
    if status not in RECORDED_SUBJECT_ENROLLMENT_STATUSES:
        return item
    if not item:
        item = SubjectEnrollment(
            student_id=student.id,
            course_id=course.id,
            term_id=term.id,
            status=status,
            source_reference=source_reference,
        )
        db.session.add(item)
    else:
        item.status = status
        item.source_reference = source_reference
        item.cancelled_at = now_utc() if status == "Dropped" else None
        item.updated_at = now_utc()
    if status in ACTIVE_SUBJECT_ENROLLMENT_STATUSES:
        ensure_term_enrollment(student, term, "Enrolled", source_reference)
    return item


def enrollment_conflict_options(kind: str) -> list[dict]:
    options = {
        "not_offered": [
            {"value": "exclude", "label": "Do not enroll (recommended)"},
            {"value": "enroll_override", "label": "Enroll with documented exception"},
        ],
        "already_completed": [
            {"value": "exclude", "label": "Keep completed record (recommended)"},
            {"value": "enroll_as_retake", "label": "Enroll again as an approved retake"},
        ],
        "active_other_term": [
            {"value": "keep_other", "label": "Keep the existing semester (recommended)"},
            {"value": "move_to_selected", "label": "Move enrollment to this semester"},
        ],
        "program_mismatch": [
            {"value": "exclude", "label": "Exclude mismatched subject (required)"},
        ],
        "standing_block": [
            {"value": "cancel", "label": "Cancel enrollment changes (required)"},
        ],
    }
    return options.get(kind, [])


def enrollment_preview_payload(
    student: Student,
    term: AcademicTerm,
    requested_course_ids: set[int],
) -> dict:
    courses = Course.query.filter(Course.id.in_(requested_course_ids or {-1})).all()
    courses_by_id = {course.id: course for course in courses}
    unknown_ids = sorted(requested_course_ids - set(courses_by_id))
    offered_ids = {
        item.course_id for item in curriculum_offerings_for_term(student.program, term)
    }
    current_rows = SubjectEnrollment.query.filter_by(
        student_id=student.id,
        term_id=term.id,
    ).all()
    current_active_ids = {
        item.course_id for item in current_rows
        if item.status in ACTIVE_SUBJECT_ENROLLMENT_STATUSES
    }
    records = {
        item.course_id: item
        for item in CourseRecord.query.filter_by(student_id=student.id).all()
    }
    conflicts = []
    if student.standing in {"Withdrawn", "Graduated", "Completed"} or student.enrollment_tag in {
        "LOA",
        "AWOL",
        "Withdrawn",
        "Completed",
    }:
        conflicts.append({
            "id": "standing-block",
            "kind": "standing_block",
            "severity": "blocking",
            "line": "Student profile · Standing / enrollment",
            "message": (
                f"{student.name} is {student.standing} / {student.enrollment_tag} and cannot "
                "receive subject enrollment until that standing is resolved."
            ),
            "options": enrollment_conflict_options("standing_block"),
        })
    for course_id in unknown_ids:
        conflicts.append({
            "id": f"unknown-{course_id}",
            "kind": "program_mismatch",
            "severity": "blocking",
            "line": f"Subject ID {course_id}",
            "message": "The requested subject no longer exists.",
            "options": enrollment_conflict_options("program_mismatch"),
        })
    for course_id in sorted(requested_course_ids & set(courses_by_id)):
        course = courses_by_id[course_id]
        if course.program_id != student.program_id:
            conflicts.append({
                "id": f"program-{course.id}",
                "kind": "program_mismatch",
                "severity": "blocking",
                "line": f"Subject {course.code} · Program",
                "message": (
                    f"{course.code} belongs to another program and cannot be added to "
                    f"{student.program.code}."
                ),
                "course_id": course.id,
                "options": enrollment_conflict_options("program_mismatch"),
            })
            continue
        if course.id not in offered_ids:
            conflicts.append({
                "id": f"offering-{course.id}",
                "kind": "not_offered",
                "severity": "warning",
                "line": f"Subject {course.code} · Official offering list",
                "message": f"{course.code} is not offered for {term.label}.",
                "course_id": course.id,
                "options": enrollment_conflict_options("not_offered"),
            })
        record = records.get(course.id)
        if record and record.status == "Completed":
            conflicts.append({
                "id": f"completed-{course.id}",
                "kind": "already_completed",
                "severity": "warning",
                "line": f"Subject {course.code} · Student monitoring row",
                "message": (
                    f"{course.code} is already Completed in the student profile and "
                    "monitoring sheet."
                ),
                "course_id": course.id,
                "options": enrollment_conflict_options("already_completed"),
            })
        other_active = (
            SubjectEnrollment.query.filter(
                SubjectEnrollment.student_id == student.id,
                SubjectEnrollment.course_id == course.id,
                SubjectEnrollment.term_id != term.id,
                SubjectEnrollment.status.in_(ACTIVE_SUBJECT_ENROLLMENT_STATUSES),
            )
            .join(AcademicTerm, AcademicTerm.id == SubjectEnrollment.term_id)
            .order_by(AcademicTerm.start_date.desc())
            .first()
        )
        if other_active:
            conflicts.append({
                "id": f"active-term-{course.id}",
                "kind": "active_other_term",
                "severity": "warning",
                "line": f"Subject {course.code} · Semester",
                "message": (
                    f"{course.code} is still {other_active.status} in "
                    f"{other_active.term.label}."
                ),
                "course_id": course.id,
                "other_enrollment_id": other_active.id,
                "options": enrollment_conflict_options("active_other_term"),
            })
    additions = sorted(requested_course_ids - current_active_ids)
    removals = sorted(current_active_ids - requested_course_ids)
    unchanged = sorted(current_active_ids & requested_course_ids)
    return {
        "student": student_brief(student),
        "term": term_dict(term),
        "requested_course_ids": sorted(requested_course_ids),
        "current_course_ids": sorted(current_active_ids),
        "additions": [
            {
                "course_id": course_id,
                "code": courses_by_id[course_id].code if course_id in courses_by_id else str(course_id),
                "title": courses_by_id[course_id].title if course_id in courses_by_id else "Unknown subject",
            }
            for course_id in additions
        ],
        "removals": [
            {
                "course_id": course_id,
                "code": next(
                    (row.course.code for row in current_rows if row.course_id == course_id and row.course),
                    str(course_id),
                ),
                "title": next(
                    (row.course.title for row in current_rows if row.course_id == course_id and row.course),
                    "Unknown subject",
                ),
            }
            for course_id in removals
        ],
        "unchanged_count": len(unchanged),
        "conflicts": conflicts,
        "conflict_count": len(conflicts),
        "has_blocking_conflicts": any(item["severity"] == "blocking" for item in conflicts),
    }


def enrollment_integrity_payload(
    program: Program | None = None,
    term: AcademicTerm | None = None,
    limit: int = 80,
) -> dict:
    """Report drift between the durable ledger and monitoring/profile projection."""
    issues = []
    query = SubjectEnrollment.query
    if term:
        query = query.filter(SubjectEnrollment.term_id == term.id)
    if program:
        query = query.join(Student, Student.id == SubjectEnrollment.student_id).filter(
            Student.program_id == program.id
        )
    enrollment_rows = query.order_by(SubjectEnrollment.updated_at.desc()).all()
    for item in enrollment_rows:
        student = item.student
        course = item.course
        if not student or not course:
            continue
        if course.program_id != student.program_id:
            issues.append({
                "id": f"program-{item.id}",
                "type": "Program mismatch",
                "line": f"{student.student_number} · {course.code}",
                "message": "Enrollment subject belongs to a different program.",
                "student_id": student.id,
            })
            continue
        record = CourseRecord.query.filter_by(
            student_id=student.id,
            course_id=course.id,
        ).first()
        expected_active = item.status in ACTIVE_SUBJECT_ENROLLMENT_STATUSES
        if expected_active and (
            not record
            or record.status not in ACTIVE_SUBJECT_ENROLLMENT_STATUSES
            or record.term_label != item.term.label
        ):
            issues.append({
                "id": f"projection-{item.id}",
                "type": "Monitoring/profile mismatch",
                "line": f"{student.student_number} · {course.code}",
                "message": (
                    f"Enrollment says {item.status} in {item.term.label}, but the shared "
                    f"monitoring/profile row says {record.status if record else 'Missing'}."
                ),
                "student_id": student.id,
            })
        if expected_active:
            term_row = TermEnrollment.query.filter_by(
                student_id=student.id,
                term_id=item.term_id,
            ).first()
            if not term_row or term_row.status not in {"Confirmed", "Enrolled", "Active"}:
                issues.append({
                    "id": f"term-{item.id}",
                    "type": "Semester enrollment missing",
                    "line": f"{student.student_number} · {item.term.label}",
                    "message": "A subject is active but the semester enrollment signal is missing.",
                    "student_id": student.id,
                })
        offered_ids = {
            offering.course_id
            for offering in curriculum_offerings_for_term(student.program, item.term)
        }
        if expected_active and course.id not in offered_ids and not item.conflict_override:
            issues.append({
                "id": f"offering-{item.id}",
                "type": "Offering conflict",
                "line": f"{student.student_number} · {course.code}",
                "message": f"The subject is not on the official offering list for {item.term.label}.",
                "student_id": student.id,
            })
    duplicate_rows = (
        db.session.query(
            CourseRecord.student_id,
            CourseRecord.course_id,
            func.count(CourseRecord.id),
        )
        .group_by(CourseRecord.student_id, CourseRecord.course_id)
        .having(func.count(CourseRecord.id) > 1)
        .all()
    )
    for student_id, course_id, count in duplicate_rows:
        student = Student.query.get(student_id)
        course = Course.query.get(course_id)
        if program and student and student.program_id != program.id:
            continue
        issues.append({
            "id": f"duplicate-{student_id}-{course_id}",
            "type": "Duplicate monitoring rows",
            "line": (
                f"{student.student_number if student else student_id} · "
                f"{course.code if course else course_id}"
            ),
            "message": f"{count} monitoring/profile rows exist for the same subject.",
            "student_id": student_id,
        })
    return {
        "status": "Consistent" if not issues else "Needs review",
        "issue_count": len(issues),
        "checked_enrollments": len(enrollment_rows),
        "issues": issues[:limit],
        "surfaces": ["Enrollment", "Monitoring Sheet", "Student Profile", "Student Portal"],
    }


def student_enrollment_snapshot(
    student: Student,
    term: AcademicTerm | None = None,
) -> dict:
    term = term or get_active_term()
    if not term:
        return {"term": None, "offered_subjects": [], "enrollments": []}
    offerings = curriculum_offerings_for_term(student.program, term)
    rows = (
        SubjectEnrollment.query.filter_by(student_id=student.id)
        .join(AcademicTerm, AcademicTerm.id == SubjectEnrollment.term_id)
        .join(Course, Course.id == SubjectEnrollment.course_id)
        .order_by(AcademicTerm.start_date.desc(), Course.code)
        .all()
    )
    current_by_course = {
        item.course_id: item
        for item in rows
        if item.term_id == term.id
    }
    return {
        "term": term_dict(term),
        "offered_subjects": [
            {
                **curriculum_offering_dict(offering),
                "enrollment_status": (
                    current_by_course[offering.course_id].status
                    if offering.course_id in current_by_course
                    else "Not enrolled"
                ),
            }
            for offering in offerings
        ],
        "enrollments": [subject_enrollment_dict(item) for item in rows],
    }


def default_academic_year_options() -> list[str]:
    today_year = date.today().year
    return [f"{year}-{year + 1}" for year in range(today_year, today_year - 5, -1)]


def course_offering_plan_dict(plan: CourseOfferingPlan | None) -> dict | None:
    if not plan:
        return None
    return {
        "id": plan.id,
        "program_id": plan.program_id,
        "program_code": plan.program.code if plan.program else None,
        "term_label": plan.term_label,
        "status": plan.status,
        "notes": plan.notes,
        "created_at": iso(plan.created_at),
        "updated_at": iso(plan.updated_at),
        "submitted_at": iso(plan.submitted_at),
        "approved_at": iso(plan.approved_at),
        "approved_by": plan.approved_by,
        "published_at": iso(plan.published_at),
        "target_term_id": plan.target_term_id,
        "reference_term_id": plan.reference_term_id,
        "target_term": term_dict(plan.target_term) if plan.target_term else None,
        "reference_term": term_dict(plan.reference_term) if plan.reference_term else None,
        "offerings": [course_offering_dict(o) for o in sorted(plan.offerings, key=lambda item: item.demand_count, reverse=True)],
    }


def log_dict(log: TransactionLog) -> dict:
    return {
        "id": log.id,
        "transaction_slug": log.transaction_slug,
        "student_id": log.student_id,
        "request_id": log.workflow_request_id,
        "actor_user_id": log.actor_user_id,
        "action_type": log.action_type,
        "visibility": log.visibility,
        "student_name": log.student.name if log.student else None,
        "actor_role": log.actor_role,
        "source_reference": log.source_reference,
        "result": log.result,
        "next_owner": log.next_owner,
        "notes": log.notes,
        "previous_status": log.previous_status,
        "new_status": log.new_status,
        "created_at": iso(log.created_at),
    }


def human_activity_query():
    # Global activity feeds should show meaningful workflow events, not every
    # per-student row touched by a bulk monitoring-sheet upload or course audit.
    query = TransactionLog.query.filter(TransactionLog.actor_role != "Demo Data").filter(
        or_(
            TransactionLog.source_reference.is_(None),
            TransactionLog.source_reference != "AC Student Monitoring import",
            TransactionLog.student_id.is_(None),
        )
    )
    return query.filter(
        ~(
            (TransactionLog.transaction_slug == "course-audit")
            & TransactionLog.student_id.isnot(None)
            & TransactionLog.source_reference.like("Course audit%")
        )
    )


def account_dict(account: UserAccount) -> dict:
    return {
        "id": account.id,
        "email": account.email,
        "full_name": account.full_name,
        "role": account.role,
        "student_id": account.student_id,
        "faculty_id": account.faculty_id,
    }


BACKOFFICE_ROLES = {
    "staff",
    "academic_coordinator",
    "research_coordinator",
    "admin",
}

ROLE_TRANSACTION_ACCESS = {
    "academic_coordinator": {"course-audit", "research-gate", "panel-matching", "practicum", "graduation", "withdrawal", "awol"},
    "research_coordinator": {"research-gate", "graduation"},
}

REQUEST_ATTACHMENT_WORKFLOWS = {
    "leave-of-absence": "leave-of-absence",
    "readmission": "readmission",
    "awol-return": "awol",
    "practicum": "practicum",
    "withdrawal": "withdrawal",
    "graduation": "graduation",
    "graduation-endorsement": "graduation",
    "course-drop": "course-audit",
}

ROLE_LABELS = {
    "staff": "Graduate School Staff",
    "academic_coordinator": "Academic Coordinator",
    "research_coordinator": "Research Coordinator",
    "dean": "Dean",
    "student": "Student",
    "faculty": "Faculty Member",
    "admin": "Administrator",
}

WORKFLOW_MESSAGE_TEMPLATES = [
    "Please upload the correct document.",
    "The submitted file is unreadable. Please re-upload a clearer copy.",
    "Please complete the missing required fields.",
    "The document needs the proper signature before approval.",
    "Please clarify the information entered in this section.",
    "Returned for revision. Please review the comments and resubmit.",
    "Forwarding this request for dean review.",
    "Sending this back to the previous stage for correction.",
    # Retain existing saved/demo values for backwards compatibility.
    "Missing required document",
    "Document is unclear or unreadable",
    "Eligibility information needs verification",
    "Units completed do not match records",
    "Thesis/practicum status needs confirmation",
    "Please upload an updated file",
    "Please clarify request details",
    "This request requires additional review",
    "Practicum completion was not accepted; another organization may be required",
    "Other / Custom comment",
    "Other",
]

WORKFLOW_RECIPIENTS = {
    "Student": "student",
    "Graduate School Staff": "staff",
    "Academic Coordinator": "academic_coordinator",
    "Research Coordinator": "research_coordinator",
    "Dean": "dean",
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


def faculty_can_access_research_evidence(faculty_id: int, evidence: ResearchEvidenceFile) -> bool:
    faculty = Faculty.query.get(faculty_id)
    if not faculty or not evidence or not evidence.document_check:
        return False
    if faculty_is_adviser_for_student(faculty.id, evidence.student_id):
        return True
    return bool(
        PanelAssignment.query.filter_by(
            faculty_id=faculty.id,
            student_id=evidence.student_id,
            gate=evidence.document_check.gate,
        ).first()
    )


def require_api_login(*roles):
    # Pass one or more roles; empty means "any signed-in account".
    allowed = {r for r in roles if r}

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            account = current_account()
            if not account:
                return jsonify({"error": "Please sign in to continue."}), 401
            # Admin is a superuser: it passes every role gate so it can review
            # all staff-side screens. (Ownership visibility is tightened later.)
            if allowed and account.role not in allowed and account.role != "admin":
                return jsonify({"error": "This account cannot access that area."}), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def require_workflow_actor(*roles) -> UserAccount:
    """Enforce the configured owner for a workflow transition."""
    account = current_account()
    if not account or account.role not in roles:
        expected = " or ".join(ROLE_LABELS[role] for role in roles)
        raise ValueError(f"This step must be completed by {expected}.")
    return account


def workflow_actor_label(account: UserAccount) -> str:
    return f"{ROLE_LABELS.get(account.role, account.role)} · {account.full_name}"


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
    current_milestone = research_milestone_payload(student, case.current_gate) if case and case.current_gate in RESEARCH_MILESTONES else None
    missing_docs = current_milestone["student_missing_count"] if current_milestone else 0
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
SCORE_CRITICAL = 85


def band_from_score(score: int) -> str:
    if score >= SCORE_CRITICAL:
        return "critical"
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
    if ind["schedule_status"] in PENDING_DEFENSE_STATUSES:
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


def student_portal_recommendations(student: Student) -> list[dict]:
    payload = student_recommendations(student)
    indicators = payload["indicators"]
    milestone = RESEARCH_MILESTONES.get(indicators.get("research_gate") or "", {})
    rows = []
    for rec in payload["recommendations"]:
        item = dict(rec)
        if rec["code"] == "evidence":
            count = indicators["missing_documents"]
            item["recommendation"] = f"Upload the {count} missing file(s) for {milestone.get('label', indicators['research_gate'])}."
            item["owner"] = "You"
        elif rec["code"] == "coursework":
            item["recommendation"] = f"Contact the Academic Coordinator about your {indicators['missing_subjects']} outstanding subject(s)."
        elif rec["code"] == "schedule":
            item["recommendation"] = "Wait for the Research Coordinator to confirm a time shared by your adviser and panel."
        elif rec["code"] == "stalled":
            item["recommendation"] = "Contact the office shown below to confirm the next action on your record."
        rows.append(item)
    return rows


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
        ScheduleRequest.query.filter(ScheduleRequest.status.in_(PENDING_DEFENSE_STATUSES))
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
     "text": "A student may file a Leave of Absence with an approved reason. The residency clock is paused for the approved LOA period. LOA is limited (prototype rule: up to 4 semesters total) and the student must have completed at least one semester of residency before filing. The Dean approves the request; GS Staff records the effective dates."},
    {"id": "readmission", "title": "Readmission of Returning Students", "source": "GS Research Protocol / Handbook",
     "tags": ["readmission", "return", "re-enroll", "comeback"],
     "text": "A returning student files for readmission with a return-intent letter, an updated study plan, a program/adviser endorsement, and clearance of any pending accountability. On approval the student is marked active for the return semester."},
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
     "tags": ["final defense", "final", "form 6", "form 7"],
     "text": "Final defense readiness requires the final defense endorsement signed in-system by the assigned adviser, the final defense manuscript, ethics clearance, and the confirmed final defense schedule."},
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


def loa_policy_review(student: Student, request_data: dict | None = None) -> dict:
    request_data = request_data or {}
    snippets = retrieve_policy(
        "leave of absence LOA residency eligibility prior terms approved reason Dean effective period",
        k=3,
    )
    try:
        prior_count = int(request_data.get("prior_loa_count") or 0)
    except (TypeError, ValueError):
        prior_count = 0
    reason = (request_data.get("reason_remarks") or request_data.get("reason") or "").strip()
    effective_start = (request_data.get("effective_start") or "").strip()
    effective_end = (request_data.get("effective_end") or "").strip()
    application_reference = (request_data.get("application_reference") or request_data.get("attachment") or "").strip()
    completed_terms = max(0, int((date.today().year - (student.entry_year or date.today().year)) * 3))

    checks = [
        {
            "label": "Application document/reference",
            "status": "Present" if application_reference else "Needs Review",
            "detail": application_reference or "No uploaded application/reference is attached to this review.",
        },
        {
            "label": "Reason for leave",
            "status": "Present" if reason else "Needs Review",
            "detail": reason or "Staff should confirm the student stated an approved reason.",
        },
        {
            "label": "Effective period",
            "status": "Present" if effective_start and effective_end else "Needs Review",
            "detail": " to ".join([part for part in [effective_start, effective_end] if part]) or "Start and end semesters are not both recorded.",
        },
        {
            "label": "Prior LOA limit",
            "status": "Pass" if prior_count < 4 else "Fail",
            "detail": f"{prior_count} prior LOA semester(s) recorded; prototype limit is up to 4 semesters total.",
        },
        {
            "label": "Minimum residency",
            "status": "Pass" if completed_terms >= 1 else "Needs Review",
            "detail": f"Estimated completed residency: {completed_terms} semester(s) from entry year {student.entry_year}.",
        },
    ]
    failed = [item for item in checks if item["status"] == "Fail"]
    review_needed = [item for item in checks if item["status"] == "Needs Review"]
    if failed:
        recommendation = "Not Eligible"
        suggested_dean_action = "Deny"
        summary = "The LOA request appears to exceed an eligibility limit. Staff should verify before forwarding or denying."
    elif review_needed:
        recommendation = "Needs Review"
        suggested_dean_action = "Return for Revision"
        summary = "The LOA request needs staff review because required details are missing or uncertain."
    else:
        recommendation = "Eligible"
        suggested_dean_action = "Approve"
        summary = "The LOA request meets the retrieved LOA/residency policy checks and can be auto-approved."

    return {
        "mode": "loa-policy-rag",
        "recommendation": recommendation,
        "suggested_dean_action": suggested_dean_action,
        "summary": summary,
        "checks": checks,
        "citations": snippets,
    }


def readmission_policy_review(student: Student, request_data: dict | None = None) -> dict:
    request_data = request_data or {}
    snippets = retrieve_policy(
        "readmission return re-enroll updated study plan adviser endorsement pending accountability LOA",
        k=3,
    )
    if hasattr(request_data, "getlist"):
        submitted_items = set(request_data.getlist("readmission_items"))
    else:
        raw_items = request_data.get("readmission_items") or []
        submitted_items = set(split_items(raw_items) if isinstance(raw_items, str) else raw_items)
    requirements = readmission_requirements()
    missing = [item for item in requirements if item not in submitted_items]
    target_return_term = (request_data.get("target_return_term") or "").strip()
    previous_loa_period = (request_data.get("previous_loa_period") or "").strip()
    application_reference = (request_data.get("application_reference") or request_data.get("attachment") or "").strip()
    on_leave = student.current_stage == "LOA" or student.enrollment_tag == "LOA" or student.standing == "On Leave"

    checks = [
        {
            "label": "Readmission application/reference",
            "status": "Present" if application_reference else "Needs Review",
            "detail": application_reference or "No uploaded readmission application/reference is attached to this review.",
        },
        {
            "label": "Previous LOA period",
            "status": "Present" if previous_loa_period or on_leave else "Needs Review",
            "detail": previous_loa_period or ("Student is currently marked on LOA." if on_leave else "Previous LOA period is not recorded."),
        },
        {
            "label": "Target return semester",
            "status": "Present" if target_return_term else "Needs Review",
            "detail": target_return_term or "No target return semester is recorded.",
        },
        {
            "label": "Required return documents",
            "status": "Pass" if not missing else "Needs Review",
            "detail": "All checklist items are selected." if not missing else "Missing: " + ", ".join(missing),
        },
        {
            "label": "Current LOA/leave status",
            "status": "Pass" if on_leave else "Needs Review",
            "detail": "Student is currently recorded as on leave." if on_leave else f"Current status is {student.current_stage}/{student.enrollment_tag}; staff should confirm this is a return from LOA.",
        },
    ]
    review_needed = [item for item in checks if item["status"] == "Needs Review"]
    if review_needed:
        recommendation = "Needs Review"
        suggested_dean_action = "Return for Revision"
        summary = "The readmission request needs staff review because required return details or checklist items are incomplete."
    else:
        recommendation = "Eligible to Return"
        suggested_dean_action = "Approve"
        summary = "The readmission request meets the retrieved return policy checks and can be auto-approved for reactivation."

    return {
        "mode": "readmission-policy-rag",
        "recommendation": recommendation,
        "suggested_dean_action": suggested_dean_action,
        "summary": summary,
        "checks": checks,
        "missing_requirements": missing,
        "citations": snippets,
    }


AWOL_RESIDENCY_CITATIONS = [
    {
        "id": "gs-handbook-awol-return",
        "title": "Return from LOA or AWOL",
        "source": "Graduate Programs Student Handbook 2022-2023, p. 53",
        "text": "A returning student declares the intention to enroll in writing to the University Registrar through the Graduate School Dean.",
    },
    {
        "id": "gs-handbook-maximum-residence",
        "title": "Maximum residence",
        "source": "Graduate Programs Student Handbook 2022-2023, pp. 54-55",
        "text": "Master's programs use a 5-year normal and 7-year absolute limit; doctoral programs use a 7-year normal and 9-year absolute limit. The two-year extension requires a graded 6-unit refresher course.",
    },
    {
        "id": "gs-handbook-residency-enrollment",
        "title": "Residency enrollment",
        "source": "Graduate Programs Student Handbook 2022-2023, p. 48",
        "text": "Residency without subjects is for specified thesis, practicum, INC, comprehensive-exam, or publication work; students with remaining course units who will not enroll should file LOA.",
    },
]

RESIDENCY_REASONS = [
    "Thesis / dissertation work",
    "Practicum / internship completion",
    "Completing an INC",
    "Comprehensive examination",
    "Awaiting research publication",
]


def latest_awol_case(student_id: int) -> AwolCase | None:
    return (
        AwolCase.query.filter_by(student_id=student_id)
        .order_by(AwolCase.updated_at.desc(), AwolCase.id.desc())
        .first()
    )


def latest_residency_enrollment(student_id: int, active_only: bool = False) -> ResidencyEnrollment | None:
    query = ResidencyEnrollment.query.filter_by(student_id=student_id)
    if active_only:
        query = query.filter_by(status="Active")
    return query.order_by(ResidencyEnrollment.updated_at.desc(), ResidencyEnrollment.id.desc()).first()


def residence_limits(student: Student) -> dict:
    program_name = (student.program.name or "").lower()
    doctoral = "doctor" in program_name or "phd" in program_name or student.program.code.upper() in {"DBA", "EDD", "PHD"}
    normal = 7 if doctoral else 5
    absolute = 9 if doctoral else 7
    years = max(0, date.today().year - int(student.entry_year or date.today().year))
    return {
        "program_level": "Doctorate" if doctoral else "Master's",
        "years_in_program": years,
        "normal_years": normal,
        "absolute_years": absolute,
    }


def awol_policy_review(student: Student, request_data: dict | None = None) -> dict:
    request_data = request_data or {}
    action = (request_data.get("workflow_action") or request_data.get("action") or "return_from_awol").strip()
    limits = residence_limits(student)
    years = limits["years_in_program"]
    current_awol = student.enrollment_tag == "AWOL" or student.standing == "AWOL" or student.current_stage == "AWOL"

    if action == "record_residency":
        reason = (request_data.get("residency_reason") or "").strip()
        records = CourseRecord.query.filter_by(student_id=student.id).all()
        active_subjects = [item for item in records if item.status in {"Enrolled", "Current"}]
        incomplete_subjects = [item for item in records if item.status == "Incomplete"]
        audit = compute_course_audit(student)
        reason_supported = False
        reason_detail = "Choose the work the student will continue during residency."
        if reason == "Completing an INC":
            reason_supported = bool(incomplete_subjects)
            reason_detail = f"{len(incomplete_subjects)} incomplete subject(s) are recorded."
        elif reason == "Comprehensive examination":
            reason_supported = student.current_stage == "Comprehensive Exam"
            reason_detail = f"Current lifecycle stage: {student.current_stage}."
        elif reason == "Awaiting research publication":
            reason_supported = student.current_stage in {"Writing", "Final Defense", "Completed"}
            reason_detail = f"Current lifecycle stage: {student.current_stage}."
        elif reason in {"Thesis / dissertation work", "Practicum / internship completion"}:
            reason_supported = audit.get("missing_count", 0) == 0
            reason_detail = f"Course audit has {audit.get('missing_count', 0)} missing/incomplete subject(s)."

        checks = [
            {
                "label": "No subject enrollment",
                "status": "Pass" if not active_subjects else "Needs Review",
                "detail": "No current/enrolled subjects are recorded." if not active_subjects else f"{len(active_subjects)} active subject(s) are still recorded.",
            },
            {
                "label": "Permitted residency purpose",
                "status": "Pass" if reason in RESIDENCY_REASONS and reason_supported else "Needs Review",
                "detail": reason_detail,
            },
            {
                "label": "Not an LOA substitute",
                "status": "Pass" if reason_supported else "Needs Review",
                "detail": "The recorded work supports residency." if reason_supported else "If course units remain and the student will not enroll, use LOA instead of residency.",
            },
        ]
        eligible = all(item["status"] == "Pass" for item in checks)
        return {
            "mode": "awol-residency-policy-rag",
            "recommendation": "Eligible for Residency" if eligible else "Needs Human Review",
            "suggested_action": "Record Residency" if eligible else "Review or Use LOA",
            "summary": "The student matches the handbook conditions for residency without subjects." if eligible else "The residency request does not yet clearly match the handbook conditions; verify the record or use LOA.",
            "checks": checks,
            "citations": [AWOL_RESIDENCY_CITATIONS[2]],
            "limits": limits,
        }

    if action == "declare_awol":
        valid = student.standing not in {"Withdrawn", "Graduated"} and student.enrollment_tag not in {"LOA", "Completed", "Withdrawn"}
        checks = [
            {
                "label": "No approved leave",
                "status": "Pass" if student.enrollment_tag != "LOA" else "Needs Review",
                "detail": f"Current enrollment status: {student.enrollment_tag}.",
            },
            {
                "label": "Active graduate record",
                "status": "Pass" if valid else "Needs Review",
                "detail": f"Current standing: {student.standing}.",
            },
        ]
        return {
            "mode": "awol-residency-policy-rag",
            "recommendation": "Eligible to Record AWOL" if valid else "Needs Human Review",
            "suggested_action": "Declare AWOL" if valid else "Verify Standing",
            "summary": "The handbook treats withdrawal without formal leave as AWOL and curtails registration privileges." if valid else "The current standing conflicts with declaring AWOL and requires manual review.",
            "checks": checks,
            "citations": [AWOL_RESIDENCY_CITATIONS[0]],
            "limits": limits,
        }

    intent_reference = (request_data.get("application_reference") or request_data.get("intent_letter_reference") or "").strip()
    if years <= limits["normal_years"]:
        classification = "Within Maximum Residence"
        recommendation = "Eligible for Dean Review"
        suggested_action = "Forward to Dean"
        residence_detail = f"{years} year(s) in program; normal {limits['program_level']} limit is {limits['normal_years']} years."
    elif years <= limits["absolute_years"]:
        classification = "Extension - Refresher Required"
        recommendation = "Dean Review with 6-unit Refresher"
        suggested_action = "Forward with Refresher Requirement"
        residence_detail = f"{years} year(s) in program; within the extension window ending at {limits['absolute_years']} years."
    else:
        classification = "Full Re-enrollment Required"
        recommendation = "Escalate for Re-enrollment"
        suggested_action = "Forward for Re-enrollment Decision"
        residence_detail = f"{years} year(s) in program; beyond the {limits['absolute_years']}-year absolute limit."
    checks = [
        {
            "label": "Current AWOL status",
            "status": "Pass" if current_awol else "Needs Review",
            "detail": "Student is currently recorded AWOL." if current_awol else f"Current status is {student.standing}/{student.enrollment_tag}.",
        },
        {
            "label": "Written intent to enroll",
            "status": "Present" if intent_reference else "Needs Review",
            "detail": intent_reference or "Upload the written return intent addressed through the Graduate School Dean.",
        },
        {
            "label": "Maximum residence",
            "status": "Pass" if years <= limits["normal_years"] else "Escalate",
            "detail": residence_detail,
        },
    ]
    return {
        "mode": "awol-residency-policy-rag",
        "recommendation": recommendation if current_awol and intent_reference else "Needs Human Review",
        "suggested_action": suggested_action if current_awol and intent_reference else "Return for Missing Information",
        "summary": f"Return classification: {classification}. The Dean must endorse the written intent before registration privileges are restored.",
        "checks": checks,
        "classification": classification,
        "refresher_required": classification == "Extension - Refresher Required",
        "full_reenrollment_required": classification == "Full Re-enrollment Required",
        "limits": limits,
        "citations": AWOL_RESIDENCY_CITATIONS[:2],
    }


def awol_case_dict(item: AwolCase, include_student: bool = True) -> dict:
    payload = {
        "id": item.id,
        "kind": "awol",
        "student_id": item.student_id,
        "status": item.status,
        "awol_effective_date": iso(item.awol_effective_date),
        "last_enrolled_term": item.last_enrolled_term,
        "return_requested_at": iso(item.return_requested_at),
        "target_return_term": item.target_return_term,
        "intent_attachment": attachment_dict(item.intent_attachment),
        "years_in_program": item.years_in_program,
        "normal_residence_years": item.normal_residence_years,
        "absolute_residence_years": item.absolute_residence_years,
        "policy_classification": item.policy_classification,
        "refresher_required": bool(item.refresher_required),
        "full_reenrollment_required": bool(item.full_reenrollment_required),
        "dean_decision": item.dean_decision,
        "staff_notes": item.staff_notes,
        "decided_at": iso(item.decided_at),
        "created_at": iso(item.created_at),
        "updated_at": iso(item.updated_at),
    }
    if include_student:
        payload["student"] = student_brief(item.student)
    return payload


def residency_enrollment_dict(item: ResidencyEnrollment) -> dict:
    return {
        "id": item.id,
        "kind": "residency",
        "student_id": item.student_id,
        "student": student_brief(item.student),
        "term_id": item.term_id,
        "term_label": item.term.label if item.term else None,
        "reason": item.reason,
        "policy_status": item.policy_status,
        "status": "Residency" if item.status == "Active" else f"Residency {item.status}",
        "record_status": item.status,
        "staff_notes": item.staff_notes,
        "created_at": iso(item.created_at),
        "ended_at": iso(item.ended_at),
        "updated_at": iso(item.updated_at),
    }


def awol_residency_roster_payload() -> list[dict]:
    rows = [awol_case_dict(item) for item in AwolCase.query.order_by(AwolCase.updated_at.desc()).limit(150).all()]
    case_students = {item["student_id"] for item in rows}
    for student in Student.query.filter(Student.enrollment_tag == "AWOL", ~Student.id.in_(case_students or {-1})).order_by(Student.last_name).all():
        rows.append({
            "id": f"legacy-{student.id}",
            "kind": "awol",
            "student_id": student.id,
            "student": student_brief(student),
            "status": "AWOL Declared",
            "policy_classification": "Not yet reviewed",
            "dean_decision": "Not Submitted",
            "created_at": None,
            "updated_at": None,
        })
    rows.extend(
        residency_enrollment_dict(item)
        for item in ResidencyEnrollment.query.order_by(ResidencyEnrollment.updated_at.desc()).limit(150).all()
    )
    return sorted(rows, key=lambda item: item.get("updated_at") or item.get("created_at") or "", reverse=True)


def _status_sentence(student: Student, ind: dict) -> str:
    bits = [f"{student.name} ({student.student_number}, {student.program.code}) is at the {ind['stage']} stage"]
    bits.append(f"standing {ind['standing']}, risk {ind['risk']}")
    if ind["research_gate"]:
        bits.append(f"research gate {ind['research_gate']} — {ind['research_status']}")
    bits.append(f"coursework {ind['completion_rate']}% complete")
    return ", ".join(bits) + "."


def _rag_document_files() -> list[Path]:
    configured = os.getenv("RAG_DOCUMENT_DIRS", "").strip()
    roots = [Path(p.strip()) for p in configured.split(os.pathsep) if p.strip()] if configured else RAG_DOCUMENT_PATHS
    supported = {".pdf", ".docx", ".txt", ".md"}
    files: list[Path] = []
    for root in roots:
        path = root if root.is_absolute() else BASE_DIR / root
        if path.is_file() and path.suffix.lower() in supported and path.stat().st_size > 0:
            files.append(path)
        elif path.is_dir():
            files.extend(
                item
                for item in path.rglob("*")
                if item.is_file() and item.suffix.lower() in supported and item.stat().st_size > 0
            )
    return sorted(dict.fromkeys(files))


def _load_rag_chat_engine():
    """Build and cache a LlamaIndex chat engine over local handbook/research files."""
    global _RAG_CHAT_ENGINE, _RAG_LOAD_ERROR
    if _RAG_CHAT_ENGINE is not None:
        return _RAG_CHAT_ENGINE
    if _RAG_LOAD_ERROR is not None:
        raise RuntimeError(_RAG_LOAD_ERROR)

    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_AI_STUDIO_API_KEY")
    if not api_key:
        _RAG_LOAD_ERROR = "GOOGLE_API_KEY not found in .env file."
        raise RuntimeError(_RAG_LOAD_ERROR)

    files = _rag_document_files()
    if not files:
        _RAG_LOAD_ERROR = "No RAG documents found. Add PDF, DOCX, TXT, or MD files to data/ or Documents/USLS_Documents/."
        raise RuntimeError(_RAG_LOAD_ERROR)

    try:
        from llama_index.core import Settings, SimpleDirectoryReader, VectorStoreIndex
        from llama_index.embeddings.huggingface import HuggingFaceEmbedding
        from llama_index.llms.gemini import Gemini
        from llama_index.readers.file import PyMuPDFReader
    except ImportError as exc:
        _RAG_LOAD_ERROR = (
            "LlamaIndex RAG packages are not installed. Run pip install -r requirements.txt, "
            f"then restart the app. Missing import: {exc}"
        )
        raise RuntimeError(_RAG_LOAD_ERROR) from exc

    try:
        Settings.llm = Gemini(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            api_key=api_key,
        )
    except TypeError:
        Settings.llm = Gemini(model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"))
    Settings.embed_model = HuggingFaceEmbedding(
        model_name=os.getenv("RAG_EMBED_MODEL", "BAAI/bge-small-en-v1.5")
    )
    Settings.chunk_size = int(os.getenv("RAG_CHUNK_SIZE", "512"))
    Settings.chunk_overlap = int(os.getenv("RAG_CHUNK_OVERLAP", "50"))

    reader = SimpleDirectoryReader(
        input_files=[str(path) for path in files],
        file_extractor={".pdf": PyMuPDFReader()},
    )
    documents = reader.load_data()
    if not documents:
        _RAG_LOAD_ERROR = "RAG documents were found, but no readable text could be loaded."
        raise RuntimeError(_RAG_LOAD_ERROR)

    index = VectorStoreIndex.from_documents(documents)
    _RAG_CHAT_ENGINE = index.as_chat_engine(chat_mode="context", verbose=False)
    return _RAG_CHAT_ENGINE


def _rag_citations(response, limit: int = 5) -> list[dict]:
    citations = []
    seen = set()
    for idx, node in enumerate(getattr(response, "source_nodes", []) or []):
        metadata = getattr(node.node, "metadata", {}) or {}
        file_name = metadata.get("file_name") or metadata.get("filename") or metadata.get("file_path") or "Document"
        page = metadata.get("page_label") or metadata.get("page")
        source = f"{file_name}, p. {page}" if page else str(file_name)
        text = (getattr(node.node, "text", "") or "").strip()
        key = (source, text[:80])
        if key in seen:
            continue
        seen.add(key)
        citations.append({
            "id": f"rag-{idx}",
            "title": Path(str(file_name)).name,
            "source": source,
            "text": text[:700],
        })
        if len(citations) >= limit:
            break
    return citations


def _case_context_for_rag(student: Student | None, payload: dict | None, snippets: list[dict]) -> str:
    context = []
    if student and payload:
        context.append("Student context: " + _status_sentence(student, payload["indicators"]))
        if payload["recommendations"]:
            context.append(
                "Open recommendations: "
                + "; ".join(f"{r['recommendation']} ({r['owner']})" for r in payload["recommendations"][:3])
            )
    if snippets:
        context.append(
            "Known policy snippets: "
            + " ".join(f"{s['title']}: {s['text']}" for s in snippets)
        )
    return "\n".join(context)


def call_document_rag(question: str, snippets: list[dict], payload: dict | None, student: Student | None) -> tuple[str, list[dict]]:
    chat_engine = _load_rag_chat_engine()
    case_context = _case_context_for_rag(student, payload, snippets)
    prompt = (
        "Answer as the USLS Graduate School assistant. Use the retrieved handbook and research guideline "
        "documents as the primary source. If student context is provided, use it only for that student's live "
        "status and do not invent approvals, decisions, or missing records. If the documents do not answer the "
        "question, say what is missing.\n\n"
    )
    if case_context:
        prompt += case_context + "\n\n"
    prompt += f"Question: {question}"
    response = chat_engine.chat(prompt)
    return str(response).strip(), _rag_citations(response)


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
    asks_coursework_eligibility = student and any(
        w in q for w in ["course audit", "coursework", "subject", "subjects", "proposal development"]
    ) and any(w in q for w in ["eligible", "clear", "cleared", "move", "ready", "proposal development"])
    asks_portfolio = any(w in q for w in ["delayed", "overdue", "at risk", "risk", "stalled", "which students",
                                          "attention", "bottleneck", "escalate", "behind"])

    if asks_coursework_eligibility:
        out.append(_status_sentence(student, ind))
        if ind["missing_subjects"] == 0:
            out.append(
                "Course-audit eligibility: cleared. All required subjects are marked completed, so the backend rule "
                "can advance an Admission or Coursework student to Proposal Development."
            )
        else:
            out.append(
                f"Course-audit eligibility: not cleared yet. {ind['missing_subjects']} required subject(s) are "
                "missing or incomplete, so the Academic Coordinator should resolve the audit before proposal development."
            )
        if recs:
            out.append("Recommended next step: " + recs[0]["recommendation"] + f" ({recs[0]['owner']}).")

    elif student and (asks_status or (not asks_policy and not asks_portfolio)):
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
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_AI_STUDIO_API_KEY")
    mode = "offline"
    rag_citations = []
    if api_key:
        try:
            answer, rag_citations = call_document_rag(question, snippets, payload, student)
            mode = "document-rag"
        except Exception:
            answer = local_grounded_answer(question, student, payload, snippets)
            mode = "offline-fallback"
    else:
        answer = local_grounded_answer(question, student, payload, snippets)

    policy_citations = [{"id": s["id"], "title": s["title"], "source": s["source"], "text": s["text"]} for s in snippets]
    return {
        "answer": answer,
        "mode": mode,
        "citations": rag_citations or policy_citations,
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
        if role not in ["staff", "student", "dean", "faculty", "admin"]:
            return jsonify({"error": "Choose an account type to sign in."}), 400
        account = UserAccount.query.filter_by(email=email, active=True).first()
        role_matches = bool(
            account
            and (
                (role == "staff" and account.role in BACKOFFICE_ROLES)
                or account.role == role
            )
        )
        if not role_matches or not check_password_hash(account.password_hash, password):
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
        terms = list(reversed(visible_terms()))
        faculty = Faculty.query.filter(Faculty.active.is_(True)).order_by(Faculty.name).all()
        return jsonify(
            {
                "transactions": TRANSACTIONS,
                "stages": STAGES,
                "colleges": COLLEGES,
                "programs": [program_dict(p) for p in programs],
                "terms": [term_dict(t) for t in terms],
                "upcoming_semesters": upcoming_semester_labels(5),
                "faculty": [faculty_dict(f) for f in faculty],
            }
        )

    def parse_api_date(value):
        if not value:
            return None
        try:
            return datetime.strptime(value, "%Y-%m-%d").date()
        except ValueError:
            raise ValueError("Dates must use YYYY-MM-DD format.")

    @app.route("/api/terms/active")
    @require_api_login(*BACKOFFICE_ROLES)
    def active_term():
        term = get_active_term()
        return jsonify({"term": term_dict(term) if term else None})

    @app.route("/api/admin/terms")
    @require_api_login("staff")
    def admin_terms_list():
        # The management page shows every semester (the trimmed prior+active+next
        # window only applies to the pickers elsewhere).
        terms = AcademicTerm.query.order_by(AcademicTerm.start_date.desc()).all()
        return jsonify({"items": [term_dict(term) for term in terms]})

    @app.route("/api/admin/terms/add-next", methods=["POST"])
    @require_api_login("staff")
    def admin_terms_add_next():
        # One-click "add the next semester" — computes the semester that follows the
        # latest one on file, with the standard 1st-Sem (Aug) / 2nd-Sem (Jan) calendar.
        latest = AcademicTerm.query.order_by(AcademicTerm.start_date.desc()).first()
        if not latest or not latest.start_date:
            start = date(date.today().year, 8, 1)
            label = academic_semester_label(date.today().year, 0)
        else:
            sd = latest.start_date
            if sd.month >= 8:  # latest is a 1st Semester -> next is that AY's 2nd Semester
                label, start = academic_semester_label(sd.year, 1), date(sd.year + 1, 1, 10)
            else:  # latest is a 2nd Semester -> next is the following AY's 1st Semester
                label, start = academic_semester_label(sd.year, 0), date(sd.year, 8, 1)
        if AcademicTerm.query.filter_by(label=label).first():
            return jsonify({"error": f"{label} already exists."}), 400
        term = AcademicTerm(label=label, start_date=start, end_date=start + timedelta(days=120))
        db.session.add(term)
        db.session.commit()
        return jsonify({"ok": True, "term": term_dict(term)})

    @app.route("/api/admin/terms", methods=["POST"])
    @require_api_login("staff")
    def admin_terms_create():
        data = request.get_json(silent=True) or {}
        label = (data.get("label") or "").strip()
        if not label:
            return jsonify({"error": "Semester label is required."}), 400
        if not all(split_academic_term_label(label)):
            return jsonify({"error": "Semester label must look like AY 2026-2027 1st Semester."}), 400
        try:
            term = AcademicTerm(
                label=label,
                start_date=parse_api_date(data.get("start_date")),
                end_date=parse_api_date(data.get("end_date")),
                planning_window_open=parse_api_date(data.get("planning_window_open")),
                planning_window_close=parse_api_date(data.get("planning_window_close")),
                grade_submission_deadline=parse_api_date(data.get("grade_submission_deadline")),
                status=(data.get("status") or "").strip() or None,
            )
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        if not term.start_date or not term.end_date:
            return jsonify({"error": "Start and end dates are required."}), 400
        db.session.add(term)
        db.session.commit()
        return jsonify({"ok": True, "term": term_dict(term)})

    @app.route("/api/admin/terms/<int:term_id>", methods=["PATCH"])
    @require_api_login("staff")
    def admin_terms_update(term_id: int):
        term = AcademicTerm.query.get_or_404(term_id)
        data = request.get_json(silent=True) or {}
        if "label" in data:
            label = (data.get("label") or "").strip()
            if not label:
                return jsonify({"error": "Semester label is required."}), 400
            if not all(split_academic_term_label(label)):
                return jsonify({"error": "Semester label must look like AY 2026-2027 1st Semester."}), 400
            term.label = label
        try:
            for field in ["start_date", "end_date", "planning_window_open", "planning_window_close", "grade_submission_deadline"]:
                if field in data:
                    setattr(term, field, parse_api_date(data.get(field)))
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        if "status" in data:
            term.status = (data.get("status") or "").strip() or None
        if not term.start_date or not term.end_date:
            return jsonify({"error": "Start and end dates are required."}), 400
        db.session.commit()
        return jsonify({"ok": True, "term": term_dict(term)})

    @app.route("/api/admin/terms/<int:term_id>", methods=["DELETE"])
    @require_api_login("staff")
    def admin_terms_delete(term_id: int):
        term = AcademicTerm.query.get_or_404(term_id)
        data = request.get_json(silent=True) or {}
        if (data.get("confirmed_label") or "").strip() != term.label:
            return jsonify({
                "error": "Confirm the exact semester label before removal."
            }), 400
        if term.is_active_planning_term:
            return jsonify({
                "error": "The current planning semester cannot be removed. Set another semester as current first."
            }), 409
        dependencies = {
            "student semester records": TermEnrollment.query.filter_by(term_id=term.id).count(),
            "subject enrollments": SubjectEnrollment.query.filter_by(term_id=term.id).count(),
            "residency enrollments": ResidencyEnrollment.query.filter_by(term_id=term.id).count(),
            "course-adjustment plans": CourseOfferingPlan.query.filter(
                or_(
                    CourseOfferingPlan.target_term_id == term.id,
                    CourseOfferingPlan.reference_term_id == term.id,
                )
            ).count(),
        }
        blockers = {label: count for label, count in dependencies.items() if count}
        if blockers:
            detail = ", ".join(f"{count} {label}" for label, count in blockers.items())
            return jsonify({
                "error": (
                    f"{term.label} cannot be removed because it has {detail}. "
                    "Historical semesters with transactions must be kept."
                ),
                "dependencies": blockers,
            }), 409
        academic_year, semester = split_academic_term_label(term.label)
        offerings_query = CurriculumOffering.query.filter_by(
            academic_year=academic_year,
            semester=semester,
        )
        removed_offerings = offerings_query.count()
        offerings_query.delete(synchronize_session=False)
        label = term.label
        db.session.delete(term)
        add_log(
            "academic-semesters",
            None,
            workflow_actor_label(current_account()),
            "Academic Semester settings",
            f"Removed unused semester {label}",
            "Graduate School Staff",
            f"Removed {removed_offerings} unassigned curriculum offering row(s) with the semester.",
            previous_status=label,
            new_status="Removed",
            visibility="internal",
        )
        db.session.commit()
        return jsonify({
            "ok": True,
            "removed_offerings": removed_offerings,
            "message": (
                f"Removed {label} and {removed_offerings} unassigned offering row(s)."
            ),
        })

    @app.route("/api/admin/terms/<int:term_id>/set-active", methods=["PATCH"])
    @require_api_login("staff")
    def admin_terms_set_active(term_id: int):
        term = AcademicTerm.query.get_or_404(term_id)
        current = AcademicTerm.query.filter_by(is_active_planning_term=True).first()
        if current and current.id != term.id:
            blocked = CourseOfferingPlan.query.filter(
                or_(CourseOfferingPlan.target_term_id == current.id, CourseOfferingPlan.term_label == current.label),
                CourseOfferingPlan.status.in_(["Submitted", "Approved"]),
            ).count()
            if blocked:
                return jsonify({"error": "The current active semester has submitted or approved course offering plans. Resolve them before switching.", "blocked_plans": blocked}), 409
        AcademicTerm.query.update({AcademicTerm.is_active_planning_term: False})
        term.is_active_planning_term = True
        db.session.commit()
        return jsonify({"ok": True, "term": term_dict(term)})

    # Dashboard metrics are computed live from transaction-backed tables.
    @app.route("/api/dashboard")
    @require_api_login("staff")
    def dashboard():
        sync_overdue_incomplete_alerts(commit=True)
        return jsonify(dashboard_stats(request.args))

    @app.route("/api/dashboard/drilldown")
    @require_api_login("staff")
    def dashboard_drilldown():
        return jsonify(dashboard_drilldown_payload(request.args))

    # Searchable/paginated directory for the Students page.
    @app.route("/api/students")
    @require_api_login("staff", "academic_coordinator")
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
            risk_values = [item.strip() for item in re.split(r"[,/]", risk) if item.strip()]
            query = query.filter(Student.risk_level.in_(risk_values or [risk]))
        standing = request.args.get("standing", "").strip()
        if standing:
            query = query.filter(Student.standing == standing)
        student_status = request.args.get("student_status", "").strip().lower()
        if student_status == "awol":
            query = query.filter(Student.enrollment_tag == "AWOL")
        elif student_status == "loa":
            query = query.filter(or_(Student.enrollment_tag == "LOA", Student.standing == "On Leave"))
        elif student_status == "compre-eligible":
            eligible_ids = [student.id for student in query.all() if comprehensive_exam_eligibility(student)["eligible"]]
            query = query.filter(Student.id.in_(eligible_ids or [-1]))

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
                "items": [{**student_directory_brief(s), "compre_eligibility": comprehensive_exam_eligibility(s)} for s in items],
                "total": total,
                "page": page,
                "page_size": page_size,
                "pages": (total + page_size - 1) // page_size,
                "integrity": enrollment_integrity_payload(
                    Program.query.get(program_id) if program_id else None,
                    get_active_term(),
                ),
            }
        )

    @app.route("/api/students/duplicates")
    @require_api_login("staff", "academic_coordinator")
    def students_duplicates():
        return jsonify({"groups": duplicate_student_groups()})

    @app.route("/api/students/merge", methods=["POST"])
    @require_api_login("staff", "academic_coordinator")
    def students_merge():
        data = request.get_json(silent=True) or {}
        target = Student.query.get_or_404(int(data.get("target_id") or 0))
        source = Student.query.get_or_404(int(data.get("source_id") or 0))
        overwrite_profile = bool(data.get("overwrite_profile"))
        try:
            moved = merge_student_records(target, source, overwrite_profile=overwrite_profile)
            db.session.commit()
        except Exception as exc:  # noqa: BLE001
            db.session.rollback()
            return jsonify({"error": str(exc)}), 400
        return jsonify({
            "ok": True,
            "student": student_brief(target),
            "moved": moved,
            "message": f"Merged duplicate into {target.name} ({target.student_number}).",
        })

    # Full student profile: lifecycle stage, audit, research, docs, panel,
    # schedules, tasks, activity trail, and decision-support recommendations.
    @app.route("/api/students/<int:student_id>")
    @require_api_login("staff", "academic_coordinator")
    def student_detail(student_id: int):
        sync_overdue_incomplete_alerts(commit=True)
        student = Student.query.get_or_404(student_id)
        audit = compute_course_audit(student)
        research_case, research_progress = sync_research_progress(student)
        document_checks = (
            DocumentCheck.query.filter_by(student_id=student.id)
            .order_by(DocumentCheck.gate, DocumentCheck.item_name)
            .all()
        )
        panel = active_panel_assignments(student, research_progress["gate"])
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
        practicum_record = latest_practicum_record(student.id)
        practicum_eligibility_result = practicum_eligibility(student)
        withdrawal_application = latest_withdrawal_application(student.id)
        graduation_endorsement = latest_graduation_endorsement(student.id)
        awol_case = latest_awol_case(student.id)
        residency_record = latest_residency_enrollment(student.id, active_only=True)
        current_term = get_active_term()
        subject_enrollment = student_enrollment_snapshot(student, current_term)
        docs_by_gate: dict[str, list] = {}
        for doc in document_checks:
            docs_by_gate.setdefault(doc.gate, []).append(document_check_dict(doc))
        pending_drop_by_course = {
            item.course_id: item
            for item in CourseDropRequest.query.filter_by(student_id=student.id, status="Submitted").all()
        }
        course_records = (
            CourseRecord.query.join(Course)
            .filter(CourseRecord.student_id == student.id)
            .order_by(Course.category, Course.code)
            .all()
        )

        return jsonify(
            {
                "student": student_brief(student),
                "stages": STAGES,
                "stage_index": STAGES.index(student.current_stage) if student.current_stage in STAGES else 0,
                "course_audit": course_audit_dict(audit),
                "current_term": term_dict(current_term) if current_term else None,
                "offered_subjects": subject_enrollment["offered_subjects"],
                "subject_enrollments": subject_enrollment["enrollments"],
                "course_records": [course_record_dict(record, pending_drop_by_course.get(record.course_id)) for record in course_records],
                "course_drop_requests": [
                    course_drop_request_dict(item, include_student=False)
                    for item in CourseDropRequest.query.filter_by(student_id=student.id)
                    .order_by(CourseDropRequest.created_at.desc())
                    .limit(20)
                    .all()
                ],
                "research_case": research_case_dict(research_case),
                "research_progress": research_progress,
                "form1_endorsement": form1_endorsement_dict(Form1Endorsement.query.filter_by(student_id=student.id).first()),
                "documents_by_gate": docs_by_gate,
                "panel": [panel_assignment_dict(p) for p in panel],
                "schedules": [schedule_request_dict(s) for s in schedules],
                "practicum_record": practicum_record_dict(practicum_record, include_student=False),
                "practicum_eligibility": practicum_eligibility_result,
                "practicum_timeline": practicum_timeline(practicum_record, practicum_eligibility_result),
                "withdrawal_application": withdrawal_application_dict(withdrawal_application, include_student=False),
                "graduation_endorsement": graduation_endorsement_dict(graduation_endorsement, include_student=False),
                "graduation_eligibility": graduation_eligibility(student),
                "awol_case": awol_case_dict(awol_case, include_student=False) if awol_case else None,
                "residency_record": residency_enrollment_dict(residency_record) if residency_record else None,
                "tasks": [task_dict(t) for t in tasks],
                "logs": [log_dict(l) for l in logs],
                "workflow_messages": [
                    workflow_message_dict(item)
                    for item in WorkflowMessage.query.filter_by(student_id=student.id)
                    .order_by(WorkflowMessage.created_at.desc())
                    .limit(30)
                    .all()
                ],
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

    @app.route("/api/student-portal/messages/read", methods=["POST"])
    @require_api_login("student")
    def student_workflow_messages_read():
        account = current_account()
        data = request_payload()
        message_ids = sorted({
            safe_int(value)
            for value in data.getlist("message_ids")
            if safe_int(value)
        })
        if not message_ids:
            return jsonify({"error": "Choose at least one message to mark as read."}), 400
        rows = WorkflowMessage.query.filter(
            WorkflowMessage.id.in_(message_ids),
            WorkflowMessage.student_id == account.student_id,
            WorkflowMessage.visibility == "student_visible",
            WorkflowMessage.recipient_role == "Student",
        ).all()
        read_at = now_utc()
        for item in rows:
            item.read_at = item.read_at or read_at
        db.session.commit()
        return jsonify({
            "ok": True,
            "updated": len(rows),
            "message_ids": [item.id for item in rows],
            "read_at": iso(read_at),
        })

    # Student-facing portal context. This mirrors the staff record but keeps the
    # response focused on what a student needs to see and act on.
    @app.route("/api/student-portal/context")
    @require_api_login("student")
    def student_portal_context():
        sync_overdue_incomplete_alerts(commit=True)
        account = current_account()
        student_id = account.student_id if account else None
        if not student_id:
            return jsonify({"error": "No students are available in the demo dataset."}), 404

        student = Student.query.get_or_404(student_id)
        audit = compute_course_audit(student)
        research_case, research_progress = sync_research_progress(student)
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
        panel = active_panel_assignments(student, research_progress["gate"])
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
            TransactionLog.query.filter(
                TransactionLog.student_id == student.id,
                or_(
                    TransactionLog.visibility.is_(None),
                    TransactionLog.visibility != "internal",
                ),
            )
            .order_by(TransactionLog.created_at.desc())
            .limit(18)
            .all()
        )
        practicum_record = latest_practicum_record(student.id)
        practicum_eligibility_result = practicum_eligibility(student)
        withdrawal_application = latest_withdrawal_application(student.id)
        graduation_endorsement = latest_graduation_endorsement(student.id)
        awol_case = latest_awol_case(student.id)
        residency_record = latest_residency_enrollment(student.id, active_only=True)
        current_term = get_active_term()
        subject_enrollment = student_enrollment_snapshot(student, current_term)
        docs_by_gate: dict[str, list] = {}
        for doc in document_checks:
            docs_by_gate.setdefault(doc.gate, []).append(document_check_dict(doc))
        pending_drop_by_course = {
            item.course_id: item
            for item in CourseDropRequest.query.filter_by(student_id=student.id, status="Submitted").all()
        }
        course_records = (
            CourseRecord.query.join(Course)
            .filter(CourseRecord.student_id == student.id)
            .order_by(Course.category, Course.code)
            .all()
        )

        portal_student = student_brief(student)
        portal_student["current_stage"] = student_portal_stage(student, research_case)

        return jsonify(
            {
                "student": portal_student,
                "stages": STAGES,
                "stage_index": STAGES.index(portal_student["current_stage"]) if portal_student["current_stage"] in STAGES else 0,
                "course_audit": course_audit_dict(audit),
                "current_term": term_dict(current_term) if current_term else None,
                "offered_subjects": subject_enrollment["offered_subjects"],
                "subject_enrollments": subject_enrollment["enrollments"],
                "course_records": [course_record_dict(record, pending_drop_by_course.get(record.course_id)) for record in course_records],
                "course_drop_requests": [
                    course_drop_request_dict(item, include_student=False)
                    for item in CourseDropRequest.query.filter_by(student_id=student.id)
                    .order_by(CourseDropRequest.created_at.desc())
                    .limit(20)
                    .all()
                ],
                "research_case": research_case_dict(research_case),
                "research_progress": research_progress,
                "form1_endorsement": form1_endorsement_dict(Form1Endorsement.query.filter_by(student_id=student.id).first()),
                "documents_by_gate": docs_by_gate,
                "panel": [panel_assignment_dict(item) for item in panel],
                "schedules": [schedule_request_dict(s) for s in schedules],
                "practicum_record": practicum_record_dict(practicum_record, include_student=False),
                "practicum_eligibility": practicum_eligibility_result,
                "practicum_timeline": practicum_timeline(practicum_record, practicum_eligibility_result),
                "withdrawal_application": withdrawal_application_dict(withdrawal_application, include_student=False),
                "graduation_endorsement": graduation_endorsement_dict(graduation_endorsement, include_student=False),
                "graduation_eligibility": graduation_eligibility(student),
                "awol_case": awol_case_dict(awol_case, include_student=False) if awol_case else None,
                "residency_record": residency_enrollment_dict(residency_record) if residency_record else None,
                "tasks": [task_dict(t) for t in tasks],
                "logs": [log_dict(l) for l in logs],
                "workflow_messages": [
                    workflow_message_dict(item)
                    for item in WorkflowMessage.query.filter_by(
                        student_id=student.id,
                        visibility="student_visible",
                    )
                    .order_by(WorkflowMessage.created_at.desc())
                    .limit(30)
                    .all()
                ],
                "message_templates": WORKFLOW_MESSAGE_TEMPLATES,
                "recommendations": student_portal_recommendations(student),
                "research_milestones": [research_milestone_payload(student, gate) for gate in RESEARCH_MILESTONES],
                "readmission_requirements": readmission_requirements(),
                "upcoming_semesters": upcoming_semester_labels(5),
            }
        )

    @app.route("/api/student-portal/requests/research-gate", methods=["POST"])
    @require_api_login("student")
    def student_research_gate_request():
        data = request_payload()
        account = current_account()
        student = Student.query.get_or_404(account.student_id)
        try:
            require_research_prerequisite(student)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        title = (data.get("research_title") or "").strip()
        source = (data.get("source_reference") or data.get("submitted_package") or "").strip()
        research_case, progress = sync_research_progress(student, title)
        gate = progress["gate"]
        effective_title = (title or (research_case.title if research_case else "")).strip()
        if gate == "Form 1 - Title Defense" and (
            not effective_title or effective_title == "Research title pending Form 1 submission"
        ):
            return jsonify({"error": "Enter the research title shown on Form 1 before submitting."}), 400
        ensure_research_document_checks(student.id, gate)
        milestone = research_milestone_payload(student, gate)
        missing_items = [
            item["label"]
            for item in milestone["requirements"]
            if item["student_upload"] and item["status"] == "Missing"
        ]
        if missing_items:
            return jsonify({"error": f"Upload the required files before submitting: {', '.join(missing_items)}."}), 400
        submitted_items = [
            item["label"]
            for item in milestone["requirements"]
            if item["student_upload"]
        ]
        research_case.status = "Awaiting Review"
        notes = [
            f"Student submitted {milestone['label']} for staff review.",
            f"Research title: {effective_title or 'Not provided'}.",
            f"File-backed items: {', '.join(submitted_items) if submitted_items else 'None uploaded'}.",
            "All student-upload requirements were received. Staff and system requirements remain separate.",
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

    @app.route("/api/student-portal/title-defense/parse", methods=["POST"])
    @require_api_login("student")
    def student_title_defense_parse():
        # Read a Form 1 (Application for Title Defense) PDF and return the fields it
        # contains so the student portal can pre-fill the research-gate form. The
        # file is only scanned for text — it is not stored as evidence here.
        account = current_account()
        student = Student.query.get_or_404(account.student_id)
        try:
            require_research_prerequisite(student)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        uploaded = request.files.get("file")
        if not uploaded or not uploaded.filename:
            return jsonify({"error": "Choose the Form 1 / Title Defense PDF to read."}), 400
        if not (uploaded.filename or "").lower().endswith(".pdf"):
            return jsonify({"error": "Upload the Form 1 as a PDF file."}), 400
        data = uploaded.read()
        if data[:5] != b"%PDF-":
            return jsonify({"error": "The selected file is not a valid PDF."}), 400
        UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
        tmp = UPLOAD_ROOT / f"_titlescan-{uuid4().hex}.pdf"
        tmp.write_bytes(data)
        try:
            text = extract_pdf_text(tmp)
        finally:
            tmp.unlink(missing_ok=True)
        parsed = parse_title_defense_text(text)
        if not parsed.get("research_title"):
            return jsonify({
                "error": "Could not read a research title from that PDF. Make sure it is a Form 1 "
                         "with a 'Research Title:' line.",
            }), 422
        return jsonify({"ok": True, **parsed})

    @app.route("/api/student-portal/research-evidence/upload", methods=["POST"])
    @require_api_login("student")
    def student_research_evidence_upload():
        account = current_account()
        student = Student.query.get_or_404(account.student_id)
        try:
            require_research_prerequisite(student)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        gate = (request.form.get("gate") or "").strip()
        item_name = (request.form.get("item_name") or "").strip()
        uploaded = request.files.get("file")
        _research_case, progress = sync_research_progress(student)
        if gate != progress["gate"]:
            return jsonify({"error": f"This upload belongs to {progress['stage']}, the automatically detected current stage."}), 400
        if item_name not in required_documents_for_gate(gate):
            return jsonify({"error": "Choose a valid requirement for this gate."}), 400
        if gate == "Form 1 - Title Defense" and item_name in {"Form 1 - Application for Title Defense", "Three concept papers"} and active_panel_assignments(student, gate):
            return jsonify({"error": "Title-defense uploads are locked because a panel has already been matched."}), 409
        presentation = research_requirement_presentation(gate, item_name)
        if not presentation or presentation["source_type"] != "student_upload":
            return jsonify({"error": "This requirement is completed by staff or by the system and does not accept a student upload."}), 400
        if not uploaded or not uploaded.filename:
            return jsonify({"error": "Choose a PDF file to upload."}), 400
        replaced_paths: list[Path] = []
        try:
            if item_name == "Three concept papers":
                revoke_form1_endorsement(student.id)
            evidence = store_research_evidence(student, gate, item_name, uploaded)
            if item_name == "Ethics Clearance":
                replaced_paths = replace_research_evidence_files(evidence.document_check, evidence)
                ethics_record = DocumentCheck.query.filter_by(
                    student_id=student.id,
                    gate=gate,
                    item_name="Ethics clearance status and date",
                ).first()
                if ethics_record:
                    ethics_record.status = "Missing"
                    ethics_record.evidence_reference = None
                    ethics_record.updated_at = now_utc()
            compliance = None
            if gate == "Form 1 - Title Defense" and item_name == "Three concept papers":
                compliance = apply_concept_paper_evaluation(evidence)
            parsed_title = ""
            if gate == "Form 1 - Title Defense" and item_name == "Form 1 - Application for Title Defense":
                parsed = parse_title_defense_text(evidence.extracted_text or "")
                parsed_title = (parsed.get("research_title") or "").strip()
                if not parsed_title:
                    (UPLOAD_ROOT / evidence.stored_name).unlink(missing_ok=True)
                    raise ValueError(
                        "Could not read a research title from that Form 1 PDF. "
                        "Make sure it includes a 'Research Title:' line."
                    )
                if parsed_title:
                    sync_research_progress(student, parsed_title)
            research_case, _progress = sync_research_progress(student)
            add_task(student.id, f"Review submitted {item_name}", "Research Coordinator", 3, 35)
            add_log(
                "research-gate",
                student.id,
                "Student",
                evidence.original_name,
                f"{item_name} submitted",
                "Research Coordinator",
                f"Student uploaded file-backed evidence for {gate}. Staff evaluation is derived from stored files.",
            )
            db.session.commit()
            for path in replaced_paths:
                path.unlink(missing_ok=True)
        except Exception as exc:  # noqa: BLE001
            db.session.rollback()
            return jsonify({"error": str(exc)}), 400
        return jsonify({
            "ok": True,
            "document": document_check_dict(evidence.document_check),
            "research_title": parsed_title or (research_case.title if research_case else ""),
            "compliance": compliance,
        })

    @app.route("/api/student-portal/research-evidence/<int:evidence_id>", methods=["DELETE"])
    @require_api_login("student")
    def student_research_evidence_delete(evidence_id: int):
        account = current_account()
        student = Student.query.get_or_404(account.student_id)
        evidence = ResearchEvidenceFile.query.filter_by(id=evidence_id, student_id=student.id).first_or_404()
        doc = evidence.document_check
        presentation = research_requirement_presentation(doc.gate, doc.item_name)
        if not presentation or presentation["source_type"] != "student_upload":
            return jsonify({"error": "Only student-uploaded research evidence can be removed from the student view."}), 400
        if doc.gate == "Form 1 - Title Defense" and active_panel_assignments(student, doc.gate):
            return jsonify({"error": "Title-defense uploads are locked because a panel has already been matched."}), 409

        stored_path = UPLOAD_ROOT / evidence.stored_name
        original_name = evidence.original_name
        db.session.delete(evidence)
        db.session.flush()
        remaining = (
            ResearchEvidenceFile.query.filter_by(
                student_id=student.id,
                document_check_id=doc.id,
            )
            .order_by(ResearchEvidenceFile.uploaded_at.desc())
            .all()
        )
        required_count = research_requirement_presentation(doc.gate, doc.item_name)["required_file_count"]
        doc.status = "Submitted" if len(remaining) >= required_count else "Missing"
        doc.evidence_reference = ", ".join(item.original_name for item in remaining) or None
        doc.updated_at = now_utc()

        # Any student upload used by the current gate can affect that gate's
        # matching source, so clear only the active gate panel.
        panel_invalidated = True
        clear_panel_for_research_gate(student, doc.gate)
        endorsement_revoked = False
        if doc.gate == "Form 1 - Title Defense":
            endorsement = Form1Endorsement.query.filter_by(student_id=student.id).first()
            endorsement_revoked = bool(endorsement)
            if endorsement:
                db.session.delete(endorsement)
            endorsement_doc = DocumentCheck.query.filter_by(
                student_id=student.id,
                gate="Form 1 - Title Defense",
                item_name="Academic Coordinator endorsement/e-signature",
            ).first()
            if endorsement_doc:
                endorsement_doc.status = "Missing"
                endorsement_doc.evidence_reference = None
                endorsement_doc.updated_at = now_utc()
        sync_research_progress(student)
        add_log(
            "research-gate",
            student.id,
            "Student",
            original_name,
            f"{doc.item_name} removed",
            "Student" if len(remaining) < required_count else "Academic Coordinator",
            f"Student removed a {doc.gate} upload. {len(remaining)} of {required_count} remain for {doc.item_name}. "
            + ("Academic Coordinator endorsement was revoked and " if endorsement_revoked else "")
            + "Panel Matching was cleared for this stage.",
        )
        db.session.commit()
        stored_path.unlink(missing_ok=True)
        return jsonify({
            "ok": True,
            "message": "Upload removed. The Academic Coordinator must endorse the completed title-defense package again, and Panel Matching must be rerun.",
            "remaining_count": len(remaining),
            "panel_invalidated": panel_invalidated,
            "endorsement_revoked": endorsement_revoked,
        })

    @app.route("/api/student-portal/request-attachments/upload", methods=["POST"])
    @require_api_login("student")
    def student_request_attachment_upload():
        account = current_account()
        student = Student.query.get_or_404(account.student_id)
        request_type = (request.form.get("request_type") or "").strip()
        uploaded = request.files.get("file")
        if request_type not in REQUEST_ATTACHMENT_WORKFLOWS:
            return jsonify({"error": "Choose a valid request type."}), 400
        if not uploaded or not uploaded.filename:
            return jsonify({"error": "Choose a PDF application file."}), 400
        if request_type == "practicum":
            record = latest_practicum_record(student.id)
            if not record and not practicum_eligibility(student)["eligible"]:
                return jsonify({"error": "Practicum uploads are locked until the eligibility check is complete."}), 409
            if practicum_student_submission_stage(record) == "locked":
                return jsonify({"error": "This practicum stage is awaiting reviewer action. Future uploads are locked."}), 409
        elif request_type == "withdrawal":
            application = latest_withdrawal_application(student.id)
            editable_statuses = {"Returned", "Returned for Clarification", "Denied", "Requirements Pending"}
            if application and application.status not in editable_statuses:
                return jsonify({"error": "This withdrawal stage is awaiting reviewer action. Future uploads are locked."}), 409
        elif request_type == "awol-return":
            if student.enrollment_tag != "AWOL" and student.standing != "AWOL":
                return jsonify({"error": "Return-from-AWOL documents are available only while the student is recorded AWOL."}), 409
            awol_case = latest_awol_case(student.id)
            if awol_case and awol_case.status in {"Dean Review", "Return Approved", "Extension Approved - Refresher Required", "Re-enrollment Required"}:
                return jsonify({"error": "This AWOL return stage is awaiting or has completed Dean action. Future uploads are locked."}), 409
        elif request_type in {"graduation", "graduation-endorsement"}:
            endorsement = latest_graduation_endorsement(student.id)
            if endorsement and endorsement.endorsement_status not in {"Not Eligible", "Returned for Clarification"}:
                return jsonify({"error": "This graduation stage is awaiting reviewer action. Future uploads are locked."}), 409
        try:
            attachment = store_student_request_attachment(student, request_type, uploaded, account)
            db.session.commit()
        except Exception as exc:  # noqa: BLE001
            db.session.rollback()
            return jsonify({"error": str(exc)}), 400
        return jsonify({
            "ok": True,
            "attachment": {
                "id": attachment.id,
                "name": attachment.original_name,
                "url": f"/api/student-request-attachments/{attachment.id}/file",
            },
        })

    @app.route("/api/student-portal/requests/course-drop", methods=["POST"])
    @require_api_login("student")
    def student_course_drop_request():
        data = request_payload()
        account = current_account()
        student = Student.query.get_or_404(account.student_id)
        course = Course.query.get_or_404(safe_int(data.get("course_id")))
        record = CourseRecord.query.filter_by(student_id=student.id, course_id=course.id).first()
        if not record or record.status not in {"Enrolled", "Current", "Incomplete"}:
            return jsonify({"error": "Only current, enrolled, or incomplete subjects can be requested for dropping."}), 400
        active = CourseDropRequest.query.filter_by(student_id=student.id, course_id=course.id, status="Submitted").first()
        if active:
            return jsonify({"error": "You already submitted a drop request for this subject."}), 400
        reason = (data.get("reason") or "").strip()
        if not reason:
            return jsonify({"error": "Enter the reason for dropping this subject."}), 400
        attachment = request_attachment_from_payload(student, "course-drop", data)
        request_item = CourseDropRequest(
            student_id=student.id,
            course_id=course.id,
            term_label=(data.get("term_label") or record.term_label or "").strip(),
            reason=reason,
            attachment_id=attachment.id if attachment else None,
            status="Submitted",
        )
        db.session.add(request_item)
        add_task(student.id, f"Review course drop request for {course.code}", "Academic Coordinator", 3, 45)
        add_log(
            "course-audit",
            student.id,
            "Student",
            attachment.original_name if attachment else "Student portal",
            f"Drop request submitted for {course.code}",
            "Academic Coordinator",
            f"Reason: {reason}. Semester: {request_item.term_label or record.term_label or 'Not specified'}.",
        )
        db.session.commit()
        return jsonify({"ok": True, "message": "Drop request submitted. The Academic Coordinator will review it before your record changes."})

    @app.route("/api/student-portal/requests/leave-of-absence", methods=["POST"])
    @require_api_login("student")
    def student_loa_request():
        data = request_payload()
        account = current_account()
        student = Student.query.get_or_404(account.student_id)
        attachment = request_attachment_from_payload(student, "leave-of-absence", data)
        if not attachment:
            return jsonify({"error": "Upload the completed LOA application PDF before submitting."}), 400
        source = attachment.original_name
        effective_start = (data.get("effective_start") or "").strip()
        effective_end = (data.get("effective_end") or "").strip()
        period = " to ".join([part for part in [effective_start, effective_end] if part]) or "Not specified"
        notes = [
            "Student submitted a Leave of Absence application for staff eligibility review.",
            f"Requested period: {period}.",
        ]
        if data.get("reason_remarks"):
            notes.append(f"Reason/remarks: {data.get('reason_remarks')}.")
        notes.append(f"Application PDF: {attachment.original_name}.")

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
        attachment = request_attachment_from_payload(student, "readmission", data)
        if not attachment:
            return jsonify({"error": "Upload the completed readmission application PDF before submitting."}), 400
        source = attachment.original_name
        submitted = set(data.getlist("readmission_items"))
        missing = [item for item in readmission_requirements() if item not in submitted]
        notes = [
            "Student submitted a readmission request for staff review.",
            f"Target return semester: {data.get('target_return_term') or 'Not specified'}.",
            f"Checklist submitted: {len(submitted)} item(s); missing/not marked: {', '.join(missing) if missing else 'None'}.",
        ]
        if data.get("previous_loa_period"):
            notes.append(f"Previous LOA period: {data.get('previous_loa_period')}.")
        notes.append(f"Application PDF: {attachment.original_name}.")

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

    @app.route("/api/student-portal/requests/awol-return", methods=["POST"])
    @require_api_login("student")
    def student_awol_return_request():
        data = request_payload()
        account = current_account()
        student = Student.query.get_or_404(account.student_id)
        if student.enrollment_tag != "AWOL" and student.standing != "AWOL":
            return jsonify({"error": "A return-from-AWOL request can be filed only while your record is marked AWOL."}), 409
        attachment = request_attachment_from_payload(student, "awol-return", data)
        if not attachment:
            return jsonify({"error": "Upload your written intent to enroll before submitting."}), 400
        target_return_term = (data.get("target_return_term") or "").strip()
        if not target_return_term:
            return jsonify({"error": "Choose the semester when you intend to return."}), 400
        item = latest_awol_case(student.id)
        if item and item.status not in {"AWOL Declared", "Return Denied", "Returned for Revision", "Return Submitted"}:
            return jsonify({"error": "Your current AWOL return case cannot be resubmitted at this stage."}), 409
        if not item:
            item = AwolCase(
                student_id=student.id,
                status="AWOL Declared",
                awol_effective_date=date.today(),
                last_enrolled_term=(data.get("last_enrolled_term") or "").strip() or None,
            )
            db.session.add(item)
            db.session.flush()
        review = awol_policy_review(student, {
            "workflow_action": "return_from_awol",
            "application_reference": attachment.original_name,
        })
        item.status = "Return Submitted"
        item.return_requested_at = now_utc()
        item.target_return_term = target_return_term
        item.intent_attachment_id = attachment.id
        item.years_in_program = review["limits"]["years_in_program"]
        item.normal_residence_years = review["limits"]["normal_years"]
        item.absolute_residence_years = review["limits"]["absolute_years"]
        item.policy_classification = review["classification"]
        item.refresher_required = review["refresher_required"]
        item.full_reenrollment_required = review["full_reenrollment_required"]
        item.dean_decision = "Not Submitted"
        item.updated_at = now_utc()
        bind_workflow_attachment(attachment, item, "Return Submitted", account)
        add_task(student.id, "Review written intent to return from AWOL", "GS Staff", 3, 65)
        add_log(
            "awol", student.id, "Student", attachment.original_name,
            "AWOL return intent submitted", "GS Staff",
            f"Target return semester: {target_return_term}. Policy classification: {item.policy_classification}.",
            previous_status="AWOL Declared", new_status="Return Submitted",
        )
        db.session.commit()
        return jsonify({"ok": True, "message": "Submitted. Graduate School staff will review your written return intent and route it to the Dean."})

    @app.route("/api/student-portal/requests/practicum", methods=["POST"])
    @require_api_login("student")
    def student_practicum_request():
        data = request_payload()
        account = current_account()
        student = Student.query.get_or_404(account.student_id)
        if not student.program.has_practicum:
            return jsonify({"error": "Practicum is available only for programs with practicum requirements."}), 400

        record = latest_practicum_record(student.id)
        eligibility = practicum_eligibility(student)
        if not record and not eligibility["eligible"]:
            return jsonify({
                "error": "Your practicum eligibility check is not complete. The MOA stage will unlock after the current requirements are verified."
            }), 409
        stage = practicum_student_submission_stage(record)
        if stage == "locked":
            return jsonify({"error": "This practicum stage is awaiting reviewer action. Your submitted information remains saved and read-only."}), 400

        previous_status = record.status if record else "Not Submitted"
        previous_certificate_attachment_id = record.certificate_attachment_id if record else None
        if stage == "moa":
            moa_attachment = request_attachment_from_payload(student, "practicum", data)
            if not moa_attachment:
                return jsonify({"error": "Upload the practicum MOA PDF before submitting this stage."}), 400
            practicum_site = (data.get("practicum_site") or "").strip()
            if not practicum_site:
                return jsonify({"error": "Enter the practicum site or company for the MOA stage."}), 400
            if not record:
                record = PracticumRecord(student_id=student.id)
                db.session.add(record)
            record.practicum_site = practicum_site
            record.supervisor_name = (data.get("supervisor_name") or record.supervisor_name or "").strip()
            record.required_hours = record.required_hours or 200
            record.moa_attachment_id = moa_attachment.id
            record.moa_uploaded = True
            record.moa_status = "Uploaded"
            record.remarks = (data.get("remarks") or record.remarks or "").strip()
            record.status = "MOA Submitted"
            record.updated_at = now_utc()
            db.session.flush()
            bind_workflow_attachment(moa_attachment, record, "MOA Submission", account)
            add_task(student.id, "Record and forward practicum MOA", "Graduate School Staff", 3, 45)
            next_owner = "Graduate School Staff"
            message = "MOA submitted. Graduate School staff will record and forward it to the Academic Coordinator."
        else:
            certificate_id = safe_int(data.get("certificate_attachment_id"), 0)
            certificate = StudentRequestAttachment.query.filter_by(
                id=certificate_id,
                student_id=student.id,
                request_type="practicum",
            ).first()
            if not certificate:
                return jsonify({"error": "Upload the practicum completion documents PDF before submitting this stage."}), 400
            if (
                previous_status in {"Hours Incomplete", "Additional Certificates Requested"}
                and previous_certificate_attachment_id
                and certificate.id == previous_certificate_attachment_id
            ):
                return jsonify({"error": "Upload the requested additional practicum PDF before resubmitting this stage."}), 400
            record.certificate_attachment_id = certificate.id
            record.completed_hours = max(safe_int(data.get("completed_hours"), record.completed_hours or 0), 0)
            record.certificate_count = max(safe_int(data.get("certificate_count"), record.certificate_count or 0), 0)
            record.document_status = "Pending Review"
            record.remarks = (data.get("remarks") or record.remarks or "").strip()
            record.updated_at = now_utc()
            if record.completed_hours < record.required_hours:
                record.status = "Hours Incomplete"
                message = "Documents submitted. Graduate School staff will record and forward them to the Academic Coordinator."
            else:
                record.status = "Documents Submitted"
                message = "Documents and hours submitted. Graduate School staff will record and forward them to the Academic Coordinator."
            add_task(student.id, "Record and forward practicum documents", "Graduate School Staff", 3, 45)
            next_owner = "Graduate School Staff"
            bind_workflow_attachment(certificate, record, "Practicum Document Submission", account)

        resolve_student_returns("practicum", student.id)

        source_attachment = record.certificate_attachment if stage == "completion" else record.moa_attachment
        add_log(
            "practicum",
            student.id,
            "Student",
            source_attachment.original_name if source_attachment else "Student portal",
            f"Practicum submission recorded: {record.status}",
            next_owner,
            practicum_notes(record),
            previous_status=previous_status,
            new_status=record.status,
        )
        recompute_risk(student)
        db.session.commit()
        return jsonify({"ok": True, "message": message})

    @app.route("/api/student-portal/requests/withdrawal", methods=["POST"])
    @require_api_login("student")
    def student_withdrawal_request():
        data = request_payload()
        account = current_account()
        student = Student.query.get_or_404(account.student_id)
        current = latest_withdrawal_application(student.id)
        proof_attachment_id = safe_int(data.get("proof_attachment_id"), 0)
        if current and current.dean_decision == "Approved" and proof_attachment_id:
            if current.status != "Requirements Pending":
                return jsonify({"error": "Wait for the Academic Coordinator and Graduate School staff to complete the approved-request follow-through before submitting requirements."}), 400
            proof = StudentRequestAttachment.query.filter_by(
                id=proof_attachment_id, student_id=student.id, request_type="withdrawal"
            ).first()
            if not proof:
                return jsonify({"error": "Upload a valid withdrawal form/proof PDF."}), 400
            previous_status = current.status
            current.proof_attachment_id = proof.id
            current.status = "Requirements Submitted"
            current.updated_at = now_utc()
            bind_workflow_attachment(proof, current, "Withdrawal Requirements", account)
            add_task(student.id, "Check submitted withdrawal form and proof", "Graduate School Staff", 3, 50)
            add_log(
                "withdrawal", student.id, "Student", proof.original_name,
                "Withdrawal requirements submitted", "Graduate School Staff",
                "Approved request follow-through proof is ready for staff verification.",
                previous_status=previous_status, new_status=current.status,
            )
            db.session.commit()
            return jsonify({"ok": True, "message": "Requirements submitted. Graduate School staff will verify your form and proof."})
        if current and current.status not in {"Denied", "Returned", "Returned for Clarification", "Withdrawn Confirmed"}:
            return jsonify({"error": "You already have an active withdrawal request. Follow its current status instead of creating another request."}), 400
        attachment = request_attachment_from_payload(student, "withdrawal", data)
        if not attachment:
            return jsonify({"error": "Upload the completed withdrawal request PDF before submitting."}), 400
        if not (data.get("reason") or (current.reason if current else "")):
            return jsonify({"error": "Enter the reason for withdrawal before submitting."}), 400
        if not (data.get("effective_term") or (current.effective_term if current else "")):
            return jsonify({"error": "Enter the effective semester before submitting."}), 400

        previous_status = current.status if current else "Not Submitted"
        application = current if current and current.status in {"Returned", "Returned for Clarification"} else WithdrawalApplication(student_id=student.id)
        if not application.id:
            db.session.add(application)
        application.reason = (data.get("reason") or application.reason or "").strip()
        application.effective_term = (data.get("effective_term") or application.effective_term or "").strip()
        application.request_attachment_id = attachment.id
        application.proof_attachment_id = proof_attachment_id or application.proof_attachment_id
        application.fee_status = "Pending"
        application.requirement_status = "Pending"
        application.dean_decision = "Pending"
        application.registrar_status = "Pending"
        application.status = "Submitted to GS Staff"
        application.decided_at = None
        application.completed_at = None
        application.updated_at = now_utc()
        db.session.flush()
        bind_workflow_attachment(attachment, application, "Withdrawal Application", account)
        if application.proof_attachment_id:
            bind_workflow_attachment(application.proof_attachment, application, "Withdrawal Requirements", account)
        resolve_student_returns("withdrawal", student.id)
        add_task(student.id, "Record and forward withdrawal request", "Graduate School Staff", 3, 60)
        add_log(
            "withdrawal",
            student.id,
            "Student",
            attachment.original_name,
            "Withdrawal request submitted",
            "Graduate School Staff",
            f"Effective semester: {application.effective_term or 'Not specified'}. Reason: {application.reason or 'Not provided'}. File is uploaded for staff recording and forwarding.",
            previous_status=previous_status,
            new_status=application.status,
        )
        db.session.commit()
        return jsonify({"ok": True, "message": "Submitted. Graduate School staff will record and forward your request to the Dean."})

    @app.route("/api/student-portal/requests/graduation", methods=["POST"])
    @require_api_login("student")
    def student_graduation_request():
        data = request_payload()
        account = current_account()
        student = Student.query.get_or_404(account.student_id)
        attachment = request_attachment_from_payload(student, "graduation", data)
        eligibility = graduation_eligibility(student)
        endorsement = latest_graduation_endorsement(student.id)
        if endorsement and endorsement.endorsement_status not in {"Not Eligible", "Returned for Clarification"}:
            return jsonify({"error": "Your graduation request is already in review. Submitted details remain saved while the current reviewer completes the next stage."}), 400
        previous_status = endorsement.endorsement_status if endorsement else "Not Submitted"
        if not endorsement:
            endorsement = GraduationEndorsement(student_id=student.id)
            db.session.add(endorsement)
        apply_graduation_eligibility(endorsement, eligibility)
        endorsement.review_window = (data.get("review_window") or data.get("term") or "Current review window").strip()
        endorsement.request_attachment_id = attachment.id if attachment else endorsement.request_attachment_id
        # Eligibility is displayed as monitoring context, but the workflow decision
        # is recorded only after the AC and Research Coordinator reviews.
        endorsement.endorsement_status = "For Review"
        endorsement.submitted_at = now_utc()
        endorsement.updated_at = now_utc()
        db.session.flush()
        bind_workflow_attachment(attachment, endorsement, "Graduation Application", account)
        resolve_student_returns("graduation", student.id)
        next_owner = "Graduate School Staff"
        add_task(
            student.id,
            "Compile graduation candidate for role-based review",
            next_owner,
            5,
            45,
        )
        add_log(
            "graduation",
            student.id,
            "Student",
            attachment.original_name if attachment else "Student portal",
            f"Graduation endorsement request submitted: {endorsement.endorsement_status}",
            next_owner,
            graduation_notes(endorsement),
            previous_status=previous_status,
            new_status=endorsement.endorsement_status,
        )
        db.session.commit()
        return jsonify({
            "ok": True,
            "message": "Submitted. Graduate School staff will review your graduation endorsement readiness.",
        })

    @app.route("/api/student-portal/requests/defense-scheduling", methods=["POST"])
    @require_api_login("student")
    def student_defense_schedule_request():
        data = request_payload()
        account = current_account()
        student = Student.query.get_or_404(account.student_id)
        if not active_panel_assignments(student):
            return jsonify({"error": "Panel matching must be completed before requesting a defense schedule."}), 400
        source = (data.get("venue") or "").strip()
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

    @app.route("/api/student-portal/documents/<int:document_id>/upload", methods=["POST"])
    @require_api_login("student")
    def student_document_upload(document_id: int):
        account = current_account()
        student = Student.query.get_or_404(account.student_id)
        doc = DocumentCheck.query.filter_by(id=document_id, student_id=student.id).first_or_404()
        if doc.gate == "Form 1 - Title Defense" and doc.item_name in {"Form 1 - Application for Title Defense", "Three concept papers"} and active_panel_assignments(student, doc.gate):
            return jsonify({"error": "Title-defense uploads are locked because a panel has already been matched."}), 409
        uploaded = request.files.get("file")
        if not uploaded or not uploaded.filename:
            return jsonify({"error": "Please choose a PDF supporting document."}), 400
        try:
            if doc.item_name == "Three concept papers":
                revoke_form1_endorsement(student.id)
            evidence = store_research_evidence(student, doc.gate, doc.item_name, uploaded, doc)
        except Exception as exc:  # noqa: BLE001
            db.session.rollback()
            return jsonify({"error": str(exc)}), 400
        add_task(student.id, f"Review submitted {doc.item_name}", "Research Coordinator", 3, 35)
        add_log(
            "research-gate",
            student.id,
            "Student",
            evidence.original_name,
            f"{doc.item_name} submitted",
            "Research Coordinator",
            f"Student uploaded a supporting document for {doc.gate}. Staff must verify before marking it complete.",
        )
        db.session.commit()
        return jsonify({"ok": True, "message": "Submitted. Staff will verify the supporting document."})

    @app.route("/api/research-evidence/<int:evidence_id>/file")
    @require_api_login()
    def research_evidence_file(evidence_id: int):
        evidence = ResearchEvidenceFile.query.get_or_404(evidence_id)
        account = current_account()
        if account.role == "student" and account.student_id != evidence.student_id:
            return jsonify({"error": "You cannot access this file."}), 403
        if account.role == "faculty" and not faculty_can_access_research_evidence(account.faculty_id, evidence):
            return jsonify({"error": "You can view only papers for your advisees or assigned panel students."}), 403
        return send_from_directory(
            UPLOAD_ROOT,
            evidence.stored_name,
            as_attachment=False,
            download_name=evidence.original_name,
            mimetype=evidence.mime_type,
        )

    @app.route("/api/research-evidence/<int:evidence_id>/concept-paper-compliance", methods=["POST"])
    @require_api_login("student", "staff", "academic_coordinator", "research_coordinator")
    def research_evidence_concept_paper_compliance(evidence_id: int):
        evidence = ResearchEvidenceFile.query.get_or_404(evidence_id)
        account = current_account()
        if account.role == "student" and account.student_id != evidence.student_id:
            return jsonify({"error": "You can evaluate only your own concept paper."}), 403
        if not evidence.document_check or evidence.document_check.item_name != "Three concept papers":
            return jsonify({"error": "Concept paper compliance is available only for concept-paper uploads."}), 400
        result = apply_concept_paper_evaluation(evidence)
        add_log(
            "research-gate",
            evidence.student_id,
            workflow_actor_label(account),
            evidence.original_name,
            f"Concept paper compliance checked: {result['status']}",
            "Academic Coordinator",
            result["summary"],
        )
        db.session.commit()
        return jsonify({"ok": True, "compliance": result})

    @app.route("/api/research-gate/template")
    @require_api_login()
    def research_gate_template():
        student = Student.query.get_or_404(int(request.args.get("student_id") or 0))
        account = current_account()
        if account.role == "student" and account.student_id != student.id:
            return jsonify({"error": "You cannot access this template."}), 403
        gate = (request.args.get("gate") or "").strip()
        item_name = (request.args.get("item_name") or "").strip()
        if gate not in RESEARCH_MILESTONES or item_name not in required_documents_for_gate(gate):
            return jsonify({"error": "Unknown Research Gate template."}), 404
        research_case = ResearchCase.query.filter_by(student_id=student.id).order_by(ResearchCase.opened_at.desc()).first()
        progress = detected_research_progress(student)
        presentation = research_requirement_presentation(gate, item_name)
        values = {
            "Student ID": student.student_number,
            "Student name": student.name,
            "Program": student.program.name,
            "Research title": research_case.title if research_case else "To be completed from Form 1",
            "Adviser": student.adviser_name or "To be assigned",
            "Current research stage": progress["stage"],
        }
        fields = "".join(
            f"<tr><th>{html.escape(label)}</th><td>{html.escape(str(value))}</td></tr>"
            for label, value in values.items()
        )
        body = f"""<!doctype html><html><head><meta charset='utf-8'><title>{html.escape(presentation['label'])}</title>
        <style>body{{font:15px Arial,sans-serif;color:#172033;max-width:850px;margin:40px auto;padding:0 24px}}h1{{color:#176b55}}.meta{{color:#526071}}table{{width:100%;border-collapse:collapse;margin:24px 0}}th,td{{border:1px solid #d7dee8;padding:12px;text-align:left}}th{{width:32%;background:#f4f7f6}}.box{{min-height:180px;border:1px dashed #9ba8b7;padding:18px;margin-top:24px}}@media print{{button{{display:none}}}}</style></head>
        <body><button onclick='window.print()'>Print / Save as PDF</button><p class='meta'>USLS Graduate School · Research Gate working template</p>
        <h1>{html.escape(presentation['label'])}</h1><p>{html.escape(presentation['description'])}</p><table>{fields}</table>
        <div class='box'><strong>Form / document content</strong><p>This MVP template simulates the working document. Complete the applicable details, signatures, manuscript, or supporting evidence, then save it as PDF for upload.</p></div></body></html>"""
        return Response(body, mimetype="text/html")

    @app.route("/api/research-gate/form1-endorsements")
    @require_api_login("academic_coordinator")
    def form1_endorsement_queue():
        form_docs = (
            DocumentCheck.query.filter_by(gate="Form 1 - Title Defense", item_name="Form 1 - Application for Title Defense")
            .order_by(DocumentCheck.updated_at.desc())
            .all()
        )
        rows = []
        for doc in form_docs:
            if not doc.evidence_files:
                continue
            student = Student.query.get(doc.student_id)
            endorsement = Form1Endorsement.query.filter_by(student_id=student.id).first() if concept_paper_package_ready(student.id) else None
            case = ResearchCase.query.filter_by(student_id=student.id).order_by(ResearchCase.opened_at.desc()).first()
            rows.append({
                "student": student_brief(student),
                "research_title": case.title if case else "Research title pending Form 1 submission",
                "form": document_check_dict(doc),
                "endorsement": form1_endorsement_dict(endorsement),
                "current_stage": detected_research_progress(student)["stage"],
            })
        return jsonify({"items": rows})

    @app.route("/api/research-gate/form1-endorsements/<int:student_id>", methods=["POST"])
    @require_api_login("academic_coordinator")
    def endorse_form1(student_id: int):
        student = Student.query.get_or_404(student_id)
        try:
            require_research_prerequisite(student)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        data = request_payload()
        doc = DocumentCheck.query.filter_by(
            student_id=student.id,
            gate="Form 1 - Title Defense",
            item_name="Form 1 - Application for Title Defense",
        ).first()
        if not doc or not doc.evidence_files:
            return jsonify({"error": "The student must upload Form 1 before it can be endorsed."}), 400
        if not concept_paper_package_ready(student.id):
            return jsonify({"error": "The student must upload all three concept papers before Form 1 can be endorsed."}), 400
        signature_data = (data.get("signature_data") or "").strip()
        if signature_data and (not signature_data.startswith("data:image/png;base64,") or len(signature_data) > 750000):
            return jsonify({"error": "The drawn signature is not a valid PNG image."}), 400
        if not signature_data:
            return jsonify({"error": "Draw and finalize the coordinator signature before endorsing Form 1."}), 400
        account = current_account()
        endorsement = Form1Endorsement.query.filter_by(student_id=student.id).first()
        if not endorsement:
            endorsement = Form1Endorsement(student_id=student.id, coordinator_name=account.full_name)
            db.session.add(endorsement)
        endorsement.coordinator_name = account.full_name
        endorsement.signature_data = signature_data or None
        endorsement.status = "Endorsed"
        endorsement.endorsed_at = now_utc()
        doc.status = "Complete"
        doc.updated_at = now_utc()
        sync_research_progress(student)
        add_log(
            "research-gate", student.id, "Academic Coordinator", doc.evidence_reference,
            "Form 1 endorsed", "Research Coordinator",
            f"Endorsed in-system by {endorsement.coordinator_name} using account {account.full_name} at {iso(endorsement.endorsed_at)}.",
        )
        db.session.commit()
        return jsonify({"ok": True, "message": "Form 1 endorsed successfully.", "endorsement": form1_endorsement_dict(endorsement)})

    @app.route("/api/student-request-attachments/<int:attachment_id>/file")
    @require_api_login()
    def student_request_attachment_file(attachment_id: int):
        attachment = StudentRequestAttachment.query.get_or_404(attachment_id)
        account = current_account()
        workflow_slug = REQUEST_ATTACHMENT_WORKFLOWS.get(attachment.request_type)
        if account.role == "student" and account.student_id != attachment.student_id:
            return jsonify({"error": "You cannot access this file."}), 403
        if account.role == "faculty":
            return jsonify({"error": "This account cannot access student request files."}), 403
        if account.role == "dean" and workflow_slug not in {
            "leave-of-absence", "readmission", "practicum", "withdrawal", "graduation",
        }:
            return jsonify({"error": "This file is outside the Dean review workflows."}), 403
        allowed = ROLE_TRANSACTION_ACCESS.get(account.role)
        if allowed is not None and workflow_slug not in allowed:
            return jsonify({"error": "This file belongs to a workflow not assigned to your role."}), 403
        if not (REQUEST_UPLOAD_ROOT / attachment.stored_name).is_file():
            return jsonify({"error": "The uploaded file is unavailable. Ask the submitting user to upload it again."}), 404
        return send_from_directory(
            REQUEST_UPLOAD_ROOT,
            attachment.stored_name,
            as_attachment=False,
            download_name=attachment.original_name,
            mimetype=attachment.mime_type,
        )

    # Role-filterable work queue.
    @app.route("/api/tasks")
    @require_api_login(*BACKOFFICE_ROLES)
    def tasks_list():
        sync_overdue_incomplete_alerts(commit=True)
        owner = request.args.get("owner", "").strip()
        status = request.args.get("status", "").strip()
        query = Task.query.filter(Task.status.in_(["Pending", "Overdue"]))
        if owner:
            query = query.filter(Task.owner_role == owner)
        if status == "Overdue":
            query = query.filter(Task.due_at < date.today(), Task.status != "Done")
        tasks = query.order_by(Task.priority.desc(), Task.due_at.asc()).limit(100).all()
        return jsonify({"items": [task_dict(t) for t in tasks]})

    # Human-facing audit feed; generated seed history is hidden for clarity.
    @app.route("/api/activity")
    @require_api_login("staff")
    def activity():
        logs = (
            human_activity_query()
            .order_by(TransactionLog.created_at.desc())
            .limit(40)
            .all()
        )
        return jsonify({"items": [log_dict(l) for l in logs]})

    @app.route("/api/reports")
    @require_api_login("staff")
    def reports():
        sync_overdue_incomplete_alerts(commit=True)
        return jsonify(reports_payload(request.args))

    @app.route("/api/graduation/endorsed.csv", methods=["POST"])
    @require_api_login("dean")
    def graduation_endorsed_csv():
        account = current_account()
        body = request.get_json(silent=True) or {}
        review_window = (body.get("review_window") or "").strip()
        endorsement_ids = [safe_int(value) for value in (body.get("endorsement_ids") or []) if safe_int(value)]
        query = GraduationEndorsement.query.filter(
            GraduationEndorsement.endorsement_status == "Dean Approved"
        )
        if review_window:
            query = query.filter(GraduationEndorsement.review_window == review_window)
        if endorsement_ids:
            query = query.filter(GraduationEndorsement.id.in_(endorsement_ids))
        rows = query.order_by(GraduationEndorsement.dean_decision_at.asc()).all()
        if not rows:
            return jsonify({"error": "No Dean-approved graduation endorsements are available to export."}), 400

        stream = io.StringIO()
        writer = csv.writer(stream)
        writer.writerow(["Graduate School Endorsed List for Registrar Handoff"])
        writer.writerow([
            "Batch", "Student ID", "Student Name", "Program", "Coursework Status", "Research Status",
            "Endorsement Status", "Dean Approval Date", "Dean Remarks", "Registrar Handoff Status",
        ])
        for item in rows:
            previous_status = item.endorsement_status
            previous_registrar_status = item.registrar_status
            item.registrar_status = "Exported - Ready to Send"
            item.updated_at = now_utc()
            add_log(
                "graduation",
                item.student_id,
                f"Dean · {account.full_name}",
                "Approved endorsement CSV",
                "Endorsed graduation list exported for Registrar handoff",
                "Dean",
                f"CSV exported and ready to attach for Registrar handoff. Previous Registrar status: {previous_registrar_status}.",
                previous_status=previous_status,
                new_status=item.endorsement_status,
            )
            writer.writerow([
                item.batch_name or "",
                item.student.student_number,
                item.student.name,
                f"{item.student.program.code} - {item.student.program.name}",
                item.coursework_status,
                item.research_status,
                item.endorsement_status,
                iso(item.dean_decision_at) or "",
                item.dean_remarks or "",
                item.registrar_status,
            ])
        db.session.commit()
        filename = "graduate-school-endorsed-list.csv"
        return Response(
            stream.getvalue(),
            mimetype="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-Exported-Count": str(len(rows)),
            },
        )

    @app.route("/api/graduation/registrar-handoff", methods=["POST"])
    @require_api_login("dean")
    def graduation_registrar_handoff():
        account = current_account()
        recipient_email = (request.form.get("recipient_email") or "registrar@usls.edu.ph").strip()
        comment = (request.form.get("comment") or "").strip()
        if "@" not in recipient_email or recipient_email.startswith("@"):
            return jsonify({"error": "Enter a valid Registrar email address."}), 400
        endorsement_ids = [safe_int(value) for value in request.form.getlist("endorsement_ids") if safe_int(value)]
        if not endorsement_ids:
            raw_ids = request.form.get("endorsement_ids") or ""
            try:
                parsed_ids = json.loads(raw_ids) if raw_ids else []
            except json.JSONDecodeError:
                parsed_ids = []
            endorsement_ids = [safe_int(value) for value in parsed_ids if safe_int(value)]
        uploaded = request.files.get("file")
        if not uploaded or not uploaded.filename:
            return jsonify({"error": "Attach the exported endorsed list before sending it to the Registrar."}), 400
        original_name = secure_filename(uploaded.filename) or "graduate-school-endorsed-list.csv"
        if not original_name.lower().endswith((".csv", ".pdf", ".xlsx", ".xls")):
            return jsonify({"error": "Attach the exported CSV or a PDF/Excel copy of the endorsed list."}), 400
        file_bytes = uploaded.read()
        if not file_bytes or len(file_bytes) > 25 * 1024 * 1024:
            return jsonify({"error": "The attached endorsed list must be between 1 byte and 25 MB."}), 400
        rows = (
            GraduationEndorsement.query.filter(
                GraduationEndorsement.id.in_(endorsement_ids),
                GraduationEndorsement.endorsement_status == "Dean Approved",
            )
            .order_by(GraduationEndorsement.dean_decision_at.asc())
            .all()
        )
        if not rows:
            return jsonify({"error": "No Dean-approved graduation endorsements are ready for Registrar handoff."}), 400
        not_exported = [item.student.name for item in rows if item.registrar_status != "Exported - Ready to Send"]
        if not_exported:
            return jsonify({"error": "Export the approved list before sending it to the Registrar: " + ", ".join(not_exported)}), 400

        REQUEST_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
        suffix = Path(original_name).suffix or ".csv"
        for item in rows:
            previous_status = item.endorsement_status
            previous_registrar_status = item.registrar_status
            stored_name = f"{item.student_id}-graduation-registrar-handoff-{uuid4().hex}{suffix}"
            (REQUEST_UPLOAD_ROOT / stored_name).write_bytes(file_bytes)
            attachment = StudentRequestAttachment(
                student_id=item.student_id,
                request_type="graduation-registrar-handoff",
                workflow_request_id=item.id,
                workflow_stage="Registrar Handoff",
                uploaded_by_user_id=account.id,
                uploaded_by_name=account.full_name,
                uploaded_by_role=ROLE_LABELS.get(account.role, account.role),
                original_name=original_name,
                stored_name=stored_name,
                mime_type=uploaded.mimetype or "application/octet-stream",
            )
            db.session.add(attachment)
            item.endorsement_status = "Sent to Registrar"
            item.registrar_status = "Sent - Awaiting Receipt"
            item.updated_at = now_utc()
            add_log(
                "graduation",
                item.student_id,
                f"Dean · {account.full_name}",
                "Registrar handoff email",
                "Endorsed graduation list sent to Registrar",
                "External Registrar",
                " ".join(
                    part
                    for part in [
                        f"Sent to: {recipient_email}.",
                        f"Attached file: {original_name}.",
                        comment,
                        f"Previous Registrar status: {previous_registrar_status}.",
                    ]
                    if part
                ),
                previous_status=previous_status,
                new_status=item.endorsement_status,
            )
        db.session.commit()
        return jsonify({
            "ok": True,
            "count": len(rows),
            "recipient_email": recipient_email,
            "message": f"Sent the endorsed graduation list to {recipient_email} and recorded the Registrar handoff for {len(rows)} candidate(s).",
        })

    # Faculty reference endpoint for panels and scheduling.
    @app.route("/api/faculty")
    @require_api_login("staff", "academic_coordinator")
    def faculty_list():
        faculty = Faculty.query.order_by(Faculty.name).all()
        return jsonify({"items": [faculty_profile_dict(f) for f in faculty]})

    @app.route("/api/faculty", methods=["POST"])
    @require_api_login("staff", "academic_coordinator")
    def faculty_create():
        data = request_payload()
        full_name = (data.get("full_name") or "").strip()
        department = (data.get("department") or "").strip()
        specialization = (data.get("specialization") or "").strip()
        email = (data.get("email") or "").strip().lower()
        temporary_password = data.get("temporary_password") or ""
        status = (data.get("status") or "Active").strip()
        roles_value = data.get("eligible_roles") or []
        eligible_roles = data.getlist("eligible_roles") if hasattr(data, "getlist") else roles_value
        if isinstance(eligible_roles, str):
            eligible_roles = [eligible_roles]
        eligible_roles = list(dict.fromkeys(role for role in eligible_roles if role in FACULTY_ELIGIBLE_ROLES))
        if not full_name or not department or not specialization or not email:
            return jsonify({"error": "Full name, department, specialization, and email are required."}), 400
        if "@" not in email or email.startswith("@") or email.endswith("@"):
            return jsonify({"error": "Enter a valid faculty email address."}), 400
        if len(temporary_password) < 8:
            return jsonify({"error": "Temporary password must contain at least 8 characters."}), 400
        if status not in {"Active", "Inactive"}:
            return jsonify({"error": "Choose Active or Inactive account status."}), 400
        if not eligible_roles:
            return jsonify({"error": "Choose at least one eligible faculty role."}), 400
        if Faculty.query.filter(func.lower(Faculty.email) == email).first():
            return jsonify({"error": "A faculty profile already uses that email address."}), 409
        if UserAccount.query.filter(func.lower(UserAccount.email) == email).first():
            return jsonify({"error": "A login account already uses that email address."}), 409
        faculty = Faculty(
            name=full_name,
            college=department,
            role=" / ".join(eligible_roles),
            specialization=specialization,
            email=email,
            eligible_roles=json.dumps(eligible_roles),
            active=status == "Active",
        )
        db.session.add(faculty)
        db.session.flush()
        account = ensure_faculty_user_account(faculty, temporary_password)
        for weekday in range(5):
            db.session.add(FacultyWorkingHour(
                faculty_id=faculty.id, weekday=weekday,
                start_time=time(8, 0), end_time=time(17, 0), enabled=True,
            ))
        db.session.commit()
        return jsonify({
            "ok": True,
            "message": f"{faculty.name} and the connected faculty login were created.",
            "faculty": faculty_profile_dict(faculty),
            "account": account_dict(account),
        }), 201

    @app.route("/api/faculty-portal/context")
    @require_api_login("faculty")
    def faculty_portal_context():
        # The signed-in faculty member sees only their own advisees and panels.
        account = current_account()
        faculty = Faculty.query.get(account.faculty_id) if account and account.faculty_id else None
        if not faculty:
            return jsonify({"error": "This faculty account is not linked to a faculty record yet."}), 400
        assignments = (
            PanelAssignment.query.filter_by(faculty_id=faculty.id)
            .order_by(PanelAssignment.assigned_at.desc())
            .all()
        )
        panels = []
        for assignment in assignments:
            student = Student.query.get(assignment.student_id)
            if not student:
                continue
            research_case = (
                ResearchCase.query.filter_by(student_id=student.id)
                .order_by(ResearchCase.opened_at.desc())
                .first()
            )
            defense_type = RESEARCH_GATE_DEFENSE_TYPES.get(assignment.gate)
            schedule = (
                ScheduleRequest.query.filter_by(student_id=student.id, defense_type=defense_type)
                .order_by(ScheduleRequest.created_at.desc())
                .first()
            )
            documents = []
            for doc in DocumentCheck.query.filter_by(student_id=student.id, gate=assignment.gate).all():
                for evidence in sorted(doc.evidence_files, key=lambda item: item.uploaded_at or now_utc(), reverse=True):
                    documents.append({
                        "id": evidence.id,
                        "name": evidence.original_name,
                        "mime_type": evidence.mime_type,
                        "uploaded_at": iso(evidence.uploaded_at),
                        "document_type": doc.item_name,
                        "gate": doc.gate,
                        "url": f"/api/research-evidence/{evidence.id}/file",
                    })
            panels.append({
                "student": student_brief(student),
                "panel_role": assignment.panel_role,
                "research_title": research_case.title if research_case else None,
                "stage": student.current_stage,
                "gate": assignment.gate,
                "documents": documents,
                "defense": schedule_request_dict(schedule) if schedule else None,
                "can_submit_verdict": bool(
                    schedule
                    and assignment.panel_role.lower() in {"panel chair", "panel lead"}
                    and not DefenseVerdict.query.filter_by(schedule_request_id=schedule.id).first()
                ),
            })
        advisees = []
        adviser_student_ids = {
            row.student_id
            for row in AdviserAssignment.query.filter_by(faculty_id=faculty.id, status="Active").all()
        }
        adviser_student_ids.update(
            student_id for (student_id,) in Student.query.with_entities(Student.id).filter_by(adviser_name=faculty.name).all()
        )
        adviser_students = (
            Student.query.filter(Student.id.in_(adviser_student_ids)).order_by(Student.last_name, Student.first_name).all()
            if adviser_student_ids else []
        )
        for student in adviser_students:
            pending_documents = []
            for doc in DocumentCheck.query.filter(
                DocumentCheck.student_id == student.id,
                DocumentCheck.item_name.in_(ADVISER_APPROVAL_DOCUMENTS),
            ).all():
                for evidence in sorted(doc.evidence_files, key=lambda item: item.uploaded_at or now_utc(), reverse=True):
                    approval = AdviserDocumentApproval.query.filter_by(evidence_file_id=evidence.id).first()
                    pending_documents.append({
                        "id": evidence.id,
                        "name": evidence.original_name,
                        "document_type": doc.item_name,
                        "gate": doc.gate,
                        "uploaded_at": iso(evidence.uploaded_at),
                        "url": f"/api/research-evidence/{evidence.id}/file",
                        "approval": adviser_approval_dict(approval),
                    })
            advisees.append({
                "student": student_brief(student),
                "documents": pending_documents,
                "pending_count": sum(not item["approval"] for item in pending_documents),
            })
        upcoming = (
            FacultyAvailability.query.filter(
                FacultyAvailability.faculty_id == faculty.id,
                FacultyAvailability.available_date >= date.today(),
            )
            .order_by(FacultyAvailability.available_date, FacultyAvailability.start_time)
            .limit(20)
            .all()
        )
        return jsonify({
            "faculty": faculty_profile_dict(faculty),
            "panels": panels,
            "advisees": advisees,
            "panel_count": len(panels),
            "terms": [term_dict(term) for term in AcademicTerm.query.order_by(AcademicTerm.start_date.desc()).all()],
            "subjects": course_audit_subject_items(),
            "grade_alerts": faculty_grade_alerts(),
            "working_hours": faculty_working_hours(faculty),
            "availability": [
                {
                    "date": iso(slot.available_date),
                    "start": slot.start_time.strftime("%H:%M"),
                    "end": slot.end_time.strftime("%H:%M"),
                }
                for slot in upcoming
            ],
        })

    @app.route("/api/faculty-portal/adviser-approvals/<int:evidence_id>", methods=["POST"])
    @require_api_login("faculty")
    def faculty_adviser_approval(evidence_id: int):
        account = current_account()
        faculty = Faculty.query.get(account.faculty_id) if account and account.faculty_id else None
        evidence = ResearchEvidenceFile.query.get_or_404(evidence_id)
        doc = evidence.document_check
        student = Student.query.get(evidence.student_id)
        if not faculty or not student or not faculty_is_adviser_for_student(faculty.id, student.id):
            return jsonify({"error": "You can sign papers only for students assigned to you as adviser."}), 403
        if not doc or doc.item_name not in ADVISER_APPROVAL_DOCUMENTS:
            return jsonify({"error": "This uploaded document does not require an adviser signature."}), 400
        if AdviserDocumentApproval.query.filter_by(evidence_file_id=evidence.id).first():
            return jsonify({"error": "This exact document version is already signed."}), 409
        data = request_payload()
        signature_data = (data.get("signature_data") or "").strip()
        if not signature_data.startswith("data:image/png;base64,") or len(signature_data) > 750000:
            return jsonify({"error": "Draw and finalize a valid PNG signature before signing."}), 400
        approval = AdviserDocumentApproval(
            student_id=student.id,
            evidence_file_id=evidence.id,
            faculty_id=faculty.id,
            adviser_name=faculty.name,
            student_name=student.name,
            document_name=evidence.original_name,
            signature_data=signature_data,
            status="Signed",
            signed_at=now_utc(),
        )
        db.session.add(approval)
        doc.updated_at = now_utc()
        add_log(
            "research-gate", student.id, f"Faculty Adviser · {faculty.name}", evidence.original_name,
            f"{doc.item_name} signed by adviser", "Research Coordinator",
            f"The assigned adviser signed document version {evidence.original_name} in-system.",
        )
        sync_research_progress(student)
        db.session.commit()
        return jsonify({"ok": True, "message": "Document signed successfully.", "approval": adviser_approval_dict(approval)})

    @app.route("/api/faculty-portal/defense-verdicts/<int:schedule_id>", methods=["POST"])
    @require_api_login("faculty")
    def faculty_defense_verdict(schedule_id: int):
        account = current_account()
        faculty = Faculty.query.get(account.faculty_id) if account and account.faculty_id else None
        schedule = ScheduleRequest.query.get_or_404(schedule_id)
        gate = RESEARCH_DEFENSE_TYPES_TO_GATES.get(schedule.defense_type or "")
        assignment = PanelAssignment.query.filter_by(
            faculty_id=faculty.id if faculty else 0,
            student_id=schedule.student_id,
            gate=gate,
        ).first()
        if not assignment or assignment.panel_role.lower() not in {"panel chair", "panel lead"}:
            return jsonify({"error": "Only the assigned panel chair or panel lead can submit this verdict."}), 403
        if schedule.status not in ACTIVE_DEFENSE_STATUSES:
            return jsonify({"error": "A verdict can be submitted only for a confirmed scheduled defense."}), 400
        if DefenseVerdict.query.filter_by(schedule_request_id=schedule.id).first():
            return jsonify({"error": "A verdict has already been submitted for this defense schedule."}), 409
        data = request_payload()
        result = (data.get("result") or "").strip()
        allowed_results = {"Passed", "Passed with revisions", "Deferred", "Failed", "For resubmission"}
        if result not in allowed_results:
            return jsonify({"error": "Choose a valid defense verdict."}), 400
        student = schedule.student
        research_case = ResearchCase.query.filter_by(student_id=student.id).order_by(ResearchCase.opened_at.desc()).first()
        verdict = DefenseVerdict(
            student_id=student.id,
            schedule_request_id=schedule.id,
            panel_assignment_id=assignment.id,
            faculty_id=faculty.id,
            gate=gate,
            defense_type=schedule.defense_type,
            research_title=research_case.title if research_case else None,
            chair_name=faculty.name,
            result=result,
            remarks=(data.get("remarks") or "").strip() or None,
            defense_date=schedule.preferred_date,
            submitted_at=now_utc(),
        )
        db.session.add(verdict)
        db.session.flush()
        next_owner = "Research Coordinator" if result == "Passed" else "Student"
        if result in {"Failed", "For resubmission"}:
            reset_research_gate_after_failed_defense(student, gate)
            add_task(student.id, f"Resubmit {schedule.defense_type} requirements", "Student", 5, 45)
        elif result in {"Passed with revisions", "Deferred"}:
            add_task(student.id, f"Resolve {schedule.defense_type} verdict conditions", "Student", 5, 40)
        add_log(
            "research-gate", student.id, f"Panel Chair · {faculty.name}", gate,
            f"{schedule.defense_type}: {result}", next_owner,
            f"Schedule #{schedule.id}; verdict submitted by assigned {assignment.panel_role}. {verdict.remarks or 'No remarks.'}",
        )
        sync_research_progress(student)
        db.session.commit()
        return jsonify({"ok": True, "message": "Defense verdict submitted.", "verdict": defense_verdict_dict(verdict)})

    @app.route("/api/faculty/<int:faculty_id>/calendar.ics")
    def faculty_calendar_feed(faculty_id: int):
        faculty = Faculty.query.get_or_404(faculty_id)
        return Response(
            faculty_calendar_ics(faculty),
            mimetype="text/calendar",
            headers={"Content-Disposition": f'inline; filename="faculty-{faculty_id}-availability.ics"'},
        )

    @app.route("/api/curriculum-planning")
    @require_api_login("staff", "academic_coordinator")
    def curriculum_planning():
        program_id = request.args.get("program_id", type=int)
        program = Program.query.get(program_id) if program_id else Program.query.order_by(Program.code).first()
        if not program:
            return jsonify({"error": "No program found."}), 404
        term_id = request.args.get("term_id", type=int)
        term = AcademicTerm.query.get(term_id) if term_id else get_active_term()
        return jsonify(curriculum_planning_payload(program, term))

    @app.route("/api/curriculum-planning/offerings")
    @require_api_login("staff", "academic_coordinator")
    def curriculum_offering_list():
        program_id = request.args.get("program_id", type=int)
        term_id = request.args.get("term_id", type=int)
        academic_year = (request.args.get("academic_year") or "").strip()
        semester = (request.args.get("semester") or "").strip()
        selected_term = AcademicTerm.query.get(term_id) if term_id else get_active_term()
        if selected_term and term_id:
            parsed_ay, parsed_semester = split_academic_term_label(selected_term.label)
            academic_year = parsed_ay or academic_year
            semester = parsed_semester or semester
        query = CurriculumOffering.query
        if program_id:
            query = query.filter_by(program_id=program_id)
        if academic_year:
            query = query.filter_by(academic_year=academic_year)
        if semester:
            query = query.filter_by(semester=semester)
        items = query.order_by(
            CurriculumOffering.academic_year.desc(),
            CurriculumOffering.semester,
            CurriculumOffering.id,
        ).all()
        term_years = {
            match.group(1)
            for term in AcademicTerm.query.all()
            for match in [re.search(r"(\d{4}-\d{4})", term.label or "")]
            if match
        }
        all_ay = sorted(
            {o.academic_year for o in CurriculumOffering.query.all()} | term_years | set(default_academic_year_options()),
            reverse=True,
        )
        all_sem = list(SEMESTER_NAMES)
        terms = list(reversed(visible_terms()))
        programs = Program.query.order_by(Program.code).all()
        courses = (
            Course.query.filter_by(program_id=program_id).order_by(Course.code).all()
            if program_id else []
        )
        return jsonify({
            "items": [curriculum_offering_dict(o) for o in items],
            "academic_years": all_ay,
            "semesters": all_sem,
            "terms": [term_dict(t) for t in terms],
            "active_term": term_dict(get_active_term()) if get_active_term() else None,
            "selected_term": term_dict(selected_term) if selected_term else None,
            "programs": [program_dict(p) for p in programs],
            "courses": [
                {"id": c.id, "code": c.code, "title": c.title, "category": c.category, "units": c.units}
                for c in courses
            ],
        })

    @app.route("/api/curriculum-planning/offerings", methods=["POST"])
    @require_api_login("staff", "academic_coordinator")
    def curriculum_offering_add():
        data = request.get_json(silent=True) or {}
        program = Program.query.get_or_404(int(data.get("program_id") or 0))
        term_id = data.get("term_id")
        selected_term = AcademicTerm.query.get(int(term_id)) if term_id else None
        academic_year = (data.get("academic_year") or "").strip()
        semester = (data.get("semester") or "").strip()
        if selected_term:
            parsed_ay, parsed_semester = split_academic_term_label(selected_term.label)
            academic_year = parsed_ay or academic_year
            semester = parsed_semester or semester
        course_ids = [int(c) for c in (data.get("course_ids") or []) if c]
        account = current_account()
        if not academic_year or not semester:
            return jsonify({"error": "Academic year and semester are required."}), 400
        if not course_ids:
            return jsonify({"error": "Select at least one subject to add."}), 400
        added = 0
        for course_id in course_ids:
            course = Course.query.get(course_id)
            if not course or course.program_id != program.id:
                continue
            exists = CurriculumOffering.query.filter_by(
                program_id=program.id,
                academic_year=academic_year,
                semester=semester,
                course_id=course_id,
            ).first()
            if exists:
                continue
            db.session.add(CurriculumOffering(
                program_id=program.id,
                academic_year=academic_year,
                semester=semester,
                course_id=course_id,
                added_by=account.full_name if account else None,
            ))
            added += 1
        db.session.commit()
        return jsonify({
            "ok": True,
            "added": added,
            "message": f"Added {added} subject(s) to the {semester} offering list.",
        })

    @app.route("/api/curriculum-planning/offerings/<int:offering_id>", methods=["DELETE"])
    @require_api_login("staff", "academic_coordinator")
    def curriculum_offering_delete(offering_id: int):
        offering = CurriculumOffering.query.get_or_404(offering_id)
        course_code = offering.course.code if offering.course else "Subject"
        db.session.delete(offering)
        db.session.commit()
        return jsonify({"ok": True, "message": f"Removed {course_code} from the offering list."})

    @app.route("/api/curriculum-planning/subjects", methods=["POST"])
    @require_api_login("staff", "academic_coordinator")
    def curriculum_planning_create_subject():
        data = request.get_json(silent=True) or {}
        program = Program.query.get_or_404(int(data.get("program_id") or 0))
        code = (data.get("code") or "").strip().upper()
        title = (data.get("title") or "").strip()
        category = (data.get("category") or "Core").strip()
        recommended_term = (data.get("recommended_term") or "Year 1").strip()
        try:
            units = int(data.get("units") or 3)
        except (TypeError, ValueError):
            return jsonify({"error": "Units must be a whole number."}), 400
        if not code or not title:
            return jsonify({"error": "Subject code and title are required."}), 400
        if units < 0 or units > 12:
            return jsonify({"error": "Units must be between 0 and 12."}), 400
        if Course.query.filter(func.lower(Course.code) == code.lower()).first():
            return jsonify({"error": f"Subject code {code} already exists."}), 400
        course = Course(
            program_id=program.id,
            code=code,
            title=title,
            units=units,
            category=category,
            recommended_term=recommended_term,
        )
        db.session.add(course)
        db.session.flush()
        sync = sync_program_curriculum(program, courses=[course])
        add_log(
            "curriculum-planning",
            None,
            "Academic Coordinator",
            "Curriculum Planning",
            f"Added {code} to the {program.code} curriculum",
            "Academic Coordinator",
            f"{title}; {units} unit(s); {category}; {recommended_term}. Automatically added to {sync['students']} student record(s).",
        )
        db.session.commit()
        return jsonify({
            "ok": True,
            "message": f"Added {code}. It was automatically added to {sync['students']} student course audit(s).",
            "course": {
                "id": course.id,
                "code": course.code,
                "title": course.title,
                "units": course.units,
                "category": course.category,
                "recommended_term": course.recommended_term,
            },
            "data": curriculum_planning_payload(program),
        })

    @app.route("/api/curriculum-planning/generate", methods=["POST"])
    @require_api_login("staff", "academic_coordinator")
    def curriculum_planning_generate():
        data = request.get_json(silent=True) or {}
        program = Program.query.get_or_404(int(data.get("program_id") or 0))
        scope = data.get("scope") or "active"
        term_id = data.get("term_id")
        term = AcademicTerm.query.get(int(term_id)) if term_id else get_active_term()
        academic_year, semester = split_academic_term_label(term.label if term else "")
        query = Student.query.filter_by(program_id=program.id)
        if scope == "active":
            query = query.filter(Student.standing == "Active")
        students = query.order_by(Student.last_name, Student.first_name).all()
        courses = Course.query.filter_by(program_id=program.id).order_by(Course.code).all()
        created = 0
        offerings_created = 0
        touched_students = 0
        for student in students:
            existing = {rec.course_id for rec in CourseRecord.query.filter_by(student_id=student.id).all()}
            added_for_student = 0
            for course in courses:
                if course.id in existing:
                    continue
                db.session.add(
                    CourseRecord(
                        student_id=student.id,
                        course_id=course.id,
                        status="Missing",
                        evidence_reference="Curriculum planning generation",
                    )
                )
                created += 1
                added_for_student += 1
            if added_for_student:
                touched_students += 1
                recompute_risk(student)
        # Edit this value to change the minimum demand for automatic inclusion.
        AUTO_OFFER_DEMAND_THRESHOLD = 2
        if term and academic_year and semester:
            for demand_row in course_demand_rows(program, term):
                if demand_row["demand_count"] < AUTO_OFFER_DEMAND_THRESHOLD:
                    continue
                course_id = demand_row["course"]["id"]
                exists = CurriculumOffering.query.filter_by(
                    program_id=program.id, academic_year=academic_year,
                    semester=semester, course_id=course_id,
                ).first()
                if not exists:
                    db.session.add(CurriculumOffering(
                        program_id=program.id, academic_year=academic_year,
                        semester=semester, course_id=course_id,
                        added_by="RAG demand recommendation",
                    ))
                    offerings_created += 1
        add_log(
            "curriculum-planning",
            None,
            "Academic Coordinator",
            "Curriculum Planning",
            f"Generated curriculum plan rows for {touched_students} student(s)",
            "Academic Coordinator",
            f"Program {program.code}; {created} missing subject row(s) created from {len(courses)} curriculum subject(s).",
        )
        db.session.commit()
        return jsonify({
            "ok": True,
            "message": f"Generated {created} curriculum row(s) and added {offerings_created} demand-qualified subject(s).",
            "created": created,
            "offerings_created": offerings_created,
            "students": touched_students,
            "data": curriculum_planning_payload(program),
        })

    # ---- Enrollment (student-to-subject, per academic semester) ----------
    @app.route("/api/enrollment")
    @require_api_login("staff", "academic_coordinator")
    def enrollment_workspace():
        program_id = request.args.get("program_id", type=int)
        term_id = request.args.get("term_id", type=int)
        student_id = request.args.get("student_id", type=int)
        program = (
            Program.query.get(program_id)
            if program_id
            else Program.query.order_by(Program.code).first()
        )
        if not program:
            return jsonify({"error": "No program found."}), 404
        term = AcademicTerm.query.get(term_id) if term_id else get_active_term()
        if not term:
            return jsonify({"error": "No academic semester is available."}), 404
        students = (
            Student.query.filter_by(program_id=program.id)
            .order_by(Student.last_name, Student.first_name)
            .all()
        )
        selected_student = (
            Student.query.get(student_id)
            if student_id
            else next(
                (
                    item for item in students
                    if item.standing not in {"Withdrawn", "Graduated", "Completed"}
                ),
                students[0] if students else None,
            )
        )
        if selected_student and selected_student.program_id != program.id:
            return jsonify({
                "error": (
                    f"{selected_student.name} belongs to {selected_student.program.code}, "
                    f"not {program.code}."
                )
            }), 409

        offerings = curriculum_offerings_for_term(program, term)
        offered_ids = {item.course_id for item in offerings}
        courses = monitoring_curriculum_courses(program)
        demand_by_course = {
            row["course"]["id"]: row["demand_count"]
            for row in course_demand_rows(program, term)
        }
        selected_rows = []
        history = []
        if selected_student:
            selected_rows = SubjectEnrollment.query.filter_by(
                student_id=selected_student.id,
                term_id=term.id,
            ).all()
            history = (
                SubjectEnrollment.query.filter_by(student_id=selected_student.id)
                .join(AcademicTerm, AcademicTerm.id == SubjectEnrollment.term_id)
                .join(Course, Course.id == SubjectEnrollment.course_id)
                .order_by(AcademicTerm.start_date.desc(), Course.code)
                .all()
            )
        current_active_ids = sorted({
            item.course_id
            for item in selected_rows
            if item.status in ACTIVE_SUBJECT_ENROLLMENT_STATUSES
        })
        return jsonify({
            "program": program_dict(program),
            "term": term_dict(term),
            "programs": [
                program_dict(item)
                for item in Program.query.order_by(Program.code).all()
            ],
            "terms": [
                term_dict(item)
                for item in AcademicTerm.query.order_by(AcademicTerm.start_date.desc()).all()
            ],
            "students": [student_brief(item) for item in students],
            "selected_student": student_brief(selected_student) if selected_student else None,
            "offered_subjects": [
                {
                    **curriculum_offering_dict(item),
                    "demand_count": demand_by_course.get(item.course_id, 0),
                }
                for item in offerings
            ],
            "curriculum_subjects": [
                {
                    "id": course.id,
                    "code": course.code,
                    "title": course.title,
                    "units": course.units or 3,
                    "category": course.category,
                    "recommended_term": course.recommended_term,
                    "is_offered": course.id in offered_ids,
                    "demand_count": demand_by_course.get(course.id, 0),
                }
                for course in courses
            ],
            "current_course_ids": current_active_ids,
            "current_enrollments": [
                subject_enrollment_dict(item) for item in selected_rows
            ],
            "history": [subject_enrollment_dict(item) for item in history],
            "integrity": enrollment_integrity_payload(program, term),
        })

    @app.route("/api/enrollment/preview", methods=["POST"])
    @require_api_login("staff", "academic_coordinator")
    def enrollment_preview():
        data = request.get_json(silent=True) or {}
        student = Student.query.get_or_404(safe_int(data.get("student_id")))
        term = AcademicTerm.query.get_or_404(safe_int(data.get("term_id")))
        try:
            course_ids = {
                int(value)
                for value in (data.get("course_ids") or [])
                if value not in (None, "")
            }
        except (TypeError, ValueError):
            return jsonify({"error": "Subject IDs must be whole numbers."}), 400
        return jsonify(enrollment_preview_payload(student, term, course_ids))

    @app.route("/api/enrollment", methods=["POST"])
    @require_api_login("staff", "academic_coordinator")
    def enrollment_save():
        data = request.get_json(silent=True) or {}
        if not data.get("confirmed"):
            return jsonify({
                "error": "Preview and confirm the enrollment changes before saving."
            }), 400
        student = Student.query.get_or_404(safe_int(data.get("student_id")))
        term = AcademicTerm.query.get_or_404(safe_int(data.get("term_id")))
        try:
            requested_ids = {
                int(value)
                for value in (data.get("course_ids") or [])
                if value not in (None, "")
            }
        except (TypeError, ValueError):
            return jsonify({"error": "Subject IDs must be whole numbers."}), 400
        preview = enrollment_preview_payload(student, term, requested_ids)
        if preview["has_blocking_conflicts"]:
            return jsonify({
                "error": "Enrollment is blocked by the student's standing or invalid subject data.",
                "preview": preview,
            }), 409

        resolutions = {
            str(key): str(value)
            for key, value in (data.get("resolutions") or {}).items()
        }
        unresolved = [
            item for item in preview["conflicts"]
            if not resolutions.get(item["id"])
        ]
        if unresolved:
            return jsonify({
                "error": (
                    f"Resolve {len(unresolved)} conflict(s) before saving. "
                    f"First unresolved line: {unresolved[0]['line']}."
                ),
                "preview": preview,
            }), 409

        final_ids = set(requested_ids)
        override_by_course: dict[int, list[str]] = {}
        move_enrollment_ids: set[int] = set()
        for conflict in preview["conflicts"]:
            resolution = resolutions.get(conflict["id"])
            allowed_values = {item["value"] for item in conflict.get("options", [])}
            if resolution not in allowed_values:
                return jsonify({
                    "error": f"Choose a valid resolution for {conflict['line']}."
                }), 400
            course_id = conflict.get("course_id")
            if resolution in {"exclude", "keep_other"} and course_id:
                final_ids.discard(course_id)
            elif resolution in {"enroll_override", "enroll_as_retake"} and course_id:
                override_by_course.setdefault(course_id, []).append(
                    f"{conflict['line']}: {resolution}"
                )
            elif resolution == "move_to_selected":
                move_id = safe_int(conflict.get("other_enrollment_id"))
                if move_id:
                    move_enrollment_ids.add(move_id)

        courses = {
            item.id: item
            for item in Course.query.filter(Course.id.in_(final_ids or {-1})).all()
        }
        if any(course.program_id != student.program_id for course in courses.values()):
            return jsonify({
                "error": "Every enrolled subject must belong to the student's program."
            }), 409

        source_reference = (
            data.get("source_reference") or "Enrollment workspace"
        ).strip()
        account = current_account()
        actor = workflow_actor_label(account) if account else "Graduate School Staff"
        existing_rows = SubjectEnrollment.query.filter_by(
            student_id=student.id,
            term_id=term.id,
        ).all()
        current_active = {
            item.course_id: item
            for item in existing_rows
            if item.status in ACTIVE_SUBJECT_ENROLLMENT_STATUSES
        }
        added = 0
        cancelled = 0

        for move_id in move_enrollment_ids:
            old_item = SubjectEnrollment.query.get(move_id)
            if old_item and old_item.student_id == student.id:
                old_item.status = "Cancelled"
                old_item.cancelled_at = now_utc()
                old_item.updated_at = now_utc()
                old_item.source_reference = source_reference

        for course_id in sorted(set(current_active) - final_ids):
            item = current_active[course_id]
            item.status = "Cancelled"
            item.cancelled_at = now_utc()
            item.updated_at = now_utc()
            item.source_reference = source_reference
            record = CourseRecord.query.filter_by(
                student_id=student.id,
                course_id=course_id,
            ).first()
            if (
                record
                and record.term_label == term.label
                and record.status in ACTIVE_SUBJECT_ENROLLMENT_STATUSES
            ):
                record.status = "Missing"
                record.grade_value = None
                record.grade_status = "No Grade"
                record.incomplete_deadline = None
                record.resolved_at = None
                record.remarks = (
                    f"Enrollment cancelled for {term.label}. "
                    f"Source: {source_reference}."
                )
                record.evidence_reference = "Enrollment synchronization"
                record.updated_at = now_utc()
            cancelled += 1

        for course_id in sorted(final_ids):
            course = courses.get(course_id)
            if not course:
                continue
            item = SubjectEnrollment.query.filter_by(
                student_id=student.id,
                course_id=course_id,
                term_id=term.id,
            ).first()
            was_active = bool(
                item and item.status in ACTIVE_SUBJECT_ENROLLMENT_STATUSES
            )
            override_notes = override_by_course.get(course_id, [])
            if not item:
                item = SubjectEnrollment(
                    student_id=student.id,
                    course_id=course_id,
                    term_id=term.id,
                )
                db.session.add(item)
            item.status = "Enrolled"
            item.source_reference = source_reference
            item.conflict_override = (
                json.dumps(override_notes) if override_notes else None
            )
            item.cancelled_at = None
            item.updated_at = now_utc()
            if not was_active:
                item.enrolled_at = now_utc()
                added += 1

            record = CourseRecord.query.filter_by(
                student_id=student.id,
                course_id=course.id,
            ).first()
            if not record:
                record = CourseRecord(
                    student_id=student.id,
                    course_id=course.id,
                )
                db.session.add(record)
            record.status = "Enrolled"
            record.term_label = term.label
            record.evidence_reference = "Enrollment synchronization"
            record.grade_value = None
            record.grade_status = "No Grade"
            record.incomplete_deadline = None
            record.resolved_at = None
            record.remarks = (
                f"Enrolled through {source_reference}."
                + (
                    f" Approved exception: {'; '.join(override_notes)}."
                    if override_notes else ""
                )
            )
            record.updated_at = now_utc()

        term_enrollment = TermEnrollment.query.filter_by(
            student_id=student.id,
            term_id=term.id,
        ).first()
        if final_ids:
            ensure_term_enrollment(
                student,
                term,
                "Enrolled",
                source_reference,
            )
            if student.enrollment_tag not in {
                "LOA",
                "AWOL",
                "Withdrawn",
                "Completed",
            }:
                student.enrollment_tag = "Enrolled"
            if student.current_stage == "Admission":
                student.current_stage = "Coursework"
        elif term_enrollment and term_enrollment.status in {
            "Confirmed",
            "Enrolled",
            "Active",
        }:
            term_enrollment.status = "Confirmed"
            term_enrollment.confirmed_at = now_utc()
            term_enrollment.source_reference = source_reference

        student.updated_at = now_utc()
        recompute_risk(student)
        override_count = sum(bool(value) for value in override_by_course.values())
        add_log(
            "enrollment",
            student.id,
            actor,
            source_reference,
            (
                f"Enrollment saved for {term.label}: {len(final_ids)} subject(s), "
                f"{added} added, {cancelled} cancelled"
            ),
            "Student",
            (
                "The enrollment ledger, monitoring sheet, student profile, and "
                f"student portal were synchronized. {override_count} conflict "
                "override(s) were documented."
            ),
            previous_status=", ".join(
                sorted(
                    item.course.code
                    for item in current_active.values()
                    if item.course
                )
            ) or "No subjects",
            new_status=", ".join(
                sorted(course.code for course in courses.values())
            ) or "No subjects",
        )
        workflow_message_record(
            "enrollment",
            student,
            account,
            "Student",
            f"Enrollment updated for {term.label}",
            (
                f"You are enrolled in {len(final_ids)} subject(s). "
                "Open My Courses to review the synchronized list."
            ),
            "notice",
            "Enrollment review",
            "Enrollment saved",
            visibility="student_visible",
            status="Sent",
        )
        db.session.commit()
        integrity = enrollment_integrity_payload(student.program, term)
        return jsonify({
            "ok": True,
            "message": (
                f"Enrollment saved for {student.name}. {added} subject(s) added "
                f"and {cancelled} removed; monitoring and profile views are synced."
            ),
            "student_id": student.id,
            "program_id": student.program_id,
            "term_id": term.id,
            "subject_count": len(final_ids),
            "added": added,
            "cancelled": cancelled,
            "override_count": override_count,
            "integrity": integrity,
            "links": {
                "monitoring": (
                    f"/monitoring-sheet?program_id={student.program_id}"
                    f"&term_id={term.id}"
                ),
                "student_profile": f"/students/{student.id}",
                "course_audit": "/workflow/course-audit",
            },
        })

    @app.route("/api/course-adjustments")
    @require_api_login("staff", "academic_coordinator")
    def course_adjustments():
        program_id = request.args.get("program_id", type=int)
        program = Program.query.get(program_id) if program_id else Program.query.order_by(Program.code).first()
        if not program:
            return jsonify({"error": "No program found."}), 404
        term_id = request.args.get("term_id", type=int)
        term = AcademicTerm.query.get(term_id) if term_id else get_active_term()
        return jsonify(course_adjustments_payload(program, term))

    @app.route("/api/course-adjustments/plan", methods=["POST"])
    @require_api_login("academic_coordinator")
    def course_adjustments_plan():
        data = request.get_json(silent=True) or {}
        program = Program.query.get_or_404(int(data.get("program_id") or 0))
        action = data.get("action") or "draft"
        requested_term_id = data.get("term_id")
        target_term = (
            AcademicTerm.query.get(int(requested_term_id))
            if requested_term_id
            else None
        )
        if not target_term:
            requested_label = (data.get("term_label") or "").strip()
            target_term = (
                AcademicTerm.query.filter_by(label=requested_label).first()
                if requested_label
                else get_active_term()
            )
        if not target_term:
            return jsonify({"error": "Select an academic year and semester first."}), 400
        reference_term = (
            AcademicTerm.query.filter(AcademicTerm.id != target_term.id)
            .order_by(AcademicTerm.start_date.desc())
            .first()
        )
        term_label = target_term.label
        plan = (
            CourseOfferingPlan.query.filter_by(program_id=program.id, term_label=term_label)
            .order_by(CourseOfferingPlan.created_at.desc())
            .first()
        )
        if plan:
            plan.target_term_id = target_term.id
            if reference_term:
                plan.reference_term_id = reference_term.id
        if action == "draft":
            if not plan:
                plan = CourseOfferingPlan(program_id=program.id, term_label=term_label, status="Draft")
                db.session.add(plan)
                db.session.flush()
            plan.target_term_id = target_term.id
            if reference_term:
                plan.reference_term_id = reference_term.id
            plan.status = "Draft"
            CourseOffering.query.filter_by(plan_id=plan.id).delete()
            # If the Academic Coordinator edited the offer list, honour their choices;
            # otherwise fall back to the demand-suggested offerings.
            selections = data.get("selections")
            if selections:
                plan.notes = data.get("notes") or "Draft set by the Academic Coordinator from the suggested demand."
                live_demand = {
                    row["course"]["id"]: row
                    for row in course_demand_rows(program, target_term)
                }
                seen_course_ids = set()
                for sel in selections:
                    try:
                        cid = int(sel.get("course_id"))
                    except (TypeError, ValueError):
                        continue
                    course = Course.query.get(cid)
                    if not course or course.program_id != program.id or cid in seen_course_ids:
                        continue
                    seen_course_ids.add(cid)
                    demand_row = live_demand.get(cid, {})
                    offered = bool(sel.get("offer", True))
                    try:
                        section_count = max(0, int(sel.get("section_count") or 0))
                    except (TypeError, ValueError):
                        section_count = 0
                    if offered and section_count == 0:
                        section_count = 1
                    db.session.add(
                        CourseOffering(
                            plan_id=plan.id,
                            course_id=cid,
                            demand_count=demand_row.get("demand_count", 0),
                            section_count=section_count,
                            availability_count=demand_row.get("availability_count", 0),
                            status="Offered" if offered else "Not Offered",
                            notes=sel.get("notes") or "Selected by Academic Coordinator",
                        )
                    )
                result = "Draft offering plan saved from the coordinator's selections"
            else:
                plan.notes = data.get("notes") or "Draft generated from current missing-subject demand."
                for row in course_demand_rows(program, target_term):
                    db.session.add(
                        CourseOffering(
                            plan_id=plan.id,
                            course_id=row["course"]["id"],
                            demand_count=0,
                            section_count=row["suggested_sections"],
                            availability_count=0,
                            status="Suggested" if row["demand_count"] > 0 else "Not Offered",
                            notes=row["recommendation"],
                        )
                    )
                result = "Draft offering plan generated from demand"
        elif action == "submit":
            if not plan:
                return jsonify({"error": "Save a draft offering plan first."}), 400
            if plan.status not in ("Draft", "Returned"):
                return jsonify({"error": "Only a draft can be submitted for approval."}), 400
            live_demand = {
                row["course"]["id"]: row
                for row in course_demand_rows(program, target_term)
            }
            existing = {offering.course_id: offering for offering in plan.offerings}
            for course_id, row in live_demand.items():
                offering = existing.get(course_id)
                if not offering:
                    offering = CourseOffering(
                        plan_id=plan.id,
                        course_id=course_id,
                        status="Suggested" if row["demand_count"] > 0 else "Not Offered",
                        section_count=row["suggested_sections"],
                    )
                    db.session.add(offering)
                offering.demand_count = row["demand_count"]
                offering.availability_count = row["availability_count"]
                offering.notes = offering.notes or row["recommendation"]
            plan.status = "Submitted"
            plan.submitted_at = now_utc()
            plan.notes = data.get("notes") or plan.notes
            result = "Offering plan submitted for Dean approval"
        elif action == "publish":
            if not plan:
                return jsonify({"error": "Save a draft offering plan first."}), 400
            if plan.status != "Approved":
                return jsonify({"error": "Only a Dean-approved plan can be published."}), 400
            academic_year, semester = split_academic_term_label(target_term.label)
            if not academic_year or not semester:
                return jsonify({
                    "error": (
                        "The selected academic semester label is invalid. "
                        "Use a label such as AY 2026-2027 1st Semester."
                    )
                }), 400
            published_count = 0
            for offering in plan.offerings:
                if offering.status != "Offered":
                    continue
                exists = CurriculumOffering.query.filter_by(
                    program_id=program.id,
                    academic_year=academic_year,
                    semester=semester,
                    course_id=offering.course_id,
                ).first()
                if exists:
                    continue
                db.session.add(CurriculumOffering(
                    program_id=program.id,
                    academic_year=academic_year,
                    semester=semester,
                    course_id=offering.course_id,
                    added_by=f"Course Adjustments plan #{plan.id}",
                ))
                published_count += 1
            plan.status = "Published"
            plan.published_at = now_utc()
            plan.notes = data.get("notes") or plan.notes
            result = (
                "Final course offerings published to Curriculum Planning "
                f"({published_count} new)"
            )
        elif action == "reopen":
            # Start a new draft from an already Submitted/Approved/Published plan so the
            # coordinator can fix a mistake or add follow-up offerings, then resubmit.
            if not plan:
                return jsonify({"error": "There is no offering plan to revise yet."}), 400
            plan.status = "Draft"
            result = "Offering plan reopened as a new draft for revision"
        else:
            return jsonify({"error": "Unknown course adjustment action."}), 400
        plan.updated_at = now_utc()
        add_log(
            "course-adjustments",
            None,
            "Academic Coordinator",
            "Course Adjustments",
            f"{result}: {program.code} {term_label}",
            "Graduate School Staff" if action == "publish" else "Dean",
            plan.notes or "",
        )
        db.session.commit()
        return jsonify({
            "ok": True,
            "message": f"{result} for {program.code} ({term_label}).",
            "data": course_adjustments_payload(program, target_term),
        })

    # ---- Approvals inbox (Dean acts here from their own account) ----------
    @app.route("/api/approvals")
    @require_api_login("dean")
    def approvals_list():
        pending = (
            CourseOfferingPlan.query.filter_by(status="Submitted")
            .order_by(CourseOfferingPlan.submitted_at.asc())
            .all()
        )
        recent = (
            CourseOfferingPlan.query.filter(CourseOfferingPlan.status.in_(["Approved", "Published", "Returned"]))
            .order_by(CourseOfferingPlan.updated_at.desc())
            .limit(10)
            .all()
        )
        workflow_payload = workflow_approvals_payload()
        return jsonify({
            "pending": [course_offering_plan_dict(p) for p in pending],
            "recent": [course_offering_plan_dict(p) for p in recent],
            "workflow_pending": workflow_payload["pending"],
            "workflow_recent": workflow_payload["recent"],
            "workflow_overview": workflow_payload["overview"],
        })

    @app.route("/api/approvals/<int:plan_id>/decide", methods=["POST"])
    @require_api_login("dean")
    def approvals_decide(plan_id: int):
        account = current_account()
        plan = CourseOfferingPlan.query.get_or_404(plan_id)
        if plan.status != "Submitted":
            return jsonify({"error": "This plan is not awaiting approval."}), 400
        data = request.get_json(silent=True) or {}
        decision = (data.get("decision") or "").lower()
        note = (data.get("note") or "").strip()
        if decision == "approve":
            plan.status = "Approved"
            plan.approved_at = now_utc()
            plan.approved_by = account.full_name
            result = "Offering plan approved by Dean"
            next_owner = "Graduate School Staff"
        elif decision in ("return", "reject"):
            plan.status = "Returned"
            result = "Offering plan returned by Dean for revision"
            next_owner = "Academic Coordinator"
        else:
            return jsonify({"error": "Decision must be 'approve' or 'return'."}), 400
        if note:
            plan.notes = note
        plan.updated_at = now_utc()
        add_log("course-adjustments", None, f"Dean · {account.full_name}", "Approvals",
                f"{result}: {plan.program.code} {plan.term_label}", next_owner, note or plan.notes or "")
        db.session.commit()
        return jsonify({"ok": True, "message": result})

    @app.route("/api/approvals/workflow/<case_type>/<int:item_id>/decide", methods=["POST"])
    @require_api_login("dean")
    def workflow_approval_decide(case_type: str, item_id: int):
        account = current_account()
        data = request.get_json(silent=True) or {}
        decision = (data.get("decision") or "").lower()
        note = (data.get("note") or "").strip()
        if decision not in {"approve", "return", "deny", "review"}:
            return jsonify({"error": "Decision must be approve, return, deny, or review."}), 400
        if decision in {"return", "deny"} and not note:
            return jsonify({"error": "Enter a comment or reason before returning or denying this request."}), 400

        if case_type == "practicum":
            record = PracticumRecord.query.get_or_404(item_id)
            previous_status = record.status
            if decision in {"approve", "review"}:
                record.status = "Dean Reviewed"
                record.dean_reviewed_at = now_utc()
                result = "Practicum status reviewed by Dean"
                next_owner = "Graduate School Staff"
            else:
                record.status = "Additional Certificates Requested"
                result = "Practicum status returned by Dean"
                next_owner = "Academic Coordinator"
                add_task(record.student_id, "Revise practicum status report", "Academic Coordinator", 5, 35)
            if note:
                record.remarks = "\n".join([part for part in [record.remarks, f"Dean: {note}"] if part])
            if decision == "return":
                workflow_message_record(
                    "practicum", record.student, account, "Academic Coordinator",
                    note or "This request requires additional review", note, "return",
                    previous_status, record.status, visibility="internal",
                )
            add_log(
                "practicum", record.student_id, f"Dean · {account.full_name}",
                "Approvals", result, next_owner, note or practicum_notes(record),
                previous_status=previous_status, new_status=record.status,
                visibility="internal" if decision == "return" else "student_visible",
            )

        elif case_type == "withdrawal":
            application = WithdrawalApplication.query.get_or_404(item_id)
            previous_status = application.status
            if application.dean_decision != "Pending":
                return jsonify({"error": "This withdrawal request already has a Dean decision."}), 400
            if decision == "approve":
                application.dean_decision = "Approved"
                application.status = "Approved - Follow-through"
                application.student.current_stage = "Withdrawal In Progress"
                result = "Withdrawal approved by Dean"
                next_owner = "Academic Coordinator"
                add_task(application.student_id, "Perform withdrawal follow-through actions", "Academic Coordinator", 5, 45)
            elif decision == "deny":
                application.dean_decision = "Denied"
                application.status = "Denied"
                result = "Withdrawal denied by Dean; student informed and remains Active"
                next_owner = "Graduate School Staff"
                application.student.standing = "Active"
                if application.student.current_stage == "Withdrawal In Progress":
                    application.student.current_stage = "Coursework"
            else:
                application.dean_decision = "Returned"
                application.status = "Returned"
                result = "Withdrawal request returned by Dean"
                next_owner = "Student"
                add_task(application.student_id, "Revise withdrawal request", "Student", 5, 35)
            application.decided_at = now_utc()
            if note:
                application.staff_remarks = "\n".join([part for part in [application.staff_remarks, f"Dean: {note}"] if part])
            if decision == "return":
                workflow_message_record(
                    "withdrawal", application.student, account, "Student",
                    note or "Please clarify request details", note, "return",
                    previous_status, application.status, visibility="student_visible",
                )
            add_log("withdrawal", application.student_id, f"Dean · {account.full_name}", "Approvals", result, next_owner, note or withdrawal_notes(application), previous_status=previous_status, new_status=application.status)

        elif case_type in {"leave-of-absence", "readmission"}:
            forwarded = TransactionLog.query.get_or_404(item_id)
            expected_result = "LOA request forwarded to Dean" if case_type == "leave-of-absence" else "Readmission request forwarded to Dean"
            if forwarded.transaction_slug != case_type or forwarded.result != expected_result or forwarded.new_status != "Dean Review":
                return jsonify({"error": "This request is not awaiting a Dean decision."}), 400
            latest = (
                TransactionLog.query.filter_by(transaction_slug=case_type, student_id=forwarded.student_id)
                .filter(TransactionLog.actor_role != "Demo Data")
                .order_by(TransactionLog.created_at.desc(), TransactionLog.id.desc())
                .first()
            )
            if not latest or latest.id != forwarded.id:
                return jsonify({"error": "This request already has a newer workflow action."}), 400

            student = forwarded.student
            previous_status = "Dean Review"
            if case_type == "leave-of-absence":
                period = request_notes_value(forwarded.notes, "Requested semester period")
                if decision == "approve":
                    student.current_stage = "LOA"
                    student.standing = "On Leave"
                    student.enrollment_tag = "LOA"
                    student.risk_level = "Medium"
                    result, new_status, next_owner = "LOA approved by Dean", "Approved", "Graduate School Staff"
                elif decision == "deny":
                    student.risk_level = "Medium"
                    result, new_status, next_owner = "LOA denied by Dean", "Denied", "Graduate School Staff"
                elif decision == "return":
                    result, new_status, next_owner = "LOA returned by Dean for revision", "Returned for Revision", "Student"
                    add_task(student.id, "Revise Leave of Absence application", "Student", 5, 35)
                else:
                    return jsonify({"error": "LOA decisions must be approve, deny, or return."}), 400
                detail = f"Requested semester period: {period or 'Not recorded'}."
            else:
                return_semester = request_notes_value(forwarded.notes, "Return semester")
                if decision == "approve":
                    if student.current_stage == "LOA":
                        student.current_stage = "Coursework"
                    student.standing = "Active"
                    student.enrollment_tag = "Enrolled"
                    student.risk_level = "Low"
                    result, new_status, next_owner = "Readmission approved by Dean", "Approved", "Academic Coordinator"
                    add_task(student.id, "Confirm return-semester study plan", "Academic Coordinator", 5, 25)
                elif decision == "deny":
                    student.risk_level = "Medium"
                    result, new_status, next_owner = "Readmission denied by Dean", "Denied", "Graduate School Staff"
                elif decision == "return":
                    result, new_status, next_owner = "Readmission returned by Dean for revision", "Returned for Revision", "Student"
                    add_task(student.id, "Complete readmission requirements", "Student", 5, 40)
                else:
                    return jsonify({"error": "Readmission decisions must be approve, deny, or return."}), 400
                detail = f"Return semester: {return_semester or 'Not recorded'}."

            resolve_standing_change_tasks(student.id, "Decide", "Dean")
            workflow_message_record(
                case_type, student, account, "Student", result,
                note or f"{detail} Next owner: {next_owner}.",
                "return" if decision == "return" else "notice",
                previous_status, new_status,
                visibility="student_visible",
                status="Open" if decision == "return" else "Sent",
            )
            add_log(
                case_type, student.id, f"Dean · {account.full_name}", "Approvals",
                result, next_owner, " ".join(part for part in [detail, note] if part),
                previous_status=previous_status, new_status=new_status,
            )

        elif case_type == "awol-return":
            item = AwolCase.query.get_or_404(item_id)
            if item.status != "Dean Review" or item.dean_decision != "Pending":
                return jsonify({"error": "This AWOL return request is not awaiting a Dean decision."}), 400
            student = item.student
            previous_status = item.status
            if decision == "approve":
                if item.full_reenrollment_required:
                    item.status = "Re-enrollment Required"
                    item.dean_decision = "Approved for Re-enrollment Review"
                    result = "AWOL return endorsed for full re-enrollment review"
                    next_owner = "Academic Coordinator"
                    add_task(student.id, "Re-evaluate and re-enroll courses after maximum residence", "Academic Coordinator", 7, 80)
                elif item.refresher_required:
                    item.status = "Extension Approved - Refresher Required"
                    item.dean_decision = "Approved"
                    student.standing = "Active"
                    student.enrollment_tag = "Enrolled"
                    student.current_stage = "Coursework"
                    student.risk_level = "High"
                    result = "AWOL return approved with graded 6-unit refresher requirement"
                    next_owner = "Academic Coordinator"
                    add_task(student.id, "Enroll graded 6-unit refresher courses", "Academic Coordinator", 7, 75)
                else:
                    item.status = "Return Approved"
                    item.dean_decision = "Approved"
                    student.standing = "Active"
                    student.enrollment_tag = "Enrolled"
                    student.current_stage = "Coursework"
                    student.risk_level = "Medium"
                    result = "AWOL return approved by Dean"
                    next_owner = "Academic Coordinator"
                    add_task(student.id, "Confirm AWOL return study plan", "Academic Coordinator", 5, 45)
            elif decision == "deny":
                item.status = "Return Denied"
                item.dean_decision = "Denied"
                student.standing = "AWOL"
                student.enrollment_tag = "AWOL"
                student.current_stage = "AWOL"
                result = "AWOL return denied by Dean"
                next_owner = "Graduate School Staff"
            elif decision == "return":
                item.status = "Returned for Revision"
                item.dean_decision = "Returned"
                result = "AWOL return intent returned by Dean for revision"
                next_owner = "Student"
                add_task(student.id, "Revise written intent to return from AWOL", "Student", 5, 55)
            else:
                return jsonify({"error": "AWOL return decisions must be approve, deny, or return."}), 400
            item.decided_at = now_utc()
            item.updated_at = now_utc()
            if note:
                item.staff_notes = "\n".join(part for part in [item.staff_notes, f"Dean: {note}"] if part)
            resolve_standing_change_tasks(student.id, "AWOL", "Dean")
            workflow_message_record(
                "awol", student, account, "Student", result,
                note or f"Policy classification: {item.policy_classification}. Next owner: {next_owner}.",
                "return" if decision == "return" else "notice",
                previous_status, item.status,
                visibility="student_visible", status="Open" if decision == "return" else "Sent",
            )
            add_log(
                "awol", student.id, f"Dean · {account.full_name}", "Approvals",
                result, next_owner, " ".join(part for part in [item.policy_classification, note] if part),
                previous_status=previous_status, new_status=item.status,
            )

        elif case_type == "graduation":
            endorsement = GraduationEndorsement.query.get_or_404(item_id)
            previous_status = endorsement.endorsement_status
            if decision == "approve":
                endorsement.endorsement_status = "Dean Approved"
                endorsement.registrar_status = "Pending Handoff"
                endorsement.dean_decision_at = now_utc()
                result = "Graduation endorsement approved by Dean; Registrar handoff is ready for export"
                next_owner = "Dean"
                add_task(endorsement.student_id, "Export and hand off endorsed list to Registrar", "Dean", 3, 40)
            elif decision == "return":
                endorsement.endorsement_status = "Returned for Revision"
                endorsement.dean_decision_at = now_utc()
                result = "Graduation endorsement returned by Dean for revision"
                next_owner = "Graduate School Staff"
                add_task(endorsement.student_id, "Revise graduation endorsement list", "Graduate School Staff", 4, 35)
            else:
                return jsonify({"error": "Graduation endorsement decisions must be approve or return."}), 400
            if note:
                endorsement.dean_remarks = note
            if decision == "return":
                workflow_message_record(
                    "graduation", endorsement.student, account, "Graduate School Staff",
                    note or "This request requires additional review", note, "return",
                    previous_status, endorsement.endorsement_status, visibility="internal",
                )
            add_log(
                "graduation", endorsement.student_id, f"Dean · {account.full_name}",
                "Approvals", result, next_owner, note or graduation_notes(endorsement),
                previous_status=previous_status, new_status=endorsement.endorsement_status,
                visibility="internal" if decision == "return" else "student_visible",
            )
        else:
            return jsonify({"error": "Unknown workflow approval type."}), 404

        db.session.commit()
        return jsonify({"ok": True, "message": result})

    # ---- Course Audit (end-of-term, per-subject roster) ------------------
    @app.route("/api/course-audit/subjects")
    @require_api_login("staff", "academic_coordinator", "faculty")
    def course_audit_subjects():
        program_id = request.args.get("program_id", type=int)
        query = Course.query
        if program_id:
            query = query.filter(Course.program_id == program_id)
        counts = dict(
            db.session.query(CourseRecord.course_id, func.count(CourseRecord.id))
            .group_by(CourseRecord.course_id)
            .all()
        )
        done = dict(
            db.session.query(CourseRecord.course_id, func.count(CourseRecord.id))
            .filter(CourseRecord.status == "Completed")
            .group_by(CourseRecord.course_id)
            .all()
        )
        items = []
        for c in query.order_by(Course.code).all():
            enrolled = counts.get(c.id, 0)
            if enrolled:
                items.append({
                    "id": c.id, "code": c.code, "title": c.title, "program_id": c.program_id,
                    "enrolled": enrolled, "completed": done.get(c.id, 0),
                })
        return jsonify({"items": items})

    @app.route("/api/course-audit/roster")
    @require_api_login("staff", "academic_coordinator", "faculty")
    def course_audit_roster():
        course_id = request.args.get("course_id", type=int)
        term_filter = (request.args.get("term") or "").strip()
        course = Course.query.get_or_404(course_id)
        pending_drop_by_student = {
            item.student_id: item
            for item in CourseDropRequest.query.filter_by(course_id=course.id, status="Submitted").all()
        }
        rows = (
            db.session.query(CourseRecord, Student)
            .join(Student, Student.id == CourseRecord.student_id)
            .filter(CourseRecord.course_id == course_id)
            .order_by(Student.last_name.asc(), Student.first_name.asc())
            .all()
        )
        students = []
        active_term = get_active_term()
        active_term_label = active_term.label if active_term else ""
        class_statuses = {"Enrolled", "Current", "Completed", "Incomplete", "Retake Required", "Dropped", "Failed"}
        for rec, s in rows:
            record_term_label = rec.term_label or (active_term_label if rec.status in class_statuses else "")
            in_selected_term = not term_filter or record_term_label == term_filter
            status = rec.status if in_selected_term else "Missing"
            students.append({
                "student_id": s.id, "name": s.name, "student_number": s.student_number,
                "program_code": s.program.code, "status": status,
                "completed": status == "Completed", "term_label": record_term_label if in_selected_term else term_filter,
                "grade_value": (rec.grade_value or "") if in_selected_term else "",
                "grade_status": (rec.grade_status or "No Grade") if in_selected_term else "No Grade",
                "incomplete_deadline": rec.incomplete_deadline.isoformat() if in_selected_term and rec.incomplete_deadline else "",
                "remarks": (rec.remarks or "") if in_selected_term else "",
                "drop_request": course_drop_request_dict(pending_drop_by_student.get(s.id), include_student=False),
            })
        return jsonify({
            "course": {"id": course.id, "code": course.code, "title": course.title},
            "students": students,
        })

    @app.route("/api/course-audit/roster", methods=["POST"])
    @require_api_login("academic_coordinator", "staff", "faculty")
    def course_audit_roster_save():
        data = request.get_json(silent=True) or {}
        course = Course.query.get_or_404(int(data.get("course_id") or 0))
        completions = data.get("completions") or {}
        status_updates = data.get("statuses") or data.get("status_updates") or {}
        grades = data.get("grades") or {}
        grade_statuses = data.get("grade_statuses") or {}
        deadlines = data.get("incomplete_deadlines") or {}
        remarks = data.get("remarks") or {}
        active_term = get_active_term()
        term = (data.get("term") or "").strip() or (active_term.label if active_term else "")
        account = current_account()
        actor = f"Academic Coordinator · {account.full_name}" if account else "Academic Coordinator"
        allowed_statuses = {"Completed", "Current", "Enrolled", "Incomplete", "Retake Required", "Dropped", "Missing", "Failed"}
        changed = 0
        changed_students: set[int] = set()
        status_counts: dict[str, int] = {}

        if status_updates:
            updates = status_updates.items()
        else:
            updates = ((sid, "Completed" if done else "Missing") for sid, done in completions.items())

        for sid_str, new_status in updates:
            try:
                sid = int(sid_str)
            except (TypeError, ValueError):
                return jsonify({"error": f"Invalid student id: {sid_str}."}), 400
            if new_status not in allowed_statuses:
                return jsonify({"error": f"Invalid course status for student {sid}: {new_status}."}), 400
            rec = CourseRecord.query.filter_by(student_id=sid, course_id=course.id).first()
            if not rec:
                student = Student.query.get(sid)
                if not student:
                    return jsonify({"error": f"Student {sid} was not found."}), 400
                rec = CourseRecord(student_id=sid, course_id=course.id)
                db.session.add(rec)
            else:
                student = Student.query.get(sid)
                if not student:
                    return jsonify({"error": f"Student {sid} was not found."}), 400
            previous = rec.status
            previous_grade = rec.grade_value or ""
            previous_grade_status = rec.grade_status or "No Grade"
            previous_deadline = rec.incomplete_deadline
            previous_remarks = rec.remarks or ""
            rec.status = new_status
            rec.updated_at = now_utc()
            rec.evidence_reference = "Course audit update"
            if term:
                rec.term_label = term
            grade_value = str(grades.get(sid_str, grades.get(sid, rec.grade_value or "")) or "").strip()
            rec.grade_value = grade_value or None
            explicit_grade_status = str(grade_statuses.get(sid_str, grade_statuses.get(sid, "")) or "").strip()
            if new_status == "Completed":
                rec.grade_status = explicit_grade_status or "Passed"
                rec.resolved_at = rec.resolved_at or now_utc()
                rec.incomplete_deadline = None
                if previous == "Incomplete":
                    for task in Task.query.filter(
                        Task.student_id == student.id,
                        Task.title == f"Resolve incomplete grade for {course.code}",
                        Task.status.in_(["Pending", "Overdue"]),
                    ).all():
                        task.status = "Done"
            elif new_status == "Incomplete":
                rec.grade_status = "Incomplete"
                deadline_value = str(deadlines.get(sid_str, deadlines.get(sid, "")) or "").strip()
                if deadline_value:
                    try:
                        rec.incomplete_deadline = parse_date(deadline_value)
                    except ValueError:
                        return jsonify({"error": f"Invalid incomplete deadline for {student.name}. Use YYYY-MM-DD."}), 400
                if not rec.incomplete_deadline:
                    rec.incomplete_deadline = date.today() + timedelta(days=365)
                ensure_task(student.id, f"Resolve incomplete grade for {course.code}", "Academic Coordinator", rec.incomplete_deadline, 55)
            elif new_status == "Failed":
                rec.grade_status = "Failed"
                rec.resolved_at = rec.resolved_at or now_utc()
                rec.incomplete_deadline = None
            else:
                rec.grade_status = explicit_grade_status or ("No Grade" if new_status in {"Current", "Enrolled", "Missing", "Dropped"} else rec.grade_status or "No Grade")
                if new_status in {"Current", "Enrolled", "Missing", "Dropped"}:
                    rec.resolved_at = None
            rec.remarks = str(remarks.get(sid_str, remarks.get(sid, rec.remarks or "")) or "").strip() or None
            sync_subject_enrollment_from_course_record(
                student,
                course,
                rec.term_label,
                new_status,
                f"Course audit {term}".strip(),
            )
            if (
                rec.status == previous
                and (rec.grade_value or "") == previous_grade
                and (rec.grade_status or "No Grade") == previous_grade_status
                and rec.incomplete_deadline == previous_deadline
                and (rec.remarks or "") == previous_remarks
            ):
                continue
            if new_status == "Incomplete" and (previous != "Incomplete" or rec.incomplete_deadline != previous_deadline):
                workflow_message_record(
                    "course-audit", student, current_account(), "Student",
                    f"Incomplete grade recorded for {course.code}",
                    f"Complete the remaining course requirements by {rec.incomplete_deadline.isoformat()}. Contact the Graduate School or your Academic Coordinator if you need clarification.",
                    "notice", previous or "No Grade", "Incomplete", status="Sent",
                )
            elif new_status == "Completed" and previous == "Incomplete":
                workflow_message_record(
                    "course-audit", student, current_account(), "Student",
                    f"Incomplete grade resolved for {course.code}",
                    f"Your final grade is {rec.grade_value or 'recorded'} and the incomplete deadline has been cleared.",
                    "notice", "Incomplete", "Completed", status="Sent",
                )
            changed += 1
            changed_students.add(student.id)
            status_counts[new_status] = status_counts.get(new_status, 0) + 1
            audit = compute_course_audit(student)
            compre = comprehensive_exam_eligibility(student)
            if compre["eligible"] and student.current_stage in ("Admission", "Coursework"):
                student.current_stage = "Comprehensive Exam"
            recompute_risk(student)
            add_log("course-audit", sid, actor, f"Course audit {term}".strip(),
                    f"{course.code} marked {new_status}",
                    "Academic Coordinator", f"End-of-semester course audit for {course.code}.")
        if changed:
            sync_overdue_incomplete_alerts()
            status_summary = ", ".join(f"{status}: {count}" for status, count in sorted(status_counts.items()))
            add_log(
                "course-audit",
                None,
                actor,
                "Course audit summary",
                f"{course.code} audit saved: {changed} record(s) updated",
                "Academic Coordinator",
                f"{len(changed_students)} student(s) affected. Status changes: {status_summary}.",
            )
        db.session.commit()
        return jsonify({
            "ok": True, "course": course.code, "updated": changed,
            "message": f"Saved {course.code} audit — {changed} student record(s) updated.",
        })

    @app.route("/api/course-drop/requests")
    @require_api_login("staff", "academic_coordinator")
    def course_drop_requests():
        status = (request.args.get("status") or "Submitted").strip()
        program_id = request.args.get("program_id", type=int)
        query = CourseDropRequest.query
        if status and status.lower() != "all":
            query = query.filter(CourseDropRequest.status == status)
        if program_id:
            query = query.join(Student, Student.id == CourseDropRequest.student_id).filter(
                Student.program_id == program_id
            )
        account = current_account()
        return jsonify({
            "permissions": {
                "can_decide": bool(
                    account and account.role in {"academic_coordinator", "admin"}
                ),
            },
            "items": [
                course_drop_request_dict(item)
                for item in query.order_by(CourseDropRequest.created_at.desc()).limit(100).all()
            ]
        })

    @app.route("/api/course-drop/requests/<int:request_id>/decide", methods=["POST"])
    @require_api_login("academic_coordinator")
    def course_drop_decide(request_id: int):
        data = request.get_json(silent=True) or {}
        request_item = CourseDropRequest.query.get_or_404(request_id)
        if request_item.status != "Submitted":
            return jsonify({"error": "This drop request has already been reviewed."}), 400
        decision = (data.get("decision") or "").strip().lower()
        remarks = (data.get("remarks") or "").strip()
        account = current_account()
        actor = f"Academic Coordinator · {account.full_name}" if account else "Academic Coordinator"
        record = CourseRecord.query.filter_by(student_id=request_item.student_id, course_id=request_item.course_id).first()
        if decision == "approve":
            if not record:
                record = CourseRecord(student_id=request_item.student_id, course_id=request_item.course_id, status="Missing")
                db.session.add(record)
            previous = record.status
            record.status = "Dropped"
            record.grade_status = "No Grade"
            record.resolved_at = None
            record.remarks = remarks or record.remarks
            record.updated_at = now_utc()
            sync_subject_enrollment_from_course_record(
                request_item.student,
                request_item.course,
                request_item.term_label or record.term_label,
                "Dropped",
                "Approved student course drop request",
            )
            request_item.status = "Approved"
            result = f"Drop request approved for {request_item.course.code}"
            add_log(
                "course-audit",
                request_item.student_id,
                actor,
                "Student course drop request",
                result,
                "Student",
                remarks or f"Course status changed from {previous or 'Missing'} to Dropped.",
                previous_status=previous,
                new_status="Dropped",
            )
        elif decision == "reject":
            request_item.status = "Rejected"
            result = f"Drop request rejected for {request_item.course.code}"
            add_log(
                "course-audit",
                request_item.student_id,
                actor,
                "Student course drop request",
                result,
                "Student",
                remarks or "Course status unchanged.",
                previous_status=record.status if record else None,
                new_status=record.status if record else None,
            )
        else:
            return jsonify({"error": "Choose approve or reject."}), 400
        request_item.reviewer_remarks = remarks
        request_item.decided_by = account.full_name if account else "Academic Coordinator"
        request_item.decided_at = now_utc()
        request_item.updated_at = now_utc()
        Task.query.filter(
            Task.student_id == request_item.student_id,
            Task.owner_role == "Academic Coordinator",
            Task.status.in_(["Pending", "Overdue"]),
            Task.title == f"Review course drop request for {request_item.course.code}",
        ).update({"status": "Done"}, synchronize_session=False)
        student = Student.query.get(request_item.student_id)
        if student:
            recompute_risk(student)
        db.session.commit()
        return jsonify({"ok": True, "message": result, "request": course_drop_request_dict(request_item)})

    # ---- Soft-remove a student from the monitoring sheet -------------------
    @app.route("/api/students/<int:student_id>/remove", methods=["POST"])
    @require_api_login("staff", "academic_coordinator")
    def monitoring_remove_student(student_id: int):
        # A "removal" from the monitoring sheet is a soft change: the student is
        # marked Withdrawn (kept in the database with all history) rather than
        # deleted, so records and the activity trail stay intact.
        data = request.get_json(silent=True) or {}
        student = Student.query.get_or_404(student_id)
        reason = (data.get("reason") or "").strip()
        previous = student.standing
        if student.standing == "Withdrawn" and student.enrollment_tag == "Withdrawn":
            return jsonify({"error": f"{student.name} is already marked Withdrawn."}), 400
        student.standing = "Withdrawn"
        student.enrollment_tag = "Withdrawn"
        student.updated_at = now_utc()
        cancelled_subjects = cancel_active_subject_enrollments(
            student,
            reason or "Removed via the monitoring sheet.",
        )
        account = current_account()
        actor = workflow_actor_label(account) if account else "Graduate School Staff"
        add_log(
            "withdrawal",
            student.id,
            actor,
            "Monitoring sheet removal",
            f"{student.name} marked Withdrawn and removed from active monitoring.",
            "Student",
            (
                f"{reason or 'Removed via the monitoring sheet.'} "
                f"Cancelled {cancelled_subjects} active subject enrollment(s)."
            ),
            previous_status=previous,
            new_status="Withdrawn",
        )
        recompute_risk(student)
        db.session.commit()
        return jsonify({"ok": True, "message": f"{student.name} was marked Withdrawn.", "student_id": student.id})

    # ---- Monitoring grid (spreadsheet view, one program at a time) -------
    @app.route("/api/monitoring/grid")
    @require_api_login("staff", "academic_coordinator")
    def monitoring_grid():
        program_id = request.args.get("program_id", type=int)
        program = Program.query.get(program_id) if program_id else Program.query.order_by(Program.code).first()
        if not program:
            return jsonify({"error": "No program found."}), 404

        courses = monitoring_curriculum_courses(program)
        term_id = request.args.get("term_id", type=int)
        selected_term = AcademicTerm.query.get(term_id) if term_id else get_active_term()
        selected_term_label = selected_term.label if selected_term else ""
        students = (
            Student.query.filter_by(program_id=program.id)
        )
        stage = request.args.get("stage", "").strip()
        if stage:
            students = students.filter(Student.current_stage == stage)
        risk = request.args.get("risk", "").strip()
        if risk:
            risk_values = [item.strip() for item in re.split(r"[,/]", risk) if item.strip()]
            students = students.filter(Student.risk_level.in_(risk_values or [risk]))
        enrollment = request.args.get("enrollment", "").strip()
        if enrollment:
            enrollment_values = [item.strip() for item in re.split(r"[,/]", enrollment) if item.strip()]
            students = students.filter(Student.enrollment_tag.in_(enrollment_values or [enrollment]))
        students = students.order_by(Student.last_name.asc(), Student.first_name.asc()).all()
        # Keep exception/final statuses together at the bottom: AWOL first, then final Withdrawn.
        students.sort(key=lambda item: (
            2 if item.standing == "Withdrawn" or item.enrollment_tag == "Withdrawn"
            else 1 if item.enrollment_tag == "AWOL"
            else 0,
            item.last_name.lower(),
            item.first_name.lower(),
        ))
        sids = [s.id for s in students]
        cids = [c.id for c in courses]
        records: dict[tuple[int, int], CourseRecord] = {}
        if sids and cids:
            for rec in CourseRecord.query.filter(
                CourseRecord.student_id.in_(sids), CourseRecord.course_id.in_(cids)
            ).all():
                if not selected_term_label or (rec.term_label or selected_term_label) == selected_term_label:
                    records[(rec.student_id, rec.course_id)] = rec

        cat_order = ["Basic", "Major", "Cognate", "Core", "Comprehensive"]
        grouped: dict[str, list] = {}
        for c in courses:
            grouped.setdefault(c.category or "Core", []).append(
                {"id": c.id, "code": c.code, "title": c.title, "units": c.units or 3}
            )
        categories = [
            {
                "name": name,
                "courses": grouped[name],
                "total_units": sum(c["units"] for c in grouped[name]),
            }
            for name in sorted(grouped, key=lambda n: cat_order.index(n) if n in cat_order else 99)
        ]
        course_units = {c.id: (c.units or 3) for c in courses}
        total_units_all = sum(course_units.values())

        rows = []
        for s in students:
            cells = {}
            done = 0
            done_units = 0
            for c in courses:
                record = records.get((s.id, c.id))
                status = record.status if record else "Missing"
                cells[c.id] = status
                if status == "Completed":
                    done += 1
                    done_units += course_units[c.id]
            compre = comprehensive_exam_eligibility(s)
            rows.append({
                "id": s.id, "name": s.name, "first_name": s.first_name, "last_name": s.last_name, "student_number": s.student_number,
                "entry_year": s.entry_year, "stage": s.current_stage, "risk": s.risk_level,
                "enrollment_tag": s.enrollment_tag,
                "cells": cells, "completed": done, "total": len(courses),
                "grades": {c.id: (records[(s.id, c.id)].grade_value or "") for c in courses if (s.id, c.id) in records},
                "grade_remarks": {c.id: (records[(s.id, c.id)].remarks or "") for c in courses if (s.id, c.id) in records},
                "rate": round(done / len(courses) * 100, 1) if courses else 0,
                "completed_units": done_units, "total_units": total_units_all,
                "eligible": compre["eligible"],
                "compre_eligibility": compre,
                "milestones": monitoring_research_milestones(s),
            })

        progress = request.args.get("progress", "").strip()
        if progress:
            if progress == "not-started":
                rows = [row for row in rows if row["completed"] == 0]
            elif progress == "in-progress":
                rows = [row for row in rows if 0 < row["completed"] < row["total"]]
            elif progress == "complete":
                rows = [row for row in rows if row["total"] > 0 and row["completed"] >= row["total"]]
            elif progress == "units-complete":
                rows = [row for row in rows if row["eligible"]]

        return jsonify({
            "program": program_dict(program),
            "programs": [program_dict(p) for p in Program.query.order_by(Program.code).all()],
            "terms": [term_dict(t) for t in reversed(visible_terms())],
            "selected_term": term_dict(selected_term) if selected_term else None,
            "categories": categories,
            "course_count": len(courses),
            "total_units": total_units_all,
            "students": rows,
            "integrity": enrollment_integrity_payload(program, selected_term),
        })

    @app.route("/api/monitoring/compre-exam", methods=["POST"])
    @require_api_login("academic_coordinator", "staff")
    def monitoring_compre_exam_save():
        data = request_payload()
        student = Student.query.get_or_404(int(data.get("student_id") or 0))
        requested_status = str(data.get("status") or "").strip()
        allowed = {"Not Taken", "Passed", "Failed"}
        if requested_status not in allowed:
            return jsonify({"error": "Choose Eligible, Passed, or Failed for the comprehensive exam status."}), 400
        eligibility = comprehensive_exam_eligibility(student)
        if not eligibility["eligible"] and requested_status in {"Passed", "Failed"}:
            return jsonify({"error": "The student must complete all curriculum subjects before the comprehensive exam can be marked Passed or Failed."}), 400

        previous_status = student.comprehensive_exam_status or "Not Taken"
        student.comprehensive_exam_status = requested_status
        if eligibility["eligible"] and student.current_stage in ("Admission", "Coursework"):
            student.current_stage = "Comprehensive Exam"
        recompute_risk(student)
        account = current_account()
        actor_role = "Faculty" if account and account.role == "faculty" else "Academic Coordinator"
        actor = f"{actor_role} · {account.full_name}" if account else actor_role
        add_log(
            "course-audit",
            student.id,
            actor,
            "Comprehensive exam status",
            f"Comprehensive exam marked {requested_status}",
            "Academic Coordinator",
            f"Changed from {previous_status} to {requested_status}.",
        )
        db.session.commit()
        updated_eligibility = comprehensive_exam_eligibility(student)
        return jsonify({
            "ok": True,
            "student_id": student.id,
            "stage": student.current_stage,
            "risk": student.risk_level,
            "eligible": updated_eligibility["eligible"],
            "compre_eligibility": updated_eligibility,
            "milestones": monitoring_research_milestones(student),
            "message": f"Comprehensive exam marked {requested_status}.",
        })

    # Population-level queue of rule-based recommendations.
    @app.route("/api/decision-support")
    @require_api_login("staff")
    def decision_support():
        sync_overdue_incomplete_alerts(commit=True)
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

    @app.route("/api/leave-of-absence/policy-review", methods=["POST"])
    @require_api_login("staff", "academic_coordinator", "dean")
    def leave_of_absence_policy_review():
        data = request_payload()
        try:
            student_id = int(data.get("student_id") or 0)
        except (TypeError, ValueError):
            return jsonify({"error": "Choose a valid student before running the LOA policy review."}), 400
        student = Student.query.get_or_404(student_id)
        try:
            prior_count = int(data.get("prior_loa_count") or 0)
        except (TypeError, ValueError):
            return jsonify({"error": "Prior LOA count must be a whole number."}), 400
        if prior_count < 0:
            return jsonify({"error": "Prior LOA count cannot be negative."}), 400
        for field in ("request_date",):
            value = (data.get(field) or "").strip()
            if value:
                try:
                    parse_api_date(value)
                except ValueError:
                    return jsonify({"error": "Request date must use YYYY-MM-DD format."}), 400
        return jsonify({"ok": True, "review": loa_policy_review(student, data)})

    @app.route("/api/readmission/policy-review", methods=["POST"])
    @require_api_login("staff", "academic_coordinator", "dean")
    def readmission_policy_review_route():
        data = request_payload()
        try:
            student_id = int(data.get("student_id") or 0)
        except (TypeError, ValueError):
            return jsonify({"error": "Choose a valid student before running the readmission policy review."}), 400
        student = Student.query.get_or_404(student_id)
        submitted_items = set(data.getlist("readmission_items")) if hasattr(data, "getlist") else set()
        unknown_items = sorted(submitted_items - set(readmission_requirements()))
        if unknown_items:
            return jsonify({"error": "Unknown readmission checklist item: " + ", ".join(unknown_items)}), 400
        return jsonify({"ok": True, "review": readmission_policy_review(student, data)})

    @app.route("/api/awol/policy-review", methods=["POST"])
    @require_api_login("staff", "academic_coordinator", "dean")
    def awol_policy_review_route():
        data = request_payload()
        student_id = safe_int(data.get("student_id"))
        if not student_id:
            return jsonify({"error": "Choose a valid student before running the AWOL/residency policy review."}), 400
        student = Student.query.get_or_404(student_id)
        action = (data.get("workflow_action") or data.get("action") or "return_from_awol").strip()
        if action not in {"declare_awol", "return_from_awol", "forward_return_to_dean", "record_residency"}:
            return jsonify({"error": "Choose a valid AWOL or residency review action."}), 400
        if action == "record_residency" and (data.get("residency_reason") or "").strip() not in RESIDENCY_REASONS:
            return jsonify({"error": "Choose a handbook-supported residency reason."}), 400
        return jsonify({"ok": True, "review": awol_policy_review(student, data)})

    # Supplies each workflow screen with student-specific context before
    # submission, such as current audit status or panel recommendations.
    @app.route("/api/transactions/<slug>/context")
    @require_api_login(*BACKOFFICE_ROLES)
    def transaction_context(slug: str):
        if slug not in TRANSACTION_BY_SLUG:
            return jsonify({"error": "Unknown workflow."}), 404
        account = current_account()
        allowed = ROLE_TRANSACTION_ACCESS.get(account.role)
        if allowed is not None and slug not in allowed:
            return jsonify({"error": "This workflow is not assigned to your role."}), 403
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
            file_bytes = file.read()
            parsed = parse_ac_monitoring(io.BytesIO(file_bytes))
            if not parsed["rows"]:
                return jsonify({"error": "No student rows found. Check that the sheet matches the AC Monitoring template."}), 400
            result = import_ac_monitoring(parsed)
            MONITORING_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
            safe_name = secure_filename(file.filename) or "monitoring-sheet.xlsx"
            stored_name = f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{uuid4().hex[:10]}-{safe_name}"
            (MONITORING_UPLOAD_ROOT / stored_name).write_bytes(file_bytes)
            upload = MonitoringSheetUpload(
                original_name=file.filename,
                stored_name=stored_name,
                program_code=parsed["program_code"],
                row_count=len(parsed["rows"]),
                subject_count=len(parsed["subjects"]),
                snapshot_json=json.dumps(parsed, ensure_ascii=False),
                result_json=json.dumps(result, ensure_ascii=False),
            )
            db.session.add(upload)
            db.session.flush()
            result["upload_id"] = upload.id
            db.session.commit()
        except Exception as exc:  # noqa: BLE001 - surface a friendly error to the UI
            db.session.rollback()
            return jsonify({"error": f"Could not import the sheet: {exc}"}), 400
        return jsonify(result)

    @app.route("/api/monitoring/uploads")
    @require_api_login("staff")
    def monitoring_uploads():
        uploads = MonitoringSheetUpload.query.order_by(MonitoringSheetUpload.uploaded_at.desc()).limit(30).all()
        return jsonify({"items": [monitoring_upload_dict(item) for item in uploads]})

    @app.route("/api/monitoring/uploads/<int:upload_id>/download")
    @require_api_login("staff")
    def monitoring_upload_download(upload_id: int):
        upload = MonitoringSheetUpload.query.get_or_404(upload_id)
        return send_from_directory(MONITORING_UPLOAD_ROOT, upload.stored_name, as_attachment=True, download_name=upload.original_name)

    # then the resulting records are committed as one database transaction.
    @app.route("/api/transactions/<slug>", methods=["POST"])
    @require_api_login(*BACKOFFICE_ROLES)
    def transaction_submit(slug: str):
        if slug not in TRANSACTION_BY_SLUG:
            return jsonify({"error": "Unknown workflow."}), 404
        account = current_account()
        allowed = ROLE_TRANSACTION_ACCESS.get(account.role)
        if allowed is not None and slug not in allowed:
            return jsonify({"error": "This workflow is not assigned to your role."}), 403
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
        message = "Saved. The student record, queue, and monitoring indicators were updated."
        if slug in {"leave-of-absence", "readmission"}:
            message = "Forwarded to the Dean. The student record will change only after the Dean decides."
        if slug == "student-handoff" and student_id:
            account = UserAccount.query.filter_by(student_id=student_id, role="student", active=True).first()
            if account:
                message = f"Saved. Student portal account created: {account.email} / {SIM_STUDENT_PASSWORD}."
        return jsonify(
            {
                "ok": True,
                "student_id": student_id,
                "message": message,
            }
        )

    @app.route("/api/transactions/<slug>/messages", methods=["POST"])
    @require_api_login(*BACKOFFICE_ROLES, "dean", "student")
    def transaction_message(slug: str):
        if slug not in {"practicum", "withdrawal", "graduation", "awol"}:
            return jsonify({"error": "Messaging is not available for this workflow."}), 404
        account = current_account()
        data = request_payload()
        student_id = account.student_id if account.role == "student" else safe_int(data.get("student_id"))
        student = Student.query.get_or_404(student_id)
        if account.role in ROLE_TRANSACTION_ACCESS and slug not in ROLE_TRANSACTION_ACCESS[account.role]:
            return jsonify({"error": "This workflow is not assigned to your role."}), 403
        recipient_role = (data.get("recipient_role") or "Graduate School Staff").strip()
        action_type = (data.get("action_type") or "note").strip()
        if account.role == "student":
            if action_type not in {"note", "response"}:
                return jsonify({"error": "Students may send a question or respond to a reviewer, but cannot move or return a request."}), 403
            latest_owner = workflow_case_meta(slug, student.id).get("next_action_owner")
            allowed_recipients = {"Graduate School Staff"}
            if latest_owner in WORKFLOW_RECIPIENTS and latest_owner != "Student":
                allowed_recipients.add(latest_owner)
            if action_type == "response":
                returned = latest_open_student_return(slug, student.id)
                if returned:
                    allowed_recipients.add(returned.sender_role)
            if recipient_role not in allowed_recipients:
                return jsonify({"error": "Send this message to the staff member or reviewer currently handling your request."}), 403
        elif action_type == "response":
            return jsonify({"error": "Reviewers should add a note or return the request instead of using the student response action."}), 403
        visibility = (data.get("visibility") or (
            "student_visible" if account.role == "student" or recipient_role == "Student" else "internal"
        )).strip()
        if account.role == "student":
            visibility = "student_visible"
        try:
            message = create_workflow_message(
                slug,
                student,
                account,
                recipient_role,
                (data.get("template") or "Please clarify request details").strip(),
                data.get("comment") or "",
                action_type,
                visibility,
            )
            db.session.commit()
        except Exception as exc:  # noqa: BLE001
            db.session.rollback()
            return jsonify({"error": str(exc)}), 400
        return jsonify({
            "ok": True,
            "message": "Clarification response saved." if message.action_type == "response" else "Message saved and the next owner was notified.",
            "item": workflow_message_dict(message),
        })

    @app.route("/api/graduation/batch-actions", methods=["POST"])
    @require_api_login("staff", "academic_coordinator", "research_coordinator", "dean")
    def graduation_batch_actions():
        account = current_account()
        data = request_payload()
        student_ids = sorted({safe_int(value) for value in data.getlist("student_ids") if safe_int(value)})
        action = (data.get("stage_action") or data.get("bpm_action") or data.get("action") or "").strip()
        if not student_ids:
            return jsonify({"error": "Select at least one graduation candidate."}), 400

        allowed_actions = {
            "staff": {"compile_to_ac", "mark_not_eligible", "prepare_endorsement", "send_to_dean"},
            "academic_coordinator": {"check_coursework"},
            "research_coordinator": {"validate_research"},
            "dean": {"approve", "return"},
        }
        if action not in allowed_actions.get(account.role, set()):
            return jsonify({"error": "Choose a valid graduation group action for your role and selected stage."}), 403

        updated = []
        skipped = []
        comment = (data.get("comment") or "").strip()
        review_window = (data.get("review_window") or "Current review window").strip()
        try:
            batch_name = graduation_batch_name_from_payload(data, required=action == "compile_to_ac")
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        if action in {"mark_not_eligible", "return"} and not comment:
            return jsonify({"error": "Enter the required reason before applying this action."}), 400

        action_labels = {
            "compile_to_ac": "Compile graduation candidate list and send to Academic Coordinator",
            "check_coursework": "Check coursework completion",
            "validate_research": "Validate research completion requirements",
            "mark_not_eligible": "List missing requirements and mark not eligible",
            "prepare_endorsement": "Prepare endorsement list",
            "send_to_dean": "Send endorsement list to Dean",
            "approve": "Approve endorsement list",
            "return": "Return endorsement list for revision",
        }

        for student_id in student_ids:
            student = db.session.get(Student, student_id)
            if not student:
                skipped.append({"student_id": student_id, "reason": "Student record not found"})
                continue
            endorsement = latest_graduation_endorsement(student.id)
            eligibility = graduation_eligibility(student)
            try:
                current_status = endorsement.endorsement_status if endorsement else "Not Prepared"
                previous = current_status
                next_owner = "Graduate School Staff"
                result = action_labels[action]

                if action == "compile_to_ac":
                    if current_status not in {"Not Prepared", "For Review", "Not Eligible", "Returned for Clarification"}:
                        raise ValueError(f"Current stage is {current_status}")
                    if not endorsement:
                        endorsement = GraduationEndorsement(student_id=student.id, review_window=review_window)
                        db.session.add(endorsement)
                    apply_graduation_eligibility(endorsement, eligibility)
                    endorsement.review_window = review_window
                    endorsement.batch_name = batch_name
                    endorsement.endorsement_status = "Coursework Review"
                    next_owner = "Academic Coordinator"
                    result = "Graduation candidate list compiled and sent for coursework review"
                    add_task(student.id, "Check graduation coursework completion", "Academic Coordinator", 5, 45)
                elif action == "check_coursework":
                    if not endorsement or current_status != "Coursework Review":
                        raise ValueError("Candidate is not awaiting Academic Coordinator coursework review")
                    apply_graduation_eligibility(endorsement, eligibility)
                    if eligibility["coursework_status"] != "Complete":
                        endorsement.endorsement_status = "Coursework Incomplete"
                        next_owner = "Graduate School Staff"
                        result = "Coursework reviewed as incomplete; missing coursework sent to GS Staff"
                        add_task(student.id, "List missing graduation coursework and inform the student", "Graduate School Staff", 5, 35)
                    else:
                        endorsement.endorsement_status = "Research Review"
                        next_owner = "Research Coordinator"
                        result = "Coursework completion verified and candidate sent for research validation"
                        add_task(student.id, "Validate graduation research completion evidence", "Research Coordinator", 5, 45)
                elif action == "validate_research":
                    if not endorsement or current_status != "Research Review":
                        raise ValueError("Candidate is not awaiting Research Coordinator validation")
                    apply_graduation_eligibility(endorsement, eligibility)
                    if eligibility["research_status"] != "Complete":
                        endorsement.endorsement_status = "Research Incomplete"
                        next_owner = "Graduate School Staff"
                        result = "Research requirements reviewed as incomplete; missing evidence sent to GS Staff"
                        add_task(student.id, "List missing graduation research requirements and inform the student", "Graduate School Staff", 5, 35)
                    elif eligibility["practicum_status"] not in {"Not Required", "Completed", "Report Sent to Dean", "Dean Reviewed"}:
                        endorsement.endorsement_status = "Practicum Incomplete"
                        next_owner = eligibility["next_owner"]
                        result = "Practicum completion is incomplete or needs verification before endorsement"
                        add_task(student.id, eligibility["next_action"], eligibility["next_owner"], 5, 35)
                    else:
                        endorsement.endorsement_status = "Eligibility Confirmed"
                        next_owner = "Graduate School Staff"
                        result = "Coursework and research requirements validated for endorsement preparation"
                        add_task(student.id, "Prepare graduation endorsement list", "Graduate School Staff", 5, 45)
                elif action == "mark_not_eligible":
                    if not endorsement or current_status not in {"Coursework Incomplete", "Research Incomplete", "Practicum Incomplete"}:
                        raise ValueError("A coordinator review must identify missing requirements first")
                    endorsement.endorsement_status = "Not Eligible"
                    next_owner = "Student"
                    result = "Missing graduation requirements listed; student recorded as not eligible"
                    add_transition_comment_message(
                        "graduation", student, account, next_owner, result, comment,
                        previous, endorsement.endorsement_status,
                    )
                elif action == "prepare_endorsement":
                    if not endorsement or current_status != "Eligibility Confirmed":
                        raise ValueError("Coursework and research reviews must be complete before preparing the endorsement list")
                    endorsement.endorsement_status = "Endorsement Prepared"
                    next_owner = "Graduate School Staff"
                    result = "Graduation endorsement list prepared"
                elif action == "send_to_dean":
                    if not endorsement or current_status not in {"Endorsement Prepared", "Returned for Revision"}:
                        raise ValueError("Prepare or revise the endorsement list before sending it to the Dean")
                    if batch_name:
                        endorsement.batch_name = batch_name
                    elif not endorsement.batch_name:
                        endorsement.batch_name = default_graduation_batch_name()
                    endorsement.endorsement_status = "Ready for Dean Review"
                    endorsement.submitted_at = now_utc()
                    next_owner = "Dean"
                    result = "Graduation endorsement list prepared for Dean review"
                    add_task(student.id, "Review graduation endorsement list", "Dean", 5, 55)
                elif action == "approve":
                    if not endorsement or endorsement.endorsement_status != "Ready for Dean Review":
                        raise ValueError("Candidate is not ready for Dean review")
                    endorsement.endorsement_status = "Dean Approved"
                    endorsement.dean_remarks = comment or endorsement.dean_remarks
                    endorsement.dean_decision_at = now_utc()
                    endorsement.registrar_status = "Pending Handoff"
                    next_owner = "Dean"
                    result = "Graduation candidate approved in Dean batch"
                    add_task(student.id, "Export and hand off endorsed list to Registrar", "Dean", 3, 40)
                elif action == "return":
                    if account.role == "dean" and (
                        not endorsement or endorsement.endorsement_status != "Ready for Dean Review"
                    ):
                        raise ValueError("Candidate is no longer awaiting Dean review")
                    endorsement.endorsement_status = "Returned for Revision"
                    endorsement.dean_remarks = comment
                    endorsement.dean_decision_at = now_utc()
                    next_owner = "Graduate School Staff"
                    result = "Graduation endorsement returned by Dean for revision"
                    add_task(student.id, "Revise graduation endorsement list", "Graduate School Staff", 4, 35)
                    workflow_message_record(
                        "graduation", student, account, "Graduate School Staff",
                        comment or "This request requires revision", comment, "return",
                        previous, endorsement.endorsement_status, visibility="internal",
                    )

                if action not in {"mark_not_eligible", "return"} and comment:
                    add_transition_comment_message(
                        "graduation", student, account, next_owner, result, comment,
                        previous, endorsement.endorsement_status,
                    )
                endorsement.updated_at = now_utc()
                add_log(
                    "graduation", student.id, workflow_actor_label(account), "Graduation batch",
                    result, next_owner,
                    workflow_notes_with_comment(graduation_notes(endorsement), comment),
                    previous_status=previous, new_status=endorsement.endorsement_status,
                    visibility="internal" if next_owner != "Student" else "student_visible",
                )
                updated.append({"student_id": student.id, "student_name": student.name})
            except ValueError as exc:
                skipped.append({"student_id": student.id, "student_name": student.name, "reason": str(exc)})

        db.session.commit()
        return jsonify({
            "ok": True,
            "updated": updated,
            "skipped": skipped,
            "batch_name": batch_name,
            "action": action,
            "message": f"{action_labels[action]} applied to {len(updated)} candidate(s){f' in {batch_name}' if batch_name else ''}; {len(skipped)} skipped.",
        })

    @app.route("/api/transactions/<slug>/demo-reset", methods=["POST"])
    @require_api_login("staff")
    def transaction_demo_reset(slug: str):
        if slug not in {"practicum", "withdrawal", "graduation"}:
            return jsonify({"error": "Demo reset is available only for Practicum, Withdrawal, and Graduation."}), 404
        data = request_payload()
        student = Student.query.get_or_404(safe_int(data.get("student_id")))
        if not student.student_number.startswith("GS-2026-"):
            return jsonify({"error": "Only seeded GS-2026 demo students can be reset from this control."}), 400
        try:
            result = reset_workflow_demo_case(slug, student)
            db.session.commit()
        except Exception as exc:  # noqa: BLE001
            db.session.rollback()
            return jsonify({"error": str(exc)}), 400
        for stored_name in result.pop("stored_names"):
            (REQUEST_UPLOAD_ROOT / stored_name).unlink(missing_ok=True)
        return jsonify({
            "ok": True,
            **result,
            "message": f"Reset {student.name}'s {TRANSACTION_BY_SLUG[slug]['title']} demo case. The student can start that workflow again.",
        })

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
def _filter_value(filters, key: str, default: str = "") -> str:
    value = filters.get(key, default) if hasattr(filters, "get") else default
    return (value or "").strip() if isinstance(value, str) else str(value or "").strip()


def normalize_filters(filters) -> dict:
    return {
        "program_id": _filter_value(filters, "program_id"),
        "stage": _filter_value(filters, "stage") or _filter_value(filters, "progress"),
        "risk": _filter_value(filters, "risk"),
        "standing": _filter_value(filters, "standing"),
        "owner": _filter_value(filters, "owner"),
        "workflow_type": _filter_value(filters, "workflow_type"),
    }


def filtered_students_query(filters):
    values = normalize_filters(filters)
    query = Student.query.join(Program)
    if values["program_id"]:
        try:
            query = query.filter(Student.program_id == int(values["program_id"]))
        except (TypeError, ValueError):
            pass
    if values["stage"]:
        query = query.filter(Student.current_stage == values["stage"])
    if values["risk"]:
        risk_values = [item.strip() for item in re.split(r"[,/]", values["risk"]) if item.strip()]
        query = query.filter(Student.risk_level.in_(risk_values or [values["risk"]]))
    if values["standing"]:
        query = query.filter(Student.standing == values["standing"])
    if values["owner"]:
        owner_student_ids = (
            db.session.query(Task.student_id)
            .filter(Task.owner_role == values["owner"], Task.status.in_(["Pending", "Overdue"]))
            .distinct()
        )
        query = query.filter(Student.id.in_(owner_student_ids))
    return query


def dashboard_stats(filters=None) -> dict:
    # The dashboard intentionally uses live SQL aggregates instead of cached
    # values so every completed workflow is visible immediately during the demo.
    filters = filters or {}
    student_query = filtered_students_query(filters)
    student_ids = [sid for (sid,) in student_query.with_entities(Student.id).all()]
    empty = len(student_ids) == 0

    def students_scope():
        query = Student.query
        return query.filter(Student.id.in_(student_ids)) if not empty else query.filter(False)

    def scoped(model, attr="student_id"):
        query = model.query
        return query.filter(getattr(model, attr).in_(student_ids)) if not empty else query.filter(False)

    task_query = scoped(Task).filter(Task.status.in_(["Pending", "Overdue"]))
    owner = (filters.get("owner") or "").strip() if hasattr(filters, "get") else ""
    if owner:
        task_query = task_query.filter(Task.owner_role == owner)

    total_students = len(student_ids)
    active_students = students_scope().filter(Student.standing == "Active").count()
    on_leave = students_scope().filter(Student.standing == "On Leave").count()
    completed = students_scope().filter(Student.current_stage == "Completed").count()
    at_risk = students_scope().filter(Student.risk_level.in_(["Medium", "High", "Critical"])).count()
    high_risk = students_scope().filter(Student.risk_level.in_(["High", "Critical"])).count()
    withdrawn = students_scope().filter(Student.standing == "Withdrawn").count()
    pending_tasks = task_query.count()
    overdue_tasks = task_query.filter(Task.due_at < date.today(), Task.status != "Done").count()
    confirmed_schedules = scoped(ScheduleRequest).filter(ScheduleRequest.status.in_(ACTIVE_DEFENSE_STATUSES)).count()
    needs_availability = scoped(ScheduleRequest).filter(ScheduleRequest.status.in_(PENDING_DEFENSE_STATUSES)).count()
    practicum_records = scoped(PracticumRecord).count()
    withdrawal_requests = scoped(WithdrawalApplication).count()
    graduation_candidates = scoped(GraduationEndorsement).count()

    stage_counts = dict(
        db.session.query(Student.current_stage, func.count(Student.id))
        .filter(Student.id.in_(student_ids) if not empty else False)
        .group_by(Student.current_stage)
        .all()
    )
    stage_distribution = [{"stage": stage, "count": stage_counts.get(stage, 0)} for stage in STAGES]

    risk_counts = dict(
        db.session.query(Student.risk_level, func.count(Student.id))
        .filter(Student.id.in_(student_ids) if not empty else False)
        .group_by(Student.risk_level)
        .all()
    )
    risk_distribution = [{"risk": level, "count": risk_counts.get(level, 0)} for level in ["Low", "Medium", "High", "Critical"]]

    college_rows = (
        db.session.query(Program.college, func.count(Student.id))
        .join(Student, Student.program_id == Program.id)
        .filter(Student.id.in_(student_ids) if not empty else False)
        .group_by(Program.college)
        .order_by(func.count(Student.id).desc())
        .all()
    )
    college_distribution = [{"college": c, "count": n} for c, n in college_rows]

    gate_rows = (
        db.session.query(ResearchCase.current_gate, func.count(ResearchCase.id))
        .filter(ResearchCase.student_id.in_(student_ids) if not empty else False)
        .group_by(ResearchCase.current_gate)
        .all()
    )
    gate_distribution = [{"gate": g, "count": n} for g, n in gate_rows]

    owner_rows = (
        db.session.query(Task.owner_role, func.count(Task.id))
        .filter(Task.student_id.in_(student_ids) if not empty else False)
        .filter(Task.status.in_(["Pending", "Overdue"]))
        .group_by(Task.owner_role)
        .order_by(func.count(Task.id).desc())
        .all()
    )
    tasks_by_owner = [{"owner": o, "count": n} for o, n in owner_rows]

    schedule_rows = (
        db.session.query(ScheduleRequest.status, func.count(ScheduleRequest.id))
        .filter(ScheduleRequest.student_id.in_(student_ids) if not empty else False)
        .group_by(ScheduleRequest.status)
        .all()
    )
    schedule_distribution = [{"status": s, "count": n} for s, n in schedule_rows]

    workflow_rows = [
        {"workflow": "Practicum", "count": practicum_records},
        {"workflow": "Withdrawal", "count": withdrawal_requests},
        {"workflow": "Graduation", "count": graduation_candidates},
    ]

    recent_logs = (
        human_activity_query()
        .filter(TransactionLog.student_id.in_(student_ids) if not empty else False)
        .order_by(TransactionLog.created_at.desc())
        .limit(8)
        .all()
    )
    open_tasks = (
        task_query.order_by(Task.priority.desc(), Task.due_at.asc())
        .limit(8)
        .all()
    )

    return {
        "filters": normalize_filters(filters),
        "kpis": {
            "total_students": total_students,
            "active_students": active_students,
            "on_leave": on_leave,
            "completed": completed,
            "at_risk": at_risk,
            "high_risk": high_risk,
            "withdrawn": withdrawn,
            "pending_tasks": pending_tasks,
            "overdue_tasks": overdue_tasks,
            "confirmed_schedules": confirmed_schedules,
            "needs_availability": needs_availability,
            "practicum_records": practicum_records,
            "withdrawal_requests": withdrawal_requests,
            "graduation_candidates": graduation_candidates,
        },
        "stage_distribution": stage_distribution,
        "risk_distribution": risk_distribution,
        "college_distribution": college_distribution,
        "gate_distribution": gate_distribution,
        "tasks_by_owner": tasks_by_owner,
        "schedule_distribution": schedule_distribution,
        "workflow_distribution": workflow_rows,
        "recent_logs": [log_dict(l) for l in recent_logs],
        "open_tasks": [task_dict(t) for t in open_tasks],
    }


RISK_DEFINITIONS = {
    "Low": "Student is progressing normally with no immediate intervention needed.",
    "Medium": "Student may need monitoring due to early signs of delay or pending requirements.",
    "High": "Student is delayed or has multiple pending items requiring staff follow-up.",
    "Critical": "Student is significantly delayed, inactive, AWOL, or needs urgent intervention.",
}


def dashboard_student_row(student: Student) -> dict:
    latest_log = (
        TransactionLog.query.filter_by(student_id=student.id)
        .order_by(TransactionLog.created_at.desc())
        .first()
    )
    return {
        **student_brief(student),
        "stage": student.current_stage,
        "status": student.standing,
        "risk": student.risk_level,
        "relevant_date": iso(latest_log.created_at if latest_log else student.updated_at),
    }


def dashboard_drilldown_payload(filters) -> dict:
    kind = _filter_value(filters, "type")
    value = _filter_value(filters, "value")
    scoped_students = filtered_students_query(filters)
    scoped_ids = [student_id for (student_id,) in scoped_students.with_entities(Student.id).all()]
    if kind in {"stage", "risk", "college"}:
        query = scoped_students
        if kind == "stage":
            query = query.filter(Student.current_stage == value)
        elif kind == "risk":
            query = query.filter(Student.risk_level == value)
        else:
            query = query.filter(Program.college == value)
        students = query.order_by(Student.last_name.asc(), Student.first_name.asc()).limit(150).all()
        return {
            "type": kind,
            "value": value,
            "title": f"{value} {'risk' if kind == 'risk' else 'students'}",
            "definition": RISK_DEFINITIONS.get(value) if kind == "risk" else None,
            "rows": [dashboard_student_row(student) for student in students],
        }
    if kind == "schedule":
        requests = (
            ScheduleRequest.query.filter(ScheduleRequest.status == value, ScheduleRequest.student_id.in_(scoped_ids))
            .order_by(ScheduleRequest.preferred_date.asc())
            .limit(150)
            .all()
        )
        rows = []
        for item in requests:
            case = ResearchCase.query.filter_by(student_id=item.student_id).order_by(ResearchCase.opened_at.desc()).first()
            panel_gate = case.current_gate if case else "Form 1 - Title Defense"
            panel = (
                PanelAssignment.query.filter_by(student_id=item.student_id, gate=panel_gate)
                .order_by(PanelAssignment.score.desc())
                .all()
            )
            rows.append({
                "id": item.id,
                "student": student_brief(item.student),
                "defense_type": case.current_gate if case else "Defense",
                "adviser": item.student.adviser_name,
                "panel": [assignment.faculty.name for assignment in panel if assignment.faculty],
                "status": item.status,
                "date": iso(item.preferred_date),
                "time": None,
                "venue": item.venue,
                "missing_action": (
                    "Collect panel/adviser availability" if item.status in PENDING_DEFENSE_STATUSES
                    else "Confirm the revised date with participants" if item.status == "Rescheduled"
                    else "No action needed"
                ),
            })
        return {"type": kind, "value": value, "title": f"Defense schedules - {value}", "rows": rows}
    if kind == "gate":
        cases = ResearchCase.query.filter(ResearchCase.current_gate == value, ResearchCase.student_id.in_(scoped_ids)).order_by(ResearchCase.opened_at.asc()).limit(150).all()
        return {"type": kind, "value": value, "title": value, "rows": [dashboard_student_row(item.student) for item in cases]}
    if kind == "owner":
        tasks = Task.query.filter(Task.owner_role == value, Task.student_id.in_(scoped_ids), Task.status.in_(["Pending", "Overdue"])).order_by(Task.due_at.asc()).limit(150).all()
        return {"type": kind, "value": value, "title": f"Open work owned by {value}", "rows": [task_dict(item) for item in tasks]}
    return {"type": kind, "value": value, "title": "Dashboard details", "rows": []}


def safe_int(value, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


PRACTICUM_ELIGIBILITY_CONFIG = {
    "unit_requirements": {"Basic": 6, "Major": 9, "Cognate": 6},
    "total_units_required": 21,
    "stage_requirements": [
        {"key": "title", "label": "Title stage", "minimum_stage": "Proposal Development"},
        {"key": "proposal", "label": "Proposal stage", "minimum_stage": "Data Collection"},
        {"key": "ethics", "label": "Ethics clearance", "minimum_stage": "Data Collection"},
        {"key": "final", "label": "Final stage", "minimum_stage": "Final Defense"},
    ],
}

DEPLOYMENT_POLICY_QUESTIONS = [
    "What exact student data source will verify completed units?",
    "Will units come from Registrar records, uploaded forms, encoded curriculum records, or imported spreadsheets?",
    "How will title, proposal, ethics, and final-stage completion be verified?",
    "Which certificates or documents are required for practicum, withdrawal, and graduation?",
    "Can the GS office provide sample data so the production fields match the real source records?",
    "May staff manually override eligibility when source data is incomplete?",
    "Which role has authority to approve an eligibility override?",
]


def eligibility_item(
    key: str,
    label: str,
    required_value,
    actual_value,
    passed: bool | None,
    source_field: str,
    note: str = "",
) -> dict:
    return {
        "key": key,
        "label": label,
        "required": required_value,
        "required_value": required_value,
        "actual": actual_value,
        "actual_value": actual_value,
        "passed": passed,
        # `complete` is retained for existing UI clients while `passed=None`
        # distinguishes missing source data from a confirmed failed criterion.
        "complete": passed is True,
        "status": "Passed" if passed is True else "Not met" if passed is False else "Needs verification",
        "source_field": source_field,
        "note": note,
    }


def practicum_eligibility(student: Student) -> dict:
    """Compute practicum eligibility from centralized, replaceable source rules."""
    audit = compute_course_audit(student)
    category_rows = {row["category"]: row for row in audit.get("by_category", [])}
    stage_known = student.current_stage in STAGES
    stage_index = STAGES.index(student.current_stage) if stage_known else None
    case = (
        ResearchCase.query.filter_by(student_id=student.id)
        .order_by(ResearchCase.opened_at.desc())
        .first()
    )
    stage_evidence = {
        "title": bool(case and case.current_gate in {"Form 4 - Proposal Defense Readiness", "Final Defense", "Completion Evidence"}),
        "proposal": bool(case and case.current_gate in {"Final Defense", "Completion Evidence"}),
        "ethics": bool(case and case.current_gate in {"Final Defense", "Completion Evidence"}),
        "final": bool(case and (case.current_gate == "Completion Evidence" or case.status == "Verified Complete")),
    }

    unit_values = {
        category: category_rows.get(category, {}).get("completed_units")
        for category in PRACTICUM_ELIGIBILITY_CONFIG["unit_requirements"]
    }
    total = audit.get("completed_units", 0)
    checklist = []
    for category, required in PRACTICUM_ELIGIBILITY_CONFIG["unit_requirements"].items():
        actual = unit_values[category]
        checklist.append(eligibility_item(
            category.lower(),
            f"{category} units completed",
            required,
            actual if actual is not None else "No source data",
            None if actual is None else actual >= required,
            f"course_audit.by_category.{category}",
            "Curriculum category is not present in the encoded program." if actual is None else "",
        ))
    total_required = PRACTICUM_ELIGIBILITY_CONFIG["total_units_required"]
    checklist.append(eligibility_item(
        "total",
        "Total units completed",
        total_required,
        total if audit.get("required_count") else "No curriculum data",
        None if not audit.get("required_count") else total >= total_required,
        "course_audit.completed_units",
        "No encoded curriculum is available for verification." if not audit.get("required_count") else "",
    ))
    stage_results = {}
    for rule in PRACTICUM_ELIGIBILITY_CONFIG["stage_requirements"]:
        passed = stage_evidence[rule["key"]]
        if not passed and stage_known:
            passed = stage_index >= STAGES.index(rule["minimum_stage"])
        actual = student.current_stage if stage_known else case.current_gate if case else "No source data"
        result = None if not stage_known and not case else bool(passed)
        stage_results[rule["key"]] = result is True
        checklist.append(eligibility_item(
            rule["key"],
            rule["label"],
            "Completed",
            actual,
            result,
            "student.current_stage / research_case.current_gate",
            "Academic/research milestone data needs verification." if result is None else "",
        ))

    needs_verification = any(item["passed"] is None for item in checklist)
    eligible = bool(
        student.program.has_practicum
        and student.standing == "Active"
        and not needs_verification
        and all(item["passed"] is True for item in checklist)
    )
    status = "Eligible" if eligible else "Needs verification" if needs_verification else "Not eligible"
    return {
        "eligible": eligible,
        "status": status,
        "basic_units_completed": unit_values["Basic"],
        "major_units_completed": unit_values["Major"],
        "cognate_units_completed": unit_values["Cognate"],
        "total_units_completed": total,
        "title_completed": stage_results["title"],
        "proposal_completed": stage_results["proposal"],
        "ethics_completed": stage_results["ethics"],
        "final_completed": stage_results["final"],
        "needs_verification": needs_verification,
        "config": PRACTICUM_ELIGIBILITY_CONFIG,
        "checklist": checklist,
    }


PRACTICUM_TIMELINE = [
    "MOA Preparation",
    "MOA Submitted",
    "MOA Under Review",
    "Practicum In Progress",
    "Documents Submitted",
    "Documents Under Review",
    "Hours Incomplete",
    "Additional Certificates Requested",
    "Practicum Completion Recorded",
    "Status Report Sent to Dean",
    "Dean Reviewed",
]


def practicum_timeline(record: PracticumRecord | None, eligibility: dict) -> list[dict]:
    status_alias = {
        "MOA Received": "MOA Submitted",
        "Under Review": "MOA Under Review",
        "Completed": "Practicum Completion Recorded",
        "Report Sent to Dean": "Status Report Sent to Dean",
    }
    current = status_alias.get(record.status if record else "", record.status if record else "MOA Preparation")
    if record and record.document_status in {"Uploaded", "Pending Review", "Verified"} and current in {"MOA Submitted", "MOA Under Review", "Practicum In Progress"}:
        current = "Documents Submitted"
    current_index = PRACTICUM_TIMELINE.index(current) if current in PRACTICUM_TIMELINE else 0
    return [
        {"label": label, "state": "complete" if index < current_index else "current" if index == current_index else "upcoming"}
        for index, label in enumerate(PRACTICUM_TIMELINE)
    ]


def apply_practicum_payload(record: PracticumRecord, data: MultiDict, student: Student) -> None:
    record.moa_status = (data.get("moa_status") or record.moa_status or "Pending Review").strip()
    record.practicum_site = (data.get("practicum_site") or data.get("site") or record.practicum_site or "").strip()
    record.supervisor_name = (data.get("supervisor_name") or record.supervisor_name or "").strip()
    record.required_hours = max(safe_int(data.get("required_hours"), record.required_hours or 0), 0)
    record.completed_hours = max(safe_int(data.get("completed_hours"), record.completed_hours or 0), 0)
    record.certificate_count = max(safe_int(data.get("certificate_count"), record.certificate_count or 0), 0)
    record.document_status = (data.get("document_status") or record.document_status or "Pending Review").strip()
    record.remarks = (data.get("remarks") or record.remarks or "").strip()
    record.completion_status = (data.get("completion_status") or record.completion_status or "Pending").strip()
    moa_attachment = request_attachment_from_payload(student, "practicum", data)
    if moa_attachment:
        record.moa_attachment_id = moa_attachment.id
        record.moa_uploaded = True
        record.moa_status = "Uploaded"
    record.moa_uploaded = bool(record.moa_uploaded or data.get("moa_uploaded") in {"true", "1", "yes", "on"})
    cert_attachment_id = safe_int(data.get("certificate_attachment_id"), 0)
    if cert_attachment_id:
        cert = StudentRequestAttachment.query.filter_by(
            id=cert_attachment_id,
            student_id=student.id,
            request_type="practicum",
        ).first()
        if cert:
            record.certificate_attachment_id = cert.id
            record.document_status = "Pending Review"
    if record.required_hours == 0:
        record.required_hours = 200
    record.updated_at = now_utc()


def practicum_notes(record: PracticumRecord) -> str:
    return (
        f"MOA: {record.moa_status}; site: {record.practicum_site or 'Not specified'}; "
        f"hours: {record.completed_hours or 0}/{record.required_hours or 0}; "
        f"documents: {record.document_status}; certificates: {record.certificate_count or 0}; "
        f"remarks: {record.remarks or 'None'}."
    )


def apply_withdrawal_payload(application: WithdrawalApplication, data: MultiDict) -> None:
    application.reason = (data.get("reason") or application.reason or "").strip()
    application.effective_term = (data.get("effective_term") or application.effective_term or "").strip()
    application.fee_status = (data.get("fee_status") or application.fee_status or "Pending").strip()
    application.requirement_status = (data.get("requirement_status") or application.requirement_status or "Pending").strip()
    # Dean decisions are accepted only through the Dean approval endpoint.
    # Staff actions below record routing and follow-through without impersonating
    # the approving role.
    application.staff_remarks = (data.get("staff_remarks") or application.staff_remarks or "").strip()
    application.academic_coordinator_remarks = (
        data.get("academic_coordinator_remarks") or application.academic_coordinator_remarks or ""
    ).strip()
    application.registrar_status = (data.get("registrar_status") or application.registrar_status or "Pending").strip()
    request_attachment_id = safe_int(data.get("request_attachment_id") or data.get("attachment_id"), 0)
    if request_attachment_id:
        application.request_attachment_id = request_attachment_id
    proof_attachment_id = safe_int(data.get("proof_attachment_id"), 0)
    if proof_attachment_id:
        application.proof_attachment_id = proof_attachment_id
    if application.dean_decision in {"Approved", "Denied", "Returned"} and not application.decided_at:
        application.decided_at = now_utc()
    application.updated_at = now_utc()


def withdrawal_notes(application: WithdrawalApplication) -> str:
    return (
        f"Reason: {application.reason or 'Not provided'}; effective semester: {application.effective_term or 'Not specified'}; "
        f"Dean: {application.dean_decision}; requirements: {application.requirement_status}; "
        f"fees: {application.fee_status}; registrar: {application.registrar_status}; "
        f"AC remarks: {application.academic_coordinator_remarks or 'None'}; staff remarks: {application.staff_remarks or 'None'}."
    )


def graduation_research_progress(student: Student, research_case: ResearchCase | None = None) -> dict:
    """Summarize the upstream research workflow used by Graduation readiness.

    Research Gate remains the source of truth.  This payload only projects its
    stage requirements, matched panels, confirmed schedules, and verdicts into
    the Graduation screen so staff can see what is complete and what still
    blocks endorsement.
    """
    if research_case is None:
        research_case = (
            ResearchCase.query.filter_by(student_id=student.id)
            .order_by(ResearchCase.opened_at.desc())
            .first()
        )

    gates = [gate for _stage_name, gate in RESEARCH_STAGE_SEQUENCE]
    all_gates = [*gates, "Completion Evidence"]
    documents_by_gate = {gate: {} for gate in all_gates}
    for document in DocumentCheck.query.filter(
        DocumentCheck.student_id == student.id,
        DocumentCheck.gate.in_(all_gates),
    ).all():
        documents_by_gate.setdefault(document.gate, {})[document.item_name] = document

    panels_by_gate = Counter(
        assignment.gate
        for assignment in PanelAssignment.query.filter(
            PanelAssignment.student_id == student.id,
            PanelAssignment.gate.in_(gates),
        ).all()
    )
    schedules_by_type = {}
    for schedule in ScheduleRequest.query.filter(
        ScheduleRequest.student_id == student.id,
        ScheduleRequest.status.in_(ACTIVE_DEFENSE_STATUSES),
        ScheduleRequest.defense_type.in_(RESEARCH_GATE_DEFENSE_TYPES.values()),
    ).order_by(ScheduleRequest.confirmed_at.desc(), ScheduleRequest.created_at.desc()).all():
        schedules_by_type.setdefault(schedule.defense_type, schedule)

    outcomes_by_gate = {}
    for verdict in DefenseVerdict.query.filter(
        DefenseVerdict.student_id == student.id,
        DefenseVerdict.gate.in_(gates),
    ).order_by(DefenseVerdict.submitted_at.desc()).all():
        outcomes_by_gate.setdefault(verdict.gate, {
            "result": verdict.result,
            "recorded_at": iso(verdict.submitted_at),
        })
    if len(outcomes_by_gate) < len(gates):
        legacy_results = [
            f"{defense_type}: {result}"
            for defense_type in RESEARCH_GATE_DEFENSE_TYPES.values()
            for result in ("Passed", "Failed")
        ]
        for log in TransactionLog.query.filter(
            TransactionLog.transaction_slug == "research-gate",
            TransactionLog.student_id == student.id,
            TransactionLog.source_reference.in_(gates),
            TransactionLog.result.in_(legacy_results),
        ).order_by(TransactionLog.created_at.desc()).all():
            outcomes_by_gate.setdefault(log.source_reference, {
                "result": "Passed" if log.result.endswith(": Passed") else "Failed",
                "recorded_at": iso(log.created_at),
            })

    required_panel_count = len(panel_roles_for_student(student))
    legacy_verified = bool(
        research_case
        and research_case.current_gate == "Completion Evidence"
        and research_case.status == "Verified Complete"
    )
    stages = []
    for stage_name, gate in RESEARCH_STAGE_SEQUENCE:
        required_items = required_documents_for_gate(gate)
        panel_count = panels_by_gate.get(gate, 0)
        schedule = schedules_by_type.get(RESEARCH_GATE_DEFENSE_TYPES[gate])
        outcome = outcomes_by_gate.get(gate)
        requirement_count = len(required_items)
        panel_complete = panel_count >= required_panel_count
        schedule_complete = schedule is not None
        defense_complete = bool(outcome and outcome["result"] == "Passed")
        schedule_item = RESEARCH_DEFENSE_SCHEDULE_ITEMS[gate]
        result_item = RESEARCH_DEFENSE_RESULT_ITEMS[gate]

        def requirement_complete(item_name: str) -> bool:
            if item_name == "Recommended panel set":
                return panel_complete
            if item_name == schedule_item:
                return schedule_complete
            if item_name == result_item:
                return defense_complete
            document = documents_by_gate.get(gate, {}).get(item_name)
            return bool(document and document.status in {"Complete", "Verified Complete"})

        complete_requirement_count = sum(requirement_complete(item) for item in required_items)
        requirements_complete = complete_requirement_count == requirement_count
        stage_complete = legacy_verified or (
            requirements_complete
            and panel_complete
            and schedule_complete
            and defense_complete
        )
        stages.append({
            "name": stage_name,
            "gate": gate,
            "status": "Complete" if stage_complete else f"{requirement_count - complete_requirement_count} requirement(s) pending",
            "complete": stage_complete,
            "requirements_complete": complete_requirement_count,
            "requirements_total": requirement_count,
            "panel": {
                "status": "Complete" if panel_complete or legacy_verified else "Incomplete",
                "assigned_count": panel_count,
                "required_count": required_panel_count,
            },
            "schedule": {
                "status": schedule.status if schedule else "Not scheduled",
                "complete": schedule_complete or legacy_verified,
                "date": schedule.preferred_date.isoformat() if schedule and schedule.preferred_date else None,
                "start_time": schedule.start_time.strftime("%H:%M") if schedule and schedule.start_time else None,
                "end_time": schedule.end_time.strftime("%H:%M") if schedule and schedule.end_time else None,
                "venue": schedule.venue if schedule else None,
            },
            "defense": {
                "status": outcome["result"] if outcome else "Not recorded",
                "complete": defense_complete or legacy_verified,
                "recorded_at": outcome["recorded_at"] if outcome else None,
            },
        })

    completion_items = required_documents_for_gate("Completion Evidence")
    completion_count = sum(
        bool(
            documents_by_gate.get("Completion Evidence", {}).get(item)
            and documents_by_gate["Completion Evidence"][item].status in {"Complete", "Verified Complete"}
        )
        for item in completion_items
    )
    completion_complete = legacy_verified or completion_count == len(completion_items)
    completed_stage_count = sum(stage["complete"] for stage in stages)
    return {
        "stages": stages,
        "completed_stage_count": completed_stage_count,
        "stage_count": len(stages),
        "research_gates_complete": legacy_verified or completed_stage_count == len(stages),
        "completion_evidence": {
            "status": "Complete" if completion_complete else "Incomplete",
            "complete": completion_complete,
            "requirements_complete": completion_count,
            "requirements_total": len(completion_items),
        },
        "legacy_verified": legacy_verified,
    }


def graduation_eligibility(student: Student) -> dict:
    audit = compute_course_audit(student)
    missing_coursework = [
        f"{row['course'].code} - {row['course'].title}"
        for row in audit["missing"] + audit["incomplete"]
    ]
    coursework_known = audit.get("required_count", 0) > 0
    coursework_complete = coursework_known and audit["missing_count"] == 0 and audit["eligibility"].get("units_complete")

    research_case = (
        ResearchCase.query.filter_by(student_id=student.id)
        .order_by(ResearchCase.opened_at.desc())
        .first()
    )
    research_progress = graduation_research_progress(student, research_case)
    research_known = research_case is not None
    research_missing = []
    for stage in research_progress["stages"]:
        if stage["complete"]:
            continue
        if stage["requirements_complete"] < stage["requirements_total"]:
            research_missing.append(
                f"{stage['name']} requirements "
                f"({stage['requirements_complete']}/{stage['requirements_total']} complete)"
            )
        if stage["panel"]["status"] != "Complete":
            research_missing.append(
                f"{stage['name']} panel matching "
                f"({stage['panel']['assigned_count']}/{stage['panel']['required_count']} assigned)"
            )
        if not stage["schedule"]["complete"]:
            research_missing.append(f"{stage['name']} confirmed defense schedule")
        if not stage["defense"]["complete"]:
            research_missing.append(f"{stage['name']} passing defense result")

    research_complete = bool(
        research_known
        and research_progress["research_gates_complete"]
    )

    practicum_required = bool(student.program.has_practicum)
    practicum_record = latest_practicum_record(student.id)
    practicum_complete = not practicum_required
    practicum_known = not practicum_required
    missing_practicum = ""
    practicum_status = "Not Required"
    if practicum_required:
        if practicum_record:
            practicum_known = True
            enough_hours = (practicum_record.completed_hours or 0) >= (practicum_record.required_hours or 0)
            practicum_complete = enough_hours and practicum_record.status in {"Completed", "Report Sent to Dean", "Dean Reviewed"}
            practicum_status = practicum_record.status
            if not practicum_complete:
                missing_practicum = (
                    f"Practicum incomplete: {practicum_record.completed_hours or 0}/"
                    f"{practicum_record.required_hours or 0} hours, status {practicum_record.status}."
                )
        else:
            practicum_status = "Missing"
            missing_practicum = "No practicum record on file for a practicum-required program."

    open_tasks = Task.query.filter(
        Task.student_id == student.id,
        Task.status.in_(["Pending", "Overdue"]),
    ).order_by(Task.due_at.asc()).all()
    checklist = [
        eligibility_item(
            "coursework",
            "Course units completed",
            audit.get("total_units") or "Encoded curriculum total",
            audit.get("completed_units") if coursework_known else "No curriculum data",
            coursework_complete if coursework_known else None,
            "course_audit.completed_units",
            "Coursework source data needs verification." if not coursework_known else "",
        ),
        *[
            eligibility_item(
                f"research_{stage['gate'].lower().replace(' ', '_').replace('-', '_')}",
                f"{stage['name']} workflow",
                "Requirements, panel, schedule, and passing result complete",
                (
                    f"Requirements {stage['requirements_complete']}/{stage['requirements_total']}; "
                    f"panel {stage['panel']['assigned_count']}/{stage['panel']['required_count']}; "
                    f"schedule {stage['schedule']['status']}; defense {stage['defense']['status']}"
                ),
                stage["complete"] if research_known else None,
                "research_gate + panel_assignment + schedule_request + defense_verdict",
                "Research Gate source data needs verification." if not research_known else "",
            )
            for stage in research_progress["stages"]
        ],
        eligibility_item(
            "practicum",
            "Practicum completed",
            "Completed" if practicum_required else "Not required",
            practicum_status,
            practicum_complete if practicum_known else None,
            "program.has_practicum + practicum_record",
            "Practicum completion needs verification." if not practicum_known else "",
        ),
        eligibility_item(
            "documents",
            "Post-defense completion documents",
            "Complete",
            (
                "Complete"
                if research_progress["completion_evidence"]["complete"]
                else (
                    f"{research_progress['completion_evidence']['requirements_complete']}/"
                    f"{research_progress['completion_evidence']['requirements_total']} complete"
                )
            ),
            research_progress["completion_evidence"]["complete"] if research_known else None,
            "document_check.Completion Evidence",
            "Exact certificate requirements remain subject to GS office confirmation.",
        ),
    ]
    needs_verification = any(item["passed"] is None for item in checklist)
    eligible = all(item["passed"] is True for item in checklist)
    overall_status = "Eligible" if eligible else "Needs verification" if needs_verification else "Not eligible"
    if not coursework_known:
        next_owner = "Academic Coordinator"
        next_action = "Verify the graduation coursework source data"
    elif missing_coursework:
        next_owner = "Academic Coordinator"
        next_action = "Resolve graduation missing coursework"
    elif not research_known:
        next_owner = "Research Coordinator"
        next_action = "Verify the graduation research source data"
    elif research_missing:
        next_owner = "Research Coordinator"
        next_action = "Resolve graduation missing research requirements"
    elif practicum_required and not practicum_known:
        next_owner = "Academic Coordinator"
        next_action = "Verify practicum completion for graduation"
    elif practicum_required and not practicum_complete:
        next_owner = "Student"
        next_action = "Complete the practicum requirement before graduation endorsement"
    else:
        next_owner = "Graduate School Staff"
        next_action = "Prepare graduation endorsement list"

    return {
        "eligible": bool(eligible),
        "status": overall_status,
        "needs_verification": needs_verification,
        "coursework_status": "Complete" if coursework_complete else "Needs verification" if not coursework_known else "Incomplete",
        "research_status": "Complete" if research_complete else "Needs verification" if not research_known else "Incomplete",
        "practicum_status": practicum_status if practicum_required else "Not Required",
        "missing_coursework": missing_coursework,
        "missing_research_requirements": research_missing,
        "missing_practicum_requirement": missing_practicum,
        "checklist": checklist,
        "research_progress": research_progress,
        "pending_tasks": [task_dict(task) for task in open_tasks],
        "next_owner": next_owner,
        "next_action": next_action,
    }


def apply_graduation_eligibility(endorsement: GraduationEndorsement, eligibility: dict) -> None:
    endorsement.coursework_status = eligibility["coursework_status"]
    endorsement.research_status = eligibility["research_status"]
    endorsement.practicum_status = eligibility["practicum_status"]
    endorsement.missing_coursework = "\n".join(eligibility["missing_coursework"])
    endorsement.missing_research_requirements = "\n".join(eligibility["missing_research_requirements"])
    endorsement.missing_practicum_requirement = eligibility["missing_practicum_requirement"]
    endorsement.updated_at = now_utc()


GRADUATION_BATCH_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]
GRADUATION_BATCH_NAME_RE = re.compile(
    r"^Batch(?:\s+No\.)?\s+([1-9]\d*)\s+("
    + "|".join(GRADUATION_BATCH_MONTHS)
    + r")\s+(\d{4})$",
    re.IGNORECASE,
)


def normalize_graduation_batch_name(value: str) -> str:
    raw = re.sub(r"\s+", " ", (value or "").strip())
    match = GRADUATION_BATCH_NAME_RE.match(raw)
    if not match:
        raise ValueError("Use the batch format: Batch 1 July 2026.")
    batch_no, month, year = match.groups()
    month = next(item for item in GRADUATION_BATCH_MONTHS if item.lower() == month.lower())
    return f"Batch {int(batch_no)} {month} {year}"


def default_graduation_batch_name() -> str:
    today = now_utc()
    month = today.strftime("%B")
    year = today.year
    suffix = f"{month} {year}"
    names = [
        name for (name,) in GraduationEndorsement.query
        .filter(GraduationEndorsement.batch_name.like(f"Batch % {suffix}"))
        .with_entities(GraduationEndorsement.batch_name)
        .distinct()
        .all()
        if name
    ]
    numbers = []
    for name in names:
        try:
            normalized = normalize_graduation_batch_name(name)
        except ValueError:
            continue
        match = GRADUATION_BATCH_NAME_RE.match(normalized)
        if match and match.group(2) == month and int(match.group(3)) == year:
            numbers.append(int(match.group(1)))
    return f"Batch {(max(numbers) + 1) if numbers else 1} {suffix}"


def graduation_batch_name_from_payload(data: MultiDict, required: bool = False) -> str:
    batch_name = (data.get("batch_name") or "").strip()
    batch_no = (data.get("batch_no") or "").strip()
    batch_month = (data.get("batch_month") or "").strip()
    batch_year = (data.get("batch_year") or "").strip()
    if batch_name:
        return normalize_graduation_batch_name(batch_name)
    if any([batch_no, batch_month, batch_year]):
        if not all([batch_no, batch_month, batch_year]):
            raise ValueError("Enter the batch number, month, and year.")
        if not batch_no.isdigit() or int(batch_no) <= 0:
            raise ValueError("Batch number must be a positive whole number.")
        if batch_month not in GRADUATION_BATCH_MONTHS:
            raise ValueError("Choose a valid batch month.")
        if not batch_year.isdigit() or len(batch_year) != 4:
            raise ValueError("Batch year must use four digits.")
        return f"Batch {int(batch_no)} {batch_month} {batch_year}"
    if required:
        return default_graduation_batch_name()
    return ""


def graduation_notes(endorsement: GraduationEndorsement) -> str:
    coursework = endorsement.missing_coursework or "None"
    research = endorsement.missing_research_requirements or "None"
    practicum = endorsement.missing_practicum_requirement or "None"
    batch = endorsement.batch_name or "No batch assigned"
    return (
        f"Batch: {batch}; review window: {endorsement.review_window}; status: {endorsement.endorsement_status}; "
        f"coursework: {endorsement.coursework_status}; research: {endorsement.research_status}; "
        f"practicum: {endorsement.practicum_status}; missing coursework: {coursework}; "
        f"missing research: {research}; missing practicum: {practicum}; registrar: {endorsement.registrar_status}."
    )


def workflow_case_record(slug: str, student_id: int):
    if slug == "practicum":
        return latest_practicum_record(student_id)
    if slug == "withdrawal":
        return latest_withdrawal_application(student_id)
    if slug == "graduation":
        return latest_graduation_endorsement(student_id)
    if slug in {"awol", "awol-return"}:
        return latest_awol_case(student_id)
    return None


def workflow_record_status(slug: str, record) -> str:
    if not record:
        return "Not Submitted"
    return record.endorsement_status if slug == "graduation" else record.status


def set_workflow_record_status(slug: str, record, status: str) -> None:
    if slug == "graduation":
        record.endorsement_status = status
    else:
        record.status = status
    if hasattr(record, "updated_at"):
        record.updated_at = now_utc()


def workflow_recipient_account(student: Student, recipient_label: str) -> UserAccount | None:
    role = WORKFLOW_RECIPIENTS.get(recipient_label)
    if not role:
        return None
    query = UserAccount.query.filter_by(role=role, active=True)
    if role == "student":
        query = query.filter_by(student_id=student.id)
    return query.order_by(UserAccount.id.asc()).first()


def bind_workflow_attachment(
    attachment: StudentRequestAttachment | None,
    record,
    stage: str,
    account: UserAccount | None = None,
) -> None:
    """Persist the case, stage, and real uploader without changing the file row."""
    if not attachment or not record:
        return
    if not getattr(record, "id", None):
        db.session.flush()
    attachment.workflow_request_id = record.id
    attachment.workflow_stage = stage
    if account:
        attachment.uploaded_by_user_id = account.id
        attachment.uploaded_by_name = account.full_name
        attachment.uploaded_by_role = ROLE_LABELS.get(account.role, account.role)
    elif not attachment.uploaded_by_name and getattr(record, "student", None):
        attachment.uploaded_by_name = record.student.name
        attachment.uploaded_by_role = "Student"


def workflow_message_record(
    slug: str,
    student: Student,
    account: UserAccount | None,
    recipient_label: str,
    template: str,
    comment: str,
    action_type: str,
    previous_status: str,
    new_status: str,
    *,
    visibility: str = "student_visible",
    status: str = "Open",
) -> WorkflowMessage:
    record = workflow_case_record(slug, student.id)
    recipient_account = workflow_recipient_account(student, recipient_label)
    effective_visibility = "student_visible" if recipient_label == "Student" else visibility
    if effective_visibility not in {"student_visible", "internal"}:
        raise ValueError("Choose whether this message is visible to the student or internal to reviewers.")
    message = WorkflowMessage(
        transaction_slug=slug,
        student_id=student.id,
        workflow_request_id=record.id if record else None,
        workflow_stage=new_status or previous_status,
        sender_user_id=account.id if account else None,
        sender_role=ROLE_LABELS.get(account.role, account.role) if account else "System",
        sender_name=account.full_name if account else "Workflow System",
        recipient_user_id=recipient_account.id if recipient_account else None,
        recipient_role=recipient_label,
        visibility=effective_visibility,
        template=template,
        comment=comment.strip(),
        action_type=action_type,
        previous_status=previous_status,
        new_status=new_status,
        status=status,
        read_at=now_utc() if account and account.role == "student" else None,
    )
    db.session.add(message)
    return message


def workflow_transition_comment(data: MultiDict) -> str:
    return (
        data.get("workflow_comment")
        or data.get("transition_comment")
        or data.get("action_comment")
        or ""
    ).strip()


def transition_comment_action_type(next_owner: str, new_status: str) -> str:
    student_return_statuses = {
        "Additional Certificates Requested",
        "Not Accepted - New Organization Required",
        "Not Eligible",
        "Returned for Clarification",
    }
    if next_owner == "Student" and new_status in student_return_statuses:
        return "return"
    if next_owner == "Student":
        return "notice"
    return "forward"


def workflow_notes_with_comment(notes: str, comment: str) -> str:
    clean_comment = (comment or "").strip()
    if not clean_comment:
        return notes
    return f"{notes}\nReviewer comment: {clean_comment}"


def add_transition_comment_message(
    slug: str,
    student: Student,
    account: UserAccount,
    next_owner: str,
    template: str,
    comment: str,
    previous_status: str,
    new_status: str,
) -> WorkflowMessage | None:
    clean_comment = (comment or "").strip()
    if not clean_comment or next_owner not in WORKFLOW_RECIPIENTS:
        return None
    action_type = transition_comment_action_type(next_owner, new_status)
    return workflow_message_record(
        slug,
        student,
        account,
        next_owner,
        template,
        clean_comment,
        action_type,
        previous_status,
        new_status,
        visibility="student_visible" if next_owner == "Student" else "internal",
        status="Open" if action_type in {"return", "forward"} else "Sent",
    )


def workflow_transition_action(result: str) -> str:
    value = (result or "").lower()
    if "return" in value or "revision" in value:
        return "return"
    if "reject" in value or "denied" in value or "not accepted" in value:
        return "reject"
    if "forward" in value or "sent" in value or "handoff" in value:
        return "forward"
    if "approv" in value or "verified" in value or "reviewed" in value or "complete" in value:
        return "approve"
    return "transition"


def add_student_transition_notice(
    slug: str,
    student_id: int | None,
    result: str,
    next_owner: str,
    previous_status: str | None,
    new_status: str | None,
) -> None:
    """Create one student-visible status notice for reviewer transitions."""
    if (
        slug not in {"practicum", "withdrawal", "graduation"}
        or not student_id
        or not previous_status
        or not new_status
        or previous_status == new_status
        or not has_request_context()
    ):
        return
    account = current_account()
    if not account or account.role == "student":
        return
    student = db.session.get(Student, student_id)
    record = workflow_case_record(slug, student_id) if student else None
    if not student or not record:
        return
    request_id = record.id
    pending_messages = [
        item
        for item in db.session.new
        if isinstance(item, WorkflowMessage)
        and item.transaction_slug == slug
        and item.student_id == student_id
        and item.visibility == "student_visible"
        and item.previous_status == previous_status
        and item.new_status == new_status
    ]
    if pending_messages:
        return
    existing = WorkflowMessage.query.filter_by(
        transaction_slug=slug,
        student_id=student_id,
        workflow_request_id=request_id,
        visibility="student_visible",
        previous_status=previous_status,
        new_status=new_status,
    ).first()
    if existing:
        return
    workflow_message_record(
        slug,
        student,
        account,
        "Student",
        result,
        f"Status changed from {previous_status} to {new_status}. Next owner: {next_owner}.",
        "notice",
        previous_status,
        new_status,
        visibility="student_visible",
        status="Sent",
    )


def latest_open_student_return(slug: str, student_id: int) -> WorkflowMessage | None:
    return (
        WorkflowMessage.query.filter_by(
            transaction_slug=slug,
            student_id=student_id,
            recipient_role="Student",
            action_type="return",
            status="Open",
        )
        .order_by(WorkflowMessage.created_at.desc(), WorkflowMessage.id.desc())
        .first()
    )


def resolve_student_returns(slug: str, student_id: int) -> None:
    """Close visible return notices after the student successfully resubmits."""
    for message in WorkflowMessage.query.filter_by(
        transaction_slug=slug,
        student_id=student_id,
        recipient_role="Student",
        action_type="return",
        status="Open",
    ).all():
        message.status = "Responded"
        message.resolved_at = now_utc()


def practicum_student_submission_stage(record: PracticumRecord | None) -> str:
    """Identify the only practicum form section a student may edit now."""
    if not record:
        return "moa"
    status = record.status
    if status == "Not Accepted - New Organization Required":
        return "moa"
    if status == "Returned for Clarification":
        returned = latest_open_student_return("practicum", record.student_id)
        prior = returned.previous_status if returned else ""
        return "completion" if prior in {
            "Practicum In Progress", "Hours Incomplete", "Documents Submitted",
            "Documents Under Review", "Additional Certificates Requested", "Completed",
        } or record.certificate_attachment_id else "moa"
    if status in {"Practicum In Progress", "Hours Incomplete", "Additional Certificates Requested"}:
        return "completion"
    return "locked"


def workflow_backflow_status(slug: str, record, recipient_label: str, previous_status: str) -> str:
    """Move a returned case to the recipient's real swimlane without losing data."""
    if recipient_label == "Student":
        if slug == "withdrawal" and previous_status in {
            "Requirements Submitted", "Requirements Verified",
        }:
            return "Requirements Pending"
        return "Returned for Clarification"
    if slug == "practicum":
        completion_side = previous_status in {
            "Practicum In Progress", "Hours Incomplete", "Documents Submitted",
            "Documents Under Review", "Additional Certificates Requested", "Completed",
            "Report Sent to Dean", "Dean Reviewed",
        }
        return {
            "Graduate School Staff": "Documents Submitted" if completion_side else "MOA Submitted",
            "Academic Coordinator": "Documents Under Review" if completion_side else "MOA Under Review",
            "Dean": "Report Sent to Dean",
        }.get(recipient_label, previous_status)
    if slug == "withdrawal":
        return {
            "Graduate School Staff": "Submitted to GS Staff",
            "Academic Coordinator": "Approved - Follow-through",
            "Dean": "Dean Review",
        }.get(recipient_label, previous_status)
    return {
        "Graduate School Staff": "Endorsement Prepared" if previous_status in {
            "Ready for Dean Review", "Returned for Revision", "Dean Approved",
            "Sent to Registrar", "Registrar Received",
        } else "For Review",
        "Academic Coordinator": "Coursework Review",
        "Research Coordinator": "Research Review",
        "Dean": "Ready for Dean Review",
    }.get(recipient_label, previous_status)


def create_workflow_message(
    slug: str,
    student: Student,
    account: UserAccount,
    recipient_label: str,
    template: str,
    comment: str,
    action_type: str,
    visibility: str = "student_visible",
) -> WorkflowMessage:
    if recipient_label not in WORKFLOW_RECIPIENTS:
        raise ValueError("Choose a valid message recipient or workflow stage.")
    if template not in WORKFLOW_MESSAGE_TEMPLATES:
        raise ValueError("Choose a valid message template.")
    if template in {"Other", "Other / Custom comment"} and not comment.strip():
        raise ValueError("Enter a custom comment when the Other template is selected.")
    if action_type not in {"note", "return", "forward", "response"}:
        raise ValueError("Choose a valid message action.")
    if action_type == "return" and not comment.strip():
        raise ValueError("Enter a comment or reason before returning this request.")
    if visibility not in {"student_visible", "internal"}:
        raise ValueError("Choose a valid message visibility.")
    if account.role == "student":
        visibility = "student_visible"
    if recipient_label == "Student" and visibility == "internal":
        raise ValueError("Messages addressed to the student must be student-visible.")

    record = workflow_case_record(slug, student.id)
    if not record:
        raise ValueError("This student does not have an active request in this workflow.")
    previous_status = workflow_record_status(slug, record)
    new_status = previous_status
    if action_type == "return":
        new_status = workflow_backflow_status(slug, record, recipient_label, previous_status)
        set_workflow_record_status(slug, record, new_status)
    elif action_type == "response":
        latest_return = (
            WorkflowMessage.query.filter_by(
                transaction_slug=slug,
                student_id=student.id,
                recipient_role="Student",
                action_type="return",
                status="Open",
            )
            .order_by(WorkflowMessage.created_at.desc(), WorkflowMessage.id.desc())
            .first()
        )
        if not latest_return:
            raise ValueError("There is no open clarification request to answer.")
        # A message can clarify the student's intent, but only a successful
        # stage resubmission should close the return notice and restore review.
        # Keeping the case returned prevents a reply from locking the form.
        new_status = previous_status

    message = workflow_message_record(
        slug,
        student,
        account,
        recipient_label,
        template,
        comment,
        action_type,
        previous_status,
        new_status,
        visibility=visibility,
        status="Sent" if action_type == "response" else "Open",
    )

    action_label = {
        "return": "returned for clarification",
        "forward": "forwarded with a note",
        "response": "clarification response submitted",
        "note": "message sent",
    }[action_type]
    task_title = (
        f"Respond to {TRANSACTION_BY_SLUG[slug]['title']} clarification"
        if action_type == "return"
        else f"Review {TRANSACTION_BY_SLUG[slug]['title']} message"
    )
    add_task(student.id, task_title, recipient_label, 3, 35)
    notes = f"{template}. {comment.strip()}".strip()
    add_log(
        slug,
        student.id,
        workflow_actor_label(account),
        "Workflow message",
        f"{TRANSACTION_BY_SLUG[slug]['title']} {action_label}",
        recipient_label,
        notes,
        previous_status=previous_status,
        new_status=new_status,
        visibility=visibility,
    )
    return message


def workflow_approval_item(kind: str, item) -> dict:
    student = item.student
    meta = workflow_case_meta("awol" if kind == "awol-return" else kind, student.id)
    if kind == "awol-return":
        return {
            "id": item.id,
            "type": kind,
            "title": f"Return from AWOL · {student.name}",
            "subtitle": f"{student.program.code} · {item.policy_classification or 'Policy review pending'}",
            "status": item.dean_decision,
            "workflow_status": item.status,
            "student": student_brief(student),
            "submitted_at": iso(item.return_requested_at or item.updated_at),
            "details": (
                f"Target return semester: {item.target_return_term or 'Not recorded'}. "
                f"Years in program: {item.years_in_program if item.years_in_program is not None else 'Not calculated'}. "
                f"Residence limits: {item.normal_residence_years or '—'} normal / {item.absolute_residence_years or '—'} absolute. "
                f"{item.staff_notes or ''}"
            ).strip(),
            "record": {"attachments": [attachment_dict(item.intent_attachment)] if item.intent_attachment else []},
            "request_id": item.id,
            **meta,
        }
    if kind in {"leave-of-absence", "readmission"}:
        attachment = latest_request_attachment(student.id, kind)
        if kind == "leave-of-absence":
            request_value = request_notes_value(item.notes, "Requested semester period") or "Semester period not recorded"
            title = f"Leave of Absence request · {student.name}"
            subtitle = f"{student.program.code} · {request_value}"
        else:
            request_value = request_notes_value(item.notes, "Return semester") or "Return semester not recorded"
            title = f"Readmission request · {student.name}"
            subtitle = f"{student.program.code} · {request_value}"
        return {
            "id": item.id,
            "type": kind,
            "title": title,
            "subtitle": subtitle,
            "status": item.new_status or item.result,
            "workflow_status": item.new_status or item.result,
            "student": student_brief(student),
            "submitted_at": iso(item.created_at),
            "details": item.notes or item.result,
            "record": {"attachments": [attachment_dict(attachment)] if attachment else []},
            "request_id": item.id,
            **meta,
        }
    if kind == "practicum":
        return {
            "id": item.id,
            "type": kind,
            "title": f"Practicum status report · {student.name}",
            "subtitle": f"{student.program.code} · {item.completed_hours}/{item.required_hours} hours · {item.status}",
            "status": item.status,
            "student": student_brief(student),
            "submitted_at": iso(item.report_sent_at or item.updated_at),
            "details": practicum_notes(item),
            "timeline": practicum_timeline(item, practicum_eligibility(student)),
            "record": practicum_record_dict(item, include_student=False),
            **meta,
        }
    if kind == "withdrawal":
        return {
            "id": item.id,
            "type": kind,
            "title": f"Withdrawal request · {student.name}",
            "subtitle": f"{student.program.code} · effective {item.effective_term or 'semester pending'}",
            "status": item.dean_decision,
            "workflow_status": item.status,
            "student": student_brief(student),
            "submitted_at": iso(item.created_at),
            "details": withdrawal_notes(item),
            "record": withdrawal_application_dict(item, include_student=False),
            **meta,
        }
    return {
        "id": item.id,
        "type": kind,
        "title": f"Graduation endorsement · {student.name}",
        "subtitle": f"{student.program.code} · {item.batch_name or 'No batch assigned'} · {item.review_window}",
        "status": item.endorsement_status,
        "student": student_brief(student),
        "submitted_at": iso(item.submitted_at or item.updated_at),
        "review_window": item.review_window,
        "batch_name": item.batch_name,
        "details": graduation_notes(item),
        "record": graduation_endorsement_dict(item, include_student=False),
        "eligibility": {
            "eligible": item.coursework_status == "Complete" and item.research_status == "Complete",
            "coursework_status": item.coursework_status,
            "research_status": item.research_status,
        },
        **meta,
    }


def workflow_approvals_payload() -> dict:
    def latest_standing_logs(slug: str, results: set[str], limit: int = 100) -> list[TransactionLog]:
        candidates = (
            TransactionLog.query.filter(
                TransactionLog.transaction_slug == slug,
                TransactionLog.result.in_(results),
                TransactionLog.actor_role != "Demo Data",
            )
            .order_by(TransactionLog.created_at.desc(), TransactionLog.id.desc())
            .limit(limit * 3)
            .all()
        )
        rows = []
        seen = set()
        for candidate in candidates:
            if not candidate.student_id or candidate.student_id in seen:
                continue
            latest = (
                TransactionLog.query.filter_by(transaction_slug=slug, student_id=candidate.student_id)
                .filter(TransactionLog.actor_role != "Demo Data")
                .order_by(TransactionLog.created_at.desc(), TransactionLog.id.desc())
                .first()
            )
            seen.add(candidate.student_id)
            if latest and latest.id == candidate.id:
                rows.append(candidate)
            if len(rows) >= limit:
                break
        return rows

    standing_pending = {
        "leave-of-absence": latest_standing_logs("leave-of-absence", {"LOA request forwarded to Dean"}),
        "readmission": latest_standing_logs("readmission", {"Readmission request forwarded to Dean"}),
    }
    standing_recent_results = {
        "leave-of-absence": {"LOA approved by Dean", "LOA auto-approved by RAG", "LOA denied by Dean", "LOA returned by Dean for revision"},
        "readmission": {"Readmission approved by Dean", "Readmission auto-approved by RAG", "Readmission denied by Dean", "Readmission returned by Dean for revision"},
    }
    standing_recent = {
        slug: latest_standing_logs(slug, results, 12)
        for slug, results in standing_recent_results.items()
    }
    pending = []
    for slug, rows in standing_pending.items():
        pending.extend(workflow_approval_item(slug, item) for item in rows)
    pending.extend(
        workflow_approval_item("practicum", item)
        for item in PracticumRecord.query.filter(PracticumRecord.status == "Report Sent to Dean")
        .order_by(PracticumRecord.updated_at.asc())
        .all()
    )
    pending.extend(
        workflow_approval_item("withdrawal", item)
        for item in WithdrawalApplication.query.filter(
            WithdrawalApplication.dean_decision == "Pending",
            WithdrawalApplication.status == "Dean Review",
        )
        .order_by(WithdrawalApplication.created_at.asc())
        .all()
    )
    pending.extend(
        workflow_approval_item("awol-return", item)
        for item in AwolCase.query.filter_by(status="Dean Review", dean_decision="Pending")
        .order_by(AwolCase.return_requested_at.asc())
        .all()
    )
    pending.extend(
        workflow_approval_item("graduation", item)
        for item in GraduationEndorsement.query.filter(GraduationEndorsement.endorsement_status == "Ready for Dean Review")
        .order_by(GraduationEndorsement.submitted_at.asc())
        .all()
    )
    recent = []
    for slug, rows in standing_recent.items():
        recent.extend(workflow_approval_item(slug, item) for item in rows)
    recent.extend(
        workflow_approval_item("withdrawal", item)
        for item in WithdrawalApplication.query.filter(WithdrawalApplication.dean_decision.in_(["Approved", "Denied", "Returned"]))
        .order_by(WithdrawalApplication.updated_at.desc())
        .limit(6)
        .all()
    )
    recent.extend(
        workflow_approval_item("awol-return", item)
        for item in AwolCase.query.filter(AwolCase.dean_decision.in_(["Approved", "Denied", "Returned", "Approved for Re-enrollment Review"]))
        .order_by(AwolCase.updated_at.desc())
        .limit(6)
        .all()
    )
    recent.extend(
        workflow_approval_item("graduation", item)
        for item in GraduationEndorsement.query.filter(GraduationEndorsement.endorsement_status.in_(["Dean Approved", "Sent to Registrar", "Registrar Received", "Returned for Revision"]))
        .order_by(GraduationEndorsement.updated_at.desc())
        .limit(6)
        .all()
    )
    recent.extend(
        workflow_approval_item("practicum", item)
        for item in PracticumRecord.query.filter(PracticumRecord.status == "Dean Reviewed")
        .order_by(PracticumRecord.updated_at.desc())
        .limit(6)
        .all()
    )
    recent.sort(key=lambda item: item.get("submitted_at") or "", reverse=True)
    pending.sort(key=lambda item: item.get("submitted_at") or "")
    overview = []
    for slug in standing_pending:
        overview.extend(workflow_approval_item(slug, item) for item in standing_pending[slug])
        overview.extend(workflow_approval_item(slug, item) for item in standing_recent[slug])
    overview.extend(
        workflow_approval_item("practicum", item)
        for item in PracticumRecord.query.filter(
            PracticumRecord.status.in_({
                "Report Sent to Dean", "Dean Reviewed", "Additional Certificates Requested",
            })
        ).order_by(PracticumRecord.updated_at.desc()).limit(100).all()
    )
    overview.extend(
        workflow_approval_item("withdrawal", item)
        for item in WithdrawalApplication.query.filter(
            or_(
                WithdrawalApplication.status == "Dean Review",
                WithdrawalApplication.dean_decision.in_({"Approved", "Denied", "Returned"}),
            )
        ).order_by(WithdrawalApplication.updated_at.desc()).limit(100).all()
    )
    overview.extend(
        workflow_approval_item("awol-return", item)
        for item in AwolCase.query.filter(
            or_(
                AwolCase.status == "Dean Review",
                AwolCase.dean_decision.in_({"Approved", "Denied", "Returned", "Approved for Re-enrollment Review"}),
            )
        ).order_by(AwolCase.updated_at.desc()).limit(100).all()
    )
    overview.extend(
        workflow_approval_item("graduation", item)
        for item in GraduationEndorsement.query.filter(
            GraduationEndorsement.endorsement_status.in_({
                "Ready for Dean Review", "Returned for Revision", "Dean Approved",
                "Sent to Registrar", "Registrar Received",
            })
        ).order_by(GraduationEndorsement.updated_at.desc()).limit(100).all()
    )
    overview.sort(key=lambda item: item.get("submitted_at") or "", reverse=True)
    return {"pending": pending, "recent": recent[:12], "overview": overview}


def report_student_ids(filters) -> list[int]:
    return [sid for (sid,) in filtered_students_query(filters).with_entities(Student.id).all()]


def reports_payload(filters=None) -> dict:
    filters = filters or {}
    student_ids = report_student_ids(filters)
    empty = len(student_ids) == 0

    def by_students(model):
        query = model.query
        return query.filter(model.student_id.in_(student_ids)) if not empty else query.filter(False)

    dashboard = dashboard_stats(filters)
    practicum_rows = [
        practicum_record_dict(item)
        for item in by_students(PracticumRecord).order_by(PracticumRecord.updated_at.desc()).limit(150).all()
    ]
    withdrawal_rows = [
        withdrawal_application_dict(item)
        for item in by_students(WithdrawalApplication).order_by(WithdrawalApplication.updated_at.desc()).limit(150).all()
    ]
    graduation_rows = [
        graduation_endorsement_dict(item)
        for item in by_students(GraduationEndorsement).order_by(GraduationEndorsement.updated_at.desc()).limit(150).all()
    ]
    missing_rows = []
    for student in filtered_students_query(filters).order_by(Student.last_name, Student.first_name).limit(120).all():
        eligibility = graduation_eligibility(student)
        if eligibility["missing_coursework"] or eligibility["missing_research_requirements"] or eligibility["missing_practicum_requirement"]:
            missing_rows.append({
                "student": student_brief(student),
                "coursework": eligibility["missing_coursework"][:6],
                "research": eligibility["missing_research_requirements"][:6],
                "practicum": eligibility["missing_practicum_requirement"],
                "next_owner": eligibility["next_owner"],
            })

    loa_readmission_rows = [
        {
            "student": student_brief(student),
            "standing": student.standing,
            "stage": student.current_stage,
            "latest_readmission": log_dict(
                TransactionLog.query.filter_by(student_id=student.id, transaction_slug="readmission")
                .order_by(TransactionLog.created_at.desc())
                .first()
            ) if TransactionLog.query.filter_by(student_id=student.id, transaction_slug="readmission").first() else None,
        }
        for student in filtered_students_query(filters)
        .filter(or_(Student.standing == "On Leave", Student.current_stage == "LOA"))
        .order_by(Student.last_name, Student.first_name)
        .limit(120)
        .all()
    ]
    at_risk_rows = []
    for student in filtered_students_query(filters).filter(Student.risk_level.in_(["Medium", "High"])).limit(120).all():
        recs = student_recommendations(student)["recommendations"]
        at_risk_rows.append({
            "student": student_brief(student),
            "top_recommendation": recs[0] if recs else None,
        })
    task_rows = [
        task_dict(task)
        for task in by_students(Task)
        .filter(Task.status.in_(["Pending", "Overdue"]))
        .order_by(Task.due_at.asc())
        .limit(160)
        .all()
    ]
    research_rows = [
        {
            "student": student_brief(case.student),
            "case": research_case_dict(case),
        }
        for case in by_students(ResearchCase)
        .order_by(ResearchCase.opened_at.desc())
        .limit(160)
        .all()
    ]

    return {
        "filters": normalize_filters(filters),
        "programs": [program_dict(p) for p in Program.query.order_by(Program.code).all()],
        "stages": STAGES,
        "summary": dashboard["kpis"],
        "dashboard": dashboard,
        "graduation_candidates": {"count": len(graduation_rows), "rows": graduation_rows},
        "missing_requirements": {"count": len(missing_rows), "rows": missing_rows},
        "practicum_monitoring": {"count": len(practicum_rows), "rows": practicum_rows},
        "withdrawal_requests": {"count": len(withdrawal_rows), "rows": withdrawal_rows},
        "loa_readmission": {"count": len(loa_readmission_rows), "rows": loa_readmission_rows},
        "at_risk": {"count": len(at_risk_rows), "rows": at_risk_rows},
        "open_overdue_tasks": {"count": len(task_rows), "rows": task_rows},
        "research_completion": {"count": len(research_rows), "rows": research_rows},
    }


# ---------------------------------------------------------------------------
# Transaction context (data needed by each workflow screen)
# ---------------------------------------------------------------------------
def request_notes_value(notes: str | None, label: str) -> str:
    match = re.search(rf"{re.escape(label)}:\s*(.+?)(?:\n|$)", notes or "", re.IGNORECASE)
    return match.group(1).strip().rstrip(".") if match else ""


def latest_request_attachment(student_id: int, request_type: str) -> StudentRequestAttachment | None:
    return (
        StudentRequestAttachment.query.filter_by(student_id=student_id, request_type=request_type)
        .order_by(StudentRequestAttachment.uploaded_at.desc(), StudentRequestAttachment.id.desc())
        .first()
    )


def submitted_request_students(request_type: str) -> list[dict]:
    # Keep the newest student submission visible after staff forwarding and Dean
    # review so the staff roster can group current and completed requests.
    submitted_results = {
        "leave-of-absence": {"LOA application submitted"},
        "readmission": {"Readmission request submitted"},
    }[request_type]
    submission_logs = (
        TransactionLog.query.filter(
            TransactionLog.transaction_slug == request_type,
            TransactionLog.actor_role == "Student",
            TransactionLog.result.in_(submitted_results),
        )
        .order_by(TransactionLog.created_at.desc(), TransactionLog.id.desc())
        .all()
    )
    seen: set[int] = set()
    rows: list[dict] = []
    for log in submission_logs:
        if not log.student_id or log.student_id in seen:
            continue
        seen.add(log.student_id)
        latest_log = (
            TransactionLog.query.filter_by(transaction_slug=request_type, student_id=log.student_id)
            .filter(TransactionLog.actor_role != "Demo Data")
            .order_by(TransactionLog.created_at.desc(), TransactionLog.id.desc())
            .first()
        )
        student = Student.query.get(log.student_id)
        if not student:
            continue
        decided = bool(latest_log and latest_log.id != log.id)
        if decided:
            result_text = (latest_log.result or "").lower()
            if "approved" in result_text:
                status = "Approved"
            elif "denied" in result_text or "deny" in result_text:
                status = "Denied"
            elif "return" in result_text:
                status = "Returned for Revision"
            else:
                status = "In Progress"
        else:
            status = "Pending Review"
        attachment = latest_request_attachment(student.id, request_type)
        row = {
            **student_brief(student),
            "request_log_id": log.id,
            "submitted_at": iso(log.created_at),
            "source_reference": log.source_reference,
            "notes": log.notes,
            "last_result": latest_log.result if decided else None,
            "last_decision_at": iso(latest_log.created_at) if decided else None,
            "next_action_owner": latest_log.next_owner if latest_log else "GS Staff",
            "attachment": attachment.original_name if attachment else log.source_reference,
            "attachment_detail": attachment_dict(attachment),
            "status": status,
        }
        if request_type == "leave-of-absence":
            period = request_notes_value(log.notes, "Requested period")
            start, end = "", ""
            if " to " in period:
                start, end = [part.strip() for part in period.split(" to ", 1)]
            elif period and period.lower() != "not specified":
                start = period
            row.update({
                "request_label": period if period else "Leave of Absence application",
                "effective_start": start,
                "effective_end": end,
                "reason_remarks": request_notes_value(log.notes, "Reason/remarks"),
            })
        else:
            row.update({
                "request_label": request_notes_value(log.notes, "Target return semester") or request_notes_value(log.notes, "Target return term") or "Readmission request",
                "target_return_term": request_notes_value(log.notes, "Target return semester") or request_notes_value(log.notes, "Target return term"),
                "previous_loa_period": request_notes_value(log.notes, "Previous LOA period"),
            })
        rows.append(row)
    return rows


def practicum_roster_payload() -> list[dict]:
    students = (
        Student.query.join(Program)
        .filter(Program.has_practicum.is_(True))
        .order_by(Student.last_name.asc(), Student.first_name.asc())
        .all()
    )
    rows = []
    for student in students:
        eligibility = practicum_eligibility(student)
        record = latest_practicum_record(student.id)
        rows.append({
            "student": student_brief(student),
            "eligibility": eligibility,
            "record": practicum_record_dict(record) if record else None,
            "timeline": practicum_timeline(record, eligibility),
            "moa_status": record.moa_status if record else "Not Submitted",
            "documents_status": record.document_status if record else "Not Submitted",
            "hours_status": (
                "Complete" if record and record.required_hours and record.completed_hours >= record.required_hours
                else "Incomplete" if record else "Not Started"
            ),
            "coordinator_review_status": (
                practicum_record_dict(record, include_student=False)["coordinator_review_status"] if record else "Pending"
            ),
            "dean_report_status": (
                practicum_record_dict(record, include_student=False)["dean_report_status"] if record else "Not Sent"
            ),
            **workflow_case_meta("practicum", student.id),
        })
    return sorted(rows, key=lambda item: item["last_activity_at"] or "", reverse=True)


def withdrawal_roster_payload() -> list[dict]:
    rows = []
    for item in WithdrawalApplication.query.order_by(WithdrawalApplication.updated_at.desc()).all():
        rows.append({**withdrawal_application_dict(item), **workflow_case_meta("withdrawal", item.student_id)})
    return rows


def graduation_candidate_payload() -> list[dict]:
    candidate_ids = {
        student_id
        for (student_id,) in Student.query.filter(
            Student.current_stage.in_(["Writing", "Final Defense", "Completed"]),
            Student.standing != "Withdrawn",
        ).with_entities(Student.id).all()
    }
    candidate_ids.update(
        student_id
        for (student_id,) in GraduationEndorsement.query.with_entities(
            GraduationEndorsement.student_id
        ).distinct().all()
    )
    candidate_ids.update(
        student_id
        for (student_id,) in ResearchCase.query.filter(
            ResearchCase.current_gate.in_(["Final Defense", "Completion Evidence"]),
            ResearchCase.status.in_(["Complete", "Verified Complete"]),
        ).with_entities(ResearchCase.student_id).distinct().all()
    )
    candidate_ids.update(
        student_id
        for (student_id,) in DefenseVerdict.query.filter_by(
            gate="Final Defense",
            result="Passed",
        ).with_entities(DefenseVerdict.student_id).distinct().all()
    )
    students = (
        Student.query.filter(
            Student.id.in_(candidate_ids),
            Student.standing != "Withdrawn",
        )
        .order_by(Student.last_name.asc(), Student.first_name.asc())
        .all()
    )
    rows = []
    for student in students:
        eligibility = graduation_eligibility(student)
        endorsement = latest_graduation_endorsement(student.id)
        case_meta = workflow_case_meta("graduation", student.id)
        rows.append({
            "student": student_brief(student),
            "eligibility": eligibility,
            "endorsement": graduation_endorsement_dict(endorsement) if endorsement else None,
            **case_meta,
            "next_action_owner": case_meta["next_action_owner"] or eligibility["next_owner"],
        })
    return sorted(rows, key=lambda item: item["last_activity_at"] or "", reverse=True)


def serialize_transaction_context(slug: str, selected_student_id: int | None, specialization: str = "") -> dict:
    # Context responses are read-only preparation data for workflow screens.
    # The actual record changes happen only in the transaction handlers.
    selected_student = None
    if slug != "student-handoff" and selected_student_id:
        selected_student = Student.query.get(selected_student_id)

    activity_query = TransactionLog.query if slug in {"practicum", "withdrawal", "graduation"} else human_activity_query()
    recent_logs = (
        activity_query
        .filter(TransactionLog.transaction_slug == slug)
        .order_by(TransactionLog.created_at.desc())
        .limit(30)
        .all()
    )

    context: dict = {
        "slug": slug,
        "transaction": TRANSACTION_BY_SLUG[slug],
        "selected_student": student_brief(selected_student) if selected_student else None,
        "recent_logs": [log_dict(l) for l in recent_logs],
        "message_templates": WORKFLOW_MESSAGE_TEMPLATES,
        "message_recipients": list(WORKFLOW_RECIPIENTS),
        "deployment_policy_questions": DEPLOYMENT_POLICY_QUESTIONS,
        "eligibility_config": PRACTICUM_ELIGIBILITY_CONFIG,
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

    if slug == "practicum":
        context["roster"] = practicum_roster_payload()
    elif slug == "withdrawal":
        context["roster"] = withdrawal_roster_payload()
    elif slug == "graduation":
        context["roster"] = graduation_candidate_payload()
    elif slug == "awol":
        context["roster"] = awol_residency_roster_payload()
        context["residency_reasons"] = RESIDENCY_REASONS
        context["policy_citations"] = AWOL_RESIDENCY_CITATIONS

    if slug == "student-handoff":
        context["programs"] = [program_dict(p) for p in Program.query.order_by(Program.college, Program.name).all()]
        context["terms"] = [term_dict(t) for t in AcademicTerm.query.order_by(AcademicTerm.start_date.desc()).all()]

    # LOA/Readmission are student-initiated: staff only see students who submitted.
    if slug in ("leave-of-absence", "readmission"):
        context["submitted_requests"] = submitted_request_students(slug)
        context["selected_request"] = next(
            (row for row in context["submitted_requests"] if row["id"] == selected_student_id),
            None,
        )
        if slug == "leave-of-absence" and selected_student and context["selected_request"]:
            context["loa_policy_review"] = loa_policy_review(selected_student, context["selected_request"])
        if slug == "readmission" and selected_student and context["selected_request"]:
            context["readmission_policy_review"] = readmission_policy_review(
                selected_student,
                {**context["selected_request"], "readmission_items": readmission_requirements()},
            )

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
            context["research_prerequisite"] = comprehensive_exam_eligibility(selected_student)
            research_case, progress = sync_research_progress(selected_student)
            context["research_case"] = research_case_dict(research_case)
            context["research_progress"] = progress
            context["current_milestone"] = progress["milestone"]
            context["form1_endorsement"] = form1_endorsement_dict(
                Form1Endorsement.query.filter_by(student_id=selected_student.id).first()
            )
            final_panel = active_panel_assignments(selected_student, progress["gate"])
            matching_profile = research_matching_profile(selected_student)
            context["panel_status"] = {
                "status": (
                    "Final panel selected"
                    if len(final_panel) >= len(panel_roles_for_student(selected_student))
                    else "Recommended panel available"
                    if matching_profile["ready"]
                    else "Not yet generated"
                ),
                "recommendations": [
                    panel_assignment_dict(item)
                    for item in final_panel
                ],
            }
            context["documents_by_gate"] = {}
            for doc in DocumentCheck.query.filter_by(student_id=selected_student.id).all():
                context["documents_by_gate"].setdefault(doc.gate, []).append(document_check_dict(doc))
        if slug == "panel-matching":
            prerequisite = comprehensive_exam_eligibility(selected_student)
            context["research_prerequisite"] = prerequisite
            matching_profile = research_matching_profile(selected_student)
            context["matching_profile"] = matching_profile
            context["panel_recommendations"] = [
                {
                    "faculty_id": row["faculty"].id,
                    "faculty_name": row["faculty"].name,
                    "college": row["faculty"].college,
                    "specialization": row["faculty"].specialization,
                    "score": row["score"],
                    "note": row["note"],
                    "matched_keywords": row["matched_keywords"],
                    "availability_status": row["availability_status"],
                    "availability_windows": row["availability_windows"],
                    "workload": row["workload"],
                    "score_breakdown": row["score_breakdown"],
                }
                for row in (recommend_panel(selected_student) if prerequisite["research_allowed"] and matching_profile["ready"] else [])
            ]
            context["assigned_panel"] = [
                panel_assignment_dict(p)
                for p in active_panel_assignments(selected_student, matching_profile["gate"])
            ]
        if slug == "defense-scheduling":
            prerequisite = comprehensive_exam_eligibility(selected_student)
            context["research_prerequisite"] = prerequisite
            research_case, progress = sync_research_progress(selected_student)
            assignments = active_panel_assignments(selected_student, progress["gate"])
            context["assigned_panel"] = [panel_assignment_dict(p) for p in assignments]
            # Full defense-eligible faculty list so staff can reassign the panel from
            # this screen (not just accept the matched panel).
            context["faculty_directory"] = defense_faculty_directory()
            context["panel_roles"] = panel_roles_for_student(selected_student)
            requirements = progress["milestone"]["requirements"]
            schedule_blockers = [
                item for item in requirements
                if item["source_type"] not in {"system_title_schedule", "system_proposal_schedule", "system_final_schedule", "system_defense_result"}
            ]
            context["schedule_readiness"] = {
                "stage": progress["stage"],
                "gate": progress["gate"],
                "status": progress["status"],
                "ready": all(item["status"] == "Complete" for item in schedule_blockers),
                "requirements": requirements,
                "completed_count": sum(item["status"] == "Complete" for item in schedule_blockers),
                "pending_count": sum(item["status"] != "Complete" for item in schedule_blockers),
                "research_title": research_case.title if research_case else "Locked until comprehensive exam is passed",
                "adviser_name": (research_case.adviser_name if research_case else None) or selected_student.adviser_name,
            }
            participants = defense_participants(selected_student, assignments) if assignments else []
            window_start = date.today()
            window_end = window_start + timedelta(days=60)
            context["availability"] = defense_availability_context(
                participants,
                window_start,
                window_end,
            )
            for slot in context["availability"]["possible_slots"]:
                conflicts = defense_schedule_conflicts(
                    selected_student,
                    assignments,
                    parse_date(slot["date"]),
                    parse_time(slot["start"]),
                    parse_time(slot["end"]),
                    "",
                    progress["stage"],
                )
                slot["conflicts"] = conflicts
                slot["conflict_free"] = not conflicts
            context["schedules"] = [
                schedule_request_dict(s)
                for s in ScheduleRequest.query.filter_by(student_id=selected_student.id)
                .order_by(ScheduleRequest.created_at.desc())
                .limit(6)
                .all()
            ]
        if slug == "practicum":
            context["practicum_record"] = practicum_record_dict(
                latest_practicum_record(selected_student.id),
                include_student=False,
            )
            context["practicum_eligibility"] = practicum_eligibility(selected_student)
        if slug == "withdrawal":
            context["withdrawal_application"] = withdrawal_application_dict(
                latest_withdrawal_application(selected_student.id),
                include_student=False,
            )
        if slug == "graduation":
            endorsement = latest_graduation_endorsement(selected_student.id)
            context["graduation_endorsement"] = graduation_endorsement_dict(endorsement, include_student=False)
            context["graduation_eligibility"] = graduation_eligibility(selected_student)

    return context


def student_search_label(student: Student | None) -> str:
    if not student:
        return ""
    return f"{student.student_number} - {student.last_name}, {student.first_name} - {student.program.code}"


def student_directory_brief(student: Student) -> dict:
    payload = student_brief(student)
    research_case = (
        ResearchCase.query.filter_by(student_id=student.id)
        .order_by(ResearchCase.opened_at.desc())
        .first()
    )
    gate = research_case.current_gate if research_case else None
    stage_by_gate = {
        "Form 1 - Title Defense": "Title Defense",
        "Form 4 - Proposal Defense Readiness": "Proposal Defense",
        "Final Defense": "Final Defense",
        "Completion Evidence": "Completed",
    }
    payload["research_stage"] = stage_by_gate.get(gate, student.current_stage)
    payload["readiness_status"] = research_case.status if research_case else "Research Gate not started"
    return payload


def identity_text(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def student_identity_key(first_name: str, last_name: str, program_id: int | None, entry_year: int | None) -> tuple:
    return (identity_text(last_name), identity_text(first_name), program_id, entry_year)


def possible_student_identity_match(first_name: str, last_name: str, program_id: int, entry_year: int) -> Student | None:
    first_key = identity_text(first_name)
    last_key = identity_text(last_name)
    if not first_key or not last_key:
        return None
    candidates = Student.query.filter_by(program_id=program_id, entry_year=entry_year).all()
    for student in candidates:
        if identity_text(student.first_name) == first_key and identity_text(student.last_name) == last_key:
            return student
    return None


def duplicate_student_groups(limit: int = 12) -> list[dict]:
    groups: list[dict] = []
    seen: set[tuple[int, ...]] = set()

    def add_group(reason: str, students: list[Student]) -> None:
        ids = tuple(sorted(s.id for s in students))
        if len(ids) < 2 or ids in seen:
            return
        seen.add(ids)
        groups.append({
            "reason": reason,
            "students": [student_brief(s) for s in sorted(students, key=lambda st: st.id)],
        })

    by_email: dict[str, list[Student]] = {}
    by_identity: dict[tuple, list[Student]] = {}
    for student in Student.query.order_by(Student.last_name, Student.first_name).all():
        email_key = (student.email or "").strip().lower()
        if email_key:
            by_email.setdefault(email_key, []).append(student)
        key = student_identity_key(student.first_name, student.last_name, student.program_id, student.entry_year)
        if all(key):
            by_identity.setdefault(key, []).append(student)

    for email, students in by_email.items():
        if len(students) > 1:
            add_group(f"Same email: {email}", students)
    for students in by_identity.values():
        if len(students) > 1:
            sample = students[0]
            add_group(f"Same name, program, and entry year: {sample.program.code} / {sample.entry_year}", students)

    return groups[:limit]


def status_rank(status: str | None) -> int:
    ranks = {"Completed": 6, "Current": 5, "Enrolled": 5, "Incomplete": 4, "Retake Required": 3, "Failed": 3, "Dropped": 2, "Missing": 1}
    return ranks.get(status or "", 0)


def merge_student_records(target: Student, source: Student, overwrite_profile: bool = False) -> dict:
    if target.id == source.id:
        raise ValueError("Choose two different student records to merge.")

    if overwrite_profile:
        target.first_name = source.first_name
        target.last_name = source.last_name
        target.email = source.email
        target.program_id = source.program_id
        target.entry_year = source.entry_year
        target.current_stage = source.current_stage
        target.standing = source.standing
        target.risk_level = source.risk_level
        target.adviser_name = source.adviser_name
    else:
        target.adviser_name = target.adviser_name or source.adviser_name

    moved = {"course_records": 0, "related_records": 0}

    target_courses = {rec.course_id: rec for rec in CourseRecord.query.filter_by(student_id=target.id).all()}
    for rec in CourseRecord.query.filter_by(student_id=source.id).all():
        existing = target_courses.get(rec.course_id)
        if existing:
            if status_rank(rec.status) > status_rank(existing.status):
                existing.status = rec.status
                existing.term_label = rec.term_label or existing.term_label
                existing.evidence_reference = rec.evidence_reference or existing.evidence_reference
                existing.updated_at = now_utc()
            db.session.delete(rec)
        else:
            rec.student_id = target.id
            moved["course_records"] += 1

    target_terms = {e.term_id: e for e in TermEnrollment.query.filter_by(student_id=target.id).all()}
    for enrollment in TermEnrollment.query.filter_by(student_id=source.id).all():
        if enrollment.term_id in target_terms:
            db.session.delete(enrollment)
        else:
            enrollment.student_id = target.id
            moved["related_records"] += 1

    target_subject_terms = {
        (item.course_id, item.term_id): item
        for item in SubjectEnrollment.query.filter_by(student_id=target.id).all()
    }
    for enrollment in SubjectEnrollment.query.filter_by(student_id=source.id).all():
        key = (enrollment.course_id, enrollment.term_id)
        existing = target_subject_terms.get(key)
        if existing:
            if status_rank(enrollment.status) > status_rank(existing.status):
                existing.status = enrollment.status
                existing.source_reference = (
                    enrollment.source_reference or existing.source_reference
                )
                existing.conflict_override = (
                    enrollment.conflict_override or existing.conflict_override
                )
                existing.cancelled_at = enrollment.cancelled_at
                existing.updated_at = now_utc()
            db.session.delete(enrollment)
        else:
            enrollment.student_id = target.id
            moved["related_records"] += 1

    target_docs = {(d.gate, d.item_name): d for d in DocumentCheck.query.filter_by(student_id=target.id).all()}
    for doc in DocumentCheck.query.filter_by(student_id=source.id).all():
        existing = target_docs.get((doc.gate, doc.item_name))
        if existing:
            if status_rank(doc.status) > status_rank(existing.status):
                existing.status = doc.status
                existing.evidence_reference = doc.evidence_reference or existing.evidence_reference
                existing.updated_at = now_utc()
            db.session.delete(doc)
        else:
            doc.student_id = target.id
            moved["related_records"] += 1

    for model in (
        ResearchCase,
        ScheduleRequest,
        Task,
        TransactionLog,
        StudentRequestAttachment,
        PracticumRecord,
        WithdrawalApplication,
        GraduationEndorsement,
    ):
        for row in model.query.filter_by(student_id=source.id).all():
            row.student_id = target.id
            moved["related_records"] += 1

    target_panel_keys = {(p.faculty_id, p.panel_role, p.gate): p for p in PanelAssignment.query.filter_by(student_id=target.id).all()}
    for panel in PanelAssignment.query.filter_by(student_id=source.id).all():
        existing = target_panel_keys.get((panel.faculty_id, panel.panel_role, panel.gate))
        if existing:
            existing.score = max(existing.score or 0, panel.score or 0)
            db.session.delete(panel)
        else:
            panel.student_id = target.id
            moved["related_records"] += 1

    source_label = f"{source.name} ({source.student_number})"
    db.session.delete(source)
    target.updated_at = now_utc()
    recompute_risk(target)
    add_log(
        "student-handoff",
        target.id,
        "GS Staff",
        "Duplicate review",
        f"Merged duplicate record into {target.student_number}",
        "GS Staff",
        f"Source record: {source_label}. Moved {moved['course_records']} course audit row(s) and {moved['related_records']} related record(s).",
    )
    return moved


def add_log(
    slug: str,
    student_id: int | None,
    actor: str,
    source: str,
    result: str,
    next_owner: str,
    notes: str,
    previous_status: str | None = None,
    new_status: str | None = None,
    visibility: str = "student_visible",
) -> TransactionLog:
    # Every workflow records what happened, who acted, where the evidence came
    # from, and who owns the next action.
    account = current_account() if has_request_context() else None
    record = workflow_case_record(slug, student_id) if student_id and slug in {"practicum", "withdrawal", "graduation"} else None
    log = TransactionLog(
        transaction_slug=slug,
        student_id=student_id,
        workflow_request_id=record.id if record else None,
        actor_user_id=account.id if account else None,
        action_type=workflow_transition_action(result),
        visibility=visibility if visibility in {"student_visible", "internal"} else "student_visible",
        actor_role=actor,
        source_reference=source,
        result=result,
        next_owner=next_owner,
        notes=notes,
        previous_status=previous_status,
        new_status=new_status,
    )
    db.session.add(log)
    add_student_transition_notice(
        slug,
        student_id,
        result,
        next_owner,
        previous_status,
        new_status,
    )
    return log


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


def ensure_task(student_id: int, title: str, owner: str, due_at: date, priority: int = 20, status: str = "Pending") -> Task:
    existing = (
        Task.query.filter(
            Task.student_id == student_id,
            Task.title == title,
            Task.owner_role == owner,
            Task.status.in_(["Pending", "Overdue"]),
        )
        .order_by(Task.due_at.asc(), Task.id.asc())
        .first()
    )
    if existing:
        existing.due_at = min(existing.due_at, due_at)
        existing.priority = max(existing.priority or 0, priority)
        if status == "Overdue" or existing.due_at < date.today():
            existing.status = "Overdue"
        return existing
    task = Task(
        student_id=student_id,
        title=title,
        owner_role=owner,
        due_at=due_at,
        priority=priority,
        status=status,
    )
    db.session.add(task)
    return task


def sync_overdue_incomplete_alerts(commit: bool = False) -> int:
    """Apply the handbook INC lapse rule after the one-year completion deadline."""
    today = date.today()
    changed = 0
    records = (
        CourseRecord.query.join(Student)
        .join(Course)
        .filter(
            CourseRecord.status == "Incomplete",
            CourseRecord.incomplete_deadline.isnot(None),
            CourseRecord.incomplete_deadline < today,
        )
        .all()
    )
    for record in records:
        if not record.student or not record.course:
            continue
        deadline = record.incomplete_deadline
        limits = residence_limits(record.student)
        lapse_grade = "2.0" if limits["program_level"] == "Doctorate" else "3.0"
        review_title = f"Arrange retake after lapsed INC for {record.course.code}"
        ensure_task(record.student_id, review_title, "Academic Coordinator", today, 75, "Pending")
        note = (
            f"{record.course.code} incomplete deadline passed on {deadline.isoformat()}. "
            f"The handbook lapse grade {lapse_grade} was recorded with no graduate credit; the subject must be retaken."
        )
        if note not in (record.remarks or ""):
            record.remarks = f"{record.remarks}\n{note}".strip() if record.remarks else note
            changed += 1
        record.status = "Retake Required"
        record.grade_value = lapse_grade
        record.grade_status = "No Credit - Retake Required"
        record.resolved_at = record.resolved_at or now_utc()
        record.incomplete_deadline = None
        record.updated_at = now_utc()
        sync_subject_enrollment_from_course_record(
            record.student,
            record.course,
            record.term_label,
            "Retake Required",
            "Incomplete grade deadline monitor",
        )
        changed += 1
        result = f"{record.course.code} incomplete deadline lapsed to retake required"
        already_logged = TransactionLog.query.filter_by(
            transaction_slug="course-audit",
            student_id=record.student_id,
            source_reference="Incomplete grade deadline monitor",
            result=result,
        ).first()
        if not already_logged:
            add_log(
                "course-audit",
                record.student_id,
                "System",
                "Incomplete grade deadline monitor",
                result,
                "Academic Coordinator",
                note,
                previous_status="Incomplete",
                new_status="Retake Required",
            )
            workflow_message_record(
                "course-audit", record.student, None, "Student",
                f"Incomplete deadline passed for {record.course.code}",
                note, "notice", "Incomplete", "Retake Required", status="Sent",
            )
            changed += 1
    if commit and changed:
        db.session.commit()
    return changed


def start_incomplete_deadline_scheduler():
    """Run the INC deadline sweep independently of page/API access for the local app."""
    interval = max(30, int(os.getenv("INCOMPLETE_SWEEP_INTERVAL_SECONDS", "300")))
    stopped = threading.Event()

    def sweep_loop():
        while not stopped.wait(interval):
            with app.app_context():
                try:
                    sync_overdue_incomplete_alerts(commit=True)
                except Exception as exc:  # noqa: BLE001 - keep the scheduler alive and roll back the failed sweep
                    db.session.rollback()
                    print(f"Incomplete deadline sweep failed: {exc}", file=sys.stderr)

    thread = threading.Thread(target=sweep_loop, name="incomplete-deadline-scheduler", daemon=True)
    thread.start()
    return stopped, thread


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


def clean_person_name(value: str) -> str:
    """Registrar sheets often store names in ALL CAPS (e.g. 'YU', 'MA. LORIANNE').
    Normalize to a clean display case so 'MIGUEL YU' becomes 'Miguel Yu'."""
    parts = re.split(r"\s+", (value or "").strip())
    return " ".join(part[:1].upper() + part[1:].lower() if part else part for part in parts).strip()


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
    compre_c = find(hdr, "COMPRE") or find(sub, "COMPRE")

    stop_cols = [c for c in list(milestone_cols.values()) + [note_c] if c]
    milestone_start = min(stop_cols) if stop_cols else max_col + 1

    subjects = []  # (col, code, title)
    subject_categories = {}  # code -> Basic / Major / Cognate
    subject_titles = {}  # code -> display title copied from the sheet header
    current_group = "Core"
    group_map = {"BASIC": "Basic", "MAJOR": "Major", "COGNATE": "Cognate", "COMPRE": "Comprehensive"}
    if yr_c:
        for c in range(yr_c + 1, milestone_start):
            group_label = cell(hdr, c).upper()
            if group_label in group_map:
                current_group = group_map[group_label]
            code = cell(sub, c)
            if not code or code == "-" or code.isdigit() or code.upper() in ("SN", "FN", "TOTAL"):
                continue
            if group_label == "TOTAL":
                continue
            title = code
            subjects.append((c, code, title))
            subject_categories[code] = current_group
            subject_titles[code] = title

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
        subj = {code: bool(cell(r, c)) for c, code, _title in subjects}
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
            "comprehensive_exam_passed": bool(cell(r, compre_c)) if compre_c else False,
            "note": cell(r, note_c) if note_c else "",
        })

    if not program_code:
        program_code = "IMPORT"
    return {
        "program_code": program_code,
        "subjects": [s[1] for s in subjects],
        "subject_categories": subject_categories,
        "subject_titles": subject_titles,
        "rows": rows,
    }


def _stage_from_sheet(milestones: dict, completed_subjects: int, comprehensive_exam_passed: bool = False) -> str:
    if not comprehensive_exam_passed:
        return "Coursework" if completed_subjects > 0 else "Admission"
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


def _sheet_student_comparison(student: Student, row: dict, course_by_code: dict[str, Course]) -> dict:
    entry_year = _entry_year_from_ay(row["ay_entry"])
    differences = []
    if (student.first_name or "").strip().lower() != (row["first_name"] or "").strip().lower():
        differences.append("first name")
    if (student.last_name or "").strip().lower() != (row["last_name"] or "").strip().lower():
        differences.append("last name")
    if student.entry_year != entry_year:
        differences.append("entry year")

    existing_records = {
        rec.course_id: rec.status
        for rec in CourseRecord.query.filter_by(student_id=student.id).all()
    }
    subject_differences = 0
    incoming_completed = 0
    existing_completed = 0
    for code, done in row["subjects"].items():
        course = course_by_code.get(code)
        if not course:
            continue
        incoming_status = "Completed" if done else "Missing"
        existing_status = existing_records.get(course.id, "Missing")
        if incoming_status == "Completed":
            incoming_completed += 1
        if existing_status == "Completed":
            existing_completed += 1
        if existing_status != incoming_status:
            subject_differences += 1

    if subject_differences:
        differences.append(f"{subject_differences} subject/unit status difference(s)")

    category_comparison = []
    for category in ("Basic", "Major", "Cognate"):
        matching = [course for course in course_by_code.values() if course.category == category]
        existing_units = sum((course.units or 3) for course in matching if existing_records.get(course.id) == "Completed")
        incoming_units = sum((course.units or 3) for code, done in row["subjects"].items() if done and (course := course_by_code.get(code)) and course.category == category)
        category_comparison.append({"category": category, "current": existing_units, "uploaded": incoming_units})

    return {
        "conflicting": bool(differences),
        "differences": differences,
        "incoming_completed": incoming_completed,
        "existing_completed": existing_completed,
        "incoming_total": len(row["subjects"]),
        "category_comparison": category_comparison,
    }


def import_ac_monitoring(parsed: dict) -> dict:
    program = Program.query.filter_by(code=parsed["program_code"]).first()
    if not program:
        program = Program(code=parsed["program_code"], name=f"{parsed['program_code']} (imported)", college="Imported")
        db.session.add(program)
        db.session.flush()

    # ensure a Course row exists for each subject code on the sheet (for this program)
    categories = parsed.get("subject_categories", {})
    titles = parsed.get("subject_titles", {})
    course_by_code: dict[str, Course] = {}
    for code in parsed["subjects"]:
        category = categories.get(code, "Core")
        title = titles.get(code) or code
        existing = Course.query.filter_by(program_id=program.id, code=code).first()
        if not existing:
            existing = Course(program_id=program.id, code=code, title=title, units=3, category=category)
            db.session.add(existing)
            db.session.flush()
        else:
            if existing.title == existing.code and title != existing.code:
                existing.title = title
            if (existing.category or "Core") == "Core" and category != "Core":
                existing.category = category
        course_by_code[code] = existing

    term = get_active_term()

    created, skipped, sample, conflicts, duplicates = 0, 0, [], [], []
    created_accounts = []
    subject_changes = 0
    students_changed = 0
    for row in parsed["rows"]:
        student = Student.query.filter_by(student_number=row["idno"]).first()
        is_new = student is None
        entry_year = _entry_year_from_ay(row["ay_entry"])
        if student:
            comparison = _sheet_student_comparison(student, row, course_by_code)
            item = {
                "incoming_student_number": row["idno"],
                "incoming_name": f"{row['first_name']} {row['last_name']}".strip(),
                "matched_student": student_brief(student),
                "incoming_completed": comparison["incoming_completed"],
                "existing_completed": comparison["existing_completed"],
                "total_subjects": comparison["incoming_total"],
                "category_comparison": comparison["category_comparison"],
            }
            if comparison["conflicting"]:
                conflicts.append({
                    **item,
                    "reason": "Conflicting monitoring sheet data. Please verify before changing this student.",
                    "differences": comparison["differences"],
                })
            else:
                duplicates.append({
                    **item,
                    "reason": "Student is already in the system with the same monitoring data.",
                })
            skipped += 1
            continue
        if is_new:
            possible_match = possible_student_identity_match(row["first_name"], row["last_name"], program.id, entry_year)
            if possible_match:
                conflicts.append({
                    "incoming_student_number": row["idno"],
                    "incoming_name": f"{row['first_name']} {row['last_name']}".strip(),
                    "matched_student": student_brief(possible_match),
                    "reason": "Possible duplicate student with a different ID number. Please verify before importing.",
                    "differences": ["student number"],
                })
                skipped += 1
                continue
        if is_new:
            student = Student(student_number=row["idno"], program_id=program.id, standing="Active")
            db.session.add(student)
        student.first_name = clean_person_name(row["first_name"]) or student.first_name or "—"
        student.last_name = clean_person_name(row["last_name"]) or student.last_name or "—"
        student.program_id = program.id
        student.entry_year = entry_year
        if row.get("comprehensive_exam_passed"):
            student.comprehensive_exam_status = "Passed"
        if is_new or not student.email:
            student.email = unique_student_email(row["first_name"], row["last_name"], row["idno"], student.id if not is_new else None)
        completed = sum(1 for v in row["subjects"].values() if v)
        student.current_stage = _stage_from_sheet(
            row["milestones"], completed, row.get("comprehensive_exam_passed", False)
        )
        db.session.flush()

        # per-subject course records (real subjects from the sheet)
        row_subject_changes = 0
        for code, done in row["subjects"].items():
            course = course_by_code[code]
            rec = CourseRecord.query.filter_by(student_id=student.id, course_id=course.id).first()
            new_status = "Completed" if done else "Missing"
            if not rec:
                rec = CourseRecord(student_id=student.id, course_id=course.id)
                db.session.add(rec)
            if rec.status != new_status:
                row_subject_changes += 1
            rec.status = new_status
            # Coursework completion is cumulative, not tied to one semester — leave the
            # term blank so it shows on the monitoring sheet under any selected semester.
            rec.term_label = ""
            rec.evidence_reference = "AC Student Monitoring import"
            rec.updated_at = now_utc()
        subject_changes += row_subject_changes
        if row_subject_changes:
            students_changed += 1

        # onboarding evidence treated as complete (record came from the official sheet)
        if is_new and term:
            db.session.add(TermEnrollment(
                student_id=student.id, term_id=term.id, status="Confirmed",
                source_reference="AC Student Monitoring import"))
            for item in onboarding_requirements():
                db.session.add(DocumentCheck(
                    student_id=student.id, gate="Admission Handoff", item_name=item,
                    status="Complete", evidence_reference="AC Student Monitoring import"))

        if is_new:
            # Provision a student-portal account so the handed-off student can sign in
            # (upload concept papers, file LOA / withdrawal) — realistic and demo-ready.
            ensure_student_account(student, student.email)
            created_accounts.append({"name": student.name, "email": student.email, "password": SIM_STUDENT_PASSWORD})

        recompute_risk(student)

        if is_new:
            created += 1
        if len(sample) < 10:
            sample.append({
                "id": student.id, "name": student.name, "student_number": student.student_number,
                "program_code": program.code, "stage": student.current_stage,
                "completed": completed, "total_subjects": len(row["subjects"]),
            })

    sync_program_curriculum(program)
    add_log(
        "student-handoff",
        None,
        "GS Staff",
        "AC Student Monitoring import",
        f"Monitoring sheet imported: {len(parsed['rows'])} rows, {created} new, {skipped} skipped, {len(conflicts)} conflict(s)",
        "Academic Coordinator",
        f"Program {program.code}; {len(parsed['subjects'])} subjects; {subject_changes} subject status change(s) across {students_changed} student(s).",
    )

    return {
        "ok": True,
        "program_id": program.id,
        "program": program.code,
        "subjects": len(parsed["subjects"]),
        "rows": len(parsed["rows"]),
        "created": created,
        "updated": 0,
        "skipped": skipped,
        "duplicates": duplicates,
        "duplicate_count": len(duplicates),
        "subject_changes": subject_changes,
        "students_changed": students_changed,
        "conflicts": conflicts,
        "conflict_count": len(conflicts),
        "sample": sample,
        "accounts": created_accounts,
        "message": f"Imported {created} new student(s) from the {program.code} monitoring sheet "
                   f"({skipped} already in system or needing verification, {len(conflicts)} conflict(s))."
                   + (
                       f" Portal login for {created_accounts[0]['name']}: {created_accounts[0]['email']} / {SIM_STUDENT_PASSWORD}."
                       if len(created_accounts) == 1
                       else f" {len(created_accounts)} new student portal account(s) created (password: {SIM_STUDENT_PASSWORD})."
                       if created_accounts
                       else ""
                   ),
    }


def monitoring_upload_dict(upload: MonitoringSheetUpload) -> dict:
    result = json.loads(upload.result_json or "{}")
    return {
        "id": upload.id,
        "original_name": upload.original_name,
        "program": upload.program_code,
        "rows": upload.row_count,
        "subjects": upload.subject_count,
        "uploaded_at": iso(upload.uploaded_at),
        "created": result.get("created", 0),
        "skipped": result.get("skipped", 0),
        "conflict_count": result.get("conflict_count", 0),
        "conflicts": result.get("conflicts", []),
        "download_url": f"/api/monitoring/uploads/{upload.id}/download",
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
    admission_signal = (data.get("admission_signal") or "").strip()
    transcript_status = (data.get("transcript_status") or "Not verified").strip()
    source_reference = (data.get("source_reference") or "").strip()
    # Manual handoff requirements are derived from entered evidence instead of
    # relying on a five-checkbox memory test. Keep submitted items for backwards
    # compatibility with older API clients, but the current UI does not use them.
    submitted_onboarding = set(data.getlist("onboarding_items"))
    if admission_signal in {"Admission Confirmed", "Enrollment Confirmed"}:
        submitted_onboarding.add("Admission approval")
    if source_reference:
        submitted_onboarding.add("Student profile sheet")
    if program:
        submitted_onboarding.add("Program assignment")
    if data.get("term_id") and admission_signal:
        submitted_onboarding.add("Enrollment signal")
    if transcript_status == "Received":
        submitted_onboarding.add("Official transcript")
    missing_items = [item for item in onboarding_requirements() if item not in submitted_onboarding]
    missing_items.extend(split_items(data.get("additional_missing_items", "")))
    student = Student(
        student_number=student_number,
        first_name=first_name,
        last_name=last_name,
        email=(data.get("email") or "").strip().lower() or unique_student_email(first_name, last_name, student_number),
        program_id=program.id,
        entry_year=int(data.get("entry_year") or date.today().year),
        current_stage="Admission",
        standing="Active",
        risk_level="Medium" if missing_items else "Low",
    )
    db.session.add(student)
    db.session.flush()
    account = ensure_student_account(student, student.email)
    sync_student_curriculum(student)

    term = AcademicTerm.query.get(int(data["term_id"]))
    db.session.add(
        TermEnrollment(
                student_id=student.id,
                term_id=term.id,
                status=admission_signal,
                source_reference=source_reference,
        )
    )

    for item in onboarding_requirements():
        db.session.add(
            DocumentCheck(
                student_id=student.id,
                gate="Admission Handoff",
                item_name=item,
                status="Missing" if item in missing_items else "Complete",
                evidence_reference=(
                    f"Transcript status: {transcript_status}"
                    if item == "Official transcript"
                    else source_reference
                ),
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
        source_reference,
        f"Monitoring record created from {admission_signal}; {len(missing_items)} onboarding item(s) missing",
        "GS Staff",
        f"Program: {program.code}; Automatically derived {len(submitted_onboarding)} received item(s) against "
        f"{len(onboarding_requirements())} required item(s). Missing: "
        f"{', '.join(missing_items) if missing_items else 'None'}. "
        f"Student portal account: {account.email}.",
    )
    return student.id


def pending_student_request_log(student_id: int, slug: str, submitted_result: str) -> TransactionLog:
    latest = (
        TransactionLog.query.filter_by(transaction_slug=slug, student_id=student_id)
        .filter(TransactionLog.actor_role != "Demo Data")
        .order_by(TransactionLog.created_at.desc(), TransactionLog.id.desc())
        .first()
    )
    if not latest or latest.actor_role != "Student" or latest.result != submitted_result:
        raise ValueError("The student must submit a new request before staff can forward it to the Dean.")
    return latest


def resolve_standing_change_tasks(student_id: int, title_fragment: str, owner: str) -> None:
    for task in Task.query.filter(
        Task.student_id == student_id,
        Task.owner_role == owner,
        Task.status.in_(["Pending", "Overdue"]),
        Task.title.contains(title_fragment),
    ).all():
        task.status = "Done"


def auto_approve_eligible_loa(student: Student, forwarded_log: TransactionLog, review: dict) -> None:
    period = request_notes_value(forwarded_log.notes, "Requested semester period")
    student.current_stage = "LOA"
    student.standing = "On Leave"
    student.enrollment_tag = "LOA"
    student.risk_level = "Medium"
    detail = (
        f"Requested semester period: {period or 'Not recorded'}. "
        "Auto-approved because the LOA RAG policy review found all required checks present."
    )
    resolve_standing_change_tasks(student.id, "Decide", "Dean")
    workflow_message_record(
        "leave-of-absence",
        student,
        None,
        "Student",
        "LOA approved automatically after policy review",
        detail,
        "notice",
        "Dean Review",
        "Approved",
        visibility="student_visible",
        status="Sent",
    )
    add_log(
        "leave-of-absence",
        student.id,
        "System · LOA RAG",
        "LOA policy review",
        "LOA auto-approved by RAG",
        "Graduate School Staff",
        " ".join(part for part in [detail, review.get("summary", "")] if part),
        previous_status="Dean Review",
        new_status="Approved",
    )


def auto_approve_eligible_readmission(student: Student, forwarded_log: TransactionLog, review: dict) -> None:
    return_semester = request_notes_value(forwarded_log.notes, "Return semester")
    if student.current_stage == "LOA":
        student.current_stage = "Coursework"
    student.standing = "Active"
    student.enrollment_tag = "Enrolled"
    student.risk_level = "Low"
    detail = (
        f"Return semester: {return_semester or 'Not recorded'}. "
        "Auto-approved because the readmission RAG policy review found all required checks present."
    )
    resolve_standing_change_tasks(student.id, "Decide", "Dean")
    add_task(student.id, "Confirm return-semester study plan", "Academic Coordinator", 5, 25)
    workflow_message_record(
        "readmission",
        student,
        None,
        "Student",
        "Readmission approved automatically after policy review",
        detail,
        "notice",
        "Dean Review",
        "Approved",
        visibility="student_visible",
        status="Sent",
    )
    add_log(
        "readmission",
        student.id,
        "System · Readmission RAG",
        "Readmission policy review",
        "Readmission auto-approved by RAG",
        "Academic Coordinator",
        " ".join(part for part in [detail, review.get("summary", "")] if part),
        previous_status="Dean Review",
        new_status="Approved",
    )


def handle_leave_of_absence(data: MultiDict) -> int:
    # Staff verify and forward. Eligible LOA requests are auto-approved by the
    # policy review; exceptions still go to the Dean queue.
    account = require_workflow_actor("staff")
    student = Student.query.get_or_404(int(data["student_id"]))
    submission = pending_student_request_log(student.id, "leave-of-absence", "LOA application submitted")
    source = (data.get("source_reference") or data.get("application_reference") or "").strip()
    application_reference = (data.get("application_reference") or "").strip()
    request_date = (data.get("request_date") or "").strip()
    effective_start = (data.get("effective_start") or "").strip()
    effective_end = (data.get("effective_end") or "").strip()
    reason = (data.get("reason_remarks") or "").strip()
    staff_notes = (data.get("staff_notes") or "").strip()
    try:
        prior_loa_count = int(data.get("prior_loa_count") or 0)
    except (TypeError, ValueError):
        raise ValueError("Prior LOA count must be a whole number.")
    if prior_loa_count < 0:
        raise ValueError("Prior LOA count cannot be negative.")
    eligibility_status = (data.get("eligibility_status") or "Checked").strip()
    if eligibility_status not in {"Eligible", "Needs Review", "Not Eligible", "Pending Requirements", "Checked"}:
        raise ValueError("Choose a valid LOA eligibility status.")
    if not (effective_start and effective_end):
        raise ValueError("The requested leave start and end semesters are required before forwarding.")
    review = loa_policy_review(student, {
        "prior_loa_count": prior_loa_count,
        "reason_remarks": reason,
        "effective_start": effective_start,
        "effective_end": effective_end,
        "application_reference": application_reference or source or submission.source_reference,
    })
    period = " to ".join([part for part in [effective_start, effective_end] if part])
    notes = [
        f"Application reference: {application_reference or source or submission.source_reference or 'uploaded application'}.",
        f"Request date: {request_date or 'Not recorded'}.",
        f"Requested semester period: {period}.",
        f"Prior LOA count: {prior_loa_count}.",
        f"Eligibility result: {eligibility_status}.",
        f"Source submission log: {submission.id}.",
    ]
    if reason:
        notes.append(f"Reason/remarks: {reason}")
    if staff_notes:
        notes.append(f"Staff notes: {staff_notes}")
    resolve_standing_change_tasks(student.id, "Leave of Absence", "GS Staff")
    auto_approve = review.get("recommendation") == "Eligible"
    if not auto_approve:
        add_task(student.id, "Decide Leave of Absence request", "Dean", 3, 60)
    forwarded_log = add_log(
        "leave-of-absence", student.id, workflow_actor_label(account),
        source or application_reference or submission.source_reference or "LOA application",
        "LOA request forwarded to Dean", "Dean", "\n".join(notes),
        previous_status="Submitted", new_status="Dean Review",
    )
    db.session.flush()
    if auto_approve:
        auto_approve_eligible_loa(student, forwarded_log, review)
    return student.id


def handle_readmission(data: MultiDict) -> int:
    # Staff verify and forward. Eligible readmission requests are auto-approved by
    # the policy review; incomplete or uncertain cases still go to the Dean queue.
    account = require_workflow_actor("staff")
    student = Student.query.get_or_404(int(data["student_id"]))
    submission = pending_student_request_log(student.id, "readmission", "Readmission request submitted")
    source = (data.get("source_reference") or data.get("application_reference") or "").strip()
    application_reference = (data.get("application_reference") or "").strip()
    target_return_term = (data.get("target_return_term") or "").strip()
    previous_loa_period = (data.get("previous_loa_period") or "").strip()
    eligibility_status = (data.get("eligibility_status") or "Checked").strip()
    if eligibility_status not in {"Eligible to Return", "Needs Review", "Not Eligible", "Pending Requirements", "Checked"}:
        raise ValueError("Choose a valid readmission eligibility status.")
    submitted = set(data.getlist("readmission_items"))
    unknown_items = sorted(submitted - set(readmission_requirements()))
    if unknown_items:
        raise ValueError("Unknown readmission checklist item: " + ", ".join(unknown_items))
    missing = [item for item in readmission_requirements() if item not in submitted]
    missing.extend(split_items(data.get("missing_requirements", "")))
    staff_notes = (data.get("staff_notes") or "").strip()
    if not target_return_term:
        raise ValueError("The requested return semester is required before forwarding.")
    review = readmission_policy_review(student, {
        "readmission_items": sorted(submitted),
        "target_return_term": target_return_term,
        "previous_loa_period": previous_loa_period,
        "application_reference": application_reference or source or submission.source_reference,
    })

    notes = [
        f"Application reference: {application_reference or source or submission.source_reference or 'uploaded application'}.",
        f"Return semester: {target_return_term}.",
        f"Previous leave semester: {previous_loa_period or 'Not recorded'}.",
        f"Eligibility result: {eligibility_status}.",
        f"Missing requirements: {', '.join(missing) if missing else 'None'}.",
        f"Source submission log: {submission.id}.",
    ]
    if staff_notes:
        notes.append(f"Staff notes: {staff_notes}")
    resolve_standing_change_tasks(student.id, "readmission", "GS Staff")
    auto_approve = review.get("recommendation") == "Eligible to Return"
    if not auto_approve:
        add_task(student.id, "Decide readmission request", "Dean", 3, 60)
    forwarded_log = add_log(
        "readmission", student.id, workflow_actor_label(account),
        source or application_reference or submission.source_reference or "Readmission application",
        "Readmission request forwarded to Dean", "Dean", "\n".join(notes),
        previous_status="Submitted", new_status="Dean Review",
    )
    db.session.flush()
    if auto_approve:
        auto_approve_eligible_readmission(student, forwarded_log, review)
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
    sync_subject_enrollment_from_course_record(
        student,
        course,
        existing.term_label,
        status,
        data.get("evidence_reference", "") or "Course audit transaction",
    )

    audit = compute_course_audit(student)
    if audit["missing_count"] > 0:
        add_task(student.id, "Resolve missing curriculum subjects", "Academic Coordinator", 7, 25)
        student.risk_level = "Medium" if audit["missing_count"] >= 3 else student.risk_level
    if comprehensive_exam_eligibility(student)["eligible"] and student.current_stage in ("Admission", "Coursework"):
        student.current_stage = "Comprehensive Exam"

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
    # Research gate status is derived only from stored student uploads. Staff
    # can evaluate evidence, but cannot assert that an absent file was received.
    student = Student.query.get_or_404(int(data["student_id"]))
    require_research_prerequisite(student)
    research_case, progress = sync_research_progress(student)
    gate = progress["gate"]
    ethics_clearance_status = (data.get("ethics_clearance_status") or "").strip()
    if ethics_clearance_status:
        account = require_workflow_actor("research_coordinator")
        if gate != "Form 4 - Proposal Defense Readiness":
            raise ValueError("Ethics clearance is recorded during the Proposal Defense stage.")
        allowed_statuses = {"Cleared", "Returned", "Not cleared"}
        if ethics_clearance_status not in allowed_statuses:
            raise ValueError("Choose Cleared, Returned, or Not cleared for the ethics clearance status.")
        clearance_date = (data.get("ethics_clearance_date") or "").strip()
        if ethics_clearance_status == "Cleared" and not clearance_date:
            raise ValueError("Enter the ethics clearance date before marking the form Cleared.")
        checks = ensure_research_document_checks(student.id, gate)
        clearance_doc = next((doc for doc in checks if doc.item_name == "Ethics Clearance"), None)
        record_doc = next((doc for doc in checks if doc.item_name == "Ethics clearance status and date"), None)
        if not clearance_doc or not clearance_doc.evidence_files:
            raise ValueError("Preview an uploaded Research Protocol Form 5.2 ethics clearance before recording the status.")
        label = (
            f"{ethics_clearance_status} on {clearance_date}"
            if clearance_date
            else ethics_clearance_status
        )
        clearance_doc.status = "Complete" if ethics_clearance_status == "Cleared" else ethics_clearance_status
        clearance_doc.evidence_reference = label
        clearance_doc.updated_at = now_utc()
        if record_doc:
            record_doc.status = "Complete" if ethics_clearance_status == "Cleared" else ethics_clearance_status
            record_doc.evidence_reference = label
            record_doc.updated_at = now_utc()
        next_owner = "Research Coordinator" if ethics_clearance_status == "Cleared" else "Student"
        if ethics_clearance_status != "Cleared":
            add_task(student.id, "Resolve ethics clearance form", "Student", 5, 45)
        add_log(
            "research-gate",
            student.id,
            workflow_actor_label(account),
            clearance_doc.evidence_reference,
            f"Ethics clearance {ethics_clearance_status}",
            next_owner,
            f"Research Coordinator recorded Research Protocol Form 5.2 as {label}.",
        )
        sync_research_progress(student)
        return student.id
    defense_outcome = (data.get("defense_outcome") or "").strip()
    if defense_outcome:
        raise ValueError("Defense verdicts can be submitted only by the assigned panel chair or panel lead from the Faculty Portal.")
    required_items = required_documents_for_gate(gate)
    checks = ensure_research_document_checks(student.id, gate)
    submitted_items = set()
    missing_items = []
    states = {}
    for doc in checks:
        presentation = research_requirement_presentation(gate, doc.item_name)
        state = research_requirement_state(student, gate, doc.item_name, doc)
        states[doc.item_name] = state
        present = (
            presentation["source_type"] == "staff"
            and research_student_uploads_ready(student, gate)
        ) or state["status"] == "Complete" or (
            presentation["source_type"] == "student_upload" and state["status"] == "Submitted"
        )
        if present:
            submitted_items.add(doc.item_name)
        else:
            missing_items.append(doc.item_name)
    evidence_names = [file.original_name for doc in checks for file in doc.evidence_files]
    source = ", ".join(evidence_names[:4])
    revision_required = data.get("revision_required") == "yes"

    missing_sources = {
        research_requirement_presentation(gate, item)["source_type"]
        for item in missing_items
    }
    if "student_upload" in missing_sources:
        result = "Missing Requirements"
        next_owner = "Student"
    elif "coordinator_endorsement" in missing_sources:
        result = "Pending Academic Coordinator Endorsement"
        next_owner = "Academic Coordinator"
    elif missing_items:
        result = "Pending Staff Action"
        next_owner = "Research Coordinator"
    elif revision_required:
        result = "Revisions Required"
        next_owner = "Adviser"
    elif gate == "Completion Evidence":
        result = "Verified Complete"
        next_owner = "GS Staff"
    else:
        result = "Ready"
        next_owner = "Research Coordinator"

    research_case.status = result

    for item in required_items:
        status = "Missing" if item in missing_items else "Complete"
        existing = next(doc for doc in checks if doc.item_name == item)
        if item == "Ethics Clearance" and item not in missing_items:
            ethics_record = next((doc for doc in checks if doc.item_name == "Ethics clearance status and date"), None)
            if not ethics_record or ethics_record.status != "Complete":
                status = existing.status if existing.status in {"Returned", "Not cleared"} else "Submitted"
        existing.status = status
        if existing.evidence_files and item != "Ethics Clearance":
            existing.evidence_reference = ", ".join(file.original_name for file in existing.evidence_files)
        existing.updated_at = now_utc()

    if result in ["Missing Requirements", "Revisions Required", "Returned", "Pending Staff Action", "Pending Academic Coordinator Endorsement"]:
        add_task(student.id, f"Resolve {gate} requirements", next_owner, 5, 45)
        student.risk_level = "High" if result == "Returned" else "Medium"
    sync_research_progress(student)

    add_log(
        "research-gate",
        student.id,
        "Research Coordinator",
        source,
        f"{gate}: {result}",
        next_owner,
        f"Compared stored PDF evidence against {len(required_items)} required item(s). Received: "
        f"{', '.join(sorted(submitted_items)) if submitted_items else 'None'}. Missing: "
        f"{', '.join(missing_items) if missing_items else 'None'}",
    )
    return student.id


def handle_panel_matching(data: MultiDict) -> int:
    # Finalization is a staff decision. The system supplies the ranked shortlist,
    # while the submitted faculty ids preserve any staff adjustments.
    student = Student.query.get_or_404(int(data["student_id"]))
    account = require_workflow_actor("staff", "academic_coordinator")
    require_research_prerequisite(student)
    matching_profile = research_matching_profile(student)
    if not matching_profile["ready"]:
        raise ValueError(matching_profile.get("blocked_reason") or "Panel matching requires readable research manuscript body text.")
    recommendations = recommend_panel(student)
    required_roles = panel_roles_for_student(student)
    selected_ids = []
    for value in data.getlist("faculty_ids"):
        try:
            faculty_id = int(value)
        except (TypeError, ValueError):
            continue
        if faculty_id not in selected_ids:
            selected_ids.append(faculty_id)
    if not selected_ids:
        selected_ids = [row["faculty"].id for row in recommendations[: len(required_roles)]]
    if len(selected_ids) != len(required_roles):
        raise ValueError(f"Select {len(required_roles)} different faculty members before finalizing the panel.")

    recommendation_by_id = {row["faculty"].id: row for row in recommendations}
    selected_rows = []
    for faculty_id in selected_ids:
        row = recommendation_by_id.get(faculty_id)
        if not row:
            raise ValueError("One of the selected faculty members is no longer eligible for panel assignment.")
        selected_rows.append(row)

    clear_panel_for_research_gate(student, matching_profile["gate"])
    for index, row in enumerate(selected_rows):
        # Panel selection grants access through the assignment and reuses the
        # faculty's already-created general login.
        if not UserAccount.query.filter_by(faculty_id=row["faculty"].id, role="faculty", active=True).first():
            raise ValueError(f"{row['faculty'].name} does not have an active faculty login account yet.")
        db.session.add(
            PanelAssignment(
                student_id=student.id,
                faculty_id=row["faculty"].id,
                gate=matching_profile["gate"],
                panel_role=required_roles[index],
                score=row["score"],
                eligibility_note=row["note"],
            )
        )

    add_log(
        "panel-matching",
        student.id,
        workflow_actor_label(account),
        data.get("source_reference", ""),
        f"{len(required_roles)}-member {research_case_type(student)} panel matched from uploaded {matching_profile['source_label']}",
        "Research Coordinator",
        "; ".join(
            [
                f"{required_roles[index]}: {row['faculty'].name} ({row['score']})"
                for index, row in enumerate(selected_rows)
            ]
        ),
    )
    add_task(student.id, "Confirm assigned panel acceptance", "Research Coordinator", 3, 30)
    sync_research_progress(student)
    return student.id


def handle_defense_scheduling(data: MultiDict) -> int:
    # Staff makes the final decision; the system requires an explicit override
    # when Research Gate, calendar, lead-time, or defense-record checks warn.
    student = Student.query.get_or_404(int(data["student_id"]))
    require_research_prerequisite(student)

    # Optional panel reassignment from the Defense Scheduling screen: staff may pick
    # faculty from the full directory (not just the matched panel). This reassigns the
    # student's official gate panel before scheduling against it.
    reassign_ids = []
    for value in data.getlist("panel_faculty_ids"):
        try:
            fid = int(value)
        except (TypeError, ValueError):
            continue
        if fid not in reassign_ids:
            reassign_ids.append(fid)
    if reassign_ids:
        reassign_actor = require_workflow_actor("staff", "academic_coordinator")
        _, reassign_progress = sync_research_progress(student)
        reassign_gate = reassign_progress["gate"]
        reassign_roles = panel_roles_for_student(student)
        if len(reassign_ids) != len(reassign_roles):
            raise ValueError(f"Select {len(reassign_roles)} different faculty members for the defense panel.")
        prior_scores = {a.faculty_id: a.score for a in active_panel_assignments(student, reassign_gate)}
        chosen_faculty = []
        for fid in reassign_ids:
            faculty = Faculty.query.filter_by(id=fid, active=True).first()
            if not faculty:
                raise ValueError("One of the selected faculty members is no longer active.")
            if not UserAccount.query.filter_by(faculty_id=faculty.id, role="faculty", active=True).first():
                raise ValueError(f"{faculty.name} does not have an active faculty login account yet.")
            chosen_faculty.append(faculty)
        clear_panel_for_research_gate(student, reassign_gate)
        for index, faculty in enumerate(chosen_faculty):
            db.session.add(PanelAssignment(
                student_id=student.id, faculty_id=faculty.id, gate=reassign_gate,
                panel_role=reassign_roles[index], score=prior_scores.get(faculty.id, 0),
                eligibility_note="Reassigned via Defense Scheduling"))
        add_log(
            "panel-matching", student.id, workflow_actor_label(reassign_actor),
            data.get("source_reference", ""),
            f"Defense panel reassigned to {len(chosen_faculty)} member(s) from Defense Scheduling",
            "Research Coordinator",
            "; ".join(f"{reassign_roles[i]}: {f.name}" for i, f in enumerate(chosen_faculty)),
        )
        sync_research_progress(student)
        if str(data.get("reassign_only", "")).lower() in {"1", "true", "yes", "on"}:
            return student.id

    preferred_date = parse_date(data["preferred_date"])
    preferred_end_date = parse_date(data.get("preferred_end_date") or data["preferred_date"])
    defense_type = data.get("defense_type", "Title Defense")
    mode = data["mode"]
    venue = data.get("venue", "")
    override_requirements = str(data.get("override_requirements", "")).lower() in {"1", "true", "yes", "on"}
    override_conflicts = str(data.get("override_conflicts", "")).lower() in {"1", "true", "yes", "on"}
    research_case, progress = sync_research_progress(student)
    missing_requirements = [
        item["label"]
        for item in progress["milestone"]["requirements"]
        if item["status"] != "Complete"
        and item["source_type"] not in {"system_title_schedule", "system_proposal_schedule", "system_final_schedule", "system_defense_result"}
    ]
    ethics_pending = [
        item["label"]
        for item in progress["milestone"]["requirements"]
        if item["item_name"] in {"Ethics Clearance", "Ethics clearance status and date"}
        and item["status"] != "Complete"
    ]
    if ethics_pending:
        raise ValueError("The Research Coordinator must review and record the Research Protocol Form 5.2 ethics clearance before Defense Scheduling.")
    if missing_requirements and not override_requirements:
        raise ValueError(
            "Research Gate requirements are still pending: "
            + ", ".join(missing_requirements)
            + ". Review them or confirm the staff override."
        )
    panel = active_panel_assignments(student, progress["gate"])
    if not panel:
        raise ValueError("Complete Panel Matching before creating a defense schedule.")
    panel_ids = [assignment.faculty_id for assignment in panel]
    participants = defense_participants(student, panel)
    required_panel_count = len(panel_roles_for_student(student))
    if len(panel_ids) < required_panel_count:
        raise ValueError(
            f"Panel Matching is incomplete: {len(panel_ids)} of {required_panel_count} required panelists are selected."
        )
    lead_days = defense_lead_days(defense_type)
    lead_ok = preferred_date >= date.today() + timedelta(days=lead_days)
    selected_start = parse_time(data.get("selected_start"))
    selected_end = parse_time(data.get("selected_end"))
    if preferred_end_date < preferred_date:
        raise ValueError("Preferred date window end cannot be before the selected defense date.")
    if selected_start and selected_end and selected_end <= selected_start:
        raise ValueError("Defense end time must be later than the start time.")
    selected_window_ok = False
    matched_count = 0
    if selected_start and selected_end and participants:
        day_context = defense_availability_context(participants, preferred_date, preferred_date)
        matched_count = sum(
            1
            for participant in day_context["participants"]
            if any(
                slot["date"] == preferred_date.isoformat()
                and parse_time(slot["start"]) <= selected_start
                and parse_time(slot["end"]) >= selected_end
                for slot in participant["slots"]
            )
            and not any(
                busy["date"] == preferred_date.isoformat()
                and parse_time(busy["start"]) < selected_end
                and parse_time(busy["end"]) > selected_start
                for busy in participant.get("google_busy", [])
            )
        )
        selected_window_ok = matched_count == len(participants)

    status_reason = []
    availability_conflict = ""
    if not lead_ok:
        status_reason.append(f"{defense_type} needs at least {lead_days} days lead time")
    if not selected_start or not selected_end:
        status_reason.append("select a shared start and end time")
    elif not selected_window_ok:
        availability_conflict = f"only {matched_count} of {len(participants)} participants share that time"
        status_reason.append(availability_conflict)
    conflicts = defense_schedule_conflicts(
        student, panel, preferred_date, selected_start, selected_end, venue, defense_type
    )
    status_reason.extend(conflicts)
    hard_conflicts = []
    if availability_conflict:
        hard_conflicts.append(availability_conflict)
    if has_hard_schedule_conflict(conflicts):
        hard_conflicts.extend(conflicts)
    if hard_conflicts:
        raise ValueError(
            "Schedule unavailable: "
            + " ".join(hard_conflicts)
            + " Choose a conflict-free time where all assigned panelists are available."
        )
    if status_reason and not override_conflicts:
        raise ValueError(
            "Schedule warning: " + " ".join(status_reason) + " Confirm the schedule override to finalize anyway."
        )
    time_label = (
        f"{selected_start.strftime('%I:%M %p')}-{selected_end.strftime('%I:%M %p')}"
        if selected_start and selected_end
        else "time not selected"
    )
    previous_schedule = (
        ScheduleRequest.query.filter_by(student_id=student.id, defense_type=defense_type)
        .order_by(ScheduleRequest.created_at.desc())
        .first()
    )
    gate = RESEARCH_DEFENSE_TYPES_TO_GATES.get(defense_type)
    latest_outcome = latest_defense_outcome(student, gate) if gate else None
    is_failed_stage_retry = bool(previous_schedule and latest_outcome and latest_outcome["result"] == "Failed")
    action_label = "Rescheduled" if is_failed_stage_retry else "Scheduled"
    if previous_schedule and previous_schedule.status in ACTIVE_DEFENSE_STATUSES:
        previous_schedule.status = "Cancelled"
        previous_schedule.conflict_reason = (
            "Superseded by a staff-approved reschedule after a failed defense."
            if is_failed_stage_retry
            else "Superseded by a staff-approved schedule update."
        )
    panel_snapshot = [
        {
            "faculty_id": assignment.faculty_id,
            "name": assignment.faculty.name,
            "role": assignment.panel_role,
            "department": assignment.faculty.college,
            "specialization": assignment.faculty.specialization,
        }
        for assignment in panel
        if assignment.faculty
    ]
    schedule = ScheduleRequest(
        student_id=student.id,
        preferred_date=preferred_date,
        preferred_end_date=preferred_end_date,
        start_time=selected_start,
        end_time=selected_end,
        defense_type=defense_type,
        mode=mode,
        venue=venue,
        status=action_label,
        matched_count=matched_count,
        panel_snapshot=json.dumps(panel_snapshot),
        required_forms_status="Complete" if not missing_requirements else "Staff override",
        conflict_reason="; ".join(status_reason) if status_reason else None,
        notes=(
            f"{action_label}; {defense_type}; {time_label}; "
            f"{'; '.join(status_reason) if status_reason else 'all scheduling checks passed'}; "
            f"{data.get('constraints', '')}"
        )[:260],
        confirmed_at=now_utc(),
    )
    db.session.add(schedule)
    next_owner = "Panel Chair"

    add_log(
        "defense-scheduling",
        student.id,
        "Research Coordinator",
        data.get("source_reference", ""),
        f"{defense_type} schedule {action_label}; {matched_count}/{len(participants)} participant match(es)",
        next_owner,
        f"{preferred_date.isoformat()} {time_label}; {mode}; {venue}; "
        f"{'; '.join(status_reason) if status_reason else 'lead time and availability passed'}",
    )
    sync_research_progress(student)
    return student.id


def handle_practicum(data: MultiDict) -> int:
    student = Student.query.get_or_404(int(data["student_id"]))
    if not student.program.has_practicum:
        raise ValueError("Practicum is available only for programs with practicum requirements.")
    record = latest_practicum_record(student.id)
    if not record:
        record = PracticumRecord(student_id=student.id)
        db.session.add(record)
    apply_practicum_payload(record, data, student)
    requested_status = (data.get("status") or "").strip()
    previous_status = record.status
    transition_comment = workflow_transition_comment(data)
    transition_message_added = False

    if requested_status == "MOA Under Review":
        account = require_workflow_actor("staff")
        if record.status not in {"MOA Submitted", "MOA Received"}:
            raise ValueError("Only a submitted MOA can be forwarded to the Academic Coordinator.")
        record.status = requested_status
        record.moa_status = "Under Review"
        next_owner = "Academic Coordinator"
        add_task(student.id, "Receive and review practicum MOA", "Academic Coordinator", 5, 30)
    elif requested_status == "Practicum In Progress":
        account = require_workflow_actor("academic_coordinator")
        if record.status != "MOA Under Review":
            raise ValueError("The MOA must be forwarded by GS Staff before Academic Coordinator review.")
        record.status = requested_status
        record.moa_status = "Verified"
        next_owner = "Student"
        add_task(student.id, "Complete practicum hours and prepare certificates", "Student", 14, 30)
    elif requested_status == "Documents Under Review":
        account = require_workflow_actor("staff")
        if record.status not in {"Hours Incomplete", "Documents Submitted"}:
            raise ValueError("Only submitted practicum documents can be forwarded to the Academic Coordinator.")
        if not record.certificate_attachment_id:
            raise ValueError("Practicum documents must be submitted before they can be forwarded for review.")
        record.status = "Documents Under Review"
        next_owner = "Academic Coordinator"
        add_task(student.id, "Review practicum certificates and hours", "Academic Coordinator", 5, 45)
    elif requested_status in {"Hours Incomplete", "Additional Certificates Requested"}:
        account = require_workflow_actor("academic_coordinator")
        if record.status != "Documents Under Review":
            raise ValueError("GS Staff must forward the practicum documents before certificates can be reviewed.")
        return_reason = (data.get("return_reason") or transition_comment or data.get("remarks") or "").strip()
        if not return_reason:
            raise ValueError("Enter a reason before requesting additional practicum evidence.")
        record.status = "Additional Certificates Requested"
        record.remarks = "\n".join(part for part in [record.remarks, return_reason] if part)
        workflow_message_record(
            "practicum", student, account, "Student",
            "Please upload the correct document.", return_reason, "return",
            previous_status, record.status, visibility="student_visible",
        )
        transition_message_added = True
        add_task(student.id, "Submit additional practicum certificates", "Student", 7, 45)
        student.risk_level = "Medium"
        next_owner = "Student"
        record.completion_status = "Incomplete - additional evidence required"
    elif requested_status == "Not Accepted - New Organization Required":
        account = require_workflow_actor("academic_coordinator")
        if record.status not in {"Documents Under Review", "Completed"}:
            raise ValueError("Review submitted practicum documents before recording a non-accepted completion.")
        return_reason = (data.get("return_reason") or "").strip()
        if not return_reason:
            raise ValueError("Enter a reason before returning this practicum completion to the student.")
        record.status = requested_status
        record.completion_status = "Not accepted - another organization required"
        if return_reason not in (record.remarks or ""):
            record.remarks = "\n".join(part for part in [record.remarks, return_reason] if part)
        workflow_message_record(
            "practicum", student, account, "Student",
            "Practicum completion was not accepted; another organization may be required",
            return_reason, "return", previous_status, record.status,
            visibility="student_visible",
        )
        transition_message_added = True
        add_task(student.id, "Arrange another practicum organization and submit an updated MOA", "Student", 10, 55)
        student.risk_level = "Medium"
        next_owner = "Student"
    elif requested_status == "Dean Reviewed":
        account = require_workflow_actor("dean")
        record.status = "Dean Reviewed"
        record.dean_reviewed_at = now_utc()
        next_owner = "Graduate School Staff"
    elif requested_status in {"Report Sent to Dean", "Completed"}:
        account = require_workflow_actor("academic_coordinator")
        expected_status = "Completed" if requested_status == "Report Sent to Dean" else None
        if expected_status and record.status != expected_status:
            raise ValueError("Record practicum completion before sending the status report to the Dean.")
        if requested_status == "Completed" and record.status not in {"Documents Under Review", "Practicum In Progress"}:
            raise ValueError("The Academic Coordinator must receive the submitted documents before recording completion.")
        if record.completed_hours < record.required_hours:
            raise ValueError("Practicum cannot be completed until the required hours are met.")
        if record.document_status not in {"Verified", "Complete"} and requested_status == "Report Sent to Dean":
            raise ValueError("Verify the practicum documents before sending the report to the Dean.")
        record.status = requested_status
        if requested_status == "Report Sent to Dean":
            record.report_sent_at = record.report_sent_at or now_utc()
            record.completion_status = "Completed and accepted"
            add_task(student.id, "Review practicum status report", "Dean", 5, 35)
            next_owner = "Dean"
        else:
            record.document_status = "Verified"
            record.completion_status = "Completed hours pending report review"
            next_owner = "Academic Coordinator"
    else:
        raise ValueError("Choose the next available practicum workflow action.")

    result = f"Practicum status updated: {record.status}"
    if transition_comment and not transition_message_added:
        add_transition_comment_message(
            "practicum",
            student,
            account,
            next_owner,
            result,
            transition_comment,
            previous_status,
            record.status,
        )

    add_log(
        "practicum",
        student.id,
        workflow_actor_label(account),
        data.get("source_reference", "") or (record.moa_attachment.original_name if record.moa_attachment else "Practicum workflow"),
        result,
        next_owner,
        workflow_notes_with_comment(practicum_notes(record), transition_comment),
        previous_status=previous_status,
        new_status=record.status,
    )
    return student.id


def handle_withdrawal(data: MultiDict) -> int:
    student = Student.query.get_or_404(int(data["student_id"]))
    application = latest_withdrawal_application(student.id)
    if not application:
        raise ValueError("The student must submit a withdrawal request before staff can process it.")
    apply_withdrawal_payload(application, data)
    previous_status = application.status

    action = (data.get("workflow_action") or "").strip()
    if action == "forward_to_dean":
        account = require_workflow_actor("staff")
        if application.dean_decision != "Pending" or application.status != "Submitted to GS Staff":
            raise ValueError("Only a newly submitted withdrawal request can be forwarded to the Dean.")
        application.status = "Dean Review"
        next_owner = "Dean"
        result = "Withdrawal request recorded and forwarded to the Dean"
        add_task(student.id, "Review withdrawal request", "Dean", 3, 60)
    elif action == "coordinator_follow_through":
        account = require_workflow_actor("academic_coordinator")
        if application.dean_decision != "Approved" or application.status != "Approved - Follow-through":
            raise ValueError("Coordinator follow-through is available only after Dean approval.")
        student.current_stage = "Withdrawal In Progress"
        application.status = "Coordinator Follow-through Complete"
        next_owner = "Graduate School Staff"
        result = "Academic Coordinator follow-through recorded and approval sent to GS Staff"
        add_task(student.id, "Inform student of approved withdrawal and requirements", "Graduate School Staff", 3, 40)
    elif action == "notify_student_of_approval":
        account = require_workflow_actor("staff")
        if application.status != "Coordinator Follow-through Complete":
            raise ValueError("Academic Coordinator follow-through must be complete before informing the student.")
        application.status = "Requirements Pending"
        next_owner = "Student"
        result = "GS Staff informed the student of approval and required completion documents"
        add_task(student.id, "Complete withdrawal requirements", "Student", 7, 40)
    elif action == "verify_requirements":
        account = require_workflow_actor("staff")
        if application.status != "Requirements Submitted" or not application.proof_attachment_id:
            raise ValueError("The student must submit the withdrawal form and proof before staff verification.")
        application.requirement_status = "Complete"
        application.status = "Requirements Verified"
        next_owner = "Graduate School Staff"
        result = "Withdrawal form and proof verified; ready for final GS Staff confirmation"
        add_task(student.id, "Confirm the completed withdrawal", "Graduate School Staff", 3, 45)
    elif action == "return_requirements":
        account = require_workflow_actor("staff")
        if application.status != "Requirements Submitted":
            raise ValueError("Only submitted withdrawal requirements can be returned for completion.")
        return_reason = (data.get("return_reason") or data.get("staff_remarks") or "").strip()
        if not return_reason:
            raise ValueError("Enter a reason before returning withdrawal requirements to the student.")
        application.requirement_status = "Incomplete"
        application.status = "Requirements Pending"
        application.staff_remarks = "\n".join(
            part for part in [application.staff_remarks, return_reason] if part
        )
        workflow_message_record(
            "withdrawal", student, account, "Student",
            "Returned for revision. Please review the comments and resubmit.",
            return_reason, "return", previous_status, application.status,
            visibility="student_visible",
        )
        next_owner = "Student"
        result = "Withdrawal requirements marked incomplete and returned to the student"
        add_task(student.id, "Complete and resubmit withdrawal requirements", "Student", 5, 45)
    elif action == "confirm_withdrawal":
        account = require_workflow_actor("staff")
        if application.status != "Requirements Verified" or application.requirement_status != "Complete":
            raise ValueError("Verify the withdrawal requirements before confirming the withdrawal.")
        application.status = "Withdrawn Confirmed"
        application.completed_at = application.completed_at or now_utc()
        student.standing = "Withdrawn"
        student.current_stage = "Withdrawn"
        student.enrollment_tag = "Withdrawn"
        cancel_active_subject_enrollments(
            student,
            data.get("source_reference", "") or "Withdrawal completed",
        )
        next_owner = "Graduate School Staff"
        result = "GS Staff confirmed the completed withdrawal; student is now withdrawn"
    else:
        raise ValueError("Choose the next available withdrawal workflow action.")

    add_log(
        "withdrawal",
        student.id,
        workflow_actor_label(account),
        data.get("source_reference", "") or "Withdrawal workflow",
        result,
        next_owner,
        withdrawal_notes(application),
        previous_status=previous_status,
        new_status=application.status,
    )
    return student.id


def handle_awol(data: MultiDict) -> int:
    account = require_workflow_actor("staff", "academic_coordinator")
    student = Student.query.get_or_404(int(data["student_id"]))
    action = (data.get("workflow_action") or "").strip()
    staff_notes = (data.get("staff_notes") or "").strip()

    if action == "declare_awol":
        if student.standing in {"Withdrawn", "Graduated"} or student.enrollment_tag in {"LOA", "Completed", "Withdrawn"}:
            raise ValueError("The current student standing conflicts with declaring AWOL. Review the record first.")
        if student.enrollment_tag == "AWOL" or student.standing == "AWOL":
            raise ValueError("This student is already recorded as AWOL.")
        effective_value = (data.get("awol_effective_date") or "").strip()
        effective_date = parse_date(effective_value) if effective_value else date.today()
        review = awol_policy_review(student, {"workflow_action": "declare_awol"})
        item = AwolCase(
            student_id=student.id,
            status="AWOL Declared",
            awol_effective_date=effective_date,
            last_enrolled_term=(data.get("last_enrolled_term") or "").strip() or None,
            years_in_program=review["limits"]["years_in_program"],
            normal_residence_years=review["limits"]["normal_years"],
            absolute_residence_years=review["limits"]["absolute_years"],
            policy_classification="Awaiting return intent",
            dean_decision="Not Submitted",
            staff_notes=staff_notes or None,
        )
        db.session.add(item)
        previous_status = student.enrollment_tag or student.standing
        student.standing = "AWOL"
        student.current_stage = "AWOL"
        student.enrollment_tag = "AWOL"
        student.risk_level = "Critical"
        result = "Student declared AWOL"
        note = f"Effective date: {effective_date.isoformat()}. Last enrolled semester: {item.last_enrolled_term or 'Not recorded'}. {staff_notes}".strip()
        workflow_message_record(
            "awol", student, account, "Student", result,
            "Your registration privileges are restricted while the record is AWOL. Submit a written intent to enroll for Dean endorsement when you are ready to return.",
            "notice", previous_status, "AWOL Declared", status="Sent",
        )
        add_log("awol", student.id, workflow_actor_label(account), "AWOL standing review", result, "Student", note, previous_status=previous_status, new_status="AWOL Declared")

    elif action == "forward_return_to_dean":
        item = AwolCase.query.get_or_404(safe_int(data.get("case_id")))
        if item.student_id != student.id or item.status not in {"Return Submitted", "Returned for Revision"}:
            raise ValueError("Only a submitted AWOL return intent can be forwarded to the Dean.")
        if not item.intent_attachment:
            raise ValueError("The student's written intent to enroll is required before Dean review.")
        review = awol_policy_review(student, {
            "workflow_action": "return_from_awol",
            "application_reference": item.intent_attachment.original_name,
        })
        item.years_in_program = review["limits"]["years_in_program"]
        item.normal_residence_years = review["limits"]["normal_years"]
        item.absolute_residence_years = review["limits"]["absolute_years"]
        item.policy_classification = review["classification"]
        item.refresher_required = review["refresher_required"]
        item.full_reenrollment_required = review["full_reenrollment_required"]
        item.staff_notes = "\n".join(part for part in [item.staff_notes, staff_notes] if part)
        item.status = "Dean Review"
        item.dean_decision = "Pending"
        item.updated_at = now_utc()
        bind_workflow_attachment(item.intent_attachment, item, "Dean Review", account)
        add_task(student.id, "Decide AWOL return intent", "Dean", 3, 70)
        result = "AWOL return forwarded to Dean"
        workflow_message_record(
            "awol", student, account, "Student", result,
            f"Policy classification: {item.policy_classification}. The Dean will decide the return endorsement.",
            "notice", "Return Submitted", "Dean Review", status="Sent",
        )
        add_log("awol", student.id, workflow_actor_label(account), "AWOL return review", result, "Dean", f"{review['summary']} {staff_notes}".strip(), previous_status="Return Submitted", new_status="Dean Review")

    elif action == "record_residency":
        if student.enrollment_tag in {"AWOL", "LOA", "Withdrawn", "Completed"} or student.standing in {"AWOL", "On Leave", "Withdrawn"}:
            raise ValueError("Residency cannot replace AWOL, LOA, withdrawal, or completed standing.")
        reason = (data.get("residency_reason") or "").strip()
        if reason not in RESIDENCY_REASONS:
            raise ValueError("Choose a handbook-supported residency reason.")
        review = awol_policy_review(student, {"workflow_action": "record_residency", "residency_reason": reason})
        if review["recommendation"] != "Eligible for Residency" and not staff_notes:
            raise ValueError("This residency case needs human review. Enter staff notes explaining the verified exception or use LOA.")
        term = AcademicTerm.query.get(safe_int(data.get("term_id"))) if data.get("term_id") else get_active_term()
        if not term:
            raise ValueError("No active semester is available for residency enrollment.")
        existing = ResidencyEnrollment.query.filter_by(student_id=student.id, term_id=term.id, status="Active").first()
        if existing:
            raise ValueError("This student already has active residency enrollment for the selected semester.")
        item = ResidencyEnrollment(
            student_id=student.id,
            term_id=term.id,
            reason=reason,
            policy_status=review["recommendation"],
            staff_notes=staff_notes or None,
        )
        db.session.add(item)
        enrollment = TermEnrollment.query.filter_by(student_id=student.id, term_id=term.id).first()
        if not enrollment:
            enrollment = TermEnrollment(student_id=student.id, term_id=term.id, status="Residency", source_reference="Residency policy review")
            db.session.add(enrollment)
        else:
            enrollment.status = "Residency"
            enrollment.source_reference = "Residency policy review"
            enrollment.confirmed_at = now_utc()
        previous_status = student.enrollment_tag
        student.standing = "Active"
        student.enrollment_tag = "Residency"
        result = "Residency enrollment recorded"
        workflow_message_record(
            "awol", student, account, "Student", result,
            f"Semester: {term.label}. Purpose: {reason}.", "notice", previous_status, "Residency", status="Sent",
        )
        add_log("awol", student.id, workflow_actor_label(account), "Residency policy review", result, "Student", f"{term.label}: {reason}. {review['summary']} {staff_notes}".strip(), previous_status=previous_status, new_status="Residency")

    elif action == "end_residency":
        item = ResidencyEnrollment.query.get_or_404(safe_int(data.get("residency_id")))
        if item.student_id != student.id or item.status != "Active":
            raise ValueError("Choose an active residency enrollment to close.")
        item.status = "Completed"
        item.ended_at = now_utc()
        item.updated_at = now_utc()
        enrollment = TermEnrollment.query.filter_by(student_id=student.id, term_id=item.term_id).first()
        if enrollment and enrollment.status == "Residency":
            enrollment.status = "Completed"
        student.enrollment_tag = "Enrolled"
        student.standing = "Active"
        result = "Residency enrollment closed"
        workflow_message_record("awol", student, account, "Student", result, f"Residency for {item.term.label if item.term else 'the semester'} was closed.", "notice", "Residency", "Active", status="Sent")
        add_log("awol", student.id, workflow_actor_label(account), "Residency record", result, "Academic Coordinator", staff_notes, previous_status="Residency", new_status="Active")

    else:
        raise ValueError("Choose an AWOL or residency workflow action.")

    return student.id


def handle_graduation(data: MultiDict) -> int:
    student = Student.query.get_or_404(int(data["student_id"]))
    endorsement = latest_graduation_endorsement(student.id)
    if not endorsement:
        endorsement = GraduationEndorsement(student_id=student.id)
        db.session.add(endorsement)
    previous_status = endorsement.endorsement_status
    eligibility = graduation_eligibility(student)
    apply_graduation_eligibility(endorsement, eligibility)
    endorsement.review_window = (data.get("review_window") or endorsement.review_window or "Current review window").strip()
    requested_status = (data.get("endorsement_status") or "").strip()
    if data.get("dean_remarks"):
        endorsement.dean_remarks = data.get("dean_remarks")
    if data.get("registrar_status"):
        endorsement.registrar_status = data.get("registrar_status")
    transition_comment = workflow_transition_comment(data)

    if requested_status == "Coursework Review":
        account = require_workflow_actor("staff")
        if endorsement.endorsement_status not in {"For Review", "Not Eligible"}:
            raise ValueError("GS Staff can start coursework review only for a compiled or previously ineligible candidate.")
        endorsement.endorsement_status = "Coursework Review"
        next_owner = "Academic Coordinator"
        result = "Graduation candidate list compiled and sent for coursework review"
        add_task(student.id, "Check graduation coursework completion", "Academic Coordinator", 5, 45)
    elif requested_status == "Research Review":
        account = require_workflow_actor("academic_coordinator")
        if endorsement.endorsement_status != "Coursework Review":
            raise ValueError("GS Staff must send the candidate for coursework review first.")
        if eligibility["coursework_status"] != "Complete":
            endorsement.endorsement_status = "Coursework Incomplete"
            next_owner = "Graduate School Staff"
            result = "Coursework reviewed as incomplete; missing coursework sent to GS Staff"
            add_task(student.id, "List missing graduation coursework and inform the student", "Graduate School Staff", 5, 35)
        else:
            endorsement.endorsement_status = "Research Review"
            next_owner = "Research Coordinator"
            result = "Coursework completion verified and candidate sent for research validation"
            add_task(student.id, "Validate graduation research completion evidence", "Research Coordinator", 5, 45)
    elif requested_status == "Eligibility Confirmed":
        account = require_workflow_actor("research_coordinator")
        if endorsement.endorsement_status != "Research Review":
            raise ValueError("The Academic Coordinator must verify coursework before research validation.")
        if eligibility["research_status"] != "Complete":
            endorsement.endorsement_status = "Research Incomplete"
            next_owner = "Graduate School Staff"
            result = "Research requirements reviewed as incomplete; missing evidence sent to GS Staff"
            add_task(student.id, "List missing graduation research requirements and inform the student", "Graduate School Staff", 5, 35)
        elif eligibility["practicum_status"] not in {"Not Required", "Completed", "Report Sent to Dean", "Dean Reviewed"}:
            endorsement.endorsement_status = "Practicum Incomplete"
            next_owner = eligibility["next_owner"]
            result = "Practicum completion is incomplete or needs verification before endorsement"
            add_task(student.id, eligibility["next_action"], eligibility["next_owner"], 5, 35)
        else:
            endorsement.endorsement_status = "Eligibility Confirmed"
            next_owner = "Graduate School Staff"
            result = "Coursework and research requirements validated for endorsement preparation"
            add_task(student.id, "Prepare graduation endorsement list", "Graduate School Staff", 5, 45)
    elif requested_status == "Not Eligible":
        account = require_workflow_actor("staff")
        if endorsement.endorsement_status not in {"Coursework Incomplete", "Research Incomplete", "Practicum Incomplete"}:
            raise ValueError("A coordinator review must identify missing requirements before GS Staff records ineligibility.")
        if not transition_comment:
            raise ValueError("Enter the student-facing message before marking the graduation application not eligible.")
        endorsement.endorsement_status = "Not Eligible"
        next_owner = "Student"
        result = "Missing graduation requirements listed; student recorded as not eligible"
    elif requested_status == "Endorsement Prepared":
        account = require_workflow_actor("staff")
        if endorsement.endorsement_status != "Eligibility Confirmed":
            raise ValueError("Coursework and research reviews must be complete before preparing the endorsement list.")
        endorsement.endorsement_status = "Endorsement Prepared"
        next_owner = "Graduate School Staff"
        result = "Graduation endorsement list prepared"
    elif requested_status == "Ready for Dean Review":
        account = require_workflow_actor("staff")
        if endorsement.endorsement_status not in {"Endorsement Prepared", "Returned for Revision"}:
            raise ValueError("Prepare or revise the endorsement list before sending it to the Dean.")
        endorsement.endorsement_status = "Ready for Dean Review"
        endorsement.submitted_at = now_utc()
        next_owner = "Dean"
        result = "Graduation endorsement list prepared for Dean review"
        add_task(student.id, "Review graduation endorsement list", "Dean", 5, 55)
    elif requested_status == "Sent to Registrar":
        raise ValueError("Use the export action on a Dean-approved endorsement to hand it off externally. Export is the terminal step.")
    else:
        raise ValueError("Choose the next available graduation workflow action.")

    if transition_comment:
        add_transition_comment_message(
            "graduation",
            student,
            account,
            next_owner,
            result,
            transition_comment,
            previous_status,
            endorsement.endorsement_status,
        )

    add_log(
        "graduation",
        student.id,
        workflow_actor_label(account),
        data.get("source_reference", "") or "Graduation endorsement workflow",
        result,
        next_owner,
        workflow_notes_with_comment(graduation_notes(endorsement), transition_comment),
        previous_status=previous_status,
        new_status=endorsement.endorsement_status,
    )
    return student.id


def reset_workflow_demo_case(slug: str, student: Student) -> dict:
    """Remove one student's demo case without touching academic source data."""
    request_types = {
        "practicum": {"practicum"},
        "withdrawal": {"withdrawal"},
        "graduation": {"graduation", "graduation-endorsement", "graduation-registrar-handoff"},
    }[slug]
    task_terms = {
        "practicum": ("practicum",),
        "withdrawal": ("withdrawal",),
        "graduation": ("graduation", "endorsement list", "endorsed list"),
    }[slug]

    removed_records = 0
    if slug == "practicum":
        records = PracticumRecord.query.filter_by(student_id=student.id).all()
        for record in records:
            record.moa_attachment_id = None
            record.certificate_attachment_id = None
            db.session.delete(record)
        removed_records = len(records)
    elif slug == "withdrawal":
        records = WithdrawalApplication.query.filter_by(student_id=student.id).all()
        for application in records:
            application.request_attachment_id = None
            application.proof_attachment_id = None
            db.session.delete(application)
        removed_records = len(records)

        # Withdrawal is the only reset that may need to restore lifecycle state.
        student.standing = "Active"
        student.enrollment_tag = "Enrolled"
        if student.current_stage in {"Withdrawal In Progress", "Withdrawn"}:
            research_case = (
                ResearchCase.query.filter_by(student_id=student.id)
                .order_by(ResearchCase.opened_at.desc())
                .first()
            )
            stage_by_gate = {
                "Form 1 - Title Defense": "Proposal Development",
                "Form 4 - Proposal Defense Readiness": "Proposal Defense",
                "Final Defense": "Final Defense",
                "Completion Evidence": "Final Defense",
            }
            student.current_stage = stage_by_gate.get(research_case.current_gate, "Coursework") if research_case else "Coursework"
    else:
        records = GraduationEndorsement.query.filter_by(student_id=student.id).all()
        for endorsement in records:
            endorsement.request_attachment_id = None
            db.session.delete(endorsement)
        removed_records = len(records)

    db.session.flush()

    attachments = StudentRequestAttachment.query.filter(
        StudentRequestAttachment.student_id == student.id,
        StudentRequestAttachment.request_type.in_(request_types),
    ).all()
    stored_names = [attachment.stored_name for attachment in attachments]
    for attachment in attachments:
        db.session.delete(attachment)

    removed_tasks = 0
    for task in Task.query.filter_by(student_id=student.id).all():
        if any(term in (task.title or "").lower() for term in task_terms):
            db.session.delete(task)
            removed_tasks += 1

    removed_logs = TransactionLog.query.filter_by(
        student_id=student.id,
        transaction_slug=slug,
    ).delete(synchronize_session=False)
    removed_messages = WorkflowMessage.query.filter_by(
        student_id=student.id,
        transaction_slug=slug,
    ).delete(synchronize_session=False)
    db.session.flush()
    recompute_risk(student)
    return {
        "student_id": student.id,
        "records_removed": removed_records,
        "attachments_removed": len(attachments),
        "tasks_removed": removed_tasks,
        "logs_removed": removed_logs,
        "messages_removed": removed_messages,
        "stored_names": stored_names,
    }


TRANSACTION_HANDLERS = {
    "student-handoff": handle_student_handoff,
    "leave-of-absence": handle_leave_of_absence,
    "readmission": handle_readmission,
    "awol": handle_awol,
    "course-audit": handle_course_audit,
    "research-gate": handle_research_gate,
    "panel-matching": handle_panel_matching,
    "defense-scheduling": handle_defense_scheduling,
    "practicum": handle_practicum,
    "withdrawal": handle_withdrawal,
    "graduation": handle_graduation,
}


# ---------------------------------------------------------------------------
# Domain rules / helpers
# ---------------------------------------------------------------------------
WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
MATCH_STOPWORDS = {
    "about", "after", "against", "also", "among", "based", "between", "could", "from", "have",
    "into", "more", "most", "paper", "papers", "research", "study", "that", "their", "these",
    "this", "through", "using", "were", "what", "when", "where", "which", "with", "would",
    "abstract", "chapter", "concept", "document", "graduate", "introduction", "sample", "submitted", "title",
}
RESEARCH_KEY_PHRASES = [
    "artificial intelligence", "machine learning", "learning analytics", "online learning",
    "student engagement", "learning management system", "financial technology", "e-wallet",
    "savings behavior", "digital health", "medication adherence", "patient compliance",
    "qualitative research", "quantitative research", "mixed methods", "case study",
    "action research", "data analytics", "information systems", "public administration",
]
FACULTY_DEMO_NAMES = [
    "Dr. Adriana Santos",
    "Dr. Benjamin Reyes",
    "Dr. Celeste Tan",
    "Dr. Daniel Uy",
    "Dr. Elise Co",
    "Dr. Francisco Lim",
    "Dr. Gabriela Ong",
    "Dr. Hector Yu",
    "Dr. Irene Flores",
    "Dr. Jonathan Pang",
    "Dr. Miguel Alvarez",
    "Dr. Patricia Bautista",
    "Dr. Ramon Cabrera",
    "Dr. Lara Delos Reyes",
    "Dr. Joshua Escobar",
    "Dr. Nicole Fernandez",
    "Dr. Martin Garcia",
    "Dr. Camille Hernandez",
    "Dr. Rafael Mendoza",
    "Dr. Bianca Villanueva",
    "Dr. Adrian Abad",
    "Dr. Clarisse Bernardo",
    "Dr. Diane Chua",
    "Dr. Enrico Dizon",
    "Dr. Fatima Evangelista",
    "Dr. Gian Francisco",
    "Dr. Hazel Gonzales",
    "Dr. Isabel Jacinto",
    "Dr. Jerome Lacson",
    "Dr. Katrina Navarro",
    "Dr. Lorenzo Aquino",
    "Dr. Marielle Castillo",
    "Dr. Noel Dimaculangan",
    "Dr. Olivia Estrella",
    "Dr. Paolo Fajardo",
    "Dr. Reina Gamboa",
    "Dr. Samuel Hidalgo",
    "Dr. Teresa Ignacio",
    "Dr. Victor Jimenez",
    "Dr. Yasmin Karaan",
    "Dr. Andres Laurel",
    "Dr. Beatrice Mercado",
    "Dr. Carlo Natividad",
    "Dr. Denise Ocampo",
    "Dr. Emmanuel Padilla",
    "Dr. Francesca Quiambao",
    "Dr. Gabriel Ramos",
    "Dr. Helena Salazar",
    "Dr. Ivan Trinidad",
    "Dr. Julia Valdez",
    "Dr. Kenneth Yulo",
    "Dr. Lourdes Zamora",
    "Dr. Mateo Araneta",
    "Dr. Natalia Borja",
    "Dr. Oscar Cardenas",
]


def faculty_working_hours(faculty: Faculty) -> list[dict]:
    rows = sorted(faculty.working_hours, key=lambda row: (row.weekday, row.start_time))
    if not rows:
        return [
            {
                "weekday": weekday,
                "day": WEEKDAY_NAMES[weekday],
                "start": "08:00",
                "end": "17:00",
                "enabled": True,
            }
            for weekday in range(5)
        ] + [
            {
                "weekday": weekday,
                "day": WEEKDAY_NAMES[weekday],
                "start": None,
                "end": None,
                "enabled": False,
            }
            for weekday in range(5, 7)
        ]
    by_day = {row.weekday: row for row in rows}
    return [
        {
            "weekday": weekday,
            "day": WEEKDAY_NAMES[weekday],
            "start": by_day[weekday].start_time.strftime("%H:%M") if weekday in by_day else None,
            "end": by_day[weekday].end_time.strftime("%H:%M") if weekday in by_day else None,
            "enabled": bool(by_day[weekday].enabled) if weekday in by_day else False,
        }
        for weekday in range(7)
    ]


def faculty_contact_email(faculty: Faculty) -> str:
    """Stable demo contact address for legacy call sites."""
    return (faculty.email or default_faculty_email(faculty)).strip().lower()


def faculty_calendar_blocks(faculty: Faculty, start_day: date, end_day: date) -> list[dict]:
    """Google Calendar-shaped local busy events used by profiles and scheduling.

    These records provide a realistic adapter contract until a faculty member's
    live Google Calendar is configured. The first demo profile intentionally
    exposes this mock source in the UI.
    """
    templates = [
        (0, time(10, 0), time(11, 30), "Graduate class", "class"),
        (2, time(13, 0), time(14, 0), "Department meeting", "meeting"),
        (4, time(15, 0), time(16, 30), "Student consultations", "consultation"),
    ]
    if PanelAssignment.query.filter_by(faculty_id=faculty.id).first():
        templates.append((1, time(9, 0), time(11, 0), "Existing panel duty", "panel"))
    events = []
    current = start_day
    # Offset recurring demo blocks so the directory does not show cloned calendars.
    weekday_shift = (faculty.id - 1) % 3
    while current <= end_day:
        for weekday, starts, ends, title, category in templates:
            if current.weekday() == (weekday + weekday_shift) % 5:
                events.append(
                    {
                        "date": iso(current),
                        "start": starts.strftime("%H:%M"),
                        "end": ends.strftime("%H:%M"),
                        "title": title,
                        "category": category,
                        "status": "busy",
                        "source": "mock_google" if faculty.id == 1 else "profile",
                    }
                )
        current += timedelta(days=1)
    return events


def candidate_conflicts_profile_blocks(
    faculty: Faculty,
    day: date,
    start_minutes: int,
    end_minutes: int,
    cache: dict[int, list[dict]],
) -> bool:
    blocks = cache.setdefault(faculty.id, faculty_calendar_blocks(faculty, day, day))
    for block in blocks:
        if block["date"] != iso(day):
            continue
        block_start = parse_time(block["start"])
        block_end = parse_time(block["end"])
        block_start_minutes = block_start.hour * 60 + block_start.minute
        block_end_minutes = block_end.hour * 60 + block_end.minute
        if start_minutes < block_end_minutes and end_minutes > block_start_minutes:
            return True
    return False


def faculty_profile_dict(faculty: Faculty) -> dict:
    payload = faculty_dict(faculty)
    upcoming = (
        FacultyAvailability.query.filter(
            FacultyAvailability.faculty_id == faculty.id,
            FacultyAvailability.available_date >= date.today(),
        )
        .order_by(FacultyAvailability.available_date, FacultyAvailability.start_time)
        .limit(12)
        .all()
    )
    payload["upcoming_availability"] = [
        {
            "date": iso(slot.available_date),
            "start": slot.start_time.strftime("%H:%M"),
            "end": slot.end_time.strftime("%H:%M"),
            "weekend_override": slot.available_date.weekday() >= 5,
        }
        for slot in upcoming
    ]
    assignments = (
        PanelAssignment.query.filter_by(faculty_id=faculty.id)
        .order_by(PanelAssignment.assigned_at.desc())
        .limit(8)
        .all()
    )
    payload["current_assignments"] = []
    for assignment in assignments:
        research_case = (
            ResearchCase.query.filter_by(student_id=assignment.student_id)
            .order_by(ResearchCase.opened_at.desc())
            .first()
        )
        payload["current_assignments"].append(
            {
                "id": assignment.id,
                "student_name": assignment.student.name,
                "research_title": research_case.title if research_case else "Research title pending",
                "panel_role": assignment.panel_role,
                "score": assignment.score,
                "assigned_at": iso(assignment.assigned_at),
            }
        )
    window_end = date.today() + timedelta(days=35)
    payload["calendar_events"] = faculty_calendar_blocks(faculty, date.today(), window_end)
    return payload


def calendar_text(value: str | None) -> str:
    return (value or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def faculty_calendar_ics(faculty: Faculty) -> str:
    slots = (
        FacultyAvailability.query.filter(
            FacultyAvailability.faculty_id == faculty.id,
            FacultyAvailability.available_date >= date.today(),
        )
        .order_by(FacultyAvailability.available_date, FacultyAvailability.start_time)
        .limit(60)
        .all()
    )
    now_stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//USLS Graduate School//Faculty Availability//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{calendar_text(f'{faculty.name} Availability')}",
        f"X-WR-CALDESC:{calendar_text('Faculty availability windows used for defense scheduling.')}",
    ]
    for slot in slots:
        start_dt = datetime.combine(slot.available_date, slot.start_time)
        end_dt = datetime.combine(slot.available_date, slot.end_time)
        stamp = f"{slot.id}-{faculty.id}@usls-gs-demo"
        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:{stamp}",
                f"DTSTAMP:{now_stamp}",
                f"DTSTART:{start_dt.strftime('%Y%m%dT%H%M%S')}",
                f"DTEND:{end_dt.strftime('%Y%m%dT%H%M%S')}",
                f"SUMMARY:{calendar_text(f'{faculty.name} availability')}",
                f"DESCRIPTION:{calendar_text(f'Specialization: {faculty.specialization}')}",
                "STATUS:CONFIRMED",
                "TRANSP:TRANSPARENT",
                "END:VEVENT",
            ]
        )
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def ensure_research_document_checks(student_id: int, gate: str) -> list[DocumentCheck]:
    checks = []
    for item_name in required_documents_for_gate(gate):
        doc = DocumentCheck.query.filter_by(student_id=student_id, gate=gate, item_name=item_name).first()
        if not doc:
            doc = DocumentCheck(
                student_id=student_id,
                gate=gate,
                item_name=item_name,
                status="Missing",
            )
            db.session.add(doc)
            db.session.flush()
        checks.append(doc)
    return checks


def concept_paper_file_count(student_id: int) -> int:
    return (
        ResearchEvidenceFile.query.join(DocumentCheck)
        .filter(
            ResearchEvidenceFile.student_id == student_id,
            DocumentCheck.item_name == "Three concept papers",
        )
        .count()
    )


def concept_paper_package_ready(student_id: int) -> bool:
    return concept_paper_file_count(student_id) >= 3


def revoke_form1_endorsement(student_id: int) -> bool:
    endorsement = Form1Endorsement.query.filter_by(student_id=student_id).first()
    revoked = bool(endorsement)
    if endorsement:
        db.session.delete(endorsement)
    endorsement_doc = DocumentCheck.query.filter_by(
        student_id=student_id,
        gate="Form 1 - Title Defense",
        item_name="Academic Coordinator endorsement/e-signature",
    ).first()
    if endorsement_doc:
        endorsement_doc.status = "Missing"
        endorsement_doc.evidence_reference = None
        endorsement_doc.updated_at = now_utc()
    return revoked


def clean_extracted_text(text: str) -> str:
    # PDF extraction can yield lone surrogate code points that the DB driver cannot
    # encode, and the stored column is a MySQL TEXT (max 65,535 bytes). Drop invalid
    # characters and cap to a UTF-8 byte budget so storage is safe on both backends.
    # The first ~60 KB (title, abstract, introduction, methods) is more than enough
    # for keyword matching.
    text = (text or "").encode("utf-8", "ignore").decode("utf-8", "ignore")
    encoded = text.encode("utf-8")
    if len(encoded) > 60000:
        text = encoded[:60000].decode("utf-8", "ignore")
    return text


def readable_word_count(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text or ""))


def ocr_pdf_text(path: Path) -> str:
    try:
        import fitz
        import pytesseract
        from PIL import Image
    except Exception:
        return ""

    tesseract_cmd = os.getenv("TESSERACT_CMD", "").strip()
    if tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    try:
        document = fitz.open(str(path))
    except Exception:
        return ""

    parts = []
    matrix = fitz.Matrix(PDF_OCR_DPI / 72, PDF_OCR_DPI / 72)
    try:
        for page in document[:PDF_OCR_MAX_PAGES]:
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            image = Image.frombytes("RGB", [pixmap.width, pixmap.height], pixmap.samples)
            page_text = pytesseract.image_to_string(image).strip()
            if page_text:
                parts.append(page_text)
            if readable_word_count("\n".join(parts)) >= 250:
                break
    except Exception:
        return ""
    finally:
        document.close()
    return clean_extracted_text("\n\n".join(parts))


def extract_pdf_text(path: Path) -> str:
    try:
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception:
        text = ""
    text = clean_extracted_text(text)
    if readable_word_count(text) >= PDF_OCR_MIN_WORDS:
        return text
    ocr_text = ocr_pdf_text(path)
    return ocr_text if readable_word_count(ocr_text) > readable_word_count(text) else text


def extract_docx_text(path: Path) -> str:
    try:
        import zipfile
        import xml.etree.ElementTree as ET

        with zipfile.ZipFile(path) as archive:
            xml_data = archive.read("word/document.xml")
        root = ET.fromstring(xml_data)
        namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        return "\n".join(node.text or "" for node in root.findall(".//w:t", namespace))
    except Exception:
        return ""


def extract_supported_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return extract_pdf_text(path)
    if suffix == ".docx":
        return extract_docx_text(path)
    if suffix in {".txt", ".md"}:
        try:
            return path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            return ""
    return ""


CONCEPT_PAPER_FALLBACK_GUIDE = """
Concept paper compliance checklist: the paper should present a clear research title,
background or rationale, statement of the problem, research objectives or questions,
scope or significance, methodology or proposed methods, and references or citations.
The proposal should be coherent enough for Academic Coordinator review and panel
matching. Missing major sections should be returned for revision.
"""


CONCEPT_PAPER_RULES = [
    {
        "id": "title",
        "label": "Research title",
        "required": True,
        "severity": "major",
        "patterns": [r"\btitle\b", r"\bresearch title\b"],
        "keywords": ["title"],
    },
    {
        "id": "background",
        "label": "Background / rationale",
        "required": True,
        "severity": "major",
        "patterns": [r"\bbackground\b", r"\brationale\b", r"\bintroduction\b"],
        "keywords": ["background", "rationale", "introduction"],
    },
    {
        "id": "problem",
        "label": "Statement of the problem",
        "required": True,
        "severity": "major",
        "patterns": [r"\bstatement of the problem\b", r"\bproblem statement\b", r"\bresearch problem\b"],
        "keywords": ["problem"],
    },
    {
        "id": "objectives",
        "label": "Objectives / research questions",
        "required": True,
        "severity": "major",
        "patterns": [r"\bobjectives?\b", r"\bresearch questions?\b", r"\bspecific objectives?\b"],
        "keywords": ["objective", "objectives", "questions"],
    },
    {
        "id": "methodology",
        "label": "Proposed methodology",
        "required": True,
        "severity": "major",
        "patterns": [r"\bmethodology\b", r"\bmethods?\b", r"\bresearch design\b", r"\bdata collection\b"],
        "keywords": ["methodology", "method", "design", "data"],
    },
    {
        "id": "significance",
        "label": "Significance / scope",
        "required": False,
        "severity": "minor",
        "patterns": [r"\bsignificance\b", r"\bscope\b", r"\bdelimitation"],
        "keywords": ["significance", "scope"],
    },
    {
        "id": "references",
        "label": "References / citations",
        "required": True,
        "severity": "major",
        "patterns": [r"\breferences\b", r"\bbibliography\b", r"\bworks cited\b", r"\bet al\.", r"\(\d{4}\)"],
        "keywords": ["references", "bibliography", "citation"],
    },
]


def concept_paper_source_chunks() -> list[dict]:
    sources = []
    if CONCEPT_PAPER_RAG_SOURCE.exists():
        for path in sorted(CONCEPT_PAPER_RAG_SOURCE.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in {".pdf", ".docx", ".txt", ".md"}:
                continue
            text = extract_supported_text(path).strip()
            if text:
                sources.append({"source": path.name, "text": text})
    if not sources:
        sources.append({"source": "Built-in concept paper checklist", "text": CONCEPT_PAPER_FALLBACK_GUIDE})

    chunks = []
    for source in sources:
        cleaned = re.sub(r"\s+", " ", source["text"]).strip()
        if not cleaned:
            continue
        parts = re.split(r"(?<=[.!?])\s+", cleaned)
        current = []
        for sentence in parts:
            current.append(sentence)
            if sum(len(item) for item in current) >= 600:
                chunks.append({"source": source["source"], "text": " ".join(current)[:900]})
                current = []
        if current:
            chunks.append({"source": source["source"], "text": " ".join(current)[:900]})
    return chunks or [{"source": "Built-in concept paper checklist", "text": CONCEPT_PAPER_FALLBACK_GUIDE.strip()}]


def retrieve_concept_paper_sources(query: str, limit: int = 4) -> list[dict]:
    query_terms = set(_tokenize(query + " concept paper requirements objectives methodology references"))
    scored = []
    for chunk in concept_paper_source_chunks():
        chunk_terms = set(_tokenize(chunk["text"]))
        score = len(query_terms & chunk_terms)
        if "concept" in chunk_terms:
            score += 2
        if "paper" in chunk_terms:
            score += 1
        scored.append((score, chunk))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [
        {"id": f"concept-source-{idx}", "title": "Concept Paper Guideline", "source": chunk["source"], "text": chunk["text"]}
        for idx, (_score, chunk) in enumerate(scored[:limit])
    ]


def evaluate_concept_paper_text(text: str, file_name: str = "Concept paper") -> dict:
    normalized = re.sub(r"\s+", " ", text or "").strip()
    lower = normalized.lower()
    word_count = len(re.findall(r"\b\w+\b", normalized))
    rule_results = []
    missing_major = 0
    present_count = 0
    for rule in CONCEPT_PAPER_RULES:
        found = any(re.search(pattern, lower, flags=re.IGNORECASE) for pattern in rule["patterns"])
        evidence = ""
        if found:
            present_count += 1
            for keyword in rule["keywords"]:
                match = re.search(rf".{{0,80}}\b{re.escape(keyword)}\b.{{0,120}}", normalized, flags=re.IGNORECASE)
                if match:
                    evidence = match.group(0).strip()
                    break
        elif rule["required"] and rule["severity"] == "major":
            missing_major += 1
        rule_results.append({
            "id": rule["id"],
            "label": rule["label"],
            "required": rule["required"],
            "status": "Present" if found else "Missing" if rule["required"] else "Not evident",
            "evidence": evidence,
        })

    if word_count < 250:
        status = "Not Enough Evidence"
    elif missing_major == 0:
        status = "Compliant"
    else:
        status = "Needs Revision"
    score = max(0, min(100, round((present_count / len(CONCEPT_PAPER_RULES)) * 100)))
    missing_labels = [item["label"] for item in rule_results if item["status"] == "Missing"]
    if status == "Compliant":
        summary = f"{file_name} includes the major concept-paper sections expected for review."
    elif status == "Not Enough Evidence":
        summary = f"{file_name} does not contain enough readable text for a reliable compliance check."
    else:
        summary = f"{file_name} needs revision before endorsement. Missing: {', '.join(missing_labels)}."
    citations = retrieve_concept_paper_sources(normalized[:1200] or file_name)
    return {
        "status": status,
        "score": score,
        "summary": summary,
        "word_count": word_count,
        "checks": rule_results,
        "missing": missing_labels,
        "citations": citations,
        "mode": "concept-paper-rag",
    }


def apply_concept_paper_evaluation(evidence: ResearchEvidenceFile) -> dict:
    result = evaluate_concept_paper_text(evidence.extracted_text or "", evidence.original_name)
    evidence.compliance_status = result["status"]
    evidence.compliance_score = result["score"]
    evidence.compliance_summary = result["summary"]
    evidence.compliance_result_json = json.dumps(result)
    return result


def parse_title_defense_text(text: str) -> dict:
    # Pull the labelled fields out of a Form 1 (Application for Title Defense) so the
    # student portal can pre-fill the research-gate form. Tuned to the prepared sample
    # ("Research Title:", "Objectives:", "Research Keywords:", "Proposed Panel
    # Specialization:") but tolerant of spacing and ordering.
    flat = re.sub(r"\s+", " ", text or "").strip()

    def grab(label: str, stop: str) -> str:
        match = re.search(rf"{label}\s*:?\s*(.+?)\s*(?:{stop})", flat, re.IGNORECASE)
        return re.sub(r"\s+", " ", match.group(1)).strip() if match else ""

    title = grab(r"RESEARCH TITLE", r"OBJECTIVES|RESEARCH KEYWORDS|KEYWORDS|PROPOSED PANEL|PREPARED BY|$")
    objectives = grab(r"OBJECTIVES", r"RESEARCH KEYWORDS|KEYWORDS|PROPOSED PANEL|PREPARED BY|$")
    keywords = grab(r"(?:RESEARCH )?KEYWORDS", r"PROPOSED PANEL|PREPARED BY|$")
    panel = grab(r"PROPOSED PANEL SPECIALIZATION", r"PREPARED BY|$")
    return {
        "research_title": title,
        "objectives": objectives,
        "keywords": keywords,
        "panel_specialization": panel,
    }


def store_research_evidence(
    student: Student,
    gate: str,
    item_name: str,
    uploaded,
    doc: DocumentCheck | None = None,
) -> ResearchEvidenceFile:
    original_name = secure_filename(uploaded.filename or "")
    if not original_name.lower().endswith(".pdf"):
        raise ValueError("Research evidence must be uploaded as a PDF file.")
    if uploaded.mimetype and uploaded.mimetype not in {"application/pdf", "application/octet-stream"}:
        raise ValueError("Research evidence must be a valid PDF file.")
    doc = doc or next(
        item for item in ensure_research_document_checks(student.id, gate) if item.item_name == item_name
    )
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    stored_name = f"{student.id}-{uuid4().hex}.pdf"
    target = UPLOAD_ROOT / stored_name
    uploaded.save(target)
    if target.stat().st_size == 0:
        target.unlink(missing_ok=True)
        raise ValueError("The uploaded PDF is empty.")
    if target.stat().st_size > 25 * 1024 * 1024:
        target.unlink(missing_ok=True)
        raise ValueError("Research evidence PDFs must be 25 MB or smaller.")
    with target.open("rb") as stream:
        if stream.read(5) != b"%PDF-":
            target.unlink(missing_ok=True)
            raise ValueError("The selected file is not a valid PDF.")
    extracted_text = extract_pdf_text(target)
    if item_name == "Proposal manuscript" and looks_like_proposal_endorsement(extracted_text):
        target.unlink(missing_ok=True)
        raise ValueError("Upload the proposal manuscript body, not the proposal endorsement form.")
    evidence = ResearchEvidenceFile(
        student_id=student.id,
        document_check_id=doc.id,
        original_name=original_name,
        stored_name=stored_name,
        mime_type="application/pdf",
        extracted_text=extracted_text,
    )
    db.session.add(evidence)
    doc.status = "Submitted"
    doc.evidence_reference = original_name
    doc.updated_at = now_utc()
    db.session.flush()
    return evidence


def replace_research_evidence_files(doc: DocumentCheck, keep_evidence: ResearchEvidenceFile) -> list[Path]:
    replaced_paths: list[Path] = []
    old_files = ResearchEvidenceFile.query.filter(
        ResearchEvidenceFile.student_id == keep_evidence.student_id,
        ResearchEvidenceFile.document_check_id == doc.id,
        ResearchEvidenceFile.id != keep_evidence.id,
    ).all()
    for old_file in old_files:
        replaced_paths.append(UPLOAD_ROOT / old_file.stored_name)
        db.session.delete(old_file)
    doc.evidence_reference = keep_evidence.original_name
    doc.updated_at = now_utc()
    db.session.flush()
    return replaced_paths


def store_student_request_attachment(
    student: Student,
    request_type: str,
    uploaded,
    account: UserAccount | None = None,
) -> StudentRequestAttachment:
    original_name = secure_filename(uploaded.filename or "")
    if not original_name.lower().endswith(".pdf"):
        raise ValueError("The application must be uploaded as a PDF file.")
    REQUEST_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    stored_name = f"{student.id}-{request_type}-{uuid4().hex}.pdf"
    target = REQUEST_UPLOAD_ROOT / stored_name
    uploaded.save(target)
    if target.stat().st_size == 0 or target.stat().st_size > 25 * 1024 * 1024:
        target.unlink(missing_ok=True)
        raise ValueError("The application PDF must be between 1 byte and 25 MB.")
    with target.open("rb") as stream:
        if stream.read(5) != b"%PDF-":
            target.unlink(missing_ok=True)
            raise ValueError("The selected file is not a valid PDF.")
    attachment = StudentRequestAttachment(
        student_id=student.id,
        request_type=request_type,
        uploaded_by_user_id=account.id if account else None,
        uploaded_by_name=account.full_name if account else student.name,
        uploaded_by_role=ROLE_LABELS.get(account.role, account.role) if account else "Student",
        original_name=original_name,
        stored_name=stored_name,
        mime_type="application/pdf",
    )
    db.session.add(attachment)
    db.session.flush()
    return attachment


def request_attachment_from_payload(
    student: Student,
    request_type: str,
    data: MultiDict,
) -> StudentRequestAttachment | None:
    try:
        attachment_id = int(data.get("attachment_id") or 0)
    except (TypeError, ValueError):
        return None
    if not attachment_id:
        return None
    return StudentRequestAttachment.query.filter_by(
        id=attachment_id,
        student_id=student.id,
        request_type=request_type,
    ).first()


def matching_tokens(value: str) -> list[str]:
    return [
        token
        for token in re.findall(r"[a-z][a-z0-9-]{3,}", (value or "").lower())
        if token not in MATCH_STOPWORDS
    ]


def extract_research_phrases(text: str, limit: int = 14) -> list[str]:
    tokens = matching_tokens(text)
    lowered = re.sub(r"\s+", " ", (text or "").lower())
    recognized = [phrase for phrase in RESEARCH_KEY_PHRASES if phrase in lowered]
    frequent_terms = [token for token, _count in Counter(tokens).most_common(limit) if token not in recognized]
    return (recognized + frequent_terms)[:limit]


def faculty_specialization_token_stats() -> tuple[Counter, int]:
    """Token document-frequency across active faculty specializations.

    This keeps matching field-neutral: terms that appear in many faculty
    profiles are treated as broad context, while distinctive specialization
    terms carry more ranking weight for every discipline.
    """
    document_frequency = Counter()
    total_profiles = 0
    for faculty in Faculty.query.filter_by(active=True).all():
        tokens = set(matching_tokens(faculty.specialization or ""))
        if not tokens:
            continue
        total_profiles += 1
        document_frequency.update(tokens)
    return document_frequency, total_profiles


def specialization_token_weight(token: str, document_frequency: Counter, total_profiles: int) -> float:
    if not total_profiles:
        return 1.0
    frequency_ratio = document_frequency.get(token, 0) / total_profiles
    if frequency_ratio <= 0.08:
        return 2.0
    if frequency_ratio <= 0.18:
        return 1.5
    if frequency_ratio <= 0.35:
        return 1.0
    return 0.45


def faculty_matching_profiles() -> list[dict]:
    rows = []
    for faculty in Faculty.query.filter_by(active=True).all():
        profile_text = faculty.specialization or ""
        rows.append({
            "id": faculty.id,
            "name": faculty.name,
            "specialization": faculty.specialization or "",
            "college": faculty.college or "",
            "tokens": set(matching_tokens(profile_text)),
            "text": profile_text,
        })
    return rows


def retrieve_faculty_for_panel_matching(paper_text: str, faculty_profiles: list[dict], limit: int = 8) -> list[dict]:
    paper_counts = Counter(matching_tokens(paper_text))
    token_frequency, total_profiles = faculty_specialization_token_stats()
    ranked = []
    for profile in faculty_profiles:
        overlap = [token for token, _count in paper_counts.most_common() if token in profile["tokens"]]
        phrase_hits = [
            phrase for phrase in RESEARCH_KEY_PHRASES
            if phrase in (paper_text or "").lower() and set(matching_tokens(phrase)).intersection(profile["tokens"])
        ]
        score = (
            sum(min(paper_counts[token], 3) * specialization_token_weight(token, token_frequency, total_profiles) for token in overlap[:10])
            + len(phrase_hits) * 4
        )
        if score:
            ranked.append({**profile, "retrieval_score": score, "matched_terms": (phrase_hits + overlap)[:8]})
    return sorted(ranked, key=lambda item: item["retrieval_score"], reverse=True)[:limit]


def parse_panel_matching_rag_response(response_text: str) -> dict:
    text_value = (response_text or "").strip()
    match = re.search(r"\{.*\}", text_value, flags=re.S)
    if not match:
        return {}
    try:
        payload = json.loads(match.group(0))
    except Exception:
        return {}
    keywords = [str(item).strip().lower() for item in payload.get("keywords", []) if str(item).strip()]
    faculty_matches = []
    for item in payload.get("faculty_matches", []):
        try:
            faculty_id = int(item.get("faculty_id"))
        except Exception:
            continue
        faculty_matches.append({
            "faculty_id": faculty_id,
            "rationale": str(item.get("rationale", "")).strip()[:220],
            "matched_terms": [str(term).strip().lower() for term in item.get("matched_terms", []) if str(term).strip()][:8],
        })
    return {
        "keywords": keywords[:18],
        "summary": str(payload.get("summary", "")).strip()[:500],
        "faculty_matches": faculty_matches,
    }


def generate_local_panel_matching_rag(paper_text: str, retrieved_faculty: list[dict], limit: int = 18) -> dict:
    base_keywords = extract_research_phrases(paper_text, limit)
    faculty_terms = []
    faculty_matches = []
    for profile in retrieved_faculty:
        terms = profile.get("matched_terms", [])[:6]
        faculty_terms.extend(terms)
        faculty_matches.append({
            "faculty_id": profile["id"],
            "faculty_name": profile["name"],
            "rationale": "Retrieved from faculty specialization overlap with the uploaded manuscript body.",
            "matched_terms": terms,
        })
    keywords = []
    for term in base_keywords:
        cleaned = re.sub(r"\s+", " ", term).strip().lower()
        if cleaned and cleaned not in keywords:
            keywords.append(cleaned)
    return {
        "keywords": keywords[:limit],
        "summary": paper_excerpt(paper_text, 420),
        "faculty_matches": faculty_matches,
        "mode": "local-rag",
    }


def generate_panel_matching_keywords_with_rag(paper_text: str, retrieved_faculty: list[dict], limit: int = 18) -> dict:
    local_payload = generate_local_panel_matching_rag(paper_text, retrieved_faculty, limit)
    if not (os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_AI_STUDIO_API_KEY")):
        return local_payload
    snippets = "\n".join(
        f"- faculty_id={item['id']}; {item['name']}; {item['specialization']}; matched_terms={', '.join(item.get('matched_terms', []))}"
        for item in retrieved_faculty
    )
    prompt = (
        "Analyze the uploaded research manuscript body and the retrieved faculty specialization snippets. "
        "Return only compact JSON with keys: summary, keywords, faculty_matches. "
        "keywords must be research-domain terms useful for panel matching. faculty_matches must include "
        "faculty_id, matched_terms, and rationale. Do not use filenames or title metadata.\n\n"
        f"Manuscript body excerpt:\n{paper_excerpt(paper_text, 5000)}\n\n"
        f"Retrieved faculty specialization snippets:\n{snippets}"
    )
    try:
        response = _load_rag_chat_engine().chat(prompt)
        parsed = parse_panel_matching_rag_response(str(response))
        if parsed.get("keywords"):
            parsed["mode"] = "document-rag"
            parsed["faculty_matches"] = parsed.get("faculty_matches") or local_payload["faculty_matches"]
            parsed["summary"] = parsed.get("summary") or local_payload["summary"]
            return parsed
    except Exception:
        pass
    return {**local_payload, "mode": "local-rag-fallback"}


def paper_excerpt(text: str, limit: int = 220) -> str:
    cleaned = re.sub(r"\s+", " ", text or "").strip()
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[:limit].rsplit(" ", 1)[0] + "..."


PANEL_MATCHING_SOURCE_ITEMS = {
    "Form 1 - Title Defense": ["Three concept papers"],
    "Form 4 - Proposal Defense Readiness": ["Proposal manuscript"],
    "Final Defense": ["Final manuscript"],
}


def panel_matching_body_text(text: str, research_title: str = "") -> str:
    title_key = identity_text(research_title)
    kept = []
    for raw_line in (text or "").splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            continue
        lower = line.lower()
        line_key = identity_text(line)
        if title_key and line_key == title_key:
            continue
        if lower.startswith(("research title", "title:", "paper title", "manuscript title", "file name", "filename")):
            continue
        if any(marker in lower for marker in ("endorsement for proposal defense", "endorsed by", "adviser endorsement", "e-signature", "signature")):
            continue
        if len(line) <= 80 and re.fullmatch(r"[A-Z0-9 .,:;()/-]+", line):
            continue
        kept.append(line)
    return "\n".join(kept).strip()


def looks_like_proposal_endorsement(text: str) -> bool:
    lower = (text or "").lower()
    endorsement_hits = sum(
        marker in lower
        for marker in (
            "endorsement for proposal defense",
            "form 4",
            "adviser endorsement",
            "recommending approval",
            "e-signature",
        )
    )
    manuscript_hits = sum(
        marker in lower
        for marker in ("abstract", "introduction", "methodology", "review of related literature", "references")
    )
    return endorsement_hits >= 2 and manuscript_hits < 2


def panel_matching_source_files(student: Student, gate: str) -> tuple[list[ResearchEvidenceFile], list[str]]:
    source_items = PANEL_MATCHING_SOURCE_ITEMS.get(gate) or ["Three concept papers"]
    files = (
        ResearchEvidenceFile.query.join(DocumentCheck)
        .filter(
            ResearchEvidenceFile.student_id == student.id,
            DocumentCheck.gate == gate,
            DocumentCheck.item_name.in_(source_items),
        )
        .order_by(ResearchEvidenceFile.uploaded_at.desc())
        .all()
    )
    return files, source_items


def research_matching_profile(student: Student) -> dict:
    research_case = (
        ResearchCase.query.filter_by(student_id=student.id)
        .order_by(ResearchCase.opened_at.desc())
        .first()
    )
    research_case, progress = sync_research_progress(student)
    gate = progress["gate"]
    source_files, source_items = panel_matching_source_files(student, gate)
    required_count = sum(
        research_requirement_presentation(gate, item)["required_file_count"]
        for item in source_items
    )
    analyzed_files = source_files[:required_count]
    # Legacy uploads may predate the PDF parser dependency. Re-read their
    # actual PDF bodies instead of falling back to filenames or metadata.
    for item in analyzed_files:
        if (item.extracted_text or "").strip():
            continue
        stored_path = UPLOAD_ROOT / item.stored_name
        if stored_path.exists():
            extracted = extract_pdf_text(stored_path)
            if extracted.strip():
                item.extracted_text = extracted
    title = research_case.title if research_case else ""
    source_documents = []
    for item in analyzed_files:
        raw_text = item.extracted_text or ""
        body_text = panel_matching_body_text(raw_text, title)
        if gate == "Form 4 - Proposal Defense Readiness" and looks_like_proposal_endorsement(raw_text):
            body_text = ""
        source_documents.append((item, body_text))
    readable_files = [(item, body_text) for item, body_text in source_documents if body_text.strip()]
    ethics_record = None
    if gate == "Form 4 - Proposal Defense Readiness":
        ethics_record = DocumentCheck.query.filter_by(
            student_id=student.id,
            gate=gate,
            item_name="Ethics clearance status and date",
        ).first()
    ethics_ready = gate != "Form 4 - Proposal Defense Readiness" or bool(ethics_record and ethics_record.status == "Complete")
    # Ground matching in PDF body text only. Filenames, research titles, and
    # program labels are display metadata and never enter keyword extraction.
    paper_text = "\n".join(body_text for _item, body_text in readable_files)
    query_text = paper_text.strip()
    retrieved_faculty = retrieve_faculty_for_panel_matching(paper_text, faculty_matching_profiles())
    rag_payload = generate_panel_matching_keywords_with_rag(paper_text, retrieved_faculty, 18) if query_text else {
        "keywords": [],
        "summary": "",
        "faculty_matches": [],
        "mode": "waiting",
    }
    keywords = rag_payload.get("keywords") or extract_research_phrases(paper_text, 16)
    ready = len(analyzed_files) >= required_count and len(readable_files) >= required_count and ethics_ready
    blocked_reason = ""
    if len(analyzed_files) < required_count:
        blocked_reason = f"Upload the required panel-matching source first: {', '.join(source_items)}."
    elif len(readable_files) < required_count:
        blocked_reason = "Panel matching requires readable PDF body text from the uploaded manuscript source."
    elif not ethics_ready:
        blocked_reason = "The Research Coordinator must record the Research Protocol Form 5.2 ethics clearance before Panel Matching."
    return {
        "research_title": title,
        "gate": gate,
        "source_items": source_items,
        "source_label": ", ".join(source_items),
        "required_file_count": required_count,
        "document_count": len(analyzed_files),
        "readable_document_count": len(readable_files),
        "ethics_ready": ethics_ready,
        "blocked_reason": blocked_reason,
        "concept_paper_count": len(analyzed_files),
        "concept_papers": [
            {
                "id": item.id,
                "name": item.original_name,
                "url": f"/api/research-evidence/{item.id}/file",
                "extracted": bool(body_text.strip()),
                "keywords": extract_research_phrases(body_text, 6),
                "excerpt": paper_excerpt(body_text),
            }
            for item, body_text in source_documents
        ],
        "keywords": keywords,
        "rag_summary": rag_payload.get("summary", ""),
        "rag_faculty_matches": rag_payload.get("faculty_matches", []),
        "rag_mode": rag_payload.get("mode", "local-rag"),
        "query_text": query_text,
        "readable_paper_count": len(readable_files),
        "ready": ready,
        "source": f"{', '.join(source_items)} body text only; research titles and filenames excluded" if ready else blocked_reason or "Waiting for readable PDF body text",
    }


def current_panel_gate(student: Student) -> str:
    _research_case, progress = sync_research_progress(student)
    return progress["gate"]


def active_panel_assignments(student: Student, gate: str | None = None) -> list[PanelAssignment]:
    gate = gate or current_panel_gate(student)
    return (
        PanelAssignment.query.filter_by(student_id=student.id, gate=gate)
        .order_by(PanelAssignment.score.desc())
        .all()
    )


def clear_panel_for_research_gate(student: Student, gate: str | None = None) -> int:
    gate = gate or current_panel_gate(student)
    return PanelAssignment.query.filter_by(student_id=student.id, gate=gate).delete()


def defense_faculty_directory() -> list[dict]:
    # Every defense-eligible faculty (active + has an active faculty login). Used by
    # Defense Scheduling so staff can reassign the panel beyond the matched shortlist.
    entries = []
    for faculty in Faculty.query.filter_by(active=True).order_by(Faculty.name).all():
        if not UserAccount.query.filter_by(faculty_id=faculty.id, role="faculty", active=True).first():
            continue
        entries.append({
            "faculty_id": faculty.id,
            "name": faculty.name,
            "specialization": faculty.specialization,
            "college": faculty.college,
            "upcoming_windows": FacultyAvailability.query.filter(
                FacultyAvailability.faculty_id == faculty.id,
                FacultyAvailability.available_date >= date.today(),
            ).count(),
            "workload": PanelAssignment.query.filter_by(faculty_id=faculty.id).count(),
        })
    return entries


def split_items(value: str) -> list[str]:
    # Accept either comma-separated or newline-separated checklist additions.
    return [item.strip() for item in value.replace(",", "\n").splitlines() if item.strip()]


def parse_date(value: str | None) -> date:
    if not value:
        return date.today()
    return datetime.strptime(value, "%Y-%m-%d").date()


def parse_time(value: str | None) -> time | None:
    if not value:
        return None
    return datetime.strptime(value, "%H:%M").time()


def defense_participants(student: Student, assignments: list[PanelAssignment]) -> list[dict]:
    participants = []
    seen = set()
    adviser = Faculty.query.filter_by(name=student.adviser_name, active=True).first()
    if adviser:
        participants.append({"faculty": adviser, "role": "Research Adviser"})
        seen.add(adviser.id)
    for assignment in assignments:
        if assignment.faculty and assignment.faculty.id not in seen:
            participants.append({"faculty": assignment.faculty, "role": assignment.panel_role})
            seen.add(assignment.faculty.id)
    return participants


ACTIVE_DEFENSE_STATUSES = ("Confirmed", "Scheduled", "Rescheduled")
PENDING_DEFENSE_STATUSES = ("Needs Availability", "Pending scheduling")


def schedule_panel_ids(schedule: ScheduleRequest) -> set[int]:
    try:
        snapshot = json.loads(schedule.panel_snapshot or "[]")
    except (TypeError, json.JSONDecodeError):
        snapshot = []
    ids = {int(item["faculty_id"]) for item in snapshot if item.get("faculty_id")}
    if not ids:
        ids = {
            row.faculty_id
            for row in PanelAssignment.query.filter_by(
                student_id=schedule.student_id,
                gate=RESEARCH_DEFENSE_TYPES_TO_GATES.get(schedule.defense_type or "", "Form 1 - Title Defense"),
            ).all()
        }
    other_student = Student.query.get(schedule.student_id)
    adviser = Faculty.query.filter_by(name=other_student.adviser_name, active=True).first() if other_student else None
    if adviser:
        ids.add(adviser.id)
    return ids


def defense_schedule_conflicts(
    student: Student,
    assignments: list[PanelAssignment],
    day: date,
    selected_start: time | None,
    selected_end: time | None,
    venue: str,
    defense_type: str | None = None,
) -> list[str]:
    if not selected_start or not selected_end:
        return []
    participant_ids = {item["faculty"].id for item in defense_participants(student, assignments)}
    conflicts = []
    candidates = ScheduleRequest.query.filter(
        ScheduleRequest.preferred_date == day,
        ScheduleRequest.status.in_(ACTIVE_DEFENSE_STATUSES),
    ).all()
    for schedule in candidates:
        if schedule.student_id == student.id and schedule.defense_type == defense_type:
            continue
        if not schedule.start_time or not schedule.end_time:
            continue
        if selected_start >= schedule.end_time or selected_end <= schedule.start_time:
            continue
        other = schedule.student
        label = f"{other.name} ({other.student_number})" if other else f"schedule #{schedule.id}"
        if schedule.student_id == student.id:
            conflicts.append(f"Same-student overlap: {schedule.defense_type or 'another defense'} is already scheduled for that time.")
        shared = participant_ids & schedule_panel_ids(schedule)
        if shared:
            names = [Faculty.query.get(faculty_id).name for faculty_id in shared if Faculty.query.get(faculty_id)]
            conflicts.append(f"Panel conflict with {label}: {', '.join(names)} already scheduled.")
        if venue.strip() and schedule.venue.strip().casefold() == venue.strip().casefold():
            conflicts.append(f"Venue conflict with {label}: {schedule.venue} is already booked.")
    return conflicts


def has_hard_schedule_conflict(conflicts: list[str]) -> bool:
    return any(
        conflict.startswith(("Same-student overlap:", "Panel conflict with", "Venue conflict with"))
        for conflict in conflicts
    )


def faculty_calendar_id(faculty: Faculty) -> str | None:
    raw = os.getenv("GOOGLE_CALENDAR_IDS_JSON", "").strip()
    mapping = {}
    if raw:
        try:
            mapping = json.loads(raw)
        except json.JSONDecodeError:
            mapping = {}
    slug = re.sub(r"[^A-Z0-9]+", "_", faculty.name.upper()).strip("_")
    return (
        mapping.get(str(faculty.id))
        or mapping.get(faculty.name)
        or mapping.get(slug)
        or os.getenv(f"GOOGLE_CALENDAR_ID_{faculty.id}")
        or os.getenv(f"GOOGLE_CALENDAR_ID_{slug}")
    )


def google_calendar_configured(faculty: Faculty) -> bool:
    return bool(os.getenv("GOOGLE_CALENDAR_ACCESS_TOKEN") and faculty_calendar_id(faculty))


def local_calendar_bounds(start_day: date, end_day: date) -> tuple[datetime, datetime]:
    local_tz = timezone(timedelta(hours=8))
    start_dt = datetime.combine(start_day, time.min).replace(tzinfo=local_tz)
    end_dt = datetime.combine(end_day + timedelta(days=1), time.min).replace(tzinfo=local_tz)
    return start_dt, end_dt


def google_freebusy_lookup(faculty: Faculty, start_day: date, end_day: date) -> dict:
    calendar_id = faculty_calendar_id(faculty)
    token = os.getenv("GOOGLE_CALENDAR_ACCESS_TOKEN", "").strip()
    if not calendar_id:
        return {"configured": False, "calendar_id": None, "busy": [], "error": None}
    if not token:
        return {"configured": False, "calendar_id": calendar_id, "busy": [], "error": "Missing GOOGLE_CALENDAR_ACCESS_TOKEN"}

    start_dt, end_dt = local_calendar_bounds(start_day, end_day)
    body = json.dumps(
        {
            "timeMin": start_dt.isoformat(),
            "timeMax": end_dt.isoformat(),
            "timeZone": os.getenv("GOOGLE_CALENDAR_TIMEZONE", "Asia/Manila"),
            "items": [{"id": calendar_id}],
        }
    ).encode("utf-8")
    req = Request(
        "https://www.googleapis.com/calendar/v3/freeBusy",
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        return {"configured": True, "calendar_id": calendar_id, "busy": [], "error": f"Google Calendar HTTP {exc.code}"}
    except (URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
        return {"configured": True, "calendar_id": calendar_id, "busy": [], "error": f"Google Calendar unavailable: {exc}"}

    calendar = (payload.get("calendars") or {}).get(calendar_id) or {}
    if calendar.get("errors"):
        reason = calendar["errors"][0].get("reason") or "calendar error"
        return {"configured": True, "calendar_id": calendar_id, "busy": [], "error": f"Google Calendar {reason}"}
    busy = []
    local_tz = timezone(timedelta(hours=8))
    for item in calendar.get("busy", []):
        try:
            start = datetime.fromisoformat(item["start"].replace("Z", "+00:00")).astimezone(local_tz)
            end = datetime.fromisoformat(item["end"].replace("Z", "+00:00")).astimezone(local_tz)
        except (KeyError, ValueError):
            continue
        busy.append({"start": start, "end": end})
    return {"configured": True, "calendar_id": calendar_id, "busy": busy, "error": None}


def google_busy_by_faculty(participants: list[dict], start_day: date, end_day: date) -> dict[int, dict]:
    return {
        participant["faculty"].id: google_freebusy_lookup(participant["faculty"], start_day, end_day)
        for participant in participants
    }


def slot_conflicts_google_busy(slot: FacultyAvailability, busy_items: list[dict]) -> bool:
    slot_start = datetime.combine(slot.available_date, slot.start_time).replace(tzinfo=timezone(timedelta(hours=8)))
    slot_end = datetime.combine(slot.available_date, slot.end_time).replace(tzinfo=timezone(timedelta(hours=8)))
    return any(slot_start < item["end"] and slot_end > item["start"] for item in busy_items)


def google_busy_payload_for_day(busy_items: list[dict], day: date) -> list[dict]:
    result = []
    for item in busy_items:
        if item["start"].date() <= day <= item["end"].date():
            result.append(
                {
                    "date": iso(day),
                    "start": item["start"].strftime("%H:%M"),
                    "end": item["end"].strftime("%H:%M"),
                }
            )
    return result


def candidate_conflicts_google_busy(day: date, start_minutes: int, end_minutes: int, busy_items: list[dict]) -> bool:
    local_tz = timezone(timedelta(hours=8))
    start_dt = datetime.combine(day, time(start_minutes // 60, start_minutes % 60)).replace(tzinfo=local_tz)
    end_dt = datetime.combine(day, time(end_minutes // 60, end_minutes % 60)).replace(tzinfo=local_tz)
    return any(start_dt < item["end"] and end_dt > item["start"] for item in busy_items)


def defense_availability_context(
    participants: list[dict],
    window_start: date,
    window_end: date,
    duration_minutes: int = 120,
) -> dict:
    if not participants:
        return {
            "window_start": iso(window_start),
            "window_end": iso(window_end),
            "duration_minutes": duration_minutes,
            "participants": [],
            "dates": [],
            "possible_slots": [],
        }

    participant_ids = [participant["faculty"].id for participant in participants]
    participant_faculty = {participant["faculty"].id: participant["faculty"] for participant in participants}
    google_busy = google_busy_by_faculty(participants, window_start, window_end)
    profile_blocks = {
        faculty_id: faculty_calendar_blocks(faculty, window_start, window_end)
        for faculty_id, faculty in participant_faculty.items()
    }
    rows = (
        FacultyAvailability.query.filter(
            FacultyAvailability.faculty_id.in_(participant_ids),
            FacultyAvailability.available_date >= window_start,
            FacultyAvailability.available_date <= window_end,
        )
        .order_by(
            FacultyAvailability.available_date,
            FacultyAvailability.start_time,
        )
        .all()
    )
    slots_by_faculty: dict[int, list[FacultyAvailability]] = {faculty_id: [] for faculty_id in participant_ids}
    dates = set()
    for row in rows:
        if row.available_date.weekday() < 5:
            profile = next(
                (
                    item
                    for item in faculty_working_hours(row.faculty)
                    if item["weekday"] == row.available_date.weekday()
                ),
                None,
            )
            if not profile or not profile["enabled"]:
                continue
            profile_start = parse_time(profile["start"])
            profile_end = parse_time(profile["end"])
            if row.start_time < profile_start or row.end_time > profile_end:
                continue
        slots_by_faculty[row.faculty_id].append(row)
        dates.add(row.available_date)

    possible_slots = []
    for day in sorted(dates):
        day_rows = {
            faculty_id: [slot for slot in slots_by_faculty[faculty_id] if slot.available_date == day]
            for faculty_id in participant_ids
        }
        if any(not faculty_slots for faculty_slots in day_rows.values()):
            continue
        for start_minutes in range(8 * 60, 18 * 60 - duration_minutes + 1, 30):
            end_minutes = start_minutes + duration_minutes
            all_available = all(
                any(
                    slot.start_time.hour * 60 + slot.start_time.minute <= start_minutes
                    and slot.end_time.hour * 60 + slot.end_time.minute >= end_minutes
                    and not candidate_conflicts_google_busy(
                        day,
                        start_minutes,
                        end_minutes,
                        google_busy.get(faculty_id, {}).get("busy", []),
                    )
                    and not candidate_conflicts_profile_blocks(
                        participant_faculty[faculty_id],
                        day,
                        start_minutes,
                        end_minutes,
                        profile_blocks,
                    )
                    for slot in faculty_slots
                )
                for faculty_id, faculty_slots in day_rows.items()
            )
            if all_available:
                possible_slots.append(
                    {
                        "date": iso(day),
                        "start": f"{start_minutes // 60:02d}:{start_minutes % 60:02d}",
                        "end": f"{end_minutes // 60:02d}:{end_minutes % 60:02d}",
                        "matched_count": len(participants),
                    }
                )

    return {
        "window_start": iso(window_start),
        "window_end": iso(window_end),
        "duration_minutes": duration_minutes,
        "participants": [
            {
                "faculty_id": participant["faculty"].id,
                "name": participant["faculty"].name,
                "role": participant["role"],
                "college": participant["faculty"].college,
                "specialization": participant["faculty"].specialization,
                "working_hours": faculty_working_hours(participant["faculty"]),
                "calendar_connected": google_busy.get(participant["faculty"].id, {}).get("configured", False),
                "calendar_status": (
                    google_busy.get(participant["faculty"].id, {}).get("error")
                    or ("Google Calendar checked" if google_busy.get(participant["faculty"].id, {}).get("configured") else "Profile availability only")
                ),
                "google_busy": [
                    busy
                    for day in sorted(dates)
                    for busy in google_busy_payload_for_day(
                        google_busy.get(participant["faculty"].id, {}).get("busy", []),
                        day,
                    )
                ],
                "profile_busy": profile_blocks.get(participant["faculty"].id, []),
                "slots": [
                    {
                        "date": iso(slot.available_date),
                        "start": slot.start_time.strftime("%H:%M"),
                        "end": slot.end_time.strftime("%H:%M"),
                        "weekend_override": slot.available_date.weekday() >= 5,
                        "blocked_by_google": slot_conflicts_google_busy(
                            slot,
                            google_busy.get(participant["faculty"].id, {}).get("busy", []),
                        ),
                    }
                    for slot in slots_by_faculty[participant["faculty"].id]
                ],
            }
            for participant in participants
        ],
        "dates": [iso(day) for day in sorted(dates)],
        "possible_slots": possible_slots,
    }


RESEARCH_MILESTONES = {
    "Form 1 - Title Defense": {
        "label": "Title Defense Application",
        "short_label": "Title Defense",
        "description": "Complete Form 1 and upload three concept papers. Academic Coordinator endorsement and panel matching then update automatically.",
    },
    "Form 4 - Proposal Defense Readiness": {
        "label": "Proposal Defense Readiness",
        "short_label": "Proposal Defense",
        "description": "Submit the adviser-signed proposal manuscript, adviser-signed endorsements, ethics clearance, and consultation evidence. Panel matching and scheduling open only after the Research Coordinator records the ethics clearance.",
    },
    "Final Defense": {
        "label": "Final Defense Readiness",
        "short_label": "Final Defense",
        "description": "Submit the final defense manuscript and final defense endorsement. The assigned adviser signs the uploaded files in-system before staff verifies the confirmed defense schedule.",
    },
    "Completion Evidence": {
        "label": "Final Submission and Completion",
        "short_label": "Completion",
        "description": "Submit the final manuscript, approvals, similarity certificate, and completion forms for final verification.",
    },
}

RESEARCH_GATE_DEFENSE_TYPES = {
    "Form 1 - Title Defense": "Title Defense",
    "Form 4 - Proposal Defense Readiness": "Proposal Defense",
    "Final Defense": "Final Defense",
}

RESEARCH_DEFENSE_TYPES_TO_GATES = {value: key for key, value in RESEARCH_GATE_DEFENSE_TYPES.items()}

RESEARCH_DEFENSE_RESULT_ITEMS = {
    "Form 1 - Title Defense": "Title defense result",
    "Form 4 - Proposal Defense Readiness": "Proposal defense result",
    "Final Defense": "Final defense result",
}

RESEARCH_DEFENSE_SCHEDULE_ITEMS = {
    "Form 1 - Title Defense": "Confirmed title defense schedule",
    "Form 4 - Proposal Defense Readiness": "Agreed defense schedule in Form 4",
    "Final Defense": "Agreed final defense schedule",
}

# The first incomplete milestone is the student's detected Research Gate stage.
# Graduation still treats Title/Proposal/Final as the formal research gates;
# the student portal adds Completion Evidence as the post-defense submission
# step that Graduation reads separately.
RESEARCH_STAGE_SEQUENCE = [
    ("Title Defense", "Form 1 - Title Defense"),
    ("Proposal Defense", "Form 4 - Proposal Defense Readiness"),
    ("Final Defense", "Final Defense"),
]
RESEARCH_PORTAL_STAGE_SEQUENCE = [
    *RESEARCH_STAGE_SEQUENCE,
    ("Completion", "Completion Evidence"),
]

# Uploaded manuscript items that must be approved by the student's assigned
# adviser. An approval is tied to the exact evidence-file row, so replacing a
# manuscript automatically returns the new file to the adviser queue.
ADVISER_APPROVAL_DOCUMENTS = {
    "Form 4 - Endorsement for Proposal Defense",
    "Proposal manuscript",
    "Adviser e-signature/endorsement",
    "Form 4 - Endorsement for Final Defense",
    "Final manuscript",
}

RESEARCH_REQUIREMENTS = {
    "Form 1 - Application for Title Defense": {
        "label": "Form 1 application",
        "description": "The completed application for title defense.",
        "source_type": "student_upload",
        "required_file_count": 1,
    },
    "Three concept papers": {
        "label": "Concept papers",
        "description": "Upload each of the three concept papers as a separate PDF. These files are used for panel matching.",
        "source_type": "student_upload",
        "required_file_count": 3,
    },
    "Academic Coordinator endorsement/e-signature": {
        "label": "Academic Coordinator endorsement",
        "description": "Recorded by the Academic Coordinator after reviewing the submission.",
        "source_type": "coordinator_endorsement",
        "required_file_count": 0,
    },
    "Confirmed title defense schedule": {
        "label": "Confirmed title defense schedule",
        "description": "Added automatically after staff confirms a shared title defense schedule.",
        "source_type": "system_title_schedule",
        "required_file_count": 0,
    },
    "Title defense result": {
        "label": "Title defense result",
        "description": "Recorded by GS Staff after the scheduled title defense.",
        "source_type": "system_defense_result",
        "required_file_count": 0,
    },
    "Recommended panel set": {
        "label": "Panel assignment",
        "description": "Generated after the Research Coordinator completes Panel Matching.",
        "source_type": "system_panel",
        "required_file_count": 0,
    },
    "Form 4 - Endorsement for Proposal Defense": {
        "label": "Proposal defense endorsement",
        "description": "Upload the proposal defense endorsement. The assigned adviser reviews and signs the exact uploaded file in-system.",
        "source_type": "student_upload",
        "required_file_count": 1,
    },
    "Proposal manuscript": {
        "label": "Proposal manuscript",
        "description": "Upload the proposal manuscript. The assigned adviser reviews and signs the exact uploaded file in-system.",
        "source_type": "student_upload",
        "required_file_count": 1,
    },
    "Ethics Clearance": {
        "label": "Research Protocol Form 5.2 ethics clearance",
        "description": "Upload the ethics clearance form signed by the Ethics Office.",
        "source_type": "student_upload",
        "required_file_count": 1,
    },
    "Ethics clearance status and date": {
        "label": "Ethics clearance status and date",
        "description": "Recorded by the Research Coordinator after previewing the signed ethics clearance.",
        "source_type": "ethics_clearance_record",
        "required_file_count": 0,
    },
    "Adviser e-signature/endorsement": {
        "label": "Proposal manuscript endorsement",
        "description": "Upload the proposal manuscript endorsement. The assigned adviser reviews and signs the exact uploaded file in-system.",
        "source_type": "student_upload",
        "required_file_count": 1,
    },
    "Form 4.1 Statistical Consultation Form or qualitative exemption": {
        "label": "Statistical consultation form or qualitative exemption",
        "description": "Upload Form 4.1 or the approved qualitative-research exemption.",
        "source_type": "student_upload",
        "required_file_count": 1,
    },
    "Agreed defense schedule in Form 4": {
        "label": "Confirmed proposal defense schedule",
        "description": "Added automatically after staff confirms a shared panel schedule.",
        "source_type": "system_proposal_schedule",
        "required_file_count": 0,
    },
    "Proposal defense result": {
        "label": "Proposal defense result",
        "description": "Recorded by GS Staff after the scheduled proposal defense.",
        "source_type": "system_defense_result",
        "required_file_count": 0,
    },
    "Form 4 - Endorsement for Final Defense": {
        "label": "Final defense endorsement",
        "description": "Upload the final defense endorsement. The assigned adviser reviews and signs the exact uploaded file in-system.",
        "source_type": "student_upload",
        "required_file_count": 1,
    },
    "Final manuscript": {
        "label": "Final defense manuscript",
        "description": "Upload the final defense manuscript. The assigned adviser must sign the exact uploaded file before it is complete.",
        "source_type": "student_upload",
        "required_file_count": 1,
    },
    "Agreed final defense schedule": {
        "label": "Confirmed final defense schedule",
        "description": "Added automatically after staff confirms a shared final defense schedule.",
        "source_type": "system_final_schedule",
        "required_file_count": 0,
    },
    "Final defense result": {
        "label": "Final defense result",
        "description": "Recorded by GS Staff after the scheduled final defense.",
        "source_type": "system_defense_result",
        "required_file_count": 0,
    },
    "Soft copy of final manuscript": {
        "label": "Final manuscript for archiving",
        "description": "The final corrected manuscript for the Graduate School archive.",
        "source_type": "student_upload",
        "required_file_count": 1,
    },
    "Panel approval emails": {
        "label": "Panel approval confirmations",
        "description": "Combine the panel approval emails or confirmations into one PDF.",
        "source_type": "student_upload",
        "required_file_count": 1,
    },
    "Turnitin Certificate with SIR not more than 15%": {
        "label": "Turnitin certificate (SIR 15% or below)",
        "description": "Upload the final Turnitin certificate showing the required similarity result.",
        "source_type": "student_upload",
        "required_file_count": 1,
    },
    "Form 9 - Editor Certification": {
        "label": "Form 9 editor certification",
        "description": "The signed editor certification.",
        "source_type": "student_upload",
        "required_file_count": 1,
    },
    "Form 10 - Approval Sheet": {
        "label": "Form 10 approval sheet",
        "description": "The completed and signed approval sheet.",
        "source_type": "student_upload",
        "required_file_count": 1,
    },
}


def research_requirement_presentation(gate: str, item_name: str) -> dict | None:
    if gate not in RESEARCH_MILESTONES:
        return None
    return RESEARCH_REQUIREMENTS.get(item_name, {
        "label": item_name,
        "description": "Research milestone requirement.",
        "source_type": "student_upload",
        "required_file_count": 1,
    })


def research_student_uploads_ready(student: Student, gate: str) -> bool:
    docs = {
        doc.item_name: doc
        for doc in DocumentCheck.query.filter_by(student_id=student.id, gate=gate).all()
    }
    for item_name in required_documents_for_gate(gate):
        presentation = research_requirement_presentation(gate, item_name)
        if presentation["source_type"] != "student_upload":
            continue
        doc = docs.get(item_name)
        if not doc or len(doc.evidence_files) < presentation["required_file_count"]:
            return False
    return True


def research_milestone_submission(student: Student, gate: str) -> TransactionLog | None:
    return (
        TransactionLog.query.filter(
            TransactionLog.student_id == student.id,
            TransactionLog.transaction_slug == "research-gate",
            TransactionLog.actor_role == "Student",
            TransactionLog.result == f"{gate} application submitted",
        )
        .order_by(TransactionLog.created_at.desc())
        .first()
    )


def research_milestone_reviewed_after_submission(student: Student, gate: str) -> bool:
    submission = research_milestone_submission(student, gate)
    if not submission:
        return False
    review = (
        TransactionLog.query.filter(
            TransactionLog.student_id == student.id,
            TransactionLog.transaction_slug == "research-gate",
            TransactionLog.actor_role == "Research Coordinator",
            TransactionLog.result.like(f"{gate}:%"),
        )
        .order_by(TransactionLog.created_at.desc())
        .first()
    )
    return bool(
        review
        and review.created_at
        and submission.created_at
        and review.created_at >= submission.created_at
    )


def research_requirement_state(
    student: Student | None,
    gate: str,
    item_name: str,
    doc: DocumentCheck | None = None,
) -> dict:
    presentation = research_requirement_presentation(gate, item_name)
    if not presentation:
        return {"status": doc.status if doc else "Missing", "status_label": doc.status if doc else "Missing"}
    if student and not comprehensive_exam_eligibility(student)["research_allowed"]:
        return {"status": "Locked", "status_label": "Locked until comprehensive exam is passed"}
    source_type = presentation["source_type"]
    files = doc.evidence_files if doc else []
    if source_type == "student_upload":
        enough_files = len(files) >= presentation["required_file_count"]
        if not enough_files:
            return {"status": "Missing", "status_label": "Upload required"}
        if item_name in ADVISER_APPROVAL_DOCUMENTS:
            latest_file = sorted(files, key=lambda item: item.uploaded_at or now_utc(), reverse=True)[0]
            approval = AdviserDocumentApproval.query.filter_by(evidence_file_id=latest_file.id).first()
            if not approval or approval.status != "Signed":
                return {"status": "Submitted", "status_label": "Pending adviser signature"}
        if doc and doc.status == "Complete":
            if item_name == "Ethics Clearance":
                return {"status": "Complete", "status_label": doc.evidence_reference or "Cleared"}
            return {"status": "Complete", "status_label": "Verified"}
        if doc and doc.status in {"Returned", "Not cleared"}:
            return {"status": "Submitted", "status_label": doc.evidence_reference or doc.status}
        return {"status": "Submitted", "status_label": "Submitted for review"}
    if source_type == "ethics_clearance_record":
        clearance = DocumentCheck.query.filter_by(
            student_id=student.id,
            gate=gate,
            item_name="Ethics Clearance",
        ).first() if student else None
        complete = bool(clearance and clearance.status == "Complete")
        return {
            "status": "Complete" if complete else "Pending",
            "status_label": clearance.evidence_reference if complete and clearance.evidence_reference else "Pending Research Coordinator record",
        }
    if source_type == "system_panel":
        complete = bool(student) and len(active_panel_assignments(student, gate)) >= len(panel_roles_for_student(student))
        return {"status": "Complete" if complete else "Pending", "status_label": "Completed" if complete else "Pending panel matching"}
    if source_type == "coordinator_endorsement":
        endorsement = Form1Endorsement.query.filter_by(student_id=student.id).first() if student else None
        complete = bool(
            endorsement
            and endorsement.status == "Endorsed"
            and student
            and concept_paper_package_ready(student.id)
        )
        return {"status": "Complete" if complete else "Pending", "status_label": "Endorsed" if complete else "Pending"}
    if source_type in {"system_title_schedule", "system_proposal_schedule", "system_final_schedule"}:
        complete = bool(student and active_schedule_for_gate(student, gate))
        return {"status": "Complete" if complete else "Pending", "status_label": "Completed" if complete else "Pending confirmed schedule"}
    if source_type == "system_defense_result":
        outcome = latest_defense_outcome(student, gate) if student else None
        if outcome and outcome["result"] == "Passed":
            return {"status": "Complete", "status_label": "Passed"}
        if outcome:
            label = outcome["result"]
            if outcome["result"] in {"Failed", "For resubmission"}:
                label += " - resubmit requirements"
            return {"status": "Pending", "status_label": label}
        schedule_complete = bool(student and active_schedule_for_gate(student, gate))
        return {
            "status": "Pending",
            "status_label": "Awaiting defense result" if schedule_complete else "Pending confirmed schedule",
        }
    if not student or not research_student_uploads_ready(student, gate):
        return {"status": "Pending", "status_label": "Waiting for student files"}
    if not research_milestone_submission(student, gate):
        return {"status": "Pending", "status_label": "Waiting for student submission"}
    if not research_milestone_reviewed_after_submission(student, gate):
        return {"status": "Pending", "status_label": "Pending staff verification"}
    complete = bool(doc and doc.status in {"Complete", "Verified Complete"})
    return {"status": "Complete" if complete else "Pending", "status_label": "Verified by staff" if complete else "Pending staff verification"}


def research_milestone_payload(student: Student, gate: str) -> dict:
    docs = {
        doc.item_name: doc
        for doc in DocumentCheck.query.filter_by(student_id=student.id, gate=gate).all()
    }
    requirements = []
    for item_name in required_documents_for_gate(gate):
        doc = docs.get(item_name)
        presentation = research_requirement_presentation(gate, item_name)
        state = research_requirement_state(student, gate, item_name, doc)
        files = sorted(doc.evidence_files, key=lambda item: item.uploaded_at or now_utc(), reverse=True) if doc else []
        requirement_payload = {
            "id": doc.id if doc else None,
            "item_name": item_name,
            "label": presentation["label"],
            "description": presentation["description"],
            "source_type": presentation["source_type"],
            "student_upload": presentation["source_type"] == "student_upload",
            "required_file_count": presentation["required_file_count"],
            "file_count": len(files),
            "status": state["status"],
            "status_label": state["status_label"],
            "template_url": f"/api/research-gate/template?student_id={student.id}&gate={quote_plus(gate)}&item_name={quote_plus(item_name)}",
            "files": [
                {
                    "id": item.id,
                    "name": item.original_name,
                    "mime_type": item.mime_type,
                    "uploaded_at": iso(item.uploaded_at),
                    "url": f"/api/research-evidence/{item.id}/file",
                    "compliance_status": item.compliance_status,
                    "compliance_score": item.compliance_score,
                    "compliance_summary": item.compliance_summary,
                    "compliance": json.loads(item.compliance_result_json) if item.compliance_result_json else None,
                    "adviser_approval": adviser_approval_dict(
                        AdviserDocumentApproval.query.filter_by(evidence_file_id=item.id).first()
                    ),
                }
                for item in files
            ],
        }
        if item_name in ADVISER_APPROVAL_DOCUMENTS:
            latest_file = files[0] if files else None
            approval = (
                AdviserDocumentApproval.query.filter_by(evidence_file_id=latest_file.id).first()
                if latest_file else None
            )
            requirement_payload["adviser_signature_required"] = True
            requirement_payload["adviser_approval"] = adviser_approval_dict(approval)
        requirements.append(requirement_payload)
    upload_requirements = [item for item in requirements if item["student_upload"]]
    return {
        "value": gate,
        **RESEARCH_MILESTONES[gate],
        "requirements": requirements,
        "student_uploads_ready": all(item["status"] != "Missing" for item in upload_requirements),
        "student_missing_count": sum(item["status"] == "Missing" for item in upload_requirements),
        "overall_complete": all(item["status"] == "Complete" for item in requirements),
    }


def research_stage_status(milestone: dict) -> str:
    requirements = milestone["requirements"]
    if milestone["overall_complete"]:
        return "Complete"
    if any(item["source_type"] == "system_defense_result" and item["status_label"].startswith("Failed") for item in requirements):
        return "Defense Failed - Resubmit Requirements"
    if any(item["status"] == "Missing" for item in requirements if item["student_upload"]):
        return "Missing Requirements"
    if any(item["status"] == "Submitted" for item in requirements):
        return "Awaiting Review"
    return "Pending Staff Action"


def detected_research_progress(student: Student) -> dict:
    stages = []
    detected_index = len(RESEARCH_PORTAL_STAGE_SEQUENCE) - 1
    for index, (stage_name, gate) in enumerate(RESEARCH_PORTAL_STAGE_SEQUENCE):
        ensure_research_document_checks(student.id, gate)
        milestone = research_milestone_payload(student, gate)
        stage = {
            "name": stage_name,
            "gate": gate,
            "complete": milestone["overall_complete"],
            "status": research_stage_status(milestone),
        }
        stages.append(stage)
        if not milestone["overall_complete"]:
            detected_index = index
            break
    # Include later stages in the progress rail without treating them as active.
    for stage_name, gate in RESEARCH_PORTAL_STAGE_SEQUENCE[len(stages):]:
        stages.append({"name": stage_name, "gate": gate, "complete": False, "status": "Locked"})
    detected = stages[detected_index]
    milestone = research_milestone_payload(student, detected["gate"])
    return {
        "stage": detected["name"],
        "gate": detected["gate"],
        "status": detected["status"],
        "stage_index": detected_index,
        "stages": stages,
        "milestone": milestone,
    }


def sync_research_progress(student: Student, submitted_title: str = "") -> tuple[ResearchCase, dict]:
    prerequisite = comprehensive_exam_eligibility(student)
    if not prerequisite["research_allowed"]:
        research_case = (
            ResearchCase.query.filter_by(student_id=student.id)
            .order_by(ResearchCase.opened_at.desc())
            .first()
        )
        locked_milestone = {
            "value": "Form 1 - Title Defense",
            **RESEARCH_MILESTONES["Form 1 - Title Defense"],
            "requirements": [],
            "student_uploads_ready": False,
            "student_missing_count": 0,
            "overall_complete": False,
        }
        return research_case, {
            "stage": "Title Defense",
            "gate": "Form 1 - Title Defense",
            "status": "Locked - comprehensive exam not passed",
            "stage_index": 0,
            "stages": [
                {"name": name, "gate": gate, "complete": False, "status": "Locked"}
                for name, gate in RESEARCH_PORTAL_STAGE_SEQUENCE
            ],
            "milestone": locked_milestone,
            "prerequisite": prerequisite,
        }
    progress = detected_research_progress(student)
    research_case = (
        ResearchCase.query.filter_by(student_id=student.id)
        .order_by(ResearchCase.opened_at.desc())
        .first()
    )
    clean_title = re.sub(r"\s+", " ", submitted_title or "").strip()[:220]
    if not research_case:
        research_case = ResearchCase(
            student_id=student.id,
            case_type=research_case_type(student),
            title=clean_title or "Research title pending Form 1 submission",
            current_gate=progress["gate"],
            status=(
                "Verified Complete"
                if progress["gate"] == "Completion Evidence" and progress["status"] == "Complete"
                else progress["status"]
            ),
            adviser_name=student.adviser_name,
        )
        db.session.add(research_case)
    else:
        # Only student form/document data may replace the displayed title.
        if clean_title:
            research_case.title = clean_title
        research_case.current_gate = progress["gate"]
        research_case.status = (
            "Verified Complete"
            if progress["gate"] == "Completion Evidence" and progress["status"] == "Complete"
            else progress["status"]
        )
        research_case.adviser_name = student.adviser_name

    lifecycle_stage = {
        "Title Defense": "Proposal Development",
        "Proposal Defense": "Proposal Defense",
        "Final Defense": "Final Defense",
        "Completion": "Completed" if progress["status"] == "Complete" else "Final Defense",
    }[progress["stage"]]
    if student.standing == "Active" and student.current_stage != "Completed":
        student.current_stage = lifecycle_stage
    return research_case, progress


def required_documents_for_gate(gate: str) -> list[str]:
    # Prototype research protocol checklist. The Research Gate workflow uses
    # these items as the source of truth for missing/complete evidence.
    if gate == "Form 1 - Title Defense":
        return [
            "Form 1 - Application for Title Defense",
            "Three concept papers",
            "Academic Coordinator endorsement/e-signature",
            "Confirmed title defense schedule",
            "Title defense result",
        ]
    if gate == "Form 4 - Proposal Defense Readiness":
        return [
            "Proposal manuscript",
            "Ethics Clearance",
            "Ethics clearance status and date",
            "Recommended panel set",
            "Form 4 - Endorsement for Proposal Defense",
            "Form 4.1 Statistical Consultation Form or qualitative exemption",
            "Adviser e-signature/endorsement",
            "Agreed defense schedule in Form 4",
            "Proposal defense result",
        ]
    if gate == "Final Defense":
        return [
            "Form 4 - Endorsement for Final Defense",
            "Final manuscript",
            "Agreed final defense schedule",
            "Final defense result",
        ]
    return [
        "Soft copy of final manuscript",
        "Panel approval emails",
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
        "Form 4 - Endorsement for Proposal Defense": ["form 4", "endorsement for proposal", "adviser signed form 4"],
        "Proposal manuscript": ["proposal manuscript", "proposal paper", "proposal draft", "adviser signed proposal manuscript"],
        "Ethics Clearance": ["ethics clearance", "rerc clearance", "research protocol form 5.2"],
        "Ethics clearance status and date": ["ethics status", "clearance date", "cleared"],
        "Adviser e-signature/endorsement": ["adviser endorsement", "adviser e-signature", "endorsed by adviser", "adviser signed proposal manuscript endorsement"],
        "Form 4.1 Statistical Consultation Form or qualitative exemption": [
            "form 4.1",
            "statistical consultation",
            "qualitative exemption",
            "statistician",
        ],
        "Agreed defense schedule in Form 4": ["agreed schedule", "schedule in form 4", "defense schedule"],
        "Form 4 - Endorsement for Final Defense": ["form 4", "endorsement for final", "final defense endorsement", "adviser signed final defense endorsement", "advisor signed final defense endorsement"],
        "Final manuscript": ["final manuscript", "final paper", "closed-door manuscript"],
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


def latest_defense_outcome(student: Student, gate: str, schedule_id: int | None = None) -> dict | None:
    defense_type = RESEARCH_GATE_DEFENSE_TYPES.get(gate)
    if not student or not defense_type:
        return None
    verdict_query = DefenseVerdict.query.filter_by(student_id=student.id, gate=gate)
    if schedule_id:
        verdict_query = verdict_query.filter_by(schedule_request_id=schedule_id)
    verdict = verdict_query.order_by(DefenseVerdict.submitted_at.desc()).first()
    if verdict:
        return {
            "result": verdict.result,
            "defense_type": verdict.defense_type,
            "gate": verdict.gate,
            "recorded_at": iso(verdict.submitted_at),
            "notes": verdict.remarks,
            "verdict": defense_verdict_dict(verdict),
        }
    # Backward-compatible read of legacy staff-recorded demo outcomes. New
    # verdicts are accepted only through the faculty chair endpoint.
    log = (
        TransactionLog.query.filter_by(
            transaction_slug="research-gate",
            student_id=student.id,
            source_reference=gate,
        )
        .filter(TransactionLog.result.in_([f"{defense_type}: Passed", f"{defense_type}: Failed"]))
        .order_by(TransactionLog.created_at.desc())
        .first()
    )
    if not log:
        return None
    return {
        "result": "Passed" if log.result.endswith(": Passed") else "Failed",
        "defense_type": defense_type,
        "gate": gate,
        "recorded_at": iso(log.created_at),
        "notes": log.notes,
        "verdict": None,
    }


def active_schedule_for_gate(student: Student, gate: str) -> ScheduleRequest | None:
    defense_type = RESEARCH_GATE_DEFENSE_TYPES.get(gate)
    if not student or not defense_type:
        return None
    return (
        ScheduleRequest.query.filter(
            ScheduleRequest.student_id == student.id,
            ScheduleRequest.status.in_(ACTIVE_DEFENSE_STATUSES),
            ScheduleRequest.defense_type == defense_type,
        )
        .order_by(ScheduleRequest.confirmed_at.desc(), ScheduleRequest.created_at.desc())
        .first()
    )


def reset_research_gate_after_failed_defense(student: Student, gate: str) -> list[str]:
    removed_paths = []
    docs = DocumentCheck.query.filter_by(student_id=student.id, gate=gate).all()
    for doc in docs:
        presentation = research_requirement_presentation(gate, doc.item_name)
        if not presentation:
            continue
        if presentation["source_type"] == "student_upload":
            for evidence in list(doc.evidence_files):
                removed_paths.append(evidence.stored_name)
                db.session.delete(evidence)
            doc.status = "Missing"
            doc.evidence_reference = None
        elif presentation["source_type"] in {"staff", "coordinator_endorsement", "system_title_schedule", "system_proposal_schedule", "system_final_schedule", "system_defense_result"}:
            doc.status = "Missing"
            doc.evidence_reference = None
        doc.updated_at = now_utc()
    clear_panel_for_research_gate(student, gate)
    if gate == "Form 1 - Title Defense":
        revoke_form1_endorsement(student.id)
    defense_type = RESEARCH_GATE_DEFENSE_TYPES.get(gate)
    if defense_type:
        active_schedules = ScheduleRequest.query.filter(
            ScheduleRequest.student_id == student.id,
            ScheduleRequest.status.in_(ACTIVE_DEFENSE_STATUSES),
            ScheduleRequest.defense_type == defense_type,
        ).all()
        for schedule in active_schedules:
            schedule.status = "Failed"
            schedule.conflict_reason = "Defense marked failed; student must resubmit this Research Gate stage."
    return removed_paths


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
        return ["Panel Chair", "Content Specialist", "Method Specialist", "External Panel"]
    if case_type == "Dissertation":
        return ["Panel Chair", "Content Specialist 1", "Content Specialist 2", "Method Specialist", "External Panel"]
    return ["Panel Chair", "Content Specialist", "Method Specialist", "External Panel"]


def defense_lead_days(defense_type: str) -> int:
    # Lead-time rule used by scheduling confirmation.
    if defense_type == "Title Defense":
        return 0
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
    required_courses = monitoring_curriculum_courses(student.program)
    records = {record.course_id: record for record in CourseRecord.query.filter_by(student_id=student.id).all()}
    completed = []
    current = []
    missing = []
    incomplete = []

    total_units = 0
    completed_units = 0
    by_category: dict[str, dict] = {}

    for course in required_courses:
        record = records.get(course.id)
        status = record.status if record else "Missing"
        row = {"course": course, "record": record, "status": status}
        units = course.units or 3
        category = course.category or "Core"
        cat = by_category.setdefault(category, {"category": category, "total_count": 0, "completed_count": 0, "total_units": 0, "completed_units": 0})
        cat["total_count"] += 1
        cat["total_units"] += units
        total_units += units
        if status == "Completed":
            completed.append(row)
            completed_units += units
            cat["completed_count"] += 1
            cat["completed_units"] += units
        elif status in ["Current", "Enrolled"]:
            current.append(row)
        elif status in ["Incomplete", "Retake Required", "Dropped", "Failed"]:
            incomplete.append(row)
        else:
            missing.append(row)

    # Course completion is subject-driven: every curriculum subject must be
    # completed before downstream comprehensive/research eligibility opens.
    units_complete = total_units > 0 and completed_units >= total_units
    cat_order = ["Basic", "Major", "Cognate", "Core", "Comprehensive"]

    return {
        "required_count": len(required_courses),
        "completed": completed,
        "current": current,
        "missing": missing,
        "incomplete": incomplete,
        "missing_count": len(missing) + len(incomplete),
        "completion_rate": round((len(completed) / len(required_courses)) * 100, 1) if required_courses else 0,
        "total_units": total_units,
        "completed_units": completed_units,
        "units_rate": round((completed_units / total_units) * 100, 1) if total_units else 0,
        "by_category": sorted(by_category.values(), key=lambda c: cat_order.index(c["category"]) if c["category"] in cat_order else 99),
        "eligibility": {
            "units_complete": units_complete,
            "completed_units": completed_units,
            "total_units": total_units,
            "comprehensive": units_complete,
            "final_proposal": units_complete,
            "thesis": units_complete,
        },
    }


def sync_student_curriculum(student: Student, courses: list[Course] | None = None) -> int:
    curriculum = courses if courses is not None else monitoring_curriculum_courses(student.program)
    existing = {record.course_id for record in CourseRecord.query.filter_by(student_id=student.id).all()}
    created = 0
    for course in curriculum:
        if course.id in existing:
            continue
        db.session.add(
            CourseRecord(
                student_id=student.id,
                course_id=course.id,
                status="Missing",
                evidence_reference="Automatic curriculum sync",
            )
        )
        created += 1
    return created


def sync_program_curriculum(program: Program, courses: list[Course] | None = None) -> dict:
    students = Student.query.filter_by(program_id=program.id).all()
    created = 0
    touched = 0
    for student in students:
        added = sync_student_curriculum(student, courses=courses)
        if added:
            created += added
            touched += 1
    return {"created": created, "students": touched}


def sync_all_curricula() -> dict:
    created = 0
    touched = 0
    for program in Program.query.all():
        result = sync_program_curriculum(program, courses=monitoring_curriculum_courses(program))
        created += result["created"]
        touched += result["students"]
    return {"created": created, "students": touched}


def recommended_term_rank(value: str | None) -> tuple[int, int, str]:
    text_value = (value or "").strip()
    year_match = re.search(r"year\s*(\d+)", text_value, re.IGNORECASE)
    term_match = re.search(r"term\s*(\d+)", text_value, re.IGNORECASE)
    return (
        int(year_match.group(1)) if year_match else 99,
        int(term_match.group(1)) if term_match else 99,
        text_value.lower(),
    )


def student_semester_subjects(student: Student, term: AcademicTerm | None) -> dict:
    """One source of truth for current enrollment and the student's next subject group."""
    audit = compute_course_audit(student)
    current_rows = [
        row for row in audit["current"]
        if not term or not row["record"] or not row["record"].term_label or row["record"].term_label == term.label
    ]
    current_subjects = [
        {
            "id": row["course"].id,
            "code": row["course"].code,
            "title": row["course"].title,
            "units": row["course"].units or 3,
            "category": row["course"].category,
            "term_label": row["record"].term_label if row["record"] else (term.label if term else None),
        }
        for row in current_rows
    ]
    remaining = sorted(
        audit["missing"] + audit["incomplete"],
        key=lambda row: (recommended_term_rank(row["course"].recommended_term), row["course"].code),
    )
    next_rows = []
    if remaining:
        next_rank = recommended_term_rank(remaining[0]["course"].recommended_term)
        next_rows = [row for row in remaining if recommended_term_rank(row["course"].recommended_term) == next_rank][:6]
    next_subjects = [
        {
            "id": row["course"].id,
            "code": row["course"].code,
            "title": row["course"].title,
            "units": row["course"].units or 3,
            "category": row["course"].category,
            "recommended_term": row["course"].recommended_term,
            "status": row["status"],
        }
        for row in next_rows
    ]
    return {"audit": audit, "current_subjects": current_subjects, "next_subjects": next_subjects}


def curriculum_planning_payload(program: Program, term: AcademicTerm | None = None) -> dict:
    term = term or get_active_term()
    courses = Course.query.filter_by(program_id=program.id).order_by(Course.category, Course.code).all()
    student_query = Student.query.filter_by(program_id=program.id)
    if term:
        student_query = student_query.join(TermEnrollment).filter(
            TermEnrollment.term_id == term.id,
            TermEnrollment.status.in_(["Confirmed", "Enrolled", "Active"]),
        )
    students = student_query.filter(Student.enrollment_tag == "Enrolled").distinct().order_by(Student.last_name, Student.first_name).all()
    rows = []
    active_count = 0
    delayed_count = 0
    loa_count = 0
    generated_count = 0
    for student in students:
        if student.standing == "Active":
            active_count += 1
        if student.standing == "On Leave":
            loa_count += 1
        if student.risk_level in ("Medium", "High") or student.current_stage == "LOA":
            delayed_count += 1
        record_count = CourseRecord.query.filter_by(student_id=student.id).count()
        missing_rows = max(len(courses) - record_count, 0)
        semester = student_semester_subjects(student, term)
        audit = semester["audit"]
        compre = comprehensive_exam_eligibility(student)
        if missing_rows == 0 and courses:
            generated_count += 1
        exceptions = []
        if missing_rows:
            exceptions.append(f"{missing_rows} curriculum row(s) missing")
        if student.enrollment_tag in {"AWOL", "LOA"}:
            exceptions.append(student.enrollment_tag)
        rows.append({
            **student_brief(student),
            "curriculum_rows": record_count,
            "required_subjects": len(courses),
            "missing_curriculum_rows": missing_rows,
            "curriculum_status": "Synced" if missing_rows == 0 and courses else "Sync pending",
            "completed_subjects": len(audit["completed"]),
            "completed_units": audit["completed_units"],
            "total_units": audit["total_units"],
            "completion_rate": audit["units_rate"],
            "category_progress": audit["by_category"],
            "compre_eligibility": compre,
            "research_access": "Unlocked" if compre["research_allowed"] else "Locked",
            "exceptions": exceptions,
            "current_subjects": semester["current_subjects"],
            "next_subjects": semester["next_subjects"],
        })

    grouped: dict[str, list] = {}
    for course in courses:
        grouped.setdefault(course.category or "Core", []).append({
            "id": course.id,
            "code": course.code,
            "title": course.title,
            "units": course.units,
            "recommended_term": course.recommended_term,
        })

    return {
        "program": program_dict(program),
        "programs": [program_dict(p) for p in Program.query.order_by(Program.code).all()],
        "term": term_dict(term) if term else None,
        "terms": [term_dict(item) for item in AcademicTerm.query.order_by(AcademicTerm.start_date.desc()).all()],
        "summary": {
            "students": len(students),
            "total_enrolled": len(students),
            "with_current_subjects": sum(bool(row["current_subjects"]) for row in rows),
            "with_next_subjects": sum(bool(row["next_subjects"]) for row in rows),
            "needs_review": sum(bool(row["exceptions"]) or not row["current_subjects"] for row in rows),
            "active": active_count,
            "delayed_or_loa": delayed_count + loa_count,
            "curriculum_generated": generated_count,
            "needs_generation": max(len(students) - generated_count, 0),
            "subjects": len(courses),
            "coverage_rate": round((generated_count / len(students)) * 100, 1) if students else 100,
        },
        "version": {
            "id": f"{program.code}-current",
            "name": f"{program.code} Current Curriculum",
            "status": "Active",
            "assigned_students": len(students),
        },
        "categories": [
            {"name": name, "courses": grouped[name]}
            for name in sorted(grouped, key=lambda item: ["Basic", "Major", "Cognate", "Core", "Comprehensive"].index(item) if item in ["Basic", "Major", "Cognate", "Core", "Comprehensive"] else 99)
        ],
        "students": rows[:150],
    }


def course_demand_rows(program: Program, term: AcademicTerm | None = None) -> list[dict]:
    # Subject demand counts only currently ENROLLED students who have not yet taken
    # the subject (LOA / AWOL / Completed are excluded), per the AC's process.
    demand: dict[int, dict] = {}
    student_query = Student.query.filter_by(program_id=program.id, enrollment_tag="Enrolled")
    if term:
        student_query = student_query.join(TermEnrollment).filter(
            TermEnrollment.term_id == term.id,
            TermEnrollment.status.in_(["Confirmed", "Enrolled", "Active"]),
        )
    students = student_query.distinct().order_by(Student.last_name).all()
    available_faculty = Faculty.query.filter_by(college=program.college, active=True).count()
    future_slots = (
        db.session.query(FacultyAvailability.faculty_id)
        .join(Faculty, Faculty.id == FacultyAvailability.faculty_id)
        .filter(Faculty.college == program.college, FacultyAvailability.available_date >= date.today())
        .distinct()
        .count()
    )
    availability_count = max(available_faculty, future_slots)
    for student in students:
        semester = student_semester_subjects(student, term)
        for next_subject in semester["next_subjects"]:
            course = Course.query.get(next_subject["id"])
            if course.id not in demand:
                demand[course.id] = {"course": course, "students": []}
            demand[course.id]["students"].append(student)

    rows = []
    for item in demand.values():
        count = len(item["students"])
        suggested_sections = max(1, (count + 24) // 25)
        if count >= 15:
            recommendation = "Offer this semester"
            priority = "High"
        elif count >= 5:
            recommendation = "Review section feasibility"
            priority = "Medium"
        else:
            recommendation = "Monitor demand"
            priority = "Low"
        rows.append({
            "course": {
                "id": item["course"].id,
                "code": item["course"].code,
                "title": item["course"].title,
                "category": item["course"].category,
            },
            "demand_count": count,
            "student_sample": [student_brief(s) for s in item["students"][:5]],
            "suggested_sections": suggested_sections,
            "availability_count": availability_count,
            "priority": priority,
            "recommendation": recommendation,
        })
    rows.sort(key=lambda row: (-row["demand_count"], row["course"]["code"]))
    return rows[:20]


def course_adjustments_payload(program: Program, term: AcademicTerm | None = None) -> dict:
    term = term or get_active_term()
    live_demand = course_demand_rows(program, term)
    demand_by_course = {row["course"]["id"]: row for row in live_demand}
    min_threshold = 5
    high_threshold = 15

    def demand_status(count: int) -> str:
        if count >= high_threshold:
            return "high"
        if count >= min_threshold:
            return "meets_minimum"
        if count > 0:
            return "below_minimum"
        return "no_demand"

    latest_plan = (
        CourseOfferingPlan.query.filter_by(program_id=program.id, term_label=term.label if term else None)
        .order_by(CourseOfferingPlan.updated_at.desc())
        .first()
    )
    saved_by_course = {offering.course_id: offering for offering in latest_plan.offerings} if latest_plan else {}
    availability_count = max(
        (row["availability_count"] for row in live_demand),
        default=Faculty.query.filter_by(college=program.college, active=True).count(),
    )
    demand = []
    for course in Course.query.filter_by(program_id=program.id).order_by(Course.code).all():
        row = demand_by_course.get(course.id)
        if not row:
            row = {
                "course": {
                    "id": course.id,
                    "code": course.code,
                    "title": course.title,
                    "category": course.category,
                },
                "demand_count": 0,
                "student_sample": [],
                "suggested_sections": 1,
                "availability_count": availability_count,
                "priority": "Manual",
                "recommendation": "No automatic demand; available for manual offering.",
            }
        saved = saved_by_course.get(row["course"]["id"])
        row["demand_status"] = demand_status(row["demand_count"])
        row["offering_status"] = saved.status if saved else ("Suggested" if row["demand_count"] > 0 else None)
        row["section_count"] = saved.section_count if saved else row["suggested_sections"]
        row["offering_notes"] = saved.notes if saved else row["recommendation"]
        row["selection_source"] = "Demand" if row["demand_count"] > 0 else "Manual"
        demand.append(row)
    demand.sort(key=lambda row: (-row["demand_count"], row["course"]["code"]))
    account = current_account()
    return {
        "program": program_dict(program),
        "programs": [program_dict(p) for p in Program.query.order_by(Program.code).all()],
        "term": term_dict(term) if term else None,
        "terms": [term_dict(item) for item in AcademicTerm.query.order_by(AcademicTerm.start_date.desc()).all()],
        "active_term": term_dict(get_active_term()) if get_active_term() else None,
        "planning_window_open": True,
        "permissions": {
            "can_manage": bool(account and account.role in ("academic_coordinator", "admin")),
        },
        "summary": {
            "curriculum_subjects": len(demand),
            "demand_subjects": sum(1 for row in demand if row["demand_count"] > 0),
            "total_demand": sum(row["demand_count"] for row in demand),
            "high_priority": sum(1 for row in demand if row["priority"] == "High"),
            "suggested_sections": sum(row["suggested_sections"] for row in demand),
        },
        "demand": demand,
        "latest_plan": course_offering_plan_dict(latest_plan),
    }


def compute_offering_demand() -> list[dict]:
    # Planning helper: counts which missing subjects appear most often among
    # active students, useful for course offering discussions.
    demand: dict[int, dict] = {}
    students = Student.query.filter(Student.enrollment_tag == "Enrolled").limit(500).all()
    for student in students:
        audit = compute_course_audit(student)
        for row in audit["missing"][:4]:
            course = row["course"]
            if course.id not in demand:
                demand[course.id] = {"course": course, "count": 0, "students": []}
            demand[course.id]["count"] += 1
            demand[course.id]["students"].append(student)
    return sorted(demand.values(), key=lambda item: item["count"], reverse=True)[:12]


def recommend_panel(student: Student) -> list[dict]:
    # RAG-assisted retrieval analyzes the active gate's uploaded manuscript body
    # and retrieved faculty profiles; the final rubric stays explainable.
    profile = research_matching_profile(student)
    query_counts = Counter(matching_tokens(profile["query_text"] + " " + " ".join(profile.get("keywords", []))))
    token_frequency, total_profiles = faculty_specialization_token_stats()
    analyzed_phrases = profile.get("keywords", [])
    rag_match_by_id = {
        item.get("faculty_id"): item
        for item in profile.get("rag_faculty_matches", [])
        if item.get("faculty_id")
    }
    faculty_members = Faculty.query.filter_by(active=True).all()
    rows = []
    for faculty in faculty_members:
        # Do not count this student's current finalized panel during regeneration;
        # otherwise the same recommendation changes merely because it was saved.
        workload = PanelAssignment.query.filter(
            PanelAssignment.faculty_id == faculty.id,
            PanelAssignment.student_id != student.id,
        ).count()
        availability_rows = FacultyAvailability.query.filter(
            FacultyAvailability.faculty_id == faculty.id,
            FacultyAvailability.available_date >= date.today(),
        ).all()
        block_cache = {faculty.id: faculty_calendar_blocks(faculty, date.today(), date.today() + timedelta(days=90))}
        availability_count = sum(
            1
            for slot in availability_rows
            if not candidate_conflicts_profile_blocks(
                faculty,
                slot.available_date,
                slot.start_time.hour * 60 + slot.start_time.minute,
                slot.end_time.hour * 60 + slot.end_time.minute,
                block_cache,
            )
        )
        faculty_profile_text = faculty.specialization or ""
        faculty_tokens = set(matching_tokens(faculty_profile_text))
        faculty_phrase_text = faculty_profile_text.lower()
        matched_keywords = [token for token, _count in query_counts.most_common() if token in faculty_tokens][:8]
        rag_match = rag_match_by_id.get(faculty.id)
        rag_terms = [
            term for term in (rag_match or {}).get("matched_terms", [])
            if set(matching_tokens(term)).intersection(faculty_tokens)
        ][:6]
        matched_phrases = [
            phrase
            for phrase in analyzed_phrases
            if " " in phrase
            and (
                set(matching_tokens(phrase)).issubset(faculty_tokens)
                or phrase.lower() in faculty_phrase_text
            )
        ][:6]
        # Keyword frequency is capped so repeated boilerplate in a PDF cannot
        # dominate a faculty specialization match.
        weighted_keyword_points = sum(
            min(query_counts[token], 3) * specialization_token_weight(token, token_frequency, total_profiles)
            for token in matched_keywords
        )
        distinctive_matches = [
            token for token in matched_keywords
            if specialization_token_weight(token, token_frequency, total_profiles) >= 1
        ]
        specialization_score = min(
            50,
            weighted_keyword_points * 3
            + len(matched_phrases) * 6
            + len(rag_terms) * 4
            + (6 if rag_match else 0),
        )
        if not distinctive_matches and not matched_phrases and not rag_terms:
            specialization_score = min(specialization_score, 18)
        recurring_days = sum(1 for item in faculty_working_hours(faculty) if item["enabled"])
        availability_score = min(30, availability_count * 6)
        if not availability_count and recurring_days:
            availability_score = 12
        workload_fit = max(0, 10 - min(workload, 5) * 2)
        active_profile_fit = 4
        specialization_fit = 6 if specialization_score >= 25 else 0
        suitability_score = min(20, workload_fit + active_profile_fit + specialization_fit)
        score = specialization_score + availability_score + suitability_score
        availability_status = (
            "Available" if availability_count >= 3 else
            "Limited availability" if availability_count or recurring_days else
            "No availability recorded"
        )
        reasons = []
        if rag_terms:
            reasons.append(f"RAG match: {', '.join(rag_terms[:2])}")
        elif matched_phrases:
            reasons.append(f"matches {', '.join(matched_phrases[:2])}")
        elif matched_keywords:
            reasons.append(f"matches {', '.join(matched_keywords[:3])}")
        reasons.append(availability_status.lower())
        reasons.append(f"{workload} active panel assignment{'s' if workload != 1 else ''}")
        note = "; ".join(reasons)
        rows.append({
            "faculty": faculty,
            "score": score,
            "note": note,
            "matched_keywords": rag_terms or matched_phrases or matched_keywords,
            "availability_status": availability_status,
            "availability_windows": availability_count,
            "workload": workload,
            "score_breakdown": {
                "specialization": specialization_score,
                "availability": availability_score,
                "suitability": suitability_score,
            },
        })
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


def ensure_schedule_request_schema() -> None:
    """Add defense-detail columns for existing MVP databases without dropping data."""
    inspector = inspect(db.engine)
    if "schedule_request" not in inspector.get_table_names():
        return
    existing = {column["name"] for column in inspector.get_columns("schedule_request")}
    additions = {
        "preferred_end_date": "DATE",
        "start_time": "TIME",
        "end_time": "TIME",
        "defense_type": "VARCHAR(60)",
        "panel_snapshot": "TEXT",
        "required_forms_status": "VARCHAR(40)",
        "conflict_reason": "TEXT",
    }
    for name, sql_type in additions.items():
        if name not in existing:
            db.session.execute(text(f"ALTER TABLE schedule_request ADD COLUMN {name} {sql_type}"))
    db.session.commit()


def ensure_monitoring_upload_schema() -> None:
    """Create the additive upload-history table for existing MVP databases."""
    MonitoringSheetUpload.__table__.create(bind=db.engine, checkfirst=True)


def ensure_student_comprehensive_exam_schema() -> None:
    """Add explicit comprehensive-exam state without dropping existing student data."""
    inspector = inspect(db.engine)
    if "student" not in inspector.get_table_names():
        return
    existing = {column["name"] for column in inspector.get_columns("student")}
    if "comprehensive_exam_status" not in existing:
        db.session.execute(text("ALTER TABLE student ADD COLUMN comprehensive_exam_status VARCHAR(30) NOT NULL DEFAULT 'Not Taken'"))
        db.session.commit()


def ensure_demo_comprehensive_exam_consistency() -> int:
    """Repair legacy generated rows so research never precedes a passed exam."""
    inspector = inspect(db.engine)
    if "student" not in inspector.get_table_names():
        return 0
    existing = {column["name"] for column in inspector.get_columns("student")}
    if "comprehensive_exam_status" not in existing:
        return 0
    research_stages = {"Proposal Development", "Proposal Defense", "Data Collection", "Writing", "Final Defense", "Completed"}
    generated = Student.query.filter(Student.student_number.like("GS-2026-%")).all()
    generated_ids = {student.id for student in generated}
    case_ids = {
        student_id for (student_id,) in db.session.query(ResearchCase.student_id)
        .filter(ResearchCase.student_id.in_(generated_ids or {-1}))
        .distinct()
        .all()
    }
    research_ids = {
        student.id for student in generated
        if student.current_stage in research_stages or student.id in case_ids
    }
    nonresearch_ids = generated_ids - research_ids
    changed = 0
    if research_ids:
        changed += Student.query.filter(
            Student.id.in_(research_ids),
            Student.comprehensive_exam_status != "Passed",
        ).update({Student.comprehensive_exam_status: "Passed"}, synchronize_session=False)
        records = (
            CourseRecord.query.join(Course)
            .filter(
                CourseRecord.student_id.in_(research_ids),
                Course.category.in_(COMPRE_UNIT_REQUIREMENTS),
                CourseRecord.status != "Completed",
            )
            .all()
        )
        for record in records:
            record.status = "Completed"
            record.updated_at = now_utc()
        changed += len(records)
    if nonresearch_ids:
        changed += PanelAssignment.query.filter(PanelAssignment.student_id.in_(nonresearch_ids)).delete(synchronize_session=False)
        changed += ScheduleRequest.query.filter(ScheduleRequest.student_id.in_(nonresearch_ids)).delete(synchronize_session=False)
    current_records = (
        CourseRecord.query.join(Student)
        .filter(
            Student.id.in_(generated_ids or {-1}),
            CourseRecord.status.in_(["Current", "Enrolled"]),
        )
        .all()
    )
    enrollments = (
        TermEnrollment.query.filter(TermEnrollment.student_id.in_(generated_ids or {-1}))
        .order_by(TermEnrollment.confirmed_at.desc())
        .all()
    )
    enrollment_term = {}
    for enrollment in enrollments:
        enrollment_term.setdefault(enrollment.student_id, enrollment.term.label)
    for record in current_records:
        expected_term = enrollment_term.get(record.student_id)
        if expected_term and record.term_label != expected_term:
            record.term_label = expected_term
            changed += 1
    if changed:
        db.session.commit()
    return changed


def ensure_workflow_activity_schema() -> None:
    """Add workflow traceability fields without resetting an existing demo DB."""
    db.create_all()
    inspector = inspect(db.engine)
    tables = set(inspector.get_table_names())
    if "transaction_log" not in tables:
        return
    existing = {column["name"] for column in inspector.get_columns("transaction_log")}
    additions = {
        "previous_status": "VARCHAR(100)",
        "new_status": "VARCHAR(100)",
        "workflow_request_id": "INTEGER",
        "actor_user_id": "INTEGER",
        "action_type": "VARCHAR(40)",
        "visibility": "VARCHAR(30)",
    }
    for name, sql_type in additions.items():
        if name not in existing:
            db.session.execute(text(f"ALTER TABLE transaction_log ADD COLUMN {name} {sql_type}"))
    if "student_request_attachment" in tables:
        attachment_existing = {
            column["name"]
            for column in inspector.get_columns("student_request_attachment")
        }
        attachment_additions = {
            "workflow_request_id": "INTEGER",
            "workflow_stage": "VARCHAR(100)",
            "uploaded_by_user_id": "INTEGER",
            "uploaded_by_name": "VARCHAR(160)",
            "uploaded_by_role": "VARCHAR(80)",
        }
        for name, sql_type in attachment_additions.items():
            if name not in attachment_existing:
                db.session.execute(text(
                    f"ALTER TABLE student_request_attachment ADD COLUMN {name} {sql_type}"
                ))
    if "workflow_message" in tables:
        message_existing = {
            column["name"]
            for column in inspector.get_columns("workflow_message")
        }
        message_additions = {
            "workflow_request_id": "INTEGER",
            "workflow_stage": "VARCHAR(100)",
            "sender_user_id": "INTEGER",
            "recipient_user_id": "INTEGER",
            "visibility": "VARCHAR(30)",
            "read_at": "DATETIME",
        }
        for name, sql_type in message_additions.items():
            if name not in message_existing:
                db.session.execute(text(
                    f"ALTER TABLE workflow_message ADD COLUMN {name} {sql_type}"
                ))
    inspector = inspect(db.engine)
    if "practicum_record" in tables:
        practicum_existing = {column["name"] for column in inspector.get_columns("practicum_record")}
        practicum_additions = {
            "supervisor_name": "VARCHAR(160)",
            "completion_status": "VARCHAR(80) DEFAULT 'Pending'",
        }
        for name, sql_type in practicum_additions.items():
            if name not in practicum_existing:
                db.session.execute(text(f"ALTER TABLE practicum_record ADD COLUMN {name} {sql_type}"))
    if "graduation_endorsement" in tables:
        graduation_existing = {column["name"] for column in inspector.get_columns("graduation_endorsement")}
        graduation_additions = {
            "batch_name": "VARCHAR(120)",
        }
        for name, sql_type in graduation_additions.items():
            if name not in graduation_existing:
                db.session.execute(text(f"ALTER TABLE graduation_endorsement ADD COLUMN {name} {sql_type}"))
    db.session.commit()

    student_accounts = {
        account.student_id: account
        for account in UserAccount.query.filter_by(role="student", active=True).all()
        if account.student_id
    }
    role_accounts = {}
    for account in UserAccount.query.filter_by(active=True).order_by(UserAccount.id.asc()).all():
        role_accounts.setdefault(account.role, account)

    attachment_links: dict[int, tuple[int, str]] = {}
    for record in PracticumRecord.query.all():
        if record.moa_attachment_id:
            attachment_links[record.moa_attachment_id] = (record.id, "MOA Submission")
        if record.certificate_attachment_id:
            attachment_links[record.certificate_attachment_id] = (
                record.id,
                "Practicum Document Submission",
            )
    for application in WithdrawalApplication.query.all():
        if application.request_attachment_id:
            attachment_links[application.request_attachment_id] = (
                application.id,
                "Withdrawal Application",
            )
        if application.proof_attachment_id:
            attachment_links[application.proof_attachment_id] = (
                application.id,
                "Withdrawal Requirements",
            )
    for endorsement in GraduationEndorsement.query.all():
        if endorsement.request_attachment_id:
            attachment_links[endorsement.request_attachment_id] = (
                endorsement.id,
                "Graduation Application",
            )

    for attachment in StudentRequestAttachment.query.all():
        link = attachment_links.get(attachment.id)
        if link:
            attachment.workflow_request_id = attachment.workflow_request_id or link[0]
            attachment.workflow_stage = attachment.workflow_stage or link[1]
        student_account = student_accounts.get(attachment.student_id)
        if not attachment.uploaded_by_user_id and student_account:
            attachment.uploaded_by_user_id = student_account.id
        if not attachment.uploaded_by_name:
            student = db.session.get(Student, attachment.student_id)
            attachment.uploaded_by_name = (
                student_account.full_name
                if student_account
                else student.name if student else "Student"
            )
        attachment.uploaded_by_role = attachment.uploaded_by_role or "Student"
        if (
            attachment.original_name == "Withdrawal_Request_Mendoza.pdf"
            and attachment.stored_name.startswith("sim-wd-")
        ):
            attachment.stored_name = "demo-withdrawal-request.pdf"

    role_by_label = {label: role for role, label in ROLE_LABELS.items()}
    for message in WorkflowMessage.query.all():
        record = workflow_case_record(message.transaction_slug, message.student_id)
        message.workflow_request_id = message.workflow_request_id or (
            record.id if record else None
        )
        message.workflow_stage = message.workflow_stage or message.new_status or message.previous_status
        if not message.visibility:
            message.visibility = (
                "student_visible"
                if message.sender_role == "Student" or message.recipient_role == "Student"
                else "internal"
            )
        sender_role = role_by_label.get(message.sender_role)
        if not message.sender_user_id:
            if sender_role == "student":
                message.sender_user_id = student_accounts.get(message.student_id).id if student_accounts.get(message.student_id) else None
            elif sender_role:
                sender = role_accounts.get(sender_role)
                message.sender_user_id = sender.id if sender else None
        recipient_role = WORKFLOW_RECIPIENTS.get(message.recipient_role)
        if not message.recipient_user_id and recipient_role:
            recipient = (
                student_accounts.get(message.student_id)
                if recipient_role == "student"
                else role_accounts.get(recipient_role)
            )
            message.recipient_user_id = recipient.id if recipient else None

    for log in TransactionLog.query.all():
        log.visibility = log.visibility or "student_visible"
        if log.transaction_slug not in {"practicum", "withdrawal", "graduation"}:
            continue
        record = workflow_case_record(log.transaction_slug, log.student_id) if log.student_id else None
        log.workflow_request_id = log.workflow_request_id or (record.id if record else None)
        log.action_type = log.action_type or workflow_transition_action(log.result)
        if not log.actor_user_id:
            for role, label in ROLE_LABELS.items():
                if log.actor_role == label or log.actor_role.startswith(f"{label} ·"):
                    actor = (
                        student_accounts.get(log.student_id)
                        if role == "student"
                        else role_accounts.get(role)
                    )
                    log.actor_user_id = actor.id if actor else None
                    break
        related_messages = WorkflowMessage.query.filter_by(
            transaction_slug=log.transaction_slug,
            student_id=log.student_id,
            previous_status=log.previous_status,
            new_status=log.new_status,
        ).all()
        if any(
            message.visibility == "internal" and message.action_type != "notice"
            for message in related_messages
        ):
            log.visibility = "internal"
    db.session.commit()


def ensure_panel_assignment_schema() -> None:
    inspector = inspect(db.engine)
    if "panel_assignment" not in inspector.get_table_names():
        return
    existing = {column["name"] for column in inspector.get_columns("panel_assignment")}
    if "gate" not in existing:
        db.session.execute(text("ALTER TABLE panel_assignment ADD COLUMN gate VARCHAR(80)"))
        db.session.commit()
    assignments = PanelAssignment.query.filter(
        (PanelAssignment.gate.is_(None)) | (PanelAssignment.gate == "")
    ).all()
    if assignments:
        case_by_student = {
            case.student_id: case.current_gate
            for case in ResearchCase.query.filter(
                ResearchCase.student_id.in_({item.student_id for item in assignments})
            ).all()
        }
        for assignment in assignments:
            assignment.gate = case_by_student.get(assignment.student_id) or "Form 1 - Title Defense"
        db.session.commit()


def ensure_course_workflow_schema() -> None:
    """Add coursework grade/drop fields to existing demo databases."""
    db.create_all()
    inspector = inspect(db.engine)
    if "course_record" in inspector.get_table_names():
        existing = {column["name"] for column in inspector.get_columns("course_record")}
        additions = {
            "grade_value": "VARCHAR(40)",
            "grade_status": "VARCHAR(40) DEFAULT 'No Grade'",
            "incomplete_deadline": "DATE",
            "resolved_at": "DATETIME",
            "remarks": "TEXT",
        }
        for name, sql_type in additions.items():
            if name not in existing:
                db.session.execute(text(f"ALTER TABLE course_record ADD COLUMN {name} {sql_type}"))
    db.session.commit()


def ensure_subject_enrollment_schema() -> int:
    """Create/backfill the additive enrollment ledger without resetting data."""
    SubjectEnrollment.__table__.create(bind=db.engine, checkfirst=True)
    changed = 0

    # Repair legacy semester capitalization so offering filters remain stable.
    for offering in CurriculumOffering.query.all():
        lowered = (offering.semester or "").lower()
        canonical = (
            "1st Semester" if lowered.startswith(("1st", "first"))
            else "2nd Semester" if lowered.startswith(("2nd", "second"))
            else "3rd Semester" if lowered.startswith(("3rd", "third"))
            else offering.semester
        )
        if canonical != offering.semester:
            offering.semester = canonical
            changed += 1

    terms_by_label = {term.label: term for term in AcademicTerm.query.all()}
    records = (
        CourseRecord.query.filter(
            CourseRecord.status.in_(RECORDED_SUBJECT_ENROLLMENT_STATUSES),
            CourseRecord.term_label.isnot(None),
            CourseRecord.term_label != "",
        )
        .all()
    )
    for record in records:
        term = terms_by_label.get(record.term_label)
        if not term:
            continue
        item = SubjectEnrollment.query.filter_by(
            student_id=record.student_id,
            course_id=record.course_id,
            term_id=term.id,
        ).first()
        if not item:
            item = SubjectEnrollment(
                student_id=record.student_id,
                course_id=record.course_id,
                term_id=term.id,
                status=record.status,
                source_reference=(
                    record.evidence_reference or "Legacy course-record backfill"
                ),
                cancelled_at=(
                    now_utc() if record.status in {"Dropped"} else None
                ),
            )
            db.session.add(item)
            changed += 1
        if record.status in ACTIVE_SUBJECT_ENROLLMENT_STATUSES and record.student:
            existing_term = TermEnrollment.query.filter_by(
                student_id=record.student_id,
                term_id=term.id,
            ).first()
            if not existing_term:
                db.session.add(TermEnrollment(
                    student_id=record.student_id,
                    term_id=term.id,
                    status="Enrolled",
                    source_reference="Subject enrollment backfill",
                ))
                changed += 1
    if changed:
        db.session.commit()
    return changed


def ensure_research_evidence_schema() -> None:
    """Add concept-paper compliance fields without resetting existing uploads."""
    db.create_all()
    inspector = inspect(db.engine)
    if "research_evidence_file" in inspector.get_table_names():
        existing = {column["name"] for column in inspector.get_columns("research_evidence_file")}
        additions = {
            "compliance_status": "VARCHAR(40)",
            "compliance_score": "INTEGER",
            "compliance_summary": "TEXT",
            "compliance_result_json": "TEXT",
        }
        for name, sql_type in additions.items():
            if name not in existing:
                db.session.execute(text(f"ALTER TABLE research_evidence_file ADD COLUMN {name} {sql_type}"))
    db.session.commit()


def ensure_research_role_workflow_schema() -> None:
    """Create additive adviser-approval and chair-verdict tables."""
    AdviserDocumentApproval.__table__.create(bind=db.engine, checkfirst=True)
    DefenseVerdict.__table__.create(bind=db.engine, checkfirst=True)


def ensure_curriculum_offering_schema() -> None:
    db.create_all()
    inspector = inspect(db.engine)
    tables = set(inspector.get_table_names())
    if "academic_term" in tables:
        existing = {column["name"] for column in inspector.get_columns("academic_term")}
        additions = {
            "is_active_planning_term": "BOOLEAN DEFAULT 0",
            "planning_window_open": "DATE",
            "planning_window_close": "DATE",
            "grade_submission_deadline": "DATE",
            "status": "VARCHAR(20)",
        }
        for name, sql_type in additions.items():
            if name not in existing:
                db.session.execute(text(f"ALTER TABLE academic_term ADD COLUMN {name} {sql_type}"))
        active_count = db.session.execute(text("SELECT COUNT(*) FROM academic_term WHERE is_active_planning_term = 1")).scalar() or 0
        if active_count == 0:
            current = get_active_term()  # date-aware current/next semester, not the far-future latest
            if current:
                db.session.execute(text("UPDATE academic_term SET is_active_planning_term = 1 WHERE id = :term_id"), {"term_id": current.id})
    if "course_offering_plan" in tables:
        existing = {column["name"] for column in inspector.get_columns("course_offering_plan")}
        additions = {
            "target_term_id": "INTEGER",
            "reference_term_id": "INTEGER",
        }
        for name, sql_type in additions.items():
            if name not in existing:
                db.session.execute(text(f"ALTER TABLE course_offering_plan ADD COLUMN {name} {sql_type}"))
    db.session.commit()


MONITORING_SHEET_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Documents", "Monitoring_Sheets")


def import_program_monitoring_sheets() -> int:
    """Seed the student roster by importing the per-program registrar monitoring
    sheets in Documents/Monitoring_Sheets. These .xlsx files are the single source
    of truth for who is enrolled and their coursework completion."""
    if not os.path.isdir(MONITORING_SHEET_DIR):
        return 0
    created = 0
    for name in sorted(os.listdir(MONITORING_SHEET_DIR)):
        if not name.lower().endswith((".xlsx", ".xlsm")) or name.startswith("~$"):
            continue
        with open(os.path.join(MONITORING_SHEET_DIR, name), "rb") as fh:
            parsed = parse_ac_monitoring(fh)
        result = import_ac_monitoring(parsed)
        created += result.get("created", 0)
    return created


FACULTY_SHEET_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Documents", "Faculty_Sheet")


def import_faculty_sheets() -> int:
    """Create the faculty roster from the imported faculty sheet(s) in
    Documents/Faculty_Sheet. Faculty are a real, sheet-sourced roster and are never
    randomly generated. Header columns: NAME, COLLEGE, ROLE, EMAIL, SPECIALIZATION."""
    import openpyxl
    if not os.path.isdir(FACULTY_SHEET_DIR):
        return 0
    created = 0
    for fname in sorted(os.listdir(FACULTY_SHEET_DIR)):
        if not fname.lower().endswith((".xlsx", ".xlsm")) or fname.startswith("~$"):
            continue
        wb = openpyxl.load_workbook(os.path.join(FACULTY_SHEET_DIR, fname), data_only=True, read_only=True)
        ws = wb.active
        grid = [[_norm(cell.value) for cell in row] for row in ws.iter_rows()]
        header_idx, cols = None, {}
        for i, row in enumerate(grid):
            upper = [v.upper() for v in row]
            if "NAME" in upper:
                header_idx = i
                for j, v in enumerate(upper):
                    if v in ("NAME", "COLLEGE", "ROLE", "EMAIL", "SPECIALIZATION"):
                        cols[v] = j
                break
        if header_idx is None or "NAME" not in cols:
            continue

        def value(row, key):
            j = cols.get(key)
            return row[j].strip() if j is not None and j < len(row) and row[j] else ""

        for row in grid[header_idx + 1:]:
            name = value(row, "NAME")
            if not name:
                continue
            faculty = Faculty.query.filter_by(name=name).first()
            if not faculty:
                faculty = Faculty(name=name, active=True)
                db.session.add(faculty)
                created += 1
            faculty.college = value(row, "COLLEGE") or faculty.college or "Graduate School"
            faculty.role = value(row, "ROLE") or faculty.role or "Adviser / Panel"
            faculty.specialization = value(row, "SPECIALIZATION") or faculty.specialization or ""
            faculty.email = (value(row, "EMAIL") or (faculty.email or "")).strip().lower() or None
            faculty.eligible_roles = faculty.eligible_roles or json.dumps(["Faculty Adviser", "Panel Member", "Panel Chair"])
            faculty.active = True
            db.session.flush()
            if not FacultyWorkingHour.query.filter_by(faculty_id=faculty.id).count():
                for weekday in range(5):
                    db.session.add(FacultyWorkingHour(
                        faculty_id=faculty.id, weekday=weekday,
                        start_time=time(8, 0), end_time=time(17, 0), enabled=True))
    return created


def seed_maed_personas() -> None:
    """Set up one MAED student per lifecycle stage so every workflow screen is
    testable out of the box (curated demo personas, not random). Keyed by student
    number from Documents/Monitoring_Sheets/MAED_Monitoring_Sheet.xlsx."""
    def by_num(num):
        return Student.query.filter_by(student_number=num).first()

    def attach(student, request_type, filename):
        att = StudentRequestAttachment(
            student_id=student.id, request_type=request_type,
            original_name=filename, stored_name=f"persona-{request_type}-{student.id}.pdf",
            mime_type="application/pdf", uploaded_by_name=student.name,
            uploaded_by_role="student", uploaded_at=now_utc() - timedelta(days=2),
        )
        db.session.add(att); db.session.flush()
        return att

    active_term = get_active_term()
    term_label = active_term.label if active_term else ""

    loa = by_num("GS-2026-0003")
    if loa and not StudentRequestAttachment.query.filter_by(student_id=loa.id, request_type="leave-of-absence").first():
        name = f"LOA_Application_{loa.student_number}.pdf"
        attach(loa, "leave-of-absence", name)
        add_log("leave-of-absence", loa.id, "Student", name, "LOA application submitted", "GS Staff",
                "Student submitted a Leave of Absence application for staff eligibility review.\n"
                f"Requested period: {term_label}.\nReason/remarks: Family and health reasons.")

    awol = by_num("GS-2026-0005")
    if awol:
        awol.enrollment_tag = "AWOL"
        if not AwolCase.query.filter_by(student_id=awol.id).first():
            db.session.add(AwolCase(
                student_id=awol.id, status="Return Requested",
                awol_effective_date=date.today() - timedelta(days=200),
                last_enrolled_term="AY 2025-2026 1st Semester",
                return_requested_at=now_utc() - timedelta(days=3),
                target_return_term=term_label, years_in_program=2))
            name = f"AWOL_Return_Intent_{awol.student_number}.pdf"
            attach(awol, "awol-return", name)
            add_log("awol", awol.id, "Student", name, "Return intent submitted", "GS Staff",
                    "Student declared AWOL submitted a written return intent for review.\n"
                    f"Target return semester: {term_label}.")

    wd = by_num("GS-2026-0006")
    if wd and not WithdrawalApplication.query.filter_by(student_id=wd.id).first():
        name = f"Withdrawal_Request_{wd.student_number}.pdf"
        att = attach(wd, "withdrawal", name)
        db.session.add(WithdrawalApplication(
            student_id=wd.id, reason="Transferring to another institution.",
            effective_term=term_label, request_attachment_id=att.id,
            status="Dean Review", dean_decision="Pending"))
        add_log("withdrawal", wd.id, "Student", name, "Withdrawal request submitted", "GS Staff",
                "Student submitted a withdrawal request for Dean review.\n"
                f"Effective semester: {term_label}.")

    prac = by_num("GS-2026-0008")
    if prac and not PracticumRecord.query.filter_by(student_id=prac.id).first():
        db.session.add(PracticumRecord(
            student_id=prac.id, moa_status="Uploaded", moa_uploaded=True,
            practicum_site="USLS Center for Educational Practice", supervisor_name="Dr. Ana Reyes",
            required_hours=200, completed_hours=120, document_status="Pending Review",
            certificate_count=1, completion_status="Pending", status="Documents Under Review"))
        add_log("practicum", prac.id, "Academic Coordinator", "Practicum documents",
                "Practicum documents under review", "Academic Coordinator",
                "Practicum MOA received; hours in progress (120/200).")

    grad = by_num("GS-2026-0007")
    if grad and not GraduationEndorsement.query.filter_by(student_id=grad.id).first():
        db.session.add(GraduationEndorsement(
            student_id=grad.id, batch_name="Graduation Batch (Current Review)",
            coursework_status="Complete", research_status="Complete",
            practicum_status="Complete", endorsement_status="For Review"))
        add_log("graduation", grad.id, "Academic Coordinator", "Graduation candidate list",
                "Included in graduation candidate list", "Research Coordinator",
                "Coursework and research complete; forwarded for research validation.")

    miguel = by_num("GS-2026-0004")
    if miguel and not ResearchCase.query.filter_by(student_id=miguel.id).first():
        db.session.add(ResearchCase(
            student_id=miguel.id, case_type=research_case_type(miguel),
            title="Learning Analytics for Graduate Student Engagement",
            current_gate="Final Defense", status="Ready",
            adviser_name="Dr. Liwayway Bautista", opened_at=now_utc() - timedelta(days=120)))
        miguel.adviser_name = "Dr. Liwayway Bautista"
        panel = [("Dr. Marlon Geronimo", "Panel Chair"), ("Dr. Liwayway Bautista", "Content Specialist"),
                 ("Dr. Patricia Salvador", "Method Specialist"), ("Dr. Teodoro Ramos", "External Panel")]
        for fname, role in panel:
            fac = Faculty.query.filter_by(name=fname).first()
            if fac and not PanelAssignment.query.filter_by(student_id=miguel.id, faculty_id=fac.id, gate="Final Defense").first():
                db.session.add(PanelAssignment(
                    student_id=miguel.id, faculty_id=fac.id, gate="Final Defense",
                    panel_role=role, score=95, eligibility_note="Topic-matched panel"))
        for gate in ["Form 1 - Title Defense", "Form 4 - Proposal Defense Readiness"]:
            for item in required_documents_for_gate(gate):
                if not DocumentCheck.query.filter_by(student_id=miguel.id, gate=gate, item_name=item).first():
                    db.session.add(DocumentCheck(student_id=miguel.id, gate=gate, item_name=item,
                                                 status="Complete", evidence_reference="Research monitoring"))


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
        ("MAPSY", "Master of Arts in Psychology", "Arts and Sciences", True),
        ("MAGC", "Master of Arts in Guidance and Counseling", "Education", True),
        ("MASS", "Master of Arts in Social Sciences", "Arts and Sciences", False),
    ]
    programs = []
    for code, name, college, practicum in program_specs:
        program = Program(code=code, name=name, college=college, has_practicum=practicum)
        db.session.add(program)
        programs.append(program)
    db.session.flush()

    terms = []
    for label, start in generate_semester_calendar(2023, 2030):
        term = AcademicTerm(label=label, start_date=start, end_date=start + timedelta(days=120))
        db.session.add(term)
        terms.append(term)

    # Curriculum, faculty, and students all come from imported source sheets — nothing
    # is randomly generated. Program curriculum arrives with each monitoring sheet, the
    # faculty roster from the faculty sheet, and students from the monitoring sheets.
    import_faculty_sheets()
    db.session.flush()
    import_program_monitoring_sheets()
    db.session.commit()

    seed_maed_personas()
    db.session.commit()

    sync_all_curricula()
    for student in Student.query.all():
        recompute_risk(student)
    ensure_demo_accounts()
    db.session.commit()


def ensure_faculty_demo_names() -> int:
    renamed = 0
    faculty = Faculty.query.order_by(Faculty.id.asc()).limit(len(FACULTY_DEMO_NAMES)).all()
    for idx, member in enumerate(faculty):
        if re.fullmatch(r"Dr\. Faculty \d{2}", member.name or ""):
            member.name = FACULTY_DEMO_NAMES[idx]
            renamed += 1
    return renamed


def ensure_faculty_demo_profiles() -> int:
    """Upgrade the original generic seed profiles without touching custom data."""
    legacy_specializations = {
        "analytics and information systems",
        "educational leadership and curriculum",
        "business strategy and operations",
        "nursing practice and health systems",
        "psychology and social research",
        "engineering systems and optimization",
        "statistics and research design",
        "ethics review and technical writing",
    }
    sample_specializations = [
        "Finance, business analytics, accounting, and financial technology",
        "Education technology, learning analytics, and curriculum development",
        "Engineering systems, automation, and energy systems",
    ]
    updated = 0
    members = Faculty.query.order_by(Faculty.id.asc()).limit(3).all()
    for member, specialization in zip(members, sample_specializations):
        if (member.specialization or "").lower() in legacy_specializations:
            member.specialization = specialization
            updated += 1
    return updated


SIM_PROGRAM_CODE = "MAEDS"
SIM_STUDENT_PASSWORD = "DemoPass123!"
STUDENT_EMAIL_DOMAIN = os.getenv("STUDENT_EMAIL_DOMAIN", "student.usls.edu.ph")


def _email_slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", ".", (value or "").strip().lower()).strip(".")
    return slug or "student"


def default_student_email(first_name: str, last_name: str, student_number: str = "") -> str:
    first = _email_slug(first_name)
    last = _email_slug(last_name)
    local = f"{first}.{last}" if first != "student" or last != "student" else _email_slug(student_number)
    return f"{local}@{STUDENT_EMAIL_DOMAIN}"


def unique_student_email(first_name: str, last_name: str, student_number: str = "", current_student_id: int | None = None) -> str:
    base = default_student_email(first_name, last_name, student_number)
    local, _, domain = base.partition("@")
    candidate = base
    suffix = 2
    while True:
        with db.session.no_autoflush:
            student_query = Student.query.filter(func.lower(Student.email) == candidate.lower())
            if current_student_id:
                student_query = student_query.filter(Student.id != current_student_id)
            student_exists = student_query.first() is not None
            account_exists = UserAccount.query.filter(func.lower(UserAccount.email) == candidate.lower()).first() is not None
        if not student_exists and not account_exists:
            return candidate
        candidate = f"{local}{suffix}@{domain}"
        suffix += 1


def ensure_student_account(student: Student, email: str, password: str = SIM_STUDENT_PASSWORD) -> UserAccount:
    # Idempotently link (or create) a student-portal account so a handed-off student
    # can sign in to upload concept papers and file LOA / withdrawal requests.
    email = (email or student.email or "").strip().lower()
    account = UserAccount.query.filter_by(email=email).first()
    if not account:
        account = UserAccount(
            email=email,
            full_name=f"{student.name} (Student)",
            password_hash=generate_password_hash(password),
            role="student",
            active=True,
        )
        db.session.add(account)
    account.student_id = student.id
    account.full_name = f"{student.name} (Student)"
    account.active = True
    return account


def ensure_miguel_yu_research_demo_unlock() -> int:
    """Keep the Miguel Yu demo login ready for Research Gate walkthroughs."""
    student = Student.query.filter_by(first_name="Miguel", last_name="Yu").first()
    if not student:
        return 0

    changed = 0
    if student.comprehensive_exam_status != "Passed":
        student.comprehensive_exam_status = "Passed"
        changed += 1
    if student.standing == "Active" and student.current_stage in {"Admission", "Coursework", "Comprehensive Exam"}:
        student.current_stage = "Proposal Development"
        changed += 1

    for record in CourseRecord.query.filter_by(student_id=student.id).all():
        if record.status != "Completed":
            record.status = "Completed"
            record.updated_at = now_utc()
            changed += 1
        if record.grade_status in {None, "", "No Grade", "Incomplete", "Failed"}:
            record.grade_status = "Passed"
            changed += 1

    account = UserAccount.query.filter_by(email="student@usls.edu.ph").first()
    if not account:
        account = UserAccount(
            email="student@usls.edu.ph",
            full_name=f"{student.name} Demo",
            password_hash=generate_password_hash(SIM_STUDENT_PASSWORD),
            role="student",
            active=True,
        )
        db.session.add(account)
        changed += 1
    if account.student_id != student.id:
        account.student_id = student.id
        changed += 1
    desired_name = f"{student.name} Demo"
    if account.full_name != desired_name:
        account.full_name = desired_name
        changed += 1
    if account.role != "student":
        account.role = "student"
        changed += 1
    if not account.active:
        account.active = True
        changed += 1

    return changed


def seed_simulation_demo() -> None:
    """Remove the retired MAEDS "simulation cohort" program if it lingers from an
    older seed. The simulation fixtures (MAEDS, Student A/B/C, duplicate sim
    faculty) are no longer used. Idempotent and safe to run on every startup."""
    program = Program.query.filter_by(code="MAEDS").first()
    if not program:
        return
    student_ids = [s.id for s in Student.query.filter_by(program_id=program.id).all()]
    if student_ids:
        CourseRecord.query.filter(CourseRecord.student_id.in_(student_ids)).delete(synchronize_session=False)
        CourseDropRequest.query.filter(CourseDropRequest.student_id.in_(student_ids)).delete(synchronize_session=False)
        PanelAssignment.query.filter(PanelAssignment.student_id.in_(student_ids)).delete(synchronize_session=False)
        ScheduleRequest.query.filter(ScheduleRequest.student_id.in_(student_ids)).delete(synchronize_session=False)
        ResearchCase.query.filter(ResearchCase.student_id.in_(student_ids)).delete(synchronize_session=False)
        DocumentCheck.query.filter(DocumentCheck.student_id.in_(student_ids)).delete(synchronize_session=False)
        TermEnrollment.query.filter(TermEnrollment.student_id.in_(student_ids)).delete(synchronize_session=False)
        Task.query.filter(Task.student_id.in_(student_ids)).delete(synchronize_session=False)
        TransactionLog.query.filter(TransactionLog.student_id.in_(student_ids)).delete(synchronize_session=False)
        UserAccount.query.filter(UserAccount.student_id.in_(student_ids)).delete(synchronize_session=False)
        Student.query.filter(Student.id.in_(student_ids)).delete(synchronize_session=False)
    CourseRecord.query.filter(
        CourseRecord.course_id.in_([c.id for c in Course.query.filter_by(program_id=program.id).all()])
    ).delete(synchronize_session=False)
    CurriculumOffering.query.filter_by(program_id=program.id).delete(synchronize_session=False)
    Course.query.filter_by(program_id=program.id).delete(synchronize_session=False)
    db.session.delete(program)
    db.session.commit()


def ensure_demo_request_submission_logs() -> int:
    created = 0
    demo_attachments = StudentRequestAttachment.query.filter(
        StudentRequestAttachment.request_type.in_(["leave-of-absence", "readmission"]),
        or_(
            StudentRequestAttachment.stored_name.like("seed-loa-%"),
            StudentRequestAttachment.stored_name.like("seed-readmit-%"),
            StudentRequestAttachment.stored_name.like("sim-loa-%"),
        ),
    ).all()
    for attachment in demo_attachments:
        latest = (
            TransactionLog.query.filter_by(
                transaction_slug=attachment.request_type,
                student_id=attachment.student_id,
            )
            .filter(TransactionLog.actor_role != "Demo Data")
            .order_by(TransactionLog.created_at.desc(), TransactionLog.id.desc())
            .first()
        )
        if latest:
            continue
        if attachment.request_type == "leave-of-absence":
            add_task(attachment.student_id, "Review student Leave of Absence application", "GS Staff", 3, 55)
            add_log(
                "leave-of-absence",
                attachment.student_id,
                "Student",
                attachment.original_name,
                "LOA application submitted",
                "GS Staff",
                "Student submitted a Leave of Absence application for staff eligibility review.\n"
                "Requested period: AY 2026-2027 1st Semester to AY 2026-2027 2nd Semester.\n"
                "Reason/remarks: Demo queue case.\n"
                f"Application PDF: {attachment.original_name}.",
            )
        else:
            add_task(attachment.student_id, "Review student readmission request", "GS Staff", 3, 55)
            add_log(
                "readmission",
                attachment.student_id,
                "Student",
                attachment.original_name,
                "Readmission request submitted",
                "GS Staff",
                "Student submitted a readmission request for staff review.\n"
                "Target return semester: AY 2026-2027 1st Semester.\n"
                "Checklist submitted: 4 item(s); missing/not marked: None.\n"
                "Previous LOA period: AY 2025-2026 2nd Semester.\n"
                f"Application PDF: {attachment.original_name}.",
            )
        created += 1
    return created


def ensure_user_account_schema() -> None:
    """Add the faculty link column to user_account on existing demo databases."""
    inspector = inspect(db.engine)
    if "user_account" not in inspector.get_table_names():
        return
    existing = {column["name"] for column in inspector.get_columns("user_account")}
    if "faculty_id" not in existing:
        db.session.execute(text("ALTER TABLE user_account ADD COLUMN faculty_id INTEGER"))
        db.session.commit()


def ensure_faculty_account_schema() -> None:
    """Add faculty identity fields and connect every legacy profile to one login."""
    AdviserAssignment.__table__.create(bind=db.engine, checkfirst=True)
    inspector = inspect(db.engine)
    if "faculty" not in inspector.get_table_names():
        return
    existing = {column["name"] for column in inspector.get_columns("faculty")}
    additions = {
        "email": "VARCHAR(160)",
        "eligible_roles": "TEXT",
    }
    for name, sql_type in additions.items():
        if name not in existing:
            db.session.execute(text(f"ALTER TABLE faculty ADD COLUMN {name} {sql_type}"))
    db.session.commit()

    default_roles = json.dumps(["Faculty Adviser", "Panel Member", "Panel Chair"])
    for faculty in Faculty.query.order_by(Faculty.id).all():
        if faculty_email_needs_generation(faculty.email):
            faculty.email = default_faculty_email(faculty)
        faculty.email = faculty.email.strip().lower()
        if not faculty.eligible_roles:
            faculty.eligible_roles = default_roles
        primary = ensure_faculty_user_account(faculty, "DemoPass123!", reset_password=True)
        for duplicate in UserAccount.query.filter(
            UserAccount.faculty_id == faculty.id,
            UserAccount.role == "faculty",
            UserAccount.id != primary.id,
        ).all():
            duplicate.faculty_id = None
            duplicate.active = False

    for student in Student.query.filter(Student.adviser_name.isnot(None), Student.adviser_name != "").all():
        faculty = Faculty.query.filter_by(name=student.adviser_name).first()
        if not faculty:
            continue
        if not AdviserAssignment.query.filter_by(student_id=student.id, faculty_id=faculty.id, status="Active").first():
            db.session.add(AdviserAssignment(student_id=student.id, faculty_id=faculty.id, status="Active"))
    db.session.commit()


def ensure_demo_accounts() -> None:
    backoffice_accounts = [
        ("staff@usls.edu.ph", "Grace Fernandez", "staff"),
        ("academic@usls.edu.ph", "Dr. Ramon Alvarez", "academic_coordinator"),
        ("research@usls.edu.ph", "Dr. Sofia Mendoza", "research_coordinator"),
        ("admin@usls.edu.ph", "System Administrator", "admin"),
    ]
    for email, full_name, role in backoffice_accounts:
        account = UserAccount.query.filter_by(email=email).first()
        if not account:
            db.session.add(
                UserAccount(
                    email=email,
                    full_name=full_name,
                    password_hash=generate_password_hash("DemoPass123!"),
                    role=role,
                    active=True,
                )
            )
        else:
            account.full_name = full_name
            account.role = role
            account.active = True

    # Dean account — the approver role. Approval authority follows whoever holds
    # this role, so changing the Dean is an account change, not a code change.
    dean = UserAccount.query.filter_by(email="dean@usls.edu.ph").first()
    if not dean:
        db.session.add(
            UserAccount(
                email="dean@usls.edu.ph",
                full_name="Dr. Manuel Villaruz",
                password_hash=generate_password_hash("DemoPass123!"),
                role="dean",
                active=True,
            )
        )

    # Portal login for the student we follow through the lifecycle (Miguel Yu when
    # present), linked to the real Student record. No fabricated coursework state.
    linked_student = Student.query.filter_by(first_name="Miguel", last_name="Yu").first()
    if linked_student:
        student_account = UserAccount.query.filter_by(email="student@usls.edu.ph").first()
        if not student_account:
            student_account = UserAccount(
                email="student@usls.edu.ph",
                full_name=linked_student.name,
                password_hash=generate_password_hash("DemoPass123!"),
                role="student",
                active=True,
            )
            db.session.add(student_account)
        student_account.student_id = linked_student.id
        student_account.full_name = linked_student.name
    # Faculty logins come from the imported faculty roster via ensure_faculty_account_schema().

app = create_app()

with app.app_context():
    ensure_schedule_request_schema()
    ensure_monitoring_upload_schema()
    ensure_student_comprehensive_exam_schema()
    ensure_panel_assignment_schema()
    ensure_workflow_activity_schema()
    ensure_course_workflow_schema()
    ensure_subject_enrollment_schema()
    ensure_research_evidence_schema()
    ensure_research_role_workflow_schema()
    ensure_curriculum_offering_schema()
    ensure_user_account_schema()
    ensure_faculty_account_schema()


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        seed_count = int(os.getenv("DEMO_SEED_COUNT", "350"))
        if "--seed" in sys.argv:
            seed_database(seed_count)
            ensure_demo_accounts()
            ensure_faculty_account_schema()
            ensure_workflow_activity_schema()
            ensure_subject_enrollment_schema()
            db.session.commit()
            print(f"Seeded {Student.query.count()} student(s) and {Faculty.query.count()} faculty from imported source sheets.")
            raise SystemExit(0)
        if Student.query.count() == 0:
            seed_database(seed_count)
        ensure_demo_accounts()
        seed_simulation_demo()  # remove any lingering MAEDS cohort from older databases
        ensure_faculty_account_schema()
        ensure_workflow_activity_schema()
        sync_result = sync_all_curricula()
        ensure_subject_enrollment_schema()
        sync_overdue_incomplete_alerts(commit=False)
        db.session.commit()
        if sync_result["created"]:
            print(f"Added {sync_result['created']} missing curriculum row(s) for {sync_result['students']} student(s).")

    port = int(os.getenv("FLASK_PORT", "5000"))
    start_incomplete_deadline_scheduler()
    print(f"USLS Graduate School platform running at http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
