import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpenCheck, CalendarClock, Eye, Lightbulb, Plus, Save, Trash2 } from "lucide-react";
import { api } from "../api";
import TeachingSchedule from "./TeachingSchedule";
import { Button, Card, DataTable, Field, InlineNotice, Input, Select, SectionCard, Spinner } from "../components/ui/index.js";
import { useConfirm } from "../components/confirm";
import FacultyAssignmentProfile from "../components/FacultyAssignmentProfile";

function scheduleMeetings(value) {
  const text = (value || "").split("(")[0];
  const head = text.match(/^([A-Za-z/ ,]+)\s*(?=\d)/);
  if (!head || /\b[ap]m\b/i.test(text)) return [];
  const days = (head[1].match(/[A-Za-z]+/g) || []).map((day) => day.slice(0, 3).toLowerCase());
  const ranges = [...text.matchAll(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/g)];
  return days.flatMap((day) => ranges.map((r) => ({ day, start: Number(r[1]) * 60 + Number(r[2]), end: Number(r[3]) * 60 + Number(r[4]) })));
}

// Course Offering Setup (Sir Eddie, 2026-07-21): the Academic Coordinator declares which
// subjects are offered for a program + semester, assigns faculty and schedule, and those
// offerings are what students get tagged/enrolled into on the Enrollment screen.
// Sections are letters A to Z; a section already saved in another form stays offered so nothing is lost.
const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const sectionLetters = (current) => (current && !LETTERS.includes(current) ? [current, ...LETTERS] : LETTERS);

