import { useEffect, useRef, useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";

export default function SignaturePad({ onChange, resetKey, ariaLabel = "Signature canvas" }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const hasDrawingRef = useRef(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [finalized, setFinalized] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    drawingRef.current = false;
    hasDrawingRef.current = false;
    setHasDrawing(false);
    setFinalized(false);
    onChange("");
  }, [resetKey]);

  function point(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvasRef.current.width / rect.width),
      y: (event.clientY - rect.top) * (canvasRef.current.height / rect.height),
    };
  }

  function start(event) {
    event.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = point(event);
    drawingRef.current = true;
    setFinalized(false);
    onChange("");
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    canvasRef.current.setPointerCapture?.(event.pointerId);
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
    hasDrawingRef.current = true;
    setHasDrawing(true);
  }

  function stop() {
    drawingRef.current = false;
  }

  function clear() {
    canvasRef.current.getContext("2d").clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    hasDrawingRef.current = false;
    setHasDrawing(false);
    setFinalized(false);
    onChange("");
  }

  function finalize() {
    if (!hasDrawingRef.current) return;
    onChange(canvasRef.current.toDataURL("image/png"));
    setFinalized(true);
  }

  return (
    <section aria-label={ariaLabel}>
      <div className="overflow-hidden rounded-xl border border-slate-300 bg-white">
        <canvas ref={canvasRef} width="720" height="180" onPointerDown={start} onPointerMove={draw} onPointerUp={stop} onPointerCancel={stop} className="h-40 w-full touch-none cursor-crosshair" aria-label={ariaLabel} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={clear} className="btn-ghost cursor-pointer"><RotateCcw className="h-4 w-4" />Clear drawing</button>
        <button type="button" onClick={finalize} disabled={!hasDrawing || finalized} className="btn-primary cursor-pointer"><CheckCircle2 className="h-4 w-4" />{finalized ? "Signature finalized" : "Finalize signature"}</button>
      </div>
      <p className={`mt-2 text-xs font-semibold ${finalized ? "text-emerald-700" : "text-slate-500"}`}>{finalized ? "Signature finalized and ready to submit." : "Use a mouse, stylus, or touch input, then finalize the signature."}</p>
    </section>
  );
}
