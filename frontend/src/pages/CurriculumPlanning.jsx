import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, EmptyState, ErrorNote, Spinner, StatusBadge } from "../components/ui";

export default function CurriculumPlanning() {
  const { data: meta, loading: metaLoading, error: metaError } = useApi(() => api.meta(), []);
  const [programId, setProgramId] = useState("");
  const [termId, setTermId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState([]);
  const [busy, setBusy] = useState("");

  const programs = meta?.programs || data?.programs || [];
  const terms = data?.terms || meta?.terms || [];
  const selectedTerm = terms.find((term) => String(term.id) === String(termId)) || data?.selected_term || data?.active_term || null;
  const { academicYear: effectiveAcademicYear, semester } = parseTermLabel(selectedTerm?.label || "");
  const hasProgram = Boolean(programId);
  const ready = Boolean(programId && termId && effectiveAcademicYear && semester);

  useEffect(() => {
    if (!programId && programs.length) {
      setProgramId(String(programs[0].id));
    }
  }, [programId, programs]);

  useEffect(() => {
    if (!termId && terms.length) {
      const active = terms.find((term) => term.is_active_planning_term);
      setTermId(String((active || terms[0]).id));
    }
  }, [termId, terms]);

  useEffect(() => {
    if (!hasProgram) return;
    loadOfferings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, termId, hasProgram]);

  async function loadOfferings() {
    setLoading(true);
    setError("");
    try {
      const res = await api.curriculumOfferings({
        program_id: programId,
        term_id: termId || undefined,
      });
      setData(res);
      setSelectedCourseIds([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function addSelected() {
    if (!ready) return;
    const count = selectedCourseIds.length;
    if (!count) return;
    const programLabel = selectedProgram ? `${selectedProgram.code} — ${selectedProgram.name}` : "this program";
    const ok = window.confirm(
      `Add ${count} subject${count === 1 ? "" : "s"} to ${programLabel} for this semester?\n\n` +
      `They become part of the official offering list and appear on the monitoring sheet for every student in the program.`
    );
    if (!ok) return;
    setBusy("add");
    setError("");
    setMessage("");
    try {
      const res = await api.addCurriculumOfferings({
        program_id: Number(programId),
        term_id: Number(termId),
        course_ids: selectedCourseIds,
      });
      setMessage(res.message);
      setShowAdd(false);
      await loadOfferings();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function autoFillFromDemand() {
    if (!ready) return;
    setBusy("generate");
    setError("");
    setMessage("");
    try {
      const res = await api.generateCurriculum({ program_id: Number(programId), term_id: Number(termId), scope: "active" });
      setMessage(res.message);
      await loadOfferings();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function removeOffering(offering) {
    setData((current) => current ? {
      ...current,
      items: current.items.filter((item) => item.id !== offering.id),
    } : current);
    setError("");
    setMessage("");
    try {
      const res = await api.deleteCurriculumOffering(offering.id);
      setMessage(res.message);
    } catch (err) {
      setError(err.message);
      loadOfferings();
    }
  }

  const selectedProgram = programs.find((program) => String(program.id) === String(programId));
  const addedCourseIds = useMemo(() => new Set((data?.items || []).map((item) => item.course_id)), [data]);
  const availableCourses = useMemo(() => data?.courses || [], [data]);
  const filteredCourses = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return availableCourses;
    return availableCourses.filter((course) => `${course.code} ${course.title}`.toLowerCase().includes(term));
  }, [availableCourses, search]);
  const selectableIds = filteredCourses.filter((course) => !addedCourseIds.has(course.id)).map((course) => course.id);
  const allVisibleSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedCourseIds.includes(id));
  const offeringCount = data?.items?.length || 0;

  function toggleCourse(courseId) {
    setSelectedCourseIds((current) => (
      current.includes(courseId)
        ? current.filter((id) => id !== courseId)
        : [...current, courseId]
    ));
  }

  function toggleAllVisible() {
    setSelectedCourseIds((current) => {
      if (allVisibleSelected) return current.filter((id) => !selectableIds.includes(id));
      return Array.from(new Set([...current, ...selectableIds]));
    });
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white">
            <BookOpenCheck className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-semibold text-ink">Curriculum planning</h1>
            <p className="mt-1 text-sm text-slate-600">
              Official list of subjects offered per semester. Choose a program and academic semester, then add subjects from the monitoring sheet curriculum.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
              <p>
                <span className="font-bold uppercase tracking-wide text-slate-400">Who uses it · </span>
                Academic Coordinator / GS Staff
              </p>
              <p>
                <span className="font-bold uppercase tracking-wide text-slate-400">Data captured · </span>
                Academic semester, program, offered subjects, units, category, staff entry.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <ErrorNote message={error || metaError} />
      {message && <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{message}</div>}

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Field label="Program">
            <select value={programId} onChange={(event) => setProgramId(event.target.value)} className="field-input cursor-pointer" disabled={metaLoading}>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>{program.code} - {program.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Academic year and semester">
            <select value={termId} onChange={(event) => setTermId(event.target.value)} className="field-input cursor-pointer" disabled={!terms.length}>
              {terms.map((term) => <option key={term.id} value={term.id}>{formatTermLabel(term.label)}{term.is_active_planning_term ? " (Active)" : ""}</option>)}
            </select>
          </Field>
        </div>
      </Card>

      {!ready ? (
        <Card className="p-5">
          <EmptyState
            icon={BookOpenCheck}
            title="Select an academic year and semester"
            hint="Choose a program and academic semester to view the saved offering list."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Subjects offered for {formatTermLabel(selectedTerm?.label)}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {selectedProgram?.code || "Selected program"} saved offering list
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                {offeringCount} subject{offeringCount === 1 ? "" : "s"}
              </span>
              <button type="button" onClick={() => setShowAdd(true)} className="btn-primary">
                <Plus className="h-4 w-4" /> Add subjects
              </button>
              <button type="button" onClick={autoFillFromDemand} disabled={busy === "generate"} className="btn-ghost cursor-pointer">
                <Sparkles className="h-4 w-4" /> {busy === "generate" ? "Checking demand..." : "Auto-fill from demand"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-5">
              <Spinner label="Loading offering list..." />
            </div>
          ) : data?.items?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3">Subject code</th>
                    <th className="px-3 py-3">Subject title</th>
                    <th className="px-3 py-3">Units</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3">Added by</th>
                    <th className="px-5 py-3 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((offering) => (
                    <tr key={offering.id} className="border-b border-slate-50">
                      <td className="px-5 py-3 font-semibold text-ink">{offering.course_code}</td>
                      <td className="px-3 py-3 text-slate-600">{offering.course_title}</td>
                      <td className="px-3 py-3 text-slate-600">{offering.course_units}</td>
                      <td className="px-3 py-3"><StatusBadge value={offering.course_category || "Core"} dot={false} /></td>
                      <td className="px-3 py-3 text-slate-600">{offering.added_by || "-"}</td>
                      <td className="px-5 py-3 text-right">
                        <button type="button" onClick={() => removeOffering(offering)} className="inline-grid h-9 w-9 place-items-center rounded-lg text-red-600 hover:bg-red-50" aria-label={`Remove ${offering.course_code}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                icon={BookOpenCheck}
                title={`No subjects offered yet for ${formatTermLabel(selectedTerm?.label)}.`}
                hint="Use Add subjects to build this semester's saved offering list."
              />
            </div>
          )}
        </Card>
      )}

      {showAdd && (
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">Add subjects</h2>
              <p className="mt-1 text-sm text-slate-500">
                Adding to: {selectedProgram?.code || "Program"} · {formatTermLabel(selectedTerm?.label)}
              </p>
            </div>
            <button type="button" onClick={() => setShowAdd(false)} className="btn-ghost px-3 py-2">
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative md:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="field-input pl-9" placeholder="Search by code or title" />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={toggleAllVisible} disabled={!selectableIds.length} className="btn-ghost">
                {allVisibleSelected ? "Deselect all" : "Select all"}
              </button>
              <button type="button" onClick={addSelected} disabled={!selectedCourseIds.length || busy === "add"} className="btn-primary">
                {busy === "add" ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Plus className="h-4 w-4" />}
                Add selected
              </button>
            </div>
          </div>
          <div className="mt-4 max-h-[46vh] overflow-auto rounded-xl border border-slate-200">
            {filteredCourses.length ? (
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">Select</th>
                    <th className="px-3 py-3">Code</th>
                    <th className="px-3 py-3">Title</th>
                    <th className="px-3 py-3">Units</th>
                    <th className="px-3 py-3">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.map((course) => {
                    const alreadyAdded = addedCourseIds.has(course.id);
                    const checked = selectedCourseIds.includes(course.id);
                    return (
                      <tr key={course.id} className={`border-b border-slate-50 ${alreadyAdded ? "bg-slate-50 text-slate-400" : ""}`}>
                        <td className="px-4 py-3">
                          {alreadyAdded ? (
                            <span className="text-xs font-semibold text-slate-400">Already added</span>
                          ) : (
                            <input type="checkbox" checked={checked} onChange={() => toggleCourse(course.id)} className="h-5 w-5 cursor-pointer accent-brand-600" aria-label={`Select ${course.code}`} />
                          )}
                        </td>
                        <td className="px-3 py-3 font-semibold text-ink">{course.code}</td>
                        <td className="px-3 py-3 text-slate-600">{course.title}</td>
                        <td className="px-3 py-3 text-slate-600">{course.units}</td>
                        <td className="px-3 py-3"><StatusBadge value={course.category || "Core"} dot={false} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <EmptyState icon={Search} title="No subjects found" hint="Try another search phrase or select a program with subjects." />
            )}
          </div>
        </Card>
      )}

    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function parseTermLabel(label) {
  const ay = label.match(/AY\s*(\d{4}\s*-\s*\d{4})/i)?.[1]?.replace(/\s+/g, "") || "";
  const term = label.match(/(?:\d+(?:st|nd|rd|th)\s+Semester|Term\s*\d+)/i)?.[0]?.replace(/\s+/g, " ") || "";
  return {
    academicYear: ay,
    semester: term ? term.replace(/^Term\s*1$/i, "1st Semester").replace(/^Term\s*2$/i, "2nd Semester") : "",
  };
}

function formatTermLabel(label) {
  if (!label) return "Selected academic semester";
  const { academicYear, semester } = parseTermLabel(label);
  if (academicYear && semester) return `AY ${academicYear} ${semester}`;
  return label;
}
