"""Leave of Absence and Readmission: the words, the allowed moves and the timeline.

Nothing in this file touches the database. ``app.py`` owns the ``LeaveCase`` table
and applies these rules; the React screens read the same vocabulary from the API,
so the board columns, the filters, the badges and the student timeline always agree.

A *case* is one request: a Leave of Absence (``LOA``), a request to stay on leave
longer (``LOA_EXTENSION``) or a request to come back (``READMISSION``). Its status
lives on the case row, never in free text.
"""

from __future__ import annotations

KIND_LOA = "LOA"
KIND_EXTENSION = "LOA_EXTENSION"
KIND_READMISSION = "READMISSION"
KINDS = (KIND_LOA, KIND_EXTENSION, KIND_READMISSION)
KIND_LABELS = {
    KIND_LOA: "Leave of Absence",
    KIND_EXTENSION: "Leave extension",
    KIND_READMISSION: "Readmission",
}

SLUG_LOA = "leave-of-absence"
SLUG_READMISSION = "readmission"
SLUG_FOR_KIND = {KIND_LOA: SLUG_LOA, KIND_EXTENSION: SLUG_LOA, KIND_READMISSION: SLUG_READMISSION}
KINDS_FOR_SLUG = {SLUG_LOA: (KIND_LOA, KIND_EXTENSION), SLUG_READMISSION: (KIND_READMISSION,)}
LEAVE_SLUGS = (SLUG_LOA, SLUG_READMISSION)

STAFF = "Graduate School Staff"
DEAN = "Dean"
STUDENT = "Student"
ACADEMIC_COORDINATOR = "Academic Coordinator"

# One status list for the whole product. ``owner`` is who has to act next.
STATUS_INFO = [
    {"key": "Submitted", "label": "Submitted", "owner": STAFF, "tone": "info", "phase": "review",
     "description": "The student filed the request. Graduate School staff have not started yet."},
    {"key": "Staff Review", "label": "In staff review", "owner": STAFF, "tone": "info", "phase": "review",
     "description": "Graduate School staff are checking the request against the handbook rules."},
    {"key": "Returned", "label": "Returned to student", "owner": STUDENT, "tone": "warn", "phase": "review",
     "description": "Sent back with a comment. The student corrects it and sends it again."},
    {"key": "Dean Review", "label": "With the Dean", "owner": DEAN, "tone": "info", "phase": "review",
     "description": "Staff forwarded the request. The Dean approves, returns or denies it."},
    {"key": "Leave Scheduled", "label": "Leave scheduled", "owner": STAFF, "tone": "good", "phase": "leave",
     "description": "Approved. The leave begins when the first semester of the leave starts."},
    {"key": "On Leave", "label": "On leave", "owner": STUDENT, "tone": "good", "phase": "leave",
     "description": "The student is on leave. Enrollment is closed until a readmission is approved."},
    {"key": "Return Due", "label": "Return due", "owner": STUDENT, "tone": "warn", "phase": "leave",
     "description": "The leave is ending. The student files a readmission request to come back."},
    {"key": "Approved", "label": "Approved", "owner": STAFF, "tone": "good", "phase": "done",
     "description": "The Dean approved it. Staff send the decision to the Registrar."},
    {"key": "Denied", "label": "Denied", "owner": STAFF, "tone": "bad", "phase": "done",
     "description": "The Dean denied the request. Staff tell the student what they can do next."},
    {"key": "Withdrawn", "label": "Withdrawn by student", "owner": "", "tone": "muted", "phase": "done",
     "description": "The student took the request back before the Dean decided."},
    {"key": "Cancelled", "label": "Cancelled before it started", "owner": "", "tone": "muted", "phase": "done",
     "description": "An approved leave was cancelled before it began."},
    {"key": "Closed", "label": "Closed", "owner": "", "tone": "muted", "phase": "done",
     "description": "The leave is over: the student came back."},
    {"key": "Expired", "label": "Leave ended, no return", "owner": STAFF, "tone": "bad", "phase": "done",
     "description": "The leave ended without a return. Staff confirmed the student as AWOL."},
]
STATUS_BY_KEY = {item["key"]: item for item in STATUS_INFO}
STATUS_KEYS = [item["key"] for item in STATUS_INFO]

