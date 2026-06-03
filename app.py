from __future__ import annotations

import os
import random
import sys
from datetime import date, datetime, time, timedelta
from urllib.parse import urlparse

import pymysql
from dotenv import load_dotenv
from flask import Flask, flash, redirect, render_template, request, url_for
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func, or_, text


load_dotenv()

db = SQLAlchemy()


TRANSACTIONS = [
    {
        "slug": "student-handoff",
        "priority": "P0",
        "title": "Student Handoff",
        "short": "Create the Graduate School monitoring record from an admission or enrollment signal.",
        "actor": "GS Staff",
        "data": "Student profile, admission/enrollment signal, program, term, source reference, timestamp, initial status.",
    },
    {
        "slug": "loa-decision",
        "priority": "P0",
        "title": "LOA / Readmission Decision",
        "short": "Compare request details with residency rules, route a decision, and update standing.",
        "actor": "Student / GS Staff / Dean",
        "data": "Request type, effective term, eligibility result, approval/denial/return, residency pause, next owner.",
    },
    {
        "slug": "course-audit",
        "priority": "P1",
        "title": "Course Audit",
        "short": "Map completed, current, and missing subjects to curriculum requirements.",
        "actor": "Academic Coordinator / GS Staff",
        "data": "Taken/current/missing subjects, AY/term, evidence reference, audit result, offering demand.",
    },
    {
        "slug": "research-gate",
        "priority": "P1",
        "title": "Research Gate Readiness",
        "short": "Check Form 1, Form 4, or completion evidence and set readiness or revision state.",
        "actor": "Student / Adviser / Research Coordinator",
        "data": "Form gate, required evidence, missing documents, decision result, next owner, milestone status.",
    },
    {
        "slug": "panel-matching",
        "priority": "P0",
        "title": "Panel Matching",
        "short": "Recommend panel members using specialization, availability, workload, and eligibility notes.",
        "actor": "Research Coordinator / Academic Coordinator",
        "data": "Specialization need, availability reference, workload count, recommended panel, eligibility notes.",
    },
    {
        "slug": "defense-scheduling",
        "priority": "P0",
        "title": "Defense Scheduling",
        "short": "Match available dates across student, adviser, and panel, then confirm or flag scheduling.",
        "actor": "Research Coordinator / Panel / Adviser / Student",
        "data": "Preferred date, availability responses, constraints, final schedule, mode, venue/link, status.",
    },
]

TRANSACTION_BY_SLUG = {item["slug"]: item for item in TRANSACTIONS}

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

COLLEGES = [
    "Arts and Sciences",
    "Business",
    "Education",
    "Engineering and Technology",
    "Nursing",
]


def now_utc() -> datetime:
    return datetime.now()


def normalize_database_url(url: str) -> str:
    if url.startswith("mysql://"):
        return "mysql+pymysql://" + url.removeprefix("mysql://")
    return url


def ensure_mysql_database(database_url: str) -> None:
    parsed = urlparse(database_url)
    if not parsed.scheme.startswith("mysql"):
        return

    database_name = parsed.path.strip("/")
    if not database_name:
        raise RuntimeError("DATABASE_URL must include a database name.")

    username = parsed.username or "root"
    password = parsed.password or ""
    host = parsed.hostname or "localhost"
    port = parsed.port or 3306

    connection = pymysql.connect(host=host, port=port, user=username, password=password, autocommit=True)
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{database_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
    finally:
        connection.close()


def create_app() -> Flask:
    database_url = normalize_database_url(
        os.getenv("DATABASE_URL", "mysql+pymysql://root:1234@localhost:3306/usls_gs_demo")
    )
    ensure_mysql_database(database_url)

    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "demo-only-secret")
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)

    register_routes(app)
    return app


