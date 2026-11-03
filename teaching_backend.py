"""Semester teaching availability and human-approved class timetables.

The application passes its model/helper namespace during registration so this
module works both for ``python app.py`` and imports, without a circular import.
Defense availability, official enrollment records and room data are never edited.
"""
import hashlib
import json
from datetime import datetime, timedelta

from flask import abort, jsonify, request
from sqlalchemy.exc import IntegrityError

from teaching_engine import DEFAULT_CONFIG, generate_options, rank_schedules, validate_schedule


def install_models(db):
    class TeachingAvailability(db.Model):
        __tablename__ = "teaching_availability"
        id = db.Column(db.Integer, primary_key=True)
        faculty_id = db.Column(db.Integer, db.ForeignKey("faculty.id"), nullable=False)
        term_id = db.Column(db.Integer, db.ForeignKey("academic_term.id"), nullable=False)
        windows_json = db.Column(db.Text, nullable=False, default="[]")
        status = db.Column(db.String(20), nullable=False, default="Draft")
        version = db.Column(db.Integer, nullable=False, default=1)
        confirmed_at = db.Column(db.DateTime)
        updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
        copied_from_term_id = db.Column(db.Integer, db.ForeignKey("academic_term.id"))
        __table_args__ = (db.UniqueConstraint("faculty_id", "term_id", name="uq_teaching_availability_term"),)

    class TeachingSchedulePlan(db.Model):
        __tablename__ = "teaching_schedule_plan"
        id = db.Column(db.Integer, primary_key=True)
        term_id = db.Column(db.Integer, db.ForeignKey("academic_term.id"), nullable=False, index=True)
        status = db.Column(db.String(20), nullable=False, default="Draft")
        version = db.Column(db.Integer, nullable=False, default=1)
        allow_single_day = db.Column(db.Boolean, nullable=False, default=False)
        approved_signature = db.Column(db.String(64))
        base_published_plan_id = db.Column(db.Integer, db.ForeignKey("teaching_schedule_plan.id"))
        approved_by = db.Column(db.Integer, db.ForeignKey("user_account.id"))
        approved_at = db.Column(db.DateTime)
        published_at = db.Column(db.DateTime)
        # SQLite allows many NULLs but only one active publication per term.
        published_term_id = db.Column(db.Integer, db.ForeignKey("academic_term.id"), unique=True)
        created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
        updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
        sections = db.relationship("ClassSection", backref="schedule_plan", cascade="all, delete-orphan", lazy=True)

    class ClassSection(db.Model):
        __tablename__ = "class_section"
        id = db.Column(db.Integer, primary_key=True)
        plan_id = db.Column(db.Integer, db.ForeignKey("teaching_schedule_plan.id"), nullable=False)
        offering_id = db.Column(db.Integer, db.ForeignKey("curriculum_offering.id"), nullable=False)
        faculty_id = db.Column(db.Integer, db.ForeignKey("faculty.id"))
        section = db.Column(db.String(40), nullable=False)
        pinned = db.Column(db.Boolean, nullable=False, default=False)
        selection_json = db.Column(db.Text)
        __table_args__ = (db.UniqueConstraint("plan_id", "offering_id", "section", name="uq_schedule_section"),)

    return {model.__name__: model for model in (TeachingAvailability, TeachingSchedulePlan, ClassSection)}


