---
phase: "5"
slug: design-system
status: approved (agent, AD1-AD2, owner may veto)
shadcn_initialized: false
preset: none
created: "2026-10-17"
---

# Phase 5 - UI Design Contract (Design system)

> Decisions: IM6 (one system on the EXISTING tokens, not a redesign), IM15 (every page works at 1366 / 1920 / 390 px), IM13 (X-01..X-05 built here). Sources: `.planning/codebase/CONCERNS.md` s2-3, `CLEANUP-CANDIDATES.md` table B rows 1-9 and 20, `research/REFERENCE-PORTALS.md` s3, the code in `frontend/src`, and the current screenshots in `frontend/e2e-artifacts/screens/<role>/*-{1366,1920,390}.png`. Where the app had several choices, the most common one is the standard. Line numbers are from 2026-10-17: re-grep before editing.

## Design System

| Property | Value |
|----------|-------|
| Tool | none (no shadcn; hand-built Tailwind layer. Registry safety gate: not applicable) |
| Preset | not applicable |
| Component library | local, to live in `frontend/src/components/ui/` (index re-exports) |
| Styling | Tailwind 3.4.19, `@layer components` classes in `index.css` |
| Icon library | lucide-react 0.453.0, `h-4 w-4` inline, `h-5 w-5` in tiles, `h-6 w-6` in PageHeader tile, stroke default |
| Fonts | body Open Sans (`font-sans`), headings Poppins (`font-display`, already applied to h1-h4 in `@layer base`) |
| Frontend test tool | Playwright only (`npm run e2e`); no component test runner. Component proof = a UI gallery route (below) plus `check-ui.mjs` |

## Component Inventory

Enumerated by `grep -h "^export " frontend/src/components/ui.jsx frontend/src/components/forms.jsx frontend/src/components/confirm.jsx` - 18 components (StatusBadge, Card, SectionTitle, Spinner, EmptyState, ErrorNote, ProgressBar, Pill, PageHeader, StatCard, InlineNotice, Field, Input, Textarea, Select, RadioRow, ConfirmProvider, useConfirm) - tailwindcss@3.4.19 / lucide-react@0.453.0 / local files - 2026-10-17.

Non-exhaustive: the table in "Components" below is the target set. Adoption today: StatusBadge 269 refs, Card 187, Field 154, EmptyState 89, ErrorNote 73, SectionTitle 65, Input 58, Spinner 42, Select 39, Textarea 33, StatCard 20. Missing entirely: Table, Modal, SearchInput, Pagination, Stepper, DecisionPanel, HistoryPanel, Button component.

File layout (new): `components/ui/{Button,Card,Field,StatusChip,Modal,DataTable,Feedback,PageHeader,StatCard,Stepper,DecisionPanel,HistoryPanel}.jsx` + `index.js`; `lib/status.js`; `lib/tone.js`. `components/ui.jsx` and `components/forms.jsx` become one-line `export *` shims during migration and are deleted in the last packet (a file `ui.jsx` next to a folder `ui/` resolves to the file first).

## 1. Type scale (6 steps)

Weights: `font-normal` (400), `font-medium` (500, rare), `font-semibold` (600). `font-bold` is retired (322 uses) - it is the same role as semibold. Line height: Tailwind defaults for each step; headings add `leading-tight`. Add to `tailwind.config.js`: `fontSize: { "2xs": ["0.6875rem", { lineHeight: "1rem" }] }` (11px).

| Step | Tailwind (also as class in `index.css`) | px | Use |
|------|------------------------------------------|----|-----|
| page-title | `.page-title` = `font-display text-2xl font-semibold text-ink` | 24 | one `<h1>` per page, via PageHeader only; stat figures |
| section-title | `.section-title` = `font-display text-lg font-semibold leading-tight text-ink` | 18 | `<h2>`: SectionCard title, modal title, board column title |
| card-title | `.card-title` = `font-display text-base font-semibold text-ink` | 16 | `<h3>`, list-item name, brand wordmark |
| body | `text-sm text-slate-700` (secondary copy `text-slate-600`) | 14 | all running text, inputs, buttons, table cells |
| meta | `.meta` = `text-xs text-slate-500` | 12 | hints, timestamps, table headers, chips, sublines |
| micro | `.micro` = `text-2xs text-slate-500` | 11 | count bubbles, tiny tags, size-sm chips only |
| (label) | `.eyebrow` = `text-xs font-semibold uppercase tracking-wide text-slate-500` | 12 | field-group labels, stat labels (was `font-bold ... text-slate-400`) |

Rules: muted text is `text-slate-500` or darker; `text-slate-400` is for placeholders, disabled and decoration only (it is 2.6:1 on white and today carries 100+ eyebrow labels). Inputs are `text-base sm:text-sm` (16px on phones: no iOS zoom).

Mapping of every off-scale size in the code today:

| Today | Count | Becomes |
|-------|-------|---------|
| `text-[9px]`, `text-[10px]`, `text-[11px]` | 2 / 31 / 146 | `text-2xs` (11px) |
| `text-[12px]` | 1 | `text-xs` |
| `text-[15px]` (brand title: `Layout.jsx:154`, `RoleSidebar.jsx:40`, `RoleAssistantPage.jsx:15`) | 2 | `text-base` (RoleAssistantPage is deleted by CLEANUP row A5) |
| `text-xl` (h2 / dialog titles, `MiniBox`) | 21 | `text-lg` (title) or `text-2xl` (figure) |
| `text-3xl` (StatCard figure `ui.jsx:~146`) | 4 | `text-2xl` |
| `text-4xl` (`Login.jsx` hero h1) | 1 | allowed exception `text-3xl` in `Login.jsx` only (allowlist in `check-ui.allow.json`) |
| `text-xs` used as body (897) | - | stays `text-xs` = meta; do not mass-rewrite, only touch while migrating a file |

## 2. Spacing, radius, shadow, layout

