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
from collections import Counter
from functools import wraps
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import quote_plus, urlparse
from uuid import uuid4

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request, send_from_directory, session
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func, inspect, or_, text
from werkzeug.datastructures import MultiDict
from werkzeug.utils import secure_filename
from werkzeug.security import check_password_hash, generate_password_hash


load_dotenv()

db = SQLAlchemy()

FRONTEND_DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", "dist")
UPLOAD_ROOT = Path(os.path.dirname(os.path.abspath(__file__))) / "uploads" / "research_evidence"
REQUEST_UPLOAD_ROOT = Path(os.path.dirname(os.path.abspath(__file__))) / "uploads" / "student_requests"

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
        "data": "Reason, effective term, forms and proof, fee/requirement status, Dean decision, coordinator and registrar remarks.",
    },
    {
        "slug": "graduation",
        "priority": "P0",
        "title": "Graduation Endorsement",
        "icon": "graduation-cap",
        "group": "Completion",
        "short": "Review candidate eligibility across coursework, research, practicum, Dean endorsement, and Registrar handoff.",
        "actor": "GS Staff / Academic Coordinator / Research Coordinator / Dean / Registrar",
        "data": "Review term, candidate, coursework/research/practicum status, missing items, endorsement status, Dean and Registrar notes.",
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

    program = db.relationship("Program")
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


class StudentRequestAttachment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    request_type = db.Column(db.String(60), nullable=False)
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
    required_hours = db.Column(db.Integer, default=0)
    completed_hours = db.Column(db.Integer, default=0)
    document_status = db.Column(db.String(60), nullable=False, default="Missing")
    certificate_count = db.Column(db.Integer, default=0)
    remarks = db.Column(db.Text)
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


class GraduationEndorsement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    review_window = db.Column(db.String(80), nullable=False, default="Current review window")
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


# Faculty reference data used by panel matching and scheduling availability.
class Faculty(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    college = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(80), nullable=False)
    specialization = db.Column(db.String(160), nullable=False)
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
        "matching_keywords": matching_tokens(faculty.specialization)[:12],
        "email": faculty_contact_email(faculty),
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
        "total_units": audit.get("total_units", 0),
        "completed_units": audit.get("completed_units", 0),
        "units_rate": audit.get("units_rate", 0),
        "by_category": audit.get("by_category", []),
        "eligibility": audit.get("eligibility", {}),
    }


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


def student_portal_stage(student: Student, case: ResearchCase | None) -> str:
    if student.standing == "On Leave":
        return "LOA"
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
        "name": attachment.original_name,
        "uploaded_at": iso(attachment.uploaded_at),
        "url": f"/api/student-request-attachments/{attachment.id}/file",
        "file_exists": file_exists,
        "status": "Uploaded",
        "status_label": "Pending Review",
    }


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
    if record.status in {"MOA Under Review", "Practicum In Progress", "Documents Submitted", "Hours Incomplete", "Additional Certificates Requested"}:
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
        "required_hours": record.required_hours or 0,
        "completed_hours": record.completed_hours or 0,
        "document_status": record.document_status,
        "certificate_count": record.certificate_count or 0,
        "remarks": record.remarks,
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
        "submitted_at": iso(endorsement.submitted_at),
        "dean_decision_at": iso(endorsement.dean_decision_at),
        "registrar_received_at": iso(endorsement.registrar_received_at),
        "created_at": iso(endorsement.created_at),
        "updated_at": iso(endorsement.updated_at),
    }
    if include_student and endorsement.student:
        payload["student"] = student_brief(endorsement.student)
    return payload


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
        "offerings": [course_offering_dict(o) for o in sorted(plan.offerings, key=lambda item: item.demand_count, reverse=True)],
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


