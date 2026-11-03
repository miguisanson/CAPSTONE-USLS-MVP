"""Deterministic, dependency-free class timetable candidates and bounded search.

Times are Philippine local wall times. Candidate generation enforces entered
availability; callers must separately check term dates and external bookings.
Search returns the best combinations *examined*, not a promise of optimality.
"""
from copy import deepcopy
from itertools import combinations

DEFAULT_CONFIG = {"start": "07:30", "end": "21:00", "duration": 90,
                  "gap": 15, "paired_days": [(0, 3), (1, 4), (2, 5)]}
DAY_NAMES = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


def _minutes(value):
    if not isinstance(value, str) or len(value) != 5 or value[2] != ":":
        raise ValueError("Times must use HH:MM.")
    try:
        hour, minute = map(int, value.split(":"))
    except ValueError:
        raise ValueError("Times must use HH:MM.") from None
    if not (0 <= hour <= 23 and 0 <= minute < 60):
        raise ValueError("Time is outside the day.")
    return hour * 60 + minute


def _clock(value):
    return f"{value // 60:02d}:{value % 60:02d}"


def _weekday(value):
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value < 7:
        raise ValueError("Weekday must be 0 (Monday) through 6 (Sunday).")
    return value


def _interval(row):
    start, end = _minutes(row.get("start")), _minutes(row.get("end"))
    if end <= start:
        raise ValueError("End time must follow start time.")
    return _weekday(row.get("weekday")), start, end


def _covered(start, end, intervals):
    cursor = start
    for left, right in sorted(intervals):
        if left > cursor:
            break
        cursor = max(cursor, right)
        if cursor >= end:
            return True
    return False


def generate_options(windows, allow_single_day=False, config=None):
    """Generate paired options and optional two-session single-day blocks.

    Config keys: start/end (HH:MM), duration/gap (minutes), paired_days.
    Available windows are required; preferred windows never grant availability.
    Unavailability wins, including during a single-day block's internal break.
    """
    settings = {**DEFAULT_CONFIG, **(config or {})}
    start, end = _minutes(settings["start"]), _minutes(settings["end"])
    duration, gap = settings["duration"], settings["gap"]
    if (isinstance(duration, bool) or not isinstance(duration, int) or duration <= 0
            or isinstance(gap, bool) or not isinstance(gap, int) or gap < 0 or end <= start):
        raise ValueError("Invalid scheduling hours, duration or gap.")
    pairs = []
    for pair in settings["paired_days"]:
        if not isinstance(pair, (tuple, list)) or len(pair) != 2:
            raise ValueError("A paired pattern needs two different weekdays.")
        days = tuple(_weekday(day) for day in pair)
        if days[0] == days[1]:
            raise ValueError("A paired pattern needs two different weekdays.")
        if days not in pairs:
            pairs.append(days)
    grouped = {kind: {day: [] for day in range(7)}
               for kind in ("available", "unavailable", "preferred")}
    for row in windows:
        if not isinstance(row, dict) or row.get("kind") not in grouped:
            raise ValueError("Each window needs an available, unavailable or preferred kind.")
        day, left, right = _interval(row)
        grouped[row["kind"]][day].append((left, right))

    def permitted(day, left, right):
        return (_covered(left, right, grouped["available"][day])
                and not any(left < b and a < right for a, b in grouped["unavailable"][day]))

    options = []
    def append(days, left, single):
        starts = [left, left + duration + gap] if single else [left, left]
        meetings = [{"weekday": day, "start": _clock(a), "end": _clock(a + duration)}
                    for day, a in zip(days, starts)]
        preferred = sum(_covered(a, a + duration, grouped["preferred"][day])
                        for day, a in zip(days, starts))
        pattern = "single" if single else "paired"
        day_label = DAY_NAMES[days[0]] if single else "/".join(DAY_NAMES[d] for d in days)
        last_end = starts[-1] + duration
        options.append({"id": f"{pattern}-{'-'.join(map(str, days))}-{_clock(left)}-{duration}-{gap}",
                        "label": f"{day_label} {_clock(left)}–{_clock(last_end)}"
                                 + (f" (two sessions; {gap}-minute break)" if single else ""),
                        "format": pattern, "meetings": meetings, "preference_score": preferred,
                        "duration_minutes": duration, "gap_minutes": gap})

    for days in pairs:
        for left in range(start, end - duration + 1, duration + gap):
            if all(permitted(day, left, left + duration) for day in days):
                append(days, left, False)
    if allow_single_day:
        for day in range(7):
            for left in range(start, end - (2 * duration + gap) + 1, duration + gap):
                if permitted(day, left, left + 2 * duration + gap):
                    append((day, day), left, True)
    return options


def _blocks(option):
    if not isinstance(option, dict) or not isinstance(option.get("meetings"), list):
        raise ValueError("A selected option needs structured meetings.")
    meetings = [_interval(m) for m in option["meetings"] if isinstance(m, dict)]
    if len(meetings) != 2 or len(option["meetings"]) != 2:
        raise ValueError("A class requires two meetings.")
    duration, gap = option.get("duration_minutes", 90), option.get("gap_minutes", 15)
    if (isinstance(duration, bool) or not isinstance(duration, int) or duration <= 0
            or isinstance(gap, bool) or not isinstance(gap, int) or gap < 0):
        raise ValueError("Invalid class duration or gap.")
    if any(end - start != duration for _, start, end in meetings):
        raise ValueError("Class meeting duration does not match the configured duration.")
    if meetings[0][0] == meetings[1][0]:
        first, second = sorted(meetings, key=lambda m: m[1])
        if second[1] - first[2] != gap:
            raise ValueError("Single-day sessions require the configured internal break.")
        return [(first[0], first[1], second[2])], gap
    if meetings[0][1:] != meetings[1][1:]:
        raise ValueError("Paired-day meetings must have the same start and end times.")
    return meetings, gap


