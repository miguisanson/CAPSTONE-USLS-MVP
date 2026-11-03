import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { api } from "../../api";
import { Button, Card, EmptyState, Field, InlineNotice, Input, PageHeader, SectionCard, Select, Spinner, StatusChip } from "../../components/ui/index.js";
import { useConfirm } from "../../components/confirm";
import { formatTimeRange } from "./FacultyContext";
import { formatDateTime } from "../../lib/format";

export const TEACHING_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const WINDOW_KINDS = [{ value: "available", label: "Available" }, { value: "preferred", label: "Preferred" }, { value: "unavailable", label: "Unavailable" }];
const windowName = (kind) => WINDOW_KINDS.find((item) => item.value === kind)?.label || kind;

export function PublishedClasses({ sections = [] }) {
  if (!sections.length) return <EmptyState size="sm" title="No published classes for this semester" hint="Only finalized class schedules appear here." />;
  return <ul className="space-y-3">{sections.map((section) => (
    <li key={section.id} className="rounded-xl border border-slate-200 p-3">
      <p className="font-semibold text-ink">{section.code} · {section.title}{section.section ? ` · Section ${section.section}` : ""}</p>
      {section.faculty_name && <p className="meta mt-1">{section.faculty_name}</p>}
      <ul className="mt-2 space-y-1 text-sm text-slate-700">{(section.meetings || []).map((meeting, index) => <li key={index}>{TEACHING_DAYS[meeting.weekday]} · {formatTimeRange(meeting.start, meeting.end)}</li>)}</ul>
      {section.meetings?.length === 2 && section.meetings[0].weekday === section.meetings[1].weekday && <p className="meta mt-2">Two sessions with a break between them.</p>}
    </li>
  ))}</ul>;
}

