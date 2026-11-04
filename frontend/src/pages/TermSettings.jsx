import { useState } from "react";
import { CalendarClock, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Button, DataTable, Field, InlineNotice, Input, Modal, PageHeader, Select, Spinner, StatusChip } from "../components/ui/index.js";
import { useConfirm } from "../components/confirm";
import { PAGE } from "../lib/labels.js";
import { formatDate } from "../lib/format";

const EMPTY_FORM = { ay: "", sem: "", start_date: "", end_date: "", planning_window_open: "", planning_window_close: "" };
const DATE_FIELDS = ["start_date", "end_date", "planning_window_open", "planning_window_close"];

const SEMESTERS = ["1st Semester", "2nd Semester"]; // the only names the server accepts for a label

/** Academic years already on record (start year of "AY 2026-2027") and the semester that follows the newest one. */
function labelDefaults(items) {
  const parsed = (items || []).map((t) => /(\d{4})-\d{4}\s*(1st|2nd)/i.exec(t.label || "")).filter(Boolean)
    .map((m) => ({ year: Number(m[1]), second: m[2].toLowerCase() === "2nd" }));
  if (!parsed.length) { const y = new Date().getFullYear(); return { years: [y, y + 1], year: y, sem: SEMESTERS[0] }; }
  const last = parsed.reduce((a, b) => (b.year > a.year || (b.year === a.year && b.second && !a.second) ? b : a));
  const next = last.second ? { year: last.year + 1, sem: SEMESTERS[0] } : { year: last.year, sem: SEMESTERS[1] };
  const years = [...new Set([...parsed.map((p) => p.year), last.year + 1])].sort((a, b) => b - a);
  return { years, ...next };
}

function DateFields({ form, onChange }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Start date"><Input type="date" value={form.start_date} onChange={(e) => onChange("start_date", e.target.value)} /></Field>
      <Field label="End date"><Input type="date" value={form.end_date} onChange={(e) => onChange("end_date", e.target.value)} /></Field>
      <Field label="Planning opens (optional)"><Input type="date" value={form.planning_window_open} onChange={(e) => onChange("planning_window_open", e.target.value)} /></Field>
      <Field label="Planning closes (optional)"><Input type="date" value={form.planning_window_close} onChange={(e) => onChange("planning_window_close", e.target.value)} /></Field>
    </div>
  );
}

