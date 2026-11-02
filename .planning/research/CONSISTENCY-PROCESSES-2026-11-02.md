# Cross-process consistency + motion audit (I-144, 2026-11-02)

Read-only Sonnet audit of code + existing e2e screenshots (no live run). Children of I-144 filed as I-146..I-158.

## Comparison (S same as majority, D different, M missing)
| Feature | LOA | Readm | AWOL | Withdr | Drop | CourseAdj | Practicum | Graduation | ResearchGate | DefSched |
|---|---|---|---|---|---|---|---|---|---|---|
| Student form + error summary | S | S | S | D | - | - | D | D | D (native required) | S |
| Review/confirm before send | M | M | M | M | M | M | M | M | M | M |
| Success note survives send | S | S | D (re-sendable) | D | - | S | D | D | S | S |
| Student can withdraw request | S | S | M | M | - | - | M | M | M | M |
| Board/drag/Move to/lock reason | S | S | S | S | M | M | S | S | M | M |
| Card + View details | S | S | S | S | - | - | D | D | - | - |
| Staff step dialog | S | S | S | S | D | M | D | D | D | - |
| Dean decision UI | S | S | S | S | - | S | D | D (2 UIs) | D | - |
| Feedback after action | D everywhere (3 mechanisms) |
| Loading | lone Spinner everywhere; skeleton only in DataTable |

## Motion set (CSS only; global prefers-reduced-motion rule already in index.css)
Dialog: backdrop fade 150 ms + panel opacity/scale .98->1 180 ms ease-out (`ui/Modal.jsx`). Drawer: slide from edge 200 ms.
Notice: 4 px drop + fade 150 ms (`InlineNotice`). Card moved: 1 s ring pulse + scrollIntoView nearest (`StageBoard`).
Drag: card scale-95 opacity-60, column highlight 150 ms. Pending drop: card ringed "Moving to X" while dialog open.
Busy spinner in Move to. `SkeletonBoard` for board pages. Press: `.btn` active:scale-[0.98] 100 ms.

## Packets (order A, B, E, C, D, F, G; non-overlapping files)
A motion tokens (`tailwind.config.js`, `index.css`, `ui/Modal.jsx`, `ui/Feedback.jsx` + SkeletonBoard).
B StageBoard (`StageBoard.jsx`: BoardNotice, card settle, pendingId, keyboard Move to).
E one StepDialog (`components/StepDialog.jsx`, `pages/workflow/shared.jsx`, `GraduationBatchModal.jsx`, `ProcessGates.jsx`).
C wire boards (`ProcessBoardPage.jsx`, `Practicum.jsx`, `GraduationRoster.jsx`, `WorkflowPage.jsx`).
D Dean Graduation (`DeanGraduationPage.jsx`, `DeanParts.jsx` private board out, `DeanPracticumBoard.jsx`).
F student side (`RequestForms.jsx`, `CompletionForms.jsx`, `student/shared.jsx`, `StudentRequestPages.jsx`, `ResearchForms.jsx`, `CourseAdjustments.jsx` confirm).
G sweep (`ui/Tabs.jsx` + 3 tab sites; "..." -> "…" ~35 sites; SubjectStatusDialog reuses ErrorSummary).
