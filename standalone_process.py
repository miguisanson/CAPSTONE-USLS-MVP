"""AWOL & Residency and Withdrawal: the stage vocabulary and the allowed moves.

Leave of Absence and Readmission keep their own rules in ``leave_workflow.py``. This file
gives the other two standalone processes the same shape, so all four staff boards read
one vocabulary: board columns, statuses with a tone and an owner, and a table of allowed
moves (status, action, role). Anything not listed here is refused.

Nothing in this file touches the database or changes a business rule. ``app.py`` owns the
records (``AwolCase``, ``ResidencyEnrollment``, ``WithdrawalApplication``) and every move
listed here is applied by the code that already owned it (``handle_withdrawal``,
``handle_awol``, the Dean's decision route, the workflow message "return").
"""

from __future__ import annotations

SLUG_AWOL = "awol"
SLUG_WITHDRAWAL = "withdrawal"
STANDALONE_SLUGS = ("leave-of-absence", "readmission", SLUG_AWOL, SLUG_WITHDRAWAL)
PROCESS_SLUGS = (SLUG_AWOL, SLUG_WITHDRAWAL)  # the two this file describes

KIND_AWOL = "AWOL"
KIND_RESIDENCY = "RESIDENCY"
KIND_WITHDRAWAL = "WITHDRAWAL"
KIND_LABELS = {
    KIND_AWOL: "Return from AWOL",
    KIND_RESIDENCY: "Residency",
    KIND_WITHDRAWAL: "Subject withdrawal",
}
KINDS_FOR_SLUG = {SLUG_AWOL: (KIND_AWOL, KIND_RESIDENCY), SLUG_WITHDRAWAL: (KIND_WITHDRAWAL,)}

STAFF = "Graduate School Staff"
DEAN = "Dean"
STUDENT = "Student"
ACADEMIC_COORDINATOR = "Academic Coordinator"

