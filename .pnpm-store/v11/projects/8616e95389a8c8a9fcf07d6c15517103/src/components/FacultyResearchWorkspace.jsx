import { useMemo, useState } from "react";
import { BookOpen, CalendarClock, CheckCircle2, Eye, FileSignature, Gavel, Users } from "lucide-react";
import { api } from "../api";
import { Card, EmptyState, SectionTitle, StatusBadge } from "./ui";
import { formatDate } from "../lib/format";
import SignaturePad from "./SignaturePad";

export default function FacultyResearchWorkspace({ advisees = [], panels = [], refetch }) {
  const papers = useMemo(() => advisees.flatMap((row) => row.documents.map((document) => ({ ...document, student: row.student }))), [advisees]);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [signature, setSignature] = useState("");
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function signPaper() {
    if (!selectedPaper || !signature) return;
    setBusy(true); setNotice("");
    try {
      const result = await api.signAdviserPaper(selectedPaper.id, { signature_data: signature });
      setNotice(result.message); setSelectedPaper(null); setSignature("");
      await refetch();
    } catch (err) { setNotice(err.message); } finally { setBusy(false); }
  }

  async function submitVerdict(panel) {
    const scheduleId = panel.defense.id;
    setBusy(true); setNotice("");
    try {
      const result = await api.submitDefenseVerdict(scheduleId, drafts[scheduleId] || { result: "Passed", remarks: "" });
      setNotice(result.message); await refetch();
    } catch (err) { setNotice(err.message); } finally { setBusy(false); }
  }

  return <>
    {notice && <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800"><CheckCircle2 className="h-4 w-4" />{notice}</div>}
    <Card className="p-6">
      <SectionTitle title="Adviser paper signatures" subtitle="Review and sign the exact manuscript version uploaded by your assigned advisees" icon={FileSignature} />
      {!papers.length ? <EmptyState icon={FileSignature} title="No adviser documents yet" hint="Proposal manuscripts, proposal/final endorsements, and final manuscripts appear here after an assigned advisee uploads them." /> : <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
        <div className="space-y-2">{papers.map((paper) => <button key={paper.id} type="button" disabled={Boolean(paper.approval)} onClick={() => setSelectedPaper(paper)} className={`w-full rounded-xl border p-4 text-left transition-colors ${selectedPaper?.id === paper.id ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white hover:bg-slate-50"} disabled:cursor-default`}><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-ink">{paper.student.name}</p><p className="text-xs text-slate-500">{paper.document_type} · {paper.gate}</p></div><StatusBadge value={paper.approval?.status || "Needs signature"} dot={false} /></div><p className="mt-2 text-sm text-slate-700">{paper.name}</p><div className="mt-2 flex flex-wrap items-center gap-3"><a href={paper.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"><Eye className="h-3.5 w-3.5" />Open document</a><span className="text-xs text-slate-400">Uploaded {formatDate(paper.uploaded_at)}</span></div>{paper.approval && <p className="mt-2 text-xs font-semibold text-emerald-700">Signed by {paper.approval.adviser_name} · {new Date(paper.approval.signed_at).toLocaleString()}</p>}</button>)}</div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">{selectedPaper ? <><p className="text-sm font-semibold text-ink">Sign {selectedPaper.name}</p><p className="mb-3 mt-1 text-xs text-slate-500">Student: {selectedPaper.student.name}. Review the file before signing this exact version.</p><SignaturePad resetKey={selectedPaper.id} onChange={setSignature} ariaLabel="Faculty adviser signature canvas" /><button type="button" onClick={signPaper} disabled={busy || !signature} className="btn-primary mt-4 w-full cursor-pointer"><FileSignature className="h-4 w-4" />{busy ? "Saving signature..." : "Sign this document"}</button></> : <EmptyState icon={FileSignature} title="Choose a pending document" hint="Select an unsigned document to review and sign it." />}</div>
      </div>}
    </Card>

    <Card className="p-6">
      <SectionTitle title="Panel papers and defense verdicts" subtitle="Documents and verdict actions are limited to your assigned panel records" icon={Users} />
      {!panels.length ? <EmptyState icon={Users} title="No panel assignments" hint="Assigned student papers and chair actions will appear here." /> : <div className="mt-4 space-y-4">{panels.map((panel) => <article key={`${panel.student.id}-${panel.gate}-${panel.panel_role}`} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-ink">{panel.student.name}</p><p className="text-xs text-slate-500">{panel.student.program_code} · {panel.gate}</p></div><StatusBadge value={panel.panel_role} dot={false} /></div><p className="mt-2 flex items-start gap-1.5 text-sm text-slate-600"><BookOpen className="mt-0.5 h-4 w-4 shrink-0" />{panel.research_title || "Research title pending"}</p><div className="mt-3 rounded-lg bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Current-stage papers</p>{panel.documents?.length ? <div className="mt-2 flex flex-wrap gap-2">{panel.documents.map((document) => <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="btn-ghost cursor-pointer px-3 py-2 text-xs"><Eye className="h-3.5 w-3.5" />{document.document_type}: {document.name}</a>)}</div> : <p className="mt-1 text-xs text-slate-500">No uploaded papers for this assigned stage.</p>}</div>{panel.defense && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-brand-800"><CalendarClock className="h-4 w-4" /><span className="font-semibold">{panel.defense.defense_type} · {formatDate(panel.defense.preferred_date)} {panel.defense.start_time || ""}</span><StatusBadge value={panel.defense.display_status || panel.defense.status} dot={false} /></div>}{panel.defense?.verdict && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="text-sm font-semibold text-emerald-800">Verdict: {panel.defense.verdict.result}</p><p className="mt-1 text-xs text-emerald-700">Submitted by {panel.defense.verdict.chair_name} · {new Date(panel.defense.verdict.submitted_at).toLocaleString()}</p>{panel.defense.verdict.remarks && <p className="mt-2 text-sm text-slate-700">{panel.defense.verdict.remarks}</p>}</div>}{panel.can_submit_verdict && <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 p-4"><div className="flex items-center gap-2"><Gavel className="h-4 w-4 text-brand-700" /><p className="text-sm font-semibold text-ink">Submit panel chair verdict</p></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><label><span className="field-label">Verdict result</span><select className="field-input cursor-pointer" value={drafts[panel.defense.id]?.result || "Passed"} onChange={(event) => setDrafts((current) => ({ ...current, [panel.defense.id]: { ...(current[panel.defense.id] || {}), result: event.target.value } }))}>{["Passed", "Passed with revisions", "Deferred", "Failed", "For resubmission"].map((value) => <option key={value}>{value}</option>)}</select></label><label><span className="field-label">Remarks or conditions</span><textarea className="field-input min-h-24" value={drafts[panel.defense.id]?.remarks || ""} onChange={(event) => setDrafts((current) => ({ ...current, [panel.defense.id]: { ...(current[panel.defense.id] || { result: "Passed" }), remarks: event.target.value } }))} placeholder="Optional conditions, revisions, or notes" /></label></div><button type="button" onClick={() => submitVerdict(panel)} disabled={busy} className="btn-primary mt-3 cursor-pointer"><Gavel className="h-4 w-4" />{busy ? "Submitting..." : "Submit final verdict"}</button><p className="mt-2 text-xs text-brand-800">Tied to defense schedule #{panel.defense.id}. GS staff have read-only access.</p></div>}</article>)}</div>}
    </Card>
  </>;
}
