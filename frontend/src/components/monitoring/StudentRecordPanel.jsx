import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  X, Pencil, Trash2, Plus, History, ListChecks, UserRound, Undo2, ListPlus, ExternalLink, AlertTriangle,
} from "lucide-react";
import { api } from "../../api";
import { Button, DataTable, Drawer, EmptyState, Field, InlineNotice, Input, SearchInput, Select, Spinner, StatusChip } from "../ui/index.js";
import { useConfirm } from "../confirm";
import { formatDateTime } from "../../lib/format";
import ProvenanceBadge from "./ProvenanceBadge";
import ReasonDialog from "./ReasonDialog";

const TABS = [
  { id: "subjects", label: "Subjects", icon: ListChecks },
  { id: "details", label: "Student details", icon: UserRound },
  { id: "history", label: "Change history", icon: History },
];

const ACTION_LABELS = {
  create_student: "Student added",
  update_student: "Details corrected",
  add_subject: "Subject row added",
  update_subject: "Subject row changed",
  remove_subject: "Subject row removed",
  bulk_add_subject: "Added in bulk",
  import_overwrite: "Replaced by uploaded sheet",
};

// Side panel for one student's monitoring record: subject rows (inline add / edit /
// remove), header fields, and the change history. Read-only when permissions.can_edit
// is false (research coordinator, dean).
export default function StudentRecordPanel({ studentId, focusCourseId, termLabels = [], onClose, onChanged, onOpenProfile }) {
  const [tab, setTab] = useState("subjects");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await api.monitoringStudent(studentId));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    setNotice("");
    load();
  }, [load]);

  async function changed(message) {
    if (message) setNotice(message);
    await load();
    onChanged?.();
  }

  const canEdit = Boolean(data?.permissions?.can_edit);
  const student = data?.student;

  return (
    <Drawer
      side="right"
      label={student ? `${student.last_name}, ${student.first_name}` : "Monitoring record"}
      width="w-full max-w-[calc(100vw-2.5rem)] sm:max-w-3xl"
      onClose={onClose}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 className="section-title truncate">
              {student ? `${student.last_name}, ${student.first_name}` : "Monitoring record"}
            </h2>
            {student && (
              <p className="meta mt-1 flex flex-wrap items-center gap-2">
                <span>IDNO {student.student_number}</span>
                <span>·</span>
                <span>{student.program_code}</span>
                <span>·</span>
                <span>AY entry {student.academic_year_entry || "—"}</span>
                <ProvenanceBadge source={student.source?.label} by={student.source?.by} at={student.source?.at} />
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {student && onOpenProfile && (
              <Button variant="secondary" icon={ExternalLink} onClick={() => onOpenProfile(student.id)}>Full profile</Button>
            )}
            <Button variant="icon" icon={X} aria-label="Close record panel" onClick={onClose} />
          </div>
        </header>

        <div role="tablist" aria-label="Record sections" className="flex shrink-0 gap-1 border-b border-slate-200 px-2 sm:px-4">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              id={`rec-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`rec-pane-${id}`}
              type="button"
              onClick={() => setTab(id)}
              className={`-mb-px inline-flex cursor-pointer items-center gap-2 border-b-2 px-2.5 py-3 text-sm font-semibold transition-colors duration-200 sm:px-3 ${tab === id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-ink"}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" /> {label}
              {id === "history" && data?.history_count ? <span className="micro rounded-full bg-slate-100 px-1.5">{data.history_count}</span> : null}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5" role="tabpanel" id={`rec-pane-${tab}`} aria-labelledby={`rec-tab-${tab}`}>
          {notice && <InlineNotice tone="success" className="mb-4">{notice}</InlineNotice>}
          {loading ? (
            <Spinner label="Loading record…" />
          ) : error ? (
            <InlineNotice tone="danger">{error}</InlineNotice>
          ) : tab === "subjects" ? (
            <SubjectsTab data={data} canEdit={canEdit} focusCourseId={focusCourseId} termLabels={termLabels} onChanged={changed} />
          ) : tab === "details" ? (
            <DetailsTab data={data} canEdit={canEdit} onChanged={changed} />
          ) : (
            <HistoryTab studentId={studentId} refreshKey={data?.history_count} />
          )}
        </div>
      </div>
    </Drawer>
  );
}

/* ---------------------------------------------------------------- subjects */

function SubjectsTab({ data, canEdit, focusCourseId, termLabels, onChanged }) {
  const confirm = useConfirm();
  const studentId = data.student.id;
  const statuses = data.statuses || [];
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState(focusCourseId ? { courseId: focusCourseId } : null);
  const [removing, setRemoving] = useState(null);
  const [showFreeForm, setShowFreeForm] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");

  useEffect(() => {
    if (focusCourseId) {
      setEditing({ courseId: focusCourseId });
      window.setTimeout(() => document.getElementById(`subject-row-${focusCourseId}`)?.scrollIntoView({ block: "center" }), 50);
    }
  }, [focusCourseId]);

  const query = filter.trim().toLowerCase();
  const visible = useMemo(
    () => data.subjects.filter((row) => !row.removed && (!query || `${row.code} ${row.title} ${row.status}`.toLowerCase().includes(query))),
    [data.subjects, query]
  );
  const removedRows = data.subjects.filter((row) => row.removed);
  const notTaken = data.subjects.filter((row) => row.in_curriculum && !row.removed && row.status === "Missing").length;

  async function bulkAdd() {
    const ok = await confirm({
      title: "Add remaining subjects as Planned?",
      message: `${notTaken} curriculum subject(s) this student has not taken will get a Planned row. Removed rows are left alone. You can edit or remove any of them afterwards.`,
      confirmLabel: "Add Planned rows",
    });
    if (!ok) return;
    setBulkBusy(true);
    setBulkError("");
    try {
      const result = await api.bulkAddMonitoringSubjects({ program_id: data.student.program_id, student_ids: [studentId], status: "Planned" });
      await onChanged(result.message);
    } catch (e) {
      setBulkError(e.message);
    } finally {
      setBulkBusy(false);
    }
  }

  // The subject rows are a DataTable; its rows cannot swap themselves for a form, so the row being added or edited
  // opens its form in a highlighted block above the table (like "Add other subject" does) and the table keeps the row.
  const editingRow = canEdit && editing && !editing.readd ? data.subjects.find((row) => row.course_id === editing.courseId && !row.removed) : null;

  const columns = [
    {
      key: "subject",
      header: "Subject",
      cell: (row) => (
        <>
          <p className="font-semibold text-ink">{row.code}</p>
          <p className="meta">
            {row.title} · {row.units}u{!row.in_curriculum && <span className="micro ml-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold">Not in curriculum</span>}
          </p>
          {row.remarks && <p className="meta mt-0.5 italic">{row.remarks}</p>}
          {row.operational_status && row.operational_status !== row.status && (
            <p className="meta mt-0.5 flex items-center gap-1 text-amber-700"><AlertTriangle className="h-3 w-3" aria-hidden="true" /> Enrollment this term shows {row.operational_status}</p>
          )}
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (row.status === "Missing" ? <span className="text-slate-500">Not taken</span> : <StatusChip status={row.status} dot={false} />),
    },
    { key: "term_label", header: "Term taken", cell: (row) => row.term_label || "—" },
    {
      key: "source",
      header: "Source",
      cell: (row) => <ProvenanceBadge source={row.source} by={row.source_by} at={row.source_at} reason={row.source_reason} evidence={row.evidence_reference} />,
    },
    ...(canEdit
      ? [{
          key: "actions",
          header: "Actions",
          align: "right",
          cell: (row) => {
            const notTaken = row.status === "Missing";
            return (
              <div className="flex justify-end gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={notTaken ? Plus : Pencil}
                  aria-label={`${notTaken ? "Add" : "Edit"} ${row.code}`}
                  onClick={() => setEditing({ courseId: row.course_id })}
                >
                  {notTaken ? "Add" : "Edit"}
                </Button>
                {!notTaken && (
                  <Button variant="icon" icon={Trash2} aria-label={`Remove ${row.code}`} className="text-red-600 hover:bg-red-50" onClick={() => setRemoving(row)} />
                )}
              </div>
            );
          },
        }]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-ink">{data.summary.completed_count}</span> of {data.summary.required_count} curriculum subjects completed ·{" "}
          <span className="font-semibold text-ink">{data.summary.completed_units}</span>/{data.summary.total_units} units
          {data.summary.manual_rows > 0 && <> · {data.summary.manual_rows} manual row(s)</>}
        </p>
        <SearchInput
          value={filter}
          onChange={setFilter}
          label="Filter subjects"
          placeholder="Filter subjects…"
          className="w-full sm:w-56"
          // Escape clears the filter; it must not also close the panel
          onKeyDown={(event) => { if (event.key === "Escape" && filter) event.stopPropagation(); }}
        />
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={Plus} onClick={() => setShowFreeForm((v) => !v)} aria-expanded={showFreeForm}>
            Add other subject
          </Button>
          <Button variant="secondary" icon={ListPlus} disabled={bulkBusy || notTaken === 0} onClick={bulkAdd}>
            {bulkBusy ? "Adding…" : `Add remaining curriculum subjects (${notTaken})`}
          </Button>
        </div>
      )}
      {bulkError && <InlineNotice tone="danger">{bulkError}</InlineNotice>}
      {showFreeForm && canEdit && (
        <FreeFormForm studentId={studentId} statuses={statuses} termLabels={termLabels} onCancel={() => setShowFreeForm(false)} onSaved={(m) => { setShowFreeForm(false); onChanged(m); }} />
      )}
      {editingRow && (
        <div id={`subject-row-${editingRow.course_id}`} className="rounded-xl border border-brand-200 bg-brand-50/40 p-3">
          <InlineEditor
            key={editingRow.course_id}
            row={editingRow}
            studentId={studentId}
            statuses={statuses}
            termLabels={termLabels}
            onCancel={() => setEditing(null)}
            onSaved={(m) => { setEditing(null); onChanged(m); }}
          />
        </div>
      )}

      <DataTable
        caption="Subject rows for this student"
        columns={columns}
        rows={visible}
        rowKey="course_id"
        pageSize={0}
        empty={{
          icon: ListChecks,
          title: query ? "No subject matches that filter." : "This program has no curriculum subjects yet.",
          hint: query ? "Try a different filter." : "Use Add other subject for a free-form row.",
        }}
      />

      {removedRows.length > 0 && (
        <div>
          <Button variant="secondary" size="sm" onClick={() => setShowRemoved((v) => !v)} aria-expanded={showRemoved}>
            {showRemoved ? "Hide" : "Show"} removed rows ({removedRows.length})
          </Button>
          {showRemoved && (
            <ul className="mt-2 space-y-2">
              {removedRows.map((row) => (
                <li key={row.course_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-700 line-through">{row.code} — {row.title}</p>
                    <p className="meta">Was {row.removed_status || "—"}. Removed by {row.removed_by || "—"} on {formatDateTime(row.removed_at)}. Reason: {row.removal_reason || "—"}</p>
                  </div>
                  {canEdit && (
                    <Button variant="secondary" size="sm" icon={Undo2} onClick={() => setEditing({ courseId: row.course_id, readd: true })}>
                      Re-add
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {editing?.readd && (
            <div className="mt-3">
              <FreeFormForm
                studentId={studentId}
                statuses={statuses}
                termLabels={termLabels}
                fixedCourse={removedRows.find((r) => r.course_id === editing.courseId)}
                onCancel={() => setEditing(null)}
                onSaved={(m) => { setEditing(null); onChanged(m); }}
              />
            </div>
          )}
        </div>
      )}

      {removing && (
        <RemoveDialog
          row={removing}
          studentId={studentId}
          onCancel={() => setRemoving(null)}
          onDone={(m) => { setRemoving(null); onChanged(m); }}
        />
      )}
    </div>
  );
}

// A subject is dropped by the professor when unexcused absences exceed the handbook limit, so a
// Dropped row needs the absence percentage or a documented exception with its reason.
function DropEvidenceFields({ form, setForm }) {
  return (
    <div className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 sm:grid-cols-2">
      <p className="text-xs font-semibold text-amber-900 sm:col-span-2">
        A subject is dropped by the professor when unexcused absences are more than 20% of class hours (Graduate School Handbook). Give the percentage, or explain the approved exception.
      </p>
      <Field label="Unexcused absences (% of class hours)">
        <Input type="number" min="0" max="100" step="0.1" value={form.unexcused_absence_percent} onChange={(e) => setForm({ ...form, unexcused_absence_percent: e.target.value })} />
      </Field>
      <Field label="Or: documented exception and who approved it">
        <Input value={form.drop_exception_reason} onChange={(e) => setForm({ ...form, drop_exception_reason: e.target.value })} maxLength={300} />
      </Field>
    </div>
  );
}

function dropEvidence(form) {
  return form.status === "Dropped"
    ? { unexcused_absence_percent: form.unexcused_absence_percent, drop_exception_reason: form.drop_exception_reason }
    : {};
}

// Add or edit one curriculum row in place. Enter saves, Esc cancels.
function InlineEditor({ row, studentId, statuses, termLabels, onCancel, onSaved }) {
  const isAdd = row.status === "Missing";
  const needsReason = !isAdd && (row.source === "Imported" || row.source === "System");
  const listId = useId();
  const [form, setForm] = useState({
    status: isAdd ? "Planned" : row.status,
    term_label: row.term_label || "",
    remarks: row.remarks || "",
    reason: "",
    unexcused_absence_percent: "",
    drop_exception_reason: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = isAdd || form.status !== row.status || form.term_label !== (row.term_label || "") || form.remarks !== (row.remarks || "");
  const statusOptions = statuses.includes(row.status) || isAdd ? statuses : [row.status, ...statuses];

  async function save(event) {
    event?.preventDefault();
    if (!dirty || busy) return;
    setBusy(true);
    setError("");
    try {
      if (isAdd) {
        const result = await api.addMonitoringSubject(studentId, { course_id: row.course_id, status: form.status, term_label: form.term_label, remarks: form.remarks, reason: form.reason, ...dropEvidence(form) });
        onSaved(result.message);
      } else {
        const result = await api.updateMonitoringSubject(studentId, row.record_id, { status: form.status, term_label: form.term_label, remarks: form.remarks, reason: form.reason, ...dropEvidence(form) });
        onSaved(result.message);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation(); // cancels the editor only, not the panel around it
      onCancel();
    }
  }

  return (
    <form onSubmit={save} onKeyDown={onKeyDown} className="space-y-3" aria-label={`${isAdd ? "Add" : "Edit"} ${row.code}`}>
      <p className="text-sm font-semibold text-ink">{isAdd ? "Add" : "Edit"} {row.code} — {row.title}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Status"><Select autoFocus value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={statusOptions} placeholder="" /></Field>
        <Field label="Term taken">
          <Input list={listId} value={form.term_label} onChange={(e) => setForm({ ...form, term_label: e.target.value })} maxLength={40} placeholder="AY 2026-2027 1st Semester" />
          <datalist id={listId}>{termLabels.map((label) => <option key={label} value={label} />)}</datalist>
        </Field>
        <Field label="Remarks"><Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} maxLength={500} /></Field>
      </div>
      {form.status === "Dropped" && form.status !== row.status && <DropEvidenceFields form={form} setForm={setForm} />}
      {needsReason && (
        <Field label="Reason for changing this imported value" required hint="Kept in the change history with your name.">
          <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={500} required />
        </Field>
      )}
      {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="meta mr-auto">Enter to save · Esc to cancel</span>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={busy || !dirty || (needsReason && form.reason.trim().length < 3)}>{busy ? "Saving…" : isAdd ? "Add row" : "Save changes"}</Button>
      </div>
    </form>
  );
}

// Free-form subject (not in the curriculum), or re-adding a removed row (fixedCourse).
function FreeFormForm({ studentId, statuses, termLabels, fixedCourse, onCancel, onSaved }) {
  const listId = useId();
  const [form, setForm] = useState({ code: "", title: "", units: "3", status: "Completed", term_label: "", remarks: "", unexcused_absence_percent: "", drop_exception_reason: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = fixedCourse
        ? { course_id: fixedCourse.course_id, status: form.status, term_label: form.term_label, remarks: form.remarks, ...dropEvidence(form) }
        : { code: form.code, title: form.title, units: Number(form.units), status: form.status, term_label: form.term_label, remarks: form.remarks, ...dropEvidence(form) };
      const result = await api.addMonitoringSubject(studentId, payload);
      onSaved(result.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCancel(); } }} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4" aria-label={fixedCourse ? `Re-add ${fixedCourse.code}` : "Add other subject"}>
      <p className="text-sm font-semibold text-ink">{fixedCourse ? `Re-add ${fixedCourse.code} — ${fixedCourse.title}` : "Add a subject that is not in the curriculum"}</p>
      {!fixedCourse && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Subject code" required><Input autoFocus value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required maxLength={40} /></Field>
          <div className="sm:col-span-1"><Field label="Title" required><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={160} /></Field></div>
          <Field label="Units" required><Input type="number" min="1" max="12" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} required /></Field>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={statuses} placeholder="" autoFocus={Boolean(fixedCourse)} /></Field>
        <Field label="Term taken">
          <Input list={listId} value={form.term_label} onChange={(e) => setForm({ ...form, term_label: e.target.value })} maxLength={40} />
          <datalist id={listId}>{termLabels.map((label) => <option key={label} value={label} />)}</datalist>
        </Field>
        <Field label="Remarks"><Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} maxLength={500} /></Field>
      </div>
      {form.status === "Dropped" && <DropEvidenceFields form={form} setForm={setForm} />}
      {!fixedCourse && <p className="text-xs text-slate-500">Free-form rows are kept and exported, but never count toward curriculum completion or eligibility.</p>}
      {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Add row"}</Button>
      </div>
    </form>
  );
}

function RemoveDialog({ row, studentId, onCancel, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function confirmRemove(reason) {
    setBusy(true);
    setError("");
    try {
      const result = await api.removeMonitoringSubject(studentId, row.record_id, { reason });
      onDone(result.message);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <ReasonDialog
      title={`Remove ${row.code}?`}
      message={`The ${row.status} row for ${row.code} goes back to "not taken". It is not erased: the row and what it held stay in the change history, and it can be re-added.`}
      confirmLabel="Remove row"
      tone="danger"
      busy={busy}
      error={error}
      onConfirm={confirmRemove}
      onCancel={onCancel}
    />
  );
}

/* ----------------------------------------------------------------- details */

function DetailsTab({ data, canEdit, onChanged }) {
  const student = data.student;
  const initial = {
    student_number: student.student_number || "",
    first_name: student.first_name || "",
    last_name: student.last_name || "",
    email: student.email || "",
    academic_year_entry: student.academic_year_entry || "",
    adviser_name: student.adviser_name || "",
  };
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = Object.keys(initial).some((key) => form[key] !== initial[key]);

  async function save(reason) {
    setBusy(true);
    setError("");
    try {
      const result = await api.updateMonitoringStudent(student.id, { ...form, reason });
      setConfirming(false);
      setEditing(false);
      await onChanged(result.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const rows = [
    ["Student ID", student.student_number], ["First name", student.first_name], ["Last name", student.last_name],
    ["Email (student login)", student.email], ["School year / AY entry", student.academic_year_entry],
    ["Year level", student.year_level], ["Program", `${student.program_code} — ${student.program_name}`],
    ["Lifecycle stage", student.current_stage], ["Enrollment", student.enrollment_tag], ["Adviser", student.adviser_name || "—"],
  ];

  if (!editing) {
    return (
      <div className="space-y-4">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label}><dt className="eyebrow">{label}</dt><dd className="mt-0.5 text-sm text-ink">{value || "—"}</dd></div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <ProvenanceBadge source={student.source?.label} by={student.source?.by} at={student.source?.at} />
          {student.last_change && <span>Last corrected {formatDateTime(student.last_change.at)}{student.last_change.by ? ` by ${student.last_change.by}` : ""}{student.last_change.reason ? ` — ${student.last_change.reason}` : ""}</span>}
        </div>
        {canEdit ? (
          <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>Correct details</Button>
        ) : (
          <p className="text-xs text-slate-500">You can view this record but not change it.</p>
        )}
        <p className="text-xs text-slate-500">Lifecycle stage, enrollment status, leave, AWOL and withdrawal are changed through their own workflows, not here.</p>
      </div>
    );
  }

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  return (
    <form
      onSubmit={(event) => { event.preventDefault(); if (dirty) setConfirming(true); }}
      onKeyDown={(event) => { if (event.key === "Escape" && !confirming) { event.preventDefault(); event.stopPropagation(); setEditing(false); setForm(initial); } }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Student ID" required><Input autoFocus value={form.student_number} onChange={set("student_number")} required maxLength={40} /></Field>
        <Field label="School year / AY entry" required><Input value={form.academic_year_entry} onChange={set("academic_year_entry")} required maxLength={20} /></Field>
        <Field label="First name" required><Input value={form.first_name} onChange={set("first_name")} required maxLength={80} /></Field>
        <Field label="Last name" required><Input value={form.last_name} onChange={set("last_name")} required maxLength={80} /></Field>
        <Field label="Email (student login)" required><Input type="email" value={form.email} onChange={set("email")} required maxLength={160} /></Field>
        <Field label="Adviser"><Input value={form.adviser_name} onChange={set("adviser_name")} maxLength={120} /></Field>
      </div>
      <p className="text-xs text-slate-500">Changing the email also changes the student's login. A reason is asked for next.</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => { setEditing(false); setForm(initial); setError(""); }}>Cancel</Button>
        <Button type="submit" disabled={!dirty}>Review correction</Button>
      </div>
      {confirming && (
        <ReasonDialog
          title="Save this correction?"
          message={Object.keys(initial).filter((key) => form[key] !== initial[key]).map((key) => `${key.replace(/_/g, " ")}: ${initial[key] || "(blank)"} → ${form[key] || "(blank)"}`).join("\n")}
          confirmLabel="Save correction"
          busy={busy}
          error={error}
          onConfirm={save}
          onCancel={() => { setConfirming(false); setError(""); }}
        />
      )}
    </form>
  );
}

/* ----------------------------------------------------------------- history */

function HistoryTab({ studentId, refreshKey }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setItems(null);
    api.monitoringHistory(studentId)
      .then((res) => active && setItems(res.items))
      .catch((e) => active && setError(e.message));
    return () => { active = false; };
  }, [studentId, refreshKey]);

  if (error) return <InlineNotice tone="danger">{error}</InlineNotice>;
  if (!items) return <Spinner label="Loading history…" />;
  if (items.length === 0) return <EmptyState icon={History} size="sm" title="No portal changes have been made to this record." hint="Imported values are not listed here." />;
  return (
    <ol className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="rounded-xl border border-slate-200 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-ink">{ACTION_LABELS[item.action] || item.action}{item.code ? ` — ${item.code}` : ""}</p>
            <time className="text-xs text-slate-500" dateTime={item.created_at}>{formatDateTime(item.created_at)}</time>
          </div>
          {item.field && item.field !== "record" && (
            <p className="mt-1 text-slate-700"><span className="text-slate-500">{item.field.replace(/_/g, " ")}:</span> {item.old_value || "(blank)"} <span aria-label="changed to">→</span> <span className="font-semibold">{item.new_value || "(blank)"}</span></p>
          )}
          {item.field === "record" && item.new_value && <p className="mt-1 text-slate-700">{item.new_value}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <ProvenanceBadge source={item.source} />
            <span>by {item.actor_name || "unknown"}</span>
            {item.reason && <span>· Reason: {item.reason}</span>}
          </p>
        </li>
      ))}
    </ol>
  );
}