def validate_schedule(sections, selections):
    """Check a selected combination; availability membership stays caller-owned.

    Faculty and confirmed students require a transition gap between classes.
    Forecast-only shared attendance produces warnings, never hard restrictions.
    """
    errors, warnings, parsed = [], [], {}
    section_by_id = {section["id"]: section for section in sections}
    for key in selections:
        if key not in section_by_id:
            errors.append(f"Unknown section: {key}.")
    for section in sections:
        key = section["id"]
        if key not in selections:
            errors.append(f"{key}: no schedule selected.")
            continue
        try:
            parsed[key] = _blocks(selections[key])
        except (ValueError, TypeError) as exc:
            errors.append(f"{key}: {exc}")
    for a, b in combinations(sections, 2):
        aid, bid = a["id"], b["id"]
        if aid not in parsed or bid not in parsed:
            continue
        ablocks, agap = parsed[aid]
        bblocks, bgap = parsed[bid]
        conflict = any(day == other and left < finish + max(agap, bgap)
                       and begin < right + max(agap, bgap)
                       for day, left, right in ablocks for other, begin, finish in bblocks)
        if not conflict:
            continue
        label = f"{aid} and {bid}"
        if a.get("faculty_id") is not None and a.get("faculty_id") == b.get("faculty_id"):
            errors.append(f"{label}: faculty overlap or insufficient transition gap.")
        confirmed = set(a.get("confirmed_student_ids") or []) & set(b.get("confirmed_student_ids") or [])
        if confirmed:
            errors.append(f"{label}: {len(confirmed)} confirmed student(s) overlap or lack a transition gap.")
        predicted = ((set(a.get("forecast_student_ids") or []) | set(a.get("confirmed_student_ids") or []))
                     & (set(b.get("forecast_student_ids") or []) | set(b.get("confirmed_student_ids") or []))) - confirmed
        if predicted:
            warnings.append(f"{label}: {len(predicted)} potential student conflict(s) inferred from forecast demand.")
    return errors, warnings


def _score(sections, selections):
    _, warnings = validate_schedule(sections, selections)
    preferred = sum(option.get("preference_score", 0) for option in selections.values())
    visits, gaps = {}, 0
    for section in sections:
        blocks, _ = _blocks(selections[section["id"]])
        for day, start, end in blocks:
            people = [("faculty", section.get("faculty_id"))] if section.get("faculty_id") is not None else []
            people += [("student", sid) for sid in section.get("confirmed_student_ids", [])]
            for person in people:
                visits.setdefault((*person, day), []).append((start, end))
    for windows in visits.values():
        windows.sort()
        gaps += sum(max(0, b[0] - a[1]) for a, b in zip(windows, windows[1:]))
    return (len(warnings), -preferred, len(visits), gaps)


def rank_schedules(sections, options_by_id, limit=3, pinned=None, max_nodes=20000):
    """Bounded constrained-first search; pins are never moved or invented.

    Ranking is lexicographic: forecast conflict pairs, preferred sessions, campus
    visits, then idle minutes. Tied schedules remain equivalent alternatives.
    """
    if limit < 1 or max_nodes < 0:
        raise ValueError("Result limit must be positive and search budget nonnegative.")
    pinned, choices, blockers = pinned or {}, {}, []
    ids = {section["id"] for section in sections}
    if len(ids) != len(sections):
        raise ValueError("Section identifiers must be unique.")
    for key in pinned:
        if key not in ids:
            blockers.append(f"Pinned section {key} does not exist.")
    for section in sections:
        key = section["id"]
        choices[key] = []
        for option in options_by_id.get(key, []):
            try:
                _blocks(option)
            except (ValueError, TypeError):
                continue
            if key not in pinned or option == pinned[key]:
                choices[key].append(option)
        choices[key].sort(key=lambda option: (-option.get("preference_score", 0), str(option.get("id", ""))))
        if not choices[key]:
            blockers.append(f"{key}: no valid option" + (" matches the pinned choice." if key in pinned else "."))
    result = {"schedules": [], "search_limited": False, "nodes_examined": 0, "blockers": blockers}
    if blockers:
        return result
    ordered = sorted(sections, key=lambda section: (len(choices[section["id"]]), str(section["id"])))
    best, selected = [], {}

    def search(depth):
        if depth == len(ordered):
            score = _score(sections, selected)
            signature = tuple((str(k), str(v.get("id", ""))) for k, v in sorted(selected.items(), key=lambda item: str(item[0])))
            best.append((score, signature, deepcopy(selected)))
            best.sort(key=lambda entry: (entry[0], entry[1]))
            del best[limit:]
            return
        section = ordered[depth]
        for option in choices[section["id"]]:
            if result["nodes_examined"] >= max_nodes:
                result["search_limited"] = True
                return
            result["nodes_examined"] += 1
            selected[section["id"]] = option
            errors, _ = validate_schedule(ordered[:depth + 1], selected)
            if not errors:
                search(depth + 1)
            del selected[section["id"]]
            if result["search_limited"]:
                return

    search(0)
    for score, _, selection in best:
        result["schedules"].append({"selections": selection, "score": list(score),
            "explanation": [f"{score[0]} forecast conflict pair(s)", f"{-score[1]} preferred session(s)",
                            f"{score[2]} weekly campus visit(s)", f"{score[3]} idle minute(s)",
                            "Equivalent scores are equally ranked; these are the best combinations examined."]})
    if not best and not result["search_limited"]:
        result["blockers"].append("No combination satisfies faculty and confirmed-student constraints.")
    return result