Tailwind's 4px scale; only these values are allowed per role (not machine-enforced except arbitrary widths staying out of type).

| Role | Standard | Evidence / replaces |
|------|----------|---------------------|
| Page padding (`Layout.jsx` main) | `px-4 py-6 lg:px-6 lg:py-7 2xl:px-8 2xl:py-8` (unchanged) | already in `Layout.jsx:267` |
| Page max width | `max-w-page` = `maxWidth.page: "90rem"` (1440px), centered `mx-auto` | replaces `max-w-[90rem]`, `max-w-6xl` on RoleAssistantPage/Login main |
| Between page sections | `.page-stack` = `flex flex-col gap-5` (or `space-y-5`) | `space-y-5` 94 uses, most common |
| Card padding | `Card pad`: `md` = `p-4 sm:p-5` (default), `sm` = `p-3`, `lg` = `p-5 sm:p-6`, `none` | p-4 145 / p-6 117 / p-3 105 / p-5 68 |
| Inside a card | `space-y-4`; list rows `space-y-2`; row inner padding `px-3 py-2.5` | |
| Form gaps | fields `grid gap-4` (`sm:grid-cols-2`), label-to-input `mb-1.5` (in `.field-label`), hint `mt-1` | |
| Inline groups | buttons `gap-2`, chips `gap-1.5`, icon+text `gap-2` | gap-2 435, gap-1.5 115 |
| Table cells | th `px-3 py-2.5`, td `px-3 py-3` (`dense`: `py-2`) | th px-3: 98 of 119 |
| Radius | container (card, modal, table wrapper) `rounded-2xl`; control (button, input, notice, nested panel, icon button) `rounded-xl`; nested list row `rounded-lg`; chip `rounded-full`; tag `rounded-md`. Ban plain `rounded`, `rounded-sm` | rounded-xl 419, lg 186, 2xl 63, plain 37 |
| Shadow | `shadow-card` (inside `.card`), `shadow-lift` (modal, popover, hover lift). Ban `shadow-sm/lg/xl/2xl` | |
| Z-index | `tailwind.config.js` `zIndex: { header: "30", drawer: "40", modal: "100", confirm: "110", toast: "120" }` | replaces z-40/50/[70]/[80]/[90]/[100]/[110] |
| Motion | `transition-colors duration-200`; `animate-fade-up` for dialogs; reduced-motion rule already in `index.css` | |

Behaviour at the three widths (IM15):

| Width | Shell | Content rules |
|-------|-------|---------------|
| 390 | sidebar hidden, topbar hamburger opens `Drawer side="left"`; content `px-4` | single column; stat cards `grid-cols-2`; PageHeader actions wrap under the title, `btn` min height 44px (`max-sm:min-h-11`); filters stack `grid-cols-1`; tables scroll inside their own wrapper (page never scrolls sideways); `hideBelow="sm"` drops low-value columns; modals `p-3`, footer buttons stack `max-sm:flex-col-reverse` full width; inputs 16px |
| 1366 | sidebar 16rem fixed (`lg+`), main width about 1060px | two-column detail layouts switch at `xl` (1280): `xl:grid-cols-[minmax(0,1fr)_22rem]`; stat cards `lg:grid-cols-4`; tables usually fit, else wrapper scrolls |
| 1920 | same sidebar; content capped at `max-w-page` and centered | never stretch past 1440px; no layout changes at `2xl` beyond `2xl:px-8` |

## 3. Color roles

Existing tokens stay: `brand-50..900` (USLS green; `brand-600` = primary action, `brand-700` hover/text-on-light), `canvas #f4f7f9` (page), `ink #0f172a` (text), `slate-*` neutrals, white surfaces with `border-slate-200/80`.

60 / 30 / 10: 60% `canvas` page + white cards; 30% white sidebar/topbar/cards, `slate-50` table heads and footers; 10% `brand-600` accent. Accent reserved for: primary button, active sidebar item, focus ring (`ring-brand-500`), selected tab/segment, progress fill, success chip/notice, brand avatar tile. Destructive (`red-600`) only for danger buttons, danger chips and error notices.

One semantic map (`lib/tone.js`), used by StatusChip, InlineNotice, StatCard tint, Stepper, row accents:

| Tone | Chip / tint classes | Notice (border + bg + text) | Dot / bar | Meaning |
|------|---------------------|-----------------------------|-----------|---------|
| success | `bg-brand-50 text-brand-700 ring-brand-200` | `border-brand-200 bg-brand-50 text-brand-800` | `bg-brand-500` | finished or positive outcome |
| warning | `bg-amber-50 text-amber-800 ring-amber-200` | `border-amber-200 bg-amber-50 text-amber-900` | `bg-amber-500` | a person must review, decide or act; at risk |
| danger | `bg-red-50 text-red-700 ring-red-200` | `border-red-200 bg-red-50 text-red-800` | `bg-red-500` | denied, failed, missing, overdue |
| info | `bg-blue-50 text-blue-700 ring-blue-200` | `border-blue-200 bg-blue-50 text-blue-800` | `bg-blue-500` | submitted, received, in progress, scheduled ahead |
| neutral | `bg-slate-100 text-slate-700 ring-slate-200` | `border-slate-200 bg-slate-50 text-slate-700` | `bg-slate-400` | closed, archived, not applicable, unknown |

`emerald` (188 uses), `green`, `rose`, `violet`, `sky`, `yellow`, `orange` are removed from status and notice use: emerald and green become success (brand), rose becomes danger, violet and sky become info or neutral. Chart hex values stay in `lib/format.js` `CHART_COLORS` (Recharts needs hex) but must equal brand/semantic values. Color is never the only signal: the chip always shows its words (dot optional).

### 3a. Status map -> `frontend/src/lib/status.js`