# Statuses that count as "a request is being worked on" (one per student and kind).
OPEN_STATUSES = ("Submitted", "Staff Review", "Returned", "Dean Review")
# The student is (or is about to be) away.
ACTIVE_LEAVE_STATUSES = ("Leave Scheduled", "On Leave", "Return Due")
# A leave the Dean approved at some point (counts toward the four-semester limit).
APPROVED_LEAVE_STATUSES = ("Leave Scheduled", "On Leave", "Return Due", "Closed", "Expired", "Approved")
TERMINAL_STATUSES = ("Approved", "Denied", "Withdrawn", "Cancelled", "Closed", "Expired")

BOARD_COLUMNS = {
    SLUG_LOA: [
        {"key": "submitted", "label": "Submitted", "statuses": ["Submitted"],
         "description": "Waiting for Graduate School staff to start."},
        {"key": "staff_review", "label": "In staff review", "statuses": ["Staff Review"],
         "description": "Staff are checking the request against the handbook rules."},
        {"key": "returned", "label": "Returned to student", "statuses": ["Returned"],
         "description": "Waiting for the student to correct and resend."},
        {"key": "dean", "label": "With the Dean", "statuses": ["Dean Review"],
         "description": "Waiting for the Dean's decision."},
        {"key": "scheduled", "label": "Leave scheduled", "statuses": ["Leave Scheduled"],
         "description": "Approved; the leave has not started yet."},
        {"key": "on_leave", "label": "On leave", "statuses": ["On Leave"],
         "description": "The student is away. Enrollment is closed."},
        {"key": "return_due", "label": "Return due", "statuses": ["Return Due"],
         "description": "The leave is ending or has ended. Follow up with the student."},
        {"key": "ended", "label": "Ended", "statuses": ["Closed", "Approved", "Expired"],
         "description": "Finished leaves, approved extensions and leaves that ended with no return."},
        {"key": "not_approved", "label": "Not approved", "statuses": ["Denied", "Withdrawn", "Cancelled"],
         "description": "Denied, taken back by the student, or cancelled."},
    ],
    SLUG_READMISSION: [
        {"key": "submitted", "label": "Submitted", "statuses": ["Submitted"],
         "description": "Waiting for Graduate School staff to start."},
        {"key": "staff_review", "label": "In staff review", "statuses": ["Staff Review"],
         "description": "Staff are checking the return checklist."},
        {"key": "returned", "label": "Returned to student", "statuses": ["Returned"],
         "description": "Waiting for the student to correct and resend."},
        {"key": "dean", "label": "With the Dean", "statuses": ["Dean Review"],
         "description": "Waiting for the Dean's decision."},
        {"key": "approved", "label": "Approved - back in the program", "statuses": ["Approved"],
         "description": "The student is active again. The Academic Coordinator plans the enrollment."},
        {"key": "not_approved", "label": "Not approved", "statuses": ["Denied", "Withdrawn"],
         "description": "Denied or taken back by the student."},
    ],
}


def column_key_for_status(slug: str, status: str) -> str | None:
    for column in BOARD_COLUMNS.get(slug, []):
        if status in column["statuses"]:
            return column["key"]
    return None


def _move(action, label, from_statuses, to, roles, *, kinds=KINDS, comment=False, tone="primary",
          batch=False, confirm=""):
    return {
        "action": action,
        "label": label,
        "from": tuple(from_statuses),
        "to": to,
        "roles": frozenset(roles),
        "kinds": tuple(kinds),
        "needs_comment": bool(comment),
        "tone": tone,
        "batch": bool(batch),
        "confirm": confirm,
    }