def require_api_login(*roles):
    # Pass one or more roles; empty means "any signed-in account".
    allowed = {r for r in roles if r}

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            account = current_account()
            if not account:
                return jsonify({"error": "Please sign in to continue."}), 401
            if allowed and account.role not in allowed:
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
        if role not in ["staff", "student", "dean"]:
            return jsonify({"error": "Choose an account type to sign in."}), 400
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
        return jsonify(dashboard_stats(request.args))

    @app.route("/api/dashboard/drilldown")
    @require_api_login("staff")
    def dashboard_drilldown():
        return jsonify(dashboard_drilldown_payload(request.args))

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
            risk_values = [item.strip() for item in re.split(r"[,/]", risk) if item.strip()]
            query = query.filter(Student.risk_level.in_(risk_values or [risk]))
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
                "items": [student_directory_brief(s) for s in items],
                "total": total,
                "page": page,
                "page_size": page_size,
                "pages": (total + page_size - 1) // page_size,
            }
        )

    @app.route("/api/students/duplicates")
    def students_duplicates():
        return jsonify({"groups": duplicate_student_groups()})

    @app.route("/api/students/merge", methods=["POST"])
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
    @require_api_login("staff")
    def student_detail(student_id: int):
        student = Student.query.get_or_404(student_id)
        audit = compute_course_audit(student)
        research_case, research_progress = sync_research_progress(student)
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
        practicum_record = latest_practicum_record(student.id)
        practicum_eligibility_result = practicum_eligibility(student)
        withdrawal_application = latest_withdrawal_application(student.id)
        graduation_endorsement = latest_graduation_endorsement(student.id)
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
        panel = (
            PanelAssignment.query.filter_by(student_id=student.id)
            .order_by(PanelAssignment.score.desc())
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
        practicum_record = latest_practicum_record(student.id)
        practicum_eligibility_result = practicum_eligibility(student)
        withdrawal_application = latest_withdrawal_application(student.id)
        graduation_endorsement = latest_graduation_endorsement(student.id)
        docs_by_gate: dict[str, list] = {}
        for doc in document_checks:
            docs_by_gate.setdefault(doc.gate, []).append(document_check_dict(doc))

        portal_student = student_brief(student)
        portal_student["current_stage"] = student_portal_stage(student, research_case)

        return jsonify(
            {
                "student": portal_student,
                "stages": STAGES,
                "stage_index": STAGES.index(portal_student["current_stage"]) if portal_student["current_stage"] in STAGES else 0,
                "course_audit": course_audit_dict(audit),
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
                "tasks": [task_dict(t) for t in tasks],
                "logs": [log_dict(l) for l in logs],
                "recommendations": student_portal_recommendations(student),
                "research_milestones": [research_milestone_payload(student, gate) for gate in RESEARCH_MILESTONES],
                "readmission_requirements": readmission_requirements(),
            }
        )

    @app.route("/api/student-portal/requests/research-gate", methods=["POST"])
    @require_api_login("student")
    def student_research_gate_request():
        data = request_payload()
        account = current_account()
        student = Student.query.get_or_404(account.student_id)
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
        gate = (request.form.get("gate") or "").strip()
        item_name = (request.form.get("item_name") or "").strip()
        uploaded = request.files.get("file")
        _research_case, progress = sync_research_progress(student)
        if gate != progress["gate"]:
            return jsonify({"error": f"This upload belongs to {progress['stage']}, the automatically detected current stage."}), 400
        if item_name not in required_documents_for_gate(gate):
            return jsonify({"error": "Choose a valid requirement for this gate."}), 400
        if item_name == "Three concept papers" and PanelAssignment.query.filter_by(student_id=student.id).count():
            return jsonify({"error": "Concept papers are locked because a panel has already been matched."}), 409
        presentation = research_requirement_presentation(gate, item_name)
        if not presentation or presentation["source_type"] != "student_upload":
            return jsonify({"error": "This requirement is completed by staff or by the system and does not accept a student upload."}), 400
        if not uploaded or not uploaded.filename:
            return jsonify({"error": "Choose a PDF file to upload."}), 400
        try:
            if item_name == "Three concept papers":
                revoke_form1_endorsement(student.id)
            evidence = store_research_evidence(student, gate, item_name, uploaded)
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
        except Exception as exc:  # noqa: BLE001
            db.session.rollback()
            return jsonify({"error": str(exc)}), 400
        return jsonify({
            "ok": True,
            "document": document_check_dict(evidence.document_check),
            "research_title": parsed_title or (research_case.title if research_case else ""),
        })

    @app.route("/api/student-portal/research-evidence/<int:evidence_id>", methods=["DELETE"])
    @require_api_login("student")
    def student_research_evidence_delete(evidence_id: int):
        account = current_account()
        student = Student.query.get_or_404(account.student_id)
        evidence = ResearchEvidenceFile.query.filter_by(id=evidence_id, student_id=student.id).first_or_404()
        doc = evidence.document_check
        if doc.item_name != "Three concept papers":
            return jsonify({"error": "Only concept-paper uploads can be removed from the student view."}), 400
        if PanelAssignment.query.filter_by(student_id=student.id).count():
            return jsonify({"error": "Concept papers are locked because a panel has already been matched."}), 409

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

        # The endorsement and panel recommendation approve the exact paper set.
        # Any deletion changes that set, so both downstream results are revoked.
        panel_invalidated = True
        PanelAssignment.query.filter_by(student_id=student.id).delete()
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
            "Concept paper removed",
            "Student" if len(remaining) < required_count else "Academic Coordinator",
            f"Student removed a concept-paper upload. {len(remaining)} of {required_count} remain. "
            "Academic Coordinator endorsement was revoked and Panel Matching was cleared.",
        )
        db.session.commit()
        stored_path.unlink(missing_ok=True)
        return jsonify({
            "ok": True,
            "message": "Concept paper removed. The Academic Coordinator must endorse the completed three-paper set again, and Panel Matching must be rerun.",
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
        if request_type not in {"leave-of-absence", "readmission", "practicum", "withdrawal", "graduation", "graduation-endorsement"}:
            return jsonify({"error": "Choose a valid request type."}), 400
        if not uploaded or not uploaded.filename:
            return jsonify({"error": "Choose a PDF application file."}), 400
        try:
            attachment = store_student_request_attachment(student, request_type, uploaded)
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
            f"Target return term: {data.get('target_return_term') or 'Not specified'}.",
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

    @app.route("/api/student-portal/requests/practicum", methods=["POST"])
    @require_api_login("student")
    def student_practicum_request():
        data = request_payload()
        account = current_account()
        student = Student.query.get_or_404(account.student_id)
        if not student.program.has_practicum:
            return jsonify({"error": "Practicum is available only for programs with practicum requirements."}), 400

        record = latest_practicum_record(student.id)
        if not record:
            record = PracticumRecord(student_id=student.id)
            db.session.add(record)
        apply_practicum_payload(record, data, student)

        if not record.certificate_attachment_id:
            record.status = "MOA Submitted"
            add_task(student.id, "Record and forward practicum MOA", "Graduate School Staff", 3, 45)
            next_owner = "Graduate School Staff"
            message = "MOA submitted. Graduate School staff will record and forward it to the Academic Coordinator."
        elif record.completed_hours < record.required_hours:
            record.status = "Hours Incomplete"
            add_task(student.id, "Review practicum certificates and hours", "Academic Coordinator", 5, 45)
            next_owner = "Academic Coordinator"
            message = "Documents submitted. The Academic Coordinator will review your certificates and completed hours."
        else:
            record.status = "Documents Submitted"
            add_task(student.id, "Verify practicum certificates and completion", "Academic Coordinator", 5, 50)
            next_owner = "Academic Coordinator"
            message = "Documents and hours submitted. Completion remains pending Academic Coordinator verification."

        add_log(
            "practicum",
            student.id,
            "Student",
            record.moa_attachment.original_name if record.moa_attachment else "Student portal",
            f"Practicum submission recorded: {record.status}",
            next_owner,
            practicum_notes(record),
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
            proof = StudentRequestAttachment.query.filter_by(
                id=proof_attachment_id, student_id=student.id, request_type="withdrawal"
            ).first()
            if not proof:
                return jsonify({"error": "Upload a valid withdrawal form/proof PDF."}), 400
            current.proof_attachment_id = proof.id
            current.status = "Requirements Submitted"
            current.updated_at = now_utc()
            add_task(student.id, "Check submitted withdrawal form and proof", "Graduate School Staff", 3, 50)
            add_log("withdrawal", student.id, "Student", proof.original_name, "Withdrawal requirements submitted", "Graduate School Staff", "Approved request follow-through proof is ready for staff verification.")
            db.session.commit()
            return jsonify({"ok": True, "message": "Requirements submitted. Graduate School staff will verify your form and proof."})
        if current and current.status not in {"Denied", "Returned", "Withdrawn Confirmed"}:
            return jsonify({"error": "You already have an active withdrawal request. Follow its current status instead of creating another request."}), 400
        attachment = request_attachment_from_payload(student, "withdrawal", data)
        if not attachment:
            return jsonify({"error": "Upload the completed withdrawal request PDF before submitting."}), 400

        application = WithdrawalApplication(
            student_id=student.id,
            reason=(data.get("reason") or "").strip(),
            effective_term=(data.get("effective_term") or "").strip(),
            request_attachment_id=attachment.id,
            proof_attachment_id=proof_attachment_id or None,
            fee_status="Pending",
            requirement_status="Pending",
            dean_decision="Pending",
            registrar_status="Pending",
            status="Dean Review",
        )
        db.session.add(application)
        db.session.flush()
        add_task(student.id, "Review withdrawal request", "Dean", 3, 60)
        add_log(
            "withdrawal",
            student.id,
            "Student",
            attachment.original_name,
            "Withdrawal request submitted",
            "Dean",
            f"Effective term: {application.effective_term or 'Not specified'}. Reason: {application.reason or 'Not provided'}. File is uploaded and pending review.",
        )
        db.session.commit()
        return jsonify({"ok": True, "message": "Submitted. The Dean will review your withdrawal request before any status change is recorded."})

    @app.route("/api/student-portal/requests/graduation", methods=["POST"])
    @require_api_login("student")
    def student_graduation_request():
        data = request_payload()
        account = current_account()
        student = Student.query.get_or_404(account.student_id)
        attachment = request_attachment_from_payload(student, "graduation", data)
        eligibility = graduation_eligibility(student)
        endorsement = latest_graduation_endorsement(student.id)
        if not endorsement:
            endorsement = GraduationEndorsement(student_id=student.id)
            db.session.add(endorsement)
        apply_graduation_eligibility(endorsement, eligibility)
        endorsement.review_window = (data.get("review_window") or data.get("term") or "Current review window").strip()
        endorsement.request_attachment_id = attachment.id if attachment else endorsement.request_attachment_id
        endorsement.endorsement_status = "For Review" if eligibility["eligible"] else "Not Eligible"
        endorsement.submitted_at = now_utc()
        next_owner = "Graduate School Staff" if eligibility["eligible"] else eligibility["next_owner"]
        add_task(
            student.id,
            "Prepare graduation endorsement review" if eligibility["eligible"] else eligibility["next_action"],
            next_owner,
            5,
            45 if eligibility["eligible"] else 35,
        )
        add_log(
            "graduation",
            student.id,
            "Student",
            attachment.original_name if attachment else "Student portal",
            f"Graduation endorsement request submitted: {endorsement.endorsement_status}",
            next_owner,
            graduation_notes(endorsement),
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
        if not PanelAssignment.query.filter_by(student_id=student.id).first():
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
        if doc.item_name == "Three concept papers" and PanelAssignment.query.filter_by(student_id=student.id).count():
            return jsonify({"error": "Concept papers are locked because a panel has already been matched."}), 409
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
        return send_from_directory(
            UPLOAD_ROOT,
            evidence.stored_name,
            as_attachment=False,
            download_name=evidence.original_name,
            mimetype=evidence.mime_type,
        )

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
    @require_api_login("staff")
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
    @require_api_login("staff")
    def endorse_form1(student_id: int):
        student = Student.query.get_or_404(student_id)
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
        if account.role == "student" and account.student_id != attachment.student_id:
            return jsonify({"error": "You cannot access this file."}), 403
        return send_from_directory(
            REQUEST_UPLOAD_ROOT,
            attachment.stored_name,
            as_attachment=False,
            download_name=attachment.original_name,
            mimetype=attachment.mime_type,
        )

    # Role-filterable work queue.
    @app.route("/api/tasks")
    @require_api_login("staff")
    def tasks_list():
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
            "Student ID", "Student Name", "Program", "Coursework Status", "Research Status",
            "Endorsement Status", "Dean Approval Date", "Dean Remarks", "Registrar Handoff Status",
        ])
        for item in rows:
            item.endorsement_status = "Sent to Registrar"
            item.registrar_status = "Sent - Awaiting Receipt"
            item.updated_at = now_utc()
            add_log(
                "graduation",
                item.student_id,
                f"Dean · {account.full_name}",
                "Approved endorsement CSV",
                "Endorsed graduation list exported and handed off to Registrar",
                "Registrar",
                item.dean_remarks or "Dean-approved Registrar handoff.",
            )
            writer.writerow([
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

    # Faculty reference endpoint for panels and scheduling.
    @app.route("/api/faculty")
    @require_api_login("staff")
    def faculty_list():
        faculty = Faculty.query.filter(Faculty.active.is_(True)).order_by(Faculty.name).all()
        return jsonify({"items": [faculty_profile_dict(f) for f in faculty]})

    @app.route("/api/faculty/<int:faculty_id>/calendar.ics")
    def faculty_calendar_feed(faculty_id: int):
        faculty = Faculty.query.get_or_404(faculty_id)
        return Response(
            faculty_calendar_ics(faculty),
            mimetype="text/calendar",
            headers={"Content-Disposition": f'inline; filename="faculty-{faculty_id}-availability.ics"'},
        )

    @app.route("/api/curriculum-planning")
    @require_api_login("staff")
    def curriculum_planning():
        program_id = request.args.get("program_id", type=int)
        program = Program.query.get(program_id) if program_id else Program.query.order_by(Program.code).first()
        if not program:
            return jsonify({"error": "No program found."}), 404
        return jsonify(curriculum_planning_payload(program))

    @app.route("/api/curriculum-planning/subjects", methods=["POST"])
    @require_api_login("staff")
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
    @require_api_login("staff")
    def curriculum_planning_generate():
        data = request.get_json(silent=True) or {}
        program = Program.query.get_or_404(int(data.get("program_id") or 0))
        scope = data.get("scope") or "active"
        query = Student.query.filter_by(program_id=program.id)
        if scope == "active":
            query = query.filter(Student.standing == "Active")
        students = query.order_by(Student.last_name, Student.first_name).all()
        courses = Course.query.filter_by(program_id=program.id).order_by(Course.code).all()
        created = 0
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
            "message": f"Generated {created} curriculum subject row(s) for {touched_students} student(s).",
            "created": created,
            "students": touched_students,
            "data": curriculum_planning_payload(program),
        })

    @app.route("/api/course-adjustments")
    def course_adjustments():
        program_id = request.args.get("program_id", type=int)
        program = Program.query.get(program_id) if program_id else Program.query.order_by(Program.code).first()
        if not program:
            return jsonify({"error": "No program found."}), 404
        return jsonify(course_adjustments_payload(program))

    @app.route("/api/course-adjustments/plan", methods=["POST"])
    def course_adjustments_plan():
        data = request.get_json(silent=True) or {}
        program = Program.query.get_or_404(int(data.get("program_id") or 0))
        action = data.get("action") or "draft"
        latest_term = AcademicTerm.query.order_by(AcademicTerm.start_date.desc()).first()
        term_label = (data.get("term_label") or "").strip() or (latest_term.label if latest_term else "Current Term")
        plan = (
            CourseOfferingPlan.query.filter_by(program_id=program.id, term_label=term_label)
            .order_by(CourseOfferingPlan.created_at.desc())
            .first()
        )
        if action == "draft":
            if not plan:
                plan = CourseOfferingPlan(program_id=program.id, term_label=term_label, status="Draft")
                db.session.add(plan)
                db.session.flush()
            plan.status = "Draft"
            CourseOffering.query.filter_by(plan_id=plan.id).delete()
            demand_by_course = {row["course"]["id"]: row for row in course_demand_rows(program)}
            # If the Academic Coordinator edited the offer list, honour their choices;
            # otherwise fall back to the demand-suggested offerings.
            selections = data.get("selections")
            if selections:
                plan.notes = data.get("notes") or "Draft set by the Academic Coordinator from the suggested demand."
                for sel in selections:
                    cid = int(sel.get("course_id"))
                    row = demand_by_course.get(cid, {})
                    db.session.add(
                        CourseOffering(
                            plan_id=plan.id,
                            course_id=cid,
                            demand_count=row.get("demand_count", 0),
                            section_count=int(sel.get("section_count") or row.get("suggested_sections", 1)),
                            availability_count=row.get("availability_count", 0),
                            status="Offered" if sel.get("offer", True) else "Not Offered",
                            notes=row.get("recommendation", "Selected by Academic Coordinator"),
                        )
                    )
                result = "Draft offering plan saved from the coordinator's selections"
            else:
                plan.notes = data.get("notes") or "Draft generated from current missing-subject demand."
                for row in course_demand_rows(program):
                    db.session.add(
                        CourseOffering(
                            plan_id=plan.id,
                            course_id=row["course"]["id"],
                            demand_count=row["demand_count"],
                            section_count=row["suggested_sections"],
                            availability_count=row["availability_count"],
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
            plan.status = "Submitted"
            plan.submitted_at = now_utc()
            plan.notes = data.get("notes") or plan.notes
            result = "Offering plan submitted for Dean approval"
        elif action == "publish":
            if not plan:
                return jsonify({"error": "Save a draft offering plan first."}), 400
            if plan.status != "Approved":
                return jsonify({"error": "Only a Dean-approved plan can be published."}), 400
            plan.status = "Published"
            plan.published_at = now_utc()
            plan.notes = data.get("notes") or plan.notes
            result = "Final course offerings published"
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
            "data": course_adjustments_payload(program),
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

        if case_type == "practicum":
            record = PracticumRecord.query.get_or_404(item_id)
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
            add_log("practicum", record.student_id, f"Dean · {account.full_name}", "Approvals", result, next_owner, note or practicum_notes(record))

        elif case_type == "withdrawal":
            application = WithdrawalApplication.query.get_or_404(item_id)
            if application.dean_decision != "Pending":
                return jsonify({"error": "This withdrawal request already has a Dean decision."}), 400
            if decision == "approve":
                application.dean_decision = "Approved"
                application.status = "Approved - Follow-through"
                application.student.current_stage = "Withdrawal In Progress"
                result = "Withdrawal approved by Dean"
                next_owner = "Academic Coordinator"
                add_task(application.student_id, "Perform withdrawal follow-through actions", "Academic Coordinator", 5, 45)
                add_task(application.student_id, "Complete withdrawal requirements", "Student", 7, 40)
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
            add_log("withdrawal", application.student_id, f"Dean · {account.full_name}", "Approvals", result, next_owner, note or withdrawal_notes(application))

        elif case_type == "graduation":
            endorsement = GraduationEndorsement.query.get_or_404(item_id)
            if decision == "approve":
                endorsement.endorsement_status = "Dean Approved"
                endorsement.registrar_status = "Pending Handoff"
                endorsement.dean_decision_at = now_utc()
                result = "Graduation endorsement approved by Dean; Registrar handoff is ready for export"
                next_owner = "Graduate School Staff"
                add_task(endorsement.student_id, "Export and hand off endorsed list to Registrar", "Graduate School Staff", 3, 40)
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
            add_log("graduation", endorsement.student_id, f"Dean · {account.full_name}", "Approvals", result, next_owner, note or graduation_notes(endorsement))
        else:
            return jsonify({"error": "Unknown workflow approval type."}), 404

        db.session.commit()
        return jsonify({"ok": True, "message": result})

    # ---- Course Audit (end-of-term, per-subject roster) ------------------
    @app.route("/api/course-audit/subjects")
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
    def course_audit_roster():
        course_id = request.args.get("course_id", type=int)
        course = Course.query.get_or_404(course_id)
        rows = (
            db.session.query(CourseRecord, Student)
            .join(Student, Student.id == CourseRecord.student_id)
            .filter(CourseRecord.course_id == course_id)
            .order_by(Student.last_name.asc(), Student.first_name.asc())
            .all()
        )
        students = [{
            "student_id": s.id, "name": s.name, "student_number": s.student_number,
            "program_code": s.program.code, "status": rec.status,
            "completed": rec.status == "Completed", "term_label": rec.term_label,
        } for rec, s in rows]
        return jsonify({
            "course": {"id": course.id, "code": course.code, "title": course.title},
            "students": students,
        })

    @app.route("/api/course-audit/roster", methods=["POST"])
    def course_audit_roster_save():
        data = request.get_json(silent=True) or {}
        course = Course.query.get_or_404(int(data.get("course_id") or 0))
        completions = data.get("completions") or {}
        status_updates = data.get("statuses") or data.get("status_updates") or {}
        term = (data.get("term") or "").strip()
        allowed_statuses = {"Completed", "Current", "Enrolled", "Incomplete", "Dropped", "Missing"}
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
                continue
            if new_status not in allowed_statuses:
                continue
            rec = CourseRecord.query.filter_by(student_id=sid, course_id=course.id).first()
            if not rec:
                student = Student.query.get(sid)
                if not student:
                    continue
                rec = CourseRecord(student_id=sid, course_id=course.id)
                db.session.add(rec)
            else:
                student = Student.query.get(sid)
                if not student:
                    continue
            if rec.status == new_status:
                continue
            rec.status = new_status
            rec.updated_at = now_utc()
            rec.evidence_reference = "Course audit update"
            if term:
                rec.term_label = term
            changed += 1
            changed_students.add(student.id)
            status_counts[new_status] = status_counts.get(new_status, 0) + 1
            audit = compute_course_audit(student)
            if audit["missing_count"] == 0 and student.current_stage in ("Admission", "Coursework"):
                student.current_stage = "Proposal Development"
            recompute_risk(student)
            add_log("course-audit", sid, "Academic Coordinator", f"Course audit {term}".strip(),
                    f"{course.code} marked {new_status}",
                    "Academic Coordinator", f"End-of-term course audit for {course.code}.")
        if changed:
            status_summary = ", ".join(f"{status}: {count}" for status, count in sorted(status_counts.items()))
            add_log(
                "course-audit",
                None,
                "Academic Coordinator",
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

    # ---- Reset uploaded monitoring data (so the Excel upload can be re-tested) ----
    @app.route("/api/admin/reset-uploaded-data", methods=["POST"])
    @require_api_login("staff")
    def reset_uploaded_data():
        # Remove students brought in via a monitoring-sheet upload (and the subjects
        # those uploads created). Seeded demo students (GS-2026-*) are kept.
        imported = Student.query.filter(~Student.student_number.like("GS-2026-%")).all()
        ids = [s.id for s in imported]
        if ids:
            PanelAssignment.query.filter(PanelAssignment.student_id.in_(ids)).delete(synchronize_session=False)
            ScheduleRequest.query.filter(ScheduleRequest.student_id.in_(ids)).delete(synchronize_session=False)
            for student in imported:
                db.session.delete(student)  # cascades course records, docs, tasks, logs
        removed_courses = 0
        for course in Course.query.filter(Course.category.in_(["Basic", "Major", "Cognate", "Comprehensive"])).all():
            if CourseRecord.query.filter_by(course_id=course.id).count() == 0:
                db.session.delete(course)
                removed_courses += 1
        db.session.commit()
        return jsonify({
            "ok": True,
            "students_removed": len(ids),
            "courses_removed": removed_courses,
            "message": f"Removed {len(ids)} uploaded student(s) and {removed_courses} imported subject(s). Seeded demo data was kept.",
        })

    @app.route("/api/admin/reset-demo", methods=["POST"])
    @require_api_login("staff")
    def reset_demo_data():
        # Temporary demo control: rebuild the seeded database and clear generated
        # upload storage so the walkthrough can be repeated from the same baseline.
        seed_count = int(os.getenv("DEMO_SEED_COUNT", "350"))
        try:
            db.session.rollback()
            for folder in (UPLOAD_ROOT, REQUEST_UPLOAD_ROOT):
                if folder.exists():
                    shutil.rmtree(folder)
                folder.mkdir(parents=True, exist_ok=True)
            seed_database(seed_count)
            ensure_faculty_demo_names()
            ensure_faculty_demo_profiles()
            ensure_demo_accounts()
            seed_simulation_demo()
            ensure_demo_request_submission_logs()
            sync_all_curricula()
            db.session.commit()
        except Exception as exc:  # noqa: BLE001
            db.session.rollback()
            return jsonify({"error": f"Could not reset demo data: {exc}"}), 500
        return jsonify({
            "ok": True,
            "message": f"Demo reset complete. Rebuilt {seed_count} seeded students and cleared generated uploads.",
        })

    # ---- Monitoring grid (spreadsheet view, one program at a time) -------
    @app.route("/api/monitoring/grid")
    def monitoring_grid():
        program_id = request.args.get("program_id", type=int)
        program = Program.query.get(program_id) if program_id else Program.query.order_by(Program.code).first()
        if not program:
            return jsonify({"error": "No program found."}), 404

        courses = (
            Course.query.filter_by(program_id=program.id).order_by(Course.category, Course.code).all()
        )
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
        records: dict[tuple[int, int], str] = {}
        if sids and cids:
            for rec in CourseRecord.query.filter(
                CourseRecord.student_id.in_(sids), CourseRecord.course_id.in_(cids)
            ).all():
                records[(rec.student_id, rec.course_id)] = rec.status

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

        def milestones(stage: str) -> dict:
            idx = STAGES.index(stage) if stage in STAGES else 0
            return {
                "title": stage != "LOA" and idx >= STAGES.index("Proposal Development"),
                "proposal": idx >= STAGES.index("Proposal Defense"),
                "ethics": idx >= STAGES.index("Data Collection"),
                "final": idx >= STAGES.index("Final Defense"),
            }

        rows = []
        for s in students:
            cells = {}
            done = 0
            done_units = 0
            for c in courses:
                status = records.get((s.id, c.id), "Missing")
                cells[c.id] = status
                if status == "Completed":
                    done += 1
                    done_units += course_units[c.id]
            units_complete = total_units_all > 0 and done_units >= total_units_all
            rows.append({
                "id": s.id, "name": s.name, "student_number": s.student_number,
                "entry_year": s.entry_year, "stage": s.current_stage, "risk": s.risk_level,
                "enrollment_tag": s.enrollment_tag,
                "cells": cells, "completed": done, "total": len(courses),
                "rate": round(done / len(courses) * 100, 1) if courses else 0,
                "completed_units": done_units, "total_units": total_units_all,
                "eligible": units_complete,
                "milestones": milestones(s.current_stage),
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
            "categories": categories,
            "course_count": len(courses),
            "total_units": total_units_all,
            "students": rows,
        })

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
            panel = PanelAssignment.query.filter_by(student_id=item.student_id).order_by(PanelAssignment.score.desc()).all()
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


PRACTICUM_UNIT_REQUIREMENTS = {"Basic": 6, "Major": 9, "Cognate": 6}
PRACTICUM_TOTAL_UNITS_REQUIRED = 21


def practicum_eligibility(student: Student) -> dict:
    """Compute practicum eligibility from monitoring data; staff never keys this manually."""
    audit = compute_course_audit(student)
    completed_by_category = {
        row["category"]: row["completed_units"] for row in audit.get("by_category", [])
    }
    stage_index = STAGES.index(student.current_stage) if student.current_stage in STAGES else 0
    case = (
        ResearchCase.query.filter_by(student_id=student.id)
        .order_by(ResearchCase.opened_at.desc())
        .first()
    )
    title_completed = stage_index >= STAGES.index("Proposal Development")
    proposal_completed = stage_index >= STAGES.index("Data Collection")
    ethics_completed = stage_index >= STAGES.index("Data Collection")
    final_completed = stage_index >= STAGES.index("Final Defense")
    if case:
        title_completed = title_completed or case.current_gate in {
            "Form 4 - Proposal Defense Readiness", "Final Defense", "Completion Evidence"
        }
        proposal_completed = proposal_completed or case.current_gate in {"Final Defense", "Completion Evidence"}
        ethics_completed = ethics_completed or case.current_gate in {"Final Defense", "Completion Evidence"}
        final_completed = final_completed or case.current_gate == "Completion Evidence" or case.status == "Verified Complete"

    basic = completed_by_category.get("Basic", 0)
    major = completed_by_category.get("Major", 0)
    cognate = completed_by_category.get("Cognate", 0)
    total = audit.get("completed_units", 0)
    checklist = [
        {"key": "basic", "label": "Basic units completed", "actual": basic, "required": 6, "complete": basic >= 6},
        {"key": "major", "label": "Major units completed", "actual": major, "required": 9, "complete": major >= 9},
        {"key": "cognate", "label": "Cognate units completed", "actual": cognate, "required": 6, "complete": cognate >= 6},
        {"key": "total", "label": "Total units completed", "actual": total, "required": 21, "complete": total >= 21},
        {"key": "title", "label": "Title stage completed", "complete": title_completed},
        {"key": "proposal", "label": "Proposal stage completed", "complete": proposal_completed},
        {"key": "ethics", "label": "Ethics stage completed", "complete": ethics_completed},
        {"key": "final", "label": "Final stage completed", "complete": final_completed},
    ]
    eligible = bool(student.program.has_practicum and student.standing == "Active" and all(item["complete"] for item in checklist))
    return {
        "eligible": eligible,
        "status": "Eligible for Practicum" if eligible else "Not Eligible",
        "basic_units_completed": basic,
        "major_units_completed": major,
        "cognate_units_completed": cognate,
        "total_units_completed": total,
        "title_completed": title_completed,
        "proposal_completed": proposal_completed,
        "ethics_completed": ethics_completed,
        "final_completed": final_completed,
        "checklist": checklist,
    }


PRACTICUM_TIMELINE = [
    "Eligible for Practicum",
    "MOA Submitted",
    "MOA Under Review",
    "Practicum In Progress",
    "Documents Submitted",
    "Hours Incomplete",
    "Additional Certificates Requested",
    "Completed",
    "Sent to Dean",
    "Dean Reviewed",
]


def practicum_timeline(record: PracticumRecord | None, eligibility: dict) -> list[dict]:
    if not eligibility["eligible"]:
        return [{"label": "Not Eligible", "state": "current"}] + [
            {"label": label, "state": "upcoming"} for label in PRACTICUM_TIMELINE
        ]
    status_alias = {
        "MOA Received": "MOA Submitted",
        "Under Review": "MOA Under Review",
        "Report Sent to Dean": "Sent to Dean",
    }
    current = status_alias.get(record.status if record else "", record.status if record else "Eligible for Practicum")
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
    record.required_hours = max(safe_int(data.get("required_hours"), record.required_hours or 0), 0)
    record.completed_hours = max(safe_int(data.get("completed_hours"), record.completed_hours or 0), 0)
    record.certificate_count = max(safe_int(data.get("certificate_count"), record.certificate_count or 0), 0)
    record.document_status = (data.get("document_status") or record.document_status or "Pending Review").strip()
    record.remarks = (data.get("remarks") or record.remarks or "").strip()
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
    application.dean_decision = (data.get("dean_decision") or application.dean_decision or "Pending").strip()
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
        f"Reason: {application.reason or 'Not provided'}; effective term: {application.effective_term or 'Not specified'}; "
        f"Dean: {application.dean_decision}; requirements: {application.requirement_status}; "
        f"fees: {application.fee_status}; registrar: {application.registrar_status}; "
        f"AC remarks: {application.academic_coordinator_remarks or 'None'}; staff remarks: {application.staff_remarks or 'None'}."
    )


def graduation_eligibility(student: Student) -> dict:
    audit = compute_course_audit(student)
    missing_coursework = [
        f"{row['course'].code} - {row['course'].title}"
        for row in audit["missing"] + audit["incomplete"]
    ]
    coursework_complete = audit["missing_count"] == 0 and audit["eligibility"].get("units_complete")

    research_case = (
        ResearchCase.query.filter_by(student_id=student.id)
        .order_by(ResearchCase.opened_at.desc())
        .first()
    )
    research_missing = []
    research_complete = False
    if research_case:
        completion_payload = research_milestone_payload(student, "Completion Evidence")
        research_missing = [
            f"{item['label']} ({item['status_label']})"
            for item in completion_payload["requirements"]
            if item["status"] != "Complete"
        ]
        research_complete = research_case.status == "Verified Complete" or completion_payload["overall_complete"]
    else:
        research_missing = required_documents_for_gate("Completion Evidence")

    practicum_required = bool(student.program.has_practicum)
    practicum_record = latest_practicum_record(student.id)
    practicum_complete = not practicum_required
    missing_practicum = ""
    practicum_status = "Not Required"
    if practicum_required:
        if practicum_record:
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
    eligible = coursework_complete and research_complete and practicum_complete
    if missing_coursework:
        next_owner = "Academic Coordinator"
        next_action = "Resolve graduation missing coursework"
    elif research_missing:
        next_owner = "Research Coordinator"
        next_action = "Resolve graduation missing research requirements"
    elif missing_practicum:
        next_owner = "Student"
        next_action = "Complete practicum requirements"
    else:
        next_owner = "Graduate School Staff"
        next_action = "Prepare graduation endorsement list"

    return {
        "eligible": bool(eligible),
        "coursework_status": "Complete" if coursework_complete else "Incomplete",
        "research_status": "Complete" if research_complete else "Incomplete",
        "practicum_status": practicum_status if practicum_required else "Not Required",
        "missing_coursework": missing_coursework,
        "missing_research_requirements": research_missing,
        "missing_practicum_requirement": missing_practicum,
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


def graduation_notes(endorsement: GraduationEndorsement) -> str:
    coursework = endorsement.missing_coursework or "None"
    research = endorsement.missing_research_requirements or "None"
    practicum = endorsement.missing_practicum_requirement or "None"
    return (
        f"Review window: {endorsement.review_window}; status: {endorsement.endorsement_status}; "
        f"coursework: {endorsement.coursework_status}; research: {endorsement.research_status}; "
        f"practicum: {endorsement.practicum_status}; missing coursework: {coursework}; "
        f"missing research: {research}; missing practicum: {practicum}; registrar: {endorsement.registrar_status}."
    )


def workflow_approval_item(kind: str, item) -> dict:
    student = item.student
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
        }
    if kind == "withdrawal":
        return {
            "id": item.id,
            "type": kind,
            "title": f"Withdrawal request · {student.name}",
            "subtitle": f"{student.program.code} · effective {item.effective_term or 'term pending'}",
            "status": item.dean_decision,
            "student": student_brief(student),
            "submitted_at": iso(item.created_at),
            "details": withdrawal_notes(item),
        }
    return {
        "id": item.id,
        "type": kind,
        "title": f"Graduation endorsement · {student.name}",
        "subtitle": f"{student.program.code} · {item.review_window}",
        "status": item.endorsement_status,
        "student": student_brief(student),
        "submitted_at": iso(item.submitted_at or item.updated_at),
        "review_window": item.review_window,
        "details": graduation_notes(item),
    }


def workflow_approvals_payload() -> dict:
    pending = []
    pending.extend(
        workflow_approval_item("practicum", item)
        for item in PracticumRecord.query.filter(PracticumRecord.status == "Report Sent to Dean")
        .order_by(PracticumRecord.updated_at.asc())
        .all()
    )
    pending.extend(
        workflow_approval_item("withdrawal", item)
        for item in WithdrawalApplication.query.filter(WithdrawalApplication.dean_decision == "Pending")
        .order_by(WithdrawalApplication.created_at.asc())
        .all()
    )
    pending.extend(
        workflow_approval_item("graduation", item)
        for item in GraduationEndorsement.query.filter(GraduationEndorsement.endorsement_status == "Ready for Dean Review")
        .order_by(GraduationEndorsement.submitted_at.asc())
        .all()
    )
    recent = []
    recent.extend(
        workflow_approval_item("withdrawal", item)
        for item in WithdrawalApplication.query.filter(WithdrawalApplication.dean_decision.in_(["Approved", "Denied", "Returned"]))
        .order_by(WithdrawalApplication.updated_at.desc())
        .limit(6)
        .all()
    )
    recent.extend(
        workflow_approval_item("graduation", item)
        for item in GraduationEndorsement.query.filter(GraduationEndorsement.endorsement_status.in_(["Dean Approved", "Sent to Registrar", "Returned for Revision"]))
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
    overview.extend(workflow_approval_item("practicum", item) for item in PracticumRecord.query.order_by(PracticumRecord.updated_at.desc()).limit(100).all())
    overview.extend(workflow_approval_item("withdrawal", item) for item in WithdrawalApplication.query.order_by(WithdrawalApplication.updated_at.desc()).limit(100).all())
    overview.extend(workflow_approval_item("graduation", item) for item in GraduationEndorsement.query.order_by(GraduationEndorsement.updated_at.desc()).limit(100).all())
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
    # Queue rows are pending student submissions, not every uploaded PDF. Once staff
    # records a Dean decision or returns the case, the latest workflow log is no
    # longer the student's submission and the row drops out of the queue.
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
        if not latest_log or latest_log.id != log.id:
            continue
        student = Student.query.get(log.student_id)
        if not student:
            continue
        attachment = latest_request_attachment(student.id, request_type)
        row = {
            **student_brief(student),
            "request_log_id": log.id,
            "submitted_at": iso(log.created_at),
            "source_reference": log.source_reference,
            "notes": log.notes,
            "last_result": None,
            "attachment": attachment.original_name if attachment else log.source_reference,
            "attachment_detail": attachment_dict(attachment),
            "status": "Pending Review",
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
                "request_label": request_notes_value(log.notes, "Target return term") or "Readmission request",
                "target_return_term": request_notes_value(log.notes, "Target return term"),
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
        })
    return rows


def withdrawal_roster_payload() -> list[dict]:
    return [
        withdrawal_application_dict(item)
        for item in WithdrawalApplication.query.order_by(WithdrawalApplication.created_at.desc()).all()
    ]


def graduation_candidate_payload() -> list[dict]:
    students = (
        Student.query.filter(
            Student.current_stage.in_(["Writing", "Final Defense", "Completed"]),
            Student.standing != "Withdrawn",
        )
        .order_by(Student.last_name.asc(), Student.first_name.asc())
        .all()
    )
    rows = []
    for student in students:
        eligibility = graduation_eligibility(student)
        endorsement = latest_graduation_endorsement(student.id)
        rows.append({
            "student": student_brief(student),
            "eligibility": eligibility,
            "endorsement": graduation_endorsement_dict(endorsement) if endorsement else None,
        })
    return rows


def serialize_transaction_context(slug: str, selected_student_id: int | None, specialization: str = "") -> dict:
    # Context responses are read-only preparation data for workflow screens.
    # The actual record changes happen only in the transaction handlers.
    selected_student = None
    if slug != "student-handoff" and selected_student_id:
        selected_student = Student.query.get(selected_student_id)

    recent_logs = (
        human_activity_query()
        .filter(TransactionLog.transaction_slug == slug)
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
                "Ethics Review",
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
            research_case, progress = sync_research_progress(selected_student)
            context["research_case"] = research_case_dict(research_case)
            context["research_progress"] = progress
            context["current_milestone"] = progress["milestone"]
            context["form1_endorsement"] = form1_endorsement_dict(
                Form1Endorsement.query.filter_by(student_id=selected_student.id).first()
            )
            final_panel = (
                PanelAssignment.query.filter_by(student_id=selected_student.id)
                .order_by(PanelAssignment.score.desc())
                .all()
            )
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
                for row in recommend_panel(selected_student)[: max(12, len(panel_roles_for_student(selected_student)), 4)]
            ]
            context["assigned_panel"] = [
                panel_assignment_dict(p)
                for p in PanelAssignment.query.filter_by(student_id=selected_student.id)
                .order_by(PanelAssignment.score.desc())
                .all()
            ]
        if slug == "defense-scheduling":
            research_case, progress = sync_research_progress(selected_student)
            assignments = (
                PanelAssignment.query.filter_by(student_id=selected_student.id)
                .order_by(PanelAssignment.score.desc())
                .all()
            )
            context["assigned_panel"] = [panel_assignment_dict(p) for p in assignments]
            requirements = progress["milestone"]["requirements"]
            context["schedule_readiness"] = {
                "stage": progress["stage"],
                "gate": progress["gate"],
                "status": progress["status"],
                "ready": progress["milestone"]["overall_complete"],
                "requirements": requirements,
                "completed_count": sum(item["status"] == "Complete" for item in requirements),
                "pending_count": sum(item["status"] != "Complete" for item in requirements),
                "research_title": research_case.title,
                "adviser_name": research_case.adviser_name or selected_student.adviser_name,
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
        "Ethics Review": "Ethics Review",
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
    ranks = {"Completed": 5, "Current": 4, "Enrolled": 4, "Incomplete": 3, "Dropped": 2, "Missing": 1}
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

    target_panel_keys = {(p.faculty_id, p.panel_role): p for p in PanelAssignment.query.filter_by(student_id=target.id).all()}
    for panel in PanelAssignment.query.filter_by(student_id=source.id).all():
        existing = target_panel_keys.get((panel.faculty_id, panel.panel_role))
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
    subject_categories = {}  # code -> Basic / Major / Cognate
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
            subjects.append((c, code))
            subject_categories[code] = current_group

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
    return {
        "program_code": program_code,
        "subjects": [s[1] for s in subjects],
        "subject_categories": subject_categories,
        "rows": rows,
    }


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

    return {
        "conflicting": bool(differences),
        "differences": differences,
        "incoming_completed": incoming_completed,
        "existing_completed": existing_completed,
        "incoming_total": len(row["subjects"]),
    }


def import_ac_monitoring(parsed: dict) -> dict:
    program = Program.query.filter_by(code=parsed["program_code"]).first()
    if not program:
        program = Program(code=parsed["program_code"], name=f"{parsed['program_code']} (imported)", college="Imported")
        db.session.add(program)
        db.session.flush()

    # ensure a Course row exists for each subject code on the sheet (for this program)
    categories = parsed.get("subject_categories", {})
    course_by_code: dict[str, Course] = {}
    for code in parsed["subjects"]:
        category = categories.get(code, "Core")
        existing = Course.query.filter_by(program_id=program.id, code=code).first()
        if not existing:
            existing = Course(program_id=program.id, code=code, title=code, units=3, category=category)
            db.session.add(existing)
            db.session.flush()
        elif (existing.category or "Core") == "Core" and category != "Core":
            existing.category = category
        course_by_code[code] = existing

    term = AcademicTerm.query.order_by(AcademicTerm.start_date.desc()).first()

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
        student.first_name = row["first_name"] or student.first_name or "—"
        student.last_name = row["last_name"] or student.last_name or "—"
        student.program_id = program.id
        student.entry_year = entry_year
        if is_new or not student.email:
            student.email = f"{str(row['idno']).lower()}@student.usls.edu.ph"
        completed = sum(1 for v in row["subjects"].values() if v)
        student.current_stage = _stage_from_sheet(row["milestones"], completed)
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
            rec.term_label = row["ay_entry"]
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
    sync_student_curriculum(student)

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
        student.enrollment_tag = "LOA"
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
        student.enrollment_tag = "Enrolled"
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
    # Research gate status is derived only from stored student uploads. Staff
    # can evaluate evidence, but cannot assert that an absent file was received.
    student = Student.query.get_or_404(int(data["student_id"]))
    research_case, progress = sync_research_progress(student)
    gate = progress["gate"]
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
            and research_milestone_submission(student, gate)
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
        existing.status = status
        if existing.evidence_files:
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
    matching_profile = research_matching_profile(student)
    if not matching_profile["ready"]:
        raise ValueError("Panel matching requires readable text extracted from all three concept-paper PDFs. Replace scanned or image-only files with searchable PDFs.")
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

    PanelAssignment.query.filter_by(student_id=student.id).delete()
    for index, row in enumerate(selected_rows):
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
        f"{len(required_roles)}-member {research_case_type(student)} panel matched from uploaded concept papers",
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
    ]
    if missing_requirements and not override_requirements:
        raise ValueError(
            "Research Gate requirements are still pending: "
            + ", ".join(missing_requirements)
            + ". Review them or confirm the staff override."
        )
    panel = PanelAssignment.query.filter_by(student_id=student.id).all()
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
    if not lead_ok:
        status_reason.append(f"{defense_type} needs at least {lead_days} days lead time")
    if not selected_start or not selected_end:
        status_reason.append("select a shared start and end time")
    elif not selected_window_ok:
        status_reason.append(f"only {matched_count} of {len(participants)} participants share that time")
    conflicts = defense_schedule_conflicts(
        student, panel, preferred_date, selected_start, selected_end, venue
    )
    status_reason.extend(conflicts)
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
        ScheduleRequest.query.filter_by(student_id=student.id)
        .order_by(ScheduleRequest.created_at.desc())
        .first()
    )
    action_label = "Rescheduled" if previous_schedule else "Scheduled"
    if previous_schedule and previous_schedule.status in ACTIVE_DEFENSE_STATUSES:
        previous_schedule.status = "Cancelled"
        previous_schedule.conflict_reason = "Superseded by a staff-approved reschedule."
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

    if requested_status in {"MOA Under Review", "Practicum In Progress"}:
        record.status = requested_status
        record.moa_status = "Under Review" if requested_status == "MOA Under Review" else "Verified"
        next_owner = "Academic Coordinator"
        add_task(student.id, "Review practicum MOA and certificates", "Academic Coordinator", 5, 30)
    elif requested_status in {"Hours Incomplete", "Additional Certificates Requested"}:
        record.status = "Additional Certificates Requested"
        add_task(student.id, "Submit additional practicum certificates", "Student", 7, 45)
        student.risk_level = "Medium"
        next_owner = "Student"
    elif requested_status == "Dean Reviewed":
        record.status = "Dean Reviewed"
        record.dean_reviewed_at = now_utc()
        next_owner = "Graduate School Staff"
    elif requested_status in {"Report Sent to Dean", "Completed"}:
        if record.completed_hours < record.required_hours:
            raise ValueError("Practicum cannot be completed until the required hours are met.")
        if record.document_status not in {"Verified", "Complete"} and requested_status == "Report Sent to Dean":
            raise ValueError("Verify the practicum documents before sending the report to the Dean.")
        record.status = requested_status
        if requested_status == "Report Sent to Dean":
            record.report_sent_at = record.report_sent_at or now_utc()
            add_task(student.id, "Review practicum status report", "Dean", 5, 35)
            next_owner = "Dean"
        else:
            record.document_status = "Verified"
            next_owner = "Academic Coordinator"
    else:
        record.status = requested_status or record.status or "MOA Submitted"
        next_owner = "Graduate School Staff"

    add_log(
        "practicum",
        student.id,
        "Graduate School Staff / Academic Coordinator",
        data.get("source_reference", "") or (record.moa_attachment.original_name if record.moa_attachment else "Practicum workflow"),
        f"Practicum status updated: {record.status}",
        next_owner,
        practicum_notes(record),
    )
    return student.id


def handle_withdrawal(data: MultiDict) -> int:
    student = Student.query.get_or_404(int(data["student_id"]))
    application = latest_withdrawal_application(student.id)
    if not application:
        application = WithdrawalApplication(student_id=student.id)
        db.session.add(application)
    apply_withdrawal_payload(application, data)

    if application.dean_decision == "Denied":
        application.status = "Denied"
        student.standing = "Active"
        if student.current_stage == "Withdrawal In Progress":
            student.current_stage = "Coursework"
        next_owner = "Graduate School Staff"
        result = "Withdrawal denied; student informed and remains Active"
    elif application.dean_decision == "Returned":
        application.status = "Returned"
        next_owner = "Student"
        result = "Withdrawal returned for revision"
        add_task(student.id, "Revise withdrawal request", "Student", 5, 35)
    elif application.dean_decision == "Approved":
        student.current_stage = "Withdrawal In Progress"
        if application.requirement_status != "Complete":
            application.status = "Requirements Pending"
            next_owner = "Student"
            result = "Withdrawal approved; waiting for student requirements"
            add_task(student.id, "Complete withdrawal requirements", "Student", 7, 40)
        elif application.fee_status != "Cleared" or application.registrar_status not in {"Confirmed", "Record Updated"}:
            application.status = "Registrar Review"
            next_owner = "Registrar"
            result = "Withdrawal requirements complete; registrar confirmation needed"
            add_task(student.id, "Confirm fee status / update withdrawal record", "Registrar", 5, 45)
        else:
            application.status = "Withdrawn Confirmed"
            application.completed_at = application.completed_at or now_utc()
            student.standing = "Withdrawn"
            student.current_stage = "Withdrawn"
            student.enrollment_tag = "Withdrawn"
            next_owner = "Graduate School Staff"
            result = "Confirmed withdrawal recorded; student is now withdrawn"
            add_task(student.id, "Record confirmed withdrawal notice", "Graduate School Staff", 2, 30)
    else:
        application.status = "Dean Review"
        next_owner = "Dean"
        result = "Withdrawal request recorded for Dean review"
        add_task(student.id, "Review withdrawal request", "Dean", 3, 60)

    add_log(
        "withdrawal",
        student.id,
        "Graduate School Staff",
        data.get("source_reference", "") or "Withdrawal workflow",
        result,
        next_owner,
        withdrawal_notes(application),
    )
    return student.id


def handle_graduation(data: MultiDict) -> int:
    student = Student.query.get_or_404(int(data["student_id"]))
    endorsement = latest_graduation_endorsement(student.id)
    if not endorsement:
        endorsement = GraduationEndorsement(student_id=student.id)
        db.session.add(endorsement)
    eligibility = graduation_eligibility(student)
    apply_graduation_eligibility(endorsement, eligibility)
    endorsement.review_window = (data.get("review_window") or endorsement.review_window or "Current review window").strip()
    requested_status = (data.get("endorsement_status") or "").strip()
    if data.get("dean_remarks"):
        endorsement.dean_remarks = data.get("dean_remarks")
    if data.get("registrar_status"):
        endorsement.registrar_status = data.get("registrar_status")

    if not eligibility["eligible"]:
        endorsement.endorsement_status = "Not Eligible"
        next_owner = eligibility["next_owner"]
        result = "Graduation candidate marked not eligible; missing requirements listed"
        add_task(student.id, eligibility["next_action"], next_owner, 7, 35)
    elif requested_status == "Ready for Dean Review":
        endorsement.endorsement_status = "Ready for Dean Review"
        endorsement.submitted_at = now_utc()
        next_owner = "Dean"
        result = "Graduation endorsement list prepared for Dean review"
        add_task(student.id, "Review graduation endorsement list", "Dean", 5, 55)
    elif requested_status == "For Review":
        endorsement.endorsement_status = "For Review"
        next_owner = "Graduate School Staff"
        result = "Graduation endorsement list prepared for staff review"
    elif requested_status == "Sent to Registrar":
        raise ValueError("Only the Dean can export and hand off an approved endorsement list to the Registrar.")
    elif requested_status == "Returned for Revision":
        endorsement.endorsement_status = "Returned for Revision"
        next_owner = "Graduate School Staff"
        result = "Graduation endorsement list revised after return"
    else:
        endorsement.endorsement_status = "For Review"
        next_owner = "Graduate School Staff"
        result = "Graduation endorsement candidate reviewed"

    add_log(
        "graduation",
        student.id,
        "Graduate School Staff",
        data.get("source_reference", "") or "Graduation endorsement workflow",
        result,
        next_owner,
        graduation_notes(endorsement),
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
    """Stable demo contact address without requiring a schema migration."""
    base = re.sub(r"[^a-z0-9]+", ".", re.sub(r"^dr\.?\s+", "", faculty.name.lower())).strip(".")
    return f"{base}@usls.edu.ph"


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


def extract_pdf_text(path: Path) -> str:
    try:
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception:
        return ""
    # PDF extraction can yield lone surrogate code points that the DB driver cannot
    # encode, and the stored column is a MySQL TEXT (max 65,535 bytes). Drop invalid
    # characters and cap to a UTF-8 byte budget so storage is safe on both backends.
    # The first ~60 KB (title, abstract, introduction, methods) is more than enough
    # for keyword matching.
    text = text.encode("utf-8", "ignore").decode("utf-8", "ignore")
    encoded = text.encode("utf-8")
    if len(encoded) > 60000:
        text = encoded[:60000].decode("utf-8", "ignore")
    return text


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
    evidence = ResearchEvidenceFile(
        student_id=student.id,
        document_check_id=doc.id,
        original_name=original_name,
        stored_name=stored_name,
        mime_type="application/pdf",
        extracted_text=extract_pdf_text(target),
    )
    db.session.add(evidence)
    doc.status = "Submitted"
    doc.evidence_reference = original_name
    doc.updated_at = now_utc()
    db.session.flush()
    return evidence


def store_student_request_attachment(student: Student, request_type: str, uploaded) -> StudentRequestAttachment:
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


def paper_excerpt(text: str, limit: int = 220) -> str:
    cleaned = re.sub(r"\s+", " ", text or "").strip()
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[:limit].rsplit(" ", 1)[0] + "..."


def research_matching_profile(student: Student) -> dict:
    research_case = (
        ResearchCase.query.filter_by(student_id=student.id)
        .order_by(ResearchCase.opened_at.desc())
        .first()
    )
    concept_files = (
        ResearchEvidenceFile.query.join(DocumentCheck)
        .filter(
            ResearchEvidenceFile.student_id == student.id,
            DocumentCheck.item_name == "Three concept papers",
        )
        .order_by(ResearchEvidenceFile.uploaded_at.desc())
        .all()
    )
    # Only the latest three PDFs make up the current concept-paper set. Older
    # replacement uploads stay in the audit trail but do not skew retrieval.
    analyzed_files = concept_files[:3]
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
    readable_files = [item for item in analyzed_files if (item.extracted_text or "").strip()]
    title = research_case.title if research_case else ""
    # Ground matching in PDF body text only. Filenames, research titles, and
    # program labels are display metadata and never enter keyword extraction.
    paper_text = "\n".join(item.extracted_text or "" for item in readable_files)
    query_text = paper_text.strip()
    keywords = extract_research_phrases(paper_text, 16)
    return {
        "research_title": title,
        "concept_paper_count": len(analyzed_files),
        "concept_papers": [
            {
                "id": item.id,
                "name": item.original_name,
                "url": f"/api/research-evidence/{item.id}/file",
                "extracted": bool((item.extracted_text or "").strip()),
                "keywords": extract_research_phrases(item.extracted_text or "", 6),
                "excerpt": paper_excerpt(item.extracted_text or ""),
            }
            for item in analyzed_files
        ],
        "keywords": keywords,
        "query_text": query_text,
        "readable_paper_count": len(readable_files),
        "ready": len(analyzed_files) >= 3 and len(readable_files) >= 3,
        "source": "PDF body text only; research titles and filenames excluded" if len(readable_files) >= 3 else "Waiting for readable PDF body text",
    }


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
            for row in PanelAssignment.query.filter_by(student_id=schedule.student_id).all()
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
) -> list[str]:
    if not selected_start or not selected_end:
        return []
    participant_ids = {item["faculty"].id for item in defense_participants(student, assignments)}
    conflicts = []
    candidates = ScheduleRequest.query.filter(
        ScheduleRequest.student_id != student.id,
        ScheduleRequest.preferred_date == day,
        ScheduleRequest.status.in_(ACTIVE_DEFENSE_STATUSES),
    ).all()
    for schedule in candidates:
        if not schedule.start_time or not schedule.end_time:
            continue
        if selected_start >= schedule.end_time or selected_end <= schedule.start_time:
            continue
        other = schedule.student
        label = f"{other.name} ({other.student_number})" if other else f"schedule #{schedule.id}"
        shared = participant_ids & schedule_panel_ids(schedule)
        if shared:
            names = [Faculty.query.get(faculty_id).name for faculty_id in shared if Faculty.query.get(faculty_id)]
            conflicts.append(f"Panel conflict with {label}: {', '.join(names)} already scheduled.")
        if venue.strip() and schedule.venue.strip().casefold() == venue.strip().casefold():
            conflicts.append(f"Venue conflict with {label}: {schedule.venue} is already booked.")
    return conflicts


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
        "description": "Submit the proposal manuscript and consultation evidence. Adviser endorsement and the confirmed schedule are recorded separately.",
    },
    "Ethics Review": {
        "label": "Ethics Review",
        "short_label": "Ethics Review",
        "description": "Upload the approved ethics clearance before moving to final-defense preparation.",
    },
    "Final Defense": {
        "label": "Final Defense Readiness",
        "short_label": "Final Defense",
        "description": "Submit the final manuscript and required clearance. Staff verifies distribution and the confirmed defense schedule.",
    },
    "Completion Evidence": {
        "label": "Final Submission and Completion",
        "short_label": "Completion",
        "description": "Submit the final manuscript, approvals, similarity certificate, and completion forms for final verification.",
    },
}

# The first incomplete milestone is the student's detected Research Gate stage.
# Completion Evidence remains available to graduation checks, but it does not
# create a fifth student-facing research stage.
RESEARCH_STAGE_SEQUENCE = [
    ("Title Defense", "Form 1 - Title Defense"),
    ("Proposal Defense", "Form 4 - Proposal Defense Readiness"),
    ("Ethics Review", "Ethics Review"),
    ("Final Defense", "Final Defense"),
]

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
    "Recommended panel set": {
        "label": "Panel assignment",
        "description": "Generated after the Research Coordinator completes Panel Matching.",
        "source_type": "system_panel",
        "required_file_count": 0,
    },
    "Form 4 - Endorsement for Proposal Defense": {
        "label": "Signed Form 4 endorsement",
        "description": "The endorsed application for proposal defense.",
        "source_type": "staff",
        "required_file_count": 0,
    },
    "Proposal manuscript": {
        "label": "Proposal manuscript",
        "description": "The proposal manuscript that will be reviewed by the panel.",
        "source_type": "student_upload",
        "required_file_count": 1,
    },
    "Adviser e-signature/endorsement": {
        "label": "Adviser endorsement",
        "description": "Recorded by the adviser after manuscript review.",
        "source_type": "staff",
        "required_file_count": 0,
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
    "Form 4 - Endorsement for Final Defense": {
        "label": "Final defense endorsement",
        "description": "Recorded by the adviser or Research Coordinator after final-manuscript review.",
        "source_type": "staff",
        "required_file_count": 0,
    },
    "Final manuscript": {
        "label": "Final defense manuscript",
        "description": "The manuscript that will be distributed to the final defense panel.",
        "source_type": "student_upload",
        "required_file_count": 1,
    },
    "Ethics Clearance": {
        "label": "Ethics clearance",
        "description": "Upload the approved ethics clearance issued for the research.",
        "source_type": "student_upload",
        "required_file_count": 1,
    },
    "Panel received manuscript at least 14 days before defense": {
        "label": "Panel manuscript distribution verified",
        "description": "Staff verifies that the panel received the manuscript at least 14 days before defense.",
        "source_type": "staff",
        "required_file_count": 0,
    },
    "Agreed final defense schedule": {
        "label": "Confirmed final defense schedule",
        "description": "Added automatically after staff confirms a shared final defense schedule.",
        "source_type": "system_final_schedule",
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
    source_type = presentation["source_type"]
    files = doc.evidence_files if doc else []
    if source_type == "student_upload":
        enough_files = len(files) >= presentation["required_file_count"]
        if not enough_files:
            return {"status": "Missing", "status_label": "Upload required"}
        if doc and doc.status == "Complete":
            return {"status": "Complete", "status_label": "Verified"}
        return {"status": "Submitted", "status_label": "Submitted for review"}
    if source_type == "system_panel":
        complete = bool(student) and PanelAssignment.query.filter_by(student_id=student.id).count() >= len(panel_roles_for_student(student))
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
    if source_type in {"system_proposal_schedule", "system_final_schedule"}:
        schedule_query = ScheduleRequest.query.filter(
            ScheduleRequest.student_id == student.id,
            ScheduleRequest.status.in_(ACTIVE_DEFENSE_STATUSES),
        ) if student else None
        schedules = schedule_query.order_by(ScheduleRequest.created_at.desc()).all() if schedule_query else []
        expected = "Proposal Defense" if source_type == "system_proposal_schedule" else "Final Defense"
        complete = any(expected in (schedule.notes or "") for schedule in schedules)
        return {"status": "Complete" if complete else "Pending", "status_label": "Completed" if complete else "Pending confirmed schedule"}
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
        requirements.append({
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
                {"id": item.id, "name": item.original_name, "mime_type": item.mime_type, "uploaded_at": iso(item.uploaded_at), "url": f"/api/research-evidence/{item.id}/file"}
                for item in files
            ],
        })
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
    if any(item["status"] == "Missing" for item in requirements if item["student_upload"]):
        return "Missing Requirements"
    if any(item["status"] == "Submitted" for item in requirements):
        return "Awaiting Review"
    return "Pending Staff Action"


def detected_research_progress(student: Student) -> dict:
    stages = []
    detected_index = len(RESEARCH_STAGE_SEQUENCE) - 1
    for index, (stage_name, gate) in enumerate(RESEARCH_STAGE_SEQUENCE):
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
    for stage_name, gate in RESEARCH_STAGE_SEQUENCE[len(stages):]:
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
            status=progress["status"],
            adviser_name=student.adviser_name,
        )
        db.session.add(research_case)
    else:
        # Only student form/document data may replace the displayed title.
        if clean_title:
            research_case.title = clean_title
        research_case.current_gate = progress["gate"]
        research_case.status = progress["status"]
        research_case.adviser_name = student.adviser_name

    lifecycle_stage = {
        "Title Defense": "Proposal Development",
        "Proposal Defense": "Proposal Defense",
        "Ethics Review": "Data Collection",
        "Final Defense": "Final Defense",
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
        ]
    if gate == "Form 4 - Proposal Defense Readiness":
        return [
            "Form 4 - Endorsement for Proposal Defense",
            "Proposal manuscript",
            "Adviser e-signature/endorsement",
            "Form 4.1 Statistical Consultation Form or qualitative exemption",
            "Agreed defense schedule in Form 4",
        ]
    if gate == "Ethics Review":
        return ["Ethics Clearance"]
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
        return ["Panel Chair", "Content Specialist", "Method Specialist", "External Panel"]
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
        elif status in ["Incomplete", "Dropped"]:
            incomplete.append(row)
        else:
            missing.append(row)

    # Eligibility is unit-driven (per AC notes): comprehensive, final proposal, and
    # the thesis milestones all require the curriculum's total units to be completed.
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
    curriculum = courses if courses is not None else Course.query.filter_by(program_id=student.program_id).all()
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
        result = sync_program_curriculum(program)
        created += result["created"]
        touched += result["students"]
    return {"created": created, "students": touched}


def curriculum_planning_payload(program: Program) -> dict:
    courses = Course.query.filter_by(program_id=program.id).order_by(Course.category, Course.code).all()
    students = Student.query.filter_by(program_id=program.id).order_by(Student.last_name, Student.first_name).all()
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
        if missing_rows == 0 and courses:
            generated_count += 1
        rows.append({
            **student_brief(student),
            "curriculum_rows": record_count,
            "required_subjects": len(courses),
            "missing_curriculum_rows": missing_rows,
            "curriculum_status": "Synced" if missing_rows == 0 and courses else "Sync pending",
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
        "summary": {
            "students": len(students),
            "active": active_count,
            "delayed_or_loa": delayed_count + loa_count,
            "curriculum_generated": generated_count,
            "needs_generation": max(len(students) - generated_count, 0),
            "subjects": len(courses),
            "coverage_rate": round((generated_count / len(students)) * 100, 1) if students else 100,
        },
        "categories": [{"name": name, "courses": grouped[name]} for name in sorted(grouped)],
        "students": rows[:150],
    }


def course_demand_rows(program: Program) -> list[dict]:
    # Subject demand counts only currently ENROLLED students who have not yet taken
    # the subject (LOA / AWOL / Completed are excluded), per the AC's process.
    demand: dict[int, dict] = {}
    students = (
        Student.query.filter_by(program_id=program.id, enrollment_tag="Enrolled")
        .order_by(Student.last_name)
        .all()
    )
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
        audit = compute_course_audit(student)
        for item in audit["missing"] + audit["incomplete"]:
            course = item["course"]
            if course.id not in demand:
                demand[course.id] = {"course": course, "students": []}
            demand[course.id]["students"].append(student)

    rows = []
    for item in demand.values():
        count = len(item["students"])
        suggested_sections = max(1, (count + 24) // 25)
        if count >= 15:
            recommendation = "Offer this term"
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


def course_adjustments_payload(program: Program) -> dict:
    demand = course_demand_rows(program)
    latest_plan = (
        CourseOfferingPlan.query.filter_by(program_id=program.id)
        .order_by(CourseOfferingPlan.updated_at.desc())
        .first()
    )
    return {
        "program": program_dict(program),
        "programs": [program_dict(p) for p in Program.query.order_by(Program.code).all()],
        "summary": {
            "demand_subjects": len(demand),
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
    # Local retrieval ranks faculty profiles only against body text extracted
    # from the three concept papers. Operational constraints are added after
    # semantic/token overlap so the result remains explainable.
    profile = research_matching_profile(student)
    query_counts = Counter(matching_tokens(profile["query_text"]))
    analyzed_phrases = profile.get("keywords", [])
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
        faculty_profile_text = f"{faculty.specialization} {faculty.role} {faculty.college}"
        faculty_tokens = set(matching_tokens(faculty_profile_text))
        faculty_phrase_text = faculty_profile_text.lower()
        matched_keywords = [token for token, _count in query_counts.most_common() if token in faculty_tokens][:6]
        matched_phrases = [
            phrase
            for phrase in analyzed_phrases
            if " " in phrase
            and (
                set(matching_tokens(phrase)).issubset(faculty_tokens)
                or phrase.lower() in faculty_phrase_text
            )
        ][:6]
        # Transparent 50/30/20 rubric. Keyword frequency is capped so repeated
        # boilerplate in a PDF cannot dominate a faculty profile match.
        keyword_points = sum(min(query_counts[token], 3) for token in matched_keywords)
        specialization_score = min(50, keyword_points * 7 + len(matched_phrases) * 4)
        recurring_days = sum(1 for item in faculty_working_hours(faculty) if item["enabled"])
        availability_score = min(30, availability_count * 6)
        if not availability_count and recurring_days:
            availability_score = 12
        college_fit = 6 if student.program.college == faculty.college else 0
        workload_fit = max(0, 10 - min(workload, 5) * 2)
        active_profile_fit = 4
        suitability_score = min(20, college_fit + workload_fit + active_profile_fit)
        score = specialization_score + availability_score + suitability_score
        availability_status = (
            "Available" if availability_count >= 3 else
            "Limited availability" if availability_count or recurring_days else
            "No availability recorded"
        )
        reasons = []
        if matched_phrases:
            reasons.append(f"matches {', '.join(matched_phrases[:2])}")
        elif matched_keywords:
            reasons.append(f"matches {', '.join(matched_keywords[:3])}")
        if student.program.college == faculty.college:
            reasons.append("same college")
        reasons.append(availability_status.lower())
        reasons.append(f"{workload} active panel assignment{'s' if workload != 1 else ''}")
        note = "; ".join(reasons)
        rows.append({
            "faculty": faculty,
            "score": score,
            "note": note,
            "matched_keywords": matched_phrases or matched_keywords,
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
            category = "Basic" if idx <= 2 else "Major" if idx <= 5 else "Cognate" if idx <= 7 else "Core"
            db.session.add(
                Course(
                    program_id=program.id,
                    code=f"{program.code}-{500 + idx}",
                    title=f"{title} ({program.code})",
                    units=3,
                    recommended_term=f"Year {1 if idx <= 4 else 2}",
                    category=category,
                )
            )

    specializations = [
        "Finance, business analytics, accounting, and financial technology",
        "Health informatics, public health, and medical systems",
        "Education technology, learning analytics, and curriculum development",
        "Governance, public administration, policy, and law",
        "Psychology, student well-being, and behavioral research",
        "Engineering systems, automation, and energy systems",
        "Statistics, predictive analytics, and data modeling",
        "Research ethics, qualitative methods, and technical writing",
    ]
    for idx in range(1, 56):
        college = COLLEGES[idx % len(COLLEGES)]
        faculty = Faculty(
            name=FACULTY_DEMO_NAMES[idx - 1],
            college=college,
            role="Adviser / Panel",
            specialization=specializations[idx % len(specializations)],
            active=True,
        )
        db.session.add(faculty)
        db.session.flush()
        for weekday in range(5):
            db.session.add(
                FacultyWorkingHour(
                    faculty_id=faculty.id,
                    weekday=weekday,
                    start_time=time(8, 0),
                    end_time=time(17, 0),
                    enabled=True,
                )
            )
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
        # Shared afternoon blocks make the scheduling demo reliably produce
        # options while the varied morning blocks still show real constraints.
        for shared_offset in [14, 21, 28, 35]:
            db.session.add(
                FacultyAvailability(
                    faculty_id=faculty.id,
                    available_date=date.today() + timedelta(days=shared_offset),
                    start_time=time(13, 0),
                    end_time=time(16, 0),
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
        # Current-term enrollment tag: LOA on leave, a few AWOL, graduated = Completed, else Enrolled.
        if stage == "LOA":
            enrollment_tag = "LOA"
        elif stage == "Completed":
            enrollment_tag = "Completed"
        elif idx % 23 == 0:
            enrollment_tag = "AWOL"
        else:
            enrollment_tag = "Enrolled"
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
            enrollment_tag=enrollment_tag,
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

    sync_all_curricula()
    seed_workflow_cases()

    # A few demo submitted LOA / Readmission requests so the staff queues are populated
    # (these normally arrive when a student files them from the Student Portal).
    for i, s in enumerate(Student.query.filter(Student.enrollment_tag == "Enrolled").order_by(Student.id).limit(4).all()):
        original_name = f"LOA_Application_{s.student_number}.pdf"
        db.session.add(StudentRequestAttachment(
            student_id=s.id, request_type="leave-of-absence",
            original_name=original_name,
            stored_name=f"seed-loa-{s.id}.pdf", mime_type="application/pdf",
            uploaded_at=now_utc() - timedelta(days=i + 1)))
        add_log(
            "leave-of-absence",
            s.id,
            "Student",
            original_name,
            "LOA application submitted",
            "GS Staff",
            "Student submitted a Leave of Absence application for staff eligibility review.\n"
            f"Requested period: AY 2026-2027 Term {1 + (i % 2)} to AY 2026-2027 Term {2 + (i % 2)}.\n"
            "Reason/remarks: Demo queue case.\n"
            f"Application PDF: {original_name}.",
        )
    for i, s in enumerate(Student.query.filter(Student.enrollment_tag == "LOA").order_by(Student.id).limit(3).all()):
        original_name = f"Readmission_Request_{s.student_number}.pdf"
        db.session.add(StudentRequestAttachment(
            student_id=s.id, request_type="readmission",
            original_name=original_name,
            stored_name=f"seed-readmit-{s.id}.pdf", mime_type="application/pdf",
            uploaded_at=now_utc() - timedelta(days=i + 1)))
        add_log(
            "readmission",
            s.id,
            "Student",
            original_name,
            "Readmission request submitted",
            "GS Staff",
            "Student submitted a readmission request for staff review.\n"
            f"Target return term: AY 2026-2027 Term {1 + (i % 2)}.\n"
            "Checklist submitted: 4 item(s); missing/not marked: None.\n"
            f"Previous LOA period: AY 2025-2026 Term {2 + (i % 2)}.\n"
            f"Application PDF: {original_name}.",
        )

    # End-to-end simulation fixtures (Student A's empty program + matched faculty,
    # Students B & C with portal accounts and submitted requests).
    seed_simulation_demo()

    # Derive each student's risk/priority from the same signals the Decision Support
    # engine uses, so the student record and the recommendation queue always agree.
    for student in Student.query.all():
        recompute_risk(student)
    ensure_faculty_demo_names()
    ensure_demo_accounts()
    db.session.commit()


def seed_workflow_cases() -> None:
    practicum_students = (
        Student.query.join(Program)
        .filter(Program.has_practicum.is_(True))
        .order_by(Student.student_number.asc())
        .limit(8)
        .all()
    )
    practicum_statuses = [
        ("Hours Incomplete", 200, 144, "Pending Review", 1),
        ("Report Sent to Dean", 200, 220, "Verified", 3),
        ("Dean Reviewed", 200, 214, "Verified", 3),
        ("Completed", 200, 205, "Verified", 2),
    ]
    if practicum_students:
        demo_practicum_student = practicum_students[0]
        demo_practicum_student.current_stage = "Final Defense"
        for course_record in CourseRecord.query.filter_by(student_id=demo_practicum_student.id).all():
            course_record.status = "Completed"
        demo_case = ResearchCase.query.filter_by(student_id=demo_practicum_student.id).order_by(ResearchCase.opened_at.desc()).first()
        if not demo_case:
            demo_case = ResearchCase(
                student_id=demo_practicum_student.id,
                case_type=research_case_type(demo_practicum_student),
                title=f"{demo_practicum_student.program.code} practicum eligibility case",
                current_gate="Final Defense",
                status="Ready",
                adviser_name=demo_practicum_student.adviser_name,
            )
            db.session.add(demo_case)
        else:
            demo_case.current_gate = "Final Defense"
    for idx, student in enumerate(practicum_students[:4]):
        status, required, completed, document_status, cert_count = practicum_statuses[idx]
        record = PracticumRecord(
            student_id=student.id,
            moa_status="Uploaded",
            moa_uploaded=True,
            practicum_site=random.choice(["USLS Center for Psychological Services", "Guidance Center", "Partner Community Clinic"]),
            required_hours=required,
            completed_hours=completed,
            document_status=document_status,
            certificate_count=cert_count,
            remarks="Seeded practicum monitoring case.",
            status=status,
            report_sent_at=now_utc() - timedelta(days=2) if status in {"Report Sent to Dean", "Dean Reviewed"} else None,
            dean_reviewed_at=now_utc() - timedelta(days=1) if status == "Dean Reviewed" else None,
        )
        db.session.add(record)
        if status == "Hours Incomplete":
            add_task(student.id, "Submit additional practicum certificates", "Student", 5, 45)
        if status == "Report Sent to Dean":
            add_task(student.id, "Review practicum status report", "Dean", 4, 35)
        add_log("practicum", student.id, "Demo Data", "Seeded practicum", f"Practicum status: {status}", "Dean" if status == "Report Sent to Dean" else "Academic Coordinator", practicum_notes(record))

    withdrawal_students = (
        Student.query.filter(Student.standing == "Active")
        .order_by(Student.student_number.asc())
        .offset(10)
        .limit(4)
        .all()
    )
    withdrawal_cases = [
        ("Pending", "Pending", "Pending", "Pending", "Dean Review"),
        ("Approved", "Pending", "Pending", "Pending", "Requirements Pending"),
        ("Denied", "Pending", "Pending", "Pending", "Denied"),
        ("Approved", "Complete", "Cleared", "Record Updated", "Withdrawn Confirmed"),
    ]
    for student, (dean, reqs, fees, registrar, status) in zip(withdrawal_students, withdrawal_cases):
        application = WithdrawalApplication(
            student_id=student.id,
            reason="Personal or employment-related withdrawal request.",
            effective_term="AY 2026-2027 Term 1",
            fee_status=fees,
            requirement_status=reqs,
            dean_decision=dean,
            registrar_status=registrar,
            status=status,
            decided_at=now_utc() - timedelta(days=2) if dean != "Pending" else None,
            completed_at=now_utc() - timedelta(days=1) if status == "Withdrawn Confirmed" else None,
            staff_remarks="Seeded withdrawal monitoring case.",
        )
        db.session.add(application)
        if status == "Dean Review":
            add_task(student.id, "Review withdrawal request", "Dean", 3, 60)
        elif status == "Requirements Pending":
            add_task(student.id, "Complete withdrawal requirements", "Student", 7, 40)
            add_task(student.id, "Perform withdrawal follow-through actions", "Academic Coordinator", 5, 45)
        elif status == "Withdrawn Confirmed":
            student.standing = "Withdrawn"
            student.current_stage = "Withdrawn"
            student.enrollment_tag = "Withdrawn"
        add_log("withdrawal", student.id, "Demo Data", "Seeded withdrawal", f"Withdrawal status: {status}", "Dean" if dean == "Pending" else "Graduate School Staff", withdrawal_notes(application))

    candidate_students = (
        Student.query.filter(Student.current_stage.in_(["Final Defense", "Completed", "Writing"]))
        .order_by(Student.student_number.asc())
        .limit(8)
        .all()
    )
    if candidate_students:
        ready_student = candidate_students[0]
        for rec in CourseRecord.query.filter_by(student_id=ready_student.id).all():
            rec.status = "Completed"
            rec.updated_at = now_utc()
        case = ResearchCase.query.filter_by(student_id=ready_student.id).first()
        if not case:
            case = ResearchCase(
                student_id=ready_student.id,
                case_type=research_case_type(ready_student),
                title=f"{ready_student.program.code} completion research case",
                current_gate="Completion Evidence",
                status="Verified Complete",
                adviser_name=ready_student.adviser_name,
            )
            db.session.add(case)
        case.current_gate = "Completion Evidence"
        case.status = "Verified Complete"
        for item in required_documents_for_gate("Completion Evidence"):
            doc = DocumentCheck.query.filter_by(student_id=ready_student.id, gate="Completion Evidence", item_name=item).first()
            if not doc:
                doc = DocumentCheck(student_id=ready_student.id, gate="Completion Evidence", item_name=item)
                db.session.add(doc)
            doc.status = "Complete"
            doc.evidence_reference = "Seeded completion evidence"
            doc.updated_at = now_utc()
        if ready_student.program.has_practicum:
            ready_practicum = latest_practicum_record(ready_student.id)
            if not ready_practicum:
                ready_practicum = PracticumRecord(student_id=ready_student.id)
                db.session.add(ready_practicum)
            ready_practicum.moa_status = "Uploaded"
            ready_practicum.moa_uploaded = True
            ready_practicum.practicum_site = ready_practicum.practicum_site or "Partner practicum site"
            ready_practicum.required_hours = 200
            ready_practicum.completed_hours = max(ready_practicum.completed_hours or 0, 220)
            ready_practicum.document_status = "Verified"
            ready_practicum.certificate_count = max(ready_practicum.certificate_count or 0, 3)
            ready_practicum.status = "Dean Reviewed"
            ready_practicum.report_sent_at = ready_practicum.report_sent_at or now_utc() - timedelta(days=4)
            ready_practicum.dean_reviewed_at = ready_practicum.dean_reviewed_at or now_utc() - timedelta(days=2)

    for idx, student in enumerate(candidate_students[:6]):
        eligibility = graduation_eligibility(student)
        endorsement = GraduationEndorsement(
            student_id=student.id,
            review_window="AY 2026-2027 Graduation Review",
            endorsement_status="Ready for Dean Review" if eligibility["eligible"] and idx % 2 == 0 else "For Review" if eligibility["eligible"] else "Not Eligible",
            registrar_status="Pending",
            submitted_at=now_utc() - timedelta(days=idx + 1),
        )
        apply_graduation_eligibility(endorsement, eligibility)
        db.session.add(endorsement)
        if endorsement.endorsement_status == "Ready for Dean Review":
            add_task(student.id, "Review graduation endorsement list", "Dean", 4, 55)
        elif endorsement.endorsement_status == "Not Eligible":
            add_task(student.id, eligibility["next_action"], eligibility["next_owner"], 7, 35)
        add_log("graduation", student.id, "Demo Data", "Seeded graduation endorsement", f"Graduation endorsement: {endorsement.endorsement_status}", "Dean" if endorsement.endorsement_status == "Ready for Dean Review" else eligibility["next_owner"], graduation_notes(endorsement))


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


def ensure_student_account(student: Student, email: str, password: str = SIM_STUDENT_PASSWORD) -> UserAccount:
    # Idempotently link (or create) a student-portal account so a handed-off student
    # can sign in to upload concept papers and file LOA / withdrawal requests.
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


def seed_simulation_demo() -> None:
    # Idempotent end-to-end demo fixtures (safe to re-run on every startup):
    #  - MAEDS: a dedicated empty program so the uploaded Student A sheet's subjects
    #    become A's entire curriculum (A can reach units-complete); practicum enabled.
    #  - Three faculty whose specialization matches Student A's concept-paper keywords
    #    so panel matching ranks them at the top.
    #  - Student B (LOA -> Readmission) and Student C (Withdrawal), each with a portal
    #    account and a submitted request so they appear in the staff queues.
    program = Program.query.filter_by(code=SIM_PROGRAM_CODE).first()
    if not program:
        program = Program(
            code=SIM_PROGRAM_CODE,
            name="Master of Arts in Education (Simulation Cohort)",
            college="Education",
            has_practicum=True,
        )
        db.session.add(program)
        db.session.flush()

    sim_faculty = [
        ("Dr. Liwayway Bautista", "Learning analytics, online learning, and student engagement in graduate education"),
        ("Dr. Marlon Geronimo", "Machine learning, educational data analytics, and predicting student performance"),
        ("Dr. Patricia Salvador", "Online learning, learning management systems, education technology, and curriculum development"),
    ]
    for name, spec in sim_faculty:
        faculty = Faculty.query.filter_by(name=name).first()
        if not faculty:
            faculty = Faculty(name=name, college="Education", role="Adviser / Panel", specialization=spec, active=True)
            db.session.add(faculty)
            db.session.flush()
        else:
            faculty.specialization = spec
            faculty.active = True
        if not FacultyWorkingHour.query.filter_by(faculty_id=faculty.id).count():
            for weekday in range(5):
                db.session.add(
                    FacultyWorkingHour(faculty_id=faculty.id, weekday=weekday, start_time=time(8, 0), end_time=time(17, 0))
                )
        if not FacultyAvailability.query.filter_by(faculty_id=faculty.id).count():
            # 08:00-10:00 sits before the first recurring profile busy block (class at
            # 10:00), so it never conflicts for any faculty id -> these rows always count
            # toward the availability score (keeping the advisers at the top of the panel
            # ranking) and are valid 120-minute defense windows.
            for offset in (4, 8, 11, 18, 25, 32):
                db.session.add(FacultyAvailability(
                    faculty_id=faculty.id, available_date=date.today() + timedelta(days=offset),
                    start_time=time(8, 0), end_time=time(10, 0)))
            # Also mirror the seeded faculty's shared 13:00-16:00 afternoon blocks so a
            # panel mixing these advisers with seeded faculty can still share a slot.
            for offset in (14, 21, 28, 35):
                db.session.add(FacultyAvailability(
                    faculty_id=faculty.id, available_date=date.today() + timedelta(days=offset),
                    start_time=time(13, 0), end_time=time(16, 0)))

    term = AcademicTerm.query.order_by(AcademicTerm.start_date.desc()).first()
    home_program = Program.query.filter_by(code="MAED").first() or program

    # Student B — Leave of Absence -> Readmission
    student_b = Student.query.filter_by(student_number="2099101").first()
    if not student_b:
        student_b = Student(
            student_number="2099101", first_name="Bianca", last_name="Robles",
            email="2099101@student.usls.edu.ph", program_id=home_program.id, entry_year=2024,
            current_stage="Coursework", standing="Active", enrollment_tag="Enrolled", risk_level="Low",
        )
        db.session.add(student_b)
        db.session.flush()
    original_name = "LOA_Application_Robles.pdf"
    if not StudentRequestAttachment.query.filter_by(student_id=student_b.id, request_type="leave-of-absence").first():
        db.session.add(StudentRequestAttachment(
            student_id=student_b.id, request_type="leave-of-absence",
            original_name=original_name, stored_name=f"sim-loa-{student_b.id}.pdf",
            mime_type="application/pdf", uploaded_at=now_utc() - timedelta(days=2)))
    if not TransactionLog.query.filter_by(
        transaction_slug="leave-of-absence",
        student_id=student_b.id,
        actor_role="Student",
        result="LOA application submitted",
    ).first():
        add_task(student_b.id, "Review student Leave of Absence application", "GS Staff", 3, 55)
        add_log(
            "leave-of-absence",
            student_b.id,
            "Student",
            original_name,
            "LOA application submitted",
            "GS Staff",
            "Student submitted a Leave of Absence application for staff eligibility review.\n"
            "Requested period: AY 2026-2027 Term 1 to AY 2026-2027 Term 2.\n"
            "Reason/remarks: Family health leave request for the demo simulation.\n"
            f"Application PDF: {original_name}.",
        )
    ensure_student_account(student_b, "student-b@gs.local")

    # Student C — Withdrawal request
    student_c = Student.query.filter_by(student_number="2099102").first()
    if not student_c:
        student_c = Student(
            student_number="2099102", first_name="Carlo", last_name="Mendoza",
            email="2099102@student.usls.edu.ph", program_id=home_program.id, entry_year=2024,
            current_stage="Coursework", standing="Active", enrollment_tag="Enrolled", risk_level="Low",
        )
        db.session.add(student_c)
        db.session.flush()
    if not WithdrawalApplication.query.filter_by(student_id=student_c.id).first():
        attachment = StudentRequestAttachment(
            student_id=student_c.id, request_type="withdrawal",
            original_name="Withdrawal_Request_Mendoza.pdf", stored_name=f"sim-wd-{student_c.id}.pdf",
            mime_type="application/pdf", uploaded_at=now_utc() - timedelta(days=1))
        db.session.add(attachment)
        db.session.flush()
        db.session.add(WithdrawalApplication(
            student_id=student_c.id,
            reason="Accepted full-time employment abroad; requesting withdrawal.",
            effective_term=(term.label if term else "AY 2026-2027 Term 1"),
            request_attachment_id=attachment.id, status="Dean Review", dean_decision="Pending"))
        add_task(student_c.id, "Review withdrawal request", "Dean", 3, 60)
        add_log("withdrawal", student_c.id, "Student", attachment.original_name,
                "Withdrawal request submitted", "Dean",
                "Student filed a withdrawal request from the portal for the demo simulation.")
    ensure_student_account(student_c, "student-c@gs.local")


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
                "Requested period: AY 2026-2027 Term 1 to AY 2026-2027 Term 2.\n"
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
                "Target return term: AY 2026-2027 Term 1.\n"
                "Checklist submitted: 4 item(s); missing/not marked: None.\n"
                "Previous LOA period: AY 2025-2026 Term 2.\n"
                f"Application PDF: {attachment.original_name}.",
            )
        created += 1
    return created


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

    # Dean account — the approver role. Approval authority follows whoever holds
    # this role, so changing the Dean is an account change, not a code change.
    dean = UserAccount.query.filter_by(email="dean@gs.local").first()
    if not dean:
        db.session.add(
            UserAccount(
                email="dean@gs.local",
                full_name="Graduate School Dean Demo",
                password_hash=generate_password_hash("DemoPass123!"),
                role="dean",
                active=True,
            )
        )

    linked_student = (
        Student.query.join(Program)
        .filter(Program.has_practicum.is_(True), Student.standing == "Active")
        .order_by(Student.student_number.asc())
        .first()
        or Student.query.order_by(Student.student_number.asc()).first()
    )
    if linked_student:
        demo_missing = DocumentCheck.query.filter_by(
            student_id=linked_student.id,
            gate="Form 4 - Proposal Defense Readiness",
            item_name="Proposal manuscript",
        ).first()
        if demo_missing and demo_missing.status == "Complete":
            demo_missing.status = "Missing"
            demo_missing.evidence_reference = "Demo missing requirement"

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

with app.app_context():
    ensure_schedule_request_schema()


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        seed_count = int(os.getenv("DEMO_SEED_COUNT", "350"))
        if "--seed" in sys.argv:
            seed_database(seed_count)
            ensure_faculty_demo_names()
            ensure_faculty_demo_profiles()
            ensure_demo_accounts()
            seed_simulation_demo()
            ensure_demo_request_submission_logs()
            db.session.commit()
            print(f"Seeded {seed_count} students plus supporting workflow data and demo accounts.")
            raise SystemExit(0)
        if Student.query.count() == 0:
            seed_database(seed_count)
            print(f"Database was empty, so {seed_count} demo students were seeded.")
        accounts_before = UserAccount.query.count()
        renamed_faculty = ensure_faculty_demo_names()
        updated_faculty_profiles = ensure_faculty_demo_profiles()
        ensure_demo_accounts()
        seed_simulation_demo()  # self-heal demo fixtures on an already-seeded database
        healed_request_logs = ensure_demo_request_submission_logs()
        sync_result = sync_all_curricula()
        db.session.commit()
        if renamed_faculty:
            print(f"Updated {renamed_faculty} demo faculty placeholder name(s).")
        if updated_faculty_profiles:
            print(f"Expanded {updated_faculty_profiles} demo faculty specialization profile(s).")
        if healed_request_logs:
            print(f"Added {healed_request_logs} missing demo request submission log(s).")
        if sync_result["created"]:
            print(f"Automatically added {sync_result['created']} missing curriculum row(s) for {sync_result['students']} student(s).")
        if accounts_before == 0:
            print("Demo staff and student accounts were created.")

    port = int(os.getenv("FLASK_PORT", "5000"))
    print(f"USLS Graduate School platform running at http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