Rules: the client map wins; the server's `status_tone` (`good/warn/bad/info/muted`) is used only for a string that is not in the map; lookup is case-insensitive and trimmed (`active` = `Active`); an unknown string renders `neutral` and `console.warn("[status] unmapped:", value)` once in DEV. Built from `lib/format.js` STATUS_STYLES (last duplicate wins, as today), `leave_workflow.py` STATUS_INFO, `standalone_process.py` STATUS_INFO_BY_SLUG, and `app.py` constants (`ADVISER_STATUS_*`, `*_DEFENSE_STATUS`, `REVISION_*`, `RESEARCH_VOCABULARY.stage_statuses`, `MONITORING_MANUAL_STATUSES`, `LEAVE_REGISTRAR_STATUSES`, `POLICY_DOCUMENT_STATUSES`).

```js
const GROUPS = {
  success: ["On Track","Active","Confirmed","Scheduled","Appointed","Accepted","Answered","Entered","Ready",
    "Verified Complete","Dean Reviewed","Subject Tagged - Registrar Preparation","Implemented","Withdrawn Confirmed",
    "Cleared","Record Updated","Passed","Pass","Present","Eligible","Eligible to Return","Compliant","Open","Complete",
    "Completed","Verified","Verified by staff","Done","Generated","Synced","Published","Offered","Sent to Registrar",
    "Dean Approved","Active planning","Approved","Taken","Endorsed","Acknowledged","Return Approved",
    "Extension Approved - Refresher Required","Re-enrollment Completed","Revisions confirmed"],
  warning: ["At Risk of Delay","On Leave","Withdrawal In Progress","LOA","Needs Availability","Deferred","Defense Deferred",
    "Needs Re-confirmation","Revisions Pending","Under deliberation","Not entered","Revisions Required",
    "Pending Staff Action","Pending Review","MOA Under Review","Under Review","Dean Review","For Dean Review",
    "Ready for Dean Review","Pending Handoff","Needs Review","Needs Revision","Pending","INC","Incomplete",
    "Pending staff verification","Pending panel matching","Pending confirmed schedule","Pending Subject Tag",
    "Pending Excel Export","Sync pending","Needs generation","Needs verification","Requirements Pending",
    "Awaiting Implementation","Approved - Awaiting Subject Tag","Return Due","Re-enrollment Required",
    "Pending scheduling","Awaiting revisions","Revisions Submitted - Awaiting Confirmation",
    "Returned","Returned for Revision","Returned for Clarification","Returned to student"],
  danger: ["Delayed","AWOL","AWOL Declared","Denied","Return Denied","Declined","Not approved","Not Cleared","Not met","Fail",
    "Failed","Missing","Missing Requirements","Hours Incomplete","Additional Certificates Requested","Overdue",
    "Upload required","Not Enough Evidence",
    "Not Accepted - New Organization Required","Re-defense Required","Resubmission Required","Expired"],
  info: ["Submitted","Submitted to GS Staff","Staff Review","Return Submitted","Submitted for review","Documents Submitted",
    "Awaiting Review","For Review","MOA Submitted","MOA Received","Report Sent to Dean","Applied","Noted by AC","Uploaded",
    "Invited","Rescheduled","Enrolled","Current","Planned","Upcoming","Suggested","Practicum In Progress",
    "Waiting for student submission","Requirements Verified","Exported - Ready to Send","Approved - Follow-through",
    "Approved - Registrar Preparation","Sent - Awaiting Receipt","Leave Scheduled","Residency","Eligible to take",
    "Revisions submitted"],
  neutral: ["Not Yet Assessed","Withdrawn","Held","Ended","Closed","Archived","Not set","Waiting for student files",
    "Not taken","Not Taken","Not Started","Not Enrolled","Draft","Not Offered","No decision","Not Required","Not Eligible",
    "Not eligible","Not Ready","Cancelled","Residency Completed","Dropped"],
};
export const STATUS_TONE = Object.fromEntries(Object.entries(GROUPS).flatMap(([t, l]) => l.map((s) => [s.toLowerCase(), t])));
export const SERVER_TONE = { good: "success", warn: "warning", bad: "danger", info: "info", muted: "neutral" };
export function statusTone(value, serverTone) { /* map -> serverTone -> "neutral" (+ DEV warn) */ }
```