export default function FacultySchedule() {
  const [searchParams, setSearchParams] = useSearchParams();
  const termId = searchParams.get("term_id") || "";
  const [data, setData] = useState(null);
  const [windows, setWindows] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const confirm = useConfirm();

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    api.teachingAvailability({ term_id: termId || undefined }).then((response) => {
      if (!active) return;
      setData(response); setWindows(response.availability?.windows || []); setDirty(false);
    }).catch((err) => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [termId]);

  async function selectTerm(value) {
    if (dirty && !(await confirm({ title: "Discard unsaved availability?", message: "Your unsaved teaching availability will be replaced by the selected semester.", confirmLabel: "Change semester" }))) return;
    const params = new URLSearchParams(searchParams); params.set("term_id", value);
    setNotice(""); setSearchParams(params, { replace: true });
  }

  function edit(index, key, value) {
    setWindows((current) => current.map((window, i) => i === index ? { ...window, [key]: value } : window));
    setDirty(true); setNotice("");
  }

  function add(weekday = 0) {
    setWindows((current) => [...current, { weekday, start: "07:30", end: "17:00", kind: "available" }]); setDirty(true); setNotice("");
  }

  const selectedTerm = String(data?.term?.id || termId);
  const orderedTerms = [...(data?.terms || [])].sort((a, b) => String(a.start_date || a.label).localeCompare(String(b.start_date || b.label)) || a.id - b.id);
  const previousTerm = orderedTerms[orderedTerms.findIndex((term) => String(term.id) === selectedTerm) - 1];

  async function save(status, copy = false) {
    setError(""); setNotice("");
    if (!copy && windows.some((window) => !window.start || !window.end || window.start >= window.end)) {
      setError("Each time range needs an end after its start."); return;
    }
    if (copy && dirty && !(await confirm({ title: "Replace unsaved availability?", message: "Copy the previous semester's teaching availability into this draft?", confirmLabel: "Copy availability" }))) return;
    setBusy(true);
    try {
      const response = await api.saveTeachingAvailability(data.term.id, copy
        ? { version: data.availability.version, copy_from_term_id: previousTerm.id }
        : { version: data.availability.version, windows, status });
      setData(response); setWindows(response.availability?.windows || []); setDirty(false);
      setNotice(copy ? "Availability copied into a draft. Review it and submit to confirm this semester." : status === "Submitted" ? "Teaching availability submitted." : "Teaching availability draft saved.");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return <div className="page-stack">
    <PageHeader title="Schedule" icon={CalendarDays} description="Enter teaching availability for each semester. Your defense availability is managed separately in My Availability." />
    {error && <InlineNotice tone="danger" title="Could not save or load teaching availability">{error}</InlineNotice>}
    {notice && <InlineNotice tone="success">{notice}</InlineNotice>}
    {loading ? <Spinner label="Loading teaching availability…" /> : data && <>
      <SectionCard title="Teaching availability" action={<StatusChip status={dirty ? "Draft" : data.availability?.status || "Missing"} dot={false} />}>
        <Field label="Semester"><Select aria-label="Semester" value={selectedTerm} placeholder={null} onChange={(event) => selectTerm(event.target.value)} options={(data.terms || []).map((term) => ({ value: term.id, label: term.label }))} disabled={busy} /></Field>
        <p className="text-sm text-slate-600">Available periods permit scheduling. Preferred periods improve recommendations within your availability. Unavailable periods always take precedence. All times are Philippine time.</p>
        {data.availability?.status === "Missing" && !dirty && <InlineNotice tone="info" title="Availability not submitted">The coordinator will see your availability as unknown until you submit it.</InlineNotice>}
        {dirty && <p role="status" className="text-sm font-semibold text-amber-800">Unsaved changes</p>}
        {data.availability?.confirmed_at && <p className="meta">Last confirmed: {formatDateTime(data.availability.confirmed_at)}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => save("Draft", true)} disabled={busy || !previousTerm}>Copy previous semester</Button>
          <Button variant="secondary" onClick={() => save("Submitted")} disabled={busy || dirty || data.availability?.status === "Missing"}>Confirm no changes</Button>
        </div>
      </SectionCard>
      <SectionCard title="Weekly teaching calendar" subtitle="Select a day to add a time range. Use the editable list below for precise times.">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-800">Available</span>
          <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-800">Preferred</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">Unavailable</span>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-4 xl:grid-cols-7">
          {TEACHING_DAYS.map((day, weekday) => <div key={day} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-2">
            <Button variant="ghost" size="sm" onClick={() => add(weekday)} disabled={busy} aria-label={`Add time on ${day}`} className="w-full justify-between"><span>{day}</span><Plus className="h-3.5 w-3.5" aria-hidden="true" /></Button>
            <ul className="mt-2 space-y-2">{windows.filter((window) => window.weekday === weekday).sort((a, b) => a.start.localeCompare(b.start)).map((window, index) => <li key={index} className={`break-words rounded-lg border p-2 text-xs ${window.kind === "preferred" ? "border-amber-200 bg-amber-50 text-amber-900" : window.kind === "unavailable" ? "border-slate-300 bg-slate-100 text-slate-700" : "border-brand-200 bg-brand-50 text-brand-900"}`}><p className="font-semibold">{windowName(window.kind)}</p><p className="mt-1">{formatTimeRange(window.start, window.end)}</p></li>)}</ul>
            {!windows.some((window) => window.weekday === weekday) && <p className="meta px-2 py-3">No availability entered</p>}
          </div>)}
        </div>
      </SectionCard>
      <SectionCard title="Edit time ranges" action={<Button variant="secondary" icon={Plus} onClick={() => add()} disabled={busy}>Add time range</Button>}>
        {!windows.length && <p className="text-sm text-slate-600">Add your available periods, then optionally mark preferred or unavailable periods.</p>}
        {windows.map((window, index) => <div key={index} className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2 xl:grid-cols-5">
          <Field label="Day"><Select aria-label={`Day for time range ${index + 1}`} value={window.weekday} placeholder={null} options={TEACHING_DAYS.map((label, value) => ({ label, value }))} onChange={(event) => edit(index, "weekday", Number(event.target.value))} disabled={busy} /></Field>
          <Field label="From"><Input aria-label={`Start for time range ${index + 1}`} type="time" value={window.start} onChange={(event) => edit(index, "start", event.target.value)} disabled={busy} /></Field>
          <Field label="To"><Input aria-label={`End for time range ${index + 1}`} type="time" value={window.end} onChange={(event) => edit(index, "end", event.target.value)} disabled={busy} /></Field>
          <Field label="Period"><Select aria-label={`Kind for time range ${index + 1}`} value={window.kind} placeholder={null} options={WINDOW_KINDS} onChange={(event) => edit(index, "kind", event.target.value)} disabled={busy} /></Field>
          <div className="flex items-end"><Button variant="secondary" icon={Trash2} aria-label={`Remove time range ${index + 1}`} onClick={() => { setWindows((current) => current.filter((_, i) => i !== index)); setDirty(true); }} disabled={busy}>Remove</Button></div>
        </div>)}
        <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => save("Draft")} disabled={busy}>Save draft</Button><Button onClick={() => save("Submitted")} disabled={busy}>Submit availability</Button></div>
      </SectionCard>
      <Card><h2 className="section-title mb-4">Published classes</h2><PublishedClasses sections={data.published} /></Card>
    </>}
  </div>;
}