export default function TermSettings() {
  const confirm = useConfirm();
  const { data, loading, error, refetch } = useApi(() => api.adminTerms(), []);
  const [notice, setNotice] = useState({ tone: "success", text: "" });
  const [saving, setSaving] = useState("");
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editError, setEditError] = useState("");
  // The Academic Coordinator reads the semesters; only staff and admin change them (the server decides).
  const canManage = data?.permissions?.can_manage === true;

  const defaults = labelDefaults(data?.items);
  const label = form.ay && form.sem ? `AY ${form.ay}-${Number(form.ay) + 1} ${form.sem}` : "";

  const say = (text, tone = "success") => setNotice({ text, tone });

  async function addNext() {
    setAdding(true); say("");
    try {
      const res = await api.addNextTerm();
      say(`Added ${res.term.label}.`);
      await refetch();
    } catch (err) { say(err.message, "danger"); } finally { setAdding(false); }
  }

  function openForm() {
    setForm({ ...EMPTY_FORM, ay: String(defaults.year), sem: defaults.sem });
    setFormError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setForm(EMPTY_FORM);
    setFormError("");
  }

  async function createSemester(event) {
    event.preventDefault();
    if (!label || !form.start_date || !form.end_date) {
      setFormError("Enter the start date and end date.");
      return;
    }
    setSaving("create"); setFormError("");
    try {
      const res = await api.createTerm({
        label,
        start_date: form.start_date,
        end_date: form.end_date,
        planning_window_open: form.planning_window_open || null,
        planning_window_close: form.planning_window_close || null,
      });
      say(res.message || `Added ${label}.`);
      closeForm();
      await refetch();
    } catch (err) { setFormError(err.message); } finally { setSaving(""); }
  }

  function startEdit(term) {
    setEditing(term);
    setEditError("");
    setEditForm({
      label: term.label,
      start_date: term.start_date || "",
      end_date: term.end_date || "",
      planning_window_open: term.planning_window_open || "",
      planning_window_close: term.planning_window_close || "",
    });
    say("");
  }

  async function saveEdit() {
    const term = editing;
    const payload = {};
    DATE_FIELDS.forEach((field) => {
      const before = term[field] || "";
      if (editForm[field] !== before) payload[field] = editForm[field] || null;
    });
    if (!Object.keys(payload).length) {
      setEditing(null);
      say("No dates were changed.", "info");
      return;
    }
    setSaving(`edit-${term.id}`); setEditError("");
    try {
      const res = await api.updateTerm(term.id, payload);
      say(res.message || `Updated ${term.label}.`);
      setEditing(null);
      await refetch();
    } catch (err) { setEditError(err.message); } finally { setSaving(""); }
  }

  async function setCurrent(term) {
    const ok = await confirm({
      title: "Set as the current semester?",
      message: `${term.label}\n\nEnrollment, course adjustments, and planning will use this semester from now on.`,
      confirmLabel: "Set as current",
    });
    if (!ok) return;
    setSaving(`active-${term.id}`); say("");
    try {
      const res = await api.setActiveTerm(term.id);
      say(res.message || `${term.label} is now the current semester.`);
      await refetch();
    } catch (err) { say(err.message, "danger"); } finally { setSaving(""); }
  }

  async function remove(term) {
    const ok = await confirm({
      title: "Remove this academic semester?",
      message:
        `${term.label}\n\nOnly an unused, non-current semester can be removed. ` +
        "If student, enrollment, residency, or course-adjustment records exist, the system will keep it as history.",
      confirmLabel: "Remove semester",
      tone: "danger",
    });
    if (!ok) return;
    setSaving(`delete-${term.id}`); say("");
    try {
      const res = await api.deleteTerm(term.id, { confirmed_label: term.label });
      say(res.message);
      await refetch();
    } catch (err) { say(err.message, "danger"); } finally { setSaving(""); }
  }

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const setEditField = (field, value) => setEditForm((current) => ({ ...current, [field]: value }));

  const columns = [
    {
      key: "label",
      header: "Semester",
      cell: (term) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink">{term.label}</span>
          {term.is_active_planning_term && <StatusChip status="Active" label="Current" size="sm" dot={false} />}
        </span>
      ),
    },
    {
      key: "dates",
      header: "Semester dates",
      cell: (term) => (
        <>
          <span className="text-slate-600">{formatDate(term.start_date)} — {formatDate(term.end_date)}</span>
          {(term.planning_window_open || term.planning_window_close) && (
            <span className="meta mt-0.5 block">Planning: {term.planning_window_open ? formatDate(term.planning_window_open) : "?"} — {term.planning_window_close ? formatDate(term.planning_window_close) : "?"}</span>
          )}
        </>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (term) => (
        <div className="flex flex-wrap justify-end gap-2">
          {!term.is_active_planning_term && (
            <Button variant="secondary" size="sm" icon={Star} onClick={() => setCurrent(term)} disabled={saving === `active-${term.id}`}>
              Set as current<span className="sr-only"> {term.label}</span>
            </Button>
          )}
          <Button variant="secondary" size="sm" icon={Pencil} onClick={() => startEdit(term)}>
            Edit dates<span className="sr-only"> {term.label}</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Trash2}
            className="text-red-600"
            onClick={() => remove(term)}
            disabled={term.is_active_planning_term || saving === `delete-${term.id}`}
          >
            Remove<span className="sr-only"> {term.label}</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack animate-fade-up">
      <PageHeader
        icon={CalendarClock}
        title={PAGE.academicSemesters}
        description="Maintain the list of academic semesters and mark the current planning term. Enrollment, course adjustments, and reporting use these semesters."
        actions={canManage ? (
          <>
            <Button variant="secondary" icon={Plus} onClick={openForm}>Add semester</Button>
            <Button icon={Plus} loading={adding} onClick={addNext}>Add next semester</Button>
          </>
        ) : null}
      />

      {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      {data && !canManage && <InlineNotice tone="neutral">You can read the semesters and their dates here. Graduate School staff change them.</InlineNotice>}
      {notice.text && <InlineNotice tone={notice.tone} onDismiss={() => say("")}>{notice.text}</InlineNotice>}

      {loading ? (
        <Spinner label="Loading academic semesters…" />
      ) : (
        <DataTable
          caption="Academic semesters, newest first, with their dates and actions"
          columns={canManage ? columns : columns.filter((column) => column.key !== "actions")}
          rows={data?.items || []}
          minWidth="md"
          pageSize={0}
          empty={{ icon: CalendarClock, title: "No academic semesters are set up yet", hint: canManage ? "Add the first semester above." : "Graduate School staff add the semesters." }}
        />
      )}

      {showForm && (
        <Modal
          title="Add semester"
          subtitle="Semester dates cannot overlap another semester. The planning window is the period when study plans can be prepared for this semester."
          icon={CalendarClock}
          size="md"
          onClose={closeForm}
          dismissible={saving !== "create"}
          footer={
            <>
              <Button variant="secondary" onClick={closeForm} disabled={saving === "create"}>Cancel</Button>
              <Button type="submit" form="add-semester-form" loading={saving === "create"}>{saving === "create" ? "Saving…" : "Save semester"}</Button>
            </>
          }
        >
          <form id="add-semester-form" onSubmit={createSemester} className="space-y-4">
            {formError && <InlineNotice tone="danger">{formError}</InlineNotice>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Academic year" hint="Continues from the newest semester on record.">
                <Select aria-label="Academic year" placeholder={null} options={defaults.years.map((y) => ({ value: String(y), label: `AY ${y}-${y + 1}` }))} value={form.ay} onChange={(e) => setField("ay", e.target.value)} />
              </Field>
              <Field label="Semester">
                <Select aria-label="Semester" placeholder={null} options={SEMESTERS} value={form.sem} onChange={(e) => setField("sem", e.target.value)} />
              </Field>
            </div>
            <DateFields form={form} onChange={setField} />
          </form>
        </Modal>
      )}

      {editing && (
        <Modal
          title={`Edit dates: ${editing.label}`}
          subtitle="Only the dates change; the semester name stays as it is."
          icon={Pencil}
          size="md"
          onClose={() => setEditing(null)}
          dismissible={saving !== `edit-${editing.id}`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving === `edit-${editing.id}`}>Cancel</Button>
              <Button onClick={saveEdit} loading={saving === `edit-${editing.id}`}>{saving === `edit-${editing.id}` ? "Saving…" : "Save dates"}</Button>
            </>
          }
        >
          <div className="space-y-4">
            {editError && <InlineNotice tone="danger">{editError}</InlineNotice>}
            <DateFields form={editForm} onChange={setEditField} />
          </div>
        </Modal>
      )}
    </div>
  );
}