export default function CourseOfferings() {
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [addCourseId, setAddCourseId] = useState("");
  const [edits, setEdits] = useState({});
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [scheduleRefresh, setScheduleRefresh] = useState(0);

  const programId = searchParams.get("program_id") || "";
  const termId = searchParams.get("term_id") || "";

  async function load(preserveEdits = false) {
    setLoading(true);
    setError("");
    try {
      const res = await api.courseOfferings({ program_id: programId || undefined, term_id: termId || undefined });
      setData(res);
      setEdits((current) => preserveEdits ? Object.fromEntries(Object.entries(current).filter(([id]) => res.offerings.some((offering) => String(offering.id) === id))) : {});
      const canonical = { program_id: String(res.program.id), term_id: String(res.term?.id || "") };
      if (canonical.program_id !== programId || canonical.term_id !== termId) {
        const params = new URLSearchParams(searchParams);
        params.set("view", "offerings");
        params.set("program_id", canonical.program_id);
        if (canonical.term_id) params.set("term_id", canonical.term_id); else params.delete("term_id");
        setSearchParams(params, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, termId]);

  const canManage = data?.permissions?.can_manage;

  async function updateFilters(next) {
    if (Object.keys(edits).length && !(await confirm({ title: "Discard unsaved changes?", message: "Save all changes before switching programs or semesters, or discard these edits.", confirmLabel: "Discard changes", tone: "danger" }))) return;
    const params = new URLSearchParams(searchParams);
    const values = { program_id: next.program_id ?? programId, term_id: next.term_id ?? termId };
    Object.entries(values).forEach(([key, value]) => value ? params.set(key, value) : params.delete(key));
    setSearchParams(params, { replace: true });
  }

  function editOf(offering) {
    return edits[offering.id] || { faculty_id: offering.faculty_id || "", schedule: offering.schedule || "", section: offering.section || "" };
  }
  function setEdit(id, key, value) {
    setEdits((cur) => ({ ...cur, [id]: { ...editOf({ id, ...data.offerings.find((o) => o.id === id) }), ...cur[id], [key]: value } }));
  }

  async function addOffering() {
    if (!addCourseId) return;
    setBusy("add"); setNotice(""); setError("");
    try {
      const res = await api.addCourseOffering({ program_id: data.program.id, term_id: data.term.id, course_id: Number(addCourseId) });
      setNotice(res.message);
      setAddCourseId("");
      await load(true);
      setScheduleRefresh((value) => value + 1);
    } catch (err) { setError(err.message); } finally { setBusy(""); }
  }

  async function saveAll() {
    if (!Object.keys(edits).length) return;
    if (conflictMessages.length) { setError("Nothing was saved. Resolve the schedule conflicts below."); return; }
    setBusy("save-all"); setNotice(""); setError("");
    try {
      const res = await api.saveCourseOfferings({
        program_id: data.program.id, term_id: data.term.id,
        offerings: Object.entries(edits).map(([id, edit]) => ({ id: Number(id), ...edit, faculty_id: edit.faculty_id || null })),
      });
      await load();
      setNotice(res.message);
      setScheduleRefresh((value) => value + 1);
    } catch (err) { setError(err.message); } finally { setBusy(""); }
  }

  async function removeOffering(offering) {
    const ok = await confirm({
      title: "Remove this offering?",
      message: `Stop offering ${offering.code} this semester? This is only allowed when no student is enrolled in it yet.`,
      confirmLabel: "Remove offering", tone: "danger",
    });
    if (!ok) return;
    setBusy(`del-${offering.id}`); setNotice(""); setError("");
    try {
      const res = await api.deleteCourseOffering(offering.id);
      setNotice(res.message);
      await load(true);
      setScheduleRefresh((value) => value + 1);
    } catch (err) { setError(err.message); } finally { setBusy(""); }
  }

  const rowConflicts = {};
  const pending = (data?.offerings || []).map((offering) => ({ ...offering, ...editOf(offering) }));
  for (let i = 0; i < pending.length; i += 1) {
    for (let j = i + 1; j < pending.length; j += 1) {
      const left = pending[i], right = pending[j];
      if (!left.faculty_id || String(left.faculty_id) !== String(right.faculty_id)) continue;
      const overlaps = scheduleMeetings(left.schedule).some((a) => scheduleMeetings(right.schedule).some((b) => a.day === b.day && a.start < b.end + 15 && b.start < a.end + 15));
      if (!overlaps) continue;
      const message = `${left.code} and ${right.code} overlap for the same faculty member. Choose different times with at least a 15-minute gap.`;
      rowConflicts[left.id] = message; rowConflicts[right.id] = message;
    }
  }
  const conflictMessages = [...new Set(Object.values(rowConflicts))];

  if (loading && !data) return <Spinner label="Loading course offerings…" />;

  const columns = [
    {
      key: "code",
      header: "Subject",
      cell: (o) => (
        <>
          <p className="whitespace-nowrap font-semibold text-ink">{o.code}</p>
          <p className="meta">{o.title} · {o.units}u</p>
        </>
      ),
    },
    {
      key: "faculty",
      header: "Faculty",
      cell: (o) => {
        const e = editOf(o);
        if (!canManage) return o.faculty_name || <span className="text-slate-500">Unassigned</span>;
        return (
          <div className="min-w-64">
            <Select
              disabled={Boolean(busy)}
              value={e.faculty_id}
              onChange={(ev) => setEdit(o.id, "faculty_id", ev.target.value)}
              aria-label={`Faculty for ${o.code}`}
              placeholder="Unassigned"
              options={(data.faculty || []).map((f) => ({ value: f.id, label: `${f.name} · ${f.specialization}` }))}
            />
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {o.suggested_faculty_name && (
                <button type="button" onClick={() => setEdit(o.id, "faculty_id", String(o.suggested_faculty_id))} className="inline-flex cursor-pointer items-center gap-1 font-semibold text-brand-700 hover:text-brand-800 max-sm:min-h-11">
                  <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" /> Suggested: {o.suggested_faculty_name}
                </button>
              )}
              {e.faculty_id && (
                <button type="button" onClick={() => setSelectedFaculty((data.faculty_profiles || []).find((faculty) => faculty.id === Number(e.faculty_id)) || null)} className="inline-flex cursor-pointer items-center gap-1 font-semibold text-slate-600 hover:text-brand-700 max-sm:min-h-11">
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" /> View profile
                </button>
              )}
            </div>
            {o.suggestion_basis && <p className="meta mt-1">{o.suggestion_basis}</p>}
          </div>
        );
      },
    },
    {
      key: "schedule",
      header: "Schedule",
      cell: (o) => canManage
        ? <TeachingSchedule offering={o} facultyId={editOf(o).faculty_id} termId={data.term?.id} value={editOf(o).schedule} onChange={(value) => setEdit(o.id, "schedule", value)} disabled={Boolean(busy)} refreshKey={scheduleRefresh} conflict={rowConflicts[o.id]} />
        : (o.schedule || <span className="text-slate-500">—</span>),
    },
    {
      key: "section",
      header: "Section",
      cell: (o) => canManage
        ? <Select disabled={Boolean(busy)} value={editOf(o).section} onChange={(ev) => setEdit(o.id, "section", ev.target.value)} options={sectionLetters(editOf(o).section)} placeholder="—" aria-label={`Section for ${o.code}`} className="max-w-24" />
        : (o.section || <span className="text-slate-500">—</span>),
    },
    { key: "enrolled", header: "Enrolled", align: "center", cell: (o) => <span className="font-semibold text-ink">{o.enrolled_count}</span> },
  ];
  if (canManage) {
    columns.push({
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (o) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="icon"
            icon={Trash2}
            className="text-red-600"
            onClick={() => removeOffering(o)}
            disabled={Boolean(busy)}
            aria-label={`Remove ${o.code} from the offerings`}
          />
        </div>
      ),
    });
  }

  return (
    <div className="page-stack">
      <SectionCard
        title="Course Offering Setup"
        subtitle="Complete the official offering list, then choose the faculty, schedule, and section. Faculty suggestions are references only; the Academic Coordinator can change every assignment."
        icon={BookOpenCheck}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Program">
            <Select
              value={data?.program?.id || programId}
              onChange={(e) => updateFilters({ program_id: e.target.value })}
              aria-label="Program"
              placeholder={null}
              options={(data?.programs || []).map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
            />
          </Field>
          <Field label="Semester">
            <Select
              value={data?.term?.id || termId}
              onChange={(e) => updateFilters({ term_id: e.target.value })}
              aria-label="Semester"
              placeholder={null}
              options={(data?.terms || []).map((t) => ({ value: t.id, label: `${t.label}${t.relative_label ? ` (${t.relative_label})` : ""}` }))}
            />
          </Field>
        </div>
      </SectionCard>

      {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      {notice && <InlineNotice tone="success" onDismiss={() => setNotice("")}>{notice}</InlineNotice>}

      {canManage && (
        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <Field label="Add a subject to this semester's offerings">
                <Select
                  value={addCourseId}
                  onChange={(e) => setAddCourseId(e.target.value)}
                  aria-label="Subject to add to this semester's offerings"
                  placeholder="Select a curriculum subject…"
                  options={(data?.available_subjects || []).map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` }))}
                />
              </Field>
            </div>
            <Button icon={Plus} onClick={addOffering} disabled={!addCourseId || Boolean(busy)} loading={busy === "add"}>Add offering</Button>
          </div>
          {!(data?.available_subjects || []).length && <p className="meta mt-2">All curriculum subjects for this program are already offered this semester.</p>}
        </Card>
      )}

      {canManage && <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">{Object.keys(edits).length ? `${Object.keys(edits).length} offering(s) with unsaved changes` : "All changes saved"}</p>
        <Button icon={Save} onClick={saveAll} loading={busy === "save-all"} disabled={Boolean(busy) || !Object.keys(edits).length || conflictMessages.length > 0}>Save all changes</Button>
      </div>}
      {conflictMessages.length > 0 && <InlineNotice tone="danger" title="Schedule conflicts"><ul className="list-inside list-disc space-y-1">{conflictMessages.map((message) => <li key={message}>{message}</li>)}</ul></InlineNotice>}
      <DataTable
        caption="Subjects offered this semester, with faculty, schedule, section and number enrolled"
        columns={columns}
        rows={data?.offerings || []}
        minWidth="lg"
        pageSize={0}
        empty={{
          icon: CalendarClock,
          title: "No subjects offered yet for this semester",
          hint: canManage ? "Add subjects above to build this semester's offering list." : "The Academic Coordinator has not set up offerings for this semester.",
        }}
      />
      {selectedFaculty && <FacultyAssignmentProfile faculty={selectedFaculty} onClose={() => setSelectedFaculty(null)} />}
    </div>
  );
}