# slug -> status rows. ``owner`` is who has to act next; ``phase`` groups the board.
STATUS_INFO_BY_SLUG = {
    SLUG_AWOL: [
        {"key": "AWOL Declared", "label": "AWOL (flagged by the system)", "owner": STUDENT, "tone": "bad", "phase": "review",
         "description": "The policy engine flagged the student from source records. The student files a written return."},
        {"key": "Return Submitted", "label": "Return filed", "owner": STAFF, "tone": "info", "phase": "review",
         "description": "The student filed a written intention to return. Staff run the policy check and forward it."},
        {"key": "Returned for Revision", "label": "Returned to student", "owner": STUDENT, "tone": "warn", "phase": "review",
         "description": "The Dean sent the return declaration back. The student corrects and files it again."},
        {"key": "Dean Review", "label": "With the Dean", "owner": DEAN, "tone": "info", "phase": "review",
         "description": "Staff forwarded the return. The Dean approves, returns or denies it."},
        {"key": "Re-enrollment Required", "label": "Full re-enrollment required", "owner": STAFF, "tone": "warn", "phase": "review",
         "description": "The Dean endorsed the return for full re-enrollment. The student stays AWOL until it is done."},
        {"key": "Re-enrollment Completed", "label": "Re-enrollment completed", "owner": "", "tone": "good", "phase": "done",
         "description": "The courses were re-enrolled and the student is active again."},
        {"key": "Return Approved", "label": "Return approved", "owner": ACADEMIC_COORDINATOR, "tone": "good", "phase": "done",
         "description": "The Dean approved the return. The Academic Coordinator plans the enrollment."},
        {"key": "Extension Approved - Refresher Required", "label": "Approved with a 6-unit refresher", "owner": ACADEMIC_COORDINATOR,
         "tone": "good", "phase": "done",
         "description": "The Dean approved the return with a graded 6-unit refresher requirement."},
        {"key": "Return Denied", "label": "Return denied", "owner": STAFF, "tone": "bad", "phase": "done",
         "description": "The Dean denied the return. The student stays AWOL; staff explain what happens next."},
        {"key": "Residency", "label": "Residency active", "owner": STAFF, "tone": "info", "phase": "residency",
         "description": "The student is on a no-subject residency semester."},
        {"key": "Residency Completed", "label": "Residency closed", "owner": "", "tone": "muted", "phase": "done",
         "description": "The residency semester was closed."},
    ],
    SLUG_WITHDRAWAL: [
        {"key": "Submitted to GS Staff", "label": "Submitted", "owner": STAFF, "tone": "info", "phase": "review",
         "description": "The student asked to withdraw from one subject. Staff record it and forward it."},
        {"key": "Returned for Clarification", "label": "Returned to student", "owner": STUDENT, "tone": "warn", "phase": "review",
         "description": "Sent back with a comment. The student corrects it and sends it again."},
        {"key": "Returned", "label": "Returned to student", "owner": STUDENT, "tone": "warn", "phase": "review",
         "description": "Sent back with a comment. The student corrects it and sends it again."},
        {"key": "Dean Review", "label": "With the Dean", "owner": DEAN, "tone": "info", "phase": "review",
         "description": "Staff forwarded the request. The Dean approves or denies it."},
        {"key": "Approved - Awaiting Subject Tag", "label": "Approved - tag the subject", "owner": STAFF, "tone": "good", "phase": "registrar",
         "description": "The Dean approved. Staff tag the subject as Withdrawn in Official Offered Subjects."},
        {"key": "Approved - Registrar Preparation", "label": "Approved - tag the subject", "owner": STAFF, "tone": "good", "phase": "registrar",
         "description": "The Dean approved. Staff tag the subject as Withdrawn in Official Offered Subjects."},
        {"key": "Subject Tagged - Registrar Preparation", "label": "Tagged - ready for Excel export", "owner": STAFF, "tone": "good",
         "phase": "registrar",
         "description": "The subject is tagged Withdrawn. Staff export the approved-withdrawals Excel list."},
        {"key": "Exported - Ready to Send", "label": "Exported - email to the Registrar", "owner": STAFF, "tone": "good", "phase": "done",
         "description": "The Excel list was exported. Staff email it to the Registrar; the portal does not send it."},
        {"key": "Sent to Registrar", "label": "Sent to the Registrar", "owner": "", "tone": "muted", "phase": "done",
         "description": "Older record: the list was sent to the Registrar."},
        {"key": "Withdrawn Confirmed", "label": "Registrar confirmed", "owner": "", "tone": "muted", "phase": "done",
         "description": "Older record: the Registrar confirmed the withdrawal."},
        {"key": "Denied", "label": "Denied", "owner": "", "tone": "bad", "phase": "done",
         "description": "The Dean denied the request. The student stays enrolled in the subject."},
        {"key": "Cancelled", "label": "Cancelled", "owner": "", "tone": "muted", "phase": "done",
         "description": "The request was cancelled."},
    ],
}

