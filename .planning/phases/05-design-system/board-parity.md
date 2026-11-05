# Board parity audit (IM24, I-049)

Owner rule IM24: boards of the same kind offer the same features; a difference is allowed only when policy or the
backend requires it, and then it is visible. Audited 2026-10-17 on branch `pkt/board-consistency`.

## The boards

| Board | Page | Board component (before) | Board component (now) |
|---|---|---|---|
| Leave of Absence, Readmission, AWOL & Residency, Withdrawal | `ProcessBoardPage` | `StageBoard` | `StageBoard` |
| Graduation | `WorkflowPage` / `GraduationRoster` | `StageBoard` | `StageBoard` |
| Practicum | `WorkflowPage` / `PracticumRoster` | `WorkflowBoard` (a private board: cards were `draggable` but nothing accepted a drop, no "Move to...") | `StageBoard` |

## Parity table (after this packet)

Legend: yes = offered; reason = a card that cannot move shows a lock and why; policy/backend = not built, see notes.

| Feature | LOA | Readmission | AWOL & Residency | Withdrawal | Practicum | Graduation |
|---|---|---|---|---|---|---|
| Board / Table toggle (same `ViewToggle`) | yes | yes | yes | yes | yes (was a private copy, different label; now the shared one) | no (backend/design: a table of batches is a new view, see N1) |
| Drag a card to a column | yes | yes | yes | yes | yes (new, was fake) | yes |
| "Move to..." menu | yes | yes | yes | yes | yes (new) | yes |
| Lock + reason on a card that cannot move (same words "Waiting for: <owner>") | yes (new) | yes (new) | yes (new) | yes (new) | yes (new) | yes (new) |
| Refused drop explains itself (column turns red with the reason) | yes | yes | yes | yes | yes | yes |
| Batch select + group step | yes (server marks steps `batch`) | yes | yes | no (server marks no Withdrawal step `batch`, see N5) | no (N2) | yes (its own batch dialog) |
| Search + program + status filters | yes (`LeaveFilters`) | yes | yes | yes | yes (`RosterFilters`: adds date range, sort, eligibility) | yes (`RosterFilters` plus completed-course cohort) |
| Two filter components | `LeaveFilters` | same | same | same | `RosterFilters` | `RosterFilters` (N3) |
| Count bubble per column | yes | yes | yes | yes | yes (now the same header as the process boards) | yes (own header with select-all) |
| Empty column text | "No <noun> here" | same | same | same | "No requests here" (now the same pattern) | per column, from policy text |
| Empty board state | `EmptyState` | same | same | same | `EmptyState` | n/a (columns always shown) |
| Card layout: name, student number + program, 1-3 detail lines, "Next:" owner, flags, View button | yes (`CaseCard`) | yes | yes | yes | domain card (site, hours, documents, messages, Next, View + Message) | domain card (student or batch) |
| History / timeline | case window: stage list + activity + messages | same | same | same | case window: timeline + activity + messages | case window: 9-step timeline + activity + files |
| Recent activity window + "How this works" guide | yes | yes | yes | yes | yes (page header buttons) | page header buttons |
| Export | Registrar list below the board | same | Registrar list | Excel export panel | no (no export step in the practicum policy) | Dean exports the approved batch (policy: only the Dean) |
| Rules panel ("Rules applied on this screen") | yes | yes | yes | yes | yes | yes |

## What was fixed (frontend only)

1. `StageBoard` has a `lockReason(item)` prop. A card that cannot be dragged shows a lock icon and the reason as plain
   text where the "Move to..." button would be; the drag cursor is not offered; a move attempt of a locked card is
   refused with the reason. All six boards pass a reason: process boards "Waiting for: <owner>" (or "Finished" / "No step
   is open right now"); Graduation "Waiting for: Student (signed application)", "Waiting for: <next owners>",
   "Only Graduate School Staff create a graduation batch.", "Use Export on the batch card."; Practicum "Waiting for:
   Student" (nothing filed), "Open the case to: <step>" (the step stays in the same column), "Waiting for: <owner>".
2. Practicum used a private board with a fake drag (cards looked draggable, nothing could be dropped). It now uses
   `StageBoard`: real drag and "Move to...". A move opens the same confirm window the case window's button opens (same
   `submit`, same payload; the server checks again). It is allowed only to the column the step really leads to.
3. Practicum's Board/Table toggle is the shared `ViewToggle` (same label, same `aria-pressed`), in the same toolbar row
   as the filters, and the column header is the shared one.

## What remains, and why

- N1. Graduation has no Table view. A table needs a decision on rows (student or batch) and the batch-selection model;
  not a cheap swap. Left visible: Graduation has no toggle.
- N2. Practicum has no group steps. The practicum steps are single-student (each needs its own comment and, for
  verification, hours check); no batch endpoint exists. Backend work.
- N3. `RosterFilters` (Practicum, Graduation) and `LeaveFilters` (process boards) are two components. They look the same
  and have the same search/program/status; Practicum and Graduation add dates, sort, eligibility or course cohort, which
  those rosters need. Merging them is a design-system packet, not a quick fix.
- N4. The process boards' card (`CaseCard`) and the Practicum/Graduation cards differ in fields because the data differs
  (hours, documents, batches). Same skeleton (name, id line, detail lines, "Next:", View). Left.
- N5. Withdrawal has no group step because the server marks none of its steps `batch` (the board only offers group steps the
  server lists). Not a UI gap; whether Withdrawal should offer one is a policy question for the owner.
- N6. The Practicum move path ("Move to..." opening the confirm window) is covered by the code, not by a live demo case:
  both seeded Practicum cards are "Waiting for: Student", so the e2e spec checks the lock for them and the process
  boards cover the drag path.

## Update 2026-10-22 (pkt/grad, v5.3)

Board / Table toggle (same `ViewToggle`): Graduation = **yes** (student table with a batch line under the stage; group steps via the selection bar). Replaces N1 and the "no" in the Graduation column. Graduation filters = `RosterFilters` with the completed-course select, in one toolbar. Column names are plain (no "1 ·" numbering), default width; cards use the LOA layout. Column widths and the "N more stages" cue are shared by every board (pkt/board, I-067).

Dean Practicum (pkt/conA, 2026-10-22): Board/Table toggle yes, drag and Move to... yes (only 'With the Dean' to Reviewed or Returned), lock reasons yes, rules panel and header buttons yes, shared filter row yes. The Dean decides in one confirm window; the case page keeps Mark reviewed. Dean Graduation and Dean Course Adjustments still lack the header buttons and rules panel (I-123 follow-up).

All six boards (pkt/conC, 2026-10-22): Recent activity window + How this works guide = header buttons on every `/workflow/*` page (no side rail). Summary line, column description line and a card with only 'View details' on all six boards; step actions in the case or batch window.
