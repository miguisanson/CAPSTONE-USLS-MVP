import { useEffect, useState } from "react";
import {
  FileUp,
  Eye,
  Lock,
  Trash2,
} from "lucide-react";
import { api } from "../../api";
import { StatusBadge } from "../../components/ui";
import { useConfirm } from "../../components/confirm";
import { Field, Input, Select, Textarea } from "../../components/forms";
import { useSubmitRequest, SubmitState, isLiveSchedule } from "./shared";

export function ResearchRequestForm({ data, onSaved }) {
  const progress = data.research_progress || {};
  const milestone = progress.milestone || {};
  const gate = progress.gate || milestone.value || "";
  // Treat the backend placeholder as empty, and never overwrite a title the student
  // has typed or that was auto-filled from Form 1. A data refresh after each upload
  // must not wipe it — otherwise submitting fails with "Enter the research title".
  const PENDING_TITLE = "Research title pending Form 1 submission";
  const savedTitle = data.research_case?.title && data.research_case.title !== PENDING_TITLE ? data.research_case.title : "";
  const [form, setForm] = useState({ research_title: savedTitle, submitted_package: "" });
  const { busy, error, message, submit } = useSubmitRequest("research-gate", onSaved);
  const [prefillNote, setPrefillNote] = useState("");
  const uploadRequirements = (milestone.requirements || []).filter((item) => item.student_upload);
  const managedRequirements = (milestone.requirements || []).filter((item) => !item.student_upload);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      research_title: current.research_title && current.research_title !== PENDING_TITLE ? current.research_title : savedTitle,
    }));
  }, [data.student.id, savedTitle]);

  function set(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function onSubmit(e) {
    e.preventDefault();
    submit({
      student_id: data.student.id,
      research_title: form.research_title,
      submitted_package: form.submitted_package,
    });
  }

  async function handleEvidenceSaved(result, requirement) {
    if (requirement?.item_name === "Form 1 - Application for Title Defense" && result?.research_title) {
      setForm((current) => ({ ...current, research_title: result.research_title }));
      setPrefillNote(`Auto-filled from ${result.document?.evidence_reference || "the uploaded Form 1"}.`);
    }
    await onSaved();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-wide text-brand-600">Automatically detected stage</p><p className="mt-1 font-display text-xl font-semibold text-ink">{progress.stage || "Title Defense"}</p><p className="mt-1 text-xs text-slate-600">{milestone.description}</p></div><StatusBadge value={progress.status || "Pending"} dot={false} /></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-white/80 px-3 py-2"><p className="text-[11px] font-bold uppercase text-slate-400">Research title</p><p className="mt-1 text-sm font-semibold text-ink">{data.research_case?.title || "Complete Form 1 to set the title"}</p></div><div className="rounded-lg bg-white/80 px-3 py-2"><p className="text-[11px] font-bold uppercase text-slate-400">Adviser</p><p className="mt-1 text-sm font-semibold text-ink">{data.student.adviser_name || "Not assigned"}</p></div></div>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        {(progress.stages || []).map((stage, index) => <div key={stage.name} className={`rounded-lg border px-2.5 py-2 text-xs font-semibold ${index === progress.stage_index ? "border-brand-300 bg-brand-50 text-brand-700" : stage.complete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-400"}`}>{stage.name}</div>)}
      </div>
      {progress.stage === "Title Defense" && (
        <Field label="Research title from uploaded Form 1" hint="This fills automatically after the Form 1 application PDF is uploaded below.">
          <Input value={form.research_title} onChange={set("research_title")} required placeholder="Upload Form 1 below to auto-fill" />
          {prefillNote && <p className="mt-1 text-xs font-medium text-brand-700">{prefillNote}</p>}
        </Field>
      )}
      <div>
        <p className="field-label">Files you upload</p>
        <p className="mb-2 text-xs text-slate-500">Only these items require action from you for this milestone.</p>
        <div className="space-y-2">
          {uploadRequirements.map((requirement) => (
            <ResearchEvidenceUpload
              key={requirement.item_name}
              gate={gate}
              requirement={requirement}
              panelLocked={Boolean(data.panel?.length)}
              onSaved={(result) => handleEvidenceSaved(result, requirement)}
            />
          ))}
        </div>
      </div>
      {managedRequirements.length > 0 && (
        <div>
          <p className="field-label">Completed by staff or the system</p>
          <p className="mb-2 text-xs text-slate-500">These update automatically after review, panel matching, or scheduling.</p>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {managedRequirements.map((requirement) => (
              <div key={requirement.item_name} className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-3.5 py-3 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{requirement.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{requirement.description}</p>
                </div>
                <StatusBadge value={requirement.status_label} dot={false} />
              </div>
            ))}
          </div>
        </div>
      )}
      <Field label="Message to the Research Coordinator" hint="Optional context for this submission.">
        <Textarea value={form.submitted_package} onChange={set("submitted_package")} />
      </Field>
      <SubmitState
        busy={busy}
        error={error}
        message={message}
        disabled={!milestone?.student_uploads_ready || (progress.stage === "Title Defense" && !form.research_title.trim())}
        label={`Submit ${milestone?.short_label || "milestone"} for review`}
        disabledHint={!milestone?.student_uploads_ready ? "Upload all required files before submitting this milestone." : progress.stage === "Title Defense" && !form.research_title.trim() ? "Upload Form 1 so the research title can be read automatically." : ""}
      />
    </form>
  );
}

export function ResearchEvidenceUpload({ gate, requirement, panelLocked, onSaved }) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [checkingId, setCheckingId] = useState(null);
  const [error, setError] = useState("");
  const needed = requirement.required_file_count;
  const files = requirement.files || [];
  const titlePackageItem = requirement.item_name === "Form 1 - Application for Title Defense" || requirement.item_name === "Three concept papers";
  const titlePackageLocked = panelLocked && titlePackageItem;
  const replacesExistingUpload = requirement.item_name === "Ethics Clearance";

  async function upload(file) {
    if (titlePackageLocked) {
      setError("Title-defense uploads are locked because a panel has already been matched.");
      return;
    }
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.uploadResearchEvidence(gate, requirement.item_name, file);
      await onSaved(result);
    } catch (err) {
      setError(err.message || "Could not upload this evidence.");
    } finally {
      setBusy(false);
    }
  }

  async function removeResearchFile(file) {
    if (titlePackageLocked) return;
    const confirmed = await confirm({
      title: "Remove file?",
      message: `Remove "${file.name}"? This will clear the current Panel Matching result for this stage.`,
      confirmLabel: "Remove file",
      tone: "danger",
    });
    if (!confirmed) return;
    setRemovingId(file.id);
    setError("");
    try {
      await api.deleteResearchEvidence(file.id);
      await onSaved();
    } catch (err) {
      setError(err.message || "Could not remove this concept paper.");
    } finally {
      setRemovingId(null);
    }
  }

  async function checkConceptPaper(file) {
    setCheckingId(file.id);
    setError("");
    try {
      await api.evaluateConceptPaper(file.id);
      await onSaved();
    } catch (err) {
      setError(err.message || "Could not check concept paper compliance.");
    } finally {
      setCheckingId(null);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{requirement.label}</p>
          <p className="mt-0.5 text-xs text-slate-500">{requirement.description}</p>
          <p className="mt-1 text-xs font-medium text-slate-600">{files.length} of {needed} file{needed > 1 ? "s" : ""} uploaded</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge value={requirement.status_label} dot={false} />
          <label className={`btn-ghost ${titlePackageLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
          {titlePackageLocked ? <Lock className="h-4 w-4" /> : <FileUp className="h-4 w-4" />} {titlePackageLocked ? "Locked after panel match" : busy ? "Uploading..." : replacesExistingUpload && files.length ? "Replace PDF" : files.length >= needed ? "Add another" : "Upload PDF"}
          <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={busy || titlePackageLocked} onChange={(e) => upload(e.target.files?.[0])} />
          </label>
        </div>
      </div>
      {files.length > 0 && (
        <div className="mt-2 space-y-2">
          {files.map((file) => (
            <div key={file.id} className="rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
                  <a href={file.url} target="_blank" rel="noreferrer" className="inline-flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50">
                    {file.name}<Eye className="h-3.5 w-3.5" />
                  </a>
                  {requirement.student_upload && (
                    <button type="button" onClick={() => removeResearchFile(file)} disabled={titlePackageLocked || removingId === file.id} className="inline-flex cursor-pointer items-center border-l border-slate-200 px-2 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Remove ${file.name}`} title={titlePackageLocked ? "Locked after panel matching" : "Remove upload"}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
                {file.compliance_status && (
                  <div className="flex items-center gap-2">
                    <StatusBadge value={file.compliance_status} dot={false} />
                    {Number.isFinite(file.compliance_score) && <span className="text-xs font-semibold text-slate-500">{file.compliance_score}%</span>}
                  </div>
                )}
                {requirement.item_name === "Three concept papers" && (
                  <button type="button" onClick={() => checkConceptPaper(file)} disabled={checkingId === file.id} className="btn-ghost cursor-pointer px-2.5 py-1.5 text-xs">
                    {checkingId === file.id ? "Checking..." : file.compliance_status ? "Recheck" : "Check compliance"}
                  </button>
                )}
              </div>
              {file.compliance && <ConceptPaperCompliance compliance={file.compliance} />}
            </div>
          ))}
        </div>
      )}
      {titlePackageItem && files.length > 0 && <p className={`mt-2 text-xs ${titlePackageLocked ? "font-semibold text-brand-700" : "text-slate-500"}`}>{titlePackageLocked ? "This title-defense package is read-only because a panel has already been matched." : "Removing Form 1 or any concept paper revokes the Academic Coordinator endorsement and clears Panel Matching. The complete title-defense package must be endorsed again."}</p>}
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