BOARD_COLUMNS = {
    SLUG_AWOL: [
        {"key": "awol", "label": "AWOL", "statuses": ["AWOL Declared"],
         "description": "Flagged from source records. Waiting for the student's written return."},
        {"key": "return_review", "label": "Return review", "statuses": ["Return Submitted", "Returned for Revision"],
         "description": "Staff check the written return against the residence limits, then forward it."},
        {"key": "dean", "label": "With the Dean", "statuses": ["Dean Review"],
         "description": "Waiting for the Dean's decision."},
        {"key": "reenroll", "label": "Re-enrollment", "statuses": ["Re-enrollment Required"],
         "description": "The Dean endorsed a full re-enrollment. Mark it complete when the courses are re-enrolled."},
        {"key": "back", "label": "Back in the program", "statuses": ["Return Approved", "Extension Approved - Refresher Required", "Re-enrollment Completed"],
         "description": "The return was approved or the re-enrollment is done. The student is active again."},
        {"key": "not_approved", "label": "Not approved", "statuses": ["Return Denied"],
         "description": "The Dean denied the return. The student stays AWOL."},
        {"key": "residency", "label": "Residency", "statuses": ["Residency"],
         "description": "Active no-subject residency semesters."},
        {"key": "residency_closed", "label": "Residency closed", "statuses": ["Residency Completed"],
         "description": "Residency semesters that were closed."},
    ],
    SLUG_WITHDRAWAL: [
        {"key": "submitted", "label": "Submitted", "statuses": ["Submitted to GS Staff"],
         "description": "Waiting for Graduate School staff to record and forward."},
        {"key": "returned", "label": "Returned to student", "statuses": ["Returned for Clarification", "Returned"],
         "description": "Waiting for the student to correct and resend."},
        {"key": "dean", "label": "With the Dean", "statuses": ["Dean Review"],
         "description": "Waiting for the Dean's decision."},
        {"key": "tagging", "label": "Subject tagging", "statuses": ["Approved - Awaiting Subject Tag", "Approved - Registrar Preparation"],
         "description": "Approved. Staff tag the subject as Withdrawn."},
        {"key": "export", "label": "Excel export", "statuses": ["Subject Tagged - Registrar Preparation"],
         "description": "Tagged. Staff export the approved-withdrawals Excel list."},
        {"key": "sent", "label": "Exported - email the Registrar", "statuses": ["Exported - Ready to Send", "Sent to Registrar", "Withdrawn Confirmed"],
         "description": "Exported lists (and older acknowledged records). Staff email the file to the Registrar."},
        {"key": "not_approved", "label": "Not approved", "statuses": ["Denied", "Cancelled"],
         "description": "Denied by the Dean, or cancelled."},
    ],
}

OPEN_STATUSES = {
    SLUG_AWOL: ("Return Submitted", "Returned for Revision", "Dean Review", "Re-enrollment Required"),
    SLUG_WITHDRAWAL: ("Submitted to GS Staff", "Returned for Clarification", "Returned", "Dean Review",
                      "Approved - Awaiting Subject Tag", "Approved - Registrar Preparation"),
}


def status_info(slug: str) -> list[dict]:
    return STATUS_INFO_BY_SLUG[slug]


def status_by_key(slug: str) -> dict:
    return {item["key"]: item for item in STATUS_INFO_BY_SLUG.get(slug, [])}


def column_key_for_status(slug: str, status: str) -> str | None:
    for column in BOARD_COLUMNS.get(slug, []):
        if status in column["statuses"]:
            return column["key"]
    return None


def _move(action, label, from_statuses, to, roles, *, kinds, comment=False, tone="primary",
          batch=False, confirm="", opens=None, student_sees_comment=False):
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
        "opens": opens,
        "student_sees_comment": bool(student_sees_comment),
    }