def _dump(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def _load(value, default=None):
    return json.loads(value) if value else default


def _minute(value):
    if not isinstance(value, str) or len(value) != 5 or value[2] != ":":
        raise ValueError("Use HH:MM for every time.")
    try:
        hour, minute = map(int, value.split(":"))
    except ValueError:
        raise ValueError("Use HH:MM for every time.") from None
    if not 0 <= hour <= 23 or not 0 <= minute < 60:
        raise ValueError("Time must be within the day.")
    return hour * 60 + minute


def _contains(start, end, windows):
    cursor = start
    for a, b in sorted(windows):
        if a > cursor:
            break
        cursor = max(cursor, b)
        if cursor >= end:
            return True
    return False


def clean_windows(windows):
    if not isinstance(windows, list) or len(windows) > 100:
        raise ValueError("Send at most 100 teaching availability windows.")
    cleaned, intervals = [], {}
    for item in windows:
        if not isinstance(item, dict):
            raise ValueError("Each availability window must be an object.")
        day, kind = item.get("weekday"), item.get("kind")
        if isinstance(day, bool) or not isinstance(day, int) or day not in range(7):
            raise ValueError("Weekday must be Monday (0) through Sunday (6).")
        if kind not in ("available", "unavailable", "preferred"):
            raise ValueError("Choose available, unavailable or preferred.")
        start, end = _minute(item.get("start")), _minute(item.get("end"))
        if end <= start:
            raise ValueError("The end must be after the start.")
        if any(start < b and a < end for a, b in intervals.get((day, kind), [])):
            raise ValueError("Windows of the same kind must not overlap.")
        intervals.setdefault((day, kind), []).append((start, end))
        cleaned.append({"weekday": day, "start": item["start"], "end": item["end"], "kind": kind})
    for row in cleaned:
        if row["kind"] != "preferred":
            continue
        day, start, end = row["weekday"], _minute(row["start"]), _minute(row["end"])
        if not _contains(start, end, intervals.get((day, "available"), [])) or any(
                start < b and a < end for a, b in intervals.get((day, "unavailable"), [])):
            raise ValueError("Preferred periods must be inside available periods and outside unavailable periods.")
    return cleaned


def class_schedule_conflicts(ns, db, student_id, faculty_ids, day, start, end):
    """Read-only reverse check: later defenses must respect published classes."""
    if not start or not end:
        return []
    start_min = _minute(start.strftime("%H:%M") if hasattr(start, "strftime") else start)
    end_min = _minute(end.strftime("%H:%M") if hasattr(end, "strftime") else end)
    problems = []
    for plan in ns["TeachingSchedulePlan"].query.filter_by(status="Published").all():
        term = db.session.get(ns["AcademicTerm"], plan.term_id)
        if not term.start_date <= day <= term.end_date:
            continue
        enrolled = {r.course_id for r in ns["SubjectEnrollment"].query.filter(
            ns["SubjectEnrollment"].term_id == term.id,
            ns["SubjectEnrollment"].student_id == student_id,
            ns["SubjectEnrollment"].status.in_(ns["ACTIVE_SUBJECT_ENROLLMENT_STATUSES"])).all()} if student_id else set()
        for section in plan.sections:
            off = db.session.get(ns["CurriculumOffering"], section.offering_id)
            shared_faculty = section.faculty_id in set(faculty_ids or [])
            if not shared_faculty and not (off and off.course_id in enrolled):
                continue
            for meeting in _load(section.selection_json, {}).get("meetings", []):
                if meeting["weekday"] == day.weekday() and start_min < _minute(meeting["end"]) + 15 and _minute(meeting["start"]) < end_min + 15:
                    prefix = "Panel conflict with published class:" if shared_faculty else "Same-student overlap: published class"
                    problems.append(f"{prefix} {off.course.code if off else 'Class'} {section.section} is already booked for this time.")
                    break
    return list(dict.fromkeys(problems))


def install_routes(app, db, ns):
    Availability, Plan, Section = (ns[name] for name in ("TeachingAvailability", "TeachingSchedulePlan", "ClassSection"))
    Term, Faculty, Offering = (ns[name] for name in ("AcademicTerm", "Faculty", "CurriculumOffering"))
    Enrollment, Student = ns["SubjectEnrollment"], ns["Student"]
    login = ns["require_api_login"]

    def term_of(data=None):
        value = (data or {}).get("term_id", request.args.get("term_id"))
        if value is None or value == "":
            term = ns["get_active_term"]()
        else:
            try:
                term = db.session.get(Term, int(value))
            except (ValueError, TypeError):
                abort(400, description="Choose a valid semester.")
        if not term:
            abort(404, description="Semester not found.")
        return term

    def term_data(term):
        return {"term": ns["term_dict"](term), "terms": [ns["term_dict"](t) for t in Term.query.order_by(Term.start_date.desc()).all()]}

    def rules():
        return {**DEFAULT_CONFIG, **app.config.get("TEACHING_SCHEDULE_RULES", {})}

    def audit(result, notes=""):
        account = ns["current_account"]()
        ns["add_log"]("course-adjustments", None, account.full_name or account.email,
                      "Teaching schedule", result, "Academic Coordinator", notes, visibility="internal")

    def availability_data(row):
        if not row:
            return {"status": "Missing", "version": 0, "windows": [], "confirmed_at": None}
        return {"status": row.status, "version": row.version, "windows": _load(row.windows_json, []),
                "confirmed_at": ns["iso"](row.confirmed_at), "copied_from_term_id": row.copied_from_term_id}

    def faculty_self():
        account = ns["current_account"]()
        faculty = db.session.get(Faculty, account.faculty_id) if account.faculty_id else None
        if not faculty or not faculty.active:
            abort(403, description="Your active faculty record is required.")
        return faculty

    def version_of(data):
        value = data.get("version")
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            abort(400, description="Send the version you last loaded.")
        return value

    def json_body():
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            abort(400, description="Send a JSON object.")
        return body

    def offerings_for(term):
        year, semester = ns["split_academic_term_label"](term.label)
        return Offering.query.filter_by(academic_year=year, semester=semester).order_by(Offering.id).all()

    def source_section_count(off, term):
        proposal = ns["CourseOffering"].query.join(ns["CourseOfferingPlan"]).filter(
            ns["CourseOfferingPlan"].target_term_id == term.id,
            ns["CourseOfferingPlan"].status.in_(["Approved", "Published"]),
            ns["CourseOffering"].course_id == off.course_id,
            ns["CourseOffering"].status == "Offered").order_by(ns["CourseOffering"].id.desc()).first()
        return max(1, proposal.section_count or 1) if proposal else 1

    def committed_students(term, course_id):
        return [row.student_id for row in Enrollment.query.filter(
            Enrollment.term_id == term.id, Enrollment.course_id == course_id,
            Enrollment.status.in_(ns["ACTIVE_SUBJECT_ENROLLMENT_STATUSES"])).all()]

    def faculty_public_sections(term, faculty_id=None, student_id=None):
        plan = Plan.query.filter_by(published_term_id=term.id, status="Published").first()
        if not plan:
            return []
        enrolled = None
        if student_id is not None:
            enrolled = {r.course_id for r in Enrollment.query.filter(
                Enrollment.term_id == term.id, Enrollment.student_id == student_id,
                Enrollment.status.in_(ns["ACTIVE_SUBJECT_ENROLLMENT_STATUSES"])).all()}
        result = []
        for section in plan.sections:
            off = db.session.get(Offering, section.offering_id)
            if faculty_id is not None and section.faculty_id != faculty_id:
                continue
            if enrolled is not None and off.course_id not in enrolled:
                continue
            option = _load(section.selection_json, {})
            faculty = db.session.get(Faculty, section.faculty_id) if section.faculty_id else None
            multiple_sections = sum(s.offering_id == section.offering_id for s in plan.sections) > 1
            result.append({"id": section.id, "course_id": off.course_id, "code": off.course.code,
                           "title": off.course.title, "faculty_id": section.faculty_id,
                           "faculty_name": faculty.name if faculty else None, "section": section.section,
                           "meetings": option.get("meetings", []), "plan_id": plan.id,
                           "section_assignment_status": "Unallocated" if multiple_sections else "Single section",
                           "warnings": ["Section allocation is not recorded. Confirm your section with the Academic Coordinator."] if multiple_sections else []})
        return result

    @app.route("/api/faculty-portal/teaching-schedule", methods=["GET", "PUT"])
    @login("faculty")
    def faculty_teaching_schedule():
        faculty, term = faculty_self(), term_of()
        row = Availability.query.filter_by(faculty_id=faculty.id, term_id=term.id).first()
        if request.method == "PUT":
            data = json_body()
            if data.get("faculty_id") not in (None, faculty.id):
                abort(403, description="Submit only your own teaching availability.")
            version = version_of(data)
            if version != (row.version if row else 0):
                return jsonify(error="Availability changed. Reload before saving."), 409
            copied_from, status = None, data.get("status", "Draft")
            if "copy_from_term_id" in data:
                try:
                    copied_from = int(data["copy_from_term_id"])
                except (TypeError, ValueError):
                    abort(400)
                source = Availability.query.filter_by(faculty_id=faculty.id, term_id=copied_from).first()
                if not source or copied_from == term.id:
                    return jsonify(error="Choose another semester with your saved availability."), 400
                windows, status = _load(source.windows_json, []), "Draft"
            else:
                windows = data.get("windows")
            if status not in ("Draft", "Submitted"):
                return jsonify(error="Choose Draft or Submitted."), 400
            try:
                windows = clean_windows(windows)
            except ValueError as exc:
                return jsonify(error=str(exc)), 400
            now = ns["now_utc"]()
            values = dict(windows_json=_dump(windows), status=status, version=version + 1,
                          confirmed_at=now if status == "Submitted" else None, updated_at=now,
                          copied_from_term_id=copied_from)
            try:
                if row:
                    updated = Availability.query.filter_by(id=row.id, version=version).update(values, synchronize_session=False)
                    if not updated:
                        db.session.rollback()
                        return jsonify(error="Availability changed. Reload before saving."), 409
                else:
                    row = Availability(faculty_id=faculty.id, term_id=term.id, **values)
                    db.session.add(row)
                audit(f"{faculty.name}: teaching availability {status.lower()} for {term.label}.")
                affects_timetable = Section.query.join(Plan).filter(Section.faculty_id == faculty.id,
                    Plan.term_id == term.id, Plan.status.in_(["Approved", "Published"])).first() is not None
                if status == "Submitted" or affects_timetable:
                    ns["notify_many"](ns["accounts_for_roles"]("academic_coordinator"), "teaching_availability",
                        f"Teaching availability: {faculty.name}", f"{term.label}: submission received. Review any affected timetable.",
                        link=f"/course-adjustments?view=schedule&term_id={term.id}", related_type="teaching_availability",
                        related_id=faculty.id, dedupe_key=f"teaching-availability:{faculty.id}:{term.id}:{version + 1}")
                db.session.commit()
            except IntegrityError:
                db.session.rollback()
                return jsonify(error="Availability changed. Reload before saving."), 409
            db.session.expire_all()
            row = Availability.query.filter_by(faculty_id=faculty.id, term_id=term.id).one()
        return jsonify(**term_data(term), availability=availability_data(row),
                       published=faculty_public_sections(term, faculty_id=faculty.id))

    def overlap(a, b, gap=15):
        return a["weekday"] == b["weekday"] and _minute(a["start"]) < _minute(b["end"]) + gap and _minute(b["start"]) < _minute(a["end"]) + gap

    def date_for_weekday(start, end, weekday):
        first = start + timedelta(days=(weekday - start.weekday()) % 7)
        return first <= end

    def external_problems(section, option, term, plan):
        problems = []
        # Active classes in another overlapping term are actual commitments.
        for other in Plan.query.filter(Plan.status == "Published", Plan.term_id != term.id).all():
            other_term = db.session.get(Term, other.term_id)
            start, end = max(term.start_date, other_term.start_date), min(term.end_date, other_term.end_date)
            if start > end:
                continue
            for booked in other.sections:
                off = db.session.get(Offering, booked.offering_id)
                shared_faculty = section["faculty_id"] and section["faculty_id"] == booked.faculty_id
                shared_students = set(section["confirmed_student_ids"]) & set(committed_students(other_term, off.course_id))
                if not (shared_faculty or shared_students):
                    continue
                meetings = _load(booked.selection_json, {}).get("meetings", [])
                if any(date_for_weekday(start, end, a["weekday"]) and overlap(a, b) for a in option["meetings"] for b in meetings):
                    problems.append("Faculty or confirmed student has a published class in an overlapping semester.")
        # Defenses use dated bookings; defense availability itself is not teaching availability.
        Schedule = ns["ScheduleRequest"]
        for defense in Schedule.query.filter(Schedule.status.in_(["Scheduled", "Needs Re-confirmation"]),
                Schedule.preferred_date >= term.start_date, Schedule.preferred_date <= term.end_date).all():
            shared_faculty = section["faculty_id"] in ns["schedule_panel_ids"](defense)
            shared_student = defense.student_id in section["confirmed_student_ids"]
            if not (shared_faculty or shared_student):
                continue
            if not defense.start_time or not defense.end_time:
                problems.append("A defense commitment has no complete time; coordinate it before approval.")
                continue
            booked = {"weekday": defense.preferred_date.weekday(), "start": defense.start_time.strftime("%H:%M"), "end": defense.end_time.strftime("%H:%M")}
            if any(overlap(m, booked) for m in option["meetings"]):
                problems.append("Faculty or confirmed student has a booked defense during this class period.")
        return list(dict.fromkeys(problems))

    def sections_context(plan, term):
        forecast = {}
        existing_offerings = {s.offering_id: db.session.get(Offering, s.offering_id) for s in plan.sections}
        for program_id in {off.program_id for off in existing_offerings.values() if off}:
            program = db.session.get(ns["Program"], program_id)
            for row in ns["course_demand_rows"](program, term):
                forecast[row["course"]["id"]] = [student["id"] for student in row.get("affected_students", [])]
        context, choices, errors, warnings, submissions = [], {}, [], [], {}
        for stored in plan.sections:
            off = db.session.get(Offering, stored.offering_id)
            if off is None:
                row = {"id": str(stored.id), "course_id": None, "code": "Removed offering", "title": "",
                       "section": stored.section, "faculty_id": stored.faculty_id, "faculty_name": None,
                       "confirmed_student_ids": [], "forecast_student_ids": [], "options": [],
                       "option_id": None, "meetings": [], "pinned": stored.pinned, "blocked_options": [], "warnings": [],
                       "errors": ["This offering was removed. Create a revised timetable."]}
                context.append(row)
                choices[row["id"]] = []
                errors.extend(row["errors"])
                continue
            faculty = db.session.get(Faculty, stored.faculty_id) if stored.faculty_id else None
            row = {"id": str(stored.id), "course_id": off.course_id, "code": off.course.code,
                   "title": off.course.title, "section": stored.section, "faculty_id": stored.faculty_id,
                   "faculty_name": faculty.name if faculty else None,
                   "confirmed_student_ids": committed_students(term, off.course_id),
                   "forecast_student_ids": forecast.get(off.course_id, []), "errors": [], "warnings": [],
                   "blocked_options": [], "pinned": stored.pinned}
            availability = Availability.query.filter_by(faculty_id=stored.faculty_id, term_id=term.id).first() if faculty else None
            submissions[str(stored.faculty_id)] = availability.version if availability else 0
            if off.assigned_faculty_id != stored.faculty_id:
                row["errors"].append("Faculty assignment changed in Offering setup. Create a revised draft.")
            if not faculty or not faculty.active:
                row["errors"].append("Assign an active faculty member in Offering setup, then create a revised draft.")
            elif faculty.college != off.program.college:
                row["errors"].append("Assigned faculty is not in the offering's college.")
            elif not availability or availability.status != "Submitted":
                row["errors"].append(f"Teaching availability for {faculty.name} has not been submitted for this semester.")
            available = []
            if not row["errors"]:
                candidates = generate_options(_load(availability.windows_json, []), bool(plan.allow_single_day), rules())
                for option in candidates:
                    problems = external_problems(row, option, term, plan)
                    if problems:
                        if len(row["blocked_options"]) < 12:
                            row["blocked_options"].append({"label": option["label"], "reason": " ".join(problems)})
                    else:
                        available.append(option)
                if not available:
                    row["errors"].append("No schedule fits the submitted teaching availability and existing commitments. Review faculty hours or explicitly enable single-day fallback.")
                # Group unavailable periods by pattern, rather than listing every impossible slot.
                all_days = [{"weekday": d, "start": rules()["start"], "end": rules()["end"], "kind": "available"} for d in range(7)]
                generated_ids = {option["id"] for option in candidates}
                seen_patterns = set()
                for option in generate_options(all_days, bool(plan.allow_single_day), rules()):
                    pattern = tuple(m["weekday"] for m in option["meetings"])
                    if option["id"] not in generated_ids and pattern not in seen_patterns and len(row["blocked_options"]) < 12:
                        seen_patterns.add(pattern)
                        row["blocked_options"].append({"label": option["label"], "reason": "Submitted teaching availability does not cover these meetings and any internal break."})
            selected = _load(stored.selection_json, {})
            row["option_id"] = selected.get("id")
            row["meetings"] = selected.get("meetings", [])
            if selected and selected not in available:
                row["errors"].append("Selected schedule no longer fits current availability or commitments. Choose another option.")
            row["options"] = available
            if source_section_count(off, term) > 1:
                message = "Section allocation is not recorded; all confirmed students are conservatively checked against every section."
                row["warnings"].append(message)
                warnings.append(f"{row['code']}: {message}")
            choices[row["id"]] = available
            context.append(row)
            errors.extend(f'{row["code"]} {row["section"]}: {e}' for e in row["errors"])
            has_published_meetings = Section.query.join(Plan).filter(
                Section.offering_id == off.id, Plan.status == "Published",
                Plan.published_term_id == term.id).first() is not None
            if off.schedule and not has_published_meetings:
                warnings.append(f"{row['code']}: existing free-text schedule is not automatically parsed; verify any external commitments.")
        units = {}
        for row in context:
            off = db.session.get(Offering, next(s.offering_id for s in plan.sections if str(s.id) == row["id"]))
            if off and row["faculty_id"]:
                units[row["faculty_id"]] = units.get(row["faculty_id"], 0) + (off.course.units or 3)
        for fid, load in units.items():
            if load > ns["faculty_teaching_load_limit"]():
                errors.append(f"Faculty {db.session.get(Faculty, fid).name} exceeds the semester teaching-load limit ({load} units).")
        offering_signature = [(off.id, off.course_id, off.assigned_faculty_id, off.section, source_section_count(off, term)) for off in offerings_for(term)]
        scheduled_offerings = {s.offering_id for s in plan.sections}
        if {off[0] for off in offering_signature} != scheduled_offerings:
            errors.append("The semester offering list changed. Create a revised draft before approval.")
        for off in offering_signature:
            if sum(s.offering_id == off[0] for s in plan.sections) != off[4]:
                errors.append("A source offering section count changed. Create a revised draft before approval.")
        signature = hashlib.sha256(_dump({"submissions": submissions, "rules": rules(), "offerings": offering_signature,
            "sections": [{k: r[k] for k in ("id", "faculty_id", "course_id", "confirmed_student_ids", "option_id", "meetings")} for r in context]}).encode()).hexdigest()
        return context, choices, errors, warnings, signature

    def plan_data(plan):
        term = db.session.get(Term, plan.term_id)
        context, choices, errors, warnings, signature = sections_context(plan, term)
        selected = {str(s.id): _load(s.selection_json, {}) for s in plan.sections if s.selection_json}
        complete = [row for row in context if row["id"] in selected]
        hard, soft = validate_schedule(complete, selected) if complete else ([], [])
        errors.extend(hard)
        warnings.extend(soft)
        search_limited = False
        if context and len(complete) < len(context) and all(choices.values()):
            pins = {str(s.id): selected[str(s.id)] for s in plan.sections if s.pinned and str(s.id) in selected}
            feasibility = rank_schedules(context, choices, pinned=pins, limit=1)
            search_limited = feasibility["search_limited"]
            if not feasibility["schedules"]:
                if search_limited:
                    warnings.append("No complete timetable found within the search limit. This does not prove the semester is infeasible.")
                else:
                    labels = ", ".join(row["code"] for row in context)
                    errors.append(f"No combination fits the faculty and confirmed-student constraints for {labels}. Review teaching availability, release kept choices, change faculty, or explicitly enable single-day fallback.")
        for row in context:
            if not row["meetings"]:
                errors.append(f'{row["code"]} {row["section"]}: choose a valid schedule.')
            # Candidate conflicts are visible and disabled; keep at most 12 explanations.
            other_rows = [r for r in complete if r["id"] != row["id"]]
            other_selected = {key: value for key, value in selected.items() if key != row["id"]}
            valid = []
            for option in row["options"]:
                failures, _ = validate_schedule(other_rows + [row], {**other_selected, row["id"]: option})
                if failures:
                    if len(row["blocked_options"]) < 12:
                        row["blocked_options"].append({"label": option["label"], "reason": " ".join(failures)})
                else:
                    valid.append(option)
            # Rank alternatives against the other currently selected sections.
            ranking = rank_schedules(other_rows + [row], {
                **{r["id"]: [other_selected[r["id"]]] for r in other_rows}, row["id"]: valid}, limit=3, max_nodes=10000)
            top = [solution["selections"][row["id"]]["id"] for solution in ranking["schedules"]]
            row["options"] = sorted(valid, key=lambda option: (top.index(option["id"]) if option["id"] in top else 3,
                                                              -option.get("preference_score", 0), option["id"]))
            row["recommendation_explanation"] = ranking["schedules"][0]["explanation"] if ranking["schedules"] else []
        return {"id": plan.id, "term_id": plan.term_id, "version": plan.version, "status": plan.status,
                "allow_single_day": plan.allow_single_day, "sections": context, "errors": list(dict.fromkeys(errors)),
                "warnings": list(dict.fromkeys(warnings)), "search_limited": search_limited,
                "approved_at": ns["iso"](plan.approved_at), "published_at": ns["iso"](plan.published_at)}

    def recommend(plan, pinned=None):
        term = db.session.get(Term, plan.term_id)
        context, options, errors, _, _ = sections_context(plan, term)
        # Leave blocked sections unselected while still making useful suggestions for the others.
        feasible = [r for r in context if options[r["id"]]]
        persistent = {str(s.id): next((o for o in options[str(s.id)] if o["id"] == _load(s.selection_json, {}).get("id")),
                      _load(s.selection_json, {})) for s in plan.sections if s.pinned and s.selection_json}
        result = rank_schedules(feasible, {r["id"]: options[r["id"]] for r in feasible},
                                pinned={**persistent, **(pinned or {})}, limit=3, max_nodes=10000)
        if result["schedules"]:
            selections = result["schedules"][0]["selections"]
            for stored in plan.sections:
                option = selections.get(str(stored.id))
                if option:
                    stored.selection_json = _dump(option)
        return result

    def coordinator_payload(term):
        plan = Plan.query.filter_by(term_id=term.id).order_by(Plan.id.desc()).first()
        availability = []
        for faculty in Faculty.query.filter_by(active=True).order_by(Faculty.name).all():
            row = Availability.query.filter_by(faculty_id=faculty.id, term_id=term.id).first()
            availability.append({"faculty_id": faculty.id, "faculty_name": faculty.name, **availability_data(row)})
        return {**term_data(term), "availability": availability, "plan": plan_data(plan) if plan else None, "rules": rules()}

    @app.route("/api/teaching-schedules", methods=["GET", "POST"])
    @login("academic_coordinator")
    def teaching_schedules():
        if request.method == "POST" and ns["current_account"]().role != "academic_coordinator":
            abort(403, description="Only the Academic Coordinator can manage class schedules.")
        data = json_body() if request.method == "POST" else None
        term = term_of(data)
        if request.method == "GET":
            return jsonify(coordinator_payload(term))
        if data.get("action", "draft") not in ("draft", "revise"):
            return jsonify(error="Choose draft or revise."), 400
        active_draft = Plan.query.filter_by(term_id=term.id, status="Draft").first()
        if active_draft and data.get("action", "draft") != "revise":
            return jsonify(plan=plan_data(active_draft), message="Continue the existing draft."), 200
        if active_draft:
            active_draft.status = "Archived"
        if not isinstance(data.get("allow_single_day", False), bool):
            return jsonify(error="Single-day fallback must be explicitly true or false."), 400
        previous = Plan.query.filter_by(published_term_id=term.id).first()
        plan = Plan(term_id=term.id, allow_single_day=data.get("allow_single_day", False),
                    base_published_plan_id=previous.id if previous else None)
        db.session.add(plan)
        db.session.flush()
        previous_choices = previous or Plan.query.filter_by(term_id=term.id, status="Approved").order_by(Plan.id.desc()).first()
        for off in offerings_for(term):
            count = source_section_count(off, term)
            if count > 50:
                db.session.rollback()
                return jsonify(error="Review the section count before scheduling more than 50 sections."), 400
            for index in range(count):
                label = (off.section or "A") if count == 1 else str(index + 1)
                old = next((s for s in previous_choices.sections if s.offering_id == off.id and s.section == label), None) if previous_choices else None
                section = Section(plan_id=plan.id, offering_id=off.id, faculty_id=off.assigned_faculty_id,
                                  section=label, selection_json=old.selection_json if old else None, pinned=bool(old))
                db.session.add(section)
        db.session.flush()
        db.session.expire(plan, ["sections"])
        if previous_choices:
            # Preserve all published choices; revision edits are explicit.
            result = {"search_limited": False}
        else:
            result = recommend(plan)
        audit(f"Teaching timetable draft created for {term.label}.")
        db.session.commit()
        payload = plan_data(plan)
        payload["search_limited"] = result["search_limited"]
        return jsonify(plan=payload, **term_data(term))

    @app.route("/api/teaching-schedules/<int:plan_id>", methods=["POST"])
    @login("academic_coordinator")
    def teaching_schedule_update(plan_id):
        if ns["current_account"]().role != "academic_coordinator":
            abort(403, description="Only the Academic Coordinator can approve or change class schedules.")
        plan = db.session.get(Plan, plan_id)
        if not plan:
            abort(404)
        data, term = json_body(), db.session.get(Term, plan.term_id)
        version, action = version_of(data), data.get("action", "save")
        if action not in ("save", "recommend", "approve", "publish"):
            return jsonify(error="Choose save, recommend, approve or publish."), 400
        if plan.status in ("Published", "Archived"):
            return jsonify(error="Published schedules are immutable. Create a revised draft."), 409
        if plan.version != version:
            return jsonify(error="The schedule changed. Reload before saving."), 409
        if action == "publish" and plan.status != "Approved":
            return jsonify(error="Approve the timetable before publishing."), 409
        if action in ("save", "recommend", "approve") and plan.status != "Draft":
            return jsonify(error="The timetable is already approved. Create a revised draft to change it."), 409
        updated = Plan.query.filter_by(id=plan.id, version=version).update(
            {"version": version + 1, "updated_at": ns["now_utc"]()}, synchronize_session=False)
        if not updated:
            db.session.rollback()
            return jsonify(error="The schedule changed. Reload before saving."), 409
        if "allow_single_day" in data:
            if action not in ("save", "recommend") or not isinstance(data["allow_single_day"], bool):
                db.session.rollback()
                return jsonify(error="Change the fallback policy only on a draft."), 400
            plan.allow_single_day = data["allow_single_day"]
        edits = data.get("sections", [])
        if not isinstance(edits, list) or len(edits) > 300:
            db.session.rollback()
            return jsonify(error="Send a list of section choices."), 400
        if edits and action not in ("save", "recommend"):
            db.session.rollback()
            return jsonify(error="Save schedule changes before approval or publication."), 409
        context, options, _, _, _ = sections_context(plan, term)
        stored_by_id, pinned = {str(s.id): s for s in plan.sections}, {}
        for edit in edits:
            if not isinstance(edit, dict) or str(edit.get("id")) not in stored_by_id:
                db.session.rollback()
                return jsonify(error="That section is not in this timetable."), 400
            key = str(edit["id"])
            if "pinned" in edit and not isinstance(edit["pinned"], bool):
                db.session.rollback()
                return jsonify(error="Pinned must be true or false."), 400
            if "option_id" not in edit and edit.get("pinned") is False:
                stored_by_id[key].pinned = False
                continue
            chosen = next((o for o in options[key] if o["id"] == edit.get("option_id")), None)
            if not chosen:
                db.session.rollback()
                return jsonify(error="That option no longer fits current teaching availability or commitments."), 409
            stored_by_id[key].selection_json = _dump(chosen)
            stored_by_id[key].pinned = edit.get("pinned", True)
            if stored_by_id[key].pinned:
                pinned[key] = chosen
        result = None
        if action == "recommend":
            result = recommend(plan, pinned)
            if not result["schedules"] and any(options.values()):
                db.session.rollback()
                reason = "No solution found within the search limit." if result["search_limited"] else "No feasible combination fits the pinned choices."
                detail = "; ".join(result["blockers"][:3])
                return jsonify(error=f"{reason} {detail}".strip(), blockers=result["blockers"]), 409
        payload = plan_data(plan)
        if action in ("approve", "publish"):
            if not plan.sections:
                payload["errors"].append("Add approved offerings before approving a timetable.")
            if payload["errors"]:
                db.session.rollback()
                return jsonify(error="Cannot approve or publish: " + "; ".join(payload["errors"][:3]), errors=payload["errors"]), 409
            _, _, _, _, signature = sections_context(plan, term)
            if action == "approve":
                plan.status, plan.approved_signature = "Approved", signature
                plan.approved_by, plan.approved_at = ns["current_account"]().id, ns["now_utc"]()
            else:
                if signature != plan.approved_signature:
                    db.session.rollback()
                    return jsonify(error="Availability, enrollment or scheduling rules changed after approval. Create and approve a revised draft."), 409
                old = Plan.query.filter_by(published_term_id=term.id).first()
                if (old.id if old else None) != plan.base_published_plan_id:
                    db.session.rollback()
                    return jsonify(error="Another timetable was published while this draft was being reviewed. Create a new revision."), 409
                if old and old.id != plan.id:
                    old.status, old.published_term_id = "Archived", None
                    db.session.flush()
                plan.status, plan.published_term_id, plan.published_at = "Published", term.id, ns["now_utc"]()
                # Display strings are derived; only the structured records drive validation.
                for off in offerings_for(term):
                    sections = [s for s in plan.sections if s.offering_id == off.id]
                    off.schedule = "; ".join(f'{s.section}: {_load(s.selection_json, {}).get("label", "")}' for s in sections)[:160] or off.schedule
                faculty_ids, student_ids = {s.faculty_id for s in plan.sections if s.faculty_id}, set()
                for section in plan.sections:
                    off = db.session.get(Offering, section.offering_id)
                    student_ids.update(committed_students(term, off.course_id))
                for faculty_id in faculty_ids:
                    ns["notify_many"](ns["accounts_for_faculty"](faculty_id), "class_schedule", "Class timetable published",
                        f"Review your assigned classes for {term.label}.", link=f"/faculty-portal/schedule?term_id={term.id}",
                        related_type="teaching_schedule", related_id=plan.id,
                        dedupe_key=f"class-published:{plan.id}:faculty:{faculty_id}")
                for student_id in student_ids:
                    ns["notify_many"](ns["accounts_for_student"](student_id), "class_schedule", "Class timetable published",
                        f"Review your class schedule for {term.label}.", link=f"/student/class-schedule?term_id={term.id}",
                        related_type="teaching_schedule", related_id=plan.id,
                        dedupe_key=f"class-published:{plan.id}:student:{student_id}")
        audit(f"Teaching timetable {action} for {term.label}.")
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return jsonify(error="Another timetable changed during publication. Reload and review."), 409
        db.session.expire_all()
        payload = plan_data(db.session.get(Plan, plan.id))
        if result:
            payload["search_limited"] = result["search_limited"]
            payload["recommendations"] = result["schedules"]
        return jsonify(plan=payload, **term_data(term))

    @app.route("/api/student-portal/class-schedule")
    @login("student")
    def student_class_schedule():
        account, term = ns["current_account"](), term_of()
        if not account.student_id:
            abort(403, description="Your student record is required.")
        return jsonify(**term_data(term), sections=faculty_public_sections(term, student_id=account.student_id))
