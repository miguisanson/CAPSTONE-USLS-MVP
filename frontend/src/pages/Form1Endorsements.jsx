import { useEffect, useState } from "react";
import { CheckCircle2, Eye, FileSignature, PenLine } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Button, Card, DecisionPanel, EmptyState, InlineNotice, PageHeader, SectionTitle, Spinner, StatusChip } from "../components/ui/index.js";
import { formatDate } from "../lib/format";
import { toneOf } from "../lib/tone";
import SignaturePad from "../components/SignaturePad";

const INTRO = "Review the student's uploaded Form 1 and details before endorsing. The endorsement immediately updates Research Gate progress.";
const SUBTITLE = "Academic Coordinator review and in-system signature queue";

function Fact({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3.5 py-3">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

export function Form1EndorsementQueue({ embedded = false }) {
  const { data, loading, error, refetch } = useApi(() => api.form1Endorsements(), []);
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [message, setMessage] = useState("");
  const [finalizedSignature, setFinalizedSignature] = useState("");

  const items = data?.items || [];
  const selected = items.find((item) => item.student.id === selectedId) || null;

  useEffect(() => {
    if (!selectedId && items.length) {
      const next = items.find((item) => !item.endorsement) || items[0];
      setSelectedId(next.student.id);
    }
  }, [items, selectedId]);

  // The drawing canvas lives inside <SignaturePad>. It clears itself (and reports "" through onChange) when
  // resetKey - the selected student - changes; this page only keeps the finalized signature it hands back.

  async function endorse() {
    if (!selected) return;
    if (!finalizedSignature) {
      setSubmitError("Finalize the drawn signature before endorsing Form 1.");
      return;
    }
    setBusy(true);
    setSubmitError("");
    setMessage("");
    try {
      const result = await api.endorseForm1(selected.student.id, {
        signature_data: finalizedSignature,
      });
      setMessage(result.message);
      setFinalizedSignature("");
      setSubmitError("");
      await refetch();
    } catch (err) {
      setSubmitError(err.message || "Could not endorse Form 1.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Loading Form 1 endorsement queue..." />;

  const problem = error || submitError;

  return (
    <div className={embedded ? "page-stack" : "page-stack animate-fade-up"}>
      {embedded ? (
        <div>
          <SectionTitle title="Form 1 Endorsements" subtitle={SUBTITLE} icon={FileSignature} />
          <p className="text-sm text-slate-600">{INTRO}</p>
        </div>
      ) : (
        <>
          <PageHeader title="Form 1 Endorsements" description={SUBTITLE} icon={FileSignature} />
          <p className="text-sm text-slate-600">{INTRO}</p>
        </>
      )}
      {problem && <InlineNotice tone="danger">{problem}</InlineNotice>}
      {message && <InlineNotice tone="success" icon={CheckCircle2}>{message}</InlineNotice>}

      {!items.length ? (
        <Card pad="lg"><EmptyState icon={FileSignature} title="No Form 1 submissions yet" hint="Students appear here after uploading Form 1 in Research Gate." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card pad="none" className="overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3"><p className="text-sm font-semibold text-ink">Waiting and endorsed</p><p className="meta">{items.filter((item) => !item.endorsement).length} waiting</p></div>
            <div className="max-h-[680px] overflow-y-auto">
              {items.map((item) => (
                <button key={item.student.id} type="button" onClick={() => { setSelectedId(item.student.id); setMessage(""); setSubmitError(""); }} className={`w-full cursor-pointer border-b border-slate-100 px-4 py-3 text-left transition-colors duration-200 max-sm:min-h-11 ${selectedId === item.student.id ? "bg-brand-50" : "bg-white hover:bg-slate-50"}`}>
                  <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-ink">{item.student.name}</p><p className="meta">{item.student.student_number} · {item.student.program_code}</p></div><StatusChip status={item.endorsement?.status || "Waiting"} dot={false} /></div>
                  <p className="meta mt-1 line-clamp-2">{item.research_title}</p>
                </button>
              ))}
            </div>
          </Card>

          {selected && <Card pad="lg">
            <SectionTitle title={selected.student.name} subtitle={`${selected.student.student_number} · ${selected.student.program_name}`} icon={PenLine} />
            <div className="grid gap-3 sm:grid-cols-2">
              {[["Research title", selected.research_title], ["Adviser", selected.student.adviser_name || "Not assigned"], ["Current stage", selected.current_stage], ["Uploaded", formatDate(selected.form.updated_at)]].map(([label, value]) => <Fact key={label} label={label} value={value} />)}
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-ink">Uploaded Form 1</p>
              <div className="mt-2 flex flex-wrap gap-2">{selected.form.files.map((file) => <Button key={file.id} as="a" variant="secondary" icon={Eye} href={file.url} target="_blank" rel="noreferrer">{file.name}</Button>)}</div>
            </div>

            {selected.endorsement ? (
              <div className={`mt-4 rounded-xl border p-4 ${toneOf("success").notice}`}><p className="text-sm font-semibold">Endorsed by {selected.endorsement.coordinator_name}</p><p className="mt-1 text-xs">{new Date(selected.endorsement.endorsed_at).toLocaleString()} · Drawn signature saved</p>{selected.endorsement.signature_data && <img src={selected.endorsement.signature_data} alt="Academic Coordinator signature" className="mt-3 h-16 max-w-full object-contain object-left" />}</div>
            ) : (
              <DecisionPanel
                variant="plain"
                className="mt-4"
                withComment={false}
                busy={busy}
                onDecide={endorse}
                actions={[{
                  key: "endorse",
                  label: "Endorse and sign Form 1",
                  tone: "approve",
                  disabled: !finalizedSignature,
                  hint: "Draw the signature and finalize it first.",
                }]}
              >
                <section aria-labelledby="signature-canvas-label">
                  <p id="signature-canvas-label" className="field-label">Draw signature</p>
                  <SignaturePad resetKey={selectedId} onChange={setFinalizedSignature} ariaLabel="Academic Coordinator signature canvas" />
                </section>
              </DecisionPanel>
            )}
          </Card>}
        </div>
      )}
    </div>
  );
}

export default function Form1Endorsements() {
  return <Form1EndorsementQueue />;
}