class Program(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(30), unique=True, nullable=False)
    name = db.Column(db.String(160), nullable=False)
    college = db.Column(db.String(120), nullable=False)
    has_practicum = db.Column(db.Boolean, default=False)

    courses = db.relationship("Course", backref="program", lazy=True)
    students = db.relationship("Student", backref="program", lazy=True)


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


class TermEnrollment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    term_id = db.Column(db.Integer, db.ForeignKey("academic_term.id"), nullable=False)
    status = db.Column(db.String(40), nullable=False)
    source_reference = db.Column(db.String(160))
    confirmed_at = db.Column(db.DateTime, default=now_utc)

    term = db.relationship("AcademicTerm")


class CourseRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)
    status = db.Column(db.String(40), nullable=False)
    term_label = db.Column(db.String(40))
    evidence_reference = db.Column(db.String(160))
    updated_at = db.Column(db.DateTime, default=now_utc)

    course = db.relationship("Course")


class ResearchCase(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    case_type = db.Column(db.String(40), nullable=False)
    title = db.Column(db.String(220), nullable=False)
    current_gate = db.Column(db.String(80), nullable=False)
    status = db.Column(db.String(60), nullable=False)
    adviser_name = db.Column(db.String(120))
    opened_at = db.Column(db.DateTime, default=now_utc)


class DocumentCheck(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    gate = db.Column(db.String(80), nullable=False)
    item_name = db.Column(db.String(160), nullable=False)
    status = db.Column(db.String(40), nullable=False)
    evidence_reference = db.Column(db.String(160))
    updated_at = db.Column(db.DateTime, default=now_utc)


class Faculty(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    college = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(80), nullable=False)
    specialization = db.Column(db.String(160), nullable=False)
    active = db.Column(db.Boolean, default=True)

    availabilities = db.relationship("FacultyAvailability", backref="faculty", lazy=True, cascade="all, delete-orphan")


class FacultyAvailability(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    faculty_id = db.Column(db.Integer, db.ForeignKey("faculty.id"), nullable=False)
    available_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)


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


class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    title = db.Column(db.String(180), nullable=False)
    owner_role = db.Column(db.String(80), nullable=False)
    due_at = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(40), nullable=False, default="Pending")
    priority = db.Column(db.Integer, default=10)


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


def register_routes(app: Flask) -> None:
    @app.route("/")
    def index():
        stats = dashboard_stats()
        recent_logs = (
            TransactionLog.query.filter(TransactionLog.actor_role != "Demo Data")
            .order_by(TransactionLog.created_at.desc())
            .limit(8)
            .all()
        )
        overdue_tasks = Task.query.filter(Task.status.in_(["Pending", "Overdue"])).order_by(Task.priority.desc()).limit(8).all()
        return render_template(
            "index.html",
            transactions=TRANSACTIONS,
            stats=stats,
            recent_logs=recent_logs,
            overdue_tasks=overdue_tasks,
        )

    @app.route("/transaction/<slug>", methods=["GET", "POST"])
    def legacy_transaction_page(slug: str):
        return redirect(url_for("action_page", slug=slug, **request.args))

    @app.route("/action/<slug>", methods=["GET", "POST"])
    def action_page(slug: str):
        transaction = TRANSACTION_BY_SLUG.get(slug)
        if not transaction:
            flash("Unknown workflow.", "error")
            return redirect(url_for("index"))

        if request.method == "POST":
            handler = TRANSACTION_HANDLERS[slug]
            student_id = handler()
            db.session.commit()
            flash("Saved. The student record, queue, and monitoring indicators were updated.", "success")
            if slug == "student-handoff":
                return redirect(url_for("action_page", slug=slug))
            return redirect(url_for("action_page", slug=slug, student_id=student_id or ""))

        selected_student_id = None if slug == "student-handoff" else request.args.get("student_id", type=int)
        student_lookup = "" if slug == "student-handoff" else request.args.get("student_lookup", "").strip()
        if not selected_student_id and student_lookup:
            selected_student = resolve_student_lookup(student_lookup)
            selected_student_id = selected_student.id if selected_student else None
        context = build_transaction_context(slug, selected_student_id, student_lookup)
        return render_template(
            "transaction.html",
            transaction=transaction,
            transactions=TRANSACTIONS,
            context=context,
        )


def dashboard_stats() -> dict:
    total_students = Student.query.count()
    active_students = Student.query.filter(Student.standing == "Active").count()
    at_risk = Student.query.filter(Student.risk_level.in_(["Medium", "High"])).count()
    pending_tasks = Task.query.filter(Task.status.in_(["Pending", "Overdue"])).count()
    confirmed_schedules = ScheduleRequest.query.filter(ScheduleRequest.status == "Confirmed").count()
    stage_counts = (
        db.session.query(Student.current_stage, func.count(Student.id))
        .group_by(Student.current_stage)
        .order_by(func.count(Student.id).desc())
        .all()
    )
    return {
        "total_students": total_students,
        "active_students": active_students,
        "at_risk": at_risk,
        "pending_tasks": pending_tasks,
        "confirmed_schedules": confirmed_schedules,
        "stage_counts": stage_counts,
    }


def build_transaction_context(slug: str, selected_student_id: int | None, student_lookup: str = "") -> dict:
    students = Student.query.order_by(Student.last_name.asc(), Student.first_name.asc()).limit(500).all()
    selected_student = None if slug == "student-handoff" else (Student.query.get(selected_student_id) if selected_student_id else (students[0] if students else None))
    programs = Program.query.order_by(Program.college, Program.name).all()
    terms = AcademicTerm.query.order_by(AcademicTerm.start_date.desc()).all()
    faculty = Faculty.query.filter(Faculty.active.is_(True)).order_by(Faculty.name).all()
    recent_logs = (
        TransactionLog.query.filter(
            TransactionLog.transaction_slug == slug,
            TransactionLog.actor_role != "Demo Data",
        )
        .order_by(TransactionLog.created_at.desc())
        .limit(10)
        .all()
    )

    context = {
        "students": students,
        "selected_student": selected_student,
        "student_lookup": student_lookup or student_search_label(selected_student),
        "student_options": [{"id": student.id, "label": student_search_label(student)} for student in students],
        "programs": programs,
        "terms": terms,
        "faculty": faculty,
        "recent_logs": recent_logs,
        "gate_requirements": {
            "Form 1 - Title Defense": required_documents_for_gate("Form 1 - Title Defense"),
            "Form 4 - Proposal Defense Readiness": required_documents_for_gate("Form 4 - Proposal Defense Readiness"),
            "Final Defense": required_documents_for_gate("Final Defense"),
            "Completion Evidence": required_documents_for_gate("Completion Evidence"),
        },
        "readmission_requirements": readmission_requirements(),
        "onboarding_requirements": onboarding_requirements(),
        "courses": [],
        "course_audit": None,
        "panel_recommendations": [],
        "assigned_panel": [],
        "schedule_requests": [],
        "document_checks": [],
        "research_case": None,
        "offering_demand": [],
        "panel_roles": [],
    }

    if selected_student:
        context["panel_roles"] = panel_roles_for_student(selected_student)
        context["courses"] = Course.query.filter(Course.program_id == selected_student.program_id).order_by(Course.code).all()
        context["course_audit"] = compute_course_audit(selected_student)
        context["document_checks"] = (
            DocumentCheck.query.filter(DocumentCheck.student_id == selected_student.id)
            .order_by(DocumentCheck.gate, DocumentCheck.item_name)
            .all()
        )
        context["research_case"] = (
            ResearchCase.query.filter(ResearchCase.student_id == selected_student.id)
            .order_by(ResearchCase.opened_at.desc())
            .first()
        )
        context["assigned_panel"] = (
            PanelAssignment.query.filter(PanelAssignment.student_id == selected_student.id)
            .order_by(PanelAssignment.score.desc())
            .all()
        )
        context["schedule_requests"] = (
            ScheduleRequest.query.filter(ScheduleRequest.student_id == selected_student.id)
            .order_by(ScheduleRequest.created_at.desc())
            .limit(6)
            .all()
        )
        context["panel_recommendations"] = recommend_panel(selected_student, request.args.get("specialization", ""))

    if slug == "course-audit":
        context["offering_demand"] = compute_offering_demand()

    return context


def student_search_label(student: Student | None) -> str:
    if not student:
        return ""
    return f"{student.student_number} - {student.last_name}, {student.first_name} - {student.program.code}"


def resolve_student_lookup(value: str) -> Student | None:
    value = value.strip()
    if not value:
        return None
    if " - " in value:
        value = value.split(" - ", 1)[0].strip()
    pattern = f"%{value}%"
    return (
        Student.query.join(Program)
        .filter(
            or_(
                Student.student_number.ilike(pattern),
                Student.first_name.ilike(pattern),
                Student.last_name.ilike(pattern),
                Student.email.ilike(pattern),
                Program.code.ilike(pattern),
                Program.name.ilike(pattern),
            )
        )
        .order_by(Student.last_name.asc(), Student.first_name.asc())
        .first()
    )


def add_log(slug: str, student_id: int | None, actor: str, source: str, result: str, next_owner: str, notes: str) -> None:
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


def handle_student_handoff() -> int:
    program = Program.query.get(int(request.form["program_id"]))
    count = Student.query.count() + 1
    student_number = request.form.get("student_number", "").strip() or f"2026-{count:04d}"
    first_name = request.form["first_name"].strip()
    last_name = request.form["last_name"].strip()
    submitted_onboarding = set(request.form.getlist("onboarding_items"))
    missing_items = [item for item in onboarding_requirements() if item not in submitted_onboarding]
    missing_items.extend(split_items(request.form.get("additional_missing_items", "")))
    student = Student(
        student_number=student_number,
        first_name=first_name,
        last_name=last_name,
        email=request.form.get("email", "").strip() or f"{student_number.lower()}@student.usls.edu.ph",
        program_id=program.id,
        entry_year=int(request.form.get("entry_year") or date.today().year),
        current_stage="Admission",
        standing="Active",
        risk_level="Medium" if missing_items else "Low",
    )
    db.session.add(student)
    db.session.flush()

    term = AcademicTerm.query.get(int(request.form["term_id"]))
    db.session.add(
        TermEnrollment(
            student_id=student.id,
            term_id=term.id,
            status=request.form["admission_signal"],
            source_reference=request.form.get("source_reference", ""),
        )
    )

    for item in onboarding_requirements():
        db.session.add(
            DocumentCheck(
                student_id=student.id,
                gate="Admission Handoff",
                item_name=item,
                status="Missing" if item in missing_items else "Complete",
                evidence_reference=request.form.get("source_reference", ""),
            )
        )

    if missing_items:
        for item in split_items(request.form.get("additional_missing_items", "")):
            db.session.add(
                DocumentCheck(
                    student_id=student.id,
                    gate="Admission Handoff",
                    item_name=item,
                    status="Missing",
                    evidence_reference=request.form.get("source_reference", ""),
                )
            )
        add_task(student.id, "Complete admission handoff missing items", "GS Staff", 3, 40)

    add_log(
        "student-handoff",
        student.id,
        "GS Staff",
        request.form.get("source_reference", ""),
        f"Monitoring record created from {request.form['admission_signal']}; {len(missing_items)} onboarding item(s) missing",
        "GS Staff",
        f"Program: {program.code}; Compared {len(submitted_onboarding)} received item(s) against {len(onboarding_requirements())} required item(s). Missing: {', '.join(missing_items) if missing_items else 'None'}",
    )
    return student.id


def handle_loa_decision() -> int:
    student = Student.query.get_or_404(int(request.form["student_id"]))
    request_type = request.form["request_type"]
    dean_action = request.form.get("dean_action", "Approve")
    start = parse_date(request.form.get("effective_start"))
    end = parse_date(request.form.get("effective_end"))
    source = request.form.get("source_reference", "")
    note = request.form.get("notes", "")

    if request_type == "LOA":
        completed_terms = int(request.form.get("completed_terms") or 0)
        loa_terms_used = int(request.form.get("loa_terms_used") or 0)
        requested_terms = int(request.form.get("requested_terms") or 1)
        has_reason = request.form.get("reason_document") == "yes"
        within_limit = loa_terms_used + requested_terms <= 4
        has_residency = completed_terms >= 1
        eligible = has_reason and within_limit and has_residency
        reasons = []
        if not has_reason:
            reasons.append("reason document missing")
        if not has_residency:
            reasons.append("student has no completed term yet")
        if not within_limit:
            reasons.append("requested LOA exceeds four-term demo rule")

        if eligible and dean_action == "Approve":
            student.current_stage = "LOA"
            student.standing = "On Leave"
            student.risk_level = "Medium"
            result = f"LOA approved from {start} to {end}; residency clock paused for {requested_terms} term(s)"
            next_owner = "GS Staff"
        elif dean_action == "Deny":
            result = "LOA denied after rule check"
            next_owner = "GS Staff"
            student.risk_level = "Medium"
        else:
            result = f"LOA returned by system check: {', '.join(reasons) if reasons else 'Dean requested completion'}"
            next_owner = "Student"
            student.risk_level = "Medium"
            add_task(student.id, "Complete LOA request requirements", "Student", 5, 35)
        note = f"{note}\nRule check: completed terms {completed_terms}, used LOA terms {loa_terms_used}, requested {requested_terms}."
    else:
        submitted = set(request.form.getlist("readmission_items"))
        missing = [item for item in readmission_requirements() if item not in submitted]
        if not missing and dean_action == "Approve":
            student.current_stage = "Coursework" if student.current_stage == "LOA" else student.current_stage
            student.standing = "Active"
            student.risk_level = "Low"
            result = "Readmission approved; required return evidence complete"
            next_owner = "Academic Coordinator"
            add_task(student.id, "Confirm return-term study plan", "Academic Coordinator", 5, 25)
        elif dean_action == "Deny":
            result = "Readmission denied after evidence review"
            next_owner = "GS Staff"
            student.risk_level = "Medium"
        else:
            result = f"Readmission returned; missing {', '.join(missing) if missing else 'Dean-requested clarification'}"
            next_owner = "Student"
            student.risk_level = "Medium"
            add_task(student.id, "Complete readmission evidence", "Student", 5, 40)
        note = f"{note}\nEvidence compared: {len(submitted)} submitted, {len(missing)} missing."

    add_log("loa-decision", student.id, "GS Staff / Dean", source, result, next_owner, note.strip())
    return student.id


def handle_course_audit() -> int:
    student = Student.query.get_or_404(int(request.form["student_id"]))
    course = Course.query.get_or_404(int(request.form["course_id"]))
    status = request.form["status"]
    existing = CourseRecord.query.filter_by(student_id=student.id, course_id=course.id).first()
    if not existing:
        existing = CourseRecord(student_id=student.id, course_id=course.id)
        db.session.add(existing)
    existing.status = status
    existing.term_label = request.form.get("term_label", "")
    existing.evidence_reference = request.form.get("evidence_reference", "")
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
        request.form.get("evidence_reference", ""),
        f"{course.code} marked {status}; {audit['missing_count']} subject(s) missing",
        "Academic Coordinator",
        "Course audit updated from monitoring signal.",
    )
    return student.id