export function ConceptPaperCompliance({ compliance }) {
  const checks = compliance.checks || [];
  const citations = compliance.citations || [];
  return (
    <details className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
      <summary className="cursor-pointer font-semibold text-slate-700">
        {compliance.summary || "View concept paper compliance check"}
      </summary>
      <div className="mt-2 space-y-2">
        {checks.length > 0 && (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {checks.map((check) => (
              <div key={check.id} className="rounded-md border border-slate-100 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700">{check.label}</span>
                  <StatusBadge value={check.status} dot={false} />
                </div>
                {check.evidence && <p className="mt-1 text-slate-500">{check.evidence}</p>}
              </div>
            ))}
          </div>
        )}
        {citations.length > 0 && (
          <div>
            <p className="font-bold uppercase tracking-wide text-slate-400">Sources</p>
            <div className="mt-1 space-y-1">
              {citations.slice(0, 3).map((citation) => (
                <p key={citation.id} className="rounded-md bg-slate-50 px-2 py-1.5 text-slate-500">
                  <span className="font-semibold text-slate-700">{citation.source}</span>: {citation.text}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

const BOOKABLE_DEFENSES = ["Title Defense", "Proposal Defense", "Final Defense"];

// After a verdict that asks for revisions: send the revised manuscript (and a note) for confirmation.
function RevisionSubmitForm({ followUp, onSaved }) {
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const verdictId = followUp.verdict?.id;

  async function onSubmit(e) {
    e.preventDefault();
    if (!note.trim() && !file) {
      setError("Attach the revised manuscript or describe what you revised.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await api.submitDefenseRevisions(verdictId, { note: note.trim(), file });
      setMessage(res.message || "Your revisions were sent.");
      setNote("");
      setFile(null);
      onSaved();
    } catch (err) {
      setError(err.message || "Could not send your revisions.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4" aria-label="Submit revised manuscript">
      <div>
        <h3 className="text-sm font-semibold text-ink">Submit revised manuscript</h3>
        {followUp.label && <p className="mt-1 text-xs font-semibold text-amber-900">Defense outcome: {followUp.label}</p>}
        {followUp.summary && <p className="mt-1 text-xs leading-relaxed text-slate-600">{followUp.summary}</p>}
        {followUp.confirmed_by_role && (
          <p className="mt-1 text-xs text-slate-600">Your {followUp.confirmed_by_role} confirms the revisions. Only after that can you move to the next stage.</p>
        )}
      </div>
      <Field label="What you revised" hint="Optional when you attach the manuscript.">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Field label="Revised manuscript" hint="Optional when you describe the revisions above.">
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-600 focus-within:ring-2 focus-within:ring-brand-500 hover:bg-slate-50">
          <span className="flex min-w-0 items-center gap-2">
            <FileUp className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
            <span className="truncate">{file?.name || "Choose file"}</span>
          </span>
          <span className="shrink-0 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">Browse</span>
          <input type="file" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
      </Field>
      <SubmitState busy={busy} error={error} message={message} label="Send revisions" disabled={!verdictId} />
    </form>
  );
}

export function ScheduleRequestForm({ data, onSaved }) {
  const studentId = data.student.id;
  const stage = data.research_progress?.stage;
  const schedules = data.schedules || [];
  const liveSchedule = schedules.find(isLiveSchedule) || null;
  const followUp = data.defense_follow_up;
  const [form, setForm] = useState({
    preferred_date: "",
    defense_type: BOOKABLE_DEFENSES.includes(stage) ? stage : BOOKABLE_DEFENSES[0],
    mode: "On-site",
    venue: "",
    constraints: "",
  });
  const { busy, error, message, submit } = useSubmitRequest("defense-scheduling", onSaved);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function onSubmit(e) {
    e.preventDefault();
    if (liveSchedule) return;
    submit({ student_id: studentId, ...form });
  }

  return (
    <div className="space-y-5">
      {followUp?.can_submit_revisions && <RevisionSubmitForm followUp={followUp} onSaved={onSaved} />}
      {liveSchedule && (
        <div role="status" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <p className="font-semibold">A defense is already booked, so you cannot send another request.</p>
          <p className="mt-1 text-xs">Your {liveSchedule.defense_type || "defense"} is {liveSchedule.status === "Needs Re-confirmation" ? "waiting for the Research Coordinator to confirm it again" : "scheduled"}. To change it, ask the Research Coordinator.</p>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <fieldset disabled={Boolean(liveSchedule)} className="space-y-4 disabled:opacity-60">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Preferred date" required>
              <Input type="date" value={form.preferred_date} onChange={set("preferred_date")} required />
            </Field>
            <Field label="Defense type" required hint={stage && BOOKABLE_DEFENSES.includes(stage) ? `Your current stage is ${stage}.` : undefined}>
              <Select value={form.defense_type} onChange={set("defense_type")} placeholder="" options={BOOKABLE_DEFENSES} />
            </Field>
            <Field label="Mode">
              <Select value={form.mode} onChange={set("mode")} placeholder="" options={["On-site", "Online", "Hybrid"]} />
            </Field>
            <Field label="Venue / meeting link">
              <Input value={form.venue} onChange={set("venue")} />
            </Field>
          </div>
          <Field label="Scheduling constraints">
            <Textarea value={form.constraints} onChange={set("constraints")} />
          </Field>
        </fieldset>
        <SubmitState
          busy={busy}
          error={error}
          message={message}
          label="Submit schedule request"
          disabled={Boolean(liveSchedule)}
          disabledHint={liveSchedule ? "New requests are closed while a defense is booked." : ""}
        />
      </form>
    </div>
  );
}