# Every allowed move: (status, action, role). Anything not listed is refused.
# ``to`` is a status name; "*approved*" means the app decides from the dates.
TRANSITIONS = [
    _move("start_review", "Start review", ["Submitted"], "Staff Review", {"staff"}, tone="secondary"),
    _move("forward", "Forward to Dean", ["Submitted", "Staff Review"], "Dean Review", {"staff"}, batch=True),
    _move("return", "Return to student", ["Submitted", "Staff Review"], "Returned", {"staff"},
          comment=True, tone="warn"),
    _move("approve", "Approve", ["Dean Review"], "*approved*", {"dean"}, batch=True),
    _move("return", "Return for revision", ["Dean Review"], "Returned", {"dean"}, comment=True,
          tone="warn", batch=True),
    _move("deny", "Deny", ["Dean Review"], "Denied", {"dean"}, comment=True, tone="danger", batch=True),
    _move("resubmit", "Send again", ["Returned"], "Submitted", {"student"}),
    _move("withdraw", "Withdraw request", ["Submitted", "Staff Review", "Dean Review", "Returned"],
          "Withdrawn", {"student"}, tone="danger"),
    _move("cancel", "Cancel this leave", ["Leave Scheduled"], "Cancelled", {"student"},
          kinds=[KIND_LOA], tone="danger"),
    _move("revoke", "Revoke before it starts", ["Leave Scheduled"], "Cancelled", {"staff"},
          kinds=[KIND_LOA], comment=True, tone="danger"),
    _move("start_leave", "Start the leave now", ["Leave Scheduled"], "On Leave", {"staff", "system"},
          kinds=[KIND_LOA], tone="secondary"),
    _move("mark_return_due", "Mark return due", ["On Leave"], "Return Due", {"staff", "system"},
          kinds=[KIND_LOA], tone="secondary"),
    _move("confirm_awol", "Confirm AWOL (leave ended, no return)", ["On Leave", "Return Due"], "Expired",
          {"staff"}, kinds=[KIND_LOA], comment=True, tone="danger"),
    _move("close", "Close the leave", ["On Leave", "Return Due"], "Closed", {"system"}, kinds=[KIND_LOA]),
]


def role_key(account_role: str) -> str:
    """Admin acts as Graduate School staff; everything else is its own role."""
    return "staff" if account_role == "admin" else account_role


def transitions_from(status: str, kind: str, role: str) -> list[dict]:
    role = role_key(role)
    return [
        item for item in TRANSITIONS
        if status in item["from"] and kind in item["kinds"] and role in item["roles"]
    ]


def find_transition(status: str, action: str, kind: str, role: str) -> dict | None:
    for item in transitions_from(status, kind, role):
        if item["action"] == action:
            return item
    return None


def any_transition_named(action: str, kind: str) -> bool:
    return any(item["action"] == action and kind in item["kinds"] for item in TRANSITIONS)


def next_owner(kind: str, status: str) -> str:
    if status == "Approved" and kind == KIND_READMISSION:
        return ACADEMIC_COORDINATOR
    return STATUS_BY_KEY.get(status, {}).get("owner", "")


def vocabulary_payload() -> dict:
    """What the screens need: statuses, board columns and every allowed move."""
    return {
        "statuses": STATUS_INFO,
        "open_statuses": list(OPEN_STATUSES),
        "active_leave_statuses": list(ACTIVE_LEAVE_STATUSES),
        "columns": BOARD_COLUMNS,
        "kinds": [{"key": key, "label": KIND_LABELS[key], "slug": SLUG_FOR_KIND[key]} for key in KINDS],
        "transitions": [
            {
                "action": item["action"],
                "label": item["label"],
                "from": list(item["from"]),
                "to": item["to"],
                "roles": sorted(item["roles"]),
                "kinds": list(item["kinds"]),
                "needs_comment": item["needs_comment"],
                "tone": item["tone"],
                "batch": item["batch"],
            }
            for item in TRANSITIONS
        ],
    }


# ---------------------------------------------------------------------------
# Timeline shown on the student's case card
# ---------------------------------------------------------------------------
_LOA_STEPS = [
    ("Request submitted", ["Submitted"]),
    ("Staff review", ["Staff Review"]),
    ("Dean decision", ["Dean Review"]),
    ("Leave begins", ["Leave Scheduled", "On Leave"]),
    ("Return", ["Return Due"]),
    ("Back in the program", ["Closed"]),
]
_READMISSION_STEPS = [
    ("Request submitted", ["Submitted"]),
    ("Staff review", ["Staff Review"]),
    ("Dean decision", ["Dean Review"]),
    ("Back in the program", ["Approved"]),
]