def handle_research_gate() -> int:
    student = Student.query.get_or_404(int(request.form["student_id"]))
    gate = request.form["gate"]
    source = request.form.get("source_reference", "")
    required_items = required_documents_for_gate(gate)
    package_text = request.form.get("submitted_package", "")
    submitted_items = {
        item.split("||", 1)[1]
        for item in request.form.getlist("submitted_items")
        if item.startswith(f"{gate}||")
    }
    submitted_items.update(infer_submitted_research_items(gate, package_text))
    missing_items = [item for item in required_items if item not in submitted_items]
    revision_required = request.form.get("revision_required") == "yes"

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
            title=request.form.get("research_title", "").strip() or f"{student.program.code} graduate research case",
            current_gate=gate,
            status=result,
            adviser_name=student.adviser_name,
        )
        db.session.add(research_case)
    else:
        research_case.current_gate = gate
        research_case.status = result
        if request.form.get("research_title"):
            research_case.title = request.form["research_title"].strip()

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
        f"Compared evidence package against {len(required_items)} required item(s). Detected: {', '.join(sorted(submitted_items)) if submitted_items else 'None'}. Missing: {', '.join(missing_items) if missing_items else 'None'}",
    )
    return student.id


def handle_panel_matching() -> int:
    student = Student.query.get_or_404(int(request.form["student_id"]))
    specialization = request.form.get("specialization", "").strip() or student.program.name
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
        request.form.get("source_reference", ""),
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