# Every allowed move. ``to`` is a status name; "*approved*" means the app decides from the record.
TRANSITIONS = {
    SLUG_AWOL: [
        _move("forward", "Forward to Dean", ["Return Submitted", "Returned for Revision"], "Dean Review",
              {"staff", "academic_coordinator"}, kinds=[KIND_AWOL], batch=True,
              confirm="The written return goes to the Dean, who decides. Nothing is decided yet."),
        _move("approve", "Approve the return", ["Dean Review"], "*approved*", {"dean"}, kinds=[KIND_AWOL], batch=True,
              confirm="The Dean's approval restores the student's standing (or sends it on for full re-enrollment)."),
        _move("return", "Return for revision", ["Dean Review"], "Returned for Revision", {"dean"}, kinds=[KIND_AWOL],
              comment=True, tone="warn", batch=True, student_sees_comment=True,
              confirm="The declaration goes back to the student, who corrects it and files it again."),
        _move("deny", "Deny the return", ["Dean Review"], "Return Denied", {"dean"}, kinds=[KIND_AWOL],
              comment=True, tone="danger", batch=True,
              confirm="The student stays AWOL. Staff tell the student what they can do next."),
        _move("complete_reenrollment", "Mark re-enrollment complete", ["Re-enrollment Required"], "Re-enrollment Completed",
              {"staff", "academic_coordinator"}, kinds=[KIND_AWOL], tone="primary",
              confirm="The courses are re-enrolled: the student becomes Active again and this case closes."),
        _move("end_residency", "Close the residency", ["Residency"], "Residency Completed",
              {"staff", "academic_coordinator"}, kinds=[KIND_RESIDENCY], tone="secondary",
              confirm="The residency semester ends and the student's enrollment tag is restored."),
    ],
    SLUG_WITHDRAWAL: [
        _move("forward", "Record and forward to Dean", ["Submitted to GS Staff"], "Dean Review", {"staff"},
              kinds=[KIND_WITHDRAWAL], batch=True,
              confirm="The request goes to the Dean, who decides. Nothing is decided yet."),
        _move("return", "Return to student", ["Submitted to GS Staff", "Dean Review"], "Returned for Clarification",
              {"staff", "dean"}, kinds=[KIND_WITHDRAWAL], comment=True, tone="warn", student_sees_comment=True,
              confirm="The request goes back to the student, who corrects it and sends it again."),
        _move("approve", "Approve the withdrawal", ["Dean Review"], "Approved - Awaiting Subject Tag", {"dean"},
              kinds=[KIND_WITHDRAWAL], batch=True,
              confirm="Approval sends the request back to staff to tag the subject as Withdrawn."),
        _move("deny", "Deny the withdrawal", ["Dean Review"], "Denied", {"dean"}, kinds=[KIND_WITHDRAWAL],
              comment=True, tone="danger", batch=True,
              confirm="The student stays enrolled in the subject and is told why."),
        _move("tag", "Tag the subject as Withdrawn",
              ["Approved - Awaiting Subject Tag", "Approved - Registrar Preparation"],
              "Subject Tagged - Registrar Preparation", {"staff"}, kinds=[KIND_WITHDRAWAL], batch=True,
              confirm="The selected subject shows Withdrawn in Official Offered Subjects. Any grade mark is applied by the Registrar."),
        _move("export", "Prepare the Excel export", ["Subject Tagged - Registrar Preparation"], "Exported - Ready to Send",
              {"staff"}, kinds=[KIND_WITHDRAWAL], tone="secondary", opens="export",
              confirm="Downloading the Excel list moves the tagged withdrawals to Exported."),
    ],
}


def actor_key(account_role: str) -> str:
    """The role a move is checked against. An administrator only reads these two boards."""
    return account_role


def transitions_from(slug: str, status: str, kind: str, role: str) -> list[dict]:
    role = actor_key(role)
    return [
        item for item in TRANSITIONS.get(slug, [])
        if status in item["from"] and kind in item["kinds"] and role in item["roles"]
    ]


def find_transition(slug: str, status: str, action: str, kind: str, role: str) -> dict | None:
    for item in transitions_from(slug, status, kind, role):
        if item["action"] == action:
            return item
    return None


def any_transition_named(slug: str, action: str, kind: str) -> dict | None:
    for item in TRANSITIONS.get(slug, []):
        if item["action"] == action and kind in item["kinds"]:
            return item
    return None


def refusal_reason(slug: str, status: str, action: str, kind: str, role: str) -> str:
    """A plain sentence for a move that is not allowed, in the same words for every process."""
    info = status_by_key(slug).get(status, {})
    label = info.get("label", status)
    named = any_transition_named(slug, action, kind)
    if not named:
        return "That step does not exist for this request."
    if role not in named["roles"]:
        who = " or ".join(sorted({{"staff": STAFF, "academic_coordinator": ACADEMIC_COORDINATOR, "dean": DEAN}.get(r, r)
                                  for r in named["roles"]}))
        return f"'{named['label']}' can only be done by {who}."
    allowed = transitions_from(slug, status, kind, role)
    if allowed:
        options = ", ".join(item["label"] for item in allowed)
        return f"From '{label}' you can: {options}. '{named['label']}' is not one of them."
    owner = info.get("owner")
    if info.get("phase") == "done":
        return f"This request is finished ('{label}'), so it cannot be moved."
    if owner and owner != {"staff": STAFF, "academic_coordinator": ACADEMIC_COORDINATOR, "dean": DEAN}.get(role):
        return f"This request is waiting for {owner}. You cannot move it from '{label}'."
    return f"'{named['label']}' is not possible from '{label}'."


