import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useConfirm } from "../components/confirm";
import { Button, EmptyState, Field, InlineNotice, SectionCard, Select, Spinner, StatusChip } from "../components/ui/index.js";
import { TEACHING_DAYS } from "./faculty/FacultySchedule";
import { formatTimeRange } from "./faculty/FacultyContext";

function Messages({ errors = [], warnings = [] }) {
  return <>{errors.length > 0 && <InlineNotice tone="danger" title="Resolve before approval"><ul className="list-inside list-disc space-y-1">{errors.map((message, i) => <li key={i}>{message}</li>)}</ul></InlineNotice>}{warnings.length > 0 && <InlineNotice tone="warning" title="Review these warnings"><ul className="list-inside list-disc space-y-1">{warnings.map((message, i) => <li key={i}>{message}</li>)}</ul></InlineNotice>}</>;
}

export default function TeachingSchedule() {
  const { user } = useAuth();
  const canManage = user?.role === "academic_coordinator";
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const termId = searchParams.get("term_id") || "";
  const [data, setData] = useState(null);
  const [edits, setEdits] = useState({});
  const [pinEdits, setPinEdits] = useState({});
  const [allowSingle, setAllowSingle] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const plan = data?.plan;
  const editable = canManage && plan?.status === "Draft";
  const unsaved = Object.keys(edits).length > 0 || Boolean(plan && allowSingle !== Boolean(plan.allow_single_day));

  useEffect(() => {
    let active = true; setLoading(true); setError("");
    api.teachingSchedules({ term_id: termId || undefined }).then((response) => {
      if (!active) return;
      setData(response); setEdits({}); setAllowSingle(Boolean(response.plan?.allow_single_day));
    }).catch((err) => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [termId]);

  async function changeTerm(value) {
    if (unsaved && !(await confirm({ title: "Discard unsaved schedule choices?", message: "Change semester and discard the unsaved choices in this draft?", confirmLabel: "Change semester" }))) return;
    const params = new URLSearchParams(searchParams); params.set("term_id", value);
    setNotice(""); setSearchParams(params, { replace: true });
  }

  async function act(action, changedSections = []) {
    if (["approve", "publish"].includes(action) && unsaved) { setError("Save the draft before approval or publication."); return; }
    if (action === "revise" && !(await confirm({ title: "Create a schedule revision?", message: "Rebuild an unpublished draft from the current offering list and faculty assignments. Unpublished draft choices will be replaced; the published timetable stays visible until its replacement is approved and published.", confirmLabel: "Create revision" }))) return;
    const label = action === "approve" ? "Approve schedule" : "Publish schedule";
    if (["approve", "publish"].includes(action) && !(await confirm({ title: `${label}?`, message: action === "approve" ? "Confirm that you reviewed the semester's classes, faculty availability and conflict warnings. Approval does not publish the schedule." : "Make this approved timetable visible to faculty and enrolled students?", confirmLabel: label }))) return;
    setError(""); setNotice(""); setBusy(action);
    try {
      const selectionsById = Object.fromEntries(Object.entries(edits).map(([id, option_id]) => [id, { id: Number(id), option_id, pinned: true }]));
      changedSections.forEach((section) => { selectionsById[section.id] = section; });
      const draftFields = ["save", "recommend"].includes(action) ? { allow_single_day: allowSingle, sections: Object.values(selectionsById) } : {};
      const response = ["draft", "revise"].includes(action)
        ? await api.createTeachingSchedule({ term_id: data.term.id, action, allow_single_day: allowSingle })
        : await api.updateTeachingSchedule(plan.id, { version: plan.version, action, ...draftFields });
      setData((current) => ({ ...current, ...response })); setEdits({}); setAllowSingle(Boolean(response.plan?.allow_single_day));
      setNotice(action === "publish" ? "Class schedule published." : action === "approve" ? "Class schedule approved." : action === "recommend" ? "Recommendations updated. Review the draft before approving." : "Schedule draft saved.");
    } catch (err) { setError(err.message); } finally { setBusy(""); setPinEdits({}); }
  }

  function chooseSchedule(section, optionId) {
    setEdits((current) => ({ ...current, [section.id]: optionId }));
    return act("save", [{ id: section.id, option_id: optionId, pinned: true }]);
  }

  function keepSchedule(section, checked, selected) {
    setPinEdits((current) => ({ ...current, [section.id]: checked }));
    return act("save", [{ id: section.id, pinned: checked, ...(checked ? { option_id: selected } : {}) }]);
  }

  return <div className="page-stack">
    {error && <InlineNotice tone="danger" title="Could not update the class schedule">{error}</InlineNotice>}
    {notice && <InlineNotice tone="success">{notice}</InlineNotice>}
    {loading ? <Spinner label="Loading semester schedule…" /> : data && <>
      <SectionCard icon={CalendarDays} title="Semester class schedule" subtitle="The Academic Coordinator reviews and approves schedules. Draft suggestions are never published automatically." action={plan && <StatusChip status={plan.status} dot={false} />}>
        <Field label="Semester"><Select aria-label="Schedule semester" placeholder={null} value={String(data.term?.id || termId)} onChange={(event) => changeTerm(event.target.value)} options={(data.terms || []).map((term) => ({ value: term.id, label: term.label }))} disabled={Boolean(busy)} /></Field>
        <InlineNotice tone="info" title="Student conflict checking">Confirmed subject overlaps block approval. Potential conflicts from curriculum forecasts are warnings; forecast demand does not confirm enrollment.</InlineNotice>
        {(!plan || editable) && canManage && <label className="flex min-h-11 items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={allowSingle} disabled={Boolean(busy)} onChange={(event) => setAllowSingle(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />Allow single-day fallback: two 90-minute sessions with a 15-minute break</label>}
        {!plan && <EmptyState size="sm" title="No schedule draft for this semester" hint="Start with the published offerings and submitted teaching availability." action={canManage && <Button onClick={() => act("draft")} disabled={Boolean(busy)}>Create draft</Button>} />}
        {plan && canManage && <Button variant="secondary" onClick={() => act("revise")} disabled={Boolean(busy)}>Create revision</Button>}
        {unsaved && <p role="status" className="text-sm font-semibold text-amber-800">Save draft before approval. Unsaved choices or meeting-format changes have not been confirmed.</p>}
      </SectionCard>
      {(data.availability || []).length > 0 && <SectionCard title="Faculty submissions"><ul className="divide-y divide-slate-100">{data.availability.map((submission) => <li key={submission.faculty_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{submission.faculty_name}</span><StatusChip status={submission.status || "Missing"} dot={false} /></li>)}</ul></SectionCard>}
      {plan && <>
        <Messages errors={plan.errors} warnings={plan.warnings} />
        {plan.search_limited && <InlineNotice tone="warning" title="Search limit reached">These are the best options examined so far. This does not prove that no other valid timetable exists.</InlineNotice>}
        {(plan.sections || []).map((section) => {
          const choices = section.options || [];
          const selected = edits[section.id] ?? section.option_id ?? "";
          const unavailable = section.blocked_options || [];
          return <SectionCard key={section.id} title={section.code} subtitle={`${section.title || ""}${section.section ? ` · Section ${section.section}` : ""} · ${section.faculty_name || "Faculty unassigned"}`}>
            <Field label="Class meeting times"><Select aria-label={`Schedule for ${section.code}`} value={selected} disabled={!editable || Boolean(busy)} onChange={(event) => chooseSchedule(section, event.target.value)} placeholder="Choose a valid schedule" options={[
              ...choices.map((choice, index) => ({ value: choice.id, label: `${index < 3 ? `Recommended ${index + 1} · ` : ""}${choice.label}` })),
              ...unavailable.slice(0, 6).map((choice, index) => ({ value: `blocked-${index}`, label: `${choice.label} · ${choice.reason}`, disabled: true })),
            ]} /></Field>
            {editable && selected && <label className="flex min-h-11 items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={pinEdits[section.id] ?? Boolean(section.pinned)} disabled={Boolean(busy)} onChange={(event) => keepSchedule(section, event.target.checked, selected)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />Keep this schedule for {section.code}</label>}
            {editable && <p className="meta">Changing a meeting time saves and rechecks affected options. Kept schedules remain fixed when updating recommendations; clear the checkbox to let the search move this class.</p>}
            {(section.recommendation_explanation || []).length > 0 && <ul className="space-y-1 text-sm text-slate-600">{section.recommendation_explanation.map((message, index) => <li key={index}>{message}</li>)}</ul>}
            {section.section_assignment_status === "Unallocated" && <InlineNotice tone="warning" title="Student sections are unallocated">Students enrolled in this subject are conservatively checked against every section until section allocation is recorded.</InlineNotice>}
            {choices.length > 0 && <ol className="grid gap-2 text-sm lg:grid-cols-3">{choices.slice(0, 3).map((choice, index) => <li key={choice.id} className="min-w-0 break-words rounded-xl border border-brand-200 bg-brand-50 p-3 text-brand-900"><p className="font-semibold">Recommended {index + 1}</p><p className="mt-1">{choice.label}</p>{choice.preference_score > 0 && <p className="meta mt-1">Matches faculty preferred periods</p>}</li>)}</ol>}
            {!choices.length && editable && <p className="text-sm text-slate-600">No valid option is available. Resolve the faculty submission or blocking constraints before approval.</p>}
            {!editable && (section.meetings || []).length > 0 && <ul className="space-y-1 text-sm text-slate-700">{section.meetings.map((meeting, i) => <li key={i}>{TEACHING_DAYS[meeting.weekday]} · {formatTimeRange(meeting.start, meeting.end)}</li>)}</ul>}
            <Messages errors={section.errors} warnings={section.warnings} />
            {unavailable.length > 0 && <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Unavailable options ({unavailable.length})</summary><ul className="mt-3 space-y-2 text-sm text-slate-600">{unavailable.slice(0, 12).map((choice, i) => <li key={i}>{choice.label} — {choice.reason}</li>)}</ul>{unavailable.length > 12 && <p className="meta mt-2">Showing 12 examples. Change faculty availability or the meeting format to refresh the valid choices.</p>}</details>}
          </SectionCard>;
        })}
        {canManage && <div className="flex flex-wrap gap-2">
          {editable && <><Button variant="secondary" onClick={() => act("save")} disabled={Boolean(busy)}>Save schedule draft</Button><Button variant="secondary" onClick={() => act("recommend")} disabled={Boolean(busy)}>Update recommendations</Button><Button onClick={() => act("approve")} disabled={Boolean(busy) || unsaved}>Approve schedule</Button></>}
          {plan.status === "Approved" && <Button onClick={() => act("publish")} disabled={Boolean(busy) || unsaved}>Publish schedule</Button>}
        </div>}
      </>}
    </>}
  </div>;
}