def handle_defense_scheduling() -> int:
    student = Student.query.get_or_404(int(request.form["student_id"]))
    preferred_date = parse_date(request.form["preferred_date"])
    defense_type = request.form.get("defense_type", "Title Defense")
    mode = request.form["mode"]
    venue = request.form.get("venue", "")
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
        notes=f"{defense_type}; {'; '.join(status_reason) if status_reason else 'all scheduling checks passed'}; {request.form.get('constraints', '')}",
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
        request.form.get("source_reference", ""),
        f"{defense_type} schedule {status}; {matched_count}/{required_panel_count} panel availability match(es)",
        next_owner,
        f"{mode}; {venue}; {'; '.join(status_reason) if status_reason else 'lead time and availability passed'}",
    )
    return student.id


TRANSACTION_HANDLERS = {
    "student-handoff": handle_student_handoff,
    "loa-decision": handle_loa_decision,
    "course-audit": handle_course_audit,
    "research-gate": handle_research_gate,
    "panel-matching": handle_panel_matching,
    "defense-scheduling": handle_defense_scheduling,
}


def split_items(value: str) -> list[str]:
    return [item.strip() for item in value.replace(",", "\n").splitlines() if item.strip()]


def parse_date(value: str | None) -> date:
    if not value:
        return date.today()
    return datetime.strptime(value, "%Y-%m-%d").date()