Visible changes this causes (all intended, list them in the packet's screenshots): Leave-case chips follow the client map (`Returned to student` stays amber — AD2; `With the Dean` amber not blue; `Leave Scheduled` blue); `Completed` standing turns green (was blue); `Scheduled/Accepted/Answered/Entered/Active (policy docs)` lose the emerald shade and match brand green; `Draft` policy docs turn grey (was amber); `Approved` course plan turns green (was blue); info notices turn blue (were brand green, identical to success).

## 4. Components (props API)

All export from `components/ui/index.js`; all accept `className`; none uses arbitrary `text-[..]`. `Replaces` lists the local copies to delete.

| Component | Props | Variants / sizes | Replaces |
|-----------|-------|------------------|----------|
| `PageHeader` | `title, description, icon, actions, badge, back` | one layout; icon tile `hidden sm:grid h-11 w-11 rounded-2xl bg-brand-50`; h1 = `.page-title`; description `mt-1 max-w-3xl text-sm text-slate-500`; actions `flex flex-wrap gap-2` | 20 hand-written `<h1>`: `Dashboard, Students, StudentDetail, Faculty, Reports, WorkQueue, ActivityLog, Enrollment, EnrollmentClassList, CoursePlanning, CourseAdjustments, MonitoringGrid, TermSettings, PolicyDocuments, BusinessRules, Assistant, ChangePassword, Login, WorkflowPage, ProcessBoardPage`; `ui.jsx:101` extended, not replaced |
| `Card` | `pad="md\|sm\|lg\|none", as, interactive, className` | `.card` = `rounded-2xl border border-slate-200/80 bg-white shadow-card`; `interactive` adds `cursor-pointer transition-colors hover:border-brand-200` | `ui.jsx:22`; 79 inline `rounded-xl\|2xl border bg-white` strings |
| `SectionCard` | `title, subtitle, icon, action, pad, children` | header = SectionTitle (`.section-title`, icon tile `h-9 w-9 rounded-xl bg-brand-50`), body `space-y-4` | `SectionTitle`+`Card` pairs (65); `DeanShared` `SectionCard` is dead (CLEANUP A7) |
| `Button` | `variant="primary\|secondary\|danger\|icon", size="md\|sm", icon, loading, as, ...rest`; icon variant requires `aria-label` | classes stay: `.btn-primary` (`bg-brand-600 hover:bg-brand-700`), `.btn-ghost` = secondary (`bg-white border-slate-200 hover:bg-slate-50`, kept name, 218 uses), new `.btn-danger` (`bg-red-600 text-white hover:bg-red-700`), new `.btn-icon` (`h-11 w-11 sm:h-10 sm:w-10 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50`). `.btn` gets `min-h-10 max-sm:min-h-11`; `size="sm"` = `px-3 py-1.5 text-xs`; `loading` disables and shows a 16px spinner | `confirm.jsx:~85` red button; `WorkflowPage.jsx:~2629` red return button; 26 bespoke icon buttons (`grid h-8/9/10 w-8/9/10 ...`, e.g. `Layout.jsx:~228,~248`, `DeanParts.jsx:~141`, `ModalShell`); `CourseAdjustments.jsx:~513 ActionButton`; `leave/leaveUi.jsx:5 ActionButton` |
| `Field` | `label, hint, error, required, children` | wraps `<label class="block">`; `.field-label`; error `mt-1 text-xs font-medium text-red-700` with `role="alert"`; provides FieldContext so Input/Select/Textarea get `aria-describedby` and `aria-invalid` | local `Field`: `CourseAdjustments.jsx:~541`, `dean/DeanLeaveParts.jsx:32`, `Enrollment.jsx:~995`; `Reports.jsx:~252 Select`, `Students.jsx:~348 Select`; `CheckList` (`forms.jsx:38`, dead) |
| `Input / Select / Textarea` | native props; `Select` keeps `options, placeholder` | `.field-input` = `w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base sm:text-sm ...`; invalid adds `border-red-400 ring-red-100` | `forms.jsx` copies; 12 hand-built search inputs -> `SearchInput` |
| `SearchInput` | `value, onChange, placeholder, label` | `Search` icon left, clear button; `type="search"`, sr-only label | `Students, Faculty, WorkQueue, ActivityLog, PolicyDocuments, BusinessRules, StudentPicker, SubjectNeedsReport, leave/LeaveFilters, dean/DeanParts, WorkflowPage`, `WorkQueue.jsx:364 FilterChip` |
| `StatusChip` | `status, tone, label, dot=true, size="md\|sm"` | tone classes from section 3; md `px-2.5 py-0.5 text-xs font-semibold`, sm `px-2 py-0.5 text-2xs`; `rounded-full ring-1 ring-inset`; non-clickable; empty value renders `-` | `ui.jsx:4 StatusBadge` (kept as alias until the last packet, 269 refs); `leaveStatus.jsx:14 LeaveStatusBadge`; `CourseAdjustments.jsx:~499 OfferingStatusBadge`; `PolicyDocuments.jsx:51 StatusPill`; `dean/DeanLeaveParts.jsx:21 PolicyCheckBadge`; `dean/DeanShared.jsx:54 AgeBadge`; `faculty/FacultyAdviserPanel.jsx:119 contractBadge`; `Faculty.jsx:~694 AvailabilityBadge`; `MonitoringGrid.jsx:~579 CompreExamBadge`; `ProcessGates.jsx:22 Pill`, `EnrollmentClassList.jsx:~272 SummaryPill`; `format.js statusClass` + `STATUS_STYLES` |
| `Modal` | `title, subtitle, icon, badge, size="sm\|md\|lg\|xl", onClose, footer, dismissible=true, closeLabel, children`; `Drawer`: `side="left\|right", label, onClose, width` | sizes: sm `max-w-md` (confirm, reasons), md `max-w-xl` (forms), lg `max-w-3xl` (case detail), xl `max-w-6xl` (previews, wide tables); backdrop `fixed inset-0 z-modal bg-ink/50 backdrop-blur-sm p-3 sm:p-6`; panel `flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift animate-fade-up`; header `shrink-0 border-b px-4 py-4 sm:px-6`; body `min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6`; footer `shrink-0 flex flex-wrap justify-end gap-2 border-t bg-slate-50 px-4 py-3 sm:px-6 max-sm:flex-col-reverse`; behaviour: `role="dialog" aria-modal`, `aria-labelledby/describedby` via `useId`, focus first control, Tab trap, Esc and backdrop close (unless `dismissible={false}` while saving), restore focus, body scroll lock with stack counter, nested modal one level up (`z-confirm`) | triple shells `dean/DeanParts.jsx:~95 DeanDialog`, `WorkflowPage.jsx:~2419`, `leave/ModalShell.jsx`; `Enrollment.jsx:~694,~871`; `confirm.jsx:52` (ConfirmProvider re-built on `Modal size="sm"`, Enter no longer confirms a destructive dialog); `Dashboard.jsx:~401`; `Faculty.jsx:~229,~275`; `BusinessRules.jsx:~220`; `PolicyDocuments.jsx:~345`; `MonitoringGrid.jsx:~496`; `faculty/FacultyCalendar.jsx:~133`; `ExportFollowUpModal.jsx:58`; `FacultyAssignmentProfile.jsx:40`; `monitoring/AddStudentDialog.jsx:62`, `ReasonDialog.jsx:38`, `StudentRecordPanel.jsx:68` (-> `Drawer side="right"`); `Layout.jsx:220` (-> `Drawer side="left"`) |
| `DataTable` | `columns[{key, header, cell(row), align, sortable, sortValue, hideBelow, className, width}], rows, rowKey, onRowClick, rowHref, empty{icon,title,hint}, caption, minWidth="sm\|md\|lg", dense, stickyHeader, stickyFirst, loading, toolbar, searchable, pageSize, pagination{page,pageCount,total,onPage}, csv{filename,columns}, sort/onSort` | wrapper `relative overflow-x-auto rounded-xl border border-slate-200 bg-white` (stickyHeader: add `max-h-[70dvh] overflow-y-auto`); `<table class="w-full text-sm">` with `min-w-[640px] / [760px] / [960px]` for sm/md/lg; thead `bg-slate-50`, th `.eyebrow px-3 py-2.5 text-left scope="col"` and `aria-sort` when sortable (button inside th); tr `border-t border-slate-100 hover:bg-slate-50`; clickable rows are keyboard reachable (`tabIndex=0`, Enter) and the first cell holds a real link; sr-only `<caption>`; footer "Showing a-b of n" + Previous/Next (`Pagination`, 25 default for server lists, 10 for local); `csv` button uses `lib/format.js` `csvCell`+`downloadBlob` | 39 raw `<table>` in 27 files (12 class sets, 6 thead styles, 6 th paddings); `dean/DeanShared.jsx:66 CaseTable`; `SubjectNeedsReport.jsx:302`, `EnrollmentClassList.jsx:~320`, `Reports.jsx:~712` csvCell copies; 9 blob-download copies (CONCERNS 2.5) |
| `EmptyState` | `icon, title, hint, action, size="md\|sm"` | as `ui.jsx:46`; `sm` = `py-6` inside tables | kept; replaces ad-hoc "No ... yet" paragraphs |
| `Spinner / Skeleton` | `Spinner{label, size}`; `Skeleton{lines, className}`; `SkeletonTable{rows}` | skeleton `animate-pulse rounded-lg bg-slate-100`; reserve final height to avoid layout jump | kept `Spinner` (42 uses); new skeleton for tables and cards |
| `InlineNotice` | `tone="info\|success\|warning\|danger", title, onDismiss, icon, children` | notice classes from section 3; `rounded-xl border px-4 py-3 text-sm`; `role="alert"` for danger, `role="status"` otherwise; legacy `warn`/`error` accepted until the last packet; `ErrorNote` becomes `<InlineNotice tone="danger">` | `ui.jsx:161`; `ErrorNote` (73); `leave/leaveUi.jsx:20 Banner`; `ProcessGates.jsx:12 Banner`; `student/LeaveCaseCards.jsx:72 BANNER_STYLES`; `PolicyDocuments.jsx:~99 say()` tones |
| `Stepper` (X-02) | `steps[{label, state, hint, optional}], orientation="auto\|horizontal\|vertical", compact, title`; helper `stageSteps(stage, stages)` for the student lifecycle | state in `complete / current / upcoming / returned / denied / stopped`; dot `grid h-6 w-6 rounded-full border-2 text-2xs font-semibold`, label `text-sm`; `auto` = vertical below `sm`, wrapping row above; `<ol>`, `aria-current="step"`, sr-only state word; lifecycle: the first 8 of `meta.stages` (Admission ... Final Defense) as steps, off-track stages (LOA, AWOL, Withdrawal In Progress, Withdrawn, Completed) shown as a `stopped` chip beside the title - no new data | `leaveStatus.jsx:44 LeaveTimeline` + `STEP_STYLES`; `WorkflowTimeline.jsx:73` (keeps its step builders, renders `Stepper` inside `HistoryDisclosure`); `CourseAdjustments.jsx:20 STEPS`; `dean/DeanParts.jsx` stage check list; `student/shared.jsx:166` stage labels; `processConfig.jsx:31` stages. New on `Dashboard` (student role view `student/StudentOverview.jsx`) and `StudentDetail.jsx` |
| `DecisionPanel` (X-04) | `title, subject, actions[{key, label, tone="approve\|return\|reject", hint, requireComment, disabled}], onDecide(key, comment), busy, error, commentLabel, variant="card\|plain"` | one comment textarea (`Textarea`, 3 rows, `maxLength` 2000); approve = `.btn-primary`, return = `.btn-ghost`, reject = `.btn-danger`; comment required for return and reject (trimmed, inline `Field error`), optional for approve; buttons `flex flex-wrap gap-2`, full width below `sm`; `busy` disables all; success/error shown with `InlineNotice`; destructive actions ask `useConfirm` first. Only the actions the caller passes are shown - no new actions or permissions | `dean/DeanParts.jsx:~199 decision dialog` (approve/deny/return) and `:~251` select; `leave/ActionDialog.jsx:30` (comment + confirm); `WorkflowPage.jsx:~2629` return-to-student footer; `Form1Endorsements.jsx`, `AdviserAppointments.jsx` approve/return buttons (grep `Return for revision`, `Deny`, `Approve`) |
| `HistoryPanel` (X-05) | `entries[{id, title, at, actor, actorRole, from, to, note}], title, label, count, defaultOpen, emptyText, limit` | wraps `HistoryDisclosure` (`label` default "View history"); entry = the `CaseHistory` markup: `rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5` with title `text-sm font-semibold`, `<time>` `text-xs text-slate-500` via `formatDateTime`, actor line `text-xs text-slate-500`, note `whitespace-pre-wrap text-xs text-slate-600`; status change shown as two `StatusChip size="sm"`; empty -> "Nothing has happened on this record yet." | `student/LeaveCaseCards.jsx:130 HistoryList`; `leave/CaseSections.jsx:265 CaseHistory`; `Enrollment.jsx:~1190 HistoryPanel`; `monitoring/StudentRecordPanel.jsx:624 HistoryTab`; `leave/RegistrarPanel.jsx:22 ExportHistory`; `WorkflowDiscussion.jsx` log lists |
| `StatCard` | `icon, label, value, sub, tone, to, badge, size="md\|sm"` | md = today's `ui.jsx:134` (`.eyebrow` label, `.page-title` figure); sm = MiniStat (`rounded-xl p-3`, figure in `.card-title` size); tone = the 5 semantic tones (legacy `brand/amber/red/blue/slate` accepted); `to` makes the whole tile a link | `Dashboard.jsx:35 Kpi`, `:~431 MiniStat`; `Reports.jsx:~686 MiniStat`; `WorkQueue.jsx:~350 StatCard`; `CourseAdjustments.jsx:~524 Metric`; `WorkflowPage.jsx:~4924 MiniBox`; `HandoffResult.jsx:139 Stat` |

Also kept as is: `ProgressBar`, `RadioRow`, `Pill` (tag, `rounded-md text-2xs font-semibold`), `HistoryDisclosure`. `formatDate/formatDateTime/formatTime/csvCell/downloadBlob` live only in `lib/format.js` (CLEANUP row B5); `DataTable`, `HistoryPanel`, `StatusChip` import them.

Component proof: a gallery page `pages/UiGallery.jsx` at `/__ui` (route registered only when `import.meta.env.VITE_UI_GALLERY === "1"`; `scripts/e2e.mjs` sets it) shows every component, variant and size, plus a long-text and an empty case. `e2e/ui-gallery.spec.js` opens it at 1366/1920/390, fails on console errors or horizontal overflow, and saves screenshots. This is the "test first" for each component packet.

## 5. Accessibility rules

| Rule | Standard |
|------|----------|
| Focus | the global `:focus-visible` ring in `index.css` stays; no `outline-none` without a replacement ring; modal/drawer focus moves in, is trapped, returns on close |
| Names | every input has a visible `Field` label (or `aria-label` for search); icon-only buttons need `aria-label` (Button `icon` variant enforces it in DEV); tables have an sr-only caption and `scope="col"` on every th |
| Modals | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` to the title, `aria-describedby` when a subtitle exists, Esc closes, no Enter-to-confirm on destructive dialogs |
| Live regions | danger notices `role="alert"`, others `role="status"`; busy buttons set `aria-busy` |
| Contrast | body text >= 4.5:1: `slate-500` (4.8:1) is the lightest allowed text on white; chips use the 700/800 text shades above; `slate-400` never carries information |
| Color only | status always has words; stepper state has an sr-only word; required fields have `*` plus `aria-required` |
| Touch | targets >= 40px on `sm+`, >= 44px below `sm`; `cursor-pointer` on every clickable non-link element |
| Motion | keep the existing `prefers-reduced-motion` rule; no layout-shifting hover (no `scale`) |
| Sizing | no horizontal page scroll at 390; inputs 16px on phones |

## 6. Copywriting contract

| Element | Copy |
|---------|------|
| Primary CTA | verb + object, sentence case, as today ("Save changes", "Send to Dean", "Export Excel list") - no change to existing labels in this phase |
| Empty (table) | heading "No <things> to show" ; body "Try a different search or filter." when filtered, else "<Who> will see items here once <event>." |
| Error | "<What failed>. <What to do>." e.g. "Could not load students. Check your connection and try again." (InlineNotice danger + retry button where a refetch exists) |
| Decision panel | labels as the existing actions ("Approve", "Return for revision", "Deny request"); comment label "Comment for the student" (return/reject), "Note (optional)" (approve); validation "Add a comment so the student knows what to fix." |
| Destructive confirm | `<Action name>?` + one sentence of consequence + `Cancel` / `<Action name>` (danger button), via `useConfirm({ tone: "danger" })` |

## 7. UI Considerations (state coverage)

Applicable state considerations resolved: 8 covered, 1 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | DataTable, HistoryPanel, EmptyState | covered | zero rows render `EmptyState` inside the wrapper; history shows its empty sentence |
| loading | DataTable, SectionCard data | covered | `Spinner` for pages, `SkeletonTable` for tables with reserved height |
| error | pages using `useApi` | covered | `InlineNotice tone="danger"` above content with the server message |
| long-text | StatusChip, table cells, Modal title | covered | chip `whitespace-nowrap`, cells `min-w-0 break-words`, titles `truncate` with `title` attr in tables |
| overflow | tables at 390, modal body | covered | wrapper `overflow-x-auto`; modal body scrolls inside `max-h-[90dvh]`, header/footer stay |
| zero-one-many | counts in headers and StatCard | covered | plural helper (`pluralize`) used by PageHeader description callers |
| partial | DecisionPanel validation | covered | disabled until comment rule met; inline error |
| stacked overlays | confirm over modal | covered | `z-confirm` above `z-modal`; body lock counter |
| visual regression | all migrated pages | backstop | `npm run e2e` walkthrough screenshots at 1366/1920/390 compared by eye per packet |

## 8. Migration plan

Rules: one packet = at most about 300 changed lines and 5 modified files (new files and pure cut-and-paste moves are exempt); a packet converts every concern for its files at once (h1 -> PageHeader, tables -> DataTable, modals -> Modal, status helpers -> StatusChip, type sizes, local copies) so no two packets touch the same file; each packet ends with `npm run check:ui` (counts must drop, never rise), `npm run e2e`, and screenshots at 1366/1920/390. At most 3 packets run at once (IM10); any three streams below can run side by side, each stream is sequential inside. Big files (WorkflowPage, Enrollment) are split by concern across several sequential packets.

| Packet | Stream | Files | Converts | After |
|--------|--------|-------|----------|-------|
| **P1 Foundation** (first; sub-packets) | - | see below | tokens + components + check | - |
| P1a | serial | `tailwind.config.js`, `index.css`, `scripts/check-ui.mjs`, `scripts/check-ui.baseline.json`, `package.json` (+ `check-ui.allow.json`, `check-ui.test.mjs`, empty `ui/` stubs + `index.js`, `lib/tone.js`) | type step `2xs`, `maxWidth.page`, `zIndex`, `.page-title/.section-title/.card-title/.meta/.micro/.eyebrow/.btn-danger/.btn-icon/.page-stack`, field-input 16px on phones; check script with committed baseline; gallery route + `e2e/ui-gallery.spec.js` (red) | - |
| P1b | parallel | `lib/status.js`, `ui/StatusChip.jsx`, `ui/Button.jsx`, `ui/Card.jsx`, `ui/Field.jsx` | status map, chip, buttons, card, fields; `ui.jsx`/`forms.jsx` become shims | P1a |
| P1c | parallel | `ui/Modal.jsx`, `components/confirm.jsx` | Modal, Drawer, ConfirmProvider on Modal | P1a |
| P1d | parallel | `ui/DataTable.jsx`, `ui/Feedback.jsx` (EmptyState, Spinner, Skeleton, InlineNotice, SearchInput, Pagination) | table, notices | P1a |
| P1e | parallel | `ui/PageHeader.jsx`, `ui/StatCard.jsx`, `ui/Stepper.jsx`, `lib/stages.js` | header, stat, stepper | P1a |
| P1f | parallel | `ui/DecisionPanel.jsx`, `ui/HistoryPanel.jsx`, `components/HistoryDisclosure.jsx` | X-04, X-05 | P1b, P1c |
| P2 | A components | P2.1 `Layout.jsx`, `RoleSidebar.jsx`, `ExportFollowUpModal.jsx`, `FacultyAssignmentProfile.jsx`, `NotificationBell.jsx` | shell, drawer, brand title | P1 |
| | | P2.2 `monitoring/{AddStudentDialog,ReasonDialog,StudentRecordPanel,ProvenanceBadge}.jsx`, `calendar/CalendarView.jsx` | dialogs -> Modal/Drawer, 13 arbitrary sizes | P2.1 |
| | | P2.3 `ProcessGates.jsx`, `ProcessBoardPage.jsx`, `StageBoard.jsx`, `leaveStatus.jsx`, `WorkflowTimeline.jsx` | Banner, Pill, LeaveTimeline -> Stepper, chip | P2.2 |
| | | P2.4 `SubjectNeedsReport.jsx`, `HandoffResult.jsx`, `PolicyRules.jsx`, `AssistantSources.jsx`, `WorkflowDiscussion.jsx`; `scheduling/*`, `calendar/CalendarPage.jsx` (second packet if over limit) | table, stat, history | P2.3 |
| P3 | B dean | P3.1 `dean/DeanParts.jsx`, `DeanShared.jsx`, `deanHelpers.js` | DeanDialog -> Modal, CaseTable -> DataTable, AgeBadge, **DecisionPanel** | P1 |
| | | P3.2 `dean/DeanPages.jsx`, `DeanLeaveParts.jsx`, `DeanContext.jsx` | local Field, PolicyCheckBadge, tables | P3.1 |
| | | P3.3 `dean/DeanReportPages.jsx`, `DeanGraduationPage.jsx` | tables, history entries, **Stepper** for graduation stage check | P3.2 |
| P4 | C student | P4.1 `student/shared.jsx`, `Panels.jsx`, `ProcessCaseCard.jsx`, `LeaveCaseCards.jsx`, `requestMeta.jsx` | `Fact`, banners, **HistoryPanel**, **Stepper** | P1 |
| | | P4.2 `student/RequestForms.jsx`, `ResearchForms.jsx`, `CompletionForms.jsx` | fields, notices, chips | P4.1 |
| | | P4.3 `StudentOverview.jsx`, `StudentProgress.jsx`, `MyCourses.jsx`, `StudentAdviserPage.jsx` | **stage Stepper (X-02)**, StatCard, DataTable | P4.2 |
| | | P4.4 `StudentRequestPages.jsx`, `StudentInbox.jsx`, `StudentCalendarPage.jsx`, `StudentSupportPages.jsx`, `StudentAssistant.jsx`, `StudentRoutes.jsx` | headers, sizes | P4.3 |
| P5 | D faculty + leave + process | P5.1 `faculty/{FacultyPages,FacultyClasses,FacultyAdviserPanel,FacultyInvitationsPage}.jsx` | chips, tables, headers | P1 |
| | | P5.2 `faculty/{FacultyCalendar,FacultyAvailabilityEditor,FacultyContext,FacultyRoutes}.jsx` | modal, sizes | P5.1 |
| | | P5.3 `leave/{ModalShell,ActionDialog,BatchBar,leaveUi,CaseCard}.jsx` | ModalShell -> Modal (then deleted), ActionDialog -> **DecisionPanel**, Banner | P5.2 |
| | | P5.4 `leave/{CaseSections,CaseDetailModal,CaseConversation,RegistrarPanel,FollowUpStrip,LeaveFilters}.jsx` | **HistoryPanel**, SearchInput, chips | P5.3 |
| | | P5.5 `process/{AwolRegistrar,ResidencyDialog,WithdrawalExport}.jsx` | modal, tables | P5.4 |
| P6 | E top-level pages | P6.1 `Students.jsx`, `Dashboard.jsx`, `WorkQueue.jsx` | PageHeader, DataTable (server pagination), local Select/StatCard/Kpi/MiniStat, FilterChip | P1 |
| | | P6.2 `Reports.jsx`, `ActivityLog.jsx`, `BusinessRules.jsx` | tables, csv, modal | P6.1 |
| | | P6.3 `Faculty.jsx`, `AdviserAppointments.jsx`, `Form1Endorsements.jsx` | modals, **DecisionPanel**, chips | P6.2 |
| | | P6.4 `MonitoringGrid.jsx`, `EnrollmentClassList.jsx`, `AdviserRecordCard.jsx` | tables, modal, chips | P6.3 |
| | | P6.5 `CourseAdjustments.jsx`, `CourseOfferings.jsx`, `CoursePlanning.jsx`, `TermSettings.jsx`, `PolicyDocuments.jsx` | local Field/Metric/Badge, Stepper (STEPS), modal | P6.4 |
| | | P6.6 `StudentDetail.jsx`, `Assistant.jsx`, `ChangePassword.jsx`, `Login.jsx` | **stage Stepper + HistoryPanel (X-02/05)**, h1, Login exception | P6.5 |
| | | P6.7 `Enrollment.jsx` part 1 (modals `:~694`, `:~871`, local Field) | Modal, Field | P6.6 |
| | | P6.8 `Enrollment.jsx` part 2 (tables, HistoryPanel `:~1190`, sizes) | DataTable, HistoryPanel | P6.7 |
| P7 | F WorkflowPage | P7.1 move-only: create `pages/workflow/` and extract shared parts + routing (route `/workflow/:slug` unchanged) | none (cut and paste) | P1 |
| | | P7.2 move-only: Handoff import, Research gate, Panel matching -> own files | none | P7.1 |
| | | P7.3 move-only: Defense scheduling form (`:~1650`, 400 lines), Availability workspace (`:~2050`) | none | P7.2 |
| | | P7.4 move-only: Graduation roster (`:~4336`) + batch modal (`:~3412`), Practicum, Withdrawal, AWOL & Residency | none | P7.3 |
| | | P7.5-P7.9 restyle each new file, one packet per 1-2 files (39 arbitrary sizes, 181 `text-xs`, `:2463` shell -> Modal, tables -> DataTable, `MiniBox`, history -> HistoryPanel) | all concerns | P7.4 |
| **P8 Close-out** | serial | `ui.jsx`, `forms.jsx` (delete shims), `lib/format.js` (delete `statusClass`/`STATUS_STYLES`), `scripts/check-ui.baseline.json` (zeros), `package.json` | remove aliases (`StatusBadge`, `warn/error` tones), switch `npm run e2e` and the AGENTS.md gate to `check:ui --strict`, final 3-width screenshot review | all |

Order of value if time runs short (IM1: each stream leaves the app demo-ready): P1 -> A and B (Modal and DataTable have the largest line savings) -> E -> C -> D -> F. The ratchet means a half-finished phase still ends with lower counts and no regressions.

## 9. The phase's machine check: `frontend/scripts/check-ui.mjs`

Node script, no dependencies. Walks `frontend/src/**/*.{js,jsx}` except `frontend/src/components/ui/` and `frontend/src/lib/status.js`, and counts these metrics (baseline measured 2026-10-17 with grep; P1a commits the exact numbers):

| Metric | What is counted | Baseline | End state |
|--------|-----------------|----------|-----------|
| `arbitraryText` | matches of `/\btext-\[[0-9.]+(px\|rem\|em)\]/` | 182 | 0 |
| `offScaleText` | `/\btext-(xl\|3xl\|4xl\|5xl\|6xl)\b/` minus files in `check-ui.allow.json` (only `pages/Login.jsx` for `text-3xl`) | 26 | 0 |
| `rawTable` | `<table\b` | 39 | 0 |
| `rawModal` | a class string containing both `fixed` and `inset-0` | 19 | 0 (Drawer and Modal live in `components/ui/`) |
| `rawH1` | `<h1\b` | 20 | 0 |
| `localStatusStyle` | `ring-inset`, `statusClass`, and the names `TONE_CLASSES`, `STATUS_STYLES`, `STATUS_CLASSES`, `CHECK_TONES` | 36 | 0 |

Behaviour:

| Command | Result |
|---------|--------|
| `node scripts/check-ui.mjs` (`npm run check:ui`) | prints a table of count / baseline per metric; exit 1 if any count is above `check-ui.baseline.json`; exit 0 otherwise, with a note when a count is lower ("run with `--update` to lock it in") |
| `--update` | rewrites the baseline only if no metric rose |
| `--strict` (`npm run check:ui:strict`) | exit 1 unless every metric is 0 |
| `--by-file` | lists the top offenders per metric as `file:count`, used to plan packets |
| `--json` | machine output for the e2e report |

Test first: `scripts/check-ui.test.mjs` (`node --test`) runs the counters on fixture strings (a hit, a miss, an excluded `components/ui/` path, the allowlist) and asserts a rise fails the ratchet; today `npm run check:ui:strict` exits 1 with the baseline numbers (that is the phase's red test). `npm run e2e` runs `check:ui` first.

**Expected end state (end of Phase 5):** `check:ui --strict` passes with all six metrics at 0; baseline file contains zeros; `StatusBadge` alias, `ui.jsx`/`forms.jsx` shims and `statusClass` are gone; `grep -rn "fixed inset-0\|<table\|<h1" frontend/src` returns hits only under `components/ui/`; the walkthrough (`npm run e2e`) passes with no console error, failed request or horizontal overflow at 1366, 1920 and 390; the UI gallery spec is green; X-01 (`status.js`), X-02 (`Stepper` on student overview and `StudentDetail`), X-03 (`DataTable`), X-04 (`DecisionPanel`), X-05 (`HistoryPanel`) are in use; `IDEAS.md` X-01..X-05 marked built.

## Pre-populated from

| Source | Decisions used |
|--------|----------------|
| `.planning/DECISIONS.md` | IM6, IM13, IM15, IM10, IM1 |
| `.planning/ROADMAP.md` Phase 5 | goal, 4 success criteria, `components/ui/` location |
| `.planning/IDEAS.md` | X-01..X-05 definitions |
| `CONCERNS.md` s2-3, `CLEANUP-CANDIDATES.md` B1-B9, B20 | counts, file:line targets, packet scope |
| Code (`tailwind.config.js`, `index.css`, `ui.jsx`, `forms.jsx`, `confirm.jsx`, `Layout.jsx`, `lib/format.js`, `DeanParts`, `ModalShell`, `Enrollment`, `leaveStatus`) | token values, modal pattern, status strings, most-common choices |
| Screenshots `e2e-artifacts/screens/{academic-coordinator,dean}` | chip look, page header, filter bar, board layout |
