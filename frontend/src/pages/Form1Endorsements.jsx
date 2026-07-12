import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, FileSignature, PenLine, RotateCcw } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, EmptyState, ErrorNote, SectionTitle, Spinner, StatusBadge } from "../components/ui";
import { formatDate } from "../lib/format";
import SignaturePad from "../components/SignaturePad";

export function Form1EndorsementQueue({ embedded = false }) {
  const { data, loading, error, refetch } = useApi(() => api.form1Endorsements(), []);
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [message, setMessage] = useState("");
  const [draftSignature, setDraftSignature] = useState("");
  const [finalizedSignature, setFinalizedSignature] = useState("");
  const [signatureNotice, setSignatureNotice] = useState("");
  const [hasDrawing, setHasDrawing] = useState(false);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const hasDrawingRef = useRef(false);

  const items = data?.items || [];
  const selected = items.find((item) => item.student.id === selectedId) || null;

  useEffect(() => {
    if (!selectedId && items.length) {
      const next = items.find((item) => !item.endorsement) || items[0];
      setSelectedId(next.student.id);
    }
  }, [items, selectedId]);

  useEffect(() => {
    drawingRef.current = false;
    hasDrawingRef.current = false;
    setDraftSignature("");
    setFinalizedSignature("");
    setSignatureNotice("");
    setHasDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  }, [selectedId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !draftSignature) return;
    const image = new Image();
    image.onload = () => {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = draftSignature;
  }, [draftSignature]);

  function point(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function startDrawing(event) {
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const p = point(event);
    drawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    canvas.setPointerCapture?.(event.pointerId);
  }

  function draw(event) {
    if (!drawingRef.current) return;
    event.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = point(event);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#172033";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!hasDrawingRef.current) {
      hasDrawingRef.current = true;
      setHasDrawing(true);
    }
  }

  function stopDrawing(event) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (hasDrawingRef.current) {
      const snapshot = canvasRef.current.toDataURL("image/png");
      setDraftSignature(snapshot);
      setFinalizedSignature("");
      setSignatureNotice("Signature captured. Select Finalize signature to lock it in.");
    }
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    hasDrawingRef.current = false;
    setHasDrawing(false);
    setDraftSignature("");
    setFinalizedSignature("");
    setSignatureNotice("");
    setSubmitError("");
  }

  function finalizeSignature() {
    if (!hasDrawingRef.current || !canvasRef.current) return;
    const snapshot = canvasRef.current.toDataURL("image/png");
    setDraftSignature(snapshot);
    setFinalizedSignature(snapshot);
    setSignatureNotice("Signature finalized and ready to submit.");
    setSubmitError("");
  }

  async function endorse() {
    if (!selected) return;
    if (draftSignature && !finalizedSignature) {
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
      clearSignature();
      await refetch();
    } catch (err) {
      setSubmitError(err.message || "Could not endorse Form 1.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Loading Form 1 endorsement queue..." />;

  const Frame = embedded ? "div" : Card;

  return (
    <div className={embedded ? "space-y-5" : "space-y-5 animate-fade-up"}>
      <Frame className={embedded ? "" : "p-6"}>
        <SectionTitle title="Form 1 Endorsements" subtitle="Academic Coordinator review and in-system signature queue" icon={FileSignature} />
        <p className="text-sm text-slate-600">Review the student's uploaded Form 1 and details before endorsing. The endorsement immediately updates Research Gate progress.</p>
      </Frame>
      <ErrorNote message={error || submitError} />
      {message && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" />{message}</div>}

      {!items.length ? (
        <Card className="p-6"><EmptyState icon={FileSignature} title="No Form 1 submissions yet" hint="Students appear here after uploading Form 1 in Research Gate." /></Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3"><p className="text-sm font-semibold text-ink">Waiting and endorsed</p><p className="text-xs text-slate-500">{items.filter((item) => !item.endorsement).length} waiting</p></div>
            <div className="max-h-[680px] overflow-y-auto">
              {items.map((item) => (
                <button key={item.student.id} type="button" onClick={() => { setSelectedId(item.student.id); setMessage(""); setSubmitError(""); }} className={`w-full cursor-pointer border-b border-slate-100 px-4 py-3 text-left transition-colors ${selectedId === item.student.id ? "bg-brand-50" : "bg-white hover:bg-slate-50"}`}>
                  <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-ink">{item.student.name}</p><p className="text-xs text-slate-500">{item.student.student_number} · {item.student.program_code}</p></div><StatusBadge value={item.endorsement?.status || "Waiting"} dot={false} /></div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.research_title}</p>
                </button>
              ))}
            </div>
          </Card>

          {selected && <Card className="p-6">
            <SectionTitle title={selected.student.name} subtitle={`${selected.student.student_number} · ${selected.student.program_name}`} icon={PenLine} />
            <div className="grid gap-3 sm:grid-cols-2">
              {[["Research title", selected.research_title], ["Adviser", selected.student.adviser_name || "Not assigned"], ["Current stage", selected.current_stage], ["Uploaded", formatDate(selected.form.updated_at)]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 px-3.5 py-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-ink">{value}</p></div>)}
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-ink">Uploaded Form 1</p>
              <div className="mt-2 flex flex-wrap gap-2">{selected.form.files.map((file) => <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="btn-ghost cursor-pointer"><Eye className="h-4 w-4" />{file.name}</a>)}</div>
            </div>

            {selected.endorsement ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-semibold text-emerald-800">Endorsed by {selected.endorsement.coordinator_name}</p><p className="mt-1 text-xs text-emerald-700">{new Date(selected.endorsement.endorsed_at).toLocaleString()} · Drawn signature saved</p>{selected.endorsement.signature_data && <img src={selected.endorsement.signature_data} alt="Academic Coordinator signature" className="mt-3 h-16 max-w-full object-contain object-left" />}</div>
            ) : (
              <div className="mt-4 space-y-4">
                <section aria-labelledby="signature-canvas-label">
                  <p id="signature-canvas-label" className="field-label">Draw signature</p>
                  <SignaturePad resetKey={selectedId} onChange={setFinalizedSignature} ariaLabel="Academic Coordinator signature canvas" />
                </section>
                <button type="button" onClick={endorse} disabled={busy || !finalizedSignature} className="btn-primary w-full cursor-pointer sm:w-auto">{busy ? "Saving endorsement..." : "Endorse and sign Form 1"}</button>
              </div>
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