def vocabulary_payload(slug: str) -> dict:
    """What the screens need: statuses, board columns and every allowed move."""
    return {
        "statuses": status_info(slug),
        "open_statuses": list(OPEN_STATUSES.get(slug, ())),
        "columns": {slug: BOARD_COLUMNS[slug]},
        "kinds": [{"key": key, "label": KIND_LABELS[key], "slug": slug} for key in KINDS_FOR_SLUG[slug]],
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
                "confirm": item["confirm"],
                "opens": item["opens"],
            }
            for item in TRANSITIONS[slug]
        ],
    }


# ---------------------------------------------------------------------------
# Timelines shown in the case window and on the student's page
# ---------------------------------------------------------------------------
_WITHDRAWAL_STEPS = [
    ("Request submitted", ["Submitted to GS Staff", "Returned for Clarification", "Returned"]),
    ("Staff forwards it", []),
    ("Dean decision", ["Dean Review"]),
    ("Subject tagged Withdrawn", ["Approved - Awaiting Subject Tag", "Approved - Registrar Preparation"]),
    ("Excel list exported", ["Subject Tagged - Registrar Preparation"]),
    ("Emailed to the Registrar", ["Exported - Ready to Send", "Sent to Registrar", "Withdrawn Confirmed"]),
]
_AWOL_STEPS = [
    ("AWOL flagged", ["AWOL Declared"]),
    ("Return filed", ["Return Submitted", "Returned for Revision"]),
    ("Dean decision", ["Dean Review"]),
    ("Back in the program", ["Return Approved", "Extension Approved - Refresher Required", "Re-enrollment Required",
                             "Re-enrollment Completed"]),
]
_RESIDENCY_STEPS = [
    ("Residency recorded", ["Residency"]),
    ("Residency closed", ["Residency Completed"]),
]


def timeline_steps(slug: str, kind: str, status: str, reached=()) -> list[dict]:
    """Steps with a state each: complete, current, upcoming, returned, denied or stopped."""
    if kind == KIND_RESIDENCY:
        steps = _RESIDENCY_STEPS
    elif slug == SLUG_AWOL:
        steps = _AWOL_STEPS
    else:
        steps = _WITHDRAWAL_STEPS
    reached = set(reached) | {status}

    def index_of(names) -> int | None:
        for index, (_label, statuses) in enumerate(steps):
            if any(name in statuses for name in names):
                return index
        return None

    def labelled(stop_index: int, stop_state: str) -> list[dict]:
        return [
            {"label": label, "state": "complete" if index < stop_index else stop_state if index == stop_index else "upcoming"}
            for index, (label, _s) in enumerate(steps)
        ]

    if slug == SLUG_AWOL and kind == KIND_AWOL:
        if status == "Returned for Revision":
            return labelled(1, "returned")
        if status == "Return Denied":
            return labelled(2, "denied")
        if status in {"Return Approved", "Extension Approved - Refresher Required", "Re-enrollment Completed"}:
            return [{"label": label, "state": "complete"} for label, _s in steps]
        if status == "Re-enrollment Required":
            return [
                {"label": label, "state": "complete" if index < len(steps) - 1 else "current"}
                for index, (label, _s) in enumerate(steps)
            ]
    if slug == SLUG_WITHDRAWAL:
        if status in {"Returned for Clarification", "Returned"}:
            return labelled(0, "returned")
        if status == "Denied":
            return labelled(2, "denied")
        if status == "Cancelled":
            return labelled(0, "stopped")
        if status in {"Exported - Ready to Send", "Sent to Registrar", "Withdrawn Confirmed"}:
            return [{"label": label, "state": "complete"} for label, _s in steps]
        if status == "Submitted to GS Staff":
            return [{"label": label, "state": "current" if index == 0 else "upcoming"} for index, (label, _s) in enumerate(steps)]
    if kind == KIND_RESIDENCY and status == "Residency Completed":
        return [{"label": label, "state": "complete"} for label, _s in steps]
    current = index_of([status])
    if current is None:
        current = 0
    return [
        {"label": label, "state": "complete" if index < current else "current" if index == current else "upcoming"}
        for index, (label, _s) in enumerate(steps)
    ]
