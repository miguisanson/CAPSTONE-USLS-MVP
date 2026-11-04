# Edit anything, with history — contract (owner request 2026-11-04)

Owner: "we need to be able to EDIT ANY request ... what if there is human error like a typo we make a lot of
mistakes, we need to be able to edit EVERY REQUEST or APPROVAL, but of course a history of change".

## One model, one endpoint, one UI piece

**Model `RecordEdit`** (new table; reseed after pull, IM4):
`id, entity (e.g. "workflow_message", "leave_case", "leave_case_event", "awol_case", "withdrawal_application",
"graduation_endorsement", "practicum_record", "research_case", "defense_verdict", ...), entity_id, field,
old_value, new_value, reason, actor_user_id, actor_role, actor_name, created_at`. Indexed on (entity, entity_id).
It sits beside the existing histories (MonitoringEdit for the sheet, LeaveCaseEvent for status moves); it records
**text and value corrections**, never status moves.

**Endpoint `PATCH /api/edits/<entity>/<id>`** `{field, value, reason}` → applies the change through one
whitelist `EDITABLE[entity][field] = {who: rule, until: rule, validate: fn}` and writes a RecordEdit row plus an
activity-log line. `GET /api/edits/<entity>/<id>` → the history (newest first). Anything not in the whitelist
→ 400. A value is validated exactly as on first entry (same helper), so an edit cannot sneak in a value the
form would refuse.

## Who may edit what, and until when (default rules)
- **Chat / workflow messages** (`WorkflowMessage.comment`, `LeaveCaseEvent.comment`): the author, any time.
  The thread shows "Edited" with the history.
- **A request the student filed** (reason text, intention, remarks, picked values such as semesters): the
  student while the request is still with the first reviewer and nobody has acted on it yet; after that,
  Graduate School staff, with a reason. Value fields keep the same validation as filing (e.g. a semester must
  be valid; known data stays system-derived and is never editable).
- **Staff / Coordinator / Dean notes and remarks** on their own step: the author, any time.
- **A decision itself** (approve / return / deny / verdict): the decider may correct it with a reason only
  while the case has not moved past the next step (the existing "correct verdict" pattern); otherwise the
  case is returned or reopened through its workflow so later steps never rest on a changed decision.
- **Official data** (AIMS identity, enrollment, grades) is never editable here (AGENTS.md Rule 4).
- A reason is required for every edit except an author fixing their own chat message within 15 minutes.

## UI
One shared piece: an "Edit" (pencil) button next to each editable text/value, opening a small dialog with the
current value, the new value (same control as the original field), and the reason; after save the value shows
an **Edited** chip that opens the change history (old → new, who, when, why). Same on every process (IM24).

## Tests
Unittest per entity: who may edit, until when, validation reused, history row written, a refused edit leaves
no row. Playwright: edit a chat message and a request field on one standalone process (LOA) and one research
process, see the Edited chip and the history.
