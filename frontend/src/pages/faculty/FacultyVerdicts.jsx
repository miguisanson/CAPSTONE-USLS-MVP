import { useMemo, useState } from "react";
import { BookOpen, CalendarClock, CheckCircle2, Eye, Gavel, Hourglass, History } from "lucide-react";
import { api } from "../../api";
import { Button, Card, EmptyState, Field, Input, InlineNotice, SectionTitle, Select, StatusChip, Textarea } from "../../components/ui/index.js";
import { formatDate } from "../../lib/format";

// The Verdicts page (I-090). Three groups, most urgent first:
//   1. "Needs your verdict"   - defenses where this member can record the verdict (with the papers and the form)
//   2. "Waiting on others"    - a defense is set but the chair or lead has not recorded a verdict (only when there are any)
//   3. "Verdict history"      - finished verdicts, newest first, the first five open, the rest behind "Show all"
// Verdict words, follow-ups and who acts next come from the API (`verdict_options` per panel); nothing is hard-coded.
const TITLE_GATE = "Form 1 - Title Defense";
const FINAL_GATE = "Final Defense";
const HISTORY_OPEN = 5;

const whenOf = (panel) => `${panel.defense.preferred_date || ""}T${panel.defense.start_time || "00:00"}`;
const panelKey = (panel) => `${panel.student.id}-${panel.gate}-${panel.panel_role}`;

function PanelHeader({ panel }) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">{panel.student.name}</p>
          <p className="meta">{panel.student.program_code} · {panel.gate}</p>
        </div>
        <StatusChip status={panel.panel_role} dot={false} />
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-600">
        <BookOpen className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {panel.research_title || "Research title pending"}
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-brand-800">
        <CalendarClock className="h-4 w-4" aria-hidden="true" />
        <span className="font-semibold">
          {panel.defense.defense_type} · <time dateTime={whenOf(panel)}>{formatDate(panel.defense.preferred_date)} {panel.defense.start_time || ""}</time>
        </span>
        <StatusChip status={panel.defense.display_status || panel.defense.status} dot={false} />
      </p>
    </>
  );
}

function Papers({ panel }) {
  return (
    <div className="mt-3 rounded-lg bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Current-stage papers</p>
      {panel.documents?.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {panel.documents.map((document) => (
            <Button key={document.id} as="a" variant="secondary" size="sm" icon={Eye} href={document.url} target="_blank" rel="noreferrer">
              {document.document_type}: {document.name}
            </Button>
          ))}
        </div>
      ) : (
        <p className="meta mt-1">No uploaded papers for this assigned stage.</p>
      )}
    </div>
  );
}

function VerdictResult({ verdict }) {
  return (
    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <p className="text-sm font-semibold text-emerald-800">Verdict: {verdict.label || verdict.result}{verdict.selected_title ? ` · ${verdict.selected_title}` : ""}</p>
      <p className="mt-1 text-xs text-emerald-700">
        Submitted by {verdict.chair_name} · {new Date(verdict.submitted_at).toLocaleString()}{verdict.revision_status ? ` · ${verdict.revision_status}` : ""}
      </p>
      {verdict.follow_up && <p className="mt-1 text-xs text-emerald-700">{verdict.follow_up}</p>}
      {verdict.remarks && <p className="mt-2 text-sm text-slate-700">{verdict.remarks}</p>}
      {verdict.correction_reason && <p className="mt-2 text-xs text-slate-600">Corrected from {verdict.original_result}: {verdict.correction_reason}</p>}
    </div>
  );
}