def required_documents_for_gate(gate: str) -> list[str]:
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
    aliases = {
        "Form 1 - Application for Title Defense": ["form 1", "application for title defense"],
        "Three concept papers": ["three concept", "3 concept", "concept papers", "concept paper"],
        "Academic Coordinator endorsement/e-signature": ["academic coordinator", "ac endorsement", "ac e-signature", "e-signature", "endorsed by ac"],
        "Recommended panel set": ["recommended panel", "panel recommendation", "panel set"],
        "Form 4 - Endorsement for Proposal Defense": ["form 4", "endorsement for proposal"],
        "Proposal manuscript": ["proposal manuscript", "proposal paper", "proposal draft"],
        "Adviser e-signature/endorsement": ["adviser endorsement", "adviser e-signature", "endorsed by adviser"],
        "Form 4.1 Statistical Consultation Form or qualitative exemption": ["form 4.1", "statistical consultation", "qualitative exemption", "statistician"],
        "Agreed defense schedule in Form 4": ["agreed schedule", "schedule in form 4", "defense schedule"],
        "Form 4 - Endorsement for Final Defense": ["form 4", "endorsement for final"],
        "Final manuscript": ["final manuscript", "final paper", "closed-door manuscript"],
        "Ethics Clearance": ["ethics clearance", "rerc clearance"],
        "Panel received manuscript at least 14 days before defense": ["14-day", "14 day", "two weeks", "panel received manuscript"],
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
    name = student.program.name.lower()
    if "doctor" in name or "phd" in name:
        return "Dissertation"
    if student.program.has_practicum:
        return "Project Paper"
    return "Thesis"


def panel_roles_for_student(student: Student) -> list[str]:
    case_type = research_case_type(student)
    if case_type == "Project Paper":
        return ["Panel Chair", "Content Specialist", "Method Specialist"]
    if case_type == "Dissertation":
        return ["Panel Chair", "Content Specialist 1", "Content Specialist 2", "Method Specialist", "External Panel"]
    return ["Panel Chair", "Content Specialist", "Method Specialist", "External Panel"]


def defense_lead_days(defense_type: str) -> int:
    if defense_type == "Public Final Defense":
        return 5
    return 14


def onboarding_requirements() -> list[str]:
    return [
        "Admission approval",
        "Student profile sheet",
        "Program assignment",
        "Enrollment signal",
        "Official transcript",
    ]


def readmission_requirements() -> list[str]:
    return [
        "Return intent letter",
        "Updated study plan",
        "Program/adviser endorsement",
        "No pending accountability",
    ]


def compute_course_audit(student: Student) -> dict:
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


def reset_database() -> None:
    db.session.execute(text("SET FOREIGN_KEY_CHECKS=0"))
    db.drop_all()
    db.session.execute(text("SET FOREIGN_KEY_CHECKS=1"))
    db.session.commit()
    db.create_all()


def seed_database(count: int = 350) -> None:
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
        "Ana",
        "Ben",
        "Carla",
        "Daniel",
        "Elise",
        "Francis",
        "Grace",
        "Hector",
        "Irene",
        "Jon",
        "Miguel",
        "Patricia",
        "Ramon",
        "Lara",
        "Joshua",
        "Nicole",
        "Martin",
        "Camille",
        "Rafael",
        "Bianca",
        "Adrian",
        "Clarisse",
        "Diane",
        "Enrico",
        "Fatima",
        "Gian",
        "Hazel",
        "Isabel",
        "Jerome",
        "Katrina",
    ]
    last_names = [
        "Santos",
        "Reyes",
        "Tan",
        "Uy",
        "Co",
        "Lim",
        "Ong",
        "Yu",
        "Flores",
        "Pang",
        "Alvarez",
        "Bautista",
        "Cabrera",
        "Delos Reyes",
        "Escobar",
        "Fernandez",
        "Garcia",
        "Hernandez",
        "Mendoza",
        "Villanueva",
        "Abad",
        "Bernardo",
        "Chua",
        "Dizon",
        "Evangelista",
        "Francisco",
        "Gonzales",
        "Jacinto",
        "Lacson",
        "Navarro",
    ]
    name_pairs = [(first, last) for first in first_names for last in last_names]
    random.shuffle(name_pairs)
    if count > len(name_pairs):
        raise ValueError(f"Seed count {count} exceeds the {len(name_pairs)} unique generated student names available.")
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
            status = "Completed" if course_index < complete_cutoff else "Current" if course_index == complete_cutoff else "Missing"
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
                current_gate=random.choice(["Form 1 - Title Defense", "Form 4 - Proposal Defense Readiness", "Final Defense"]),
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
            add_task(student.id, random.choice(["Verify missing evidence", "Follow up adviser decision", "Confirm next owner"]), "GS Staff", random.randint(-5, 10), random.randint(15, 60), "Overdue" if idx % 12 == 0 else "Pending")
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


if __name__ == "__main__":
    app = create_app()
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

    port = int(os.getenv("FLASK_PORT", "5000"))
    print(f"USLS Graduate School Python demo running at http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