def timeline_steps(kind: str, status: str, reached=()) -> list[dict]:
    """Steps with a state each: complete, current, upcoming, returned, denied or stopped.

    ``reached`` is every status the case has passed through (from its history); it
    tells us where a returned, denied or withdrawn case stopped.
    """
    steps = _READMISSION_STEPS if kind == KIND_READMISSION else _LOA_STEPS
    reached = set(reached) | {status}

    def step_index(names) -> int | None:
        for index, (_label, statuses) in enumerate(steps):
            if any(name in statuses for name in names):
                return index
        return None

    review_reached = [
        index for index in (0, 1, 2)
        if any(name in steps[index][1] for name in reached)
    ]
    last_review = max(review_reached) if review_reached else 0
    if status in {"Returned"}:
        stop_index, stop_state = last_review, "returned"
    elif status == "Denied":
        stop_index, stop_state = 2, "denied"
    elif status in {"Withdrawn"}:
        stop_index, stop_state = last_review, "stopped"
    elif status == "Cancelled":
        stop_index, stop_state = 3, "stopped"
    elif status == "Expired":
        stop_index, stop_state = 4 if kind != KIND_READMISSION else 3, "denied"
    else:
        stop_index, stop_state = None, None

    if stop_index is not None:
        return [
            {"label": label, "state": "complete" if index < stop_index else stop_state if index == stop_index else "upcoming"}
            for index, (label, _statuses) in enumerate(steps)
        ]
    if status == "Approved" and kind == KIND_EXTENSION:
        current = 3
        return [
            {"label": label, "state": "complete" if index <= current else "upcoming"}
            for index, (label, _statuses) in enumerate(steps)
        ]
    done = (status == "Closed" and kind != KIND_READMISSION) or (status == "Approved" and kind == KIND_READMISSION)
    if done:
        return [{"label": label, "state": "complete"} for label, _statuses in steps]
    current = step_index([status])
    if current is None:
        current = 0
    return [
        {
            "label": label,
            "state": "complete" if index < current else "current" if index == current else "upcoming",
        }
        for index, (label, _statuses) in enumerate(steps)
    ]


# ---------------------------------------------------------------------------
# Reading the old log-based records (one-time, safe to repeat)
# ---------------------------------------------------------------------------
LEGACY_RESULTS = {
    SLUG_LOA: {
        "LOA application submitted": "submitted",
        "LOA request forwarded to Dean": "forwarded",
        "LOA approved by Dean": "approved",
        "LOA denied by Dean": "denied",
        "LOA returned by Dean for revision": "returned",
        "LOA application withdrawn by student": "withdrawn",
    },
    SLUG_READMISSION: {
        "Readmission request submitted": "submitted",
        "Readmission request forwarded to Dean": "forwarded",
        "Readmission approved by Dean": "approved",
        "Readmission denied by Dean": "denied",
        "Readmission returned by Dean for revision": "returned",
    },
}


def legacy_event_name(slug: str, result: str, new_status: str | None) -> str | None:
    """'submitted', 'forwarded', 'approved', ... for an old log row, else None."""
    known = LEGACY_RESULTS.get(slug, {})
    name = known.get(result or "")
    if name:
        return name
    if (result or "").lower().endswith("returned for clarification") and (new_status or "") == "Returned for Clarification":
        return "returned"
    return None


def split_period(text: str) -> tuple[str, str]:
    """'A to B' -> ('A', 'B'); a single label -> (label, label); empty -> ('', '')."""
    text = (text or "").strip().rstrip(".")
    if not text or text.lower() == "not specified":
        return "", ""
    if " to " in text:
        start, end = text.split(" to ", 1)
        return start.strip(), end.strip().rstrip(".")
    return text, text