export default function FacultyVerdicts({ panels = [], refetch }) {
  const [drafts, setDrafts] = useState({});
  const [corrections, setCorrections] = useState({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [showAll, setShowAll] = useState(false);

  const { needs, waiting, history } = useMemo(() => {
    const withDefense = panels.filter((panel) => panel.defense);
    const newestFirst = (left, right) => whenOf(right).localeCompare(whenOf(left));
    return {
      needs: withDefense.filter((panel) => panel.can_submit_verdict).sort(newestFirst),
      waiting: withDefense.filter((panel) => !panel.can_submit_verdict && !panel.defense.verdict).sort(newestFirst),
      history: withDefense.filter((panel) => !panel.can_submit_verdict && panel.defense.verdict).sort(newestFirst),
    };
  }, [panels]);
  const shownHistory = showAll ? history : history.slice(0, HISTORY_OPEN);

  async function run(action) {
    setBusy(true);
    setNotice("");
    try {
      const result = await action();
      setNotice(result?.message || "");
      await refetch();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  const setDraft = (scheduleId, patch) => setDrafts((current) => ({ ...current, [scheduleId]: { ...(current[scheduleId] || {}), ...patch } }));
  const setCorrection = (verdictId, patch) => setCorrections((current) => ({ ...current, [verdictId]: { ...(current[verdictId] || {}), ...patch } }));

  function submitVerdict(panel) {
    const draft = drafts[panel.defense.id] || {};
    return run(() =>
      api.submitDefenseVerdict(panel.defense.id, {
        result: draft.result || panel.verdict_options?.[0]?.value || "Passed",
        remarks: draft.remarks || "",
        selected_title: draft.selected_title || "",
        evaluation_score: draft.evaluation_score || "",
      }),
    );
  }

  function correctVerdict(panel) {
    const verdictId = panel.defense.verdict.id;
    const draft = corrections[verdictId] || {};
    return run(() => api.correctDefenseVerdict(verdictId, { result: draft.result || panel.verdict_options?.[0]?.value, reason: draft.reason || "" }));
  }

  function submitForm(panel) {
    const scheduleId = panel.defense.id;
    const draft = drafts[scheduleId] || {};
    const options = panel.verdict_options || [];
    const result = draft.result || options[0]?.value || "";
    const chosen = options.find((option) => option.value === result);
    return (
      <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
        <div className="flex items-center gap-2">
          <Gavel className="h-4 w-4 text-brand-700" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink">Submit panel chair verdict</p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Verdict result" hint={chosen?.summary}>
            <Select placeholder={null} options={options} value={result} onChange={(event) => setDraft(scheduleId, { result: event.target.value })} />
          </Field>
          <Field label="Remarks or conditions">
            <Textarea rows={3} value={draft.remarks || ""} onChange={(event) => setDraft(scheduleId, { remarks: event.target.value })} placeholder="Optional conditions, revisions, or notes" />
          </Field>
          {panel.gate === TITLE_GATE && result === "Passed" && (
            <div className="sm:col-span-2">
              <Field label="Title selected by the panel (from the three submitted)">
                <Input value={draft.selected_title || ""} onChange={(event) => setDraft(scheduleId, { selected_title: event.target.value })} placeholder="Recorded as the title of the study" />
              </Field>
            </div>
          )}
          {panel.gate === FINAL_GATE && (
            <Field label="Evaluation score (Form 7, optional)">
              <Input type="number" min="0" max="100" step="0.01" value={draft.evaluation_score || ""} onChange={(event) => setDraft(scheduleId, { evaluation_score: event.target.value })} placeholder="Below 85 thesis / 90 dissertation cannot be a pass" />
            </Field>
          )}
        </div>
        <Button icon={Gavel} className="mt-3" disabled={busy} onClick={() => submitVerdict(panel)}>{busy ? "Submitting..." : "Submit final verdict"}</Button>
        <p className="mt-2 text-xs text-brand-800">Tied to defense schedule #{scheduleId}. GS staff have read-only access.</p>
      </div>
    );
  }

  function correctionForm(panel) {
    const verdict = panel.defense.verdict;
    const options = panel.verdict_options || [];
    const correction = corrections[verdict.id] || {};
    return (
      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-ink">Entered the wrong verdict?</p>
        <p className="mt-1 text-xs text-slate-600">You can correct it until the student or staff act on it. The reason is recorded.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Correct verdict">
            <Select placeholder={null} options={options} value={correction.result || options[0]?.value || ""} onChange={(event) => setCorrection(verdict.id, { result: event.target.value })} />
          </Field>
          <Field label="Reason for the correction" required>
            <Input value={correction.reason || ""} onChange={(event) => setCorrection(verdict.id, { reason: event.target.value })} placeholder="Required" />
          </Field>
        </div>
        <Button variant="secondary" className="mt-3" disabled={busy || !(correction.reason || "").trim()} onClick={() => correctVerdict(panel)}>Correct the verdict</Button>
      </div>
    );
  }

  const card = (panel, { papers = false } = {}) => {
    const verdict = panel.defense.verdict;
    return (
      <article key={panelKey(panel)} className="rounded-xl border border-slate-200 p-4">
        <PanelHeader panel={panel} />
        {papers && <Papers panel={panel} />}
        {verdict && <VerdictResult verdict={verdict} />}
        {panel.can_confirm_revisions && verdict && (
          <Button icon={CheckCircle2} className="mt-3" disabled={busy} onClick={() => run(() => api.confirmDefenseRevisions(verdict.id))}>
            Confirm the panel&apos;s approval of the revisions
          </Button>
        )}
        {panel.can_correct_verdict && verdict && correctionForm(panel)}
        {panel.verdict_blocked_reason && <p className="mt-3 text-xs font-semibold text-amber-700">{panel.verdict_blocked_reason}</p>}
        {panel.can_submit_verdict && submitForm(panel)}
      </article>
    );
  };

  return (
    <div className="space-y-5">
      {notice && <InlineNotice tone="success" icon={CheckCircle2}>{notice}</InlineNotice>}

      <section aria-label="Needs your verdict">
        <Card>
          <SectionTitle title="Needs your verdict" subtitle="Defenses where you are the panel chair or lead and no verdict is recorded yet" icon={Gavel} />
          {needs.length ? (
            <div className="space-y-4">{needs.map((panel) => card(panel, { papers: true }))}</div>
          ) : (
            <EmptyState size="sm" icon={CheckCircle2} title="No verdicts are waiting for you" hint="A verdict form appears here once a defense is scheduled for a panel you chair." />
          )}
        </Card>
      </section>

      {waiting.length > 0 && (
        <section aria-label="Waiting on others">
          <Card>
            <SectionTitle title="Waiting on others" subtitle="A defense is set, but the chair or lead has not recorded the verdict. Nothing to do yet." icon={Hourglass} />
            <div className="space-y-4">{waiting.map((panel) => card(panel))}</div>
          </Card>
        </section>
      )}

      <section aria-label="Verdict history">
        <Card>
          <SectionTitle
            title="Verdict history"
            subtitle="Finished verdicts for the panels you sit on, newest first. GS staff have read-only access."
            icon={History}
          />
          {history.length ? (
            <div className="space-y-4">
              {shownHistory.map((panel) => card(panel))}
              {history.length > HISTORY_OPEN && (
                <Button variant="secondary" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
                  {showAll ? "Show fewer" : `Show all ${history.length} verdicts`}
                </Button>
              )}
            </div>
          ) : (
            <EmptyState size="sm" icon={History} title="No finished verdicts yet" hint="Verdicts appear here once a panel chair records one." />
          )}
        </Card>
      </section>
    </div>
  );
}
