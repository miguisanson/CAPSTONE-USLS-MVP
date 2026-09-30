import { useMemo, useState } from "react";
import { BookOpen, CalendarClock, CheckCircle2, Eye, FileSignature, Gavel, Users } from "lucide-react";
import { api } from "../api";
import { Card, EmptyState, SectionTitle, StatusBadge } from "./ui";
import { formatDate } from "../lib/format";
import SignaturePad from "./SignaturePad";

const TITLE_GATE = "Form 1 - Title Defense";
const FINAL_GATE = "Final Defense";

// Verdict words, follow-ups and who acts next come from the API (`verdict_options` per panel,
// RESEARCH_VERDICTS in app.py). Nothing is hard-coded here.
export default function FacultyResearchWorkspace({ advisees = [], panels = [], refetch }) {
  const papers = useMemo(() => advisees.flatMap((row) => row.documents.map((document) => ({ ...document, student: row.student }))), [advisees]);
  const revisionReviews = useMemo(
    () => advisees.flatMap((row) => (row.revision_reviews || []).map((verdict) => ({ ...verdict, student: row.student }))),
    [advisees]
  );
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [signature, setSignature] = useState("");
  const [drafts, setDrafts] = useState({});
  const [corrections, setCorrections] = useState({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function run(action) {
    setBusy(true); setNotice("");
    try {
      const result = await action();
      setNotice(result.message);
      await refetch();
      return true;
    } catch (err) {
      setNotice(err.message);
      return false;
    } finally { setBusy(false); }
  }

  async function signPaper() {
    if (!selectedPaper || !signature) return;
    if (await run(() => api.signAdviserPaper(selectedPaper.id, { signature_data: signature }))) {
      setSelectedPaper(null); setSignature("");
    }
  }

  function submitVerdict(panel) {
    const scheduleId = panel.defense.id;
    const draft = drafts[scheduleId] || {};
    return run(() => api.submitDefenseVerdict(scheduleId, {
      result: draft.result || panel.verdict_options?.[0]?.value || "Passed",
      remarks: draft.remarks || "",
      selected_title: draft.selected_title || "",
      evaluation_score: draft.evaluation_score || "",
    }));
  }

  function correctVerdict(panel) {
    const verdictId = panel.defense.verdict.id;
    const draft = corrections[verdictId] || {};
    return run(() => api.correctDefenseVerdict(verdictId, { result: draft.result || panel.verdict_options?.[0]?.value, reason: draft.reason || "" }));
  }

  const setDraft = (scheduleId, patch) => setDrafts((current) => ({ ...current, [scheduleId]: { ...(current[scheduleId] || {}), ...patch } }));
  const setCorrection = (verdictId, patch) => setCorrections((current) => ({ ...current, [verdictId]: { ...(current[verdictId] || {}), ...patch } }));

  return <>
    {notice && <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800"><CheckCircle2 className="h-4 w-4" />{notice}</div>}
    <Card className="p-6">
      <SectionTitle title="Adviser paper signatures" subtitle="Review and sign the exact manuscript version uploaded by your assigned advisees" icon={FileSignature} />
      {!papers.length ? <EmptyState icon={FileSignature} title="No adviser documents yet" hint="Proposal manuscripts, proposal/final endorsements, and final manuscripts appear here after an assigned advisee uploads them." /> : <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
        <div className="space-y-2">{papers.map((paper) => <button key={paper.id} type="button" disabled={Boolean(paper.approval)} onClick={() => setSelectedPaper(paper)} className={`w-full rounded-xl border p-4 text-left transition-colors ${selectedPaper?.id === paper.id ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white hover:bg-slate-50"} disabled:cursor-default`}><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-ink">{paper.student.name}</p><p className="text-xs text-slate-500">{paper.document_type} · {paper.gate}</p></div><StatusBadge value={paper.approval?.status || "Needs signature"} dot={false} /></div><p className="mt-2 text-sm text-slate-700">{paper.name}</p><div className="mt-2 flex flex-wrap items-center gap-3"><a href={paper.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"><Eye className="h-3.5 w-3.5" />Open document</a><span className="text-xs text-slate-400">Uploaded {formatDate(paper.uploaded_at)}</span></div>{paper.approval && <p className="mt-2 text-xs font-semibold text-emerald-700">Signed by {paper.approval.adviser_name} · {new Date(paper.approval.signed_at).toLocaleString()}</p>}</button>)}</div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">{selectedPaper ? <><p className="text-sm font-semibold text-ink">Sign {selectedPaper.name}</p><p className="mb-3 mt-1 text-xs text-slate-500">Student: {selectedPaper.student.name}. Review the file before signing this exact version.</p><SignaturePad resetKey={selectedPaper.id} onChange={setSignature} ariaLabel="Faculty adviser signature canvas" /><button type="button" onClick={signPaper} disabled={busy || !signature} className="btn-primary mt-4 w-full cursor-pointer"><FileSignature className="h-4 w-4" />{busy ? "Saving signature..." : "Sign this document"}</button></> : <EmptyState icon={FileSignature} title="Choose a pending document" hint="Select an unsigned document to review and sign it." />}</div>
      </div>}
    </Card>

    {revisionReviews.length > 0 && <Card className="p-6">
      <SectionTitle title="Revisions to confirm" subtitle="After a pass with minor revisions the student submits the revised manuscript; you confirm it and the stage completes" icon={CheckCircle2} />
      <div className="mt-4 space-y-3">{revisionReviews.map((verdict) => <div key={verdict.id} className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-ink">{verdict.student.name}</p><p className="text-xs text-slate-500">{verdict.defense_type} · {verdict.label}</p></div><StatusBadge value={verdict.revision_status || "Awaiting revisions"} dot={false} /></div>
        {verdict.remarks && <p className="mt-2 text-sm text-slate-700">Panel remarks: {verdict.remarks}</p>}
        {verdict.revision_note && <p className="mt-2 text-sm text-slate-700">Student note: {verdict.revision_note}</p>}
        {verdict.revision_status === "Revisions submitted"
          ? <button type="button" disabled={busy} onClick={() => run(() => api.confirmDefenseRevisions(verdict.id))} className="btn-primary mt-3 cursor-pointer"><CheckCircle2 className="h-4 w-4" />Confirm the revisions</button>
          : <p className="mt-2 text-xs text-slate-500">Waiting for the student to submit the revised manuscript.</p>}
      </div>)}</div>
    </Card>}

    <Card className="p-6">
      <SectionTitle title="Panel papers and defense verdicts" subtitle="Documents and verdict actions are limited to your assigned panel records" icon={Users} />
      {!panels.length ? <EmptyState icon={Users} title="No panel assignments" hint="Assigned student papers and chair actions will appear here." /> : <div className="mt-4 space-y-4">{panels.map((panel) => {
        const scheduleId = panel.defense?.id;
        const draft = drafts[scheduleId] || {};
        const options = panel.verdict_options || [];
        const chosen = options.find((option) => option.value === (draft.result || options[0]?.value));
        const verdict = panel.defense?.verdict;
        const correction = corrections[verdict?.id] || {};
        return <article key={`${panel.student.id}-${panel.gate}-${panel.panel_role}`} className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-ink">{panel.student.name}</p><p className="text-xs text-slate-500">{panel.student.program_code} · {panel.gate}</p></div><StatusBadge value={panel.panel_role} dot={false} /></div>
          <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-600"><BookOpen className="mt-0.5 h-4 w-4 shrink-0" />{panel.research_title || "Research title pending"}</p>
          <div className="mt-3 rounded-lg bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Current-stage papers</p>{panel.documents?.length ? <div className="mt-2 flex flex-wrap gap-2">{panel.documents.map((document) => <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="btn-ghost cursor-pointer px-3 py-2 text-xs"><Eye className="h-3.5 w-3.5" />{document.document_type}: {document.name}</a>)}</div> : <p className="mt-1 text-xs text-slate-500">No uploaded papers for this assigned stage.</p>}</div>
          {panel.defense && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-brand-800"><CalendarClock className="h-4 w-4" /><span className="font-semibold">{panel.defense.defense_type} · {formatDate(panel.defense.preferred_date)} {panel.defense.start_time || ""}</span><StatusBadge value={panel.defense.display_status || panel.defense.status} dot={false} /></div>}
          {verdict && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-sm font-semibold text-emerald-800">Verdict: {verdict.label || verdict.result}{verdict.selected_title ? ` · ${verdict.selected_title}` : ""}</p>
            <p className="mt-1 text-xs text-emerald-700">Submitted by {verdict.chair_name} · {new Date(verdict.submitted_at).toLocaleString()}{verdict.revision_status ? ` · ${verdict.revision_status}` : ""}</p>
            {verdict.follow_up && <p className="mt-1 text-xs text-emerald-700">{verdict.follow_up}</p>}
            {verdict.remarks && <p className="mt-2 text-sm text-slate-700">{verdict.remarks}</p>}
            {verdict.correction_reason && <p className="mt-2 text-xs text-slate-600">Corrected from {verdict.original_result}: {verdict.correction_reason}</p>}
          </div>}
          {panel.can_confirm_revisions && <button type="button" disabled={busy} onClick={() => run(() => api.confirmDefenseRevisions(verdict.id))} className="btn-primary mt-3 cursor-pointer"><CheckCircle2 className="h-4 w-4" />Confirm the panel's approval of the revisions</button>}
          {panel.can_correct_verdict && verdict && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-ink">Entered the wrong verdict?</p>
            <p className="mt-1 text-xs text-slate-600">You can correct it until the student or staff act on it. The reason is recorded.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label><span className="field-label">Correct verdict</span><select className="field-input cursor-pointer" value={correction.result || options[0]?.value || ""} onChange={(event) => setCorrection(verdict.id, { result: event.target.value })}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label><span className="field-label">Reason for the correction</span><input className="field-input" value={correction.reason || ""} onChange={(event) => setCorrection(verdict.id, { reason: event.target.value })} placeholder="Required" /></label>
            </div>
            <button type="button" disabled={busy || !(correction.reason || "").trim()} onClick={() => correctVerdict(panel)} className="btn-ghost mt-3 cursor-pointer">Correct the verdict</button>
          </div>}
          {panel.verdict_blocked_reason && <p className="mt-3 text-xs font-semibold text-amber-700">{panel.verdict_blocked_reason}</p>}
          {panel.can_submit_verdict && <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
            <div className="flex items-center gap-2"><Gavel className="h-4 w-4 text-brand-700" /><p className="text-sm font-semibold text-ink">Submit panel chair verdict</p></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label><span className="field-label">Verdict result</span><select className="field-input cursor-pointer" value={draft.result || options[0]?.value || ""} onChange={(event) => setDraft(scheduleId, { result: event.target.value })}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{chosen?.summary && <span className="mt-1 block text-xs text-slate-500">{chosen.summary}</span>}</label>
              <label><span className="field-label">Remarks or conditions</span><textarea className="field-input min-h-24" value={draft.remarks || ""} onChange={(event) => setDraft(scheduleId, { remarks: event.target.value })} placeholder="Optional conditions, revisions, or notes" /></label>
              {panel.gate === TITLE_GATE && (draft.result || options[0]?.value) === "Passed" && <label className="sm:col-span-2"><span className="field-label">Title selected by the panel (from the three submitted)</span><input className="field-input" value={draft.selected_title || ""} onChange={(event) => setDraft(scheduleId, { selected_title: event.target.value })} placeholder="Recorded as the title of the study" /></label>}
              {panel.gate === FINAL_GATE && <label><span className="field-label">Evaluation score (Form 7, optional)</span><input className="field-input" type="number" min="0" max="100" step="0.01" value={draft.evaluation_score || ""} onChange={(event) => setDraft(scheduleId, { evaluation_score: event.target.value })} placeholder="Below 85 thesis / 90 dissertation cannot be a pass" /></label>}
            </div>
            <button type="button" onClick={() => submitVerdict(panel)} disabled={busy} className="btn-primary mt-3 cursor-pointer"><Gavel className="h-4 w-4" />{busy ? "Submitting..." : "Submit final verdict"}</button>
            <p className="mt-2 text-xs text-brand-800">Tied to defense schedule #{panel.defense.id}. GS staff have read-only access.</p>
          </div>}
        </article>;
      })}</div>}
    </Card>
  </>;
}
